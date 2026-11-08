// "Your progress": everything here is derived from the player's own activity_event rows (my_activity),
// so progress is saved with their SpacetimeDB identity on this device. Pure functions only (no React, no
// imports with runtime effects) so they can be unit-tested and moved server-side unchanged.
//
// Activity contract (docs/PLAN.md §5):
//   fraudle      word_solved | word_missed   {word, tries}
//   scam-or-not  answer_correct | answer_wrong {item, said, tactic, checked}
//                run_done                    {correct, total}   (one per completed run; earns the point)
//   long-con     round_done                  {scenario, tactics: string[], fooled}
//   practice-text answer_correct | answer_wrong {template, tactic}   (a practice scam by iMessage: REPORT = caught)
//   practice-call answer_correct | answer_wrong {call, tactic, outcome} (a practice scam phone call; tactic may be "")
// Older/demo rows (seed_demo_activity) use friend-or-fraud / scam-wordle and a few other tactic slugs;
// they are mapped onto the same shapes below.

/** One activity row, reduced to plain data. `at` is milliseconds since the Unix epoch. */
export type ProgressEvent = { game: string; kind: string; details: string; at: number }

/** Tactic slug for a genuine (safe) message. Catching one is a strength, never a weakness. */
export const GENUINE = 'legit'

const GAME_ALIASES: Record<string, string> = { 'friend-or-fraud': 'scam-or-not', 'scam-wordle': 'fraudle' }
const TACTIC_ALIASES: Record<string, string> = { none: GENUINE, prize: 'prize-giveaway' }

export const normalizeGame = (game: string) => GAME_ALIASES[game] ?? game
export const normalizeTactic = (tactic: string) => TACTIC_ALIASES[tactic] ?? tactic

/** Parse `details` JSON; anything malformed becomes {}. */
export function parseDetails(details: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(details)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** Graded practice drills sent to the person's phone: each finished one earns a point. */
const PRACTICE_GAMES = new Set(['practice-text', 'practice-call'])

type Outcome =
  | { type: 'answer'; correct: boolean; tactic: string }
  | { type: 'word'; solved: boolean; word: string }
  | { type: 'story'; tactics: string[] }
  | { type: 'other' }

/** What one event means for progress. */
export function classify(e: ProgressEvent): Outcome {
  const game = normalizeGame(e.game)
  const d = parseDetails(e.details)
  if ((game === 'scam-or-not' || PRACTICE_GAMES.has(game)) && (e.kind === 'answer_correct' || e.kind === 'answer_wrong'))
    return { type: 'answer', correct: e.kind === 'answer_correct', tactic: normalizeTactic(str(d.tactic)) }
  if (game === 'fraudle') {
    const word = str(d.word).toUpperCase()
    if (e.kind === 'word_solved') return { type: 'word', solved: true, word }
    if (e.kind === 'word_missed') return { type: 'word', solved: false, word }
    if (e.kind === 'round_done') return { type: 'word', solved: d.solved === true, word }
  }
  if (game === 'long-con' && e.kind === 'round_done') {
    const tactics = Array.isArray(d.tactics) ? d.tactics.map(str).filter(Boolean) : []
    return { type: 'story', tactics }
  }
  return { type: 'other' }
}

/**
 * Points: +1 for every finished game, nothing else (no penalties, nothing extra for being right).
 *   fraudle        word_solved | word_missed      each word finished
 *   scam-or-not    run_done                       each completed run (the per-answer rows earn nothing;
 *                                                 they feed the signs and the coaching)
 *   long-con       round_done                     each finished Role Reversal story
 *   practice-text  answer_correct | answer_wrong  each graded practice text
 *   practice-call  answer_correct | answer_wrong  each finished practice call
 * Each game's end-of-game "+1" (points.tsx) shows right after it logs the row that earns it.
 * Points show how much someone has practiced. No ranks, no leaderboards.
 */
export function pointsFor(e: ProgressEvent): number {
  const game = normalizeGame(e.game)
  if (game === 'scam-or-not') return e.kind === 'run_done' ? 1 : 0
  const o = classify(e)
  if (o.type === 'word' || o.type === 'story') return 1
  // Practice texts and calls are the real-world test: catching one earns a point, being fooled costs one.
  if (o.type === 'answer' && PRACTICE_GAMES.has(game)) return o.correct ? 1 : -1
  return 0
}

// A practice-call debrief from challenge.ts (server-inserted; never earns points, never resets them).
const isChallengeDebrief = (e: ProgressEvent) => e.game === 'challenge-line' &&
  (e.kind === 'link_opened' || e.kind === 'voice_response')

function latestReflection(events: ProgressEvent[]) {
  const event = events.reduce<ProgressEvent | undefined>((last, e) =>
    isChallengeDebrief(e) && (!last || e.at >= last.at) ? e : last, undefined)
  if (!event) return null
  const saved = events.find(e => e.game === 'reflection' && e.kind === 'challenge_review' &&
    parseDetails(e.details).attemptAt === event.at)
  return { at: event.at, voice: event.kind === 'voice_response', lesson: str(parseDetails(event.details).lesson),
    answer: saved ? str(parseDetails(saved.details).answer) : '' }
}

// Every point counts, always: practice drills never take points away.
/** Running total, oldest first; it never goes below 0 (a fooled practice text or call takes 1 point off). */
export const totalPoints = (events: ProgressEvent[]) => events.reduce((sum, e) => Math.max(0, sum + pointsFor(e)), 0)

/** The highest the total has ever been: unlocks use it, so losing a point never locks a game again. */
export const peakPoints = (events: ProgressEvent[]) =>
  events.reduce(([sum, peak], e) => {
    const next = Math.max(0, sum + pointsFor(e))
    return [next, Math.max(peak, next)]
  }, [0, 0])[1]

/** Local calendar day (YYYY-MM-DD) for a timestamp; `offsetMin` is minutes ahead of UTC (tests pass 0). */
export function dayKey(at: number, offsetMin = -new Date(at).getTimezoneOffset()): string {
  return new Date(at + offsetMin * 60_000).toISOString().slice(0, 10)
}

export type Counts = { messages: number; wordsSolved: number; stories: number; days: number }

export function counts(events: ProgressEvent[], day: (at: number) => string = (at) => dayKey(at)): Counts {
  const c: Counts = { messages: 0, wordsSolved: 0, stories: 0, days: 0 }
  const days = new Set<string>()
  for (const e of events) {
    days.add(day(e.at))
    const o = classify(e)
    if (o.type === 'answer') c.messages++
    else if (o.type === 'word' && o.solved) c.wordsSolved++
    else if (o.type === 'story') c.stories++
  }
  c.days = days.size
  return c
}

/** A sign the person has shown they can spot, and where. */
export type Caught = { tactic: string; times: number; inMessages: boolean; asScammer: boolean }

/**
 * Signs caught, keyed by tactic slug: correct Scam or Not? answers (including genuine messages, a strength)
 * and every move used in a Long Con story (seen from the inside, then explained in the debrief).
 */
export function caughtSigns(events: ProgressEvent[]): Map<string, Caught> {
  const m = new Map<string, Caught>()
  const get = (tactic: string) => {
    let c = m.get(tactic)
    if (!c) m.set(tactic, (c = { tactic, times: 0, inMessages: false, asScammer: false }))
    return c
  }
  for (const e of events) {
    const o = classify(e)
    if (o.type === 'answer' && o.correct && o.tactic) {
      const c = get(o.tactic)
      c.times++
      c.inMessages = true
    } else if (o.type === 'story') {
      for (const t of new Set(o.tactics)) {
        const c = get(t)
        c.times++
        c.asScammer = true
      }
    }
  }
  return m
}

/** Fraudle words solved ("safety words"), each once, in the order first solved. */
export function safetyWords(events: ProgressEvent[]): string[] {
  const words: string[] = []
  for (const e of events) {
    const o = classify(e)
    if (o.type === 'word' && o.solved && o.word && !words.includes(o.word)) words.push(o.word)
  }
  return words
}

export type PracticeItem = {
  tactic: string
  misses: number
  /** Caught correctly at least once after the most recent miss. */
  caughtSince: boolean
  lastMissAt: number
}

/**
 * The scam tactics worth practicing: Scam or Not? answers that missed a scam (genuine messages are
 * excluded; see `genuineMissed`). Ones not yet caught since the last miss come first, then by number of
 * misses, then most recent. Events must be oldest first.
 */
export function worthPracticing(events: ProgressEvent[], limit = 3): PracticeItem[] {
  const m = new Map<string, PracticeItem>()
  for (const e of events) {
    const o = classify(e)
    if (o.type !== 'answer' || !o.tactic || o.tactic === GENUINE) continue
    const item = m.get(o.tactic)
    if (!o.correct) {
      if (item) {
        item.misses++
        item.caughtSince = false
        item.lastMissAt = e.at
      } else m.set(o.tactic, { tactic: o.tactic, misses: 1, caughtSince: false, lastMissAt: e.at })
    } else if (item) item.caughtSince = true
  }
  return [...m.values()]
    .sort(
      (a, b) =>
        Number(a.caughtSince) - Number(b.caughtSince) || b.misses - a.misses || b.lastMissAt - a.lastMissAt
    )
    .slice(0, limit)
}

/** How many genuine messages were called scams (being extra careful, which is okay). */
export function genuineMissed(events: ProgressEvent[]): number {
  let n = 0
  for (const e of events) {
    const o = classify(e)
    if (o.type === 'answer' && !o.correct && o.tactic === GENUINE) n++
  }
  return n
}

export type Progress = {
  events: number
  points: number
  /** Highest total ever reached (for unlocks). */
  peak: number
  counts: Counts
  caught: Map<string, Caught>
  words: string[]
  practice: PracticeItem[]
  reflection: ReturnType<typeof latestReflection>
  genuineMissed: number
}

/** Everything the profile shows, from the activity rows (oldest first). */
export function deriveProgress(events: ProgressEvent[]): Progress {
  return {
    reflection: latestReflection(events),
    events: events.length,
    points: totalPoints(events),
    peak: peakPoints(events),
    counts: counts(events),
    caught: caughtSigns(events),
    words: safetyWords(events),
    practice: worthPracticing(events),
    genuineMissed: genuineMissed(events),
  }
}
