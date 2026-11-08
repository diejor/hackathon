import { useEffect, useRef } from 'react'
import type { BotSnapshot } from '../../lib/useBot'
import { Message } from './Message'

// Each chip fills the box with a start the person can finish (or paste the message after).
const EXAMPLES = [
  { label: 'I got a text about a parcel fee', text: 'I got a text about a parcel fee. It says: ' },
  { label: 'Someone called saying they’re my bank', text: 'Someone called saying they’re my bank. They told me ' },
  { label: 'Is this email real?', text: 'Is this email real? Here is what it says: ' },
]

/** The message list: a greeting with example questions when empty, then the real conversation. */
export function Conversation({ bot, onExample }: { bot: BotSnapshot; onExample: (text: string) => void }) {
  const listRef = useRef<HTMLDivElement>(null)
  const { messages, pending, status } = bot
  const last = messages[messages.length - 1]
  const thinking = pending && (!last || last.role.tag === 'User')
  const empty = messages.length === 0

  // Keep the newest message in view when one arrives or the assistant starts thinking.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, thinking])

  return (
    <div ref={listRef} className="messages chat-scroll" role="log" aria-live="polite" aria-label="Messages">
      {empty && status !== 'loading' && status !== 'connecting' && (
        <>
          <div className="bubble chat-bubble">
            <span className="meta">Steady assistant</span>
            <p className="chat-text">
              Hello, I’m here to help you think things through. Tell me about a message, call or email that
              worries you, or add a picture of it. What is on your mind today?
            </p>
          </div>
          <div className="chat-examples" role="group" aria-label="Example questions">
            <span className="chat-examples-label">You could start with:</span>
            {EXAMPLES.map((ex) => (
              <button key={ex.label} type="button" className="chat-example" onClick={() => onExample(ex.text)}>
                {ex.label}
              </button>
            ))}
          </div>
        </>
      )}

      {messages.map((m) => (
        <Message key={String(m.id)} m={m} />
      ))}

      {(status === 'loading' || status === 'connecting') && (
        <p className="chat-note" role="status">
          {bot.slow
            ? 'Still connecting… This is taking longer than usual. Check your internet connection.'
            : 'Connecting to the assistant…'}
        </p>
      )}

      {thinking && (
        <div className="bubble chat-bubble chat-thinking" role="status">
          <span className="meta">Steady assistant</span>
          <span className="chat-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          Thinking…
        </div>
      )}
    </div>
  )
}
