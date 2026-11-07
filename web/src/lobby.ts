// Lobby store: owns the SpacetimeDB connection, reads the per-user views (my_room, my_room_members),
// holds local UI state, and exposes actions. The UI re-renders on every `changed` notification.
import { Identity } from "spacetimedb";
import { DbConnection } from "./module_bindings";
import type { Room, RoomMember } from "./module_bindings/types";

export type Screen = "connecting" | "home" | "join" | "room" | "playing";

export const CODE_LENGTH = 4;
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // must match the server
export const MIN_PLAYERS = 2;

export const GAMES = [
  { id: "firewall", title: "Firewall", blurb: "Co-op · block the bad packets together" },
  { id: "patch-race", title: "Patch Race", blurb: "1v1 · patch vulns before they're exploited" },
  { id: "split-key", title: "Split Key", blurb: "Co-op · each of you holds half the secret" },
] as const;

const params = new URLSearchParams(location.search);
export const config = {
  server: params.get("server") || "wss://maincloud.spacetimedb.com",
  db: params.get("db") || "hackathon-1aa18263",
};

const TOKEN_KEY = `stdb.token.${config.db}`;
const NAME_KEY = "lobby.name";

export const state = {
  connected: false,
  connectError: null as string | null,
  identity: null as Identity | null,
  myName: "",
  typedCode: "",
  error: null as string | null,
  busy: null as "create" | "join" | null,
  joinScreen: false,
};

let conn: DbConnection | null = null;
let pendingAutoJoin: string | null = null;
let errorTimer: number | undefined;
const listeners = new Set<() => void>();

export function onChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function bump() {
  for (const fn of listeners) fn();
}

// ---------- Derived state ----------

export function myRoom(): Room | undefined {
  if (!conn || !state.connected) return undefined;
  for (const r of conn.db.myRoom.iter()) return r;
  return undefined;
}

export function members(): RoomMember[] {
  if (!conn || !state.connected) return [];
  return [...conn.db.myRoomMembers.iter()].sort((a, b) => a.seat - b.seat);
}

export const isMe = (id: Identity) => !!state.identity && id.isEqual(state.identity);
export const isHost = () => { const r = myRoom(); return !!r && isMe(r.host); };
export const me = () => members().find((m) => isMe(m.identity));

export function screen(): Screen {
  if (!state.connected) return "connecting";
  const r = myRoom();
  if (r) return r.state.tag === "Playing" ? "playing" : "room";
  return state.joinScreen ? "join" : "home";
}

export function canStart(): boolean {
  const r = myRoom();
  const ms = members();
  return isHost() && !!r && r.game !== "" && ms.length >= MIN_PLAYERS && ms.every((m) => m.ready);
}

export const gameById = (id: string) => GAMES.find((g) => g.id === id);

// Link encoded in the room QR: opens this app straight into the room.
export function joinLink(code: string): string {
  const base = params.get("joinUrl") || location.origin + location.pathname;
  const url = new URL(base);
  url.searchParams.set("room", code);
  if (params.get("server")) url.searchParams.set("server", config.server);
  if (params.get("db")) url.searchParams.set("db", config.db);
  return url.toString();
}

// ---------- Connection ----------

export function connect() {
  state.myName = clip(params.get("name") || localStorage.getItem(NAME_KEY) || "") || randomName();
  localStorage.setItem(NAME_KEY, state.myName);
  const room = params.get("room");
  if (room) pendingAutoJoin = room.trim().toUpperCase();

  conn = DbConnection.builder()
    .withUri(config.server)
    .withDatabaseName(config.db)
    .withToken(localStorage.getItem(TOKEN_KEY) || undefined)
    .withAutomaticReconnect()
    .onConnect((c, identity, token) => {
      localStorage.setItem(TOKEN_KEY, token);
      state.identity = identity;
      console.log(`[STDB] connected as ${identity.toHexString()}`);
      c.db.myRoom.onInsert(bump);
      c.db.myRoom.onDelete(bump);
      c.db.myRoomMembers.onInsert(bump);
      c.db.myRoomMembers.onDelete(bump);
      c.subscriptionBuilder()
        .onApplied(() => {
          console.log("[STDB] lobby subscription applied");
          state.connected = true;
          state.connectError = null;
          bump();
          runAutoJoin();
        })
        .subscribe(["SELECT * FROM my_room", "SELECT * FROM my_room_members"]);
    })
    .onAutomaticReconnect((_c, identity, token) => {
      localStorage.setItem(TOKEN_KEY, token);
      state.identity = identity;
      state.connected = true;
      state.connectError = null;
      console.log("[STDB] reconnected");
      bump();
    })
    .onDisconnect((_ctx, error) => {
      state.connected = false;
      state.connectError = error ? String(error) : null;
      state.busy = null;
      console.warn("[STDB] disconnected", error);
      bump();
    })
    .onConnectError((_ctx, error) => {
      state.connectError = String(error);
      console.error("[STDB] connect error", error);
      bump();
    })
    .build();
  console.log(`[STDB] connecting to ${config.server} / ${config.db}`);
}

function runAutoJoin() {
  const code = pendingAutoJoin;
  pendingAutoJoin = null;
  if (!code || myRoom()?.code === code) return;
  state.joinScreen = true;
  state.typedCode = code.slice(0, CODE_LENGTH);
  void submitCode();
}

// ---------- Actions ----------

export async function createRoom() {
  if (!conn || state.busy) return;
  state.busy = "create";
  bump();
  try {
    await conn.reducers.createRoom({ name: state.myName });
  } catch (e) {
    showError(e);
  } finally {
    state.busy = null;
    bump();
  }
}

export function openJoin() { state.joinScreen = true; state.typedCode = ""; bump(); }
export function backHome() { state.joinScreen = false; state.typedCode = ""; bump(); }

export function typeChar(c: string) {
  c = c.toUpperCase();
  if (screen() !== "join" || state.busy || state.typedCode.length >= CODE_LENGTH || !CODE_ALPHABET.includes(c)) return;
  state.typedCode += c;
  bump();
  if (state.typedCode.length === CODE_LENGTH) void submitCode();
}

export function backspace() {
  if (screen() !== "join" || state.busy || !state.typedCode) return;
  state.typedCode = state.typedCode.slice(0, -1);
  bump();
}

export async function submitCode() {
  if (!conn || state.busy || state.typedCode.length !== CODE_LENGTH) return;
  state.busy = "join";
  bump();
  try {
    await conn.reducers.joinRoom({ code: state.typedCode, name: state.myName });
    // A wrong code doesn't fail the reducer (so the server can count the attempt): check the result.
    if (!myRoom()) showError("No room with that code. Check it and try again.");
  } catch (e) {
    showError(e);
  } finally {
    state.busy = null;
    state.typedCode = "";
    bump();
  }
}

const call = (fn: (c: DbConnection) => Promise<void>) => { if (conn) fn(conn).catch(showError); };

export const toggleReady = () => { const m = me(); if (m) call((c) => c.reducers.setReady({ ready: !m.ready })); };
export const chooseGame = (game: string) => { if (isHost()) call((c) => c.reducers.chooseGame({ game })); };
export const startGame = () => { if (canStart()) call((c) => c.reducers.startGame({})); };
export const returnToLobby = () => { if (isHost()) call((c) => c.reducers.returnToLobby({})); };
export function leaveRoom() {
  call((c) => c.reducers.leaveRoom({}));
  state.joinScreen = false;
  state.typedCode = "";
  bump();
}

export function rerollName() { setName(randomName()); }

export function setName(name: string) {
  name = clip(name);
  if (!name || name === state.myName) return;
  state.myName = name;
  localStorage.setItem(NAME_KEY, name);
  if (myRoom()) call((c) => c.reducers.setName({ name }));
  bump();
}

export function showError(e: unknown) {
  state.error = e instanceof Error ? e.message : String(e);
  clearTimeout(errorTimer);
  errorTimer = window.setTimeout(() => { state.error = null; bump(); }, 4000);
  bump();
}

// ---------- Helpers ----------

function clip(s: string) {
  s = s.trim();
  return s.length > 20 ? s.slice(0, 20) : s;
}

const ADJ = ["Swift", "Sneaky", "Secure", "Stealthy", "Clever", "Encrypted", "Brave", "Hidden", "Quantum", "Rapid", "Silent", "Lucky", "Turbo", "Mighty", "Patched", "Magenta"];
const NOUN = ["Firewall", "Packet", "Cipher", "Router", "Token", "Otter", "Falcon", "Byte", "Proxy", "Kernel", "Badger", "Signal", "Tower", "Hash", "Key", "Panda"];

function randomName(): string {
  const pick = (a: string[]) => a[crypto.getRandomValues(new Uint32Array(1))[0] % a.length];
  let n: string;
  do n = `${pick(ADJ)} ${pick(NOUN)}`;
  while (n === state.myName);
  return n;
}
