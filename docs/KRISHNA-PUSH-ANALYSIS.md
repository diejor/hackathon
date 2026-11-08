# Analysis of Krishna's push `8f415eb` (origin/web-app)

Analysed 2026-11-08 ~00:45 CST. Read-only: his games and server were run locally without keys, with no AI or Photon calls. Screenshots are in the coordinator's scratch folder `k2/`.

**Bottom line:** don't merge his branch. Bring in his **content**, his **safety rules** (as the "practice texts" feature inside `spacetimedb-ts/`) and his **research** (for the pitch). Skip his hub, coins, Express/OpenAI server, Photon sender and the GPL-licensed Wordle code.

## Recommendation

| Piece | Verdict | Destination | Effort |
|---|---|---|---|
| Friend or Fraud? items: lookalike host, transfer-code swap, code you requested, partial refund, toll receipt | Adapt, rebranded away from T-Mobile | `safesense/src/content/scamOrNot.ts` | 30–40m |
| BadScam story and lessons | Adapt as a 3rd Long Con story, `parcel-fee-smish` | `safesense/src/content/longCon.ts` | 45–60m |
| Wordle words, hints and lessons | Take the words only | `safesense/src/content/fraudle.ts` | 15m |
| Wordle code and its GPL licence, the hub, coins and T-Life branding, the Express/OpenAI server, `photonSend` and the code-by-text flow | Skip | — | — |
| Kill switch, STOP, send cap, `[Practice]` prefix, no links | Bring in | `spacetimedb-ts/src/photon.ts` plus new tables in `schema.ts` | 60–90m |
| `templates.js` | Adapt; drop `code_relay` | new `spacetimedb-ts/src/practice.ts` | 20m |
| Prompt rules: read a web address from the right; a number in a message belongs to whoever wrote it; losing service after an unexpected SIM-change notice | Bring in | `spacetimedb-ts/src/bot.ts` (`BotSystemPrompt`) | 10m |
| FTC $470M, Malwarebytes 1,000+ templates, Whalebone genuine links | Pitch only | Devpost / README | 15m |

## 1. Inventory

The commit adds 25 files and 4,199 lines; 1,157 are `package-lock.json` and 674 are the GPL text. It sits on his older Next.js app, which this commit doesn't change.

| Part | What it does | Quality |
|---|---|---|
| Hub (`mini-games/index.html`, `hub.js`, `hub.css`) | A "SAFE SIGNAL × T-Life" landing page: 3 game cards, a "T-LIFE COINS" wallet, a booster panel (Analyze → code → Send) and a profile/ledger. Calls localhost:5050. | Clean vanilla JS. The booster panel is dead without his server. **Uses T-Mobile's real "T-Life" app name** |
| `shared/coins.js`, `shared/profile.js` | A browser-only coin wallet and session log | Overlaps our points |
| BadScam | You play the scammer across 9 scenes; simulated victims react; a debrief turns each tactic into a defense | The best writing in the push. Same concept as our Long Con |
| Friend or Fraud? | 6 texts with an "Inspect" evidence button, then why, what to do and a source link | Good legit items. **3 of 6 use T-Mobile as the sender**, including a scam that impersonates T-Mobile |
| Scam Wordle | 34 words with hints and lessons | CSS copied from a tutorial (§4). Same concept as Fraudle |
| `server/` | Express. `/api/analyze`: gpt-4o-mini picks one of 5 templates. `/api/otp/*`: texts a code to a typed number. `/api/send`: sends through `photonSend`. `/tap/:token`: a debrief page | Good safety design, flawed implementation |
| `T-Mobile-Scam-Research.md` | A customer field guide plus game-design research | Careful and well hedged |

**Server bugs:**
- **CORS:** it throws when `ALLOWED_ORIGIN` is empty, and is open to every site if `file://` is in it, which is the example default.
- **Texts any number:** `/api/otp/request` texts any typed number, limited only to 5 per 10 minutes per IP. That invites spam and SMS-cost abuse.
- **Weak code:** it's generated with `Math.random`.
- **Unreachable debrief:** no link is ever put in the text, so `/tap/:token` never opens.
- **Unsafe template:** `code_relay` tells people to read out their real 6-digit code.
- **No expiry, no STOP:** sessions live in memory and never expire, and the README's claim that Photon handles STOP is false for iMessage.

## 2. Photon

- **His call:** `POST $PHOTON_API_URL` with `{to, body}`.
- **The real Photon 2.0 call:** `POST https://api.photon.codes/v1/projects/{id}/messages` with Bearer and Idempotency-Key headers and body `{spaceId, senderId, content:{type:'text',format:'plain',text}}`. Those fields are required and no others are allowed.

**Why it fails:**
- **The payload is wrong:** `{to, body}` gets 400 or 422.
- **No new chats on the free line:** starting a conversation needs a dedicated line.
- **The shared line only replies:** it reaches only the assigned sender, and only after that sender has texted first (403 `SHARED_LINE_INBOUND_REQUIRED`).

**So his text-a-code flow can't work on the free line.** Ours replies inside the incoming conversation, and `LINK <code>` proves who owns the phone.

**What he got right, and we lack:**
- one place every outbound text goes through, with a hard 320-character cap;
- a kill switch;
- server-rendered templates;
- a `[TRAINING]` prefix and no links.

Our `photon.ts` still needs the kill switch, STOP/opt-out handling and a per-number cap.

## 3. "Practice texts" in our module (his rules, mapped)

| His rule | In SafeSense |
|---|---|
| Fictional brands only | `spacetimedb-ts/src/practice.ts` `PRACTICE_TEMPLATES`: fictional brands, `.example` domains, 555-01xx numbers, tagged with our tactic names |
| `validateSlots` (no free text from the AI) | Port it as-is. Better: pick the player's most-missed tactic from `activity_event` directly, with no AI call |
| Kill switch | `PHOTON_SENDING_ENABLED` env var, off by default, checked in `sendChannelReply` |
| Send to yourself only, after a code | Replaced by `channel_link`; save `spaceId` and `agentUserId` at LINK time. No phone numbers stored |
| 3 per 24 hours | Private table `practice_send` (owner, senderKey, templateId, sentAt, outcome); 1 per day, 3 in total |
| STOP | Table `channel_optout`; STOP, STOPALL, UNSUBSCRIBE, CANCEL, END and QUIT opt out with one confirmation; START reverses it |
| Debrief page | A reply instead: the text ends "Reply REPORT if you think it's a scam". REPORT counts as caught; YES, PAY or a code counts as fooled. Then an immediate debrief, plus `log_activity("practice-text", …)` |
| Synthetic data only | Drop `code_relay` |
| Server writes the text | `renderPractice()`: 320 characters max, prefixed `[Practice · SafeSense]` |

**Flow:**
1. The web reducer `request_practice_text` checks the link, opt-out, cap and kill switch, then queues a `practice_job`. It's a scheduled table, like `discord_job`.
2. The scheduled procedure sends the text through Photon, using the send id as the idempotency key.
3. `handleInbound` grades the reply before the normal bot turn.

Demo limit: it only reaches the registered sender's iPhone.

## 4. GPL

- **Where it comes from:** the Wordle CSS is copied nearly line for line from Ania Kubów's tutorial (`kubowania/wordle-javascript`). That repo has no LICENSE file and its package.json says ISC. The GPL-3.0 file has no author line and looks added by Krishna or his tooling. Nothing credits her.
- **What shipping it would mean:** bundling it into our app would make the whole app GPL-3.0.
- **Verdict:** keep the words only, rewritten.

## 5. Content worth bringing in

Our rules apply: fictional brands, US English, `.example` domains, 555-01xx numbers.

**Scam or Not?** Five new items:
- `carrier-rewards-lookalike-host` (`carrier-impersonation`, scam). Link `brightline-mobile.com.redeem.example`; teaches reading the web address from the right.
- `login-code-you-requested` (legit).
- `transfer-case-code-swap` (`account-locked-otp`, scam). The best item: the case number is real, but the code is labeled as a password reset.
- `partial-refund-notice` (legit).
- `toll-receipt-no-action` (legit).

**The Long Con.** A third story, `parcel-fee-smish` ("Parcelo Support" vs "Priya"):
- **Step 1:** brand costume (works), prize blast in capitals (fails), security badges plus a link (half works).
- **Step 2:** a midnight deadline (works), a $2.99 fee (works), asking for a code this early (fails).
- **Step 3:** a callback number (works), she checks her order history (fails), she forwards it to 7726 (caught).

His LESSONS lines (`scenarios.js:120-132`) are good "how to spot it" texts. Consider new tactics `callback-number` and `sim-swap`.

**Fraudle.** Add SMISH, SPOOF, CALLBACK, TRANSFER, URGENCY, GIFTCARD (8 letters or fewer), with the text rewritten.

**Assistant prompt.** Add the three rules in the table above.

**Pitch claims:**
- ✅ **FTC:** "In 2024, people reported $470 million in losses" from scams that started with a text. Top five: fake package delivery, fake jobs, fake fraud alerts, unpaid tolls, wrong number. (FTC Data Spotlight, April 2025)
- ✅ **Malwarebytes, 2026-09-17:** monitoring since early May 2026, "more than 1,000 closely related campaign templates". No victim or loss count, so don't imply one.
- ✅ **Whalebone:** the scammers used genuine carrier links, with AT&T and Verizon copies. The doc's "January 8 group text" should read "investigation began January 8".
- ⚠️ **Couldn't verify:**
  - the CMU "515 participants" paper (its PDF link returns 404);
  - the FCC port-out passage (not read);
  - the T-Mobile link ending in `.html.html` (it still loads);
  - several consumer.ftc.gov links, which block bots.

## 6. Things that would hurt us with judges

- a quiz scam impersonating T-Mobile, plus T-Life branding;
- an endpoint that texts any number;
- a practice text telling people to read out their real code;
- the false "STOP handled by Photon" claim;
- a GPL file of unclear origin and uncredited copied CSS;
- a Photon call that doesn't match Photon's API;
- OpenAI used instead of Gemini.

## 7. Secrets

**Clean:**
- `server/.env.example` has only placeholders (`sk-...`, `photon_...`, `https://api.photon.example/...`), and no `.env` is committed.
- The key-pattern scan found nothing.
- Phone numbers are only T-Mobile's public support numbers and fictional 555 ones. One placeholder, `+14155551234`, should become a 555-01xx number.

## What Krishna could build next (about 2 hours, in `spacetimedb-ts/`, on a branch off `safesense`)

1. **Guards (30 min):**
   - a `PHOTON_SENDING_ENABLED` kill switch;
   - `channel_optout` with STOP/START;
   - a per-sender daily cap;
   - two new checks in `tools/photon-sim.mjs --checks`.
2. **Practice texts (60 min):** as in §3.
3. **Real test on his iPhone (30 min):** LINK, practice text, REPORT, debrief, then STOP.
