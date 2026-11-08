import { ArrowRight, LockKeyhole, PhoneCall, Sparkles } from 'lucide-react'
import { href } from '../router'
import { useProgress } from '../lib/useProgress'
import { UPCOMING, pointsToGo, unlockShare } from '../content/upcoming'

const plural = (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`

/** Points toward the next game, as a quiet bar plus a line of text. Null while progress is loading. */
export function UnlockProgress({ id }: { id: string }) {
  const { status, progress } = useProgress()
  if (status !== 'ready') return null
  const points = progress.points
  const pct = Math.round(unlockShare(points) * 100)
  return (
    <div className="unlock-progress">
      <div
        className="unlock-bar"
        role="progressbar"
        aria-labelledby={id}
        aria-valuemin={0}
        aria-valuemax={UPCOMING.unlockAt}
        aria-valuenow={Math.min(points, UPCOMING.unlockAt)}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <p id={id} className="unlock-have">
        You have {plural(points)}
      </p>
    </div>
  )
}

/** Whether the player has reached the unlock (only once progress has loaded). */
function useUnlocked(): boolean {
  const { status, progress } = useProgress()
  return status === 'ready' && pointsToGo(progress.points) === 0
}

/** The fourth card on Home: the next game, locked until enough points. Opens the coming-soon page. */
export function LockedGameCard() {
  const unlocked = useUnlocked()
  return (
    <a
      className={`card locked-card${unlocked ? ' is-unlocked' : ''}`}
      href={href('phone-call')}
      aria-describedby="locked-line locked-status"
    >
      <span className="icon-tile" aria-hidden="true">
        <PhoneCall size={24} strokeWidth={1.4} />
      </span>
      <span className="kind">
        {unlocked ? (
          <>
            <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" /> Unlocked — coming soon
          </>
        ) : (
          <>
            <LockKeyhole size={16} strokeWidth={1.75} aria-hidden="true" /> Locked
          </>
        )}
      </span>
      <h3 className="h3">{UPCOMING.title}</h3>
      <p className="desc" id="locked-line">
        {UPCOMING.line}
      </p>
      <div className="locked-foot">
        <p className="locked-status" id="locked-status">
          {unlocked ? 'You’ve earned it. The game itself is still being built.' : `Unlocks at ${UPCOMING.unlockAt} points`}
        </p>
        <UnlockProgress id="locked-have" />
        <span className="locked-more">
          Find out more <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
        </span>
      </div>
    </a>
  )
}
