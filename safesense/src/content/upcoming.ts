// The fourth game, shown locked on Home until the player has enough points. Unlocked, its page lets SafeSense
// place a practice scam call (private beta: invited numbers only, spacetimedb-ts/src/challenge.ts).
// The single source for the threshold and the words: Home's card, Profile's "Next unlock" and the page read it.

export const UPCOMING = {
  title: 'The Phone Call',
  kind: 'Practice call',
  /** One line on the Home card. */
  line: 'Is that really your bank calling? Practice spotting voice scams.',
  /** Points needed to unlock it: every finished game is 1 point (lib/progress.ts pointsFor), so 2 games. */
  unlockAt: 2,
  /** How it works, on its page. */
  what: [
    'SafeSense calls your phone with a practice scam: a pretend caller who says they’re from your bank. It’s a practice call from SafeSense, not a real one, and nothing is at risk.',
    'Listen, decide when something doesn’t add up, then hang up. A finished practice call earns 1 point, and your points never go down.',
  ],
  /** Why phone scams are worth practicing. Kept calm, and no numbers unless they're sourced. */
  why: [
    'A voice on the phone can feel more real than a text. A caller can sound kind, worried or official, and the caller ID can be faked.',
    'It’s always fine to hang up. Your bank won’t mind if you call it back yourself.',
  ],
}

/** Points still needed to unlock the next game (0 once it's unlocked). */
export const pointsToGo = (points: number) => Math.max(0, UPCOMING.unlockAt - points)

/** Progress toward the unlock, from 0 to 1. */
export const unlockShare = (points: number) => Math.min(1, Math.max(0, points / UPCOMING.unlockAt))
