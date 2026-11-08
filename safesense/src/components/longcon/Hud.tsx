import { useEffect, useRef, useState } from 'react'
import { Check, Info, ShieldCheck } from 'lucide-react'
import { LOW_CRED, type Campaign, type Reaction } from '../../content/longCon'
import { prefersReducedMotion } from './useCampaign'

/** Counts the shown number up (or down) to `target`, like BadScam's tally; instant with reduced motion. */
function useCountUp(target: number) {
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = from.current
    let raf = 0
    const t0 = performance.now()
    const dur = prefersReducedMotion() ? 0 : 450
    const tick = (now: number) => {
      const p = dur ? Math.min(1, (now - t0) / dur) : 1
      const v = Math.round(start + (target - start) * p)
      from.current = v
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return shown
}

function credWord(cred: number) {
  if (cred < LOW_CRED) return 'Doubtful'
  if (cred < 45) return 'Shaky'
  if (cred < 70) return 'Believable'
  return 'Convincing'
}

/** "How believable it looks", drawn as the designer's trust meter (design01's progress bar). */
function TrustMeter({ cred }: { cred: number }) {
  return (
    <span className={`rr-trust${cred < LOW_CRED ? ' is-low' : ''}`}>
      <span className="msg-bar" aria-hidden="true">
        <span style={{ width: `${Math.max(2, cred)}%` }} />
      </span>
      <span className="rr-trust-word">{credWord(cred)}</span>
    </span>
  )
}

const STATUS: Record<Reaction | 'none', string> = {
  none: 'Hasn’t decided',
  believed: 'Believed it',
  checked: 'Checked first',
}

export function Avatar({ name, tone, small }: { name: string; tone: number; small?: boolean }) {
  return (
    <span className={`con-avatar tone-${tone}${small ? ' is-small' : ''}`} aria-hidden="true">
      {name.trim()[0]}
    </span>
  )
}

export function Hud({
  c,
  reach,
  cred,
  status,
}: {
  c: Campaign
  reach: number
  cred: number
  status: Record<string, Reaction>
}) {
  const shown = useCountUp(reach)
  const low = cred < LOW_CRED
  return (
    <section className="con-hud" aria-label="How your campaign is going">
      <div className="con-stats">
        <div className="con-count">
          <span className="con-label">
            <span className="con-long">People who believed it</span>
            <span className="con-short">Believed it</span>
          </span>
          <span className="con-count-line">
            <strong className="con-count-num">{shown.toLocaleString('en-US')}</strong>
            <span className="con-sub">
              of {c.sentTo.toLocaleString('en-US')}
              <span className="con-long"> texts sent</span>
            </span>
          </span>
        </div>
        <div className="con-cred">
          <span className="con-label">
            <span className="con-long">How believable it looks</span>
            <span className="con-short">Believability</span>
          </span>
          <TrustMeter cred={cred} />
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {reach} people believed it. Believability {Math.round(cred)} out of 100.
      </p>

      {low && (
        <p className="con-low" role="status">
          <Info size={18} strokeWidth={1.75} aria-hidden="true" />
          <span>
            People are starting to doubt it.<span className="con-long"> This is where real scams fall apart.</span>
          </span>
        </p>
      )}

      <div className={`con-people${c.people.length === 1 ? ' is-solo' : ''}`}>
        <p className="con-label">
          <span className="con-long">
            {c.people.length === 1 ? 'The person you’re following' : 'The people you’re following'}
          </span>
        </p>
        <ul>
          {c.people.map((p) => {
            const s = status[p.id]
            return (
              <li key={p.id} className={`con-person is-${s ?? 'none'}`}>
                <span className="con-person-pic">
                  <Avatar name={p.name} tone={p.tone} />
                  {s && (
                    <span className="con-person-badge" aria-hidden="true">
                      {s === 'believed' ? <Check size={12} strokeWidth={3} /> : <ShieldCheck size={12} strokeWidth={2.5} />}
                    </span>
                  )}
                </span>
                <span className="con-person-text">
                  <span className="con-person-name">{p.name}</span>
                  <span className="con-person-bio">{p.bio}</span>
                  <span className="con-person-status">{STATUS[s ?? 'none']}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
