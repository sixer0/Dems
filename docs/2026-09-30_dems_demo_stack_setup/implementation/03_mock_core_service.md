---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 16
agent: coder-execution
narrative_tier: 3
status: complete
date: 2026-10-01
spec: masterplan/01_specs.md §1.4 (@dems/mock-core), §1.5, §3.1-§3.6, §8 (M-1..M-3), AC-35..AC-39
---

# Row 16: `apps/mock-core` (`@dems/mock-core`)

## Installed (rule R-2, exact pins)

```
+-- @dems/mock-core@0.1.0 -> ./apps/mock-core
| +-- @dems/shared@0.1.0 deduped -> ./packages/shared
| +-- @fastify/cors@11.3.0
| +-- @fastify/websocket@11.3.1
| +-- @types/node@26.6.3
| +-- @types/ws@8.18.2
| +-- fastify@5.12.5
| +-- oxlint@1.86.0
| +-- tsx@4.23.15
| +-- typescript@6.0.3
| +-- vitest@5.0.3
| `-- ws@8.22.0
```

All 11 entries match §1.4 (`@dems/shared` declared as `"*"`, rule R-3).

## Files (under `/Users/gsp-budi/Documents/DEMS/apps/mock-core/`)

| File | Content |
|---|---|
| `package.json` | scripts per §1.5: `dev` (`tsx watch`), `start`, `build`/`typecheck` (`tsc --noEmit`), `lint` (oxlint), `test` (vitest), `probe:ws` |
| `tsconfig.json`, `vitest.config.ts` | extends root base, node types; vitest node env |
| `src/app.ts` | `buildApp({ logger? })`: registers `@fastify/cors` (§3.4 options) → `@fastify/websocket` (`maxPayload: 65536`, custom `preClose`, `errorHandler`) → heartbeat plugin + health route (in one child plugin, so the WS route is added after the websocket plugin loads). No listen |
| `src/heartbeat.ts` | Hub (`seq`, client registry, uptime); `onReady` 1 Hz ticker, `onClose` clears it; broadcast to `OPEN` clients; `GET /ws` with `preValidation` Origin allowlist (`WEB_DEV_ORIGINS ∪ SELF_ORIGINS`, absent Origin accepted, else 403 `{"error":"origin_not_allowed"}` + `ws origin rejected` log); immediate heartbeat on connect; inbound messages logged at `debug` with byte length |
| `src/index.ts` | `listen({ host: '127.0.0.1', port: 4400 })`; SIGINT/SIGTERM graceful shutdown with 5 s timeout, second signal forces exit 1, `uncaughtException`/`unhandledRejection` → `fatal` + exit 1 |
| `src/error-log.ts` | Persistent JSON-lines error log `apps/mock-core/logs/errors.log` (git-ignored by `*.log`) |
| `scripts/ws-probe.ts` | §3.6 probe: `--url --count --timeout --origin`; exit 0/1/2 |
| `test/health.test.ts` | M-1 (+ default JSON 404) |
| `test/heartbeat.test.ts` | M-2 |
| `test/ws-origin.test.ts` | M-3 (+ allowed origin and absent Origin are accepted) |

## Verification

Pre-check before starting: `lsof -nP -iTCP:4400 -sTCP:LISTEN` → exit 1 (port free).

### Typecheck and lint — PASS

```
> @dems/mock-core@0.1.0 typecheck
> tsc --noEmit
typecheck exit=0

oxlint: Found 0 warnings and 0 errors. Finished in 3ms on 9 files with 96 rules using 10 threads.
```

### Tests (M-1..M-3) — PASS

```
 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/mock-core
 Test Files  3 passed (3)
      Tests  6 passed (6)
   Duration  2.18s
```

Inside the agent sandbox only M-1 (in-process `inject()`) can run; M-2/M-3 fail with `listen EPERM: operation not permitted 127.0.0.1` because the sandbox forbids local port binding. The suite above ran with the sandbox disabled (see decisions).

### Live service (started with `tsx src/index.ts`, sandbox disabled)

Startup log: `{"level":30,…,"pid":32953,…,"msg":"Server listening at http://127.0.0.1:4400"}`

**Loopback bind only (AC-35; row-16 `lsof` column) — PASS**

```
COMMAND   PID     USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    32953 gsp-budi   31u  IPv4 0x9ae207620e1f72df      0t0  TCP 127.0.0.1:4400 (LISTEN)
```

**Health (AC-36; row-16 `curl` column) — PASS**

```
HTTP/1.1 200 OK
vary: Origin
content-type: application/json; charset=utf-8
content-length: 193

{"status":"ok","service":"dems-mock-core","version":"0.1.0","apiVersion":"v1","serverTime":"2026-09-30T17:37:35.084Z","uptimeMs":6672,"ws":{"path":"/ws","heartbeatIntervalMs":1000,"clients":0}}
```

**CORS (AC-37) — PASS**

```
--- Origin: http://127.0.0.1:5173
HTTP/1.1 200 OK
access-control-allow-origin: http://127.0.0.1:5173
--- Origin: http://evil.example
HTTP/1.1 200 OK
(no access-control-allow-origin header)
```

**WS heartbeats (AC-38; row-16 "≥ 3 heartbeats within 3.5 s" column) — PASS**

```
> tsx scripts/ws-probe.ts
seq=6 serverTime=2026-09-30T17:37:35.394Z clients=1
seq=7 serverTime=2026-09-30T17:37:35.422Z clients=1
seq=8 serverTime=2026-09-30T17:37:36.424Z clients=1
ok: 3 heartbeats in 1036 ms
probe exit=0
```

(The first line is the immediate connect-time heartbeat; the next tick followed 28 ms later.)

**Foreign Origin (AC-39) — PASS** (after the root-script fix below)

```
> npm run probe:ws -w @dems/mock-core -- --origin http://evil.example
> tsx scripts/ws-probe.ts --origin http://evil.example
upgrade rejected: HTTP 403
probe evil exit=2
```

Server log line: `{"level":40,…,"origin":"http://evil.example","msg":"ws origin rejected"}`.
Self origin (the H-S4 React Native case): `--origin http://127.0.0.1:4400 --count 2` → `ok: 2 heartbeats in 726 ms`, exit 0.

**Other path:** `GET /api/v1/nope` → `{"message":"Route GET:/api/v1/nope not found","error":"Not Found","statusCode":404}`.

**Graceful shutdown (§3.5; AC-42 server side) — PASS**

A `ws` client (Origin `http://127.0.0.1:5173`) was connected, then `kill -TERM` was sent to the tsx process:

```
server exit after 0.13 s
node 32953 exited / tsx 32949 exited
lsof after: 1 (no listener)
client close code=1001 reason=server shutting down

{"signal":"SIGTERM","msg":"shutdown requested"}
{"reqId":"req-a","clientId":5,"clients":0,"code":1001,"msg":"ws client disconnected"}
{"msg":"shutdown complete"}
```

Second run wrapped in `sh -c '…; echo "EXIT_CODE=$?"'`: `shutdown requested` → `shutdown complete` → `EXIT_CODE=0`.

`apps/mock-core/logs/errors.log` was never created: no error path fired during the run.

## Decisions and deviations

| # | Item | Decision | Reason |
|---|---|---|---|
| S16-1 | Root `probe:ws` script | Changed from `npm run probe:ws -w @dems/mock-core` to `npm run probe:ws -w @dems/mock-core --` | Without the trailing `--`, AC-39's `npm run probe:ws -- --origin http://evil.example` is swallowed by the inner npm (`npm warn Unknown cli config "--origin"`, then `ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL`). With it, arguments reach the probe; the no-argument form still works (re-run: exit 0) |
| S16-2 | Custom `preClose` | Sends `close(1001, 'server shutting down')` to every client, waits up to 1,000 ms for the handshake, `terminate()`s stragglers, then closes the WS server | The plugin's default `preClose` sends no code (clients see 1005) and a client that never answers would hold the process past the 5 s budget (ws `closeTimeout` is 30 s) |
| S16-3 | `process.exitCode = 0` instead of `process.exit(0)` after `shutdown complete` | Natural exit | On macOS, stdout to a pipe is asynchronous; an immediate `exit()` can drop the final log line. The unref'd 5 s timer still forces exit 1 if anything hangs |
| S16-4 | Persistent error log `logs/errors.log` | Added (JSON lines: `timestamp`, `service`, `level`, `source`, `message`, `stackTrace`, `context`); written from the HTTP `onError` hook, the WS `errorHandler`, socket `error` events, shutdown timeout and fatal handlers | Executor rule: errors must persist beyond stdout. No new dependency (node:fs). Stdout JSON logging (§3.1) is unchanged |
| S16-5 | Client-side error ingestion endpoint (`POST /api/logs/error`) | **Not added** | mock-core scope is fixed at health + heartbeat (D3/D4); any new route is for the second gate (D26 already flags possible mock-core growth) |
| S16-6 | Probe closes with 1000 on success | `socket.close(1000)` then exit (1 s fallback) | Earlier runs used `terminate()`, which the server logged as code 1006; after the change the server logs `"code":1000` |
| S16-7 | Sandbox | Local port binding and the `tsx` IPC socket are blocked inside the agent sandbox; every command that listens (tests M-2/M-3, the live service, probes against it) ran with the sandbox disabled. User option: `sandbox.network.allowLocalBinding: true` allows binding without leaving the sandbox | Sandbox restriction only |

## Processes started and stopped

| PID | Process | Stopped by | Confirmed |
|---|---|---|---|
| 32949 / 32953 | tsx parent / node (`src/index.ts`), run 1 | `kill -TERM 32949` | both exited; no 4400 listener |
| 33274 / 33277 | tsx parent / node, run 2 (exit-code capture) | `kill -TERM 33274` | `EXIT_CODE=0`; both exited; no 4400 listener |
| (short-lived) | probe runs and the close-code client | exited on their own | n/a |

## Rollback

`rm -rf apps/mock-core && npm install`, and restore the root `probe:ws` script if the workspace is removed.

---
*Generated: 2026-10-01 00:40 WIB*
