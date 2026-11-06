---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 56
plan_row: W34
title: Sessions module, operations 24 to 38 (the recording lifecycle; one active session per Core)
date: 2026-10-04
agent: coder-execution (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
source_spec: masterplan/01_specs.md rev 2.2 (§7.1, §7.2, §7.3, §7.8, §7.17, §8.6, Q16, AC-B-49, AC-B-50); masterplan/03_database_contract.md (§4.15, §4.16, MR-3, MR-5); gateway_check/01_gate_report.md (rules M1 to M15)
evidence_tier: 3
status: complete
---

# W34: the sessions module, operations 24 to 38

All times are WIB (UTC+7) on 2026-10-04. Commands ran from `/Users/gsp-budi/Documents/DEMS`.
Database commands ran with the per-command sandbox bypass (P10). Quoted runner output is
unchanged except that the sandbox's certificate warning lines are left out. Full output of the
final runs: `implementation/assets/34_gate.log`; the mutation log: `assets/34_mutations.log`.

**No password, token, cookie value, hash or other credential appears in this document.** The
demo password is named by its constant only; a session cookie is taken from a sign-in answer and
handed on in a header, never printed.

> **Sections 1 to 17 are the record of the row as it was gated at 15:40 (decision D94: PASS).**
> Section 18 is the follow-up the gate asked for: one error precedence for the stop reason and
> the note text. Where it supersedes a statement of sections 1 to 17, that statement carries a
> note "superseded by section 18". The final state of the folder and its final runs are in
> section 18.

## 1. Result

| Item | Result |
|---|---|
| Row tests, `unit` (3 files of the folder) | **Exit 0**: 3 files, 141 tests, 0 failed (15:36:39) (section 9.1) |
| Row tests, `db` (4 files, `DEMS_TEST_STEP=56`) | **Exit 0**: 4 files, 41 tests, 0 failed; 0 databases remain with the run prefix (15:36:42) (section 9.3) |
| MODG: route list against the registry | 15 routes, 15 registry operations of the tag Session, equal in method, path, operation ID and order; both lists printed (section 9.2) |
| MODG: statuses | Every status the registry documents for operations 24 to 38 was produced by a test and validated with `validateCoreApiResponse`; the test file keeps the ledger and compares it with the registry (section 4, section 9.2) |
| AC-B-49: two simultaneous creates | 40 rounds through HTTP against PostgreSQL: 40 times one 201 and one 409 `SESSION_ACTIVE`, never two sessions (winners `OPR-001` and `OPR-002`: 21 and 19 in the run of 14:49, 22 and 18 at 15:30, 24 and 16 in the final run of 15:36). Equal input, 20 rounds: one 201 and one 200 with `created: false`. Eight at once: one 201, seven 409 (section 6) |
| AC-B-50: a stop by another operator | The session of `OPR-001` is stopped by `OPR-002` with a reason of five characters: 202 `STOPPING`, the row `RECORDING_STOPPED` names `OPR-002`. A reason of four characters: 422 `INVALID_REASON`, no row, the recording goes on (section 5) |
| The journey against PostgreSQL through HTTP | create, start, marker, note, snapshot, stop, finalize, summary, acknowledge, history, next create, cancel: 18 steps, each with status, the two headers of API-7, the stored audit rows and the state after; the audit sequence equals the shared simulator's for the same journey (section 5) |
| The recovery after a restart fault | A session that was RECORDING when the process stopped is in FAULT after `start('boot')`; `recoverSession` answers 202 RECOVERY and writes `SYSTEM_BOOT`, `RECOVERY_STARTED` (the caller), `FAULT_CLEARED`; the engine closes it as INCOMPLETE with a RECORDED evidence item; the same types as the simulator (section 5.2) |
| Engine row finding F-11 | All 13 hosted actions of this module ran against PostgreSQL, among them the three the engine row had not run: `acknowledgePrecheckWarnings`, `retryPrecheck`, `cancel` (section 3) |
| Whole `unit` project | **Exit 0**: 102 files, 2,661 tests, 0 failed (15:37:02) (section 9.3) |
| Whole `db` project (`DEMS_TEST_STEP=56`) | **Exit 0**: 75 files, 1,081 tests, 0 failed; forced drops that needed a retry: 0; 0 databases remain with the run prefix (15:37:37) (section 9.3) |
| Typecheck, lint of the workspace | Exit 0 (15:39:23); exit 0 with no warning (15:39:29) (section 9.3) |
| Mutation check | 62 of 62 planted defects detected: 54 on a scratch copy, 8 of the history statement against PostgreSQL through a transform (section 10) |
| Other rows' tests | Three test files of the guard row pinned stand-in routes and the list of registered routes: reported at 14:36, ruled as decision D85 (that row's owner fixes them); green in every whole run of this row from 15:06 on; no file outside this folder was edited (section 12) |
| PostgreSQL | Never stopped or reconfigured: `.locks/postgres.pid` is 19121. No database with this row's prefix remains (section 15) |
| Not built | "Pause" and "resume", which the brief's journey names: neither the specification, nor the contract, nor the simulator has such an operation, action or state (finding F-1) |

## 2. What was written

Only `apps/core-server/src/modules/sessions/**` and this row's documents (rule M1). The stub
`index.ts` of the scaffold is replaced; its export `sessionsModule` keeps its name.

| File | Lines | Content |
|---|--:|---|
| `index.ts` | 64 | The plugin `sessionsModule` and the folder's exports. No boot step, no hook, no seam |
| `operations.ts` | 96 | The 15 operation IDs; `operationOf` (the registry entry); `actionOf` (the hosted action of a command, read from the contract's table `SIM_ACTION_OPERATIONS`, typed from the same table); `successesOf` (the 2xx statuses a handler answers, held against the registry at registration) |
| `routes.ts` | 354 | The 15 routes |
| `refusals.ts` | 130 | The module's own refusals: the open-session 404, the three `PRECHECK_*` answers of the composite start, `INVALID_REASON`, the refusals `createSession` reports in its result |
| `current.ts` | 42 | The answer of `getCurrentSession`, built with the simulator's own `toApiSession` |
| `history.ts` | 101 | The cursor and the one statement of `listSessionHistory` |
| `__tests__/routes.test.ts` | 1,024 | `unit`, 83 tests: MODG, who may call, every operation, the ledger of statuses |
| `__tests__/pure.test.ts` | 242 | `unit`, 42 tests: the binding, the refusals, the cursor, the monitor's answer |
| `__tests__/static.test.ts` | 194 | `unit`, 16 tests: rules M3, M4, M5, M8, M14 for the folder |
| `__tests__/journey.db.test.ts` | 502 | `db`, 16 tests: the journey and the recovery |
| `__tests__/concurrency.db.test.ts` | 166 | `db`, 5 tests: AC-B-49 |
| `__tests__/operations.db.test.ts` | 353 | `db`, 7 tests: the remaining actions, what a unit sends, who may call |
| `__tests__/history.db.test.ts` | 220 | `db`, 13 tests: paging over the bulk template's 520 rows |
| `__tests__/support.ts` | 166 | Test support for the database tests: the booted app, signed-in callers |
| `__tests__/memory-engine.ts` | 260 | Test support for the unit tests: the shared simulator behind the engine seam |

The module owns no table and adds no dependency. It imports from six folders of the server and
no other (a static test pins the list): `engine`, `plugins/permission-guard`,
`plugins/error-envelope`, `plugins/logger`, `db/schema`, `db/mapping`.

## 3. The operation table

"Recipe" is the handler recipe of rule M13. `command` is `app.engine.command(request.principal,
action, ...args)`: one hosted action, one unit. `run` is `app.engine.run('sessions.<operationId>',
…)`: one unit in which the module first checks that `{id}` is the open session (section 3.1) and
then runs the hosted action through `scope.command`. Both answer after the unit resolved, with
`x-dems-epoch` and `x-dems-revision` from the outcome. The action of each command is read from
`SIM_ACTION_OPERATIONS` at registration (`actionOf`), not typed again; a test prints the table.

| # | operationId | Recipe | Hosted action | Arguments (from the request) | Success | State named in the body |
|--:|---|---|---|---|---|---|
| 24 | `createSession` | `command` | `createSession` | the body, as the schema stage parsed it (`SessionCreateRequest`) | 201; 200 for equal input | CREATE; for a replay the state of the open session, read from the committed state |
| 25 | `startSession` | `run`, composite (section 3.2) | `startRecording`; also `beginPrecheck` and `acknowledgePrecheckWarnings` | none | 202 from CREATE; 200 from ARMED or from an acknowledged warning | PRECHECK; RECORDING |
| 26 | `stopSession` | `run` | `stopRecording` | `body.reason` (trimmed by the schema) | 202 | STOPPING |
| 27 | `getCurrentSession` | read: `app.engine.state()` and `app.clock.now()` | none | none | 200 | — |
| 28 | `beginPrecheck` | `run` | `beginPrecheck` | none | 202 | PRECHECK |
| 29 | `retryPrecheck` | `run` | `retryPrecheck` | none | 202 | PRECHECK |
| 30 | `acknowledgePrecheckWarnings` | `run` | `acknowledgePrecheckWarnings` | none | 200 | ARMED |
| 31 | `cancelSession` | `run` | `cancel` | none | 204 | — |
| 32 | `scanCaseNumber` | `command` | `scanCaseNumber` | none | 200 `{ caseNumber }` (the action's return value) | — |
| 33 | `recoverSession` | `run` | `recover` | none | 202 | RECOVERY |
| 34 | `addSessionMarker` | `run` | `addMarker` | `body.label` (trimmed; absent or empty: the Core names it "Marker n") | 204 | — |
| 35 | `addSessionNote` | `run` | `addNote` | `body.text` (trimmed) | 204 | — |
| 36 | `takeSessionSnapshot` | `run` | `snapshot` | none | 204 | — |
| 37 | `acknowledgeSessionSummary` | `command` | `acknowledgeSummary` | the `{id}` of the path | 204 | — |
| 38 | `listSessionHistory` | read: PostgreSQL, one statement on `app.db.pool` (section 7) | none | `cursor`, `limit` | 200 | — |

Reads, stated per operation (row rule 2): operation 27 answers from the engine's committed state
and sends no statement; operation 38 answers from PostgreSQL.

All 13 hosted actions ran against PostgreSQL through HTTP (engine row finding F-11): the journey
runs `createSession`, `beginPrecheck`, `startRecording`, `addMarker`, `addNote`, `snapshot`,
`stopRecording`, `acknowledgeSummary`, `cancel`, `recover`; `operations.db.test.ts` runs
`retryPrecheck`, `acknowledgePrecheckWarnings`, `scanCaseNumber`.

### 3.1 The `{id}` of the path

No action of the simulator takes a session ID: each acts on the one session of the store. The
simulator's REST layer compares the ID first (`sim/api.ts`, `currentSession`), and so does this
module: `session !== null && session.id === id`, where a session in any state counts (a SEALED
one too, as today). Otherwise 404 `NOT_FOUND` with `details.simCode: NOT_FOUND`.

The comparison is made **inside the unit**, on `scope.pending().session`, before the action.
Reason: between a check made on the committed state and the unit, another operator's units can
cancel that session and create the next one; the action would then change a session the caller
never named. A unit test produces exactly that order and gets 404 with the new session untouched
(`routes.test.ts`, "a session that was replaced while a request waited …"); mutation M01 (the ID
is not compared) fails six tests.

`scope.pending()` is read in this one place and only for this decision (a static test pins it);
no answer is built from it.

Operation 37 is the exception the contract names: its `{id}` is the action's argument, and a
repeat or another ID answers 204 with nothing stored.

### 3.2 The composite start (operation 25)

The specification keeps the design-book behaviour of `sim/api.ts`. One unit:

| The open session is | With `acknowledgeWarnings: true` | What the unit does | Answer |
|---|---|---|---|
| CREATE | either | `beginPrecheck` | 202 PRECHECK, no audit row (NONE-P) |
| PRECHECK, checks running | either | nothing | 409 `PRECHECK_RUNNING` (`simCode: CHECKS_RUNNING`) |
| PRECHECK, outcome BLOCK | either | nothing | 409 `PRECHECK_BLOCKED`, text "Start blocked: " and the blocking checks |
| PRECHECK, outcome WARN | no | nothing | 409 `PRECHECK_WARNINGS` |
| PRECHECK, outcome WARN | yes | `acknowledgePrecheckWarnings`, then `startRecording` | 200 RECORDING; `PRECHECK_PASSED` and `RECORDING_STARTED`, both by the caller, in one transaction and one state change |
| ARMED | either | `startRecording` | 200 RECORDING |
| any other state | either | `startRecording`, which the simulator refuses | 409 `INVALID_STATE` (`simCode: ILLEGAL_STATE`, `from`, `event`) |

The three `PRECHECK_*` answers are the module's (no hosted action refuses with them); every
other refusal is the simulator's own. Two unit tests run the same requests against the server
and against a twin simulator's REST layer (`sim.request`) and compare status, error code and
success body step by step: 23 requests of a recording with a warning, and a blocked pre-check
with its text. No difference.

### 3.3 The stop reason (operation 26)

> **Superseded by section 18 (decision D94).** The order described here (a short reason answered
> by the schema stage, before 404 and 409) was not accepted. The table below is the first
> gate's state; section 18.2 has the order that is built now.

The schema stage refuses a reason shorter than five characters; the module maps that refusal to
422 `INVALID_REASON` with `details.simCode: REASON_TOO_SHORT` (decision D50). The route takes
the validation failure as `request.validationError` (`attachValidation`), and the first line of
the handler answers it: `INVALID_REASON` when every issue is about the member `reason` and is
"too small" or "no text at all" (absent, null, a number); otherwise the failure is thrown as it
is and the error envelope answers 422 `INVALID_INPUT` with `details.in`. These are the bodies the
simulator's REST layer answers `INVALID_REASON` too.

| Body | Answer | Test |
|---|---|---|
| `{ reason: 'Done' }`, `{ reason: '   ab   ' }`, `{ reason: '' }`, `{}`, `{ reason: null }`, `{ reason: 12345 }`, no body | 422 `INVALID_REASON` | `routes.test.ts`, 26, seven cases |
| a reason with U+0000 or an unpaired surrogate | 422 `INVALID_INPUT`, `in: body` | `routes.test.ts`, 26 |
| a malformed `{id}`, with any reason | 422 `INVALID_INPUT`, `in: params` | `routes.test.ts`, 26 |
| a body that is no JSON object | 400 `INVALID_JSON` | `routes.test.ts`, 26 |
| `{ reason: 'Done.' }` (five characters) | 202 | `journey.db.test.ts`, AC-B-50 |

`cancelSession` takes no body in the contract and `cancel` takes no reason in the simulator: the
"cancel reason" of the brief has nothing to be checked against (finding F-2).

## 4. Statuses, per operation, with the test for each

The registry's documented statuses, generated by the last test of `routes.test.ts` from its
ledger (the same in the final run of 15:36:39; `assets/34_gate.log`). The test fails when a documented status was not
produced in that file, or when an answer did not validate against the contract.

```
[w34] MODG statuses produced and validated against the contract, per operation:
[w34]   createSession: 200 (success); 201 (success); 400 (INVALID_JSON); 401 (NOT_SIGNED_IN); 403 (NOT_PERMITTED); 409 (SESSION_ACTIVE); 422 (INVALID_INPUT)
[w34]   startSession: 200 (success); 202 (success); 400 (INVALID_JSON); 401 (NOT_SIGNED_IN); 403 (NOT_PERMITTED); 404 (NOT_FOUND); 409 (INVALID_STATE, PRECHECK_BLOCKED, PRECHECK_RUNNING, PRECHECK_WARNINGS); 422 (INVALID_INPUT)
[w34]   stopSession: 202 (success); 400 (INVALID_JSON); 401 (NOT_SIGNED_IN); 403 (NOT_PERMITTED); 404 (NOT_FOUND); 409 (INVALID_STATE); 422 (INVALID_INPUT, INVALID_REASON)
[w34]   getCurrentSession: 200 (success); 401 (NOT_SIGNED_IN); 403 (DEVICE_REVOKED)
[w34]   beginPrecheck: 202 (success); 401 (NOT_SIGNED_IN); 403 (NOT_PERMITTED); 404 (NOT_FOUND); 409 (INVALID_STATE); 422 (INVALID_INPUT)
[w34]   retryPrecheck: 202 (success); 401 (NOT_SIGNED_IN); 403 (NOT_PERMITTED); 404 (NOT_FOUND); 409 (INVALID_STATE, PRECHECK_RUNNING); 422 (INVALID_INPUT)
[w34]   acknowledgePrecheckWarnings: 200 (success); 401 (NOT_SIGNED_IN); 403 (NOT_PERMITTED); 404 (NOT_FOUND); 409 (INVALID_STATE, PRECHECK_RUNNING); 422 (INVALID_INPUT)
[w34]   cancelSession: 204 (success); 401 (NOT_SIGNED_IN); 403 (NOT_PERMITTED); 404 (NOT_FOUND); 409 (INVALID_STATE); 422 (INVALID_INPUT)
[w34]   scanCaseNumber: 200 (success); 401 (NOT_SIGNED_IN); 403 (NOT_PERMITTED)
[w34]   recoverSession: 202 (success); 401 (NOT_SIGNED_IN); 403 (NOT_PERMITTED); 404 (NOT_FOUND); 409 (INVALID_STATE); 422 (INVALID_INPUT)
[w34]   addSessionMarker: 204 (success); 400 (INVALID_JSON); 401 (NOT_SIGNED_IN); 403 (NOT_PERMITTED); 404 (NOT_FOUND); 409 (INVALID_STATE); 422 (INVALID_INPUT)
[w34]   addSessionNote: 204 (success); 400 (INVALID_JSON); 401 (NOT_SIGNED_IN); 403 (NOT_PERMITTED); 404 (NOT_FOUND); 409 (INVALID_STATE); 422 (INVALID_INPUT)
[w34]   takeSessionSnapshot: 204 (success); 401 (NOT_SIGNED_IN); 403 (NOT_PERMITTED); 404 (NOT_FOUND); 409 (INVALID_STATE); 422 (INVALID_INPUT)
[w34]   acknowledgeSessionSummary: 204 (success); 401 (NOT_SIGNED_IN); 403 (NOT_PERMITTED); 422 (INVALID_INPUT)
[w34]   listSessionHistory: 200 (history.db.test.ts); 401 (NOT_SIGNED_IN); 403 (DEVICE_REVOKED); 422 (INVALID_INPUT)
```

Where each status is tested. `R` is `routes.test.ts` (the block named), `J` `journey.db.test.ts`,
`O` `operations.db.test.ts`, `C` `concurrency.db.test.ts`, `H` `history.db.test.ts`.

| Status, code | Who produces it | Tests |
|---|---|---|
| 401 `NOT_SIGNED_IN`, all 15 | stage 6 | R "who may call": nobody without a session, 401 on all fifteen; O "who may call" against PostgreSQL |
| 403 `NOT_PERMITTED`, the 13 commands | stage 6, with ONE `ACCESS_DENIED` row by the guard | R "who may call": a TECHNICIAN on the thirteen commands; O: the stored row names actor, operation, permission, role |
| 403 `DEVICE_REVOKED`, the two reads | stage 6 | R "who may call": a retired device |
| 400 `INVALID_JSON`, the five operations with a body | stage 7 | R blocks 24, 25, 26, 34, 35 |
| 422 `INVALID_INPUT`, schema | stage 7 | R: body (24, 25, 26, 34, 35), `{id}` (all eleven with one), query (38) |
| 422 `INVALID_INPUT`, the simulator's result | `createSession` | R 24: an investigator who does not exist or may not start sessions |
| 422 `INVALID_INPUT`, the cursor | the module | R 38; `pure.test.ts`, 18 cursors that are no position |
| 422 `INVALID_REASON` | the module, from the schema stage's refusal | R 26; J AC-B-50; `pure.test.ts` | Superseded by section 18: the hosted action decides it now |
| 404 `NOT_FOUND` | the module, inside the unit | R "the {id} of the path": ten operations, with and without an open session; O: against PostgreSQL |
| 409 `SESSION_ACTIVE` | the simulator's result | R 24; J; C |
| 409 `PRECHECK_RUNNING`, `PRECHECK_WARNINGS`, `PRECHECK_BLOCKED` | the module (25); the simulator (29, 30: `CHECKS_RUNNING`) | R 25, R 29, R 30; O "the pre-check that blocks", "… ends with a warning" |
| 409 `INVALID_STATE` | the simulator's refusal, mapped by the engine | R: 25 from four states, 26, 28, 29, 30, 31 from four states, 33, 34, 35, 36; J recovery; O |
| 2xx | | R each block; J; O; C; H |
| 503 `NOT_READY` (envelope level) | the engine, the database | R: a unit that could not run; the monitor while the engine is stopped; the history while the database does not answer |

## 5. The journey against PostgreSQL, beside the simulator

`journey.db.test.ts`: the real app, booted on a clone of the seed (a process start: the epoch
moves on by 1, the tablet link is OFFLINE), on a manual clock and a manual timer; the seeded
INVESTIGATOR (`OPR-001`) and SUPERVISOR (`OPR-002`) signed in on the web console; every request
passes the real stages. The tablet link is set CONNECTED through `app.engine.setTabletLink`
first, as the realtime channel will do when the tablet connects: without it the pre-check ends
with a block (section 13, DN-8).

After every command the test asserts: the documented status; a body the contract accepts;
`x-dems-epoch` equal to the engine's epoch and `x-dems-revision` equal to the engine's revision
(neither on a refusal); the stored chain head equal to the engine's (the answer came after the
commit); every stored row stamped with the server clock; no `Set-Cookie`.

The same journey runs on a headless `Sim` of `@dems/shared/sim` (`createHost`, the same actions
as the same operators at the same instants). The test compares, step by step, the audit types and
the state after; and over the whole journey the types and who each row names. The arrivals of the
recording's integrity stream (`FRAME_HASH`, `WRITE_VERIFIED`, `TIMESTAMP_CONFIRMED`) are left
out of the comparison of the timed phases: they are drawn from the random streams, which a
process start re-derives from the epoch (the line "(recording)" below shows one on the simulator
and none on the server).

Run of 14:38:40 (the same, line for line, in the final run of 15:36:42):

```
[w34] journey through HTTP against PostgreSQL, beside the shared simulator (session SES-20261001-0024; 11 audit rows, 11 without the integrity stream):
[w34]   step                                    status  revision  state      audit rows stored (server) | (simulator)
[w34]   createSession                           201     4         CREATE     SESSION_CREATED | SESSION_CREATED
[w34]   createSession (equal input)             200     4         CREATE     - | -
[w34]   createSession (other input)             409     4         CREATE     - | -
[w34]   startSession (from CREATE)              202     5         PRECHECK   - | -
[w34]   (the eight checks resolve)              -       17        ARMED      PRECHECK_PASSED | PRECHECK_PASSED
[w34]   startSession (from ARMED)               200     18        RECORDING  RECORDING_STARTED | RECORDING_STARTED
[w34]   (recording)                             -       21        RECORDING  - | WRITE_VERIFIED
[w34]   addSessionMarker                        204     22        RECORDING  MARKER_ADDED | MARKER_ADDED
[w34]   addSessionNote                          204     23        RECORDING  NOTE_ADDED | NOTE_ADDED
[w34]   takeSessionSnapshot                     204     24        RECORDING  SNAPSHOT_TAKEN | SNAPSHOT_TAKEN
[w34]   stopSession (four characters)           422     24        RECORDING  - | -
[w34]   stopSession (by another operator)       202     25        STOPPING   RECORDING_STOPPED | RECORDING_STOPPED
[w34]   (stopping, finalisation, seal)          -       52        SEALED     EVIDENCE_SEALED | EVIDENCE_SEALED
[w34]   acknowledgeSessionSummary               204     53        SEALED     SUMMARY_ACKNOWLEDGED | SUMMARY_ACKNOWLEDGED
[w34]   acknowledgeSessionSummary (repeat)      204     53        SEALED     - | -
[w34]   acknowledgeSessionSummary (another ID)  204     53        SEALED     - | -
[w34]   createSession (after the seal)          201     54        CREATE     SESSION_CREATED | SESSION_CREATED
[w34]   cancelSession                           204     55        none       SESSION_CANCELLED | SESSION_CANCELLED
```

```
[w34] AC-B-50: session SES-20261001-0024 created by OPR-001, stopped by OPR-002 with a reason of 5 characters: 202 STOPPING, row RECORDING_STOPPED actor OPR-002; four characters: 422 INVALID_REASON, no row
```

What else the journey shows:

| Point | Evidence in the test |
|---|---|
| Rows of a command name the caller; rows of the engine name nobody | `PRECHECK_PASSED` by the engine names the creator with `details.by: system` (decision D28 D-2); the rows of the finalisation have `actorId` null |
| The note text is in the session and not in its audit row | `NOTE_ADDED` holds the note ID and its length |
| Summary | `getCurrentSession` shows the SEALED session with its evidence ID and `sealedAt`; `lastSealedSessionId` is the session, `lastSealedAcknowledged` false, then true |
| The sealed evidence item is the engine's | `evidence_items` holds one row for the session with status SEALED; this module has no evidence route |
| History | The newest entry of `listSessionHistory` is the session, SEALED, with its evidence ID; it equals the entry of the engine's committed slice |
| Engine row finding F-7 | The SEALED session stays the current one after the acknowledgement, until the next create replaces it (201) |
| A cancelled session | No history entry, no evidence item |
| After the journey | The stored chain verifies over all rows; the tables hold the engine's committed state; no error line in the log |

"Pause" and "resume" are not steps of the journey: they do not exist (finding F-1).

### 5.1 The same statuses as the simulator's REST layer (API-1)

> The second of the two differences named below (a short stop reason before the session) no
> longer exists: superseded by section 18.3.

`routes.test.ts`, block "API-1": the four design-book operations, 23 requests in order against
the server and against `sim.request` of a twin simulator: no difference in status, error code or
success body. Two differences exist by the specification and are asserted as such: the server
answers 401 before it reads a body (the simulator answers 400 first, spec §7.3), and a short stop
reason is answered before the session is looked at (decision D50; section 13, DN-2).

`getCurrentSession` is the simulator's own REST answer for a session in each of nine states
(`routes.test.ts`, block 27) and for the scenarios `recording`, `finalizing` and `fault-demo`
(`pure.test.ts`).

### 5.2 The recovery after a restart fault

`journey.db.test.ts`, second block: a recording 10 s in; the app is closed; a new app is built on
the same database 90 s later and booted (`start('boot')`).

```
[w34] recovery: RECORDING at the stop (epoch 1) -> boot (epoch 2): FAULT_RAISED POWER_FAIL at the last committed instant, no actor; recover 202 RECOVERY: SYSTEM_BOOT, RECOVERY_STARTED (OPR-002), FAULT_CLEARED; then SESSION_INCOMPLETE, RECOVERY_COMPLETED; history INCOMPLETE, evidence RECORDED | simulator: SYSTEM_BOOT, RECOVERY_STARTED, FAULT_CLEARED; SESSION_INCOMPLETE, RECOVERY_COMPLETED
```

| Step | Status, headers | Audit rows stored | State after |
|---|---|---|---|
| `recoverSession` while RECORDING (before the stop) | 409 `INVALID_STATE`, `details: { simCode: ILLEGAL_STATE, from: RECORDING, event: recover }` | none | RECORDING |
| The boot of the new process | — | `FAULT_RAISED` (`POWER_FAIL`, no actor, at the last committed instant) | FAULT, epoch + 1 |
| `getCurrentSession` with the cookie of before the restart | 200 | none | FAULT, `fault: { kind: POWER_FAIL, fromState: RECORDING }`, the fault 10 s after the start |
| `stopSession`, `cancelSession` in FAULT | 409 `INVALID_STATE` | none | FAULT |
| `recoverSession` by the SUPERVISOR | 202, `{ state: RECOVERY }`, epoch and revision + 1 | `SYSTEM_BOOT` (no actor), `RECOVERY_STARTED` (`OPR-002`), `FAULT_CLEARED` (no actor) | RECOVERY |
| 4 s of the engine | — | `SESSION_INCOMPLETE`, `RECOVERY_COMPLETED` (no actor) | no session |
| `listSessionHistory` | 200 | none | newest entry INCOMPLETE, `faultKind: POWER_FAIL`, `durationMs: 10000`; evidence item RECORDED, never sealed |

The simulator's rows for a power failure while recording followed by `recover` are the same
types with the same actor pattern. The chain verifies over the rows of both processes.

One value differs from what a reader expects: `elapsedMs` of the faulted session is 100,000 ms,
not 10,000 (finding F-9, `SIM-GAP-W34-1`).

## 6. One active session per Core (AC-B-49)

`concurrency.db.test.ts`, through HTTP against PostgreSQL. Two requests are in flight together;
nothing orders them but the engine's serial pipeline. The rounds alternate who is sent first; in
every other round a tick of the engine is queued beside them.

Run of 14:49:52; the final run of 15:36:42 prints the same with the winners 24 and 16.

```
[w34] AC-B-49: 40 rounds of two simultaneous creates with different input: 40 x (201, 409 SESSION_ACTIVE), never two sessions; winners OPR-001 21, OPR-002 19; a tick of the engine queued beside them in 20 rounds
```

| Case | Result, each round |
|---|---|
| Different input, 40 rounds | Statuses `[201, 409]`; the 409 is `SESSION_ACTIVE` and names the winner's session in `details.sessionId`; `active_session` holds exactly one row, the winner's; exactly one `SESSION_CREATED` row, by the winner; API-7 headers on the 201 only |
| Equal input, 20 rounds | Statuses `[200, 201]`; the 200 answers the same session with `created: false`; one row |
| Eight at once | One 201, seven 409 naming that session; one row |
| A create and a cancel of the open session at once, 10 rounds | The cancel is 204; the create is 201 or 409 by the order of the units; never more than one session |
| After all rounds | The chain verifies over every row; the tables hold the committed state; no error line |

"One session" is also a database rule: `active_session` is a singleton by its primary key.

## 7. `listSessionHistory`: PostgreSQL, a keyset page

| Point | Statement |
|---|---|
| Source | One statement per call on `app.db.pool` (a read: no unit). The typed builder; each row becomes a `SessionHistoryEntry` through the mapping module's `sessionHistoryFromRow` (no second mapping); `evidenceId` is the evidence item of the session by a LEFT JOIN on the unique key (MR-5) |
| Order | `(ended_at DESC, id DESC)`: the index `session_history_ended_at_idx` and the order of the engine's slice (MR-3). `id` is the primary key, so the order is total |
| Cursor | `<endedAt>-<session ID>` of the last item of a page, for example `1790819100000-SES-20261001-0022`; it fits `LIST_CURSOR_PATTERN`. The next page is everything after that position |
| `limit` | The schema's 1 to 200; 50 when omitted (`API_PAGE_LIMIT_DEFAULT`). The statement asks for one row more than the page to know whether another follows |
| A cursor that is no position | 422 `INVALID_INPUT`, `in: querystring`, no statement |
| The database does not answer | 503 `NOT_READY`; one error line under the key `err` (rule M14); one entry in the persistent error log (name, code, stack frames); the readiness probe is asked |

**No `seq` here.** The brief says "page by `seq`, never by `at`". `session_history` has no
sequence column (database contract §4.16); the keyset above is the stable order that contract
gives the list (its index is named for `listSessionHistory`). Nothing in the tests compares two
instants to decide an order: every expectation is the keyset read from the table as `dems_owner`.

`history.db.test.ts` on a clone of the bulk template (520 rows; the app BOOTED on it at
`BULK_TEMPLATE_NOW`, a seeded operator signed in). The last two cases run on a clone of the seed
with rows the test inserts as `dems_owner`, the app ready and not booted (the read needs no engine):

| Case | Result |
|---|---|
| No query | 50 items, the newest first; the cursor names the 50th |
| Pages of 200 | 200, 200, 120; cursor on the first two only; 520 distinct IDs in the stored order |
| Pages of 1, 7, 50, 199 | 520, 75, 11 and 3 pages; the same 520 in the same order, none twice, none missing |
| Pages of 104 (520 = 5 x 104) | The fifth page is full and has no cursor; the cursor of the last item gives an empty page |
| Items | Equal to the engine's committed `sessionHistory` slice, entry for entry; five entries have no evidence item |
| A cursor between two rows | Continues after that position: a cursor is a position, not a row |
| Three sessions that ended in the same millisecond | Paged by their IDs, each once, for page sizes 1 to 4 |
| A session finishes while a client pages | It is neither repeated nor does it shift an item of a later page |

```
[w34] listSessionHistory on 520 rows, a page of 50 from the middle: median 2.61 ms, max 3.20 ms (whole request); plan: Limit  (cost=0.55..56.70 rows=51 width=191) / ->  Nested Loop Left Join  (cost=0.55..285.71 rows=259 width=191) / ->  Index Scan using session_history_ended_at_idx on session_history h  (cost=0.28..57.95 rows=259 width=174) / Index Cond: (ROW(ended_at, id) < ROW('1788086590000'::bigint, 'SES-20260830-0284'::text)) / ->  Index Scan using evidence_items_session_id_key on evidence_items e  (cost=0.28..0.88 rows=1 width=35) / Index Cond: (session_id = h.id)
```

## 8. Measured round trips for one command

`operations.db.test.ts`, run of 14:52:14. The counting pool records the statements sent on
unit-of-work connections; the reads of stage 4 go through `pool.query` and are not in the count.

```
[w34] one command through HTTP (addSessionMarker), statements on unit-of-work connections: the engine's unit, 11 statements in one transaction: BEGIN ISOLATION LEVEL READ COMMITTED | SELECT seq, hash FROM public.audit_chain_loc | SELECT set_config('statement_timeout', $1, t | select "id", "username", "rank", "name", "di | insert into "audit_log" ("seq", "id", "at",  | insert into "events" ("seq", "id", "at", "ty | UPDATE public.engine_counters SET next_value | update "engine_counters" set "next_value" =  | update "engine_counters" set "next_value" =  | update "active_session" set "marker_count" = | COMMIT; before it, when the clock moved since the caller's last POST, the identity module's activity unit of 5 statements; takeSessionSnapshot x30 (whole request, stages included) wall time: median 3.40 ms, min 2.62 ms, max 4.95 ms
```

| Request | Statements on unit connections |
|---|---|
| A command that changes the session (`addSessionMarker`) | 11, one transaction: the engine row's recipe, unchanged by this module |
| The same, when the server clock moved since the caller's last POST | 5 more before it: the identity module's unit that moves `auth_sessions.last_seen_at` on |
| The composite start with acknowledged warnings | One transaction, two audit inserts, one state change |
| A refusal the simulator decides (a stop in CREATE) | 5: `BEGIN`, the chain lock, the timeout, the operators, `ROLLBACK` |
| A request that names another session (404) | **0**: the unit opens its transaction at its first write, and the module refuses before one |
| `getCurrentSession` | 0 |
| `listSessionHistory` | 1 on the pool (the folder holds one `select`; a static test pins it) |

Wall time of a whole request on this host, with other rows' suites running: median 3.40 ms at
14:52, 6.14 ms at 14:53 and 4.37 ms at 15:36 for the same 30 snapshots. A history page of 50 from
the middle of 520 rows: median 2.61 ms at 14:53, 2.02 ms at 15:36.

## 9. Verification

### 9.1 The row's own tests (final state)

`unit`, 15:36:39 (`assets/34_gate.log`, block 1), exit 0:

```
> vitest run --project unit --maxWorkers=2 --reporter=verbose src/modules/sessions
 Test Files  3 passed (3)
      Tests  141 passed (141)
   Start at  15:36:39
```

`db`, 15:36:42 (block 2), exit 0: 4 files, 41 tests; quoted in section 9.3.

### 9.2 MODG: the two lists

```
[w34] MODG routes of src/modules/sessions (15):
[w34]   POST /api/v1/session createSession
[w34]   POST /api/v1/session/{id}/start startSession
[w34]   POST /api/v1/session/{id}/stop stopSession
[w34]   GET /api/v1/session/current getCurrentSession
[w34]   POST /api/v1/session/{id}/precheck beginPrecheck
[w34]   POST /api/v1/session/{id}/precheck/retry retryPrecheck
[w34]   POST /api/v1/session/{id}/precheck/acknowledge acknowledgePrecheckWarnings
[w34]   POST /api/v1/session/{id}/cancel cancelSession
[w34]   POST /api/v1/session/case-number scanCaseNumber
[w34]   POST /api/v1/session/{id}/recover recoverSession
[w34]   POST /api/v1/session/{id}/markers addSessionMarker
[w34]   POST /api/v1/session/{id}/notes addSessionNote
[w34]   POST /api/v1/session/{id}/snapshots takeSessionSnapshot
[w34]   POST /api/v1/session/{id}/summary/acknowledge acknowledgeSessionSummary
[w34]   GET /api/v1/session/history listSessionHistory
[w34] MODG registry, tag Session (15):
[w34]   POST /api/v1/session createSession
[w34]   POST /api/v1/session/{id}/start startSession
[w34]   POST /api/v1/session/{id}/stop stopSession
[w34]   GET /api/v1/session/current getCurrentSession
[w34]   POST /api/v1/session/{id}/precheck beginPrecheck
[w34]   POST /api/v1/session/{id}/precheck/retry retryPrecheck
[w34]   POST /api/v1/session/{id}/precheck/acknowledge acknowledgePrecheckWarnings
[w34]   POST /api/v1/session/{id}/cancel cancelSession
[w34]   POST /api/v1/session/case-number scanCaseNumber
[w34]   POST /api/v1/session/{id}/recover recoverSession
[w34]   POST /api/v1/session/{id}/markers addSessionMarker
[w34]   POST /api/v1/session/{id}/notes addSessionNote
[w34]   POST /api/v1/session/{id}/snapshots takeSessionSnapshot
[w34]   POST /api/v1/session/{id}/summary/acknowledge acknowledgeSessionSummary
[w34]   GET /api/v1/session/history listSessionHistory
```

| MODG item | Where |
|---|---|
| Route list equals the registry operations, both printed | `routes.test.ts`, first block, above |
| Request and response schemas are the registry's | Same block: `schema.body`, `schema.querystring` and each `schema.response[status]` are the very objects of `CORE_API_SCHEMAS`; a 204 has no response schema; `{id}` is held to the registry's pattern |
| Every documented status has a test and every answer validates | Section 4 |
| The role-by-operation decision is the guard's | One allowed and one refused call per operation: `routes.test.ts`, block "who may call"; against PostgreSQL in `operations.db.test.ts` |
| Rule M3 as a static test for the folder | `static.test.ts`: no permission or role named, no member of the principal read, no denial row, no hook, no stage or seam touched; the principal is only ever an argument of a hosted command (13 call sites) |
| Typecheck and lint | Section 9.3 |
| Mutation check | Section 10 |

### 9.3 Whole projects, typecheck, lint

Final state: after the last change of a file of the folder (15:36:20, the timeouts of the four
database test files; finding F-15). Full output: `assets/34_gate.log`.

The row's `db` tests, 15:36:42:

```
> vitest run --project db --maxWorkers=2 --reporter=verbose src/modules/sessions
 Test Files  4 passed (4)
      Tests  41 passed (41)
   Start at  15:36:42
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 3 database(s) in 141 ms; 0 remain with the run prefix dems_test_step_56_tmdjx601_
```

The whole `unit` project, 15:37:02, exit 0:

```
> vitest run --project unit --maxWorkers=2
 Test Files  102 passed (102)
      Tests  2661 passed (2661)
   Start at  15:37:02
   Duration  34.92s (import 59%, tests 36%, transform 4%, worker 1%)
```

The whole `db` project, 15:37:37, `DEMS_TEST_STEP=56`, exit 0:

```
> vitest run --project db --maxWorkers=2
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_56_tmdjyq4y_
[test:db] stale sweep: dropped 0; kept 8 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
 Test Files  75 passed (75)
      Tests  1081 passed (1081)
   Start at  15:37:38
   Duration  104.20s (tests 84%, import 15%, transform 2%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 8 database(s) in 672 ms; 0 remain with the run prefix dems_test_step_56_tmdjyq4y_
```

Typecheck, 15:39:23, and lint, 15:39:29:

```
> @dems/core-server@0.2.0 typecheck
> tsc --noEmit
exit 0
> @dems/core-server@0.2.0 lint
> oxlint
exit 0
```

Lint printed no warning.

Every run of the whole projects by this row (P11):

| Time | Project | Result |
|---|---|---|
| 15:06:41 | `unit` | 101 files, 2,647 tests, exit 0 |
| 15:07:39 | `db` | 74 files, 1,071 tests, exit 0; 0 remain |
| 15:30:29 | `unit` | 102 files, 2,661 tests, exit 0 |
| 15:32:47 | `db` | 75 files, 1,081 tests, exit 0; 0 remain |
| 15:37:02 | `unit` | 102 files, 2,661 tests, exit 0 (final) |
| 15:37:37 | `db` | 75 files, 1,081 tests, exit 0; 0 remain (final) |

No whole-project run of this row was red. Reds seen in single commands, none in this folder:
14:33, `guard.test.ts` 18 failed of 29 (section 12, decision D85); 14:32 and 14:33, a typecheck
error in `src/modules/admin/__tests__/rule.test.ts` and a lint warning in
`src/modules/admin/__tests__/static.test.ts`; 14:57, a typecheck error in
`src/modules/storage/index.ts`. Each was another row's work in flight and was gone at the next
run.

## 10. Mutation check

62 single changes of the module's own logic, each applied alone and the tests run; 62 detected
(`assets/34_mutations.log`).

| Batch | Where it ran | Tests | Result |
|---|---|---|---|
| M01 to M54 (routes 30, refusals 11, operations 3, history 7, current 3: the ID check, every branch of the composite start, the stop reason, the status and the state of each answer, the arguments of each action, the headers of API-7, the unit labels, the cursor, the log key, the refusal mapping) | A scratch copy of `apps/core-server` under `$TMPDIR`, deleted afterwards | The folder's `unit` tests | 54 of 54 detected (15:00:29 to 15:04:23) |
| D01 to D08 (the history statement: `<` against `<=`, the tie-break order, the extra row, the last full page, the join, the evidence ID, a keyset without the ID, the default limit) | The tree's own files, the mutation applied by a transform in a separate runner config under the temp directory: no file on disk changes (rule M15); the SHA-256 of `history.ts` was equal before and after | `history.db.test.ts` | 8 of 8 detected (15:14:42 to 15:34:05; the runs waited up to three minutes each for the clone lock under other rows' load) |

Some of them: M01 (the `{id}` is not compared) fails 6 tests; M07 (warnings acknowledged without
the flag) 2; M12 (the stop ignores the schema stage's refusal) 11; M37 (no `details.simCode`) 16;
M46 (the error logged under another key) 2; D01 (`<=`) 9; D07 (a keyset without the ID) 1.
In three of the eight transform runs one test more failed than in the earlier run of the same
mutation (D01 9 against 8, D03 10 against 9, D06 2 against 1): a test of the file ran out of its
five seconds on the loaded host (finding F-15).

Deviation DV-5: the eight D mutations were first run IN PLACE on `history.ts`, 15:04:51 to
15:06:36, before rule M15 was issued; the file's SHA-256 was equal before and after, and the
controller was told at once. They were then re-run through the transform.

## 11. Test ledger (P24)

Controller baseline of 14:11: `unit` 77 files / 1,992 tests; `db` 48 files / 740 tests. Final
runs: `unit` 102 files / 2,661 tests; `db` 75 files / 1,081 tests. Other module rows and the fix
rows added files in the same hour, so the difference to the baseline (25 files and 669 tests in
`unit`, 27 files and 341 tests in `db`) holds their additions too; this row's share is the table
below, counted from the verbose run of the folder.

| Project | This row's new files | Tests |
|---|---|--:|
| `unit` | `src/modules/sessions/__tests__/routes.test.ts` | 83 |
| `unit` | `src/modules/sessions/__tests__/pure.test.ts` | 42 |
| `unit` | `src/modules/sessions/__tests__/static.test.ts` | 16 |
| `unit` | total: 3 files | **141** |
| `db` | `src/modules/sessions/__tests__/journey.db.test.ts` | 16 |
| `db` | `src/modules/sessions/__tests__/concurrency.db.test.ts` | 5 |
| `db` | `src/modules/sessions/__tests__/operations.db.test.ts` | 7 |
| `db` | `src/modules/sessions/__tests__/history.db.test.ts` | 13 |
| `db` | total: 4 files | **41** |

No existing test of any row was edited by this row. No file was removed.

## 12. Other rows' tests (rule M10, decision D85)

With module routes registered, three test files of the guard row failed by design: they pinned
the list of registered routes (`guard.test.ts:131-139`, `:208`) and registered stand-in routes
for registry operations that modules now register, `startSession` among them
(`guard.test.ts:371-376`, `:561`; `denial.db.test.ts:54`, `:89`; `rbac/__tests__/matrix.db.test.ts:79`,
`:351`): `FastifyError: Method 'POST' already declared for route '/api/v1/session/:id/start'`.
Measured at 14:33: `guard.test.ts` 18 failed of 29. Reported to the controller at 14:36 with
file, line, failure text and two proposals; ruled as decision D85 (the guard row's owner fixes
its files in one patch; no module row edits them). This row edited none of them and added no
production work-around. In this row's whole runs of 15:06 and 15:07, and in every later one, the
three files were green (the controller reports them green from 14:49 on).

## 13. Findings, deviations, decisions for the controller

### Findings

| ID | Finding | Evidence | Effect |
|---|---|---|---|
| F-1 | **"Pause" and "resume" do not exist.** The brief's journey names them. Spec §7.8 has no such operation, the registry none, `SimActions` no such action, and the session states are CREATE, PRECHECK, ARMED, RECORDING, STOPPING, FINALIZING, SEALED, FAULT, RECOVERY | `grep -i "pause\|resume"` over `01_specs.md`, `02_plan.md`, `sim/types.ts`, `sim/session-machine.ts`, `api/sessions.ts`, `api/core-api.ts`, `domain/enums.ts`: no operation, action or state | Nothing built; the journey has no such step. Decision DN-6 |
| F-2 | No "cancel reason": `cancelSession` has no body in the contract and `cancel()` no argument | `api/sessions.ts` operation 31; `sim/types.ts` `cancel(): void` | The five-character rule applies to the stop only |
| F-3 | `session_history` has no sequence column; the list pages by the keyset `(ended_at DESC, id DESC)` | Database contract §4.16; section 7 | The brief's "page by `seq`" cannot apply to this list |
| F-4 | The unit of work opens its transaction at its first write: a request that names another session costs no statement | Section 8 | The in-unit check is free |
| F-5 | A POST of an operator carries the identity module's activity unit (5 statements) before the engine's unit whenever the server clock moved since that operator's last POST: two transactions for one command | Section 8 | For the gate's measurements (W58) |
| F-6 | The engine's own check of the stop reason (`REASON_TOO_SHORT`) cannot be reached through HTTP: the schema stage refuses first | `routes.test.ts`, block 26: for every short reason no unit of the engine ran (`units` is empty) | A backstop, as intended | **Superseded by section 18:** the engine's check is now the one that answers |
| F-7 | The order of refusals of a stop differs from the simulator's REST layer: the server answers a short reason before it looks at the session (422 where the simulator answers 404 or 409) | `routes.test.ts`, "the order of the refusals", and "where the server differs …" | By decision D50 and spec §7.3 line 8. Decision DN-2 | **Superseded by section 18:** the order is the simulator's now |
| F-8 | The winner of two simultaneous creates is not always the request sent first, and not the same from run to run: 21 and 19 of 40 at 14:49, 22 and 18 at 15:30, 24 and 16 at 15:36 | Section 6 | The requests interleave for real at stage 4's statements |
| F-9 | **`SIM-GAP-W34-1`: the recording time of a faulted session keeps counting.** `selectElapsedMs` (`packages/shared/src/sim/selectors.ts:112-117`) ends a recording at `stoppedAt` or else at the clock; `enterFault` (`session-machine.ts:914-939`) sets `fault.at` and no `stoppedAt`. So `elapsedMs` of a session in FAULT or RECOVERY grows with the clock: after a recording of 10 s and 90 s of downtime `getCurrentSession` says 100,000 ms. The history entry and the fault row say 10 s | `journey.db.test.ts`, recovery: `expect(faulted?.elapsedMs).toBe(10_000 + 90_000)` | The server answers what the simulator's own `toApiSession` gives, so Live and Simulated agree; a client's monitor shows the same from its replica. Not fixed here: the simulator is not this row's to write, and a server-only adapter would make the two modes differ. Decision DN-5 |
| F-10 | `details.sessionId` on 409 `SESSION_ACTIVE` is sent and the Live binding reads it (`packages/shared/src/live/source/bindings.ts:320`), but the contract does not name it | `CONTRACT-GAP-W34-1` below | The loser of a race learns the open session before the state change arrives. Finding F59 of the decision record says such a 409 carries no session ID: with this row the server sends it; the binding reads it first and falls back to its replica |
| F-11 | The app boots on a clone of the bulk template and the engine rehydrates all 520 history entries; the REST list equals the engine's slice entry for entry | `history.db.test.ts` | — |
| F-12 | One walk of the history in pages of 1 is 520 requests of one operator; the throttle allows 600 a minute per operator. The test starts the window afresh before each test | `history.db.test.ts`, first run of 14:53: 429 from the 601st request of the standing clock's minute on (the walk in pages of 50) | Not a defect (P11). A client should page with the default 50 or more |
| F-13 | **On a Core with no paired tablet connected, every pre-check ends with a block, so no recording can be started, also from the web console.** The simulator's check `CORE` blocks while `tabletLink` is OFFLINE (`session-machine.ts:448-451`); spec §6.8 makes the link CONNECTED only while a PAIRED device has an open authenticated socket; a process start sets it OFFLINE. In Simulated mode the web console never meets this: its link is CONNECTED from the dataset | `operations.db.test.ts`, "the pre-check that blocks": 409 `PRECHECK_BLOCKED`, "Start blocked: Core link offline", row `PRECHECK_BLOCKED` with `reasons: CORE_OFFLINE`. The other database tests call `app.engine.setTabletLink('CONNECTED')` first, as the realtime channel will for a tablet | Not this module's to decide: it answers what the engine says. For the realtime row (W42), the gate (W58) and the end-to-end rows. Decision DN-8 |
| F-14 | The simulator's published clock has a resolution of 100 ms; the server computes `elapsedMs` from `app.clock` exactly | `pure.test.ts`, "the recording time is counted to the instant given" | Between two ticks the server's value is the more exact one |
| F-15 | The database tests of this folder were sensitive to load with Vitest's default of five seconds per test: a clone made inside a test waits for the clone lock, and a walk of the history in pages of 1 is 520 requests | Section 10: one test more failed in three transform runs, with a 1-minute load average of 12 to 18 | The four database test files set `testTimeout` 120 s and `hookTimeout` 180 s, as the reset row's files do. No assertion changed |

### Contract gaps (for the contract close-out row W83)

| ID | Gap | Exact text |
|---|---|---|
| `CONTRACT-GAP-W34-1` | The envelope's `details` description does not list `sessionId`, and the 409 example of `createSession` shows no details | `packages/shared/src/api/core-api.ts:206`: add `sessionId` to the list of members ("… `reason`, `in`, `sessionId` (409 `SESSION_ACTIVE`: the open session)"). `packages/shared/src/api/examples.ts:362-367`: the example `sessionActive` becomes `simRefusalExample('Another session is open', 'SESSION_ACTIVE', 'A session is active.', 'SESSION_ACTIVE', { sessionId: EXAMPLE_IDS.recordingSessionId })` |
| `CONTRACT-GAP-W34-2` | `stopSession` documents its 422 as `INVALID_REASON` only; the Core server also answers 422 `INVALID_INPUT` for a reason the text rule refuses and for a malformed `{id}` (the prose of `coreServerDescription` names the first, not the second) | `core-api.ts:699`: "A reason that the schema refuses for another cause than its length, or a malformed `{id}`, answers `422 INVALID_INPUT`. A reason that is absent or no text counts as too short (`INVALID_REASON`)." |
| `CONTRACT-GAP-W34-3` | The examples of 404 and 409 on the session operations show texts the Core server does not send: they quote the session ID of the request, and the server's texts are fixed (an `ApiFailure` message holds no part of the input) | `examples.ts:385-389`, `:415-419` and `sessions.ts:445-447` (`NOT_OPEN`): message "This session is not the open session." with `details: { simCode: 'NOT_FOUND' }`. `examples.ts:421-425` and `sessions.ts:449-451` (`wrongState`): message "The action is not allowed in the current state." with `details: { simCode: 'ILLEGAL_STATE', from, event }`. Example texts are not checked by `validateCoreApiResponse`; this is documentation only |

No `SCHEMA-GAP`. One `SIM-GAP`: `SIM-GAP-W34-1` (F-9), a marker in `journey.db.test.ts`.

### Deviations from the row text

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | Ten operations use `app.engine.run` with ONE hosted action, where the row text says `app.engine.command` | The `{id}` must be compared with the open session inside the unit that runs the action (section 3.1). `command` has no place for that check |
| DV-2 | The `state` of a `SessionCommandResponse` is the state the action leaves the session in, as the contract's 2xx description of each operation names it, not a value read back | The engine host forbids an answer built from `scope.pending()`. For a replayed create the state is read from the committed state right after the unit. The journey asserts after every command that the committed state is the one answered |
| DV-3 | The module imports `db/schema` and `db/mapping` for the history read | The typed builder and the one row mapping (MR-1); a hand-written row mapping would be a second one |
| DV-4 | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were not written | Parallel run: the controller writes them (P8) |
| DV-5 | Eight mutations ran in place for 105 s before rule M15 | Section 10 |
| DV-6 | The journey has no pause and no resume step | F-1 |
| DV-7 | Process notes: one read-only command began with `cd` into the workspace root itself (not a subfolder); some of this row's own test files and documents were edited with a script instead of the editor (exact-match replacements, each asserted to match once); a one-off script that lists this row's test databases was written into the module's `__tests__` folder at 15:11 and moved to the temp directory at 15:12 (no `rm` outside it) | No effect on the tree: the folder holds the fifteen files of section 2 |

### Decisions for the controller

| ID | Question | This row's choice |
|---|---|---|
| DN-1 | DV-1: `engine.run` with the check inside the unit | Accept. The alternative (a check on the committed state, then `engine.command`) lets a request change a session it did not name |
| DN-2 | F-7: a short stop reason is answered before 404 and 409 | As decision D50 rules. The alternative, the simulator's order, needs a route schema without the minimum length, against rule M2 | **NOT accepted (decision D94); see section 18** |
| DN-3 | A reason that is absent or no text is `INVALID_REASON`; the text rule and the path are `INVALID_INPUT` | As the simulator's REST layer answers; `CONTRACT-GAP-W34-2` | **Changed by section 18:** a reason that is no text is `INVALID_INPUT` now (finding FU-1) |
| DN-4 | `details.sessionId` on `SESSION_ACTIVE` | Accept; `CONTRACT-GAP-W34-1`. It is a member of the simulator's result, not of the request |
| DN-5 | `SIM-GAP-W34-1` | Route to a simulator slot or accept as a known behaviour of both modes. A fix is one line of `selectElapsedMs` (`stoppedAt ?? fault?.at ?? clock.now`) and belongs to the simulator's owner |
| DN-6 | F-1: pause and resume | Confirm that they are out of scope. If they are wanted, they need a specification entry, a contract slot and a simulator change first |
| DN-7 | The history from PostgreSQL by keyset, cursor `<endedAt>-<id>` | Accept; the contract's example cursor has this form |
| DN-8 | F-13: the tablet link and the pre-check | Two things for the controller. (1) Pass to W42: `app.engine.setTabletLink('CONNECTED')` when a paired device's socket is accepted (spec §6.8); until then no session passes its pre-check on a booted server. (2) Rule whether a web-only Core (no tablet connected) is meant to be unable to start a recording in Live mode: that follows from spec §6.8 together with the simulator's `CORE` check, and differs from what the web console does in Simulated mode |
| DN-9 | The texts of the module's refusals quote no input; the block text quotes the simulator's reasons of the blocking checks | Accept; `CONTRACT-GAP-W34-3` for the examples |
| DN-10 | For the matrix row W47 and the conformance row W52 | The refused role of the 13 commands is the TECHNICIAN; the two reads are open to every role. The codes per status are the table of section 4 |
| DN-11 | A malformed `{id}`: 404 or 422 (contract C finding F-4) | **422 `INVALID_INPUT`, `in: params`**, on all eleven operations with an `{id}`: the schema stage refuses it before the handler, and the contract documents 422 on each. The simulator's REST layer answers 404 for the same request; an ID of the right form that is not the open session answers 404 on both |

## 14. Rule by rule

| Rule | How it is met | Where it is tested |
|---|---|---|
| M1 | Only the folder, this row's documents and the pre-image `.cache/rollback/W34.sessions.index.ts.pre` were written | Section 2 |
| M2 | `app.route({ ...routeOfOperation(operation), schema, handler })`; schemas are the registry's objects | `routes.test.ts`, MODG |
| M3 | No check of who calls; no denial row | `static.test.ts`; `routes.test.ts` "who may call" |
| M4 | `app.engine.command` or `app.engine.run`; the answer after it resolved; a thrown refusal propagates; a refusal in a result (`createSession`) is answered after the unit; no simulator action called directly | `static.test.ts`; `routes.test.ts` 24 |
| M5 | No server-native state change: the module owns no row | `static.test.ts` |
| M6 | No audited refusal of the module itself | — |
| M7 | 422 from the schema stage; `INVALID_REASON` mapped; a malformed `{id}` answers 422 (the contract documents it on all eleven operations with one; section 13, DN-11); the server cuts no text | `routes.test.ts` 26, 34, 35 |
| M8 | The one instant read is `app.clock.now()`; the principal is handed on as it is; no cookie set; no header read | `static.test.ts`; `journey.db.test.ts` |
| M9 | Clones of `seed` and `bulk`; `DEMS_TEST_STEP=56`; a manual timer before the boot; counts relative to the state after the boot | The four database test files |
| M10 | Nothing of other rows pinned; section 12 | — |
| M11 | Section 9.2 | — |
| M12 | Database commands with the sandbox bypass; no `timeout` command; no `rm` outside the temp directory | DV-7 |
| M14 | The one log call logs its error as `{ err }` | `static.test.ts`; `routes.test.ts` 38 "M14": a failed statement whose error carries the statement, parameters and DETAIL leaves none of them in the log or the persistent error log |
| M15 | Section 10; DV-5 | — |

Error logging: the module has one error path of its own, the history read (section 7). Every
other failure is the engine host's or the error envelope's, which log and persist it.

## 15. End state and cleanup

15:39:40, after the final runs:

| Check | Result |
|---|---|
| Databases with this row's prefix | `databases with the prefix dems_test_step_56_: 0` (asked of `pg_database` as `dems_owner`) |
| PostgreSQL | `.locks/postgres.pid` is 19121; process 19121 is the project's `postgres`; this row never stopped, started or configured it |
| Processes this row started | None left: every command ran in the foreground and ended, except one background run (the transform mutation batch), which ended with exit 0 at 15:34:05 |
| Ports | None bound: every request is `app.inject` |
| Temp files | The scratch copy of the mutation check, the runner config and the scripts under the temp directory are removed |
| The tree outside the folder | Unchanged by this row. `dems_demo` and the lane databases were not touched (tests run on the helper's clones) |
| `history.ts` | SHA-256 `9c6a100d…d425c4` before the mutation runs and now |

## 16. Rollback (R-NEW; not executed)

> After the follow-up the folder holds SEVEN production files (`text-body.ts` is new): step 2
> below removes six beside the restored stub. See section 18.9.

The folder is new except for the stub. Pre-image of the stub (a file copy, the path being
untracked): `.cache/rollback/W34.sessions.index.ts.pre` (1,025 bytes, saved 14:24).

1. `cp .cache/rollback/W34.sessions.index.ts.pre apps/core-server/src/modules/sessions/index.ts`
2. Remove the other five production files (`current.ts`, `history.ts`, `operations.ts`,
   `refusals.ts`, `routes.ts`) and the folder `__tests__/`.
3. `npm run typecheck -w @dems/core-server` and the `unit` project: the server then registers
   no session route, as before this row. Nothing else depends on the folder: no other file
   imports from it except `app.ts`, which needs the export `sessionsModule` only.

No database, migration, contract or dependency change is to be undone.

## 17. Not done, and not verified by this row

- Pause and resume (F-1).
- A device's bearer session calling these operations: the pairing module is another row; the
  principal is handed on as it is, whatever its transport.
- The realtime publication of the state changes: the engine publishes them; the channel is W42's.
- A real listener: every request here is `app.inject`.
- The full role-by-operation matrix: the test row W47 (here one allowed and one refused call per
  operation).

## 18. Follow-up: one error precedence (decision D94)

Ruling of the controller at the gate (decision D94): the minimum length of a reason is business
validation and is answered in the order the hosted action checks it (spec §7.3 line 10: 404, then
409, then 422 `INVALID_REASON`), as the simulator's REST layer does and as the evidence module
(decision D92) and the security-audit module (decision D102) do. The shape of the body and the
text rule stay the schema stage's (line 8). The first gate's `stopSession` answered a short reason
before it looked at the session. This section is what was changed, in this folder only.

Read first, as the ruling asked: `implementation/35_module_evidence.md` (DN-2, DV-2, DV-3) and
`apps/core-server/src/modules/evidence/export-request.ts`. The approach is reused; the file is not.

### 18.1 What was changed

| File | Change |
|---|---|
| `text-body.ts` (new, 68 lines) | `readTextBody(schema, member, body)`: reads a body with the contract's schema and answers one of three: `VALID` (the parsed value), `TEXT_MISSING` (the ONLY thing wrong is the lower bound of `member`: it is absent, or text below the minimum after trimming), `INVALID` (anything else). `NO_TEXT` is the empty text the hosted action gets in place of a missing one |
| `routes.ts` | `stopSession` and `addSessionNote` have no `schema.body` any more and no `attachValidation`; the handler reads the body with `readTextBody`, answers `INVALID` with `invalidInput('body')` before the engine, and hands the hosted action the parsed text or `NO_TEXT`, inside the unit that first compares the `{id}` with the open session |
| `operations.ts` | `bodySchemaOf(operationId, schema)`: the schema a handler validates with must be the very object the registry names for that operation's body, or the registration throws |
| `refusals.ts` | `invalidStopReason`, `isReasonTooShort` and `stopInputRefusal` are removed: the module answers no `INVALID_REASON` itself any more |
| `index.ts` | Exports follow: `bodySchemaOf`, `readTextBody`, `NO_TEXT`, `TextBody` added; the three functions above removed. Nothing outside the folder imported them (searched before the removal) |

`history.ts`, `current.ts` and `__tests__/support.ts` are unchanged (SHA-256 of `history.ts`
`9c6a100d…d425c4`, as at the first gate). `__tests__/support.ts`, which the acceptance test
`test/acceptance/restart.test.ts` imports, was not touched.

### 18.2 The order of the refusals of a stop, as built

| Order | Line of spec §7.3 | Check | Who decides | Answer |
|--:|---|---|---|---|
| 1 | 1 to 7 | routing, readiness, Origin, credential, throttle, access rule | stages 1 to 6 | 400, 404, 405, 503, 403, 401, 429 |
| 2 | 8 | the body is a JSON object of at most 65,536 bytes | the parser | 413, 400 `INVALID_JSON` |
| 3 | 8 | the `{id}` has the form of a session ID | stage 7 (`schema.params`) | 422 `INVALID_INPUT`, `in: params` |
| 4 | 8 | the SHAPE of the body: the reason is text and passes the text rule | the handler, with the contract's `SessionStopRequest` | 422 `INVALID_INPUT`, `in: body` |
| 5 | 10 | the `{id}` is the open session | the module, inside the unit | 404 `NOT_FOUND` |
| 6 | 10 | the session is RECORDING | the hosted action `stopRecording` | 409 `INVALID_STATE` |
| 7 | 10 | the reason has five characters | the hosted action `stopRecording`, which got the EMPTY text when the contract's schema found the reason absent or too short | 422 `INVALID_REASON`, `details: { simCode: REASON_TOO_SHORT, from: RECORDING, event: stopRecording }` |

How a body is read:

| Body | Read as | Answer on a recording | On a session that is not open | On an open session that is not recording |
|---|---|---|---|---|
| `{ reason: 'Done.' }` and longer | VALID | 202 | 404 | 409 |
| `{ reason: 'Done' }`, `{ reason: '   ab   ' }`, `{ reason: '' }`, `{}`, no body | TEXT_MISSING | 422 `INVALID_REASON` | 404 | 409 |
| A reason of three two-unit characters (U+1F600 three times: three characters for the contract, six code units for the simulator) | TEXT_MISSING | 422 `INVALID_REASON` | 404 | 409 |
| `{ reason: null }`, a number, a list, an object, `true` | INVALID | 422 `INVALID_INPUT` | 422 `INVALID_INPUT` | 422 `INVALID_INPUT` |
| a reason with U+0000 or an unpaired surrogate, short or long | INVALID | 422 `INVALID_INPUT` | 422 `INVALID_INPUT` | 422 `INVALID_INPUT` |

**The text the client sent never reaches the engine when the contract refused it.** Measured (a
probe of the two schemas at 17:05): the contract's `.min(5)` counts characters, so three two-unit
characters are "too small"; the simulator's `stopRecording` counts UTF-16 code units and ACCEPTS
them as a reason of six (`pure.test.ts`, "NO_TEXT is the empty text …": the simulator moves to
STOPPING). Handing the action the refused text would therefore stop a recording that the contract
refused. The action gets `NO_TEXT`, which it refuses in every state that reaches the check.

### 18.3 Which operations have the pattern (the list the ruling asked for)

"A body member that the schema bounds from below AND the hosted action checks."

| # | Operation | Member, lower bound | What the hosted action checks, and when | Changed |
|--:|---|---|---|---|
| 26 | `stopSession` | `reason`, 5 characters | `REASON_TOO_SHORT`, after the session's state | **Yes** (section 18.2) |
| 35 | `addSessionNote` | `text`, 1 character | `NOTE_INVALID`, after the session's state | **Yes**: an absent or empty text is now 404, then 409, then 422 `INVALID_INPUT` with `details: { simCode: NOTE_INVALID, from, event }` from the action. Too long (2,001 characters, or 2,002 code units), not text, the text rule: 422 `INVALID_INPUT`, `in: body`, at line 8 |
| 24 | `createSession` | `caseNumber`, `subjectName`, `room`, 1 character each | The action validates its input with the same shared schema BEFORE it looks for an open session (`createSessionTransition`: `INVALID_INPUT`, then `SESSION_ACTIVE`), and the path has no `{id}` | No: stage 7's 422 already comes where the action and the simulator's REST layer put it. Asserted: an incomplete input while a session is open is 422 on the server and on the twin simulator |
| 25 | `startSession` | `acknowledgeWarnings`, a boolean | No bound | No |
| 34 | `addSessionMarker` | `label`, 0 to 80 | No lower bound: an empty label is valid ("Marker n"); the action refuses nothing | No |

### 18.4 Against the simulator's REST layer

**Equal now.** `routes.test.ts`, block 26, "one error precedence …": with the Core at each of
IDLE, CREATE, PRECHECK (running), PRECHECK (blocked), ARMED, RECORDING, FAULT, STOPPING and SEALED,
four bodies with an absent or too-short reason are sent to a session that is not open and to the
open one; each answer's status and code are compared with what `sim.request` of the SAME simulator
answers for the same request: 404 `NOT_FOUND`; 409 `INVALID_STATE`; on RECORDING 422
`INVALID_REASON`. The twin test of block "API-1" has nine more steps with short reasons (404 with
no session; 409 and 404 in CREATE; 409 in PRECHECK, STOPPING and SEALED; 404 and 422 while
recording) and one with an incomplete create while a session is open (422 on both): no
difference. The test that pinned the old order ("the order of the refusals (decision D50 …)") is
replaced by these.

**Still different, each by the specification, each asserted as a stated difference** (`routes.test.ts`,
"a short stop reason no longer differs …; where the server still differs …"):

| Request | Core server | Simulator's REST layer | Why |
|---|---|---|---|
| A body that is no JSON object, by a caller who is not signed in | 401 | 400 | Spec §7.3: stages 3 to 6 run before the body is read |
| A reason that is NOT TEXT (`12345`, `null`), on a session that is not open | 422 `INVALID_INPUT` | 404 | The ruling: the shape of the body is the schema stage's (line 8). The simulator has no schema stage: it reads such a reason as the empty text |
| The same on a recording | 422 `INVALID_INPUT` | 422 `INVALID_REASON` | The same |
| A reason of three two-unit characters on a recording | 422 `INVALID_REASON` | 202 | The contract counts characters, the simulator code units (contract C §3.3) |

### 18.5 What a client can observe that is new

The acceptance test in flight (`test/acceptance/restart.test.ts`) sends a valid note and a valid
stop reason to the open session (its lines 648 and 649): none of this reaches it.

| Request | Before (first gate) | Now |
|---|---|---|
| `stopSession`, reason absent or too short, session not open | 422 `INVALID_REASON` | **404 `NOT_FOUND`** |
| `stopSession`, reason absent or too short, open session not recording | 422 `INVALID_REASON` | **409 `INVALID_STATE`** |
| `stopSession`, reason absent or too short, recording | 422 `INVALID_REASON`, message "A stop reason of at least 5 characters is required.", `details: { simCode }` | 422 `INVALID_REASON`, message "A reason of at least 5 characters is required." (the engine host's text), `details: { simCode, from, event }` |
| `stopSession`, a reason that is `null` or not text | 422 `INVALID_REASON` | **422 `INVALID_INPUT`**, `in: body` (finding FU-1) |
| `addSessionNote`, text absent or empty, session not open / not recording | 422 `INVALID_INPUT`, `in: body` | **404 / 409** |
| `addSessionNote`, text absent or empty, recording | 422 `INVALID_INPUT`, `details: { in: body }` | 422 `INVALID_INPUT`, `details: { simCode: NOTE_INVALID, from, event }` |
| Cost of a stop with a short reason on a recording | No unit of work | One unit of the engine, 5 statements, rolled back; it counts in `stats().commandsRefused` |

Everything else is as at the first gate: every success, every other refusal, the routes, the
headers of API-7, the reads.

### 18.6 Tests

| File | Before | Now | What changed |
|---|--:|--:|---|
| `routes.test.ts` (`unit`) | 83 | 91 | Block 26 rewritten: the short reasons are refused by the action, which got `['']`, in a unit that was not committed; the shape of the body on the open and on another session; the precedence in nine states against the simulator's REST layer. Block 35: the shape at line 8; a new test for the absent or empty note (404, 409, 422 with `NOTE_INVALID`). Block "API-1": seven more steps; the "differs" test rewritten (section 18.4). MODG: the two bodies read in the handler have no route schema; no route has `attachValidation` |
| `pure.test.ts` (`unit`) | 42 | 57 | The block about the schema stage's validation failure is replaced by 23 tests of `readTextBody` (VALID, TEXT_MISSING, INVALID for a stop and a note; only the named member, alone, at the top; `NO_TEXT` against the real simulator); `bodySchemaOf` |
| `static.test.ts` (`unit`) | 16 | 20 | Seven production files; four guards of the rule: the two reads and their schemas, the refusal of line 8 right after each read, `NO_TEXT` for a missing text, no `attachValidation`, no `INVALID_REASON` answered by the module |
| `journey.db.test.ts` (`db`) | 16 | 16 | AC-B-50: the 422 names `from` and `event`; the same short reason on another session is 404; the engine counted ONE refused command in the journey (was 0) |
| `operations.db.test.ts` (`db`) | 7 | 8 | New: the precedence through the real stages against PostgreSQL, for the stop and the note, with nothing stored by any refusal and the refused unit's five statements |
| `concurrency.db.test.ts`, `history.db.test.ts` (`db`) | 5, 13 | 5, 13 | Unchanged |

`unit`: 141 to **168** tests in 3 files. `db`: 41 to **42** tests in 4 files. The acceptance
criteria of the row hold as before: AC-B-49 (40 x (201, 409 `SESSION_ACTIVE`), winners 24 and 16
in the final run); AC-B-50 (`OPR-002` stops the session of `OPR-001` with five characters: 202,
`RECORDING_STOPPED` names `OPR-002`; four characters: 422 `INVALID_REASON`, no row). The status
ledger of section 4 is unchanged status for status; the journey table of section 5 is unchanged
line for line.

### 18.7 Verification (final state: after the last change of a file of the folder at 17:13:22)

Full output: `assets/34_followup_gate.log`.

The row's files, `unit` at 17:18:33 and `db` at 17:18:35 (`DEMS_TEST_STEP=56b`), both exit 0:

```
> vitest run --project unit --maxWorkers=2 --reporter=verbose src/modules/sessions
 Test Files  3 passed (3)
      Tests  168 passed (168)
   Start at  17:18:33
> vitest run --project db --maxWorkers=2 --reporter=verbose src/modules/sessions
 Test Files  4 passed (4)
      Tests  42 passed (42)
   Start at  17:18:35
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 3 database(s) in 89 ms; 0 remain with the run prefix dems_test_step_56b_tmdomztn_
```

Typecheck at 17:21:02 and lint at 17:21:06, both exit 0, lint with no warning:

```
> @dems/core-server@0.2.0 typecheck
> tsc --noEmit
exit 0
> @dems/core-server@0.2.0 lint
> oxlint
exit 0
```

ONE whole `unit` run, 17:18:59, exit 1 with one file red, not of this folder:

```
> vitest run --project unit --maxWorkers=2
 ❯ |unit| src/db/fixtures/__tests__/audit-details.test.ts (18 tests | 18 skipped) 246ms
 FAIL  |unit| src/db/fixtures/__tests__/audit-details.test.ts [ src/db/fixtures/__tests__/audit-details.test.ts ]
TypeError: simulatorAuditRows is not a function
 ❯ src/db/fixtures/__tests__/audit-details.test.ts:67:27
 Test Files  1 failed | 139 passed (140)
      Tests  3565 passed | 18 skipped (3583)
   Start at  17:18:59
```

ONE whole `db` run, 17:19:24, `DEMS_TEST_STEP=56b`, exit 1 with one test red, not of this folder:

```
> vitest run --project db --maxWorkers=2
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_56b_tmdooc8n_
 ❯ |db| src/modules/pairing/__tests__/secrets.db.test.ts (11 tests | 1 failed) 404ms
     × rule M14: the two failing statements are in the log as an error with its code, and nothing of a statement, a parameter or a hash 3ms
AssertionError: expected undefined to match object { …(2) }
 ❯ src/modules/pairing/__tests__/secrets.db.test.ts:319:18
 Test Files  1 failed | 107 passed (108)
      Tests  1 failed | 1538 passed | 1 skipped (1540)
   Start at  17:19:24
[test:db] forced drops that needed a retry: 1 (1 refusal(s) with SQLSTATE 42501 while a backend that the owner role may not end, such as an autovacuum worker, was on the database; each drop then went through)
[test:db] teardown: dropped 8 database(s) in 212 ms; 0 remain with the run prefix dems_test_step_56b_tmdooc8n_
```

Every failure outside this folder, named (P11, rule M12):

| Time | Where | Failure | Whose | Re-run |
|---|---|---|---|---|
| 17:18:59, whole `unit` | `src/db/fixtures/__tests__/audit-details.test.ts:67:27` (the file failed to load: 18 tests skipped) | `TypeError: simulatorAuditRows is not a function` | The fixture follow-up row in flight: the file's modification time is 17:21:13, and neither it nor the function it calls is of this folder | The file alone at 17:21:31: 1 file, 35 tests passed, exit 0 |
| 17:19:24, whole `db` | `src/modules/pairing/__tests__/secrets.db.test.ts:319:18`, "rule M14: the two failing statements are in the log …" | `AssertionError: expected undefined to match object` | The pairing module's test, being edited: its modification time is 17:18:53, half a minute before the run. It imports nothing of this folder | The file alone at 17:21:33: 1 file, 11 tests passed, exit 0 |
| 17:11:35 and 17:13:22, typecheck | `test/acceptance/restart.test.ts(1105,12)`, then `(1107,12)` | `TS18048: 'item.markers' is possibly 'undefined'` | The acceptance test in flight | Typecheck at 17:21:02: exit 0 |

All 7 files of this folder passed in both whole runs. The whole runs were made once each, as the
brief says; the two files of other rows were then run alone, once.

End state, 17:21:56: `databases with the prefix dems_test_step_56b_: 0`, `databases with the prefix
dems_test_step_56_: 0` (asked of `pg_database` as `dems_owner`); `.locks/postgres.pid` is 19121
and that process is the project's `postgres`; no process of this row is left; no port was bound;
the scratch copy, the probe and the scripts under the temp directory are removed.

### 18.8 Mutation re-run (rule M15: on a scratch copy outside the tree)

A copy of `apps/core-server/{src,test}` under the temp directory, 17:15:20 to 17:17:55; the
folder's `unit` tests per mutation; the copy removed afterwards. **72 of 72 detected**
(`assets/34_mutations.log`, last block): 25 over the changed handlers, the body reader and
`bodySchemaOf`, and the 47 of the first check that still apply (the seven that changed code which
no longer exists are gone: M12, M13, M31 to M34, M52).

| ID | Planted defect | Tests that failed |
|---|---|--:|
| R04 | THE OLD ORDER: a short stop reason is refused before the session is looked at | 20 |
| R05 | The old order for a note | 2 |
| R03 | The refused reason itself reaches the engine | 13 |
| R13 | The valid reason is replaced by the empty text | 23 |
| R01, R02 | A body of the wrong shape reaches the engine (stop; note) | 4; 3 |
| R06 | A missing note text becomes a text the action accepts | 2 |
| R07, R08 | The lower bound of another member is read | 20; 2 |
| R09, R14 | The body is read with another schema | 25; 5 |
| R10 | A refused stop body names the wrong part of the request | 3 |
| R11, R12 | The route has a body schema again (stage 7 answers the lower bound) | 21; 3 |
| T01 | A reason that is `null` or a number counts as missing | 10 |
| T02 | One lower-bound issue among others is enough | 4 |
| T03, T04 | A member of the same name deeper in the body, or another member, counts | 1; 1 |
| T05 | Missing and invalid are swapped | 44 |
| T06 | The stand-in for a missing text is one the action accepts | 19 |
| T07 | An absent member is never seen as absent | 16 |
| T08 | A valid body is handed on as sent, not as parsed | 5 |
| T09 | A text that is too short is the schema stage's again | 26 |
| O01, O02 | `bodySchemaOf` accepts a schema the registry does not name, or one for an operation without a body | 1; 1 |

The eight database-only mutations of the history statement (D01 to D08) were not run again:
`history.ts` is unchanged.

### 18.9 Findings, deviations, decisions of the follow-up

| ID | Kind | Statement |
|---|---|---|
| FU-1 | Finding, needs a word from the controller | **DN-3 and the ruling disagree on one case, and the ruling was followed.** DN-3, marked accepted in the gate message, said "a reason that is absent or no text is `INVALID_REASON`". The follow-up ruling lists "a reason that is not text" under the shape of the body (line 8, `INVALID_INPUT`), and the evidence module does the same (only an ABSENT reason counts as missing). So `{ reason: null }` and `{ reason: 12345 }` answer 422 `INVALID_INPUT` now, before the session is looked at, where the simulator's REST layer answers 404, 409 or `INVALID_REASON`. If DN-3 was meant to stand, the change is one condition in `text-body.ts` (mutation T01 is exactly that change, and ten tests pin the current behaviour) |
| FU-2 | Finding | The text of `INVALID_REASON` is the engine host's general one now ("A reason of at least 5 characters is required."), and its details name `from` and `event`, so the Live source rebuilds the simulator's `SimTransitionError` with the state and the event the simulator itself would name. The contract's example text (`examples.ts:427-432`, "A stop reason of at least 5 characters is required.") is the simulator REST layer's; it joins `CONTRACT-GAP-W34-3` (example texts): the example becomes `simRefusalExample('Reason too short', 'INVALID_REASON', 'A reason of at least 5 characters is required.', 'REASON_TOO_SHORT', { from: 'RECORDING', event: 'stopRecording' })` |
| FU-3 | Finding | `CONTRACT-GAP-W34-2` stays as reported and is now exact: the 422 of `stopSession` is `INVALID_REASON` (absent or too short, on a recording) or `INVALID_INPUT` (not text, the text rule, a malformed `{id}`) |
| FU-4 | Finding | A stop with a short reason on a recording costs one unit of the engine now (5 statements, rolled back) where it cost none, and is counted in `commandsRefused`. The engine row's finding that its own reason check "cannot be reached through HTTP" (F-6 of this document) is reversed: it is the check that answers |
| FU-5 | Finding | Three two-unit characters are a reason the contract refuses and the simulator would accept (measured). With the empty text handed over, the server refuses it as the contract says; in Simulated mode the same reason stops the recording. For the client rows: a form that counts `value.length` accepts what the server then refuses with `INVALID_REASON` |
| FU-DV-1 | Deviation (rule M2) | Two routes have no `schema.body`: the body is validated in the handler with the registry's own schema object (`bodySchemaOf` checks the identity at registration; a static test pins both reads). The same deviation as the evidence module's DV-3, by the ruling |
| FU-DV-2 | Deviation | `addSessionNote` was changed too, not only `stopSession`: it has the same pattern (section 18.3) |
| FU-DV-3 | Process | No pre-image of the first gate's files was saved before the follow-up edits. The folder has one writer, so P23 does not ask for one, and the row's rollback (section 16: restore the stub, remove the folder's production files and `__tests__/`) is unchanged. Going back to the first gate's order alone would mean reversing section 18.1 by hand; mutations R04, R05, R11 and R12 show what that order looks like and that the tests refuse it |
| FU-DV-4 | Process | Documents and three test files were edited with scripted exact-match replacements (each asserted to match once), as in DV-7; the probe and the scratch copy lived under the temp directory only |
| FU-DN-1 | Decision for the controller | FU-1: confirm that a reason that is not text is `INVALID_INPUT` at line 8 (as built), or say that DN-3 stands |
| FU-DN-2 | Decision for the controller | FU-5: accept that the contract (characters) and the simulator (code units) disagree for astral characters at the lower bound, with the server on the contract's side; or route it to the contract close-out row (a code-unit lower bound in `SessionStopRequest`, as `boundedText` has for upper bounds) |

No new `CONTRACT-GAP`, `SCHEMA-GAP` or `SIM-GAP`. Files written by the follow-up: the seven
production files' four changed and one new (`routes.ts`, `refusals.ts`, `operations.ts`,
`index.ts`, `text-body.ts`), five test files (`routes.test.ts`, `pure.test.ts`, `static.test.ts`,
`journey.db.test.ts`, `operations.db.test.ts`), this section, `assets/34_followup_gate.log`,
`assets/34_mutations.log` (one block appended) and the progress file. Nothing outside
`apps/core-server/src/modules/sessions/**` and this row's documents was written.
