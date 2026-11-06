---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: 214
package: M11 | X2-3 (gate of row 215)
date: 2026-10-13
agent: test-expert (R11, batch 9)
tier: 2
status: complete
requirements: SX-02 (H2) yes; SX-03 yes; H3 yes; facts for SX-01, SX-11, SX-19
---

# Row 214 - gate probe for `operator:set-password`: H2, H3 and the grants

Branch `task4/input-av-core-port`, working tree on top of `0f5d2a8e` with the uncommitted edits of batch 9. No product file was written. Every `path:line` below was read on 2026-10-13 in that tree; paths are relative to `apps/core-server/` unless they start with `packages/` or `scripts/`.

## 1. Answers

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | SX-02 / H2: can a host command, with the Core stopped, write its audit row ONLY through the existing unit of work and audit writer, on a pool of its own, with the chain intact? | **YES** | section 3, test steps 1 to 3: `5 passed (5)` |
| 2 | Negative control: does the Core's verification notice the same row written by plain SQL with a digest of the command's own making? | **YES, it reports the break** (H2 does not fail) | section 4 |
| 3 | SX-03: does the runtime role `dems_app` hold everything the command needs, in every migration up to the current one (0020, schema version 9, `dbc-10`)? | **YES. No grant is missing; nothing forces the owner role** | section 5 |
| 4 | H3: can the identity module's session end and token revocation be called from a command? | **YES**, with one type-level note for row 215 | section 6 |
| 5 | SX-01: can the command know the Core is stopped, and ask again inside each transaction? | **Only by the sessions of the database** (`pg_stat_activity`); the Core holds no lock, no pid file and no advisory lock | section 7 |
| 6 | Does replacing a stored credential end existing sessions today? | **NO**: an explicit step in the same unit is needed | section 8 |
| 7 | NEW FACT for row 215: the command needs the clock floor of decision D110 | A host clock behind the stored state makes the session end fail (rolled back, fails closed) | section 9 |

Row 215 may start on this row's side: H2 yes, H3 yes, four grants cited. No request to row 202 (no grant is missing).

## 2. What the writer and the unit of work depend on (read, then proven)

| Part | Needs | Does NOT need | Source |
|---|---|---|---|
| `createPipeline` | `pool: () => Pool`, `clock`, `log`, `errorLog`; optional `onDatabaseFailure`, `onConnectionLost`, `limits` | the Fastify app, the engine, the realtime hub, the configuration object, readiness, any lock of a lane | `src/core/pipeline.ts:72-91`, `:108-112` |
| `UnitState` (the transaction) | the pool function and a statement limit | anything else | `src/core/unit-of-work.ts:98-103`, `:213-241` |
| `createUnitAuditWriter` | the unit's state, `clock`, `log`, `errorLog` | anything else | `src/core/audit-writer.ts:93-97`, `:219-221` |
| The app's wiring | `corePlugin` only passes `app.db.pool`, `app.clock`, `app.log`, `app.errorLog` and two readiness callbacks | - | `src/core/index.ts:119-146` |
| The runtime pool | the five connection fields; no app | - | `src/plugins/db/index.ts:136-149` |
| The Core's connection file | `readConnectionFile(file)` is a function of a path; `loadConfig` calls it for `<data dir>/pg.env` | - | `src/plugins/config/connection-file.ts:52`; `src/plugins/config/load-config.ts:95-96`; `src/config.ts` symbols `RUNTIME_ROLE`, `CONNECTION_FILE_NAME`, `CONNECTION_FILE_KEYS` (at `:129-140` today; row 105 is editing that file, cite by symbol) |
| The Core's own chain verification | `createStoredChainVerifier({ chain, log, errorLog })` and a pool | the app (the module passes the engine's epoch as the chain name; a constant does) | `src/modules/security-audit/stored-chain.ts:90-104`, `:152`, `:268-301` |

What the unit does by itself, so the command writes none of it: `BEGIN ISOLATION LEVEL READ COMMITTED`, the chain lock as the first statement, the statement limit and the pinned search path, `COMMIT` (`unit-of-work.ts:55-62`). The row is built by the shared `appendAudit` and inserted by the writer (`audit-writer.ts:275-289`). A statement of the unit's USER that inserts into `audit_log` is refused before it is sent (`unit-of-work.ts:90-96`, `:262-276`) - proven in step 2.

The digest is not checked by the database: the guard compares sequence and previous hash only (`src/db/migrations/0002_audit_guards.sql:40-44`; `audit-writer.ts:184-185`).

## 3. The harness and the test (row 215 can reuse both)

| File | What |
|---|---|
| `apps/core-server/test/support/host-command-unit.ts` (new, 114 lines) | `openHostCommandUnit(connection, { clock? })` returns `{ pool, pipeline, logLines, errorEntries, verifyStoredChain(), close() }`. It builds `createRuntimePool(connection)`, `createSystemClock()` (or the given clock), a recording log and a recording error log, hands them to the Core's own `createPipeline`, and offers the Core's own stored-chain check on that pool. It imports no app factory (asserted by the test). |
| `apps/core-server/test/support/host-command-unit.db.test.ts` (new, project `db`) | five tests on throw-away clones of the seed, connected as `dems_app` |

How row 215 reuses it: its command builds the same four things (pool, clock, log, error log) and calls `pipeline.run('<label>', async (unit) => { ... })`; its database test opens the harness for the verification half (`verifyStoredChain()`), or copies steps 1 to 3 with the command in the place of step 2. The log and the error log of the harness are doubles; the command needs real ones (`createErrorLog(file | null)` of `src/plugins/logger/error-log.ts:183` takes no app; `pino` is not a direct dependency of the workspace - row 215 decides).

| Test | Proves | Result |
|---|---|---|
| step 1 (`:140`) | a real Core boots on the clone, the Supervisor signs in with the seeded credential, the chain verifies, the Core stops | pass |
| step 2 (`:152`) | no app: inside ONE unit, as `dems_app` (not owner, not superuser), the other sessions are asked (none), the credential row is replaced (1 row) with the hash of a value made from `randomBytes` in the run, `endSessionsOfOperator` ends 1 session, `revokeBiometricTokens` runs (0 rows on the seed), `unit.audit.append` writes one row of the existing type `USER_DISABLED` (category SECURITY, severity WARNING, actor null). Then `verifyStoredChain()` answers `{ ok: true, checked: <that seq>, firstBadSeq: null }` and the shared `verifyAuditChain` over all stored rows is ok. A direct `INSERT INTO audit_log` through `unit.query` is refused (`UNIT_STATEMENT_NOT_ALLOWED`) and the head does not move. The value, its salt and its tag are in no log line, no error entry and not in the row | pass |
| step 3 (`:261`) | a Core boots on that database: B-8 logs `the stored audit chain verifies` with `lastSeq` = the command's row and no boot check fails; the session of step 1 answers 401; operation `verifyAuditChain` answers `view.ok` and `stored.ok` with `firstBadSeq: null`; the seeded credential answers 401 and the synthetic one 200; the Core appends further rows and the chain still verifies | pass |
| negative control (`:299`) | section 4 | pass |
| grants (`:364`) | section 5 | pass |

Command, from the repository root, sandbox off:

```
/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock sh -c 'cd apps/core-server && npx vitest run --project db test/support/host-command-unit.db.test.ts --maxWorkers=2 --reporter=verbose'
```

Result lines of the last run (10:53:49): `Test Files  1 passed (1)`, `Tests  5 passed (5)`, `[test:db] teardown: dropped 2 database(s) in 95 ms; 0 remain with the run prefix dems_test_local_tmtutp7z_`. PostgreSQL 18.4 on 127.0.0.1:4432; templates built from the migrations on disk (0000 to 0020).

Also run: `npx vitest run --project unit test/static src/core/__tests__/static.test.ts --maxWorkers=2`: `Test Files  17 passed (17)`, `Tests  189 passed (189)`. `npx tsc --noEmit` in `apps/core-server`: no error in the two new files; one error left in the tree, not this row's (`src/capture/__tests__/supervisor.test.ts:1069`, `maxRestarts`: row 191 is editing the supervisor).

Run history, stated because it is more than "one run": four runs. Run 1 failed on another row's edit in flight (`ReferenceError: hostChecks is not defined`, `src/capture/boot/index.ts:367`, row 85 - gone a minute later) and on a leak of this test (an app whose boot failed was not closed). Run 2 failed in this row's own test and that failure is the fact of section 9. Run 3 green. Run 4 after two static rules that the new test file tripped (`test/static/imports.test.ts`: test support imports no `__tests__` folder; `test/static/audit-protection.test.ts` T-AO-4: no file writes a statement that switches a trigger off) - both corrected in the test, green.

What the review left "not verified" in F2-2, now closed:

- The engine expects no `events` row and no counter beside a server-native audit row: the Core of step 3 reloads and both halves of `verifyAuditChain` are ok.
- `at` along the chain: see section 9.

## 4. Negative control: the same row by plain SQL

On a clone of its own (dropped when the case ends), as `dems_app`: `BEGIN`, `audit_chain_lock()`, one hand-written `INSERT` with the right sequence, identifier and previous hash and a SHA-256 of the command's own serialisation as `hash`, `COMMIT`.

| Observation | Result |
|---|---|
| The database | ACCEPTS the row (`rowCount` 1) and moves the head to it: the digest is not checked (GD-01, as the review said) |
| The Core's stored-chain check, without an app | `{ ok: false, firstBadSeq: <that seq>, checked: <that seq> - 1 }`; the shared check over all rows: not ok |
| A Core started on that database | STARTS (boot check B-8 is a reported check, `src/core/boot-checks.ts:80-104`, text at `:97`); one log line with code `STORED_CHAIN_NOT_VERIFIED`; operation `verifyAuditChain` answers `stored.ok: false` with the same `firstBadSeq`; rows the Core appends afterwards do not mend it |

So H2's negative half holds: verification notices. Two facts of the existing product follow, neither a new defect (both are the design as built) and both reasons why SX-02 stands as written:

1. Such a row is permanent. The table is append-only for every role (`0002_audit_guards.sql:56-69`), so a wrong digest can never be corrected; the installation's audit chain reports a break from that row on, for ever.
2. A Core with a broken stored chain still starts and serves; the break is visible only to whoever asks `verifyAuditChain` or reads the log.

## 5. SX-03: the grants of the runtime role

| Need of the command | Grant | Later migrations |
|---|---|---|
| UPDATE of the seven credential columns | `src/db/migrations/0003_privileges.sql:31` | untouched |
| SELECT of `operator_credentials` (the walk's predicate reads the stored sets), of `operators` | `0003_privileges.sql:17` | untouched |
| UPDATE of `ended_at`, `end_reason` on `auth_sessions` | `0003_privileges.sql:33` | 0019 replaces the CHECK only; `0020_credential_replaced_reason_privileges.sql:9-14` writes no grant and says why |
| UPDATE of `revoked_at`, `revoke_reason` on `biometric_tokens` | `0003_privileges.sql:41` | as above |
| INSERT into `audit_log` | `0003_privileges.sql:20-24` | untouched |
| EXECUTE on `audit_chain_lock()` | `0003_privileges.sql:66` (the function: `0002_audit_guards.sql:14-23`, SECURITY DEFINER) | untouched |

"Untouched" by reading: every `REVOKE` of `0004` to `0020` names another table (`grep -n REVOKE src/db/migrations/*.sql`: `capture_device_credentials`, `stt_config`, `session_stt_config`, `core_media_store`, `alerts`, `capture_device_streams`, `capture_audio_inputs`, `session_capture_sources`, `capture_devices`, `evidence_items`, `capture_network_config`, `host_network_aliases`, and two functions of their own). And by the catalog of a database migrated to 0020, asked as `dems_app` (test `:364`):

| Held | Not held |
|---|---|
| the seven credential columns (UPDATE), `operator_credentials` SELECT, the two session columns, the two token columns, `audit_log` INSERT, `audit_chain_lock()` EXECUTE, `operators` SELECT | superuser; ownership of any table of `public` (0 tables), hence no trigger change and no DDL; `CREATE` on the schema; `operator_credentials` INSERT, DELETE, UPDATE of `operator_id`; `audit_log` UPDATE, DELETE; UPDATE of `audit_chain_head`; `operators` INSERT, DELETE, UPDATE of `username` |

An INSERT of a credential as `dems_app` answers 42501 (SX-11 is held by the database too). Every statement of step 2 ran as `dems_app` (`current_user` read inside the unit). **Missing grants: none. Request to row 202: none.**

Not exercised: reading `<data dir>/pg.env` itself. The test takes the runtime connection from the test helper (which reads that file); this agent opened no credential file (SECRETS rule). That `readConnectionFile` needs no app is shown by its source only. DRIVER DECISION, for the controller to confirm.

## 6. H3: the identity module's functions from a command

| Function | Callable on the command's unit? | Note for row 215 |
|---|---|---|
| `endSessionsOfOperator(db, operatorId, now, reason)` | YES: it takes any `Queryable`, and the pipeline's `unit` is one (`src/modules/identity/session-store.ts:24-29`, `:209-210`, `:218-220`). Used in step 2 | its `reason` is the whole `SessionEndReason`, so `CREDENTIAL_REPLACED` is accepted since row 202 (`src/db/schema/value-sets.ts:112-122`) |
| `revokeBiometricTokens(unit, { scope: 'OPERATOR', operatorId, reason }, now)` | YES: it takes the unit handle of the pipeline (`src/modules/identity/biometric/store.ts:212-214`). Used in step 2 | **type only**: the `OPERATOR` scope admits the reason `USER_DISABLED` alone (`store.ts:172`). Row 215 widens that one type to `CREDENTIAL_REPLACED` (a product file of the identity module: declare it), or sends the exported statement `REVOKE_TOKENS.OPERATOR` (`store.ts:183`) through `unit.query` |
| `app.sessionRegistry.endForOperator` | NO: it is a seam of the app and publishes to the realtime channel (`src/modules/identity/sessions.ts:79`, `:87-109`, `:290`) | not needed: the Core is stopped, there is nobody to publish to |

The probe used the reason `USER_DISABLED` for both, an existing value: the value `CREDENTIAL_REPLACED` and its CHECK are row 202's proof, not this one's.

One more fact: the unit's watchdog is 5 s (`src/core/limits.ts:31`) and the chain lock is held from the unit's first statement. `hashPassword` (Argon2id, 19 MiB) is called BEFORE the unit in the probe; row 215 should do the same, and never prompt inside a unit.

## 7. SX-01: how the command knows the Core is stopped

| Candidate | Exists today? | Evidence |
|---|---|---|
| A lock or a mark the running Core holds in the database | NO. The only advisory lock of the server is the reset's own | `src/db/reset/routine.ts:121-122`; `grep -rn advisory src` (the other hits are capture "advisory notices") |
| A pid file or a single-instance lock written by the Core | NO. `src/index.ts` listens (`:125`) and writes none. The files `.locks/core-server*.pid` and `*.lock` are the lane script's, a development tool; it decides "running" by the port's listener | `scripts/lane/lane.sh:156`, `:276`, `:329-330`, `:365-366` |
| What keeps two Cores off one database | the rule "the database follows the port" and the port bind, nothing in the database | `src/config.ts` `databaseNameFor` (`:143` today) |
| The sessions of the database | YES, and it is the only test: the reset's statement counts client sessions per role without its own backend | `src/db/reset/routine.ts:129-131`, `:583-590` |

Proven in step 2, as `dems_app`, INSIDE a unit (so after the chain lock, which is what SX-01 asks): with nobody else connected the answer is empty; with one more `dems_app` connection (the stand-in for a Core that started meanwhile) it is `{ dems_app: 1 }`; with a `dems_owner` connection too it is `{ dems_app: 1, dems_owner: 1 }`. So the runtime role sees the sessions of every role, and `pid <> pg_backend_pid()` leaves the command itself out. Statement used: `SELECT usename, count(*) FROM pg_stat_activity WHERE datname = current_database() AND usename IS NOT NULL AND pid <> pg_backend_pid() GROUP BY 1`.

For row 215:

- The command's own pool must not count against itself. The pipeline runs one unit at a time on one connection and the pool reuses its idle connection, so the harness showed no session of its own; a command that opens a second connection (a pre-check on the pool while a unit is open, a second pool) would see itself. One pool, statements one after another.
- The test sees connections, not a process (review F2-1). By reading, not by test: a LISTENING Core asks the pool every 5 s (the session sweep: `src/modules/identity/limits.ts:31`, `src/modules/identity/sessions.ts:310-314`) and the driver closes an idle connection after 10 s (`node_modules/pg-pool/index.js:98-99`; `createRuntimePool` sets no other value), so a running Core holds at least one connection in steady state. HYPOTHESIS until someone measures it; the refusal text and the runbook must still say "connections".
- A Core started during the run is not harmed in its chain: every unit of both processes queues at the head row. It fails its next engine unit with `AUDIT_HEAD_DIVERGED` and reloads (review, section 4.1).

## 8. Does replacing a credential end sessions today?

NO. The only writer of a credential after the seed is the re-hash after a successful sign-in: one compare-and-set UPDATE, no session touched (`src/modules/identity/session-store.ts:387-389`; called at `src/modules/identity/sign-in.ts:276`). No trigger exists on `operator_credentials` (the only triggers of the schema are the three of `0002_audit_guards.sql:50-52`, `:67-69`, `:84-86`). The expiry sweep ends sessions by time only (`session-store.ts:238-241`).

So the command ends them itself, in the same unit, with `endSessionsOfOperator` and the token revocation of section 6. That it works is step 3: the session opened before the command answers 401 on the next Core, because a session is looked up in the database for each request.

## 9. New fact: the clock floor (decision D110)

A Core that starts raises the floor of its clock to the newest stored instant, inside its first unit, "so that a session issued in the future can be ended" (`src/engine/host.ts:969-984`; the instant: `src/engine/rehydrate.ts:80-91`, `:100`, `:151`; the clock: `src/core/clock.ts:67`, `:127-134`). A host command has no engine, so nothing does that for it.

Proven in step 2 with a host clock one hour behind the stored state (the system time set back while the Core was down):

| Case | Result |
|---|---|
| Without the floor | `endSessionsOfOperator` is refused by the database: SQLSTATE 23514, constraint `auth_sessions_times_check` (`ended_at >= issued_at`, `src/db/migrations/0001_tables.sql:69`). The pipeline rolls the unit back: the credential is unchanged and the chain head did not move. Fails closed |
| With the floor, read and raised inside the unit: `raiseClockFloor(clock, await readNewestStoredInstant(unit))`, then `clock.now()` | the unit commits; the audit row's `at` is the floor, not older than its predecessor |

For row 215: build the clock with `createSystemClock()` (it has a floor), and make the two calls above the first thing of every unit, before anything reads the time. This also answers the review's open point on F2-2 ("does any reader need `at` to be non-decreasing"): the Core keeps one time base by D110, the database enforces part of it on the session table, and the command keeps it the same way. Whether the chain check itself would accept an older row was not tested, because with the floor it does not arise.

## 10. Doubles, limits, what stays unproven

- The database is this Mac's local PostgreSQL 18.4, throw-away clones only (`dems_test_local_*`), under `.locks/db-migrate.lock`; the demo and lane databases were not touched. "0 remain" after each run.
- The "Core" of steps 1 and 3 is the real app factory in-process (`buildApp` through `test/support/engine.ts`), simulated capture, not a listening process and not `REAL_PRODUCTION`. A production start after the command (checks 4, 4b, 4c) is row 215's and X-G's proof.
- The stand-in for a running Core in the SX-01 check is one extra connection.
- The one credential of the test is 24 random bytes as text, made per run, never printed; no password literal is in the two files. The seeded credential is used through the existing helper `webSignIn`, by import only.
- Not built: the command, the prompt, the policy, the audit type `OPERATOR_PASSWORD_SET` (row 201; the probe row has the type `USER_DISABLED` because the cell says an existing type).
- Edit rule kept: the two code files are new (Write, then Edit on them); the only existing file edited is `delegation_progress/file_claims.md`, with the Edit tool, one appended line.

## 11. Files

- New: `apps/core-server/test/support/host-command-unit.ts`, `apps/core-server/test/support/host-command-unit.db.test.ts`.
- New: this record; `delegation_progress/row_214.md`.
- Changed: `delegation_progress/file_claims.md` (one line). No line in `file_requests.md`.

---
*Generated: 2026-10-13*
