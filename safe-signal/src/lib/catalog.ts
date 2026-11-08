import data from '../../data/scam-archetypes.json';
import { ArchetypeLibrary, AttackPlan, TACTICS, TACTIC_TO_TRAIT, TRAIT_KEYS } from '../contracts';
export const library = data as unknown as ArchetypeLibrary;
export function validatePlan(plan: AttackPlan) {
  const archetype = library.find(item => item.id === plan.archetypeId);
  if (!archetype || ![1,2,3].includes(plan.stage) || plan.channel !== (plan.stage === 3 ? 'voice' : 'imessage')) throw new Error('Invalid attack plan.');
  if (plan.tactics.length > 2 || new Set(plan.tactics).size !== plan.tactics.length || plan.tactics.some(t => !TACTICS.includes(t) || !archetype.traitLoads[TACTIC_TO_TRAIT[t]])) throw new Error('Invalid tactics.');
  if (plan.targetedTraits.some(t => !TRAIT_KEYS.includes(t))) throw new Error('Invalid traits.');
  if (Object.keys(plan.slots).length !== Object.keys(archetype.slots).length || Object.entries(archetype.slots).some(([key, values]) => !values.includes(plan.slots[key]))) throw new Error('Invalid slots.');
  return archetype;
}
export function renderMessage(plan: AttackPlan, tokenUrl: string) {
  const archetype = validatePlan(plan);
  const url = new URL(tokenUrl);
  if (!['http:', 'https:'].includes(url.protocol) || !/^\/t\/[a-f0-9]{32}$/.test(url.pathname)) throw new Error('Invalid token URL.');
  return archetype.template.replace(/{{(\w+)}}/g, (_, key: string) => {
    if (key === 'tokenUrl') return url.href;
    if (!(key in plan.slots)) throw new Error('Missing slot.');
    return plan.slots[key];
  });
}
