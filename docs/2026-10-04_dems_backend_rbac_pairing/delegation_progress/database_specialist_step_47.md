---
task_id: 2026-10-04_dems_backend_rbac_pairing
blueprint_row: 47
plan_row: W25
agent: database-specialist (tier R)
date: 2026-10-04
status: complete
follow_up: audit detail keys (decisions D91, D93); status complete, 2026-10-04 16:40
follow_up_2: severities, events, alerts (decision D103); status complete, 2026-10-04 17:40
artifact: implementation/25_db_bulk_fixture.md (the follow-ups are its sections 21 and 22)
---

# Step 47 (W25): the bulk fixture for volume tests

Times are WIB. No credential value appears in this file.

## Status

**complete** for everything the row owns: the full minimums of contract §11 (nothing reduced,
DF-1 not used). The whole-project `unit` and `db` commands exit 1 in files of rows running at the
same time (the engine host row's new boot step, the identity row's stage-4 plugin, the reset row);
every file of this row passes in each of those runs. Detail: `implementation/25_db_bulk_fixture.md`
section 8.4.

## Milestones

| Time | What |
|---|---|
| 10:51 to 10:52 | Inputs read. `db:status` of `dems_demo` refused inside the sandbox (`listen EPERM` on the `tsx` pipe), then run outside it: **before** state recorded at 10:52:03 (82 audit rows, 59 events, 301 rows) |
| 11:03 to 11:22 | The folder written: generator, name guard, minimums, the three parts (identity, recordings, operations), builder, constraint guard, loader, report, template hook. Workspace typecheck exit 0 |
| 11:26 | First pure build (no database): the constraint guard refuses one row rule (`biometric_tokens_times_check`); fixed. Second pure build: every minimum met, all 53 audit types, digest equal twice, 137 ms |
| 11:27 | `test:db` refused inside the sandbox (`POSTGRES_UNREACHABLE`), from then on outside it |
| 11:28:04 | **First run against the database: 19 of 19 tests pass**; the fixture loads with no constraint violation; `tpl_bulk` built in 1,531 ms; `verifyAuditChain` ok over 5,000 rows |
| 11:29 to 11:33 | Unit tests: generator, name guard (no connection), builder and mix, static guards. 4 files, 103 tests |
| 11:33:57 | Whole `unit` project: 51 files, 1,541 tests, 0 failed |
| 11:34:49 | Whole `db` project: 32 files, 470 tests; 2 files of other rows red (one is finding F-3) |
| 11:36 to 11:38 | Finding F-3 read in the server log. The hook now vacuums and analyzes the loaded tables; the test retries the drop of clones it loaded itself. A clone of `tpl_bulk` drops from 180 ms to 65 ms |
| 11:38:46 | A run that asks for no bulk clone builds two templates and prints no bulk line |
| 11:38:57 | Whole `db` project, second run: 3 files of other rows red (the new boot step), this row's file green |
| 11:40:21 | Catalog check: no database of this row, three roles, PID 19121. `db:status` of `dems_demo`: unchanged |
| 11:41:21 | Eight mutations of the sources: all caught |
| 11:41:45 | Typecheck exit 0, lint exit 0 |
| 11:44:02 | **Row command exit 0**: 1 file, 19 tests; every minimum of the 30 tables met |
| 11:44:19 | End state: 0 test databases of any run; PID 19121, started 07:14:26; `dems_demo` **after** state identical to 10:52:03 |

## Files created (all new; nothing else was edited)

`apps/core-server/src/db/fixtures/`: `index.ts`, `minimums.ts`, `rng.ts`, `target.ts`, `world.ts`,
`identity.ts`, `recordings.ts`, `operations.ts`, `rows.ts`, `build.ts`, `validate.ts`, `load.ts`,
`report.ts`; `__tests__/template-hook.bulk.ts`, `__tests__/support.ts`,
`__tests__/bulk-fixture.db.test.ts`, `__tests__/build.test.ts`, `__tests__/target.test.ts`,
`__tests__/rng.test.ts`, `__tests__/static.test.ts`.

Documents: `implementation/25_db_bulk_fixture.md`, this file.

Not edited, on purpose: every `package.json`, the schema, the migrations, the mapping, the seed,
the helper; `masterplan/02_plan.md`, `delegation_progress_report.md`, `status_tasks.md`,
`decisions/decisions.md` (shared files in a parallel run; the controller updates the tracking row).
Scratch files (three probes, a mutation script, run logs) are in the session scratchpad, outside
the repository.

## Verification (quoted in the artifact)

| Check | Result |
|---|---|
| `DEMS_TEST_STEP=47 npm run test:db -w @dems/core-server -- src/db/fixtures` | exit 0; 1 file, 19 tests (11:44:02) |
| The loader's printed counts against §11 | 30 of 30 minimums met; 15,101 rows inserted |
| `verifyAuditChain` over all audit rows of a bulk database | ok, 5,000 rows, from the genesis hash; B-8 `digests ok, lineage ok` |
| Catalog: constraints, triggers, indexes | 98 CHECK, 25 FK, 30 PK, none `NOT VALID`; no trigger disabled; 3 audit triggers `ENABLE ALWAYS` |
| Determinism (step 47; the digest is superseded, see the follow-up below) | Equal digests of all 30 tables for two loads; fixture digest `953c92ea4c9e1393...` in every run, equal to the pure builder's |
| Name guard for `dems_demo`, `dems_lane_1`, `postgres` | Refused with no connection (stand-in pool: no call; driver pool: 0 connections) |
| A clone read as `dems_app` | 30 tables readable; the contract's privilege matrix; 8 refusals `42501` |
| `tpl_bulk` build; one clone | 1.38 to 1.86 s quiet, 2.46 s under load; 65 to 106 ms |
| `db:status` of `dems_demo`, 10:52:03 and 11:44:20 | Identical: 30 counts, seed instant, audit head |
| `unit`, this row | 4 files, 103 tests, 0 failed; whole project 51 files, 1,541 tests (all green at 11:33:57) |
| Typecheck, lint | exit 0, exit 0 |
| `pg_database`, roles, PID | No `dems_test_*` database; three roles; 19121 unchanged; no setting override |

## How long other runs can be delayed

While `tpl_bulk` is built the helper holds the clone lock for the whole build: about **1.4 s** on a
quiet host, **up to 2.5 s** measured with other rows testing, once per run that asks for a bulk
clone. A run that never asks never builds it. Each clone of `tpl_bulk` then holds the lock for 0.07
to 0.1 s (a seed clone: 0.05 s). The helper's lock timeout is 120 s.

## Test ledger (P24)

| Project | Before | After | This row |
|---|---|---|---|
| `db` | 31 files, 451 tests | 32 files, 470 tests | `bulk-fixture.db.test.ts` 19 |
| `unit` | 47 files, 1,438 tests | 51 files, 1,541 tests | `build.test.ts` 42, `target.test.ts` 41, `rng.test.ts` 10, `static.test.ts` 10 |

"Before" is the same whole run without this row's files (other rows add files meanwhile).

## Findings (detail: artifact section 13)

- F-1, F-2: load 1.25 to 1.44 s; four fifths of it is the 4,918 single-row audit INSERTs that AP-4 requires.
- F-3: the helper's forced drop of a file's database was refused once (`42501` "permission denied
  to terminate process", 11:35:59, on `isolation-b`'s database; its tests had passed). The same
  message is in the log from runs of other rows at 10:45:39 and 11:22:56. Hypothesis: an
  autovacuum worker connected at the instant of the drop.
- F-4: this row vacuums the loaded tables and retries the drop of clones it loaded; the retry was never needed.
- F-5: the server log cannot attribute a line to a database; the "no violation" statement is made on the windows of the fixture-only runs (0 lines).
- F-6: `--exclude` does not take files out of a project run; the ledger's "before" is by subtraction.
- F-7: one run of this row's database tests adds 10 expected refusals and the checkpoint lines of 8 drops to the server log.
- F-9: the hook file existed five minutes before its first database run; no file of any row asks for the bulk template yet.

## Deviations (detail: artifact section 12)

- DV-1: the generator is the shared `mulberry32` (BF-3) behind a wrapper in the folder (the delegation asked for an own generator in the folder).
- DV-2: `core_state` gets `epoch` 66, `last_reset_at` and `updated_at` (the lineage needs it).
- DV-3: `last_sign_in_at` of the three seeded operators is set.
- DV-4: active alerts are notices of kind `SYSTEM`; every fault alert is resolved (the seeded snapshot has no active fault).
- DV-5: in sequence order `at` descends once, after the reset marker (audit 83 to 84, events 60 to 61).
- DV-6: the hook also runs `VACUUM (ANALYZE)` on the 30 tables (34 to 44 ms).
- DV-7: the shared plan and status files were not written (P8).
- DV-8: two read-only commands began with `cd` into a subfolder (P10); no effect, the directory is reset after every call.

## Decisions for the controller (detail: artifact section 14)

- DN-1: accept DV-5; tell the audit and matrix rows to page and assert by `seq`, never by `at`.
- DN-2: accept DV-2 and DV-3; reword §11 for `core_state`.
- DN-3: accept DV-4.
- DN-4: the build time against the helper row's DN-4 (about 2 s): accept, or schedule a lock per template (helper) or a prepared audit INSERT (store).
- DN-5: route F-3 to the helper's owner (retry a refused forced drop).
- DN-6: a test on `tpl_bulk` runs its clock at `BULK_TEMPLATE_NOW` or later; fixture credentials cannot be presented.
- DN-7: record the generator wording (DV-1).

## Rollback (R-NEW; not executed)

`git clean -fd -- apps/core-server/src/db/fixtures`. Nothing else to undo: no database, no role, no setting.

## Not verified

An app built by the factory on a bulk clone (the engine host row is in flight); query plans on the
bulk data; the cause of F-3.

## Follow-up: audit detail keys (decisions D91, D93)

Asked by the controller after the gate of this row (PASS, D73): the fixture wrote audit rows whose
`details` had other keys than the real modules write, some of them keys the audit writer refuses
(finding F68). Detail: `implementation/25_db_bulk_fixture.md` section 21.

### Status

**complete.** Every audit row of the fixture now holds the keys its writer gives that type, a
test in the folder holds every row against that writer, and counts, minimums, the spread per
entity and the `at` ordering are unchanged. Whole `unit` and whole `db` are green.

### Milestones

| Time | What |
|---|---|
| 16:04 to 16:13 | Read: the writer's list (`core/audit-details.ts`), the builders of the identity, biometric, pairing and guard modules, the reset routine, the simulator's writes, the guard's rule book. No test of another row pins a detail key or a digest of the fixture |
| 16:14 to 16:18 | The details rewritten in `identity.ts`, `operations.ts`, `recordings.ts`; `BulkBase.certificateFingerprint` (read from `core_device`). Typecheck exit 0; the 103 existing unit tests pass unchanged |
| 16:19 to 16:23 | `__tests__/audit-reference.ts` (the simulator driven on four engines: 1,305 rows of 34 types, no error; the module builders) and `__tests__/audit-details.test.ts` (18 tests). All 53 types match their writer |
| 16:25 | The step 47 fixture rebuilt in the scratchpad (edits reversed in a copy): it gives the pinned digest and head, so it is the old fixture. Compared with the new one: 16 tables identical, 0 audit rows differ outside details and message, every `at` equal |
| 16:25:31 | Row command exit 0: 19 tests; the minimums table is the table of step 47, line for line |
| 16:26 | The old copy against the new comparisons (M15, nothing in the workspace changed): 101 rows the writer would refuse, 759 that differ from a module builder, 867 from the simulator. The new fixture: 0, 0, 0 |
| 16:27:04; 16:27:53 | Whole `unit`: 134 files, 3,503 tests. Whole `db`: 101 files, 1,488 tests. Both exit 0 |
| 16:32 | A comment and three value sets in the support file taken from the code that owns them; no behaviour changed |
| 16:33:41; 16:34:39 | Whole `unit` again: 134 files, 3,503 tests. Whole `db` again (verbose): 105 files, 1,513 tests. Both exit 0 |
| 16:38:36 | Row command exit 0: 19 tests; 0 databases remain |
| 16:39 | `pg_database`: no database of this row; PID 19121 unchanged. Unit of the folder: 5 files, 121 tests. Typecheck exit 0, lint exit 0 |

### Old to new

| Value | Step 47 | Now |
|---|---|---|
| Fixture digest | `953c92ea4c9e1393daa554fb8e1318d513b1e6e8d856d2d2d78d8d76c5ed8577` | `3d2e7fe247a44ec2a17242431c7fcff249df9207ce74c51b373d0475cc8dbcaa` |
| Audit head, sequence 5000 | `d2d9f9e596ed73d2c8d0cd2cf5c3fe79341cd9f3422161681d677f331e5633c1` | `46382e11b16010879f2e3769cc9ff5de722919318bc2cad941c71c82f55f1b0b` |
| Variant (a session in RECORDING): digest | `f9a359c720432a3a7e810b2ba9707db220f3549b73ecfa7705f79f718a545605` | `d3cda7f5dc17e3611b2b42ef125fa5017f7384051c5c1fe1c140944b6b9532f1` |
| Variant: audit head, sequence 5000 | `38ca943c22a430741b374402e4750898c8a2f7cb3146443504a5c29c3c750185` | `8e563f131571164a496cc6c9563104870baad5875b82643e7aebaf4d9f1593cd` |

No source file holds either value as text; they are pinned in the two documents only.

### What changed in the data

`details` of 1,635 audit rows of 30 types; the message of 87 audit rows; 3 event rows (the version
named by the first software update). 16 of the 18 tables the fixture fills are identical row for
row. No audit row differs in `seq`, `id`, `at`, type, category, severity, actor, session, evidence
or device; `at` descends once in sequence order, as before.

### Files

Edited in `apps/core-server/src/db/fixtures/`: `identity.ts`, `operations.ts`, `recordings.ts`,
`world.ts`, `load.ts`, `__tests__/support.ts`, `__tests__/static.test.ts`.
New: `__tests__/audit-details.test.ts`, `__tests__/audit-reference.ts`.
Documents: `implementation/25_db_bulk_fixture.md` (section 21 added, a pointer near the top, the
front matter), this file. Nothing else; no shared tracking file was written.

### Verification (quoted in the artifact, section 21.7)

| Check | Result |
|---|---|
| `DEMS_TEST_STEP=47b npm run test:db -w @dems/core-server -- src/db/fixtures` | exit 0; 1 file, 19 tests (16:38:36); minimums table unchanged by `diff` |
| `verifyAuditChain` over all stored audit rows | ok, 5,000 rows, head `46382e11b1601087...`; B-8 as `dems_app` ok |
| The new test, with its table | 18 tests; 53 types: 9 by the writer's list, 11 by a module builder, 33 by the simulator; 0 findings |
| Unit, this row | 5 files, 121 tests, 0 failed (16:39:06) |
| Whole `unit`, `--maxWorkers=2` | 134 files, 3,503 tests, 0 failed (16:27:04 and 16:33:41) |
| Whole `db`, `--maxWorkers=2` | 101 files, 1,488 tests (16:27:53); 105 files, 1,513 tests (16:34:39); 0 failed |
| Files of other rows on the bulk template | administration 2, evidence 14, sessions 13, pairing registry 6, security-audit 15: all passed |
| Typecheck, lint | exit 0, exit 0; 3 lint warnings in `src/realtime` (a row in flight), none here |
| `pg_database`, PID | no database named `dems_test_step_47...`; 19121, started 07:14:26 |

### Test ledger (P24)

| Project | Before the follow-up | After | This row |
|---|---|---|---|
| `unit` | 133 files, 3,485 tests | 134 files, 3,503 tests | 5 files, 121 tests; `audit-details.test.ts` 18 is new |
| `db` | 105 files, 1,513 tests | the same | `bulk-fixture.db.test.ts` 19 |

### Deviations (artifact section 21.8)

- DV-9: three event rows changed, so that the event beside an update's audit row names the same version.
- DV-10: the message of 87 audit rows changed (it quoted a value that changed; `PAIRING_LOCKED` had a text about another thing).
- DV-11: values were corrected where no writer gives the old value (four operations of the refusals, the expiry reasons, the precheck reason codes, the export row counts, the update versions).
- DV-12: `BulkBase.certificateFingerprint`; the loader reads `core_device` once more.
- DV-13: the test imports the modules' builders and the seed row's headless engine host, read-only.

### Findings (artifact section 21.8)

- F-10: the drift was 30 of 53 types and 1,635 rows; 101 rows of 7 types were refusable by the writer (the two reported items were part of it).
- F-11: the six token-reuse rows name no operator, so they say `knownOperator: false`; the module names the operator. Left as it is, because setting it changes rows per actor.
- F-12: severity differs from the modules' in 67 rows of 4 types; not held by the test.
- F-13: messages are the fixture's own wording.
- F-14: event `params` are held against nothing; by reading, at least eleven event types differ.
- F-15: the biometric module was in flight; its builders are the reference as they are now.
- F-16: the security-audit bulk test no longer needs its caution about the administration rows.
- F-17: the folder is untracked; the old state was rebuilt by reversing edits and proven by the pinned digest.
- F-18: the default reporter hides the output of a passing test; the table needs `--reporter=verbose`.

### Decisions for the controller (artifact section 21.8)

- DN-8: accept DV-9 to DV-13.
- DN-9: should the token-reuse rows name the operator (6 rows gain an actor)?
- DN-10: should severity, message and event params match the modules too? Severity is four words; event params would be a second follow-up with the same test extended.
- DN-11: tell W39 that its bulk test may assert the details of the administration rows.

## Follow-up 2: severities, events, alerts (decision D103)

Asked by the controller after the gate of the first follow-up (PASS, D103), when the last module
rows had landed: six items. Detail: `implementation/25_db_bulk_fixture.md` section 22. The digests
of the first follow-up above are superseded by the table below.

### Status

**complete.** All six items are done; counts, minimums, the spread per entity and the `at`
ordering are unchanged; whole `unit` and whole `db` are green, twice.

| Item | Result |
|---|---|
| 1. Token reuse (DN-9) | The six rows name the operator of the reused token; `knownOperator: true`. The biometric builders are unchanged since the first follow-up read them (15:57:47) |
| 2. Severity | The four types follow their builders (67 rows), and `UPDATE_COMPLETED` the simulator (2 rows). The test holds the severity and category of every audit row |
| 3. Events | 1,300 events of 18 types corrected. The test holds every event: type, category, severity, parameter keys; a module's event is compared whole with its builder's |
| 4. Alerts | 238 of 238 fault alerts have exactly one row and one event with their kind, target, instant, text and severity (0 of 238 before); an audit-tamper alert pairs with `AUDIT_CHAIN_DISCONTINUITY`. The alerts row's own bulk test prints 88 of 88 |
| 5. Messages | The builder's message where a builder exists: 11 audit types changed, 6 already had it; the three administration types keep the fixture's wording |
| 6. Known limit | Recorded in section 22.7, with two more |

### Milestones

| Time | What |
|---|---|
| 17:03 to 17:10 | Read: the landed biometric builders (unchanged), the event builders of identity, pairing, the guard and the reset routine, the alerts row's finding and its pairing rule. A copy of the folder taken to the scratchpad at 17:07 as the baseline |
| 17:09 | The simulator probed for its events, severities and alerts: 9 engine event types and 8 module event types differ, one more audit severity, 0 alerts paired |
| 17:11 to 17:13 | `identity.ts`, `operations.ts`, `recordings.ts`, `build.ts` changed. Typecheck clean in the folder (red in a file of another row at 17:11 and 17:13) |
| 17:13:51 | The structural round changed the import line of `load.ts`; that file was not edited here |
| 17:17 to 17:24 | `audit-reference.ts` and `audit-details.test.ts` extended (each compared byte for byte with the baseline copy before it was replaced): 35 tests |
| 17:22 | The baseline copy gives the digest of the first follow-up; compared with the new fixture: 16 tables identical, rows per type and category equal, every `seq`, `id` and `at` equal |
| 17:23 | The baseline copy against the extended comparisons (M15): 67 severities, 877 messages, 1,068 event findings, 0 of 238 alerts paired. The new fixture: 0 findings, 238 of 238 |
| 17:23:15 | Row command (verbose) exit 0: 19 tests; minimums table unchanged |
| 17:25:14; 17:26:10 | Whole `unit`: 140 files, 3,602 tests. Whole `db`: 108 files, 1,540 passed, 1 skipped (the demo row's own). Both exit 0 |
| 17:33:14; 17:33:55 | Whole `unit` again: 141 files, 3,604 tests. Whole `db` again: 108 files, 1,540 passed, 1 skipped. Both exit 0. Typecheck and lint exit 0, no warning |
| 17:35:44 | Row command exit 0: 19 tests; 0 databases remain |
| 17:36 | `pg_database`: no database of this row; PID 19121 unchanged |

### Old to new

| Value | After follow-up 1 | Now |
|---|---|---|
| Fixture digest | `3d2e7fe247a44ec2a17242431c7fcff249df9207ce74c51b373d0475cc8dbcaa` | `e58f1ae233811851df5aa84ebfb085703ce2b3d423d950a58a019bdfa97f0415` |
| Audit head, sequence 5000 | `46382e11b16010879f2e3769cc9ff5de722919318bc2cad941c71c82f55f1b0b` | `26e251887c667e1ee20b74960c0335afa49859128fd9d1ea096d47d42f0f77cf` |
| Variant (a session in RECORDING): digest | `d3cda7f5dc17e3611b2b42ef125fa5017f7384051c5c1fe1c140944b6b9532f1` | `623c6d0c952e26e98327ef3494728415797b8beae9de5ab0fec5793ab93e22a7` |
| Variant: audit head, sequence 5000 | `8e563f131571164a496cc6c9563104870baad5875b82643e7aebaf4d9f1593cd` | `ee4022f9c539052bf182ae1c2728d4bce1485af5b187b610f15d1fdab5dcfaaf` |

No source file holds either value as text.

### What changed in the data

1,134 audit rows of 14 types (severity of 69 rows; the actor and one detail of 6; the message of
1,098; the two rows of each of the 17 audit-tamper alerts changed places) and 1,300 events of 18
types. The other 16 tables are identical row for row, `alerts` included. Rows per type and per
category of both tables are equal; every `seq`, `id` and `at` is equal; rows with a session,
evidence or a device are equal; rows with an actor 3,270 to 3,276 (item 1); 12 actors.

### Files

Edited in `apps/core-server/src/db/fixtures/`: `identity.ts`, `operations.ts`, `recordings.ts`,
`build.ts`, `__tests__/audit-details.test.ts`, `__tests__/audit-reference.ts`. No file added.
Documents: `implementation/25_db_bulk_fixture.md` (section 22 added, the pointer near the top, the
front matter), this file. Not edited: `load.ts` (changed by the structural round), every shared
tracking file.

### Verification (quoted in the artifact, section 22.8)

| Check | Result |
|---|---|
| `DEMS_TEST_STEP=47c npm run test:db -w @dems/core-server -- src/db/fixtures` | exit 0; 1 file, 19 tests (17:35:44); minimums table unchanged by `diff` |
| `verifyAuditChain` over all stored audit rows | ok, 5,000 rows, head `26e251887c667e1e...` |
| The extended test, with its four tables | 35 tests; audit: 53 types; events: 44 types (10 by a module builder, 34 by the simulator); alerts: 12 kinds, 238 of 238 |
| Unit, this row | 5 files, 138 tests, 0 failed (17:29:42) |
| Whole `unit`, `--maxWorkers=2` | 140 files, 3,602 tests (17:25:14); 141 files, 3,604 tests (17:33:14); 0 failed |
| Whole `db`, `--maxWorkers=2` | 108 files, 1,540 passed, 1 skipped, 0 failed (17:26:10 and 17:33:55) |
| Files on the bulk template | fixture 19, administration 2, evidence 14, sessions 13, pairing registry 6, security-audit 15, alerts 20, restart acceptance 16: all passed |
| Typecheck, lint | exit 0, exit 0; no warning (17:33) |
| `pg_database`, PID | no database named `dems_test_step_47...`; 19121, started 07:14:26 |

### Test ledger (P24)

| Project | Before the follow-up | After | This row |
|---|---|---|---|
| `unit` | 141 files, 3,587 tests | 141 files, 3,604 tests | 5 files, 138 tests; `audit-details.test.ts` 35 (18 before) |
| `db` | 108 files, 1,541 tests (1 skipped, another row's) | the same | `bulk-fixture.db.test.ts` 19 |

### Deviations (artifact section 22.9)

- DV-14: the two rows and events of each audit-tamper alert changed places (no `at` changes, rows per type equal).
- DV-15: `UPDATE_COMPLETED` severity SUCCESS to INFO (2 rows, not among the four reported); no audit row has the severity SUCCESS any more.
- DV-16: the text of a module's event is the builder's too (8 event types).
- DV-17: the row and event of a fault carry the text of their alert; the `alerts` table is untouched.
- DV-18: `padEvents` no longer pads with an autosave event (no event of the fixture comes from the padding today).
- DV-19: the test reads the administration module's source for the severity of its three rows (no builder exists).
- DV-20: rows with an actor 3,270 to 3,276 (item 1).

### Findings (artifact section 22.9)

- F-19: the biometric builders did not change after 15:57:47; the first follow-up's reference was current.
- F-20: 1,300 events of 18 types differed (eleven types were named by reading).
- F-21: severity differed in 69 audit rows of 5 types.
- F-22: 17 `FAULT_RAISED` rows of kind `AUDIT_TAMPER`, and their events, are rows no server writes; kept so that no count changes.
- F-23: the alerts row's bulk test now prints 88 of 88.
- F-24: an alert's target and its row's device are the fixture's hardware names, not the simulator's track names; alert and row agree with each other.
- F-25: the pairing of an audit row with its event is compared for the modules' types only.
- F-26: the administration module has no pure builder.
- F-27: the structural round changed `load.ts` at 17:13:51; `test/support` did not exist at 17:29.
- F-28: the audit log of the fixture has three severities now, not four.
- P11: typecheck red at 17:11 and 17:13 in `test/acceptance/restart.test.ts` (another row), green at 17:19; the one skipped `db` test is the demo row's own.

### Known limits (artifact section 22.7)

- A lock is not replayed across rows (the first follow-up's F-17).
- One `FAULT_RAISED` row and event beside each audit-tamper alert, which the engine does not write (17 and 17).
- The fixture writes one of the six reasons of a refused token.

### Decisions for the controller (artifact section 22.9)

- DN-12: accept DV-14 to DV-20.
- DN-13: keep the 17 extra `FAULT_RAISED` rows, or take them out and let three counts change.
- DN-14: should a fixture alert carry the simulator's own target, device and text?
- DN-15: rows for the other five reasons of a refused token need new rows.
- DN-16: tell the alerts row that AC-B-71 can be asserted on the bulk template.
- DN-17: a pure builder in the administration module would let the test hold its message too.

