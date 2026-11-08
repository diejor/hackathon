// "Check it": optional evidence the player can open before answering. Adapted from the Inspect button in
// Friend or Fraud? by Krishna (SafeSense team), restyled to the calm design. Opening a check never costs anything.
import { useEffect, useRef } from 'react'
import { Eye, Search } from 'lucide-react'
import type { Inspect } from '../../content/scamOrNot'
import { useCoverReveal } from '../useCoverReveal'

type Props = {
  checks: Inspect[]
  opened: number[]
  onCheck: (i: number) => void
  /** After answering, unopened checks stay available for learning. */
  answered: boolean
}

export function InspectPanel({ checks, opened, onCheck, answered }: Props) {
  // Each opened check replaces its button, so move focus to the evidence it revealed.
  const focusNext = useRef<number | null>(null)
  useEffect(() => {
    if (focusNext.current === null) return
    document.getElementById(`son-evidence-${focusNext.current}`)?.focus()
    focusNext.current = null
  }, [opened])

  // Covered like the Fraudle clue until the eye button is pressed (ScamOrNot keys this per message).
  const [cover, reveal] = useCoverReveal()

  if (!checks.length) return null
  const left = checks.length - opened.length
  const covered = cover !== 'shown'

  return (
    <section className={`son-inspect${covered ? ' is-covered' : ''}`} aria-labelledby="son-inspect-title">
      {covered && (
        <div className={`clue-cover ${cover === 'fading' ? 'fading' : ''}`}>
          <button
            type="button"
            className={`clue-eye ${cover !== 'hidden' ? 'pressed' : ''}`}
            onClick={reveal}
            aria-label="Reveal the clues"
            title="Reveal the clues"
          >
            <Eye size={24} strokeWidth={1.75} />
          </button>
        </div>
      )}
      <div className="son-inspect-body" inert={covered}>
      <h3 id="son-inspect-title" className="son-inspect-title">
        <Search size={18} strokeWidth={2} aria-hidden="true" /> Check it before you decide
      </h3>
      <p className="son-inspect-hint">
        {answered
          ? left
            ? 'You can still look closer at this one.'
            : 'Every clue on this message is open.'
          : 'Optional. Looking closer never costs you anything.'}
      </p>
      <ul className="son-checks">
        {checks.map((c, i) =>
          opened.includes(i) ? (
            <li key={i} id={`son-evidence-${i}`} className="son-evidence" tabIndex={-1}>
              <p className="son-evidence-label">
                <Eye size={16} strokeWidth={2} aria-hidden="true" /> {c.label}
              </p>
              <p className="son-evidence-note">{c.note}</p>
            </li>
          ) : (
            <li key={i}>
              <button
                type="button"
                className="son-check"
                onClick={() => {
                  focusNext.current = i
                  onCheck(i)
                }}
              >
                <Search size={18} strokeWidth={2} aria-hidden="true" />
                <span>{c.label}</span>
              </button>
            </li>
          ),
        )}
      </ul>
      </div>
    </section>
  )
}
