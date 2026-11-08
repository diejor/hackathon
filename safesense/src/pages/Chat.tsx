import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { LockKeyhole } from 'lucide-react'
import { BackHome, PageHead, TipHead } from '../components/Layout'
import { Composer } from '../components/chat/Composer'
import { Conversation, ExampleChips } from '../components/chat/Conversation'
import { ASSISTANT, THE_ASSISTANT } from '../components/chat/copy'
import { ForgetMe } from '../components/chat/ForgetMe'
import { TextSafeSense } from '../components/chat/TextSafeSense'
import { useBot } from '../lib/useBot'
import { KEYS, load, save, session } from '../storage'
import '../chat.css'

// The conversation is the real Help Bot (web/src/bot/bot.ts over SpacetimeDB, through src/lib/useBot.ts).
// Layout and look are the designer's (design01). Voice: page copy says "the SafeSense assistant"
// (THE_ASSISTANT); the assistant says "I" in its own messages.
export default function Chat() {
  const bot = useBot()
  // A prompt handed over from another page (the dashboard's "How can I improve?") arrives pre-filled, ready
  // to send. It is read once, then cleared, so a reload doesn't bring it back.
  const [draft, setDraft] = useState(() => load(KEYS.chatPrompt, '', session()))
  const [prefilled] = useState(draft !== '')
  useEffect(() => save(KEYS.chatPrompt, null, session()), [])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const empty = bot.messages.length === 0 && (bot.status === 'ready' || bot.status === 'reconnecting')

  // Desktop: the conversation card starts level with the bottom of the side panel and can grow to 1.5x that
  // height before the messages scroll (design01).
  const asideRef = useRef<HTMLElement>(null)
  const [baseHeight, setBaseHeight] = useState<number | null>(null)
  useEffect(() => {
    const aside = asideRef.current
    if (!aside) return
    const ro = new ResizeObserver(() => setBaseHeight(aside.offsetHeight))
    ro.observe(aside)
    return () => ro.disconnect()
  }, [])

  // Desktop, with a conversation: the card is as tall as the side panel (chat.css), which can be taller than
  // the screen. Open it scrolled down once (only if needed), so the latest messages and the text box are on screen.
  const scrolledDown = useRef(false)
  const hasMessages = bot.messages.length > 0
  useEffect(() => {
    if (!hasMessages || scrolledDown.current || !baseHeight) return
    scrolledDown.current = true
    if (!window.matchMedia('(min-width: 961px)').matches) return
    requestAnimationFrame(() =>
      document.querySelector('.chat-card .composer')?.scrollIntoView({ block: 'nearest', behavior: 'instant' }),
    )
  }, [hasMessages, baseHeight])

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
      <PageHead
        crumb="A safe place to ask"
        title="Let’s talk it through."
        lead="Ask a question by speaking, typing, or adding a screenshot or photo." // the card says it's an AI with no guarantees
      />
      <div
        className="page-grid"
        style={baseHeight ? ({ '--chat-base': `${baseHeight}px` } as CSSProperties) : undefined}
      >
        <section className="card chat-card" aria-labelledby="chat-title">
          <div className="chat-head">
            <h2 id="chat-title">Conversation history</h2>
            <p className="chat-ai-note">The {ASSISTANT} is an AI. It gives guidance, not guarantees.</p>
          </div>
          <Conversation bot={bot} />
          <Composer bot={bot} draft={draft} setDraft={setDraft} textareaRef={textareaRef} autoFocus={prefilled} />
          {empty && !prefilled && <ExampleChips onExample={fillExample} />}
          <p className="chat-privacy">
            <LockKeyhole size={16} strokeWidth={1.75} aria-hidden="true" />
            <span>
              Your chat is saved privately on SafeSense’s server; only you can read it here. An AI service (Google
              Gemini) reads your messages to answer. Screenshots and photos aren’t stored, only a short note of what
              they say. Forget me deletes your chat, what {THE_ASSISTANT} remembers, and your game history and
              points.
            </span>
          </p>
        </section>

        <aside className="stack" ref={asideRef}>
          <TextSafeSense bot={bot} />
          <div className="plain">
            <TipHead icon={LockKeyhole}>Keep private details private</TipHead>
            <p>Please do not share passwords, PINs, full account numbers or one-time codes here.</p>
          </div>
          <div className="panel">
            <h2 className="h3" style={{ marginTop: 0 }}>
              Already sent money?
            </h2>
            <p>Call your bank right away using the number on the back of your card. Tell them you may have been scammed.</p>
          </div>
          <BackHome />
          {/* The design's "Start a new conversation" is left out: the only way to clear the history is Forget me. */}
          <ForgetMe bot={bot} />
        </aside>
      </div>
    </div>
  )
}
