---
task: 2026-10-12_input_av_core_adapter_plan
row: 171
milestone: M2 / WP-13a
agent: coder-execution
date: 2026-10-13
tier: T3
status: complete; one request to the writer of packages/shared (the narrowing of `channelOfMicLine`)
---

# Row 171 - mobile meter readers outside the live session: by the lookup of row 164, the empty state for an absent input

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `MOB` = `apps/mobile/src`. Names are those of
`decisions/161_selector_names_register.md` ("the register", section 7 files 19 to 24); sites M5, M6
are those of `research/027_selector_assumptions.md`. N5 = `meterInputOfChannel`, E20 = `channelOfMicLine`.

## 1. What was built (six files)

| # | File | Reader | Now | For `null` (a channel without an input) |
|---|---|---|---|---|
| 19 | `MOB/features/capture-selector/source-state.ts` | `micLineDeviceIdOf`, `micLineReportOf` | N5; the report is built from the one device-id rule | no device id; the report is the unknown source (`deviceId: null`), the word "State not known" (`preview.stateUnknown`) - never the device behind `MIC-01` / `MIC-02` |
| 20 | `MOB/features/dashboard/device-tiles.tsx` | `useMicReadout` (the MIC tile's level line) | N5 | no frame is read; the tile's empty state: "— dBFS" and "Not measured", whatever the channel record says |
| 21 | `MOB/features/dashboard/use-home-data.ts` | the phone tile's line states (`:210`); the tablet tiles' role (`:341`, seam reader 9 of 9 of row 28) | N5 at both; the meters' member read as `string \| null` (compiles with the seam `AudioSliceInState` in and out) | the channel names no line (not the primary one; its source reads unknown); no role for the tile. `micTileSourceRole` (`home-model.ts`) answers `null` for an absent input or an absent active input |
| 22 | `MOB/features/devices/device-mic-meter.tsx` | `DeviceMicMeter` | N5 | no frame is read; the meter's empty state: the plate "— dBFS" / "Not measured" (the compact meter: its not-measured readout) |
| 23 | `MOB/features/devices/sim-adapter.ts` | `channelOf` (E20) | the lines are `readonly RoleMicLine[]`; the default list and "without lines, the built-in pair" are gone (row 164's request, line "row 164 ... sim-adapter.ts:240") | no microphone has a meter channel while the selector holds no complete pair |
| 24 | `MOB/runtime/use-audio-shared-values.ts` | `useAudioAccessibilityValue` | N5 | an undefined frame: the floor, as for an input that has delivered none |
| 24 | the same | `useAudioSharedValues` | a change-only store subscription (one boolean): when the channel LOSES its input the shared values are put back to their empty state (`clearAudioValues`: the floor, no clip, no flag) | the meter does not keep the last level of an input the selector no longer holds. On a complete pair it writes nothing |

Names of the positional function left in the six files: 0. In the whole of `apps/mobile/src`
(source and tests): 0 (`grep -rn micInputOfChannel src`).

No string was added: every empty state is an existing one of its surface.

## 2. Change set

| File | Change |
|---|---|
| the six source files of section 1 | as stated |
| `MOB/features/dashboard/home-model.ts` | `micTileSourceRole`: the two parameter types and one guard |
| `MOB/features/capture-selector/source-state.test.ts` | new block "task 4 row 171" (5 cases: no line, lone PRIMARY, lone STANDBY, the role of a lone line, the seeded control) |
| `MOB/features/dashboard/home-mic-tiles-live.test.tsx` | one case in the block "MB-01" (Live bed, tablet): lone PRIMARY line, then the complete pair again |
| `MOB/features/dashboard/home-model.test.ts` | one case (`micTileSourceRole`) |
| `MOB/features/devices/real-capture-one-rule.test.tsx` | one case in the block "the simulated lane" (tablet and phone): the microphone detail with a lone line |
| `MOB/features/devices/devices-model.test.ts` | new block "task 4 row 171: `channelOf`" (2 cases) |
| `MOB/runtime/use-audio-shared-values.test.tsx` | one case: a channel that loses its input |

All edits with the Edit tool. No new dependency, no new component.

## 3. Checks (this Mac; jest, no device)

| Check | Command (in `apps/mobile`) | Result |
|---|---|---|
| Typecheck after the source edits, before any test edit | `npx tsc --noEmit` | exit 0 (the one caller of `channelOf`, `device-detail.tsx:693`, already hands `micLinesInForce(s)`) |
| The six test files of the row | `npx jest` on source-state, use-audio-shared-values, devices-model, home-model, home-mic-tiles-live, real-capture-one-rule, `--maxWorkers=2` | `Test Suites: 6 passed, 6 total`, `Tests: 148 passed, 148 total` (first run) |
| The folders of the six subjects | `npx jest src/features/dashboard src/features/devices src/runtime --maxWorkers=2` | `Test Suites: 59 passed, 59 total`, `Tests: 768 passed, 768 total` |
| The other readers of the shared values and of the source state | `npx jest src/features/capture-selector src/features/session-live src/features/session-new --maxWorkers=2` | `Test Suites: 61 passed, 61 total`, `Tests: 677 passed, 677 total` |
| Typecheck, last | `npx tsc --noEmit` | exit 0 |
| Lint | `npx eslint` on the 13 files | exit 0 |
| The positional function | `grep -rn micInputOfChannel src \| wc -l` | 0 |

The verification cell, line by line:

| Cell | Evidence |
|---|---|
| each of the 6 files has a test with an absent line that passes | 19: `source-state.test.ts` block "task 4 row 171". 20 and 21: `home-mic-tiles-live.test.tsx` "the selector holds no complete microphone pair" (the tile's level line is file 20, its role is file 21), with `home-model.test.ts` for the role rule. 22: `real-capture-one-rule.test.tsx` "a microphone whose channel has NO input", on both windows. 23: `devices-model.test.ts` block "`channelOf`". 24: `use-audio-shared-values.test.tsx` "a channel that LOSES its input" |
| names of the positional function left in the 6 files: 0 | the grep above (0 in the workspace) |
| on the seeded selector the tests of the 6 subjects show 0 changed results | no existing case of any file was edited in this row; 120 suites green on their first run; each new block carries its seeded control |

Phone and tablet: the Home tiles are a tablet surface (the case runs on `tabletLandscape`; the phone's
Microphone tile reads the same line states through `micLineReportOf`, held by the model cases); the
device meter case runs on both windows.

## 4. The request of row 164: `channelOfMicLine` may be narrowed

`channelOf` now declares `readonly RoleMicLine[]` and has no default. It was the one caller outside
`packages/shared` that handed lines without a role (row 164's seam B, marked `PENDING-ROW-171` in
`packages/shared/src/sim/audio.ts:119-137`). The narrowing itself is in `packages/shared` and is not
this row's: one line in `file_requests.md` asks the writer of that file to change the parameter of
`channelOfMicLine` to `readonly RoleMicLine[]` and to delete `MicLineRoleUnstated` and `statesRole`.
After it, `npx tsc --noEmit` of `apps/mobile` stays green by construction (the mobile caller already
satisfies the narrower type).

## 5. What depends on another row

- The meters are FED by the shared `useAudioChannel` (`packages/shared/src/sim/react.ts`, row 165,
  agent A, in the working tree during this row): it calls nothing for a channel without an input.
  The case "a channel that LOSES its input" asserts that the values STAY at the floor on later
  ticks, which holds with that edit in the tree; the reset itself is this row's.
- Seam `AudioSliceInState` (row 149 removes it): nothing to edit in the six files when it goes.
- The screens are judged on a device at the milestone gate. An incomplete pair with a session
  recording exists only in Simulated mode (a Core in its own capture refuses the start, C25); at
  rest it is the state of a first production boot, which is what the Home and Devices cases draw.

## 6. DRIVER DECISIONS (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | A channel without an input draws the EXISTING no-level state of each surface ("— dBFS" / "Not measured"; "State not known" for the source word) and no new word | register section 7: "the tile's empty state", "the meter's empty state", "the source state 'no input'"; no string could be added to the shared file in this batch and none is needed |
| DD-2 | For an absent input the level kind is forced to the empty state even when the channel record (`mics[n].state`) says `NO_SIGNAL` | that word is the Core's fault statement about an INPUT; with no input there is none to be without a signal (the same rule as the live card of row 170) |
| DD-3 | `useAudioSharedValues` clears its values when the channel loses its input (a new store subscription, change-only) | without it a mounted meter keeps drawing the last level of an input the selector has dropped: a level for an input the selector does not hold |
| DD-4 | `home-model.ts` (the parameter of `micTileSourceRole`) was edited beside the six files | seam reader 9 of 9 of row 28 names it (`home-model.ts:118`); claimed first |
| DD-5 | The Home line states (`use-home-data.ts:210`) stay keyed by meter channel, as the register writes it (Q1 -> N5); with a lone PRIMARY line the phone's Microphone tile therefore reads both lines as unknown | the register's replacement for that line is N5, not a lookup by role; a tile that followed the PRIMARY role there would be a change of rule nobody ruled |

## 7. Requirements

| Id | State |
|---|---|
| C18 (2), AD-04 | sites M5, M6 closed; with rows 169 and 170 the mobile workspace names the positional function 0 times (10 of the 24 files of register section 7) |
| Row 28, seam reader 9 of 9 | served |
| Row 164, seam B | the mobile half is done; the narrowing is requested |

Doubles: the in-app simulator and the Live Home bed (contract-checked fake transport) with the
selector's microphone lines cut down. Nothing goes to the hardware package.

---
*Generated: 2026-10-13*
