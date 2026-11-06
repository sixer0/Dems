---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-06
agent: test-expert (tier R)
blueprint_row: 109
plan_row: W87
title: Test completion, the test strategy and the coverage report (SC7; TD-12; AC-B-68; AC-C-53, AC-C-56, AC-C-101)
tier: 1
type: test-report
status: completed
source_plan: masterplan/02_plan.md
routed_decisions: D121 ruling 4, D127 ruling 3, D147 DN-2, D171 F-8, D179 DC-6, D180 DN-5
---
> Saved by the controller from the test-expert's final response (decision D189): the tool refused the agent's own write of this file; the text is the agent's, unedited.

All times are WIB, 2026-10-06. No credential, token, password or pairing code appears in this report.

## 1. Result

| Question | Answer | Evidence |
|---|---|---|
| Every workspace's run exits 0 at or above the ledger | Yes, fresh runs 08:25 to 08:32: shared 69 / 1,840; core-web **103 / 1,392**; mobile **145 / 1,743**; server `unit` 154 / 3,916; server `db` 122 / 1,740 (0 test databases left); mock-core 4 / 19 | §10; `assets/01_final_*.log` |
| Typecheck and lint of the workspaces touched (core-web, mobile) | All four exit 0 (08:32) | `assets/01_final_*_typecheck_lint.log` |
| Operation-to-test table (AC-B-68) | 75 / 75 success, 41 / 41 denial, 25 / 25 validation; every cell has at least one test in the `db` project. No gap, so no server `gap-*.test.ts` | §4; `assets/01_operation_test_map.md` |
| Site-to-test table (AC-C-56) | 54 / 54 in scope; 5 were missing before this row and are now added | §5 |
| AC-to-test table | 203 criteria: 177 named by a test file; 26 verified outside the suites by design | §6 |
| The two static tests of AC-C-53 | Added and green (web 6 tests, mobile 6 tests); TS-15 checked in both | §8 |
| Backend coverage (`@vitest/coverage-v8` 5.0.3, both projects) | Lines **96.93 %** (7,958 / 8,210); statements 95.78 % (9,131 / 9,533); branches 90.12 % (4,720 / 5,237); functions 97.81 % (2,060 / 2,106); 276 files / 5,656 tests, exit 0 | §7 |
| Can each new test fail | 17 / 17 deliberate breaks caught, all in memory; no tree file changed (rule M15) | §8.2; `assets/01_mutations.log` |
| Routed items | DN-2 and DN-5: tests added. D121(4) and DC-6: applied. F-8: cause found, needs a production change. D127: existing test comment, not edited | §9 |
| Protected and baseline test files | 6 protected web files and 72 mobile baseline files: SHA-256 equal at 06:07 and 08:32, git status clean | §10.2 |

## 2. Tier 1 frame

**Subject.** The tests no build row owned: the two app-wide static tests of AC-C-53, the routed open tests, and the site IDs no Live test named. Every suite is run again against the ledger, and the four tables of SC7 and plan §12 are produced: operations, sites, acceptance criteria, coverage.

**Stakeholders.**
- **Controller:** the new ledger and the evidence for SC7, AC-B-68, AC-C-53, AC-C-56 and AC-C-101.
- **W89 (root gate):** expected totals and protected-file hashes.
- **W92, W93, W99, W100 (reviews):** coverage gaps and findings F1 to F3.
- **W88 (final report):** the tables.
- **User:** proof that each of the 75 operations was exercised against a real PostgreSQL as a success, a permission refusal and a bad body.

**Timeline.**

| Time | Event |
|---|---|
| 05:33 | Start (load average 2.50) |
| 05:37 to 05:41 | Operation map: both server projects run once with a response probe |
| 05:42 to 05:55 | New tests written, each green alone |
| 05:56 to 06:01 | Mutation checks; F-8 diagnosed |
| 06:02 to 06:13 | Full runs; coverage run 06:10:25 to 06:13:08 |
| 06:13 to 08:14 | Agent stream interrupted. No file under `apps/` or `packages/` changed in that time (`find -newer` at 08:15) |
| 08:15 to 08:24 | Resume checks; mutation re-run (15 / 15); S1-3 tests added; 17 / 17 |
| 08:25 to 08:32 | Final runs |

**Scope.**
- **In:** the row's write paths, and new test files beside the code or beside the test bed they use (`apps/core-web/src/test/live-gap-*`, `apps/mobile/src/features/<folder>/live-gap-*`).
- **Out:** existing test files and production files (a needed change there is a finding); end-to-end SC3 to SC5 (W94 to W96); the root gate with PostgreSQL stopped (W89); `dems_demo`, port 4420 and the lanes.

**Why it was done this way.**
1. A test's name does not prove which operation answered which status. So every answer was recorded during a real run of both server projects (§3.2).
2. AC-C-56 asks for a Live test that names the ID. So all test files were scanned for each ID, flagging whether the file is a Live test and whether the ID appears in a test title.
3. Each page row proved AC-C-53 for its own folder only. So one app-wide static test per app was added.
4. Rule M15 forbids changing tree files to show a test can fail. So all breaks were applied in memory.

**Alternatives rejected.**
- *Build the table from test names.* Rejected: names say what a test means, not what it sent.
- *Reuse W52's contract coverage.* Rejected: it predates W83. Also, for operations 39, 40, 41, 49, 50 and 65 its 403 cell came from `ORIGIN_NOT_ALLOWED`, not from a permission refusal (`test/assets/03_contract_coverage.md`). The probe found the module tests that remove the grant from the cloned database instead.
- *Edit the existing pairing and biometric tests to add the IDs.* Rejected: forbidden by the brief.

**Assumptions.**
- **A-1:** a test that received an answer exercised it. How strongly it asserts is that test's own business (judged by the module gates); the denial column is also asserted cell by cell by the matrix test, W47.
- **A-2:** the probe does not change behaviour. Both projects gave identical totals with and without it.
- **A-3:** the 06:10 coverage run stands for the final server tree. Nothing under `apps/core-server` or `packages/shared` changed after it (checked at 08:33).

## 3. Test strategy, as built

| Layer | State after W87 |
|---|---|
| T0 Static (`tsc`, oxlint, eslint, static tests) | Green; the two app-wide AC-C-53 tests added |
| T1 Unit, no database (Vitest 5.0.3 / jest, 2 workers) | server `unit` 154 / 3,916; shared 69 / 1,840; web 103 / 1,392; mobile 145 / 1,743 |
| T2 Integration on PostgreSQL 18.4 (`test:db`, one clone per file, connected as `dems_app`) | `db` 122 / 1,740; 0 test databases left |
| T3 Acceptance (W47 to W49, W52, W53) | Included in `db`; unchanged |
| T4 to T10 (gates, live checks, end to end, regression, clean state, security, performance) | Other rows |

### 3.2 How the operation map was measured

A scratch Vitest config (`assets/01_opmap_probe.vitest.config.mts.txt`) adds one setup file (`assets/01_opmap_probe.setup.ts.txt`) to the workspace's own config. The setup file listens on Node's `fastify.initialization` diagnostics channel (`node_modules/fastify/fastify.js:85, 455-456`). On each new Fastify instance it adds an `onSend` hook that records test file, test name, method, URL, status and error code, then returns the payload unchanged.

```sh
DEMS_TEST_STEP=109 npm run test    -w @dems/core-server -- --config .cache/w87/opmap/probe.vitest.config.mts   # 154 / 3,916, exit 0
DEMS_TEST_STEP=109 npm run test:db -w @dems/core-server -- --config .cache/w87/opmap/probe.vitest.config.mts   # 122 / 1,740, exit 0, 0 databases left
node --import tsx .cache/w87/opmap/analyse.ts   # records 18235; matched 12447; unmatched 5788; operations 75
```

- **Matching:** each answer is matched to an operation with the registry's own `matchCoreApiOperation`.
- **Success:** any 2xx.
- **Denial:** 403 with `NOT_PERMITTED` or `FORBIDDEN`.
- **Validation:** 400 `INVALID_JSON`, 413, or 422 `INVALID_INPUT` / `INVALID_REASON`, counted only when the path parameter is valid (so the body was what got judged).
- **Unmatched answers (5,788):** scratch routes, unknown paths and socket upgrades.

### 3.3 How to run

```sh
npm run test -w @dems/shared      -- --maxWorkers=2
npm run test -w @dems/core-web    -- --maxWorkers=2
npm run test -w @dems/mobile      -- --maxWorkers=2
npm run test -w @dems/core-server -- --maxWorkers=2                 # unit, no database
npm run test -w @dems/mock-core   -- --maxWorkers=2                 # binds loopback ports (sandbox bypass)
DEMS_TEST_STEP=<row> npm run test:db  -w @dems/core-server -- --maxWorkers=2   # PostgreSQL 127.0.0.1:4432
DEMS_TEST_STEP=<row> npm run coverage -w @dems/core-server -- --maxWorkers=2 --coverage.reportsDirectory=$PWD/.cache/<row>/coverage
```

Two notes:
- `apps/core-server/coverage/` is not git-ignored, so the coverage report must be pointed elsewhere.
- No coverage threshold is set (GP-08); the binding rule is the operation table. There is no CI; the gate rows play that role.

## 4. Table 1 — operation to test (75 rows; AC-B-68)

**Totals:** success 75 / 75; denial 41 / 41; validation 25 / 25.

Each cell names the two files with the most tests in that class (a `db` file first), then the totals. Path shorthand:
- `modules/<area>/<file>` = `apps/core-server/src/modules/<area>/__tests__/<file>`
- `acceptance/<file>` = `apps/core-server/test/acceptance/<file>`

Every test name is in `assets/01_operation_test_map.md`.

Every seeded role holds `EVIDENCE_VIEW` (operations 39 to 41) and `DIAGNOSTICS_RUN` (49, 50, 65). Their denials come from module tests that take the grant away in the cloned database (`modules/evidence/commands.db.test.ts`, `modules/devices/devices.db.test.ts`, `plugins/permission-guard/denial.db.test.ts`).

| # | Operation | Access | Body | Success (2xx) | Denial (403) | Validation (body) |
|--:|---|---|:-:|---|---|---|
| 1 | `getServiceHealth` | PUBLIC | — | `acceptance/rbac-matrix.test.ts` (19), `acceptance/contract.test.ts` (5) +18 files; 71 tests in 20 files | n/a | n/a |
| 2 | `signIn` | PUBLIC + CONSOLE_IDENTITY | yes | `modules/identity/biometric/sign-in.db.test.ts` (25), `modules/identity/sessions.db.test.ts` (19) +73 files; 350 tests in 75 files | n/a | `modules/identity/sign-in.db.test.ts` (6), `acceptance/rbac-matrix.test.ts` (4) +3 files; 15 tests in 5 files |
| 3 | `getSignInStatus` | PUBLIC | — | `acceptance/rbac-matrix.test.ts` (15), `modules/identity/biometric/sequence.db.test.ts` (13) +18 files; 71 tests in 20 files | n/a | n/a |
| 4 | `getAuthSession` | AUTHENTICATED | — | `modules/admin/last-admin.db.test.ts` (13), `modules/identity/sessions.db.test.ts` (11) +30 files; 111 tests in 32 files | n/a | n/a |
| 5 | `signOut` | AUTHENTICATED | yes | `engine/clock-floor.db.test.ts` (5), `modules/identity/sessions.db.test.ts` (3) +16 files; 27 tests in 18 files | n/a | `acceptance/rbac-matrix.test.ts` (10), `acceptance/contract.test.ts` (2) +2 files; 14 tests in 4 files |
| 6 | `touchSession` | AUTHENTICATED | — | `acceptance/rbac-matrix.test.ts` (21), `plugins/permission-guard/pipeline.db.test.ts` (5) +11 files; 45 tests in 13 files | n/a | n/a |
| 7 | `setBiometricEnrollment` | AUTHENTICATED + DEVICE_SESSION | yes | `modules/identity/biometric/sign-in.db.test.ts` (24), `modules/identity/biometric/sequence.db.test.ts` (11) +10 files; 79 tests in 12 files | n/a | `acceptance/contract.test.ts` (2), `modules/identity/biometric/enrolment.db.test.ts` (1) +3 files; 7 tests in 5 files |
| 8 | `signInWithBiometric` | DEVICE + DEVICE_CREDENTIAL | yes | `modules/identity/biometric/sign-in.db.test.ts` (18), `modules/identity/biometric/concurrency.db.test.ts` (8) +9 files; 47 tests in 11 files | n/a | `acceptance/contract.test.ts` (3), `modules/identity/biometric/secrets.db.test.ts` (1) +4 files; 10 tests in 6 files |
| 9 | `reportBiometricFailure` | DEVICE | yes | `modules/identity/biometric/failure.db.test.ts` (12), `acceptance/rbac-matrix.test.ts` (4) +6 files; 23 tests in 8 files | n/a | `acceptance/contract.test.ts` (2), `modules/identity/biometric/failure.db.test.ts` (1) +3 files; 8 tests in 5 files |
| 10 | `getRoleMatrix` | AUTHENTICATED | — | `acceptance/rbac-matrix.test.ts` (10), `acceptance/restart.test.ts` (6) +3 files; 26 tests in 5 files | n/a | n/a |
| 11 | `listUsers` | USER_ADMIN | — | `acceptance/restart.test.ts` (6), `modules/admin/users.db.test.ts` (5) +9 files; 30 tests in 11 files | `acceptance/rbac-matrix.test.ts` (8), `modules/admin/users.db.test.ts` (3) +5 files; 20 tests in 7 files | n/a |
| 12 | `assignUserRole` | USER_ADMIN | yes | `modules/admin/users.db.test.ts` (9), `modules/admin/last-admin.db.test.ts` (7) +10 files; 30 tests in 12 files | `acceptance/rbac-matrix.test.ts` (8), `plugins/permission-guard/denial.db.test.ts` (4) +5 files; 18 tests in 7 files | `acceptance/contract.test.ts` (3), `modules/admin/sequence.db.test.ts` (1) +4 files; 16 tests in 6 files |
| 13 | `enableUser` | USER_ADMIN | yes | `modules/admin/sequence.db.test.ts` (3), `modules/admin/status.db.test.ts` (3) +9 files; 17 tests in 11 files | `acceptance/rbac-matrix.test.ts` (8), `modules/admin/status.db.test.ts` (1) +2 files; 11 tests in 4 files | `acceptance/contract.test.ts` (3), `modules/admin/status.db.test.ts` (1) +1 file; 8 tests in 3 files |
| 14 | `disableUser` | USER_ADMIN | yes | `modules/admin/status.db.test.ts` (8), `modules/admin/last-admin.db.test.ts` (3) +11 files; 24 tests in 13 files | `acceptance/rbac-matrix.test.ts` (8), `modules/admin/status.db.test.ts` (1) +2 files; 11 tests in 4 files | `acceptance/contract.test.ts` (2), `modules/admin/status.db.test.ts` (1) +1 file; 7 tests in 3 files |
| 15 | `issuePairingCode` | PAIRING_MANAGE | — | `modules/pairing/devices.db.test.ts` (15), `modules/pairing/concurrency.db.test.ts` (13) +27 files; 112 tests in 29 files | `acceptance/rbac-matrix.test.ts` (8), `modules/pairing/lifecycle.db.test.ts` (1) +2 files; 11 tests in 4 files | n/a |
| 16 | `getPairingCodeStatus` | PAIRING_MANAGE | — | `acceptance/restart.test.ts` (7), `acceptance/pairing-lifecycle.test.ts` (4) +8 files; 24 tests in 10 files | `acceptance/rbac-matrix.test.ts` (8), `modules/pairing/lifecycle.db.test.ts` (1) +2 files; 11 tests in 4 files | n/a |
| 17 | `cancelPairingCode` | PAIRING_MANAGE | — | `modules/pairing/lifecycle.db.test.ts` (3), `acceptance/contract.test.ts` (3) +7 files; 15 tests in 9 files | `acceptance/rbac-matrix.test.ts` (8), `modules/pairing/lifecycle.db.test.ts` (1) +2 files; 11 tests in 4 files | n/a |
| 18 | `redeemPairingCode` | PUBLIC | yes | `modules/pairing/devices.db.test.ts` (15), `engine/clock-floor.db.test.ts` (8) +28 files; 89 tests in 30 files | n/a | `acceptance/rbac-matrix.test.ts` (5), `acceptance/contract.test.ts` (3) +5 files; 13 tests in 7 files |
| 19 | `listPairedDevices` | PAIRING_MANAGE | — | `modules/pairing/devices.db.test.ts` (8), `acceptance/pairing-lifecycle.test.ts` (7) +10 files; 39 tests in 12 files | `acceptance/rbac-matrix.test.ts` (8), `modules/pairing/lifecycle.db.test.ts` (1) +2 files; 11 tests in 4 files | n/a |
| 20 | `revokeDevice` | PAIRING_MANAGE | yes | `modules/pairing/devices.db.test.ts` (5), `modules/pairing/concurrency.db.test.ts` (3) +19 files; 28 tests in 21 files | `acceptance/rbac-matrix.test.ts` (8), `modules/pairing/lifecycle.db.test.ts` (1) +2 files; 11 tests in 4 files | `acceptance/contract.test.ts` (3), `modules/pairing/devices.db.test.ts` (1) +1 file; 5 tests in 3 files |
| 21 | `getDeviceRegistration` | DEVICE | — | `modules/pairing/devices.db.test.ts` (6), `acceptance/rbac-matrix.test.ts` (5) +9 files; 28 tests in 11 files | n/a | n/a |
| 22 | `unpairDevice` | DEVICE | — | `modules/pairing/devices.db.test.ts` (4), `modules/pairing/engine.db.test.ts` (1) +6 files; 11 tests in 8 files | n/a | n/a |
| 23 | `rotateDeviceCredential` | DEVICE + DEVICE_CREDENTIAL | — | `modules/pairing/devices.db.test.ts` (3), `modules/pairing/concurrency.db.test.ts` (1) +7 files; 11 tests in 9 files | n/a | n/a |
| 24 | `createSession` | SESSION_START | yes | `modules/sessions/operations.db.test.ts` (8), `acceptance/restart.test.ts` (5) +9 files; 41 tests in 11 files | `acceptance/rbac-matrix.test.ts` (4), `acceptance/contract.test.ts` (2) +2 files; 10 tests in 4 files | `acceptance/contract.test.ts` (3), `acceptance/rbac-matrix.test.ts` (2) +2 files; 9 tests in 4 files |
| 25 | `startSession` | SESSION_START | yes | `modules/sessions/operations.db.test.ts` (5), `acceptance/restart.test.ts` (4) +9 files; 31 tests in 11 files | `plugins/permission-guard/denial.db.test.ts` (8), `acceptance/rbac-matrix.test.ts` (4) +5 files; 21 tests in 7 files | `acceptance/contract.test.ts` (2), `acceptance/rbac-matrix.test.ts` (2) +1 file; 5 tests in 3 files |
| 26 | `stopSession` | SESSION_START | yes | `acceptance/contract.test.ts` (2), `acceptance/restart.test.ts` (2) +7 files; 17 tests in 9 files | `acceptance/rbac-matrix.test.ts` (4), `modules/sessions/operations.db.test.ts` (1) +3 files; 9 tests in 5 files | `acceptance/contract.test.ts` (3), `acceptance/rbac-matrix.test.ts` (2) +3 files; 18 tests in 5 files |
| 27 | `getCurrentSession` | AUTHENTICATED | — | `acceptance/rbac-matrix.test.ts` (10), `acceptance/restart.test.ts` (10) +6 files; 48 tests in 8 files | n/a | n/a |
| 28 | `beginPrecheck` | SESSION_START | — | `acceptance/shared-state.test.ts` (4), `modules/sessions/journey.db.test.ts` (1) +5 files; 10 tests in 7 files | `acceptance/rbac-matrix.test.ts` (4), `acceptance/contract.test.ts` (1) +2 files; 7 tests in 4 files | n/a |
| 29 | `retryPrecheck` | SESSION_START | — | `modules/sessions/operations.db.test.ts` (1), `acceptance/contract.test.ts` (1) +2 files; 4 tests in 4 files | `acceptance/rbac-matrix.test.ts` (4), `acceptance/contract.test.ts` (1) +2 files; 7 tests in 4 files | n/a |
| 30 | `acknowledgePrecheckWarnings` | SESSION_START | — | `modules/sessions/operations.db.test.ts` (1), `acceptance/contract.test.ts` (1) +2 files; 4 tests in 4 files | `acceptance/rbac-matrix.test.ts` (4), `acceptance/contract.test.ts` (1) +2 files; 7 tests in 4 files | n/a |
| 31 | `cancelSession` | SESSION_START | — | `modules/sessions/concurrency.db.test.ts` (3), `modules/sessions/journey.db.test.ts` (1) +5 files; 12 tests in 7 files | `acceptance/rbac-matrix.test.ts` (4), `acceptance/contract.test.ts` (1) +2 files; 7 tests in 4 files | n/a |
| 32 | `scanCaseNumber` | SESSION_START | — | `acceptance/rbac-matrix.test.ts` (4), `modules/sessions/operations.db.test.ts` (1) +3 files; 9 tests in 5 files | `acceptance/rbac-matrix.test.ts` (4), `acceptance/contract.test.ts` (1) +2 files; 7 tests in 4 files | n/a |
| 33 | `recoverSession` | SESSION_START | — | `acceptance/restart.test.ts` (3), `modules/sessions/journey.db.test.ts` (1) +3 files; 7 tests in 5 files | `acceptance/rbac-matrix.test.ts` (4), `acceptance/contract.test.ts` (1) +2 files; 7 tests in 4 files | n/a |
| 34 | `addSessionMarker` | SESSION_NOTE | yes | `acceptance/restart.test.ts` (3), `acceptance/shared-state.test.ts` (2) +6 files; 13 tests in 8 files | `acceptance/rbac-matrix.test.ts` (4), `acceptance/contract.test.ts` (1) +2 files; 7 tests in 4 files | `acceptance/contract.test.ts` (3), `acceptance/rbac-matrix.test.ts` (2) +1 file; 6 tests in 3 files |
| 35 | `addSessionNote` | SESSION_NOTE | yes | `acceptance/contract.test.ts` (2), `modules/sessions/journey.db.test.ts` (1) +4 files; 8 tests in 6 files | `acceptance/rbac-matrix.test.ts` (4), `modules/sessions/operations.db.test.ts` (1) +3 files; 8 tests in 5 files | `acceptance/contract.test.ts` (3), `acceptance/rbac-matrix.test.ts` (2) +2 files; 8 tests in 4 files |
| 36 | `takeSessionSnapshot` | SESSION_NOTE | — | `modules/sessions/journey.db.test.ts` (1), `modules/sessions/operations.db.test.ts` (1) +3 files; 5 tests in 5 files | `acceptance/rbac-matrix.test.ts` (4), `acceptance/contract.test.ts` (1) +2 files; 7 tests in 4 files | n/a |
| 37 | `acknowledgeSessionSummary` | SESSION_START | — | `acceptance/rbac-matrix.test.ts` (4), `acceptance/contract.test.ts` (2) +6 files; 15 tests in 8 files | `acceptance/rbac-matrix.test.ts` (4), `acceptance/contract.test.ts` (1) +2 files; 7 tests in 4 files | n/a |
| 38 | `listSessionHistory` | AUTHENTICATED | — | `modules/sessions/history.db.test.ts` (12), `acceptance/rbac-matrix.test.ts` (10) +4 files; 36 tests in 6 files | n/a | n/a |
| 39 | `listEvidence` | EVIDENCE_VIEW | — | `modules/evidence/reads.db.test.ts` (22), `acceptance/rbac-matrix.test.ts` (11) +8 files; 59 tests in 10 files | `modules/evidence/commands.db.test.ts` (1), `plugins/permission-guard/denial.db.test.ts` (1) +2 files; 4 tests in 4 files | n/a |
| 40 | `getEvidence` | EVIDENCE_VIEW | — | `acceptance/rbac-matrix.test.ts` (11), `modules/evidence/immutability.db.test.ts` (6) +8 files; 36 tests in 10 files | `modules/evidence/commands.db.test.ts` (1), `acceptance/contract.test.ts` (1) +1 file; 3 tests in 3 files | n/a |
| 41 | `verifyEvidence` | EVIDENCE_VIEW | — | `modules/evidence/commands.db.test.ts` (10), `modules/evidence/immutability.db.test.ts` (7) +8 files; 33 tests in 10 files | `modules/evidence/commands.db.test.ts` (1), `acceptance/contract.test.ts` (1) +2 files; 4 tests in 4 files | n/a |
| 42 | `exportEvidence` | EVIDENCE_EXPORT | yes | `modules/evidence/immutability.db.test.ts` (6), `modules/evidence/commands.db.test.ts` (5) +6 files; 20 tests in 8 files | `acceptance/rbac-matrix.test.ts` (8), `modules/evidence/commands.db.test.ts` (4) +4 files; 18 tests in 6 files | `modules/evidence/commands.db.test.ts` (3), `acceptance/contract.test.ts` (3) +1 file; 21 tests in 3 files |
| 43 | `archiveEvidence` | EVIDENCE_REVIEW | — | `modules/evidence/immutability.db.test.ts` (7), `modules/evidence/commands.db.test.ts` (3) +5 files; 17 tests in 7 files | `acceptance/rbac-matrix.test.ts` (8), `modules/evidence/commands.db.test.ts` (2) +2 files; 12 tests in 4 files | n/a |
| 44 | `getDeviceHealth` | AUTHENTICATED | — | `acceptance/rbac-matrix.test.ts` (10), `modules/devices/devices.db.test.ts` (7) +3 files; 26 tests in 5 files | n/a | n/a |
| 45 | `getAudioStatus` | AUTHENTICATED | — | `acceptance/rbac-matrix.test.ts` (10), `modules/devices/devices.db.test.ts` (6) +4 files; 28 tests in 6 files | n/a | n/a |
| 46 | `getVideoStatus` | AUTHENTICATED | — | `acceptance/rbac-matrix.test.ts` (10), `modules/devices/devices.db.test.ts` (7) +3 files; 26 tests in 5 files | n/a | n/a |
| 47 | `getDeviceInventory` | AUTHENTICATED | — | `acceptance/rbac-matrix.test.ts` (10), `modules/devices/devices.db.test.ts` (7) +3 files; 26 tests in 5 files | n/a | n/a |
| 48 | `restartDevice` | DEVICE_MANAGE | — | `modules/devices/devices.db.test.ts` (3), `acceptance/rbac-matrix.test.ts` (2) +4 files; 12 tests in 6 files | `acceptance/rbac-matrix.test.ts` (6), `modules/devices/devices.db.test.ts` (4) +2 files; 12 tests in 4 files | n/a |
| 49 | `testDeviceSignal` | DIAGNOSTICS_RUN | — | `acceptance/rbac-matrix.test.ts` (6), `modules/devices/devices.db.test.ts` (5) +4 files; 18 tests in 6 files | `modules/devices/devices.db.test.ts` (1), `acceptance/contract.test.ts` (1) +1 file; 3 tests in 3 files | n/a |
| 50 | `identifyDevice` | DIAGNOSTICS_RUN | — | `acceptance/rbac-matrix.test.ts` (6), `modules/devices/devices.db.test.ts` (5) +4 files; 18 tests in 6 files | `modules/devices/devices.db.test.ts` (1), `acceptance/contract.test.ts` (1) +1 file; 3 tests in 3 files | n/a |
| 51 | `setActiveCamera` | AUTHENTICATED | yes | `acceptance/rbac-matrix.test.ts` (6), `modules/devices/devices.db.test.ts` (1) +3 files; 11 tests in 5 files | n/a | `acceptance/rbac-matrix.test.ts` (4), `acceptance/contract.test.ts` (2) +2 files; 8 tests in 4 files |
| 52 | `resetMicClip` | AUTHENTICATED | yes | `acceptance/rbac-matrix.test.ts` (6), `modules/devices/devices.db.test.ts` (1) +4 files; 12 tests in 6 files | n/a | `acceptance/rbac-matrix.test.ts` (4), `acceptance/contract.test.ts` (2) +2 files; 8 tests in 4 files |
| 53 | `getStorageStatus` | AUTHENTICATED | — | `acceptance/rbac-matrix.test.ts` (10), `modules/storage/storage.db.test.ts` (7) +3 files; 29 tests in 5 files | n/a | n/a |
| 54 | `getStorageDetail` | AUTHENTICATED | — | `acceptance/rbac-matrix.test.ts` (10), `acceptance/restart.test.ts` (8) +4 files; 35 tests in 6 files | n/a | n/a |
| 55 | `setStoragePolicy` | ANY-OF(EVIDENCE_REVIEW, MAINTENANCE) | yes | `modules/storage/storage.db.test.ts` (7), `acceptance/rbac-matrix.test.ts` (4) +9 files; 33 tests in 11 files | `acceptance/rbac-matrix.test.ts` (4), `modules/storage/storage.db.test.ts` (3) +8 files; 18 tests in 10 files | `acceptance/contract.test.ts` (2), `acceptance/rbac-matrix.test.ts` (2) +4 files; 24 tests in 6 files |
| 56 | `getNetworkStatus` | AUTHENTICATED | — | `modules/network-time/network-time.db.test.ts` (10), `acceptance/rbac-matrix.test.ts` (10) +3 files; 34 tests in 5 files | n/a | n/a |
| 57 | `getTimeStatus` | AUTHENTICATED | — | `acceptance/rbac-matrix.test.ts` (10), `modules/network-time/network-time.db.test.ts` (9) +3 files; 32 tests in 5 files | n/a | n/a |
| 58 | `getSecurityStatus` | AUTHENTICATED | — | `acceptance/rbac-matrix.test.ts` (10), `modules/security-audit/reads.db.test.ts` (7) +6 files; 34 tests in 8 files | n/a | n/a |
| 59 | `listAuditRows` | AUTHENTICATED | — | `modules/security-audit/reads.db.test.ts` (17), `acceptance/rbac-matrix.test.ts` (10) +8 files; 52 tests in 10 files | n/a | n/a |
| 60 | `verifyAuditChain` | AUTHENTICATED | — | `modules/security-audit/chain.db.test.ts` (14), `acceptance/rbac-matrix.test.ts` (10) +6 files; 45 tests in 8 files | n/a | n/a |
| 61 | `exportAudit` | AUDIT_EXPORT | yes | `modules/security-audit/exports.db.test.ts` (6), `acceptance/contract.test.ts` (2) +6 files; 16 tests in 8 files | `acceptance/rbac-matrix.test.ts` (8), `modules/security-audit/exports.db.test.ts` (3) +4 files; 15 tests in 6 files | `modules/security-audit/exports.db.test.ts` (14), `acceptance/contract.test.ts` (3) +3 files; 28 tests in 5 files |
| 62 | `exportLogs` | AUDIT_EXPORT | yes | `modules/security-audit/exports.db.test.ts` (4), `acceptance/rbac-matrix.test.ts` (2) +5 files; 12 tests in 7 files | `acceptance/rbac-matrix.test.ts` (8), `modules/security-audit/exports.db.test.ts` (4) +4 files; 16 tests in 6 files | `modules/security-audit/exports.db.test.ts` (14), `acceptance/contract.test.ts` (3) +2 files; 27 tests in 4 files |
| 63 | `listEvents` | AUTHENTICATED | — | `acceptance/rbac-matrix.test.ts` (10), `modules/security-audit/reads.db.test.ts` (9) +7 files; 37 tests in 9 files | n/a | n/a |
| 64 | `getSystemStatus` | AUTHENTICATED | — | `acceptance/rbac-matrix.test.ts` (10), `modules/system/system.db.test.ts` (6) +4 files; 29 tests in 6 files | n/a | n/a |
| 65 | `runDiagnostics` | DIAGNOSTICS_RUN | — | `acceptance/rbac-matrix.test.ts` (6), `plugins/permission-guard/denial.db.test.ts` (2) +5 files; 19 tests in 7 files | `plugins/permission-guard/denial.db.test.ts` (1), `acceptance/contract.test.ts` (1) +2 files; 4 tests in 4 files | n/a |
| 66 | `restartServices` | MAINTENANCE | — | `modules/system/system.db.test.ts` (2), `modules/system/effects.db.test.ts` (1) +3 files; 9 tests in 5 files | `acceptance/rbac-matrix.test.ts` (6), `modules/system/system.db.test.ts` (1) +3 files; 11 tests in 5 files | n/a |
| 67 | `startSoftwareUpdate` | MAINTENANCE | — | `modules/system/system.db.test.ts` (2), `modules/system/effects.db.test.ts` (1) +3 files; 11 tests in 5 files | `acceptance/rbac-matrix.test.ts` (6), `modules/system/system.db.test.ts` (1) +3 files; 11 tests in 5 files | n/a |
| 68 | `updateSettings` | AUTHENTICATED | yes | `modules/system/system.db.test.ts` (11), `acceptance/rbac-matrix.test.ts` (6) +3 files; 32 tests in 5 files | n/a | `acceptance/rbac-matrix.test.ts` (4), `modules/system/system.db.test.ts` (3) +2 files; 20 tests in 4 files |
| 69 | `listAlerts` | AUTHENTICATED | — | `acceptance/rbac-matrix.test.ts` (10), `modules/alerts/alerts.db.test.ts` (8) +3 files; 30 tests in 5 files | n/a | n/a |
| 70 | `acknowledgeAlert` | AUTHENTICATED | — | `modules/alerts/alerts.db.test.ts` (9), `acceptance/rbac-matrix.test.ts` (6) +3 files; 29 tests in 5 files | n/a | n/a |
| 71 | `getDemoStatus` | DEMO_CONTROL + DEMO_FLAG | — | `modules/demo/reset-failures.db.test.ts` (10), `modules/demo/faults.db.test.ts` (5) +6 files; 30 tests in 8 files | `acceptance/rbac-matrix.test.ts` (9), `modules/demo/gate.db.test.ts` (2) +3 files; 15 tests in 5 files | n/a |
| 72 | `loadScenario` | DEMO_CONTROL + DEMO_FLAG | yes | `modules/demo/reset.db.test.ts` (1), `acceptance/contract.test.ts` (1) +2 files; 7 tests in 4 files | `acceptance/rbac-matrix.test.ts` (9), `modules/demo/gate.db.test.ts` (2) +2 files; 13 tests in 4 files | `acceptance/contract.test.ts` (2), `acceptance/rbac-matrix.test.ts` (2) +1 file; 7 tests in 3 files |
| 73 | `injectFault` | DEMO_CONTROL + DEMO_FLAG | yes | `modules/demo/reset-failures.db.test.ts` (10), `modules/demo/faults.db.test.ts` (4) +6 files; 29 tests in 8 files | `acceptance/rbac-matrix.test.ts` (9), `modules/demo/gate.db.test.ts` (2) +2 files; 13 tests in 4 files | `modules/demo/faults.db.test.ts` (2), `acceptance/contract.test.ts` (2) +1 file; 10 tests in 3 files |
| 74 | `clearFault` | DEMO_CONTROL + DEMO_FLAG | yes | `modules/demo/reset-failures.db.test.ts` (10), `acceptance/contract.test.ts` (3) +5 files; 21 tests in 7 files | `acceptance/rbac-matrix.test.ts` (9), `modules/demo/gate.db.test.ts` (2) +2 files; 13 tests in 4 files | `acceptance/contract.test.ts` (2), `modules/demo/routes.test.ts` (6); 8 tests in 2 files |
| 75 | `resetDemo` | DEMO_CONTROL + DEMO_FLAG | — | `modules/demo/reset-failures.db.test.ts` (2), `modules/demo/reset.db.test.ts` (2) +5 files; 10 tests in 7 files | `acceptance/rbac-matrix.test.ts` (9), `modules/demo/gate.db.test.ts` (2) +4 files; 15 tests in 6 files | n/a |

## 5. Table 2 — site to test (AC-C-56)

**54 sites in scope (27 web, 27 mobile), all covered; 6 rows added or completed by W87.**

A file counts as a Live test when it builds the fake transport, a Live bed or the console's Live harness, and is not a static test. Static files that also name an ID are listed in brackets. "T" means the ID appears in a test or describe title. Scan: `assets/01_sites_scan.py.txt`; result: `assets/01_site_test_map.json`.

| Site | Where (client spec §8) | Live tests that name the ID | Status |
|---|---|---|---|
| A1 | `signIn`, `features/login/use-login-controller.ts:196` | `test/live-login-signin.test.tsx`: 4 T (also `test/live-login-model.test.tsx`, `lib/__tests__/live-core-errors.test.tsx`) | covered |
| A3 | `createSession`, `features/session-new/index.tsx:203, :207` | `test/live-session-new-create.test.tsx`: 3 T | covered |
| A4 | `scanCaseNumber`, `features/session-new/sim-adapter.ts:21` | `test/live-session-new-pending.test.tsx`: 1; `test/live-session-new-create.test.tsx`: 3 T | covered |
| A5 | `exportEvidence`, `features/evidence/export-wizard.tsx:145` | `test/live-evidence-export.test.tsx`: 15 T | covered |
| A6 | `verify`, `features/evidence/use-verification.ts:232` | `test/live-evidence-verify.test.tsx`: 13 T | covered |
| A7 | `exportAudit`, `features/security-audit/sim-adapter.ts:66` | `test/live-security-audit-export.test.tsx`: 17 T | covered |
| A8 | `exportLogs`, `features/system/diagnostics.tsx:103` | `test/live-system-export.test.tsx`: 15 T | covered |
| A9 | `verifyAuditChain`, chain panel and integrity panel | `test/live-security-audit-chain.test.tsx`: 15 T; `test/live-session-monitor-panels.test.tsx`: 6 T | covered |
| A10 | `runDiagnostics`, `features/system/use-sim-command.ts:56` | `test/live-system-maintenance.test.tsx`: 8 T | covered |
| A11 | `restartServices`, `features/system/sim-adapter.ts:67` | `test/live-system-maintenance.test.tsx`: 12 T | covered |
| B-1 | `archiveEvidence`, detail and list pages | `test/live-evidence-archive.test.tsx`: 15 T | covered |
| B-2 | `addMarker`, `addNote`, `snapshot`, `stopRecording` (action bar) | `test/live-session-monitor-actions.test.tsx`: 16 T | covered |
| B-3 | `recover`, `features/session-monitor/index.tsx:86` | `test/live-session-monitor-panels.test.tsx`: 5 T | covered |
| B-4 | `setActiveCamera`, `live-feed-panel.tsx:67` | `test/live-session-monitor-panels.test.tsx`: 6 T | covered |
| B-5 | `acknowledgeAlert`, `chain-panel.tsx:109` | `test/live-security-audit-chain.test.tsx`: 7 T | covered |
| B-6 | `beginPrecheck`, `acknowledgePrecheckWarnings`, `retryPrecheck`, `startRecording`, `cancel` | `test/live-session-new-precheck.test.tsx`: 11 T; `test/live-strict-mode-starts.test.tsx`: 3 T | covered |
| B-7 | `deviceCommand` (devices, dashboard) | `test/live-devices-commands.test.tsx`: 15 T; `test/live-dashboard-devices.test.tsx`: 17 T; `test/live-dashboard-page.test.tsx`: 1 | covered |
| B-8 | `resetClip`, `audio-input-card.tsx:50` | `test/live-devices-clip.test.tsx`: 13 T | covered |
| B-9 | `setStoragePolicy`, `manage-drawer.tsx:53` | `test/live-storage-policy.test.tsx`: 17 T; `test/live-storage-page.test.tsx`: 1 | covered |
| B-10 | The 13 commands behind `useSimCommand` | `test/live-system-maintenance.test.tsx`: 6 T; `test/live-system-demo.test.tsx`: 8 T; `test/live-system-settings.test.tsx`: 4 T | covered |
| C-7 | `demo-panel.tsx:162-170` (toast reads the newest audit row) | `test/live-system-demo.test.tsx`: 6 T | covered |
| D-1 | `evidence/sim-adapter.ts:94,96` (inject then verify) | `test/live-evidence-verify.test.tsx`: 6 T; `test/live-evidence-archive.test.tsx`: 1 | covered |
| D-2 | `session-new/index.tsx:206-207` (cancel then create) | `test/live-session-new-create.test.tsx`: 3 T | covered |
| D-3 | `session-new/index.tsx:203-214` (create then precheck) | `test/live-session-new-create.test.tsx`: 3 T | covered |
| D-4 | `demo-panel.tsx` nested commands | `test/live-system-demo.test.tsx`: 8 T | covered |
| D-5 | `devices/index.tsx:80-81` (identify then blink) | `test/live-devices-commands.test.tsx`: 5 T | covered |
| D-6 | `export-wizard.tsx:131-137` (one export per row on the denied path) | `test/live-evidence-export.test.tsx`: 10 T | covered |
| S1-1 | `signIn`, `auth/auth-provider.tsx:218` | `auth/live-auth.test.tsx`: 2 T; `features/login/live-login.test.tsx`: 2 T | covered |
| S1-2 | `signInWithBiometric`, `auth/biometric.ts:147` | `features/settings/live-gap-s1-2-biometric.test.tsx`: 3 T | covered, **added by W87** |
| S1-3 | `recordBiometricFailure`, `auth/biometric.ts:151` | `features/settings/live-gap-s1-2-biometric.test.tsx`: 3 T; `auth/live-auth.test.tsx`: 1 (header only) | covered, **added by W87** |
| S1-4 | `createSession` twice, `use-session-new.ts:174,179` | `features/session-new/live-session-new-sites.test.tsx`: 2 T; `live-session-new-replica.test.tsx`: 1 | covered |
| S1-5 | `exportEvidence` probe, `export-sheet.tsx:113` | `features/evidence/live-evidence-export.test.tsx`: 3 T | covered |
| S1-6 | `exportEvidence`, `export-sheet.tsx:142` | `features/evidence/live-evidence-export.test.tsx`: 3 T | covered |
| S1-7 | `verifyAuditChain`, `features/audit/chain-strip.tsx:107` | `features/audit/live-audit-chain.test.tsx`: 2 T | covered |
| S1-8 | `pair`, `features/pairing/use-pairing-flow.ts:103` | `features/pairing/live-gap-sites.test.tsx`: 3 T | covered, **added by W87** |
| S2-1 | `useMonitorActions.run`, `use-monitor.ts:132-152` | `features/session-live/live-session-live-sites.test.tsx`: 4 T; `live-gap-read-only-dialog.test.tsx`: 3 T | covered, **open-dialog case added by W87** |
| S2-2 | `useFlowActions.guarded`, `use-session-new.ts:199-210` | `live-session-new-sites.test.tsx`: 4 T; `live-session-new-handoff.test.tsx`: 2 T | covered |
| S2-3 | `useRecoveryActions`, `use-recovery.ts:213-243` | `features/session-recovery/live-recovery-sites.test.tsx`: 3 T | covered |
| S2-4 | `useAcknowledgeSummary`, `use-summary.ts:123-144` | `features/session-summary/live-summary-sites.test.tsx`: 2 T | covered |
| S2-5 | `usePairingFlow.unpair`, `use-pairing-flow.ts:163-174` | `features/pairing/live-gap-sites.test.tsx`: 3 T | covered, **added by W87** |
| S2-6 | `useApplyStoragePolicy`, `storage-screen.tsx:184-204` | `features/storage/live-storage-sites.test.tsx`: 2 T | covered |
| S2-7 | `useSimCommand`, `maintenance-section.tsx:61-80` | `features/settings/live-settings-sites.test.tsx`: 4 T | covered |
| S2-8 | `KnownDeviceDetail.startDiagnostics`, `device-detail.tsx:134-141` | `features/devices/live-devices-sites.test.tsx`: 2 T | covered |
| S3-1 | `ArchiveDialog`, `archive-dialog.tsx:26-39` | `features/evidence/live-evidence-archive.test.tsx`: 4 T; `live-session-new-followups.test.tsx`: 2 T; `live-settings-boundary.test.tsx`: 1 | covered |
| S3-2 | `DeviceCommandDialog`, `device-command-dialog.tsx:31-45` | `features/devices/live-devices-sites.test.tsx`: 3 T | covered |
| S4-7 | `runtime/sim-runtime-provider.tsx:199-201` (tablet link from the heartbeat) | `features/session-live/live-gap-s4-7-tablet-link.test.tsx`: 3 T | covered, **added by W87** |
| S4-8 | `use-recovery.ts:251-258` (acknowledge each matching alert) | `features/session-recovery/live-recovery-sites.test.tsx`: 2 T | covered |
| S5-1 | `export-sheet.tsx:107-120` | `features/evidence/live-evidence-export.test.tsx`: 4 T | covered |
| S5-2 | `session-recovery/sim-adapter.ts:40-58` | `live-recovery-sites.test.tsx`: 2 T | covered |
| S5-3 | `storage/sim-adapter.ts:60-62` | `live-storage-sites.test.tsx`: 3 T | covered |
| S5-4 | `devices/use-devices-data.ts:29`, `device-detail.tsx:155` | `live-devices-sites.test.tsx`: 4 T | covered |
| S5-5 | `evidence/use-evidence-data.ts:56` | `features/evidence/live-evidence-archive.test.tsx`: 1 T | covered |
| S5-6 | `session-new/session-new-model.ts:62` | `live-session-new-replica.test.tsx`: 4 T | covered |
| S5-7 | `settings/settings-model.ts:76`, `profile-sheet.tsx:51` | `live-settings-sites.test.tsx`: 2 T | covered |

**IDs out of scope:**

| ID | Why |
|---|---|
| A2 | Marked "not reachable" |
| C-1 to C-6 | Marked "no change" (all named anyway) |
| E | Marked "no change" |
| F | Marked "no change" |
| S4-1 to S4-6, S4-9 | Marked "no change" (all named anyway) |
| "—" row | Has no ID of its own; its behaviour is S2-7, S2-8 and AC-C-61 |
| "Clock" row | Marked unchanged; its one change, the pairing commit, is S1-8 |

## 6. Table 3 — acceptance criterion to test

**203 criteria; 177 named by at least one test file; 26 verified outside the test suites by design:**
- end-to-end rows W94 to W96: AC-B-22, 40, 51; AC-C-55, 64, 82
- gate commands W58 / W89: AC-B-03, 58, 59, 66; AC-C-101
- clean-state row W90: AC-B-64, 67, 91, 92
- regression row W97: AC-B-60, 61, 62; AC-C-27
- client-row logs and lane checks: AC-C-05, 33, 34, 35, 71, 84, 85

AC-B-59 and AC-C-101 are also met at this run (§10.2).

A file "names" a criterion when it holds the ID or a written range that includes it. Every file per criterion is in `assets/01_ac_test_map.json`; a longer version of this table is in `.cache/w87/parts/ac_table.md`. Path shorthand: `srv/` = `apps/core-server/`, `web/` = `apps/core-web/src/`, `mob/` = `apps/mobile/src/`, `shared/` = `packages/shared/`.

| AC | Named by: count; projects; first file | Status |
|---|---|---|
| AC-B-01 | 2; server-db; `srv/test/db/commands.db.test.ts` | named |
| AC-B-02 | 1; server-db; `srv/src/db/seed/seed.db.test.ts` | named |
| AC-B-03 | — | outside: the two `lsof` commands (W58/W89) |
| AC-B-04 | 2; server-db; `srv/src/engine/restart.db.test.ts` | named |
| AC-B-05 | 1; server-db; `srv/test/acceptance/restart.test.ts` | named |
| AC-B-06 | 1; server-db; `srv/test/acceptance/restart.test.ts` | named |
| AC-B-07 | 2; server-db, server-unit; `srv/src/engine/recording.db.test.ts` | named |
| AC-B-08 | 2; server-db, server-unit; `srv/test/acceptance/contract.test.ts` | named |
| AC-B-09 | 2; server-db, shared; `srv/test/acceptance/contract.test.ts` | named |
| AC-B-10 | 2; server-db, shared; `srv/test/acceptance/contract.test.ts` | named |
| AC-B-11 | 2; shared; `shared/test/api-openapi-scope.test.ts` | named |
| AC-B-12 | 4; server-db, server-unit; `srv/modules/rbac/matrix.db.test.ts` | named |
| AC-B-13 | 3; shared; `shared/test/api-openapi-scope.test.ts` | named |
| AC-B-14 | 5; server-db, server-unit; `srv/test/acceptance/contract.test.ts` | named |
| AC-B-15 | 1; server-db; `srv/test/acceptance/rbac-matrix.test.ts` | named |
| AC-B-16 | 4; server-db, server-unit; `srv/modules/rbac/matrix.db.test.ts` | named |
| AC-B-17 | 6; server-db, server-unit, shared, web; `srv/src/db/seed/seed.db.test.ts` | named |
| AC-B-18 | 2; server-db; `srv/modules/admin/users.db.test.ts` | named |
| AC-B-19 | 2; server-db, server-unit; `srv/src/realtime/control.db.test.ts` | named |
| AC-B-20 | 3; server-db, server-unit; `srv/modules/admin/status.db.test.ts` | named |
| AC-B-21 | 3; server-db, server-unit; `srv/modules/admin/status.db.test.ts` | named |
| AC-B-22 | — | outside: captures on both clients (W96) |
| AC-B-23 | 2; server-db, server-unit; `srv/modules/identity/sign-in.db.test.ts` | named |
| AC-B-24 | 2; server-db, server-unit; `srv/modules/identity/sign-in.db.test.ts` | named |
| AC-B-25 | 1; server-db; `srv/modules/identity/sign-in.db.test.ts` | named |
| AC-B-26 | 1; server-db; `srv/modules/identity/sessions.db.test.ts` | named |
| AC-B-27 | 1; server-db; `srv/modules/identity/sessions.db.test.ts` | named |
| AC-B-28 | 5; server-db; `srv/src/db/seed/seed.db.test.ts` | named |
| AC-B-29 | 3; server-db; `srv/modules/identity/secrets.db.test.ts` | named |
| AC-B-30 | 3; server-db, server-unit; `srv/modules/identity/sign-in.db.test.ts` | named |
| AC-B-31 | 1; server-db; `srv/modules/identity/biometric/sign-in.db.test.ts` | named |
| AC-B-32 | 2; server-db; `srv/modules/pairing/lifecycle.db.test.ts` | named |
| AC-B-33 | 2; server-db; `srv/modules/pairing/lifecycle.db.test.ts` | named |
| AC-B-34 | 2; server-db; `srv/modules/pairing/lifecycle.db.test.ts` | named |
| AC-B-35 | 2; server-db; `srv/modules/pairing/lifecycle.db.test.ts` | named |
| AC-B-36 | 2; server-db; `srv/modules/pairing/lifecycle.db.test.ts` | named |
| AC-B-37 | 2; server-db; `srv/modules/pairing/devices.db.test.ts` | named |
| AC-B-38 | 2; server-db; `srv/modules/pairing/devices.db.test.ts` | named |
| AC-B-39 | 1; server-db; `srv/test/acceptance/pairing-lifecycle.test.ts` | named |
| AC-B-40 | — | outside: captures and audit rows (W94) |
| AC-B-41 | 2; server-db; `srv/modules/pairing/secrets.db.test.ts` | named |
| AC-B-42 | 2; server-db, server-unit; `srv/src/realtime/upgrade.db.test.ts` | named |
| AC-B-43 | 3; server-db, server-unit; `srv/src/plugins/permission-guard/pipeline.db.test.ts` | named |
| AC-B-44 | 1; server-db; `srv/test/acceptance/shared-state.test.ts` | named |
| AC-B-45 | 1; server-db; `srv/test/acceptance/shared-state.test.ts` | named |
| AC-B-46 | 6; server-db, server-unit, shared; `srv/src/realtime/state.db.test.ts` | named |
| AC-B-47 | 1; server-db; `srv/test/acceptance/shared-state.test.ts` | named |
| AC-B-48 | 4; server-db, server-unit; `srv/src/realtime/backpressure.db.test.ts` | named |
| AC-B-49 | 3; server-db, server-unit; `srv/modules/sessions/concurrency.db.test.ts` | named |
| AC-B-50 | 4; server-db, server-unit; `srv/modules/sessions/journey.db.test.ts` | named |
| AC-B-51 | — | outside: captures and rows (W95) |
| AC-B-52 | 1; server-db; `srv/src/engine/recording.db.test.ts` | named |
| AC-B-53 | 5; server-db, server-unit; `srv/src/engine/commands.db.test.ts` | named |
| AC-B-54 | 3; server-db; `srv/src/core/audit-chain.db.test.ts` | named |
| AC-B-55 | 4; server-db, server-unit; `srv/src/core/audit-chain.db.test.ts` | named |
| AC-B-56 | 2; server-db; `srv/modules/demo/gate.db.test.ts` | named |
| AC-B-57 | 3; server-db; `srv/src/db/reset/reset.db.test.ts` | named |
| AC-B-58 | — | outside: the three commands with PostgreSQL stopped (W89) |
| AC-B-59 | — | outside: per-workspace runs plus `git diff` (W89); met at this run (§10.2) |
| AC-B-60 | — | outside: `shasum -a 256 -c` over `release/` (W97) |
| AC-B-61 | — | outside: `git` command and the mock-core run (W97) |
| AC-B-62 | — | outside: `git` command (W97) |
| AC-B-63 | 1; shared; `shared/test/live-source-simulated-isolation.test.ts` | named |
| AC-B-64 | — | outside: `git` commands and `stat` (W90) |
| AC-B-65 | 1; server-db; `srv/src/db/seed/seed.db.test.ts` | named |
| AC-B-66 | — | outside: `lsof` on the server process (W58/W89) |
| AC-B-67 | — | outside: W90 follows the README literally |
| AC-B-68 | 4; server-db, server-unit; `srv/modules/network-time/network-time.db.test.ts` (and Table 1 of this report) | named |
| AC-B-69 | 1; server-db; `srv/modules/evidence/immutability.db.test.ts` | named |
| AC-B-70 | 3; server-db; `srv/modules/evidence/bulk.db.test.ts` | named |
| AC-B-71 | 2; server-db, server-unit; `srv/modules/alerts/alerts.db.test.ts` | named |
| AC-B-72 | 5; server-db, server-unit; `srv/src/db/reset/guard.db.test.ts` | named |
| AC-B-73 | 4; server-db, server-unit; `srv/src/plugins/permission-guard/pipeline.db.test.ts` | named |
| AC-B-74 | 4; server-db, server-unit; `srv/src/plugins/permission-guard/pipeline.db.test.ts` | named |
| AC-B-75 | 3; server-db, server-unit; `srv/modules/pairing/concurrency.db.test.ts` | named |
| AC-B-76 | 1; server-db; `srv/modules/pairing/concurrency.db.test.ts` | named |
| AC-B-77 | 1; server-db; `srv/modules/pairing/concurrency.db.test.ts` | named |
| AC-B-78 | 1; server-db; `srv/modules/identity/biometric/concurrency.db.test.ts` | named |
| AC-B-79 | 2; server-db, server-unit; `srv/modules/admin/last-admin.db.test.ts` | named |
| AC-B-80 | 1; server-db; `srv/modules/identity/concurrency.db.test.ts` | named |
| AC-B-81 | 3; server-db, server-unit; `srv/src/plugins/authenticate/authenticate.db.test.ts` | named |
| AC-B-82 | 3; server-db, server-unit; `srv/modules/identity/biometric/sign-in.db.test.ts` | named |
| AC-B-83 | 1; server-db; `srv/modules/identity/biometric/failure.db.test.ts` | named |
| AC-B-84 | 3; server-db, server-unit; `srv/src/plugins/permission-guard/pipeline.db.test.ts` | named |
| AC-B-85 | 3; server-db, server-unit; `srv/src/realtime/upgrade.db.test.ts` | named |
| AC-B-86 | 2; pg-scripts, server-unit; `srv/test/static/credentials.test.ts` | named |
| AC-B-87 | 4; server-db; `srv/src/db/reset/reset.db.test.ts` | named |
| AC-B-88 | 2; server-db, server-unit; `srv/modules/security-audit/chain.db.test.ts` | named |
| AC-B-89 | 6; server-db, server-unit; `srv/modules/alerts/alerts.db.test.ts` | named |
| AC-B-90 | 1; server-db; `srv/modules/identity/two-instances.db.test.ts` | named |
| AC-B-91 | — | outside: supply-chain records plus `shasum` (W90) |
| AC-B-92 | — | outside: W86 writes it, W90 reads it |
| AC-B-93 | 2; server-db, shared; `srv/test/acceptance/contract.test.ts` | named |
| AC-C-01 | 2; shared; `shared/test/api-registry.test.ts` | named |
| AC-C-02 | 5; shared; `shared/test/client-platform-neutral.test.ts` | named |
| AC-C-03 | 1; shared; `shared/test/client-core.test.ts` | named |
| AC-C-04 | 2; shared; `shared/test/client-core.test.ts` | named |
| AC-C-05 | — | outside: device check (W12) |
| AC-C-06 | 3; shared; `shared/test/live-light-core-actions.test.ts` | named |
| AC-C-07 | 1; shared; `shared/test/live-source-replica.test.ts` | named |
| AC-C-08 | 1; shared; `shared/test/live-source-replica.test.ts` | named |
| AC-C-09 | 1; shared; `shared/test/live-light-settle.test.ts` | named |
| AC-C-10 | 1; shared; `shared/test/live-source-atomicity.test.ts` | named |
| AC-C-11 | 1; shared; `shared/test/live-source-bindings.test.ts` | named |
| AC-C-12 | 1; shared; `shared/test/live-source-atomicity.test.ts` | named |
| AC-C-13 | 1; shared; `shared/test/live-source-session.test.ts` | named |
| AC-C-14 | 1; shared; `shared/test/live-source-atomicity.test.ts` | named |
| AC-C-15 | 2; shared; `shared/test/live-source-atomicity.test.ts` | named |
| AC-C-16 | 1; shared; `shared/test/realtime-live-socket.test.ts` | named |
| AC-C-17 | 1; shared; `shared/test/live-testing-fetch.test.ts` | named |
| AC-C-18 | 2; web; `web/test/live-api-reference-page.test.tsx` | named |
| AC-C-19 | 1; web; `web/test/live-runtime-mode.test.tsx` | named |
| AC-C-20 | 1; web; `web/test/live-runtime-mode.test.tsx` | named |
| AC-C-21 | 2; web; `web/test/live-runtime-mode.test.tsx` | named |
| AC-C-22 | 1; web; `web/test/live-runtime-mode.test.tsx` | named |
| AC-C-23 | 2; web; `web/test/live-login-page.test.tsx` | named |
| AC-C-24 | 2; web; `web/test/live-gap-indicator-connecting.test.tsx` | named |
| AC-C-25 | 2; web; `web/test/live-login-page.test.tsx` | named |
| AC-C-26 | 1; web; `web/test/live-shell-notices.test.tsx` | named |
| AC-C-27 | — | outside: server log and spies (W97) |
| AC-C-28 | 2; mobile; `mob/runtime/live-core-link.test.tsx` | named |
| AC-C-29 | 1; mobile; `mob/runtime/live-runtime.test.tsx` | named |
| AC-C-30 | 3; mobile; `mob/features/dashboard/home-live.test.tsx` | named |
| AC-C-31 | 3; mobile; `mob/features/settings/live-settings-boundary.test.tsx` | named |
| AC-C-32 | 1; mobile; `mob/runtime/live-core-link.test.tsx` | named |
| AC-C-33 | — | outside: the row's live check command (W05, W50, W54) |
| AC-C-34 | — | outside: observable on the lane (W05, W50, W54) |
| AC-C-35 | — | outside: the command and the test run (W05, W50, W54) |
| AC-C-36 | 1; web; `web/lib/live-core-endpoint.test.tsx` | named |
| AC-C-37 | 2; web; `web/test/live-login-page.test.tsx` | named |
| AC-C-38 | 1; web; `web/test/live-login-signin.test.tsx` | named |
| AC-C-39 | 2; shared, web; `web/test/live-login-signin.test.tsx` | named |
| AC-C-40 | 1; web; `web/test/live-runtime-startup.test.tsx` | named |
| AC-C-41 | 1; web; `web/test/live-runtime-startup.test.tsx` | named |
| AC-C-42 | 2; web; `web/test/live-login-model.test.tsx` | named |
| AC-C-43 | 1; web; `web/test/live-login-page.test.tsx` | named |
| AC-C-44 | 1; web; `web/test/live-login-signin.test.tsx` | named |
| AC-C-45 | 2; web; `web/test/live-login-page.test.tsx` | named |
| AC-C-46 | 1; web; `web/test/live-runtime-startup.test.tsx` | named |
| AC-C-47 | 2; web; `web/test/live-login-page.test.tsx` | named |
| AC-C-48 | 31; mobile, web; `web/test/live-dashboard-devices.test.tsx` | named |
| AC-C-49 | 2; mobile, web; `web/test/live-shell-notices.test.tsx` | named |
| AC-C-50 | 3; mobile, web; `web/test/live-shell-admin.test.tsx` | named |
| AC-C-51 | 1; web; `web/test/live-shell-admin.test.tsx` | named |
| AC-C-52 | 3; mobile, web; `web/test/live-system-demo.test.tsx` | named |
| AC-C-53 | 25; mobile, shared, web (including the two W87 static tests) | named |
| AC-C-54 | 1; shared; `shared/test/live-source-session.test.ts` | named |
| AC-C-55 | — | outside: W96 |
| AC-C-56 | 3; mobile; `mob/features/pairing/live-gap-sites.test.tsx` (and Table 2 of this report) | named |
| AC-C-57 | 11; mobile, shared, web; `web/test/live-evidence-archive.test.tsx` | named |
| AC-C-58 | 10; mobile, web; `web/test/live-evidence-archive.test.tsx` | named |
| AC-C-59 | 4; mobile, web; `web/lib/live-core-errors.test.tsx` | named |
| AC-C-60 | 2; web; `web/test/live-security-audit-export.test.tsx` | named |
| AC-C-61 | 2; mobile, web; `web/test/live-evidence-verify.test.tsx` | named |
| AC-C-62 | 1; mobile; `mob/features/session-new/live-session-new-handoff.test.tsx` | named |
| AC-C-63 | 3; mobile; `mob/features/devices/devices-live-static.test.ts` | named |
| AC-C-64 | — | outside: W95 |
| AC-C-65 | 2; mobile; `mob/auth/live-auth.test.tsx` | named |
| AC-C-66 | 1; mobile; `mob/runtime/secure-store-import.test.ts` | named |
| AC-C-67 | 1; mobile; `mob/auth/live-auth.test.tsx` | named |
| AC-C-68 | 3; mobile; `mob/auth/live-auth.test.tsx` | named |
| AC-C-69 | 1; mobile; `mob/auth/live-auth.test.tsx` | named |
| AC-C-70 | 1; mobile; `mob/auth/live-auth.test.tsx` | named |
| AC-C-71 | — | outside: the row log (W15, W56) |
| AC-C-72 | 2; mobile; `mob/features/login/live-login.test.tsx` | named |
| AC-C-73 | 1; mobile; `mob/navigation/pairing-gate.test.tsx` | named |
| AC-C-74 | 1; mobile; `mob/navigation/pairing-gate.test.tsx` | named |
| AC-C-75 | 2; mobile; `mob/features/pairing/live-gap-sites.test.tsx`, `pairing-live.test.tsx` | named |
| AC-C-76 | 2; mobile; same two files | named |
| AC-C-77 | 1; mobile; `mob/features/pairing/pairing-live.test.tsx` | named |
| AC-C-78 | 3; mobile; `mob/navigation/pairing-gate-live.test.tsx` | named |
| AC-C-79 | 3; mobile; `mob/navigation/pairing-gate-live.test.tsx` | named |
| AC-C-80 | 2; mobile; `mob/features/pairing/live-gap-sites.test.tsx`, `pairing-live.test.tsx` | named |
| AC-C-81 | 1; mobile; `mob/features/pairing/pairing-live.test.tsx` | named |
| AC-C-82 | — | outside: W94 |
| AC-C-83 | 1; mobile; `mob/features/settings/live-settings-boundary.test.tsx` | named |
| AC-C-84 | — | outside: `adb reverse --list` (W13) |
| AC-C-85 | — | outside: grep and the plugin-count test (W13) |
| AC-C-86 | 1; web; `web/test/live-users-roles-page.test.tsx` | named |
| AC-C-87 | 1; web; `web/test/live-users-roles-commands.test.tsx` | named |
| AC-C-88 | 1; web; `web/test/live-users-roles-commands.test.tsx` | named |
| AC-C-89 | 1; web; `web/test/live-users-roles-commands.test.tsx` | named |
| AC-C-90 | 2; web; `web/test/live-runtime-bridge.test.tsx` | named |
| AC-C-91 | 1; web; `web/test/live-users-roles-page.test.tsx` | named |
| AC-C-92 | 1; web; `web/test/live-paired-devices-issue.test.tsx` | named |
| AC-C-93 | 1; web; `web/test/live-paired-devices-issue.test.tsx` | named |
| AC-C-94 | 1; web; `web/test/live-paired-devices-issue.test.tsx` | named |
| AC-C-95 | 1; web; `web/test/live-paired-devices-issue.test.tsx` | named |
| AC-C-96 | 1; web; `web/test/live-paired-devices-memory.test.tsx` | named |
| AC-C-97 | 1; web; `web/test/live-paired-devices-issue.test.tsx` | named |
| AC-C-98 | 1; web; `web/test/live-paired-devices-list.test.tsx` | named |
| AC-C-99 | 2; web; `web/test/live-paired-devices-issue.test.tsx` | named |
| AC-C-100 | 2; web; `web/test/live-api-reference-document.test.tsx` | named |
| AC-C-101 | — | outside: per-workspace runs (W89); met at this run (§10.2) |
| AC-C-102 | 1; web; `web/test/live-runtime-static.test.tsx` | named |
| AC-C-103 | 2; web; `web/test/live-api-reference-document.test.tsx` | named |
| AC-C-104 | 4; mobile, web; `web/test/live-login-model.test.tsx` | named |
| AC-C-105 | 4; mobile; `mob/auth/live-auth-static.test.ts` | named |
| AC-C-106 | 4; web; `web/features/paired-devices/code-memory.test.ts` | named |
| AC-C-107 | 4; web; `web/test/live-api-reference-document.test.tsx` | named |
| AC-C-108 | 1; mobile; `mob/auth/live-auth.test.tsx` | named |
| AC-C-109 | 1; web; `web/test/live-security-audit-chain.test.tsx` | named |
| AC-C-110 | 4; mobile, web; `web/test/live-login-signin.test.tsx` | named |

## 7. Table 4 — backend line coverage

```sh
DEMS_TEST_STEP=109 npm run coverage -w @dems/core-server -- --maxWorkers=2 --coverage.reportsDirectory=/Users/gsp-budi/Documents/DEMS/.cache/w87/coverage
```
```
 Test Files  276 passed (276)
      Tests  5656 passed (5656)
   Duration  162.64s
File               | % Stmts | % Branch | % Funcs | % Lines
All files          |   95.78 |    90.12 |   97.81 |   96.93
[test:db] teardown: dropped 8 database(s) in 361 ms; 0 remain with the run prefix dems_test_step_109_tmgj1ds6_
```

**Lines 7,958 / 8,210 (96.93 %); statements 9,131 / 9,533 (95.78 %); branches 4,720 / 5,237 (90.12 %); functions 2,060 / 2,106 (97.81 %).** 207 files measured. Run 06:10:25 to 06:13:08; the server tree has not changed since.

| Area | Lines | Statements | Branches | Functions |
|---|--:|--:|--:|--:|
| `core` | 789/814 (96.93 %) | 882/929 (94.94 %) | 478/518 (92.28 %) | 172/174 (98.85 %) |
| `db` | 2986/3091 (96.60 %) | 3400/3552 (95.72 %) | 1840/2113 (87.08 %) | 662/676 (97.93 %) |
| `engine` | 607/647 (93.82 %) | 700/758 (92.35 %) | 324/377 (85.94 %) | 168/178 (94.38 %) |
| `modules/admin` | 125/126 (99.21 %) | 152/159 (95.60 %) | 49/60 (81.67 %) | 50/51 (98.04 %) |
| `modules/alerts` | 25/25 (100 %) | 29/31 (93.55 %) | 10/12 (83.33 %) | 11/11 (100 %) |
| `modules/demo` | 193/193 (100 %) | 213/215 (99.07 %) | 75/78 (96.15 %) | 58/58 (100 %) |
| `modules/devices` | 51/51 (100 %) | 55/57 (96.49 %) | 11/13 (84.62 %) | 25/25 (100 %) |
| `modules/evidence` | 117/117 (100 %) | 142/144 (98.61 %) | 75/82 (91.46 %) | 36/36 (100 %) |
| `modules/health` | 11/11 (100 %) | 12/13 (92.31 %) | 9/11 (81.82 %) | 3/3 (100 %) |
| `modules/identity` | 558/564 (98.94 %) | 643/660 (97.42 %) | 300/323 (92.88 %) | 182/184 (98.91 %) |
| `modules/network-time` | 11/11 (100 %) | 11/12 (91.67 %) | 1/2 (50 %) | 4/4 (100 %) |
| `modules/pairing` | 386/393 (98.22 %) | 456/474 (96.20 %) | 192/210 (91.43 %) | 147/149 (98.66 %) |
| `modules/rbac` | 12/12 (100 %) | 14/15 (93.33 %) | 1/2 (50 %) | 5/5 (100 %) |
| `modules/security-audit` | 238/240 (99.17 %) | 278/283 (98.23 %) | 176/183 (96.17 %) | 47/47 (100 %) |
| `modules/sessions` | 169/169 (100 %) | 198/199 (99.50 %) | 97/99 (97.98 %) | 57/57 (100 %) |
| `modules/storage` | 24/24 (100 %) | 27/28 (96.43 %) | 7/8 (87.50 %) | 8/8 (100 %) |
| `modules/system` | 39/39 (100 %) | 46/47 (97.87 %) | 13/14 (92.86 %) | 14/14 (100 %) |
| `plugins` | 940/951 (98.84 %) | 1088/1105 (98.46 %) | 713/754 (94.56 %) | 231/236 (97.88 %) |
| `realtime` | 554/561 (98.75 %) | 640/653 (98.01 %) | 290/305 (95.08 %) | 136/138 (98.55 %) |
| `src/app.ts` | 65/65 (100 %) | 83/83 | 21/22 | 27/27 |
| `src/config.ts` | 53/53 (100 %) | 57/57 | 38/38 | 15/15 |
| `src/index.ts` | 0/48 (0 %) | 0/54 | 0/13 | 0/8 |
| `src/test-configuration.ts`, `src/version.ts` | 5/5 (100 %) | — | — | — |

**Files with the most uncovered lines:**

| File | Lines covered | Uncovered (as printed) | Reason |
|---|---|---|---|
| `src/index.ts` | 0 / 48 | 25-110 | By design: the process entry point, the only file that opens the port, frozen after W08. Tests never bind 4420 (GR-1); the smoke runs of W58 and W89 exercise it |
| `src/engine/host.ts` | 329 / 364 | …832-833, 845-846 | Not analysed line by line |
| `src/db/fixtures/load.ts` | 80 / 103 (branches 45.28 %) | …209, 217, 239 | Not analysed |
| `src/db/reset/routine.ts` | 338 / 353 | …1041, 1064-1065 | Not analysed |
| `src/core/pipeline.ts` | 162 / 175 | …327-334, 384 | Not analysed |
| `src/db/commands/owner-connection.ts` | 71 / 83 | — | Modified in the working tree after `057fc17` |

## 8. The new tests

| File | Tests | What it proves |
|---|--:|---|
| `apps/core-web/src/test/live-static-ac-c-53.test.ts` | 6 | AC-C-53 over all 15 feature folders (member read, optional chaining, destructuring, hook imports). Every folder with a settle site uses `useCoreActions`. TS-15: no page imports the fake transport; the only non-test importer sits under `runtime/testing/` (D121 ruling 4) |
| `apps/mobile/src/lib/live-static-ac-c-53.test.ts` | 6 | The same over 17 feature folders plus `src/auth`. The receivers left out (style sheets, motion timing tables) are proven to be what the code makes them. TS-15 over all of `src` |
| `apps/core-web/src/test/live-gap-indicator-connecting.test.tsx` | 2 | D147 DN-2: the CONNECTING instant after a link loss reads `LIVE · RECONNECTING` in the outage colour at three attempts, with the link notice up. RESYNCING reads the warning colour. The link back reads `LIVE` in the success colour |
| `apps/mobile/src/features/session-live/live-gap-read-only-dialog.test.tsx` | 1 | D180 DN-5 (S2-1): the stop dialog is open when the link drops. Confirm sends no stop; exactly one `toast.show` call and one `info` log record (DC-6); the dialog keeps the reason; with the link back the same confirm stops the recording |
| `apps/mobile/src/features/session-live/live-gap-s4-7-tablet-link.test.tsx` | 1 | S4-7: in Live mode a lost heartbeat writes no tablet link (no POST, no call of `setTabletLink`, no runtime log line); only a delta from the Core moves it |
| `apps/mobile/src/features/settings/live-gap-s1-2-biometric.test.tsx` | 8 | S1-2: success, 401, 423, outage. S1-3: failed check reported, a locking report, 429, outage |
| `apps/mobile/src/features/pairing/live-gap-sites.test.tsx` | 6 | S1-8: success, 401 `INVALID_CODE`, lost answer. S2-5: 204, 403 `DEVICE_REVOKED`, link down |

### 8.2 Deliberate breaks, applied in memory only

The harness lives under `.cache/w87/mut/` (copies in `assets/01_mut_*`). For the web it adds a Vite transform plugin or an fs-read patch to the app's own config; for mobile it wraps babel-jest or patches fs reads. Each break's target text must occur exactly once, and a marker file proves the break ran. Before the breaks, the new web tests passed 8 / 8 and the new mobile tests 22 / 22.

| ID | Break | Result |
|---|---|---|
| W-S1 | A page reads `sim.actions.*` | caught (1 of 6 red) |
| W-S2 | A page calls `useSimActions` | caught (2 of 6) |
| W-S3 | A page imports the fake transport | caught (2 of 6) |
| W-T1 | CP-W1 mutant T1: every RECONNECTING reads the warning colour | caught (2 of 2) |
| W-T2 | A CONNECTING link reads as OFFLINE | caught (2 of 2) |
| M-S1 | A screen reads `sim.actions.signIn` | caught (2 of 6) |
| M-S2 | The auth layer calls `useSimActions` | caught (1 of 6) |
| M-S3 | A production file imports the fake transport | caught (1 of 6) |
| M-C1 | M2 mutant C1: the monitor never refuses at the action | caught |
| M-C2 | Two `toast.show` calls behind one toast on screen (DC-6) | caught |
| M-L1 | The heartbeat effect switched on in Live mode | **passed the first version of the test**, because the Live binding `setTabletLink` is a no-op (`packages/shared/src/live/source/bindings.ts:525-530`). The test was strengthened and now catches it ("Expected number of calls: 0, Received: 5") |
| M-B1 | The biometric token is always kept | caught (2 of 8) |
| M-B2 | A 200 is not mapped to signed-in | caught (1 of 8) |
| M-B3 | The failure report names no operator | caught (1 of 8) |
| M-B4 | The failure union is mapped the wrong way round | caught (3 of 8) |
| M-P1 | The code sent is not the code typed | caught (1 of 6) |
| M-P2 | No unpair request is sent | caught (3 of 6) |

**17 of 17 caught.**

## 9. Items routed to this row

| Decision | Item | Outcome |
|---|---|---|
| D121 ruling 4 | Treat `runtime/testing/**` as a test harness | Applied in the web static test |
| D127 ruling 3 | Stale comments in `shared-state.test.ts` | Not edited (existing test). Finding W87-F2 |
| D147 DN-2 | Test the CONNECTING instant of the web indicator | Added; mutant T1 now caught |
| D171 F-8 | Jest worker-exit warning | Cause found in memory. Finding W87-F1 |
| D179 DC-6 | Tests claiming "one notice" must count toast calls | Applied (M-C2 proves it). Older claims listed in W87-F3 |
| D180 DN-5 | The open-dialog case behind mutant C1 | Added; C1 now caught |

## 10. Ledger and runs

| Workspace | Ledger | Added by W87 | Final run (08:25 to 08:32) | Exit |
|---|--:|--:|---|:-:|
| shared | 69 / 1,840 | — | 69 / 1,840 | 0 |
| core-web | 101 / 1,384 | +2 / +8 | **103 / 1,392** | 0 |
| mobile | 140 / 1,721 | +5 / +22 | **145 / 1,743** | 0 |
| core-server `unit` | 154 / 3,916 | — | 154 / 3,916 | 0 |
| core-server `db` | 122 / 1,740 | — | 122 / 1,740; "0 remain with the run prefix dems_test_step_109_tmgphvey_" | 0 |
| mock-core | 4 / 19 | — | 4 / 19 | 0 |
| core-web and mobile typecheck and lint | — | — | all four commands | 0 |

Mobile prints jest's "A worker process has failed to exit gracefully" once (exit 0). It has been there since the baseline (N-4); the cause is W87-F1.

### 10.2 AC-B-59 and AC-C-101: the baseline and protected test files

- **72 mobile baseline test files:** `git diff --stat acaff20` prints nothing.
- **39 web baseline test files:** four differ from `acaff20`, each a recorded change — `sim-fetch.test.ts` and `storage-page.test.tsx` (D10), `dashboard.test.tsx` (D31), `security-audit.test.tsx` (D42).
- **The 6 protected web files plus the 72 mobile baseline files:** SHA-256 equal at 06:07 and 08:32 (`assets/01_protected_tests_sha256.txt`); `git status` over all 78 is clean.

## 11. Gaps that remain

| Gap | Reason | Owner |
|---|---|---|
| 26 criteria not named by any test file | Proven by commands, captures and verification rows, as the specifications intend | W58/W89, W90, W94 to W96, W97, client rows |
| `src/index.ts` at 0 % coverage | By design (GR-1) | Smoke runs of W58/W89 |
| Other uncovered lines in §7 | Not analysed; no coverage threshold applies | W92 / W100 if wanted |
| Table 1 proves a test received each answer, not that it asserted on it (A-1) | Measured by probe | Denials are asserted per cell by W47; module gates judged the rest |
| W87-F1, F2, F3 | Each needs a change to a file this row may not write | §12 |

## 12. Findings

| ID | Severity | Finding | Proposed change and owner |
|---|---|---|---|
| W87-F1 | Low | **Cause of the jest worker-exit warning (D171 F-8).** The mobile runtime log flushes on a plain 2,000 ms `setTimeout` (`apps/mobile/src/runtime/log.ts:27`, created at `:171`) that is never unref'd, so it keeps the test process alive. `--detectOpenHandles` reports nothing. With the timer unref'd in memory only, the two affected baseline suites run without the warning (17 / 17 passed both ways; `assets/01_f8_worker_exit.log`) | At `log.ts:171`, call `timer.unref?.()` after creating it. Owner: mobile runtime (W100 hygiene) |
| W87-F2 | Info | **D127 ruling 3 still open.** `apps/core-server/test/acceptance/shared-state.test.ts:706-707` (comment) and `:711` (printed sentence) still say the link is recomputed "at the channel's pace step". Since D127 the first snapshot of the new epoch already says OFFLINE | Reword to "OFFLINE from the first snapshot of the new epoch (the engine starts it with the link of the open sockets, D127)". Owner: W49's file holder, or W92 |
| W87-F3 | Info | **Older "one toast" claims (D179 DC-6).** Found by text search, not checked one by one: titles that claim one toast or notice in files with no toast spy — `apps/core-web/src/test/live-evidence-export.test.tsx:176`, `apps/core-web/src/test/live-paired-devices-issue.test.tsx:350`, `apps/mobile/src/features/network-time/live-network-time.test.tsx:117`, `apps/mobile/src/runtime/live-core-errors.test.tsx:256`, `apps/mobile/src/runtime/live-device.test.tsx:835, :878`. Two more are baseline files that must not change: `storage-screen.test.tsx:156`, `network-time-screen.test.tsx:125` | Review in W92 / W93 |
| W87-F4 | Info | S4-7 is protected twice (the runtime doesn't mount the effect in Live mode, and the Live binding is a no-op), so a test that only checks the replica cannot catch a runtime regression. The S4-7 test now also checks the call and the log line | — |
| W87-F5 | Info | S2-5: a 403 `DEVICE_REVOKED` to operation 22 goes down the §6.6 revocation path (notice `revoked`), not a generic "could not unpair". MP-7 names only the 204 and link-down cases; the test asserts what was observed | Optional sentence for W88 |
| W87-F6 | Info | Read literally, AC-C-56 was not met before this row: S1-3 appeared only in a file header, and S1-2, S1-8, S2-5 and S4-7 were tested by behaviour but named by no test | Closed by the new files |

No product defect was found.

## 13. Deviations

- **05:33:** one read-only command started with `cd` to the repository root (no write). Not repeated.
- **05:40:** one command copied my own scratch script to `packages/shared/.w87-tmp-never.ts` and removed it in the same line. The file did not exist before and does not exist now. Recorded because the brief says "never delete a file"; the only file removed was my own, seconds old.
- **06:13 to 08:14:** the agent stream was interrupted. Nothing changed in the tree in that time, and everything was re-verified after the restart.
- **Client mutations:** ran through `npx vitest --config` and `npm exec -w @dems/mobile -- jest --config` with scratch configs outside the tree.
- **Server probe:** ran through `npm run test` and `npm run test:db` with `--config`.
- **Coverage:** used `npm run coverage` (both projects, through the same global setup and clone helper as `test:db`).
- **Test placement:** the S1-2/S1-3 tests sit in `features/settings/` and the S4-7 test in `features/session-live/`, beside the test beds they use, because `auth/` and `runtime/` are outside this row's write paths.
- **The report file:** the tool refused to let this agent write `test/01_test_report.md`; the text is handed to the controller instead.

## 14. Recommendations

1. Apply W87-F1 before W89 if the gate should print no warning.
2. W89 should expect web 103 / 1,392 and mobile 145 / 1,743, and compare the 78 protected files against `assets/01_protected_tests_sha256.txt`.
3. Re-run the probe (`assets/01_opmap_*`) after any server change to refresh Table 1.

*Generated: 2026-10-06 08:40*