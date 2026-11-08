import { cookies } from 'next/headers';
import { getPlayer } from './db';
export async function sessionPlayer() {
 const id = (await cookies()).get('safesignal_player')?.value;
 return id ? getPlayer(id) : null;
}
