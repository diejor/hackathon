import { ArrowRight, Info, Sprout } from 'lucide-react'
import { href, type Route } from '../../router'
import type { PracticeItem } from '../../lib/progress'
import { GENUINE_SIGN, signFor } from '../../content/signs'

const GAME_NAME: Partial<Record<Route, string>> = {
  'scam-or-not': 'Scam or Not?',
  'role-reversal': 'Role Reversal',
  fraudle: 'Fraudle',
}

const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`)

/** The top tactics the person missed, each with its tell-tale sign and a game that trains it. */
export function WorthPracticing({ items, genuineMissed }: { items: PracticeItem[]; genuineMissed: number }) {
  return (
    <section className="card profile-section" aria-labelledby="practice-title">
      <h2 id="practice-title" className="h2">
        Worth practicing
      </h2>
      {items.length === 0 && genuineMissed === 0 && (
        <p className="muted profile-intro">
          Nothing stands out right now. Keep going at your own pace, and anything worth a second look will
          show up here.
        </p>
      )}
      {items.length > 0 && (
        <p className="muted profile-intro">These slipped past you. Everyone has a few, and practice helps.</p>
      )}

      <ul className="practice-list">
        {items.map((it) => {
          const sign = signFor(it.tactic)
          return (
            <li key={it.tactic} className="practice-item">
              <p className="practice-name">{sign.name}</p>
              <p className="muted small">
                Slipped past you {times(it.misses)}.
                {it.caughtSince && ' You’ve caught one since. Nice work.'}
              </p>
              <p className="practice-tell">
                <strong>The tell-tale sign: </strong>
                {sign.tell}
              </p>
              <a className="btn btn-secondary btn-block" href={href(sign.train)}>
                <ArrowRight size={20} /> Try {GAME_NAME[sign.train] ?? 'a game'}
              </a>
            </li>
          )
        })}
      </ul>

      {genuineMissed > 0 && (
        <div className="feedback practice-genuine">
          <p className="feedback-title">
            <Info size={20} strokeWidth={1.5} /> Extra careful
          </p>
          <p>You were extra careful with a genuine message — that’s okay. {GENUINE_SIGN.tell}</p>
        </div>
      )}

      {items.length === 0 && genuineMissed === 0 && (
        <p className="practice-calm">
          <Sprout size={20} strokeWidth={1.5} className="icon-muted" aria-hidden="true" /> Pause. Check. Then act.
        </p>
      )}
    </section>
  )
}
