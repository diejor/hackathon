# SafeSense

Scam training that knows you: play three short games, see the scam your results say would most likely
get you, practise it as a safe drill text on your own verified phone, and talk it through with a coach
that already knows your weak spots. Code and folder names still say `safe-signal`.

Next.js 15 app. Run with Node 22.13+ (it uses `node:sqlite`).

```
npm ci
npm run dev        # http://localhost:3000
```

## Flow

1. `/` home → **Start training** → `/games`.
2. `/games`: Scamdle (4 rounds, tap the red flags), Friend or Fraud (6 rounds, investigate up to 2 clues,
   then call it; some rounds show a simulated "players like you" crowd), Build a Bad Scam (2 rounds, pick
   a target and tactics, get a reach estimate). A reveal follows every round. Each round is stored in
   SQLite (`/api/events`) and reported to the coach. Then **Training complete**.
3. `/campaign`: 8-trait radar, top 3 weak spots, the drill message chosen for you (**Show the red flags**
   highlights them), phone verification and send (only when sending is enabled), **Preview the debrief**.
4. `/t/<token>`: static debrief. `/t/<token>?preview=1` shows it to the campaign owner's own browser
   without resolving the token, so the drill can still be sent afterwards. Opening the link without
   `?preview=1` (the tap from the real text) resolves it and ends the simulation.
5. `/coach`: the Help Bot chat from `../web/src/bot`, on SpacetimeDB. It receives every game round and
   your profile, so it can coach on your weak spots.

Reloading `/games` mid-training starts the games again from the intro; rounds already played stay stored.

## Profile

`src/lib/profiler.ts` uses fixed rules. Each game counts once: per-round trait deltas are averaged within
a game (4 Scamdle rounds weigh the same as 1), then the three games are summed onto a neutral profile and
clamped to 0..1.

- Scamdle, per round: +0.1 to the trait of each missed flag, -0.05 for each found flag, +0.025
  verification deficit per false alarm, -0.05 urgency reactivity if answered in under 30 s.
- Friend or Fraud, over all rounds: average clue diagnosticity below 0.5 → +0.1 verification deficit;
  5+ clues in total → -0.1, fewer than 3 → +0.1 urgency reactivity; deferring to / following the crowd on
  crowd rounds adds up to +0.15 authority deference / consensus susceptibility; a scam called a friend
  adds 0.2/n to the trait its tactic exploits, a scam caught subtracts 0.05/n.
- Build a Bad Scam, per round: chosen tactics -0.1 to their trait, unchosen +0.05; reach ≥ 80 → -0.05 on
  every trait.

The two highest traits pick the drill archetype. Scores are educational heuristics.

## Environment

Copy `.env.example` to `.env.local`.

| Variable | Purpose |
| --- | --- |
| `SAFESIGNAL_DB_PATH` | SQLite file (default `./safesignal.db`) |
| `BASE_URL` | Public HTTPS origin used in drill links |
| `NEXT_PUBLIC_STDB_SERVER`, `NEXT_PUBLIC_STDB_DB` | Help Bot SpacetimeDB (default Maincloud `hackathon-1aa18263`). Inlined at **build** time |
| `SPECTRUM_PROJECT_ID`, `SPECTRUM_PROJECT_SECRET`, `PHOTON_INBOUND_NUMBER` | Photon/Spectrum line for drills, verification codes and replies |
| `ENABLE_PHOTON_TEXT`, `SAFESIGNAL_SENDING_ENABLED` | Both `true` to send; otherwise `/campaign` runs in preview mode |
| `MAX_SENDS_PER_PLAYER` | Send cap per session (default 3) |

The session cookie is `secure` in production; browsers still accept it on `http://localhost`.

## Phone drills

Run a persistent server (`npm run build && npm start`): verification starts the authenticated Spectrum
inbound stream in that process (an SDK stream, not a webhook), so serverless needs a separate worker.
Shared Photon plans require registering the recipient in the Photon dashboard.

On `/campaign`, enter your own E.164 number, text the shown single-use code from that phone to the
Photon line within ten minutes, then **Send**. REPORT records a report; STOP, UNSUBSCRIBE or QUIT opts
out; tapping the link opens the debrief and ends the simulation. No inbound message triggers an
outbound reply. Attempts are reserved before delivery; an uncertain delivery consumes the attempt.
Restart the process after changing the environment.

## Running next to the Help Bot

`/coach` imports `../web/src/bot` directly, so `web/` needs its dependencies (`cd ../web && npm ci`).
Against a local SpacetimeDB (see the root `CLAUDE.md`; port 3001, db `hackathon-local`):

```
NEXT_PUBLIC_STDB_SERVER=ws://127.0.0.1:3001 NEXT_PUBLIC_STDB_DB=hackathon-local npm run build
npm start -- -p 3008
```

`?server=&db=` in the URL also works but is lost on in-app navigation. The SafeSense pages share one
bot identity per browser (token in `localStorage`).

## Checks

```
npx tsc --noEmit
npm test
npm run build
```

Training uses fictional brands and synthetic scenarios.
