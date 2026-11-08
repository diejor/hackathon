import { z } from 'zod';
import { TACTICS, PAYMENT_RAILS } from '../contracts';
const flags = z.enum(['sender_identity','url_domain','plausibility_bait','urgency_clause','authority_claim','payment_rail','reply_bait','personalization_overreach']);
const time = z.number().finite().nonnegative();
export const eventSchema = z.discriminatedUnion('game', [
 z.object({ game: z.literal('scamdle'), puzzleId: z.string().min(1), attempts: z.number().int().positive(), flagsFound: z.array(flags), flagsMissed: z.array(flags), flagsFalsePositive: z.array(flags), elapsedMs: time }),
 z.object({ game: z.literal('guesswho'), roundId: z.string(), questionsAsked: z.array(z.string()), questionsDiagnosticity: z.array(z.number().min(0).max(1)), guessedContactId: z.string(), correctContactId: z.string(), deferredToBot: z.boolean(), followedBotConsensus: z.boolean(), elapsedMs: time }),
 z.object({ game: z.literal('badscam'), targetPersonaId: z.string(), archetypeId: z.string(), tacticsChosen: z.array(z.enum(TACTICS)).max(2), paymentRail: z.enum(PAYMENT_RAILS), reachScore: z.number().min(0).max(100), elapsedMs: time })
]);
