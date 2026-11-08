import { useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Info,
  Landmark,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  VenetianMask,
} from 'lucide-react'
import { Crumb, PageHead } from '../components/Layout'
import { href } from '../router'
import { logActivity } from '../lib/stdb'
import { SCENARIOS, TACTICS, type Scenario } from '../content/longCon'

type Msg = { from: 'them' | 'me'; time: string; text: string }

const LETTERS = ['A', 'B', 'C']
const ICONS = { 'new-number-hi-mom': Smartphone, 'bank-fraud-alert': Landmark } as Record<string, typeof Smartphone>

function Picker({ onPick }: { onPick: (s: Scenario) => void }) {
  return (
    <section className="respond lc-picker">
      <h2 className="h3">Pick a scenario</h2>
      <p className="muted">You write the scammer’s messages. A made-up person replies.</p>
      <div className="choices">
        {SCENARIOS.map((s) => {
          const Icon = ICONS[s.id] ?? Smartphone
          return (
            <button key={s.id} className="choice lc-scenario" onClick={() => onPick(s)}>
              <span className="text">
                <span className="chip">
                  <Icon size={16} strokeWidth={1.75} /> {s.chip}
                </span>
                <strong className="lc-scenario-title">{s.title}</strong>
                <span className="lc-scenario-pitch">{s.pitch}</span>
              </span>
              <ChevronRight size={18} className="chev" />
            </button>
          )
        })}
      </div>
    </section>
  )
}

function Debrief({
  scenario,
  picks,
  onAgain,
  onOther,
}: {
  scenario: Scenario
  picks: number[]
  onAgain: () => void
  onOther: () => void
}) {
  const moves = picks.map((p, i) => scenario.steps[i].moves[p])
  const fooled = moves[moves.length - 1].works
  const name = scenario.target.split(' ')[0]
  return (
    <section className="card lc-debrief" aria-labelledby="debrief-title">
      <h2 id="debrief-title" className="h2">
        {fooled ? `${name} was fooled, this time.` : `${name} paused and checked.`}
      </h2>
      <p className="lc-end">{fooled ? scenario.fooledEnd : scenario.caughtEnd}</p>

      <h3 className="h3 lc-moves-title">The moves you used</h3>
      <ol className="lc-moves">
        {moves.map((m, i) => (
          <li key={i}>
            <div className="lc-move-head">
              <span className="muted">Step {i + 1}</span>
              <strong>{TACTICS[m.tactic].name}</strong>
              <span className={m.works ? 'badge-warn' : 'badge-ok'}>{m.works ? 'It worked' : 'Spotted'}</span>
            </div>
            <p className="lc-move-text">“{m.text}”</p>
            <p>
              <strong>How a careful person spots it: </strong>
              {TACTICS[m.tactic].spot}
            </p>
          </li>
        ))}
      </ol>

      <div className="panel lc-motto">
        <ShieldCheck size={28} strokeWidth={1.4} className="icon-muted" />
        <p className="lc-motto-lead">If this happens to you:</p>
        <p className="motto">Pause. Check. Then act.</p>
        <p>Call the person or the bank on a number you already trust. You are allowed to slow down and say no.</p>
      </div>

      <div className="stack lc-actions">
        <a className="btn btn-primary btn-block" href={href('chat')}>
          <MessageCircle size={20} /> Talk it through with us
        </a>
        <button className="btn btn-secondary btn-block" onClick={onAgain}>
          <RotateCcw size={20} /> Play this scenario again
        </button>
        <button className="btn btn-secondary btn-block" onClick={onOther}>
          <ArrowRight size={20} /> Try the other scenario
        </button>
      </div>
    </section>
  )
}

export default function LongCon() {
  const [scenario, setScenario] = useState<Scenario | null>(null)
  /** The move picked at each step so far. */
  const [picks, setPicks] = useState<number[]>([])
  /** The step being played; equals picks.length - 1 while its reply is on screen. */
  const [step, setStep] = useState(0)

  const start = (s: Scenario | null) => {
    setScenario(s)
    setPicks([])
    setStep(0)
    window.scrollTo(0, 0)
  }

  const done = scenario !== null && step >= 3
  const answered = picks.length > step

  const pick = (i: number) => {
    if (!scenario || answered) return
    setPicks([...picks, i])
  }

  const next = () => {
    if (!scenario) return
    if (step === 2) {
      const moves = picks.map((p, i) => scenario.steps[i].moves[p])
      void logActivity('long-con', 'round_done', {
        scenario: scenario.id,
        tactics: moves.map((m) => m.tactic),
        fooled: moves[2].works,
      })
      window.scrollTo(0, 0)
    }
    setStep(step + 1)
  }

  const messages: Msg[] = scenario
    ? picks.flatMap((p, i) => {
        const m = scenario.steps[i].moves[p]
        const [mine, theirs] = scenario.times[i]
        return [
          { from: 'me' as const, time: mine, text: m.text },
          { from: 'them' as const, time: theirs, text: m.reply },
        ]
      })
    : []

  const current = scenario && !done ? scenario.steps[step] : null
  const lastMove = scenario && answered ? scenario.steps[step].moves[picks[step]] : null
  const Icon = scenario ? (ICONS[scenario.id] ?? Smartphone) : Smartphone

  return (
    <>
      <PageHead
        crumb={<Crumb label="The Long Con" />}
        title="The Long Con"
        lead="You play the scammer, in a safe space. No messages or money will be sent."
      />
      <div className="page-grid">
        <div>
          {!scenario && <Picker onPick={start} />}

          {scenario && (
            <>
              <div className="scenario-top">
                <span className="chip">
                  <Icon size={16} strokeWidth={1.75} /> {scenario.chip}
                </span>
                <span className="muted">{done ? 'Debrief' : `Step ${step + 1} of 3`}</span>
              </div>

              {done ? (
                <Debrief
                  scenario={scenario}
                  picks={picks}
                  onAgain={() => start(scenario)}
                  onOther={() => start(SCENARIOS.find((s) => s.id !== scenario.id) ?? null)}
                />
              ) : (
                <>
                  <section className="card">
                    <p className="sim-label">
                      <MessageCircle size={22} strokeWidth={1.4} className="icon-muted" /> {scenario.channel}
                    </p>
                    {messages.length === 0 ? (
                      <p className="muted lc-empty">
                        {scenario.target.split(' ')[0]} is a made-up person. Choose your first message below.
                      </p>
                    ) : (
                      <div className="messages" aria-live="polite">
                        {messages.map((m, i) => (
                          <div key={i} className={`bubble ${m.from === 'me' ? 'mine' : ''}`}>
                            <span className="meta">
                              {m.from === 'me' ? scenario.playerAs : scenario.target} · {m.time}
                            </span>
                            {m.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {current && !answered && (
                    <section className="respond">
                      <h2 className="h3">
                        Step {step + 1} of 3: {current.title}
                      </h2>
                      <p className="muted">Choose your move. Each one is a tactic real scammers use.</p>
                      <div className="choices">
                        {current.moves.map((m, i) => (
                          <button key={i} className="choice" onClick={() => pick(i)}>
                            <span className="letter">{LETTERS[i]}</span>
                            <span className="text">
                              <span className="lc-tactic">{TACTICS[m.tactic].name}</span>
                              {m.text}
                            </span>
                            <ChevronRight size={18} className="chev" />
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {lastMove && (
                    <section className="respond">
                      <div className={`feedback ${lastMove.works ? 'caution' : ''}`} aria-live="polite">
                        <p className="feedback-title">
                          {lastMove.works ? <Info size={20} strokeWidth={1.5} /> : <CheckCircle2 size={20} strokeWidth={1.5} />}
                          {TACTICS[lastMove.tactic].name}
                        </p>
                        <p>{lastMove.note}</p>
                      </div>
                      <button className="btn btn-primary btn-block lc-next" onClick={next}>
                        <ArrowRight size={20} /> {step === 2 ? 'See the debrief' : 'Next step'}
                      </button>
                    </section>
                  )}

                  <button className="btn btn-secondary btn-block lc-restart" onClick={() => start(null)}>
                    Choose a different scenario
                  </button>
                </>
              )}
            </>
          )}
        </div>

        <aside className="stack">
          <div className="panel">
            <VenetianMask size={28} strokeWidth={1.4} className="icon-muted" />
            <h2 className="h3">You are playing the scammer.</h2>
            <p>
              This is practice. Seeing how a scam is put together, one move at a time, makes it easier to
              spot one aimed at you.
            </p>
          </div>
          <div className="plain">
            <h2 className="h3">What careful people do</h2>
            <ul className="watch-list">
              <li>
                <ShieldCheck size={20} strokeWidth={1.5} /> Call back on a number they already trust
              </li>
              <li>
                <ShieldCheck size={20} strokeWidth={1.5} /> Ask something only the real person would know
              </li>
              <li>
                <ShieldCheck size={20} strokeWidth={1.5} /> Never pay with gift cards or wire transfers in a hurry
              </li>
            </ul>
          </div>
          <div className="panel">
            <h2 className="h3" style={{ marginTop: 0 }}>
              Unsure in real life?
            </h2>
            <p>
              Check with the person using a number you already trust. We can help you think through the next
              step.
            </p>
            <a className="btn btn-secondary btn-block" href={href('chat')} style={{ marginTop: 20 }}>
              Chat with us
            </a>
          </div>
        </aside>
      </div>
    </>
  )
}
