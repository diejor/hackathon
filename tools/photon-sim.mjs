#!/usr/bin/env node
// Simulate Photon (Beta 2.0) webhooks against a LOCAL SpacetimeDB database, so the iMessage handler
// (spacetimedb-ts/src/photon.ts) can be tested without a real line or iPhone.
//
// Usage:
//   PHOTON_WEBHOOK_SECRET=whsec_<base64> node tools/photon-sim.mjs <db> "<message text>" [--from +15551234567]
//   node tools/photon-sim.mjs <db> --checks        # signature checks: signed / unsigned / tampered / stale / duplicate
//
// The secret must be a FAKE test secret that you also published to the local db, e.g.:
//   export PHOTON_WEBHOOK_SECRET=whsec_$(node -e "console.log(require('crypto').randomBytes(24).toString('base64'))")
//   scripts/publish-ts.sh                          # local db safesense-local picks up the env var
// Never use the real whsec_ secret here, and never against Maincloud.
//
// Replies to the "phone" go out through Photon's REST API (PHOTON_API_KEY); locally they fail or are refused,
// so read the result in the module logs: spacetime logs --no-config -s local <db> -n 30
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
async function send(name, body, { sign = true, tamper = false, id = 'msg_' + rnd(), ts = now() } = {}) {
  const text = JSON.stringify(body)
  const headers = { 'content-type': 'application/json', 'webhook-id': id, 'webhook-timestamp': ts }
  if (sign) {
    let sig = createHmac('sha256', Buffer.from(secret.slice(6), 'base64')).update(`${id}.${ts}.${text}`).digest('base64')
    if (tamper) sig = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1)
    headers['webhook-signature'] = `v1,${sig}`
  }
  const r = await fetch(base, { method: 'POST', headers, body: text })
  console.log(`${name}: ${r.status} ${(await r.text()).slice(0, 200)}`)
  return id
}

// Shape of a Photon "message.received" event (as handled in photon.ts).
const event = (text) => ({
  type: 'message.received',
  data: {
    projectId: 'proj_sim',
    object: {
      id: 'm_' + rnd(), status: 'received', platform: 'iMessage',
      space: { id: 'space_sim', kind: 'direct' },
      sentBy: { id: 'user_sim_' + from.replace(/\D/g, ''), kind: 'user', handle: from },
      receivedBy: { id: 'agent_line', kind: 'agent' },
      content: { type: 'text', text },
    },
  },
})

if (args.includes('--checks')) {
  const id = await send('signed UNLINK          (expect 200)', event('UNLINK'))
  await send('same webhook-id again  (expect 200, skipped)', event('UNLINK'), { id })
  await send('unsigned               (expect 401)', event('UNLINK'), { sign: false })
  await send('tampered signature     (expect 401)', event('UNLINK'), { tamper: true })
  await send('stale timestamp        (expect 401)', event('UNLINK'), { ts: String(Math.floor(Date.now() / 1000) - 600) })
} else {
  const text = args[1] ?? 'Is this a scam? "USPS: your parcel is on hold, pay $1.99 at usps-redelivery.example"'
  await send(`message from ${from}`, event(text))
  console.log(`Now check the module logs: spacetime logs --no-config -s local ${db} -n 30`)
}
