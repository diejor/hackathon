import { sessionPlayer } from '../../../src/lib/session';
import { getDb, recordGameEvent } from '../../../src/lib/db';
import { eventSchema } from '../../../src/lib/events';
// One row per round, scoped to the session player. Round 0 (or a legacy event without roundIndex) starts a
// fresh run of that game, so a replay replaces the player's earlier rounds instead of piling up beside them.
export async function POST(request: Request) {
 const player = await sessionPlayer();
 if (!player) return Response.json({error:'Start a session first.'},{status:401});
 const parsed = eventSchema.safeParse(await request.json().catch(() => null));
 if (!parsed.success) return Response.json({error:'Invalid game event.'},{status:400});
 const db = getDb();
 db.exec('BEGIN IMMEDIATE');
 try {
  if (!parsed.data.roundIndex) db.prepare('DELETE FROM game_events WHERE playerId = ? AND game = ?').run(player.id, parsed.data.game);
  recordGameEvent(player.id, parsed.data);
  db.exec('COMMIT');
 } catch(error) { db.exec('ROLLBACK'); throw error; }
 return Response.json({ok:true});
}
