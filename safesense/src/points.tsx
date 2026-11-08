import { useEffect, useState, type ReactNode } from 'react'

/** Total length of the award animation (ms); also the fallback if animation events never fire. */
const AWARD_MS = 1900

/**
 * "+1 point" burst: a green disc pops in with rays flashing out, holds, then shrinks away.
 * Calls onDone when it finishes.
 */
function PointAward({ amount = 1, onDone }: { amount?: number; onDone: () => void }) {
  return (
    <>
      <span className="sr-only" role="status">
        +{amount} point{amount === 1 ? '' : 's'} added to your account
      </span>
      <span
        className="award"
        aria-hidden="true"
        onAnimationEnd={(e) => e.target === e.currentTarget && onDone()}
      >
        <svg viewBox="0 0 120 120" width="112" height="112">
          <g className="award-rays">
            {Array.from({ length: 8 }, (_, i) => (
              <line key={i} x1="60" y1="14" x2="60" y2="4" transform={`rotate(${i * 45} 60 60)`} />
            ))}
          </g>
          <circle cx="60" cy="60" r="34" className="award-disc" />
          <text x="60" y="61" className="award-num">
            +{amount}
          </text>
        </svg>
        <span className="award-label">point{amount === 1 ? '' : 's'}</span>
      </span>
    </>
  )
}

/**
 * End-of-game overlay for a play area. It dims the play area and blocks input, plays the
 * +1 point animation, then brings in the end-of-game panel (children) on the same backdrop.
 * The parent must be position: relative.
 */
export function EndOverlay({ children, label }: { children: ReactNode; label: string }) {
  const [phase, setPhase] = useState<'points' | 'result'>('points')

  // Fallback in case animation events don't fire (e.g. animations disabled by the browser).
  useEffect(() => {
    const t = window.setTimeout(() => setPhase('result'), AWARD_MS + 400)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div className="end-overlay" role="dialog" aria-modal="true" aria-label={label}>
      {phase === 'points' ? (
        <PointAward onDone={() => setPhase('result')} />
      ) : (
        <div className="end-panel">{children}</div>
      )}
    </div>
  )
}
