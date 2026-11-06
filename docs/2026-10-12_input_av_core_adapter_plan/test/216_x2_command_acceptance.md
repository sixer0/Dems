---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 216
package: M11 | X2-3 (acceptance)
date: 2026-10-13
agent: test-expert (wave 10, agent X3)
tier: 2
status: complete
requirements: SX-01, SX-02, SX-11, SX-19; R-X2-4, R-X2-6, R-X2-7, R-X2-11 (acceptance on a database); the attended check H5 stays open
---

# Row 216 - database acceptance of `operator:set-password`

Branch `task4/input-av-core-port`, working tree on `0f5d2a8e` with the uncommitted work of waves 9 and 10. NO product file was written. Paths are relative to `apps/core-server/`.

## 1. What was found

One scripted session of nine steps on a throw-away database of its own (`dems_test_local_<stamp>_..._r216_acceptance`, a further clone of the seed made by the repository's own helper `useFurtherDatabase`; schema version 11, `dbc-12`), through the command's FUNCTION `runSetPasswordCommand` with an injected prompt port. The terminal entry `cli/operator-set.ts` was not driven.

| # | The cell asks | Result | Step of the test |
|---|---|---|---|
| 1 | the predicate counts N before and 0 after | **HOLDS**: the boot check's own reader `storedDemoPasswordOperators` answers 3, then 2 after the failed walk, then 0 | 0, 3, 4, 6 |
| 2 | check 4c THROUGH THE REAL BOOT FUNCTION refuses with three operators before the walk and passes after it | **HOLDS**: a whole `REAL_PRODUCTION` start of `buildApp` (the capture unit's own mount, no seam of a check) is refused at step `capture.boot` with `CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION` / `operators=3`; after the walk the same start writes `CAPTURE_BOOT_CHECKS_PASSED` and its outcome is `REAL_PRODUCTION` | 1, 7 |
| 3 | the real sign-in succeeds with each run value and fails with the demonstration password; a Core boots on that database | **HOLDS** on the production Core of step 7: three earlier sessions 401, the demo password 401 for all three, each run value 200, operation `verifyAuditChain` ok for view and stored chain | 7 |
| 4 | sessions ended and tokens revoked IN THE SAME TRANSACTION | **HOLDS**, by the transaction id: the credential row, the ended session, the revoked biometric token and the audit row of the Supervisor carry ONE `xmin`; session and token carry the reason `CREDENTIAL_REPLACED` and the instant of the credential | 4 |
| 5 | exactly one `OPERATOR_PASSWORD_SET` row per operator, actor null; the Core's own chain verification passes | **HOLDS**: three rows, in the walk's order, category SECURITY, severity WARNING, actor null, the five keys; each lies in the transaction of its operator's credential; `createStoredChainVerifier` over the whole chain: `ok`, `firstBadSeq` null, checked = the head | 6 |
| 6 | each operator's stored credential changed exactly once | **HOLDS**: after the failed walk the second walk lists 2 operators and does not ask the Supervisor; the Supervisor's row is byte- and transaction-identical before and after it; three credentials, three different transactions | 5 |
| 7 | the policy refusals | **HOLDS** on the database: `PASSWORD_TOO_SHORT`, `PASSWORD_IS_DEMONSTRATION`, `PASSWORD_HOLDS_USERNAME`, then `TRIES_EXHAUSTED`; chain head and all three credential rows unchanged; no refused value repeated in a line | 3 |
| 8 | a failure at operator 2 of 3 leaves operator 1 committed and reports exactly that | **HOLDS**: `REFUSED (DATABASE_IN_USE) <operator 2>: NOT set, its unit was rolled back and nothing of this operator was stored; set and committed before it: <operator 1>.`; operator 3 is listed and never prompted; error log: one entry, code `DATABASE_IN_USE`, `committedBefore: 1`; rows of operators 2 and 3 byte-identical, their sessions open; the chain moved by one row; final line `operators that still have the demo password: 2` | 4 |
| 9 | a second connection is refused before the first prompt and again inside the transaction (SX-01) | **HOLDS**: before the first prompt (`dems_app: 1`, nobody prompted, nothing stored) and inside the unit of operator 2 (finding 8) | 2, 4 |
| 10 | the sweep counts 0 | **HOLDS**: 8 places x 44 needles = 352 searches, 0 hits (section 3) | 8 |
| 11 | the database is dropped at the end, also on failure | **HOLDS by construction, measured on the passing run**: the helper drops the clone in its `afterAll`; an `afterAll` of this block that runs AFTER it asks the catalog for the name and finds 0 rows; the run's teardown line says `0 remain`. A FAILED run was not produced (the file passed on its first run), so "also on failure" rests on `afterAll` running after a failed test, not on a measured failed run | hooks |

Why it matters: rows 211 and 215 proved the count and the walk, but check 4c itself was only ever told a number (row 206) or passed on rows written by a fixture (row 208). Here the same start is refused before the command and passes after it, with nothing between the two but the command.

## 2. The file

`test/cli/operator-set-password.db.test.ts` - ADDITIVE: one further `describe` block (row 216) and its imports. The blocks of rows 211 and 215 are unchanged. Extended rather than a new file (driver rule 7; decision D233 `useFurtherDatabase`: the block has a database to itself).

Doubles, and nothing else: (1) the prompt; (2) the host facts of steps 4d / 4e and the two stand-in delivered programs (`provideTestCaptureHost`, `testHostPrograms`; C46, C55 DD-3); (3) the worker program, row 61's stand-in that says one HELLO; (4) for the key command's directory rule, the directories above the test's root (row 206's double).

The signing key that lets a start reach 4c is made by `runProductionKeyCommand` in a `mkdtemp` directory of the temporary folder; the block removes it and asserts it is gone. No key lies anywhere else; no key file is read by the test.

Fixture rows written as the owner role (stated in the test): the speech configuration off and the selector emptied - a seeded database does not start in production without them (row 208 did the same; row 220 measures it); one paired device and one unused biometric token of the Supervisor.

The command's `--data-dir` is the directory of the suite's database helper, as in row 215: the command opens the connection file itself. This agent opened no credential file.

## 3. The sweep

| Places (8) | Needles (44) |
|---|---|
| standard output and standard error of the test process (both `write` functions spied for the whole session), every line and prompt label of five command runs, the recorded error log, every row of `audit_log` as JSON text, the log lines of the three Cores, the process arguments, the environment | the three accepted values and the two refused synthetic values, each plain, hex, base64 and URI-encoded (20); the salt and the tag of each of the three stored sets, each as hex, upper-case hex, base64 and base64url (24) |

Positive control: every needle is found once in a text it is planted in; the places are not empty (asserted). A hit would be named by label and place, never by value. The published demo password is searched only in the command's lines and error entries (step 3): count 0.

## 4. Runs

Command, repository root, command sandbox off:
`/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock sh -c 'cd apps/core-server && npx vitest run --project db test/cli/operator-set-password.db.test.ts --maxWorkers=2 --reporter=verbose'`

| Run | Result |
|---|---|
| 1 (12:40:53), the only one | `Test Files  1 passed (1)`, `Tests  15 passed (15)` (1 of row 211, 5 of row 215, 9 of this row); `[test:db] teardown: dropped 2 database(s) in 63 ms; 0 remain with the run prefix dems_test_local_tmtzs5mu_` |

Other checks: `npx tsc --noEmit` in `apps/core-server`: no error at 12:40. `npx vitest run --project unit test/static --maxWorkers=2`: `Test Files  16 passed (16)`, `Tests  180 passed (180)`.

## 5. What stays unproven

- The real terminal (R-X2-2): attended check H5. The entry `cli/operator-set.ts` was not run.
- A production host: the start of steps 1 and 7 ran on the test host (not Linux; its runner starts nothing) with stand-in programs. Hardware check 9A/H-nn; row 220 records what this Mac does.
- "Dropped also on failure" on a measured failed run (finding 11).
- The stand-in for "another session" is one extra connection of the runtime role, as in rows 214 and 215.

## 6. Driver decisions (for the controller to confirm)

| # | Decision |
|---|---|
| DD-1 | The existing file is extended; the profile said "one database test file, executor declares" |
| DD-2 | "The same transaction" is asserted by PostgreSQL's `xmin` of the four rows, read as the runtime role; no product statement was added for it |
| DD-3 | The failure at operator 2 is produced by a connection that appears while operator 2 "types" (the SX-01 path inside the unit): the one failure a real database gives without a fault seam in the product |

Process: existing files changed with the Edit tool only (`operator-set-password.db.test.ts`: three edits; `file_claims.md`: one line). DEPARTURE, stated: the claim line was written after the reading, not as the first act. Nothing committed, staged or stashed.

---
*Generated: 2026-10-13*
