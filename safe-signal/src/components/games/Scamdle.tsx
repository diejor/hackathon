"use client";
// Scamdle: 4 rounds. Spot which of the 8 red flags are in the message, then see them highlighted.
import { useEffect, useMemo, useState } from 'react';
import type { RedFlag, ScamdleEvent } from '../../contracts';
import { FLAG_INFO, RED_FLAGS, SCAMDLE_PUZZLES, puzzleFlags } from '../../lib/content';
import { ofCrowd, type Crowd } from '../../lib/crowd';
import { fetchCrowd, saveRound } from './api';
import { ActionBar, Button, CrowdRow, ErrorNote, MessageBubble, Progress, RoundReveal, cx, type Span } from './ui';

export interface GameSummary { score: number; headline: string; missed: RedFlag[] }
const PER_FOUND = 10, PER_FALSE_ALARM = 5;

export default function Scamdle({ onDone }: { onDone: (s: GameSummary) => void }) {
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<RedFlag[]>([]);
  const [result, setResult] = useState<{ event: ScamdleEvent; crowd: Crowd | null; points: number } | null>(null);
  const [score, setScore] = useState(0);
  const [missedAll, setMissedAll] = useState<RedFlag[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(() => Date.now());
  const puzzle = SCAMDLE_PUZZLES[round];
  const present = useMemo(() => puzzleFlags(puzzle), [puzzle]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [round, result]);

  const toggle = (f: RedFlag) => setPicked((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]));

  async function check() {
    setBusy(true); setError('');
    const event: ScamdleEvent = {
      game: 'scamdle', puzzleId: puzzle.id, attempts: 1,
      flagsFound: present.filter((f) => picked.includes(f)),
      flagsMissed: present.filter((f) => !picked.includes(f)),
      flagsFalsePositive: picked.filter((f) => !present.includes(f)),
      elapsedMs: Date.now() - started, tactic: puzzle.tactic, roundIndex: round,
    };
    try {
      const [, crowd] = await Promise.all([saveRound(event), fetchCrowd('scamdle', puzzle.id)]);
      const points = Math.max(0, event.flagsFound.length * PER_FOUND - event.flagsFalsePositive.length * PER_FALSE_ALARM);
      setScore((s) => s + points);
      setMissedAll((m) => [...m, ...event.flagsMissed]);
      setResult({ event, crowd, points });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please retry.');
    } finally { setBusy(false); }
  }

  function next() {
    if (round + 1 >= SCAMDLE_PUZZLES.length) {
      const max = SCAMDLE_PUZZLES.reduce((s, p) => s + puzzleFlags(p).length * PER_FOUND, 0);
      onDone({ score, headline: `${score} of ${max} points`, missed: missedAll });
      return;
    }
    setRound(round + 1); setPicked([]); setResult(null); setStarted(Date.now());
  }

  if (result) {
    const { event, crowd, points } = result;
    const spans: Span[] = puzzle.segments.map((s) => typeof s === 'string' ? { text: s } : { text: s[0], mark: s[1], state: event.flagsFound.includes(s[1]) ? 'found' : 'missed' });
    const hardest = [...present].sort((a, b) => (crowd?.shares[a] ?? 0) - (crowd?.shares[b] ?? 0))[0];
    const k = ofCrowd(crowd?.shares[hardest]);
    const all = event.flagsMissed.length === 0;
    return (
      <>
        <Progress game="Scamdle" revealed round={round} rounds={SCAMDLE_PUZZLES.length} score={score} />
        <RoundReveal
          ok={all && event.flagsFalsePositive.length === 0 ? true : event.flagsFound.length >= Math.ceil(present.length / 2) ? null : false}
          title={`You found ${event.flagsFound.length} of ${present.length} red flags`}
          detail={event.flagsFalsePositive.length ? `${event.flagsFalsePositive.length} false alarm${event.flagsFalsePositive.length > 1 ? 's' : ''}.` : all ? 'Every red flag, no false alarms.' : 'The highlighted parts are what gave it away.'}
          points={`+${points}`}
          message={<MessageBubble sender={puzzle.sender} spans={spans} highlight />}
          flags={[
            ...event.flagsFound.map((flag) => ({ flag, status: 'found' as const })),
            ...event.flagsMissed.map((flag) => ({ flag, status: 'missed' as const })),
            ...event.flagsFalsePositive.map((flag) => ({ flag, status: 'false_alarm' as const })),
          ]}
          technique={puzzle.tactic}
          lesson={puzzle.lesson}
          crowd={crowd ? <CrowdRow yes={k} tone="indigo" yesLabel="spotted it" noLabel="missed it" caption={`${k === 0 ? 'None' : k} of ${crowd.size} players like you spotted "${FLAG_INFO[hardest].label}"`} /> : null}
        />
        <ActionBar><Button onClick={next}>{round + 1 >= SCAMDLE_PUZZLES.length ? 'Finish Scamdle' : 'Next message'}</Button></ActionBar>
      </>
    );
  }

  return (
    <>
      <Progress game="Scamdle" round={round} rounds={SCAMDLE_PUZZLES.length} score={score} />
      <h1 className="text-2xl font-bold text-slate-900">Spot the red flags</h1>
      <p className="mb-4 mt-1 text-slate-600">Tap every warning sign you see in this message.</p>
      <MessageBubble sender={puzzle.sender} spans={puzzle.segments.map((s) => ({ text: typeof s === 'string' ? s : s[0] }))} />
      <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Red flags">
        {RED_FLAGS.map((f) => {
          const on = picked.includes(f);
          return (
            <button key={f} type="button" aria-pressed={on} onClick={() => toggle(f)} data-flag={f}
              className={cx('min-h-16 rounded-xl px-3 py-2.5 text-left ring-1 transition active:scale-[0.98]', on ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-slate-900 ring-slate-200 hover:ring-indigo-300')}>
              <span className="block text-sm font-semibold leading-tight">{on ? '✓ ' : ''}{FLAG_INFO[f].label}</span>
              <span className={cx('mt-0.5 block text-xs leading-tight', on ? 'text-indigo-100' : 'text-slate-500')}>{FLAG_INFO[f].hint}</span>
            </button>
          );
        })}
      </div>
      <ErrorNote error={error} />
      <ActionBar>
        <Button onClick={() => void check()} disabled={busy || picked.length === 0}>
          {busy ? 'Checking…' : picked.length ? `Check ${picked.length} flag${picked.length > 1 ? 's' : ''}` : 'Pick at least one flag'}
        </Button>
      </ActionBar>
    </>
  );
}
