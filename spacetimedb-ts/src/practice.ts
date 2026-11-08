// Practice texts (Krishna's drill idea, adapted from his templates.js): a linked player asks for one, and
// SafeSense texts their phone one realistic fake scam a minute or two later. They reply REPORT if they think
// it's a scam; the reply is graded and they get a short debrief, and the result counts as game activity
// ("practice-text", answer_correct / answer_wrong with the template's tactic).
//
// Safety rules (docs/KRISHNA-PUSH-ANALYSIS.md §3):
//  - Templates only: the module renders every text from PRACTICE_TEMPLATES with slot values from fixed
//    allow-lists. No AI on the send path, so a model can't put anything into a text.
//  - Fictional brands, look-alike `.example` addresses shown as plain text (they never resolve), 555-01xx
//    numbers, at most MaxPracticeChars, and every text ends with PracticeFooter. No real links.
//  - Never asks anyone to read out or send a real code (his code_relay template is left out on purpose).
//  - Proactive sends: need PHOTON_SENDING_ENABLED = "true", a linked iMessage phone (channel_reach), no
//    opt-out and room under the daily cap (photon-guards.ts proactiveTarget). Limits: 1 a day, 3 in total.
//  - practice_send / practice_job are private; UNLINK and FORGET ME delete them.
//
// Flow: request_practice_text (web) or the text command PRACTICE -> queuePractice() -> practice_job fires
// 60-120 s later -> practiceRunJob (photon.ts) sends it -> the next inbound text from that phone within 2 h
// is graded by gradePractice() before the normal bot turn.
import { t, SenderError } from 'spacetimedb/server';
import { ScheduleAt, type Identity, type Timestamp } from 'spacetimedb';
import spacetimedb, { tables, viewRow, type Ctx, type Db, type PracticeSend } from './schema';
import { killSwitchBlock, proactiveTarget } from './photon-guards';

export const PracticeGame = 'practice-text';
export const PracticeFooter = " (SafeSense practice — reply REPORT if you think it's a scam)";
export const MaxPracticeChars = 320;
export const MaxPracticePerDay = 1;
export const MaxPracticeTotal = 3;
const PracticeDayMicros = 24n * 3_600_000_000n; // "1 a day": rolling 24 h
const PracticeAnswerMicros = 2n * 3_600_000_000n; // a reply counts within 2 h of the request
const MinDelaySeconds = 60;
const MaxDelaySeconds = 120;

type Rng = Ctx['random'];
type SlotSpec = readonly string[] | 'digits4';

export type PracticeTemplate = {
  id: string;
  /** Tactic slug, as the games log it (safesense/src/content/scamOrNot.ts). */
  tactic: string;
  slots: Record<string, SlotSpec>;
  render: (s: Record<string, string>) => string;
  /** 2-3 red flags, in plain words, for the debrief. */
  tells: string[];
  /** One line: what to do instead. */
  lesson: string;
};

const domainFor: Record<string, string> = {
  Parcelo: 'parcelo-redelivery.example',
  SwiftShip: 'swiftship-reschedule.example',
  TollPay: 'tollpay-balance.example',
  'Lakeshore Tollway': 'lakeshore-toll-pay.example',
  GlacierBank: 'glacierbank-verify.example',
  'Meridian Trust': 'meridiantrust-secure.example',
};

export const PRACTICE_TEMPLATES: PracticeTemplate[] = [
  {
    id: 'parcel-fee',
    tactic: 'fake-delivery',
    slots: {
      brand: ['Parcelo', 'SwiftShip'],
      parcel: 'digits4',
      amount: ['$1.99', '$2.49', '$2.99', '$3.50'],
      deadline: ['today', 'by midnight', 'within 24 hours'],
    },
    render: s =>
      `${s.brand}: Your parcel #${s.parcel} is on hold because of an unpaid redelivery fee of ${s.amount}. ` +
      `Pay ${s.deadline} at ${domainFor[s.brand]} or it will be returned to the sender.`,
    tells: [
      'A delivery company asking for a small fee by text',
      'A deadline to rush you',
      "A web address that isn't the company's own site",
    ],
    lesson: "Check a delivery in the shipper's own app or website, never through a link in a text.",
  },
  {
    id: 'toll-balance',
    tactic: 'toll-unpaid',
    slots: {
      agency: ['TollPay', 'Lakeshore Tollway'],
      amount: ['$4.15', '$6.80', '$11.25'],
      fee: ['$25', '$40', '$50'],
    },
    render: s =>
      `${s.agency}: Our records show an unpaid toll of ${s.amount} on your vehicle. Pay by tonight at ` +
      `${domainFor[s.agency]} to avoid a ${s.fee} late fee and a hold on your license.`,
    tells: ["A toll bill you weren't expecting", 'A threat (late fee, license hold) to rush you', "A pay link that isn't your toll account"],
    lesson: 'Check a toll balance by signing in to your toll account yourself, not from a text.',
  },
  {
    id: 'bank-blocked-charge',
    tactic: 'bank-impersonation',
    slots: {
      bank: ['GlacierBank', 'Meridian Trust'],
      amount: ['$389.00', '$742.18', '$1,250.00'],
      merchant: ['an electronics store', 'a gas station in Ohio', 'a jewelry store'],
    },
    render: s =>
      `${s.bank} Alert: We stopped a ${s.amount} charge at ${s.merchant}. If this wasn't you, verify your ` +
      `account within 30 minutes at ${domainFor[s.bank]} to keep your card active.`,
    tells: ['A "bank" text with a link to sign in', 'A short deadline (30 minutes)', "A web address that isn't your bank's"],
    lesson: "Call the number on the back of your card, or open your bank's own app, to check.",
  },
  {
    id: 'account-locked',
    tactic: 'account-locked-otp',
    slots: {
      brand: ['StreamNest', 'GlacierBank', 'BrightLine Mobile'],
      tries: ['3', '5'],
    },
    render: s =>
      `${s.brand} Security: Your account was locked after ${s.tries} failed sign-in attempts. ` +
      `Reply YES and we'll text you a code to unlock it.`,
    tells: ['A scare about your account, out of the blue', 'Unlocking an account by replying to a text', "A code offered that you didn't ask for"],
    lesson: 'A code is only for the screen where you started. Never share one, even with "support".',
  },
  {
    id: 'carrier-rewards',
    tactic: 'carrier-impersonation',
    slots: {
      points: ['4,820', '7,320', '11,200'],
      deadline: ['tonight', 'by 9 PM today', 'in 2 hours'],
    },
    render: s =>
      `BrightLine Mobile: Your ${s.points} reward points expire ${s.deadline}! Redeem them for a free gift card ` +
      `at brightline-mobile.com.redeem.example before they're gone.`,
    tells: [
      'Points "expiring" to rush you',
      'Read the address from the right: it ends in redeem.example, not BrightLine\'s site',
      'A free gift that needs you to sign in',
    ],
    lesson: "Read a web address from the right, and check rewards in your carrier's own app.",
  },
  {
    id: 'prize-shipping',
    tactic: 'prize-giveaway',
    slots: {
      brand: ['SwiftShip', 'BrightNet', 'Parcelo'],
      prize: ['tablet', 'robot vacuum', 'pair of wireless earbuds'],
      fee: ['$4.95', '$6.99', '$9.99'],
      deadline: ['tonight', 'midnight', '6 PM'],
    },
    render: s =>
      `${s.brand} Rewards: Congrats, you were picked for a free ${s.prize}! Just cover ${s.fee} shipping. ` +
      `Reply YES to claim it by ${s.deadline} or it goes to the next winner.`,
    tells: ['A prize you never entered for', 'A fee to get something "free"', "A deadline so you don't stop to think"],
    lesson: "If you have to pay to get a prize, it isn't a prize.",
  },
  {
    id: 'renewal-callback',
    tactic: 'tech-support',
    slots: {
      brand: ['BrightNet', 'SwiftShip'],
      amount: ['$249.00', '$319.49', '$489.99'],
      phone: ['1-888-555-0127', '1-855-555-0188'],
    },
    render: s =>
      `${s.brand} billing: Your yearly plan renewed today for ${s.amount}. If you didn't authorize this, ` +
      `call ${s.phone} within 24 hours to cancel and get a full refund.`,
    tells: [
      'A surprise charge to worry you',
      'A phone number printed in the message: it belongs to whoever wrote it',
      'A refund that starts with a phone call',
    ],
    lesson: 'Check charges in your own bank or card app, and only call numbers you look up yourself.',
  },
  {
    id: 'new-number-family',
    tactic: 'family-emergency',
    slots: {
      who: ['Mom', 'Dad'],
      reason: ['my rent', 'a car repair', 'my phone bill'],
      amount: ['$200', '$350', '$480'],
    },
    render: s =>
      `Hi ${s.who}, it's me. I dropped my phone, so this is my new number for now. Can you help me with ` +
      `${s.reason}? I need ${s.amount} today and I'll pay you back this weekend. Please don't call, the old phone is broken.`,
    tells: ['A "family member" on a new number', 'Money needed today', 'An excuse not to call them on their usual number'],
    lesson: 'Call them on the number you already have before you send anything.',
  },
];

export const templateById = (id: string) => PRACTICE_TEMPLATES.find(tp => tp.id === id) ?? null;

/** Slot values from the template's allow-lists only, picked with the module's deterministic RNG. */
export function fillSlots(tp: PracticeTemplate, rng: Rng): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, spec] of Object.entries(tp.slots))
    out[k] = spec === 'digits4' ? String(rng.integerInRange(1000, 9999)) : spec[rng.integerInRange(0, spec.length - 1)];
  return out;
}

/** The final text: body + footer, at most MaxPracticeChars (the body is cut, never the footer). */
export function renderPractice(tp: PracticeTemplate, slots: Record<string, string>): string {
  const body = tp.render(slots);
  const room = MaxPracticeChars - PracticeFooter.length;
  return (body.length <= room ? body : body.slice(0, room - 1) + '…') + PracticeFooter;
}

// ---------- Choosing a template (no AI) ----------

const TacticAliases: Record<string, string> = { prize: 'prize-giveaway' };

function tacticOf(details: string): string {
  try {
    const v: unknown = JSON.parse(details);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const x = (v as Record<string, unknown>).tactic;
      if (typeof x === 'string') return TacticAliases[x.trim()] ?? x.trim();
    }
  } catch {
    /* not JSON */
  }
  return '';
}

/**
 * The player's most-missed tactic (answer_wrong rows with a tactic, "legit" excluded) that has a template
 * they haven't had yet; else any template they haven't had; else any template.
 */
export function chooseTemplate(db: Db, owner: Identity, rng: Rng): PracticeTemplate {
  const had = new Set([...db.practiceSend.owner.filter(owner)].filter(r => r.status !== 'failed').map(r => r.templateId));
  const misses = new Map<string, number>();
  for (const e of db.activityEvent.owner.filter(owner)) {
    if (e.kind !== 'answer_wrong') continue;
    const tac = tacticOf(e.details);
    if (tac.length === 0 || tac === 'legit' || tac === 'none') continue;
    misses.set(tac, (misses.get(tac) ?? 0) + 1);
  }
  const fresh = PRACTICE_TEMPLATES.filter(tp => !had.has(tp.id));
  for (const [tac] of [...misses.entries()].sort((a, b) => b[1] - a[1])) {
    const c = fresh.filter(tp => tp.tactic === tac);
    if (c.length > 0) return c[rng.integerInRange(0, c.length - 1)];
  }
  const pool = fresh.length > 0 ? fresh : PRACTICE_TEMPLATES;
  return pool[rng.integerInRange(0, pool.length - 1)];
}

// ---------- Requesting one ----------

export const PracticeOff = 'Practice texts are switched off right now. Please try again later.';
export const PracticeNotLinked =
  'Link your phone first: select Link my phone, then text the code to SafeSense. After that you can ask for a practice text.';
export const PracticeOptedOut = "You texted STOP, so SafeSense won't text you. Text START to SafeSense first.";
export const PracticeBusyToday = 'SafeSense has sent your phone a lot of messages today. Please try again tomorrow.';
export const PracticeDailyLimit = "You've had today's practice text. You can ask for another one tomorrow.";
export const PracticeTotalLimit = `You've had all ${MaxPracticeTotal} practice texts. You can keep practicing with Scam or Not?.`;
export const PracticeQueuedReply = 'Got it. A practice text is on its way in a minute or two. Treat it like any other text.';

/** Mark the owner's practice texts that went unanswered for 2 h as expired. */
function expireStale(db: Db, rows: PracticeSend[], now: Timestamp) {
  for (const r of rows)
    if (r.status === 'pending' && now.microsSinceUnixEpoch - r.createdAt.microsSinceUnixEpoch > PracticeAnswerMicros)
      db.practiceSend.id.update({ ...r, status: 'expired' });
}

/** Queue one practice text for `owner`'s linked phone. null = queued; else a calm reason why not. */
export function queuePractice(ctx: Ctx, owner: Identity): string | null {
  const { db, timestamp: now } = ctx;
  if (killSwitchBlock(ctx.env, 'proactive')) return PracticeOff;
  const target = proactiveTarget(db, ctx.env, owner, now);
  if (typeof target === 'string')
    return target === 'opted out' ? PracticeOptedOut : target === 'daily cap reached' ? PracticeBusyToday : target === 'no linked phone' ? PracticeNotLinked : PracticeOff;

  const rows = [...db.practiceSend.owner.filter(owner)];
  expireStale(db, rows, now);
  const counted = rows.filter(r => r.status !== 'failed'); // a text that never went out doesn't count
  if (counted.length >= MaxPracticeTotal) return PracticeTotalLimit;
  const today = counted.filter(r => now.microsSinceUnixEpoch - r.createdAt.microsSinceUnixEpoch < PracticeDayMicros);
  if (today.length >= MaxPracticePerDay) return PracticeDailyLimit;

  const tp = chooseTemplate(db, owner, ctx.random);
  const text = renderPractice(tp, fillSlots(tp, ctx.random));
  const row = db.practiceSend.insert({
    id: 0n,
    owner,
    senderKey: target.senderKey,
    templateId: tp.id,
    tactic: tp.tactic,
    createdAt: now,
    status: 'queued',
  });
  const delay = BigInt(ctx.random.integerInRange(MinDelaySeconds, MaxDelaySeconds)) * 1_000_000n;
  db.practiceJob.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(now.microsSinceUnixEpoch + delay),
    practiceId: row.id,
    owner,
    text,
  });
  console.log(`Practice: queued #${row.id} (${tp.id}) in ${delay / 1_000_000n} s`);
  return null;
}

// The caller's own practice texts (status only; the web card shows what's left and how the last one went).
export const myPracticeTexts = spacetimedb.view(
  { name: 'my_practice_texts', public: true },
  t.array(viewRow(tables.practiceSend.rowType)),
  ctx => [...ctx.db.practiceSend.owner.filter(ctx.sender)]
);

// Web: "Send me a practice text". The caller must have linked their iMessage (LINK <code>).
export const requestPracticeText = spacetimedb.reducer(ctx => {
  const why = queuePractice(ctx, ctx.sender);
  if (why) throw new SenderError(why);
});

// ---------- Grading the reply ----------

const CaughtWords = new Set(['REPORT', 'SCAM', 'SPAM', 'FAKE', 'PHISHING']);
const FooledWords = new Set(['YES', 'Y', 'OK', 'OKAY', 'PAY', 'CONFIRM']);
// "I'll pay", "paid", "here's my card", "sent the money", ... (said to the scammer)
const PaymentIntent =
  /\b(i('ll| will)? pay|i paid|just paid|paying now|here('s| is) my card|my card (number|is)|sent (it|the money|you the money))\b/i;

export type PracticeGrade = { grade: 'caught' | 'fooled'; sentDigits: boolean } | null;

/** REPORT / scam / spam / fake / phishing -> caught; YES, OK, PAY, CONFIRM, a code, card digits, "I'll pay" -> fooled. */
export function gradeReply(text: string): PracticeGrade {
  const word = text.trim().replace(/[.!?]+$/, '').trim().toUpperCase();
  if (CaughtWords.has(word)) return { grade: 'caught', sentDigits: false };
  if (FooledWords.has(word)) return { grade: 'fooled', sentDigits: false };
  const digits = word.replace(/[\s-]/g, '');
  if (/^\d{4,8}$/.test(digits) || /^\d{13,19}$/.test(digits)) return { grade: 'fooled', sentDigits: true };
  if (PaymentIntent.test(text)) return { grade: 'fooled', sentDigits: false };
  return null;
}

export function debrief(tp: PracticeTemplate | null, g: NonNullable<PracticeGrade>): string {
  const tells = (tp?.tells ?? ['It wanted you to act fast', 'It came out of the blue']).map(x => `• ${x}`).join('\n');
  const lesson = tp?.lesson ?? 'Pause, and check another way before you reply, pay or click.';
  if (g.grade === 'caught') return `Nice catch! That was a SafeSense practice text. What gave it away:\n${tells}\nTip: ${lesson}`;
  return (
    `That was a SafeSense practice text — no harm done. Here's what to watch for:\n${tells}\nNext time: ${lesson}` +
    (g.sentDigits ? "\n(I didn't keep the numbers you sent. Never text a code or card number to anyone.)" : '')
  );
}

/**
 * Before the normal bot turn: if this phone has a practice text from the last 2 h waiting for an answer and
 * the reply is a clear REPORT / YES-style answer, grade it, log the activity and return the debrief.
 * null = not a practice answer (the practice stays pending and the bot answers as usual). The reply itself
 * is never stored.
 */
export function gradePractice(db: Db, senderKey: string, now: Timestamp, text: string): string | null {
  const rows = [...db.practiceSend.senderKey.filter(senderKey)];
  expireStale(db, rows, now);
  const open = rows
    .filter(r => r.status === 'pending' && now.microsSinceUnixEpoch - r.createdAt.microsSinceUnixEpoch <= PracticeAnswerMicros)
    .sort((a, b) => (a.createdAt.microsSinceUnixEpoch < b.createdAt.microsSinceUnixEpoch ? 1 : -1))[0];
  if (!open) return null;
  const g = gradeReply(text);
  if (!g) return null;
  db.practiceSend.id.update({ ...open, status: g.grade });
  db.activityEvent.insert({
    id: 0n,
    owner: open.owner,
    game: PracticeGame,
    kind: g.grade === 'caught' ? 'answer_correct' : 'answer_wrong',
    details: JSON.stringify({ template: open.templateId, tactic: open.tactic }),
    createdAt: now,
  });
  console.log(`Practice: #${open.id} graded ${g.grade}`);
  return debrief(templateById(open.templateId), g);
}

// ---------- Cleanup (UNLINK, FORGET ME) ----------

function dropJobsOf(db: Db, practiceId: bigint) {
  for (const j of [...db.practiceJob.practiceId.filter(practiceId)]) db.practiceJob.scheduledId.delete(j.scheduledId);
}

export function dropPracticeOfOwner(db: Db, owner: Identity) {
  for (const r of [...db.practiceSend.owner.filter(owner)]) db.practiceSend.id.delete(r.id);
  for (const j of [...db.practiceJob.owner.filter(owner)]) db.practiceJob.scheduledId.delete(j.scheduledId);
}

export function dropPracticeOfSender(db: Db, senderKey: string) {
  for (const r of [...db.practiceSend.senderKey.filter(senderKey)]) {
    dropJobsOf(db, r.id);
    db.practiceSend.id.delete(r.id);
  }
}
