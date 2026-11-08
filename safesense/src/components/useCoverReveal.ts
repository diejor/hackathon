import { useEffect, useRef, useState } from 'react'

export type CoverState = 'hidden' | 'pressed' | 'fading' | 'shown'

/**
 * The frosted cover over a clue (design01): 'hidden' → 'pressed' (eye button feedback) → 'fading'
 * (the cover fades out) → 'shown'. With reduced motion it goes straight to 'shown'.
 * Used by the Fraudle clue and the Scam or Not? "Check it" box.
 */
export function useCoverReveal() {
  const [state, setState] = useState<CoverState>('hidden')
  const timer = useRef<number>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const reveal = () => {
    if (state !== 'hidden') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setState('shown')
    setState('pressed')
    timer.current = window.setTimeout(() => {
      setState('fading')
      timer.current = window.setTimeout(() => setState('shown'), 260)
    }, 320)
  }

  return [state, reveal] as const
}
