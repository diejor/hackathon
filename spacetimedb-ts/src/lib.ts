// Lobby: create a room (get a short code / QR), others join by code, everyone readies up,
// the host picks a game and starts. Games plug in later with their own tables keyed by roomId.
//
// Privacy model (this is a security hackathon, so it matters):
//  - room / room_member / join_attempt tables are PRIVATE. Clients can't list rooms or codes.
//  - Clients only see their own room and its members through per-user views (my_room, my_room_members).
//  - Joining needs the code; failed join attempts are rate-limited per identity (anti brute-force).
//  - All authorization uses ctx.sender; no identity is ever taken from arguments.
import { t, SenderError } from 'spacetimedb/server';
import { ScheduleAt, Timestamp, type Identity } from 'spacetimedb';
import spacetimedb, { disconnectCleanup, tables, viewRow, type Ctx, type Room, type RoomMember } from './schema';
import { isControl } from './ai';

const MaxMembers = 8;
const MinPlayersToStart = 2;
const CodeLength = 4;
// No 0/O, 1/I/L: easy to read off a phone screen and type on a keypad.
export const CodeAlphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MaxFailedJoins = 8;
const FailedJoinWindowMicros = 60_000_000n; // 60 s

// Phones drop the socket when the user switches apps (e.g. to the camera to scan a QR) or locks
// the screen. Instead of kicking immediately, a disconnect schedules this cleanup; reconnecting
// within the grace period keeps the seat.
const ReconnectGraceMicros = 30_000_000n; // 30 s

// ---------- Views: the only lobby data clients can see ----------

export const myRoom = spacetimedb.view({ name: 'my_room', public: true }, t.array(viewRow(tables.room.rowType)), ctx => {
  const me = ctx.db.roomMember.identity.find(ctx.sender);
  const room = me ? ctx.db.room.id.find(me.roomId) : null;
  return room ? [room] : [];
});

export const myRoomMembers = spacetimedb.view(
  { name: 'my_room_members', public: true },
  t.array(viewRow(tables.roomMember.rowType)),
  ctx => {
    const me = ctx.db.roomMember.identity.find(ctx.sender);
    if (!me) return [];
    return [...ctx.db.roomMember.roomId.filter(me.roomId)];
  }
);

// ---------- Reducers ----------

export const createRoom = spacetimedb.reducer({ name: t.string() }, (ctx, args) => {
  const name = cleanName(args.name);
  leaveCurrentRoom(ctx);

  let code: string;
  let tries = 0;
  do {
    if (++tries > 50) throw new SenderError('Could not allocate a room code, try again');
    code = randomCode(ctx);
  } while (ctx.db.room.code.find(code));

  const room = ctx.db.room.insert({
    id: 0n,
    code,
    host: ctx.sender,
    state: { tag: 'Lobby' },
    game: '',
    createdAt: ctx.timestamp,
  });
  addMember(ctx, room.id, name, 0);
  console.info(`Room ${code} created`);
});

// A wrong code does NOT throw: throwing would roll back the failed-attempt counter.
// The client sees it is still not in a room and shows "wrong code".
export const joinRoom = spacetimedb.reducer({ code: t.string(), name: t.string() }, (ctx, args) => {
  const name = cleanName(args.name);
  const code = (args.code ?? '').trim().toUpperCase();
  checkJoinRateLimit(ctx);

  const room = ctx.db.room.code.find(code);
  if (!room) {
    recordFailedJoin(ctx);
    return;
  }

  // Re-joining your own room (e.g. after a refresh) just updates your name.
  const existing = ctx.db.roomMember.identity.find(ctx.sender);
  if (existing && existing.roomId === room.id) {
    ctx.db.roomMember.identity.update({ ...existing, name });
    return;
  }

  if (room.state.tag !== 'Lobby') throw new SenderError('That game already started');
  const members = [...ctx.db.roomMember.roomId.filter(room.id)];
  if (members.length >= MaxMembers) throw new SenderError('Room is full');

  leaveCurrentRoom(ctx);
  addMember(ctx, room.id, name, freeSeat(members));
  ctx.db.joinAttempt.identity.delete(ctx.sender);
});

export const leaveRoom = spacetimedb.reducer(ctx => leaveCurrentRoom(ctx));

export const setName = spacetimedb.reducer({ name: t.string() }, (ctx, { name }) => {
  const me = requireMember(ctx);
  ctx.db.roomMember.identity.update({ ...me, name: cleanName(name) });
});

export const setReady = spacetimedb.reducer({ ready: t.bool() }, (ctx, { ready }) => {
  const me = requireMember(ctx);
  ctx.db.roomMember.identity.update({ ...me, ready });
});

export const chooseGame = spacetimedb.reducer({ game: t.string() }, (ctx, args) => {
  const room = requireHostedLobby(ctx);
  const game = (args.game ?? '').trim();
  if (game.length > 32) throw new SenderError('Invalid game id');
  ctx.db.room.id.update({ ...room, game });
});

export const startGame = spacetimedb.reducer(ctx => {
  const room = requireHostedLobby(ctx);
  const members = [...ctx.db.roomMember.roomId.filter(room.id)];
  if (members.length < MinPlayersToStart) throw new SenderError(`Need at least ${MinPlayersToStart} players`);
  if (members.some(m => !m.ready)) throw new SenderError('Everyone must be ready');
  if (room.game === '') throw new SenderError('Pick a game first');
  ctx.db.room.id.update({ ...room, state: { tag: 'Playing' } });
  console.info(`Room ${room.code} started '${room.game}' with ${members.length} players`);
});

// Host-only: send everyone back to the lobby (end of a game / abort).
export const returnToLobby = spacetimedb.reducer(ctx => {
  const me = requireMember(ctx);
  const room = ctx.db.room.id.find(me.roomId);
  if (!room || !room.host.isEqual(ctx.sender)) throw new SenderError('Only the host can do that');
  ctx.db.room.id.update({ ...room, state: { tag: 'Lobby' } });
  for (const m of [...ctx.db.roomMember.roomId.filter(room.id)]) ctx.db.roomMember.identity.update({ ...m, ready: false });
});

export const clientConnected = spacetimedb.clientConnected(ctx => {
  const me = ctx.db.roomMember.identity.find(ctx.sender);
  if (me && !me.online) ctx.db.roomMember.identity.update({ ...me, online: true });
});

export const clientDisconnected = spacetimedb.clientDisconnected(ctx => {
  const me = ctx.db.roomMember.identity.find(ctx.sender);
  if (!me) return;
  ctx.db.roomMember.identity.update({ ...me, online: false });
  ctx.db.disconnectCleanup.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(ctx.timestamp.microsSinceUnixEpoch + ReconnectGraceMicros),
    identity: ctx.sender,
  });
});

// Scheduled only. Clients could call it directly, so refuse anything not sent by the database itself.
export const cleanupDisconnected = spacetimedb.reducer(
  { onSchedule: disconnectCleanup },
  { job: disconnectCleanup.rowType },
  (ctx, { job }) => {
    if (!ctx.senderAuth.isInternal) throw new SenderError('Not allowed');
    const m = ctx.db.roomMember.identity.find(job.identity);
    if (m && !m.online) removeMember(ctx, job.identity);
  }
);

// ---------- Helpers ----------

function cleanName(raw: string | null | undefined): string {
  let name = (raw ?? '').trim();
  if (name.length === 0) throw new SenderError('Name required');
  if (name.length > 20) name = name.slice(0, 20);
  for (const c of name) if (isControl(c)) throw new SenderError('Invalid characters in name');
  return name;
}

function randomCode(ctx: Ctx): string {
  let s = '';
  for (let i = 0; i < CodeLength; i++) s += CodeAlphabet[ctx.random.integerInRange(0, CodeAlphabet.length - 1)];
  return s;
}

function addMember(ctx: Ctx, roomId: bigint, name: string, seat: number) {
  ctx.db.roomMember.insert({
    identity: ctx.sender,
    roomId,
    name,
    ready: false,
    seat,
    joinedAt: ctx.timestamp,
    online: true,
  });
}

function freeSeat(members: RoomMember[]): number {
  for (let s = 0; s < MaxMembers; s++) if (!members.some(m => m.seat === s)) return s;
  throw new SenderError('Room is full');
}

function requireMember(ctx: Ctx): RoomMember {
  const me = ctx.db.roomMember.identity.find(ctx.sender);
  if (!me) throw new SenderError('You are not in a room');
  return me;
}

function requireHostedLobby(ctx: Ctx): Room {
  const me = requireMember(ctx);
  const room = ctx.db.room.id.find(me.roomId);
  if (!room) throw new SenderError('Room not found');
  if (!room.host.isEqual(ctx.sender)) throw new SenderError('Only the host can do that');
  if (room.state.tag !== 'Lobby') throw new SenderError('Game already running');
  return room;
}

function leaveCurrentRoom(ctx: Ctx) {
  removeMember(ctx, ctx.sender);
}

function removeMember(ctx: Ctx, who: Identity) {
  const me = ctx.db.roomMember.identity.find(who);
  if (!me) return;
  ctx.db.roomMember.identity.delete(who);
  const room = ctx.db.room.id.find(me.roomId);
  if (!room) return;

  const remaining = [...ctx.db.roomMember.roomId.filter(room.id)];
  if (remaining.length === 0) {
    ctx.db.room.id.delete(room.id);
    return;
  }
  if (room.host.isEqual(who)) {
    // Hand host to whoever has been there longest (preferring someone online).
    const next = remaining.sort(
      (a, b) =>
        (a.online ? 0 : 1) - (b.online ? 0 : 1) || cmpBig(a.joinedAt.microsSinceUnixEpoch, b.joinedAt.microsSinceUnixEpoch)
    )[0];
    ctx.db.room.id.update({ ...room, host: next.identity });
  }
}

function checkJoinRateLimit(ctx: Ctx) {
  const a = ctx.db.joinAttempt.identity.find(ctx.sender);
  if (!a) return;
  const elapsed = ctx.timestamp.microsSinceUnixEpoch - a.windowStart.microsSinceUnixEpoch;
  if (elapsed > FailedJoinWindowMicros) {
    ctx.db.joinAttempt.identity.delete(ctx.sender);
    return;
  }
  if (a.failures >= MaxFailedJoins) throw new SenderError('Too many wrong codes. Wait a minute and try again');
}

function recordFailedJoin(ctx: Ctx) {
  const a = ctx.db.joinAttempt.identity.find(ctx.sender);
  if (a) ctx.db.joinAttempt.identity.update({ ...a, failures: a.failures + 1 });
  else ctx.db.joinAttempt.insert({ identity: ctx.sender, failures: 1, windowStart: ctx.timestamp });
}

/** Comparator for bigints (ascending). */
export function cmpBig(a: bigint, b: bigint): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Timestamp from microseconds. */
export function ts(micros: bigint): Timestamp {
  return new Timestamp(micros);
}
