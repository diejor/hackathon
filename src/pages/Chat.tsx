import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowUp, HeartHandshake, MessageCircle, ImagePlus, LockKeyhole, Mic, MicOff, X } from 'lucide-react'
import { PageHead, TipHead } from '../components/Layout'
import { KEYS, load, save, session } from '../storage'

type Msg = { from: 'assistant' | 'me'; time: string; text: string }

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([])

  // Desktop: the conversation card starts level with the bottom of the side panel (ending at
  // "Start a new conversation") and can grow to 1.5x that height before the messages scroll.
  const asideRef = useRef<HTMLElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const [baseHeight, setBaseHeight] = useState<number | null>(null)
  useEffect(() => {
    const aside = asideRef.current
    if (!aside) return
    const ro = new ResizeObserver(() => setBaseHeight(aside.offsetHeight))
    ro.observe(aside)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    const el = messagesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])
  // A prompt handed over from another page (e.g. the dashboard) arrives pre-filled, ready to send.
  const [draft, setDraft] = useState(() => load(KEYS.chatPrompt, '', session()))
  const [prefilled] = useState(draft !== '')
  useEffect(() => save(KEYS.chatPrompt, null, session()), [])
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
      <div
        className="page-grid"
        style={baseHeight ? ({ '--chat-base': `${baseHeight}px` } as CSSProperties) : undefined}
      >
        <section className="card chat-card" aria-label="Conversation">
          <div className="chat-head">
            <h2>Conversation history</h2>
            <span className="muted">Today</span>
          </div>
          <div className="messages" ref={messagesRef} aria-live="polite">
            {messages.length === 0 && (
              <div className="empty-thread">
                <MessageCircle size={32} strokeWidth={1.3} className="icon-muted" />
                <p>No messages yet. Ask your first question below.</p>
              </div>
            )}
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
            {image && (
              <span className="attachment" style={{ marginTop: 0, marginBottom: 12 }}>
                <ImagePlus size={16} /> {image}
                <button onClick={() => setImage(null)} aria-label="Remove image">
                  <X size={16} />
                </button>
              </span>
            )}

            <div className="composer-row">
              <label htmlFor="question" className="sr-only">
                Type your question
              </label>
              <textarea
                autoFocus={prefilled}
                id="question"
                rows={1}
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
              <button
                className={`icon-btn ${listening ? 'listening' : ''}`}
                onClick={() => setListening(!listening)}
                aria-pressed={listening}
                aria-label={listening ? 'Stop microphone' : 'Use microphone'}
                title={listening ? 'Stop microphone' : 'Use microphone'}
              >
                {listening ? <MicOff size={22} strokeWidth={1.75} /> : <Mic size={22} strokeWidth={1.75} />}
              </button>
              <button
                className="icon-btn"
                onClick={() => fileRef.current?.click()}
                aria-label="Add an image or screenshot"
                title="Add an image or screenshot"
              >
                <ImagePlus size={22} strokeWidth={1.5} />
              </button>
              <button className="icon-btn primary" onClick={send} aria-label="Send message" title="Send message">
                <ArrowUp size={22} strokeWidth={2} />
              </button>
            </div>
            {listening && (
              <p className="mic-hint" aria-live="polite">
                Microphone is on. Speak when you are ready. Select the microphone again to stop.
              </p>
            )}
          </div>
        </section>

        <aside className="stack" ref={asideRef}>
          <div className="panel">
            <TipHead icon={HeartHandshake}>You are not alone.</TipHead>
            <p>Scams can happen to anyone. You can ask a question in your own words. We will take it one step at a time.</p>
          </div>
          <div className="plain">
            <TipHead icon={LockKeyhole}>Keep private details private</TipHead>
            <p>Please do not share passwords, PINs, full bank details or one-time codes here.</p>
          </div>
          <div className="panel">
            <h2 className="h3" style={{ marginTop: 0 }}>
              Already sent money?
            </h2>
            <p>Contact your bank straight away using the number on your card. Tell them you may have been scammed.</p>
          </div>
          <button className="btn btn-secondary btn-block" onClick={() => setMessages([])}>
            Start a new conversation
          </button>
        </aside>
      </div>
    </>
  )
}
