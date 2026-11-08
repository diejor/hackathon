import { describe, it, expect } from 'vitest';
import { computeScore } from './scoring';
import { GameEvent, EngagementEvent } from './contracts';

const scamdle: GameEvent = {
  game: 'scamdle',
  puzzleId: 'p1',
  attempts: 2,
  flagsFound: [],
  flagsMissed: [],
  flagsFalsePositive: [],
  elapsedMs: 40_000,
};
const guesswho: GameEvent = {
  game: 'guesswho',
  roundId: 'r1',
  questionsAsked: [],
  questionsDiagnosticity: [],
  guessedContactId: 'c1',
  correctContactId: 'c1',
  deferredToBot: false,
  followedBotConsensus: false,
  elapsedMs: 60_000,
};
const badscam: GameEvent = {
  game: 'badscam',
  targetPersonaId: 'persona-a',
  archetypeId: 'delivery-fee',
  tacticsChosen: [],
  paymentRail: 'card_fee',
  reachScore: 42,
  elapsedMs: 50_000,
};
const threeGames = [scamdle, guesswho, badscam];

describe('computeScore', () => {
  it('three games, no engagements → total 300, resilience 0', () => {
    const r = computeScore(threeGames, []);
    expect(r.total).toBe(300);
    expect(r.atRisk).toBe(0);
    expect(r.recoverable).toBe(0);
    expect(r.resilienceScore).toBe(0);
  });

  it('three games + one fast reported → 500', () => {
    const e: EngagementEvent = {
      campaignId: 'c1',
      stage: 1,
      channel: 'imessage',
      outcome: 'reported',
      latencyMs: 20_000,
    };
    const r = computeScore(threeGames, [e]);
    expect(r.total).toBe(500);
    expect(r.resilienceScore).toBe(100);
  });

  it('three games + one engaged → total 225, atRisk 75, recoverable 75', () => {
    const e: EngagementEvent = {
      campaignId: 'c1',
      stage: 1,
      channel: 'imessage',
      outcome: 'engaged',
      latencyMs: 5_000,
    };
    const r = computeScore(threeGames, [e]);
    expect(r.total).toBe(225);
    expect(r.atRisk).toBe(75);
    expect(r.recoverable).toBe(75);
    expect(r.resilienceScore).toBe(0);
  });

  it('three stages reported / ignored / engaged → weighted resilience', () => {
    const es: EngagementEvent[] = [
      { campaignId: 'c1', stage: 1, channel: 'imessage', outcome: 'reported', latencyMs: 90_000 },
      { campaignId: 'c1', stage: 2, channel: 'imessage', outcome: 'ignored', latencyMs: 300_000 },
      { campaignId: 'c1', stage: 3, channel: 'voice', outcome: 'engaged', latencyMs: 10_000 },
    ];
    const r = computeScore(threeGames, es);
    // 300 + 150 (reported, slow) + 25 (ignored) - 75 (engaged) = 400
    expect(r.total).toBe(400);
    expect(r.atRisk).toBe(75);
    // weights: 1*1 + 2*1 + 3*0 = 3 of 1+2+3 = 6 → 50
    expect(r.resilienceScore).toBe(50);
  });

  it('empty inputs → zeros', () => {
    const r = computeScore([], []);
    expect(r.total).toBe(0);
    expect(r.resilienceScore).toBe(0);
    expect(r.breakdown).toEqual([]);
  });
});
