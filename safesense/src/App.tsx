import { Layout } from './components/Layout'
import { useRoute } from './router'
import Home from './pages/Home'
import Fraudle from './pages/Fraudle'
import ScamOrNot from './pages/ScamOrNot'
import LongCon from './pages/LongCon'
import Chat from './pages/Chat'
import Profile from './pages/Profile'

const PAGES = {
  home: Home,
  fraudle: Fraudle,
  'scam-or-not': ScamOrNot,
  'long-con': LongCon,
  chat: Chat,
  profile: Profile,
}

export default function App() {
  const route = useRoute()
  const Page = PAGES[route]
  return (
    <Layout route={route}>
      <Page key={route} />
    </Layout>
  )
}
