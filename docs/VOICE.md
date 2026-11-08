# Practice calls: voice agent ↔ SafeSense

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

- Phone numbers are never stored or logged. `voice_link` keeps only `sha256(salt + E.164 number)`, the player, and the iMessage link the number came from.
- The salt is fixed, so this is pseudonymous, not anonymous. The table is private, and it is deleted on unlink or Forget me.
- The routes never send texts or place calls.
