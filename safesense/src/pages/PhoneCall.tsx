import { HeartHandshake, LockKeyhole, PhoneCall as PhoneIcon, Sparkles } from 'lucide-react'
import { BackHome, Crumb, PageHead } from '../components/Layout'
import { UnlockProgress } from '../components/LockedGame'
import { UPCOMING, pointsToGo } from '../content/upcoming'
import { useProgress } from '../lib/useProgress'

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
                  ? `It unlocks at ${UPCOMING.unlockAt} points. Every game you finish earns 1 point.`
                  : `It unlocks at ${UPCOMING.unlockAt} points. Every game you finish earns 1 point, so ${toGo} more ${toGo === 1 ? 'game' : 'games'} to go.`}
            </p>
            <UnlockProgress id="pc-have" />
          </div>
          <BackHome />
        </aside>
      </div>
    </>
  )
}
