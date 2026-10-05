---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: coder-execution
step: 48
plan_row: W26
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
tier: 3
status: completed
---

# W26: the engine host

All times are WIB (UTC+7) on 2026-10-04. Every command ran from `/Users/gsp-budi/Documents/DEMS`;
no command changed into a subfolder. Database commands ran with the per-command sandbox bypass
(P10): inside the sandbox a connection to `127.0.0.1:4432` fails with `POSTGRES_UNREACHABLE`
(observed at 11:23, before the first bypassed run). Typecheck, lint and the `unit` project ran
inside the sandbox. Quoted runner output is unchanged. **No password, token or other credential
value appears in this document.**

## 1. Result

| Item | Result |
|---|---|
| Row command `DEMS_TEST_STEP=48 npm run test:db -w @dems/core-server -- src/engine` | **Exit 0**: 4 files, 53 tests, 0 failed (12:32:35, section 12.1) |
| AC-B-52: fixed seed, manual clock, the recording scenario for 60 s | The 230 stored audit rows equal the shared simulator's in `seq`, `at`, type, actor and hash; the digest of the comma-joined types is the reference of decision D28 (`4b5d34e1…475252f`); the whole durable state equals the simulator's |
| AC-B-53, SR-79: the actor scope | After each of 9 commands of a session journey, after 6 commands that the simulator refused by throwing, and after a unit that was rolled back, the engine's `auth` slice is signed out. The clearing is in a `finally`; a negative control without it leaves the caller signed in |
| AC-B-07: no meter frame stored | 60 s of recording: `audit_log` +12, `events` +1, `health_snapshots` +1, the other 27 tables unchanged. 1,200 meter frames were handed to the realtime seam; no member of a frame is in any row of any table |
| A tick that changed nothing durable | Sends no statement and takes no connection: 1,128 of 1,200 ticks of the minute |
| Rehydration | After a session from create to seal, a fault and its clearing, an export, a policy and a settings change: stop, new process, boot. All 28 durable slices are equal (negative zero as zero, D62 DN-3); in the tables only `core_state` moved (the epoch) |
| The restart fault | A session in RECORDING at the stop is in FAULT after rehydration: one `FAULT_RAISED` row, no actor, stamped at the last committed instant; the 90 s of downtime are not counted as recording (2,624,000,000 bytes, not 2,829,000,000). Also proven for PRECHECK, ARMED, STOPPING, FINALIZING; a session already in FAULT stays as it was |
| A stored state that is rejected | Fatal: the boot stops at `engine.rehydrate`, nothing is written, the server is not ready; the log has the code and the slice name, not the value |
| A unit that is not committed (ENG-5) | The engine's state is set back to the reference held before the unit (every durable slice the same object), nothing is stored, the caller gets 503, and the next command works and continues the stored head. Proven for a failed COMMIT, three failed statements, a refusal thrown by a module, and a failed tick |
| A diverged head | Detected before anything is written (503 `AUDIT_HEAD_DIVERGED`, nothing stored, state set back); the host reloads from the database with a new epoch and goes on |
| Rows of server-native units | Taken into the ring at their commit; the engine's next rows continue the stored head; the chain verifies over all rows |
| Health snapshots | One row every 60 s of the server clock and one at each fault raise and clear |
| The scheduler | No tick is submitted while one is queued or running; a failed tick suspends the ticks; a probe once a second resumes them |
| Shutdown | The last unit writes what a tick had left for the next second; no timer, no queued unit, no checked-out connection, no session of `dems_app` remains |
| Reset inside a running server (decision D74) | `stop` → `resetDatabase` → `reload`: the engine's epoch equals the routine's `report.epoch` (1 → 2, not 3); `stop` → `start('boot')` adds 1 |
| Whole `unit` project | **Exit 0**: 70 files, 1,848 tests (12:38:31) |
| Whole `db` project | **Exit 0**: 45 files, 623 tests (12:37:38). Two whole runs before it, at 12:32:51 and 12:34:46, each had failures in ONE file of the reset row, under load; that file passed alone three times afterwards (finding F-15, section 12.5) |
| Typecheck, lint of the workspace | Exit 0, exit 0 (two warnings in a file of the scaffold: finding F-2) |
| Mutation check | 28 of 28 planted defects detected (section 16) |
| Tests of other rows | Five files touched, each a recorded by-design change (section 15): the stub assertion of D52, and four files under the controller's notes of 11:42 and 11:53 (decision D72) |
| PostgreSQL | Never stopped or reconfigured: `.locks/postgres.pid` is 19121 and the postmaster start time is 07:14:26, as before. No database of this row remains |

## 2. What was written

All under `apps/core-server/src/engine/`, the row's one owned path: 14 production files (2,226
lines), 14 test files and one test-support file (3,713 lines).

| File | Lines | Content |
|---|--:|---|
| `index.ts` | 133 | The unit: fills the seam `engine`, registers the boot step `engine.rehydrate`, adds the close hooks; re-exports. Replaces the scaffold's stub and keeps its exports. Its header holds the rule table for modules |
| `types.ts` | 234 | Types only: `EngineHost`, `EngineUnit`, `EngineOutcome`, `EngineStartMode`, `EngineStats`, and what the engine hands to `app.publish`: `EngineStateChange`, `EngineDeltaOp`, `EngineMeterFrame` |
| `host.ts` | 874 | `createEngineHost`: units of work, commands, ticks, the merge of server-native rows, start, stop, reload |
| `write-plan.ts` | 134 | What one unit writes: `planWrite` (pure, on the mapping module) and `applyPlan` |
| `rehydrate.ts` | 204 | The stored rows back into a state: reading, validation, the last committed instant, and what a process start does (`applyProcessStart`) |
| `delta.ts` | 75 | The operations of one state change (`replace`, `append`) between two committed states |
| `ring.ts` | 66 | `mergeTrail`: rows of server-native units into the engine's rings |
| `scheduler.ts` | 132 | When a tick is submitted: one in flight, suspension, probes |
| `headless-sim.ts` | 94 | `createSim` with every adapter injected; the engine clock |
| `actor-scope.ts` | 42 | `withActorScope`: the `auth` slice for one synchronous action, cleared in a `finally` |
| `hosted-actions.ts` | 40 | The 31 hosted actions, read from contract C's `SIM_ACTION_OPERATIONS` |
| `errors.ts` | 120 | `EngineError`; `simRefusal`: the table of spec §7.2 |
| `timer.ts` | 35 | `EngineTimer` and the system timer: the only file of the folder that names a global timer |
| `limits.ts` | 43 | Constants: 50 ms tick, snapshot once a clock second, 60 s health snapshot, 1 s probe |
| `__tests__/support.ts` | 310 | Test support (not a test file): a manual timer, a counting pool, the app on a clone, readers |
| `__tests__/*.test.ts` (10) | 1,631 | `unit` project, 128 tests |
| `__tests__/*.db.test.ts` (4) | 1,772 | `db` project, 53 tests |

Nothing under `packages/shared/`, `src/db/**`, `src/core/**` (production), `app.ts`, `index.ts`,
`config.ts` or any manifest was edited. The mapping and the store are imported where they are
(`src/db/mapping`, `src/db/seed/store.ts`); nothing was copied or moved (D62 DN-10).

## 3. The host's API for the domain modules

`app.engine` is one object, the seam of P25.

```ts
interface EngineHost {
  readonly epoch: number;       // x-dems-epoch; 0 while the host never started
  readonly revision: number;    // x-dems-revision of the newest committed state change
  readonly running: boolean;

  // ONE hosted action as one unit of work. Resolves after the commit.
  command<A extends HostedActionName>(principal: Principal, action: A, ...args: Parameters<SimActions[A]>)
    : Promise<{ value: ReturnType<SimActions[A]>; epoch: number; revision: number }>;

  // One unit in which hosted actions and server-native rows commit together.
  run<T>(label: string, work: (scope: EngineUnit) => Promise<T> | T): Promise<{ value: T; epoch; revision }>;

  setTabletLink(state: 'CONNECTED' | 'OFFLINE'): Promise<EngineOutcome<void>>;   // X-2: no client calls it
  mirrorOperators(): Promise<EngineOutcome<boolean>>;                            // ENG-3, for the publication

  state(): DurableSlices;                       // the COMMITTED 28 slices, by reference; no pipeline
  slice<K extends DurableSliceKey>(name: K): DurableSlices[K];

  start(mode: 'boot' | 'reset' | 'resync'): Promise<void>;
  reload(): Promise<void>;                      // = start('reset'): after the reset routine
  stop(): Promise<void>;
  stats(): EngineStats;
}

interface EngineUnit {                          // what `run` hands to `work`
  readonly unit: UnitContext;                   // the core's unit: unit.audit.append, unit.events.append, unit.db
  command<A extends HostedActionName>(principal, action: A, ...args): Promise<ReturnType<SimActions[A]>>;
  pending(): DurableSlices;                     // the state INSIDE the unit; not committed
}
```

A handler:

```ts
const { value, epoch, revision } = await app.engine.command(request.principal, 'stopRecording', body.reason);
return reply.header('x-dems-epoch', epoch).header('x-dems-revision', revision).code(204).send();
```

**What `command` answers.**

| Outcome | What the caller gets | State |
|---|---|---|
| The action returned | `{ value, epoch, revision }` after the commit. `value` is what the simulator returned, a refusal in a result type included (`{ ok: false, status: 403, reason: 'FORBIDDEN' }`); such a refusal may have written a row (`EXPORT_DENIED`), and that row is stored | Committed, published |
| The action threw a `Sim*Error` | An `ApiFailure` by the table of spec §7.2 with `details.simCode`, and `permission`, or `from` and `event`, as the specification lists them. `cause` is the simulator's error. A handler lets it propagate | Nothing changed (ENG-7) |
| The unit could not be run or committed | A `PipelineFailure`: 503 `NOT_READY` (`reason` for the log: `COMMIT_FAILED`, `DATABASE_UNAVAILABLE`, `UNIT_TIMEOUT`, `AUDIT_HEAD_DIVERGED`, `QUEUE_FULL`, `CLOSED`) | Nothing stored; the engine set back (ENG-5) |
| The engine is not running (not started, stopping, reloading) | 503 `NOT_READY` | — |
| The principal is not an OPERATOR | 401 `NOT_SIGNED_IN` (a backstop: the permission guard refuses first) | — |
| The action is not one of the 31 hosted ones | `EngineError` `ENGINE_ACTION_NOT_HOSTED` (a defect of the calling code: 500) | — |
| The action threw anything else | That error, unchanged: 500 `INTERNAL_ERROR`. One error line and one persistent entry by the error's name | Nothing stored; set back |

The table `SIM_REFUSAL_RULES` and the function `simRefusal(error, message?)` are exported: a module
that wants its own wording passes it, and status, code and details stay.

**Rules for a module.**

| A module MUST | Why |
|---|---|
| Pass `request.principal` as it is | The actor of every row comes from the session, never from a request field (SR-65). `command` has no parameter for a time, an actor or a revision |
| Answer after `command` or `run` resolved | The commit has happened then (ENG-4); the outcome carries the revision of API-7 |
| Return a refusal that the simulator reports IN ITS RESULT from the unit and answer afterwards | Such a refusal may have written a row (`EXPORT_DENIED`); throwing inside the unit would roll that row back |
| Use `engine.run` when a hosted action and rows of its own belong together | The host takes the unit's own rows into its ring before the action, so the chain continues; everything commits together or not at all |
| Call `engine.mirrorOperators()` after a unit that changed an operator has committed | Clients then get the changed `operators` slice. Every command mirrors the table before its action in any case (ENG-3) |
| Rely on its access rule for the 23 actions the simulator does not check | The engine runs what the guard let through: `addNote`, `addMarker`, `snapshot`, `recover`, `acknowledgeSummary` and the others of spec §7.17 "Rule today: none" are not refused by the engine for any role |
| For a reset: `engine.stop()`, then close the pool, the routine, reopen the pool, `engine.reload()` | Section 10 |

| A module MUST NOT | Why |
|---|---|
| Call `engine.command` or `engine.run` inside `app.pipeline.run` | A unit cannot submit a unit: `PIPELINE_REENTRANT`, at once (tested) |
| Call a simulator action directly, or change the hosted `Sim` | Nothing would be written, published or set back |
| Insert into `audit_log` or `events` itself | The core's two writers own those tables; the unit refuses the statement |
| Keep `scope.pending()` or answer from it | It is not committed and may be set back |
| Change what `state()` or `slice()` returns | It is the engine's own state, by reference |
| Read the working state of the `Sim` | It may hold an uncommitted change and, for one synchronous turn, the actor of a command (finding F-10 of the headless proof) |

`engineControl(app)` returns the host with five extra members for tests and measurements
(`useTimer`, `simulator`, `fire`, `idle`, `settled`). A module never needs it.

## 4. A command, statement by statement

`app.engine.command(principal, 'addMarker', 'Key statement')` during a recording (12:32:43, verbose
run; 11 statements, one connection, one transaction):

```sql
BEGIN ISOLATION LEVEL READ COMMITTED                           -- the unit (core)
SELECT seq, hash FROM public.audit_chain_lock()                -- AP-2: the head to extend
SELECT set_config('statement_timeout', $1, true)               -- the unit's time limit
select "id", "username", "rank", "name", "display_name", "initials", "role_id"
  from "operators" order by "operators"."id" asc               -- ENG-3: the operators mirror
-- in memory, one synchronous turn: auth := the caller; sim.actions.addMarker(...); auth := signed out (finally)
insert into "audit_log" (...) values ($1 ... $14)              -- the core's audit writer, the row as the shared chain built it
insert into "events" (...) values ($1 ... $10)                 -- the core's event writer
UPDATE public.engine_counters SET next_value = GREATEST(...)   -- the core's raise of the event counter (D67 DN-3)
update "engine_counters" set "next_value" = $1 where ...       -- the mapping: counter `event`
update "engine_counters" set "next_value" = $1 where ...       -- the mapping: counter `item`
update "active_session" set "marker_count" = $1, ... "updated_at" = $n where ...   -- only the changed columns (MR-8)
COMMIT
-- after the commit, before the next unit: committed := flushed; revision += 1; app.publish({ kind: 'state', ... })
-- then `command` resolves
```

In the order the host does it:

| Step | What | Code |
|--:|---|---|
| 1 | Refuse without a unit: the principal is no operator; the action is not hosted; the engine is not running | `host.command` |
| 2 | `app.pipeline.run('engine.<action>', work)`: the unit waits its turn (ENG-6) | `inUnit` |
| 3 | Take the unit's own appended rows into the ring (a module's server-native rows in `engine.run`) | `syncNative` |
| 4 | The head the unit locked must be the head the engine holds; otherwise 503, section 11 | `checkHead` |
| 5 | Mirror the operators table (once per unit) | `mirrorOperatorsIn` |
| 6 | The actor scope: `auth` := caller at the server clock, the action, `auth` := signed out in a `finally` | `withActorScope` |
| 7 | A thrown `Sim*Error` becomes the mapped `ApiFailure`; the unit rolls back | `simRefusal` |
| 8 | Write through: the plan between what the tables hold and the engine's state, snapshot slices included | `flush`, `planWrite`, `applyPlan` |
| 9 | The core commits. Then, synchronously and before the next unit starts: the committed state moves on, the revision grows by 1 if a replicated slice changed, the change is published | `settle` |
| 10 | `command` resolves with the value, the epoch and that revision | |
| — | If the unit is not committed, at any step: the store is set back to the reference of step 2 | `undo` |

A command that changes nothing sends 5 statements (the first four and `COMMIT`) and publishes
nothing. A refused command sends the first four and `ROLLBACK`.

## 5. The write-through rule

`committed` is what the tables hold and what the published changes sum up to: the 28 durable
slices at the last commit, **by reference**. Inside a unit, `flushed` starts as `committed` and
follows each write.

| Rule | How |
|---|---|
| Change detection | By reference inequality of the slices (ENG-4): `diffSlices(flushed, target, at)` of the one mapping module. A slice whose reference did not change costs one comparison. The folder has no mapping of its own and names no column (static test) |
| Audit rows | `newAuditRows(flushed, target)`: the rows above the last written total, the very objects of the engine's ring, handed to `unit.audit.appendPrepared`. An altered ring row is never among them, so `AUDIT_TAMPER` cannot reach the table (SR-59) |
| Events | `newEvents(...)` to `unit.events.appendPrepared` |
| Every other row | `applyChanges(unit.db, changes without auditLog and events)` of `src/db/seed/store.ts`: updates name only the changed columns, parents before children |
| Health snapshots | `healthSnapshotToRow` of the mapping module, one INSERT per row |
| Records (class S) | Written by the unit that changed them, always |
| The hardware snapshot (class SN) | A command, a start and a stop write it at once. A TICK writes it at most once in a second of the server clock, and at once when a fault was raised or cleared; otherwise the change waits (`storedOnly`) and the next due unit writes it. The stop writes what is left |
| `operators` | Never written: the table is the server's and is mirrored INTO the engine |
| Never written | `audio` (20 Hz frames), `clock`, `auth`, `authLockout`, `pairing`: they are not durable slices of the mapping, and the write plan does not name them (static test) |
| An empty plan | Sends nothing and opens no transaction |
| A move that cannot be written exactly | The mapping throws (`IMMUTABLE_CHANGED`, `RING_INCOMPLETE`, `TEXT_NOT_STORABLE`, ...); the unit fails, nothing is stored, the engine is set back |

## 6. The boot step and rehydration

The unit registers one boot step, `engine.rehydrate`, after B-1 (pool) and B-2 to B-9 (core). It
calls `host.start('boot')`, which is ONE unit of work `engine.rehydrate` (26 statements on a seeded
clone: the unit's 3, 16 reads, the writes, `COMMIT`; the whole boot took 34 to 42 ms):

| # | Step | Failure |
|--:|---|---|
| 1 | Open the unit's transaction (the chain lock): no writer is in between the reads | The pipeline's 503 `NOT_READY` (`DATABASE_UNAVAILABLE`), reported once as an outage |
| 2 | `readStoredRows(unit.db)` as `dems_app`: the rows of the 28 slices, rings limited to 1,000, 500, 100 | `StoreError` (table, SQLSTATE) |
| 3 | `fromRows(rows)` | `ENGINE_STATE_UNREADABLE` (`rule: ROW_SHAPE`): the rows do not form a state. The text names `npm run db:seed` and `npm run db:reset` |
| 4 | The last committed instant: the greatest of `hardware_snapshot.written_at`, `active_session.updated_at`, and `at` of the newest stored audit row and event | — |
| 5 | Every slice against its schema of the contract registry (`REPLICATED_SLICE_SCHEMAS`, the text rule API-13 on) | `ENGINE_SNAPSHOT_REJECTED` with the slice names, the first rule and path; never a value |
| 6 | A fresh headless `Sim` on the engine clock (the server clock, held at or above the instant of step 4) | — |
| 7 | The simulator's own acceptance test `isUsableSnapshot` (every key, shape version, seed) | `ENGINE_SNAPSHOT_REJECTED` (`rule: SIM_SNAPSHOT`). The simulator would fall back to a fresh dataset silently (proof F-5); here it is fatal |
| 8 | `store.setState(slices)` with the epoch of the start; `rng.reseed(epoch)` | — |
| 9 | Mode `boot` only: what a process start does (section 7) | — |
| 10 | Write the difference through the unit (`core_state.epoch`, the fault's rows, the tablet-link row) | As any unit |
| 11 | After the commit: `committed` := the state, revision 0, the commit listener on the pipeline, the scheduler started, `ready.engine` := true, one publication `cause: 'start'` | — |

Every failure rejects `start`, leaves the host stopped and `ready.engine` false, and writes one
error line `engine not started` in the form of a failed boot check (`step`, `mode`, `code`, and for
a refusal of the host its fixed text as `detail`) plus one entry in the persistent error log. As a
boot step it stops the boot: `BootError` with `stepId: 'engine.rehydrate'`, and the entry point
exits without a listener, as for B-1 to B-9.

**An unseeded database** never reaches the step: boot check B-6 refuses to start (database
contract §7.4), which is the specification's rule for it. Asked directly, the step refuses it with
`ENGINE_STATE_UNREADABLE` and writes nothing. **The server never seeds.**

**What is restored and what is fresh** (spec §8.6): the 28 slices are the stored ones, by
reference; `audio`, `clock`, `auth` (signed out), `authLockout` and `pairing` are the fresh `Sim`'s
(`pairing` takes the stored certificate fingerprint); the random streams are re-derived from the
seed and the epoch; subsystem timers start at the first tick, so no activity is invented for the
time the server was down (tested: no row is stamped inside a 90 s stop).

**The three modes of a start.**

| Mode | Entry | Epoch | Restart fault, tablet link, tamper overlay |
|---|---|---|---|
| `boot` | The boot step: a PROCESS start | stored + 1 | Applied |
| `reset` | `engine.reload()`, after the reset routine | The stored one AS IT IS (the routine wrote previous + 1) | Not applied: a scenario's recording keeps running |
| `resync` | The host itself, after a diverged head (section 11) | stored + 1 | Not applied |

## 7. The restart fault

`applyProcessStart(sim, lastCommittedAt, now)`, synchronous, before the write of step 10:

| Stored at the stop | What happens | Rows |
|---|---|---|
| PRECHECK, ARMED, RECORDING, STOPPING, FINALIZING | `injectFaultTransition(state, lastCommittedAt, 'POWER_FAIL')` of the shared code, with no actor: the session is in FAULT, `fault.at` and the bytes are those of the **last committed instant** (decision D28 D-1) | `FAULT_RAISED` (actor null, at the last committed instant), an alert, a health snapshot row `FAULT_RAISED / POWER_FAIL` |
| FAULT | Nothing: the session is the stored object | none |
| RECOVERY, no session, CREATE, SEALED | Nothing; a recovery completes by its stored deadline at the first tick | none |
| `AUDIT_TAMPER` active | The ring was rebuilt from the table and verifies; `clearFaultTransition` at `now` (spec §12.3) | `FAULT_CLEARED` |
| Tablet link CONNECTED | `setTabletLink('OFFLINE')` at `now` (no device is connected after a start) | `TABLET_LINK_CHANGED` (actor null) |

Measured (restart 90 s after a clean stop at 30 s of the scenario): `fault.at` and the row's `at`
are the stop instant; `active_session.bytes_written` is 2,624,000,000 = `recordingBytes(stop -
startedAt)`, not 2,829,000,000. After a process that died without a stop (30.45 s on its clock, the
last write at 30.00 s), the fault is stamped at 30.00 s: what the tables hold decides, not what the
dead engine had in memory. The operator then recovers the session (`recover`): `SYSTEM_BOOT`,
`RECOVERY_STARTED` (the caller), `FAULT_CLEARED`, `SESSION_INCOMPLETE`, `RECOVERY_COMPLETED`; the
history entry is INCOMPLETE and the evidence item RECORDED, never sealed.

The instant includes the newest stored audit row and event beside the two columns the brief names
(the migration row's ruling, `17_db_schema_migrations.md` §10): a server-native row written after
the last engine write proves the process was alive then, and the shared `recordActivity` would not
stamp a row before it in any case.

## 8. The scheduler

| Rule | Detail |
|---|---|
| The timer | Injected (`EngineTimer.every`). Production: the system timer of `timer.ts`, one unreferenced interval of 50 ms, cancelled at stop. Tests: a manual timer fired by hand beside a manual clock; no test waits |
| One tick, one unit | Each timer call submits `app.pipeline.run('engine.tick', ...)`: `sim.tick()` at the server clock, then the write plan |
| One in flight (ENG-1) | A timer call submits nothing while the last tick or probe is queued or running; it is counted (`ticksSkipped`). The next tick carries the elapsed time (tested: 20 skipped calls, one tick, one 1 Hz step) |
| Order | A tick waits its turn behind a command that was submitted first; both publish in commit order |
| Nothing durable changed | No statement, no transaction, no connection |
| The snapshot row | At most one write per second of the server clock by a tick. The simulator's own 1 Hz step falls on whole seconds, so it shares the unit of the session's progress: one transaction a second while recording (finding F-4) |
| The health snapshot | Due when the server clock has passed 60 s since the start or the last one; written by the tick that finds it due, also when nothing else changed. After a long suspension one row, not one per missed minute |
| Meter frames | After every tick whose `audio` slice changed: `app.publish({ kind: 'meters', frame })`, `seq` 1, 2, 3, ... Never stored |
| A tick that is not committed (ENG-5) | The state is set back; ticks are SUSPENDED; one error line. While suspended, at most one probe per second of the server clock: a unit that opens, reads the head and commits. The first probe that commits, or a command that commits, resumes the ticks |
| Stop | The interval is cancelled, the unit in flight ends, then the last write (section 10) |
| Time | Every instant is `app.clock`'s. The folder reads no system time and draws no random number (static test) |

## 9. What the realtime channel (W42) can rely on

`app.publish` is called through the seam at each use, so the channel's real function is what runs
once W42 provides it. Two kinds come from the engine:

```ts
{ kind: 'state', change: EngineStateChange }   // { epoch, revision, at, cause, records, ops }
{ kind: 'meters', frame: EngineMeterFrame }    // { at, seq, audio }
```

| Guarantee | Detail |
|---|---|
| After the commit | A change is published after the unit's COMMIT and before the next unit starts. Nothing is published for a unit that was rolled back |
| Order | Commit order. `at` is non-decreasing |
| One per unit | One `state` publication per unit that changed a replicated slice; none for a unit that changed none |
| Revisions | `revision` is exactly the previous one plus 1 within the epoch, without a gap (tested: 1 to 72 over a minute) |
| `ops` | In the shape of the contract's `DeltaOp`: `replace` one whole slice, `append` rows to `audit` (with `head`, `total`, `dropped`) or `events`. Every op of a real run parses with `DeltaOpSchema`; the ops applied to the first state give exactly `engine.state()` (tested). The audit ring is replaced whole only when a ring row changed in place (`AUDIT_TAMPER` and its clearing) |
| Values | The engine's own slices BY REFERENCE: serialise, do not change |
| `cause` | `command`, `tick`, `native` (rows of a server-native unit), `operators`, `stop`, and `start` |
| `cause: 'start'` | A NEW EPOCH (a start, a reload after a reset, a reload after a diverged head): `revision: 0`, `ops: []`. Send a `snapshot` to every OPERATOR socket (RT-7) |
| `records` | True when a class S slice changed; false when only snapshot slices did (the pacing of RT-P11) |
| The snapshot | `app.engine.state()` is the committed state at `app.engine.revision` and `app.engine.epoch`: exactly what the published changes sum up to. It never holds an uncommitted change or an actor |
| Read-your-writes (RT-5) | The revision in a command's outcome is the revision of the change that holds its effect, or the current one when nothing replicated changed |
| Meter frames | One per tick whose audio changed (20 Hz), `seq` gap-free from 1 per start, no revision |
| Never in a publication | `auth`, `authLockout`, `pairing`, `clock`; `audio` only in `meters` |
| The tablet link | `app.engine.setTabletLink(state)` from real connections; after a process start it is OFFLINE |

## 10. What the reset and demo-control rows (W43) can rely on

| Entry | Behaviour |
|---|---|
| `engine.stop()` | Callable at any time, not tied to closing the app, idempotent. Sets `ready.engine` false, cancels the interval, lets the engine's unit in flight end, writes what is not written yet (the hardware snapshot) in a last unit `engine.stop`, removes its commit listener. When it resolves nothing of the engine is scheduled or queued. Commands answer 503 from the call on |
| `engine.reload()` | After the reset routine, on the pool the caller reopened: rehydrates from the rebuilt database and takes the stored epoch AS IT IS; revision 0; no restart fault; a fresh ring on the stored head and the stored event counter; sets `ready.engine`; publishes `cause: 'start'` |
| `engine.start('boot')` | The process start: stored epoch + 1 and the restart rules |
| Close hooks | `preClose` (before the realtime channel's, so the last change is published while sockets are open) and `onClose` (before the core's and the pool's) both call `stop()`; the second call does nothing |

The quiesce order of decision D74, as tested (`restart.db.test.ts`, "a reset inside a running
server"):

```ts
const release = app.readiness.hold('reset');                 // every other request: 503
const report = await resetDatabase({ ..., quiesce: async () => {
  await app.pipeline.drain();
  await app.engine.stop();                                   // scheduler off, the last snapshot written
  await app.db.close();
} });
await app.db.reopen();                                       // then the boot checks (B-1 is the probe)
await app.engine.reload();                                   // epoch === report.epoch
release();
```

Measured: epoch 1 → 2 by the routine; after `reload` 2; after `stop` and `start('boot')` 3. The
scenario's recording was RECORDING after the reload (no restart fault), the kept settings were
there, and the next audit row was `report.auditHead.seq + 1` on `report.auditHead.hash`.

For the two demo faults: `inject` and `clearFault` write no actor by design (D28 D-3). The host
writes one line `hosted action ran` with `action` and `operatorId`, at level `debug`; the info-level
line of D-3 is the module's.

## 11. A unit that is not committed, and a diverged head

| Case | What the host does |
|---|---|
| Any failure of a unit of the engine (the work threw, a statement failed, the COMMIT failed, the watchdog fired) | `store.setState(before, true)`: the store is the object it was before the unit (ENG-5). `committed` never moved. The caller gets what the pipeline rejected with |
| `COMMIT_FAILED`, `UNIT_TIMEOUT` (the outcome of the commit may be unknown, core finding F-6) | The next unit of the engine compares the stored head with its own before it moves the state. Equal: the commit did not happen, go on |
| The stored head is not the engine's (another writer, or an unknown commit that did happen) | Detected before anything is written: one error line `audit head diverged` with both sequence numbers, 503 `AUDIT_HEAD_DIVERGED`, nothing stored, the state set back. The host then RELOADS from the database (`start('resync')`): not ready meanwhile, a new epoch, every client gets a snapshot. If the reload fails it is tried again once a second until one succeeds or the host is stopped |
| Rows of a server-native unit that do not continue the ring (at its commit) | The same reload |
| A tick | As above, plus the suspension of section 8 |
| A refusal thrown by a module inside `engine.run` | The same set-back; one debug line |

Rollback is by reference for the store only. What lives in closures of the simulator (the
generator's schedule, the positions of the random streams) is not restored: a rolled-back tick's
integrity row is not emitted again, and the chain stays valid (proof F-9). The fixed-seed
comparison of AC-B-52 holds for runs without a rollback.

## 12. Verification

### 12.1 The row command (12:32:35)

```
$ DEMS_TEST_STEP=48 npm run test:db -w @dems/core-server -- src/engine

> @dems/core-server@0.2.0 test:db
> vitest run --project db src/engine


 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/core-server

[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_48_tmdbeb2g_
[test:db] stale sweep: dropped 0; kept 0 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
[test:db] template dems_test_step_48_tmdbeb2g_tpl_schema: built in 78 ms (create 28 ms, hook 48 ms)
[test:db] template dems_test_step_48_tmdbeb2g_tpl_seed: built in 123 ms (create 43 ms, hook 79 ms)

 Test Files  4 passed (4)
      Tests  53 passed (53)
   Start at  12:32:35
   Duration  8.25s (tests 87%, import 8%, transform 5%)

[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 2 database(s) in 47 ms; 0 remain with the run prefix dems_test_step_48_tmdbeb2g_
exit=0
```

The same command had exited 0 at 12:10:12, 12:18:46, 12:23:28 and 12:26:21 (53 of 53 each), and
three times in a row at 12:21 after the fix of finding F-3.

### 12.2 What the tests printed (verbose run, 12:32:43, exit 0, 53 pass marks, 0 failures)

```
[w26] boot on a seeded clone: B-1 to B-9, engine.rehydrate; epoch 0 -> 1 (start), -> 2 (stop + start), -> 3 (new process); the whole boot 42 ms, the rehydration unit 26 statements (16 reads; writes: audit_log, events, engine_counters, core_state, engine_counters, hardware_snapshot)
[w26] journey: setTabletLink → createSession → beginPrecheck → startRecording → addMarker → addNote → snapshot → stopRecording → acknowledgeSummary; 93 stored audit rows, chain ok; auth signed out after each of 9 commands
[w26] one command (addMarker): 11 statements in 1.3 ms: BEGIN ISOLATION LEVEL READ COMMITTED | SELECT seq, hash FROM public.audit_chain_loc | SELECT set_config('statement_timeout', $1, t | select "id", "username", "rank", "name", "di | insert into "audit_log" ("seq", "id", "at",  | insert into "events" ("seq", "id", "at", "ty | UPDATE public.engine_counters SET next_value | update "engine_counters" set "next_value" =  | update "engine_counters" set "next_value" =  | update "active_session" set "marker_count" = | COMMIT
[w26] 6 refused commands: 403 NOT_PERMITTED (NOT_PERMITTED), 409 INVALID_STATE (ILLEGAL_STATE), 422 INVALID_REASON (REASON_TOO_SHORT), 422 INVALID_INPUT (NOTE_INVALID), 404 NOT_FOUND (NOT_FOUND), 409 SESSION_ACTIVE (SESSION_ACTIVE); auth signed out after each
[w26] rehydration: 101 audit rows; 28 slices equal before the stop and after a new process (negative zero as zero); only core_state.epoch moved
[w26] restart fault: RECORDING at the stop -> FAULT after rehydration; FAULT_RAISED at the last committed instant (90 s before the restart), bytes 2624000000 (not 2829000000); recover -> INCOMPLETE, evidence RECORDED
[w26] reset inside a running server: epoch 1 -> 2 by the routine; after reload 2 (no second increment); after stop + start 3
[w26] AC-B-52: 230 stored audit rows = the shared simulator's (seq, at, type, actor, hash); type digest 4b5d34e1ac7d…; the 12 rows of the minute: WRITE_VERIFIED, FRAME_HASH, WRITE_VERIFIED, FRAME_HASH, TIMESTAMP_CONFIRMED, WRITE_VERIFIED, FRAME_HASH, FRAME_HASH, TIMESTAMP_CONFIRMED, WRITE_VERIFIED, TIMESTAMP_CONFIRMED, WRITE_VERIFIED
[w26] AC-B-07: 60 s of recording: audit_log +12, events +1, health_snapshots +1; the other 27 tables unchanged
[w26] 60 s of recording: 1,200 ticks in 218 ms wall time; a tick that wrote 2.155 ms (72 ticks, 429 statements, 6.0 a unit), a tick that wrote nothing 0.056 ms (1,128 ticks, no statement)
[w26] idle minute: 1,200 ticks in 115 ms wall time; 182 writing ticks in three minutes; 60 snapshot writes in the first minute; health snapshots at +60 s, +70 s (raise), +80 s (clear), +120 s, +180 s
```

Pass marks per file: `commands.db.test.ts` 20, `restart.db.test.ts` 14, `recording.db.test.ts` 13,
`ticks.db.test.ts` 6. The 12 audit types of the minute are the 12 of the headless proof, in its
order (`04_proof_headless_engine.md` §2.1, line `INFO d1 60 s appended`).

### 12.3 The cases of the row and of the brief

| Case | Test | Result |
|---|---|---|
| The audit-type sequence of the recording scenario equals the shared simulator's (AC-B-52) | `recording.db.test.ts`: "the stored audit-type sequence equals the simulator's, row for row, hash for hash; its digest is the proof's reference" | PASS |
| `auth` signed out after every command, also after one that throws (AC-B-53, SR-79) | `commands.db.test.ts`: the journey (9 commands) and "each refusal is the mapped answer ..." (6 throwing commands); `actor-scope.test.ts` (with the negative control) | PASS |
| A 60 s recording writes zero meter-frame rows (AC-B-07) | `recording.db.test.ts`: the two tests under "AC-B-07" | PASS |
| A tick that changed nothing durable sends no statement | `recording.db.test.ts`: "1,200 ticks ran; 72 of them wrote, the other 1,128 sent no statement and took no connection" | PASS |
| A rehydrated engine equals the state before the stop | `restart.db.test.ts`: "after a day of commands and ticks, a stop and a new process ..." | PASS |
| A session in RECORDING at the stop is in FAULT after rehydration | `restart.db.test.ts`: the two tests of the restart fault (clean stop; a process that died); `rehydrate.test.ts` for the five states | PASS |
| A failed commit sets the engine back, and the next command works | `commands.db.test.ts`: "a COMMIT that fails ..."; three "a statement that fails ..." | PASS |
| A diverged head is detected and nothing is stored | `commands.db.test.ts`: "a diverged head (another writer the engine did not see) ..." | PASS |
| Server-native rows are merged; the engine's next rows continue the head | `commands.db.test.ts`: "a native row appended by another unit ..."; "engine.run: native rows and hosted actions of ONE unit ..." | PASS |
| The stop / start cycle, with the tolerance for negative zero | `restart.db.test.ts` (rehydration; boot; reset) | PASS |
| The health snapshot cadence with a manual clock | `ticks.db.test.ts`: "three idle minutes ..."; `recording.db.test.ts`: "the 60 s health snapshot ..." | PASS |
| The scheduler does not submit a tick while one is queued | `ticks.db.test.ts`: the two tests under "ENG-1"; `scheduler.test.ts` | PASS |
| Shutdown leaves no timer and no open client | `restart.db.test.ts`: "the stop writes what a tick left ..." | PASS |
| No secret and no slice content in the log | `commands.db.test.ts`: "holds codes, counts, labels ..."; `restart.db.test.ts`: the rejected state; `plugin.test.ts`: the driver text | PASS |
| An unseeded database | `restart.db.test.ts`: "an unseeded database is refused by B-6 ..."; `plugin.test.ts` | PASS |
| Epoch: previous + 1 at every start; as stored after a reset (D74) | `restart.db.test.ts`: the boot test; "a reset inside a running server" | PASS |

### 12.4 Whole projects, typecheck, lint (final state)

```
$ DEMS_TEST_STEP=48 npm run test:db -w @dems/core-server -- --maxWorkers=2          (12:37:38)
 Test Files  45 passed (45)
      Tests  623 passed (623)
   Start at  12:37:38
   Duration  47.52s (tests 90%, import 9%, transform 1%)
[test:db] forced drops that needed a retry: 1 (1 refusal(s) with SQLSTATE 42501 while a backend that the owner role may not end, such as an autovacuum worker, was on the database; each drop then went through)
[test:db] teardown: dropped 8 database(s) in 153 ms; 0 remain with the run prefix dems_test_step_48_tmdbmqkh_
exit=0

$ npm run test -w @dems/core-server -- --maxWorkers=2                               (12:38:31)
 Test Files  70 passed (70)
      Tests  1848 passed (1848)
   Start at  12:38:31
   Duration  14.11s (import 58%, tests 37%, transform 5%, worker 1%)
exit=0

$ npm run typecheck -w @dems/core-server      exit=0
$ npm run lint -w @dems/core-server           exit=0
src/plugins/readiness/__tests__/readiness.test.ts:250:11: warning eslint(no-unused-vars): Variable 'app' is declared but never used.
src/plugins/readiness/__tests__/readiness.test.ts:251:11: warning eslint(no-unused-vars): Variable 'unit' is declared but never used.
```

The two warnings are finding F-2. No finding is in `src/engine/`.

### 12.5 Every run of the whole projects (P11)

| Time | Project | Result | Note |
|---|---|---|---|
| 11:23:03 | `unit` | 41 files, 1,281 passed | Baseline, before this row's first edit |
| 11:23:23 | `db` | 29 files, 436 passed | Baseline |
| 11:42:33 | `unit`, one file | 2 failed of 14 in `core-plugin.test.ts` | By design: section 15 (2) |
| 11:44:43 | `unit` | 51 files, 1,541 passed | After the two authorised adaptations |
| 11:44:54 | `db` | 4 failed, 468 passed | By design: section 15 (3) to (5). No test of this row existed yet in `db` |
| 11:55:48 | `db`, three files | 33 passed | After the adaptations of decision D72 |
| 12:10:44 | `unit` | 68 files, 1,796 passed | |
| 12:11:02 | `db` | 44 files, 615 passed | |
| 12:19:14 | `unit` | 69 files, 1,805 passed | |
| 12:19:46 | `db` | 616 passed, **one file failed as a whole**: `src/engine/__tests__/restart.db.test.ts`, all of its 14 tests passed | Finding F-3: the helper's forced drop of the database a reset had just built was refused (`permission denied to terminate process`). Fixed in this row's test: that one database is dropped with the plain form. Not seen again in any later run |
| 12:21:50 | `db` | 44 files, 616 passed | After three consecutive green runs of `src/engine` (53 of 53 each) |
| 12:23:50 | `db` | 44 files, 616 passed | |
| 12:24:45 | `unit` | 69 files, 1,805 passed | |
| 12:26:41 | `db` | 44 files, 616 passed | |
| 12:27:30 | `unit` | 69 files, 1,805 passed | The last source edit of this row followed at 12:32:23 (one comment line of `index.ts`) |
| 12:32:51 | `db` | **1 failed**, 622 passed, 45 files | `src/db/reset/__tests__/reset-failures.db.test.ts` (the reset row's): "R-6 ... a carried row was changed", `sessions of the routine: expected [ { database: 'postgres', … } ] to deeply equal []` after its 3 s wait. Noise: finding F-15. 1-minute load average 7.58; another row's database run was in flight (9 of its databases existed at 12:33:57). The helper row's change had landed at 12:27:53 (the file count went from 44 to 45) |
| 12:34:13 | `db`, that file alone | **1 failed**, 47 passed | Another test of it ("R-5a"), the same assertion; load average 6.6 |
| 12:34:46 | `db` | **2 failed**, 621 passed | The same file, two other tests ("R-0", "R-5d, R-5e"), the same assertion |
| 12:36:21, 12:36:45, 12:37:08 | `db`, that file alone | 48 passed, three times | Load average 3.1 |
| 12:37:38 | `db` | 45 files, 623 passed | **Final** |
| 12:38:31 | `unit` | 70 files, 1,848 passed | **Final** |

Typecheck was red twice in files of the identity row in flight, never in `src/engine/`: at 11:37
(`src/plugins/authenticate/index.ts(188,48)`, TS2339) and at 11:53
(`src/plugins/authenticate/__tests__/authenticate.test.ts(299,35)`, TS2345); green at 12:09 and
after.

## 13. Measurements (this host, PostgreSQL 18.4, other rows running)

| What | Measured |
|---|---|
| One command with one audit row and one event (`addMarker`) | 11 statements, 1 connection, 1 transaction; 1.2 to 3.7 ms (six runs: 1.8, 1.5, 3.7, 2.4, 1.2, 1.3) |
| A command that changes nothing | 5 statements: `BEGIN`, chain lock, statement limit, the operators read, `COMMIT` |
| A refused command | The same four and `ROLLBACK` |
| A tick that changed nothing durable | 0 statements, no connection; 0.033 to 0.070 ms of wall time, the test's own loop included |
| A tick that wrote, while recording | 6.0 statements on average (429 in 72 units); 1.35 to 2.58 ms |
| 60 s of recording | 1,200 ticks, 72 writing units, 429 statements; 128 to 265 ms of wall time for the whole minute |
| An idle minute | 1,200 ticks, 60 writing units of 5 statements (one `hardware_snapshot` update a second); 97 to 142 ms |
| The boot on a seeded clone | 34 to 42 ms for B-1 to B-9 and the rehydration; the rehydration unit 26 statements |
| A probe while suspended | 4 statements: `BEGIN`, chain lock, statement limit, `COMMIT` |

## 14. Requirement to test

| Requirement | Where it is proven |
|---|---|
| SR-55 (the hosted actions always write their row) | `commands.db.test.ts`: each command's rows are in the table when it resolves, in the same transaction as the state change; the denied export writes `EXPORT_DENIED`; `setTabletLink` writes `TABLET_LINK_CHANGED`; every raised fault writes `FAULT_RAISED`. `recording.db.test.ts`: the engine's own rows |
| SR-59 (the two tamper faults never alter a stored audit row, a sealed hash, a manifest hash or a signature) | `commands.db.test.ts`: "AUDIT_TAMPER alters the engine's ring only ..." (every stored row byte-equal by `to_jsonb`, before and after); "the evidence TAMPER fault ..." (item, tracks byte-equal; custody only grows); `write-plan.test.ts`; the restart clears the overlay (`rehydrate.test.ts`) |
| SR-65 (no client-supplied time, actor, role or revision) | `command` has no such parameter; the journey asserts every row's `at` is the server clock at the command and its actor is the principal's operator; the role is the table's (`commands.db.test.ts`, "ENG-3") |
| SR-79 (the scope is cleared in a `finally`) | `actor-scope.test.ts` (three throwing actions, a non-simulator error, the negative control); `static.test.ts` ("the scope is set, the action is called, and the slice is cleared in a finally") |
| AC-B-07 | `recording.db.test.ts` |
| AC-B-52 | `recording.db.test.ts`; `rehydrate.test.ts` ("the random streams are re-derived ...") |
| AC-B-53 (as reworded by D28 D-2) | `commands.db.test.ts` (the journey: `PRECHECK_PASSED` names the creator with `by: system`, every other engine row has no actor); `recording.db.test.ts` |
| AC-B-55 | `recording.db.test.ts`: the two tests under "AC-B-55"; the journey |
| ENG-1, ENG-6 | `ticks.db.test.ts`; `scheduler.test.ts` |
| ENG-3 | `commands.db.test.ts`: "a role changed in the table decides the very next command ..." |
| ENG-4 | `recording.db.test.ts`; `write-plan.test.ts` |
| ENG-5 | `commands.db.test.ts` (five tests under "ENG-5"); `ticks.db.test.ts` (four tests) |
| ENG-7 and spec §7.2 | `errors.test.ts` (all 14 lines of the table); `commands.db.test.ts` (six refusals against PostgreSQL) |
| ENG-8, ENG-10, AP-6 | `commands.db.test.ts` (four tests under "one chain"); `ring.test.ts` |
| Spec §8.6 (start, stop, restart) | `restart.db.test.ts`; `rehydrate.test.ts` |
| Spec §8.7 (rates and the write budget) | `recording.db.test.ts`; `ticks.db.test.ts` |
| Spec §9.3 (what a delta holds) | `delta.test.ts`; `recording.db.test.ts` ("every operation is a DeltaOp ...") |
| Spec §12.4, D74 (reset) | `restart.db.test.ts` |
| D28 (every adapter injected; a rejected snapshot fatal; D-1) | `rehydrate.test.ts`; `static.test.ts`; `restart.db.test.ts` |
| D40 (the boot step) | `restart.db.test.ts`; `plugin.test.ts` |

### 14.1 Test ledger (P24)

`@dems/core-server` only. No other workspace was written.

| Project | Before (11:23) | After (final) | This row |
|---|---|---|---|
| `unit` | 41 files, 1,281 tests | 70 files, 1,848 tests, 0 failed | **+10 files, +128 tests**. The other 19 files and 439 tests were added by rows that ran at the same time |
| `db` | 29 files, 436 tests | 45 files, 623 tests, 0 failed | **+4 files, +53 tests**. The other 12 files and 134 tests are other rows' |

| Project | File (`apps/core-server/src/engine/__tests__/`) | Tests |
|---|---|--:|
| `unit` | `actor-scope.test.ts` | 8 |
| `unit` | `delta.test.ts` | 11 |
| `unit` | `errors.test.ts` | 23 |
| `unit` | `hosted-actions.test.ts` | 17 |
| `unit` | `plugin.test.ts` | 8 |
| `unit` | `rehydrate.test.ts` | 24 |
| `unit` | `ring.test.ts` | 6 |
| `unit` | `scheduler.test.ts` | 7 |
| `unit` | `static.test.ts` | 15 |
| `unit` | `write-plan.test.ts` | 9 |
| `db` | `commands.db.test.ts` | 20 |
| `db` | `recording.db.test.ts` | 13 |
| `db` | `restart.db.test.ts` | 14 |
| `db` | `ticks.db.test.ts` | 6 |

The five adapted test files of other rows keep their test counts.

## 15. Existing tests changed by design

Five files. Pre-images: `.cache/rollback/W26.<name>.pre` (the files are untracked at `acaff20`,
so the P23 patch `.cache/rollback/W26.pre.patch` is empty and copies were saved). No test was added
or removed in any of them.

**Which case it was** (the controller's question of 11:42 and 11:53): in all four files of (2) to
(5) it was **by design**, not a defect of the step. Failure texts:

- `core-plugin.test.ts:249` and `:260` (11:42:33): `AssertionError: expected BootError: boot step
  engine.rehydrate fai… { stepId: '…' } to be null`. The stand-in pool answers the nine checks and
  nothing else, so no engine state can be read from it; the nine checks had passed (the `passed`
  list still held). The step ran only after them and failed through the readiness chain.
- `test/db/boot-checks.db.test.ts:348` and `src/core/__tests__/boot-checks.db.test.ts:91`, `:193`
  (11:44:54): `expected BootError: boot step engine.rehydrate fai… to be undefined`, cause
  `EngineError ENGINE_STATE_UNREADABLE` / `MappingError ROW_SHAPE at engine_counters: the counter
  event has no row`. These clones are not unseeded: the tests insert a `core_state` row by hand so
  that B-6 passes, and nothing else of a seed. The specification's rule for a database without a
  dataset is B-6: the server **refuses to start** (database contract §7.4); it has no "coded not
  ready and listening" state. A database with a state row and no state is refused in the same form
  one step later, with a code and the seed command.
- `seeded.db.test.ts:28` (11:53:37): `expected [ 'B-1', … …(6) ] to deeply equal [ 'B-1', … …(5) ]`,
  `+ "engine.rehydrate"`. The step did **not** fail on the seeded clone: it passed, and its ID is
  the tenth entry of a list the test pinned to nine. The run of another row at 11:38:57, which
  showed "boot step engine.rehydrate failed" there, was not captured by this row; it fell into the
  minutes in which the host's first version was being written (11:35 to 11:40). In every run of
  this row from 11:40 on, the step passes on a seeded clone.

One thing was changed on the step's side first: a database that does not answer during the
rehydration now surfaces as the pipeline's own 503 `NOT_READY` (`DATABASE_UNAVAILABLE`) instead of
a `StoreError` that wrapped it, and the line `engine not started` has the form of `boot check
failed`.

**(1) `apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts`** (standing rule of D52;
edited 11:44:24, re-read right before; the identity row had already deleted its own two lines).
SHA-256 before `9d8177a9…662cb41`, after `bce1fa68…74518e9`.

```
252,253d251
<     expect(() => app.engine.epoch).toThrow('plan row W26');
<     expect(() => app.engine.revision).toThrow('plan row W26');
```

**(2) `apps/core-server/src/core/__tests__/core-plugin.test.ts`** (controller's note of 11:42,
D72; edited 11:44:03). SHA-256 before `8b8f1585…f26f7c5c`, after `62b2b8f9…63b9edf0`.

| Line (before) | Before | After | Reason |
|---|---|---|---|
| 249 | `expect(error).toBeNull();` | Two comment lines and `expect((error as BootError).stepId).toBe('engine.rehydrate');` | The boot no longer ends after B-9 on a stand-in that holds no state. The test's subject, the order of B-1 to B-9, is asserted by the unchanged next line |
| 260 | `expect(error).toBeNull();` | One comment line and the same assertion | The same; "B-8 never blocks and B-9 still runs" is asserted by the unchanged `passed` list |

**(3) `apps/core-server/test/db/boot-checks.db.test.ts`** (the migration row's; controller's note
of 11:53; edited 11:55). SHA-256 before `9655012d…47a03429`, after `c8cad380…7f464f6d`.

| Line (before) | Before | After | Reason |
|---|---|---|---|
| 348 | `expect(result.stopped).toBeUndefined();` | Three comment lines and `expect(result.stopped?.stepId).toBe('engine.rehydrate');` | "Nothing runs after B-9" is no longer true. "Every blocking check passes, in order" is the unchanged `passed` list |

**(4) `apps/core-server/src/core/__tests__/boot-checks.db.test.ts`** (edited 11:55). SHA-256
before `00b2ef88…3efc270b`, after `48ed891e…599d9760`.

| Line (before) | Before | After | Reason |
|---|---|---|---|
| 91 | `expect(result.stopped).toBeUndefined();` | Two comment lines and `expect(result.stopped?.stepId).toBe('engine.rehydrate');` | As (3) |
| 102 | Comment: "The database is ready; the engine host is a later row, so the server is still not ready." | "The database is ready; the engine could not rehydrate from this fixture, so the server is not ready." | The reason in the comment was no longer true; the two assertions under it are unchanged and hold |
| 193 | `expect(booted.stopped).toBeUndefined();` | Two comment lines and `expect(booted.stopped?.stepId).toBe('engine.rehydrate');` | As (3) |

**(5) `apps/core-server/src/core/__tests__/seeded.db.test.ts`** (edited 11:55). SHA-256 before
`8e7eed4f…f76e28d13`, after `a62840bc…7359ebd74`.

| Line (before) | Before | After | Reason |
|---|---|---|---|
| after 37 | The list ends with `'B-9',` | Two comment lines and `'engine.rehydrate',` added | The exact list of boot steps was pinned; on a seeded database the engine's step passes |

Verified: `core-plugin.test.ts` 14 of 14 (11:44:03); the three database files 33 of 33 (11:55:48);
both whole projects green afterwards. The premise of (3) to (5) is also proven by this row's own
tests: on a seeded clone the passed steps are exactly B-1 to B-9 and `engine.rehydrate`; on a clone
with a state row only the boot passes the nine checks and stops at `engine.rehydrate`
(`restart.db.test.ts`).

## 16. Mutation check

28 defects were planted one at a time into a copy of the workspace outside the repository (so that
no other row's run saw a mutated file); the `unit` tests of `src/engine` ran on each, and the `db`
tests when those passed (12:13:26 to 12:17:44). **28 of 28 detected.**

| Detected by `unit` (14) | Detected by `db` (14) |
|---|---|
| The actor scope without the `finally`; the restart fault at the restart instant; a rejected slice accepted; a tick submitted while one is in flight; rows that do not continue the ring merged; the random streams not re-derived; a changed ring row sent as an append; `ILLEGAL_STATE` as 400; the last committed instant without the session row; an action that is not hosted run; the records of a tick held back; the system timer keeping the process alive; the health row of a fault not written; the engine clock not held at the last committed instant | A unit not committed does not set the engine back; `committed` does not move on; the snapshot written whenever it changed; server-native rows not merged; a reload after a reset adds 1; a start adds nothing; the operators not mirrored; a command leaves its snapshot change; the 60 s snapshot never due; the stop writes nothing; the revision moves by 2; no reload after a diverged head; the stored head not compared before a write; no meter frame published |

One candidate was left out as an equivalent mutant: removing the early return of a tick that has
nothing to write. The plan is then empty and still sends nothing.

## 17. What the specification left open, and this row's choices

| # | Open point | Choice |
|--:|---|---|
| 1 | The hardware snapshot "at most once a second": a rolling second or a clock second | Once per second of the server clock, for ticks; a command, a start, a stop and a fault raise or clear at once (finding F-4) |
| 2 | What a reader gets | The committed state, never the working state |
| 3 | The members of `EngineStateChange` | The contract's delta operations, by reference, with a cause and the `records` flag |
| 4 | How a new epoch is told to the channel | A publication `cause: 'start'`, revision 0, no operation |
| 5 | Whether a command writes its snapshot slices at once | Yes (read-your-writes, RT-5) |
| 6 | What follows a diverged head | A reload from the database with a new epoch (the specification says: rolled back, state set back, 503, one log line) |
| 7 | How "ticks are suspended until a write succeeds again" is found out | A probe unit at most once a second; any committing unit of the engine resumes |
| 8 | The first 60 s health snapshot | 60 s after the start |
| 9 | A server clock behind the stored state | The engine clock is held at the last committed instant; one warning with the difference |
| 10 | Which rehydration path of the proof | `store.setState` and `rng.reseed` (path B), so the host decides the epoch for the three modes; the simulator's acceptance test is applied explicitly and is fatal |
| 11 | A database that cannot give a state at boot | The boot fails (as B-1 to B-9); there is no "listening and not ready" state |
| 12 | The operators mirror | One read inside every command's unit; `mirrorOperators()` for the publication after an administration change |
| 13 | The level of the host's line per command | `debug` (`hosted action ran`, with the operator ID) |
| 14 | A failing subsystem of the simulator | One error line and one persistent entry per source and start; counted in `stats().simErrors` |

## 18. Findings

| ID | Finding | Evidence | Effect |
|---|---|---|---|
| F-1 | Six tests of four files of other rows pinned "the boot is B-1 to B-9 and nothing else" | Section 15 | Adapted under D72 |
| F-2 | **The scaffold's test "the stubs that are not implemented say which row fills them" is now empty.** After the identity row's and this row's deletions it holds two unused locals and no assertion: two lint warnings (exit 0) | `readiness.test.ts:249-252`; section 12.4 | Decision DN-4. Not removed: the standing rule allows a row its own lines only |
| F-3 | The test helper's forced `DROP DATABASE` is refused (`42501`, "permission denied to terminate process") for a database that a reset has just built, while an autovacuum worker is on it | The `db` run of 12:19:46: 616 tests passed and the file failed in its teardown; the reset row's own finding | This row's reset test drops that one database with the reset tests' plain form (`discard`). The helper row in flight adds a bounded retry |
| F-4 | **The simulator's 1 Hz hardware step falls on whole seconds of the clock, and its first step happens at the first tick.** With "at least 1,000 ms since the last snapshot write" every snapshot write was deferred by one tick: two transactions a second while recording (131 writing ticks a minute). With "once per clock second" the snapshot shares the unit of the session's progress: 72 | The trace of 11:40 and of 11:41 (first: `+1000 active_session`, `+1050 hardware_snapshot`; then both at `+1000`) | Choice 1 of section 17 |
| F-5 | A level in dBFS is stored by design: an `AUDIO_PEAK` item of a session's timeline holds `dbfs` | `types.ts:342`; a first version of the AC-B-07 test tripped on it | The markers of a meter frame in the tests are `channels` and `noSignal`, with a positive control |
| F-6 | The engine refuses nothing for the 23 actions the simulator does not check: a TECHNICIAN's `addNote` runs | A first version of the ENG-3 test (11:59); spec §7.17 "Rule today: none" | The access rule of each operation is the only check (W28). Stated in the module rules |
| F-7 | `acknowledgeSummary` leaves the SEALED session in place until the next `createSession` replaces it | The journey test | For W34's expectations |
| F-8 | `verify` on a tampered item appends one custody entry (`VERIFY_FAILED`); the item's sealed columns and its tracks stay byte-equal | The evidence-tamper test | Custody is additive by design (mapping) |
| F-9 | **A test of any row that calls `app.readiness.boot()` on a seeded clone now gets a running engine on the system timer** (one unreferenced 50 ms interval until `app.close()`). With a manual clock that does not move, the engine writes one snapshot at its first tick and nothing afterwards | `seeded.db.test.ts` runs so | A row that wants no real timer calls `engineControl(app).useTimer(...)` before the boot (this row's `manualTimer()` may be imported) |
| F-10 | The seed's tablet link is CONNECTED, so the first process start on a fresh seed writes one `TABLET_LINK_CHANGED` row (the chain is at 83 rows, not 82, once the server has started) | The boot test | For W58, W86 and W90 when they compare counts with the seed's |
| F-11 | 13 of the 31 hosted actions were not run against PostgreSQL by this row | Section 23 | The module rows run them (MODG) |
| F-12 | A unit of the engine whose write the mapping refuses (a defect) fails again at every resumed tick: one error line a second | Reasoning; not produced | Residual; it needs a state the shared code does not build |
| F-13 | Every op of a real run is a valid `DeltaOp` of the contract, and the durable slice list equals the contract's 28 replicated names | `delta.test.ts`; `recording.db.test.ts` | W42 can pass `change.ops` into a `delta` message as they are |
| F-15 | **A test file of the reset row is sensitive to load.** `reset-failures.db.test.ts` waits 3 s for the sessions of the routine to end and found one still listed, in three runs between 12:32 and 12:35 (a different test each time), while another row's database run was in flight; alone, at a lower load, it passed three times in a row. It boots no app and uses nothing of the engine | Section 12.5 | Noise by P11 for this row. For the reset row's owner or the gate W58: the 3 s wait of `waitForSessionsGone` is short for a loaded host |
| F-14 | No `SIM-GAP`, no `SCHEMA-GAP`, no `CONTRACT-GAP`: every row the hosted actions wrote passed the core's rules for prepared rows, and every statement was one `dems_app` may issue | 53 database tests | — |

## 19. Deviations from the row text

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | Five test files of other rows were edited | Section 15: one by the standing rule of D52, four by the controller's notes (D72) |
| DV-2 | The last committed instant also takes `at` of the newest stored audit row and event | The migration row's ruling (§10 of its log); it keeps `at` from going backwards |
| DV-3 | The host reloads by itself after a diverged head | Without it one foreign row would leave the engine refusing every write until a restart |
| DV-4 | `EngineHost` has far more members than the scaffold's sketch, and an `EngineControl` beside the seam | The scaffold calls the type a first sketch that this row defines. The control is for tests (the timer) |
| DV-5 | A third start mode, `resync`, beside the two of decision D74 | DV-3 |
| DV-6 | `readStoredRows` and `applyChanges` stay in `src/db/seed/store.ts` | D62 DN-10 allowed a move and did not ask for one; moving them is not possible inside this row's write path |
| DV-7 | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were not written | Parallel run: the controller writes them (P8) |
| DV-8 | The test support imports the test support of three other rows (`core`, `db/seed`, `db/reset`), read-only | Their files say other rows may |
| DV-9 | One test database is dropped with the plain form by the test itself | Finding F-3 |

## 20. Decisions for the controller

| ID | Question | Recommendation |
|---|---|---|
| DN-1 | The API of section 3 | Accept; it is what W32 to W43 build on |
| DN-2 | The snapshot rule "once per clock second" for ticks | Accept (F-4) |
| DN-3 | The reload after a diverged head | Accept. The alternative is to stay not ready until an operator restarts the server |
| DN-4 | The empty stub test of `readiness.test.ts` (F-2) | Let the scaffold's owner, or the next row that touches the file, delete the test and its two-line comment; every seam it named is filled |
| DN-5 | The last committed instant (DV-2) | Accept |
| DN-6 | A boot whose rehydration fails stops the process | Accept: the form of B-1 to B-9. There is no listening server with `ready.engine: false` after a failed rehydration |
| DN-7 | Pass to W42 | Section 9. `cause: 'start'` means a snapshot to every OPERATOR socket; `app.engine.state()` with `epoch` and `revision` is the snapshot; ops go into a `delta` unchanged; the tablet link through `app.engine.setTabletLink` |
| DN-8 | Pass to W43 | Section 10. The info-level log line of D28 D-3 for `inject` and `clearFault` is the module's (the host's is at `debug`) |
| DN-9 | Pass to W28, W34 to W40 | Section 3; F-6: the access rule is the only check for the 23 unchecked actions; a refusal in a result is returned from the unit, never thrown inside it |
| DN-10 | Pass to W33 | `await app.engine.mirrorOperators()` after the unit that changed an operator committed |
| DN-11 | Pass to every row whose database test boots the app | F-9 |
| DN-12 | Pass to W53 (restart acceptance) | The engine half of AC-B-04 to AC-B-06 is proven here; F-10 for the counts |
| DN-13 | The location of the store (D62 DN-10) | Leave it where it is; the code review W38 may still move it |

## 21. For the code review (W38)

- One folder, fourteen production files; no dependency added; nothing outside `src/engine/` imports
  a file of the folder other than `index.ts` (the realtime stub imports two types from it).
- Every error path writes a log line by code and, for a failure of the infrastructure or a defect,
  one entry in the persistent error log (`source: engine.host` or `engine.sim`). A refusal of the
  simulator or of a module is logged at `debug`: its caller answers it.
- No rejected promise is left without a handler: `start` hands its rejection to its caller; the
  reload loop never rejects; a tick's rejection is consumed by the scheduler.
- The two states (`committed` and the store) and the rule "moved only after the commit" are the
  header of `host.ts`.

## 22. End state and cleanup (12:38:25)

```
session: role=dems_owner server=18.4 postmaster started 2026-10-04 07:14:26.046351+07
databases with this row's prefix (dems_test_step_48_*): 0
test databases of all rows at this moment: 0
project databases: dems_demo, dems_lane_1, dems_lane_2, dems_lane_3
sessions on databases of this row: 0
pid file: 19121
```

(A scratch script outside the repository, as `dems_owner`, through the owner connection reader of
the database commands. It prints names and counts.)

- No database of this row remains; every run ended with `0 remain with the run prefix`.
- `dems_demo` and the three lane databases were never connected to: every test ran on a clone.
- PostgreSQL was never stopped or reconfigured: PID 19121, started 07:14:26, as at the start.
- No process of this row is left; every command ran in the foreground and returned. No port was
  bound (P18).
- The scratch copy of the workspace used for the mutation check was removed. A scratch smoke test
  that stood in `src/engine/__tests__/` from 11:40 to 12:00 was moved out of the repository.
- Pre-images: `.cache/rollback/W26.engine-index.ts.pre` (the scaffold's stub) and the five test
  files of section 15.
- Leak check after both documents were written (12:41; a scratch script outside the repository
  takes the two project-role passwords as search patterns in its own process, through the test
  helper's reader, and prints counts only):

  ```
  ./apps/core-server/src/engine: 29 file(s) scanned, 0 contain a credential value
  ./docs/.../implementation/26_engine_host.md: 1 file(s) scanned, 0 contain a credential value
  ./docs/.../delegation_progress/coder_execution_step_48.md: 1 file(s) scanned, 0 contain a credential value
  the five adapted test files: 5 file(s) scanned, 0 contain a credential value
  <scratchpad>: 3445 file(s) scanned, 0 contain a credential value
  total: 3481 file(s), 0 contain a credential value; patterns: 2
  ```

  This paragraph was added after that scan; it holds counts and paths only. The published demo
  password and the demo pairing code occur in no file of `src/engine/` and in neither document.

## 23. Not done, and not verified by this row

- A server started through `src/index.ts` with the real 50 ms interval and the wall clock: the
  backend gate W58 runs that path first. Here the system timer is tested with fake timers and the
  scheduler with a manual timer.
- 13 hosted actions were not run against PostgreSQL: `acknowledgePrecheckWarnings`, `retryPrecheck`,
  `cancel`, `exportAudit`, `exportLogs`, `resetClip`, `acknowledgeAlert`, `deviceCommand`,
  `startSoftwareUpdate`, `setActiveCamera`, `setPresentationMode`, and `archiveEvidence` and
  `restartServices` (refusals only). Run: `createSession`, `beginPrecheck`, `startRecording`,
  `stopRecording`, `scanCaseNumber`, `recover`, `addMarker`, `addNote`, `snapshot`,
  `acknowledgeSummary`, `verify`, `exportEvidence`, `verifyAuditChain`, `inject`, `clearFault`,
  `runDiagnostics`, `setStoragePolicy`, `updateSettings`, and `setTabletLink`.
- The watchdog path of the core (a unit abandoned after 5 s with an unknown commit) was not
  produced; the host's reaction to its two reasons is the same code as for `COMMIT_FAILED`, which
  is tested.
- A reload that fails and is retried was not produced against PostgreSQL.
- The realtime channel: the stub's `app.publish` was replaced by a recorder in the tests.
- Runs longer than three simulated minutes; memory.

## 24. Rollback (R-NEW; not executed)

`src/engine/` is this row's folder. Before this row it held one file, the scaffold's stub.

```sh
# from /Users/gsp-budi/Documents/DEMS
rm -rf apps/core-server/src/engine
mkdir -p apps/core-server/src/engine
cp .cache/rollback/W26.engine-index.ts.pre                apps/core-server/src/engine/index.ts
cp .cache/rollback/W26.readiness.test.ts.pre              apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts
cp .cache/rollback/W26.core-plugin.test.ts.pre            apps/core-server/src/core/__tests__/core-plugin.test.ts
cp .cache/rollback/W26.core-boot-checks.db.test.ts.pre    apps/core-server/src/core/__tests__/boot-checks.db.test.ts
cp .cache/rollback/W26.core-seeded.db.test.ts.pre         apps/core-server/src/core/__tests__/seeded.db.test.ts
cp .cache/rollback/W26.test-db-boot-checks.db.test.ts.pre apps/core-server/test/db/boot-checks.db.test.ts
```

Valid while no later row has built on the seam (W32 to W43 and W42 do). If another row has edited
one of the five test files since, do not copy its pre-image: put back the lines of section 15 by
hand. After the rollback the stub's two assertions pass again, the boot has the nine checks only,
`ready.engine` stays false, and nothing hosts the simulator.

## 25. Verification list of the row

| Check | Result | Section |
|---|---|---|
| `DEMS_TEST_STEP=48 npm run test:db -w @dems/core-server -- src/engine` exits 0 | Yes: 4 files, 53 tests | 12.1 |
| The audit-type sequence of the recording scenario equals the shared simulator's | Yes: 230 rows, with hashes; the proof's digest | 12.2, 12.3 |
| `auth` signed out after every command, also after one that throws | Yes | 12.3 |
| A 60 s recording writes zero meter-frame rows | Yes | 12.2 |
| A rehydrated engine equals the state before the stop | Yes | 12.2 |
| A session in RECORDING at the stop is in FAULT after rehydration | Yes | 7, 12.2 |
| `npm run typecheck -w @dems/core-server`, `npm run lint -w @dems/core-server` | Exit 0, exit 0 | 12.4 |
| The whole `unit` project | Exit 0: 70 files, 1,848 tests | 12.4 |
| The whole `db` project | Exit 0: 45 files, 623 tests; two earlier runs red in one file of the reset row, under load (P11) | 12.4, 12.5 |
| Test ledger with this row's files by name | Yes | 14.1 |
| No database with this row's prefix remains; `.locks/postgres.pid` unchanged (19121) | Yes | 22 |
| The edited lines of other rows' tests, by file and line, with the case | Yes | 15 |
| The two entries for a start and for a reload after a reset (D74), with the test | Yes | 6, 10 |
| No credential in this document | Yes | — |

## 26. Fix round B2a (decisions D89, D101, D104, D106, D110)

Six items on the engine host and on the core's clock, each developed and proven on a scratch copy
outside the source tree and landed in one step (2026-10-04, 18:45 to 19:53 WIB). Security finding
CPS1-1 of `gateway_check/05_cp_access_control_security.md` (guarantees G1 to G8) arrived during
item 1 and is answered in 26.1. No credential, token, pairing code or device credential appears
in this section.

### 26.0 Result

| # | Item | Outcome | Landed | Tests of this row |
|--:|---|---|---|---|
| 1 | F74 / CPS1-1: one time base, with a floor (D110) | Done. The server clock takes a floor from the newest stored instant at every start and runs on from it at the real rate; the engine reads `app.clock` and holds no floor of its own | 18:45:29 | `clock-floor.test.ts` (31), `clock-floor.db.test.ts` (13) |
| 2 | F73: the fault list after a resync or a reload (D106) | Done. Every start mode clears the fault of the tamper overlay. The pending demo test is un-skipped and passes. ONE assertion of the demo row pins the old outcome and is red (26.2) | 18:54:17 | `restart.db.test.ts` (5 new), `rehydrate.test.ts` (1 new) |
| 3 | F71 = F-W40-1: one consistent cut (D104) | Done. A unit that writes, writes every durable slice that changed. 72 writing ticks a minute as before; 434 statements (was 429) | 19:04:54 | `recording.db.test.ts` (2 replaced), `ticks.db.test.ts` (1 new), `write-plan.test.ts` (1 replaced) |
| 4 | F66: `EngineHost.meters()` (D89) | Done. Optional in the TYPE only (26.4) | 19:12:57 | `ticks.db.test.ts` (2 new), `plugin.test.ts` |
| 5 | API-7 headers in one place (D78 DN-8, D87) | Done. One pair of hooks in `src/engine/api-headers.ts`, for every POST operation of the contract registry | 19:32:13 | `api-headers.test.ts` (27), `api-headers.db.test.ts` (2), `api-headers.outcome.db.test.ts` (1) |
| 6 | One runner of the boot checks (D101) | Done. `runDatabaseBootChecks(app)` added to `src/core/boot-checks.ts` | 19:41:24 | `boot-checks-runner.test.ts` (12), `boot-checks-runner.db.test.ts` (4) |

Final state (19:53 to 19:57): whole `unit` project 147 files, 3,795 tests, exit 0. Whole `db`
project 119 files, 1,708 tests: 1,707 passed, 1 failed, 0 skipped; the one failure is the pinned
assertion of 26.2. Typecheck exit 0; lint exit 0 without a warning. Engine folder alone: unit 13
files / 199 tests, db 8 files / 82 tests, both exit 0.

### 26.1 Item 1: one time base, with a floor (F74; CPS1-1; D110)

**The change.**

| File | Before | After |
|---|---|---|
| `src/core/clock.ts` (54 lines → 155) | `:25 createSystemClock(source)`: `last = Math.max(last, source())` | `:37 FloorClock { raiseFloor(instant) }`; `:67 createSystemClock(source?, timer?)`; `:127 raiseClockFloor(clock, instant): boolean` |
| `src/core/index.ts:67` | `export { createSystemClock, followClock, stampOf, type Clock }` | `export { createSystemClock, followClock, raiseClockFloor, stampOf, type Clock, type FloorClock }` |
| `src/engine/rehydrate.ts` | `:52 readStored` read the durable rows; `:58 storedStateOf(rows)` | `:77 NEWEST_STORED_INSTANT` (one typed statement), `:97 readNewestStoredInstant(unit)`, `:51 StoredState.clockFloor`, `:127 storedStateOf(rows, newestStoredInstant = 0)` |
| `src/engine/host.ts` | `:661 engineClock(dependencies.clock, stored.lastCommittedAt)`; `:664` a warning | `:103` dependency `raiseClockFloor`; `:706` the floor is raised on the SERVER clock inside the start's unit; `:710` refusal `ENGINE_CLOCK_WITHOUT_FLOOR`; `:717-718` warning, logged and persisted |
| `src/engine/headless-sim.ts` | `:46 engineClock(clock, floor = 0)`: `Math.max(clock.now(), floor)` | `:41 engineClock(clock)`: `clock.now()` |
| `src/engine/index.ts` | `:112 clock: followClock(() => app.clock)` | `:126 raiseClockFloor: (instant) => raiseClockFloor(app.clock, instant)` |
| `src/engine/errors.ts:34` | — | `CLOCK_WITHOUT_FLOOR: 'ENGINE_CLOCK_WITHOUT_FLOOR'` |

**The engine's own offset logic is gone.** The engine reads `app.clock` (followed through the
seam) and nothing else: `engineClock` only adds the two time-zone members the simulator wants.

**The rule of the clock** (`clock.ts:67-108`). Two sources: the system time and a monotonic timer
(`performance.now()`; a duration is a difference of two readings).

| Situation | What `now()` returns |
|---|---|
| The system time is at or past everything the clock read (every ordinary start and run) | The system time. Identical to before this round |
| A floor above the system time was raised | The floor, then the floor plus the whole milliseconds that passed on the timer |
| The system time is later corrected FORWARD past the running clock | The system time, exactly, from that reading on. One step forward of the difference; no offset is kept, so nothing is counted twice |
| A correction that leaves the system time behind the running clock | Unchanged: the clock runs on |
| The system time is set BACK while the process runs | The clock runs on from its last reading at the real rate. Before this round it stood still until the system time caught up (ENG-14 holds either way: never backwards) |

Monotonic: every branch returns `max(last, ...)` or a value at or above `last`. Gap-free: between
two readings the clock moves by the time that passed on the timer, or to the system time when
that is ahead. Proven by 31 unit tests, among them a fixed pseudo-random walk of 5,000 steps over
passing time, set-backs, corrections and floors (never backwards, never below the system time,
time that passes is counted in full).

**Where the floor is taken from** (`rehydrate.ts:77-91`; as sent, 759 characters):

```
SELECT greatest((SELECT max(greatest("audit_log"."at")) FROM "audit_log"), (SELECT max(greatest("events"."at")) FROM "events"),
 (SELECT max(greatest("hardware_snapshot"."written_at")) FROM "hardware_snapshot"), (SELECT max(greatest("active_session"."updated_at")) FROM "active_session"),
 (SELECT max(greatest("auth_sessions"."issued_at", "auth_sessions"."last_seen_at", "auth_sessions"."ended_at")) FROM "auth_sessions"),
 (SELECT max(greatest("pairing_codes"."issued_at", "pairing_codes"."closed_at")) FROM "pairing_codes"),
 (SELECT max(greatest("paired_devices"."paired_at", "paired_devices"."last_seen_at")) FROM "paired_devices"),
 (SELECT max(greatest("biometric_tokens"."issued_at", "biometric_tokens"."used_at")) FROM "biometric_tokens"))::text AS newest
```

The list is G2's, exactly. It is one statement of the start's unit, after the chain lock, as
`dems_app`. The tables are named without their schema: the unit pins the search path (D87). The
columns are the typed ones of `src/db/schema`, so a renamed column is a compile error. Cost,
measured as `dems_app` with `EXPLAIN ANALYZE` over 7 runs: 0.02 to 0.11 ms on `tpl_seed` (82 audit
rows); 0.45 to 0.84 ms on `tpl_bulk` (5,000 audit rows, 3,649 events, 300 sessions). `audit_log.at`
and `events.at` have no index, so the cost grows with those two tables (about 0.1 ms per 1,000
rows); boot check B-8 reads every audit row at the same start.

**The eight guarantees of CPS1-1.**

| # | How it is met | Test (`src/engine/__tests__/`) |
|--:|---|---|
| G1 | `clockFloor = max(the engine's last committed instant, the statement above)`; raised before the start reads the time | `clock-floor.db.test.ts`: "each written instant of the past raises it", "a start on a used Core whose newest instant is an UNAUDITED one" |
| G2 | The eleven listed columns and the engine's two; no deadline column | Same test: ten columns raised one by one, three deadline columns (and a planted `bigint` beyond 2^53) leave it unmoved. Mutations E03a to E03h and E04 are detected |
| G3 | The clock runs on from the floor on the monotonic timer | `clock-floor.test.ts` "runs on from its floor"; db: "a 60 s lock ends 60 s later", "idle expiry counts from the real activity", "a pairing code ... lives its 300 s and no longer" |
| G4 | `engineClock(clock)` reads the server clock; the floor is the server clock's | `clock-floor.test.ts` "the engine clock (ONE time base)"; db: every row the second process wrote, native or hosted, is stamped at one instant |
| G5 | Raised inside the engine's start unit, the first unit of a boot (B-1 to B-9 run no unit), before anything is stamped; the entry point boots before it listens (`src/index.ts:106-107`). A failed read, a value that is no safe integer, or a clock that cannot take the floor stops the start | db: "G5: when the newest instant cannot be read", "G5: a stored instant that no row could be stamped with", "a clock WITHOUT a floor ... stops the start" |
| G6 | One line at `warn`: `code: ENGINE_CLOCK_BEHIND`, `behindMs`; also one entry of the persistent error log | db main test: one line, level 40, `behindMs: 120000`; the entry `{ level: 'warn', context: { mode, behindMs } }` |
| G7 | The W53 reproduction is the test, extended | db main test: `signOut` 204, `signInWithBiometric` 200, `cancelPairingCode` 204, `disableUser` 200, `revokeDevice` 200, the rotating sign-in 200; no row before its predecessor; the 60 s lock test |
| G8 | One SELECT of the runtime role in the unit's transaction | db: the statement as sent is captured; table checksums are equal before and after |

Printed by the main test: `the floor +15.00 s (issue +5.00 s, stop +15.00 s, start -105.00 s,
behind 120000 ms)`; rows 92 to 100 of the trail, written by the second process, all at +15.00 s:
`AUTH_SIGNED_OUT, AUTH_SUCCESS, PAIRING_CODE_CLOSED, USER_DISABLED, DEVICE_REVOKED, ACCESS_DENIED,
AUTH_SUCCESS, AUTH_SUCCESS, STORAGE_POLICY_CHANGED`; `rows before their predecessor: 0`.

**Red before, green after.** On a copy with the production files of before the item
(`item1_red_db.log`): 10 of 13 database tests fail; the first reads the server clock at
`1790823495000` where the floor `1790823615000` is expected. After: 13 of 13.

**What the floor guarantees.** No row is stamped before a stored one. Every instant a later
statement compares with (`issued_at`, `last_seen_at`, `ended_at`, `closed_at`, `paired_at`,
`used_at`) is at or before `now()`, so the three time CHECKs cannot fail for that reason. Locks,
throttle windows, the denial budget, sessions, pairing codes and biometric tokens end when their
time has passed in real time.

**What it does not guarantee.**

- After a start behind by Δ the server clock is AHEAD of the system time by Δ until the system
  time is corrected or the process ends. Rows are stamped Δ ahead of the wall clock. At the next
  start the skew is Δ minus the downtime. The operator learns it from the warning at each start.
- The server cannot know how long it was down when the system time is behind: idle and absolute
  expiry count from the stored instants, so the downtime is counted as the span the stored state
  shows and no more.
- A stored instant far in the future (a run with a system time years ahead, or a row changed by
  somebody who can write the database) puts the clock there. The warning names the skew; nothing
  refuses it.
- The monotonic timer of the runtime may not count the time a computer sleeps. The clock is never
  below the system time, so after a sleep it follows the system time if that is ahead.
- A clock WITHOUT a floor (a manual clock a test put behind the seam) that is behind the stored
  state is refused: the start stops with `ENGINE_CLOCK_WITHOUT_FLOOR`. No production file replaces
  a seam (decision D82; the static test of the permission guard), so the floor is never put
  behind the seam in a clock of its own.

**What others may notice.** A module: `app.clock.now()` is never below the newest stored instant;
nothing else changes on an ordinary start. The realtime channel: `serverTime` follows the same
clock. The demo module: a reload after a reset raises the floor too; after a reset it is a no-op.
A test that starts a server BEHIND the stored state must put a clock with a floor behind the seam
before the boot:

```ts
// test/acceptance/restart.test.ts:116-117 and test/support/engine.ts:200-201, for such a test only
const clock = createManualClock(at);
app.seams.replace('clock', createSystemClock(() => clock.now(), () => clock.now()));   // `createSystemClock` from src/core
```

No test of another row starts behind today (the whole `db` project on the scratch copy, 18:42).

### 26.2 Item 2: the fault list after a resync or a reload (F73; D106)

**The change.** `src/engine/rehydrate.ts:252` new `clearTamperOverlay(sim, now): boolean`;
`applyProcessStart` calls it. `src/engine/host.ts:670` before:
`mode === 'boot' ? applyProcessStart(...) : NO_EFFECTS`; after (`:730-731`):
`mode === 'boot' ? applyProcessStart(...) : { ...NO_EFFECTS, tamperCleared: clearTamperOverlay(sim, now) }`.

**Per mode.** Every mode builds a fresh simulator and puts the stored slices into it, so every
mode rebuilds the ring from the table and loses the overlay.

| Mode | Decision | Why |
|---|---|---|
| `boot` | Clears (as before) | A new process has no overlay |
| `resync` | Clears (new) | The reload after a diverged head, and what the demo module asks for after a reset that failed: the view verifies, so a list that says "tampered" would contradict it |
| `reset` (`reload()`) | Clears (new) | The same rebuild. After a real reset it finds nothing: the routine writes the scenario's faults, and no scenario of the shared simulator holds `AUDIT_TAMPER`. D74's "adds nothing" therefore still holds for every reset |

The clearing is the shared transition: the fault leaves the list, its alert is resolved, one
`FAULT_CLEARED` row without an actor is appended at the start instant, and one health snapshot of
cause `FAULT_CLEARED` is written. Another active fault (`GNSS_LOSS` in the test) stays.

**Evidence.** Red before (`item2_red_db.log`, the tree after item 1): the pending demo test fails
with `fault listed true, alert active true, view verifies true (NOT consistent)`, and the new
`resync` and `reset` cases fail; the `boot` case passes. After: all pass.

**The ONE line of the demo folder.** `src/modules/demo/__tests__/reset-failures.db.test.ts:421`:
`it.skip(` → `it(`. The file equalled its pre-image before the landing; the diff is that line.

**A pinned assertion of the demo row, not edited.** `reset-failures.db.test.ts:391`:
`expect(storedNow).toHaveLength(stored.length + 1);` (its comment, `:388-389`: "one row more (the
discontinuity row of the injection)"). After a failed reset with `AUDIT_TAMPER` active the
engine's resync now appends the `FAULT_CLEARED` row, so the length is `stored.length + 2`. The
test "RUN through a failed reset" has been red since 18:54. Smallest change: `+ 1` → `+ 2`, and
the comment to "two rows more (the discontinuity row of the injection and the FAULT_CLEARED row
of the resync)". Every other assertion of that test passes.

**What others may notice.** The realtime channel: the snapshot of the new epoch after a resync or
a reload has no `AUDIT_TAMPER` fault and a resolved alert. The demo module: `getDemoStatus` no
longer lists the fault after a failed reset; `clearFault` of a fault that is already cleared
still answers 204.

### 26.3 Item 3: one consistent cut (F71 = F-W40-1; D104)

**The change.** `src/engine/host.ts`: `flush` (`:412` before, `:445` after) always targets the
engine's whole durable state; its option `snapshot` is gone. `tickWork` before (`:592`):
`snapshot = snapshotChanged && (faultsChanged || a new clock second)`, and a tick with a record
change wrote the records alone. After (`:627`): `snapshotDue` is the same condition, used only to
decide whether a tick with NO record change writes; a tick that writes at all writes everything.
`src/engine/write-plan.ts`: `storedOnly` (`:61`) removed.

**What stays as it was.** A tick that changed nothing durable sends no statement. A change of
snapshot slices ALONE is still written by a tick at most once in a second of the server clock,
and until then a reader gets the earlier cut, whole.

**Figures, 60 s of the recording scenario** (`recording.db.test.ts`, 1,200 ticks):

| | Before | After |
|---|--:|--:|
| Ticks that wrote | 72 | 72 |
| Ticks that sent no statement | 1,128 | 1,128 |
| Statements | 429 | 434 |
| Statements per writing unit | 6.0 | 6.0 |
| Rows added | audit 12, events 1, health 1 | the same |
| `hardware_snapshot` updates | 60 to 61 | 66 (65 with records, 1 alone) |
| Committed states with a slice of an earlier instant | 6 (`storage`, ticks 52, 209, 213, 769, ...) | 0 |

Software update, 300 ticks (`ticks.db.test.ts`): before, the committed state named the new
version beside `update.state: RUNNING` at +8,850, +8,900 and +8,950 ms; after, 17 committed
states, 0 mixed, 0 with a stale slice; a change of the snapshot alone waited on 31 ticks, at most
950 ms; 15 units committed the snapshot alone.

**The realtime channel.** One `state` publication per committed unit and gap-free revisions, as
before (asserted in the update test: as many changes as committed states, revisions consecutive).
`records` is true when a class S slice changed. New: a change with `records: true` also carries
the `replace` operations of the snapshot slices that changed with the record. The change that
carries the `UPDATE_COMPLETED` row carries `update` (PASS) and `device` (asserted).

**Tests that pin the old pacing.** None of another row. The realtime tests, `first-contact`
among them, and the system row's `effects.db.test.ts` (it asserts a bound of one second and only
counts mixed ticks) pass unchanged. `test/acceptance/restart.test.ts` needed no change: no list
of `moversOf` moved for items 1 to 3.

### 26.4 Item 4: `EngineHost.meters()` (F66; D89)

**The change.** `src/engine/types.ts:230`: `meters?(): EngineMeterFrame | null`.
`src/engine/host.ts`: `:232 lastFrame`; `:285` set to the frame object BEFORE it is published
(`:257` before built the frame inline); `:315` and `:749` set to null at the end and at the start
of a start; `:894-897 meters()`.

**The contract.** The newest frame of this start, the SAME object that went to `app.publish`;
null before the first tick of a start; 503 `NOT_READY` while the host is not running; never
stored. A tick whose unit is not committed produces no frame.

**Optional in the type only.** The host always has the member. Five test doubles of five other
rows build an `EngineHost` member by member, and a required member stops their type check
(tried on a copy: five errors TS2741, and no other): `sessions/__tests__/memory-engine.ts:128`,
`demo/__tests__/support.ts:377`, `devices/__tests__/support.ts:117`,
`storage/__tests__/support.ts:188`, `system/__tests__/support.ts:290`. To make it required:
remove the `?` and add one line (`meters: () => null`) to each.

**The follow-on change for the devices module (not made here).**

```ts
// src/modules/devices/index.ts:104 and :111: pass the frame
handler: async (): Promise<DeviceHealthResponse> => deviceHealthOf(app.engine.state(), app.clock.now(), app.engine.meters?.() ?? null),
handler: async (): Promise<AudioStatusResponse> => audioStatusOf(app.engine.state(), app.clock.now(), app.engine.meters?.() ?? null),

// src/modules/devices/status.ts: hand it on (deviceHealthOf :153, :162; audioStatusOf :143-144) to audioChannelsOf (:96), and at :98
const live = frame?.audio.channels[mic.id];
const levels = live === undefined ? stateLevelsOf(mic, at) : { dbfs: live.dbfs, peak: live.peak, clip: mic.clipLatched, noSignal: live.noSignal };
```

### 26.5 Item 5: the two headers of API-7 in one place (D78 DN-8; D87)

**The change.** New `src/engine/api-headers.ts`: `registerStatePositionHeaders(app, current)`
adds two hooks to the root instance. `preHandler` (`:88`): a POST of a POST operation of the
contract registry gets a record, and the rest of the request runs inside it (an
`AsyncLocalStorage`). `onSend` (`:101`): a 2xx answer of such a request gets each header the
handler did not set, from the noted outcome of the request or else from `app.engine` as it is
then. `src/engine/host.ts:552`: a committed unit that a caller ran (a command, `run`, the mirror
of the operators; never a tick) notes its position. `src/engine/index.ts:118, :131`: the wiring.

**Which answers carry the headers.** Every answer with a status 200 to 299 to a POST of an
operation of the contract registry that reached its handler: on the server, every 2xx answer of a
POST. Not a GET. Not a POST that a request stage refused (401, 403, 429, 503), that failed its
validation (422), or that its handler refused or failed. A header a handler set stays.

**Why registry operations only.** Two tests of other rows pin "a 2xx POST of a scratch route
carries the five headers of OR-9 and nothing else":
`src/plugins/response-headers/__tests__/response-headers.test.ts:117` and
`src/plugins/origin-guard/__tests__/guard-test-app.ts:147` (through `origin-guard.test.ts:172`;
its route names itself `scratchCommand`). The server has no POST route outside the registry (the
boot check of the access rules refuses one), so the rule costs nothing there, and both tests pass
unchanged.

**Evidence.** The registry holds 48 POST and 27 GET operations. On the real app without the
domain modules, 42 POST operations have stand-in handlers that set nothing: each answers 200 with
both headers; before the item each answered without them (`item5_red_unit.log`). 23 GET stand-ins:
none. All 48 POST operations refused by stage 2: none. The six POST operations that stay real in
that app, and three of pairing and storage, are called on the real server
(`api-headers.db.test.ts`): `signIn` 200, `touchSession` 200, `issuePairingCode` 201,
`redeemPairingCode` 201, the device `signIn` 200, `setBiometricEnrollment` 200,
`signInWithBiometric` 200, `reportBiometricFailure` 200, `signOut` 204, `setStoragePolicy` 200;
each carries the engine's epoch and a revision at or past every change the request caused (RT-5).
`api-headers.outcome.db.test.ts`: a stand-in that sets nothing gets the revision of the OUTCOME
of its own command although three seconds of ticks and another sign-in committed before the
answer left, and although a tick ran inside its own work.

**What a module may do now (not done here).** Drop its own two lines:
`identity/routes.ts:78-80` (`withStateRevision`; `:92, :130, :143`),
`identity/biometric/routes.ts:79`, `pairing/routes.ts:149`, `admin/index.ts:119`,
`demo/index.ts:137, :163`, `evidence/index.ts:137`, `storage/index.ts:105`,
`alerts/index.ts:100`, `system/index.ts:105, :116, :126, :146`, `sessions/routes.ts:135`,
`security-audit/index.ts:139`. Nothing breaks while they stay. The conformance test (W52) can
assert both headers on every 2xx POST.

### 26.6 Item 6: one runner of the boot checks (D101)

**The change.** `src/core/boot-checks.ts` (104 lines → 159): two import lines (`:37`, `:39`) and
`:134 runDatabaseBootChecks(app)`; nothing else. `src/core/index.ts:66` exports it.

**What it does.** B-1 with both halves (the pool plugin's probe; the pool plugin's path question,
read by position), then B-2 to B-9 by the functions the boot steps use, B-8 reported with the
same lines as at a start. It rejects with a `BootError` that names the check (`stepId`) and holds
what it threw (`cause`). It writes NO line for a check that failed: the caller reports once (the
demo module does, `reset.ts:329-339`). It adds no boot step and does not touch the engine.

**Evidence.** Unit (a stand-in whose pool a script answers): the probe that fails, six paths that
are not the pinned one, B-2 and B-3 named by their own ID, a driver error kept as the cause,
nothing written. Database, on a running server: a good database passes and reports B-8 a second
time with one row more than the start saw, no table checksum moves, the engine's counters are
equal; after `engine.stop()` and `db.reopen()` it passes on the new pool and the engine reloads;
one audit trigger out of the mode ALWAYS gives `BootError` with `stepId: 'B-5'`; a schema-only
clone gives `B-6`.

**The follow-on change for the demo module (not made here).** `src/modules/demo/host.ts:50-96`:

```ts
export async function runBootChecks(app: FastifyInstance): Promise<void> {
  try {
    await runDatabaseBootChecks(app);                                   // from '../../core'
  } catch (error) {
    throw error instanceof BootError ? new ResumeFailure(error.stepId, error.cause) : error;   // BootError from '../../plugins/readiness'
  }
}
```

With it go the two texts at `host.ts:43-44` and the imports at `:32-35` that nothing else uses.
One assertion of the demo row changes: `reset.db.test.ts:125`, the text
`'the stored audit chain verifies after a demo reset'` becomes `'the stored audit chain
verifies'` (the source of a chain that does not verify becomes `core.bootChecks`). The stand-in
of `host.test.ts` asks the same statements in the same form and keeps working.

### 26.7 Verification

| Check | Result |
|---|---|
| Whole `unit` after each landing | 18:45 143 files / 3,709; 18:54 143 / 3,710; 19:04 145 / 3,744; 19:13 one failure of another row (below); 19:32 146 / 3,775; 19:41 147 / 3,795; 19:53 147 / 3,795, exit 0 |
| Whole `db` after items 1, 3, 5 and at the end | See the table below |
| Typecheck, lint (19:55) | Exit 0, exit 0, no warning |
| No database of the prefix `dems_test_step_48b_` (19:55, as `dems_owner`, names and counts only) | 0; project databases `dems_demo`, `dems_lane_1` to `_3` untouched |
| `.locks/postgres.pid`; postmaster start | 19121; 07:14:26, unchanged |

| Whole `db` run | Files | Passed | Failed, and whose |
|---|--:|--:|---|
| Baseline 18:06 | 108 | 1,540 (+1 skipped) | — |
| After item 1, 18:46 | 114 | 1,662 (+1 skipped) | 2 in `test/acceptance/shared-state.test.ts:533`: another row's file, created 18:46; the same two fail on the code of before item 1 (18:51) |
| After item 3, 19:06 | 115 | 1,677 | 6: `demo/reset-failures.db.test.ts:391` (26.2); `test/acceptance/pairing-lifecycle.test.ts:1288` (the realtime row was changing `src/realtime/**`; it failed without item 3 at 19:04); `identity/__tests__/concurrency.db.test.ts:159` and three files under `identity/biometric/__tests__/` (the identity row changed `sign-in.ts` and four files of `biometric/` after 19:00) |
| After item 5, 19:33 | 117 | 1,693 | 2: `demo/reset-failures.db.test.ts:391`; `plugins/permission-guard/__tests__/pipeline.db.test.ts:284` (that row changed `denial.ts`, `decision.ts`, `index.ts` after 19:28) |
| Final, 19:53 | 119 | 1,707 | 1: `demo/reset-failures.db.test.ts:391` |

The lane backends. The log of the backend on port 4423 (`.locks/core-server.lane3.log`, read for
its message texts only) shows a process start from the tree at 18:52:51, after item 1 had landed:
eleven boot steps passed, `engine started`, no `ENGINE_CLOCK_BEHIND`, no line at the level error;
it ends with `shutdown requested` and `shutdown complete` at 18:53:24. At 20:02 nothing listened
on 4421 or 4423 and both pid files were empty (since 19:28 and 18:53). This row stopped no
process; who stopped them was not verified.

Other red moments that were not this row's: typecheck 18:46
(`test/acceptance/shared-state.support.ts(409,41)`), typecheck 18:57
(`src/realtime/admission.ts(154,31)`), unit 19:13
(`identity/biometric/__tests__/static.test.ts`, rule 8). Each was green at the next run.

### 26.8 Mutation check

58 mutations of the code this round changed, each applied to a copy outside the repository
(`mutate_b2a.py`; no file of the tree was mutated), with the engine's unit tests first and the
named database tests when those pass.

| Group | Mutations | Detected |
|---|--:|--:|
| The clock (`clock.ts`) | 11 | 11, all by unit tests |
| The floor in the engine | 17 | 17 (1 unit, 16 database) |
| The tamper overlay | 4 | 4 (2 unit, 2 database) |
| One cut | 4 | 3 on the first pass, 4 after one assertion was added |
| `meters()` | 4 | 4 |
| The headers | 12 | 12 |
| The runner | 6 | 6 |

The survivor: "a change of the snapshot alone is written at every tick". In the recording minute
the hardware moves at the simulator's 1 Hz step only, so the kept pacing never applied there. The
software-update test now asserts it (a change of the snapshot alone waits, less than a second; no
second has two such writes). Two gaps were seen while the list was written and closed before the
run: a source without a timer must get no time of the runtime, and a tick that runs inside a
request's own work must not become that request's outcome.

### 26.9 Tests of this row changed by design

| File | What changed | Why |
|---|---|---|
| `rehydrate.test.ts` | `freshSim` builds the server's own clock on the manual one; the engine-clock test asserts no `floor` member | Item 1 |
| `restart.db.test.ts` | The "clock behind" test puts a clock with a floor behind the seam | Item 1 |
| `write-plan.test.ts` | The `storedOnly` test is replaced by the one-cut test; the meter-frame test no longer needs `storedOnly` | Item 3 |
| `recording.db.test.ts` | "the hardware snapshot is written at most once in a second" is replaced by two tests: no stale slice in any committed state; a change of the snapshot alone waits | Item 3 |
| `static.test.ts` | 15 production files (was 14): `api-headers.ts` | Item 5 |

Tests of other rows: the one un-skip line (26.2). Nothing else.

### 26.10 Findings

| ID | Finding | For |
|---|---|---|
| F-B2a-1 | The first design of item 1 put a wrapping clock behind the seam for a clock without a floor. The static test "no production file replaces a stage or a seam" (D82) refused it on the scratch copy. The design became a refusal | Recorded |
| F-B2a-2 | After a start behind by Δ the server clock stays Δ ahead of the system time until that is corrected. It is the price of G1 and G3 together | DN-B2a-3 |
| F-B2a-3 | `reset-failures.db.test.ts:391` pins the row count of the old outcome | DN-B2a-1 |
| F-B2a-4 | Five engine doubles of five rows are typed member by member; a new required member of `EngineHost` stops their type check | DN-B2a-2 |
| F-B2a-5 | Two tests pin the header set of a 2xx POST on scratch routes; one of the routes names an operation that is not in the registry | Recorded (26.5) |
| F-B2a-6 | In a recording the snapshot slices move at the 1 Hz step only; the once-a-second rule matters for the software update, the diagnostics and an idle Core | Recorded (26.8) |
| F-B2a-7 | A hosted action that reports a refusal in its result (`EXPORT_DENIED`) commits a row and answers 403: no header, by API-7. The client gets the row through the `state` topic | For W83 |
| F-B2a-8 | The system time set back while the process runs is now followed by the timer; the specification's ENG-14 says only "never backwards" | For W83 |
| F-B2a-9 | The floor statement scans `audit_log` and `events` (no index on `at`): 0.46 ms per 5,000 audit rows | DN-B2a-5 |

### 26.11 Deviations

| ID | Deviation | Reason |
|---|---|---|
| DV-B2a-1 | Until 18:44 several read-only commands and test runs of this round began with `cd` to the workspace root or to `apps/core-server` (the rule says never) | An error of this row. No file was written by such a command outside the scratch folder; none since |
| DV-B2a-2 | `meters` is optional in the type | F-B2a-4 |
| DV-B2a-3 | The header hook covers the registry's POST operations, not every POST route | F-B2a-5 |
| DV-B2a-4 | The tests of the two core functions (`clock-floor.*`, `boot-checks-runner.*`) are in `src/engine/__tests__/` | The folders this round may write |
| DV-B2a-5 | A manual clock without a floor that is behind the stored state is refused instead of held | F-B2a-1 |
| DV-B2a-6 | Item 1 was built twice: first as a clamp (the brief), then as a clock that runs on (the controller's addition, G3). Only the second landed | The addition |

### 26.12 Decisions for the controller

| ID | Decision | Recommendation |
|---|---|---|
| DN-B2a-1 | `demo/__tests__/reset-failures.db.test.ts:391`: `+ 1` → `+ 2` | Authorise it (one line and its comment). It is the only red test of the `db` project |
| DN-B2a-2 | `EngineHost.meters`: optional, or required with one line in five doubles | Required, in the round in which the devices module adopts it |
| DN-B2a-3 | A start behind the stored state: run ahead with a warning (built), or refuse beyond a threshold (the review's fallback) | Keep what is built for the demo; a threshold (for example 24 h) would catch a stored instant that is absurd |
| DN-B2a-4 | The devices module adopts `meters()` (26.4); the demo module adopts `runDatabaseBootChecks` (26.6); the modules drop their header lines (26.5) | Three small follow-on rows; none blocks |
| DN-B2a-5 | The floor statement: full scan (built), or the newest row by sequence | Keep: B-8 reads every row at the same start |
| DN-B2a-6 | A test that starts behind needs a clock with a floor (26.1) | Tell the acceptance row before its W53 reproduction joins the suite |

### 26.13 Rollback (not executed)

Pre-images of 18:09:13 are under `.cache/rollback/CPB2a/` (34 files: `engine/`, `core/clock.ts`,
`core/boot-checks.ts`, `core/index.ts`, `demo/reset-failures.db.test.ts`,
`acceptance/restart.test.ts`). The new files of this round to remove with a rollback:
`src/engine/api-headers.ts` and, under `src/engine/__tests__/`, `clock-floor.test.ts`,
`clock-floor.db.test.ts`, `api-headers.test.ts`, `api-headers.db.test.ts`,
`api-headers.outcome.db.test.ts`, `boot-checks-runner.test.ts`, `boot-checks-runner.db.test.ts`.
At 19:57 `core/index.ts` differed from its pre-image in lines 66 and 67 only.

## 27. Follow-up: the granted line, `meters` required, F78 (decisions D119, D122)

Three items, one landing each, on 2026-10-04 between 20:32 and 20:52 WIB. Each was developed and
proven on the scratch copy outside the source tree and landed in one step; the type check of the
tree ran right after each landing and exited 0. No command began with `cd`. No credential, token,
pairing code or device credential appears in this section.

### 27.0 Result

| # | Item | Outcome | Landed |
|--:|---|---|---|
| 1 | The granted by-design line of the demo test (DN-B2a-1) | Done. The test asserts the count and what the two rows are | 20:32:10 |
| 2 | `EngineHost.meters` required (DN-B2a-2) | Done. One line in each of the five doubles | 20:33:32 |
| 3 | F78: the tablet link in the first state of an epoch (D119) | Done in the engine alone, in every start mode; no change of `src/realtime/**` is needed. ONE comparison of the demo row pins the old state after a reset and is red (27.3) | 20:52:16 |

Final state (20:53 to 20:56): whole `unit` 148 files, 3,814 tests, exit 0. Whole `db` 121 files:
118 passed, 3 failed. One is this row's by design (`src/modules/demo/__tests__/reset.db.test.ts`,
27.3). Two are the database helper's, written while the run was under way; alone they pass
(27.4). Typecheck exit 0; lint exit 0 without a warning.

### 27.1 Item 1: the granted line

`apps/core-server/src/modules/demo/__tests__/reset-failures.db.test.ts`, the whole difference to
the file as it was (pre-image `.cache/rollback/CPB2a_followup/demo/`):

```
388c388,389
<     // are there text for text, one row more (the discontinuity row of the injection), and it verifies.
---
>     // are there text for text, two rows more (the discontinuity row of the injection and the
>     // `FAULT_CLEARED` row of the resync), and it verifies.
391c392,399
<     expect(storedNow).toHaveLength(stored.length + 1);
---
>     expect(storedNow).toHaveLength(stored.length + 2);
>     // What the two rows are: neither has an actor, and the second clears the fault of the overlay.
>     const added = (await trailOf(owner())).slice(stored.length);
>     expect(added.map((row) => [row.type, row.actorId])).toEqual([
>       ['AUDIT_CHAIN_DISCONTINUITY', null],
>       ['FAULT_CLEARED', null],
>     ]);
>     expect(added[1]?.details).toMatchObject({ kind: 'AUDIT_TAMPER' });
```

`trailOf` was already imported by the file. The demo folder's database tests after the landing
(20:32): 4 files, 43 tests, exit 0.

### 27.2 Item 2: `meters` required

`src/engine/types.ts:230` before: `meters?(): EngineMeterFrame | null;` with the paragraph
"OPTIONAL IN THE TYPE ONLY". After (`:234`): `meters(): EngineMeterFrame | null;`. A caller writes
`app.engine.meters()`.

The granted line, one per file, each inserted before the double's `stats` member (before: the
line was not there):

| File (under `apps/core-server/src/modules/`) | Line added | After |
|---|--:|---|
| `sessions/__tests__/memory-engine.ts` | 161 | `    meters: () => null,` |
| `demo/__tests__/support.ts` | 431 | `      meters: () => null,` |
| `devices/__tests__/support.ts` | 154 | `      meters: () => null,` |
| `storage/__tests__/support.ts` | 239 | `      meters: () => null,` |
| `system/__tests__/support.ts` | 327 | `      meters: () => null,` |

The landing copied the five doubles first and `types.ts` after them, so the tree passed its type
check at every moment. This row's own callers dropped `?.` (`plugin.test.ts`, `ticks.db.test.ts`).
No caller in another module was edited. After the landing (20:33): typecheck exit 0; whole `unit`
147 files, 3,795 tests, exit 0.

For the devices module (round B2b): the change of section 26.4 without the fallback,
`app.engine.meters()` in place of `app.engine.meters?.() ?? null`. Its double answers null, which
is "no frame yet": the module's fallback to `stateLevelsOf` keeps its present tests true.

### 27.3 Item 3: the tablet link in the first state of an epoch (F78; D119)

**The finding.** After a demo reset with no paired-device socket, the snapshot of the new epoch
said the Core link was CONNECTED (the dataset's value); one pace step later the realtime channel
set it OFFLINE through the hosted action, and a delta appended `TABLET_LINK_CHANGED` and
`TABLET_DISCONNECTED`: rows of a disconnection that never happened.

**What the specification says** (`masterplan/01_specs.md`):

| Where | Sentence |
|---|---|
| §6.8, line 708 | "The engine's `tabletLink` slice is CONNECTED while at least one PAIRED device has an open authenticated socket, and OFFLINE otherwise. The server drives it through the hosted `setTabletLink` action, which writes `TABLET_LINK_CHANGED` and the event `TABLET_CONNECTED` or `TABLET_DISCONNECTED`" |
| §8.6, line 1154 | "The tablet link: OFFLINE until a paired device connects. If the stored value was CONNECTED, `setTabletLink(OFFLINE)` writes the truthful `TABLET_LINK_CHANGED` row" |
| §12.4, line 1413 | "Tablet link \| Recomputed from the open sockets" |
| §12.4, line 1404 | "**New chain**: the seed history as of the server clock, then one `SCENARIO_LOADED` row" |

And the shared code at its own scenario load, `packages/shared/src/sim/scenarios.ts:209`:
`tabletLink: current.tabletLink,`. The simulator keeps the link it had and writes no row for it.

**The decision: the truthful first state after a reset needs NO row.** The link is a fact of the
open sockets (§6.8), not of the rows a start reads. A row belongs to a change of the link: a
device connects or disconnects, and the server drives that through the hosted action. A reset
closes no socket. Where the rebuilt database says CONNECTED and no device holds a socket, the
stored value is the dataset's and never was this Core's link; §12.4 gives the state after a reset
as recomputed from the sockets and the new chain as the seed history and ONE row. So the link is
put in place as part of the state the reload builds, and nothing is appended. A process start is
the other case, and stays as §8.6 says: the stored CONNECTED was this Core's own, the device's
link did end when the process stopped, and the row is truthful.

**How the engine knows what the sockets say, without a change of the channel.** The realtime
channel owns the sockets and drives the link at every pace step, so the `tabletLink` slice the
engine has committed IS the channel's last word. A stop and a start of the engine close no
socket. The host therefore keeps the slice it had committed when it ended a run, for as long as
the process lives, and begins the next start with it.

| Start | Process ran before? | The link in the first state of the epoch | Rows |
|---|---|---|---|
| `boot` | no (a process start: no socket can be open) | OFFLINE | `TABLET_LINK_CHANGED` and its event when the stored value was CONNECTED (§8.6); unchanged |
| `boot` | yes (tests only) | the one the engine held | none |
| `reset` (the reload after a demo reset or a scenario load) | yes | the one the engine held, whole, with the instant it changed at; the tablet's entry among the other devices derived from it by the shared `deriveDeviceState` | none; the reload writes the `hardware_snapshot` row and nothing else |
| `resync` | yes | the one the engine held, which is the stored one: nothing to do | none |
| `reset`, `resync` | no (the first start of a process) | the stored one, as before | none |

**The change.**

| File | Before | After |
|---|---|---|
| `src/engine/rehydrate.ts` | `:273 applyProcessStart(sim, lastCommittedAt, now)`; `:290-291` the stored CONNECTED is always set OFFLINE | `:242 TabletLink`; `:268 carryTabletLink(sim, held): boolean`; `:315 applyProcessStart(sim, lastCommittedAt, now, heldLink = null)`; `:332-333` with a held link it is carried, without one `:335-336` as before; `:238 RestartEffects.tabletLinkCarried` |
| `src/engine/host.ts` | `:730-731 mode === 'boot' ? applyProcessStart(...) : { ...NO_EFFECTS, tamperCleared }` | `:246 heldLink`; `:329` set in `endLive()` from the committed state; `:750-751` handed to `applyProcessStart`, and `carryTabletLink` in the other modes; `:782` the start's log line says `tabletLinkCarried` |
| `src/engine/types.ts` | The start modes | A paragraph on the tablet link per mode |

Nothing of `src/realtime/**` was edited, and nothing there needs to change: after the start the
channel's pace step compares what it wants with what the engine holds, finds them equal and calls
nothing.

**What the engine cannot know.** A socket that opened or closed WHILE the engine was stopped (the
seconds of a reset). The first state then holds the link of before; the channel's next pace step
drives it through the hosted action, with the rows of a change that did happen. If that window
is to be closed too, the channel must tell the engine what it wants at the start itself: a
decision for the controller (DN-F-2), not needed for F78.

**Evidence.** The acceptance test `test/acceptance/shared-state.test.ts`, its demo-reset test, as
printed (not edited; 6 tests pass before and after):

```
before (20:40, the tree without item 3)
[w49] demo reset: the Core link: CONNECTED in the snapshot of the new epoch, OFFLINE at 2/1 (recomputed from the open sockets at the channel's pace step)
[w49] demo reset: the reset was answered 200 after 478 ms; epoch 1 → 2; ... A's socket since: snapshot 2/0; delta 2/1 (replace meta, append events [TABLET_DISCONNECTED], append audit [TABLET_LINK_CHANGED], replace tabletLink, replace otherDevices)

after (20:53, the tree)
[w49] demo reset: the Core link: OFFLINE in the snapshot of the new epoch, OFFLINE at 2/0 (recomputed from the open sockets at the channel's pace step)
[w49] demo reset: the reset was answered 200 after 773 ms; epoch 1 → 2; ... A's socket since: snapshot 2/0
```

No assertion of that file pins the old sequence. Two texts of it describe the old mechanism and
are no longer exact: the comment at `:706-707` ("the comparison above ran the channel's pace
step") and the words printed at `:711` ("recomputed from the open sockets at the channel's pace
step"). Smallest change: "at the reload", in both. Not edited.

This row's tests (`src/engine/__tests__/restart.db.test.ts`, a new group of 8; and 2 in
`rehydrate.test.ts`). "A device socket is present" is what the channel does when one opens: the
hosted `setTabletLink('CONNECTED')` before the stop.

| Test | What it shows |
|---|---|
| A process start | The stored CONNECTED becomes OFFLINE in the start's own unit, with the row; a NEW process on a database whose link was CONNECTED starts OFFLINE with the row: it holds no link of an earlier process |
| `boot`, `resync` × socket present, absent (4) | The first state of the epoch holds the link the engine held; the stored trail and the events are unchanged; the next pace step sets nothing |
| The real reset routine and the reload, socket absent | The rebuilt database says CONNECTED since the reset instant; the first state says OFFLINE since the boot; the chain ends with `SCENARIO_LOADED`; the reload's only write is `update "hardware_snapshot"`; only `tabletLink` and `otherDevices` differ from what the routine built; a device that connects afterwards gets its one truthful row |
| The same, socket present | The first state says CONNECTED since the instant the device connected, not since the reset |
| Both, continued | A second stop and start begin with the link of the LAST stop |
| The first start of a process in `reset` or `resync` | The stored link stays; nothing is written |

Red before (the engine files of before the item, `f3_red_db.log`): the reset test without a
socket fails with the first state `{ state: 'CONNECTED', changedAt: <reset instant> }` where
`{ state: 'OFFLINE', changedAt: <boot instant> }` is expected; the reset test with a socket and
the `boot` test with a socket fail on the link; the other five fail only on the new member of
the log line.

**A pinned comparison of the demo row, not edited.**
`src/modules/demo/__tests__/reset.db.test.ts:357-361` compares the digest of the whole
`hardware_snapshot` row after a reset with a fresh seed ("Everything else equals a seed of an
empty database for the same instant and epoch"). Its server has no device socket, so after this
item the row's `tablet_link` and `other_devices` are not the dataset's. The first test of the
file fails there (`hardware_snapshot: expected '1 row(s) 3ee3…' to be '1 row(s) 4ffd…'`), and
four later tests of the file fail because they use what the first one left (`afterFirst`, the
head sequence 84). Smallest change, at `:357-358`:

```ts
    // The tablet link is recomputed from the open sockets (spec §12.4; finding F78): no paired device holds one here,
    // so the link and the tablet's entry are not the dataset's.
    const exceptLink = { without: { hardware_snapshot: ['tablet_link', 'other_devices'] } };
    const built = await digestAll(owner(), exceptLink);
    const seeded = await digestAll(reference.ownerPool(), exceptLink);
    expect(server.engine.slice('tabletLink').state).toBe('OFFLINE');
```

Proven on a copy outside the tree at 20:48: with those lines the demo folder's database tests
are 4 files, 43 tests, exit 0. The specification names both in the same table: the hardware
snapshot is "Rebuilt from the seed" (line 1405), the tablet link is "Recomputed from the open
sockets" (line 1413).

**What others may notice.** The realtime channel: the snapshot of a new epoch after a reset
already holds the true link; no delta with the two rows follows. A client: no moment in which the
console shows a link that is not there. The demo module: after a reset the stored
`hardware_snapshot` differs from the dataset in the link and the tablet's entry whenever the
sockets say something else. The log: `engine started` has the member `tabletLinkCarried`.

### 27.4 Verification

| Check | Result |
|---|---|
| The engine folder, `unit` (20:52) | 13 files, 201 tests, exit 0 |
| The engine folder, `db` (20:52) | 8 files, 90 tests, exit 0 |
| The demo folder, `db` | 20:32, after item 1: 4 files, 43 tests, exit 0. 20:53, after item 3: `reset.db.test.ts` red, 5 tests, the pinned comparison of 27.3; the other 3 files pass (38 tests) |
| `test/acceptance/shared-state.test.ts`, `test/acceptance/restart.test.ts` (20:53) | 2 files, 22 tests, exit 0. No list of `moversOf` changed: a process start writes what it wrote |
| Whole `unit` (20:53) | 148 files, 3,814 tests, exit 0 |
| Whole `db` (20:54 to 20:55) | 121 files, 1,717 passed, 10 failed in 3 files (below) |
| Typecheck after each landing (20:32, 20:33, 20:52); lint (20:52) | Exit 0 each; no warning |
| Databases of the prefix `dems_test_step_48c_` (20:56, as `dems_owner`, names and counts only) | 0; `dems_demo` and `dems_lane_1` to `_3` untouched |
| Listeners of this row; `.locks/postgres.pid` | None (the one listener on the project's ports is PostgreSQL); 19121 |

| Red file of the whole `db` run | Tests | Whose | Alone |
|---|--:|---|---|
| `src/modules/demo/__tests__/reset.db.test.ts` | 5 | This row's landing, by design; the file is the demo row's (27.3, DN-F-1) | Red, the same five (20:53) |
| `test/helpers/db/__tests__/limits.db.test.ts` | 4 and the file | The database helper's owner: the file and `test/helpers/db/index.ts` were written at 20:55, during the run (`TypeError: isNoLimit is not a function`) | Passes (20:56) |
| `test/helpers/db/__tests__/limits-own.db.test.ts` | 1 | The same | Passes (20:56): the two files, 11 tests, exit 0 |

### 27.5 Mutation check

Ten mutations of the code of item 3, on a copy outside the repository (`mutate_b2a.py`, group L;
no file of the tree was mutated): the held link not remembered; only the state carried; the
tablet's entry not derived; the link carried through the hosted action; `boot` never carrying;
OFFLINE written when nothing is held; the instant ignored; `reset` and `resync` not carrying; the
held link taken once and never again; a process start leaving the stored CONNECTED. Nine were
detected on the first pass (five by unit tests, four by database tests). The survivor, "the held
link is the one of the first stop", led to the continued part of the two reset tests (a second
stop and start after the link changed); it is detected now.

### 27.6 Findings, deviations, decisions

| ID | Finding | For |
|---|---|---|
| F-F-1 | `demo/__tests__/reset.db.test.ts:357-361` pins the whole `hardware_snapshot` row of the dataset after a reset; the specification's own table takes the tablet link out of it | DN-F-1 |
| F-F-2 | Two texts of `test/acceptance/shared-state.test.ts` (`:706-707`, `:711`) say "at the channel's pace step"; the link is now in the snapshot itself | DN-F-3 |
| F-F-3 | A start in the mode `boot` inside a process that already ran (tests only) no longer writes a stored CONNECTED to OFFLINE: the sockets of the process are what they were. No test of another row relied on it (whole `db` on the scratch copy, 20:44 to 20:47) | Recorded |
| F-F-4 | The whole `db` run of 20:54 met two files of the database helper while their owner was writing them | Recorded (27.4) |
| F-F-5 | One regular expression of this row's log test still named the old text of the clock warning; corrected with item 3 (`commands.db.test.ts`) | Recorded |

| ID | Deviation | Reason |
|---|---|---|
| DV-F-1 | The whole `db` project is not exit 0 | F-F-1: the fix that D119 asks for and the pinned comparison cannot both hold; the file is not this row's to edit |
| DV-F-2 | Item 1 adds seven lines, not two | The controller asked for the assertion of what the second row is |

| ID | Decision | Recommendation |
|---|---|---|
| DN-F-1 | `src/modules/demo/__tests__/reset.db.test.ts:357-358`: compare `hardware_snapshot` without `tablet_link` and `other_devices`, and assert the link (the six lines of 27.3) | Grant it, to this row or to the demo row's owner. It is the only red file of the `db` project that is not in flight |
| DN-F-2 | A socket that changes while the engine is stopped is applied one pace step after the start, with truthful rows. To close that window the channel would hand the engine what it wants at the start | Accept the window: it is seconds long, and what follows is true. If not, it is a change of `src/realtime/**` and a new entry of the host |
| DN-F-3 | The two texts of `shared-state.test.ts` | Tell the acceptance row; wording only |

### 27.7 Rollback (not executed)

Pre-images of 20:31:30 are under `.cache/rollback/CPB2a_followup/` (43 files: `engine/` with its
tests, `demo/reset-failures.db.test.ts`, the five doubles under `doubles/`). Item 3 alone:
restore `engine/host.ts`, `engine/rehydrate.ts` and the three test files of it from there, and
keep `engine/types.ts` as it is now (it also holds item 2).

---
*Generated: 2026-10-04 12:30 WIB*
*Last Updated: 2026-10-04 21:00 WIB (section 27, the follow-up of fix round B2a)*
