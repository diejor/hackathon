import { ChallengeReflection } from '../components/ChallengeReflection'
import { useState, type FormEvent, type MouseEvent } from 'react'
import { ArrowRight, Lightbulb, MessagesSquare, Pencil, ScanSearch, SpellCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { href, type Route } from '../router'
import { KEYS, load, save, session, usePoints } from '../storage'
import { ASK_LABEL, THE_ASSISTANT } from '../components/chat/copy'
import { LockedGameCard } from '../components/LockedGame'
import { NameDialog } from '../components/NameDialog'
import { Mascot, stageMeta, stageFor, nextMilestone } from '../components/Mascot'
import { MAX_NICKNAME, setNickname, useNickname } from '../lib/profileStore'

type Game = {
  route: Route
  icon: LucideIcon
  kind: string
  title: string
  desc: string
  time: string
}

const GAMES: Game[] = [
  {
    route: 'fraudle',
    icon: SpellCheck,
    kind: 'Word game',
    title: 'Fraudle',
    desc: 'Guess the safety word from a clue, in six tries.',
    time: 'About 3 minutes',
  },
  {
    route: 'scam-or-not',
    icon: ScanSearch,
    kind: 'Spot the scam',
    title: 'Scam or Not?',
    desc: 'Read a message or profile. Make your guess: scam or not?',
    time: 'About 8 minutes',
  },
  {
    route: 'role-reversal',
    icon: MessagesSquare,
    kind: 'Think like a scammer',
    title: 'Role Reversal',
    desc: 'You are the scammer! Become more familiar with fraudulent tactics.',
    time: 'About 4 minutes',
  },
]

/** How long a tapped card stays highlighted on touch screens before the game opens. */
const TAP_HIGHLIGHT_MS = 220

function GameCard({ game }: { game: Game }) {
  const { route, icon: Icon, kind, title, desc, time } = game
  const [pressed, setPressed] = useState(false)

  // Desktop shows the highlight on hover. On touch screens there is no hover, so a tap shows the
  // highlight briefly before opening the game. A click event only fires for a real tap — not while
  // the page is being scrolled — so scrolling past the cards never highlights them.
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (window.matchMedia('(hover: hover)').matches) return
    e.preventDefault()
    setPressed(true)
    window.setTimeout(() => {
      window.location.hash = href(route)
    }, TAP_HIGHLIGHT_MS)
  }

  return (
    <a className={`card game-card ${pressed ? 'is-pressed' : ''}`} href={href(route)} onClick={onClick}>
      <span className="icon-tile" aria-hidden="true">
        <Icon size={24} strokeWidth={1.4} />
      </span>
      <span className="kind">{kind}</span>
      <h3 className="h3">{title}</h3>
      <p className="desc">{desc}</p>
      <p className="info">
        <span>{time}</span>
        <ArrowRight size={20} strokeWidth={1.75} className="go" aria-hidden="true" />
      </p>
    </a>
  )
}

/** Handed to the chat (sessionStorage, read once by the composer). The assistant sees the game history. */
const IMPROVE_PROMPT =
  'Please look at my progress so far: my points and the games I have played. What are some suggestions for how I can get better at spotting scams?'

/** Ask a first-time visitor for a name, inline on the dashboard (optional; "Not now" hides it). Remembered on this device. */
const PROMPTED_KEY = 'safesense.namePrompted'
function shouldPromptName(name: string): boolean {
  if (name) return false
  try {
    return !localStorage.getItem(PROMPTED_KEY)
  } catch {
    return false
  }
}
function markNamePrompted() {
  try {
    localStorage.setItem(PROMPTED_KEY, '1')
  } catch {
    /* private mode: we may ask again next visit, which is fine */
  }
}

const pointsLabel = (points: number | null) =>
  points === null ? 'Points loading' : `${points} ${points === 1 ? 'point' : 'points'}`

/** Progress toward the next evolution, shown under the mascot on the dashboard card. */
function MascotProgress({ points }: { points: number | null }) {
  const stage = stageFor(points)
  const meta = stageMeta(stage)
  const next = nextMilestone(stage)
  const p = points ?? 0
  const pct = next ? Math.min(100, Math.round(((p - meta.min) / (next.at - meta.min)) * 100)) : 100

  return (
    <div className="mascot-progress">
      <span className="mascot-progress-name">{meta.name}</span>
      {next ? (
        <>
          <span className="mascot-progress-bar" aria-hidden="true">
            <span className="mascot-progress-fill" style={{ width: `${pct}%` }} />
          </span>
          <span className="mascot-progress-hint">
            {next.at - p} more to {next.name}
          </span>
        </>
      ) : (
        <span className="mascot-progress-hint">Fully evolved</span>
      )}
    </div>
  )
}

/** The first-visit name question, as a small card on the dashboard instead of a popup (nothing is covered). */
function AskName({ onDone }: { onDone: () => void }) {
  const [value, setValue] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (value.trim()) setNickname(value)
    onDone()
  }
  return (
    <form className="ask-name" onSubmit={submit}>
      <label htmlFor="ask-name-input" className="ask-name-label">
        What should we call you? <span className="muted">(optional)</span>
      </label>
      <div className="ask-name-row">
        <input
          id="ask-name-input"
          className="text-input"
          value={value}
          maxLength={MAX_NICKNAME}
          autoComplete="given-name"
          placeholder="A first name or nickname"
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" className="btn btn-primary btn-sm">
          Save
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onDone}>
          Not now
        </button>
      </div>
    </form>
  )
}

export default function Home() {
  const name = useNickname()
  const [editing, setEditing] = useState(false)
  const [askName, setAskName] = useState(() => shouldPromptName(name))
  const points = usePoints()
  const shown = points === null ? '–' : points.toLocaleString()
  const lastRoute = load(KEYS.lastPlayed) as Route
  const lastGame = GAMES.find((g) => g.route === lastRoute)

  const askForSuggestions = () => {
    save(KEYS.chatPrompt, IMPROVE_PROMPT, session())
    window.location.hash = href('chat')
  }

  return (
    <>
      <ChallengeReflection />
      <section className="home-hero dashboard">
        <div>
          <div className="dash-greeting">
            <h1 className="page-title dash-title">Hello {name || 'there'}!</h1>
            <button
              className="name-edit"
              onClick={() => setEditing(true)}
              aria-label="Change your display name"
              title="Change your display name"
            >
              <Pencil size={20} strokeWidth={1.75} />
            </button>
            {/* Compact points shown beside the name when the dashboard stacks (smaller screens) */}
            <a className="points-badge" href={href('profile')} aria-label={`Your progress: ${pointsLabel(points)}`}>
              <span className="points-badge-value">{shown}</span>
              <Mascot points={points} size={26} compact className="badge-mascot" />
            </a>
          </div>
          <div className="eyebrow dash-welcome">Welcome to your dashboard</div>
          <p className="lead dash-intro">
            Scams can fool anyone. Learn what to look for with friendly activities, one small step at a time.
          </p>
          {askName && !name && (
            <AskName
              onDone={() => {
                markNamePrompted()
                setAskName(false)
              }}
            />
          )}

        </div>

        <aside className="dash-side">
          <a className="points-card" href={href('profile')} aria-label={`Your progress: ${pointsLabel(points)}`}>
            <div>
              <p className="points-value">{shown}</p>
              <p className="points-label">{points === 1 ? 'point' : 'points'}</p>
              <MascotProgress points={points} />
            </div>
            {/* The mascot grows as points climb; it replaces the old static sprout icon. */}
            <Mascot points={points} size={96} className="points-mascot" />
          </a>

          {lastGame ? (
            <a className="last-played" href={href(lastGame.route)}>
              <span className="muted">Last played:</span> <strong>{lastGame.title}</strong>
              <ArrowRight size={20} strokeWidth={1.75} aria-hidden="true" />
            </a>
          ) : (
            <p className="last-played muted">Last played: nothing yet. Pick a game below to start.</p>
          )}

          <div className="improve">
            <p className="improve-q">
              <Lightbulb size={20} strokeWidth={1.5} className="icon-muted" aria-hidden="true" />
              How can I improve?
            </p>
            <button className="btn btn-secondary btn-sm" onClick={askForSuggestions}>
              {ASK_LABEL} <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </aside>
      </section>

      {editing && <NameDialog current={name} onClose={() => setEditing(false)} />}

      <h2 className="h2 games-title">Pick a game</h2>
      <div className="games">
        {GAMES.map((game) => (
          <GameCard key={game.route} game={game} />
        ))}
        <LockedGameCard />
      </div>

      <section className="panel help-banner">
        <MessagesSquare size={36} strokeWidth={1.3} className="icon-muted" aria-hidden="true" />
        <div className="body">
          <h2 className="h3" style={{ marginTop: 0 }}>
            Something on your mind?
          </h2>
          <p style={{ marginTop: 4 }}>
            Talk it through with {THE_ASSISTANT}. Type it, say it, or add a screenshot or photo.
          </p>
        </div>
        <a className="btn btn-primary" href={href('chat')}>
          <ArrowRight size={20} aria-hidden="true" /> {ASK_LABEL}
        </a>
      </section>
    </>
  )
}
