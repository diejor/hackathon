// The Long Con: the player writes as the scammer, and a simulated, careful-but-human target replies.
// Each step offers three moves; each move is one named tactic. Some moves "work" (to show why scams
// succeed), others hit a classic red flag and the target pushes back. US English, fictional names,
// 555-01xx numbers and `.example` domains only. Drawn in part from Krishna's archetypes and tactic list
// (combined:safe-signal/data/scam-archetypes.json, src/contracts.ts). The third story, "parcel-fee-smish", is
// rewritten from his BadScam game and its lessons (origin/web-app 8f415eb, mini-games/badscam/scenarios.js).

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
  | 'sender-name'
  | 'prize-giveaway'
  | 'callback-number'

export type Tactic = {
  name: string
  /** How a careful person spots this move, shown in the debrief. */
  spot: string
}

export const TACTICS: Record<TacticId, Tactic> = {
  impersonation: {
    name: 'Pretending to be family',
    spot: 'A “new number” from someone you love is the cue to call their old number or ask something only they would know.',
  },
  urgency: {
    name: 'Urgency',
    spot: 'Real emergencies can wait the five minutes it takes to check. Pressure to act right now is the warning sign.',
  },
  'switch-channel': {
    name: 'Switching to another app or a call',
    spot: 'Being moved to another app or a callback number takes you away from where you can check. Use the contact details you already have.',
  },
  'bypass-verification': {
    name: 'Blocking the check',
    spot: 'Lots of reasons why they can’t talk or meet means they don’t want to be checked. Insist on a real call.',
  },
  'small-amount': {
    name: 'A small, believable amount',
    spot: 'A small amount feels too little to bother checking. That is exactly why scammers start small.',
  },
  secrecy: {
    name: 'Secrecy',
    spot: '“Don’t tell anyone” cuts you off from people who could help. Anyone asking for secrecy about money is a red flag.',
  },
  'emotional-pressure': {
    name: 'Emotional pressure',
    spot: 'Fear, worry or love can rush you. Strong feelings are a good moment to pause and talk to someone you trust.',
  },
  'gift-cards': {
    name: 'Gift cards',
    spot: 'No real bill, bank or family emergency is paid with gift card numbers. That request alone means scam.',
  },
  authority: {
    name: 'Pretending to be the bank',
    spot: 'A message can say any name. Contact the bank yourself using the number on the back of your card.',
  },
  'fake-link': {
    name: 'A fake link',
    spot: 'Banks and real companies don’t send links to “unlock” or “release” things. Read a web address from the right, or better, open the company’s own app yourself.',
  },
  'code-request': {
    name: 'Asking for a code',
    spot: 'A code sent to your phone is a key to your account. No real bank or company will ask you to read it out.',
  },
  'safe-account': {
    name: 'A “safe account”',
    spot: 'A real bank never asks you to move your money to protect it. Hang up and call the number on your card.',
  },
  'sender-name': {
    name: 'A trusted company’s name',
    spot: 'The name at the top of a text is typed in by whoever sent it. Treat it as the least reliable part of the message and check with the company yourself.',
  },
  // Same slug as the Scam or Not? message tactic, so the profile counts both games on one sign.
  'prize-giveaway': {
    name: 'A prize out of nowhere',
    spot: 'You can’t win a contest you never entered. Capital letters and free money are the easiest scam to spot, so real scammers rarely use them.',
  },
  'callback-number': {
    name: 'A number to call back',
    spot: 'A phone number printed in a message belongs to whoever wrote the message. Call the number on your card, your bill or the company’s own app instead.',
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
      'In real life, this is where the money would be gone. The real Emma was fine all along, at work with her phone in her pocket.',
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
          },
        ],
      },
    ],
    fooledEnd:
      'In real life, Robert would now send his savings to an account you control. His real account was never in danger until he moved the money.',
    caughtEnd:
      'Robert called the number on the back of his card. The bank said there was no fraud, and nothing had been taken. The scam ended there.',
  },
  {
    id: 'parcel-fee-smish',
    title: 'A parcel fee text',
    chip: 'A parcel text',
    pitch: 'Pretend to be a delivery company and talk a busy nurse into paying a small “redelivery fee”.',
    playerAs: 'You, as “Parcelo Support”',
    target: 'Priya (night-shift nurse)',
    channel: 'Text message simulation',
    times: [
      ['7:42 AM', '7:50 AM'],
      ['7:52 AM', '7:58 AM'],
      ['8:01 AM', '8:15 AM'],
    ],
    steps: [
      {
        title: 'Pick who you pretend to be',
        moves: [
          {
            tactic: 'sender-name',
            text: 'Parcelo: We tried to deliver parcel 6712 today. Please choose a new delivery time in the Parcelo planner.',
            reply: 'Oh, that’s probably the scrubs I ordered. I’ll sort it out after my shift.',
            works: true,
            note: 'It worked. A familiar company name on a dull, everyday message rarely gets questioned. Half the city is waiting for a parcel.',
          },
          {
            tactic: 'prize-giveaway',
            text: 'CONGRATULATIONS!!! Parcelo has picked YOU for a FREE $1,000 gift card!!! Claim it NOW!!!',
            reply: 'I never entered anything. Capital letters and a free prize? Deleting this.',
            works: false,
            note: 'Priya noticed. A prize she never entered is exactly what people are taught to look for.',
          },
          {
            tactic: 'fake-link',
            text: 'Parcelo ✅ Verified 🔒 Secure: Your parcel is on hold. Release it here: parcelo.com.release-hold.example',
            reply: 'It has a padlock and a “verified” tick, so I guess it’s real? I’ll look later.',
            works: true,
            note: 'It half worked. Badges are just pictures anyone can copy. Read from the right, this address belongs to release-hold.example, not Parcelo.',
          },
        ],
      },
      {
        title: 'Ask for something',
        moves: [
          {
            tactic: 'urgency',
            text: 'Your delivery slot closes at midnight tonight. After that, parcel 6712 goes back to the sender.',
            reply: 'Midnight? I’m on shift until seven. Fine, I’ll do it on my break.',
            works: true,
            note: 'It worked. A deadline takes away the pause where she would have checked.',
          },
          {
            tactic: 'small-amount',
            text: 'A $2.99 redelivery fee is due before we can try again. Pay securely on the planner page.',
            reply: 'Three dollars? Not worth the fuss. Okay.',
            works: true,
            note: 'It worked. Nobody calls their bank over $2.99. The fee was never the goal: the card number typed in to pay it was.',
          },
          {
            tactic: 'code-request',
            text: 'To confirm it’s you, please reply with the 6-digit code we just sent to your phone.',
            reply: 'A delivery company wants a code sent to my phone? No. That code is for my accounts.',
            works: false,
            note: 'Priya caught it. Asking for a code this early felt wrong, even at the end of a long night shift.',
          },
        ],
      },
      {
        title: 'Get past a careful check',
        moves: [
          {
            tactic: 'callback-number',
            text: 'Not sure? Call Parcelo Support any time at +1 (888) 555-0171. Have parcel 6712 ready.',
            reply: 'I don’t tap links in texts, so I called the number instead. The agent knew my parcel number and said the fee is real. I’ve paid it.',
            works: true,
            note: 'It worked. Priya did check, but with the number you chose. You wrote the message, so you answered the phone.',
          },
          {
            tactic: 'emotional-pressure',
            text: 'Priya, this parcel is marked as a medicine delivery. If it’s sent back, it could take weeks to replace.',
            reply: 'I don’t have any medicine coming. I opened the store’s app myself: my order arrived last week, and no fee is owed.',
            works: false,
            note: 'Priya caught it. Worry could have rushed her, but she checked her order in her own app instead of using your link.',
          },
          {
            tactic: 'switch-channel',
            text: 'Our texts are having trouble. Please message our agent on WhatsApp at +1 (888) 555-0172 to finish.',
            reply: 'Now it’s another app? No. I’m forwarding this to 7726 to report it as spam, then deleting it.',
            works: false,
            note: 'Priya caught it. Being moved to another app made her stop, and she reported the text.',
          },
        ],
      },
    ],
    fooledEnd:
      'In real life, Priya’s card details would now be in a scammer’s hands, and the “agent” might call back asking for more. No parcel was ever held up.',
    caughtEnd:
      'Priya checked her order in the store’s own app: nothing was waiting and no fee was owed. She reported the text by forwarding it to 7726 and deleted it. Nothing was lost.',
  },
]
