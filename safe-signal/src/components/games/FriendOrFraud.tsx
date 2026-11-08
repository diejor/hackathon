"use client";
// Friend or Fraud (game id 'guesswho'): 6 rounds from the content bank. Up to 2 clue checks per round
// (questionsAsked / questionsDiagnosticity); in 2 rounds the simulated crowd's vote is shown first and we
// record whether the player followed it (followedBotConsensus) or handed the call to it (deferredToBot).
import { useEffect, useMemo, useState } from 'react';
import type { GuessWhoEvent, RedFlag } from '../../contracts';
import { POLISH_CLUE, TACTIC_INFO, pickFofRounds, type FofClue, type FofItem } from '../../lib/content';
import { ofCrowd, type Crowd } from '../../lib/crowd';
import { fetchCrowd, saveRound } from './api';
import type { GameSummary } from './Scamdle';
import { ActionBar, Button, Card, CrowdRow, ErrorNote, MessageBubble, Progress, RoundReveal, cx, spansFrom } from './ui';

const MAX_CLUES = 2, PER_CORRECT = 10, PER_GOOD_CLUE = 2;
type Verdict = 'fraud' | 'friend';
const majority = (c: Crowd | null): Verdict => ((c?.shares.fraud ?? 0) >= 0.5 ? 'fraud' : 'friend');

export default function FriendOrFraud({ onDone }: { onDone: (s: GameSummary) => void }) {
  const [{ items, crowdRounds }] = useState(() => pickFofRounds());
  const [round, setRound] = useState(0);
  const [asked, setAsked] = useState<FofClue[]>([]);
  const [preCrowd, setPreCrowd] = useState<Crowd | null>(null);
  const [result, setResult] = useState<{ event: GuessWhoEvent; crowd: Crowd | null; points: number } | null>(null);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(() => Date.now());
  const item: FofItem = items[round];
  const crowdRound = crowdRounds.includes(round);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [round, result]);
  useEffect(() => {
    setPreCrowd(null);
    if (crowdRound) void fetchCrowd('guesswho', item.id).then(setPreCrowd);
  }, [round, crowdRound, item.id]);

  // 3 clues from the item + 1 low-value "looks professional?" decoy, decoy position rotates by round.
  const chips = useMemo(() => {
    const c = [...item.clues];
    c.splice(round % (c.length + 1), 0, POLISH_CLUE);
    return c;
  }, [item, round]);

  async function answer(guess: Verdict, deferred = false) {
    setBusy(true); setError('');
    const correctId: Verdict = item.isFraud ? 'fraud' : 'friend';
    const crowdPick = crowdRound ? majority(preCrowd) : null;
    const event: GuessWhoEvent = {
      game: 'guesswho', roundId: item.id,
      questionsAsked: asked.map((c) => c.id), questionsDiagnosticity: asked.map((c) => c.diagnosticity),
      guessedContactId: guess, correctContactId: correctId,
      deferredToBot: deferred, followedBotConsensus: crowdPick !== null && guess === crowdPick,
      elapsedMs: Date.now() - started,
      ...(item.tactic ? { tactic: item.tactic } : {}), isFraud: item.isFraud,
      crowdShown: crowdRound, ...(crowdPick ? { crowdCorrect: crowdPick === correctId } : {}), roundIndex: round,
    };
    try {
      const [, crowd] = await Promise.all([saveRound(event), preCrowd ? Promise.resolve(preCrowd) : fetchCrowd('guesswho', item.id)]);
      const ok = guess === correctId;
      const points = ok ? PER_CORRECT + PER_GOOD_CLUE * asked.filter((c) => c.diagnosticity >= 0.5).length : 0;
      setScore((s) => s + points);
      if (ok) setCorrect((n) => n + 1);
      setResult({ event, crowd, points });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please retry.');
    } finally { setBusy(false); }
  }

  function next() {
    if (round + 1 >= items.length) {
      onDone({ score, headline: `${correct} of ${items.length} right`, missed: [] });
      return;
    }
    setRound(round + 1); setAsked([]); setResult(null); setStarted(Date.now());
  }

  const bubble = (highlight: boolean) => (
    <MessageBubble channel={item.channel} sender={item.sender} subject={item.subject || undefined}
      spans={spansFrom(item.body, highlight ? item.marks : [])} highlight={highlight} />
  );

  if (result) {
    const { event, crowd, points } = result;
    const ok = event.guessedContactId === event.correctContactId;
    const fraudVotes = ofCrowd(crowd?.shares.fraud);
    const crowdWrong = crowd ? majority(crowd) !== event.correctContactId : false;
    const flags = item.redFlags.map((flag: RedFlag) => ({ flag, status: 'present' as const }));
    return (
      <>
        <Progress game="Friend or Fraud" revealed round={round} rounds={items.length} score={score} />
        <RoundReveal
          ok={ok}
          title={item.isFraud ? `It's a scam: ${TACTIC_INFO[item.tactic!].label.toLowerCase()}` : "It's a friend: this one is real"}
          detail={`You said ${event.guessedContactId === 'fraud' ? 'Fraud' : 'Friend'}${event.deferredToBot ? ' (you went with the crowd)' : ''}. ${asked.length ? `You checked ${asked.length} clue${asked.length > 1 ? 's' : ''}.` : 'You answered without checking a clue.'}`}
          points={`+${points}`}
          message={bubble(true)}
          flags={flags}
          notes={item.flags}
          notesTone={item.isFraud ? 'red' : 'green'}
          technique={item.tactic}
          lesson={item.lesson}
          crowd={crowd ? (
            <div className="space-y-2">
              <CrowdRow yes={fraudVotes} yesLabel="said Fraud" noLabel="said Friend"
                caption={`${fraudVotes} of ${crowd.size} players like you said Fraud`} />
              {event.crowdShown && crowdWrong ? (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  The crowd got this one wrong{event.followedBotConsensus ? ', and you followed it' : ', and you didn\'t follow it. Nice'}. Checking a clue beats going with the crowd.
                </p>
              ) : null}
            </div>
          ) : null}
        />
        <ActionBar><Button onClick={next}>{round + 1 >= items.length ? 'Finish Friend or Fraud' : 'Next message'}</Button></ActionBar>
      </>
    );
  }

  const crowdPick = majority(preCrowd);
  return (
    <>
      <Progress game="Friend or Fraud" round={round} rounds={items.length} score={score} />
      <h1 className="text-2xl font-bold text-slate-900">Friend or Fraud?</h1>
      <p className="mb-4 mt-1 text-slate-600">Investigate if you like (up to {MAX_CLUES} checks), then make the call.</p>
      {bubble(false)}

      {crowdRound ? (
        <Card className="mt-4">
          {preCrowd ? (
            <>
              <CrowdRow yes={ofCrowd(preCrowd.shares.fraud)} yesLabel="said Fraud" noLabel="said Friend"
                caption={`${ofCrowd(crowdPick === 'fraud' ? preCrowd.shares.fraud : preCrowd.shares.friend)} of ${preCrowd.size} players like you said ${crowdPick === 'fraud' ? 'Fraud' : 'Friend'}`} />
              <Button variant="secondary" className="mt-3" disabled={busy} onClick={() => void answer(crowdPick, true)}>
                Go with the crowd ({crowdPick === 'fraud' ? 'Fraud' : 'Friend'})
              </Button>
            </>
          ) : <p className="text-sm text-slate-500">Loading what players like you said…</p>}
        </Card>
      ) : null}

      <div className="mt-4 space-y-2" role="group" aria-label="Investigate">
        <p className="text-sm font-semibold text-slate-900">Investigate <span className="font-normal text-slate-500">· {MAX_CLUES - asked.length} check{MAX_CLUES - asked.length === 1 ? '' : 's'} left</span></p>
        {chips.map((c) => {
          const open = asked.some((a) => a.id === c.id);
          const disabled = !open && asked.length >= MAX_CLUES;
          return (
            <div key={c.id}>
              <button type="button" disabled={disabled || open} data-clue={c.id} onClick={() => setAsked((a) => [...a, c])}
                className={cx('flex min-h-12 w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-semibold ring-1 transition',
                  open ? 'rounded-b-none bg-indigo-50 text-indigo-900 ring-indigo-200' : disabled ? 'bg-slate-100 text-slate-400 ring-slate-200' : 'bg-white text-slate-900 ring-slate-200 hover:ring-indigo-300 active:scale-[0.99]')}>
                <span>{c.label}</span><span aria-hidden className="text-indigo-600">{open ? '' : disabled ? '' : 'Check'}</span>
              </button>
              {open ? <p className="rounded-b-xl bg-white px-4 py-3 text-sm text-slate-700 ring-1 ring-indigo-200">{c.answer}</p> : null}
            </div>
          );
        })}
      </div>
      <ErrorNote error={error} />
      <ActionBar>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="friend" disabled={busy} onClick={() => void answer('friend')}>Friend</Button>
          <Button variant="fraud" disabled={busy} onClick={() => void answer('fraud')}>Fraud</Button>
        </div>
      </ActionBar>
    </>
  );
}
