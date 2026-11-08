import { useState, type MouseEvent } from 'react'
import { ArrowRight, HeartHandshake, MessagesSquare, ScanSearch, ShieldCheck, SpellCheck, Sprout } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { href, type Route } from '../router'

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
    route: 'long-con',
    icon: MessagesSquare,
    kind: 'Role reversal',
    title: 'The Long Con',
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

export default function Home() {
  return (
    <>
      <section className="home-hero">
        <div>
          <div className="eyebrow">A little practice. More confidence.</div>
          <h1 className="page-title">Feel more sure. Stay more secure.</h1>
          <p className="lead">
            Scams can fool anyone. Learn what to look for with friendly activities, one small step at a time.
          </p>
          <p className="reassure">
            <HeartHandshake size={22} strokeWidth={1.5} className="icon-muted" />
            No scores to chase. No pressure to hurry.
          </p>
          <a className="see-progress" href={href('profile')}>
            <Sprout size={18} strokeWidth={1.75} aria-hidden="true" /> See your progress
          </a>
        </div>
        <aside className="panel">
          <ShieldCheck size={30} strokeWidth={1.4} className="icon-muted" />
          <p className="motto">
            Pause. Check. <br className="desktop-break" />
            Then act.
          </p>
          <p>You are allowed to slow down, ask questions and say no.</p>
        </aside>
      </section>

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
