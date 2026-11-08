import { useSyncExternalStore } from 'react'

// Small wrappers around browser storage. Placeholder until user data comes from a backend.
// Every access is guarded: storage can be unavailable (private windows, blocked site data).

export const KEYS = {
  name: 'safesense-name',
  points: 'safesense-points',
  lastPlayed: 'safesense-last-played',
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
// One shared total. Everything that shows points uses usePoints(), so an award updates every display at once.

const POINTS_EVENT = 'safesense-points'

export function getPoints(): number {
  return Math.max(0, Math.floor(Number(load(KEYS.points, '0')) || 0))
}

export function addPoints(n: number) {
  save(KEYS.points, String(getPoints() + n))
  window.dispatchEvent(new Event(POINTS_EVENT))
}

/** Subscribes to point changes, including ones made in another tab. */
export function subscribePoints(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEYS.points) onChange()
  }
  window.addEventListener(POINTS_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(POINTS_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

/** Current point total, kept in sync everywhere it is shown. */
export function usePoints(): number {
  return useSyncExternalStore(subscribePoints, getPoints, () => 0)
}
