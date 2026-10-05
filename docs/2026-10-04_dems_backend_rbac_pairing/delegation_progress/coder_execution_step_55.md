---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: coder-execution (tier R)
blueprint_row: 55 (plan W33, user and role administration)
date: 2026-10-04
status: complete
evidence_tier: 3
---

# coder-execution progress: step 55 (W33, user and role administration)

Status: **complete** (15:27). Every check of the row is met at the final runs: the row's own
tests exit 0 (3 `unit` files with 86 tests, 6 `db` files with 60 tests), the whole `unit`
project (102 files, 2,659 tests) and the whole `db` project (75 files, 1,081 tests) exit 0,
typecheck and lint exit 0 with no warning, 92 of 92 planted defects are detected, no database
with this row's prefix remains, and `.locks/postgres.pid` is 19121 as before.

Full record: `implementation/33_user_role_admin.md`. All times WIB. No credential, token, hash
or password is in this file.

## What exists now

- Operations 11 to 14 of the registry in `apps/core-server/src/modules/admin/` (`index.ts`,
  `changes.ts`, `rule.ts`, `statements.ts`); the scaffold's stub is replaced, `adminModule` keeps
  its name. Routes are built from the registry entries; who may call is stage 6 alone.
- `listUsers`: one read on the pool. `assignUserRole`, `disableUser`, `enableUser`: one unit of
  the pipeline each (lock, rule, compare-and-set, audit row), the publications after the commit,
  then `app.engine.mirrorOperators()`, then the answer with the two headers of API-7.
- The last-administrator rule: every operator row locked in key order (`FOR UPDATE`, database
  contract AT-C5), the change applied to the locked rows in memory, the enabled holders of
  `USER_ADMIN` counted from the stored matrix, 409 `LAST_ADMIN` and a rollback when none is left.
- A disable ends the operator's sessions through `app.sessionRegistry.endForOperator` and revokes
  its live biometric tokens in the same unit.
- A self-change is allowed unless it is the last administrator. No password operation exists.

## Milestones

| Time | Milestone |
|---|---|
| 14:13 to 14:24 | Read the standing rules M1 to M13, the specification, the database contract, the four implementation documents, the contract; pre-image of the stub saved |
| 14:26 | Production code written; typecheck and lint of the workspace exit 0 |
| 14:32 | 3 `unit` test files green (85 tests then) |
| 14:34 to 14:48 | The `db` test files written and green one by one: users, status, last-admin, sequence, bulk, failures (58 tests then) |
| 14:35, 14:44, 14:47 | Controller notes D84 (gap IDs carry the row), D85 (three guard-row test files red by design, not to be touched), D87 (rule M14, the foundation round): followed; a type error and a lint warning of this row's test files, seen by other rows, fixed at 14:37 |
| 14:52 | Mutation run started (92 planted defects, through a scratch configuration: no repository file is changed) |
| 15:03 to 15:10 | Test files only: the unit's opening as one line of a timeline (so that a statement the core adds does not change these tests, D87); a test for two enables of one operator; wider time limits after one test ran past 5 s under load at 15:07:38; a time bound for the gate helper |
| 15:13 | Controller note D88 (rule M15): already met, the mutation run changes no file of the tree |
| 15:14 | Mutation run ended: 92 of 92 detected; five re-run against the final test files at 15:14:30: 5 of 5 |
| 15:15 to 15:19 | First final pass: typecheck 0, lint 0, row tests green; whole `unit` and whole `db` with ONE red test each, both in files the guard row's owner was editing in those minutes (15:15 to 15:17) |
| 15:20 | The two files alone: green (29 of 29, 28 of 28) |
| 15:20 to 15:24 | Second pass: whole `unit` exit 0 (102 files, 2,659 tests), whole `db` exit 0 (75 files, 1,081 tests), typecheck 0, lint 0 |
| 15:24 | End state read: 0 databases of this row; PostgreSQL untouched |

## Verification (runner output quoted in `33_user_role_admin.md`, section 12)

| Check of the row | Result |
|---|---|
| MODG (rule M11) | Route list equals registry operations 11 to 14 (both printed); every documented status of every operation tested and validated against the contract; one allowed and one refused call per operation; typecheck and lint exit 0; 92 of 92 mutations detected |
| The same session gets 403 before and 2xx after a role change, no new sign-in | Yes, both ways, for a web session and a device session of the same operator; nothing is called on the guard |
| A disabled user's next request answers 401, the next sign-in the generic 401, `USER_DISABLED` is written | Yes; the sessions end in the same unit (`sessionsEnded: 2`), the live biometric tokens are revoked, `session.ended` is published after the commit. An enable: a real sign-in answers 200 again |
| Demoting or disabling the last enabled SUPERVISOR answers 409 `LAST_ADMIN` and changes nothing | Yes: rows, sessions, tokens, trail, events, engine revision as before; nothing published |
| Two concurrent demotions of the two remaining holders give one 200 and one 409 | Yes: 77 concurrent rounds in four arrangements (free-running, both queued behind the guard, a second writer with and without the chain lock, two instances on one database); two successes: 0 |
| `DEMS_TEST_STEP=55` for `test:db` | Every `db` command; run prefixes `dems_test_step_55_…` |
| Whole `unit` and `db` at the end | Exit 0 and exit 0 at 15:20:45 and 15:21:24. Ledger: `unit` +3 files / +86 tests, `db` +6 files / +60 tests of this row (controller baseline 77 / 1,992 and 48 / 740) |
| Typecheck, lint | Exit 0, exit 0 without a warning (15:24:06, 15:24:19) |
| No database of this row's prefix remains; `.locks/postgres.pid` 19121 | 0 databases at 15:24:28; pid 19121, started 07:14:26 |

Other rows' reds seen in this row's whole-project runs (P11), none in this row's folder: 14:58
`src/modules/storage/__tests__/` (2 tests); 15:16 `plugins/permission-guard/__tests__/guard.test.ts`
(1 test) and `modules/rbac/__tests__/matrix.db.test.ts` (1 test), the guard row's edit in flight,
green from 15:20. Decision D85 (the three stand-in files): green at this row's final runs, no
condition open.

## Findings, deviations, decisions (details in sections 16 to 18 of the document)

- **F-1** a request past stage 6 runs although its operator was disabled or demoted meanwhile
  (rule M3 forbids a second check; the last-administrator rule still holds in that window:
  tested). For the security review W45.
- **F-2** the bulk fixture writes `ROLE_CHANGED`, `USER_DISABLED`, `USER_ENABLED` rows with other
  detail keys (`operatorId`, `fromRole`, `toRole`) than spec §13.1.
- **F-3** the client specification §10.2 expects `admin.changed USERS` after "a sign-in
  elsewhere"; the identity module publishes none (D78 DN-16): `lastSignInAt` and `activeSessions`
  of the page are as of its last fetch.
- **F-4** the wait columns of `pg_stat_activity` are hidden from `dems_owner` for the server's
  backends; a test that waits for "a backend waits for a lock" uses `pg_locks` (extends F63).
- **F-5** the disable revokes biometric tokens with a statement of this module (AT-C5); W41 may
  take it over. **F-7** the mirror after an enable or a disable never finds a difference.
- **F-9** load: one test of this row ran past the default 5 s once (15:07:38, load average 12 to
  16); the six `db` files of the row now state their own limits.
- Deviations: the audit type is `ROLE_CHANGED` (as the specification names it); `admin.changed`
  also after a disable; `enableUser` locks its one row; the mutation check ran through a scratch
  configuration.
- Decisions DN-1 to DN-12: a self-change is allowed unless last administrator; a mirror that
  fails after the commit does not fail the request; a malformed operator ID is 422, an unknown one
  404; a credential-shaped reason is 422; severities and messages of the three rows; no row and no
  place in the denial budget for 404 and 409; the order of the publications; the headers are read
  after the mirror.
- **No contract, schema or simulator gap** (`CONTRACT-GAP-W33-n`, `SCHEMA-GAP-W33-n`,
  `SIM-GAP-W33-n`: none allocated).

## Files

Created or replaced, all under `apps/core-server/src/modules/admin/`: `index.ts` (replaced),
`changes.ts`, `rule.ts`, `statements.ts`, `__tests__/support.ts`, `__tests__/rule.test.ts`,
`__tests__/routes.test.ts`, `__tests__/static.test.ts`, `__tests__/users.db.test.ts`,
`__tests__/status.db.test.ts`, `__tests__/last-admin.db.test.ts`,
`__tests__/sequence.db.test.ts`, `__tests__/failures.db.test.ts`, `__tests__/bulk.db.test.ts`.

Documents: `implementation/33_user_role_admin.md`, this file, and
`implementation/assets/33_test_unit_verbose.txt`, `33_test_db_verbose.txt`, `33_mutations.json`,
`33_mutations.log`, `33_mutation_harness.run.py.txt`, `33_mutation_harness.vitest.config.mjs.txt`,
`33_final_runs.log`, `33_end_state.mts.txt`. Pre-image: `.cache/rollback/W33.admin-index.ts.pre`.

Not written (the controller's): `status_tasks.md`, `delegation_progress_report.md`,
`decisions/decisions.md`, `masterplan/02_plan.md`. No file of another row was edited.
