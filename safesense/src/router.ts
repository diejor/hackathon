import { useEffect, useState } from 'react'

export type Route = 'home' | 'fraudle' | 'scam-or-not' | 'role-reversal' | 'chat' | 'profile' | 'about' | 'phone-call'

const ROUTES: Route[] = ['home', 'fraudle', 'scam-or-not', 'role-reversal', 'chat', 'profile', 'about', 'phone-call']

/** Old links keep working: The Long Con was renamed Role Reversal. */
const ALIASES: Record<string, Route> = { 'long-con': 'role-reversal' }

/** The browser tab title for each page, so screen readers and tab lists say where you are. */
const TITLES: Record<Route, string> = {
  home: 'SafeSense · Practice spotting scams',
  fraudle: 'Fraudle · SafeSense',
  'scam-or-not': 'Scam or Not? · SafeSense',
  'role-reversal': 'Role Reversal · SafeSense',
  chat: 'Ask SafeSense · SafeSense',
  profile: 'Your progress · SafeSense',
  about: 'About SafeSense',
  'phone-call': 'The Phone Call (coming soon) · SafeSense',
}

export const href = (route: Route) => (route === 'home' ? '#/' : `#/${route}`)

function parse(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '')
  const slug = (ALIASES[raw] ?? raw) as Route
  return ROUTES.includes(slug) ? slug : 'home'
}

/** After moving to a new page, put focus on its heading so screen readers announce it. */
function focusHeading() {
  window.requestAnimationFrame(() => {
    const h1 = document.querySelector<HTMLElement>('main h1')
    if (!h1) return
    if (!h1.hasAttribute('tabindex')) h1.setAttribute('tabindex', '-1')
    h1.focus({ preventScroll: true })
  })
}

/** Minimal hash router — no backend or server config needed. */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parse(window.location.hash))
      window.scrollTo(0, 0)
      focusHeading()
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  useEffect(() => {
    document.title = TITLES[route]
  }, [route])
  return route
}
