import { useEffect, useRef, useState, type FormEvent } from 'react'
import { MAX_NICKNAME, setNickname } from '../lib/profileStore'

/**
 * The designer's popup for changing the display name (from design01's Home). Used on the dashboard and on
 * the profile page; both read and write the same name (lib/profileStore.ts).
 */
export function NameDialog({ current, onClose, skipLabel = 'Cancel' }: { current: string; onClose: () => void; skipLabel?: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState(current)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setNickname(value)
    onClose()
  }

  return (
    <dialog ref={ref} className="name-dialog" aria-labelledby="name-dialog-title" onClose={onClose}>
      <form onSubmit={submit}>
        <h2 id="name-dialog-title" className="h3">
          What would you like to be called?
        </h2>
        <label htmlFor="display-name" className="muted">
          Optional. Your name is only shown on this device.
        </label>
        <input
          id="display-name"
          className="text-input"
          value={value}
          maxLength={MAX_NICKNAME}
          autoComplete="given-name"
          placeholder="A first name or nickname"
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            {skipLabel}
          </button>
          <button type="submit" className="btn btn-primary btn-sm">
            Save name
          </button>
        </div>
      </form>
    </dialog>
  )
}
