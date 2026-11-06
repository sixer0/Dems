---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 46
plan_row: W24
title: Identity core (the authenticate stage HB-5, server-side sessions, the session cookie, lockout, the sweeper, operations 2 to 6)
date: 2026-10-04
agent: coder-execution (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
source_spec: masterplan/01_specs.md rev 2.2 (§2.3, §4.1, §5, §7.5, §8.2, §13, §14.2, §15); masterplan/03_database_contract.md rev 2.2 (§4.4 to §4.6, §5)
evidence_tier: 3
status: complete
---

# W24: identity core

All times are WIB (UTC+7) on 2026-10-04. Every command ran from `/Users/gsp-budi/Documents/DEMS`;
the session never changed into a subfolder (two scratch commands ran in a subshell). Database
commands ran with the per-command sandbox bypass (P10): inside the sandbox a connection to
`127.0.0.1:4432` fails with `POSTGRES_UNREACHABLE`, observed once at 11:19:51. Quoted runner
output is unchanged except that the sandbox's certificate warning lines are left out.

**No password, token, cookie value, hash, salt or other credential appears in this document.**
The demo password is named by its constant only. Strings of the form `ses_…` in the tests are
made-up examples of a FORM, built from one repeated letter; no test name holds one.

## 1. Result

| Item | Result |
|---|---|
| Row command `DEMS_TEST_STEP=46 npm run test:db -w @dems/core-server -- src/modules/identity src/plugins/authenticate` | **Exit 0**: 8 files, 93 tests, 0 failed (12:47:00, section 11.1; the same at 12:18:14, 12:32:41, 12:32:56 and 12:46:56) |
| The cookie | `dems_session_<listen port>=<token>; Path=/; HttpOnly; SameSite=Strict`: exactly the three attributes, no `Secure`, no `Domain`, no `Max-Age`, no `Expires`; no token in the body of a web sign-in; a device gets the token in the body and no `Set-Cookie` at all |
| Two instances, one cookie jar | A sign-in on port 4421 leaves the cookie and the session of port 4420 valid; each instance ignores the other's cookie although both share one database in the test |
| Failure bodies | Wrong password, unknown user and disabled user (wrong and right password): the bodies are identical byte for byte once the per-request `requestId` is set to one value; equal `content-length`, equal header sets; exactly one Argon2id derivation per attempt (a spy on the built-in); the same statements in the same order for a known and an unknown username |
| 20 concurrent wrong-password sign-ins | 5 derivations; 5 `AUTH_FAILED` rows (4, 3, 2, 1, 0 attempts left, the fifth marked as locking); 15 `AUTH_LOCKED` rows answered 423; the chain verifies |
| The lock | Set when the fifth attempt is taken; 423 with `lockedUntil` and `retryInMs`; one millisecond before its end still 423, at its end a correct sign-in succeeds (manual clock) |
| Expiry | Idle at exactly 15 minutes after the last activity, absolute at exactly 8 hours after the issue, each one millisecond earlier still valid; a GET does not extend a session; `AUTH_EXPIRED` with `reason` `IDLE` or `ABSOLUTE`; ended once whoever comes first, the request or the sweeper |
| A dump and a log capture | 12 secrets and markers searched in 6 forms each in a dump of 156,913 characters and in a `trace` log of 102 lines: 0 found; each issued token's SHA-256 is in the dump exactly once; no request line holds a query string |
| Module gate (MODG) | Route list equals the registry operations 2 to 6 (both quoted, section 11.3); each operation has a success test, each with a body a validation test; in-process on the row's own clones; no port bound |
| Whole `unit` project | **Exit 0**: 70 files, 1,847 tests (12:46:33) |
| Whole `db` project | **Exit 0**: 45 files, 623 tests (12:47:05, the last run). Two runs before it were red in ONE file of another row (12:33:03, 12:34:56: `src/db/reset/__tests__/reset-failures.db.test.ts`, a different test each time, with this row's eight files green): P11, section 11.7 and finding F-20 |
| Typecheck, lint of the workspace | Exit 0; exit 0 with no warning (12:46:44, 12:46:47) |
| Mutation check | 68 of 68 planted defects detected (section 12) |
| Controller notes | D69 (what the mobile app sends), D72 (two lines in the request-guards row's test) and D77 (the engine host has landed: three points): met, section 10 |
| PostgreSQL | Never stopped or reconfigured: `.locks/postgres.pid` is 19121, postmaster start 07:14:26, as before. No database with this row's prefix remains (section 20) |

## 2. What was written

Two owned folders. 14 production files (2,315 lines) and 16 test files with one test-support
file (4,353 lines), by `wc -l`.

| File | Lines | Content |
|---|--:|---|
| `src/plugins/authenticate/index.ts` | 277 | Stage 4: the credential decision table; the one refusal (`CREDENTIAL_CONFLICT`); `Principal`, `ANONYMOUS_PRINCIPAL` (unchanged); `authenticationOf(request)`; `operatorSessionOf(request)`; the activity hook (`preHandler`) |
| `src/plugins/authenticate/credentials.ts` | 68 | Pure: which credential a request presents. Only this instance's cookie name counts |
| `src/modules/identity/index.ts` | 171 | The unit: the seam `sessionRegistry`, the routes, the lockout, the sweeper's start and stop; `identityControl(app)`; the exports other rows use |
| `src/modules/identity/sessions.ts` | 321 | The session registry: `resolve`, `touch`, `endForOperator`, `endForDevice`, `endBiometricSessions`, `sweep`; `issueSession`; `signOutSession`; `readDatabase` |
| `src/modules/identity/session-store.ts` | 410 | Every SQL statement of the row: 18 statements as constant texts with bind parameters |
| `src/modules/identity/sign-in.ts` | 269 | The password sign-in: two units with the derivation between them |
| `src/modules/identity/lockout.ts` | 191 | The console lockout on two memory limiters of `rate-limiter-flexible` |
| `src/modules/identity/routes.ts` | 157 | Operations 2 to 6, built from their registry entries |
| `src/modules/identity/activity.ts` | 201 | The five audit rows and their events |
| `src/modules/identity/console.ts` | 87 | The console rule ID-1; the lockout key of a request |
| `src/modules/identity/cookie.ts` | 35 | The one place that writes the session cookie |
| `src/modules/identity/tokens.ts` | 32 | Token generation (CSPRNG) and its SHA-256 |
| `src/modules/identity/sweeper.ts` | 57 | The 5 s timer |
| `src/modules/identity/limits.ts` | 39 | The numbers of ID-P1 to ID-P9 |

Tests: section 13. Outside the owned paths, each a recorded by-design change (section 14): two
deleted lines in `src/plugins/readiness/__tests__/readiness.test.ts` (D52), then the emptied test
of that file removed (D77), and two inserted lines in
`src/plugins/origin-guard/__tests__/origin-guard.test.ts` (D72). Documents: this file, the
progress file, and six assets under `implementation/assets/24_*` (section 12, 11.2).

Not written: `app.ts`, `index.ts`, `config.ts`, any `package.json`, the contract, the schema, a
migration, the mapping, the seed, `src/core/**`, `password-hash/`, `biometric/`. No package was
installed: `@fastify/cookie` 11.1.2 and `rate-limiter-flexible` 11.2.1 were declared and present.

## 3. The credential decision table of stage 4, as implemented

`readCredential(request.cookies, request.headers.authorization, app.config.sessionCookieName)`
says what is presented; the stage resolves it. A credential that does not resolve is not
refused: the request goes on as ANONYMOUS and stage 6 answers. The only refusal is the conflict.

Tests: U = `src/plugins/authenticate/__tests__/authenticate.test.ts` (database-free: the session
registry and the device registry are stand-ins behind their seams, stages 3 and 5 real);
D = `src/plugins/authenticate/__tests__/authenticate.db.test.ts` (real sessions on a clone).

| Cell | Presented | Lookup | Principal | `authenticationOf` | Test |
|---|---|---|---|---|---|
| C1 | Nothing | none | ANONYMOUS | `NONE`, no failure | U "C1 nothing presented …" |
| C2 | This instance's cookie, the token of an open web session | `resolve(token, 'COOKIE')` | OPERATOR, `deviceId: null`, role and permissions as read now | `COOKIE`, no failure, the session | U "C2 …"; D "the cookie resolves a web session; a bearer value resolves a device session …" |
| C3 | The cookie, a value that is no token form | none | ANONYMOUS | `COOKIE`, `MALFORMED` | U "C3 …" |
| C4 | The cookie, an unknown token | one | ANONYMOUS | `COOKIE`, `UNKNOWN` | U "C4 …" |
| C5 | The cookie of an ended or expired session | one | ANONYMOUS | `COOKIE`, `ENDED` | U "C5 …"; D2 "15 minutes without activity end the session …" |
| C6 | The cookie of a disabled operator's session | one | ANONYMOUS | `COOKIE`, `OPERATOR_DISABLED` | U "C6 …"; D2 "a session whose operator is disabled resolves to nothing …" |
| C7 | A device session's token sent as the cookie (ID-13) | one, finds nothing | ANONYMOUS | `COOKIE`, `UNKNOWN` | U "C7 …"; D "… neither resolves the other's"; D "the lookup itself is bound to the transport …" |
| C8 | `Bearer ses_…` of an open session whose device is PAIRED | `resolve(token, 'BEARER')`, `resolveDevice(deviceId)` | OPERATOR with the device ID | `BEARER`, no failure, the session | U "C8 …"; D as C2 |
| C9 | `Bearer ses_…`, the device is REVOKED or UNPAIRED | both | ANONYMOUS with `retiredDeviceId` | `BEARER`, `DEVICE_RETIRED` | U "C9 …"; D "a device credential resolves to DEVICE while paired, and to the device ID only once it is retired" |
| C10 | `Bearer ses_…` of a session ended with `DEVICE_REVOKED` or `DEVICE_UNPAIRED` | both | ANONYMOUS with `retiredDeviceId` | `BEARER`, `DEVICE_RETIRED` | U "C10 …"; D2 "endForDevice ends the device's sessions; their tokens then answer 403 DEVICE_REVOKED …" |
| C11 | `Bearer ses_…`, the registry does not know the device (the seam unfilled) | both | ANONYMOUS | `BEARER`, `DEVICE_UNKNOWN` | U "C11 …"; D "the seam deviceResolver while the pairing module has not filled it > denies …" |
| C12 | `Bearer ses_…` of an ended device session | both | ANONYMOUS | `BEARER`, `ENDED` | U "C12 …" |
| C13 | A web session's token sent as a bearer value (ID-13) | one, finds nothing | ANONYMOUS | `BEARER`, `UNKNOWN` | U "C13 …"; D as C7; D1 "a web session token sent as a bearer value resolves to nothing" |
| C14 | `Bearer ses_…`, unknown | one | ANONYMOUS | `BEARER`, `UNKNOWN` | U "C14 …" |
| C15 | `Bearer dvc_…` of a PAIRED device | `resolveCredential(value)` | DEVICE | `BEARER`, no failure | U "C15 … C16 … C17 …"; D as C9 |
| C16 | `Bearer dvc_…` of a retired device | the same | ANONYMOUS with `retiredDeviceId` | `BEARER`, `DEVICE_RETIRED` | the same |
| C17 | `Bearer dvc_…`, unknown | the same | ANONYMOUS | `BEARER`, `UNKNOWN` | the same |
| C18 | Any other `Authorization` header (`bio_…`, another scheme, no token form, empty) | none | ANONYMOUS | `BEARER`, `MALFORMED` | U "C18 an Authorization header with …" (4 cases) |
| C19 | This instance's cookie AND an `Authorization` header | none: nothing is resolved | refused: 401 `NOT_SIGNED_IN`, `details.reason: CREDENTIAL_CONFLICT` | — | U block "ID-12 … (D72: through the real stage 4)"; D block "ID-12 through the real stage 4 (decision D72)" |
| C20 | Another instance's cookie, a foreign cookie | none | ANONYMOUS | `NONE` | U "another instance's cookie alone is no credential …"; D4 "each instance ignores the other's cookie …" |
| C21 | A bearer value beside another instance's cookie and an unrelated cookie | as the bearer value alone | as the bearer value alone | `BEARER` | U and D "a bearer request … with another instance's cookie and an unrelated cookie resolves as the bearer session" |

(D1 = `sign-in.db.test.ts`, D2 = `sessions.db.test.ts`, D4 = `two-instances.db.test.ts`.)

Rules behind the table:

- **Presence, not validity, makes the conflict** (ID-12), exactly as stage 3 reads presence
  (`request.cookies[cookieName] !== undefined`, `request.headers.authorization !== undefined`),
  so both stages see one request alike. It is logged with one `warn` line that names the reason
  and the route pattern; neither value is read. It writes no audit row (RB-6: a 401 has no
  actor) and takes no place in the denial budget.
- **A value is looked up only when it has the exact form of its kind** (`SESSION_TOKEN_PATTERN`,
  `DEVICE_CREDENTIAL_PATTERN`): a made-up value costs no query.
- **The transport is half of the lookup** (ID-13), twice: in the statement
  (`… WHERE s.token_hash = $1 AND s.device_id IS NULL` for the cookie, `IS NOT NULL` for a
  bearer value) and, for a bearer session, in the stage (a row without a device is not accepted).
- **The role and its permissions are read with the lookup of every request** (RB-3); nothing
  about privilege is in the session row, the token or the cookie.
- **The principal is resolved before the throttle** (SR-75): tested by the throttle key the
  request is counted under (`operator:<id>`, `device:<id>`, else its class), and by 31 different
  unknown bearer values sharing one bucket.

## 4. The sign-in, statement by statement

`src/modules/identity/sign-in.ts`. Two units of the serial pipeline with the Argon2id derivation
between them (ENG-26). The timelines below are printed by `sequence.db.test.ts`, whose pool
records every statement on the pool ("pool") and on a unit's connection ("unit"); the names are
the constants of `session-store.ts`. Printed again, unchanged, by the run of 12:46:56 (saved in
`implementation/assets/24_test_db_verbose.txt`).

**Before the handler**, in `onRequest` and before the body is read: the stages; then the route's
own hook applies the console rule ID-1 (section 8). A caller without a console identity gets
403 `DEVICE_NOT_PAIRED`: no attempt, no derivation, no row.

**A success** (web console, no session presented):

```
lockout.take web                                    unit 1 `identity.signIn.attempt`: ONE ATTEMPT IS TAKEN (ENG-24). No statement: memory state
pool  FIND_SIGN_IN_CANDIDATE                        between the units: the hash set, by the trimmed, lower-cased username
Argon2id derivation                                 between the units, outside any transaction: ALWAYS, before any branch (ID-2)
unit  BEGIN ISOLATION LEVEL READ COMMITTED          unit 2 `identity.signIn.decide`
unit  chain lock
unit  statement timeout
unit  MARK_SIGNED_IN                                AT-C1: UPDATE operators … WHERE id = $1 AND enabled RETURNING …; no row = disabled meanwhile
unit  READ_ROLE_PERMISSIONS
unit  INSERT_SESSION                                the SHA-256 of a new token; absolute limit = now + 8 h
unit  INSERT audit_log AUTH_SUCCESS
unit  event number
unit  INSERT events AUTH_LOGIN
unit  COMMIT
lockout.succeed web                                 after the commit: the console's count and lock are cleared
```

With a valid session presented (ID-6), stage 4 adds `pool FIND_SESSION_BY_TRANSPORT.COOKIE`
before everything, and unit 2 adds `unit END_SESSION` (reason `ROTATED`, compare-and-set) between
`READ_ROLE_PERMISSIONS` and `INSERT_SESSION`; the row then says `replaced: true` and
`session.ended` is published after the commit.

**A failure**, of a known and of an unknown username alike (the test asserts the two timelines
are equal):

```
lockout.take web                                    unit 1
pool  FIND_SIGN_IN_CANDIDATE
Argon2id derivation                                 the stored record, or the fixed dummy record when the username matches nobody
denialBudget.consume                                BEFORE the row; from the 21st refusal of the key it throws 429 and no row is written
lockout.fail web                                    unit `identity.signIn.failed`
unit  BEGIN ISOLATION LEVEL READ COMMITTED
unit  chain lock
unit  statement timeout
unit  READ_OPERATOR_ENABLED                         for `details.reason: USER_DISABLED`; an unknown username asks for an ID no operator has
unit  INSERT audit_log AUTH_FAILED
unit  event number
unit  INSERT events AUTH_FAILED
unit  COMMIT
```

**An attempt during the lock**: not verified.

```
lockout.take web                                    unit 1: the console is locked
denialBudget.consume
pool  FIND_OPERATOR_ID                              the row names the operator only when the username matched one (ID-4)
unit  BEGIN ISOLATION LEVEL READ COMMITTED          unit `identity.signIn.locked`
unit  chain lock
unit  statement timeout
unit  INSERT audit_log AUTH_LOCKED
unit  event number
unit  INSERT events AUTH_LOCKED
unit  COMMIT
```

| Point | How it is met |
|---|---|
| The attempt is taken BEFORE the verification (ENG-24, AT-4, AT-6) | `lockout.take` is the whole of unit 1; the derivation starts after it returned a ticket |
| Only the derivation runs outside the pipeline (ENG-26) | The hash-set read is a read on the pool; every change is in a unit |
| The derivation always runs, before any branch (ID-2, SR-08) | One call of `verifyPassword` or `verifyAgainstDummy` per verified attempt; whether the operator exists, is enabled, and whether the tags matched is looked at afterwards |
| A disabled operator (ID-3, ID-4) | Wrong password: the failure unit, with `reason: USER_DISABLED`. Right password: unit 2 finds no row (`AND enabled`), changes nothing, and the failure unit follows: the same answer, no session. Disabled between the derivation and unit 2: the same (tested with a derivation that is followed by the disable on another connection) |
| One answer for every failure (ID-3) | 401 `INVALID_CREDENTIALS`, "The username or the password is not correct.", `details.attemptsRemaining`. The four bodies differ in nothing but the request ID of each request |
| One audit row per attempt (ID-4, SR-23) | `AUTH_SUCCESS`, `AUTH_FAILED` or `AUTH_LOCKED`; never a typed username, never a password |
| The password | Taken as sent; handed to the hash wrapper and to nothing else |
| SR-06 | After a success, if `needsRehash(record)`: a new derivation outside the pipeline, then `REPLACE_CREDENTIALS` (compare-and-set on the verified hash) in a unit of its own. A failure there is logged by its code and never fails the sign-in. No stored row can be weaker than the current parameters today (the table's CHECK is the same floor); tested with a hasher that says "weaker" |

The answer: a web console gets `{ session }` and the cookie; a device gets
`{ session, sessionToken }` and no `Set-Cookie`. Both carry `x-dems-epoch` and `x-dems-revision`
(API-7; section 9.6).

## 5. The lockout arithmetic

`src/modules/identity/lockout.ts`. Key: the console (`web`, or the device's registry ID), never
an address (ID-P3). Memory state; a restart clears it (SR-25).

| Rule | Detail |
|---|---|
| Counters | Two memory limiters of `rate-limiter-flexible` 11.2.1, 5 points each: ATTEMPTS taken, and FAILURES recorded. Nothing counts by hand |
| The window | 300 s, opened by the console's first taken attempt, by the server clock. As in the throttle, the window is decided by `app.clock` and named in the key the library counts under (`plugins/throttle/windows.ts`), because the library measures with the system time and takes no clock. A success, or the end of a lock, closes the window; a new window is a fresh count |
| `take` (unit 1) | Locked: refused, nothing taken. Else one attempt leaves the counter. **Taking the fifth attempt of a window locks the console at once, for 60 s from that instant** |
| `fail` | The failure is counted. `attemptsRemaining` is 5 minus the failures of the window (the simulator's meaning); the fifth failure is the locking one and carries `lockedUntil` |
| `succeed` (after the commit of unit 2) | The count and the lock are cleared |
| During the lock | Every attempt: 423 `LOCKED` with `lockedUntil` and `retryInMs`, `AUTH_LOCKED`, no derivation |
| The end of a lock | A fresh count |
| The fifth failure | Answers 423 `LOCKED` (as the simulator's result for the locking failure, and AC-B-25), with an `AUTH_FAILED` row whose details say it locked |

Why the lock is set at the take: with "consume, then verify", five attempts can be in flight at
once. Whoever comes sixth must be refused although none of the five has failed yet, and the
refusal needs an end time. If one of the five is right, the lock is lifted with the count. An
attempt that never reports back (a failed derivation, a pipeline outage) leaves the console
locked for its 60 s and no longer.

A failure whose window is over (a success cleared it, its lock ended, or 300 s passed) counts
where the console stands now, so what remains after a burst is the number of failures since the
last success, whatever the order in which the verifications ended (ENG-24).

Worked example, 20 at once (`concurrency.db.test.ts`, output of 12:46:56):

```
[w24] AC-B-80: 20 concurrent wrong sign-ins: 5 derivations; statuses {"401":4,"423":16}; 5 AUTH_FAILED (attemptsRemaining 4, 3, 2, 1, 0), 15 AUTH_LOCKED
```

Four 401, one 423 for the locking failure, fifteen 423 for the attempts that found the console
locked. The 20 rows are the key's whole denial budget, so the next request of the key answers
429 at stage 5 and writes no row; 60 s later the lock and the budget are over and the right
password signs in (same test).

## 6. The cookie

`src/modules/identity/cookie.ts`; written through `@fastify/cookie`, which the scaffold registers.

| Item | Value | Test |
|---|---|---|
| Name | `dems_session_<listen port>` (`app.config.sessionCookieName`) | `tokens-cookie.test.ts` (4420 and 4422); `two-instances.db.test.ts` |
| On a web sign-in | `dems_session_4420=<token>; Path=/; HttpOnly; SameSite=Strict` | `tokens-cookie.test.ts` (the exact header); `sign-in.db.test.ts` "sets dems_session_<listen port> with exactly HttpOnly; SameSite=Strict; Path=/ …" |
| Never | `Secure`, `Domain`, `Max-Age`, `Expires`, `Partitioned`, `Priority`, a `__Host-` prefix, a signature | the same tests; `static.test.ts` "SR-61" |
| On a web sign-out | `dems_session_4420=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict` (ID-9) | `tokens-cookie.test.ts`; `sessions.db.test.ts` "a web console: 204, the cookie cleared …" |
| Who gets `Set-Cookie` | Only the answer to a web console's successful sign-in (set) and to a web session's sign-out (clear). No answer to a request with a bearer credential, no answer to a device, no refusal | `authenticate.db.test.ts` "no answer to a device carries Set-Cookie: every operation of the identity core, success and refusal" (a table of requests by the device credential, by its session and without a credential, then the locked device console); "on the web, only a successful sign-in sets the cookie and only a sign-out clears it" |
| The token | Only in the cookie for the web; never in the body | `sign-in.db.test.ts` (the body has the one key `session` and no token form) |

The attributes are a set: the plugin writes them in the order `Path`, `HttpOnly`, `SameSite`.

## 7. Sessions: limits, activity, the sweeper

`src/modules/identity/sessions.ts`, `session-store.ts`.

| Rule | Detail |
|---|---|
| A session | A row of `auth_sessions`; the token is 32 bytes of `crypto.randomBytes` as base64url behind `ses_`; only its SHA-256 (over the whole value, prefix included) is stored. No token is compared in this process: a presented value is found by its hash |
| Idle limit | Expired when `last_seen_at <= now - 15 min` |
| Absolute limit | `absolute_expires_at = issued_at + 8 h`, stored at issue; expired when `now >= absolute_expires_at`. It wins when both hold |
| Where it is decided | When a token is presented (`resolve`), and by the sweeper (`sweep`); both with the same statement shape, `UPDATE … SET ended_at, end_reason = CASE … WHERE ended_at IS NULL AND (past a limit) RETURNING …`. The reason is decided by the statement, on the row it holds locked (AT-3) |
| On expiry | In the same unit: `AUTH_EXPIRED` (`details.reason` `IDLE` or `ABSOLUTE`) and the event; after the commit `app.publish({ kind: 'session.ended', sessionIds, reason })` |
| Activity (ID-P9) | A POST of an operator that reaches its handler, and `touchSession` (which is such a POST). One `preHandler` hook of the `authenticate` plugin, for every route of every module: `UPDATE … SET last_seen_at = $2 WHERE id = $1 AND ended_at IS NULL AND last_seen_at < $2 AND (not past a limit) RETURNING`. At most one write a second per session. A GET and a socket upgrade never touch. `signIn` and `signOut` are exempt: their own unit settles the session |
| A session that ended between stage 4 and the handler | The hook's statement returns no row; the POST answers 401 and the command does not run |
| A touch never revives | The predicate of the touch states "not past a limit"; if it matches nothing because the session is past a limit, the same unit ends it with `AUTH_EXPIRED` |
| Sign-out | One compare-and-set statement; `AUTH_SIGNED_OUT` with `reason` `USER` or `LOCK`; `session.ended` published. A session that was ended already gets no second row |
| The sweeper | `sweep()`: one read (`ANY_EXPIRED_SESSION`); only when something is past a limit, ONE unit with one statement that ends them all, one `AUTH_EXPIRED` row and event each, and one publication per reason. The timer (`sweeper.ts`) calls it every 5 s of real time, one sweep at a time; it starts in `onListen` and stops in `preClose`, so an app that does not listen has no timer. What is expired is decided by `app.clock`: a test moves the clock and calls `app.sessionRegistry.sweep()` |
| A read that fails | 503 `NOT_READY`, one error line by the driver's code, one persistent entry, a fresh readiness probe. Never the driver's message |

## 8. Operations 2 to 6

`src/modules/identity/routes.ts`. Method, path and schemas are the registry's; each route names
its operation in `config.operationId`.

| # | Operation | What it does | Refusals of its own |
|--:|---|---|---|
| 2 | `signIn` | Section 4. Console rule ID-1 in the route's `onRequest`: a web console (`Origin` category `WEB_CONSOLE`, no `Authorization` header) or a paired device (a DEVICE principal, or an OPERATOR bound to a device). The instance's own origin and "no Origin" are no console | 403 `DEVICE_NOT_PAIRED`; 403 `DEVICE_REVOKED` for a retired device (finding F-5); 401 `INVALID_CREDENTIALS`; 423 `LOCKED` |
| 3 | `getSignInStatus` | The lock state of one console: the device's when the request speaks for a paired device, the web console's otherwise (OP-1). Memory only: no statement. Needs no console identity | 403 `DEVICE_REVOKED` for a retired device |
| 4 | `getAuthSession` | The caller's session, from what stage 4 read for this request | 401 `NOT_SIGNED_IN` |
| 5 | `signOut` | Section 7; 204; the cookie cleared for a web session only | 401 |
| 6 | `touchSession` | The activity hook recorded the activity; the answer is `{ idleExpiresAt, absoluteExpiresAt }` | 401 |

Operations 4 to 6 carry `onRequest: operatorOnly` beside the access stage, so "who the caller
is" (401, 403) always comes before "what the body holds" (400, 422), with or without the access
rule of W28 in front (spec §7.3).

Audit rows and events (`activity.ts`), each pair as the shared simulator writes it:

| Audit type | Event | Actor | Device | Details |
|---|---|---|---|---|
| `AUTH_SUCCESS` | `AUTH_LOGIN` | the operator | the console's device or null | `method`; `replaced: true` when a presented session was ended |
| `AUTH_FAILED` | `AUTH_FAILED` | the operator the username matched, or null | the same | `method`, `knownOperator`, `attemptsRemaining`, `lockedUntil`; `reason: USER_DISABLED` |
| `AUTH_LOCKED` | `AUTH_LOCKED` | the same rule | the same | `method`, `retryInMs`, `lockedUntil` |
| `AUTH_SIGNED_OUT` | `AUTH_LOGOUT` | the operator | the session's device or null | `reason` (`USER`, `LOCK`) |
| `AUTH_EXPIRED` | `AUTH_EXPIRED` | the operator | the same | `reason` (`IDLE`, `ABSOLUTE`) |

These five are among the simulator's 44 types, so the general rules of the audit writer apply and
the closed allow-list of the nine server-written types is not involved. No key was missing.

## 9. The seams, with their types

### 9.1 For the pairing row (W32): `app.deviceResolver`

The seam and its type are the scaffold's (`src/modules/pairing/index.ts`), unchanged:

```ts
interface ResolvedDevice { readonly status: 'PAIRED' | 'RETIRED'; readonly deviceId: string }
interface DeviceResolver {
  resolveCredential(credential: string): Promise<ResolvedDevice | null>;   // a `Bearer dvc_…` value, as sent
  resolveDevice(deviceId: string): Promise<ResolvedDevice | null>;         // the device of a session row
}
```

| Point | Statement |
|---|---|
| Default while unfilled (the scaffold's stub: null for everything) | **Deny.** A device credential is ANONYMOUS; a device session token is ANONYMOUS (`DEVICE_UNKNOWN`); `signIn` from a device answers 403 `DEVICE_NOT_PAIRED`. Tested: `authenticate.db.test.ts` "the seam deviceResolver while the pairing module has not filled it > denies …" |
| When stage 4 calls it | `resolveCredential(value)`: once per request that presents `Bearer dvc_…` of the exact form. `resolveDevice(deviceId)`: once per request that presents `Bearer ses_…` which finds a session row, open or ended |
| What it reads from the answer | `PAIRED`: a principal. `RETIRED`: `{ kind: 'ANONYMOUS', retiredDeviceId }`. null: ANONYMOUS |
| What the pairing row calls | Inside its own unit: `await app.sessionRegistry.endForDevice(unit, deviceId, 'DEVICE_REVOKED' \| 'DEVICE_UNPAIRED')`, which returns the IDs of the ended sessions (for `sessionsEnded` of its row). No row is written by the registry. A session ended with one of these two reasons retires its token by itself, also before the resolver says RETIRED |
| Not built here | Pairing, device credentials, biometric tokens |

### 9.2 For the RBAC guard (W28)

- `request.principal`: the scaffold's `Principal`, unchanged in shape and name.
- `authenticationOf(request): Authentication` (`src/plugins/authenticate`):

```ts
interface Authentication {
  readonly presented: 'NONE' | 'COOKIE' | 'BEARER';
  readonly failure: 'MALFORMED' | 'UNKNOWN' | 'ENDED' | 'OPERATOR_DISABLED' | 'DEVICE_UNKNOWN' | 'DEVICE_RETIRED' | null;
  readonly session: OpenSession | null;      // the session of an OPERATOR, with its operator profile and permissions
}
```

- `notSignedIn()`, `credentialConflict()`, `operatorSessionOf(request)` (the session, or the 401).
- From `src/modules/identity`: `consoleIdentityOf(app, request): ConsoleIdentity | null`,
  `requireConsoleIdentity(app, request)`, `refuseRetiredDevice(request)`, `deviceNotPaired()`,
  `deviceRevoked()`: the access condition `CONSOLE_IDENTITY` of the registry, if the guard
  applies conditions itself.
- The identity routes do not check permissions; none of operations 2 to 6 carries one.

### 9.3 For the realtime row (W42): how a socket upgrade resolves a session

The upgrade request passes the stages like any request, so in the socket route:

| The route reads | Meaning |
|---|---|
| `request.principal` | OPERATOR (cookie of a web session with a web console origin; bearer session of a paired device), DEVICE (a device credential), or ANONYMOUS |
| `authenticationOf(request)` | `presented: 'COOKIE'` with a failure: the cookie no longer resolves (`hello.reason: SESSION_INVALID`). `presented: 'BEARER'` with `DEVICE_RETIRED`: close 4403. `presented: 'BEARER'` with any other failure: close 4401 |
| nothing, for two credentials | Stage 4 has already answered HTTP 401 at the handshake |

`authenticationOf` is the single resolver: it applies the "own cookie name only" rule, and no
function resolves a credential a second time. A socket is a GET: it never extends a session.
Sessions are re-validated by the publications the registry and the sign-in send after their
commits: `app.publish({ kind: 'session.ended', sessionIds, reason })` with `SIGNED_OUT`,
`IDLE_EXPIRED`, `ABSOLUTE_EXPIRED` or `ROTATED`; the channel maps `sessionIds` to its sockets
(`principal.sessionId`).

### 9.4 The seam `app.sessionRegistry`: final type

```ts
interface SessionRegistry {
  resolve(token: string, transport: 'COOKIE' | 'BEARER'): Promise<SessionResolution>;
  touch(sessionId: string): Promise<TouchOutcome>;
  endForOperator(unit: UnitOfWork, operatorId: string, reason: 'USER_DISABLED'): Promise<readonly string[]>;
  endForDevice(unit: UnitOfWork, deviceId: string, reason: 'DEVICE_REVOKED' | 'DEVICE_UNPAIRED'): Promise<readonly string[]>;
  endBiometricSessions(unit: UnitOfWork, deviceId: string, operatorId: string): Promise<readonly string[]>;   // reason TOKEN_REUSE
  sweep(): Promise<readonly EndedSession[]>;
}
type SessionResolution =
  | { status: 'OPEN'; session: OpenSession }
  | { status: 'UNKNOWN' }
  | { status: 'ENDED'; sessionId: string; deviceId: string | null; endReason: SessionEndReason }
  | { status: 'OPERATOR_DISABLED'; sessionId: string; deviceId: string | null };
type TouchOutcome = { status: 'TOUCHED' | 'UNCHANGED'; lastSeenAt: number } | { status: 'ENDED' };
```

The three `end…` members run in the CALLER's unit of work, return the IDs, write no row and
publish nothing: the caller's audit row counts them and the caller publishes after its commit
(the administration module: `session.ended` with `USER_DISABLED`).

### 9.5 For the biometric row (W41) and for tests: `identityControl(app)`

```ts
interface IdentityControl extends SessionRegistry {
  readonly lockout: ConsoleLockout;    // take(key, now), fail(key, ticket, now), succeed(key), status(key, now), reset(key?)
  hasher: PasswordHasher;              // replaceable: createPasswordHasher({ derive: vi.fn(deriveArgon2id) })
  readonly sweeper: Sweeper;
}
```

Exported for `biometric/`: `issueSession(unit, { operatorId, deviceId, method, now })`, the
activity builders (`signedIn`, `attemptFailed`, `attemptLocked`, `appendActivity`),
`pairedDeviceOf(request)`, `authSessionInfo`, `invalidCredentials`, `consoleLocked`. Operations 8
and 9 take their attempt from the same lockout, under the device's key. Decision DN-6: its
routes need one registration line in `src/modules/identity/index.ts`.

### 9.6 What this row reads from the engine seam (W26)

`app.engine.epoch` and `app.engine.revision`, for the headers `x-dems-epoch` and
`x-dems-revision` on the 2xx answers of the three POSTs (API-7). The rows a unit of this module
appended are taken into the engine when the unit commits, before the handler continues, so the
value read there is the revision that holds them. Proven with a booted engine, on a manual timer, in
`engine.db.test.ts`: the header of a sign-in equals the revision of the published state change
that appends its `AUTH_SUCCESS` row; the chain verifies over all rows; no `audit head diverged`.

## 10. The controller's notes during the row

### 10.1 D69: what the mobile app really sends

| Point of the note | Where it is met | Test |
|---|---|---|
| The conflict looks only at this instance's cookie name | `credentials.ts`: `cookies[cookieName]`; the same expression as `origin-guard/index.ts:83` | `credentials.test.ts` "D69: another instance's cookie and a foreign cookie are not credentials", "D69: a bearer value beside other cookies is the bearer credential, not a conflict"; `authenticate.test.ts` and `authenticate.db.test.ts` blocks "D69 …" |
| A bearer request with `dems_session_<another port>` and an unrelated cookie resolves as the bearer session | the same | the same blocks (unit and database form; the database test sends `Host: 127.0.0.1:4420`, `User-Agent: okhttp/4.12.0`, `Origin` the own origin) |
| A bearer request with this instance's own cookie is the 401 | the same | `authenticate.test.ts` "a bearer request that carries this instance's own cookie is the 401"; `authenticate.db.test.ts` "a bearer request with this instance's own cookie is the 401" |
| No `Set-Cookie` on any answer to a bearer request or to a device, the sign-out included | `routes.ts`: the set is behind `consoleIdentity.kind !== 'DEVICE'` (a web console has no `Authorization` header by ID-1), the clear behind `session.deviceId === null` | `authenticate.db.test.ts` "no answer to a device carries Set-Cookie: every operation of the identity core, success and refusal"; `sessions.db.test.ts` "a device: 204 and NO Set-Cookie header …"; `static.test.ts` "the routes set the cookie in one place and clear it in one place" |
| Nothing keyed on `Host` or `User-Agent`; no `Origin` expected of a device | No file of the row reads either header; the device path of ID-1 is the principal, not the Origin | `authenticate.test.ts` "neither Host nor User-Agent nor the presence of an Origin changes what a bearer resolves to" |
| A resolver for the upgrade | `authenticationOf(request): Authentication` in `src/plugins/authenticate`; section 9.3 | `authenticate.test.ts` "a request with an Upgrade header is resolved like any request …" |

### 10.2 D72: the request-guards row's test file

Section 14 has the two insertions by file and line. Condition 2 of the ruling: the combination
"this instance's cookie AND a bearer value" is tested through the REAL stage 4 in this row's
files, for the three request shapes that the changed block had covered:

| Request shape | Database-free (`authenticate.test.ts`) | Against PostgreSQL (`authenticate.db.test.ts`) |
|---|---|---|
| No `Origin`, GET | "no Origin, GET: 401 NOT_SIGNED_IN with details.reason CREDENTIAL_CONFLICT; nothing is resolved, no row, no place in the denial budget, no Set-Cookie" | "answers 401 CREDENTIAL_CONFLICT on every request shape; no audit row, no place in the denial budget, no Set-Cookie, and both sessions stay as they are" (GET `getAuthSession`) |
| A web console origin, GET | "a web console origin, GET: …" | the same test |
| A web console origin, POST | "a web console origin, POST: …" | the same test (POST `touchSession`, `signOut`, `signIn`) |

Asserted in each: status 401, code `NOT_SIGNED_IN`, `details.reason: CREDENTIAL_CONFLICT`, a body
that validates against `ApiErrorSchema`, the five response headers, no `Set-Cookie`; no lookup
(the registry and the device resolver are not called); no audit row (RB-6: the trail has the
same length) and no unit of work; `used: 0` in the denial budget of `class:web`, `class:local`
and both operators' keys; in the database form both sessions unchanged and each credential
alone still valid. Condition 3: the whole `unit` project exit 0 with `origin-guard.test.ts` at
151 / 151 (12:32:13 and 12:46:33; the file alone 151 / 151 at 12:32:34).

### 10.3 D77: the engine host has landed

| Point of the note | What was done |
|---|---|
| 1. The emptied test in `readiness.test.ts` | Checked which seams are still stubs today: `deviceResolver` (W32) and `publish` (W42) answer without throwing and are asserted in the same file by "the seams that answer as they are: a working clock, a publish that does nothing, a resolver that knows no device, …" (lines 236 to 245); the access rule of W28 is a stage that lets every request through, not a seam of that test. The test "the stubs that are not implemented say which row fills them" named only stubs that THROW with their row: `originDecision` (W23), `sessionRegistry` (W24), `engine` (W26). All three are filled, so nothing is left for it to assert: **the test and its comment were deleted** (section 14, change 3). Lint of the workspace: exit 0, no warning |
| 2. A database test that boots the engine | One test file of this row calls `app.readiness.boot()`: `src/modules/identity/__tests__/engine.db.test.ts`. It uses a manual clock and looked at the LAST three rows of the trail. Changed: `engineControl(app).useTimer(manualTimer().timer)` before the boot, so the engine ticks only when the test fires it; the length of the trail is taken AFTER the boot (and after `engineControl(app).idle()` and `pipeline.drain()`), and the three identity rows are asserted relative to it, not relative to the seed or to the end of the trail. The test then fires ONE tick on top of them and verifies the chain over all rows again. Three runs of the file: 3 / 3 tests each (12:45:52 to 12:45:55). No other test of this row boots the engine: `identityApp` of `support.ts` sets the two readiness flags itself |
| 3. Whether a sign-in or a sign-out must be mirrored to the engine's `operators` slice | **No, for none of operations 2 to 6**, so this module does not call `app.engine.mirrorOperators()`. Reasons: (a) the slice is `SimOperator` (`packages/shared/src/sim/types.ts:231`): `id`, `username`, `rank`, `name`, `displayName`, `initials`, `role`; ENG-3 asks that it equals the table in "identity fields and role". The only operator columns this row writes are `last_sign_in_at` and `updated_at` (statement `MARK_SIGNED_IN`), neither of which is in the slice; a sign-out, a touch and an expiry write no operator row. (b) Spec §4.7 names "the engine's `operators` mirror updated" for `assignUserRole` only; its rows for "Sign-out" and "Session expired" ask for `session.ended`, which this module publishes after the commit; it has no row for a sign-in. (c) `lastSignInAt` is a member of `AdminUser` (spec line 1049), read through REST by the administration row. What a client sees of these operations: the audit row and the event of each, as a state change of the engine (proven in `engine.db.test.ts`), and `session.ended` |

One observation that follows from (c), not a gap of this row: after a sign-in the Users list of
another console shows the old `lastSignInAt` and `activeSessions` until it is fetched again; the
specification asks for no `admin.changed` there.

## 11. Verification

### 11.1 The row command (12:47:00)

```
$ DEMS_TEST_STEP=46 npm run test:db -w @dems/core-server -- src/modules/identity src/plugins/authenticate

> @dems/core-server@0.2.0 test:db
> vitest run --project db src/modules/identity src/plugins/authenticate

 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/core-server

[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_46_tmdc2ce2_
[test:db] stale sweep: dropped 0; kept 0 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
[test:db] template dems_test_step_46_tmdc2ce2_tpl_schema: built in 78 ms (create 28 ms, hook 48 ms)
[test:db] template dems_test_step_46_tmdc2ce2_tpl_seed: built in 124 ms (create 42 ms, hook 80 ms)

 Test Files  8 passed (8)
      Tests  93 passed (93)
   Start at  12:47:00
   Duration  4.24s (tests 60%, import 30%, transform 10%)

[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 2 database(s) in 37 ms; 0 remain with the run prefix dems_test_step_46_tmdc2ce2_
exit=0
```

(The lines the tests print themselves, quoted in 11.2, are left out here. The line "forced drops
that needed a retry" is the helper's, decision D76.) The same command gave the same totals at
12:18:14 and 12:32:56, with every production file as it is now.

### 11.2 What the tests printed (verbose run, 12:46:56, exit 0, 93 pass marks)

The full outputs are `implementation/assets/24_test_db_verbose.txt` (this run) and
`24_test_unit_verbose.txt` (12:22; every test by name; no credential-shaped value in either:
`grep -c` gives 0).

```
[w24] AC-B-80: 20 concurrent wrong sign-ins: 5 derivations; statuses {"401":4,"423":16}; 5 AUTH_FAILED (attemptsRemaining 4, 3, 2, 1, 0), 15 AUTH_LOCKED
[w24] AC-B-28 dump of dems_test_step_46_tmdc28do_f01_secrets: 156913 characters; 12 secrets and markers searched in 6 forms each, 0 found; 5 session tokens issued, 5 rows in auth_sessions, each token's SHA-256 present once
[w24] AC-B-29 log capture: 21513 characters, 102 lines, 26 request lines; 0 secrets, 0 markers, 0 credential-shaped values
```

and the three timelines of section 4.

### 11.3 The module gate (MODG)

```
[w24] MODG routes of src/modules/identity: POST /api/v1/auth/sign-in signIn | GET /api/v1/auth/status getSignInStatus | GET /api/v1/auth/session getAuthSession | POST /api/v1/auth/sign-out signOut | POST /api/v1/auth/touch touchSession
[w24] MODG registry, operations 2 to 6:    POST /api/v1/auth/sign-in signIn | GET /api/v1/auth/status getSignInStatus | GET /api/v1/auth/session getAuthSession | POST /api/v1/auth/sign-out signOut | POST /api/v1/auth/touch touchSession
```

(`routes.test.ts`; lines 59 and 60 of the saved unit output.) The registry's Identity area has eight operations:
2 to 6 are this module's and are registered; 7 to 9 (the biometric token) are W41's and are not.

| # | Operation | Success test | Validation test (a body) | Refusal test |
|--:|---|---|---|---|
| 2 | `signIn` | D1 "sets dems_session_<listen port> …", "gets the token in the body, bound to the device …" | D1 block "the body of signIn is validated before an attempt is taken" (5 schema cases, malformed JSON, and the normalised username) | D1 blocks "ID-1, SR-69", "AC-B-24", "AC-B-25" |
| 3 | `getSignInStatus` | D1 block "AC-B-25" (the answer validated against the contract; a device reads its own console's state); U6 "getSignInStatus needs no console identity …" | no body | D1 "a retired device is told so, and writes no session" (403 `DEVICE_REVOKED`) |
| 4 | `getAuthSession` | D2 "answers the caller's own session, valid against the contract …" | no body | the same test (401) |
| 5 | `signOut` | D2 "a web console: 204 …", "a device: 204 …" | D2 "a body that breaks its schema answers 422 …" | the same test (401); U6 |
| 6 | `touchSession` | D2 "a GET does not extend the session; a POST and touchSession do" | no body | D2 (401); U6 |

No operation of the row carries a permission, so none has a denial test of the guard's kind.
Every test runs in-process (`app.inject`) on the file's own clone of the seed template. No port
is bound: nothing calls `listen`, and a static test keeps `listen(` out of the two folders.

### 11.4 The cases of plan W24

| Case | Test | Result |
|---|---|---|
| The cookie with exactly `HttpOnly; SameSite=Strict; Path=/`, no `Max-Age`, no `Expires` | D1 "sets dems_session_<listen port> with exactly …"; U4 "is set as dems_session_<listen port>=<token> with those three attributes and nothing else" | PASS |
| Two instances with one cookie jar keep both sessions valid | D4, 5 tests | PASS |
| Byte-identical failure bodies; exactly one Argon2id call per attempt | D1 "gives byte-identical bodies, one AUTH_FAILED row each, and exactly one Argon2id derivation per attempt" (four cases); D6 "a failure of a known and of an unknown username: the same work, step for step" | PASS |
| 20 concurrent wrong-password sign-ins verify exactly five attempts and answer 423 to the other 15 | D3 "verifies exactly five attempts (five AUTH_FAILED rows, the fifth marked as locking) and answers 423 with AUTH_LOCKED to the other 15" | PASS |
| Lock at the fifth failure, release after 60 s | D1 "the fifth failure locks: 423 with lockedUntil; attempts during the lock write AUTH_LOCKED and are not verified; after 60 s a correct sign-in succeeds"; U3 | PASS |
| Idle expiry at 15 minutes, absolute at 8 hours | D2 block "AC-B-26" (5 tests) and "a session past both limits is ended as ABSOLUTE …" | PASS |
| A dump and a log capture hold no secret and no marker, with a `?token=<marker>` request and malformed JSON holding a marker | D5 (6 tests) | PASS |
| A sign-out racing a request; two sign-ins of one operator; the sweeper racing a request | D3 (section 11.5) | PASS |

(U3 = `lockout.test.ts`, U4 = `tokens-cookie.test.ts`, U6 = `routes.test.ts`, D3 =
`concurrency.db.test.ts`, D5 = `secrets.db.test.ts`, D6 = `sequence.db.test.ts`.)

### 11.5 The concurrency tests and the isolation each relies on

All in `concurrency.db.test.ts`, against PostgreSQL, requests issued together with `Promise.all`.

| Test | Relies on |
|---|---|
| 20 concurrent wrong-password sign-ins: 5 verified, 15 locked; a correct password arriving eighth in a burst of 12 is refused with the lock, never a sixth verification | The attempt is TAKEN in unit 1 of the serial pipeline, before the derivation (ENG-24, AT-6); the counter changes before the unit's first `await`; taking the fifth attempt locks at once. No SQL is involved in the count: it is memory state by the contract |
| 25 at once: 20 rows, five 429 without a row (SR-71) | `app.denialBudget.consume(request)` before every refusal row |
| Two sign-ins of one operator on two consoles: two sessions, two tokens, two `AUTH_SUCCESS` | Each second unit is one transaction (AT-1); ID-7 allows several sessions |
| Two sign-ins presenting the same session: it is ended exactly once, one row says `replaced` | `UPDATE auth_sessions SET ended_at = $2, end_reason = $3 WHERE id = $1 AND ended_at IS NULL RETURNING …`: the row count decides (AT-3) |
| A sign-out racing reads, touches and a second sign-out: one `AUTH_SIGNED_OUT`, the ended row never written again, every later request 401 | The same compare-and-set; the touch states `ended_at IS NULL` in its WHERE |
| The sweeper racing requests on idle sessions: each session ended once, one `AUTH_EXPIRED` each | The expiry statement states `ended_at IS NULL AND (past a limit)` in its WHERE; whichever unit runs first gets the row |
| Statement level, on two real connections of `dems_app`, each in its own READ COMMITTED transaction: an expiry that waits behind an uncommitted touch ends nothing after the touch commits; a touch that waits behind an expiry writes nothing | PostgreSQL evaluates the WHERE again on the committed row after the row lock is released (PG-24). The first statement is shown to WAIT (it has not answered after 150 ms) before the other transaction commits |

In one server process the pipeline is serial, so the HTTP-level races are ordered by arrival;
the statement-level test shows that the statements are right by themselves, as the contract
asks (§5.6: "the database does not rely on the pipeline being serial").

### 11.6 Whole projects, typecheck, lint (final state)

```
$ npm run test -w @dems/core-server -- --maxWorkers=2                                (12:46:33)
 Test Files  70 passed (70)
      Tests  1847 passed (1847)
   Start at  12:46:33
   Duration  10.64s (import 53%, tests 41%, transform 5%, worker 1%)
unit exit=0

$ npm run typecheck -w @dems/core-server      exit=0     (12:46:44)
$ npm run lint -w @dems/core-server           exit=0     (12:46:47; no warning line in the output)

$ DEMS_TEST_STEP=46 npm run test:db -w @dems/core-server -- --maxWorkers=2           (12:47:05)
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_46_tmdc2hec_
 Test Files  45 passed (45)
      Tests  623 passed (623)
   Start at  12:47:05
   Duration  42.53s (tests 90%, import 9%, transform 1%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 8 database(s) in 115 ms; 0 remain with the run prefix dems_test_step_46_tmdc2hec_
exit=0

$ npm run test -w @dems/core-server -- --maxWorkers=2 src/modules/identity src/plugins/authenticate   (12:32:32)
 Test Files  11 passed (11)
      Tests  210 passed (210)          (8 files and 136 tests of this row; 3 files and 74 tests of the hash wrapper)
exit=0

$ npm run test -w @dems/core-server -- --maxWorkers=2 src/plugins/origin-guard/__tests__/origin-guard.test.ts   (12:32:34)
 Test Files  1 passed (1)
      Tests  151 passed (151)
exit=0

$ npm run test -w @dems/core-server -- --maxWorkers=2 src/plugins/readiness                           (12:45:42, after the change of D77)
 Test Files  2 passed (2)
      Tests  32 passed (32)
exit=0
```

The whole `unit` project has one test fewer than at 12:32:13 (1,848): the emptied test of the
scaffold that was removed under D77 (section 14).

Between the green whole `db` run of 12:19:04 and the final runs this row changed no production
file. It changed five TEST files: a lint warning removed in `sessions.test.ts`; eight test names
reworded in `tokens-cookie.test.ts`; the parameter order of one test table in
`sign-in.db.test.ts` (its titles had printed "NaN" for a status); `engine.db.test.ts` (a manual
timer for the engine, D77); and the emptied test removed from `readiness.test.ts` (D77).

### 11.7 Every run of the whole projects, and what was not this row's (P11)

| Time | What | Result | Note |
|---|---|---|---|
| 11:19:38 | `unit` | 41 files, 1,281 passed | Baseline, before the first edit |
| 11:19:57 | `db` | 28 files, 388 passed | Baseline (the controller's 11:09 figure was 27 / 382; another row had added one file since) |
| 11:39:36 | `unit` | 7 failed, 1,534 passed, 3 of 51 files red | With the real stage 4 in the tree: 4 in `origin-guard.test.ts` and 1 in `readiness.test.ts`, by design (section 14); **2 in `src/core/__tests__/core-plugin.test.ts`, not this row's**: a new boot step `engine.rehydrate` of the engine row in flight |
| 11:42:12 | `unit`, two folders | 1 failed | `readiness.test.ts` "the stubs that are not implemented …": the engine row's own two assertions, after its seam was filled. Not this row's; gone once that row deleted its lines (the file's date is 11:44) |
| 12:01:13 | typecheck | exit 2 | One error of this row's test (fixed at once), then `src/engine/__tests__/commands.db.test.ts(540,68)` TS2304, the engine row's file in flight. Exit 0 at 12:09:08 and after |
| 12:18:44 | `unit` | 69 files, 1,805 passed | |
| 12:19:04 | `db` | 44 files, 616 passed, exit 0 | The last green whole run |
| 12:21:27, 12:22:43 | `unit` | 69 files, 1,805 passed | |
| 12:32:13 | `unit` | 70 files, 1,848 passed, exit 0 | |
| 12:33:03 | `db` | **1 failed**, 622 passed; 1 of 45 files red; exit 1 | **Not this row's**: `src/db/reset/__tests__/reset-failures.db.test.ts` > "R-4: the staging database cannot be created" > "a database of that name appears after R-2: CREATE fails with 42P04, the target is untouched" (3,225 ms). Load 7.6 |
| 12:34:17 | `db`, that file alone | **2 failed**, 46 passed; exit 1 | Other tests of the same file: "a forced failure at every checkpoint …" > "R-0" (3,048 ms) and "R-5 …" > "the migrations cannot be applied (R-5a): the staging database is dropped again" (3,174 ms). Load 6.5 |
| 12:34:56 | `db` | **1 failed**, 622 passed; 1 of 45 files red; exit 1 | The same file, "R-0" (3,063 ms). Load 6.6 |
| 12:46:33 | `unit` | 70 files, 1,847 passed, exit 0 | Final |
| 12:47:05 | `db` | **45 files, 623 passed, exit 0** | Final. Load 2.0; the helper reported "kept 0 of younger runs" five seconds before: no other database run was in flight |

The red of 12:33 to 12:36 (finding F-20). The assertion that fails is the same each time,
`reset-failures.db.test.ts:100`: "sessions of the routine: expected [ { application:
'dems-db-reset-failures', database: 'postgres', role: 'dems_owner' } ] to deeply equal []", after
a wait of about 3 s; the test that fails changes from run to run. The file is dated 11:40 and
passed in the whole run of 12:19:04. Nothing of this row is on its path: the reset routine and its
tests import nothing from `modules/identity` or `plugins/authenticate`, and this row's files pass
in the same runs. Reported, re-run, all recorded (P11). At 12:47:05 the same file passed in the
whole run, with no file of that row changed by this row. **Hypothesis, supported by that run but
not proven:** the check counts sessions by application name on the whole server, so a run of the
same file by another agent at the same moment is seen as a leftover (the helper reported "kept 7
of younger runs" at 12:32:56 and "kept 0" at 12:47:00), or the routine's session closes later
than 3 s under load (6.5 to 7.6 at the red runs, 2.0 at the green one).

The 1-minute load average was between 1.8 and 7.7 during the row (3.8 at 12:47); no test of this
row timed out.

## 12. Mutation check

68 defects were planted one at a time and the row's own tests (8 `unit` files, 8 `db` files) run
on each. **68 of 68 detected.** No file of the repository was changed for it: a scratch Vitest
configuration outside the repository adds one transform that hands ONE production file to
Vitest with ONE text replaced, so no other row's run saw a mutated file
(`implementation/assets/24_mutation_harness.vitest.config.mjs.txt`, `24_mutation_harness.run.sh.txt`,
`24_mutations.json`; result lines `24_mutations.log`).

| Pass | Result |
|---|---|
| First, 12:07:09 to 12:15:08, 64 mutations | 62 detected. **M23** (a stale ticket's failure is counted without taking its attempt) and **M42** (the bearer lookup without `device_id IS NOT NULL`) survived |
| What was done | M23: `lockout.test.ts` now asserts that after such failures exactly one attempt is left and that taking it locks. M42: the stage's own check made the mutant invisible at HTTP level (two guards for ID-13); `authenticate.db.test.ts` now tests the lookup itself on both transports. Also added: a fail-closed line in `resolve` and a database-free test file for the registry |
| Second, 12:16:24 to 12:18:05 | M23 and M42 detected; four new mutations of the added lines (M65 to M68) detected; three mutations of `sessions.ts` repeated, detected |

Among the 68: any `dems_session_` cookie counted as the instance's own; the conflict not
refused, answered 403, without its reason, or needing a well-formed bearer value; either
transport predicate removed in the statement or swapped in the stage; a retired or unknown
device resolving; a GET counted as activity; no attempt taken before the verification; no
derivation for an unknown username; unit 2 without `AND enabled`; no rotation; another message
for an unknown username; no place taken in the denial budget; the cookie with `Max-Age`,
`SameSite=Lax` or without `HttpOnly`; a cookie set for a device, cleared for a device; the own
origin counted as a web console; the console rule after the body; each limit off by one
millisecond; a touch that revives; an end or an expiry that is not compare-and-set; idle winning
over absolute; no publication; the hash without the prefix; a 128-bit token; the sweeper started
by the factory; a failed read that logs the driver's message.

Limit of the check: the static test file reads the sources from disk, not through the
transform, so it cannot see these mutations; the two mutations it is about (M34, M35) were
detected by the database tests.

## 13. Test ledger (P24)

`@dems/core-server` only. No other workspace was written.

| Project | Before (11:19) | After (final) | This row |
|---|---|---|---|
| `unit` | 41 files, 1,281 tests | 70 files, 1,847 tests, 0 failed (12:46:33) | **+8 files, +136 tests; -1 test** of the scaffold (the emptied test removed under D77, section 14). The other 21 files and 431 tests were added by rows that ran at the same time |
| `db` | 28 files, 388 tests | 45 files, 623 tests, 0 failed (12:47:05) | **+8 files, +93 tests, all passed in every run**. The other 9 files and 142 tests are other rows' |

| Project | File | Tests |
|---|---|--:|
| `unit` | `src/plugins/authenticate/__tests__/credentials.test.ts` | 29 |
| `unit` | `src/plugins/authenticate/__tests__/authenticate.test.ts` | 41 |
| `unit` | `src/modules/identity/__tests__/lockout.test.ts` | 13 |
| `unit` | `src/modules/identity/__tests__/tokens-cookie.test.ts` | 15 |
| `unit` | `src/modules/identity/__tests__/sessions.test.ts` | 9 |
| `unit` | `src/modules/identity/__tests__/sweeper.test.ts` | 4 |
| `unit` | `src/modules/identity/__tests__/routes.test.ts` | 7 |
| `unit` | `src/modules/identity/__tests__/static.test.ts` | 18 |
| `db` | `src/plugins/authenticate/__tests__/authenticate.db.test.ts` | 12 |
| `db` | `src/modules/identity/__tests__/sign-in.db.test.ts` | 30 |
| `db` | `src/modules/identity/__tests__/sessions.db.test.ts` | 20 |
| `db` | `src/modules/identity/__tests__/concurrency.db.test.ts` | 8 |
| `db` | `src/modules/identity/__tests__/sequence.db.test.ts` | 9 |
| `db` | `src/modules/identity/__tests__/secrets.db.test.ts` | 6 |
| `db` | `src/modules/identity/__tests__/two-instances.db.test.ts` | 5 |
| `db` | `src/modules/identity/__tests__/engine.db.test.ts` | 3 |

Test support, not a test file: `src/modules/identity/__tests__/support.ts` (the app on a clone
with a counted hasher, a stand-in for the device registry behind its seam, fixture rows for a
paired device, readers of the stored sessions, `expectAbsent`). Other rows may import it.

Of the two adapted test files of other rows, `origin-guard.test.ts` keeps its count (151) and
`readiness.test.ts` has one test fewer (the emptied one).

## 14. Existing tests changed by design

Pre-images: `.cache/rollback/W24.readiness.test.ts.pre`, `.cache/rollback/W24.readiness.test.ts.pre-d77`,
`.cache/rollback/W24.origin-guard.test.ts.pre`. Three changes in two files.

**(1) `apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts`** (standing rule of
D52). Two lines deleted at 11:41:14, nothing else; they pinned this row's seam as a stub. Re-read
right before the edit: SHA-256 `b2771daf…` (unchanged since the core-services row), after
`9d8177a9…`.

```
252,253d251
<     expect(() => app.sessionRegistry.endForOperator(unit, 'OP-0001', 'USER_DISABLED')).toThrow('plan row W24');
<     expect(() => app.sessionRegistry.endForDevice(unit, 'DEV-0001', 'DEVICE_REVOKED')).toThrow('plan row W24');
```

The engine row deleted its own two lines afterwards (the file's date was 11:44; hash
`bce1fa68…`). What was left of that test is change (3) below.

**(2) `apps/core-server/src/plugins/origin-guard/__tests__/origin-guard.test.ts`** (the
request-guards row's; ruling D72 on this row's question of 11:40). Two identical lines inserted
at 11:42, nothing else: no title, no expectation, no other block. Re-read right before the edit:
645 lines, SHA-256 `69ea6bb6…`; after: 647 lines, `bd01543e…` (unchanged at 12:31).

| Insertion (line numbers of the file before the edit) | Before | After | Block |
|---|---|---|---|
| after line 343 | line 343 `    app.stages.replace('throttle', () => {});`, line 344 `  });` | the same line 343, then the new line 344 `    app.stages.replace('authenticate', () => {});` | `beforeAll` of "stage 3 alone, with the scaffold's stub at stage 4" |
| after line 470 | line 470 `    app.stages.replace('throttle', () => {});`, line 471 `    return { app, seen };` | the same line (now 471), then the new line 472 `    app.stages.replace('authenticate', () => {});` | `factsApp()` of "the seam originDecision" |

```
343a344
>     app.stages.replace('authenticate', () => {});
470a472
>     app.stages.replace('authenticate', () => {});
```

Reason: four tests of that file pinned "the scaffold's stub at stage 4". With the real stage in
the tree, a request that carries this instance's cookie and an `Authorization` header is refused
with 401 `CREDENTIAL_CONFLICT`, which is the specification:

| Test (11:39:36) | Expected by the test | With the real stage 4 |
|---|---|---|
| "stage 3 alone …" > "cookie and bearer, no Origin, GET: stage 3 refuses exactly the 403 cells (expected answer 401)" | 200 | 401 |
| the same > "cookie and bearer, web console origin, GET …" | 200 | 401 |
| the same > "cookie and bearer, web console origin, POST …" | 200 | 401 |
| "the seam originDecision" > "reports the category and the presence of each credential, the same however often it is asked" | the scratch handler records the facts of a cookie-and-bearer request | the request never reaches the handler |

Each block already replaced its neighbouring stages the same way; the line puts back the stub
its title names. Proven before the ruling on a scratch copy outside the repository with exactly
these two lines: 151 / 151. After the edit: 151 / 151 (12:21:51 and 12:32:34). The coverage those cells had of
the conflict itself is now in this row's files, through the real stage (section 10.2).

**(3) `apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts`, a second time** (the
controller's note D77, point 1; 12:44). After (1) and
the engine row's deletion, the test had no assertion left and two unused locals. Every stub it
had named is filled (section 10.3), so the test and its comment were deleted: lines 247 to 253 of
the file as it was (SHA-256 `bce1fa68…`, 354 lines; pre-image
`.cache/rollback/W24.readiness.test.ts.pre-d77`). After: `5906d754…`, 347 lines.

```
247,253d246
<   // Standing rule (decision D52): a row that fills one of these seams deletes its own assertion
<   // here, as a recorded by-design change, and nothing else. `originDecision` is filled (W23).
<   it('the stubs that are not implemented say which row fills them', async () => {
<     const app = await readyApp();
<     const unit = { label: 'test' };
<   });
<
```

Nothing else in the file changed. The two folders' tests of that plugin: 2 files, 32 tests,
exit 0 (12:45:42); the two lint warnings of the file are gone.

## 15. Requirement to test

| Requirement | Where it is proven |
|---|---|
| SR-05 (Argon2id, 19,456 KiB, 2 passes, parallelism 1, 16-byte salt; no pepper) | D1 "AC-B-30 (the query) …", "the derivation runs with the stored parameters for a known operator and with the current ones for nobody"; U7 "SR-61"; the wrapper's own tests (W09) |
| SR-06 (stored set; recompute with the stored parameters; re-hash a weaker row) | D1 block "SR-06" (2 tests) |
| SR-07 (the password only in the body, at most 128, never echoed or written) | D1 validation block (129 characters, U+0000); D5 (dump, log) |
| SR-08 (same status, code, message, comparable time; one derivation in all three cases) | D1 "gives byte-identical bodies …"; D6 "a failure of a known and of an unknown username: the same work, step for step" |
| SR-09 (256-bit token, `ses_`, only its SHA-256 stored) | U4 block "session tokens"; D1 "stores only the SHA-256 of the token, 32 bytes …"; D5 |
| SR-10 (rotation) | D1 "a second sign-in ends the presented session (ROTATED) …", "a sign-in that presents the device's own session token …"; D3 "both presenting the same session …" |
| SR-11 (idle 15 min, absolute 8 h, server clock, on every request and by a sweeper) | D2 blocks "AC-B-26", "the sweeper"; U5; U8 block "a session past its limit never resolves" |
| SR-12 (revocation is immediate) | D2 "AC-B-27", "endForOperator …", "endForDevice …"; D3 "a sign-out racing other requests …" (the disable and revoke operations themselves: W33, W32) |
| SR-13 (no role or permission in a session or token) | D2 "RB-3, SR-13: a role change applies to the next request of the same session, with no new sign-in" (and the column list of `auth_sessions`) |
| SR-14 (the identifier is not renewed on a role change) | the same test: one cookie before and after |
| SR-15 (a token never in a URL, a log, a row, an event) | D5; D "a valid token in the query string, in another header or in the body authenticates nothing"; U "the log of stage 4" |
| SR-16 (web: only in the cookie), server half | D1 (no token in the body); U4 (`HttpOnly`) |
| SR-17 (sessions survive a restart; ended sessions keep their reason) | D2 "a second app on the same database resolves a session the first one issued (a restart) …"; every end reason asserted on the stored row |
| SR-18 (the cookie) | U4; D1; D4 |
| SR-22 (5 in 300 s lock for 60 s; key = console) | U3; D1 block "AC-B-25" (3 tests) |
| SR-23 (exactly one row per attempt; a 429 writes none) | D1 (one row asserted per case); D3 (20 rows for 20; the 21st and the five of 25 write none) |
| SR-25 (memory counters, reset at a restart) | U3 "reset …"; D2 restart test |
| SR-61 (no signing secret, no pepper) | U7 "SR-61: no signing secret and no pepper" |
| SR-72 (atomic server-native changes) | D3; D6; U7 "a session is ended, expired and touched only where it is still open (compare-and-set)" |
| SR-73 (one credential per request; a session bound to its transport) | U1; U (blocks "the credential decision table", "ID-12"); D |
| SR-69 (ID-1 a at sign-in), SR-75 (resolved before the throttle) | D1 block "ID-1, SR-69"; U and D blocks "SR-75" |
| AC-B-23 | D1 blocks "AC-B-23: a web console signs in", "… a paired device signs in" |
| AC-B-24 | D1 block "AC-B-24" (4 tests) |
| AC-B-25 | D1 block "AC-B-25"; U3 |
| AC-B-26 | D2 block "AC-B-26". The socket close (4401) is W42's; the publication it reacts to is asserted here |
| AC-B-27 | D2 block "AC-B-27" (4 tests) |
| AC-B-28 | D5 "holds no password, no token, no credential, no typed username and no marker; only the hash of each token" (this row's flows; pairing and biometric values: W32, W41, W48) |
| AC-B-29 | D5 block "AC-B-29" (4 tests): (a) the sign-in flows, (b) a GET with `?token=<marker>`, (c) malformed JSON with a marker to operation 2. The socket upgrade, operation 18 and the acceptance run are W42's, W32's and W58's |
| AC-B-30 | D1 "AC-B-30 (the query)"; the known-vector unit test is W09's |
| AC-B-80 | D3 block "AC-B-80 (SD-04, AT-C1)" |
| AC-B-90 | D4 |
| AC-B-81 (the cells are W47's file) | In unit and database form here: U C7, C13, block "ID-12"; D "a session is bound to its transport" |

(U = `authenticate.test.ts`, U1 = `credentials.test.ts`, U5 = `sweeper.test.ts`, U7 =
`static.test.ts`, U8 = `sessions.test.ts`, D = `authenticate.db.test.ts`; the others as above.)

## 16. What the specification left open, and this row's choices

| # | Open point | Choice |
|--:|---|---|
| 1 | Fixed or rolling window of the lockout | Fixed, opened by the console's first counted attempt, on the server clock: what the library counts, and the same as the throttle's windows (D52 DN-3). The simulator's is rolling (finding F-2) |
| 2 | When the lock starts under "consume, then verify" | When the fifth attempt is TAKEN (section 5) |
| 3 | `attemptsRemaining` while attempts are in flight | 5 minus the failures recorded |
| 4 | The answer of the failure that locks | 423 `LOCKED` with `lockedUntil` (the simulator's result; AC-B-25) |
| 5 | A failure that arrives after its window is over | It counts where the console stands now |
| 6 | Which requests are "activity" | A POST of an operator that reaches its handler (after the access rule and the validation); at most one write a second; `signIn` and `signOut` exempt |
| 7 | A session that ended between stage 4 and the handler of a POST | 401, the command does not run |
| 8 | Which limit names the reason when both hold | The absolute limit |
| 9 | A sign-out of a session that was ended already | 204 and no second row when the request was resolved before the end; 401 when it came after |
| 10 | Whether `AUTH_LOCKED` names an operator | Only when the username matched one (ID-4 for all three rows; the simulator does the same) |
| 11 | Events | The event the simulator writes beside each of the five audit rows (the specification names the event for the expiry only) |
| 12 | A sign-in that presents a device SESSION token instead of the device credential | Accepted as that device's console, and the presented session is rotated |
| 13 | A value of the wrong form | Never looked up |
| 14 | The scheme of the bearer header | Case-insensitive; one value; a repeated header is not a bearer value |
| 15 | A session of a disabled operator that is still open | Resolves to nothing; not ended by stage 4 (the administration module ends them with the disable) |
| 16 | A sweep that finds nothing | One read on the pool; no unit, so no chain lock every 5 s |
| 17 | When the sweeper runs | From `onListen` to `preClose` |
| 18 | A read that fails | 503 `NOT_READY`, logged by code, persisted, readiness probed |
| 19 | Who sets the API-7 headers of the three POSTs | This module, from the engine seam |
| 20 | A failed re-hash | Logged by code; the sign-in stands |
| 21 | `getSignInStatus` of an operator on a device | The device's lock state |

## 17. Findings

| ID | Finding | Evidence | Effect |
|---|---|---|---|
| F-1 | Four tests of the request-guards row's file and this row's two stub assertions pinned the stub of stage 4 | Section 11.7, 11:39:36 | Adapted under D52 and D72 (section 14) |
| F-2 | **The lockout window is fixed, the simulator's is rolling.** Up to four failures at the end of one window and four at the start of the next do not lock | `lockout.ts`; `packages/shared/src/sim/auth.ts:129-131` | An attacker's best rate is unchanged: five verified attempts per 60 s through the lock cycle is more than the boundary gives. Decision DN-1 |
| F-3 | **A burst above the denial budget decides by arrival which refusals are audited.** Of 25 concurrent wrong sign-ins, 20 locked attempts take the 20 places first (no derivation delays them) and the five VERIFIED failures answer 429 without an `AUTH_FAILED` row. The lock holds, the 20 `AUTH_LOCKED` rows and five 429 request lines show the burst, and a right password among the five would still sign in | D3 "SR-71: of 25 at once …" | It is the accepted contract of the budget (D52 DN-2: consume before the row, at most 20 rows). For the security review W45: decision DN-12 |
| F-4 | The brief of this row says the derivation runs for a "locked account" too; the specification says attempts during the lock "are not verified" (ID-5) and AC-B-80 counts "exactly five" verified attempts of 20 | spec §5.2 ID-5, §16.10 AC-B-80 | Built as the specification says: no derivation during the lock. The lock is per console and does not depend on the username, so the 423 tells nothing about an account. Decision DN-4 |
| F-5 | The audited refusal of a retired device (403 `DEVICE_REVOKED` with its `ACCESS_DENIED` row, RB-6) is the access rule's, also on the PUBLIC operations 2 and 3 where the contract lists the status. Until W28 lands, and if its guard leaves PUBLIC operations alone, the identity operations answer the same 403 from their own check, without the row | `console.ts` `refuseRetiredDevice`; spec §4.6 RB-6, §13.1 | Decision DN-9 |
| F-6 | The biometric row owns `biometric/` only; its routes need one registration line in `src/modules/identity/index.ts`, which is this row's file | `02_plan.md` W41 "Owned write paths" | Decision DN-6 |
| F-7 | The three POST answers read `app.engine.epoch` and `.revision`. With the scaffold's stub of the engine those getters threw; with the engine host of W26 they are numbers (0 while the engine never started). **This row depends on W26's seam** | `routes.ts`; `engine.db.test.ts` | If W26 is rolled back, every sign-in answers 500. Named in the rollback (section 21) |
| F-8 | `readiness.test.ts:249-252`, "the stubs that are not implemented say which row fills them", had no assertion left after this row's and the engine row's deletions: two unused locals, two lint warnings | Section 14 (3) | **Closed** under the note D77: the test was deleted; lint has no warning |
| F-9 | `lockout.ts` imports `counterName`, `createFixedWindows` from `src/plugins/throttle/windows.ts`, a file the throttle's `index.ts` does not re-export | `lockout.ts:40` | Reuse instead of a second copy of the window arithmetic. Decision DN-11 |
| F-10 | Reds that were not this row's, in files of the engine row in flight (11:39 to 12:01); all gone by 12:09 | Section 11.7 | P11 noise, recorded with times. The red that is still there at the end is F-20 |
| F-11 | One template database of this row's prefix was left by the scratch mutation runner: `dems_test_step_46_tmdaaau5_tpl_schema`. **Hypothesis** for the cause: the runner piped Vitest's output through `head -1`, which closed the pipe before the run's teardown line was written, and that run ended on the broken pipe before its last drop. Not reproduced | Section 20 | Removed at 12:21:14 with the helper's own guarded drop; 0 remain. The product and the helper are not involved |
| F-12 | The limiter library measures its own windows with the system time; the window is decided by `app.clock` and named in the counter key, as in the throttle (its findings F-1, F-8 apply here too) | `lockout.ts` | None with the production clock |
| F-13 | An attempt whose derivation fails (a `PasswordHashError`) answers 500, keeps its taken attempt and writes no audit row; the error log has it by its code | `sign-in.ts`; decision D30 D-d | SR-23's "one row per attempt" does not hold for an attempt that ends in a server failure. Stated, not hidden |
| F-14 | A wall clock set back across a restart to before a session's `issued_at` makes the end of that session fail on `auth_sessions_times_check` (`ended_at >= issued_at`); the request answers 503 and the session stays unresolved until the clock has passed its issue again | reasoning from the CHECK; not run | Residual; the server clock never moves backwards within a process (ENG-14) |
| F-15 | The sweeper's timer was not run on a listening server: this row binds no port. Its schedule is tested with fake timers and its wiring by a static test | U5; U7 | First run for real in the backend gate W58 |
| F-16 | A known and an unknown username do the same statements in the same order (D6), and one derivation each. What still differs is whether the one indexed read finds a row | D6 | "Comparable time" (SR-08), not "identical" |
| F-17 | `engine.db.test.ts` boots the engine host of W26, which landed during this row (D77): a booted engine runs | Sections 9.6, 10.3 | The file gives the engine a manual timer and counts from the state after the boot |
| F-18 | The two-instances test puts both instances on ONE clone on purpose, so that only the cookie name separates them | D4 header | Stricter than the demo, where each instance has its own database |
| F-19 | The static test file reads sources from disk and so cannot be exercised by the mutation transform | Section 12 | The same defects are caught by database tests |
| F-20 | **One file of the database-reset row was red in three runs of this row**: `src/db/reset/__tests__/reset-failures.db.test.ts`, one or two tests per run and not the same ones, always the assertion at line 100 ("sessions of the routine" still present after about 3 s). Green at 12:19:04; red at 12:33:03, 12:34:17 (the file alone) and 12:34:56; **green again at 12:47:05**, when no other database run was in flight and the load was 2.0 | Section 11.7 | Not this row's file and not on this row's path. The whole `db` project exits 0 at the end. The test is sensitive to parallel runs or to load: decision DN-15 |

## 18. Deviations from the row text

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | No derivation during the lock (the brief's parenthesis says otherwise) | F-4 |
| DV-2 | More of other rows' test files was changed than the brief's rule 1 allows: two lines in `origin-guard.test.ts`, and the emptied test in `readiness.test.ts` | Ruling D72 and note D77, given during the row |
| DV-3 | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were not written | Parallel run: the controller writes them (P8) |
| DV-4 | Test support and control objects are exported for other rows: `identityControl(app)`, `src/modules/identity/__tests__/support.ts` | The biometric row needs the same lockout; every later row's test needs a signed-in operator |
| DV-5 | `SessionRegistry` has four members beyond the scaffold's sketch (`resolve`, `touch`, `endBiometricSessions`, `sweep`), and the `reason` parameters are narrowed from `string` to the allowed values | The scaffold calls the type a first sketch that this row defines |
| DV-6 | A `preHandler` hook of the `authenticate` plugin (activity), beside the stage handler | Activity must come after the access rule and the validation, which a stage handler cannot |
| DV-7 | The route-level `onRequest` hooks of operations 2, 4, 5 and 6 repeat what the access stage will enforce | Spec §7.3: the order holds without the next row |
| DV-8 | The API-7 headers are set here, from the engine seam | F-7 |

## 19. Decisions for the controller

| ID | Question | Recommendation |
|---|---|---|
| DN-1 | The fixed lockout window (F-2) | Accept, as for the throttle (D52 DN-3). A rolling window would need a timestamp list written by hand beside the library |
| DN-2 | The lock starts when the fifth attempt is taken | Accept: it is what "consume, then verify" needs; with a manual clock it equals "60 s from the fifth failure" |
| DN-3 | The locking failure answers 423, not 401 | Accept (the simulator's result; AC-B-25) |
| DN-4 | F-4: no derivation during the lock | Accept as built, and correct the brief's wording for later rows |
| DN-5 | Events beside the five audit rows | Accept (parity with the simulator's trail) |
| DN-6 | F-6: how the biometric row registers its routes | Allow W41 one import and one call line in `src/modules/identity/index.ts` (after `registerIdentityRoutes`), as a recorded multi-writer path |
| DN-7 | A sign-in that presents a device session token | Accept |
| DN-8 | F-7: the API-7 headers of server-native POSTs are set by each module from `app.engine` | Accept, and tell W32, W33, W41 the same two lines; or move them into one `onSend` hook of the engine row |
| DN-9 | F-5: who answers and audits 403 `DEVICE_REVOKED` on the PUBLIC operations 2 and 3 | The guard (W28), with its row; this row's check stays as the fallback |
| DN-10 | F-8: the empty stub test in `readiness.test.ts` | Done under the note D77: deleted, recorded in section 14 (3). To record |
| DN-11 | F-9: the windows helper | The throttle's owner re-exports `createFixedWindows` and `counterName` from its `index.ts`; one import line changes here |
| DN-12 | F-3 | Route to the security review W45. Options: accept; or reserve the budget place before the derivation (a successful sign-in then takes a place too); or give `AUTH_FAILED` precedence over `AUTH_LOCKED` in the budget |
| DN-13 | Pass to W28, W32, W33, W41, W42 | Section 9 |
| DN-14 | Pass to every later backend row | A POST of an operator is activity by the hook of `plugins/authenticate`: a module does nothing for ID-P9. A test app answers 401 `CREDENTIAL_CONFLICT` to a request with this instance's cookie and an `Authorization` header; a test that is not about stage 4 replaces it (`app.stages.replace('authenticate', …)`) or sends one credential |
| DN-15 | F-20: the reset row's test file that is red while other database runs are in flight or the load is high | Give it to that row's owner with the four runs of section 11.7. If the cause is the parallel runs, the check needs an application name of its own per run; if it is the load, a longer wait. Until then a red of that file in a parallel run is noise (P11) |
| DN-16 | Note D77, point 3: no `mirrorOperators()` call in this module | Accept (section 10.3). If the Users list of another console should refresh after a sign-in, that is a new `admin.changed` the specification does not ask for |

## 20. End state and cleanup (12:48:03)

```
session: role=dems_owner server=18.4 port=4432 postmaster started 2026-10-04 07:14:26.046351+07
databases with this row's prefix (dems_test_step_46_*): 0
test databases of all rows at this moment: 0
project databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3
sessions on this row's databases still open: 0
```

`.locks/postgres.pid`: 19121. (A scratch script outside the repository, as `dems_owner`, through
the test helper's own reader of the connection file. It prints names and counts.)

- The same script at 12:20:39 showed ONE database of this row's prefix,
  `dems_test_step_46_tmdaaau5_tpl_schema` (finding F-11). It was dropped with the helper's own
  guarded function (`TestRun.attach(identity).dropDatabase(name)`, which refuses any name outside
  that run's prefix): `dropped dems_test_step_46_tmdaaau5_tpl_schema`.
- `dems_demo` and the lane databases were never connected to by this row: every test ran on a
  clone. PostgreSQL was never stopped or reconfigured. Nothing connected as the bootstrap
  superuser.
- No process of this row is left; the one background command (the mutation runner) ended by
  itself. No port was bound. `apps/core-server/logs/` does not exist: no test writes a
  persistent error log file.
- The PostgreSQL server log holds none of this row's eight test markers (`grep -c` on
  `.data/postgres.log`, counts only, 12:20:39: 0 each; the common prefix of the markers again at
  12:48:03: 0).
- Scratch files of the row (the mutation harness, the proof copy of section 14, the two end-state
  scripts, the saved runner outputs) were under the sandbox's temporary directory and the
  session's scratchpad, and are removed. The harness files are kept as text under
  `implementation/assets/`.

## 21. Rollback (R-NEW; not executed)

Both folders held one file each before this row, the scaffold's stubs; everything is untracked at
`acaff20`, so the pre-image patch of P23 (`.cache/rollback/W24.pre.patch`) is empty and copies
were saved instead.

```sh
# from /Users/gsp-budi/Documents/DEMS
rm -rf apps/core-server/src/plugins/authenticate
mkdir -p apps/core-server/src/plugins/authenticate
cp .cache/rollback/W24.authenticate-index.ts.pre apps/core-server/src/plugins/authenticate/index.ts

# modules/identity: keep password-hash/ (W09) and biometric/ (W41, when it exists)
rm -rf apps/core-server/src/modules/identity/__tests__
find apps/core-server/src/modules/identity -maxdepth 1 -type f -delete
cp .cache/rollback/W24.identity-index.ts.pre apps/core-server/src/modules/identity/index.ts

# the request-guards row's test: take the two inserted lines out again
cp .cache/rollback/W24.origin-guard.test.ts.pre apps/core-server/src/plugins/origin-guard/__tests__/origin-guard.test.ts
```

Then, by hand, put back into `readiness.test.ts` the seven lines of section 14 (3) and, inside
that test, the two lines of section 14 (1) (the file is a multi-writer path and the engine row
has edited it between the two changes: do not copy the first pre-image; the second,
`.cache/rollback/W24.readiness.test.ts.pre-d77`, is the file right before change (3)). The copy of
`origin-guard.test.ts` is valid only while no later row has edited that file.

Valid while no later row has built on the seams (W28, W32, W33, W41, W42 and every module row
do). After the rollback every caller is ANONYMOUS again, the registry throws "plan row W24", and
no operation of area 1 exists. The reverse dependency is finding F-7: a rollback of the engine
row alone makes this row's three POST answers fail.

## 22. Verification list of the row

| Check | Result | Section |
|---|---|---|
| The row command exits 0 and shows the cases of plan W24 | Yes: 8 files, 93 tests | 11.1, 11.4 |
| MODG: route list equals the registry operations of the area that are this row's; success and validation tests; in-process on own clones; no port | Yes | 11.3 |
| `npm run typecheck -w @dems/core-server`, `npm run lint -w @dems/core-server` | Exit 0; exit 0 with no warning | 11.6 |
| Whole `unit` project | Exit 0: 70 files, 1,847 tests (12:46:33) | 11.6 |
| Whole `db` project | Exit 0: 45 files, 623 tests (12:47:05). Red in one file of the database-reset row at 12:33:03 and 12:34:56, recorded | 11.6, 11.7, F-20 |
| Test ledger with this row's files by name | Yes | 13 |
| The by-design changes by file and line | Yes | 14 |
| No database with this row's prefix remains; `.locks/postgres.pid` unchanged (19121) | Yes (12:48:03), after one removal at 12:21 | 20 |
| The credential decision table with the test of each cell | Yes | 3 |
| The sign-in sequence, the lockout arithmetic, the cookie, the sweeper | Yes | 4, 5, 6, 7 |
| The seams for the pairing row, the RBAC guard and the realtime row, with their types | Yes | 9 |
| The controller's notes D69, D72 and D77 | Met | 10 |
| No credential in this document | Yes | — |

Not verified by this row: a server started through `src/index.ts` (the sweeper's timer, the
real cookie in a browser: W58, W55); a socket upgrade (W42); a real device registry (W32); the
permission guard in front of these routes (W28); what a browser does with a cookie that has no
`Max-Age` (W55).

---
*Generated: 2026-10-04 12:30 WIB*
*Last Updated: 2026-10-04 12:52 WIB*
