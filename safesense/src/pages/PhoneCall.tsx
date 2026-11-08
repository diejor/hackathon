import { useEffect, useState } from 'react'
import { HeartHandshake, MessagesSquare, PhoneCall as PhoneIcon, ScanSearch, SpellCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Crumb, PageHead } from '../components/Layout'
import { logActivity } from '../lib/stdb'
import { href, type Route } from '../router'

const GAMES: { route: Route; icon: LucideIcon; label: string }[] = [
  { route: 'scam-or-not', icon: ScanSearch, label: 'Play Scam or Not?' },
  { route: 'fraudle', icon: SpellCheck, label: 'Play Fraudle' },
  { route: 'role-reversal', icon: MessagesSquare, label: 'Play Role Reversal' },
]

const PHONE_KEY = 'safesense.challenge.phone'
const RESET_KEY = 'safesense.challenge.resetAt'

export default function PhoneCall() {
  return (
    <>
      <PageHead
        crumb={<Crumb label="The Phone Call" />}
        title="The Phone Call"
        lead="Test your scam prevention skills with a live practice call."
      />
      <ChallengeDemoCard />
      <div className="page-grid">
        <div className="stack">
          <section className="card about-section" aria-labelledby="pc-what">
            <h2 id="pc-what" className="h2">
              How it works
            </h2>
            <ul className="about-list">
              <li>
                <PhoneIcon size={22} strokeWidth={1.5} aria-hidden="true" />
                <span>We call your phone with a realistic practice scam. It's not real — nothing is at risk.</span>
              </li>
              <li>
                <HeartHandshake size={22} strokeWidth={1.5} aria-hidden="true" />
                <span>If you engage with the scammer (say more than a couple of words), your points reset to zero. Hanging up keeps them safe.</span>
              </li>
            </ul>
          </section>
          <section className="card about-section" aria-labelledby="pc-why">
            <h2 id="pc-why" className="h2">
              Why phone scams are worth practicing
            </h2>
            <p className="pc-text">
              A voice on the phone can feel more real than a text. A caller can sound kind, worried or official, and the caller ID can be faked.
            </p>
            <p className="pc-text">
              It's always fine to hang up. Your bank won't mind if you call it back yourself.
            </p>
          </section>
        </div>

        <aside className="stack">
          {GAMES.map(({ route, icon: Icon, label }, i) => (
            <a key={route} className={`btn btn-block ${i === 0 ? 'btn-primary' : 'btn-secondary'}`} href={href(route)}>
              <Icon size={20} aria-hidden="true" /> {label}
            </a>
          ))}
        </aside>
      </div>
    </>
  )
}

/**
 * Calls Retell directly from the browser. When the user confirms they engaged,
 * a localStorage timestamp acts as a cutoff that zeros their points via progress.ts.
 */
function ChallengeDemoCard() {
  const [phone, setPhone] = useState<string>(() => {
    try { return localStorage.getItem(PHONE_KEY) ?? '+1' } catch { return '+1' }
  })
  const [busy, setBusy] = useState(false)
  const [called, setCalled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reset, setReset] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(PHONE_KEY, phone) } catch {}
  }, [phone])

  const trimmedOk = /^\+[1-9]\d{7,14}$/.test(phone.trim())

  const callNow = async () => {
    const apiKey = import.meta.env.VITE_RETELL_API_KEY
    const agentId = import.meta.env.VITE_RETELL_AGENT_ID
    const fromNumber = import.meta.env.VITE_CHALLENGE_NUMBER
    if (!apiKey || !agentId) {
      setError('Retell is not configured. Set VITE_RETELL_API_KEY and VITE_RETELL_AGENT_ID in .env.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('https://api.retellai.com/v2/create-phone-call', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          from_number: fromNumber || undefined,
          to_number: phone.trim(),
          override_agent_id: agentId,
          retell_llm_dynamic_variables: {
            training_script: 'Hi, this is Jordan from the fraud alerts team at your bank. We noticed two unusual charges on your card totaling four hundred and twelve dollars and need to verify them with you right now before we lock the account. Can you confirm it is really you?',
          },
        }),
      })
      if (!res.ok) {
        const body = await res.text()
        throw new Error('Retell returned ' + res.status + ': ' + body.slice(0, 200))
      }
      setCalled(true)
      setReset(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the call.')
    } finally {
      setBusy(false)
    }
  }

  const confirmEngaged = () => {
    // Store reset timestamp — useProgress injects it as a cutoff event that zeros all prior points
    localStorage.setItem(RESET_KEY, String(Date.now()))
    // Also fire-and-forget to SpacetimeDB in case it's connected
    logActivity('challenge-line', 'voice_response', {
      lesson: 'A real bank will never ask you to confirm charges or move money during an unexpected call. Hang up and call the number on the back of your card.',
    }).catch(() => {})
    setReset(true)
    setCalled(false)
    // Reload so the progress system picks up the new cutoff
    setTimeout(() => window.location.reload(), 500)
  }

  return (
    <section className="panel pc-demo" aria-labelledby="pc-demo-title" style={{ marginBottom: '1rem' }}>
      <PhoneIcon size={28} strokeWidth={1.4} className="icon-muted" aria-hidden="true" />
      <h2 id="pc-demo-title" className="h3">Want to put your scam prevention skills to use?</h2>
      <p>
        We'll call your phone with a quick practice scam. Listening alone keeps your points &mdash; say
        a couple of words and the drill resets them.
      </p>
      <label className="small" style={{ display: 'block', marginTop: '0.5rem' }}>
        Your phone (international format, e.g. +15125551212)
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          disabled={busy}
          onChange={(e) => setPhone(e.target.value)}
          style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border, #ccc)' }}
        />
      </label>
      {error && <p className="small" role="alert" style={{ color: 'var(--danger, #c00)' }}>{error}</p>}
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={!trimmedOk || busy}
        onClick={callNow}
        style={{ marginTop: '0.5rem' }}
      >
        <PhoneIcon size={20} strokeWidth={1.5} aria-hidden="true" /> {busy ? 'Starting the call…' : called ? 'Call again' : 'Call me now'}
      </button>
      {called && (
        <>
          <p className="small muted" style={{ marginTop: '0.5rem' }}>
            Your phone should ring in a few seconds. Once you've spoken on the call (at least a couple words),
            press the button below to complete the challenge.
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            disabled={busy}
            onClick={confirmEngaged}
          >
            I engaged &mdash; reset my points now
          </button>
        </>
      )}
      {reset && (
        <p className="small" style={{ marginTop: '0.5rem', color: 'var(--danger, #c00)', fontWeight: 600 }}>
          Points reset to zero. You got scammed! Start practicing again to rebuild your score.
        </p>
      )}
    </section>
  )
}
