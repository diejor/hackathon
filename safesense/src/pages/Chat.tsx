import { useRef, useState } from 'react'
import { Gamepad2, HeartHandshake, LockKeyhole, Sparkles } from 'lucide-react'
import { Crumb, PageHead } from '../components/Layout'
import { Composer } from '../components/chat/Composer'
import { Conversation, ExampleChips } from '../components/chat/Conversation'
import { ASSISTANT } from '../components/chat/copy'
import { ForgetMe } from '../components/chat/ForgetMe'
import { useBot } from '../lib/useBot'
import { href } from '../router'
import '../chat.css'

// The conversation is the real Help Bot (web/src/bot/bot.ts over SpacetimeDB, through src/lib/useBot.ts).
// Voice: page copy talks about "SafeSense assistant" by name; the assistant says "I" in its own messages.
export default function Chat() {
  const bot = useBot()
  const [draft, setDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const empty = bot.messages.length === 0 && (bot.status === 'ready' || bot.status === 'reconnecting')

  // Example chips fill the box (never send) so the person can finish the sentence or paste the message.
  const fillExample = (text: string) => {
    setDraft(text)
    const field = textareaRef.current
    if (field) {
      field.focus()
      requestAnimationFrame(() => field.setSelectionRange(text.length, text.length))
    }
  }

  return (
    <div className="chat-page">
      <PageHead crumb={<Crumb label="Ask SafeSense" />} title="Ask before you act." lead="Type it, say it, or add a picture." />
      <div className="page-grid">
        <section className="card" aria-labelledby="chat-title">
          <div className="chat-head">
            <h2 id="chat-title">
              <Sparkles size={20} strokeWidth={1.75} aria-hidden="true" /> {ASSISTANT}
            </h2>
            <p className="chat-ai-note">{ASSISTANT} is an AI. It gives guidance, not guarantees.</p>
          </div>
          <Conversation bot={bot} />
          <Composer bot={bot} draft={draft} setDraft={setDraft} textareaRef={textareaRef} />
          {empty && <ExampleChips onExample={fillExample} />}
          <p className="chat-privacy">
            <LockKeyhole size={16} strokeWidth={1.75} aria-hidden="true" />
            <span>
              Your chat is saved privately on SafeSense’s server; only you can read it here. An AI service (Google
              Gemini) reads your messages to answer. Pictures aren’t stored, only a short note of what they say. Forget
              me deletes your
              chat, what {ASSISTANT} remembers, and your game history.
            </span>
          </p>
        </section>

        <aside className="stack">
          <div className="panel chat-not-alone">
            <HeartHandshake size={28} strokeWidth={1.4} className="icon-muted" />
            <h2 className="h3">You are not alone.</h2>
            <p>Scams can happen to anyone. Ask in your own words, and take it one step at a time.</p>
          </div>
          <div className="plain">
            <LockKeyhole size={24} strokeWidth={1.4} className="icon-muted" />
            <h2 className="h3" style={{ fontSize: '1.3rem' }}>
              Keep private details private
            </h2>
            <p>Please do not share passwords, PINs, full account numbers or one-time codes here.</p>
          </div>
          <div className="panel">
            <h2 className="h3" style={{ marginTop: 0 }}>
              Already sent money?
            </h2>
            <p>Call your bank right away using the number on the back of your card. Tell them you may have been scammed.</p>
          </div>
          <a className="btn btn-secondary btn-block" href={href('home')}>
            <Gamepad2 size={20} strokeWidth={1.5} aria-hidden="true" /> Practice with a game
          </a>
          {/* The design's "Start a new conversation" is left out: the only way to clear the history is Forget me. */}
          <ForgetMe bot={bot} />
        </aside>
      </div>
    </div>
  )
}
