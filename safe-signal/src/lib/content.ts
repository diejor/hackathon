// Game content for the three Safe Signal games, and the one place where the Friend or Fraud
// content bank (docs/content/messages.json: 11 free-text tactic slugs, free-text flags) is mapped
// onto Krishna's frozen enums (src/contracts.ts: 8 Tactic, 8 RedFlag).
//
// Rendering rules (enforced by content.test.ts):
// - Fictional brands only. Bank items that name real brands are re-branded here (REBRAND below).
// - No new domains: every link shown is a subdomain/path of one of the bank's registrable domains that
//   were verified not to resolve (BANK_SAFE_DOMAINS), never a newly invented registrable domain.
// - Phone numbers stay in the 555-01xx fictional range.
import bank from '../../../docs/content/messages.json';
import type { RedFlag, Tactic, TraitKey } from '../contracts';

// ──────────────────────────────────────────────────────────────────────────
// Plain words for the enums
// ──────────────────────────────────────────────────────────────────────────

export const RED_FLAGS: RedFlag[] = [
  'sender_identity', 'url_domain', 'plausibility_bait', 'urgency_clause',
  'authority_claim', 'payment_rail', 'reply_bait', 'personalization_overreach',
];

export const FLAG_INFO: Record<RedFlag, { label: string; hint: string; spot: string }> = {
  sender_identity: { label: 'Fake sender', hint: "Not who they say they are", spot: "The sender doesn't match who they claim to be." },
  url_domain: { label: 'Wrong website', hint: "The link isn't the real site", spot: 'The link goes somewhere other than the real site. Read the part right before the first slash.' },
  plausibility_bait: { label: 'Believable bait', hint: 'Small or normal-sounding hook', spot: 'The hook is small or ordinary on purpose, so it feels too minor to check.' },
  urgency_clause: { label: 'Rush or deadline', hint: 'Act now or else', spot: 'A deadline or threat is there to stop you from thinking it over.' },
  authority_claim: { label: 'Official-sounding', hint: 'Bank, boss, government', spot: 'It leans on authority (a bank, a boss, an agency) so you comply.' },
  payment_rail: { label: 'Odd way to pay', hint: 'Gift cards, fees, apps', spot: 'It wants money through a channel that is hard to reverse: gift cards, fees, transfers.' },
  reply_bait: { label: 'Reply, call or code', hint: 'Pulls you into a reply', spot: 'It pushes you to reply, call their number, or read back a code.' },
  personalization_overreach: { label: 'Too friendly', hint: 'Flattery or fake closeness', spot: 'Warmth or flattery from someone you have no real relationship with.' },
};

export const TACTIC_INFO: Record<Tactic, { label: string; blurb: string }> = {
  urgency_deadline: { label: 'Deadline pressure', blurb: 'A clock is ticking, so you act before you think.' },
  authority_impersonation: { label: 'Posing as someone official', blurb: 'A bank, boss, carrier or agency name makes the ask feel mandatory.' },
  social_proof: { label: 'Everyone else is doing it', blurb: 'If lots of people already did it, it must be safe.' },
  small_plausible_amount: { label: 'A small, believable amount', blurb: 'A tiny fee feels too small to bother checking.' },
  favor_then_ask: { label: 'Friendly first, then the ask', blurb: 'Warmth, a gift or a favor first, so the request feels owed.' },
  limited_window: { label: 'Limited-time prize', blurb: 'A prize or deal that vanishes soon, so you grab it.' },
  bypass_verification: { label: 'Skip the safety check', blurb: "A reason you can't verify: new number, a code, don't tell anyone." },
  switch_channel: { label: 'Move you to another channel', blurb: 'Off the text and onto a call, chat app or website they control.' },
};

/** The bank's 11 free-text tactic slugs → Krishna's Tactic enum (an item may override; see FOF_ITEMS). */
export const BANK_TACTIC_TO_TACTIC: Record<string, Tactic> = {
  'fake-delivery': 'small_plausible_amount', // tiny redelivery/customs fee
  'toll-unpaid': 'urgency_deadline', // pay by date or late fee + suspension
  'carrier-impersonation': 'authority_impersonation',
  'bank-impersonation': 'authority_impersonation',
  'account-locked-otp': 'bypass_verification', // "read me the code"
  'wrong-number': 'favor_then_ask', // rapport first (pig butchering), the pitch later
  'family-emergency': 'bypass_verification', // new number / don't tell anyone
  'boss-gift-card': 'authority_impersonation',
  'job-offer': 'switch_channel', // "add me on a chat app"
  'prize-giveaway': 'limited_window',
  'tech-support': 'switch_channel', // "call our refund desk" / remote access
};

/** Registrable scam domains from the bank, DNS-checked not to resolve, minus those containing real brands. */
export const BANK_SAFE_DOMAINS = [
  'bitgainpro-exchange.com', 'brightlane-careers.com', 'com-reschedule.info', 'dmv-gov-portal.top',
  'gs-renewal-center.com', 'outlook-mailbox.net', 'redelivery-help.top', 'tollsvc-billing.xyz',
];

// ──────────────────────────────────────────────────────────────────────────
// Friend or Fraud (game id 'guesswho')
// ──────────────────────────────────────────────────────────────────────────

interface BankItem {
  id: string; channel: 'sms' | 'email' | 'dm' | 'call'; sender: string; subject: string; body: string;
  is_fraud: boolean; tactic: string; flags: string[]; lesson: string; difficulty: number;
}

export type ClueKind = 'sender' | 'link' | 'ask' | 'pressure' | 'context' | 'callback';
export const CLUE_LABEL: Record<ClueKind, string> = {
  sender: 'Who really sent it?',
  link: 'Where does the link really go?',
  ask: 'What exactly are they asking for?',
  pressure: 'Why the rush?',
  context: 'Does it match something I did?',
  callback: 'Check through a channel I trust',
};
/** How much each kind of clue actually separates scams from real messages (0..1 → questionsDiagnosticity). */
export const CLUE_DIAGNOSTICITY: Record<ClueKind | 'polish', number> = {
  link: 0.9, ask: 0.9, callback: 0.9, sender: 0.75, context: 0.7, pressure: 0.6, polish: 0.1,
};
export const POLISH_CLUE = {
  id: 'polish',
  label: 'Does it look professional?',
  answer: "It looks polished. But names, logos and a calm tone are easy to fake, so this tells you very little.",
  diagnosticity: CLUE_DIAGNOSTICITY.polish,
};

export type Mark = [text: string, flag: RedFlag | 'green'];

interface FofAnnotation {
  tactic?: Tactic; // overrides BANK_TACTIC_TO_TACTIC for this item
  redFlags: RedFlag[]; // hand-annotated RedFlag set (empty for legit)
  clues: ClueKind[]; // one per bank flag, same order
  marks: Mark[]; // substrings of the (re-branded) body to highlight in the reveal
  crowdFraud: number; // hand-set fallback odds that "players like you" say Fraud
  rebrand?: Partial<Pick<BankItem, 'sender' | 'subject' | 'body' | 'flags' | 'lesson'>>;
}

const ANNOTATIONS: Record<string, FofAnnotation> = {
  // ── fraud ──
  'usps-redelivery-fee': {
    redFlags: ['sender_identity', 'url_domain', 'plausibility_bait', 'urgency_clause', 'reply_bait'],
    clues: ['sender', 'link', 'ask'], crowdFraud: 0.85,
    rebrand: {
      body: 'Parcelo: Your parcel is on hold due to an incomplete address. Pay the $1.99 redelivery fee within 12 hrs or it will be returned to sender: https://parcelo.redelivery-help.top/us\n\n(Reply Y, then reopen this message to activate the link)',
      flags: ["Parcelo doesn't text you links asking for fees", "Real domain is redelivery-help.top, not Parcelo's site", "'Reply Y' trick unlocks blocked links"],
      lesson: "Real carriers don't charge redelivery fees by text; check tracking in the carrier's own app.",
    },
    marks: [['Parcelo:', 'sender_identity'], ['$1.99 redelivery fee', 'plausibility_bait'], ['within 12 hrs', 'urgency_clause'], ['https://parcelo.redelivery-help.top/us', 'url_domain'], ['Reply Y', 'reply_bait']],
  },
  'ups-missed-delivery': {
    tactic: 'authority_impersonation',
    redFlags: ['sender_identity', 'url_domain', 'plausibility_bait'],
    clues: ['link', 'sender', 'ask'], crowdFraud: 0.45,
    rebrand: {
      body: 'Swiftbox: We missed you today at 2:14 PM. Your package 1Z8Q2X will be held at the local facility. Reschedule delivery: swiftbox.com-reschedule.info/1Z8Q2X',
      flags: ["Real domain is com-reschedule.info, not Swiftbox's site", 'Sent from a random 10-digit number', 'No fee yet: the link phishes your login and card'],
      lesson: "Find the real domain: it's the part right before the first slash. 'swiftbox.com-reschedule.info' belongs to com-reschedule.info.",
    },
    marks: [['Swiftbox:', 'sender_identity'], ['We missed you today at 2:14 PM', 'plausibility_bait'], ['swiftbox.com-reschedule.info/1Z8Q2X', 'url_domain']],
  },
  'ezpass-unpaid-toll': {
    redFlags: ['sender_identity', 'url_domain', 'plausibility_bait', 'urgency_clause'],
    clues: ['sender', 'pressure', 'link'], crowdFraud: 0.8,
    rebrand: {
      body: 'ExpressLane Final Reminder: You have an unpaid toll of $4.15. Pay by 11/09 to avoid a $50.00 late fee and suspension of your vehicle registration.\nhttps://expresslane.tollsvc-billing.xyz/pay',
      flags: ["Toll agencies don't text payment links", "Tiny charge plus a huge 'late fee' threat", 'Unknown .xyz domain'],
    },
    marks: [['ExpressLane Final Reminder', 'sender_identity'], ['$4.15', 'plausibility_bait'], ['Pay by 11/09 to avoid a $50.00 late fee', 'urgency_clause'], ['https://expresslane.tollsvc-billing.xyz/pay', 'url_domain']],
  },
  'sunpass-balance-due': {
    redFlags: ['sender_identity', 'url_domain', 'urgency_clause'],
    clues: ['link', 'pressure', 'sender'], crowdFraud: 0.55,
    rebrand: {
      body: 'MetroToll: Our records show an outstanding toll balance of $6.99 on your vehicle. To avoid additional fees, please settle your balance today at https://metrotoll.tollsvc-billing.xyz',
      flags: ["Real domain is tollsvc-billing.xyz, not MetroToll's site", 'Polite tone, still an unsolicited pay link', 'Sent from an ordinary phone number'],
    },
    marks: [['MetroToll:', 'sender_identity'], ['settle your balance today', 'urgency_clause'], ['https://metrotoll.tollsvc-billing.xyz', 'url_domain']],
  },
  'dmv-final-notice': {
    redFlags: ['authority_claim', 'urgency_clause', 'url_domain', 'reply_bait'],
    clues: ['sender', 'pressure', 'link'], crowdFraud: 0.9,
    marks: [['State DMV FINAL NOTICE', 'authority_claim'], ['Enforcement begins 11/10', 'urgency_clause'], ['https://dmv-gov-portal.top/notice', 'url_domain'], ['Reply Y to activate link.', 'reply_bait']],
  },
  'tmobile-sim-swap-call': {
    redFlags: ['sender_identity', 'authority_claim', 'reply_bait', 'urgency_clause'],
    clues: ['sender', 'ask', 'callback'], crowdFraud: 0.4,
    rebrand: {
      sender: 'Caller ID: Nimbus Mobile',
      body: "\"Hi, this is Kevin with Nimbus Mobile account security. We detected a SIM swap request on your line from another state. To block it, I'm sending a verification code to your phone now. Just read it back to me so I can confirm you're the owner.\"",
      flags: ['Caller ID can be faked to show any name', 'Reading a code back hands them your number', 'Your carrier never asks for a code you received'],
      lesson: 'Never read a texted code to a caller, even "your carrier"; hang up and call the number on your bill.',
    },
    marks: [['Kevin with Nimbus Mobile account security', 'authority_claim'], ['from another state', 'urgency_clause'], ['Just read it back to me', 'reply_bait']],
  },
  'tmobile-autopay-declined': {
    redFlags: ['sender_identity', 'urgency_clause', 'url_domain', 'payment_rail'],
    clues: ['sender', 'pressure', 'ask'], crowdFraud: 0.6,
    rebrand: {
      sender: 'Nimbus Mobile <billing@accountcenter.gs-renewal-center.com>',
      body: 'Your recent AutoPay payment of $87.40 was declined by your bank. To avoid interruption of service, update your payment method within 24 hours.\n\n[ Update Payment ] accountcenter.gs-renewal-center.com/billing\n\nThank you for being part of the Nimbus Mobile family.',
      flags: ["Sender domain is gs-renewal-center.com, not Nimbus Mobile's", '24-hour shutoff threat', 'Wants your card details through a link'],
      lesson: "Billing problems show up in your carrier's own app; go there directly instead of clicking.",
    },
    marks: [['update your payment method', 'payment_rail'], ['within 24 hours', 'urgency_clause'], ['accountcenter.gs-renewal-center.com/billing', 'url_domain']],
  },
  'chase-card-suspended': {
    redFlags: ['authority_claim', 'urgency_clause', 'url_domain', 'sender_identity'],
    clues: ['link', 'ask', 'pressure'], crowdFraud: 0.85,
    rebrand: {
      body: 'MERIDIAN BANK ALERT: Your debit card has been temporarily SUSPENDED due to unusual activity. To restore access verify your identity: http://meridianbank.com-reschedule.info/login Ref#88213',
      flags: ["Link isn't Meridian Bank's site", 'Real alerts ask YES/NO, not for your login', 'ALL-CAPS urgency'],
    },
    marks: [['MERIDIAN BANK ALERT', 'authority_claim'], ['SUSPENDED', 'urgency_clause'], ['http://meridianbank.com-reschedule.info/login', 'url_domain']],
  },
  'boa-safe-account-call': {
    redFlags: ['authority_claim', 'sender_identity', 'urgency_clause', 'payment_rail'],
    clues: ['ask', 'context', 'sender'], crowdFraud: 0.5,
    rebrand: {
      sender: 'Caller ID: Keystone Credit Union',
      body: "\"This is Keystone Credit Union fraud prevention. Someone is trying to drain your checking right now. To protect your money we need to move it to a secure holding account. I'll walk you through a payment-app transfer. Stay on the line and don't tell branch staff.\"",
    },
    marks: [['Keystone Credit Union fraud prevention', 'authority_claim'], ['drain your checking right now', 'urgency_clause'], ['move it to a secure holding account', 'payment_rail']],
  },
  'whatsapp-code-by-mistake': {
    redFlags: ['reply_bait', 'urgency_clause', 'personalization_overreach'],
    clues: ['ask', 'sender', 'pressure'], crowdFraud: 0.6,
    rebrand: {
      body: "Hey sorry!! I just sent my verification code to your number by mistake 😅 it's a 6 digit code, could you text it back to me? I'm locked out of my ChatterBox account and it expires soon",
    },
    marks: [['Hey sorry!!', 'personalization_overreach'], ['could you text it back to me?', 'reply_bait'], ['it expires soon', 'urgency_clause']],
  },
  'marketplace-verify-code': {
    redFlags: ['reply_bait', 'plausibility_bait', 'urgency_clause'],
    clues: ['ask', 'context', 'callback'], crowdFraud: 0.35,
    rebrand: {
      sender: 'Buyer on a marketplace app',
      body: "Hi is the bike still available? I want it today. Before we meet I need to make sure you're real, lots of scammers on here lol. I'm sending a code to your phone, just tell me the 6 digits",
      flags: ['The code sets up a phone number in your name', "Real buyers don't need to 'verify' you", 'Code request disguised as safety'],
    },
    marks: [['I want it today', 'urgency_clause'], ["make sure you're real, lots of scammers on here", 'plausibility_bait'], ['just tell me the 6 digits', 'reply_bait']],
  },
  'wrong-number-yoga': {
    redFlags: ['sender_identity', 'personalization_overreach', 'reply_bait'],
    clues: ['sender', 'context', 'ask'], crowdFraud: 0.3,
    marks: [['Hi Emily', 'sender_identity'], ['are we still on for yoga Thursday?', 'reply_bait'], ['I booked us for 8:30', 'personalization_overreach']],
  },
  'wrong-number-crypto-pivot': {
    redFlags: ['personalization_overreach', 'plausibility_bait', 'url_domain', 'payment_rail'],
    clues: ['sender', 'ask', 'link'], crowdFraud: 0.9,
    marks: [['So nice chatting with you this week', 'personalization_overreach'], ['I made $18,000 last month!!', 'plausibility_bait'], ['bitgainpro-exchange.com', 'url_domain'], ['start with $500', 'payment_rail']],
  },
  'new-number-hi-mom': {
    redFlags: ['sender_identity', 'urgency_clause', 'payment_rail', 'personalization_overreach'],
    clues: ['sender', 'pressure', 'callback'], crowdFraud: 0.7,
    marks: [['this is my new number, save it', 'sender_identity'], ['I need to pay a bill today', 'urgency_clause'], ["I'll pay you back tomorrow", 'payment_rail']],
  },
  'grandparent-bail-call': {
    tactic: 'urgency_deadline',
    redFlags: ['sender_identity', 'urgency_clause', 'payment_rail'],
    clues: ['callback', 'ask', 'pressure'], crowdFraud: 0.75,
    marks: [["Grandma? It's me...", 'sender_identity'], ['$3,000 for bail today', 'urgency_clause'], ['you can use gift cards or a courier can pick up cash', 'payment_rail']],
  },
  'ceo-gift-card-email': {
    redFlags: ['sender_identity', 'authority_claim', 'payment_rail', 'urgency_clause'],
    clues: ['ask', 'sender', 'pressure'], crowdFraud: 0.9,
    rebrand: {
      lesson: "Gift card requests from a 'boss' are scams; confirm through a channel you already use, like work chat or a call.",
      body: "Are you available? I'm in back-to-back meetings and need you to pick up 5 Zyre gift cards ($200 each) for client appreciation. Scratch the backs and send me photos of the codes ASAP. Keep this between us for now, it's a surprise.\n\nSent from my phone",
    },
    marks: [["I'm in back-to-back meetings", 'authority_claim'], ['5 Zyre gift cards ($200 each)', 'payment_rail'], ['send me photos of the codes ASAP', 'urgency_clause']],
  },
  'boss-new-cell-quick-task': {
    redFlags: ['sender_identity', 'authority_claim', 'urgency_clause'],
    clues: ['sender', 'ask', 'callback'], crowdFraud: 0.4,
    marks: [['This is my personal cell', 'sender_identity'], ["stuck in a board meeting and can't talk", 'authority_claim'], ['before 3pm', 'urgency_clause']],
  },
  'remote-task-job-text': {
    redFlags: ['plausibility_bait', 'reply_bait', 'personalization_overreach'],
    clues: ['ask', 'callback', 'context'], crowdFraud: 0.85,
    rebrand: {
      body: "Hi! I'm Ashley, a recruiter with ShopZyre. Your resume was recommended for a remote part-time role: 60-90 min/day, $300-$800/day, paid daily. Interested? Add me on ChatterBox: +1 (332) 555-0130",
      flags: ['Unsolicited text with unreal pay', 'Moves you to a chat app', 'Vague job with no interview'],
    },
    marks: [['Your resume was recommended', 'personalization_overreach'], ['$300-$800/day, paid daily', 'plausibility_bait'], ['Add me on ChatterBox', 'reply_bait']],
  },
  'fake-check-job-offer': {
    tactic: 'favor_then_ask',
    redFlags: ['plausibility_bait', 'payment_rail', 'personalization_overreach'],
    clues: ['context', 'ask', 'sender'], crowdFraud: 0.65,
    rebrand: {
      body: "Congratulations! After reviewing your chat interview, we're pleased to offer you the position ($32/hr). We'll mail you a check for $2,850 to buy home-office equipment from our approved vendor. Please deposit it and send the vendor payment via a payment app.",
    },
    marks: [['Congratulations!', 'personalization_overreach'], ['After reviewing your chat interview', 'plausibility_bait'], ['send the vendor payment via a payment app', 'payment_rail']],
  },
  'costco-loyalty-winner': {
    redFlags: ['plausibility_bait', 'payment_rail', 'urgency_clause', 'url_domain'],
    clues: ['context', 'ask', 'pressure'], crowdFraud: 0.9,
    rebrand: {
      body: "Congrats! You've been selected as our Horizon Rewards loyalty winner 🎉 Claim your FREE hair styler (value $599), just pay $4.95 shipping. Offer expires in 30 mins! horizonrewards.redelivery-help.top/gift",
    },
    marks: [['FREE hair styler (value $599)', 'plausibility_bait'], ['just pay $4.95 shipping', 'payment_rail'], ['Offer expires in 30 mins!', 'urgency_clause'], ['horizonrewards.redelivery-help.top/gift', 'url_domain']],
  },
  'galaxy-giveaway-dm': {
    redFlags: ['sender_identity', 'payment_rail', 'urgency_clause', 'url_domain'],
    clues: ['sender', 'ask', 'context'], crowdFraud: 0.8,
    rebrand: {
      sender: '@beaconclub.giveaways (photo app)',
      body: '🎊 Congratulations! You were chosen as a winner in our Beacon Club phone giveaway! To claim your phone, confirm your shipping details within 24h at beaconclub.gs-renewal-center.com. A small verification fee ($9.99) applies.',
    },
    marks: [['within 24h', 'urgency_clause'], ['beaconclub.gs-renewal-center.com', 'url_domain'], ['A small verification fee ($9.99) applies.', 'payment_rail']],
  },
  'geek-squad-auto-renewal': {
    redFlags: ['sender_identity', 'reply_bait', 'urgency_clause', 'plausibility_bait'],
    clues: ['context', 'ask', 'sender'], crowdFraud: 0.55,
    rebrand: {
      sender: 'TechGuard Billing <invoice@gs-renewal-center.com>',
      subject: 'Invoice #GS-449812: Auto-Renewal Successful',
      body: 'Thank you for renewing your TechGuard Total Protection. $399.99 has been charged to your account today. If you did not authorize this charge, call our refund desk within 24 hours: +1 (888) 555-0166.',
      flags: ['Invoice for a plan you never bought', 'Wants a CALL so they can remote into your PC', "Sender domain isn't TechGuard's"],
    },
    marks: [['$399.99 has been charged', 'plausibility_bait'], ['call our refund desk', 'reply_bait'], ['within 24 hours', 'urgency_clause']],
  },
  'windows-support-call': {
    redFlags: ['sender_identity', 'authority_claim', 'urgency_clause', 'reply_bait'],
    clues: ['callback', 'ask', 'pressure'], crowdFraud: 0.9,
    rebrand: {
      sender: 'Caller ID: Computer Support',
      body: '"Hello, this is the NorthCloud technical department. Your computer is sending us error signals, it has been hacked. Please go to your computer now, I will guide you to install a support tool so I can fix it remotely."',
      flags: ['NorthCloud never cold-calls about your PC', "A 'support tool' gives them full control", "Scare tactic: 'you've been hacked'"],
    },
    marks: [['the NorthCloud technical department', 'authority_claim'], ['it has been hacked', 'urgency_clause'], ['install a support tool', 'reply_bait']],
  },
  // ── legit (friend) ──
  'chase-fraud-alert-yes-no': {
    redFlags: [], clues: ['ask', 'context', 'sender'], crowdFraud: 0.7,
    rebrand: {
      sender: 'Meridian Bank',
      body: 'Meridian Bank Fraud Alert: Did you attempt a $487.20 card purchase at VOLTMART on 11/06? Reply YES or NO. We will never ask for your PIN, password or a code by text.',
      flags: ['Only asks YES or NO: no link, no login', 'Says it will never ask for codes', 'Arrives in your usual bank alert thread'],
    },
    marks: [['Reply YES or NO.', 'green'], ['We will never ask for your PIN, password or a code by text.', 'green']],
  },
  'google-code-you-requested': {
    redFlags: [], clues: ['context', 'ask', 'pressure'], crowdFraud: 0.55,
    rebrand: {
      sender: 'Nimbus ID',
      body: "[You're signing in to LinkMail on your new laptop]\n\nN-482913 is your Nimbus ID verification code. Don't share it with anyone.",
    },
    marks: [["[You're signing in to LinkMail on your new laptop]", 'green'], ["Don't share it with anyone.", 'green']],
  },
  'tmobile-bill-due': {
    redFlags: [], clues: ['callback', 'pressure', 'link'], crowdFraud: 0.3,
    rebrand: {
      sender: 'Nimbus Mobile',
      body: 'Nimbus Mobile: Your bill of $142.17 is due 11/15. AutoPay is currently OFF. To pay or turn on AutoPay, open the Nimbus Mobile app. Reply STOP to opt out.',
      flags: ['Points to the official app', 'No instant-shutoff threat', 'No lookalike link'],
      lesson: "Legit bill notices send you to the official app you already have, not to a mystery link.",
    },
    marks: [['open the Nimbus Mobile app', 'green']],
  },
  'roommate-cabin-link': {
    redFlags: [], clues: ['context', 'link', 'ask'], crowdFraud: 0.35,
    rebrand: {
      sender: 'Sam (your roommate, group chat)',
      body: "ok here's the cabin I was talking about at lunch!! it's on StayNest, search 'Pine Hollow cabin'. hot tub + 3 bedrooms, if we split 4 ways it's like $90 each. lmk by friday so I can book",
      flags: ['Follows up on a real conversation', 'Points you to an app you already use', 'No ask for your card or a code'],
      lesson: "A message is fine when it's expected, from someone you know, and points to an app or site you recognize.",
    },
    marks: [['the cabin I was talking about at lunch', 'green']],
  },
  'ups-delivery-today': {
    redFlags: [], clues: ['ask', 'link', 'pressure'], crowdFraud: 0.4,
    rebrand: {
      sender: 'Parcelo',
      body: 'Parcelo: Your package from Northwind Outfitters is scheduled for delivery today between 2:00 PM and 6:00 PM. Track or change delivery in the Parcelo app. No action needed.',
      flags: ['No fee or payment request', 'Points to the official app', "'No action needed'"],
    },
    marks: [['in the Parcelo app', 'green'], ['No action needed.', 'green']],
  },
  'cvs-prescription-ready': {
    redFlags: [], clues: ['ask', 'callback', 'context'], crowdFraud: 0.15,
    rebrand: {
      sender: 'Corner Pharmacy',
      body: 'Corner Pharmacy: Your prescription is ready for pickup at your Main St store. It will be held for 7 days. Questions? Call your store. Reply STOP to end texts.',
    },
    marks: [['Call your store.', 'green']],
  },
  'coworker-sprint-review': {
    redFlags: [], clues: ['sender', 'ask', 'context'], crowdFraud: 0.1,
    rebrand: {
      sender: 'Marcus (work chat, #platform-team)',
      flags: ['Known coworker on your company chat', 'No money, codes or links', 'Normal work context'],
    },
    marks: [['are we still on for the 2pm sprint review?', 'green']],
  },
  'mom-call-me-flights': {
    redFlags: [], clues: ['sender', 'callback', 'ask'], crowdFraud: 0.1,
    marks: [['Can you call me when you get a sec?', 'green']],
  },
  'tmobile-sim-change-alert': {
    redFlags: [], clues: ['link', 'callback', 'ask'], crowdFraud: 0.75,
    rebrand: {
      sender: 'Nimbus Mobile',
      body: 'Nimbus Mobile: A SIM change was just requested for your line ending 0142. If you did not request this, call 611 from another phone or visit a Nimbus Mobile store.',
      lesson: 'Real SIM-change alerts tell you to contact your carrier directly; they never ask you to read back a code.',
    },
    marks: [['call 611 from another phone or visit a Nimbus Mobile store', 'green']],
  },
  'dentist-reminder-call': {
    redFlags: [], clues: ['context', 'ask', 'callback'], crowdFraud: 0.2,
    marks: [['give the office a call back', 'green']],
  },
  'wellsfargo-fraud-call': {
    redFlags: [], clues: ['callback', 'ask', 'pressure'], crowdFraud: 0.7,
    rebrand: {
      sender: 'Caller ID: Cascade Financial',
      body: "\"This is Cascade Financial fraud prevention. We declined a $612 purchase on your card ending 4471. We won't ask for your PIN, password or any code. Please hang up and call the number on the back of your card so we can review it with you.\"",
    },
    marks: [["We won't ask for your PIN, password or any code.", 'green'], ['hang up and call the number on the back of your card', 'green']],
  },
  'tmobile-recruiter-linkedin': {
    redFlags: [], clues: ['link', 'context', 'ask'], crowdFraud: 0.5,
    rebrand: {
      sender: 'Nimbus Mobile recruiter (verified profile)',
      body: "Hi! I saw your hackathon project and think you'd be a great fit for our Associate Security Engineer role. Here's the posting on our official careers page. Open to a 20-min video call next week?",
      flags: ["Links to the company's real careers page", 'Proposes a normal video interview', 'No fees, checks or chat-app moves'],
      lesson: 'Legit recruiters point to the official job posting and a real interview, and never ask you to pay.',
    },
    marks: [['the posting on our official careers page', 'green'], ['a 20-min video call', 'green']],
  },
};

export interface FofClue { id: string; label: string; answer: string; diagnosticity: number }
export interface FofItem {
  id: string;
  channel: BankItem['channel'];
  sender: string;
  subject: string;
  body: string;
  isFraud: boolean;
  bankTactic: string;
  tactic: Tactic | null;
  redFlags: RedFlag[];
  flags: string[]; // re-branded red flags (fraud) or green flags (legit), plain sentences
  lesson: string;
  difficulty: number;
  marks: Mark[];
  clues: FofClue[];
  crowdFraud: number;
}

function buildItem(b: BankItem, a: FofAnnotation): FofItem {
  const r = { ...b, ...a.rebrand };
  return {
    id: b.id, channel: b.channel, sender: r.sender, subject: r.subject, body: r.body,
    isFraud: b.is_fraud, bankTactic: b.tactic,
    tactic: b.is_fraud ? a.tactic ?? BANK_TACTIC_TO_TACTIC[b.tactic] : null,
    redFlags: a.redFlags, flags: r.flags, lesson: r.lesson, difficulty: b.difficulty, marks: a.marks,
    clues: r.flags.map((answer, i) => {
      const kind = a.clues[i] ?? 'context';
      return { id: kind, label: CLUE_LABEL[kind], answer, diagnosticity: CLUE_DIAGNOSTICITY[kind] };
    }),
    crowdFraud: a.crowdFraud,
  };
}

/** The Friend or Fraud pool: bank items with an annotation (items naming real brands we couldn't re-brand cleanly are left out). */
export const FOF_ITEMS: FofItem[] = (bank as BankItem[])
  .filter((b) => ANNOTATIONS[b.id])
  .map((b) => buildItem(b, ANNOTATIONS[b.id]));

export const fofItem = (id: string) => FOF_ITEMS.find((i) => i.id === id);

/** Pick a 6-round set: 4 fraud with distinct mapped tactics + 2 legit; crowd shown in rounds 2 and 5 (index 1 and 4),
 *  and at least one of those has a crowd that leans the wrong way (the learning moment). */
export function pickFofRounds(rand: () => number = Math.random): { items: FofItem[]; crowdRounds: number[] } {
  const shuffle = <T,>(xs: T[]) => xs.map((x) => [rand(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
  const crowdWrong = (i: FofItem) => (i.crowdFraud >= 0.5) !== i.isFraud;
  const fraud: FofItem[] = [];
  for (const i of shuffle(FOF_ITEMS.filter((x) => x.isFraud))) if (fraud.length < 4 && !fraud.some((f) => f.tactic === i.tactic)) fraud.push(i);
  // One legit message the crowd tends to get wrong (over-suspicion), one other.
  const legitPool = shuffle(FOF_ITEMS.filter((x) => !x.isFraud));
  const tricky = legitPool.find(crowdWrong)!;
  const legit = [tricky, legitPool.find((x) => x !== tricky)!];
  const items = shuffle([...fraud, ...legit]);
  const crowdRounds = [1, 4];
  if (!crowdRounds.some((r) => crowdWrong(items[r]))) {
    const j = items.findIndex(crowdWrong);
    if (j >= 0) [items[1], items[j]] = [items[j], items[1]];
  }
  return { items, crowdRounds };
}

// ──────────────────────────────────────────────────────────────────────────
// Scamdle (spot the red flags)
// ──────────────────────────────────────────────────────────────────────────

export type Segment = string | [text: string, flag: RedFlag];
export interface ScamdlePuzzle {
  id: string;
  sender: string;
  segments: Segment[];
  tactic: Tactic;
  lesson: string;
  crowdSpot: Partial<Record<RedFlag, number>>; // hand-set fallback: share of players who spot each present flag
}

export const SCAMDLE_PUZZLES: ScamdlePuzzle[] = [
  {
    id: 'parcelo-fee', sender: '+1 (833) 555-0142', tactic: 'small_plausible_amount',
    segments: [['Parcelo', 'sender_identity'], ': Your package is held at the distribution center. A fee of ', ['$2.99', 'plausibility_bait'], ' is required before delivery. ', ['Pay within 30 minutes', 'urgency_clause'], ': ', ['parcelo.redelivery-help.top/fee', 'url_domain']],
    lesson: "Tiny fees are the bait. Carriers don't text payment links, so check the carrier's own app instead.",
    crowdSpot: { sender_identity: 0.5, plausibility_bait: 0.35, urgency_clause: 0.85, url_domain: 0.65 },
  },
  {
    id: 'meridian-callback', sender: '+1 (844) 555-0107', tactic: 'switch_channel',
    segments: [['Meridian Bank Alert', 'authority_claim'], ': We detected a $612.00 charge from Newark, NJ. To stop it, ', ['call our fraud desk at +1 (844) 555-0109 and confirm your card number', 'reply_bait'], ' ', ['within 1 hour', 'urgency_clause'], '. Your card will be frozen after that.'],
    lesson: 'Your bank never asks for your card number. Call the number printed on the back of your card instead.',
    crowdSpot: { authority_claim: 0.55, reply_bait: 0.5, urgency_clause: 0.9 },
  },
  {
    id: 'dana-giftcards', sender: '+1 (469) 555-0115', tactic: 'authority_impersonation',
    segments: [["Hey, it's Dana, new number", 'sender_identity'], '. ', ["I'm stuck with the board", 'authority_claim'], ' and need you to grab ', ['8 Beacon gift cards', 'payment_rail'], ' for a client thank-you. ', ["You're the only one I trust with this", 'personalization_overreach'], ", I'll reimburse you. ", ['Can you do it in the next hour?', 'urgency_clause']],
    lesson: 'A boss on a new number asking for gift cards is a scam. Check with them on a channel you already use.',
    crowdSpot: { sender_identity: 0.6, authority_claim: 0.45, payment_rail: 0.85, personalization_overreach: 0.3, urgency_clause: 0.8 },
  },
  {
    id: 'neighbor-rebate', sender: '+1 (281) 555-0193', tactic: 'social_proof',
    segments: [['City Energy Rebate', 'authority_claim'], ': ', ['2,314 of your neighbors', 'plausibility_bait'], ' ', ['on Oak Street', 'personalization_overreach'], ' already claimed their $75 rebate. ', ['Only 40 spots left today', 'urgency_clause'], '. Claim yours: ', ['rebates.gs-renewal-center.com/claim', 'url_domain']],
    lesson: "\"Everyone's doing it\" is a pressure trick. Real rebates live on your utility's own site, which you type in yourself.",
    crowdSpot: { authority_claim: 0.4, plausibility_bait: 0.3, personalization_overreach: 0.35, urgency_clause: 0.8, url_domain: 0.6 },
  },
];

export const puzzleFlags = (p: ScamdlePuzzle): RedFlag[] =>
  [...new Set(p.segments.flatMap((s) => (typeof s === 'string' ? [] : [s[1]])))];
export const puzzleText = (p: ScamdlePuzzle) => p.segments.map((s) => (typeof s === 'string' ? s : s[0])).join('');

// ──────────────────────────────────────────────────────────────────────────
// Build a Bad Scam (you're the scammer)
// ──────────────────────────────────────────────────────────────────────────

export interface Persona { id: string; name: string; blurb: string; traits: Record<TraitKey, number> }
export const PERSONAS: Persona[] = [
  {
    id: 'persona-student', name: 'Sam, 20', blurb: 'College student. Orders a lot online, always on their phone.',
    traits: { urgency_reactivity: 0.7, authority_deference: 0.4, consensus_susceptibility: 0.75, plausibility_anchoring: 0.8, reciprocity_pull: 0.5, scarcity_response: 0.7, verification_deficit: 0.6, channel_switch_tolerance: 0.7 },
  },
  {
    id: 'persona-retiree', name: 'Rita, 71', blurb: 'Retired. New to texting, trusts anything that sounds official.',
    traits: { urgency_reactivity: 0.7, authority_deference: 0.9, consensus_susceptibility: 0.4, plausibility_anchoring: 0.5, reciprocity_pull: 0.65, scarcity_response: 0.4, verification_deficit: 0.7, channel_switch_tolerance: 0.6 },
  },
  {
    id: 'persona-manager', name: 'Jay, 38', blurb: 'Busy team lead. Answers messages between meetings.',
    traits: { urgency_reactivity: 0.85, authority_deference: 0.65, consensus_susceptibility: 0.5, plausibility_anchoring: 0.6, reciprocity_pull: 0.55, scarcity_response: 0.35, verification_deficit: 0.6, channel_switch_tolerance: 0.4 },
  },
];

/** The two Bad Scam rounds (archetype ids from data/scam-archetypes.json) and the slot values used (allowed + fictional). */
export const BADSCAM_ROUNDS: { archetypeId: string; slots: Record<string, string>; pitch: string; crowdPick: Partial<Record<Tactic, number>> }[] = [
  {
    archetypeId: 'delivery-fee', slots: { amount: '$2.99' },
    pitch: 'A fake "Parcelo" redelivery-fee text.',
    crowdPick: { urgency_deadline: 0.6, small_plausible_amount: 0.5, authority_impersonation: 0.3, social_proof: 0.15 },
  },
  {
    archetypeId: 'boss-gift-card', slots: { bossName: 'Dana', count: '8', brand: 'Beacon' },
    pitch: 'A "boss" text asking for gift cards.',
    crowdPick: { authority_impersonation: 0.65, urgency_deadline: 0.55, favor_then_ask: 0.3, bypass_verification: 0.2 },
  },
];

/** One extra line each tactic adds to the scam, and the red flag a careful reader would spot in it. */
export const TACTIC_LINE: Record<Tactic, { line: string; flag: RedFlag }> = {
  urgency_deadline: { line: 'Respond within 2 hours or this is cancelled.', flag: 'urgency_clause' },
  authority_impersonation: { line: '— Official Notices Department', flag: 'authority_claim' },
  social_proof: { line: 'Over 2,000 people have already done this today.', flag: 'plausibility_bait' },
  small_plausible_amount: { line: "It's only a small processing fee.", flag: 'plausibility_bait' },
  favor_then_ask: { line: "We've added a $5 thank-you credit to your account.", flag: 'personalization_overreach' },
  limited_window: { line: 'This offer closes at midnight tonight.', flag: 'urgency_clause' },
  bypass_verification: { line: "No need to call anyone to check, it's all handled here.", flag: 'url_domain' },
  switch_channel: { line: 'Text us back on ChatterBox for faster help.', flag: 'reply_bait' },
};
