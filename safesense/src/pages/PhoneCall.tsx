import { useState, type FormEvent } from 'react'
import { CircleCheck, HeartHandshake, LockKeyhole, PhoneCall as PhoneIcon, ShieldCheck } from 'lucide-react'
import { BackHome, Crumb, PageHead } from '../components/Layout'
import { UnlockProgress } from '../components/LockedGame'
import { UPCOMING, pointsToGo } from '../content/upcoming'
import { helpBot } from '../lib/stdb'
import { useProgress } from '../lib/useProgress'

/** The same calm line the server gives when calls are off or the number isn't invited (challenge.ts). */
const BETA = 'Phone practice calls are in a private beta right now. Try the games or text SafeSense instead.'
const PHONE_KEY = 'safesense.challenge.phone'

/** The Phone Call: locked until UPCOMING.unlockAt points, then SafeSense can call an invited phone. */
export default function PhoneCall() {
  const { status, progress } = useProgress()
  const toGo = status === 'ready' ? pointsToGo(progress.peak) : null
  const unlocked = toGo === 0

  return (
    <>
      <PageHead
        crumb={<Crumb label={UPCOMING.title} />}
        title={UPCOMING.title}
        lead={unlocked ? 'Get a practice call from SafeSense and see if you can spot the scam.' : 'Keep practicing to unlock a practice call from SafeSense.'}
      />
      <div className="page-grid">
        <div className="stack">
          {unlocked && <CallCard />}
          <section className="card about-section" aria-labelledby="pc-what">
            <h2 id="pc-what" className="h2">
              How it works
            </h2>
            <ul className="about-list">
              {UPCOMING.what.map((line, i) => (
                <li key={i}>
                  {i === 0 ? (
                    <PhoneIcon size={22} strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    <HeartHandshake size={22} strokeWidth={1.5} aria-hidden="true" />
                  )}
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="card about-section" aria-labelledby="pc-why">
            <h2 id="pc-why" className="h2">
              Why phone scams are worth practicing
            </h2>
            {UPCOMING.why.map((line, i) => (
              <p key={i} className="pc-text">
                {line}
              </p>
            ))}
          </section>
        </div>

        <aside className="stack">
          {!unlocked && (
            <div className="panel pc-unlock">
              <LockKeyhole size={28} strokeWidth={1.4} className="icon-muted" aria-hidden="true" />
              <h2 className="h3">Keep practicing to unlock it</h2>
              <p>
                {toGo === null
                  ? `It unlocks at ${UPCOMING.unlockAt} points. Every game you finish earns 1 point.`
                  : `It unlocks at ${UPCOMING.unlockAt} points. Every game you finish earns 1 point, so ${toGo} more ${toGo === 1 ? 'game' : 'games'} to go.`}
              </p>
              <UnlockProgress id="pc-have" />
            </div>
          )}
          <BackHome />
        </aside>
      </div>
    </>
  )
}

/**
 * Asks the server to call this phone (start_challenge_demo). The server only calls invited numbers, a few times
 * a day; anything else comes back as the calm beta line. The result (+1 point) arrives after the call.
 */
function CallCard() {
  const [phone, setPhone] = useState(() => {
    try {
      return localStorage.getItem(PHONE_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [busy, setBusy] = useState(false)
  const [called, setCalled] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const number = phone.trim()
    if (!number) return
    setBusy(true)
    setNote(null)
    try {
      localStorage.setItem(PHONE_KEY, number)
    } catch {
      /* private mode: nothing to remember */
    }
    try {
      const { bot } = await helpBot()
      const why = await bot.startPracticeCall(number)
      if (why === null) setCalled(true)
      else setNote(/practice call|phone number|connected/i.test(why) ? why : BETA)
    } catch {
      setNote(BETA)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel pc-call" aria-labelledby="pc-call-title">
      <ShieldCheck size={28} strokeWidth={1.4} className="icon-muted" aria-hidden="true" />
      <h2 id="pc-call-title" className="h3">
        Get a practice call
      </h2>
      <p>
        SafeSense will ring your phone with a pretend scam call. It’s a practice call from SafeSense: nobody real is
        calling, and nothing is at risk. During the beta it only works for invited numbers.
      </p>
      {called ? (
        <p role="status" className="pc-called">
          <CircleCheck size={20} strokeWidth={1.75} aria-hidden="true" /> Your phone should ring in a few seconds. When
          you’ve hung up, your point shows here and on your profile.
        </p>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="pc-phone" className="ask-name-label pc-label">
            Your phone number <span className="muted">(with country code, like +1 512 555 1212)</span>
          </label>
          <div className="ask-name-row">
            <input
              id="pc-phone"
              className="text-input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              maxLength={24}
              disabled={busy}
              onChange={(e) => setPhone(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={busy || !phone.trim()}>
              <PhoneIcon size={20} strokeWidth={1.5} aria-hidden="true" /> {busy ? 'Starting…' : 'Call me'}
            </button>
          </div>
          {note && (
            <p role="status" className="pc-note">
              {note}
            </p>
          )}
        </form>
      )}
    </section>
  )
}
