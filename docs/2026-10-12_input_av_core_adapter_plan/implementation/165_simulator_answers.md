---
task: 2026-10-12_input_av_core_adapter_plan
row: 165
milestone: M2 / WP-13a
agent: coder-execution (batch 6, agent A)
date: 2026-10-13
tier: T3
status: complete
---

# Row 165 - shared: the simulator answers for an unassigned selector slot

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `SH` = `packages/shared`, `CS` = `apps/core-server`.
Names are those of `decisions/161_selector_names_register.md` ("the register"); site labels C17, C23,
C24, C25 are those of `research/027_selector_assumptions.md`.

## 1. What was built

| Site | Where | Before | Now |
|---|---|---|---|
| C25 | `SH/src/sim/api.ts`, `checkCaptureConfigUpdate` (the in-app body check of operation 78) | only `cameras` and `mics`; `unassign` was an unknown member (422) | accepts `unassign`: a list of 1 to 4 of the four slot names, no slot twice, and no slot the same body assigns (the `trackId` of a camera line, the `role` of a mic line). Every refusal of the member is on the path `unassign` (register 4.3; AD-10 (3)). The route hands the member to the hosted action |
| C23 | `videoTracks` (operations 44 and 46) | `sourceDeviceId: slot?.deviceId ?? camera.deviceId`: the built-in camera for a track without a source | `sourceDeviceId: slot?.deviceId ?? null`. `ApiVideoTrack.sourceDeviceId` is `string \| null` (register E39). The line is found by its track |
| C24 | `audioInputs` (operations 44 and 45) | the positional function, then `?? mic.deviceId`, `?? mic.micRole`: an input, a device and a role for a channel without a line | through `meterInputOfChannel` (N5): a channel without an input gives NO entry (register E40, D-2). An entry carries the device and the role of ITS line and nothing of the hardware slice |
| seam readers 5, 6 of row 28 | `deviceHealth`, the audio status handler; private `activeInputOf` | `activeInputId: state.audio.activeInputId` into a member typed as an input | the meters' active input while it IS a microphone line in force, else `null`. `ApiAudioStatus.activeInputId` and `ApiDeviceHealth.activeInputId` are `CaptureMicInputId \| null`. Correct with the seam `AudioSliceInState` in and out |
| C17 | `SH/src/sim/faults.ts` (`setAudioFrame`; the `MIC_NO_SIGNAL` inject; `maybeRaiseMicSilentWarning`) | the positional function: a frame written and read under `MIC-01` / `MIC-02` | N5; `null`: no write, no frame read, no warning raised |
| C17 | `SH/src/sim/health.ts` (`micLevelPoint`) | the positional function | N5; `null`: the floor, as an input without a frame |
| C17 | `SH/src/sim/react.ts` (`useAudioChannel`) | the positional function | N5; `null`: no frame, `onFrame` is not called |
| C22 | `SH/src/sim/capture-telemetry.ts` | 0 names; it reads `channelOfMicLine` / `activeMeterChannel` | not edited (register file 8: names unchanged) |

Names of the positional function `micInputOfChannel` left in the five files (`api.ts`, `faults.ts`, `health.ts`, `react.ts`, `capture-telemetry.ts`), comments included: `grep -c` answers 0, 0, 0, 0, 0. In `SH/src` it is left only in `sim/audio.ts` (its definition and two comments; row 172).

## 2. Change set

| File | Change |
|---|---|
| `SH/src/sim/api.ts` | two import lines; three interface members with their comments; `videoTracks`; `audioInputs`; `activeInputOf` and its two uses; `UNASSIGNABLE_SLOTS`; `checkCaptureConfigUpdate`; one line of the route of operation 78 |
| `SH/src/sim/faults.ts` | the import; three call sites; one comment |
| `SH/src/sim/health.ts` | two import lines; `micLevelPoint` |
| `SH/src/sim/react.ts` | the import; `useAudioChannel` and its comment |
| `SH/test/sim-api.test.ts` | new block "the simulator answers for an unassigned selector slot (task 4 row 165)": 12 cases; two import statements |
| `SH/openapi/openapi.json` | NOT changed: the generator, run once at the end, answered `unchanged openapi/openapi.json (all (committed): 99 operations, 2 security schemes, version 0.3.0; offline: 33 operations, 0 security schemes, version 0.2.0; 1457158 bytes)`. No file under `SH/src/api/` was edited by rows 162, 163, 165 |

Shared hot files: `sim/api.ts` edited (this row). `i18n/en/common.ts`, `api/core-api.ts`, `api/state-slices.ts`, `sim/types.ts`: NOT edited by this agent; no request for them arrived from agents B and C (they built behind `PENDING-SHARED` constants for names that rows 28 and 163 now export).

All edits with the Edit tool.

## 3. Checks (this Mac; the in-app simulator on a manual clock)

| Check | Command | Result |
|---|---|---|
| Shared typecheck | `npx tsc --noEmit -p .` in `SH` | exit 0 |
| Every shared suite that touches the simulator, BEFORE any new test | `npx vitest run --maxWorkers=2` on the 67 files that import `src/sim` or create a simulator | `Test Files 67 passed (67)`, `Tests 1900 passed (1900)`: 0 changed results |
| The new block | `npx vitest run --maxWorkers=2 test/sim-api.test.ts` | `Test Files 1 passed (1)`, `Tests 32 passed (32)` (one run) |
| The 67 files again, at the end | the same command | `Test Files 67 passed (67)`, `Tests 1912 passed (1912)` |
| The generated description | `node --import tsx scripts/gen-openapi.ts` in `SH` (the script of `npm run openapi:gen`; section 5, DD-5) | `unchanged openapi/openapi.json (... 99 operations ...)` |
| The description's tests | `npx vitest run --maxWorkers=2` on openapi, api-openapi-scope, api-registry, api-examples, api-domain-operations | `Test Files 5 passed (5)`, `Tests 128 passed (128)` |
| Lint | `npx oxlint` on the four source files and the test file | no finding |
| Core server, unit files that compare with or host the simulator's answers | `npx vitest run --project unit --maxWorkers=2` on devices/status, devices/routes, capture-config/routes, engine/hosted-actions, engine/capture-session-parity, sessions/routes, sessions/audio-intervals | `Tests 1 failed, 239 passed (240)`; the one failure is `src/modules/capture-config/__tests__/routes.test.ts:59` (two new routes of agent I, row 70), not this row's |
| Web console, the tests that use the simulator's selector, status and start | `npx vitest run --maxWorkers=2` on 12 files (live-session-new-local-notice, live-api-reference-page, live-session-new-precheck, live-devices-capture-selector, live-session-new-pending, live-api-reference-document, countdown-sources, simulator-start, selector-microphones, camera-search, camera-connect, live-core-errors) | `Test Files 12 passed (12)`, `Tests 274 passed (274)` |
| Mobile, the same subjects | `npx jest --maxWorkers=2` on 4 files (capture-selector, session-new, session-live, devices, dashboard files that create a simulator or name the action) | `Test Suites: 4 passed`, `Tests: 57 passed` |
| Typecheck of the workspaces that import `SH` (the agent's end) | `tsc --noEmit` in `CS`, `apps/mobile`, `apps/mock-core`; `tsc -b` in `apps/core-web`; `npm run -s typecheck` in `apps/transcriber` | no error line, five of five |

NOT run: `npm test`, any database file, anything heavy.

The verification cell, line by line:

| Cell | Evidence (`SH/test/sim-api.test.ts`, block of row 165) |
|---|---|
| on a selector with one video line and a lone STANDBY: no source device for the empty track | first case: operations 46 and 44 answer `['VIDEO-01', null], ['VIDEO-02', 'CAM-02']`; the bodies parse `VideoStatusResponseSchema` and `DeviceHealthResponseSchema` |
| no input, device or role for the empty role | the same case: operation 45 answers `{ channels: [], activeInputId: null }`, operation 44 `audio: []`, `activeInputId: null`; the text of the answer holds neither `MIC-01` nor `PRIMARY`; the body parses `AudioStatusResponseSchema` |
| a body with `unassign` passes the in-app check | case "the in-app body check accepts `unassign`": each of the four slots alone answers 200 with one audit row; all four in one body; `unassign` beside an assignment of another slot; and the slots are assigned again through operations 79 and 78. The refusals: 10 bodies answer 422 with a message that starts `unassign: `, and each is also refused by the contract's schema |
| names of the positional function left in the five files: 0 | `grep -c micInputOfChannel` on the five files: 0 each (section 1) |

Beyond the cell: the 7 categories of addendum 1.5 (each track answers the device of its line or null; the channels are the complete pair in both role arrangements or none; every answer is a body of the contract); the seeded control (answers as before; the active input after a switch during a recording); the lock (409 `CAPTURE_CONFIG_LOCKED`, no row) and the role (403) before the body is looked at; site C17 by behaviour (two faults on channels without an input write no frame under `MIC-01` / `MIC-02`; the 1 Hz sample reads the floor; the seeded control writes its frame as before).

## 4. Seams

None added. The seam `AudioSliceInState` stands (row 149). Its two readers in this file no longer read the state member into an answer directly: `activeInputOf` compiles and is correct with the seam in and out.

## 5. DRIVER DECISIONS (for the controller to confirm)

| # | Decision | Why | Reversible |
|---|---|---|---|
| DD-1 | The answers of operations 44 and 45 state the active input only while it is a microphone line in force (`activeInputOf`); otherwise `null` | behind the seam the state keeps the input it held when the selector lost its PRIMARY; answering it would state an input the selector does not hold. On a complete selector and during a session the answer is the state's member, as before. Row 150 (the Core's twin, agent D) should answer the same: a line of `file_requests.md` | yes |
| DD-2 | NO request example with `unassign` was added to `SH/src/api/devices.ts` (row 28's open line, addressed to this row) | the file is outside this agent's claimed files; the Core's route does not forward the member before row 29, so a published example would still describe a body that does nothing at the Core; the example-count pins were not measured. Passed on to row 29 | yes |
| DD-3 | The in-app 422 of a refusal thrown by the hosted action keeps its one general sentence and carries no `details.reason` (the new `SLOT_UNASSIGNED_AND_ASSIGNED` included) | that is how the in-app answer treats the two existing reasons today; adding it would change the answers of the seeded demo. The Core copies the reason (row 29) | yes |
| DD-4 | `useAudioChannel` has no render test of the "no input" branch | the shared package has no render test of this hook; the branch is three lines and the same lookup as `health.ts`, which is tested by behaviour. Unproven by a render | - |
| DD-5 | The generator was run as `node --import tsx scripts/gen-openapi.ts` | `npm run openapi:gen` (`tsx scripts/gen-openapi.ts`) stops in the command sandbox: the `tsx` command opens a pipe under `/tmp` (`listen EPERM`). The same script, the same loader, no pipe | - |

## 6. Found outside the row's four sites (not edited; a line of `file_requests.md`)

`SH/src/sim/api.ts:885`, `audioSourceIntervalsOf` (site C26, classified SAFE by row 27): the input of the first interval of a session WITHOUT a pair falls back to the snapshot's PRIMARY, then to the meters' active input, then to the constant `'MIC-01'`. Since row 163 a session started in Simulated mode on a selector without a complete pair states no pair, so operation 82 can answer one interval that names an input the session does not hold. Simulated mode only; no real capture session reaches it. The honest answer (no interval) changes a documented fallback for hand-built sessions, so it was left for a ruling.

## 7. Requirements

| Id | State after this row |
|---|---|
| AD-04 (2) | sites C17, C23, C24 closed: no answer of the in-app simulator resolves a camera or a microphone by position or by a built-in constant; `micInputOfChannel` has no caller left in `SH/src` (its definition stays for row 172) |
| AD-10 (3) | the in-app body check refuses the two forms a body shows, on the path `unassign`; the third form is the hosted action's (row 162) |
| C25 R-2 | the answers use the widened schemas of row 28 (E39, E40): `null` and 0 entries parse; on a complete selector the answers are byte-equal to before (seeded control, 1900 unchanged tests) |
| Row 28 seam readers 5 and 6 of 9 | served |
| Row 28 interim note | ended for the in-app simulator: `unassign` is honoured. At the Core it ends with row 29 |

## 8. Doubles, and what stays unproven

Double: the in-app simulator on hand-built selectors of the bed. Nothing goes to the hardware package. Not proven here: the Core's answers for the same states (row 150), the Core's route (row 29), the hook's empty branch by a render (DD-4).

---
*Generated: 2026-10-13 02:34 WIB*
