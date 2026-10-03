---
task_id: 2026-10-04_dems_backend_rbac_pairing
step: 2
agent: explore
status: complete
date: 2026-10-04
---

# Progress: explore, blueprint row 2 (API contract and demo dataset inventory)

## Status

complete

## Artifacts

| Path | State |
|---|---|
| `docs/2026-10-04_dems_backend_rbac_pairing/research/01b_explore_contract_dataset.md` | created (629 lines, 69,414 bytes) |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/explore_step_2.md` | created (this file) |

No source file was changed: `git status --porcelain` shows only the task folder and the predecessor's already-modified docs. `git diff --stat HEAD -- packages/shared` printed nothing.

## Milestones

1. Read `identification/02_structured.md` (row 2 and the context sections).
2. Graft orientation (`graft map`, `callers`, `ask`); `graft skeleton` returned "no definitions indexed" for `core-api.ts` and `dataset.ts`, so those were read directly.
3. Inventoried `packages/shared/src/api/` (9 files), `openapi.json`, `gen-openapi.ts`, `openapi.test.ts`, network constants and all consumers.
4. Inventoried `sim/dataset.ts`, `sim/initial-state.ts`, `sim/generator.ts`, `sim/scenarios.ts`, `sim/demo-alignment.ts`, role matrix.
5. Inventoried `src/demo-data/` (7 files), the join rule and its guards.
6. Listed `packages/shared/assets` with sizes; confirmed the mobile copy is byte-identical.
7. Verified every cited line number once more and corrected 9 of them in the output.

## Verification quoted in the output

- `CORE_API_OPERATIONS` count: 10 (`grep -n "operationId: '" core-api.ts | wc -l`).
- Media: 198 files, 43,564,652 bytes in `demo-media`; `assets` total 292 files, 48,231,787 bytes.
- KI-18 stale text quoted with `core-api.ts:427` (section 1.10) and its 8 repeats.
- No credential value (demo password, pairing code) appears in the output (`grep -c` printed 0).

## Deviations

- Output file name follows the row (`01b_explore_contract_dataset.md`), not the generic agent definition (`01_explore.md`).
- The `Grep` tool and the Graft MCP tools were not available to this agent; `grep` and the Graft CLI ran through the shell.
- Audit rows (82) and events (59) of the seed are derived by static reading, not executed (P7).

## Decisions and items for the controller to record

1. No decision is needed from the user.
2. Carry forward to rows 14 to 16: the seed clock rule (run date versus fixed as-of date) interacts with the date-relative IDs and the frozen DEMO packages (output section 2.8, finding R2-12).
3. Carry forward to row 20: the demo password and the pairing code are single constants shown in both login screens, and the password literal also sits in `README.md` and `scripts/release/build-web-packages.ts` (output section 2.3).
4. Carry forward to rows 15 and 98: the list of drift-test assertions that change by design (output section 1.6) and the 8 places that repeat the KI-18 text (section 1.10).
5. Confirm the derived seed counts (82 audit rows, 59 events) by running `createIdleState` in a test (rows 29 or 105).

## Blockers

none
