---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 29
package: WP-13a (milestone M2)
date: 2026-10-13
agent: coder-execution
tier: T3
status: complete
---

# Row 29 - server capture-config module: an unassigned selector slot at the store, the slices and operation 78

Abbreviations: `CS` = `apps/core-server/src`, `SH` = `packages/shared/src`. Sites A1, A2 are those of `research/027_selector_assumptions.md`.

## 1. Statement

| Site | Where | Before | Now |
|---|---|---|---|
| A1 | `CS/modules/capture-config/store.ts` `recordOf` (the hand-written parse behind `READ_CAPTURE_STATE`) | `text()` threw `CAPTURE_ROW_INVALID` for a NULL slot: the boot step `capture.config` stopped the start | a JSON null (or a member the aggregate left out) is handed on as `null`; anything else that is not text is still refused by member name. The statement itself is unchanged |
| A2 | `CS/modules/capture-config/slices.ts` `CaptureConfigRecord`, `captureConfigSliceOf` | six members `string`; `byId.get(null)` threw `CAPTURE_DEVICE_UNKNOWN`, `micInputOf(null)` threw | six members `string \| null` (register E15); a `null` slot is an ABSENT line. A camera line is made for its track from the columns of that track, a mic line for its role from the column of that role: nothing by position (AD-04 (2)). Six NULLs answer two empty lists, which is not the built-in baseline (that stands for a table without a row) |
| Operation 78 | `CS/modules/capture-config/routes.ts`, the handler of `updateCaptureConfig` | forwarded `cameras` and `mics` only: `{ "unassign": [...] }` answered 200 with nothing changed and no audit row | forwards `unassign` to the hosted action `setCaptureConfig` (row 162). Same permission, same lock read before the action, same audit type; `assertAssignable` has no device to ask about |

**The interim state "unassign accepted but nothing changes" is ended.** Measured at a booted Core on PostgreSQL: the slot's columns are NULL after the call, the answer has no line for the slot, one `CAPTURE_CONFIG_CHANGED` row is stored.

An unassigned slot is never a line with an empty device, and the store invents no device or input for it. Fail closed is kept: half a video pair (a device without a profile or the reverse) is refused `CAPTURE_ROW_INVALID` with `trackId` and the missing `member` (the same reading as row 166's driver decision 2); an unknown device and a mic outside the `MIC-NN` form beside an empty slot are refused as before.

`plan.ts` is NOT edited. Read and confirmed: `assertRecordableSelector` (`plan.ts:120-126`) refuses every selector with an unassigned slot as `CAPTURE_PLAN_INVALID` / `SELECTOR_SHAPE`, before the registry is asked, for each of the four slots (the STANDBY included, state S-5), and that is the same set of selectors the shared rule refuses (`unassignedSlotsOf` with `CAPTURE_START_REQUIRED_SLOTS`, four of four since C25). Held by a new case in `plan.test.ts`.

The capture fence files `CS/capture/fence/boot.ts`, `operation.ts` and `CS/capture/boot/checks.ts` are not edited and needed no change: `git diff --stat` of the three is empty; their unit and database tests pass unchanged (section 3).

## 2. Change set

| File | Change |
|---|---|
| `CS/modules/capture-config/store.ts` | `recordOf`: the helper `slot()` (text or null) in place of `text()` for the six slot members; header paragraph |
| `CS/modules/capture-config/slices.ts` | `CaptureConfigRecord` six members nullable; `captureConfigSliceOf`: `camera()` and `mic()` answer zero or one line; the half-pair refusal; comments |
| `CS/modules/capture-config/routes.ts` | one spread line in the handler of operation 78; header paragraph on `unassign` |
| `CS/modules/capture-config/__tests__/slices.test.ts` | one new `describe`, 5 cases |
| `CS/modules/capture-config/__tests__/plan.test.ts` | one import line; one new case |
| `CS/modules/capture-config/__tests__/routes.test.ts` | two import lines; one new `describe`, 8 cases (4 by `it.each`) |
| `CS/modules/capture-config/__tests__/capture-config.db.test.ts` | one import line; one new `describe`, 8 cases; ONE line taken out of an existing case (section 5, decision 1) |

Not edited: `plan.ts`, `boot.ts`, `index.ts`, `support.ts` of the module (claimed "only if needed": not needed); the three fence files; `CS/db/schema/capture.ts` (the seam `slotColumn`) and `CS/db/mapping/rows.ts` (both outside the Ownership Area: request left); `packages/shared`; any seed or fixture; any static-rule list; `capture-session/`.

## 3. Verification and evidence

All runs `--maxWorkers=2`. Database runs: sandbox off, under `/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock`, throw-away databases of the test helper on this Mac's PostgreSQL 18.4 ("0 remain with the run prefix" after each); no `db:migrate`, the demo and lane databases were not reached. The seed is unchanged and fully assigned: every NULL was written into a clone, by the owner as a fixture or by the product through operation 78.

| # | Command | Result |
|---|---|---|
| 1 | `npx vitest run --project unit src/modules/capture-config/__tests__/slices.test.ts .../plan.test.ts .../routes.test.ts` | run 1: `3 failed \| 55 passed (58)` - two faults of the new test code (an import path, a rule comparison that included the route's own path) and the known red of section 6; run 2 of `routes.test.ts` after the fix: `1 failed \| 23 passed (24)`, the one failure being the known red |
| 2 | `npx vitest run --project db src/modules/capture-config/__tests__/capture-config.db.test.ts` | run 1: `2 failed \| 23 passed (25)` (an existing case that pinned the rule C21 (8) replaced, section 5 decision 1; and the new session case, whose bed had no tablet link); run 2: `Tests 25 passed (25)` |
| 3 | `npx vitest run --project unit src/modules/capture-config src/capture/__tests__/static.test.ts test/static` | `2 failed \| 334 passed (336)` in 24 files: the two known reds of section 6, nothing else |
| 4 | `npx vitest run --project unit src/modules/capture-discovery/__tests__/search.test.ts src/capture/fence/__tests__/fence.test.ts` | `Test Files 2 passed (2)`, `Tests 71 passed (71)` |
| 5 | `npx vitest run --project db src/capture/__tests__/boot.db.test.ts src/capture/fence/__tests__/fence.db.test.ts` | `Test Files 2 passed (2)`, `Tests 20 passed (20)`: the fence and the boot checks, 0 changed results |
| 6 | `npx tsc --noEmit -p .` in `apps/core-server` | run 1: 1 error in a new test line (`routes.test.ts`, a parameter type); run 2: 0 errors |

One debug run of a single case (`-t`) was made between runs 1 and 2 of line 2 to read the pre-check items; its temporary line is removed.

| Cell of the row / of the brief | Test | Result |
|---|---|---|
| GATE CONDITION AD-04: the boot step `capture.config` passes on a selector row of six NULLs | `slices.test.ts` "GATE CONDITION AD-04" (`runCaptureConfigBoot`, 0 lines in the log and the error log; `builtInBaseline: false`); `capture-config.db.test.ts` block "task 4 row 29", case 1 by `it.each`: SIMULATED, REAL_DEVELOPMENT, REAL_PRODUCTION - a whole boot, the steps `capture.config` and `engine.rehydrate` in the "boot step passed" lines, the selector two empty lists in the load, the engine and operation 76 | pass, 3 of 3 operations |
| A Core with a NULL slot boots (the two former boot-stoppers) | the same, plus "AD-04 (2)": only `VIDEO-02` and only a STANDBY microphone stored, in SIMULATED and REAL_DEVELOPMENT: those two lines and no other; and case 2b: REAL_PRODUCTION with one production camera and three slots unassigned (category 3 of addendum 1.5) | pass |
| Operation 78 `unassign` of each of the four slots persists a NULL and returns the slice with the absent line | db case 2a (SIMULATED on the seed): per slot 200, the answer without the line, the stored row compared column for column; unit `it.each` over the four slots | pass |
| Re-assigning works | db case 2a: after a restart on six NULLs, `VIDEO-01`, then STANDBY alone (C21 (8)), then `VIDEO-02` with PRIMARY: the stored row equals the seeded one; four rows without `from` | pass |
| An unassign of two slots writes 2 entries, of an empty slot 0 | unit "GATE CONDITION"; db case 2a (four clears = four rows; the four again = 0); db case 2b (one held and one empty in one body = 1 row) | pass |
| The audit entry of each, with the closed detail keys | exact `details` compared: `{ operationId, scope, field: 'SOURCE', trackId \| inputId, from, permission }`; unit: every key held to `detailRulesOf('CAPTURE_CONFIG_CHANGED')`; db: stored by the real engine, whose trail refuses any other key; chain links and verifies | pass |
| An unassign while a session is open is refused with 0 audit rows | unit lock table: 8 session states (every state but SEALED) x 5 bodies = 40 answers, all `409 CAPTURE_CONFIG_LOCKED`, the action never called, same audit list, same selector; controls SEALED and no session accepted. db case 3: a real session in CREATE and in RECORDING, 5 bodies each, trail length and stored row unchanged | pass |
| A start on an incomplete selector: refused in real capture by the plan builder, same as the shared pre-check for all four slots (C25) | `plan.test.ts` "AD-10 (4), C25": 15 of 15 incomplete selectors `SELECTOR_SHAPE` in the three operations, registry asked 0 times; agreement with the shared rule on 16 of 16 | pass |
| ... and starts as today in Simulated mode | db case 3: STANDBY unassigned through operation 78, pre-check 0 BLOCK items, no `NOT_ASSIGNED` item, `MIC_STANDBY` WARN; `startRecording` gives `RECORDING` | pass |
| Every existing capture-config test passes unchanged | lines 1 to 3: all existing cases pass except the known red; one existing db case had one line removed (section 5) | see section 5 |

Doubles: the stand-in worker script and `/bin/echo` helper of the existing real-boot fixture (never asked to capture); production device rows written by the owner into a clone; a run-time password for the production clone's operators. Nothing of this row goes to the hardware package.

Not proven here: a session start at a Core in REAL capture on an incomplete selector (the 409 and its `details.reason`, worker started 0 times) - rows 30, 33; the 21-state table - row 33; "the remedy is executable" end to end - row 158.

## 4. AD-10, point by point

| Point | State |
|---|---|
| (1) one audit row per cleared slot with the track or input and `from`; none for an empty slot | done at the Core (the action is row 162's; counted through operation 78 here, unit and PostgreSQL) |
| (2) refused `409 CAPTURE_CONFIG_LOCKED` in every session state but none and SEALED, sealing states included | done: unit table of 8 states; PostgreSQL for CREATE and RECORDING. The existing lock of `routes.ts` covers `unassign` with no new code |
| (3) a body that unassigns and assigns the same slot is 422 | done at the Core: by the schema (row 28) with no unit run; by the action with `details.reason: SLOT_UNASSIGNED_AND_ASSIGNED` (row 162), the unit rolled back |
| (4) `SELECTOR_SHAPE` stays "exactly four"; the 21-state table includes S-5 | `plan.ts` unchanged and held for all four slots, S-5 by name; the 21-state table is left to row 33 |
| (5) the client kinds of operation 78 as a decision | unchanged, as the register states (E1): the registry entry is not edited, the guard's rule of operation 78 equals that of operations 79 and 80 beside the route itself; INVESTIGATOR and an anonymous caller never reach the handler |

## 5. Driver decisions (for the controller to confirm)

1. **One line of an existing database case was removed.** `capture-config.db.test.ts`, case "D133 (1) ... REAL_DEVELOPMENT: MIC-03 is selected through the API": its list of bodies that must answer 422 began with one mic line by role. That body is valid since C21 (8) (register 4.2; rows 28 and 162) and answered 200, so the case was red before any code of this row. The line is removed with a comment; nothing else of the case changed.
2. Half a video pair read from the stored row is refused `CAPTURE_ROW_INVALID` (not read as an unassigned slot), as the row mapping does.
3. An empty text in a slot column is not "nothing assigned": only NULL is; it is refused as an unknown device.
4. A camera assigned into an empty track without `profile` keeps the action's `CAPTURE_CONFIG_EMPTY_SLOT_PROFILE`: the Core has no stored profile code of a device before row 51.
5. The request example with `unassign` and the removal of the type seam are requested, not done: both files are outside the Ownership Area.
6. The known red `routes.test.ts:62` was left as it is, as the brief says.

## 6. Reds seen, not of this row

| File:line | Cause |
|---|---|
| `CS/modules/capture-config/__tests__/routes.test.ts:62` (was `:59`) | row 70's two routes under `/capture/audio-cards`; the fix is two strings in the constant `OTHER_UNITS` of that case |
| `apps/core-server/test/static/search-path.test.ts:94` | agent H's `src/capture/adapters/audio/alsa-config-writer.ts` is not in the exact list (already reported by row 70) |

## 7. Requests and identifiers

Seven lines in `delegation_progress/file_requests.md`: the answers to rows 28, 162 and 166; the seam removal; the request example; the known red; the edited existing case; the information for rows 30, 33, 158.

Closed: AD-04 at sites A1 and A2 (with row 166's A3 to A5: 5 of 5 column sites; AD-04 (3) at the step `capture.config` by name); AD-10 (1), (2), (3), (5) at the Core; C14's reading "a production Core with unassigned slots boots" on the server; register E15, and N1 as read by row 29. Open by design: AD-10 (4)'s table and the real-capture start (row 33); AD-04 (4), the inventory test (row 149).
