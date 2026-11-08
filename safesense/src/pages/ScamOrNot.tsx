import { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  AtSign,
  Bell,
  Check,
  CheckCircle2,
  ExternalLink,
  Info,
  Lightbulb,
  Mail,
  MessageCircle,
  MessageSquare,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sprout,
  UserRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Crumb, PageHead } from '../components/Layout'
import { InspectPanel } from '../components/scamornot/InspectPanel'
import { Marked } from '../components/scamornot/Marked'
import { ProgressTrack } from '../components/scamornot/ProgressTrack'
import { marksFor, type Marks } from '../components/scamornot/evidence'
import { href } from '../router'
import { logActivity } from '../lib/stdb'
import { REMEMBER, REMEMBER_DEFAULT, SCENARIOS, type Guess, type Kind, type Scenario } from '../content/scamOrNot'
import '../scamornot.css'

const FORMAT: Record<Kind, { label: string; icon: LucideIcon }> = {
  text: { label: 'Text message', icon: MessageSquare },
  email: { label: 'Email', icon: Mail },
  social: { label: 'Social media message', icon: AtSign },
  app: { label: 'App notification', icon: Bell },
}

const LABEL: Record<Guess, string> = { scam: 'Scam', safe: 'Not a scam' }
const clues = (n: number) => `${n} ${n === 1 ? 'clue' : 'clues'}`

function SenderCard({ s, revealed, marks }: { s: Scenario; revealed: boolean; marks: Marks }) {
  const format = FORMAT[s.kind]
  const FormatIcon = format.icon
  return (
    <article className="sender-card" aria-label="Sender">
      <span className="sender-avatar" aria-hidden="true">
        {s.initials ?? <UserRound size={40} strokeWidth={1.3} />}
      </span>
      <div className="sender-info">
        <span className="format-label">
          <FormatIcon size={14} strokeWidth={2} /> {format.label}
        </span>
        <h2 className="sender-name">
          <Marked text={s.name} marks={marks.name} />
        </h2>
        {s.bio && (
          <p className="sender-bio">
            <Marked text={s.bio} marks={marks.bio} />
          </p>
        )}
        <ul className="tags">
          {s.details.map((d) => (
            <li key={d}>
              <Marked text={d} marks={marks.details} />
            </li>
          ))}
        </ul>
      </div>
      {revealed && (
        <span className={`reveal ${s.answer === 'scam' ? 'badge-warn' : 'badge-ok'}`}>
          {s.answer === 'scam' ? <AlertTriangle size={12} strokeWidth={2.5} /> : <ShieldCheck size={12} strokeWidth={2.5} />}{' '}
          {LABEL[s.answer]}
        </span>
      )}
    </article>
  )
}

function MessageCard({ s, marks }: { s: Scenario; marks: Marks }) {
  return (
    <article className={`message-card ${s.kind}`} aria-label={FORMAT[s.kind].label}>
        <header className="message-meta">
          <span className="from">
            <Marked text={s.from} marks={marks.from} />
          </span>
          <span className="time">{s.time}</span>
        </header>
        {s.kind === 'email' ? (
          <div className="email-content">
            {s.subject && (
              <h3>
                <Marked text={s.subject} marks={marks.subject} />
              </h3>
            )}
            <p>
              <Marked text={s.body} marks={marks.body} />
            </p>
            {s.link && (
              <span className="fake-link" role="presentation">
                <Marked text={s.link} marks={marks.link} />
              </span>
            )}
          </div>
        ) : (
          <div className="message-bubble">
            <Marked text={s.body} marks={marks.body} />
            {s.link && (
              <>
                {' '}
                <span className="inline-link">
                  <Marked text={s.link} marks={marks.link} />
                </span>
              </>
            )}
          </div>
        )}
    </article>
  )
}

/** Pick the one sign to remember: the first scam the player missed, else the first safe one, else a default. */
function signToRemember(missed: Scenario[]): string {
  const scam = missed.find((m) => m.answer === 'scam')
  if (scam) return REMEMBER[scam.tactic] ?? REMEMBER_DEFAULT
  if (missed.length) return REMEMBER.legit
  return REMEMBER_DEFAULT
}

type WrapProps = { missed: Scenario[]; checked: number; best: number; onAgain: () => void }

function WrapUp({ missed, checked, best, onAgain }: WrapProps) {
  return (
    <section className="game-shell wrap-up" aria-labelledby="wrap-title">
      <div className="section">
        <ShieldCheck size={32} strokeWidth={1.4} className="icon-muted" />
        <h2 id="wrap-title" className="h2 wrap-title" tabIndex={-1}>
          You looked at {SCENARIOS.length} messages.
        </h2>
        <p className="wrap-lead">
          Taking the time to look closely is the most important habit of all. Thank you for practicing.
        </p>
        <ul className="son-wrap-notes">
          <li>
            <Search size={18} strokeWidth={2} aria-hidden="true" />
            {checked
              ? `You checked ${clues(checked)} along the way.`
              : 'Next time, try “Check it” before you decide. Looking closer is always free.'}
          </li>
          {best >= 3 && (
            <li>
              <Sprout size={18} strokeWidth={2} aria-hidden="true" />
              Your steadiest run: {best} in a row.
            </li>
          )}
        </ul>
        <div className="feedback">
          <p className="feedback-title">
            <Lightbulb size={20} strokeWidth={1.5} /> One sign worth remembering
          </p>
          <p>{signToRemember(missed)}</p>
        </div>
      </div>
      <div className="section wrap-actions">
        <button className="btn btn-primary btn-block" onClick={onAgain}>
          <RotateCcw size={20} /> Play again
        </button>
        <a className="btn btn-secondary btn-block" href={href('chat')}>
          <MessageCircle size={20} /> Ask SafeSense about a message
        </a>
        <p className="see-progress-row">
          <a className="see-progress" href={href('profile')}>
            <Sprout size={18} strokeWidth={1.75} aria-hidden="true" /> See your progress
          </a>
        </p>
      </div>
    </section>
  )
}

export default function ScamOrNot() {
  const [round, setRound] = useState(0)
  const [guess, setGuess] = useState<Guess | null>(null)
  const [missed, setMissed] = useState<Scenario[]>([])
  const [done, setDone] = useState(false)
  // Inspect: which checks are open this round, and how many were open when the player answered.
  const [opened, setOpened] = useState<number[]>([])
  const [checkedAtAnswer, setCheckedAtAnswer] = useState(0)
  const [checkedTotal, setCheckedTotal] = useState(0)
  // A gentle "steady" run of right answers. It is acknowledged, never required.
  const [streak, setStreak] = useState(0)
  const [best, setBest] = useState(0)

  const s = SCENARIOS[round]
  const revealed = guess !== null
  const correct = guess === s.answer
  const last = round === SCENARIOS.length - 1
  const marks = marksFor(s, opened)

  const check = (i: number) => setOpened((o) => (o.includes(i) ? o : [...o, i]))

  const answer = (g: Guess) => {
    if (revealed) return
    setGuess(g)
    const right = g === s.answer
    const checked = opened.length
    setCheckedAtAnswer(checked)
    setCheckedTotal((t) => t + checked)
    const run = right ? streak + 1 : 0
    setStreak(run)
    setBest((b) => Math.max(b, run))
    if (!right) setMissed((m) => [...m, s])
    void logActivity('scam-or-not', right ? 'answer_correct' : 'answer_wrong', {
      item: s.id,
      said: g,
      tactic: s.tactic,
      checked,
    })
  }

  const next = () => {
    if (last) {
      setDone(true)
      requestAnimationFrame(() => document.getElementById('wrap-title')?.focus())
    } else setRound(round + 1)
    setGuess(null)
    setOpened([])
    window.scrollTo(0, 0)
  }

  const again = () => {
    setRound(0)
    setGuess(null)
    setMissed([])
    setOpened([])
    setCheckedTotal(0)
    setStreak(0)
    setBest(0)
    setDone(false)
    window.scrollTo(0, 0)
  }

  return (
    <>
      <PageHead
        crumb={<Crumb label="Scam or not?" />}
        title="Scam or Not?"
        lead="Look closely at each message, then decide: is it a scam or not?"
      />
      <div className="page-grid">
        {done ? (
          <WrapUp missed={missed} checked={checkedTotal} best={best} onAgain={again} />
        ) : (
        <section className="game-shell" aria-label="Game">
          <div className="section-top">
            <ProgressTrack total={SCENARIOS.length} done={round + (revealed ? 1 : 0)} current={round} />
          </div>

          <div className="section play">
            <SenderCard s={s} revealed={revealed} marks={marks} />
            <MessageCard s={s} marks={marks} />

            <InspectPanel checks={s.inspect} opened={opened} onCheck={check} answered={revealed} />

            <div className="verdicts" role="radiogroup" aria-label="Is this a scam?">
              {(['scam', 'safe'] as Guess[]).map((g) => {
                const Icon = g === 'scam' ? ShieldAlert : ShieldCheck
                const state = !revealed ? '' : g === guess ? 'chosen' : 'faded'
                return (
                  <button
                    key={g}
                    role="radio"
                    aria-checked={guess === g}
                    className={`verdict ${g} ${state}`}
                    onClick={() => answer(g)}
                    disabled={revealed && guess !== g}
                  >
                    <Icon size={24} strokeWidth={2} />
                    <span>{LABEL[g]}</span>
                    {guess === g && <Check size={20} strokeWidth={3} aria-label="Your answer" className="chosen-check" />}
                  </button>
                )
              })}
            </div>

            {revealed && (
              <div className={`feedback ${correct ? '' : 'caution'}`} aria-live="polite">
                <p className="feedback-title">
                  {correct ? <CheckCircle2 size={20} strokeWidth={1.5} /> : <Info size={20} strokeWidth={1.5} />}
                  {correct
                    ? `Well spotted — it ${s.answer === 'scam' ? 'is a scam' : 'is not a scam'}.`
                    : `Good try — this one ${s.answer === 'scam' ? 'is a scam' : 'is not a scam'}.`}
                </p>
                <p>{s.why}</p>
                <p className="clues-title">{s.answer === 'scam' ? 'What gave it away' : 'Why it looks genuine'}</p>
                <ul className="clues">
                  {s.clues.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <ul className="son-reveal-notes">
                  <li>
                    <Search size={16} strokeWidth={2} aria-hidden="true" />
                    {checkedAtAnswer
                      ? `You checked ${clues(checkedAtAnswer)} before deciding. Looking closer is a good habit.`
                      : 'You went with your first look. Next time, try a “Check it” too.'}
                  </li>
                  {correct && streak >= 3 && (
                    <li>
                      <Sprout size={16} strokeWidth={2} aria-hidden="true" />
                      {streak} in a row — nice and steady.
                    </li>
                  )}
                </ul>
                {s.source && (
                  <p className="son-source">
                    Learn more:{' '}
                    <a href={s.source.url} target="_blank" rel="noopener noreferrer">
                      {s.source.label}
                      <span className="sr-only"> (opens in a new tab)</span>
                      <ExternalLink size={14} strokeWidth={2} aria-hidden="true" />
                    </a>
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="section">
            <button className="btn btn-primary btn-block" onClick={next} disabled={!revealed}>
              <ArrowRight size={20} /> {last ? 'Finish' : 'Next message'}
            </button>
          </div>
        </section>
        )}

        <aside className="stack" style={{ gap: 16 }}>
          <div className="panel">
            <Lightbulb size={26} strokeWidth={1.4} className="icon-muted" />
            <h2 className="h3">Signs to look for</h2>
            <p>
              Scams often rush you, ask for money or personal details, or come from someone you can’t check. A
              real company won’t mind if you hang up and contact them using details you already trust.
            </p>
            <p>Not sure? Use “Check it” to look closer at the sender, the link or the wording before you decide.</p>
            <p className="son-credit">Inspect mechanic adapted from Friend or Fraud? by Krishna (SafeSense team).</p>
          </div>
          <a className="btn btn-secondary btn-block" href={href('home')}>
            Leave game
          </a>
        </aside>
      </div>
    </>
  )
}
