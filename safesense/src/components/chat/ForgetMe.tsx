import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { botActions, type BotSnapshot } from '../../lib/useBot'
import { ASSISTANT } from './copy'

/** "Forget me": deletes the conversation, what the assistant remembers and game activity, after an in-page confirm. */
export function ForgetMe({ bot }: { bot: BotSnapshot }) {
  const [step, setStep] = useState<'idle' | 'confirm' | 'busy' | 'done'>('idle')
  const ready = bot.status === 'ready'
  const nothing = !bot.messages.length && !bot.facts.length && !bot.activityCount

  // When the confirm closes, put focus back where the person was (the button, or the "Done" note)
  // instead of letting it fall to <body>.
  const buttonRef = useRef<HTMLButtonElement>(null)
  const doneRef = useRef<HTMLParagraphElement>(null)
  const restoreFocus = useRef(false)
  useEffect(() => {
    if (!restoreFocus.current || (step !== 'idle' && step !== 'done')) return
    restoreFocus.current = false
    ;(step === 'done' ? doneRef.current : buttonRef.current)?.focus()
  }, [step])

  if (step === 'confirm' || step === 'busy')
    return (
      <div className="chat-confirm" role="alertdialog" aria-labelledby="forget-title" aria-describedby="forget-text">
        <h2 id="forget-title" className="h3">
          Delete everything?
        </h2>
        <p id="forget-text">
          This deletes this conversation, your game history and everything {ASSISTANT} remembers about you. It can’t
          be undone.
        </p>
        {bot.facts.length > 0 && (
          <>
            <p className="chat-confirm-sub">What {ASSISTANT} remembers:</p>
            <ul>
              {bot.facts.map((f) => (
                <li key={String(f.id)}>{f.fact}</li>
              ))}
            </ul>
          </>
        )}
        <div className="chat-confirm-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              restoreFocus.current = true
              setStep('idle')
            }}
            disabled={step === 'busy'}
            autoFocus
          >
            Keep my history
          </button>
          <button
            type="button"
            className="btn chat-btn-danger"
            disabled={step === 'busy' || !ready}
            onClick={async () => {
              setStep('busy')
              const ok = await botActions.forgetMe()
              restoreFocus.current = true
              setStep(ok ? 'done' : 'idle')
            }}
          >
            {step === 'busy' ? 'Deleting…' : 'Yes, delete everything'}
          </button>
        </div>
      </div>
    )

  return (
    <div className="chat-forget">
      {step === 'done' && (
        <p ref={doneRef} className="chat-done" role="status" tabIndex={-1}>
          Done. Your conversation, game history and what {ASSISTANT} remembered have been deleted.
        </p>
      )}
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => setStep('confirm')}
        disabled={!ready || (step === 'done' && nothing)}
      >
        <Trash2 size={20} strokeWidth={1.5} /> Forget me
      </button>
      <p className="chat-forget-sub">Deletes this conversation, your game history and what {ASSISTANT} remembers.</p>
    </div>
  )
}
