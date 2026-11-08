import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { useTapHighlight } from '../components/useTapHighlight'
import { ArrowRight, ChevronRight, Headset, Landmark, MessageCircle, Package, RotateCcw, Search, Smartphone } from 'lucide-react'
import { BackHome, Crumb, PageHead } from '../components/Layout'
import { ASK_LABEL, THE_ASSISTANT } from '../components/chat/copy'
import { EndOverlay } from '../points'
import { href } from '../router'
import { CAMPAIGNS, SAFETY_LINE, START_CRED, TACTICS, type Campaign } from '../content/longCon'
import { useCampaign, outcomeLine, prefersReducedMotion, type CampaignState, type FeedItem } from '../components/longcon/useCampaign'
import { Hud } from '../components/longcon/Hud'
import { Debrief } from '../components/longcon/Debrief'
import '../longcon.css'

// Role Reversal: the designer's page (design01: layout, text-message thread, per-reply trust meter, docked
// choices, end-of-game overlay) running our engine and stories (content/longCon.ts, adapted from Krishna's
// BadScam). Activity is still logged as game "long-con" (round_done), so older progress keeps counting.

const ICONS = { parcel: Package, phone: Smartphone, bank: Landmark }

const clamp = (n: number) => Math.min(100, Math.max(0, n))

/** The thread: narrator notes, your texts (with the tactic you used), and simulated people's replies. */
function Thread({ s }: { s: CampaignState }) {
  const refs = useRef(new Map<number, HTMLElement>())
  const scene = s.done ? s.scene + 1 : s.scene

  // After a choice, bring its first new line into view if it landed low on the screen.
  // (Not on the story's first lines: the brief and the "how it's going" bar above them stay in view.)
  useEffect(() => {
    if (s.firstNew === 0) return
    const el = refs.current.get(s.firstNew)
    if (!el) return
    if (el.getBoundingClientRect().top > window.innerHeight * 0.55)
      el.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [s.firstNew])

  // The trust meter shows believability after each move (the engine clamps it the same way).
  const after = new Map<number, { cred: number; change: number }>()
  s.feed.reduce((cred, it) => {
    if (!it.receipt) return cred
    const next = clamp(cred + it.receipt.cred)
    after.set(it.key, { cred: next, change: next - cred })
    return next
  }, START_CRED)
  return (
    <div className="messages rr-thread" aria-live="polite">
      {s.feed.map((it: FeedItem) => {
        const e = it.entry
        const old = it.scene < scene ? ' is-old' : ''
        const ref = (el: HTMLElement | null) => {
          if (el) refs.current.set(it.key, el)
          else refs.current.delete(it.key)
        }
        let meter = null
        const m = after.get(it.key)
        if (it.receipt && m) {
          const { cred, change } = m
          const reach = it.receipt.reach
          meter = (
            <span className="rr-receipt">
              <span
                className="msg-progress"
                role="img"
                aria-label={`Believability ${Math.round(cred)} out of 100, ${change >= 0 ? 'up' : 'down'} ${Math.abs(change)}`}
              >
                <span className="msg-bar">
                  <span style={{ width: `${cred}%` }} />
                </span>
                <span className={`msg-change ${change > 0 ? 'up' : change < 0 ? 'down' : ''}`}>
                  {change > 0 ? `+${change}` : change < 0 ? change : '±0'}
                </span>
              </span>
              {reach > 0 && (
                <span className="rr-reach">
                  +{reach.toLocaleString('en-US')} {reach === 1 ? 'person' : 'people'} believed it
                </span>
              )}
              {reach < 0 && <span className="rr-reach is-down">{(-reach).toLocaleString('en-US')} fewer believed it</span>}
            </span>
          )
        }
        if (e.t === 'say')
          return (
            <div key={it.key} ref={ref} className={`rr-say${old}`}>
              <span className="rr-say-who">
                <Headset size={16} strokeWidth={1.75} aria-hidden="true" /> Narrator
              </span>
              <p>{e.text}</p>
              {meter}
            </div>
          )
        if (e.t === 'sent')
          return (
            <div key={it.key} ref={ref} className={`bubble mine rr-bubble${old}`}>
              <span className="meta">You, as {e.as}</span>
              {e.text}
              {it.tactic && <span className="tactic">Tactic: {TACTICS[it.tactic].name}</span>}
              {meter}
            </div>
          )
        const p = s.c.people.find((x) => x.id === e.who)
        return (
          <div key={it.key} ref={ref} className={`bubble rr-bubble${old}`}>
            <span className="meta">
              {p?.name ?? e.who} · {p ? `${p.bio} · simulated` : 'simulated'}
            </span>
            {e.text}
            {meter}
          </div>
        )
      })}
      {s.waiting && (
        <p className="muted small rr-typing" aria-hidden="true">
          …
        </p>
      )}
    </div>
  )
}

/** A story or message choice: dark green on hover, or briefly on a tap (see useTapHighlight). */
function Choice({
  onChoose,
  className = '',
  disabled,
  btnRef,
  children,
}: {
  onChoose: () => void
  className?: string
  disabled?: boolean
  btnRef?: Ref<HTMLButtonElement>
  children: ReactNode
}) {
  const [pressed, tap] = useTapHighlight()
  return (
    <button
      ref={btnRef}
      className={`choice ${className} ${pressed ? 'is-pressed' : ''}`.trim()}
      onClick={() => !pressed && tap(onChoose)}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

/** The story picker, inside the designer's card. */
function Picker({ onPick }: { onPick: (c: Campaign) => void }) {
  return (
    <section className="card rr-card" aria-labelledby="rr-pick-title">
      <p className="brief">
        For a few minutes, you are <strong>the scammer</strong>. Learn the playbook from the inside, then turn it
        around.
      </p>
      <p className="muted rr-safety">{SAFETY_LINE}</p>
      <h2 id="rr-pick-title" className="dock-title rr-pick-title">
        Pick a story
      </h2>
      <div className="choices">
        {CAMPAIGNS.map((c) => {
          const Icon = ICONS[c.icon]
          return (
            <Choice key={c.id} className="con-campaign" onChoose={() => onPick(c)}>
              <span className="text">
                <span className="chip">
                  <Icon size={16} strokeWidth={1.75} /> {c.chip}
                </span>
                <strong className="con-campaign-title">{c.title}</strong>
                <span className="con-campaign-pitch">{c.pitch}</span>
              </span>
              <ChevronRight size={18} className="chev" />
            </Choice>
          )
        })}
      </div>
    </section>
  )
}

/** The game: the designer's card with our campaign running in it. */
function Play({
  s,
  onPick,
  onRestart,
  onDebrief,
}: {
  s: CampaignState
  onPick: (i: number) => void
  onRestart: () => void
  onDebrief: () => void
}) {
  const scene = s.c.scenes[s.scene]
  const sceneCount = s.c.scenes.length
  const Icon = ICONS[s.c.icon]
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!s.waiting && !s.done) first.current?.focus({ preventScroll: true })
  }, [s.scene, s.waiting, s.done])

  return (
    <section className="card rr-card" aria-label="Role Reversal game">
      <div className="game-top rr-top">
        <span className="chip">
          <Icon size={16} strokeWidth={1.75} /> {s.c.chip}
        </span>
        <div
          className="guess-tracker"
          role="img"
          aria-label={s.done ? 'Story over' : `Scene ${s.scene + 1} of ${sceneCount}`}
        >
          {s.c.scenes.map((_, i) => (
            <span key={i} className={`pip ${i < s.scene || s.done ? 'used' : ''}`} />
          ))}
        </div>
      </div>

      <p className="brief">
        You are <strong>the scammer</strong>. {s.c.pitch}
      </p>

      <Hud c={s.c} reach={s.reach} cred={s.cred} status={s.status} />

      <p className="sim-label">
        <MessageCircle size={22} strokeWidth={1.4} className="icon-muted" aria-hidden="true" /> Text message simulation
      </p>

      <Thread s={s} />

      {/* On phones the options stay docked at the bottom of the screen (design01). */}
      {!s.done && (
        <div className="dock rr-dock">
          <h2 className="dock-title">Choose your message</h2>
          <div className="choices" role="group" aria-label="Your options">
            {scene.ask.map((o, i) => (
              // Keyed per scene so a tapped choice's highlight doesn't carry over to the next scene's options.
              <Choice
                key={`${s.scene}-${i}`}
                btnRef={i === 0 ? first : undefined}
                onChoose={() => onPick(i)}
                disabled={s.waiting}
              >
                <span className="text">{o.label}</span>
                <ChevronRight size={18} className="chev" />
              </Choice>
            ))}
          </div>
          <button className="btn btn-secondary btn-block restart-btn" onClick={onRestart}>
            Start over <RotateCcw size={20} strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* design01's end of game: the +1 point (logged as long-con round_done), then the ending. */}
      {s.done && (
        <EndOverlay label="Story over">
          <div className="result-box rr-result">
            <p className="clue-label">Story over</p>
            <h2 className="result-title">{outcomeLine(s)}</h2>
            <p className="result-def">
              {s.c.ending({ reach: s.reach, cred: s.cred, people: s.c.people, status: s.status, end: s.end })}
            </p>
            <button autoFocus className="btn btn-primary btn-block" onClick={onDebrief}>
              Turn your playbook around <ArrowRight size={20} />
            </button>
            <button className="btn btn-secondary btn-block" style={{ marginTop: 10 }} onClick={onRestart}>
              <RotateCcw size={20} /> Play again
            </button>
          </div>
        </EndOverlay>
      )}
    </section>
  )
}

function WhyPanel() {
  return (
    <div className="panel con-about">
      <h2 className="h3" style={{ marginTop: 0 }}>
        Why play the scammer?
      </h2>
      <p>
        Research on games like this one suggests that practicing a manipulation trick in a safe setting helps
        people resist it later, a little like a vaccine. Seeing a scam built one move at a time makes the moves
        easier to spot when they’re aimed at you.
      </p>
    </div>
  )
}

function UnsurePanel() {
  return (
    <div className="panel">
      <h2 className="h3" style={{ marginTop: 0 }}>
        Unsure in real life?
      </h2>
      <p>
        Check with the person or the company using a number you already trust. {THE_ASSISTANT[0].toUpperCase()}
        {THE_ASSISTANT.slice(1)} can help you think through the next step.
      </p>
      <a className="btn btn-secondary btn-block" href={href('chat')} style={{ marginTop: 20 }}>
        <MessageCircle size={20} aria-hidden="true" /> {ASK_LABEL}
      </a>
    </div>
  )
}

export default function RoleReversal() {
  const { state, start, pick, quit } = useCampaign()
  const [debrief, setDebrief] = useState(false)

  const begin = (c: Campaign | null) => {
    setDebrief(false)
    if (c) start(c)
    else quit()
    window.scrollTo(0, 0)
  }

  const others = state ? CAMPAIGNS.filter((c) => c.id !== state.c.id) : []
  const showDebrief = debrief && !!state?.done

  return (
    <>
      <PageHead
        crumb={<Crumb label="Role Reversal" />}
        title="Role Reversal"
        lead="This time, you play the scammer. Seeing the tricks from the other side makes them easier to spot. No messages or money will be sent."
      />
      <div className="page-grid rr-page">
        <div>
          {!state && <Picker onPick={begin} />}
          {state && !showDebrief && (
            <Play
              s={state}
              onPick={(i) => pick(state.c.scenes[state.scene].ask[i])}
              onRestart={() => begin(state.c)}
              onDebrief={() => {
                setDebrief(true)
                window.scrollTo(0, 0)
              }}
            />
          )}
          {state && showDebrief && <Debrief s={state} onAgain={() => begin(state.c)} onOther={() => begin(null)} />}
        </div>

        <aside className="stack">
          {showDebrief ? (
            <>
              <UnsurePanel />
              {others.length > 0 && (
                <div className="plain">
                  <h2 className="h3">Other stories</h2>
                  <div className="stack con-others">
                    {others.map((c) => (
                      <button key={c.id} className="btn btn-secondary btn-block" onClick={() => begin(c)}>
                        {c.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <WhyPanel />
              <div className="plain watch">
                <h2 className="h3">What to watch for</h2>
                <ul className="watch-list">
                  <li>
                    <Search size={20} strokeWidth={1.5} /> An unfamiliar number or sender
                  </li>
                  <li>
                    <Search size={20} strokeWidth={1.5} /> A request for urgent money
                  </li>
                  <li>
                    <Search size={20} strokeWidth={1.5} /> A reason you can’t call them back
                  </li>
                </ul>
              </div>
              <UnsurePanel />
            </>
          )}
          {state && (
            <button className="btn btn-secondary btn-block" onClick={() => begin(null)}>
              Pick another story
            </button>
          )}
          <BackHome />
        </aside>
      </div>
    </>
  )
}
