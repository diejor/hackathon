import { useEffect, useState, type ReactNode } from 'react'
import { MessageCircle, ShieldCheck, Sprout, type LucideIcon } from 'lucide-react'
import { href, type Route } from '../router'
import { usePoints } from '../storage'

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

/** Point total in the header: just the number and a sprout. Re-read on every page change. */
function HeaderPoints() {
  const points = usePoints()
  return (
    <span key={points} className="header-points" role="img" aria-label={`${points} ${points === 1 ? 'point' : 'points'}`}>
      {points.toLocaleString()}
      <Sprout size={24} strokeWidth={1.5} aria-hidden="true" />
    </span>
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
          <HeaderPoints />
          <TextSizeButton />
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
