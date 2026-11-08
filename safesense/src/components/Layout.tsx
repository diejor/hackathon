import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { MessageCircle, ShieldCheck, Sprout } from 'lucide-react'
import { ASSISTANT } from './chat/copy'
import { href, type Route } from '../router'
import { useProgress } from '../lib/useProgress'
import '../profile.css'

const SIZES = ['normal', 'large', 'larger'] as const
type Size = (typeof SIZES)[number]
const SIZE_NAMES: Record<Size, string> = { normal: 'Normal', large: 'Large', larger: 'Larger' }

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
      <span className="aa" aria-hidden="true">
        Aa
      </span>{' '}
      <span className="text-size-label" aria-hidden="true">
        Text: {SIZE_NAMES[size]}
      </span>
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
          <span className="brand-mark" aria-hidden="true">
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
            aria-label="Ask SafeSense"
            title={`Ask the ${ASSISTANT}`}
          >
            <MessageCircle size={20} strokeWidth={1.75} aria-hidden="true" />
            <span className="chat-label">Ask SafeSense</span>
          </a>
        </div>
      </div>
    </header>
  )
}

/** "Forget me" sits at the bottom of the Ask SafeSense page: open that page, then bring the button into view. */
function goToForgetMe(e: MouseEvent<HTMLAnchorElement>) {
  e.preventDefault()
  window.location.hash = href('chat')
  window.setTimeout(() => {
    const box = document.querySelector<HTMLElement>('.chat-forget')
    if (!box) return
    box.scrollIntoView({ block: 'center' })
    box.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })
  }, 400)
}

/** What SafeSense is, who made it, and an honest note on where your data goes. */
function Footer({ route }: { route: Route }) {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-about">
          <p className="footer-brand">
            <ShieldCheck size={18} strokeWidth={1.75} aria-hidden="true" /> SafeSense
          </p>
          <p>
            Practice spotting scams, and ask the {ASSISTANT} (an AI) when a message worries you. Made by the
            SafeSense team at HackUTD 2026.
          </p>
        </div>
        <div className="footer-privacy">
          <p className="footer-head">Your privacy</p>
          <p>
            Your chat and game progress are saved privately for you. An AI service (Google Gemini) reads your
            messages to answer. Screenshots aren’t stored.
          </p>
        </div>
        <nav className="footer-links" aria-label="About and privacy">
          <a href={href('about')} aria-current={route === 'about' ? 'page' : undefined}>
            About SafeSense
          </a>
          <a href={href('chat')} onClick={goToForgetMe}>
            Delete my data (Forget me)
          </a>
        </nav>
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
      <Footer route={route} />
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
