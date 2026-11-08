// Scam or Not? rounds. US English, fictional brands, `.example` domains and 555-01xx numbers only.
// Items marked "bank:" are adapted from docs/content/messages.json (same id and tactic slug; brand names
// swapped for fictional ones). `tactic` uses the bank's slugs and is what the coach sees on a wrong answer.
// Items marked "Krishna" are rewritten from his Friend or Fraud? quiz (origin/web-app 8f415eb), rebranded to
// the fictional carrier "BrightLine Mobile". 15 rounds, 9 of them scams.
// `inspect` (the "Check it" evidence) is adapted from Friend or Fraud?'s Inspect button, by Krishna. Sources are
// AARP and CFPB pages checked to load on 2026-11-08 (consumer.ftc.gov blocks automated checks, so it isn't used).

export type Guess = 'scam' | 'safe'
export type Kind = 'text' | 'email' | 'social' | 'app'

export type Scenario = {
  /** Stable slug, reported to the coach as `item`. */
  id: string
  /** Tactic slug from the content bank (`legit` for safe messages). */
  tactic: string
  kind: Kind
  /** Who the message appears to come from — shown in the sender profile card. */
  name: string
  /** Avatar initials; left out for unknown senders, who get a generic icon. */
  initials?: string
  /** One short line about the sender, when the format has one (e.g. a social media bio). */
  bio?: string
  /** Whatever the player could see about the sender, shown as small tags. */
  details: string[]
  /** Shown at the top of the message: a number, email address or app name. */
  from: string
  time: string
  subject?: string
  body: string
  link?: string
  answer: Guess
  why: string
  clues: string[]
  /** 1–2 optional "Check it" actions, each revealing one piece of evidence before the player answers. */
  inspect: Inspect[]
  /** A reputable page to learn more, shown as a small link in the reveal. */
  source?: { label: string; url: string }
}

/**
 * Where a piece of evidence lives: the sender card, the link, the message text, or a phone number
 * (which can be in the sender card or the message).
 */
export type InspectTarget = 'sender' | 'link' | 'body' | 'number'

export type Inspect = {
  /** The button text, phrased as an action: "Look at the web address". */
  label: string
  target: InspectTarget
  /** One line shown once checked. It states the evidence and never gives away the answer outright. */
  note: string
  /** Exact text to mark within the target. Left out, the whole target is marked. */
  highlight?: string
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'parcel-redelivery-fee',
    tactic: 'fake-delivery',
    kind: 'text',
    name: '+1 (833) 555-0142',
    details: ['Not in your contacts', 'Unknown number'],
    from: '+1 (833) 555-0142',
    time: 'Today 9:41 AM',
    body: 'Your package could not be delivered. A $1.99 redelivery fee is due. Pay within 24 hours or it will be returned:',
    link: 'package-redelivery.example/pay',
    answer: 'scam',
    why: 'Delivery companies rarely ask for small fees by text. The tiny amount is a way to collect your card details.',
    clues: ['A small fee with a deadline', 'A link to pay', 'A random number, not a company you use'],
    inspect: [
      {
        label: 'Check the sender',
        target: 'number',
        highlight: '+1 (833) 555-0142',
        note: 'A number you have never saved. It isn’t your delivery company’s app or a tracking page you know.',
      },
      {
        label: 'Look at the web address',
        target: 'link',
        highlight: 'package-redelivery.example',
        note: 'The site is package-redelivery.example, not the website of any company delivering to you.',
      },
    ],
    source: { label: 'Scam delivery texts (AARP)', url: 'https://www.aarp.org/money/scams-fraud/fake-usps-ups-smishing-texts/' },
  },
  {
    id: 'bank-account-locked-email',
    tactic: 'bank-impersonation',
    kind: 'email',
    name: 'Bank Support',
    initials: 'BS',
    details: ['security@account-review.example', 'First email from this address'],
    from: 'security@account-review.example',
    time: 'Today 8:15 AM',
    subject: 'Your account needs attention',
    body: 'We have noticed unusual activity. Your account will be locked in 30 minutes unless you confirm your bank details using the link below.',
    link: 'Confirm my details →',
    answer: 'scam',
    why: 'A short deadline can pressure you to act. Your bank will not ask you to confirm details through a link. Contact them using the number on the back of your card.',
    clues: ['A 30-minute deadline', 'An address that is not your bank', 'A link asking for bank details'],
    inspect: [
      {
        label: 'Check the sender',
        target: 'sender',
        highlight: 'security@account-review.example',
        note: 'The address ends in account-review.example, not your bank’s own website, and it has never written to you before.',
      },
      {
        label: 'Read the deadline',
        target: 'body',
        highlight: 'locked in 30 minutes',
        note: 'Thirty minutes leaves no time to call your bank and check.',
      },
    ],
    source: { label: 'Bank impersonation scams (AARP)', url: 'https://www.aarp.org/money/scams-fraud/bank-impersonation-fake-text-messages-emails-calls/' },
  },
  // Krishna (8f415eb friend-or-fraud): a code you asked for yourself
  {
    id: 'login-code-you-requested',
    tactic: 'legit',
    kind: 'text',
    name: 'BrightLine Mobile',
    initials: 'BL',
    details: ['You just tapped “Send code” in the BrightLine app', 'Arrived seconds later'],
    from: 'BrightLine Mobile',
    time: 'Today 2:08 PM',
    body: 'BrightLine Mobile: 481029 is your sign-in code. Enter it only in the BrightLine app. We will never call or text to ask for it. Didn’t ask for a code? Ignore this message.',
    answer: 'safe',
    why: 'You asked for this code a moment ago, in the app you opened yourself, and it goes back into that same app. A code is only safe on the screen where you started signing in. Nobody is asking you to share it.',
    clues: ['You asked for the code yourself, seconds ago', 'It goes into the app you opened yourself', 'It warns you never to share it'],
    inspect: [
      {
        label: 'Who asked for this code?',
        target: 'sender',
        highlight: 'You just tapped “Send code” in the BrightLine app',
        note: 'You did. You tapped “Send code” in the app you opened yourself, and the code arrived seconds later.',
      },
      {
        label: 'Where does the code go?',
        target: 'body',
        highlight: 'Enter it only in the BrightLine app',
        note: 'Back into that same app. Nobody is asking you to read it out, reply with it or type it on a website.',
      },
    ],
    source: { label: 'Text message scams (AARP)', url: 'https://www.aarp.org/money/scams-fraud/smishing/' },
  },
  {
    id: 'grandkid-new-number',
    tactic: 'family-emergency',
    kind: 'text',
    name: '+1 (720) 555-0146',
    details: ['Not in your contacts', 'New number'],
    from: '+1 (720) 555-0146',
    time: 'Today 11:52 AM',
    body: 'Hi Grandma, it’s me. I lost my phone so this is my new number. Can you help with $400 for rent today? I’ll pay you back. Please don’t tell Mom.',
    answer: 'scam',
    why: 'A new number, an urgent request for money and a request for secrecy are classic signs. Call your grandchild on the number you already have.',
    clues: ['A new, unknown number', 'Money needed today', 'Asked to keep it secret'],
    inspect: [
      {
        label: 'Who chose this phone number?',
        target: 'number',
        highlight: '+1 (720) 555-0146',
        note: 'The sender did. A “new number” means you can’t tell who it is. Your grandchild’s real number is still in your contacts.',
      },
      {
        label: 'Read what they ask for',
        target: 'body',
        highlight: 'Please don’t tell Mom',
        note: 'Money today, and keep it secret. Secrecy stops you from checking with the rest of the family.',
      },
    ],
    source: { label: 'Grandparent scams (AARP)', url: 'https://www.aarp.org/money/scams-fraud/grandparent/' },
  },
  // Krishna (8f415eb friend-or-fraud): a lookalike web address
  {
    id: 'carrier-rewards-lookalike-host',
    tactic: 'carrier-impersonation',
    kind: 'text',
    name: 'BRIGHTLINE',
    details: ['A short-code text', 'You upgraded your phone yesterday'],
    from: 'BRIGHTLINE',
    time: 'Today 9:14 PM',
    body: 'BrightLine Mobile: Your upgrade reward is ready! Choose a free accessory and confirm delivery on your reservation page. Reservation 7142:',
    link: 'brightline-mobile.com.redeem.example/accessory',
    answer: 'scam',
    why: 'Read a web address from the right. The real site is the part just before the first single slash, and here it ends in redeem.example, not BrightLine’s own site. A reward that arrives the day after a real upgrade feels genuine, which is why it works. Check rewards in the carrier’s own app instead.',
    clues: [
      'Read from the right: the site is redeem.example',
      'The carrier’s name is only at the start of the address',
      'A reward timed to match something you really did',
    ],
    inspect: [
      {
        label: 'Look at the web address',
        target: 'link',
        highlight: 'redeem.example',
        note: 'Read it from the right. Just before the first single slash it says redeem.example: that is whose site this really is.',
      },
      {
        label: 'Why does it feel real?',
        target: 'sender',
        highlight: 'You upgraded your phone yesterday',
        note: 'It lines up with something you really did. Texts like this go out to many people, and some of them always just upgraded.',
      },
    ],
    source: { label: 'Loyalty and rewards points fraud (AARP)', url: 'https://www.aarp.org/money/scams-fraud/loyalty-rewards-points/' },
  },
  {
    id: 'book-club-friend',
    tactic: 'legit',
    kind: 'social',
    name: 'Margaret Lewis',
    initials: 'ML',
    bio: 'Retired teacher. Gardening, grandchildren and the Riverside book club.',
    details: ['@maggie.lewis', 'Joined 2014', '214 friends', '18 mutual friends'],
    from: 'Direct message',
    time: 'Friday 4:40 PM',
    body: 'So nice to see you at book club on Thursday! I’ll bring the next book on Monday. Say hello to Tom for me.',
    answer: 'safe',
    why: 'This is a long-standing profile with many shared friends, and the message mentions something you did together. It asks for nothing: no money, no link and no details.',
    clues: ['An older profile with mutual friends', 'Mentions a real, shared event', 'Asks for nothing'],
    inspect: [
      {
        label: 'Check the profile',
        target: 'sender',
        highlight: '18 mutual friends',
        note: 'An account from 2014 with 18 friends you share. That is hard to fake overnight.',
      },
      {
        label: 'Read what she asks for',
        target: 'body',
        highlight: 'So nice to see you at book club on Thursday!',
        note: 'Nothing. She mentions something you really did together, with no link, money or code.',
      },
    ],
    source: { label: 'Common social media scams (AARP)', url: 'https://www.aarp.org/money/scams-fraud/social-media/' },
  },
  // bank: geek-squad-auto-renewal
  {
    id: 'geek-squad-auto-renewal',
    tactic: 'tech-support',
    kind: 'email',
    name: 'TechCare Billing',
    initials: 'TC',
    details: ['invoice@techcare-renewals.example', 'You have never bought from them'],
    from: 'invoice@techcare-renewals.example',
    time: 'Today 7:02 AM',
    subject: 'Invoice #TC-449812: Auto-renewal successful',
    body: 'Thank you for renewing your TechCare Total Protection. $399.99 has been charged to your account today. If you did not authorize this charge, call our refund desk within 24 hours: +1 (888) 555-0166.',
    answer: 'scam',
    why: 'A surprise bill makes you want to call right away. The “refund desk” then asks to connect to your computer or for your bank details. Check real charges in your own bank app.',
    clues: ['A bill for something you never bought', 'Wants you to call a number in the email', 'A 24-hour deadline'],
    inspect: [
      {
        label: 'Check the sender',
        target: 'sender',
        highlight: 'You have never bought from them',
        note: 'You never bought anything from TechCare, so there is nothing for them to renew.',
      },
      {
        label: 'Who chose this phone number?',
        target: 'number',
        highlight: '+1 (888) 555-0166',
        note: 'The email did. Calling a number from a surprise bill puts you through to whoever sent it.',
      },
    ],
    source: { label: 'Tech support scams (AARP)', url: 'https://www.aarp.org/money/scams-fraud/fake-online-tech-support/' },
  },
  // Krishna (8f415eb friend-or-fraud): a refund smaller than you asked for
  {
    id: 'partial-refund-notice',
    tactic: 'legit',
    kind: 'email',
    name: 'BrightLine Mobile Billing',
    initials: 'BL',
    details: ['billing@brightline-mobile.example', 'You asked for a $28 refund last week'],
    from: 'billing@brightline-mobile.example',
    time: 'Today 11:50 AM',
    subject: 'Your refund review is complete',
    body: 'We reviewed your request. $24.18 will be returned to your original payment method within 5 business days. The rest of the request was not approved. No reply or action is needed. You can see the details any time under Billing in the BrightLine app.',
    answer: 'safe',
    why: 'The amount is lower than you asked for because only part of the refund was approved. The email asks for nothing: no link, no card and no reply, and it sends you to the app you already use. If a follow-up ever asks for a different card, treat that as a new message to check.',
    clues: ['Matches a request you really made', 'No link, no card and no reply needed', 'Points you to your own app to check'],
    inspect: [
      {
        label: 'Compare it with your request',
        target: 'sender',
        highlight: 'You asked for a $28 refund last week',
        note: 'You asked for $28 and the email says $24.18. It explains that only part of the request was approved.',
      },
      {
        label: 'Read what it asks for',
        target: 'body',
        highlight: 'No reply or action is needed.',
        note: 'Nothing: no link, no card and no reply. It points you to Billing in the app you already use.',
      },
    ],
    source: { label: 'Fraud and scams (CFPB)', url: 'https://www.consumerfinance.gov/consumer-tools/fraud/' },
  },
  {
    id: 'romance-officer-dm',
    tactic: 'romance',
    kind: 'social',
    name: 'Capt. James Miller',
    initials: 'JM',
    bio: 'Army officer on overseas deployment. Widower. Looking for honest love.',
    details: ['@james.miller.officer8841', 'Joined 2 weeks ago', '9 followers', 'No mutual friends'],
    from: 'Direct message',
    time: 'Yesterday 10:03 PM',
    body: 'Hello dear, your kind smile caught my eye. I am on a peacekeeping mission and feel very lonely. Can we talk privately on another app? I feel we have a special connection.',
    answer: 'scam',
    why: 'This is a common romance scam. A brand-new profile with no shared friends moves fast with affection, then asks to move somewhere more private, where asking for money comes next.',
    clues: [
      'A new profile with few followers and no mutual friends',
      'Strong feelings very quickly',
      'Asks to talk on another app',
    ],
    inspect: [
      {
        label: 'Check the profile',
        target: 'sender',
        highlight: 'Joined 2 weeks ago',
        note: 'A two-week-old account with 9 followers and no friends in common.',
      },
      {
        label: 'Read what he asks for',
        target: 'body',
        highlight: 'Can we talk privately on another app?',
        note: 'To move somewhere more private, away from the site that could spot him and stop him.',
      },
    ],
    source: { label: 'Online romance scams (AARP)', url: 'https://www.aarp.org/money/scams-fraud/romance/' },
  },
  // bank: costco-loyalty-winner
  {
    id: 'costco-loyalty-winner',
    tactic: 'prize-giveaway',
    kind: 'text',
    name: '+1 (281) 555-0193',
    details: ['Not in your contacts', 'Unknown number'],
    from: '+1 (281) 555-0193',
    time: 'Today 12:30 PM',
    body: 'Congrats! You’ve been selected as our Maple Mart loyalty winner 🎉 Claim your FREE robot vacuum (value $599), just pay $4.95 shipping. Offer expires in 30 mins!',
    link: 'maplemart-winners.example/gift',
    answer: 'scam',
    why: 'You cannot win a contest you never entered. The small “shipping” fee is how they get your card number.',
    clues: ['You never entered a contest', 'A “free” prize that needs your card', 'A 30-minute countdown'],
    inspect: [
      {
        label: 'Read the prize',
        target: 'body',
        highlight: 'just pay $4.95 shipping',
        note: 'A “free” prize that needs your card. The fee is small so you won’t think twice about it.',
      },
      {
        label: 'Look at the web address',
        target: 'link',
        highlight: 'maplemart-winners.example',
        note: 'The site is maplemart-winners.example, not Maple Mart’s own website.',
      },
    ],
    source: { label: 'Sweepstakes scams (AARP)', url: 'https://www.aarp.org/money/scams-fraud/sweepstakes/' },
  },
  // Krishna (8f415eb friend-or-fraud): a real case number, the wrong kind of code
  {
    id: 'transfer-case-code-swap',
    tactic: 'account-locked-otp',
    kind: 'text',
    name: '+1 (214) 555-0131',
    details: [
      'Not in your contacts',
      'You did call about a number transfer this morning',
      'Your newest text says “password reset code”',
    ],
    from: '+1 (214) 555-0131',
    time: 'Today 3:21 PM',
    body: 'BrightLine Support: Case 8194 is still open. To cancel the number transfer, reply with the 6 digits we just sent to your phone.',
    answer: 'scam',
    why: 'The case number matches your call, which makes this feel safe. But the code you were sent says it is for a password reset, not for cancelling a transfer. Sharing it would let someone else into your account. Keep codes private and call your carrier on the number on your bill.',
    clues: [
      'Asks you to send a code by text',
      'The code is for a password reset, not what they say',
      'Real support never asks you to read out a code',
    ],
    inspect: [
      {
        label: 'Read what the code is for',
        target: 'sender',
        highlight: 'Your newest text says “password reset code”',
        note: 'Your newest text calls it a password reset code. This message says it cancels a transfer. Those don’t match.',
      },
      {
        label: 'Who chose this phone number?',
        target: 'number',
        highlight: '+1 (214) 555-0131',
        note: 'They did, and it isn’t in your contacts. The number on your bill is one you can check yourself.',
      },
    ],
    source: { label: 'SIM swapping (AARP)', url: 'https://www.aarp.org/money/scams-fraud/sim-swapping/' },
  },
  {
    id: 'bank-app-purchase',
    tactic: 'legit',
    kind: 'app',
    name: 'Your bank',
    initials: 'YB',
    details: ['Your banking app'],
    from: 'Banking app',
    time: 'Today 1:05 PM',
    body: 'You paid $32.40 to Greenway Grocers. If this wasn’t you, open your banking app or call the number on the back of your card. We will never ask for your PIN.',
    answer: 'safe',
    why: 'This matches a real purchase, has no link, and sends you to your own app or card. It also reminds you they will never ask for your PIN.',
    clues: ['No link to click', 'Points you to your own app or card', 'Never asks for your PIN'],
    inspect: [
      {
        label: 'Where did it arrive?',
        target: 'sender',
        highlight: 'Your banking app',
        note: 'Inside the banking app you installed yourself, not in a text from a number you don’t know.',
      },
      {
        label: 'Read what it asks for',
        target: 'body',
        highlight: 'open your banking app or call the number on the back of your card',
        note: 'Nothing new. If the purchase isn’t yours, it sends you to your own app or card, details you already trust.',
      },
    ],
    source: { label: 'Bank impersonation scams (AARP)', url: 'https://www.aarp.org/money/scams-fraud/bank-impersonation-fake-text-messages-emails-calls/' },
  },
  // Krishna (8f415eb friend-or-fraud): a receipt that asks for nothing
  {
    id: 'toll-receipt-no-action',
    tactic: 'legit',
    kind: 'text',
    name: 'Prairie Tollway',
    initials: 'PT',
    details: ['New conversation', 'You drove a toll road yesterday', 'You turned on receipt texts'],
    from: 'Prairie Tollway',
    time: 'Today 6:03 PM',
    body: 'Prairie Tollway: Payment posted. Your trip on Nov 7 was paid from your toll account (plate ending 4KD). This is a receipt. No action needed.',
    answer: 'safe',
    why: 'This is a receipt, not a bill. It asks for no payment and has no link, it matches a trip you took, and you turned these texts on yourself. If a toll text ever asks you to pay, check your account on the toll agency’s own website instead.',
    clues: ['A receipt, not a demand to pay', 'No link and no payment', 'Matches a trip you took and texts you turned on'],
    inspect: [
      {
        label: 'Read what it asks for',
        target: 'body',
        highlight: 'This is a receipt. No action needed.',
        note: 'Nothing. It is a receipt for a trip already paid, with no link and no payment.',
      },
      {
        label: 'Check the sender',
        target: 'sender',
        highlight: 'You turned on receipt texts',
        note: 'You switched these texts on yourself, and it matches the trip you took yesterday.',
      },
    ],
    source: { label: 'Toll road scam texts (AARP)', url: 'https://www.aarp.org/money/scams-fraud/toll-road-texts/' },
  },
  // bank: remote-task-job-text
  {
    id: 'remote-task-job-text',
    tactic: 'job-offer',
    kind: 'text',
    name: '+1 (332) 555-0129',
    details: ['Not in your contacts', 'Unknown number'],
    from: '+1 (332) 555-0129',
    time: 'Today 10:14 AM',
    body: 'Hi! I’m Ashley, a recruiter with ShopWorld. Your resume was recommended for a remote part-time role: 60-90 min/day, $300-$800/day, paid daily. Interested? Add me on WhatsApp: +1 (332) 555-0130',
    answer: 'scam',
    why: 'Real recruiters don’t text out of the blue promising daily pay. These “task” jobs end with you paying them to unlock your earnings.',
    clues: ['Pay that sounds too good to be true', 'A job you never applied for', 'Moves you to another app'],
    inspect: [
      {
        label: 'Read the pay',
        target: 'body',
        highlight: '$300-$800/day, paid daily',
        note: 'Up to $800 a day for about an hour of work, for a job you never applied for.',
      },
      {
        label: 'Who chose this phone number?',
        target: 'number',
        highlight: 'Add me on WhatsApp: +1 (332) 555-0130',
        note: 'The sender, and it moves you to another app and another number, away from any company you can check.',
      },
    ],
    source: { label: 'Fake job offers (AARP)', url: 'https://www.aarp.org/money/scams-fraud/online-job-search/' },
  },
  // bank: mom-call-me-flights
  {
    id: 'mom-call-me-flights',
    tactic: 'legit',
    kind: 'text',
    name: 'Mom',
    initials: 'M',
    details: ['Saved in your contacts', 'You text every week'],
    from: 'Mom',
    time: 'Today 5:48 PM',
    body: 'Can you call me when you get a sec? Nothing’s wrong!! Just want to ask about Thanksgiving flights before prices go up ✈️',
    answer: 'safe',
    why: 'This is a saved contact you talk to often, and she asks you to call. Scammers avoid calls, because your voice check would catch them.',
    clues: ['A saved contact you know well', 'Asks for a call, not money', 'No link or code'],
    inspect: [
      {
        label: 'Check the sender',
        target: 'sender',
        highlight: 'Saved in your contacts',
        note: 'Mom is a contact you saved yourself, and you text every week.',
      },
      {
        label: 'Read what she asks for',
        target: 'body',
        highlight: 'Can you call me when you get a sec?',
        note: 'A phone call. You would hear her voice, which is how you know it is really her.',
      },
    ],
  },
]

/** The one sign worth remembering for each tactic, shown in the wrap-up. */
export const REMEMBER: Record<string, string> = {
  'fake-delivery': 'Delivery companies don’t text you fees to pay. Check tracking on the company’s own app or website.',
  'bank-impersonation': 'Your bank will never ask for your details through a link. Call the number on the back of your card.',
  'family-emergency': 'If “family” texts from a new number asking for money, call them on the number you already have.',
  'tech-support': 'A surprise bill with a number to call is bait. Check real charges in your own bank app.',
  'prize-giveaway': 'If you have to pay to get a prize, it isn’t a prize.',
  romance: 'Someone you have never met who quickly asks to move to another app is a warning sign.',
  'job-offer': 'Real jobs don’t text you out of the blue with pay that sounds too good to be true.',
  'carrier-impersonation':
    'Read a web address from the right: the real site is the part just before the first single slash. Check offers in your carrier’s own app.',
  'account-locked-otp': 'A code is only for the screen where you started. Never read one out to anyone who contacts you, even “support”.',
  legit: 'A message that asks for nothing — no link, no money, no code — is usually just information.',
}

export const REMEMBER_DEFAULT =
  'Most scams rush you. If a message wants money, a code or a click right now, pause and check another way.'

// ---------- Round order ----------
// Each play deals the rounds in a new random order. The first is always an obvious scam to ease people
// in, and the answers keep a good mix: never more than 3 scams or 2 genuine messages in a row, so
// guessing by pattern doesn't work.

/** The gentle opener: a delivery-fee text with most of the classic signs. */
export const OPENER_ID = 'parcel-redelivery-fee'
const MAX_RUN: Record<Guess, number> = { scam: 3, safe: 2 }

function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Every scam/genuine pattern that starts with `first`, uses exactly the given counts and obeys MAX_RUN. */
function patterns(first: Guess, scams: number, safes: number): Guess[][] {
  const out: Guess[][] = []
  const walk = (seq: Guess[], scamLeft: number, safeLeft: number, run: number) => {
    if (!scamLeft && !safeLeft) {
      out.push(seq)
      return
    }
    const prev = seq[seq.length - 1]
    for (const g of ['scam', 'safe'] as Guess[]) {
      if ((g === 'scam' ? scamLeft : safeLeft) === 0) continue
      const nextRun = g === prev ? run + 1 : 1
      if (nextRun > MAX_RUN[g]) continue
      walk([...seq, g], scamLeft - (g === 'scam' ? 1 : 0), safeLeft - (g === 'safe' ? 1 : 0), nextRun)
    }
  }
  walk([first], scams - (first === 'scam' ? 1 : 0), safes - (first === 'safe' ? 1 : 0), 1)
  return out
}

let patternCache: Guess[][] | undefined

/** A fresh order of all SCENARIOS: the opener first, then a random mix that keeps to MAX_RUN. */
export function dealRounds(): Scenario[] {
  const opener = SCENARIOS.find((s) => s.id === OPENER_ID) ?? SCENARIOS[0]
  const rest = SCENARIOS.filter((s) => s !== opener)
  const scams = shuffle(rest.filter((s) => s.answer === 'scam'))
  const safes = shuffle(rest.filter((s) => s.answer === 'safe'))
  patternCache ??= patterns(
    opener.answer,
    scams.length + (opener.answer === 'scam' ? 1 : 0),
    safes.length + (opener.answer === 'safe' ? 1 : 0),
  )
  // No valid pattern (only if the content changes a lot): fall back to a plain shuffle.
  if (!patternCache.length) return [opener, ...shuffle(rest)]
  const pattern = patternCache[Math.floor(Math.random() * patternCache.length)]
  return pattern.map((g, i) => (i === 0 ? opener : g === 'scam' ? scams.pop()! : safes.pop()!))
}
