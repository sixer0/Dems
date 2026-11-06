// W05: a socket client that can set request headers (a browser cannot), built on the installed `ws`.
// Usage: node .cache/proof-harness/ws-client.mjs <url> [--origin <value>] [--cookie-jar <curl jar>] [--protocol <p>] [--send <text>]
// Prints the handshake result, up to three messages (cut to 160 characters) and the close code.
import { readFileSync } from 'node:fs'
import WebSocket from 'ws'

const [url, ...rest] = process.argv.slice(2)
const opt = {}
for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1]

const headers = {}
if (opt.origin) headers.Origin = opt.origin
if (opt['cookie-jar']) {
  // curl's Netscape jar: domain, flag, path, secure, expiry, name, value (tab separated); HttpOnly lines start with #HttpOnly_
  const pairs = readFileSync(opt['cookie-jar'], 'utf8')
    .split('\n')
    .map((line) => line.replace(/^#HttpOnly_/, ''))
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('\t'))
    .filter((f) => f.length >= 7)
    .map((f) => `${f[5]}=${f[6]}`)
  if (pairs.length) headers.Cookie = pairs.join('; ')
}

const sent = { origin: headers.Origin ?? '(none)', cookie: headers.Cookie ? `${headers.Cookie.split('=')[0]}=(value not printed)` : '(none)', protocol: opt.protocol ?? '(none)' }
console.log(`ws-client -> ${url.replace(/token=[^&]+/, 'token=…')} sent ${JSON.stringify(sent)}`)

const socket = opt.protocol ? new WebSocket(url, opt.protocol, { headers }) : new WebSocket(url, { headers })
let seen = 0
const timer = setTimeout(() => {
  console.log('ws-client: no handshake answer within 3 s (nothing handled the upgrade)')
  socket.terminate()
}, 3000)
socket.on('open', () => {
  console.log(`ws-client: handshake 101, protocol "${socket.protocol}"`)
  if (opt.send) socket.send(opt.send)
  else setTimeout(() => socket.close(1000), 400)
})
socket.on('unexpected-response', (_request, response) => {
  console.log(`ws-client: handshake refused with HTTP ${response.statusCode}`)
  clearTimeout(timer)
  socket.terminate()
})
socket.on('message', (data) => {
  const text = data.toString()
  if (++seen <= 3) console.log(`ws-client: message ${text.slice(0, 160)}`)
  if (text.startsWith('echo:')) socket.close(1000)
})
socket.on('close', (code) => {
  clearTimeout(timer)
  console.log(`ws-client: closed with code ${code}`)
})
socket.on('error', (error) => console.log(`ws-client: error ${error.message}`))
