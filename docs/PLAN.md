# SafeSense — implementation plan

Written 2026-11-08 ~01:30 CST, on branch `safesense`.
- Deadlines: Devpost submission Sun 2026-11-08 **11:00 CST**; demo video uploaded by **12:00 CST**.
- Event: HackUTD (MLH). Tracks: T-Mobile Safe Signal, Best Use of Photon API, MLH Best Use of Gemini API (prize: MLH swag kits).
- This file is the source of truth for the build. Subagents: read it fully before starting, and stay inside your band's files.

## 1. What we're building

SafeSense is a calm, accessible companion that helps people who feel unsure about scams (often older adults) to:
1. **Practise** with three gentle games: Fraudle, Scam or Not?, and The Long Con.
2. **Ask** a coach in their own words, by typing, speaking or adding a screenshot. The coach gives a verdict with reasons, signs to notice and what to do. It remembers what the person struggles with in the games.
3. **Text SafeSense** (Photon, iMessage): forward a suspicious text to the SafeSense number and get the same calm verdict back. Stretch goal: *practice texts* (Krishna's original drill idea), sent only to people who opted in.

Tone, from the designer: "Pause. Check. Then act." No scores to chase, no timers, no pressure. Text-size control. US English throughout (dollars, US numbers, "Mom", "doctor's office").

Positioning for T-Mobile: a companion to Scam Shield, not a replacement. Scam Shield blocks quietly at the network level. SafeSense teaches people, and covers what reaches them anyway: screenshots from any app, iMessage, Discord.

Never claim certainty: the coach gives guidance with reasons. Never imply that simulated people are real.

## 2. Decisions

| # | Decision | Why | Status |
| --- | --- | --- | --- |
| D1 | The frontend is the designer's `design00` (React 19 + Vite, hash router), in `safesense/` | It's what the team wants. It has the agreed games and a chat UI | Settled (Diego) |
| D2 | The backend is **SpacetimeDB only**. No Node server, no SQLite | One backend and one identity. The coach sees game results. Free hosting | Settled (Diego) |
| D3 | **Port the module from C# to TypeScript** (`spacetimedb-ts/`) | The backend will grow (Photon guards, practice texts). One language for the whole team, so Krishna's TS code (guards, scam scenarios) moves in directly | Settled (Diego). Gated: see B1 |
| D4 | Photon via **path A**: Photon 2.0 REST + signed webhook, handled inside SpacetimeDB | Nothing extra to host. The C# version (`Photon.cs`) is already built and tested with simulated requests | Settled (Diego) |
| D5 | Krishna's Next.js + SQLite app is retired and archived on `combined`. His guard rules, scam scenarios, red-flag and tactic lists, and the drill idea carry over | The design replaces his UI | Settled; tell Krishna |
| D6 | Krishna owns "SafeSense by text" (Photon set-up, iPhone testing, guard review) | His Photon know-how and iPhone. Keeps his work central | Proposed. Diego to confirm with Krishna |
| D7 | US English for all content | T-Mobile judges are in the US | Settled |
| D8 | The Long Con: **you play the scammer** | Matches the home card, "become more familiar with fraudulent tactics" | Settled |
| D9 | The designer keeps their own copy. Their zips go to the `design-vendor` branch and merge into `safesense/` | Their changes merge without clobbering our wiring | Settled |
| D10 | **Discord is dropped from the product and the demo.** The code stays in the module, unused; the endpoint still points at `safesense-1aa18263` | Nice for testing, not part of the story | Settled (Diego, ~00:40) |
| D11 | Gemini via the OpenAI-compatible API (gemini-3.5-flash, falling back to flash-lite). **Paid tier before recording** | Cents for the demo. Paid-tier content isn't used to improve Google's products | Settled (Diego). Billing not on yet |
| D12 | `main` (Security Arcade + C# bot) and `combined` (Next.js attempt) stay as archives. Nothing is deleted or force-pushed | Fallbacks | Settled |

## 3. Target architecture

```
 Phone browser (GitHub Pages, static)          iPhone (Messages)          Discord
 safesense/  React app                          │ text SafeSense            │ /check
   ├─ Fraudle / Scam or Not? / Long Con ──┐     ▼                           ▼
   │      logActivity(game, kind, details) │   Photon 2.0 ── signed webhook ──┐   signed HTTP
   └─ Chat (bot store from web/src/bot) ───┤                                   │      │
                         WebSocket          ▼                                   ▼      ▼
              SpacetimeDB on Maincloud ── new db (TS module, spacetimedb-ts/) ─────────────
                tables: chat_message, memory_fact, activity_event, channel_link, link_code, ...
                procedures: bot_send (Gemini call), discord_run_job, photon replies
                http routes: /discord, /photon
                                   │ outbound HTTPS
                                   ▼
                     Gemini (OpenAI-compatible API) · Photon REST API · Discord API
```

- **Identity:** the SpacetimeDB identity (token in localStorage, `stdb.token.<db>`). Phone and Discord identities link to it with a code (`LINK <code>`).
- **Privacy:** messages, memory and activity are private tables, read through per-user views. Screenshots are never stored. "Forget me" deletes all of a person's data.
- **Old live demo:** Maincloud db `hackathon-1aa18263` (C# module) and the arcade on Pages stay running, untouched.

## 4. Repo, branches and folders

| Branch | Holds | Rule |
| --- | --- | --- |
| `safesense` | **The product.** All new work lands here | Bands work on their own branches from it; the coordinator merges |
| `design-vendor` | The designer's files only, at the root | New zip: commit it here as is, then `git merge -X subtree=safesense design-vendor` on `safesense` |
| `combined` | Archive: Krishna's app + our Next.js integration | Read-only. Krishna's code is at `combined:safe-signal/` |
| `main` | Archive: Security Arcade + the C# bot (live on Pages and Maincloud) | Don't push without Diego's OK |
| `web-app` | Krishna's original branch | Never touch |

| Folder (on `safesense`) | Role |
| --- | --- |
| `safesense/` | Frontend. Designer's files plus our additions in **new files** (`src/lib/*`, `src/components/*`, `src/content/*`). Keep edits to the designer's files small |
| `spacetimedb-ts/` | **New** TypeScript module (B1) |
| `spacetimedb/` | C# module. Stays until B1 passes its gate; deleted from `safesense` only after the switch |
| `web/src/bot/`, `web/src/lobby.ts`, `web/src/module_bindings/` | Bot data layer used by SafeSense through `safesense/src/lib/stdb.ts`. The arcade UI in `web/` is legacy |
| `docs/content/messages.json` | The 40-message scam bank (fictional brands; scam domains checked not to resolve) |
| `tools/phone.mjs` | Headless phone tester (Chromium, touch, screenshots) |

## 5. Contracts every band relies on

- **Same names after the port.** The TypeScript module keeps every table, view, reducer and procedure name and every field shape of the C# module (see the inventory in B1). `web/src/bot/bot.ts` and `lobby.ts` then work unchanged after `scripts/gen-web.sh`.
- **Game reporting:** `logActivity(game, kind, details)` from `safesense/src/lib/stdb.ts`. Rules are in `spacetimedb/Activity.cs`:
  - `game` and `kind` are slugs (`a-z0-9-_`, up to 32 characters).
  - `details` is single-line JSON, up to 500 characters; the coach sees about 160.
  - Kinds containing `wrong` feed the coach's "most-missed tactic", so put the tactic in `details.tactic`.

  | Game | Kinds | Details |
  | --- | --- | --- |
  | `fraudle` | `word_solved`, `word_missed` | `{word, tries}` |
  | `scam-or-not` | `answer_correct`, `answer_wrong` | `{item, said, tactic}`, using the bank's tactic slugs (`fake-delivery`, `bank-impersonation`, …) |
  | `long-con` | `round_done` | `{scenario, tactics, fooled}` |

- **Server/db selection:** `?server=&db=` in the URL, otherwise `VITE_STDB_SERVER`/`VITE_STDB_DB` at build time, otherwise Maincloud `hackathon-1aa18263`. After the switch, the default becomes the new db.
- **Module env (secrets are set with `scripts/set-key.sh NAME`, never printed or committed):** `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `AI_VISION_MODEL`, `AI_FALLBACK_MODEL`, `DISCORD_PUBLIC_KEY`, `DISCORD_APPLICATION_ID`, `DISCORD_API_BASE`, `PHOTON_WEBHOOK_SECRET`, `PHOTON_API_KEY`, `PHOTON_PROJECT_ID`, `PHOTON_BASE_URL`.
- **Local dev:** SpacetimeDB on `127.0.0.1:3001` (the `local` nickname); C# db `hackathon-local`, TS db `safesense-local`. Publish only with the scripts. Never `-c` on Maincloud.

## 6. Bands

Each band runs as a subagent in its own git worktree and branch, and owns only its listed files. It commits small steps and never pushes, deploys, publishes to Maincloud or prints secrets. It reports back: branch and commit, what works, test results, screenshots, open issues. The coordinator merges, runs a cheap check (build plus one end-to-end pass), and pushes `safesense`.

### B1 — Port the module to TypeScript (`spacetimedb-ts/`) · ~01:30–03:15

- **Owns:** `spacetimedb-ts/**`, new scripts `scripts/publish-ts.sh` and `scripts/gen-web-ts.sh`.
- **Phase 0, capability spike, gate by ~02:00.** On SpacetimeDB 2.14.1 TS modules, prove with tiny probes on a throwaway local db:
  - a procedure that makes an outbound HTTPS call and opens a transaction;
  - an HTTP route and handler;
  - a scheduled procedure;
  - private tables plus a per-user view;
  - reading module env;
  - Ed25519 verify and HMAC-SHA256 through a pure-JS library (e.g. `@noble/ed25519`, `@noble/hashes`) bundling into the module.

  If any of these is missing, stop and report: we stay on C#, and B4 works in `spacetimedb/Photon.cs`.
- **Phase 1, port everything with the same names.**

  | C# file | Lines | Contents |
  | --- | --- | --- |
  | `Lib.cs` | 312 | rooms and lobby: `room`, `room_member`, `join_attempt`, the `disconnect_cleanup` schedule, `my_room` and `my_room_members` views, room reducers, client connect/disconnect |
  | `Activity.cs` | 156 | `activity_event`, `my_activity`, `log_activity`, `seed_demo_activity`, the coaching summary |
  | `Ai.cs` | 192 | `ai_usage`, `ai_ping`, `ai_ask`; provider-neutral client with fallback model on 429/5xx, 12 s and 20 s timeouts, 3 s per-user rate limit |
  | `Bot.cs` | 470 | `chat_message`, `memory_fact`, `my_messages`, `my_facts`, `forget_me`, `bot_send` |
  | `Discord.cs` + `Ed25519.cs` | 618 | route, `discord_job` schedule, `discord_run_job` |
  | `Photon.cs` + `Sha256.cs` | 653 | `channel_link`, `link_code`, `link_attempt`, `channel_ai_usage`, `webhook_seen`, `my_link_code`, `my_channel_links`, `create_link_code`, `unlink_channels`, router and webhook |

  - Copy the **prompts and the JSON reply schema word for word**: system prompt, injection wrapping, memory rules, secret filter, limits.
- **Phase 2, parity check on `safesense-local`.**
  - Regenerate the web bindings into a scratch folder and diff them against `web/src/module_bindings`; only cosmetic differences are allowed.
  - Run the bot through `tools/phone.mjs` against the legacy `web/` app with `?db=safesense-local`. AI budget: 8 calls. Include a planted prompt-injection paste and a screenshot.
  - Check a signed and an unsigned Discord PING (200 vs 401) and a Photon webhook signature test with fake secrets, the same way the C# version was tested.
- **Done when:** the bindings match, the chat, memory and Forget-me flow works, and the Discord and Photon signature checks pass.
- **Not in scope:** Maincloud and changing the frontend's default db. The coordinator does those (step 3 of the schedule).

### B2 — Chat · ~01:30–02:45

- **Owns:**
  - `safesense/src/pages/Chat.tsx`, kept to small edits;
  - new files `safesense/src/lib/useBot.ts`, `safesense/src/components/chat/*` and `safesense/src/chat.css`.
- **Builds:**
  - The design's chat wired to `bot.ts` through `helpBot()`.
  - Replies show a verdict badge, "Signs to notice" (red flags), "What to do" (next steps), and links as plain text.
  - A greeting plus 3 example chips.
  - Typing (Enter sends), image attach through the existing downscale and HEIC handling, and the mic through `voice.ts`.
  - A "Thinking…" state; errors shown on the page; "Forget me" with an in-page confirm. The design's "Start a new conversation" button must **not** trigger Forget me.
  - A line saying answers are guidance, not a guarantee.
- **Budget:** 4 AI calls.
- **Done when:** `npm run build` and `npm run lint` pass, and there are screenshots of the empty, verdict, image, error and Forget-me states.

### B3 — Games · ~01:30–03:15

- **Owns:**
  - `safesense/src/pages/{Home,Fraudle,ScamOrNot,LongCon}.tsx`;
  - new `safesense/src/content/*` and `safesense/src/components/games/*`;
  - new styles appended to `safesense/src/index.css`, or a separate `games.css`.
- **Builds:**
  - **US English** throughout.
  - **Scam or Not?:** 10–12 rounds, about 60% scams, adding items from the 40-message bank, plus a gentle wrap-up.
  - **The Long Con:** you're the scammer. 3 steps, 3 moves per step, each move a named tactic; the target replies realistically; a debrief explains how a careful person spots each move. Content can draw on Krishna's scenarios (`combined:safe-signal/data/scam-archetypes.json`) and his tactic list.
  - **Fraudle:** physical keyboard support, a one-line lesson per word, a "Next word" button.
  - Every round calls `logActivity` (section 5). No points, timers or pressure.
- **Budget:** 0 AI calls.
- **Done when:** build and lint pass, and there are screenshots of each game's question, reveal and wrap-up states.

### B4 — SafeSense by text (Photon, path A) · after B1's gate, ~03:15–04:30

Handoff guide for Krishna: [`docs/PHOTON.md`](PHOTON.md). Local simulator: `tools/photon-sim.mjs`.

- **Owns:** the Photon part of the module (TS, or `spacetimedb/Photon.cs` if B1 failed), the Photon section of the chat page (a "Text SafeSense" card with the number and a LINK code), and the README Photon section.
- **Builds:**
  - The webhook flow (verify signature → dedupe → LINK, UNLINK and FORGET ME commands → run the bot → reply as plain text).
  - Krishna's guard rules ported from `combined:safe-signal/src/lib/guard.ts`: STOP opts out, a kill switch env var, a per-number send cap, replies only to numbers that texted first.
  - Stretch, practice texts: a linked user taps "Send me a practice text", gets one realistic fake scam (fictional brand, safe link to the debrief page), replies REPORT, and the coach records it. One per day, at most 3 in total, STOP honoured.
- **Needs Krishna:** a Photon 2.0 project with a webhook secret and a line, the secret set with `set-key.sh`, and his iPhone for testing.
- **Done when:** simulated signed webhooks pass locally, then one real round trip on Krishna's iPhone after the Maincloud publish.

### B5 — Coach prompt for SafeSense · with the B1 merge, ~15 min

- Replace the "Security Arcade / Safe Signal" game paragraph in the bot prompt with SafeSense's games and kinds (section 5) and the calm, plain-language tone.
- Keep everything else word for word.
- **Found during B2/B3 (fix here):** (1) `scam-or-not` logs a safe message flagged as a scam as `answer_wrong` with `tactic: "legit"`. The coach must describe that as "flagged a safe message as a scam", not as a missed tactic. (2) A plain fake-PayPal phishing screenshot was labelled a "prompt injection". Tune the injection rule so ordinary scam screenshots are judged as scams (vision path; verify with 2 calls).

### B6 — Deploy · ~04:30, **needs Diego's OK**

> **Done 2026-11-08 00:10 CST (Diego's OK):**
> - TS module live on Maincloud db **`safesense-1aa18263`**. Routes are answering: an unsigned Discord request gets 401; Photon gets 503 until `PHOTON_WEBHOOK_SECRET` is set.
> - SafeSense is at https://diejor.github.io/hackathon/; the previous arcade build is at `/arcade/`.
> - Build command: `VITE_STDB_SERVER=wss://maincloud.spacetimedb.com VITE_STDB_DB=safesense-1aa18263 npm run build` in `safesense/`.
> - The Pages site is assembled as `safesense/dist` plus the old gh-pages content under `arcade/`, then `scripts/deploy-pages.sh <dir>`.
> - Still to do: point the Discord interactions URL at `https://maincloud.spacetimedb.com/v1/database/safesense-1aa18263/route/discord`, and the Photon webhook at `.../safesense-1aa18263/route/photon`.

1. Publish `spacetimedb-ts` to a **new Maincloud db** (name it e.g. `safesense-<suffix>`; never touch `hackathon-1aa18263`) and set the module env with `set-key.sh`.
2. Build `safesense/` with the new db as its default and deploy to GitHub Pages. Suggested layout: SafeSense at the root of `diejor.github.io/hackathon/`, the old arcade moved under `/arcade/`, with Diego's OK.
3. Point the Discord interactions URL at `/v1/database/<new db>/route/discord` in the Discord developer portal (Diego).
4. Point Photon's webhook at `/v1/database/<new db>/route/photon` (Krishna).

### B7 — QA and quality pass · ~07:00–08:00 (paid Gemini)

- Full run on real phones: Diego's Samsung for web, games, chat, screenshot, voice and Discord; Krishna's iPhone for "Text SafeSense".
- Bot quality on 8–10 sample messages (scams and legitimate ones), plus the planted-injection tests. Fix glitches, then **freeze at 08:00**.

### B8 — Story · ~07:00–10:45

- Rewrite the Devpost draft and the 2-minute demo script around SafeSense (problem → practise → ask → text SafeSense → Scam Shield companion → privacy).
- Record from known-good runs plus a backup take; submit by 10:45.

### B9 — Partner insights dashboard (STRETCH; start only after B6 is deployed)

- **Decided (Diego, ~02:20):**
  - It's for partners and judges: a "For partners" page at `#/insights`, linked quietly from the footer. It's the business-model moment in the video.
  - **Aggregates only:** groups smaller than 5 are hidden, and individual profiles stay with the user. Say so on the page and in the pitch.
- **Framing:** measured risk signals, never "we know when you'll be scammed".
  - Which tricks still work.
  - Who is at risk from what: Krishna's 8 traits from `combined:safe-signal/src/lib/profiler.ts` and `src/contracts.ts`.
  - Whether practice lowers the miss rate.
  - Which scams people report in the wild (checks from chat, iMessage and Discord), as an early warning for carriers.
- **Panels:**
  1. KPI tiles.
  2. Tactics by miss rate.
  3. Trait and risk spread.
  4. Miss rate by round number.
  5. Reported scam types per day.
  6. Privacy line.
- **Data:** a synthetic cohort clearly labelled "Demo data", with a toggle to real data.
  - Real data needs a public aggregate table maintained in `log_activity` and `bot_send`, because views can't scan whole tables.
  - It can't expose individual rows.
- **Iteration:** v1 front end with synthetic data → Diego reviews screenshots → v2 wires real aggregates after B1 merges. About 1.5 h + 1 h.

### B10 — Profile: progress, not points · ~00:45–02:15

- **Decided (Diego, ~00:40):** no points, levels or sign-in. Progress is saved on this device (SpacetimeDB identity); a nickname is optional.
- **Page `#/profile`**, linked from the header and from the games' wrap-ups. It shows:
  - **"Signs you can spot":** tactics caught in the games, a collection that fills up;
  - **"Worth practising":** the top 2–3 missed tactics in plain words, each linking to a game (Krishna's trait idea applied personally);
  - **light counts:** messages looked at, words solved, Long Con stories played, days practised;
  - a gentle empty state for new users.
- **Data:** client-side only, from `my_activity`; no backend change. The tactic → plain-words mapping lives in one content module.
- Calm design language, US English.

### B11 — Polish audit, then fix rounds · ~00:45 onward

- **Audit (read-only):** every screen at 360/390/412 px. It lists placeholder or leftover design copy, dead or fake controls, inconsistent wording, UK leftovers, layout and accessibility issues, and anything a judge would notice. The result is `docs/POLISH.md`, a prioritized punch list with screenshots.
- **Diego picks** what to fix; fix bands run on non-overlapping files; then a second audit round.
- **Devpost and the demo script (B8) wait** until polish settles (~06:00–07:00).

## 7. Schedule and gates (CST)

| Time | What | Gate |
| --- | --- | --- |
| 01:30 | B1, B2, B3 start in parallel; Krishna starts the Photon 2.0 set-up | — |
| ~02:00 | B1 capability spike | **Fail → stay on C#.** B2 and B3 are unaffected; B4 targets `Photon.cs` |
| ~02:45–03:15 | B2 and B3 merged into `safesense`; local end-to-end run against the C# db | Games and chat work on the phone tester |
| ~03:15 | B1 merged; switch locally to `safesense-local`; regenerate bindings; B5 | Same end-to-end run passes on the TS module, or we roll back to C# |
| 03:15–04:30 | B4 Photon | Simulated webhooks pass |
| ~04:30 | B6 deploy (Diego's OK) and the first real-phone run | — |
| 04:30–07:00 | Sleep in shifts; only small agreed fixes | — |
| 07:00–08:00 | B7 quality pass; freeze | — |
| 08:00–10:00 | Record, plus a backup take | — |
| 10:00–10:45 | Submit on Devpost | — |

## 8. Cut line (first to cut → last)

1. Partner insights dashboard (B9, stretch).
2. Practice texts (B4 stretch).
4. Extra Scam or Not rounds: keep the designer's 7, localized.
5. **The TypeScript port: if it slips past ~03:30, ship on the C# module** (additive prompt change, publish to a new or the existing db).
6. "Text SafeSense" live on an iPhone: show simulated webhooks plus a screen recording if the real line isn't ready.

Never cut: the three games working with explanations, the chat with screenshots, the calm tone, and honesty.

## 9. Risks and fallbacks

| Risk | Fallback |
| --- | --- |
| TypeScript modules lack a feature we need | Gate at 02:00; stay on C# |
| The port subtly changes bot behaviour | Prompts copied word for word; parity tests; the C# db stays live |
| Gemini quota or overload while recording | Paid tier; fallback model built in; record from known-good takes |
| The Photon line isn't ready or isn't on an iPhone | Simulated signed webhooks plus a screen recording; Discord as the second channel |
| A new design zip arrives mid-build | Commit it to `design-vendor` and merge; our logic lives in separate files |
| Krishna or the designer push conflicting work | Read-only fetch and compare first; merge only with Diego's OK |
| Real texts reach non-consenting numbers | Replies only to people who texted first; practice texts only after LINK; STOP; kill switch; cap |

## 10. Open items and owners

- [ ] Diego: turn on Gemini billing with a budget alert of about $10.
- [ ] Diego: confirm D6 with Krishna; send him this plan.
- [ ] Krishna: Photon 2.0 project, webhook secret and line; is his iPhone registered?
- [ ] Diego: OK the B6 deploy (new Maincloud db and the Pages layout).
- [ ] Diego: team names and who narrates, for Devpost.
- [ ] Diego: the official track rules link, to check the pitch against.

## 11. Safety rules (unchanged)

- Agree with Diego before pushing to `main`, deploying (Pages, Maincloud or any host), wiping data, or force-pushing.
- Secrets live only in gitignored env files, set with `scripts/set-key.sh NAME`. Never paste, print or commit them.
- Don't text real phones except Diego's or Krishna's own verified numbers.
- Give every test an explicit AI-call budget.
