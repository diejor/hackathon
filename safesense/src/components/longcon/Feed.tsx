import { useEffect, useRef } from 'react'
import { Headset } from 'lucide-react'
import type { Campaign } from '../../content/longCon'
import { Avatar } from './Hud'
import { prefersReducedMotion, type FeedItem } from './useCampaign'

function Receipt({ reach, cred }: { reach: number; cred: number }) {
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`)
  return (
    <p className="con-receipt">
      {reach !== 0 && (
        <span className={reach < 0 ? 'is-down' : ''}>
          {sign(reach)} {Math.abs(reach) === 1 ? 'person' : 'people'} believed it
        </span>
      )}
      {cred !== 0 && <span className={cred < 0 ? 'is-down' : ''}>Believability {sign(cred)}</span>}
    </p>
  )
}

/** The campaign feed: narrator lines, the texts you send, and simulated people reacting. */
export function Feed({ c, items, scene, firstNew }: { c: Campaign; items: FeedItem[]; scene: number; firstNew: number }) {
  const refs = useRef(new Map<number, HTMLElement>())

  // After a choice, bring its first new line into view if it landed low on the screen.
  useEffect(() => {
    const el = refs.current.get(firstNew)
    if (!el) return
    if (el.getBoundingClientRect().top > window.innerHeight * 0.6)
      el.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [firstNew])

  return (
    <div className="con-feed" aria-live="polite">
      {items.map((it) => {
        const e = it.entry
        const old = it.scene < scene ? ' is-old' : ''
        const ref = (el: HTMLElement | null) => {
          if (el) refs.current.set(it.key, el)
          else refs.current.delete(it.key)
        }
        const receipt = it.receipt && <Receipt {...it.receipt} />
        if (e.t === 'say')
          return (
            <div key={it.key} ref={ref} className={`con-row con-say${old}`}>
              <span className="con-who-line">
                <Headset size={16} strokeWidth={1.75} aria-hidden="true" /> Narrator
              </span>
              <p>{e.text}</p>
              {receipt}
            </div>
          )
        if (e.t === 'sent')
          return (
            <div key={it.key} ref={ref} className={`con-row con-sent${old}`}>
              <div className="con-who">
                <span className="con-avatar is-costume" aria-hidden="true">
                  {e.as.trim()[0]}
                </span>
                <span>
                  <b>You, as {e.as}</b>
                  <i>{e.bio}</i>
                </span>
              </div>
              <p>{e.text}</p>
              {receipt}
            </div>
          )
        const p = c.people.find((x) => x.id === e.who)
        return (
          <div key={it.key} ref={ref} className={`con-row con-post${old}`}>
            <div className="con-who">
              <Avatar name={p?.name ?? '?'} tone={p?.tone ?? 4} />
              <span>
                <b>{p?.name ?? e.who}</b>
                <i>{p ? `${p.bio} · simulated` : 'simulated'}</i>
              </span>
            </div>
            <p>{e.text}</p>
            {receipt}
          </div>
        )
      })}
    </div>
  )
}
