import { sessionPlayer } from '../../../src/lib/session';

import { getDb } from '../../../src/lib/db';

import { campaignView } from '../../../src/lib/campaign';

import { renderMessage } from '../../../src/lib/catalog';

import { assertSendAllowed } from '../../../src/lib/guard';

import { photon } from '../../../src/lib/photon';

export async function GET(request:Request){

 const player=await sessionPlayer();const campaign=campaignView(new URL(request.url).searchParams.get('id')??'');

 if(!player||campaign?.playerId!==player.id)return Response.json({error:'Campaign unavailable.'},{status:404});

 return Response.json({status:campaign.status,engagements:campaign.engagements});

}

export async function POST(request:Request){

 const player=await sessionPlayer();const body=await request.json().catch(()=>null);const campaign=campaignView(body?.campaignId??'');

 if(!player||campaign?.playerId!==player.id)return Response.json({error:'Campaign unavailable.'},{status:404});

 if(process.env.ENABLE_PHOTON_TEXT!=='true')return Response.json({error:'Phone training is disabled.'},{status:403});

 let space;

 try{

  assertSendAllowed(player.id,player.phone??'');

  const im=await photon();space=await im.space.create(await im.user(player.phone!));

 }catch(error){return Response.json({error:error instanceof Error?error.message:'Connection unavailable.'},{status:403});}

 const db=getDb();

 try{

  db.exec('BEGIN IMMEDIATE');

  assertSendAllowed(player.id,player.phone!);

  const changed=db.prepare("UPDATE campaigns SET status='sending' WHERE id=? AND status='preview' AND NOT EXISTS(SELECT 1 FROM tokens WHERE campaignId=? AND resolved=1)").run(campaign.id,campaign.id);

  if(!changed.changes)throw new Error('Campaign already sent or revealed.');

  db.prepare('UPDATE players SET sendCount=sendCount+1 WHERE id=?').run(player.id);

  db.exec('COMMIT');

 }catch(error){db.exec('ROLLBACK');return Response.json({error:error instanceof Error?error.message:'Send unavailable.'},{status:409});}

 try{

  assertSendAllowedForReserved();

  await space.send(renderMessage(campaign.plan,`${process.env.BASE_URL||'http://localhost:3000'}${campaign.debriefUrl}`));

  db.prepare("UPDATE campaigns SET status='sent' WHERE id=? AND status='sending'").run(campaign.id);

  return Response.json({status:'sent'});

 }catch{db.prepare("UPDATE campaigns SET status='delivery_unknown' WHERE id=? AND status='sending'").run(campaign.id);return Response.json({error:'Delivery could not be confirmed. The reserved attempt will not be retried.'},{status:502});}

 function assertSendAllowedForReserved(){

  if(process.env.SAFESIGNAL_SENDING_ENABLED!=='true')throw new Error('Sending disabled.');

  const row=db.prepare('SELECT optedOut FROM players WHERE id=?').get(player!.id) as {optedOut:number};

  if(row.optedOut)throw new Error('Opted out.');

 }

}

