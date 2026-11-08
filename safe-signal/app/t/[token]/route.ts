import { getDb, recordEngagement } from '../../../src/lib/db';
import { campaignView } from '../../../src/lib/campaign';
import { renderMessage, validatePlan } from '../../../src/lib/catalog';
import { sessionPlayer } from '../../../src/lib/session';
import { debriefHtml } from './debrief';
export const runtime='nodejs';
const HEADERS={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const unavailable=()=>new Response('Debrief unavailable',{status:404});
export async function GET(request:Request, context:{params:Promise<{token:string}>}) {
 const {token}=await context.params;
 const db=getDb();
 const row=db.prepare('SELECT * FROM tokens WHERE token = ?').get(token) as {campaignId:string;resolved:number}|undefined;
 if (!row) return unavailable();
 const campaign=campaignView(row.campaignId);
 if (!campaign) return unavailable();
 const page=(preview:boolean)=>{
  const archetype=validatePlan(campaign.plan);
  let message:string;
  try { message=renderMessage(campaign.plan,`${process.env.BASE_URL || 'http://localhost:3000'}/t/${token}`); }
  catch { message=archetype.label; }
  return new Response(debriefHtml({archetype,plan:campaign.plan,message,preview}),{headers:HEADERS});
 };
 // ?preview=1 from the campaign page: the campaign owner's own browser sees the debrief WITHOUT resolving
 // the token, so the drill can still be sent. Anyone else (e.g. the phone that got the text) never reaches
 // this branch without the session cookie, and gets a 404 rather than a silent non-resolving view.
 if (new URL(request.url).searchParams.get('preview')==='1') {
  const player=await sessionPlayer();
  if (!player || player.id!==campaign.playerId) return unavailable();
  return page(true);
 }
 db.exec('BEGIN IMMEDIATE');
 try {
  const changed=db.prepare("UPDATE tokens SET resolved=1,resolvedAt=datetime('now') WHERE token=? AND resolved=0").run(token);
  if (changed.changes && campaign.status === 'sent') {
   recordEngagement({campaignId:campaign.id,stage:campaign.plan.stage,channel:campaign.plan.channel,outcome:'engaged',latencyMs:Math.max(0,Date.now()-Date.parse(campaign.createdAt+'Z'))});
  }
  db.prepare("UPDATE campaigns SET status='debrief' WHERE id=?").run(campaign.id);
  db.exec('COMMIT');
 } catch(error) {db.exec('ROLLBACK');throw error;}
 return page(false);
}
