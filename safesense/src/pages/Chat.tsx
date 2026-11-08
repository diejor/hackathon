import { useRef, useState } from 'react'
import { HeartHandshake, LockKeyhole } from 'lucide-react'
import { PageHead } from '../components/Layout'
import { Composer } from '../components/chat/Composer'
import { Conversation } from '../components/chat/Conversation'
import { ForgetMe } from '../components/chat/ForgetMe'
import { useBot } from '../lib/useBot'
import '../chat.css'

// The conversation is the real Help Bot (web/src/bot/bot.ts over SpacetimeDB, through src/lib/useBot.ts).
export default function Chat() {
  const bot = useBot()
  const [draft, setDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
            <span className="muted">Only you can see this</span>
          </div>
          <Conversation bot={bot} onExample={fillExample} />
          <Composer bot={bot} draft={draft} setDraft={setDraft} textareaRef={textareaRef} />
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
            <p>Please do not share passwords, PINs, full account numbers or one-time codes here.</p>
          </div>
          <div className="panel">
            <h2 className="h3" style={{ marginTop: 0 }}>
              Already sent money?
            </h2>
            <p>Call your bank right away using the number on the back of your card. Tell them you may have been scammed.</p>
          </div>
          {/* The design's "Start a new conversation" is left out: the only way to clear the history is Forget me. */}
          <ForgetMe bot={bot} />
        </aside>
      </div>
    </>
  )
}
