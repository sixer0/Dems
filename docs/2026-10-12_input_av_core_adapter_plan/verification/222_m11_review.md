---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 222
milestone: M11, the bench tier (rows 201, 202, 204, 206 to 216)
date: 2026-10-13
agent: senior-code-reviewer
tier: T1
baseline: 0f5d2a8e (HEAD); the work reviewed is the uncommitted tree on branch task4/input-av-core-port
status: complete
---

# Row 222 - code review of M11, the bench tier

## 1. Verdict

**CHANGES REQUESTED - narrow. BLOCKING findings: 1** (B-01, a missing test, no product change; producing row 215). Follow-ups: **11** (F-01 to F-11). Notes: **14** (N-01 to N-14).

The product code of the tier reads as correct. No behaviour defect, no lost content and no broken reference was found. Row 211's claim "behaviour-preserving" holds line by line against `git diff` (section 6). The declared Edit-only departures of the tier lost nothing (section 5.1). The typecheck of `apps/core-server` reports no error in any file of the tier (section 2).

The one blocking finding is a rank-1 requirement (SX-03) whose in-session enforcement the record of row 215 states as done and that no test would miss if it were deleted. The fix is one test case in an existing file.

What decides between blocking and follow-up in this review: a finding is BLOCKING when behaviour is wrong, content was lost, a reference is broken, or a rank-1 requirement is recorded as done while its enforcing branch has no refusing test at any level. A test gap that its own record states openly, or whose property is observed by another assertion, is a follow-up.

| Domain | Verdict | Findings |
|---|---|---|
| Code structure | CAUTION | F-05, F-06, N-08 |
| Dependency impact | PASS | N-09, N-11 |
| Duplication | CAUTION | F-04, F-05, F-09 |
| Maintainability | CAUTION | F-07, F-08, F-10, N-01 to N-06 |
| Reference integrity | PASS | N-03, N-13 |
| Test quality and honesty | CAUTION | B-01, F-01, F-02, F-03, N-12 |

## 2. How this review was made, and its limits

Read-only on source. Instruments: `git status --short`, `git diff -- <path>`, `git diff --numstat`, `git ls-files`, `git log --all -- <path>`, text searches, and the files themselves. One targeted check was run: `npx tsc --noEmit -p tsconfig.json` in `apps/core-server` (17 s, twice). No suite, no database, no lock. No key or credential file was opened; `.data/**` and `pg.env` were not read or stat-ed by this review.

Typecheck result, second run: 5 `error TS` lines in three files, none of the tier (`src/capture/host-alias/journal.ts` 3, `src/modules/capture-config/__tests__/adopted-camera-test.db.test.ts` 1, `src/modules/capture-config/factory-scan/service.ts` 1). The set moved between the two runs (the first also named `packages/shared/src/api/installation-acceptance.ts`): other rows are in flight. A filter for the tier's files (`cli/`, `test/cli`, `production-key`, `host-key`, `signer`, `capture/boot`, `fence/boot-key`, `password-policy`, `biometric/store`, `host-command-unit`, `audit-details`) returned nothing.

Read in full: the five files under `cli/` of the tier, `host-key.ts`, `fence/boot-key.ts`, both password-policy files, `test/support/host-command-unit.ts`, `one-load.test.ts`, `production-key.test.ts`, migrations 0019 and 0020. Read as diffs: `boot/index.ts`, `audit-details.ts`, `fence.db.test.ts`, `count-only.mjs`, `signer/index.ts`, `signer/types.ts`, `signing.ts`, `biometric/store.ts`, `identity/index.ts`, `package.json`, `migrations.ts`. Read in part (rig, the cases named in the brief, case titles): `operator-set-password.test.ts`, `operator-set-password.db.test.ts`, `secret-prompt.test.ts`, `host-command-unit.db.test.ts`, the two password-policy tests, the signer tests. NOT read: `production-key-proof.db.test.ts` beyond its case titles, `count-only.test.mjs`, `writers.test.ts`, the snapshots of the migrations. Security was not re-reviewed (row 221); where a finding touches it, it is named for that row.

`CS` = `apps/core-server`, `SH` = `packages/shared`. Line numbers are of the working tree at 2026-10-13 13:08.

## 3. Blocking finding

### B-01 - the session identity check of `operator:set-password` has no refusing test (row 215)

- **Where.** `CS/cli/operator-set-password-command.ts:396-399`: after the pool opens, the command reads `SESSION_IDENTITY` and refuses `ROLE_NOT_RUNTIME` unless the session is `dems_app`, not a superuser, on the database named on the command line.
- **Evidence.** The pool double answers the passing row in every unit case (`CS/test/cli/operator-set-password.test.ts:125`); the only assertion on the statement is that it is SENT first (`:539`). A search of both test files for `ROLE_NOT_RUNTIME` and `superuser` finds no expectation; every database case opens the pool as the runtime role (`operator-set-password.db.test.ts:149`, `:354`, `:381`). Deleting the `if` leaves every test green.
- **Why it matters.** SX-03 is rank 1 (C44): "the runtime database role, not the owner". The connection FILE check is tested (`CONNECTION_NOT_RUNTIME`, `operator-set-password.test.ts:357`), but the file states a name; the session check is the only place that sees what the database actually granted (a `dems_app` that was made superuser, a connection that landed elsewhere). `implementation/215_x2_set_password_command.md:135` records "SX-03 done: role, superuser flag and database re-read from the session". The read is there; that it REFUSES is unproven.
- **Smallest fix (test only, row 215).** In the existing describe "refused before the first prompt" of `operator-set-password.test.ts`: give `World` an optional identity row and add one case with three rows - another role, `superuser: true`, another database. Each expects exit 1, `REFUSED (ROLE_NOT_RUNTIME)`, no prompt, no question, `wrote(sent) === false`. About fifteen lines; no product line changes.

## 4. Follow-ups

Ranked. Each names its producing row and the smallest fix.

| # | Row | Where | What, and why it matters | Smallest fix |
|---|---|---|---|---|
| F-01 | 211 | `CS/src/capture/boot/index.ts:285-291` (`signingKeyQuestionsOf`), `:443` (the spread); `CS/src/capture/boot/__tests__/one-load.test.ts` | The one-load property (SX-16 second half) is proven on `storedSigningKeyReaders` only. No test names `signingKeyQuestionsOf` (search: 0 hits outside the file). If line 443 went back to the two separate functions, every test stays green - `boot.test.ts` passes with two loads as well. Row 211's record says the mount was not driven; C64 states "share ONE load per boot run" as a fact of the mount | A source pin beside the one at `CS/src/sealing/__tests__/active-key-call-sites.test.ts:219`: the step's dependency object holds `...signingKeyQuestionsOf(mount,` exactly once, and the mount names `storedSigningKeyProblem` / `storedSigningKeyIsDevelopment` nowhere else |
| F-02 | 206 | `CS/cli/production-key-command.ts:438-442`, `:445-454`, `:463`; `CS/src/sealing/__tests__/production-key.test.ts` | Branches of the key command with no test: the R-X1-3 re-read of what was written (`STORE_NOT_AS_WRITTEN`) - deleting lines 445-454 leaves the tests green, because case 1 asserts the modes itself; the provisioning failure (`FAILED, <code>`); `SUBJECT_MISMATCH`; and nine directory codes (`ANCESTOR_OWNER`, `ANCESTOR_NOT_FOUND`, `ANCESTOR_NOT_A_DIRECTORY`, `DATA_DIR_NOT_A_DIRECTORY`, `SIGNER_OWNER`, `SIGNER_NOT_A_DIRECTORY`, `HANDOVER_OWNER`, `HANDOVER_WRITABLE`, `HANDOVER_NOT_A_DIRECTORY`). The comment at `production-key.test.ts:357` lists "a file" among its cases; no such case follows | Through the existing `inspect` port: one case that answers another mode for the key file after the word (expects `STORE_NOT_AS_WRITTEN`, files left); one table over the nine codes with stated facts. Correct the comment at `:357` or add the case |
| F-03 | 215 | `CS/cli/operator-set-password-command.ts:400-403`, `:434-437`, `:445-449`, `:470-475`, `:532-535`, `:610-613` | Refusals of the password command with no test: `DATABASE_UNREACHABLE`, `OPERATORS_UNREADABLE`, `COUNT_UNREADABLE`, `REPEAT_CHECK_UNAVAILABLE`, the failure of the hasher or the policy inside the attempt loop, `DEMO_PASSWORD_REMAINS`. Each is a line that says what was and was not committed; an untested "nothing was changed" sentence is a claim | Four cases on the existing pool double (a statement that rejects at each step; a hasher that rejects at operator 2). State in the file whether `DEMO_PASSWORD_REMAINS` can be reached at all; if not, remove the branch |
| F-04 | 201, 209 | `CS/src/core/audit-details.ts:236`, `:685-688`; `CS/src/capture/fence/boot-key.ts:53-56`; `CS/src/db/schema/checks.ts:44`; `CS/src/capture/signer/host-key.ts:76` | The form of the two `SYSTEM_BOOT` members is stated twice, and the copy in `audit-details.ts` (`SYSTEM_BOOT_SIGNING_DETAIL_RULES`) has NO product consumer: only `writers.test.ts` and `fence.test.ts` import it. The product enforces `MEMBER_FORM` of the fence. The two are held equal by a test on sample values, not by construction. "What is a key id" now has four statements, one of them narrower (`host-key.ts:76`). The same holds for `SERVER_AUDIT_FIXED_SEVERITY`: stated, not enforced by the writer; and `OPERATOR_PASSWORD_SET_METHODS` is used by tests only (the command writes the literal) | The open request of rows 201 and 209: one export line in `CS/src/core/index.ts`, then `boot-key.ts` imports the rule and drops `MEMBER_FORM`; the two lines in `audit-writer.ts` that enforce the fixed severity and the two forms (admitting null). Until the writer enforces them, say in `audit-details.ts` that the rule is a statement |
| F-05 | 206, 215, 215b (and 226, noted) | `CS/cli/production-key-command.ts:356-358`, `:156-161`, `:178-185`, `:225`, `:445-450`; `CS/cli/operator-set-password-command.ts:290-312`; `CS/cli/production-key.ts:28-44`; `CS/cli/operator-set.ts:45-63` | Duplication across the commands. (a) `--data-dir`: three identical parsing lines (key, rotate, mark) and a FOURTH rule in the password command - the key command answers usage for `<dir>/` or `<dir>/../x`, the password command accepts and normalises it. Two commands of one installer procedure disagree on the same option. (b) The echoed `ask` over `readline` is written twice, word for word, with two different terminal tests (`process.stdin.isTTY`, `isatty(0)`). (c) The calling-user expression is written three times. (d) The mode constants live in four files, the names of the store's files in three. (e) The generic `inspectEntry` / `EntryFacts` live inside the key command's file and are imported from there by the password command and by row 226. (f) Refusal and usage lines have two formats (`REFUSED, CODE` and `REFUSED (CODE) text`) | One file `CS/cli/host-entry.ts`: `dataDirArgumentOf`, `askEchoedLine`, `callingUid`, `inspectEntry`, `EntryFacts`, one refusal-line builder; the signer exports the names of a key id's entries. Decide ONE rule for a `--data-dir` that is not in its shortest form and apply it to all four commands |
| F-06 | 206 (C54 (1)), 215 | `CS/test/static/scan.ts:97-99`; `CS/vitest.config.ts:26`; `CS/cli/operator-set-password-command.ts:77-90`; `CS/cli/production-key-command.ts:65` | `cli/` now holds nine files (about 2,300 lines) that write credentials and keys, and no static rule looks at it: `isProductionSource` is `src/**`, coverage is `src/**/*.ts`. The commands import the inside of closed units directly (`core/audit-details`, `core/clock`, `core/pipeline`, `core/types`, `engine/rehydrate`, `modules/identity/session-store`, `plugins/config/connection-file`, `sealing/signing`). Each command's own test holds a few properties by source text; the rules of the server (closed unit through its index, no network, no log of a secret) hold nothing here. Only the typecheck notices a change inside a closed unit | A static test file for `cli/`: every import of `../src/...` is on a named list with its reason; no `process.env` value, no cryptography import outside a named file, no audit table name; and `cli/**` added to the coverage `include` |
| F-07 | 212, V3 (C53 (2), C67 (2)) | `CS/src/modules/identity/password-policy.ts:64-89`; `CS/src/modules/identity/__tests__/static.test.ts:84-96` | The per-run key and HMAC use Web Crypto (`globalThis.crypto`). The reason given in row 212 - platform neutrality, so that the file moves to the shared package unchanged - ended with V3: the file stays on the server. What remains is that the two static patterns do not see Web Crypto. See section 5.4 for the ruling | In `identity/__tests__/static.test.ts`: extend the cryptography pattern to `globalThis.crypto`, `subtle` and `getRandomValues`, and name `password-policy.ts` as the second file with its one purpose. This is the named entry C67 (2) puts to row 221 |
| F-08 | 215 (C64, SR-9) | `CS/cli/operator-set.ts:14-17`, `:71`; `CS/package.json` script `operator:set-password`; `CS/test/static/credentials.test.ts:96`; `CS/test/cli/operator-set-password.test.ts:346` | The entry is named `operator-set.ts` because the rule tests the script's command text for `passw`. The logic file is `operator-set-password-command.ts`, so the pair breaks the naming of the other three commands (`X.ts` / `X-command.ts`). See section 5.4 | An exact-match entry for `tsx cli/operator-set-password.ts` in the rule (its owner's file), the file renamed back, the pin at `operator-set-password.test.ts:346` and the `invoked` expression moved with it |
| F-09 | 214 | `CS/test/support/host-command-unit.db.test.ts:133-296` | The gate probe of row 214 writes its own unit by hand (type `USER_DISABLED`, its own statements) and asserts that it worked. It was the right proof before the command existed. Since rows 215 and 216 the command itself is proven on a database, and steps 1 to 3 of the probe pass with the command deleted. Its two cases that nothing else holds: the negative control (a row inserted by plain SQL is accepted by the database and named by the Core's verification) and the grants of the runtime role | By the user's consolidation rule (2026-10-11): keep the negative control and the grants case, move them beside the command's database tests, and retire steps 1 to 3 after a measured comparison with row 216's steps |
| F-10 | 206, 215 | `CS/cli/operator-set-password-command.ts:597`, `:406-409`, `:532-535`; `CS/cli/operator-set.ts:77-80`; `CS/cli/production-key.ts:54-57`; `CS/cli/production-key-command.ts:441` | Error paths. (a) `guard.remember(accepted).catch(() => undefined)`: when remembering fails, the repeat check of the run (SX-13) silently loses a value and the next operator can be given the same password without a refusal. (b) Both entries end an unexpected throw with one fixed line and nothing else - no code, and the password entry does not use the error log it holds. (c) `UNIT_FAILED` is also printed for a failure of the hasher or the policy, where no unit ran. (d) A read failure of the schema version is reported as "apply the migrations". (e) A provisioning failure returns `refusal: null` with code 1, which the type's comment does not allow | (a) on a rejected `remember`: one line and stop the walk, as the guard's own comment says a broken comparer must never read as "not found". (b) print `error.name` held to a closed pattern, and append to the error log in the password entry. (c), (d) two codes of their own. (e) one more member `PROVISION_FAILED` |
| F-11 | 210 (C54 (4)) | `CS/src/capture/signer/host-key.ts:135`, `:169`, `:395-409` | `KeyStoreOptions.ownerUid` exists for a test (stated). The record says the number "can only say whom the store must belong to"; that is not exact: a negative number switches the owner check off (`ownerUid >= 0 &&`). No product source passes it today (search: none), and no rule holds that - the call-site rule of row 225 pins `keyId` only | Add `ownerUid` to the call-site rule of `active-key-call-sites.test.ts`, or refuse a negative number that a caller hands in (only `processUid()` may answer -1). Named for row 221 |

## 5. The six questions of the brief

### 5.1 Edit-only departures and whole-file rewrites

| Declared departure | Checked how | Result |
|---|---|---|
| Row 206 (agent R9): one scripted replace on its own new test; `mv` of its new logic file from `src/sealing/` to `cli/` | `git ls-files apps/core-server/cli apps/core-server/src/sealing` names only `cli/verify-export.ts` of these; `git log --all -- apps/core-server/src/sealing/production-key.ts` is empty | Both files were never tracked. Nothing of an existing file was touched |
| Row 215 (agent X1): `rm cli/operator-set-password.ts` | `git log --all -- apps/core-server/cli/operator-set-password.ts` is empty; `git status --short` holds 214 ` M` and 191 `??` entries and no deleted or renamed path | Never tracked. Nothing lost |
| Row 210: `host-key.ts` 345 added, 41 removed | every removed line read (`git diff ... | grep '^-'`) | Each is the old reader, writer or `existsSync` call, replaced by `readStored`, `writeNew`, `entryExists`. No function and no export was dropped |
| Tracked tests of the tier | `git diff --numstat`: `signer.test.ts` 158 / 0; `fence.test.ts` 422 / 2; `audit-details.test.ts` 17 / 4; `count-only.test.mjs` 182 / 4 | The removed lines are import lines and count pins moved by their delta. No case was removed |

### 5.2 Tests: fixtures, removed features, edited expectations

- **Would pass with the feature removed:** B-01 (session identity), F-01 (the mount's one load), F-02 (the R-X1-3 re-read), F-09 (the probe, with the command removed). No other was found in what was read.
- **Row 209, "five expectations re-stated"** (`fence.db.test.ts`): each went from `{ captureOperation }` to `bootRowOf(operation)`, an exact equality whose fingerprint the test computes itself from the bytes of the fixture's certificate file, not through the product's reader. This is a strengthening, not a fit.
- **Row 215b, two edits of the rig** (`operator-set-password.test.ts`: `uid: () => 1000` to the real user; `invokerUid: 1000` to the same): forced by the new owner check, because the temporary files belong to the real user. Honest; stated in its record.
- **Assert on their own fixture:** F-09. Smaller: the order "Supervisor first" in the unit rig is the double's own ordering (`operator-set-password.test.ts:140-143`); the real statement is held by the database cases. The case "is the shared policy for every input" of the identity test compares a wrapper with the function it wraps; the case after it holds the behaviour (N-12).
- **Stated doubles that are sound:** the directories above the test root in row 206; the in-memory credential of row 215b's database case; the prompt in every case.

### 5.3 Duplication that should be one function

| Asked | Finding |
|---|---|
| The two forms of the `SYSTEM_BOOT` members in `fence/boot-key.ts` and `audit-details.ts` | F-04. One of the two is dead in the product |
| Key-file checks in `host-key.ts` against the connection-file checks of row 215b | Not one function, and rightly not: the signer asks an OPEN HANDLE (`readStored`, `host-key.ts:155-188`) and is the one file of the capture unit that may import the file system; row 215b asks the NAME (`lstat`) and then lets `readConnectionFile` open it by name, which follows a link (`CS/src/plugins/config/connection-file.ts:37`, `:56`). They are two strengths of one rule. The duplication worth ending is inside `cli/` (F-05 (e)). The window between check and open is stated by row 215b and belongs to row 221 |
| The commands' argument parsing and confirmation text | F-05 (a), (b), (f) |

### 5.4 Static rules kept green by a name or an API

| Place | What was chosen | Ruling |
|---|---|---|
| C53 (2), C67 (2): the run key on Web Crypto in the identity folder | an API the patterns of rule 2 and SR-61 do not see | **The code's substance is right; the rule is wrong, by blindness.** SR-61 forbids a signing secret and a pepper for stored hashes; a key that lives for one run and compares in memory is neither. Rule 2 ("one random source") is breached in its meaning and passes in its letter - and so would any later file that uses Web Crypto. The reason first given for the API has ended (F-07). Fix the rule: see Web Crypto, name the file |
| C64, SR-9: `cli/operator-set.ts` | a file name without the letters the rule refuses | **The code is right; the rule is wrong, by width.** Its purpose is that no script line carries a secret; a path is not one. The avoided name costs readability and breaks the pair naming (F-08). Fix the rule with an exact entry |
| C54 (1): the commands in `cli/` | a folder that no rule scans | **The placement is right** (a command is not the server). **The rule set is wrong by omission**: nothing replaced what `src/` would have held (F-06) |
| Row 211: the predicate as `demoPasswordHashSetsAmong([row]) === 1` | shaped so that G-R16 keeps its two lines | **Both right.** The shape serves the rule's meaning: the published password meets the verifier in one statement. A boolean by way of a count is a small price |
| Row 209: the `catch` in `boot-key.ts`, not in `fence/index.ts` | G-R14 allows no error path in a file that builds fake sources | **Both right.** `boot-key.ts` builds no source |
| Row 209 DD-4: the forms written a second time | the core's index does not export the rule | **The rule is right; the code is the workaround.** The fix is the export line (F-04) |
| Row 213 DD-6: the attended check has no npm script | not declared as an avoidance; a script naming `cli/secret-prompt.ts` would trip the same rule as SR-9 | Note N-12; goes with F-08's entry |

### 5.5 Dead exports, unused seams, things under `src/` only for a test (AD-08)

- `SYSTEM_BOOT_SIGNING_DETAIL_RULES`, `OPERATOR_PASSWORD_SET_METHODS` (`CS/src/core/audit-details.ts:685`, `:228`): consumers are tests only (F-04).
- `KeyStoreOptions.ownerUid`: a test seam that can switch a check off (F-11).
- `storedSigningKeyReaders(load)` (`boot/index.ts:270`) and `storedBootSigningKey(dataDir, read)` (`boot-key.ts:97`): defaulted parameters used by tests only. Neither can switch a check off, so AD-08's concern (absence fails open) does not apply; noted (N-07).
- `CS/src/capture/fence/index.ts:82` re-exports eight names of `boot-key.ts` that only `fence.test.ts` uses; `CS/src/modules/identity/index.ts:82-91` exports four names nobody imports; `SH/src/api/security-audit.ts:90-111` exports three contract examples whose only consumer is `writers.test.ts` (N-07).

### 5.6 Error paths

No message of the tier carries a value. Paths are printed on purpose in two places and nowhere else: the connection file's full path (row 215b, by its brief) and the signer and hand-over directories (public). The password command passes on a code only when it matches `^[A-Z0-9_]{1,64}$` (`operator-set-password-command.ts:323-327`), so no text of the driver or the operating system reaches a line or the error log. The signer's errors keep their existing codes, and a test holds that none names a place.

What swallows: F-10 (a), (b). Catch-alls that are deliberate and commented: `inspectEntry` (N-06), `storedBootSigningKey` (the read must not change a boot), `syncParentOf` (commented as the one failure that is not a refusal), `pool.on('error')`.

## 6. Row 211 against `git diff`, line by line

`git diff -- apps/core-server/src/capture/boot/index.ts` holds two rows' work. Row 85's (the host-facts door: the header paragraph, `HOST_NOT_SEEN`, `CaptureHostFactsError`, `provideHost`, `hostChecksOf`, `asked`, the export of `host-facts`) is not this tier's and was not judged. Row 211's hunks:

| Hunk | Before | After | Behaviour |
|---|---|---|---|
| `storedSigningKeyProblem` (`:294`) | calls `loadSoftwareSigner({ dir, now })` | calls `load({ dir, now })`, third parameter defaulted to `loadSoftwareSigner` | same; `try` and `catch` untouched |
| `storedSigningKeyIsDevelopment` (`:309`) | the same call inside `isDevelopmentKeySubject(...)` | `load(...)` in its place | same; `catch { return false; }` untouched |
| `loadedOnce`, `storedSigningKeyReaders` (`:251`, `:270`) | - | new: the first call loads, its outcome or its thrown error answers every later call | the ONE intended change: check 4b judges what check 4 loaded, with the directory and instant of the first ask |
| `signingKeyQuestionsOf` (`:285`) and the spread (`:443`) | two members, each `(mount.seam ?? stored)(dir, app.clock.now())` | the same two members built once per run; the seam of a test still wins, member by member | same for a mount with both seams, with one, or with none |
| `StoredHashSetRow` | local | exported | type only |
| `demoPasswordHashSetsAmong` (`:337`) | the loop inside `storedDemoPasswordOperators` | the same loop, moved out; the verifying statement is the same text | same |
| `storedHashSetIsDemoPassword` (`:349`) | - | new: the count of one row equals 1 | new export, no caller in the boot |
| `storedDemoPasswordOperators` (`:362`) | read, loop, `return count` inside `try`; `catch { return null; }` | read, `return await demoPasswordHashSetsAmong(rows, verify)` inside the same `try`; the catch and its comment untouched | same, a throwing verifier still answers null |
| `SELECT_STORED_HASH_SETS` | - | not in the diff | byte-identical |

The claim holds. Three things to know: the mount's wiring is not pinned by a test (F-01); the loaded signer is now held by the closure for the length of the step's run instead of being dropped at once (N-09); the comment "loaded and dropped" at `:293` no longer describes the default path (N-03).

## 7. Notes

| # | Row | Note |
|---|---|---|
| N-01 | 215 | `operator-set-password-command.ts:576` `fixedSeverityOf(...) ?? 'WARNING'` restates the constant as a fallback; `:580` writes `'HOST_COMMAND'` beside the exported `OPERATOR_PASSWORD_SET_METHODS` |
| N-02 | 215 | `AUDIT_MESSAGE` (`:102`) is the same text as the label in `SH/src/i18n/en/common.ts:448`, written twice; design 3.7 says the message names the operator, the built message names nobody (the details do). A departure the record does not list |
| N-03 | 211, 215b, V3 | Stale comments: `boot/index.ts:293` ("loaded and dropped"); `operator-set-password-command.ts:24` and `operator-set.ts:24` cite C66 (4), which C68 corrected; `identity/index.ts:80-81` says "until the shared package's barrel carries the module", which it does since V3 |
| N-04 | 212 | `SH/src/api/password-policy.ts:61`, `:66`: the refusal words hold `128` and `12` as text beside the constants; a changed number would leave a false sentence |
| N-05 | 215 | The check of the two CHECK constraints (`:410-415`) follows an exact schema-version check, so it cannot refuse on a migrated database; it matches the text of `pg_get_constraintdef` and holds the two constraint names as literals. Defensible under SX-12; redundant |
| N-06 | 206 | `inspectEntry` (`production-key-command.ts:178-185`) answers null for every `lstat` failure, so a permission error is reported as "not found". Fails closed; the store's exclusive create is the second line at step 4 |
| N-07 | 201, 209, 211, 212 | Test-only names, see 5.5 |
| N-08 | 211, 215 | The predicate "is this the demo password" lives in the capture boot unit because check 4c does; the password command therefore loads the capture boot graph. A layering question for a later row: the predicate belongs beside the hash wrapper, with the boot importing it (G-R16 would move with it) |
| N-09 | 211 | The private key object loaded for check 4 now lives until the boot step's dependency object is released. No material change: the sealing host keeps a signer per process anyway (C69) |
| N-10 | 210 | `loadSoftwareSigner` (`host-key.ts:489-495`) does not zero the wrap secret it was handed, while `readStored` zeroes its own buffer. For row 221 |
| N-11 | 225, 226 (outside the tier, affects it) | `SIGNER_STORE_NAMES` is bound to the first key id. On a store whose pointer names a later id and whose first-id files were removed by hand, the key command asks all three lines and then answers `FAILED, KEY_EXISTS` with "what was written is LEFT" although nothing was written. `storeEntryNames` (`host-key.ts:287-293`) answers "no entries" when the directory cannot be listed, which reads as "id not spent". For row 230 |
| N-12 | 206, 212, 213, 215 | Test quirks: `production-key.test.ts:353` accepts either of two codes for the real inspector; the tautological case of the identity policy test; the unit rig's own ordering; the attended check without a script (5.4) |
| N-13 | - | Typecheck at review time: no error in the tier (section 2) |
| N-14 | 215 | The key command refuses uid 0; the password command does not, and the audit rule admits `invokerUid` 0 (row 201 DD-4). For row 221 |

## 8. What was done well

- The commands are functions with ports and thin entries; every refusal runs before anything is made or asked, and the tests prove "nothing left behind" by a byte-level tree comparison.
- The secret sweeps have positive controls: each needle is found when planted and in the key files themselves.
- Row 216 proves "one transaction" by the database's own transaction id on the four rows, without a product seam.
- Row 209 states, in the code where the members are made, what the two members do NOT say. The compromised-key case holds it.
- Row 210 kept every existing error code and added none; the old cases run unedited.
- Rows 206, 211, 212, 215 and V3 each named their own rule avoidance. That is why section 5.4 could be written from the records.

## 9. Files reviewed

`CS/cli/production-key-command.ts`, `production-key.ts`, `operator-set-password-command.ts`, `operator-set.ts`, `secret-prompt.ts`; import lines and parsing of `rotate-key-command.ts`, `rotate-key.ts`, `mark-compromised-command.ts`, `mark-compromised.ts`, `verify-export.ts`; `CS/src/capture/signer/host-key.ts`, `index.ts`, `types.ts`; `CS/src/capture/boot/index.ts`, `__tests__/one-load.test.ts`; `CS/src/capture/fence/boot-key.ts`, `index.ts` (row 209's lines), `__tests__/fence.db.test.ts`, `fence.test.ts` (row 209's lines); `CS/src/core/audit-details.ts`; `CS/src/modules/identity/password-policy.ts`, `index.ts`, `biometric/store.ts`, `__tests__/static.test.ts`, `__tests__/password-policy.test.ts`; `SH/src/api/password-policy.ts`, `SH/test/api-password-policy.test.ts`; `CS/src/plugins/config/connection-file.ts`; `CS/src/sealing/signing.ts`, `__tests__/production-key.test.ts`; `CS/test/cli/operator-set-password.test.ts`, `operator-set-password.db.test.ts`, `secret-prompt.test.ts`; `CS/test/support/host-command-unit.ts`, `host-command-unit.db.test.ts`; `CS/test/static/scan.ts`, `credentials.test.ts`, `imports.test.ts`; `CS/src/capture/__tests__/static.test.ts` (G-R14, G-R16); `CS/src/db/migrations/0019_*.sql`, `0020_*.sql`, `CS/src/db/commands/migrations.ts`; `CS/package.json`, `CS/tsconfig.json`, `CS/vitest.config.ts`; `scripts/secret-scan/count-only.mjs`.

Documents: `masterplan/05_design_x1_x2.md`, `verification/07_security_x1_x2.md`, `decisions/decisions.md` C42, C44, C53, C54, C62, C64, C66 to C69; records `implementation/201`, `206`, `209`, `210`, `211`, `212`, `213`, `215`, `215b`, `v3_third_contract_step.md` (item 6), `207` (in part), `202` (headings), `test/208`, `214`, `216` (in part), `220` (headings).

---
*Generated: 2026-10-13*
