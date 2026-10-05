---
task_id: 2026-10-04_dems_backend_rbac_pairing
step: 59
plan_row: W37
agent: coder-execution
status: complete
started: 2026-10-04 14:12 WIB
last_updated: 2026-10-04 15:10 WIB
document: implementation/37_modules_storage_network_time.md
---

# Step 59 (W37): storage and network-time modules — progress

## Status

**complete.** Both module folders are filled, the verification of the row passed, both whole
projects exit 0 at the final runs, typecheck and lint exit 0, no database of the prefix remains.

## Milestones

| Time (WIB) | What |
|---|---|
| 14:12 | Brief, standing rules M1 to M13, spec §7.2, §7.11, §7.12, §7.17, §8.4, the guard and engine documents, the contract files read |
| 14:20 | Pre-images of the two stubs copied to `.cache/rollback/` |
| 14:24 | Production code of both modules written; typecheck exit 0 |
| 14:24 | By-design conflict with three test files of the guard row measured and reported here; no file of another row edited |
| 14:27 | Controller note D84 received: gap IDs carry the row (`CONTRACT-GAP-W37-n`). None was needed |
| 14:35 | Unit tests of both folders: 5 files green. Controller note D85 received: the three guard-row files are red by design, the owner fixes them; not edited, no workaround |
| 14:41 | Database tests of both folders green (the clock proofs reworked: seeded instants are stored data, see F-W37-6) |
| 14:45 | Controller note D87 received: rule M14 (errors logged only as `{ err }`). Checked: neither folder contains a log call; both static tests assert it |
| 14:53 to 15:01 | Mutation check: 47 of 47 detected by the unit tests; 30 of 31 behaviour mutations by the database tests alone |
| 15:01 to 15:05 | Final runs: own unit 5 files / 130 tests; own db 2 files / 29 tests; whole `unit` 101 files / 2,647 tests; whole `db` 71 files / 1,047 tests; typecheck and lint exit 0 without a warning; end state checked |
| 15:10 | Document and assets written |

## Verification, as quoted in the document

| Item | Result |
|---|---|
| MODG storage / network-time | route list = registry operations, 3 and 2, printed by the tests |
| any-of | SUPERVISOR (EVIDENCE_REVIEW only) 200; TECHNICIAN (MAINTENANCE only) 200; INVESTIGATOR (neither) 403 with one `ACCESS_DENIED` row, `details.permission: EVIDENCE_REVIEW_OR_MAINTENANCE`, written by the guard before the body is read |
| restart | policy, `storage_policy` row, the `STORAGE_POLICY_CHANGED` row (same sequence and hash) and a verifying chain after `engine.stop()`, `app.close()` and a new app on the same clone |
| clock | per second, across a 3 h jump, with a standing clock, on two servers with two clocks, across a restart; static: no system time, no `os`, `dns`, `net` or other runtime module in either folder |
| row command | `DEMS_TEST_STEP=59 npm run test:db -w @dems/core-server -- --maxWorkers=2 src/modules/storage src/modules/network-time`: 2 files, 29 tests, exit 0 (15:01:14) |
| whole `unit` | 101 files, 2,647 tests, exit 0 (15:01:30); controller baseline 14:11: 77 / 1,992; this row adds 5 files / 130 tests |
| whole `db` | 71 files, 1,047 tests, exit 0 (15:02:30); baseline 48 / 740; this row adds 2 files / 29 tests |
| typecheck, lint | exit 0, exit 0, no warning (15:02) |
| databases of the prefix `dems_test_step_59_` | 0 (15:05:32); `.locks/postgres.pid` 19121 |

## Red by design, decision D85 (not this row's files)

| Time | File | State |
|---|---|---|
| 14:24 | `src/plugins/permission-guard/__tests__/guard.test.ts` | 12 failed, 17 passed with this row's routes in the tree: red by design, decision D85, owner fix pending at that time (`assets/37_guard_unit_red_by_design_1424.log`) |
| 14:49:26 | whole `unit` | exit 0: the owner's fix had landed |
| 14:50:00 | whole `db` (with `denial.db.test.ts` and `matrix.db.test.ts`) | exit 0 |
| 15:01:30, 15:02:30 | whole `unit`, whole `db` | exit 0, exit 0 |

No open condition remains from D85.

## Noise of rows in flight (P11)

| Time | Run | What | Whose |
|---|---|---|---|
| 14:35 | typecheck, exit 2 | `src/modules/admin/__tests__/rule.test.ts(11,127): error TS2345` | administration row |
| 14:49:03 | typecheck, exit 2 | `src/plugins/permission-guard/__tests__/registered-routes.test.ts(147,83)`, `(171,84)`: TS2345 | the guard owner's fix of D85, in flight |
| 14:35, 14:49 | lint, exit 0 with warnings | test files of the administration, evidence and pairing rows | those rows |

Mutation windows of this row (a mutated file of the two folders was on disk for seconds at a
time): 14:43:59 to 14:45:12, 14:45:37 to 14:46:07, 14:46:50 to 14:47:59, 14:53:30 to 14:56:18,
14:56:26 to 15:00:57. All four production files are byte-equal afterwards (hashes compared).

## Findings, deviations, decisions (details in the document, sections 10 and 11)

- Contract, schema, simulator gaps: none allocated.
- F-W37-1: a stored grant the shared table does not have passes the guard and is refused by the
  hosted action itself, 403 with the simulator's code and NO audit row. Not reachable on a seeded
  server. Decision DN-1.
- F-W37-2: an engine stopped between the commit of a policy change and the answer gives 503
  although the change is stored. Residual; decision DN-2.
- F-W37-3 to F-W37-7: the simulator's 422 is not reachable through the route (the schema has the
  same bounds); a POST without a body changes nothing and answers 200; a policy name and its days
  can disagree; two notes for authors of database tests; the hardware slices before the first tick.
- DV-1 to DV-7: the seeded INVESTIGATOR is the main "holder of neither" (the clone change is done
  as well); shared test support between the two folders; an engine double with the real shared
  simulator for the database-free tests; read-only imports of other rows' test support; the
  shared tracking files not written (P8); one mutation not run; a recording and two faults driven
  through the engine to bring states about.

## Files created or updated

Production (4):
- `apps/core-server/src/modules/storage/index.ts` (replaces the stub)
- `apps/core-server/src/modules/storage/status.ts`
- `apps/core-server/src/modules/storage/policy.ts`
- `apps/core-server/src/modules/network-time/index.ts` (replaces the stub)

Tests and test support (9):
- `apps/core-server/src/modules/storage/__tests__/routes.test.ts`
- `apps/core-server/src/modules/storage/__tests__/projection.test.ts`
- `apps/core-server/src/modules/storage/__tests__/static.test.ts`
- `apps/core-server/src/modules/storage/__tests__/storage.db.test.ts`
- `apps/core-server/src/modules/storage/__tests__/support.ts`
- `apps/core-server/src/modules/storage/__tests__/static-rules.ts`
- `apps/core-server/src/modules/network-time/__tests__/routes.test.ts`
- `apps/core-server/src/modules/network-time/__tests__/static.test.ts`
- `apps/core-server/src/modules/network-time/__tests__/network-time.db.test.ts`

Rollback pre-images (2): `.cache/rollback/W37.storage.index.ts.pre`, `.cache/rollback/W37.network-time.index.ts.pre`

Documents (12):
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/37_modules_storage_network_time.md`
- `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_59.md` (this file)
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/37_own_unit_verbose.log`, `37_own_db_verbose.log`, `37_unit_whole.log`, `37_db_whole.log`, `37_typecheck_lint.log`, `37_mutations.log`, `37_mutate.mjs.txt`, `37_end_state.mts.txt`, `37_end_state.log`, `37_guard_unit_red_by_design_1424.log`

Not written, by the parallel-run rule (P8): `masterplan/02_plan.md`, `status_tasks.md`,
`delegation_progress_report.md`, `decisions/decisions.md`, `implementation/99_implementation_report.md`.
