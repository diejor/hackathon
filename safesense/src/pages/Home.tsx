import { useState, type MouseEvent } from 'react'
import { ArrowRight, KeyRound, Lightbulb, MessagesSquare, Pencil, ScanSearch, SpellCheck, Sprout } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { href, type Route } from '../router'
import { KEYS, load, save, session, usePoints } from '../storage'
import { ASK_LABEL, THE_ASSISTANT } from '../components/chat/copy'
import { LockedGameCard } from '../components/LockedGame'
import { NameDialog } from '../components/NameDialog'
import { useNickname } from '../lib/profileStore'

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

/**
 * The recovery key lives on the profile page (components/profile/RecoveryKey). These buttons open it there:
 * 0 = show my key, 1 = I have a key.
 */
function openRecovery(which: 0 | 1) {
  window.location.hash = href('profile')
  window.setTimeout(() => {
    const box = document.querySelector<HTMLElement>('.recovery')
    if (!box) return
    box.scrollIntoView({ block: 'start' })
    document.querySelectorAll<HTMLButtonElement>('.recovery-body > .btn-block')[which]?.click()
  }, 400)
}

const pointsLabel = (points: number | null) =>
  points === null ? 'Points loading' : `${points} ${points === 1 ? 'point' : 'points'}`

export default function Home() {
  const name = useNickname()
  const [editing, setEditing] = useState(false)
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
              <Sprout size={22} strokeWidth={1.5} aria-hidden="true" />
            </a>
          </div>
          <div className="eyebrow dash-welcome">Welcome to your dashboard</div>
          <p className="lead dash-intro">
            Scams can fool anyone. Learn what to look for with friendly activities, one small step at a time.
          </p>

          <div className="keep-progress">
            <h2 className="keep-title">Keep your progress</h2>
            <p className="muted">
              There’s no account to remember. If you change phones or clear this browser, a recovery key brings
              your progress back.
            </p>
            <div className="keep-actions">
              <button className="btn btn-primary btn-sm" onClick={() => openRecovery(0)}>
                <KeyRound size={18} strokeWidth={1.75} aria-hidden="true" /> Show my recovery key
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => openRecovery(1)}>
                I have a recovery key
              </button>
            </div>
          </div>
        </div>

        <aside className="dash-side">
          <a className="points-card" href={href('profile')} aria-label={`Your progress: ${pointsLabel(points)}`}>
            <div>
              <p className="points-value">{shown}</p>
              <p className="points-label">{points === 1 ? 'point' : 'points'}</p>
            </div>
            <Sprout size={60} strokeWidth={1.3} className="points-icon" aria-hidden="true" />
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
