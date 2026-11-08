import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeftRight, ArrowRight, Check, Lightbulb, Minus, RotateCcw, Sprout } from 'lucide-react'
import { Crumb, PageHead } from '../components/Layout'
import { href } from '../router'
import { logActivity } from '../lib/stdb'
import { PUZZLES, type Puzzle } from '../content/fraudle'
import '../fraudle.css'

// Words, clues and lessons live in ../content/fraudle.ts.
const TRIES = 6
// A to Z on purpose: easier to scan for people who don't type on a QWERTY keyboard every day.
const ROWS = ['ABCDEFG', 'HIJKLMN', 'OPQRST', 'UVWXYZ']
const NUMBER_WORDS = ['', '', '', '', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve']

type Mark = 'correct' | 'present' | 'absent'

// Spoken names for the marks (screen readers get these instead of the colors and icons).
const MARK_NAME: Record<Mark, string> = {
  correct: 'right place',
  present: 'in the word, different place',
  absent: 'not in the word',
}

const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

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

type RowKind = 'played' | 'active' | 'future'

function Board({ puzzle, isLast, onNext }: { puzzle: Puzzle; isLast: boolean; onNext: () => void }) {
  const answer = puzzle.word
  const length = answer.length
  const [guesses, setGuesses] = useState<string[]>([])
  const [current, setCurrent] = useState('')
  const [message, setMessage] = useState('Type or tap letters to make your guess.')
  const sectionRef = useRef<HTMLElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const activeRowRef = useRef<HTMLDivElement>(null)
  const lessonRef = useRef<HTMLParagraphElement>(null)

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
    if (over) return
    setCurrent((c) => (c.length >= length ? c : c + ch))
  }
  const erase = () => {
    if (!over) setCurrent((c) => c.slice(0, -1))
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
      void logActivity('fraudle', 'word_solved', { word: answer, tries: next.length })
    } else if (next.length >= TRIES) {
      setMessage(`The word was ${answer}. Thank you for playing.`)
      void logActivity('fraudle', 'word_missed', { word: answer, tries: next.length })
    } else {
      const right = score(current, answer).filter((m) => m === 'correct').length
      setMessage(`${right} letter${right === 1 ? ' is' : 's are'} in the right place. Try again.`)
    }
  }

  // Physical keyboard: letters type, Backspace deletes, Enter checks (or moves on once the word is done).
  // Re-registered each render so the handler always sees the latest guess.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.key === 'Enter') {
        // Stop a focused on-screen button from also being "clicked" by Enter.
        e.preventDefault()
        if (over) onNext()
        else check()
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        erase()
      } else if (/^[a-z]$/i.test(e.key)) {
        type(e.key.toUpperCase())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // The letter dock sticks to the bottom of the screen. Tell the board how tall it is, so a row
  // scrolled into view lands just above the dock instead of underneath it.
  useEffect(() => {
    const dock = dockRef.current
    const section = sectionRef.current
    if (!dock || !section || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => section.style.setProperty('--dock-h', `${dock.offsetHeight}px`))
    ro.observe(dock)
    return () => ro.disconnect()
  }, [])

  // Keep the row being typed in view (scrolls only if it is hidden behind the dock or off-screen).
  const typing = current.length > 0
  useEffect(() => {
    if (over || (!typing && guesses.length === 0)) return
    activeRowRef.current?.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() })
  }, [typing, guesses.length, over])

  // When the word is done the Check button goes away, so move focus to the lesson.
  useEffect(() => {
    if (over) lessonRef.current?.focus()
  }, [over])

  // Played rows, the row being typed, then the tries left as thin placeholders.
  const rows = Array.from({ length: TRIES }, (_, r): { letters: string; marks: Mark[]; kind: RowKind } => {
    if (r < guesses.length) return { letters: guesses[r], marks: score(guesses[r], answer), kind: 'played' }
    if (r === guesses.length && !over) return { letters: current, marks: [], kind: 'active' }
    return { letters: '', marks: [], kind: 'future' }
  })

  return (
    <section className={`card fraudle-card${over ? ' is-over' : ''}`} ref={sectionRef} aria-label="Fraudle game">
      <div className="clue-strip">
        <span className="clue-icon" aria-hidden="true">
          <Lightbulb size={22} strokeWidth={1.5} />
        </span>
        <div className="clue-body">
          <div className="clue-head">
            <span className="clue-label">Clue</span>
            <div className="guess-tracker" role="img" aria-label={`${guesses.length} of ${TRIES} tries used`}>
              {Array.from({ length: TRIES }, (_, i) => (
                <span key={i} className={`pip ${i < guesses.length ? 'used' : ''}`} />
              ))}
            </div>
          </div>
          <p className="clue-text">{puzzle.clue}</p>
          <p className="clue-meta">One word · {NUMBER_WORDS[length]} letters</p>
        </div>
      </div>

      <div className="board" role="grid" aria-label="Your guesses" style={{ '--n': length } as CSSProperties}>
        {rows.map((row, r) => (
          <div
            className={`board-row ${row.kind}`}
            role="row"
            key={r}
            ref={row.kind === 'active' ? activeRowRef : undefined}
            aria-hidden={row.kind === 'future' ? true : undefined}
          >
            {Array.from({ length }, (_, c) => {
              const mark = row.marks[c]
              const ch = row.letters[c]
              const cls = ['tile', mark, row.kind === 'active' && ch ? 'active' : ''].join(' ')
              return (
                <div
                  className={cls}
                  role="gridcell"
                  key={c}
                  aria-label={ch ? `${ch}${mark ? `, ${MARK_NAME[mark]}` : ''}` : 'empty'}
                >
                  {ch ?? ''}
                  {mark && (
                    <span className="mark" aria-hidden="true">
                      <MarkIcon mark={mark} />
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* One dock for the status line and either the letters (sticky while playing) or the lesson.
          The status line stays mounted so the result is announced. */}
      <div className={`fraudle-dock${over ? ' is-over' : ''}`} ref={dockRef}>
        <p className="status-line" role="status">
          {message}
        </p>
      {over ? (
        <div className="fraudle-lesson">
          <p className="feedback-title" tabIndex={-1} ref={lessonRef}>
            <Lightbulb size={20} strokeWidth={1.5} aria-hidden="true" /> Worth remembering
          </p>
          <p>{puzzle.lesson}</p>
          {isLast && (
            <p className="fraudle-all-done">
              That was the last of the {PUZZLES.length} words. You can start again from the first one.
            </p>
          )}
          <button className="btn btn-primary btn-block" onClick={onNext}>
            {isLast ? <RotateCcw size={20} aria-hidden="true" /> : <ArrowRight size={20} aria-hidden="true" />}
            {isLast ? 'Start again' : 'Next word'}
          </button>
          <p className="see-progress-row">
            <a className="see-progress" href={href('profile')}>
              <Sprout size={18} strokeWidth={1.75} aria-hidden="true" /> See your progress
            </a>
          </p>
        </div>
      ) : (
        <>
          <div className="keyboard" role="group" aria-label="Letters">
            {ROWS.map((row) => (
              <div className="key-row" key={row}>
                {row.split('').map((ch) => {
                  const mark = keyMarks[ch]
                  return (
                    <button
                      key={ch}
                      className={`key ${mark ?? ''}`}
                      onClick={() => type(ch)}
                      aria-label={mark ? `${ch}, ${MARK_NAME[mark]}` : ch}
                    >
                      {ch}
                      {mark && (
                        <span className="mark" aria-hidden="true">
                          <MarkIcon mark={mark} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="two-btns">
            <button className="btn btn-secondary" onClick={erase}>
              Delete
            </button>
            <button className="btn btn-primary" onClick={check}>
              Check word
            </button>
          </div>
        </>
      )}
      </div>
    </section>
  )
}

export default function Fraudle() {
  const [index, setIndex] = useState(0)
  const puzzle = PUZZLES[index]
  const isLast = index === PUZZLES.length - 1
  const nextWord = () => {
    setIndex((i) => (i + 1) % PUZZLES.length)
    window.scrollTo(0, 0)
  }

  return (
    <div className="fraudle-page">
      <PageHead
        crumb={<Crumb label="Fraudle" />}
        title="Fraudle"
        lead="Guess the safety word from the clue. Type, or tap the letters (in A to Z order), then Check word. Six tries."
      />
      <div className="page-grid">
        <div className="stack">
          <Board key={puzzle.word} puzzle={puzzle} isLast={isLast} onNext={nextWord} />
        </div>

        <div className="stack">
          <section className="card">
            <h2 className="h3">What the marks mean</h2>
            <ul className="legend">
              <li>
                <Check size={20} aria-hidden="true" /> Right letter, right place
              </li>
              <li>
                <ArrowLeftRight size={20} aria-hidden="true" /> Right letter, different place
              </li>
              <li>
                <Minus size={20} aria-hidden="true" /> Not in the word
              </li>
            </ul>
          </section>
          <p className="muted">A useful habit: you don’t have to answer a message right away.</p>
          <button className="btn btn-secondary btn-block" onClick={nextWord}>
            {isLast ? (
              <>
                <RotateCcw size={18} strokeWidth={1.75} aria-hidden="true" /> Start again from the first word
              </>
            ) : (
              <>
                <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" /> Skip to next word
              </>
            )}
          </button>
          <a className="btn btn-secondary btn-block" href={href('home')}>
            Back to home
          </a>
        </div>
      </div>
    </div>
  )
}
