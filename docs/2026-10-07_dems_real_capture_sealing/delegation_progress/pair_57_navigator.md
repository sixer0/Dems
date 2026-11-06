---
agent: senior-code-reviewer (navigator of the pair on blueprint row 57 / M3-W1)
row: 57
date: 2026-10-09
base: HEAD 9d3a1ef, working tree uncommitted (rows 57, 111, 113 together)
status: complete
verdict: ACCEPT-WITH-FINDINGS
reviewed: implementation/19_m3_supervisor_ipc.md, delegation_progress/coder_execution_row57.md
---

# Row 57 navigator review

## 1. Verdict

**ACCEPT-WITH-FINDINGS.** 0 blockers, 1 major, 10 minor.

The three named checks pass in my own runs and can fail (5 mutations of mine, all red, all restored
byte-exactly). The P25 edits are additions only and match spec §I edits 1-6, 11, 12. The security
guard change is narrower than the spec allows. The `updated_at` fix is right and its regression test
fails with the cast put back.

Not accepted as written: the row's "closes" list (SH-18 and CS-04 are open) and "M3-KC-1 pass"
(half of that check cannot be measured at this row). One design defect (F-1) must be fixed before
any real listener subscribes to the supervisor, which is row 58.

## 2. Findings

| # | Severity | File:line | Evidence | Suggested fix |
|---|---|---|---|---|
| F-1 | **major** | `apps/core-server/src/capture/supervisor.ts:182-185` (pause), `:326-329` (watchdog), `:389-395` (heartbeat), `:385-388` (ACK) | Heartbeats and ACKs travel on the same stream that back-pressure pauses. A healthy worker whose listener is slow for longer than `heartbeatTimeoutMs` (2 500 ms) is killed. Scratch test, fake worker, limit 4, worker beating every 500 ms: `NAV-A {"kills":["SIGKILL"],"phase":"RESTARTING","lastCrash":"HEARTBEAT_TIMEOUT","backlog":7}`. Same on a real process (600 ms timeout, listener blocked): `NAV-B2 after 3 s {"osAlive":false,"phase":"RESTARTING","workerPid":null,"attempt":4,"lastCrash":"HEARTBEAT_TIMEOUT","downsDelivered":[]}`. Same cause: an ACK behind the pause times out, so `switchAudioSource` rejects with `CAPTURE_COMMAND_TIMEOUT` although the worker may have switched, and `plan.activeMic` (`:583`) is not updated. Not live today: nothing subscribes to `telemetry`/`progress` in production. | Do not let the pause hide liveness. Either (a) cancel the watchdog and the ACK timers while `inputPaused`, re-arm on resume, and bound the pause with its own timeout; or (b) keep reading and handle `HEARTBEAT`/`ACK` at once, pausing only when the non-droppable queue is full for longer than a bound. Add the scratch scenario as a permanent test. Owner: row 58 at the latest, before the forwarder of section 6(a) exists. |
| F-2 | minor | `supervisor.ts:142-171` (one queue for every event name); `src/capture/index.ts:83-103` | A listener that does not return blocks every later event of every name. In NAV-B2 the supervisor reached attempt 4 while the `workerDown` listener had received nothing (`downsDelivered: []`): the worker-down and `CAPTURE_FAULT` lines of the error log are not written in exactly the case they are for. | Deliver `workerDown`, `phase` and supervisor warnings outside the worker-event queue (they are the supervisor's own, few, and need no back-pressure), or give the logging listeners a synchronous path. |
| F-3 | minor | `supervisor.ts:209-211`, `:542` | `STOP` goes through the same command window as every command. With the window full it is refused silently (`done` is `nothing`), the worker gets no `STOP`, and is `SIGKILL`ed after the grace without flush or close. Scratch test, limit 2, two un-acknowledged switches: `NAV-C {"stopCommandsWritten":0,"kills":["SIGKILL"],...}`. | `STOP` bypasses `commandQueueLimit`. |
| F-4 | minor | `apps/core-server/src/capture/ipc.ts:88-99`; `supervisor.ts:252` | `eventQueueLimit` is a soft bound: after `pause()` the rest of the chunk already read is still delivered, and `retire` clears `inputPaused` so each new worker adds a chunk. Real process, limit 8, blocked listener, two workers: `"queued":1621,"inputPaused":true`. Bounded (about one pipe chunk per worker attempt, attempts bounded by `maxRestarts`), so not an unbounded queue; the documented number is not the real one. | State the real bound in the header, or stop handing lines to the supervisor once paused (keep the undelivered lines in the splitter side, bounded by `maxFrameChars` x N). |
| F-5 | minor | `masterplan/10_test_strategy.md:159`; `supervisor.test.ts:327-388` | M3-KC-1 is defined as "restarts the ingest process **and the next session produces a fresh playable file**". The tests prove process identity, one START per process, distinct output paths, and no start before the old process exited. No media exists at this row, so "playable file" is not measured. The driver says so (note section 1). | Record M3-KC-1 as **partial at row 57** (process half), completed by row 58, which lists M3-KC-1 again. Do not record "M3-KC-1 pass" for row 57 without that qualifier. |
| F-6 | minor (tracking) | `identification/02_structured.md:220`; `implementation/15_m2_api_contract.md:10`; `packages/shared/src/api/sim-actions.ts:2`, `:93` | Row 57 lists "closes ... CS-04, SH-18"; neither is closed. `sim-actions.ts` still says "The 42 actions", its only INTERNAL entry is `setTabletLink`, and it has no `switchAudioSource` / `setCaptureConfig` entry. Row 48's note claims SH-18 closed; the code does not hold it. Nothing forwards a supervisor event to the engine. | Section 6(a). Correct row 57's closes to NM-03, CS-01, CS-03 and row 48's claim, in the drift log. |
| F-7 | minor | `supervisor.ts:355` | A restart inside a session re-sends the same plan, so the same `outputPath`, with a higher `attempt`. Whether the new process appends, truncates or writes a new file is undefined; a truncating worker would destroy the durable prefix OD-08 wants sealed. | Row 58/59 defines it (for example an attempt-suffixed file, never truncate) and tests it. |
| F-8 | minor | `packages/capture-protocol/src/index.ts:69`, `:73`; `packages/shared/src/domain/enums.ts:169` | `CaptureMicRole` restates `MicRole` of `@dems/shared`, and `CaptureWarningCode` restates two fault names of `packages/shared/src/sim/faults.ts:45-46`. The package deliberately does not depend on `@dems/shared` (sound: the C worker reads it). No test pins the two sets equal (`grep MicRole` in `src/capture`, `test/support/capture.ts`, protocol tests: only `CaptureMicRole`). | One test in core-server (it depends on both packages) asserting the value sets are equal. |
| F-9 | minor | `apps/core-server/src/index.ts:83`, `:108` | Edits 11/12 are held by a static pin, the type checker and the same calls on the app factory; no test starts the entry point (pre-existing gap for the whole file). Section 4. | Acceptable for row 57. Add one line to the M3 device gate: after the lane restart, the log shows `capture supervisor booted` after the last boot step and `capture supervisor stopped` on SIGTERM. |
| F-10 | minor (HYPOTHESIS, not run) | `supervisor.ts:163-165`, `:186`; `index.ts` `unhandledRejection` handler | `void pump()`; inside `pump`, `report(...)` is called in a `catch`. If `report` itself throws (its production form writes the error log file), `pump` rejects with nobody awaiting it, and the entry point turns an unhandled rejection into `fatal`. | Wrap the `report` call, or `pump().catch(...)`. |
| F-11 | minor (doc) | `supervisor.ts:38-40` | The header says a command is written "when the worker's input took the previous one". `sendCommand` writes at once; the only bound is the ACK window (16 commands of at most 65 536 characters). Bounded, but not what the comment says. | Correct the comment. |

Checked and found sound (no finding): spawn (`ipc.ts:55-62`, one spawn, `shell: false`, fixed argv,
`detached: false`); correlation IDs counted, not random (`supervisor.ts:214`, `:496`); back-off
(`:314-321`); G-1 new process per session and per restart, and no launch before the previous exit
(`:235-244`, `:411-414`); shutdown order (`index.ts:83-84`, default stop grace 5 000 ms inside the
10 000 ms `SHUTDOWN_TIMEOUT_MS` of `index.ts:25`); exit handler added per worker and removed at its
end (`ipc.ts:77`, `:82`); stream error listeners present (`ipc.ts:102-104`); every timer is cancelled
in `retire`/`finishStop`/`stop` and is `unref`ed (`timers.ts:26`); two racing starts.

## 3. My own failure scenarios (item 1)

Scratch file `apps/core-server/src/capture/__tests__/nav_scratch.test.ts` (8 tests) plus a scratch
worker outside the repository. Result: `Tests 2 failed | 6 passed (8)`; the two failures are F-1 and
F-3, written as the expectation of a correct design.

| Scenario | Result |
|---|---|
| A (fake) healthy worker, output paused by a slow listener | **killed**, `HEARTBEAT_TIMEOUT` (F-1) |
| B (real) worker `SIGKILL`ed from outside while its output is paused | exit seen, replaced (`attempt: 2`), `stop()` resolves. My hypothesis of a hang on a paused stream was **wrong**. Shows F-4 (`queued: 1621`). |
| B2 (real) blocked listener, 600 ms heartbeat timeout | restart loop, `attempt: 4` after 3 s (F-1); no `workerDown` delivered (F-2); `stop()` resolves |
| C (fake) `STOP` with the command window full | `STOP` not written, `SIGKILL` (F-3) |
| D (fake) three starts in one tick | `["OK","CAPTURE_SESSION_OPEN","CAPTURE_SESSION_OPEN"]`, 1 worker |
| E1 (real) partial line then exit code 3 | `["EXITED/null","EXITED/null"]`, FAULTED, nothing unhandled |
| E2 (real) 200 000 characters with no line end | `["PROTOCOL_VIOLATION/FRAME_TOO_LONG"]`, process gone |
| E3 (real) worker closes its own stdin, then 3 commands and a stop | `{"outcomes":["CAPTURE_COMMAND_TIMEOUT" x3],"stopped":"STOPPED","stopMs":1005,"osAlive":false,"unhandled":0}` |

Not tested: "worker exits during back-off" has no live worker in that window by construction
(`retire` sets `worker = null`); the driver's "stop during the back-off" covers the timer.

Scratch file deleted. `git status --short | grep -c nav_scratch` -> `0`. `pgrep -fl
"capture-stub-worker|nav57/worker|envdump"` (sandbox off, the sandbox cannot list processes) ->
exit 1, no process.

## 4. The three named checks (item 2)

Driver command 1, three runs: `Test Files 4 passed (4)`, `Tests 72 passed (72)` each (5.50 s, 5.59 s,
5.45 s).

| Check | Strategy definition (`10_test_strategy.md`) | Asserted? |
|---|---|---|
| M3-KC-3 (`:162`) | heartbeat timeout restarts with exponential back-off; unstartable worker emits `CAPTURE_FAULT` and fails the start cleanly; `FakeWorkerProcess`; 2+1 | **Yes, in full.** Kill at exactly 2 500 ms and not at 2 499; new worker at +250 and not at +249; delays `[250,500,1000,2000,4000,8000,8000,8000]`; 6 launches, 1 warning, IDLE, 0 timers armed, next start works. Also on a real `SIGSTOP`ped process. |
| M3-KC-1 (`:159`) | restart of the ingest process per session **and** a fresh playable file | **Process half only** (F-5). |
| M3-SR-1 (`:163`, `:406`) | G-R1, G-R2, G-R4, G-R5, G-R7, G-R8 over `src/capture/**` | **Yes.** Each rule has a test and a positive control on planted text. G-R2 is held narrower than the spec (only `ipc.ts` imports the process module today, nothing imports `node:fs`). |

My mutations (production file changed, tests run, file restored):

| Mutation | Red tests |
|---|---|
| `supervisor.ts` `whenReaped`: launch without waiting for the killed worker's exit | `1 failed | 66 passed`: M3-KC-1 "a new process starts only after the previous one is known to have exited" |
| `ipc.ts:57` `env: { ...process.env, ...options.env }` | `2 failed | 65 passed`: `ipc.test.ts` "not the server's environment", `static.test.ts` G-R2 "the one spawn hands the worker no shell and never the server's environment" |
| `supervisor.ts:390` heartbeat counter check removed | `1 failed | 66 passed`: M3-KC-3 "a heartbeat whose counter does not grow is no sign of life" |
| `store.ts:52` cast `::int` put back (section 7) | `2 failed | 1 passed (3)` in `boot.db.test.ts` |

Restore proof: `cmp` of `supervisor.ts` and `ipc.ts` against the saved copies -> identical; SHA-256
before and after `c1b8f081...b05752` and `0ae1b491...1bab6f7f`; `git diff HEAD -- store.ts` saved
before and after the mutation, `cmp` -> `DIFF IDENTICAL BEFORE/AFTER`; then 67/67 and 3/3 green.

## 5. P25 (item 3)

`git diff HEAD --numstat`: `app.ts` 10 added / 0 removed, `index.ts` 2 / 0, `config.ts` no diff.
The 8 `app.ts` lines and 2 `index.ts` lines of row 57 are spec §I edits 1-6, 11, 12, in the places
the spec names. Two differences from the spec's wording, both fine: the import of edit 1 also names
the type `CaptureSupervisor`; edit 12 is guarded by `app.seams.has('capture')`.

- **Not row 57's:** `app.ts:96` and `app.ts:317` (`sttConfigModule`) are row 113's. They are not in
  §I's list of 12. Spec §I (`05_capture_architecture_spec.md:624-625`): any other change to the three
  files is a `needs-review` against OD-14. **Controller decision needed for row 113**, not for row 57.
- **Boot test:** the row's Verification asks for the three checks, "only the waived P25 edits
  present, each reviewed" and the respawn. It asks for no boot test, and none exists for any line of
  `index.ts`. The static pin plus the typecheck plus `module.test.ts` on the real factory is
  acceptable for this row. Residual risk and its cheap cover: F-9.

## 6. The changed security guard (item 4)

- `test/static/credentials.test.ts`: the exemption is one exact path, `src/capture/ipc.ts`, and a
  second assertion requires the set of importers to equal exactly that path. Spec §G G-R2 allows
  `supervisor.ts` and `ipc.ts`; the guard is **narrower**. Accept.
- Command: one `spawn`, `shell: false`, argv fixed when the launcher is created, nothing of a
  session or plan in argv (`ipc.ts:55-62`). In production today the launcher is `unconfiguredLauncher`
  (`src/capture/index.ts:75`): the server starts no process at all.
- Environment the child really receives. Probe through the real `createProcessLauncher`, parent
  holding `PGPASSWORD` and `DEMS_DB_PASSWORD` (fake values): the child's whole environment was
  `{"__CF_USER_TEXT_ENCODING":"0x1F5:0x0:0x0"}` (added by macOS itself). No variable of the parent.
- Not verified: file descriptors inherited by the child (Node opens its own with close-on-exec;
  I did not prove it for the database sockets). HYPOTHESIS: none leak.
- For row 58: the review point moves to where `command` comes from (config key of edits 7-10). The
  worker's stderr is `'ignore'`: its JSON log lines are lost unless it logs to a file.

## 7. The `updated_at` fix (item 5)

- Column: `updated_at` is epoch milliseconds in a `bigint` (same convention as
  `apps/core-server/src/db/schema/stt.ts:73`); `::int` cannot hold 1.76e12. The fix (no cast) is
  right: `json_build_object` writes a `bigint` as a JSON number, the driver parses it to a JS number,
  exact below 2^53, and `store.ts:93-96` (`count`) accepts an integer.
- Other casts: `grep -rn "::int|::integer|::smallint"` over `modules/capture-config`,
  `modules/stt-config`, `src/capture` (non-test) finds one, `c.revision::int` (`store.ts:52`), a
  count of edits; harmless. `stt-config/statements.ts` has no cast.
- Regression test, `npm run test:db -w @dems/core-server -- --maxWorkers=2 src/capture` (sandbox off;
  inside the sandbox it fails with `EPERM` on 127.0.0.1:4432): as delivered `Tests 3 passed (3)`;
  with the cast restored `Tests 2 failed | 1 passed (3)`, `BootError: boot step capture.config
  failed` / `Caused by: CaptureSliceError: integer out of range`; restored `3 passed`. **Faithful.**
- Scope: an edit in row 52's file, justified (row 57's own edit 5 is what makes the defect stop the
  boot). Accept; record as a decision.

## 8. Open items of the driver: recommendations (item 6)

**(a) SH-18 and CS-04.** Not closed; the driver is right. What remains:
1. `packages/shared`: the four INTERNAL actions (`applyCaptureTelemetry`, `applySealingProgress`,
   `completeSeal`, `raiseCaptureWarning`) and the two hosted ones (`switchAudioSource`,
   `setCaptureConfig`) in `SimActions`, in `api/sim-actions.ts` (INTERNAL with `operations: []`),
   in `live/source/bindings.ts`, and the "42 actions / 31 hosted" pins in three workspaces.
2. `apps/core-server/src/engine` (`host.ts`, `types.ts`, `hosted-actions.ts`): INTERNAL entry points
   like `setTabletLink`.
3. A forwarder that subscribes `app.capture.on('telemetry' | 'progress' | 'warning')` and calls the
   engine. It must not block the queue (F-1, F-2).
4. A trigger for `completeSeal`: no message of §B.2 carries it.

Recommended owners, by first consumer: **row 58** takes `applyCaptureTelemetry`,
`raiseCaptureWarning` and the forwarder (its title is "Worker + engine seam", its meters need them,
it depends on 57). **Row 82** takes `applySealingProgress` and `completeSeal` (it already lists
"CS-04 engine host INTERNAL actions"). SH-18 closes when row 82 is done; CS-04 likewise. The two
hosted entries go with the row that makes their operations live (the capture-config module names
row 66 / M4-W2 for operations 76-80, 89); the controller should confirm that row. Row 58 must start
after row 113 lands: both touch `packages/shared/src/api`. Drift log: row 57 closes NM-03, CS-01,
CS-03 only; row 48 did not close SH-18.

**(b) Protocol additions.** Sound, not over-built. `HELLO` is the only place a version can be
refused before a `START` with a plan is sent; `ACK` is what the spec's "correlation id" on
`SWITCH_AUDIO_SOURCE` implies; `boot()`/`shutdown()` are what edits 11/12 call. Keep all three;
amend the §B.2 table by erratum.

The C skeleton (`apps/capture-worker/src/capture_worker.c`, read only) speaks **nothing compatible**.
Gap row 58 must close:
1. Control is plain text `switch <n>` / `stop` in a 64-byte buffer (`:400-410`), only with
   `--control-stdin`. Needed: NDJSON commands up to 65 536 characters, so a JSON reader in C.
2. It writes no frame on stdout: no `HELLO`, `HEARTBEAT` (growing counter), `ACK` with the
   correlation ID, `TELEMETRY`, `PROGRESS`, `WARNING`, `CRASH`. Nothing else may ever be written to
   stdout (a non-frame line ends the worker).
3. The session arrives in argv (`--cam1`, `--out1`, `--duration`, `:477-491`). `ipc.ts` passes fixed
   argv only: the plan must come from `START`, the end from `STOP`, not from `--duration`.
4. End of stdin does not stop it (`:403-409` leaves the loop without setting `g_stop`): the
   no-orphan rule is not kept. `SIGPIPE` is ignored (`:512`), so a failed write to stdout must be
   handled as "supervisor gone".
5. One session per process and `SESSION_ALREADY_SERVED` on a second `START`.
6. Logs go to stderr, which `ipc.ts` closes: use `--log` or `inheritDiagnostics`.
7. Empty environment: any library path must be passed through `ProcessLauncherOptions.env`.
8. Port range: the worker checks `PORT_MIN..PORT_MAX`, the protocol's `LOOPBACK_RTSP_URL` accepts
   any port; align them.
9. F-7 (same output path on a restart) and F-1 (heartbeats under back-pressure).

**(c) G-R1 erratum.** Agree with the driver. Add an entry to `masterplan/11_audit_errata.md`: §G G-R1
holds for every host file except `src/plugins/config/connection-file.ts` and
`src/plugins/logger/error-log.ts`, which imported `node:fs` before the capture layer; the guard pins
exactly those two (`static.test.ts:112-121`, green in my run). Do not refactor the two files.

**(d) Stale `app.ts` header.** The driver read §I too strictly. `05_capture_architecture_spec.md:622-624`:
"no P25 header comment is touched **except to record the waived edit set**". Updating the header
(`app.ts:10` "fourteen modules", the seam table at `app.ts:~34-45`) to record the waived edits is
permitted. Do it as one small follow-up edit after row 113's `app.ts` question is decided, and update
the P25 pin in `src/capture/__tests__/static.test.ts:211-222` in the same change (it lists every
line of `app.ts` that mentions "capture" and would go red).

## 9. Duplication, maintainability, dependencies (item 7)

- `packages/capture-protocol` vs `packages/shared`: no schema, frame code or back-off is duplicated
  (`grep` for `backoff|createLineSplitter|NDJSON` outside `src/capture` finds only the realtime
  client heartbeat, a different thing). Two small enums are restated without a pin: F-8. The plan
  constants are not restated; they are passed in the plan from `@dems/shared/api`.
- Lockfile: `git diff HEAD --numstat -- package-lock.json` -> `17 0`: the dependency line, the
  `link: true` entry and the manifest of the new workspace. No third-party addition (`zod` 4.6.5,
  `oxlint` 1.86.0, `typescript` 6.0.3, `vitest` 5.0.3 were present).
- Maintainability: `supervisor.ts` is one 620-line closure with clear sections and injected
  launcher, timers and clock; testable as shown. `scaffold.test.ts` now pins 24 units / 16 modules,
  which includes row 113's unit: that file must be committed with both rows or it goes red.

## 10. Suites (item 8)

| Command | Result | Classification |
|---|---|---|
| `npm run typecheck -w @dems/core-server` | exit 0 | - |
| `npm run lint -w @dems/core-server` | exit 0 | - |
| `npm run typecheck -w @dems/capture-protocol` | exit 0 | - |
| `npm run lint -w @dems/capture-protocol` | exit 0 | - |
| `npm run test -w @dems/capture-protocol </dev/null` | `Test Files 1 passed (1)`, `Tests 18 passed (18)` | - |
| driver command 2 (`test/static src/plugins/readiness`) | `Test Files 15 passed (15)`, `Tests 170 passed (170)` | - |
| `npm run test -w @dems/core-server -- --maxWorkers=2 </dev/null` | `Test Files 3 failed | 167 passed (170)`, `Tests 7 failed | 4179 passed (4186)` | **3 baseline:** `src/modules/sessions/__tests__/routes.test.ts` x2, `src/modules/evidence/__tests__/routes.test.ts` x1. **4 row 113:** `src/modules/stt-config/__tests__/routes.test.ts` x4 (its own file; the tests bind loopback, `EPERM` in the sandbox). **0 row 57.** |
| `npm run test:db -w @dems/core-server -- --maxWorkers=2 src/capture </dev/null` (sandbox off) | `Test Files 1 passed (1)`, `Tests 3 passed (3)` | - |

The driver reported 9 unit failures (3 + 6); two of row 113's have gone green since. The full db
project was not run, as instructed.

## 11. Tree state

Left as found except this file. `git status --short` at the end differs from my snapshot at the
start by five modified files under `apps/core-web/src/test` and `apps/mobile/src/runtime`: not
touched by me (another row in flight). One of my commands ran partly outside the sandbox with a
wrong temp path and stopped before changing anything; `store.ts` was checked identical afterwards.

## 12. Decisions for the controller to record

1. Row 57: ACCEPT-WITH-FINDINGS. Closes NM-03, CS-01, CS-03. Does not close SH-18, CS-04.
2. M3-KC-1 at row 57 = process half; the file half is row 58's.
3. F-1 (heartbeat under back-pressure) is a required fix, owner row 58 at the latest; F-2, F-3 with it.
4. SH-18 / CS-04 routing: row 58 (telemetry, warning, forwarder), row 82 (progress, completeSeal);
   hosted pair to the row that makes operations 76-80/89 live (confirm).
5. D57-5 (guard exemption) accepted. D57-7 (`store.ts` fix) accepted.
6. D57-2 / D57-3 (HELLO, ACK, boot, shutdown) accepted; §B.2 erratum.
7. D57-6: G-R1 erratum in `11_audit_errata.md`.
8. D57-10: header update is permitted by §I; schedule it with the pin update.
9. D57-11: row 113's two `app.ts` lines need an OD-14 review of their own.
10. D57-4 (timing defaults) stays a HYPOTHESIS until row 58 measures the real worker.

---
*Generated: 2026-10-09*

---

# Re-check of fix round 1

Date 2026-10-09. Reviewed: section "Fix round 1" of `implementation/19_m3_supervisor_ipc.md` and
the code as it stands (`supervisor.ts` SHA-256 `fcaf13a9...d4b609e3`, `ipc.ts` `a15c0635...405d3c5e`).
Report only; no production file changed by me.

## RC-1. Final verdict for row 57

**ACCEPT-WITH-FINDINGS.** 0 blockers, 0 major, 3 new minor (N-1 to N-3), all inherited by row 58.
F-1, F-2, F-3, F-4, F-8, F-10, F-11 and 6(d) are fixed; I confirmed F-1 to F-4 with my own
scenarios against the new code. F-5, F-6, F-9 stay as recorded (controller items).

## RC-2. My scenarios against the new code

Scratch file `src/capture/__tests__/nav_scratch.test.ts` (8 tests) and the scratch worker outside the
repository. `Tests 2 failed | 6 passed (8)`; the two failures are the new finding N-1, written as
the expectation of a correct design.

| Scenario | Round 0 | Now |
|---|---|---|
| A (fake) healthy worker, stuck listener, queue full, 3 s of heartbeats | killed, `HEARTBEAT_TIMEOUT` | `NAV-A {"kills":[],"phase":"RECORDING","lastCrash":null,"queued":4,"hbAge":0}` **fixed** |
| B2 (real) 20 000 frames at once, stuck listener, 600 ms timeout, 3 s | restart loop, attempt 4, nothing delivered | `{"osAlive":true,"phase":"RECORDING","samePid":true,"attempt":1,"lastCrash":null,"queued":8,"droppedEvents":19991,"hbAge":17,"overflowReports":1}` **fixed** |
| B2 then external `SIGKILL` | `workerDown` never delivered | `{"attempt":2,"phase":"RECORDING","downsDelivered":["EXITED/null"],"queued":8}`, `stop()` -> `STOPPED` **fixed (F-2)** |
| C (fake) `STOP` with the command window full | `STOP` not written, `SIGKILL` | `NAV-C {"stopCommandsWritten":1,"kills":[],"hanging":["CAPTURE_WORKER_DOWN","CAPTURE_WORKER_DOWN"],"armed":[]}` **fixed** |
| F-4 queue observation | 1 621 queued at limit 8 | 8 at limit 8 (B2); 256 at limit 256 (G) **fixed** |

## RC-3. The redesign, examined

**Memory under a flood with no listener draining (real process, 10 s).** Worker writes 400 frames
per millisecond-tick (telemetry, progress of ever new steps, warnings of ever new subjects); all
three listeners never return; default limits.

```
NAV-G {"rssMB":[168,184,193,194,193,193,194,194,186,189,189],"heapUsedMB":[32,47,34,44,51,38,50,40,59,35,60],
"maxQueue":256,"limit":256,"framesCounted":3012799,"droppedEvents":2008277,"droppedTelemetry":1004266,
"maxLoopLagMs":40,"maxHeartbeatAgeMs":78,"phase":"RECORDING","attempt":1,"downs":[],"overflowReports":1}
NAV-G after {"switch":"RESOLVED","stopped":"STOPPED","ms":11,"osAlive":false}
```

3.0 million frames in 10 s: the queue never passed 256, RSS is flat after the first second
(184-194 MB, the test runner included), heap oscillates without growth, the event loop was never
held longer than 40 ms, heartbeat age stayed under 78 ms, the worker was not restarted, one overflow
report, and a command and `STOP` still worked in 11 ms. **Memory is bounded.** What is given up is
back-pressure toward the worker: a worker that floods costs the Core CPU, not memory. Acceptable
for a worker we write ourselves; state it in the row 58 contract (telemetry about 20 Hz).

**Can a warning or a `workerDown` be lost or reordered against a phase change?**

- The supervisor's own events (`workerDown`, `phase`, its `CAPTURE_FAULT`): never lost, never
  queued, always in their own order (`supervisor.ts:262-272`, `:385-386`, `:402-403`). Confirmed by
  B2 and by the driver's F-2 tests.
- A **worker's** warning: can be **reordered** after phase changes, and can arrive in the next
  session. `NAV-O`: a `MIC_SILENT` written before the crash was delivered after
  `workerDown`, `CAPTURE_FAULT`, `FAULTED`, `STOPPING`, `IDLE` of session 1 and after `RECORDING` of
  session 2 (`"queuedIntoNext":2`; last entry `warning MIC_SILENT worker (S-NAV-0001)`). The driver
  states the reordering (R2 "Ordering"); the carry-over into the next session is not stated (N-2).
- A worker's warning can be **lost** only when the queue holds nothing but distinct warnings.
  `NAV-WP` at limit 4: four `MIC_SILENT` of four subjects wait, a fifth warning
  (`CAPTURE_FAULT:VIDEO-01`) is dropped. At the default 256 this needs 256 different
  code/subject pairs; `subject` is free text of up to 128 characters, so only a faulty worker gets
  there (N-3).
- A finished progress step **is** lost at the bound: in the same run `SEAL:1` (progress 1) was
  evicted by later steps and never delivered. Correct by the new contract, and the reason for the
  next paragraph.

**What must never be lost, and what travels through this queue today.** Nothing that must never be
lost exists yet, but every worker-to-supervisor message that carries content (`TELEMETRY`,
`PROGRESS`, `WARNING`) goes through the lossy queue. The only messages handled outside it are
`HELLO`, `ACK`, `HEARTBEAT`, `CRASH`, and none of them carries a record. **The protocol has no
lossless path.** Rows 58/59 need, exactly:

1. A new worker message class for records, handled inline in `onMessage` beside `ACK`
   (`supervisor.ts:470-494`), never passed to `emitFromWorker`. At least: "first durable fragment"
   (the F-7 ruling, RC-6), the per-fragment checkpoint of row 59 (index, bytes, chain values), and
   seal completion (`completeSeal` has no message at all, round-0 item 6(a) point 4).
2. A sequence number per session on every record; a gap is a `PROTOCOL_VIOLATION`.
3. Delivery to a consumer that does not coalesce: either the synchronous path the supervisor's own
   events use (the consumer persists or owns its own bounded store), with a supervisor-to-worker
   acknowledgement of the highest persisted sequence so that the worker, not the Core, holds the
   unacknowledged tail; or the rule that the file is the record of truth and the frame is only a
   hint (the box walk of spec §C.5 rebuilds the checkpoints at RECOVERY). The controller should pick
   one; the second is cheaper and matches AU2-08.
4. `WorkerMessageSchema` is a strict discriminated union (`packages/capture-protocol/src/index.ts`):
   an unknown `type` is `FRAME_NOT_A_MESSAGE` and ends the worker. A new message must land in the
   package and the worker together; raise `CAPTURE_PROTOCOL_VERSION` if a worker of version 1 exists
   by then.
5. Completion of sealing must not be read from `PROGRESS` with progress 1.

## RC-4. New findings (row 58 inherits)

| # | Severity | File:line | Evidence | Suggested fix |
|---|---|---|---|---|
| N-1 | minor, fix before any listener calls back into the supervisor | `supervisor.ts:385-391`, `:402-407`, `:274-279` | The supervisor's own events are now handed to listeners synchronously in the middle of a transition. A listener that calls `stop()` there (what a sessions module will do on `CAPTURE_FAULT` to start the OD-08 interrupted seal) ends the session, and the code after the `emit` then writes a phase for a session that is gone. `NAV-R1`: after the stop, `{"phase":"FAULTED","sessionId":null}`, phase events ended `STOPPING>IDLE`, and the next start reported `FAULTED>STARTING`. `NAV-R2` (stop from a `workerDown` listener): `{"phase":"RESTARTING","sessionId":null,"armed":[250]}`, still `RESTARTING` 10 s later. The next `start` works; `status().phase` and the `previous` of the next phase event are wrong until then. A weaker form existed in round 0 (the first listener ran inside `emit` when the queue was idle); it is now the rule. | Finish the transition first, then hand out the events (collect the own events of a transition and deliver them after the state and timers are set), or re-check `session === current` after each `emit`. Add both scenarios as tests. |
| N-2 | minor | `supervisor.ts:348-358` (the queue is not cleared when a session ends) | `NAV-O`: two events of session 1 were still queued when session 2 was `RECORDING`, and were delivered then. They carry `sessionId` and `correlationId`, so a careful consumer can drop them. | Drop the waiting worker events of a session when it ends (count them), or document that every consumer must compare `correlationId` with `status().correlationId`. |
| N-3 | minor | `supervisor.ts:211`, `:236-244`; `packages/capture-protocol/src/index.ts` `WarningMessageSchema.subject` | Warnings are told apart by code and free-text subject, and are never evicted. A worker that invents subjects fills the queue with warnings; later progress and warnings are then dropped until a listener drains (`NAV-WP`). | Row 58: restrict `subject` to the device IDs and mic roles of the plan (validate in `onMessage`, else `PROTOCOL_VIOLATION`). |
| N-4 | note | `supervisor.test.ts:479` | The title still says "progress and warnings are never dropped"; true for that scenario only, no longer the contract. | Reword. |

## RC-5. The replaced test (item 3)

Limit of this check, stated plainly: every file under `src/capture/` and `test/support/capture*` is
untracked, so `git diff HEAD` shows nothing for them. I compared against what I read in round 0.

- `supervisor.test.ts`: 36 test titles, the same as in round 0 except the one replaced; all titles
  before line 510 stand at the same line numbers as in round 0. 16 distinctive assertions of the
  M3-KC-3 / M3-KC-1 blocks that I quoted from round 0 are each still present. Lines 478-572 read in
  full: the telemetry test, the command-window test and the throwing-listener test are word for
  word what I read in round 0. I did not hold a copy of lines 81-134 and 391-477 of round 0; for
  those I can vouch for titles and positions only.
- Changed assertions: exactly two. (1) The control lost `inputPaused: false` (the field no longer
  exists) and gained `droppedEvents: 0, queuedEvents: 0`: stricter. (2) "paused at the limit,
  resumed at half" is replaced by "up to the limit ... none is lost; the worker is never held
  back": 9 steps at limit 8, `queuedEvents: 8`, zero dropped, all 9 delivered in order.
- Is the replacement at least as strict? Taken alone it covers less (it stops at the limit). With
  `liveness.test.ts` F-4 it covers more than the old test did: 500 events past the limit, the
  maximum queue length sampled after every write (`most` = 4), exact loss counts
  (`droppedTelemetry: 3`, `droppedEvents: 503`), exactly one overflow report, the surviving warning
  and the newest three steps delivered. The old property "nothing is ever lost past the limit" is
  gone on purpose; that is the design change of R2, not a weakened test.
- `ipc.test.ts`: the 12 old titles are unchanged, two tests added (14). `static.test.ts`: 22 tests,
  the P25 pin now lists four header lines more (stricter). No `skip`, `todo`, `only`, `retry` or
  longer timeout in the folder.

## RC-6. F-7 and the controller's ruling (option C)

- **Fit.** The shape makes it easy. `afterDown` (`supervisor.ts:384`) already has the branch that
  gives up without a restart and leaves a recording `FAULTED` with the session open for the
  interrupted seal (`:388-392`). Option C is one flag on the session, set by the lossless "first
  durable fragment" record of RC-3 point 1, and one more term in that condition. Nothing else in
  the supervisor has to change. The protocol does need the new message (RC-3).
- **Safe default until that message exists.** The supervisor cannot tell "no durable fragment yet"
  from "the report was not sent". Row 58 should treat "START acknowledged" as "may be durable" until
  the record message is in place, that is: no respawn after `RECORDING`.
- **The driver's pin** (`liveness.test.ts:167-178`, "same paths, attempt 2"): it does not contradict
  option C as long as it is read as the case before the first durable fragment; the fake reports no
  fragment. It must be renamed to say so, and row 58 adds its sibling: after the durable record, a
  crash goes to `FAULTED`, the launcher is not called again, `CAPTURE_FAULT` is raised once.
- **Tests whose meaning narrows under option C** (all stay green, all restart a worker that reported
  no fragment): M3-KC-3 back-off series and "ran stable clears the count" (`stableAfterMs` 30 s
  becomes close to unreachable inside a session once fragments are about one second apart),
  M3-KC-1 "exit code 0 in the MIDDLE of a recording", the real-process "a KILLED worker is started
  again", and "a worker that restarts later starts with the chosen source". The row's gate sentence
  "a killed worker respawns under the supervisor" is then true before the first durable fragment
  and between sessions only; record that with the ruling.
- **One open point the ruling creates.** The protocol header now says a worker never truncates or
  overwrites an existing output file. A worker that crashed before its first durable fragment may
  have left a file with an init segment only. Row 58 must say what the respawned worker does with
  it (create the file only at the first fragment, or allow replacing a file that holds no fragment).

## RC-7. Suites (item 4)

| Command | Result | Classification |
|---|---|---|
| `npx vitest run --root apps/core-server --project unit src/capture </dev/null`, twice | `Test Files 6 passed (6)`, `Tests 86 passed (86)` both runs | as the driver expects |
| `npx vitest run --root apps/core-server --project unit test/static src/plugins/readiness </dev/null` | `Test Files 15 passed (15)`, `Tests 170 passed (170)` | - |
| `npm run test -w @dems/capture-protocol </dev/null` | `Tests 18 passed (18)` | - |
| typecheck / lint `@dems/capture-protocol` | exit 0 / exit 0 | - |
| typecheck / lint `@dems/core-server` | exit 0 / exit 0 | - |
| `npm run test -w @dems/core-server -- --maxWorkers=2 </dev/null` | `Test Files 3 failed | 169 passed (172)`, `Tests 7 failed | 4193 passed (4200)` | 3 baseline (`src/modules/sessions/__tests__/routes.test.ts` x2, `src/modules/evidence/__tests__/routes.test.ts` x1); 4 row 113 (`src/modules/stt-config/__tests__/routes.test.ts`, `listen EPERM` in the sandbox); **0 row 57** |
| `npm run test:db -w @dems/core-server -- --maxWorkers=2 src/capture </dev/null` (sandbox off) | `Test Files 1 passed (1)`, `Tests 3 passed (3)` | - |

**P25.** `git diff HEAD --numstat`: `app.ts` 15 added / 0 removed, `index.ts` 2 / 0, `config.ts` no
diff. The 15 are: 5 header comment lines that record the waived edit set (17-20 and 49; permitted by
spec §I lines 622-624), the 8 code lines of edits 1-6, and row 113's two (`app.ts:101`, `:322`),
which still need their own OD-14 review. The header text names edits 1 to 6 only and says nothing of
`sttConfigModule`, which is right for row 57.

## RC-8. Tree state

Scratch file deleted (`git status --short | grep -c nav_scratch` -> 0). No worker process left
(`pgrep -fl "capture-stub-worker|nav57/worker"`, sandbox off -> exit 1). `supervisor.ts` and
`ipc.ts` have the same SHA-256 before and after my runs. No mutation was applied in this round.

## RC-9. For the controller to record

1. Row 57 after fix round 1: ACCEPT-WITH-FINDINGS; closes NM-03, CS-01, CS-03.
2. Row 58 inherits: N-1 (re-entrant `stop()` from a listener), N-2 (events of an ended session),
   N-3 (warning subjects), the lossless record path of RC-3 (needed for option C and for row 59),
   the "may be durable after START" default, the rename of the F-7 pin and its sibling test, the
   init-segment-only file question, and from round 0: F-5 (file half of M3-KC-1), F-6 routing
   (SH-18 / CS-04), F-9 (boot lines in the device gate), the nine-point worker gap list.
3. D57-9 is replaced: telemetry and progress are levels and may be superseded or evicted; worker
   warnings are kept unless the queue is full of distinct warnings; nothing that must never be lost
   may use this queue.
4. No back-pressure toward the worker is now a stated property of the design.

*Re-check appended: 2026-10-09*
