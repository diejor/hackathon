import { ArrowRight, MessagesSquare, ScanSearch, SpellCheck, Sprout } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Crumb, PageHead } from '../components/Layout'
import { SignsGrid } from '../components/profile/SignsGrid'
import { WorthPracticing } from '../components/profile/WorthPracticing'
import { NicknamePanel } from '../components/profile/NicknamePanel'
import { RecoveryKey } from '../components/profile/RecoveryKey'
import { href, type Route } from '../router'
import { useProgress } from '../lib/useProgress'
import { useNickname } from '../lib/profileStore'
import type { Progress } from '../lib/progress'
import { UPCOMING, pointsToGo } from '../content/upcoming'

const GAMES: { route: Route; icon: LucideIcon; label: string }[] = [
  { route: 'scam-or-not', icon: ScanSearch, label: 'Try Scam or Not?' },
  { route: 'fraudle', icon: SpellCheck, label: 'Try Fraudle' },
  { route: 'long-con', icon: MessagesSquare, label: 'Try The Long Con' },
]

function Empty() {
  return (
    <section className="card profile-section profile-empty" aria-labelledby="empty-title">
      <Sprout size={32} strokeWidth={1.4} className="icon-muted" aria-hidden="true" />
      <h2 id="empty-title" className="h2">
        Your progress will grow here
      </h2>
      <p className="muted">
        Play any game, at your own pace. The signs you learn to spot will collect on this page, along with a
        few gentle tips on what is worth another look.
      </p>
      <NextUnlock points={0} />
      <div className="stack profile-empty-actions">
        {GAMES.map(({ route, icon: Icon, label }, i) => (
          <a key={route} className={`btn btn-block ${i === 0 ? 'btn-primary' : 'btn-secondary'}`} href={href(route)}>
            <Icon size={20} /> {label}
          </a>
        ))}
      </div>
    </section>
  )
}

function Summary({ p }: { p: Progress }) {
  const { messages, wordsSolved, stories, days } = p.counts
  const items: [number, string, string][] = [
    [messages, messages === 1 ? 'message looked at' : 'messages looked at', 'Scam or Not?'],
    [wordsSolved, wordsSolved === 1 ? 'word solved' : 'words solved', 'Fraudle'],
    [stories, stories === 1 ? 'Long Con story played' : 'Long Con stories played', 'The Long Con'],
    [days, days === 1 ? 'day practiced' : 'days practiced', 'All games'],
  ]
  return (
    <section className="card profile-section" aria-labelledby="summary-title">
      <h2 id="summary-title" className="sr-only">
        Your practice so far
      </h2>
      <div className="points-row">
        <p className="points-total">
          {p.points} {p.points === 1 ? 'point' : 'points'}
        </p>
        <p className="muted">Points show how much you’ve practiced — there’s no rush.</p>
        {/* A level could appear here later (being designed separately). */}
      </div>
      <NextUnlock points={p.points} />
      <ul className="count-list">
        {items.map(([n, label, game]) => (
          <li key={label} className="count-item">
            <span className="count-n">{n}</span>
            <span className="count-label">{label}</span>
            <span className="sr-only"> ({game})</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** One quiet line about the next locked game, linking to its coming-soon page. */
function NextUnlock({ points }: { points: number }) {
  const toGo = pointsToGo(points)
  return (
    <p className="profile-next-unlock">
      {toGo > 0 ? 'Next unlock: ' : 'Unlocked: '}
      <a href={href('phone-call')}>{UPCOMING.title}</a>
      {toGo > 0 ? ` — ${toGo} ${toGo === 1 ? 'point' : 'points'} to go` : ' — coming soon'}
    </p>
  )
}

function SafetyWords({ words }: { words: string[] }) {
  if (!words.length) return null
  return (
    <section className="card profile-section" aria-labelledby="words-title">
      <h2 id="words-title" className="h2">
        Safety words you’ve solved
      </h2>
      <p className="muted profile-intro">From Fraudle. Each one is a habit worth keeping.</p>
      <ul className="word-chips">
        {words.map((w) => (
          <li key={w} className="chip">
            {w}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function Profile() {
  const { status, progress } = useProgress()
  const name = useNickname()

  return (
    <>
      <PageHead
        crumb={<Crumb label="Your progress" />}
        title="Your progress"
        lead={
          status === 'ready' && progress.events === 0
            ? name
              ? `Hi, ${name}. Play any game and your progress will show up here.`
              : 'Play any game and your progress will show up here.'
            : name
              ? `Hi, ${name}. Here’s what you’ve practiced so far.`
              : 'Here’s what you’ve practiced so far. Take it at your own pace.'
        }
      />
      <div className="page-grid">
        <div className="stack">
          {status === 'loading' && (
            <section className="card profile-section">
              <p className="muted" role="status">
                Loading your progress…
              </p>
            </section>
          )}
          {status === 'offline' && (
            <section className="card profile-section">
              <h2 className="h3">Your progress can’t be shown right now</h2>
              <p className="muted profile-intro">
                It’s still saved. Check your internet connection, then reload the page.
              </p>
            </section>
          )}
          {status === 'ready' && progress.events === 0 && <Empty />}
          {status === 'ready' && progress.events > 0 && (
            <>
              <Summary p={progress} />
              <SignsGrid caught={progress.caught} />
              <WorthPracticing items={progress.practice} genuineMissed={progress.genuineMissed} />
              <SafetyWords words={progress.words} />
            </>
          )}
        </div>
        <aside className="stack profile-aside">
          <NicknamePanel />
          {status === 'ready' && progress.events > 0 && (
            <a className="btn btn-secondary btn-block" href={href('home')}>
              <ArrowRight size={20} /> Pick a game
            </a>
          )}
        </aside>
      </div>
      <div className="profile-bottom">
        <RecoveryKey />
      </div>
    </>
  )
}
