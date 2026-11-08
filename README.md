# SafeSense

**Pause. Check. Then act.** A calm place to practice spotting scams, and to ask when something doesn't feel right.

**Live:** https://diejor.github.io/hackathon/ (works on a phone; no sign-up).
The team's earlier prototype, the Security Arcade, is still up at https://diejor.github.io/hackathon/arcade/.

## What it is

SafeSense is for people who feel unsure about scams, often older adults. It has no scores to chase,
no timers and no pressure, and it has a text-size control.

- **Three short games.** *Fraudle* (guess the scam word, with a one-line lesson each time), *Scam or Not?*
  (real-looking texts: decide, then see why) and *Role Reversal*, where **you play the scammer** and see how a
  careful person spots each move (game design adapted from teammate Krishna's BadScam). The people and
  companies in the games are made up.
- **The SafeSense assistant** is an AI. Type a message that worries you, say it, or add a screenshot. It
  replies with a verdict, the signs to notice and what to do next. It remembers what you struggle with in
  the games and coaches you on it. It gives guidance, not guarantees.
- **Your progress.** Every finished game earns 1 point (a 4th game, *The Phone Call*, shows as locked until
  10 points; it's a "coming soon" placeholder). There are no accounts: a recovery key carries your progress to
  another device.
- **SafeSense by text.** Forward a suspicious text over iMessage (via Photon) and get the same calm verdict
  back. Reply `PRACTICE` for a clearly labeled fake scam text to practice on (opt-in, 1 a day, `REPORT` to
  answer, then a debrief). Honest limit: on Photon's free shared line only **one registered sender** can reach it, so for the
  demo that's a teammate's iPhone; judges can't text it themselves. A dedicated line removes the limit.

SafeSense is meant as a companion to T-Mobile's Scam Shield: Scam Shield blocks quietly at the network
level, and SafeSense teaches people and covers what reaches them anyway (screenshots from any app,
iMessage). It is not affiliated with or endorsed by T-Mobile.

## Hackathon tracks (HackUTD 2026)

| Track | How SafeSense addresses it |
| --- | --- |
| **T-Mobile Safe Signal** | Teaches people to recognize scams through practice instead of fear, and gives a second opinion on anything that slips past network filtering. Positioned as a Scam Shield companion. |
| **Best Use of Photon API** | "SafeSense by text": Photon 2.0 signed webhooks are verified (HMAC-SHA256, Standard Webhooks) and handled inside the database, replies go out through Photon's REST API, and `LINK <code>` joins a phone to the same memory as the web chat. |
| **MLH Best Use of Gemini API** | Gemini (`gemini-3.5-flash`, through the OpenAI-compatible API) reads text and screenshots (vision), answers in a strict JSON schema (verdict, signs, next steps, memory facts), uses each person's game history to coach them, treats pasted content as data with prompt-injection rules, and falls back to `gemini-3.5-flash-lite` when the main model is overloaded. |

## Architecture

```
 Phone or laptop browser                         iPhone (Messages)
 safesense/ React app on GitHub Pages                  │ text SafeSense
   games ── log_activity ──┐                           ▼
   assistant ── bot_send ──┤ WebSocket      Photon 2.0 ── signed webhook ──┐
                           ▼                                               ▼
        SpacetimeDB on Maincloud, db safesense-1aa18263 (TypeScript module, spacetimedb-ts/)
          private tables + per-user views · procedures (AI calls) · HTTP route /photon
                           │ outbound HTTPS
                           ▼
              Google Gemini API            Photon REST API (replies)
```

There is no other server: the database is the backend. Identity is the SpacetimeDB identity whose token
is kept in the browser (that token is the recovery key).

| Folder | What's in it |
| --- | --- |
| `safesense/` | The product's frontend: React 19 + Vite, hash router. Designer's files plus our additions in `src/lib`, `src/components`, `src/content` |
| `spacetimedb-ts/` | The TypeScript SpacetimeDB module: `bot.ts` (assistant, memory, Forget me), `ai.ts` (Gemini client, fallback, rate limits), `activity.ts` (game history, coaching summary), `photon.ts` (iMessage), `crypto.ts` (HMAC/Ed25519 via `@noble`), `schema.ts` (all tables) |
| `web/src/bot/` | Assistant data layer (connection, subscriptions, voice) that SafeSense uses through `safesense/src/lib/stdb.ts` |
| `docs/` | [`PLAN.md`](docs/PLAN.md) (product, decisions, roadmap), [`PHOTON.md`](docs/PHOTON.md) (iMessage setup), `content/messages.json` (scam message bank, fictional brands), `research/` |
| `tools/` | `phone.mjs` (headless phone tester), `photon-sim.mjs` (simulated Photon webhooks) |
| `scripts/` | Publish, key and deploy scripts (below) |
| Legacy | `spacetimedb/` (C# module the TS one was ported from), `web/` (Security Arcade UI), `client/` (Unity client). See [`docs/LEGACY.md`](docs/LEGACY.md) |

| Branch | Role |
| --- | --- |
| `safesense` | The product; all current work |
| `design-vendor` | The designer's files as delivered, merged into `safesense/` |
| `combined`, `main` | Archives (Krishna's earlier Next.js app; the Security Arcade) |

## Privacy and safety

- **What's stored:** chat messages, what the assistant remembers about you, and your game history, in
  **private tables**. Each person sees only their own rows through per-user views (`my_messages`,
  `my_facts`, `my_activity`). Identity comes only from the server (`ctx.sender`).
- **Gemini reads your messages** in order to answer. Screenshots are sent to the model and **never stored**;
  only a short note of what they said is kept.
- **Forget me** deletes your chat, the assistant's memory, your game history and any linked phone.
- **Prompt injection:** pasted text and screenshots are wrapped in delimiters and treated as data. Text
  that tries to instruct an AI is flagged to you as suspicious; an ordinary scam is still judged as a scam.
  Memory facts are filtered so secrets aren't saved.
- **Limits:** one AI call per person every 3 seconds on the web, 8 per minute per texting sender. Photon
  and Discord webhooks are signature-checked, deduplicated and rejected after 5 minutes.
- **Games use fictional brands**, `.example` domains and 555 numbers. No messages or money are ever sent.
- **Practice texts** (a fake scam text to your own linked phone) are opt-in, use fictional brands and no links,
  are limited to 1 a day and 3 in total, and STOP/START are honored. A kill switch (`PHOTON_SENDING_ENABLED`)
  turns off everything except replies.

## Run it locally

Prerequisites: Node 20+, the [SpacetimeDB CLI](https://spacetimedb.com/install) 2.14.x, and a Gemini API key.

```sh
spacetime start --listen-addr 127.0.0.1:3001     # local server (CLI nickname `local` points here)
scripts/set-key.sh AI_API_KEY                    # hidden prompt; saved to the gitignored .env
scripts/publish-ts.sh                            # builds spacetimedb-ts/ and publishes db safesense-local
cd safesense && npm ci
VITE_STDB_SERVER=ws://127.0.0.1:3001 VITE_STDB_DB=safesense-local npx vite
```

Any build also accepts `?server=...&db=...` in the URL. Other module settings (`AI_MODEL`,
`AI_FALLBACK_MODEL`, `PHOTON_WEBHOOK_SECRET`, ...) are listed in [`docs/PLAN.md`](docs/PLAN.md) §5 and set the
same way with `scripts/set-key.sh NAME`. Never commit or print secrets.

**Deploy** (project lead only):
- Module: `STDB_TS_SERVER=maincloud STDB_TS_DB=safesense-1aa18263 scripts/publish-ts.sh` (never `-c` on Maincloud).
- Site: `scripts/deploy-safesense.sh` builds `safesense/` against the Maincloud db, keeps the old arcade under `arcade/`,
  checks the result and publishes it to GitHub Pages (`--dry-run` to only assemble). `scripts/deploy-pages.sh` now refuses
  to run without an explicit build dir, so it can't replace SafeSense with the arcade by accident.

**Testing tools:**
- `node tools/phone.mjs <url> <outDir> <profileDir> <port> wait:4000 shot:home ...` drives headless Chromium as a
  phone (touch, typing, file upload, screenshots). Use a fresh profile dir per simulated person.
- `node tools/photon-sim.mjs safesense-local --checks` sends signed, unsigned, tampered, stale and duplicate
  webhooks to a local db; with a message instead of `--checks` it runs one bot turn. Use a fake `whsec_` secret
  and never point it at Maincloud. Details in [`docs/PHOTON.md`](docs/PHOTON.md).

## Facts we cite

- In 2024, people reported **$470 million** in losses to scams that started with a text. The top five were fake
  package delivery, fake jobs, fake fraud alerts, unpaid tolls and wrong numbers.
  [FTC Data Spotlight, April 2025](https://www.ftc.gov/news-events/data-visualizations/data-spotlight/2025/04/top-text-scams-2024)
- Malwarebytes tracked "more than 1,000 closely related campaign templates" in a carrier rewards-points texting
  scam, monitored since early May 2026 (no victim or loss count given).
  [Malwarebytes, 2026-09-17](https://www.malwarebytes.com/blog/threat-intel/2026/09/t-mobile-rewards-points-expiry-texts-are-a-phishing-scam)
- In a smishing campaign targeting US telecom customers, the scammers used genuine carrier links, with copies
  aimed at AT&T and Verizon customers.
  [Whalebone](https://www.whalebone.io/post/tracking-a-smishing-campaign-targeting-us-telecom-customers)

## Roadmap

For now, points are computed in the browser from the activity stored in SpacetimeDB, and there are no
unlockable games yet. Next, in order:

1. **Server-side profile:** a `player_profile` table and `my_profile` view, with points awarded on the server
   in `log_activity` so the web and iMessage count the same.
2. **Optional sign-in with SpacetimeAuth** (email, Google), with "bring my progress" from the anonymous identity.
3. **Unlockable games:** a catalog with point costs and more games.
4. **Partner insights:** anonymous aggregates only (which tricks still work, whether practice lowers the miss
   rate), with groups under 5 hidden.
5. **Practice texts over Photon** (Krishna's drill idea), opt-in only, plus a dedicated line so anyone can text SafeSense.

## Team and credits


Made by the SafeSense team at HackUTD 2026:

- **Diego Rodrigues**: project lead; assistant and backend.
- **Krishanth Sentil**: game design (BadScam, now Role Reversal), scam research, Photon practice texts.
- **Emily Yuan**: product design and UI (the SafeSense design).

Built with [Claude Code](https://claude.com/claude-code). Powered by [SpacetimeDB](https://spacetimedb.com),
[Google Gemini](https://ai.google.dev) and [Photon](https://photon.codes). Icons: [Lucide](https://lucide.dev).

## Legacy

<details>
<summary>Security Arcade, Help Bot (C#) and Unity client notes</summary>

Before SafeSense, this repo held the **Security Arcade** (multiplayer phone games in Phaser on a C#
SpacetimeDB module, db `hackathon-1aa18263`, still live at `/arcade/`) and a Unity 6 + Rish client. The
assistant started there as the "Help Bot" and was ported to TypeScript with the same names.

Everything still useful is in [`docs/LEGACY.md`](docs/LEGACY.md): the arcade's lobby and security model,
the `log_activity` contract and `bot.ts` API, Discord setup, C# build scripts, and the Unity/Rish gotchas.
The most common trap: the C# scripts publish the **unoptimized** wasm (`-b`) because system `wasm-opt`
(binaryen v133) emits wasm the spacetime CLI can't parse.

</details>
