// Outbound guards for Photon messaging (photon.ts): kill switch, STOP/START opt-out, per-sender daily cap,
// and what a future proactive send (practice texts) would need. Every outbound Photon message goes through
// photon.ts deliver(), which asks these functions first.
//
//  - Kill switch, env PHOTON_SENDING_ENABLED:
//      unset/empty  -> replies to an inbound text, in the same webhook request, are sent; proactive sends are not;
//      "true"       -> replies and proactive sends;
//      anything else ("false", "off", ...) -> nothing is sent. Webhooks are still verified, deduped and acked.
//  - STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT (whole message, any case) -> opted out: one confirmation,
//    then silence (no AI turn, nothing stored) until START.
//  - At most MaxDailySends outbound messages per sender per UTC day; the last one says so.
import { type Identity, Timestamp } from 'spacetimedb';
import type { Db, Env } from './schema';

export const MaxDailySends = 30;
const MicrosPerDay = 86_400_000_000n;
const StopWords = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']);
export const OptOutReply = "You won't get messages from SafeSense. Text START to turn them back on.";
export const OptInReply = "You're back on. Send me a suspicious text or a screenshot anytime and I'll take a look.";
export const StartReply = "Hi, I'm SafeSense. Send me a suspicious text or a screenshot and I'll tell you what I think.";
export const LastSendNote = "\n\n(That's my last reply for today. Text me again tomorrow.)";

export type SendKind = 'reply' | 'proactive';

/** "STOP", "stop", " Stop. " -> true; "stop calling me" -> false. */
export function isStopWord(text: string): boolean {
  return StopWords.has(normalizeCommand(text));
}

export function isStartWord(text: string): boolean {
  return normalizeCommand(text) === 'START';
}

function normalizeCommand(text: string): string {
  return text.trim().replace(/[.!]+$/, '').trim().toUpperCase();
}

/** null = this kind of send is allowed; else why not (for the log). */
export function killSwitchBlock(env: Env, kind: SendKind): string | null {
  const v = (env.PHOTON_SENDING_ENABLED ?? '').trim().toLowerCase();
  if (v === 'true') return null;
  if (v.length === 0) return kind === 'reply' ? null : 'PHOTON_SENDING_ENABLED is not "true" (proactive sends need it)';
  return 'PHOTON_SENDING_ENABLED is set and not "true"';
}

export function isOptedOut(db: Db, senderKey: string): boolean {
  return db.channelOptout.senderKey.find(senderKey) != null;
}

/** Record an opt-out. true = new (send the one confirmation), false = already opted out (stay silent). */
export function optOut(db: Db, senderKey: string, now: Timestamp): boolean {
  if (isOptedOut(db, senderKey)) return false;
  db.channelOptout.insert({ senderKey, optedOutAt: now });
  return true;
}

/** Remove an opt-out. true = they were opted out. */
export function optIn(db: Db, senderKey: string): boolean {
  return db.channelOptout.senderKey.delete(senderKey);
}

function today(now: Timestamp): bigint {
  return now.microsSinceUnixEpoch / MicrosPerDay;
}

function sentToday(db: Db, senderKey: string, now: Timestamp): number {
  const row = db.channelSendDaily.senderKey.find(senderKey);
  return row && row.day === today(now) ? row.sent : 0;
}

export function dailyCapReached(db: Db, senderKey: string, now: Timestamp): boolean {
  return sentToday(db, senderKey, now) >= MaxDailySends;
}

/**
 * Count one outbound message for the sender. ok=false: over today's cap (don't send). last=true: this is
 * the final message allowed today. overCap lets the one-time STOP confirmation through even when capped.
 */
export function reserveSend(db: Db, senderKey: string, now: Timestamp, overCap = false): { ok: boolean; last: boolean } {
  const day = today(now);
  const sent = sentToday(db, senderKey, now);
  if (sent >= MaxDailySends && !overCap) return { ok: false, last: false };
  const row = { senderKey, day, sent: sent + 1 };
  if (db.channelSendDaily.senderKey.find(senderKey)) db.channelSendDaily.senderKey.update(row);
  else db.channelSendDaily.insert(row);
  return { ok: true, last: sent + 1 === MaxDailySends };
}

/** Save where a proactive send would go, after a successful LINK (only for the linked owner). */
export function saveReach(db: Db, senderKey: string, owner: Identity, platform: string, spaceId: string, agentUserId: string, now: Timestamp) {
  const row = { senderKey, owner, platform, spaceId, agentUserId, savedAt: now };
  if (db.channelReach.senderKey.find(senderKey)) db.channelReach.senderKey.update(row);
  else db.channelReach.insert(row);
}

export function dropReachOfSender(db: Db, senderKey: string) {
  db.channelReach.senderKey.delete(senderKey);
}

export function dropReachOfOwner(db: Db, owner: Identity) {
  for (const r of [...db.channelReach.owner.filter(owner)]) db.channelReach.senderKey.delete(r.senderKey);
}

/**
 * For future proactive sends (practice texts): where to send for `owner`'s linked sender, or why not.
 * Requires the kill switch at "true", a live channel_link with the same owner, no opt-out and room under
 * the daily cap. Photon's shared line still refuses a send unless that phone texted the line first.
 */
export function proactiveTarget(
  db: Db,
  env: Env,
  owner: Identity,
  now: Timestamp
): { senderKey: string; spaceId: string; agentUserId: string } | string {
  const blocked = killSwitchBlock(env, 'proactive');
  if (blocked) return blocked;
  for (const r of db.channelReach.owner.filter(owner)) {
    const link = db.channelLink.senderKey.find(r.senderKey);
    if (!link || !link.owner.isEqual(owner)) continue; // unlinked or forgotten since: stale, never used
    if (isOptedOut(db, r.senderKey)) return 'opted out';
    if (dailyCapReached(db, r.senderKey, now)) return 'daily cap reached';
    return { senderKey: r.senderKey, spaceId: r.spaceId, agentUserId: r.agentUserId };
  }
  return 'no linked phone';
}
