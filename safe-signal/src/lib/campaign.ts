import { AttackPlan, ProfileVector } from '../contracts';
import { getDb, getEngagements } from './db';
export interface CampaignRow { id:string; playerId:string; profileVector:string; attackPlan:string; status:string; createdAt:string }
export function campaignView(id:string) {
 const row = getDb().prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as unknown as CampaignRow | undefined;
 if (!row) return null;
 const token = getDb().prepare('SELECT token FROM tokens WHERE campaignId = ?').get(id) as {token:string}|undefined;
 return { ...row, profile:JSON.parse(row.profileVector) as ProfileVector, plan:JSON.parse(row.attackPlan) as AttackPlan, engagements:getEngagements(id), debriefUrl:token ? `/t/${token.token}` : null };
}
