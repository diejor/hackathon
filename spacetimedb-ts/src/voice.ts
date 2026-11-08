// Practice calls: a voice agent (Retell AI, Krishna's) phones a player with a fake scam, or the player calls it.
// Two HTTP routes let the agent talk to us (docs/VOICE.md):
//
//   POST /voice/context  phone number in  ->  string-only dynamic variables out (name, weak tactics, ...)
//   POST /voice/result   call outcome in  ->  one activity_event for the player (game "practice-call")
//
// Security model:
//  - Every request needs Retell's X-Retell-Signature ("v=<ms>,d=<hex HMAC-SHA256(body + ms, RETELL_API_KEY)>",
//    within 5 minutes) or the header x-safesense-voice-secret equal to VOICE_WEBHOOK_SECRET; else 401.
//    Neither env var set: 503. Bodies over the size cap: 413. No AI calls, nothing is ever sent from here.
//  - Phone numbers are never stored or logged. voice_link maps a salted SHA-256 of the normalized number to the
//    player; it is filled when a phone LINKs over iMessage (photon.ts) and dropped by UNLINK / FORGET ME.
//  - A result is recorded once per call id (webhook_seen, key "voice:<call id>"): retries and the post-call
//    webhook after a mid-call report don't count twice.
//  - Unknown numbers get generic variables (200), never an error that would break the call.
import { SyncResponse, type Request } from 'spacetimedb/server';
import { type Identity, type Timestamp } from 'spacetimedb';
import spacetimedb, { type Db, type Handler } from './schema';
import { finishedGames, missedTactics, recordActivity } from './activity';
import { concat, fixedTimeEquals, fromHex, fromUtf8, hmacSha256, sha256, toHex, utf8 } from './crypto';
import { has, header, isObject, markSeen, prop, respond, str } from './photon';

export const PracticeCallGame = 'practice-call';
const PhoneSalt = 'safesense/voice-phone/v1\n'; // fixed: changing it orphans every voice_link row
const MaxContextBytes = 64 * 1024; // inbound webhook / custom function (the transcript so far rides along)
const MaxResultBytes = 512 * 1024; // the post-call webhook carries the whole transcript
const SignatureToleranceMs = 5n * 60_000n;

// ---------- Phone numbers (hashed, never stored) ----------

/** E.164 ("+15551234567") or null. US/Canada 10-digit and 1+10-digit numbers get +1; emails and short codes are null. */
export function normalizePhone(raw: string): string | null {
  const s = raw.trim();
  if (s.length === 0 || s.length > 40 || s.includes('@')) return null;
  const digits = s.replace(/\D/g, '');
  if (/^\s*(tel:)?\+/i.test(s)) return digits.length >= 8 && digits.length <= 15 ? '+' + digits : null;
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits[0] === '1') return '+' + digits;
  return null;
}

export function phoneHash(e164: string): string {
  return toHex(sha256(utf8(PhoneSalt + e164)));
}

// On a successful LINK (photon.ts): this sender's phone now belongs to `owner`. handle = Photon's sentBy.handle
// (a phone number or an Apple ID email; emails get no voice link).
export function saveVoiceLink(db: Db, senderKey: string, owner: Identity, handle: string, now: Timestamp) {
  dropVoiceOfSender(db, senderKey);
  const e164 = normalizePhone(handle);
  if (!e164) return;
  const hash = phoneHash(e164);
  db.voiceLink.phoneHash.delete(hash); // the same number linked through another sender: the newest link wins
  db.voiceLink.insert({ phoneHash: hash, owner, senderKey, linkedAt: now });
}

export function dropVoiceOfSender(db: Db, senderKey: string) {
  for (const v of [...db.voiceLink.senderKey.filter(senderKey)]) db.voiceLink.phoneHash.delete(v.phoneHash);
}

export function dropVoiceOfOwner(db: Db, owner: Identity) {
  for (const v of [...db.voiceLink.owner.filter(owner)]) db.voiceLink.phoneHash.delete(v.phoneHash);
}

// The player behind the first candidate number that is linked (and whose channel_link still exists).
function ownerFor(db: Db, phones: string[]): Identity | null {
  for (const p of phones) {
    const e164 = normalizePhone(p);
    if (!e164) continue;
    const v = db.voiceLink.phoneHash.find(phoneHash(e164));
    if (!v) continue;
    const link = db.channelLink.senderKey.find(v.senderKey);
    if (link && link.owner.isEqual(v.owner)) return v.owner;
  }
  return null;
}

// Candidate player numbers, most specific first: an explicit phone, then the call's number on the player's side
// (outbound call: to_number; inbound: from_number; unknown direction: both).
function playerPhones(root: unknown): string[] {
  const args = prop(root, 'args');
  const out: string[] = [];
  for (const el of [root, args])
    for (const k of ['phone', 'phone_number', 'player_phone', 'user_number']) {
      const v = str(el, k);
      if (v) out.push(v);
    }
  const inbound = prop(root, 'call_inbound');
  if (isObject(inbound)) out.push(str(inbound, 'from_number'));
  const call = prop(root, 'call');
  if (isObject(call)) {
    const dir = str(call, 'direction');
    if (dir === 'outbound') out.push(str(call, 'to_number'));
    else if (dir === 'inbound') out.push(str(call, 'from_number'));
    else out.push(str(call, 'from_number'), str(call, 'to_number'));
  }
  return out.filter(p => p.length > 0).slice(0, 8);
}

// ---------- Auth ----------

type Authorized = { body: Uint8Array } | { error: SyncResponse };

function authorize(ctx: Handler, request: Request, maxBytes: number): Authorized {
  const apiKey = ctx.env.RETELL_API_KEY;
  const shared = ctx.env.VOICE_WEBHOOK_SECRET;
  if (!apiKey && !shared) return { error: respond(503, 'voice not configured') };
  const declared = Number(header(request, 'content-length') || '0');
  if (declared > maxBytes) return { error: respond(413, 'body too large') };
  const body = request.bytes();
  if (body.length > maxBytes) return { error: respond(413, 'body too large') };

  if (shared) {
    const given = header(request, 'x-safesense-voice-secret');
    // Compare digests: constant time and no length leak.
    if (given.length > 0 && fixedTimeEquals(sha256(utf8(given)), sha256(utf8(shared)))) return { body };
  }
  if (apiKey && retellSignatureOk(apiKey, header(request, 'x-retell-signature'), body, ctx.timestamp)) return { body };
  console.warn('Voice: rejected request (bad or missing secret/signature)');
  return { error: respond(401, 'unauthorized') };
}

// Retell's format (retell-sdk lib/webhook_auth.js): "v=<unix ms>,d=<hex HMAC-SHA256(raw body + ms, api key)>".
function retellSignatureOk(apiKey: string, signature: string, body: Uint8Array, now: Timestamp): boolean {
  const m = /^v=(\d{1,16}),d=([0-9a-fA-F]{64})$/.exec(signature);
  if (!m) return false;
  const nowMs = now.microsSinceUnixEpoch / 1000n;
  const diff = nowMs - BigInt(m[1]);
  if (diff > SignatureToleranceMs || diff < -SignatureToleranceMs) return false;
  const given = fromHex(m[2]);
  if (!given) return false;
  return fixedTimeEquals(given, hmacSha256(utf8(apiKey), concat(body, utf8(m[1]))));
}

function json(status: number, value: unknown): SyncResponse {
  return new SyncResponse(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function parse(body: Uint8Array): unknown {
  try {
    return JSON.parse(fromUtf8(body));
  } catch {
    return null;
  }
}

// ---------- POST /voice/context ----------

export type VoiceVars = {
  known_player: string;
  player_name: string;
  games_played: string;
  weak_tactics: string;
  top_tactic: string;
};

const GenericVars: VoiceVars = {
  known_player: 'no',
  player_name: 'there',
  games_played: '0',
  weak_tactics: 'none yet',
  top_tactic: 'none',
};

// Plain words for the tactic slugs the games log (safesense/src/content/signs.ts), for the agent to say aloud.
const TacticWords: Record<string, string> = {
  'fake-delivery': 'fake delivery fees',
  'bank-impersonation': 'fake bank alerts',
  'family-emergency': 'family emergency scams',
  'prize-giveaway': 'prize and giveaway scams',
  prize: 'prize and giveaway scams',
  'wrong-number': 'wrong-number texts',
  urgency: 'pressure to act fast',
  'tech-support': 'fake tech support',
  'gift-card': 'gift card requests',
  authority: 'pretending to be an authority',
};

const tacticWords = (slug: string) => TacticWords[slug] ?? slug.replace(/[-_]+/g, ' ');

function joinWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}

// A first name the player told the bot ("Their name is Sam"), if any. The web keeps its display name on the
// device only, so this is best effort; "there" otherwise ("Hi there").
function nameFromFacts(db: Db, owner: Identity): string {
  for (const f of db.memoryFact.owner.filter(owner)) {
    const m = /\b(?:name is|goes by|called)\s+([A-Z][\p{L}'-]{1,20})/u.exec(f.fact);
    if (m) return m[1];
  }
  return '';
}

export function contextVars(db: Db, phones: string[]): VoiceVars {
  const owner = ownerFor(db, phones);
  if (!owner) return GenericVars;
  const events = [...db.activityEvent.owner.filter(owner)];
  const weak = missedTactics(events, 3);
  return {
    known_player: 'yes',
    player_name: nameFromFacts(db, owner) || 'there',
    games_played: String(finishedGames(events)),
    weak_tactics: weak.length > 0 ? joinWords(weak.map(tacticWords)) : 'none yet',
    top_tactic: weak[0] ?? 'none',
  };
}

// Accepts Retell's inbound-call webhook ({event:"call_inbound", call_inbound:{from_number,...}}; answered with
// {call_inbound:{dynamic_variables}}), a custom function ({name, call:{...}, args:{...}} or args only), or
// {phone:"+1..."} (answered with the variables as a flat JSON object).
export const voiceContext = spacetimedb.httpHandler((ctx, request) => {
  const auth = authorize(ctx, request, MaxContextBytes);
  if ('error' in auth) return auth.error;
  const root = parse(auth.body); // unparseable: generic variables, the call goes on
  const vars = ctx.withTx(tx => contextVars(tx.db, playerPhones(root)));
  console.log(`Voice: context for ${vars.known_player === 'yes' ? 'a linked player' : 'an unknown number'}`);
  const inbound = str(root, 'event') === 'call_inbound' || has(root, 'call_inbound');
  return json(200, inbound ? { call_inbound: { dynamic_variables: vars } } : vars);
});

// ---------- POST /voice/result ----------

const CaughtWords = new Set(['caught', 'spotted', 'reported', 'refused', 'hung_up', 'hungup', 'safe', 'passed', 'correct', 'yes', 'true']);
const FooledWords = new Set(['fooled', 'fell', 'fell_for_it', 'scammed', 'complied', 'shared', 'failed', 'wrong', 'no', 'false']);

function outcomeWord(v: unknown): 'caught' | 'fooled' | null {
  if (v === true) return 'caught';
  if (v === false) return 'fooled';
  if (typeof v !== 'string') return null;
  const w = v.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return CaughtWords.has(w) ? 'caught' : FooledWords.has(w) ? 'fooled' : null;
}

// Where an outcome / tactic can be: the custom function's args, the top level (simple shape or args only), then
// the post-call webhook's call analysis (custom_analysis_data), collected / dynamic variables and metadata.
function sources(root: unknown): unknown[] {
  const call = prop(root, 'call');
  const analysis = prop(call, 'call_analysis');
  return [
    prop(root, 'args'),
    root,
    prop(analysis, 'custom_analysis_data'),
    prop(call, 'collected_dynamic_variables'),
    prop(call, 'metadata'),
    prop(call, 'retell_llm_dynamic_variables'),
  ].filter(isObject);
}

export function outcomeOf(root: unknown): 'caught' | 'fooled' | null {
  for (const s of sources(root)) {
    const o = outcomeWord(prop(s, 'outcome')) ?? outcomeWord(prop(s, 'caught'));
    if (o) return o;
  }
  return null;
}

export function tacticOf(root: unknown): string {
  // Only an explicit "tactic" (never the context's top_tactic: the call's scenario may be a different one).
  for (const s of sources(root)) {
    const t = str(s, 'tactic').trim().toLowerCase().replace(/\s+/g, '-');
    if (/^[a-z0-9_-]{1,32}$/.test(t) && t !== 'none') return t;
  }
  return '';
}

export function callIdOf(root: unknown): string {
  const raw = str(prop(root, 'call'), 'call_id') || str(prop(root, 'args'), 'call_id') || str(root, 'call_id');
  const id = raw.trim();
  return /^[A-Za-z0-9_.:-]{1,80}$/.test(id) ? id : '';
}

// Accepts {call_id, phone, outcome:"caught"|"fooled", tactic?}, a custom function ({name, call, args:{outcome,
// tactic}}) or Retell's post-call webhook ({event:"call_ended"|"call_analyzed", call:{call_id, direction,
// from_number, to_number, call_analysis:{custom_analysis_data:{outcome, tactic}}, ...}}).
export const voiceResult = spacetimedb.httpHandler((ctx, request) => {
  const auth = authorize(ctx, request, MaxResultBytes);
  if ('error' in auth) return auth.error;
  const root = parse(auth.body);
  if (!isObject(root)) return respond(400, 'invalid JSON');
  const event = str(root, 'event');
  if (event.length > 0 && event !== 'call_ended' && event !== 'call_analyzed') return json(200, { result: 'ignored', why: 'event' });

  const outcome = outcomeOf(root);
  if (!outcome) return json(200, { result: 'ignored', why: 'no outcome' }); // e.g. call_ended before the analysis
  const callId = callIdOf(root);
  if (!callId) return respond(400, 'call_id required');
  const tactic = tacticOf(root);
  const phones = playerPhones(root);

  const token = challengeTokenOf(root);
  const result = ctx.withTx(tx => {
    // A linked phone, else the player who started this call from the Phone Call page (challenge.ts).
    const owner = ownerFor(tx.db, phones) ?? (token ? tx.db.challengeAttempt.token.find(token)?.owner ?? null : null);
    if (!owner) return 'unknown caller';
    return recordPracticeCall(tx.db, owner, callId, outcome, tactic, tx.timestamp);
  });
  console.log(`Voice: result ${result} (${outcome}${tactic ? ', ' + tactic : ''})`);
  return json(200, { result, outcome, tactic });
});

// The token startChallengeDemo put in the call's metadata (challenge.ts), if any.
export function challengeTokenOf(root: unknown): string {
  const t = str(prop(prop(root, 'call'), 'metadata'), 'challenge_token');
  return /^[a-f0-9]{64}$/.test(t) ? t : '';
}

// One finished practice call = one practice-call row (+1 point on the web), at most once per call id, whichever
// route (/voice/result or /challenge-response) hears about it first.
export function recordPracticeCall(db: Db, owner: Identity, callId: string, outcome: 'caught' | 'fooled', tactic: string,
  now: Timestamp): 'recorded' | 'duplicate' {
  if (!markSeen(db, `voice:${callId}`, now)) return 'duplicate';
  const details = JSON.stringify({ call: callId, tactic, outcome });
  recordActivity(db, owner, PracticeCallGame, outcome === 'caught' ? 'answer_correct' : 'answer_wrong', details, now);
  return 'recorded';
}
