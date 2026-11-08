// Bridge from the SafeSense design to the SpacetimeDB backend (Help Bot module in ../spacetimedb,
// client code in ../web/src). One connection per tab, shared by the chat and the games.
//
// Server/db: ?server=&db= in the URL, else VITE_STDB_SERVER / VITE_STDB_DB at build time, else Maincloud
// (hackathon-1aa18263). The identity token lives in localStorage (stdb.token.<db>), so every page in this
// browser is the same player: the games' results and the chat share one identity, and the coach sees both.
//
// Kept in its own file (not in the designer's pages) so new design zips merge without touching the wiring.

type Lobby = typeof import('../../../web/src/lobby')
type Bot = typeof import('../../../web/src/bot/bot')

let loading: Promise<{ L: Lobby; bot: Bot }> | null = null

/** Load the bot store and connect once (idempotent). */
export function helpBot(): Promise<{ L: Lobby; bot: Bot }> {
  const g = globalThis as { __STDB__?: { server?: string; db?: string } }
  g.__STDB__ ??= {
    server: import.meta.env.VITE_STDB_SERVER || undefined,
    db: import.meta.env.VITE_STDB_DB || undefined,
  }
  // lobby reads the server/db when it loads, so the defaults above must be set before this import.
  loading ??= Promise.all([import('../../../web/src/lobby'), import('../../../web/src/bot/bot')]).then(([L, bot]) => {
    L.connect()
    return { L, bot }
  })
  return loading
}

type Activity = { game: string; kind: string; details: string }
const pending: Activity[] = []
/** One flush at a time: two reports in the same tick used to both send pending[0], saving it twice. */
let flushing: Promise<boolean> | null = null

/**
 * Report one finished round to the coach (log_activity; rules in spacetimedb/Activity.cs):
 * game/kind are slugs (a-z, 0-9, '-', '_'; ≤ 32 chars); details becomes single-line JSON (≤ 500 chars).
 * Kinds containing "wrong" feed the coach's most-missed-tactic summary, so put the tactic in details.tactic.
 * Fire-and-forget: never throws, queues until connected.
 */
export async function logActivity(game: string, kind: string, details: Record<string, unknown>): Promise<void> {
  pending.push({ game, kind, details: JSON.stringify(details).slice(0, 500) })
  try {
    const { L } = await helpBot()
    const flush = (): Promise<boolean> => {
      if (flushing) return flushing
      flushing = (async () => {
        try {
          const c = L.getConn()
          if (!c || !L.state.connected) return false
          while (pending.length) {
            await c.reducers.logActivity(pending[0])
            pending.shift()
          }
          return true
        } finally {
          flushing = null
        }
      })()
      return flushing
    }
    if (await flush()) return
    const off = L.onChange(() => {
      if (L.state.connected) {
        off()
        void flush().catch((err) => console.warn('[stdb]', err))
      }
    })
  } catch (err) {
    console.warn('[stdb] report failed', err)
  }
}
