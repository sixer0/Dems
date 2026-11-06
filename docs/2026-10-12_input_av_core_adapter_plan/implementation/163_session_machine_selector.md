---
task: 2026-10-12_input_av_core_adapter_plan
row: 163
milestone: M2 / WP-13a
agent: coder-execution (batch 6, agent A)
date: 2026-10-13
tier: T3
status: complete
---

# Row 163 - shared: the session machine and the start rule on an incomplete selector

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `SH` = `packages/shared`, `CS` = `apps/core-server`.
Names are those of `decisions/161_selector_names_register.md` ("the register"); the cells are read as
amended by decision C25 (all FOUR slots are required; the STANDBY too). Site labels C1 to C7 are those
of `research/027_selector_assumptions.md`.

## 1. What was built

| # / site | Name | Where | Statement |
|---|---|---|---|
| N7 | `CaptureStartRule.SOURCE_NOT_ASSIGNED = 'sourceNotAssigned'` | `SH/src/sim/capture-notices.ts` | sixth member of the existing object; `params.rule` of the item, suffix of `common.captureNotice.start.sourceNotAssigned` (row 28's key) |
| N8 | `SOURCE_NOT_ASSIGNED_PRECHECK_VALUE = 'NOT_ASSIGNED'` | the same file | `value` of the item |
| N9 | `CAPTURE_SOURCE_NOT_ASSIGNED_REASON = 'CAPTURE_SOURCE_NOT_ASSIGNED'` | the same file | `SimTransitionError.reason` of the refused start; `SH/src/sim/vocabulary.ts` is not written |
| N10 | `unassignedSlotsOf(selector)` | the same file | the slots no line names by track or by role, in the contract's order; nothing is read by its place |
| N11 | `CAPTURE_START_REQUIRED_SLOTS` | the same file | `['VIDEO-01', 'VIDEO-02', 'PRIMARY', 'STANDBY']`: FOUR (C25). Held equal to `CAPTURE_SELECTOR_SLOTS` by a test (the file imports nothing of `api/`) |
| N12 | `unassignedSlotOfPrecheckItem(item)` | the same file | the one recogniser for both clients: the slot when `value` is N8, `params.rule` is N7, `params.slot` is a slot and the status is BLOCK or WARN; else null |
| C4, C5 | `evaluatePrecheck`, private `unassignedSource` | `SH/src/sim/session-machine.ts` | where `isOwnCaptureCoreState(state)` and the slot of `LENS_1`, `LENS_2`, `MIC_PRIMARY`, `MIC_STANDBY` is in `unassignedSlotsOf(selectorInForce(state))`: `{ status: 'BLOCK', value: 'NOT_ASSIGNED', reason: '<slot>: source not assigned', reasonCode: null, params: { rule: 'sourceNotAssigned', slot } }`, BEFORE every other rule of the item. No `deviceId`, no `deviceKind`. Where the marker is false the item is computed as before |
| C1 | `startRecordingTransition` | the same file | after the two existing requirements and before the audio pair is read: in real capture, while a slot of N11 is unassigned, `SimTransitionError(ARMED, 'startRecording', ..., ILLEGAL_STATE, N9)`. No state change, no audit row |
| C2 | `audioSourceAtStart` | the same file | by role through `micInputOfRole` (N4), no stand-in: `null` when either role has no line (result type `... \| null`); the session then states no `audioSource` and the meters' active input is not moved (register 5.3, D-4 accepted by C25) |
| C7 | `advanceCaptureStart` | `SH/src/sim/capture-session.ts` | the failure rule lost `cameras.length > 0`: a session with zero camera lines ends as the existing "no camera connected" failure and never turns durable |
| seam readers 3, 4 of row 28 | `applyAudioSourceSwitch` | `SH/src/sim/session-machine.ts` | correct for an absent value, with the seam in and out: the input a switch LEAVES is the session's active input, else the meters' active input while it is a line of the session, else none - and then the switch is refused (`ILLEGAL_STATE`), nothing written. The timeline label `?? 'AUDIO-01'` is kept (a label, not an input) |

Uses of the positional function `micInputOfChannel` in `session-machine.ts`: 0 (was 2 and the import).

## 2. Change set

| File | Change |
|---|---|
| `SH/src/sim/capture-notices.ts` | N7 to N12, a private `SELECTOR_SLOT_ORDER`; two import lines |
| `SH/src/sim/session-machine.ts` | imports; `unassignedSource`; two calls in `evaluatePrecheck`; `audioSourceAtStart`; the refusal and the nullable pair in `startRecordingTransition`; `applyAudioSourceSwitch` |
| `SH/src/sim/capture-session.ts` | one condition of `advanceCaptureStart`, with its comment |
| `SH/test/sim-capture-notices.test.ts` | new block "a selector slot without a source: the pre-check item (task 4 row 163)": 10 cases (names; 7 categories; four of four; before every other rule and a whole run) |
| `SH/test/sim-capture-start.test.ts` | new block "the start on an incomplete selector (task 4 row 163)": 24 cases (11 selectors in real capture, the same 11 in Simulated, the pair by role, the switch) |
| `SH/test/sim-selector-in-force.test.ts` | one case follows the nullable result of `audioSourceAtStart` (named by the typecheck; expectation unchanged) |
| `SH/test/support/selector-category-bed.ts` | NEW: the registry (4 development, 4 production devices), the 7 categories of addendum 1.5, `emptySlotsOf`, `selectorPatch`. Row 162's block now reads it (its own copy removed with the Edit tool) |

All edits with the Edit tool; the bed with Write.

## 3. Checks (this Mac; the in-app simulator on a manual clock)

The double of "a Core in real capture": the simulator created with `capture: 'external'` (`test/support/own-capture-bed.ts`), which states `time.hostClock` and `security.platformNotReported` as the Core does; `isOwnCaptureCoreState` is asserted true for it and false for the Simulated one in every category case.

| Check | Command | Result |
|---|---|---|
| Shared typecheck | `npx tsc --noEmit -p .` in `SH` | run 1: 3 errors (a missing type import; `test/sim-selector-in-force.test.ts:175` twice, the nullable pair); last run: exit 0 |
| Existing suites before any new test | `npx vitest run --maxWorkers=2` on 15 files (session-machine, sim-capture-notices, sim-capture-config, sim-selector-in-force, sim-core-driven-seal, sim-own-capture, audio, sim-api, sim-contract, sim-v2-parity, sim-faults-scenarios, sim-capture-telemetry, sim-evidence-item-kind, live-testing-fetch, sim-capture-fault) | `Test Files 15 passed (15)`, `Tests 483 passed (483)`: 0 changed results on the seeded selector |
| The three files with new cases | `npx vitest run --maxWorkers=2 test/sim-capture-notices.test.ts test/sim-capture-start.test.ts test/sim-capture-config.test.ts` | `Test Files 3 passed (3)`, `Tests 134 passed (134)` (one run) |
| Every shared suite that touches the simulator | `npx vitest run --maxWorkers=2` on the 67 files that import `src/sim` or create a simulator | `Test Files 67 passed (67)`, `Tests 1900 passed (1900)` |
| Lint | `npx oxlint` on the 3 source files, 4 test files and the bed | no finding |
| Core server, unit files that host the shared start, pre-check and switch | `npx vitest run --project unit --maxWorkers=2` on 15 files (engine hosted-actions, capture-session-parity, errors, actor-scope, clock-floor, capture-checkpoint-doors; capture-notices; modules sessions routes / pure / audio-intervals, system routes, capture-config routes / plan / slices, devices status) | `Tests 1 failed, 479 passed (480)`. The one failure is not this row's: `src/modules/capture-config/__tests__/routes.test.ts:59` lists the routes under `/capture` and now sees `searchCaptureAudioCards`, `registerCaptureAudioInput` (agent I, row 70, in flight) |
| Typecheck of the workspaces that import `SH` | `tsc --noEmit` in `CS`, `apps/mobile`, `apps/mock-core`; `tsc -b` in `apps/core-web`; `npm run -s typecheck` in `apps/transcriber` | `CS`, mobile, mock-core, transcriber: no error line. core-web: 12 lines in files agent B is writing (section 6); none names a symbol of this row |

NOT run: `npm test`, any database file, anything heavy.

The verification cell, line by line:

| Cell | Evidence |
|---|---|
| start in a state of real capture: refused for each incomplete selector category | `sim-capture-start.test.ts`, `it.each` REAL: categories 1 to 4 and the four selectors that lack exactly one slot (the STANDBY alone included) are refused with `{ code: ILLEGAL_STATE, from: ARMED, event: startRecording, reason: CAPTURE_SOURCE_NOT_ASSIGNED }`; categories 5, 6, 7 start with the pair by role |
| the refused state names no input the selector does not hold | the same cases: `h.state()` is the SAME object as before the call; the session holds no `audioSource` and no snapshot |
| the same selector in Simulated starts as today (C21 (6)) | `it.each` SIMULATED over the same 11 selectors: RECORDING, one `RECORDING_STARTED` row, the snapshot is the lines given. A complete pair is stated by role; a role without a line gives NO `audioSource` (before: `MIC-01` / `MIC-02`, or a lone STANDBY as the active input); with zero camera lines the start then ends FAULT `NO_CAMERA_CONNECTED`, with one or two it turns durable |
| pre-check on a state of real capture: one BLOCK item per unassigned slot | `sim-capture-notices.test.ts`, `it.each` over 7 categories: the item of each unassigned slot is exactly the register's object; the list of blocked slots equals the bed's own `emptySlotsOf` |
| four of four with all unassigned (STANDBY blocks too, C25) | case "four of four": `['BLOCK', 'BLOCK', 'BLOCK', 'BLOCK']`; a selector that lacks only the STANDBY gives one BLOCK item for it; a whole run on the empty selector: outcome BLOCK, session stays PRECHECK, one `PRECHECK_BLOCKED` row |
| 0 on an assigned selector | categories 5 to 7 and the untouched seeded simulator in `external` capture: no such item |
| on the seeded selector the session-machine and capture-session tests show 0 changed results (Simulated unchanged, C18 (1)) | the 15-file run before any new test, and the 67-file run: no existing expectation was edited except the one typecheck follow in `sim-selector-in-force.test.ts` |

## 4. Seams

None added. Row 28's seam `AudioSliceInState` stands (row 149); its readers 3 and 4 compile and are correct with it in and out. One test line carries a cast to build the state "no active input" and is marked `PENDING-ROW-28-SEAM`.

## 5. DRIVER DECISIONS (for the controller to confirm)

| # | Decision | Why | Reversible |
|---|---|---|---|
| DD-1 | `audioSourceAtStart` answers `... \| null` (the name is kept, the result type widened) | register 5.3 / D-4: "it states no pair"; no caller outside `SH` (searched the four app trees: 0) | yes |
| DD-2 | A switch of the audio source with no input to switch from is REFUSED (`ILLEGAL_STATE`), not performed with an invented `from` and not silently ignored | row 28's request asked for a ruling ("refuse, or no standby stated"); the session's `standbyInputId` and the audit row's `fromInput` are required inputs. Reached only in Simulated mode on a selector without a complete pair | yes |
| DD-3 | The meters' active input counts as the input to switch from only while it is a line of the session | behind the seam the state keeps a stale input (for example `MIC-01` over a selector that holds only `MIC-04`); without this rule a switch would write that input as the session's standby | yes |
| DD-4 | `unassignedSlotOfPrecheckItem` also asks for the status BLOCK or WARN | a PASS item is never "not assigned"; the register lists `status` among the members the recogniser reads | yes |
| DD-5 | The start reads `state.captureConfig` (as register 5.3 says), the item reads `selectorInForce(state)` (5.2) | at ARMED the session holds no snapshot, so the two are the same selector | - |

## 6. Reds seen in files this row does not own (not edited)

| File:line | What | Likely owner |
|---|---|---|
| `CS/src/modules/capture-config/__tests__/routes.test.ts:59` | the route list under `/capture` has two more operations | agent I (row 70) |
| `apps/core-web/src/features/devices/__tests__/mic-input-name.test.tsx:68-70`; `features/session-monitor/__tests__/audio-source.test.tsx:144-148, 422, 423`; `features/session-monitor/audio-source-controls.tsx:182` | "Expected 3 arguments, but got 2"; a line without `role`; `string \| null` given for `string` | agent B (row 168), in flight |

## 7. For the Core rows (information; lines in `file_requests.md`)

- In real capture the shared start now refuses an incomplete selector BEFORE `assertRecordableSelector` (`CS/src/modules/capture-config/plan.ts:120-126`) is reached: the answer is still `409 INVALID_STATE`, the `details.reason` is `CAPTURE_SOURCE_NOT_ASSIGNED` where it was the plan builder's. `plan.ts` is unchanged and stays the second line (AD-10 (4)). A database test that pins the reason of a start on an incomplete selector moves with rows 30 / 33 (not run here).
- `CS/src/capture-notices/precheck.ts` needs no edit (row 30): the item is produced by the shared `evaluatePrecheck` it already hosts.

## 8. Requirements

| Id | State after this row |
|---|---|
| C18 (1), C25 | real capture: BLOCK item per unassigned slot, four of four, and the start refused; Simulated unchanged |
| C21 (6) | Simulated starts on an incomplete selector |
| C18 (2), AD-04 (2) | `session-machine.ts:760-761` (the fallback AD-04 (2) names) is gone; the pair is by role; nothing in the file reads a microphone by its place |
| AD-10 (4) | not this row: `SELECTOR_SHAPE` stays in `plan.ts`; the 21-state table is row 33 |
| Row 28 seam readers 3 and 4 of 9 | served |

## 9. Doubles, and what stays unproven

Double: the in-app simulator in `external` capture as "a Core in real capture"; hand-built selectors of the bed. Nothing goes to the hardware package. Not proven here: the 409 at the Core with its `details.reason` through a route (rows 29, 30, 33); the clients' drawing of the item (rows 167, 169).

---
*Generated: 2026-10-13 02:24 WIB*
