// The next game, shown locked on Home until the player has enough points. It is a placeholder: the game
// isn't built yet, so even "unlocked" only shows "coming soon". Change the threshold or the words here.

export const UPCOMING = {
  title: 'The Phone Call',
  kind: 'Coming next',
  /** One line on the Home card. */
  line: 'Is that really your bank calling? Practice spotting voice scams.',
  /** Points needed to unlock it: every finished game is 1 point (lib/progress.ts pointsFor), so 10 games. */
  unlockAt: 10,
  /** What the game will be, on the coming-soon page. */
  what: [
    'A pretend phone call from someone who says they’re your bank. Nobody really calls you, and nothing is dialed.',
    'You listen, decide when something doesn’t add up, then hang up and call back on a number you trust, like the one on the back of your card.',
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
