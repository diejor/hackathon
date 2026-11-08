'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { AttackPlan, ProfileVector } from '../../src/contracts';
import { library } from '../../src/lib/catalog';
import { reportProfileToCoach } from '../../src/lib/coachProfile';
import {
  FLAG_LABELS, OUTCOME_LABELS, STATUS_LABELS, TACTIC_LABELS, TRAIT_LABELS,
  archetypeLabel, flagSegments, levelOf, topTraits,
} from '../../src/lib/labels';
import Radar from './Radar';

interface Campaign { profile: ProfileVector; plan: AttackPlan; campaignId: string; debriefUrl: string; message: string }

const post = async (url: string, body: unknown) => {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
};

export default function CampaignClient({ drillsOn }: { drillsOn: boolean }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ message: string; needsGames: boolean } | null>(null);
  const [showFlags, setShowFlags] = useState(false);

  const [phone, setPhone] = useState('');
  const [verified, setVerified] = useState(false);
  const [challenge, setChallenge] = useState<{ code: string; to: string } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const [status, setStatus] = useState('preview');
  const [outcome, setOutcome] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { ok, status: code, data } = await post('/api/profile', {});
      if (!ok) { setLoadError({ message: data.error || 'Could not build your profile.', needsGames: code === 401 || code === 409 }); return; }
      setCampaign(data);
      setStatus(data.status ?? 'preview');
      setOutcome('');
      setSendError('');
      void reportProfileToCoach(data.profile, data.plan);
    } catch {
      setLoadError({ message: 'Could not reach SafeSense. Check your connection and try again.', needsGames: false });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Is this session's phone already verified?
  useEffect(() => {
    if (!drillsOn) return;
    void fetch('/api/verify').then(r => r.json()).then(d => setVerified(!!d.verified)).catch(() => {});
  }, [drillsOn]);

  // While a code is out, watch for the inbound text that verifies the phone.
  useEffect(() => {
    if (!challenge || verified) return;
    const timer = setInterval(() => {
      void fetch('/api/verify').then(r => r.json()).then(d => { if (d.verified) setVerified(true); }).catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [challenge, verified]);

  // Campaign status (sent / reported / debrief) while this page is open.
  useEffect(() => {
    if (!campaign) return;
    const timer = setInterval(() => {
      void fetch(`/api/campaign?id=${campaign.campaignId}`).then(r => r.json()).then(data => {
        if (data.status) setStatus(data.status);
        if (data.engagements?.length) setOutcome(data.engagements.at(-1).outcome);
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [campaign]);

  async function verify() {
    setVerifying(true);
    setVerifyError('');
    try {
      const { ok, data } = await post('/api/verify', { phone: phone.trim() });
      if (!ok) throw new Error(data.error || 'Could not start verification.');
      setChallenge(data);
    } catch (e) { setVerifyError(e instanceof Error ? e.message : 'Could not start verification.'); }
    finally { setVerifying(false); }
  }

  async function send() {
    if (!campaign) return;
    setSending(true);
    setSendError('');
    try {
      const { ok, data } = await post('/api/campaign', { campaignId: campaign.campaignId });
      if (!ok) throw new Error(data.error || 'Could not send the drill.');
      setStatus(data.status);
    } catch (e) { setSendError(e instanceof Error ? e.message : 'Could not send the drill.'); }
    finally { setSending(false); }
  }

  if (loading && !campaign) {
    return (
      <main className="page" aria-busy="true">
        <div className="card animate-pulse space-y-3">
          <div className="h-4 w-1/3 rounded bg-slate-200" />
          <div className="h-7 w-3/4 rounded bg-slate-200" />
          <div className="mx-auto h-64 w-64 rounded-full bg-slate-100" />
        </div>
        <p className="text-center text-slate-600">Building your scam profile…</p>
      </main>
    );
  }

  if (loadError && !campaign) {
    return (
      <main className="page">
        <section className="card">
          <p className="eyebrow">Your scam profile</p>
          <h1 className="mt-2 text-2xl font-bold">{loadError.needsGames ? 'Play the games first' : 'Something went wrong'}</h1>
          <p className="mt-2 text-slate-600">{loadError.needsGames ? 'Your profile is built from three short training games. Finish them, about five minutes, and your profile appears here.' : loadError.message}</p>
          <div className="mt-5 space-y-3">
            {loadError.needsGames
              ? <Link href="/games" className="btn btn-primary">Start training</Link>
              : <button type="button" className="btn btn-primary" onClick={() => void load()}>Try again</button>}
            <Link href="/coach" className="btn btn-secondary">Ask the coach</Link>
          </div>
        </section>
      </main>
    );
  }

  if (!campaign) return null;

  const { profile, plan } = campaign;
  const top = topTraits(profile, 3);
  const archetype = library.find(a => a.id === plan.archetypeId);
  const scam = archetypeLabel(plan.archetypeId, archetype?.label);
  const flags = archetype?.flagsPresent ?? [];
  const segments = flagSegments(campaign.message, flags);
  const canSend = drillsOn && verified && status === 'preview' && !sending;

  return (
    <main className="page">
      <section className="pt-2">
        <p className="eyebrow">Your scam profile</p>
        <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-tight">Here is the scam that would get you</h1>
        <p className="mt-2 text-slate-600">Built from your three games. Higher on the chart means easier for a scammer to use.</p>
      </section>

      <section className="card" aria-labelledby="radar-title">
        <div className="flex items-baseline justify-between">
          <h2 id="radar-title" className="text-lg font-semibold">Your 8 traits</h2>
          <span className="text-xs font-medium text-slate-500"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-600 align-middle" />top 3 weak spots</span>
        </div>
        <div className="-mx-2 mt-2"><Radar profile={profile} highlight={top} /></div>
      </section>

      <section className="card" aria-labelledby="weak-title">
        <h2 id="weak-title" className="text-lg font-semibold">Your top 3 weak spots</h2>
        <ol className="mt-3 space-y-4">
          {top.map((trait, i) => (
            <li key={trait} className="flex gap-3">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-red-50 text-sm font-bold text-red-600">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{TRAIT_LABELS[trait].name}</h3>
                  <span className="text-xs font-semibold text-slate-500">{levelOf(profile[trait])}</span>
                </div>
                <p className="mt-0.5 text-[15px] leading-relaxed text-slate-600">{TRAIT_LABELS[trait].weakness}</p>
                <div className="mt-2 h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-red-500" style={{ width: `${Math.round(profile[trait] * 100)}%` }} /></div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="card" aria-labelledby="scam-title">
        <p className="eyebrow text-red-600">The scam that would get you</p>
        <h2 id="scam-title" className="mt-1 text-xl font-bold">{scam.headline}</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-slate-600">{scam.about}</p>

        <div className="mt-4 rounded-2xl bg-slate-100 p-3">
          <p className="mb-2 text-center text-xs font-medium text-slate-500">Text Message · Today</p>
          <div className="max-w-[92%] break-words rounded-[18px] rounded-bl-[4px] bg-slate-200 px-3.5 py-2.5 text-[15.5px] leading-snug text-slate-900">
            {segments.map((s, i) => s.flag && showFlags
              ? <mark key={i} title={FLAG_LABELS[s.flag].name} className="rounded bg-red-100 px-0.5 text-red-700 [box-decoration-break:clone]">{s.text}</mark>
              : <span key={i} className={s.flag === 'url_domain' ? 'text-indigo-700 underline' : undefined}>{s.text}</span>)}
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">Practice text. Invented brand, safe link.</p>
        </div>

        <button type="button" onClick={() => setShowFlags(v => !v)} aria-pressed={showFlags}
          className={`btn mt-3 ${showFlags ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200' : 'btn-secondary'}`}>
          {showFlags ? 'Hide the red flags' : `Show the ${flags.length} red flags`}
        </button>
        {showFlags && (
          <ul className="mt-3 space-y-3">
            {flags.map(f => (
              <li key={f}>
                <span className="chip-flag">{FLAG_LABELS[f].name}</span>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{FLAG_LABELS[f].about}</p>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-[15px] leading-relaxed text-slate-700">
          <p><span className="font-semibold text-slate-900">Why this one: </span>
            it presses on {plan.targetedTraits.map(t => TRAIT_LABELS[t].name.toLowerCase()).join(' and ')}
            {plan.tactics.length ? `, using ${plan.tactics.map(t => TACTIC_LABELS[t].name.toLowerCase()).join(' and ')}` : ''}.
          </p>
          {archetype?.realWorldNote && <p className="mt-2 text-sm text-slate-500">{archetype.realWorldNote}</p>}
        </div>
      </section>

      <section className="card" aria-labelledby="drill-title">
        <h2 id="drill-title" className="text-lg font-semibold">Practise it on your phone</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-slate-600">
          We text this exact message to your own phone as an iMessage drill. Reply REPORT to score it, or STOP to end drills.
        </p>

        {!drillsOn && (
          <p role="status" className="mt-4 rounded-xl bg-amber-50 p-4 text-[15px] leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-200">
            <span className="font-semibold">Preview mode — phone drills are off on this server.</span> Everything else works: open the debrief preview below to see what happens after the tap.
          </p>
        )}

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">1. Your phone number</span>
            <input type="tel" inputMode="tel" autoComplete="tel" placeholder="+1 555 123 4567" value={phone}
              disabled={!drillsOn || verified} onChange={e => { setPhone(e.target.value); setVerifyError(''); }}
              className="mt-1 block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100 disabled:text-slate-500" />
          </label>
          {verified
            ? <p className="chip-good">Phone verified</p>
            : <button type="button" className="btn btn-secondary" disabled={!drillsOn || verifying || !phone.trim()} onClick={() => void verify()}>
                {verifying ? 'Starting…' : challenge ? 'Get a new code' : 'Verify my phone'}
              </button>}
          {verifyError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-200"><span className="font-semibold">Verification: </span>{verifyError}</p>}
          {challenge && !verified && (
            <div className="rounded-xl bg-indigo-50 p-4 text-[15px] leading-relaxed text-indigo-900">
              From that phone, text this code to <span className="font-semibold">{challenge.to}</span> within 10 minutes:
              <p className="mt-2 select-all break-all rounded-lg bg-white p-2 text-center font-mono text-sm font-semibold">{challenge.code}</p>
              <p className="mt-2 text-sm text-indigo-700">Waiting for your text…</p>
            </div>
          )}

          <span className="block pt-1 text-sm font-medium text-slate-700">2. Send the drill</span>
          <button type="button" className="btn btn-primary" disabled={!canSend} onClick={() => void send()}>
            {sending ? 'Sending…' : 'Send to my verified phone'}
          </button>
          {drillsOn && !verified && <p className="text-sm text-slate-500">Verify your phone to unlock sending.</p>}
          {sendError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-200"><span className="font-semibold">Send: </span>{sendError}</p>}
          <p role="status" className="text-sm text-slate-600"><span className="font-medium text-slate-900">Status: </span>{STATUS_LABELS[status] ?? status}</p>
          {outcome && <p className="chip-good">{OUTCOME_LABELS[outcome] ?? outcome}</p>}
        </div>
      </section>

      <section className="space-y-3">
        <a href={`${campaign.debriefUrl}?preview=1`} className="btn btn-secondary">Preview the debrief</a>
        <Link href="/coach" className="btn btn-primary">Ask your coach about this</Link>
        <p className="px-1 text-center text-sm text-slate-500">Your coach already has your top weak spots and this scam.</p>
      </section>
    </main>
  );
}
