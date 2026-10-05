// W05 browser check: raw CDP over Node's built-in WebSocket (no install), headless Chromium.
// Usage: node .cache/proof-harness/cdp-driver.mjs <devtoolsPort> <vitePort> <outJson>
// It loads the dev server's page, calls the harness THROUGH the dev server from page script
// (fetch with credentials: 'same-origin', then a WebSocket), and records what the browser did.
// Cookie values are cut to 6 characters before anything is stored.
import { writeFileSync } from 'node:fs'

const [devPort, vitePort, outJson] = process.argv.slice(2)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const mask = (s) => (typeof s === 'string' ? s.replace(/(dems_session_\d+=)([A-Za-z0-9_-]{6})[A-Za-z0-9_-]*/g, '$1$2…') : s)

const list = await (await fetch(`http://127.0.0.1:${devPort}/json/list`)).json()
const target = list.find((t) => t.type === 'page')
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))

let id = 0
const pending = new Map()
const sockets = new Map() // requestId -> { url, requestHeaders, status, responseHeaders, frames: [] }
const http = new Map() // requestId -> { url, method, sent: {origin, cookie, secFetchSite}, status, setCookie }
const consoleErrors = []
let loadFired = false

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
    return
  }
  const p = msg.params ?? {}
  const pick = (h, name) => {
    for (const [k, v] of Object.entries(h ?? {})) if (k.toLowerCase() === name) return v
    return null
  }
  switch (msg.method) {
    case 'Page.loadEventFired':
      loadFired = true
      break
    case 'Network.requestWillBeSent':
      if (p.request.url.includes('/api/v1/')) http.set(p.requestId, { url: p.request.url, method: p.request.method })
      break
    case 'Network.requestWillBeSentExtraInfo': {
      const e = http.get(p.requestId)
      if (e) {
        const cookie = pick(p.headers, 'cookie')
        e.sent = {
          origin: pick(p.headers, 'origin'),
          host: pick(p.headers, 'host'),
          cookie: cookie ? mask(cookie) : null,
          secFetchSite: pick(p.headers, 'sec-fetch-site'),
          secFetchMode: pick(p.headers, 'sec-fetch-mode'),
        }
      }
      break
    }
    case 'Network.responseReceivedExtraInfo': {
      const e = http.get(p.requestId)
      if (e) {
        e.status = p.statusCode
        e.received = {
          setCookie: mask(pick(p.headers, 'set-cookie')),
          epoch: pick(p.headers, 'x-dems-epoch'),
          revision: pick(p.headers, 'x-dems-revision'),
          retryAfter: pick(p.headers, 'retry-after'),
          accessControlAllowOrigin: pick(p.headers, 'access-control-allow-origin'),
          vary: pick(p.headers, 'vary'),
        }
      }
      break
    }
    case 'Network.webSocketCreated':
      sockets.set(p.requestId, { url: p.url.replace(/token=[^&]+/, 'token=…'), frames: [] })
      break
    case 'Network.webSocketWillSendHandshakeRequest': {
      const s = sockets.get(p.requestId)
      if (s) {
        const cookie = pick(p.request.headers, 'cookie')
        s.sent = {
          origin: pick(p.request.headers, 'origin'),
          host: pick(p.request.headers, 'host'),
          cookie: cookie ? mask(cookie) : null,
          protocol: pick(p.request.headers, 'sec-websocket-protocol'),
        }
      }
      break
    }
    case 'Network.webSocketHandshakeResponseReceived': {
      const s = sockets.get(p.requestId)
      if (s) {
        s.status = p.response.status
        s.acceptedProtocol = pick(p.response.headers, 'sec-websocket-protocol')
      }
      break
    }
    case 'Network.webSocketFrameReceived': {
      const s = sockets.get(p.requestId)
      if (s && s.frames.length < 3) s.frames.push(String(p.response.payloadData).slice(0, 160))
      break
    }
    case 'Runtime.exceptionThrown':
      consoleErrors.push(String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text).slice(0, 200))
      break
  }
})

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id
    pending.set(n, { resolve, reject })
    ws.send(JSON.stringify({ id: n, method, params }))
  })

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(`page script failed: ${JSON.stringify(r.exceptionDetails).slice(0, 400)}`)
  return r.result.value
}

const navigate = async (url) => {
  loadFired = false
  await send('Page.navigate', { url })
  for (let i = 0; i < 100 && !loadFired; i++) await sleep(100)
  await sleep(1500) // let the dev client open its own socket
  return loadFired
}

await send('Network.enable')
await send('Page.enable')
await send('Runtime.enable')
const version = await send('Browser.getVersion')

// ---- 1. the page at http://127.0.0.1:<vite> (the address WT-2a prescribes) ----
const origin = `http://127.0.0.1:${vitePort}`
const loaded = await navigate(`${origin}/`)
const page = await evaluate(`(async () => {
  const out = { locationOrigin: location.origin, title: document.title }
  const post = (path) => fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' })
  const r1 = await post('/api/v1/proof/sign-in')
  out.signIn = { status: r1.status, epoch: r1.headers.get('x-dems-epoch'), revision: r1.headers.get('x-dems-revision'), retryAfter: r1.headers.get('retry-after'), setCookieReadableByScript: r1.headers.get('set-cookie'), body: await r1.json() }
  out.documentCookie = document.cookie
  const r2 = await post('/api/v1/proof/echo')
  out.echo = { status: r2.status, revision: r2.headers.get('x-dems-revision'), body: await r2.json() }
  const r3 = await fetch('/api/v1/health', { credentials: 'same-origin' })
  out.health = { status: r3.status, body: await r3.json() }
  const r4 = await post('/api/v1/proof/limited')
  out.limited = { status: r4.status, retryAfter: r4.headers.get('retry-after') }
  const r5 = await post('/api/v1/proof/guarded')
  out.guarded = { status: r5.status, body: await r5.json() }
  const socket = (firstMessage) => new Promise((resolve) => {
    const msgs = []
    const s = new WebSocket('ws://' + location.host + '/ws')
    const timer = setTimeout(() => resolve({ error: 'timeout', msgs }), 5000)
    s.onopen = () => s.send(firstMessage)
    s.onmessage = (e) => { msgs.push(String(e.data)); if (String(e.data).startsWith('echo:')) s.close(1000) }
    s.onerror = () => msgs.push('(error event)')
    s.onclose = (e) => { clearTimeout(timer); resolve({ msgs, closeCode: e.code }) }
  })
  out.ws = await socket('ping-1')
  out.wsCloseCode = await socket('close:4403')
  return out
})()`)
const cookies = (await send('Network.getCookies', { urls: [`${origin}/`] })).cookies.map((c) => ({
  name: c.name,
  value: `${String(c.value).slice(0, 6)}…(${String(c.value).length} chars)`,
  domain: c.domain,
  path: c.path,
  httpOnly: c.httpOnly,
  sameSite: c.sameSite ?? null,
  secure: c.secure,
  session: c.session,
}))
const first = { http: [...http.values()], sockets: [...sockets.values()] }
http.clear()
sockets.clear()

// ---- 2. the same page opened under localhost (the address WT-2a forbids): what Origin goes out ----
const lhOrigin = `http://localhost:${vitePort}`
const lhLoaded = await navigate(`${lhOrigin}/`)
let localhostPage
try {
  localhostPage = await evaluate(`(async () => {
    const out = { locationOrigin: location.origin }
    const post = (path) => fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' })
    const r1 = await post('/api/v1/proof/guarded')
    out.guarded = { status: r1.status, body: await r1.json() }
    const r2 = await post('/api/v1/proof/echo')
    out.echo = { status: r2.status, body: await r2.json() }
    return out
  })()`)
} catch (error) {
  localhostPage = { error: String(error).slice(0, 300) }
}
const second = { http: [...http.values()], sockets: [...sockets.values()] }

const result = {
  browser: version.product,
  userAgent: version.userAgent,
  page127: { loaded, script: page, cookieJar: cookies, network: first },
  pageLocalhost: { loaded: lhLoaded, script: localhostPage, network: second },
  consoleErrors,
}
writeFileSync(outJson, `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
ws.close()
