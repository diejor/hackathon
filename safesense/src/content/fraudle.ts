// Fraudle words. Keep every word between 4 and 8 letters so the tiles stay big enough to read
// on a small phone (8 letters is about 36px a tile at 360px wide).
// `lesson` is the one line shown after the word is solved or revealed.

export type Puzzle = { word: string; clue: string; lesson: string }

export const PUZZLES: Puzzle[] = [
  {
    word: 'PAUSE',
    clue: 'Stop for a moment before you act.',
    lesson: 'Most scams need you to act fast. A pause breaks the spell.',
  },
  {
    word: 'SCAM',
    clue: 'A trick to take your money.',
    lesson: 'Scams can fool anyone. Spotting them is a skill you can practice, not a matter of luck.',
  },
  {
    word: 'VERIFY',
    clue: 'Check that something is true.',
    lesson: 'Check by calling a number you already trust, never the one in the message.',
  },
  {
    word: 'URGENT',
    clue: 'A message that says you must act right now.',
    lesson: 'Pressure to hurry is a warning sign. A real bank or agency will give you time to check.',
  },
  {
    word: 'PHISHING',
    clue: 'Fake emails that fish for your details.',
    lesson: 'A link in a surprise message can lead to a fake sign-in page. Go to the website yourself instead.',
  },
  {
    word: 'DOUBT',
    clue: 'A feeling that you are not sure something is true.',
    lesson: 'It’s okay to doubt a surprising message. A real company won’t mind if you check.',
  },
  {
    word: 'IMPOSTER',
    clue: 'Someone pretending to be someone else.',
    lesson: 'Scammers pretend to be banks, family or officials. Hang up and contact them yourself.',
  },
  {
    word: 'PASSWORD',
    clue: 'Keep this secret, even from someone who says they are “support.”',
    lesson: 'Your bank will never ask for your password or a one-time code. Anyone who does is not your bank.',
  },
  {
    word: 'REFUND',
    clue: 'Money back that a stranger says you are owed.',
    lesson: 'A surprise refund that needs your bank login or access to your computer is a scam.',
  },
  {
    word: 'WARY',
    clue: 'Careful about something that might not be safe.',
    lesson: 'If something feels off, trust that feeling and ask someone before you act.',
  },
]
