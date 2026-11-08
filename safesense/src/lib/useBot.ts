// React view of the Help Bot store (web/src/bot/bot.ts), loaded and connected once through helpBot().
// A tiny external store: the first component that uses it starts the connection; every bot/lobby change
// (messages, facts, sending, error, connection) recomputes one snapshot that all subscribers share.
import { useSyncExternalStore } from 'react'
import { helpBot } from './stdb'
import type { ChatMessage, MemoryFact } from '../../../web/src/bot/bot'

export type { ChatMessage, MemoryFact }

type Mods = Awaited<ReturnType<typeof helpBot>>

/** loading: bot code not loaded yet · connecting · ready · reconnecting (was ready, lost the link) · offline (couldn't connect). */
export type BotStatus = 'loading' | 'connecting' | 'ready' | 'reconnecting' | 'offline'

export interface BotSnapshot {
  status: BotStatus
  /** Connecting has taken longer than expected. */
  slow: boolean
  messages: ChatMessage[]
  facts: MemoryFact[]
  /** Number of game events the coach can see. */
  activityCount: number
  /** A message is being answered ("Thinking…"). */
  pending: boolean
  /** Last send/forget/attach error for the page (null when none). */
  error: string | null
}

const SLOW_MS = 8000

let mods: Mods | null = null
let started = false
let everReady = false
let slow = false
let loadError: string | null = null
let earlyError: string | null = null // an error shown before the bot code loaded
let snap: BotSnapshot = {
  status: 'loading',
  slow: false,
  messages: [],
  facts: [],
  activityCount: 0,
  pending: false,
  error: null,
}
const subs = new Set<() => void>()

function compute(): BotSnapshot {
  if (!mods) return { ...snap, status: loadError ? 'offline' : 'loading', slow, error: loadError ?? earlyError }
  const { L, bot } = mods
  const ready = bot.ready()
  if (ready) everReady = true
  const status: BotStatus = ready
    ? 'ready'
    : everReady
      ? 'reconnecting'
      : L.state.connectError
        ? 'offline'
        : 'connecting'
  return {
    status,
    slow: !ready && slow,
    messages: bot.messages(),
    facts: bot.facts(),
    activityCount: bot.activity().length,
    pending: bot.state.sending,
    error: bot.state.error,
  }
}

function emit() {
  snap = compute()
  for (const fn of subs) fn()
}

function start() {
  if (started) return
  started = true
  setTimeout(() => {
    slow = true
    emit()
  }, SLOW_MS)
  helpBot()
    .then((m) => {
      mods = m
      m.bot.onChange(emit)
      emit()
    })
    .catch((err) => {
      console.warn('[bot] load failed', err)
      loadError = 'The assistant could not load. Check your internet connection, then reload the page.'
      emit()
    })
}

function subscribe(fn: () => void) {
  subs.add(fn)
  start()
  return () => {
    subs.delete(fn)
  }
}

const getSnapshot = () => snap

const notLoaded = 'The assistant is still connecting. Try again in a moment.'

/** Actions; safe to call before the bot has loaded (they report "still connecting"). */
export const botActions = {
  /** Resolves true if the server took the message; false means it was rejected and `error` says why. */
  send: async (text: string, imageDataUrl?: string): Promise<boolean> =>
    mods ? mods.bot.send(text, imageDataUrl) : (botActions.showError(notLoaded), false),
  /** Delete the person's messages, remembered notes, game activity and linked apps. */
  forgetMe: async (): Promise<boolean> => (mods ? mods.bot.forgetMe() : (botActions.showError(notLoaded), false)),
  /** Downscale a picked/pasted image to the JPEG data URL `send` expects. Throws a user-facing Error. */
  toJpegDataUrl: async (file: Blob): Promise<string> => {
    if (!mods) throw new Error(notLoaded)
    return mods.bot.toJpegDataUrl(file)
  },
  showError: (message: string) => {
    if (mods) mods.bot.showError(message)
    else {
      earlyError = message
      emit()
    }
  },
  clearError: () => {
    if (mods) mods.bot.clearError()
    else if (earlyError) {
      earlyError = null
      emit()
    }
  },
}

/** Subscribe a component to the Help Bot: connection status, messages, pending, error. */
export function useBot(): BotSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot)
}
