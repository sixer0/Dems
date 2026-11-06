---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W84 (plan step 106)
agent: coder-execution
date: 2026-10-06
status: complete
source_plan: docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md (row `| W84 |`, line 763)
---

# W84: Web API Reference in both modes [CS:§11]

**Status: complete.** The API Reference page (`/developer/api`) now works in both modes. Simulated mode is as
before, plus one switch, "Show Core-server endpoints". Live mode shows the Core server's 75 operations, every
one `LIVE`, served from the page's own origin. Try-it goes to the network with the session cookie. The six
secret-bearing operations are refused before any request. The Realtime panel reads the console's one socket
and opens none of its own, which closes F72-4 and W84's half of AC-C-18. The page's log holds method, path and
status only (D182, AR-9). The lane 3 check ran against the real Core server: a live Try-it of
`getServiceHealth` answered `dems-core-server` (screenshot).

Every write is inside the row's paths: `apps/core-web/src/features/api-reference/**`, additive keys in
`packages/shared/src/i18n/en/api-reference.ts`, and two new test files `apps/core-web/src/test/live-api-reference-*.test.tsx`.
`runtime/**`, `lib/**`, `components/**`, `routes/**`, `vite.config.ts`, `main.tsx`, `packages/shared/src/api/**`,
`openapi.json` and the six protected test files were not written.

## 1. 5W1H

| | |
|---|---|
| What | The page in both modes per spec §11 (AR-1 to AR-9, AR-3a), with tests and a lane check |
| Why | SC6. Security review SD-16 (deny list, storage) and SD-23 (log markers). F72-4 (a second socket in Live mode). D182 (the page logged an error's message and stack) |
| Who | Users of the console's developer page. Try-it runs as the signed-in operator and is audited by the Core like any other call |
| When | 2026-10-06, 04:31 to 05:20 WIB, alongside the closing copy round |
| How | A mode switch at the page root, two documents built from the shared registry (`offline` and `all` scopes), two Try-it fetches, a Live feed that reads the Live source, and the console's one page reporter |
| Constraints | Simulated mode unchanged; contract C closed (W83); no new dependency; the existing kit and Scalar integration |

## 2. What was built (file:line)

| Part | Where | What and why |
|---|---|---|
| Mode switch | `features/api-reference/index.tsx:44` | `useWebLive()` picks `LiveApiReference` (`:108`) or `SimulatedApiReference` (`:58`). Two components, so neither mode runs the other's hooks |
| Simulated view (AR-2) | `index.tsx:58-106`; `api-document.ts:205` `withCoreServerOperations` | Default: the document of before, byte-equal to `buildApiDocument(true)` (tested). The new switch adds the 65 Core-server-only operations from the `all` scope. Each gets `CORE SERVER` (`api-document.ts:162`, neutral `toneHex.default`) in place of `LIVE`. The ten operations, `info`, `servers` and the offline tag texts are left as they were. Missing components, tags, envelope responses, headers and security schemes are added; no offline name is replaced (W84 measured: the 18 shared schema names are identical in both scopes) |
| Simulated Try-it refusal (AR-2) | `sim-fetch.ts:115` (option `coreServerRefusal`, `:55-60`) | With the switch on, a request for one of the 65 throws `TryItRefusedError('CORE_SERVER')` with "This operation is answered by the Core server. Switch to Live mode to try it.". No request is sent and `sim.request` is not called. With the switch off, routing is as before, byte for byte (protected `sim-fetch.test.ts` unchanged and green) |
| Live document (AR-1, AR-3, AR-5) | `api-document.ts:276` `buildLiveApiDocument`; `:232` `pointAtPageOrigin`; `:263` `applyReplicaIdentifiers` | `all` scope, 75 operations, every one `LIVE`. One server: the page's origin. The Core server's address in `info` and the tag texts follows it (W83 KI-18 place 8). Path examples of session operations take the open session, `acknowledgeSessionSummary` the last sealed session, and evidence operations the first sealed item, all from the replica (`index.tsx:114`, `useSim(replicaIdentifiersOf)`, compared shallowly). With no identifier the example is removed, never left frozen |
| Live Try-it (AR-3, AR-3a) | `try-it.ts:179` `createLiveTryItFetch` | Only `{page origin}/api/v1/*` is accepted; anything else throws `BlockedRequestError`, moved here from `sim-fetch.ts` and re-exported there under its old import path. The request is forwarded as URL plus a plain init: method, headers, body text read once, `credentials: 'same-origin'` (`:221`), the abort signal. The network answer comes back unchanged. `sim.request` is never called |
| Deny list (AR-3a, SD-16) | `try-it.ts:35` (the six), `:113` `deniedTryItOperation` | `signIn`, `setBiometricEnrollment`, `signInWithBiometric`, `issuePairingCode`, `redeemPairingCode`, `rotateDeviceCredential` are refused with the AR-3a sentence before any request. The match runs as sent and again on a normalised path (percent-decoded, lower case, `//` and a trailing `/` folded), so another spelling is refused too. An allowed operation on the same path (`GET /api/v1/pairing/code`) stays allowed |
| The page's log (AR-9, D182, CL-6a) | `log.ts:34` | Bound once to `createPageReporter('api')` (`@/lib/page-report`, 08a §15). A record holds the caller's fixed sentence, `ApiReference.<site>` as source, and in context only `method`, `path` (no query) and `status`, plus the reporter's own `errorName`, `code` and `api-…` correlation ID. Never the error text, a stack, a component stack, a body, an answer or a header. All 12 call sites converted (`actions.ts:17,43`, `panel.tsx:78`, `sim-adapter.ts:46`, `sim-fetch.ts:108,117,135`, `try-it.ts:198,206,226`, `use-realtime-feed.ts:144,155`) |
| Realtime panel, Live (AR-7, AC-C-18, F72-4) | `realtime-panel.tsx:30` (switch), `:194` `LiveRealtimePanel`; `use-live-realtime-feed.ts:63` `createLiveFrameTap`, `:146` `useLiveRealtimeFeed` | No socket and no heartbeat client. The panel subscribes to `live.heartbeat` and `live.store` and reads `live.socketStatus()`. Entries: `heartbeat` (seq, serverTime, clients); `snapshot` (epoch, revision, the 28 slice names); `delta` (epoch, revision, the replicated slices whose object changed, and the count when more than one delta was applied at once). Meter frames are shown as a rate per second, sampled at each heartbeat. No Connect switch, no payload. The Simulated panel is unchanged (`:42`) |
| Banner (AR-6; CPW1-9) | `service-banner.tsx:37` | Live: "CORE SERVER ONLINE • {service} v{version} • READY / STARTING", from the heartbeat of the one socket and the health answer. The query is now the Home page's `useHealth()` (`:41`), so two `['health']` definitions remain instead of three; the Login page's Live reader keeps its own options by design |
| Warning (AR-4) | `index.tsx:138` | Kit `Alert status="warning"` above the renderer, naming the session operator's `displayName` |
| Strip (AR-2, AR-3, AR-8) | `server-strip.tsx:56`, `:106` | Simulated: both switches. Live: neither, and the legend reads LIVE, RBAC + AUDIT. The spec version comes from the document shown: v0.1.0 Simulated, v0.2.1 Live. Download builds the current view's document (`apiDocumentJsonFor`, `api-document.ts:288`); Copy copies the current view's base URL |
| Renderer key | `renderer-panel.tsx:46` (`viewKey`) | Cross-fade key and `data-filter` per view (`all`, `live`, `+core`, `core`); the default is as before |
| Words | `packages/shared/src/i18n/en/api-reference.ts` (+38 lines, 0 deleted) | `subtitleLive`, `banner.live.*`, `server.showCoreServer`, `badges.CORE_SERVER`, `tooltips.coreServer`, `tooltips.liveCore`, `tryIt.*`, `liveWarning.*`, `realtime.live.*` |

Full diff: `assets/84_changes.diff.txt` (2,411 lines; 14 files changed +661 −99, plus 4 new files: `try-it.ts` 236
lines, `use-live-realtime-feed.ts` 165 lines, the two test files 473 and 325 lines).

## 3. Requirement traceability

| ID | Met by | Proven by |
|---|---|---|
| SC6, AR-1 | Two scopes: `offline` for Simulated, `all` for Live | DOC "AR-2: the Simulated views", "AR-3: the Live document" |
| AR-2 | Simulated view and refusal (section 2) | DOC "AR-2: Try-it in Simulated mode" (65 cases plus 3); PAGE "Simulated mode"; lane screenshot `84_api_reference_simulated.png` |
| AR-3 | Live document and Try-it | DOC "AR-3: Try-it in Live mode"; PAGE "Live mode: the document and Try-it"; lane steps 2 and 3 |
| AR-3a, SD-16 | Deny list | DOC "AR-3a" (6 + 10 spellings + 6 allowed); PAGE "AC-C-103 …" (the fake transport's log); lane step 5 |
| AR-4 | Warning | PAGE test 1; lane `liveWarning` |
| AR-5 | Replica identifiers | DOC "AR-5" |
| AR-6 | Banner | PAGE test 1; lane `banner` |
| AR-7, AC-C-18, F72-4 | Live Realtime panel | PAGE "AC-C-18"; DOC "AR-7: the Live frame tap"; lane step 7 (one `/ws` socket beside Vite's) |
| AR-8 | Download and Copy of the current view | DOC (`apiDocumentJsonFor` equals the serialised view in both modes) |
| AR-9, CA-11, GC-18, AC-C-103 | Log discipline; nothing written to storage | DOC `assertLogDiscipline`; PAGE storage test; lane step 6 (storage, IndexedDB); Scalar source evidence in section 6 |
| AC-C-100 | All of the above | Section 4, rows 2 to 6 |
| AC-C-107, SD-23 | Markers in bodies never reach the sink | DOC and PAGE marker scans (password, six-digit code, `ses_`/`dvc_`/`bio_`) |
| D182 | `log.ts` rewritten | `grep` in section 4.10 |
| CPW1-12 | No generated key or code is put in a record or URL; the page builds no URL with a query | `log.ts` takes no free text; paths only |

## 4. Verification (the row's verification cell, each with its command)

All commands were run from the repository root. Full logs are in `assets/84_final_gate.log`.

**4.1 The existing API Reference tests and `scalar-config.test.ts` pass unchanged; `sim-fetch.test.ts` is compared with W01's state.**

```
$ npm run test -w @dems/core-web -- --maxWorkers=2 src/test/scalar-config.test.ts src/test/sim-fetch.test.ts src/lib/__tests__/core-endpoint.test.tsx src/test/routes.test.tsx   (04:50:38)
 Test Files  4 passed (4)
      Tests  79 passed (79)
$ shasum -a 256 -c .cache/w84/protected.pre.sha256   (hashes taken 04:45, before the first edit; re-checked 05:19)
apps/core-web/src/test/routes.test.tsx: OK
apps/core-web/src/test/sim-fetch.test.ts: OK
apps/core-web/src/features/storage/__tests__/storage-page.test.tsx: OK
apps/core-web/src/lib/__tests__/core-endpoint.test.tsx: OK
apps/core-web/src/lib/__tests__/packaged-csp.test.ts: OK
apps/core-web/src/test/scalar-config.test.ts: OK
$ git diff --quiet 057fc17 -- apps/core-web/src/test/sim-fetch.test.ts && echo "sim-fetch.test.ts identical to 057fc17"
sim-fetch.test.ts identical to 057fc17          (W01's state, committed in b90a3c6)
$ git diff --stat acaff20 -- apps/core-web/src/test/scalar-config.test.ts apps/core-web/src/test/routes.test.tsx apps/core-web/src/lib/__tests__/core-endpoint.test.tsx apps/core-web/src/lib/__tests__/packaged-csp.test.ts
(no output)
```

**4.2 Ten operations in Simulated mode; 75 with the Core-server switch; a Try-it that is rejected without a request.**
DOC "AR-2: the Simulated views" (10, 75 with the 65 badged `CORE SERVER`, 66 with simulated off; every `$ref`
resolves) and "AR-2: Try-it in Simulated mode" (each of the 65 rejected with the AR-2 sentence: `sim.request` and
the network fetch never called, no exchange). PAGE "Simulated mode": the page's own document 10 → switch → 75
("75 operations" in the strip, the CORE SERVER legend chip), then Try-it of `GET /api/v1/admin/users` and
`POST /api/v1/auth/sign-in` rejected, `sim.request` not called, the global `fetch` not called; `getCurrentSession`
still answered by the simulator; switch off → 10.

**4.3 75 `LIVE` in Live mode.** PAGE test 1: the configuration handed to Scalar holds 75 operations, every first badge
`LIVE`, `servers` = `[http://127.0.0.1:5178]`, strip "75 operations", `v0.2.1`, no switch. Lane: `"operationCount": "75 operations"`, `"specVersion": "v0.2.1"`, legend `LIVE`, `RBAC_AUDIT`.

**4.4 A URL outside `{page origin}/api/v1` is rejected.** DOC: 8 URLs (another host, `localhost:5178`, the Core
server's own port 4420, mock-core 4400, `/ws`, `/openapi.json`, `/api/v10/…`, Scalar's proxy) each reject with
`BlockedRequestError` naming `(http://127.0.0.1:5178/api/v1)`, and the network fetch is not called. PAGE: three
URLs rejected and the fake transport's request count unchanged.

**4.5 No second socket.** PAGE "AC-C-18" under StrictMode: after 3 s and again after 5 s, `bed.fake.connections`
has length 1, `page.sockets` has length 1, and the counting global `WebSocket` was never constructed. Lane step 7:
`"toDevServerWs": 1` (`ws://127.0.0.1:5178/ws`, frames `hello`, `snapshot`, `heartbeat`, `meters`, `delta`), and
the only other socket is Vite's own `ws://127.0.0.1:5178/?…`.

**4.6 One live Try-it of `getServiceHealth` answers `dems-core-server` (screenshot).** Lane run 4 (05:13:15 to
05:15:01), through Scalar's own client (Test Request, then Send):
```
"tryHealth": { "opened": { "found": true, "via": "sidebar link", "button": true, "sendButton": "SendSend get request to http://127.0.0.1:5178/api/v1/health" },
  "sent": "button", "shows": { "\"dems-core-server\"": true, "\"service\"": true, "200 OK": true },
  "healthRequests": [ { "method": "GET", "url": "http://127.0.0.1:5178/api/v1/health", "status": 200 }, … ] }
```
Screenshot `assets/84_api_reference_tryit_health.png` shows `GET http://127.0.0.1:5178/api/v1/health`, "200 OK", and a body with
`"service": "dems-core-server"`, `"version": "0.2.0"`, `"ready": { "database": true, "engine": true }`.

**4.7 Try-it of the six denied operations sends no request (the fake transport's log).** PAGE "Try-it of the six
operations sends no request": for each of the six, `customFetch` rejects with `TryItRefusedError` and the AR-3a
sentence, `fake.log.requestsOf(op)` is `[]`, and the total request count is unchanged. Lane step 5 (signIn through
Scalar's client): `"shows": { "This operation carries or returns a secret …": true }`, `"signInRequests": 0`,
`"apiRequestsWhileDenied": []`. Screenshot `assets/84_api_reference_tryit_denied.png`: "Request failed" with the
sentence in the response panel and Scalar's toast.

**4.8 After one GET and one POST no web-storage value holds a request body or an answer.** PAGE: a GET
`getServiceHealth` and a POST `setStoragePolicy` (body `{"retentionPolicy":"YEAR_1"}`, answered from the contract
example). Neither the body, either answer, `YEAR_1`, `dems-core-server` nor `retentionPolicy` appears in
`window.localStorage`, `window.sessionStorage` or the runtime's own storage, and none appears in the error sink.
Lane step 6, after a real GET (health) and a real POST (`touchSession`, 200):
```
"storage": { "localStorage": [], "sessionStorage": [ { "key": "dems.shell.intro", "length": 1, "holds": [] } ], "indexedDb": [] }
```

**4.9 The page's log holds method, path and status only.** DOC `assertLogDiscipline` runs after every refusal,
block and failure: no `stack`; context keys ⊆ {method, path, status, errorName, code, correlationId}; correlation
ID `api-…`; no marker. Fixed sentences are asserted for two sites. Lane, Vite's forwarded console line (F72-6):
`{"level":"warn","source":"ApiReference.liveTryIt.denied","message":"A Try-it request of an operation that carries a secret was refused.","context":{"method":"POST","path":"/api/v1/auth/sign-in","errorName":"TryItRefusedError","correlationId":"api-muvt4mds-1"}}`.

**4.10 D182 closed.**
```
$ grep -n "error\.message\|\.stack\b\|console\.[a-z]" apps/core-web/src/features/api-reference/*.ts apps/core-web/src/features/api-reference/*.tsx; echo "grep exit=$?"
grep exit=1          (no line: no error text, no stack, no console call in the folder)
```

**4.11 Workspace gates** (`assets/84_final_gate.log`):

| Command | Result |
|---|---|
| `npm run test -w @dems/core-web -- --maxWorkers=2` (05:16:12 to 05:18:25, load 3.97) | `Test Files  101 passed (101)`, `Tests  1384 passed (1384)`, exit 0. Floor 95 / 1,255: this row adds 2 files / 116 tests, and the parallel copy round added the rest |
| `npm run typecheck -w @dems/core-web` | exit 0 |
| `npm run lint -w @dems/core-web` | exit 0, no finding (one warning in my own test, `no-unsafe-optional-chaining`, fixed at 04:58) |
| `npm run test -w @dems/shared -- --maxWorkers=2` (05:18:59) | `Test Files  69 passed (69)`, `Tests  1840 passed (1840)`, exit 0 |
| New files alone (05:25) | `Test Files  2 passed (2)`, `Tests  116 passed (116)`: `live-api-reference-document.test.tsx` 109, `live-api-reference-page.test.tsx` 7 |

**4.12 Mutation check (rule M15, in memory).** This uses W0's runner pattern: one Vite transform plugin replaces one
text in one module while it is transformed, and the tree is never written. Runner: `.cache/w84/mut/`, copied as
`assets/84_mutations_runner.py.txt`; log `assets/84_mutations.log`. The baseline over the two new files was green
(115 / 115). On the first batch (05:00:27 to 05:03:07) 39 of 40 mutants were detected. T09 survived: "an
allowed operation of the same path is denied too" was only covered by the exact spelling. I added a case
(`GET /api/v1/Pairing/Code/` stays allowed), and the re-run (05:03:19) detected it: **40 / 40 detected**. "The
mutated files in the tree, before and after: identical" was logged for both batches. Mutants covered: the deny list (4),
the Live fetch (6), the Simulated refusal (2), the documents (9), the page (4), the Realtime panel (7), the strip
(3), the banner (2), the log (3).

## 5. Lane check (lane 3)

Run inside `/usr/bin/lockf -k -t 60 .locks/core-server.lane3.lock /bin/sh .cache/w84/lane/run_lane.sh`, which is W50's
script with steps 5 and 6 (W50's socket and Origin probes) left out and W84's CDP driver in step 7. Backend
`DEMS_CORE_PORT=4423` (`dems_lane_3`, demo flag off), Vite `127.0.0.1:5178` with `DEMS_CORE_PROXY_PORT=4423
VITE_DEMS_CORE_MODE=live`, headless Chromium (HeadlessChrome/153.0.8010.12) on devtools port 9398. PostgreSQL was
the one already on 127.0.0.1:4432; port 5432, 5173 to 5175, 4400 and lanes 1 and 2 were not touched. The lane was
not reset. Sign-in was done by page script from the seed constants (`packages/shared/src/sim/dataset.ts`); the
password stayed in the driver process. The driver's last-line check reports `held the seeded password before
redaction: false`, and a scan of every `84_*` text asset, the lane logs and the driver log reports `clean` for each.

| Run | Time | Outcome |
|---|---|---|
| 1 | 05:04:31 to 05:05:59 | Page facts complete; Try-it not sent. The driver's Send-button match missed Scalar's button, whose text is "Send" plus a screen-reader label |
| 2 | 05:07:26 to 05:09:00 | Health sent; the Identity tag was closed in Scalar's sidebar, so touch and signIn were not reached |
| 3 | 05:09:45 to 05:12:11 | Health sent (`200 OK`, `"dems-core-server"`); a page load at the anchor did not open the tag either |
| **4** | **05:13:15 to 05:15:01** | **Every step passed** (the driver opens the closed tag by its sidebar entry). Results quoted in section 4; JSON `assets/84_lane_browser.json`, log `assets/84_lane_run.log`; runs 1 to 3 in `assets/84_lane_runs_1_to_3.log` and `assets/84_lane_browser_runs_1_to_3.json` |

Lane time in all: 7 min 14 s of the 10 allowed. After every run: `listeners left on 4423, 5178, 9398 (expect
none):` … `lsof exit 1 (1 with no output: no listener)`. The backend log had 0 lines at level error or fatal.
The lane database changed by `audit_log` 92 → 94 (the sign-in and the sign-out by script), `auth_sessions`
27 → 28, `events` and `health_snapshots` (the engine).

Facts of run 4 (named elements only):

| Step | Result |
|---|---|
| Live page | `mode: live`, "75 operations", base URL `http://127.0.0.1:5178`, `v0.2.1`, banner "CORE SERVER ONLINE • dems-core-server v0.2.0 • READY", warning "… as AKP Andi Pratama …", no switch; Realtime `ONLINE`, `ws://127.0.0.1:5178/ws`, no Connect switch, entries `heartbeat`/`delta`, a delta printed as `{"type":"delta","epoch":23,"revision":75,"slices":["storage","time","network","health"]}`, meter frames "19.5 per second". Screenshot `84_api_reference_live.png` |
| Try-it health | 200, `dems-core-server` (4.6) |
| Try-it POST `touchSession` | `"sent": "button"`, the answer shows `"idleExpiresAt"`, `POST http://127.0.0.1:5178/api/v1/auth/touch 200` |
| Try-it signIn | refused, 0 requests (4.7) |
| Storage | clean (4.8) |
| Sockets | one `/ws` (4.5); browser console: `[]` |
| Simulated (stored `SIMULATED`, simulator's stored sign-in `dems.auth`, F63-3) | `mode: simulated`, "10 operations", `http://127.0.0.1:4400`, `v0.1.0`, both switches, legend LIVE/SIMULATED/RBAC + AUDIT, the Simulated Realtime panel with its Connect switch; **0 requests to `http://127.0.0.1:5178/api/v1/`, 0 sockets to `ws://127.0.0.1:5178/ws`**; only mock-core attempts at 4400, refused as expected because mock-core is not run on a lane. Screenshot `84_api_reference_simulated.png`. The origin was left as found (`dems.core.mode.v1` and `dems.auth` removed) |

## 6. Findings

| # | Finding | Evidence | For |
|---|---|---|---|
| F84-1 | **CA-11 / GC-18 answered: Scalar keeps no request body or answer in web storage.** Its reference writes two keys only: the chosen code-sample client (`scalar-reference-selected-client-v2`), and auth, the latter only with `persistAuth` true (false here). The IndexedDB persistence of `@scalar/workspace-store` is imported by no module of `api-reference` or `api-client`. Request history and the response cache live in memory | `node_modules/@scalar/api-reference/dist/plugins/persistence-plugin.js:7-27`, `dist/helpers/storage.js:1-55`, `@scalar/helpers/dist/object/local-storage.js:20-29`; grep (no importer of `workspace-store/persistence`); lane step 6 (`localStorage: []`, `indexedDb: []`) | Controller: GC-18 can close; the CA-11 fallback (Try-it off in Live mode) is not needed |
| F84-2 | When `customFetch` rejects, Scalar's own `normalizeError` runs `console.error(e)`. Our refusal therefore also reaches the browser console, with Scalar's own stack, and Vite forwards it to its terminal (F72-6). The message is our fixed sentence and the request is not in it. This is Scalar's output, not the page's log | `@scalar/helpers/dist/errors/normalize-error.js` (`console.error(e)`); lane Vite log line 15: `[console.error] TryItRefusedError: This operation carries or returns a secret …` | W100 (client security review): known, loopback, dev only, no secret |
| F84-3 | In the `all` scope, `getServiceHealth` has one 200 example, mock-core's ("mock-core is up", `service: dems-mock-core`). The Live reference therefore shows that example while Try-it answers `dems-core-server`. It is a contract matter (W83 is closed), so it was not changed in the app, which would mean fabricating contract data | `createOpenApiDocument({ scope: 'all' })`: examples of `/api/v1/health` 200 = `live: mock-core is up dems-mock-core`; lane screenshot `84_api_reference_tryit_denied.png` (the documented example) | A later contract pass (residual sentence for W88) |
| F84-4 | **The Live heartbeat entry is not the whole frame.** The Live source's heartbeat view (`LiveSim.heartbeat`, `HeartbeatSnapshot`) keeps `seq`, `serverTime` and `clients`; `uptimeMs`, `intervalMs` and `sessionState` of the frame are not exposed, and frames are not tapped (the source owns the socket handlers). The panel prints the three members the view has and does not rebuild the others | `packages/shared/src/realtime/live-socket-client.ts:896-911` (`updateHeartbeat` takes seq, serverTime, clients); `heartbeat-client.ts:35-42` | Controller: accept, or a later `runtime`/shared row adds a read-only frame tap |
| F84-5 | Slices of a delta are taken from the replica (the slice objects whose identity changed), not from the delta's `ops`. One delta that replaces a slice with an equal value shows no entry of its own (structural sharing keeps the object); the next entry carries the count | `use-live-realtime-feed.ts:63-135`; the source applies deltas through its command gate (`packages/shared/src/live/source/live-sim.ts:762-775`) | Stated in the hook's header |
| F84-6 | At the hand-over from Live to Simulated, the driver recorded one `GET http://127.0.0.1:5178/api/v1/auth/status` in run 2 (no status: cancelled) and one in run 3 (200). Run 1 counted 9 `/api/v1/` URLs, mock-core's included; that run did not record the URLs. Run 4: **0**. **Hypothesis** (the initiator was not recorded): the Live page sent it after the scripted sign-out, because `getSignInStatus` is asked after every session end (brief list row 27). It fell in the window between the driver's network reset and the navigation. The Simulated page makes no request to the dev server | `assets/84_lane_browser_runs_1_to_3.json` (`run2`, `run3`, step `simulated`); run 4 `"apiRequestsToTheDevServer": 0` | Information: a driver timing artifact |
| F84-7 | Typecheck was red at 04:50 and again at 04:57 because of the copy round's new file `apps/core-web/src/features/session-new/__tests__/copy-round-live-words.test.tsx:63` (`'""' is not assignable to "STANDARD_1080P25"`). It was green again at the final gate (05:18) | `.cache/w84` run outputs | Not W84's |

## 7. Deviations

| # | Deviation | Why |
|---|---|---|
| DV-84-1 | Simulated-mode records moved from the dev console (`logApiReference` printed only in DEV) to `webErrorSink`, which keeps them in memory and prints them in a dev build. The UI is unchanged | D182 and AR-9 require the page's log to follow 08a §15 (`createPageReporter`). Nothing visible changes in Simulated mode |
| DV-84-2 | `BlockedRequestError` moved from `sim-fetch.ts` to `try-it.ts`; `sim-fetch.ts` re-exports it, so every existing import (`sim-fetch.test.ts`, `core-endpoint.test.tsx`) is unchanged | One home for the Try-it rules of both modes, without a runtime import cycle (`try-it.ts` imports only types from `sim-fetch.ts`) |
| DV-84-3 | The Simulated refusal applies only while "Show Core-server endpoints" is on | "Simulated mode stays exactly as before": with the switch off, a hand-written Core-server URL gets the simulator's answer, as before |
| DV-84-4 | The Live document does not carry the DEMO dataset examples (D67) | AR-5: Live examples take identifiers from the replica, and the DEMO export example names a frozen evidence ID. The contract's own `all`-scope examples are used, with the session and evidence identifiers replaced |
| DV-84-5 | AR-8 "Copy" is read as the current view's base URL, which is what the button copied before (predecessor §14.9: "Download and Copy Buttons" beside the base-URL chip) | Turning Copy into a copy of the document would change Simulated mode. Both buttons follow the current view |
| DV-84-6 | The banner now uses the Home page's `useHealth()` (`@/features/home/use-health`, a read-only import from another feature folder) | CPW1-9 asked W84 to choose one home. `lib/**` is outside this row's paths, so the next step is a finding: move `useHealth` into `lib/` (W92 or a later slot) |

## 8. Decisions for the controller

1. Close **GC-18** and record **CA-11** as confirmed (F84-1).
2. Accept **F84-4**: the Live heartbeat entry has the three members of the heartbeat view. A frame tap would be a
   `packages/shared/src/live` or `runtime` change.
3. Route **F84-3** (the all-scope health example) to the residual list for W88, or to a later contract pass.
4. Ratify **DV-84-3** (refusal only with the switch on) and **DV-84-5** (Copy = base URL of the view).
5. CPW1-9: ratify one home in `features/home/use-health.ts` for now (DV-84-6), with a move to `lib/` for W92.

## 9. Rollback (not executed)

1. Restore the pre-images. For every file under `.cache/rollback/W84/` (the 17 files of the feature folder as at
   04:45, and `packages/shared/src/i18n/en/api-reference.ts`), run `cp -p .cache/rollback/W84/<path> <path>` from
   the repository root. Hashes are in `.cache/rollback/W84.pre.sha256`.
2. Delete the four new files: `apps/core-web/src/features/api-reference/try-it.ts`,
   `apps/core-web/src/features/api-reference/use-live-realtime-feed.ts`,
   `apps/core-web/src/test/live-api-reference-document.test.tsx`, `apps/core-web/src/test/live-api-reference-page.test.tsx`.
3. Re-run `npm run test -w @dems/core-web -- --maxWorkers=2`, typecheck and lint. The diff to undo is
   `assets/84_changes.diff.txt`.

## 10. Files

| File | Change |
|---|---|
| `apps/core-web/src/features/api-reference/{index.tsx, api-document.ts, sim-fetch.ts, log.ts, realtime-panel.tsx, server-strip.tsx, service-banner.tsx, renderer-panel.tsx, actions.ts, panel.tsx, sim-adapter.ts, use-realtime-feed.ts, api-reference.css}` | modified |
| `apps/core-web/src/features/api-reference/try-it.ts`, `use-live-realtime-feed.ts` | new |
| `packages/shared/src/i18n/en/api-reference.ts` | modified, additive (+38 / −0) |
| `apps/core-web/src/test/live-api-reference-document.test.tsx` (109 tests), `live-api-reference-page.test.tsx` (7 tests) | new |
| `docs/…/implementation/84_web_api_reference.md` (this file), `assets/84_*` (4 screenshots, lane JSON and logs, mutation log and runner, final gate log, diff) | new |
| `docs/…/delegation_progress/coder_execution_step_106.md` | progress |
| Scratch (git-ignored): `.cache/w84/` (scripts, lane driver and outputs, mutation runner), `.cache/rollback/W84/`; `.locks/core-server.lane3.{log,vite.log}` overwritten and the two pid files emptied by the lane script, as W50 does | — |

---
*Written 2026-10-06 05:24 WIB.*
