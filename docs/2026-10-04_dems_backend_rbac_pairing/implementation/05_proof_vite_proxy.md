---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: coder-execution
blueprint_row: 27
plan_row: W05 (early proof f, wave E1)
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
evidence_tier: 3 (mechanical output: statement plus command output)
status: complete
---

# 05 Proof (f): the Vite dev proxy (blueprint step 27, plan row W05)

Row, verbatim: [W05] Early proof f (time box 45 min): add the `server.proxy` block for `/api/v1` and
`/ws` with `DEMS_CORE_PROXY_PORT` to the web Vite config (no `headers` option, no `changeOrigin`, no
hook that changes a request header); write the throw-away proof harness; settle the lane start
details of 02_plan §5.3.

**Result: ADQ-6 same-origin proxy CONFIRMED.** Fallback row Ff is not needed.

| Field | Value |
|---|---|
| Result | The dev proxy carries `Set-Cookie`, `x-dems-epoch`, `x-dems-revision` and `retry-after` back, and `Cookie` and `Origin` forward unchanged, on HTTP and on the `/ws` upgrade. Vite's own socket still connects. Measured with curl, with a `ws` client and with a real browser (HeadlessChrome 153 over CDP) |
| Tracked file changed | `apps/core-web/vite.config.ts` only (38 lines added, 4 removed) |
| Build output | Byte-identical before and after, plain and packaged, also with the variable set (section 5) |
| Gate | `@dems/core-web`: 438 passed of 438 in 39 files before and after; typecheck and lint exit 0 (section 6) |
| Row window | Wave start about 06:26 WIB (the sibling rows' first timestamps); this row's first recorded timestamp 06:31:47; last live run 06:47:00. Inside the 45-minute box; this document was written after it |
| Sandbox bypass | Four commands, all `lockf` runs on lane 1 that bind loopback ports (a sandboxed bind answers `listen EPERM`). Every other command ran inside the sandbox |
| Processes started and stopped | Main run: the harness (PID 89532), Vite twice (npm 89548 with node 89568; npm 89730 with node 89750) and once more with an invalid value (it ended by itself), headless Chromium (89681). Extra runs: one harness, three Vite starts (one of them node 94574), one headless Chromium. Each was stopped by the script that started it. None is left (section 8) |
| Ports bound | `127.0.0.1:4421`, `127.0.0.1:5176`, `127.0.0.1:9396` (DevTools). Nothing else. Nothing was listening on 5173, 5174 or 5175 before or after: the other project was not running |
| Findings for the controller | Six (section 9). The first one concerns security: the dev server adds an `Access-Control-Allow-Origin` header to answers that pass through it |
| Follow-up (07:14 to 07:25 WIB) | Section 12: the dev server's CORS layer is off while the proxy is on (D29, F30). The file's current state and block are there; sections 1 to 11 describe the state step 27 left |
| Not done here | The negative test against the real Origin guard, `hello` and `heartbeat` from the real server, and a hot reload after a source edit: all three belong to W50 (section 10) |

Evidence files (copies, so that they outlive the scratch folder): `implementation/assets/05_run_check.log`,
`05_browser_run.json`, `05_resolve_config.log`, `05_build_compare.log`, `05_gate_runs.log`,
`05_run_cors_option.log`, `05_run_backend_down.log`, `05_run_lane_snippet.log`, and the scripts `05_harness.mjs`, `05_run_check.sh`,
`05_cdp_driver.mjs`, `05_ws_client.mjs`. The cookie value is a random dummy made at each start; no file
holds more than its first 6 characters.

---

## 1. The proxy block

`apps/core-web/vite.config.ts` after the change (the whole addition; nothing else in the file changed
except `defineConfig({` becoming `defineConfig(({ command, isPreview }) => ({`):

```ts
import { defineConfig, type ProxyOptions } from 'vite'

/** Ports a Core server listens on: the main instance and lanes 1 to 3 (backend task 02_plan §3.4, §4.2). */
const CORE_PROXY_PORTS = ['4420', '4421', '4422', '4423']

/**
 * Live-mode dev proxy (backend task 04_client_integration_spec §4.1, WT-1 to WT-3; 02_plan W05).
 * With `DEMS_CORE_PROXY_PORT` set, the dev server forwards `/api/v1` and `/ws` to the Core server on
 * `127.0.0.1:<port>`: the browser talks to one origin, so the session cookie stays same-origin.
 * Unset (or empty): no proxy, the dev server is as before. Any other value stops the dev server.
 *
 * SECURITY (WT-2, SD-07): an entry holds `target` (and `ws`) and NOTHING else. No `headers`, no
 * `changeOrigin`, no `rewriteWsOrigin`, no `configure`, `bypass` or `rewrite` hook: the Core server's
 * Origin guard must see the `Origin` and the `Cookie` exactly as the browser sent them.
 */
function coreDevProxy(port: string | undefined): Record<string, ProxyOptions> | undefined {
  if (port === undefined || port === '') return undefined
  if (!CORE_PROXY_PORTS.includes(port)) {
    throw new Error(
      `DEMS_CORE_PROXY_PORT must be one of ${CORE_PROXY_PORTS.join(', ')} (got "${port}"). Unset it to run without the Core proxy.`,
    )
  }
  const target = `http://127.0.0.1:${port}`
  return {
    '/api/v1': { target },
    '/ws': { target, ws: true },
  }
}

export default defineConfig(({ command, isPreview }) => ({
  // plugins, resolve: unchanged
  // WT-3: the proxy exists in the dev server only. `vite build` never reads the variable, and
  // `vite preview`, which would otherwise inherit `server.proxy`, gets none.
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: command === 'serve' && !isPreview ? coreDevProxy(process.env.DEMS_CORE_PROXY_PORT) : undefined,
  },
  // preview, build, optimizeDeps, test: unchanged
}))
```

Kept exactly: the CSP plugin in `plugins`, `preview`, `build.assetsInlineLimit: 0`, `optimizeDeps`,
`test.include` and every comment. `git diff --stat acaff20 -- apps/core-web/vite.config.ts`:
`1 file changed, 38 insertions(+), 4 deletions(-)`.

No `headers`, no `changeOrigin`, no rewrite hook. A search of the function body:

```
$ sed -n '/^function coreDevProxy/,/^}/p' apps/core-web/vite.config.ts | grep -n -E "headers|changeOrigin|rewrite|configure|bypass|xfwd|autoRewrite|cookieDomainRewrite"
grep exit=1 (1 = none of the words in the function body)
```

The words appear only in the doc comment above the function, as a warning. W50's static test has to
look at the function body or at the resolved configuration, not at the whole file text.

What the file resolves to, per command and per value (`node .cache/proof-harness/resolve-config.mjs`,
Vite's `resolveConfig`, no port bound; full output in `assets/05_resolve_config.log`):

```
dev server   DEMS_CORE_PROXY_PORT=(unset)   server.proxy=undefined preview.proxy=undefined server=127.0.0.1:5173 strict=true
dev server   DEMS_CORE_PROXY_PORT=""        server.proxy=undefined preview.proxy=undefined server=127.0.0.1:5173 strict=true
dev server   DEMS_CORE_PROXY_PORT="4420"    server.proxy={"/api/v1":{"target":"http://127.0.0.1:4420"},"/ws":{"target":"http://127.0.0.1:4420","ws":true}} ...
dev server   DEMS_CORE_PROXY_PORT="4421"    server.proxy={"/api/v1":{"target":"http://127.0.0.1:4421"},"/ws":{"target":"http://127.0.0.1:4421","ws":true}} ...
dev server   DEMS_CORE_PROXY_PORT="4422"    (the same with 4422)
dev server   DEMS_CORE_PROXY_PORT="4423"    (the same with 4423)
dev server   DEMS_CORE_PROXY_PORT="4424"    THROWS: DEMS_CORE_PROXY_PORT must be one of 4420, 4421, 4422, 4423 (got "4424"). Unset it to run without the Core proxy.
dev server   DEMS_CORE_PROXY_PORT="9999"    THROWS: (the same message)
dev server   DEMS_CORE_PROXY_PORT=" 4421"   THROWS: (the same message)
dev server   DEMS_CORE_PROXY_PORT="http://evil.example:80"   THROWS: (the same message)
vite preview DEMS_CORE_PROXY_PORT="4421"    server.proxy=undefined preview.proxy=undefined
vite preview DEMS_CORE_PROXY_PORT="9999"    server.proxy=undefined preview.proxy=undefined
vite build   DEMS_CORE_PROXY_PORT="4421"    server.proxy=undefined preview.proxy=undefined
vite build   DEMS_CORE_PROXY_PORT="9999"    server.proxy=undefined preview.proxy=undefined
vitest       DEMS_CORE_PROXY_PORT=(unset)   server.proxy=undefined preview.proxy=undefined
vitest       DEMS_CORE_PROXY_PORT="4421"    server.proxy={...4421...} (an unused table: the test runner serves no page)
```

The target can only be `http://127.0.0.1:` followed by one of four literal ports: the value is compared
with a fixed list, never interpolated before the check.

---

## 2. The harness

`.cache/proof-harness/` (git-ignored: `git check-ignore -v .cache/proof-harness/harness.mjs` prints
`.gitignore:47:.cache/`). Built from `fastify` 5.12.5 and `@fastify/websocket` 11.3.1 (with `ws` 8.22.0),
all from the root `node_modules`. No package was installed, no `package.json` was touched.

| File | Purpose |
|---|---|
| `harness.mjs` | The stand-in for the Core server on `127.0.0.1:4421`. `POST /api/v1/proof/sign-in` answers with `Set-Cookie: dems_session_4421=<random>; HttpOnly; SameSite=Strict; Path=/`, `x-dems-epoch`, `x-dems-revision`, `retry-after`. `POST /api/v1/proof/echo` answers what it received. `POST /api/v1/proof/guarded` stands in for the Origin guard (the four web console origins of SR-70, exact match; anything else 403 `ORIGIN_NOT_ALLOWED`). `POST /api/v1/proof/limited` answers 429 with `retry-after`. `GET /api/v1/health` is canned. `/ws` says hello with what the upgrade carried, echoes one message, and closes with a code on the message `close:<code>`. Every request and every upgrade is logged as one JSON line with `Host`, `Origin`, `Cookie` (name, first 6 characters, and whether it equals the issued value), `Sec-Fetch-*`, any `x-forwarded-*` and the header names |
| `run_check.sh` | The live check of section 3, run inside the lane lock |
| `cdp-driver.mjs` | Drives headless Chromium over CDP with Node's built-in `WebSocket` |
| `ws-client.mjs` | A socket client that can set `Origin` and `Cookie` (a browser cannot) |
| `format-log.mjs`, `resolve-config.mjs` | Print the harness log; resolve the Vite config without a server |
| `run_cors_option.sh`, `vite-inline-nocors.mjs`, `run_backend_down.sh`, `run_lane_snippet.sh` | The two extra measurements of section 9 and the dry run of section 4 |

It holds no real secret. For W12: run it with `node .cache/proof-harness/harness.mjs` (plain ESM; add
`--import tsx` once it imports the registry). `PROOF_HARNESS_PORT` accepts 4421 to 4423.

---

## 3. The live check

One command, from the repository root (sandbox bypass for the port binding):

```
/usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock /bin/sh .cache/proof-harness/run_check.sh
```

`lockf exit=0`. Full output: `assets/05_run_check.log` (237 lines). Excerpts follow.

### 3.1 Start

Excerpt (the parent-chain lines and npm's two banner lines are left out):

```
== 06:38:45 1. start the proof harness on 127.0.0.1:4421
proof-harness listening on http://127.0.0.1:4421 pid 89532 log /Users/gsp-budi/Documents/DEMS/.cache/proof-harness/harness.log
   node pid 89532 127.0.0.1:4421

== 06:38:45 2. start Vite for lane 1: DEMS_CORE_PROXY_PORT=4421 VITE_DEMS_CORE_MODE=live npm run dev -w @dems/core-web -- --host 127.0.0.1 --port 5176 --strictPort
PID of the background job (npm): 89548; PID of the listener on 5176: 89568
   89548 89509 npm run dev --host 127.0.0.1 --port 5176 --strictPort
   89568 89548 node /Users/gsp-budi/Documents/DEMS/node_modules/.bin/vite --host 127.0.0.1 --port 5176 --strictPort
   node pid 89568 127.0.0.1:5176
     VITE v8.3.1  ready in 273 ms
     ➜  Local:   http://127.0.0.1:5176/
```

### 3.2 `curl -si` through 5176: the answer headers come back

```
-- 3a. POST /api/v1/proof/sign-in  (curl -si, Origin: http://127.0.0.1:5176):
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://127.0.0.1:5176
Vary: Origin
set-cookie: dems_session_4421=gWLFAA[rest not shown]; HttpOnly; SameSite=Strict; Path=/
x-dems-epoch: 1
x-dems-revision: 101
retry-after: 7
cache-control: no-store
content-type: application/json; charset=utf-8
-- 3b. the next request, with the cookie: POST /api/v1/proof/echo
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://127.0.0.1:5176
Vary: Origin
x-dems-epoch: 1
x-dems-revision: 102
{"host":"127.0.0.1:5176","origin":"http://127.0.0.1:5176","cookiePresent":true,"cookieEqualsIssued":true,"secFetch":{},"forwarded":{}}
-- 3c. GET /api/v1/health without an Origin header (all response headers):
HTTP/1.1 200 OK
Vary: Origin
cache-control: no-store
content-type: application/json; charset=utf-8
content-length: 68
date: Sat, 03 Oct 2026 23:38:46 GMT
connection: close

{"service":"proof-harness","port":4421,"note":"not the Core server"}
-- 3d. POST /api/v1/proof/limited (a 429 with retry-after):
HTTP/1.1 429 Too Many Requests
Access-Control-Allow-Origin: http://127.0.0.1:5176
Vary: Origin
retry-after: 42
cache-control: no-store
content-type: application/json; charset=utf-8
```

The `Access-Control-Allow-Origin` and `Vary` lines are added by the dev server, not by the harness:
finding F27-1 in section 9.

### 3.3 What reached the harness (its log)

```
---- 3a curl POST sign-in through 5176, Origin http://127.0.0.1:5176
#2 http    POST /api/v1/proof/sign-in | Host: 127.0.0.1:5176 | Origin: http://127.0.0.1:5176 | Cookie: (none) | Sec-Fetch: (none) | forwarded: {} | Connection: close
---- 3b curl POST echo through 5176 with the cookie, Origin http://127.0.0.1:5176
#3 http    POST /api/v1/proof/echo | Host: 127.0.0.1:5176 | Origin: http://127.0.0.1:5176 | Cookie: dems_session_4421=gWLFAA…(32 chars) equalsIssued=true | Sec-Fetch: (none) | forwarded: {} | Connection: close
---- 3h ws client through 5176 with the cookie, Origin http://127.0.0.1:5176
#15 upgrade GET  /ws | Host: 127.0.0.1:5176 | Origin: http://127.0.0.1:5176 | Cookie: dems_session_4421=gWLFAA…(32 chars) equalsIssued=true | Sec-Fetch: (none) | forwarded: {} | Connection: Upgrade
#16 ws-open      /ws | Host: 127.0.0.1:5176 | Origin: http://127.0.0.1:5176 | Cookie: dems_session_4421=gWLFAA…(32 chars) equalsIssued=true | Sec-Fetch: (none) | forwarded: -
#17 ws-message {"text":"ping-curl"}
#18 ws-close {"code":1000}
```

`equalsIssued=true` is the harness comparing the full value it received with the full value it issued.
The client side of the same upgrade:

```
   ws-client: handshake 101, protocol ""
   ws-client: message {"type":"hello","origin":"http://127.0.0.1:5176","host":"127.0.0.1:5176","cookiePresent":true,"cookieEqualsIssued":true}
   ws-client: message echo:ping-curl
   ws-client: closed with code 1000
```

### 3.4 The real browser (HeadlessChrome/153.0.8010.12, the predecessor's `chrome-headless-shell`, over CDP)

The page `http://127.0.0.1:5176/` was loaded (title "DEMS Edge Client · Core Console"). Page script ran
`fetch('/api/v1/proof/sign-in', { method: 'POST', credentials: 'same-origin' })`, then four more
requests, then `new WebSocket('ws://127.0.0.1:5176/ws')` twice. Harness log (excerpt; `...` marks a cut,
and line #33, the second `ws-open`, is left out):

```
---- 4 browser run: page http://127.0.0.1:5176, then page http://localhost:5176
#23 http    POST /api/v1/proof/sign-in | Host: 127.0.0.1:5176 | Origin: http://127.0.0.1:5176 | Cookie: (none) | Sec-Fetch: site=same-origin,mode=cors,dest=empty | forwarded: {} | Connection: close
#24 http    POST /api/v1/proof/echo | Host: 127.0.0.1:5176 | Origin: http://127.0.0.1:5176 | Cookie: dems_session_4421=gWLFAA…(32 chars) equalsIssued=true | Sec-Fetch: site=same-origin,mode=cors,dest=empty | forwarded: {} | Connection: close
#25 http    GET  /api/v1/health | Host: 127.0.0.1:5176 | Origin: (none) | Cookie: dems_session_4421=gWLFAA…(32 chars) equalsIssued=true | Sec-Fetch: site=same-origin,mode=cors,dest=empty | forwarded: {} | Connection: close
#26 http    POST /api/v1/proof/limited | Host: 127.0.0.1:5176 | Origin: http://127.0.0.1:5176 | Cookie: dems_session_4421=gWLFAA…(32 chars) equalsIssued=true | ...
#27 http    POST /api/v1/proof/guarded | Host: 127.0.0.1:5176 | Origin: http://127.0.0.1:5176 | Cookie: dems_session_4421=gWLFAA…(32 chars) equalsIssued=true | ...
#28 upgrade GET  /ws | Host: 127.0.0.1:5176 | Origin: http://127.0.0.1:5176 | Cookie: dems_session_4421=gWLFAA…(32 chars) equalsIssued=true | Sec-Fetch: (none) | forwarded: {} | Connection: Upgrade
#29 ws-open      /ws | Host: 127.0.0.1:5176 | Origin: http://127.0.0.1:5176 | Cookie: dems_session_4421=gWLFAA…(32 chars) equalsIssued=true | Sec-Fetch: (none) | forwarded: -
#30 ws-message {"text":"ping-1"}
#31 ws-close {"code":1000}
#32 upgrade GET  /ws | Host: 127.0.0.1:5176 | Origin: http://127.0.0.1:5176 | Cookie: dems_session_4421=gWLFAA…(32 chars) equalsIssued=true | ...
#34 ws-message {"text":"close:4403"}
#35 ws-close {"code":4403}
```

What the page script and the browser saw (`assets/05_browser_run.json`):

| Observation | Value |
|---|---|
| Sign-in answer read by script | status 200; `x-dems-epoch` "1"; `x-dems-revision` "105"; `retry-after` "7" |
| `Set-Cookie` readable by script | `null`; `document.cookie` is the empty string (the cookie is `HttpOnly`) |
| Cookie as the browser stored it (CDP `Network.getCookies`) | name `dems_session_4421`, domain `127.0.0.1`, path `/`, `httpOnly: true`, `sameSite: "Strict"`, `secure: false`, `session: true` |
| Second request (echo) | `cookiePresent: true`, `cookieEqualsIssued: true`, `origin: "http://127.0.0.1:5176"`, `sec-fetch-site: same-origin` |
| 429 through the proxy | status 429, `retry-after` "42" |
| Socket `/ws` | `hello` with `cookiePresent: true`, `cookieEqualsIssued: true`, `origin: http://127.0.0.1:5176`; then `echo:ping-1`; close code 1000 |
| Socket closed by the server with 4403 | The browser's `close` event reports code 4403 |
| Page errors | none (`consoleErrors: []`) |

Three facts about the browser that the specification assumed and that are now measured:

- A same-origin POST carries `Origin`; a same-origin GET carries **no** `Origin` but does carry the cookie (line #25). That is the case OR-3 accepts.
- The socket upgrade carries `Origin` and the cookie, and **no `Sec-Fetch-*` header** (lines #28, #32).
- A close code sent by the server (4403) reaches the page through the proxy.

### 3.5 `Host`

The harness sees the host of the dev server as the browser used it: `Host: 127.0.0.1:5176` (and
`Host: localhost:5176` for a page opened under `localhost`), not `127.0.0.1:4421`. That is what "no
`changeOrigin`" means. The proxy adds no `x-forwarded-*`, `forwarded` or `via` header (`forwarded: {}`
on every line). It sends `Connection: close` to the backend on HTTP requests.

### 3.6 Vite's own socket

With the proxy block present, in the browser (CDP network events):

```
"url": "ws://127.0.0.1:5176/?token=…", "sent": { "origin": "http://127.0.0.1:5176", "protocol": "vite-hmr" }, "status": 101, "acceptedProtocol": "vite-hmr", "frames": ["{\"type\":\"connected\"}"]
```

and in the browser's console log: `"[vite] connecting..."`, `"[vite] connected."`. With the `ws` client:
`handshake 101, protocol "vite-hmr"`, `message {"type":"connected"}`. Vite's own pages answer as before:
`GET / -> 200 text/html`, `GET /src/main.tsx -> 200 text/javascript`, `GET /@vite/client -> 200 text/javascript`.
The Vite log shows no proxy error during the run. Not one request of Vite's own socket reached the harness.

### 3.7 The negative case of SR-70, as far as a harness can show it

The `Origin` arrives byte for byte as sent, so the server's guard can refuse it. Through the dev server,
against the stand-in guard:

```
   Origin: http://localhost:5176        -> 403 {"error":{"code":"ORIGIN_NOT_ALLOWED", ...
   Origin: http://127.0.0.1:5174        -> 403 {"error":{"code":"ORIGIN_NOT_ALLOWED", ...
   Origin: null                         -> 403 {"error":{"code":"ORIGIN_NOT_ALLOWED", ...
   Origin: http://127.0.0.1:5176/       -> 403 {"error":{"code":"ORIGIN_NOT_ALLOWED", ...
   Origin: HTTP://127.0.0.1:5176        -> 403 {"error":{"code":"ORIGIN_NOT_ALLOWED", ...
   Origin: http://127.0.0.1:5176        -> 200 {"ok":true,"origin":"http://127.0.0.1:5176"}
   (no Origin header)                   -> 403 {"error":{"code":"ORIGIN_NOT_ALLOWED", ...
```

```
#6 http    POST /api/v1/proof/guarded | Host: 127.0.0.1:5176 | Origin: http://localhost:5176 | ...
#7 http    POST /api/v1/proof/guarded | Host: 127.0.0.1:5176 | Origin: http://127.0.0.1:5174 | ...
#8 http    POST /api/v1/proof/guarded | Host: 127.0.0.1:5176 | Origin: null | ...
#9 http    POST /api/v1/proof/guarded | Host: 127.0.0.1:5176 | Origin: http://127.0.0.1:5176/ | ...
#10 http    POST /api/v1/proof/guarded | Host: 127.0.0.1:5176 | Origin: HTTP://127.0.0.1:5176 | ...
#19 upgrade GET  /ws | Host: 127.0.0.1:5176 | Origin: http://localhost:5176 | Cookie: (none) | ...
```

And with the real browser, the same page opened at `http://localhost:5176/` (the address WT-2a forbids):

```
#36 http    POST /api/v1/proof/guarded | Host: localhost:5176 | Origin: http://localhost:5176 | Cookie: (none) | Sec-Fetch: site=same-origin,mode=cors,dest=empty | forwarded: {} | Connection: close
```

The page script received status 403 with code `ORIGIN_NOT_ALLOWED`. The cookie issued under `127.0.0.1`
was not sent to `localhost` (a different cookie host).

This is a stand-in guard. The test against the real guard is W23 (unit) and W50 (through the dev server).

### 3.8 Without the variable: the dev server as before

Excerpt (`...` marks lines left out):

```
== 06:38:51 6. Vite WITHOUT DEMS_CORE_PROXY_PORT (the dev server as before)
npm pid 89730, listener pid 89750
-- GET /api/v1/health          -> 200 text/html; body starts: <!doctype html> <html lang="en" class="dark" data-theme="dar
-- POST /api/v1/proof/sign-in  ->
   HTTP/1.1 404 Not Found
   Access-Control-Allow-Origin: http://127.0.0.1:5176
   Vary: Origin
   ...
   Content-Length: 0
-- socket /ws:
   ...
   ws-client: no handshake answer within 3 s (nothing handled the upgrade)
   ...
-- Vite's own socket:
   ...
   ws-client: handshake 101, protocol "vite-hmr"
   ws-client: message {"type":"connected"}
   ws-client: closed with code 1000
-- requests the harness logged before / after this phase: 24 / 24
```

No request reached the harness. `/api/v1/health` is answered by Vite's own page fallback, as it was
before this row.

### 3.9 An invalid value stops the dev server

```
== 06:38:55 7. Vite with an invalid value: DEMS_CORE_PROXY_PORT=9999
the dev server command ended by itself, exit status 1
   > @dems/core-web@0.1.0 dev
   > vite --host 127.0.0.1 --port 5176 --strictPort
   failed to load config from /Users/gsp-budi/Documents/DEMS/apps/core-web/vite.config.ts
   error when starting dev server:
   Error: DEMS_CORE_PROXY_PORT must be one of 4420, 4421, 4422, 4423 (got "9999"). Unset it to run without the Core proxy.
   ... (four stack lines)
port 5176 is not bound
```

---

## 4. Lane start details (settles 02_plan §5.3; later rows copy these lines)

Run from `/Users/gsp-budi/Documents/DEMS`, never from a subfolder, inside one
`/usr/bin/lockf -k -t 900 .locks/core-server.lane<K>.lock /bin/sh <row script>`. The whole `lockf`
command needs the per-command sandbox bypass (P10).

```sh
K=1; PORT=$((4420 + K)); VITE=$((5175 + K))          # lane 1: 4421 and 5176; lane 2: 4422 and 5177; lane 3: 4423 and 5178

# backend (unchanged from §5.3; the variable is DEMS_CORE_PORT). NOT run in this row: no backend exists yet
DEMS_CORE_PORT=$PORT npm run start -w @dems/core-server > .locks/core-server.lane$K.log 2>&1 &
echo $! > .locks/core-server.lane$K.pid

# web: Vite for the lane, IPv4 explicitly, proxying /api/v1 and /ws to the lane backend
DEMS_CORE_PROXY_PORT=$PORT VITE_DEMS_CORE_MODE=live \
  npm run dev -w @dems/core-web -- --host 127.0.0.1 --port $VITE --strictPort > .locks/core-server.lane$K.vite.log 2>&1 &
VITE_NPM_PID=$!; echo $VITE_NPM_PID > .locks/core-server.lane$K.vite.pid

# wait until it listens (about 0.3 s here), then note the listener
i=0; until lsof -nP -iTCP:$VITE -sTCP:LISTEN >/dev/null 2>&1 || [ $i -ge 120 ]; do i=$((i + 1)); sleep 0.25; done
lsof -nP -iTCP:$VITE -sTCP:LISTEN            # expect: node <pid> ... TCP 127.0.0.1:517x (LISTEN)

# ... the check: the browser and curl use http://127.0.0.1:$VITE, never localhost ...

# stop Vite: SIGTERM to the npm PID is enough; then verify, and fall back to the listener PID
kill "$VITE_NPM_PID"; wait "$VITE_NPM_PID" 2>/dev/null        # exit status 143
i=0; while lsof -nP -iTCP:$VITE -sTCP:LISTEN >/dev/null 2>&1 && [ $i -lt 20 ]; do i=$((i + 1)); sleep 0.25; done
P=$(lsof -nP -tiTCP:$VITE -sTCP:LISTEN) && [ -n "$P" ] && kill "$P"
rm -f .locks/core-server.lane$K.vite.pid

# stop the backend (as §5.3), with the same check by the port, then confirm
kill "$(cat .locks/core-server.lane$K.pid)"; rm -f .locks/core-server.lane$K.pid
i=0; while lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1 && [ $i -lt 20 ]; do i=$((i + 1)); sleep 0.25; done
P=$(lsof -nP -tiTCP:$PORT -sTCP:LISTEN) && [ -n "$P" ] && kill "$P"
lsof -nP -iTCP:$PORT -iTCP:$VITE -sTCP:LISTEN               # expect no output, exit 1
```

Main instance (W86, W94 to W96, W98), under `.locks/core-server.lock` and `.locks/vite.lock`: the same
web line with `DEMS_CORE_PROXY_PORT=4420` and no `--port` (the file's own `port: 5173`):

```sh
DEMS_CORE_PROXY_PORT=4420 VITE_DEMS_CORE_MODE=live npm run dev -w @dems/core-web -- --host 127.0.0.1 --strictPort
```

The web lines above were run once more exactly as written (only the log and PID file went to the scratch
folder), `assets/05_run_lane_snippet.log`:

```
waited 2 quarter seconds
COMMAND   PID     USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    94574 gsp-budi   14u  IPv4 0x46d0d88dd5cabef2      0t0  TCP 127.0.0.1:5176 (LISTEN)
...
npm exit status 143
fallback kill needed: no
lsof exit 1 (1 with no output: no listener)
```

The backend lines are those of §5.3 and were **not** run here. Whether SIGTERM to the `npm` PID also
ends a server started through `tsx` is for the first row that starts one to confirm; the check by the
port after the kill is there for that case.

What was settled, each measured in section 3:

| Detail | Settled as | Evidence |
|---|---|---|
| The exact flags of `vite` (PA-06) | `--host 127.0.0.1 --port $VITE --strictPort` after `--`. The command-line port overrides `port: 5173` of the file; no variable for the Vite port is needed, so the file keeps 5173 | Listener `node pid 89568 127.0.0.1:5176` |
| Address family | `127.0.0.1` only. The file already says `host: '127.0.0.1'`; the flag repeats it so that the command line shows it (P4) | The same line; nothing on `[::1]:5176` |
| The backend port variable for the proxy | `DEMS_CORE_PROXY_PORT`, one of 4420, 4421, 4422, 4423. It must be set for a proxy to exist, also on the main instance (decision D27-2) | Sections 1, 3.8, 3.9 |
| Which PID `$!` is | The `npm` process. Its only child is the `node .../vite` process, which holds the port (no shell in between) | `89548 89509 npm run dev ...` / `89568 89548 node .../vite ...` |
| Stopping by the npm PID | Works: `kill <npm pid>` frees the port within 5 s; npm's exit status is 143 | "port 5176 was released within 5 s after the kill of the npm PID"; "listener pid 89568 gone" |
| Stopping by the port | Also works: `kill <listener pid>` ends npm too (exit status 143) | "the npm job (89730) ended by itself, exit status 143" |
| Rule | Kill the npm PID, wait for it, check the port with `lsof`, and kill the listener found by the port only if it is still there | — |
| Vite's log and PID files of a lane | Proposed: `.locks/core-server.lane<k>.vite.log` and `.vite.pid`. The removal line RB-11 (`.locks/core-server*.pid`, `*.log`) already covers these names. P14 names no file for them, so this row wrote its own under `.cache/proof-harness/out/` (decision D27-3) | — |
| `VITE_DEMS_CORE_MODE=live` | Kept in the line as §5.3 has it. Nothing reads it before W50; the run of section 3 had it set | — |
| First start after an install | Vite prints "Re-optimizing dependencies because lockfile has changed" and is ready in about 0.3 s. No action needed | `assets/05_run_check.log` |
| Checking for listeners | `lsof` works inside the sandbox (43 listener lines visible); `pgrep` does not ("Cannot get process list") | Section 8 |

---

## 5. The packaged build is unaffected

Four builds into a scratch folder, two with the file as at `acaff20` (hash `7374427`), two after the
change (hash `cb48698`), in the packager's way (`vite build --outDir <dir> --emptyOutDir` in the web
workspace, with `VITE_DEMS_CORE_ORIGIN=same-origin` for the packaged ones). `assets/05_build_compare.log`:

```
exit packaged(var=9999)=0
exit packaged(var=4421)=0
exit plain(unset)=0
--- diff -r before-packaged after-packaged-var9999
IDENTICAL
--- diff -r before-packaged after-packaged-var4421
IDENTICAL
--- diff -r before-plain after-plain
IDENTICAL
--- file counts
before-packaged 511 files, tree sha256 27f7a8b43ebaebcb
after-packaged-var9999 511 files, tree sha256 27f7a8b43ebaebcb
after-packaged-var4421 511 files, tree sha256 27f7a8b43ebaebcb
before-plain 511 files, tree sha256 6e74094d06b9b93d
after-plain 511 files, tree sha256 6e74094d06b9b93d
--- CSP meta in packaged index.html (before / after)
.../after-packaged-var9999/index.html:1
.../after-plain/index.html:0
.../before-plain/index.html:0
.../before-packaged/index.html:1
--- proxy strings in any built file
(end)
```

So: the build output is the same byte for byte; the CSP meta tag is in the packaged page and not in the
plain one, as before; a build ignores `DEMS_CORE_PROXY_PORT` even when it holds an invalid value; no
built file contains the variable name or a `127.0.0.1:442x` address. `git diff acaff20 --
apps/core-web/src/lib/packaged-csp.ts apps/mock-core` prints nothing (0 bytes; AC-C-35). The scratch
builds (213 MB) were removed after the comparison.

`vite.config.ts` is one of the packager's fingerprinted inputs (`scripts/release/build-web-packages.ts:137`),
so the input fingerprint of a future package changes; the specification expects that (WT-3, D9 DN-1).

---

## 6. Gate (SG) and test ledger (P24)

`assets/05_gate_runs.log`:

```
## before (config hash 7374427, 06:31:55-06:32:29 WIB)
 Test Files  39 passed (39)
      Tests  438 passed (438)
   Duration  33.66s (tests 70%, import 13%, environment 11%, setup 4%, transform 2%)
exit=0
## after (config hash cb48698, 06:40:35-06:41:09 WIB)
 Test Files  39 passed (39)
      Tests  438 passed (438)
   Duration  33.87s (tests 70%, import 12%, environment 11%, setup 4%, transform 2%)
exit=0

> @dems/core-web@0.1.0 typecheck
> tsc -b

typecheck exit=0

> @dems/core-web@0.1.0 lint
> oxlint

lint exit=0
```

Command: `npm run test -w @dems/core-web -- --maxWorkers=2`. Both runs saw **no** failure: the two
calendar-dependent tests named in `initialization/02_baseline_gate.md` (F-1 `sim-fetch.test.ts`, F-2
`storage-page.test.tsx`) were already fixed in the tree by W01 when the first run started.

| Workspace | Before | After | Added by this row |
|---|---|---|---|
| `@dems/core-web` | 438 tests, 39 files, 0 failed | 438 tests, 39 files, 0 failed | 0 (no test file; the static test of the config is W50's) |

No other workspace was written.

---

## 7. Rollback (R-CO, R-NEW)

Run only on the controller's instruction.

```sh
# R-CO: the tracked file (W05 is its only writer in this task)
git checkout acaff20 -- apps/core-web/vite.config.ts

# P23 pre-image: saved before the first edit; it is empty (0 bytes), because the file equalled acaff20
#   git diff acaff20 -- apps/core-web/vite.config.ts > .cache/rollback/W05.pre.patch
# An empty patch needs the flag (git 2.55.0: "error: No valid patches in input (allow with "--allow-empty")"):
git apply --allow-empty .cache/rollback/W05.pre.patch

# R-NEW: the scratch folder (W12 still uses the harness; remove it only after W12, or with RB-17)
rm -rf .cache/proof-harness
# the lane lock file, with RB-11
rm -f .locks/core-server.lane1.lock
```

The copies under `implementation/assets/05_*` are documentation and stay.

---

## 8. Nothing is left running

End of the main check, and the same after each extra run:

```
== 06:38:55 9. stop the harness and check that nothing is left
harness exit status: 0
-- lsof -nP -iTCP:4421 -iTCP:5176 -iTCP:9396 -sTCP:LISTEN
   (lsof exit 1; 1 with no output means no listener)
-- listeners on 5173, 5174, 5175: unchanged (0 lines before and after)
-- processes of this check still alive:
   (none)
```

Repeated on its own after the last run, at 06:47:07 WIB (inside the sandbox, where `lsof` sees 43
listener lines of other processes):

```
$ lsof -nP -iTCP:4421 -iTCP:5176 -iTCP:9396 -sTCP:LISTEN
exit=1
```

`.locks/` holds one new entry from this row: `core-server.lane1.lock` (the lane lock, kept by `lockf -k`).
`.locks/core-server.lane1.pid` held the harness PID during the two runs that had a harness and was removed at the end of each.
`git status --short -- apps/core-web` shows `vite.config.ts` and the two files of W01, nothing else
(`src/routeTree.gen.ts` was not rewritten by the dev server).

---

## 9. Findings, decisions and deviations for the controller

### F27-1 (security): the dev server adds `Access-Control-Allow-Origin` to answers that pass through it

Vite's dev server has a CORS layer of its own, on by default, that runs before the proxy
(`node_modules/vite/dist/node/chunks/node.js:24875` before `:24888`; default
`cors: { origin: /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/ }`, `:781`, `:24986`).
Measured:

| Request through 5176 | What the dev server does |
|---|---|
| Any request with an `Origin` on a loopback host, any port (`http://127.0.0.1:5176`, `http://127.0.0.1:5174`, `http://localhost:<n>`) | Adds `Access-Control-Allow-Origin: <that origin>` and `Vary: Origin` to the proxied answer (seen on 200, 403, 429 and on the 502 of a backend that is down) |
| A request without `Origin` (the `curl` of AC-C-33) | Adds `Vary: Origin` only. **AC-C-33 still passes** (section 3, 3c) |
| A CORS preflight (`OPTIONS` with `Access-Control-Request-Method`) | Answers it itself with 204 and `Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE`; from a loopback origin also with `Access-Control-Allow-Origin`. The preflight never reaches the backend |
| A request on a proxied path with `Origin: http://127.0.0.1:5174`, backend down (`assets/05_run_lane_snippet.log`) | `HTTP/1.1 502 Bad Gateway` with `Access-Control-Allow-Origin: http://127.0.0.1:5174`. With `Origin: https://example.org`: `Vary: Origin` only |
| Any request | Never sends `Access-Control-Allow-Credentials` |

What it means. SR-04 and OR-5 ("no `Access-Control-Allow-*` header is sent") stay true for the Core
server, but a browser in Live mode does see such a header, put there by the dev server. A page of
another loopback origin (the other project on `127.0.0.1:5174`, or anything under `localhost`) can
therefore read the answer to a request it sends through the dev server **without** credentials, and can
get a request that needs a preflight past it. It cannot read the answer to a request sent with the
cookie (no `Access-Control-Allow-Credentials`). It can still make the browser send the cookie
(`SameSite=Strict` does not stop it: every port of `127.0.0.1` is one site; not measured in this row,
it is the statement of OR-8 and G-08), and that request arrives
with the page's real `Origin`, unchanged (section 3.7), so the Core server's guard refuses it. By the
decision table of 01_specs §14.2 an origin outside the two lists gets 403 in every row, so what such a
page can read is a 403 envelope. **The Origin guard stays the control, as designed; the proof result is
not affected.** The header is extra surface that the security design review did not have in view.

An option, measured but **not applied**: `cors: false` in the `server` block. With it (inline override,
no file change; `assets/05_run_cors_option.log`): no `Access-Control-Allow-Origin` on any of the five API
answers in the browser, the preflight goes to the backend (the harness answers 404), and the page, its
sign-in round trip, the `/ws` socket and Vite's own socket all still work in HeadlessChrome 153
(`page errors: []`). It was not applied because the row's mandate is the proxy block only, and the
option also changes the dev server in Simulated mode.

**Later the same day: applied by ruling D29 (F30), only while the proxy is on. See section 12.**

### F27-2: `vite preview` would inherit the proxy

Vite resolves `preview.proxy` as `preview?.proxy ?? server.proxy` (`node.js:35361`). A plain
`server.proxy` would therefore also be active under `npm run preview`, against WT-3 ("`preview` and
`build` have no proxy"). Closed in the file: the block is returned only for `command === 'serve' &&
!isPreview` (section 1, the `vite preview` and `vite build` lines). This is why `defineConfig` now takes a
function. Nothing imports the config's default export: a search for `vite.config` in `apps/core-web/src`,
`packages/shared/src`, `packages/shared/test`, `apps/mock-core/src`, `apps/mock-core/test` and `scripts`
finds the packager's input list (`scripts/release/build-web-packages.ts:137`) and one comment
(`apps/core-web/src/lib/packaged-csp.ts:30`); `tsconfig.node.json` includes the file for the typecheck.

### F27-3: what the backend sees besides `Origin` and `Cookie`

- `Host` is the dev server's (`127.0.0.1:517x`), section 3.5. OR-10 does not check `Host`; if a later row ever adds such a check it must accept the four console hosts.
- The socket upgrade of a browser has no `Sec-Fetch-*` header, so the optional `Sec-Fetch-Site` check that OR-10 declined could never have covered the upgrade.
- The proxy sends `Connection: close` to the backend: one TCP connection per REST call from the console. W98 measures round trips through it.

### F27-4: the two keys are prefix matches

Vite matches a key that does not start with `^` by `url.startsWith(key)` (`node.js:19727-19733`). Any
dev-server path that begins with `/ws` or `/api/v1` is forwarded (also `/wsx`). No route, public file or
source path of the console begins with either today (`ls apps/core-web/src/routes`: `login`, `_app/`
with `dashboard`, `devices`, `evidence`, `network-time`, `security-audit`, `session`, `stack-check`,
`storage`, `system`, `developer`). Later web rows must not create one.

### F27-5: the proxy with the backend down (WT-4, measured)

`assets/05_run_backend_down.log`: with nothing on 4421, `GET /api/v1/health` through 5176 answers
`HTTP/1.1 502 Bad Gateway`, `Content-Type: text/plain`, an empty body (0 bytes); the `/ws` upgrade ends
with "socket hang up" (close code 1006 at the client); the console page itself still answers 200. The
Vite log gains one `http proxy error: <path>` line with `Error: connect ECONNREFUSED 127.0.0.1:4421` per
request. That is the answer "without a contract envelope" which CL-21 maps to `CORE_OFFLINE`.

### F27-6: state of the host during the row

Nothing listened on 5173, 5174 or 5175 at 06:38 (the other project was not running). The marker
folders `.locks/vite.users/` and `.locks/mock-core.users/` are empty (both changed at 06:36); when this
row began, `.locks/vite.users/` still held `user-manual-test`. This row did not touch them; it reports
what it saw, because the rollback line RB-16 recreates exactly these two markers.

### Decisions needed

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| D27-1 | The dev server's CORS header (F27-1) | (a) accept and record it as a residual of Live mode; (b) add `cors: false` to the `server` block of `vite.config.ts` (one line; measured to work); (c) the same, only while the proxy is on | Give it to the security reviewer, because it touches OR-5 and SD-07. If a change is wanted, (b) or (c) is one line in a file whose only writer is W05, so it needs a slot for this row or for W50 |
| D27-2 | Unset variable means **no proxy** (the delegation's wording), while WT-1 and 02_plan §5.3 read as "4420 by default" | Record it and correct the two texts, or make 4420 the default | Keep "unset = no proxy": Simulated mode on 5173 then stays exactly as it was. The main-instance rows (W86, W94 to W96, W98) start Vite with `DEMS_CORE_PROXY_PORT=4420` (section 4) |
| D27-3 | Names of a lane's Vite log and PID file | `.locks/core-server.lane<k>.vite.log` and `.vite.pid`, or none (a shell variable inside the lock-held script) | The proposed names; RB-11 already removes them. P14 gains one sentence |

### Deviations from the plan

| # | Deviation | Reason |
|---|---|---|
| 1 | `defineConfig` takes a function instead of an object | F27-2, and so that a build never reads the variable |
| 2 | The harness is a plain `.mjs` run with `node`, not with `node --import tsx`, and its POST routes are proof routes (`/api/v1/proof/*`), not the three canned contract answers of 02_plan §6 | The delegation asked for a tiny server built only from installed packages. The contract-valid answers need the registry and belong to W12, which extends the harness |
| 3 | Three lane-1 runs beyond the main check: the `cors: false` option (F27-1), the backend-down case (F27-5) and a dry run of the documented start lines (section 4) | Each is a few seconds inside the lane lock and answers a question a later row would otherwise have to stop for |
| 4 | Copies of the evidence and of four scripts under `implementation/assets/05_*` | The scratch folder is deleted by the row that last uses it |

No new package, no `package.json` change, no other tracked source file.

---

## 10. Open items for W50 (the first web row on the proxy)

1. The negative test of AC-C-102 against the **real** Origin guard: a POST to `/api/v1/auth/sign-in` through the dev server with a foreign `Origin` and with `http://localhost:5173`, each answered 403 `ORIGIN_NOT_ALLOWED` by the Core server. Here only a stand-in answered.
2. The static test of the config (AC-C-102): look at the body of `coreDevProxy` or at the resolved configuration; the forbidden option names occur in the doc comment.
3. AC-C-34 in full: `hello` and `heartbeat` from the real server on the browser's socket, and a hot reload after a source edit. This row showed that Vite's socket connects and receives `connected`; it edited no source file, so it did not trigger a reload.
4. AC-C-33 with the real server: the `curl` without `Origin` is expected to pass (F27-1).

---

## 11. Commands run (in order)

| # | Command (from `/Users/gsp-budi/Documents/DEMS`) | Sandbox | Exit |
|---|---|---|---|
| 1 | Reads of the binding documents and of Vite's source (`sed`, `grep`) | in | 0 |
| 2 | `git diff acaff20 -- apps/core-web/vite.config.ts > .cache/rollback/W05.pre.patch` (0 bytes) | in | 0 |
| 3 | `npm run test -w @dems/core-web -- --maxWorkers=2` (before) | in | 0 |
| 4 | Two builds before the edit: `[VITE_DEMS_CORE_ORIGIN=same-origin] npm exec -w @dems/core-web -- vite build --outDir <scratch> --emptyOutDir` | in | 0 |
| 5 | The edit of `apps/core-web/vite.config.ts` | — | — |
| 6 | `npm run typecheck -w @dems/core-web`; `npm run lint -w @dems/core-web` | in | 0; 0 |
| 7 | `node .cache/proof-harness/resolve-config.mjs` | in | 0 |
| 8 | Three builds after the edit and `diff -r` against the two before | in | 0 |
| 9 | `node -e` bind probe on 4421 | in | `listen EPERM` |
| 10 | `/usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock /bin/sh .cache/proof-harness/run_check.sh` | bypass | 0 |
| 11 | `/usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock /bin/sh .cache/proof-harness/run_cors_option.sh` | bypass | 0 |
| 12 | `npm run test -w @dems/core-web -- --maxWorkers=2` (after); typecheck; lint | in | 0; 0; 0 |
| 13 | `/usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock /bin/sh .cache/proof-harness/run_backend_down.sh` | bypass | 0 |
| 14 | `/usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock /bin/sh .cache/proof-harness/run_lane_snippet.sh` | bypass | 0 |
| 15 | `lsof -nP -iTCP:4421 -iTCP:5176 -iTCP:9396 -sTCP:LISTEN` | in | 1, no output |

---

## 12. Follow-up: dev CORS off with the proxy (D29, F30)

Added 2026-10-04 07:14 to 07:25 WIB, on the controller's ruling on finding F27-1 (recorded as F30,
decision D29): the option measured in section 9 is applied. **While the proxy is on, the dev server's
own CORS layer is off. Without the variable nothing changes.** This section supersedes three statements
above: "not applied" in F27-1, decision D27-1 (now closed), and the block quoted in section 1 (the
current block is 12.1).

| Field | Value |
|---|---|
| Result | With the proxy on, no answer that passes through the dev server carries an `Access-Control-Allow-*` header, and the dev server no longer answers a CORS preflight itself. The same-origin flow works unchanged in the real browser. With the variable unset the dev server's answer headers are the same as with the file of `acaff20` |
| Tracked file changed | `apps/core-web/vite.config.ts` only. Hash `f6dde3b` (step 27 left `cb48698`; `acaff20` has `7374427`). `git diff --stat acaff20`: `1 file changed, 47 insertions(+), 4 deletions(-)` |
| Build output | Byte-identical before and after this edit, with and without the variable; same tree hashes as in section 5 |
| Gate | 438 passed of 438 in 39 files (one run, no failure); typecheck and lint exit 0 |
| Lane 1 | Busy at 07:14 (step 34 held the lock, its harness on 4421). Waited; free at 07:17. Two runs under the lock: 07:19:04 to 07:19:15 and 07:20:10 to 07:20:14 |
| Scratch | `.cache/proof-harness-w05b/` (git-ignored, `.gitignore:47`): this row's own copies of the harness, the driver and the socket client, taken from `implementation/assets/05_*`. Nothing under `.cache/proof-harness/` was written (step 34 is extending it; its `harness.mjs` was last changed at 07:09, not by this row) |
| Sandbox bypass | Two commands, the two `lockf` runs |
| Left running | Nothing (12.7) |

### 12.1 The change

`diff -u` from the file as step 27 left it (rebuilt copy, hash `cb4869870d175d62b6668cf9425098f677c8ae7b`,
the value recorded then) to the file now (`f6dde3b52909d285fe112792a5fecfa9ed635615`):

```diff
@@ -3,7 +3,7 @@
 import tailwindcss from '@tailwindcss/vite'
 import { tanstackRouter } from '@tanstack/router-plugin/vite'
 import react from '@vitejs/plugin-react'
-import { defineConfig, type ProxyOptions } from 'vite'
+import { defineConfig, type ServerOptions } from 'vite'
 import { packagedCspPlugin } from './src/lib/packaged-csp.ts'
 
 /** Ports a Core server listens on: the main instance and lanes 1 to 3 (backend task 02_plan §3.4, §4.2). */
@@ -18,9 +18,15 @@
  * SECURITY (WT-2, SD-07): an entry holds `target` (and `ws`) and NOTHING else. No `headers`, no
  * `changeOrigin`, no `rewriteWsOrigin`, no `configure`, `bypass` or `rewrite` hook: the Core server's
  * Origin guard must see the `Origin` and the `Cookie` exactly as the browser sent them.
+ *
+ * CORS (backend task decisions D29, F30): while the proxy is on, the dev server's own CORS layer is
+ * off. It runs before the proxy, so it would add `Access-Control-Allow-Origin` to the Core server's
+ * answers for any loopback origin and answer preflights itself; the Core server sends no such thing
+ * (SR-04, OR-5). Without the variable nothing is returned, so Vite's default stays and Simulated-mode
+ * dev is unchanged.
  */
-function coreDevProxy(port: string | undefined): Record<string, ProxyOptions> | undefined {
-  if (port === undefined || port === '') return undefined
+function coreDevProxy(port: string | undefined): Pick<ServerOptions, 'proxy' | 'cors'> {
+  if (port === undefined || port === '') return {}
   if (!CORE_PROXY_PORTS.includes(port)) {
     throw new Error(
       `DEMS_CORE_PROXY_PORT must be one of ${CORE_PROXY_PORTS.join(', ')} (got "${port}"). Unset it to run without the Core proxy.`,
@@ -28,8 +34,11 @@
   }
   const target = `http://127.0.0.1:${port}`
   return {
-    '/api/v1': { target },
-    '/ws': { target, ws: true },
+    proxy: {
+      '/api/v1': { target },
+      '/ws': { target, ws: true },
+    },
+    cors: false,
   }
 }
 
@@ -42,13 +51,13 @@
   resolve: {
     alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
   },
-  // WT-3: the proxy exists in the dev server only. `vite build` never reads the variable, and
-  // `vite preview`, which would otherwise inherit `server.proxy`, gets none.
+  // WT-3: the proxy (with its `cors: false`) exists in the dev server only. `vite build` never reads
+  // the variable, and `vite preview`, which would otherwise inherit both from `server`, gets neither.
   server: {
     host: '127.0.0.1',
     port: 5173,
     strictPort: true,
-    proxy: command === 'serve' && !isPreview ? coreDevProxy(process.env.DEMS_CORE_PROXY_PORT) : undefined,
+    ...(command === 'serve' && !isPreview ? coreDevProxy(process.env.DEMS_CORE_PROXY_PORT) : {}),
   },
   preview: { host: '127.0.0.1', port: 4173, strictPort: true },
```

`coreDevProxy` now returns the two `server` options that belong together, or an empty object. Without
the variable the `server` object therefore holds exactly `host`, `port` and `strictPort`, as at
`acaff20`. The unchanged rule still holds; a search of the function body:

```
$ sed -n '/^function coreDevProxy/,/^}/p' apps/core-web/vite.config.ts | grep -n -E "headers|changeOrigin|rewrite|configure|bypass|xfwd|autoRewrite|cookieDomainRewrite"
grep exit=1 (1 = none)
```

What the file resolves to (`node .cache/proof-harness-w05b/resolve-config.mjs`, no port bound; the
default is written `<default>` here for
`{"origin":"RegExp /^https?:\\/\\/(?:(?:[^:]+\\.)?localhost|127\\.0\\.0\\.1|\\[::1\\])(?::\\d+)?$/"}`):

```
config file: apps/core-web/vite.config.ts
dev server   var=(unset)  server.proxy=undefined | server.cors=<default> | preview.proxy=undefined | preview.cors=<default>
dev server   var=""       server.proxy=undefined | server.cors=<default> | preview.proxy=undefined | preview.cors=<default>
dev server   var="4420"   server.proxy={"/api/v1":{"target":"http://127.0.0.1:4420"},"/ws":{"target":"http://127.0.0.1:4420","ws":true}} | server.cors=false | ...
dev server   var="4421"   server.proxy={"/api/v1":{"target":"http://127.0.0.1:4421"},"/ws":{"target":"http://127.0.0.1:4421","ws":true}} | server.cors=false | ...
dev server   var="4423"   server.proxy={"/api/v1":{"target":"http://127.0.0.1:4423"},"/ws":{"target":"http://127.0.0.1:4423","ws":true}} | server.cors=false | ...
dev server   var="9999"   THROWS: DEMS_CORE_PROXY_PORT must be one of 4420, 4421, 4422, 4423 (got "9999"). Unset it to run without the Core proxy.
vite preview var=(unset)  server.proxy=undefined | server.cors=<default> | preview.proxy=undefined | preview.cors=<default>
vite preview var="4421"   server.proxy=undefined | server.cors=<default> | preview.proxy=undefined | preview.cors=<default>
vite build   var=(unset)  server.proxy=undefined | server.cors=<default> | preview.proxy=undefined | preview.cors=<default>
vite build   var="4421"   server.proxy=undefined | server.cors=<default> | preview.proxy=undefined | preview.cors=<default>
vite build   var="9999"   server.proxy=undefined | server.cors=<default> | preview.proxy=undefined | preview.cors=<default>
vitest       var=(unset)  server.proxy=undefined | server.cors=<default> | preview.proxy=undefined | preview.cors=<default>
```

A control copy of the `acaff20` file resolves to `server.proxy=undefined | server.cors=<default>` on every
one of these lines, also with the variable set.

### 12.2 Proxy on: no `Access-Control-Allow-Origin`, and the preflight is no longer answered by Vite

```
/usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock /bin/sh .cache/proof-harness-w05b/run_check_b.sh
```

`lockf exit=0`; 258 lines of output. Vite was started with the line of section 4
(`DEMS_CORE_PROXY_PORT=4421 VITE_DEMS_CORE_MODE=live npm run dev -w @dems/core-web -- --host 127.0.0.1 --port 5176 --strictPort`;
listener `node pid 39934 127.0.0.1:5176`). Every answer header is printed:

```
-- 3a. POST /api/v1/proof/sign-in, Origin: http://127.0.0.1:5176
   HTTP/1.1 200 OK
   set-cookie: dems_session_4421=-4KbGA[rest not shown]; HttpOnly; SameSite=Strict; Path=/
   x-dems-epoch: 1
   x-dems-revision: 101
   retry-after: 7
   cache-control: no-store
   content-type: application/json; charset=utf-8
   content-length: 40
   date: Sun, 04 Oct 2026 00:19:05 GMT
   connection: close
-- 3b. POST /api/v1/proof/echo, Origin: http://127.0.0.1:5174 (a foreign loopback origin)
   HTTP/1.1 200 OK
   x-dems-epoch: 1
   x-dems-revision: 102
   cache-control: no-store
   content-type: application/json; charset=utf-8
   content-length: 136
   date: Sun, 04 Oct 2026 00:19:05 GMT
   connection: close
   {"host":"127.0.0.1:5176","origin":"http://127.0.0.1:5174","cookiePresent":false,"cookieEqualsIssued":false,"secFetch":{},"forwarded":{}}
-- 3c. POST /api/v1/proof/guarded, Origin: http://127.0.0.1:5174 (the stand-in guard refuses)
   HTTP/1.1 403 Forbidden
   cache-control: no-store
   content-type: application/json; charset=utf-8
   content-length: 95
   date: Sun, 04 Oct 2026 00:19:05 GMT
   connection: close
   {"error":{"code":"ORIGIN_NOT_ALLOWED","message":"proof-harness stand-in for the Origin guard"}}
-- 3d. CORS preflight: OPTIONS /api/v1/proof/echo, Origin: http://127.0.0.1:5174, Access-Control-Request-Method: POST
   HTTP/1.1 404 Not Found
   content-type: application/json; charset=utf-8
   content-length: 93
   date: Sun, 04 Oct 2026 00:19:05 GMT
   connection: close
   {"message":"Route OPTIONS:/api/v1/proof/echo not found","error":"Not Found","statusCode":404}
-- 3d2. the same preflight from https://example.org
   HTTP/1.1 404 Not Found
   content-type: application/json; charset=utf-8
   content-length: 93
   date: Sun, 04 Oct 2026 00:19:05 GMT
   connection: close
   {"message":"Route OPTIONS:/api/v1/proof/echo not found","error":"Not Found","statusCode":404}
-- 3e. GET /api/v1/health without an Origin
   HTTP/1.1 200 OK
   cache-control: no-store
   content-type: application/json; charset=utf-8
   content-length: 68
   date: Sun, 04 Oct 2026 00:19:05 GMT
   connection: close
   {"service":"proof-harness","port":4421,"note":"not the Core server"}
-- 3f. Vite's own page while the proxy is on: GET / with Origin: http://127.0.0.1:5174 (status and CORS-related headers)
   HTTP/1.1 200 OK
   Content-Type: text/html
-- 3g. count of access-control-* headers over the ten capture requests, proxy ON:
   0 access-control-* lines; 0 'Vary: Origin' lines; status lines: 200 200 200 200 200 200 200 200 404 404
```

Compared with section 3.2 and F27-1, where the same requests carried
`Access-Control-Allow-Origin: <origin>` and `Vary: Origin`, and the preflight was answered
`204 No Content` by the dev server:

- A proxied answer to a request with `Origin: http://127.0.0.1:5174` has **no** `Access-Control-Allow-Origin` (3b, 3c). `Vary: Origin` is gone as well (3e).
- **What happens to a preflight instead:** the dev server forwards it like any other request. It reaches the backend with its `Origin` unchanged, and the backend's own answer comes back. The harness has no `OPTIONS` route, so it answered 404; no CORS header is in the answer, so a browser fails the preflight and never sends the real request. Harness log:

```
---- 3d preflight OPTIONS, Origin http://127.0.0.1:5174, then https://example.org
#5 http    OPTIONS /api/v1/proof/echo | Host: 127.0.0.1:5176 | Origin: http://127.0.0.1:5174 | Cookie: (none) | Sec-Fetch: (none) | forwarded: {} | Connection: close
#6 http    OPTIONS /api/v1/proof/echo | Host: 127.0.0.1:5176 | Origin: https://example.org | Cookie: (none) | Sec-Fetch: (none) | forwarded: {} | Connection: close
```

- The pass-through of section 3 is unchanged: the foreign `Origin` of 3b and 3c arrived as sent (`#3 ... Origin: http://127.0.0.1:5174`, `#4 ... Origin: http://127.0.0.1:5174`), and the cookie on the upgrade:

```
#13 upgrade GET  /ws | Host: 127.0.0.1:5176 | Origin: http://127.0.0.1:5176 | Cookie: dems_session_4421=-4KbGA…(32 chars) equalsIssued=true | Sec-Fetch: (none) | forwarded: {} | Connection: Upgrade
```

`cors: false` is an option of the whole dev server, so while the proxy is on Vite's own pages and modules
carry no CORS header either (3f). The console loads them from its own origin, so nothing depends on it
(12.3).

### 12.3 The same-origin flow in the real browser (HeadlessChrome/153.0.8010.12)

```
== 07:19:06 4. headless Chromium over CDP
driver exit 0
   browser: HeadlessChrome/153.0.8010.12 | page loaded: true | title: DEMS Edge Client · Core Console | location: http://127.0.0.1:5176
   POST sign-in: 200 | x-dems-epoch 1 | x-dems-revision 105 | retry-after 7 | set-cookie readable by script: null | document.cookie: ""
   cookie jar: [{"name":"dems_session_4421","value":"-4KbGA…(32 chars)","domain":"127.0.0.1","path":"/","httpOnly":true,"sameSite":"Strict","secure":false,"session":true}]
   second request (echo): 200 | cookiePresent true | cookieEqualsIssued true | origin http://127.0.0.1:5176 | sec-fetch-site same-origin
   GET health: 200 | 429: 429 retry-after 42 | guarded: 200
   socket /ws: ["{\"type\":\"hello\",\"origin\":\"http://127.0.0.1:5176\",\"host\":\"127.0.0.1:5176\",\"cookiePresent\":true,\"cookieEqualsIssued\":true}","echo:ping-1"] close 1000 | server close code relayed: 4403
   access-control-allow-origin on the 5 API answers: [null,null,null,null,null] | vary: [null,null,null,null,null]
   Vite socket: ws://127.0.0.1:5176/?token=… | status 101 | protocol vite-hmr | first frame {"type":"connected"}
   page under localhost: http://localhost:5176 | guarded: 403 ORIGIN_NOT_ALLOWED | origin that arrived: http://localhost:5176 | access-control-allow-origin: [null,null]
   page errors: []
   browser console:    2 "[vite] connected."
   browser console:    2 "[vite] connecting..."
```

Harness log of the browser run:

```
#17 http    POST /api/v1/proof/sign-in | Host: 127.0.0.1:5176 | Origin: http://127.0.0.1:5176 | Cookie: (none) | Sec-Fetch: site=same-origin,mode=cors,dest=empty | forwarded: {} | Connection: close
#18 http    POST /api/v1/proof/echo | Host: 127.0.0.1:5176 | Origin: http://127.0.0.1:5176 | Cookie: dems_session_4421=-4KbGA…(32 chars) equalsIssued=true | Sec-Fetch: site=same-origin,mode=cors,dest=empty | forwarded: {} | Connection: close
#22 upgrade GET  /ws | Host: 127.0.0.1:5176 | Origin: http://127.0.0.1:5176 | Cookie: dems_session_4421=-4KbGA…(32 chars) equalsIssued=true | Sec-Fetch: (none) | forwarded: {} | Connection: Upgrade
#30 http    POST /api/v1/proof/guarded | Host: localhost:5176 | Origin: http://localhost:5176 | Cookie: (none) | Sec-Fetch: site=same-origin,mode=cors,dest=empty | forwarded: {} | Connection: close
```

The page loads, the POST sets the cookie, the second request and the `/ws` upgrade carry it, and Vite's
own socket connects. The Vite log shows no proxy error.

### 12.4 Variable unset: the answer headers are as before

Ten requests (the status line and every answer header of each; `Date` and `ETag` values replaced by
"(varies)") against three config files, each on a fresh dev server without the variable:

| Label | Config file |
|---|---|
| `acaff20` | A control copy of `git show acaff20:apps/core-web/vite.config.ts` in the scratch folder. It differs from the original in two lines only: the two relative paths are written as absolute ones (`./src/lib/packaged-csp.ts`, `new URL('./src', import.meta.url)`), because the copy lies outside the workspace |
| `step27` | The same kind of copy of the file as step 27 left it |
| `now` | `apps/core-web/vite.config.ts` itself, started with the line of section 4 without the variable |

Second run (`run_unset_b.sh`, 07:20:10 to 07:20:14, all three files named `vite.config.ts`):

```
   acaff20: 10 requests, 99 lines, 10 access-control-* lines, sha256 8f5a6c46217ac132; /@vite/client body 210923 bytes
   step27: 10 requests, 99 lines, 10 access-control-* lines, sha256 8ad10d756cd20959; /@vite/client body 210935 bytes
   now: 10 requests, 99 lines, 10 access-control-* lines, sha256 8f5a6c46217ac132; /@vite/client body 210923 bytes
-- diff capture acaff20 against now:
   IDENTICAL
-- diff capture step27 against now:
42c42
< Content-Length: 210935
---
> Content-Length: 210923
```

So the capture with the file as it is now equals the capture with the file of `acaff20`, line for line.
The one line that differs for `step27` is the body length of Vite's own client script, which is not a
matter of the config: that script embeds a random socket token made at each start, and the two bodies
differ in exactly two lines, the token and the inline source map that encodes it.

```
--- /@vite/client bodies of the second run (same config file name in all three):
   acaff20: 210923 bytes; socket token has 12 characters, 0 of them '-' or '_'
   step27: 210935 bytes; socket token has 12 characters, 1 of them '-' or '_'
   now: 210923 bytes; socket token has 12 characters, 0 of them '-' or '_'
--- lines that differ between the bodies (step27 against now):
2
892c892
1274c1274
< const wsToken = "(token)";
< //# sourceMappingURL=data:application/json;base64,eyJ2ZXJz
```

(Why a token with a `-` gives a longer source map was not looked into; **hypothesis**: the map has one
more segment per word boundary.) With that one line replaced by a fixed text, all pairs are identical in
both runs:

```
run in out/: acaff20 vs now: IDENTICAL; step27 vs now: IDENTICAL; sha256 of the normalised capture (now): 77263aa040091041
run in out_unset/: acaff20 vs now: IDENTICAL; step27 vs now: IDENTICAL; sha256 of the normalised capture (now): 77263aa040091041
```

In the first run (inside `run_check_b.sh`, 07:19:10) the control copies had other file names
(`vite.config.acaff20.ts`, `vite.config.step27.ts`), and the same single line differed
(`Content-Length: 210955` and `210954` against `210923`): the client script also embeds the config file's
name (`hmrConfigName = "vite.config.ts"`). The second run removed that cause. No request of this phase
reached the harness ("requests the harness logged before / after this phase: 21 / 21").

The capture with the file as it is now, variable unset (Vite's default CORS behaviour, unchanged):

```
   ## 1 GET / (no Origin)
   HTTP/1.1 200 OK
   Vary: Origin
   Content-Type: text/html
   Cache-Control: no-cache
   Etag: (varies)
   Date: (varies)
   Connection: keep-alive
   Keep-Alive: timeout=5
   Content-Length: 718
   ## 2 GET / (Origin http://127.0.0.1:5176)
   HTTP/1.1 200 OK
   Access-Control-Allow-Origin: http://127.0.0.1:5176
   Vary: Origin
   ...
   ## 3 GET /src/main.tsx (Origin http://127.0.0.1:5174)
   HTTP/1.1 200 OK
   Access-Control-Allow-Origin: http://127.0.0.1:5174
   Vary: Origin
   ...
   ## 6 GET /api/v1/health (no Origin)
   HTTP/1.1 200 OK
   Vary: Origin
   Content-Type: text/html
   ...
   ## 7 POST /api/v1/proof/sign-in (Origin http://127.0.0.1:5176)
   HTTP/1.1 404 Not Found
   Access-Control-Allow-Origin: http://127.0.0.1:5176
   Vary: Origin
   Date: (varies)
   Connection: keep-alive
   Keep-Alive: timeout=5
   Content-Length: 0
   ## 9 OPTIONS preflight /api/v1/proof/echo (Origin http://127.0.0.1:5174)
   HTTP/1.1 204 No Content
   Access-Control-Allow-Origin: http://127.0.0.1:5174
   Vary: Origin, Access-Control-Request-Headers
   Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE
   Access-Control-Allow-Headers: content-type
   Content-Length: 0
   Date: (varies)
   Connection: keep-alive
   Keep-Alive: timeout=5
   ## 10 OPTIONS preflight /api/v1/proof/echo (Origin https://example.org)
   HTTP/1.1 204 No Content
   Vary: Origin, Access-Control-Request-Headers
   Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE
   Access-Control-Allow-Headers: content-type
   ...
```

(`...` marks lines left out; requests 4, 5 and 8 are left out whole. The full capture is
`.cache/proof-harness-w05b/out_unset/capture_now.txt`, 99 lines.)

### 12.5 Build

Two builds with the file as step 27 left it (07:15:04), five after the edit (07:16:16), in the
packager's way:

```
f6dde3b52909d285fe112792a5fecfa9ed635615
exit after-packaged-unset=0 (✓ built in 875ms)
exit after-packaged-var4421=0 (✓ built in 818ms)
exit after-packaged-var9999=0 (✓ built in 1.01s)
exit after-plain-unset=0 (✓ built in 972ms)
exit after-plain-var4421=0 (✓ built in 768ms)
--- diff -r before-packaged after-packaged-unset
IDENTICAL
--- diff -r before-packaged after-packaged-var4421
IDENTICAL
--- diff -r before-packaged after-packaged-var9999
IDENTICAL
--- diff -r before-plain after-plain-unset
IDENTICAL
--- diff -r before-plain after-plain-var4421
IDENTICAL
--- CSP meta count in index.html
after-packaged-var4421/index.html:1
after-plain-unset/index.html:0
before-packaged/index.html:1
--- variable name or lane address in any built file
(end)
--- tree hash in the format of section 5 (hash  ./path), to compare with 27f7a8b43ebaebcb (packaged) and 6e74094d06b9b93d (plain):
before-packaged 27f7a8b43ebaebcb
after-packaged-var4421 27f7a8b43ebaebcb
before-plain 6e74094d06b9b93d
after-plain-var4421 6e74094d06b9b93d
```

511 files each. The tree hashes equal those of section 5, so the output is still the one the `acaff20`
config gave. `git diff acaff20 -- apps/core-web/src/lib/packaged-csp.ts apps/mock-core` prints nothing
(0 bytes). The scratch builds were removed after the comparison.

### 12.6 Gate

```
start 07:21:07 WIB
 Test Files  39 passed (39)
      Tests  438 passed (438)
   Duration  35.00s (tests 69%, import 13%, environment 11%, setup 4%, transform 2%)
exit=0
end 07:21:42 WIB

> @dems/core-web@0.1.0 typecheck
> tsc -b

typecheck exit=0

> @dems/core-web@0.1.0 lint
> oxlint

lint exit=0
```

`npm run test -w @dems/core-web -- --maxWorkers=2`, one run, no failure (a calendar-sweep row had
`features/dashboard/__tests__/dashboard.test.tsx` modified in the tree at the time; it passed). Ledger:
438 before, 438 after, 0 added.

### 12.7 Nothing is left running

```
== 07:19:14 6. stop the harness; nothing left
harness exit status: 0
-- lsof -nP -iTCP:4421 -iTCP:5176 -iTCP:9396 -sTCP:LISTEN
   (lsof exit 1; 1 with no output means no listener)
```

After the second run, and again on its own at 07:22:06 WIB:

```
$ lsof -nP -iTCP:4421 -iTCP:5176 -iTCP:9396 -sTCP:LISTEN
lsof exit=1
```

Started and stopped in this follow-up: the harness copy (PID 39903), Vite seven times (the first with
listener PID 39934), headless Chromium once. `.locks/core-server.lane1.pid` held this row's harness PID
during the first run and was removed at its end (step 34's own file of that name was gone by then).

### 12.8 For the controller

| # | Item |
|---|---|
| 1 | D27-1 is closed by D29: `cors: false` goes with the proxy. F27-1 no longer applies to Live mode. Without the variable the dev server keeps Vite's default CORS behaviour, as in Simulated mode before this task |
| 2 | **A preflight now reaches the Core server.** `OPTIONS /api/v1/...` with a foreign `Origin` arrives at the backend (12.2). The harness answered 404. The real server must answer it without any `Access-Control-Allow-*` header (SR-04, OR-5, AC-B-43); which status it gives (the router's 404 or 405, or the guard's 403) is for W08 and W23 to state and test |
| 3 | `coreDevProxy` now returns `{ proxy, cors }`, not the proxy table. W50's static test (AC-C-102) looks at the `proxy` entries inside the function body, or at the resolved `server.proxy`; the body still holds none of the forbidden option names. A check that `server.cors` resolves to `false` whenever `server.proxy` is set would pin this ruling |
| 4 | `cors: false` covers the whole dev server while the proxy is on, also Vite's own pages and modules (12.2, 3f). No effect on the console, which is loaded from its own origin; mock-core's CORS on 4400 is a different server and is not touched |
| 5 | A note for anyone who compares dev-server header captures: the `Content-Length` of `/@vite/client` changes from start to start (random socket token) and with the config file's name (12.4) |
| 6 | The lane start lines of section 4 are unchanged |
| 7 | Rollback is unchanged (section 7): `git checkout acaff20 -- apps/core-web/vite.config.ts`. `rm -rf .cache/proof-harness-w05b` joins the scratch folders of RB-17 |

---
*Generated: 2026-10-04 06:49 WIB*
*Last Updated: 2026-10-04 07:25 WIB (section 12)*
