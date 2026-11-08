import { Gamepad2, HeartHandshake, LockKeyhole, MessageCircle, Phone, Users } from 'lucide-react'
import { Crumb, PageHead } from '../components/Layout'
import { ASK_LABEL, ASSISTANT, THE_ASSISTANT } from '../components/chat/copy'
import { href } from '../router'

/** About SafeSense: what it is, who made it, and what happens to your data. Kept short and plain. */
export default function About() {
  return (
    <>
      <PageHead
        crumb={<Crumb label="About" />}
        title="About SafeSense"
        lead="A calm place to practice spotting scams, and to ask when something doesn’t feel right."
      />
      <div className="page-grid">
        <div className="stack">
          <section className="card about-section" aria-labelledby="about-what">
            <h2 id="about-what" className="h2">
              What it is
            </h2>
            <ul className="about-list">
              <li>
                <Gamepad2 size={22} strokeWidth={1.5} aria-hidden="true" />
                <span>
                  <strong>Three short games</strong> to practice with: Fraudle, Scam or Not? and Role Reversal. The
                  people and companies in them are made up. No messages or money are ever sent.
                </span>
              </li>
              <li>
                <MessageCircle size={22} strokeWidth={1.5} aria-hidden="true" />
                <span>
                  <strong>The {ASSISTANT}</strong> is an AI. Tell it about a message that worries you: type it, say
                  it, or add a screenshot or photo. It explains what it notices and what you could do next. It gives
                  guidance, not guarantees, and it can be wrong.
                </span>
              </li>
              <li>
                <HeartHandshake size={22} strokeWidth={1.5} aria-hidden="true" />
                <span>
                  <strong>Points</strong> are a gentle tally of how much you’ve practiced: 1 point for every game
                  you finish. There’s no race and no timer.
                </span>
              </li>
            </ul>
          </section>

          <section className="card about-section" aria-labelledby="about-privacy">
            <h2 id="about-privacy" className="h2">
              Your privacy
            </h2>
            <ul className="about-list">
              <li>
                <LockKeyhole size={22} strokeWidth={1.5} aria-hidden="true" />
                <span>
                  There’s no account. Your chat and game progress are saved privately for you on SafeSense’s
                  server, linked to this browser. A recovery key on <a href={href('profile')}>Your progress</a> lets
                  you bring them to another device.
                </span>
              </li>
              <li>
                <MessageCircle size={22} strokeWidth={1.5} aria-hidden="true" />
                <span>
                  To answer you, the messages you send to {THE_ASSISTANT} are read by an AI service (Google Gemini).
                  Screenshots and photos aren’t stored; only a short note of what they say is kept.
                </span>
              </li>
              <li>
                <LockKeyhole size={22} strokeWidth={1.5} aria-hidden="true" />
                <span>
                  Please don’t share passwords, PINs, full account numbers or one-time codes.{' '}
                  <strong>Forget me</strong>, at the bottom of the <a href={href('chat')}>{ASK_LABEL}</a> page,
                  deletes your chat, what {THE_ASSISTANT} remembers, and your game history and points.
                </span>
              </li>
            </ul>
          </section>

          <section className="card about-section" aria-labelledby="about-team">
            <h2 id="about-team" className="h2">
              Who made it
            </h2>
            <p className="about-text">
              <Users size={22} strokeWidth={1.5} aria-hidden="true" />
              <span>Made by the SafeSense team at HackUTD 2026.</span>
            </p>
          </section>
        </div>

        <aside className="stack">
          <div className="panel">
            <Phone size={28} strokeWidth={1.4} className="icon-muted" aria-hidden="true" />
            <h2 className="h3">Already sent money or details?</h2>
            <p>
              Call your bank right away, using the number on the back of your card. You can also report a scam to
              the FTC at <span className="nowrap">ReportFraud.ftc.gov</span>.
            </p>
          </div>
          <a className="btn btn-primary btn-block" href={href('chat')}>
            <MessageCircle size={20} aria-hidden="true" /> {ASK_LABEL}
          </a>
          <a className="btn btn-secondary btn-block" href={href('home')}>
            <Gamepad2 size={20} strokeWidth={1.5} aria-hidden="true" /> Practice with a game
          </a>
        </aside>
      </div>
    </>
  )
}
