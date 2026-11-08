import { useState, type FormEvent } from 'react'
import { MessageCircle, UserRound } from 'lucide-react'
import { href } from '../../router'
import { MAX_NICKNAME, setNickname, useNickname } from '../../lib/profileStore'

/** Optional nickname (kept on this device) and the "saved here, no account" note. */
export function NicknamePanel() {
  const name = useNickname()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const save = (e: FormEvent) => {
    e.preventDefault()
    setNickname(draft)
    setEditing(false)
  }

  const showForm = editing || !name

  return (
    <div className="panel nickname-panel">
      <UserRound size={28} strokeWidth={1.4} className="icon-muted" aria-hidden="true" />
      {name && !editing && <h2 className="h3">Hi, {name}</h2>}
      {showForm && (
        <form onSubmit={save} className="nickname-form">
          <label htmlFor="nickname" className="h3 nickname-label">
            What should we call you?
          </label>
          <p className="muted small">Optional. Only shown here, on this device.</p>
          <input
            id="nickname"
            className="nickname-input"
            value={draft}
            maxLength={MAX_NICKNAME}
            autoComplete="nickname"
            placeholder="A first name or nickname"
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="nickname-actions">
            <button type="submit" className="btn btn-primary">
              Save
            </button>
            {editing && (
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
      {name && !editing && (
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setDraft(name)
            setEditing(true)
          }}
        >
          Change name
        </button>
      )}
      <p>Your progress is saved on this device. No account needed.</p>
      <a className="btn btn-secondary btn-block" href={href('chat')}>
        <MessageCircle size={20} /> Ask the assistant about my progress
      </a>
    </div>
  )
}
