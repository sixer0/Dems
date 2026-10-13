---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 33
milestone: M2 / WP-13a
date: 2026-10-13
agent: test-expert (batch 8, agent V)
tier: T2
requirement: design addendum masterplan/04_design_addendum.md sections 1.5 and 1.7; security addendum verification/04_security_addendum.md section 3.1, AD-04 (3), AD-10 (4); decisions C14, C18, C21 (6), C25, C34
status: complete (tests only; one red in the file that is not this row's - section 7)
---

# Row 33: the 21-state table of the selector (7 categories by 3 capture operations), "the remedy is executable", "no recording without sources"

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server/src`, `SH` = `packages/shared/src`.

## 1. What was found, in one paragraph

The enumeration holds. In all 21 states the code does what the design addendum's table says about WHO boots and WHO records: 13 Cores start, 8 are refused by the fence (4 `DEV_SOURCE_WITHOUT_FLAG`, 4 `DEV_FLAG_WITH_PRODUCTION_SOURCE`), and exactly one real state lets a session start (the complete development selector in `REAL_DEVELOPMENT`). No state records a development source in `REAL_PRODUCTION`, a production source in `REAL_DEVELOPMENT`, a session of mixed classes, or a session with a slot unassigned. Four things differ from the addendum's wording (section 5): the four `SIMULATED` cells of categories 1 to 4 (as ruled by C21 (6) / C25), the CODE an operator is answered on an incomplete selector (`PRECHECK_BLOCKED`, not `SELECTOR_SHAPE`), the line that refuses state 6 x `REAL_PRODUCTION` today with a pre-check that passes first (finding F-3b), and the `SIMULATED` source rows (none are written). None is a way to record.

## 2. Method

**Derived first, compared second.** The outcomes were derived from the code before the addendum's table was read: `CS/capture/fence/boot.ts:144-158` (the decision), `CS/capture/fence/statements.ts:22-27` (the JOIN drops a NULL slot), `CS/capture/fence/operation.ts:71-81`, `CS/capture/fence/sources.ts:84-130`, `CS/modules/capture-config/plan.ts:120-155`, `CS/modules/capture-config/store.ts:104-109`, `CS/capture-session/index.ts:769-819`, `SH/sim/session-machine.ts:505-515,840-845`, `CS/modules/sessions/routes.ts:213-249`. The expected columns of both tables are written out by hand, state by state; no expectation is computed from a rule.

**Two levels.**

| Level | File, block | What a state is | What is asked |
|---|---|---|---|
| Lines of defence, each on its own | `CS/capture/fence/__tests__/fence.test.ts`, block "task 4 row 33" (unit, no database) | the double of the two tables with `null` for an unassigned slot; the registry the product builds for the operation | (1) the fence boot; (2) the plan builder `assertRecordableSelector` as if the boot had been bypassed; (3) the builder of the rows `buildSessionCaptureSources` handed slots that CLAIM an opener, as if the plan builder had been bypassed; (4) the read-back `assertSessionSourcesOfOperation` |
| The whole Core | `CS/capture/fence/__tests__/fence.db.test.ts`, block "task 4 row 33" (PostgreSQL, runtime role) | a clone of the seed with the category's selector stored; the real app factory, every boot step; ONE session through the product's own operations over the request pipeline (sign-in, create, start, start with the warnings acknowledged) | whether the Core boots and at which step and code it is refused; the answer of each start; the pre-check items; the session state; `RECORDING_STARTED` rows; `session_capture_sources` rows; how often a worker was started |

**The seven categories** (D = `FAKE`: `CAM-01`, `CAM-02`, `MIC-01`, `MIC-02`; P = `ONVIF_RTSP`: `CAM-11`, `CAM-12`, and `USB_AUDIO`: `MIC-11`, `MIC-12`; U = NULL):

| # | Category | VIDEO-01 | VIDEO-02 | PRIMARY | STANDBY |
|---|---|---|---|---|---|
| 1 | all four U | U | U | U | U |
| 2 | some U, the rest D | U | CAM-02 | MIC-01 | U |
| 3 | some U, the rest P | CAM-11 | U | U | MIC-12 |
| 4 | some U, D and P | CAM-01 | CAM-12 | MIC-11 | U |
| 5 | four assigned, all D (the seed) | CAM-01 | CAM-02 | MIC-01 | MIC-02 |
| 6 | four assigned, all P | CAM-11 | CAM-12 | MIC-11 | MIC-12 |
| 7 | four assigned, D and P | CAM-01 | CAM-12 | MIC-11 | MIC-02 |
| S-5 in 2 | three D, a lone unassigned STANDBY | CAM-01 | CAM-02 | MIC-01 | U |
| S-5 in 3 | three P, a lone unassigned STANDBY | CAM-11 | CAM-12 | MIC-11 | U |

The two S-5 selectors (security addendum 3.1; AD-10 (4)) are run beside the 21 and are not counted with them.

**Doubles.** The worker: after the boot the capture seam is a supervisor on the `FakeWorkerProcess` launcher, so a worker start is a counted call and nothing is recorded. In `REAL_DEVELOPMENT` the registry is the product's builder over what the boot read, with the scripted helper door (as `development-session.db.test.ts`): no helper program is started for a session, no camera or microphone is listed, opened or asked for. The production device rows (no address) and the selectors that name them are written by the owner into the clone before the boot. The operators' own passwords of a `REAL_PRODUCTION` clone are written by the owner from a run-time value kept nowhere. No real camera, microphone, credential, address or host was touched; nothing of this row goes to the hardware package.

## 3. The 21 states, as observed

Columns: **boot** as seen on PostgreSQL (step and code of a refusal, with the registry ids it names); **start** = the answer of the second start through the request pipeline (the first, from CREATE, is `202 PRECHECK` in every state that boots); **rows / workers** = `session_capture_sources` rows of the session / calls of the worker launcher; **plan** and **builder** = the two later lines asked on their own in the unit table. Every state is asserted by the `it.each` case of its name in both files ("`<n>. <category> x <operation>`").

| # | State | Boot | Pre-check | Start (operator's answer) | Session | Rows / workers | Plan builder alone | Row builder alone |
|---|---|---|---|---|---|---|---|---|
| 1 | 1 x REAL_PRODUCTION | boots; 1 `SYSTEM_BOOT` | BLOCK: 4 items "source not assigned" | 409 `PRECHECK_BLOCKED` | PRECHECK | 0 / 0 | `SELECTOR_SHAPE` | refused |
| 2 | 1 x REAL_DEVELOPMENT | boots; 1 `SYSTEM_BOOT` | BLOCK: 4 items | 409 `PRECHECK_BLOCKED` | PRECHECK | 0 / 0 | `SELECTOR_SHAPE` | refused |
| 3 | 1 x SIMULATED | boots; no boot row | WARN, 0 BLOCK, no such item | 200 `RECORDING` | RECORDING | 0 / none exists | `SELECTOR_SHAPE` | refused |
| 4 | 2 x REAL_PRODUCTION | **refused** `capture.fence` `DEV_SOURCE_WITHOUT_FLAG` [CAM-02, MIC-01] | - | no Core | - | 0 / - | `SELECTOR_SHAPE` | refused |
| 5 | 2 x REAL_DEVELOPMENT | boots; 1 `SYSTEM_BOOT` | BLOCK: VIDEO-01, STANDBY | 409 `PRECHECK_BLOCKED` | PRECHECK | 0 / 0 | `SELECTOR_SHAPE` | refused |
| 6 | 2 x SIMULATED | boots | WARN, 0 BLOCK | 200 `RECORDING` | RECORDING | 0 / - | `SELECTOR_SHAPE` | refused |
| 7 | 3 x REAL_PRODUCTION | boots; 1 `SYSTEM_BOOT` | BLOCK: VIDEO-02, PRIMARY | 409 `PRECHECK_BLOCKED` | PRECHECK | 0 / 0 | `SELECTOR_SHAPE` | refused |
| 8 | 3 x REAL_DEVELOPMENT | **refused** `DEV_FLAG_WITH_PRODUCTION_SOURCE` [CAM-11, MIC-12] | - | no Core | - | 0 / - | `SELECTOR_SHAPE` | refused |
| 9 | 3 x SIMULATED | boots | WARN, 0 BLOCK | 200 `RECORDING` | RECORDING | 0 / - | `SELECTOR_SHAPE` | refused |
| 10 | 4 x REAL_PRODUCTION | **refused** `DEV_SOURCE_WITHOUT_FLAG` [CAM-01] | - | no Core | - | 0 / - | `SELECTOR_SHAPE` | refused |
| 11 | 4 x REAL_DEVELOPMENT | **refused** `DEV_FLAG_WITH_PRODUCTION_SOURCE` [CAM-12, MIC-11] | - | no Core | - | 0 / - | `SELECTOR_SHAPE` | refused |
| 12 | 4 x SIMULATED | boots | WARN, 0 BLOCK | 200 `RECORDING` | RECORDING | 0 / - | `SELECTOR_SHAPE` | refused |
| 13 | 5 x REAL_PRODUCTION | **refused** `DEV_SOURCE_WITHOUT_FLAG` [CAM-01, CAM-02, MIC-01, MIC-02] | - | no Core | - | 0 / - | `NO_ADAPTER` CAM-01 | refused |
| 14 | 5 x REAL_DEVELOPMENT | boots; 1 `SYSTEM_BOOT` | PASS | **200 `RECORDING`** | RECORDING | **4 (all `FAKE`) / 1** | recordable | 4 rows, class DEVELOPMENT |
| 15 | 5 x SIMULATED | boots | PASS | 200 `RECORDING` | RECORDING | 0 / - | `NO_ADAPTER` | 4 rows, all `FAKE` |
| 16 | 6 x REAL_PRODUCTION | boots; 1 `SYSTEM_BOOT` | **PASS, 0 BLOCK** | 409 `INVALID_STATE`, reason `SOURCE_KIND_NOT_RECORDABLE`, cause `NO_ADAPTER` | ARMED | 0 / 0 | `NO_ADAPTER` CAM-11 | refused `SOURCE_KIND_NOT_RECORDABLE` |
| 17 | 6 x REAL_DEVELOPMENT | **refused** `DEV_FLAG_WITH_PRODUCTION_SOURCE` [CAM-11, CAM-12, MIC-11, MIC-12] | - | no Core | - | 0 / - | `NO_ADAPTER` CAM-11 | refused |
| 18 | 6 x SIMULATED | boots | PASS | 200 `RECORDING` | RECORDING | 0 / - | `NO_ADAPTER` | 4 rows, all `FAKE` |
| 19 | 7 x REAL_PRODUCTION | **refused** `DEV_SOURCE_WITHOUT_FLAG` [CAM-01, MIC-02] | - | no Core | - | 0 / - | `NO_ADAPTER` CAM-01 | refused |
| 20 | 7 x REAL_DEVELOPMENT | **refused** `DEV_FLAG_WITH_PRODUCTION_SOURCE` [CAM-12, MIC-11] | - | no Core | - | 0 / - | `NO_ADAPTER` CAM-12 | refused |
| 21 | 7 x SIMULATED | boots | PASS | 200 `RECORDING` | RECORDING | 0 / - | `NO_ADAPTER` | 4 rows, all `FAKE` |
| S-5 | three D, STANDBY U x REAL_DEVELOPMENT | boots | BLOCK: STANDBY only | 409 `PRECHECK_BLOCKED` | PRECHECK | 0 / 0 | `SELECTOR_SHAPE` | refused |
| S-5 | three P, STANDBY U x REAL_PRODUCTION | boots | BLOCK: STANDBY only | 409 `PRECHECK_BLOCKED` | PRECHECK | 0 / 0 | `SELECTOR_SHAPE` | refused |

**Count: 21 of 21 states asserted, on both levels** (plus the two S-5 selectors: 6 unit cases, 2 database cases).

What every row of the table also asserts: a refused boot writes no `SYSTEM_BOOT` row, no source row and leaves the stored selector as it was; a Core that boots passed the steps `capture.fence`, `capture.boot`, `capture.config` and `engine.rehydrate` by name (in `SIMULATED`: `capture.config`, `engine.rehydrate`) and holds exactly the stored lines; a refused start wrote no `RECORDING_STARTED` row; in `SIMULATED` the Core holds no registry (`captureFenceControl.registry()` is null).

"Plan builder alone" in the `SIMULATED` rows is asked against the EMPTY registry of that operation, which stands in for "no registry": the product never asks it there (`CS/capture-session/index.ts:770`).

## 4. The four statements of the row

| Statement | Held by | Result |
|---|---|---|
| In no state a development source records in `REAL_PRODUCTION` | unit summary case "over the 21 states (and S-5)"; database states 4, 10, 13, 19 (no Core) and 1, 7, 16 (0 rows, 0 workers) | holds |
| In no state a production source records in `REAL_DEVELOPMENT` | the same summary; database states 8, 11, 17, 20 (no Core) and 2, 5, 14 (state 14 writes 4 rows, all `FAKE`) | holds |
| No session mixes source classes | the summary (rows of one class, or none); categories 4 and 7 are refused at boot in both real operations and by both later lines | holds |
| No session starts with an unassigned slot in real capture (C25: all FOUR, the STANDBY too) | database states 1, 2, 5, 7 and both S-5: 409, 0 rows, 0 workers, one BLOCK item per unassigned slot; unit: `SELECTOR_SHAPE` and "not four" for every incomplete selector, the read-back refusing fewer than four rows in all three operations | holds |
| `SIMULATED` starts as today on an incomplete selector (C21 (6)) | database states 3, 6, 9, 12: 200 `RECORDING`, no "source not assigned" item | holds, as ruled |
| "No recording without sources": categories 1 to 3 in each real operation, worker started 0 times, 0 source rows | states 1, 2, 5, 7 (0 / 0) and 4, 8 (no Core, 0 rows) | holds |

**The question of row 158: does any path RECORD with a slot missing? No.** Stated explicitly, with what closes each path:

1. A session that is open keeps its slots: an unassign is `409 CAPTURE_CONFIG_LOCKED` from the session's creation on (row 158; re-asserted on an ARMED session in the last database case).
2. A session OPENED on a selector that already lacks a slot (the loser of row 158's race) stops at the pre-check: one BLOCK item per empty slot, `409 PRECHECK_BLOCKED`, session stays PRECHECK, 0 `RECORDING_STARTED`, 0 source rows, 0 workers (states 1, 2, 5, 7, S-5).
3. A slot emptied BEHIND the Core while a session is ARMED reaches the engine only at a restart, and a restart takes the open session to FAULT: `409 INVALID_STATE`, 0 rows, 0 workers, in `REAL_DEVELOPMENT` and (all four emptied) in `REAL_PRODUCTION` (database case "NO PATH RECORDS WITH A SLOT MISSING").
4. Behind those, each asked on its own: the shared start rule (`SH/sim/session-machine.ts:840-845`, held in `packages/shared/test/sim-capture-start.test.ts`, row 163), the plan builder (`plan.ts:124-126`), the builder of the rows (`sources.ts:123`) and the read-back (`sources.ts:122-123`) - the last three in this row's unit block.

## 5. Findings: where the code differs from the designed table

| # | State(s) | Designed (addendum 1.5) | Observed | Where | Weight |
|---|---|---|---|---|---|
| F-1 | 1, 2, 3, 4 x SIMULATED | "boots; start refused (1.4 #4)" | boots; the start is ACCEPTED (200 `RECORDING`) | `SH/sim/session-machine.ts:840` (the refusal is inside `isOwnCaptureCoreState`) | none: decisions C21 (6) and C25 amend exactly these four cells, and the blueprint cell of row 33 says so |
| F-2 | 1 and 3 x REAL_PRODUCTION, 1 and 2 x REAL_DEVELOPMENT, both S-5 | "session start refused (`SELECTOR_SHAPE`, `plan.ts:124-126`)" | the operator is answered `409 PRECHECK_BLOCKED`, details `{ from: PRECHECK, event: startRecording }`. The session never reaches ARMED, so neither `plan.ts:124-126` nor the shared reason `CAPTURE_SOURCE_NOT_ASSIGNED` (`session-machine.ts:843`) is reached at a booted Core by any path this row could build (product, or restart: section 4 item 3). Rows 29, 158 and 163 expected row 33 to show `details.reason` at a real Core: it cannot be shown | `SH/sim/session-machine.ts:505-515`; `CS/modules/sessions/routes.ts:231` | LOW. The start is refused and nothing records. A client that waits for the reason code on the START answer never gets it; it must read the pre-check item. For the controller |
| F-3a | 6 x REAL_PRODUCTION | "before [the lift] refused (`sources.ts:86,106`)" | refused one line earlier: `409 INVALID_STATE`, `details.reason: SOURCE_KIND_NOT_RECORDABLE`, `details.cause: NO_ADAPTER`, from the plan builder, because the production registry serves no device | `CS/modules/capture-config/plan.ts:140-142`; `CS/capture/fence/index.ts:335-338` | none: same outcome; `sources.ts:86` is held by the unit table as the next line |
| F-3b | 6 x REAL_PRODUCTION | (not stated) | **the pre-check ends PASS with 0 BLOCK items**, the session is ARMED, and only the start answers 409. The production registry hands the pre-check gate no probe (`probeAdapters: () => null`), so four devices no adapter serves are asked nothing | `CS/capture/fence/index.ts:337`; `CS/capture-notices/precheck.ts:130` (`NOT_ASKED`) | LOW to MEDIUM for the operator, none for evidence (0 rows, 0 workers). It is the experience C25 removed for an unassigned slot. It ends when the production registry serves the devices. Not fixed here; a request line is left |
| F-4 | 1 to 7 x SIMULATED | "its four rows are written as `FAKE` (`sources.ts:103,127`)" | a started `SIMULATED` session writes 0 rows to `session_capture_sources`: the session start returns before the builder is asked. The builder WOULD make four `FAKE` rows (unit table) | `CS/capture-session/index.ts:770` | none for the proof ("`SIMULATED` opens no source at all" holds); the addendum's sentence describes the builder, not the Core |
| F-5 | 6 x REAL_PRODUCTION | "records production sources once the lift has landed" | records nothing today: `OPENER_CAPABLE_KINDS` holds `FAKE` and `LOCAL_DEVICE` only and `buildProductionRegistry` registers no adapter, although decision U15 released the lift | `CS/capture/adapters/registry.ts:36`; `CS/capture/fence/index.ts:335-338` | expected: the lift is rows of WP-13b / 13c. The unit expectation of this one cell follows `OPENER_CAPABLE_KINDS` and the registry's own list, so it does not turn red the day the lift lands |

No source defect of the fence was found. No fence file was edited.

## 6. "The remedy is executable" (database case of that name)

| Step | By | Observed |
|---|---|---|
| 0. The state the remedy is for: the seeded selector under a production configuration | the boot | refused at `capture.fence`, `DEV_SOURCE_WITHOUT_FLAG`; the message holds the remedy's own sentence; 0 boot rows |
| 1. "Start once with the flag" | the boot in `REAL_DEVELOPMENT` | passes; 1 `SYSTEM_BOOT` row `REAL_DEVELOPMENT` |
| 2. "Unassign them" | **operation 78**, `{ unassign: [four slots] }`, TECHNICIAN on the web console | 200; the stored row is six NULLs; 4 `CAPTURE_CONFIG_CHANGED` rows without `to` |
| (operators get credentials of their own - addendum step (b), X-2) | the owner, as a fixture: NOT an operation of the product in this test | - |
| 3. "Then start without the flag" | the boot in `REAL_PRODUCTION` | passes `capture.fence`, `capture.boot`, **`capture.config` by name** (AD-04 (3)) and `engine.rehydrate`; the boot rows are `[REAL_DEVELOPMENT, REAL_PRODUCTION]`: ONE for the production boot; the selector is two empty lists |
| 4. "Assign production devices" | operation 78 on the production Core | **STOPS HERE TODAY.** `CAM-11` on `VIDEO-01`: `422 INVALID_INPUT`, `details.reason: CAPTURE_DEVICE_NOT_SERVED`. `MIC-11` as PRIMARY: the same. Nothing stored (six NULLs). A development source (`CAM-01`) stays `422` |
| 5. A session start | the product | `409 PRECHECK_BLOCKED`, four "source not assigned" BLOCK items, 0 rows, 0 workers |

**Where it stops and why.** Steps 0 to 3 and 5 run through the product's own operations. Step 4 stops at the registry of the running operation: `buildProductionRegistry` (`CS/capture/fence/index.ts:335-338`) registers NO adapter while the production adapters are class-C stubs, so `registry.list()` is empty in `REAL_PRODUCTION`, every production device is unknown to it and operation 78 answers `CAPTURE_DEVICE_NOT_SERVED` (`CS/modules/capture-config/routes.ts:131`). The test reads the registry's own list: the day it serves `CAM-11` the same call is expected to answer 200, with no edit of the test.

Two things of the sequence are not product operations in this test and are said so in the file: the production device rows (written by the owner: adoption needs a camera that answers, and the fake ONVIF stub is refused in production; microphone registration needs a Linux sound card) and the operators' own passwords.

Not shown here: that the Devices page of either client offers the unassign (the refusal text says "on the Devices page"); that is rows 167 and 169.

## 7. Run evidence (this Mac; PostgreSQL 18.4 on 127.0.0.1:4432; throw-away databases under `.locks/db-migrate.lock`; sandbox off for the database runs)

| Command (from `apps/core-server`) | Result line |
|---|---|
| `npx vitest run --project unit --maxWorkers=2 src/capture/fence/__tests__/fence.test.ts` | one run: `Test Files 1 passed (1)`, `Tests 99 passed (99)` (30 new: the enumeration, 21 states, 6 S-5, the summary, the read-back) |
| `/usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock npx vitest run --project db --maxWorkers=2 src/capture/fence/__tests__/fence.db.test.ts` | run 1: `2 failed, 40 passed (42)`; run 2: `2 failed, 40 passed (42)`; run 3: `Tests 1 failed, 41 passed (42)`, `0 remain with the run prefix`. All 21 states, both S-5 and the remedy passed in every run. The red of runs 1 and 2 that was this row's was in ONE new case (the restart: first its manual clock stood behind the stored state, then it expected ARMED where a restart gives FAULT - section 4 item 3); a third run was taken for that reason. **The one red left is not this row's**: `fence.db.test.ts:114`, the existing pin `[7, 'dbc-8']`, reads `[8, 'dbc-9']` since schema set B (agent D, rows 99 / 100) |
| the same command with `-t "THE REMEDY IS EXECUTABLE"` | `Tests 1 passed, 41 skipped (42)`: one case re-run after a lint-only change of two of its assertions |
| `npx vitest run --project unit --maxWorkers=2 src/capture/fence src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts test/static` | `Test Files 1 failed, 21 passed (22)`, `Tests 1 failed, 408 passed (409)`. The red: `test/static/search-path.test.ts:94`, the exact list lacks `src/db/migrations/0018_network_commissioning_privileges.sql` (agent D; not a file of this row) |
| `npx tsc --noEmit -p .` | no error line (run after the last edit) |
| `npx oxlint` on the three test files | exit 0 |
| `shasum` of `fence/boot.ts`, `fence/operation.ts`, `fence/sources.ts`, `fence/index.ts`, `capture-config/plan.ts`, `capture-config/store.ts` before the first edit and after the last | identical, 6 of 6 |
| `git diff --stat` of the three fence files | `fence/boot.ts`: empty. `fence/operation.ts`: empty. `capture/boot/checks.ts`: 56 insertions against HEAD, none of this row - the additive host checks of row 80 (batch 7, uncommitted) and whatever row 81 added; its checksum changed while this row ran. This row wrote no line of it |

The observed lines of section 3 are the test's own print of run 1 (`[row33] the states as observed on PostgreSQL`), identical in run 2.

No boot of this row was refused by a `CAPTURE_HOST_*` code: row 81's wiring had not reached `capture/boot/index.ts` when the runs were made. If it does, the 5 production states that boot (1, 7, 16, S-5, and the remedy and restart cases) are where it would show.

## 8. Change set

| File | Change |
|---|---|
| `CS/capture/fence/__tests__/fence.test.ts` | two import lines widened; one new block at the end, 30 cases |
| `CS/capture/fence/__tests__/fence.db.test.ts` | the import list; one new block at the end, 26 cases |
| `CS/capture/fence/__tests__/support.ts` | the test type `Selector`: four members `string \| null`, and the one tuple type that reads them. The double's behaviour is unchanged (a `null` matches no device, as the JOIN) |

All three with the Edit tool. No production file.

## 9. Driver decisions, assumptions, gaps

- DRIVER DECISION: the type `Selector` of the fence's test support was widened (one more file than the brief names, inside `__tests__`), so that an unassigned slot is `null` in the double and not a cast.
- DRIVER DECISION: the cell 6 x `REAL_PRODUCTION` and step 4 of the remedy follow the registry's own statements (`OPENER_CAPABLE_KINDS`, `registry.list()`) and do not pin "refused" as a date. Today's value is asserted while those statements are what they are.
- DRIVER DECISION: the existing red pin at `fence.db.test.ts:114` was not edited (a shared pin of the schema version; its writer is agent D).
- Assumption: a production device row without an address is a fair stand-in for an adopted camera in these states; no state of the table dials it. Requirement AD-02 (the stored address held to the destination rule) is not a subject of this table: it needs an adapter that opens, which is state 6 x `REAL_PRODUCTION` after the lift (rows of WP-13b / 13c).
- Gap: the record of row 188 (`implementation/188_superseded_report_one_notice.md`) did not exist when this row ran (agent P in flight); pairing (C34) is not reached in any of the 21 states today, because the plan builder refuses state 6 x `REAL_PRODUCTION` before the C34 check of `CS/capture-session/index.ts:792`.
- Unproven here, by design: state 6 x `REAL_PRODUCTION` RECORDING (after the lift, with adapters that open: the full session of WP-13c, and the hardware checks 9A); the two clients' drawing of the BLOCK item and of the unassign offer (rows 167, 169).

## 10. Identifiers

Closed by test: addendum 1.7 "the table of 1.5: 21 of 21" (with the four `SIMULATED` cells by C21 (6) / C25), "the remedy is executable" up to the registry (section 6), "no recording without sources"; AD-04 (3) (`capture.config` by name on the production boot of the unassigned clone); AD-10 (4) (S-5 in the table, `SELECTOR_SHAPE` "exactly four"). Left as they were: "fence unchanged" for `checks.ts` (rows 80, 81); 1.4 #7 and "Set A" of the 1.7 list (other rows).

---
*Generated: 2026-10-13*
