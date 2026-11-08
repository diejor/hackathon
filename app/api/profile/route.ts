import { library, validatePlan, renderMessage } from '../../../src/lib/catalog';
import { createCampaign, createToken, getGameEvents, getDb } from '../../../src/lib/db';
import { buildProfile, selectAttackPlan } from '../../../src/lib/profiler';
import { sessionPlayer } from '../../../src/lib/session';
export const runtime = 'nodejs';
export async function POST() {
 const player = await sessionPlayer();
 if (!player) return Response.json({error:'Start a session first.'},{status:401});
 const events = getGameEvents(player.id);
 if (new Set(events.map(e=>e.game)).size < 3) return Response.json({error:'Complete all three games first.'},{status:409});
 const profile = buildProfile(events);
 const plan = selectAttackPlan(profile,library,1);
 validatePlan(plan);
 const db = getDb();
 db.exec('BEGIN IMMEDIATE');
 let campaignId:string, token:string;
 try {
  campaignId=createCampaign(player.id,profile,plan);
  token=createToken(campaignId);
  db.prepare("UPDATE campaigns SET status = 'preview' WHERE id = ?").run(campaignId);
  db.exec('COMMIT');
 } catch(error) { db.exec('ROLLBACK'); throw error; }
 return Response.json({profile,plan,campaignId,debriefUrl:`/t/${token}`,status:'preview',message:renderMessage(plan,`${process.env.BASE_URL || 'http://localhost:3000'}/t/${token}`)});
}
