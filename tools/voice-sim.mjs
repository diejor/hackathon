#!/usr/bin/env node
// Simulate the voice agent (Retell AI) against a LOCAL SpacetimeDB database: POST /voice/context and
// /voice/result (spacetimedb-ts/src/voice.ts, docs/VOICE.md). No real calls, texts or AI.
//
// Usage:
//   VOICE_WEBHOOK_SECRET=<fake> [RETELL_API_KEY=<fake>] PHOTON_WEBHOOK_SECRET=whsec_<fake> \
//     node tools/voice-sim.mjs <db> --checks
//   VOICE_WEBHOOK_SECRET=<fake> node tools/voice-sim.mjs <db> context +15550100123
//
// Publish the same FAKE secrets to the local db first, e.g.
//   STDB_TS_DB=voice-test VOICE_WEBHOOK_SECRET=... RETELL_API_KEY=... PHOTON_WEBHOOK_SECRET=whsec_... scripts/publish-ts.sh
// Never use real secrets here, and never against Maincloud.
//
// --checks links a fresh fake phone to the CLI's identity (create_link_code, then a signed Photon "LINK <code>",
// like tools/photon-sim.mjs; the LINK reply can't be sent locally without PHOTON_API_KEY, which is fine),
// seeds demo activity for it, then checks auth, unknown vs linked numbers, recording, dedupe and UNLINK.
import { createHmac, randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
const db = args[0]
if (!db || (args[1] !== '--checks' && args[1] !== 'context')) {
  console.error('usage: node tools/voice-sim.mjs <db> --checks | context <phone>')
  process.exit(1)
}
const secret = process.env.VOICE_WEBHOOK_SECRET
const retellKey = process.env.RETELL_API_KEY
if (!secret) {
  console.error('Set VOICE_WEBHOOK_SECRET to the fake secret you published to the local db.')
  process.exit(1)
}
const server = process.env.STDB_URL || 'http://127.0.0.1:3001'
const route = (p) => `${server}/v1/database/${db}/route/${p}`
const rnd = () => randomBytes(6).toString('hex')
const fakePhone = () => '+1555' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0')
let failures = 0

// auth: 'secret' | 'retell' | 'none' | 'bad-secret' | 'bad-retell' | 'stale-retell'
async function post(name, path, body, { auth = 'secret', expect, raw } = {}) {
  const text = raw ?? JSON.stringify(body)
  const headers = { 'content-type': 'application/json' }
  if (auth === 'secret') headers['x-safesense-voice-secret'] = secret
  if (auth === 'bad-secret') headers['x-safesense-voice-secret'] = secret + 'x'
  if (auth.endsWith('retell')) {
    const ts = auth === 'stale-retell' ? Date.now() - 10 * 60_000 : Date.now()
    const key = auth === 'bad-retell' ? 'wrong-key' : retellKey
    headers['x-retell-signature'] = `v=${ts},d=${createHmac('sha256', key).update(text + ts).digest('hex')}`
  }
  const r = await fetch(route(path), { method: 'POST', headers, body: text })
  const got = `${r.status} ${(await r.text()).slice(0, 300)}`
  const ok = !expect || expect.test(got)
  if (!ok) failures++
  console.log(`${expect ? (ok ? 'PASS ' : 'FAIL ') : ''}${name}: ${got}`)
  return got
}

const stdb = (...a) => execFileSync('spacetime', [...a.slice(0, 1), '--no-config', '-s', 'local', db, ...a.slice(1)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
const sqlCount = (q) => Number((stdb('sql', q).match(/^\s*(\d+)\s*$/m) ?? [])[1] ?? NaN)

// A signed Photon message.received from `phone` (Standard Webhooks, same as tools/photon-sim.mjs).
async function photonText(phone, text) {
  const ps = process.env.PHOTON_WEBHOOK_SECRET
  if (!ps?.startsWith('whsec_')) throw new Error('Set PHOTON_WEBHOOK_SECRET to the fake whsec_... published to the db')
  const body = JSON.stringify({
    type: 'message.received',
    data: {
      projectId: 'proj_sim',
      object: {
        id: 'm_' + rnd(), status: 'received', platform: 'iMessage',
        space: { id: 'space_sim', kind: 'direct' },
        sentBy: { id: 'user_sim_' + phone.replace(/\D/g, ''), kind: 'user', handle: phone },
        receivedBy: { id: 'agent_line', kind: 'agent' },
        content: { type: 'text', text },
      },
    },
  })
  const id = 'msg_' + rnd()
  const ts = String(Math.floor(Date.now() / 1000))
  const sig = createHmac('sha256', Buffer.from(ps.slice(6), 'base64')).update(`${id}.${ts}.${body}`).digest('base64')
  const r = await fetch(route('photon'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': `v1,${sig}` },
    body,
  })
  return `${r.status} ${await r.text()}`
}

if (args[1] === 'context') {
  await post('context', 'voice/context', { phone: args[2] ?? fakePhone() })
  process.exit(0)
}

// ---- Auth ----
const stranger = fakePhone()
await post('no secret                    (expect 401)', 'voice/context', { phone: stranger }, { auth: 'none', expect: /^401/ })
await post('wrong secret                 (expect 401)', 'voice/context', { phone: stranger }, { auth: 'bad-secret', expect: /^401/ })
await post('wrong secret, result         (expect 401)', 'voice/result', { call_id: 'c_' + rnd(), phone: stranger, outcome: 'caught' }, { auth: 'bad-secret', expect: /^401/ })
if (retellKey) {
  await post('Retell signature             (expect 200)', 'voice/context', { phone: stranger }, { auth: 'retell', expect: /^200 / })
  await post('Retell signature, wrong key  (expect 401)', 'voice/context', { phone: stranger }, { auth: 'bad-retell', expect: /^401/ })
  await post('Retell signature, stale      (expect 401)', 'voice/context', { phone: stranger }, { auth: 'stale-retell', expect: /^401/ })
} else console.log('SKIP Retell signature checks (RETELL_API_KEY not set)')
await post('body over 64 KiB             (expect 413)', 'voice/context', null, { raw: JSON.stringify({ phone: stranger, pad: 'x'.repeat(70_000) }), expect: /^413/ })

// ---- Unknown number: generic variables, never an error ----
await post('unknown, {phone}             (expect known_player no)', 'voice/context', { phone: stranger }, { expect: /^200 .*"known_player":"no"/ })
await post('unknown, Retell inbound      (expect call_inbound.dynamic_variables)', 'voice/context',
  { event: 'call_inbound', event_timestamp: Date.now(), call_inbound: { call_id: 'c_' + rnd(), from_number: stranger, to_number: '+15550100000' } },
  { expect: /^200 \{"call_inbound":\{"dynamic_variables":\{"known_player":"no"/ })
await post('not JSON                     (expect 200 generic)', 'voice/context', null, { raw: 'hello', expect: /^200 .*"known_player":"no"/ })
await post('result for unknown number    (expect unknown caller)', 'voice/result', { call_id: 'c_' + rnd(), phone: stranger, outcome: 'caught' }, { expect: /^200 .*"unknown caller"/ })

// ---- Link a fresh phone to the CLI identity (like a player texting LINK <code>) ----
const phone = fakePhone()
stdb('call', 'seed_demo_activity')
stdb('call', 'create_link_code')
const codes = [...stdb('sql', 'SELECT code FROM link_code').matchAll(/"([A-Z0-9]{6})"/g)].map((m) => m[1])
if (codes.length !== 1) {
  console.log(`FAIL expected exactly one link code in this test db, found ${codes.length}`)
  process.exit(1)
}
console.log(`LINK from a fake phone: ${(await photonText(phone, 'LINK ' + codes[0])).slice(0, 80)}`)
const linkedRows = sqlCount('SELECT COUNT(*) AS n FROM voice_link')
console.log(`${linkedRows >= 1 ? 'PASS' : 'FAIL'} voice_link has the phone (rows: ${linkedRows}; the number itself is not stored)`)
if (linkedRows < 1) failures++

// ---- Linked number ----
const national = phone.slice(2).replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
await post('linked, {phone}              (expect known_player yes)', 'voice/context', { phone }, { expect: /^200 .*"known_player":"yes".*"weak_tactics":"fake delivery fees/ })
await post(`linked, national format      (expect yes)`, 'voice/context', { phone: national }, { expect: /^200 .*"known_player":"yes"/ })
await post('linked, Retell inbound       (expect yes)', 'voice/context',
  { event: 'call_inbound', call_inbound: { from_number: phone, to_number: '+15550100000' } }, { expect: /^200 \{"call_inbound":\{"dynamic_variables":\{"known_player":"yes"/ })
await post('linked, custom function      (expect yes)', 'voice/context',
  { name: 'get_player', call: { call_id: 'c_' + rnd(), direction: 'outbound', from_number: '+15550100000', to_number: phone }, args: {} },
  { expect: /^200 \{"known_player":"yes"/ })

// ---- Results ----
const before = sqlCount("SELECT COUNT(*) AS n FROM activity_event WHERE game = 'practice-call'")
const call1 = 'call_' + rnd()
await post('result, custom function      (expect recorded)', 'voice/result',
  { name: 'report_result', call: { call_id: call1, direction: 'outbound', from_number: '+15550100000', to_number: phone }, args: { outcome: 'caught', tactic: 'bank-impersonation' } },
  { expect: /^200 .*"result":"recorded","outcome":"caught","tactic":"bank-impersonation"/ })
await post('same call again              (expect duplicate)', 'voice/result',
  { name: 'report_result', call: { call_id: call1, direction: 'outbound', to_number: phone }, args: { outcome: 'caught' } }, { expect: /^200 .*"duplicate"/ })
await post('post-call webhook, same call (expect duplicate)', 'voice/result',
  { event: 'call_analyzed', call: { call_id: call1, direction: 'outbound', from_number: '+15550100000', to_number: phone, call_analysis: { custom_analysis_data: { outcome: 'caught' } } } },
  { auth: retellKey ? 'retell' : 'secret', expect: /^200 .*"duplicate"/ })
const call2 = 'call_' + rnd()
await post('call_ended, no analysis yet  (expect ignored)', 'voice/result',
  { event: 'call_ended', call: { call_id: call2, direction: 'outbound', to_number: phone, transcript: 'Agent: hi' } }, { expect: /^200 .*"ignored"/ })
await post('call_analyzed, fooled        (expect recorded)', 'voice/result',
  { event: 'call_analyzed', call: { call_id: call2, direction: 'outbound', from_number: '+15550100000', to_number: phone, call_analysis: { call_successful: true, custom_analysis_data: { outcome: 'fooled', tactic: 'urgency' } } } },
  { auth: retellKey ? 'retell' : 'secret', expect: /^200 .*"result":"recorded","outcome":"fooled"/ })
await post('call_started event           (expect ignored)', 'voice/result', { event: 'call_started', call: { call_id: 'c_' + rnd() } }, { expect: /^200 .*"ignored"/ })
await post('simple shape, no call_id     (expect 400)', 'voice/result', { phone, outcome: 'caught' }, { expect: /^400/ })
const after = sqlCount("SELECT COUNT(*) AS n FROM activity_event WHERE game = 'practice-call'")
console.log(`${after - before === 2 ? 'PASS' : 'FAIL'} practice-call activity rows added: ${after - before} (expect 2: no double count)`)
if (after - before !== 2) failures++

// ---- UNLINK drops the voice link ----
console.log(`UNLINK from the fake phone: ${(await photonText(phone, 'UNLINK')).slice(0, 80)}`)
await post('after UNLINK                 (expect known_player no)', 'voice/context', { phone }, { expect: /^200 .*"known_player":"no"/ })

console.log(failures ? `${failures} check(s) FAILED` : 'All checks passed.')
process.exit(failures ? 1 : 0)
