---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 54
plan_row: W32
title: Pairing with the device registry (HB-10): operations 15 to 23, the device resolver, the redeem as one unit of work
date: 2026-10-04
agent: coder-execution (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
source_spec: masterplan/01_specs.md rev 2.2 (§4.7, §5.2 ID-1 and ID-13, §6, §7.2, §7.3, §7.7, §8.2 ENG-23 to ENG-25, §13.1, §13.2); masterplan/03_database_contract.md rev 2.2 (§4.7 to §4.11, §5)
evidence_tier: 3
status: complete
---

# W32: pairing and the device registry

All times are WIB (UTC+7) on 2026-10-04. Every command ran from `/Users/gsp-budi/Documents/DEMS`;
the session never changed into a subfolder. Database commands ran with the per-command sandbox
bypass (P10). Quoted runner output is unchanged except that the sandbox's certificate warning
lines are left out.

**No pairing code, QR payload, device credential, session token, hash or other secret appears in
this document.** A test takes a code or a credential from an answer and hands it on; none is
printed, and no test name holds one. What the tests print are statuses, audit types, identifiers
(`PCD-…`, `DEV-…`) and counts.

## 1. Result

| Item | Result |
|---|---|
| Row tests, `unit` (4 files of the folder) | **Exit 0**: 4 files, 63 tests, 0 failed (15:33:03) (section 12.1) |
| Row tests, `db` (7 files, `DEMS_TEST_STEP=54`) | **Exit 0**: 7 files, 79 tests, 0 failed; 0 databases remain with the run prefix (15:33:18) (section 12.1) |
| MODG: the route list | The nine routes of the folder equal operations 15 to 23 of the registry, both printed by a test (section 12.2) |
| The pairing code | Six decimal digits from `crypto.randomInt`, returned once, valid 300 s, one active at a time; the table holds only SHA-256 of `<code ID>:<digits>` (32 bytes), compared with the answer's code in the test |
| A second redeem, an expired, a cancelled, a wrong and an absent code | The same 401 `INVALID_CODE`, equal apart from the request ID (five answers compared) |
| Lock and close | Three failures lock redeeming for 60 s (423 with `lockedUntil`); during the lock nothing is compared; the fifth failed attempt of a code closes it as `EXHAUSTED` |
| AC-B-76, 20 concurrent wrong redeems | Exactly 3 counted (`PAIRING_FAILED`, the code's `failed_attempts` 3), 17 found redeeming locked (`PAIRING_LOCKED`); 60 s later a second burst counts exactly 2 more and the code closes at exactly 5 (section 9) |
| AC-B-77, two concurrent redeems of the right code | One 201, one 401 `INVALID_CODE`; one device row, one `PAIRING_SUCCESS` row |
| Two concurrent issues | Exactly one `ACTIVE` code; the earlier ones cancelled, each with its row |
| Revoke | One unit: the state (compare-and-set), the device's sessions ended, its live biometric tokens revoked, `DEVICE_REVOKED` with `sessionsEnded`, the event `UNPAIRED`; after the commit `device.revoked`; the next call of the device answers 403 `DEVICE_REVOKED` |
| Two-phase rotation | The new credential is stored as "next" and the old one stays valid until the new one is first used; from then on the old one is unknown (401) |
| AC-B-75, 25 calls with five retired credentials | 20 `ACCESS_DENIED` rows in all, 5 × 429; all counted under `class:local`, none under a device key |
| Secret scan (AC-B-29, AC-B-41) | 34 audit rows, 19 events, the publications, 26 answers of a refusal or a failure, a dump of 165,176 characters and a log capture of 149 lines at level `trace`: 0 codes, 0 credentials, 0 markers, 0 hashes in the log; two FAILING statements included (rule M14) (section 10) |
| The seam `app.deviceResolver` | Filled: PAIRED, RETIRED or nothing per state (section 6); promotes a rotated credential at its first use; writes `last_seen_at` at most once a minute |
| Whole `unit` project | **Exit 0**: 102 files, 2,661 tests, 0 failed (15:34:06) |
| Whole `db` project (`DEMS_TEST_STEP=54`) | **Exit 0**: 75 files, 1,081 tests, 0 failed; forced drops that needed a retry: 0; 0 databases remain with the run prefix (15:36:10) |
| Typecheck, lint of the workspace | Exit 0 (15:33:00); exit 0 with no warning (15:33:01) |
| Mutation check | 97 of 98 planted defects detected; the one survivor is an equivalent mutant (section 13). No file of the tree was changed for it (rule M15) |
| Other rows' tests | ONE by-design change: this row's own stub assertion in `readiness.test.ts`, three lines (section 15). One test block of the identity row keeps passing, with a stale title (finding F-1) |
| PostgreSQL | Never stopped or reconfigured: `.locks/postgres.pid` is 19121. No database with this row's prefix remains (section 21) |

## 2. What was written

Production code (13 files, 2,063 lines), all under `apps/core-server/src/modules/pairing/`:

| File | Lines | What it is |
|---|--:|---|
| `index.ts` | 149 | The plugin: provides the seam `deviceResolver`, registers the routes, owns the redeem lock, the presence counter and the code sweeper; `pairingControl(app)` |
| `routes.ts` | 246 | The nine routes, each built with `routeOfOperation` from its registry entry; who ACTS is read from stage 4; the input of a revoke |
| `redeem.ts` | 182 | Operation 18: the redeem as one unit of work |
| `codes.ts` | 106 | Operations 15 to 17 and the expiry sweep |
| `devices.ts` | 186 | Operations 19 to 23: the registry, revoke, unpair, registration, rotation |
| `resolver.ts` | 118 | What the seam answers to stage 4; the promotion of a rotated credential; last seen |
| `store.ts` | 474 | The 24 statements, constant texts with bind parameters, and their row mappers |
| `activity.ts` | 217 | The eight audit rows and three events, as builders that take no secret |
| `redeem-lock.ts` | 181 | 3 failures in 300 s lock redeeming for 60 s; memory limiters of `rate-limiter-flexible` |
| `secrets.ts` | 63 | The code and the credential: generation, stored form, the constant-time comparison. The only file that names `node:crypto` |
| `presence.ts` | 51 | Which devices hold an open authenticated socket (fed by the realtime channel) |
| `database.ts` | 38 | A read on the pool; a failed read is logged as `{ err }`, persisted, answered 503 |
| `limits.ts` | 52 | The numbers of spec §6.1 |

Tests (11 files, 142 tests) and test support (1 file), 4,193 lines, under `__tests__/`:

| Project | File | Tests | What it is about |
|---|---|--:|---|
| `unit` | `routes.test.ts` | 15 | MODG; the registry's rule per route; one refused call per operation; the reads with a pool that answers or fails; the resolver without a database |
| `unit` | `static.test.ts` | 26 | Rules M3, M4, M5, M8, M14 for the folder; the statements |
| `unit` | `secrets.test.ts` | 11 | The code, the credential, the identifiers, the numbers |
| `unit` | `redeem-lock.test.ts` | 11 | The lock arithmetic; the presence counter |
| `db` | `lifecycle.db.test.ts` | 15 | AC-B-32 to AC-B-36: no credential, issue, status, cancel, redeem, expiry, lock and close |
| `db` | `devices.db.test.ts` | 16 | AC-B-37, AC-B-38: registry, last seen, registration, revoke, unpair, rotation, the resolver per state |
| `db` | `concurrency.db.test.ts` | 14 | AC-B-75 to AC-B-77, two issues, a revoke racing requests, SR-71; statement level on real connections |
| `db` | `secrets.db.test.ts` | 11 | AC-B-29, AC-B-41: the scan of rows, events, publications, refusals, the dump and the log |
| `db` | `sequence.db.test.ts` | 13 | The order of work of each operation, statement by statement; round trips |
| `db` | `engine.db.test.ts` | 4 | API-7 beside a booted engine; one chain; the order of publications |
| `db` | `registry.db.test.ts` | 6 | The registry on `tpl_bulk`: 40 devices, 60 codes |

`__tests__/support.ts` is test support, not a test file: `pairingApp` (the real app on a clone,
every stage real, the REAL resolver, publications recorded), `pairDevice` (a real paired device
with a credential the server issued), `issueCode`, `redeem`, `devicePost`, `deviceGet`,
`portalPost`, `forgetLimits`, `storedCodes`, `storedDevices`, `expectContract`. Other rows may
import it: a later row that needs a device no longer needs the registry double.

Changed outside the folder: three lines of `src/plugins/readiness/__tests__/readiness.test.ts`
(section 15). Not changed: `app.ts`, `index.ts`, `config.ts`, the contract, the schema, the
migrations, the core, the engine, the plugins, every other module.

## 3. The handler recipe per operation (rule M13)

All nine are **server-native**: none hosts a simulator action, none calls `app.engine.command`.
The simulator's `pair` and `unpair` and its `pairing` slice are not used.

| # | operationId | Access (registry) | Recipe | Unit label | Rows on success |
|--:|---|---|---|---|---|
| 15 | `issuePairingCode` | `PAIRING_MANAGE` | One unit: expire, cancel, the code number, the insert, the row | `pairing.issueCode` | `PAIRING_CODE_ISSUED`; `PAIRING_CODE_CLOSED` for a code it replaced or found expired |
| 16 | `getPairingCodeStatus` | `PAIRING_MANAGE` | One read on the pool | — | none |
| 17 | `cancelPairingCode` | `PAIRING_MANAGE` | One unit: expire, cancel, the row | `pairing.cancelCode` | `PAIRING_CODE_CLOSED`; none when no code is active |
| 18 | `redeemPairingCode` | `PUBLIC` | ONE unit (section 4) | `pairing.redeem` | `PAIRING_SUCCESS` and the event `PAIRED`; a refusal: `PAIRING_FAILED` (with its event) or `PAIRING_LOCKED`; `PAIRING_CODE_CLOSED` for a code it found expired or exhausted |
| 19 | `listPairedDevices` | `PAIRING_MANAGE` | One read on the pool, and the presence counter for `online` | — | none |
| 20 | `revokeDevice` | `PAIRING_MANAGE` | One unit: compare-and-set, `endForDevice`, the biometric tokens, the row, the event, the answer | `pairing.revokeDevice` | `DEVICE_REVOKED`; event `UNPAIRED` |
| 21 | `getDeviceRegistration` | `DEVICE` | Two reads on the pool | — | none |
| 22 | `unpairDevice` | `DEVICE` | One unit, as a revoke | `pairing.unpairDevice` | `UNPAIRED`; event `UNPAIRED` |
| 23 | `rotateDeviceCredential` | `DEVICE` | One unit: the next hash, the row | `pairing.rotateCredential` | `DEVICE_CREDENTIAL_ROTATED` |

Three more units belong to the module and to no operation: `pairing.promoteCredential` and
`pairing.deviceSeen` (the resolver, section 6) and `pairing.sweepCodes` (the timer, 5 s, only
while the server listens).

Common to all: the route is `app.route({ ...routeOfOperation(operation), schema, handler })`;
schemas are the contract's; no route has a hook; no handler checks a permission, a role, a
session or a device (a static test of the folder asserts it); the actor of a row is the
operator of the session stage 4 resolved (`operatorSessionOf`), the device is the device stage 4
resolved (`pairedDeviceOf`); time is `app.clock`; every 2xx answer of a POST carries
`x-dems-epoch` and `x-dems-revision` from `app.engine`; publications are `unit.afterCommit`
tasks; no answer sets a cookie.

## 4. The redeem, statement by statement

`src/modules/pairing/redeem.ts`. **One unit of work of the serial pipeline, one PostgreSQL
transaction** (ENG-23). The timelines below are printed by `sequence.db.test.ts`, whose pool
records every statement on the pool ("pool") and on a unit's connection ("unit"); the names are
the constants of `store.ts` (run of 15:32:27, `implementation/assets/32_test_db_verbose.txt`).
How a unit opens (BEGIN, the chain lock, the statement time limit) is the core's and is counted
in the round trips, not named.

**Before the unit**, at stage 7: the body is validated by the contract's schema, and the three
texts are refused if they hold something of the form of a credential or the presented code
itself (422, no attempt). Nothing is read or awaited between the handler and the unit, so
redeems that arrive together take their attempts in the order of their arrival.

**The right code** (14 round trips):

```
lock.take                               THE ATTEMPT IS TAKEN from the redeem lock, before any statement (ENG-24). Memory state
unit  BEGIN                             (then the chain lock and the statement time limit: AT-2)
unit  EXPIRE_ACTIVE_CODE                UPDATE … SET state = 'EXPIRED' … WHERE state = 'ACTIVE' AND expires_at <= $1 RETURNING id; no row here
unit  CONSUME_REDEEM_ATTEMPT            THE CONSUMING COMPARE-AND-SET, before the comparison (AT-4, AT-C2):
                                        UPDATE public.pairing_codes SET failed_attempts = failed_attempts + 1
                                         WHERE state = 'ACTIVE' AND expires_at > $1 AND failed_attempts < $2 RETURNING id, code_hash, failed_attempts
(the comparison)                        in this process, crypto.timingSafeEqual over SHA-256(<code ID>:<presented digits>) and the returned hash
unit  REDEEM_CODE                       AT-C3: UPDATE … SET state = 'REDEEMED', closed_at = $1, failed_attempts = failed_attempts - 1
                                         WHERE id = $2 AND state = 'ACTIVE' AND expires_at > $1 RETURNING id; the row count decides (ENG-25)
unit  READ_CORE_IDENTITY                the Core the device is paired with, for the answer and the row
unit  NEXT_REGISTRY_NUMBER              AT-5: UPDATE public.registry_counters SET next_value = next_value + 1 WHERE name = $1 RETURNING next_value - 1
unit  INSERT_DEVICE                     state PAIRED; last_seen_at = paired_at
unit  INSERT_DEVICE_CREDENTIAL          the SHA-256 of a new credential; the credential itself goes into the answer only
unit  INSERT audit_log PAIRING_SUCCESS
unit  event number
unit  INSERT events PAIRED
unit  COMMIT
lock.succeed                            after the commit: the count and the lock of redeeming are cleared; admin.changed DEVICES, PAIRING_CODE
```

**A wrong code, and equally an absent, a used, a cancelled or an expired one** (9 round trips;
the test asserts that the two timelines are equal):

```
lock.take
unit  BEGIN
unit  EXPIRE_ACTIVE_CODE
unit  CONSUME_REDEEM_ATTEMPT            a row: compared, no match. No row: no usable code, nothing is compared
lock.fail                               the failure is counted on the lock: attemptsRemaining 2, 1, and the third is the locking one
denialBudget.consume                    BEFORE the row; with no place left: no row, 429 after the commit, the attempt stays counted
unit  INSERT audit_log PAIRING_FAILED
unit  event number
unit  INSERT events PAIRING_FAILED
unit  COMMIT
```

**The fifth failed attempt of a code** (11 round trips): after the consuming statement,
`unit  EXHAUST_CODE` (`UPDATE … SET state = 'EXHAUSTED', closed_at = $1 WHERE id = $2 AND state =
'ACTIVE' AND failed_attempts = $3 RETURNING id`); after the failure's row and event,
`unit  INSERT audit_log PAIRING_CODE_CLOSED`.

**An attempt during the lock** (5 round trips): no statement names a code; nothing is compared.

```
lock.take                               locked
denialBudget.consume
unit  BEGIN
unit  INSERT audit_log PAIRING_LOCKED
unit  COMMIT
```

**A code past its 300 s**: `EXPIRE_ACTIVE_CODE` returns its row, `INSERT audit_log
PAIRING_CODE_CLOSED` follows at once, then the consuming statement finds no code and the failure
is written: closed and refused in one transaction.

| Point | How it is met |
|---|---|
| One unit (ENG-23, AT-1) | One `app.pipeline.run('pairing.redeem', …)`; the count, the transition and every row commit or roll back together |
| The attempt is consumed before it is verified (ENG-24, AT-4) | Twice: the redeem lock's `take` is the first thing of the unit, and the consuming UPDATE runs, and locks the code's row, before the comparison. Only the request to which that UPDATE returned a row compares |
| The transition is compare-and-set (ENG-25, AT-3) | `REDEEM_CODE` states `state = 'ACTIVE' AND expires_at > $1` again; the row count decides. `paired_devices_paired_with_code_id_key` is the last line |
| The attempt is given back on a success | `failed_attempts - 1` in the redeeming statement: the column means "failed redeems" in every committed row (tested: `REDEEMED` with the count it had before) |
| One failure answer (SR-29) | 401 `INVALID_CODE`, "The pairing code is not valid.", `details.attemptsRemaining`. That number is the count of the redeem LOCK, which does not depend on a code, so the answer says nothing about one |
| One audit row per attempt (SR-30) | `PAIRING_SUCCESS`, `PAIRING_FAILED` or `PAIRING_LOCKED`; beyond the denial budget none (SR-71) |
| The code | Goes to the comparison and nowhere else. The stored hash is returned by the consuming statement alone, for the comparison alone |
| The credential | `dvc_` and 32 bytes of `crypto.randomBytes` as base64url; returned once; stored as SHA-256 of the whole value |

## 5. The lock arithmetic

`src/modules/pairing/redeem-lock.ts`. Two counts are involved, as in the database contract (AT-6,
AT-C2):

| Count | Where | Limit | Reset |
|---|---|---|---|
| Failed redeems before the LOCK (PR-P4) | Memory: two limiters of `rate-limiter-flexible` 11.2.1, 3 points each (attempts taken, failures recorded). Nothing counts by hand. The key is global (`redeem`): unpaired callers cannot be told apart on loopback | 3 within 300 s, then 60 s | A success; the end of a lock; the end of the 300 s window; a restart |
| Failed redeems before the code is CLOSED (PR-P5) | The column `pairing_codes.failed_attempts`, moved by the consuming statement | 5 during the code's life | Never: a new code starts at 0 |

| Rule | Detail |
|---|---|
| The window | 300 s, opened by the first taken attempt, by the server clock (named in the limiter's key, as the throttle and the sign-in lockout do). A fixed window, as ruled for sign-in (D78 DN-1) |
| `take` | Locked: refused, nothing taken. Else one attempt leaves the counter. **Taking the third attempt of a window locks redeeming at once, for 60 s from that instant** (as D78 DN-2 for the fifth sign-in attempt): whoever comes fourth is refused although the three comparisons may not have ended |
| `fail` | `attemptsRemaining` is 3 minus the failures of the window (the simulator's meaning): 2, 1, 0. The third failure is the locking one and carries `lockedUntil` |
| `succeed` (after the commit) | The count and the lock are cleared: if the third attempt of a window is the right code, the lock its `take` set is lifted |
| During the lock | Every attempt: 423 `LOCKED` with `lockedUntil` and `retryInMs`, `PAIRING_LOCKED`, nothing compared, the code's count untouched |
| The end of a lock | A fresh count |
| The locking failure | Answers 423 `LOCKED` (the simulator's result for it, and D78 DN-3 for sign-in), with a `PAIRING_FAILED` row whose details hold `lockedUntil` |

Worked example, one code, on the manual clock (`lifecycle.db.test.ts`, AC-B-36):

| Instant | Attempt | Answer | Row | Code's `failed_attempts` |
|---|---|---|---|--:|
| t | wrong | 401, `attemptsRemaining: 2` | `PAIRING_FAILED` | 1 |
| t | wrong | 401, `attemptsRemaining: 1` | `PAIRING_FAILED` | 2 |
| t | wrong | 423, `lockedUntil: t + 60 s` | `PAIRING_FAILED` (`attemptsRemaining: 0`, `lockedUntil`) | 3 |
| t + 20 s | wrong, then the RIGHT code | 423, `retryInMs: 40,000` each | `PAIRING_LOCKED` × 2 | 3 |
| t + 59,999 ms | wrong | 423, `retryInMs: 1` | `PAIRING_LOCKED` | 3 |
| t + 60 s | wrong | 401, `attemptsRemaining: 2` | `PAIRING_FAILED` | 4 |
| t + 60 s | wrong | 401, `attemptsRemaining: 1` | `PAIRING_FAILED`, then `PAIRING_CODE_CLOSED` (`EXHAUSTED`) | 5, closed |
| t + 60 s | the right code | 423 (the third failure of the new window) | `PAIRING_FAILED` | 5 |

So a code allows at most five guesses: three, the lock, two more (spec §6.1 "Guessing bound").

## 6. The resolver's answers per state

`src/modules/pairing/resolver.ts`, behind the seam `app.deviceResolver`. The type is the
scaffold's, unchanged (`ResolvedDevice`, `DeviceResolver`).

| Stage 4 asks | Stored | Answer | What the caller sees |
|---|---|---|---|
| `resolveCredential(value)`, a value that has not the exact form `dvc_` + 43 characters | (not looked up: no query) | null | ANONYMOUS; 401 where a principal is needed |
| a well-formed value no credential row has | — | null | the same |
| the CURRENT credential of a PAIRED device | `current_hash` | `PAIRED` | DEVICE principal |
| the NEXT credential of a PAIRED device (a rotation that was not used yet) | `next_hash` | promoted in the unit `pairing.promoteCredential`, looked up again, then `PAIRED` | DEVICE principal; from this commit on the old credential is unknown |
| either credential of a REVOKED or UNPAIRED device | the row stays (contract §4.9) | `RETIRED` | 403 `DEVICE_REVOKED` with the guard's one `ACCESS_DENIED` row; health, the redeem and the socket handshake excepted |
| a credential that was rotated OUT | its hash is not stored any more | null | 401: it names no device |
| a hash that two rows hold (no request can produce it) | — | null | fails closed |
| `resolveDevice(id)`, an ID that has not the form `DEV-NNNN` | (no query) | null | the session resolves to nothing (`DEVICE_UNKNOWN`) |
| no such device, or a device row WITHOUT a credential row | — | null | the same |
| a PAIRED device | — | `PAIRED` | OPERATOR principal bound to the device |
| a REVOKED or UNPAIRED device | — | `RETIRED` | 403 `DEVICE_REVOKED` |

A lookup is one statement on the pool by the SHA-256 of the presented value; neither hash column
is selected (the statement returns whether the value is the pending one). A read that fails is
logged as `{ err }`, written to the error log, reported to readiness and answered 503.

**Last seen** (spec §6.5). A request that resolves to a PAIRED device, by its credential or by a
session bound to it, records `last_seen_at` when the stored value is 60 s old or older: one unit
(`pairing.deviceSeen`) with one compare-and-set statement (`… WHERE id = $1 AND state = 'PAIRED'
AND last_seen_at <= $3`). At most one write a minute per device; a GET is enough; a retired
device is never written. If that write fails, the failure is logged and persisted and the
request goes on: the answer of stage 4 was decided by the read.

## 7. Status table per operation, with the test for each (rule M13, MODG)

Every answer below is validated against the contract with `validateCoreApiResponse` in the named
test (`expectContract`). L = `lifecycle.db.test.ts`, D = `devices.db.test.ts`, C =
`concurrency.db.test.ts`, R = `routes.test.ts`, G = `registry.db.test.ts`.

| # | Status and code | When | Test |
|--:|---|---|---|
| 15 | 201 `PairingCodeIssued` | A holder of `PAIRING_MANAGE` | L "returns six digits once, valid 300 s …" |
| 15 | 401 `NOT_SIGNED_IN` | No principal | L "AC-B-32 …"; R "nobody without a principal …" |
| 15 | 403 `NOT_PERMITTED` (one `ACCESS_DENIED` row, the guard's) | A role without the permission | L "who may call is the guard's …" |
| 15 | 403 `DEVICE_REVOKED` (one row, the guard's) | A retired device | D "spec §6.6: a retired device …" |
| 16 | 200 `ActivePairingCode`, a code or null | | L "the status read shows the active code …"; R "16 getPairingCodeStatus …"; G "16 and 15 …" |
| 16 | 401, 403 | As 15 | L, R, D as above |
| 16 | 503 `NOT_READY` | The read fails | R "a read that fails answers 503 …" |
| 17 | 204 | A code is active, or none is | L "cancelPairingCode closes the active code …" |
| 17 | 401, 403 | As 15 | L, R |
| 18 | 201 `PairingRedeemed` | The right code | L "returns a device ID and a credential once …" |
| 18 | 400 `INVALID_JSON` | The body is not a JSON object | L "a body that does not match the contract …" |
| 18 | 401 `INVALID_CODE` | Wrong, used, cancelled, expired, absent | L "SR-29 …", "answers 401 INVALID_CODE at 300 s …" |
| 18 | 403 `ORIGIN_NOT_ALLOWED` | A foreign `Origin` (stage 3) | L "a web console origin, and an operator's session, may redeem too …" |
| 18 | 422 `INVALID_INPUT` | The schema; a text with a credential form or with the code | L "a body that does not match the contract …" |
| 18 | 423 `LOCKED` | During the lock, and the failure that locks | L "401, 401, then 423 with lockedUntil …" |
| 18 | 429 `RATE_LIMITED` | The denial budget of the key is used up | C "of 25 at once …", "a counted attempt that finds no place in the budget …" |
| 19 | 200 `PairedDeviceList` | | L (the listed device), D, G "lists every device ever paired …"; R "19 listPairedDevices …" |
| 19 | 401, 403 | As 15 | L, R |
| 20 | 200 `PairedDevice`, now REVOKED | A PAIRED device, a reason of 5 to 500 characters | D "ends the device's sessions …" |
| 20 | 400 `INVALID_JSON` | | D "answers 404 for an unknown device …" |
| 20 | 401, 403 | As 15 | L, R |
| 20 | 404 `NOT_FOUND` | No device has the ID | D the same test; G "20: a fixture device …" |
| 20 | 409 `INVALID_STATE` | The device is REVOKED or UNPAIRED | D, G |
| 20 | 422 `INVALID_REASON` | A reason under 5 characters after trimming, for a device that is PAIRED | D |
| 20 | 422 `INVALID_INPUT` | A malformed ID (`details.in: params`); no reason, not a text, over 500 characters, U+0000, a credential form (`details.in: body`) | D |
| 21 | 200 `DeviceRegistration` | A paired device, by its credential or by a session on it | D "a paired device reads its own registration …"; R "21 getDeviceRegistration …" |
| 21 | 401 `NOT_SIGNED_IN` | No credential; an unknown one; one that was rotated out | L "AC-B-32 …"; D "the new credential is returned once …" |
| 21 | 403 `DEVICE_REVOKED` | A retired device (the guard, with its row); a device retired while the request was in flight (the module, no row) | D "ends the device's sessions …"; C "a request that stage 4 resolved a moment before …" |
| 21 | 403 `DEVICE_NOT_PAIRED` | An operator's web session (the guard, no row) | D "… a web session is told that it is no device"; R |
| 22 | 204 | A paired device | D "by its credential: 204 …", "from an operator's session on the device …" |
| 22 | 401, 403 | As 21 | L, D, C, R |
| 23 | 200 `DeviceCredentialRotated` | A paired device | D "the new credential is returned once …" |
| 23 | 401, 403 | As 21 | L, D, C, R |

The order of a revoke's refusals follows spec §7.3: 401 and 403 before the body is read (stage
6); then 422 `INVALID_INPUT` (line 8); then 404, 409, and only then 422 `INVALID_REASON` (line
10): a reason is not judged for a device that could not be revoked anyway. The route attaches
the validation failure (`attachValidation`) so that the handler can give the short reason its
own code; whether "too short" is all that is wrong is judged by the contract's own schema.

One allowed and one refused call per operation (MODG): allowed in L, D or G for every operation;
refused in R "who may call is stage 6 …" (database-free) and in L, D with the guard's row.

## 8. Measured round trips for one command (rule M13)

Counted by the recording pool of `sequence.db.test.ts` (every statement that reached the
database, the unit's own opening and closing included: BEGIN, the chain lock, the statement time
limit, COMMIT are 4 of each unit's count). Run of 15:32:27.

| Command | Round trips | Of which on the pool (stage 4 and reads) |
|---|--:|--:|
| 15 `issuePairingCode` | 10 | 1 (the session lookup) |
| 16 `getPairingCodeStatus` | 2 | 2 |
| 17 `cancelPairingCode`, a code active | 8 | 1 |
| 18 `redeemPairingCode`, the right code | 14 | 0 |
| 18, a wrong or absent code | 9 | 0 |
| 18, the fifth failure of a code | 11 | 0 |
| 18, during the lock | 5 | 0 |
| 18, a body that does not validate | 0 | 0 |
| 19 `listPairedDevices` | 2 | 2 |
| 20 `revokeDevice` | 12 | 1 |
| 21 `getDeviceRegistration` | 3 | 3 (the credential lookup, two reads) |
| 21, the first use of a rotated credential | 9 | 4 |
| 21, or a read with a session of the device, once the last-seen entry is a minute old | + 5 | (the unit `pairing.deviceSeen`: within the minute none is taken) |
| 22 `unpairDevice` | 11 | 1 |
| 23 `rotateDeviceCredential` | 7 | 1 |
| Any operation that needs a principal, without a credential | 0 | 0 |
| The sweep with nothing to expire | 1 | 1 |

`listPairedDevices` on `tpl_bulk` (40 devices): one statement, 15,187 bytes, 7.9 ms in process
(5.7 ms in the run of 15:18:28).

## 9. Concurrency against PostgreSQL, and the statement each case relies on

`concurrency.db.test.ts`, on a clone of `tpl_seed`, the code under test as `dems_app`. Printed by
the run of 15:32:27:

```
[w32] AC-B-76 burst 1: 20 concurrent wrong redeems: statuses {"401":2,"423":18}; rows {"PAIRING_FAILED":3,"PAIRING_LOCKED":17}; PAIRING_FAILED attemptsRemaining 2, 1, 0; failed_attempts of the code 3, state ACTIVE
[w32] AC-B-76 burst 2 (60 s later): statuses {"401":2,"423":18}; rows {"PAIRING_FAILED":3,"PAIRING_CODE_CLOSED":1,"PAIRING_LOCKED":17}; failed_attempts of the code 5, state EXHAUSTED
[w32] AC-B-77: two concurrent redeems of the right code: [[201,null],[401,"INVALID_CODE"]]; 1 device row, rows {"PAIRING_SUCCESS":1,"PAIRING_FAILED":1}
[w32] AC-B-75: 25 calls with 5 retired device credentials: statuses {"403":20,"429":5}; 20 ACCESS_DENIED rows, all under class:local
```

| Case | Result | Relies on |
|---|---|---|
| **AC-B-76**, 20 concurrent wrong redeems | Exactly 3 are counted (`PAIRING_FAILED`; the code's `failed_attempts` is 3, still ACTIVE) and 17 find redeeming locked (`PAIRING_LOCKED`, nothing compared). Statuses: 401 × 2, 423 × 18: the 17 locked ones and the locking failure (the third counted one answers 423, section 5). The burst is the class's whole denial budget: the 21st request answers 429 and writes no row | (1) `lock.take` is the first thing of the unit, before any statement; the counter changes before the unit's first await; the third take locks at once. (2) `UPDATE public.pairing_codes SET failed_attempts = failed_attempts + 1 WHERE state = 'ACTIVE' AND expires_at > $1 AND failed_attempts < $2 RETURNING id, code_hash, failed_attempts` before the comparison |
| The second burst, 60 s later | Counts exactly 2 more on the code (4, 5); the code is `EXHAUSTED` with `failed_attempts` exactly 5; the third attempt of the window finds no usable code (a failure all the same, the locking one); 17 are locked | The same, and `UPDATE public.pairing_codes SET state = 'EXHAUSTED', closed_at = $1 WHERE id = $2 AND state = 'ACTIVE' AND failed_attempts = $3 RETURNING id` |
| The right code among a burst of 12, arriving eighth | 423: never a fourth comparison; no device | The same |
| Statement level, T-AT-2 (the review's wording): 20 consuming statements on real connections, no memory lock | Exactly five return a row, with the values 1 to 5; 15 return none; one closing statement closes the code; `failed_attempts = 6` is refused by the table (23514) | The consuming UPDATE locks the one ACTIVE row and re-evaluates its WHERE on the committed row |
| **SR-71**, 25 wrong redeems at once | 20 rows, 5 × 429 | `app.denialBudget.consume(request)` inside the unit, before the row |
| A counted attempt that finds the budget full (19 places used, two at once) | 401 and 429; the second was the fifth attempt of the code: no `PAIRING_FAILED` row, and yet the code is `EXHAUSTED` with 5 and its `PAIRING_CODE_CLOSED` row is there | With no place left the unit commits what it counted, and the 429 is thrown after it |
| **AC-B-77**, two concurrent redeems of the right code | One 201, one 401 `INVALID_CODE`; one device row, one `PAIRING_SUCCESS`; the code `REDEEMED` with the count it had before. Ten at once: one device, and the device counter moved by one | `UPDATE public.pairing_codes SET state = 'REDEEMED', closed_at = $1, failed_attempts = failed_attempts - 1 WHERE id = $2 AND state = 'ACTIVE' AND expires_at > $1 RETURNING id`; the unique key on `paired_with_code_id` |
| Statement level, T-AT-3: two transactions | The second consuming statement WAITS for the first transaction (observed waiting at 150 ms) and then returns no row; a redeeming statement for a `REDEEMED` code changes nothing | The row lock of the first consuming UPDATE |
| **Two (three) concurrent issues** | All 201 with different code IDs; exactly one `ACTIVE`; rows `ISSUED, CLOSED, ISSUED, CLOSED, ISSUED`; only the last code pairs | `UPDATE public.pairing_codes SET state = 'CANCELLED', closed_at = $1, closed_by_operator_id = $2 WHERE state = 'ACTIVE' RETURNING id`, then the insert; one counter statement per code ID (AT-5) |
| Statement level: two inserts of an `ACTIVE` row | The second waits for the first transaction and is refused with 23505 (`pairing_codes_one_active_key`); a second cancel cancels nothing | The unique index, whatever ran before |
| **A revoke racing nine requests of that device** (reads, a touch, two rotations, a second revoke) | The device is revoked exactly once (200 and 409); every other answer is 200 (in flight), 401 (its session ended under it) or 403 `DEVICE_REVOKED`; one `DEVICE_REVOKED` row, one `device.revoked`; afterwards every call 403 and the ended session row is never written again | `UPDATE public.paired_devices SET state = 'REVOKED', … WHERE id = $1 AND state = 'PAIRED' RETURNING id` with the end of the sessions in the same transaction; each device operation states the state again (`… AND d.state = 'PAIRED'`, `… WHERE id = $1 AND state = 'PAIRED'`); the activity statement never writes on an ended session |
| A request that stage 4 resolved a moment before the revoke committed | Registration, rotation and unpair each answer 403 `DEVICE_REVOKED`, change nothing, write no row, publish nothing | The same predicates; the revocation's own row is the record |
| Statement level: an unpair behind an uncommitted revoke | Waits, then changes nothing; a rotation and a second revoke after the commit change nothing | The same |
| **AC-B-75**, 25 calls with five retired credentials | One after the other: 20 × 403 with a row, then 5 × 429; four rows per device; `class:local` holds 20, every `device:<id>` key 0. All at once in the next window: 20 rows, 5 × 429. After the window a denied call is audited again | A retired credential is not a principal: stage 5 and `consume` key the request by the class of its Origin |

In one process the units are serial; the statements are written so that the result is right if
two units ran at the same time, which the statement-level tests show on real connections.

## 10. Secrets (row rule 2; AC-B-29, AC-B-41)

| Point | How it is met | Test |
|---|---|---|
| Generation | The code: `crypto.randomInt(0, 10^6)`, six digits with leading zeros. The credential: `crypto.randomBytes(32)`, base64url, prefix `dvc_` | `secrets.test.ts`; a static test pins the two default sources |
| Returned once | The code in the answer of operation 15, the credential in the answer of 18 and 23. No operation reads either again: the status read and the registry select no hash and no secret | L, D; `static.test.ts` rule 7 |
| Stored as hashes (contract §5.1) | `code_hash` = SHA-256(`<code ID>:<digits>`); `current_hash`, `next_hash` = SHA-256(the whole credential). 32 bytes each. The test computes each and compares it with the stored column in SQL | L "returns six digits once …", "returns a device ID and a credential once …" |
| Compared in constant time | The code: `timingSafeEqual` over two SHA-256 digests. The credential is never compared in process: it is found by its hash | `secrets.test.ts`; `static.test.ts` rule 4 |
| In no audit row, event, publication, log line, error or snapshot | The row builders take no secret (a static test); the audit writer refuses a credential form and a QR payload; the texts a redeeming caller sends are refused if they hold the code or a credential form; an error is logged as `{ err }` | `secrets.db.test.ts` |

The scan (`secrets.db.test.ts`, log level `trace`): a lifecycle of five codes, three wrong
guesses, four device credentials and a session token, through every transition of spec §6.2 and
§6.3, with the code and a credential also put into query strings, malformed JSON and refused
bodies, and with two statements made to FAIL by a revoked privilege (rule M14). Printed:

```
[w32] secret scan journey: rows {"ACCESS_DENIED":4,"DEVICE_CREDENTIAL_ROTATED":2,"DEVICE_REVOKED":1,"PAIRING_CODE_CLOSED":3,"PAIRING_CODE_ISSUED":5,"PAIRING_FAILED":12,"PAIRING_LOCKED":1,"PAIRING_SUCCESS":2,"UNPAIRED":1}; 8 codes and guesses, 5 credentials and tokens; failing statements answered 503, 500
[w32] AC-B-41 rows: 34 audit rows and 19 events of the journey; 0 codes, 0 credentials
[w32] AC-B-41 refusals: 26 answers of a refusal or a failure; 0 codes, 0 credentials, 0 markers
[w32] dump of dems_test_step_54_tmdjq3rs_f01_secrets: 165176 characters; 8 codes and guesses in 4 forms, 5 credentials and tokens in 6 forms: 0 found; 5 code hashes and 3 credential hashes present once each
[w32] AC-B-29 log capture: 33995 characters, 149 lines, 47 request lines; 0 codes, 0 credentials, 0 markers, 0 hashes
```

| Scanned | Result |
|---|---|
| Audit rows and events of the journey | No code (as digits of their own, hex, base64, base64url), no credential (six forms), no `DEMS-PAIR`. The detail keys of all pairing rows: `attemptsRemaining`, `certificateFingerprint`, `codeId`, `coreDeviceId`, `expiresAt`, `lockedUntil`, `reason`, `retryInMs`, `sessionsEnded` |
| Publications | Kinds `admin.changed` and `device.revoked` only; members `kind`, `resource`, `deviceId`, `reason` |
| The answers of 26 refusals and failures | No code echoed, no credential, no marker, nothing of a statement |
| The full dump (hash columns as hex) | No code beyond what the seed held before the journey, no credential. Not vacuous: the hash of each of the five codes is there once, the hash of each wrong guess under every code ID is absent, and of the credentials the current one, the pending one and the second device's are there once while the one rotated out is gone |
| The log at level `trace` | None of the values, no marker, no hash of a code or a credential, no run of 64 hexadecimal digits; no request line holds a query string; a parse or validation failure of the redeem is logged by its code only |
| The two failing statements (rule M14) | The lookup of a credential (`42501`): answered 503, one line `{ err: { type, code, message: code, stack }, source }`. The unit of a rotation: answered 500; its line names the SQLSTATE. No line quotes a statement, a parameter or a column name |

How a six-digit code is searched: as digits that are not part of a longer run of digits or
hexadecimal digits, not decimals, and not the number of an identifier; a positive control in the
file shows that the scan finds a code in seven written forms and leaves identifiers, timestamps
and hashes alone. For the dump the count is compared with the dump taken before the journey.

## 11. What the next rows can rely on

### 11.1 The biometric row (W41)

| Need | What to use |
|---|---|
| The device of a request | `pairedDeviceOf(request)` of the identity module (a DEVICE principal, or an OPERATOR bound to a device). Operations 8 and 9 are `DEVICE` in the registry: a retired device never reaches their handler (stage 6) |
| Is a device PAIRED, outside a unit | `app.deviceResolver.resolveDevice(deviceId)`: `PAIRED`, `RETIRED` or null |
| Is a device PAIRED, INSIDE its own unit (AT-C4 "device PAIRED") | `readDeviceState(unit, deviceId)` from `src/modules/pairing`: `'PAIRED' \| 'REVOKED' \| 'UNPAIRED' \| null`, read on that unit's transaction |
| What a revoke or an unpair does to the biometric enrolment | **Nothing has to be called.** In its own unit the pairing module ends the device's sessions (`app.sessionRegistry.endForDevice`) and revokes the device's LIVE biometric tokens: `UPDATE public.biometric_tokens SET revoked_at = $2, revoke_reason = $3 WHERE device_id = $1 AND used_at IS NULL AND revoked_at IS NULL` with the reason `DEVICE_REVOKED` or `DEVICE_UNPAIRED` (both in the CHECK list). The token's own compare-and-set (`… AND revoked_at IS NULL`) then claims nothing. Used tokens are left as they are (tested with fixture rows) |
| `app.sessionRegistry.endBiometricSessions` | The identity row's, for a reused token; not used by pairing |
| A real device in a test | `pairDevice(pairing, cookie)` of `src/modules/pairing/__tests__/support.ts`: a device paired through operations 15 and 18, with the credential the server issued. The registry double of the identity tests is no longer needed |
| The lockout key of a device | The device's registry ID, as before (`consoleIdentityOf`) |

### 11.2 The realtime row (W42)

| Need | What to use |
|---|---|
| Close the sockets of a revoked or unpaired device | The publication `{ kind: 'device.revoked', deviceId, reason: 'REVOKED' \| 'UNPAIRED' }`, sent in `unit.afterCommit`: send `device.revoked`, then close 4403, on every socket of that device (its DEVICE sockets and the sockets of sessions bound to it). No `session.ended` is published for the sessions a revoke ended: their sockets are the device's |
| Tell the portal | `{ kind: 'admin.changed', resource: 'DEVICES' }` (a pairing, a revoke, an unpair, a rotation) and `resource: 'PAIRING_CODE'` (an issue, a cancel, an expiry, a redeem, every counted failure) |
| Order beside a running engine | Of one unit: first the engine's `state` publication that appends the unit's audit rows, then the module's own publications (tested in `engine.db.test.ts`: `state[DEVICE_REVOKED]`, `device.revoked REVOKED`, `admin.changed DEVICES`) |
| `online` of the registry | Call `pairingControl(app).presence.socketOpened(deviceId)` when an authenticated socket of a device opens and `.socketClosed(deviceId)` when it closes. The pairing module calls `.forget(deviceId)` itself after a revoke or an unpair. Until the channel calls it, every device is offline |
| The tablet link (spec §6.8) | `pairingControl(app).presence.online()` is the list of PAIRED devices with an open socket; `app.engine.setTabletLink` stays the channel's call |
| The upgrade | It passes stage 4 like any request: `request.principal` and `authenticationOf(request)` (`DEVICE_RETIRED`: close 4403). The resolver records last seen at the upgrade too |

### 11.3 The mobile pairing flow and the portal (client rows)

| Point | What the server does |
|---|---|
| The redeem request | No `Origin`, no credential, `{ code, deviceName, platform, appVersion }`. 201: `{ deviceId, deviceCredential, pairedAt, core: { deviceId, name, certificateFingerprint } }`. The credential is in this answer and nowhere else |
| 401 `INVALID_CODE` | `details.attemptsRemaining` is 2, then 1: attempts before the LOCK, not attempts left of the code. It is the same for a wrong, an expired, a used, a cancelled and an absent code |
| 423 `LOCKED` | `details.lockedUntil`, `details.retryInMs`. The THIRD failure answers it at once (as the simulator's result). The lock is global: it may come from another caller's attempts |
| 422 | Six characters that are not digits, a missing member, a text over its bound. Never counted, never audited. Also: a device name, platform or version that holds the code or something of the form of a credential |
| 429 | 20 audited refusals of the key within 60 s, or 30 requests: for a caller without a credential the key is `class:local`, shared by every such caller |
| At app start | `getDeviceRegistration` with the credential: 200; 403 `DEVICE_REVOKED` (delete the credential, pairing screen, notice "revoked"); 401 `NOT_SIGNED_IN` (the credential is unknown to this Core: notice "unknown") |
| After `unpairDevice` (204) | The credential is retired at once; the device's sessions are ended |
| Cookies | No answer of these operations sets one |
| The portal | The code is in the answer of the issue only; `getPairingCodeStatus` gives the ID, the issuer, the two times and the attempts left of the CODE (5 minus its failed redeems), or `active: null` once it is closed or past its time. `expiresAt = issuedAt + 300,000` |
| `rotateDeviceCredential` | No client calls it. If one ever does: keep the old credential until a request with the new one succeeded |

## 12. Verification

### 12.1 The row command

From `implementation/assets/32_final_runs.log` (the last run before this document was closed):

```
=== 15:33:01 row, unit: npm run test -w @dems/core-server -- --maxWorkers=2 src/modules/pairing
> @dems/core-server@0.2.0 test
> vitest run --project unit --maxWorkers=2 src/modules/pairing
 Test Files  4 passed (4)
      Tests  63 passed (63)
   Start at  15:33:01
   Duration  1.62s (transform 49%, import 42%, tests 9%)
exit 0 (15:33:03)

=== 15:33:03 row, db: DEMS_TEST_STEP=54 npm run test:db -w @dems/core-server -- --maxWorkers=2 src/modules/pairing
> @dems/core-server@0.2.0 test:db
> vitest run --project db --maxWorkers=2 src/modules/pairing
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_54_tmdjr36y_
[test:db] stale sweep: dropped 0; kept 33 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
 Test Files  7 passed (7)
      Tests  79 passed (79)
   Start at  15:33:03
   Duration  14.31s (tests 67%, import 22%, transform 12%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 3 database(s) in 344 ms; 0 remain with the run prefix dems_test_step_54_tmdjr36y_
exit 0 (15:33:18)
```

Every test by name, with what it printed: `implementation/assets/32_test_unit_verbose.txt` (63 pass
marks, 15:32:24) and `32_test_db_verbose.txt` (79 pass marks, 15:32:27).

### 12.2 The module gate (MODG)

Printed by `routes.test.ts` (15:32:24, `implementation/assets/32_test_unit_verbose.txt`):

```
[w32] MODG routes of src/modules/pairing:
  POST /api/v1/pairing/code issuePairingCode
  GET /api/v1/pairing/code getPairingCodeStatus
  POST /api/v1/pairing/code/cancel cancelPairingCode
  POST /api/v1/pairing/redeem redeemPairingCode
  GET /api/v1/pairing/devices listPairedDevices
  POST /api/v1/pairing/devices/{id}/revoke revokeDevice
  GET /api/v1/pairing/device getDeviceRegistration
  POST /api/v1/pairing/device/unpair unpairDevice
  POST /api/v1/pairing/device/credential rotateDeviceCredential
[w32] MODG registry, operations 15 to 23:
  POST /api/v1/pairing/code issuePairingCode
  GET /api/v1/pairing/code getPairingCodeStatus
  POST /api/v1/pairing/code/cancel cancelPairingCode
  POST /api/v1/pairing/redeem redeemPairingCode
  GET /api/v1/pairing/devices listPairedDevices
  POST /api/v1/pairing/devices/{id}/revoke revokeDevice
  GET /api/v1/pairing/device getDeviceRegistration
  POST /api/v1/pairing/device/unpair unpairDevice
  POST /api/v1/pairing/device/credential rotateDeviceCredential
```

| MODG clause | Evidence |
|---|---|
| The route list equals the registry operations | The two lists above are asserted equal; the area of the registry has exactly these nine, numbered 15 to 23 |
| Every documented status the module can produce has a test, and every answer validates against the contract | Section 7 |
| The role-by-operation decision is the guard's; one allowed and one refused call per operation | Section 7, last paragraph. The rule the guard registered for each route is asserted to be the registry's (`PAIRING_MANAGE` × 5, `PUBLIC` × 1, `DEVICE` × 3) |
| No check of who may call in the folder | `static.test.ts` rule 1; `routes.test.ts` "no route carries a check of its own" |
| Typecheck and lint exit 0 without a warning | Section 12.4 |
| A mutation check of the module's own logic | Section 13 |

### 12.3 The cases of plan W32

| Case | Result | Test |
|---|---|---|
| Six digits valid 300 s with only a hash stored | `expiresAt = issuedAt + 300,000`; redeems at 299,999 ms, not at 300,000; the stored column equals SHA-256(`<code ID>:<digits>`) and nothing else | L |
| A second redeem and an expired code answer the generic `INVALID_CODE` | Five causes, one answer | L "SR-29 …" |
| Lock after three failures, close after five | Section 5 | L "401, 401, then 423 …" |
| Revoke makes the next call answer 403 `DEVICE_REVOKED` | For the credential and for each session token of the device, each with the guard's one row | D "ends the device's sessions …" |
| Two-phase rotation | Section 6 | D "the new credential is returned once …", "a second rotation …", "two first uses …" |
| Of 20 concurrent wrong redeems exactly three count and 17 answer 423; a second burst counts exactly two more and the code closes at five | Section 9 | C |
| Two concurrent redeems of the right code give one 201 and one 401 | Section 9 | C |
| 25 calls with five retired device credentials write at most 20 rows | 20 | C |
| A scan of audit rows, events and the log capture finds no code and no credential | Section 10 | `secrets.db.test.ts` |
| `getSignInStatus` needs no console identity (D18) | Without a credential and without an `Origin`: 200, the web console's lock state; with the own origin: 200; with a paired device's credential: 200, the device's lock state; with a retired credential: 403 | L "AC-B-32 …"; D |
| A device without a credential (AC-B-32) | `signIn` 403 `DEVICE_NOT_PAIRED` with no `Origin` and with the own origin; health, the redeem and the status read are open; the other eight operations of the area 401, no row | L |
| A sign-in on a paired device (AC-B-37) | The session is bound to the device; `AUTH_SUCCESS` and the registry name the device and the operator; the registry shows the newest open session inside its limits | D |

### 12.4 Whole projects, typecheck, lint (final state)

From `implementation/assets/32_final_runs.log`:

```
=== 15:32:48 typecheck: npm run typecheck -w @dems/core-server
> @dems/core-server@0.2.0 typecheck
> tsc --noEmit
exit 0 (15:33:00)

=== 15:33:00 lint: npm run lint -w @dems/core-server
> @dems/core-server@0.2.0 lint
> oxlint
exit 0 (15:33:01)

=== 15:33:18 whole unit: npm run test -w @dems/core-server -- --maxWorkers=2
> @dems/core-server@0.2.0 test
> vitest run --project unit --maxWorkers=2
 Test Files  102 passed (102)
      Tests  2661 passed (2661)
   Start at  15:33:18
   Duration  47.30s (import 56%, tests 40%, transform 4%)
exit 0 (15:34:06)

=== 15:34:06 whole db: DEMS_TEST_STEP=54 npm run test:db -w @dems/core-server -- --maxWorkers=2
> @dems/core-server@0.2.0 test:db
> vitest run --project db --maxWorkers=2
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_54_tmdjsuqp_
[test:db] stale sweep: dropped 0; kept 10 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
 Test Files  75 passed (75)
      Tests  1081 passed (1081)
   Start at  15:34:06
   Duration  123.73s (tests 83%, import 15%, transform 1%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 8 database(s) in 565 ms; 0 remain with the run prefix dems_test_step_54_tmdjsuqp_
exit 0 (15:36:10)
```

Against the controller's baseline of 14:11 (`unit` 77 files / 1,992 tests; `db` 48 files / 740
tests): this row added 4 files / 63 tests to `unit` and 7 files / 79 tests to `db` (section 14);
the remaining 21 files / 606 tests of `unit` and 20 files / 262 tests of `db` are the other
module rows' and the foundation fix rows', landed in the same window. Both totals are above the
ledger. Lint printed no warning.

### 12.5 Every run of the whole projects, and what was not this row's (P11)

| Time | Run | Result | Not this row's |
|---|---|---|---|
| 14:49:02 | Whole `unit` | 95 files; 2,523 passed, **2 failed** | Both in files of the guard row that its owner was writing at that minute (modified 14:48): `src/modules/rbac/__tests__/routes.test.ts` "reloadMatrix refuses an empty matrix …" and `src/plugins/permission-guard/__tests__/boot-registry.test.ts` "an entry of an operation whose route is NOT registered …". The two files alone at 14:49:09: 2 files, 21 tests, exit 0. Noise (P11; decision D85) |
| 15:10:19 | Whole `db` | 74 files, 1,071 tests, exit 0; 0 databases remain | — |
| 15:11:17 | Whole `unit` | 101 files, 2,647 tests, exit 0 | — |
| 15:34:06 | Whole `unit` (final) | 102 files, 2,661 tests, exit 0 | — |
| 15:36:10 | Whole `db` (final) | 75 files, 1,081 tests, exit 0; 0 databases remain | — |

Decision D85 (three test files of the guard row red by design until its owner's fix): in every
whole-project run of this row, from 14:49:09 on, `guard.test.ts`, `denial.db.test.ts` and
`matrix.db.test.ts` were green; none was edited or worked around by this row.

Typecheck and lint of the workspace, every run:

| Time | Command | Result | Not this row's |
|---|---|---|---|
| 14:35:41 | typecheck | exit 2 | 3 errors, all in `src/modules/admin/__tests__/rule.test.ts` and `src/modules/evidence/__tests__/cursor.test.ts` (rows in flight) |
| 14:35:46 | lint | exit 0, 2 warnings | Both in `src/modules/admin/__tests__/` |
| 14:39:42 | typecheck | exit 0 | — |
| 14:43:15 | typecheck | exit 2 | Only `src/modules/devices/__tests__/status.test.ts` (a row in flight) |
| 14:46:33 | typecheck | exit 2 | This row's: a missing type in `concurrency.db.test.ts`; fixed, exit 0 at 14:46:59 |
| 14:55:50 | typecheck | exit 2 | This row's: one line of `routes.test.ts`; fixed, exit 0 at 14:56:08 |
| 14:56:08 | lint | exit 0, 5 warnings | This row's test files (two unused imports, two optional chains, one spread); fixed. At 14:56:36: one warning, in `src/modules/storage/index.ts` (a row in flight) |
| 14:47:43, 15:00:44, 15:03:26, 15:06:18, 15:13:10, 15:15:54, 15:29:39, 15:30:59 | typecheck | exit 0 | — |
| 15:29:44 | lint | exit 0, no warning | — |
| 15:33:00, 15:33:01 | typecheck, lint (final) | exit 0; exit 0, no warning | — |

## 13. Mutation check

98 defects were planted one at a time and the row's own tests run on each. **97 of 98
detected; the one survivor is an equivalent mutant.**

**No file of the repository was changed for it (rule M15, decision D88).** A scratch Vitest
configuration in the session's scratchpad, outside the repository, adds one transform that hands
ONE production file to Vitest with ONE text replaced; the tree on disk stayed as it was, so no
other row's run saw a mutated file (`implementation/assets/32_mutation_harness.vitest.config.mjs.txt`,
`32_mutation_harness.run.sh.txt`, `32_mutations.json`; result lines `32_mutations.log`). The
runner goes from the cheapest stage to the dearest and stops at the first that detects: the
three database-free behaviour files; then `lifecycle`, `devices`, `concurrency`; then
`sequence`, `secrets`, `engine`, `registry`; last the static file.

| File | Mutations | Detected | by the unit files | by `lifecycle`, `devices`, `concurrency` | by `sequence`, `secrets`, `engine`, `registry` | Survived |
|---|--:|--:|--:|--:|--:|--:|
| `store.ts` | 22 | 22 | 1 | 20 | 1 | 0 |
| `secrets.ts` | 6 | 6 | 6 | 0 | 0 | 0 |
| `redeem-lock.ts` | 8 | 7 | 7 | 0 | 0 | 1 |
| `redeem.ts` | 14 | 14 | 0 | 14 | 0 | 0 |
| `codes.ts` | 8 | 8 | 1 | 6 | 1 | 0 |
| `devices.ts` | 13 | 13 | 1 | 11 | 1 | 0 |
| `resolver.ts` | 9 | 9 | 3 | 5 | 1 | 0 |
| `routes.ts` | 9 | 9 | 0 | 7 | 2 | 0 |
| `activity.ts` | 4 | 4 | 0 | 4 | 0 | 0 |
| `database.ts` | 2 | 2 | 2 | 0 | 0 | 0 |
| `presence.ts` | 2 | 2 | 2 | 0 | 0 | 0 |
| `index.ts` | 1 | 1 | 0 | 1 | 0 | 0 |
| **All** | **98** | **97** | 23 | 68 | 6 | 1 |

| Pass | Result |
|---|---|
| First, 15:17:05 to 15:30:39, 98 mutations | 95 detected. **M36**, **M76** and **M79** survived |
| What was done | **M76** (last seen written at every request): the statement's own predicate kept the result right, so only the cost changed; `sequence.db.test.ts` now asserts that within the minute NO unit is taken, by a session and by the credential. **M79** (a credential that is still pending after its promotion ran resolves): a fail-closed line no request can reach; `routes.test.ts` now drives it with a pool whose promotion changes nothing and expects "nothing", and no last-seen write. **M36**: below |
| Second, 15:31:13 to 15:32:06 | M76 detected (`sequence`), M79 detected (`routes.test.ts`), M36 survives. M04 run again: detected by `lifecycle` (in the first pass its database stage ran while a verbose run of this row's own tests was in flight under the same step label and printed no summary, so the runner went on to the static stage) |

**M36, the equivalent mutant.** The memory limiter is created with `points: 3`; the mutant gives
it 5. The module does not rely on the library's refusal: it compares the count the library
returns with 3 itself (`taken > REDEEM_LOCK_MAX_FAILURES` refuses, `taken === 3` locks). With a
limit of 5 the fourth and fifth `consume` resolve with 4 and 5 instead of rejecting, and both
paths refuse. No input tells the two programs apart; the library's limit is a second line
behind the comparison.

Among the 98: the consuming statement without the expiry or the `ACTIVE` predicate, or
consuming nothing; the redeeming statement not a compare-and-set, or not giving the attempt
back; a code expired one millisecond late or living one millisecond longer; a revoke, an unpair
or a rotation that is not a compare-and-set on `PAIRED`; the next credential never found, never
promoted, or valid beside the old one for ever; a used biometric token revoked, or the tokens
of every device; the registry showing an idle, an ended or the oldest session, or listed oldest
first; a device row without a credential row resolving; a code without leading zeros or never
starting with zero; the code hashed without its ID, the credential without its prefix; every
code matching; a 128-bit credential; the third take not locking, the third failure not the
locking one, the lock one millisecond longer or 30 s, a success keeping the count or the lock;
the code not compared, or compared during the lock; no place taken in the denial budget for a
failure or for a locked attempt; beyond the budget the unit rolled back; the fifth failure not
closing the code; a device name carrying the code into the registry; the locking failure
answering 401; no `attemptsRemaining`; the stored hash not that of the returned secret; a
replaced code closed without its row; an expired code recorded as cancelled; an issue without
its row; a revoke that does not end the sessions, leaves the biometric tokens, does not count
the sessions, publishes before the commit or not at all; 404 and 409 swapped; a short reason
answered before 404 and 409, or as `INVALID_INPUT`; every problem of the reason counted as "too
short"; a malformed ID not refused; a credential-shaped reason reaching the audit writer; a
retired credential or a retired device's session resolving as PAIRED; a value of any form looked
up; no revision header, or the revision before the command; a redeem answering 200; **an answer
to a device that sets a cookie**; rows that do not name the new device, the cancelling operator
or the operator of the session; **a failed read that logs the error under another key than
`err`**, or answers 500 with the driver's error; the presence counter miscounting.

Limit of the check: the static test file scans the sources from disk, not through the
transform, so its scans cannot see a mutation; it does see a mutated STATEMENT, because it reads
the statements through an import. No mutation needed it: every one was detected by a behaviour
test.

## 14. Test ledger (P24)

| Workspace, project | Before this row (controller baseline 14:11) | Added by this row | Files |
|---|---|---|---|
| `@dems/core-server`, `unit` | 77 files, 1,992 tests | 4 files, 63 tests | `src/modules/pairing/__tests__/routes.test.ts` (15), `static.test.ts` (26), `secrets.test.ts` (11), `redeem-lock.test.ts` (11) |
| `@dems/core-server`, `db` | 48 files, 740 tests | 7 files, 79 tests | `src/modules/pairing/__tests__/lifecycle.db.test.ts` (15), `devices.db.test.ts` (16), `concurrency.db.test.ts` (14), `secrets.db.test.ts` (11), `sequence.db.test.ts` (13), `engine.db.test.ts` (4), `registry.db.test.ts` (6) |
| `@dems/shared`, `@dems/core-web`, `@dems/mobile` | unchanged | 0 | — |

No test was removed. One existing test lost two assertions and a clause of its title by design
(section 15); its count is unchanged. The whole-project totals at the end hold the other module
rows' additions too (section 12.4).

## 15. Existing tests changed by design

**`apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts`** (standing rule M10 and
row rule 1: the row that fills a seam deletes its own stub assertion). Re-read right before the
edit: 350 lines, SHA-256 `80ccbc14…` (the file as the guard row left it; equal to the pre-image
`.cache/rollback/W32.readiness.test.ts.pre`). Edited at 14:48:27; after: 348 lines, `e788aeb5…`.
Only this row's lines:

```
239c239
<   it('the seams that answer as they are: a working clock, a publish that does nothing, a resolver that knows no device, and the budget, which resolves for a request it cannot read', async () => {
---
>   it('the seams that answer as they are: a working clock, a publish that does nothing, and the budget, which resolves for a request it cannot read', async () => {
244,245d243
<     await expect(app.deviceResolver.resolveCredential('dvc_unknown')).resolves.toBeNull();
<     await expect(app.deviceResolver.resolveDevice('DEV-0001')).resolves.toBeNull();
```

Reason: the two lines pinned the scaffold's stub ("a resolver that knows no device"). With the
registry behind the seam, `resolveDevice('DEV-0001')` reads the database, which this
database-free test does not have: before the edit the test failed with `promise rejected
"ApiFailure: The server is not ready…"` (14:48:20). What the lines covered is tested in this
row's folder: a value that is not of the form costs no query and resolves to nothing; a failed
read answers 503 (`routes.test.ts`). After the edit: 2 files, 32 tests, exit 0 (14:48:28).

No other file outside the folder was edited. One block of the identity row is named in finding
F-1: it passes, and was not touched.

## 16. Contract gaps (decision D84: named with the row)

No gap blocks the row; each is a text of the contract that the close-out row (W83) can change.

| ID | Where | What | Exact text for the close-out row |
|---|---|---|---|
| CONTRACT-GAP-W32-1 | `packages/shared/src/api/pairing.ts`, operation `redeemPairingCode`, `responses[423].description` | It says "The attempt is not compared and writes PAIRING_LOCKED." The failure that LOCKS (the third within 300 s) answers 423 too, was compared, and writes `PAIRING_FAILED` (the simulator's result for it; D78 DN-3 for sign-in) | "Redeeming is locked for 60 s after 3 failures (LOCKED); `details.lockedUntil` and `details.retryInMs` say how long. The failure that locks answers this too and writes PAIRING_FAILED; an attempt during the lock is not compared and writes PAIRING_LOCKED." |
| CONTRACT-GAP-W32-2 | The same file, `PairingRedeemRequestSchema` (the descriptions of `deviceName`, `platform`, `appVersion`) and `DeviceRevokeRequestSchema.reason` | The server refuses, with 422 `INVALID_INPUT`, a text that holds something of the form of a credential (`ses_…`, `dvc_…`, `bio_…`, a QR payload) and, for the redeem, a text that holds the presented code. The schema cannot express it and the descriptions do not say it | Add to the description of `deviceName`: " It must not hold the pairing code or anything of the form of a credential: such a body is refused with 422 INVALID_INPUT." Add to the description of `reason`: " It must not hold anything of the form of a credential (422 INVALID_INPUT)." |
| CONTRACT-GAP-W32-3 | The same file, operations `getDeviceRegistration`, `unpairDevice`, `rotateDeviceCredential`, `responses[403]` (`forbidden()`) | The description names `DEVICE_REVOKED` "(one ACCESS_DENIED audit row)" and the Origin. Two more 403 exist: an operator's web session on a device-only operation answers `DEVICE_NOT_PAIRED` (the guard, no row; spec §7.2); and a device that was retired while its request was in flight answers `DEVICE_REVOKED` WITHOUT a row | `403: forbidden('an operator\'s web console session called a device-only operation (DEVICE_NOT_PAIRED; no audit row)')`, and in `operation-parts.ts` the constant `REVOKED`: "… (DEVICE_REVOKED; one ACCESS_DENIED audit row, none when the device was retired while the request was in flight)" |
| CONTRACT-GAP-W32-4 | `packages/shared/src/api/pairing.ts` (or `constants.ts`) | The lifetime of a code (300 s), the attempts of a code (5) and the QR prefix exist in the contract only as description text and as a pattern; the server holds them as local constants (`src/modules/pairing/limits.ts`), the portal will need the same numbers. Related to CONTRACT-GAP-4 (the token prefixes) | `export const PAIRING_CODE_LIFETIME_MS = 300_000; export const PAIRING_CODE_MAX_FAILED_REDEEMS = 5; export const PAIRING_QR_PREFIX = 'DEMS-PAIR:1:';` and, with CONTRACT-GAP-4, `DEVICE_CREDENTIAL_PREFIX = 'dvc_'` |

No `SCHEMA-GAP` and no `SIM-GAP`: every statement is one `dems_app` may issue, every row passed
the audit writer's rules, and no detail key was missing from the closed list (the four
server-written pairing types use `codeId`, `expiresAt`, `reason`, `sessionsEnded` and nothing
else; the four simulator types use the simulator's keys and `codeId`, `sessionsEnded`).

## 17. What the specification left open, and this row's choices

| # | Open point | Choice | Why |
|--:|---|---|---|
| 1 | What the failure that locks answers | 423 `LOCKED` with `lockedUntil`, row `PAIRING_FAILED` | The simulator's result (`packages/shared/src/sim/pairing.ts:95-98`); the same as ruled for sign-in (D78 DN-3); the app's `locked` view then starts with the third failure, as in Simulated mode |
| 2 | When the lock starts | When the third attempt is TAKEN | With "consume, then verify" three attempts can be in flight; the fourth must be refused although none has failed yet (D78 DN-2) |
| 3 | The window of the lock | Fixed, 300 s from the first taken attempt | As ruled for sign-in (D78 DN-1) |
| 4 | What `attemptsRemaining` of the redeem ANSWER counts | The lock's attempts (3 minus the failures of the window) | The code's own count would say whether a code is active (SR-29). The operator reads the code's count with operation 16 |
| 5 | Who closes a code past its time | Whoever comes first: the sweep (5 s, only while the server listens), a redeem, an issue, a cancel; each with the row `PAIRING_CODE_CLOSED` (`EXPIRED`) | AC-B-35 asks for the row after a redeem; a test server does not listen. The status read never writes: it answers `active: null` for a code past its time |
| 6 | A credential that was rotated out | Unknown: 401 | The table keeps two hashes (contract §4.9); the old one is overwritten by the promotion |
| 7 | A second rotation before the first use | It replaces the pending credential; the current one stays valid | "A lost answer leaves the old one valid" (T7) |
| 8 | Where `online` comes from before the realtime channel exists | A presence counter in this folder, fed by the channel (section 11.2) | The seam list has no member for it; the registry is the reader |
| 9 | Who writes `last_seen_at` | The resolver, at stage 4, at most once a minute per device, in a unit of its own | "Last authenticated request or socket of the device" (spec §6.5): the resolver sees every one of them |
| 10 | The actor of the redeem's rows | The operator of the caller's session when the redeem came with one, else none; the row's device is the NEW device (success) or the device the caller already is (failure), else none | Rule M8: the actor is the principal; the usual caller has none |
| 11 | The order of a revoke's refusals | 422 `INVALID_INPUT`, then 404, then 409, then 422 `INVALID_REASON` | Spec §7.3 lines 8 and 10 |
| 12 | A device name, platform or version that holds the code or a credential form | 422 `INVALID_INPUT`, before any attempt | Database contract NL-2: neither is ever written to a column; the registry would return it |
| 13 | The severity of `DEVICE_CREDENTIAL_ROTATED` | WARNING | No client calls the operation; outside the server's own tests the row deserves a look (spec §6.3) |
| 14 | The biometric tokens of a retired device | Revoked by the pairing unit, live ones only | SR-34: "in the same transaction" |
| 15 | A publication for a counted failure | `admin.changed` `PAIRING_CODE` | The portal shows the attempts left of the code |

## 18. Findings

| ID | Finding | Evidence | Effect |
|---|---|---|---|
| F-1 | **A test block of the identity row keeps passing for another reason than its title says.** `src/plugins/authenticate/__tests__/authenticate.db.test.ts:171-187` ("the seam deviceResolver while the pairing module has not filled it > denies …") builds a second app without the registry double and expects `DEVICE_UNKNOWN` for a session of `DEV-0001`. The seam is filled now. The block still passes because its fixture device (`insertPairedDevice` of the identity test support) has no `device_credentials` row, and the registry knows a device only with its credential row (section 6) | Whole `db` project green with the block in it (section 12.5) | Not edited. Smallest change, for the identity row's owner or the code review: retitle the `describe` to "a device row without a credential row is no device of the registry", or delete the block (this row tests the same in `devices.db.test.ts` "a device row without its credential row …") |
| F-2 | Rule M6 ("consume, then the unit with the row") cannot be kept to the letter by a redeem: whether it is a refusal is known only inside its ONE unit | Section 4 | The place is taken inside the unit, before the row. Beyond the budget the unit commits what it counted (the attempt on the lock and on the code, the close of the code with its row) and the 429 is thrown after it. Deviation DV-1 |
| F-3 | The bulk fixture's audit rows of the pairing types were written as the owner, not through the audit writer, and use detail keys the writer would refuse or miss: `DEVICE_CREDENTIAL_ROTATED` with `phase`, `DEVICE_REVOKED` without `reason`, `PAIRING_SUCCESS` with `platform` | `src/db/fixtures/identity.ts:443, 455, 492` | None for this row. For the audit list row (W39) and the client rows: a client that renders pairing rows from the closed key list meets other keys on `tpl_bulk` |
| F-4 | A request of a device can write: once a minute the resolver records `last_seen_at` in a unit of its own, also for a GET | Section 6; `sequence.db.test.ts` | As specified (§6.5). A test of another row that counts statements of a device request sees one more unit after a minute of the manual clock |
| F-5 | A 429 can follow a counted attempt | Section 9, SR-71 | The caller of a redeem that found the budget full gets 429 although its guess was counted. It cannot tell a wrong guess from a right one by it: a right code pairs (it writes no refusal row and needs no place) |
| F-6 | The contract's 403 text of the three device operations does not name `DEVICE_NOT_PAIRED` | CONTRACT-GAP-W32-3 | For W83 |
| F-7 | Transient reds in files of the guard row while its owner edited them | Whole `unit` at 14:49:02: 2 failed (`rbac/__tests__/routes.test.ts`, `permission-guard/__tests__/boot-registry.test.ts`, both written at 14:48); the two files alone at 14:49:09: 21 of 21 | Noise by P11 (decision D85) |
| F-8 | The scratch mutation harness needs the repository's `node_modules` resolvable from its own folder | First start of the harness: "Cannot find package 'vitest'" | A symbolic link in the scratch folder, outside the repository; removed at the end |
| F-9 | Two `test:db` runs of ONE row under the same step label at the same time: the database stage of mutation M04 (first pass, about 15:18) printed no summary while a verbose run of this row's own tests ran beside it. The cause was not analysed (the stage's output was overwritten by the next one); alone, the same stage detects M04 (second pass) | `implementation/assets/32_mutations.log` | A hypothesis, not a finding about the helper: a row should not run two database runs under one step label at once. Nothing was left behind (0 databases with the prefix at the end) |

## 19. Deviations from the row text and the standing rules

| ID | Deviation | Why |
|---|---|---|
| DV-1 | Rule M6: the place in the denial budget is taken INSIDE the redeem's unit, not before it | Finding F-2. The purpose of the rule holds: the place is taken before the row, so refusals that arrive together write at most 20 rows (tested with 25 at once) |
| DV-2 | "Of 20 concurrent wrong redeems exactly three count and 17 answer 423": 18 answers are 423 | The 17 are the attempts that found redeeming locked (`PAIRING_LOCKED`); the third counted failure answers 423 as well (choice 1). Exactly three are counted, as the criterion asks. The same reading as accepted for AC-B-80 (D78: 401 × 4, 423 × 16) |
| DV-3 | The resolver does more than resolve: it promotes a rotated credential and records last seen | Both are the specification's (§6.3 T7 "promoted at its first use", §6.5); stage 4 is where a first use and a request are seen |
| DV-4 | The pairing unit writes two columns of `biometric_tokens`, a table of the biometric row | SR-34; choice 14. One statement; the token operations are not built |
| DV-5 | A body that validates against the contract's schema can still be 422 (choice 12) | CONTRACT-GAP-W32-2 |
| DV-6 | `implementation/99_implementation_report.md` and the tracking table of `masterplan/02_plan.md` were not written | Parallel run: shared files are the controller's (P8, D62 DN-11). This document and the progress file are the row's report |
| DV-7 | The mutation check ran through a transform in a scratch runner configuration outside the repository | Rule M15 (D88). Limit: section 13 |

## 20. Decisions for the controller

| ID | Decision asked | This row's proposal |
|---|---|---|
| DN-1 | The failure that locks redeeming answers 423 (choice 1; CONTRACT-GAP-W32-1) | Accept, as D78 DN-3 |
| DN-2 | The lock starts when the third attempt is taken; the window is fixed (choices 2, 3) | Accept, as D78 DN-1 and DN-2 |
| DN-3 | `details.attemptsRemaining` of a redeem answer is the lock's count (choice 4) | Accept; into the mobile pairing row's wording ("attempts before a 60 s lock") |
| DN-4 | A redeem's refusal takes its place in the denial budget inside its unit; beyond the budget the attempt stays counted (F-2, DV-1) | Accept |
| DN-5 | A rotated-out credential answers 401, not 403 (choice 6) | Accept |
| DN-6 | The presence counter `pairingControl(app).presence` is how the realtime row tells the registry who is online (choice 8) | Accept; into the brief of W42 |
| DN-7 | The pairing unit revokes the live biometric tokens of a retired device (choice 14, DV-4) | Accept; into the brief of W41 ("nothing to call on a revoke") |
| DN-8 | `last_seen_at` is written by the resolver, at most once a minute, also for a GET (choice 9, F-4) | Accept |
| DN-9 | The texts of a redeem and the reason of a revoke are refused when they hold the code or a credential form (choice 12, CONTRACT-GAP-W32-2) | Accept; to W83 |
| DN-10 | The stale title of the identity row's test block (F-1) | The identity row's owner or the code review W38 retitles or deletes it; this row did not touch it |
| DN-11 | The bulk fixture's detail keys of pairing rows (F-3) | To W39 and the fixture's owner; no change asked of this row |
| DN-12 | CONTRACT-GAP-W32-1 to -4 | To W83, with the texts of section 16 |
| DN-13 | The identity routes' `refuseRetiredDevice` and the guard's rule for a retired device are unchanged by this row | Nothing to decide; stated because the resolver now really answers RETIRED |

## 21. End state and cleanup

At 15:36:19 (a scratch script outside the repository, as `dems_owner`, through the test helper's
own reader of the connection file; it prints names and counts;
`implementation/assets/32_end_state.mts.txt`):

```
session: role=dems_owner server=18.4 port=4432 postmaster started 2026-10-04 07:14:26.046351+07
databases with this row's prefix (dems_test_step_54_*): 0
test databases of all rows at this moment: 0
project databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3
sessions on this row's databases still open: 0
```

- `.locks/postgres.pid`: 19121, the process started 07:14:26, as before. PostgreSQL was never
  stopped or reconfigured. Nothing connected as the bootstrap superuser.
- `dems_demo` and the lane databases were never connected to by this row: every test ran on a
  clone of the helper (`DEMS_TEST_STEP=54`). Two statements of `secrets.db.test.ts` change a
  privilege of `dems_app` for a moment, as the owner, on that file's own clone only, and grant
  it back before the clone is dropped.
- No port was bound and no process of this row is left: the background command (the first
  mutation pass) and its watcher ended by themselves. `apps/core-server/logs/` does not exist.
- `git diff --stat acaff20 -- apps/mock-core release scripts/release` prints nothing.
- No file of the tree was ever mutated (rule M15). The mutation harness and the scratch scripts
  were under the session's scratchpad, outside the repository; its link to the repository's
  `node_modules` was removed first (the link, not its target). What is evidence is kept as text
  under `implementation/assets/32_*` (8 files).
- No `npm install`, no `package.json` or lock file change, no emulator, no lane, no network
  beyond loopback.

## 22. Rollback (R-NEW; not executed)

Pre-images, saved before the first edit (file copies: `apps/core-server/` is untracked):

| Pre-image under `.cache/rollback/` | Restores |
|---|---|
| `W32.pairing.index.ts.pre` (SHA-256 `702b7a49…`) | `apps/core-server/src/modules/pairing/index.ts` (the stub of W08) |
| `W32.readiness.test.ts.pre` (SHA-256 `80ccbc14…`) | `apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts` as it was at 14:21 |

Steps, in this order:

1. Copy `W32.pairing.index.ts.pre` back over `src/modules/pairing/index.ts` and remove the twelve
   other production files and the folder `__tests__/` under `src/modules/pairing/`.
2. Put the three lines of section 15 back into `readiness.test.ts` (apply the diff of section 15
   in reverse; do not copy the pre-image over the file if another row changed it since).
3. Nothing else: no package, no schema, no contract file, no migration, no database and no host
   setting was changed by this row.

With the stub back, `app.deviceResolver` knows no device: no device can be paired or sign in, and
the rows that build on this one (W41, W42, W45, W47, W57) lose their base. Rows that imported
`src/modules/pairing/__tests__/support.ts` lose `pairDevice`.

## 23. Verification list of the row

| Clause of the row | Met | Where |
|---|---|---|
| Operations 15 to 23 | yes | Sections 3, 7 |
| The device resolver | yes | Section 6 |
| Code and credential storage per the database contract §5 | yes | Sections 4, 10 |
| A redeem is one unit of work with a consuming compare-and-set before the comparison | yes | Section 4 |
| Its refusals count against the denial budget | yes | Section 9 (SR-71) |
| A retired credential falls into the class bucket | yes | Section 9 (AC-B-75) |
| `getSignInStatus` needs no console identity | yes | Section 12.3 |
| Writes only `apps/core-server/src/modules/pairing/**` | yes, and the three lines of section 15 | Section 2 |
| Locks: own cloned databases | yes | Section 21 |
| MODG | yes | Section 12.2 |
| Rules M1 to M15 | yes; M6 with deviation DV-1 | Sections 3, 13, 19 |
