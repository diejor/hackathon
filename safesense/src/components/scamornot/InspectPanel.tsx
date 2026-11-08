// "Check it": optional evidence the player can open before answering. Adapted from the Inspect button in
// Friend or Fraud? by Krishna (SafeSense team), restyled to the calm design. Opening a check never costs anything.
import { useEffect, useRef } from 'react'
import { Eye, Search } from 'lucide-react'
import type { Inspect } from '../../content/scamOrNot'

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

  if (!checks.length) return null
  const left = checks.length - opened.length

  return (
    <section className="son-inspect" aria-labelledby="son-inspect-title">
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
    </section>
  )
}
