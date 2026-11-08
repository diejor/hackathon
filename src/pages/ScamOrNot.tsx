import { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  AtSign,
  Bell,
  Check,
  CheckCircle2,
  Info,
  Lightbulb,
  Mail,
  MessageSquare,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Crumb, PageHead } from '../components/Layout'
import { href } from '../router'

type Guess = 'scam' | 'safe'
type Kind = 'text' | 'email' | 'social' | 'app'

type Scenario = {
  kind: Kind
  /** Who the message appears to come from — shown in the sender profile card. */
  name: string
  /** Avatar initials; left out for unknown senders, who get a generic icon. */
  initials?: string
  /** One short line about the sender, when the format has one (e.g. a social media bio). */
  bio?: string
  /** Whatever the player could see about the sender, shown as small tags. */
  details: string[]
  /** Shown at the top of the message: a number, email address or app name. */
  from: string
  time: string
  subject?: string
  body: string
  link?: string
  answer: Guess
  why: string
  clues: string[]
}

const SCENARIOS: Scenario[] = [
  {
    kind: 'text',
    name: '+44 7700 900123',
    details: ['Not in your contacts', 'Mobile number'],
    from: '+44 7700 900123',
    time: 'Today 9:41',
    body: 'Your parcel could not be delivered. A £1.99 redelivery fee is due. Pay within 24 hours or it will be returned:',
    link: 'parcel-redeliver.example/pay',
    answer: 'scam',
    why: 'Delivery companies rarely ask for small fees by text. The tiny amount is a way to collect your card details.',
    clues: ['A small fee with a deadline', 'A link to pay', 'A personal mobile number, not a company'],
  },
  {
    kind: 'email',
    name: 'Bank Support',
    initials: 'BS',
    details: ['security@account-review.example', 'First email from this address'],
    from: 'security@account-review.example',
    time: 'Today 8:15',
    subject: 'Your account needs attention',
    body: 'We have noticed unusual activity. Your account will be locked in 30 minutes unless you confirm your bank details using the link below.',
    link: 'Confirm my details →',
    answer: 'scam',
    why: 'A short deadline can pressure you to act. Your bank will not ask you to confirm details through a link. Contact them using the number on your card.',
    clues: ['A 30-minute deadline', 'An address that is not your bank', 'A link asking for bank details'],
  },
  {
    kind: 'social',
    name: 'Capt. James Miller',
    initials: 'JM',
    bio: 'Army officer on overseas deployment. Widower. Looking for honest love.',
    details: ['@james.miller.officer8841', 'Joined 2 weeks ago', '9 followers', 'No mutual friends'],
    from: 'Direct message',
    time: 'Yesterday 22:03',
    body: 'Hello dear, your kind smile caught my eye. I am on a peacekeeping mission and feel very lonely. Can we talk privately on another app? I feel we have a special connection.',
    answer: 'scam',
    why: 'This is a common romance scam. A brand-new profile with no shared friends moves fast with affection, then asks to move somewhere more private, where asking for money comes next.',
    clues: [
      'A new profile with few followers and no mutual friends',
      'Strong feelings very quickly',
      'Asks to talk on another app',
    ],
  },
  {
    kind: 'email',
    name: 'Riverside Surgery',
    initials: 'RS',
    details: ['appointments@riverside-surgery.example', 'Your GP surgery'],
    from: 'appointments@riverside-surgery.example',
    time: 'Monday 14:20',
    subject: 'Appointment reminder',
    body: 'This is a reminder of your appointment with Dr Patel on Tuesday at 10:30. If you cannot attend, please call the surgery on the number you usually use.',
    answer: 'safe',
    why: 'This message gives information but asks for nothing: no link, no payment, no personal details. It even tells you to use the number you already have.',
    clues: ['No link or payment', 'No pressure to act quickly', 'Points you to a number you already know'],
  },
  {
    kind: 'text',
    name: '+44 7700 900456',
    details: ['Not in your contacts', 'New number'],
    from: '+44 7700 900456',
    time: 'Today 11:52',
    body: 'Hi Grandma, it’s me. I lost my phone so this is my new number. Can you help with £400 for rent today? I’ll pay you back. Please don’t tell Mum.',
    answer: 'scam',
    why: 'A new number, an urgent request for money and a request for secrecy are classic signs. Call your grandchild on the number you already have.',
    clues: ['A new, unknown number', 'Money needed today', 'Asked to keep it secret'],
  },
  {
    kind: 'social',
    name: 'Margaret Lewis',
    initials: 'ML',
    bio: 'Retired teacher. Gardening, grandchildren and the Riverside book club.',
    details: ['@maggie.lewis', 'Joined 2014', '214 friends', '18 mutual friends'],
    from: 'Direct message',
    time: 'Friday 16:40',
    body: 'Lovely to see you at book club on Thursday! I’ll bring the next book on Monday. Say hello to Tom for me.',
    answer: 'safe',
    why: 'This is a long-standing profile with many shared friends, and the message mentions something you did together. It asks for nothing: no money, no link and no details.',
    clues: ['An older profile with mutual friends', 'Mentions a real, shared event', 'Asks for nothing'],
  },
  {
    kind: 'app',
    name: 'Your bank',
    initials: 'YB',
    details: ['Your banking app'],
    from: 'Banking app',
    time: 'Today 13:05',
    body: 'You paid £32.40 to Greenway Grocers. If this wasn’t you, open your banking app or call the number on the back of your card. We will never ask for your PIN.',
    answer: 'safe',
    why: 'This matches a real purchase, has no link, and sends you to your own app or card. It also reminds you they will never ask for your PIN.',
    clues: ['No link to click', 'Points you to your own app or card', 'Never asks for your PIN'],
  },
]

const FORMAT: Record<Kind, { label: string; icon: LucideIcon }> = {
  text: { label: 'Text message', icon: MessageSquare },
  email: { label: 'Email', icon: Mail },
  social: { label: 'Social media message', icon: AtSign },
  app: { label: 'App notification', icon: Bell },
}

const LABEL: Record<Guess, string> = { scam: 'Scam', safe: 'Not a scam' }
function SenderCard({ s, revealed }: { s: Scenario; revealed: boolean }) {
  const format = FORMAT[s.kind]
  const FormatIcon = format.icon
  return (
    <article className="sender-card" aria-label="Sender">
      <span className="sender-avatar" aria-hidden="true">
        {s.initials ?? <UserRound size={40} strokeWidth={1.3} />}
      </span>
      <div className="sender-info">
        <span className="format-label">
          <FormatIcon size={14} strokeWidth={2} /> {format.label}
        </span>
        <h2 className="sender-name">{s.name}</h2>
        {s.bio && <p className="sender-bio">{s.bio}</p>}
        <ul className="tags">
          {s.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </div>
      {revealed && (
        <span className={`reveal ${s.answer === 'scam' ? 'badge-warn' : 'badge-ok'}`}>
          {s.answer === 'scam' ? <AlertTriangle size={12} strokeWidth={2.5} /> : <ShieldCheck size={12} strokeWidth={2.5} />}{' '}
          {LABEL[s.answer]}
        </span>
      )}
    </article>
  )
}

function MessageCard({ s }: { s: Scenario }) {
  return (
    <article className={`message-card ${s.kind}`} aria-label={FORMAT[s.kind].label}>
        <header className="message-meta">
          <span className="from">{s.from}</span>
          <span className="time">{s.time}</span>
        </header>
        {s.kind === 'email' ? (
          <div className="email-content">
            {s.subject && <h3>{s.subject}</h3>}
            <p>{s.body}</p>
            {s.link && (
              <span className="fake-link" role="presentation">
                {s.link}
              </span>
            )}
          </div>
        ) : (
          <div className="message-bubble">
            {s.body}
            {s.link && (
              <>
                {' '}
                <span className="inline-link">{s.link}</span>
              </>
            )}
          </div>
        )}
    </article>
  )
}

export default function ScamOrNot() {
  const [round, setRound] = useState(0)
  const [guess, setGuess] = useState<Guess | null>(null)

  const s = SCENARIOS[round]
  const revealed = guess !== null
  const correct = guess === s.answer
  const last = round === SCENARIOS.length - 1

  const next = () => {
    setRound(last ? 0 : round + 1)
    setGuess(null)
  }

  return (
    <>
      <PageHead
        crumb={<Crumb label="Scam or not?" />}
        title="Scam or Not?"
        lead="Look closely at each message, then decide: is it a scam or not?"
      />
      <div className="page-grid">
        <section className="game-shell" aria-label="Game">
          <div className="game-top section-top">
            <div
              className="guess-tracker"
              role="img"
              aria-label={`Round ${round + 1} of ${SCENARIOS.length}`}
            >
              {SCENARIOS.map((_, i) => (
                <span key={i} className={`pip ${i < round + (revealed ? 1 : 0) ? 'used' : ''}`} />
              ))}
            </div>
          </div>

          <div className="section play">
            <SenderCard s={s} revealed={revealed} />
            <MessageCard s={s} />

            <div className="verdicts" role="radiogroup" aria-label="Is this a scam?">
              {(['scam', 'safe'] as Guess[]).map((g) => {
                const Icon = g === 'scam' ? ShieldAlert : ShieldCheck
                const state = !revealed ? '' : g === guess ? 'chosen' : 'faded'
                return (
                  <button
                    key={g}
                    role="radio"
                    aria-checked={guess === g}
                    className={`verdict ${g} ${state}`}
                    onClick={() => !revealed && setGuess(g)}
                    disabled={revealed && guess !== g}
                  >
                    <Icon size={24} strokeWidth={2} />
                    <span>{LABEL[g]}</span>
                    {guess === g && <Check size={20} strokeWidth={3} aria-label="Your answer" className="chosen-check" />}
                  </button>
                )
              })}
            </div>

            {revealed && (
              <div className={`feedback ${correct ? '' : 'caution'}`} aria-live="polite">
                <p className="feedback-title">
                  {correct ? <CheckCircle2 size={20} strokeWidth={1.5} /> : <Info size={20} strokeWidth={1.5} />}
                  {correct
                    ? `Well spotted — it ${s.answer === 'scam' ? 'is a scam' : 'is not a scam'}.`
                    : `Good try — this one ${s.answer === 'scam' ? 'is a scam' : 'is not a scam'}.`}
                </p>
                <p>{s.why}</p>
                <p className="clues-title">{s.answer === 'scam' ? 'What gave it away' : 'Why it looks genuine'}</p>
                <ul className="clues">
                  {s.clues.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="section">
            <button className="btn btn-primary btn-block" onClick={next} disabled={!revealed}>
              {last ? <RotateCcw size={20} /> : <ArrowRight size={20} />} {last ? 'Play again' : 'Next round'}
            </button>
          </div>
        </section>

        <aside className="stack" style={{ gap: 16 }}>
          <div className="panel">
            <Lightbulb size={26} strokeWidth={1.4} className="icon-muted" />
            <h2 className="h3">Signs to look for</h2>
            <p>
              Scams often rush you, ask for money or personal details, or come from someone you cannot check. A
              real company will not mind if you hang up and contact them using details you already trust.
            </p>
          </div>
          <a className="btn btn-secondary btn-block" href={href('home')}>
            Leave game
          </a>
        </aside>
      </div>
    </>
  )
}
