// Fraudle words. Keep every word between 4 and 8 letters so the tiles stay big enough to read
// on a small phone (8 letters is about 36px a tile at 360px wide).
// `lesson` is the one line shown after the word is solved or revealed.
// SMISH, SPOOF, CALLBACK, TRANSFER, URGENCY and GIFTCARD come from Krishna's word list (origin/web-app 8f415eb);
// the clues and lessons are our own.

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
    word: 'SMISH',
    clue: 'Phishing, but by text message.',
    lesson: 'A smishing text wants a quick tap. Don’t tap it: forward it to 7726 (SPAM) to report it, then delete it.',
  },
  {
    word: 'VERIFY',
    clue: 'Check that something is true.',
    lesson: 'Check by calling a number you already trust, never the one in the message.',
  },
  {
    word: 'BLOCK',
    clue: 'What you can do to a number that keeps sending you scam texts.',
    lesson: 'Blocking a scam number stops it coming back. Your phone’s settings or your carrier can help you do it.',
  },
  {
    word: 'CALLBACK',
    clue: 'A number in a message that asks you to call it.',
    lesson: 'A number printed in a message belongs to whoever wrote it. Call the number on your card or bill instead.',
  },
  {
    word: 'PHISHING',
    clue: 'Fake emails that fish for your details.',
    lesson: 'A link in a surprise message can lead to a fake sign-in page. Go to the website yourself instead.',
  },
  {
    word: 'SPOOF',
    clue: 'To fake a name or number so it looks like someone you trust.',
    lesson: 'Caller ID and sender names can be faked. Hang up and call back on a number you already trust.',
  },
  {
    word: 'DOUBT',
    clue: 'A feeling that you are not sure something is true.',
    lesson: 'It’s okay to doubt a surprising message. A real company won’t mind if you check.',
  },
  {
    word: 'GIFTCARD',
    clue: 'A store card (one word here) that no real bill is ever paid with.',
    lesson: 'No real bank, agency or family member asks to be paid with gift card numbers. That request alone means scam.',
  },
  {
    word: 'IMPOSTER',
    clue: 'Someone pretending to be someone else.',
    lesson: 'Scammers pretend to be banks, family or officials. Hang up and contact them yourself.',
  },
  {
    word: 'TRANSFER',
    clue: 'Moving your phone number to a new carrier, or your money to a new account.',
    lesson: 'Lost service right after a number transfer or SIM change you didn’t ask for? Contact your carrier from another phone right away.',
  },
  {
    word: 'PASSWORD',
    clue: 'Keep this secret, even from someone who says they are “support.”',
    lesson: 'Your bank will never ask for your password or a one-time code. Anyone who does is not your bank.',
  },
  {
    word: 'URGENCY',
    clue: 'The feeling that you have to act right now.',
    lesson: 'Urgency is a scammer’s favorite tool. A real problem can wait the few minutes it takes to check.',
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
