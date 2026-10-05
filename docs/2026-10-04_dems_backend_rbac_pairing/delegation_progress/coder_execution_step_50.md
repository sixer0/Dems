---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: coder-execution (tier R)
blueprint_row: 50 (plan W28, RBAC guard, matrix read, pipeline integration)
date: 2026-10-04
status: complete
evidence_tier: 3
---

# coder-execution progress: step 50 (W28, RBAC guard and the integration of stages 3 to 6)

Status: **complete** (14:08), gated PASS (decision D83); follow-up of decisions D85 and D88
**complete** (15:55); follow-up of finding CPS1-3 (decisions D113, D118) **complete** (19:58):
see the two "Follow-up" sections at the end of this file. The figures of the next paragraphs are
those of 14:08.

Every check of the row was met at the final runs of 14:08: the row's own
tests exit 0 (7 `unit` files with 142 tests, 3 `db` files with 111 tests), the whole `unit`
project (77 files, 1,992 tests) and the whole `db` project (48 files, 740 tests) exit 0,
typecheck and lint exit 0 with no warning, 73 of 73 planted defects are detected, no database
with this row's prefix remains, and `.locks/postgres.pid` is 19121 as before.

Full record: `implementation/28_rbac_guard_pipeline.md`. All times WIB. No credential, token,
hash or password is in this file.

## What exists now

- Stage 6, the access rule (HB-7): the rule of a route is the contract registry's and nothing
  else's; the decision is a pure function of that rule and of the principal stage 4 resolved;
  it runs in the one `onRequest` hook, before the body is read.
- Deny by default: a route that is no registry operation, or whose registry entry lacks its
  access rule or its audit rule, stops `app.ready()` by name; the boot step `rbac.matrix` walks
  the whole router as well and stops the boot before the listener; a route that reaches a
  request without a rule is refused with 500.
- The denial path: `app.denialBudget.consume(request)`, then one row in its own unit of work,
  then the answer. `ACCESS_DENIED` for a missing permission and for a retired device;
  `EXPORT_DENIED` with its event for the three exports.
- The stored matrix: one statement over `roles`, `permissions`, `role_permissions`; the boot
  step checks the stored vocabulary; the per-request decision uses the permissions stage 4 read
  for that request, so a role change needs no reload.
- Operation 10 `getRoleMatrix`.
- The integration tests of stages 3 to 6 with no stage replaced.

## Verification (runner output quoted in `28_rbac_guard_pipeline.md`, section 11)

| Check | Result | Time |
|---|---|---|
| Own `unit` tests (`src/plugins/permission-guard`, `src/modules/rbac`) | exit 0: 7 files, 142 tests | 14:05:35 |
| Own `db` tests, `DEMS_TEST_STEP=50` | exit 0: 3 files, 111 tests; "0 remain with the run prefix dems_test_step_50_tmdfpdbp_" | 14:05:36 |
| Whole `unit` project | exit 0: 77 files, 1,992 tests | 14:05:51 |
| Whole `db` project, `DEMS_TEST_STEP=50` | exit 0: 48 files, 740 tests; forced drops that needed a retry: 0; 0 databases remain | 14:06:12 |
| `npm run typecheck -w @dems/core-server` | exit 0 | 14:05:48 |
| `npm run lint -w @dems/core-server` | exit 0, no warning | 14:05:51 |
| Mutation check | 73 of 73 detected (first pass 72: M45 survived and is now detected) | 13:50 to 14:05 |
| End state | 0 databases with the prefix `dems_test_step_50_`; `.locks/postgres.pid` 19121 | 14:07:09 |

Test ledger (P24), `@dems/core-server`: `unit` 70 files / 1,850 tests before, 77 / 1,992 after
(+7 files, +142 tests); `db` 45 / 629 before, 48 / 740 after (+3 files, +111 tests). New test
files: `access-rules.test.ts`, `decision.test.ts`, `denial.test.ts`, `guard.test.ts`,
`boot-registry.test.ts`, `static.test.ts`, `pipeline.db.test.ts`, `denial.db.test.ts` (all under
`src/plugins/permission-guard/__tests__/`), `routes.test.ts`, `matrix.db.test.ts` (under
`src/modules/rbac/__tests__/`).

## Files created or updated

Created:

- `apps/core-server/src/plugins/permission-guard/access-rules.ts`
- `apps/core-server/src/plugins/permission-guard/decision.ts`
- `apps/core-server/src/plugins/permission-guard/denial.ts`
- `apps/core-server/src/plugins/permission-guard/matrix.ts`
- `apps/core-server/src/plugins/permission-guard/router-table.ts`
- `apps/core-server/src/plugins/permission-guard/__tests__/support.ts`
- `apps/core-server/src/plugins/permission-guard/__tests__/access-rules.test.ts`
- `apps/core-server/src/plugins/permission-guard/__tests__/decision.test.ts`
- `apps/core-server/src/plugins/permission-guard/__tests__/denial.test.ts`
- `apps/core-server/src/plugins/permission-guard/__tests__/guard.test.ts`
- `apps/core-server/src/plugins/permission-guard/__tests__/boot-registry.test.ts`
- `apps/core-server/src/plugins/permission-guard/__tests__/static.test.ts`
- `apps/core-server/src/plugins/permission-guard/__tests__/pipeline.db.test.ts`
- `apps/core-server/src/plugins/permission-guard/__tests__/denial.db.test.ts`
- `apps/core-server/src/modules/rbac/__tests__/routes.test.ts`
- `apps/core-server/src/modules/rbac/__tests__/matrix.db.test.ts`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/28_rbac_guard_pipeline.md`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28_by_design_test_changes.patch`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28_test_unit_verbose.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28_test_db_verbose.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28_final_runs.log`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28_mutation_harness.vitest.config.mjs.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28_mutation_harness.run.sh.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28_mutations.json`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28_mutations_pass1.log`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28_mutations.log`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28_end_state.mts.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_50.md`
- `.cache/rollback/W28.*` (13 pre-images, git-ignored)

Replaced (the stubs of W08):

- `apps/core-server/src/plugins/permission-guard/index.ts`
- `apps/core-server/src/modules/rbac/index.ts`

Changed by design under ruling D82 (exactly the patch; 20 lines inserted, 1 replaced):

- `apps/core-server/src/plugins/logger/__tests__/log-capture.test.ts` (:81)
- `apps/core-server/src/modules/identity/__tests__/tokens-cookie.test.ts` (:77-78)
- `apps/core-server/src/plugins/authenticate/__tests__/authenticate.test.ts` (:132-133)
- `apps/core-server/src/plugins/error-envelope/__tests__/error-envelope.test.ts` (:68-69)
- `apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts` (:20-21, :83)
- `apps/core-server/src/plugins/origin-guard/__tests__/guard-test-app.ts` (:75-76)
- `apps/core-server/src/plugins/response-headers/__tests__/response-headers.test.ts` (:88-89)
- `apps/core-server/src/core/__tests__/seeded.db.test.ts` (:41-42)
- `apps/core-server/src/engine/__tests__/restart.db.test.ts` (:24)
- `apps/core-server/src/modules/identity/__tests__/support.ts` (:21, :95-96)

Not written: `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`,
`decisions/decisions.md`, `implementation/99_implementation_report.md` (parallel run, P8).

## Milestones

| Time | Milestone |
|---|---|
| 12:53 to 13:07 | Inputs read; pre-images of the two stubs saved |
| 13:08 | Baseline: `unit` 70 files / 1,850 tests, exit 0 |
| 13:15 | The guard, the decision, the denial path, the matrix and operation 10 written; typecheck and lint exit 0 |
| 13:15 to 13:17 | Whole projects with the guard and nothing else changed: 12 test files of other rows red by design, one red not by design (fixed here) |
| 13:20 to 13:22 | The by-design changes proven on a scratch copy; reported to the controller |
| 13:24:59 | Ruling D82: the patch applied, after `git apply --check`, pre-images saved |
| 13:26 | Whole projects green again: `unit` 70 / 1,850, `db` 45 / 629 |
| 13:27 to 13:47 | The router walk for condition 4 of the ruling; this row's 10 test files |
| 13:50 to 14:05 | Mutation check, two passes |
| 14:05 to 14:07 | Final runs, end state |

## Blockers

None open. One was raised and closed during the row: the by-design failures of other rows'
tests (ruling D82).

## Findings (for the controller's F-n list; detail in section 17 of the document)

1. 12 test files of other rows relied on the stub at stage 6; adapted under D82.
2. The engine row's log test allows a closed set of log keys for every line of a booted app: a
   boot step of any later row that logs a new key fails it.
3. The any-of permission has three spellings (registry marker, simulator label, the server's
   `A_OR_B`); in Live mode `SimPermissionError.permission` of a refused `setStoragePolicy`
   differs in text from Simulated mode; the web's role lookup finds none for either.
4. The contract's `getRoleMatrix` example lists SUPERVISOR's grants in another order than the
   server answers (same 18 grants).
5. The identity routes' own checks hide a defect of stage 6 from an HTTP test of operations 2 to
   6 (mutation M45 survived the first pass for that reason).
6. Fastify gives back no configuration of a registered route, so the `operationId` of a route
   the guard was never shown cannot be checked at boot; it is refused at its first request.
7. While an operator holds 20 refusals, that operator's ALLOWED calls answer 429 too, for up to
   60 s (as ID-P13 says). For the client rows and the security review.
8. A request with an `Upgrade` header is not blocked by stage 5's budget check and still cannot
   write a 21st row.
9. The stored vocabulary must be exactly the shared one for the server to boot: a later row that
   adds a permission needs a seed change in every database first.
10. The test support of the identity row and of this row import each other (test files only).

## Deviations from the plan

1. The decision uses the permissions stage 4 read for the request, not a loaded matrix (the
   brief's rule 3 says "per the loaded matrix"; RB-2, RB-3 and SR-13 decide it).
2. Ten test files of other rows were edited (ruling D82).
3. No stub assertion of this row existed in `readiness.test.ts`; nothing was deleted there.
4. `checkRouter` and `router-table.ts` were added on condition 4 of the ruling.
5. The plan file, the status tracker and the implementation report were not written (P8).
6. The retired-credential half of AC-B-75 is tested here too, with the registry stand-in.
7. The upgrade cells are sent with `app.inject` to a stand-in for `GET /ws`; the real handshake
   is the realtime row's.

## Decisions for the controller to record

| ID | Decision | Recommendation |
|---|---|---|
| DN-1 | `details.permission` of an any-of refusal is `EVIDENCE_REVIEW_OR_MAINTENANCE`, in the row and in the answer | Accept; CONTRACT-GAP-5 for W83: `packages/shared/src/api/storage.ts:179`, `permission: 'EVIDENCE_REVIEW_OR_MAINTENANCE'` |
| DN-2 | The truth at request time is the principal's permission list; W33 calls nothing after a role change; `permissionGuard(app).reloadMatrix(): Promise<LoadedMatrix>` is for W43 after a database swap | Accept; tell W33 and W43 |
| DN-3 | `GET /ws` is the one route outside the registry the guard accepts | Accept; tell W42 |
| DN-4 | The guard writes `EXPORT_DENIED` and its event; the modules write no denial row | Accept; tell W35 and W39 |
| DN-5 | A retired device may call health, the pairing redeem and the socket handshake only | Accept |
| DN-6 | A top-level route without a rule is stopped by the boot step, not by `ready()` | Leave; W38 decides whether `ready()` should be the only gate (then six set-ups move one line) |
| DN-7 | The stored vocabulary must be exact for the server to boot | Accept |
| DN-8 | The identity routes' own `onRequest` checks can go | W38 |
| DN-9 | CONTRACT-GAP-5 and CONTRACT-GAP-6 (example texts) | W83 |
| DN-10 | The budget of an operator also blocks that operator's allowed calls | As specified; note for the client rows and W45 |
| DN-11 | Notes for W32 to W43 (section 8 of the document), W47 and W52 | To record |

## Cleanup

No process of this row is left; no port was bound; PostgreSQL untouched (`.locks/postgres.pid`
19121). Scratch files were under the session's scratchpad, outside the repository; the proof
copy and the mutation harness are removed, the evidence is under `implementation/assets/28_*`.

---

## Follow-up (decisions D85 and D88; review finding CPB1-1; finding F65 of the storage row)

Status: **complete** (15:55). Full record: the last section of
`implementation/28_rbac_guard_pipeline.md`, "Follow-up: tests that pinned the route list
(decision D85)", F.1 to F.10. No credential, token, hash or pairing code is in it.

### What was done

- **D85.** This row's tests no longer depend on which modules have landed. Five files build the
  app WITHOUT the domain modules (one shared helper, `without-domain-modules.ts`, imported
  first; `app.ts` untouched); inside them a stand-in is added only where the app has no route
  (`app.hasRoute`); one new file, `registered-routes.test.ts`, runs on the REAL app, derives
  everything from `permissionGuard(app).registeredRules()`, names no module's operation, counts
  nothing and registers nothing. No pinned total of routes or boot steps is left (rule M10 and
  its addition).
- **D88 DN-1.** The boot step `rbac.matrix` and `reloadMatrix()` also assert that the stored
  grants are exactly the shared role table (`ROLE_PERMISSIONS` of `@dems/shared/sim`, imported,
  not retyped). A difference stops the boot or rejects the reload with `AccessRuleError`, code
  `STORED_GRANTS_MISMATCH`, one problem whose detail is `missing grant: ROLE PERMISSION` or
  `extra grant: ROLE PERMISSION`: the first difference only. It is not a per-request check: a
  grant changed in a running server still decides the next request.

### Verification (quoted in F.7 and F.8 of the document)

| Check | Result | Time |
|---|---|---|
| Own `unit` files | exit 0: 9 files, 162 tests | 15:48:10 |
| Own `db` files, `DEMS_TEST_STEP=50b` | exit 0: 3 files, 115 tests; 0 databases remain with the run prefix | 15:47:46 |
| The storage row's `storage.db.test.ts`, not edited | exit 0: 1 file, 18 tests | 15:20:51, 15:47:50 |
| Whole `unit` project | exit 0: 110 files, 2,776 tests (and 102 / 2,661 at 15:43:06) | 15:48:36 |
| Whole `db` project | exit 0: 80 files, 1,112 tests; forced drops that needed a retry: 0 | 15:47:21 |
| Whole `db` project, the run before | exit 1: 2 files of `src/core/__tests__/` red (7 tests, `passedAmong is not a function`), in-flight work of another row; green alone at 15:44:56 and in the run above | 15:44:28 |
| Typecheck; lint | exit 0; exit 0 with no finding | 15:48:14 |
| Proof: a scratch copy in which all 75 operations and `/ws` have real routes | own unit 9 / 162, own db 3 / 115, exit 0 | 15:49:27, 15:49:32 |
| Mutation check, transform only (M15) | 88 of 88 detected on the final state (73 of 73 after D85) | 14:55 to 15:13; 15:22 to 15:42 |
| End state | 0 databases with the prefix `dems_test_step_50`; `.locks/postgres.pid` 19121 | 15:48:55 |

### Files created or updated by the follow-up

Production, changed (D88 only):

- `apps/core-server/src/plugins/permission-guard/access-rules.ts`
- `apps/core-server/src/plugins/permission-guard/matrix.ts`
- `apps/core-server/src/plugins/permission-guard/index.ts`
- `apps/core-server/src/modules/rbac/index.ts` (header comment)

Tests, changed:

- `apps/core-server/src/plugins/permission-guard/__tests__/support.ts`
- `apps/core-server/src/plugins/permission-guard/__tests__/guard.test.ts`
- `apps/core-server/src/plugins/permission-guard/__tests__/boot-registry.test.ts`
- `apps/core-server/src/plugins/permission-guard/__tests__/denial.db.test.ts`
- `apps/core-server/src/plugins/permission-guard/__tests__/pipeline.db.test.ts`
- `apps/core-server/src/plugins/permission-guard/__tests__/static.test.ts`
- `apps/core-server/src/modules/rbac/__tests__/matrix.db.test.ts`
- `apps/core-server/src/modules/rbac/__tests__/routes.test.ts`

Tests, created:

- `apps/core-server/src/plugins/permission-guard/__tests__/without-domain-modules.ts`
- `apps/core-server/src/plugins/permission-guard/__tests__/registered-routes.test.ts`
- `apps/core-server/src/plugins/permission-guard/__tests__/matrix.test.ts`

Documents and assets:

- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/28_rbac_guard_pipeline.md` (the follow-up section appended; section 5 corrected in place; a pointer under the header)
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28b_route_list_follow_up.patch`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28b_mutations.log`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28c_stored_grants_d88.patch`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28c_mutations.json`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28c_mutations.log`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28c_mutations_rerun.log`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28c_mutation_harness.run.sh.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28c_mutation_harness.run2.sh.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28c_test_unit_verbose.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28c_test_db_verbose.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28c_final_runs.log`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28c_end_state.mts.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_50.md` (this file)
- `.cache/rollback/W28b.*.pre` (7 pre-images, the state before D85), `.cache/rollback/W28c.*.pre` (9, the state before D88); git-ignored

Not written: `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`,
`decisions/decisions.md`, `implementation/99_implementation_report.md`, and no file of another
row (the storage row's test was run, not edited).

### Milestones

| Time | Milestone |
|---|---|
| 14:37 | D85 received; measured: 3 `unit` files and 2 `db` files of this row red on the tree |
| 14:37 to 14:50 | First design dropped after the controller's addition on CPB1-1; the mix of F.2 built; own files green |
| 14:50 to 14:52 | Proof copy with every operation registered; whole `unit` 96 files / 2,540 tests and whole `db` 67 files / 1,006 tests, exit 0 |
| 14:55 to 15:13 | Mutation re-run with the changed tests: 73 of 73; the controller told that D85 is green |
| 15:14 to 15:31 | D88: the grants check, its tests, a static test for the one source |
| 15:22 to 15:42 | Mutation run with 14 new mutations (87 of 87), and the re-run on the final state with one more (41 of 41) |
| 15:42 to 15:49 | Final runs, end state, proof copy on the final state, cleanup |

### Blockers

None.

### Findings, deviations, decisions (F.9 of the document)

Findings:

1. FU-4: on the real server 54 operations are registered (14:51 and 15:26), each with its
   registry rule, and stage 6 stands in front of every one of them before the module's handler.
2. FU-6: findings CPB1-5, CPB1-10 and CPB1-24 concern production code of this row and were not
   touched; they are open for a ruling.
3. FU-7: D88 holds at a boot and at a reload. A grant edited by hand in a running server is
   applied from the next request and is not compared with the shared table until then; in that
   window the gap of F65 exists.
4. FU-8: the reset row (W43) must treat `STORED_GRANTS_MISMATCH` from `reloadMatrix()` like
   `STORED_MATRIX_MISMATCH`.
5. FU-9: a row that changes the shared role table must change the seed in the same step, or no
   database boots.
6. In-flight noise named with its time: one whole `db` run red in `src/core/__tests__/` at
   15:43 to 15:44 (cause not established; green alone and in the next whole run); typecheck exit
   2 and 10 lint warnings in the pairing and evidence rows' test files at 14:51, gone at 15:20.

Deviations:

1. FDV-1: the first design of the D85 fix was dropped after the addition on CPB1-1.
2. FDV-2: the persistent error log's context for the guard's problem lists gained `details`
   (needed for D88; one accepted assertion of `guard.test.ts` gained that member).
3. FDV-3: a new code `STORED_GRANTS_MISMATCH` rather than a new detail under the old code.
4. FDV-4: two edits were made during the mutation run; the mutations that had run before the
   production edit were run again on the final state.
5. One accepted assertion of this row was reversed by design: a reload after a deleted grant
   used to resolve and now rejects.

Decisions for the controller to record: FDN-1 (the test apps per group), FDN-2
(`without-domain-modules.ts` may be imported by other rows), FDN-3 (D88 as built), FDN-4 (the
error-log context has `details`), FDN-5 (accept the window of FU-7 or rule a periodic
comparison).

### Cleanup

The scratch proof copy, the mutation harness and the patch check trees (all under the session's
scratchpad, outside the repository) are removed, links first. No process of this row is left, no
port was bound, PostgreSQL untouched (`.locks/postgres.pid` 19121).

---

## Follow-up: the condition `DEVICE_CREDENTIAL` on operation 23 (finding CPS1-3; decisions D113, D118)

Status: **complete** (19:58). Full record: the last section of
`implementation/28_rbac_guard_pipeline.md`, G.1 to G.10. No credential, token, code or hash is in
it or in its assets.

### What was done

- The contract owner's patch `implementation/assets/27c_condition_op23.patch` was applied to the
  working tree (plain `git apply`, check exit 0, no other git write) at 19:34:58 TOGETHER with the
  guard's evaluation; `npm run typecheck -w @dems/core-server` exit 0 at 19:35:08.
- Stage 6 evaluates the condition, for any rule of the registry that carries it (no operation is
  named): only the DEVICE principal holds it. The session of an operator who is signed in on the
  device is refused with 403 `DEVICE_NOT_PAIRED`, the message "This operation needs the device's
  own credential." and `details.reason: DEVICE_CREDENTIAL_REQUIRED`; no audit row, no place in
  the denial budget, decided before the body is read. The order of stage 6 is unchanged.
- A condition without a case in stage 6 is no longer passed over: it refuses, and the type check
  fails when the vocabulary gains one.
- The log key of the stage's refusal line is `refusedBy` (was `cause`; standing rule M14).
- The specification says the rule in six lines; the access cell of row 23 (`01_specs.md:860`)
  reads exactly `` `DEVICE`; needs the device's own credential ``.

### Verification (quoted in G.6 to G.8 of the document)

| Check | Result | Time |
|---|---|---|
| `npm run test -w @dems/shared -- --maxWorkers=2` | exit 0: 68 files, 1,813 tests | 19:36:27 |
| `gen-openapi.ts --check`; typecheck and lint of `@dems/shared` | exit 0, three times | 19:36:27 to 19:36:30 |
| Typecheck of `@dems/core-web`, `@dems/mobile`, `@dems/core-server` | exit 0 | 19:36:47, 19:36:52, 19:48:25 |
| Lint of `@dems/core-server` | exit 0, no finding | 19:48:25 |
| Own `unit` files | exit 0: 9 files, 170 tests | 19:49:23 |
| Own `db` files, `DEMS_TEST_STEP=50c` | exit 0: 4 files, 121 tests; 0 databases remain | 19:47:57 |
| Whole `unit` project (one run) | exit 0: 146 files, 3,783 tests | 19:39:20 |
| Whole `db` project (one run) | exit 1: 2 files red of 118 (5 tests), none by a defect of this step: `test/acceptance/rbac-matrix.test.ts` was being adapted by its owner during the run (green alone at 19:43:03); `src/modules/demo/__tests__/reset-failures.db.test.ts:391` fails with this step removed too | 19:42:18 |
| `test/acceptance`, after its owner's change | exit 0: 5 files, 124 tests | 19:49:57 |
| Without the evaluation (out of the tree) | 19 of this row's tests red (unit 11, db 8) | 19:44:42 |
| Mutation check, transform only (M15) | 12 of 12 detected | 19:45:09 to 19:47:23 |
| End state | 0 databases with the prefix `dems_test_step_50`; no listener; `.locks/postgres.pid` 19121 | 19:48:03 |

### Files created or updated

Applied from the contract owner's patch (not edited by hand):

- `packages/shared/src/api/contract-model.ts`, `example-parts.ts`, `pairing.ts`
- `packages/shared/test/api-registry.test.ts`, `api-openapi-scope.test.ts`
- `packages/shared/openapi/openapi.json`

Production, changed:

- `apps/core-server/src/plugins/permission-guard/decision.ts`
- `apps/core-server/src/plugins/permission-guard/denial.ts`
- `apps/core-server/src/plugins/permission-guard/index.ts`

This row's tests, changed: `access-rules.test.ts`, `decision.test.ts`, `denial.test.ts`,
`guard.test.ts`, `pipeline.db.test.ts` under `apps/core-server/src/plugins/permission-guard/__tests__/`.
Created: `apps/core-server/src/plugins/permission-guard/__tests__/device-credential.db.test.ts`.

By design, granted lines only (before and after in G.4 of the document):

- `apps/core-server/src/modules/rbac/__tests__/matrix.db.test.ts` (:158-163)
- `apps/core-server/src/modules/pairing/__tests__/routes.test.ts` (:128-131)
- `apps/core-server/src/modules/pairing/__tests__/devices.db.test.ts` (:536-540)
- `apps/core-server/src/modules/pairing/__tests__/concurrency.db.test.ts` (:387-388, :396-400, :421-430; granted by the ruling of about 19:37)

Documents and assets:

- `docs/2026-10-04_dems_backend_rbac_pairing/masterplan/01_specs.md` (:64, :405, :654, :660, :756, :860)
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/28_rbac_guard_pipeline.md` (the section appended; the pointer under the header)
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28d_guard_condition_op23.patch`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28d_harness.vitest.config.mjs.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28d_harness.run.sh.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28d_mutations.json`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28d_mutations.log`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28d_without_evaluation.log`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28d_test_unit_verbose.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28d_test_db_verbose.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/28d_final_runs.log`
- `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_50.md` (this file)
- `.cache/rollback/guard_condition_op23/` (19 pre-images; git-ignored)

Not written: `delegation_progress_report.md`, `status_tasks.md`, `decisions/decisions.md`,
`gateway_check/01_gate_report.md`, `masterplan/02_plan.md`, and nothing under `test/acceptance/**`,
`src/modules/identity/**`, `src/realtime/**`, `src/core/**`, `src/engine/**`, `test/helpers/**`.
`27c_condition_op8_addon.patch` was not applied.

### Milestones

| Time | Milestone |
|---|---|
| 19:22 to 19:34 | Inputs read; `git apply --check` exit 0; the edits written as scripts and dry-run without writing |
| 19:34:58 | Pre-images, the patch, the evaluation, the tests and the specification, in one step |
| 19:35:08 | Typecheck of the server exit 0 |
| 19:35:46 | One by-design red outside the grant (`concurrency.db.test.ts`): reported to the controller, not edited |
| about 19:37 | Ruling received; the granted change made; the test green three times |
| 19:38 to 19:42 | One whole `unit` run, one whole `db` run |
| 19:42 to 19:47 | The two red files of the whole run judged (alone, and out of the tree); the tests without the evaluation; 12 mutations |
| 19:47 to 19:58 | Final runs, end state, assets, the document |

### Blockers

None.

### Findings, deviations, decisions (G.9 of the document)

1. CF-1: the stage's log line carried the key `cause` since the row was built; the server-wide
   static test does not follow a member that arrives through a spread (`test/static/log-calls.ts:127`).
   Renamed to `refusedBy`.
2. CF-2 (deviation, for a ruling): `decideConditions` got a `default` that refuses, beside the
   fourth case. A later patch that adds a member to the vocabulary cannot land without its case.
3. CF-4 (deviation): `access-rules.test.ts` does not pin the holders of this one condition as a
   closed list (decision D118); the other seven pairs stay closed.
4. CF-5: as ruled, the refused attempt leaves no audit row; one warn line per attempt.
5. CF-6, CF-7, CF-9: notes for the contract close-out, the acceptance row (`contract.test.ts:1456`)
   and the pairing row (`concurrency.db.test.ts:380`).
6. Red and not this row's: `src/modules/demo/__tests__/reset-failures.db.test.ts:391`
   (`expected [ …(87) ] to have a length of 86 but got 87`), in the whole `db` run of 19:39 and
   alone at 19:42:54; the same with this step served from its pre-images. For the engine fix round.

### Cleanup

The scratch harness is removed (its link first). No process of this row is left, no port was
bound, PostgreSQL untouched (`.locks/postgres.pid` 19121).
