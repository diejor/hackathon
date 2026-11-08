import { beforeAll, expect, test } from 'vitest';
import { createPlayer, verifyPhone, incrementSendCount, optOutPlayer } from './db';
import { assertSendAllowed } from './guard';
import { library, renderMessage } from './catalog';
import { buildProfile, selectAttackPlan } from './profiler';
process.env.SAFESIGNAL_DB_PATH=':memory:';
beforeAll(()=>{process.env.MAX_SENDS_PER_PLAYER='3';});
test('send guards enforce dynamic kill switch, verified self, caps and STOP',()=>{
 const p=createPlayer('Synthetic','+15555550123');
 process.env.SAFESIGNAL_SENDING_ENABLED='false';expect(()=>assertSendAllowed(p.id,p.phone!)).toThrow();
 process.env.SAFESIGNAL_SENDING_ENABLED='true';expect(()=>assertSendAllowed(p.id,p.phone!)).toThrow();
 verifyPhone(p.id,p.phone!);expect(()=>assertSendAllowed(p.id,'+15555550124')).toThrow();
 expect(()=>assertSendAllowed(p.id,p.phone!)).not.toThrow();
 for(let i=0;i<3;i++)incrementSendCount(p.id);
 expect(()=>assertSendAllowed(p.id,p.phone!)).toThrow();
 const stopped=createPlayer('Synthetic','+15555550124');verifyPhone(stopped.id,stopped.phone!);optOutPlayer(stopped.id);expect(()=>assertSendAllowed(stopped.id,stopped.phone!)).toThrow();
});
test('plans render only allowlisted slots and never rationale',()=>{
 const plan=selectAttackPlan(buildProfile([]),library,1);plan.rationale='NEVER SEND THIS';
 const message=renderMessage(plan,'http://localhost:3000/t/'+'a'.repeat(32));
 expect(message).not.toContain(plan.rationale);expect(message).not.toContain('{{');
 const key=Object.keys(plan.slots)[0];plan.slots[key]='arbitrary injected text';
 expect(()=>renderMessage(plan,'http://localhost:3000/t/'+'a'.repeat(32))).toThrow();
});
