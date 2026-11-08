// Game activity: the games log what each player did (log_activity), and the Help Bot uses a
// compact summary of it to coach the player on the scam patterns they keep missing.
//
// Contract for the games: log_activity(game, kind, details)
//   game, kind: slugs (a-z, 0-9, '-', '_'; 1-32 chars), e.g. "friend-or-fraud", "answer_wrong".
//   details:    short JSON text (<= 500 chars), e.g. {"item":"usps-sms","tactic":"urgency","chose":"friend"}.
//               Stored as text, never parsed here. "tactic" is what the bot counts for coaching.
// The owner is always ctx.sender and the time ctx.timestamp. activity_event is private; each client sees
// only its own rows through my_activity. forget_me (bot.ts) deletes them too.
import { t, SenderError } from 'spacetimedb/server';
import { Timestamp, type Identity } from 'spacetimedb';
import spacetimedb, { tables, viewRow, type ActivityEvent, type Db } from './schema';
import { isControl, trim } from './ai';
import { ContentEnd, ContentStart } from './bot';
import { cmpBig } from './lib';

const MaxActivityPerUser = 200;
const MaxSlugChars = 32;
const MaxDetailsChars = 500;
const MaxActivitySummaryChars = 1500;
const ActivityRecentWrong = 10;

export const myActivity = spacetimedb.view(
  { name: 'my_activity', public: true },
  t.array(viewRow(tables.activityEvent.rowType)),
  ctx => [...ctx.db.activityEvent.owner.filter(ctx.sender)]
);

export const logActivity = spacetimedb.reducer(
  { game: t.string(), kind: t.string(), details: t.string() },
  (ctx, args) => {
    const game = (args.game ?? '').trim();
    const kind = (args.kind ?? '').trim();
    const details = (args.details ?? '').trim();
    if (!isSlug(game)) throw new SenderError(`game must be a slug (a-z, 0-9, '-', '_'; 1-${MaxSlugChars} chars)`);
    if (!isSlug(kind)) throw new SenderError(`kind must be a slug (a-z, 0-9, '-', '_'; 1-${MaxSlugChars} chars)`);
    if (details.length > MaxDetailsChars) throw new SenderError(`details too long (max ${MaxDetailsChars} characters)`);
    if ([...details].some(isControl)) throw new SenderError('details must be single-line JSON text');
    insertActivity(ctx.db, ctx.sender, game, kind, details, ctx.timestamp);
    capActivity(ctx.db, ctx.sender, MaxActivityPerUser);
  }
);

// Demo data for the pitch: ~15 events for the caller, spread over the last few days, with an obvious
// weak spot (fake-delivery texts). Calling it again replaces the earlier demo events.
export const seedDemoActivity = spacetimedb.reducer(ctx => {
  const me = ctx.sender;
  for (const e of [...ctx.db.activityEvent.owner.filter(me)])
    if (e.details.includes('"demo":true')) ctx.db.activityEvent.id.delete(e.id);

  const F = 'friend-or-fraud',
    W = 'scam-wordle';
  const demo: [number, string, string, string][] = [
    [76, F, 'answer_correct', '{"item":"gift-card-boss","tactic":"urgency","chose":"fraud","answer":"fraud","demo":true}'],
    [75.9, F, 'answer_wrong', '{"item":"usps-sms","tactic":"fake-delivery","chose":"friend","answer":"fraud","demo":true}'],
    [75.8, F, 'answer_correct', '{"item":"chase-alert","tactic":"bank-impersonation","chose":"fraud","answer":"fraud","demo":true}'],
    [75.7, W, 'round_done', '{"word":"PHISH","guesses":4,"solved":true,"demo":true}'],
    [52, F, 'answer_correct', '{"item":"prize-iphone","tactic":"prize","chose":"fraud","answer":"fraud","demo":true}'],
    [51.9, F, 'answer_wrong', '{"item":"fedex-redelivery","tactic":"fake-delivery","chose":"friend","answer":"fraud","demo":true}'],
    [51.8, F, 'answer_correct', '{"item":"wrong-number-hi","tactic":"wrong-number","chose":"fraud","answer":"fraud","demo":true}'],
    [51.7, F, 'answer_wrong', '{"item":"toll-unpaid","tactic":"urgency","chose":"friend","answer":"fraud","demo":true}'],
    [51.6, W, 'round_done', '{"word":"SMISH","guesses":3,"solved":true,"demo":true}'],
    [27, F, 'answer_correct', '{"item":"pharmacy-ready","tactic":"none","chose":"friend","answer":"friend","demo":true}'],
    [26.9, F, 'answer_wrong', '{"item":"ups-customs-fee","tactic":"fake-delivery","chose":"friend","answer":"fraud","demo":true}'],
    [26.8, F, 'answer_correct', '{"item":"bofa-locked","tactic":"bank-impersonation","chose":"fraud","answer":"fraud","demo":true}'],
    [26.7, W, 'round_done', '{"word":"SPOOF","guesses":6,"solved":false,"demo":true}'],
    [3, F, 'answer_wrong', '{"item":"amazon-package-hold","tactic":"fake-delivery","chose":"friend","answer":"fraud","demo":true}'],
    [2.9, W, 'round_done', '{"word":"TOKEN","guesses":5,"solved":true,"demo":true}'],
  ];
  // Demo events are backdated, so make room first; otherwise the cap would drop them right away.
  capActivity(ctx.db, me, MaxActivityPerUser - demo.length);
  const now = ctx.timestamp.microsSinceUnixEpoch;
  for (const [hoursAgo, game, kind, details] of demo)
    insertActivity(ctx.db, me, game, kind, details, new Timestamp(now - BigInt(Math.trunc(hoursAgo * 3_600_000_000))));
});

function isSlug(s: string): boolean {
  return s.length > 0 && s.length <= MaxSlugChars && /^[a-z0-9_-]+$/.test(s);
}

function insertActivity(db: Db, owner: Identity, game: string, kind: string, details: string, at: Timestamp) {
  db.activityEvent.insert({ id: 0n, owner, game, kind, details, createdAt: at });
}

// Keep at most `max` events for the owner, dropping the oldest.
function capActivity(db: Db, owner: Identity, max: number) {
  const all = [...db.activityEvent.owner.filter(owner)];
  if (all.length <= max) return;
  all.sort((a, b) => cmpBig(a.createdAt.microsSinceUnixEpoch, b.createdAt.microsSinceUnixEpoch) || cmpBig(a.id, b.id));
  for (const old of all.slice(0, all.length - max)) db.activityEvent.id.delete(old.id);
}

// Groups in first-seen order, then sorted by size, largest first (stable, like LINQ GroupBy + OrderByDescending).
function groupByCount<T>(items: T[], key: (x: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const x of items) {
    const k = key(x);
    const g = m.get(k);
    if (g) g.push(x);
    else m.set(k, [x]);
  }
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
}

// Compact, model-facing summary (<= ~1,500 chars): counts per game/kind, most-missed tactics and the
// last wrong answers. "" when there is no activity. Details are player-supplied text: they are cleaned
// here and the whole summary is passed to the model as data (wrapUserContent).
export function activitySummary(events: ActivityEvent[], now: Timestamp): string {
  if (events.length === 0) return '';
  let sb = 'Counts: ';
  sb += groupByCount(events, e => e.game)
    .map(([game, g]) => `${game}: ` + groupByCount(g, e => e.kind).map(([kind, k]) => `${kind} ${k.length}`).join(', '))
    .join('; ');
  sb += '\n';

  const wrong = events
    .filter(e => e.kind.includes('wrong'))
    .sort((a, b) => cmpBig(b.createdAt.microsSinceUnixEpoch, a.createdAt.microsSinceUnixEpoch));
  const tactics = groupByCount(
    wrong.map(e => detailString(e.details, 'tactic')).filter(t => t.length > 0),
    t => t
  )
    .slice(0, 5)
    .map(([tac, g]) => `${tac} x${g.length}`);
  sb += 'Most-missed tactics: ' + (tactics.length > 0 ? tactics.join(', ') : '(none)') + '\n';

  sb += 'Recent wrong answers (newest first):';
  if (wrong.length === 0) sb += ' (none)';
  for (const e of wrong.slice(0, ActivityRecentWrong))
    sb += `\n- ${e.game}, ${ago(now, e.createdAt)}: ${clean(e.details.replaceAll(',"demo":true', ''), 160)}`;

  // Latest finished round per game (e.g. a game's chosen tactics or checks): not right/wrong answers.
  const byGame = new Map<string, ActivityEvent>();
  for (const e of events) {
    if (e.kind !== 'round_done') continue;
    const best = byGame.get(e.game);
    if (!best || e.createdAt.microsSinceUnixEpoch > best.createdAt.microsSinceUnixEpoch) byGame.set(e.game, e);
  }
  const rounds = [...byGame.values()].slice(0, 4);
  if (rounds.length > 0) sb += '\nLatest rounds:';
  for (const e of rounds) sb += `\n- ${e.game}, ${ago(now, e.createdAt)}: ${clean(e.details.replaceAll(',"demo":true', ''), 160)}`;

  return sb.length <= MaxActivitySummaryChars ? sb : sb.slice(0, MaxActivitySummaryChars) + '…';
}

function detailString(json: string, key: string): string {
  try {
    const v: unknown = JSON.parse(json);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const x = (v as Record<string, unknown>)[key];
      if (typeof x === 'string') return clean(x, 40);
    }
    return '';
  } catch {
    return '';
  }
}

export function clean(s: string, max: number): string {
  const t = [...s].filter(c => !isControl(c)).join('').replaceAll(ContentStart, '').replaceAll(ContentEnd, '');
  return trim(t, max);
}

function ago(now: Timestamp, at: Timestamp): string {
  const h = (now.microsSinceUnixEpoch - at.microsSinceUnixEpoch) / 3_600_000_000n;
  return h < 1n ? 'just now' : h < 24n ? `${h}h ago` : `${h / 24n}d ago`;
}
