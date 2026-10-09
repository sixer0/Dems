---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 57 (M3-W1)
date: 2026-10-09
agent: coder-execution (driver; a navigator re-runs section 8)
source_plan: docs/2026-10-07_dems_real_capture_sealing/identification/02_structured.md:220
narrative_tier: 3
status: needs-review (code and the three named checks are done and green; two register IDs the row lists as "closes" are NOT closed, see section 2)
closes: NM-03, CS-01, CS-03
not_closed: SH-18, CS-04 (reason and routing in section 2)
depends_on: row 56 (M2 gate), row 52 (capture-config module)
---

# Row 57 / M3-W1: capture supervisor, IPC protocol, `capture` seam, P25 edits 1-6 and 11-12

Base: HEAD `9d3a1ef`. Nothing is committed (the controller commits). Rows 111 and 113 worked in the
same tree at the same time; their files are named wherever a result depends on them.

## 1. What exists now, and what is a stand-in

| Thing | State | Where |
|---|---|---|
| IPC protocol (messages, zod schemas, frame format, limits, back-off function) | real | `packages/capture-protocol/src/index.ts` (389 lines) |
| Supervisor: one worker per session, handshake, heartbeat watchdog, back-off restart, `CAPTURE_FAULT`, correlation IDs, back-pressure both ways | real | `apps/core-server/src/capture/supervisor.ts:125` (`createCaptureSupervisor`) |
| Process channel: the worker as a real child process over stdin/stdout | real, tested with real processes and real signals | `apps/core-server/src/capture/ipc.ts:49` (`createProcessLauncher`), spawn at `ipc.ts:55` |
| `capture` seam, unit registration, entry-point boot/shutdown | real | `apps/core-server/src/app.ts` (8 lines), `apps/core-server/src/index.ts` (2 lines), section 4 |
| Persistent error logging of worker-down and `CAPTURE_FAULT` | real | `apps/core-server/src/capture/index.ts:95`, `:102`, `:79` |
| Static guard of `src/capture/` | real | `apps/core-server/src/capture/__tests__/static.test.ts` |
| **The worker in every test** | **STAND-IN** | `FakeWorkerProcess` (in memory, `apps/core-server/test/support/capture.ts`) and `capture-stub-worker.mjs` (a Node script as a real OS process; it records nothing, opens no port, writes no file) |
| **The worker of the running server** | **NONE** | `apps/core-server/src/capture/index.ts:75` passes `unconfiguredLauncher` (`ipc.ts:154`): the worker path and capture mode are config keys of spec §I edits 7-10 = row 58. On the server every `app.capture.start(...)` fails at once with `CAPTURE_FAULT / CAPTURE_WORKER_NOT_CONFIGURED`. Nothing calls `start` yet. |
| The real C worker (`apps/capture-worker/`, row 111) | not touched, not read; whether it speaks this protocol is UNKNOWN | row 58 conforms it to `packages/capture-protocol` |
| Engine INTERNAL actions (`applyCaptureTelemetry`, `applySealingProgress`, `completeSeal`, `raiseCaptureWarning`) | **do not exist** | section 2 |
| "the next session produces a fresh playable file" (second half of M3-KC-1) | NOT measured: no media exists at this row | row 58 (M3-KC-1 is listed there again) |
| `index.ts` edits 11/12 at runtime | NOT exercised by an automated test: no test in the repository starts the entry point (pre-existing gap). Held by a static pin, the type checker and the same two calls on the real app factory (section 5.5) | first restart of a lane shows log lines `capture supervisor booted` / `capture supervisor stopped` |

No port was bound by this row (IPC is the child's standard streams). Ports 8554-8564 appear only as
text inside test plans.

## 2. Not closed: SH-18 and CS-04

The row text says "closes NM-03, CS-01, CS-03, CS-04, SH-18". Two of them are not closed.

- **Fact.** `packages/shared/src/api/sim-actions.ts:1` still describes "The 42 actions"; its only
  INTERNAL action is `setTabletLink` (`sim-actions.ts:93`). `grep -rn "applyCaptureTelemetry\|applySealingProgress\|completeSeal\|raiseCaptureWarning" packages/shared/src apps/core-server/src`
  finds comments only, no action, no engine entry point. `implementation/15_m2_api_contract.md:10`
  lists SH-18 as closed by row 48; the code does not hold it.
- **Why this row did not add them.** SH-18 is a change of `SimActions` in `packages/shared`
  (`sim/types.ts`, `sim/actions.ts`, `api/sim-actions.ts`, `live/source/bindings.ts`, the "42
  actions / 31 hosted" pins in three workspaces). `packages/shared/src/api/*` is row 113's file set
  in this wave, and CS-04 (`engine/host.ts`, `types.ts`, `hosted-actions.ts`) is also listed under
  row 82 (`02_structured.md:245`). Doing it here would have meant writing another row's files.
- **What this row did instead.** Every supervisor event that is meant for an INTERNAL action
  carries that action's name (`action: 'applyCaptureTelemetry' | 'applySealingProgress' |
  'raiseCaptureWarning'`, `apps/core-server/src/capture/types.ts` `CaptureEvent`;
  `CAPTURE_INTERNAL_ACTION` in the protocol package). The unit that adds the actions subscribes
  with `app.capture.on(...)`. Nothing forwards to the engine today.
- **Needs a controller decision:** which row owns SH-18 + the telemetry half of CS-04 (suggestion:
  a row after 113 lands, before row 58's meters need them).

## 3. Files

Created:

| File | Purpose |
|---|---|
| `packages/capture-protocol/package.json`, `tsconfig.json` | workspace package `@dems/capture-protocol` (dependency: `zod` 4.6.5, already in the lockfile) |
| `packages/capture-protocol/src/index.ts` | protocol |
| `packages/capture-protocol/test/protocol.test.ts` | 18 tests |
| `apps/core-server/src/capture/types.ts` | `CaptureSupervisor`, events, `WorkerChannel`, refusal codes |
| `apps/core-server/src/capture/supervisor.ts` | the supervisor |
| `apps/core-server/src/capture/ipc.ts` | the only file of the server runtime that starts a process |
| `apps/core-server/src/capture/timers.ts` | the only file of the folder that names a global timer |
| `apps/core-server/src/capture/index.ts` | `captureModule`: seam, logging, close hook |
| `apps/core-server/src/capture/__tests__/supervisor.test.ts` | 33 tests (fake worker, manual clock) |
| `apps/core-server/src/capture/__tests__/ipc.test.ts` | 12 tests (real child processes) |
| `apps/core-server/src/capture/__tests__/module.test.ts` | 5 tests (real app factory) |
| `apps/core-server/src/capture/__tests__/static.test.ts` | 22 tests (M3-SR-1 + P25 pin) |
| `apps/core-server/src/capture/__tests__/boot.db.test.ts` | 3 database tests (section 6) |
| `apps/core-server/test/support/capture.ts` | `FakeWorkerProcess`, `fakeLauncher`, manual timers, `capturePlan` |
| `apps/core-server/test/support/capture-stub-worker.mjs` | the stub worker process |

Modified:

| File | Change |
|---|---|
| `apps/core-server/src/app.ts` | P25 edits 1-6 (section 4) |
| `apps/core-server/src/index.ts` | P25 edits 11-12 (section 4) |
| `apps/core-server/package.json` | `"@dems/capture-protocol": "*"` |
| `package-lock.json` | 17 added lines: the link of the new workspace package and its manifest (section 7) |
| `apps/core-server/src/modules/capture-config/store.ts` | bug fix, section 6 (row 52's file) |
| `apps/core-server/src/modules/capture-config/index.ts` | header comment only: "registered since row 57" |
| `apps/core-server/test/static/credentials.test.ts` | the "no child process" guard now exempts exactly `src/capture/ipc.ts` and asserts it is the only one (decision D57-5) |
| `apps/core-server/test/static/imports.test.ts` | `src/capture` added to `CLOSED_UNITS` |
| `apps/core-server/test/static/scaffold.test.ts` | the two new units added to the pinned list (21 -> 23 units, 14 -> 15 modules) |
| `apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts` | seam list nine -> ten (`capture`) |

No file was deleted or renamed. No existing test was skipped, weakened or given a longer timeout.

## 4. P25: the edits present in the three frozen files

Command: `git diff -U0 HEAD -- apps/core-server/src/app.ts apps/core-server/src/index.ts apps/core-server/src/config.ts | grep -E '^(@@|[+-])'`

```
--- a/apps/core-server/src/app.ts
+++ b/apps/core-server/src/app.ts
@@ -76,0 +77 @@
+import { captureModule, type CaptureSupervisor } from './capture';
@@ -82,0 +84 @@
+import { captureConfigModule } from './modules/capture-config';
@@ -93,0 +96 @@
+import { sttConfigModule } from './modules/stt-config';
@@ -131,0 +135 @@
+  capture: CaptureSupervisor;
@@ -145,0 +150 @@
+  capture: 'src/capture (capture module)',
@@ -246,0 +252 @@
+    readonly capture: CaptureSupervisor;
@@ -310,0 +317,3 @@
+  ['modules/stt-config', sttConfigModule],
+  ['capture', captureModule],
+  ['modules/capture-config', captureConfigModule],
@@ -355,0 +365 @@
+  app.decorate('capture', { getter: () => seams.get('capture') });
--- a/apps/core-server/src/index.ts
+++ b/apps/core-server/src/index.ts
@@ -82,0 +83 @@
+    if (app.seams.has('capture')) await app.capture.shutdown();
@@ -106,0 +108 @@
+  await app.capture.boot();
```

Only additions, no deletion. `config.ts` has no diff.

| Spec §I edit | Category | file:line now | Line |
|---|---|---|---|
| 1 | module registration | `apps/core-server/src/app.ts:77` | `import { captureModule, type CaptureSupervisor } from './capture';` |
| 1 | module registration | `apps/core-server/src/app.ts:84` | `import { captureConfigModule } from './modules/capture-config';` |
| 2 | `capture` seam | `apps/core-server/src/app.ts:135` | `capture: CaptureSupervisor;` in `interface Seams` |
| 3 | `capture` seam | `apps/core-server/src/app.ts:150` | `capture: 'src/capture (capture module)',` in `SEAM_PROVIDERS` |
| 4 | `capture` seam | `apps/core-server/src/app.ts:252` | `readonly capture: CaptureSupervisor;` in `declare module 'fastify'` |
| 5 | module registration | `apps/core-server/src/app.ts:318` | `['capture', captureModule],` |
| 5 | module registration | `apps/core-server/src/app.ts:319` | `['modules/capture-config', captureConfigModule],` |
| 6 | `capture` seam | `apps/core-server/src/app.ts:365` | `app.decorate('capture', { getter: () => seams.get('capture') });` |
| 11 | supervisor start | `apps/core-server/src/index.ts:108` | `await app.capture.boot();` after `readiness.boot()` (`:107`), before `app.listen` (`:109`) |
| 12 | supervisor stop | `apps/core-server/src/index.ts:83` | `if (app.seams.has('capture')) await app.capture.shutdown();` before `app.close()` (`:84`) |

**Two lines in that diff are NOT this row's:** `app.ts:96` and `app.ts:317` (`sttConfigModule`) were
written by row 113 while this row ran. They are module registrations, not in spec §I's list of 12;
whether OD-14's waiver covers them is the controller's review, not this row's.

Differences from the spec's wording, each small:
- edit 1's import also names the type `CaptureSupervisor` (edits 2 and 4 need it; one line instead of two);
- edit 12 is guarded by `app.seams.has('capture')`: a signal that arrives before `app.ready()` finished would otherwise throw "seam has no provider" inside `shutdown()`;
- the header comments of `app.ts` ("fourteen modules", the seam table) were NOT touched (spec §I: no header comment is edited) and are now out of date by two units and one seam.

The static test pins exactly these lines (`static.test.ts`, block "P25"): every line of `app.ts` and
`index.ts` that mentions "capture" must be one of the ten above, in this order, and `config.ts` must
mention it nowhere. Row 58 changes that last assertion when it adds edits 7-10.

## 5. Verification (each with its control)

All commands from the repository root. `ERROR: failed to copy trust settings ...` lines of the
sandbox are filtered out of the quoted output.

### 5.1 M3-KC-3, M3-KC-1, M3-SR-1 (2 runs + 1 verification run)

Command, three times:
`npx vitest run --root apps/core-server --project unit src/capture/__tests__/supervisor.test.ts src/capture/__tests__/ipc.test.ts src/capture/__tests__/module.test.ts src/capture/__tests__/static.test.ts </dev/null`

```
run 1:  Test Files  4 passed (4)
run 1:       Tests  72 passed (72)
run 1:    Duration  5.88s
run 2:  Test Files  4 passed (4)
run 2:       Tests  72 passed (72)
run 2:    Duration  5.86s
run 3:  Test Files  4 passed (4)
run 3:       Tests  72 passed (72)
run 3:    Duration  6.36s
```

| Check | Tests (`supervisor.test.ts` unless named) | The control that makes it able to fail |
|---|---|---|
| **M3-KC-3** heartbeat timeout restarts | "no heartbeat for the timeout: the worker is killed and a new one starts after the first back-off delay, not before" (kill at exactly 2 500 ms, new worker at exactly +250 ms, none at +249 ms) | "CONTROL: a worker that keeps its heartbeat is never restarted" (40 timeouts long, 0 kills) |
| M3-KC-3 exponential back-off | "restarts in a row wait base, 2x, 4x, ... up to the cap" -> `[250, 500, 1000, 2000, 4000, 8000, 8000, 8000]` | mutation below (constant delay -> red) |
| M3-KC-3 unstartable worker -> `CAPTURE_FAULT`, clean | "an unstartable worker: start is refused with CAPTURE_FAULT after the restarts, the warning is raised once, and the supervisor is clean" (6 launches, 1 warning, phase IDLE, 0 timers armed, next start works); three `it.each` cases (never HELLO / never ACK / START refused); "a failure that another try cannot change is not retried" | the same test ends with a start that succeeds once the launcher stops failing |
| M3-KC-3 on a real process | `ipc.test.ts` "a FROZEN worker (stopped, still a process) is found by its heartbeat, killed and replaced" (`SIGSTOP`) | in the same test: left alone for 1.5 s (2.5 x the 600 ms timeout) it is NOT touched |
| **M3-KC-1** new process per session | "after the ingest ended with TEARDOWN and the session stopped, the next session gets a NEW process with its own files" (2 processes, 1 START each, 4 distinct output paths) | "CONTROL: a process that already served a session refuses a second START" (`ACK ok=false SESSION_ALREADY_SERVED`) |
| M3-KC-1 TEARDOWN mid-recording | "the ingest exits with code 0 in the MIDDLE of a recording ... a new process" | first process still holds exactly 1 START |
| M3-KC-1 no stale RTSP listener | "a new process starts only after the previous one is known to have exited" (back-off passed, old process not yet reaped -> 1 worker; after its exit -> 2) | - |
| **M3-SR-1** | `static.test.ts`, 22 tests: G-R1, G-R2, G-R4, G-R5, G-R7, G-R8 + P25 pin | positive controls on planted sources; live mutation below |
| killed worker respawns | section 5.2 | section 5.2 |

M3-KC-1 is verified here at the level this row owns: process identity and commands. "Playable
file" is not measured (section 1).

Mutation proofs (the production file was changed, the tests run, the file restored and compared
byte for byte with `cmp`):

```
# supervisor.ts: armWatchdog made a no-op
     × no heartbeat for the timeout: the worker is killed and a new one starts after the first back-off delay, not before
     × a heartbeat whose counter does not grow is no sign of life
     × a new process starts only after the previous one is known to have exited: no stale listener on the RTSP port
     × a FROZEN worker (stopped, still a process) is found by its heartbeat, killed and replaced
      Tests  4 failed | 41 passed (45)
# supervisor.ts: delay = limits.backoffBaseMs (no back-off)
     × restarts in a row wait base, 2x, 4x, ... up to the cap: the delays are exactly those of backoffDelayMs
     × an unstartable worker: start is refused with CAPTURE_FAULT after the restarts, the warning is raised once, and the supervisor is clean
     × a recording whose worker cannot be kept running ends FAULTED with CAPTURE_FAULT; the session stays open until it is stopped
      Tests  3 failed | 30 passed (33)
RESTORED
      Tests  33 passed (33)
# M3-SR-1: a probe file src/capture/zz_row57_probe.ts (node:fs + Date.now + Math.random) planted, then removed
     × reads the production sources of the capture folder
     × the process module and the file system are imported by files of the allowlist only
     × no file reads the system time: every instant is the server clock's
     × no file draws a random number or imports a source of one: a correlation ID is counted, not drawn
      Tests  4 failed | 18 passed (22)
# probe removed
      Tests  22 passed (22)
```

### 5.2 A killed worker respawns under the supervisor (real process, real `SIGKILL`)

`apps/core-server/src/capture/__tests__/ipc.test.ts`, test "a KILLED worker is started again:
another process, the same session, recording again". The supervisor is the production one with the
production launcher (`createProcessLauncher`), system timers and the system clock; the worker is
the stub (`process.execPath test/support/capture-stub-worker.mjs`). The test reads the worker's
operating-system PID, sends it `SIGKILL` with `process.kill`, and asserts:

- a `workerDown` event `{ code: 'EXITED', signal: 'SIGKILL', exitCode: null, attempt: 1 }`, `restartInMs: 50`;
- phase `RECORDING` again with `attempt: 2`, a DIFFERENT PID, old PID gone (`process.kill(pid, 0)` throws), new PID alive;
- a second kill gives `attempt: 3`.

Control, test "CONTROL: with no restart allowed, a killed worker is NOT started again": same kill
with `maxRestarts: 0` -> phase `FAULTED`, `workerPid: null`, `attempt` stays 1 after a further 500 ms,
one `CAPTURE_FAULT` warning.

Result: part of the 72/72 of section 5.1 in all three runs (`ipc.test.ts` 12 tests).

### 5.3 What the worker process is given (SEC35-25)

- `ipc.ts:55-62`: one `spawn`, `shell: false`, `env: { ...options.env }` (empty by default, never `process.env`), fixed arguments; nothing of a session or plan becomes an argument.
- Test "not the server's environment: a variable of this process is invisible to the worker" + its control "a worker that IS handed the variable refuses to start" (`ENV_LEAK`).
- No orphan: "a worker ends by itself when its input ends" (+ control "with its input open it keeps running"); "a server process that exits kills its worker in the exit handler, even a worker that ignores the end of its input" (+ control: a server killed with `SIGKILL` runs no handler and that rule-breaking worker lives on; the test then kills it). **Limit stated by that control:** against a server that is `SIGKILL`ed, only the worker's own end-of-input rule protects; the real worker must keep it (protocol header, "RULES THE WORKER MUST KEEP").

Note for row 58: the default environment is empty. A C worker that needs a library path gets it
through `ProcessLauncherOptions.env`, explicitly.

### 5.4 Correlation IDs and back-pressure

- Correlation: session `cap:<sessionId>:<n>` (`supervisor.ts:496`), commands `<session correlation>:<seq>` (`supervisor.ts:214`); counted, not random. Test "every command carries the session and its own correlation ID; the events carry the session correlation" pins the sequence `START :1, SWITCH_AUDIO_SOURCE :2, START :3, STOP :4` across a restart. The log lines and error-log entries carry `sessionId` + `correlationId` (`module.test.ts`).
- Back-pressure worker -> listeners: telemetry is replaced by the newest undelivered frame (`supervisor.ts:173-181`; test: 51 frames + 2 progress events against a blocked listener -> delivered `T1, PHASH, T51, PSIGN`, `droppedTelemetry: 49`; control: a listener that keeps up receives all 50). Events that may not be dropped pause the worker's output at `eventQueueLimit` and resume at half (`supervisor.ts:182-185`, `:154-157`; test with limit 8: paused at 8, 21 messages stay in the pipe, resumed at 4, all 30 delivered in order).
- Back-pressure supervisor -> worker: at most `commandQueueLimit` commands await an ACK, one more is refused with `CAPTURE_BACKPRESSURE` (`supervisor.ts:209-211`; test with limit 3).

### 5.5 The seam on the real app factory (`module.test.ts`, 5 tests)

- `app.capture` exists after `ready()`, is `CLOSED` until booted; `app.seams.replace('capture', fake)` works on a test configuration (spec §B.1 test hook).
- Without a worker command a start fails at once: `CAPTURE_FAULT / CAPTURE_WORKER_NOT_CONFIGURED`, no retry; the log has `[40, CAPTURE_WORKER_DOWN]`, `[50, CAPTURE_FAULT]` and the persistent error log file has the same two entries with `sessionId` and `correlationId`; neither contains `rtsp`, `8554`, `.mp4` or `media/sessions`.
- `boot()` and `shutdown()` each write one info line (`CAPTURE_SUPERVISOR_BOOTED`, `CAPTURE_SUPERVISOR_STOPPED`); closing the app shuts the supervisor down.

### 5.6 Protocol package

`npm run test -w @dems/capture-protocol` -> `Test Files 1 passed (1)`, `Tests 18 passed (18)`.
`npm run typecheck -w @dems/capture-protocol` exit 0; `npm run lint -w @dems/capture-protocol` exit 0.

### 5.7 Whole suites, once at the end

| Run | Command | Result | Baseline given | Attribution |
|---|---|---|---|---|
| core-server unit | `npm run test -w @dems/core-server -- --maxWorkers=2 </dev/null` | `Test Files 5 failed \| 165 passed (170)`, `Tests 9 failed \| 4177 passed (4186)` | 3 failed | 3 = baseline (`modules/sessions/__tests__/routes.test.ts` x2, `modules/evidence/__tests__/routes.test.ts` x1). 6 = row 113 in flight: `src/modules/stt-config/__tests__/routes.test.ts` x4 (its own file; `Error: listen EPERM: operation not permitted 127.0.0.1` = the sandbox, that test binds a loopback port), `engine/__tests__/api-headers.test.ts` x1 and `plugins/permission-guard/__tests__/guard.test.ts` x1 (both list `getSttConfig` / `updateSttConfig` / `testSttConnection`, the operations row 113 added in `packages/shared/src/api/core-api.ts` + `transcription.ts`). **0 from this row.** |
| core-server db (not asked for, run because edit 5 mounts a boot step) | `npm run test:db -w @dems/core-server -- --maxWorkers=2 </dev/null` (sandbox off: loopback 4432) | `Test Files 2 failed \| 125 passed (127)`, `Tests 29 failed \| 1788 passed (1817)` | 12 failed, all in `test/acceptance/contract.test.ts` | `test/acceptance/contract.test.ts` no longer collects: `Error: a request schema holds a "union" at credential` = the `credential` member of operation 91, `packages/shared/src/api/transcription.ts` (row 113). `test/acceptance/rbac-matrix.test.ts` 29 failed: `spec §7 has no row for the registry operation getSttConfig` (row 113). **0 from this row** after the fix of section 6. |
| typecheck / lint core-server | `npm run typecheck -w @dems/core-server`, `npm run lint -w @dems/core-server` | exit 0, exit 0 | exit 0 | - |
| typecheck / lint shared | `npm run typecheck -w @dems/shared`, `npm run lint -w @dems/shared` | typecheck **exit 2**, lint exit 0 | exit 0 | `test/api-stt-config.test.ts(113,98): error TS2345` = row 113's new file. This row changed nothing under `packages/shared`. |
| shared tests | not run by this row | - | 1875 pass | this row changed nothing under `packages/shared` |

An earlier unit run (before row 113 had finished updating its pins, and before this row updated the
seam-list pin) showed 20 failed; 1 of those was this row's (`readiness.test.ts`, the list of seams,
now updated to ten).

## 6. A defect this row exposed and fixed: `capture.config` stopped every boot

- **Observed.** The first database run after edit 5 mounted `captureConfigModule`:
  `Test Files 58 failed | 68 passed (126)`, `Tests 89 failed | 1037 passed | 688 skipped`; 125 times
  `BootError: boot step capture.config failed` / `Caused by: CaptureSliceError: integer out of range`.
- **Cause.** `apps/core-server/src/modules/capture-config/store.ts` (row 52) read the selector row
  with `c.updated_at::int`. `updated_at` is epoch milliseconds (about 1.76e12); a 32-bit integer
  ends at 2 147 483 647. The module had never run against PostgreSQL: it was not registered, and
  its tests use fake readers.
- **Fix, at the failing site.** `store.ts:52`: `'updatedAt', c.updated_at)` (no cast; a
  `bigint` in `json_build_object` is a JSON number, exact below 2^53). `revision::int` stays.
- **Proof, the failing scenario kept as a test.** `apps/core-server/src/capture/__tests__/boot.db.test.ts`:
  (1) control: the old statement on the seeded row still fails with `integer out of range` and
  the stored value is above 2^31; (2) the whole boot passes on a seeded clone, `capture.config` is
  among the passed steps, the store holds the stored `revision`, device count and the full
  `updatedAt`; (3) the seam boots idle after it.
  `npm run test:db -w @dems/core-server -- --maxWorkers=2 src/capture src/core/__tests__/seeded.db.test.ts`
  -> `Test Files 2 passed (2)`, `Tests 5 passed (5)`; full db run in section 5.7.
- **Scope note.** `store.ts` is outside this row's file list. It was fixed here because this row's
  own waived edit is what makes the defect stop the server, and a server that cannot boot is worse
  than a one-token fix in a neighbour's file. Recorded as decision D57-7.
- **Running lanes.** `apps/core-server/logs/errors.log` has no entry after 08:42 local (this row
  started after 09:30), so the lane stack on 4421-4423 did not restart on this row's code. Its next
  restart runs the `capture.config` boot step for the first time on the lane databases.

## 7. Lockfile

`/usr/bin/lockf -k .locks/npm.lock npm install --offline --ignore-scripts --no-audit --no-fund` ->
`added 1 package in 2s`. `git diff -- package-lock.json`: 17 added lines, 0 removed: the dependency
entry in `apps/core-server`, `node_modules/@dems/capture-protocol` (`link: true`) and the
`packages/capture-protocol` manifest. No new third-party package: `zod` 4.6.5, `oxlint`,
`typescript`, `vitest` are versions the lockfile already held.

## 8. Commands for the navigator

```
# 1. the three named checks + the respawn (expect 4 files, 72 tests passed)
npx vitest run --root apps/core-server --project unit src/capture/__tests__/supervisor.test.ts src/capture/__tests__/ipc.test.ts src/capture/__tests__/module.test.ts src/capture/__tests__/static.test.ts </dev/null
# 2. the guards this row extended (expect all passed)
npx vitest run --root apps/core-server --project unit test/static src/plugins/readiness </dev/null
# 3. the protocol (expect 18 passed; typecheck and lint exit 0)
npm run test -w @dems/capture-protocol </dev/null ; npm run typecheck -w @dems/capture-protocol ; npm run lint -w @dems/capture-protocol
# 4. P25: only additions, ten lines of this row + two of row 113
git diff -U0 HEAD -- apps/core-server/src/app.ts apps/core-server/src/index.ts apps/core-server/src/config.ts | grep -E '^(@@|[+-])'
# 5. core-server gate
npm run typecheck -w @dems/core-server ; npm run lint -w @dems/core-server
npm run test -w @dems/core-server -- --maxWorkers=2 </dev/null
# 6. database (sandbox off: connects to 127.0.0.1:4432)
npm run test:db -w @dems/core-server -- --maxWorkers=2 src/capture src/core/__tests__/seeded.db.test.ts </dev/null
npm run test:db -w @dems/core-server -- --maxWorkers=2 </dev/null
# 7. lockfile and manifest
git diff -- package-lock.json apps/core-server/package.json | grep '^[+-]'
# 8. no leftover stub process
pgrep -fl capture-stub-worker
```

Step 8 could not be run inside the sandbox (`pgrep: Cannot get process list`); each real-process
test asserts by PID that its workers are gone.

## 9. Decisions and open points for the controller

| ID | Decision / point | Status |
|---|---|---|
| D57-1 | IPC transport = NDJSON over the worker's stdin/stdout; no socket, no port. Spec §B.2 names the messages, not the transport. | decided here, review |
| D57-2 | Protocol has two messages more than the spec's table: `HELLO` (handshake, protocol version) and `ACK` (answer by correlation ID). `HELLO`, `HEARTBEAT`, `ACK` carry no `sessionId` (a worker learns its session from `START`). | decided here, review |
| D57-3 | `CaptureSupervisor` has `boot()` and `shutdown()` beside the five members of spec §A.3: edits 11/12 need something to call. | decided here, review |
| D57-4 | Timing and queue defaults (`CAPTURE_IPC_DEFAULTS`: heartbeat 500 ms / timeout 2 500 ms, back-off 250 ms x2 up to 8 s, 5 restarts, stable after 30 s, queues 256 / 16, frame 65 536 chars) are this row's choices. No spike measured them: HYPOTHESIS until row 58 runs the real worker. | open |
| D57-5 | `test/static/credentials.test.ts` "the server runtime starts no child process" now exempts exactly `src/capture/ipc.ts`. Required by spec §G G-R2 / SEC35-25 (pinned allowlist); it is a change of an existing security guard. | **needs review** |
| D57-6 | Spec §G G-R1 as written ("host units must not import `node:fs`") is false for two files that predate capture: `src/plugins/config/connection-file.ts`, `src/plugins/logger/error-log.ts`. The guard pins exactly those two. Erratum candidate for `05_capture_architecture_spec.md` §G. | open |
| D57-7 | Fixed `updated_at::int` in row 52's `modules/capture-config/store.ts` (section 6). | done, review |
| D57-8 | SH-18 and CS-04 are not closed (section 2). | **needs a routing decision** |
| D57-9 | Telemetry is coalesced under back-pressure (newest frame wins); progress and warnings are never dropped. Checkpoint records (row 59) must use a message that is never dropped. | decided here |
| D57-10 | `app.ts` header comments are stale by two units and one seam; spec §I forbids editing them. | open |
| D57-11 | Row 113 added two lines to the P25-frozen `app.ts` (`sttConfigModule`). Not in spec §I's list. | controller review |
| D57-12 | `static.test.ts` asserts `config.ts` mentions capture nowhere; row 58 replaces that assertion with its edits 7-10. | note for row 58 |
| D57-13 | G-R2's allowlist in the spec is `supervisor.ts` + `ipc.ts`; today only `ipc.ts` imports the process module and nothing imports `node:fs`. The guard holds both facts. | note |

---
*Generated: 2026-10-09 10:05*
*Last Updated: 2026-10-09 10:05*

---

# Fix round 1 (navigator findings)

Source: `delegation_progress/pair_57_navigator.md` (ACCEPT-WITH-FINDINGS: 1 major, 10 minor). Date
2026-10-09. Nothing committed. Files touched in this round: `apps/core-server/src/capture/**`,
`apps/core-server/test/support/capture.ts`, `capture-stub-worker.mjs`, `packages/capture-protocol/src/index.ts`,
and (item 6(d), by the controller's instruction) the header comment of `apps/core-server/src/app.ts`.

**Sections 1-9 above describe the state before this round.** Where they speak of pausing the
worker's output (sections 5.4, D57-9) this section replaces them.

## R1. Outcome per finding

| Finding | Outcome | What changed | Test (red before the fix) |
|---|---|---|---|
| F-1 (major) | **fixed** | The pipe is never paused. `pause()`/`resume()` are removed from `WorkerChannel`, `ipc.ts` and the fake. `HEARTBEAT` and `ACK` were already handled inline; with no pause nothing can stand in front of them. | `liveness.test.ts` F-1 x2 (+1 control); `ipc.test.ts` "2 000 events against a stuck listener" (real process) |
| F-2 | **fixed** | Two delivery paths. The supervisor's own events (`workerDown`, `phase`, its `CAPTURE_FAULT` warning) go to their listeners at once and wait for no listener (`supervisor.ts` `emit`); the worker's events (`telemetry`, `progress`, worker warnings) go through the queue (`emitFromWorker`). | `liveness.test.ts` F-2 x2; `ipc.test.ts` "a killed worker is reported at once ... although the progress listener is stuck" |
| F-3 | **fixed** | `STOP` is written outside the ACK window (`sendCommand(..., outsideWindow = true)`). | `liveness.test.ts` F-3 (with its control: a fourth command IS refused) |
| F-4 | **fixed** | `eventQueueLimit` is a hard bound (R2). `CaptureStatus.inputPaused` is gone; `droppedEvents` is new. | `liveness.test.ts` F-4 (+ control); real process: `queuedEvents <= 8` after 2 000 frames |
| F-7 | **returned as a decision** (R3) | Only what follows from OD-08 was written down: the protocol header now says a worker never truncates or overwrites an existing output file. No append/segment mechanism was invented. | `liveness.test.ts` F-7 pins what the supervisor sends today (same paths, `attempt` 2). This test was green before and after: it is a pin of present behaviour, not a fix. |
| F-8 | **fixed** | New `src/capture/__tests__/protocol-pins.test.ts`: `CaptureMicRole` equals `MicRole` (`@dems/shared/domain`); each `CaptureWarningCode` is a `FaultKind` of the same name and they are the last two of that list. Nothing under `packages/shared` was touched. | mutation: a third role added to the protocol -> red, restored |
| F-10 | **proved, then fixed** | The hypothesis was right: with a `report` that throws, `pump` rejected with nobody awaiting it. `report` is now wrapped (it never throws back) and `pump().catch(...)` is the second line. | `liveness.test.ts` F-10; mutation putting the old form back -> red, restored |
| F-11 | **fixed** | Header of `supervisor.ts`, block "COMMANDS": a command is written at once; the bound is the window of unacknowledged commands. | - (comment) |
| 6(d) | **fixed** | `app.ts` header records the waived edit set (4 comment lines + 1 line in the seam table); the P25 pin in `static.test.ts` lists those lines too. | `static.test.ts` P25 block green; `git diff` in R5 |
| F-5, F-6, F-9 | not in this round (controller) | - | - |

No finding is disputed.

## R2. The design chosen for F-1/F-2/F-4, and why

Options the navigator named: (a) keep the pause but suspend the watchdog and ACK timers while
paused; (b) keep reading and handle `HEARTBEAT`/`ACK` at once. Chosen: **(b), with no pause at
all.**

- Why not (a): a paused pipe cannot be told from a dead or frozen worker. Suspending the watchdog
  while paused removes the only detector for exactly the time a listener is slow, and needs a
  second timeout to bound the pause, which is the same problem again.
- Why no pause even as a last resort: the worker is a real-time recorder. Holding its output back
  can only make it block in a write; it cannot make cameras slower. Losing a level reading is
  cheaper than stalling the process that writes evidence.
- The cost: without a pause a bounded queue must lose something when a listener is behind. What is
  lost is chosen by what the events are (`supervisor.ts`, header "THE QUEUE HAS A HARD BOUND"):
  1. telemetry waiting is replaced by the newer frame (as before);
  2. progress waiting is replaced by a newer value **of the same step**;
  3. a warning that still waits is not queued twice (same code and subject);
  4. at the bound: evict the oldest telemetry, else the oldest progress; a warning is never evicted
     for a level; new telemetry at the bound is dropped itself; only a queue full of distinct
     warnings drops a new event.
  Losses are counted (`droppedTelemetry`, `droppedEvents`) and the first loss at the bound of an
  episode is reported as `CAPTURE_EVENT_OVERFLOW` (log + persistent error log through the module's
  `report`).
- **This changes D57-9.** "Progress and warnings are never dropped" is no longer true for
  progress: an intermediate progress value can be superseded or, at the bound, evicted. Warnings
  are lost only if 256 different ones wait. Consequence for row 59: a record that must never be
  lost (a fragment checkpoint) must not travel through this queue; it needs its own acknowledged
  message or the database. That is a note for the controller, not something this row built.
- Ordering: the worker's events keep their order among themselves. The supervisor's own events are
  no longer ordered against them (a `workerDown` can be seen before telemetry that was written
  earlier and still waits).

## R3. F-7: what the specification says, and the decision that is needed

- Read: capture spec §B.2 ("restart with exponential back-off ... an interrupted recording seals
  the durable prefix"), §C.5 (drop-fragment rule and tail validation at RECOVERY), evidence spec
  §E.4 (trigger of the interrupted seal: the worker "cannot restart within the back-off budget")
  and OD-21 (one whole file per camera; segments + one lossless concatenation "stays designed" as
  the legal fallback).
- **Silent on:** what a worker that DOES restart within the budget does with the camera file that
  already holds fragments. Nothing says append, nothing says new segment.
- State now: the restarted worker gets the same `outputPath` and `attempt >= 2` (pinned by the F-7
  test). The protocol header binds the worker to never destroy existing bytes. Nothing else is
  defined.
- **Decision for the controller** (rows 58/59 implement it):
  - A. attempt-suffixed segment per restart, joined at sealing (this is OD-21's fallback path,
    which the spec reserves for a legal "no" to fMP4-as-one-file);
  - B. resume in the same file after the §C.5 tail rule (needs a defined way to continue an fMP4
    and its hash chain after a dropped tail);
  - C. no restart once fragments exist: the first crash in RECORDING goes to `FAULTED` and the
    OD-08 interrupted seal (simplest; makes the in-session back-off useful only before the first
    fragment).

## R4. Red before, green after

Red run, tests written first against the unchanged code
(`npx vitest run --root apps/core-server --project unit src/capture/__tests__/liveness.test.ts src/capture/__tests__/ipc.test.ts`):

```
     × 2 000 events against a stuck listener: the worker lives on, the queue stays at its limit, commands and STOP still work 4634ms
     × a killed worker is reported at once to the supervisor's own listeners although the progress listener is stuck 135ms
     × a healthy worker whose listener is stuck with a full queue is NOT killed: its heartbeats are still read 5ms
     × an acknowledgement is read at once behind a full queue: the switch resolves and the plan follows it 5000ms
     × worker-down, the phases and CAPTURE_FAULT reach their listeners while a telemetry listener never returns 1ms
     × a listener of the supervisor's own events that never returns holds nobody up either 0ms
     × with the command window full of unacknowledged commands, STOP is still written and the worker ends by itself 5002ms
     × the queue never holds more than the limit, whatever the worker writes; what is superseded or evicted is counted and reported once 1ms
     × CONTROL: below the limit nothing is evicted and nothing is reported 0ms
     × does not become an unhandled rejection, and the other listeners still get the event 0ms
      Tests  10 failed | 14 passed (24)
```

(The "CONTROL: below the limit" line was red only because `droppedEvents` did not exist yet. The
F-1 control "without heartbeats IS killed" and the F-7 pin were green in the red run, as they should be.)

After the fix, `npx vitest run --root apps/core-server --project unit src/capture </dev/null`, twice:

```
run 1:  Test Files  6 passed (6)
run 1:       Tests  86 passed (86)
run 2:  Test Files  6 passed (6)
run 2:       Tests  86 passed (86)
```

86 = supervisor 33 + ipc 14 + module 5 + static 22 + liveness 10 + protocol-pins 2. That covers
M3-KC-3, M3-KC-1 (process half) and M3-SR-1 twice.

**One of the 72 original tests was replaced, not kept:** `supervisor.test.ts` "when the events that
may not be dropped pile up to the limit, the worker's output is paused, and resumed at half the
limit" asserted the behaviour F-1 removes. In its place: "up to the limit, events of different
steps wait in their order and none is lost; the worker is never held back". One assertion of the
neighbouring control changed from `inputPaused: false` to `droppedEvents: 0, queuedEvents: 0`. The
other 70 are unchanged and green.

Mutations after the fix (file changed, tests run, file restored, `cmp` identical -> `RESTORED`):

```
# protocol: CaptureMicRole given a third value
     × the mic roles are exactly the shared MicRole, name by name
# supervisor.ts: report rethrows and `void pump()` put back
     × does not become an unhandled rejection, and the other listeners still get the event
      Tests  2 failed | 10 passed (12)
RESTORED
```

## R5. Suites after the round

| Command | Result | Attribution |
|---|---|---|
| `npm run typecheck -w @dems/core-server` / `lint` | exit 0 / exit 0 (0 warnings) | - |
| `npm run typecheck -w @dems/capture-protocol` / `lint` | exit 0 / exit 0 | - |
| `npm run test -w @dems/capture-protocol </dev/null` | 18 passed | - |
| `npx vitest run --root apps/core-server --project unit src/capture/__tests__/static.test.ts test/static src/plugins/readiness` | `Test Files 16 passed`, `Tests 192 passed` | - |
| `npm run test -w @dems/core-server -- --maxWorkers=2 </dev/null` | `Test Files 3 failed \| 169 passed (172)`, `Tests 7 failed \| 4193 passed (4200)` | 3 baseline (`modules/sessions/__tests__/routes.test.ts` x2, `modules/evidence/__tests__/routes.test.ts` x1); 4 row 113 (`src/modules/stt-config/__tests__/routes.test.ts`, `listen EPERM: operation not permitted 127.0.0.1`, the sandbox); **0 row 57** |
| `npm run test:db -w @dems/core-server -- --maxWorkers=2 src/capture </dev/null` (sandbox off) | 3 passed, 0 databases left | - |

`app.ts` after 6(d): `git diff -U0 HEAD` shows additions only: 5 comment lines (17-20, 49), the 8
code lines of section 4 (now at 82, 89, 140, 155, 257, 323, 324, 370) and row 113's two (101, 322).
The file:line table of section 4 is shifted by +5 from line 17 on.

## R6. Commands for the navigator

```
npx vitest run --root apps/core-server --project unit src/capture </dev/null          # 6 files, 86 tests
npx vitest run --root apps/core-server --project unit test/static src/plugins/readiness </dev/null
npm run test -w @dems/capture-protocol </dev/null                                      # 18
npm run typecheck -w @dems/core-server ; npm run lint -w @dems/core-server
npm run typecheck -w @dems/capture-protocol ; npm run lint -w @dems/capture-protocol
npm run test -w @dems/core-server -- --maxWorkers=2 </dev/null
npm run test:db -w @dems/core-server -- --maxWorkers=2 src/capture </dev/null          # sandbox off
git diff -U0 HEAD -- apps/core-server/src/app.ts apps/core-server/src/index.ts apps/core-server/src/config.ts | grep -E '^(@@|[+-])'
```

To see F-1 red again: in `apps/core-server/test/support/capture.ts` and `supervisor.ts` there is no
pause left to restore, so the quickest check is the navigator's own scenario A/B2 against this tree.

*Last Updated: 2026-10-09 (fix round 1)*
