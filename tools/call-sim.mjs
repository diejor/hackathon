#!/usr/bin/env node
// Simulate the web-started practice call (spacetimedb-ts/src/challenge.ts, docs/VOICE.md) against a LOCAL
// SpacetimeDB database: start_challenge_demo, then Retell's signed post-call webhook on /challenge-response
// (and /voice/result), plus the /challenge GET/POST pages. No real calls, texts or AI: publish with
// RETELL_API_BASE pointing at a dead address so the outbound request fails before it leaves the machine.
//
// Usage (FAKE values only, never against Maincloud):
//   export RETELL_API_KEY=fake-retell-key RETELL_AGENT_ID=agent_fake CHALLENGE_NUMBER=+15550109999 \
//     CHALLENGE_ALLOWED_NUMBERS=+15550100001 PHOTON_SENDING_ENABLED=true RETELL_API_BASE=http://127.0.0.1:9 \
//     VOICE_WEBHOOK_SECRET=fake-voice-secret
//   STDB_TS_DB=call-sim scripts/publish-ts.sh
//   node tools/call-sim.mjs call-sim            # needs a fresh db (the daily caps count every run)
//
// Checks: a non-invited number is refused, the invited one is queued and its job row (the number) is gone
// after the job runs; log_activity schedules no SMS challenge job and refuses the reserved game; the
// webhook rejects bad / stale signatures (401), records one practice-call row (+1 point) for a valid
// call_analyzed, answers "duplicate" for the same call id on either route, and never adds a points reset.
import { createHmac } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const db = process.argv[2]
const { RETELL_API_KEY: key, RETELL_AGENT_ID: agent, CHALLENGE_NUMBER: from, CHALLENGE_ALLOWED_NUMBERS: allowed } = process.env
if (!db || !key || !agent || !from || !allowed) {
  console.error('usage: RETELL_API_KEY=... RETELL_AGENT_ID=... CHALLENGE_NUMBER=... CHALLENGE_ALLOWED_NUMBERS=... node tools/call-sim.mjs <db>')
  process.exit(1)
}
const invited = allowed.split(',')[0].trim()
const server = process.env.STDB_URL || 'http://127.0.0.1:3001'
const route = (p) => `${server}/v1/database/${db}/route/${p}`
let failures = 0
const check = (name, ok, got = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${got ? ': ' + got : ''}`)
}

const cli = (...a) => execFileSync('spacetime', [a[0], '--no-config', '-s', 'local', db, ...a.slice(1)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const call = (reducer, ...args) => {
  try {
    cli('call', reducer, ...args)
    return 'ok'
  } catch (e) {
    return 'refused: ' + String(e.stderr || e.message).split('\n').filter(Boolean).slice(-1)[0]
  }
}
const count = (q) => Number((cli('sql', q).match(/^\s*(\d+)\s*$/m) ?? [])[1] ?? NaN)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function post(path, body, { sig = 'good', headers = {} } = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  const ts = sig === 'stale' ? Date.now() - 10 * 60_000 : Date.now()
  const h = { 'content-type': 'application/json', ...headers }
  if (sig !== 'none') {
    const k = sig === 'bad' ? 'wrong-key' : key
    h['x-retell-signature'] = `v=${ts},d=${createHmac('sha256', k).update(text + ts).digest('hex')}`
  }
  const r = await fetch(route(path), { method: 'POST', headers: h, body: text })
  return `${r.status} ${(await r.text()).slice(0, 200)}`
}

// ---------- start_challenge_demo ----------
check('not invited is refused', /refused/.test(call('start_challenge_demo', '"+15550100999"')))
check('invited number is queued', call('start_challenge_demo', JSON.stringify(invited)) === 'ok')
check('demo_call_job queued', count('SELECT COUNT(*) AS n FROM demo_call_job') === 1)
await sleep(4000)
check('demo_call_job gone after the job ran (Retell request failed locally)', count('SELECT COUNT(*) AS n FROM demo_call_job') === 0)
const tokenRow = cli('sql', 'SELECT token FROM challenge_attempt').match(/"([a-f0-9]{64})"/)
check('challenge_attempt row (HMAC of the number only)', !!tokenRow)
if (!tokenRow) process.exit(1)
const token = tokenRow[1]
// A real call leaves the attempt "voice-issued"; the local request failed, so put it back for the debrief check.
cli('sql', "UPDATE challenge_attempt SET status = 'voice-issued'")

// ---------- log_activity never schedules the SMS path ----------
check('log_activity for a game', call('log_activity', '"scam-or-not"', '"run_done"', '"{\\"correct\\":3,\\"total\\":5}"') === 'ok')
check('reserved game challenge-line refused', /refused/.test(call('log_activity', '"challenge-line"', '"voice_response"', '"{}"')))
check('no challenge_job scheduled (CHALLENGE_ENABLED unset)', count('SELECT COUNT(*) AS n FROM challenge_job') === 0)
check('no challenge_enrollment rows', count('SELECT COUNT(*) AS n FROM challenge_enrollment') === 0)

// ---------- POST /challenge-response (Retell post-call webhook) ----------
const practiceRows = () => count("SELECT COUNT(*) AS n FROM activity_event WHERE game = 'practice-call'")
const before = practiceRows()
const analyzed = (callId, extra = {}) => ({
  event: 'call_analyzed',
  call: {
    call_id: callId, direction: 'outbound', agent_id: agent, from_number: from, to_number: invited,
    metadata: { challenge_token: token },
    call_analysis: { custom_analysis_data: { outcome: 'caught', tactic: 'bank-impersonation', engaged_with_scenario: true, ...extra } },
  },
})
let got = await post('challenge-response', analyzed('call_sim_1'), { sig: 'none' })
check('unsigned -> 401', got.startsWith('401'), got)
got = await post('challenge-response', analyzed('call_sim_1'), { sig: 'bad' })
check('wrong key -> 401', got.startsWith('401'), got)
got = await post('challenge-response', analyzed('call_sim_1'), { sig: 'stale' })
check('stale signature -> 401', got.startsWith('401'), got)
got = await post('challenge-response', 'not json')
check('signed, not JSON -> 400', got.startsWith('400'), got)
got = await post('challenge-response', { ...analyzed('call_sim_x'), event: 'call_started' })
check('other event ignored', /"ignored"/.test(got), got)
got = await post('challenge-response', analyzed('call_sim_1'))
check('valid call_analyzed recorded', /"recorded"/.test(got), got)
got = await post('challenge-response', analyzed('call_sim_1'))
check('same call again -> duplicate', /"duplicate"/.test(got), got)
got = await post('voice/result', analyzed('call_sim_1'))
check('same call on /voice/result -> duplicate', /"duplicate"/.test(got), got)
check('exactly one practice-call row for the call (+1 point)', practiceRows() === before + 1, `${practiceRows() - before} added`)
check('debrief row (challenge-line, 0 points) once', count("SELECT COUNT(*) AS n FROM activity_event WHERE game = 'challenge-line'") === 1)
got = await post('challenge-response', analyzed('call_sim_2', { outcome: undefined }))
check('no outcome -> nothing recorded', /"no outcome"/.test(got) && practiceRows() === before + 1, got)
got = await post('voice/result', analyzed('call_sim_3', { outcome: 'fooled' }))
check('/voice/result finds the player by the call token (unlinked phone)', /"recorded"/.test(got) && practiceRows() === before + 2, got)
const wrongAgent = analyzed('call_sim_4')
wrongAgent.call.agent_id = 'agent_other'
got = await post('challenge-response', wrongAgent)
check('other agent ignored', /"ignored"/.test(got) && practiceRows() === before + 2, got)

// ---------- /challenge pages (SMS-path links; must not crash) ----------
for (const [name, path, method, body] of [
  ['GET /challenge, no token', 'challenge', 'GET'],
  ['GET /challenge, token', `challenge?t=${'a'.repeat(64)}`, 'GET'],
  ['POST /challenge, bad body', 'challenge', 'POST', 'x=1'],
  ['POST /challenge, unknown token', 'challenge', 'POST', `t=${'b'.repeat(64)}`],
]) {
  const r = await fetch(route(path), { method, body, headers: body ? { 'content-type': 'application/x-www-form-urlencoded' } : {} })
  const text = await r.text()
  check(name, r.status === 200 && /SafeSense practice/.test(text), `${r.status}`)
}

console.log(failures ? `${failures} check(s) failed.` : 'All checks passed.')
process.exit(failures ? 1 : 0)
