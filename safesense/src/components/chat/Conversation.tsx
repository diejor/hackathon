import { useEffect, useRef } from 'react'
import { MessageCircle } from 'lucide-react'
import type { BotSnapshot } from '../../lib/useBot'
import { ASSISTANT, THE_ASSISTANT } from './copy'
import { Message } from './Message'

// Each chip fills the box with a start the person can finish (or paste the message after).
const EXAMPLES = [
  {
    label: 'I got a text about a package delivery fee',
    text: 'I got a text about a package delivery fee. It says: ',
  },
  { label: 'Someone called saying they’re my bank', text: 'Someone called saying they’re my bank. They told me ' },
  { label: 'Is this email real?', text: 'Is this email real? Here is what it says: ' },
]

/** Example questions, shown under the text box while the conversation is empty. */
export function ExampleChips({ onExample }: { onExample: (text: string) => void }) {
  return (
    <div className="chat-examples" role="group" aria-labelledby="chat-examples-label">
      <span id="chat-examples-label" className="chat-examples-label">
        Or start with one of these:
      </span>
      {EXAMPLES.map((ex) => (
        <button key={ex.label} type="button" className="chat-example" onClick={() => onExample(ex.text)}>
          {ex.label}
        </button>
      ))}
    </div>
  )
}

/** The message list: a short greeting when empty, then the real conversation. */
export function Conversation({ bot }: { bot: BotSnapshot }) {
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
    <div
      ref={listRef}
      className={`messages chat-scroll${empty ? ' chat-scroll-empty' : ''}`}
      role="log"
      aria-live="polite"
      aria-label="Messages"
      // Scrollable regions must be reachable by keyboard.
      tabIndex={empty ? undefined : 0}
    >
      {/* The designer's empty thread (design01), carrying the assistant's greeting. */}
      {empty && status !== 'loading' && status !== 'connecting' && (
        <div className="empty-thread chat-empty">
          <MessageCircle size={32} strokeWidth={1.3} className="icon-muted" aria-hidden="true" />
          <p className="chat-text">
            Hello, I’m the SafeSense assistant. Tell me about a message, call or email that worries you, or add a
            screenshot or photo of it.
          </p>
        </div>
      )}

      {messages.map((m) => (
        <Message key={String(m.id)} m={m} />
      ))}

      {status !== 'ready' && (
        <p className="chat-note" role="status">
          {status === 'offline'
            ? `Can’t reach ${THE_ASSISTANT} right now. Check your internet connection, then reload the page.`
            : status === 'reconnecting'
              ? 'The connection dropped. Reconnecting…'
              : bot.slow
                ? 'Still connecting… This is taking longer than usual. Check your internet connection.'
                : `Connecting to ${THE_ASSISTANT}…`}
        </p>
      )}

      {thinking && (
        <div className="bubble chat-bubble chat-thinking" role="status">
          <span className="meta">{ASSISTANT}</span>
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
