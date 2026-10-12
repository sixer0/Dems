---
task: 2026-10-12_input_av_core_adapter_plan
row: 169
milestone: M2 / WP-13a
agent: coder-execution
date: 2026-10-13
tier: T3
status: complete, behind three local constants marked PENDING-SHARED (section 4)
---

# Row 169 - mobile pre-check screen: "source not assigned" is drawn; no level of an input the selector does not hold

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `MOB` = `apps/mobile/src`. Names are those of
`decisions/161_selector_names_register.md` ("the register"); site M3 is that of
`research/027_selector_assumptions.md`.

## 1. What was built

| Subject | Before | Now |
|---|---|---|
| The closed rule list `START_RULES` (E35) | 7 members | 8: `sourceNotAssigned` added |
| The item of an unassigned slot (register 5.2: `value: 'NOT_ASSIGNED'`, `reasonCode: null`, `params { rule: 'sourceNotAssigned', slot }`, NO device id) | not recognised: the row read the raw value `NOT_ASSIGNED`, the blocked text "<check>: NOT_ASSIGNED" | recognised by `unassignedPrecheckSlotOf` (value, rule and slot; one of the four slots or nothing). `precheckSentence` words it: "Camera 1 has no source assigned. Assign one on Devices." - the slot by `common.captureSlot.<slot>`, the sentence by the mobile copy N15. The row (`CheckRow`) and the blocked text of the step both read `precheckSentence`, so both draw it with no further edit |
| All four slots (decision C25) | - | one recogniser and one sentence for `VIDEO-01`, `VIDEO-02`, `PRIMARY`, `STANDBY`. The STATUS is the Core's: the screen draws a BLOCK item as blocking (chip `BLOCK`, the danger alert, Next disabled, no acknowledge box) through the step's existing path; nothing here turns a status into another |
| `precheckUnreachableOf` | - | unchanged for every unreachable item; it answers null for the new rule (that rule names a slot, not a device), so an unreachable item can never be worded with the `{{slot}}` sentence |
| N15 `features.capture-selector.notice.start.sourceNotAssigned` | - | `'{{slot}} has no source assigned. Assign one on Devices.'`, equal to N13 (held by a test) |
| M3 `device-previews.tsx:118` | `micInputOfChannel`: the level of `MIC-01` / `MIC-02` for a channel without a line | `meterInputOfChannel` (row 164); `null` (no complete microphone pair): NO frame is read and the tile draws its existing "Not measured" words, no bars, no number |

Not changed: `PrecheckCaptureNotices` (the block of UNREACHABLE devices with "Search again"): an
unassigned slot is not an unreachable device, it gets no row there. `devices-check-step.tsx`,
`session-new-model.ts`, `development-source-badge.tsx`: they find a line by track, role or input and
answer null for an absent one (site M7 / M11 of row 27: SAFE), so the row of an empty slot draws no
role line and no badge.

## 2. Change set

| File | Change |
|---|---|
| `MOB/features/capture-selector/capture-notices-model.ts` | `START_RULES` (+1); `SOURCE_NOT_ASSIGNED_RULE`, `SOURCE_NOT_ASSIGNED_PRECHECK_VALUE`, `unassignedPrecheckSlotOf` (PENDING-SHARED); the type `UnreachableRule`; one guard in `precheckUnreachableOf`; two import names |
| `MOB/features/capture-selector/capture-notices.tsx` | `precheckSentence`: the sentence of the new item, first; one import line |
| `MOB/features/capture-selector/i18n.ts` | N15 (one key) |
| `MOB/features/session-new/device-previews.tsx` | the selector of `notMeasured` (site M3); the import name |
| `MOB/features/capture-selector/capture-notices-model.test.ts` | new block "task 4 row 169" (4 cases) |
| `MOB/features/capture-selector/precheck-capture-notices.test.tsx` | new block "task 4 row 169" (4 cases: four rows on the phone, the meters, the tablet device column, the standby alone); one control case on the seeded selector; `openGate` takes an optional window |

All edits with the Edit tool. No new dependency, no new component: the item is drawn by the
existing `ListGroup` row, `StatusChip` and `Alert` of the step.

## 3. Checks (this Mac; jest, no device)

| Check | Command (in `apps/mobile`) | Result |
|---|---|---|
| The two files of the row, first | `npx jest src/features/capture-selector/precheck-capture-notices.test.tsx src/features/capture-selector/capture-notices-model.test.ts --maxWorkers=2` | `Test Suites: 2 passed`, `Tests: 30 passed` |
| The suites of the two features (after the tablet case was added) | `npx jest src/features/session-new src/features/capture-selector --maxWorkers=2` | `Test Suites: 36 passed, 36 total`, `Tests: 427 passed, 427 total` |
| Typecheck | `npx tsc --noEmit` | run 1: exit 2, two errors, both in the new helper of the model test (a `slot: unknown` in `params`); after the fix: exit 0, and the model file again: `Tests: 18 passed` |
| Lint | `npx eslint` on the 6 files | exit 0 |
| The positional function in `MOB/features/session-new` | `grep -n micInputOfChannel src/features/session-new/*` | 0 lines |

The verification cell, line by line:

| Cell | Evidence |
|---|---|
| an item of the new rule without a device id is drawn as a blocking item | component case 1: four items with `status: BLOCK` and no `params.deviceId`; each row has the chip `BLOCK` and its sentence, never the raw value; the danger alert names the four; Next disabled; no acknowledge box. Model: the recogniser for the four slots |
| all four slots, the standby microphone too (C25) | component case "the standby microphone ALONE": `MIC_STANDBY` BLOCK with its sentence, Next disabled, nothing to acknowledge |
| with no microphone line no `MIC-01` or `MIC-02` level is read | component case 2: the selector holds 0 microphone lines, the meters slice still holds frames under the built-in inputs, both tiles draw "Not measured" and no meter; also for a lone PRIMARY line (last case) |
| phone and tablet | cases 1, 2 on the phone (previews above the list); case 3 on tablet landscape (the device column) |
| the session-new tests show 0 other changed results | no existing case edited; 36 suites green; the control case shows both meters on the seeded selector |

Simulated mode: the in-app simulator produces no such item (decision C21 (6)); on the seeded
selector the step is as before.

## 4. PENDING-SHARED (local constants until the shared names are taken)

| Local name (`capture-notices-model.ts`) | Shared name (row 163, register) | State at the end of this row |
|---|---|---|
| `SOURCE_NOT_ASSIGNED_RULE = 'sourceNotAssigned'` | N7 `CaptureStartRule.SOURCE_NOT_ASSIGNED` | seen in the working tree (`packages/shared/src/sim/capture-notices.ts`, agent A's row 163 in flight); not imported while that row is unchecked |
| `SOURCE_NOT_ASSIGNED_PRECHECK_VALUE = 'NOT_ASSIGNED'` | N8, same name | the same |
| `unassignedPrecheckSlotOf(item)` | N12 `unassignedSlotOfPrecheckItem(item)` | the same; the shared form also takes `status` in its parameter type, the answers are equal on the register's item |

The web console holds the same three under the same local names (`apps/core-web/src/lib/capture-notices.ts`,
row 167). One request line asks for the swap in both clients once row 163 is checked.

## 5. Double, and what stays unproven

The double: the in-app simulator's blocked gate, with the four items of register 5.2 and the
selector's lines put in place through the store. NOT proven here: a Core in its own capture
producing these items (rows 163, 30, 33), and the screen on a device (the milestone gate).
Nothing goes to the hardware package.

## 6. DRIVER DECISIONS (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | `capture-notices.tsx` was edited (one function) although the profile line names three files | the sentence of a pre-check item is built there (`precheckSentence`); claimed first |
| DD-2 | A meter channel without an input draws the tile's existing "Not measured" state, not "Not assigned" | with a lone line the SLOT is assigned and still no channel has an input (register 3.2); "Not measured" is true in both cases, and the row of the check says which slot is empty |
| DD-3 | The item is recognised whatever its status | the recogniser of the register (N12) reads value, rule and slot; BLOCK or WARN is the Core's ruling (C25: BLOCK) |
| DD-4 | `precheckUnreachableOf` answers null for an unreachable item that names the new rule | the copy of that rule has `{{slot}}`, not `{{device}}`; such an item is not produced by the Core (register 5.2) |
| DD-5 | No row for an unassigned slot in the "unreachable devices / Search again" block | a search finds devices, it assigns nothing; the remedy is in the sentence ("Assign one on Devices") |

## 7. Requirements

| Id | State |
|---|---|
| C18 (1), C25 | the mobile pre-check draws the item for all four slots as the Core states it |
| C18 (2), AD-04 | site M3 closed: `MOB/features/session-new` names the positional function 0 times |

---
*Generated: 2026-10-13*
