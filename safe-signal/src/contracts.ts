// Frozen shared contracts for Safe Signal. Do not rename any fields.
// Referenced by: scoring, guards, profiler, renderer, game pages, API routes.

// ──────────────────────────────────────────────────────────────────────────
// Trait vector — what an attacker can exploit about a given player.
// ──────────────────────────────────────────────────────────────────────────

export type TraitKey =
  | 'urgency_reactivity'
  | 'authority_deference'
  | 'consensus_susceptibility'
  | 'plausibility_anchoring'
  | 'reciprocity_pull'
  | 'scarcity_response'
  | 'verification_deficit'
  | 'channel_switch_tolerance';

export type ProfileVector = Record<TraitKey, number>;

export const TRAIT_KEYS: TraitKey[] = [
  'urgency_reactivity',
  'authority_deference',
  'consensus_susceptibility',
  'plausibility_anchoring',
  'reciprocity_pull',
  'scarcity_response',
  'verification_deficit',
  'channel_switch_tolerance',
];

export const NEUTRAL_PROFILE: ProfileVector = {
  urgency_reactivity: 0.5,
  authority_deference: 0.5,
  consensus_susceptibility: 0.5,
  plausibility_anchoring: 0.5,
  reciprocity_pull: 0.5,
  scarcity_response: 0.5,
  verification_deficit: 0.5,
  channel_switch_tolerance: 0.5,
};

// ──────────────────────────────────────────────────────────────────────────
// Red-flag taxonomy used by Scamdle and by the archetype catalog.
// ──────────────────────────────────────────────────────────────────────────

export type RedFlag =
  | 'sender_identity'
  | 'url_domain'
  | 'plausibility_bait'
  | 'urgency_clause'
  | 'authority_claim'
  | 'payment_rail'
  | 'reply_bait'
  | 'personalization_overreach';

export const FLAG_TO_TRAIT: Record<RedFlag, TraitKey> = {
  sender_identity: 'authority_deference',
  url_domain: 'verification_deficit',
  plausibility_bait: 'plausibility_anchoring',
  urgency_clause: 'urgency_reactivity',
  authority_claim: 'authority_deference',
  payment_rail: 'verification_deficit',
  reply_bait: 'channel_switch_tolerance',
  personalization_overreach: 'reciprocity_pull',
};

// ──────────────────────────────────────────────────────────────────────────
// Tactics — manipulation levers an attacker composes into an attack plan.
// ──────────────────────────────────────────────────────────────────────────

export type Tactic =
  | 'urgency_deadline'
  | 'authority_impersonation'
  | 'social_proof'
  | 'small_plausible_amount'
  | 'favor_then_ask'
  | 'limited_window'
  | 'bypass_verification'
  | 'switch_channel';

export const TACTICS: Tactic[] = [
  'urgency_deadline',
  'authority_impersonation',
  'social_proof',
  'small_plausible_amount',
  'favor_then_ask',
  'limited_window',
  'bypass_verification',
  'switch_channel',
];

export const TACTIC_TO_TRAIT: Record<Tactic, TraitKey> = {
  urgency_deadline: 'urgency_reactivity',
  authority_impersonation: 'authority_deference',
  social_proof: 'consensus_susceptibility',
  small_plausible_amount: 'plausibility_anchoring',
  favor_then_ask: 'reciprocity_pull',
  limited_window: 'scarcity_response',
  bypass_verification: 'verification_deficit',
  switch_channel: 'channel_switch_tolerance',
};

export const PAYMENT_RAILS = [
  'gift_card',
  'wire',
  'crypto',
  'p2p_app',
  'card_fee',
  'ach',
] as const;
export type PaymentRail = (typeof PAYMENT_RAILS)[number];

// ──────────────────────────────────────────────────────────────────────────
// Archetype library (shape only — data lives in data/scam-archetypes.json)
// ──────────────────────────────────────────────────────────────────────────

export interface Archetype {
  id: string;
  label: string;
  family: 'delivery' | 'toll' | 'bank' | 'boss' | 'tax' | 'prize' | 'tech_support';
  template: string; // supports {{slot}} and {{tokenUrl}}
  slots: Record<string, string[]>; // slot name → allowed fictional values
  flagsPresent: RedFlag[];
  traitLoads: Partial<Record<TraitKey, number>>; // how strongly this exploits each trait
  allowedPaymentRails: PaymentRail[];
  realWorldNote: string;
}

export type ArchetypeLibrary = Archetype[];

// ──────────────────────────────────────────────────────────────────────────
// Attack plan — the model emits this; the renderer turns it into a string.
// ──────────────────────────────────────────────────────────────────────────

export interface AttackPlan {
  stage: 1 | 2 | 3;
  channel: 'imessage' | 'voice';
  archetypeId: string;
  tactics: Tactic[]; // <= 2
  slots: Record<string, string>; // filled from archetype.slots
  targetedTraits: TraitKey[];
  rationale: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Game events — emitted by each game and stored for the profiler.
// ──────────────────────────────────────────────────────────────────────────

export interface ScamdleEvent {
  game: 'scamdle';
  puzzleId: string;
  attempts: number;
  flagsFound: RedFlag[];
  flagsMissed: RedFlag[];
  flagsFalsePositive: RedFlag[];
  elapsedMs: number;
}

export interface GuessWhoEvent {
  game: 'guesswho';
  roundId: string;
  questionsAsked: string[]; // question ids from the bank
  questionsDiagnosticity: number[]; // 0..1 per asked question
  guessedContactId: string;
  correctContactId: string;
  deferredToBot: boolean;
  followedBotConsensus: boolean;
  elapsedMs: number;
}

export interface BadScamEvent {
  game: 'badscam';
  targetPersonaId: string;
  archetypeId: string;
  tacticsChosen: Tactic[];
  paymentRail: PaymentRail;
  reachScore: number; // 0..100
  elapsedMs: number;
}

export type GameEvent = ScamdleEvent | GuessWhoEvent | BadScamEvent;

// ──────────────────────────────────────────────────────────────────────────
// Engagement events — outcome of an actual simulated send.
// ──────────────────────────────────────────────────────────────────────────

export type EngagementOutcome = 'reported' | 'ignored' | 'engaged';

export interface EngagementEvent {
  campaignId: string;
  stage: 1 | 2 | 3;
  channel: 'imessage' | 'voice';
  outcome: EngagementOutcome;
  latencyMs: number; // time from send to player action
}

// ──────────────────────────────────────────────────────────────────────────
// Scoring.
// ──────────────────────────────────────────────────────────────────────────

export const SCORE = {
  perGameCompleted: 100,
  perReported: 150,
  fastReportBonus: 50,
  fastReportBonusMs: 60_000,
  perIgnored: 25,
  perEngagedAtRisk: 75, // deducted but recoverable
  debriefRecoveryFraction: 1.0,
  stageWeights: { 1: 1, 2: 2, 3: 3 } as const,
} as const;

export interface ScoreBreakdownItem {
  label: string;
  points: number;
}

export interface ScoreResult {
  total: number;
  atRisk: number;
  recoverable: number;
  resilienceScore: number; // 0..100
  breakdown: ScoreBreakdownItem[];
}
