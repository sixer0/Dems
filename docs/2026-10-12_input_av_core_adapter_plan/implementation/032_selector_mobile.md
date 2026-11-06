---
task: 2026-10-12_input_av_core_adapter_plan
row: 32
milestone: M2 / WP-13a
agent: coder-execution
date: 2026-10-13
tier: T3
status: complete
---

# Row 32 - mobile selector screen: one row per slot, an empty slot with its offer

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `MOB` = `apps/mobile/src`. Names are those of
`decisions/161_selector_names_register.md` ("the register"); sites M1, M2 are those of
`research/027_selector_assumptions.md`.

## 1. What was built

| Site | Before | Now |
|---|---|---|
| M1 `cameraRows` (E38) | one row per camera line | always 2 rows, `VIDEO-01` then `VIDEO-02`; a track without a line is a row with `deviceId: null`, `streamState: null`, nothing of a device. A line is found by its track |
| M1 `micRows` (E38) | one row per microphone line | always 2 rows, `PRIMARY` then `STANDBY`; a role without a line is a row with `inputId: null`, `deviceId: null`. A line is found by its role (a lone STANDBY line is the standby row) |
| M1 the screen (`capture-selector.tsx`) | `map` over the lines | four rows. An empty slot: detail "Not assigned" (`common.captureSlot.notAssigned`), control "Assign" (`common.captureSlot.assign`) with the label "Assign a source to Camera 1 / Primary microphone ..." (`common.captureSlot.assignLabel`); a microphone slot is titled by its slot name and keeps its role chip (neutral tone); a camera slot draws no stream chip. Same gate, same sheet, same row-is-the-target rule as an assigned row. The row of an empty microphone slot is keyed by its ROLE (`capture-selector-row-PRIMARY`) |
| M2 `micLineCommand` (E37) | `null` when the other role held no line | the new kind `micRole` (N16): operation 78 with ONE line by role. While the other role holds a line: the two-line pair of before |
| N16 `SelectorCommand` kind `micRole` | - | `{ kind: 'micRole', role, inputId }`; body `mics: [{ inputId, deviceId: inputId, role }]` (`micRoleBody`), path `/api/v1/capture/config`, Live: `updateCaptureConfig` |
| the camera sheet request | `currentDeviceId: string` | `string \| null` (no option is the current one for an empty track). The command is the camera command of an assigned row (operation 79) |

No `unassign` is sent: the screen draws no control for it (register section 6). The "empty" state of
the card ("No capture devices configured") is unchanged: no line AND no registered device.

## 2. Change set

| File | Change |
|---|---|
| `MOB/features/capture-selector/capture-selector-model.ts` | `cameraRows`, `micRows`, `isEmptySlotRow` (new), `micLineCommand`, the `micRole` kind, `isNoChange`; two row types widened |
| `MOB/features/capture-selector/capture-selector.tsx` | the four rows; `SelectorRow` gains `empty` (the control's word); the microphone rescan is drawn under the rows unconditionally (the rows are always there) |
| `MOB/features/capture-selector/capture-selector-port.ts` | `micRoleBody`; path, simulated body and Live call of the new kind |
| `MOB/features/capture-selector/use-capture-selector.ts` | the runtime-log target of the new kind (one expression) |
| `MOB/features/capture-selector/capture-source-sheet.tsx` | the type of `currentDeviceId` (one member) |
| `MOB/features/capture-selector/capture-selector-model.test.ts` | new block "task 4 row 32" (10 cases: 6 line sets, by-track / by-role, the command, the seeded commands, the body and both ports) |
| `MOB/features/capture-selector/capture-selector.test.tsx` | new block "task 4 row 32" (6 cases: 0 lines on phone and tablet, 1 line, 2 lines, the offer opens the sheet and builds a command, the gate) |

All edits with the Edit tool. No new string in `MOB` (the seven keys of N14 are row 28's, already in
`packages/shared/src/i18n/en/common.ts`). No new dependency, no hand-built widget: `ListGroup`,
`Button`, `StatusChip`, `SelectionGlow` of the existing row.

## 3. Checks (this Mac; jest, no device)

| Check | Command (in `apps/mobile`) | Result |
|---|---|---|
| The suites of the two features that mount the selector | `npx jest src/features/capture-selector src/features/devices --maxWorkers=2` | `Test Suites: 37 passed, 37 total`, `Tests: 450 passed, 450 total` |
| The model file after its typing fix | `npx jest src/features/capture-selector/capture-selector-model.test.ts --maxWorkers=2` | `Tests: 28 passed, 28 total` |
| Typecheck | `npx tsc --noEmit` | run 1: exit 2, three errors, all in the new `it.each` table of the model test (readonly tuples); after the fix: exit 0 |
| Lint | `npx eslint` on the 7 files | exit 0 |

The verification cell, line by line:

| Cell | Evidence |
|---|---|
| model test with 0, 1 and 2 lines per kind: 4 rows in every case | model block, the six line sets: `cameraRows` and `micRows` have length 2 each, in slot order |
| component test, each empty one with its offer | component block: 0 lines (phone portrait and tablet landscape), 1 line: `Not assigned`, `Assign`, the label `Assign a source to <slot>` on the control and on the row |
| the command for an empty slot is built (not null) | model: `micLineCommand(..., { mics: [] })` is `micRole` for both roles; component: after a choice in the sheet of an empty slot Save is enabled, for a microphone and for a camera |
| the mobile selector tests show 0 other changed results | no existing case was edited in any file; 37 suites green on the first run |

Simulated mode on the seeded selector: the rows, the words and the commands are those of before
(model case "the seeded, complete selector builds the commands of before"; component case "2 lines").

## 4. What is true only after other rows

- The Core and the in-app simulator accept ONE line by role, and a camera for a track without a line,
  only once row 162 (hosted action) and row 165 (the simulator's body check) have landed. This row's
  tests stop at the command and its body; no test here asserts the answer of such a save.
- Judged on a device (phone and tablet) at the milestone gate, not here.

## 5. DRIVER DECISIONS (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | `capture-selector-port.ts` and one line of `capture-source-sheet.tsx` were edited although the profile line names three files | the new command kind has to be sent, and the sheet's request must accept an empty track; both are the selector's own files (claimed first) |
| DD-2 | A held role whose other slot is empty is replaced by ONE line by role as well (`micRole`), not refused | register 4.2 "by role: the slot of a role the body does not name keeps what it holds" |
| DD-3 | PRIMARY line, the choice is the standby microphone, the primary slot empty: still operation 80 (as before) | register E36: "null only when the microphone chosen is the other role's" is the web rule; mobile has had the trade there since wave H and E37 moves only the two `null` answers |
| DD-4 | An empty camera slot draws no chip; an empty microphone slot keeps the role chip in the neutral tone | a stream word needs a line; the role is what the slot IS |
| DD-5 | "Search again" for microphones is drawn whenever the rows are (it was tied to "a microphone line exists") | with empty microphone slots it is the action an operator needs; on the seeded selector nothing changes |

## 6. Requirements

| Id | State |
|---|---|
| C18 (3) | closed for the mobile client |
| C21 (8) | a role is assignable alone from the mobile selector (command side) |
| AD-04 | sites M1, M2 closed: no row and no command is found by position |

Double: the in-app simulator with a selector put in place by `store.setState`. Nothing goes to the
hardware package.

---
*Generated: 2026-10-13*
