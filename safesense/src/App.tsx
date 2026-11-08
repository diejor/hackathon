import { Layout } from './components/Layout'
import { useEffect } from 'react'
import { AnimatePresence } from 'motion/react'
import { useRoute } from './router'
import { KEYS, save } from './storage'
import { PageTransition } from './components/PageTransition'
import Home from './pages/Home'
import Fraudle from './pages/Fraudle'
import ScamOrNot from './pages/ScamOrNot'
import RoleReversal from './pages/RoleReversal'
import Chat from './pages/Chat'
import Profile from './pages/Profile'
import About from './pages/About'
import PhoneCall from './pages/PhoneCall'

const PAGES = {
  home: Home,
  fraudle: Fraudle,
  'scam-or-not': ScamOrNot,
  'role-reversal': RoleReversal,
  chat: Chat,
  profile: Profile,
  about: About,
  'phone-call': PhoneCall,
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
      {/* mode="wait": the leaving page finishes its exit before the next one animates in. */}
      <AnimatePresence mode="wait" initial={false}>
        <PageTransition key={route}>
          <Page />
        </PageTransition>
      </AnimatePresence>
    </Layout>
  )
}
