---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: SIM-GAP-1 (controller row, decision D53)
agent: coder-execution
date: 2026-10-04
status: complete
output_document: implementation/22b_sim_text_cut_fix.md
---

# Progress: SIM-GAP-1, the simulator's text cuts are safe for characters outside the BMP

## Status

complete. Every verification command of the row exits 0. Time used: about 38 of 40 minutes.

## Milestones

| Time | Milestone | Evidence |
|---|---|---|
| 09:44 | Inputs read: F-1 of `22_contract_b.md`, its reproduction, protocol P6, P9 to P11, P21 to P24 | — |
| 09:44 | Whole simulator searched for code-unit cuts; 4 user-text cuts in 2 files, every other hit classified | `22b_sim_text_cut_fix.md` section 2 |
| 09:45 | Pre-image saved (0 bytes: both files equal to `acaff20`); hash baseline captured from the unfixed code; shared suite before: 977 passed in 46 files | `.cache/rollback/SIMGAP1.pre.patch`; `assets/22b_hash_baseline_before.txt` |
| 09:47 | Helper `cutText` written; four expressions changed | `packages/shared/src/sim/text-cut.ts`; section 4 |
| 09:47 | Hash baseline after the fix identical to the one before | `assets/22b_hash_baseline_after.txt` |
| 09:50 | New test file, 35 tests, green | `packages/shared/test/sim-text-cut.test.ts` |
| 09:51 | Mutation check: 13 of 13 behaviour-changing mutations killed, 1 equivalent | `assets/22b_mutations.log` |
| 09:51 to 09:55 | Gates: shared 1012 in 47 files; typecheck 0; lint 0; core-web 438; mobile 833; OpenAPI check 0; four reference hashes equal; simulator diff as expected; F-1 reproduction clean | `assets/22b_gate_*.log`; `assets/22b_finding_f1_output_after.txt` |
| 09:57 | Output document written | `implementation/22b_sim_text_cut_fix.md` |

## Test ledger

| Workspace | Before | After | New test file |
|---|---|---|---|
| `@dems/shared` | 977 tests in 46 files | 1012 tests in 47 files | `test/sim-text-cut.test.ts` (35) |
| `@dems/core-web` | 438 in 39 | 438 in 39 | none |
| `@dems/mobile` | 833 in 72 suites | 833 in 72 suites | none |
| `@dems/core-server`, `@dems/mock-core` | not run by this row (typecheck and lint only) | — | none |

No existing test was changed. No run of this row failed, in its own files or in another row's, so the noise rule P11 was not used.

## Files created or updated

Created:
- `packages/shared/src/sim/text-cut.ts`
- `packages/shared/test/sim-text-cut.test.ts`
- `.cache/rollback/SIMGAP1.pre.patch` (0 bytes), `.cache/rollback/SIMGAP1.post.patch`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/22b_sim_text_cut_fix.md`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/22b_hash_baseline.ts`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/22b_hash_baseline_before.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/22b_hash_baseline_after.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/22b_mutate.py`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/22b_mutations.log`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/22b_finding_f1_output_after.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/22b_gate_shared_test.log`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/22b_gate_typecheck.log`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/22b_gate_lint.log`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/22b_gate_core_web_test.log`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/22b_gate_mobile_test.log`
- `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_simgap1.md` (this file)

Updated:
- `packages/shared/src/sim/session-machine.ts` (+5 −2: one import, two expressions, two comments)
- `packages/shared/src/sim/evidence-actions.ts` (+3 −2: one import, two expressions)

Not written (parallel run, controller-only or shared): `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md`.

## Processes

No server, emulator, Metro or database process was started. The mutation check rewrote the three simulator files for under a second each (14 times) and restored them; their SHA-256 values were checked after the run. While a site mutation was applied the simulator behaved as at `acaff20`.

## Blockers

None.

## Findings, deviations and decisions for the controller

| ID | Kind | Text |
|---|---|---|
| N-1 | Decision needed | F-1 is closed at the cause (option A). DN-2 of `22_contract_b.md` can now be acted on by the contract owner: switch the text rule API-13 on for the state slices (`text()` in `src/api/state-slices.ts`). Not done here: `src/api/` is not this row's |
| N-2 | Finding, decision needed | The fix protects Live mode only where the server runs the simulator's transitions. `cutText` is not exported from the simulator's barrel (`index.ts` is outside this row's write paths) and no file under `apps/core-server/src` calls the four transitions yet. The rows that implement markers, notes and exports on the server must either call the transitions or use the same helper (one export line in `index.ts`, by a recorded exception) |
| N-3 | Residual | Text already stored is not repaired: a simulated-mode snapshot persisted before the fix with an astral character exactly at a limit keeps its lone surrogate until the demo is reset |
| N-4 | Maintenance | The new test pins nine audit hashes and the chain head of one journey of the recording scenario. They move only if that scenario or those audit rows change by design; `assets/22b_hash_baseline.ts` regenerates them |
| N-5 | Scope | A cut can still fall inside a grapheme cluster; the text stays well-formed and storable. Out of scope by the row |
| N-6 | Search result | The marker label (`session-machine.ts:1070`) has the same defect as the three expressions F-1 listed and also reaches a hashed row (`MARKER_ADDED`: `message` and `details.label`). No other user-text cut exists in `packages/shared/src/sim/` |
| N-7 | Design decision of this row | Ill-formed input is passed through, never repaired; the limits stay in code units (80, 139, 120); a pair across the limit is left out whole, so the result can be one unit shorter than the limit; no `Intl.Segmenter`, no `isWellFormed` in the source (Hermes lacks it) |
| N-8 | Deviation | None from the row. Extra evidence: a mutation check, a post-image patch, a wider search than the row's command |
