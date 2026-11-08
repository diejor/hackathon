'use client';

import { useEffect, useState } from 'react';
import { AttackPlan, ProfileVector, TRAIT_KEYS } from '../../src/contracts';

interface Campaign { profile: ProfileVector; plan: AttackPlan; campaignId: string; debriefUrl: string; message: string }

export default function CampaignPage() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [phone,setPhone]=useState('');
  const [challenge,setChallenge]=useState<{code:string;to:string}|null>(null);
  const [status,setStatus]=useState('preview');
  const [outcome,setOutcome]=useState('');
  useEffect(()=>{if(!campaign)return;const timer=setInterval(()=>{void fetch(`/api/campaign?id=${campaign.campaignId}`).then(r=>r.json()).then(data=>{if(data.status)setStatus(data.status);if(data.engagements?.length)setOutcome(data.engagements.at(-1).outcome);}).catch(()=>{});},3000);return()=>clearInterval(timer);},[campaign]);
  async function verify(){try{const r=await fetch('/api/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone})});const data=await r.json();if(!r.ok)throw new Error(data.error);setChallenge(data);}catch(e){setError(e instanceof Error?e.message:'Verification unavailable.');}}
  async function send(){if(!campaign)return;setBusy(true);try{const r=await fetch('/api/campaign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({campaignId:campaign.campaignId})});const data=await r.json();if(!r.ok)throw new Error(data.error);setStatus(data.status);}catch(e){setError(e instanceof Error?e.message:'Send failed.');}finally{setBusy(false);}}
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setCampaign(result);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not build campaign.'); }
    finally { setBusy(false); }
  }
  const point = (index: number, value: number) => {
    const angle = index * Math.PI / 4 - Math.PI / 2;
    return `${160 + Math.cos(angle) * value * 120},${160 + Math.sin(angle) * value * 120}`;
  };
  return <main className="mx-auto max-w-3xl space-y-6 px-6 py-16">
    <h1 className="text-3xl font-semibold">Your campaign</h1>
    <button onClick={() => void load()} disabled={busy} className="rounded bg-tmo-magenta px-6 py-3">{busy ? 'Building…' : 'Build my preview'}</button>
    {error && <p role="alert">{error}</p>}
    {campaign && <>
      <svg viewBox="0 0 320 320" className="mx-auto w-full max-w-sm" role="img" aria-label="Profile radar chart, from zero at the center to one at the outer edge">
        {[0.25, 0.5, 0.75, 1].map(value => <polygon key={value} points={TRAIT_KEYS.map((_, index) => point(index, value)).join(' ')} fill="none" stroke="#555" />)}
        <polygon points={TRAIT_KEYS.map((trait, index) => point(index, campaign.profile[trait])).join(' ')} fill="#e2007444" stroke="#e20074" />
      </svg>
      <ul>{TRAIT_KEYS.map(trait => <li key={trait}>{trait.replaceAll('_', ' ')} â€” {campaign.profile[trait].toFixed(2)}</li>)}</ul>
      <h2 className="text-xl">{campaign.plan.archetypeId}</h2>
      <p>Tactics â€” {campaign.plan.tactics.join(', ')}</p>
      <p>Targeted traits â€” {campaign.plan.targetedTraits.join(', ')}</p>
      <p>{campaign.plan.rationale}</p>
      <blockquote className="rounded-xl bg-neutral-800 p-6">{campaign.message}</blockquote>
      <p role="status">{status === 'sent' ? 'Message sent to your phone' : `Campaign status — ${status}`}</p>
      {outcome && <p>Outcome — {outcome}</p>}
      <label className="block">Your phone number <input className="bg-neutral-800 p-2" placeholder="+1…" value={phone} onChange={e=>setPhone(e.target.value)}/></label>
      <button className="underline" onClick={()=>void verify()}>Verify my phone</button>
      {challenge&&<p>From your phone, text {challenge.code} to {challenge.to} within 10 minutes. Then send your simulation.</p>}
      <button className="block rounded bg-tmo-magenta px-6 py-3" disabled={busy||status!=='preview'} onClick={()=>void send()}>Send to my verified phone</button>
      <p>Reply REPORT to report the simulation. Reply STOP to opt out.</p>
      <a className="underline" href={campaign.debriefUrl}>Full debrief</a>
    </>}
  </main>;
}
