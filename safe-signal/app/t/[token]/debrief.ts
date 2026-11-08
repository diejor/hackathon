// Static debrief page for /t/<token>: plain HTML + inline CSS (no scripts, no forms, no third parties;
// AGENTS.md rule 4). Same look as the app: slate-50 page, white cards, indigo accent, red-50 red flags.
import type { Archetype, AttackPlan } from '../../../src/contracts';
import { FLAG_LABELS, TRAIT_LABELS, TACTIC_LABELS, archetypeLabel, flagSegments } from '../../../src/lib/labels';

const esc = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const CSS = `
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:#f8fafc;color:#0f172a;font:16px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}
.top{position:sticky;top:0;z-index:2;background:rgba(255,255,255,.92);border-bottom:1px solid #e2e8f0}
.top-in{max-width:448px;margin:0 auto;height:56px;padding:0 16px;display:flex;align-items:center;justify-content:space-between}
.mark{display:inline-flex;align-items:center;gap:8px;font-weight:600;font-size:17px;letter-spacing:-.01em;text-decoration:none}
.badge{font-size:12px;font-weight:600;color:#4338ca;background:#eef2ff;border-radius:999px;padding:4px 10px}
main{max-width:448px;margin:0 auto;padding:24px 16px 64px}
main>*+*{margin-top:20px}
.eyebrow{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#4f46e5;margin:0}
h1{font-size:28px;line-height:1.15;letter-spacing:-.02em;margin:8px 0 0}
h2{font-size:18px;margin:0}
.lead{color:#475569;font-size:17px;margin:10px 0 0}
.card{background:#fff;border-radius:16px;padding:20px;box-shadow:0 1px 2px rgba(15,23,42,.06);border:1px solid rgba(226,232,240,.7)}
.muted{color:#475569;margin:6px 0 0}
.note{background:#eef2ff;color:#3730a3;border-radius:16px;padding:14px 16px;font-size:15px}
.phone{margin-top:14px;background:#f1f5f9;border-radius:14px;padding:12px}
.phone-meta{font-size:12px;color:#64748b;text-align:center;margin-bottom:8px}
.bubble{background:#e5e7eb;color:#0f172a;border-radius:18px 18px 18px 4px;padding:10px 14px;font-size:15.5px;line-height:1.45;max-width:92%;word-break:break-word}
mark{background:#fee2e2;color:#b91c1c;border-radius:4px;padding:0 2px;box-decoration-break:clone;-webkit-box-decoration-break:clone}
ul.flags,ul.traits,ol.steps{list-style:none;padding:0;margin:14px 0 0}
ul.flags li,ul.traits li{padding:12px 0;border-top:1px solid #f1f5f9}
ul.flags li:first-child,ul.traits li:first-child{border-top:0;padding-top:0}
.chip{display:inline-block;font-size:14px;font-weight:600;color:#dc2626;background:#fef2f2;border:1px solid #fecaca;border-radius:999px;padding:3px 10px}
.trait{font-weight:600}
ol.steps{counter-reset:s}
ol.steps li{counter-increment:s;position:relative;padding:0 0 14px 40px}
ol.steps li:before{content:counter(s);position:absolute;left:0;top:0;width:28px;height:28px;border-radius:999px;background:#eef2ff;color:#4f46e5;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center}
.good{background:#ecfdf5;border:1px solid #a7f3d0;color:#064e3b;border-radius:16px;padding:16px 18px}
.good h2{color:#047857;font-size:15px}
.good p{margin:6px 0 0;font-size:15px}
.btn{display:flex;min-height:48px;align-items:center;justify-content:center;border-radius:12px;font-weight:600;text-decoration:none;font-size:16px}
.btn-primary{background:#4f46e5;color:#fff}
.btn-secondary{background:#fff;color:#0f172a;border:1px solid #cbd5e1;margin-top:12px}
.small{font-size:14px;color:#64748b}
`;

const SHIELD = '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M12 2.5 4 5.5v6.2c0 4.7 3.3 8.6 8 9.8 4.7-1.2 8-5.1 8-9.8V5.5l-8-3Z" fill="#4f46e5"/><path d="M8.2 12.6a5.3 5.3 0 0 1 7.6 0M9.9 14.4a2.8 2.8 0 0 1 4.2 0" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none"/><circle cx="12" cy="16.4" r="1.1" fill="#fff"/></svg>';

export function debriefHtml(opts: { archetype: Archetype; plan: AttackPlan; message: string; preview: boolean }): string {
  const { archetype, plan, message, preview } = opts;
  const scam = archetypeLabel(archetype.id, archetype.label);
  const bubble = flagSegments(message, archetype.flagsPresent)
    .map(s => (s.flag ? `<mark title="${esc(FLAG_LABELS[s.flag].name)}">${esc(s.text)}</mark>` : esc(s.text)))
    .join('');
  const flags = archetype.flagsPresent
    .map(f => `<li><span class="chip">${esc(FLAG_LABELS[f].name)}</span><p class="muted">${esc(FLAG_LABELS[f].about)}</p></li>`)
    .join('');
  const traits = plan.targetedTraits
    .map(t => `<li><span class="trait">${esc(TRAIT_LABELS[t].name)}</span><p class="muted">${esc(TRAIT_LABELS[t].weakness)}</p></li>`)
    .join('');
  const tactics = plan.tactics.map(t => TACTIC_LABELS[t].name.toLowerCase());
  const tacticLine = tactics.length ? `<p class="muted">It leaned on ${esc(tactics.join(' and '))}.</p>` : '';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Safe Signal debrief</title><style>${CSS}</style></head><body>
<header class="top"><div class="top-in"><a class="mark" href="/">${SHIELD}Safe Signal</a><span class="badge">${preview ? 'Preview' : 'Training drill'}</span></div></header>
<main>
${preview ? '<p class="note"><strong>Debrief preview.</strong> This is what you will see after tapping the link in the drill. Opening it here does not use up your drill.</p>' : ''}
<section>
<p class="eyebrow">Safe Signal debrief</p>
<h1>${preview ? 'Here is how the drill works' : 'That was a practice scam. No harm done.'}</h1>
<p class="lead">${preview ? 'The text below is built from your weak spots. Every brand in it is invented.' : 'Nothing was collected, and the link ends here. Here is what to look for next time.'}</p>
</section>
<section class="card">
<h2>What the drill was: ${esc(scam.name)}</h2>
<p class="muted">${esc(scam.about)}</p>
<div class="phone"><div class="phone-meta">Text Message</div><div class="bubble">${bubble}</div></div>
</section>
<section class="card">
<h2>The red flags it carried</h2>
<ul class="flags">${flags}</ul>
</section>
<section class="card">
<h2>Why it was aimed at you</h2>
<p class="muted">Your training games showed these weak spots, so the drill targeted them.</p>
${tacticLine}
<ul class="traits">${traits}</ul>
</section>
<section class="card">
<h2>Report it</h2>
<p class="muted">When a real one arrives, reporting takes seconds and helps carriers block it for everyone.</p>
<ol class="steps">
<li>Forward the text to <strong>7726</strong> (it spells SPAM). Your carrier uses it to block the sender.</li>
<li>In Messages, use <strong>Report Junk</strong> on the message, then delete it.</li>
<li>Lost money or shared details? Report it at <a href="https://reportfraud.ftc.gov" rel="noopener noreferrer"><strong>ReportFraud.ftc.gov</strong></a> and call your bank using the number on your card.</li>
</ol>
</section>
<section class="good">
<h2>Let Scam Shield catch the rest</h2>
<p>T-Mobile Scam Shield blocks known scam calls and texts at the network. Turn on Scam Shield in the T-Mobile app so fewer of these reach you.</p>
</section>
<section>
<a class="btn btn-primary" href="/coach">Talk to your coach</a>
<a class="btn btn-secondary" href="/campaign">Back to my profile</a>
</section>
<p class="small">Safe Signal drills use invented brands and only go to a phone you verified. Reply STOP to the drill line to end them.</p>
</main></body></html>`;
}
