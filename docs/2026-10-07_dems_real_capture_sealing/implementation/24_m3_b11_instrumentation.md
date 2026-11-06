---
task_id: 2026-10-07_dems_real_capture_sealing
row: 62
milestone: M3-W6
date: 2026-10-09
agent: coder-execution (driver, parallel wave D94 / D95)
status: needs-review
closes: CS-10 (read 64, see B.3), B11 / RK-5 (instrumented; the measurement is the gate's), M3-AV-2 case (c)
open: worker change for `nearBound` baseline and the camera clock sanity bound - requested from row 59 (section C.3)
---

# Row 62 - B11 instrumentation, CS-10 services, SR-drift fake camera

Tier 3. Evidence: `implementation/evidence/24_m3_b11_instrumentation/`. Nothing committed.

## A. Mobile: the late-stop wait point (RF2-2, B11, RK-5; ux P-12)

RF2-2 (`2026-10-04.../verification/12_code_review_mobile.md` section 6): after a web stop the tablet
showed "Recording" for 3.2 / 6.7 s; two causes could not be told apart. The existing
`runtime.diag.sessionWindow` record says THAT the stop was late. Row 62 adds WHERE it waited.

| Point | Timestamp | Where it is taken |
|---|---|---|
| 1 Core stop | `coreStoppedAt` (the session's `stoppedAt`, Core clock) | read from the store, `session-diagnostics.ts:302-308`, `:341-355` |
| 2 replica store | `storeAt`, `storeAtCore` | a store listener (selector form: runs only when this session's state changes), `session-diagnostics.ts:341-355` |
| 3 React commit | `commitAt`, `commitAtCore` | the component's effect, `session-diagnostics.ts:284-328` |
| 4 in-place hand-over | `handoverAt`, `handoverAtCore` | `useLateStopHandoverMark`, `session-diagnostics.ts:255-269`, called by `app/(app)/session/live.tsx:35` |

- One record `runtime.diag.lateStop` per stop (points 1-3, `coreToStoreMs`, `storeToCommitMs`,
  `coreToCommitMs`, `waitPoint` = `NONE` / `BEFORE_STORE` / `STORE_TO_COMMIT` / `UNKNOWN`, threshold
  `LATE_STOP_MS` 1,000; socket counters since arming: `droppedSinceArm`, `resyncsSinceArm`,
  `reconnectsSinceArm`, `resyncPendingAtStore`, `clockSampleAgeMs`; the JS-lag window of the same
  transition). Builder: `lateStopRecordOf`, `session-diagnostics.ts:194-236` (pure).
- One record `runtime.diag.lateStop.handover` per hand-over (point 4).
- Device instants are ISO strings of the device clock; `...Core` instants are the Core clock as the
  client estimates it (`core-clock.ts`), so they can be cited next to the Core log. Without a Core
  clock (SIMULATED) they are `null`, never the device clock under another name.
- Written with the existing `reportDiagnostic` (runtime log `dems.mobile.log.v1`, not printed,
  blanked by `sanitizeLogContext`). No behaviour change: one passive listener while RECORDING, one
  effect in the live route. Export line: `runtime/index.ts:230-231` (one added line).

Reading a record: `waitPoint BEFORE_STORE` with `droppedSinceArm` / `resyncsSinceArm` > 0 is cause (b)
(dropped deltas, resync); `BEFORE_STORE` with a large `lagMaxMs` and no drops, or `STORE_TO_COMMIT`,
is cause (a) (JS thread or render).

Tests (jest, `--maxWorkers=2`): `src/runtime/session-diagnostics.test.tsx` (+9: seven pure cases
incl. the RF2-2 shape, the 1 ms boundary, no Core clock, no store mark; one record per stop on the
simulator; negative control "never RECORDING under the component -> no record") and
`src/features/session-live/live-late-stop-handover-mark.test.tsx` (the REAL `/session/live` route on
the Live source: no record while the monitor shows, exactly one after a pushed stop, both instants
ISO with ms, nothing printed).

Real vs stand-in: the LIVE path of `runtime.diag.lateStop` with Core-clock instants is proven by the
pure builder only - the Live test bed does not mount `(app)/_layout.tsx`, where `SessionDiagnostics`
lives. The device run at the gate is its first end-to-end proof.

## B. Core server: CS-10, the capture worker and the transcriber as services

`apps/core-server/src/modules/system/status.ts` (rewritten, 145 lines), `index.ts:95-119`.

- Read 64 `getSystemStatus` lays two processes over the engine's `services` slice
  (`servicesWithProcesses`, `status.ts:127-135`):
  - **capture worker -> `Recording Engine` (SVC-05)** from `app.capture.status().phase`
    (`CAPTURE_PHASE_VERDICT`, `status.ts:84-92`): CLOSED and FAULTED = STOPPED, RESTARTING = DEGRADED,
    IDLE / STARTING / RECORDING / STOPPING leave the entry as the engine has it. The worse verdict
    wins, so a simulator fault is never hidden. An idle supervisor has no process by design.
  - **transcriber -> `Transcription Service` (SVC-17, row 78's entry; no second entry added)**: not
    mounted (row 115), so NOT_CONFIGURED. The contract's status set is RUNNING / DEGRADED / STOPPED
    (`sim/vocabulary.ts:285`), so on the wire it is `STOPPED`, `startedAt: null`; the reason
    `NOT_CONFIGURED` is in `serviceReportsOf` (`status.ts:114-119`), not on the wire.
- **The seam for row 115**: `TranscriberServiceSource` (`status.ts:72`), plugin option `transcriber`
  of `systemModule` (`index.ts:107-113`); default `TRANSCRIBER_NOT_MOUNTED` (`status.ts:75`).
- Static pins of the folder updated in the same change (`__tests__/static.test.ts`: the import list
  gains `../../capture` (type only); the plugin signature pin; `options` is read for `transcriber` only).
  `app.ts` untouched (P25): the factory registers the module without options.

Tests: `routes.test.ts` (+13: every phase, phase table complete, worse-wins with a real
`STORAGE_FULL` fault, transcriber not mounted, the row-115 seam on a bare Fastify instance through all
four states, by-reference purity, one supervisor read per call); 3 existing expectations of read 64
restated (`withProcesses`, hand-written); `system.db.test.ts` and `effects.db.test.ts`: 3 expectations
restated through `servicesAsRead` (`support.ts`). Row 78's 16 -> 17 pins kept as they are.

### B.3 What is NOT done (stated plainly)

1. The overlay is on the ANSWER OF READ 64 only. The replicated `services` slice the consoles draw
   is still the simulator's (all RUNNING unless a fault). No client calls read 64 today
   (`grep getSystemStatus apps/core-web/src apps/mobile/src` = 0). Bringing the two processes into the
   slice needs an engine action or `SERVICE_EFFECTS` entries for the capture faults
   (`packages/shared/src/sim/derive.ts:76`) - shared simulator, not this row's file.
2. `restartServices` (66) does not restart the worker or the transcriber (API contract row 66): the
   worker is one process per session and 66 is refused while a session is open; nothing to restart.
3. "Not configured" has no wire value. Adding a fourth `ServiceStatus` is a contract change (OpenAPI,
   three clients): a decision, not taken here.

## C. Worker fixtures: SR-drift camera, `nearBound`, camera clock sanity bound

### C.1 The fixture (new file, row 62's)

`apps/capture-worker/test-fixtures/fake_cam_sr.py` (230 lines; Python standard library + the installed
ffmpeg). It writes the RTSP dialogue, the RTP packets (RFC 6184, FU-A) and the RTCP sender reports
itself. `--sr true`: every report pairs the TRUE wall clock with the DRIFTING media clock.
`--sr linear`: reports without rate information (what libavformat's writer sends) - the negative
control. Also `--delay-ms`, `--clock-offset-ms`, `--clock-step-ms/--clock-step-at-s`. Loopback URL
guard, connects only, opens no receiving socket.

### C.2 Checks (shared harness, additive: `m3worker.py` `cmd_srcam` `:1537`, `SR_MODES` `:1509`; `e2e.py:76`, `:101`, `:106-109`, `:124-128`)

All media ran through `make -C apps/capture-worker e2e E2E_ARGS="--ports 8559,8561 --only ..."` (heavy-host lock).

**M3-AV-2 case (c) - 2 runs, PASS** (series `row62_baseline`, load 2.8-4.6):

| Check | cam1 (+200 ppm media clock) | cam2 (-200 ppm) | Verdict |
|---|---|---|---|
| `av2c_srdrift_200ppm_r1` | max err 0.136 ms, slope -0.22 ppm | 0.069 ms, -0.09 ppm | PASS |
| `av2c_srdrift_200ppm_r2` | 0.128 ms, +0.03 ppm | 0.067 ms, -0.03 ppm | PASS |
| `neg_av2c_reports_without_rate_r1` | 6.017 ms, +199.78 ppm | 6.379 ms, -200.09 ppm | FAIL as required (on `av_regression_2ms`, `drift_slope_near_zero`) |
| `neg_av2c_reports_without_rate_r2` | 6.036 ms, +200.09 ppm | 6.360 ms, -199.78 ppm | FAIL as required |

Slope tolerance 71.4 ppm (2 ms over the 28 s span of the 7 judged events). One more PASS on the
in-tree worker as row 59 had it at 17:20 (`row62_intree`: +0.09 / -0.02 ppm).

Which worker: runs 1-2 above are on the **row-60 sources built outside the tree** (scratch build,
`--variant proposed` pointing at it), because row 59 rebuilt `build/capture-worker` mid-wave (16:49)
and moved the shared harness to protocol 3 (17:11). An earlier pair on the in-tree 16:31 binary is in
`e2e_row62_av2c_b_summary.txt` (r1 PASS; r2 failed on `both_files_playable` - the finding below, fixed
in the check, not in the worker).

**Finding (not a defect of the worker):** a camera placed by its true time has frames that are not
on the nominal 20 ms grid. `playable()` decodes at 1/50 s, where two such frames can share a tick;
ffmpeg then reports a non-increasing dts of its own output. The file's dts are strictly increasing
(checked). Row 62's check decodes at the file's time base (`playable_own_timebase`, `m3worker.py:1523`)
and records `playable_at_nominal_grid`. Relevant to playback / export (M8).

**`nearBound` and the sanity bound - checks built, worker change REQUESTED:**

| Check (e2e name) | Today (row-60 worker), 2 runs | With the proposed change (scratch build), 1 run |
|---|---|---|
| `want_r2_near_bound_steady_delay` (correct clock, steady 35 ms delay) | FAIL as required: nearBound true on 700 of 828 frames, lagMs 55.1 | PASS: 0 of 826 |
| `want_r2_near_bound_clock_step` (same delay; camera 1 clock +100 ms at second 8; 81 s) | FAIL as required on all three criteria (true from the start, also for the steady camera; false again from second 64) | PASS: false until second 67, true from 68; steady camera never |
| `want_f6_camera_clock_sanity_bound` (camera 1 clock +10 s) | FAIL as required: 1,600 video packets recorded 10 s wrong, no fault (run 2 of 2 lost to the protocol bump; a third run in `row62_c2b` agrees) | PASS: `camera_clock_out_of_bound lag_ms -9455.8`, warn `CAMERA_CLOCK_OUT_OF_BOUND`, CAPTURE_FAULT CAM-01, 0 video packets, camera 2 within 0.04 ms, exit 0 |

The three `want_*` lines are in the series as expected-FAIL with exact criteria, so the plain series
stays green today and turns UNEXPECTED the moment the worker change lands (then: plain form).
`proposed_srcam_*` appear only with `M3_WORKER_PROPOSED` set. Plain series: 88 checks (was 82).

### C.3 What `nearBound` means after the rework (definition, D58-7 / D85 R-2)

- `nearBound` = the lag of the best arrival of the last 10 s is 30 ms or more away from this
  camera's **baseline** (best arrival of the first 5 s that had packets). False until learnt.
- The lag is measured against where the worker PLACES the video (the slew-limited anchor), so it
  answers "has the video placement moved 30 ms": a clock step shows at the slew rate (500 us/s:
  30 ms after 60 s), not at once. Measured: one receiver-side frame (20 ms) is in every lag, so the
  old absolute 30 ms flag had 10 ms of room for encode + network - it would read true for real IP
  cameras, as R-2 said.
- Blind spot, by construction: an offset already present at the start is part of the baseline.
  Gross ones are refused at anchoring by the sanity bound (2,000 ms; allowance for the time a packet
  waited since the stream opened; re-checked without allowance on the first live packet). Between
  30 ms and 2 s nothing on this path can tell a wrong clock from a delay: class C (H-7, NTP).
- Telemetry shape unchanged (`lagMs`, `trendPpm`, `nearBound`): no protocol change.

### C.4 The requested change

`evidence/24_m3_b11_instrumentation/row62_worker_clock.patch` (221 lines; anchor.h, anchor.c,
ingest.c, audio.c comment, anchor_test.c cases (2)-(2d)). Built and run outside the tree: unit
checks hold, `check.sh` static rules OK on the patched sources. Base = row-60 sources, sha256:
`anchor.c 32758a83…`, `anchor.h 837d776f…`, `ingest.c 4346b093…`, `audio.c ce8e11cf…`,
`anchor_test.c b861610d…`. Against the tree at 17:20: 2 of 4 `ingest.c` hunks need re-seating on
row 59's file. Request lines: `delegation_progress/file_requests.md` (10:14:20Z, four lines).

## D. Commands and results

| What | Command | Result |
|---|---|---|
| mobile jest (touched + session-live + route sync + runtime static) | `npm run test -w @dems/mobile -- src/runtime/session-diagnostics.test.tsx src/features/session-live src/runtime/session-route-sync src/runtime/*-static.test.ts --maxWorkers=2` | 21 suites, 162 tests passed |
| mobile typecheck / lint | `npm run typecheck -w @dems/mobile`; `npm run lint -w @dems/mobile` | 0 errors; 0 errors, 1 warning (`log.test.ts:160`, not this row's) |
| system module unit | `npx vitest run --root apps/core-server --project unit src/modules/system` | 3 files, 123 passed |
| system module db (under `.locks/db-migrate.lock`, sandbox off) | `npm run test:db -w @dems/core-server -- src/modules/system/__tests__/{system,effects}.db.test.ts` | 2 files, 35 passed |
| core-server static guards | `npx vitest run ... test/static src/capture/__tests__/static.test.ts` | 288 passed, 4 failed - all in other rows' in-flight files: `src/capture/adapters/local/{process-door.ts,pipe-files.ts,__tests__/mic-helper.generated.test.ts}` (rows 134/135) |
| core-server typecheck / lint | `npm run typecheck -w @dems/core-server`; `npm run lint -w ...` | this row's files clean; at one point 1 error in `src/capture/adapters/local/camera-helper-args.ts:54` (row 134), gone at the last run; lint 1 warning in `src/capture/signer/host-key.ts` (row 83) |
| capture e2e (row-62 cases) | see C.2; summaries in the evidence folder | as tabled |

## E. To wire when another row lands

| Row | What |
|---|---|
| 59 (worker owner) | the patch of C.4; then the three `want_*` e2e lines to plain PASS; `check.sh` fixture list gains `fake_cam_sr.py` |
| 115 (transcriber mounted in the Core) | pass `transcriber: () => ({ state, startedAt })` where `systemModule` is registered (a waived `app.ts` edit) or provide it another way; nothing else changes in the module |
| engine / shared simulator owner | the two processes in the REPLICATED `services` slice (B.3 item 1) |

## F. Device / browser checks left for the gate (not run: lanes and emulators stopped)

One scripted flow, tablet lane 2 (`dems2_tablet`), release build preferred, host load < 4:

1. Start a recording on the tablet; stop it from the web after about 11 s (the RF2-2 shape). 2 runs + 1.
2. After each run read `dems.mobile.log.v1`: one `runtime.diag.lateStop` and one
   `runtime.diag.lateStop.handover` for the session. Cite `coreStoppedAt` against the Core log's stop
   line (same clock), `storeAtCore`, `commitAtCore`, `handoverAtCore`, `waitPoint` and the counters.
3. M3-RG-MOB: the mobile suite with this instrumentation in (the controller's per-commit run).
4. Same flow on the phone lane as the control (RF2 showed 0.3-2.2 s there).

The same records serve M5-SW-T (the switch from the tablet) as the timing reference of the tablet.

## G. Decisions taken (for the controller)

| # | Decision | Why |
|---|---|---|
| 1 | Capture worker surfaced on the existing `Recording Engine` entry, no 18th service | brief: `CORE_SERVICES` is row 78's; no second entry |
| 2 | Transcriber "not configured" = `STOPPED` + `startedAt null` on the wire | the contract has three statuses; a fourth is a contract change |
| 3 | Read-time overlay on read 64 only (B.3) | the module may not add engine actions; app.ts frozen |
| 4 | CLOSED supervisor = `Recording Engine` STOPPED (so test apps that do not boot capture read STOPPED) | a supervisor that refuses every start is stopped; the entry point boots it before listening |
| 5 | Part C started on row 60's `needs-review` report (not `complete`), after the coordinator's message that row 60 had landed | the report was final; ownership per D95 section 6 followed from then on |
| 6 | `nearBound` keeps measuring against the slew-limited anchor; the step check is 81 s long for that reason | it is the placement of the video that the product bound is about |
| 7 | `want_*` checks sit in the series as expected-FAIL | keeps the aggregate green now and forces the flip when the worker changes |
| 8 | Before D95 reached this row, `apps/mobile/src/runtime/index.ts` got its one added line by a scripted exact-match insert (diff: +2 lines, 0 removed); two later edits inside row 62's own block of `m3worker.py` were also scripted exact-match replacements | reported for the map's rule 1; no other line moved |
