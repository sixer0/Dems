---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 65
plan_row: W43
title: Demo-control module, operations 71 to 75 (demo status, scenario load, fault injection and clearing, reset)
date: 2026-10-04
agent: coder-execution (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
source_spec: masterplan/01_specs.md rev 2.2 (§7.2, §7.3, §7.16, §7.17, §12, SR-57 to SR-59, SR-68, AC-B-56, AC-B-57, AC-B-72); masterplan/03_database_contract.md rev 2.2 (§7.1 HC-1 to HC-5, §8.5); implementation/29_db_reset_routine.md §11, §21; implementation/26_engine_host.md §10; implementation/28_rbac_guard_pipeline.md §3, §5; gateway_check/01_gate_report.md, standing rules M1 to M15; controller note of 15:56 (decision D95)
evidence_tier: 3
status: complete; gate PASS (decision D101); follow-up of D101 done (section 21); one pending test for the engine's owner (finding F-5)
---

# W43: the demo-control module, operations 71 to 75

All times are WIB (UTC+7) on 2026-10-04. Every command ran from `/Users/gsp-budi/Documents/DEMS`;
the session never changed into a subfolder. Database commands ran with the per-command sandbox
bypass (P10). Quoted runner output is unchanged except that the sandbox's certificate warning
lines are left out. Evidence files are in `implementation/assets/43_*` (15 files).

**No password, token, cookie value, hash or other credential appears in this document.** The demo
password is used through its constant only; a session cookie is taken from an answer and handed
on in a header. The connection files under `.data/` were not printed, copied, moved, renamed or
changed in mode by this row, and no code of this row parses one. Who reads them in this row's
runs: the reset routine (at R-0), the test helper, and `maintenancePool` of the reset row's test
support, which this row's database tests call for a maintenance connection (the advisory lock,
`pg_database`, `pg_stat_activity`), as the engine row's reset test does (section 7).

**Which databases were reset.** Only databases the test helper created for this row's own runs
(`dems_test_step_65_*`, `dems_test_step_65m_*`). `dems_demo` and the three lanes were named by no
test, no command and no mutation of this row; `db:status` of `dems_demo` is the same 45 lines
before and after (section 17).

## 1. Result

| Item | Result |
|---|---|
| Row command `DEMS_TEST_STEP=65 npm run test:db -w @dems/core-server -- src/modules/demo` | **Exit 0**: 4 files, 40 tests, 0 failed; `0 remain with the run prefix` (16:37:34; section 11.1) |
| Row tests, `unit` (5 files of the folder) | **Exit 0**: 5 files, 141 tests (16:37:31; in the whole project at 16:25:21) |
| Route list of the module | Equals registry operations 71 to 75, five routes, both lists printed by a test (section 11.2) |
| Demo flag off (AC-B-56) | SUPERVISOR: 403 `DEMO_DISABLED` on all five, no row, one log line each. INVESTIGATOR and TECHNICIAN: 403 `NOT_PERMITTED` on all five, exactly one `ACCESS_DENIED` row per call naming operation, permission and role. No handler ran: the routine was never asked |
| The owner file unreadable (AC-B-72) | A server whose data directory holds an unreadable file of that name (mode 000, a scratch directory of the test) **boots and runs** with the flag off. With the flag on, a reset answers 503, the routine's code is `RESET_OWNER_CREDENTIALS` at R-0, nothing was stopped, the next command works |
| Roles (AC-B-72, SR-58, SR-68) | The pool reports `dems_app`, `rolsuper` false, before and after a reset (pool generation 1 and 2). At the 16 checkpoints after R-0, every connection the server lists for the routine is `dems_owner (superuser false)`, on `postgres` or on `<t>_next`; none is left after the answer |
| `AUDIT_TAMPER` (SR-59, AC-B-57) | The view breaks: the shared check on the engine's ring reports `{ ok: false, reason: HASH_MISMATCH }` at the altered row. The stored chain is intact: every stored row is byte-equal to before, `checkStoredChain` reports `ok`, `digests: ok`, 0 link breaks. Clearing the fault restores the view |
| `resetDemo` (AC-B-57) | 16 of 16 domain tables equal a fresh seed for the same instant and epoch; six kept tables byte-equal by dump and checksum, four of five pairing codes byte-equal and the ACTIVE one `CANCELLED` (closed by the caller at the reset's instant), `audit_chain_history` 0 → 1 row; the epoch is previous + 1 in the routine's report, in `core_state`, in the engine and in the answer; one publication `cause: 'start'` with the new epoch on the seam `app.publish` |
| The actor and the session | The operator of the request is the routine's actor (the `SCENARIO_LOADED` row, the lineage row, the closed code). The same request is answered 200 on the rebuilt database; the caller's session and every other open session are the rows they were |
| The order of a reset | Asserted three ways: on a recording host (unit, 45 tests), through the server's own wiring (unit), and from the booted server's own log lines against the routine's 17 checkpoints (database). Section 5 |
| The failure table of the caller | 11 rows, each with a test (section 6). After every failure but one the next command works; after a failed resume the server does **not** serve again (decision D95) |
| Whole `unit` project (final) | **Exit 0**: 134 files, 3,503 tests (16:25:21) |
| Whole `db` project (final, `DEMS_TEST_STEP=65`) | **Exit 1**: 100 files, 99 passed; **1,477 tests passed, 0 failed**; one hook time-out in `src/realtime/__tests__/upgrade.db.test.ts`, a file of the realtime row in flight; that file alone: exit 0, 64 tests (16:31:15). Section 11.4 |
| Typecheck, lint (final) | Exit 0 (16:37:20); exit 0 with three warnings, all in files of the realtime row (16:37:30). Every run: section 11.5 |
| Mutation check | **82 of 82** planted defects detected (77 by `unit`, 5 by `db`), through a transform of a runner configuration outside the source tree; no file of the workspace was changed (section 13) |
| Gaps | `CONTRACT-GAP-W43-1` (the `details.reason` of the 503; text in section 14). No `SCHEMA-GAP`, no `SIM-GAP`, no `BE-GAP` |
| PostgreSQL | Never stopped or reconfigured: `.locks/postgres.pid` is 19121, started 07:14:26. No database of this row remains (section 17) |

## 2. What was written

All under `apps/core-server/src/modules/demo/`, the row's one owned path. Five production files
(845 lines), nine test files and one test-support file (3,790 lines).

| File | Lines | Content |
|---|--:|---|
| `index.ts` | 222 | The unit `demoModule`: five routes, each built from its registry entry with `routeOfOperation`; `demoControl(app)`, the test control. Replaces the scaffold's stub and keeps its export |
| `operations.ts` | 42 | The five operation IDs; the reason a reset tells the routine per operation; `operationOf` |
| `status.ts` | 68 | Operation 71: the one read statement, the stored seed facts, the pure mapping to `DemoStatus` |
| `reset.ts` | 389 | The server side of a reset as ONE function over `ResetHost`: the order, the failures, the answer, the publications |
| `host.ts` | 124 | `ResetHost` bound to the seams of the app; B-1 to B-9 on the reopened pool |
| `__tests__/support.ts` | 764 | Not a test file: a recording host, a database-free app, the booted app on a clone, the routine of a database test |
| `__tests__/reset-order.test.ts` | 443 | `unit`, 45: the order and every failure of the caller, on the recording host |
| `__tests__/routes.test.ts` | 643 | `unit`, 42: MODG, the gate, the handlers, a reset through the server's own wiring |
| `__tests__/static.test.ts` | 329 | `unit`, 27: the static guards of the folder |
| `__tests__/status.test.ts` | 54 | `unit`, 15: the pure parts of operation 71 |
| `__tests__/host.test.ts` | 135 | `unit`, 12: the boot checks of the resume on a stand-in pool |
| `__tests__/gate.db.test.ts` | 243 | `db`, 10: AC-B-56, the unreadable owner file, the name guard |
| `__tests__/faults.db.test.ts` | 257 | `db`, 12: operations 71, 73, 74; `AUDIT_TAMPER` |
| `__tests__/reset.db.test.ts` | 549 | `db`, 7: AC-B-57, AC-B-72, `loadScenario`, a reset during a recording |
| `__tests__/reset-failures.db.test.ts` | 373 | `db`, 11: the failure table against the real routine |

Nothing else was edited: not `app.ts`, the contract, the schema, the routine, the engine, a
plugin, another module, or a test of another row. The pre-image of the stub is
`.cache/rollback/W43/modules.demo.index.ts.pre`.

## 3. The handler recipe per operation (rule M13)

| # | Operation | Recipe | What the handler does |
|--:|---|---|---|
| 71 | `getDemoStatus` | A read | `app.db.read('demo.getDemoStatus', …)` for the one row of `core_state` (seed instant, last reset), then `app.engine.state()` and `app.engine.epoch` in one turn. No unit of work, nothing changes |
| 72 | `loadScenario` | Server-native: the reset routine | `reset.run({ operation, scenario: body.name, actorId, requestId, log })`; 200 `{ epoch }` with `x-dems-epoch` and `x-dems-revision` of the reloaded engine |
| 73 | `injectFault` | Hosted (M4) | ONE `app.engine.command(request.principal, 'inject', kind, target)`; then the info line `demo fault injected`; 204 with the two headers of the outcome |
| 74 | `clearFault` | Hosted (M4) | ONE `app.engine.command(request.principal, 'clearFault', kind, target)`; the info line `demo fault cleared`; 204 |
| 75 | `resetDemo` | Server-native: the reset routine | As 72 with the scenario `idle` and the reason `RESET` |

Rules held, each by a static test of the folder:

- **Who may call, and the demo flag, are stage 6 only** (brief; guard §3). The folder reads no
  permission, role, session or device of the caller, does not read `demoControls`, and builds no
  `DEMO_DISABLED` answer. Of the principal it reads the operator ID in one function: the actor of a
  reset and the name in a fault's log line. A caller that is no operator there is a defect of the
  server: 500, and the routine is not asked (tested without stage 6).
- **The module writes no row.** No audit row, no event, no unit of work of its own. Its two
  statements are reads (`core_state`, `operators`). The `SCENARIO_LOADED` row and the lineage row
  are the routine's; the fault rows are the simulator's.
- **The log line of decision D28 D-3.** The simulator's `inject` and `clearFault` name no actor.
  The module writes one info line after the command committed: `operationId`, `operatorId`, `kind`,
  `target` (the validated body), `epoch`, `revision`. Plain fields; no error object; nothing a
  caller typed freely (every member of a target is an enumeration, a number or an ID that matched
  its pattern).
- **One clock, no timer.** `app.clock.now()` once; the routine reads it once, after the quiesce.
- **M14.** Every catch logs what it caught under `err`; the code is a plain field. No log line and
  no error-log entry is built from the text of an error; the one text handed on is the routine's
  own log line (`ResetLogEntry.message`, which the routine's row built from names and counts).

## 4. The operation table: statuses, and the test for each

`validateCoreApiResponse` returns `{ ok: true }` for every answer below. U = `routes.test.ts`,
G = `gate.db.test.ts`, F = `faults.db.test.ts`, R = `reset.db.test.ts`, X = `reset-failures.db.test.ts`.

| Operation | Status | When | Test |
|---|---|---|---|
| all five | 401 `NOT_SIGNED_IN` | Nobody is signed in, whatever the flag | U "nobody is signed in"; G "nobody signed in" |
| all five | 403 `NOT_PERMITTED` + one `ACCESS_DENIED` row | The role lacks `DEMO_CONTROL`, whatever the flag | G, INVESTIGATOR and TECHNICIAN, five calls each; R (a TECHNICIAN with the flag on) |
| all five | 403 `DEMO_DISABLED`, no row | A holder, flag off; before the body is read | U "a SUPERVISOR gets 403 DEMO_DISABLED" (also with a body the schema refuses and one that is no JSON); G |
| all five | 503 `NOT_READY` | A reset holds the server; or a resume failed | U and R (during the routine); X (after the refused matrix, after the failed B-5) |
| 71 | 200 `DemoStatus` | | U (two states); F; R (after each reset) |
| 71 | 503 `NOT_READY` | The read fails; the engine is not running | U "a read that fails", "an engine that is not running" |
| 71 | 500 `INTERNAL_ERROR` | No state row (cannot happen on a booted server: B-6) | U |
| 72 | 200 `DemoEpoch` | | U (four scenarios); R |
| 72 | 400 `INVALID_JSON`, 422 `INVALID_INPUT` | The body is no JSON; an unknown or missing name. The routine is not asked | U |
| 72, 75 | 503 `NOT_READY`, `details.reason` | The reset did not happen (section 6) | U; G; X |
| 73 | 204 | The fault is active (also when it already was: nothing is written) | U; F |
| 73 | 404 `NOT_FOUND`, `details.simCode` | `TAMPER` for evidence the Core does not have | U; F |
| 73, 74 | 400, 422 | The schema stage, before the engine | U (six bodies, both operations); F |
| 73, 74 | 503 `NOT_READY` | The engine is not running | U |
| 74 | 204 | No such fault is active now (also when nothing matched: nothing is written) | U; F |
| 75 | 200 `DemoEpoch` | | U; R |

Not produced by the module and not tested here: 429 (stage 5), 403 `ORIGIN_NOT_ALLOWED` (stage 3),
413 (the body limit). The full role-by-operation matrix is the test row W47.

## 5. The reset sequence, statement by statement, and what is true at each step

`reset.ts`, `createDemoReset(host).run(call)`. The routine is `resetDatabase` of `src/db/reset`,
called with ONE argument: `{ database, dataDir, clock, actorId, reason, scenario, quiesce, log }`
and nothing else (asserted: the eight keys, by name).

| # | Step | Code | True afterwards |
|--:|---|---|---|
| 1 | One reset at a time | `if (inFlight) throw 503` | A second call of this server is refused before the routine is asked. Nothing of the first is disturbed |
| 2 | The routine, R-0 | `host.routine({...})` | The name passed the routine's guard; the owner file was read by the routine; one `dems_owner` connection on `postgres`; the role check passed; the advisory lock is held. **Nothing of the server is stopped yet**: another request is answered 200 at checkpoints R-0 and R-1 |
| 3a | Quiesce: hold | `host.hold()` → `app.readiness.hold('demo-reset')` | Stage 2 answers 503 `NOT_READY` to every other request; health answers 200 |
| 3b | Quiesce: drain | `app.pipeline.drain()` | No unit of work runs or waits |
| 3c | Quiesce: roles | `app.db.read('demo.operatorRoles', …)` | Who holds which role, read while no writer can run |
| 3d | Quiesce: engine | `app.engine.stop()` | The scheduler is off, the last snapshot is written, `ready.engine` is false. From here on the server must be resumed |
| 3e | Quiesce: pool | `app.db.close()` | The pool of `dems_app` is ended, `ready.database` is false. The routine then asks the server until no session is left on the database (R-1) |
| 4 | The routine, R-1 to R-9 | | The database behind the name is the rebuilt one, with epoch previous + 1, or the routine rejected and the name points at what it did. The routine's connections are closed |
| 5a | Resume: pool | `app.db.reopen()` | A new pool from the same configuration: the same role, the same start-up options |
| 5b | Resume: boot checks | `runBootChecks(app)` | B-1 (the database answers, `ready.database` true; a pooled connection has the pinned path), B-2 to B-7, B-8 reported, B-9 |
| 5c | Resume: matrix | `permissionGuard(app).reloadMatrix()` | The stored roles, permissions and grants are the shared ones (decisions D83 DN-2, D88, D95) |
| 5d | Resume: engine | `app.engine.reload()` | Rehydrated from what the name points at, with the stored epoch AS IT IS; `ready.engine` true; `cause: 'start'` published. **After a reset that did NOT happen this step is `app.engine.start('resync')` since decision D101: section 21** |
| 6 | Release | `release()` | Requests are served. Only when 5a to 5d all passed, or when 3d was never reached |
| 7 | Publications, answer | | `session.updated` for an operator whose role the seed put back; `admin.changed`; 200 `{ epoch: report.epoch }` |

The order as the booted server logged it, with the routine's checkpoints written between its own
lines (`reset.db.test.ts`, verbose run of 16:37:51; asserted as an exact list):

```
demo reset requested | routine R-0 | routine R-1 | hold demo-reset true | ready.engine false |
engine stopped | ready.database false | routine R-2 | routine R-3 | routine R-4 | routine R-5a |
routine R-5b | routine R-5c | routine R-5d | routine R-5e | routine R-5f | routine R-5:commit |
routine R-6 | routine R-7 | routine R-7:rename | routine R-8 | routine R-9 | ready.database true |
boot checks passed (B-8 reported) | engine started (reset, epoch 2) | ready.engine true |
hold demo-reset false | demo reset done
```

What another request was answered at each of the 17 checkpoints: 200 at R-0 and R-1, 503 at each
of the 15 from R-2 on; health 200 at all 17, with `ready` `{ database: true, engine: true }` at the
first two and `{ database: false, engine: false }` afterwards. Sessions of `dems_app` on the
database: more than 0 at R-0 and R-1, **0 at each checkpoint from R-2 to R-9**.

**The statements of the runtime role** for one `resetDemo` request (recorded on the pool the app
was built with; text only; the two observing requests of the test at R-0 and R-1 are four of the
first six):

| Phase | Statements |
|---|---|
| Before the pool closed (6) | The session lookup of the request (stage 4); the test's two observing requests (a session lookup and the read of `core_state` each); `SELECT id, role_id AS role FROM public.operators ORDER BY id` (step 3c). The engine's stop sent nothing: nothing was left to write |
| While the routine worked (R-2 to R-9) | **None.** The count of statements is the same number at all 15 checkpoints |
| On the reopened pool, up to the answer (37) | `SELECT 1`; the path question of B-1; B-2 (2); B-3 (1); B-4 (1); B-5 (2); B-6 (1); B-7 (1); B-8 (3); B-9 (2); the matrix (1); the engine's rehydration, one unit: `BEGIN`, the chain lock, the unit's limits, 16 reads, `COMMIT` (20; it writes nothing: the epoch is the stored one); the operators' roles again (1) |

No statement of the runtime role, in the whole test file, changes or removes a row of `audit_log`
or `audit_chain_history` (asserted with the reset row's classifier).

Measured (this host, other rows running; the routine's own `totalMs` of its report, for the
first reset of `reset.db.test.ts` in four verbose runs): 920 ms (16:23:40), 775 ms (16:24:54),
390 ms (16:31:53) and 1,055 ms (16:37:51, the run kept in `assets/43_row_command_verbose.log`:
R-4 86, R-5 433, R-8 435). The build (R-5) took 167 to 433 ms and the drop of the old database
(R-8) 90 to 538 ms; the load average was between 6 and 9.5. The time of the whole request was not
measured separately.

## 6. The failure table of the caller, with the test for each row

O = `reset-order.test.ts` (recording host), U = `routes.test.ts` (the server's wiring), G, X as above.
"Resumed" = pool reopened, boot checks, matrix, engine reloaded, hold released, in that order.

| # | What happened | Stopped | Brought back | Answer | Log, error log | Tests |
|--:|---|---|---|---|---|---|
| 1 | Another reset of THIS server runs | nothing | nothing | 503, `reason: RESET_IN_PROGRESS`; the routine is not asked | one `warn` line | O "one reset at a time"; U "two resets at once"; X "two resets at once through HTTP" (one 200, one 503, epoch + 1) |
| 2 | The routine refuses at R-0: `RESET_ALREADY_RUNNING` (the advisory lock is held elsewhere) | nothing: no hold | nothing | 503, `RESET_IN_PROGRESS` | `warn`, `routineCode`, `routineStep: R-0`; error log `warn` | O; U; X (a second session holds lock 442001 of the clone): no `readiness hold` line, pool generation unchanged, no publication, the next command works |
| 3 | The routine refuses at R-0: `RESET_OWNER_CREDENTIALS`, `RESET_ROLE_PRIVILEGED`, `RESET_DATABASE_UNREACHABLE`, `RESET_TARGET_REFUSED`, `RESET_OPTIONS_INVALID`, or anything else thrown before the quiesce | nothing | nothing | 503, `RESET_FAILED` | as row 2 | O (six cases); G (the unreadable owner file; the server's own routine on a clone: `RESET_TARGET_REFUSED`) |
| 4 | The quiesce breaks off before the engine stop (the drain, the read of the roles) | the hold only | the hold is released | 503, `RESET_FAILED` | `error` with the cause (the routine drops it), then `warn` `RESET_QUIESCE_FAILED` | O (two cases) |
| 5 | The quiesce breaks off at or after the engine stop | hold, engine, perhaps the pool | resumed | 503, `RESET_FAILED` | `error` twice | O (two cases) |
| 6 | The routine fails after the quiesce, target untouched (R-1 `RESET_TARGET_IN_USE`, R-2 to R-7) | hold, engine, pool | resumed on the UNCHANGED database: ~~the engine has the epoch it had~~ **since decision D101 the engine takes a NEW epoch, previous + 1 (section 21)** | 503, `RESET_FAILED` | `error`, `routineCode`, `routineStep`, `targetUntouched: true`, and SQLSTATE, constraint, table when the server named them | O (six cases); U; X: forced at R-4, R-5c, R-6, R-7:rename (same OID, same chain facts, a `start` with the same epoch, the next row continues the old chain); a foreign session on the database (the same backend still answers) |
| 7 | The swap's outcome is unknown (`targetUntouched: false`) | hold, engine, pool | resumed on WHICHEVER database the name points at, **since decision D101 under the stored epoch plus 1 (section 21)** | 503, `RESET_FAILED` | `error`, `targetUntouched: false` | O; X (the name points at the new database: new OID, the engine reloads with epoch + 1 and publishes it, the next command works) |
| 8 | Something that is no `ResetError` after the quiesce | hold, engine, pool | resumed | 503, `RESET_FAILED` | `error` by the error's name | O |
| 9 | The resume fails: the pool, a boot check, the matrix, the engine | hold, engine, pool | **Nothing more. The hold is KEPT** | 503, `RESET_FAILED`; then 503 on every request but health | one `error` line: `step`, `code`, `serving: false`, `recovery`; error log `fatal` | O (four steps; after a routine that failed too); X (B-5 fails on the rebuilt database: `step: B-5`) |
| 10 | Decision D95: `reloadMatrix` rejects with `STORED_MATRIX_MISMATCH` or `STORED_GRANTS_MISMATCH` | as row 9 | as row 9: the engine is not reloaded, no new epoch is published | as row 9 | `step: rbac.matrix`, `code: STORED_GRANTS_MISMATCH` as a plain field, `serving: false`, `recovery: restart the server: a start runs the boot checks` | O (both codes); U (both codes: also with both readiness flags set by hand, the hold alone refuses); X (after a real reset: `ready` `{ database: true, engine: false }`, 503 on each of the seven requests tried, health 200) |
| 11 | The engine reloaded with another epoch than the routine wrote (a defect) | — | — | 200 with the routine's epoch | `error` `DEMO_EPOCH_MISMATCH` with both numbers | O |

After rows 1 to 8 the server is usable again. Against PostgreSQL, for rows 1, 2, 6 and 7,
`expectUsable` of the database test asserts readiness, a running engine, the epoch, a fault raised
and cleared with its row at head + 1 on the head's hash, a tick, the status read, the stored chain
verified and the pool's role; for row 3 the gate test asserts that the next command works. Rows 4,
5 and 8 are held on the recording host only (the trace ends with the complete resume and the
release). After the failures of rows 1, 2, 6 and 7 a `resetDemo` of the same server succeeds
(epoch + 1).

**A reset while a recording runs** is not refused: spec §12.4 names no state in which a reset is
refused, and the simulator's `resetDemo` has none. Tested: `loadScenario recording`, 3 s of ticks,
then `resetDemo`: 200, the session is gone, the epoch moved by 1, the lineage has a third row.

## 7. No credential is held: the proof

| Claim | Evidence |
|---|---|
| The module names no credential and no connection file | Static test: no name of a connection file, no `password`, `Secret`, `reveal(`, `readOwnerConnection`, `createOwnerPool`, `createRuntimePool`, `new Pool`, no import of the driver, of `node:fs` or of `node:path`, no role name |
| It hands the routine a DIRECTORY, and never opens it | Static test: `dataDir` occurs in the host's getter and in the routine's option, nowhere else; no path is built |
| It calls the routine with one argument | Static test: `resetDatabase(options)`, once, in `index.ts`; none of the routine's test seams or test options occurs in the folder |
| What it passes | Unit test: exactly `actorId, clock, dataDir, database, log, quiesce, reason, scenario` |
| What it gets back | Database test: the report's 21 keys, by name: counts, names, integrity values. No connection field |
| The owner connection is gone after the call | Database test: at the 16 checkpoints after R-0 the server lists the routine's connections as `dems_owner (superuser false)`; after the answer the question is asked until the answer is "none" (finding F63, lesson 2), then asserted empty. The same after three resets, and after the failure cases that end with a reset that ran (two at once, the unknown outcome, the refused matrix, the failed B-5) |
| The owner's fields live in one call of the routine | The routine's own row (its static test "the owner connection is read in one statement of routine.ts and held in a local variable only"). Not re-proven here |
| Nothing was left for the driver to read | Database test: no variable whose name starts with `PG` is in the environment after a reset |
| With the flag off the file is never opened (HC-2) | No handler runs (stage 6); the routine, counted, was asked 0 times in 20 calls of the five operations; the server boots and runs with an unreadable file of that name |
| No credential in a log | `credentialLeaks(log)` is empty in the fault and reset files; the reset log holds no line at error level and no word `password`, `passwd` or `secret`; the answer and the log of the unreadable-file case name neither the directory nor the file |

**How this row checked the cluster.** Earlier rows ran a scratch script that connects as
`dems_owner` through the helper's reader and prints what is left. This row did not run one
(rule 1b of its brief). Its evidence for the end state is the helper's own teardown line of every
database run, and the project command `db:status` (section 17). Inside its database tests the
owner role is used only through the helper's pools and through `maintenancePool` of the reset
row's test support; no value of a connection file is read into a variable of this row's code.

## 8. Faults: the view and the stored chain

`AUDIT_TAMPER` (`faults.db.test.ts`, verbose run of 16:37:51):

```
[w43] AUDIT_TAMPER: view {"ok":false,"checked":83,"index":83,"seq":84,"reason":"HASH_MISMATCH"}; stored ok, 89 rows, digests ok, no altered row
```

| Fact | Asserted |
|---|---|
| The view | One row of `app.engine.slice('audit')` ends with ` [altered]`; `verifyAuditChain` of the shared simulator on that slice is `{ ok: false, seq, reason: HASH_MISMATCH }`; the publication replaces the `audit` slice whole |
| The stored chain | The dump of `audit_log` before is a prefix of the dump after, text for text; one more row, `AUDIT_CHAIN_DISCONTINUITY`, actor null; no stored message ends with ` [altered]`; the row the view altered is stored with its own text and the same hash; `checkStoredChain` with the shared digest check: `ok`, `digests: ok`, 0 link breaks; `verifyTrail` passes |
| While the view is broken | The engine goes on writing: the stored chain grows and verifies |
| Clearing | The view verifies again; one `FAULT_CLEARED` row; the stored rows from before are still byte-equal |

A plain fault (`MIC_NO_SIGNAL` on `AUDIO-02`): one `FAULT_RAISED` row with actor null, one active
alert (in the slice and in the table), the fault in the status with its instant and target, one
info line with `operatorId: OPR-002`; the same fault again writes nothing; clearing writes one
`FAULT_CLEARED` row and resolves the alert; clearing again writes nothing.

That the engine's write-through never sends an altered ring row to the table is the engine
host's rule (its `newAuditRows`); this row proves the outcome through HTTP and adds nothing to it.

## 9. What the realtime row (W42) and the web Demo Control Panel can rely on

| Fact | Detail |
|---|---|
| After a reset or a scenario load, on `app.publish`, in this order | (1) the engine's `{ kind: 'state', change: { cause: 'start', epoch: previous + 1, revision: 0, ops: [] } }`: a snapshot to every OPERATOR socket (RT-7). (2) `{ kind: 'session.updated', operatorId, role, permissions }` for each operator whose stored role differs from before the reset (spec §12.4, the operators row); permissions in the order of the stored matrix, as the administration module publishes them. (3) `{ kind: 'admin.changed', resource: 'USERS' }`, always. (4) `{ kind: 'admin.changed', resource: 'PAIRING_CODE' }` when the routine closed an ACTIVE code |
| When they are published | (1) by the engine inside its reload, the last step before the hold is released; (2) to (4) after the release. A client that reacts to (2) to (4) with a request is served |
| Nothing of the old epoch follows the `start` | Asserted |
| A reset that failed after the quiesce | **Changed by decision D101 (section 21):** the engine is resynchronised on the unchanged database and publishes a `start` with a NEW epoch (previous + 1) at revision 0. Every `start` this module causes carries an epoch no client holds. (As accepted at the gate: the same epoch at revision 0, finding F-3) |
| A resume that failed | No `start` is published. The server answers 503 to everything but health until it is started again |
| The answer of 72 and 75 | 200 `{ epoch }`: the epoch of the snapshot. `x-dems-epoch` is the same number; `x-dems-revision` is the engine's revision at the answer (0, unless a tick has committed since the reload) |
| The 503 of 72 and 75 | `error.details.reason`: `RESET_IN_PROGRESS` (another reset holds the database: try again) or `RESET_FAILED` (it did not happen; nothing for the user to do but tell an operator of the server). While a reset runs, every OTHER request is answered a plain 503 `NOT_READY` by stage 2: retry after the snapshot |
| Sessions | Nobody is signed out. The caller's cookie works on the next request. An operator whom the seed re-enabled is served again with the same cookie |
| `getDemoStatus` | `scenario`, `activeFaults` (kind, since, target: the simulator's keys, for example `AUDIO-02`, `seq:84`), `seededAt` and `lastResetAt` (both the reset's instant after a reset), `epoch` |
| A fault | 204 with the epoch and the revision of the delta that holds it. A fault that was already active, and a clear that matched nothing, answer 204 with the current revision and write nothing |
| The panel is hidden when | `AuthSessionInfo.demoControls` is false (DC-3; the identity module's answer; asserted here for both flags) |
| A reset while a recording runs | Is not refused. The panel should ask the operator first |

## 10. Measured round trips

| What | Statements of the runtime role |
|---|---|
| `injectFault MIC_NO_SIGNAL` (one request) | 14: one read (the session lookup of stage 4) and ONE unit of 13: `BEGIN`, the chain lock, the unit's limits, the operators mirror, one INSERT into `audit_log`, one into `events`, the event counter (the core's raise and the mapping's two updates), one UPDATE of `hardware_snapshot`, one INSERT into `alerts`, one into `health_snapshots`, `COMMIT`. A POST whose session was last seen longer ago than the touch interval adds the unit that moves that instant |
| `getDemoStatus` | 2: the session lookup, the read of `core_state` |
| `resetDemo` | 2 before the pool closes (the session lookup of stage 4, the operators' roles), 0 while the routine works, 37 on the reopened pool (section 5) |

## 11. Verification

### 11.1 The row command (16:37:34; `assets/43_row_command.log`, verbose: `43_row_command_verbose.log`)

```
> vitest run --project db src/modules/demo

[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_65_tmdmqmjm_

 Test Files  4 passed (4)
      Tests  40 passed (40)
   Start at  16:37:34
   Duration  16.19s (tests 75%, import 13%, transform 13%)

[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 2 database(s) in 399 ms; 0 remain with the run prefix dems_test_step_65_tmdmqmjm_
```

The unit tests of the folder (16:37:31; `assets/43_unit_module_verbose.log`):

```
 Test Files  5 passed (5)
      Tests  141 passed (141)
```

### 11.2 The module gate (MODG)

```
[w43] MODG routes of src/modules/demo:    GET /api/v1/demo/status getDemoStatus | POST /api/v1/demo/scenario loadScenario | POST /api/v1/demo/faults injectFault | POST /api/v1/demo/faults/clear clearFault | POST /api/v1/demo/reset resetDemo
[w43] MODG registry, operations 71 to 75: GET /api/v1/demo/status getDemoStatus | POST /api/v1/demo/scenario loadScenario | POST /api/v1/demo/faults injectFault | POST /api/v1/demo/faults/clear clearFault | POST /api/v1/demo/reset resetDemo
```

| MODG item | State |
|---|---|
| Route list equals the registry operations | Yes: the two lines above are compared by the test |
| Each documented status the module can produce has a test; every answer validates | Section 4 |
| One allowed and one refused call per operation | Allowed: SUPERVISOR with the flag on, all five (U, F, R). Refused: SUPERVISOR with the flag off, and the two other roles, all five (G) |
| Typecheck and lint | Section 11.5 |
| Mutation check | Section 13 |

### 11.3 The cases of plan W43

| Case | Evidence |
|---|---|
| Flag off: 403 `DEMO_DISABLED` for a SUPERVISOR, 403 `NOT_PERMITTED` with an audit row for the other roles | `gate.db.test.ts`, "AC-B-56" (4 tests): five calls per role; the rows counted before and after each call |
| The server runs while the owner file is unreadable | `gate.db.test.ts`, "AC-B-72": mode 000, `accessSync` throws; booted, ready, health, a session answer, ticks, a hosted command |
| Flag on: the pool reports `dems_app`, the reset connection `dems_owner` with `rolsuper` false | `reset.db.test.ts`: `[w43] the reset's connections, as the server lists them: dems_owner (superuser false) on <t>_next; dems_owner (superuser false) on postgres`; the report's `role` |
| `AUDIT_TAMPER` breaks `view` and leaves `stored` intact | Section 8 |
| `resetDemo` returns the domain tables to the seed checksums | `[w43] domain tables equal to a fresh seed at the reset's instant and epoch: 16 of 16 (active_session, alerts, core_device, core_state, evidence_custody, evidence_items, evidence_tracks, exports, hardware_snapshot, health_snapshots, permissions, role_permissions, roles, schema_meta, session_history, storage_policy)`; `operators` equal apart from the last sign-in; the first 82 audit rows and the events but the last equal the seed's |
| Keeps the eight kept tables | `[w43] kept tables, rows before = after the reset: registry_counters 2; console_settings 1; paired_devices 2; device_credentials 2; auth_sessions 6; biometric_tokens 3; pairing_codes 5; audit_chain_history 0 -> 1` (dump and contract checksum for six; four codes byte-equal; the lineage row holds the old head, count, epoch, the caller) |
| Writes an ACTIVE code as `CANCELLED` | `state CANCELLED`, `closed_at` = the reset's instant, `closed_by_operator_id` = `OPR-002`; no `PAIRING_CODE` row in the new chain |
| Raises the epoch by exactly 1 | 1 → 2 → 3 → 4 over three resets; `core_state.epoch`, the report, the engine, the answer and the header agree each time. The chain holds ONE `SCENARIO_LOADED` row |
| Publishes the new epoch for every operator socket | One `cause: 'start'` with the new epoch, revision 0, no op, on the seam |
| The reopened pool carries the same start-up options | `current_setting('search_path')` on the reopened pool equals the value before the reset and the pool plugin's `RUNTIME_SEARCH_PATH`; a unit after the reset works (rows 84 and 85 continue the new chain) |

### 11.4 Whole projects (final)

| Time | Command | Result |
|---|---|---|
| 16:25:21 | `npm run test -w @dems/core-server -- --maxWorkers=2` | **Exit 0**: 134 files, 3,503 tests (`assets/43_whole_unit.log`) |
| 16:26:06 | `DEMS_TEST_STEP=65 npm run test:db -w @dems/core-server -- --maxWorkers=2` | **Exit 1**: 100 files, 99 passed; 1,477 tests passed, 0 failed. `FAIL src/realtime/__tests__/upgrade.db.test.ts: Hook timed out in 180000ms` in the helper's `afterAll` of that file (61 tests of it passed). `forced drops that needed a retry: 0`; `0 remain with the run prefix` (`assets/43_whole_db.log`). Load average 10.27 at the end |
| 16:31:15 | The same file alone (rule M15) | **Exit 0**: 1 file, 64 tests (its owner had changed it in between: 61 → 64) (`assets/43_other_row_file_alone.log`) |

The one red is in a file of the realtime row (W42), in flight; this row neither wrote nor reads
it. The whole `db` project was not run a second time: the load average was above the guard of P9.

### 11.5 Typecheck and lint: every run (P11)

| Time | Typecheck | Lint |
|---|---|---|
| 15:52 | exit 0 | exit 0 |
| 16:12:15 | **exit 2**: four errors in this row's `reset.db.test.ts` (fixed), one in `src/modules/security-audit/__tests__/chain.db.test.ts(236,93)` (another row) | exit 0; one warning in this row's `faults.db.test.ts` (fixed), four in other rows' files |
| 16:12:44 | **exit 2**: only the line of `security-audit` | exit 0; four warnings, none in this row's files |
| 16:25:08, 16:25:15 | exit 0 | exit 0; four warnings: `src/modules/identity/biometric/__tests__/sign-in.db.test.ts:48`, `src/realtime/__tests__/support.ts:354`, `src/realtime/hub.ts:855` and `:858` |
| 16:37:20, 16:37:30 (final) | **exit 0** | **exit 0**; three warnings, all of the realtime row: `src/realtime/hub.ts:857` and `:860`, `src/realtime/__tests__/support.ts:360`. None in `src/modules/demo/` (`assets/43_typecheck_lint.log`) |

Also seen and gone: at 16:02:43 `test/static/log-calls.test.ts` was red for `src/realtime/hub.ts:597`
and `:758` (a member `reason` in a log call of the realtime row); green at 16:19:04 and in the
whole run.

## 12. Test ledger (P24)

Against the controller's baseline of 15:17 (`unit` 102 files / 2,658; `db` 75 files / 1,081):

| Project | Now | This row | Other rows |
|---|---|---|---|
| `unit` | 134 files, 3,503 tests | **+5 files, +141 tests**: `reset-order` 45, `routes` 42, `static` 27, `status` 15, `host` 12 | +27 files, +704 tests |
| `db` | 100 files, 1,477 tests | **+4 files, +40 tests**: `gate.db` 10, `faults.db` 12, `reset.db` 7, `reset-failures.db` 11 | +21 files, +356 tests |

No test of another row was edited, skipped or adapted.

## 13. Mutation check

82 defects were planted one at a time (`assets/43_mutations.json`), by a transform in a runner
configuration **outside the source tree** (`assets/43_mutation_runner_config.mjs.txt`, rule M15):
Vitest was started with `--root apps/core-server --config <scratch>/vitest.mutation.config.mjs`,
and the configuration's plugin replaces one text of one production file in memory. No file of the
workspace was changed at any time. The unit tests of the folder ran on each; the database tests
(label `65m`) only when the unit tests did not detect it (16:18:33 to 16:22:46;
`assets/43_mutation_results.tsv`, `43_mutation_detected_by.txt`). The production files were last
written at 15:57, before the check; the two database test files that changed after it only gained
assertions.

**82 of 82 detected: 77 by `unit`, 5 by `db`.** The control (the same transform with a
replacement that changes nothing) passed both projects: 141 and 40 tests.

| Group | Planted | Detected by |
|---|--:|---|
| The quiesce: the hold not taken; no drain; no engine stop; no pool close; pool closed before the engine stop; drain after the stop; hold after the drain; roles read after the stop; "must be resumed" noted too late | 9 | `reset-order` (9) |
| The resume: no reopen; no boot checks; no matrix; no engine reload; engine before matrix; boot checks before reopen; matrix before boot checks | 7 | `reset-order` (7) |
| The hold: released before the resume; **released although the resume failed (D95)**; never released | 3 | `reset-order` (3) |
| When the resume runs: whenever the hold was taken; always; not after a failed routine | 3 | `reset-order` (3) |
| One reset at a time: the guard off; never freed | 2 | `reset-order` (2) |
| What the routine is told: no actor; always `idle`; another clock; the reasons swapped; `resetDemo` loads `recording`; `resetDemo` as a scenario load; `loadScenario` ignores the name; the actor is not the caller | 8 | `reset-order` (4), `routes` (4) |
| The answer: 500 for 503; "running" answered as "failed"; a failure not answered as one; the epoch + 1; no state position on the 200; no state position on the 204 | 6 | `reset-order` (3), `routes` (3) |
| Publications: no `session.updated`; no `admin.changed`; the pairing code always; an unchanged role counted; the roles not read again; the permissions of the other roles | 6 | `reset-order` (6) |
| Logs: the routine's lines dropped; a broken quiesce not reported; the epoch mismatch not reported; the failed resume not persisted; the refused reset not persisted | 5 | `reset-order` (5) |
| The host's bindings: hold, drain, engine stop, pool close, pool reopen, **the engine started as a process start**, the clock, the error log, the role read | 9 | `routes` (8), `host` (1) |
| The host's bindings that only the real server shows: the matrix not reloaded; the epoch not the engine's; publications not handed on; the boot checks not run | 4 | `reset.db`, `reset-failures.db` (4) |
| The boot checks: the probe's answer ignored; the pinned path not checked; **B-8 not run**; the blocking checks not run; a failed check swallowed | 5 | `host` (4), `reset.db` (1) |
| The faults: `inject` and `clearFault` swapped (2); the target dropped; no log line; the line names no operator; a caller that is no operator given an actor | 6 | `routes` (6) |
| Operation 71: the stored row not read; epoch 0; no fault listed; the last reset always null; the seed instant 0; always `idle`; two state rows accepted; a value that is no instant accepted; the epoch of the state instead of the engine's | 9 | `routes` (7), `status` (2) |

No mutation named a project database or a credential, on purpose: a mutation that could make a
test reach `dems_demo` was not written.

## 14. The contract gap, with the text for the close-out row (W83)

**CONTRACT-GAP-W43-1.** The contract documents 503 `NOT_READY` once, at envelope level, and lists
`reason` among the detail keys without its values. The module answers a reset that did not happen
with two values the contract does not name. Proposed text, for the descriptions of `loadScenario`
and `resetDemo` in `packages/shared/src/api/demo-controls.ts`:

> When the rebuild cannot run, the answer is `503 NOT_READY` with `details.reason`:
> `RESET_IN_PROGRESS` when another reset of this Core's database is running (try again), or
> `RESET_FAILED` when this one did not happen (the state is unchanged, or the server is not ready).

Until then the answers validate: the envelope's `details` is a free flat map. No local adapter was
needed. Nothing else of the contract was found wanting: the five registry entries, their schemas
and their examples describe what the module answers.

## 15. Findings

| ID | Finding | Evidence | Effect |
|---|---|---|---|
| F-1 | **The boot checks B-1 to B-9 cannot be run again through `app.readiness`**: `boot()` runs every step, the engine's among them, and that one is a process start (epoch + 1, the restart fault). The module calls the pure checks of `src/db/schema/boot-checks.ts` itself and repeats the second half of B-1 with the pool plugin's exported constants (47 lines, `host.ts`) | `plugins/readiness/index.ts` (`boot()`), `plugins/db/index.ts` (the path check is a closure of the boot step) | A request to the foundation's owner: one exported function that runs B-1 to B-9 on the current pool. The module's copy then goes |
| F-2 | **The identity module's expiry sweeper is a producer the module cannot stop through a seam.** A sweep that fires while the pool is closed fails; it logs `the session expiry sweep failed` and writes one error-log entry; the next sweep works | Read in `modules/identity/index.ts`, `sweeper.ts`; not provoked: the sweeper runs only while the server listens, and no test of this row listens | At most one error line per reset on a listening server. For the identity row's owner: skip a tick while `app.readiness.isReady()` is false |
| F-3 | **CLOSED by decision D101 (section 21).** As found: **after a reset that failed, clients are sent a `start` with the epoch they already hold**, at revision 0: the engine was stopped and reloaded on the unchanged database, and a reload takes the stored epoch as it is | `reset-failures.db.test.ts`: `{ epoch, revision: 0, ops: [] }` after each of four forced failures | The state is the same, so a snapshot is correct; the realtime channel must send it for every `start`, not only for a new epoch (section 9). The alternative, `engine.start('resync')`, moves the epoch although nothing was reset. Decision DN-3 |
| F-4 | A request that passed stage 2 before the hold was taken and reaches the pool after it closed is answered 503 by `app.db.read` or by the pipeline (`DATABASE_UNAVAILABLE`), with their own log lines | By reading; the one such request this row provokes is the second of two resets, which the reset guard or stage 2 refuses | None for the reset. A client retries after the snapshot |
| F-5 | **RUN in the follow-up and confirmed: section 21.4.** As found: an `AUDIT_TAMPER` overlay does not survive a reload that is no process start (a failed reset, the engine's own resync): the ring is rebuilt from the table, while the stored fault row stays active until it is cleared | By reading `engine/host.ts` (`applyProcessStart` runs in mode `boot` only); **not run**: a hypothesis | After a failed reset the status can list `AUDIT_TAMPER` while the view verifies. `clearFault` removes the entry. For the engine's owner |
| F-6 | A POST is activity: the reset request itself moves the caller's last-seen instant before the routine reads the kept rows | The first run of `reset.db.test.ts` (16:09:53): `auth_sessions` differed in that one column | Not a defect: the routine carries what is stored when it reads. For W47 and W53: a test that compares `auth_sessions` across a reset makes the caller's last POST at the reset's instant |
| F-7 | Whole-run noise of other rows (P11): the realtime row's `upgrade.db.test.ts` (a hook time-out under load, green alone), its `hub.ts` in the log-call guard (16:02), the security-audit row's type error (16:12) | Sections 11.4, 11.5 | Reported with the times |
| F-8 | `demoControl(app).replace(parts)` is a test seam inside production code, like `engineControl` and `identityControl`. A static test holds that no production file calls it | `static.test.ts` | For fix round B (CPB1-5): if test seams become test-only by construction, this one is a candidate |

## 16. Deviations, and decisions for the controller

| ID | Deviation from the brief or the documents | Reason |
|---|---|---|
| DV-1 | The hold is taken INSIDE the quiesce (after R-0), not before the routine is called as in the engine host's snippet | Database contract §8.5 puts "readiness off" in R-1, and the brief asks that a reset refused at R-0 has stopped nothing. Measured: another request is answered 200 at checkpoints R-0 and R-1 |
| DV-2 | One step was added to the quiesce, between the drain and the engine stop: a read of the operators' roles | Spec §12.4: "an operator whose role changes back receives `session.updated`". The roles before the reset exist only in the database that is about to be discarded |
| DV-3 | `admin.changed` (`USERS` always, `PAIRING_CODE` when a code was closed) is published after a reset | Not in the specification's text. The two lists of the portal change under their readers; the message carries only the name of a list |
| DV-4 | Decision D95 was applied to EVERY failure of the resume, not only to the matrix | A boot check that fails and an engine that does not reload leave the server in the same state: it must not serve |
| DV-5 | The module imports `src/db/reset`, `src/db/schema/boot-checks`, `src/db/mapping`, constants of `plugins/db` and one of `src/core` directly | No seam offers them (F-1). The routine is the brief's own import |
| DV-6 | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were not written | Parallel run: the controller's files (P8) |
| DV-7 | No scratch script connected to the cluster as the owner role for the end state | Rule 1b of the brief. Section 17 says what was used instead |

| ID | Question | Recommendation |
|---|---|---|
| DN-1 | Every reset that did not happen answers 503 `NOT_READY`, also a configuration defect (`RESET_ROLE_PRIVILEGED`, the owner file). `details.reason` has two values and never the routine's code | Accept. The specification names no other answer (DC-5 leaves it open); the code is in the log |
| DN-2 | DV-1: the hold in the quiesce | Accept |
| DN-3 | **RULED (D101): `start('resync')`, a new epoch; done in section 21.** As asked: F-3: a failed reset republishes the same epoch at revision 0 | Accept, and tell the realtime row that a `start` always means a snapshot. Or rule that a failed reset reloads with `start('resync')`: one line in `host.ts` |
| DN-4 | DV-3: the two `admin.changed` publications | Accept, or have them removed (two lines) |
| DN-5 | A reset while a recording runs is not refused | Accept: the specification names no refusal. The web panel asks first |
| DN-6 | F-1, F-2: pass to the foundation's owner and to the identity row's owner | |
| DN-7 | `CONTRACT-GAP-W43-1` to W83 | Section 14 |
| DN-8 | DV-4 | Accept |
| DN-9 | Pass to W42 and to the web rows W76, W82 | Section 9 |
| DN-10 | Pass to W47, W53 | F-6; and: a test that resets through HTTP closes its own fixture pools on the target first and asks the server until they are gone (`testRoutine` of this row's support does both and may be imported) |

## 17. End state and cleanup

| Check | Result |
|---|---|
| `db:status` of `dems_demo`, 15:37:53 and 16:38:19 | **Identical**: 45 lines, SHA-256 `6c3b67a5…94d4` both (`assets/43_dems_demo_status_before.log`, `_after.log`). Seeded 10:28:35 WIB, never reset, 82 audit rows, 59 events, lineage 0 |
| `db:status` of the three lanes, 16:38 | Each exit 0: owner `dems_owner`, seeded and last reset at their first build (11:36:42 to 11:36:43), audit head 82, 82 audit rows, 59 events, 0 sessions, lineage 0 (`assets/43_lanes_status.log`) |
| Databases of this row | Every database run of the row printed `0 remain with the run prefix`: 18 runs with the label `65` (16:04:48 to 16:37:51, the whole-project run and the alone run of the other row's file among them) and 6 with the label `65m` (the mutation check). `forced drops that needed a retry: 0` in all 24 |
| PostgreSQL | `.locks/postgres.pid` 19121; process 19121 started Sun Oct 4 07:14:26 2026. Not stopped, not reconfigured |
| Processes | None started that outlives a command. No port bound. No emulator touched |
| Scratch | The mutation runner, its logs and the row's run logs are in the session's scratch directory, outside the repository; copies of the configuration, the list and the results are in `assets/` |
| The scratch data directory of `gate.db.test.ts` | Created by the test under the system's temporary directory and removed by its `afterAll` |

## 18. Not done, and limits of this evidence

- **A reset of `dems_demo` or of a lane through a listening server**: not run, on purpose. The
  server's own call of the routine (one argument, no seam) was run on a clone only to show that it
  is refused there. That the routine accepts the four project names is the routine row's proof.
- **A socket**: the publications are asserted on the seam `app.publish`, as the brief says.
- **A listening server**: every request is `app.inject`. The sweeper (F-2) therefore never ran.
- **A connection lost while the swap commits**: stood in for by a `ResetError` thrown after the
  real routine resolved (row 7 of section 6). The case "the name points at the OLD database" of
  that row is covered on the recording host only.
- **`RESET_ROLE_PRIVILEGED` on a real connection**: the routine row's stub test. Here: the
  recording host.
- **F-5** is from reading.
- **The whole `db` project** did not exit 0 in this row's one final run (section 11.4).

## 19. Rollback (R-NEW; not executed)

```sh
# The folder held one file before this row: the scaffold's stub.
cp .cache/rollback/W43/modules.demo.index.ts.pre apps/core-server/src/modules/demo/index.ts
# Then remove the row's other files: host.ts, operations.ts, reset.ts, status.ts and __tests__/
# of apps/core-server/src/modules/demo/. The five operations then have no route again; the
# guard's boot check accepts that (a registry operation without a route does not stop the boot).
```

## 20. Verification list of the row

| Criterion | State |
|---|---|
| MODG (rule M11) | Yes (11.2) |
| Flag off: 403 `DEMO_DISABLED` for a SUPERVISOR, 403 `NOT_PERMITTED` with an audit row for the other roles | Yes (11.3) |
| The server runs while the owner file is unreadable (a scratch configuration) | Yes (11.3) |
| Flag on: the pool reports `dems_app`, the reset connection `dems_owner` with `rolsuper` false | Yes (11.3) |
| `AUDIT_TAMPER` breaks `view` and leaves `stored` intact | Yes (8) |
| `resetDemo`: seed checksums, eight kept tables, an ACTIVE code `CANCELLED`, epoch + 1 exactly, the new epoch published | Yes (11.3) |
| The caller's contract: order, `targetUntouched` true and false, `RESET_ALREADY_RUNNING`, a recording | Yes (5, 6) |
| Decision D95: a refused matrix keeps the hold; the code as a plain field; the state and the recovery in the log; a test with a stubbed `reloadMatrix` | Yes (6, row 10: three tests) |
| `DEMS_TEST_STEP=65` for `test:db` | Yes |
| Whole `unit` and `db` projects with the ledger | `unit` exit 0; `db` exit 1 for one file of another row, green alone (11.4, 12) |
| Typecheck and lint exit 0 without a warning | Exit 0 both; three lint warnings, all in files of the realtime row (11.5) |
| A mutation check of the module's own logic, the order above all | 82 of 82 (13) |
| No database of the row's prefix remains | Yes (17) |
| `dems_demo` and the three lanes untouched | Yes (17) |
| `.locks/postgres.pid` 19121 | Yes (17) |
| Writes only under `apps/core-server/src/modules/demo/**` and the row's documents | Yes (2) |

## 21. Follow-up: a failed reset takes a new epoch (decision D101)

16:42 to 17:01, after the controller's gate (PASS, decision D101). Sections 1 to 20 are the record
of the row as it was accepted; where this section changes a statement, that statement now carries
a pointer to here. Evidence files of this section: `assets/43b_*` (13 files). Database runs carry
the label `65b` (the mutation check: `65bm`). Scratch files were kept under the sandbox's
temporary directory only.

### 21.1 The ruling, and what changed

**Ruling (DN-3 of section 16).** After a reset that FAILED with the database untouched, the engine
must not come back with the epoch it had at revision 0: a client that holds epoch E at revision N
would be sent a snapshot of the same epoch whose revision went backwards, and the replica's gap
logic rests on "within an epoch the revision only grows". The engine's `start('resync')` is used
instead (engine host DV-5): the stored epoch plus 1, nothing else touched.

The rule the module now follows, in one line: **the routine resolved: `engine.reload()`; the
routine rejected after the engine was stopped: `engine.start('resync')`; the routine rejected
before anything was stopped: nothing.**

| File | Change |
|---|---|
| `reset.ts` (389 → 416 lines) | `ResetHost.resyncEngine()`. The last step of the resume is `rejected ? resyncEngine() : reloadEngine()`, named `engine.resync` (`RESYNC_STEP`) or `engine.reload` in a log line. One info line after the release, code `DEMO_RESET_NEW_EPOCH`, with `epochBefore`, `epoch` and the routine's code, step and `targetUntouched`. The failure line is reworded (it was written before the resume and said "was resumed") |
| `host.ts` (124 → 127) | `resyncEngine: () => app.engine.start('resync')` |
| `index.ts` (222 → 224) | Exports `RESYNC_STEP`; one sentence of the header |
| `__tests__/support.ts`, `reset-order.test.ts`, `routes.test.ts`, `static.test.ts`, `reset-failures.db.test.ts` | Section 21.5 |

Nothing outside `apps/core-server/src/modules/demo/` was written. `src/engine` was not edited.

### 21.2 The epoch, case by case, and what AC-B-57 means now

| Case | The engine's last step | Epoch afterwards | Published | Tests |
|---|---|---|---|---|
| A reset that HAPPENED | `reload()` | **previous + 1, exactly**: the routine wrote it, the reload adds nothing | one `start`, the new epoch, revision 0 | O "decision D101: a reset that happened …"; U; R (1 → 2 → 3 → 4 over three resets, mode `reset` in the engine's own log line); X "after every failure above, a reset still works" |
| Refused before anything was stopped (R-0; a second reset of this server; a quiesce that broke off before the engine stop) | none | **unchanged** | nothing | O (six R-0 cases, two quiesce cases: `epoch 4` stays 4); U (epoch 7, revision 41 stay); X (the held lock) |
| FAILED after the engine was stopped, the database untouched | `start('resync')` | **previous + 1, although nothing was reset** | one `start`, previous + 1, revision 0, no op | O (seven cases, and the quiesce that broke off at or after the engine stop); U; X (forced at R-4, R-5c, R-6, R-7:rename; a foreign session at R-1) |
| The swap's outcome is unknown | `start('resync')` on whichever database the name points at | name at the old database: previous + 1. Name at the NEW one: the routine's previous + 1, plus 1 = **previous + 2** | one `start` with that epoch, revision 0 | O; X (the new database: previous + 2 in the engine, in `core_state` and in the publication) |
| The resume itself failed (section 6, rows 9 and 10) | not reached, or it failed | nothing is published; the hold is kept | nothing | O; U; X (unchanged by this follow-up) |

**AC-B-57, "raises the epoch by exactly 1".** It holds for a reset that happened: one increment,
the routine's. Since D101 the epoch ALSO moves by 1 when a reset failed after the engine was
stopped, although nothing was reset; the server says so in one log line:

```
{ level: info, code: DEMO_RESET_NEW_EPOCH, operation, operatorId, scenario, epochBefore, epoch,
  routineCode, routineStep, targetUntouched }
no reset was completed; the engine was reloaded under a new epoch, so that every client takes a fresh snapshot
```

So the epoch no longer counts resets. What counts them is `audit_chain_history` (one row per reset
that happened) and `core_state.last_reset_at`; the epoch says only "take a fresh snapshot".

**The failed case, as the database test holds it** (`reset-failures.db.test.ts`, four checkpoints):

| Asserted | How |
|---|---|
| epoch previous + 1, revision 0 | the engine; `core_state.epoch`; the log line; the engine's own line `engine started (resync, epoch N)` in the exact order `hold true, ready.engine false, engine stopped, ready.database false, ready.database true, engine started (resync, …), ready.engine true, hold false` |
| ONE `cause: 'start'` publication | `{ epoch: previous + 1, revision: 0, ops: [] }`; no other publication but `state`; none of this request carries the old epoch except the engine's own `stop` |
| The state equals the state before the attempt | every durable slice of the engine's committed state is strictly equal to before, but for `meta.epoch`; what the tables hold equals it |
| The database is the one it was | the same OID, no `_next` and no `_prev`; the stored audit rows text for text; head sequence, head hash, row count and first sequence unchanged |
| The next command works | `expectUsable(previous + 1)`: a fault raised and cleared, its row at head + 1 on the head's hash, a tick, the status read, the stored chain verified |

### 21.3 For the realtime row and the web panel (replaces one row of section 9)

- **Every `start` this module causes carries an epoch no connected client holds**, at revision 0.
  The realtime channel needs no special case for a same-epoch `start` from a reset.
- After the 503 of a failed reset a client may receive a snapshot with a NEW epoch although
  nothing was reset: the state is the same but for the epoch. **A new epoch is not "the reset
  happened".** The answer of the request says whether it did (200 or 503), and so does
  `getDemoStatus.lastResetAt`.

### 21.4 Finding F-5, run: `AUDIT_TAMPER` across a reload that is no process start

Run twice (`reset-failures.db.test.ts`, verbose run of 16:56:18, `assets/43b_row_command_verbose.log`):

```
[w43] F-5, a failed reset with AUDIT_TAMPER active: before: fault listed true, alert active true, view verifies false (consistent); after the resync: fault listed true, alert active true, view verifies true (NOT consistent); getDemoStatus lists the fault: true
[w43] F-5, the engine alone, stop then start('resync') with AUDIT_TAMPER active: before: fault listed true, alert active true, view verifies false (consistent); after: fault listed true, alert active true, view verifies true (NOT consistent)
```

| Question | Answer |
|---|---|
| Is the fault list consistent with the view after a failed reset? | **No.** The fault is still listed and its alert is still active; the view verifies. `getDemoStatus` lists the fault |
| Which side is wrong? | The fault list. The ring is right: it is rebuilt from the stored chain, which was never altered (SR-59). Spec §12.3: "the overlay does not survive a restart: the ring is rebuilt from the table, and the server clears the fault at start" |
| Where? | In `src/engine`, not in this module's resume. The second run uses no route and no reset: the hosted action `inject('AUDIT_TAMPER')`, then `engine.stop()` and `engine.start('resync')`, and shows the same. `rehydrate.ts` `applyProcessStart` clears the overlay's fault; `host.ts:670` calls it for the mode `boot` only (`mode === 'boot' ? applyProcessStart(…) : NO_EFFECTS`). The engine's own reload after a diverged chain head goes the same way |
| Which outcome is the consistent one for the server? | "Fault cleared, view clean". The shared simulator, rehydrated from ITS snapshot, has "fault listed, view tampered", because its snapshot holds the altered ring row; the server cannot store an altered row, so that outcome is not available to it |
| What is right meanwhile | The stored chain: the rows that were there are there text for text, no stored message is altered, `checkStoredChain` passes with `digests: ok` (asserted). The way out: `clearFault AUDIT_TAMPER` leaves nothing listed, no alert active and a view that verifies (asserted) |
| Fixed here? | No: `src/engine` is not this row's. Nothing in this module compensates for it |

**The pending test** is `it.skip('PENDING (engine): after a start in the mode resync, the fault
list and the audit view agree about AUDIT_TAMPER')` in `reset-failures.db.test.ts`, with the
reproduction in the comment above it. It was run for real once, with the skip removed IN MEMORY by
the out-of-tree transform (16:55:24; `assets/43b_pending_test_run_for_real.log`), and fails today:

```
 FAIL  … > PENDING (engine): after a start in the mode resync, the fault list and the audit view agree about AUDIT_TAMPER
AssertionError: fault listed true, alert active true, view verifies true (NOT consistent): expected false to be true
```

**For the engine's owner.** Apply the overlay rule of `applyProcessStart` (clear `AUDIT_TAMPER`
when the ring was rebuilt from the table) in every start mode, not only `boot`; the restart fault
and the tablet link stay a process start's. Then remove `.skip`. The two running tests of this
folder print what they see and assert nothing about which outcome the engine gives, so they stay
green either way (rule M10).

### 21.5 Verification

| Time | Command | Result |
|---|---|---|
| 16:55:53 | `npm run typecheck -w @dems/core-server` | **exit 0** |
| 16:55:59 | `npm run lint -w @dems/core-server` | **exit 0**; eight warnings, all in `test/acceptance/restart.test.ts` (the restart test row, in flight: unused imports, lines 12 to 14). None in `src/modules/demo/` (`assets/43b_typecheck_lint.log`). At 16:49:20 the same command printed no warning at all |
| 16:56:00 | `npm run test -w @dems/core-server -- src/modules/demo` | **exit 0**: 5 files, 142 tests (`assets/43b_unit_module_verbose.log`) |
| 16:56:12 | `DEMS_TEST_STEP=65b npm run test:db -w @dems/core-server -- src/modules/demo` | **exit 0**: 4 files, 42 passed, 1 skipped (the pending test) (`assets/43b_row_command.log`) |
| 16:56:31 | `npm run test -w @dems/core-server -- --maxWorkers=2` (the ONE whole `unit` run) | **exit 0**: 137 files, 3,536 tests (`assets/43b_whole_unit.log`) |
| 16:57:08 | `DEMS_TEST_STEP=65b npm run test:db -w @dems/core-server -- --maxWorkers=2` (the ONE whole `db` run) | **exit 0**: 107 files, 1,522 passed, 1 skipped (this row's pending test); 121 s; load average 6.80 at the end (`assets/43b_whole_db.log`). The realtime row's `upgrade.db.test.ts` did not time out this time. No failure in any folder |
| 16:59:20 | `db:status` of `dems_demo` | **Identical** to 15:37:53: the same 45 lines, SHA-256 `6c3b67a5…94d4` (`assets/43b_dems_demo_status_after.log`). The three lanes: head 82, lineage 0, as built at 11:36 (`assets/43b_lanes_status.log`) |
| 16:59:23 | PostgreSQL | `.locks/postgres.pid` 19121; process started 07:14:26 |

The row command, as printed:

```
 Test Files  4 passed (4)
      Tests  42 passed | 1 skipped (43)
   Start at  16:56:12
   Duration  6.25s (tests 70%, import 16%, transform 14%)

[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 2 database(s) in 70 ms; 0 remain with the run prefix dems_test_step_65b_tmdnlocw_
```

**No database of this row remains.** Each of the five database runs with the label `65b`
(16:47:42 to 16:57:08) and of the seven with the label `65bm` printed `0 remain with the run
prefix`; `forced drops that needed a retry: 0` in all twelve.

**Ledger.** Against section 12: `unit` 141 → **142** (`reset-order` 45 → 46; `routes` stays 42 with
more assertions); `db` 40 → **42 passed and 1 skipped** (`reset-failures.db` 11 → 13 and the pending
one). Whole projects now: `unit` 137 files / 3,536; `db` 107 files / 1,522 and 1 skipped. No test
of another row was edited.

**Mutation check, on the follow-up state** (16:48:41 to 16:55:04; the same out-of-tree transform
as section 13, in the sandbox's temporary directory; `assets/43b_mutations.json`,
`43b_mutation_results.tsv`, `43b_mutation_detected_by.txt`). The production files were last written
at 16:43:58, before it. The 82 mutations of section 13 were run again (two of them re-aimed at the
text as it is now) and ten were added for this ruling: **92 of 92 detected, 87 by `unit`, 5 by
`db`**; the control passes.

| New mutation | Detected by |
|---|---|
| A failed reset reloads with the epoch it had (the behaviour before the ruling) | `reset-order`, `routes` |
| A reset that happened is resynchronised too (a second increment) | `reset-order`, `routes` |
| The two are swapped | `reset-order`, `routes` |
| The resync is not run | `reset-order`, `routes` |
| The resync is named as the reload in the log | `reset-order` |
| No line says that the epoch moved without a reset | `reset-order`, `routes` |
| The line is written also when nothing was stopped | `reset-order` |
| The line names the old epoch as the new one | `reset-order`, `routes` |
| The host's resync is a reload | `routes` |
| The host's resync is a process start | `routes` |

One mutation of section 13 ("the clock of the host is the system clock") was caught by `db` in
this run and by `unit` in the first: the unit test compared two readings of the clock, which
differ only when a millisecond passes between them. The unit test now holds the routine's clock
against the app's manual clock; the mutation run again alone is caught by `unit`
(`assets/43b_mutation_h13_unit_rerun.log`).

### 21.6 Findings and notes of the follow-up

| ID | Finding | Effect |
|---|---|---|
| F-5 | Confirmed by running, and located in `src/engine` (21.4) | For the engine's owner; a pending test waits in this folder |
| F-9 | Since D101 the epoch does not count resets: it also moves for a reset that failed after the engine was stopped, and by 2 in the one case of an unknown swap that did happen (21.2) | For W47, W53 and the client rows: count resets by the lineage or by `lastResetAt`, never by the epoch |
| F-10 | A detection of the first mutation check depended on the wall clock (21.5). Found because the second run caught the same mutation one project later | Fixed in the test; no production change |
| F-11 | If `engine.stop()` ever rejected inside the quiesce with the engine still running, the resync would be refused (`ENGINE_ALREADY_STARTED`) and the hold kept. The same was true of the reload before this follow-up. From reading `engine/host.ts` (`stopNow` catches its own last write); **not run** | None expected: the stop does not reject |

Not done in this follow-up: the case "the swap's outcome is unknown and the name points at the
OLD database" is still held on the recording host only (previous + 1); no socket; no listening
server. The four log files of the first round in `/tmp` (`w43_*.log`) were left, as told.

---
*Generated: 2026-10-04 16:33 WIB*
*Last Updated: 2026-10-04 17:01 WIB (section 21)*
