---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 55
plan_row: W33
title: User and role administration - operations 11 to 14, the last-administrator rule, session end on disable, the change notification
date: 2026-10-04
agent: coder-execution (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
source_spec: masterplan/01_specs.md rev 2.2 (§4.6 RB-3 and RB-8, §4.7, §7.2, §7.3, §7.6, §8.2 ENG-23 and ENG-27, §9.4, §9.5, §13.1); masterplan/03_database_contract.md rev 2.2 (§4.3 to §4.6, §4.10, §5.6 AT-1 to AT-3 and AT-C5, §7.3)
evidence_tier: 3
status: complete
---

# W33: user and role administration

All times are WIB (UTC+7) on 2026-10-04. Every command ran from `/Users/gsp-budi/Documents/DEMS`;
the session never changed into a subfolder. Database commands ran with the per-command sandbox
bypass (P10, M12). Quoted runner output is unchanged except that the sandbox's certificate warning
lines and the per-table lines of the bulk fixture are left out.

**No password, token, cookie value, hash or other credential appears in this document.** The demo
password is named by its constant only. A test takes a token from an answer and hands it on in a
header; none is printed, and no test name holds one.

## 1. Result

| Item | Result |
|---|---|
| Row tests, `unit` (3 files of the folder) | **Exit 0**: 3 files, 86 tests, 0 failed (15:15:40) (section 12.1) |
| Row tests, `db` (6 files, `DEMS_TEST_STEP=55`) | **Exit 0**: 6 files, 60 tests, 0 failed; 0 databases remain with the run prefix (15:15:43) (section 12.1) |
| AC-B-18: a role change applies to the next request of the same session | The same web session AND the same device session of one operator: 403 `NOT_PERMITTED` (one `ACCESS_DENIED` row each) before, 200 after the change, 403 again after the change back. No new sign-in: the same two session rows, still open. Nothing is called on the guard: `reloadMatrix` not called, the loaded matrix is the same object (section 8) |
| AC-B-20 (session and sign-in part): a disabled user | The flag, the end of the operator's 2 open sessions (reason `USER_DISABLED`, at the server clock's time), the revocation of its live biometric tokens and the `USER_DISABLED` row (`sessionsEnded: 2`) commit in ONE unit. The next request of each ended session: 401 `NOT_SIGNED_IN`, no row. The next sign-in with the right password, web and device: the generic 401 `INVALID_CREDENTIALS`, the same body shape as a wrong password; its `AUTH_FAILED` row says `reason: USER_DISABLED`. After the commit `session.ended` is published with exactly those session IDs (section 9) |
| Enable | 200, `USER_ENABLED`; a REAL sign-in through `POST /api/v1/auth/sign-in` then answers 200 on the web console and on a paired device; the sessions that the disable ended stay ended and the revoked tokens stay revoked |
| AC-B-21: the last enabled SUPERVISOR | A demotion (to either role) and a disable answer 409 `LAST_ADMIN`; afterwards the operator rows (their `updated_at` included), the sessions, the tokens, the trail, the events and the engine's revision are as before, and nothing was published. A second SUPERVISOR that is disabled does not count |
| AC-B-79: two concurrent changes of the two remaining holders | Never two successes. One instance, free-running: 25 rounds of two demotions and 15 rounds of one demotion and one disable, each round one 200 and one 409 `LAST_ADMIN`. Both units queued behind the guard: 10 rounds of cross demotions, 5 of mutual disables. A second writer on the same database, with and without the chain lock: the server's unit waits at the lock point and answers 409 on the committed rows. Two instances on one database: 15 rounds, each one 200 and one 409 (section 7) |
| An operator changing the own role, or disabling itself | Allowed unless it is the last administrator (the specification names no other rule). Tested both ways (section 6) |
| MODG | The route list of the module equals registry operations 11 to 14 (both printed, section 12.3); every documented status of every operation has a test and every answer validates against the contract; one allowed and one refused call per operation |
| Whole `unit` project | **Exit 0**: 102 files, 2,659 tests, 0 failed (15:20:45). The pass before it (15:16:00) had one red test, in a file of the guard row that its owner was editing in that minute (section 12.4) |
| Whole `db` project (`DEMS_TEST_STEP=55`) | **Exit 0**: 75 files, 1,081 tests, 0 failed; forced drops that needed a retry: 0; 0 databases remain with the run prefix (15:21:24). The pass before it (15:16:39) had one red test, of the same cause (section 12.4) |
| Typecheck, lint of the workspace | Exit 0; exit 0 with no warning (15:24:06 and 15:24:19; also 15:15:31 and 15:15:39) |
| Mutation check | 92 of 92 planted defects detected: 24 by both projects, 58 by the `db` project alone, 10 by the `unit` project alone (section 13). No file of the workspace tree was changed for it (rule M15) |
| Other rows' tests | Three test files of the RBAC guard row register stand-in routes for registry operations that modules now register (`listUsers` and `assignUserRole` among them): red by design, decision D85, fixed by their owner at about 14:49 and green at this row's final runs. This row edited none of them (section 14) |
| Contract, schema and simulator gaps | None |
| PostgreSQL | Never stopped or reconfigured: `.locks/postgres.pid` is 19121. No database with this row's prefix remains (section 19) |

## 2. What was written

Production, `apps/core-server/src/modules/admin/` (the scaffold's stub `index.ts` is replaced):

| File | Lines | What |
|---|--:|---|
| `index.ts` | 198 | The plugin `adminModule`: four routes built from the registry entries (`routeOfOperation`), the contract's schemas, the path-parameter schema from the registry's pattern, the actor from `request.principal`, the reason, the mirror after the commit, the two headers of API-7 |
| `changes.ts` | 200 | The three units of work (`admin.assignUserRole`, `admin.disableUser`, `admin.enableUser`), their audit rows and their publications; the two refusals (404, 409) |
| `rule.ts` | 44 | The last-administrator rule as arithmetic over the locked rows: `applyChange`, `administratorsOf`, `leavesNoAdministrator` |
| `statements.ts` | 177 | The ten statements, as constant texts with bind parameters, and one function per statement |

Tests, `apps/core-server/src/modules/admin/__tests__/`:

| File | Project | Tests | What |
|---|---|--:|---|
| `rule.test.ts` | unit | 14 | The rule without a database |
| `routes.test.ts` | unit | 41 | MODG route list; the guard's 401; stage 7 (422, 400); the list read and its failure; the backstop |
| `static.test.ts` | unit | 31 | Rules M2, M3, M5, M8, M14 for the folder, and the statements |
| `users.db.test.ts` | db | 18 | Operations 11 and 12; AC-B-18; AC-B-21 for a demotion; a self-demotion |
| `status.db.test.ts` | db | 12 | Operations 13 and 14; AC-B-20; AC-B-21 for a disable; a self-disable; no password handling |
| `last-admin.db.test.ts` | db | 14 | AC-B-79 and its variants: free-running, gated, a second writer, two instances |
| `sequence.db.test.ts` | db | 12 | The statements of every operation, in order, and the cost of one command |
| `failures.db.test.ts` | db | 2 | A statement that the database refuses: atomicity and no leak (M14) |
| `bulk.db.test.ts` | db | 2 | The `bulk` template: 12 operators |
| `support.ts` | - | - | The real app on a clone, booted with the engine on a manual timer; sessions; fixtures; the recording pool |

Documents: this file; `delegation_progress/coder_execution_step_55.md`; assets
`implementation/assets/33_*` (section 21). Pre-image of the stub: `.cache/rollback/W33.admin-index.ts.pre`.

Nothing outside the module folder and the documents was written (M1): not `app.ts`, not the
contract, not the schema, not the core, the engine, a plugin or another module.

## 3. The handler recipe per operation (M13)

All four are **server-native** (none has a simulator action, spec §7.6). None is a hosted action.

| # | Operation | Recipe |
|--:|---|---|
| 11 | `listUsers` | A read on `app.db.pool`: ONE statement (`LIST_USERS`), no unit of work. A failure of the database is logged by its code, written to the error log, reported to readiness (`app.db.probe`), answered 503 `NOT_READY` |
| 12 | `assignUserRole` | One unit `admin.assignUserRole` of `app.pipeline.run`; after the commit the unit's publications, then `await app.engine.mirrorOperators()`, then the answer with `x-dems-epoch` and `x-dems-revision` from `app.engine` |
| 13 | `enableUser` | One unit `admin.enableUser`; the same after the commit |
| 14 | `disableUser` | One unit `admin.disableUser`, in which the sessions are ended through `app.sessionRegistry.endForOperator(unit, …)`; the same after the commit |

What every write has in common:

- The **actor** of the row is `request.principal` (`operatorId`, `deviceId`), never a request field
  (M8, SR-65). Tested with a body that carries `actorId`, `operatorId`, `deviceId` and `at`: the
  schema drops them and the row names the session's operator and device.
- **Who may call** is stage 6 alone (M3). The handlers read no permission and no role; the routes
  carry no hook. A static test asserts it for the folder, and a test with stage 6 taken out shows
  the handler lets an operator without the permission through (it holds no second rule).
- **Input** (M7): the body and the path parameter are validated by the contract's schemas at stage
  7. A reason over 500 characters, with U+0000 or with an unpaired surrogate is refused, never cut.
  A reason that has the form of a credential (`looksLikeSecret`) is refused the same way, 422
  `INVALID_INPUT` with `details.in: body`, before any unit: an audit row never holds one (SR-54),
  and the audit writer never has to refuse the unit with a 500.
- **A refusal throws inside the unit**, so the transaction rolls back. Neither 404 nor 409 is
  audited (the specification names no row for them), so neither takes a place in the denial budget.
- **A change that changes nothing** (the same role, already enabled, already disabled) answers 200
  with the operator and writes no row, publishes nothing, does not ask for the mirror.
- **No password handling.** Operations 11 to 14 define none; the specification has no operation
  that sets or resets a password, so there is none. The folder names no credential table (static
  test), and a role change, a disable and an enable leave every credential row as it was (a digest
  computed by the database, `status.db.test.ts`).

## 4. The unit of each write operation, statement by statement

Printed by `sequence.db.test.ts`, whose pool records every statement on the pool (`pool`) and on a
unit's connection (`unit`); `publish` lines are calls of `app.publish`. Names are the constants of
`statements.ts` (`admin …`) and of the identity store (`identity …`). The run is saved in
`implementation/assets/33_test_db_verbose.txt`.

### 4.1 `assignUserRole`, a change (200)

```
pool  identity FIND_SESSION_BY_TRANSPORT.COOKIE        stage 4: the session, the operator, the permissions for THIS request (RB-3)
unit  BEGIN ISOLATION LEVEL READ COMMITTED             the unit admin.assignUserRole (AT-1)
unit  chain lock                                       AT-2: the first statement; two processes queue here
unit  statement timeout
unit  admin LOCK_OPERATORS                             AT-C5: every operator row, in key order, FOR UPDATE: the lock point of the rule
                                                       in memory: unknown ID -> 404; the same role -> answer, no write
unit  admin READ_ROLES_HOLDING                         the roles that hold USER_ADMIN, from the stored matrix
                                                       in memory: the change applied to the locked rows; no enabled holder left -> 409
unit  admin ASSIGN_ROLE                                compare-and-set: ... WHERE id = $1 AND role_id = <the role read under the lock> RETURNING id
unit  admin READ_ROLE_PERMISSIONS                      the new role's permissions, for session.updated
unit  INSERT audit_log ROLE_CHANGED                    through unit.audit.append: actor, target, from, to, reason?
unit  admin READ_USER                                  the operator as answered
unit  COMMIT
publish state (native)                                 the engine took the row into its ring: a delta that appends it (revision +1)
publish session.updated                                unit.afterCommit: operator, new role, its permissions
publish admin.changed                                  unit.afterCommit: USERS
unit  BEGIN ISOLATION LEVEL READ COMMITTED             app.engine.mirrorOperators(): a unit of the engine
unit  chain lock
unit  statement timeout
unit  engine SELECT operators (the mirror, ENG-3)
unit  COMMIT
publish state (operators)                              a delta that replaces the operators slice (revision +1)
                                                       the answer: 200 AdminUser, x-dems-epoch, x-dems-revision
```

Refusals and the unchanged case:

```
409 LAST_ADMIN   stage 4; BEGIN, chain lock, statement timeout, LOCK_OPERATORS, READ_ROLES_HOLDING, ROLLBACK     no write was sent
404              stage 4; BEGIN, chain lock, statement timeout, LOCK_OPERATORS, ROLLBACK
unchanged (200)  stage 4; BEGIN, chain lock, statement timeout, LOCK_OPERATORS, READ_USER, COMMIT                 no row, no publication, no mirror
422              stage 4 only: no unit
403              stage 4; the GUARD's unit: BEGIN, chain lock, statement timeout, INSERT audit_log ACCESS_DENIED, COMMIT
```

### 4.2 `disableUser`, a change (200)

```
pool  identity FIND_SESSION_BY_TRANSPORT.COOKIE
unit  BEGIN ISOLATION LEVEL READ COMMITTED             the unit admin.disableUser
unit  chain lock
unit  statement timeout
unit  admin LOCK_OPERATORS                             the lock point; unknown ID -> 404; disabled already -> answer, no write
unit  admin READ_ROLES_HOLDING                         the rule: no enabled holder left -> 409
unit  admin DISABLE_OPERATOR                           compare-and-set: ... SET enabled = false ... WHERE id = $1 AND enabled RETURNING id
unit  identity END_SESSIONS_OF_OPERATOR                app.sessionRegistry.endForOperator(unit, id, 'USER_DISABLED'): the IDs come back
unit  admin REVOKE_BIOMETRIC_TOKENS                    the live tokens of the operator, reason USER_DISABLED (AT-C5)
unit  INSERT audit_log USER_DISABLED                   severity WARNING; targetOperatorId, sessionsEnded, reason?
unit  admin READ_USER
unit  COMMIT
publish state (native)
publish session.ended                                  unit.afterCommit: the ended session IDs, reason USER_DISABLED (only when there are any)
publish admin.changed                                  unit.afterCommit: USERS
unit  BEGIN ... chain lock ... statement timeout ... engine SELECT operators ... COMMIT      the mirror; nothing to publish (the slice has no enabled flag)
```

`409 LAST_ADMIN`, `404` and "already disabled" are the three short forms of section 4.1.

### 4.3 `enableUser`, a change (200)

```
pool  identity FIND_SESSION_BY_TRANSPORT.COOKIE
unit  BEGIN ISOLATION LEVEL READ COMMITTED             the unit admin.enableUser
unit  chain lock
unit  statement timeout
unit  admin LOCK_OPERATOR                              the ONE row, FOR UPDATE; unknown ID -> 404; enabled already -> answer, no write
unit  admin ENABLE_OPERATOR                            compare-and-set: ... SET enabled = true ... WHERE id = $1 AND NOT enabled RETURNING id
unit  INSERT audit_log USER_ENABLED                    targetOperatorId, reason?
unit  admin READ_USER
unit  COMMIT
publish state (native)
publish admin.changed                                  unit.afterCommit: USERS
unit  BEGIN ... chain lock ... statement timeout ... engine SELECT operators ... COMMIT      the mirror; nothing to publish
```

An enable cannot take an administrator away, so it does not ask the rule and locks only its own
row. Tested: it is not held up by a second writer that holds another operator's row; and two
enables of ONE operator wait for each other at `LOCK_OPERATOR`, the second then answering
"already enabled" with no row.

### 4.4 The statements

| Constant | Text | Privilege of `dems_app` it needs (database contract §7.3) |
|---|---|---|
| `LIST_USERS` | `SELECT o.id, o.username, o.rank, o.name, o.display_name, o.initials, o.role_id, o.enabled, o.last_sign_in_at, o.role_changed_at, (SELECT count(*)::int FROM public.auth_sessions s WHERE s.operator_id = o.id AND s.ended_at IS NULL) AS active_sessions FROM public.operators o ORDER BY o.id` | SELECT |
| `READ_USER` | The same columns, `… WHERE o.id = $1` | SELECT |
| `LOCK_OPERATORS` | `SELECT id, role_id, enabled FROM public.operators ORDER BY id FOR UPDATE` | SELECT, and UPDATE on a column (enough for `FOR UPDATE`) |
| `LOCK_OPERATOR` | `SELECT id, role_id, enabled FROM public.operators WHERE id = $1 FOR UPDATE` | the same |
| `READ_ROLES_HOLDING` | `SELECT role_id FROM public.role_permissions WHERE permission_id = $1` | SELECT |
| `ASSIGN_ROLE` | `UPDATE public.operators SET role_id = $2, role_changed_at = $3, updated_at = $3 WHERE id = $1 AND role_id = $4 RETURNING id` | UPDATE (`role_id`, `role_changed_at`, `updated_at`) |
| `DISABLE_OPERATOR` | `UPDATE public.operators SET enabled = false, updated_at = $2 WHERE id = $1 AND enabled RETURNING id` | UPDATE (`enabled`, `updated_at`) |
| `ENABLE_OPERATOR` | `UPDATE public.operators SET enabled = true, updated_at = $2 WHERE id = $1 AND NOT enabled RETURNING id` | the same |
| `REVOKE_BIOMETRIC_TOKENS` | `UPDATE public.biometric_tokens SET revoked_at = $2, revoke_reason = 'USER_DISABLED' WHERE operator_id = $1 AND used_at IS NULL AND revoked_at IS NULL RETURNING id` | UPDATE (`revoked_at`, `revoke_reason`) |
| `READ_ROLE_PERMISSIONS` | `SELECT rp.permission_id FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id WHERE rp.role_id = $1 ORDER BY p.sort_order` | SELECT |

A static test pins: every table carries its schema; no value is part of a text; the module writes
two tables, by UPDATE only, and only columns the privilege matrix grants; every transition states
its expected state and returns the row; the only row locks are the two `FOR UPDATE` statements;
no statement names a credential table, a hash or a password.

### 4.5 The audit rows

| Type | Category | Severity | Actor | Device | Details (the closed list of the audit writer) | Message |
|---|---|---|---|---|---|---|
| `ROLE_CHANGED` | SECURITY | INFO | the caller's operator | the caller's session device, null on the web | `targetOperatorId`, `from`, `to`, `reason?` | `Role of OPR-003 changed from TECHNICIAN to INVESTIGATOR` |
| `USER_DISABLED` | SECURITY | WARNING | the same | the same | `targetOperatorId`, `sessionsEnded`, `reason?` | `Operator OPR-001 disabled; sessions ended: 2` |
| `USER_ENABLED` | SECURITY | INFO | the same | the same | `targetOperatorId`, `reason?` | `Operator OPR-001 enabled` |

No event is written: the three are audit-only (spec §13.1). The reason is in the details and
nowhere else: not in the message, not in a log line (tested with a marker). A reason that is empty
after trimming is no reason: the row has no such key.

## 5. The last-administrator rule (RB-8, SR-47, SR-72, ENG-27)

The rule: `assignUserRole` and `disableUser` are refused with 409 `LAST_ADMIN` when they would
leave no ENABLED operator whose role holds `USER_ADMIN`.

| Point | How it is met |
|---|---|
| The check and the update are ONE unit | Both are in the one `app.pipeline.run(…)` of the operation: one transaction at READ COMMITTED (AT-1). The refusal throws inside it, so "409 changes nothing" is the transaction's rollback, not a promise of the code. The timeline of the refusal shows that no write was even sent |
| The lock | `LOCK_OPERATORS`: every operator row, in key order, `FOR UPDATE`, before anything the unit decides on (database contract AT-C5) |
| What is decided on | The rows that statement returned. The change is applied to them in memory (`applyChange`), the enabled operators whose role is in the stored set of `READ_ROLES_HOLDING` are counted (`administratorsOf`), and none left means 409 (`leavesNoAdministrator`). The roles come from the STORED matrix inside the unit, not from a role name: with `USER_ADMIN` granted to TECHNICIAN as well, the SUPERVISOR may be demoted while an enabled TECHNICIAN exists (tested) |
| The write | Compare-and-set on what was read: `… WHERE id = $1 AND role_id = <read under the lock>`, `… AND enabled`. The returned row decides (AT-3). A row that this unit holds locked and that does not match is a defect: the unit throws and rolls back (500) |
| It is about the state AFTER the change | Whoever asks. A disabled SUPERVISOR never counts. With no holder at all (reachable only by editing the database) every change that leaves none is refused, and the one change that makes a holder is let through |

**What guarantees it under concurrency.**

| Case | What orders the two units | Proof |
|---|---|---|
| Two requests to ONE process | The serial pipeline: one unit at a time, in the order of submission (ENG-1, ENG-6). The second unit starts after the first has committed, so its `LOCK_OPERATORS` reads the committed result | Section 7, groups A and B |
| A second process on the same database | Two things, each enough on its own. (1) Every unit of the pipeline opens with the lock of the audit chain head (AP-2, AT-2), so units of two processes queue there before they read anything. (2) The lock point of the rule itself, `LOCK_OPERATORS`, which does not rely on (1): the second transaction waits at that statement and, at READ COMMITTED, then gets the newest committed version of every row it waited for | Section 7, groups C and D |

The specification does not ask for a second instance on one database (each instance has its own,
P14); the database contract writes its statements so that "the result is right even if two units
ran at the same time" (§5.6), and that is what group C shows for this rule.

## 6. An operator changing the OWN role, or disabling itself (row rule 2)

The server specification has ONE rule for these two operations, RB-8; it names no rule about the
caller being the target. The client specification expects them to be possible: a warning "You are
changing your own role. You may lose access to this page." and "You will be signed out."
(`masterplan/04_client_integration_spec.md` §10.2). So: **allowed unless it is the last
administrator.**

| Case | Answer | Tested (`users.db.test.ts`, `status.db.test.ts`) |
|---|---|---|
| The only SUPERVISOR demotes itself, to either role | 409 `LAST_ADMIN`, nothing changed; the session still holds user administration | "the only SUPERVISOR cannot be demoted, to either role, by itself" |
| The only SUPERVISOR disables itself | 409 `LAST_ADMIN`; no session ended, no token revoked | "the only SUPERVISOR cannot disable itself" |
| A SUPERVISOR beside another one demotes itself | 200. The session stays, with the new role; its next `listUsers` and its next `assignUserRole` answer 403 | "a SUPERVISOR beside another one demotes itself" |
| A SUPERVISOR beside another one disables itself | 200 with the operator; its own sessions (web and device) are ended by its own request; the row names it as actor and as target; its next request answers 401 | "a SUPERVISOR beside another one disables itself" |

The answer to a self-disable carries no `Set-Cookie`: the identity module alone sets and clears
the session cookie (its static test pins one place each). The cookie then names an ended session
and resolves to nothing; the web client leaves on `session.ended` or on the 401.

## 7. The last-administrator proof (row rule 1; AC-B-79; SD-04)

`last-admin.db.test.ts`, against PostgreSQL 18.4 on clones of the seed. Two holders: the seeded
SUPERVISOR `OPR-002` and `OPR-001`, promoted by a fixture. Every round starts with exactly two
enabled holders and ends with an assertion on the stored rows, read as `dems_owner`.

| Group | Arrangement | Rounds | Result (printed by the run of 15:15:43) |
|---|---|--:|---|
| A | One instance, two requests sent together (`Promise.all`), each holder DEMOTING ITSELF, so neither can lose its permission to the other before stage 6 let it through: the loser's answer is always the rule's 409, never the guard's 403 | 25 | 25 x (one 200, one 409 `LAST_ADMIN`); the first request won 21, the second 4; one enabled holder left and one `ROLE_CHANGED` row each round |
| A | The same with one demotion and one disable, the order of sending alternating | 15 | 15 x (one 200, one 409 `LAST_ADMIN`); the demotion won 8, the disable 7; a refused disable ended no session |
| B | Both requests held behind one unit of the pipeline until both have passed stages 3 to 6 and queued their units; each holder demoting THE OTHER | 10 | 10 x (one 200, one 409 `LAST_ADMIN`); no `ACCESS_DENIED` row: both were let through by stage 6, the refusal is the rule's |
| B | The same, each holder DISABLING the other: the unit that runs second belongs to an operator the first has just disabled, and is refused by the rule; no denial row | 5 | 5 x (one 200, one 409 `LAST_ADMIN`); one of the two disabled, the other untouched |
| B | A demotion and a disable of the SAME holder, by the other holder | 1 | Both 200 (the other holder stays): the rule does not over-refuse |
| C | A second connection of `dems_app` holds an UNCOMMITTED demotion of holder A, taken WITH the chain lock; the server is asked to demote holder B | 1 | The unit waits at its first statement (`chain lock`); after the COMMIT: 409 `LAST_ADMIN`; B is the one holder left |
| C | The same WITHOUT the chain lock | 1 | The unit waits at `LOCK_OPERATORS`, having read no role and written nothing; after the COMMIT: 409 |
| C | The same, the second writer holding an uncommitted DISABLE of A | 1 | The same |
| C | The second writer holds the lock point and has changed nothing yet | 1 | While it waits, the server's unit has opened its transaction, taken the chain lock and asked for `LOCK_OPERATORS`, and nothing after it: no role read, no write. After the COMMIT: `READ_ROLES_HOLDING`, `ASSIGN_ROLE`; 200 |
| C | The server is asked to DISABLE B while A's demotion is held | 1 | Waits, then 409; B's session is still open |
| C | The second writer ROLLS BACK | 1 | Waits, then 200: nobody was taken away |
| C | Two ENABLES of one operator: the second writer holds an uncommitted enable of it | 1 | The server's unit waits at `LOCK_OPERATOR`, before it has read the flag; after the COMMIT: 200 "already enabled", no `ENABLE_OPERATOR` sent, no row of the server |
| D | Two apps built by the real factory on ONE cloned database (ports 4420 and 4421), each with its own pipeline; each asked to demote one holder, sent together | 15 | 15 x (one 200, one 409 `LAST_ADMIN`); the main instance won 8, the lane 7; the chain of the shared database links row by row |

Total: 77 concurrent rounds about the rule; **two successes: 0**.

How "the unit waits" is observed: a lock request that is not granted, of a backend connected to
the clone (`pg_locks` joined to `pg_stat_activity` by `pid`, filtered by the clone's own name,
finding F63). The wait columns of `pg_stat_activity` cannot be used for this: they are hidden from
a role that is not the backend's own, and the helper role is `dems_owner` while the server is
`dems_app` (finding F-4).

In group D neither engine runs (two engines on one database would each see the other's rows as a
diverged chain head), so `app.engine.mirrorOperators()` refuses after each committed change. The
answers are 200 all the same; each failure is one error line (`code: NOT_READY`,
`source: admin.assignUserRole`) and one entry of the error log with the request ID: asserted, 15 of
each.

The database-level form of the same case (two connections, the statements alone) is T-AT-5 of
`test/db/atomic.db.test.ts`, the migration row's.

## 8. AC-B-18: the role change and the guard (decision D83 DN-2)

`users.db.test.ts`, block "AC-B-18, RB-3, SR-13", through the real stages with no stage replaced:

| Step | Web session of `OPR-003` | Device session of `OPR-003` | Rows |
|---|---|---|---|
| Before (TECHNICIAN) | `GET /api/v1/admin/users`: 403 `NOT_PERMITTED` | 403 `NOT_PERMITTED` | 2 x `ACCESS_DENIED` |
| The SUPERVISOR assigns SUPERVISOR | - | - | `ROLE_CHANGED` |
| After | 200; `getAuthSession` answers role SUPERVISOR with `USER_ADMIN`; a command (`assignUserRole`) answers 200 | 200 | no denial row |
| The SUPERVISOR assigns TECHNICIAN | - | - | `ROLE_CHANGED` |
| After | 403 `NOT_PERMITTED` | 403 `NOT_PERMITTED` | 2 x `ACCESS_DENIED` (`role: TECHNICIAN`) |

The two session rows of `OPR-003` are the same before and after (ID, issue time, open). The
module calls nothing on the guard: `permissionGuard(app).reloadMatrix` is not called (spy), and
the matrix the boot step loaded is the same object afterwards. The truth at request time is the
permission set stage 4 read from PostgreSQL for THAT request.

## 9. What the web page "Users & Roles" (W77) and the realtime channel (W42) can rely on

`app.publish` is called in this order, after the COMMIT of the unit, before the HTTP answer:

| Operation (a change) | 1 | 2 | 3 | 4 | The answer |
|---|---|---|---|---|---|
| `assignUserRole` | `state`, cause `native`: a delta that appends the `ROLE_CHANGED` row to `audit` (revision N+1) | `session.updated { operatorId, role, permissions }`: the new role and the stored permissions of that role in permission order | `admin.changed { resource: 'USERS' }` | `state`, cause `operators`: a delta that REPLACES the `operators` slice (revision N+2) | 200 `AdminUser`; `x-dems-revision: N+2` |
| `disableUser` | `state`, cause `native`: appends `USER_DISABLED` (N+1) | `session.ended { sessionIds, reason: 'USER_DISABLED' }`: only when a session was ended | `admin.changed { resource: 'USERS' }` | - (the `operators` slice holds no `enabled` flag, spec §9.5: the mirror finds nothing to publish) | 200 `AdminUser`; `x-dems-revision: N+1` |
| `enableUser` | `state`, cause `native`: appends `USER_ENABLED` (N+1) | `admin.changed { resource: 'USERS' }` | - | - | 200 `AdminUser`; `x-dems-revision: N+1` |
| Any of them, nothing changed | - | - | - | - | 200 `AdminUser`; `x-dems-revision`: the current revision |
| Any refusal (401, 403, 404, 409, 422, 500, 503) | nothing of this module (a 403 publishes the guard's `ACCESS_DENIED` row as a `state` change) | | | | no `x-dems-revision` header |

What a client may build on:

| Fact | Detail |
|---|---|
| Read-your-writes (RT-5, API-7) | The revision in the header is the revision of the newest change that holds the command's effect. A store that has reached it holds the audit row and, for a role change, the new `operators` slice |
| `session.updated` comes before `admin.changed` | So the channel can re-evaluate the topic membership of the affected sockets before it fans the list hint out: an operator who just lost `USER_ADMIN` is no holder any more when `admin.changed` is sent |
| `admin.changed USERS` after all three changes | The list changed in each (role, flag, open sessions). It carries the name of the list only. The page refetches `listUsers` |
| The `operators` slice | Changes only by a role change (identity fields are never written). It never holds `enabled`, `lastSignInAt` or a session count: those are REST-only, behind `USER_ADMIN` |
| `activeSessions` | The session rows of the operator that are not ended. A session past its idle or absolute limit stays in the count until the sweeper (every 5 s on a listening server) or its own next request ends it |
| NOT published by this module | A sign-in, a sign-out or an expiry of some operator changes `lastSignInAt` and `activeSessions` of the list, and no `admin.changed` follows (the identity row publishes none, decision D78 DN-16). The client specification §10.2 expects the list to follow "a sign-in elsewhere" (finding F-3) |
| A refused change | 409 `LAST_ADMIN` with the fixed text "At least one enabled operator must keep user administration."; 404 with "No operator has this ID."; nothing changed and nothing published. The page may show the same sentence as its hint |
| Order of the list | Operator ID, ascending |
| A disable of the caller itself | 200 with the operator, then the caller's own sockets get `session.ended`; the next REST call answers 401 |

The seam is still the realtime row's stub, so no socket was involved here: the publications are
asserted as calls of `app.publish` (kind, content, order), the closing of sockets with 4401 within
1 s is W42's.

## 10. The status table per operation, with the test for each (M11, M13)

Every answer in the "validated" column is checked with `validateCoreApiResponse(operationId, status, body)`.

| Operation | Status | When | Test | Validated |
|---|---|---|---|---|
| `listUsers` | 200 | A holder of `USER_ADMIN` | `users.db.test.ts` "the SUPERVISOR lists every operator …"; `bulk.db.test.ts` (12 operators) | yes |
| | 401 `NOT_SIGNED_IN` | No session (the guard) | `users.db.test.ts` "refusals are the guard's …"; `routes.test.ts` | yes |
| | 403 `NOT_PERMITTED` | INVESTIGATOR, TECHNICIAN (the guard, one `ACCESS_DENIED` row) | the same | yes |
| | 503 `NOT_READY` | The read fails | `routes.test.ts` "M14: a read that fails …" | envelope |
| `assignUserRole` | 200 | A change; and the same role (no row) | `users.db.test.ts` "200: the role is changed in one unit …", "the role the operator already has …" | yes |
| | 400 `INVALID_JSON` | Not a JSON object | `users.db.test.ts` "422 and 400 through the real stages"; `routes.test.ts` | yes |
| | 401 | No session | `users.db.test.ts` "refusals are the guard's and come before the body is read" | yes |
| | 403 `NOT_PERMITTED` | TECHNICIAN, with a good and with a bad body | the same | yes |
| | 404 `NOT_FOUND` | A well-formed ID that no operator has | `users.db.test.ts` "404: no operator has this ID" | yes |
| | 409 `LAST_ADMIN` | RB-8 | `users.db.test.ts` block "AC-B-21, RB-8" | yes |
| | 422 `INVALID_INPUT` | Body (`details.in: body`); a malformed ID (`details.in: params`); a credential-shaped reason | `users.db.test.ts`; `routes.test.ts` (10 cases) | yes |
| `enableUser` | 200 | A change; and already enabled (no row) | `status.db.test.ts` "200: a disabled operator is enabled …", "already enabled" | yes |
| | 400, 401, 403, 404, 422 | As above | `status.db.test.ts` "404, 422, 400, 401 and 403 …" (the block of operation 13); `routes.test.ts` | yes |
| `disableUser` | 200 | A change; without a session; and already disabled (no row) | `status.db.test.ts` block "AC-B-20, SR-12" | yes |
| | 400, 401, 403, 404, 422 | As above | `status.db.test.ts` "404, 422, 400, 401 and 403 …" (the block of AC-B-20); `routes.test.ts` | yes |
| | 409 `LAST_ADMIN` | RB-8 | `status.db.test.ts` block "AC-B-21, RB-8" | yes |
| Every write | 500 `INTERNAL_ERROR` | A statement of the unit is refused by the database | `failures.db.test.ts` | envelope |
| Every write | 503 `NOT_READY` | The database does not answer | `routes.test.ts` | envelope |

A malformed path ID answers 422 `INVALID_INPUT` with `details.in: params` (the contract documents
422 for an operation with a path parameter, contract C rule); a well-formed ID that no operator
has answers 404. Error precedence is that of spec §7.3: 401 and 403 (stage 6) before 400 and 422
(stage 7) before 404, then 409 (the unit).

**The role by operation** (the full matrix is W47's): SUPERVISOR allowed on all four;
INVESTIGATOR refused on `listUsers` and `enableUser`; TECHNICIAN refused on `listUsers`,
`assignUserRole` and `disableUser`; each refusal with the guard's one `ACCESS_DENIED` row.

## 11. Measured round trips for one command (M13)

`sequence.db.test.ts`, 20 calls of each, this host, PostgreSQL 18.4 on loopback, in-process
(`app.inject`). The times are of the run of 15:15:43, with other rows' tests on the machine (1-minute
load average about 9 to 12). On the quieter machine of 14:43:21 the
medians were 0.4 ms, 1.7 ms, 1.7 ms and 1.5 ms. The round trips are the same in every run; a unit
opens with 3 statements today (`BEGIN`, the chain lock, the time limit), and the test computes
the expected counts from the opening it observes, so a statement the core adds to an opening
changes the numbers below and not the test.

| Operation | Round trips | Of which | Median | Maximum |
|---|--:|---|--:|--:|
| `listUsers` | 2 | 1 of stage 4, 1 read | 1.5 ms | 2.5 ms |
| `assignUserRole`, a change | 16 | 1 of stage 4; the unit 10 (3 to open, 6 of its own, COMMIT); the mirror 5 | 6.2 ms | 18.4 ms |
| `disableUser`, a change, no open session | 17 | 1; the unit 11; the mirror 5 | 7.0 ms | 18.3 ms |
| `enableUser`, a change | 14 | 1; the unit 8; the mirror 5 | 5.4 ms | 20.4 ms |
| A refusal by the rule (409) | 7 | 1; the unit 6 (ROLLBACK) | - | - |
| A change that changes nothing | 7 | 1; the unit 6 | - | - |

## 12. Verification

### 12.1 The row's own tests (final state)

```
# npm run test -w @dems/core-server -- --maxWorkers=2 --reporter=verbose src/modules/admin   (15:15:39)   exit 0
 Test Files  3 passed (3)
      Tests  86 passed (86)
   Start at  15:15:40
   Duration  2.36s (transform 56%, import 32%, tests 11%)

# DEMS_TEST_STEP=55 npm run test:db -w @dems/core-server -- --maxWorkers=2 --reporter=verbose src/modules/admin   (15:15:42)   exit 0
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_55_tmdiy7i1_
[test:db] stale sweep: dropped 0; kept 11 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
 Test Files  6 passed (6)
      Tests  60 passed (60)
   Start at  15:15:43
   Duration  15.26s (tests 65%, import 23%, transform 12%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 3 database(s) in 1741 ms; 0 remain with the run prefix dems_test_step_55_tmdiy7i1_
```

What the `db` run printed (`implementation/assets/33_test_db_verbose.txt`; the timelines of section 4
are in the same file):

```
[w33] AC-B-79 free-running, two demotions: 25 rounds, 25 x (one 200, one 409 LAST_ADMIN); the first request won 21, the second 4; two successes: 0
[w33] AC-B-79 free-running, one demotion and one disable: 15 rounds, 15 x (one 200, one 409 LAST_ADMIN); the demotion won 8, the disable 7; two successes: 0
[w33] gated, two cross demotions: 10 rounds, 10 x (one 200, one 409 LAST_ADMIN); two successes: 0
[w33] two instances on one database, two demotions: 15 rounds, 15 x (one 200, one 409 LAST_ADMIN); the main instance won 8, the lane 7; two successes: 0
[w33] cost of listUsers: 2 round trips; median 1.5 ms, maximum 2.5 ms over 20 calls
[w33] cost of assignUserRole (a change): 16 round trips; median 6.2 ms, maximum 18.4 ms over 20 calls
[w33] a unit opens with 3 statements (BEGIN and the core's own)
[w33] cost of disableUser (a change, no open session): 17 round trips; median 7.0 ms, maximum 18.3 ms over 20 calls
[w33] cost of enableUser (a change): 14 round trips; median 5.4 ms, maximum 20.4 ms over 20 calls
[w33] bulk: 12 operators listed; enabled 9, disabled 3; SUPERVISOR 4 (enabled 3); open sessions 37; audit rows 5002
```

### 12.2 Whole projects, typecheck, lint (final state)

```
# npm run test -w @dems/core-server -- --maxWorkers=2   (15:20:44)   exit 0
 Test Files  102 passed (102)
      Tests  2659 passed (2659)
   Start at  15:20:45
   Duration  38.33s (import 56%, tests 38%, transform 5%)

# DEMS_TEST_STEP=55 npm run test:db -w @dems/core-server -- --maxWorkers=2   (15:21:23)   exit 0
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_55_tmdj7oux_
[test:db] stale sweep: dropped 0; kept 16 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
 Test Files  75 passed (75)
      Tests  1081 passed (1081)
   Start at  15:21:24
   Duration  161.60s (tests 86%, import 13%, transform 1%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 8 database(s) in 712 ms; 0 remain with the run prefix dems_test_step_55_tmdj7oux_

# npm run typecheck -w @dems/core-server   (15:24:06)   exit 0

# npm run lint -w @dems/core-server   (15:24:19)   exit 0
```

Lint printed no warning. `implementation/assets/33_final_runs.log` holds both passes.

### 12.3 The module gate (MODG)

The route list of the module and the registry operations it owns, printed by
`routes.test.ts` (15:15:40):

```
[w33] MODG routes of src/modules/admin:  GET /api/v1/admin/users listUsers | POST /api/v1/admin/users/:id/role assignUserRole | POST /api/v1/admin/users/:id/enable enableUser | POST /api/v1/admin/users/:id/disable disableUser
[w33] MODG registry, operations 11-14:   GET /api/v1/admin/users listUsers | POST /api/v1/admin/users/:id/role assignUserRole | POST /api/v1/admin/users/:id/enable enableUser | POST /api/v1/admin/users/:id/disable disableUser
```

| MODG item | Where |
|---|---|
| The route list equals the registry operations | Above; the test compares the two lists and holds every route against `matchCoreApiOperation` |
| Every documented status has a test; every answer validates against the contract | Section 10 |
| One allowed and one refused call per operation | Section 10, last paragraph |
| Typecheck and lint exit 0 without a warning | Section 12.2 |
| A mutation check of the module's own logic | Section 13 |
| M3: who may call is stage 6, only | `static.test.ts` block "rule 2 (M3)"; `routes.test.ts` "M3: no route carries a hook of its own", "the backstop behind the guard" |
| M14: an error is logged under `err` or not at all | The module's two log calls carry a code and a source only. `static.test.ts` "M14 …"; a failing statement in a unit (`failures.db.test.ts`) and a failing read (`routes.test.ts`) leave nothing of the statement, of the row the server quoted or of the reason in the answer, the log or the error log |

### 12.4 Every run of the whole projects, and what was not this row's (P11)

| Time | Run | Result | Not this row's |
|---|---|---|---|
| 14:58:27 | whole `unit` | exit 1: 101 files, 2 failed; 2,645 of 2,647 tests | `src/modules/storage/__tests__/routes.test.ts` and `projection.test.ts`, one test each: the storage row (W37) in flight |
| 15:16:00 | whole `unit` (first final pass) | exit 1: 101 files, 1 failed; 2,646 of 2,647 tests | `src/plugins/permission-guard/__tests__/guard.test.ts` "a route without an access rule and an audit rule stops the boot …" (line 186: the error-log entry it expects has a member `context.details` the entry did not have). The guard's production files `access-rules.ts`, `matrix.ts`, `index.ts` were written at 15:15 to 15:16 and this test file at 15:16: its owner's edit in flight |
| 15:16:39 | whole `db` (first final pass) | exit 1: 74 files, 1 failed; 1,072 of 1,073 tests | `src/modules/rbac/__tests__/matrix.db.test.ts` "reloadMatrix … takes a changed grant …": `STORED_GRANTS_MISMATCH: missing grant: INVESTIGATOR SESSION_NOTE`, a check the guard gained at 15:15; the test file was written at 15:17, during this run. The same edit in flight |
| 15:20:13, 15:20:16 | the two files alone | exit 0: 29 of 29; 28 of 28 | After the edit had ended |
| 15:20:45 | whole `unit` (second pass) | **exit 0**: 102 files, 2,659 tests | - |
| 15:21:24 | whole `db` (second pass) | **exit 0**: 75 files, 1,081 tests | - |

The whole `unit` project was run three times and the whole `db` project twice in all (decision D88: not in a loop).
In none of these runs did a test of this row's folder fail. Typecheck and lint of the workspace:
exit 0 and exit 0 at 14:26, 14:37, 14:48, 15:01, 15:03, 15:05, 15:08, 15:10, 15:12, 15:15 and
15:24; the times they were not are in finding F-8.

### 12.5 Test ledger (P24)

`@dems/core-server` only; no other workspace was touched, no existing test was changed.

| Project | Controller baseline (14:11) | Final (15:20:45, 15:21:24) | This row's files |
|---|---|---|---|
| `unit` | 77 files, 1,992 tests | 102 files, 2,659 tests | `src/modules/admin/__tests__/rule.test.ts`: **14**; `routes.test.ts`: **41**; `static.test.ts`: **31** (86 in 3 files) |
| `db` | 48 files, 740 tests | 75 files, 1,081 tests | `users.db.test.ts`: **18**; `status.db.test.ts`: **12**; `last-admin.db.test.ts`: **14**; `sequence.db.test.ts`: **12**; `failures.db.test.ts`: **2**; `bulk.db.test.ts`: **2** (60 in 6 files) |

The rest of the growth (22 `unit` files with 581 tests, 21 `db` files with 281 tests) is the other
module rows' and the guard row's, which landed in the same hour.

### 12.6 The verification list of the row

| Check of the row | Evidence |
|---|---|
| MODG (rule M11) | Section 12.3 |
| The same session gets 403 before and 2xx after a role change with no new sign-in | Section 8 |
| A disabled user's next request answers 401, the next sign-in the generic 401, and `USER_DISABLED` is written | Section 1 (AC-B-20); `status.db.test.ts` block "AC-B-20, SR-12" |
| Demoting or disabling the last enabled SUPERVISOR answers 409 `LAST_ADMIN` and changes nothing | Section 1 (AC-B-21); `users.db.test.ts`, `status.db.test.ts` blocks "AC-B-21, RB-8" |
| Two concurrent demotions of the two remaining holders give one 200 and one 409 `LAST_ADMIN` | Section 7 |
| `DEMS_TEST_STEP=55` for `test:db` | Every `db` command above; the run prefixes are `dems_test_step_55_…` |
| Whole `unit` and `db` projects at the end, with the ledger | Sections 12.2, 12.5 |
| Typecheck and lint exit 0 | Section 12.2 |
| No database of this row's prefix remains; `.locks/postgres.pid` 19121 | Section 19 |


## 13. Mutation check (M11)

92 planted defects in the four production files (`rule.ts` 7, `changes.ts` 43,
`statements.ts` 19, `index.ts` 23), each ONE text replaced
(`implementation/assets/33_mutations.json`). For every defect BOTH projects of the row's own
tests ran: the 3 `unit` files, and 5 of the 6 `db` files (all but `bulk.db.test.ts`, which pays a
template build). A defect counts as detected when at least one test fails.

**No file of the workspace tree was changed (rule M15, decision D88).** The harness is the
identity and guard rows': a Vitest configuration in the session's scratch folder, outside the
repository, that is the workspace's own configuration plus one transform, which hands the ONE
production file to the runner with the text replaced at load time
(`33_mutation_harness.vitest.config.mjs.txt`, `33_mutation_harness.run.py.txt`). The production
files of this row were last written at 14:27, before the run started.

Run of 14:52:08 to 15:14:22 (`implementation/assets/33_mutations.log`): baseline `unit` 86 of 86
and `db` 57 of 57 green; **92 of 92 detected**: 24 by both projects, 58 by the `db` project alone,
10 by the `unit` project alone.

**`rule.ts`** (7 of 7 detected)

| ID | Planted defect | `unit` | `db` |
|---|---|---|---|
| M01 | a DISABLED holder counts as an administrator | 5 of 86 fail: rule | 13 of 57 fail: last-admin, sequence, status, users |
| M02 | every enabled operator counts, whatever the role | 7 of 86 fail: rule | 22 of 57 fail: last-admin, sequence, status, users |
| M03 | the rule never refuses | 4 of 86 fail: rule | 22 of 57 fail: last-admin, sequence, status, users |
| M04 | the rule refuses while one administrator would stay | 6 of 86 fail: rule | 28 of 57 fail: failures, last-admin, sequence, status, users |
| M05 | a disable is not applied before counting: disabling the last administrator passes | 4 of 86 fail: rule | 11 of 57 fail: last-admin, sequence, status |
| M06 | a role change is not applied before counting: demoting the last administrator passes | 5 of 86 fail: rule | 12 of 57 fail: last-admin, sequence, users |
| M07 | the change is applied to every OTHER operator | 6 of 86 fail: rule | 36 of 57 fail: failures, last-admin, sequence, status, users |

**`changes.ts`** (43 of 43 detected)

| ID | Planted defect | `unit` | `db` |
|---|---|---|---|
| M08 | assignUserRole: an unknown operator is not refused with 404 | green | 2 of 57 fail: sequence, users |
| M09 | assignUserRole: the role the operator already has is written again (a row, a publication) | green | 2 of 57 fail: sequence, users |
| M10 | assignUserRole: the last-administrator rule is not asked | green | 12 of 57 fail: last-admin, sequence, users |
| M11 | assignUserRole: the write is sent BEFORE the rule is asked (the refusal then relies on the rollback) | green | 1 of 57 fail: sequence |
| M12 | assignUserRole: a refused change answers 200 unchanged instead of 409 | green | 12 of 57 fail: last-admin, sequence, users |
| M13 | assignUserRole: the old role is written | green | 15 of 57 fail: last-admin, sequence, users |
| M14 | ROLE_CHANGED names the target as the actor | green | 2 of 57 fail: users |
| M15 | ROLE_CHANGED drops the device of the caller's session | green | 1 of 57 fail: users |
| M16 | ROLE_CHANGED swaps the old and the new role | green | 4 of 57 fail: users |
| M17 | ROLE_CHANGED drops the reason | green | 1 of 57 fail: users |
| M18 | ROLE_CHANGED names the actor as the target | green | 2 of 57 fail: users |
| M19 | a role change does not publish session.updated | green | 2 of 57 fail: sequence, users |
| M20 | a role change does not publish admin.changed | green | 2 of 57 fail: sequence, users |
| M21 | a role change publishes admin.changed before session.updated | green | 2 of 57 fail: sequence, users |
| M22 | a role change publishes INSIDE the unit, before the commit | green | 2 of 57 fail: sequence, users |
| M23 | session.updated carries the OLD role | green | 1 of 57 fail: users |
| M24 | session.updated carries the permissions of the OLD role | green | 1 of 57 fail: users |
| M25 | a role change reports itself as unchanged: no publication, no mirror | green | 4 of 57 fail: last-admin, sequence, users |
| M26 | assignUserRole stamps a time that is not the server clock's | green | 1 of 57 fail: users |
| M27 | disableUser: an operator that is disabled already is disabled again | green | 2 of 57 fail: sequence, status |
| M28 | disableUser: the last-administrator rule is not asked | green | 11 of 57 fail: last-admin, sequence, status |
| M29 | disableUser: the write is sent BEFORE the rule is asked | green | 1 of 57 fail: sequence |
| M30 | disableUser: the sessions are not ended | green | 6 of 57 fail: failures, sequence, status |
| M31 | disableUser: the biometric tokens are not revoked | green | 5 of 57 fail: failures, sequence, status |
| M32 | USER_DISABLED does not count the sessions ended | green | 3 of 57 fail: failures, status |
| M33 | USER_DISABLED drops the reason | green | 2 of 57 fail: status |
| M34 | USER_DISABLED is written with the default severity | green | 1 of 57 fail: status |
| M35 | USER_DISABLED names the target as the actor | green | 1 of 57 fail: status |
| M36 | a disable does not publish session.ended | green | 3 of 57 fail: sequence, status |
| M37 | a disable publishes session.ended also when no session was ended | green | 1 of 57 fail: status |
| M38 | a disable does not publish admin.changed | green | 4 of 57 fail: sequence, status |
| M39 | a disable publishes INSIDE the unit, before the commit | green | 4 of 57 fail: sequence, status |
| M40 | enableUser: an unknown operator is not refused with 404 | green | 2 of 57 fail: sequence, status |
| M41 | enableUser: an operator that is enabled already is enabled again | green | 2 of 57 fail: sequence, status |
| M42 | USER_ENABLED has no actor | green | 1 of 57 fail: status |
| M43 | USER_ENABLED drops the reason | green | 1 of 57 fail: status |
| M44 | an enable does not publish admin.changed | green | 2 of 57 fail: sequence, status |
| M45 | enableUser: the flag is not written | green | 4 of 57 fail: sequence, status |
| M46 | an unknown operator answers 409 | green | 5 of 57 fail: sequence, status, users |
| M47 | the rule answers 409 INVALID_STATE, not LAST_ADMIN | green | 16 of 57 fail: last-admin, status, users |
| M48 | the rule answers 403 | green | 18 of 57 fail: last-admin, sequence, status, users |
| M49 | the rule protects the holders of another permission (the same roles in the seeded matrix) | green | 1 of 57 fail: users |
| M50 | the reason is stored changed | green | 4 of 57 fail: status, users |

**`statements.ts`** (19 of 19 detected)

| ID | Planted defect | `unit` | `db` |
|---|---|---|---|
| M51 | LOCK_OPERATORS takes no lock: the lock point of the rule is gone | 1 of 86 fail: static | 5 of 57 fail: last-admin |
| M52 | LOCK_OPERATORS takes a shared lock: two units pass the lock point together | 1 of 86 fail: static | 1 of 57 fail: last-admin |
| M53 | LOCK_OPERATORS locks in no stated order | 1 of 86 fail: static | green |
| M54 | LOCK_OPERATOR takes no lock | 1 of 86 fail: static | green |
| M55 | ASSIGN_ROLE expects any role but the one that was read | 1 of 86 fail: static | 19 of 57 fail: failures, last-admin, sequence, status, users |
| M56 | ASSIGN_ROLE does not stamp role_changed_at | 1 of 86 fail: static | 2 of 57 fail: failures, users |
| M57 | ASSIGN_ROLE does not stamp updated_at | 1 of 86 fail: static | 1 of 57 fail: users |
| M58 | DISABLE_OPERATOR is not compare-and-set | 1 of 86 fail: static | green |
| M59 | ENABLE_OPERATOR is not compare-and-set | 1 of 86 fail: static | green |
| M60 | REVOKE_BIOMETRIC_TOKENS also revokes tokens that were used | 1 of 86 fail: static | 1 of 57 fail: status |
| M61 | REVOKE_BIOMETRIC_TOKENS revokes the tokens of everybody else | 1 of 86 fail: static | 3 of 57 fail: failures, status |
| M62 | REVOKE_BIOMETRIC_TOKENS writes another reason | 1 of 86 fail: static | 3 of 58 fail: failures, status |
| M63 | LIST_USERS is not in operator ID order | 1 of 86 fail: static | 1 of 58 fail: users |
| M64 | activeSessions counts ended sessions too | 1 of 86 fail: static | 4 of 58 fail: status, users |
| M65 | activeSessions counts every operator's open sessions | green | 8 of 58 fail: status, users |
| M66 | READ_ROLES_HOLDING reads the roles that hold any OTHER permission | 1 of 86 fail: static | 22 of 58 fail: last-admin, sequence, status, users |
| M67 | READ_ROLE_PERMISSIONS is in reverse order | green | 2 of 58 fail: last-admin, users |
| M68 | lastSignInAt answers the time of the role change | 1 of 86 fail: routes | 3 of 58 fail: status, users |
| M69 | an AdminUser is always answered as enabled | green | 5 of 58 fail: status, users |

**`index.ts`** (23 of 23 detected)

| ID | Planted defect | `unit` | `db` |
|---|---|---|---|
| M70 | the engine is never asked to mirror the operators | green | 6 of 58 fail: last-admin, sequence, users |
| M71 | the engine is asked to mirror also when nothing changed | green | 3 of 58 fail: sequence |
| M72 | the two headers of API-7 are not set | green | 6 of 58 fail: status, users |
| M73 | the headers are taken BEFORE the mirror: the revision does not hold the operators slice | green | 1 of 58 fail: users |
| M74 | the two headers are swapped | green | 6 of 58 fail: status, users |
| M75 | a failed mirror fails the request although the change is committed | green | 1 of 58 fail: last-admin |
| M76 | a failed mirror is not logged | green | 1 of 58 fail: last-admin |
| M77 | a failed mirror is not written to the error log | green | 1 of 58 fail: last-admin |
| M78 | an empty reason is handed to the audit row | green | 1 of 58 fail: users |
| M79 | a reason in the form of a credential is not refused as input | 3 of 86 fail: routes | 1 of 58 fail: users |
| M80 | the backstop of a caller that is no operator is gone | 1 of 86 fail: routes | green |
| M81 | the actor loses the device of its session | green | 1 of 58 fail: users |
| M82 | the path parameter is not held against the registry's pattern | 4 of 86 fail: routes | 3 of 58 fail: status, users |
| M83 | assignUserRole validates its body with the wrong schema | 3 of 86 fail: routes | 23 of 58 fail: failures, last-admin, sequence, status, users |
| M84 | disableUser does not validate its body | 3 of 86 fail: routes | 2 of 58 fail: status |
| M85 | enableUser does not validate its path parameter | 2 of 86 fail: routes | 1 of 58 fail: status |
| M86 | the enable route disables | green | 8 of 58 fail: last-admin, sequence, status |
| M87 | the disable route enables | green | 17 of 58 fail: failures, last-admin, sequence, status |
| M88 | a failed read of the list does not tell readiness | 1 of 86 fail: routes | green |
| M89 | a failed read of the list answers 500 with the driver's error | 1 of 86 fail: routes | green |
| M90 | a failed read of the list is not logged | 1 of 86 fail: routes | green |
| M91 | a failed read of the list is not written to the error log | 1 of 86 fail: routes | green |
| M92 | M14: the driver's error is logged under the key `error` | 1 of 86 fail: routes | green |

Notes.

| Point | |
|---|---|
| Ten detected by the `unit` project alone | Six are about the failing read of the list and the backstop, which only the database-free tests can reach (M80, M88 to M92). Four are statement texts whose change makes no difference to an answer while the lock point holds: the order of the lock (M53: it matters for deadlock avoidance between two lockers), the lock of an enable (M54), and compare-and-set of the two flag updates (M58, M59: the second line of defence of AT-3 behind the lock). They are caught by the statement pins of `static.test.ts` |
| M54 after the run | The test "two enables of ONE operator" was added at 15:05 for it. Re-run at 15:14:30: detected by the `db` project as well (the server's enable does not wait and answers 500 instead of "already enabled") |
| M51, M52: the lock point | Without the lock (M51) five tests of group C fail: the unit does not wait and answers 200 where 409 is due. With a shared lock (M52) the test "two units at the lock point" fails: the unit reads the roles and tries to write before the lock is its own. Neither is seen by any test that runs in one process without a second writer: the serial pipeline hides them, which is why group C exists |
| M11, M29: the write before the rule | Behaviour is the same (the refusal rolls the write back). Detected by the timeline of the refusal alone: no write may have been sent |
| M49: another permission of the same roles | Not seen by any test on the seeded matrix. Detected by the test that grants `USER_ADMIN` to a second role in the stored matrix |
| The tests changed during the run | Between 15:03 and 15:10, while the run was at M51 to M76, four edits were made to test files only (the unit's opening as one line of a timeline; the two-enables test; wider time limits; a time bound for the gate helper), each followed by a green run of the edited files. Five mutations whose verdict could depend on them (M11, M29, M52, M54, M67) were run again at 15:14:30 against the final files: 5 of 5 detected (appended to the log) |
| Load | The run shared the machine with seven other rows (load average 12 to 16). A test that times out under load would look like a detection. The verdicts that rest on ONE test of the concurrency file are M52 and M54 (run again at 15:14:30 on the calmer machine: detected) and M76 and M77 (run at 15:11, after that file's time limits had been widened to 60 s) |


## 14. Other rows' tests

This row edited no file outside its folder.

| Files | State | Whose |
|---|---|---|
| `src/plugins/permission-guard/__tests__/guard.test.ts`, `src/plugins/permission-guard/__tests__/denial.db.test.ts`, `src/modules/rbac/__tests__/matrix.db.test.ts` | Red by design since module routes exist: they register STAND-IN routes for registry operations whose module did not exist yet (`listUsers` and `assignUserRole` of this row among them; Fastify refuses the second registration with `FST_ERR_DUPLICATED_ROUTE`), and one pins the list of registered routes. Decision D85: fixed by the guard row's owner in one patch; not to be edited or worked around by a module row | The RBAC guard row (W28) |

**State at this row's final runs: green.** The owner's fix was in the tree from about 14:49: the
three files import `without-domain-modules` first, which gives the guard's tests an app whose
domain modules register no route, so a stand-in never stands beside a real route (rule M10 as
extended by decision D87). `denial.db.test.ts` and the stand-in tests of the two other files
passed in every run of this row after that. The two reds of the first final pass (section 12.4)
were in two of these files but of another cause, the owner's next edit in flight; both files were
green alone at 15:20 and both whole projects exit 0 at 15:20:45 and 15:21:24. No condition is open.

What this row found before the controller's note, by reading (not by a run): the stand-ins are at
`guard.test.ts:178, 192, 283, 295, 371, 497, 561`, `denial.db.test.ts:56, 89, 93` and
`matrix.db.test.ts:79, 351`.

## 15. Requirement to test

| Requirement | Test |
|---|---|
| SR-12: a disable ends the session rows in the same transaction; the next request is refused | `status.db.test.ts` "a user with a web session, a device session and biometric tokens is disabled …"; `failures.db.test.ts` "ONE unit: the flag that was set and the sessions that were ended are taken back with it …"; `sequence.db.test.ts` (the sessions end between the flag and the row, before COMMIT) |
| SR-47: the last enabled holder cannot be demoted or disabled; one unit | `rule.test.ts`; `users.db.test.ts` and `status.db.test.ts` blocks "AC-B-21, RB-8"; `last-admin.db.test.ts` |
| SR-72, SD-04: atomic, compare-and-set, holds under concurrent requests | `last-admin.db.test.ts` (all four groups); `static.test.ts` "every transition is compare-and-set", "the lock point of RB-8 …"; `failures.db.test.ts` |
| AC-B-18 | `users.db.test.ts` block "AC-B-18, RB-3, SR-13" |
| AC-B-20, session and sign-in part | `status.db.test.ts` block "AC-B-20, SR-12". The socket part (close 4401 within 1 s) is W42's: the publication it acts on is asserted |
| AC-B-21 | `users.db.test.ts`, `status.db.test.ts` blocks "AC-B-21, RB-8"; `bulk.db.test.ts` |
| AC-B-79 | `last-admin.db.test.ts` group A (and B, C, D) |
| RB-3, SR-13: nothing about privilege is stored in the session | `users.db.test.ts` AC-B-18 (the session rows are unchanged by a role change) |
| ENG-3: the engine's `operators` slice equals the table | `users.db.test.ts` "200: the role is changed in one unit …" (the slice after the mirror) |
| API-7: the two headers | The 200 tests of all three writes (the revision before and after); refusals carry none |
| SR-54, SR-65: no secret and no caller-supplied actor or time in a row | `users.db.test.ts` "the actor of the row is the session …"; `routes.test.ts` (a credential-shaped reason is 422) |
| SR-48, SR-50, M14: nothing of a failed statement in the log or the answer | `failures.db.test.ts`; `routes.test.ts` "M14: a read that fails …"; `static.test.ts` "M14 …" |
| M3 | `static.test.ts` block "rule 2 (M3)"; `routes.test.ts` "M3: no route carries a hook of its own", "the backstop behind the guard" |

## 16. Findings

| ID | Finding | For |
|---|---|---|
| F-1 | **A request that is already past stage 6 runs although its operator was disabled or demoted meanwhile.** Authorisation is decided from what stage 4 read for that request; a unit that waits in the pipeline behind the unit that disables or demotes its caller still runs, and its row names that caller as the actor (truthfully). Rule M3 forbids a second check in the handler, and the identity row's activity hook closes the window only for a session whose last activity is older than its minimum interval. The window is one queue length (milliseconds). For this module the last-administrator rule still holds in that window: with two holders each disabling the other, the second unit is refused on the committed rows (tested, group B). With THREE holders, a holder who was just disabled could still demote a third one with a request sent before | Security review W45; code review W38. Not changed here |
| F-2 | **The bulk fixture's administration rows use other detail keys than spec §13.1.** `src/db/fixtures/identity.ts:272-291` writes `ROLE_CHANGED` with `{ operatorId, fromRole, toRole }` and `USER_DISABLED` / `USER_ENABLED` with `{ operatorId }`; the specification and this module write `{ targetOperatorId, from, to, reason? }`, `{ targetOperatorId, sessionsEnded, reason? }`, `{ targetOperatorId, reason? }`. The fixture inserts through the store, not through the audit writer, so the closed list did not refuse them. A client that renders these details from a `bulk` database meets two shapes | The bulk fixture's owner (implementation/25); the audit page rows (W39, W74) |
| F-3 | **The client specification expects a list hint this backend does not send.** `masterplan/04_client_integration_spec.md` §10.2 "Live update": `admin.changed` with `USERS` shows "a sign-in elsewhere (active sessions, last sign-in)". The identity module publishes nothing on a sign-in, a sign-out or an expiry (decision D78 DN-16), and this module cannot see them. `lastSignInAt` and `activeSessions` of the page are therefore as of its last fetch | The controller: either the identity module publishes `admin.changed USERS` after a sign-in, a sign-out and an expiry (one line in each `afterCommit`), or W77 refetches on focus and says so |
| F-4 | **The wait columns of `pg_stat_activity` are hidden from the helper role.** A test that looks for "a backend waits for a lock" as `dems_owner` sees NULL in `wait_event_type` for the server's backends (role `dems_app`): the first form of this row's test never saw the wait and timed out. The lock view works for every role: `pg_locks` joined to `pg_stat_activity` on `pid`, `WHERE datname = current_database() AND NOT granted` | Extends F63; the restart test W53 and the demo-control row W43, which poll for sessions |
| F-5 | **The disable revokes biometric tokens with a statement of this module** (`REVOKE_BIOMETRIC_TOKENS`), as database contract AT-C5 writes it. No seam offers it, and the biometric row (W41) has not landed. Tested with fixture rows of `biometric_tokens` | W41: may take the statement over behind a function that takes the caller's unit, as `sessionRegistry.endForOperator` does |
| F-6 | A self-disable's answer does not clear the session cookie (section 6) | W77: the page handles the 401 or `session.ended`; nothing to change here |
| F-7 | For `enableUser` and `disableUser` the mirror is a unit of 5 statements that never finds a difference: the `operators` slice has no `enabled` flag. It is called because decision D77 DN-10 and the brief ask for it after every unit that changed an operator | The controller may drop it for these two operations (5 round trips each) |
| F-8 | At 14:44, 14:46 and 14:51 the workspace typecheck failed in files of other rows in flight (`src/modules/devices/__tests__/status.test.ts`, `src/modules/pairing/__tests__/concurrency.db.test.ts`, `src/modules/pairing/__tests__/routes.test.ts`), and lint warned in `src/modules/pairing/__tests__/`, `src/modules/evidence/__tests__/` and `src/plugins/permission-guard/__tests__/guard.test.ts`: P11 noise, none in this row's folder. This row's own files were red for other rows between about 14:30 and 14:37 (one type error in `rule.test.ts`, one lint warning in `static.test.ts`), named by the controller and fixed at 14:37 | Record |
| F-9 | **Load.** With eight rows' runs on the machine (1-minute load average 12 to 16 between 14:58 and 15:10, this row's own mutation run among them) one test of this row, which takes 0.2 s on a quiet machine (the two instances of section 7: a clone, two apps, two sign-ins, 15 rounds), ran past Vitest's default limit of 5 s at 15:07:38 and passed when run again. The six `db` test files of this row now state their own limits (60 s for a test, 120 s for a hook); nothing else was changed for it | The controller's load guard (P9). Other rows' `db` tests that create a clone or boot an app inside a test body have the default limit |

## 17. Deviations from the row text

| ID | Deviation | Why |
|---|---|---|
| DV-1 | The audit type of a role change is `ROLE_CHANGED`, not `ROLE_ASSIGNED` | The brief offered both ("or as named there"); spec §13.1, the contract and the audit writer's closed list name `ROLE_CHANGED` |
| DV-2 | "§4.7 user and role administration" of the brief is spec §7.6 (the operations), §4.6 RB-8 (the rule) and §4.7 (what reaches the clients); the specification has no section of that name | Read by ID, as the brief asks |
| DV-3 | `admin.changed` with `USERS` is published after a disable as well | The table of spec §4.7 lists it for a role change and for an enable; the contract's example of the message says "a role changed, or a user was enabled or disabled", and the client specification §10.2 refetches on a disable. The list did change |
| DV-4 | The mutation check ran through a scratch Vitest configuration that hands ONE production file to the runner with ONE text replaced (the harness of W24 and W28), not by editing files | No other row's run ever saw a mutated file |
| DV-5 | `enableUser` locks its one row, not every operator row | It cannot take an administrator away, so it has no part in the rule; AT-C5 names the lock for the two operations the rule guards |

## 18. Decisions for the controller

| ID | Decision this row made | Alternative |
|---|---|---|
| DN-1 | A self-change is allowed unless it is the last administrator (section 6) | Refuse every self-change: the specification does not say so, and the client specification designs the warning |
| DN-2 | `admin.changed USERS` after all three changes (DV-3) | Only where the table of spec §4.7 lists it |
| DN-3 | A mirror that fails after the commit does not fail the request: 200 with the operator, one error line and one error-log entry. The change is committed; every later command of the engine mirrors the table before it runs, and a reload reads the table | Answer 503: the caller would retry and get "unchanged", with no row |
| DN-4 | A malformed operator ID is 422 `INVALID_INPUT` (`details.in: params`), a well-formed unknown one 404 | 404 for both |
| DN-5 | A reason in the form of a credential is 422 `INVALID_INPUT`, before any unit | Let the audit writer refuse it: 500 |
| DN-6 | Severities: `ROLE_CHANGED` INFO, `USER_ENABLED` INFO, `USER_DISABLED` WARNING (as the bulk fixture has them); the messages of section 4.5 | - |
| DN-7 | Neither 404 nor 409 `LAST_ADMIN` writes an audit row or takes a place in the denial budget | A row for a refused last-administrator change would need a type the specification does not have |
| DN-8 | The module revokes the biometric tokens itself (F-5) | Wait for W41 |
| DN-9 | No password operation exists (row rule 4) | - |
| DN-10 | `activeSessions` counts session rows that are not ended (section 9) | Leave out sessions past a limit: needs the identity module's limits |
| DN-11 | The order of the publications: `session.updated`, then `admin.changed` (section 9) | - |
| DN-12 | The headers of API-7 are read from `app.engine` AFTER the mirror, so the revision holds the `operators` slice of a role change | Before the mirror: the client would settle one delta early |

## 19. End state and cleanup

At 15:24:28 (a scratch script outside the repository, as `dems_owner`, through the test helper's
own reader of the connection file; it prints names and counts;
`implementation/assets/33_end_state.mts.txt`):

```
session: role=dems_owner server=18.4 port=4432 postmaster started 2026-10-04 07:14:26.046351+07
databases with this row's prefix (dems_test_step_55_*): 0
test databases of all rows at this moment: 24
project databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3
sessions on this row's databases still open: 0
```

- `.locks/postgres.pid`: 19121, the process started 07:14:26, as before. PostgreSQL was never
  stopped or reconfigured. Nothing connected as the bootstrap superuser.
- `dems_demo` and the lane databases were never connected to by this row: every test ran on a
  clone of the helper (`DEMS_TEST_STEP=55`); the further clone of the two-instances test is dropped
  with its file. The 24 test databases at that moment are other rows' runs in flight.
- No port was bound and no process of this row is left: the one background command (the mutation
  run) and its monitor ended by themselves. `apps/core-server/logs/` does not exist.
- `git diff --stat acaff20 -- apps/mock-core release scripts/release` prints nothing.
- Scratch files (the mutation harness, the runner outputs, two helper scripts) are under the
  session's scratchpad, outside the repository. What is evidence is kept as text under
  `implementation/assets/33_*`.
- Constraints added by the failure tests (`w33_refuse_role_change`, `w33_refuse_revoke`) existed
  only on that file's clone and are dropped by the test itself, before the clone is dropped.

## 20. Rollback (R-NEW; not executed)

The folder is new except for the scaffold's stub.

```sh
# from /Users/gsp-budi/Documents/DEMS
# 1. the stub back in place of the module's index.ts
cp -p .cache/rollback/W33.admin-index.ts.pre apps/core-server/src/modules/admin/index.ts
# 2. the row's other files: move them out of the tree (no rm outside $TMPDIR)
mkdir -p "$TMPDIR/w33_rollback" && mv apps/core-server/src/modules/admin/changes.ts apps/core-server/src/modules/admin/rule.ts \
  apps/core-server/src/modules/admin/statements.ts apps/core-server/src/modules/admin/__tests__ "$TMPDIR/w33_rollback/"
# 3. the documents of the row: implementation/33_user_role_admin.md, implementation/assets/33_*,
#    delegation_progress/coder_execution_step_55.md
```

After the rollback the three test files of section 14 need their stand-ins for `listUsers` and
`assignUserRole` again (whatever form the owner's fix of decision D85 gave them). No database
object was created or changed: the module uses tables, columns and privileges of the first
migration set.

## 21. Assets

| File | Content |
|---|---|
| `implementation/assets/33_test_unit_verbose.txt` | The verbose run of the 3 `unit` files |
| `implementation/assets/33_test_db_verbose.txt` | The verbose run of the 6 `db` files: the timelines, the costs, the counts of the concurrency rounds |
| `implementation/assets/33_mutations.json`, `33_mutations.log` | The planted defects and the result of each |
| `implementation/assets/33_mutation_harness.run.py.txt`, `33_mutation_harness.vitest.config.mjs.txt` | The harness |
| `implementation/assets/33_final_runs.log` | The final runs: both passes of the whole projects, the row's tests, typecheck, lint, the end state |
| `implementation/assets/33_end_state.mts.txt` | The scratch script that read the end state |
