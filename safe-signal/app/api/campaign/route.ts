import { sessionPlayer } from '../../../src/lib/session';

import { getDb } from '../../../src/lib/db';

import { campaignView } from '../../../src/lib/campaign';

import { renderMessage } from '../../../src/lib/catalog';

import { assertSendAllowed, SendNotAllowedError } from '../../../src/lib/guard';

// Player-facing wording for guard refusals (the guard's own messages name internal ids).

const REFUSAL:Record<string,string>={kill_switch:'Phone drills are off on this server.',unknown_player:'Your session has expired. Play the games again to start a new one.',opted_out:'This phone replied STOP, so drills are off for it.',not_verified:'Verify your phone first.',phone_mismatch:'That is not the phone you verified. Verify it again.',invalid_phone:'That phone number is not valid.',engaged:'You already opened a debrief, so drills are finished for this session.',invalid_limit:'Sending is misconfigured on this server.',rate_limited:'You have used all your drill sends for this session.'};

const refusal=(error:unknown)=>error instanceof SendNotAllowedError?(REFUSAL[error.code]??'Sending is not allowed right now.'):'Could not reach the messaging service. Try again in a minute.';

import { photon } from '../../../src/lib/photon';

export async function GET(request:Request){

 const player=await sessionPlayer();const campaign=campaignView(new URL(request.url).searchParams.get('id')??'');

 if(!player||campaign?.playerId!==player.id)return Response.json({error:'This drill is no longer available. Build your profile again.'},{status:404});

 return Response.json({status:campaign.status,engagements:campaign.engagements});

}

export async function POST(request:Request){

 const player=await sessionPlayer();const body=await request.json().catch(()=>null);const campaign=campaignView(body?.campaignId??'');

 if(!player||campaign?.playerId!==player.id)return Response.json({error:'This drill is no longer available. Build your profile again.'},{status:404});

 if(process.env.ENABLE_PHOTON_TEXT!=='true')return Response.json({error:'Phone drills are off on this server.'},{status:403});

 let space;

 try{

  assertSendAllowed(player.id,player.phone??'');

  const im=await photon();space=await im.space.create(await im.user(player.phone!));

 }catch(error){return Response.json({error:refusal(error)},{status:403});}

 const db=getDb();

 try{

  db.exec('BEGIN IMMEDIATE');

  assertSendAllowed(player.id,player.phone!);

  const changed=db.prepare("UPDATE campaigns SET status='sending' WHERE id=? AND status='preview' AND NOT EXISTS(SELECT 1 FROM tokens WHERE campaignId=? AND resolved=1)").run(campaign.id,campaign.id);

  if(!changed.changes)throw new Error('This drill was already sent or its debrief was opened. Build a new one to try again.');

  db.prepare('UPDATE players SET sendCount=sendCount+1 WHERE id=?').run(player.id);

  db.exec('COMMIT');

 }catch(error){db.exec('ROLLBACK');return Response.json({error:error instanceof SendNotAllowedError?refusal(error):error instanceof Error?error.message:'Sending is not available right now.'},{status:409});}

 try{

  assertSendAllowedForReserved();

  await space.send(renderMessage(campaign.plan,`${process.env.BASE_URL||'http://localhost:3000'}${campaign.debriefUrl}`));

  db.prepare("UPDATE campaigns SET status='sent' WHERE id=? AND status='sending'").run(campaign.id);

  return Response.json({status:'sent'});

 }catch{db.prepare("UPDATE campaigns SET status='delivery_unknown' WHERE id=? AND status='sending'").run(campaign.id);return Response.json({error:'We could not confirm the text was delivered. To be safe it will not be resent automatically.'},{status:502});}

 function assertSendAllowedForReserved(){

  if(process.env.SAFESIGNAL_SENDING_ENABLED!=='true')throw new Error('Sending disabled.');

  const row=db.prepare('SELECT optedOut FROM players WHERE id=?').get(player!.id) as {optedOut:number};

  if(row.optedOut)throw new Error('Opted out.');

 }

}

