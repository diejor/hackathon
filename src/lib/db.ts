import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  GameEvent,
  ProfileVector,
  AttackPlan,
  EngagementEvent,
} from '../contracts';

const DB_PATH = process.env.SAFESIGNAL_DB_PATH || path.join(process.cwd(), 'safesignal.db');

let _db: DatabaseSync | null = null;
export function getDb(): DatabaseSync {
  if (_db) return _db;
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  _db = db;
  return db;
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS otp_challenges (playerId TEXT PRIMARY KEY, phone TEXT NOT NULL, code TEXT NOT NULL UNIQUE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS inbound_ids (id TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      firstName TEXT,
      phone TEXT,
      phoneVerified INTEGER DEFAULT 0,
      optedOut INTEGER DEFAULT 0,
      sendCount INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS game_events (
      id TEXT PRIMARY KEY,
      playerId TEXT REFERENCES players(id),
      game TEXT NOT NULL,
      payload TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      playerId TEXT REFERENCES players(id),
      profileVector TEXT NOT NULL,
      attackPlan TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS engagement_events (
      id TEXT PRIMARY KEY,
      campaignId TEXT REFERENCES campaigns(id),
      stage INTEGER NOT NULL,
      channel TEXT NOT NULL,
      outcome TEXT NOT NULL,
      latencyMs INTEGER NOT NULL,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tokens (
      token TEXT PRIMARY KEY,
      campaignId TEXT REFERENCES campaigns(id),
      resolved INTEGER DEFAULT 0,
      resolvedAt TEXT
    );
  `);
}

// ──────────────────────────────────────────────────────────────────────────
// Row types
// ──────────────────────────────────────────────────────────────────────────

export interface PlayerRow {
  id: string;
  firstName: string | null;
  phone: string | null;
  phoneVerified: boolean;
  optedOut: boolean;
  sendCount: number;
  createdAt: string;
}

interface PlayerRowRaw {
  id: string;
  firstName: string | null;
  phone: string | null;
  phoneVerified: number;
  optedOut: number;
  sendCount: number;
  createdAt: string;
}

function toPlayer(r: PlayerRowRaw | undefined): PlayerRow | null {
  if (!r) return null;
  return {
    id: r.id,
    firstName: r.firstName,
    phone: r.phone,
    phoneVerified: !!r.phoneVerified,
    optedOut: !!r.optedOut,
    sendCount: r.sendCount,
    createdAt: r.createdAt,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Players
// ──────────────────────────────────────────────────────────────────────────

export function createPlayer(firstName: string, phone: string): PlayerRow {
  const id = randomUUID();
  getDb()
    .prepare('INSERT INTO players (id, firstName, phone) VALUES (?, ?, ?)')
    .run(id, firstName, phone);
  return toPlayer(
    getDb().prepare('SELECT * FROM players WHERE id = ?').get(id) as unknown as PlayerRowRaw,
  )!;
}

export function getPlayer(id: string): PlayerRow | null {
  const r = getDb()
    .prepare('SELECT * FROM players WHERE id = ?')
    .get(id) as unknown as PlayerRowRaw | undefined;
  return toPlayer(r);
}

export function verifyPhone(id: string, phone: string): void {
  getDb()
    .prepare('UPDATE players SET phoneVerified = 1, phone = ? WHERE id = ?')
    .run(phone, id);
}

export function incrementSendCount(id: string): void {
  getDb().prepare('UPDATE players SET sendCount = sendCount + 1 WHERE id = ?').run(id);
}

export function optOutPlayer(id: string): void {
  getDb().prepare('UPDATE players SET optedOut = 1 WHERE id = ?').run(id);
}

// ──────────────────────────────────────────────────────────────────────────
// Game events
// ──────────────────────────────────────────────────────────────────────────

export function recordGameEvent(playerId: string, event: GameEvent): string {
  const id = randomUUID();
  getDb()
    .prepare(
      'INSERT INTO game_events (id, playerId, game, payload) VALUES (?, ?, ?, ?)',
    )
    .run(id, playerId, event.game, JSON.stringify(event));
  return id;
}

export function getGameEvents(playerId: string): GameEvent[] {
  const rows = getDb()
    .prepare('SELECT payload FROM game_events WHERE playerId = ? ORDER BY createdAt ASC')
    .all(playerId) as unknown as { payload: string }[];
  return rows.map((r) => JSON.parse(r.payload) as GameEvent);
}

// ──────────────────────────────────────────────────────────────────────────
// Campaigns, engagement, tokens
// ──────────────────────────────────────────────────────────────────────────

export function createCampaign(
  playerId: string,
  profile: ProfileVector,
  plan: AttackPlan,
): string {
  const id = randomUUID();
  getDb()
    .prepare(
      'INSERT INTO campaigns (id, playerId, profileVector, attackPlan) VALUES (?, ?, ?, ?)',
    )
    .run(id, playerId, JSON.stringify(profile), JSON.stringify(plan));
  return id;
}

export function createToken(campaignId: string): string {
  const token = randomUUID().replace(/-/g, '');
  getDb()
    .prepare('INSERT INTO tokens (token, campaignId) VALUES (?, ?)')
    .run(token, campaignId);
  return token;
}

export interface TokenRow {
  token: string;
  campaignId: string;
  resolved: boolean;
  resolvedAt: string | null;
}

export function resolveToken(token: string): TokenRow | null {
  const db = getDb();
  const row = db
    .prepare('SELECT token, campaignId, resolved, resolvedAt FROM tokens WHERE token = ?')
    .get(token) as unknown as
    | { token: string; campaignId: string; resolved: number; resolvedAt: string | null }
    | undefined;
  if (!row) return null;
  const already = !!row.resolved;
  if (!already) {
    db.prepare(
      "UPDATE tokens SET resolved = 1, resolvedAt = datetime('now') WHERE token = ?",
    ).run(token);
  }
  return {
    token: row.token,
    campaignId: row.campaignId,
    resolved: true,
    resolvedAt: row.resolvedAt ?? new Date().toISOString(),
  };
}

export function recordEngagement(event: EngagementEvent): string {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO engagement_events
       (id, campaignId, stage, channel, outcome, latencyMs)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, event.campaignId, event.stage, event.channel, event.outcome, event.latencyMs);
  return id;
}

export function getEngagements(campaignId: string): EngagementEvent[] {
  const rows = getDb()
    .prepare(
      `SELECT campaignId, stage, channel, outcome, latencyMs
       FROM engagement_events WHERE campaignId = ? ORDER BY createdAt ASC`,
    )
    .all(campaignId) as unknown as EngagementEvent[];
  return rows;
}
