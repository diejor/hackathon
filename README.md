# SafeSense

**Pause. Check. Then act.** A calm place to practice spotting scams, and to ask when something doesn't feel right.

**Live:** https://diejor.github.io/hackathon/ (works on a phone; no sign-up). HackUTD 2026.

## What it does

SafeSense is for people who feel unsure about scams, often older adults. No timers, no pressure, a text-size
control, and plain language throughout.

| Part | What you do |
|---|---|
| **Fraudle** | Guess the scam word from a clue in six tries; every word comes with a one-line lesson. |
| **Scam or Not?** | Realistic texts from made-up companies: decide, then see the signs. Some are genuine, so it also teaches not to panic. |
| **Role Reversal** | *You* play the scammer. Pick tactics, watch a careful person take them apart, then a debrief turns each trick into a defense. |
| **The Phone Call** | Unlocks at 2 points. SafeSense rings your phone with a practice scam call (Retell voice agent). Private beta: invited numbers only. |
| **Chat with us** | The SafeSense assistant (Google Gemini) checks a message you type, say or screenshot: a verdict, the signs, what to do next. It remembers what you miss in the games. It's an AI and says so: guidance, not guarantees. |
| **Text SafeSense** | Forward a suspicious text over iMessage (Photon) to **+1 (628) 316-6196** and get the same verdict back. Text `PRACTICE` for a labeled fake scam to practice on; reply `REPORT` if you spot it. |

**Points:** every finished game is +1. A practice text or call is the real test: catch it for +1, get fooled
and lose 1 (never below 0). Once a game unlocks it stays unlocked. No accounts: a recovery key on the progress
page carries your progress to another device, and `LINK <code>` connects your phone's texts to the same memory.

SafeSense is meant as a companion to T-Mobile's Scam Shield: Scam Shield blocks at the network; SafeSense
teaches people and covers what reaches them anyway. Not affiliated with or endorsed by T-Mobile.

## Hackathon tracks

| Track | How SafeSense addresses it |
| --- | --- |
| **T-Mobile Safe Signal** | Practice instead of fear, plus a second opinion on anything that slips past network filtering. |
| **Best Use of Photon API** | Signed Photon 2.0 webhooks handled *inside the database*, replies in ~3 s, `LINK` codes, opt-in practice texts graded by reply (`REPORT` = caught), STOP/START, caps and a kill switch. |
| **MLH Best Use of Gemini API** | Gemini reads text and screenshots, answers in a strict JSON schema, coaches from each person's game history, treats pasted content as data (prompt-injection rules), and falls back from flash to flash-lite. |

## Architecture

```
 Phone or laptop browser                               iPhone (Messages)            Phone (voice)
 safesense/ (React 19 + Vite, GitHub Pages)                  │ text SafeSense              ▲ practice call
   games ── log_activity ──┐                                 ▼                             │
   chat ──── bot_send ─────┤ WebSocket          Photon 2.0 ── signed webhook ──┐     Retell AI agent
   Call me ─ start_challenge_demo ┐                                           ▼          ▲      │ signed result
                           ▼      ▼                                                      │      ▼
        SpacetimeDB on Maincloud, db safesense-1aa18263 (TypeScript module, spacetimedb-ts/)
          private tables + per-user views · procedures with outbound HTTPS · scheduled jobs
          HTTP routes: /photon · /challenge-response · /voice/context · /voice/result
                           │
                           ▼
              Google Gemini API · Photon REST API · Retell API
```

There is no other server: the database is the backend. Identity is the SpacetimeDB identity whose token is
kept in the browser (that token is the recovery key).

| Folder | What's in it |
| --- | --- |
| `safesense/` | The app: React 19 + Vite, hash router. Emily's design; our wiring in `src/lib`, `src/components`, `src/content` |
| `spacetimedb-ts/` | The backend module: `bot.ts` (assistant, memory, Forget me), `ai.ts` (Gemini), `activity.ts` (game history), `photon.ts` + `practice.ts` (iMessage, practice texts), `challenge.ts` + `voice.ts` (practice calls), `crypto.ts`, `schema.ts` |
| `web/src/bot/` | Assistant data layer (connection, subscriptions, voice input) used through `safesense/src/lib/stdb.ts` |
| `docs/` | [`PLAN.md`](docs/PLAN.md), [`PHOTON.md`](docs/PHOTON.md) (iMessage), [`VOICE.md`](docs/VOICE.md) (calls), [`PITCH.md`](docs/PITCH.md), [`DEVPOST.md`](docs/DEVPOST.md), [`HANDOFF.md`](docs/HANDOFF.md) |
| `tools/` | `phone.mjs` (headless phone tester), `photon-sim.mjs`, `voice-sim.mjs`, `call-sim.mjs` (signed-webhook simulators for local testing) |

## Safety invariants

The texts and calls reach real phones, so these are enforced in the backend, not just promised:

| # | Rule | Where it lives |
|---|---|---|
| 1 | Calls only go to invited numbers (`CHALLENGE_ALLOWED_NUMBERS`), max 10 a day overall and 3 per number | `challenge.ts` `startChallengeDemo` |
| 2 | Practice texts only go to a phone that texted the line first, max 1 a day (3 a day before linking) | `practice.ts` |
| 3 | Kill switch: nothing proactive goes out unless `PHOTON_SENDING_ENABLED=true` | `photon-guards.ts` |
| 4 | STOP / START honored with one confirmation, 30 replies per phone per day | `photon-guards.ts` |
| 5 | Fictional brands, `.example` domains, 555 numbers, no links; every practice text ends with a "SafeSense practice" label | `practice.ts` templates |
| 6 | No free AI text on the send path: practice texts come from fixed templates | `practice.ts` `renderPractice` |
| 7 | Every webhook is signed and checked (Photon HMAC, Retell signature), deduplicated, and rejected after 5 minutes | `photon.ts`, `challenge.ts`, `voice.ts` |
| 8 | No phone numbers stored at rest (only salted hashes); API keys only in the database environment, never in the website | `voice.ts`, `challenge.ts`, `schema.ts` |
| 9 | Private tables; each person sees only their own rows; screenshots are never stored; Forget me deletes everything | `schema.ts`, `bot.ts` |

## Run it locally

Prerequisites: Node 20+, the [SpacetimeDB CLI](https://spacetimedb.com/install) 2.14.x, and a Gemini API key.

```sh
spacetime start --listen-addr 127.0.0.1:3001     # local server (CLI nickname `local` points here)
scripts/set-key.sh AI_API_KEY                    # hidden prompt; saved to the gitignored .env
scripts/publish-ts.sh                            # builds spacetimedb-ts/ and publishes db safesense-local
cd safesense && npm ci                           # also installs web/ (the site imports web/src/bot)
VITE_STDB_SERVER=ws://127.0.0.1:3001 VITE_STDB_DB=safesense-local npx vite
```

**Just the website, no local server:** point it at the live database instead (your browser gets its own
identity there, so it's safe for clicking around; chat questions use the real Gemini key):

```sh
cd safesense && npm ci
VITE_STDB_SERVER=wss://maincloud.spacetimedb.com VITE_STDB_DB=safesense-1aa18263 npx vite
```

If the build fails with `Property 'reducers' does not exist on type 'DbConnection'`, `web/` is missing its
packages: run `npm ci` in `web/` (newer checkouts do this automatically).

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

1. **Verify-your-number for calls:** text a code to the number before SafeSense may call it, so The Phone Call can open beyond invited numbers.
2. **Personalized calls:** the voice agent already can fetch the tricks a person misses (`/voice/context`); wire it into the agent's prompt.
3. **Server-side points** awarded in `log_activity`, so the web, iMessage and calls count the same, and history trimming never drops points.
4. **Optional sign-in** (SpacetimeAuth), with "bring my progress" from the anonymous key.
5. **A dedicated Photon line,** so anyone can text SafeSense, not one registered phone.
6. **Partner insights:** anonymous aggregates (which tricks still work), groups under 5 hidden.

## Team and credits


Made by the SafeSense team at HackUTD 2026:

- **Diego Rodrigues**: project lead; assistant and backend.
- **Krishanth Sentil**: game design (BadScam, now Role Reversal), scam research, practice texts and the Retell practice call (The Phone Call), the mascot.
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
