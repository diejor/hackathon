import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { ArrowUp, ImagePlus, Loader2, Mic, MicOff, Square, TriangleAlert, X } from 'lucide-react'
import { botActions, type BotSnapshot } from '../../lib/useBot'
import { createDictation, voiceSupported, type Dictation } from '../../../../web/src/bot/voice'
import { ASSISTANT, THE_ASSISTANT } from './copy'

const MAX_CHARS = 4000 // must match the server (Bot.cs MaxBotTextChars)

/** Reword the server's terse messages for the page. */
function friendly(error: string): string {
  if (/^slow down/i.test(error)) return 'One moment, please. You can send another message in a few seconds.'
  if (/^not connected/i.test(error)) return `The ${ASSISTANT} is still connecting. Try again in a moment.`
  return error
}

function statusNote(bot: BotSnapshot): string | null {
  if (bot.status === 'reconnecting') return 'The connection dropped. Reconnecting… Your conversation is safe.'
  if (bot.status === 'offline')
    return `Can’t reach ${THE_ASSISTANT} right now. Check your internet connection, then reload the page.`
  return null
}

export function Composer({
  bot,
  draft,
  setDraft,
  textareaRef,
  autoFocus = false,
}: {
  bot: BotSnapshot
  draft: string
  setDraft: Dispatch<SetStateAction<string>>
  textareaRef: RefObject<HTMLTextAreaElement | null>
  /** Focus the box on load (when a prompt was handed over, ready to send). */
  autoFocus?: boolean
}) {
  // The image is converted to the exact JPEG that will be sent as soon as it's picked, so problems
  // (HEIC photos, files a phone won't let us read) show up right away, not on Send.
  const [image, setImage] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const imageSeq = useRef(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const [voice] = useState(() => ({ ok: voiceSupported(), secure: window.isSecureContext }))
  const [listening, setListening] = useState(false)
  const dictation = useRef<Dictation | null>(null)

  useEffect(() => {
    const field = textareaRef.current
    if (!field || !voice.ok) return
    const d = createDictation(field, {
      onText: () => setDraft(field.value),
      onState: () => setListening(d.active),
      onError: (msg) => botActions.showError(msg),
    })
    dictation.current = d
    return () => {
      d.cancel()
      dictation.current = null
    }
  }, [textareaRef, setDraft, voice.ok])

  const ready = bot.status === 'ready'
  const canSend = ready && !bot.pending && !preparing && (draft.trim().length > 0 || !!image)

  async function attach(file: Blob | null) {
    const seq = ++imageSeq.current
    setImage(null)
    setImageFailed(false)
    setPreparing(!!file)
    botActions.clearError()
    if (!file) return
    try {
      const url = await botActions.toJpegDataUrl(file)
      if (seq === imageSeq.current) setImage(url)
    } catch (e) {
      if (seq !== imageSeq.current) return
      setImageFailed(true)
      botActions.showError(e instanceof Error ? e.message : String(e))
    } finally {
      if (seq === imageSeq.current) setPreparing(false)
    }
  }

  async function submit() {
    if (!canSend) return
    dictation.current?.cancel() // don't let late speech land in the cleared box
    const text = draft
    const img = image
    setDraft('')
    void attach(null)
    const seq = imageSeq.current
    const ok = await botActions.send(text, img ?? undefined)
    if (!ok) {
      // Rejected before it was stored (rate limit, offline): give the draft back; the error stays on the page.
      setDraft((d) => d || text)
      if (img && seq === imageSeq.current) setImage(img) // no newer image was picked meanwhile
    }
  }

  const note = statusNote(bot)
  const error = bot.error ? friendly(bot.error) : null

  let micHint: string
  if (!voice.ok)
    micHint = voice.secure
      ? 'Speaking isn’t available in this browser. You can type your question instead.'
      : 'The microphone only works on a secure (https) page. You can type your question instead.'
  else if (!ready && !listening) micHint = `The microphone will be ready once ${THE_ASSISTANT} connects.`
  else if (listening) micHint = 'Microphone is on. Speak when you are ready. Select the microphone again to stop.'
  else micHint = 'Select the microphone and talk. Your words will appear in the box.'

  // The designer's composer (design01): one row with the text box and three square buttons (speak, add a
  // picture, send). The picture preview sits above the row; alerts and the microphone note below it.
  const sendLabel = bot.pending ? 'Waiting for an answer…' : 'Send message'
  const micLabel = !voice.ok ? 'Microphone not available' : listening ? 'Stop the microphone' : 'Speak your question'
  return (
    <div className="composer">
      {(image || preparing || imageFailed) && (
        <span className={`attachment chat-preview ${imageFailed ? 'chat-preview-failed' : ''}`}>
          {image && <img src={image} alt="Your picture, ready to send" />}
          {preparing && <Loader2 size={16} className="chat-spin" aria-hidden="true" />}
          {imageFailed && <TriangleAlert size={16} aria-hidden="true" />}
          <span>{image ? 'Picture ready to send' : preparing ? 'Preparing your picture…' : 'Picture not added'}</span>
          <button type="button" onClick={() => void attach(null)} aria-label="Remove picture">
            <X size={16} />
          </button>
        </span>
      )}

      <div className="composer-row">
        <label htmlFor="question" className="sr-only">
          Your question
        </label>
        <textarea
          id="question"
          ref={textareaRef}
          rows={1}
          autoFocus={autoFocus}
          placeholder={listening ? 'Listening…' : 'What would you like help with?'}
          value={draft}
          maxLength={MAX_CHARS}
          enterKeyHint="send"
          onChange={(e) => {
            setDraft(e.target.value)
            if (bot.error) botActions.clearError()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void submit()
            }
          }}
          onPaste={(e) => {
            const item = [...e.clipboardData.items].find(
              (i) => i.kind === 'file' && (!i.type || i.type.startsWith('image/')),
            )
            const file = item?.getAsFile()
            if (!file) return
            void attach(file)
            if (!e.clipboardData.getData('text/plain')) e.preventDefault()
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void attach(f)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          className={`icon-btn ${listening ? 'listening' : ''}`}
          onClick={() => {
            botActions.clearError()
            dictation.current?.toggle()
          }}
          aria-pressed={listening}
          aria-label={micLabel}
          aria-describedby="mic-hint"
          title={micLabel}
          disabled={!voice.ok || !ready}
        >
          {!voice.ok ? (
            <MicOff size={22} strokeWidth={1.75} />
          ) : listening ? (
            <Square size={20} strokeWidth={2} />
          ) : (
            <Mic size={22} strokeWidth={1.75} />
          )}
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => fileRef.current?.click()}
          disabled={!ready || bot.pending}
          aria-label="Add a screenshot or photo"
          title="Add a screenshot or photo"
        >
          <ImagePlus size={22} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className="icon-btn primary chat-send"
          onClick={() => void submit()}
          disabled={!canSend}
          aria-label={sendLabel}
          title={sendLabel}
        >
          {bot.pending ? <Loader2 size={22} className="chat-spin" /> : <ArrowUp size={22} strokeWidth={2} />}
        </button>
      </div>

      {(error || note) && (
        <div className="chat-alert" role="alert">
          <TriangleAlert size={20} strokeWidth={1.75} aria-hidden="true" />
          <div>
            {note && <p>{note}</p>}
            {error && <p>{error}</p>}
          </div>
        </div>
      )}

      {/* Shown while the microphone is on (or can't be used); always there for screen readers. */}
      <p id="mic-hint" className={`mic-hint ${listening || !voice.ok ? '' : 'sr-only'}`} aria-live="polite">
        {micHint}
      </p>
    </div>
  )
}
