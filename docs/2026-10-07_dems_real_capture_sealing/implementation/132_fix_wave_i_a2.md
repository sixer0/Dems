---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave I, driver A2 (findings of re-gates 70 and 75; decisions D215, D216)
date: 2026-10-10
agent: coder-execution
narrative_tier: 2
tree: 74fd1f1 + the working tree of wave I (drivers A1, B, C in parallel); no commit, no migration (schema 6 / dbc-7)
status: needs-review
---

# 132 - Fix wave I, driver A2: capture adapters, capture-config, discovery, sending device, start after a stop

Status `needs-review` for two reasons, both in section 4: G75b-03 is fixed for the case the gate
saw (a session that is FINALIZING) and not for the four other in-flight states; G70b-06 has no
server change. Everything else is closed with a failing-first test.

Lanes were down for the whole pass; none was started. No local-device source was selected,
pre-checked or started; no network device was contacted (every socket of the stub tests on
127.0.0.1 behind the loopback guard). No git write. `.data/pg*.env` never read.

## 1. Findings

| Finding | Reproduced (red)? | Root cause (file:line at 74fd1f1) | Fix | Test | Status |
|---|---|---|---|---|---|
| **G70b-01** adopted camera refused until a restart | YES - `wave-i-a2-adopt-assign.db.test.ts` on a BOOTED `REAL_DEVELOPMENT` Core: `expected 200, received 422` | `capture/fence/index.ts:228-250` built one adapter per stored `FAKE` row inside `buildDevelopmentRegistry`, called once by the boot step (`:407-420`); `capture/adapters/registry.ts:80-94` fills `byDevice` only in `register`. Operation 96 adds the row and the slice (`modules/capture-discovery/adoption.ts:51-56`) and told the registry nothing, so `assertAssignable` -> `held` threw `DEVICE_UNKNOWN` (`registry.ts:62-66`). The existing db test ran on a SIMULATED Core, where no registry is provided (`capture-config/index.ts:136-137`) | `fence/index.ts:252` `fakeAdapterOf` (the loop body, one function for boot and later); `:293` `admit(device)` on the built registry (`ADMITTED` / `ALREADY_SERVED` / `NOT_SERVED`; also adds the adapter to the pre-check probe's list and to `closeAll`); `:349`, `:411` `CaptureFenceControl.admitDevice`. `capture-discovery/index.ts:254-274`: the registrar registers `admitAdopted` with `scope.unit.afterCommit` - it runs only when the adoption COMMITTED, before the next unit; a failure is logged and persisted (`captureDiscovery.admit`) and does not undo the adoption | `capture-discovery/__tests__/wave-i-a2-adopt-assign.db.test.ts` (booted path: ops 79 and 78 answer 200 at once; registry describes the device; the probe lists it); `capture/fence/__tests__/wave-i-a2-admit.test.ts` (4 cases incl. negative control: a production camera and a second local device get no adapter) | fixed |
| **G70b-01** one reason for every refusal | YES - same file, negative control: `reason: DEVELOPMENT_SOURCE_NOT_ALLOWED` for a production camera on a development Core | `modules/capture-config/routes.ts:158` wrote the constant `DEVELOPMENT_SOURCE_NOT_ALLOWED` for any `CaptureAdapterError` | `routes.ts:86` `CaptureAssignmentRefusal`, `:108` `captureAssignmentRefusalOf(code, storedClass, operation)`, used at `:210`. Four reasons: `DEVELOPMENT_SOURCE_NOT_ALLOWED`, `PRODUCTION_SOURCE_NOT_ALLOWED`, `CAPTURE_DEVICE_NOT_SERVED`, `CAPTURE_DEVICE_CLASS_MISMATCH`; any other refusal keeps the adapter layer's own code. The seam type gains an optional `operation` (`AssignmentRegistry`) | `capture-config/__tests__/wave-i-a2-refusal-reasons.test.ts` (3 cases); pins moved by delta in `routes.test.ts:334-363`, `integration-c1.db.test.ts:179`, `integration-d1b.db.test.ts:217` | fixed |
| **G70b-02** "needs no password" vs "refused this user name or password" | not a server defect | Spec: C3 `03_api_contract.md:481` "MAY be tested ... without one; fixture cameras with fixture credentials"; `05_capture_architecture_spec.md:875` ST-3 "one fixture account". The Core answers `AUTHENTICATION_FAILED, authenticated: false`, no `reason`, guard not counted (`connect/service.ts:330`, `connect/limits.ts:188`) | none on the server. Ruling + exact wording in `delegation_progress/contract_wave_i_a2.md` section 1 (written before the code) | the server facts are pinned in `wave-i-a2-adopt-assign.db.test.ts` (first case) | ruled: web side |
| **G70b-05** counter beside a scheme refusal; guard; audit row | guard: already as the spec says (PE-FM4-03, D181 (3); `connect/limits.ts:185-188`) - not a defect. Audit row: YES, red at `details ... reason` | `connect/service.ts:333-350` wrote `outcome`, `authenticated: true`, `guardTripped: false` for a scheme refusal - the same members as a first refused credential; no existing detail member tells them apart | additive optional detail member `reason: SCHEME_NOT_ALLOWED` on that row only: `connect/service.ts:349`, rule `core/audit-details.ts:347`, facts + example `packages/shared/src/api/capture-discovery.ts:391`, `:436`. The counter text is a client rule (contract file section 2): `failedAttemptsRemaining` is a required member of op 95 | same db case (scheme row has the reason, the refused-credential row has none, 3 rows of ONE type); `connect/__tests__/service.test.ts:494-497` and `core/__tests__/writers.test.ts:327` moved by delta | fixed (server half); client rule handed to B |
| **G70b-06** "Online / Stream live" for an unopened source | read, not reproduced in a test | A SERVER fact that is not a checked one: `db/mapping/rows.ts:872-873`, `:913` read `online = enabled`, `streamState = enabled ? LIVE : LOST` at boot; `enabled` is written once at registration. Changed afterwards only by a probe (`packages/shared/src/sim/capture-notices.ts:235`) or recording telemetry (`capture-telemetry.ts:109`) | **none** - see section 4. Client rule for B and C in the contract file section 4 | - | NOT DONE on the server |
| **G70b-07** search ids restart with the Core | YES in the unit rig (a second runner on the same chain answered `DSC-000001` again) | `modules/capture-discovery/search.ts:160` `let sequence = 0` per process, `:249-250` the id is that counter | NEW `modules/capture-discovery/search-ids.ts`: ONE read of the highest camera-search number in the stored `CAPTURE_DISCOVERY_SEARCHED` rows (6 to 9 digits; the 13-digit clock ids of op 97 are left out). `search.ts:171-193` reads it once per process before the first search (`:264`), the id is base + count (`:284`); a failed read is logged, persisted and asked again by the next search. Wired at `index.ts:145`. No table, no column, no migration | `__tests__/wave-i-a2-search-ids.test.ts` (5 cases); `__tests__/wave-i-a2-search-ids.db.test.ts` (two processes on one database as `dems_app`: `DSC-000001..2`, then `DSC-000003..4`; no id stored twice; chain verifies); `static.test.ts` list +1 file | fixed |
| **G75b-04** sending device on the session rows (D216 (2)) | YES - shared test red with the row member neutralised: 4 of 7 cases | `packages/shared/src/sim/session-machine.ts` wrote the device only in `switchAudioSourceTransition` (`:907`); the six session rows had none. The engine already puts the paired device into `auth` for every hosted command (`engine/host.ts:711`, `actor-scope.ts`) | `session-machine.ts:909` `sentFrom`, used on SESSION_CREATED `:344`, PRECHECK_PASSED `:621`, PRECHECK_BLOCKED `:683`, RECORDING_STARTED `:809`, RECORDING_STOPPED `:855`, SESSION_CANCELLED `:998`. The pre-check resolves later on a tick, with nobody in `auth`, so the pre-check remembers its sender: optional `precheck.sendingDeviceId` (`:582`, `types.ts:373`, schema `api/state-slices.ts:280`, example `:255`) - a member of the stored pre-check JSON, no migration. Row `deviceId` only; no `details` key; web rows keep null. No file of `modules/sessions` changed | `packages/shared/test/sim-wave-i-a2-sending-device.test.ts` (7 cases, per action + controls); `modules/sessions/__tests__/wave-i-a2-sending-device.db.test.ts` (stored rows of 8 actions carry `DEV-0001`; stored state equals committed state; web control; chain verifies) | fixed |
| **G75b-03** graceful stop writes "Power fail" / "Tablet control offline" (D216 (3)) | YES - `engine/__tests__/wave-i-a2-graceful-restart.test.ts` 3 of 4 red | NOT the stop (`host.stop()` writes nothing). The NEXT START: `engine/rehydrate.ts:316-339` `applyProcessStart` - the simulator's restart model - injects `POWER_FAIL` for a session in PRECHECK / ARMED / RECORDING / STOPPING / FINALIZING, stamped at the last committed instant (hence the stop's time on the row), and puts a stored CONNECTED link OFFLINE through the hosted action whose sentence is "Tablet control offline - recording continues" (`packages/shared/src/sim/actions.ts:231`). `RECOVERY_STARTED {faultKind: POWER_FAIL}` followed from that fault | `rehydrate.ts:255` `ProcessStartOptions.ownCapture`, `:269` `OWN_CAPTURE_STATES_KEPT_AT_START = ['FINALIZING']`, `:357` no restart fault for such a session on a Core in its own capture, `:375-379` the link goes OFFLINE in the state with no row. `host.ts:969` passes `ownCapture: captureLevels === 'external'`. SIMULATED capture unchanged | unit file above (2 fixes + 2 controls); `engine/__tests__/wave-i-a2-graceful-restart.db.test.ts`: `app.close()` while FINALIZING, then a real-capture boot on the same database -> no FAULT_RAISED, no TABLET_LINK_CHANGED, link OFFLINE, chain verifies; SIMULATED control keeps both rows | fixed for FINALIZING + the tablet row; **open** for the other four states (section 4) |

## 2. Test output (each line one run; a second run only where the first was red)

| Run | Result |
|---|---|
| `lockf db-migrate` `vitest --project db --maxWorkers=1 src/modules/capture-discovery/__tests__/wave-i-a2-adopt-assign.db.test.ts` BEFORE the fix | `Tests 2 failed (2)`: `- 200 + 422`; `- "reason": "PRODUCTION_SOURCE_NOT_ALLOWED" + "DEVELOPMENT_SOURCE_NOT_ALLOWED"` |
| the same file after the fix | `Tests 2 passed (2)` |
| the same file with the scheme case added, before the audit member | `2 failed, 1 passed`: `details` without `reason` at `:125` (the second failure was that case's leftover preset) |
| `--project db --maxWorkers=1 src/modules/capture-discovery/__tests__ src/modules/capture-config/__tests__ src/modules/capture-discovery/connect/__tests__` | `Test Files 9 passed (9)`, `Tests 60 passed (60)` |
| `--project db --maxWorkers=1` adopt-assign + `lane-camera-stub.db` + `connect.db` (after the audit member) | `Test Files 3 passed (3)`, `Tests 21 passed (21)` |
| `packages/shared` `test/sim-wave-i-a2-sending-device.test.ts` with `sentFrom` neutralised | `Tests 4 failed, 3 passed (7)` |
| the same, fix in place | `Tests 7 passed (7)` |
| `--project db --maxWorkers=1 src/modules/sessions/__tests__/wave-i-a2-sending-device.db.test.ts` | `Tests 2 passed (2)` |
| `--project unit src/engine/__tests__/wave-i-a2-graceful-restart.test.ts` BEFORE the fix | `Tests 3 failed, 1 passed (4)`: `expected 'FINALIZING' to be null`; one `TABLET_LINK_CHANGED` row |
| the same + `rehydrate.test.ts` after | `Test Files 2 passed`, `Tests 31 passed` |
| `--project db --maxWorkers=1 src/engine/__tests__/wave-i-a2-graceful-restart.db.test.ts` | `Tests 2 passed (2)` |
| `--project db --maxWorkers=1 src/modules/capture-discovery/__tests__/wave-i-a2-search-ids.db.test.ts` | first two runs red for the TEST RIG (a target without `run`; a second process whose clock was behind the stored state), then `Tests 1 passed (1)` |
| neighbours, one worker: `restart.db`, `seal-actions.db`, sessions `operations.db` + `journey.db`, and my three db files | `Test Files 7 passed (7)`, `Tests 65 passed (65)` |
| `capture-session/__tests__/session-capture.db.test.ts` alone | `Tests 55 passed (55)` |
| FINAL unit: `--project unit src/core src/engine/__tests__ src/modules/capture-discovery src/modules/capture-config src/modules/sessions/__tests__ src/capture/fence src/capture/adapters/__tests__ src/capture/__tests__/static.test.ts test/static` | `Test Files 70 passed (70)`, `Tests 1127 passed (1127)` (an earlier run of the same set: 3 failed - the two detail-key pins and a log member named `cause`; moved / renamed) |
| FINAL shared: my file + `api-state-slices`, `openapi`, `api-registry`, `api-openapi-scope`, `sim-contract`, `session-machine` | `Test Files 7 passed (7)`, `Tests 250 passed (250)` |
| `npm run typecheck -w @dems/core-server`, `-w @dems/shared` | 0 errors each |
| `npm run lint -w @dems/core-server`, `-w @dems/shared` | exit 0 each |
| OpenAPI generator under `.locks/npm.lock` | `97 operations ... 1354525 bytes`; diff `+5` lines (`precheck.sendingDeviceId`) |

**An observation that is NOT a finding of this pass:** `restart.db.test.ts` and
`session-capture.db.test.ts` run TOGETHER with `--maxWorkers=2` failed 38 cases, twice, with
`error: remaining connection slots are reserved for roles with the SUPERUSER attribute` (PostgreSQL
ran out of connections for the pair); each file alone, and all seven neighbours with one worker,
pass. Not examined further: I do not know whether the pair fails the same way at `74fd1f1`.

## 3. Decisions taken - for the controller

1. **A production device on a development Core now answers `PRODUCTION_SOURCE_NOT_ALLOWED`**, not `DEVELOPMENT_SOURCE_NOT_ALLOWED` (decision D115 (3) had pinned the development reason for it; the sentence the clients draw for that reason is false for a production camera). Two db pins and one unit pin moved. Both clients map an unknown reason to their generic 422 sentence, so nothing breaks.
2. **`CAPTURE_CONNECTION_TESTED.details` gains the optional key `reason`** (G70b-05). No existing member tells a scheme refusal from a first refused credential, so "use the existing member" was not possible; F-M4 had pinned "no reason member" on the row and the key table of C3 §5.2 - both pins moved, the erratum is requested from the docs owner (`file_requests.md`).
3. **The sending device is the row's `deviceId` only** - no `details.sendingDeviceId` on the six session rows (the switch row keeps its own). It would have added a key to six rule tables for a fact the row already states.
4. **`session.precheck.sendingDeviceId`** is the one new member of a replicated slice (optional; stored inside the existing `precheck` JSON; OpenAPI +5 lines). Without it the engine-timed pre-check row cannot know its sender.
5. **The simulator inside an app (`deviceConsole`) is unchanged**: its session rows still name no device (`sendingDeviceOf(state, false)`); only a command the Core's actor scope bound to a paired device carries one. The switch row keeps naming `TABLET` there, as before. No client pin moves.
6. **G75b-03: a real-capture start writes NO tablet row at all**, not a reworded one - the sentence belongs to the simulator's hosted action, which the SIMULATED lane must keep.
7. **G70b-07: the counter is seeded from the audit chain**, not from a new column and not from the engine epoch (an epoch-prefixed id would be unique too, but its uniqueness would rest on a number outside the chain).

## 4. Open items

| Item | What is left | Proposal |
|---|---|---|
| **G75b-03, the other four states** | A real-capture Core stopped (gracefully or not) while its session is PRECHECK, ARMED, RECORDING or STOPPING still gets, at the next start, `FAULT_RAISED` "Power fail detected - recovery marker written" (`rehydrate.ts:357-366`) and the recovery rows that follow. Such a session cannot simply stay as it was: no worker and no pre-check gate holds it after a process start, and the seal's resume reads `fault.fromState` (`sealing/pipeline/controller.ts:164`). The control case `wave-i-a2-graceful-restart.test.ts` pins this state on purpose | A ruling, then one row: on a Core in its own capture the restart of a RECORDING / STOPPING session goes through the interrupted-capture path (`interruptedCaptureTransition` + `CAPTURE_FAULT` with a new reason code, e.g. `CORE_STOPPED`: "The Core stopped while this session was recording. What was saved is kept and sealed as interrupted."), and a PRECHECK / ARMED session is cancelled or left by rule. It changes what an interrupted seal names as its cause (manifest / custody), so it needs the real-worker rigs (`seal-e2e`, `development-session-e2e`) - not a change for a wave without them |
| **G70b-06, server half** | `online` / `streamState` stay "as registered" until the first probe; no member says "not checked" | Additive `captureDevices.devices[].checkedAt?: number | null` (contract file section 4): set to `null` at a real-capture boot, to the Core clock by `withDeviceOnline` and by a telemetry change. Touches `sim/types.ts`, `api/state-slices.ts`, `sim/capture-notices.ts`, `sim/capture-telemetry.ts`, `sim/capture-registry.ts`, `db/mapping/rows.ts` and a boot door of the engine - size M, on files three other drivers hold in this wave. `CaptureStreamState` cannot take a third value without breaking strict clients |
| G70b-01 in `REAL_PRODUCTION` (the gate's hypothesis) | Read, not driven: a production registry serves no device in this phase (class C: no opener), so an adopted ONVIF camera is refused before AND after a restart - consistently, and now as `CAPTURE_DEVICE_NOT_SERVED` (`wave-i-a2-admit.test.ts`, last case; `wave-i-a2-refusal-reasons.test.ts`) | nothing until the class-C adapters land; `admit` is where they register |
| A search that never closed | Its number is given again after a restart (it wrote no row) | accepted: it is then the only one in the chain with it (`search-ids.ts` header) |
| Shared sentence `common.captureConnect.noPasswordNeeded` | still "This development source needs no password." in `packages/shared/src/i18n/en/common.ts` (not my file; B words the web in its own resources) | notice filed in `file_requests.md` |
| `masterplan/02_plan.md` tracking table, `status_tasks.md` | not written (controller's files, rule D94) | - |

## 5. Checks for the test runner

| Command | Lock | Expect |
|---|---|---|
| `npx vitest run --root apps/core-server --project unit` | none | 0 failed; watch `test/static/*` (log-call members), `src/core/__tests__/writers.test.ts` (detail keys), `src/modules/capture-config/__tests__/routes.test.ts` |
| `/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db` (sandbox off) | db-migrate | 0 failed. If `restart.db.test.ts` and `session-capture.db.test.ts` fail together with "remaining connection slots are reserved": run each alone before attributing (section 2) |
| `npx vitest run --root packages/shared` | none | 0 failed; `openapi.test.ts` must agree with the regenerated document (re-run the generator after A1's member, if A1 adds one) |
| core-web and mobile suites | none | consumers of `ActiveSessionSchema` (strict `precheck`), of the 422 reasons of ops 78 / 79 and of `searchId` literals: no pin is expected to move; a bed that pins `DSC-000001` on a LIVE Core answer would |
| Real-capture rigs with the worker: `DEMS_..._E2E=1 ... src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts`, `src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts` | heavy-host + db-migrate | the restart cases (`seal-e2e` "RECOVERY sealed the session", the interrupted one) still pass: they restart from RECORDING, which this pass did not change; a case that restarts a Core while FINALIZING now finds the session FINALIZING (not FAULT) and no `RECOVERY_COMPLETED` row |

## 6. Re-drive list for the gates (device / browser; lanes rebuilt first)

| Gate check | What to drive | Expect |
|---|---|---|
| 70 `M4-CONN-W` last clause (G70b-01) | lane 2: search, test with the fixture account of `.locks/camera-stub.lane2.fixture`, "Add as camera", then selector "Camera for Camera 2" = the new `CAM-NN`, Save - WITHOUT restarting the lane | 200; line "VIDEO-02 - CAM-NN"; one `CAPTURE_CONFIG_CHANGED` row; put back |
| 70 G70b-02 / G70b-05 (with B's wording) | the dialog without a credential; preset `AUTH_SCHEME` | B's sentences; no attempts line beside either; audit row of the scheme test has `details.reason: SCHEME_NOT_ALLOWED` |
| 70 G70b-07 | two searches, `lane.sh stop 2` / `start 2`, one search | the third id is higher than the second; `GET audit` holds no `DSC-` id twice |
| 75 G75b-04 | tablet on lane 2: create, pre-check, start, stop; phone on lane 1: stop, cancel | `deviceId: DEV-0001` on each of those rows; the same actions from the web: `null` |
| 75 G75b-03 | lane 2: stop a recording, `lane.sh stop 2` while "Finalizing evidence", `start 2` | no "Power fail detected" row, no "Tablet control offline" row, no power-fail alert; the session is FINALIZING and the seal goes on (A1's fixes decide whether it completes) |
| 70 / 75 G70b-06 | Devices on lane 2, nothing recording | B's / C's wording; the Core still sends `online: true`, `streamState: LIVE` (open item) |

## 7. Files

NEW (9): `apps/core-server/src/modules/capture-discovery/search-ids.ts`;
`.../capture-discovery/__tests__/wave-i-a2-adopt-assign.db.test.ts`, `wave-i-a2-search-ids.test.ts`,
`wave-i-a2-search-ids.db.test.ts`; `.../capture-config/__tests__/wave-i-a2-refusal-reasons.test.ts`;
`apps/core-server/src/capture/fence/__tests__/wave-i-a2-admit.test.ts`;
`apps/core-server/src/engine/__tests__/wave-i-a2-graceful-restart.test.ts`, `.db.test.ts`;
`apps/core-server/src/modules/sessions/__tests__/wave-i-a2-sending-device.db.test.ts`;
`packages/shared/test/sim-wave-i-a2-sending-device.test.ts` (10 with this one).

EDITED product: `apps/core-server/src/capture/fence/index.ts`; `src/modules/capture-config/routes.ts`,
`index.ts`; `src/modules/capture-discovery/index.ts`, `search.ts`, `connect/service.ts`;
`src/core/audit-details.ts`; `src/engine/rehydrate.ts`, `host.ts` (2 lines);
`packages/shared/src/sim/session-machine.ts`, `sim/types.ts`, `api/state-slices.ts`,
`api/capture-discovery.ts`, `openapi/openapi.json` (generator).

EDITED tests (pins by delta): `capture-config/__tests__/routes.test.ts`, `integration-c1.db.test.ts`,
`integration-d1b.db.test.ts`; `capture-discovery/__tests__/static.test.ts`;
`capture-discovery/connect/__tests__/service.test.ts`; `core/__tests__/writers.test.ts`.

Docs: `delegation_progress/contract_wave_i_a2.md` (written before the code, finalised),
`delegation_progress/coder_execution_wave_i_a2.md`, two lines in `file_claims.md`, two in
`file_requests.md`, this note.

---
*Generated: 2026-10-10 20:50 WIB*
