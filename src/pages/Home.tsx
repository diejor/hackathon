import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { ArrowRight, KeyRound, Lightbulb, MessagesSquare, Pencil, ScanSearch, SpellCheck, Sprout } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { href, type Route } from '../router'
import { KEYS, load, save, session, usePoints } from '../storage'

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
    desc: 'Deduce the word. Any character length, six tries.',
    time: 'About 3 minutes',
  },
  {
    route: 'scam-or-not',
    icon: ScanSearch,
    kind: 'Spot the scam',
    title: 'Scam or Not?',
    desc: 'Read a message or profile. Make your guess: scam or not?',
    time: 'About 5 minutes',
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
      <span className="icon-tile">
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

const IMPROVE_PROMPT =
  'Please look at my progress so far: my points and the games I have played. What are some suggestions for how I can get better at spotting scams?'

/** Popup for changing the display name shown on the dashboard. */
function NameDialog({ current, onSave, onClose }: { current: string; onSave: (n: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState(current)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSave(value.trim())
  }

  return (
    <dialog ref={ref} className="name-dialog" aria-labelledby="name-dialog-title" onClose={onClose}>
      <form onSubmit={submit}>
        <h2 id="name-dialog-title" className="h3">
          What should we call you?
        </h2>
        <label htmlFor="display-name" className="muted">
          Your name is only shown on this device.
        </label>
        <input
          id="display-name"
          className="text-input"
          value={value}
          maxLength={30}
          autoComplete="given-name"
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-sm">
            Save name
          </button>
        </div>
      </form>
    </dialog>
  )
}

export default function Home() {
  const [name, setName] = useState(() => load(KEYS.name))
  const [editing, setEditing] = useState(false)
  const points = usePoints()
  const lastRoute = load(KEYS.lastPlayed) as Route
  const lastGame = GAMES.find((g) => g.route === lastRoute)

  const saveName = (n: string) => {
    setName(n)
    save(KEYS.name, n || null)
    setEditing(false)
  }

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
            <span className="points-badge" role="group" aria-label={`${points} ${points === 1 ? 'point' : 'points'}`}>
              <span className="points-badge-value">{points.toLocaleString()}</span>
              <Sprout size={22} strokeWidth={1.5} aria-hidden="true" />
            </span>
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
            {/* UI only: saving and restoring progress needs a backend */}
            <div className="keep-actions">
              <button className="btn btn-primary btn-sm">
                <KeyRound size={18} strokeWidth={1.75} /> Save my progress
              </button>
              <button className="btn btn-secondary btn-sm">Use my progress on this device</button>
            </div>
          </div>
        </div>

        <aside className="dash-side">
          <div className="points-card" aria-label={`${points} ${points === 1 ? 'point' : 'points'}`} role="group">
            <div>
              <p className="points-value">{points.toLocaleString()}</p>
              <p className="points-label">{points === 1 ? 'point' : 'points'}</p>
            </div>
            <Sprout size={60} strokeWidth={1.3} className="points-icon" aria-hidden="true" />
          </div>

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
              What are some suggestions for improvement?
            </p>
            <button className="btn btn-secondary btn-sm" onClick={askForSuggestions}>
              Ask in chat <ArrowRight size={18} strokeWidth={1.75} />
            </button>
          </div>
        </aside>
      </section>

      {editing && <NameDialog current={name} onSave={saveName} onClose={() => setEditing(false)} />}

      <h2 className="h2 games-title">Pick a game</h2>
      <div className="games">
        {GAMES.map((game) => (
          <GameCard key={game.route} game={game} />
        ))}
      </div>

      <section className="panel help-banner">
        <MessagesSquare size={36} strokeWidth={1.3} className="icon-muted" />
        <div className="body">
          <h2 className="h3" style={{ marginTop: 0 }}>
            Something on your mind?
          </h2>
          <p style={{ marginTop: 4 }}>Talk it through with us. Type, ask, or upload an image.</p>
        </div>
        <a className="btn btn-primary" href={href('chat')}>
          <ArrowRight size={20} /> Chat with us
        </a>
      </section>
    </>
  )
}
