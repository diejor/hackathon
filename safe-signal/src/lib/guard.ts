import { getDb } from './db';
import {
  getPlayer,
  incrementSendCount,
  optOutPlayer as dbOptOutPlayer,
} from './db';

// Hard requirements #1 verified self, #2 kill switch, #3 rate limit (AGENTS.md)

export class SendNotAllowedError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'SendNotAllowedError';
  }
}

export function assertSendAllowed(playerId: string, e164: string): void {
  // #2 kill switch — always evaluate first so a disabled env wins.
  if (process.env.SAFESIGNAL_SENDING_ENABLED !== 'true') {
    throw new SendNotAllowedError(
      'kill_switch',
      'SAFESIGNAL_SENDING_ENABLED is not true; all sends are disabled.',
    );
  }

  const player = getPlayer(playerId);
  if (!player) {
    throw new SendNotAllowedError('unknown_player', `Unknown playerId ${playerId}.`);
  }
  if (player.optedOut) {
    throw new SendNotAllowedError(
      'opted_out',
      `Player ${playerId} has opted out of sends.`,
    );
  }

  // #1 verified self — the OTP-verified phone must match the target exactly.
  if (!player.phoneVerified) {
    throw new SendNotAllowedError(
      'not_verified',
      `Player ${playerId} has not completed OTP verification.`,
    );
  }
  if (player.phone !== e164) {
    throw new SendNotAllowedError(
      'phone_mismatch',
      `Target ${e164} does not match the verified number for player ${playerId}.`,
    );
  }

  if (!/^\+[1-9]\d{7,14}$/.test(e164)) throw new SendNotAllowedError('invalid_phone', 'Invalid phone.');
  if (getDb().prepare("SELECT 1 FROM campaigns c JOIN engagement_events e ON e.campaignId = c.id WHERE c.playerId = ? AND e.outcome = 'engaged'").get(playerId)) throw new SendNotAllowedError('engaged', 'Debrief already revealed.');

  // #3 rate limit — session cap per player.
  if (!Number.isInteger(Number(process.env.MAX_SENDS_PER_PLAYER || '3')) || Number(process.env.MAX_SENDS_PER_PLAYER || '3') < 1) throw new SendNotAllowedError('invalid_limit', 'Invalid send limit.');
  if (player.sendCount >= (Number(process.env.MAX_SENDS_PER_PLAYER || '3'))) {
    throw new SendNotAllowedError(
      'rate_limited',
      `Player ${playerId} has reached the per-session send cap (${(Number(process.env.MAX_SENDS_PER_PLAYER || '3'))}).`,
    );
  }
}

// #6 STOP handling — immediate opt-out, no further sends ever.
const STOP_WORDS = new Set(['STOP', 'UNSUBSCRIBE', 'QUIT']);

export function isStopWord(text: string): boolean {
  if (!text) return false;
  return STOP_WORDS.has(text.trim().toUpperCase());
}

export function handleStop(playerId: string): void {
  dbOptOutPlayer(playerId);
}

// Call after a successful send to tick the rate-limit counter.
export function noteSendCompleted(playerId: string): void {
  incrementSendCount(playerId);
}
