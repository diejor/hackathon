import { useRef, useState } from 'react'
import { ArrowUp, HeartHandshake, ImagePlus, LockKeyhole, Mic, MicOff, X } from 'lucide-react'
import { PageHead } from '../components/Layout'

type Msg = { from: 'assistant' | 'me'; time: string; text: string }

const HISTORY: Msg[] = [
  { from: 'assistant', time: '10:15', text: 'Hello, I’m here to help you think things through. What is worrying you today?' },
  { from: 'me', time: '10:16', text: 'A caller said they were my bank. They told me to move my savings to a “safe account”.' },
  {
    from: 'assistant',
    time: '10:16',
    text: 'That is a common scam tactic. Do not move money or share any codes.\n\nEnd the call. Contact your bank using the number on your bank card, ideally from another phone. Do not use a number the caller gave you.',
  },
  { from: 'me', time: '10:18', text: 'I haven’t moved any money. I’ll call the number on my card.' },
  {
    from: 'assistant',
    time: '10:18',
    text: 'Taking time to check is a good step. Your bank can look into what happened. You do not need to stay on the line with the caller.',
  },
]

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>(HISTORY)
  const [draft, setDraft] = useState('')
  const [listening, setListening] = useState(false)
  const [image, setImage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // UI only: the message is shown locally; no reply is generated without a backend.
  const send = () => {
    const text = [draft.trim(), image && `📎 ${image}`].filter(Boolean).join('\n')
    if (!text) return
    setMessages([...messages, { from: 'me', time: now(), text }])
    setDraft('')
    setImage(null)
  }

  return (
    <>
      <PageHead
        crumb="A safe place to ask"
        title="Let’s talk it through."
        lead="Ask a question by speaking, typing, or uploading an image. I can offer guidance, but I cannot confirm that a message or caller is safe."
      />
      <div className="page-grid">
        <section className="card" aria-label="Conversation">
          <div className="chat-head">
            <h2>Conversation history</h2>
            <span className="muted">Today</span>
          </div>
          <div className="messages" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.from === 'me' ? 'mine' : ''}`}>
                <span className="meta">
                  {m.from === 'me' ? 'You' : 'Steady assistant'} · {m.time}
                </span>
                {m.text}
              </div>
            ))}
          </div>

          <div className="composer">
            <button
              className={`btn btn-primary btn-block ${listening ? 'listening' : ''}`}
              onClick={() => setListening(!listening)}
              aria-pressed={listening}
            >
              {listening ? <MicOff size={20} strokeWidth={1.75} /> : <Mic size={20} strokeWidth={1.75} />}
              {listening ? 'Stop microphone' : 'Use microphone'}
            </button>
            <p className="mic-hint" aria-live="polite">
              {listening
                ? 'Microphone is on. Speak when you are ready. Select the button again to stop.'
                : 'Microphone is off. Select the button to start speaking. Your words will appear as text.'}
            </p>

            <label htmlFor="question">Or type your question</label>
            <textarea
              id="question"
              placeholder="What would you like help with?"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            {image && (
              <span className="attachment">
                <ImagePlus size={16} /> {image}
                <button onClick={() => setImage(null)} aria-label="Remove image">
                  <X size={16} />
                </button>
              </span>
            )}

            <div className="composer-actions">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  setImage(e.target.files?.[0]?.name ?? null)
                  e.target.value = ''
                }}
              />
              <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
                <ImagePlus size={20} strokeWidth={1.5} /> Add an image
              </button>
              <button className="btn btn-secondary" onClick={send}>
                <ArrowUp size={20} strokeWidth={1.75} /> Send message
              </button>
            </div>
          </div>
        </section>

        <aside className="stack">
          <div className="panel">
            <HeartHandshake size={28} strokeWidth={1.4} className="icon-muted" />
            <h2 className="h3">You are not alone.</h2>
            <p>Scams can happen to anyone. You can ask a question in your own words. We will take it one step at a time.</p>
          </div>
          <div className="plain">
            <LockKeyhole size={24} strokeWidth={1.4} className="icon-muted" />
            <h2 className="h3" style={{ fontSize: '1.3rem' }}>
              Keep private details private
            </h2>
            <p>Please do not share passwords, PINs, full bank details or one-time codes here.</p>
          </div>
          <div className="panel">
            <h2 className="h3" style={{ marginTop: 0 }}>
              Already sent money?
            </h2>
            <p>Contact your bank straight away using the number on your card. Tell them you may have been scammed.</p>
          </div>
          <button className="btn btn-secondary btn-block" onClick={() => setMessages(HISTORY.slice(0, 1))}>
            Start a new conversation
          </button>
        </aside>
      </div>
    </>
  )
}
