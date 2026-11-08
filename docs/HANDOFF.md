# SafeSense: handoff for Krishna

Written 2026-11-08 ~04:00 CST, after merging the designer's design01 into `safesense`. Read this first, then
[`PLAN.md`](PLAN.md) §1–5 and [`PHOTON.md`](PHOTON.md) if you touch texting.

## What SafeSense is now

A calm web app for people who feel unsure about scams:

- **Three games:** Fraudle (guess the safety word), Scam or Not? (15 messages, "Check it" clues and sources),
  Role Reversal (you play the scammer in one of 3 stories, then a debrief turns each move into a defense).
  Your BadScam, Friend or Fraud? and Scam Wordle ideas live on in these, credited on the pages.
- **The SafeSense assistant:** an AI chat (Gemini through SpacetimeDB) that gives a verdict with reasons. It
  sees the person's game history, so "How can I improve?" on the dashboard gets a personal answer.
- **Text SafeSense:** the same assistant over iMessage (Photon), plus opt-in practice texts.
- **Dashboard and progress:** "Hello {name}", points, last played, a locked 4th game (The Phone Call,
  unlocks at 10 points, "coming soon"), a profile page (`#/profile`) and a recovery key instead of accounts.

## Folder map

| Path | What |
| --- | --- |
| `safesense/` | The web app (React 19 + Vite, hash router). The designer's files plus our wiring |
| `safesense/src/pages/` | One file per route: `Home`, `Fraudle`, `ScamOrNot`, `RoleReversal`, `Chat`, `Profile`, `About`, `PhoneCall` |
| `safesense/src/content/` | Game content: `fraudle.ts` (16 words), `scamOrNot.ts` (bank + `dealRounds`), `longCon.ts` (Role Reversal stories), `signs.ts`, `upcoming.ts` (the locked game) |
| `safesense/src/components/` | Our pieces: `chat/*`, `longcon/*` (Role Reversal engine `useCampaign.ts`, `Hud`, `Debrief`), `scamornot/*`, `profile/*`, `LockedGame`, `NameDialog` |
| `safesense/src/lib/` | `stdb.ts` (connection + `logActivity`), `progress.ts` (points and progress, pure functions), `useProgress.ts`, `useBot.ts`, `profileStore.ts` (display name) |
| `safesense/src/points.tsx`, `storage.ts` | The designer's +1 award / end-of-game overlay, and small storage helpers (`usePoints` reads SpacetimeDB) |
| `spacetimedb-ts/` | The backend: a TypeScript SpacetimeDB module (chat, memory, activity, Photon, practice texts) |
| `web/src/bot/`, `web/src/lobby.ts`, `web/src/module_bindings/` | Client data layer the app imports (`stdb.ts` loads it). Generated bindings: don't hand-edit |
| `tools/phone.mjs` | Headless phone/laptop tester with screenshots (usage in its header) |
| `docs/` | `PLAN.md` (source of truth), `PHOTON.md`, polish audits, this file |

## Run it locally

SpacetimeDB runs on 127.0.0.1:3001 here (3000 is taken).

```bash
spacetime start --listen-addr 127.0.0.1:3001          # 1. the database server (leave running)
scripts/publish-ts.sh && scripts/gen-web-ts.sh         # 2. publish the module to safesense-local, regenerate bindings
cd safesense && npm ci && VITE_STDB_SERVER=ws://127.0.0.1:3001 VITE_STDB_DB=safesense-local npm run dev
```

Before you commit: `npm run build` and `npm run lint` in `safesense/`. Check rows with
`spacetime sql --no-config -s local safesense-local "SELECT game, kind FROM activity_event"`.
AI replies need `AI_API_KEY` in the gitignored `.env` (set with `scripts/set-key.sh AI_API_KEY`); games and
points work without it.

## Points, progress and activity

- Every game reports with `logActivity(game, kind, details)` (`lib/stdb.ts`). Rows land in the private
  `activity_event` table, tied to the browser's SpacetimeDB identity; the app reads them back through the
  `my_activity` view. Nothing about progress is kept in localStorage.
- **Points are computed, not stored:** `pointsFor()` in `lib/progress.ts`, +1 per finished game:

  | Game slug | Kind that earns the point | Other rows (0 points, feed signs and coaching) |
  | --- | --- | --- |
  | `fraudle` | `word_solved` or `word_missed` {word, tries} | |
  | `scam-or-not` | `run_done` {correct, total}, logged with the last answer | `answer_correct` / `answer_wrong` {item, said, tactic, checked} |
  | `long-con` (Role Reversal; slug kept for old data) | `round_done` {scenario, tactics, fooled} | |
  | `practice-text` | `answer_correct` / `answer_wrong` (graded on the server) | |

- The end-of-game overlay (`EndOverlay` in `points.tsx`) shows "+1" right after the game logs that row, and
  the header total updates when the row comes back from SpacetimeDB. If you add a game: log one "finished"
  row, add it to `pointsFor`, and wrap its end screen in `EndOverlay`.
- `useProgress()` gives everything the profile shows (counts, signs caught, "worth practicing").
- The display name is device-only (`lib/profileStore.ts`, key `safesense-name`), changed with `NameDialog`
  on Home and Profile.

## Designer updates (design-vendor merge)

The designer works on their own copy and sends zips. Branch `design-vendor` holds **only their files, at the
root** (commits `9026833` design00, `44dd158` design01). For a new zip:

1. `git checkout design-vendor`, replace the files with the zip's contents as-is, commit "Import designNN".
2. Branch from `safesense`, then `git merge -X subtree=safesense design-vendor`. Git applies only what the
   designer changed since their last zip onto `safesense/`.
3. Resolve conflicts by hand: their look wins, our wiring (logging, bot, content, points) stays underneath.
   Their files come with Windows line endings, which can turn a whole file into one conflict; a 3-way merge
   of LF-normalized copies (`diff3 -m`) gives small conflicts.
4. Re-check US English in their new copy, and walk every route at 1366x768 and 390x844.

## Conventions

- **US English** everywhere: Mom, $, US 555-01xx numbers, "color". The AI is "the SafeSense assistant";
  buttons and links that open the chat say "Chat with us".
- **Fictional brands only** (Parcelo, Lakeshore Bank, BrightLine…) and `.example` web addresses.
- **No copied code** (no GPL or tutorial code); credit ideas on the page.
- **Never commit** `node_modules/` (it may be a symlink in a worktree) or `.env`. Run `git status` before
  every commit.
- **Branch from `safesense`** and tell Diego before you push.

## Ask before touching

- `spacetimedb-ts/` (the live backend; schema changes can need a data wipe on Maincloud).
- Photon: `spacetimedb-ts/src/photon*.ts`, `practice.ts`, and anything that sends texts.
- Deploy and publish scripts: `scripts/deploy-*.sh`, `scripts/publish-*.sh`, `scripts/set-key.sh`.

## Known gaps

- Role Reversal shows the whole story as one thread; on a laptop the "how it's going" bar scrolls away as the
  story gets long.
- The Phone Call is a placeholder; there is no unlock logic on the server.
- The display name is per device; the recovery key restores progress but not the name.
