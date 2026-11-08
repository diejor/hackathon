import { Spectrum } from 'spectrum-ts';

import { imessage } from 'spectrum-ts/providers/imessage';

import { getDb, verifyPhone, recordEngagement } from './db';

import { isStopWord } from './guard';

import { campaignView } from './campaign';

let connection: ReturnType<typeof connect> | undefined;

async function connect() {

 const projectId=process.env.SPECTRUM_PROJECT_ID, projectSecret=process.env.SPECTRUM_PROJECT_SECRET;

 if (!projectId || !projectSecret) throw new Error('Photon credentials are missing.');

 const app=await Spectrum({projectId,projectSecret,providers:[imessage.config()]});

 void (async()=>{for await(const [space,message] of app.messages){

  if(message.direction!=='inbound'||message.content.type!=='text'||!message.sender||!/^any;[-+];\+[1-9]\d{7,14}$/.test(space.id))continue;

  handleInbound(message.id,message.sender.id,message.content.text);

 }})().catch(error=>{console.error('Photon inbound stream stopped',error);connection=undefined;});

 return imessage(app);

}

export async function photon(){

 if(!connection)connection=connect().catch(error=>{connection=undefined;throw error;});

 return connection;

}

export function handleInbound(id:string,phone:string,text:string){

 if(!/^\+[1-9]\d{7,14}$/.test(phone))return;

 const db=getDb();db.exec('BEGIN IMMEDIATE');

 try{

  const inserted=db.prepare('INSERT OR IGNORE INTO inbound_ids(id) VALUES(?)').run(id);

  if(!inserted.changes){db.exec('COMMIT');return;}

  if(isStopWord(text)){

   db.prepare('UPDATE players SET optedOut=1 WHERE phone=?').run(phone);

   db.prepare('DELETE FROM otp_challenges WHERE phone=?').run(phone);

  }else{

   const challenge=db.prepare('SELECT playerId FROM otp_challenges WHERE phone=? AND code=? AND expires>?').get(phone,text.trim().toUpperCase(),Date.now()) as {playerId:string}|undefined;

   if(challenge){verifyPhone(challenge.playerId,phone);db.prepare('DELETE FROM otp_challenges WHERE playerId=?').run(challenge.playerId);}

   if(text.trim().toUpperCase()==='REPORT'){

    const row=db.prepare("SELECT c.id FROM campaigns c JOIN players p ON p.id=c.playerId WHERE p.phone=? AND c.status='sent' ORDER BY c.createdAt DESC LIMIT 1").get(phone) as {id:string}|undefined;

    const campaign=row&&campaignView(row.id);

    if(campaign){recordEngagement({campaignId:campaign.id,stage:campaign.plan.stage,channel:campaign.plan.channel,outcome:'reported',latencyMs:Math.max(0,Date.now()-Date.parse(campaign.createdAt+'Z'))});db.prepare("UPDATE campaigns SET status='reported' WHERE id=?").run(campaign.id);}

   }

  }

  db.exec('COMMIT');

 }catch(error){db.exec('ROLLBACK');throw error;}

}

