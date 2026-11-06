---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 45
milestone: M3 / WP-06a
date: 2026-10-13
agent: coder-execution
tier: T3
requirement: P12-B2 (the read path); AD-03 points 1 and 2 (the reader's part; holders' wiring and device refusals are row 144, session id is row 145)
status: complete
---

# Row 45: the reveal module and the credential reader

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CC` = `apps/core-server/src/modules/capture-config`.

## What was built

| File | Change | Description |
|---|---|---|
| `CC/credential-reveal.ts` | new | The ONE file of the server that names the owner's reveal function (the path migration `0005_capture_privileges.sql:14` names). One constant statement with one bind parameter. Answers `NONE` (no row), `INVALID` (a row of an unknown form) or `SEALED` (account name and envelope: key reference, ciphertext, nonce). Never a secret; it opens nothing, imports only a type of the driver, and never throws for the form of a row (a throw would roll the unit back after the function was called) |
| `CC/credential-reader.ts` | new | `createCaptureCredentialReaders(dependencies)` returns a handout; `take(holder)` gives each holder of the closed list its reader once. One read = one unit (`reveal`, then `CAPTURE_CREDENTIAL_REVEALED`), its commit, and only then the envelope is opened and sealed into the opaque `SealedCredential` |
| `CC/__tests__/credential-reader.db.test.ts` | new | 11 cases on PostgreSQL: real pipeline, real audit writer, real reveal function and grants, real credential store in a temporary directory |
| `CC/__tests__/credential-reader.test.ts` | new | 9 cases on doubles: holders, bound reasons, request form, a runner that does not commit, the reveal module's answers |
| `CC/__tests__/static.test.ts` | new | 10 cases: rules R-1 to R-4 with a control on planted sources |

No existing file of the application was edited. `CC/index.ts` does not export the reader (rule R-3 holds that).

## The reader, as built

| Step | What | Evidence |
|---|---|---|
| 1 | Before any statement: the reason is one the holder can say; the device id matches `HARDWARE_DEVICE_ID_PATTERN`; an actor, when given, matches `OPERATOR_ID_PATTERN` | `credential-reader.ts`, function `read`; unit test "a request that is not a device id ..." (0 units, 0 statements, 0 entries) |
| 2 | One unit of work: `revealCaptureCredential(unit, deviceId)`, then `unit.audit.append` with details `{ deviceId, reason }` | same function; DB test "SESSION_OPEN ..." |
| 3 | The commit is taken from the unit itself (`unit.afterCommit` sets a flag); a runner that resolves without it yields no credential | unit test "a runner that resolves WITHOUT a commit" |
| 4 | Outside the unit: `open(deviceId, envelope)` of the Core credential store, straight into `sealCredential`; the secret has no variable of its own | `credential-reader.ts`, end of `read` |

Holders and what each can say (`CAPTURE_CREDENTIAL_HOLDERS`, frozen):

| Holder | Methods | Reason written | Actor |
|---|---|---|---|
| `CAMERA_ADAPTER` | `sessionOpen(deviceId)`, `relayRestart(deviceId)` | `SESSION_OPEN`, `RELAY_RESTART` | none |
| `CONNECTION_TEST` | `connectionTest(deviceId, operatorId)` | `CONNECTION_TEST` | the operator |

No method takes a reason. The private `read` is reachable through these three methods only. The three reasons equal `CAPTURE_CREDENTIAL_REVEAL_REASONS` of `core/audit-details.ts` (held by a test; the reader cannot import that list, see requests).

Outcomes (code of `CaptureCredentialReadError`; no cause, a fixed sentence, at most the device id):

| Case | Code | Credentials | Entries | Error-log codes |
|---|---|---|---|---|
| Good read | - | 1 | 1 | 0 |
| Reveal statement fails | `CAPTURE_CREDENTIAL_REVEAL_FAILED` | 0 | 0 | 1 |
| Audit append fails | `CAPTURE_CREDENTIAL_AUDIT_NOT_COMMITTED` | 0 | 0 | 1 |
| COMMIT fails | `CAPTURE_CREDENTIAL_AUDIT_NOT_COMMITTED` | 0 | 0 | 1 |
| No credential stored | `CAPTURE_CREDENTIAL_NOT_STORED` | 0 | 1 | 1 |
| Stored row of an unknown form | `CAPTURE_CREDENTIAL_ROW_INVALID` | 0 | 1 | 1 |
| The store cannot open the envelope | `CAPTURE_CREDENTIAL_OPEN_FAILED` | 0 | 1 | 1 |
| Request not a device id / operator id | `CAPTURE_CREDENTIAL_REQUEST_INVALID` | 0 | 0 | 0 |
| Holder outside the list, or taken twice | `CAPTURE_CREDENTIAL_HOLDER_REFUSED` | no reader | - | - |

## Static rules (`CC/__tests__/static.test.ts`)

| Rule | Statement | Today |
|---|---|---|
| R-1 | No production source outside the migration set names the reveal function, except the reveal module | callers: 1 file |
| R-2 | The reveal module is imported by the reader only; its one import is a type of `pg` | importers: 1 file |
| R-3 | The production importers of the reader equal `CAPTURE_CREDENTIAL_READER_IMPORTERS` (at most one, never under `src/capture/adapters/`, never the module index) | list empty: no wiring exists yet |
| R-4 | Neither file logs, uses the console, reads a `.secret` member, calls `credentialAtInjection` or builds an error with a cause; the reader imports no credential store | 0 occurrences |

No entry was added to the capture static rule lists (`src/capture/__tests__/static.test.ts`, `src/capture/adapters/__tests__/static.test.ts`): the new files are outside `src/capture/` and `modules/capture-config/` is already a wiring unit of rule A-5.

## Checks (this Mac; no device, no network, no real credential)

| Check | Command (in `apps/core-server`) | Result |
|---|---|---|
| Unit and static | `npx vitest run --project unit --maxWorkers=2 src/modules/capture-config/__tests__/credential-reader.test.ts src/modules/capture-config/__tests__/static.test.ts` | run 1: `Test Files 2 passed (2)`, `Tests 19 passed (19)` |
| Database | `/usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock npx vitest run --project db --maxWorkers=2 src/modules/capture-config/__tests__/credential-reader.db.test.ts` (sandbox off) | run 1: `Tests 11 passed (11)`; run 2 after the change below: `Test Files 1 passed (1)`, `Tests 11 passed (11)`; throw-away clones `dems_test_local_*`, `0 remain` |
| Tree-wide static rules that scan the new files | same runner, 13 files (`test/static/imports`, `credentials`, `logging`, `log-calls`, `scan-coverage`, `test-support-imports`, `audit-protection`, `search-path`; static tests of `capture`, `capture/adapters`, `credential-store`, `core`, `stt-config`) | run 1: 3 failed, 161 passed. Two were this row's test file (it dropped its two triggers: T-AO-4; it imported `core/__tests__/support`: W91-9), one was row 21's file in flight (`production-door.ts`). After the fix: the three files and this row's two unit files `Test Files 5 passed (5)`, `Tests 43 passed (43)` |
| Typecheck | `npm run typecheck`, then `npx tsc --noEmit` once more after the test-file change | exit 0, 0 `error TS` lines |
| Lint | `npx oxlint` on the five files | exit 0 |

The change between the two database runs: the two failure triggers are created once and stay; a one-row switch table on the clone says which of them refuses. No trigger of `audit_log` is dropped or disabled. The app is built in the file with the real factory instead of the core's private test support.

Verification cell of the row:

| Item | Where | Result |
|---|---|---|
| One call: 1 credential and 1 audit entry with exactly two detail keys | DB test "SESSION_OPEN: ..." | trail +1; keys `deviceId`, `reason`; actor null; chain verifies; store opened once |
| Audit append made to fail: 0 credentials, 0 entries | DB test "the audit append fails" (a BEFORE INSERT trigger on the clone) | trail +0; store not asked; 1 error-log code |
| Callers of the reveal function: 1 file | static R-1 | `CC/credential-reveal.ts` |

Asked beyond the cell, and proven: COMMIT made to fail (a deferred constraint trigger; the pipeline logs `COMMIT_FAILED` once): 0 and 0. Reveal statement made to fail (EXECUTE revoked on the clone, granted back): 0 and 0. Store cannot open after the commit: 0 credentials, 1 entry, 1 error-log code. Two reads in flight: 2 credentials, 2 entries. A reason outside the closed set, a third key, a forbidden key, a missing key at the audit writer: refused, 0 entries. Opacity (the print forms of `credential.test.ts`): 0 occurrences of either placeholder in the returned credential, every thrown error, the audit trail, the events, the log at trace level and the error log; the control finds both in a plain object.

## AD-03, point by point

| Point | State |
|---|---|
| 1. Closed list of holders, reader bound to its reason, no reason from a caller, closed reason set | done in the reader (handout, bound methods, run-time refusal, static R-3). The wiring file, its entry in the importer list and "no holder passes a reason" at the call sites: row 144 |
| 2. Returned only after the commit | done: append fails 0/0, commit fails 0/0, store fails after the commit 0/1/1. Row 145 keeps its own check of the same |
| 3. Session id in the audit row | left to row 145 (and row 89): `openSource` has no session; the entry has no `sessionId` member today |
| 4. Refusal of a non-production camera and of a stored address that fails the destination rule, before the reveal | left to row 144 |
| 5. Stored-credential connection test: stored address, spacing, lock-out | left to rows 50 and 146 |
| 6. Start message as bytes, injection result prints the mark | built by rows 147 and 21. This reader returns the opaque `SealedCredential`; it never makes the injection result |

## Doubles and what stays unproven

- Doubles: none in the database test except the triggers and the revoked grant that make a failure happen. In the unit test the unit runner, the opener and the error log are doubles.
- Unproven here: no production wiring calls the reader (rows 144, 50, 85, 46); a read from inside another unit of work is refused by the pipeline (`PIPELINE_REENTRANT`) by reading, not by a test of this row; which SQLSTATE names the two trigger failures in the error log was not pinned (the reveal failure is pinned at `42501`); a real camera account with awkward characters is `9A/H-23`.

## DRIVER DECISIONS (for the controller to confirm)

1. **The reader's interface is not `credentialFor(deviceId, reason, actorId)`** (addendum 2.3 step 2): under AD-03 (1), which governs, no caller passes a reason. It is a handout with `take(holder)` and three bound methods.
2. **The reader returns a `SealedCredential`, not an `InjectedStreamAccess`.** The injection needs the locator, which only the adapter has after `GetStreamUri`; `credentialAtInjection` keeps its one future caller (row 46).
3. **Every completed call of the reveal function is audited, also when it finds no credential or a row of an unknown form** (migration 0005: "every invocation is audited"; the over-reporting direction of security check 4.1). A reveal statement that fails writes no entry: its transaction cannot commit one.
4. **Run-time closure by "once per holder".** A second `take` of the same holder is refused, so after the wiring nothing else can obtain a reader even if it reached the handout.
5. **The audit row's `deviceId` column is the camera** (as `CAPTURE_CREDENTIAL_SET` does); the fixture row of row 19 has `null` there. Both pass the writer.
6. **The device id is held to the hardware-id pattern before the statement**, the actor to the operator-id pattern; no check that the device is registered (that and the kind are row 144).
7. **Three test files, not one**: the subject is new; the database cases, the cases on doubles and the folder's static rules follow the layout of `modules/stt-config/__tests__`.
8. **New files were written with the Write tool** (they did not exist); every edit of an existing file (claims, requests) used the Edit tool.

## Requests left in `file_requests.md`

Three lines, none blocking for this row: the export of the reason list from `core/index.ts`; the wiring rules for rows 144, 50, 85 (importer list entry, dependencies, never inside a unit); a note that rule A-2 needs no line from this row.

---
*Generated: 2026-10-13*
