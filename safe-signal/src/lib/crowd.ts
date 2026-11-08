// "Players like you": a simulated crowd built from stored round answers for one item, with hand-set
// per-item odds (src/lib/content.ts) until at least MIN_REAL answers exist. Never live humans, never free text.
import type { GameEvent } from '../contracts';
import { BADSCAM_ROUNDS, SCAMDLE_PUZZLES, fofItem, puzzleFlags } from './content';

export const MIN_REAL = 5;
export const CROWD_SIZE = 6;
export type CrowdGame = 'scamdle' | 'guesswho' | 'badscam';
export interface Crowd {
  game: CrowdGame;
  item: string;
  source: 'past' | 'seed'; // past = aggregated stored answers; seed = hand-set odds
  sample: number; // stored answers found for this item
  size: number; // simulated players shown
  shares: Record<string, number>; // guesswho: fraud/friend; scamdle: per flag spot rate; badscam: per tactic pick rate
}

const round2 = (x: number) => Math.round(x * 100) / 100;

export function seedCrowd(game: CrowdGame, item: string): Record<string, number> | null {
  if (game === 'guesswho') {
    const i = fofItem(item);
    return i ? { fraud: i.crowdFraud, friend: round2(1 - i.crowdFraud) } : null;
  }
  if (game === 'scamdle') {
    const p = SCAMDLE_PUZZLES.find((x) => x.id === item);
    return p ? ({ ...p.crowdSpot } as Record<string, number>) : null;
  }
  const r = BADSCAM_ROUNDS.find((x) => x.archetypeId === item);
  return r ? ({ ...r.crowdPick } as Record<string, number>) : null;
}

/** Aggregate stored events (already filtered to this game + item, other players only). */
export function aggregate(game: CrowdGame, item: string, events: GameEvent[]): Record<string, number> {
  const n = events.length || 1;
  if (game === 'guesswho') {
    const fraud = events.filter((e) => e.game === 'guesswho' && e.guessedContactId === 'fraud').length / n;
    return { fraud: round2(fraud), friend: round2(1 - fraud) };
  }
  if (game === 'scamdle') {
    const p = SCAMDLE_PUZZLES.find((x) => x.id === item);
    const out: Record<string, number> = {};
    for (const f of p ? puzzleFlags(p) : []) out[f] = round2(events.filter((e) => e.game === 'scamdle' && e.flagsFound.includes(f)).length / n);
    return out;
  }
  const out: Record<string, number> = {};
  for (const e of events) if (e.game === 'badscam') for (const t of e.tacticsChosen) out[t] = (out[t] ?? 0) + 1;
  for (const k of Object.keys(out)) out[k] = round2(out[k] / n);
  return out;
}

export function buildCrowd(game: CrowdGame, item: string, events: GameEvent[]): Crowd | null {
  const seed = seedCrowd(game, item);
  if (!seed) return null;
  const real = events.length >= MIN_REAL;
  return { game, item, source: real ? 'past' : 'seed', sample: events.length, size: CROWD_SIZE, shares: real ? aggregate(game, item, events) : seed };
}

/** How many of the simulated players match a share (0..1). */
export const ofCrowd = (share: number | undefined, size = CROWD_SIZE) => Math.max(0, Math.min(size, Math.round((share ?? 0) * size)));
