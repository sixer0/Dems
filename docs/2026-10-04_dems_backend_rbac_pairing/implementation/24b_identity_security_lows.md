---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 46b (follow-up of rows 46 / W24 and 63 / W41)
plan_row: W24, W41 (security checkpoint CP-S1, findings CPS1-6, CPS1-7, CPS1-8)
title: Identity module, three Low findings of the security checkpoint closed (a verified failure always has its row; a live token on another device is a reuse; a failure report never names a disabled operator)
date: 2026-10-04
agent: coder-execution (tier R)
source_review: gateway_check/05_cp_access_control_security.md (CPS1-6, CPS1-7, CPS1-8; section 6 rulings 2 (1) and 8)
source_spec: masterplan/01_specs.md rev 2.2 (§4.7, §5.2, §5.4, §5.6; SR-08, SR-23, SR-36, SR-37, SR-71, SR-74; ID-2 to ID-4)
evidence_tier: 2
status: complete (the three findings: 19:38; the follow-up of decision D118 step 2: 20:50)
---

# Identity module: the three Low findings CPS1-6, CPS1-7 and CPS1-8

All times are WIB (UTC+7) on 2026-10-04. Every command ran from `/Users/gsp-budi/Documents/DEMS`.
Database commands ran with the per-command sandbox bypass, against the project's embedded
PostgreSQL on `127.0.0.1:4432` only, with `DEMS_TEST_STEP=46b` and `--maxWorkers=2`. Quoted runner
output is unchanged except that the sandbox's certificate warning lines are left out and long
lines are cut.

**No token, credential, hash or password appears in this document.** The tests build made-up
values of a FORM from one repeated letter through the existing helper; the saved outputs of this
row hold no value of the form of a token (`grep -lE "(bio|ses|dvc)_[A-Za-z0-9_-]{43}"` names none
of the 32 log files of this row, and this document has none).

## 1. Result

| Finding | Ruling (review §6) | What changed | Source | Closed by test |
|---|---|---|---|---|
| **CPS1-6** A verified failed sign-in can answer 429 without an `AUTH_FAILED` row | 2 (1): the row takes precedence | A verified failure writes its row whatever the denial budget says; the answer stays the budget's 429 with `retry-after`; one derivation, one unit, the same statements as inside the budget | `src/modules/identity/sign-in.ts:170-209` | `__tests__/concurrency.db.test.ts:162, 206`; `__tests__/sequence.db.test.ts:179` |
| **CPS1-7** A live biometric token presented by another paired device is refused and stays live | 8, F-3: treat it as a reuse | `refusalOfToken` returns the reuse for a LIVE token of another device: the family is revoked and the BIOMETRIC sessions of the token's device and operator are ended through the path a used token takes. No new audit type, reason or error code | `src/modules/identity/biometric/sign-in.ts:118-139` | `biometric/__tests__/sign-in.db.test.ts:326-469`; `tokens.test.ts:101`; `sequence.db.test.ts:267` |
| **CPS1-8** A failure report can name a disabled operator | 8, F-6: one of two remedies | Remedy (1): `FIND_ENROLMENT` joins `operators` and asks `enabled` | `src/modules/identity/biometric/store.ts:291-293` | `biometric/__tests__/failure.db.test.ts:141, 189`; `static.test.ts:403` |

| Check | Result |
|---|---|
| Changed and new test files alone | `unit` 2 files, 55 tests, exit 0; `db` 6 files, 85 tests, exit 0 (19:30:47 to 19:31:05) |
| The whole identity folder | `unit` 12 files, 206 tests, exit 0; `db` 15 files, 187 tests, exit 0 (19:31:06 to 19:31:32) |
| `npm run typecheck -w @dems/core-server` | exit 0 (19:29:57, after the last edit) |
| `npm run lint -w @dems/core-server` | exit 0, no diagnostic at all (the linter prints nothing when it finds nothing) |
| Whole `unit` project, once | exit 0: 145 files, 3,748 tests (19:22:27 to 19:23:18) |
| Whole `db` project, once | exit 1: 114 of 115 files, 1,691 of 1,692 tests. The one red test is another row's and fails the same with each of the three changes reverted (section 6.4) |
| The three acceptance files the brief names | exit 0: 3 files, 99 tests (19:21:41 to 19:21:56) |
| Each new test fails without its change | Yes, by 8 load-time mutations outside the repository: 8 of 8 detected (section 6.6) |
| By-design changes in other rows' tests | None (section 8) |
| Contract | One text gap, `CONTRACT-GAP-W41-5` (a description, not a value; section 9) |
| End state | 0 databases with the prefix `dems_test_step_46b_`, 0 sessions on them, no listener of this row (section 6.7) |

## 2. What was read first

| Source | What it gave |
|---|---|
| `gateway_check/05_cp_access_control_security.md:405-425, 458, 467-471` | The three findings with their evidence and remedies; rulings 2 (1), 8 |
| `implementation/24_identity_core.md` (F-3, the sequence of a sign-in, test D3) | The two units of a sign-in; why the verified failures of a burst ask for a place last |
| `implementation/41_biometric_token.md` (§3.3, §4, §5.2, §6, F-3, F-6, DN-1 to DN-4, DN-9) | The token's life, the reuse path, the one exception to the budget, `CONTRACT-GAP-W41-1` to `-4` |
| `gateway_check/01_gate_report.md` rules M1 to M16 | The write paths, M6, M10, M14, M15, M16 |
| `masterplan/01_specs.md` SR-08, SR-23, SR-36, SR-37, SR-71, SR-74, ID-2 to ID-4, §5.4, §5.6 | The rules the findings cite |
| `delegation_progress/coder_execution_step_48.md` | It names no file under `src/modules/identity/**`; no file of that folder was newer than 18:00 before the first edit (checked 19:03) |

## 3. A. CPS1-6: a verified failed sign-in always writes its `AUTH_FAILED` row

### 3.1 What was found

A sign-in is two units with the Argon2id derivation between them. A burst of sign-ins of one
throttle key passes stage 5 together while the key's denial budget is still empty. The lockout
hands out five attempts; every other request finds the console locked and asks for its place in
the budget at once, without a derivation to wait for. Twenty of them take the key's twenty places.
The five verified failures ask last and find none. Before the change the code then counted the
failure and threw the 429 **without a row** (`sign-in.ts:159-167` of the pre-image):

```ts
    try {
      await app.denialBudget.consume(request);
    } catch (error) {
      // No place left in the denial budget of the caller's key: 429, and no row (SR-71). The
      // failure itself still counts toward the lock.
      await app.pipeline.run('identity.signIn.unaudited', () => lockout.fail(lockoutKey, ticket, app.clock.now()));
      throw error;
    }
```

The caller learns from the 429 that the password was wrong (a right one answers 200), so five
guesses per lock cycle had a known result and no row. Why it matters: SR-23 asks for one row per
attempt that reaches the handler, and the trail is what an investigator reads afterwards.

### 3.2 The change

`apps/core-server/src/modules/identity/sign-in.ts`, after (lines 170-209; the header comment at
29-43 says the same in words):

```ts
  /** One place in the denial budget for one refusal row. Null: taken. Otherwise the 429 to answer after the unit. */
  const placeInBudget = async (): Promise<unknown> => {
    try {
      await app.denialBudget.consume(request);
      return null;
    } catch (refused) {
      return refused;
    }
  };

  async function refuseFailed(ticket: AttemptTicket, operatorId: string | null): Promise<never> {
    const limited = await placeInBudget();
    const failure = await app.pipeline.run('identity.signIn.failed', async (unit) => {
      const counted = await lockout.fail(lockoutKey, ticket, app.clock.now());
      const disabled = (await readOperatorEnabled(unit, operatorId ?? NO_OPERATOR)) === false;
      await appendActivity(unit, attemptFailed({ … }));
      return counted;
    });
    if (limited !== null) throw limited;
    throw failure.lockedUntil === null ? invalidCredentials(failure.attemptsRemaining) : consoleLocked(failure.lockedUntil, failure.retryInMs);
  }
```

The unit `identity.signIn.failed` now runs in both cases; the unit label
`identity.signIn.unaudited` no longer exists. An attempt during the lock (`refuseLocked`,
lines 158-168) is unchanged: nothing was verified, the caller learns nothing, and with no place
left it answers 429 and writes no row.

### 3.3 Why this remedy

| Option of the review | Verdict | Reason |
|---|---|---|
| **The row is written whatever the budget says** | Taken (ruling 2 (1)) | It is what the biometric sign-in already does for a refusal that changed what is stored (`biometric/sign-in.ts:276`), so the module has one rule: the budget decides the ANSWER, never whether a verified or state-changing refusal is recorded. The cost is bounded (3.5) |
| Reserve the place before the derivation; a success gives it back | Not taken | The budget's seam has no "give back" (`plugins/throttle` is another row's file), and a place held during a derivation lets five slow requests starve the 20 places |
| Accept | Not taken | The ruling |

### 3.4 What does not change

| Property | Evidence |
|---|---|
| The answer to the caller | 429 `RATE_LIMITED` with `retry-after`, the body and the header equal to those of every other 429 of the burst (`concurrency.db.test.ts:259-263`: one distinct body and one distinct `retry-after` over the five verified and the five unverified 429) |
| One derivation per verified attempt; comparable time (SR-08, ruling 2 (3)) | The recorded timeline of a failure beyond the budget equals the timeline of one inside it, step for step (`sequence.db.test.ts:179`, quoted in 6.2) |
| The lockout | The failure is counted in the same call (`lockout.fail`) as before; five derivations for 30 requests; the console is locked; 60 s later the right password signs in |
| The budget's count | The five rows take no place: `inspect('class:web')` says `used: 20` before and after them |
| An unknown username | The row names nobody (`knownOperator: false`), as inside the budget; the typed username is in no row |

### 3.5 The bound: how many rows a caller can cause per window

Only an attempt that passed stage 5 BEFORE the key held its 20 refusals can reach this code: once
the budget is full, stage 5 answers every request of the key with 429 and nothing is decided. Of
those attempts only the ones that hold a lockout ticket are verified, and the lockout hands out at
most five per lock cycle of a console.

| Caller | Rows per throttle key and window of 60 s | Status |
|---|---|---|
| Cannot sign in on that console | At most **25**: 20 inside the budget, 5 `AUTH_FAILED` beyond it. The lock lasts 60 s from the fifth taken attempt, as long as the window, so a second lock cycle cannot have attempts under way when the same window fills | **Asserted**: `concurrency.db.test.ts:206` (25 rows for 30 requests at once; 13 further requests of the window: 429, 0 rows, 0 derivations) |
| Can sign in (holds a valid password) | A success clears the lock (review finding CPS1-10, accepted as Info), so further lock cycles can begin. Every row beyond the 25 is one more wrong password that was really derived. What caps them is the request throttle of the key: 30 requests per window for a signed-out console and for a device's sign-in, 600 for an operator's key (a sign-in that presents a valid session) | **Reasoned from `throttle/limits.ts:18-25, 86-92`, not tested.** Decision DN-4 |

### 3.6 Tests (all in `src/modules/identity/__tests__/`)

| Test | What it shows |
|---|---|
| `concurrency.db.test.ts:206` "30 at once …" (new) | The case of the finding, independent of timing: the five derivations are HELD until the other 25 requests are answered (20 × 423 with 20 `AUTH_LOCKED` rows, 5 × 429 without a row; the budget says `used: 20, remaining: 0`). Then the five verified failures: each answers 429, each writes exactly one `AUTH_FAILED` row (4, 3, 2, 1, 0 attempts left; the fifth carries `lockedUntil`) and one event; the budget still says 20; no session. The bound 25 is asserted, then 13 more requests of the window write nothing |
| `concurrency.db.test.ts:162` "SR-71: of 25 at once …" (rewritten in place; it pinned "the others answer 429 and write none") | Without the gate, whatever the order: five 429; five derivations; five `AUTH_FAILED` rows; the rows beyond the 20 places are between 0 and 5 and are verified failures only. The run printed `5 rows beyond the 20 places` |
| `sequence.db.test.ts:179` (new) | The seam says "no place" for one call; the attempt does the work of every verified failure, step for step, row included; the answer is 429 with the seam's `retry-after`; the console counted it |

## 4. B. CPS1-7: a live token presented by another paired device is a reuse

### 4.1 What was found

`biometric/sign-in.ts:111` of the pre-image:

```ts
  if (found.deviceId !== deviceId) return { operatorId, reason: TokenRefusalReason.OTHER_DEVICE, reused: null };
```

A token is issued to one device and never sent to another. A second paired device that presents
the live token of the first shows that the token has left its device, and the refusal left it
live: usable by whoever also holds that device's credential.

### 4.2 The change

`apps/core-server/src/modules/identity/biometric/sign-in.ts:118-139`, after:

```ts
export function refusalOfToken(found: TokenState | null, deviceId: string, now: number): TokenRefusal {
  if (found === null) return { operatorId: null, reason: null, reused: null };
  const { operatorId } = found;
  const reuse: TokenRefusal = {
    operatorId,
    reason: TokenRefusalReason.TOKEN_REUSE,
    reused: { familyId: found.familyId, deviceId: found.deviceId, operatorId },
  };
  if (found.usedAt !== null) return reuse;
  if (found.deviceId !== deviceId) {
    // Live, and presented by a device it was never issued to: it has left its device (CPS1-7).
    const live = found.revokedAt === null && found.expiresAt > now;
    return live ? reuse : { operatorId, reason: TokenRefusalReason.OTHER_DEVICE, reused: null };
  }
  …
```

Nothing else of the unit changed. The existing reuse path at lines 258-270 does the rest, in the
one unit of the sign-in: `REVOKE_TOKENS.FAMILY` with the reason `TOKEN_REUSE`,
`END_BIOMETRIC_SESSIONS` for the TOKEN's device and operator (end reason `TOKEN_REUSE`),
`session.ended` with `TOKEN_REUSE` after the commit, the failure counted on the PRESENTING device,
the `AUTH_FAILED` row. Comments only: the file header (lines 24-40, 48-53), `activity.ts:35-38, 46`.

| Token of another device | Before | After |
|---|---|---|
| LIVE (not used, not revoked, not past its time) | 401; row `reason: OTHER_DEVICE`; nothing changed; still good on its own device | 401, the same body; the family revoked (`TOKEN_REUSE`); the open BIOMETRIC sessions of the token's device and operator ended (`TOKEN_REUSE`) and told so; row `reason: TOKEN_REUSE`, `sessionsEnded`; dead on its own device too |
| USED | A reuse (decision DN-2 of the biometric row) | Unchanged |
| REVOKED or EXPIRED, not used | 401; `OTHER_DEVICE`; nothing changed | Unchanged: it is dead already, nothing is left to revoke or end |

### 4.3 The vocabulary: nothing new

| Where a reason is stored or sent | Value used | Set it belongs to |
|---|---|---|
| `biometric_tokens.revoke_reason` | `TOKEN_REUSE` | `BIO_REVOKE_REASON` (`db/schema/value-sets.ts:106-113`) |
| `auth_sessions.end_reason` | `TOKEN_REUSE` | `SESSION_END_REASON` (`value-sets.ts:94-103`) |
| `session.ended.reason` | `TOKEN_REUSE` | `SessionEndedReason` (`packages/shared/src/api/realtime-messages.ts:141-148`) |
| Audit type; `details.reason`; `details.sessionsEnded` | `AUTH_FAILED`; `TOKEN_REUSE`; the count | The row of the reuse path (spec §5.4: a session ended with `TOKEN_REUSE` has its `AUTH_FAILED` row with that reason) |
| Error code of the answer | `INVALID_CREDENTIALS` (401), or `LOCKED` / `RATE_LIMITED` as for any refusal | Unchanged |

The closed set `TokenRefusalReason` keeps its six codes; `OTHER_DEVICE` now means a DEAD token of
another device. No contract value was missing, so no part was stopped. The contract's WORDS for
`TOKEN_REUSE` speak of a used token only: `CONTRACT-GAP-W41-5` (section 9).

### 4.4 Why it is no lever for anybody else

| Question | Answer |
|---|---|
| Who can cause it | A caller that holds a paired device's credential AND the value of the live token: 256 random bits, compared as a SHA-256 on a unique index. No request names a token in any other way. Tested: four values that are no token of A (a made-up one, the token with one character changed, in another letter case, with a space before it) end nothing on A (`sign-in.db.test.ts:455`) |
| What the presenter learns | Nothing new. The answer is the generic 401, equal to the answer for a value that is no token (`sign-in.db.test.ts:368`). The unit runs two statements more than for an unknown value, which tells the presenter that the value was a token; by then the token is dead |
| What it costs the owner | The operator on device A is signed out of the BIOMETRIC session and enrols again in a password session (tested at the end of `sign-in.db.test.ts:411`). It is what `session.ended` with `TOKEN_REUSE` already means to the app (AC-C-108) |
| The denial budget | The row of this change is written whatever the budget says, through the existing rule `refused.changed` (`sign-in.ts:276`); a family is revoked once, so it is one row per family; the answer is then the budget's 429 (`sign-in.db.test.ts:436`) |

### 4.5 Tests (all in `src/modules/identity/biometric/__tests__/`)

| Test | What it shows |
|---|---|
| `sign-in.db.test.ts:338` (new) | The brief's case. Device B presents device A's live token: the generic 401; A's family revoked whole at that instant (`USED+REVOKED(TOKEN_REUSE)`, `REVOKED(TOKEN_REUSE)`); A's BIOMETRIC session ended with `TOKEN_REUSE`, `session.ended` published once with that session and that reason, its token answers 401; the only session ended at that instant is that one. Untouched: A's PASSWORD session, another operator's BIOMETRIC session and family on A, B's password and BIOMETRIC sessions and B's token rows (compared row for row), the web session. ONE row: actor = the token's operator, device = the presenting device, `reason: TOKEN_REUSE`, `sessionsEnded: 1`. Counted on B (4 left), not on A (5). The token then fails on A too (`TOKEN_REVOKED`, no session). B's own token and the other operator's token still sign in |
| `sign-in.db.test.ts:411` (new) | A live token that was never used: revoked, `sessionsEnded: 0`, nothing published, the password session stays; dead on its own device; presented by B again it is `OTHER_DEVICE` and changes nothing; a new enrolment signs in |
| `sign-in.db.test.ts:436` (new) | No place in the budget: 429 with the seam's `retry-after`, the row written, the session ended, the family revoked |
| `sign-in.db.test.ts:455` (new) | Only a holder of the value can cause it |
| `sign-in.db.test.ts:519` (rewritten; it pinned "still good on its own device") | A token of another device that is no longer live (turned off; past its 30 days): `OTHER_DEVICE`, the token row unchanged, no session ended, nothing published |
| `tokens.test.ts:101` (new), `:110` (rewritten) | `refusalOfToken` as a table: live on another device is the reuse with the TOKEN's family, device and operator; every revoke reason and both sides of the expiry limit on another device stay `OTHER_DEVICE` |
| `sequence.db.test.ts:267` (new), `:238` (the other-device entry is now a dead token) | The statements of a live token of another device equal those of a used token on its own device, step for step and in round trips (12), in the one unit |
| `secrets.db.test.ts:129, 136, 193, 202` (expectations) | The journey of the secret scan: the live token of another device is now a second `TOKEN_REUSE`; one more presentation (a dead token of another device) keeps a row with `OTHER_DEVICE` under the scan. `AUTH_FAILED` 11 to 12 |

## 5. C. CPS1-8: a failure report never names a disabled operator

### 5.1 What was found

`biometric/store.ts:283` of the pre-image:

```ts
export const FIND_ENROLMENT = 'SELECT 1 AS found FROM public.biometric_tokens WHERE device_id = $1 AND operator_id = $2 AND revoked_at IS NULL LIMIT 1';
```

A disable revokes the operator's LIVE tokens only (`REVOKE_TOKENS.OPERATOR`, `store.ts:183`:
`used_at IS NULL AND revoked_at IS NULL`). The used rows of a family stay unrevoked: they are the
history the reuse rule reads. Such a row kept counting as an enrolment, so a report from that
device named an operator who was disabled (`failure.ts:84, 88`).

### 5.2 The change

`apps/core-server/src/modules/identity/biometric/store.ts:291-293`, after:

```ts
export const FIND_ENROLMENT =
  'SELECT 1 AS found FROM public.biometric_tokens t JOIN public.operators o ON o.id = t.operator_id ' +
  'WHERE t.device_id = $1 AND t.operator_id = $2 AND t.revoked_at IS NULL AND o.enabled LIMIT 1';
```

One row statement, a `SELECT` (rule M16); both tables named with their schema; no literal; the
tables it names were already named by this store (`ENROL_TOKEN` joins `operators`). `failure.ts`
is unchanged in code (comments at 11-14 and 83); the same statement runs for an enrolled operator,
one who is not, one that does not exist and none, and the unit still makes 9 round trips.

### 5.3 Why remedy (1) and not remedy (2)

| | (1) `FIND_ENROLMENT` asks `operators.enabled` — taken | (2) The scopes OPERATOR and DEVICE revoke used rows too |
|---|---|---|
| Where the rule lives | In the one statement that decides whether a row may name the operator | In two statements that other modules call, far from the decision |
| Holds for | Every way an operator can be disabled, and the rows a disable left behind before the change (tested: the flag alone, set as the owner, with a LIVE token: nobody is named) | Disables that ran through `revokeBiometricTokens` after the change only |
| Blast radius | One read statement of this folder; one caller (`failure.ts`) | The units of the administration and pairing modules write more rows; `src/modules/admin/__tests__/status.db.test.ts:176` pins a used row left unrevoked by a disable (another row's test), and this folder's `revocation.db.test.ts:137-155, 183-217` and `static.test.ts:363-369` pin "live tokens only"; the database contract writes AT-C5 so |
| Reuse detection | Untouched | Still works (it looks at `used_at` first), but a reuse after a disable would find nothing to revoke |

### 5.4 Tests (all in `src/modules/identity/biometric/__tests__/`)

| Test | What it shows |
|---|---|
| `failure.db.test.ts:141` (rewritten; it pinned that the disabled operator IS named) | The brief's sequence. Control, no disable: enrol, use the token once, report: the operator is named. Second operator: the same, named before the disable. After the disable through the administration module the pair's rows are `[used, not revoked]` and `[not used, USER_DISABLED]`, and the report names nobody: actor null, `knownOperator: false`. The answer is the device's lock state, byte for byte the body of the report that named an operator. While the device is locked the `AUTH_LOCKED` row follows the same rule. The operator who was not disabled is named all along. Enabled again, the operator is named again ("live or last used", finding F-5) |
| `failure.db.test.ts:189` (new) | The rule is the lookup's own: the flag off with nothing revoked and the token LIVE names nobody |
| `static.test.ts:403` (the pinned text) | The statement, text for text |

## 6. Verification

### 6.1 Changed and new test files alone (after the last edit)

```
$ npm run test -w @dems/core-server -- --maxWorkers=2 src/modules/identity/biometric/__tests__/tokens.test.ts src/modules/identity/biometric/__tests__/static.test.ts
 Test Files  2 passed (2)
      Tests  55 passed (55)
   Start at  19:30:48
   Duration  2.33s (transform 57%, import 41%, tests 1%)
unit (changed files) exit=0

$ DEMS_TEST_STEP=46b npm run test:db -w @dems/core-server -- --maxWorkers=2 src/modules/identity/__tests__/concurrency.db.test.ts src/modules/identity/__tests__/sequence.db.test.ts src/modules/identity/biometric/__tests__/sign-in.db.test.ts src/modules/identity/biometric/__tests__/sequence.db.test.ts src/modules/identity/biometric/__tests__/failure.db.test.ts src/modules/identity/biometric/__tests__/secrets.db.test.ts
 Test Files  6 passed (6)
      Tests  85 passed (85)
   Start at  19:30:51
   Duration  14.31s (tests 52%, import 27%, transform 20%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 2 database(s) in 117 ms; 0 remain with the run prefix dems_test_step_46b_tmdurfn4_
db (changed files) exit=0
```

The whole folder `src/modules/identity`, the same two commands with the folder as the filter
(19:31:06 to 19:31:32):

```
 Test Files  12 passed (12)
      Tests  206 passed (206)
unit (identity folder) exit=0

 Test Files  15 passed (15)
      Tests  187 passed (187)
[test:db] teardown: dropped 2 database(s) in 131 ms; 0 remain with the run prefix dems_test_step_46b_tmdurzpn_
db (identity folder) exit=0
```

### 6.2 What the tests printed (run of 19:18:41 and 19:18:56, `--silent=false --reporter=verbose`)

```
[w24b] SR-71, 25 at once: statuses {"423":20,"429":5}; 5 AUTH_FAILED, 20 AUTH_LOCKED; 5 rows beyond the 20 places
[w24b] CPS1-6: 30 wrong sign-ins at once: statuses {"423":20,"429":10}; 5 derivations; rows 25 = 20 AUTH_LOCKED inside the budget + 5 AUTH_FAILED beyond it; 13 later requests of the window: 429, no row

[w24] signIn, failure (known and unknown username alike):     [w24b] signIn, a verified failure beyond the denial budget (answered 429):
  lockout.take web                                               lockout.take web
  pool  FIND_SIGN_IN_CANDIDATE                                   pool  FIND_SIGN_IN_CANDIDATE
  Argon2id derivation                                            Argon2id derivation
  denialBudget.consume                                           denialBudget.consume
  lockout.fail web                                               lockout.fail web
  unit  BEGIN ISOLATION LEVEL READ COMMITTED                     unit  BEGIN ISOLATION LEVEL READ COMMITTED
  unit  chain lock                                               unit  chain lock
  unit  statement timeout                                        unit  statement timeout
  unit  READ_OPERATOR_ENABLED                                    unit  READ_OPERATOR_ENABLED
  unit  INSERT audit_log AUTH_FAILED                             unit  INSERT audit_log AUTH_FAILED
  unit  event number                                             unit  event number
  unit  INSERT events AUTH_FAILED                                unit  INSERT events AUTH_FAILED
  unit  COMMIT                                                   unit  COMMIT

[w41] signInWithBiometric, a live token of another device (12 round trips):
  pool  FIND_DEVICE_BY_CREDENTIAL
  lockout.take
  unit  BEGIN
  unit  CLAIM_TOKEN
  unit  READ_TOKEN_STATE
  unit  REVOKE_TOKENS.FAMILY
  unit  END_BIOMETRIC_SESSIONS
  lockout.fail
  denialBudget.consume
  unit  INSERT audit_log AUTH_FAILED
  unit  event number
  unit  INSERT events AUTH_FAILED
  unit  COMMIT

[w41] reportBiometricFailure (9 round trips):
  pool  FIND_DEVICE_BY_CREDENTIAL
  lockout.take
  lockout.fail
  unit  BEGIN
  unit  FIND_ENROLMENT
  denialBudget.consume
  unit  INSERT audit_log AUTH_FAILED
  unit  event number
  unit  INSERT events AUTH_FAILED
  unit  COMMIT

[w41] secret scan journey: rows {"AUTH_FAILED":12,"AUTH_LOCKED":2,"AUTH_SUCCESS":4,"BIOMETRIC_ENROLLMENT_CHANGED":7}; 10 biometric tokens issued, …
```

(The two sign-in timelines are printed one after the other by the run; they are set side by side
here. The test asserts their equality.)

### 6.3 Typecheck and lint (19:29:57 and 19:30:16, after the last edit)

```
$ npm run typecheck -w @dems/core-server
> @dems/core-server@0.2.0 typecheck
> tsc --noEmit
typecheck exit=0

$ npm run lint -w @dems/core-server
> @dems/core-server@0.2.0 lint
> oxlint
lint exit=0
```

`oxlint` prints nothing when it has no diagnostic (the same shape as `test/assets/05_lint.log` of
an earlier row); `npm exec -w @dems/core-server -- oxlint src/modules/identity` also exits 0
with no output. No warning in the folder, and none in the workspace.

### 6.4 The two whole projects, once each

Load before each: 1-minute average 6.66 (19:22) and 8.85 (19:23), under the limit of 10.

```
$ npm run test -w @dems/core-server -- --maxWorkers=2                     (19:22:27 to 19:23:18)
 Test Files  145 passed (145)
      Tests  3748 passed (3748)
   Duration  50.30s (import 57%, tests 38%, transform 4%)
unit exit=0

$ DEMS_TEST_STEP=46b npm run test:db -w @dems/core-server -- --maxWorkers=2    (19:23:24 to 19:25:38)
 FAIL  |db| src/modules/demo/__tests__/reset-failures.db.test.ts > finding F-5: an AUDIT_TAMPER fault across a reload of the engine that is no process start > RUN through a failed reset: the stored chain is intact and the server is usable; …
AssertionError: expected [ …(87) ] to have a length of 86 but got 87
 ❯ src/modules/demo/__tests__/reset-failures.db.test.ts:391:23
 Test Files  1 failed | 114 passed (115)
      Tests  1 failed | 1691 passed (1692)
   Start at  19:23:25
   Duration  132.58s (tests 81%, import 17%, transform 1%)
[test:db] teardown: dropped 8 database(s) in 365 ms; 0 remain with the run prefix dems_test_step_46b_tmduf16s_
db exit=1
```

**The one red test, outside `src/modules/identity/**`:**

| Item | Fact |
|---|---|
| File and line | `apps/core-server/src/modules/demo/__tests__/reset-failures.db.test.ts:391` (`expect(storedNow).toHaveLength(stored.length + 1)`: one audit row more than the test expects after a failed reset with `AUDIT_TAMPER` active) |
| Time | 19:23 to 19:25 in the whole run |
| Alone, once | 19:25:54 to 19:26:03: `Tests  1 failed \| 13 passed (14)`, the same assertion, exit 1 |
| Does it depend on this row | No. Run of 19:26:26 to 19:27:01: the same file through the scratch configuration with each of the three changes reverted in memory (MA1, MB1, MC1 of section 6.6): three times `expected [ …(87) ] to have a length of 86 but got 87` |
| Whose row | The test file is the demo module's (plan row W43); it was last written at 18:54:17 together with `src/engine/rehydrate.ts`. Sources of the engine were written after that by the engine and clock fix round that runs in parallel (`src/engine/write-plan.ts`, `limits.ts` at 19:04:54; `host.ts`, `types.ts` at 19:12:57). **Hypothesis, from the file times and the test's subject (the engine's resync): that round's in-flight work.** Not edited, not investigated further |

The two whole runs were made BEFORE the last edit of 19:29:37 (a test's title and its comment in
`__tests__/concurrency.db.test.ts`; no source, no assertion). After that edit the file ran in
6.1 and under the two mutations MA1 and MA2 again; no second whole run was made (rule M15).

### 6.5 The three acceptance files the brief names (19:21:41 to 19:21:56)

```
$ DEMS_TEST_STEP=46b npm run test:db -w @dems/core-server -- --maxWorkers=2 test/acceptance/pairing-lifecycle.test.ts test/acceptance/rbac-matrix.test.ts test/acceptance/contract.test.ts
 Test Files  3 passed (3)
      Tests  99 passed (99)
   Duration  14.94s (tests 84%, transform 10%, import 7%)
[test:db] teardown: dropped 3 database(s) in 167 ms; 0 remain with the run prefix dems_test_step_46b_tmduc508_
db exit=0
```

Why they stay true: `pairing-lifecycle.test.ts:1144` presents the OLD biometric token of a revoked
device from the re-paired one. That token was revoked with its device, so it is a dead token of
another device: `OTHER_DEVICE`, nothing changed, the row `['AUTH_FAILED', INVESTIGATOR, new
device]` as before. `rbac-matrix.test.ts:299-301` holds the server's budget count against its own
count of budget rows; it sends one request at a time and moves to the next window before a key
is full, so no verified failure is beyond the budget there. `contract.test.ts:500-507, 1037`
presents the tablet's own token, made-up tokens, and a report for an enabled operator.

### 6.6 Each new test fails without its change (rule M15: no file of the tree was modified)

A scratch runner configuration outside the repository adds ONE load-time transform of ONE source
file to the workspace's own Vitest configuration (the pattern of
`test/assets/02_mutation_harness.vitest.config.mjs.txt`; the three scratch files are in the
appendix). Baseline through it, no mutation (19:20:03): `Test Files  8 passed (8)`,
`Tests  140 passed (140)`, exit 0.

| ID | Finding | File | The change that was reverted or bent | Exit | Tests that failed (first assertion) |
|---|---|---|---|---|---|
| MA1 | CPS1-6 | `sign-in.ts` | **The behaviour before the change**: no place, no row | 1 | 3 of 19: "30 at once …" (`expected [] to deeply equal [ [ 'AUTH_FAILED', …`), "SR-71: of 25 at once …" (`expected [] to have a length of 5`), "a verified failure that finds no place …" (5 steps instead of 13) |
| MA2 | CPS1-6 | `sign-in.ts` | The row is written but the answer is no longer the budget's 429 | 1 | The same 3 (`expected [ 401, 'INVALID_CREDENTIALS' ] to deeply equal [ 429, 'RATE_LIMITED' ]`) |
| MB1 | CPS1-7 | `biometric/sign-in.ts` | **The behaviour before the change**: a live token of another device is a plain `OTHER_DEVICE` | 1 | 6 of 72: "B presents A's live token …", "a live token that was never used …", "with no place left …", `tokens.test.ts` "a LIVE token that another device presents …", `sequence.db.test.ts` "a LIVE token of another device …", `secrets.db.test.ts` (the reasons) |
| MB2 | CPS1-7 | `biometric/sign-in.ts` | "Live" forgets the revocation | 1 | 4 of 60: the dead-token tests of `tokens.test.ts`, `sign-in.db.test.ts`, `sequence.db.test.ts`, and "a live token that was never used …" (its second presentation) |
| MB3 | CPS1-7 | `biometric/sign-in.ts` | "Live" forgets the expiry | 1 | 2 of 47: the dead-token tests of `tokens.test.ts` and `sign-in.db.test.ts` |
| MB4 | CPS1-7 | `biometric/sign-in.ts` | The sessions of the PRESENTING device are ended instead of the token's | 1 | 3 of 27: "B presents A's live token …", "with no place left …", and the existing "a used token presented by ANOTHER paired device …" |
| MC1 | CPS1-8 | `biometric/store.ts` | **The behaviour before the change**: the lookup does not ask `enabled` | 1 | 3 of 49: "a report never names a DISABLED operator …", "the rule is the lookup's own …", `static.test.ts` (the text) |
| MC2 | CPS1-8 | `biometric/store.ts` | The lookup forgets the device | 1 | 2 of 49: the existing "the enrolment is the DEVICE's …", `static.test.ts` |

8 of 8 detected. Every run ended with `0 remain with the run prefix dems_test_step_46b_…`. MA1
and MA2 were run twice (19:20:12 and 19:30:16, the second time after the last edit), with the same
result.

### 6.7 End state (19:31:39, after the last run of this row, which ended 19:31:32)

```
session: role=dems_owner database=postgres server=18.4 port=4432 postmaster started 2026-10-04 07:14:26.046351+07
databases with this row's prefix (dems_test_step_46b_*): 0
test databases of all rows at this moment: 10
project databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3
sessions on this row's databases still open: 0
## .locks/postgres.pid: 19121
## listeners on loopback held by node or postgres processes (lsof -nP -iTCP -sTCP:LISTEN):
postgres 19121 127.0.0.1:4432
## processes of this row's harness still alive (pgrep -f 'w24b'): 0
```

Read with a scratch script outside the repository that connects as `dems_owner` to the
maintenance database `postgres` through the test helper's own reader of the connection file, only
SELECTs from the catalog and prints names and counts. This row started no server and bound no
port of its own; the acceptance files bind and release theirs inside the run. No database was
created or dropped by hand. Nothing on port 5432 was touched.

## 7. Test ledger (`@dems/core-server`; no other workspace was written)

| Project | File (`apps/core-server/src/modules/identity/`) | Tests before | After | Change |
|---|---|--:|--:|---|
| `db` | `__tests__/concurrency.db.test.ts` | 8 | 9 | 1 new, 1 rewritten in place |
| `db` | `__tests__/sequence.db.test.ts` | 9 | 10 | 1 new |
| `db` | `biometric/__tests__/sign-in.db.test.ts` | 23 | 27 | 4 new, 1 rewritten in place |
| `db` | `biometric/__tests__/sequence.db.test.ts` | 12 | 13 | 1 new, 1 edited |
| `db` | `biometric/__tests__/failure.db.test.ts` | 13 | 14 | 1 new, 1 rewritten in place |
| `db` | `biometric/__tests__/secrets.db.test.ts` | 12 | 12 | expectations, one more presentation |
| `unit` | `biometric/__tests__/tokens.test.ts` | 19 | 20 | 1 new, 1 rewritten in place |
| `unit` | `biometric/__tests__/static.test.ts` | 35 | 35 | the pinned statement text |

`db` +8 tests, `unit` +1 test. The folder: `unit` 12 files and 206 tests, `db` 15 files and 187
tests. The "after" numbers are counted from the verbose runs (19 + 66 = 85 in `db`, 55 in `unit`,
as in 6.1); the "before" numbers are those less the new tests: the files were not run before the
first edit.

## 8. By-design changes needed in other rows' tests

**None.** No test outside `src/modules/identity/**` pins "no row" for a verified failure beyond
the budget, `OTHER_DEVICE` for a live token, or a disabled operator named by a report:

| Searched (`apps/core-server/src`, `apps/core-server/test`) | Hits outside the folder | Affected |
|---|---|---|
| `OTHER_DEVICE` | `src/db/fixtures/__tests__/audit-details.test.ts:416, 421` (the closed set of six codes and their order: unchanged); `src/modules/admin/__tests__/status.db.test.ts` (a device ID constant of that name) | No |
| `unaudited` (the unit label that is gone) | None about the sign-in | No |
| `FIND_ENROLMENT`, `hasEnrolment` | None outside the folder | No |
| A live token of one device presented on another | `test/acceptance/pairing-lifecycle.test.ts:1144`: a REVOKED token (section 6.5) | No |
| A sign-in burst above the budget | None outside the folder | No |

The tests of THIS folder that pinned the old behaviour, and were changed by design, are named in
3.6, 4.5 and 5.4: `__tests__/concurrency.db.test.ts:162`; `biometric/__tests__/sign-in.db.test.ts:519`;
`biometric/__tests__/tokens.test.ts:110`; `biometric/__tests__/sequence.db.test.ts:238`;
`biometric/__tests__/failure.db.test.ts:141`; `biometric/__tests__/static.test.ts:403`;
`biometric/__tests__/secrets.db.test.ts:193, 202`.

## 9. Texts that are no longer true (documents and the contract; nothing here was edited)

For the contract close-out row and the document close-out row. All are words, none is a value.

**`CONTRACT-GAP-W41-5`** (continues `CONTRACT-GAP-W41-1` to `-4` of `implementation/41_biometric_token.md` §16):

| File and line | Text now | Text needed |
|---|---|---|
| `packages/shared/src/api/realtime-messages.ts:136-138` | "`TOKEN_REUSE`: a used biometric token of the session's device and operator was presented again, which ends the open sessions that were created by biometric sign-in (SD-10)" | "… was presented again, **or a live one was presented by another paired device (CPS1-7)**, which ends …" |
| `packages/shared/src/api/realtime-examples.ts:178` | "A used biometric token was presented again: biometric sessions of this device and operator end" | "A used biometric token was presented again, or a live one by another device: …" |

It blocks nothing: the value `TOKEN_REUSE` is the fitting one and is in all three closed sets (4.3).
`CONTRACT-GAP-W41-4` (the six `details.reason` codes exist only in the server) stands; its
description of `OTHER_DEVICE` should read "a token of another device that is no longer live".

| Document and line | What it says | What is true now |
|---|---|---|
| `masterplan/01_specs.md:1595` (SR-23), `:1699` (SR-71) | An attempt that the denial budget answers with 429 writes no row | A VERIFIED failed sign-in writes its `AUTH_FAILED` row beyond the budget too and answers 429 (as the biometric exception accepted by ruling 8, DN-3) |
| `masterplan/01_specs.md:602, 604` (§5.6 steps 4, 6), `:504` (§4.7), `:581` (§5.4), `:1613` (SR-36), `:1702` (SR-74) | A reuse is a token "that was already used" | Also a live token presented by another paired device |
| `masterplan/01_specs.md:605` (§5.6 step 7), `:1614` (SR-37) | The row names the operator when a token of that device and operator exists (live or last used) | … and the operator is enabled |
| `masterplan/03_database_contract.md:711` (§4.10), `:1329` (§5.2), AT-C4 at `:1448` | "No row and `used_at` set: reuse" | Also: no row, `used_at` null, another device, not revoked and not expired |
| `implementation/24_identity_core.md:210, 560, 812, 865` (F-3) | Five 429 without a row | Five 429, each with its `AUTH_FAILED` row |
| `implementation/41_biometric_token.md:222` (§3.3), `:241-249` (§4), `:310` (§5.2), `:365` (§6), `:758` (F-3), `:761` (F-6), `:792` (DN-9) | `FIND_ENROLMENT` without the join; a live token of another device "is unchanged and still good on its own device"; F-3 and F-6 open | Sections 4 and 5 of this document |
| `gateway_check/05_cp_access_control_security.md:179, 192, 193, 256, 335` | SR-23 partly met; CPS1-6 to CPS1-8 open | Closed by this row |

## 10. Findings and decisions for the controller

### 10.1 Findings

| ID | Finding | Evidence | Meaning |
|---|---|---|---|
| F-1 | **The bound of five rows beyond the budget holds for a caller who cannot sign in.** A caller who holds a valid password can open a new lock cycle with each success (CPS1-10, Info), so more verified failures can be under way when the budget fills; the request throttle of the key caps them (30 a window for a signed-out console and a device, 600 for an operator's key) | Asserted for the first case (`concurrency.db.test.ts:206`); the second is reasoning from `lockout.ts:167-170` and `throttle/limits.ts`, **not tested** | Every such row is a wrong password that was really derived: the row SR-23 asks for. Decision DN-4 |
| F-2 | An attempt during the lock that finds the budget full still writes no row | `sign-in.ts:158-168`, unchanged; the 5 × 429 without a row of the gated test | Inside the ruling: nothing was verified and the caller learns nothing. SR-23 is met for every VERIFIED attempt |
| F-3 | **The row of a live token presented by another device names the token's operator and the PRESENTING device**, exactly as the row of a used token presented by another device does (decision DN-2 of the biometric row). The token's device is not on the audit row; it is on the session row that ended and on the token rows that were revoked at the same instant. The brief's test line reads "one row names the token's operator and device" | `sign-in.db.test.ts:372` (`deviceId: phone.deviceId`) | If the token's device must be on the audit row, it needs a detail key that the reuse path does not have today. Decision DN-2 |
| F-4 | **The reason of that row is `TOKEN_REUSE`**, so the row alone no longer tells "a used token again" from "a live token on another device"; both say that the token is in hands that are not its device's. `OTHER_DEVICE` stays for a dead token of another device | 4.3 | Decision DN-1 |
| F-5 | **After a disable and an enable the operator is named again** on a device where only the used rows of the pair remain (the live token was revoked with the account): "live or last used", as spec §5.6 step 7 words it, for an enabled operator | `failure.db.test.ts:186` | Not a disabled operator, so inside CPS1-8. If "no enrolment after a disable" is wanted, remedy (2) can be added. Decision DN-3 |
| F-6 | The DEVICE half of remedy (2) was not needed for this finding: a retired device never reaches operation 9 (stage 6 answers 403 `DEVICE_REVOKED`) | `failure.db.test.ts` "no credential: 401; … a revoked device: 403 …" (existing) | A device retired between stage 4 and the unit could still write one row that names an enrolled, enabled operator. **Hypothesis, not produced**; outside CPS1-8 |
| F-7 | **Two server processes on one database (not the specified deployment).** If device A's own sign-in (process 1) has claimed the token and not yet committed while device B's presentation (process 2) reads the token as live, process 2's family revocation waits for the claimed row and does not see the next token that process 1 inserted: A's session is ended and the claimed token revoked, but the rotated token stays live. A's app deletes its token on `session.ended` with `TOKEN_REUSE`, so the token left on the server is one nobody holds | **Reasoning from READ COMMITTED semantics, not produced.** In one process the units are serial and it cannot happen. The used-token reuse does not have it: there the claim itself waits | For the row that adds a second process (U-items), if ever |
| F-8 | The unit label `identity.signIn.unaudited` no longer appears in the pipeline's log lines | `sign-in.ts` | Whoever searches logs for it finds `identity.signIn.failed` instead |
| F-9 | One red test of another row in the whole `db` run, independent of this row | 6.4 | For the owner of the engine and clock fix round |

### 10.2 Deviations

| ID | Deviation | Why |
|---|---|---|
| DV-1 | `secrets.db.test.ts` got one more presentation (a dead token of another device) | The journey's only `OTHER_DEVICE` row became a `TOKEN_REUSE`; without it no row with that reason would be under the secret scan |
| DV-2 | The B test asserts the PRESENTING device on the row (finding F-3) | "Exactly through the path a `TOKEN_REUSE` takes today" |
| DV-3 | One read-only command of this session (the baseline typecheck at 19:02) changed into the repository root with `cd` before running, against the rule "never `cd`" | A slip; the folder was the repository root, nothing was written, and every later command ran without it |
| DV-4 | `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`, `implementation/99_implementation_report.md` were not written | The brief (parallel run, two documents only) |
| DV-5 | No log file was saved under `docs/`: the run outputs are quoted here and the files are in the session's scratch folder | The brief's write boundary (the two documents only) |

### 10.3 Decisions for the controller

| ID | Question | Taken here | Alternative |
|---|---|---|---|
| DN-1 | The `details.reason` of the row of a live token presented by another device | `TOKEN_REUSE` (the brief: "same audit row type and reason vocabulary as the existing reuse path"; spec §5.4 ties a session ended with `TOKEN_REUSE` to a row with that reason) | `OTHER_DEVICE` with `sessionsEnded`: the row then says how the token arrived. One line in `refusalOfToken`; `secrets.db.test.ts` and three assertions follow |
| DN-2 | Should the audit row name the TOKEN's device | No: the row's device is the presenter, as for every reuse | A detail key (for example `tokenDeviceId`) on the reuse rows; it widens the row's vocabulary (`CONTRACT-GAP-W41-4`) |
| DN-3 | Remedy for CPS1-8 | (1), the lookup asks `enabled` (5.3) | Add remedy (2) as well, so that a disable leaves no enrolment at all: it changes `src/modules/admin/__tests__/status.db.test.ts:176` by design, and AT-C5 of the database contract |
| DN-4 | The bound for a caller who can sign in (finding F-1) | Accept: the request throttle caps it and each row is a real guess | A cap of verified failures beyond the budget per key and window in `sign-in.ts` (a counter of its own; it would bring back unrecorded guesses beyond the cap) |
| DN-5 | The texts of section 9 | Reported, not edited | The close-out rows |
| DN-6 | `CONTRACT-GAP-W41-5` | Reported with the exact text | The contract follow-up row |

## 11. Rollback

Pre-images of every edited file, copied before the first edit (19:02:48), are under
`.cache/rollback/identity_security_lows/apps/core-server/src/modules/identity/` with
`PRE_IMAGE_SHA256.txt` beside them. To undo the whole row, copy them back over the tree:

```
cp -Rp .cache/rollback/identity_security_lows/apps/ ./apps/
```

No migration, no schema change, no data change: nothing else is to be undone. The three changes
are independent; each can be undone alone by restoring its files.

| Finding | Source files | Test files |
|---|---|---|
| CPS1-6 | `sign-in.ts` | `__tests__/concurrency.db.test.ts`, `__tests__/sequence.db.test.ts` |
| CPS1-7 | `biometric/sign-in.ts`, `biometric/activity.ts` (comments) | `biometric/__tests__/sign-in.db.test.ts`, `tokens.test.ts`, `sequence.db.test.ts`, `secrets.db.test.ts` |
| CPS1-8 | `biometric/store.ts`, `biometric/failure.ts` (comments), `biometric/activity.ts` (one comment) | `biometric/__tests__/failure.db.test.ts`, `static.test.ts` |

Every file changed (13, all under `apps/core-server/src/modules/identity/`):

- `sign-in.ts`
- `biometric/sign-in.ts`
- `biometric/store.ts`
- `biometric/failure.ts`
- `biometric/activity.ts`
- `__tests__/concurrency.db.test.ts`
- `__tests__/sequence.db.test.ts`
- `biometric/__tests__/sign-in.db.test.ts`
- `biometric/__tests__/tokens.test.ts`
- `biometric/__tests__/sequence.db.test.ts`
- `biometric/__tests__/failure.db.test.ts`
- `biometric/__tests__/static.test.ts`
- `biometric/__tests__/secrets.db.test.ts`

Documents created: this file and `delegation_progress/coder_execution_identity_security_lows.md`.
No file was deleted or renamed. No git command that writes was run.

## Appendix: the mutation harness (scratch files outside the repository)

Folder: `/private/tmp/claude-501/-Users-gsp-budi-Documents-DEMS/0d71fd65-4a51-4019-9c48-5c92d11bbdaf/scratchpad/w24b/`
(session scratch: it does not outlive the session; the texts below rebuild it).

`harness.vitest.config.mjs` is `test/assets/02_mutation_harness.vitest.config.mjs.txt` with the
names `w24b-mutation`, `W24B_MUTATION` and `[w24b-harness]`. `run_mutations.sh` runs, for each ID:

```
W24B_MUTATION="$id" DEMS_TEST_STEP=46b npm exec -w @dems/core-server -- vitest run --config "$M/harness.vitest.config.mjs" --maxWorkers=2 <the files of the mutation>
```

`mutations.json` (each `from` occurs exactly once in its file; `I` = `apps/core-server/src/modules/identity/`):

| ID | File | `from` | `to` | Test files run |
|---|---|---|---|---|
| MA1 | `I/sign-in.ts` | `    const limited = await placeInBudget();\n    const failure = await app.pipeline.run('identity.signIn.failed', async (unit) => {` | the same two lines with, between them, `    if (limited !== null) {\n      await app.pipeline.run('identity.signIn.unaudited', () => lockout.fail(lockoutKey, ticket, app.clock.now()));\n      throw limited;\n    }\n` | `__tests__/concurrency.db.test.ts`, `__tests__/sequence.db.test.ts` |
| MA2 | `I/sign-in.ts` | `    if (limited !== null) throw limited;\n    throw failure.lockedUntil === null` | `    throw failure.lockedUntil === null` | the same |
| MB1 | `I/biometric/sign-in.ts` | `    return live ? reuse : { operatorId, reason: TokenRefusalReason.OTHER_DEVICE, reused: null };` | `    return { operatorId, reason: TokenRefusalReason.OTHER_DEVICE, reused: null };` | `biometric/__tests__/tokens.test.ts`, `sign-in.db.test.ts`, `sequence.db.test.ts`, `secrets.db.test.ts` |
| MB2 | `I/biometric/sign-in.ts` | `    const live = found.revokedAt === null && found.expiresAt > now;` | `    const live = found.expiresAt > now;` | `tokens.test.ts`, `sign-in.db.test.ts`, `sequence.db.test.ts` |
| MB3 | `I/biometric/sign-in.ts` | the same | `    const live = found.revokedAt === null;` | `tokens.test.ts`, `sign-in.db.test.ts` |
| MB4 | `I/biometric/sign-in.ts` | `endBiometricSessions(unit, tokenDevice, tokenOperator);` | `endBiometricSessions(unit, deviceId, tokenOperator);` | `sign-in.db.test.ts` |
| MC1 | `I/biometric/store.ts` | `AND t.revoked_at IS NULL AND o.enabled LIMIT 1` | `AND t.revoked_at IS NULL LIMIT 1` | `biometric/__tests__/static.test.ts`, `failure.db.test.ts` |
| MC2 | `I/biometric/store.ts` | `'WHERE t.device_id = $1 AND t.operator_id = $2 AND t.revoked_at IS NULL AND o.enabled LIMIT 1'` | `'WHERE $1::text IS NOT NULL AND t.operator_id = $2 AND t.revoked_at IS NULL AND o.enabled LIMIT 1'` | the same |

The same folder holds the 32 log files of this row: the runs of sections 6.1 to 6.5
(`final_*.log`, `db_*.log`, `unit_*.log`, `whole_unit_1.log`, `whole_db_1.log`, `typecheck*.log`,
`lint*.log`), the nine `mutation_*.log` of 6.6 and the three `attribution_*.log` of 6.4, and the
script `end_state.mts` of 6.7.

---
*Generated: 2026-10-04 19:38 WIB*
*Last Updated: 2026-10-04 20:50 WIB (the follow-up below)*

---

## Follow-up: the condition `DEVICE_CREDENTIAL` on operation 8 (F77, decision D118 step 2)

Written 2026-10-04, 20:31 to 20:50 WIB. Evidence tier 2 for the judgment of H.4, tier 3 for the
rest. Every command ran from the repository root; database commands with the per-command sandbox
bypass, `127.0.0.1:4432` only, `DEMS_TEST_STEP=46c`, `--maxWorkers=2`. **No token, credential,
hash or password is in this section**; the 17 log files of the step hold no value of the form of
a token.

The controller's gate on sections 1 to 11 above: PASS (decision D123). Its rulings: DN-1 the
reason stays `TOKEN_REUSE`; DN-2 the row keeps naming the presenting device (a question for the
final security review); DN-3 remedy (1) alone; DN-4 accepted; DN-5 and DN-6 go to the contract
close-out row.

### H.1 What was asked, and why

Finding F77: a session token of a paired device could call operation 8 `signInWithBiometric`.
With operation 7 that is a chain: a session created by password enrols, then signs in with the
token while it is still open, and the new session can do the same again, for 30 days at a time,
without the device credential and without the password
(`implementation/27_contract_c.md` 15.4). Decision D118, second step: operation 8 gets the
registry's access condition `DEVICE_CREDENTIAL`, as operation 23 got it at 19:35. The guard's
evaluation names no operation (`implementation/28_rbac_guard_pipeline.md` G.2), so the guard
needed no change.

### H.2 What was landed, in ONE step (20:39:13 to 20:39:14)

| Time | Action | Result |
|---|---|---|
| 20:34:16 | `git apply --check docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/27c_condition_op8_addon.patch` | exit 0 (6 files, 61 insertions, 24 deletions) |
| before 20:39 | The landing script (`land.py`, scratch folder), mode `check`: every text it replaces is in its file exactly once | 10 files, 27 texts, 0 problems; nothing written |
| 20:39:07 | 18 pre-images copied to `.cache/rollback/condition_op8/` with `PRE_IMAGE_SHA256.txt` | 18 files |
| 20:39:13 | The same script, mode `land`: the check again, `git apply --check`, plain `git apply` (not `--index`; no other git write of any kind), then the specification, the handler and this folder's tests, each file written once | `git apply exit 0`; 10 files written; done at 20:39:14 |
| 20:39:20 | `npm run typecheck -w @dems/core-server` | **exit 0**, six seconds after the landing |

The contract half is the contract owner's patch, applied unchanged: no contract file was edited by
hand. The patch went in FIRST inside the script, so there was no moment at which the handler had
lost its branch while the guard still let a session through.

**The six contract files** (by `git apply`): `packages/shared/src/api/operation-parts.ts`
(`DEVICE_CREDENTIAL_REFUSED`, the 403 text as one constant), `pairing.ts` (operation 23 uses the
constant; no change of meaning), `identity.ts` (operation 8: one paragraph of description, the 403
text, `access: { ...DEVICE_ACCESS, conditions: [DEVICE_CREDENTIAL] }`, the 403 example),
`packages/shared/test/api-registry.test.ts`, `api-openapi-scope.test.ts`,
`packages/shared/openapi/openapi.json`.

**The specification** (`masterplan/01_specs.md`): three lines, nothing else (`diff` against the
pre-image: 3 lines out, 3 lines in).

| Line | Before | After |
|---|---|---|
| `:831`, section 7.5, row 8, the access cell | `` `DEVICE` `` | `` `DEVICE`; needs the device's own credential `` — checked by splitting the row into its cells: 9 cells, and the cell is equal to that of row 23 (`:860`) |
| `:64`, the revision line | "… without an audit row (registry condition `DEVICE_CREDENTIAL`) \| CPS1-3, D113, D118 \| 4.2, 6.3 (T7 and the note on operation 23), 7.2, 7.7 (row 23) \|" | "… (registry condition `DEVICE_CREDENTIAL`). In a second step the same condition stands on operation 8 `signInWithBiometric`: a session that is still open cannot renew itself through the biometric chain, and no session is presented with a biometric sign-in \| CPS1-3, F77, D113, D118 \| 4.2, 6.3 (T7 and the note on operation 23), 7.2, 7.7 (row 23); second step: 5.2 (ID-6), 7.5 (row 8) \|" |
| `:552`, section 5.2, ID-6 | "… A valid session presented with the sign-in request is ended (reason `ROTATED`) \|" | The same, then ONE sentence: "That branch is reachable for a PASSWORD sign-in only: a biometric sign-in is sent with the device's own credential (registry condition `DEVICE_CREDENTIAL` on operation 8; finding F77, decision D118), so no session is presented with it \|" |

### H.3 What operation 8 answers now

| Caller | Before the step | After the step |
|---|---|---|
| The device, with its device credential, and a live token | 200: a session and the next token | The same |
| The session token of an operator who is signed in on the device | **200**: the token's operator signed in, the presented session ended as `ROTATED`, a new token good for 30 days | **403 `DEVICE_NOT_PAIRED`**, message `This operation needs the device's own credential.`, `details: { reason: 'DEVICE_CREDENTIAL_REQUIRED' }`; decided before the body is read; no audit row, no attempt taken from the device's lockout, no place in the denial budget, nothing stored; the presented session stays open |
| A web console session | 403 `DEVICE_NOT_PAIRED` (the marker; no reason) | The same |
| No credential; a retired device | 401 `NOT_SIGNED_IN`; 403 `DEVICE_REVOKED` with its one row | The same |

Operations 7 and 9 are unchanged: the enrolment needs the operator's session, and a failure report
is still taken from a session of the device (`27_contract_c.md` 15.4: no exposure).

### H.4 The handler branch that became unreachable: REMOVED, and why

The branch: `biometric/sign-in.ts` read the session that came with the request
(`authenticationOf(request).session`), ended it inside the unit of a success
(`endSession(…, 'ROTATED')`), marked the row `replaced: true` and published `session.ended` with
`ROTATED` after the commit (pre-image `:78`, `:83`, `:178-179`, `:216`, `:227-232`; the builder's
member `TokenSignedIn.replaced`, `activity.ts:74-75`).

**It is dead by construction**, by two facts that are each pinned by a test of the row that owns
it:

| Fact | Where | Pinned by |
|---|---|---|
| Stage 6 lets only a DEVICE principal reach operation 8 | The registry's condition (`packages/shared/src/api/identity.ts:436`), the guard's case (`permission-guard/decision.ts`, G.2 P4) and its `default` that refuses a condition it does not evaluate (P5) | `packages/shared/test/api-registry.test.ts` (the holders of the condition are exactly operations 8 and 23); `permission-guard/__tests__/decision.test.ts`; this folder's `routes.test.ts:109, 183` and `sign-in.db.test.ts:706` |
| A DEVICE principal has no session | Stage 4 resolves ONE credential to ONE principal: `plugins/authenticate/index.ts:227-232` (`resolveDeviceCredential` answers `session: null`), and two credentials on one request are refused (`:243-250`) | `plugins/authenticate/__tests__/authenticate.test.ts` |

So `presentedSession` was always null and the four statements behind it could not run.

| Option | Verdict | Reason |
|---|---|---|
| **Remove the branch** | **Taken** | A path that no request of the real pipeline can reach cannot be tested through it, and an untested statement that ends sessions is the kind that rots. The specification now says the same in ID-6. If the registry ever lost the condition, four tests go red at once (the contract's, the acceptance file's comparison with §7, and the two of this folder: H.7), which is the alarm; a kept branch would hide nothing of that and repair nothing of F77 |
| Keep it, with a comment that names the guard's condition | Not taken | It would keep ID-6 true in the one state that must never be reached (a session on operation 8), at the price of dead code in the unit that issues sessions |
| Remove it and make the handler refuse a presented session itself | Not taken | A second place that decides who may call (rule M3: stage 6 only). The module's static test would have to allow it |

What the removal leaves in the code: `sign-in.ts` reads no session of the request at all (the
static test of the folder asserts it, `static.test.ts:143`); the success ends no session and
publishes nothing (`:236-239`, `unit.afterCommit(() => lockout.succeed(deviceId))`); the builder
`tokenSignedIn` takes no `replaced` and passes `replaced: false` to the identity module's builder
(`activity.ts:70-84`), so no caller can make a biometric row say that a session was replaced.
`routes.ts:62` of the brief (`deviceOf`, now `:62-72`) is unchanged in code: it is shared with operation 9,
which is still reached by a session of the device; its comment says which operation is reached by
what. The file's header paragraph "NO SESSION IS PRESENTED WITH A BIOMETRIC SIGN-IN"
(`sign-in.ts:42-52`) says why the branch is gone, so the absence is not silent either.

Source lines, before and after (all under `apps/core-server/src/modules/identity/biometric/`):

| File and lines (after) | Before | After |
|---|---|---|
| `sign-in.ts:20-23` (header, step 3a) | "… a session that was presented with the request is ended (`ROTATED`, ID-6); THE NEXT TOKEN …" | "… THE NEXT TOKEN of the family; the session, method `BIOMETRIC`; `AUTH_SUCCESS`. After the commit the device's count is cleared. No session is ended: none is presented with the request (below)" |
| `sign-in.ts:42-52` (header) | (not there) | The paragraph "NO SESSION IS PRESENTED WITH A BIOMETRIC SIGN-IN (finding F77, decision D118)" |
| `sign-in.ts` imports (was `:78`, `:83`) | `import { authenticationOf } from '../../../plugins/authenticate';` and `import { endSession, markSignedIn, readRolePermissions } from '../session-store';` | The first line removed; `import { markSignedIn, readRolePermissions } from '../session-store';` (`:94`) |
| `sign-in.ts:188` (was `:177-179`) | `const tokenHash = …;` then `// A valid session that came with the request is ended by a success (rotation, ID-6).` and `const presentedSession = authenticationOf(request).session;` | `const tokenHash = biometricTokenHash(presentedToken);` only |
| `sign-in.ts` (was `:216`) | `const replaced = presentedSession === null ? null : await endSession(unit, presentedSession.id, now, 'ROTATED');` | removed |
| `sign-in.ts:235` (was `:227`) | `tokenSignedIn({ operatorId: operator.id, displayName: operator.displayName, deviceId, replaced: replaced !== null })` | `tokenSignedIn({ operatorId: operator.id, displayName: operator.displayName, deviceId })` |
| `sign-in.ts:236-239` (was `:228-232`) | `unit.afterCommit(() => { lockout.succeed(deviceId); if (replaced !== null) app.publish({ kind: 'session.ended', sessionIds: [replaced.id], reason: 'ROTATED' }); });` | A comment and `unit.afterCommit(() => lockout.succeed(deviceId));` |
| `activity.ts:70-84` (was `:70-80`) | `TokenSignedIn` with `readonly replaced: boolean;`; `return signedIn({ ...input, method: BIOMETRIC });` | `TokenSignedIn` without it; a comment; `return signedIn({ ...input, method: BIOMETRIC, replaced: false });` |
| `index.ts:11-17`, `:34-36` (comments) | Operation 8 "the token is used ONCE …"; "… and after a sign-in that replaced a presented session the same with `ROTATED`" | Operation 8 "sent with the device's OWN credential (the registry's condition …)"; "A biometric sign-in ends no other session and publishes nothing … `ROTATED` comes from the password sign-in only" |
| `routes.ts:7`, `:16-19`, `:62-65` (comments) | Row 8 `DEVICE`; who never reaches a handler; `deviceOf` | Row 8 `DEVICE + DEVICE_CREDENTIAL`; the session token on operation 8 is named; `deviceOf` says which operation is reached by what |

The password sign-in (`../sign-in.ts`) is untouched: ID-6 holds there as before.

### H.5 This folder's tests that changed by design (`biometric/__tests__/`)

No test was added or removed: seven were changed in place, in five files. `unit` 12 files and 206
tests, `db` 15 files and 187 tests, as before the step.

| File and line (after) | Before | After |
|---|---|---|
| `routes.test.ts:109-130` (was `:108-121`) | `for (…['signInWithBiometric', 'reportBiometricFailure']) expect(rules.get(operationId)).toMatchObject({ kind: DEVICE, permissions: [], conditions: [], denial: null, refusesRetiredDevice: true });` | The same loop with `conditions: operationId === 'signInWithBiometric' ? [CoreApiAccessCondition.DEVICE_CREDENTIAL] : []`, a comment naming F77 and D118, and the title saying so. The report's rule is still pinned without a condition |
| `routes.test.ts:181-212` (was `:172-180`) | "an operator on a paired device, whatever the role, passes stage 6 on all three": 422 for a body that breaks the schema, on all three operations | For the three roles: 422 on the enrolment and the report as before. On the sign-in, for a body that validates, one that breaks the schema and one that is no JSON: 403 `DEVICE_NOT_PAIRED`, the message, `details.reason: 'DEVICE_CREDENTIAL_REQUIRED'`, valid against the contract, no cookie. Then: no query reached the pool, the device's lockout still has five attempts, the operator's denial budget says `used: 0`, and the device itself passes stage 6 (422 from stage 7) |
| `sign-in.db.test.ts:701-778` (was `:701-724`; the brief's `:539-558`, moved by sections 4 and 5 above) | "a token of another operator signs in THAT operator, whoever's session is presented with it: the presented session is ended as ROTATED (ID-6) …": 200, `details: { method: 'BIOMETRIC', replaced: true }`, the presented session `endReason: 'ROTATED'`, one publication `ROTATED`, the old session token 401 | "a SESSION token of the device on the sign-in is refused by stage 6 …". The investigator's session as the credential, with its OWN token (the chain of the finding) and with the technician's: 403 with the reason and the message, the answer holds only `error`, valid against the contract, no cookie, no revision header; the same for a body that breaks the schema and for one that is no JSON. **No row** (the trail has the same length), **nothing published**, **nothing stored** (`auth_sessions` and `biometric_tokens` row for row what they were), **no attempt** (the device has five), **no place** (`inspect('operator:<id>')`: `used: 0`), **the presented session alive** (`endedAt: null`, and it answers 200). Then, kept as ordered: the same token with the DEVICE credential signs in the token's operator (nobody can choose), ONE `AUTH_SUCCESS` row with `details: { method: 'BIOMETRIC' }`; **the rotation of the TOKEN**: the one that was sent is used, the next one is live in the same family, issued at that instant; no session was ended at that instant, nothing published, all three sessions answer; the investigator's token is still `LIVE` |
| `sequence.db.test.ts:215-227` (was `:215-236`) | "a success with a session presented (ID-6) …": 16 steps with `unit  END_SESSION` | "a session token of the device instead of the device credential …": exactly `['pool  FIND_SESSION_BY_TRANSPORT.BEARER', 'pool  FIND_DEVICE']`, 2 round trips: no attempt, no unit, no place asked for. Then the same token with the device credential: the unit of a success, ending in `lockout.succeed`, with no `END_SESSION` step |
| `static.test.ts:143-150` (was `:143-147`) | The readers of stage 4 "are called in the routes and, for the presented session, in the sign-in": `sign-in.ts` matches `['authenticationOf(']` | They are called in the routes and nowhere else; `sign-in.ts` holds no `endSession`, no `presentedSession`, no `ROTATED`; no file of the folder names `endSession` or `'ROTATED'` |
| `static.test.ts:202-212` (was `:200-210`) | Two `app.publish` in `sign-in.ts`; the success task matches `lockout.succeed(deviceId);`, one publish and `reason: 'ROTATED'` | One `app.publish` (the reuse); the success task is `unit.afterCommit(() => lockout.succeed(deviceId));`; two `afterCommit` in the file |
| `tokens.test.ts:209-222` (was `:209-221`) | "… and `replaced` only when a session was presented": the builder called with `replaced: false` and with `replaced: true` (`details: { method: 'BIOMETRIC', replaced: true }`) | "… and never `replaced` …": the builder takes no such member; the details of the row have the one key `method` |

Lines of sections 4.5 and 5.4 above that moved with this step: `sequence.db.test.ts:267` is now
`:259` and `:238` is `:230`; `static.test.ts:403` is now `:405`. The others are before the changed
places and did not move.

### H.6 Verification

```
20:39:20  npm run typecheck -w @dems/core-server                                   exit 0
20:39:28  npm run test -w @dems/shared -- --maxWorkers=2                           exit 0
 Test Files  68 passed (68)
      Tests  1814 passed (1814)
20:39:36  node --import tsx packages/shared/scripts/gen-openapi.ts --check         exit 0
packages/shared/openapi/openapi.json is up to date (all (committed): 75 operations, 2 security schemes, version 0.2.0; offline: 10 operations, 0 security schemes, version 0.1.0)
          npm run typecheck -w @dems/shared                                        exit 0
          npm run lint -w @dems/shared                                             exit 0, no diagnostic   (the three: done by 20:39:40)
20:39:47  npm run typecheck -w @dems/core-web                                      exit 0
          npm run typecheck -w @dems/mobile                                        exit 0
          npm run lint -w @dems/core-server                                        exit 0, no diagnostic   (the three: done by 20:40:04)
20:40:04  npm run test -w @dems/core-server -- --maxWorkers=2 src/modules/identity exit 0
 Test Files  12 passed (12)
      Tests  206 passed (206)
20:40:14  DEMS_TEST_STEP=46c npm run test:db -w @dems/core-server -- --maxWorkers=2 src/modules/identity   exit 0
 Test Files  15 passed (15)
      Tests  187 passed (187)
[test:db] teardown: dropped 2 database(s) in 89 ms; 0 remain with the run prefix dems_test_step_46c_tmdxz2om_
20:40:33  DEMS_TEST_STEP=46c npm run test:db -w @dems/core-server -- --maxWorkers=2 --silent=false test/acceptance   exit 0
 Test Files  5 passed (5)
      Tests  124 passed (124)
[test:db] teardown: dropped 3 database(s) in 205 ms; 0 remain with the run prefix dems_test_step_46c_tmdxzmtk_
20:41:41  npm run test -w @dems/core-server -- --maxWorkers=2          (whole unit, once; load 7.25)   exit 0
 Test Files  147 passed (147)
      Tests  3795 passed (3795)
   Duration  48.58s (import 61%, tests 34%, transform 5%, worker 1%)
20:42:37  DEMS_TEST_STEP=46c npm run test:db -w @dems/core-server -- --maxWorkers=2   (whole db, once; load 7.63)   exit 0
 Test Files  119 passed (119)
      Tests  1708 passed (1708)
   Duration  178.21s (tests 82%, import 17%, transform 1%)
[test:db] teardown: dropped 8 database(s) in 496 ms; 0 remain with the run prefix dems_test_step_46c_tmdy32df_
20:46:21  the changed files alone, verbose: unit routes, static, tokens              exit 0
 Test Files  3 passed (3)
      Tests  66 passed (66)
20:46:25  the changed files alone, verbose: db sign-in, sequence                     exit 0
 Test Files  2 passed (2)
      Tests  40 passed (40)
[test:db] teardown: dropped 2 database(s) in 237 ms; 0 remain with the run prefix dems_test_step_46c_tmdy9eo7_
```

(A line without a time ran directly after the line above it: the commands of one call were not
timed one by one; the marks taken were 20:39:28, 20:39:36, 20:39:40, 20:39:47 and 20:40:04.)

**The five acceptance files** (`contract`, `pairing-lifecycle`, `rbac-matrix`, `restart`,
`shared-state`): green without a change of any of them. The matrix test read the document and the
registry and printed:

```
[w47] DEVICE_CREDENTIAL (reason DEVICE_CREDENTIAL_REQUIRED) on: 8 signInWithBiometric, 23 rotateDeviceCredential
[w47] INVESTIGATOR@DEVICE: 75 cells: 51 let through by stage 6, 0 × 401, 24 × 403; 22 with a denial row; 0 × 429; 0 not as specified
[w47] SUPERVISOR@DEVICE: 75 cells: 70 let through by stage 6, 0 × 401, 5 × 403; 3 with a denial row; 0 × 429; 0 not as specified
[w47] TECHNICIAN@DEVICE: 75 cells: 42 let through by stage 6, 0 × 401, 33 × 403; 31 with a denial row; 0 × 429; 0 not as specified
[w47] D118 on signInWithBiometric, rotateDeviceCredential: DEVICE 401 INVALID_CREDENTIALS · AUTH_FAILED | a session on the device 403 DEVICE_NOT_PAIRED (DEVICE_CREDENTIAL_REQUIRED), rows 0, places 0 | a web session 403 DEVICE_NOT_PAIRED | a retired device 403 DEVICE_REVOKED · ACCESS_DENIED
```

That is what its owner's simulation F01 predicted (`test/02_rbac_matrix.md` F.5: 51 / 70 / 42 let
through, 24 / 5 / 33 refused). `pairing-lifecycle` calls operation 8 with a device credential in
all its steps (`:1054`, `:1144`, `:1209`, `:1242`, `:1270`), so its biometric sign-in and its token
reuse are untouched.

**The whole runs.** `unit`: 147 files, 3,795 tests, the controller's numbers of 20:25. `db`: 119
files, 1,708 tests, exit 0: one more passed than the controller's 1,707 of 20:25, and none
failed, so the red of the engine round that the controller named is not red in this run. **No
red test in either run**, so there is no red file of another row to name.

### H.7 The changed tests fail when the condition is taken off operation 8 (out of the tree)

One scratch Vitest configuration outside the repository (the harness of the appendix above, with
`W24C_MUTATION`): the workspace's own configuration plus ONE load-time transform of
`packages/shared/src/api/identity.ts`, in memory. No file of the tree was changed (rule M15).

| Run (20:41:19, 20:41:27) | Transform | Result |
|---|---|---|
| BASELINE | none | `Test Files  3 passed (3)`, `Tests  51 passed (51)`, exit 0 |
| N1 | `access: { ...DEVICE_ACCESS, conditions: [CoreApiAccessCondition.DEVICE_CREDENTIAL] },` of operation 8 becomes `access: DEVICE_ACCESS,` (the registry entry as it was before the step) | **`Tests  4 failed \| 47 passed (51)`**, exit 1 |

The four, each with its first assertion:

| Test | First assertion |
|---|---|
| `routes.test.ts` "the rule the guard applies to each route …" | `signInWithBiometric: expected { …(10) } to match object { kind: 'DEVICE', …(4) }` |
| `routes.test.ts` "an operator on a paired device, whatever the role …" | `INVESTIGATOR signInWithBiometric: expected [ 503, 'NOT_READY' ] to deeply equal [ 403, 'DEVICE_NOT_PAIRED' ]` (the session reached the handler, which asked the database-free pool) |
| `sign-in.db.test.ts` "a SESSION token of the device on the sign-in is refused …" | `expected [ 200, null ] to deeply equal [ 403, 'DEVICE_NOT_PAIRED' ]`: without the condition the session renews itself, which is the finding |
| `sequence.db.test.ts` "a session token of the device instead of the device credential …" | `expected { steps: [ …(15) ], roundTrips: 15 } to deeply equal { steps: [ …(2) ], roundTrips: 2 }` |

The two static tests and the builder's test do not depend on the registry and stay green, as they
must: they pin the shape of the source. Both runs ended with `0 remain with the run prefix`.
Not run again here: the contract owner's 15 mutations (`27c_mutations.log`, one of them the
condition on operation 8) and the guard owner's 12 (G.7).

### H.8 By-design changes in OTHER rows' test files

**None needed.** Every candidate of the brief was run and is green without a change:

| Candidate | Result |
|---|---|
| `src/plugins/permission-guard/__tests__/**` | Green in the whole runs (generic since 19:35) |
| `src/modules/rbac/__tests__/matrix.db.test.ts` | Green in the whole `db` run (its model reads the condition from the registry) |
| `test/acceptance/rbac-matrix.test.ts` | Green, 37 tests, no change: the registry and the document landed together (finding F-W47-4) |
| `test/acceptance/pairing-lifecycle.test.ts` | Green: it presents no session token on operation 8 |
| `test/acceptance/contract.test.ts` | Green: it calls operation 8 with the tablet's credential (`:500-505`, `:1037`) |
| `src/plugins/authenticate/__tests__/authenticate.test.ts:132, 433` | Green: it pins `ACTIVITY_EXEMPT_OPERATIONS` and exercises it on a scratch route. See finding G-1: the entry is without effect now |
| `src/engine/__tests__/api-headers.db.test.ts:101`, `clock-floor.db.test.ts:277` | Green: device credentials |

### H.9 Findings, deviations, decisions

| ID | Kind | Content |
|---|---|---|
| G-1 | Finding, for the owner of `src/plugins/authenticate/**` (outside this step's write paths) | `ACTIVITY_EXEMPT_OPERATIONS` (`plugins/authenticate/index.ts:161`) still lists `signInWithBiometric`, and its comment (`:152-157`) says a sign-in "by password or by biometric token, ends the session that was presented with it". No session reaches the `preHandler` hook on operation 8 any more (a refused POST is no activity, `:268-270`), so the entry has no effect and the comment is no longer true for the token. Smallest change: the list becomes `['signIn', 'signOut']`, the comment loses "or by biometric token", and `__tests__/authenticate.test.ts:432-433` follows. Harmless as it is |
| G-2 | Finding, texts for the close-out rows (not edited: the brief allows three places of the specification) | `masterplan/01_specs.md:405` (section 4.2, marker `DEVICE`): "Credential rotation needs the device's own credential …" names operation 23 only; the biometric sign-in now needs it too. `implementation/41_biometric_token.md:119` (the sequence with `END_SESSION`), `:322-326` ("a token of the technician presented with the investigator's session … ends the presented session as `ROTATED`"), `:346` (`replaced: true`), `:423` ("A sign-in that presents a session is accepted …"), `:759` (F-4), `:798` (DN-15) describe the removed branch |
| G-3 | Info, for the owner of `test/acceptance/contract.test.ts` | `:1458` lists `signInWithBiometric 403 DEVICE_NOT_PAIRED` as the known gap `CONTRACT-GAP-W52-1`. The 403 text of operation 8 now names `DEVICE_NOT_PAIRED` for a session of the device; the refusal of a WEB console session by the marker is still not named there (the same as the guard row's CF-7 for operation 23). The test is green; whether the entry stays is its owner's |
| G-4 | As ruled for operation 23 (FU-4, CF-5), now also true of operation 8 | The refusal leaves no audit row and takes no place in the denial budget: a session token can repeat the attempt as often as the request throttle lets it, and what remains is one warn line per attempt (`refusedBy: 'DEVICE_CREDENTIAL'`). Whether the attempt should leave a row is with the final security review |
| G-5 | Info, for the client rows | A client that calls operation 8 must send the device credential, also while an operator's session is in memory (the typed client has one credential provider, `27_contract_c.md` FU-5). The controller reports the mobile runtime does so since 19:44; not checked by this row |
| G-6 | Info | The message of the refusal is typed in the contract's example and in the guard (`denial.ts`), and now also as a literal in two tests of this folder (`routes.test.ts`, `sign-in.db.test.ts`), which state it on their own so that they do not take it from the code under test |
| GV-1 | Deviation | The specification's line `:64` was extended inside the existing revision row (a second sentence and the references of the second step), not as a new row: the brief says "extend the revision line" |
| GV-2 | Deviation | `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md` and `implementation/99_implementation_report.md` were not written (parallel run) |
| GD-1 | Decision for the controller | The unreachable branch was REMOVED (H.4). The alternative, kept with a comment, is a restore of four statements from the pre-image |
| GD-2 | Decision for the controller | Pass G-1 to the owner of the authenticate plugin, G-2 to the document close-out, G-3 to the acceptance row |

No blocker. No `CONTRACT-GAP` of this step: the contract half is the contract owner's patch.

### H.10 End state and rollback

End state at 20:46:43, after the last run of the step (ended 20:46:33), read as `dems_owner` on
the maintenance database (names and counts only):

```
session: role=dems_owner database=postgres server=18.4 port=4432 postmaster started 2026-10-04 07:14:26.046351+07
databases with this row's prefix (dems_test_step_46c_*): 0
test databases of all rows at this moment: 10
project databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3
sessions on this row's databases still open: 0
## .locks/postgres.pid: 19121
## listeners on loopback held by node or postgres processes (lsof -nP -iTCP -sTCP:LISTEN):
postgres 19121 127.0.0.1:4432
## processes of this step's harness still alive (pgrep -f 'scratchpad/w24c'): 0
```

No server was started and no port was bound by this step outside the test runs; every run reached
its teardown; no database was created or dropped by hand; nothing on port 5432 was touched.

Files of the step:

| Kind | Files |
|---|---|
| Contract (the contract owner's add-on patch, applied by `git apply`) | `packages/shared/src/api/operation-parts.ts`, `pairing.ts`, `identity.ts`; `packages/shared/test/api-registry.test.ts`, `api-openapi-scope.test.ts`; `packages/shared/openapi/openapi.json` |
| Specification | `docs/2026-10-04_dems_backend_rbac_pairing/masterplan/01_specs.md` (lines 64, 552, 831) |
| Production, changed | `apps/core-server/src/modules/identity/biometric/sign-in.ts`, `activity.ts`; comments only: `index.ts`, `routes.ts` |
| This folder's tests, changed by design | `apps/core-server/src/modules/identity/biometric/__tests__/routes.test.ts`, `sign-in.db.test.ts`, `sequence.db.test.ts`, `static.test.ts`, `tokens.test.ts` |
| Documents | This section; `delegation_progress/coder_execution_identity_security_lows.md` |
| Pre-images | `.cache/rollback/condition_op8/` (18 files and `PRE_IMAGE_SHA256.txt`) |
| Scratch, outside the repository | `…/scratchpad/w24c/`: `land.py`, the harness (`harness.vitest.config.mjs`, `mutations.json`, `run_mutations.sh`), `end_state.mts`, 17 log files |

Rollback (not executed; `git apply -R --check` of the add-on patch: exit 0 after the last run).
The three halves go back TOGETHER, or the acceptance file `rbac-matrix` is red and this folder's
tests pin a refusal the server no longer gives:

```
git apply -R docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/27c_condition_op8_addon.patch
cp -Rp .cache/rollback/condition_op8/apps/ ./apps/
cp -p  .cache/rollback/condition_op8/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/01_specs.md docs/2026-10-04_dems_backend_rbac_pairing/masterplan/01_specs.md
```

(The pre-images under `.cache/rollback/condition_op8/apps/` are the files as sections 1 to 11
left them; the pre-images of those sections are in `.cache/rollback/identity_security_lows/`.)

*Follow-up written: 2026-10-04 20:50 WIB.*
