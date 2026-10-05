// Throw-away proof harness of W05 (early proof f) and W12 (early proof e). 02_plan §6.
// NOT the Core server. It stands in for it on a lane port so that the Vite dev proxy can be
// measured before any backend exists. It holds no real secret: the cookie value is random bytes
// generated at start and is never written to the log in full.
//
// Run from the repository root (never `cd`):
//   node .cache/proof-harness/harness.mjs            # 127.0.0.1:4421, log .cache/proof-harness/harness.log
// Env: PROOF_HARNESS_PORT (4421-4423), PROOF_HARNESS_LOG (path).
// Packages: fastify, @fastify/websocket (and its `ws`) from the root node_modules. No install.
import { randomBytes } from 'node:crypto'
import { appendFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import websocket from '@fastify/websocket'
import Fastify from 'fastify'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PROOF_HARNESS_PORT ?? 4421)
if (![4421, 4422, 4423].includes(PORT)) {
  console.error(`proof-harness: PROOF_HARNESS_PORT must be 4421, 4422 or 4423 (got ${process.env.PROOF_HARNESS_PORT})`)
  process.exit(2)
}
const LOG = process.env.PROOF_HARNESS_LOG ?? fileURLToPath(new URL('./harness.log', import.meta.url))

// The name has the shape of the real one (01_specs §2.4: dems_session_<listen port>); the value is a dummy.
const COOKIE_NAME = `dems_session_${PORT}`
const COOKIE_VALUE = randomBytes(24).toString('base64url')
// 01_specs §2.4 / SR-70: the web console origins. Exact string match, no localhost, `null` refused.
const WEB_CONSOLE_ORIGINS = ['http://127.0.0.1:5173', 'http://127.0.0.1:5176', 'http://127.0.0.1:5177', 'http://127.0.0.1:5178']

let seq = 0
let revision = 100

/** One JSON line per event. The cookie value is logged as its first 6 characters only. */
function log(entry) {
  appendFileSync(LOG, `${JSON.stringify({ n: ++seq, t: new Date().toISOString(), ...entry })}\n`)
}

/** What the harness received, in the fields the proof is about. */
function received(headers) {
  const cookieHeader = headers.cookie
  let cookie = { present: false }
  if (typeof cookieHeader === 'string') {
    const pairs = cookieHeader.split(';').map((p) => p.trim())
    const own = pairs.find((p) => p.startsWith(`${COOKIE_NAME}=`))
    const value = own?.slice(COOKIE_NAME.length + 1)
    cookie = {
      present: true,
      names: pairs.map((p) => p.split('=')[0]),
      own: own ? `${COOKIE_NAME}=${value.slice(0, 6)}…(${value.length} chars)` : null,
      equalsIssuedValue: value === COOKIE_VALUE,
    }
  }
  const secFetch = {}
  for (const [k, v] of Object.entries(headers)) if (k.startsWith('sec-fetch-')) secFetch[k] = v
  return {
    host: headers.host ?? null,
    origin: headers.origin ?? null,
    cookie,
    secFetch,
    referer: headers.referer ?? null,
    authorization: headers.authorization ? 'present (not logged)' : null,
    connection: headers.connection ?? null,
    upgrade: headers.upgrade ?? null,
    forwarded: Object.fromEntries(
      Object.entries(headers).filter(([k]) => k.startsWith('x-forwarded-') || k === 'forwarded' || k === 'via'),
    ),
    headerNames: Object.keys(headers),
  }
}

const app = Fastify({ logger: false })
await app.register(websocket, { options: { maxPayload: 65536 } })

app.addHook('onRequest', async (request) => {
  const isUpgrade = String(request.headers.upgrade ?? '').toLowerCase() === 'websocket'
  log({ kind: isUpgrade ? 'upgrade' : 'http', method: request.method, url: request.url, ...received(request.headers) })
})

// GET: a canned health-like answer (W12 replaces it by a contract-valid one from the registry).
app.get('/api/v1/health', async (_request, reply) => {
  reply.header('cache-control', 'no-store')
  return { service: 'proof-harness', port: PORT, note: 'not the Core server' }
})

// POST: issues the dummy cookie and the three headers the proxy has to carry back.
app.post('/api/v1/proof/sign-in', async (_request, reply) => {
  revision += 1
  reply
    .header('set-cookie', `${COOKIE_NAME}=${COOKIE_VALUE}; HttpOnly; SameSite=Strict; Path=/`)
    .header('x-dems-epoch', '1')
    .header('x-dems-revision', String(revision))
    .header('retry-after', '7')
    .header('cache-control', 'no-store')
  return { ok: true, issued: COOKIE_NAME }
})

// POST: answers what arrived, so a browser script can read it without the log.
app.post('/api/v1/proof/echo', async (request, reply) => {
  revision += 1
  reply.header('x-dems-epoch', '1').header('x-dems-revision', String(revision)).header('cache-control', 'no-store')
  const r = received(request.headers)
  return { host: r.host, origin: r.origin, cookiePresent: r.cookie.present, cookieEqualsIssued: r.cookie.equalsIssuedValue ?? false, secFetch: r.secFetch, forwarded: r.forwarded }
})

// POST: a stand-in for the Origin guard (SR-70), to show that a refusal travels back through the proxy.
app.post('/api/v1/proof/guarded', async (request, reply) => {
  const origin = request.headers.origin
  if (typeof origin !== 'string' || !WEB_CONSOLE_ORIGINS.includes(origin)) {
    reply.code(403).header('cache-control', 'no-store')
    return { error: { code: 'ORIGIN_NOT_ALLOWED', message: 'proof-harness stand-in for the Origin guard' } }
  }
  return { ok: true, origin }
})

// POST: a 429 with retry-after, as the throttle answers.
app.post('/api/v1/proof/limited', async (_request, reply) => {
  reply.code(429).header('retry-after', '42').header('cache-control', 'no-store')
  return { error: { code: 'RATE_LIMITED', message: 'proof-harness stand-in' } }
})

// Socket: says hello with what the upgrade carried, echoes one message, closes with a code on request.
app.get('/ws', { websocket: true }, (socket, request) => {
  const r = received(request.headers)
  log({ kind: 'ws-open', url: request.url, host: r.host, origin: r.origin, cookie: r.cookie, secFetch: r.secFetch, authorization: r.authorization })
  socket.send(JSON.stringify({ type: 'hello', origin: r.origin, host: r.host, cookiePresent: r.cookie.present, cookieEqualsIssued: r.cookie.equalsIssuedValue ?? false }))
  socket.on('message', (data) => {
    const text = data.toString()
    log({ kind: 'ws-message', text: text.slice(0, 80) })
    const close = /^close:(\d{4})$/.exec(text)
    if (close) {
      socket.close(Number(close[1]), 'requested')
      return
    }
    socket.send(`echo:${text}`)
  })
  socket.on('close', (code) => log({ kind: 'ws-close', code }))
})

writeFileSync(LOG, '')
await app.listen({ host: HOST, port: PORT })
log({ kind: 'listening', address: `${HOST}:${PORT}`, pid: process.pid, cookieName: COOKIE_NAME, cookieValueLength: COOKIE_VALUE.length })
console.log(`proof-harness listening on http://${HOST}:${PORT} pid ${process.pid} log ${LOG}`)

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    log({ kind: 'stopping', signal })
    await app.close()
    process.exit(0)
  })
}
