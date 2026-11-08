import { useEffect, useState } from 'react'
import { Link2, MessageSquareText, Send } from 'lucide-react'
import { BOT_IMESSAGE_ADDRESS, CHANNEL_LABELS } from '../../../../web/src/bot/config'
import type { BotSnapshot } from '../../lib/useBot'
import { helpBot } from '../../lib/stdb'

type BotModule = Awaited<ReturnType<typeof helpBot>>['bot']

// Must match spacetimedb-ts/src/practice.ts (MaxPracticeTotal, MaxPracticePerDay over a rolling 24 h).
const PRACTICE_TOTAL = 3
const DAY_MS = 24 * 3_600_000

/**
 * "Text SafeSense": the iMessage number (Photon, spacetimedb-ts/src/photon.ts) plus phone linking with a
 * one-time code (LINK <code>). Hidden while BOT_IMESSAGE_ADDRESS (web/src/bot/config.ts) is empty.
 */
export function TextSafeSense({ bot }: { bot: BotSnapshot }) {
  const number = BOT_IMESSAGE_ADDRESS.trim()
  const [mod, setMod] = useState<BotModule | null>(null)
  const [, setTick] = useState(0)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!number) return
    let off: (() => void) | undefined
    let alive = true
    helpBot()
      .then(({ bot: b }) => {
        if (!alive) return
        setMod(b)
        off = b.onChange(() => setTick((t) => t + 1))
      })
      .catch(() => {})
    return () => {
      alive = false
      off?.()
    }
  }, [number])

  const code = mod?.linkCode() ?? null
  const links = mod?.channelLinks() ?? []

  // Re-check every 15 s so an expired code disappears and the button comes back.
  useEffect(() => {
    if (!code) return
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [code])

  if (!number) return null
  const ready = bot.status === 'ready' && !!mod
  const live = code && Number(code.expiresAt.microsSinceUnixEpoch / 1000n) > now ? code : null
  const smsHref = `sms:${number.replace(/[^\d+]/g, '')}`

  const run = async (fn: () => Promise<boolean>) => {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel text-safesense" aria-labelledby="text-safesense-title">
      <MessageSquareText size={28} strokeWidth={1.4} className="icon-muted" aria-hidden="true" />
      <h2 id="text-safesense-title" className="h3">
        Text SafeSense
      </h2>
      <p>Got a text that feels off? Forward it, or send a screenshot, to SafeSense on iMessage.</p>
      <p className="text-safesense-number">
        <a href={smsHref} className="nowrap">{number}</a>
      </p>

      <div className="text-safesense-link" aria-live="polite">
        {links.length > 0 ? (
          <>
            <p>
              <strong>Linked:</strong>{' '}
              {links.map((l) => [CHANNEL_LABELS[l.platform] ?? l.platform, l.handleHint].filter(Boolean).join(' ')).join(', ')}
            </p>
            <p className="small muted">Texts and this chat share one history.</p>
            {mod && links.some((l) => l.platform === 'imessage') && <PracticeText mod={mod} ready={ready} />}
            <button
              type="button"
              className="btn btn-secondary btn-block"
              disabled={!ready || busy}
              onClick={() => mod && run(() => mod.unlinkChannels())}
            >
              Unlink
            </button>
          </>
        ) : live ? (
          <>
            <p>
              Text <strong className="text-safesense-code">LINK {live.code}</strong> to <span className="nowrap">{number}</span> within 10 minutes.
            </p>
            <p className="small muted">Send the whole line, including LINK, as one iMessage from your iPhone. This page will show “Linked” when it works.</p>
            <button type="button" className="btn btn-secondary btn-block" disabled={!ready || busy}
              onClick={() => mod && run(() => mod.createLinkCode())}>Get a new code</button>
          </>
        ) : (
          <>
            <p className="small">Link your phone so your texts show up in this chat.</p>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              disabled={!ready || busy}
              onClick={() => mod && run(() => mod.createLinkCode())}
            >
              <Link2 size={20} strokeWidth={1.5} aria-hidden="true" /> {busy ? 'Making a code…' : 'Link my phone'}
            </button>
          </>
        )}
      </div>

      <p className="small muted">Demo: this line answers one registered iPhone. Text STOP anytime to stop messages.</p>
    </section>
  )
}

/**
 * "Send me a practice text": SafeSense texts the linked iPhone one fake scam (request_practice_text,
 * spacetimedb-ts/src/practice.ts). Replying REPORT counts as a catch; either way a short debrief follows.
 */
function PracticeText({ mod, ready }: { mod: BotModule; ready: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  const texts = mod.practiceTexts()
  const counted = texts.filter((p) => p.status !== 'failed')
  const last = texts.at(-1)
  const at = (p: (typeof texts)[number]) => Number(p.createdAt.microsSinceUnixEpoch / 1000n)
  const left = PRACTICE_TOTAL - counted.length
  const usedToday = counted.some((p) => now - at(p) < DAY_MS)

  const status =
    last?.status === 'queued'
      ? 'On its way — watch your Messages in a minute or two.'
      : last?.status === 'pending'
        ? 'Sent. Check your Messages and answer it like any other text.'
        : last?.status === 'caught'
          ? 'You caught the last one. Nice work!'
          : last?.status === 'fooled'
            ? 'The last one fooled you, and that’s what practice is for.'
            : last?.status === 'failed'
              ? 'The last one couldn’t be sent. You can try again.'
              : null

  const ask = async () => {
    setBusy(true)
    setError(null)
    try {
      setError(await mod.requestPracticeText())
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="text-safesense-practice">
      <p className="small">
        <strong>Practice texts:</strong> SafeSense sends your phone a fake scam text. Reply REPORT if you spot it, and you’ll
        get a quick tip either way.
      </p>
      {status && <p className="small">{status}</p>}
      {left <= 0 ? (
        <p className="small muted">You’ve had all {PRACTICE_TOTAL} practice texts.</p>
      ) : usedToday ? (
        <p className="small muted">One practice text a day. You can ask for another one tomorrow.</p>
      ) : (
        <button type="button" className="btn btn-primary btn-block" disabled={!ready || busy} onClick={ask}>
          <Send size={20} strokeWidth={1.5} aria-hidden="true" /> {busy ? 'Asking…' : 'Send me a practice text'}
        </button>
      )}
      {error && (
        <p className="small" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
