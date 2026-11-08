import { ProfileVector, TRAIT_KEYS, TraitKey } from '../../src/contracts';
import { TRAIT_LABELS } from '../../src/lib/labels';

// 8-axis profile radar. 0 at the center, 1 at the edge; higher = easier for a scammer to use.
const W = 360, H = 292, CX = 180, CY = 148, R = 100;

const at = (index: number, radius: number) => {
  const angle = (index * Math.PI) / 4 - Math.PI / 2;
  return { x: CX + Math.cos(angle) * radius, y: CY + Math.sin(angle) * radius, cos: Math.cos(angle), sin: Math.sin(angle) };
};
const poly = (values: number[]) => values.map((v, i) => { const p = at(i, v * R); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' ');

export default function Radar({ profile, highlight }: { profile: ProfileVector; highlight: TraitKey[] }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full" role="img"
      aria-label={`Profile radar. ${TRAIT_KEYS.map(t => `${TRAIT_LABELS[t].name} ${Math.round(profile[t] * 100)} out of 100`).join('. ')}.`}>
      {[0.25, 0.5, 0.75, 1].map(ring => (
        <polygon key={ring} points={poly(TRAIT_KEYS.map(() => ring))} fill={ring === 1 ? '#f8fafc' : 'none'} stroke="#e2e8f0" strokeWidth={1} />
      ))}
      {TRAIT_KEYS.map((_, i) => { const p = at(i, R); return <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="#e2e8f0" strokeWidth={1} />; })}
      <polygon points={poly(TRAIT_KEYS.map(t => profile[t]))} fill="rgba(79,70,229,0.18)" stroke="#4f46e5" strokeWidth={2} strokeLinejoin="round" />
      {TRAIT_KEYS.map((t, i) => {
        const p = at(i, profile[t] * R);
        const hot = highlight.includes(t);
        return <circle key={t} cx={p.x} cy={p.y} r={hot ? 5 : 3.5} fill={hot ? '#dc2626' : '#4f46e5'} stroke="#fff" strokeWidth={1.5} />;
      })}
      {TRAIT_KEYS.map((t, i) => {
        const p = at(i, R + 16);
        const lines = TRAIT_LABELS[t].axis;
        const anchor = Math.abs(p.cos) < 0.2 ? 'middle' : p.cos > 0 ? 'start' : 'end';
        const lineH = 15;
        // Stack lines away from the chart: above the top axis, below the bottom one, centered at the sides.
        const y0 = p.sin < -0.9 ? p.y - (lines.length - 1) * lineH - 2 : p.sin > 0.9 ? p.y + 10 : p.y - ((lines.length - 1) * lineH) / 2 + 4;
        const hot = highlight.includes(t);
        return (
          <text key={t} x={p.x} y={y0} textAnchor={anchor} fontSize={13.5} fontWeight={hot ? 700 : 500} fill={hot ? '#dc2626' : '#475569'}>
            {lines.map((line, k) => <tspan key={k} x={p.x} dy={k === 0 ? 0 : lineH}>{line}</tspan>)}
          </text>
        );
      })}
    </svg>
  );
}
