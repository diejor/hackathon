import { useEffect, useRef } from 'react'
import { ArrowRight, MessageCircle, RotateCcw, ShieldCheck, Sprout } from 'lucide-react'
import { href } from '../../router'
import { SAFETY_LINE, TACTICS, lessonFor } from '../../content/longCon'
import { believedCount, type CampaignState } from './useCampaign'

/** BadScam's debrief: every tactic you used, flipped into the defense it teaches. */
export function Debrief({
  s,
  onAgain,
  onOther,
}: {
  s: CampaignState
  onAgain: () => void
  onOther: () => void
}) {
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => title.current?.focus({ preventScroll: true }), [])

  const seen = new Set<string>()
  const lessons = s.used.flatMap((o) => {
    const l = lessonFor(o)
    if (!l || seen.has(l[0])) return []
    seen.add(l[0])
    return [{ lesson: l, tactic: o.lesson && o.tactic ? TACTICS[o.tactic].name : null }]
  })
  const believed = believedCount(s)

  return (
    <section className="card con-debrief" aria-labelledby="con-debrief-title">
      <p className="con-eyebrow">Debrief</p>
      <h2 id="con-debrief-title" className="con-serif-title" tabIndex={-1} ref={title}>
        Your playbook, turned around
      </h2>
      <p className="con-outcome">
        {s.c.people.length === 1
          ? `${s.c.people[0].name} ${believed ? 'believed it' : 'checked first'}. `
          : `${believed} of ${s.c.people.length} people you met believed it. `}
        Here is every move you used, and what it means when it arrives on your own phone.
      </p>

      <ol className="con-playbook">
        {lessons.map(({ lesson, tactic }, i) => (
          <li key={lesson[0]}>
            <span className="con-play-num" aria-hidden="true">
              {i + 1}
            </span>
            <div>
              {tactic && <span className="con-tactic">You used: {tactic}</span>}
              <strong>{lesson[0]}</strong>
              <p>{lesson[1]}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="panel con-routing">
        <h3 className="h3">Where a real one goes</h3>
        <ul>
          <li>
            A suspicious text: forward it to <b>7726</b> (it spells SPAM), then block the sender.
          </li>
          <li>
            A suspicious email: use your email app’s <b>Report phishing</b> or <b>Report spam</b> button.
          </li>
          <li>
            Shared a code, lost phone service, or saw a transfer you didn’t ask for: call your bank or carrier
            from another phone, using the number on your card or bill.
          </li>
        </ul>
      </div>

      <div className="panel con-motto">
        <ShieldCheck size={28} strokeWidth={1.4} className="icon-muted" />
        <p className="motto">Pause. Check. Then act.</p>
        <p>You are allowed to slow down, say no, and check another way.</p>
      </div>

      <div className="stack con-actions">
        <a className="btn btn-primary btn-block" href={href('chat')}>
          <MessageCircle size={20} /> Ask SafeSense about a message
        </a>
        <button className="btn btn-secondary btn-block" onClick={onAgain}>
          <RotateCcw size={20} /> Play this campaign again
        </button>
        <button className="btn btn-secondary btn-block" onClick={onOther}>
          <ArrowRight size={20} /> Try another campaign
        </button>
        <p className="see-progress-row">
          <a className="see-progress" href={href('profile')}>
            <Sprout size={18} strokeWidth={1.75} aria-hidden="true" /> See your progress
          </a>
        </p>
      </div>

      <p className="con-fineprint">{SAFETY_LINE} No real company was impersonated.</p>
      <p className="con-fineprint">Game design adapted from BadScam by Krishna (SafeSense team).</p>
    </section>
  )
}
