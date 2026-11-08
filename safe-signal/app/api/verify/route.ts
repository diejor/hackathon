import { randomBytes } from 'node:crypto';
import { sessionPlayer } from '../../../src/lib/session';
import { getDb } from '../../../src/lib/db';
import { photon } from '../../../src/lib/photon';
export async function POST(request:Request){
 const player=await sessionPlayer();if(!player)return Response.json({error:'Play the games first to start a session.'},{status:401});
 if(player.optedOut)return Response.json({error:'This session replied STOP, so drills are off.'},{status:403});
 const body=await request.json().catch(()=>null);
 if(!/^\+[1-9]\d{7,14}$/.test(body?.phone??''))return Response.json({error:'Enter your number with its country code, like +15551234567.'},{status:400});
 if(process.env.ENABLE_PHOTON_TEXT!=='true'||!process.env.PHOTON_INBOUND_NUMBER)return Response.json({error:'Preview mode: phone drills are off on this server.'},{status:503});
 try{await photon();}catch{return Response.json({error:'Could not reach the messaging service. Try again in a minute.'},{status:503});}
 const code='SAFE-'+randomBytes(12).toString('hex').toUpperCase();
 getDb().prepare('INSERT OR REPLACE INTO otp_challenges(playerId,phone,code,expires) VALUES(?,?,?,?)').run(player.id,body.phone,code,Date.now()+600000);
 return Response.json({code,to:process.env.PHOTON_INBOUND_NUMBER});
}
export async function GET(){const player=await sessionPlayer();return Response.json({verified:player?.phoneVerified??false});}
