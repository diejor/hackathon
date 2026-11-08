import { ScheduleAt, TimeDuration, type Timestamp } from 'spacetimedb';
import { SenderError, SyncResponse, t } from 'spacetimedb/server';
import spacetimedb, { challengeJob, demoCallJob, type Ctx, type Db, type Env } from './schema';
import { fixedTimeEquals, hmacSha256, toHex, utf8 } from './crypto';
import { complete } from './ai';
import { deliverProactive } from './photon';
import { killSwitchBlock } from './photon-guards';
import { PRACTICE_TEMPLATES, fillSlots, templateById } from './practice';

const day = 86_400_000_000n;
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const base = (env: Env) => (env.CHALLENGE_ROUTE_BASE || '').replace(/\/+$/, '');
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
    if (!enabled(env)) return 'Phone challenges are unavailable.';
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
  if (!enabled(ctx.env)) return;
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
  const response = ctx.http.fetch('https://api.retellai.com/v2/create-phone-call', {
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
    return new SyncResponse('Invalid signature', {status:403});
  }
  let event;
  try { event = JSON.parse(raw); } catch { return new SyncResponse('Invalid JSON', {status:400}); }
  const call = event?.call;
  const token = call?.metadata?.challenge_token;
  if (event?.event === 'call_analyzed' && call?.direction === 'outbound' && call.agent_id === ctx.env.RETELL_AGENT_ID &&
      call.from_number === ctx.env.CHALLENGE_NUMBER && typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) &&
      call.call_analysis?.custom_analysis_data?.engaged_with_scenario === true) {
    ctx.withTx(tx => registerInteraction(tx.db, tx.timestamp, token, 'voice_response'));
  }
  return new SyncResponse('OK', {status:200});
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
    '<p>This was a training scenario. Opening the link reset your practice points.</p><p>'+escapeHtml(lesson)+
    '</p><p>Open your SafeSense dashboard to reflect on the warning signs.</p>');
}


// Demo-only button flow (safesense/src/pages/PhoneCall.tsx): skips SMS JOIN enrollment and the per-game
// trigger. Kicks off one Retell outbound call to the supplied phone with a hardcoded practice script.
// The Retell call_analyzed webhook above (challengeResponse) fires 'challenge-line/voice_response' when
// the player engages; totalPoints() in safesense/src/lib/progress.ts treats that event as a cutoff and
// zeros points earned before it. If the webhook can't reach this backend (no public tunnel), the frontend
// can call confirmChallengeEngaged below as a manual fallback.
const DEMO_SCRIPT = 'Hi, this is Jordan from the fraud alerts team at your bank. We noticed two unusual charges on your card totaling four hundred and twelve dollars and need to verify them with you right now before we lock the account. Can you confirm it is really you?';
const DEMO_LESSON = 'A real bank will never ask you to confirm charges or move money during an unexpected call. Hang up and call the number on the back of your card.';

export const startChallengeDemo = spacetimedb.reducer({ phone: t.string() }, (ctx, args) => {
  const key = ctx.env.RETELL_API_KEY;
  const agent = ctx.env.RETELL_AGENT_ID;
  const from = ctx.env.CHALLENGE_NUMBER;
  if (!key || !agent || !from) throw new SenderError('Phone training is not configured on this server.');
  const phone = (args.phone || '').trim();
  if (!/^\+[1-9]\d{7,14}$/.test(phone))
    throw new SenderError('Enter your phone in international format, e.g. +15125551212.');
  if (killSwitchBlock(ctx.env, 'proactive'))
    throw new SenderError('Proactive sending is disabled on this server.');

  // Drop any stale queued demo call for this owner so we don't fire two at once.
  for (const row of ctx.db.demoCallJob.owner.filter(ctx.sender))
    ctx.db.demoCallJob.scheduledId.delete(row.scheduledId);

  const seed = ctx.random.fill(new Uint8Array(32));
  const tokenBasis = 'demo:' + ctx.sender.toHexString() + ':' + ctx.timestamp.microsSinceUnixEpoch + ':' + toHex(seed);
  const token = toHex(hmacSha256(utf8(key), utf8(tokenBasis)));
  const phoneHash = toHex(hmacSha256(utf8(key), utf8(phone)));

  ctx.db.challengeAttempt.insert({
    token, owner: ctx.sender, phoneHash, createdAt: ctx.timestamp, status: 'voice-issued', lesson: DEMO_LESSON,
  });
  ctx.db.demoCallJob.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(ctx.timestamp.microsSinceUnixEpoch + 1_000_000n),
    owner: ctx.sender, phone, token,
  });
});

// Scheduled ~1 s after startChallengeDemo: makes the Retell outbound call. Fire-and-forget — the Retell
// webhook (challengeResponse) is what feeds voice_response back into the dashboard; see also the manual
// fallback below for when the webhook can't reach this backend.
export const demoCallRunJob = spacetimedb.procedure(
  { onSchedule: demoCallJob },
  { job: demoCallJob.rowType },
  t.unit(),
  (ctx, { job }) => {
    const key = ctx.env.RETELL_API_KEY;
    const agent = ctx.env.RETELL_AGENT_ID;
    const from = ctx.env.CHALLENGE_NUMBER;
    if (!key || !agent || !from) return {};
    const response = ctx.http.fetch('https://api.retellai.com/v2/create-phone-call', {
      method: 'POST', timeout: TimeDuration.fromMillis(10000),
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: utf8(JSON.stringify({
        from_number: from, to_number: job.phone,
        override_agent_id: agent,
        retell_llm_dynamic_variables: { training_script: DEMO_SCRIPT },
        metadata: { challenge_token: job.token },
      })),
    });
    if (!response.ok) console.warn('Retell demo call returned HTTP ' + response.status);
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
