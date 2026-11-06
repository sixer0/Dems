// Throw-away proof harness of W05 (early proof f) and W12 (early proof e). 02_plan §6.
// NOT the Core server. It stands in for it on a lane port so that the Vite dev proxy (W05) and the
// typed client on an emulator (W12) can be measured before any backend exists. It holds no real
// secret: the cookie value is random bytes generated at start and is never written to the log in
// full, and of an `Authorization` header only the scheme, the first 4 characters and the length are
// logged.
//
// Run from the repository root (never `cd`):
//   node --import tsx .cache/proof-harness/harness.mjs   # 127.0.0.1:4421, log .cache/proof-harness/harness.log
// (`--import tsx` since W12: the canned answers come from the contract registry, which is TypeScript source.)
// Env: PROOF_HARNESS_PORT (4421-4423), PROOF_HARNESS_LOG (path).
// Packages: fastify, @fastify/websocket (and its `ws`), tsx, zod from the root node_modules. No install.
import { randomBytes } from 'node:crypto'
import { appendFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import websocket from '@fastify/websocket'
import Fastify from 'fastify'
import {
  ApiErrorSchema,
  CORE_API_EXAMPLES,
  sessionCreateSchema,
  validateCoreApiResponse,
} from '../../packages/shared/src/api/index.ts'

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
let sockets = 0

/** One JSON line per event. The cookie value is logged as its first 6 characters only. */
function log(entry) {
  appendFileSync(LOG, `${JSON.stringify({ n: ++seq, t: new Date().toISOString(), ...entry })}\n`)
}

/** Presence, scheme, the first 4 characters and the length of the credential. Never the value. */
function authorizationOf(headers) {
  const value = headers.authorization
  if (typeof value !== 'string') return { present: false }
  const space = value.indexOf(' ')
  const scheme = space > 0 ? value.slice(0, space) : null
  const credential = space > 0 ? value.slice(space + 1) : value
  return { present: true, scheme, prefix: credential.slice(0, 4), length: credential.length }
}

/** What the harness received, in the fields the proofs are about. */
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
  // Every `sec-*` header (W12). The socket key is a per-connection nonce: its length is enough.
  const sec = {}
  for (const [k, v] of Object.entries(headers)) {
    if (k.startsWith('sec-')) sec[k] = k === 'sec-websocket-key' ? `(${String(v).length} chars)` : v
  }
  return {
    host: headers.host ?? null,
    origin: headers.origin ?? null,
    cookie,
    secFetch,
    sec,
    referer: headers.referer ?? null,
    userAgent: headers['user-agent'] ?? null,
    authorization: authorizationOf(headers),
    accept: headers.accept ?? null,
    contentType: headers['content-type'] ?? null,
    contentLength: headers['content-length'] ?? null,
    connection: headers.connection ?? null,
    upgrade: headers.upgrade ?? null,
    forwarded: Object.fromEntries(
      Object.entries(headers).filter(([k]) => k.startsWith('x-forwarded-') || k === 'forwarded' || k === 'via'),
    ),
    headerNames: Object.keys(headers),
  }
}

// ── W12: canned answers from the contract registry, checked against it at start ──────────────────
const exampleOf = (operationId, status, name) => CORE_API_EXAMPLES[operationId].responses[status][name].value
const CANNED = {
  health: { operationId: 'getServiceHealth', status: 200, body: exampleOf('getServiceHealth', 200, 'live') },
  created: { operationId: 'createSession', status: 201, body: exampleOf('createSession', 201, 'created') },
  notSignedIn: { operationId: 'createSession', status: 401, body: exampleOf('createSession', 401, 'notSignedIn') },
  invalidInput: { operationId: 'createSession', status: 422, body: exampleOf('createSession', 422, 'invalidInput') },
  exportForbidden: { operationId: 'exportEvidence', status: 403, body: exampleOf('exportEvidence', 403, 'forbidden') },
  video: { operationId: 'getVideoStatus', status: 200, body: exampleOf('getVideoStatus', 200, 'recording') },
}
// 429 is defined once at envelope level (01_specs §7.2), not per operation: checked with the envelope schema.
const RATE_LIMITED = { error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' } }
// A 200 body that violates StorageStatusResponse on purpose (the client must answer CONTRACT_VIOLATION).
const STORAGE_VIOLATION = { state: 'READY', totalBytes: 'not-a-number', leakedMember: 'must never reach the caller' }

const checks = Object.entries(CANNED).map(([name, c]) => ({ name, ...validateCoreApiResponse(c.operationId, c.status, c.body) }))
checks.push({ name: 'rateLimited', ok: ApiErrorSchema.safeParse(RATE_LIMITED).success })
const violationCheck = validateCoreApiResponse('getStorageStatus', 200, STORAGE_VIOLATION)
const cannedOk = checks.every((c) => c.ok) && violationCheck.ok === false
if (!cannedOk) {
  console.error('proof-harness: a canned answer does not match the contract', JSON.stringify({ checks, violationCheck }))
  process.exit(2)
}

const app = Fastify({ logger: false })
await app.register(websocket, { options: { maxPayload: 65536 } })

app.addHook('onRequest', async (request, reply) => {
  const isUpgrade = String(request.headers.upgrade ?? '').toLowerCase() === 'websocket'
  log({ kind: isUpgrade ? 'upgrade' : 'http', method: request.method, url: request.url, ...received(request.headers) })
  if (!isUpgrade) reply.header('x-request-id', `req-${String(seq).padStart(6, '0')}`)
})

// GET getServiceHealth: the contract's example with the current time. It also offers the dummy cookie,
// so the log of the later requests shows whether the client sends a cookie back (W12: it must not).
app.get('/api/v1/health', async (_request, reply) => {
  // Max-Age=60: the dummy cookie leaves a device's cookie store by itself one minute later, so the
  // app is left without it even if the probe's own clean-up request never runs.
  reply.header('cache-control', 'no-store').header('set-cookie', `${COOKIE_NAME}=${COOKIE_VALUE}; Max-Age=60; HttpOnly; SameSite=Strict; Path=/`)
  return { ...CANNED.health.body, serverTime: new Date().toISOString(), uptimeMs: Math.round(process.uptime() * 1000), ws: { ...CANNED.health.body.ws, clients: sockets } }
})

// POST createSession: 401 without `Authorization: Bearer dvc_…`, 422 when the body is not a
// SessionCreateRequest, else the contract's 201 with the two state headers (API-7).
app.post('/api/v1/session', async (request, reply) => {
  const auth = authorizationOf(request.headers)
  const body = sessionCreateSchema.safeParse(request.body)
  log({ kind: 'createSession', authorization: auth, bodyIsSessionCreateRequest: body.success, bodyKeys: request.body && typeof request.body === 'object' ? Object.keys(request.body) : null })
  reply.header('cache-control', 'no-store')
  if (!auth.present || auth.scheme !== 'Bearer' || auth.prefix !== 'dvc_') return reply.code(401).send(CANNED.notSignedIn.body)
  if (!body.success) return reply.code(422).send(CANNED.invalidInput.body)
  revision += 1
  return reply.code(201).header('x-dems-epoch', '1').header('x-dems-revision', String(revision)).send(CANNED.created.body)
})

// POST exportEvidence: the contract's 403 FORBIDDEN envelope.
app.post('/api/v1/evidence/:id/export', async (request, reply) => {
  log({ kind: 'exportEvidence', id: request.params.id, bodyKeys: request.body && typeof request.body === 'object' ? Object.keys(request.body) : null })
  return reply.code(403).header('cache-control', 'no-store').send(CANNED.exportForbidden.body)
})

// POST stopSession: a 429 with retry-after, as the throttle answers.
app.post('/api/v1/session/:id/stop', async (_request, reply) => {
  return reply.code(429).header('retry-after', '42').header('cache-control', 'no-store').send(RATE_LIMITED)
})

// GET getStorageStatus: a 200 whose body violates the contract.
app.get('/api/v1/storage/status', async (_request, reply) => {
  reply.header('cache-control', 'no-store')
  return STORAGE_VIOLATION
})

// GET getVideoStatus: a valid answer, 3 s late (the client's time-out probe). Logs an abort by the client.
app.get('/api/v1/video/status', async (request, reply) => {
  let answered = false
  request.raw.socket.once('close', () => {
    if (!answered) log({ kind: 'http-aborted-by-client', url: request.url })
  })
  await new Promise((resolve) => setTimeout(resolve, 3000))
  answered = true
  reply.header('cache-control', 'no-store')
  return CANNED.video.body
})

// ── W05: the proxy proof routes (unchanged) ──────────────────────────────────────────────────────
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

// POST (W12): says whether the dummy cookie came back, and deletes it from the caller's cookie store.
app.post('/api/v1/proof/forget-cookie', async (request, reply) => {
  const r = received(request.headers)
  reply.header('cache-control', 'no-store').header('set-cookie', `${COOKIE_NAME}=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/`)
  return { cookiePresent: r.cookie.present, cookieEqualsIssued: r.cookie.equalsIssuedValue ?? false, origin: r.origin }
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
  sockets += 1
  log({ kind: 'ws-open', url: request.url, host: r.host, origin: r.origin, cookie: r.cookie, secFetch: r.secFetch, sec: r.sec, userAgent: r.userAgent, authorization: r.authorization })
  socket.send(JSON.stringify({ type: 'hello', origin: r.origin, host: r.host, cookiePresent: r.cookie.present, cookieEqualsIssued: r.cookie.equalsIssuedValue ?? false, authorization: r.authorization, userAgent: r.userAgent }))
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
  socket.on('close', (code) => {
    sockets -= 1
    log({ kind: 'ws-close', code })
  })
})

writeFileSync(LOG, '')
await app.listen({ host: HOST, port: PORT })
log({ kind: 'listening', address: `${HOST}:${PORT}`, pid: process.pid, cookieName: COOKIE_NAME, cookieValueLength: COOKIE_VALUE.length })
log({ kind: 'canned', contractValid: checks.map((c) => `${c.name}=${c.ok}`), storageViolationIsInvalid: violationCheck.ok === false, storageViolationReason: violationCheck.ok ? null : violationCheck.reason })
console.log(`proof-harness listening on http://${HOST}:${PORT} pid ${process.pid} log ${LOG}`)

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    log({ kind: 'stopping', signal })
    await app.close()
    process.exit(0)
  })
}
