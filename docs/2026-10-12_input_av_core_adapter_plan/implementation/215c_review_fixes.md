---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 215c
date: 2026-10-13
agent: coder-execution (driver, track D)
tier: T2
baseline: branch task4/input-av-core-port, the uncommitted tree over 0f5d2a8e
sources: verification/222_m11_review.md (B-01, F-01, F-02, F-03, F-10 (a)); verification/221_x1_x2_as_built_security.md (C-2); decisions C71, C72
status: complete
---

# Row 215c - review fixes of the bench tier (B-01, C-2 / F-10 (a), F-03, F-02, F-01)

A fixed list of five items, tests first. One product change, where the brief names it (item 2), and one
comment (item 3). No database schema, no shared file, no boot file was edited.

## 1. Result per item

| # | Finding | Result | Where |
|---|---|---|---|
| 1 | B-01 (BLOCKING): the session-identity check has no refusing test | DONE, test only | `apps/core-server/test/cli/operator-set-password.test.ts`, describe "refused before the first prompt", 5 rows x 2 targets + 1 control |
| 2 | C-2 / F-10 (a): a failed `guard.remember` is swallowed | DONE, product change + 4 cases | `apps/core-server/cli/operator-set-password-command.ts` (the block after the unit; one refusal word; one member of the result); same test file |
| 3 | F-03: refusals without a test | DONE, 6 of 6 reached, no new seam under the command | same test file, describe "row 215c, review F-03" (11 cases) |
| 4 | F-02: untested branches of the production key command | DONE, tests only, no export needed | `apps/core-server/src/sealing/__tests__/production-key.test.ts` (4 new cases, 1 case added inside an existing one) |
| 5 | F-01: the one-load wiring of the mount is not pinned | DONE, a new test file; `boot/index.ts` and `checks.ts` NOT edited | NEW `apps/core-server/src/capture/boot/__tests__/one-load-mount.test.ts` (5 cases) |

## 2. Item 1 - B-01

The pool double answered the passing identity row in every case. The rig's `World` now has an optional
`identity` (absent = the passing row, as before; `null` = no row). One `it.each` with five sessions - another
role, the runtime role made superuser, a superuser flag that is null, another database, no row - each run for
`--all-demo` and for `--username`. Each expects: exit 1; the ONE line
`operator:set-password: REFUSED (ROLE_NOT_RUNTIME) the session is not the role dems_app on <database>.`; the
prompt port called 0 times (`labels` empty); the word not asked; no hash made; the identity question the ONLY
statement sent; nothing written; no audit row committed. A control case holds that the same rig with the
runtime session goes on to the word.

**Proof that the test is real.** The condition at `operator-set-password-command.ts:402` was replaced with one
that is never true (Edit tool), the file run, and the condition put back at once (Edit tool):

| State of the check | Command | Result line |
|---|---|---|
| removed | `npx vitest run --project unit test/cli/operator-set-password.test.ts --maxWorkers=2` | `Tests  5 failed \| 54 passed (59)` - the five failures are the five rows of the new case, each missing the `ROLE_NOT_RUNTIME` line |
| in place (as the tree ends) | the same | `Tests  59 passed (59)` |

The tree ends with the check in place: `grep` finds
`identity.role !== RUNTIME_ROLE || identity.superuser !== false || identity.database !== args.database` at `:402`.

## 3. Item 2 - the swallowed `guard.remember`

**Before.** `await guard.remember(accepted).catch(() => undefined);` - a guard that could not remember read as
"no repeat" for every later operator of the run (SX-13).

**After.** The failure is caught and named:

- a new refusal word `SetPasswordRefusal.REPEAT_CHECK_LOST`;
- a new member of the command's result, `SetPasswordRun.repeatCheckLost: boolean` (false in every other run);
- one entry in the Core's error log through the command's `persist`: level `error`, source
  `cli.operatorSetPassword`, code `REPEAT_CHECK_LOST`, context `{ command, database, step: 'remember',
  targetOperatorId, committed }`. A code, an operator id and a count - never the value;
- the password of that operator IS set and committed (its unit committed before the remember), and the line
  `<username>: password set, N session(s) ended` is said as before;
- when operators are left, the walk STOPS: `REFUSED (REPEAT_CHECK_LOST) set and committed: <names>; the repeat
  check of this run is no longer available, so no further password is asked. ...`, the count line, exit 1;
- when it was the LAST password of the run, nothing is left to protect: a `NOTE (REPEAT_CHECK_LOST)` line, the
  entry in the error log and `repeatCheckLost: true`; the exit code is the one the run has otherwise.

**DRIVER DECISION D-1 (for the controller to confirm).** The two reviews say "stop the walk". After the last
password there is no walk left; exit 1 there would report a failure of work that is complete and committed.
The conservative half is kept in full: it is said, logged and in the result in both cases, and no password is
ever asked after a lost check.

Tests (describe "row 215c, security review C-2 / code review F-10 (a)"): at operator 1 of 3 (the SAME value is
ready for operator 2 - it is never asked for); at operator 2 of 3; after the single password of `--username`;
a control whose guard remembers three times. Each sweeps every line, the error log, every bound statement
value and the result object for the typed value: 0.

**The seam of these cases (DRIVER DECISION D-2).** The command has no port for the guard and none was added
for a test. The test file doubles ONE function of the identity module (`createRunRepeatGuard`) with
`vi.mock`: the module is the real one, whole; while the hook is null - every older case - the real guard is
made. The failing guards are the real guard with a `remember` that throws from the n-th call on.

## 4. Item 3 - F-03

Injected through ports the command already has: the pool (`openPool`), by a new optional `fail(text)` of the
rig's `World` that rejects a named statement; the hasher port; and the guard double of item 2.

| Refusal (line of the review) | How reached | What the case holds |
|---|---|---|
| `DATABASE_UNREACHABLE` (`:400-403`) | the identity statement is rejected (code `ECONNREFUSED`; and an error whose code is not of the closed form) | the one line with the code; one error-log entry `step: 'connect'`; the driver's text in no line and no log; no prompt, no write |
| `OPERATORS_UNREADABLE` (`:434-437`) | 4 cases: the reason constraints, the other sessions, the walk's list, the named operator - each rejected | the one line "... Nothing was changed."; entry `step: 'operators'`; the word not asked, no prompt, no hash, no write |
| `COUNT_UNREADABLE` (`:445-449`) | the count statement is rejected (a) after a committed set, (b) with nothing to do | (a) the set stays named and committed, the count "could not be read", exit 1, `demoPasswordOperators` null; (b) "nothing to do" is not exit 0 |
| `REPEAT_CHECK_UNAVAILABLE` (`:470-475`) | the guard cannot be made | after the word, before any prompt; "Nothing was changed."; no unit |
| the hasher or the policy fails in the attempt loop (`:532-535`) | (a) the hasher port rejects at operator 2; (b) the repeat check throws while a value is judged | (a) operator 1 committed, 2 NOT set, 3 never prompted, bytes zeroed; (b) not set, nothing hashed, no unit; entry `step: 'hash'` |
| `DEMO_PASSWORD_REMAINS` (`:610-613`) | REACHABLE: a credential with the demo password appears after the walk's list was read (the world of the double gains one operator after the last hash) | all listed operators set, the late one never prompted, count 1, "NOT COMPLETE (DEMO_PASSWORD_REMAINS)", exit 1 |

The review asked to state in the file whether `DEMO_PASSWORD_REMAINS` can be reached: it can (a writer the
session test did not see, between two of its asks); the branch is kept, with a comment that says when.

Not changed, and said here: review F-10 (c) (`UNIT_FAILED` is the word for a hasher or policy failure, where
no unit ran) and (d). The new cases pin the words as they are today; a row that gives them codes of their own
moves two expectations.

## 5. Item 4 - F-02

All through the existing `inspect` port and real files in temporary directories; `production-key-command.ts`
is unchanged (no export was needed).

| Branch | Case |
|---|---|
| R-X1-3 read-back, `STORE_NOT_AS_WRITTEN` (`:445-454`) | 8 rows: the key file readable by the group / gone; the wrap file of another user / readable by others; the certificate a link / group-writable; the store directory open / of another user. The fact is changed only once the key exists. Each: exit 1, the refusal, the line and "LEFT", the three files there, no record, no hand-over folder, no fingerprint printed. Control: the same double unchanged provisions |
| `SUBJECT_MISMATCH` (`:463`) | the store is EXCHANGED between the read-back and the load (a) for a development key, (b) for another key of the same subject (fingerprint differs). Each: the refusal, files left, nothing handed over; the store that is there loads as the other key |
| provisioning failure, `FAILED, <code>` (`:438-442`) | (a) a store the port does not show: `FAILED, KEY_EXISTS`, refusal `KEY_EXISTS`, the tree byte-identical; (b) the data directory takes no entry: `FAILED, UNREADABLE`, `refusal: null`, no text of the operating system |
| nine directory codes | one table, one stated fact each: `ANCESTOR_NOT_FOUND`, `ANCESTOR_NOT_A_DIRECTORY`, `ANCESTOR_OWNER`, `DATA_DIR_NOT_A_DIRECTORY`, `SIGNER_NOT_A_DIRECTORY`, `SIGNER_OWNER`, `HANDOVER_NOT_A_DIRECTORY`, `HANDOVER_OWNER`, `HANDOVER_WRITABLE`; refused before anything is asked or made; a control |
| the comment that listed "a file" | the case was added where the comment stands: a REAL file named as the data directory -> `DATA_DIR_NOT_A_DIRECTORY` |

Review F-10 (e) (`refusal: null` with code 1) is pinned as it is, not changed.

**One more line in this file (DRIVER DECISION D-3).** The existing case `"OK" means: boot checks 4 and 4b ...`
went red during this row: row 228 (in flight) added check 4b-2, and the bare mount of that case told the boot
no installation id (`CAPTURE_SIGNING_KEY_INSTALLATION_MISMATCH`, `INSTALLATION_ID_NOT_KNOWN`). The file is in
this row's ownership, so the mount was given row 228's own seam, `installationId: INSTALLATION` - the id the
command was typed in that case. One additive member and one comment; the expectations are untouched. Row 228
should know, so that its sweep does not add it twice.

## 6. Item 5 - F-01

`one-load-mount.test.ts` mounts the boot step as the capture unit does (`mountCaptureBootChecks`, run by the
readiness plugin's `boot()`), for REAL_PRODUCTION, with NO seam of the signing key, and counts the calls of
the store's loader by doubling ONE function of the signer unit as the boot unit imports it (`vi.mock` of
`../signer`: the real module, `loadSoftwareSigner` wrapped by a counter that calls the real loader).

| Case | Expectation |
|---|---|
| a production store (unit `Evidence signing DEMS-TEST-215C`, the mount told that id) | refused only at 4c (`operators=7`): checks 4, 4b and 4b-2 asked; loader calls = 1, for this store |
| a development store | refused by 4b; loader calls = 1 |
| no store | refused by 4 (`KEY_ABSENT`); loader calls = 1 |
| two mounted apps | 2 calls, one per run and per store: the load is per run, not per process |
| CONTROL | with both seams handed in, 0 calls; a direct call through the unit's door counts 1 |

**Proof that the test fails on a mount with two loads.** `boot/index.ts` was NOT edited (row 228 is its
writer). A scratch COPY of it was made under `.cache/task4-row215c/` with its relative imports written in
full and the two members of `signingKeyQuestionsOf` put back to the two separate readers
(`storedSigningKeyProblem`, `storedSigningKeyIsDevelopment`); a scratch copy of the test imported that copy.

| Mount | Result line |
|---|---|
| the scratch copy with two loads | `Tests  3 failed` of 5: the production store 3 calls instead of 1, the development store 2, the two apps 6 instead of 2 |
| the tree's `boot/index.ts`, same run | 5 passed |

Both scratch files were made and removed by this row (`ls`: 0 left). Re-run at the end against row 228's
state of `boot/index.ts` (three readers over one load, check 4b-2 in place): `5 passed`.

Keys: made by the test in `mkdtemp` directories, removed after each case and asserted gone at the end. The
fixture of row 61 under `.data/` is not used (security caution C-4).

## 7. Checks

| Check | Command (from `apps/core-server`) | Result |
|---|---|---|
| The owned unit tests, last run | `npx vitest run --project unit src/capture/boot/__tests__/one-load-mount.test.ts src/sealing/__tests__/production-key.test.ts test/cli --maxWorkers=2` | `Test Files  4 passed (4)`, `Tests  107 passed (107)` (59 + 16 + 5 + 27 of `secret-prompt`) |
| The command's database tests | `/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock sh -c 'cd apps/core-server && npx vitest run --project db test/cli/operator-set-password.db.test.ts --maxWorkers=2'` | `Tests  16 passed (16)`; `teardown: dropped 2 database(s) ...; 0 remain with the run prefix` |
| Static rule files | `npx vitest run --project unit test/static src/capture/__tests__/static.test.ts src/capture/boot/__tests__/one-load.test.ts ...` | 350 of 353; the 3 reds are named below, none in a file of this row |
| Typecheck | `npx tsc --noEmit -p tsconfig.json` | 0 errors |
| Leftovers | temporary folder searched for `dems-row215c-`, `dems-row206-`, `dems-row215` | 0 |

Runs: the set-password file three times (green, the proof run with the check removed, green again); the
production key file three times (the second and third because of the red of row 228 in it); the mount file
three times (green, the proof, the end).

**Reds seen that are not this row's (reported, not edited):**

| Where | What | Likely owner |
|---|---|---|
| `test/static/search-path.test.ts:94` "the list of places is exact" | `src/modules/capture-config/factory-scan/service.ts` is not on the list | row 107 (agent A2) |
| `src/capture/__tests__/static.test.ts:406` SR-2 | two files instead of `src/capture/destination-rule.ts`; seen in one run, gone in the next | a row in flight on the destination rule (A1 / I-9a) |

## 8. Secrets rule

Every typed value is made from randomness in the run; no password is a literal of a test. Every key is made
by a test in a temporary directory that the test removes. No file under `.data/` was opened, listed or
stat-ed by this agent. The database test process read the development cluster's connection file through the
test helper, as before (security caution C-3, stated for the bench gate). Nothing prints or logs a secret:
the new error-log entry holds a code, an operator id and a count, and its cases sweep for the value.

## 9. Edit-only statement

Every existing file was changed with the Edit tool, by small edits after reading: `file_claims.md` (one
line), `operator-set-password-command.ts`, `operator-set-password.test.ts`, `production-key.test.ts`. New
files with Write: `one-load-mount.test.ts` and the two records. The only scripted text was the two SCRATCH
copies of the proof of item 5 (new files of this row, removed by it). The temporary removal of the check of
item 1 and its restoration were two Edit calls. Nothing was committed, staged or stashed.

## 10. Files

Changed: `apps/core-server/cli/operator-set-password-command.ts`;
`apps/core-server/test/cli/operator-set-password.test.ts`;
`apps/core-server/src/sealing/__tests__/production-key.test.ts`;
`docs/2026-10-12_input_av_core_adapter_plan/delegation_progress/file_claims.md` (one line).
New: `apps/core-server/src/capture/boot/__tests__/one-load-mount.test.ts`; this record;
`delegation_progress/row_215c.md`.
Not touched: `boot/index.ts`, `boot/checks.ts`, `cli/production-key-command.ts`, `cli/operator-set.ts`,
`capture/signer`, `packages/shared`.

## 11. Open, for the controller

- D-1, D-2, D-3 above, to confirm.
- `cli/operator-set.ts` (the entry) does not read `repeatCheckLost`; the exit code and the lines carry it.
- Review F-10 (b) to (e), F-04 to F-09 and F-11 are not this row's.

---
*Generated: 2026-10-13*
