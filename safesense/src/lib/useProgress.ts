// React view of the player's progress, from the bot store's activity() (the my_activity view), loaded and
// connected once through helpBot(). Live: recomputed whenever a new activity row lands.
import { useSyncExternalStore } from 'react'
import { helpBot } from './stdb'
import { deriveProgress, type Progress, type ProgressEvent } from './progress'

export type ProgressStatus = 'loading' | 'ready' | 'offline'
export type ProgressSnapshot = { status: ProgressStatus; progress: Progress }

type Mods = Awaited<ReturnType<typeof helpBot>>

let mods: Mods | null = null
let started = false
let failed = false
let snap: ProgressSnapshot = { status: 'loading', progress: deriveProgress([]) }
let lastKey = ''
const subs = new Set<() => void>()

function compute() {
  let status: ProgressStatus = failed ? 'offline' : 'loading'
  let events: ProgressEvent[] = []
  if (mods) {
    const { L, bot } = mods
    if (bot.ready()) {
      status = 'ready'
      events = bot.activity().map((e) => ({
        game: e.game,
        kind: e.kind,
        details: e.details,
        at: Number(e.createdAt.microsSinceUnixEpoch / 1000n),
      }))
    } else if (L.state.connectError) status = 'offline'
  }
  // Only publish a new snapshot when something visible changed (chat messages also trigger onChange).
  const key = `${status}|${events.length}|${events.length ? events[events.length - 1].at : 0}`
  if (key === lastKey) return
  lastKey = key
  snap = { status, progress: deriveProgress(events) }
  for (const fn of subs) fn()
}

function start() {
  if (started) return
  started = true
  helpBot()
    .then((m) => {
      mods = m
      m.bot.onChange(compute)
      compute()
    })
    .catch((err) => {
      console.warn('[progress] load failed', err)
      failed = true
      compute()
    })
}

function subscribe(fn: () => void) {
  subs.add(fn)
  start()
  return () => {
    subs.delete(fn)
  }
}

/** The player's progress (points, counts, signs caught, what to practice), kept live. */
export function useProgress(): ProgressSnapshot {
  return useSyncExternalStore(subscribe, () => snap)
}
