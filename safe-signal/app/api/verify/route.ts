import { randomBytes } from 'node:crypto';
import { sessionPlayer } from '../../../src/lib/session';
import { getDb } from '../../../src/lib/db';
import { photon } from '../../../src/lib/photon';
export async function POST(request:Request){
 const player=await sessionPlayer();if(!player)return Response.json({error:'Start a session.'},{status:401});
 if(player.optedOut)return Response.json({error:'This session opted out.'},{status:403});
 const body=await request.json().catch(()=>null);
 if(!/^\+[1-9]\d{7,14}$/.test(body?.phone??''))return Response.json({error:'Enter an E.164 phone number.'},{status:400});
 if(process.env.ENABLE_PHOTON_TEXT!=='true'||!process.env.PHOTON_INBOUND_NUMBER)return Response.json({error:'Phone training is not configured. Preview is available.'},{status:503});
 try{await photon();}catch{return Response.json({error:'Photon connection unavailable.'},{status:503});}
 const code='SAFE-'+randomBytes(12).toString('hex').toUpperCase();
 getDb().prepare('INSERT OR REPLACE INTO otp_challenges(playerId,phone,code,expires) VALUES(?,?,?,?)').run(player.id,body.phone,code,Date.now()+600000);
 return Response.json({code,to:process.env.PHOTON_INBOUND_NUMBER});
}
export async function GET(){const player=await sessionPlayer();return Response.json({verified:player?.phoneVerified??false});}
