import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeftRight, ArrowRight, Check, Delete, Eye, Lightbulb, Minus, RotateCcw, Shuffle, Sprout } from 'lucide-react'
import { BackHome, Crumb, PageHead } from '../components/Layout'
import { useCoverReveal } from '../components/useCoverReveal'
import { EndOverlay } from '../points'
import { href } from '../router'
import { logActivity } from '../lib/stdb'
import { PUZZLES, type Puzzle } from '../content/fraudle'
import '../fraudle.css'

// Words, clues and lessons live in ../content/fraudle.ts. Look and layout follow the designer's design01
// (clue behind a cover, key press feedback, end-of-game overlay with the +1 point); the reveal, lessons,
// random order and activity logging are ours.
const TRIES = 6
// A to Z on purpose: easier to scan for people who don't type on a QWERTY keyboard every day.
const ROWS = ['ABCDEFG', 'HIJKLMN', 'OPQRST', 'UVWXYZ']

type Mark = 'correct' | 'present' | 'absent'

// Spoken names for the marks (screen readers get these instead of the colors and icons).
const MARK_NAME: Record<Mark, string> = {
  correct: 'right place',
  present: 'in the word, different place',
  absent: 'not in the word',
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const scrollBehavior = (): ScrollBehavior => (reducedMotion() ? 'auto' : 'smooth')

// Reveal timing (ms). Each tile starts turning STAGGER after the one before; FLIP must match
// the fraudle-flip animation in fraudle.css. With reduced motion there is no reveal at all.
const STAGGER = 200
const FLIP = 440

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

// One line after a wrong guess, counting both kinds of near miss.
function guessFeedback(marks: Mark[]): string {
  const right = marks.filter((m) => m === 'correct').length
  const moved = marks.filter((m) => m === 'present').length
  const rightText = `${right} letter${right === 1 ? ' is' : 's are'} in the right place`
  if (!moved) return `${rightText}. Try again.`
  const movedText = `${moved} ${right ? '' : `letter${moved === 1 ? ' ' : 's '}`}${moved === 1 ? 'is' : 'are'} in the word, in a different place`
  return `${rightText}, and ${movedText}. Try again.`
}

// A fresh random order of every word (Fisher-Yates). `avoidFirst` keeps the word just played from
// coming straight back when a new round of words starts.
function shuffledOrder(avoidFirst?: number): number[] {
  const order = PUZZLES.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  if (avoidFirst !== undefined && order.length > 1 && order[0] === avoidFirst) {
    ;[order[0], order[1]] = [order[1], order[0]]
  }
  return order
}

const RANK: Record<Mark, number> = { absent: 0, present: 1, correct: 2 }

function MarkIcon({ mark }: { mark?: Mark }) {
  if (mark === 'correct') return <Check size={10} strokeWidth={3} />
  if (mark === 'present') return <ArrowLeftRight size={10} strokeWidth={2.5} />
  if (mark === 'absent') return <Minus size={10} strokeWidth={2.5} />
  return null
}

type RowKind = 'played' | 'active' | 'future'

type Session = { solved: number; streak: number }

// Gentle, per-visit encouragement: no pressure, nothing lost on a miss.
function steadyNote(streak: number) {
  return streak >= 2 ? `${streak} in a row — nice and steady.` : ''
}

function Board({
  puzzle,
  isLast,
  onNext,
  onResult,
  session,
}: {
  puzzle: Puzzle
  isLast: boolean
  onNext: () => void
  onResult: (solved: boolean) => void
  session: Session
}) {
  const answer = puzzle.word
  const length = answer.length
  const [guesses, setGuesses] = useState<string[]>([])
  const [current, setCurrent] = useState('')
  const [message, setMessage] = useState('Type or tap letters to make your guess.')
  const sectionRef = useRef<HTMLElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const activeRowRef = useRef<HTMLDivElement>(null)
  // True while the last guess's tiles are turning over. Typing waits; the keyboard, the message
  // and the lesson only change once every tile has shown its mark.
  const [revealing, setRevealing] = useState(false)
  const [shake, setShake] = useState(false)
  const revealTimer = useRef<number | undefined>(undefined)
  const shakeTimer = useRef<number | undefined>(undefined)
  // The result waiting for the reveal to end, so it still counts if the board goes away mid-reveal.
  const pendingResult = useRef<boolean | null>(null)
  const onResultRef = useRef(onResult)
  useEffect(() => {
    onResultRef.current = onResult
  })

  useEffect(
    () => () => {
      window.clearTimeout(revealTimer.current)
      window.clearTimeout(shakeTimer.current)
      if (pendingResult.current !== null) onResultRef.current(pendingResult.current)
    },
    [],
  )

  // Guesses whose marks are showing (the one being revealed is not settled yet).
  const settled = revealing ? guesses.slice(0, -1) : guesses
  const won = settled.includes(answer)
  const over = won || settled.length >= TRIES
  // Whether the game ends with the guesses made so far (used for the board layout during a reveal).
  const ending = guesses.includes(answer) || guesses.length >= TRIES

  const keyMarks: Record<string, Mark> = {}
  settled.forEach((g) =>
    score(g, answer).forEach((m, i) => {
      const prev = keyMarks[g[i]]
      if (!prev || RANK[m] > RANK[prev]) keyMarks[g[i]] = m
    }),
  )

  const [clue, revealClue] = useCoverReveal()

  // Briefly highlight a key when it is pressed, by tap, click or physical keyboard (design01).
  const [flash, setFlash] = useState<string | null>(null)
  const flashTimer = useRef<number>(undefined)
  const flashKey = (ch: string) => {
    setFlash(ch)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(null), 180)
  }
  useEffect(() => () => window.clearTimeout(flashTimer.current), [])

  const locked = over || revealing
  const type = (ch: string) => {
    flashKey(ch)
    if (locked) return
    setCurrent((c) => (c.length >= length ? c : c + ch))
  }
  const erase = () => {
    if (!locked) setCurrent((c) => c.slice(0, -1))
  }

  const check = () => {
    if (locked) return
    if (current.length < length) {
      setMessage(`Your word needs ${length} letters.`)
      if (!reducedMotion()) {
        window.clearTimeout(shakeTimer.current)
        setShake(true)
        shakeTimer.current = window.setTimeout(() => setShake(false), 420)
      }
      return
    }
    const guess = current
    const next = [...guesses, guess]
    setGuesses(next)
    setCurrent('')

    // Logged right away (points come from activity); the words on screen wait for the reveal.
    let result: boolean | null = null
    let text: string
    if (guess === answer) {
      result = true
      text = `Nice catch — the word was ${answer}.`
      void logActivity('fraudle', 'word_solved', {
        word: answer,
        tries: next.length,
      })
    } else if (next.length >= TRIES) {
      result = false
      text = `The word was ${answer}. Thank you for playing.`
      void logActivity('fraudle', 'word_missed', {
        word: answer,
        tries: next.length,
      })
    } else {
      text = guessFeedback(score(guess, answer))
    }

    const settle = () => {
      setRevealing(false)
      setMessage(text)
      if (result !== null) onResultRef.current(result)
      pendingResult.current = null
    }
    if (reducedMotion()) {
      settle()
      return
    }
    // Clear the line while the tiles turn, so the result is announced once, after the reveal.
    setMessage('')
    setRevealing(true)
    pendingResult.current = result
    revealTimer.current = window.setTimeout(settle, (length - 1) * STAGGER + FLIP)
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
        else if (!revealing) check()
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
    activeRowRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: scrollBehavior(),
    })
  }, [typing, guesses.length, over])

  // Played rows, the row being typed, then the tries left as thin placeholders.
  const rows = Array.from({ length: TRIES }, (_, r): { letters: string; marks: Mark[]; kind: RowKind } => {
    if (r < guesses.length)
      return {
        letters: guesses[r],
        marks: score(guesses[r], answer),
        kind: 'played',
      }
    if (r === guesses.length && !ending) return { letters: current, marks: [], kind: 'active' }
    return { letters: '', marks: [], kind: 'future' }
  })

  return (
    <section className="card board-card fraudle-card" ref={sectionRef} aria-label="Fraudle game">
      <div className="game-top">
        <div className="guess-tracker" role="img" aria-label={`${guesses.length} of ${TRIES} tries used`}>
          {Array.from({ length: TRIES }, (_, i) => (
            <span key={i} className={`pip ${i < guesses.length ? 'used' : ''}`} />
          ))}
        </div>
      </div>

      <div className="clue-strip">
        <span className="clue-icon" aria-hidden="true">
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

      <div className="board" role="grid" aria-label="Your guesses" style={{ '--n': length } as CSSProperties}>
        {rows.map((row, r) => {
          const isRevealing = revealing && r === guesses.length - 1
          const rowCls = [
            'board-row',
            row.kind,
            isRevealing ? 'revealing' : '',
            won && row.letters === answer ? 'solved' : '',
            row.kind === 'active' && shake ? 'shake' : '',
          ]
          return (
            <div
              className={rowCls.join(' ')}
              role="row"
              key={r}
              ref={row.kind === 'active' ? activeRowRef : undefined}
              aria-hidden={row.kind === 'future' ? true : undefined}
            >
              {Array.from({ length }, (_, c) => {
                const mark = row.marks[c]
                const ch = row.letters[c]
                const cls = ['tile', mark, row.kind === 'active' && ch ? 'active' : ''].join(' ')
                // --i staggers the flip (and the win bounce) from left to right.
                return (
                  <div
                    className={cls}
                    role="gridcell"
                    key={c}
                    style={{ '--i': c } as CSSProperties}
                    aria-label={ch ? `${ch}${mark && !isRevealing ? `, ${MARK_NAME[mark]}` : ''}` : 'empty'}
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
          )
        })}
      </div>

      {/* The status line, the letters and the buttons. On phones this dock sticks to the bottom of the
          screen while the board scrolls. The status line stays mounted so the result is announced. */}
      <div className="fraudle-dock" ref={dockRef} inert={over}>
        <p className="status-line" role="status">
          {message}
        </p>
        <div className="keyboard" role="group" aria-label="Letters">
          {ROWS.map((row) => (
            <div className="key-row" key={row}>
              {row.split('').map((ch) => {
                const mark = keyMarks[ch]
                return (
                  <button
                    key={ch}
                    className={`key ${mark ?? ''} ${flash === ch ? 'pressed' : ''}`}
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
          <button className="btn btn-secondary" onClick={erase} aria-label="Delete last letter" title="Delete last letter">
            <Delete size={24} strokeWidth={1.75} />
          </button>
          <button className="btn btn-primary" onClick={check}>
            Check word
          </button>
        </div>
      </div>

      {/* design01's end of game: the +1 point (logged as word_solved / word_missed), then the result. */}
      {over && (
        <EndOverlay label={won ? 'Word solved' : 'Game over'}>
          <div className="result-box fraudle-result">
            <p className="clue-label">{won ? 'Nice catch, you got it' : 'The word was'}</p>
            <h2 id="result-word" className="result-word">
              {answer}
            </h2>
            <p className="result-def">{puzzle.lesson}</p>
            {won && (
              <p className="fraudle-session-note">
                Words solved this visit: {session.solved}
                {steadyNote(session.streak) && <> · {steadyNote(session.streak)}</>}
              </p>
            )}
            {isLast && (
              <p className="fraudle-all-done">
                That was the last of the {PUZZLES.length} words. Start again to play them all in a new order.
              </p>
            )}
            <button autoFocus className="btn btn-primary btn-block" onClick={onNext}>
              {isLast ? 'Start again' : 'Next word'}
              {isLast ? <RotateCcw size={20} aria-hidden="true" /> : <ArrowRight size={20} strokeWidth={1.75} aria-hidden="true" />}
            </button>
            <p className="see-progress-row">
              <a className="see-progress" href={href('profile')}>
                <Sprout size={18} strokeWidth={1.75} aria-hidden="true" /> See your progress
              </a>
            </p>
          </div>
        </EndOverlay>
      )}
    </section>
  )
}

export default function Fraudle() {
  // Words come in a random order with no repeats; once all have been played, a new order starts.
  const [order, setOrder] = useState(() => shuffledOrder())
  const [pos, setPos] = useState(0)
  const puzzle = PUZZLES[order[pos]]
  const isLast = pos === order.length - 1
  // Per visit only: nothing is stored, and a missed word just starts a new run.
  const [session, setSession] = useState<Session>({ solved: 0, streak: 0 })
  const onResult = (solved: boolean) =>
    setSession((s) => (solved ? { solved: s.solved + 1, streak: s.streak + 1 } : { ...s, streak: 0 }))
  const nextWord = () => {
    if (isLast) {
      setOrder(shuffledOrder(order[pos]))
      setPos(0)
    } else setPos(pos + 1)
    window.scrollTo(0, 0)
  }

  return (
    <div className="fraudle-page">
      <PageHead
        crumb={<Crumb label="Fraudle" />}
        title="Fraudle"
        lead="Guess the safety word. Reveal the clue, then type or tap the letters (in A to Z order) and select Check word. You have six tries."
      />
      <div className="page-grid">
        <div className="stack">
          <Board
            key={puzzle.word}
            puzzle={puzzle}
            isLast={isLast}
            onNext={nextWord}
            onResult={onResult}
            session={session}
          />
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
          <section className="card fraudle-today" aria-label="This visit">
            <p className="fraudle-today-count">
              Words solved this visit: <strong>{session.solved}</strong>
            </p>
            <p className="fraudle-today-note">
              {steadyNote(session.streak) || 'No rush. Every word is a small habit worth keeping.'}
            </p>
          </section>
          <p className="muted">A useful habit: you don’t have to answer a message right away.</p>
          <button className="btn btn-secondary btn-block" onClick={nextWord}>
            {isLast ? (
              <>
                <RotateCcw size={18} strokeWidth={1.75} aria-hidden="true" /> Start again in a new order
              </>
            ) : (
              <>
                <Shuffle size={18} strokeWidth={1.75} aria-hidden="true" /> Try a different word
              </>
            )}
          </button>
          <BackHome />
        </div>
      </div>
    </div>
  )
}
