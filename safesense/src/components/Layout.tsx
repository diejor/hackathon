import { useEffect, useState, type ReactNode } from 'react'
import { MessageCircle, ShieldCheck, Sprout } from 'lucide-react'
import { href, type Route } from '../router'
import { useProgress } from '../lib/useProgress'
import '../profile.css'

const SIZES = ['normal', 'large', 'larger'] as const
type Size = (typeof SIZES)[number]

function TextSizeButton() {
  const [size, setSize] = useState<Size>(() => {
    try {
      return (localStorage.getItem('text-size') as Size) || 'normal'
    } catch {
      return 'normal'
    }
  })

  useEffect(() => {
    document.documentElement.dataset.text = size
    try {
      localStorage.setItem('text-size', size)
    } catch {
      /* storage unavailable */
    }
  }, [size])

  const next = () => setSize(SIZES[(SIZES.indexOf(size) + 1) % SIZES.length])

  return (
    <button className="text-size" onClick={next} aria-label={`Text size: ${size}. Select to change.`}>
      <span className="aa">Aa</span> <span className="text-size-label">Text size</span>
    </button>
  )
}

/** "Your progress", with a quiet points chip once the player has some. */
function ProgressLink({ route }: { route: Route }) {
  const { status, progress } = useProgress()
  const points = status === 'ready' && progress.points > 0 ? progress.points : null
  return (
    <a
      className="progress-link"
      href={href('profile')}
      aria-current={route === 'profile' ? 'page' : undefined}
      aria-label={points === null ? 'Your progress' : `Your progress, ${points} points`}
    >
      <Sprout size={20} strokeWidth={1.75} aria-hidden="true" />
      <span className="progress-label">Your progress</span>
      {points !== null && (
        <span className="points-chip" aria-hidden="true">
          {points}
        </span>
      )}
    </a>
  )
}

function Header({ route }: { route: Route }) {
  return (
    <header className="header">
      <div className="container header-inner">
        {/* The logo is the way home on every page */}
        <a className="brand" href={href('home')} aria-label="SafeSense home">
          <span className="brand-mark">
            <ShieldCheck size={22} strokeWidth={1.75} />
          </span>
          <span className="brand-name">SafeSense</span>
        </a>
        <div className="header-actions">
          <TextSizeButton />
          <ProgressLink route={route} />
          <a
            className="chat-link"
            href={href('chat')}
            aria-current={route === 'chat' ? 'page' : undefined}
            aria-label="Chat with us"
          >
            <MessageCircle size={20} strokeWidth={1.75} />
            <span className="chat-label">Chat with us</span>
          </a>
        </div>
      </div>
    </header>
  )
}

function Footer({ note }: { note?: string }) {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span>{note ?? 'Learn at your own pace.'}</span>
        <span className="footer-tag">SafeSense · A little practice, more confidence.</span>
      </div>
    </footer>
  )
}

export function Layout({ route, children }: { route: Route; children: ReactNode }) {
  return (
    <div className="app">
      <Header route={route} />
      <main>
        <div className="container">{children}</div>
      </main>
      <Footer />
    </div>
  )
}

export function PageHead({
  crumb,
  title,
  lead,
}: {
  crumb: ReactNode
  title: string
  lead: string
}) {
  return (
    <div className="page-head">
      <div className="eyebrow">{crumb}</div>
      <h1 className="page-title">{title}</h1>
      <p className="lead">{lead}</p>
    </div>
  )
}

export function Crumb({ label }: { label: string }) {
  return (
    <>
      <a href={href('home')}>Home</a> &nbsp;/&nbsp; {label}
    </>
  )
}
