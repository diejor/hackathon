import { getDb, recordEngagement } from '../../../src/lib/db';
import { campaignView } from '../../../src/lib/campaign';
import { validatePlan } from '../../../src/lib/catalog';
export const runtime='nodejs';
const escape = (value:string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function GET(_request:Request, context:{params:Promise<{token:string}>}) {
 const {token}=await context.params;
 const db=getDb();
 const row=db.prepare('SELECT * FROM tokens WHERE token = ?').get(token) as {campaignId:string;resolved:number}|undefined;
 if (!row) return new Response('Debrief unavailable',{status:404});
 const campaign=campaignView(row.campaignId);
 if (!campaign) return new Response('Debrief unavailable',{status:404});
 db.exec('BEGIN IMMEDIATE');
 try {
  const changed=db.prepare("UPDATE tokens SET resolved=1,resolvedAt=datetime('now') WHERE token=? AND resolved=0").run(token);
  if (changed.changes && campaign.status === 'sent') {
   recordEngagement({campaignId:campaign.id,stage:campaign.plan.stage,channel:campaign.plan.channel,outcome:'engaged',latencyMs:Math.max(0,Date.now()-Date.parse(campaign.createdAt+'Z'))});
  }
  db.prepare("UPDATE campaigns SET status='debrief' WHERE id=?").run(campaign.id);
  db.exec('COMMIT');
 } catch(error) {db.exec('ROLLBACK');throw error;}
 const archetype=validatePlan(campaign.plan);
 return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Safe Signal debrief</title><style>body{font:18px system-ui;background:#101014;color:#eee;max-width:720px;margin:60px auto;padding:24px;line-height:1.6}h1{color:#ff73b9}</style><main><h1>This was a simulated scam</h1><h2>${escape(archetype.label)}</h2><p>${escape(campaign.plan.rationale)}</p><h2>Signals to recognize</h2><ul>${archetype.flagsPresent.map(flag=>`<li>${escape(flag.replaceAll('_',' '))}</li>`).join('')}</ul><p>Pause, independently verify the sender through a trusted channel, and report suspicious messages. Your training link ends here.</p></main></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
}
