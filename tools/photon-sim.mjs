#!/usr/bin/env node
// Simulate Photon (Beta 2.0) webhooks against a LOCAL SpacetimeDB database, so the iMessage handler
// (spacetimedb-ts/src/photon.ts) can be tested without a real line or iPhone.
//
// Usage:
//   PHOTON_WEBHOOK_SECRET=whsec_<base64> node tools/photon-sim.mjs <db> "<message text>" [--from +15551234567]
//   node tools/photon-sim.mjs <db> --checks        # signature checks (signed / unsigned / tampered / stale / duplicate),
//                                                  # then the guards: STOP (one confirmation, then silence), START,
//                                                  # and the daily cap (30 replies, the last one says so, then silence),
//                                                  # and PRACTICE from an unlinked phone (queued like a linked one,
//                                                  # internally a trial: 3 per phone per UTC day, then a calm
//                                                  # limit reply; nothing after STOP). Needs the db published with
//                                                  # PHOTON_SENDING_ENABLED=true, else these checks are skipped.
//
// The secret must be a FAKE test secret that you also published to the local db, e.g.:
//   export PHOTON_WEBHOOK_SECRET=whsec_$(node -e "console.log(require('crypto').randomBytes(24).toString('base64'))")
//   scripts/publish-ts.sh                          # local db safesense-local picks up the env var
// Never use the real whsec_ secret here, and never against Maincloud.
//
// Replies to the "phone" go out through Photon's REST API (PHOTON_API_KEY); locally they fail or are refused,
// so read the result in the module logs: spacetime logs --no-config -s local <db> -n 30
// The 200 body of a signed request says what the module did ("ok: sent", "ok: send failed",
// "ok: silent (opted out)", "ok: skipped (sending disabled)", ...); --checks asserts on it. The checks use fresh
// random senders and only commands (STOP, START, UNLINK), so they make no AI calls. They can't test
// PHOTON_SENDING_ENABLED (that needs a republish): publish with it set to "false" and expect "skipped".
import { createHmac, randomBytes } from 'node:crypto'

const args = process.argv.slice(2)
const db = args[0]
if (!db) {
  console.error('usage: node tools/photon-sim.mjs <db> "<text>" [--from +1555...] | --checks')
  process.exit(1)
}
const secret = process.env.PHOTON_WEBHOOK_SECRET
if (!secret?.startsWith('whsec_')) {
  console.error('Set PHOTON_WEBHOOK_SECRET to a fake whsec_... test secret (see the header).')
  process.exit(1)
}
const fromIdx = args.indexOf('--from')
const from = fromIdx > 0 ? args[fromIdx + 1] : '+15551234567'
const base = `${process.env.STDB_URL || 'http://127.0.0.1:3001'}/v1/database/${db}/route/photon`
const rnd = () => randomBytes(6).toString('hex')
const now = () => String(Math.floor(Date.now() / 1000))

// Standard Webhooks signature: HMAC-SHA256 over "<id>.<timestamp>.<body>", keyed with the base64 part of whsec_.
async function send(name, body, { sign = true, tamper = false, id = 'msg_' + rnd(), ts = now(), expect, quiet = false } = {}) {
  const text = JSON.stringify(body)
  const headers = { 'content-type': 'application/json', 'webhook-id': id, 'webhook-timestamp': ts }
  if (sign) {
    let sig = createHmac('sha256', Buffer.from(secret.slice(6), 'base64')).update(`${id}.${ts}.${text}`).digest('base64')
    if (tamper) sig = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1)
    headers['webhook-signature'] = `v1,${sig}`
  }
  const r = await fetch(base, { method: 'POST', headers, body: text })
  const got = `${r.status} ${(await r.text()).slice(0, 200)}`
  const ok = !expect || expect.test(got)
  if (!ok) failures++
  if (!quiet || !ok) console.log(`${expect ? (ok ? 'PASS ' : 'FAIL ') : ''}${name}: ${got}`)
  return { id, got }
}
let failures = 0
function report(name, got, expect) {
  const ok = expect.test(got)
  if (!ok) failures++
  console.log(`${ok ? 'PASS ' : 'FAIL '}${name}: ${got}`)
}

// Shape of a Photon "message.received" event (as handled in photon.ts).
const event = (text, sender = from) => ({
  type: 'message.received',
  data: {
    projectId: 'proj_sim',
    object: {
      id: 'm_' + rnd(), status: 'received', platform: 'iMessage',
      space: { id: 'space_sim', kind: 'direct' },
      sentBy: { id: 'user_sim_' + sender.replace(/\D/g, ''), kind: 'user', handle: sender },
      receivedBy: { id: 'agent_line', kind: 'agent' },
      content: { type: 'text', text },
    },
  },
})

if (args.includes('--checks')) {
  const attempted = /^200 ok: (sent|send failed)/ // the module tried Photon (locally the send itself may fail)
  const { id } = await send('signed UNLINK          (expect 200)', event('UNLINK'), { expect: attempted })
  await send('same webhook-id again  (expect 200, skipped)', event('UNLINK'), { id, expect: /^200 duplicate$/ })
  await send('unsigned               (expect 401)', event('UNLINK'), { sign: false, expect: /^401/ })
  await send('tampered signature     (expect 401)', event('UNLINK'), { tamper: true, expect: /^401/ })
  await send('stale timestamp        (expect 401)', event('UNLINK'), { ts: String(Math.floor(Date.now() / 1000) - 600), expect: /^401/ })

  // STOP / START (a fresh sender each run; commands only, no AI calls)
  const p = '+1555' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0')
  await send('STOP                   (expect one confirmation)', event('Stop', p), { expect: /^200 ok: (sent|send failed) \(opt-out confirmation\)$/ })
  await send('text after STOP        (expect silence)', event('Is this a scam? win a prize', p), { expect: /^200 ok: silent \(opted out\)$/ })
  await send('UNLINK after STOP      (expect silence)', event('UNLINK', p), { expect: /^200 ok: silent \(opted out\)$/ })
  await send('STOP again             (expect silence)', event('STOP', p), { expect: /^200 ok: silent \(already opted out\)$/ })
  await send('START                  (expect a reply)', event('start', p), { expect: attempted })
  await send('UNLINK after START     (expect a reply)', event('UNLINK', p), { expect: attempted })

  // Practice texts from an unlinked phone: queued as a trial (same reply as a linked phone; no AI call).
  // The 200 body's "(practice queued)" / "(practice limit)" / "(practice off)" comes from photon.ts ReplyTags.
  const queued = /^200 ok: (sent|send failed) \(practice queued\)$/
  const { got: first } = await send('', event('PRACTICE', p), { quiet: true })
  if (/\(practice off\)$/.test(first)) {
    console.log(`SKIP practice checks: ${first} (publish with PHOTON_SENDING_ENABLED=true to run them)`)
  } else {
    report('PRACTICE, not linked   (expect queued)', first, queued)
    const q = '+1555' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0')
    for (let i = 1; i <= 3; i++) await send(`PRACTICE trial ${i}       (expect queued)`, event('PRACTICE', q), { expect: queued })
    await send('PRACTICE trial 4       (expect the limit reply)', event('PRACTICE', q), { expect: /^200 ok: (sent|send failed) \(practice limit\)$/ })
    const s = '+1555' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0')
    await send('STOP, new phone        (expect one confirmation)', event('STOP', s), { expect: /^200 ok: (sent|send failed) \(opt-out confirmation\)$/ })
    await send('PRACTICE after STOP    (expect silence)', event('PRACTICE', s), { expect: /^200 ok: silent \(opted out\)$/ })
  }

  // Daily cap: 30 replies per sender per UTC day, the 30th says so, then silence
  const c = '+1555' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0')
  for (let i = 1; i <= 29; i++) await send(`cap: reply ${i}`, event('UNLINK', c), { expect: /^200 ok: (sent|send failed)$/, quiet: true })
  console.log('PASS cap: replies 1-29 sent' + (failures ? ' (see FAIL above)' : ''))
  await send('cap: reply 30          (expect last today)', event('UNLINK', c), { expect: /^200 ok: (sent|send failed) \(last today\)$/ })
  await send('cap: reply 31          (expect silence)', event('UNLINK', c), { expect: /^200 ok: silent \(daily cap reached\)$/ })
  await send('cap: STOP when capped  (expect confirmation)', event('STOP', c), { expect: /^200 ok: (sent|send failed) \(opt-out confirmation\)$/ })

  console.log(failures ? `${failures} check(s) FAILED` : 'All checks passed.')
  process.exit(failures ? 1 : 0)
} else {
  const text = args[1] ?? 'Is this a scam? "USPS: your parcel is on hold, pay $1.99 at usps-redelivery.example"'
  await send(`message from ${from}`, event(text))
  console.log(`Now check the module logs: spacetime logs --no-config -s local ${db} -n 30`)
}
