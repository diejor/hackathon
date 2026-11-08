// Which parts of a Scam or Not? message to mark once the player has checked a piece of evidence.
// Pure functions, kept apart from the components so React Fast Refresh stays happy.
import type { InspectTarget, Scenario } from '../../content/scamOrNot'

/** The places in the sender card and message where evidence can be marked. */
export type Field = 'name' | 'bio' | 'details' | 'from' | 'subject' | 'body' | 'link'

/** Text to mark in each field. A field missing from the map has nothing marked. */
export type Marks = Partial<Record<Field, string[]>>

const FIELDS: Record<InspectTarget, Field[]> = {
  sender: ['name', 'bio', 'details', 'from'],
  number: ['name', 'from', 'details', 'body'],
  link: ['link'],
  body: ['subject', 'body'],
}

/** With no `highlight`, the whole of this field is marked instead. */
const WHOLE: Record<InspectTarget, Field> = { sender: 'name', number: 'from', link: 'link', body: 'body' }

function fieldText(s: Scenario, f: Field): string[] {
  if (f === 'details') return s.details
  const v = s[f]
  return v ? [v] : []
}

/** Marks for the checks the player has opened (indexes into `s.inspect`). */
export function marksFor(s: Scenario, opened: number[]): Marks {
  const marks: Marks = {}
  const add = (f: Field, text: string) => (marks[f] ??= []).push(text)
  for (const i of opened) {
    const c = s.inspect[i]
    if (!c) continue
    if (!c.highlight) {
      for (const t of fieldText(s, WHOLE[c.target])) add(WHOLE[c.target], t)
      continue
    }
    for (const f of FIELDS[c.target]) if (fieldText(s, f).some((t) => t.includes(c.highlight!))) add(f, c.highlight)
  }
  return marks
}

/** Split `text` into plain and marked runs (every occurrence of any needle; longest needle wins on overlap). */
export function splitMarks(text: string, needles: string[] = []): { text: string; marked: boolean }[] {
  const ns = [...new Set(needles.filter(Boolean))].sort((a, b) => b.length - a.length)
  if (!ns.length) return [{ text, marked: false }]
  const escape = (n: string) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text
    .split(new RegExp(`(${ns.map(escape).join('|')})`, 'g'))
    .filter(Boolean)
    .map((t) => ({ text: t, marked: ns.includes(t) }))
}
