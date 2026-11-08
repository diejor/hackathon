import { useEffect, useState } from 'react'

export type Route = 'home' | 'fraudle' | 'scam-or-not' | 'long-con' | 'chat' | 'profile'

const ROUTES: Route[] = ['home', 'fraudle', 'scam-or-not', 'long-con', 'chat', 'profile']

export const href = (route: Route) => (route === 'home' ? '#/' : `#/${route}`)

function parse(hash: string): Route {
  const slug = hash.replace(/^#\/?/, '') as Route
  return ROUTES.includes(slug) ? slug : 'home'
}

/** Minimal hash router — no backend or server config needed. */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parse(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
