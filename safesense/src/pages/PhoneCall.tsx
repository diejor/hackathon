import { HeartHandshake, LockKeyhole, MessagesSquare, PhoneCall as PhoneIcon, ScanSearch, Sparkles, SpellCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Crumb, PageHead } from '../components/Layout'
import { UnlockProgress } from '../components/LockedGame'
import { UPCOMING, pointsToGo } from '../content/upcoming'
import { useProgress } from '../lib/useProgress'
import { href, type Route } from '../router'

const GAMES: { route: Route; icon: LucideIcon; label: string }[] = [
  { route: 'scam-or-not', icon: ScanSearch, label: 'Play Scam or Not?' },
  { route: 'fraudle', icon: SpellCheck, label: 'Play Fraudle' },
  { route: 'long-con', icon: MessagesSquare, label: 'Play The Long Con' },
]

/** The coming-soon page for the locked game. Nothing here is playable yet. */
export default function PhoneCall() {
  const { status, progress } = useProgress()
  const toGo = status === 'ready' ? pointsToGo(progress.points) : null
  const unlocked = toGo === 0

  return (
    <>
      <PageHead
        crumb={<Crumb label={UPCOMING.title} />}
        title={UPCOMING.title}
        lead={unlocked ? 'Unlocked — coming soon. Thank you for practicing.' : 'Coming soon. Here’s what it will be.'}
      />
      <div className="page-grid">
        <div className="stack">
          <section className="card about-section" aria-labelledby="pc-what">
            <h2 id="pc-what" className="h2">
              What the game will be
            </h2>
            <ul className="about-list">
              {UPCOMING.what.map((line, i) => (
                <li key={i}>
                  {i === 0 ? (
                    <PhoneIcon size={22} strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    <HeartHandshake size={22} strokeWidth={1.5} aria-hidden="true" />
                  )}
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="card about-section" aria-labelledby="pc-why">
            <h2 id="pc-why" className="h2">
              Why phone scams are worth practicing
            </h2>
            {UPCOMING.why.map((line, i) => (
              <p key={i} className="pc-text">
                {line}
              </p>
            ))}
          </section>
        </div>

        <aside className="stack">
          <div className="panel pc-unlock">
            {unlocked ? (
              <Sparkles size={28} strokeWidth={1.4} className="icon-muted" aria-hidden="true" />
            ) : (
              <LockKeyhole size={28} strokeWidth={1.4} className="icon-muted" aria-hidden="true" />
            )}
            <h2 className="h3">{unlocked ? 'Unlocked — coming soon' : 'Keep practicing to unlock it'}</h2>
            <p>
              {unlocked
                ? 'You’ve reached the points for it. The game is still being built, so it isn’t playable yet.'
                : toGo === null
                  ? `It unlocks at ${UPCOMING.unlockAt} points.`
                  : `It unlocks at ${UPCOMING.unlockAt} points. ${toGo} to go.`}
            </p>
            <UnlockProgress id="pc-have" />
          </div>
          {GAMES.map(({ route, icon: Icon, label }, i) => (
            <a key={route} className={`btn btn-block ${i === 0 ? 'btn-primary' : 'btn-secondary'}`} href={href(route)}>
              <Icon size={20} aria-hidden="true" /> {label}
            </a>
          ))}
        </aside>
      </div>
    </>
  )
}
