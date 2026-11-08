import { getDb } from '../../../src/lib/db';
import { sessionPlayer } from '../../../src/lib/session';
import { buildCrowd, type CrowdGame } from '../../../src/lib/crowd';
import type { GameEvent } from '../../../src/contracts';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ITEM_FIELD: Record<CrowdGame, string> = { scamdle: '$.puzzleId', guesswho: '$.roundId', badscam: '$.archetypeId' };

// GET /api/crowd?game=guesswho&item=<message id> → simulated "players like you" for one round item,
// aggregated from other players' stored rounds (fallback: hand-set odds when fewer than 5 exist).
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const game = params.get('game') as CrowdGame | null;
  const item = params.get('item') ?? '';
  if (!game || !(game in ITEM_FIELD) || !/^[a-z0-9-]{1,64}$/.test(item)) return Response.json({ error: 'Unknown game or item.' }, { status: 400 });
  const me = (await sessionPlayer())?.id ?? '';
  const rows = getDb()
    .prepare(`SELECT payload FROM game_events WHERE game = ? AND json_extract(payload, '${ITEM_FIELD[game]}') = ? AND playerId IS NOT ? ORDER BY createdAt DESC LIMIT 500`)
    .all(game, item, me) as unknown as { payload: string }[];
  const crowd = buildCrowd(game, item, rows.map((r) => JSON.parse(r.payload) as GameEvent));
  if (!crowd) return Response.json({ error: 'Unknown item.' }, { status: 404 });
  return Response.json(crowd, { headers: { 'Cache-Control': 'no-store' } });
}
