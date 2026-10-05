---
task_id: 2026-10-04_dems_backend_rbac_pairing
step: 63
plan_row: W41
agent: coder-execution
date: 2026-10-04
status: complete
artifact: implementation/41_biometric_token.md
---

# Step 63 (W41): the biometric token, operations 7 to 9: progress

All times WIB. No token, credential, hash or password is written here.

## Milestones

| Time | Milestone |
|---|---|
| 15:44 | Started. Read: gate report M1 to M15, blueprint row 63 and P1 to P25, spec §4.7, §5 (5.1 to 5.6), §7.3, §7.5, §8.2 ENG-23 to ENG-27, §13, the SR and AC-B items of the row, database contract §2.4, §4.6, §4.10, §5 (5.1 to 5.6 with AT-C4 and T-AT-4), the documents of the identity core (§4, §6, §9.5, §19), the pairing row, the administration row, the guard (§3, §8), the core services (§3, §4.1, §8), the contract file `identity.ts`, `patterns.ts`, client specification §9.3, decisions D11 to D93, findings F55, F62, F67 |
| 15:52 | Pre-image saved as a file copy: `.cache/rollback/W41.identity.index.ts.pre` (the file as the identity row left it) |
| 16:02 | The folder's eight production files written; typecheck clean in the folder (errors at 16:02:15 and 16:02:48 only in `src/realtime/hub.ts` and `messages.ts`, the realtime row in flight) |
| 16:02 | The two lines of decision D78 DN-6 in `apps/core-server/src/modules/identity/index.ts`: line 32 `import { registerBiometricRoutes } from './biometric';`, line 163 `registerBiometricRoutes(app, { lockout });` |
| 16:02:53 | First run with the routes registered (identity, permission-guard, authenticate, readiness, `test/static`): 26 files passed, 2 failed. One by design: `src/modules/identity/__tests__/routes.test.ts:38` (the identity row's route list took every route under `/api/v1/auth`). One not this row's: `test/static/log-calls.test.ts` naming `src/realtime/hub.ts:597, :758` (P11). The guard row's tests stayed green. Not edited; the controller was told with file, line and the smallest change |
| 16:03 | Controller ruling D98: apply the one-line change, as a recorded by-design change. Pre-image `.cache/rollback/W41.identity.routes.test.ts.pre`; two lines changed (30 the title, 35 the filter); the file alone at 16:04:09: 7 of 7 |
| 16:08 | First database run of the folder: 1 file, 22 tests, exit 0 |
| 16:28 | The folder: `db` 8 files / 96 tests exit 0; `unit` 3 files / 65 tests exit 0; typecheck exit 0; lint: no warning in this row's files (three in `src/realtime`, the realtime row) |
| 16:32:08 to 16:45:33 | Mutation check, first pass: 115 mutations through a scratch Vitest configuration outside the repository (rule M15; no file of the tree changed): 113 detected, 2 survived (M58, M74) |
| 16:46 | Two test additions (`concurrency.db.test.ts`, `sign-in.db.test.ts`); second pass 16:46:15 to 16:46:26: both detected. Total 115 of 115 |
| 16:47 | The two race tests (a sign-in against a revoke, against a disable) changed to make both unit orders happen: a free-running pair took the same order every time (finding F-10 of the document) |
| 16:47:42 to 16:51:01 | Final runs (`implementation/assets/41_final_runs.log`): typecheck exit 0, lint exit 0 without a warning, whole `unit` 137 files / 3,536 tests exit 0 (16:47:50), whole `db` 106 files / 1,520 passed and 1 skipped (another row's `it.skip`) exit 0 (16:48:29) |
| 16:51 | Verbose runs of the folder saved as assets: `unit` 3 files / 65 tests (16:51:19), `db` 8 files / 98 tests (16:51:22) |
| 16:51:53 | End state: 0 databases with the prefix `dems_test_step_63_`, `.locks/postgres.pid` 19121, the scratch link removed |
| 16:58:33 to 16:59:07 | At the close: typecheck exit 0; lint exit 0 (six warnings, all in `test/acceptance/restart.test.ts`, a test row in flight; none in this folder); the whole `modules/identity` `unit` 12 files / 205 tests and `db` 15 files / 179 tests exit 0; end state again: 0 databases of this row, PID 19121 |

## Files created or updated

Created under `apps/core-server/src/modules/identity/biometric/`: `index.ts`, `routes.ts`,
`enrolment.ts`, `sign-in.ts`, `failure.ts`, `store.ts`, `activity.ts`, `tokens.ts`; under its
`__tests__/`: `support.ts`, `routes.test.ts`, `tokens.test.ts`, `static.test.ts`,
`sign-in.db.test.ts`, `enrolment.db.test.ts`, `failure.db.test.ts`, `concurrency.db.test.ts`,
`revocation.db.test.ts`, `sequence.db.test.ts`, `secrets.db.test.ts`, `engine.db.test.ts`.

Updated outside the folder, each by a recorded decision:
`apps/core-server/src/modules/identity/index.ts` (two lines added, D78 DN-6);
`apps/core-server/src/modules/identity/__tests__/routes.test.ts` (two lines changed, D98).

Pre-images: `.cache/rollback/W41.identity.index.ts.pre`,
`.cache/rollback/W41.identity.routes.test.ts.pre`.

Documents: `implementation/41_biometric_token.md`; this file; assets
`implementation/assets/41_test_unit_verbose.txt`, `41_test_db_verbose.txt`,
`41_mutation_harness.vitest.config.mjs.txt`, `41_mutation_harness.run.sh.txt`,
`41_mutations.json`, `41_mutations.log`, `41_final_runs.log`, `41_end_state.mts.txt`.

Not written (parallel run): `status_tasks.md`, `delegation_progress_report.md`,
`decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md`.

## Findings, deviations, decisions

See the document: §16 (CONTRACT-GAP-W41-1 to -4), §17 (F-1 to F-10), §18 (DV-1 to DV-8), §19
(DN-1 to DN-19), §9 (the one revoke function and the changes for fix round B).
