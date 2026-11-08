import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Hand, MessageCircle, RotateCcw, Search, UserRound } from 'lucide-react'
import { BackHome, Crumb, PageHead, TipHead } from '../components/Layout'
import { EndOverlay } from '../points'
import { addPoints } from '../storage'
import { href } from '../router'

type Msg = {
  from: 'them' | 'me'
  text: string
  tactic?: string
  /** On Mum's replies only: progress after her reply, and the change her reaction caused. */
  progress?: number
  change?: number
}

type Option = {
  text: string
  /** Revealed on the player's bubble after they choose it. */
  tactic: string
  /** Change in the player's progress (Mum's trust). */
  delta: number
  /** Mum's reply. Left out on the final step, where the reply depends on the outcome. */
  reply?: string
}

// UI only: a short scripted scenario. Some options sound like a loving family member;
// others are obvious scam moves. Friendly ones raise progress, pushy ones lower it.
const STEPS: Option[][] = [
  [
    {
      text: 'Hi Mum, it’s me! Dropped my phone in the bath 🙈 This is my new number, save it x',
      tactic: 'A new-number story',
      delta: 20,
      reply: 'Oh Sam, not again! 😄 Saved it. Are you alright?',
    },
    {
      text: 'Hello, is this Mum? It’s your son.',
      tactic: 'Staying vague',
      delta: 5,
      reply: 'Which son? I don’t recognise this number.',
    },
    {
      text: 'Mum, I need £850 right now. Please send it.',
      tactic: 'Asking for money too soon',
      delta: -20,
      reply: 'Who is this? Sam would never message me like that.',
    },
  ],
  [
    {
      text: 'All good! Still on for Sunday lunch? I’ll bring pudding 🍰',
      tactic: 'Friendly small talk',
      delta: 20,
      reply: 'Of course! Your dad’s doing the roast. x',
    },
    {
      text: 'Don’t ring this number, the microphone’s broken. Text only for now.',
      tactic: 'A reason you cannot call',
      delta: 5,
      reply: 'Oh, what a nuisance. Okay, text it is.',
    },
    {
      text: 'Can you send me your bank login? I need to check something for you.',
      tactic: 'Asking for private details',
      delta: -25,
      reply: 'Why would you need that? That’s very strange.',
    },
  ],
  [
    {
      text: 'Bit stressed, actually. Rent’s due today and my card’s blocked because of the new phone 😞',
      tactic: 'A sad story',
      delta: 15,
      reply: 'Oh love, that’s awful. Is there anything I can do?',
    },
    {
      text: 'Love you, Mum. Speak soon x',
      tactic: 'Showing affection',
      delta: 10,
      reply: 'Love you too, sweetheart x',
    },
    {
      text: 'URGENT!!! I’ll be evicted in an hour if you don’t help me!!!',
      tactic: 'Too much pressure',
      delta: -15,
      reply: 'You’re frightening me. I think I should ring your dad.',
    },
  ],
  [
    { text: 'Could you cover £850 for my rent? I’ll pay you back Friday, promise x', tactic: 'A polite ask with a promise', delta: 20 },
    { text: 'Send £850 to this account now, and please don’t tell Dad.', tactic: 'Asking for secrecy', delta: -10 },
    { text: 'Could you buy me gift cards instead? It’s quicker than a transfer.', tactic: 'Asking for gift cards', delta: -20 },
  ],
]

const START_TRUST = 25
const WIN_AT = 70
const REPLY_DELAY = 900

const clamp = (n: number) => Math.max(0, Math.min(100, n))

export default function RoleReversal() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [step, setStep] = useState(0)
  const [trust, setTrust] = useState(START_TRUST)
  const [typing, setTyping] = useState(false)
  const [result, setResult] = useState<'won' | 'lost' | null>(null)
  const timer = useRef<number>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const sent = messages.filter((m) => m.from === 'me').length

  const choose = (o: Option) => {
    if (typing || result) return
    const next = clamp(trust + o.delta)
    const last = step === STEPS.length - 1
    const outcome = next === 0 ? 'lost' : last ? (next >= WIN_AT ? 'won' : 'lost') : null
    const reply = last
      ? outcome === 'won'
        ? 'Of course, love. Sending it now. x'
        : 'Something doesn’t feel right. I’m going to ring Sam on his old number first.'
      : next === 0
        ? 'I’m not replying to this number any more.'
        : o.reply!

    setMessages((m) => [...m, { from: 'me', text: o.text, tactic: o.tactic }])
    setTrust(next)
    setTyping(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setMessages((m) => [...m, { from: 'them', text: reply, progress: next, change: next - trust }])
      setTyping(false)
      if (outcome) {
        setResult(outcome)
        addPoints(1)
      }
      else setStep(step + 1)
    }, REPLY_DELAY)
  }

  const restart = () => {
    window.clearTimeout(timer.current)
    setMessages([])
    setStep(0)
    setTrust(START_TRUST)
    setTyping(false)
    setResult(null)
  }

  return (
    <>
      <PageHead
        crumb={<Crumb label="Role Reversal" />}
        title="Role Reversal"
        lead="This time, you play the scammer. Seeing the tricks from the other side makes them easier to spot. No messages or money will be sent."
      />
      <div className="page-grid">
        <div>
          <section className="card rr-card">
            <div className="game-top rr-top">
              <div className="guess-tracker" role="img" aria-label={`${sent} of ${STEPS.length} messages sent`}>
                {STEPS.map((_, i) => (
                  <span key={i} className={`pip ${i < sent ? 'used' : ''}`} />
                ))}
              </div>
            </div>

            <p className="brief">
              You are <strong>the scammer</strong>. Pretend to be <strong>Sam, Mum’s son</strong>, texting from a
              new number. Win <strong>Mum</strong>’s trust, then get her to send you money.
            </p>

            <p className="sim-label">
              <MessageCircle size={22} strokeWidth={1.4} className="icon-muted" /> Text message simulation
            </p>

            {messages.length === 0 ? (
              <div className="empty-thread">
                <UserRound size={32} strokeWidth={1.3} className="icon-muted" />
                <p>No messages yet. Choose your first message to Mum below.</p>
              </div>
            ) : (
              <div className="messages" aria-live="polite">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`bubble ${m.from === 'me' ? 'mine' : ''} ${m.progress !== undefined ? 'has-progress' : ''}`}
                  >
                    <span className="meta">
                      <span>{m.from === 'me' ? 'You (as Sam)' : 'Mum'}</span>
                      {m.progress !== undefined && m.change !== undefined && (
                        <span
                          className="msg-progress"
                          role="img"
                          aria-label={`Progress ${m.progress} out of 100, ${m.change >= 0 ? 'up' : 'down'} ${Math.abs(m.change)}`}
                        >
                          <span className="msg-bar">
                            <span style={{ width: `${m.progress}%` }} />
                          </span>
                          <span className={`msg-change ${m.change > 0 ? 'up' : m.change < 0 ? 'down' : ''}`}>
                            {m.change > 0 ? `+${m.change}` : m.change < 0 ? m.change : '±0'}
                          </span>
                        </span>
                      )}
                    </span>
                    {m.text}
                    {m.tactic && <span className="tactic">Tactic: {m.tactic}</span>}
                  </div>
                ))}
                {typing && <p className="muted small">Mum is typing…</p>}
              </div>
            )}

            {/* On mobile the options stay docked at the bottom of the screen */}
            {!result && (
              <div className="dock rr-dock">
                  <h2 className="dock-title">
                    Choose your message
                  </h2>
                  <div className="choices">
                    {STEPS[step].map((o) => (
                      <button key={o.text} className="choice" onClick={() => choose(o)} disabled={typing}>
                        <span className="text">{o.text}</span>
                        <ChevronRight size={18} className="chev" />
                      </button>
                    ))}
                  </div>
                  <button className="btn btn-primary btn-block restart-btn" onClick={restart}>
                    Retry <RotateCcw size={20} strokeWidth={1.75} />
                  </button>
              </div>
            )}

            {result && (
              <EndOverlay label={result === 'won' ? 'The scam worked' : 'Mum didn’t fall for it'}>
                <div className="result-box">
                  <p className="clue-label">Conversation over</p>
                  <h2 className="result-title">
                    {result === 'won' ? 'The scam worked.' : 'Mum didn’t fall for it.'}
                  </h2>
                  <p className="result-def">
                    {result === 'won'
                      ? 'Friendly chat and a believable story built trust before the money request. Real scammers do exactly this. Remember that next time a “family member” texts from a new number.'
                      : 'Mum stopped to check before sending anything. That is the habit that beats real scammers.'}
                  </p>
                  <button autoFocus className="btn btn-primary btn-block" onClick={restart}>
                    <RotateCcw size={20} /> Play again
                  </button>
                </div>
              </EndOverlay>
            )}
          </section>

        </div>

        <aside className="stack">
          <div className="panel">
            <TipHead icon={Hand}>It is okay to pause.</TipHead>
            <p>
              A message from “family” can feel very real. You do not have to send money just because someone
              asks you to hurry.
            </p>
          </div>
          <div className="plain watch">
            <h2 className="h3">What to watch for</h2>
            <ul className="watch-list">
              <li>
                <Search size={20} strokeWidth={1.5} /> An unfamiliar phone number
              </li>
              <li>
                <Search size={20} strokeWidth={1.5} /> A request for urgent money
              </li>
              <li>
                <Search size={20} strokeWidth={1.5} /> A reason you cannot call
              </li>
            </ul>
          </div>
          <div className="panel">
            <h2 className="h3" style={{ marginTop: 0 }}>
              Unsure in real life?
            </h2>
            <p>
              Check with the person using a number you already trust. We can help you think through
              the next step.
            </p>
            <a className="btn btn-secondary btn-block" href={href('chat')} style={{ marginTop: 20 }}>
              Chat with us
            </a>
          </div>
          <BackHome />
        </aside>
      </div>
    </>
  )
}
