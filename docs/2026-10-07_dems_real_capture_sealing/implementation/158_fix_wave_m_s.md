---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave M, driver M-S (apps/core-server, packages/shared, scripts/lane)
date: 2026-10-11
agent: coder-execution
narrative_tier: 1
source: gateway_check/09d_m4_final.md (G70d-01), 13d_m8_final.md (G94d-02), 10e_m5_final.md (G75e-03, G75e-07); decisions D232, D234, D236; delegation_progress/fix_brief_wave_m.md
tree: 7b1aded + the uncommitted work of fix wave M (no commit, no migration: schema 6 / dbc-7; totals 97 / 36 / 61 / 67 unchanged; NO member added to packages/shared/src/api, OpenAPI not generated; packages/shared not edited at all)
status: complete for items 1, 2, 3; item 4 NOT changed by rule (no audit type fits) - reported for the next task
---

# 158 - Fix wave M, driver M-S

Lane 1 was stopped at my start (`lane.sh stop 1`, was PID 13944) and started again at my end
(`lane.sh start 1 > .cache/gate-env/wave-m/start_1.log`, not reset: PID 31434, health ok, 0 warn /
0 error lines). Lane 2 was not called, started, stopped or reset; `lane.sh source-rig 2 status`
was run once (it reads the switch file and the listener's PID, it sends lane 2 nothing). No file
under `.data/` was opened, no local device selected, no git write.

## 1. Findings

| # | Finding | Cause (file:line at 7b1aded) | Change | EXISTING test file that took the test + output | Status |
|---|---|---|---|---|---|
| 1 | G70d-01: notification B cannot be driven on a lane | the sources a development Core records from are the GENERATED adapters of `src/capture/fence/generated-sources.ts` (kind `FAKE`), not the in-memory doubles of `adapters/fake/` the gate report names: their reachability read answers a constant (`profiles()` `:87-90`, `enumerate()` `:143-145`) and the fence asks a test source through that read (`fence/index.ts:285-286` "a test source is always there"). No stored address is ever read. The PRODUCT'S pre-check has no gap (section 2) | section 2: a development source switch in the generated adapters + the fence's refused-outside-development seam + the lane rig + `lane.sh source-rig` | `src/capture/fence/__tests__/open-sources.test.ts` (7 cases), `src/capture-notices/__tests__/notices.test.ts` (2 cases), `test/static/lane-camera-stub.test.ts` (rule 6, 4 cases + one pin by delta); the rig's own test `test/support/lane-source-rig.test.ts` (NEW module, 9 cases). Run: `Test Files 28 passed (28)  Tests 379 passed (379)` | done; NOT driven live (lane 2 runs the old code until M-W restarts it) |
| 2 | G94d-02: two WARNING rows for one stop | `src/media-stream/service.ts:379-401` `recordServed`: the test "already known" (`:379-380`) and the `stops.set` (`:401`) were separated by the awaited audit write (`:385`), so a second request cut on the same fragment passed the test while the first row was being written | the stop is remembered BEFORE the write is awaited (same turn as the test) and taken back when its row could not be written (only this request's own mark) - never fewer rows than stops | `src/modules/media-stream/__tests__/wave-k-z1-indexed-view.test.ts`, describe "G94b-10: ONE stop writes ONE row", new case "G94d-02: two range requests that are cut at the same moment ..." | done |
| 3 | G75e-03: error-level `CAPTURE_FAULT` of the previous session at the next healthy start | `src/capture/index.ts:198-204`: the listener of the supervisor's own warning did not read `event.state`. The supervisor says its fault twice by design: ACTIVE when the worker is down for good (`supervisor.ts:702`) and CLEARED when a LATER session reaches RECORDING (`supervisor.ts:817-821`, D84 R-3) - with the ids of the EARLIER session and no cause. That CLEARED was written as `log.error` + an error-log entry "capture fault: the capture worker cannot be kept running", `reason null` | `writeSupervisorFaults` (exported, the module calls it): ACTIVE as before; CLEARED = ONE info line `CAPTURE_SUPERVISOR_FAULT_OVER` with `faultOfSessionId` / `faultOfCorrelationId` (no `sessionId` member), nothing in the persistent error log | `src/capture/__tests__/module.test.ts`, new case "G75e-03: a worker-killed session writes ONE error line ..." | done |
| 4 | G75e-07: an acknowledgement that closes nothing has no audit row | op 70 writes no row by contract (`packages/shared/src/api/alerts.ts:88`, spec section 13.2 parity; `modules/alerts/acknowledge.ts:10-16`: ONE info log line with operator and alert id). The only row of op 70 is the `FAULT_CLEARED` of the reviewer's closing acknowledgement of the UNSEALABLE notice (`packages/shared/src/sim/faults.ts:575-606`) | **none** - section 4 | - | NOT changed (rule of the task) |

Red-first proof (no git: the fix was taken out of the product file in place, the test file run,
the file put back from a scratch copy): with `stops.set` back behind the write, the G94d-02 case
fails `expected 2 to be 1`; with the CLEARED branch disabled, the G75e-03 case fails
`expected [ { level: 50, ... } ] to deeply equal []`. Both green with the fix. The rig's cases
each hold their control (switch OFF = the finding: READY / PASS).

## 2. The source rig (item 1)

**Is the feature broken, or only not drivable?** Only not drivable. With a source whose read
fails, the product's gate (`capture-notices/precheck.ts`), notifier and session machine already
produce every fact of notification B - the existing cases of `notices.test.ts` hold that with
stopped in-memory fakes, and `no-device.db.test.ts` on PostgreSQL (run again: green). The new
cases put the REAL generated adapters and the REAL rig rule in front of the same gate and read the
same facts. No change was made to the pre-check.

| Piece | Where | What |
|---|---|---|
| the switch of a generated source | `src/capture/fence/generated-sources.ts`: option `unreachable?: (deviceId) => boolean`, `GeneratedSourceUnreachableError` (`code DEV_SOURCE_SWITCHED_UNREACHABLE`) | while it answers true: a camera's `profiles()` (the reachability read; the probe is its only caller) and `openSource()` reject with that error; a microphone's `enumerate()` says `present: false, errorCode: DEVICE_NOT_FOUND` and `open()` rejects. Decided BEFORE a helper or a pipe: nothing is started. A switch that throws switches nothing |
| the fence | `src/capture/fence/index.ts`: `DevelopmentRegistryInput.sourceUnreachable` (spread into the two GENERATED adapters only - not into `shared`, which also builds the local adapters); `CaptureFenceControl.installDevelopmentSourceSwitch` | the seam throws `DevelopmentSourceSwitchRefusedError` (`DEV_SOURCE_SWITCH_NEEDS_DEV_SOURCES`) in every operation but REAL_DEVELOPMENT. No product code calls it; without a call every generated source is always there. Read at every call, so it may be installed before or after the boot step |
| the rig | `apps/core-server/test/support/lane-source-rig.ts` (NEW) | `prepareLaneSourceRig` throws `LaneSourceRigError` for REAL_PRODUCTION before `app.ready()` (check `capture.sourceRig`, code `DEV_SOURCE_RIG_IN_PRODUCTION`), is inert on SIMULATED / without a file; `createLaneSourceRig` reads the switch file at every call; warn lines `LANE_SOURCE_RIG_ON` (once per arming per device), `LANE_SOURCE_RIG_NOT_A_FAKE_DEVICE`, `LANE_SOURCE_RIG_SWITCH_UNKNOWN`; error `LANE_SOURCE_RIG_UNREADABLE` |
| the launcher | `test/support/lane-camera-stub-cli.ts`: `--source-rig-file` | prepared before `app.ready()`, installed after it and before the boot |
| the script | `scripts/lane/lane.sh`: `source-rig <n> unreachable <CAM-NN\|MIC-NN> \| release \| status`, section "THE SOURCE RIG" | exit 64 on a lane that is not REAL_DEVELOPMENT and for any word that is not a registry id; switch file `.locks/source-rig.lane<n>.switch`, mode 0600; a second `unreachable` ADDS a device (at most four) |

**Which devices.** Generated cameras AND generated microphones - both adapters have the same two
doors. Never a local device: the switch is handed to no local adapter (test: with `CAM-03 MIC-03`
in the switch the function is never even asked for them and both answer as without it).

**Why the cause is `UNREACHABLE` for a camera.** The probe reads one of the five local-source codes
from an error's `code`, else `UNREACHABLE` (`capture-notices/probe.ts:58-61`). A generated camera
that stands for a registered network camera which does not answer is exactly that cause; the
error therefore carries a code of its own that is none of the five. The error's sentence says what
it is ("switched unreachable by the development source switch"), so the error log of a lane never
reads as a helper failure. For a microphone the product's cause of an input that is not in the
list is `DEVICE_NOT_FOUND` (what the in-memory fake's `setPresent(false)` defaults to).

**Running lane, no restart.** Same mechanism as the seal rig: the file is read at every
reachability read and every open. It needs a Core started by the launcher WITH
`--source-rig-file`, i.e. lane 2 after M-W's restart.

**What a client receives, and what happens after `release`:** `delegation_progress/contract_wave_m.md`
section "M-S 1" (exact members and values, pinned by the two new cases of `notices.test.ts`).

## 3. G75e-03 - can the late event touch the new session?

No, and it could not before. Read and now pinned: at the first RECORDING of a session the
supervisor emits `phase RECORDING`, then the CLEARED of the earlier fault, in one step
(`supervisor.ts:816-821`). The forwarder's phase listener empties its table and makes the ONE
clear of a new recording (`forwarder.ts:465-480`, D84 R-4, by design); its warning listener then
finds no held entry for the CLEARED and returns (`forwarder.ts:422-424`). The new test records the
engine calls of that start: exactly `['clear every capture fault']`. The only effect of the event
was the wrong log line and its error-log entry. The supervisor's event itself is unchanged (the
forwarder's R-3 rule reads it).

## 4. G75e-07 - no audit type fits

Read: the 67 types of `packages/shared/src/sim/vocabulary.ts:347-434`. An acknowledgement that
closes nothing is "an operator marked an alert as seen". `FAULT_CLEARED` would state a clear that
did not happen (the notice stays active; a client draws that row as the end of a fault);
`FAULT_RAISED`, `SUMMARY_ACKNOWLEDGED` (the session summary), `DEVICE_COMMAND`, `ACCESS_DENIED`
(nothing was refused: 204) each say something else. Op 70 writes no row for ANY alert today - not
only the UNSEALABLE notice - and the contract text says so. Per the task ("if none fits, change
nothing"): nothing changed. What exists: the alert's `acknowledged: true`, and one info LOG line
`alert acknowledged` with `operatorId` and `alertId` (not persistent beyond the log, no device).
For the next task: a 68th type (e.g. `ALERT_ACKNOWLEDGED`, group SYSTEM, details `alertId`,
`reason`, `operationId`) written by `acknowledgeAlertTransition` with operator and sending device.

## 5. Files

| File | Change |
|---|---|
| `apps/core-server/src/capture/fence/generated-sources.ts`, `fence/index.ts` | item 1 |
| `apps/core-server/test/support/lane-source-rig.ts` (NEW), `lane-source-rig.test.ts` (NEW, the module's own), `lane-camera-stub-cli.ts` | item 1 |
| `apps/core-server/test/static/lane-camera-stub.test.ts` | pin by delta (the launcher is handed FOUR paths) + rule 6 |
| `scripts/lane/lane.sh` | item 1 |
| `apps/core-server/src/capture/fence/__tests__/open-sources.test.ts`, `src/capture-notices/__tests__/notices.test.ts` | item 1 tests (the harness of `notices.test.ts` takes an optional probe) |
| `apps/core-server/src/media-stream/service.ts` + `src/modules/media-stream/__tests__/wave-k-z1-indexed-view.test.ts` | item 2 |
| `apps/core-server/src/capture/index.ts` + `src/capture/__tests__/module.test.ts` | item 3 |
| docs | `delegation_progress/contract_wave_m.md` (NEW), `file_claims.md` (2 lines), this note |

`packages/shared`: not edited.

## 6. Tests run (each once after its last change; a second run only after a fail)

| Check | Command (repository root) | Result |
|---|---|---|
| unit, touched files + static guards | `npx vitest run --root apps/core-server --project unit test/static test/support/lane-source-rig.test.ts test/support/lane-camera-stub.test.ts src/capture/__tests__/static.test.ts src/capture/__tests__/module.test.ts src/capture/fence/__tests__/open-sources.test.ts src/capture-notices/__tests__/notices.test.ts src/capture-notices/__tests__/probe-wiring.test.ts src/modules/media-stream/__tests__/wave-k-z1-indexed-view.test.ts src/media-stream` (outside the sandbox: loopback) | `Test Files 28 passed (28)  Tests 379 passed (379)` |
| unit, the wider neighbourhood (before the last static tidy) | `... test/static test/support src/capture/__tests__/static.test.ts src/capture/fence src/capture-notices src/media-stream src/modules/media-stream src/capture/__tests__/module.test.ts src/engine/__tests__/static.test.ts` | `Test Files 40 passed (40)  Tests 590 passed (590)` |
| db (project script, one run) | `/usr/bin/lockf -k .locks/db-migrate.lock npm run -s test:db -w @dems/core-server -- src/capture/fence/__tests__/development-session.db.test.ts src/capture/fence/__tests__/fence.db.test.ts src/modules/capture-inputs/__tests__/no-device.db.test.ts src/modules/media-stream/__tests__/media-stream.db.test.ts src/capture/__tests__/wave-h-f-boot-clear.db.test.ts src/capture/__tests__/boot.db.test.ts src/capture-notices/__tests__/session-start.db.test.ts` | `Test Files 7 passed (7)  Tests 38 passed (38)`; 0 databases left |
| typecheck | `npm run -s typecheck -w @dems/core-server`, `-w @dems/shared` | exit 0, 0 |
| lint | `npm run -s lint -w @dems/core-server`, `-w @dems/shared` | exit 0, 0 |
| lane script | `sh -n scripts/lane/lane.sh`; the `source-rig` command on a throw-away COPY in the scratch folder | syntax ok; `status` OFF; `unreachable CAM-05` -> `UNREACHABLE CAM-05`; `MIC-02` added; a repeat adds nothing; a fifth device, `127.0.0.1`, no id, lane 1, an unknown word, an extra word: exit 64, nothing written; `release` -> `OFF`; file mode 0600 |

One first run was red and fixed: my own assertion in the first new `notices.test.ts` case
expected 0 calls of the scripted door; the product lists the LOCAL microphone at every input
re-read (two `-list_devices` calls). The assertion now says what is true: no push, list calls only.

## 7. Proven live versus by test

| Item | By test | Live |
|---|---|---|
| 1 rig | rule, file, refusals, generated adapters, the product's pre-check facts, release, second occurrence, never a local device, static rules | **nothing** - lane 2 has no rig until its restart. The lane script was run on a copy only; on the real tree only `source-rig 2 status` (OFF) |
| 2 | the concurrent case with the unit of the row held open | not driven (needs a browser's media element) |
| 3 | the real listener on a supervisor with a fake worker + the real forwarder | not driven (needs a worker kill and a next session on lane 2) |
| 4 | - | - |

## 8. Checks for the test runner

| Command | Lock | Expected |
|---|---|---|
| `npm test -w @dems/core-server` (unit, whole) | none; outside the sandbox | green. A test elsewhere that pins the launcher's argument list, the exact log lines of a session start (`CAPTURE_SUPERVISOR_FAULT_OVER` is a new info line at the first RECORDING after a failed session), or the number of files under `test/support` is a pin to move by delta |
| `npm run test:db -w @dems/core-server` (whole) | `.locks/db-migrate.lock` | green apart from the known baseline |
| `npm test -w @dems/shared` | none | green (nothing of shared was edited) |
| seal e2e + kill matrix (`DEMS_SEAL_E2E=1 ...`) | `.locks/heavy-host.lock` + db lock, lane 2 DOWN | unchanged; the kill matrix log has no error-level `CAPTURE_FAULT` after a kill other than the ACTIVE one |

## 9. Re-drive list (lane 2, AFTER M-W's restart)

1. The start output says `source rig available (development tool): switch ... says: OFF`; the
   Core log has `LANE_SOURCE_RIG_INSTALLED`.
2. `M4-NODEV-B-W / -T / -P`: `contract_wave_m.md` "Order for a driver". Expect: Devices Check row
   of the rigged camera not PASS (WARN, "UNREACHABLE"), ONE alert `CAPTURE_DEVICE_UNREACHABLE`
   (`cause UNREACHABLE`, `searchResponderCount` = what the stub answered), one
   `CAPTURE_DISCOVERY_SEARCHED` row `trigger: PRECHECK`, one `CAPTURE_DEVICE_UNREACHABLE` row,
   one warn line `LANE_SOURCE_RIG_ON`; one alert across web, tablet and phone. Both cameras
   rigged: blocked. `release` + Retry: 0 banners, the alert `active: false`, no new row.
3. `M4-NODEV-NOCFG-T`: the same with an operator who holds SESSION_START only.
4. A rigged microphone (`MIC-02` standby): `MIC_STANDBY` WARN, alert `cause DEVICE_NOT_FOUND`.
5. Control: `source-rig 2 unreachable CAM-03` (the Mac's camera) - do NOT pre-check it; the log
   line `LANE_SOURCE_RIG_NOT_A_FAKE_DEVICE` appears at the next pre-check of any generated source.
6. G94d-02: a web tamper stop outside the 60 s window, five times: one WARNING row each; the Core
   log may show a warn line `repeated: true` beside it.
7. G75e-03: kill the worker of a session, let it seal, start the next session: 0 error-level
   lines at the start; one info line `CAPTURE_SUPERVISOR_FAULT_OVER` naming the earlier session.
8. Always end with `lane.sh source-rig 2 release` and `seal-rig 2 status` = OFF.

## 10. Seen, not changed

- HYPOTHESIS (read, not driven): the notices unit keeps the FIRST probe it got from the fence
  (`capture-notices/index.ts:158-162`), and that probe holds a frozen copy of the camera adapters
  of that moment (`fence/index.ts` `probeAdapters`). A camera ADOPTED after the first pre-check or
  input re-read of a run (op 96 -> `admit`) is in the registry and assignable, but not in the kept
  probe: a pre-check with it on a track would read it `UNREACHABLE` ("no adapter serves it") until
  the next restart - a false notification B without any rig. Drivers of notification B should use
  cameras that existed at the lane's start (`CAM-02`, `CAM-04`, `CAM-05`), not one adopted in the
  same run. If confirmed: the kept probe should ask the fence at each use.
- The gate report names `adapters/fake/camera.ts` (`failOpen`) as the adapter of the lane; those
  are test doubles that feed nothing. The lane records from `fence/generated-sources.ts`.
- After a pre-check read a device not online, the device tile stays "not online" until the next
  pre-check (the Core does not poll): also after a `release`.
- `acknowledgeAlert` records who acknowledged only in a log line, for every alert (item 4).
- The seal rig's own test lives in `src/sealing-host/__tests__/wave-k-s1-seal-rig.test.ts` (a
  per-wave file): a candidate for the consolidation of D233.

## 11. Decisions for the controller

1. Item 4 is left for the next task (a 68th audit type); nothing was written.
2. The rig accepts up to four devices (a second `unreachable` adds), so that "both cameras
   stopped: blocked" of `M4-NODEV-B-*` can be driven. D232 says "one generated source"; say if
   it must be held to one.
3. The camera cause is `UNREACHABLE`, the microphone cause `DEVICE_NOT_FOUND` (section 2).
4. The hypothesis of section 10 (a camera adopted in the same run) is outside my closed scope
   and bears on how notification B is driven: a ruling whether it goes into this wave.

---
*Generated: 2026-10-11 15:05 WIB*
