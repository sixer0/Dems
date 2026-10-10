---
task_id: 2026-10-07_dems_real_capture_sealing
row: 140 (NEW SCOPE R-11, M5)
date: 2026-10-10
agent: coder-execution
baseline: e296ce7 + wave D in the tree
status: needs-review (software built and proven on FAKE sources; five seams wait on other owners; nothing run with a real device, in a browser or on an emulator)
tier: 3
---

# 71 — Row 140: development sources in a recording session, and their surfaces on the clients

No commit, no migration, no emulator / adb / browser / build. **No camera and no microphone was
opened, listed for a session, or asked for by any run of this row**: every run used the generated
sources or the scripted process door. Nothing under `.data/capture-local/` was read. Server paths are
below `apps/core-server/`.

## 1. What was built

| # | What | Where |
|--|--|--|
| 1 | Fence: `probeAdapters()` (the adapters the reachability probe asks; the LOCAL camera is asked by ONE short open and is "on" for that moment) and `onOpenSourcesChanged(listener)` (told at every open, close and loss of a local source). The two local adapters are registered through thin wrappers; the adapters and every production helper argument are unchanged | `src/capture/fence/index.ts` (`CaptureProbeAdapters`, `buildDevelopmentRegistry`, `CaptureFenceControl`), `fence/sources.ts` (`tellEach`, `whileShortOpen`: kept out of the file that builds test sources, rule G-R14) |
| 2 | Device reads 44-47 follow the STORED selector (they answered the built-in pair whatever the selector said): `captureSlotsOf(state)` is the default of the four builders | `src/modules/devices/status.ts`, `index.ts` |
| 3 | D136 (3): row 60's fixed-grid check of a camera run is REPORTED "not applicable - variable-rate development source" with the count of close frame pairs (< 16.67 ms) for this Mac's camera; unchanged ("pass" / "fail", applies) for a fixed-rate source. Its raw result stays in the report | `src/capture/adapters/local/__tests__/e2e/camera_run_numbers.py` (`fixed_grid_report`), `local_camera_e2e.py` (`decodes`) |
| 4 | Web: roster cards for every camera / microphone of the Core's device list beyond the four built-in ids (D137 (2)), with the one badge, the 'is on' line, "used as", the local-device state + sentence, the NAMED rate warning, "View device" (a drawer of the Core's facts + the source's limit) | `apps/core-web/src/features/devices/registered-devices-model.ts`, `registered-devices.tsx`, `registered-device-drawer.tsx`, mounts in `index.tsx`, one block in `devices.css` |
| 5 | Tablet / phone: the same as rows inside the Camera Devices / Audio Inputs sections and a detail body for the pane / screen ("Core Mac's camera / microphone") | `apps/mobile/src/features/devices/registered-devices-model.ts`, `registered-device-rows.tsx`, `registered-device-detail.tsx`, mounts in `devices-screen.tsx`, `device-detail.tsx` |
| 6 | Copy: ONE appended block `common.developmentRoster` (names, "used as", the rate warning, the limits, the fact labels) | `packages/shared/src/i18n/en/common.ts` (end of the tree) |
| 7 | D131 pin (controller decision D156) | `src/modules/devices/__tests__/source-class.db.test.ts` |
| 8 | The generated test camera is paced to 30 frames per second (finding F-7) | `src/capture/adapters/local/camera-helper-args.ts` (`GENERATED_INPUT`) |
| 9 | The end-to-end check of this row, and inside it the USER's attended mode (never run) | `src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts` |

## 2. Found on the way (each measured)

| # | Finding | State |
|--|--|--|
| F-1 | **No production code started a microphone helper.** `open()` only prepares the pipe; `stream.start()` (ML-5) was never called, so every development session recorded with no microphone samples. Measured twice: scripted door (0 helper calls for 2 pipes) and the BUILT worker on generated sources (its log: `no_mic_delivers_samples`, 2 x `MIC_DISCONNECTED`). Row 82b's end-to-end run could not see it (it asserts intervals, not samples) | FIXED by row 71c on this row's request (16:49:46Z); the two cases are plain checks now |
| F-2 | On a REAL_DEVELOPMENT Core the four built-in TEST sources are listed with no `adapter` / `sourceClass` (the built-in exception of `db/mapping/rows.ts`), so no client can badge them "Test source". The session's four source rows and the sealed item ARE marked `FAKE` | OPEN: request to pass D4 (16:37:10Z); two `it.fails` cases hold it and go red the day it is fixed |
| F-3 | `captureNotices(app).provideProbe(...)` is called nowhere: in real capture the pre-check asks no adapter and operation 97 answers 503, so a local-device row never reads Ready / Permission needed / In use / Not found from the Core | OPEN: the fence now offers `probeAdapters()`; the one call is requested (16:28:30Z; the fence cannot import that unit: a cycle) |
| F-4 | The advisory alert `MIC_RATE_AT_LIMIT` (contract of pass D1b) is raised by nothing: the capture unit's notice sink writes the log and the error log only | OPEN: request (16:28:30Z). Until then the operator sees the worker's bare `CAPTURE_FAULT` on that microphone |
| F-5 | `sourceOpen` is not a member of the shared device shape | OPEN: request to pass D4. The clients read it as an optional member and draw nothing while it is absent |
| F-6 | The STANDBY microphone starts about 2 s after the primary (the session wiring starts the helpers one after the other, each waiting its 1.5 s settle): 96,000 samples missing on microphone 2, one `MIC_DISCONNECTED` raised and cleared, the cameras opened after both | OPEN: request to row 71c (17:17:40Z). The sequential loop was this row's own proposal: the error is this row's |
| F-7 | **The generated camera of the product table was not paced** (`-re` cannot hold back an input stamped with the wall clock at reading): 9,124 frames in 2 s from the program alone; through the worker about 800 video packets per second, 190-258 MB per camera file in 10 s, fragments up to 111 MB > the 64 MiB a seal accepts. A likely cause of row 82b's unexplained red (D153) | FIXED here: `realtime` inside the graph (`src/capture/adapters/local/camera-helper-args.ts` `GENERATED_INPUT`); 60 frames in 2 s; run 4 of check 3. The DEVICE input and every microphone argument are untouched |

## 3. Known state (a): the local microphone (D128)

Not changed and not claimed fit. A session with `MIC-03` as primary STARTS (section 4, check 2). At the
limit of the rate controller: the forwarder's notice names `MIC-03` (`CAPTURE_MIC_RATE_AT_LIMIT`,
value -5,000, bound 5,000), the worker's warning is a capture fault on `MIC-03`, and the engine accepts
the named advisory for it (`MIC-03: rate correction is at its limit`, kind SYSTEM, severity INFO) — the
clients draw "Rate correction at its limit (MIC_RATE_AT_LIMIT)" from that alert. Flow 12 of the UX spec
has NO place for a source's limits; the wording is therefore new copy (decision 2 below):
"Not fit for recording yet. In measured runs this microphone delivered about 8/9 of the sample rate it
declares; the cause is not proven. Expect the warning MIC_RATE_AT_LIMIT during a session. Use it for
development checks only." It is shown in "View device" of the local microphone, in real capture only.
Local camera (known state (b)): "Variable frame rate: each frame carries the time it was read. The
fixed frame-grid check does not apply to this source."

## 4. Commands and results (each once after its last change; a repeat only after a fail)

| # | Check | Command | Result |
|--|--|--|--|
| 1 | Local adapters + fence unit (existing + `open-sources.test.ts`) + the two capture static guards | `npx vitest run --root apps/core-server --project unit src/capture/adapters/local src/capture/fence src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts` (sandbox off: `mkfifo`, `ps`) | 15 files, 309 passed, 1 failed = the foreign A-5 below. The class refusal (a LOCAL_DEVICE / FAKE source in REAL_PRODUCTION, a production source in REAL_DEVELOPMENT) is confirmed by the existing cases of `fence.test.ts` (M4-LOCAL-SEL-1, "a mixed production plan is refused", boot rows 7 / 8); not rebuilt |
| 2 | `M5-LOCAL-E2E-1`, Core half with scripted helpers: selector CAM-03 / MIC-03 + CAM-02 / MIC-02 through the product registry; four source rows (LOCAL_DEVICE x2, FAKE x2); plan, helper calls, durable, 'is on' sequence, clean stop; rate limit said | `/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/capture/fence/__tests__/development-session.db.test.ts` | see section 4a |
| 3 | The same with the BUILT worker and GENERATED sources, to the sealed item and operation 41 | section 8, first row | see section 4a |
| 4 | D131 pin | `/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/modules/devices/__tests__/source-class.db.test.ts` | 4 passed, 1 expected fail (F-2). SIMULATED: 0 built-in devices carry `sourceClass` / `adapter`, no read holds either key (demo controls on and off; also with stored local / production rows). Control: REAL_DEVELOPMENT lists CAM-03 / MIC-03 as LOCAL_DEVICE / DEVELOPMENT. REAL_PRODUCTION: four production devices PRODUCTION, 0 development marks. **No defect in SIMULATED** |
| 5 | Devices module unit + its static guard | `npx vitest run --root apps/core-server --project unit src/modules/devices test/static` | green (96 in the module; `test/static` green) |
| 6 | D136 report | `npx vitest run --root apps/core-server --project unit src/capture/adapters/local/__tests__/camera-run-numbers.test.ts` | 11 passed (control: a fixed-rate source still reads "fail") |
| 7 | Fence db (existing, subject touched) | with check 2: `... src/capture/fence/__tests__/fence.db.test.ts` | passed (14) |
| 8 | Web | `npm run test -w @dems/core-web -- --maxWorkers=2 src/features/devices/__tests__/registered-devices.test.tsx src/features/devices/__tests__/devices-page.test.tsx` | 15 + 17 passed |
| 9 | Mobile | `npx -w apps/mobile jest --maxWorkers=2 src/features/devices` | 9 suites, 79 passed (the folder's file-list pin moved by this row's three files) |
| 10 | Shared copy | `npx vitest run --root packages/shared test/i18n.test.ts test/i18n-vocabulary-sync.test.ts` | 50 passed |
| 11 | Typecheck | `npx tsc --noEmit -p apps/core-server` (0 errors in this row's folders), `npm run typecheck -w @dems/core-web` (0 in `features/devices`; 7 in row 139's `situation-c.test.tsx` at the time, since fixed by pass D7), `npm run typecheck -w apps/mobile` (0) | as stated |
| 12 | Lint | `npm run lint -w @dems/core-server`, `-w @dems/core-web`, `npx -w apps/mobile eslint src/features/devices` | 0 findings in this row's files |

Foreign red seen: `src/capture/adapters/__tests__/static.test.ts` A-5 names `src/capture/index.ts:44`
and `src/sealing-host/index.ts:41` (not this row's files).

### 4a. The two session proofs

**Check 2 (scripted helpers, `FakeWorkerProcess`), last run 4 passed + 1 expected fail (F-2):** four
source rows `MIC-PRIMARY MIC-03 LOCAL_DEVICE`, `MIC-STANDBY MIC-02 FAKE`, `VIDEO-01 CAM-03 LOCAL_DEVICE`,
`VIDEO-02 CAM-02 FAKE`; ONE worker, ONE START; the local camera pushed by its exact listed name to
port 8554, the test camera a generated picture to 8556; one helper per microphone pipe; 'is on'
sequence `[MIC-03]`, `[CAM-03, MIC-03]`, then `[]` after the stop; start interval names `MIC-03`;
durable; clean stop, every helper signalled, both pipes removed.

**Check 3 (BUILT worker, generated sources, heavy-host + db locks, ports 8554 / 8556), four runs:**

| Run | Tree | Result |
|--|--|--|
| 1 | before row 71c's line | passed as written then (start, durable, stop, sealed, verify PASS, `developmentSources: true`) — and the worker's log proved F-1 (`no_mic_delivers_samples`); camera files 220 MB each (F-7, not yet noticed) |
| 2 | 71c's line in | FAIL: this row's event-order assertion was too strict (`DURABLE` may come before `STARTED`) — the test was corrected |
| 3 | same | FAIL at the seal: `FRAGMENT_TOO_LARGE` (fragment 111,220,417 bytes > 67,108,864) = F-7 |
| 4 | F-7 fixed | **PASS**: 2 passed, 1 skipped (the attended mode). Session start -> durable -> 6 s -> stop -> SEALED; four FAKE source rows; 2 camera helpers and 2 microphone helpers while recording; 0 local sources on at any time; 0 microphone faults at the sample; 0 processes left; item `developmentSources: true`, `integritySource: REAL`; operation 41 PASS, `sources.code: DEVELOPMENT`, tracks `CAM-01 FAKE`, `CAM-02 FAKE`. Worker summary: 219 / 174 video packets, files 7.2 MB / 5.8 MB, keyframe interval 1,000 ms / 1,010 ms; microphone 1 missing 0, microphone 2 missing 96,000 samples with one `MIC_DISCONNECTED` raised and cleared (F-6) |

The attended mode of that file (`DEMS_LOCAL_SESSION_ATTENDED=1`) has NEVER been run. Its two
LOCAL-only branches ("blocked: user action") are typechecked only.

## 5. Real vs stand-in

Real: the fence registry builder, the local and generated adapters and helpers' logic, the
capture-session unit, plan builder, supervisor, forwarder, engine, PostgreSQL as `dems_app`; in check 3
also the built worker, the helper program with generated inputs, sealing and verify. Stand-in: the
worker in check 2 (`FakeWorkerProcess`); the helper program in check 2 (scripted door; only `mkfifo` is
a real process); "real capture" in the web / mobile component tests (the console's Live rule switched
through its one function; the Live transport is not exercised).
NOT proven: any run with this Mac's camera or microphone; the product through TCP with a paired tablet;
anything in a browser or on a device.

## 6. To wire when the open requests land

- F-2: remove `.fails` in `development-session.db.test.ts` ("the development mark of the TEST sources") and `source-class.db.test.ts` (one word each).
- F-3: nothing in this row's files; the local-device states then come from the Core.
- F-4: nothing in this row's files; the roster already reads the alert.
- F-5: nothing in this row's files (`isLocalSourceOn` / `rosterOnKey` read the member).
- F-6: nothing in this row's files; the end-to-end check then shows `missing: 0` for both microphones.
- Rows 82b / 86 / the kill matrix: re-read any size or timing measured on generated sources before F-7 was fixed.

## 7. Browser / device flows for gates 70 and 75 (not run)

| Flow | Client | Steps | Check IDs |
|--|--|--|--|
| W-ROSTER | web | development Core -> Devices: cards CAM-03 / MIC-03 under the two panels, badge + "This Mac's ...", "used as"; View device -> drawer with the limit; a simulated Core: 0 cards, 0 badges | `M4-DEVSRC-LOCAL`, W-DEVSRC of gate 70, D131 |
| T-ROSTER / P-ROSTER | tablet, phone | the same rows in MB-08 / MB-09 with "Core Mac's ..."; tap -> detail pane / screen | F6 of gate 70 |
| W/T/P-ON | all three | start a development session on the local devices (THE USER, attended): the fixed line "... is on" on each client while recording, gone after the stop | `M5-SEC-PRIV-2-W` / `-T` / `-P` (blocked on F-5) |
| W/T/P-RATE | all three | same session: the named warning on the microphone card / row | known state (a) (blocked on F-4) |
| DEV-SESSION | web + tablet | development session on the FAKE sources through the UI: connecting -> recording -> stop -> sealed item with the development mark; Verify says DEVELOPMENT SOURCES | `M5-LOCAL-E2E-1` (+1 at row 75), `M5-SEC-SRC-1` |
| CLAP | the user | attended, section 9 | `M5-LOCAL-CLAP-1` (not run) |

## 8. Checks for the test runner

| Command | Lock | Expected | IDs |
|--|--|--|--|
| `DEMS_DEV_SESSION_E2E=1 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock /usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts` (sandbox off; 127.0.0.1:8554 and 8556; generated sources; NEVER with `DEMS_LOCAL_SESSION_ATTENDED`) | heavy-host + db-migrate | 2 passed, 1 skipped; `row140-result.json` in the fixture directory says `verdict: pass`, 2 microphone helpers, 0 microphone faults | `M5-LOCAL-E2E-1` (FAKE) |
| `npm run test -w @dems/core-web -- --maxWorkers=2 src/features/devices src/test/live-devices-*.test.tsx` | none | green (the Live beds mount the page this row edited; not run here) | W-DEVSRC component half |
| `/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/modules/devices` | db-migrate | green (the four reads now take the stored selector) | — |

## 9. The user's attended run (NOT run by any agent)

Section "For the user" of `delegation_progress/coder_execution_row140.md`.

## 10. Decisions taken

1. The roster is "every CAMERA / MIC of the Core's list that is not one of the four built-in ids"; the built-in tiles and rows are untouched. In Simulated client mode the cards appear for a camera added in the simulator, without badge (D83).
2. New copy outside the spec's key list (flow 12 names no place for limits): the block `common.developmentRoster`. To the review row for wording.
3. A local device's name and state use the existing D83 / §8f.3 keys; an added camera is named "Camera CAM-04" and its announced model is shown only as a fact (untrusted text).
4. The probe wiring and the alert raise are NOT done from the fence (unit cycle; another owner's sink): offered and requested instead.
5. Left under `.data/` by this row's runs (generated content only, nothing deleted by this row): `test-row61-row140-*`, `test-row61-row140d131-*`, `test-row61-row140e2e-*` (four runs; the first three hold 190-258 MB camera files of the unpaced test picture — about 1.3 GB in all; removal is the controller's or the user's call). `fence.test.ts` (existing) creates and removes its own `fence-test-*` directory there, as before.
6. Out-of-map edits: `packages/shared/src/i18n/en/common.ts` (one appended block), `apps/mobile/src/features/devices/devices-live-static.test.ts` (file list by delta).
