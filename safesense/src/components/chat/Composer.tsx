import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { ArrowUp, ImagePlus, Loader2, Mic, MicOff, TriangleAlert, X } from 'lucide-react'
import { botActions, type BotSnapshot } from '../../lib/useBot'
import { createDictation, voiceSupported, type Dictation } from '../../../../web/src/bot/voice'

const MAX_CHARS = 4000 // must match the server (Bot.cs MaxBotTextChars)

/** Reword the server's terse messages for the page. */
function friendly(error: string): string {
  if (/^slow down/i.test(error)) return 'One moment, please. You can send another message in a few seconds.'
  if (/^not connected/i.test(error)) return 'The assistant is still connecting. Try again in a moment.'
  return error
}

function statusNote(bot: BotSnapshot): string | null {
  if (bot.status === 'reconnecting') return 'The connection dropped. Reconnecting… Your conversation is safe.'
  if (bot.status === 'offline')
    return 'Can’t reach the assistant right now. Check your internet connection, then reload the page.'
  return null
}

export function Composer({
  bot,
  draft,
  setDraft,
  textareaRef,
}: {
  bot: BotSnapshot
  draft: string
  setDraft: Dispatch<SetStateAction<string>>
  textareaRef: RefObject<HTMLTextAreaElement | null>
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
      ? 'Voice input isn’t available in this browser. You can type your question instead.'
      : 'The microphone only works on a secure (https) page. You can type your question instead.'
  else if (listening) micHint = 'Microphone is on. Speak when you are ready. Select the button again to stop.'
  else micHint = 'Microphone is off. Select the button to start speaking. Your words will appear as text.'

  return (
    <div className="composer">
      <button
        type="button"
        className={`btn btn-primary btn-block ${listening ? 'listening' : ''}`}
        onClick={() => {
          botActions.clearError()
          dictation.current?.toggle()
        }}
        aria-pressed={listening}
        disabled={!voice.ok || !ready}
      >
        {listening || !voice.ok ? <MicOff size={20} strokeWidth={1.75} /> : <Mic size={20} strokeWidth={1.75} />}
        {!voice.ok ? 'Microphone unavailable' : listening ? 'Stop microphone' : 'Use microphone'}
      </button>
      <p className="mic-hint" aria-live="polite">
        {micHint}
      </p>

      <label htmlFor="question">Or type your question</label>
      <textarea
        id="question"
        ref={textareaRef}
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

      {(image || preparing || imageFailed) && (
        <span className={`attachment chat-preview ${imageFailed ? 'chat-preview-failed' : ''}`}>
          {image && <img src={image} alt="Your image, ready to send" />}
          {preparing && <Loader2 size={16} className="chat-spin" aria-hidden="true" />}
          {imageFailed && <TriangleAlert size={16} aria-hidden="true" />}
          <span>{image ? 'Image ready to send' : preparing ? 'Preparing your image…' : 'Image not added'}</span>
          <button type="button" onClick={() => void attach(null)} aria-label="Remove image">
            <X size={16} />
          </button>
        </span>
      )}

      {(error || note) && (
        <div className="chat-alert" role="alert">
          <TriangleAlert size={20} strokeWidth={1.75} aria-hidden="true" />
          <div>
            {note && <p>{note}</p>}
            {error && <p>{error}</p>}
          </div>
        </div>
      )}

      <div className="composer-actions">
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
          className="btn btn-secondary"
          onClick={() => fileRef.current?.click()}
          disabled={!ready || bot.pending}
        >
          <ImagePlus size={20} strokeWidth={1.5} /> Add an image
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => void submit()} disabled={!canSend}>
          <ArrowUp size={20} strokeWidth={1.75} /> {bot.pending ? 'Waiting for an answer…' : 'Send message'}
        </button>
      </div>
      <p className="chat-footnote">Answers are guidance, not a guarantee. When in doubt, call the company on a number you trust.</p>
    </div>
  )
}
