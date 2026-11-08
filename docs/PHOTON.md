# SafeSense by text (Photon): handoff for Krishna

**Goal:** someone texts a suspicious message to the SafeSense iMessage number and gets the same calm verdict as the web chat back. This is our entry for the **Best Use of Photon API** track.

- **Code:** built and tested locally with simulated signed webhooks.
- **Live database:** deployed, but switched off: it answers 503 until it has a webhook secret.
- **What's left:** the Photon dashboard setup, one real test from an iPhone, and your review of the safety rules.

Read [`docs/PLAN.md`](PLAN.md) first (sections 1–5 and B4) for the whole picture.

## How it works

```
iPhone ──text──▶ Photon shared line ──signed webhook (POST)──▶ SpacetimeDB route /photon
                                                                  │ verify signature, skip duplicates
                                                                  │ LINK / UNLINK / FORGET ME, or run the bot
iPhone ◀──reply── Photon REST API ◀──POST /v1/projects/{id}/messages─┘
```

- **Code:** `spacetimedb-ts/src/photon.ts`, in TypeScript. The header comment explains the security model.
- **Route:** `https://maincloud.spacetimedb.com/v1/database/safesense-1aa18263/route/photon`.
  - This is a webhook address for Photon. Opening it in a browser shows "no handler", which is expected.
- **Settings (module env):**
  - `PHOTON_WEBHOOK_SECRET` (`whsec_…`, from the webhook destination);
  - `PHOTON_API_KEY` and `PHOTON_PROJECT_ID`, which Diego already has;
  - optionally `PHOTON_BASE_URL`.
- **Senders:** each phone gets its own private stand-in identity until it texts `LINK <code>`. The code comes from the SafeSense web chat, and linking shares memory with the web chat. `UNLINK` and `FORGET ME` also work by text.
- **Screenshots:** sent to the AI and never stored. Each sender is allowed 8 AI replies per minute.

## The important limitation

On Photon's **free shared line**:
- **Only one registered sender** can reach the agent;
- the bot **can't send the first message**: the person has to text first.

So for the demo, the registered sender is your iPhone, and judges can't text it themselves. Say this honestly in the video and on Devpost. A dedicated line removes the limit.

## Setup steps (Photon dashboard: https://app.beta.photon.codes)

The project, API key and Maincloud database are **Diego's**: only he can publish to `safesense-1aa18263`. Either he adds you to the Photon project, or you do steps 1–2 together on a call.

1. **Register your iPhone as the sender.**
   - Open the project → **iMessage** → "Add the number you or your user will send from".
   - Enter your iMessage phone number; check it on the iPhone under Settings → Apps → Messages → Send & Receive.
   - Select **Add**, then **Assign a number from the shared pool**.
   - **Copy the assigned number**: that's SafeSense's number.
2. **Add the webhook.**
   - Open the project → **Webhooks** → **Add a destination**.
   - URL: `https://maincloud.spacetimedb.com/v1/database/safesense-1aa18263/route/photon`.
   - API version: the latest. Events: `message.received`, or all.
   - Save, then copy the **`whsec_…` signing secret**. It's shown only once.
3. **Diego stores the secret.** He runs `scripts/set-key.sh PHOTON_WEBHOOK_SECRET` (hidden prompt) on his laptop.
   - **Never paste the secret** into chat, a commit or a log.
   - Then Diego, or Claude with Diego's OK, republishes:
     `STDB_TS_SERVER=maincloud STDB_TS_DB=safesense-1aa18263 scripts/publish-ts.sh`.
4. **Put the number in the app.** Send the assigned number to Diego. It goes in `web/src/bot/config.ts` (`BOT_IMESSAGE_ADDRESS`) and on the SafeSense chat page.
5. **Real test from your iPhone:**
   1. Text the number: *Is this a scam? "USPS: your parcel is on hold, pay $1.99 at usps-redelivery.example"*. Expect a verdict, signs to notice and what to do.
   2. Send a screenshot of a scam text. Expect it to be read and judged.
   3. In the SafeSense web chat, get a link code, then text `LINK <code>`. Expect "linked"; the web chat then shows these messages as "via iMessage".
   4. Text `FORGET ME`. Expect your data to be deleted.
   5. If nothing arrives, check the **delivery logs** for the destination in Photon's dashboard and `spacetime logs --no-config -s maincloud safesense-1aa18263 -n 50`.

## Testing locally, without the real line

```sh
# one-time: SpacetimeDB CLI + local server (see CLAUDE.md), then:
spacetime start --listen-addr 127.0.0.1:3001 &
export PHOTON_WEBHOOK_SECRET=whsec_$(node -e "console.log(require('crypto').randomBytes(24).toString('base64'))")  # FAKE test secret
scripts/publish-ts.sh                                  # publishes spacetimedb-ts to local db safesense-local
node tools/photon-sim.mjs safesense-local --checks     # signed 200, unsigned/tampered/stale 401, duplicate skipped
node tools/photon-sim.mjs safesense-local "Is this real? Your Apple ID is locked, verify at apple-id-help.example"
spacetime logs --no-config -s local safesense-local -n 30
```

Replies to the phone can't leave a local server, but the logs show what the bot decided. Each bot turn costs one AI call, so keep tests few.

## Your review: safety rules from Safe Signal

Compare `spacetimedb-ts/src/photon.ts` with your `guard.ts` (`git show combined:safe-signal/src/lib/guard.ts`) and add what's missing:

- [ ] `STOP` (and your stop words) opts a number out; nothing is sent to it afterwards
- [ ] a kill-switch env var (e.g. `PHOTON_SENDING_ENABLED=false`) stops all outgoing messages
- [ ] the bot only ever replies to someone who texted first (true on the shared line; keep it true in code)
- [ ] a per-number daily cap on outgoing messages

**Stretch, if time allows: practice texts** (your drill idea). A linked user taps "Send me a practice text" on the web. SafeSense texts them one realistic fake scam (fictional brand, safe link), and they reply `REPORT`. The coach records whether they caught it. Limits: one per day, three in total, `STOP` honoured. It can reuse your scam scenarios (`combined:safe-signal/data/scam-archetypes.json`).

## Working rules

- Work on a branch from `safesense` and tell Diego before pushing. Never push to `main` or `web-app` for this.
- Secrets only through `scripts/set-key.sh`, never in chat, commits or logs.
- Only text your own phone or Diego's.
