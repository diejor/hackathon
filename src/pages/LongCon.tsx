import { useState } from 'react'
import { ChevronRight, Hand, MessageCircle, Search, Smartphone } from 'lucide-react'
import { Crumb, PageHead } from '../components/Layout'
import { href } from '../router'

type Msg = { from: 'them' | 'me'; time: string; text: string }

const START: Msg[] = [
  { from: 'them', time: '10:42', text: 'Hi Mum, it’s me. My phone broke, so this is my new number.' },
  { from: 'me', time: '10:43', text: 'Is this you, Emma?' },
  {
    from: 'them',
    time: '10:44',
    text: 'Yes! I need £850 for an urgent bill. Please send it now. Don’t call — my microphone isn’t working.',
  },
]

const OPTIONS = [
  { letter: 'A', text: 'I’ll call Emma on the number I already know.' },
  { letter: 'B', text: 'Send me the bank details. I’ll pay now.' },
  { letter: 'C', text: 'Tell me more about the bill.' },
]

export default function LongCon() {
  const [picked, setPicked] = useState<string | null>(null)

  const messages: Msg[] = picked
    ? [...START, { from: 'me', time: '10:45', text: OPTIONS.find((o) => o.letter === picked)!.text }]
    : START

  return (
    <>
      <PageHead
        crumb={<Crumb label="The Long Con" />}
        title="The Long Con"
        lead="Try a conversation in a safe space. No messages or money will be sent."
      />
      <div className="page-grid">
        <div>
          <div className="scenario-top">
            <span className="chip">
              <Smartphone size={16} strokeWidth={1.75} /> A new number
            </span>
            <span className="muted">Step 2 of 3</span>
          </div>

          <section className="card">
            <p className="sim-label">
              <MessageCircle size={22} strokeWidth={1.4} className="icon-muted" /> Text message simulation
            </p>
            <div className="messages" aria-live="polite">
              {messages.map((m, i) => (
                <div key={i} className={`bubble ${m.from === 'me' ? 'mine' : ''}`}>
                  <span className="meta">
                    {m.from === 'me' ? 'You' : 'Unknown number'} · {m.time}
                  </span>
                  {m.text}
                </div>
              ))}
            </div>
          </section>

          <section className="respond">
            <h2 className="h3">How would you respond?</h2>
            <p className="muted">Choose what you would do next.</p>
            <div className="choices">
              {OPTIONS.map((o) => (
                <button
                  key={o.letter}
                  className={`choice ${picked === o.letter ? 'picked' : ''}`}
                  aria-pressed={picked === o.letter}
                  onClick={() => setPicked(o.letter)}
                >
                  <span className="letter">{o.letter}</span>
                  <span className="text">{o.text}</span>
                  <ChevronRight size={18} className="chev" />
                </button>
              ))}
              <button className="btn btn-secondary btn-block" style={{ marginTop: 10 }} onClick={() => setPicked(null)}>
                Start this conversation again
              </button>
            </div>
          </section>
        </div>

        <aside className="stack">
          <div className="panel">
            <Hand size={28} strokeWidth={1.4} className="icon-muted" />
            <h2 className="h3">It is okay to pause.</h2>
            <p>
              A message from “family” can feel very real. You do not have to send money just because someone
              asks you to hurry.
            </p>
          </div>
          <div className="plain">
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
        </aside>
      </div>
    </>
  )
}
