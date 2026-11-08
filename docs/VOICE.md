# Practice calls: voice agent ↔ SafeSense

## Go-live checklist (web-started practice call)

This branch ships with the calls **off**: with the Retell values unset, the unlocked Phone Call page still works and every "Call me" gets the calm private-beta line. To turn it on:

1. **Diego: store the values** in the gitignored `.env` (hidden prompt, nothing echoed):

   ```bash
   scripts/set-key.sh RETELL_API_KEY             # Retell key with the webhook badge (places calls, verifies webhooks)
   scripts/set-key.sh RETELL_AGENT_ID            # the SafeSense practice-caller agent
   scripts/set-key.sh CHALLENGE_NUMBER           # the Retell/Photon line in E.164, used as from_number
   scripts/set-key.sh CHALLENGE_ALLOWED_NUMBERS  # invited phones, comma-separated E.164
   ```

   `PHOTON_SENDING_ENABLED` must also be `true` on Maincloud, because calls sit behind the same proactive kill switch as practice texts. Leave `CHALLENGE_ENABLED` unset.
2. **Diego: push them to Maincloud.** The module is already published, so an env-only update is enough. It doesn't rebuild or upload anything, and the values that aren't set in the shell are kept:

   ```bash
   (set -a; . ./.env; set +a; spacetime publish --no-config -s maincloud -y --env-only safesense-1aa18263)
   ```

   Or do a full republish, which picks up `.env` as well: `STDB_TS_SERVER=maincloud STDB_TS_DB=safesense-1aa18263 scripts/publish-ts.sh` (never `-c`).
3. **Krishna: set up the Retell dashboard.**
   - **Agent webhook URL** = `https://maincloud.spacetimedb.com/v1/database/safesense-1aa18263/route/challenge-response`. `/voice/result` works too, and both routes drop duplicates.
   - **Post-call analysis**: add a field `outcome`, an enum of `caught` (spotted it, refused or hung up) or `fooled` (went along). Optionally add `tactic` (a slug such as `bank-impersonation`) and the boolean `engaged_with_scenario`, which shows the reflection card on Home. Without `outcome`, the call earns no point.
   - **Prompt**: the call passes the script in the dynamic variable `{{training_script}}`. The prompt should open with it and say it's a practice call from SafeSense.
4. **First live test.** Use a browser with 2+ points (The Phone Call unlocks at 2). Open The Phone Call, enter an invited number and select **Call me**. The phone rings within a few seconds. After you hang up and Retell finishes the analysis (about a minute), the +1 shows on Home and in the profile. If it doesn't, run `spacetime logs -s maincloud safesense-1aa18263 -n 50` and look for `Challenge call result:` or `Retell demo call`.

## Practice call from the web (`challenge.ts`)

Once The Phone Call is unlocked (2 points, `safesense/src/content/upcoming.ts`), the page calls the reducer `start_challenge_demo(phone)`. The **server** then places a single Retell outbound call. The browser never sees a Retell key.

- **Private beta.** Only numbers on `CHALLENGE_ALLOWED_NUMBERS` can be called. Entries and the typed number are normalized the same way (`normalizePhone` in voice.ts), so `+1 (555) 010-0001` matches `+15550100001`. Every refusal gets the same message: *"Phone practice calls are in a private beta right now. Try the games or text SafeSense instead."* That covers an uninvited number, missing Retell values and the kill switch being off. The list itself is never revealed.
- **Caps.** At most 10 calls per UTC day across everyone, and 3 per number per day (`demo_call_count`, which holds counts keyed by an HMAC of the number).
- **No numbers at rest.** The number sits in `demo_call_job` only until the job runs about 1 s later, and the job deletes the row before it calls Retell, even if the call fails. `challenge_attempt` keeps only an HMAC of the number.
- **Points.** A finished call adds one `practice-call` row (+1), once per Retell `call_id`, whichever route reports it first. For a phone that isn't linked, the player is found through the call's `metadata.challenge_token`. `challenge-line` rows (the debrief) earn no points, and points never reset.
- **SMS enrollment is off.** JOIN texts, Groq-picked drills and the `challenge_enrollment` table (which has a raw phone column) do nothing unless `CHALLENGE_ENABLED` is exactly `"true"`, and we don't set it. `log_activity` never schedules a `challenge_job`.
- **Test locally** with fake values only. `RETELL_API_BASE` points the outbound request at a dead address, so nothing ever reaches Retell:

  ```bash
  RETELL_API_KEY=fake-retell-key RETELL_AGENT_ID=agent_fake CHALLENGE_NUMBER=+15550109999 \
  CHALLENGE_ALLOWED_NUMBERS=+15550100001 PHOTON_SENDING_ENABLED=true RETELL_API_BASE=http://127.0.0.1:9 \
  VOICE_WEBHOOK_SECRET=fake-voice-secret PHOTON_WEBHOOK_SECRET=whsec_ZmFrZQ== STDB_TS_DB=call-sim scripts/publish-ts.sh
  RETELL_API_KEY=fake-retell-key RETELL_AGENT_ID=agent_fake CHALLENGE_NUMBER=+15550109999 \
  CHALLENGE_ALLOWED_NUMBERS=+15550100001 node tools/call-sim.mjs call-sim   # use a fresh db: the caps count every run
  ```

## Routes for the voice agent

The voice agent (Retell AI) uses two routes on the SafeSense module (`spacetimedb-ts/src/voice.ts`). The first lets a call know who the player is. The second counts the call's result toward their progress.

| Route | URL |
| --- | --- |
| Context | `https://maincloud.spacetimedb.com/v1/database/safesense-1aa18263/route/voice/context` |
| Result | `https://maincloud.spacetimedb.com/v1/database/safesense-1aa18263/route/voice/result` |

Both routes take `POST` with a JSON body. No AI calls run in these routes, and nothing is sent from them.

## Who is the player?

A phone counts as linked after the player links it through iMessage: in the SafeSense chat, select **Link my phone**, then text `LINK <code>`. The module then saves a salted SHA-256 hash of the phone number, never the number itself. `UNLINK`, **Forget me** and unlinking on the web all delete that hash. A number that isn't linked still gets a normal answer with generic values, so the call goes on.

The player's number is picked from the request in this order:

1. `phone` (or `args.phone`).
2. `call_inbound.from_number`.
3. `call.to_number` for an outbound call, or `call.from_number` for an inbound call.

US numbers work in any format, such as `+15551234567` or `(555) 123-4567`.

## Auth

Every request must pass one of two checks:

- **Retell signature.** Retell sends an `X-Retell-Signature` header, checked with `RETELL_API_KEY`. Use the Retell key that has the **webhook badge**. The header looks like `v=<ms>,d=<hex>`, where the hex is HMAC-SHA256 over the raw body plus the timestamp, and the timestamp must be within 5 minutes.
- **Shared secret.** Send the header `x-safesense-voice-secret: <VOICE_WEBHOOK_SECRET>`.

| Response | Meaning |
| --- | --- |
| `401` | The signature or secret is missing or wrong. |
| `503 voice not configured` | Neither env var is set. |
| `413` | The body is too large. The cap is 64 KiB for context and 512 KiB for result. |

## POST /voice/context

The route accepts three request shapes.

**Retell inbound-call webhook.** Set this as the phone number's inbound webhook URL. The request looks like this:

```json
{"event":"call_inbound","call_inbound":{"call_id":"call_1","from_number":"+15551234567","to_number":"+15550100000"}}
```

Response:

```json
{"call_inbound":{"dynamic_variables":{"known_player":"yes","player_name":"there","games_played":"4","weak_tactics":"fake delivery fees and pressure to act fast","top_tactic":"fake-delivery"}}}
```

**Retell custom function, or a simple request.** Send `{"name":"get_player","call":{...},"args":{}}`, args only, or just `{"phone":"+15551234567"}`. The variables come back as a flat JSON object, so they can be mapped to response variables:

```json
{"known_player":"yes","player_name":"there","games_played":"4","weak_tactics":"fake delivery fees and pressure to act fast","top_tactic":"fake-delivery"}
```

All values are strings:

| Variable | Value |
| --- | --- |
| `known_player` | `yes` or `no` |
| `player_name` | A first name the player told the Help Bot, else `there` (so "Hi {{player_name}}" still reads well). |
| `games_played` | The number of finished games. |
| `weak_tactics` | Up to 3 tactics they miss most, in plain words, or `none yet`. |
| `top_tactic` | The slug of the most-missed tactic, or `none`. |

An unknown number gets `no`, `there`, `0`, `none yet` and `none`.

## POST /voice/result

Each call is recorded once per `call_id`. Later reports for the same call answer `duplicate`. The route accepts three request shapes.

**Simple, or a custom function the agent calls at the end of the call:**

```json
{"call_id":"call_1","phone":"+15551234567","outcome":"caught","tactic":"bank-impersonation"}
{"name":"report_result","call":{"call_id":"call_1","direction":"outbound","to_number":"+15551234567"},"args":{"outcome":"fooled","tactic":"urgency"}}
```

**Retell post-call webhook** (the agent's webhook URL). The route uses `call_analyzed`. A `call_ended` event with no outcome is acknowledged and ignored.

```json
{"event":"call_analyzed","call":{"call_id":"call_1","direction":"outbound","to_number":"+15551234567","call_analysis":{"custom_analysis_data":{"outcome":"caught","tactic":"urgency"}}}}
```

The route reads these fields:

- **`outcome`**: `caught` (the player spotted the scam, refused or hung up) or `fooled` (they went along with it). A boolean `caught` field also works.
- **`tactic`** (optional): a slug such as `bank-impersonation`, `urgency` or `fake-delivery`.

It looks for them in `args`, the top level, `call.call_analysis.custom_analysis_data`, `call.collected_dynamic_variables` and `call.metadata`.

Response: `{"result":"recorded"|"duplicate"|"unknown caller","outcome":"caught","tactic":"..."}`. If the outcome is missing, you get `{"result":"ignored","why":"no outcome"}`. If `call_id` is missing, you get `400`.

A recorded call adds one row to the player's activity: game `practice-call`, kind `answer_correct` (caught) or `answer_wrong` (fooled). That earns +1 point on the profile and feeds the coach.

## Wiring it in Retell (Krishna)

1. **Context**, using either option:
   - Phone number → **Inbound webhook URL** = the context URL. Retell signs it, so set `RETELL_API_KEY`.
   - A **custom function** `get_player` (POST, the context URL) that runs at the start of the call. Add the header `x-safesense-voice-secret` if you aren't relying on the signature.
2. Use the variables in the prompt, for example: `Hi {{player_name}}`, or "They often miss {{weak_tactics}}; use a {{top_tactic}} scam."
3. **Result**, using either option or both (duplicates are dropped):
   - Agent → **Webhook URL** = the result URL, plus a **post-call analysis** field named `outcome` (an enum of `caught` and `fooled`) and, optionally, `tactic`.
   - A **custom function** `report_result` with args `{outcome, tactic}`. With "args only" turned on, also pass `call_id` and `phone`.
4. **Outbound calls.** The player's number is `to_number`. Only call players who asked for a practice call.

## Env vars (Diego)

```bash
scripts/set-key.sh RETELL_API_KEY        # the Retell key with the webhook badge
scripts/set-key.sh VOICE_WEBHOOK_SECRET  # any long random string; share it with Krishna privately
STDB_TS_SERVER=maincloud STDB_TS_DB=safesense-1aa18263 scripts/publish-ts.sh   # never -c
```

## Test locally

Use fake secrets only:

```bash
export VOICE_WEBHOOK_SECRET=fake-voice-secret RETELL_API_KEY=fake-retell-key PHOTON_WEBHOOK_SECRET=whsec_ZmFrZQ==
STDB_TS_DB=voice-test scripts/publish-ts.sh
node tools/voice-sim.mjs voice-test --checks
```

## Privacy

- Phone numbers are never logged, and never stored except in `demo_call_job` for the second before its job runs. `voice_link` keeps only `sha256(salt + E.164 number)`, the player, and the iMessage link the number came from.
- The salt is fixed, so this is pseudonymous, not anonymous. The table is private, and it is deleted on unlink or Forget me.
- The routes never send texts or place calls. The only thing that places a call is `start_challenge_demo` (invited numbers only, see above).
