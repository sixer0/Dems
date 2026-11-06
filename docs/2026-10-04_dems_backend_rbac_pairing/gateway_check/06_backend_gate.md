---
task_id: 2026-10-04_dems_backend_rbac_pairing
blueprint_step: 80
plan_row: W58
title: GATE: backend
agent: verifier-local
date: 2026-10-05
status: passed-with-notes
source_plan: docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
resources: "127.0.0.1:4420 + dems_demo under .locks/core-server.lock (P18), released"
verdict_line: "W58: PASS-WITH-NOTES"
---

# Backend gate (plan row W58, blueprint step 80)

Run from `/Users/gsp-budi/Documents/DEMS` on 2026-10-05, WIB (host clock unchanged), by the
verifier (free tier). Read-only on the code: **no source file was written by this row**. The
written paths are this document, `gateway_check/assets/06_*`, and
`delegation_progress/verifier_local_step_80.md`.

Rule basis: plan §11.1 GR-1…GR-9, §11.2 (the gate commands), §11.3 and P24 (the ledger), P9 (load
guard and "no client-row live check while a gate row runs"), P10 (per-command sandbox bypass for
database and port work, no `cd`, no `timeout`), P11 (noise from a row in flight), P15 (PostgreSQL
PID 19121 left exactly as found, no connection as `dems_admin`), P18 (sole ownership of 4420 +
`dems_demo`, PID recorded, lock released), P19 (no credential value printed anywhere in this
document or its assets; the seeded password is named only by its constant
`DEMO_OPERATOR_PASSWORD`), M12/M15 (whole-project suites once, `--maxWorkers=2`).

D31 makes the shifted-clock sweep part of this gate; D95 and D113 are its preconditions (CP-B1
open blockers 0; both CP-S1 Medium closed); D142 is the restated ledger; D145 is this launch.

## 0. Host state before the gate

| Check | Value |
|---|---|
| PostgreSQL | `.locks/postgres.pid` = `19121`, `ps -p 19121 -o lstart` = `Sun Oct  4 07:14:26 2026`; `npm run pg:status` → `pg:status: OK, running`. Never restarted, never connected to as `dems_admin` (P15) |
| Load average at the start | `4.06 3.65 4.17` (10 cores). Peak during the run: `8.87` at 17:22. Below the P9 trigger of 10 |
| Listeners before the smoke | none on `4420`–`4423`, `5176`–`5178`, `8081`–`8086` → no lane backend was running while this gate ran (P9, §5.4) |
| Databases before any work (`assets/06_b0_db_inventory_before.log`) | 7 in the cluster: `dems_demo`, `dems_lane_1..3` (owner `dems_owner`), `postgres`, `template0`, `template1`; databases with prefix `dems_test_`: **0** |

---

## A. The gate commands of §11.2 for `@dems/core-server` and `@dems/shared`

| # | Command | Exit | Measured |
|---|---|--:|---|
| A1 | `npm run typecheck -w @dems/core-server` | **0** | no output beyond the script banner → no diagnostic, no warning (`assets/06_a1_typecheck_core_server.log`) |
| A2 | `npm run lint -w @dems/core-server` | **0** | `oxlint` printed no finding line (`assets/06_a2_lint_core_server.log`) |
| A3 | `npm run test -w @dems/core-server -- --maxWorkers=2` (project `unit`) | **0** | 153 files / 3,912 tests, 0 failed, 34.82 s |
| A4 | `npm run test -w @dems/shared -- --maxWorkers=2` | **0** | 68 files / 1,814 tests, 0 failed, 8.37 s |
| A5 | `npm run test:pg-scripts` | **0** | `tests 55`, `pass 55`, `fail 0`, `duration_ms 135.353083` |
| A6 | `node --import tsx packages/shared/scripts/gen-openapi.ts --check` | **0** | document up to date, 75 operations, 2 security schemes, 0.2.0 |

Quoted output (verbatim, `EXIT=` lines appended by this row):

```
$ npm run typecheck -w @dems/core-server        # 17:16:29
> @dems/core-server@0.2.0 typecheck
> tsc --noEmit
EXIT=0

$ npm run lint -w @dems/core-server             # 17:16:42
> @dems/core-server@0.2.0 lint
> oxlint
EXIT=0

$ npm run test -w @dems/core-server -- --maxWorkers=2      # project unit, Start at 17:16:52
 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/core-server
 Test Files  153 passed (153)
      Tests  3912 passed (3912)
   Start at  17:16:52
   Duration  34.82s (import 59%, tests 37%, transform 4%)
EXIT=0

$ npm run test -w @dems/shared -- --maxWorkers=2           # Start at 17:17:34
 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/packages/shared
 Test Files  68 passed (68)
      Tests  1814 passed (1814)
   Start at  17:17:34
   Duration  8.37s (tests 60%, import 30%, transform 9%, worker 1%)
EXIT=0

$ npm run test:pg-scripts                                   # node --test scripts/pg/
ℹ tests 55
ℹ suites 0
ℹ pass 55
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 135.353083
EXIT=0

$ node --import tsx packages/shared/scripts/gen-openapi.ts --check
packages/shared/openapi/openapi.json is up to date (all (committed): 75 operations, 2 security schemes, version 0.2.0; offline: 10 operations, 0 security schemes, version 0.1.0)
EXIT=0
```

Not run here by design: the root `npm run typecheck` / `npm run lint` / `npm test` and the
`@dems/mock-core` line — those belong to W89 (GR-4, GR-6, AC-B-58). The `@dems/core-web` and
`@dems/mobile` projects were run by this row only as part of item C; see the note in §C.

## The ledger comparison (P24, L-3, L-4; D142)

| Workspace / project | Baseline at `acaff20` (§11.3) | D142 / D144 restated expectation | Measured by this gate | failed | Files ≥ baseline | Verdict |
|---|--:|--:|--:|--:|--:|---|
| `@dems/core-server` project `unit` | 0 / 0 (did not exist) | 153 files / 3,912 | **153 / 3,912** | 0 | yes | equal to the restated ledger |
| `@dems/core-server` project `db` | 0 / 0 | 122 files / 1,740 | **122 / 1,740** | 0 | yes | equal to the restated ledger |
| `@dems/shared` | 28 / 508 | 68 / 1,814 | **68 / 1,814** | 0 | yes | equal to the restated ledger |
| `@dems/core-web` (item C only) | 39 / 438 | D144 quoted 55 / 759 | 55 / **760** | 0 | yes | **+1 test over the last reported number** → note F-1 |
| `@dems/mobile` (item C only) | 72 / 833 | not restated in D142/D144 | 94 suites / 1,230 | 0 | yes | above the baseline; the sum of the mobile rows' reported additions needs no correction here → note F-1 |

Per L-3 every line has `failed = 0`, the runner's total equals the passed count, the total is at or
above the ledger, and the file/suite count is at or above the baseline. Nothing is below the
ledger, so no FAIL names a row.

---

## B. The whole `db` project

```
$ DEMS_TEST_STEP=80 npm run test:db -w @dems/core-server -- --maxWorkers=2     # 17:19:19 → 17:21:51
 Test Files  122 passed (122)
      Tests  1740 passed (1740)
   Start at  17:19:19
   Duration  151.47s (tests 81%, import 18%, transform 1%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 8 database(s) in 509 ms; 0 remain with the run prefix dems_test_step_80_tmfjc7ny_
EXIT=0
```

Independent confirmation after the run (`assets/06_b2_db_inventory_after.log`, read-only
`pg_database` query as `dems_app` through `assets/06_db_inventory.mjs`, which prints names and
counts and never a value):

```
databases in the cluster: 7
databases with the prefix "dems_test_": 0
LEFTOVER databases of this run (prefix "dems_test_step_80_"): 0
```

The cluster's `db:status` counters printed inside the run report every one of the 30 bulk-fixture
minimums met (`bulk fixture: every minimum of the 30 tables is met; audit head seq 5000`). Exit 0,
0 retried drops, 0 databases left with this row's prefix. **B PASS.**

One line of noise in the same log: `(node:81906) [FST_LIGHTMYREQUEST_DEP01] DeprecationWarning:
You are accessing "request.connection", use "request.socket" instead.` — once. No production file
of `@dems/core-server` reads `request.connection` (a search over `src/` and `test/` finds only
`hub.ts`'s own local variable named `connection` and a pg-client test), so the access is inside a
dependency. Recorded as note F-8.

---

## C. The shifted-clock sweep (D31: part of this gate)

Recipe exactly as recorded in `implementation/01b_calendar_sweep.md` §12 (scratch helpers in the
git-ignored `.cache/w01b/`, which still exist; driver saved as `assets/06_clock_sweep.sh`). Jest
takes `--setupFiles` last. Instants are the three D31 requires, using W01b's labels (i) just after
midnight, (iii) just before midnight, (v) another year.

Shift proof that the instant really reached the runners: vitest prints `Start at 00:05:00`,
`Start at 23:58:00`, `Start at 12:00:00` in the shifted runs (real-clock run prints `17:22:33`).
For jest, whose test contexts hold their own `Date`, one file was run again with
`DEMS_FAKE_PROBE` set at instant (v) — `assets/06_c_jest_probe.txt`:

```
ctx new Date()=2027-03-01T05:00:00.423Z Date.now()=1803877200423 offsetSrc=env worker=1
```

which is 12:00:00 WIB on 2027-03-01, i.e. the shift is live inside the test context (exit 0,
`assets/06_c_jest_probe_run.log`).

| Instant | `@dems/core-web` | `@dems/shared` | `@dems/mobile` |
|---|---|---|---|
| real clock (17:22–17:26) | 55 files / **760 passed**, exit 0 | 68 / 1,814 passed, exit 0 | 94 suites / **1,230 passed**, exit 0 |
| (i) `2026-10-06T00:05:00+07:00` (17:26–17:28) | 1 failed \| 54 passed (55); 1 failed \| 759 passed (760) — **exit 1** | 68 / 1,814 passed, exit 0 | 94 / 1,230 passed, exit 0 |
| (iii) `2026-10-06T23:58:00+07:00` (17:29–17:31) | 55 / 760 passed, exit 0 | 68 / 1,814 passed, exit 0 | 94 / 1,230 passed, exit 0 |
| (v) `2027-03-01T12:00:00+07:00` (17:31–17:34) | 55 / 760 passed, exit 0 | 68 / 1,814 passed, exit 0 | 94 / 1,230 passed, exit 0 |

Twelve suite runs at four instants; eleven exit 0. The single red is **not a calendar failure** and
is **not in this gate's scope**:

```
 FAIL  src/test/live-login-model.test.tsx > static rules of the folder > WS-10 (decision D128):
       the presentation follow-up is installed in ONE place, the root route, with its clean-up;
       the Login page installs nothing
AssertionError: live-adapter.ts: expected [] to have a length of 1 but got +0
    277|       expect(calls, name).toHaveLength(name === 'live-adapter.ts' ? 1 …
```

Attribution (P11): that web run executed 17:26:16 → 17:27:32, i.e. exactly while the CP-W1 fix round landed D144(1) (its own board report describes the same file move and the same suite going 759 → 760). The two files it reads were being
moved by the concurrently running web writer at that moment —
`apps/core-web/src/runtime/presentation-follow.ts` mtime 17:27,
`apps/core-web/src/test/live-login-model.test.tsx` mtime 17:28 (D145 records that this gate launched
beside one writer over `apps/core-web/**`). The assertion is about the location of
`followServerPresentationMode(`, which is exactly the move D144 ruling (4) ordered; it holds no
date. Re-runs of the same suite at the real clock (17:22), at 23:58 (17:29) and at 2027-03-01
(17:31) all pass 760/760, so the cause had ended, as P11 expects. Owner: the web row in flight
(the D144 rulings' implementer, `apps/core-web/**`), **not** this gate. No calendar-dependent test
was found in any of the three suites, which is what D31 asked this sweep to confirm.

**C PASS** (with note F-2 for the attributed red).

---

## D. The smoke run as sole owner of 4420 with `dems_demo`

Everything below ran inside `/usr/bin/lockf -k -t 900 .locks/core-server.lock`
(`assets/06_smoke_run.sh`, run transcript `assets/06_d2_smoke_run.log`, server stdout/stderr
`assets/06_d2_server.log`, mode 600). PostgreSQL was not touched; the only process this row
started is the Core server, and it is stopped again.

| Step | Quoted result |
|---|---|
| listener before the start | `    no listener on 4420` |
| database snapshot before | `[before-start] open_sessions=2 (web=2, device=0) \| audit rows=86 head_seq=86 \| ACCESS_DENIED=1 AUTH_EXPIRED=0 AUTH_SUCCESS=15` (2 open sessions and 1 `ACCESS_DENIED` exist because of this row's first attempt, §D-attempt1) |
| start (documented command, §5.3 pattern, port 4420 = main instance) | `DEMS_CORE_PORT=4420 npm run start -w @dems/core-server` → `npm pid=4396, recorded in .locks/core-server.pid`; `listener pid=4421 after 1 s` |
| **health** | `PASS \| health \| status=200 envelope_keys=[status, service, version, apiVersion, serverTime, uptimeMs, ws, ready] service=dems-core-server version=0.2.0 ready={"database":true,"engine":true} ws={"path":"/ws","heartbeatIntervalMs":1000,"clients":0}` — also quoted by `curl`: `{"status":"ok","service":"dems-core-server","version":"0.2.0","apiVersion":"v1","serverTime":"2026-10-05T10:43:02.934Z",…,"ready":{"database":true,"engine":true}}` with `health http_status=200` |
| **sign-in** (SUPERVISOR, `Origin: http://127.0.0.1:5173`, password from `DEMO_OPERATOR_PASSWORD`) | `PASS \| sign-in SUPERVISOR (web console origin, cookie) \| status=200 … cookie=dems_session_4420 (47 chars) attributes=["Path=/","HttpOnly","SameSite=Strict"] set_cookie_shows_value=no` |
| **one protected call** (`listUsers`, needs `USER_ADMIN`) | `PASS \| protected call listUsers as SUPERVISOR (holds USER_ADMIN) \| status=200 users=3 roles=INVESTIGATOR/SUPERVISOR/TECHNICIAN` |
| **one denied call** (`listUsers` as INVESTIGATOR) | `PASS \| denied call listUsers as INVESTIGATOR answers 403 \| sign-in status=200; denied status=403 code=NOT_PERMITTED` |
| **exactly one `ACCESS_DENIED` row** | `PASS \| exactly one ACCESS_DENIED audit row for that call \| seq=89 type=ACCESS_DENIED actor=OPR-001 message="Access denied: role INVESTIGATOR lacks USER_ADMIN (listUsers)" details={"role":"INVESTIGATOR","permission":"USER_ADMIN","operationId":"listUsers",…}` — the query is `select … from audit_log where type='ACCESS_DENIED' and seq > <max seq before the call>`; exactly one row returned |
| **the socket heartbeat** | `PASS \| socket heartbeat on /ws (cookie of the web session) \| verdict=both received types=[hello, snapshot, heartbeat] hello={epoch:2,…}`. Quoted in full by the follow-up probe (`assets/06_d3_probe_run.log`): `{"type":"hello","v":1,"connectionId":"9edd0157-…","epoch":3,"principal":"OPERATOR","topics":["heartbeat","control","state","meters","admin"],…}` and `{"type":"heartbeat","v":1,"seq":0,"serverTime":"2026-10-05T10:58:22.369Z","uptimeMs":0,"intervalMs":1000,"clients":1,"sessionState":null}` with `heartbeat_validates_against_HeartbeatSchema=true`, then `sign-out status=204` |
| the audit trail this run added | `AUDIT_SINCE_START count=3 seqs=[87:AUTH_SUCCESS, 88:AUTH_SUCCESS, 89:ACCESS_DENIED]`; across all three starts this gate added 9 rows (83-91), read as `dems_app`: `83 TABLET_LINK_CHANGED (actor null, boot marker named by D54 DN-1)`, `84 AUTH_SUCCESS OPR-002`, `85 AUTH_SUCCESS OPR-001`, `86 ACCESS_DENIED OPR-001`, and in the second start `+AUTH_SUCCESS ×2, ACCESS_DENIED, AUTH_SUCCESS/AUTH_SIGNED_OUT` from the probe |
| `lsof -nP -iTCP:4420 -sTCP:LISTEN` | exactly one line: `node 4421 gsp-budi 17u IPv4 … TCP 127.0.0.1:4420 (LISTEN)` → one listener, on `127.0.0.1` |
| `lsof -nP -a -p 4421 -i` | three sockets, all loopback: `TCP 127.0.0.1:55697->127.0.0.1:4432 (ESTABLISHED)`, `TCP 127.0.0.1:4420 (LISTEN)`, `TCP 127.0.0.1:55707->127.0.0.1:4432 (ESTABLISHED)` — no non-loopback address (SR-01) |
| stop | `kill -TERM 4421` → `listener gone after 0 s`, `npm pid 4396 alive: no`, `listener on 4420 after the stop: none`. Server log ends with the graceful sequence: `"signal":"SIGTERM","msg":"shutdown requested"` → `"readiness hold"` → `"part":"engine","ready":false` → `"epoch":2,"revision":29,"msg":"engine stopped"` → `"drained":true,"abandoned":0,"completed":513,"failed":0,"timedOut":0,"refused":0,"msg":"pipeline closed"` → `"part":"database","ready":false` → `"msg":"shutdown complete"` |
| lock release | `.locks/core-server.pid` truncated to 0 bytes; `lockf` returned with the script; `RUN_EXIT=0`. Port 4420 free at the end of §G |

Every step PASS with its status quoted. **D PASS.** State residue left in `dems_demo` is note F-4.

### D-attempt1 (recorded for honesty, P11-style completeness)

The first smoke attempt (`assets/06_d1_smoke_run_attempt1.log`, `assets/06_d1_server_attempt1.log`)
finished all nine steps with `RUN_EXIT=0` but reported two `FAIL` lines that were **bugs of this
row's own asset script**, not of the server: it read `body.data.service` and `body.data.users`
while the API answers with a flat envelope (`{status, service, …, ready}`), so two PASS-worthy
steps printed `service=undefined` / `users=0`. The same attempt also showed that asset
`06_sweeper_watch.mjs` checked out a `pg` client without releasing it, so `pool.end()` waited
forever and the run sat for 9 minutes until this row killed the process it had started (P7: a
process of its own). Both defects were fixed inside the assets and the run was repeated cleanly
(`06_d2_*`, `06_d3_*`). Server-side evidence from the failed attempt agrees with the clean run:
the audit rows it produced are the ones quoted above, and the health answer it received is the one
quoted from `curl`.

---

## E. The session sweeper's first real run on a listening server (residual F62 item 5)

What the sweeper is: `createSweeper({ intervalMs: SESSION_SWEEP_INTERVAL_MS /* 5 s */ , sweep: () => registry.sweep() })`, started in
`onListen` and stopped in `preClose` (`apps/core-server/src/modules/identity/index.ts:132-158`,
`modules/identity/sweeper.ts`). It writes no log line when it succeeds; a session it ends gets one
`AUTH_EXPIRED` row and a `session.ended` publication, and `registry.sweep()`
(`modules/identity/sessions.ts:278-291`) first asks `ANY_EXPIRED_SESSION` on the pool and opens no
transaction at all when nothing is expired. It therefore had never been observed on a server that
listens (every earlier row's app did not listen).

It was observed from outside by sampling `pg_stat_activity` for the server's own connection
(`application_name = 'dems-core-server'`) while its statement text contained the sweep's read
(`assets/06_sweeper_watch.mjs`; prints counts and instants only):

```
[sweeper-watch] seconds=25 samples=184421 server_connections_seen=2 sweep_reads_observed=1
[sweeper-watch] instants of the sweep read: 10:56:23.233
```
and, in the earlier and later runs, at `10:43:12.661` and `10:58:31.724`.

State around it: `open_sessions=2 … audit rows=86 … AUTH_EXPIRED=0` before, and
`open_sessions=2 … audit rows=86 … AUTH_EXPIRED=0` 25 s later; after the probe run
`open_sessions=4 … AUTH_EXPIRED=0`.

**Observed and stated:** the sweeper **ran** on the listening server — its read statement was seen
directly on the server's own connection at three separate instants across three separate starts,
at intervals consistent with the 5 s timer. What it **did**: it asked `ANY_EXPIRED_SESSION`, found
nothing past the idle limit (15 min) or the absolute limit (8 h) — `dems_demo` held only fresh web
sessions — and therefore opened no transaction, took no chain lock, wrote no row and published
nothing (`AUTH_EXPIRED` stayed 0 in every snapshot). Its error path was never taken (no
`the session expiry sweep failed` line in any server log). This closes residual F62 item 5 as
"ran, correctly, with nothing to expire"; the path that ends a session is covered by W24's clock
tests, not by this gate. The direct observation is sampling-limited: one read caught per ~20-25 s
window although the timer ticks every 5 s (note F-5).

---

## F. A live `npm audit` (the item queued on 2026-10-04 by D113)

Run live against the registry; nothing installed, no manifest or lockfile touched.

```
$ npm audit                                  # assets/06_f_npm_audit.log
80 vulnerabilities (5 low, 25 moderate, 50 high)

To address all issues (including breaking changes), run:
  npm audit fix --force
EXIT=1
```

`npm audit --json` metadata (`assets/06_f_npm_audit.json`): `{"info":0,"low":5,"moderate":25,
"high":50,"critical":0,"total":80}`. **High: 50. Critical: 0.** Those 80 entries come from 16
distinct advisories — 4 high, 8 moderate, 4 low:

| Severity | Advisory (title as npm reports it) |
|---|---|
| high | undici — TLS certificate validation bypass via dropped connect options in BalancedPool |
| high | undici — Denial of Service via unrequested WebSocket subprotocol |
| high | node-forge — RSA PKCS#1 v1.5 signature verification accepts extra nested DigestAlgorithm elements |
| high | braces — stack-exhaustion denial of service through deeply nested patterns |
| moderate | esbuild — any website can send requests to the development server and read the response (the advisory already recorded in D27, GHSA-67mh-4wv8-2f99, nested under `drizzle-kit`) |
| moderate | decode-uri-component — DoS via exponential decoding; uuid — missing buffer bounds check in v3/v5/v6; 5 further undici DoS/cookie-cache advisories |
| low | 4 (undici chunked-truncation, unsafe-method caching, retry-interceptor splitting; `@ai-sdk/provider-utils` resource consumption) |

The 11 direct dependency entries carrying a finding are
`@scalar/api-reference-react` (low), `@scalar/openapi-parser` (moderate), `drizzle-kit` (moderate),
`expo` (high), `expo-router` (moderate), `expo-splash-screen` (moderate), `jest` (high),
`jest-expo` (high), `react-native` (high), `react-native-reanimated` (high),
`react-native-worklets` (high). **Every high-severity direct entry sits in the mobile/test chain**;
none of `@dems/core-server`'s runtime dependencies (fastify, `@fastify/*`, `pg`, `ws`, zod,
drizzle-orm, `rate-limiter-flexible`, tsx) appears as a direct finding, and none of the four high
advisories is reachable from the server's runtime set. The queued item is discharged; the triage
decision stays with the dependency rows and the final security review (W99) — this row changed
nothing.

---

## G. Hygiene

### G-1 Log scan (`assets/06_log_scan.mjs` → `assets/06_g1_log_scan.log`)

Patterns searched: the value of `DEMO_OPERATOR_PASSWORD`, the value of `DEMO_PAIRING_CODE`,
`ses_…` / `dvc_…` / `bio_…` shaped tokens, this row's request marker `w58-log-probe-marker-4c17`,
a `?token=` parameter, a URL containing `?`, and any `authorization` / `cookie` / `set-cookie` /
`password` key carrying a value. The scanner prints counts only, never a matched line.

```
06_d1_server_attempt1.log: lines=42 bytes=6892  findings=0 (clean)
06_d2_server.log:          lines=42 bytes=6853  findings=0 (clean)
06_d3_server.log:          lines=33 bytes=4491  findings=0 (clean)
06_d3_probe_run.log:       lines=21 bytes=127808 findings=0 (clean)
.locks/core-server.lane3.log: lines=118 bytes=21948 findings=0 (clean)   (another row's lane backend log, read-only)
06_d1_smoke_run_attempt1.log / 06_d2_smoke_run.log: findings=1 each — both are this row's own step label
       ("a ?token= query"), not a server entry:  "PASS | log probes sent (a ?token= query …)"
TOTAL findings over 7 file(s): 2   (both in this row's own console transcript)
```

That the deliberate probes left nothing in the server log is visible directly — the request lines
hold the route pattern and never a raw URL (AC-B-29, SR-48/SD-05). The health probe sent with
`?token=w58-log-probe-marker-4c17` logged as:

```
{"level":30,…,"reqId":"fb5364b8-…","method":"GET","route":"/api/v1/health","status":200,"durationMs":3,"principal":null,"msg":"request completed"}
```
and the malformed body holding the same marker as
```
{"level":30,…,"reqId":"f7c39709-…","method":"POST","route":"/api/v1/auth/sign-in","status":400,"durationMs":1,"principal":"operator:OPR-002","code":"INVALID_JSON",…}
```
A count of the raw-URL key over the whole smoke-run log is `grep -c '"url"' → 0`; the keys present
are `route`, `reqId`, `method`, `status`, `durationMs`, `principal`, `time`, `pid`, `level`,
`hostname`, `step`, `ready`, `part`.

Coverage statement, honestly: the acceptance suites of W47/W48/W49/W52/W53 boot the app
in-process, where the logger's persistent file is off, so they leave **no server log file** to
scan — `apps/core-server/logs/` does not exist on this tree. What was scanned is every listening
server log that does exist: this row's three runs on the main instance and another row's captured
lane backend log `.locks/core-server.lane3.log`. Per-row log captures inside those tests (W24's
102-line capture, W32's 149-line capture) were checked by their own rows and are cited in D78 and
D93.

### G-2 File modes (`stat -f '%Lp'`, `assets/06_g2_hygiene_checks.log`)

```
700 .data
700 .data/postgres
600 .data/pg.pwfile
600 .data/pg.owner.env
600 .data/pg.env
600 .data/pg-scripts.log
600 .data/postgres.log
600 gateway_check/assets/06_d1_server_attempt1.log
600 gateway_check/assets/06_d2_server.log
600 gateway_check/assets/06_d3_server.log
```
As required: 700 for `.data/`, 600 for the three credential files and for the logs (AC-B-64,
SR-02/SR-77). `npm run pg:status` independently reports the same values.

### G-3 Leftovers

```
leftover listeners on 4421-4423, 5176-5178, 8081-8086: (none)
no listener on 4420
.locks/core-server.lock  size 0        (the lockf file lockf created; released)
.locks/core-server.pid   size 0        (this row's PID file, emptied when its process stopped)
.locks/postgres.pid      19121         (not this row's; PID alive since Oct 4 07:14:26 — untouched)
```
Verified once more at the moment this row returned (18:16 WIB):

```
no listener on 4420
none of this row's pids alive            (4396 4421 5675 5698 98496 98520)
pid file: []                             (.locks/core-server.pid)
no lockf process of this row             (lock released)
databases with the prefix "dems_test_": 0
LEFTOVER databases of this run (prefix "dems_test_step_80_"): 0
load averages: 4.49 3.67 3.82
```

No `.locks/*.pid` of this row holds a live PID; no process this row started is alive; the other
rows' PID files were not modified. The databases this row used are 0 (`assets/06_b2_db_inventory_after.log`).

---

## Findings and notes (nothing fixed by this row, as instructed)

| ID | Severity | What | Owner |
|---|---|---|---|
| F-1 | Note | The `@dems/core-web` line moved from the 759 quoted in D144 to the **760** measured here at four instants, while a web writer was editing `apps/core-web/**` during this gate. Under L-4 a total above the ledger is noted here; it is **already accounted for** — the CP-W1 fix round (`ses_ef4731d24ffeluZkUoANER6CRz`, board message `board_7443829d`, 17:36 WIB) reported landing D144(1) with "Web suite green after the landing: 55 files / 760 tests exit 0 (was 759; +1 new test proving the Login page's `login.modeSwitch` source)". No ledger correction is owed by this gate. Not a defect | CP-W1 fix round (web), reported by its own row |
| F-2 | Note (P11) | One red in `apps/core-web/src/test/live-login-model.test.tsx` ("WS-10 … the presentation follow-up is installed in ONE place") at sweep instant (i) only, 17:26:16–17:27:32, while that folder's owner edited `runtime/presentation-follow.ts` (mtime 17:27) and the test itself (mtime 17:28). Re-runs at the real clock, at 23:58 and at 2027-03-01 pass 760/760. Out of this gate's scope per P11; recorded with both runs as required | CP-W1 fix round (web), whose landing caused it and whose re-run is green |
| F-3 | Low | Live `npm audit`: 80 entries / 16 advisories, **50 high, 0 critical**; the 4 high advisories are undici ×2, node-forge, braces, all reached through the mobile/test chain; `esbuild`'s moderate is the D27-recorded nested copy. Triage decision still open | W03/W13/W14 dependency rows; final review W99 |
| F-4 | Low | `dems_demo` state after this gate: audit head **91** (seed 82 → +9: `TABLET_LINK_CHANGED` boot marker ×1, `AUTH_SUCCESS` ×3, `ACCESS_DENIED` ×2, `AUTH_SUCCESS`+`AUTH_SIGNED_OUT` from the probe), and **4 open web sessions** (`OPR-001`, `OPR-002`) that this gate signed in and left open. Their last touch is 17:56:38 WIB and their idle limit is 15 min, so from 18:11 WIB they are past it; the first server that listens after that instant ends all four with four `AUTH_EXPIRED` rows in its first sweep. Their absolute limit is 8 h (`absolute_expires_at` = 01:56 WIB on 2026-10-06). A later row that measures audit deltas from a fresh boot should expect that burst, or run `db:reset` first (W90 rebuilds the database anyway) | next holders of 4420 (W86, W90, W94-W98) |
| F-5 | Info | The sweeper's direct observation is sampling-limited (one sweep read caught per ~20-25 s although the timer is 5 s). The claim "it ran" rests on three positive observations, not on a full census; "what it did" rests on the row counts and on the read-first guard in `sessions.ts:278-291` | evidence limit, recorded |
| F-6 | Low | `.data/postgres.log` is 57 MB and unrotated (measured during this run; `pg:status` lists it at mode 600). Already ruled in D113 CPS1-9: `log_error_verbosity = terse` plus a size bound at the next planned quiet restart | W89 (root gate) restart, `scripts/pg/` owner |
| F-7 | Info | `apps/core-server/logs/errors.log` does not exist on this tree: in-process tests persist nothing, and a clean listening run with no error writes nothing. So no artifact of the persistent error log exists yet from any backend run | W99 (log-capture proof), optionally W08 |
| F-8 | Info | One Node `DeprecationWarning FST_LIGHTMYREQUEST_DEP01` ("request.connection") during the whole-`db` run; no production or test source of `@dems/core-server` accesses `request.connection`, so it originates inside a dependency's injected-request path | dependency watch; no action taken |
| F-9 | Info, self | Two defects in this row's own asset scripts, both disclosed and fixed inside `gateway_check/assets/06_*`: a wrong envelope path (made two steps print FAIL against a healthy server) and an unreleased `pg` client that made the first run hang for 9 minutes until this row killed the process it had started. The server behaved correctly throughout; the first attempt's log is kept as `06_d1_smoke_run_attempt1.log` | this row (W58) |

No blocker, no High. Every item above is a note, an evidence limit, or an already-scheduled
residual; none is a failure of the code this gate covers.

## Verdict

Gate commands (A): all six exit 0, totals exactly on the restated ledger. Whole `db` project (B):
exit 0, 0 databases left. Shifted-clock sweep (C): twelve suite runs, no calendar failure anywhere
in web, shared or mobile; one red in another row's in-flight folder, re-run green (P11). Smoke run
(D): seven steps PASS with their statuses quoted, one loopback listener, loopback sockets only,
process stopped, lock released. Sweeper (E): observed running on a listening server, did the right
thing with nothing to expire. Audit (F): quoted, high=50 / critical=0, queue item discharged.
Hygiene (G): clean logs, correct modes, no leftovers. Precondition of GR-9: W104 (checkpoint
commit 1, step 125) may run.

W58: PASS-WITH-NOTES
