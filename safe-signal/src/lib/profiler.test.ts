import { describe, expect, it } from 'vitest';
import { BadScamEvent, GuessWhoEvent, NEUTRAL_PROFILE, ScamdleEvent } from '../contracts';
import { buildProfile } from './profiler';

const scamdle = (over: Partial<ScamdleEvent> = {}): ScamdleEvent => ({
  game: 'scamdle', puzzleId: 'p', attempts: 1, flagsFound: [], flagsMissed: [], flagsFalsePositive: [], elapsedMs: 40_000, ...over,
});
const fof = (over: Partial<GuessWhoEvent> = {}): GuessWhoEvent => ({
  game: 'guesswho', roundId: 'r', questionsAsked: [], questionsDiagnosticity: [], guessedContactId: 'fraud', correctContactId: 'fraud',
  deferredToBot: false, followedBotConsensus: false, elapsedMs: 10_000, ...over,
});
const bad = (over: Partial<BadScamEvent> = {}): BadScamEvent => ({
  game: 'badscam', targetPersonaId: 'persona-student', archetypeId: 'delivery-fee', tacticsChosen: [], paymentRail: 'card_fee', reachScore: 40, elapsedMs: 20_000, ...over,
});
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('buildProfile across rounds', () => {
  it('no events → neutral', () => {
    expect(buildProfile([])).toEqual(NEUTRAL_PROFILE);
  });

  it('a single round per game keeps the original single-round rules', () => {
    const p = buildProfile([
      scamdle({ flagsMissed: ['url_domain'], flagsFound: ['urgency_clause'] }),
      fof({ questionsAsked: ['link'], questionsDiagnosticity: [0.9], deferredToBot: true, followedBotConsensus: true }),
      bad({ tacticsChosen: ['urgency_deadline'] }),
    ]);
    // scamdle: verification +0.1, urgency -0.05; fof: authority +0.15, consensus +0.15, <3 questions urgency +0.1;
    // bad scam: urgency -0.1, the other seven traits +0.05.
    close(p.verification_deficit, 0.5 + 0.1 + 0.05);
    close(p.urgency_reactivity, 0.5 - 0.05 + 0.1 - 0.1);
    close(p.authority_deference, 0.5 + 0.15 + 0.05);
    close(p.consensus_susceptibility, 0.5 + 0.15 + 0.05);
  });

  it('Scamdle rounds are averaged, so four identical rounds equal one', () => {
    const one = buildProfile([scamdle({ flagsMissed: ['url_domain', 'reply_bait'] })]);
    const four = buildProfile(Array.from({ length: 4 }, () => scamdle({ flagsMissed: ['url_domain', 'reply_bait'] })));
    expect(four).toEqual(one);
  });

  it('mixed Scamdle rounds land between the extremes', () => {
    const p = buildProfile([scamdle({ flagsMissed: ['url_domain'] }), scamdle({ flagsFound: ['url_domain'] })]);
    close(p.verification_deficit, 0.5 + (0.1 - 0.05) / 2);
  });

  it('Friend or Fraud counts questions over the whole game and crowd-following over crowd rounds only', () => {
    const rounds = [
      fof({ questionsAsked: ['link', 'sender'], questionsDiagnosticity: [0.9, 0.75] }),
      fof({ questionsAsked: ['ask'], questionsDiagnosticity: [0.9], crowdShown: true, followedBotConsensus: true, deferredToBot: true }),
      fof({ questionsAsked: ['callback', 'polish'], questionsDiagnosticity: [0.9, 0.1], crowdShown: true }),
      fof({ questionsAsked: [], questionsDiagnosticity: [] }),
    ];
    const p = buildProfile(rounds);
    // 5 questions → careful (verification -0.1); mean diagnosticity 0.69 ≥ 0.5; followed the crowd in 1 of 2 crowd rounds.
    close(p.verification_deficit, 0.5 - 0.1);
    close(p.consensus_susceptibility, 0.5 + 0.075);
    close(p.authority_deference, 0.5 + 0.075);
    close(p.urgency_reactivity, 0.5);
  });

  it('scams called "friend" raise the trait their tactic exploits', () => {
    const p = buildProfile([
      fof({ isFraud: true, tactic: 'small_plausible_amount', guessedContactId: 'friend', questionsAsked: ['a', 'b', 'c'], questionsDiagnosticity: [1, 1, 1] }),
      fof({ isFraud: true, tactic: 'authority_impersonation', guessedContactId: 'fraud' }),
    ]);
    close(p.plausibility_anchoring, 0.5 + 0.2 / 2);
    close(p.authority_deference, 0.5 - 0.05 / 2);
  });

  it('Bad Scam rounds are averaged and the reach bonus applies per round', () => {
    const p = buildProfile([bad({ tacticsChosen: ['urgency_deadline'], reachScore: 90 }), bad({ tacticsChosen: ['social_proof'], reachScore: 30 })]);
    // urgency: (-0.1 - 0.05) and (+0.05) → avg -0.05; consensus: (+0.05 - 0.05) and (-0.1) → avg -0.05
    close(p.urgency_reactivity, 0.5 - 0.05);
    close(p.consensus_susceptibility, 0.5 - 0.05);
    close(p.scarcity_response, 0.5 + (0 + 0.05) / 2);
  });

  it('stays within 0..1', () => {
    const p = buildProfile(Array.from({ length: 6 }, () => fof({ isFraud: true, tactic: 'urgency_deadline', guessedContactId: 'friend' })));
    for (const v of Object.values(p)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });
});
