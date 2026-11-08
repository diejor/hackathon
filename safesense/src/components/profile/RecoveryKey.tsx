// "Keep your progress": a recovery key instead of an account. The key is the SpacetimeDB identity token
// that lobby.ts keeps in localStorage (stdb.token.<db>). It never leaves this component: not logged, not
// sent, never put in a URL. Pasting a key on another device swaps the token and reloads, so the app
// connects as that identity and shows its progress.
import { useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, Copy, Eye, EyeOff, KeyRound, Undo2 } from 'lucide-react'
import { helpBot } from '../../lib/stdb'

const tokenKey = (db: string) => `stdb.token.${db}`
const backupKey = (db: string) => `safesense.previous-token.${db}`

function readStore(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function writeStore(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/** A token looks like a JWT: three dot-separated base64url parts. */
function looksLikeKey(s: string): boolean {
  return s.length >= 20 && s.length <= 8000 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(s)
}

function useDbName(): string | null {
  const [db, setDb] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    helpBot()
      .then(({ L }) => live && setDb(L.config.db))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])
  return db
}

function SaveKey({ db }: { db: string }) {
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(false)
  const [note, setNote] = useState('')
  const key = open ? readStore(tokenKey(db)) : ''

  if (!open)
    return (
      <button className="btn btn-primary btn-block" onClick={() => setOpen(true)}>
        <KeyRound size={20} /> Show my recovery key
      </button>
    )

  if (!key)
    return (
      <p className="muted" role="status">
        Your key isn’t ready yet. Play a round or wait a moment for the connection, then try again.
      </p>
    )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(key)
      setNote('Copied. Paste it somewhere private, like a password manager or a note only you can see.')
    } catch {
      setShown(true)
      setNote('Copying didn’t work here. Select the key above and copy it yourself.')
    }
  }

  return (
    <div className="recovery-save">
      <div className="feedback caution">
        <p className="feedback-title">
          <AlertTriangle size={20} strokeWidth={1.5} /> Keep it private
        </p>
        <p>
          This key works like a password. Anyone with it can see your progress and your chats with the SafeSense
          assistant, and can delete them. Never share it, even with someone who says they’re from support.
        </p>
      </div>
      <label htmlFor="recovery-key" className="recovery-label">
        Your recovery key
      </label>
      {shown ? (
        <textarea
          id="recovery-key"
          className="recovery-field"
          readOnly
          rows={4}
          value={key}
          onFocus={(e) => e.currentTarget.select()}
        />
      ) : (
        <p id="recovery-key" className="recovery-field recovery-masked" aria-label="Recovery key, hidden">
          {'•'.repeat(24)}
        </p>
      )}
      <div className="recovery-actions">
        <button className="btn btn-secondary" onClick={() => setShown(!shown)} aria-pressed={shown}>
          {shown ? <EyeOff size={20} /> : <Eye size={20} />} {shown ? 'Hide key' : 'Show key'}
        </button>
        <button className="btn btn-primary" onClick={copy}>
          <Copy size={20} /> Copy key
        </button>
      </div>
      {note && (
        <p className="muted small" role="status">
          {note}
        </p>
      )}
    </div>
  )
}

function UseKey({ db }: { db: string }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)

  if (!open)
    return (
      <button className="btn btn-secondary btn-block" onClick={() => setOpen(true)}>
        I have a recovery key
      </button>
    )

  const check = (e: FormEvent) => {
    e.preventDefault()
    const k = draft.replace(/\s+/g, '')
    if (!looksLikeKey(k)) {
      setError('That doesn’t look like a recovery key. Check that you copied all of it, then try again.')
      return
    }
    if (k === readStore(tokenKey(db))) {
      setError('This key is already being used on this device. Nothing to change.')
      return
    }
    setError('')
    setConfirming(true)
  }

  const replace = () => {
    const k = draft.replace(/\s+/g, '')
    const current = readStore(tokenKey(db))
    if (current) writeStore(backupKey(db), current)
    if (!writeStore(tokenKey(db), k)) {
      setConfirming(false)
      setError('This browser won’t save the key. Check that it isn’t in private mode, then try again.')
      return
    }
    window.location.reload()
  }

  return (
    <form className="recovery-use" onSubmit={check}>
      <label htmlFor="paste-key" className="recovery-label">
        Paste your recovery key
      </label>
      <textarea
        id="paste-key"
        className="recovery-field"
        rows={4}
        value={draft}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'paste-key-error' : undefined}
        onChange={(e) => {
          setDraft(e.target.value)
          setError('')
          setConfirming(false)
        }}
      />
      {error && (
        <p id="paste-key-error" className="recovery-error" role="alert">
          {error}
        </p>
      )}
      {confirming ? (
        <div className="feedback caution" role="alert">
          <p className="feedback-title">
            <AlertTriangle size={20} strokeWidth={1.5} /> This replaces the progress on this device
          </p>
          <p>The page will reload and show the progress saved with this key.</p>
          <div className="recovery-actions">
            <button type="button" className="btn btn-primary" onClick={replace}>
              Yes, replace it
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="recovery-actions">
          <button type="submit" className="btn btn-primary">
            Continue
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setOpen(false)
              setDraft('')
              setError('')
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </form>
  )
}

/** Undo a key swap: switch back to the key this device used before. The two keys trade places, so it can be undone too. */
function RestorePrevious({ db }: { db: string }) {
  const [previous] = useState(() => readStore(backupKey(db)))
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  if (!previous || !looksLikeKey(previous) || previous === readStore(tokenKey(db))) return null

  const restore = () => {
    const current = readStore(tokenKey(db))
    if (!writeStore(tokenKey(db), previous)) {
      setConfirming(false)
      setError('This browser won’t switch keys. Check that it isn’t in private mode, then try again.')
      return
    }
    if (current) writeStore(backupKey(db), current)
    window.location.reload()
  }

  if (!confirming)
    return (
      <div>
        <button className="btn btn-secondary btn-block" onClick={() => setConfirming(true)}>
          <Undo2 size={20} aria-hidden="true" /> Restore my previous key
        </button>
        {error && (
          <p className="recovery-error" role="alert">
            {error}
          </p>
        )}
      </div>
    )

  return (
    <div className="feedback caution" role="alert">
      <p className="feedback-title">
        <AlertTriangle size={20} strokeWidth={1.5} /> Go back to the progress this device had before?
      </p>
      <p>
        The page will reload and show the progress saved with your previous key. The key you’re using now is kept,
        so you can switch back the same way.
      </p>
      <div className="recovery-actions">
        <button type="button" className="btn btn-primary" onClick={restore}>
          Yes, restore it
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)} autoFocus>
          Cancel
        </button>
      </div>
    </div>
  )
}

/** Bottom of the profile page: save a recovery key, or bring progress over from another device. */
export function RecoveryKey() {
  const db = useDbName()
  return (
    <section className="card profile-section recovery" aria-labelledby="recovery-title">
      <h2 id="recovery-title" className="h2">
        Keep your progress
      </h2>
      <p className="muted profile-intro">
        There’s no account to remember. If you change phones or clear this browser, a recovery key brings
        your progress back.
      </p>
      {db ? (
        <div className="stack recovery-body">
          <SaveKey db={db} />
          <UseKey db={db} />
          <RestorePrevious db={db} />
        </div>
      ) : (
        <p className="muted" role="status">
          Loading…
        </p>
      )}
    </section>
  )
}
