import { expect, test } from 'vitest';
import bank from '../../../docs/content/messages.json';
import { TACTICS } from '../contracts';
import { library } from './catalog';
import {
  BADSCAM_ROUNDS, BANK_SAFE_DOMAINS, BANK_TACTIC_TO_TACTIC, FOF_ITEMS, SCAMDLE_PUZZLES, TACTIC_LINE,
  pickFofRounds, puzzleFlags, puzzleText,
} from './content';

const REAL_BRANDS = /\b(usps|fedex|ups|chase|t-mobile|tmobile|amazon|google|gmail|apple|iphone|whatsapp|facebook|instagram|linkedin|slack|zelle|costco|dyson|samsung|galaxy|microsoft|windows|geek squad|best ?buy|airbnb|cvs|wells fargo|bank of america|sunpass|e-?zpass|target|anker|airpods|venmo|paypal|cash ?app)\b/i;
const rendered = [
  ...FOF_ITEMS.flatMap((i) => [i.sender, i.subject, i.body, i.lesson, ...i.flags, ...i.clues.map((c) => c.answer)]),
  ...SCAMDLE_PUZZLES.flatMap((p) => [p.sender, puzzleText(p), p.lesson]),
  ...Object.values(TACTIC_LINE).map((t) => t.line),
  ...BADSCAM_ROUNDS.map((r) => library.find((a) => a.id === r.archetypeId)!.template + ' ' + Object.values(r.slots).join(' ')),
];

test('every bank tactic slug maps onto a Tactic', () => {
  const slugs = new Set((bank as { tactic: string }[]).map((b) => b.tactic).filter((t) => t !== 'legit'));
  expect(slugs.size).toBe(11);
  for (const s of slugs) expect(TACTICS).toContain(BANK_TACTIC_TO_TACTIC[s]);
});

test('rendered game text uses fictional brands only', () => {
  for (const text of rendered) expect(text, text).not.toMatch(REAL_BRANDS);
});

test('links only use the bank\'s non-resolving registrable domains', () => {
  const host = /\b((?:[a-z0-9-]+\.)+(?:com|net|org|info|top|xyz|icu|io|co))\b/gi;
  for (const text of rendered) for (const m of text.matchAll(host)) {
    const h = m[1].toLowerCase();
    expect(BANK_SAFE_DOMAINS.some((d) => h === d || h.endsWith('.' + d)), h).toBe(true);
  }
});

test('Friend or Fraud items are annotated consistently', () => {
  expect(FOF_ITEMS.filter((i) => i.isFraud).length).toBeGreaterThanOrEqual(16);
  expect(FOF_ITEMS.filter((i) => !i.isFraud).length).toBeGreaterThanOrEqual(8);
  for (const i of FOF_ITEMS) {
    expect(i.isFraud ? i.redFlags.length > 0 && !!i.tactic : i.redFlags.length === 0 && i.tactic === null, i.id).toBe(true);
    for (const [text] of i.marks) expect(i.body, `${i.id}: ${text}`).toContain(text);
    expect(i.clues.length).toBe(i.flags.length);
    expect(new Set(i.clues.map((c) => c.id)).size, i.id).toBe(i.clues.length);
  }
});

test('a Friend or Fraud set is 4 fraud with distinct tactics + 2 legit, with a misleading crowd round', () => {
  for (let n = 0; n < 50; n++) {
    const { items, crowdRounds } = pickFofRounds();
    expect(items.length).toBe(6);
    const fraud = items.filter((i) => i.isFraud);
    expect(fraud.length).toBe(4);
    expect(new Set(fraud.map((i) => i.tactic)).size).toBe(4);
    expect(crowdRounds.some((r) => (items[r].crowdFraud >= 0.5) !== items[r].isFraud)).toBe(true);
  }
});

test('Scamdle puzzles and Bad Scam rounds reference valid data', () => {
  for (const p of SCAMDLE_PUZZLES) for (const f of puzzleFlags(p)) expect(p.crowdSpot[f], `${p.id}:${f}`).toBeTypeOf('number');
  for (const r of BADSCAM_ROUNDS) {
    const a = library.find((x) => x.id === r.archetypeId)!;
    for (const [k, v] of Object.entries(r.slots)) expect(a.slots[k]).toContain(v);
    expect(Object.keys(r.slots).length).toBe(Object.keys(a.slots).length);
  }
});
