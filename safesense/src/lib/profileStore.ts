// The person's display name ("Hello {name}!" on the dashboard, "Hi, {name}" on the profile). Kept on this
// device (localStorage) behind get/set/onChange, so it can move to a server table later without touching
// the pages. One key for the whole app: the designer's KEYS.name. A name saved under the old key
// ("safesense.nickname", before design01) is moved over the first time it is read.
import { useSyncExternalStore } from 'react'
import { KEYS } from '../storage'

const KEY = KEYS.name
const OLD_KEY = 'safesense.nickname'
export const MAX_NICKNAME = 30

const subs = new Set<() => void>()
let cached: string | null = null

function read(): string {
  try {
    const now = localStorage.getItem(KEY)
    if (now) return now
    const old = localStorage.getItem(OLD_KEY)
    if (old) {
      localStorage.setItem(KEY, old)
      localStorage.removeItem(OLD_KEY)
      return old
    }
    return ''
  } catch {
    return ''
  }
}

/** The saved name, or '' when none. */
export function getNickname(): string {
  cached ??= read()
  return cached
}

/** Save (or clear, with '') the name. Trimmed and capped; still works if storage is unavailable. */
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

/** Called whenever the name changes. Returns an unsubscribe. */
export function onNicknameChange(fn: () => void): () => void {
  subs.add(fn)
  return () => {
    subs.delete(fn)
  }
}

export function useNickname(): string {
  return useSyncExternalStore(onNicknameChange, getNickname)
}
