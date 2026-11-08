// Help Bot store (plain TS, no framework). Uses the lobby's SpacetimeDB connection, so the bot talks
// to the same identity as the player. Data comes from the per-user views my_messages / my_facts /
// my_activity (subscribed in lobby.ts); sending goes through the bot_send procedure. Games log
// results with conn.reducers.logActivity({ game, kind, details }) (see README "Help Bot").
//
//   import * as Bot from "./bot/bot";
//   Bot.onChange(render); Bot.messages(); await Bot.send("Is this a scam? ...", screenshotBlob);
//
// Screenshots are downscaled in the browser and only kept in memory while sending; the server
// doesn't store them either (only the model's transcription, `imageNote`).
import * as L from "../lobby";
import type { DbConnection } from "../module_bindings";
import type { ActivityEvent, ChannelLink, ChatMessage, LinkCode, MemoryFact, PracticeSend } from "../module_bindings/types";
import { CHANNEL_LABELS } from "./config";

export type { ActivityEvent, ChannelLink, ChatMessage, LinkCode, MemoryFact, PracticeSend };

export const MAX_IMAGE_CHARS = 2_800_000; // must match the server (Bot.cs)
const MAX_SIDE = 1024;
const JPEG_QUALITY = 0.8;

export const state = {
  /** A botSend call is in flight (the bot is "thinking"). */
  sending: false,
  /** Last send/forget error that didn't produce a chat message (validation, cooldown, network). */
  error: null as string | null,
};

const listeners = new Set<() => void>();
let queued = false;
let insertedWhileSending = false;

/** Subscribe to any change (messages, facts, sending, error, connection). Returns an unsubscribe. */
export function onChange(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function bump() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => { queued = false; for (const fn of listeners) fn(); });
}

L.onChange(bump);
L.onConnection((c: DbConnection) => {
  c.db.myMessages.onInsert((_ctx, m) => {
    if (m.role.tag === "User" && state.sending) insertedWhileSending = true;
    bump();
  });
  c.db.myMessages.onDelete(bump);
  c.db.myFacts.onInsert(bump);
  c.db.myFacts.onDelete(bump);
  c.db.myActivity.onInsert(bump);
  c.db.myActivity.onDelete(bump);
  c.db.myLinkCode.onInsert(bump);
  c.db.myLinkCode.onDelete(bump);
  c.db.myChannelLinks.onInsert(bump);
  c.db.myChannelLinks.onDelete(bump);
  c.db.myPracticeTexts.onInsert(bump);
  c.db.myPracticeTexts.onDelete(bump);
  // Its own subscription, so a server without practice texts yet can't break the lobby's.
  c.subscriptionBuilder()
    .onError(() => console.warn("[STDB] practice texts aren't available on this server"))
    .subscribe(["SELECT * FROM my_practice_texts"]);
});

/** Connected and the subscription is applied. */
export const ready = () => L.state.connected && !!L.getConn();

const byTime = (a: { createdAt: { microsSinceUnixEpoch: bigint }; id: bigint }, b: typeof a) => {
  const d = a.createdAt.microsSinceUnixEpoch - b.createdAt.microsSinceUnixEpoch;
  return d < 0n ? -1 : d > 0n ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

/** The player's messages, oldest first (sorted by createdAt, never by id). */
export function messages(): ChatMessage[] {
  const c = L.getConn();
  if (!c || !ready()) return [];
  return [...c.db.myMessages.iter()].sort(byTime);
}

/** What the bot remembers about the player, oldest first. */
export function facts(): MemoryFact[] {
  const c = L.getConn();
  if (!c || !ready()) return [];
  return [...c.db.myFacts.iter()].sort(byTime);
}

/** The player's Security Arcade game events (what the bot coaches from), oldest first. */
export function activity(): ActivityEvent[] {
  const c = L.getConn();
  if (!c || !ready()) return [];
  return [...c.db.myActivity.iter()].sort(byTime);
}

/** Demo only: replace the player's demo game history with ~15 seeded events (seed_demo_activity). */
export async function seedDemo(): Promise<boolean> {
  const c = L.getConn();
  if (!c || !ready()) return fail("Not connected yet. Try again in a moment.");
  try {
    await c.reducers.seedDemoActivity({});
    state.error = null;
    bump();
    return true;
  } catch (e) {
    return fail(e);
  }
}

/** Messaging app a message came through ("iMessage", ...), or null for the web chat. */
export const channelLabel = (m: ChatMessage): string | null =>
  !m.channel || m.channel === "web" ? null : CHANNEL_LABELS[m.channel] ?? m.channel;

/** The player's pending one-time link code (texting "LINK <code>" links that phone), if still valid. */
export function linkCode(): LinkCode | null {
  const c = L.getConn();
  if (!c || !ready()) return null;
  const now = BigInt(Date.now()) * 1000n;
  return [...c.db.myLinkCode.iter()].find((l) => l.expiresAt.microsSinceUnixEpoch > now) ?? null;
}

/** Messaging-app senders linked to this player. */
export function channelLinks(): ChannelLink[] {
  const c = L.getConn();
  if (!c || !ready()) return [];
  return [...c.db.myChannelLinks.iter()];
}

/** Make a fresh 6-character link code, valid 10 minutes (shows up in linkCode()). */
export async function createLinkCode(): Promise<boolean> {
  const c = L.getConn();
  if (!c || !ready()) return fail("Not connected yet. Try again in a moment.");
  try {
    await c.reducers.createLinkCode({});
    state.error = null;
    bump();
    return true;
  } catch (e) {
    return fail(e);
  }
}

/** Remove all messaging-app links (the phone can also text UNLINK). */
export async function unlinkChannels(): Promise<boolean> {
  const c = L.getConn();
  if (!c || !ready()) return fail("Not connected yet. Try again in a moment.");
  try {
    await c.reducers.unlinkChannels({});
    bump();
    return true;
  } catch (e) {
    return fail(e);
  }
}

/** The player's practice texts (request_practice_text), oldest first. */
export function practiceTexts(): PracticeSend[] {
  const c = L.getConn();
  if (!c || !ready()) return [];
  return [...c.db.myPracticeTexts.iter()].sort(byTime);
}

/**
 * Ask SafeSense to text the linked phone one practice scam (1 a day, 3 in total). Resolves null when it's
 * queued, else the server's reason (not linked, limits, switched off, ...). Leaves `state.error` alone.
 */
export async function requestPracticeText(): Promise<string | null> {
  const c = L.getConn();
  if (!c || !ready()) return "Not connected yet. Try again in a moment.";
  try {
    await c.reducers.requestPracticeText({});
    bump();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Whether a user message came with a screenshot (the server's HadImage flag). */
export const hasScreenshot = (m: ChatMessage) => m.role.tag === "User" && m.hadImage;

/**
 * Send a message and/or screenshot. Resolves true if the server accepted it (the message is in the
 * chat, even if the bot then failed and posted an error reply), false if it was rejected before
 * that (empty, too big, cooldown, offline); then `state.error` says why and the caller can keep the draft.
 * `image` is a screenshot Blob or a JPEG data URL from `toJpegDataUrl`.
 */
export async function send(text: string, image?: Blob | string): Promise<boolean> {
  const c = L.getConn();
  text = text.trim();
  if (state.sending) return false;
  if (!c || !ready()) return fail("Not connected yet. Try again in a moment.");
  if (!text && !image) return fail("Type a message or attach a screenshot.");
  state.sending = true;
  state.error = null;
  insertedWhileSending = false;
  bump();
  try {
    // A string is a data URL already made by toJpegDataUrl (the chat prepares it when the file is picked).
    const imageDataUrl = typeof image === "string" ? image : image ? await toJpegDataUrl(image) : "";
    const res = await c.procedures.botSend({ text, imageDataUrl });
    if (res.ok) return true;
    // Always surface the server's reason (cooldown, quota, validation...). If the message was already
    // stored (the AI call failed afterwards), it stays in the chat, so the draft isn't given back.
    fail(res.text || "The bot couldn't take that message.");
    return insertedWhileSending;
  } catch (e) {
    return insertedWhileSending ? true : fail(e);
  } finally {
    state.sending = false;
    bump();
  }
}

/** Delete all of the player's messages, remembered facts, game activity and messaging-app links (server-side). */
export async function forgetMe(): Promise<boolean> {
  const c = L.getConn();
  if (!c || !ready()) return fail("Not connected yet. Try again in a moment.");
  try {
    await c.reducers.forgetMe({});
    state.error = null;
    bump();
    return true;
  } catch (e) {
    return fail(e);
  }
}

/** Show a short message in the composer's error line (e.g. a voice-input problem). */
export function showError(message: string) { fail(message); }

export function clearError() { if (state.error) { state.error = null; bump(); } }

function fail(e: unknown): false {
  state.error = e instanceof Error ? e.message : String(e);
  bump();
  return false;
}

/** Image kinds recognised from the file's first bytes (phones sometimes give an empty or odd `type`). */
type Sniffed = "png" | "jpeg" | "webp" | "gif" | "heic" | "avif" | "unknown";
const SNIFF_MIME: Record<Sniffed, string> = {
  png: "image/png", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", heic: "image/heic", avif: "image/avif", unknown: "",
};
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs"]);

function sniff(b: Uint8Array): Sniffed {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b.length >= 8 && b[0] === 0x89 && ascii(1, 4) === "PNG") return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (b.length >= 6 && ascii(0, 4) === "GIF8") return "gif";
  if (b.length >= 12 && ascii(4, 8) === "ftyp") { // ISO-BMFF: major brand, then compatible brands
    const size = Math.min(b.length, Math.max(16, (b[0] << 24 | b[1] << 16 | b[2] << 8 | b[3]) >>> 0), 64);
    const brands = [ascii(8, 12)];
    for (let i = 16; i + 4 <= size; i += 4) brands.push(ascii(i, i + 4));
    if (brands.some((x) => x === "avif" || x === "avis")) return "avif";
    if (brands.some((x) => HEIC_BRANDS.has(x)) || brands[0] === "mif1" || brands[0] === "msf1") return "heic";
  }
  return "unknown";
}

const HEIC_MSG = "This photo is in HEIC format, which this browser can't open. Take a screenshot of it instead (screenshots are PNG).";
const UNREADABLE_MSG = "Couldn't read that file from your phone. If it's in Google Photos, download it first or take a screenshot.";

/** Decode with fallbacks: createImageBitmap, a downscaling createImageBitmap, then an <img> element. */
async function decode(blob: Blob, errors: string[]): Promise<{ src: CanvasImageSource; w: number; h: number; done(): void }> {
  const why = (step: string, e: unknown) => errors.push(`${step}: ${e instanceof Error ? `${e.name} ${e.message}` : String(e)}`);
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(blob);
      return { src: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close() };
    } catch (e) { why("createImageBitmap", e); }
    try { // a big photo may fail at full size (memory); let the decoder shrink it (height keeps the aspect ratio)
      const bmp = await createImageBitmap(blob, { resizeWidth: MAX_SIDE, resizeQuality: "high" });
      return { src: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close() };
    } catch (e) { why("createImageBitmap(resize)", e); }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new Error("zero size");
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    why("img.decode", e);
    throw new Error("decode failed");
  }
}

/**
 * Turn a picked/pasted file into the JPEG data URL that `send` uploads: read its bytes right away
 * (phone pickers can hand out files that stop being readable later), decode with fallbacks, downscale
 * to ≤ 1024 px on the long side and re-encode as JPEG (also strips EXIF/metadata). Throws an Error
 * whose message is meant for the user.
 */
export async function toJpegDataUrl(blob: Blob): Promise<string> {
  const info = { name: (blob as File).name, type: blob.type || "(empty)", size: blob.size } as Record<string, unknown>;
  let bytes: ArrayBuffer;
  try {
    bytes = await blob.arrayBuffer();
  } catch (e) {
    console.warn("[bot] image", { ...info, error: e instanceof Error ? `${e.name} ${e.message}` : String(e) });
    throw new Error(UNREADABLE_MSG);
  }
  if (!bytes.byteLength) {
    console.warn("[bot] image", { ...info, error: "0 bytes" });
    throw new Error(UNREADABLE_MSG);
  }
  const kind = sniff(new Uint8Array(bytes, 0, Math.min(64, bytes.byteLength)));
  const declaredHeic = /hei[cf]/i.test(blob.type) || /\.hei[cf]$/i.test(String(info.name ?? ""));
  const mime = SNIFF_MIME[kind] || (blob.type.startsWith("image/") ? blob.type : "");
  const mem = new Blob([bytes], mime ? { type: mime } : {}); // in memory: no longer tied to the picker's file
  const errors: string[] = [];
  let url = "";
  try {
    const d = await decode(mem, errors);
    try {
      const scale = Math.min(1, MAX_SIDE / Math.max(d.w, d.h));
      const w = Math.max(1, Math.round(d.w * scale)), h = Math.max(1, Math.round(d.h * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext("2d");
      if (!g) throw new Error("no 2d context");
      g.fillStyle = "#fff"; // JPEG has no alpha
      g.fillRect(0, 0, w, h);
      g.drawImage(d.src, 0, 0, w, h);
      url = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      canvas.width = canvas.height = 0;
      if (!url.startsWith("data:image/jpeg;base64,")) throw new Error(`encode gave ${url.slice(0, 30)}`);
    } finally { d.done(); }
  } catch (e) {
    if (e instanceof Error && e.message !== "decode failed") errors.push(`encode: ${e.message}`);
    console.warn("[bot] image", { ...info, sniffed: kind, errors });
    if (kind === "heic" || (declaredHeic && kind === "unknown")) throw new Error(HEIC_MSG);
    const t = blob.type || (mime ? `${mime} (guessed)` : "unknown");
    const n = bytes.byteLength, size = n < 100_000 ? `${Math.max(1, Math.round(n / 1000))} KB` : `${(n / 1e6).toFixed(1)} MB`;
    throw new Error(`Couldn't open that image (type ${t}, ${size}). Try a screenshot.`);
  }
  if (url.length > MAX_IMAGE_CHARS) throw new Error("That screenshot is too large, even after shrinking it.");
  return url;
}
