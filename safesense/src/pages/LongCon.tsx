import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronRight, Landmark, Package, ShieldCheck, Smartphone, VenetianMask } from 'lucide-react'
import { Crumb, PageHead } from '../components/Layout'
import { href } from '../router'
import { CAMPAIGNS, SAFETY_LINE, TACTICS, type Campaign } from '../content/longCon'
import { useCampaign, outcomeLine, type CampaignState } from '../components/longcon/useCampaign'
import { Hud } from '../components/longcon/Hud'
import { Feed } from '../components/longcon/Feed'
import { Debrief } from '../components/longcon/Debrief'
import '../longcon.css'

const ICONS = { parcel: Package, phone: Smartphone, bank: Landmark }

function Picker({ onPick }: { onPick: (c: Campaign) => void }) {
  return (
    <>
      <section className="card con-cover">
        <VenetianMask size={30} strokeWidth={1.4} className="icon-muted" />
        <h2 className="con-serif-title">For a few minutes, you’re the scammer.</h2>
        <p className="con-cover-lead">Learn the playbook from the inside, then turn it around.</p>
        <p className="muted">{SAFETY_LINE}</p>
      </section>
      <section className="respond con-pick">
        <h2 className="h3">Pick a campaign</h2>
        <p className="muted">Each choice is a real scam tactic. Simulated people react to every move.</p>
        <div className="choices">
          {CAMPAIGNS.map((c) => {
            const Icon = ICONS[c.icon]
            return (
              <button key={c.id} className="choice con-campaign" onClick={() => onPick(c)}>
                <span className="text">
                  <span className="chip">
                    <Icon size={16} strokeWidth={1.75} /> {c.chip}
                  </span>
                  <strong className="con-campaign-title">{c.title}</strong>
                  <span className="con-campaign-pitch">{c.pitch}</span>
                </span>
                <ChevronRight size={18} className="chev" />
              </button>
            )
          })}
        </div>
      </section>
    </>
  )
}

function Choices({ s, onPick }: { s: CampaignState; onPick: (i: number) => void }) {
  const first = useRef<HTMLButtonElement>(null)
  const scene = s.c.scenes[s.scene]
  useEffect(() => first.current?.focus({ preventScroll: true }), [s.scene])
  return (
    <section className="con-choices" aria-labelledby="con-move">
      <h2 id="con-move" className="con-move-title">
        Your move
      </h2>
      <div className="choices" role="group" aria-label="Your options">
        {scene.ask.map((o, i) => (
          <button key={i} ref={i === 0 ? first : undefined} className="choice con-choice" onClick={() => onPick(i)}>
            <span className="text">
              {o.tactic && <span className="con-tactic">{TACTICS[o.tactic].name}</span>}
              {o.label}
            </span>
            <ChevronRight size={18} className="chev" />
          </button>
        ))}
      </div>
    </section>
  )
}

function Ending({ s, onDebrief }: { s: CampaignState; onDebrief: () => void }) {
  return (
    <section className="card con-ending" aria-labelledby="con-ending-title">
      <p className="con-eyebrow">The ending</p>
      <h2 id="con-ending-title" className="con-serif-title">
        {outcomeLine(s)}
      </h2>
      <p>{s.c.ending({ reach: s.reach, cred: s.cred, people: s.c.people, status: s.status, end: s.end })}</p>
      <button className="btn btn-primary btn-block" onClick={onDebrief}>
        <ArrowRight size={20} /> Turn your playbook around
      </button>
    </section>
  )
}

function SidePanel() {
  return (
    <div className="panel con-about">
      <h2 className="h3">Why play the scammer?</h2>
      <p>
        Research on games like this one suggests that practicing a manipulation trick in a safe setting helps
        people resist it later, a little like a vaccine. Seeing a scam built one move at a time makes the moves
        easier to spot when they’re aimed at you.
      </p>
      <p className="con-credit">Game design adapted from BadScam by Krishna (SafeSense team).</p>
    </div>
  )
}

export default function LongCon() {
  const { state, start, pick, quit } = useCampaign()
  const [debrief, setDebrief] = useState(false)

  const begin = (c: Campaign | null) => {
    setDebrief(false)
    if (c) start(c)
    else quit()
    window.scrollTo(0, 0)
  }

  const head = (
    <PageHead
      crumb={<Crumb label="The Long Con" />}
      title="The Long Con"
      lead="You play the scammer, in a safe space. No messages or money will be sent."
    />
  )

  if (!state)
    return (
      <>
        {head}
        <div className="page-grid">
          <div>
            <Picker onPick={begin} />
          </div>
          <aside className="stack">
            <SidePanel />
            <div className="plain">
              <h2 className="h3">What careful people do</h2>
              <ul className="watch-list">
                <li>
                  <ShieldCheck size={20} strokeWidth={1.5} /> Call back on a number they already trust
                </li>
                <li>
                  <ShieldCheck size={20} strokeWidth={1.5} /> Open the app or site themselves, not the link
                </li>
                <li>
                  <ShieldCheck size={20} strokeWidth={1.5} /> Slow down when a message says “right now”
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </>
    )

  const Icon = ICONS[state.c.icon]
  const others = CAMPAIGNS.filter((c) => c.id !== state.c.id)

  if (debrief && state.done)
    return (
      <>
        {head}
        <div className="page-grid">
          <div>
            <Debrief s={state} onAgain={() => begin(state.c)} onOther={() => begin(null)} />
          </div>
          <aside className="stack">
            <div className="panel">
              <h2 className="h3" style={{ marginTop: 0 }}>
                Unsure in real life?
              </h2>
              <p>Check with the company or the person using a number you already trust. The SafeSense assistant can help
                you think it through.</p>
              <a className="btn btn-secondary btn-block" href={href('chat')} style={{ marginTop: 20 }}>
                Ask SafeSense
              </a>
            </div>
            {others.length > 0 && (
              <div className="plain">
                <h2 className="h3">Other campaigns</h2>
                <div className="stack con-others">
                  {others.map((c) => (
                    <button key={c.id} className="btn btn-secondary btn-block" onClick={() => begin(c)}>
                      {c.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </>
    )

  const step = Math.min(state.scene + 1, state.c.scenes.length)
  return (
    <>
      {head}
      <div className="con-top">
        <span className="chip">
          <Icon size={16} strokeWidth={1.75} /> {state.c.chip}
        </span>
        <span className="muted">{state.done ? 'The ending' : `Scene ${step} of ${state.c.scenes.length}`}</span>
      </div>
      <div className="con-grid">
        <aside className="con-side">
          <Hud c={state.c} reach={state.reach} cred={state.cred} status={state.status} />
        </aside>
        <div className="con-main">
          <Feed c={state.c} items={state.feed} scene={state.done ? state.scene + 1 : state.scene} firstNew={state.firstNew} />
          {!state.done && !state.waiting && <Choices s={state} onPick={(i) => pick(state.c.scenes[state.scene].ask[i])} />}
          {state.waiting && <p className="con-beat" aria-hidden="true">…</p>}
          {state.done && (
            <Ending
              s={state}
              onDebrief={() => {
                setDebrief(true)
                window.scrollTo(0, 0)
              }}
            />
          )}
          <button className="btn btn-secondary btn-block con-restart" onClick={() => begin(null)}>
            Choose a different campaign
          </button>
          <SidePanel />
        </div>
      </div>
    </>
  )
}
