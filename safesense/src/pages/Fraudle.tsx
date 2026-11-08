import { useState, type CSSProperties } from 'react'
import { ArrowLeftRight, Check, Lightbulb, Minus, Shuffle } from 'lucide-react'
import { Crumb, PageHead } from '../components/Layout'
import { href } from '../router'

// Client-side demo only — puzzles would come from a backend in the real app.
// The board adapts to any word between 4 and 12 letters.
type Puzzle = { word: string; clue: string }

const PUZZLES: Puzzle[] = [
  { word: 'PAUSE', clue: 'Stop for a moment before you act.' },
  { word: 'SCAM', clue: 'A trick to take your money.' },
  { word: 'VERIFY', clue: 'Check that something is true.' },
  { word: 'PHISHING', clue: 'Fake emails that fish for your details.' },
  { word: 'SKEPTICAL', clue: 'Not quick to believe what you are told.' },
  { word: 'SUSPICIOUS', clue: 'A feeling that something is not right.' },
  { word: 'IMPERSONATOR', clue: 'Someone pretending to be someone else.' },
]

const TRIES = 6
const ROWS = ['ABCDEFG', 'HIJKLMN', 'OPQRST', 'UVWXYZ']
const NUMBER_WORDS = ['', '', '', '', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve']

type Mark = 'correct' | 'present' | 'absent'

function score(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array(answer.length).fill('absent')
  const left = answer.split('')
  guess.split('').forEach((ch, i) => {
    if (ch === answer[i]) {
      marks[i] = 'correct'
      left[i] = ''
    }
  })
  guess.split('').forEach((ch, i) => {
    if (marks[i] === 'correct') return
    const j = left.indexOf(ch)
    if (j >= 0) {
      marks[i] = 'present'
      left[j] = ''
    }
  })
  return marks
}

const RANK: Record<Mark, number> = { absent: 0, present: 1, correct: 2 }

function MarkIcon({ mark }: { mark?: Mark }) {
  if (mark === 'correct') return <Check size={10} strokeWidth={3} />
  if (mark === 'present') return <ArrowLeftRight size={10} strokeWidth={2.5} />
  if (mark === 'absent') return <Minus size={10} strokeWidth={2.5} />
  return null
}

function Board({ puzzle }: { puzzle: Puzzle }) {
  const answer = puzzle.word
  const length = answer.length
  const [guesses, setGuesses] = useState<string[]>([])
  const [current, setCurrent] = useState('')
  const [message, setMessage] = useState('Choose letters to make your guess.')

  const won = guesses.includes(answer)
  const over = won || guesses.length >= TRIES

  const keyMarks: Record<string, Mark> = {}
  guesses.forEach((g) =>
    score(g, answer).forEach((m, i) => {
      const prev = keyMarks[g[i]]
      if (!prev || RANK[m] > RANK[prev]) keyMarks[g[i]] = m
    }),
  )

  const type = (ch: string) => {
    if (over || current.length >= length) return
    setCurrent(current + ch)
  }

  const check = () => {
    if (current.length < length) {
      setMessage(`Your word needs ${length} letters.`)
      return
    }
    const next = [...guesses, current]
    setGuesses(next)
    setCurrent('')
    if (current === answer) {
      setMessage(`Well done — the word was ${answer}.`)
    } else if (next.length >= TRIES) {
      setMessage(`The word was ${answer}. Thank you for playing.`)
    } else {
      const right = score(current, answer).filter((m) => m === 'correct').length
      setMessage(`${right} letter${right === 1 ? ' is' : 's are'} in the right place. Try another word.`)
    }
  }

  const rows = Array.from({ length: TRIES }, (_, r) => {
    if (r < guesses.length) return { letters: guesses[r], marks: score(guesses[r], answer), active: false }
    if (r === guesses.length && !over) return { letters: current, marks: [] as Mark[], active: true }
    return { letters: '', marks: [] as Mark[], active: false }
  })

  return (
    <section className="card">
      <div className="game-top">
        <div
          className="guess-tracker"
          role="img"
          aria-label={`${guesses.length} of ${TRIES} guesses used`}
        >
          {Array.from({ length: TRIES }, (_, i) => (
            <span key={i} className={`pip ${i < guesses.length ? 'used' : ''}`} />
          ))}
        </div>
      </div>

      <div className="clue-strip">
        <span className="clue-icon">
          <Lightbulb size={22} strokeWidth={1.5} />
        </span>
        <div>
          <span className="clue-label">Clue</span>
          <p className="clue-text">{puzzle.clue}</p>
          <p className="clue-meta">One word · {NUMBER_WORDS[length]} letters</p>
        </div>
      </div>

      <div className="board" role="grid" aria-label="Guesses" style={{ '--n': length } as CSSProperties}>
        {rows.map((row, r) => (
          <div className="board-row" role="row" key={r}>
            {Array.from({ length }, (_, c) => {
              const mark = row.marks[c]
              const cls = ['tile', mark, row.active && row.letters[c] ? 'active' : ''].join(' ')
              return (
                <div
                  className={cls}
                  role="gridcell"
                  key={c}
                  aria-label={row.letters[c] ? `${row.letters[c]} ${mark ?? ''}` : 'empty'}
                >
                  {row.letters[c] ?? ''}
                  {mark && (
                    <span className="mark">
                      <MarkIcon mark={mark} />
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <p className="status-line" aria-live="polite">
        {message}
      </p>

      <div className="keyboard">
        {ROWS.map((row) => (
          <div className="key-row" key={row}>
            {row.split('').map((ch) => (
              <button key={ch} className={`key ${keyMarks[ch] ?? ''}`} onClick={() => type(ch)}>
                {ch}
                {keyMarks[ch] && (
                  <span className="mark">
                    <MarkIcon mark={keyMarks[ch]} />
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="two-btns">
        <button className="btn btn-secondary" onClick={() => setCurrent(current.slice(0, -1))} disabled={over}>
          Delete
        </button>
        <button className="btn btn-primary" onClick={check} disabled={over}>
          Check word
        </button>
      </div>
    </section>
  )
}

export default function Fraudle() {
  const [index, setIndex] = useState(0)
  const puzzle = PUZZLES[index]

  return (
    <>
      <PageHead
        crumb={<Crumb label="Fraudle" />}
        title="Fraudle"
        lead="Guess the safety word. Choose letters below, then select Check word. You have six tries."
      />
      <div className="page-grid">
        <div className="stack">
          <Board key={puzzle.word} puzzle={puzzle} />
        </div>

        <div className="stack">
          <section className="card">
            <h2 className="h3">What the marks mean</h2>
            <ul className="legend">
              <li>
                <Check size={20} /> Right letter, right place
              </li>
              <li>
                <ArrowLeftRight size={20} /> Right letter, different place
              </li>
              <li>
                <Minus size={20} /> Not in the word
              </li>
            </ul>
          </section>
          <p className="muted">A useful habit: you do not have to respond to a message straight away.</p>
          <button className="btn btn-secondary btn-block" onClick={() => setIndex((index + 1) % PUZZLES.length)}>
            <Shuffle size={18} strokeWidth={1.75} /> Try a different word
          </button>
          <a className="btn btn-secondary btn-block" href={href('home')}>
            Back to home
          </a>
        </div>
      </div>
    </>
  )
}
