// Tell the Help Bot coach about a freshly built SafeSense profile, once, so /coach can talk about
// the player's weak spots. Mirrors reportToBot in ./helpbot (log_activity, see spacetimedb/Activity.cs).
// The bot's activity summary shows only the first ~160 chars of a round's details, so keep them short.
import type { AttackPlan, ProfileVector } from '../contracts';
import { helpBot } from './helpbot';
import { TRAIT_LABELS, archetypeLabel, topTraits } from './labels';

const GAME = 'safe-signal-profile';
const KIND = 'round_done';
const SENT_KEY = 'safesignal.coachProfile.last';

/** Single-line JSON (<= 500 chars) with the top 3 weak spots and the scam picked for them. */
export function profileDetails(profile: ProfileVector, plan: AttackPlan): string {
  const weakSpots = topTraits(profile, 3).map(trait => TRAIT_LABELS[trait].name);
  const details = JSON.stringify({ weakSpots, likelyScam: archetypeLabel(plan.archetypeId).name });
  return details.length <= 500 ? details : JSON.stringify({ weakSpots }).slice(0, 500);
}

function alreadySent(details: string) {
  try { return localStorage.getItem(SENT_KEY) === details; } catch { return false; }
}
function markSent(details: string) {
  try { localStorage.setItem(SENT_KEY, details); } catch { /* storage blocked: may report again, harmless */ }
}

/** Fire-and-forget. Never throws; skips if this exact profile was already reported from this browser. */
export async function reportProfileToCoach(profile: ProfileVector, plan: AttackPlan): Promise<void> {
  const details = profileDetails(profile, plan);
  if (alreadySent(details)) return;
  try {
    const L = await helpBot();
    let sent = false;
    const send = async () => {
      const c = L.getConn();
      if (sent || !c || !L.state.connected) return sent;
      sent = true;
      await c.reducers.logActivity({ game: GAME, kind: KIND, details });
      markSent(details);
      return true;
    };
    if (await send()) return;
    const off = L.onChange(() => {
      if (L.state.connected) { off(); void send().catch(err => console.warn('[coach] profile report failed', err)); }
    });
  } catch (err) {
    console.warn('[coach] profile report failed', err);
  }
}
