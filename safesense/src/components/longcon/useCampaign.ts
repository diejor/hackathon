// The Long Con's campaign engine, adapted from BadScam's game.js (Krishna, SafeSense team): open a scene
// (its narrator lines and posts go into the feed), pick an option (its results go into the feed with a
// receipt, the count of people who believed it and the believability dial move, simulated people react),
// then after a short beat the next scene opens. After the last scene the campaign is done.
import { useCallback, useEffect, useReducer } from 'react'
import { logActivity } from '../../lib/stdb'
import { START_CRED, type Campaign, type Entry, type Option, type Reaction } from '../../content/longCon'

export type FeedItem = {
  key: number
  /** The scene this line belongs to; lines from earlier scenes are shown faded. */
  scene: number
  entry: Entry
  /** The change a choice made, shown under its last line. */
  receipt?: { reach: number; cred: number }
}

export type CampaignState = {
  c: Campaign
  scene: number
  feed: FeedItem[]
  reach: number
  cred: number
  status: Record<string, Reaction>
  /** Choices made that teach something, in order. */
  used: Option[]
  /** A choice was just made; the next scene opens after a beat. */
  waiting: boolean
  done: boolean
  /** Key of the first line the last choice added (scrolled into view). */
  firstNew: number
}

type Action = { type: 'start'; c: Campaign } | { type: 'pick'; o: Option } | { type: 'advance' } | { type: 'quit' }

const clamp = (n: number) => Math.min(100, Math.max(0, n))

function append(s: CampaignState, entries: Entry[], scene: number): FeedItem[] {
  let key = s.feed.length ? s.feed[s.feed.length - 1].key + 1 : 0
  return [...s.feed, ...entries.map((entry) => ({ key: key++, scene, entry }))]
}

function openScene(s: CampaignState, scene: number): CampaignState {
  const sc = s.c.scenes[scene]
  return { ...s, scene, waiting: false, status: { ...s.status, ...sc.react }, feed: append(s, sc.lead, scene) }
}

function reduce(s: CampaignState | null, a: Action): CampaignState | null {
  if (a.type === 'quit') return null
  if (a.type === 'start') {
    const fresh: CampaignState = {
      c: a.c,
      scene: 0,
      feed: [],
      reach: 0,
      cred: START_CRED,
      status: {},
      used: [],
      waiting: false,
      done: false,
      firstNew: 0,
    }
    return openScene(fresh, 0)
  }
  if (!s) return s
  if (a.type === 'pick') {
    if (s.waiting || s.done) return s
    const o = a.o
    const reach = o.reach ?? 0
    const cred = o.cred ?? 0
    const feed = append(s, o.out, s.scene)
    const firstNew = s.feed.length ? s.feed[s.feed.length - 1].key + 1 : 0
    if ((reach || cred) && feed.length) feed[feed.length - 1] = { ...feed[feed.length - 1], receipt: { reach, cred } }
    return {
      ...s,
      feed,
      firstNew,
      reach: Math.max(0, s.reach + reach),
      cred: clamp(s.cred + cred),
      status: { ...s.status, ...o.react },
      used: o.tactic || o.lesson ? [...s.used, o] : s.used,
      waiting: true,
    }
  }
  // advance
  if (!s.waiting) return s
  if (s.scene + 1 < s.c.scenes.length) return openScene(s, s.scene + 1)
  return { ...s, scene: s.scene + 1, waiting: false, done: true }
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Simulated people who believed it, out of everyone in the campaign. */
export const believedCount = (s: CampaignState) => s.c.people.filter((p) => s.status[p.id] === 'believed').length

/** The tactic slugs used, each once, in order. */
export const tacticsUsed = (s: CampaignState) => [...new Set(s.used.map((o) => o.tactic).filter((t) => !!t))] as string[]

export function useCampaign() {
  const [state, dispatch] = useReducer(reduce, null)

  useEffect(() => {
    if (!state?.waiting) return
    const last = state.scene + 1 >= state.c.scenes.length
    const t = window.setTimeout(
      () => {
        if (last) {
          // Same contract as before the port (docs/PLAN.md §5): {scenario, tactics, fooled}.
          void logActivity('long-con', 'round_done', {
            scenario: state.c.id,
            tactics: tacticsUsed(state),
            fooled: believedCount(state) > 0,
          })
        }
        dispatch({ type: 'advance' })
      },
      prefersReducedMotion() ? 0 : 700
    )
    return () => window.clearTimeout(t)
  }, [state])

  return {
    state,
    start: useCallback((c: Campaign) => dispatch({ type: 'start', c }), []),
    pick: useCallback((o: Option) => dispatch({ type: 'pick', o }), []),
    quit: useCallback(() => dispatch({ type: 'quit' }), []),
  }
}
