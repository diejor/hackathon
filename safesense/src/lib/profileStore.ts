// The person's optional nickname. Kept on this device (localStorage) for now, behind get/set/onChange so it
// can move to a server table later without touching the pages.
import { useSyncExternalStore } from 'react'

const KEY = 'safesense.nickname'
export const MAX_NICKNAME = 30

const subs = new Set<() => void>()
let cached: string | null = null

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

/** The saved nickname, or '' when none. */
export function getNickname(): string {
  cached ??= read()
  return cached
}

/** Save (or clear, with '') the nickname. Trimmed and capped; still works if storage is unavailable. */
export function setNickname(name: string): void {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, MAX_NICKNAME)
  cached = clean
  try {
    if (clean) localStorage.setItem(KEY, clean)
    else localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable: keep it for this visit */
  }
  for (const fn of subs) fn()
}

/** Called whenever the nickname changes. Returns an unsubscribe. */
export function onNicknameChange(fn: () => void): () => void {
  subs.add(fn)
  return () => {
    subs.delete(fn)
  }
}

export function useNickname(): string {
  return useSyncExternalStore(onNicknameChange, getNickname)
}
