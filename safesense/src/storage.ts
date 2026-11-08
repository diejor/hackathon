import { useProgress } from './lib/useProgress'

// Small wrappers around browser storage, for things that only matter on this device (the display name,
// the last game opened, a prompt handed to the chat). Every access is guarded: storage can be unavailable
// (private windows, blocked site data).
//
// Points are NOT stored here. The total is computed from the rounds saved in SpacetimeDB (my_activity),
// so it is the same on every device that uses the recovery key and survives clearing the browser.

export const KEYS = {
  /** The display name ("Hello {name}!"). Shared by the dashboard and the profile page. */
  name: 'safesense-name',
  lastPlayed: 'safesense-last-played',
  /** sessionStorage: a prompt the chat composer picks up once (the dashboard's "How can I improve?"). */
  chatPrompt: 'safesense-chat-prompt',
} as const

export function load(key: string, fallback = '', store: Storage | null = safe(() => localStorage)): string {
  try {
    return store?.getItem(key) || fallback
  } catch {
    return fallback
  }
}

export function save(key: string, value: string | null, store: Storage | null = safe(() => localStorage)) {
  try {
    if (value === null) store?.removeItem(key)
    else store?.setItem(key, value)
  } catch {
    /* storage unavailable */
  }
}

export function session(): Storage | null {
  return safe(() => sessionStorage)
}

function safe<T>(get: () => T): T | null {
  try {
    return get()
  } catch {
    return null
  }
}

// ---------- Points ----------
// One shared total. Everything that shows points uses usePoints(), so a finished game updates every display
// at once. A game earns its point by logging its "finished" row (logActivity); the rule is pointsFor() in
// lib/progress.ts: +1 per finished game.

/** Current point total from SpacetimeDB, or null while it is still loading (or offline). */
export function usePoints(): number | null {
  const { status, progress } = useProgress()
  return status === 'ready' ? progress.points : null
}
