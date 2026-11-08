/** "Message 4 of 15" plus a segmented track that shares the row's width, so any number of rounds fits at 320px. */
export function ProgressTrack({ total, done, current }: { total: number; done: number; current: number }) {
  return (
    <div className="son-progress">
      <p className="son-progress-label">
        Message {current + 1} <span className="muted">of {total}</span>
      </p>
      <ol className="son-track" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <li key={i} className={i < done ? 'done' : i === current ? 'current' : undefined} />
        ))}
      </ol>
    </div>
  )
}
