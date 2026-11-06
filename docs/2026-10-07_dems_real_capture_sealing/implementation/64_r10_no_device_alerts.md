---
task_id: 2026-10-07_dems_real_capture_sealing
row: 133
date: 2026-10-09
agent: coder-execution
status: needs-review
---

# Row 133 — R-10 no-device notifications (situations A and B), operation 97, pre-check rule

Status **needs-review**: everything of the row is built and tested; three things are not live
until another row makes one call each (section 4). No commit, no migration, no new dependency.

## 1. What was built

| Part | Where | What it does |
|---|---|---|
| Notices in the session machine | `packages/shared/src/sim/capture-notices.ts` (new) | `raiseCaptureNoticeTransition` / `clearCaptureNoticeTransition`: alert kind `SYSTEM`, WARNING, told apart by `params.reason`; at most one active alert per (reason, target); a raise while active returns the same state; a clear writes no audit row; `CAPTURE_DEVICE_UNREACHABLE` writes one audit row with exactly the six keys of C3 §5.2; ids, counts and codes only (the alert text names the device ID, never the label). Nothing enters `faults.active`, so demo ops 73 / 74 cannot inject or clear them |
| Start rule (D80(6), D83) | same file, `captureReachabilityOf`; `session-machine.ts` `unreachableSource` and the cases `MIC_PRIMARY` / `MIC_STANDBY` of `evaluatePrecheck` | both cameras unreachable = BLOCK; one = WARN; PRIMARY (active) mic = BLOCK whatever the standby; STANDBY = WARN; both mics = BLOCK. "Reachable" = `captureDevices.devices[].online`. A lens fault still blocks as before |
| `PRECHECK_ORDER` (D101(2)) | `packages/shared/src/sim/vocabulary.ts` | `MIC_1` / `MIC_2` -> `MIC_PRIMARY` / `MIC_STANDBY`, still eight; the old ids stay valid and still answer |
| INTERNAL path | `sim/types.ts` (`CaptureWarningInput` is now a union), `sim/actions.ts` (two-line dispatch), `sim/index.ts` (one export) | the notices travel through the existing `raiseCaptureWarning` / `clearCaptureWarning` |
| Notifier (closed unit) | `apps/core-server/src/capture-notices/notifier.ts` | `searchClosed` (A), `deviceUnreachable` / `deviceReachable` (B), `devicePresence`, and for rows 71 / 139: `notifyNoCameraConnected`, `notifyCameraNotConnected`, `cameraConnected`, `camerasAvailable`. Never throws into its caller; a failure goes to the log and the persistent error log with ids only |
| Reachability probe | `capture-notices/probe.ts` | seam `CaptureReachabilityProbe` + `probeOfAdapters`: a microphone = `enumerate()` (no device opened, no socket), a camera = one bounded read of its adapter; the named cause only when the error carries one of the five codes |
| Pre-check gate + search hook | `capture-notices/precheck.ts` | before the hosted action: asks every configured source, writes `online`, resolves alerts of devices that answer, raises mic alerts at once, starts the ONE search of the run for the starter's operator session (no permission asked) and raises the camera alerts when it closed, with `searchResponderCount`. Own allowance: one per run, none while its own search is open. A search that is not started or fails never fails the pre-check |
| App access | `capture-notices/index.ts` `captureNotices(app)` | one object per app, built on first use; `provideProbe`, `provideDiscovery`. `app.ts` not touched |
| Operation 97 | `apps/core-server/src/modules/capture-inputs/{index.ts,routes.ts}` | re-read of the local inputs; one entry per registered microphone; 429 `INPUT_RESCAN_RATE_LIMITED` with `retry-after` (5 s per Core, Core clock); 503 `CAPTURE_NOT_READY` in real capture without a probe; one `CAPTURE_DISCOVERY_SEARCHED` row `scope: MIC_LOCAL`; `online` of the mics written when it differs; raises and resolves no alert |
| Call site of the gate | `apps/core-server/src/modules/sessions/routes.ts` | ops 25 (from CREATE), 28, 29 call `captureNotices(app).beforePrecheckOf(request, id, kind)` before their unit |
| Static guard | `apps/core-server/test/static/imports.test.ts` | `src/capture-notices` in `CLOSED_UNITS` |

## 2. Decisions taken (for the controller)

1. **No new `SimActions` member.** C3 §5.4 asks for "an INTERNAL raise / resolve path of their own". It is built as further members of `CaptureWarningInput` on the existing INTERNAL pair, dispatched before the fault path. Reason: a new member touches about twenty files of other rows (engine host and types, the live-source bindings, six test doubles) and moves the sim-action pin while row 132 was writing the same shared files. Cost: the action name says "warning" for a notice. The pin "internal 4" did not move.
2. **A third phase `PRESENCE`** (sim input only, never in an alert or audit row): records `online` and nothing else. Used by op 97 and by the gate while the search of a run is open.
3. **A camera's alert is raised when the search of the run closed**, not at the request: alert `params` cannot be updated after insert (`RUNTIME_UPDATABLE_COLUMNS.alerts` = active, acknowledged, resolvedAt), so the count must be known at the raise. The check row itself reads WARN / BLOCK at once.
4. **No new pre-check reason code.** `PrecheckReasonCode` is an enum of the OpenAPI. An unreachable item carries `reasonCode: null`, `value: 'UNREACHABLE'`, `params { deviceId, deviceKind, rule, other? }` (`rule` = suffix of `captureNotice.start.*`). Operation 27 carries only `value` and `reason`; the `session` slice carries `params`.
5. **A re-read (op 97) resolves no pre-check alert** (C3 §5.4: "a later pre-check run").
6. **Op 97 search id** = `DSC-` + the Core clock in ms (13 digits): fits the pattern, cannot equal an id of row 132's counter.
7. **A FAILED search neither raises nor resolves** situation A.
8. The sessions module gained one import (`../../capture-notices`); its static pin lists it. The request is handed on whole, so rule M3 ("reads no member of the principal") holds unchanged.

## 3. Verification (commands from the repo root)

| Check | Command | Result |
|---|---|---|
| Notices + start rule (simulator) | `npx -w packages/shared vitest run test/sim-capture-notices.test.ts` | 19 / 19 |
| Every shared test that names the pre-check | 29 files | 851 / 851 |
| Notifier, probe, gate on a real simulator + fakes | `npx -w apps/core-server vitest run --project unit src/capture-notices` | 21 / 21 |
| Op 97 without a database | `… --project unit src/modules/capture-inputs` | 10 / 10 |
| A, B, op 97 on PostgreSQL as `dems_app`, real engine, real stages | `/usr/bin/lockf -k .locks/db-migrate.lock npx -w apps/core-server vitest run --project db src/modules/capture-inputs/__tests__/no-device.db.test.ts` | 4 / 4, run 3 times (2 + 1 after the contract landed) |
| Sessions db tests after the route edit | `journey.db`, `operations.db` | green |
| Web session-new | `npx -w apps/core-web vitest run src/features/session-new` | 20 / 20 |
| Mobile session-new | `npm test -w apps/mobile -- src/features/session-new` | 97 / 97 |
| Typecheck | shared, core-server, core-web, mobile | core-server, core-web, mobile exit 0; shared: one error in `test/evidence-package.test.ts:453` (row 83's file) |
| Lint | core-server, shared | no line in a file of this row |

What the database test shows: an empty search stores one alert, the trail does not grow, one publication of `alerts` for five searches, a non-empty search resolves it, the next is a new alert; one camera stopped with an INVESTIGATOR starting: WARN, one search owned by that operator session, one alert with the count, one `CAPTURE_DEVICE_UNREACHABLE` row (six keys, `degraded: true`), retry while stopped adds nothing, reachable resolves with no row, the next occurrence is a new alert and a second row; both cameras = BLOCK and `409 PRECHECK_BLOCKED` on start; active mic = BLOCK with 0 searches; standby = WARN; op 97: SUPERVISOR and TECHNICIAN 200 with one row each, INVESTIGATOR 403 with one `ACCESS_DENIED` row, 429 with no row; stored state equals committed state and the chain verifies after each step.

Negative controls: each test carries its own (named in the test). One mutation was run: removing the "raise while active" rule turns 1 shared test and 2 server tests red; restored.

Red tests that are not this row's: `test/static/imports.test.ts` "every closed unit exists and has an index" (`src/modules/capture-discovery` has no index yet, row 132); sessions `routes.test.ts` MODG x2 (baseline); `engine/__tests__/capture-actions.db.test.ts` A-4 (`src/transcription/boot.ts`, `CPU_LOCAL_RUNTIME_MISSING`).

Not proven: nothing ran against a real adapter wiring, a real search or a client; the discovery service in the tests is a stand-in that counts its calls.

## 4. To wire (requests are in `delegation_progress/file_requests.md`)

| When | What | Until then |
|---|---|---|
| controller / integration pass | `app.ts`: register `['modules/capture-inputs', captureInputsModule]` (+ pins of routes under `/api/v1/capture/`) | op 97 answers 404 on the real server |
| row 132 | call `notifier.searchClosed(...)` for every closed camera search; `provideDiscovery({ runPrecheckSearch })` with the pre-check's own allowance | situation A is not raised by op 93; pre-check camera alerts carry no count |
| rows 71 / 136 | `provideProbe(probeOfAdapters(...))` | the gate asks nothing; op 97 = 503 in real capture, the state answer in simulated capture |
| row 139 | `reason: NO_CAMERA_CONNECTED` / `evidenceFiles: 0` on the `FAULT_RAISED` row; calling the four session-start methods | `notifyNoCameraConnected` raises a plain `CAPTURE_FAULT` |
| rows 137 / 138 | draw an `UNREACHABLE` item from `params.rule`; today web `reasonKeyFor` and the mobile model fall to "lens fault" / "no signal" | wrong sentence on an unreachable row |
| later | op 97 lists only microphones an adapter serves: a registered mic with no adapter is omitted, because `CaptureDeviceStatus` has no `adapter` member to answer with | accepted limit |

## 5. Client follow of `PRECHECK_ORDER`

Web `devices-step.tsx` and the mobile session-new files already carried both id pairs (rows 67 / 68): no production line changed. Followed in tests only: web `session-new.test.tsx` (2 lines), mobile `precheck.test.tsx` (2 lines) and `session-new-screen.test.tsx` (1 line), shared `session-machine.test.ts`, `sim-faults-scenarios.test.ts`, `sim-gap-closure.test.ts` (1 line each): the same assertion on the role-keyed id.

## 6. Device / browser checks left for the gate (not run)

- Flow A (`M4-NODEV-B-W/T/P`, `M4-MIC-ACTIVE-*`): pre-check with one fake camera stopped, both stopped, active mic removed, standby removed; three clients; one alert in the Core.
- Flow B (`M4-DISC-EMPTY-W/T/P`): empty search banner, "Search again", cleared by a later search.
- Flow C (`M4-MIC-RESCAN-W/T/P`, `M4-NODEV-NOCFG-T`): op 97 from each client; the operator without `CAPTURE_CONFIG`.

## 7. Process notes

- Three of my edits to files outside my own new files were made with a scripted exact-string replace instead of the Edit tool (`session-machine.ts` two lines, `sessions/routes.ts` my own helper). No reformat; the diffs are the lines named above.
- `masterplan/02_plan.md` and `status_tasks.md` were not edited (driver rules D94: controller's files).
