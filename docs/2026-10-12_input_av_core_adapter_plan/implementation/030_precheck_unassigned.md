---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 30
milestone: M2 / WP-13a
date: 2026-10-13
agent: coder-execution (batch 7, agent S)
tier: T3
requirement: decision C18 (1) (re-ownership: the item is decided in the shared session machine, row 163); C21 (6) (Simulated mode unchanged); C25 (four slots, the STANDBY too); research/027 section 4
status: complete (tests only; `precheck.ts` needs no change)
---

# Row 30: the Core-side pin of the pre-check on a selector with an unassigned slot

## 1. Statement

`apps/core-server/src/capture-notices/precheck.ts` NEEDS NO CHANGE, and none was made: `git diff --stat -- apps/core-server/src/capture-notices/precheck.ts` prints nothing (0 lines).

Why, measured at a booted Core: the gate reads the selector, collects the device ids of its LINES (`precheck.ts:171-173`) and asks each. A slot without a source has no line, so the gate has no device to ask for it: it finds nothing unreachable, starts no search and writes no `CAPTURE_DEVICE_UNREACHABLE` row. The run then goes to the hosted action, where the shared session machine (`evaluatePrecheck`, row 163) says BLOCK for the slot. The gate neither hides the item nor stands in for it.

## 2. What was built

One new file, tests only: `apps/core-server/src/capture-notices/__tests__/precheck-unassigned.db.test.ts` (database project), 8 cases.

| Case | Core | Stored selector | Held |
|---|---|---|---|
| 1 | - | - | the slots a start needs are the four of the selector (C25) |
| 2 to 5 (`it.each`) | REAL_DEVELOPMENT, generated sources | one slot NULL, each of VIDEO-01, VIDEO-02, PRIMARY, STANDBY in turn | ONE item of value `NOT_ASSIGNED`: the item of that slot (`LENS_1`, `LENS_2`, `MIC_PRIMARY`, `MIC_STANDBY`), status BLOCK, reason `<slot>: source not assigned`, `reasonCode` null, params exactly `{ rule: 'sourceNotAssigned', slot }` (no device); it is the only BLOCK item of the answer; the other three slots' items are not `NOT_ASSIGNED`; outcome `BLOCK`, session stays `PRECHECK`; the trail of the session holds one `PRECHECK_BLOCKED` and no `PRECHECK_PASSED`; `acknowledgePrecheckWarnings` and `startRecording` are refused; the gate answered `{ asked: true, unreachable: [], search: 'NOT_NEEDED' }` and 0 `CAPTURE_DEVICE_UNREACHABLE` rows exist for the session |
| 6 | REAL_DEVELOPMENT | all four NULL | FOUR BLOCK items, one per slot, in the order of the checks; outcome `BLOCK`; the gate asked (no device), 0 unreachable rows; a start is refused |
| 7 CONTROL | REAL_DEVELOPMENT | the seed (all assigned) | 0 such items, 0 BLOCK items, the pre-check ends passed (`PRECHECK_PASSED` in the trail of the session) |
| 8 | SIMULATED | all four NULL | the gate answers `asked: false`; no item says `NOT_ASSIGNED`; the four items read PASS, PASS, WARN, WARN, as research/027 section 4 measured before WP-13a; 0 BLOCK items |

Each run is made as `modules/sessions/routes.ts` makes operation `beginPrecheck`: `captureNotices(app).beforePrecheckOf(...)` (the gate), then the hosted action.

## 3. Checks (this Mac)

| Check | Result line |
|---|---|
| `vitest --project db --maxWorkers=2 src/capture-notices/__tests__/precheck-unassigned.db.test.ts`, under `.locks/db-migrate.lock`, sandbox off, throw-away databases | run 1: `5 failed, 3 passed (8)` - a fault of the new test only (it counted the `PRECHECK_PASSED` rows of the seed's earlier sessions; every assertion about the items had passed); run 2 after filtering the trail by the session: `Tests 8 passed (8)`, `0 remain with the run prefix` |
| `tsc --noEmit` in `apps/core-server` | no error |
| `git diff --stat` of `precheck.ts` | empty |

## 4. Doubles, and what stays unproven

Real: the app factory and its boot in REAL_DEVELOPMENT on the fence's generated sources, the engine with its pipeline and audit chain, this unit and the probe the boot provided. Stand-ins: the worker and helper programs of the real-boot fixture, never asked to capture (no session is started). The unassigned slot is NULL written by the owner into a clone of the seed before the boot; operation 78 `unassign` is held by row 29 and row 158.

Not held here: the pre-check answer over HTTP (the route and its schema are the sessions module's); the two clients' drawing of the item (rows 167, 169). Nothing of this row goes to the hardware package.

## 5. Driver decisions

None. One observation for the controller: in case 8 a Simulated pre-check on four empty slots can still be acknowledged and started - that is C21 (6) as ruled, held here as a fact, not proposed for change.
