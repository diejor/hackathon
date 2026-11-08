# Safe Signal — Build Brief

HackUTD project targeting T-Mobile "Safe Signal" and "Best Use of Photon API."
Three mini games teach scam patterns, then an AI builds a personalized
simulated scam attempt and delivers it to the player's own phone via Photon.
The player scores by reporting it; the inbound debrief is a dead end.

## Hard safety requirements (non-negotiable)

1. **Verified self only.** OTP check binds a phone to a `playerId` before any
   send. `assertSendAllowed` must verify the target E.164 matches that
   verified number — no sends to anyone else, ever.
2. **Kill switch.** `SAFESIGNAL_SENDING_ENABLED=false` disables all outbound
   sends system-wide. The guard checks this on every send.
3. **Rate limit.** `MAX_SENDS_PER_PLAYER` caps sends per player per session
   (default 3). Guard enforces it.
4. **Dead end payload.** `GET /t/:token` renders a debrief ONLY. Zero input
   fields, zero forms, zero third-party analytics, no fingerprinting.
5. **Fictional brands only.** Every archetype uses invented brand names.
   Real brands (USPS, FedEx, Chase, etc.) never appear in sent messages.
6. **STOP handling.** Any inbound STOP/UNSUBSCRIBE/QUIT immediately opts the
   player out; the guard fails all future sends for them.
7. **Instant reveal.** Engagement (clicking the link) reveals the debrief
   immediately. No follow-up messages after engagement.
8. **No free-text generation on the send path.** The LLM emits a structured
   `AttackPlan` (archetype id, tactics, slots). A deterministic template
   renderer builds the final message string. Model output is never sent raw.
9. **Synthetic only.** No real customer data. All profiles, phones outside
   the player's own verified number, and PII in content are synthetic.

## Phases

| Phase | Flag                     | Scope                                       |
|-------|--------------------------|---------------------------------------------|
| 1     | always on                | Games, profiler, campaign preview, token route |
| 2     | `ENABLE_PHOTON_TEXT=true`| Real iMessage send + webhook reply handling |
| 3     | `ENABLE_VOICE=true`      | Retell voice follow-up over SIP             |

## Contracts

`src/contracts.ts` is **frozen**. Do not rename fields. Game events, profile
vector, attack plan, and score result types are all defined there.
