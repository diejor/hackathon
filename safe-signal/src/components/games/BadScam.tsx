"use client";
// Build a Bad Scam: 2 rounds. Play the scammer: pick a target and up to 2 tactics for an archetype;
// the reveal renders the message (catalog renderMessage with allowed slot values), a reach estimate,
// and what a careful reader would spot (the inoculation moment).
import { useEffect, useMemo, useState } from 'react';
import { TACTICS, TACTIC_TO_TRAIT, type AttackPlan, type BadScamEvent, type RedFlag, type Tactic } from '../../contracts';
import { library, renderMessage } from '../../lib/catalog';
import { BADSCAM_ROUNDS, PERSONAS, TACTIC_INFO, TACTIC_LINE, reachEstimate } from '../../lib/content';
import { ofCrowd, type Crowd } from '../../lib/crowd';
import { fetchCrowd, saveRound } from './api';
import type { GameSummary } from './Scamdle';
import { ActionBar, Button, Card, CrowdRow, ErrorNote, MessageBubble, Progress, RoundReveal, cx, spansFrom, type Span } from './ui';

const MAX_TACTICS = 2;
// renderMessage needs a token-shaped URL; the reveal swaps it for a "link" chip, so nothing real is shown.
const PLACEHOLDER = `https://example.invalid/t/${'0'.repeat(32)}`;

export default function BadScam({ onDone }: { onDone: (s: GameSummary) => void }) {
  const [round, setRound] = useState(0);
  const [persona, setPersona] = useState<string | null>(null);
  const [tactics, setTactics] = useState<Tactic[]>([]);
  const [result, setResult] = useState<{ event: BadScamEvent; crowd: Crowd | null } | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(() => Date.now());
  const spec = BADSCAM_ROUNDS[round];
  const archetype = useMemo(() => library.find((a) => a.id === spec.archetypeId)!, [spec]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [round, result]);

  const toggle = (t: Tactic) => setTactics((xs) => (xs.includes(t) ? xs.filter((x) => x !== t) : xs.length >= MAX_TACTICS ? xs : [...xs, t]));

  async function build() {
    const target = PERSONAS.find((p) => p.id === persona)!;
    setBusy(true); setError('');
    const event: BadScamEvent = {
      game: 'badscam', targetPersonaId: target.id, archetypeId: archetype.id, tacticsChosen: tactics,
      paymentRail: archetype.allowedPaymentRails[0] ?? 'card_fee', reachScore: reachEstimate(archetype, target, tactics).score,
      elapsedMs: Date.now() - started, roundIndex: round,
    };
    try {
      const [, crowd] = await Promise.all([saveRound(event), fetchCrowd('badscam', archetype.id)]);
      setTotal((s) => s + event.reachScore);
      setResult({ event, crowd });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please retry.');
    } finally { setBusy(false); }
  }

  function next() {
    if (round + 1 >= BADSCAM_ROUNDS.length) {
      onDone({ score: total, headline: `Average reach ${Math.round(total / BADSCAM_ROUNDS.length)} of 100`, missed: [] });
      return;
    }
    setRound(round + 1); setPersona(null); setTactics([]); setResult(null); setStarted(Date.now());
  }

  if (result) {
    const { event, crowd } = result;
    const target = PERSONAS.find((p) => p.id === event.targetPersonaId)!;
    const { score, notes } = reachEstimate(archetype, target, event.tacticsChosen);
    const fitting = event.tacticsChosen.filter((t) => archetype.traitLoads[TACTIC_TO_TRAIT[t]]);
    const plan: AttackPlan = {
      stage: 1, channel: 'imessage', archetypeId: archetype.id, tactics: fitting, slots: spec.slots,
      targetedTraits: fitting.map((t) => TACTIC_TO_TRAIT[t]), rationale: '',
    };
    const text = renderMessage(plan, PLACEHOLDER);
    const [before, after = ''] = text.split(PLACEHOLDER);
    const spans: Span[] = [
      ...spansFrom(before, [[spec.senderMark, 'sender_identity']]),
      { text: 'tap-to-pay link', mark: 'url_domain' },
      { text: after },
      ...event.tacticsChosen.flatMap((t): Span[] => [{ text: ' ' }, { text: TACTIC_LINE[t].line, mark: TACTIC_LINE[t].flag }]),
    ];
    const spot = [...new Set<RedFlag>([...archetype.flagsPresent, ...event.tacticsChosen.map((t) => TACTIC_LINE[t].flag)])];
    const top = Object.entries(crowd?.shares ?? {}).sort((a, b) => b[1] - a[1])[0] as [Tactic, number] | undefined;
    const sender = archetype.id === 'boss-gift-card' ? `${spec.slots.bossName} (unknown number)` : '+1 (833) 555-0142';
    return (
      <>
        <Progress game="Build a Bad Scam" revealed round={round} rounds={BADSCAM_ROUNDS.length} score={total} scoreLabel="reach" />
        <RoundReveal
          ok={null}
          title={`About ${score} of 100 people like ${target.name.split(',')[0]} would fall for it`}
          detail="Estimated reach, from how well your tactics fit the story and the target. A training heuristic, not a real send."
          message={
            <div className="space-y-3">
              <MessageBubble sender={sender} spans={spans} highlight
                footer={<p className="mt-3 text-xs text-slate-500">Rendered by the same template engine as the drill. The link is hidden in training.</p>} />
              <Card>
                <div className="mb-2 flex items-baseline justify-between"><h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Reach</h3><span className="text-2xl font-bold text-indigo-700">{score}</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${score}%` }} /></div>
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  {notes.length ? notes.map((n) => (
                    <li key={n.tactic} className="flex gap-2">
                      <span className={n.fits ? 'text-emerald-600' : 'text-slate-400'} aria-hidden>{n.fits ? '▲' : '▼'}</span>
                      {n.fits ? `${TACTIC_INFO[n.tactic].label} fits this story${n.fit >= 0.45 ? ` and hits ${target.name.split(',')[0]} hard` : ''}.` : `${TACTIC_INFO[n.tactic].label} doesn't fit this story, so it backfires.`}
                    </li>
                  )) : <li>No tactics: the bare story does all the work.</li>}
                </ul>
              </Card>
            </div>
          }
          flags={spot.map((flag) => ({ flag, status: 'present' as const }))}
          flagsTitle="Here's what a careful reader would spot"
          technique={fitting[0] ?? event.tacticsChosen[0] ?? null}
          lesson={spec.lesson}
          crowd={crowd && top ? <CrowdRow yes={ofCrowd(top[1])} tone="indigo" yesLabel={`used ${TACTIC_INFO[top[0]].label}`} noLabel="chose other tactics"
            caption={`${ofCrowd(top[1])} of ${crowd.size} players like you used "${TACTIC_INFO[top[0]].label}" here`} /> : null}
        />
        <ActionBar><Button onClick={next}>{round + 1 >= BADSCAM_ROUNDS.length ? 'Finish Build a Bad Scam' : 'Build the next scam'}</Button></ActionBar>
      </>
    );
  }

  return (
    <>
      <Progress game="Build a Bad Scam" round={round} rounds={BADSCAM_ROUNDS.length} score={total} scoreLabel="reach" />
      <h1 className="text-2xl font-bold text-slate-900">You're the scammer</h1>
      <p className="mb-4 mt-1 text-slate-600">Build {spec.pitch.charAt(0).toLowerCase() + spec.pitch.slice(1)} Seeing how it's made is how you learn to spot it.</p>

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">1 · Pick a target</h2>
        <p className="mb-3 text-xs text-slate-500">Synthetic people, not real ones.</p>
        <div className="space-y-2" role="radiogroup" aria-label="Target">
          {PERSONAS.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={persona === p.id} data-persona={p.id} onClick={() => setPersona(p.id)}
              className={cx('min-h-12 w-full rounded-xl px-4 py-3 text-left ring-1 transition', persona === p.id ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-slate-900 ring-slate-200 hover:ring-indigo-300')}>
              <span className="block font-semibold">{p.name}</span>
              <span className={cx('block text-sm', persona === p.id ? 'text-indigo-100' : 'text-slate-600')}>{p.blurb}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">2 · Pick up to {MAX_TACTICS} tactics</h2>
        <p className="mb-3 text-xs text-slate-500">{tactics.length} of {MAX_TACTICS} chosen</p>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tactics">
          {TACTICS.map((t) => {
            const on = tactics.includes(t);
            const full = !on && tactics.length >= MAX_TACTICS;
            return (
              <button key={t} type="button" aria-pressed={on} disabled={full} data-tactic={t} onClick={() => toggle(t)}
                className={cx('min-h-16 rounded-xl px-3 py-2.5 text-left ring-1 transition', on ? 'bg-indigo-600 text-white ring-indigo-600' : full ? 'bg-slate-50 text-slate-400 ring-slate-200' : 'bg-white text-slate-900 ring-slate-200 hover:ring-indigo-300')}>
                <span className="block text-sm font-semibold leading-tight">{on ? '✓ ' : ''}{TACTIC_INFO[t].label}</span>
                <span className={cx('mt-0.5 block text-xs leading-tight', on ? 'text-indigo-100' : 'text-slate-500')}>{TACTIC_INFO[t].blurb}</span>
              </button>
            );
          })}
        </div>
      </Card>
      <ErrorNote error={error} />
      <ActionBar>
        <Button onClick={() => void build()} disabled={busy || !persona || tactics.length === 0}>
          {busy ? 'Building…' : !persona ? 'Pick a target' : tactics.length === 0 ? 'Pick a tactic' : 'Build it (simulation only)'}
        </Button>
      </ActionBar>
    </>
  );
}
