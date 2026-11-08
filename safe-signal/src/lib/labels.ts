// Plain-words labels for every id the profiler and archetype catalog use, so no snake_case id
// reaches the screen. Shared by /campaign, the debrief, and the coach profile report.
import type { PaymentRail, ProfileVector, RedFlag, Tactic, TraitKey } from '../contracts';
import { TRAIT_KEYS } from '../contracts';

export interface Label {
  /** Short name, fits a chip or a radar axis. */
  name: string;
  /** One-line explanation. */
  about: string;
}

export interface TraitLabel extends Label {
  /** One or two very short lines for the radar axis. */
  axis: string[];
  /** "You tend to ..." sentence for the weak-spot list. */
  weakness: string;
}

export const TRAIT_LABELS: Record<TraitKey, TraitLabel> = {
  urgency_reactivity: {
    name: 'Acting under pressure',
    axis: ['Deadlines'],
    about: 'How quickly a countdown or "act now" pushes you to respond.',
    weakness: 'You tend to act fast when a message sets a deadline.',
  },
  authority_deference: {
    name: 'Trusting official senders',
    axis: ['Authority'],
    about: 'How much a bank, boss or agency name makes a message feel real.',
    weakness: 'You tend to go along when a message claims to be your bank, boss or a government office.',
  },
  consensus_susceptibility: {
    name: 'Following the crowd',
    axis: ['Crowd'],
    about: 'How much "everyone else is doing it" sways you.',
    weakness: 'You tend to trust something because other people, or a bot, seem to.',
  },
  plausibility_anchoring: {
    name: 'Believing small asks',
    axis: ['Small', 'amounts'],
    about: 'How easily a small, realistic amount slips past your guard.',
    weakness: 'You tend to pay a small fee without checking, because it seems too minor to be a scam.',
  },
  reciprocity_pull: {
    name: 'Returning favors',
    axis: ['Favors'],
    about: 'How much a gift, refund or personal touch makes you want to help back.',
    weakness: 'You tend to feel you owe something when a message offers help, a reward or knows personal details.',
  },
  scarcity_response: {
    name: 'Fear of missing out',
    axis: ['Limited', 'offers'],
    about: 'How strongly "only a few left" or "offer ends today" pulls you in.',
    weakness: 'You tend to jump when an offer is limited or about to expire.',
  },
  verification_deficit: {
    name: 'Skipping the double-check',
    axis: ['Double-', 'checking'],
    about: 'How often you trust a link or sender without checking another way.',
    weakness: 'You tend to trust a link or sender without checking it through the official app or number.',
  },
  channel_switch_tolerance: {
    name: 'Switching channels',
    axis: ['Replies &', 'call-backs'],
    about: 'How readily you reply, call back or move to another app when asked.',
    weakness: 'You tend to reply, call back or switch apps when a message asks you to.',
  },
};

export const FLAG_LABELS: Record<RedFlag, Label> = {
  sender_identity: { name: 'Unknown sender', about: 'It claims to be a company, but it came from a number or name you cannot confirm.' },
  url_domain: { name: 'Look-alike link', about: 'The link is not the company\'s real website. Real companies send you to their own app or site.' },
  plausibility_bait: { name: 'Small, believable amount', about: 'A tiny fee feels too small to question. That is exactly why scammers use it.' },
  urgency_clause: { name: 'Deadline pressure', about: 'A countdown or "late fee" is there to rush you past thinking.' },
  authority_claim: { name: 'Claims authority', about: 'It borrows the weight of a bank, boss or agency so you do not push back.' },
  payment_rail: { name: 'Odd way to pay', about: 'Gift cards, wires, crypto or a card "fee" are hard to reverse. Real organizations rarely ask for them by text.' },
  reply_bait: { name: 'Reply or call-back bait', about: 'It asks you to reply or call, which moves you into a conversation the scammer controls.' },
  personalization_overreach: { name: 'Too personal, too fast', about: 'It uses names or details to feel familiar, then asks for something unusual.' },
};

export const TACTIC_LABELS: Record<Tactic, Label> = {
  urgency_deadline: { name: 'A deadline', about: 'Adds a time limit so you act before you think.' },
  authority_impersonation: { name: 'Posing as someone official', about: 'Pretends to be a bank, boss or agency.' },
  social_proof: { name: 'Everyone else is doing it', about: 'Suggests other people have already trusted it.' },
  small_plausible_amount: { name: 'A small, believable amount', about: 'Asks for a fee too small to seem worth checking.' },
  favor_then_ask: { name: 'A favor, then an ask', about: 'Offers help or a reward first, so saying no feels rude.' },
  limited_window: { name: 'A limited offer', about: 'Says the chance is about to disappear.' },
  bypass_verification: { name: 'Skip the usual checks', about: 'Gives a reason not to verify the normal way.' },
  switch_channel: { name: 'Move to another channel', about: 'Asks you to reply, call or switch apps.' },
};

export const RAIL_LABELS: Record<PaymentRail, Label> = {
  gift_card: { name: 'Gift cards', about: 'Untraceable once the codes are shared. No real business or agency takes payment in gift cards.' },
  wire: { name: 'Wire transfer', about: 'Money leaves almost instantly and is very hard to recall.' },
  crypto: { name: 'Cryptocurrency', about: 'Payments cannot be reversed and are hard to trace.' },
  p2p_app: { name: 'Payment app', about: 'Peer-to-peer apps treat transfers like cash. Purchase protection usually does not apply.' },
  card_fee: { name: 'Card "fee" on a fake page', about: 'The real prize is your card number, typed into a look-alike page.' },
  ach: { name: 'Bank transfer', about: 'Moving money out of your account to "protect" it is a classic bank-impostor move.' },
};

export interface ArchetypeLabel extends Label {
  /** Short noun phrase for the "the scam that would get you" headline. */
  headline: string;
}

export const ARCHETYPE_LABELS: Record<string, ArchetypeLabel> = {
  'delivery-fee': { name: 'Delivery fee text', headline: 'A package held for a tiny fee', about: 'A "courier" says your package is stuck until you pay a small redelivery fee.' },
  'toll-fee': { name: 'Unpaid toll text', headline: 'An unpaid toll with a late fee', about: 'A "toll agency" says you owe a few dollars and late fees start soon.' },
  'bank-hold': { name: 'Bank fraud alert', headline: 'A fraud alert from "your bank"', about: 'A "bank" flags a charge and asks you to reply or call to sort it out.' },
  'boss-gift-card': { name: 'Boss gift-card request', headline: 'Your "boss" needs gift cards now', about: 'Someone posing as your manager asks you to buy gift cards quickly and quietly.' },
  'irs-balance': { name: 'Tax balance due', headline: 'A tax bill you must pay today', about: 'A "tax office" says you owe money and threatens penalties unless you pay right away.' },
  'prize-sweepstakes': { name: 'Prize winner text', headline: 'A prize you never entered for', about: 'You "won" something, and just need to pay a small fee to claim it.' },
  'tech-support-lockout': { name: 'Account lockout warning', headline: 'Your account is about to be locked', about: 'A "support team" says your account will be locked unless you sign in through their link.' },
};

export const archetypeLabel = (id: string, fallback?: string): ArchetypeLabel =>
  ARCHETYPE_LABELS[id] ?? { name: fallback ?? 'Simulated scam', headline: fallback ?? 'A simulated scam', about: '' };

/** Traits sorted from most to least exploitable. */
export function topTraits(profile: ProfileVector, count = 3): TraitKey[] {
  return [...TRAIT_KEYS].sort((a, b) => profile[b] - profile[a]).slice(0, count);
}

/** "Low", "Medium" or "High" for a 0..1 trait score (higher = easier to exploit). */
export function levelOf(value: number): 'Low' | 'Medium' | 'High' {
  return value >= 0.6 ? 'High' : value >= 0.45 ? 'Medium' : 'Low';
}

/** Campaign status ids in plain words. */
export const STATUS_LABELS: Record<string, string> = {
  pending: 'Being built',
  preview: 'Preview only, not sent',
  sending: 'Sending to your phone…',
  sent: 'Sent to your phone. Watch for it in Messages.',
  delivery_unknown: 'We could not confirm delivery. It will not be resent automatically.',
  debrief: 'Debrief opened. This drill is finished.',
  reported: 'You reported it. Drill complete.',
};

export const OUTCOME_LABELS: Record<string, string> = {
  reported: 'You reported it. Nicely done.',
  ignored: 'You ignored it. Safe, but reporting helps protect others too.',
  engaged: 'You tapped the link. No harm done here, and the debrief shows what to watch for.',
};
