// Help Bot on messaging apps (iMessage, WhatsApp, ...) through Photon (https://photon.codes, Beta 2.0 API).
//
//   Photon --POST /photon (signed webhook, event message.received)--> this module
//   this module --POST {PHOTON_BASE_URL}/v1/projects/{id}/messages--> Photon --> the person's phone
//
// Served at /v1/database/<db>/route/photon. Configure PHOTON_WEBHOOK_SECRET (+ PHOTON_API_KEY to reply).
//
// Security model:
//  - Every request must carry a valid Standard Webhooks signature (HMAC-SHA256 over id.timestamp.body,
//    keyed with the destination's whsec_ secret) and a timestamp within 5 minutes; else 401. No secret: 503.
//  - Each webhook-id is handled once (webhook_seen, private). Retries of a handled event just get 200.
//  - A sender is identified by Photon's user id. Until it is linked, it gets its own pseudo identity
//    (pseudoIdentity), so strangers never see or touch anyone else's chat. Linking needs a one-time code
//    that only the player can see (my_link_code), valid 10 minutes, with wrong codes rate-limited per sender.
//  - Screenshots are downloaded, sent to the model and never stored (same as the web). Only JPEG/PNG/WebP/
//    HEIC/HEIF are accepted (Content-Type, else magic bytes); other attachments get a fixed reply, no model call.
//  - AI turns are budgeted per sender (channel_ai_usage: 8 per rolling minute), not the web's 3 s cooldown.
//  - channel_link / link_code / link_attempt / webhook_seen are private; players see only their own rows.
//  - Outbound guards (photon-guards.ts): kill switch PHOTON_SENDING_ENABLED, STOP/START opt-out, a daily
//    cap per sender; every outbound message goes through deliver(). The bot only ever replies to a text.
import { t, SenderError, SyncResponse, type Headers, type Request } from 'spacetimedb/server';
import { Identity, Timestamp, TimeDuration } from 'spacetimedb';
import spacetimedb, { tables, viewRow, type Db, type Env, type Handler } from './schema';
import { errorMessage, loadAiConfig, trim, trimEndChar, type HttpClient } from './ai';
import { BotApology, MaxBotTextChars, forgetAll, runBotTurn, upsertFacts, type BotReply } from './bot';
import { CodeAlphabet } from './lib';
import {
  LastSendNote,
  OptInReply,
  OptOutReply,
  StartReply,
  dailyCapReached,
  dropReachOfOwner,
  dropReachOfSender,
  isOptedOut,
  isStartWord,
  isStopWord,
  killSwitchBlock,
  optIn,
  optOut,
  reserveSend,
  saveReach,
} from './photon-guards';
import { base64Decode, base64Encode, concat, fixedTimeEquals, fromUtf8, hmacSha256, sha256, toHex, utf8 } from './crypto';

const DefaultPhotonBaseUrl = 'https://api.photon.codes';
const WebhookToleranceSeconds = 5n * 60n;
export const MaxWebhookSeen = 2000;
const LinkCodeLength = 6;
const LinkCodeTtlMicros = 10n * 60_000_000n; // 10 min
const MaxFailedLinks = 5;
const FailedLinkWindowMicros = 10n * 60_000_000n; // 10 min
export const MaxAttachmentBytes = 8 * 1024 * 1024;
const MaxChannelReplyChars = 1200;
// Photon gives up after 20 s; keep the whole webhook well under that.
const WebhookBudgetMicros = 15_000_000n;
// Messaging AI budget per sender (replaces the web's 3 s cooldown here: people often send a text and
// a screenshot as two messages within a second).
const MaxChannelAiTurns = 8;
const ChannelAiWindowMicros = 60_000_000n; // rolling 60 s
export const ChannelBusyReply = "You're sending a lot at once — give me a minute.";
const NotAScreenshotReply = "I can read text messages and screenshots (PNG/JPEG). Send a screenshot of it and I'll take a look.";
const ChannelImageMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export const myLinkCode = spacetimedb.view({ name: 'my_link_code', public: true }, t.array(viewRow(tables.linkCode.rowType)), ctx => {
  const c = ctx.db.linkCode.owner.find(ctx.sender);
  return c ? [c] : [];
});

export const myChannelLinks = spacetimedb.view(
  { name: 'my_channel_links', public: true },
  t.array(viewRow(tables.channelLink.rowType)),
  ctx => [...ctx.db.channelLink.owner.filter(ctx.sender)]
);

// Make a fresh one-time code for the caller (shown via my_link_code). Texting "LINK <code>" to the bot
// links that messaging-app sender to the caller. The code mixes the reducer RNG with an HMAC keyed by the
// webhook secret, so it can't be predicted from the (deterministic) RNG seed alone.
export const createLinkCode = spacetimedb.reducer(ctx => {
  const now = ctx.timestamp.microsSinceUnixEpoch;
  for (const old of [...ctx.db.linkCode.iter()].filter(c => c.expiresAt.microsSinceUnixEpoch <= now))
    ctx.db.linkCode.owner.delete(old.owner);
  ctx.db.linkCode.owner.delete(ctx.sender);

  const secret = utf8(ctx.env.PHOTON_WEBHOOK_SECRET ?? '');
  let code: string;
  let tries = 0;
  do {
    if (++tries > 50) throw new SenderError('Could not make a code, try again');
    const noise = ctx.random.fill(new Uint8Array(32));
    const mix = hmacSha256(secret, utf8(`${ctx.sender.toHexString()}|${now}|${tries}|${toHex(noise).toUpperCase()}`));
    code = '';
    for (let i = 0; i < LinkCodeLength; i++) code += CodeAlphabet[mix[i] % CodeAlphabet.length];
  } while (ctx.db.linkCode.code.find(code));

  ctx.db.linkCode.insert({ owner: ctx.sender, code, expiresAt: new Timestamp(now + LinkCodeTtlMicros) });
});

// Remove all of the caller's messaging-app links (they can also text UNLINK).
export const unlinkChannels = spacetimedb.reducer(ctx => {
  for (const l of [...ctx.db.channelLink.owner.filter(ctx.sender)]) ctx.db.channelLink.senderKey.delete(l.senderKey);
  ctx.db.linkCode.owner.delete(ctx.sender);
  dropReachOfOwner(ctx.db, ctx.sender);
});

// The router (POST /photon, POST /discord) is declared in index.ts, after both handlers exist.

export const photonWebhook = spacetimedb.httpHandler((ctx, request) => {
  const secretText = ctx.env.PHOTON_WEBHOOK_SECRET;
  if (!secretText) return respond(503, 'webhook not configured');
  const secret = decodeWebhookSecret(secretText);
  if (!secret) {
    console.error('Photon: PHOTON_WEBHOOK_SECRET is not valid base64 (expected whsec_...)');
    return respond(503, 'webhook not configured');
  }

  const id = header(request, 'webhook-id');
  const ts = header(request, 'webhook-timestamp');
  const sigs = header(request, 'webhook-signature');
  const body = request.bytes();
  const nowSec = ctx.timestamp.microsSinceUnixEpoch / 1_000_000n;
  const tsSec = parseLong(ts);
  if (
    id.length === 0 ||
    id.length > 200 ||
    tsSec === null ||
    absBig(nowSec - tsSec) > WebhookToleranceSeconds ||
    !signatureMatches(secret, id, ts, body, sigs)
  ) {
    console.warn('Photon: rejected webhook (bad signature or timestamp)');
    return respond(401, 'invalid signature');
  }

  // From here on always 2xx: Photon must not retry something we already handled.
  const fresh = ctx.withTx(tx => markSeen(tx.db, id, tx.timestamp));
  if (!fresh) return respond(200, 'duplicate');

  let msg: InboundMessage;
  try {
    const parsed = parseInbound(body);
    if (!parsed) return respond(200, 'ignored');
    msg = parsed;
  } catch (e) {
    console.warn(`Photon: could not parse event ${id}: ${errorName(e)}`);
    return respond(200, 'ignored');
  }

  // The 200 body says what happened (only signed requests get this far); tools/photon-sim.mjs checks it.
  let outcome = 'nothing to send';
  try {
    const reply = guardedInbound(ctx, msg);
    if (reply.text.length > 0) outcome = deliver(ctx, msg, reply, id);
    else if (reply.why) outcome = `silent (${reply.why})`;
  } catch (e) {
    console.error(`Photon: handling ${id} failed: ${errorName(e)}: ${errorMessage(e)}`);
    try {
      outcome = deliver(ctx, msg, { text: BotApology }, id);
    } catch {
      /* ignore */
    }
  }
  return respond(200, `ok: ${outcome}`);
});

type Reply = { text: string; optOutNotice?: boolean; why?: string };

const senderKeyOf = (msg: InboundMessage) => `${msg.platform}:${msg.senderUserId}`;

// STOP/START, opt-out silence, the daily cap and the kill switch, around handleInbound.
function guardedInbound(ctx: Handler, msg: InboundMessage): Reply {
  const senderKey = senderKeyOf(msg);
  const command = msg.attachmentId.length === 0 ? msg.text : '';
  if (isStopWord(command))
    return ctx.withTx(tx =>
      optOut(tx.db, senderKey, tx.timestamp) ? { text: OptOutReply, optOutNotice: true } : { text: '', why: 'already opted out' }
    );
  if (isStartWord(command)) return { text: ctx.withTx(tx => (optIn(tx.db, senderKey) ? OptInReply : StartReply)) };

  const [out, capped] = ctx.withTx(tx => [isOptedOut(tx.db, senderKey), dailyCapReached(tx.db, senderKey, tx.timestamp)]);
  if (out) {
    // Opted out: never answer. FORGET ME still deletes their data, silently.
    if (/^FORGET ?ME[.!]*$/.test(command.trim().toUpperCase())) handleInbound(ctx, msg, false);
    console.log('Photon: sender opted out; not answering');
    return { text: '', why: 'opted out' };
  }
  if (capped) {
    console.log('Photon: sender reached the daily cap; not answering');
    return { text: '', why: 'daily cap reached' };
  }
  // Kill switch on: commands still work (LINK, UNLINK, FORGET ME), but no AI turn for a reply nobody gets.
  return { text: handleInbound(ctx, msg, killSwitchBlock(ctx.env, 'reply') === null) };
}

// The only way out to a phone: kill switch, opt-out and daily cap, then Photon's REST API.
function deliver(ctx: Handler, msg: InboundMessage, reply: Reply, idempotencyKey: string): string {
  const blocked = killSwitchBlock(ctx.env, 'reply');
  if (blocked) {
    console.log(`Photon: not sending (${blocked})`);
    return 'skipped (sending disabled)';
  }
  const senderKey = senderKeyOf(msg);
  const gate = ctx.withTx(tx => {
    if (!reply.optOutNotice && isOptedOut(tx.db, senderKey)) return 'opted out';
    const r = reserveSend(tx.db, senderKey, tx.timestamp, reply.optOutNotice === true);
    return !r.ok ? 'daily cap reached' : r.last ? 'last' : 'ok';
  });
  if (gate !== 'ok' && gate !== 'last') {
    console.log(`Photon: not sending (${gate})`);
    return `skipped (${gate})`;
  }
  const text = gate === 'last' ? trim(reply.text, MaxChannelReplyChars - LastSendNote.length) + LastSendNote : reply.text;
  const sent = sendChannelReply(ctx.http, ctx.env, msg, text, idempotencyKey);
  return (sent ? 'sent' : 'send failed') + (gate === 'last' ? ' (last today)' : '') + (reply.optOutNotice ? ' (opt-out confirmation)' : '');
}

// Record a webhook / interaction id; false when it was already handled. Keeps at most MaxWebhookSeen ids.
export function markSeen(db: Db, id: string, now: Timestamp): boolean {
  if (db.webhookSeen.id.find(id)) return false;
  db.webhookSeen.insert({ id, seenAt: now });
  if (Number(db.webhookSeen.count()) > MaxWebhookSeen) {
    const old = [...db.webhookSeen.iter()]
      .sort((a, b) => (a.seenAt.microsSinceUnixEpoch < b.seenAt.microsSinceUnixEpoch ? -1 : a.seenAt.microsSinceUnixEpoch > b.seenAt.microsSinceUnixEpoch ? 1 : 0))
      .slice(0, MaxWebhookSeen / 4);
    for (const w of old) db.webhookSeen.id.delete(w.id);
  }
  return true;
}

type InboundMessage = {
  projectId: string;
  messageId: string;
  platform: string;
  spaceId: string;
  senderUserId: string;
  senderHandle: string;
  agentUserId: string;
  text: string;
  attachmentId: string;
  hasVoice: boolean;
};

// Pull what we need out of a message.received event. null = nothing to answer (other events, our own
// outbound messages, group chats, read receipts / typing updates, ...).
function parseInbound(body: Uint8Array): InboundMessage | null {
  const root: unknown = JSON.parse(fromUtf8(body));
  if (str(root, 'type') !== 'message.received') return null;
  if (!has(root, 'data') || !has(prop(root, 'data'), 'object')) return null;
  const data = prop(root, 'data');
  const obj = prop(data, 'object');
  if (str(obj, 'status') !== 'received') return null;

  const platform = [...str(obj, 'platform').toLowerCase()]
    .filter(c => (c >= 'a' && c <= 'z') || c === '_')
    .slice(0, 20)
    .join('');
  const space = prop(obj, 'space');
  const sentBy = prop(obj, 'sentBy');
  const agent = has(obj, 'receivedBy') ? prop(obj, 'receivedBy') : prop(obj, 'addressedTo');
  const senderId = str(sentBy, 'id');
  const agentId = str(agent, 'id');
  if (platform.length === 0 || senderId.length === 0 || agentId.length === 0 || str(space, 'id').length === 0) return null;
  if (senderId === agentId || str(sentBy, 'kind') === 'agent') return null; // our own messages
  if (str(space, 'kind') === 'group') return null; // only 1:1 chats (shared lines can't answer groups anyway)

  let text = '';
  let attachmentId = '';
  let voice = false;
  const part = (c: unknown) => {
    switch (str(c, 'type')) {
      case 'text':
        text += (text.length > 0 ? '\n' : '') + str(c, 'text');
        break;
      case 'attachment':
        if (attachmentId.length === 0) attachmentId = str(c, 'attachmentId');
        break;
      case 'voice':
        voice = true;
        break;
    }
  };
  if (has(obj, 'content')) {
    const content = prop(obj, 'content');
    const parts = prop(content, 'parts');
    if (str(content, 'type') === 'group' && Array.isArray(parts)) for (const p of parts) part(p);
    else part(content);
  }
  if (text.length === 0 && attachmentId.length === 0 && !voice) return null;

  return {
    projectId: str(data, 'projectId'),
    messageId: str(obj, 'id'),
    platform,
    spaceId: str(space, 'id'),
    senderUserId: senderId,
    senderHandle: str(sentBy, 'handle'),
    agentUserId: agentId,
    text: text.trim(),
    attachmentId,
    hasVoice: voice,
  };
}

// Returns the text to send back ("" = nothing). aiAllowed=false: commands only (no AI turn).
function handleInbound(ctx: Handler, msg: InboundMessage, aiAllowed: boolean): string {
  const senderKey = senderKeyOf(msg);
  const pseudo = pseudoIdentity(msg.platform, msg.senderUserId);
  const text = msg.text.length > MaxBotTextChars ? msg.text.slice(0, MaxBotTextChars) : msg.text;
  const command = msg.attachmentId.length === 0 ? text.trim().toUpperCase() : '';

  // ---- Commands (no AI call) ----
  // "LINK ABC123" (also "link abc-123"); a longer text that merely starts with "link" is a normal message.
  const link = /^LINK[\s:]+([A-Z0-9][A-Z0-9 \-]{0,10})$/.exec(command);
  if (link)
    return ctx.withTx(tx => {
      const reply = linkSender(tx.db, tx.timestamp, senderKey, pseudo, msg.platform, maskHandle(msg.senderHandle), link[1]);
      // Linked: keep where a future proactive send (practice text) would go. No phone number.
      const linked = tx.db.channelLink.senderKey.find(senderKey);
      if (linked) saveReach(tx.db, senderKey, linked.owner, msg.platform, msg.spaceId, msg.agentUserId, tx.timestamp);
      return reply;
    });
  if (command === 'UNLINK')
    return ctx.withTx(tx => {
      if (!tx.db.channelLink.senderKey.find(senderKey)) return "This chat isn't linked to a Security Arcade account.";
      tx.db.channelLink.senderKey.delete(senderKey);
      dropReachOfSender(tx.db, senderKey);
      return "Unlinked. I'll keep chatting with you here, but separately from your Security Arcade account.";
    });
  if (command === 'FORGET ME' || command === 'FORGETME')
    return ctx.withTx(tx => {
      const owner = tx.db.channelLink.senderKey.find(senderKey)?.owner ?? pseudo;
      forgetAll(tx.db, owner);
      forgetAll(tx.db, pseudo);
      tx.db.channelLink.senderKey.delete(senderKey);
      dropReachOfSender(tx.db, senderKey);
      dropReachOfOwner(tx.db, owner);
      return 'Done. I deleted our conversation and everything I remembered about you.';
    });

  if (!aiAllowed) return '';
  if (msg.hasVoice && text.length === 0 && msg.attachmentId.length === 0)
    return "I can't listen to voice notes yet. Please type your question, paste the message, or send a screenshot.";
  const cfg = loadAiConfig(ctx.env);
  if (!cfg) return "Sorry, I'm not set up to answer right now. Please try again later.";

  // ---- Screenshot: download once, never store (skip the download when already over budget) ----
  let imageDataUrl = '';
  if (msg.attachmentId.length > 0) {
    const busy = ctx.withTx(tx => takeChannelBudget(tx.db, senderKey, tx.timestamp, false));
    if (busy !== null) return busy;
    const [dataUrl, problem] = fetchAttachmentDataUrl(ctx.http, ctx.env, msg);
    if (problem.length > 0) return problem;
    imageDataUrl = dataUrl;
  }
  const over = ctx.withTx(tx => takeChannelBudget(tx.db, senderKey, tx.timestamp, true));
  if (over !== null) return over;

  const owner = ctx.withTx(tx => tx.db.channelLink.senderKey.find(senderKey)?.owner ?? pseudo);
  // Time left for the model: the webhook must finish in ~15 s (Photon times out at 20 s), and the
  // reply still has to be sent. The fallback model only gets a turn when there's room.
  const elapsed = ctx.withTx(tx => tx.timestamp.microsSinceUnixEpoch) - ctx.timestamp.microsSinceUnixEpoch;
  const leftMs = Math.max(2_000, Number((WebhookBudgetMicros - elapsed) / 1000n) - 2_500);
  const firstMs = Math.min(leftMs, 9_000);
  const fallbackMs = leftMs - firstMs > 3_000 ? leftMs - firstMs : 0;

  const turn = runBotTurn(ctx, cfg, owner, msg.platform, text, imageDataUrl, firstMs, fallbackMs, false);
  if (!turn.stored) return 'One message at a time, please. Send that again in a few seconds.';
  if (!turn.ai.ok) return BotApology;
  return formatChannelReply(turn.reply);
}

// Per-sender rolling budget for messaging AI turns. null = go ahead (a turn is recorded when `consume`);
// otherwise the reply to send: ChannelBusyReply once per over-budget streak, then "" (stay quiet).
export function takeChannelBudget(db: Db, senderKey: string, now: Timestamp, consume: boolean): string | null {
  const t = now.microsSinceUnixEpoch;
  const row = db.channelAiUsage.senderKey.find(senderKey);
  const recent = (row?.recentMicros ?? []).filter(x => t - x < ChannelAiWindowMicros);
  const save = (u: { senderKey: string; recentMicros: bigint[]; notified: boolean }) => {
    if (!row) db.channelAiUsage.insert(u);
    else db.channelAiUsage.senderKey.update(u);
  };
  if (recent.length >= MaxChannelAiTurns) {
    const notified = row?.notified ?? false;
    save({ senderKey, recentMicros: recent, notified: true });
    return notified ? '' : ChannelBusyReply;
  }
  if (consume) {
    recent.push(t);
    save({ senderKey, recentMicros: recent, notified: false });
  }
  return null;
}

// Shared by Photon (LINK <code>) and Discord (/link). handleHint: what the web app shows for the link.
export function linkSender(
  db: Db,
  now: Timestamp,
  senderKey: string,
  pseudo: Identity,
  platform: string,
  handleHint: string,
  arg: string
): string {
  const discord = platform === 'discord';
  const code = [...arg].filter(c => /[\p{L}\p{Nd}]/u.test(c)).join('').toUpperCase();
  const a = db.linkAttempt.senderKey.find(senderKey);
  if (a) {
    if (now.microsSinceUnixEpoch - a.windowStart.microsSinceUnixEpoch > FailedLinkWindowMicros)
      db.linkAttempt.senderKey.delete(senderKey);
    else if (a.failures >= MaxFailedLinks)
      return 'Too many wrong codes. Wait 10 minutes, then make a new code in the app and try again.';
  }

  const found = code.length === LinkCodeLength ? db.linkCode.code.find(code) : null;
  if (!found || found.expiresAt.microsSinceUnixEpoch <= now.microsSinceUnixEpoch) {
    const f = db.linkAttempt.senderKey.find(senderKey);
    if (f) db.linkAttempt.senderKey.update({ ...f, failures: f.failures + 1 });
    else db.linkAttempt.insert({ senderKey, failures: 1, windowStart: now });
    return (
      "That code didn't work. Codes are 6 characters and expire after 10 minutes. " +
      `In the Security Arcade app, open Help Bot → ⋯ → ${discord ? 'Link Discord' : 'Link iMessage'} for a new one.`
    );
  }

  const player = found.owner;
  db.linkCode.owner.delete(player);
  db.linkAttempt.senderKey.delete(senderKey);
  db.channelLink.senderKey.delete(senderKey);
  db.channelLink.insert({ senderKey, owner: player, platform, handleHint, createdAt: now });
  // Bring along what this sender said before linking (it's the same person: they had the code).
  for (const m of [...db.chatMessage.owner.filter(pseudo)]) db.chatMessage.id.update({ ...m, owner: player });
  const facts = [...db.memoryFact.owner.filter(pseudo)];
  for (const f of facts) db.memoryFact.id.delete(f.id);
  upsertFacts(
    db,
    player,
    facts.map(f => f.fact),
    now
  );
  return (
    'Linked! Your chats here now share your Security Arcade history and game progress, and show up in the app. ' +
    (discord ? 'Run /unlink to undo.' : 'Text UNLINK to undo.')
  );
}

// Plain text for messaging apps (no cards): verdict line, reply, up to 3 red flags, one next step.
function formatChannelReply(r: BotReply): string {
  let sb = '';
  const verdict =
    r.verdict === 'scam' ? '🚩 SCAM' : r.verdict === 'suspicious' ? '⚠️ Suspicious' : r.verdict === 'likely_safe' ? '✅ Looks safe' : '';
  if (verdict.length > 0) sb += verdict + '\n';
  sb += trim(r.reply, 700);
  if (verdict.length > 0) {
    for (const f of r.redFlags.slice(0, 3)) sb += '\n• ' + trim(f, 120);
    if (r.nextSteps.length > 0) sb += '\nNext: ' + trim(r.nextSteps[0], 160);
  }
  return trim(sb, MaxChannelReplyChars);
}

// ---------- Photon REST ----------

function photonBaseUrl(env: Env): string {
  return trimEndChar(env.PHOTON_BASE_URL || DefaultPhotonBaseUrl, '/');
}

function photonProject(env: Env, msg: InboundMessage): string {
  return env.PHOTON_PROJECT_ID || msg.projectId;
}

// Call only through deliver() (guards). true = Photon accepted it.
function sendChannelReply(http: HttpClient, env: Env, msg: InboundMessage, text: string, idempotencyKey: string): boolean {
  const key = env.PHOTON_API_KEY;
  const project = photonProject(env, msg);
  if (!key || project.length === 0) {
    console.warn("Photon: PHOTON_API_KEY or project id missing; can't send the reply");
    return false;
  }
  const payload = JSON.stringify({
    spaceId: msg.spaceId,
    senderId: msg.agentUserId, // our line: the inbound message's receivedBy
    content: { type: 'text', format: 'plain', text },
  });
  try {
    const response = http.fetch(`${photonBaseUrl(env)}/v1/projects/${encodeURIComponent(project)}/messages`, {
      method: 'POST',
      timeout: TimeDuration.fromMillis(4_000),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, 'idempotency-key': idempotencyKey },
      body: utf8(payload),
    });
    if (response.status >= 200 && response.status < 300) return true;
    console.warn(`Photon: send failed HTTP ${response.status}: ${trim(response.text(), 300)}`);
  } catch (e) {
    console.warn(`Photon: send failed: ${errorMessage(e)}`);
  }
  return false;
}

// One attempt (Photon itself waits up to ~10 s for the bytes). Returns [dataUrl, ""] or ["", reply to send].
function fetchAttachmentDataUrl(http: HttpClient, env: Env, msg: InboundMessage): [string, string] {
  const key = env.PHOTON_API_KEY;
  const project = photonProject(env, msg);
  if (!key || project.length === 0) return ['', "Sorry, I can't open pictures right now. Please paste the text instead."];
  let response;
  try {
    response = http.fetch(
      `${photonBaseUrl(env)}/v1/projects/${encodeURIComponent(project)}/attachments/${encodeURIComponent(msg.attachmentId)}/content`,
      { method: 'GET', timeout: TimeDuration.fromMillis(6_000), headers: { authorization: `Bearer ${key}` } }
    );
  } catch {
    return ['', 'Got your screenshot; send it again in a few seconds.'];
  }
  if (response.status === 409) return ['', 'Got your screenshot; send it again in a few seconds.'];
  if (response.status !== 200) {
    console.warn(`Photon: attachment download HTTP ${response.status}`);
    return ['', "Sorry, I couldn't open that picture. Try sending it again, or paste the text."];
  }
  // Video, audio, PDF, ...: say what we can read instead of calling the model.
  const declared = normalizeMime(headerOf(response.headers, 'content-type'));
  if (declared.length > 0 && !ChannelImageMimes.has(declared)) return ['', NotAScreenshotReply];
  const bytes: Uint8Array = response.bytes();
  if (bytes.length === 0) return ['', NotAScreenshotReply];
  if (bytes.length > MaxAttachmentBytes) return ['', 'That picture is too big for me. Try a screenshot instead (under 8 MB).'];
  // Prefer what the bytes say; with no usable Content-Type, the bytes must be a known image.
  const sniffed = sniffImageMime(bytes);
  const mime = sniffed.length > 0 ? sniffed : declared;
  if (mime.length === 0) return ['', NotAScreenshotReply];
  return [`data:${mime};base64,${base64Encode(bytes)}`, ''];
}

// Magic bytes of the image types we accept (ChannelImageMimes); "" for anything else.
export function sniffImageMime(b: Uint8Array): string {
  const at = (off: number, ascii: string) =>
    b.length >= off + ascii.length && [...ascii].every((c, i) => b[off + i] === c.charCodeAt(0));
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b[0] === 0x89 && at(1, 'PNG')) return 'image/png';
  if (at(0, 'RIFF') && at(8, 'WEBP')) return 'image/webp';
  if (at(4, 'ftyp') && (at(8, 'heic') || at(8, 'heix') || at(8, 'heim') || at(8, 'heis'))) return 'image/heic';
  if (at(4, 'ftyp') && (at(8, 'mif1') || at(8, 'msf1') || at(8, 'heif'))) return 'image/heif';
  return '';
}

// "Image/JPEG; charset=..." -> "image/jpeg"; generic binary types count as missing ("").
export function normalizeMime(contentType: string): string {
  const m = contentType.split(';')[0].trim().toLowerCase();
  if (m === 'image/jpg') return 'image/jpeg';
  return m === 'application/octet-stream' || m === 'binary/octet-stream' ? '' : m;
}

// ---------- Helpers ----------

// A stable identity for an unlinked sender, derived from platform + Photon user id. The first two bytes
// are a fixed 0xB07C tag (real SpacetimeDB identities start with 0xC200), so it can't collide with a
// player; the rest is SHA-256 of a versioned, domain-separated string.
export function pseudoIdentity(platform: string, senderUserId: string): Identity {
  const bytes = sha256(utf8(`help-bot/channel-sender/v1\n${platform}\n${senderUserId}`));
  bytes[0] = 0xb0;
  bytes[1] = 0x7c;
  return new Identity(BigInt('0x' + toHex(bytes)));
}

function maskHandle(raw: string): string {
  const handle = raw.trim();
  if (handle.includes('@')) return handle.length > 0 ? `${handle[0]}•••@${handle.split('@').pop()}` : '';
  const digits = [...handle].filter(c => /\p{Nd}/u.test(c)).join('');
  return digits.length >= 4 ? `•••${digits.slice(-4)}` : '';
}

function decodeWebhookSecret(secret: string): Uint8Array | null {
  let s = secret.trim();
  if (s.startsWith('whsec_')) s = s.slice(6);
  try {
    const key = base64Decode(s);
    return key.length > 0 ? key : null;
  } catch {
    return null;
  }
}

function signatureMatches(secret: Uint8Array, id: string, ts: string, body: Uint8Array, signatures: string): boolean {
  const expected = hmacSha256(secret, concat(utf8(`${id}.${ts}.`), body));
  for (const sig of signatures.split(' ').filter(s => s.length > 0)) {
    if (!sig.startsWith('v1,')) continue;
    let given: Uint8Array;
    try {
      given = base64Decode(sig.slice(3));
    } catch {
      continue;
    }
    if (fixedTimeEquals(given, expected)) return true;
  }
  return false;
}

export function header(request: Request, name: string): string {
  return headerOf(request.headers, name);
}

export function headerOf(headers: Headers, name: string): string {
  return (headers.get(name) ?? '').trim();
}

// ---- JSON access like System.Text.Json's TryGetProperty / GetString (never throws) ----

export function isObject(el: unknown): el is Record<string, unknown> {
  return typeof el === 'object' && el !== null && !Array.isArray(el);
}
export function has(el: unknown, name: string): boolean {
  return isObject(el) && Object.prototype.hasOwnProperty.call(el, name);
}
export function prop(el: unknown, name: string): unknown {
  return has(el, name) ? (el as Record<string, unknown>)[name] : undefined;
}
/** The string property `name` of an object, else "". */
export function str(el: unknown, name: string): string {
  const v = prop(el, name);
  return typeof v === 'string' ? v : '';
}

export function respond(status: number, text: string): SyncResponse {
  return new SyncResponse(text, { status, headers: { 'content-type': 'text/plain' } });
}

/** long.TryParse: optional sign and digits, within the signed 64-bit range; else null. */
export function parseLong(s: string): bigint | null {
  if (!/^[+-]?\d{1,19}$/.test(s)) return null;
  const v = BigInt(s);
  return v >= -(2n ** 63n) && v < 2n ** 63n ? v : null;
}

export function absBig(v: bigint): bigint {
  return v < 0n ? -v : v;
}

export function errorName(e: unknown): string {
  return e instanceof Error ? e.name : typeof e;
}
