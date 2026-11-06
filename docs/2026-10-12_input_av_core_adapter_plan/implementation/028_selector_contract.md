---
task: 2026-10-12_input_av_core_adapter_plan
row: 28
milestone: M2 / WP-13a
agent: coder-execution
date: 2026-10-13
tier: T3
status: complete, with one seam that withholds the nullable type of the STATE (section 4)
---

# Row 28 - the shared selector contract: a slot may be unassigned

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `SH` = `packages/shared`, `CS` = `apps/core-server`,
`WEB` = `apps/core-web`, `MOB` = `apps/mobile`. Names are those of `decisions/161_selector_names_register.md`
("the register"); N and E numbers are its entries.

THE CONTRACT ONLY. No hosted action, no body check of the in-app simulator, no Core route, no reader of
another workspace: `git diff --stat` of this row is 8 source files and 4 test files, all under `SH`
(section 2). The operation count is 99 before and after.

## 1. What the contract states now

| # | Name | Where | Statement |
|---|---|---|---|
| N2 | `CAPTURE_SELECTOR_SLOTS` | `SH/src/api/devices.ts` | `['VIDEO-01', 'VIDEO-02', 'PRIMARY', 'STANDBY']`, built from `TrackId` and `MicRole` |
| N3 | `CaptureSelectorSlot` | `SH/src/sim/types.ts` | `VideoTrackId \| MicRole`, structural; a type test holds it equal to the members of N2 |
| N1 | `unassign` | member of `CaptureConfigUpdateRequestSchema` (E2) and of the `UPDATE` kind of `CaptureConfigChange` (E5) | schema: array of N2, 1 to 4, optional; type on the change: `readonly CaptureSelectorSlot[] \| undefined`. No new kind of change |
| - | the two body rules (register 4.3; AD-10 (3)) | two refinements of E2, both on the path `unassign` | no slot twice; no slot that the same body assigns (the `trackId` of a camera line, the `role` of a mic line). Refused by the schema, hence `422 INVALID_INPUT` wherever the schema is the body check |
| E4 | `CaptureConfigMicUpdateSchema.role` | description only | reworded to the rule MIC-ASSIGN (C21 (8)): by role, one line or two, a role is assignable alone. Members unchanged |
| E6 | `CaptureConfigMicChange.role` | comment only | the same rule |
| E1 | operation 78 | its description | one paragraph: `unassign`, its audit row (`from`, no `to`), the 422, a role alone, and that a Core in its own capture refuses a start while a slot is unassigned. Id, path, permission, statuses, client kinds unchanged (AD-10 (5)) |
| E14 | `CaptureConfig` (domain) | `SH/src/domain/entities.ts` | six members nullable: four `string \| null`, two `MicInputId \| null` (site A9) |
| E39 | `VideoTrackStatusSchema.sourceDeviceId` | `SH/src/api/core-api.ts` | `.nullable()`; `tracks` and the health `cameras` stay exactly two |
| E40 | `AudioStatusResponseSchema` | the same file | `channels` `.max(2)` (was `.length(2)`); `activeInputId` `.nullable()`. `AudioChannelStatusSchema` unchanged: an entry IS an input |
| E41 | `AudioSliceSchema`; `AudioSlice` | `SH/src/api/state-slices.ts`; `SH/src/sim/types.ts` | `inputs` at most two keys (was exactly two); `activeInputId` `string \| null`. The STATE's own type is behind a seam: section 4 |
| N13 | `common.captureNotice.start.sourceNotAssigned` | `SH/src/i18n/en/common.ts` | `'{{slot}} has no source assigned. Assign one on Devices.'` |
| N14 | `common.captureSlot.*` (7 keys) | the same file, a new block | `Camera 1`, `Camera 2`, `Primary microphone`, `Standby microphone`, `Not assigned`, `Assign`, `Assign a source to {{slot}}` |

Absent is always `null`: never a missing member, an empty text or a word (tested, section 3).

## 2. Change set

| File | Change |
|---|---|
| `SH/src/api/devices.ts` | N2; the private helper `slotsAssignedBy`; `unassign` and the two refinements on E2; the texts of E4, E2, operation 78 |
| `SH/src/sim/types.ts` | N3; `unassign` on the `UPDATE` kind; `AudioSlice.activeInputId` nullable with the comments; the seam type `AudioSliceInState`; `SimState.audio` typed by it |
| `SH/src/domain/entities.ts` | E14 |
| `SH/src/api/core-api.ts` | E39, E40, and the two audio members of `DeviceHealthResponseSchema` (driver decision DD-1). No count line, no operation table line |
| `SH/src/api/state-slices.ts` | E41 (`AudioSliceSchema` only) |
| `SH/src/i18n/en/common.ts` | N13, N14 |
| `SH/src/live/source/neutral-state.ts` | one line: `silentAudio` returns `SimState['audio']` (it names an input by constant, so the narrower type is true of it) |
| `SH/src/live/source/live-sim.ts` | comment only, at `onMeters`: why a null on the wire keeps the store's input while the seam stands |
| `SH/test/sim-capture-config.test.ts` | new block "operation 78: the member `unassign` of the body" (4 cases); one pin moved (a one-frame audio slice is accepted) |
| `SH/test/api-state-slices.test.ts` | two cases "row 28" (audio slice; operations 44, 45, 46); one pin removed from the neighbouring case (one input was refused); type proof `audioIsTheSlice` against `AudioSlice`; the seam marker `audioStateIsTheSlice` |
| `SH/test/api-realtime.test.ts` | one pin moved (a meters frame with one input parses; none with null; three refused); type proof `metersCarryTheAudioSlice` against `AudioSlice` |
| `SH/test/i18n.test.ts` | one case: the words of N13 and N14 |
| `SH/openapi/openapi.json` | generated. Row 94 ran the generator while this row's schema text was already in the tree; this row's own run, last, answered `unchanged openapi/openapi.json (all (committed): 99 operations, 2 security schemes, version 0.3.0; offline: 33 operations, 0 security schemes, version 0.2.0; 1457158 bytes)`. `grep -c unassign` of the file: 3 |

All edits with the Edit tool; no scripted replace; no file rewritten.

Not written, although claimed first: `SH/src/sim/api.ts` (no line of this row; row 94 was in it), and the
three app files of the "four follow-ups" (section 5).

## 3. Checks run

| Check | Command | Result |
|---|---|---|
| Shared typecheck (last, after every edit) | `npx tsc --noEmit -p .` in `SH` | no error line |
| Shared, the contract and pin files, run 1 | `npx vitest run --maxWorkers=2` on 18 files | 6 failed: 2 pins of this row ("one input is refused"), the generated description not yet regenerated (2), and 2 count pins of row 94 in `api-text-rule.test.ts` (its file, in flight) |
| Shared, run 2 (after the two pins and the generator) | the same on 23 files: sim-capture-config, api-state-slices, api-realtime, api-registry, openapi, api-openapi-scope, api-domain-operations, api-examples, api-state-examples, api-text-rule, sim-api, live-source-bindings, api-closeout, api-schemas, client-types, sim-contract, live-testing-fetch, i18n-vocabulary-sync, i18n, api-capture-discovery, sim-api-validation, sim-v2-parity, client-core | `Test Files 23 passed (23)`, `Tests 868 passed (868)` |
| Core server, unit files that read the widened answers and the body | `npx vitest run --project unit --maxWorkers=2` on devices/status, devices/routes, capture-config/routes, slices, plan, realtime/messages, engine/hosted-actions | `Test Files 7 passed (7)`, `Tests 149 passed (149)` |
| Web console | `npx vitest run --maxWorkers=2` on live-api-reference-page, live-api-reference-document, scalar-config, live-devices-capture-selector, selector-microphones | `Test Files 5 passed (5)`, `Tests 165 passed (165)` |
| Mobile | `npx jest --maxWorkers=2` on capture-selector/selector-lines, session-live/mic-source-model | `Test Suites: 2 passed`, `Tests: 50 passed` |
| Typecheck of every workspace that imports the contract (once, at the end) | `tsc --noEmit` in `CS`, `MOB`, `apps/mock-core`; `tsc -b` in `WEB`; `npm run -s typecheck` in `apps/transcriber` | exit 0, five of five |
| Lint | `npx oxlint` on the 8 source and 4 test files | exit 0 |

NOT run: `npm test`, `npm run test:db`, any database file, anything heavy. No double is involved; nothing goes to the hardware package.

The row's verification cell, line by line:

| Cell | Evidence |
|---|---|
| the operation count is not moved (99) with the body pins passing | `api-registry.test.ts`, `openapi.test.ts`, `api-openapi-scope.test.ts`, `api-domain-operations.test.ts` green in run 2; the generator line says 99; no count line of `core-api.ts` in the diff |
| a body that names one slot in both members fails the schema as 422 | `sim-capture-config.test.ts`, case "AD-10 (3)": four bodies refused with the issue path `unassign` (camera track, mic role, alone and beside other members), three controls accepted beside them |
| the shared typecheck is green with the six members nullable and the three widened schemas accepting an absent value | typecheck above; `api-state-slices.test.ts` cases "row 28" (null, 0 and 1 entries accepted; a missing member, an empty text, three entries refused) |
| the answers for a complete selector are equal to today's | the committed examples of operations 44, 45, 46 parse unchanged (same case); `AudioSliceSchema.parse(state.audio)` is strictly the seeded slice; `sim-api`, `sim-v2-parity`, `sim-contract`, `live-testing-fetch` and `CS` `devices/status.test.ts` green with 0 changed expectations; no example value was edited |

Simulated mode (C21 (6)): no reducer, no seed and no start rule was touched; the seeded selector is complete; the start is not refused.

## 4. The seam: `AudioSliceInState`

MEASURED before choosing it. With `SimState['audio'].activeInputId` typed `string | null` the four typechecks name nine lines and no other:

| # | Line | Owner |
|---|---|---|
| 1, 2 | `SH/src/sim/audio.ts:90`, `:375` | 164 |
| 3, 4 | `SH/src/sim/session-machine.ts:982`, `:995` (`applyAudioSourceSwitch`) | 163 |
| 5, 6 | `SH/src/sim/api.ts:443`, `:1974` (the health and audio-status answers; line numbers after row 94's edits) | 165 |
| 7 | `WEB/src/features/session-monitor/audio-source.ts:144` (`selectActiveInputId`) | 168 |
| 8 | `MOB/src/features/session-live/mic-source-model.ts:151` (`selectActiveInputId`) | 170 |
| 9 | `MOB/src/features/dashboard/use-home-data.ts:341` | 171 |

`CS` has none of its own. Three of the nine are app lines that read `s.audio.activeInputId` directly, so no accessor inside `SH` can shield them: the only seam that keeps the tree compiling without a foreign edit is on the type they read.

What was built: `AudioSlice` (the type of the wire body, of the Core's meter frame `EngineMeterFrame.audio` and of `metersText`) is nullable, as the schema is; `SimState['audio']` is `AudioSliceInState = Omit<AudioSlice, 'activeInputId'> & { activeInputId: CaptureMicInputId }`. So the contract and the Core-side frame state the truth, and only the reducer state of today's code is held narrow. Nothing writes null into the state today.

What it withholds: E41's second half, "`SimState['audio']` ... `activeInputId: CaptureMicInputId | null`". Rows 162 and 164 cannot write a null into the state until the seam is removed (two edits in `types.ts`, a `sh-hot` file: through the controller). The test marker `audioStateIsTheSlice` (`PENDING-ROW-28-SEAM`) stops compiling at that moment and forces its flip. Each of the nine readers is a line of `file_requests.md` with its owner.

## 5. The four follow-ups of C30 (4)

Measured under the true type (seam out): none of the four is a compile error.

| Site | Finding | Edit |
|---|---|---|
| `SH/src/live/source/live-sim.ts:914` | `audio.activeInputId ?? store...` compiles either way, but a null from the Core is replaced by the store's last input. The honest line (`audio.activeInputId`) needs the state type | comment only; the line is a request for the row that removes the seam |
| `WEB/src/features/dashboard/devices-panel.tsx:49` | already null-safe: `activeInputId === null ? null : ...` on the next line | none |
| `WEB/src/runtime/testing/live-harness.ts:399` | a test harness; passes the value into an example body | none |
| `MOB/src/features/session-live/testing/live-monitor-bed.tsx:284` | a test harness; passes the state's value into a meters frame, which the schema now accepts as null | none |

## 6. Driver decisions, for the controller to confirm

| # | Decision | Why | Reversible |
|---|---|---|---|
| DD-1 | `DeviceHealthResponseSchema.audio` is `.max(2)` and its `activeInputId` nullable, beyond the register's E40 | operation 44 is answered by the same two functions as operation 45 (`CS/src/modules/devices/status.ts:238`, `:261`) and its response schema is enforced by the route (`modules/devices/index.ts:116`). Without it row 150's honest answer would fail the health route on an incomplete selector: the Dashboard of a first production boot | yes: two members |
| DD-2 | The seam is a named type on the STATE (`AudioSliceInState`), a NEW name outside the register; the wire type is not narrowed | section 4; the precedent is row 17's `slotColumn` (C29 (3)) | yes: removal is the plan |
| DD-3 | The two body rules are refinements (the JSON Schema of the component states `minItems`, `maxItems`, the enum; uniqueness and "not assigned by the same body" are in the description text) | the precedent of the text rule and of `AudioSliceSchema`; a refinement on a strict object keeps the component a plain object for the description | yes |
| DD-4 | No request example with `unassign` was added | no answerer honours the member before rows 162, 165, 29 | yes: one example entry |
| DD-5 | `silentAudio` keeps its value and gets the narrow return type; its constant `MIC-01` is reported, not changed | not a selector reader of row 27's inventory; client display only | yes |

## 7. What is true only after later rows (interim state)

- The schema accepts `unassign`; the Core's route forwards only `cameras` and `mics` (`CS/src/modules/capture-config/routes.ts:283-287`, row 29) and the hosted action does not know the member (row 162). Until both land, `{ "unassign": [...] }` at the Core answers 200 with nothing changed and no audit row, as `{}` does today. The in-app simulator answers 422 (unknown member) until row 165.
- The description of `role` and of operation 78 says a role is assignable alone; the hosted action still refuses a single line with `role` (`SH/test/sim-capture-config.test.ts:620`, `:649`, green) until row 162.
- No answerer produces a null or a shorter list yet: rows 150, 162, 164, 165.

## 8. Requirements

| Id | State after this row |
|---|---|
| AD-10 (3) | closed at the schema; the action-level case (a mic line without `role` on a cleared slot, N17) is row 162 |
| AD-10 (5) | client kinds unchanged: no access condition was added to operation 78 |
| AD-10 (1), (2), (4) | not this row: 162, 29, 33 |
| AD-04 | the contract no longer states "always present" for the three shapes; nothing by position was added. The inventory test and the readers are rows 149, 150, 162 to 172 |
| C25 R-2 | carried: the three widenings of register section 8, plus DD-1 |
| C30 (4) | measured: no edit needed in three of four; the fourth waits for the seam's removal |

## 9. Requests left in `file_requests.md` (row 28)

Sixteen lines: the seam and its nine readers (nine lines); `live-sim.ts` `onMeters`; `neutral-state.ts` `silentAudio`; the interim state of `unassign` for rows 29 and 162 (blocking for any acceptance of AD-10); the missing request example; the widened answers for row 150; the text keys for rows 31, 32, 167, 169; the answer to row 94's note on count comments (none found in `core-api.ts`).

---
*Generated: 2026-10-13 00:55 WIB*
