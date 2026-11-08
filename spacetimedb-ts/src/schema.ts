// All tables, shared types and the module environment, in one place (TypeScript needs the tables
// before `schema()`, and the reducers in the other files need the schema value). Grouped by the
// C# file they came from; the column order matches the C# structs exactly (clients depend on it).
import { schema, table, t, type InferSchema, type ReducerCtx, type TransactionCtx, type HandlerContext, type Infer } from 'spacetimedb/server';

// ---------- Lib.cs: lobby ----------

export const RoomState = t.enum('RoomState', { Lobby: t.unit(), Playing: t.unit() });

const room = table(
  { name: 'room' },
  {
    id: t.u64().primaryKey().autoInc(),
    code: t.string().unique(),
    host: t.identity(),
    state: RoomState,
    game: t.string(), // selected game id ("" = none yet)
    createdAt: t.timestamp(),
  }
);

const roomMember = table(
  { name: 'room_member' },
  {
    identity: t.identity().primaryKey(), // a player is in at most one room
    roomId: t.u64().index('btree'),
    name: t.string(),
    ready: t.bool(),
    seat: t.u8(), // 0..MaxMembers-1: stable slot/color in the UI
    joinedAt: t.timestamp(),
    online: t.bool(), // false during the reconnect grace period
  }
);

// Scheduled by ClientDisconnected; runs cleanupDisconnected (lib.ts).
export const disconnectCleanup = table(
  { name: 'disconnect_cleanup' },
  {
    scheduledId: t.u64().primaryKey().autoInc(),
    scheduledAt: t.scheduleAt(),
    identity: t.identity(),
  }
);

const joinAttempt = table(
  { name: 'join_attempt' },
  {
    identity: t.identity().primaryKey(),
    failures: t.u32(),
    windowStart: t.timestamp(),
  }
);

// ---------- Activity.cs ----------

const activityEvent = table(
  { name: 'activity_event' },
  {
    id: t.u64().primaryKey().autoInc(),
    owner: t.identity().index('btree'),
    game: t.string(), // slug, e.g. "friend-or-fraud"
    kind: t.string(), // slug, e.g. "answer_correct" | "answer_wrong" | "round_done"
    details: t.string(), // short JSON text, e.g. {"item":"usps-sms","tactic":"urgency","chose":"friend"}
    createdAt: t.timestamp(), // order by this, never by id
  }
);

// ---------- Ai.cs ----------

// Per-identity rate limit for AI calls. Private.
const aiUsage = table(
  { name: 'ai_usage' },
  {
    identity: t.identity().primaryKey(),
    lastCall: t.timestamp(),
    calls: t.u32(),
  }
);

export const AiResult = t.object('AiResult', {
  ok: t.bool(),
  text: t.string(), // model reply, or error message
  model: t.string(),
  latencyMs: t.u32(),
});

// ---------- Bot.cs ----------

export const ChatRole = t.enum('ChatRole', { User: t.unit(), Bot: t.unit() });

const chatMessage = table(
  { name: 'chat_message' },
  {
    id: t.u64().primaryKey().autoInc(),
    owner: t.identity().index('btree'),
    role: ChatRole,
    text: t.string(),
    verdict: t.string(), // "scam" | "suspicious" | "likely_safe" | "" (not a check)
    redFlags: t.array(t.string()),
    nextSteps: t.array(t.string()),
    imageNote: t.string(), // user msg with a screenshot: the model's transcription ("" otherwise)
    isError: t.bool(), // bot msg reporting a failure
    channel: t.string(), // "web", or the messaging platform ("imessage", "whatsapp", "discord", ...)
    createdAt: t.timestamp(), // order by this, never by id
    hadImage: t.bool().default(false), // user msg sent with a screenshot (keep last: added by migration)
  }
);

const memoryFact = table(
  { name: 'memory_fact' },
  {
    id: t.u64().primaryKey().autoInc(),
    owner: t.identity().index('btree'),
    fact: t.string(),
    source: t.string(), // "chat"
    createdAt: t.timestamp(),
  }
);

// ---------- Discord.cs ----------

// One pending check. Scheduled "now" by the interaction handler; the row is deleted after discordRunJob.
export const discordJob = table(
  { name: 'discord_job' },
  {
    scheduledId: t.u64().primaryKey().autoInc(),
    scheduledAt: t.scheduleAt(),
    applicationId: t.string(),
    interactionToken: t.string(), // valid 15 min; lets us edit our own deferred reply
    userId: t.string(), // Discord user id (snowflake)
    text: t.string(),
    attachmentUrl: t.string(), // "" = none
  }
);

// ---------- Photon.cs ----------

// A messaging-app sender linked to a player. senderKey = "<platform>:<Photon user id>".
const channelLink = table(
  { name: 'channel_link' },
  {
    senderKey: t.string().primaryKey(),
    owner: t.identity().index('btree'),
    platform: t.string(), // "imessage", "whatsapp", ...
    handleHint: t.string(), // masked sender handle for display, e.g. "•••0123"
    createdAt: t.timestamp(),
  }
);

// One pending one-time link code per player (createLinkCode replaces it).
const linkCode = table(
  { name: 'link_code' },
  {
    owner: t.identity().primaryKey(),
    code: t.string().unique(),
    expiresAt: t.timestamp(),
  }
);

// Wrong LINK codes per sender (anti brute-force), like the lobby's join_attempt.
const linkAttempt = table(
  { name: 'link_attempt' },
  {
    senderKey: t.string().primaryKey(),
    failures: t.u32(),
    windowStart: t.timestamp(),
  }
);

// AI turns per messaging sender in the last ChannelAiWindowMicros (private). notified: the "sending a
// lot" reply went out for the current over-budget streak, so further messages are dropped silently.
const channelAiUsage = table(
  { name: 'channel_ai_usage' },
  {
    senderKey: t.string().primaryKey(),
    recentMicros: t.array(t.i64()),
    notified: t.bool(),
  }
);

// Webhook ids already handled (Photon retries; webhook-id stays the same). Capped at MaxWebhookSeen.
const webhookSeen = table(
  { name: 'webhook_seen' },
  {
    id: t.string().primaryKey(),
    seenAt: t.timestamp(),
  }
);

// ---------- Photon guards (photon-guards.ts) ----------
// New tables only (no changes to the ones above), so an existing database republishes without a wipe.

// Senders who texted STOP (or another stop word). Nothing is sent to them until they text START. Private.
const channelOptout = table(
  { name: 'channel_optout' },
  {
    senderKey: t.string().primaryKey(), // "<platform>:<Photon user id>", like channel_link
    optedOutAt: t.timestamp(),
  }
);

// Outbound messages per sender per UTC day (hard cap MaxDailySends). Private.
const channelSendDaily = table(
  { name: 'channel_send_daily' },
  {
    senderKey: t.string().primaryKey(),
    day: t.i64(), // days since the Unix epoch (UTC)
    sent: t.u32(),
  }
);

// What a future proactive send (practice texts) needs, saved when a sender LINKs: Photon's chat (space)
// id and our line's user id from that inbound event. No phone numbers. Private; only used while the
// matching channel_link still exists with the same owner.
const channelReach = table(
  { name: 'channel_reach' },
  {
    senderKey: t.string().primaryKey(),
    owner: t.identity().index('btree'),
    platform: t.string(),
    spaceId: t.string(),
    agentUserId: t.string(),
    savedAt: t.timestamp(),
  }
);

// ---------- Practice texts (practice.ts) ----------
// New tables only, like the guards above: an existing database republishes without a wipe.

// One practice scam text per row (limits: 1 a day, 3 in total per person). Private; each player sees
// their own rows through my_practice_texts. status: "queued" (job not run yet) -> "pending" (sent, waiting
// for their reply) -> "caught" | "fooled" | "expired" (no graded reply within 2 h); "failed" = not sent
// (doesn't count toward the limits).
const practiceSend = table(
  { name: 'practice_send' },
  {
    id: t.u64().primaryKey().autoInc(),
    owner: t.identity().index('btree'),
    senderKey: t.string().index('btree'), // the linked phone, "<platform>:<Photon user id>" (no phone number)
    templateId: t.string(),
    tactic: t.string(),
    createdAt: t.timestamp(),
    status: t.string(),
  }
);

// Sends one queued practice text ~60-120 s after the request (practiceRunJob in photon.ts). Private;
// deleted when it runs, or by UNLINK / FORGET ME.
export const practiceJob = table(
  { name: 'practice_job' },
  {
    scheduledId: t.u64().primaryKey().autoInc(),
    scheduledAt: t.scheduleAt(),
    practiceId: t.u64().index('btree'),
    owner: t.identity().index('btree'),
    text: t.string(), // rendered from a template in practice.ts (never by the AI)
  }
);

// ---------- Practice calls (voice.ts) ----------
// New table only, like the guards above: an existing database republishes without a wipe.

// Which player a phone number belongs to, for the voice agent (docs/VOICE.md). Saved when a phone LINKs over
// iMessage; deleted by UNLINK / FORGET ME. No phone numbers: phoneHash = hex SHA-256 of a salted, normalized
// E.164 number (voice.ts phoneHash). Private.
const voiceLink = table(
  { name: 'voice_link' },
  {
    phoneHash: t.string().primaryKey(),
    owner: t.identity().index('btree'),
    senderKey: t.string().index('btree'), // the channel_link it came from, "<platform>:<Photon user id>"
    linkedAt: t.timestamp(),
  }
);

// ---------- Schema + environment ----------

// Secrets live in the database environment (supplied at publish time from the gitignored .env,
// never in source or clients). Same names as the C# EnvironmentSchema.
const spacetimedb = schema(
  {
    room,
    roomMember,
    disconnectCleanup,
    joinAttempt,
    activityEvent,
    aiUsage,
    chatMessage,
    memoryFact,
    discordJob,
    channelLink,
    linkCode,
    linkAttempt,
    channelAiUsage,
    webhookSeen,
    channelOptout,
    channelSendDaily,
    channelReach,
    practiceSend,
    practiceJob,
    voiceLink,
  },
  {
    env: {
      AI_API_KEY: t.option(t.string()),
      AI_BASE_URL: t.option(t.string()), // default: Gemini's OpenAI-compatible endpoint
      AI_MODEL: t.option(t.string()), // chat model id (run ai_ping to list what your key can use)
      AI_VISION_MODEL: t.option(t.string()), // model for screenshots; defaults to AI_MODEL
      AI_FALLBACK_MODEL: t.option(t.string()), // used once if the main model is overloaded (5xx/429)
      // Messaging channels via Photon (photon.ts); all optional, the webhook answers 503 without a secret.
      PHOTON_API_KEY: t.option(t.string()), // pho_sk_... (sends replies, downloads screenshots)
      PHOTON_PROJECT_ID: t.option(t.string()), // defaults to the projectId in each webhook event
      PHOTON_WEBHOOK_SECRET: t.option(t.string()), // whsec_... signing secret of the webhook destination
      PHOTON_BASE_URL: t.option(t.string()), // default https://api.photon.codes
      // Outbound kill switch (photon-guards.ts): unset = replies to an inbound text only; "true" = replies and
      // proactive sends; anything else = send nothing (webhooks are still verified and acknowledged).
      PHOTON_SENDING_ENABLED: t.option(t.string()),
      // Discord HTTP interactions (discord.ts); optional, the endpoint answers 503 without a public key.
      // The bot token is NOT declared here on purpose: only scripts/discord-register.sh uses it.
      DISCORD_PUBLIC_KEY: t.option(t.string()), // app public key (hex), verifies X-Signature-Ed25519
      DISCORD_APPLICATION_ID: t.option(t.string()), // optional: reject interactions for other apps
      DISCORD_API_BASE: t.option(t.string()), // default https://discord.com/api/v10
      // Practice calls (voice.ts); optional, the /voice routes answer 503 when both are unset.
      RETELL_API_KEY: t.option(t.string()), // Retell key with the webhook badge: verifies X-Retell-Signature
      VOICE_WEBHOOK_SECRET: t.option(t.string()), // shared secret in the x-safesense-voice-secret header
    },
  }
);
export default spacetimedb;

type S = InferSchema<typeof spacetimedb>;
export type Ctx = ReducerCtx<S>;
export type Tx = TransactionCtx<S>;
export type Handler = HandlerContext<S>;
export type Db = Ctx['db'];
export type Env = Ctx['env'];

export type Room = Infer<typeof room.rowType>;
export type RoomMember = Infer<typeof roomMember.rowType>;
export type ActivityEvent = Infer<typeof activityEvent.rowType>;
export type ChatMessage = Infer<typeof chatMessage.rowType>;
export type MemoryFact = Infer<typeof memoryFact.rowType>;
export type DiscordJob = Infer<typeof discordJob.rowType>;
export type PracticeSend = Infer<typeof practiceSend.rowType>;
export type AiResultT = Infer<typeof AiResult>;

// Views return table rows WITHOUT a primary key, like the C# module (a table's rowType would carry its
// primaryKey() into the view). A view primary key changes client callbacks: row changes would arrive as
// onUpdate instead of onDelete + onInsert, which web/src/lobby.ts and web/src/bot/bot.ts rely on. The copy
// keeps the table's algebraic type object, so the view still returns the table's named row type.
export function viewRow<T extends { row: Record<string, any> }>(rowType: T): T {
  const copy = Object.assign(Object.create(Object.getPrototypeOf(rowType)), rowType);
  copy.row = Object.fromEntries(
    Object.entries(rowType.row).map(([k, col]) => [
      k,
      Object.assign(Object.create(Object.getPrototypeOf(col)), col, {
        columnMetadata: { ...col.columnMetadata, isPrimaryKey: false },
      }),
    ])
  );
  return copy;
}

export const tables = { room, roomMember, activityEvent, chatMessage, memoryFact, channelLink, linkCode, practiceSend };
