import { CheckCircle2, Circle, HeartHandshake } from 'lucide-react'
import type { Caught } from '../../lib/progress'
import { GENUINE_SIGN, MESSAGE_SIGNS, MOVE_SIGNS, isKnownSign, signFor, type Sign } from '../../content/signs'

function where(c: Caught): string {
  if (c.inMessages && c.asScammer) return 'Spotted in messages and as the scammer'
  if (c.asScammer) return 'Seen from the scammer’s side'
  return 'Spotted in Scam or Not?'
}

function Tile({ sign, caught, strength }: { sign: Sign; caught?: Caught; strength?: boolean }) {
  const Icon = !caught ? Circle : strength ? HeartHandshake : CheckCircle2
  return (
    <li className={`sign-tile ${caught ? 'is-caught' : 'is-unseen'}`}>
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

/** The collection of signs: caught ones filled in, the rest softly outlined. */
export function SignsGrid({ caught }: { caught: Map<string, Caught> }) {
  const extra = [...caught.keys()].filter((slug) => !isKnownSign(slug)).map(signFor)
  return (
    <section className="card profile-section" aria-labelledby="signs-title">
      <h2 id="signs-title" className="h2">
        Signs you can spot
      </h2>
      <p className="muted profile-intro">
        Each one you notice in the games fills in here. There’s no order and no hurry.
      </p>

      <h3 className="h3 sign-group-title">Scam messages</h3>
      <ul className="sign-grid">
        {[...MESSAGE_SIGNS, ...extra].map((s) => (
          <Tile key={s.slug} sign={s} caught={caught.get(s.slug)} />
        ))}
        <Tile sign={GENUINE_SIGN} caught={caught.get(GENUINE_SIGN.slug)} strength />
      </ul>

      <h3 className="h3 sign-group-title">Scammer moves</h3>
      <p className="muted small">From The Long Con, where you play the scammer.</p>
      <ul className="sign-grid">
        {MOVE_SIGNS.map((s) => (
          <Tile key={s.slug} sign={s} caught={caught.get(s.slug)} />
        ))}
      </ul>
    </section>
  )
}
