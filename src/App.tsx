import { Layout } from './components/Layout'
import { useEffect } from 'react'
import { useRoute } from './router'
import { KEYS, save } from './storage'
import Home from './pages/Home'
import Fraudle from './pages/Fraudle'
import ScamOrNot from './pages/ScamOrNot'
import RoleReversal from './pages/RoleReversal'
import Chat from './pages/Chat'

const PAGES = {
  home: Home,
  fraudle: Fraudle,
  'scam-or-not': ScamOrNot,
  'role-reversal': RoleReversal,
  chat: Chat,
}

export default function App() {
  const route = useRoute()
  const Page = PAGES[route]

  // Remember the last minigame opened, for the dashboard's "Last played" link.
  useEffect(() => {
    if (route === 'fraudle' || route === 'scam-or-not' || route === 'role-reversal') save(KEYS.lastPlayed, route)
  }, [route])
  return (
    <Layout route={route}>
      <Page key={route} />
    </Layout>
  )
}
