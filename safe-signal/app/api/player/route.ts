import { cookies } from 'next/headers';
import { createPlayer } from '../../../src/lib/db';
import { sessionPlayer } from '../../../src/lib/session';
export async function POST() {
 const existing = await sessionPlayer();
 const player = existing ?? createPlayer('Player', '');
 (await cookies()).set('safesignal_player', player.id, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' });
 return Response.json({ playerId: player.id });
}
