"use client";
// SafeSense training: Scamdle (4 rounds) → Friend or Fraud (6) → Build a Bad Scam (2), a reveal after
// every round, then "Training complete" → /campaign and /coach. Each round is stored (/api/events) and
// reported to the coach (reportToBot).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { RedFlag } from '../../src/contracts';
import { FLAG_INFO } from '../../src/lib/content';
import BadScam from '../../src/components/games/BadScam';
import FriendOrFraud from '../../src/components/games/FriendOrFraud';
import Scamdle, { type GameSummary } from '../../src/components/games/Scamdle';
import { ensureSession } from '../../src/components/games/api';
import { ActionBar, Button, Card, ErrorNote, cx } from '../../src/components/games/ui';

type GameId = 'scamdle' | 'guesswho' | 'badscam';
const GAMES: { id: GameId; name: string; rounds: number; blurb: string }[] = [
  { id: 'scamdle', name: 'Scamdle', rounds: 4, blurb: 'Spot the red flags hiding in a message.' },
  { id: 'guesswho', name: 'Friend or Fraud', rounds: 6, blurb: 'Investigate, then call it: real or scam?' },
  { id: 'badscam', name: 'Build a Bad Scam', rounds: 2, blurb: 'Play the scammer to see how the trick is built.' },
];

type Step = { kind: 'intro' } | { kind: 'play'; game: GameId } | { kind: 'between'; game: GameId } | { kind: 'done' };

export default function Games() {
  const [step, setStep] = useState<Step>({ kind: 'intro' });
  const [results, setResults] = useState<Partial<Record<GameId, GameSummary>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);

  async function start() {
    setBusy(true); setError('');
    try { await ensureSession(); setStep({ kind: 'play', game: 'scamdle' }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Please retry.'); }
    finally { setBusy(false); }
  }
  const finish = (game: GameId) => (s: GameSummary) => {
    setResults((r) => ({ ...r, [game]: s }));
    setStep(game === 'badscam' ? { kind: 'done' } : { kind: 'between', game });
  };
  const nextGame = (game: GameId): GameId => (game === 'scamdle' ? 'guesswho' : 'badscam');
  const gameIndex = step.kind === 'play' || step.kind === 'between' ? GAMES.findIndex((g) => g.id === step.game) : step.kind === 'done' ? 3 : -1;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-md px-4 pb-6 pt-4">
        {/* The site header carries the brand; this row is only the 3-game progress. */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-600">
            {step.kind === 'intro' ? 'Training · 3 games' : step.kind === 'done' ? 'Training · all done' : `Training · game ${gameIndex + 1} of 3`}
          </p>
          <ol className="flex items-center gap-1.5" aria-label="Training progress">
            {GAMES.map((g, i) => (
              <li key={g.id} title={g.name}
                className={cx('h-2 w-8 rounded-full', i < gameIndex || (step.kind === 'between' && i === gameIndex) ? 'bg-indigo-600' : i === gameIndex ? 'bg-indigo-300' : 'bg-slate-200')} />
            ))}
          </ol>
        </div>

        {step.kind === 'intro' && (
          <>
            <h1 className="text-3xl font-bold leading-tight">Train your scam radar</h1>
            <p className="mt-2 text-slate-600">Three quick games, about five minutes. After every round you'll see exactly what gave the scam away.</p>
            <div className="mt-5 space-y-3">
              {GAMES.map((g, i) => (
                <Card key={g.id} className="flex items-center gap-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-lg font-bold text-indigo-700">{i + 1}</div>
                  <div>
                    <p className="font-semibold">{g.name} <span className="text-sm font-normal text-slate-500">· {g.rounds} rounds</span></p>
                    <p className="text-sm text-slate-600">{g.blurb}</p>
                  </div>
                </Card>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-500">All brands, people and links are fictional. Nothing here is sent anywhere.</p>
            <ErrorNote error={error} />
            <ActionBar><Button onClick={() => void start()} disabled={busy}>{busy ? 'Starting…' : 'Start training'}</Button></ActionBar>
          </>
        )}

        {step.kind === 'play' && step.game === 'scamdle' && <Scamdle onDone={finish('scamdle')} />}
        {step.kind === 'play' && step.game === 'guesswho' && <FriendOrFraud onDone={finish('guesswho')} />}
        {step.kind === 'play' && step.game === 'badscam' && <BadScam onDone={finish('badscam')} />}

        {step.kind === 'between' && (() => {
          const done = GAMES.find((g) => g.id === step.game)!;
          const up = GAMES.find((g) => g.id === nextGame(step.game))!;
          return (
            <>
              <Card className="text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Game {gameIndex + 1} of 3 complete</p>
                <h1 className="mt-1 text-2xl font-bold">{done.name}</h1>
                <p className="mt-2 text-3xl font-bold text-indigo-700">{results[step.game]?.headline}</p>
              </Card>
              <Card className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Up next</p>
                <p className="mt-1 text-lg font-semibold">{up.name} <span className="text-sm font-normal text-slate-500">· {up.rounds} rounds</span></p>
                <p className="text-sm text-slate-600">{up.blurb}</p>
              </Card>
              <ActionBar><Button onClick={() => setStep({ kind: 'play', game: up.id })}>Play {up.name}</Button></ActionBar>
            </>
          );
        })()}

        {step.kind === 'done' && <Complete results={results} />}
      </main>
    </div>
  );
}

function Complete({ results }: { results: Partial<Record<GameId, GameSummary>> }) {
  const missed = results.scamdle?.missed ?? [];
  const counts = missed.reduce<Record<string, number>>((m, f) => ({ ...m, [f]: (m[f] ?? 0) + 1 }), {});
  const worst = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as RedFlag | undefined;
  return (
    <div data-testid="complete">
      <div className="rounded-2xl bg-indigo-600 p-6 text-white shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-indigo-200">All 3 games done</p>
        <h1 className="mt-1 text-3xl font-bold">Training complete</h1>
        <p className="mt-2 text-indigo-100">You've seen 12 messages and built 2 scams. Next, see which scam would most likely get you.</p>
      </div>
      <Card className="mt-4">
        <ul className="divide-y divide-slate-100">
          {GAMES.map((g) => (
            <li key={g.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <span className="font-semibold">{g.name}</span>
              <span className="text-sm font-semibold text-indigo-700">{results[g.id]?.headline ?? '—'}</span>
            </li>
          ))}
        </ul>
      </Card>
      {worst ? (
        <Card className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Your blind spot so far</p>
          <p className="mt-1 text-lg font-semibold text-red-700">{FLAG_INFO[worst].label}</p>
          <p className="text-sm text-slate-600">{FLAG_INFO[worst].spot}</p>
        </Card>
      ) : null}
      <ActionBar>
        <Link href="/campaign" className="flex min-h-12 w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700">See my scam profile</Link>
        <Link href="/coach" className="flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-4 py-3 font-semibold text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50">Ask the coach</Link>
      </ActionBar>
    </div>
  );
}
