import { AttackPlan, ArchetypeLibrary, FLAG_TO_TRAIT, GameEvent, NEUTRAL_PROFILE, ProfileVector, TACTICS, TACTIC_TO_TRAIT, TRAIT_KEYS } from '../contracts';

export function buildProfile(events: GameEvent[]): ProfileVector {
  const profile = { ...NEUTRAL_PROFILE };
  for (const event of events) {
    if (event.game === 'scamdle') {
      for (const flag of event.flagsMissed) profile[FLAG_TO_TRAIT[flag]] += 0.1;
      for (const flag of event.flagsFound) profile[FLAG_TO_TRAIT[flag]] -= 0.05;
      profile.verification_deficit += event.flagsFalsePositive.length * 0.025;
      if (event.elapsedMs < 30_000) profile.urgency_reactivity -= 0.05;
    } else if (event.game === 'guesswho') {
      const diagnosticity = event.questionsDiagnosticity;
      if (diagnosticity.length && diagnosticity.reduce((sum, value) => sum + value, 0) / diagnosticity.length < 0.5) profile.verification_deficit += 0.1;
      if (event.deferredToBot) profile.authority_deference += 0.15;
      if (event.followedBotConsensus) profile.consensus_susceptibility += 0.15;
      if (event.questionsAsked.length >= 5) profile.verification_deficit -= 0.1;
      if (event.questionsAsked.length < 3) profile.urgency_reactivity += 0.1;
    } else {
      for (const tactic of TACTICS) profile[TACTIC_TO_TRAIT[tactic]] += event.tacticsChosen.includes(tactic) ? -0.1 : 0.05;
      if (event.reachScore >= 80) for (const trait of TRAIT_KEYS) profile[trait] -= 0.05;
    }
  }
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
