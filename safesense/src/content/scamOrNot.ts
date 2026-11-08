// Scam or Not? rounds. US English, fictional brands, `.example` domains and 555-01xx numbers only.
// Items marked "bank:" are adapted from docs/content/messages.json (same id and tactic slug; brand names
// swapped for fictional ones). `tactic` uses the bank's slugs and is what the coach sees on a wrong answer.

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
  },
  {
    id: 'doctor-reminder-email',
    tactic: 'legit',
    kind: 'email',
    name: 'Riverside Family Medicine',
    initials: 'RF',
    details: ['appointments@riverside-family.example', "Your doctor's office"],
    from: 'appointments@riverside-family.example',
    time: 'Monday 2:20 PM',
    subject: 'Appointment reminder',
    body: "This is a reminder of your appointment with Dr. Patel on Tuesday at 10:30 AM. If you can't make it, please call the office at the number you usually use.",
    answer: 'safe',
    why: 'This message gives information but asks for nothing: no link, no payment, no personal details. It even tells you to use the number you already have.',
    clues: ['No link or payment', 'No pressure to act quickly', 'Points you to a number you already know'],
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
  },
  // bank: cvs-prescription-ready
  {
    id: 'cvs-prescription-ready',
    tactic: 'legit',
    kind: 'text',
    name: 'Main Street Pharmacy',
    initials: 'MP',
    details: ['Saved in your contacts', 'Texts you before every refill'],
    from: 'Main Street Pharmacy',
    time: 'Yesterday 3:10 PM',
    body: 'Main Street Pharmacy: Your prescription is ready for pickup. It will be held for 7 days. Questions? Call your store. Reply STOP to end texts.',
    answer: 'safe',
    why: 'A pickup reminder only asks you to show up. There is no link, no payment and no request for details, and it points you to your own store.',
    clues: ['No link and no payment', 'Sends you to your own store', 'Matches texts you already get'],
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
  legit: 'A message that asks for nothing — no link, no money, no code — is usually just information.',
}

export const REMEMBER_DEFAULT =
  'Most scams rush you. If a message wants money, a code or a click right now, pause and check another way.'
