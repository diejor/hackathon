import { useState } from 'react'
import { useProgress } from '../lib/useProgress'
import { helpBot } from '../lib/stdb'
import type { Progress } from '../lib/progress'

export function ChallengeReflection() {
  const { progress } = useProgress()
  return progress.reflection && <ReflectionCard key={progress.reflection.at} drill={progress.reflection} />
}

function ReflectionCard({ drill }: { drill: NonNullable<Progress['reflection']> }) {
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  async function save() {
    setBusy(true)
    setError(false)
    try {
      const { L } = await helpBot()
      const connection = L.getConn()
      if (!connection || !L.state.connected) throw new Error('Offline')
      await connection.reducers.logActivity({ game: 'reflection', kind: 'challenge_review',
        details: JSON.stringify({ attemptAt: drill.at, answer: answer.trim() }) })
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }
  return <section className="card about-section" aria-labelledby="reflection-title">
    <h2 className="h2" id="reflection-title">Reflect on your practice drill</h2>
    <p>{drill.voice ? 'You talked with the SafeSense practice caller.' : 'You opened the practice link.'} It was a practice call from SafeSense: nobody real was calling.</p>
    {drill.lesson && <p>{drill.lesson}</p>}
    {drill.answer ? <p><strong>Your reflection</strong><br />{drill.answer}</p> :
      <form className="stack" onSubmit={e => { e.preventDefault(); void save() }}>
        <label htmlFor="drill-reflection">Which clue would make you pause next time?</label>
        <textarea id="drill-reflection" maxLength={180} value={answer} onChange={e => setAnswer(e.target.value)} />
        <button className="btn btn-primary" disabled={busy || !answer.trim()}>Save reflection</button>
        {error && <p role="alert">Couldn’t save. Check your connection and try again.</p>}
      </form>}
  </section>
}
