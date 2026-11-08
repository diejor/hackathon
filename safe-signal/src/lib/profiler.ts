import { AttackPlan, ArchetypeLibrary, BadScamEvent, FLAG_TO_TRAIT, GameEvent, GuessWhoEvent, NEUTRAL_PROFILE, ProfileVector, ScamdleEvent, TACTICS, TACTIC_TO_TRAIT, TRAIT_KEYS, TraitKey } from '../contracts';

type Delta = Partial<Record<TraitKey, number>>;
const add = (d: Delta, trait: TraitKey, v: number) => { d[trait] = (d[trait] ?? 0) + v; };

/** One Scamdle round's trait deltas (unchanged rules from the single-round version). */
function scamdleDelta(event: ScamdleEvent): Delta {
  const d: Delta = {};
  for (const flag of event.flagsMissed) add(d, FLAG_TO_TRAIT[flag], 0.1);
  for (const flag of event.flagsFound) add(d, FLAG_TO_TRAIT[flag], -0.05);
  add(d, 'verification_deficit', event.flagsFalsePositive.length * 0.025);
  if (event.elapsedMs < 30_000) add(d, 'urgency_reactivity', -0.05);
  return d;
}

/** One Bad Scam round's trait deltas (unchanged rules from the single-round version). */
function badScamDelta(event: BadScamEvent): Delta {
  const d: Delta = {};
  for (const tactic of TACTICS) add(d, TACTIC_TO_TRAIT[tactic], event.tacticsChosen.includes(tactic) ? -0.1 : 0.05);
  if (event.reachScore >= 80) for (const trait of TRAIT_KEYS) add(d, trait, -0.05);
  return d;
}

/** Friend or Fraud / Guess Who over all its rounds. With one round this is exactly the old single-round rule set. */
function guessWhoDelta(rounds: GuessWhoEvent[]): Delta {
  const d: Delta = {};
  const n = rounds.length;
  const diagnosticity = rounds.flatMap((r) => r.questionsDiagnosticity);
  if (diagnosticity.length && diagnosticity.reduce((sum, value) => sum + value, 0) / diagnosticity.length < 0.5) add(d, 'verification_deficit', 0.1);
  // Deference and crowd-following are measured on the rounds where the crowd was shown (all rounds for older rows).
  const crowdRounds = rounds.some((r) => r.crowdShown) ? rounds.filter((r) => r.crowdShown) : rounds;
  const share = (pred: (r: GuessWhoEvent) => boolean) => crowdRounds.filter(pred).length / crowdRounds.length;
  add(d, 'authority_deference', 0.15 * share((r) => r.deferredToBot));
  add(d, 'consensus_susceptibility', 0.15 * share((r) => r.followedBotConsensus));
  // Questions are counted over the whole game: five or more is careful, fewer than three is hurried.
  const asked = rounds.reduce((sum, r) => sum + r.questionsAsked.length, 0);
  if (asked >= 5) add(d, 'verification_deficit', -0.1);
  if (asked < 3) add(d, 'urgency_reactivity', 0.1);
  // New in multi-round play: a scam you called a friend raises the trait its tactic exploits.
  for (const r of rounds) {
    if (r.isFraud && r.tactic && r.guessedContactId !== r.correctContactId) add(d, TACTIC_TO_TRAIT[r.tactic], 0.2 / n);
    if (r.isFraud && r.tactic && r.guessedContactId === r.correctContactId) add(d, TACTIC_TO_TRAIT[r.tactic], -0.05 / n);
  }
  return d;
}

const average = (deltas: Delta[]): Delta => {
  const out: Delta = {};
  for (const d of deltas) for (const [k, v] of Object.entries(d)) add(out, k as TraitKey, (v as number) / deltas.length);
  return out;
};

/** Aggregates every stored round. Each game counts once: per-round deltas are averaged within a game
 *  (so 4 Scamdle rounds weigh the same as one), then the three games are summed onto the neutral profile. */
export function buildProfile(events: GameEvent[]): ProfileVector {
  const profile = { ...NEUTRAL_PROFILE };
  const scamdle = events.filter((e): e is ScamdleEvent => e.game === 'scamdle');
  const guesswho = events.filter((e): e is GuessWhoEvent => e.game === 'guesswho');
  const badscam = events.filter((e): e is BadScamEvent => e.game === 'badscam');
  const parts: Delta[] = [];
  if (scamdle.length) parts.push(average(scamdle.map(scamdleDelta)));
  if (guesswho.length) parts.push(guessWhoDelta(guesswho));
  if (badscam.length) parts.push(average(badscam.map(badScamDelta)));
  for (const part of parts) for (const [k, v] of Object.entries(part)) profile[k as TraitKey] += v as number;
  for (const trait of TRAIT_KEYS) profile[trait] = Math.max(0, Math.min(1, profile[trait]));
  return profile;
}

export function selectAttackPlan(profile: ProfileVector, library: ArchetypeLibrary, stage: 1 | 2 | 3): AttackPlan {
  if (!library.length) throw new Error('The archetype library is empty.');
  const targetedTraits = [...TRAIT_KEYS].sort((a, b) => profile[b] - profile[a]).slice(0, 2);
  const score = (archetype: ArchetypeLibrary[number]) => targetedTraits.reduce((sum, trait) => sum + profile[trait] * (archetype.traitLoads[trait] ?? 0), 0);
  const archetype = [...library].sort((a, b) => score(b) - score(a))[0];
  const slots: Record<string, string> = {};
  for (const [name, values] of Object.entries(archetype.slots)) {
    if (!values.length) throw new Error(`Empty slot ${name}.`);
    slots[name] = values[Math.floor(Math.random() * values.length)];
  }
  return {
    stage,
    channel: stage === 3 ? 'voice' : 'imessage',
    archetypeId: archetype.id,
    tactics: TACTICS.filter(tactic => targetedTraits.includes(TACTIC_TO_TRAIT[tactic]) && (archetype.traitLoads[TACTIC_TO_TRAIT[tactic]] ?? 0) > 0).slice(0, 2),
    slots,
    targetedTraits,
    rationale: `We chose ${archetype.label} based on your highest trait scores, ${targetedTraits.map(trait => `${trait.replaceAll('_', ' ')} (${profile[trait].toFixed(2)})`).join(' and ')}. ${archetype.realWorldNote}`,
  };
}
