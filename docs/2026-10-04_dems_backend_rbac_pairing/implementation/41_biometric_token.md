---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 63
plan_row: W41
title: Biometric token (operations 7 to 9: enrolment, sign-in with a single-use rotating token, failure report)
date: 2026-10-04
agent: coder-execution (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
source_spec: masterplan/01_specs.md rev 2.2 (§4.7, §5.1 to §5.6, §7.3, §7.5, §8.2 ENG-23 to ENG-27, §13, §15); masterplan/03_database_contract.md rev 2.2 (§2.4, §4.6, §4.10, §5)
evidence_tier: 3
status: complete
---

# W41: the biometric token

All times are WIB (UTC+7) on 2026-10-04. Every command ran from `/Users/gsp-budi/Documents/DEMS`;
the session never changed into a subfolder. Database commands ran with the per-command sandbox
bypass (P10). Quoted runner output is unchanged except that the sandbox's certificate warning
lines are left out.

**No token, credential, hash or password appears in this document.** Strings of the form `bio_…`
in the tests are made-up examples of a FORM, built from one repeated letter; no test name holds
one, and the two saved test outputs hold none (`grep -cE "(bio|ses|dvc)_[A-Za-z0-9_-]{43}"` gives
0 for both).

## 1. Result

| Item | Result |
|---|---|
| Row command `DEMS_TEST_STEP=63 npm run test:db -w @dems/core-server -- src/modules/identity/biometric` | **Exit 0**: 8 files, 98 tests, 0 failed (16:51:22, section 11.1) |
| The folder's database-free tests | **Exit 0**: 3 files, 65 tests (16:51:19) |
| A valid token | Signs in with `method: BIOMETRIC`, bound to the device; the answer carries the session token and the NEXT token of the same family; the used row has `used_at`, the next one is live for 30 days from its own issue; `AUTH_SUCCESS` with `details.method: BIOMETRIC` |
| The old token again | 401 `INVALID_CREDENTIALS`; every row of the family revoked (`TOKEN_REUSE`); the open BIOMETRIC session of that device and operator ended with `TOKEN_REUSE`; `session.ended` published after the commit; `AUTH_FAILED` with `reason: TOKEN_REUSE`, `sessionsEnded: 1`. A password session of the same operator on the same device, on another device and on the web stays open; so do the same operator's BIOMETRIC session on another device and another operator's on the same device |
| Two concurrent uses of one token | 25 rounds: 25 times one 200 and one 401; one `AUTH_SUCCESS` and one `AUTH_FAILED` (`TOKEN_REUSE`, `sessionsEnded: 1`) per round. The loser is a REUSE, as AC-B-78 words it: the session the winner was just issued is ended and its next token revoked. At statement level: the second of two transactions waited 12 of 12 times and got 0 rows; 60 rounds of four free-running connections gave exactly one row each |
| No request without a valid token creates a session | 13 refusal paths, each with the session count unchanged (section 5.2) |
| A failure report | For an operator with no enrolment on that device: `AUTH_FAILED` with a null actor and the device ID; for an enrolled one: that operator. The answer is the same body for an enrolled, an unknown and no operator |
| A dump and a log capture | 21 tokens and credentials searched in 6 forms each in a dump of 171,515 characters and in a `trace` log of 154 lines: 0 found; each of the 10 issued tokens' SHA-256 is in the dump exactly once; three statements were made to fail and nothing of a statement, a parameter or a hash reached the log or an answer |
| Module gate (MODG) | The routes under `/api/v1/auth/biometric` equal registry operations 7 to 9 (both quoted, section 11.3); every documented status the module can produce has a test, and every answer validates against the contract |
| Whole `unit` project | **Exit 0**: 137 files, 3,536 tests (16:47:50) |
| Whole `db` project | **Exit 0**: 106 files, 1,520 passed, 1 skipped (16:48:29). The skipped test is the demo row's (`src/modules/demo/__tests__/reset-failures.db.test.ts:421`, `it.skip`, a row in flight) |
| Typecheck, lint of the workspace | Exit 0; exit 0 with no warning (16:47:42, 16:47:49). At the close (16:58): both exit 0 again; lint then warned in one file of another row in flight, none in this folder (section 11.6) |
| Mutation check | 115 of 115 planted defects detected (113 in the first pass, the two survivors after two test additions; section 12). Through a transform in a scratch runner configuration outside the repository: no file of the tree was ever changed (rule M15) |
| Existing files of other rows | Two lines added to `modules/identity/index.ts` (decision D78 DN-6); two lines changed in the identity row's `routes.test.ts` (controller ruling D98); section 14 |
| PostgreSQL | Never stopped or reconfigured: `.locks/postgres.pid` is 19121, postmaster start 07:14:26, as before. No database with this row's prefix remains (section 20) |

## 2. What was written

One owned folder, `apps/core-server/src/modules/identity/biometric/`: 8 production files (1,110
lines) and 11 test files with one test-support file (4,145 lines), by `wc -l`.

| File | Lines | Content |
|---|--:|---|
| `index.ts` | 46 | What the folder exports: `registerBiometricRoutes`, `revokeBiometricTokens`, the labels, the token constants |
| `routes.ts` | 122 | Operations 7 to 9, built with `routeOfOperation` from their registry entries; the two headers of API-7 |
| `enrolment.ts` | 106 | Operation 7: two units (`identity.biometric.enrol`, `identity.biometric.disable`); what a refused enrolment answers |
| `sign-in.ts` | 277 | Operation 8: one unit `identity.biometric.signIn`; `refusalOfToken` (why a failed claim is refused) |
| `failure.ts` | 94 | Operation 9: one unit `identity.biometric.failure` |
| `store.ts` | 287 | Every SQL statement of the folder: 10 statements as constant texts with bind parameters; `revokeBiometricTokens` |
| `activity.ts` | 138 | The audit rows: `BIOMETRIC_ENROLLMENT_CHANGED`, and the identity module's three sign-in builders called with the method `BIOMETRIC` |
| `tokens.ts` | 40 | Token generation (CSPRNG), its SHA-256, the family ID, the lifetime |

Tests: section 13. Outside the folder (section 14): two lines added to
`apps/core-server/src/modules/identity/index.ts`; two lines changed in
`apps/core-server/src/modules/identity/__tests__/routes.test.ts`. Documents: this file, the
progress file, and eight assets under `implementation/assets/41_*`.

Not written: `app.ts`, `index.ts`, `config.ts`, any `package.json`, the contract, the schema, a
migration, the mapping, the seed, `src/core/**`, `src/plugins/**`, any other module, any other
file of `modules/identity`. No package was installed.

## 3. The three sequences, statement by statement

The timelines are printed by `sequence.db.test.ts`, whose pool records every statement on the pool
("pool") and on a unit's connection ("unit"); the names are the constants of `store.ts`, of the
identity module's `session-store.ts` and of the pairing module's `store.ts`. Saved in
`implementation/assets/41_test_db_verbose.txt`. "Round trips" counts every statement that reached
the database, the unit's own opening statements (the chain lock, the statement limits) included.

### 3.1 Operation 8 `signInWithBiometric`: ONE unit

**How it differs from the password sign-in, and why timing still tells nothing.** The password
sign-in is two units with the Argon2id derivation between them, because a derivation takes far
longer than a tick and must not hold the pipeline (ENG-26). A token is not derived: it is looked
up. The SHA-256 of whatever was sent is computed before the unit (microseconds, the same work
for every value), and the statement that FINDS the token is the statement that USES it. So
nothing has to run outside the pipeline, the attempt, the claim and the session are one unit, and
no window exists between "verified" and "issued".

Timing: the token is 256 random bits. It is never compared byte by byte in this process (a static
test: no `===`, no `.equals`, no `timingSafeEqual` on a token or a hash); it is hashed, and the
hash is an equality probe on a unique index, so no prefix of a guess can be confirmed. A value
that matches no row, a token of another device, a revoked and an expired one run exactly the same
two statements (the test asserts that the five timelines are equal). A reuse runs two statements
more; that tells the presenter only what the presenter holds already: that this value once was a
token.

**A success** (the device credential, no session presented), 14 round trips:

```
pool  FIND_DEVICE_BY_CREDENTIAL        stage 4: who the credential of the request is (the pairing module's)
lockout.take                           ONE ATTEMPT IS TAKEN from the device's counter, before anything is read (ENG-24). Memory state
unit  BEGIN                            unit `identity.biometric.signIn` (then the chain lock and the statement limits)
unit  CLAIM_TOKEN                      THE CONSUMING COMPARE-AND-SET (AT-C4): UPDATE … SET used_at = $2 WHERE token_hash = $1 AND device_id = $3
                                       AND used_at IS NULL AND revoked_at IS NULL AND expires_at > $2 RETURNING id, family_id, operator_id. One row: this request owns the use
unit  READ_DEVICE_STATE                the device is still PAIRED (the pairing module's reader, on this unit's transaction; decision D93)
unit  MARK_SIGNED_IN                   AT-C1: UPDATE operators … WHERE id = $1 AND enabled RETURNING …; no row = disabled
unit  READ_ROLE_PERMISSIONS
unit  INSERT_TOKEN                     the next token of the family: the SHA-256 of a new token, expires 30 days from now
unit  INSERT_SESSION                   method BIOMETRIC, bound to the device; absolute limit = now + 8 h
unit  INSERT audit_log AUTH_SUCCESS
unit  event number
unit  INSERT events AUTH_LOGIN
unit  COMMIT
lockout.succeed                        after the commit: the device's count and lock are cleared
```

With a valid session presented (ID-6), stage 4 is `pool FIND_SESSION_BY_TRANSPORT.BEARER`,
`pool FIND_DEVICE`, and the unit adds `unit END_SESSION` (reason `ROTATED`, compare-and-set)
between `READ_ROLE_PERMISSIONS` and `INSERT_TOKEN`; the row then says `replaced: true` and
`session.ended` is published after the commit.

**A token that is not accepted** (unknown, another device's, revoked, expired, or a value that
has not the form: the same, step for step), 10 round trips:

```
pool  FIND_DEVICE_BY_CREDENTIAL
lockout.take
unit  BEGIN
unit  CLAIM_TOKEN                      no row
unit  READ_TOKEN_STATE                 "no row: read why" (AT-C4): SELECT … WHERE token_hash = $1. It decides no use: the claim did
lockout.fail                           the failure is counted; the fifth is the locking one
denialBudget.consume                   BEFORE the row; with no place left: no row, 429 after the unit
unit  INSERT audit_log AUTH_FAILED
unit  event number
unit  INSERT events AUTH_FAILED
unit  COMMIT
```

**A token that was used before (a REUSE)**, 12 round trips: the same, with two statements between
the read and the count, all in the one unit:

```
unit  READ_TOKEN_STATE                 `used_at` is set
unit  REVOKE_TOKENS.FAMILY             UPDATE … SET revoked_at, revoke_reason = 'TOKEN_REUSE' WHERE family_id = $3 AND revoked_at IS NULL RETURNING id
unit  END_BIOMETRIC_SESSIONS           through `app.sessionRegistry.endBiometricSessions(unit, tokenDevice, tokenOperator)` (the identity module's statement)
lockout.fail
denialBudget.consume
unit  INSERT audit_log AUTH_FAILED     details: reason TOKEN_REUSE, sessionsEnded
unit  event number
unit  INSERT events AUTH_FAILED
unit  COMMIT
(after the commit)                     app.publish({ kind: 'session.ended', sessionIds, reason: 'TOKEN_REUSE' }), only when a session was ended
```

**An attempt during the lock**, 8 round trips: no statement names a token.

```
pool  FIND_DEVICE_BY_CREDENTIAL
lockout.take                           the device is locked: nothing is looked up
denialBudget.consume
unit  BEGIN
unit  INSERT audit_log AUTH_LOCKED     the row names the device and nobody else
unit  event number
unit  INSERT events AUTH_LOCKED
unit  COMMIT
```

**A claimed token that signs nobody in** (its operator is disabled while the token is live, or
its device stopped being PAIRED between stage 4 and the unit): `CLAIM_TOKEN` (one row),
`READ_DEVICE_STATE`, `MARK_SIGNED_IN` (no row), `REVOKE_TOKENS.FAMILY` (reason `USER_DISABLED`,
or `DEVICE_REVOKED` / `DEVICE_UNPAIRED`), then counted and audited as above. The token stays
used.

| Point | How it is met |
|---|---|
| The attempt is taken BEFORE the verification (ENG-24, AT-4, AT-6) | `lockout.take` is the first step of the unit's work, before its first statement. 20 concurrent refused tokens: 5 are looked up, 15 find the device locked |
| The transition is one compare-and-set whose row count decides (ENG-25, AT-3, AT-C4) | `CLAIM_TOKEN`; it is the only statement that sets `used_at` (a static test), and the only place where a token is used |
| One unit, one transaction (ENG-23, AT-1) | The claim, the next token, the session and `AUTH_SUCCESS`; or the claim's failure, the family, the sessions and `AUTH_FAILED`: they commit or roll back together. A statement that failed after the claim (made to fail in the secret-scan journey) left the token live |
| The same checks as the specification lists (§5.6 step 4) | Not expired, same device: in the claim's WHERE. Device PAIRED, operator enabled: the two statements after it, in the same transaction |
| One answer for every failure | 401 `INVALID_CREDENTIALS`, "Biometric sign-in was not accepted. Sign in with the password.", `details.attemptsRemaining` |
| One audit row per attempt | `AUTH_SUCCESS`, `AUTH_FAILED` or `AUTH_LOCKED`, each with its event, as a password attempt writes them |

### 3.2 Operation 7 `setBiometricEnrollment`

**On**, 9 round trips, unit `identity.biometric.enrol`:

```
pool  FIND_SESSION_BY_TRANSPORT.BEARER   stage 4
pool  FIND_DEVICE                        stage 4
unit  BEGIN
unit  REVOKE_TOKENS.ENROLMENT            whatever the operator had on this device ends (reason REENROLLED): at most one token of a pair is usable
unit  ENROL_TOKEN                        THE ISSUE IS ONE STATEMENT: INSERT … SELECT $1, $2, s.device_id, s.operator_id, $4, $5 FROM auth_sessions s JOIN operators o … JOIN paired_devices d …
                                         WHERE s.id = $3 AND s.ended_at IS NULL AND s.method = 'PASSWORD' AND o.enabled AND d.state = 'PAIRED' RETURNING …
unit  INSERT audit_log BIOMETRIC_ENROLLMENT_CHANGED     details: enabled true, deviceId. No event (spec §13.1)
unit  COMMIT
```

The session that an enrolment needs ("issued only inside a password session on that device",
SR-36) is the WHERE of the issuing statement, not a check before it: its row count decides. The
device and the operator of the token are read from that session row, never from the request.

**On, refused** (for example in a session that was created with a token), 9 round trips: the same
two statements, then `unit READ_ENROLMENT_SESSION` (why), then `unit ROLLBACK`. The throw rolls
the unit back, the revocation of statement 1 included: the enrolment that stood before stands
again (tested: the token of the rotation is still live and signs in).

**Off**, 8 round trips, unit `identity.biometric.disable`: `unit REVOKE_TOKENS.ENROLMENT` (reason
`DISABLED`, every row of the pair that was not revoked, used rows included), the row
(`enabled: false`), `COMMIT`. Off again: the one statement, no row.

### 3.3 Operation 9 `reportBiometricFailure`: one unit

9 round trips, unit `identity.biometric.failure`; an enrolled operator, one who is not, one that
does not exist and no operator give the same timeline (the test asserts it):

```
pool  FIND_DEVICE_BY_CREDENTIAL
lockout.take                           counted against the device that reports
lockout.fail                           a taken attempt is a failure at once: there is nothing to verify
unit  BEGIN
unit  FIND_ENROLMENT                   SELECT 1 … WHERE device_id = $1 AND operator_id = $2 AND revoked_at IS NULL LIMIT 1 (an ID that no operator has when the report names nobody)
denialBudget.consume
unit  INSERT audit_log AUTH_FAILED     actor: the named operator only when the lookup found a row; else null
unit  event number
unit  INSERT events AUTH_FAILED
unit  COMMIT
```

While the device is locked: `lockout.take` (nothing is counted), the same lookup, the place in
the budget, `AUTH_LOCKED`. The answer is 200 with the lock state in both cases.

## 4. The token's life

Three columns: `used_at`, `revoked_at` (with `revoke_reason`), `expires_at`. The runtime role may
write only the first three (database contract §7.3; a test shows `42501` for an UPDATE of
`operator_id` and for a DELETE).

| State | `used_at` | `revoked_at` | Reached by | Presented by its own device | Presented by another paired device |
|---|---|---|---|---|---|
| **LIVE** | null | null, `expires_at` in the future | Enrolment in a password session (a new family); rotation (the next token of the family) | **Signs in**: becomes USED; the next token of the family is issued LIVE | 401; `AUTH_FAILED` `reason: OTHER_DEVICE`; counted on the presenting device; the token is unchanged and still good on its own device |
| **USED** | set | null | The claim of a sign-in | **REUSE**: 401; every row of the family that was not revoked is revoked (`TOKEN_REUSE`); the open BIOMETRIC sessions of the token's device and operator are ended (`TOKEN_REUSE`), published after the commit; `AUTH_FAILED` `reason: TOKEN_REUSE`, `sessionsEnded` | The same: a used token is a reuse whoever presents it. The sessions ended are those of the TOKEN's device and operator; the row and the count are the presenting device's |
| **EXPIRED** | null | null, `expires_at` reached | 30 days after its issue without a use | 401; `AUTH_FAILED` `reason: TOKEN_EXPIRED`; unchanged | `OTHER_DEVICE` |
| **REVOKED** | null | set | `enabled: false` (`DISABLED`); a new enrolment (`REENROLLED`); a reuse of an earlier token of the family (`TOKEN_REUSE`); `disableUser` (`USER_DISABLED`, the administration module); `revokeDevice`, `unpairDevice` (`DEVICE_REVOKED`, `DEVICE_UNPAIRED`, the pairing module) | 401; `AUTH_FAILED` `reason: TOKEN_REVOKED`, or `USER_DISABLED` when it was revoked with the account; unchanged | `OTHER_DEVICE` |
| **USED and REVOKED** | set | set | A family revocation that reached a used row; a claimed token whose operator or device turned out retired | **REUSE** again: 401, nothing left to revoke or end; the row says `sessionsEnded: 0` | The same |
| (no row) | | | | 401; `AUTH_FAILED` naming nobody (`knownOperator: false`), no reason | The same |

Order of the reasons when several hold (`refusalOfToken`, tested as a table): used before
everything; then another device; then revoked; then expired.

No transition leads back: a used token is never unused, a revoked one never unrevoked (every
revocation states `revoked_at IS NULL`; a second one changes no row and keeps the first time and
reason). At most one row of a device and an operator is "not used and not revoked" (the unique
index `biometric_tokens_one_live_key`); an enrolment revokes before it issues, a rotation uses
before it issues, so the index is never met by this folder's statements.

**A family** is one enrolment and what follows from it by rotation. A new enrolment of the same
operator on the same device is a new family; the earlier one is revoked whole (`REENROLLED`),
used rows included.

## 5. Operations 7 to 9: recipe, statuses, tests

All three are **server-native** (rule M5): no simulator action is hosted. Each state change is one
unit of the pipeline; the two POST headers of API-7 are set from `app.engine` after the unit
committed. Who may call is stage 6's alone (rule M3): no route has a hook, and a static test of
the folder asserts that no file checks a permission, compares a role or reads the kind of the
principal.

Tests: S = `sign-in.db.test.ts`, E = `enrolment.db.test.ts`, F = `failure.db.test.ts`,
C = `concurrency.db.test.ts`, R = `routes.test.ts`, X = `secrets.db.test.ts`. Every answer named
below is validated with `validateCoreApiResponse` in its test.

### 5.1 Operation 7 `setBiometricEnrollment` (POST `/api/v1/auth/biometric`; `AUTHENTICATED` with `DEVICE_SESSION`)

| Status | When | Decided by | Test |
|---|---|---|---|
| 200 `{ enabled: true, token, expiresAt }` | `enabled: true` in an open password session on a paired device | the unit | E "answers 200 with the token ONCE …" |
| 200 `{ enabled: false }` | `enabled: false`, enrolled or not; also in a session that was created with the token | the unit | E "revokes every token …", "turning off what is off …", "a session that was created with the token may turn it off …" |
| 400 `INVALID_JSON` | malformed JSON | stage 7 | E "a body that breaks the schema …" |
| 401 `NOT_SIGNED_IN` | no credential; a device credential without a session; a session that ended between stage 4 and the unit; an operator disabled meanwhile | stage 6; the unit (`enrolmentRefusal`) | E "no credential and a device credential without a session …", "the session ended meanwhile …", "the operator was disabled meanwhile …" |
| 403 `DEVICE_NOT_PAIRED` | a web console session | stage 6 | E; R "an operator on the web console …" |
| 403 `DEVICE_NOT_PAIRED`, `details.reason: PASSWORD_SESSION_REQUIRED` | `enabled: true` in a session that was created with a token | the unit: the issuing statement returned no row | E "enabled: true in a session that was created with a token …" |
| 403 `DEVICE_REVOKED` | a retired device (stage 6, with its `ACCESS_DENIED` row); a device that stopped being PAIRED between stage 4 and the unit (the unit, no row) | stage 6; the unit | E "a session of a device that was revoked …", "… the device stopped being PAIRED meanwhile …" |
| 422 `INVALID_INPUT` | `enabled` missing or no boolean | stage 7 | E; R |
| 5xx | a statement of the unit failed: nothing is stored, no token is handed out | the core | X (the insert of an enrolment made to fail) |

### 5.2 Operation 8 `signInWithBiometric` (POST `/api/v1/auth/biometric/sign-in`; `DEVICE`)

| Status | When | Test |
|---|---|---|
| 200 `SignInResponse` with `sessionToken` and `biometricToken` | a live token of this device | S "answers 200 with a session bound to the device …", "every use hands out the next token …" |
| 400 `INVALID_JSON` | malformed JSON, or JSON that is no object | S; R |
| 401 `INVALID_CREDENTIALS` | every token that is not accepted (below) | S, C |
| 401 `NOT_SIGNED_IN` | no credential; an unknown device credential; the token itself sent as the bearer value | S "a caller that is no paired device …" |
| 403 `DEVICE_NOT_PAIRED` | a web console session | S; R |
| 403 `DEVICE_REVOKED` | a retired device (stage 6, one `ACCESS_DENIED` row, no attempt taken) | S "a retired device never reaches the handler …" |
| 422 `INVALID_INPUT` | `token` missing, empty, no text, longer than 256 characters, with U+0000 or an unpaired surrogate | S "a body that breaks the schema …"; R |
| 423 `LOCKED` | an attempt during the lock (`AUTH_LOCKED`); the failure that locks the device (`AUTH_FAILED` with `lockedUntil`) | S "five refused tokens …", "during the lock a VALID token is not looked at …" |
| 429 `RATE_LIMITED` | the denial budget of the caller's key has no place left (stage 5; in a burst, the unit) | C "20 concurrent refused tokens …", "SR-71: 25 at once …" |
| 5xx | a statement of the unit failed: the unit rolled back, the token is as it was | X (the claim and the insert of the next token made to fail) |

**No request without a valid token creates a session.** Each path below asserts that the number
of session rows and of token rows did not change, and its one row:

| Refusal path | Answer | Row | Test (S unless named) |
|---|---|---|---|
| An unknown token | 401 | `AUTH_FAILED`, actor null | "an unknown token: nobody is named" |
| A value that has not the form of a token | 401, counted like any attempt (the contract: "the form is not checked here") | the same | "a value that has not the form …" |
| The token with a space before or after it, or in another letter case | 401 | the same | "the value is taken as it was sent …" |
| A token of another device (wrong device) | 401 | `OTHER_DEVICE`, the token's operator, the presenting device | "a token of another device …" |
| A token past its 30 days | 401 at the limit; 200 one millisecond before | `TOKEN_EXPIRED` | "a token past its 30 days …" |
| A family the operator turned off; a family a new enrolment replaced (revoked family) | 401 | `TOKEN_REVOKED` | "a family the operator turned off …" |
| A disabled operator (the administration module revoked the token) | 401; still 401 after the operator is enabled again | `USER_DISABLED` | "a disabled operator …" |
| An operator disabled while the token is live | 401; the token stays used, its family is revoked, no next token, `last_sign_in_at` unchanged | `USER_DISABLED` | "an operator who is disabled while the token is still live …" |
| A device that stops being PAIRED between stage 4 and the unit | 401; the family is revoked with the device's reason | `DEVICE_NOT_PAIRED` | "a device that stops being PAIRED …" |
| A retired device (the guard's) | 403 `DEVICE_REVOKED` | one `ACCESS_DENIED`, no `AUTH_FAILED`, no attempt | "a retired device never reaches the handler …" |
| No device credential; a web console session | 401; 403 | none | "a caller that is no paired device …" |
| A malformed token (the schema's 422) | 422; 400 for malformed JSON | none, no attempt | "a body that breaks the schema …" |
| A used token (a reuse), from its own device and from another | 401 | `TOKEN_REUSE` | block "AC-B-31, AC-B-82" |
| A token during the lock | 423 | `AUTH_LOCKED`, the token untouched | "during the lock a VALID token is not looked at …" |

**"A token of another operator"** is no refusal by itself: the request names no operator, the
token does. Tested three ways: a body that names another operator, a username and a method beside
the token changes nothing (the contract's schema has the one member `token`); a token of the
technician presented with the investigator's session as the credential signs in the technician
and ends the presented session as `ROTATED` (ID-6, as decision D78 DN-7 rules for the password
sign-in); and one operator's `enabled: false` leaves another operator's enrolment on the same
device alone (E "a token is bound to ONE device and ONE operator …").

### 5.3 Operation 9 `reportBiometricFailure` (POST `/api/v1/auth/biometric/failure`; `DEVICE`)

| Status | When | Test |
|---|---|---|
| 200 `SignInStatus` | counted: the device's lock state after the count | F "an operator with no biometric token on the device …", "five reports lock the device …" |
| 200 `SignInStatus` with `locked: true` | while the device is locked: nothing is counted, `AUTH_LOCKED` (the contract documents no 423 here) | F "while the device is locked …" |
| 400, 422 | malformed JSON; `operatorId` missing or not `OPR-NNN` or null | F "a body that breaks the schema …"; R |
| 401 `NOT_SIGNED_IN` | no device credential | F "no credential …" |
| 403 `DEVICE_NOT_PAIRED`, `DEVICE_REVOKED` | a web console session; a retired device (with its `ACCESS_DENIED` row) | F the same test |
| 429 `RATE_LIMITED` | from the 21st audited refusal of the key within 60 s | F "SR-71: every report inside the denial budget …"; C "SR-71: 25 at once …" |

### 5.4 The rows

| Audit type | Event | Actor | Device | Details |
|---|---|---|---|---|
| `BIOMETRIC_ENROLLMENT_CHANGED` | none (spec §13.1) | the operator of the session | the session's device | `enabled`, `deviceId` (the closed list of the audit writer) |
| `AUTH_SUCCESS` | `AUTH_LOGIN` | the token's operator | the device | `method: BIOMETRIC`; `replaced: true` when a presented session was ended |
| `AUTH_FAILED` (a refused token) | `AUTH_FAILED` | the operator of the stored token the value matched, or null | the presenting device | `method`, `knownOperator`, `attemptsRemaining`, `lockedUntil`; `reason` (one of six codes, none for an unknown value); `sessionsEnded` for a reuse |
| `AUTH_FAILED` (a reported failure) | `AUTH_FAILED` | the named operator only where an enrolment of the device exists (SR-37) | the reporting device | `method`, `knownOperator`, `attemptsRemaining`, `lockedUntil` |
| `AUTH_LOCKED` | `AUTH_LOCKED` | operation 8: nobody (the token is not looked at); operation 9: as SR-37 | the device | `method`, `retryInMs`, `lockedUntil` |

The three sign-in types are the identity module's own builders (`signedIn`, `attemptFailed`,
`attemptLocked`), called with the method `BIOMETRIC`, so a biometric attempt reads in the trail as
a password attempt does and as the shared simulator writes it. No builder takes a token, a hash
or a family (a static test); the nine detail keys the journey of the secret scan wrote are
`attemptsRemaining`, `deviceId`, `enabled`, `knownOperator`, `lockedUntil`, `method`, `reason`,
`retryInMs`, `sessionsEnded`.

## 6. The lockout and the denial budget: the keying

| Question | Answer |
|---|---|
| Which counter | The identity module's `ConsoleLockout`, the SAME object the password sign-in counts on: `identityModule` hands it to `registerBiometricRoutes(app, { lockout })`. 5 attempts within 300 s lock a console for 60 s; a success clears the count |
| Which key | The device the credential of the request resolved to at stage 4 (`pairedDeviceOf(request)`: a DEVICE principal, or an operator's session that is bound to a device). Never a request field, never an address |
| What counts | Every token that reaches the unit (operation 8), accepted or not, takes one attempt; a refused one is a failure. Every report (operation 9) is one attempt and one failure. Three refused tokens and two wrong passwords lock the device (tested) |
| What it cannot do | **Lock another console.** A device locks itself and nothing else: another device and the web console keep their five attempts (tested from both operations). **Learn whether an operator exists or is enrolled.** The answer of operation 9 is the device's own lock state; the bodies for an enrolled operator, one who is not, one that does not exist and none are identical, and the same statement runs for all four. **Name an operator of its choosing.** The row names the operator only where `FIND_ENROLMENT` finds a token of that device and that operator that was not revoked |
| The denial budget | `AUTH_FAILED` and `AUTH_LOCKED` take a place in the budget of the caller's throttle key (`device:<id>`, or `operator:<id>` when a session was the credential) before the row is written. Whether an attempt is a refusal is known only inside the unit, so the place is taken there, and the 429 is thrown after the unit committed what it counted (the pairing row's pattern, decision D93 DV-1). 22 reports in a row: 20 rows (5 `AUTH_FAILED`, 15 `AUTH_LOCKED`), then 429 without a row |
| One exception | The row of a refusal that CHANGED what is stored (a reuse that revoked tokens or ended sessions; a claimed token that signs nobody in) is written whatever the budget says; the answer is still the budget's 429. It is the audit row of a state change (spec §5.4: a session ended with `TOKEN_REUSE` has its `AUTH_FAILED` row), as the pairing row writes `PAIRING_CODE_CLOSED` beside a `PAIRING_FAILED` that found no place. The lockout bounds it to five per window and device. A second replay, which changes nothing, is a refusal like any other: no row beyond the budget (tested both ways). Deviation DV-2 |

## 7. Concurrency: what is guaranteed, and by what

All in `concurrency.db.test.ts`, against PostgreSQL, requests issued together with `Promise.all`.

| Test | Relies on |
|---|---|
| **AC-B-78.** Two concurrent uses of one token, 25 rounds: one 200 and one 401 each; one `AUTH_SUCCESS`, one `AUTH_FAILED` (`TOKEN_REUSE`, `sessionsEnded: 1`); the winner's session row ended with `TOKEN_REUSE`, its next token revoked, `session.ended` published once | The claim is one statement whose row count decides. Whichever unit runs first gets the row; the other finds the token used. The specification's words (AC-B-78): "the other use answers 401 and is handled as a reuse". The first-issued request won 22 of 25 times in the saved run: both arrival orders occur |
| Eight concurrent uses of one token: `{200: 1, 401: 4, 423: 3}`; one session | The same; the seven losers are counted on the device, the fifth failure locks |
| A later replay (ten minutes later, the session in use): the same reuse | The specification makes no difference between the concurrent case and the later replay: a used token is a reuse. What differs is only what the reuse finds to end |
| 20 concurrent refused tokens: 5 looked up (`AUTH_FAILED` 4, 3, 2, 1, 0 attempts left), 15 `AUTH_LOCKED`; then 429 at stage 5; 60 s later the valid token that nobody looked at signs in | The attempt is taken as the first step of the unit; taking the fifth attempt locks at once (the identity module's lockout) |
| 25 at once, tokens and reports mixed: 20 rows, five 429 without a row | `app.denialBudget.consume(request)` before every refusal row |
| A revoke of the device against a sign-in, and a disable of the operator against a sign-in, each in three arrangements: the sign-in's unit first (200; the other unit then ends its session and revokes its next token); the other unit first while the sign-in is already past stage 4 (401, nothing issued); free-running pairs | Each is one unit, and the units are serial. Afterwards no session of the device (of the operator) is open and no token is live, in every arrangement |
| Two enrolments of one session at once: both 200, one live token | Each unit revokes before it issues |
| **Statement level**, two real connections of `dems_app`, each in its own READ COMMITTED transaction: the second claim WAITS (not answered after 60 ms, 12 of 12 rounds) and returns 0 rows after the first commits; after a ROLLBACK of the first it returns the row. Free-running: 60 rounds of four connections, exactly one row per round | PostgreSQL evaluates the WHERE again on the committed row after the row lock is released. "The database does not rely on the pipeline being serial" (contract §5.6) |
| The claim states its whole predicate: another device, the limit of 30 days itself, a used and a revoked token give no row and change nothing | The text of `CLAIM_TOKEN` |

## 8. What the mobile sign-in row (W56) can rely on

### 8.1 What the app stores, and when

| Moment | The app |
|---|---|
| Operation 7 `{ enabled: true }` answered 200 | Stores `token` (it is returned ONCE; the server holds only its SHA-256) and the marker with `expiresAt` and the operator of the session. An earlier token of this operator on this device is dead from this moment |
| Operation 8 answered 200 | **Replaces the stored token with `biometricToken` at once.** The token that was sent is used up; presenting it again is a reuse that ends the very session this answer opened. `sessionToken` goes to memory. The new token expires 30 days after `session.issuedAt` (the answer carries no expiry for it: CONTRACT-GAP-W41-1) |
| The write of the rotated token fails (MB-6) | Deletes both items. The session stays. The server still holds the next token as live; it is harmless (nobody has it) and the next enrolment revokes it |
| Operation 7 `{ enabled: false }` answered 200 | Deletes both items. Allowed in a session that was created with the token; it does not end that session |
| `session.ended` with `TOKEN_REUSE` | Signs out, deletes the token and the marker, keeps the device credential (AC-C-108). The family is revoked on the server |
| The device is revoked or unpaired; the operator is disabled | The server revoked the live token in the same unit (pairing and administration modules). Nothing to call here |

### 8.2 What each answer of operation 8 means for the stored token

The app sends the token in the body and the **device credential** as the bearer value, tells the
answers apart by `error.code`, and never sends the same token twice at once.

| Answer | The token that was sent | The app |
|---|---|---|
| 200 | Used up. `biometricToken` is the one for the next time | Stores the new one |
| 401 `INVALID_CREDENTIALS` | Dead for good, whatever the cause (unknown, expired, revoked, used before, another device's, the operator disabled). The server tells no cause | Deletes the token and the marker; the operator signs in with the password and enrols again (MB-3) |
| 401 `NOT_SIGNED_IN` | Not looked at: the credential of the REQUEST did not resolve (no device credential, or a session token that has ended) | Keeps the token; sends the device credential |
| 403 `DEVICE_REVOKED` | Revoked by the server with the device | The pairing flow: deletes everything |
| 422, 400 | Not looked at, no attempt taken | A client defect |
| 423 `LOCKED` | Not known. During the lock the token was not looked at and is still good. The failure that LOCKED the device was a refused token: that one is dead, and its answer is 423 too (decision D78 DN-3) | Keeps the token, waits `details.retryInMs`; a dead one answers 401 at the next attempt |
| 429 | From stage 5: not looked at. From the denial budget inside the unit (only in a burst of requests): refused | Keeps the token, waits `retry-after`; a dead one answers 401 then |
| 503 `NOT_READY` | Not used: the unit did not commit. The attempt may have been counted on the device (finding F-2) | Keeps the token |
| 5xx, or no answer at all | Not known. A unit that failed rolled back (the token is as it was). If the unit COMMITTED and the answer was lost, the token is used: the next attempt with it is a reuse (401, the family revoked, the session of the lost answer ended) | Keeps the token and tries once; on 401 it deletes it. Finding F-1 |

### 8.3 The rest

| Point | Fact |
|---|---|
| Enrolment needs a password session | `enabled: true` in a session created with a token answers 403 `DEVICE_NOT_PAIRED` with `details.reason: PASSWORD_SESSION_REQUIRED`; nothing is issued and the standing enrolment is kept. MB-1 disables the switch in such a session; this is the server's backstop |
| Never two sign-ins with one token at once | A double tap is two uses: the second is a reuse and ends the session of the first (section 7). The button must be disabled while a sign-in is under way |
| Operation 9 | After a failed OS check (MB-4): one attempt and one failure on this device's counter, the one both sign-ins use; the answer is the lock state (`SignInStatus`), 200 also while locked. A cancelled prompt calls nothing. Whatever `operatorId` is sent, the answer is the same |
| The lock | One per device, shared by the password sign-in, the biometric sign-in and the reports: 5 within 300 s lock for 60 s; a success of either sign-in clears it. `getSignInStatus` with the device credential reads it |
| A sign-in that presents a session | Is accepted; the presented session is ended as `ROTATED` (ID-6). The app has no reason to do it |
| Headers | Every 2xx answer of the three operations carries `x-dems-epoch` and `x-dems-revision`; no answer sets a cookie |
| The storage mode (D71, DEPARTURE-6) | Is the client's alone. The server cannot tell a protected item from an unprotected one and behaves the same: single use, rotation, reuse detection, binding, revocation |

## 9. One revoke function: the decision, and the changes for fix round B

**Decision: this folder exports ONE function that revokes biometric tokens**, taking the caller's
unit, as `sessionRegistry.endForOperator` does (the administration row's F-5, decision D91 "until
the biometric row takes it over"):

```ts
// apps/core-server/src/modules/identity/biometric (index.ts; defined in store.ts)
export type BiometricRevocation =
  | { readonly scope: 'FAMILY'; readonly familyId: string; readonly reason: 'TOKEN_REUSE' | 'USER_DISABLED' | 'DEVICE_REVOKED' | 'DEVICE_UNPAIRED' }
  | { readonly scope: 'ENROLMENT'; readonly deviceId: string; readonly operatorId: string; readonly reason: 'DISABLED' | 'REENROLLED' }
  | { readonly scope: 'DEVICE'; readonly deviceId: string; readonly reason: 'DEVICE_REVOKED' | 'DEVICE_UNPAIRED' }
  | { readonly scope: 'OPERATOR'; readonly operatorId: string; readonly reason: 'USER_DISABLED' };

export function revokeBiometricTokens(unit: UnitOfWork, revocation: BiometricRevocation, now: number): Promise<number>;
```

It runs in the caller's unit, writes no row, publishes nothing, returns the number of rows it
changed, and refuses an object that is no unit (`UNIT_NOT_ACTIVE`). This folder uses `FAMILY` and
`ENROLMENT`. `DEVICE` and `OPERATOR` state exactly the predicate of the statement the pairing and
the administration module run themselves today (the tokens of the device, of the operator, that
are neither used nor revoked). `revocation.db.test.ts` shows that on equal rows of every state a
revoke through the pairing module and the scope `DEVICE`, and a disable through the administration
module and the scope `OPERATOR`, leave the same states: adopting the function changes no
behaviour.

**The two other modules were not edited.** Their statements are correct and tested; nothing is
wrong while they stay. The gain of adopting the function is one writer for every UPDATE of
`biometric_tokens`. Recommended for the structural round B, together with CPB1-11 (the stores
move):

| File | Change |
|---|---|
| `src/modules/pairing/devices.ts:46` | The import of `revokeBiometricTokensOfDevice` from `./store` goes; `import { revokeBiometricTokens } from '../identity/biometric';` is added |
| `src/modules/pairing/devices.ts:132`, `:148` | `await revokeBiometricTokens(unit, { scope: 'DEVICE', deviceId, reason: 'DEVICE_REVOKED' }, now);` and the same with `'DEVICE_UNPAIRED'` |
| `src/modules/pairing/store.ts:336-349` | `DeviceBiometricRevokeReason`, `REVOKE_BIOMETRIC_TOKENS_OF_DEVICE`, `revokeBiometricTokensOfDevice` go |
| `src/modules/pairing/__tests__/static.test.ts:299, :332`; `sequence.db.test.ts:389, :402` | The pins of the statement's name: the name becomes `REVOKE_TOKENS.DEVICE` (this folder's store added to the test's name table) |
| `src/modules/admin/changes.ts:52`, `:160` | The import from `./statements` goes; `await revokeBiometricTokens(unit, { scope: 'OPERATOR', operatorId, reason: 'USER_DISABLED' }, now);` |
| `src/modules/admin/statements.ts:143-146, :163-165` | `REVOKE_BIOMETRIC_TOKENS` and its function go |
| `src/modules/admin/__tests__/static.test.ts:235, :267, :274, :289`; `sequence.db.test.ts:218` | The pins of the statement's name and of the module's written tables |

So: two lines of production code per module (the import and the call; three calls in all), the
removal of each module's own statement, and the test lines that pin its name. If the controller
decides against it, the scopes `DEVICE` and `OPERATOR` (two statements, two union members) are to
be removed from `store.ts`.

## 10. Secrets

| Rule | How it is met | Test |
|---|---|---|
| Generated with the platform CSPRNG in the contract's form | `randomBytes(32)` as base64url behind `bio_`; `tokens.ts` is the one file of the folder that names `node:crypto` | `tokens.test.ts`; `static.test.ts` rule 5 |
| Returned ONCE | In the answer of an enrolment and of each sign-in, and nowhere else: the other answers of the journey hold no credential-shaped value, and no two answers handed out the same token | X "a token is in an answer ONCE …" |
| Stored as a hash only | SHA-256 of the whole value, prefix included; the dump holds each issued token's hash exactly once and no token | X "a full dump …"; `tokens.test.ts` |
| Never in an audit row, an event, a publication | The journey's 33 audit rows and 24 events, and its publications: 0 tokens, 0 hashes | X block "SR-36, SR-54" |
| Never in a log line | No file of the folder logs at all (a static test: no log call, no console, no error-log entry). The `trace` log of the journey: 0 tokens, 0 credentials, 0 markers, 0 hashes, no run of 64 hexadecimal digits; no request line with a query string | X block "AC-B-29"; `static.test.ts` rule 7 |
| Never in an error | Three statements made to fail (the claim, the insert of the next token, the insert of an enrolment, each with a hash among its parameters, by taking a privilege from the runtime role on the file's own clone): answered 500 without a detail; in the log as errors with the SQLSTATE `42501` under `err`, and nothing of a statement, a parameter or a hash. Each unit rolled back: the token was still live and signed in afterwards | X "rule M14 …", "ran through every transition …" |
| Never in a test name or a snapshot | The saved outputs hold no token-shaped value | section 11.2 |

The hash column is written by the two inserts and is a WHERE parameter of two statements; it is
in no SELECT list and no RETURNING, and no row type of the store has a member for it (a static
test).

## 11. Verification

### 11.1 The row command (16:51:22) and the folder's database-free tests (16:51:19)

```
$ DEMS_TEST_STEP=63 npm run test:db -w @dems/core-server -- --maxWorkers=2 --reporter=verbose src/modules/identity/biometric

[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_63_tmdndmx9_
[test:db] stale sweep: dropped 0; kept 0 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
[test:db] template dems_test_step_63_tmdndmx9_tpl_schema: built in 188 ms (create 60 ms, hook 124 ms)
[test:db] template dems_test_step_63_tmdndmx9_tpl_seed: built in 252 ms (create 84 ms, hook 166 ms)

 Test Files  8 passed (8)
      Tests  98 passed (98)
   Start at  16:51:22
   Duration  13.35s (tests 60%, import 28%, transform 11%)

[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 2 database(s) in 118 ms; 0 remain with the run prefix dems_test_step_63_tmdndmx9_
exit=0

$ npm run test -w @dems/core-server -- --maxWorkers=2 --reporter=verbose src/modules/identity/biometric
 Test Files  3 passed (3)
      Tests  65 passed (65)
   Start at  16:51:19
   Duration  2.39s (transform 50%, import 44%, tests 6%)
exit=0
```

### 11.2 What the tests printed (the same runs)

The full outputs are `implementation/assets/41_test_db_verbose.txt` (98 pass marks) and
`41_test_unit_verbose.txt` (65 pass marks); every test by name; no credential-shaped value in
either. Beside the timelines of section 3:

```
[w41] AC-B-78: 25 rounds of two concurrent uses of one token: 25 x (one 200, one 401); 25 sessions issued, each ended with TOKEN_REUSE by the other use; the first request won 22 times; 0 live tokens left
[w41] eight concurrent uses of one token: statuses {"200":1,"401":4,"423":3}; rows AUTH_SUCCESS, AUTH_FAILED, AUTH_FAILED, AUTH_FAILED, AUTH_FAILED, AUTH_FAILED, AUTH_LOCKED, AUTH_LOCKED
[w41] 20 concurrent refused tokens: statuses {"401":4,"423":16}; 5 AUTH_FAILED (attemptsRemaining 4, 3, 2, 1, 0), 15 AUTH_LOCKED
[w41] SR-71: 25 concurrent attempts: statuses {"200":10,"401":2,"423":8,"429":5}; 20 rows
[w41] sign-in racing a revoke of its device: sign-in first: 200; revoke first: 401; free: 200; free: 200; free: 200; no open session and no live token of the device after any round
[w41] sign-in racing a disable of its operator: sign-in first: 200; disable first: 401; free: 200; free: 200; free: 200; no open session and no live token of the operator after any round
[w41] statement level: 12 rounds of two transactions claiming one token: the second waited 12 times and got 0 rows 12 times; after a rollback of the first it got the row
[w41] statement level, free-running: 60 rounds x 4 connections: 60 rounds with exactly one row
[w41] secret scan journey: rows {"AUTH_FAILED":11,"AUTH_LOCKED":2,"AUTH_SUCCESS":4,"BIOMETRIC_ENROLLMENT_CHANGED":7}; 10 biometric tokens issued, 10 session tokens and device credentials, 1 made-up token; failing statements answered 500, 500, 500
[w41] rows: 33 audit rows and 24 events of the journey; 0 tokens, 0 credentials, 0 hashes
[w41] refusals: 19 answers of a refusal or a failure; 0 tokens, 0 credentials, 0 markers
[w41] dump of dems_test_step_63_tmdndmx9_f01_secrets: 171515 characters; 21 tokens and credentials searched in 6 forms each: 0 found; 10 biometric tokens issued, 10 rows in biometric_tokens, each token's SHA-256 present once
[w41] AC-B-29 log capture: 35829 characters, 154 lines, 46 request lines; 0 tokens, 0 credentials, 0 markers, 0 hashes
```

(The free-running pairs took one order in this run; the two orders are made to happen by the
first two arrangements of each test. Which of two concurrent uses wins, and which requests of a
mixed burst are the counted ones, differs from run to run: 23 of 25 and `{"200":9,"401":3,…}` in
the run of 16:46:39.)

### 11.3 The module gate (MODG)

```
[w41] MODG routes of src/modules/identity/biometric:
  POST /api/v1/auth/biometric setBiometricEnrollment
  POST /api/v1/auth/biometric/sign-in signInWithBiometric
  POST /api/v1/auth/biometric/failure reportBiometricFailure
[w41] MODG registry, operations 7 to 9:
  POST /api/v1/auth/biometric setBiometricEnrollment
  POST /api/v1/auth/biometric/sign-in signInWithBiometric
  POST /api/v1/auth/biometric/failure reportBiometricFailure
```

(`routes.test.ts`.) The same file asserts that the three are numbered 7, 8 and 9 in the registry;
that every registry operation under `/api/v1/auth/biometric` is one of them; that the guard's
rule for each is the registry's (`AUTHENTICATED` with `DEVICE_SESSION`; `DEVICE`; no permission;
a retired device refused on all three); and that no route carries a hook or attached validation.

**The condition of ruling D98.** The identity row's test covers everything under `/api/v1/auth`
except the prefix `/api/v1/auth/biometric` and fails if a route outside operations 2 to 6 appears
there; this folder's test covers that prefix and fails if a route outside operations 7 to 9
appears under it: so a fourth route anywhere under `/api/v1/auth` fails one of the two.

| # | Operation | An allowed call | A refused call (stage 6) | Each documented status | The role-by-operation decision |
|--:|---|---|---|---|---|
| 7 | `setBiometricEnrollment` | E (an operator's session on a device) | E, R: 401 without a session, 403 from a web console | section 5.1 | none carries a permission: every role passes on a device (R "an operator on a paired device, whatever the role …"); the full matrix is W47's |
| 8 | `signInWithBiometric` | S (a device credential) | S, R: 401 without a credential, 403 from a web console, 403 for a retired device | section 5.2 | the same |
| 9 | `reportBiometricFailure` | F (a device credential) | F, R: the same three | section 5.3 | the same |

Every test runs in-process (`app.inject`) on the file's own clone of the seed template. No port
is bound.

### 11.4 The cases of plan W41

| Case | Test | Result |
|---|---|---|
| A valid token signs in with `method: BIOMETRIC` and is replaced | S "answers 200 with a session bound to the device, its token and the NEXT biometric token …" | PASS |
| The old token answers 401, revokes the family and writes `AUTH_FAILED` | S "answers the generic 401, revokes the family, ends the BIOMETRIC session with TOKEN_REUSE …" | PASS |
| No request without a valid token creates a session | S block "no request without a valid token creates a session: every refusal path" (13 tests); F "it can create nothing …" | PASS |
| Enrolment needs a password session bound to a device | E "enabled: true in a session that was created with a token …"; E "no credential and a device credential without a session …" | PASS |
| Two concurrent uses of one token issue exactly one session | C "issue exactly one session; the other use answers 401 and is handled as a reuse … (25 rounds)"; C statement level, two tests | PASS |
| After a reuse the BIOMETRIC session ends with `TOKEN_REUSE` and `session.ended` is published, while a password session of the same operator stays open | S the same test as the second case: the password session on the same device, on another device and on the web all answer 200 afterwards; one publication `{ sessionIds: [that session], reason: TOKEN_REUSE }` | PASS |
| A failure report for an operator with no enrolment writes `AUTH_FAILED` with a null actor and the device ID | F "an operator with no biometric token on the device: AUTH_FAILED with a null actor and the device ID …" | PASS |

### 11.5 Whole projects, typecheck, lint (final state)

```
$ npm run typecheck -w @dems/core-server      exit=0     (16:47:42)
$ npm run lint -w @dems/core-server           exit=0     (16:47:49; no warning line in the output)

$ npm run test -w @dems/core-server -- --maxWorkers=2                                (16:47:50)
 Test Files  137 passed (137)
      Tests  3536 passed (3536)
   Start at  16:47:50
   Duration  32.41s (import 61%, tests 34%, transform 4%, worker 1%)
exit=0

$ DEMS_TEST_STEP=63 npm run test:db -w @dems/core-server -- --maxWorkers=2           (16:48:29)
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_63_tmdn8tfr_
 Test Files  106 passed (106)
      Tests  1520 passed | 1 skipped (1521)
   Start at  16:48:29
   Duration  150.82s (tests 78%, import 20%, transform 1%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 8 database(s) in 411 ms; 0 remain with the run prefix dems_test_step_63_tmdn8tfr_
exit=0
```

All of it is in `implementation/assets/41_final_runs.log`. No production or test file of this row
changed after 16:47.

### 11.6 Every run of the whole projects, and what was not this row's (P11)

| Time | Run | Result | Not this row's |
|---|---|---|---|
| 16:02:15, 16:02:48 | typecheck | exit 2 | `src/realtime/hub.ts`, `src/realtime/messages.ts`: the realtime row in flight. None in this folder |
| 16:02:53 | unit, a selection (identity, permission-guard, authenticate, readiness, `test/static`) | 2 failed, 26 files passed | `test/static/log-calls.test.ts` naming `src/realtime/hub.ts:597, :758`: the realtime row (the controller confirmed and told it). The other failure was the by-design one of section 14 |
| 16:25:26, 16:28:57 | lint | exit 0 with three warnings | all in `src/realtime/` (`hub.ts:855, :858`, `__tests__/support.ts:354`); one warning of this row (an unused import in a test, 16:25) was fixed at once |
| 16:47:42 to 16:51:01 | typecheck, lint, whole `unit`, whole `db` | all exit 0, no warning | — |
| 16:58:33 to 16:59:07 | at the close: typecheck; lint; the whole `modules/identity` (the identity core with this folder): `unit` 12 files / 205 tests, `db` 15 files / 179 tests | all exit 0 | lint printed six warnings, all in `test/acceptance/restart.test.ts` (unused imports): a test row in flight. None in this folder |

The whole projects were run once, at the end (rule M15); the folder's own tests after each
coherent change.

## 12. Mutation check

115 mutations of the folder's own logic, each ONE text replaced in ONE production file, handed to
Vitest by a transform of a scratch configuration outside the repository (the harness of the
identity, guard, pairing and administration rows; rule M15): no file of the tree was changed, so
no other row's run ever saw a mutant. Each mutant ran against the row's own tests, cheapest
first: the two database-free files that test behaviour, then three database files, then five, then
the static file.

| File | Mutations | Examples |
|---|--:|---|
| `sign-in.ts` | 42 | the lock is ignored; the attempt is taken from another key; no failure is counted; the device or the operator is not asked; the next token is not stored, starts a new family, lives one minute; the session is stored as PASSWORD; the presented token is handed back; a reuse does not revoke, does not end sessions, ends the sessions of the wrong device, ends password sessions too, publishes before the commit, publishes nothing; the budget is ignored or wrongly applied; each order of `refusalOfToken`; the presented value is trimmed |
| `store.ts` | 25 | the claim without the device, without "not used", without "not revoked", without the expiry, at the limit, marking nothing; each revocation scope widened or narrowed; the enrolment without each of its four conditions; the enrolment lookup without the device, without the operator, without "not revoked", live only |
| `enrolment.ts` | 14 | a refused enrolment hands out a token; no revocation before the issue; the returned token is not the stored one; the expiry of the answer and the stored one differ; each branch of the refusal |
| `failure.ts` | 11 | the operator is named without the lookup, inverted, never; the count goes to another key; the report is not recorded; the budget is ignored |
| `routes.ts` | 10 | a missing token in the answer; a missing header; a cookie on the answer; the device or the operator of the request replaced |
| `tokens.ts` | 7 | 128 bits; another prefix; the hash without the prefix, of a part; 31 days; four random bytes; one family for all |
| `activity.ts` | 6 | the opposite `enabled`; no reason; no `sessionsEnded: 0`; the method PASSWORD |

| Pass | Result |
|---|---|
| First (16:32:08 to 16:45:33) | 113 detected, 2 survived: M58 "a reuse that changed nothing is audited beyond the budget", M74 "the presented value is trimmed before it is hashed" |
| Two test additions | `concurrency.db.test.ts` "a SECOND replay changes nothing any more …"; `sign-in.db.test.ts` "the value is taken as it was sent …" |
| Second (16:46:15 to 16:46:26) | M58 detected (stage db-b), M74 detected (stage db-a) |
| **Total** | **115 of 115**: 26 by the database-free tests, 75 by the first database stage, 14 by the second, 0 left for the static file |

No mutation of a statement was caught only by the pin of its text: each was caught by a test of
behaviour first. The list, the harness and the log: `implementation/assets/41_mutations.json`,
`41_mutation_harness.vitest.config.mjs.txt`, `41_mutation_harness.run.sh.txt`, `41_mutations.log`.

## 13. Test ledger (P24)

Workspace `@dems/core-server`. Baseline of the brief (controller, 15:40): `unit` 102 files /
2,661 tests, `db` 75 files / 1,081 tests. This row adds:

| Project | File (`src/modules/identity/biometric/__tests__/`) | Tests |
|---|---|--:|
| unit | `routes.test.ts` | 11 |
| unit | `tokens.test.ts` | 19 |
| unit | `static.test.ts` | 35 |
| db | `sign-in.db.test.ts` | 23 |
| db | `enrolment.db.test.ts` | 12 |
| db | `failure.db.test.ts` | 13 |
| db | `concurrency.db.test.ts` | 15 |
| db | `revocation.db.test.ts` | 8 |
| db | `sequence.db.test.ts` | 12 |
| db | `secrets.db.test.ts` | 12 |
| db | `engine.db.test.ts` | 3 |

`unit`: 3 files, 65 tests. `db`: 8 files, 98 tests. `support.ts` is test support, not a test
file. No existing test was removed; one existing test was changed by design (section 14) and
still counts as one.

Totals at the end: `unit` 137 files / 3,536 tests, `db` 106 files / 1,521 tests (1,520 passed, 1
skipped, another row's). Both are above the baseline plus this row's additions (105 / 2,726 and
83 / 1,179); the rest are the additions of the rows in flight beside this one (sessions, demo
control, security-audit, system and alerts, the realtime channel, the fix rounds), which report
their own.

## 14. Existing files of other rows changed, each by a recorded decision

### 14.1 `apps/core-server/src/modules/identity/index.ts` (decision D78 DN-6; a recorded multi-writer path)

Re-read before the edit (SHA-256 of the pre-image `a3d4983a…`, equal to the file at 15:52 and at
16:02). Pre-image: `.cache/rollback/W41.identity.index.ts.pre` (a file copy; the path is
untracked). Two lines added, nothing else:

| Line | Added |
|--:|---|
| 32 | `import { registerBiometricRoutes } from './biometric';` |
| 163 | `  registerBiometricRoutes(app, { lockout });` (after `registerIdentityRoutes(app, { lockout, hasher: () => hasher });`) |

### 14.2 `apps/core-server/src/modules/identity/__tests__/routes.test.ts` (controller ruling D98)

The identity row's module gate collected every route under `/api/v1/auth` and compared it with
operations 2 to 6. Operations 7 to 9 live under that prefix, so the test failed by design when
they registered (16:02:53: `routes.test.ts:38`, 8 entries received, 5 expected). Not edited; the
controller was told with file, line and the smallest change, and ruled (D98): apply it. Re-read
right before the edit; pre-image `.cache/rollback/W41.identity.routes.test.ts.pre`.

| Line | Before | After | Reason |
|--:|---|---|---|
| 30 | `… and nothing else under /api/v1/auth'` | `… and nothing else under /api/v1/auth outside /api/v1/auth/biometric'` | the title stays true |
| 35 | `.filter((route) => route.url.startsWith('/api/v1/auth'))` | `.filter((route) => route.url.startsWith('/api/v1/auth') && !route.url.startsWith('/api/v1/auth/biometric'))` | the three biometric routes are this folder's, which the identity row itself declared not its own |

Nothing else in that file. The file alone at 16:04:09: 7 of 7. The condition of the ruling is met
(section 11.3): the two tests together cover every route under `/api/v1/auth`.

### 14.3 The guard row's tests

Stayed green with the three routes registered, as that row had proven: 16:02:53 (the selection
above) and the whole `unit` project at 16:47:50.

## 15. Requirement to test

| Requirement | Test |
|---|---|
| SR-36: 256 bits, prefix `bio_`, stored as SHA-256, bound to one device and one operator, issued only inside a password session on that device, single use with rotation, 30 days; a reuse revokes the family and ends its sessions | `tokens.test.ts`; E block "SR-36"; S blocks "AC-B-31" and "AC-B-31, AC-B-82"; S "a token past its 30 days …"; X the dump |
| SR-37: no session from a client's statement; `reportBiometricFailure` can only add a failure, and names an operator only where an enrolment of the device exists | F block "AC-B-83" (7 tests); S block "no request without a valid token creates a session"; `static.test.ts` rule 2 |
| SR-72: atomic server-native state changes; an attempt consumed before it is verified; compare-and-set | `sequence.db.test.ts`; C all blocks; `static.test.ts` rules 3 and 8 |
| SR-74: a reused token ends the open BIOMETRIC sessions of that device and operator | S "answers the generic 401, revokes the family, ends the BIOMETRIC session …"; C AC-B-78. The socket close within 1 s is the realtime row's (W42) and the acceptance test's (W48); the publication it acts on is asserted here, after the commit and after the state change that holds the row (`engine.db.test.ts`) |
| SR-65: no client-supplied actor | F; `static.test.ts` "the operator a failure report names becomes the actor of its row only behind the enrolment lookup" |
| SR-71: the denial budget | F "SR-71 …"; C "SR-71: 25 at once …" and the three budget tests after it |
| SR-48, SR-54, M14: nothing of a secret or of a failed statement in a log, a row or an answer | X |
| AC-B-29 (the biometric flow) | X block "AC-B-29" |
| AC-B-31 | S blocks "AC-B-31" and "no request without a valid token creates a session" |
| AC-B-78 | C block "AC-B-78" |
| AC-B-82 (the session end) | S "answers the generic 401, revokes the family, ends the BIOMETRIC session with TOKEN_REUSE …" |
| AC-B-83 | F "an operator with no biometric token on the device …", "an enrolled operator …", "the enrolment is the DEVICE's …" |
| API-7 | E, S, F (the header equals the engine's revision); `engine.db.test.ts` (the revision of the state change that holds the row) |
| ENG-8: the rows continue the one chain | `engine.db.test.ts`; C `expectChainVerifies` after the bursts |
| Decision D69, rule D34-6 b: no `Set-Cookie` on a device answer | S, E, F (every answer asserted); a mutation that sets the cookie is detected; `static.test.ts` rule 6 |
| M3: who may call is stage 6 only | `static.test.ts` rule 1; `routes.test.ts` "no route carries a check of its own" |

## 16. Contract gaps

| ID | Gap | Text for the contract close-out row (W83) |
|---|---|---|
| CONTRACT-GAP-W41-1 | The lifetime of a biometric token (30 days, ID-P11) exists only as words in the description of `BiometricEnrollment.expiresAt`; no shared constant. The answer of operation 8 carries the rotated token without its expiry, so a client that keeps an expiry in its marker must compute it and has no constant to compute it with. The server defines `BIOMETRIC_TOKEN_LIFETIME_MS` in `modules/identity/biometric/tokens.ts` | Export `BIOMETRIC_TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60_000` from `packages/shared/src/api/constants.ts` and name it in the two descriptions: `expiresAt` ("issue plus `BIOMETRIC_TOKEN_LIFETIME_MS`") and `SignInResponse.biometricToken` ("it expires `BIOMETRIC_TOKEN_LIFETIME_MS` after `session.issuedAt`"). Alternative: an optional member `biometricTokenExpiresAt` of `SignInResponse` |
| CONTRACT-GAP-W41-2 | Operation 7, 403: the contract gives one code, `DEVICE_NOT_PAIRED`, for two cases (the session is not bound to a device; `enabled: true` in a session that was not created by password). The server tells the second apart with `details.reason: PASSWORD_SESSION_REQUIRED` and the text "Sign in with your password to turn biometric sign-in on."; neither is in the contract | In `identity.ts`, operation `setBiometricEnrollment`, response 403: "… or `enabled: true` was sent on a session that was not created by password (DEVICE_NOT_PAIRED with `details.reason: PASSWORD_SESSION_REQUIRED`)"; one more example under `403` with that detail; the reason as a shared constant |
| CONTRACT-GAP-W41-3 | Operation 8, 423: the shared text says "The attempt is not verified and writes AUTH_LOCKED". The failure that LOCKS the device is verified, writes `AUTH_FAILED` and answers 423 as well (decision D78 DN-3; the same as CONTRACT-GAP-W32-1 for the redeem) | Add to the 423 of `signInWithBiometric` (and of `signIn`): "The failure that locks the console also answers 423; it was verified and writes AUTH_FAILED with `details.lockedUntil`" |
| CONTRACT-GAP-W41-4 | The `details.reason` values of an `AUTH_FAILED` row of a refused token (`TOKEN_REUSE`, `USER_DISABLED`, `TOKEN_REVOKED`, `TOKEN_EXPIRED`, `OTHER_DEVICE`, `DEVICE_NOT_PAIRED`) exist only in the server (`TokenRefusalReason`). The specification names the first two (§4.7, ID-4). A client that words audit rows has no vocabulary for the other four | If decision DN-4 stands: a shared constant beside the audit vocabulary and one line in spec §13 |

## 17. Findings

| ID | Finding | For |
|---|---|---|
| F-1 | **A lost answer costs the enrolment.** If the unit of a sign-in commits and its answer does not reach the device, the device still holds the used token. Its next attempt is a reuse: 401, the family revoked, the session of the lost answer ended; the operator signs in with the password and enrols again. This is the price of single use with reuse detection (the refresh-token pattern); the server cannot tell a lost answer from a stolen token. The same happens on a double tap (two requests with one token) | The mobile sign-in row W56 (section 8); the client security review W100. Not changed here |
| F-2 | **With the database unreachable an attempt is still counted.** The attempt is taken before the unit's first statement (ENG-24), and a unit opens its transaction at its first statement. So operation 8 keeps its taken attempt and operation 9 its recorded failure although no row could be written and the answer is 503; five of them lock the device for 60 s. It fails closed, as the password sign-in does (finding F62 (2)). Tested and stated in `routes.test.ts` "the database is not there …" | Security review W45, with F62 |
| F-3 | **A live token presented by ANOTHER paired device is refused and nothing more.** The specification asks for the generic 401 (§5.6 step 4: "same device"). The token has evidently left its device; it stays live for its own device. An option: treat it as a reuse (revoke the family, end its sessions). The row (`reason: OTHER_DEVICE`, the token's operator, the presenting device) makes it visible in the trail | Security review W45 |
| F-4 | **`signInWithBiometric` is not in `ACTIVITY_EXEMPT_OPERATIONS`** (`src/plugins/authenticate/index.ts:153`: `['signIn', 'signOut']`). When a biometric sign-in presents a session, the activity hook may record activity on that session (one unit `identity.touch`, at most once a second) a moment before the sign-in's unit ends it as `ROTATED`. Harmless; one unit too many. Smallest change: add `'signInWithBiometric'` to that list | The identity row's owner; fix round B |
| F-5 | **Import cycle.** `modules/identity/index.ts` imports `./biometric`, which imports `readDeviceState` from `modules/pairing` (decision D93), which imports `modules/identity`. Every use across the cycle is inside a function, so nothing is read before it is initialised (the whole `unit` and `db` projects load it in many orders). It goes away when the stores move (CPB1-11); it grows by one edge if the pairing module adopts `revokeBiometricTokens` before that | Fix round B, with CPB1-10 and CPB1-11 |
| F-6 | **After a disable or a revoke by the other two modules the used rows of a family stay unrevoked** (they revoke live tokens only, as database contract AT-C5 writes it). Consequences here: a reuse of such a used token is still detected (the reuse rule looks at `used_at`); and for operation 9 the operator still "has an enrolment" on that device (a token that was not revoked, "live or last used"), so a report may name a disabled operator on a device where that operator had signed in with a token. Tested and stated (F "live or last used …"). It is the specification's wording, not a defect | Security review W45: confirm, or ask for "live only" (one word in `FIND_ENROLMENT`; mutation M22 shows the test that pins it) |
| F-7 | **A 423 does not tell the app whether its token was refused.** The failure that locks the device and an attempt during the lock both answer 423 (decision D78 DN-3); only the first means the token is dead. The app keeps the token and learns it at the next attempt (section 8.2). A `details` member would tell; the specification has none | W56; the contract close-out, if wanted |
| F-8 | **The device registry's "seen" unit precedes an operation.** At most once a minute per device, stage 4 runs the pairing module's unit `pairing.deviceSeen` before the handler: three round trips that are not this folder's. The sequence test sees each device once before it records | Record (decision D93 DN-8) |
| F-9 | At 16:02 and 16:25 to 16:29 typecheck, lint and one static test were red or warned in `src/realtime/**` only (the realtime row in flight): P11 noise, section 11.6 | Record |
| F-10 | The free-running pair "sign-in against revoke" took the same order in every round on this machine (the sign-in's unit first): a test that only issues the two together does not exercise the other order. The row's tests make both orders happen (a hook that lets the other request finish at the moment the sign-in's unit is submitted) | Test rows W48, W53: the same holds for their races |

## 18. Deviations from the row text and the standing rules

| ID | Deviation | Why |
|---|---|---|
| DV-1 | Rule M6 says "the place in the denial budget, then the unit with the row". Here the place is taken INSIDE the unit, before the row | Whether a sign-in is a refusal is known only after the claim, and the claim, the reuse handling and the row must be one unit (rule 4 of the brief; contract AT-C4). The pairing row's pattern, accepted as decision D93 DV-1 |
| DV-2 | Rule M6 says "beyond the budget the answer is 429 and no row". The row of a refusal that changed stored state is written all the same; the answer is the 429 | A session ended with `TOKEN_REUSE` without its audit row would break spec §5.4; the pairing row writes `PAIRING_CODE_CLOSED` beyond the budget for the same reason. Bounded by the lockout: five per window and device. Section 6 |
| DV-3 | One line and one title of the identity row's `routes.test.ts` were changed | Controller ruling D98 (section 14.2) |
| DV-4 | "A token of another operator" (rule 6 of the brief) is tested as what it is: no refusal. The token decides who signs in | Section 5.2 |
| DV-5 | The folder exports two revocation scopes (`DEVICE`, `OPERATOR`) that nothing calls yet | The decision of section 9; tested; to be adopted or removed in fix round B |
| DV-6 | The mutation check ran through a scratch Vitest configuration with a transform, not by editing files | Rule M15 |
| DV-7 | The tests import the test support of other rows (`identity`, `pairing`, `admin`, `core`, `engine`, the seed's dump helper, the scaffold's scanner) | As every module row before; `pairDevice` gives a real paired device (decision D93) |
| DV-8 | `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md` and `implementation/99_implementation_report.md` were not written | Parallel run (P8); the progress file is `delegation_progress/coder_execution_step_63.md` |

## 19. Decisions for the controller

| ID | Decision this row made | Alternative |
|---|---|---|
| DN-1 | **The loser of two concurrent uses is a REUSE**, with everything a reuse does (AC-B-78: "handled as a reuse"; §5.6 step 6). The winner's session is ended and its next token revoked | A plain 401 for a use that loses the race: the specification says otherwise, and the server cannot tell a race from a theft |
| DN-2 | **A used token is a reuse whoever presents it**, also another paired device; the sessions ended are those of the TOKEN's device and operator (the contract's `$10`, `$11`); the row and the count are the presenting device's | A used token from another device as `OTHER_DEVICE` only (mutation M67 shows the test) |
| DN-3 | The row of a state-changing refusal is written beyond the denial budget (DV-2) | Drop it (rule M6 to the letter): a session would end without an audit row |
| DN-4 | `AUTH_FAILED` of a refused token carries `details.reason`: `TOKEN_REUSE`, `USER_DISABLED` (both the specification's), and `TOKEN_REVOKED`, `TOKEN_EXPIRED`, `OTHER_DEVICE`, `DEVICE_NOT_PAIRED` (this row's). The answer to the caller stays one | Only the two the specification names. Then the trail cannot tell an expired token from a stolen one (CONTRACT-GAP-W41-4) |
| DN-5 | A refused token names the operator of the stored token it matched (as a failed password names the operator the username matched, ID-4), also when another device presented it; an unknown value names nobody | Name the operator only on the token's own device |
| DN-6 | Turning off what is off answers 200 `{ enabled: false }` and writes no row (the administration row's rule: a change that changed nothing writes nothing) | One row per successful call |
| DN-7 | `enabled: false` is allowed in a session that was created with the token, and ends no session | Require a password session for both directions: MB-2 does not ask for it |
| DN-8 | A new enrolment revokes every earlier row of the pair (`REENROLLED`), used rows included; `enabled: false` the same with `DISABLED` ("revokes the family", §5.6 step 8) | Live rows only, as the other two modules do |
| DN-9 | "An enrolment exists" (SR-37) is: a token of that device and that operator with `revoked_at IS NULL`, live or used ("live or last used") | Live only (finding F-6) |
| DN-10 | Operation 9 while the device is locked: 200 with the lock state, `AUTH_LOCKED`, nothing counted. The contract documents no 423 for it | — |
| DN-11 | An attempt of operation 8 during the lock is not looked up: its `AUTH_LOCKED` row names the device and nobody else | Look the token up to name its operator: a locked console would then still probe the token table |
| DN-12 | A value that has not the form of a token counts as an attempt and gets the generic 401 (the contract: "the form is not checked here"); the schema's 422 is for a missing, empty, over-long or unstorable value | 422 for a value that does not match the pattern: an attacker would learn nothing, an honest client neither |
| DN-13 | A claimed token whose operator is disabled or whose device is no longer PAIRED stays used; its family is revoked with that reason; `AUTH_FAILED` | Roll the claim back: the row could then not be in the same unit |
| DN-14 | One revoke function with four scopes is exported; the two other modules are offered two of them (section 9) | Leave three writers of `biometric_tokens`, and remove the two scopes |
| DN-15 | A biometric sign-in that presents a session rotates it, also when it is another operator's (decision D78 DN-7 applied to operation 8) | Refuse a sign-in that presents another operator's session: the caller could present the device credential instead, so nothing is gained |
| DN-16 | The failure that locks the device answers 423 (decision D78 DN-3 applied) | 401 for it, so the app deletes its dead token at once (finding F-7) |
| DN-17 | The session an enrolment needs is the WHERE of the issuing statement; the device and the operator of the token are that session row's | A check in the handler: rule M3 forbids it, and it would not see a session that ended meanwhile |
| DN-18 | `readDeviceState` is imported from the pairing module's index, as decision D93 names it (finding F-5) | From `pairing/store` directly: no file-level cycle, and a path that fix round B moves |
| DN-19 | No file of the folder logs. A refusal is on the request line by its code; a failed unit is logged by the core and the error envelope as `{ err }` | A warn line per refused token: the audit row says more, and a log line is one more place a secret could reach |

## 20. End state and cleanup (16:51:53)

```
session: role=dems_owner server=18.4 port=4432 postmaster started 2026-10-04 07:14:26.046351+07
databases with this row's prefix (dems_test_step_63_*): 0
test databases of all rows at this moment: 0
project databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3
sessions on this row's databases still open: 0
.locks/postgres.pid: 19121
```

(The script is `implementation/assets/41_end_state.mts.txt`; it prints names and counts only. A
second run at 16:59:07, after the closing runs and saved in `41_final_runs.log`, shows 11 test
databases of other rows' runs at that moment and again none of this row's, the same postmaster
and PID 19121.)

| Item | State |
|---|---|
| PostgreSQL | PID 19121, postmaster start 07:14:26: never stopped, restarted or reconfigured |
| Processes | None started that outlived its command; no port bound; no server run |
| Scratch | The mutation harness lay in the session's scratch directory, outside the repository; its link to `node_modules` is removed. Nothing was written under `/tmp` by hand |
| The tree | No file was mutated at any time. Two pre-images under `.cache/rollback/` |
| Privileges | The secret-scan test takes two privileges from `dems_app` and gives them back, on its own clone only; the clone is dropped with the run |

## 21. Rollback (R-NEW; not executed)

```sh
# From /Users/gsp-budi/Documents/DEMS. The folder is new; two files of the identity row carry two lines each.
cp .cache/rollback/W41.identity.index.ts.pre apps/core-server/src/modules/identity/index.ts
cp .cache/rollback/W41.identity.routes.test.ts.pre apps/core-server/src/modules/identity/__tests__/routes.test.ts
# Then remove the folder apps/core-server/src/modules/identity/biometric (its 8 production files, its __tests__ folder).
```

After it operations 7 to 9 are not registered: they answer 404 (the routes do not exist), the
identity row's module gate is as it was, and no table is touched (the folder has no migration).
Rows of `biometric_tokens` that a run wrote stay as rows; no statement of another module reads
them except the two revocations.

## 22. Verification list of the row

| Asked | Where |
|---|---|
| MODG; the three routes equal registry operations 7 to 9 | Section 11.3 |
| A valid token signs in with `method: BIOMETRIC` and is replaced | Sections 1, 11.4 |
| The old token answers 401, revokes the family and writes `AUTH_FAILED` | Sections 1, 11.4 |
| No request without a valid token creates a session | Section 5.2 |
| Two concurrent uses of one token issue exactly one session | Sections 7, 11.2 |
| After a reuse the BIOMETRIC session ends with `TOKEN_REUSE` while a password session of the same operator stays open (same device and another) | Sections 1, 11.4 |
| A failure report for an operator with no enrolment: `AUTH_FAILED`, null actor, the device ID | Sections 5.3, 11.4 |
| `DEMS_TEST_STEP=63` for `test:db` | Sections 11.1, 11.5 |
| Whole `unit` and `db` projects at the end, with the ledger naming the files | Sections 11.5, 13 |
| Typecheck and lint exit 0 without a warning | Section 11.5 |
| A mutation check of the module's own logic | Section 12 |
| No database of the prefix remains; `.locks/postgres.pid` 19121 | Section 20 |
| Gap IDs carry the row | Section 16 |
| The three sequences statement by statement | Section 3 |
| The token's life as a state table | Section 4 |
| What the mobile sign-in row can rely on | Section 8 |
| The decision on one revoke function, with the changes for the structural round | Section 9 |
| The keying of the failure report | Section 6 |
| How the sequence differs from the password sign-in, and why timing tells nothing | Section 3.1 |
| The two lines in `modules/identity/index.ts`, with the pre-image | Section 14.1 |

---
*Generated: 2026-10-04 16:58*
*Last Updated: 2026-10-04 17:01*
