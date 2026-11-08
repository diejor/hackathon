import { useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, Circle, HeartHandshake } from 'lucide-react'
import type { Caught } from '../../lib/progress'
import { GENUINE_SIGN, MESSAGE_SIGNS, MOVE_SIGNS, isKnownSign, signFor, type Sign } from '../../content/signs'

function where(c: Caught): string {
  if (c.inMessages && c.asScammer) return 'Spotted in messages and as the scammer'
  if (c.asScammer) return 'Seen from the scammer’s side'
  return 'Spotted in Scam or Not?'
}

/** On phones, each group shows the caught signs plus this many not-seen-yet ones until "Show all signs". */
const UNSEEN_PREVIEW = 2

function Tile({
  sign,
  caught,
  strength,
  extra,
}: {
  sign: Sign
  caught?: Caught
  strength?: boolean
  extra?: boolean
}) {
  const Icon = !caught ? Circle : strength ? HeartHandshake : CheckCircle2
  return (
    <li className={`sign-tile ${caught ? 'is-caught' : 'is-unseen'}${extra ? ' is-extra' : ''}`}>
      <Icon size={22} strokeWidth={1.75} className="sign-icon" aria-hidden="true" />
      <div>
        <p className="sign-name">
          <span className="sr-only">{caught ? 'You can spot: ' : 'Not seen yet: '}</span>
          {sign.name}
        </p>
        {caught ? (
          <>
            <p className="sign-line">{sign.line}</p>
            <p className="sign-where">{where(caught)}</p>
          </>
        ) : (
          <p className="sign-line" aria-hidden="true">
            Not seen yet
          </p>
        )}
      </div>
    </li>
  )
}

/** Marks the not-seen-yet tiles past the first few, which phones hide until "Show all signs". */
function withExtras(signs: Sign[], caught: Map<string, Caught>): [Sign, boolean][] {
  let unseen = 0
  return signs.map((s) => [s, !caught.has(s.slug) && ++unseen > UNSEEN_PREVIEW])
}

/** The collection of signs: caught ones filled in, the rest softly outlined. */
export function SignsGrid({ caught }: { caught: Map<string, Caught> }) {
  const [all, setAll] = useState(false)
  const extra = [...caught.keys()].filter((slug) => !isKnownSign(slug)).map(signFor)
  const messageTiles = withExtras([...MESSAGE_SIGNS, ...extra], caught)
  const moveTiles = withExtras(MOVE_SIGNS, caught)
  const hidden = [...messageTiles, ...moveTiles].filter(([, isExtra]) => isExtra).length

  return (
    <section className={`card profile-section signs${all ? ' show-all' : ''}`} aria-labelledby="signs-title">
      <h2 id="signs-title" className="h2">
        Signs you can spot
      </h2>
      <p className="muted profile-intro">
        Each one you notice in the games fills in here. There’s no order and no hurry.
      </p>

      <h3 className="h3 sign-group-title">Scam messages</h3>
      <ul className="sign-grid">
        {messageTiles.map(([s, isExtra]) => (
          <Tile key={s.slug} sign={s} caught={caught.get(s.slug)} extra={isExtra} />
        ))}
      </ul>

      <h3 className="h3 sign-group-title">Safe messages</h3>
      <ul className="sign-grid">
        <Tile sign={GENUINE_SIGN} caught={caught.get(GENUINE_SIGN.slug)} strength />
      </ul>

      <h3 className="h3 sign-group-title">Scammer moves</h3>
      <p className="muted small">From The Long Con, where you play the scammer.</p>
      <ul className="sign-grid">
        {moveTiles.map(([s, isExtra]) => (
          <Tile key={s.slug} sign={s} caught={caught.get(s.slug)} extra={isExtra} />
        ))}
      </ul>

      {hidden > 0 && (
        <button className="btn btn-secondary btn-block signs-toggle" onClick={() => setAll(!all)} aria-expanded={all}>
          {all ? <ChevronUp size={20} aria-hidden="true" /> : <ChevronDown size={20} aria-hidden="true" />}
          {all ? 'Show fewer signs' : `Show all signs (${hidden} more to find)`}
        </button>
      )}
    </section>
  )
}
