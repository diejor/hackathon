import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeftRight, ArrowRight, Check, Delete, Eye, Lightbulb, Minus, Shuffle } from 'lucide-react'
import { BackHome, Crumb, PageHead } from '../components/Layout'
import { EndOverlay } from '../points'
import { addPoints } from '../storage'

// Client-side demo only — puzzles would come from a backend in the real app.
// The board adapts to any word between 4 and 12 letters.
type Puzzle = { word: string; clue: string; definition: string }

const PUZZLES: Puzzle[] = [
  {
    word: 'PAUSE',
    clue: 'Stop for a moment before you act.',
    definition: 'To stop briefly. Taking a pause before you reply or pay gives you time to notice if something is wrong.',
  },
  {
    word: 'SCAM',
    clue: 'A trick to take your money.',
    definition: 'A dishonest scheme to trick someone out of money or personal information.',
  },
  {
    word: 'VERIFY',
    clue: 'Check that something is true.',
    definition: 'To make sure something is true, for example by calling a company on a number you already trust.',
  },
  {
    word: 'PHISHING',
    clue: 'Fake emails that fish for your details.',
    definition: 'Messages that pretend to be from a trusted company to get you to share passwords, card numbers or codes.',
  },
  {
    word: 'SKEPTICAL',
    clue: 'Not quick to believe what you are told.',
    definition: 'Wanting proof before you believe something. A healthy habit with unexpected messages.',
  },
  {
    word: 'SUSPICIOUS',
    clue: 'A feeling that something is not right.',
    definition: 'Feeling that something may be dishonest. It is always fine to stop and check when you feel this way.',
  },
  {
    word: 'IMPERSONATOR',
    clue: 'Someone pretending to be someone else.',
    definition: 'A person who pretends to be someone else, such as a bank, the police or a family member, to gain your trust.',
  },
]

const TRIES = 6
const ROWS = ['ABCDEFG', 'HIJKLMN', 'OPQRST', 'UVWXYZ']

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

function Board({ puzzle, onNext }: { puzzle: Puzzle; onNext: () => void }) {
  const answer = puzzle.word
  const length = answer.length
  const [guesses, setGuesses] = useState<string[]>([])
  const [current, setCurrent] = useState('')
  const [message, setMessage] = useState('Choose letters to make your guess.')
  // Clue reveal: 'hidden' → 'pressed' (button feedback) → 'fading' (overlay fades out) → 'shown'
  const [clue, setClue] = useState<'hidden' | 'pressed' | 'fading' | 'shown'>('hidden')
  const clueTimer = useRef<number>(undefined)
  const revealClue = () => {
    if (clue !== 'hidden') return
    setClue('pressed')
    clueTimer.current = window.setTimeout(() => {
      setClue('fading')
      clueTimer.current = window.setTimeout(() => setClue('shown'), 260)
    }, 320)
  }
  useEffect(() => () => window.clearTimeout(clueTimer.current), [])

  const won = guesses.includes(answer)
  const over = won || guesses.length >= TRIES

  const keyMarks: Record<string, Mark> = {}
  guesses.forEach((g) =>
    score(g, answer).forEach((m, i) => {
      const prev = keyMarks[g[i]]
      if (!prev || RANK[m] > RANK[prev]) keyMarks[g[i]] = m
    }),
  )

  // Briefly highlight a key when it is pressed, by tap, click or physical keyboard.
  const [flash, setFlash] = useState<string | null>(null)
  const flashTimer = useRef<number>(undefined)
  const flashKey = (ch: string) => {
    setFlash(ch)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(null), 180)
  }
  useEffect(() => () => window.clearTimeout(flashTimer.current), [])

  const type = (ch: string) => {
    flashKey(ch)
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
    if (current === answer || next.length >= TRIES) addPoints(1)
    if (current === answer) {
      setMessage(`Well done — the word was ${answer}.`)
    } else if (next.length >= TRIES) {
      setMessage(`The word was ${answer}. Thank you for playing.`)
    } else {
      const right = score(current, answer).filter((m) => m === 'correct').length
      setMessage(`${right} letter${right === 1 ? ' is' : 's are'} in the right place. Try another word.`)
    }
  }

  // Physical keyboard support. Re-subscribed each render so the handler always sees current state.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable]')) return
      if (/^[a-z]$/i.test(e.key)) type(e.key.toUpperCase())
      else if (e.key === 'Backspace' && !over) setCurrent((c) => c.slice(0, -1))
      else if (e.key === 'Enter' && !over && !target.closest('button, a')) check()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const rows = Array.from({ length: TRIES }, (_, r) => {
    if (r < guesses.length) return { letters: guesses[r], marks: score(guesses[r], answer), active: false }
    if (r === guesses.length && !over) return { letters: current, marks: [] as Mark[], active: true }
    return { letters: '', marks: [] as Mark[], active: false }
  })

  return (
    <section className="card board-card">
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
        <div className="clue-body" aria-hidden={clue !== 'shown'}>
          <span className="clue-label">Clue</span>
          <p className="clue-text">{puzzle.clue}</p>
        </div>
        {clue !== 'shown' && (
          <div className={`clue-cover ${clue === 'fading' ? 'fading' : ''}`}>
            <button
              className={`clue-eye ${clue !== 'hidden' ? 'pressed' : ''}`}
              onClick={revealClue}
              aria-label="Reveal the clue"
              title="Reveal the clue"
            >
              <Eye size={24} strokeWidth={1.75} />
            </button>
          </div>
        )}
        <span className="sr-only" aria-live="polite">
          {clue === 'shown' ? `Clue: ${puzzle.clue}` : ''}
        </span>
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

      {/* On mobile this block stays docked at the bottom of the screen while the board scrolls */}
      <div className="dock">
      <p className="status-line" aria-live="polite">
        {message}
      </p>

      <div className="keyboard">
        {ROWS.map((row) => (
          <div className="key-row" key={row}>
            {row.split('').map((ch) => (
              <button
                key={ch}
                className={`key ${keyMarks[ch] ?? ''} ${flash === ch ? 'pressed' : ''}`}
                onClick={() => type(ch)}
              >
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
        <button
          className="btn btn-secondary"
          onClick={() => setCurrent(current.slice(0, -1))}
          disabled={over}
          aria-label="Delete last letter"
          title="Delete last letter"
        >
          <Delete size={24} strokeWidth={1.75} />
        </button>
        <button className="btn btn-primary" onClick={check} disabled={over}>
          Check word
        </button>
      </div>
      </div>

      {over && (
        <EndOverlay label={won ? 'Word solved' : 'Game over'}>
          <div className="result-box">
            <p className="clue-label">{won ? 'Well done, you got it' : 'The word was'}</p>
            <h2 id="result-word" className="result-word">
              {answer}
            </h2>
            <p className="result-def">{puzzle.definition}</p>
            <button autoFocus className="btn btn-primary btn-block" onClick={onNext}>
              Next word <ArrowRight size={20} strokeWidth={1.75} />
            </button>
          </div>
        </EndOverlay>
      )}
    </section>
  )
}

export default function Fraudle() {
  const [index, setIndex] = useState(0)
  const puzzle = PUZZLES[index]
  const next = () => setIndex((index + 1) % PUZZLES.length)

  return (
    <>
      <PageHead
        crumb={<Crumb label="Fraudle" />}
        title="Fraudle"
        lead="Guess the safety word. Choose letters below, then select Check word. You have six tries."
      />
      <div className="page-grid">
        <div className="stack">
          <Board key={puzzle.word} puzzle={puzzle} onNext={next} />
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
          <button className="btn btn-secondary btn-block" onClick={next}>
            <Shuffle size={18} strokeWidth={1.75} /> Try a different word
          </button>
          <BackHome />
        </div>
      </div>
    </>
  )
}
