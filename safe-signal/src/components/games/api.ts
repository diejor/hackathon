"use client";
import type { GameEvent } from '../../contracts';
import type { Crowd, CrowdGame } from '../../lib/crowd';
import { buildCrowd } from '../../lib/crowd';
import { reportToBot } from '../../lib/helpbot';

let session: Promise<void> | null = null;
/** Create (or reuse) the cookie session once per tab. */
export function ensureSession(): Promise<void> {
  session ??= fetch('/api/player', { method: 'POST' }).then((r) => {
    if (!r.ok) { session = null; throw new Error('Could not start a session. Please retry.'); }
  });
  return session;
}

/** Store one round (SQLite via /api/events), then tell the coach (fire-and-forget). */
export async function saveRound(event: GameEvent, retry = true): Promise<void> {
  await ensureSession();
  const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) });
  if (res.status === 401 && retry) { session = null; return saveRound(event, false); }
  if (!res.ok) throw new Error('Could not save this round. Please retry.');
  void reportToBot(event);
}

/** Simulated "players like you" for one item; falls back to the hand-set odds if the API is unreachable. */
export async function fetchCrowd(game: CrowdGame, item: string): Promise<Crowd | null> {
  try {
    const res = await fetch(`/api/crowd?game=${game}&item=${encodeURIComponent(item)}`, { cache: 'no-store' });
    if (res.ok) return (await res.json()) as Crowd;
  } catch { /* offline: use the seed below */ }
  return buildCrowd(game, item, []);
}
