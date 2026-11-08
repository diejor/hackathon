// The Long Con: you play the scammer, one scene at a time, in a campaign narrated by a "handler".
// The engine (scenes, narrator lines, named tactics, simulated people reacting, a running count of people
// who believed it, a believability dial, and a debrief that turns each tactic into the defense it teaches)
// is adapted from Krishna's BadScam (HackUTD/mini-games/badscam, SafeSense team). The parcel-fee campaign
// is his story, lightly edited for US English and our fictional-brand rules. The two older three-step
// stories (SCENARIOS, below) are converted into the same engine by `fromStory`.
// US English, fictional names and brands, 555-01xx numbers and `.example` domains only.

export type TacticId =
  | 'impersonation'
  | 'urgency'
  | 'switch-channel'
  | 'bypass-verification'
  | 'small-amount'
  | 'secrecy'
  | 'emotional-pressure'
  | 'gift-cards'
  | 'authority'
  | 'fake-link'
  | 'code-request'
  | 'safe-account'
  | 'fake-sender'
  | 'fake-delivery'
  | 'prize-giveaway'
  | 'fake-badges'
  | 'lookalike-page'
  | 'callback-number'
  | 'stolen-card'
  | 'sim-swap'

export type Tactic = {
  name: string
  /** The defense as a short headline, for the debrief. Defaults to the name. */
  title?: string
  /** How a careful person spots this move, shown in the debrief. */
  spot: string
}

export const TACTICS: Record<TacticId, Tactic> = {
  impersonation: {
    name: 'Pretending to be family',
    title: 'A “new number” is a cue to check',
    spot: 'A “new number” from someone you love is the cue to call their old number or ask something only they would know.',
  },
  urgency: {
    name: 'Urgency',
    title: 'Pressure is the warning sign',
    spot: 'Real emergencies can wait the five minutes it takes to check. Pressure to act right now is the warning sign.',
  },
  'switch-channel': {
    name: 'Switching to another app or a call',
    title: 'Stay where you can check',
    spot: 'Being moved to another app or a callback number takes you away from where you can check. Use the contact details you already have.',
  },
  'bypass-verification': {
    name: 'Blocking the check',
    title: 'Excuses not to talk are a tell',
    spot: 'Lots of reasons why they can’t talk or meet means they don’t want to be checked. Insist on a real call.',
  },
  'small-amount': {
    name: 'A small, believable amount',
    title: 'Small amounts are the disguise',
    spot: 'A small amount feels too little to bother checking. That is exactly why scammers start small.',
  },
  secrecy: {
    name: 'Secrecy',
    title: 'Secrets about money are a red flag',
    spot: '“Don’t tell anyone” cuts you off from people who could help. Anyone asking for secrecy about money is a red flag.',
  },
  'emotional-pressure': {
    name: 'Emotional pressure',
    title: 'Strong feelings are a reason to pause',
    spot: 'Fear, worry or love can rush you. Strong feelings are a good moment to pause and talk to someone you trust.',
  },
  'gift-cards': {
    name: 'Gift cards',
    title: 'Gift cards mean scam',
    spot: 'No real bill, bank or family emergency is paid with gift card numbers. That request alone means scam.',
  },
  authority: {
    name: 'Pretending to be the bank',
    title: 'Any name can be typed',
    spot: 'A message can say any name. Contact the bank yourself using the number on the back of your card.',
  },
  'fake-link': {
    name: 'A fake link',
    title: 'Open the app yourself',
    spot: 'Banks don’t send links to “unlock” your account. Open the bank’s own app or type its address yourself.',
  },
  'code-request': {
    name: 'Asking for a code',
    title: 'A code is a key: never read it out',
    spot: 'A code sent to your phone is a key to your account. No real bank or company will ask you to read it out.',
  },
  'safe-account': {
    name: 'A “safe account”',
    title: 'No real bank moves your money to “protect” it',
    spot: 'A real bank never asks you to move your money to protect it. Hang up and call the number on your card.',
  },
  'fake-sender': {
    name: 'A trusted name as the sender',
    spot: 'The name at the top of a text is typed by whoever sent it. Treat it as a claim, not proof.',
  },
  'fake-delivery': {
    name: 'An ordinary delivery story',
    spot: 'A dull, believable package message is the dangerous kind. Check the order in the store’s own app, not from the text.',
  },
  'prize-giveaway': {
    name: 'A prize you never entered',
    spot: 'Free money and capital letters are the easy tell. You can’t win a contest you never entered.',
  },
  'fake-badges': {
    name: 'Security badges on the page',
    spot: 'Padlocks and “verified” badges are just pictures. Anyone can copy one onto a page.',
  },
  'lookalike-page': {
    name: 'A copycat web page',
    spot: 'A fake page can carry real links at the bottom. Read the web address itself, from the right.',
  },
  'callback-number': {
    name: 'A number to call back',
    spot: 'A number printed in a message belongs to whoever wrote it. Call the number on your card, bill or the company’s own app.',
  },
  'stolen-card': {
    name: 'A card payment form',
    spot: 'A payment page you reached from a text can keep your card number. Pay only inside the company’s own app or site.',
  },
  'sim-swap': {
    name: 'Taking over a phone number',
    spot: 'If your phone suddenly has no service and you didn’t ask for a new SIM, call your carrier from another phone right away.',
  },
}

export type Move = {
  tactic: TacticId
  /** What the player sends, written as the scammer. */
  text: string
  /** The simulated target's reply. */
  reply: string
  /** True when the move gets past the target. */
  works: boolean
  /** One line shown right after the reply: why it worked, or what the target noticed. */
  note: string
  /** For a move that fails: how the story ends (the target checked, so the con is over). */
  end?: string
}

export type Step = { title: string; moves: [Move, Move, Move] }

export type Scenario = {
  id: string
  title: string
  chip: string
  pitch: string
  /** Who the player pretends to be, as shown on their bubbles. */
  playerAs: string
  /** The simulated target, as shown on their bubbles. */
  target: string
  channel: string
  /** Times for the messages, one pair (yours, theirs) per step. */
  times: [string, string][]
  steps: [Step, Step, Step]
  fooledEnd: string
  caughtEnd: string
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'new-number-hi-mom',
    title: '“Hi Mom, new number”',
    chip: 'A new number',
    pitch: 'Pretend to be Emma, texting her mom from a new number, and ask for money.',
    playerAs: 'You, as “Emma”',
    target: 'Linda (Emma’s mom)',
    channel: 'Text message simulation',
    times: [
      ['10:42 AM', '10:43 AM'],
      ['10:45 AM', '10:46 AM'],
      ['10:48 AM', '10:50 AM'],
    ],
    steps: [
      {
        title: 'Make first contact',
        moves: [
          {
            tactic: 'impersonation',
            text: 'Hi Mom, it’s me! I dropped my phone in the sink 🙈 This is my new number, save it 💕',
            reply: 'Oh no, Emma! Okay, I’ll save it. Are you all right?',
            works: true,
            note: 'It worked. A casual, loving message from “family” rarely gets questioned.',
          },
          {
            tactic: 'urgency',
            text: 'MOM I’M IN TROUBLE. I need money RIGHT NOW. Please hurry!!',
            reply: 'Who is this? Emma doesn’t text like that. I’m going to call her on her old number.',
            works: false,
            note: 'Linda noticed. Panic from an unknown number made her want to check.',
            end: 'Linda called Emma on her old number. Emma was fine, at work. One call to a number Linda already had ended the scam, and no money was lost.',
          },
          {
            tactic: 'switch-channel',
            text: 'Hi Mom, my phone broke. Can you message me on WhatsApp at +1 (720) 555-0147 instead? Texts aren’t working.',
            reply: 'I don’t really use WhatsApp. Is this Emma? I’ll try, I guess.',
            works: true,
            note: 'It half worked. Linda went along, but moving apps made her a little unsure.',
          },
        ],
      },
      {
        title: 'Build the story',
        moves: [
          {
            tactic: 'bypass-verification',
            text: 'Please don’t call my old number, it’s at the repair shop. And the mic on this one is broken, so I can only text.',
            reply: 'Hmm, that’s a lot of broken things at once… but okay, sweetie.',
            works: true,
            note: 'It worked. Giving reasons not to call stops the one check that would end the scam.',
          },
          {
            tactic: 'small-amount',
            text: 'Can you help with an $85 phone bill? My banking app won’t work on the new phone. I’ll pay you back Friday.',
            reply: 'That’s not much. I suppose I could help you out.',
            works: true,
            note: 'It worked. A small, everyday amount feels too little to bother checking.',
          },
          {
            tactic: 'secrecy',
            text: 'Please don’t tell Dad about any of this, he’ll be so mad at me.',
            reply: 'Emma, we don’t keep secrets like that in this family. I’ll ask Dad what he thinks.',
            works: false,
            note: 'Linda pushed back. Asking for secrecy made her want to talk to someone else.',
            end: 'Linda told Emma’s dad, and he called Emma on her old number. Emma was fine, at work. The request for a secret is what made Linda talk to someone, and no money was lost.',
          },
        ],
      },
      {
        title: 'Ask for the money',
        moves: [
          {
            tactic: 'gift-cards',
            text: 'Can you buy two $200 gift cards and text me the numbers on the back? It’s the quickest way.',
            reply: 'Gift cards for a bill? That doesn’t sound right. I’m going to call you on your old number.',
            works: false,
            note: 'Linda caught it. Gift cards are a classic red flag, and she went to check.',
            end: 'Linda called Emma on her old number. Emma was fine, at work. Gift cards for a bill made her stop and check, and no money was lost.',
          },
          {
            tactic: 'emotional-pressure',
            text: 'I’m so stressed, I’ve been crying all morning 😢 Rent is due today and I’m $640 short. If it isn’t paid they’ll kick me out. Please, Mom.',
            reply: 'Oh, sweetheart. Okay, okay. Send me the details and I’ll do it now.',
            works: true,
            note: 'It worked. Worry for her daughter rushed Linda past her doubts.',
          },
          {
            tactic: 'urgency',
            text: 'It has to be paid in the next hour or there’s a $100 late fee! Can you send $640 to my landlord now?',
            reply: 'An hour? Okay, don’t panic. I’ll do it now, send me the details.',
            works: true,
            note: 'It worked. A deadline left no time to stop and check.',
          },
        ],
      },
    ],
    fooledEnd:
      'In real life, this is where the $640 would be gone. The real Emma was fine all along, at work with her phone in her pocket. One call to Emma’s old number would have ended it at any step.',
    caughtEnd: 'Linda called Emma on her old number. Emma was fine, at work. The scam ended there, and no money was lost.',
  },
  {
    id: 'bank-fraud-alert',
    title: 'A bank fraud alert',
    chip: 'A bank alert',
    pitch: 'Pretend to be Lakeshore Bank’s fraud team and talk a customer into moving his money.',
    playerAs: 'You, as “Lakeshore Bank”',
    target: 'Robert (bank customer)',
    channel: 'Text message simulation',
    times: [
      ['2:10 PM', '2:12 PM'],
      ['2:13 PM', '2:15 PM'],
      ['2:17 PM', '2:19 PM'],
    ],
    steps: [
      {
        title: 'Make first contact',
        moves: [
          {
            tactic: 'authority',
            text: 'Lakeshore Bank Fraud Dept: Did you try a $1,284.50 purchase in Miami, FL? Reply YES or NO.',
            reply: 'NO! I’m at home in Ohio. What’s going on?',
            works: true,
            note: 'It worked. It looks just like a real fraud alert, so Robert replied right away.',
          },
          {
            tactic: 'fake-link',
            text: 'Lakeshore Bank: Your account is LOCKED. Verify your identity now: lakeshore-secure.example/login',
            reply: 'My bank doesn’t send links like that. I’ll check my banking app instead.',
            works: false,
            note: 'Robert noticed. He went to his own app, where everything looked normal.',
            end: 'Robert opened his own banking app instead of your link. Everything looked normal, so he deleted the text. Nothing was taken.',
          },
          {
            tactic: 'small-amount',
            text: 'Lakeshore Bank: We stopped a $4.99 charge from “Streamly”. Was this you? Reply YES or NO.',
            reply: 'No, I don’t have that. Thanks for catching it.',
            works: true,
            note: 'It worked. A small charge seems harmless, and the “help” builds trust.',
          },
        ],
      },
      {
        title: 'Take control of the conversation',
        moves: [
          {
            tactic: 'switch-channel',
            text: 'A fraud specialist will call you now from +1 (888) 555-0188 to secure your account.',
            reply: 'Okay. I’ll pick up and hear what they say.',
            works: true,
            note: 'It worked. Moving to a phone call puts you in charge and away from the bank’s real number.',
          },
          {
            tactic: 'code-request',
            text: 'To confirm you are the account owner, reply with the 6-digit code we just sent you.',
            reply: 'The text with that code says never to share it, even with the bank. I’m not sending it.',
            works: false,
            note: 'Robert caught it. The code message itself warned him.',
            end: 'Robert kept the code to himself and called the number on the back of his card. The bank said there was no fraud, and nothing had been taken.',
          },
          {
            tactic: 'emotional-pressure',
            text: 'Robert, someone is trying to empty your checking account right now. We need to act fast to protect you.',
            reply: 'Oh no. That’s my savings. What do I need to do?',
            works: true,
            note: 'It worked. Fear for his savings made Robert ready to follow instructions.',
          },
        ],
      },
      {
        title: 'Move the money',
        moves: [
          {
            tactic: 'safe-account',
            text: 'To protect your money, move it to a secure holding account. I’ll give you the account details.',
            reply: 'A real bank wouldn’t ask me to move my own money. I’m hanging up and calling the number on my card.',
            works: false,
            note: 'Robert caught it. The “safe account” request is the clearest sign of this scam.',
            end: 'Robert hung up and called the number on his card. The bank said there was no fraud, and nothing had been taken. A real bank never asks you to move your money to keep it safe.',
          },
          {
            tactic: 'secrecy',
            text: 'Stay on the line and don’t tell the branch staff. They may be part of the fraud.',
            reply: 'Wow. Okay… I won’t say anything to them.',
            works: true,
            note: 'It worked. Cutting Robert off from the real bank left him with only you to trust.',
          },
          {
            tactic: 'urgency',
            text: 'You have 10 minutes before the money is gone. Please do exactly what I say.',
            reply: 'Then I’m driving to my branch right now to sort this out in person.',
            works: false,
            note: 'Robert pushed back. With a deadline, he chose to check in person.',
            end: 'Robert drove to his branch. The staff found no fraud on his account, and nothing had been taken. A deadline made him check, not hurry.',
          },
        ],
      },
    ],
    fooledEnd:
      'In real life, Robert would now send his savings to an account you control. His real account was never in danger until he moved the money. One call to the number on his card would have stopped it at any step.',
    caughtEnd:
      'Robert called the number on the back of his card. The bank said there was no fraud, and nothing had been taken. The scam ended there.',
  },
]

// ---------------------------------------------------------------------------------------------------
// The campaign engine's content model (adapted from BadScam's SCENES / LESSONS).

/** A simulated person who reacts to your campaign. Every one is invented. */
export type Person = {
  id: string
  name: string
  /** One short line about them, shown under their name. */
  bio: string
  /** Avatar color, 1-4 (see longcon.css). */
  tone: 1 | 2 | 3 | 4
}

/** How a simulated person ended up treating your message. */
export type Reaction = 'believed' | 'checked'

export type Entry =
  /** The narrator (your "handler") talking to you. */
  | { t: 'say'; text: string }
  /** A message you send, wearing a costume. */
  | { t: 'sent'; as: string; bio: string; text: string }
  /** A simulated person posting or replying. */
  | { t: 'post'; who: string; text: string }

export type Option = {
  /** The button text. */
  label: string
  /** The named tactic, logged to your profile. Optional for chat choices like "That's right". */
  tactic?: TacticId
  /** A tactic this choice deliberately leaves out ("Let her go"). Shown in the debrief as "You held back", never logged. */
  held?: TacticId
  /** The defense this choice teaches: [title, explanation]. Defaults to the tactic's own lesson. */
  lesson?: [string, string]
  /** Change in people who believed it (BadScam's "marks"). */
  reach?: number
  /** Change in believability, out of 100 (BadScam's "credibility"). */
  cred?: number
  /** How each simulated person reacts. Someone who has checked stays checked: a later "believed" is ignored. */
  react?: Record<string, Reaction>
  out: Entry[]
  /** Used instead of `out` when this person has already checked (so they don't fall for it after all). */
  outIfChecked?: { who: string; out: Entry[] }
  /** Ends the campaign after this choice, with this as the ending text (the only person checked). */
  end?: string
}

export type Scene = {
  lead: Entry[]
  /** Reactions that happen as the scene opens. */
  react?: Record<string, Reaction>
  ask: Option[]
}

export type EndState = {
  reach: number
  cred: number
  people: Person[]
  status: Record<string, Reaction>
  /** The ending text of the choice that ended the campaign early, if one did. */
  end?: string
}

export type Campaign = {
  id: string
  title: string
  chip: string
  pitch: string
  icon: 'parcel' | 'phone' | 'bank'
  /** How many texts go out, shown under the count of people who believed it. */
  sentTo: number
  people: Person[]
  scenes: Scene[]
  /** One or two sentences for the ending card. */
  ending: (s: EndState) => string
}

/** Believability starts here, out of 100. */
export const START_CRED = 50
/** Below this, the gentle "people are starting to doubt it" note shows. */
export const LOW_CRED = 25

/** The safety framing line, said in every campaign. */
export const SAFETY_LINE =
  'Every brand here is invented, every victim is a simulation, and nothing leaves this screen.'

const say = (text: string): Entry => ({ t: 'say', text })
const post = (who: string, text: string): Entry => ({ t: 'post', who, text })
const sent = (as: string, bio: string, text: string): Entry => ({ t: 'sent', as, bio, text })

const PARCELO = ['Parcelo Support', 'Delivery partner · Official notifications'] as const

const SENDER_LESSON: [string, string] = [
  'A sender name is a claim, not proof',
  'The name on a text is typed by whoever sent it. Treat the brand at the top as the least reliable part of the message.',
]

const PARCEL: Campaign = {
  id: 'parcel-fee-smish',
  title: 'The package fee text',
  chip: 'A package fee',
  pitch: 'Run a whole scam text campaign as “Parcelo Support”, one move at a time, and watch who falls for it.',
  icon: 'parcel',
  sentTo: 10000,
  people: [
    { id: 'dana', name: 'Dana', bio: 'Teacher · three kids, zero free evenings', tone: 1 },
    { id: 'ben', name: 'Ben', bio: 'Engineer · reports everything', tone: 2 },
    { id: 'priya', name: 'Priya', bio: 'Nurse · works night shifts', tone: 3 },
    { id: 'sam', name: 'Sam', bio: 'Retired · reads everything twice', tone: 4 },
  ],
  scenes: [
    {
      lead: [
        say('Hi there. Welcome to the text desk.'),
        say('Today you send the scam texts instead of receiving them. Does that still sound right?'),
      ],
      ask: [
        {
          label: 'That’s right',
          out: [
            say('Good. Rule one, before you touch a keyboard: you are not trying to fool everybody. You are trying to fool one person having a busy Tuesday.'),
          ],
        },
        {
          label: 'Wait, what?',
          out: [
            say(`Relax. ${SAFETY_LINE} You’re learning the moves so you recognize them later.`),
            say('Rule one: you are not trying to fool everybody. You are trying to fool one person having a busy Tuesday.'),
          ],
        },
      ],
    },
    {
      lead: [say('First you need a name people already trust. Who do you want to be?')],
      ask: [
        {
          label: 'A delivery company',
          tactic: 'fake-sender',
          lesson: SENDER_LESSON,
          reach: 12,
          cred: 6,
          out: [
            sent(...PARCELO, 'Parcelo: we tried to deliver package 6712 today.'),
            say('Nobody checks a sender name. It’s a claim typed into a box, not proof of anything. You’re Parcelo now because you said so.'),
          ],
        },
        {
          label: 'A bank fraud desk',
          tactic: 'fake-sender',
          lesson: SENDER_LESSON,
          reach: 15,
          cred: 4,
          out: [
            sent('Meridian Trust', 'Fraud prevention · Do not reply', 'Meridian Trust security: unusual activity flagged on your account.'),
            say('A fraud desk is a clever costume. When people are worried about fraud, they want to believe the fraud desk.'),
            say('Today’s list is people waiting on packages, though, so for the rest of the game you’ll be “Parcelo Support”. Changing costumes costs nothing.'),
          ],
        },
      ],
    },
    {
      lead: [say('Now the story. Two drafts are on your desk. Which one goes out to ten thousand phones?')],
      ask: [
        {
          label: 'Package 6712 could not be delivered. Confirm your address.',
          tactic: 'fake-delivery',
          lesson: [
            'The dangerous message is the ordinary one',
            'Scams that work are dull and specific: a package, a fee, a bill. Judge what the message asks you to do, not its spelling.',
          ],
          reach: 46,
          cred: 12,
          react: { dana: 'believed' },
          out: [
            post('dana', 'ugh my package is stuck again, confirming now'),
            say('Boring, and boring is the whole trick. Half the city is waiting on a package, so half the city thinks this one is theirs.'),
          ],
        },
        {
          label: 'CONGRATULATIONS!!! You have WON a $1,000 gift card!!!',
          tactic: 'prize-giveaway',
          lesson: ['Prizes are the easy tell', 'You can spot this one instantly, which is why real scammers avoid it. Expect boring instead.'],
          reach: 6,
          cred: -26,
          react: { ben: 'checked' },
          out: [
            post('ben', 'three exclamation marks and a prize I never entered. blocked and reported.'),
            say('You just announced yourself. Capital letters and free money are what people are taught to look for, so the careful ones block you, and your believability drops.'),
          ],
        },
      ],
    },
    {
      lead: [say('People are starting to look you up. Make the page behind that link look real.')],
      ask: [
        {
          label: 'Paste a row of security badges on the page',
          tactic: 'fake-badges',
          lesson: [
            'Padlocks and badges are decoration',
            'Trust badges are pictures on a page. Anyone can copy one. They prove nothing about who owns the site.',
          ],
          reach: 11,
          cred: -6,
          out: [
            say('Badges are pictures. Anyone can save a picture of a padlock. The careful ones zoom in and see a blurry logo nobody can click.'),
          ],
        },
        {
          label: 'Point the footer links at the real company’s site',
          tactic: 'lookalike-page',
          lesson: [
            'Real links inside a fake page',
            'Researchers have found copycat pages whose footer links opened the genuine company site. Testing one link at the bottom is not a check. Read the address bar from the right.',
          ],
          reach: 38,
          cred: 22,
          react: { ben: 'believed' },
          out: [
            post('ben', 'checked the small print links at the bottom, they open the actual Parcelo privacy page. ok this one looks fine'),
            say('That’s the good one. Real links on a fake page cost you nothing and buy you a lot. He tested a footer instead of the address bar, which is an easy check to get wrong.'),
          ],
          outIfChecked: {
            who: 'ben',
            out: [
              say('That’s the good one. Real links on a fake page cost you nothing and buy you a lot: anyone who tests a footer instead of the address bar walks right in.'),
              say('Not Ben, though. He already blocked you over the prize text, so he never sees this page.'),
            ],
          },
        },
      ],
    },
    {
      lead: [say('The page is ready. Now, how long do they get to think about it?')],
      ask: [
        {
          label: 'Give them a week',
          held: 'urgency',
          lesson: [
            'Pressure is the ingredient to look for',
            'You chose not to rush anyone, and fewer people fell for it. That’s how much urgency is worth to a scammer.',
          ],
          reach: 16,
          cred: 6,
          out: [
            say('Safe, but slow. A week is long enough for someone to show the text to a friend, and a friend asking “is that real?” is exactly the kind of check that beats you.'),
          ],
        },
        {
          label: 'Give them until midnight tonight',
          tactic: 'urgency',
          lesson: [
            'A deadline exists to delete your pause',
            'Tonight, within the hour, final notice. When a message hurries you, that’s the moment to stop and check somewhere else.',
          ],
          reach: 48,
          cred: -6,
          react: { dana: 'believed' },
          out: [
            post('dana', 'wait it says the delivery slot closes at midnight?? paying now before I lose it'),
            say('A deadline deletes the only step that beats you: the pause where somebody checks. Dana isn’t careless. She’s busy, and the clock did the rest.'),
          ],
        },
      ],
    },
    {
      lead: [say('Time to ask for something. This is where beginners get greedy.')],
      ask: [
        {
          label: 'Ask for a $2.99 redelivery fee',
          tactic: 'small-amount',
          lesson: [
            'The small amount is the disguise',
            'Nobody disputes three dollars. The fee isn’t the theft, the card form is. Any payment page you reach from a message deserves the same suspicion as a big one.',
          ],
          reach: 42,
          cred: 4,
          react: { dana: 'believed' },
          out: [
            post('dana', 'fine, three dollars, whatever. card details in.'),
            say('Nobody calls their bank over three dollars. And you never wanted the three dollars. You wanted the sixteen digits typed in above it.'),
          ],
        },
        {
          label: 'Ask them to text back the 6-digit code',
          tactic: 'code-request',
          lesson: [
            'Codes asked for out of nowhere',
            'A code belongs only on the screen where you started signing in. Read what the code says it is for, and never let anyone talk you past it.',
          ],
          reach: 24,
          cred: -16,
          react: { ben: 'checked' },
          out: [
            post('ben', 'a delivery company wants my login code? no.'),
            say('Too fast. A code out of nowhere smells wrong, even to tired people. Scammers earn the code later, once people believe they’re being helped.'),
          ],
          outIfChecked: {
            who: 'ben',
            out: [
              say('Too fast. A code out of nowhere smells wrong, even to tired people. Scammers earn the code later, once people believe they’re being helped.'),
            ],
          },
        },
      ],
    },
    {
      lead: [
        post('priya', 'Not tapping anything in a text. I’ll call support and check this properly.'),
        say('Here comes a careful one. Careful people still tend to trust a number printed in the message.'),
      ],
      ask: [
        {
          label: 'Put a support number in the message',
          tactic: 'callback-number',
          lesson: [
            'Who chose the number you called?',
            'A number printed in a message belongs to whoever wrote the message. A check only counts when you pick the route: the app on your home screen, or the number on your card or bill.',
          ],
          reach: 54,
          cred: 14,
          react: { priya: 'believed' },
          out: [
            sent(...PARCELO, 'Questions about your delivery? Call Parcelo Support at (888) 555-0142.'),
            post('priya', 'called the number on the notice, spoke to an agent, he confirmed the package and read out my case number. gave him the code he asked for.'),
            say('She did check, just through you. You wrote the notice, so you chose the number, so you answered the phone.'),
          ],
        },
        {
          label: 'Let her go',
          held: 'callback-number',
          lesson: [
            'Her own route beat the whole campaign',
            'Opening her order history herself cost nothing and ended the scam. That’s the habit this game is trying to build.',
          ],
          reach: 2,
          cred: 6,
          react: { priya: 'checked' },
          out: [
            post('priya', 'opened my order history myself. no package, no fee owed. forwarded the text to 7726.'),
            say('One got away. She found her own route to support instead of the one you handed her, and that one move beats this whole playbook.'),
          ],
        },
      ],
    },
    {
      lead: [say('Card numbers are one day of work. There’s something better sitting in that phone.')],
      ask: [
        {
          label: 'Collect the card numbers and move on',
          tactic: 'stolen-card',
          lesson: [
            'Card theft is the loss you can see',
            'Banks reverse some of it. If you typed your card into a page from a text, call the number on the back of the card and ask for a new one.',
          ],
          reach: 22,
          cred: 4,
          out: [say('Steady money. The bank reverses half of it by Friday, and the cards get canceled.')],
        },
        {
          label: 'Take over the phone number itself',
          tactic: 'sim-swap',
          lesson: [
            'Losing service is an emergency, not a glitch',
            'A SIM change or number transfer you didn’t ask for means someone is collecting your password resets. Call your carrier from another phone, using the number on your bill.',
          ],
          reach: 62,
          cred: -12,
          react: { dana: 'believed' },
          out: [
            sent('Meridian Mobile', 'Account notifications', 'Your SIM change request is complete. Service will move to the new device shortly.'),
            post('dana', 'my phone has no bars?? and I never asked for a new SIM'),
            say('Her number receives every password reset she’ll ever need. Move the line, and her email, her bank and her photos follow it. With no service she can’t easily phone for help, which is why losing bars out of nowhere is an emergency.'),
          ],
        },
      ],
    },
    {
      react: { sam: 'checked' },
      lead: [
        post('sam', 'Got a Parcelo text about a held package and a fee. Didn’t tap it. Opened my order history myself, nothing waiting. Forwarded the text to 7726 and blocked the sender.'),
        say('Nothing in your playbook touches him. No deadline, no number of yours, no footer to test. And his report gets your sender blocked for everyone else.'),
        say('That’s how most campaigns like this one end. You know the playbook now. Want to see how people beat it?'),
      ],
      ask: [
        {
          label: 'Show me how people beat it',
          reach: -70,
          cred: -10,
          out: [say('Every move you made has a habit that beats it. Sam used the best one: he went to Parcelo himself, by a route you didn’t give him.')],
        },
        {
          label: 'That was uncomfortable',
          reach: -70,
          cred: -10,
          out: [
            say('It should be. That feeling is the same pressure a real text puts on you, and noticing it is the first step to beating it. Sam’s habit is the best one: he went to Parcelo himself, by a route you didn’t give him.'),
          ],
        },
      ],
    },
  ],
  ending: ({ cred, people, status }) => {
    const met = people.filter((p) => p.id !== 'sam')
    const fell = met.filter((p) => status[p.id] === 'believed').map((p) => p.name)
    const checked = met.filter((p) => status[p.id] === 'checked').map((p) => p.name)
    const c = Math.round(cred)
    const look =
      c >= 50
        ? `Your texts still looked believable at the end (${c} out of 100), which is why real campaigns like this one work.`
        : c < LOW_CRED
          ? `Your believability ended at ${c} out of 100: most people doubted it, and texts this obvious get blocked fast.`
          : `Your believability ended at ${c} out of 100.`
    const who = [
      fell.length ? `${names(fell)} believed it.` : 'None of the people you followed believed it.',
      checked.length ? `${names(checked)} checked first.` : '',
    ]
    return [
      look,
      ...who,
      'Then you met Sam, who checked his order history himself, and his report got your sender blocked. Every person who beat you did the same thing: they paused and checked by a route they chose.',
    ]
      .filter(Boolean)
      .join(' ')
  },
}

/** "Dana", "Dana and Ben", "Dana, Ben and Priya". */
function names(list: string[]) {
  return list.length < 3 ? list.join(' and ') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

/** Narrator lines for the older three-step stories. */
type StoryVoice = { intro: string[]; ready: string; wait: string; steps: [string, string, string] }

const VOICES: Record<string, StoryVoice> = {
  'new-number-hi-mom': {
    intro: [
      'Welcome to the family desk. Today’s script is old, and it still works: pretend to be someone’s grown-up child, texting from a new number.',
      'Your list has five thousand parents on it. You’ll follow one of them: Linda. Her daughter is called Emma.',
    ],
    ready: 'Rule one: you are not trying to fool every parent. You only need the ones whose kid really might have broken a phone.',
    wait: `It’s practice. ${SAFETY_LINE} You’re learning the moves so you recognize them if “your kid” ever texts from a new number.`,
    steps: [
      'First text. How does “Emma” say hello?',
      'Linda is listening. Now give her a reason not to check, or a reason to help.',
      'Time to ask for the money. This is where it works, or falls apart. One check from Linda and it’s over.',
    ],
  },
  'bank-fraud-alert': {
    intro: [
      'Welcome to the bank desk. Today you’re “Lakeshore Bank’s fraud team”. Lakeshore is invented, and so is everyone you’ll talk to.',
      'Your texts go to eight thousand phones. You’ll follow one customer: Robert, at home in Ohio.',
    ],
    ready: 'Rule one: when people are worried about fraud, they want to believe the fraud team. Your job is to sound like one.',
    wait: `It’s practice. ${SAFETY_LINE} You’re learning the moves so you recognize a fake fraud alert when one is aimed at you.`,
    steps: [
      'First text. How does the “fraud team” say hello?',
      'Robert is worried. Now take control of the conversation.',
      'Last move: get the money to move.',
    ],
  },
}

/** Rebuild one of the older three-step stories as a campaign in the new engine. */
function fromStory(s: Scenario, person: Person, sentTo: number, icon: Campaign['icon']): Campaign {
  const voice = VOICES[s.id]
  const reach = [60, 45, 35]
  const sender = s.playerAs.replace(/^You, as “(.*)”$/, '$1')
  return {
    id: s.id,
    title: s.title,
    chip: s.chip,
    pitch: s.pitch,
    icon,
    sentTo,
    people: [person],
    scenes: [
      {
        lead: voice.intro.map(say),
        ask: [
          { label: 'I’m ready', out: [say(voice.ready)] },
          { label: 'Wait, is this real?', out: [say(voice.wait), say(voice.ready)] },
        ],
      },
      ...s.steps.map(
        (step, i): Scene => ({
          lead: [say(voice.steps[i])],
          ask: step.moves.map(
            (m): Option => ({
              label: m.text,
              tactic: m.tactic,
              reach: m.works ? reach[i] : 0,
              cred: m.works ? 12 : -20,
              react: { [person.id]: m.works ? 'believed' : 'checked' },
              out: [
                sent(sender, 'Text message', m.text),
                post(person.id, m.reply),
                say(m.note),
                ...(m.works ? [] : [say(`That’s the end of the con. Once ${person.name} checks, there’s nothing left for you to do.`)]),
              ],
              end: m.works ? undefined : (m.end ?? s.caughtEnd),
            })
          ),
        })
      ),
    ],
    ending: ({ status, end }) => end ?? (status[person.id] === 'believed' ? s.fooledEnd : s.caughtEnd),
  }
}

export const CAMPAIGNS: Campaign[] = [
  PARCEL,
  fromStory(SCENARIOS[0], { id: 'linda', name: 'Linda', bio: 'Emma’s mom · trusts her kids', tone: 3 }, 5000, 'phone'),
  fromStory(SCENARIOS[1], { id: 'robert', name: 'Robert', bio: 'Lakeshore Bank customer · at home in Ohio', tone: 2 }, 8000, 'bank'),
]

/** The lesson a choice teaches: its own, or its tactic's. */
export function lessonFor(o: Option): [string, string] | null {
  if (o.lesson) return o.lesson
  const t = o.tactic ?? o.held
  if (t) return [TACTICS[t].title ?? TACTICS[t].name, TACTICS[t].spot]
  return null
}
