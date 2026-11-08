// "Signs you can spot" on the profile page: every tactic slug the games log, in plain words.
// Scam or Not? logs the message bank's slugs (content/scamOrNot.ts); The Long Con logs its move ids
// (content/longCon.ts). `tell` is the tell-tale sign, reused from the games so the wording stays the same.
import type { Route } from '../router'
import { REMEMBER } from './scamOrNot'
import { TACTICS, type TacticId } from './longCon'

export type Sign = {
  slug: string
  /** Plain-words name. */
  name: string
  /** One line: what this sign looks like. */
  line: string
  /** The tell-tale sign to remember. */
  tell: string
  /** The game that trains it. */
  train: Route
}

const message = (slug: string, name: string, line: string): Sign => ({
  slug,
  name,
  line,
  tell: REMEMBER[slug] ?? line,
  train: 'scam-or-not',
})

const move = (slug: TacticId, line: string): Sign => ({
  slug,
  name: TACTICS[slug].name,
  line,
  tell: TACTICS[slug].spot,
  train: 'long-con',
})

/** Kinds of scam message (Scam or Not?). */
export const MESSAGE_SIGNS: Sign[] = [
  message('fake-delivery', 'Fake delivery fees', 'A text about a package that asks for a small fee.'),
  message('bank-impersonation', 'Fake bank alerts', 'A “bank” message with a deadline and a link.'),
  message('family-emergency', '“Family” in trouble', 'A loved one on a new number who needs money fast.'),
  message('tech-support', 'Surprise bills to call about', 'An unexpected charge with a number to ring.'),
  message('prize-giveaway', 'Prizes you pay for', 'A win that needs a fee or your card first.'),
  message('romance', 'Fast online romance', 'A new admirer who wants to move to another app.'),
  message('job-offer', 'Too-good-to-be-true jobs', 'Easy money offered out of the blue.'),
  message('carrier-impersonation', 'Lookalike web addresses', 'A familiar name at the start of a link that belongs to another site.'),
  message('account-locked-otp', 'Requests for your codes', '“Support” asking you to send them a code you were texted.'),
]

/** A genuine message: spotting one is a strength, not a sign of a scam. */
export const GENUINE_SIGN: Sign = message(
  'legit',
  'A genuine message',
  'Knowing when a message is just information and asks for nothing.'
)

/** Moves seen from the scammer’s side (The Long Con). */
export const MOVE_SIGNS: Sign[] = [
  move('impersonation', 'Someone you love, on a “new number”.'),
  move('authority', 'Using a bank’s name to sound official.'),
  move('urgency', 'Pushing you to act right now.'),
  move('emotional-pressure', 'Using worry or love to rush you.'),
  move('secrecy', '“Don’t tell anyone about this.”'),
  move('switch-channel', 'Moving you to another app or a callback number.'),
  move('bypass-verification', 'Excuses for why they can’t talk or meet.'),
  move('small-amount', 'Starting with a small, easy amount.'),
  move('gift-cards', 'Asking to be paid in gift cards.'),
  move('fake-link', 'A link to “unlock” or “confirm” something.'),
  move('code-request', 'Asking you to read out a code sent to you.'),
  move('safe-account', 'Moving your money to keep it “safe”.'),
  move('sender-name', 'A familiar company name typed at the top of a text.'),
  move('callback-number', 'A phone number to call, printed in the message itself.'),
  // 'prize-giveaway' is also a Long Con move; it shares the Scam or Not? tile above.
]

const ALL = [...MESSAGE_SIGNS, GENUINE_SIGN, ...MOVE_SIGNS]

/** Look up a logged tactic slug; unknown slugs (older or demo data) get a readable fallback. */
export function signFor(slug: string): Sign {
  const known = ALL.find((s) => s.slug === slug)
  if (known) return known
  const name = slug.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  return {
    slug,
    name,
    line: 'A kind of scam you have practiced spotting.',
    tell: 'Most scams rush you. If a message wants money, a code or a click right now, pause and check another way.',
    train: 'scam-or-not',
  }
}

/** True for slugs that have their own tile above. */
export const isKnownSign = (slug: string) => ALL.some((s) => s.slug === slug)
