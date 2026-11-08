# Safe Signal

Run with Node 22.13+ (Node SQLite required).

```
npm install
npm run dev
```

Open `/`, complete the three games, then build the campaign preview. The preview and token debrief work without keys. Game results and campaigns are stored in SQLite. Session ownership uses an HTTP-only cookie. Training uses fictional brands and synthetic scenarios.

## Phone training

Copy `.env.example` to `.env.local`. Set `SPECTRUM_PROJECT_ID`, `SPECTRUM_PROJECT_SECRET`, `PHOTON_INBOUND_NUMBER`, and a public HTTPS `BASE_URL`. Set both `ENABLE_PHOTON_TEXT=true` and `SAFESIGNAL_SENDING_ENABLED=true` when ready to send. Shared Photon plans require registering the recipient in the Photon dashboard.

Run a persistent Node server with `npm run build` then `npm start`. Verification starts the authenticated Spectrum inbound stream in that process. This implementation uses the SDK stream for replies, rather than an HTTP webhook. A serverless deployment would need a separate persistent inbound worker.

On the campaign page, enter your own E.164 number. Send the displayed single-use verification code from that phone to the configured Photon line within ten minutes. Then select Send. REPORT records a successful report. STOP, UNSUBSCRIBE, or QUIT opts out. A click immediately opens the debrief and ends the simulation. Preview clicks also consume the campaign, preventing a subsequent send. No inbound message triggers an outbound reply.

Attempts are reserved transactionally before provider delivery. An uncertain delivery consumes the attempt and cannot be retried automatically. The default session limit is three. Use `SAFESIGNAL_SENDING_ENABLED=false` to disable sends. Restarting the process is required when changing its environment settings.

## Checks

```
npm test
npm run build
```

The profiler uses fixed rules. Guess Who treats average question diagnosticity below 0.5 as low, five questions as careful, and fewer than three as hurried. Bad Scam gives selected tactics a 0.1 reduction and unselected tactics a 0.05 increase. Reach scores of at least 80 reduce all traits by 0.05. Scores are educational heuristics.

Voice follow-up and optional LLM rationale are outside this implementation. All campaign selection, slots, and message rendering are deterministic rules except random selection among allowed slot values.
