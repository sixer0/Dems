---
task_id: 2026-10-04_dems_backend_rbac_pairing
step: 65
plan_row: W43
agent: coder-execution
status: complete
started: 2026-10-04 15:28 WIB
finished: 2026-10-04 16:41 WIB
follow_up_finished: 2026-10-04 17:01 WIB (decision D101)
document: implementation/43_module_demo_controls.md (section 21 for the follow-up)
---

# Step 65 (W43): demo-control module — progress

| Time (WIB) | Milestone |
|---|---|
| 15:28 | Started. Inputs read: gate report M1 to M15; blueprint row 65 and P1 to P25; spec §7.2, §7.3, §7.16, §7.17, §12; reset routine §3, §4, §11, §12, §21; engine host §3, §10; guard §3, §5, §8; core services §3, §4.1; database contract §7.1 (HC-1 to HC-5), §8.5; the contract files `demo-controls.ts`, `sim-actions.ts`, `operation-table.ts` |
| 15:37 | Pre-image of the scaffold's stub saved: `.cache/rollback/W43/modules.demo.index.ts.pre`. `.locks/postgres.pid` reads 19121. `db:status` of `dems_demo` recorded (45 lines, exit 0) |
| 15:47 | The foundation fix round A is in the tree (`app.db.read`, the pinned path on every runtime connection, the static guards on log calls and on the path setting). The module is written against it |
| 15:52 | Production code written: `operations.ts`, `status.ts`, `reset.ts`, `host.ts`, `index.ts` (845 lines). `typecheck` exit 0 |
| 15:56 | Controller note (decision D95) received and applied: a resume that fails, the stored matrix refused with `STORED_MATRIX_MISMATCH` or `STORED_GRANTS_MISMATCH` included, KEEPS the readiness hold; one error line with the code as a plain field, `serving: false` and the recovery; tests with a stubbed `reloadMatrix` at three levels (recording host, the server's wiring, the real server after a real reset) |
| 16:03 | First unit tests of the folder green (3 files, 114 tests) |
| 16:15 | Database tests of the folder green: 4 files, 40 tests |
| 16:18 to 16:22 | Mutation check through a transform of a runner configuration outside the source tree (rule M15): 82 of 82 detected (77 by `unit`, 5 by `db`); the control passes |
| 16:25 | Whole `unit` project: exit 0, 134 files, 3,503 tests |
| 16:26 to 16:31 | Whole `db` project: exit 1; 100 files, 99 passed; 1,477 tests passed, 0 failed; one hook time-out in `src/realtime/__tests__/upgrade.db.test.ts` (the realtime row's file). That file alone at 16:31:15: exit 0, 64 tests |
| 16:37 | Final state: typecheck exit 0; lint exit 0 (three warnings, all in the realtime row's files); unit of the folder 5 files / 141; row command `DEMS_TEST_STEP=65 … test:db … src/modules/demo` exit 0, 4 files / 40 tests, `0 remain with the run prefix` |
| 16:38 | End state: `db:status` of `dems_demo` identical to 15:37 (same SHA-256); the three lanes as built at 11:36 (82 audit rows, lineage 0); PostgreSQL PID 19121, started 07:14:26 |
| 16:41 | Document written: `implementation/43_module_demo_controls.md` (541 lines), 15 assets `implementation/assets/43_*` |

## Follow-up after the gate (decision D101), 16:42 to 17:01

| Time (WIB) | Milestone |
|---|---|
| 16:42 | Controller gate: PASS (D101). Rulings DN-1, DN-4, DN-5, DV-1 to DV-4, DV-7 accepted. Follow-up asked: DN-3 (a failed reset takes a new epoch through `start('resync')`), finding F-5 to be run |
| 16:44 | `reset.ts`, `host.ts`, `index.ts` changed: the routine resolved → `engine.reload()`; the routine rejected after the engine was stopped → `engine.start('resync')`; one info line `DEMO_RESET_NEW_EPOCH`. `typecheck` exit 0 |
| 16:47 | Finding F-5 RUN: after a failed reset with `AUDIT_TAMPER` active the fault stays listed and its alert active while the view verifies (not consistent). The same on the engine alone (`stop`, then `start('resync')`): the cause is in `src/engine` (`applyProcessStart` is called for the mode `boot` only). Not edited; a pending test (`it.skip`) with the reproduction is in `reset-failures.db.test.ts` |
| 16:48 to 16:55 | Mutation check on the follow-up state, out of tree: 92 of 92 detected (87 `unit`, 5 `db`); ten of them new for this ruling; the control passes. The pending test run for real with its skip removed in memory: it fails today, as it should |
| 16:55 | `typecheck` exit 0; `lint` exit 0 (eight warnings, all in `test/acceptance/restart.test.ts`, another row; none in this folder) |
| 16:56 | Unit of the folder: 5 files / 142 tests, exit 0. Row command `DEMS_TEST_STEP=65b … test:db … src/modules/demo`: exit 0, 4 files, 42 passed, 1 skipped (the pending test), `0 remain with the run prefix` |
| 16:56 | The ONE whole `unit` run: exit 0, 137 files / 3,536 tests |
| 16:57 to 16:59 | The ONE whole `db` run: exit 0, 107 files, 1,522 passed, 1 skipped; no failure in any folder; `0 remain` |
| 16:59 | `db:status` of `dems_demo` identical to 15:37 (same SHA-256); the lanes as built; PostgreSQL PID 19121 |
| 17:01 | Section 21 appended to `implementation/43_module_demo_controls.md` (719 lines); 13 assets `implementation/assets/43b_*` |

Files changed in the follow-up: `apps/core-server/src/modules/demo/reset.ts`, `host.ts`, `index.ts`, `__tests__/support.ts`, `__tests__/reset-order.test.ts`, `__tests__/routes.test.ts`, `__tests__/static.test.ts`, `__tests__/reset-failures.db.test.ts`; the document (section 21 and seven pointers in sections 5, 6, 9, 15, 16); `implementation/assets/43b_*`; this file.

For the controller, from the follow-up: finding F-5 goes to the engine's owner (document section 21.4: the exact reproduction, the line of `host.ts`, the pending test to un-skip); F-9: since D101 the epoch does not count resets (it moves for a failed reset, and by 2 for an unknown swap that did happen) — for W47, W53 and the client rows.

## Files created or updated

- `apps/core-server/src/modules/demo/index.ts` (replaces the stub), `operations.ts`, `status.ts`, `reset.ts`, `host.ts`
- `apps/core-server/src/modules/demo/__tests__/`: `support.ts`, `reset-order.test.ts`, `routes.test.ts`, `static.test.ts`, `status.test.ts`, `host.test.ts`, `gate.db.test.ts`, `faults.db.test.ts`, `reset.db.test.ts`, `reset-failures.db.test.ts`
- `docs/…/implementation/43_module_demo_controls.md`, `docs/…/implementation/assets/43_*` (15 files), this file
- `.cache/rollback/W43/modules.demo.index.ts.pre` (pre-image)

Not written (parallel run, the controller's): `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`, `implementation/99_implementation_report.md`.

## For the controller

- Decisions DN-1 to DN-10: document section 16. The ones that change behaviour if ruled otherwise: DN-3 (a failed reset republishes the same epoch at revision 0), DN-4 (`admin.changed` after a reset), DN-2 (the hold is taken inside the quiesce).
- `CONTRACT-GAP-W43-1`: text for W83 in section 14.
- Findings F-1 to F-8: section 15 (F-1 to the foundation's owner, F-2 to the identity row's owner, F-3 and section 9 to the realtime row).
- The whole `db` project did not exit 0 in this row's final run: one file of the realtime row (section 11.4).
