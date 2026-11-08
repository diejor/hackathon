"use client";
// Shared building blocks for the three games: cards, buttons, progress, the phone-style message
// bubble with red/green highlights, the simulated crowd row, and the reveal shown after every round.
import type { ReactNode } from 'react';
import type { RedFlag, Tactic } from '../../contracts';
import { FLAG_INFO, TACTIC_INFO } from '../../lib/content';
import { CROWD_SIZE } from '../../lib/crowd';

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ');

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60', className)}>{children}</section>;
}

export function Button({ children, onClick, disabled, variant = 'primary', className, type = 'button' }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'fraud' | 'friend' | 'ghost'; className?: string; type?: 'button' | 'submit';
}) {
  const styles = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300',
    secondary: 'bg-white text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50 disabled:text-slate-400',
    fraud: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
    friend: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300',
    ghost: 'text-indigo-700 hover:bg-indigo-50 disabled:text-slate-400',
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={cx('min-h-12 w-full rounded-xl px-4 py-3 text-base font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed', styles, className)}>
      {children}
    </button>
  );
}

/** Pinned primary action at the bottom of the column (thumb reach on phones). */
export function ActionBar({ children }: { children: ReactNode }) {
  // The fade above the buttons is decoration: let taps fall through it to the content underneath.
  return <div className="pointer-events-none sticky bottom-0 z-10 -mx-4 mt-4 space-y-2 bg-gradient-to-t from-slate-50 via-slate-50 to-slate-50/0 px-4 pb-5 pt-6 [&>*]:pointer-events-auto">{children}</div>;
}

export function Progress({ game, round, rounds, score, scoreLabel = 'pts', revealed = false }: { game: string; round: number; rounds: number; score: number; scoreLabel?: string; revealed?: boolean }) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="font-semibold text-slate-900">{game}</span>
        <span className="text-slate-600">Round {round + 1} of {rounds} · <span className="font-semibold text-indigo-700">{score} {scoreLabel}</span></span>
      </div>
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: rounds }, (_, i) => (
          <div key={i} className={cx('h-1.5 flex-1 rounded-full', i < round + (revealed ? 1 : 0) ? 'bg-indigo-600' : i === round ? 'bg-indigo-300' : 'bg-slate-200')} />
        ))}
      </div>
    </div>
  );
}

// ── message bubble ─────────────────────────────────────────────────────────

export type Mark = RedFlag | 'green';
export interface Span { text: string; mark?: Mark; state?: 'found' | 'missed' | 'plain' }

/** Split `text` on the first occurrence of each marked substring. */
export function spansFrom(text: string, marks: [string, Mark][]): Span[] {
  const hits = marks
    .map(([t, mark]) => ({ start: text.indexOf(t), end: text.indexOf(t) + t.length, mark }))
    .filter((h) => h.start >= 0)
    .sort((a, b) => a.start - b.start);
  const out: Span[] = [];
  let at = 0;
  for (const h of hits) {
    if (h.start < at) continue;
    if (h.start > at) out.push({ text: text.slice(at, h.start) });
    out.push({ text: text.slice(h.start, h.end), mark: h.mark });
    at = h.end;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

const CHANNEL_LABEL = { sms: 'Text message', email: 'Email', dm: 'Direct message', call: 'Phone call (transcript)' } as const;

export function MessageBubble({ channel = 'sms', sender, subject, spans, highlight = false, footer }: {
  channel?: keyof typeof CHANNEL_LABEL; sender: string; subject?: string; spans: Span[]; highlight?: boolean; footer?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-300 text-sm font-bold text-white" aria-hidden>
          {channel === 'call' ? '☎' : channel === 'email' ? '@' : (sender.replace(/[^A-Za-z]/g, '')[0] ?? '#').toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{sender}</div>
          <div className="text-xs text-slate-500">{CHANNEL_LABEL[channel]}</div>
        </div>
      </div>
      <div className="px-4 py-4">
        {subject ? <div className="mb-2 text-sm font-semibold text-slate-900">{subject}</div> : null}
        <div className={cx('whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-900', channel === 'email' || channel === 'call' ? '' : 'rounded-2xl rounded-tl-md bg-slate-100 px-4 py-3')}>
          {spans.map((s, i) => <SpanView key={i} span={s} highlight={highlight} />)}
        </div>
        {footer}
      </div>
    </div>
  );
}

function SpanView({ span, highlight }: { span: Span; highlight: boolean }) {
  if (!highlight || !span.mark) return <>{span.text}</>;
  if (span.mark === 'green') return <mark className="rounded bg-emerald-100 px-0.5 text-emerald-900 underline decoration-emerald-500 decoration-2 underline-offset-2">{span.text}</mark>;
  const missed = span.state === 'missed';
  return (
    <>
      <mark className={cx('rounded px-0.5 text-red-900 underline decoration-2 underline-offset-2', missed ? 'bg-amber-100 decoration-amber-500 decoration-dashed' : 'bg-red-100 decoration-red-500')}>{span.text}</mark>
      <sup className={cx('ml-0.5 whitespace-nowrap rounded px-1 py-px text-[10px] font-bold uppercase tracking-wide', missed ? 'bg-amber-500 text-white' : 'bg-red-600 text-white')}>
        {FLAG_INFO[span.mark].label}{span.state === 'found' ? ' ✓' : missed ? ' · missed' : ''}
      </sup>
    </>
  );
}

// ── simulated crowd ────────────────────────────────────────────────────────

const AVATARS = ['AK', 'BM', 'CR', 'DL', 'EJ', 'FT'];
export function CrowdRow({ yes, yesLabel, noLabel, caption, tone = 'fraud' }: { yes: number; yesLabel: string; noLabel: string; caption: string; tone?: 'fraud' | 'indigo' }) {
  const yesColor = tone === 'fraud' ? 'bg-red-600' : 'bg-indigo-600';
  return (
    <div>
      <div className="flex items-center gap-1.5">
        {AVATARS.slice(0, CROWD_SIZE).map((a, i) => (
          <div key={a} title={i < yes ? yesLabel : noLabel}
            className={cx('grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold text-white ring-2 ring-white', i < yes ? yesColor : tone === 'fraud' ? 'bg-emerald-600' : 'bg-slate-300')}>
            {a}
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm font-medium text-slate-900">{caption}</p>
      <p className="text-xs text-slate-500">Players like you (simulated from past answers)</p>
    </div>
  );
}

// ── reveal after every round ───────────────────────────────────────────────

export interface FlagResult { flag: RedFlag; status: 'found' | 'missed' | 'false_alarm' | 'present' }

export function RoundReveal({ ok, title, detail, points, message, flags, flagsTitle, notes, notesTone = 'red', technique, lesson, crowd, extra }: {
  ok: boolean | null; title: string; detail?: string; points?: string;
  message: ReactNode; flags: FlagResult[]; flagsTitle?: string; notes?: string[]; notesTone?: 'red' | 'green';
  technique: Tactic | null; lesson: string; crowd?: ReactNode; extra?: ReactNode;
}) {
  const tone = ok === null ? 'bg-indigo-50 text-indigo-900 ring-indigo-200' : ok ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : 'bg-red-50 text-red-900 ring-red-200';
  return (
    <div className="space-y-4" data-testid="reveal">
      <div className={cx('rounded-2xl p-5 ring-1', tone)}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider opacity-70">{ok === null ? 'Result' : ok ? 'Nice catch' : 'Not quite'}</p>
            <h2 className="mt-1 text-xl font-bold leading-snug">{title}</h2>
            {detail ? <p className="mt-1 text-sm opacity-90">{detail}</p> : null}
          </div>
          {points ? <span className="shrink-0 rounded-full bg-white/80 px-3 py-1 text-sm font-bold">{points}</span> : null}
        </div>
      </div>

      {message}

      {flags.length || notes?.length ? (
        <Card>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">{flagsTitle ?? (notesTone === 'green' ? 'Why it checks out' : 'Red flags')}</h3>
          {flags.length ? (
            <ul className="mt-3 space-y-2">
              {flags.map((f) => <FlagLine key={f.flag + f.status} result={f} />)}
            </ul>
          ) : null}
          {notes?.length ? (
            <ul className={cx('space-y-1.5 text-sm text-slate-700', flags.length ? 'mt-4 border-t border-slate-100 pt-3' : 'mt-3')}>
              {notes.map((n) => (
                <li key={n} className="flex gap-2"><span className={notesTone === 'green' ? 'text-emerald-600' : 'text-red-600'} aria-hidden>{notesTone === 'green' ? '✓' : '!'}</span>{n}</li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      <Card className="space-y-3">
        {technique ? (
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Technique</h3>
            <p className="mt-1 text-base font-semibold text-slate-900">{TACTIC_INFO[technique].label}</p>
            <p className="text-sm text-slate-600">{TACTIC_INFO[technique].blurb}</p>
          </div>
        ) : null}
        <div className={technique ? 'border-t border-slate-100 pt-3' : ''}>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Lesson</h3>
          <p className="mt-1 text-base text-slate-900">{lesson}</p>
        </div>
        {crowd ? <div className="border-t border-slate-100 pt-3">{crowd}</div> : null}
      </Card>
      {extra}
    </div>
  );
}

function FlagLine({ result }: { result: FlagResult }) {
  const info = FLAG_INFO[result.flag];
  const badge = {
    found: ['You spotted it', 'bg-emerald-50 text-emerald-700'],
    missed: ['Missed', 'bg-amber-50 text-amber-700'],
    false_alarm: ['Not in this one', 'bg-slate-100 text-slate-600'],
    present: ['Red flag', 'bg-red-50 text-red-700'],
  }[result.status];
  return (
    <li className="flex items-start justify-between gap-3">
      <div>
        <p className={cx('text-sm font-semibold', result.status === 'false_alarm' ? 'text-slate-500' : 'text-slate-900')}>{info.label}</p>
        <p className="text-xs text-slate-600">{result.status === 'false_alarm' ? info.hint : info.spot}</p>
      </div>
      <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold', badge[1])}>{badge[0]}</span>
    </li>
  );
}

export function ErrorNote({ error }: { error: string }) {
  return error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null;
}
