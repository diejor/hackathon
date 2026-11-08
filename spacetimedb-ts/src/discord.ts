// Help Bot on Discord through HTTP interactions (no gateway, no long-running process).
//
//   Discord --POST /discord (Ed25519-signed interaction)--> this module --> {"type":5} (deferred, ephemeral)
//   scheduled procedure discordRunJob --PATCH {DISCORD_API_BASE}/webhooks/{app}/{token}/messages/@original--> Discord
//
// Served at /v1/database/<db>/route/discord (the app's Interactions Endpoint URL). Configure DISCORD_PUBLIC_KEY.
// Commands (registered by scripts/discord-register.sh): /check [message] [screenshot], the message context-menu
// command "Check with Help Bot", /link code, /unlink. The bot token is only used by that script, never here.
//
// Security model:
//  - Every request must carry a valid Ed25519 signature (X-Signature-Ed25519 over X-Signature-Timestamp + body,
//    app public key) and a timestamp within 5 minutes; else 401. No public key: 503.
//  - Each interaction id is handled once (webhook_seen, shared with photon.ts).
//  - Senders get a pseudo identity per Discord user id until they /link with a one-time code from the web app
//    (same channel_link / link_code / link_attempt tables and wrong-code limit as iMessage).
//  - AI turns use the messaging budget (channel_ai_usage, 8 per rolling minute per Discord user).
//  - Screenshots are downloaded in the scheduled procedure, sent to the model and never stored. Only JPEG/PNG/WebP.
//  - All replies are ephemeral (only the person who ran the command sees them), mention no one, and contain no
//    clickable links: URLs in the reply are wrapped in inline code.
//  - discord_job rows (they hold the 15-minute interaction token) are private and deleted when the job runs.
import { t, SenderError, SyncResponse } from 'spacetimedb/server';
import { ScheduleAt, TimeDuration } from 'spacetimedb';
import spacetimedb, { discordJob, type DiscordJob, type Env, type Handler } from './schema';
import { errorMessage, loadAiConfig, trim, trimEndChar, type HttpClient } from './ai';
import { BotApology, MaxBotTextChars, runBotTurn, type BotReply } from './bot';
import { base64Encode, concat, ed25519Verify, fromHex, fromUtf8, utf8 } from './crypto';
import { dropVoiceOfSender } from './voice';
import {
  ChannelBusyReply,
  MaxAttachmentBytes,
  absBig,
  errorName,
  has,
  header,
  isObject,
  linkSender,
  markSeen,
  normalizeMime,
  parseLong,
  prop,
  pseudoIdentity,
  respond,
  sniffImageMime,
  str,
  takeChannelBudget,
} from './photon';

const DefaultDiscordApiBase = 'https://discord.com/api/v10';
const DiscordToleranceSeconds = 5n * 60n;
const EphemeralFlag = 64;
const DiscordCheckCommand = 'check';
const DiscordContextCommand = 'Check with Help Bot';
const DiscordNotAScreenshot =
  'I can read text and screenshots (PNG, JPEG or WebP). Attach a screenshot of the message, or paste its text in `/check message:`.';
const DiscordImageMimes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const discordInteractions = spacetimedb.httpHandler((ctx, request) => {
  const keyHex = ctx.env.DISCORD_PUBLIC_KEY;
  if (!keyHex) return respond(503, 'discord not configured');
  const publicKey = fromHex(keyHex);
  if (!publicKey || publicKey.length !== 32) {
    console.error('Discord: DISCORD_PUBLIC_KEY is not 64 hex characters');
    return respond(503, 'discord not configured');
  }

  const ts = header(request, 'x-signature-timestamp');
  const sig = fromHex(header(request, 'x-signature-ed25519'));
  const body = request.bytes();
  const nowSec = ctx.timestamp.microsSinceUnixEpoch / 1_000_000n;
  const tsSec = parseLong(ts);
  if (
    !sig ||
    sig.length !== 64 ||
    tsSec === null ||
    absBig(nowSec - tsSec) > DiscordToleranceSeconds ||
    !ed25519Verify(publicKey, concat(utf8(ts), body), sig)
  )
    return respond(401, 'invalid request signature');

  try {
    return handleInteraction(ctx, JSON.parse(fromUtf8(body)));
  } catch (e) {
    console.warn(`Discord: could not handle interaction: ${errorName(e)}: ${errorMessage(e)}`);
    return discordReply('Sorry, something went wrong. Please try again.');
  }
});

function handleInteraction(ctx: Handler, root: unknown): SyncResponse {
  const tv = prop(root, 'type');
  if (tv !== undefined && typeof tv === 'number' && !Number.isInteger(tv)) throw new Error('type is not an integer');
  const type = typeof tv === 'number' ? tv : 0;
  if (type === 1) return json('{"type":1}'); // PING
  if (type !== 2) return discordReply("That isn't something I can do yet. Try /check.");

  const interactionId = str(root, 'id');
  const token = str(root, 'token');
  const appId = str(root, 'application_id');
  const configuredApp = ctx.env.DISCORD_APPLICATION_ID;
  if (configuredApp && appId !== configuredApp) return respond(400, 'wrong application');
  const member = prop(root, 'member');
  const user = has(root, 'member') && has(member, 'user') ? prop(member, 'user') : prop(root, 'user');
  const userId = str(user, 'id');
  if (interactionId.length === 0 || token.length === 0 || appId.length === 0 || userId.length === 0 || !/^[0-9]+$/.test(userId))
    return respond(400, 'bad interaction');

  const seenKey = `discord:${interactionId}`;
  const fresh = ctx.withTx(tx => markSeen(tx.db, seenKey, tx.timestamp));
  if (!fresh) return respond(409, 'duplicate interaction');

  if (!has(root, 'data')) throw new Error('interaction has no data');
  const data = prop(root, 'data');
  const name = str(data, 'name');
  const senderKey = `discord:${userId}`;
  const pseudo = pseudoIdentity('discord', userId);

  // ---- Commands without AI: immediate ephemeral reply ----
  if (name === 'link') {
    const code = option(data, 'code');
    const handle = str(user, 'username');
    const hint = handle.length > 0 ? '@' + trim(handle, 32) : '';
    return discordReply(ctx.withTx(tx => linkSender(tx.db, tx.timestamp, senderKey, pseudo, 'discord', hint, code)));
  }
  if (name === 'unlink')
    return discordReply(
      ctx.withTx(tx => {
        if (!tx.db.channelLink.senderKey.find(senderKey)) return "Your Discord isn't linked to SafeSense on the web.";
        tx.db.channelLink.senderKey.delete(senderKey);
        dropVoiceOfSender(tx.db, senderKey);
        return "Unlinked. I'll keep checking messages for you here, but separately from your SafeSense progress on the web.";
      })
    );

  // ---- Checks: validate, then defer and let the scheduled procedure do the work ----
  let text: string;
  let url = '';
  if (name === DiscordCheckCommand) {
    text = option(data, 'message').trim();
    const attachmentId = option(data, 'screenshot');
    if (attachmentId.length > 0) {
      const att = resolved(data, 'attachments', attachmentId);
      if (att === null) return discordReply("I couldn't find that attachment. Try again.");
      const problem = attachmentProblem(att);
      if (problem !== null) return discordReply(problem);
      url = str(att, 'url');
    }
  } else if (name === DiscordContextCommand) {
    const target = resolved(data, 'messages', str(data, 'target_id'));
    if (target === null) return discordReply("I couldn't read that message. Try again.");
    text = str(target, 'content').trim();
    // The first image attachment; other files are ignored when there's text to check.
    const list = prop(target, 'attachments');
    if (Array.isArray(list)) {
      const image = list.find(a => attachmentProblem(a) === null);
      if (isObject(image)) url = str(image, 'url');
      else if (list.length > 0 && text.length === 0) return discordReply(attachmentProblem(list[0])!);
    }
  } else return discordReply("I don't know that command. Try /check.");

  if (text.length > MaxBotTextChars) text = text.slice(0, MaxBotTextChars);
  if (text.length === 0 && url.length === 0)
    return discordReply(
      name === DiscordContextCommand
        ? 'That message has no text or screenshot I can check.'
        : 'Add the message to check: `/check message:` (paste the text or link) or `/check screenshot:` (attach a screenshot).'
    );
  if (url.length > 0 && !url.startsWith('https://')) return discordReply("I couldn't open that attachment. Try again.");
  if (!loadAiConfig(ctx.env)) return discordReply("Sorry, I'm not set up to answer right now. Please try again later.");

  const checkText = text;
  const busy = ctx.withTx(tx => {
    if (takeChannelBudget(tx.db, senderKey, tx.timestamp, true) !== null) return true;
    tx.db.discordJob.insert({
      scheduledId: 0n,
      scheduledAt: ScheduleAt.time(tx.timestamp.microsSinceUnixEpoch),
      applicationId: appId,
      interactionToken: token,
      userId,
      text: checkText,
      attachmentUrl: url,
    });
    return false;
  });
  if (busy) return discordReply(ChannelBusyReply);
  return json(`{"type":5,"data":{"flags":${EphemeralFlag}}}`); // deferred, ephemeral
}

// Scheduled only (discord_job): download the screenshot, run the bot, edit the deferred reply.
export const discordRunJob = spacetimedb.procedure(
  { onSchedule: discordJob },
  { job: discordJob.rowType },
  t.unit(),
  (ctx, { job }) => {
    if (!ctx.withTx(tx => tx.senderAuth.isInternal)) throw new SenderError('Not allowed');
    try {
      const cfg = loadAiConfig(ctx.env);
      if (!cfg) {
        editDiscordReply(ctx.http, ctx.env, job, plainMessage("Sorry, I'm not set up to answer right now."));
        return {};
      }
      let imageDataUrl = '';
      if (job.attachmentUrl.length > 0) {
        const [dataUrl, problem] = fetchDiscordImage(ctx.http, job.attachmentUrl);
        if (problem.length > 0) {
          editDiscordReply(ctx.http, ctx.env, job, plainMessage(problem));
          return {};
        }
        imageDataUrl = dataUrl;
      }
      const senderKey = `discord:${job.userId}`;
      const pseudo = pseudoIdentity('discord', job.userId);
      const owner = ctx.withTx(tx => tx.db.channelLink.senderKey.find(senderKey)?.owner ?? pseudo);
      const turn = runBotTurn(ctx, cfg, owner, 'discord', job.text, imageDataUrl, null, null, false);
      const payload = turn.stored && turn.ai.ok ? verdictEmbed(turn.reply) : plainMessage(BotApology);
      editDiscordReply(ctx.http, ctx.env, job, payload);
    } catch (e) {
      console.error(`Discord: job ${job.scheduledId} failed: ${errorName(e)}: ${errorMessage(e)}`);
      try {
        editDiscordReply(ctx.http, ctx.env, job, plainMessage(BotApology));
      } catch {
        /* ignore */
      }
    }
    return {};
  }
);

// ---------- Interaction helpers ----------

// A string option of a slash command ("" when missing). Attachment options carry the attachment id.
function option(data: unknown, name: string): string {
  const opts = prop(data, 'options');
  if (!Array.isArray(opts)) return '';
  for (const o of opts)
    if (str(o, 'name') === name && has(o, 'value')) {
      const v = prop(o, 'value');
      // JsonElement.ToString() for non-strings: raw JSON text ("True"/"False" for booleans, "" for null).
      return typeof v === 'string' ? v : v === true ? 'True' : v === false ? 'False' : v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
  return '';
}

function resolved(data: unknown, kind: string, id: string): unknown | null {
  if (id.length === 0) return null;
  const map = prop(prop(data, 'resolved'), kind);
  return isObject(map) && has(map, id) ? map[id] : null;
}

// null = an image we can check; otherwise the reply to send. Uses Discord's metadata (type, size);
// the bytes are checked again after the download.
function attachmentProblem(att: unknown): string | null {
  let mime = normalizeMime(str(att, 'content_type'));
  if (mime.length === 0) {
    const ext = extension(str(att, 'filename')).toLowerCase();
    mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : '';
  }
  if (!DiscordImageMimes.has(mime)) return DiscordNotAScreenshot;
  const size = prop(att, 'size');
  if (typeof size === 'number' && size > MaxAttachmentBytes) return 'That picture is too big for me. Try a screenshot under 8 MB.';
  return null;
}

/** Path.GetExtension: ".png" for "a/b.png", "" without a dot in the last segment. */
function extension(path: string): string {
  const dot = path.lastIndexOf('.');
  const sep = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return dot > sep && dot < path.length - 1 ? path.slice(dot) : '';
}

function fetchDiscordImage(http: HttpClient, url: string): [string, string] {
  let response;
  try {
    response = http.fetch(url, { method: 'GET', timeout: TimeDuration.fromMillis(8_000) });
  } catch {
    return ['', "Sorry, I couldn't open that picture. Try again, or paste the text."];
  }
  if (response.status !== 200) {
    console.warn(`Discord: attachment download HTTP ${response.status}`);
    return ['', "Sorry, I couldn't open that picture. Try again, or paste the text."];
  }
  const bytes: Uint8Array = response.bytes();
  if (bytes.length > MaxAttachmentBytes) return ['', 'That picture is too big for me. Try a screenshot under 8 MB.'];
  const mime = sniffImageMime(bytes);
  if (!DiscordImageMimes.has(mime)) return ['', DiscordNotAScreenshot];
  return [`data:${mime};base64,${base64Encode(bytes)}`, ''];
}

function discordApiBase(env: Env): string {
  return trimEndChar(env.DISCORD_API_BASE || DefaultDiscordApiBase, '/');
}

// Edit the deferred (ephemeral) reply. No bot token: the interaction token authorizes this for 15 min.
function editDiscordReply(http: HttpClient, env: Env, job: DiscordJob, payload: string) {
  try {
    const response = http.fetch(
      `${discordApiBase(env)}/webhooks/${encodeURIComponent(job.applicationId)}/${encodeURIComponent(job.interactionToken)}/messages/@original`,
      {
        method: 'PATCH',
        timeout: TimeDuration.fromMillis(6_000),
        headers: { 'content-type': 'application/json' },
        body: payload,
      }
    );
    if (response.status < 200 || response.status >= 300)
      console.warn(`Discord: editing the reply failed HTTP ${response.status}: ${trim(response.text(), 300)}`);
  } catch (e) {
    console.warn(`Discord: editing the reply failed: ${errorMessage(e)}`);
  }
}

// ---------- Reply formatting ----------

// One embed: colour + title by verdict, the reply, "Red flags" and "What to do". Within Discord's limits
// (title 256, description 4096, field value 1024, total 6000).
function verdictEmbed(r: BotReply): string {
  const [color, title] =
    r.verdict === 'scam'
      ? [0xe53935, '🚩 Scam']
      : r.verdict === 'suspicious'
        ? [0xffa000, '⚠️ Suspicious']
        : r.verdict === 'likely_safe'
          ? [0x43a047, '✅ Looks safe']
          : [0x99aab5, ''];
  const field = (name: string, items: string[]) =>
    items.length === 0
      ? []
      : [
          {
            name,
            value: trim(
              items
                .slice(0, 6)
                .map(i => '• ' + trim(noLinks(i), 160))
                .join('\n'),
              1000
            ),
            inline: false,
          },
        ];
  const embed: Record<string, unknown> = {};
  if (title.length > 0) embed.title = title;
  embed.description = trim(noLinks(r.reply), 3500);
  embed.color = color;
  embed.fields = r.verdict.length > 0 ? [...field('Red flags', r.redFlags), ...field('What to do', r.nextSteps)] : [];
  embed.footer = { text: 'Help Bot · only you can see this' };
  return discordPayload(false, { content: '', embeds: [embed] });
}

function plainMessage(text: string): string {
  return discordPayload(false, { content: trim(text, 1900), embeds: [] });
}

// Common message fields: never mention anyone; ephemeral for immediate replies (an edited deferred reply
// stays ephemeral, and edits can't set that flag).
function discordPayload(ephemeral: boolean, fields: Record<string, unknown>): string {
  const o: Record<string, unknown> = { ...fields };
  if (ephemeral) o.flags = EphemeralFlag;
  o.allowed_mentions = { parse: [] };
  return JSON.stringify(o);
}

function discordReply(text: string): SyncResponse {
  return json('{"type":4,"data":' + discordPayload(true, { content: trim(text, 1900) }) + '}');
}

const UrlLike = /(?:https?:\/\/|www\.)[^\s<>`]+|\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}\b(?:\/[^\s<>`]*)?/gi;

// Model output -> no clickable links: URLs and bare domains go in inline code, backticks in the text become
// quotes (so nothing can close the code span), and masked-link syntax "[text](url)" is broken up.
export function noLinks(text: string): string {
  const s = text.replaceAll('`', "'").replaceAll('](', '] (');
  return s.replace(UrlLike, m => {
    let v = m;
    let tail = '';
    while (v.length > 0 && '.,;:!?)]\'"'.includes(v[v.length - 1])) {
      tail = v[v.length - 1] + tail;
      v = v.slice(0, -1);
    }
    return v.length === 0 ? m : `\`${v}\`${tail}`;
  });
}

function json(text: string): SyncResponse {
  return new SyncResponse(text, { status: 200, headers: { 'content-type': 'application/json' } });
}
