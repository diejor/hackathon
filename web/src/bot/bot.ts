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
import type { ActivityEvent, ChatMessage, MemoryFact } from "../module_bindings/types";

export type { ActivityEvent, ChatMessage, MemoryFact };

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

/** Whether a user message came with a screenshot (the server's HadImage flag). */
export const hasScreenshot = (m: ChatMessage) => m.role.tag === "User" && m.hadImage;

/**
 * Send a message and/or screenshot. Resolves true if the server accepted it (the message is in the
 * chat, even if the bot then failed and posted an error reply), false if it was rejected before
 * that (empty, too big, cooldown, offline); then `state.error` says why and the caller can keep the draft.
 */
export async function send(text: string, image?: Blob): Promise<boolean> {
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
    const imageDataUrl = image ? await toJpegDataUrl(image) : "";
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

/** Delete all of the player's messages, remembered facts and game activity (server-side). */
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

/** Downscale to ≤ 1024 px on the long side and re-encode as JPEG (also strips EXIF/metadata). */
export async function toJpegDataUrl(blob: Blob): Promise<string> {
  if (!blob.type.startsWith("image/")) throw new Error("That file isn't an image.");
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(blob); } catch { throw new Error("Couldn't read that image."); }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#fff"; // JPEG has no alpha
  g.fillRect(0, 0, w, h);
  g.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const url = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  canvas.width = canvas.height = 0;
  if (url.length > MAX_IMAGE_CHARS) throw new Error("That screenshot is too large, even after shrinking it.");
  return url;
}
