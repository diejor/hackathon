// Bridge to the Help Bot (Security Arcade web app, ../web/src/bot): one SpacetimeDB connection per tab,
// shared by /coach (the chat) and the games (which report results so the bot can coach).
// Browser-only: web/src/lobby reads `location` at import time, so everything here is a dynamic import.
// Server/db come from ?server=&db=, else NEXT_PUBLIC_STDB_SERVER / NEXT_PUBLIC_STDB_DB, else Maincloud
// hackathon-1aa18263 (URL params are lost on <Link> navigation, so use the env vars for local testing); the identity token lives in
// localStorage (stdb.token.<db>), so every Safe Signal page in this browser is the same bot player.
import type { GameEvent } from '../contracts';

type Lobby = typeof import('../../../web/src/lobby');
let lobby: Promise<Lobby> | null = null;

/** Load the bot store and connect once (idempotent). */
export function helpBot(): Promise<Lobby> {
  const g = globalThis as { __STDB__?: { server?: string; db?: string } };
  g.__STDB__ ??= { server: process.env.NEXT_PUBLIC_STDB_SERVER || undefined, db: process.env.NEXT_PUBLIC_STDB_DB || undefined };
  lobby ??= Promise.all([import('../../../web/src/lobby'), import('../../../web/src/bot/bot')]).then(([L]) => {
    L.connect();
    return L;
  });
  return lobby;
}

type Activity = { game: string; kind: string; details: string };
const pending: Activity[] = [];

/** Map one Safe Signal game result onto log_activity rows (see spacetimedb/Activity.cs). */
export function toActivities(e: GameEvent): Activity[] {
  const row = (game: string, kind: string, d: Record<string, unknown>) => ({ game, kind, details: JSON.stringify(d).slice(0, 500) });
  const s = (ms: number) => Math.round(ms / 1000);
  if (e.game === 'scamdle') return [
    ...e.flagsFound.map((f) => row('scamdle', 'answer_correct', { item: e.puzzleId, tactic: f })),
    ...e.flagsMissed.map((f) => row('scamdle', 'answer_wrong', { item: e.puzzleId, tactic: f, missed: 'red flag not spotted' })),
    ...e.flagsFalsePositive.map((f) => row('scamdle', 'false_alarm', { item: e.puzzleId, tactic: f })),
    row('scamdle', 'round_done', { item: e.puzzleId, attempts: e.attempts, found: e.flagsFound.length, missed: e.flagsMissed.length, falseAlarms: e.flagsFalsePositive.length, seconds: s(e.elapsedMs) }),
  ];
  if (e.game === 'guesswho') {
    const ok = e.guessedContactId === e.correctContactId;
    const d = e.questionsDiagnosticity;
    return [row('guess-who', ok ? 'answer_correct' : 'answer_wrong', {
      item: e.roundId, tactic: 'authority_impersonation', chose: e.guessedContactId, answer: e.correctContactId,
      questions: e.questionsAsked.length, diagnosticity: d.length ? +(d.reduce((a, b) => a + b, 0) / d.length).toFixed(2) : 0,
      deferredToBot: e.deferredToBot, followedBotConsensus: e.followedBotConsensus, seconds: s(e.elapsedMs),
    })];
  }
  // Bad Scam: the player builds the scam, so there is no right/wrong; tactics they reach for are what they understand.
  return [row('bad-scam', 'round_done', { item: e.archetypeId, target: e.targetPersonaId, tacticsChosen: e.tacticsChosen, rail: e.paymentRail, reach: e.reachScore, seconds: s(e.elapsedMs) })];
}

/** Fire-and-forget: report a finished game to the bot. Never throws (the game already saved to Safe Signal). */
export async function reportToBot(e: GameEvent): Promise<void> {
  pending.push(...toActivities(e));
  try {
    const L = await helpBot();
    const flush = async () => {
      const c = L.getConn();
      if (!c || !L.state.connected) return false;
      while (pending.length) await c.reducers.logActivity(pending[0]).then(() => pending.shift());
      return true;
    };
    if (await flush()) return;
    const off = L.onChange(() => { if (L.state.connected) { off(); void flush().catch((err) => console.warn('[helpbot]', err)); } });
  } catch (err) {
    console.warn('[helpbot] report failed', err);
  }
}
