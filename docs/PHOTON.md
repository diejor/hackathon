# SafeSense by text (Photon): handoff for Krishna

**Goal:** someone texts a suspicious message to the SafeSense iMessage number and gets the same calm verdict as the web chat back. This is our entry for the **Best Use of Photon API** track.

- **Code:** built and tested locally with simulated signed webhooks, including the safety guards (kill switch, STOP/START, a daily cap).
- **Web:** the SafeSense chat page has a "Text SafeSense" card (number, **Link my phone**, Unlink). It stays hidden until the number is set.
- **Live database:** deployed, but switched off: it answers 503 until it has a webhook secret. The guards reach Maincloud with the next republish.
- **What's left:** the Photon dashboard setup, one real test from an iPhone, and the steps under "Going live" below.

Read [`docs/PLAN.md`](PLAN.md) first (sections 1–5 and B4) for the whole picture.

## How it works

```
iPhone ──text──▶ Photon shared line ──signed webhook (POST)──▶ SpacetimeDB route /photon
                                                                  │ verify signature, skip duplicates
                                                                  │ LINK / UNLINK / FORGET ME, or run the bot
iPhone ◀──reply── Photon REST API ◀──POST /v1/projects/{id}/messages─┘
```

- **Code:** `spacetimedb-ts/src/photon.ts`, in TypeScript. The header comment explains the security model. The outbound guards are in `spacetimedb-ts/src/photon-guards.ts`.
- **Route:** `https://maincloud.spacetimedb.com/v1/database/safesense-1aa18263/route/photon`.
  - This is a webhook address for Photon. Opening it in a browser shows "no handler", which is expected.
- **Settings (module env):**
  - `PHOTON_WEBHOOK_SECRET` (`whsec_…`, from the webhook destination);
  - `PHOTON_API_KEY` and `PHOTON_PROJECT_ID`, which Diego already has;
  - optionally `PHOTON_BASE_URL`;
  - optionally `PHOTON_SENDING_ENABLED`, the kill switch (see below).
- **Senders:** each phone gets its own private stand-in identity until it texts `LINK <code>`. The code comes from the SafeSense web chat, and linking shares memory with the web chat. `UNLINK` and `FORGET ME` also work by text.
- **Screenshots:** sent to the AI and never stored. Each sender is allowed 8 AI replies per minute.

## Safety guards (built)

Every outgoing reply goes through one function, `deliver()` in `photon.ts`, which checks these first. The bot only ever replies to a text it just received. The one exception is a practice text the linked person asked for (below), which goes through `deliverProactive()` with the same checks.

- **Kill switch, `PHOTON_SENDING_ENABLED`:**

  | Value | Replies to an incoming text | Proactive sends (practice texts) |
  |---|---|---|
  | not set (or empty) | sent | not sent |
  | `true` | sent | sent |
  | anything else (`false`, `off`, ...) | **not sent** | not sent |

  With sending off, webhooks are still verified, deduplicated and acknowledged, and `LINK`, `UNLINK`, `FORGET ME` and `STOP` still take effect. No AI call is made for a reply nobody would get.
  - Turn it off without rebuilding: `PHOTON_SENDING_ENABLED=false spacetime publish --no-config -s maincloud --env-only -y safesense-1aa18263`.
  - Back to the default: `spacetime publish --no-config -s maincloud --env-only --unset-env PHOTON_SENDING_ENABLED -y safesense-1aa18263`.
  - Publishing keeps env values you don't pass, so a value stays set until you change or unset it.
- **STOP:** `STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END` or `QUIT` (the whole message, any case) opts that phone out. It gets one reply, "You won't get messages from SafeSense. Text START to turn them back on.", and then nothing: no AI call, nothing stored. `FORGET ME` still deletes their data, silently. Private table `channel_optout`.
- **START** removes the opt-out and says so.
- **Daily cap:** at most 30 messages to each phone per day (UTC). The 30th reply ends with "That's my last reply for today". After that, silence until the next day. Only the STOP confirmation can go over the cap. Private table `channel_send_daily`.
- **For practice texts:** a successful `LINK` saves the Photon chat id (`spaceId`) and our line's user id in the private table `channel_reach`. No phone number is stored. `UNLINK`, `FORGET ME` and the web's Unlink delete it. `proactiveTarget()` in `photon-guards.ts` returns where to send, or why not: it needs the kill switch at `true`, a live link, no opt-out and room under the cap.
- **Schema:** these are 3 new tables and 1 new optional env var; no existing table changed. Republishing over the existing database worked locally without wiping data.

## Practice texts

Krishna's drill idea, built into the module (`spacetimedb-ts/src/practice.ts`). A linked person asks for a practice text, and SafeSense texts their iPhone one realistic fake scam a minute or two later. If they reply `REPORT`, they caught it. Either way they get a short debrief, and the result shows up in their progress.

**How it works:**
1. **Ask:** on the SafeSense chat page, the "Text SafeSense" card shows **Send me a practice text** once an iMessage phone is linked (reducer `request_practice_text`). Or text `PRACTICE` from the linked phone.
2. **Send:** a scheduled job (`practice_job`) fires 60–120 s later and sends the text through Photon, with the practice id as the idempotency key.
3. **Grade:** the next reply from that phone within 2 hours is checked before the normal bot turn. No AI is used.
   - `REPORT`, `scam`, `spam`, `fake` or `phishing` (the whole message) counts as **caught**: "Nice catch! … What gave it away: • … Tip: …".
   - `YES`, `Y`, `OK`, `PAY`, `CONFIRM`, a 4–8 digit number, card-like digits or "I'll pay" counts as **fooled**: "That was a SafeSense practice text — no harm done. Here's what to watch for: … Next time: …". The reply itself isn't stored.
   - Anything else gets a normal bot answer, and the practice text stays open. After 2 hours it expires.
   - The result is logged as game `practice-text`, `answer_correct` or `answer_wrong`, with `{template, tactic}`. The coach and the profile count it like a Scam or Not? answer.
4. **Which scam:** the tactic they miss most in the games, if there's a template for it; otherwise one they haven't had yet.

**The texts:** 8 templates with fictional brands (Parcelo, SwiftShip, TollPay, GlacierBank, Meridian Trust, BrightLine Mobile, StreamNest, BrightNet), `.example` addresses shown as plain text and 555-01xx numbers. Each is at most 320 characters and ends with "(SafeSense practice — reply REPORT if you think it's a scam)". No real links, and no text asks anyone to read out or send a code. Krishna's `code_relay` template was left out for that reason.

**Limits and guards:**
- 1 practice text a day (rolling 24 h) and 3 in total per person. A text that couldn't be sent doesn't count.
- Sending needs `PHOTON_SENDING_ENABLED` = `"true"`. With it unset, replies still work, but practice texts are refused ("switched off right now").
- It also needs a linked iPhone (saved at `LINK`), no `STOP`, and room under the 30-a-day cap. These are checked when it's asked for and again when it's sent.
- `UNLINK`, `FORGET ME` and the web's Unlink and Forget me delete the person's practice rows and queued jobs.
- **Schema:** 2 new private tables, `practice_send` and `practice_job`, plus the view `my_practice_texts`. No existing table changed, so Maincloud republishes without a wipe; this was tested locally by upgrading a database built from `safesense`.

**Shared line:** Photon only lets the line message the registered iPhone after it has texted the line. If the send is refused (for example 403 `SHARED_LINE_INBOUND_REQUIRED`), the practice row is marked `failed` and the logs say why. Text the line once (anything, or `PRACTICE`), then ask again.

**Demo:**
1. Republish with `PHOTON_SENDING_ENABLED=true` (see "Going live").
2. Link the iPhone (`LINK <code>`), then select **Send me a practice text** (or text `PRACTICE`).
3. Wait about a minute for the text, reply `REPORT`, and show the debrief and the card's "You caught the last one".
4. To demo again on the same day, the database owner can clear the limits:
   `spacetime sql --no-config -s maincloud safesense-1aa18263 "DELETE FROM practice_send"`.

**Testing locally:** follow "Testing locally" below with `PHOTON_SENDING_ENABLED=true` exported. Use `spacetime call --no-config -s local <db> create_link_code` and read the code with `spacetime sql … "SELECT code FROM link_code"`, then sim `LINK <code>` and `spacetime call … request_practice_text`. The job's log line shows the rendered text. A local send always fails, so the row ends `failed`. To test grading, mark it sent with `spacetime sql … "UPDATE practice_send SET status = 'pending'"`, then sim `REPORT` or `YES`.

## The important limitation

On Photon's **free shared line**:
- **Only one registered sender** can reach the agent;
- the bot **can't send the first message**: the person has to text first.

So for the demo, the registered sender is your iPhone, and judges can't text it themselves. Say this honestly in the video and on Devpost. A dedicated line removes the limit.

## Going live (Diego's steps)

Photon dashboard: https://app.beta.photon.codes

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
   - Then Diego, or Claude with Diego's OK, republishes (this also brings the guards and their 3 new tables; no wipe):
     `STDB_TS_SERVER=maincloud STDB_TS_DB=safesense-1aa18263 scripts/publish-ts.sh`.
   - `PHOTON_SENDING_ENABLED`: leave it unset for replies only. To demo practice texts, publish with `PHOTON_SENDING_ENABLED=true` (prefix the command above with it).
4. **Put the number in the app.** Set `BOT_IMESSAGE_ADDRESS` in `web/src/bot/config.ts` to the assigned number, e.g. `"+1 555 123 4567"`. That shows the "Text SafeSense" card on the SafeSense chat page and "Link iMessage" in the arcade's Help Bot.
   - Then build and deploy the SafeSense site as usual.
5. **Real test from your iPhone:**
   1. Text the number: *Is this a scam? "USPS: your parcel is on hold, pay $1.99 at usps-redelivery.example"*. Expect a verdict, signs to notice and what to do.
   2. Send a screenshot of a scam text. Expect it to be read and judged.
   3. In the SafeSense web chat, select **Link my phone** on the "Text SafeSense" card, then text `LINK <code>`. Expect "Linked!"; the card then shows "Linked: iMessage", and the chat shows your texts.
   4. Text `STOP`. Expect one confirmation; a text after that gets no answer. Text `START` to turn replies back on.
   5. Text `FORGET ME`. Expect your data to be deleted.
   6. If nothing arrives, check the **delivery logs** for the destination in Photon's dashboard and `spacetime logs --no-config -s maincloud safesense-1aa18263 -n 50`.

## Testing locally, without the real line

```sh
# one-time: SpacetimeDB CLI + local server (see CLAUDE.md), then:
spacetime start --listen-addr 127.0.0.1:3001 &
export PHOTON_WEBHOOK_SECRET=whsec_$(node -e "console.log(require('crypto').randomBytes(24).toString('base64'))")  # FAKE test secret
export STDB_TS_DB=photon-test                          # a throwaway db (or leave unset for safesense-local)
scripts/publish-ts.sh
node tools/photon-sim.mjs photon-test --checks         # PASS/FAIL per check; exits 1 on any failure
node tools/photon-sim.mjs photon-test "Is this real? Your Apple ID is locked, verify at apple-id-help.example"
spacetime logs --no-config -s local photon-test -n 30
spacetime delete --no-config -s local photon-test -y   # clean up
```

`--checks` sends only commands from fresh random senders, so it makes **no AI calls**. It covers:
- signatures: signed 200, duplicate skipped, unsigned / tampered / stale 401;
- STOP: one confirmation, then silence for texts, commands and a second STOP;
- START: replies again;
- daily cap: replies 1–29, the 30th marked "last today", the 31st silent, and STOP still confirmed when capped.

For signed requests, the webhook's 200 body says what happened (`ok: sent`, `ok: send failed`, `ok: silent (opted out)`, `ok: skipped (sending disabled)`, ...). A local server refuses outgoing requests to private addresses and can't reach a real phone, so locally every attempted reply reads `send failed`; the logs and the `chat_message` table show what the bot decided. To check the kill switch, publish with `PHOTON_SENDING_ENABLED=false` and expect `skipped (sending disabled)`. Each normal text costs one AI call, so keep those few.

## Your review: safety rules from Safe Signal

Compare `spacetimedb-ts/src/photon.ts` with your `guard.ts` (`git show combined:safe-signal/src/lib/guard.ts`) and add what's missing:

- [x] `STOP` (and your stop words) opts a number out; nothing is sent to it afterwards
- [x] a kill-switch env var (`PHOTON_SENDING_ENABLED=false`) stops all outgoing messages
- [x] the bot only ever replies to someone who texted first (true on the shared line; kept true in code)
- [x] a per-number daily cap on outgoing messages (30 a day)

**Full spec for the guards and practice texts:** [`docs/KRISHNA-PUSH-ANALYSIS.md`](KRISHNA-PUSH-ANALYSIS.md) §3 ("Practice texts in our module"), built from your own `templates.js` and safety rules.

**Practice texts** (your drill idea) are built: see "Practice texts" above.

## Working rules

- Work on a branch from `safesense` and tell Diego before pushing. Never push to `main` or `web-app` for this.
- Secrets only through `scripts/set-key.sh`, never in chat, commits or logs.
- Only text your own phone or Diego's.
