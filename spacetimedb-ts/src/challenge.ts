import { ScheduleAt, TimeDuration, type Timestamp } from 'spacetimedb';
import { SenderError, SyncResponse, t } from 'spacetimedb/server';
import spacetimedb, { challengeJob, demoCallJob, type Ctx, type Db, type Env } from './schema';
import { fixedTimeEquals, hmacSha256, toHex, utf8 } from './crypto';
import { complete } from './ai';
import { deliverProactive } from './photon';
import { killSwitchBlock } from './photon-guards';
import { PRACTICE_TEMPLATES, fillSlots, templateById } from './practice';
import { callIdOf, challengeTokenOf, normalizePhone, outcomeOf, recordPracticeCall, tacticOf } from './voice';

const day = 86_400_000_000n;
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// RETELL_API_BASE only exists so local tests can point at a dead address (no request ever reaches Retell).
const retellBase = (env: Env) => (env.RETELL_API_BASE || 'https://api.retellai.com').replace(/\/+$/, '');
const base = (env: Env) => (env.CHALLENGE_ROUTE_BASE || '').replace(/\/+$/, '');
// SMS enrollment path (JOIN texts, Groq drills, challenge_enrollment with a raw phone column): OFF unless
// CHALLENGE_ENABLED is exactly "true". Nothing inserts into challenge_enrollment or challenge_job otherwise.
function enabled(env: Env) {
  return env.CHALLENGE_ENABLED === 'true' && !killSwitchBlock(env, 'proactive')
    && /^https:\/\//.test(base(env)) && /^\+[1-9]\d{7,14}$/.test(env.CHALLENGE_NUMBER || '')
    && !!env.RETELL_AGENT_ID && !!env.RETELL_API_KEY && !!env.CHALLENGE_GROQ_KEY;
}
function registerInteraction(db: Db, now: Timestamp, token: string, kind: 'voice_response' | 'link_opened') {
  const row = db.challengeAttempt.token.find(token);
  if (!row || now.microsSinceUnixEpoch - row.createdAt.microsSinceUnixEpoch > day) return null;
  if (row.status === 'opened') return row.lesson;
  if (row.status !== 'issued' && row.status !== 'voice-issued') return null;
  if (row.status !== (kind === 'voice_response' ? 'voice-issued' : 'issued')) return null;
  db.challengeAttempt.token.update({...row,status:'opened'});
  db.activityEvent.insert({id:0n,owner:row.owner,game:'challenge-line',kind,
    details:JSON.stringify({lesson:row.lesson}),createdAt:now});
  return row.lesson;
}

export function enrollChallenge(tx: Pick<Ctx, 'db' | 'timestamp'>, env: Env, phone: string, mode: string,
  codeText: string, version: string, senderKey: string, spaceId: string, agentUserId: string) {
    if (env.CHALLENGE_ENABLED !== 'true' || !enabled(env)) return 'Phone challenges are unavailable.';
    const existing = tx.db.challengeEnrollment.phone.find(phone);
    const attemptKey = 'challenge:' + phone;
    const prior = tx.db.linkAttempt.senderKey.find(attemptKey);
    if (prior && tx.timestamp.microsSinceUnixEpoch - prior.windowStart.microsSinceUnixEpoch >= 600_000_000n)
      tx.db.linkAttempt.senderKey.delete(attemptKey);
    const attempts = tx.db.linkAttempt.senderKey.find(attemptKey);
    if (attempts && attempts.failures >= 5) return 'Too many attempts. Try again in 10 minutes.';
    const code = tx.db.linkCode.code.find(codeText);
    if (!code || code.expiresAt.microsSinceUnixEpoch <= tx.timestamp.microsSinceUnixEpoch) {
      if (attempts) tx.db.linkAttempt.senderKey.update({...attempts, failures:attempts.failures + 1});
      else tx.db.linkAttempt.insert({senderKey:attemptKey,windowStart:tx.timestamp,failures:1});
      return 'Code expired or invalid. Get a new code in SafeSense.';
    }
    tx.db.linkCode.owner.delete(code.owner);
    if (existing) tx.db.challengeEnrollment.owner.delete(existing.owner);
    tx.db.challengeEnrollment.owner.delete(code.owner);
    tx.db.challengeEnrollment.insert({owner:code.owner, phone:phone, mode, version, senderKey, spaceId, agentUserId});
    return 'SafeSense training enabled. Finish a game to receive a drill. Text STOP to end texts and calls.';
}

export function queueAfterGame(ctx: Ctx, game: string, kind: string) {
  if (ctx.env.CHALLENGE_ENABLED !== 'true' || !enabled(ctx.env)) return;
  const finished = (game === 'scam-or-not' && kind === 'run_done') ||
    (game === 'long-con' && kind === 'round_done') ||
    (game === 'fraudle' && ['word_solved','word_missed'].includes(kind));
  const user = finished && ctx.db.challengeEnrollment.owner.find(ctx.sender);
  if (!user || [...ctx.db.challengeJob.owner.filter(ctx.sender)].length) return;
  ctx.db.challengeJob.insert({scheduledId:0n, scheduledAt:ScheduleAt.time(ctx.timestamp.microsSinceUnixEpoch + 60_000_000n),
    owner:ctx.sender, version:user.version});
}

export const challengeRunJob = spacetimedb.procedure({onSchedule:challengeJob},{job:challengeJob.rowType},t.unit(),(ctx,{job}) => {
  if (!enabled(ctx.env)) return {};
  const secret = ctx.env.RETELL_API_KEY!;
  const plan = ctx.withTx(tx => {
    if (!tx.senderAuth.isInternal) throw new Error('Scheduled only');
    const user = tx.db.challengeEnrollment.owner.find(job.owner);
    if (!user || user.version !== job.version) return null;
    const phoneHash = toHex(hmacSha256(utf8(secret), utf8(user.phone)));
    const prior = [...tx.db.challengeAttempt.phoneHash.filter(phoneHash)];
    if (prior.filter(a => tx.timestamp.microsSinceUnixEpoch - a.createdAt.microsSinceUnixEpoch < day).length >= 3) return null;
    const misses: Record<string,number> = {};
    for (const row of tx.db.activityEvent.owner.filter(job.owner)) {
      if (row.kind !== 'answer_wrong') continue;
      try {
        const tactic = JSON.parse(row.details).tactic;
        if (PRACTICE_TEMPLATES.some(tp => tp.tactic === tactic)) misses[tactic] = (misses[tactic] || 0) + 1;
      } catch { /* Older activity can lack JSON details. */ }
    }
    const token = toHex(hmacSha256(utf8(secret), utf8('challenge:' + user.version + ':' + job.scheduledId)));
    tx.db.challengeAttempt.insert({token,owner:job.owner,phoneHash,createdAt:tx.timestamp,status:'reserved',lesson:''});
    return {token, misses, call:user.mode === 'CALL' || (user.mode === 'BOTH' && prior.length % 2 === 1)};
  });
  if (!plan) return {};
  const model = ctx.env.CHALLENGE_GROQ_MODEL || 'openai/gpt-oss-20b';
  const catalog = PRACTICE_TEMPLATES.map(({id,tactic}) => ({id,tactic}));
  const cfg = {key:ctx.env.CHALLENGE_GROQ_KEY!,baseUrl:'https://api.groq.com/openai/v1',model,visionModel:model,fallbackModel:model};
  const result = complete(ctx.http,cfg,model,m => JSON.stringify({model:m,messages:[
    {role:'system',content:'Pick the training template that best addresses the missed tactics. Return just its id.'},
    {role:'user',content:JSON.stringify({misses:plan.misses,catalog})}]}));
  const template = (result.ok && templateById(result.text.trim())) ||
    [...PRACTICE_TEMPLATES].sort((a,b) => (plan.misses[b.tactic] || 0) - (plan.misses[a.tactic] || 0))[0];
  let voiceScript = '';
  if (plan.call) {
    const draft = complete(ctx.http,cfg,model,m => JSON.stringify({model:m,messages:[
      {role:'system',content:'Write only the spoken opening of a short fictional scam-awareness voicemail, under 55 words. Use a fictional company and the supplied tactic. Give the caller a plausible pretext and a warning sign. No real brands, URLs, contact details, requests for personal data, payment instructions or stage directions. The app adds the response prompt.'},
      {role:'user',content:JSON.stringify({tactic:template.tactic,warningSigns:template.tells})}]}));
    voiceScript = draft.ok && draft.text.trim().length > 0 && draft.text.length <= 420 &&
      !/(?:https?:|www\.|@|\d[\d ()-]{6,}\d)/i.test(draft.text) ? draft.text.trim() : '';
  }
  const outbound = ctx.withTx(tx => {
    const user = tx.db.challengeEnrollment.owner.find(job.owner);
    const row = tx.db.challengeAttempt.token.find(plan.token);
    if (!user || user.version !== job.version || !row || row.status !== 'reserved') return null;
    const script = voiceScript || template.render(fillSlots(template,tx.random));
    tx.db.challengeAttempt.token.update({...row,status:plan.call ? 'voice-issued' : 'issued',lesson:template.lesson});
    return {...user,script};
  });
  if (!outbound) return {};
  if (!plan.call) {
    const link = base(ctx.env) + '/challenge?t=' + plan.token;
    deliverProactive(ctx, outbound, 'SafeSense training simulation. ' + outbound.script + ' Open your training link: ' + link, plan.token);
    return {};
  }
  const response = ctx.http.fetch(retellBase(ctx.env) + '/v2/create-phone-call', {
    method: 'POST', timeout: TimeDuration.fromMillis(10000),
    headers: {authorization: 'Bearer ' + secret, 'content-type': 'application/json'},
    body: utf8(JSON.stringify({
      from_number: ctx.env.CHALLENGE_NUMBER, to_number: outbound.phone,
      override_agent_id: ctx.env.RETELL_AGENT_ID,
      retell_llm_dynamic_variables: {training_script: outbound.script},
      metadata: {challenge_token: plan.token},
    })),
  });
  if (!response.ok) console.warn('Retell challenge call returned HTTP ' + response.status);
  return {};
});

export const challengeResponse = spacetimedb.httpHandler((ctx, req) => {
  const raw = req.text();
  const key = ctx.env.RETELL_API_KEY;
  const sig = /^v=(\d{13}),d=([a-f0-9]{64})$/.exec(req.headers.get('x-retell-signature') || '');
  if (!key || !sig || Math.abs(Number(ctx.timestamp.microsSinceUnixEpoch / 1000n) - Number(sig[1])) > 300000 ||
      !fixedTimeEquals(utf8(toHex(hmacSha256(utf8(key), utf8(raw + sig[1])))), utf8(sig[2]))) {
    return new SyncResponse('Invalid signature', {status:401});
  }
  let event;
  try { event = JSON.parse(raw); } catch { return new SyncResponse('Invalid JSON', {status:400}); }
  const call = event?.call;
  const token = call?.metadata?.challenge_token;
  let result = 'ignored';
  if (event?.event === 'call_analyzed' && call?.direction === 'outbound' && call.agent_id === ctx.env.RETELL_AGENT_ID &&
      call.from_number === ctx.env.CHALLENGE_NUMBER && typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)) {
    const outcome = outcomeOf(event);
    const callId = callIdOf(event);
    const tactic = tacticOf(event);
    result = ctx.withTx(tx => {
      const attempt = tx.db.challengeAttempt.token.find(token);
      if (!attempt) return 'unknown call';
      // The debrief card on Home (no points either way).
      if (call.call_analysis?.custom_analysis_data?.engaged_with_scenario === true)
        registerInteraction(tx.db, tx.timestamp, token, 'voice_response');
      // The practice-call point: +1 once per call id (the same dedupe as /voice/result).
      return outcome && callId ? recordPracticeCall(tx.db, attempt.owner, callId, outcome, tactic, tx.timestamp) : 'no outcome';
    });
    console.log('Challenge call result: ' + result);
  }
  return new SyncResponse(JSON.stringify({ result }), {status:200, headers:{'content-type':'application/json'}});
});

function html(body: string) {
  return new SyncResponse('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>SafeSense practice</title><main><h1>SafeSense practice</h1>'+body+'</main>',
    {status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer',
      'content-security-policy':"default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});
}
// A link scanner can fetch the page. Only an explicit form submission consumes the challenge.
export const challengeLanding = spacetimedb.httpHandler((ctx,req) => {
  const token = /[?&]t=([a-f0-9]{64})(?:&|$)/.exec(req.uri)?.[1];
  if (!token) return html('<p>This link is invalid.</p>');
  if (req.headers.get('sec-fetch-user') === '?1' && req.headers.get('sec-fetch-mode') === 'navigate') {
    return ctx.withTx(tx => debrief(registerInteraction(tx.db, tx.timestamp, token, 'link_opened')));
  }
  return html('<form method="post"><input type="hidden" name="t" value="'+token+'"><button>Open training scenario</button></form>');
});

export const challengeClaim = spacetimedb.httpHandler((ctx,req) => {
  const token = /^t=([a-f0-9]{64})$/.exec(req.text())?.[1];
  if (!token) return html('<p>This link is invalid.</p>');
  return ctx.withTx(tx => debrief(registerInteraction(tx.db, tx.timestamp, token, 'link_opened')));
});

function debrief(lesson: string | null) {
  return html(lesson === null ? '<p>This practice link has expired or is invalid.</p>' :
    '<p>This was a SafeSense training scenario: nobody real was calling.</p><p>'+escapeHtml(lesson)+
    '</p><p>Open your SafeSense dashboard to reflect on the warning signs.</p>');
}


// Web-started practice call (safesense/src/pages/PhoneCall.tsx, docs/VOICE.md "Practice call from the web"):
// skips SMS JOIN enrollment and the per-game trigger and places one Retell outbound call with a fixed script.
// Private beta: only numbers on CHALLENGE_ALLOWED_NUMBERS (comma-separated, normalized like the typed number),
// at most DemoCallsPerNumberPerDay per number and DemoCallsPerDay overall per UTC day, behind the proactive
// kill switch (PHOTON_SENDING_ENABLED == "true"). Anything missing or refused gets the same calm beta message,
// so the page never shows a config error and the allowlist is never revealed.
// The number lives only in the demo_call_job row until the job fires (the job deletes it first thing);
// challenge_attempt and demo_call_count keep an HMAC of it, never the number.
// Points: challenge-line rows never earn or reset points (safesense/src/lib/progress.ts). A finished call earns
// +1 through recordPracticeCall (voice.ts), once per Retell call id, from either webhook route.
const DEMO_SCRIPT = 'Hi, this is Jordan from the fraud alerts team at your bank. We noticed two unusual charges on your card totaling four hundred and twelve dollars and need to verify them with you right now before we lock the account. Can you confirm it is really you?';
const DEMO_LESSON = 'A real bank will never ask you to confirm charges or move money during an unexpected call. Hang up and call the number on the back of your card.';
const BETA_MESSAGE = 'Phone practice calls are in a private beta right now. Try the games or text SafeSense instead.';
// Invited numbers only, so the caps are just a safety net against a runaway loop billing Retell (Diego: no
// per-number limit for the demo). Both are per UTC day.
const DemoCallsPerDay = 100;
const DemoCallsPerNumberPerDay = 100;

function demoConfigured(env: Env) {
  return !!env.RETELL_API_KEY && !!env.RETELL_AGENT_ID && /^\+[1-9]\d{7,14}$/.test(env.CHALLENGE_NUMBER || '');
}

/** The allowlist, normalized (entries that don't parse are skipped). Empty when unset. */
function allowedNumbers(env: Env): Set<string> {
  const out = new Set<string>();
  for (const raw of (env.CHALLENGE_ALLOWED_NUMBERS || '').split(',')) {
    const n = normalizePhone(raw);
    if (n) out.add(n);
  }
  return out;
}

function bumpCount(db: Db, key: string, max: number): boolean {
  const row = db.demoCallCount.key.find(key);
  if (row && row.count >= max) return false;
  if (row) db.demoCallCount.key.update({ ...row, count: row.count + 1 });
  else db.demoCallCount.insert({ key, count: 1 });
  return true;
}

export const startChallengeDemo = spacetimedb.reducer({ phone: t.string() }, (ctx, args) => {
  if (!demoConfigured(ctx.env)) throw new SenderError(BETA_MESSAGE);
  const phone = normalizePhone(args.phone || '');
  if (!phone) throw new SenderError('Enter your phone number with the country code, for example +1 512 555 1212.');
  if (!allowedNumbers(ctx.env).has(phone) || killSwitchBlock(ctx.env, 'proactive')) throw new SenderError(BETA_MESSAGE);
  const key = ctx.env.RETELL_API_KEY!;
  const phoneHash = toHex(hmacSha256(utf8(key), utf8(phone)));

  // Daily caps (UTC day). The global cap is checked before counting so a refused call doesn't use it up.
  const today = String(ctx.timestamp.microsSinceUnixEpoch / day);
  const all = ctx.db.demoCallCount.key.find(today + ':all');
  if (all && all.count >= DemoCallsPerDay)
    throw new SenderError('Today’s practice calls are all used up. Try again tomorrow, or play a game meanwhile.');
  if (!bumpCount(ctx.db, today + ':' + phoneHash, DemoCallsPerNumberPerDay))
    throw new SenderError('That’s all the practice calls for this number today. Try again tomorrow.');
  bumpCount(ctx.db, today + ':all', DemoCallsPerDay);

  // Drop any stale queued demo call for this owner so we don't fire two at once.
  for (const row of [...ctx.db.demoCallJob.owner.filter(ctx.sender)])
    ctx.db.demoCallJob.scheduledId.delete(row.scheduledId);

  const seed = ctx.random.fill(new Uint8Array(32));
  const tokenBasis = 'demo:' + ctx.sender.toHexString() + ':' + ctx.timestamp.microsSinceUnixEpoch + ':' + toHex(seed);
  const token = toHex(hmacSha256(utf8(key), utf8(tokenBasis)));

  ctx.db.challengeAttempt.insert({
    token, owner: ctx.sender, phoneHash, createdAt: ctx.timestamp, status: 'voice-issued', lesson: DEMO_LESSON,
  });
  ctx.db.demoCallJob.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(ctx.timestamp.microsSinceUnixEpoch + 1_000_000n),
    owner: ctx.sender, phone, token,
  });
});

// Scheduled ~1 s after startChallengeDemo: deletes its row (and the number with it) first, then makes the Retell
// outbound call. Fire-and-forget: the post-call webhook (challengeResponse or /voice/result) records the result.
export const demoCallRunJob = spacetimedb.procedure(
  { onSchedule: demoCallJob },
  { job: demoCallJob.rowType },
  t.unit(),
  (ctx, { job }) => {
    ctx.withTx(tx => { tx.db.demoCallJob.scheduledId.delete(job.scheduledId); return 0; });
    const env = ctx.env;
    if (!demoConfigured(env) || killSwitchBlock(env, 'proactive') || !allowedNumbers(env).has(job.phone)) {
      console.warn('Demo call skipped: not configured, sending off or number no longer allowed');
      return {};
    }
    let ok = false;
    try {
      const response = ctx.http.fetch(retellBase(ctx.env) + '/v2/create-phone-call', {
        method: 'POST', timeout: TimeDuration.fromMillis(10000),
        headers: { authorization: 'Bearer ' + env.RETELL_API_KEY!, 'content-type': 'application/json' },
        body: utf8(JSON.stringify({
          from_number: env.CHALLENGE_NUMBER, to_number: job.phone,
          override_agent_id: env.RETELL_AGENT_ID,
          retell_llm_dynamic_variables: { training_script: DEMO_SCRIPT },
          metadata: { challenge_token: job.token },
        })),
      });
      ok = response.ok;
      if (!ok) console.warn('Retell demo call returned HTTP ' + response.status);
    } catch {
      console.warn('Retell demo call failed (network)');
    }
    if (!ok) ctx.withTx(tx => {
      const row = tx.db.challengeAttempt.token.find(job.token);
      if (row && row.status === 'voice-issued') tx.db.challengeAttempt.token.update({ ...row, status: 'call-failed' });
      return 0;
    });
    return {};
  }
);

// Demo fallback: fires 'challenge-line/voice_response' on the caller's most recent live voice attempt,
// same semantics as a valid engaged_with_scenario webhook. Use when Retell cannot reach this backend
// (e.g., no public tunnel) so the dashboard still resets on stage.
export const confirmChallengeEngaged = spacetimedb.reducer(ctx => {
  const nowMicros = ctx.timestamp.microsSinceUnixEpoch;
  const live = [...ctx.db.challengeAttempt.owner.filter(ctx.sender)]
    .filter(a => (a.status === 'voice-issued' || a.status === 'issued')
              && nowMicros - a.createdAt.microsSinceUnixEpoch < day);
  if (live.length === 0) throw new SenderError('No active training attempt to confirm. Start a call first.');
  const latest = live.reduce((a, b) =>
    a.createdAt.microsSinceUnixEpoch >= b.createdAt.microsSinceUnixEpoch ? a : b);
  registerInteraction(ctx.db, ctx.timestamp, latest.token, 'voice_response');
});
