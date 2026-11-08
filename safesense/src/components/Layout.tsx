import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { MessageCircle, ShieldCheck, type LucideIcon } from 'lucide-react'
import { ASK_LABEL, THE_ASSISTANT } from './chat/copy'
import { href, type Route } from '../router'
import { usePoints } from '../storage'
import { Mascot } from './Mascot'
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
    <button className="text-size" onClick={next} aria-label={`Text size: ${size}. Select to change.`} title="Text size">
      <span className="aa">Aa</span>
    </button>
  )
}

/**
 * Point total in the header: the number plus the evolving cyborg mascot (replacing the old sprout).
 * It links to the progress page. The total comes from the rounds saved in SpacetimeDB (storage.ts
 * usePoints). The anchor is deliberately NOT keyed by points, so the mascot persists across point
 * changes and can play its evolution burst when a milestone is crossed.
 */
function HeaderPoints({ route }: { route: Route }) {
  const points = usePoints()
  const label = points === null ? 'Your progress' : `Your progress: ${points} ${points === 1 ? 'point' : 'points'}`
  return (
    <a
      className="header-points"
      href={href('profile')}
      aria-current={route === 'profile' ? 'page' : undefined}
      aria-label={label}
      title="Your progress"
    >
      {points === null ? '–' : points.toLocaleString()}
      <Mascot points={points} size={30} compact className="header-mascot" />
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
          <HeaderPoints route={route} />
          <TextSizeButton />
          <a
            className="chat-link"
            href={href('chat')}
            aria-current={route === 'chat' ? 'page' : undefined}
            aria-label={ASK_LABEL}
            title={`Ask ${THE_ASSISTANT}`}
          >
            <MessageCircle size={20} strokeWidth={1.75} aria-hidden="true" />
            <span className="chat-label">{ASK_LABEL}</span>
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
            Practice spotting scams, and ask {THE_ASSISTANT} (an AI) when a message worries you. Made by the
            SafeSense team at HackUTD 2026.
          </p>
        </div>
        <div className="footer-privacy">
          <p className="footer-head">Your privacy</p>
          <p>
            Your chat and game progress are saved privately for you. An AI service (Google Gemini) reads your
            messages to answer. Screenshots and photos aren’t stored.
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

/** Dark green "Back to home" button at the bottom of every minigame's side panel. */
export function BackHome() {
  return (
    <a className="btn btn-primary btn-block" href={href('home')}>
      Back to home
    </a>
  )
}

/** Icon and heading on a single line, used at the top of tip/advice boxes. */
export function TipHead({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="tip-head">
      <Icon size={24} strokeWidth={1.5} className="icon-muted" aria-hidden="true" />
      <h2 className="h3">{children}</h2>
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
