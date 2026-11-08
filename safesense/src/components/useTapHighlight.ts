import { useEffect, useRef, useState } from 'react'

/** How long a tapped card or choice stays highlighted on touch screens before it acts. */
export const TAP_HIGHLIGHT_MS = 220

/**
 * Desktop shows the dark green highlight on hover (CSS). Touch screens have no hover, so a tap shows the
 * highlight briefly before acting. A click only fires for a real tap, not while the page is being
 * scrolled, so scrolling past never highlights anything. Used by the home game cards and the Role
 * Reversal choices.
 */
export function useTapHighlight() {
  const [pressed, setPressed] = useState(false)
  const timer = useRef<number>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  /** Run `action` now on hover screens; on touch screens, highlight first. Returns true if it was delayed. */
  const tap = (action: () => void): boolean => {
    if (window.matchMedia('(hover: hover)').matches) {
      action()
      return false
    }
    setPressed(true)
    window.clearTimeout(timer.current)
    // The highlight stays on while the page moves on (callers remount or navigate away).
    timer.current = window.setTimeout(action, TAP_HIGHLIGHT_MS)
    return true
  }

  return [pressed, tap] as const
}
