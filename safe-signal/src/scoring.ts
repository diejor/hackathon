import {
  GameEvent,
  EngagementEvent,
  ScoreResult,
  ScoreBreakdownItem,
  SCORE,
} from './contracts';

// Pure function. No I/O, no clock reads, no randomness.
export function computeScore(
  games: GameEvent[],
  engagements: EngagementEvent[],
): ScoreResult {
  const breakdown: ScoreBreakdownItem[] = [];
  let total = 0;
  let atRisk = 0;

  for (const g of games) {
    const label = `${g.game} complete`;
    total += SCORE.perGameCompleted;
    breakdown.push({ label, points: SCORE.perGameCompleted });
  }

  for (const e of engagements) {
    if (e.outcome === 'reported') {
      const base = SCORE.perReported;
      total += base;
      breakdown.push({ label: `stage ${e.stage} reported`, points: base });
      if (e.latencyMs < SCORE.fastReportBonusMs) {
        total += SCORE.fastReportBonus;
        breakdown.push({
          label: `stage ${e.stage} fast-report bonus`,
          points: SCORE.fastReportBonus,
        });
      }
    } else if (e.outcome === 'ignored') {
      total += SCORE.perIgnored;
      breakdown.push({ label: `stage ${e.stage} ignored`, points: SCORE.perIgnored });
    } else if (e.outcome === 'engaged') {
      const loss = SCORE.perEngagedAtRisk;
      total -= loss;
      atRisk += loss;
      breakdown.push({
        label: `stage ${e.stage} engaged (at risk)`,
        points: -loss,
      });
    }
  }

  const recoverable = Math.round(atRisk * SCORE.debriefRecoveryFraction);

  // Resilience: weighted average across stages present in engagements.
  // A stage counts as "survived" when outcome is reported or ignored.
  let weightSum = 0;
  let scoreSum = 0;
  for (const e of engagements) {
    const w = SCORE.stageWeights[e.stage] ?? 1;
    const survived = e.outcome === 'reported' || e.outcome === 'ignored' ? 1 : 0;
    weightSum += w;
    scoreSum += w * survived;
  }
  const resilienceScore =
    weightSum === 0 ? 0 : Math.round((scoreSum / weightSum) * 100);

  return {
    total,
    atRisk,
    recoverable,
    resilienceScore,
    breakdown,
  };
}
