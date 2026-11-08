// Fraudle words. The board adapts to any word between 4 and 12 letters.
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
    word: 'PHISHING',
    clue: 'Fake emails that fish for your details.',
    lesson: 'A link in a surprise message can lead to a fake sign-in page. Go to the website yourself instead.',
  },
  {
    word: 'SKEPTICAL',
    clue: 'Not quick to believe what you are told.',
    lesson: 'It’s okay to doubt a surprising message. A real company won’t mind if you check.',
  },
  {
    word: 'SUSPICIOUS',
    clue: 'A feeling that something is not right.',
    lesson: 'If something feels off, trust that feeling and ask someone before you act.',
  },
  {
    word: 'IMPERSONATOR',
    clue: 'Someone pretending to be someone else.',
    lesson: 'Scammers pretend to be banks, family or officials. Hang up and contact them yourself.',
  },
]
