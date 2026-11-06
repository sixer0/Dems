---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 43
plan_row: W21
title: Core services (audit writer, event writer, transaction helper with the serial unit-of-work queue, server clock)
date: 2026-10-04
agent: coder-execution (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
source_contract: masterplan/03_database_contract.md rev 2.2 (contract revision dbc-2)
evidence_tier: 3
status: complete
---

# W21: core services

All times are WIB (UTC+7) on 2026-10-04. Every command ran from `/Users/gsp-budi/Documents/DEMS`;
no command changed into a subfolder. Database commands ran with the per-command sandbox bypass
(P10): inside the sandbox a connection to `127.0.0.1:4432` fails with `POSTGRES_UNREACHABLE`, which
was observed once at 09:59 and is not "server down". Quoted runner output is unchanged except that
Vitest's pass mark is written `[pass]`. **No password or other credential value appears in this
document.** The strings of the form `ses_AAAA...` in the tests are made-up examples of a FORM;
they are not credentials.

## 1. Result

| Item | Result |
|---|---|
| Row command `DEMS_TEST_STEP=43 npm run test:db -w @dems/core-server -- src/core` | **Exit 0**: 4 files, 39 tests, 0 failed (11:00:06, section 11.1) |
| 50 concurrent appends | Two proofs. One pipeline, 50 units at once: `seq 1..50`, in the order of submission. Ten pipelines on ten separate connections, 50 units at once: 50 commits, 0 errors, 10 in flight at once, up to 9 waiting on the head row. The shared `verifyAuditChain` accepts ALL rows each time (`ok: true`, `checked` = row count) |
| A writer that skips the lock | Refused with SQLSTATE **`ZA001`**: a raw insert with a sequence of its own, one with a wrong previous hash, and one that read the head without the lock while a unit held it (it waited, then `ZA001`) |
| Every `at` follows the injected clock | Yes: a row carries the clock value of its call, a batch shares one, no stored row of the file carries a wall-clock time; an entry that tries to set a time is refused before a statement is sent |
| A failing unit | Leaves no row, does not advance the head, consumes no event number, and rejects with the very error that was thrown |
| Rows of one unit | Contiguous: four rows from three calls with pauses, while four other connections appended 12 rows around them |
| The queue | Order, bounded length, watchdog, no nesting, shutdown: proven database-free (39 tests) and against PostgreSQL |
| Boot checks | Registered: B-2 to B-9 after B-1, in the order of the contract, B-8 reported only. A database that violates one keeps the app not ready, and the log names the check and what to do. Proven on clones broken as `dems_owner` (no stubbed check was needed) and on a clone of the SEED template |
| The log | Codes, numbers, a unit's label and an audit type. Never a message, a detail, an actor or a reference of a row (log capture at level `trace`) |
| Whole `unit` project | **Exit 0**: 41 files, 1,281 tests (11:02:41) |
| Whole `db` project | **Exit 0**: 27 files, 382 tests (11:00:10) |
| Typecheck, lint of the workspace | Exit 0, exit 0 |
| One mapping (controller note, MR-1) | Applied: the writers and B-8 use the row builders and the digest check of `src/db/mapping`; this row's own copies are deleted (section 9) |
| Tests of other rows | Three files touched, each a recorded by-design change: section 13 |
| PostgreSQL | Never stopped or reconfigured: `.locks/postgres.pid` is 19121 and the postmaster start time is 07:14:26, as before. No database of this row remains |
| Mutation check | 41 of 41 planted defects detected by the database-free tests (section 11.6) |

## 2. What was written

All under `apps/core-server/src/core/`, the row's one owned path. 12 production files (2,422 lines)
and 9 test files (3,298 lines).

| File | Lines | Content |
|---|--:|---|
| `index.ts` | 136 | The unit: fills the seams `clock`, `pipeline`, `auditWriter`; registers the boot checks; closes the pipeline in `onClose`; re-exports the types. Replaces the scaffold's stub and keeps its exports |
| `types.ts` | 217 | Types only: `UnitOfWork`, `UnitContext`, `AuditEntry`, `UnitAuditWriter`, `AuditWriter`, `EventEntry`, `UnitEventWriter`, `Pipeline`, `CommittedUnit`, `PipelineSnapshot`, `ChainHead`, `UnitDatabase` |
| `limits.ts` | 55 | The constants this row chose (section 6) |
| `clock.ts` | 54 | `Clock`, `createSystemClock`, `followClock`, `stampOf`. The only file under `src/core/` that reads the system time |
| `errors.ts` | 148 | `PipelineFailure` (503 `NOT_READY` with a `reason`), `CoreError` (a broken rule, with a `code`), `sqlStateOf`, `driverErrorOf` |
| `pipeline.ts` | 436 | The serial unit-of-work queue |
| `unit-of-work.ts` | 411 | The transaction helper: one unit, one transaction on one connection; what a unit refuses |
| `audit-writer.ts` | 334 | The audit writer on the append protocol; the rules of an entry and of a row |
| `event-writer.ts` | 232 | The event writer |
| `payload-rules.ts` | 162 | The rules both writers apply to a payload map and to every text of a row |
| `audit-details.ts` | 133 | The allow-list of details for the nine server-written audit types |
| `boot-checks.ts` | 104 | Registration of B-2 to B-9 |
| `__tests__/support.ts` | 357 | Test support (not a test file): an app on a clone, readers of the stored trail, a stand-in pool for database-free tests. Other rows may import it |
| `__tests__/pipeline.test.ts` | 784 | `unit`, 39 tests |
| `__tests__/writers.test.ts` | 451 | `unit`, 51 tests |
| `__tests__/core-plugin.test.ts` | 324 | `unit`, 14 tests |
| `__tests__/static.test.ts` | 129 | `unit`, 9 tests: static guards of this folder |
| `__tests__/audit-chain.db.test.ts` | 391 | `db`, 12 tests |
| `__tests__/unit-of-work.db.test.ts` | 565 | `db`, 19 tests |
| `__tests__/boot-checks.db.test.ts` | 213 | `db`, 6 tests |
| `__tests__/seeded.db.test.ts` | 84 | `db`, 2 tests, on a clone of the seed template |

Outside the owned path, by the brief and by the controller's note of 10:50: three test files of other
rows, a few lines each (section 13). Pre-images of every file this row changed that existed
before it are in the git-ignored `.cache/rollback/` (section 20).

## 3. The seams, with their final types

`app.ts` is untouched (P25). The three seams of `core` are provided with `app.seams.provide`.

```ts
// app.clock
interface Clock { now(): number }                       // epoch milliseconds, never backwards

// app.pipeline
interface Pipeline {
  run<T>(label: string, work: (unit: UnitContext) => Promise<T> | T): Promise<T>;
  drain(): Promise<void>;
  onCommit(listener: (unit: CommittedUnit) => void): () => void;
  snapshot(): PipelineSnapshot;
  close(): Promise<void>;
}

// what `work` receives
interface UnitOfWork { readonly label: string }          // the bare handle (the scaffold's type, unchanged)
interface UnitContext extends UnitOfWork {
  readonly id: number;                                   // 1, 2, 3, ... in the order the units ran
  readonly db: UnitDatabase;                             // the typed query builder on the unit's transaction
  query<Row>(text: string, values?: readonly unknown[]): Promise<QueryResult<Row>>;
  readonly audit: UnitAuditWriter;
  readonly events: UnitEventWriter;
  afterCommit(task: () => void): void;
}

interface UnitAuditWriter {
  append(entry: AuditEntry): Promise<AuditRow>;          // the stored row: seq, hash, at, category, ...
  appendMany(entries: readonly AuditEntry[]): Promise<AuditRow[]>;
  appendPrepared(rows: readonly AuditRow[]): Promise<void>;   // the engine's rows (AP-6)
  head(): Promise<ChainHead>;
  appended(): readonly AuditRow[];
}
interface AuditEntry {
  readonly type: AuditType;                              // one of the 53
  readonly message: string;
  readonly severity?: Severity;                          // default INFO
  readonly actorId: string | null;                       // required: null says "the system"
  readonly deviceId: string | null;                      // required: null says "no device"
  readonly sessionId?: string | null;
  readonly evidenceId?: string | null;
  readonly details: Details;
}

interface UnitEventWriter {
  append(entry: EventEntry): Promise<SimEvent>;
  appendMany(entries: readonly EventEntry[]): Promise<SimEvent[]>;
  appendPrepared(events: readonly SimEvent[]): Promise<void>;
  appended(): readonly SimEvent[];
}

// app.auditWriter: the scaffold's signature, kept
interface AuditWriter { append(unit: UnitOfWork, entry: AuditEntry): Promise<void> }

interface CommittedUnit { id; label; auditRows: readonly AuditRow[]; events: readonly SimEvent[]; head: ChainHead }
interface PipelineSnapshot { accepting; running: { id, label } | null; pending; completed; failed; timedOut; refused }
```

Also exported from `src/core`: `unitContextOf(unit)` (the tools of a unit for a function that was
handed the bare handle), `PipelineFailure`, `PipelineRefusal`, `CoreError`, `CoreErrorCode`,
`sqlStateOf`, `driverErrorOf`, `createPipeline` (tests build further pipelines with it),
`looksLikeSecret`, `SERVER_AUDIT_DETAIL_RULES`, and the constants of `limits.ts`.

Two points about the types:

- **`UnitOfWork` stays the bare handle** `{ label }`. A test of the scaffold passes such an object to
  another row's seam, and that line is not this row's to change. The tools live on `UnitContext`.
  The core keeps a private map from every handle it issued to its state: an object the pipeline did
  not issue is refused with `UNIT_NOT_ACTIVE`, and a handle whose unit ended with `UNIT_ENDED`.
- **`app.auditWriter.append` returns nothing by its type.** A test of the request-guards row
  replaces this seam with a stand-in that returns nothing (`throttle.test.ts:428`), so a return type
  with a row would not compile there. The row itself, with its sequence and hash, is returned by
  `unit.audit.append(entry)`, which the seam calls (deviation DV-1, decision DN-2).

## 4. How it is used

### 4.1 A server-native handler: check, change rows, audit, event, commit, answer

```ts
const outcome = await app.pipeline.run('pairing.revokeDevice', async (unit) => {
  // check and change in ONE statement whose row count decides (AT-3)
  const changed = await unit.query(
    'UPDATE public.paired_devices SET state = $2, revoked_at = $3 WHERE id = $1 AND state = $4 RETURNING id',
    [deviceId, 'REVOKED', app.clock.now(), 'PAIRED'],
  );
  if (changed.rowCount === 0) throw new ApiFailure(409, 'DEVICE_NOT_PAIRED', '...');   // ROLLBACK; nothing is stored
  const row = await unit.audit.append({
    type: 'DEVICE_REVOKED', actorId: principal.operatorId, deviceId,
    message: 'Device revoked.', details: { reason, sessionsEnded },
  });
  await unit.events.append({ type: 'UNPAIRED', message: 'Device revoked.', deviceId });
  unit.afterCommit(() => app.publish({ ... }));          // after the COMMIT, before the next unit
  return { seq: row.seq };
});
return reply.code(204).send();                           // the commit has happened
```

Rules for a module:

| Rule | Why |
|---|---|
| The label is a name chosen in the code (`identity.signIn`), at most 64 characters | It goes into log lines. Anything else is refused with `UNIT_LABEL_INVALID` |
| A refusal that is audited takes its place in the denial budget FIRST, outside the unit: `await app.denialBudget.consume(request)`, then the unit, then the throw | `23_request_guards.md` §6.2. The writer does not consult the budget |
| A unit never submits a unit | It would wait for itself. `run` refuses at once with `PIPELINE_REENTRANT`. A function that takes part in somebody else's unit takes the unit as an argument |
| Publications go into `unit.afterCommit(...)` | They then leave in commit order, and never for a unit that rolled back |
| Reads that change nothing do not need the pipeline | They use `app.db.pool` |
| Sign-in is two units with the hash computation between them (ENG-26) | Two `run` calls; the pipeline is free in between |
| Never log `error.message` of something `unit.db` threw | The query builder's wrapper quotes the statement and its parameters. `sqlStateOf(error)` gives the SQLSTATE |
| In a database-free test, the app's pool must have `connect()` | The scaffold's `createFakePool()` has none: a unit then answers 503 (`DATABASE_UNAVAILABLE`). `standInDatabase()` of `src/core/__tests__/support.ts` is a pool that speaks the unit's statements |

### 4.2 The engine host (W26)

```ts
await app.pipeline.run('engine.tick', async (unit) => {
  sim.tick();
  const next = pickDurable(sim.store.getState());
  const changes = diffSlices(written, next, app.clock.now());     // src/db/mapping
  if (changes.length === 0) return;                                 // no transaction was opened: 0.02 ms
  await unit.audit.appendPrepared(newAuditRows(written, next));     // AP-6: must continue the head of AP-2
  await unit.events.appendPrepared(newEvents(written, next));
  await applyChanges(unit.db, changes.filter((c) => c.table !== 'auditLog' && c.table !== 'events'));
  unit.afterCommit(() => { written = next; app.publish(...); });
});
```

| Point | What the host has to do |
|---|---|
| The two tables are the writers' alone | An insert into `audit_log` or `events` through `unit.db` or `unit.query` is refused (`UNIT_STATEMENT_NOT_ALLOWED`). The seed row's log gives the same split (`20_db_mapping_seed.md` §4) |
| Rows that server-native units append | The engine's ring does not know them. `app.pipeline.onCommit((unit) => ...)` reports every committed unit's rows and events, before the next unit starts; the host merges those above its ring's `total` and sets its event counter |
| A unit that both appends native rows and runs a hosted action | The host syncs its ring with `unit.audit.appended()` and `unit.events.appended()` BEFORE the action, or the action's rows do not continue the unit's head |
| Rows that do not continue the head | `appendPrepared` logs `audit head diverged` with both sequence numbers and the unit fails with 503 (`AUDIT_HEAD_DIVERGED`); nothing is stored. The host sets its state back (ENG-5) |
| A failed commit | `run` rejects with a `PipelineFailure`; the host sets its state back in its `catch`. The next unit starts only in a later turn of the event loop, so that `catch` runs first |
| A line `unit abandoned: it ran too long` with `phase: closing` | The COMMIT was under way when the watchdog fired: its outcome is not known to the process. The host re-reads the stored head before it goes on (finding F-6) |
| Ticks | One unit per tick; a tick that changed nothing durable costs no round trip. The host does not submit a tick while its last one is still in the queue (ENG-1) |
| Stop | The host's `onClose` runs before the core's: it may still submit its last unit (the snapshot). Then the pipeline closes, then the pool |

## 5. The append protocol as implemented, statement by statement

The first three statements are the unit's (`unit-of-work.ts`), issued when the unit first touches
the database; the INSERTs are the writers'.

```sql
BEGIN ISOLATION LEVEL READ COMMITTED                      -- AP-1, stated and not left to a default
SELECT seq, hash FROM public.audit_chain_lock()           -- AP-2: the first statement; waits, returns the head
SELECT set_config('statement_timeout', $1, true)          -- the unit's time limit, for this transaction only ($1 = '5000')
insert into "audit_log" ("seq", "id", "at", "type", "category", "severity", "actor_id", "message",
  "session_id", "evidence_id", "device_id", "details", "prev_hash", "hash")
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)   -- AP-4: once per row, ascending seq
UPDATE public.engine_counters SET next_value = next_value + $2
  WHERE name = $1 RETURNING next_value - $2 AS first_seq                 -- AT-5: the event numbers
insert into "events" ("seq", "id", "at", "type", "category", "severity", "message", "params",
  "session_id", "device_id") values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
-- AP-5: the unit's own statements
COMMIT                                                    -- releases the head row lock
```

| Rule | How it is met |
|---|---|
| AP-1 | The isolation level is written into `BEGIN`. A test reads `transaction_isolation` inside a unit: `read committed` |
| AP-2 | The chain lock is the first statement after `BEGIN`, in EVERY unit that opens a transaction, also one that appends nothing (AT-2). A database-free test pins the exact statement list |
| AP-3 | Each row is built by the shared `appendAudit` of `@dems/shared/sim` over a log whose head and total are the head of AP-2: `seq`, `id`, category of the shared map, `prevHash`, `hash = chainHash(prevHash, body)`. The core computes no digest of its own; a static test keeps `createHash`, `node:crypto` and `@noble/hashes` out of `src/core/` |
| AP-4 | One INSERT per row, ascending, 14 bind parameters. The statement is the query builder's for the typed table of the schema; the values are the stored form from `auditRowToRow` of the mapping module (section 9). The guard trigger checks the link and moves the head |
| AP-5 | Events, state changes and counters follow in the same transaction |
| AP-6 | `appendPrepared`: the rows must continue the unit's head and each other, checked before any of them is sent. If not: one log line `audit head diverged` with `headSeq` and `rowSeq`, one persistent entry, and the unit fails with 503 |
| AP-7 | The lock is held before any other table is written, by construction: it is taken when the transaction opens |
| Contiguity | The unit holds the head row from its first statement to its COMMIT, so the rows of one unit are contiguous whether they come from one call or several. Two appends started together in one unit are run one after the other |
| `ZA001` from the guard | Mapped to 503 (`AUDIT_CHAIN_REFUSED`) with one error line by the code, as contract §6.3 says ("a commit failure and one log line") |

**Never a half-written unit:**

| Case | What happens | Test |
|---|---|---|
| `work` returns | `COMMIT`, then `run` resolves | `pipeline.test.ts`, `unit-of-work.db.test.ts` |
| `work` throws | `ROLLBACK`, then `run` rejects with the same object | both |
| A statement of the unit failed and `work` caught it | The unit is marked: `ROLLBACK`, and `run` rejects with that statement's failure | both (`22012` against PostgreSQL) |
| The server answers `ROLLBACK` to `COMMIT` (a transaction in the failed state) | Not a commit: 503 (`COMMIT_FAILED`), the connection is closed | `pipeline.test.ts` |
| `COMMIT`, `ROLLBACK`, `BEGIN`, a savepoint, a session-level `SET`, `RESET`, `DISCARD`, `CREATE`, and `db.transaction()` of the query builder | Refused before the statement is sent (`UNIT_STATEMENT_NOT_ALLOWED`); the unit goes on | both: 16 refusals inside one unit against PostgreSQL, and the unit still commits |
| An insert into `audit_log` or `events` that is not the writers' | Refused before it is sent | both |
| The connection is lost, or its state is not known | The connection is closed, never returned to the pool; the server rolls back | `pipeline.test.ts` |

## 6. The queue: what it guarantees and its limits

| Guarantee | Detail |
|---|---|
| Order | Units run strictly one after another, in the order of submission (ENG-6). The next unit starts after the one before it has committed or rolled back, and in a later turn of the event loop, so the caller that just got its result continues first |
| One transaction | At most one, opened at the unit's first statement. A unit that touches no table costs no round trip |
| The answer | `run` resolves after the commit (ENG-4). An in-process test with a scratch route shows the row committed before the handler continues |
| Bounded | At most `PIPELINE_MAX_PENDING` units wait; the unit that is running is not counted. One more is refused at once with 503. A full queue is announced once until it has room again |
| Watchdog | A unit that runs longer than `PIPELINE_UNIT_TIMEOUT_MS` is abandoned: its connection is closed, so the server rolls it back; `run` rejects with 503 and the queue goes on. The same number is the unit's server-side statement limit, so the server cancels a statement that runs past it (`57014`), which is reported as the same refusal |
| A unit that throws or times out | Never blocks the queue |
| No nesting | `PIPELINE_REENTRANT`, at once |
| Shutdown | `close()` refuses new units, lets the accepted ones finish, and after `PIPELINE_CLOSE_TIMEOUT_MS` refuses the waiting ones in order and abandons the running one. It is called from the unit's `onClose` hook: after the hooks of the engine, the realtime channel and the modules, before the pool's |
| Readiness | A unit that cannot reach the database or cannot commit calls `app.db.probe({ fresh: true })`, so `ready.database` follows (ENG-5). An outage is announced once, not once per failed unit |

**The limits.** The specification names the pipeline and is silent on its length and on a time
limit. These are this row's choices, constants of `src/core/limits.ts` (the frozen `config.ts`
holds none of them; no environment variable reaches them):

| Constant | Value | Reason |
|---|--:|---|
| `PIPELINE_MAX_PENDING` | 256 | Above every burst the specification names (50 appends, AC-B-54; 20 sign-ins of two units each, AC-B-80; 100 denied calls of which 20 write a row, AC-B-75) with the engine's ticks on top. A unit with one audit row took 0.5 to 1.0 ms here, so a full queue is worked off in well under a second |
| `PIPELINE_UNIT_TIMEOUT_MS` | 5,000 | A unit is a handful of statements on loopback; the pool waits at most 2,000 ms for a connection; the entry point gives a shutdown 10,000 ms. Real time, measured with a timer: a manual clock does not move by itself, and the watchdog stamps nothing |
| `PIPELINE_CLOSE_TIMEOUT_MS` | 6,000 | Above the unit limit, so a running unit ends by its own watchdog first; below the entry point's 10,000 ms |
| `UNIT_LABEL_PATTERN`, `UNIT_LABEL_MAX_LENGTH` | a dotted name, 64 | Section 4.1 |
| `NATIVE_TEXT_MAX_LENGTH` | 500 | The message and each text of the payload of a row a server-native module writes (the contract caps an administration reason at 500) |
| `NATIVE_PAYLOAD_KEYS_MAX` | 16 | The keys of such a payload |
| `REFERENCE_MAX_LENGTH` | 64 | A session, evidence or device reference |

**What a refusal of the pipeline looks like.** `PipelineFailure` is an `ApiFailure`: 503 `NOT_READY`
with the envelope's own message and no detail, whatever the reason. `reason` is for the log and for
tests: `QUEUE_FULL`, `CLOSED`, `UNIT_TIMEOUT`, `DATABASE_UNAVAILABLE`, `COMMIT_FAILED`,
`AUDIT_CHAIN_REFUSED`, `AUDIT_HEAD_DIVERGED`. A broken rule of the writers or of the unit is a
`CoreError` (or, for a value that cannot be stored exactly, the mapping module's `MappingError`):
not an `ApiFailure`, so the request answers 500 `INTERNAL_ERROR` without a detail.

## 7. The clock

One clock per process, the seam `app.clock`: the wall clock, held so that it never returns a
smaller value than before (ENG-14; tested with a source that steps back). The pipeline and the
writers read the seam each time they stamp (`followClock`), so a manual clock put in place with
`app.seams.replace('clock', createManualClock(start))` after `ready()` is the one that stamps
(ENG-16; tested). `clock.ts` is the only file under `src/core/` that reads the system time; a
static test keeps it so. A clock value that is not a whole, non-negative number of milliseconds is
refused before a statement is sent (`CLOCK_VALUE_INVALID`; the column is a `bigint`, MR-9).

`at` of a row a server-native module asks for is the clock's value when the call is made; a batch
shares one value. An entry cannot carry a time: any member besides `type`, `message`, `severity`,
`actorId`, `deviceId`, `sessionId`, `evidenceId`, `details` is refused (`AUDIT_ENTRY_INVALID`;
SR-65, AC-B-55). A prepared row carries the `at` the engine gave it; the writer checks that it is
storable, not where it came from (the engine runs on the same clock; AC-B-55 for the engine is
W26's to show).

## 8. The rules of the writers

Applied BEFORE the first statement of a call, so that a row a CHECK would refuse never reaches the
database, where it would be written whole into the server log (finding F-1 of the migration row).
A test shows the unit still usable after nine refused rows: after a statement that a CHECK refused,
the next statement would fail with `25P02`.

| Rule | Native row (from an entry) | Prepared row (the engine's) | Code |
|---|---|---|---|
| Type | One of the 53 shared audit types; one of the 46 shared event types | The same | `AUDIT_TYPE_UNKNOWN`, `EVENT_TYPE_UNKNOWN` |
| Category | From the shared map, by the shared code | Must equal the shared map's | `AUDIT_ROW_INVALID` |
| Severity | One of four; default `INFO` | One of four | `..._SEVERITY_INVALID` |
| Actor | An operator ID (`OPR-nnn`) or null; must be stated | The same form | `AUDIT_ACTOR_INVALID` |
| References | An identifier of at most 64 characters, or null | The same | `..._REFERENCE_INVALID` |
| Message | 1 to 500 characters | A text | `..._MESSAGE_INVALID` |
| Payload map | A plain object of strings, finite numbers, booleans, null; camelCase keys; at most 16 keys; texts of at most 500 characters | A plain object of flat values | `AUDIT_DETAILS_NOT_FLAT`, `AUDIT_DETAIL_VALUE_INVALID`, `EVENT_PARAMS_NOT_FLAT`, `EVENT_PARAM_VALUE_INVALID` |
| No key that may name a secret | None of the 17 names of `AUDIT_DETAIL_FORBIDDEN_KEYS` (the constant the CHECK is built from), in any letter case | The 17 names exactly, as the CHECK states them | `AUDIT_DETAIL_KEY_FORBIDDEN`, `EVENT_PARAM_KEY_FORBIDDEN` |
| No credential form | No text of the row (message, payload text, reference) holds something of the form of a session token, a device credential, a biometric token or the QR payload of a pairing code. The forms are the contract's own patterns (`api/patterns.ts`), found also inside a longer text | The same | `AUDIT_SECRET_SHAPED_VALUE`, `EVENT_SECRET_SHAPED_VALUE` |
| Storable text | No U+0000, no unpaired surrogate: the mapping module's `isStorableText`, applied to the whole batch before its first row is sent | The same | `AUDIT_TEXT_INVALID`, `EVENT_TEXT_INVALID` |
| Allow-list | For the nine server-written types: exactly the keys of spec §13.1, with the value form of each | Not applied: the simulator's details stay as the shared code writes them (parity, spec §13.2) | `AUDIT_DETAIL_KEY_NOT_ALLOWED`, `AUDIT_DETAIL_MISSING`, `AUDIT_DETAIL_VALUE_INVALID` |
| Identifier, hashes, digest | Built by the shared code | `id` is the one of `seq`; both hashes are 64 hexadecimal digits and differ; `hash` equals the shared digest of the previous hash and the body (the database does not check that, GD-01) | `AUDIT_ROW_INVALID`, `AUDIT_ROW_HASH_MISMATCH` |
| Exactly storable numbers | — | The mapping module's builder: `NOT_SAFE_INTEGER`, `NOT_FINITE`, `TEXT_NOT_STORABLE` (a `MappingError`) | the mapping module's |

**The allow-list of the nine types** (`audit-details.ts`):

| Type | Keys (required in bold) | Value forms |
|---|---|---|
| `ACCESS_DENIED` | **`operationId`**, `permission`, `role`, `reason` | An operation ID; a code; a role; a code such as `DEVICE_REVOKED` (RB-6: a retired device has no permission and no role) |
| `PAIRING_CODE_ISSUED` | **`codeId`**, **`expiresAt`** | A code ID `PCD-nnnnnn`, never the code; a whole number |
| `PAIRING_CODE_CLOSED` | **`codeId`**, **`reason`** | One of `CANCELLED`, `EXPIRED`, `EXHAUSTED` |
| `DEVICE_REVOKED` | **`reason`**, **`sessionsEnded`**, `deviceId` | A text of 1 to 500 characters; a whole number; a registry device ID |
| `DEVICE_CREDENTIAL_ROTATED` | `deviceId` | — |
| `ROLE_CHANGED` | **`targetOperatorId`**, **`from`**, **`to`**, `reason` | An operator ID; roles; a text |
| `USER_ENABLED` | **`targetOperatorId`**, `reason` | |
| `USER_DISABLED` | **`targetOperatorId`**, **`sessionsEnded`**, `reason` | |
| `BIOMETRIC_ENROLLMENT_CHANGED` | **`enabled`**, `deviceId` | A boolean |

A value of the wrong form is refused: a six-digit pairing code where a code ID belongs is one of
the tested cases. "Device ID" of the specification's table is the row's own `deviceId`; the list
lets a module repeat it in the details.

**What these rules cannot see** (stated, not hidden): a secret that has no recognisable form (a
six-digit code, a password) inside a free text such as an operator's reason. That stays the calling
module's duty and the subject of the dump and log-capture tests of the identity and pairing rows.

**A refusal quotes nothing of the row.** The text of a `CoreError` names the rule, and for the
allow-list the keys that ARE allowed; never the offending key or value (tested with markers).

## 9. One mapping only (controller note of 10:50; MR-1)

The seed row's log found a second mapping in this row's first version (its finding F-8). Applied:

**What this row now imports from `src/db/mapping`:**

| Import | In | Replaces |
|---|---|---|
| `auditRowToRow` | `audit-writer.ts`, last step of `checkAuditRow` | This row's own binding of the 14 audit columns (`parametersOf`, deleted) and its own safe-integer checks (deleted) |
| `eventToRow` | `event-writer.ts`, last step of `checkEvent` | This row's own binding of the 10 event columns and its own call of the shared `eventCategory` (both deleted) |
| `verifyStoredAuditRows` | `boot-checks.ts`, passed to `checkStoredChain` for B-8 | `sharedAuditRowOf` and `verifyStoredDigests` (both deleted) |
| `isStorableText` | `payload-rules.ts` | The use of the contract's `isWellFormedText` for the same question; one rule for "can be stored exactly" now |

The INSERTs go through the typed tables of the schema (`auditLog`, `events` of `src/db/schema`)
with the mapped row, so the core names no column and binds none. A static test keeps it so: no
column name of the two tables, no `verifyAuditChain` and no `eventCategory` in the production
sources of `src/core/`, and each of the four imports present.

**What this row still holds locally, and why:**

| Held locally | Why | Missing in the mapping module |
|---|---|---|
| `EVENT_COUNTER_ADVANCE`: `UPDATE ... SET next_value = next_value + $2 ... RETURNING` | A server-native event has no engine state to take its number from; AT-5 wants one statement that reads and advances | **A statement (or a function of the store) that takes n event numbers from the stored counter.** The mapping module is pure and its diff writes counters as absolute values from the engine's state |
| `EVENT_COUNTER_RAISE`: `... SET next_value = GREATEST(next_value, $2)` after prepared events | Keeps "the counter is above every stored sequence" true by the writer alone. The engine's write-through sets the same value; the seed row's log notes that the two agree | Nothing. It can be removed by a ruling (DN-3) |
| `Number.isFinite` for a payload value | It must hold BEFORE the shared hash function runs, which throws a bare `TypeError` on a non-finite number | An exported predicate for one value; the module has the throwing walk `storableJson` only |
| The range rules `seq >= 1`, `at >= 0` | CHECKs of the tables; the mapping guards exactness, not range | Not a mapping matter |
| Vocabulary, category, severity, actor form, reference grammar, flatness, forbidden keys, credential forms, the allow-list, the native limits, the digest | Rules of spec §13 and SR-54 about what a row may SAY; the mapping module has none of them | Not a mapping matter |
| The check that prepared rows continue the head (AP-6) | The unit's head is the writer's state | The seed's store has the same check for the owner-role programs (finding F-4) |
| `EVENT_COUNTER_NAME = 'event'` | A name | The module exports the list `COUNTER_NAMES`, no single name |
| `sqlStateOf`, `driverErrorOf` | Error helpers of the runtime | Not a mapping matter |

Nothing under `src/db/mapping/**` or `src/db/seed/**` was edited.

## 10. The boot checks (decision D40)

`registerBootChecks(app)` adds B-2 to B-9 as boot steps, by the list `BOOT_CHECK_IDS` of the
migration row, after B-1 of the pool plugin (which registers first). Nothing runs when the plugin
is registered: `buildApp()` still works without PostgreSQL.

| Step | Behaviour |
|---|---|
| B-2 to B-7, B-9 (blocking) | The migration row's function on `app.db.pool`. On a failure the step writes its own error line, `boot check failed`, with the check's ID, the error's name or SQLSTATE, and, for a `BootCheckError` only, its text as `detail` (it names a role, a table, a trigger or a number, and the command that fixes it; never a credential); one entry in the persistent error log; then it throws. `readiness.boot()` rejects with a `BootError` that names the check; the entry point stops the process without a listener |
| B-8 (reported) | `checkStoredChain(pool, { verifyDigests: verifyStoredAuditRows })`. A chain that verifies: one info line with the counts. One that does not: one error line with `code: STORED_CHAIN_NOT_VERIFIED`, the counts and the problems (a rule and a sequence, never row content), one persistent entry, and the boot goes on to B-9 |

Proven against PostgreSQL on clones broken as `dems_owner` (the helper allows it; no stubbed check
was needed): a trigger in the default mode stops at B-5; a pool of the owner role at B-4; a database
never seeded at B-6, and the line says how to seed it; a chain head set by hand at B-7; a stored row
with a wrong digest is reported by B-8 and the boot ends after B-9. In each blocking case
`app.readiness.isReady()` is false, a scratch route answers 503 `NOT_READY`, health answers 200,
and nothing listens. On a clone of the seed template all nine pass and B-8 verifies the 82 seeded
rows. The same order and the reported behaviour of B-8 are also proven database-free, with a pool
that answers each check from a table.

`ready.engine` is untouched: it stays false until the engine host lands, so a non-health operation
answers 503 also after a boot that passed (asserted).

## 11. Verification

### 11.1 The row command (11:00:06)

```
$ DEMS_TEST_STEP=43 npm run test:db -w @dems/core-server -- src/core

> @dems/core-server@0.2.0 test:db
> vitest run --project db src/core

 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/core-server

[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_43_tmd747jo_
[test:db] stale sweep: dropped 0; kept 0 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
[test:db] template dems_test_step_43_tmd747jo_tpl_schema: built in 89 ms (create 30 ms, hook 57 ms)
[test:db] template dems_test_step_43_tmd747jo_tpl_seed: built in 137 ms (create 53 ms, hook 83 ms)

 Test Files  4 passed (4)
      Tests  39 passed (39)
   Start at  11:00:07
   Duration  3.59s (tests 72%, import 20%, transform 8%)

[test:db] teardown: dropped 2 database(s) in 33 ms; 0 remain with the run prefix dems_test_step_43_tmd747jo_
exit=0
```

### 11.2 What the tests printed (verbose run, 11:02:36, exit 0, 39 pass marks, 0 failures)

```
[w21] one pipeline: 50 units, seq 1..50 without a gap; verifyAuditChain ok=true over 50 rows
[w21] ten connections: 50 commits, 0 errors; 10 units in flight at once, up to 9 waiting on the head row; seq 51..100 without a gap; verifyAuditChain ok=true over 100 rows
[w21] raw insert without the lock: gap row ZA001 ("audit chain: row 102 does not continue head 100"); wrong previous hash ZA001
[w21] race: the unit committed seq 101; the raw insert waited and got ZA001
[w21] one unit's four rows: seq 102, 103, 104, 105; 12 rows of four other connections around them
[w21] end of file: 123 rows, verifyAuditChain ok=true, head at seq 123
[w21] watchdog: abandoned after 402 ms (limit 400 ms); the next unit committed seq 6
[w21] cost: 200 units with one audit row in 105 ms (0.53 ms a unit: BEGIN, lock, limit, INSERT, COMMIT); 200 units without a statement in 4 ms (0.02 ms a unit)
[w21] seeded clone: B-1 to B-9 passed; B-8 verified 82 seeded audit rows
[w21] seeded clone: appended seq 83 on 82 seeded rows and event 60 on 59 seeded events; verifyAuditChain ok=true over 83 rows
```

Pass marks per file: `audit-chain.db.test.ts` 12, `unit-of-work.db.test.ts` 19,
`boot-checks.db.test.ts` 6, `seeded.db.test.ts` 2.

"Verified over all rows" means: every stored row is read back in sequence order, as `dems_owner`,
and three things are asserted: the links stated without the shared code (gap-free from 1, each
`prev_hash` the previous `hash`, the first on the genesis value), the head row equal to the last
row, and the shared `verifyAuditChain` with `dropped: 0` returning `{ ok: true, checked: <all rows> }`.

### 11.3 The cases of the row, against PostgreSQL

| Case of the brief | Test | Result |
|---|---|---|
| 50 concurrent appends from separate connections / units | `audit-chain.db.test.ts`: "50 units submitted at once to the one pipeline ..."; "50 appends from 10 pipelines on 10 separate connections, at once (T-CH-1) ..." | PASS |
| A writer that skips the lock: `ZA001` | "a raw insert with a sequence of its own (a gap), and one with a wrong previous hash"; "a raw insert that read the head without the lock while a unit holds it: it waits, then ZA001" | PASS |
| A failing unit leaves no row and does not advance the head | `unit-of-work.db.test.ts`: "a unit that throws leaves no row, does not advance the head, consumes no event number, and rejects with what was thrown"; also for a thrown `ApiFailure` and for a statement failure the work caught | PASS |
| Every `at` follows the injected clock | `audit-chain.db.test.ts`: three tests under "AC-B-55" | PASS |
| Rows of one unit are contiguous | "four rows from three calls with pauses between them, while four other connections append" | PASS |
| The queue's ordering, timeout and bounded length | `pipeline.test.ts` (database-free); against PostgreSQL: the watchdog on a statement that does not return and on a unit that never returns while it holds the chain lock; shutdown with units in flight | PASS |
| The boot checks are registered; a violating database keeps the app not ready with the check's name in the log | `boot-checks.db.test.ts`, `seeded.db.test.ts` | PASS |
| The writers log codes, never row contents | `unit-of-work.db.test.ts`: "at level trace, a unit that appends, one that is refused and one that fails leave none of their values": 11 markers and the actor's ID are absent; every line holds only `level, time, pid, hostname, msg, unit, label, seq, type, code, ms, committed, audit, events` | PASS |

Beyond the brief: none of 12 test markers occurs in the PostgreSQL server log after a run
(`grep -c` on `.data/postgres.log`, counts only, 10:38): the refused rows never reached the server,
and a failed statement shows `$1`, not its parameter.

### 11.4 Whole projects, typecheck, lint (final state)

```
$ DEMS_TEST_STEP=43 npm run test:db -w @dems/core-server -- --maxWorkers=2          (11:00:10)
 Test Files  27 passed (27)
      Tests  382 passed (382)
[test:db] teardown: dropped 6 database(s) in 81 ms; 0 remain with the run prefix dems_test_step_43_tmd74aa1_
exit=0

$ npm run test -w @dems/core-server -- --maxWorkers=2                               (11:02:41)
 Test Files  41 passed (41)
      Tests  1281 passed (1281)
exit=0

$ npm run typecheck -w @dems/core-server      exit=0
$ npm run lint -w @dems/core-server           exit=0   (no finding)
$ npm run lint        (root)                  exit=0
$ npm run typecheck   (root)                  exit=2   in files of other rows (finding F-8)
```

### 11.5 Every run of the whole projects (P11)

| Time | Project | Result | Note |
|---|---|---|---|
| 09:59:23 | `unit` | 31 files, 985 passed | Baseline, before this row's first edit |
| 09:59:43 | `db` | 19 files, 285 passed | Baseline |
| 10:14 | `unit` | 1 failed, 1,019 passed | The first run with the boot checks registered: `db.test.ts` "boot step B-1 > passes when the database answers ...": by design (section 13) |
| 10:31 | `unit` | 1 failed, 1,259 passed | The same test |
| 10:31:07 | `db` | 1 failed, 377 passed | `test/db/boot-checks.db.test.ts` T-PV-3 "every blocking check passes, in order": by design |
| 10:42:11 | `db` | 1 failed, 378 passed | The same |
| 10:45:26 | `db` | 1 failed, 378 passed, **and one file failed as a whole**: `test/helpers/db/__tests__/cleanup.db.test.ts` (the helper row's) | Noise: the file passed alone at 10:46:00 (7 of 7) and in the three later whole runs. Its cause was not captured. The 1-minute load average was 21.99 at 10:40 and 10.08 at 10:45 (finding F-7) |
| 10:41:11 | `unit` | 1 failed, 1,274 passed | The by-design one |
| 10:46:13 | `db` | 1 failed, 378 passed | The by-design one |
| 10:46:50 | `unit` | 1 failed, 1,275 passed | The by-design one |
| 10:57:02 | `unit` | 41 files, 1,280 passed | After the two authorised adaptations |
| 10:57:10 | `db` | 27 files, 382 passed | |
| 11:00:10 | `db` | 27 files, 382 passed | Final |
| 11:02:41 | `unit` | 41 files, 1,281 passed | Final |

Stability: the row command 5 of 5 and the database-free core tests 5 of 5 in a row at 10:40, with
the load average at 22.

### 11.6 Mutation check

41 defects were planted one at a time into a copy of the workspace outside the repository (so that
no other row's run saw a mutated file) and the database-free tests of `src/core` were run on each.
**41 of 41 detected.** Among them: the allow-list skipped; forbidden keys accepted; credential forms
not looked for; a `ROLLBACK` answer counted as a commit; a failed statement not marking the unit;
the statement limit set before the chain lock; no queue bound; the watchdog ten times too patient;
the next unit starting while one runs, or in the same turn; the wall clock as the stamp; prepared
rows not checked against the head; a writer-owned insert or transaction control passing the unit;
B-8 blocking the boot; the boot checks not registered; tasks running after a rollback; nesting
allowed; the clock not followed; appends of one unit not serialised; the digest not recomputed; an
entry carrying a time; `ZA001` passed on as it is; the stored form altered after the mapping; the
query builder's wrapper handed on; `CREATE` passing the unit; B-8 without the digest check.

Two notes. One candidate ("the commit listener is called before the commit is known") was an
equivalent mutant: the condition it removed was redundant, and the code was simplified. One
mutation ("the stored form of an audit row is altered after the mapping") survived its first run;
the test was strengthened with a row that has no default value in it, and then detected it.

### 11.7 Measurements (this host, PostgreSQL 18.4, under the load of the parallel rows)

| What | Measured |
|---|---|
| A unit with one audit row (BEGIN, lock, limit, INSERT, COMMIT) | 0.53 to 0.98 ms (200 units in 105 to 196 ms, four runs) |
| A unit that touches no table (an engine tick without a durable change) | 0.02 to 0.04 ms |
| 50 units of one pipeline, each pausing 0 to 19 ms while it holds the lock | 0.6 s |
| Growth of `.data/postgres.log` by one run of this row's database tests | About 7 kB (10:38; other rows were writing too) |

### 11.8 Requirement to test

| Requirement | Where it is proven |
|---|---|
| AC-B-54 (50 writers; a row that does not continue the chain is rejected) | `audit-chain.db.test.ts` |
| AC-B-55 (every `at` follows the injected clock; no request field can set a time) | `audit-chain.db.test.ts`; `writers.test.ts` ("a member that is the writer's ... is refused"); `core-plugin.test.ts` |
| SR-52 (append-only) | The migration row's tests; here the runtime role's only write path, and `static.test.ts` "one insert path" |
| SR-53 (one writer, the shared hash) | `audit-chain.db.test.ts`; `static.test.ts` "one hash" |
| SR-54 (flat details, no secret) | `writers.test.ts`; `unit-of-work.db.test.ts` |
| SR-65 (time from the server clock, no caller-supplied time) | As AC-B-55. The actor is a member of the entry: the module takes it from the session; the writer checks its form |
| SR-72 (the queue; atomic units) | `pipeline.test.ts`; `unit-of-work.db.test.ts` |
| AP-1 to AP-7 | Section 5 |
| DA-07 (two writers on one database) | The ten-connection test and the race test |
| D40 (boot checks registered) | `boot-checks.db.test.ts`; `seeded.db.test.ts`; `core-plugin.test.ts` |

## 12. Test ledger (P24)

`@dems/core-server` only. No other workspace was written.

| Project | Before (09:59) | After (final) | This row |
|---|---|---|---|
| `unit` | 31 files, 985 tests | 41 files, 1,281 tests, 0 failed | **+4 files, +113 tests**. The other 6 files and 183 tests were added by rows that ran at the same time |
| `db` | 19 files, 285 tests | 27 files, 382 tests, 0 failed | **+4 files, +39 tests**. The other 4 files and 58 tests are other rows' |

| Project | File (`apps/core-server/src/core/__tests__/`) | Tests |
|---|---|--:|
| `unit` | `pipeline.test.ts` | 39 |
| `unit` | `writers.test.ts` | 51 |
| `unit` | `core-plugin.test.ts` | 14 |
| `unit` | `static.test.ts` | 9 |
| `db` | `audit-chain.db.test.ts` | 12 |
| `db` | `unit-of-work.db.test.ts` | 19 |
| `db` | `boot-checks.db.test.ts` | 6 |
| `db` | `seeded.db.test.ts` | 2 |

The three adapted test files of other rows keep their test counts: no test was added or removed
there.

## 13. Existing tests changed by design

Three files, each a recorded by-design change. Pre-images: `.cache/rollback/W21.<name>.pre`.

**(1) `apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts`** (standing rule of D52;
named in the brief). Three lines deleted, nothing else; they pinned this row's seams as stubs.
SHA-256 before `d584267b...88cf5a`, after `b2771daf...592cc9`.

```
252,254d251
<     expect(() => app.pipeline.drain()).toThrow('plan row W21');
<     expect(() => app.pipeline.run('x', async () => 1)).toThrow('pipeline.run is not implemented');
<     expect(() => app.auditWriter.append(unit, { type: 'X', actorId: null, deviceId: null, details: {} })).toThrow('plan row W21');
```

**(2) `apps/core-server/src/plugins/db/__tests__/db.test.ts`** (the scaffold's; authorised by the
controller's note of 10:50). Test "boot step B-1 > passes when the database answers and sets the
flag", lines 224-228 before. SHA-256 before `dd916df1...2bb6887f`, after `b93ff2a4...ab6e5d23`.

| Line (before) | Before | After | Reason |
|---|---|---|---|
| 225 | `const app = await readyApp({ createPool: () => createFakePool().pool });` | The same app with `config: unitTestConfig({ logLevel: 'info' })` and `logStream: log.stream` of a `captureLog()` | To read which steps passed |
| 226 | `await expect(app.readiness.boot()).resolves.toBeUndefined();` | The boot's rejection is caught; `expect(error).toBeInstanceOf(BootError)`; `stepId` is `'B-2'`; the `boot step passed` lines are exactly `[BOOT_STEP_DATABASE_ANSWERS]` | The registration makes "the whole boot ends" untrue for a stand-in pool, which answers none of B-2 to B-9. What the test is about holds and is now asserted directly: B-1 passes |
| 227 | `expect(app.readiness.snapshot().database).toBe(true);` | Unchanged | The flag is set |

A comment of three lines says why. No import changed: `captureLog`, `unitTestConfig`, `BootError`
and `BOOT_STEP_DATABASE_ANSWERS` were already imported.

**(3) `apps/core-server/test/db/boot-checks.db.test.ts`** (the migration row's; authorised by the
same note). Block "T-PV-3". SHA-256 before `958c3d91...487e81c2`, after `9655012d...47a03429`.

| Line (before) | Before | After | Reason |
|---|---|---|---|
| 287 | Comment: "... with the boot checks registered as the core-services row will register them." | "... The core services register the boot checks in the app itself (decision D40)." | The future tense is over |
| 307-309 | `for (const check of BLOCKING_BOOT_CHECKS) { instance.readiness.addBootStep({ id: check.id, run: () => check.run(instance.db.pool) }); }` | Removed; a two-line comment in its place | The app has the steps. Adding them again ran every check twice and listed every step twice |
| 350 | `expect(result.passed).toEqual(['B-1', 'B-2', 'B-3', 'B-4', 'B-5', 'B-6', 'B-7', 'B-9']);` | The same list with `'B-8'` between `'B-7'` and `'B-9'`; a one-line comment | B-8 is registered and runs there |

The three other tests of the block (B-4, B-5, B-6) pass unchanged, now against the app's own
registration. `BLOCKING_BOOT_CHECKS` is still imported and used by the file's first test.

## 14. What the specification left open, and this row's choices

| # | Open point | Choice |
|--:|---|---|
| 1 | Length of the queue; a time limit for a unit; how long a shutdown waits | 256; 5,000 ms; 6,000 ms (section 6) |
| 2 | When a unit's transaction opens | At its first statement. A unit without one costs nothing, which is what an engine tick needs (94 % of ticks change nothing durable) |
| 3 | Whether a unit that appends nothing takes the chain lock | Yes, every unit that opens a transaction (AT-2 says so for audited changes; one rule for all is simpler and cannot deadlock) |
| 4 | What bounds a statement on the server | `statement_timeout` for the transaction only, equal to the unit limit; a cancelled statement (`57014`) is the same refusal as the watchdog's |
| 5 | The answer of a refusal of the pipeline | 503 `NOT_READY` without a detail, for every reason (ENG-5 names it for a commit failure) |
| 6 | The answer of a broken rule of the writers | 500 `INTERNAL_ERROR`: a defect of the calling code, not a refusal of a request |
| 7 | Nesting | Refused at once |
| 8 | What runs after a commit, and when | Commit listeners, then the unit's `afterCommit` tasks, synchronously and in order; then the caller; the next unit in a later turn of the event loop |
| 9 | What a unit may send | No transaction control, no session setting, no `CREATE`, no insert into the two tables of the writers |
| 10 | The details of the 44 simulator types | The general rules only; a closed list only for the nine server-written types, whose details the specification names |
| 11 | A rule on the VALUES of a row | No text of a row may have the form of a credential (section 8) |
| 12 | Limits of a native row | 500 characters, 16 keys, camelCase keys, references of at most 64 characters |
| 13 | Whether an entry must state its actor | Yes: `actorId` and `deviceId` are required members, null included; `message` is required too |
| 14 | Monotonic `at` | Not enforced by the writer: the clock never moves backwards and units are serial, so `at` is non-decreasing in sequence order; a test asserts it over a file's rows |
| 15 | The counter after prepared events | Raised to one above the highest sequence |
| 16 | What the failing boot check's own log line holds | The check's ID and, for a `BootCheckError`, its text |
| 17 | An outage | Announced once: one error line and one persistent entry until a unit commits again |
| 18 | The `at` of a prepared row | Not compared with the clock |

## 15. Findings

| ID | Finding | Evidence | Effect |
|---|---|---|---|
| F-1 | Two tests of other rows pinned the state before the boot checks were registered | Section 11.5, the runs of 10:31 | Adapted under the controller's note (section 13) |
| F-2 | **The query builder wraps what the driver throws in an error whose message quotes the statement and its parameters.** For an insert of the writers a parameter is the content of a row | `node_modules/drizzle-orm/errors.js` (`DrizzleQueryError`) | The writers hand on the driver's error (`driverErrorOf`), never the wrapper; tested. A module that uses `unit.db` gets the wrapper: it must not log `error.message`. The scaffold's logger never writes an error's message, so the log is safe either way |
| F-3 | **The query builder names every table without its schema**, and PostgreSQL looks in the session's temporary schema first. The runtime role may create temporary tables (the migration row's F-3). A temporary table named like a real one, left on a pooled connection, would be found before the real table by every such statement on that connection, the audit insert included | The generated statement in section 5; `pgTable('audit_log', ...)` in the typed schema | A unit refuses `CREATE` before it is sent (tested). Outside a unit nothing prevents it; no program of the server does it. For the security review: DN-4 |
| F-4 | The append protocol's check AP-6 and an insert into the two tables exist a second time in the tree: in `src/db/seed/store.ts` (`applyChanges`), for the owner-role programs (seed, reset) | Read at 10:50; the seed row's log §4 | By role, as contract §6.4 lists the writers. At run time the unit refuses that path for the two tables, and the seed row's log routes the engine's audit rows and events to this row's writers |
| F-5 | A test of the request-guards row replaces the seam `auditWriter` with a stand-in that returns nothing | `throttle.test.ts:428` | The seam keeps the scaffold's signature (DV-1) |
| F-6 | A COMMIT that is under way when the watchdog fires has an outcome the process does not know: the caller gets 503 and the unit may be committed. The log line says `phase: closing` | Reasoning; not produced in a test (a COMMIT on loopback would have to hang 5 s) | Compare-and-set statements make a repeat harmless. The engine host re-reads the head after such a line; its next prepared rows would otherwise be refused, not stored |
| F-7 | The 1-minute load average was 21.99 at 10:40 and 10.08 at 10:45, above the guard of P9. This row's tests passed 5 of 5 at 10:40. One file of the helper row failed once as a whole in a whole-project run at 10:45 and passed alone and afterwards | `uptime`; section 11.5 | Recorded. The cause of that one failure was not captured |
| F-8 | The root typecheck is red in files of other rows: `apps/mobile/src/runtime/dev-probes.ts(225,24)` TS2590 at 10:43; `packages/shared/test/api-registry.test.ts` (TS2590, TS2578) and `test/client-types.test.ts` (TS2578) at 11:02 | Section 11.4 | Not this row's files (the contract rows were editing). The workspace typecheck is exit 0 |
| F-9 | The engine's ring and the server-native rows share the stored head, not the ring. Without the merge of section 4.2 the engine's next rows do not continue the head | Tested from the writer's side: `audit-chain.db.test.ts` "that do not continue the stored head: 503 ..." | The divergence is detected and never stored. The merge is W26's |
| F-10 | A database-free test whose handler runs a unit needs a pool with `connect()`; the scaffold's `createFakePool()` has none | `test-config.ts` | `standInDatabase()` of this row's test support |
| F-11 | The stored `category` of an event and the stored form of every row are the mapping module's: the INSERT of the writers has the same statement shape as the seed's | Section 9 | One mapping (MR-1) |
| F-12 | `decisions/decisions.md` held no entry D62 at 10:50, though the controller's note cites it | `grep` | Informational: the controller writes that file |
| F-13 | In the first version of this row an appended row could be refused only by this row's own copy of the storable-text rule; after section 9 a value that cannot be stored exactly in a PREPARED row is refused by the mapping module's `MappingError`, a second error class besides `CoreError` | `writers.test.ts` "what cannot be stored exactly ..." | Both carry `code` and a text without the value; both end as 500 and a rolled-back unit |

## 16. Deviations from the row text

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | `app.auditWriter.append(unit, entry)` returns nothing by its type; the appended row is returned by `unit.audit.append(entry)` | F-5: a return type with a row would break a test this row may not edit. The brief's "returns the appended row (seq, hash) so callers can publish it" is met on the unit |
| DV-2 | The opening sequence has a third statement (`set_config('statement_timeout', ...)`), and `BEGIN` names the isolation level | The unit's server-side time limit; AP-1 made explicit. The chain lock stays the first statement after `BEGIN` |
| DV-3 | The audit INSERT is the query builder's statement for the typed table, not the literal text of contract §6.4 (`INSERT INTO public.audit_log ...`): the same 14 columns in the same order, one statement per row, bind parameters only; the table is named without its schema | The controller's instruction to use the one mapping (section 9). See F-3 |
| DV-4 | Three test files of other rows were edited | Section 13: one by the brief, two by the controller's note |
| DV-5 | One database test file uses the seed template besides the schema template the brief names | The controller's note: the template exists now. It proves the registered boot checks and the writers on what `dems_demo` holds |
| DV-6 | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were not written | Parallel run: the controller writes them (CLAUDE.md §3.4, P8) |
| DV-7 | A test-support module is offered to other rows: `src/core/__tests__/support.ts` | Every later row's test of a handler that changes state needs a unit |
| DV-8 | `Pipeline` has three members beyond the scaffold's sketch (`onCommit`, `snapshot`, `close`), and `run` also takes a synchronous work function | The scaffold's log calls the type a first sketch that this row defines. The engine host needs `onCommit`; shutdown needs `close` |

## 17. Decisions for the controller

| ID | Question | Recommendation |
|---|---|---|
| DN-1 | The limits of the queue: 256 waiting, 5,000 ms a unit, 6,000 ms to close | Accept; they are constants of one file |
| DN-2 | Should the seam `auditWriter.append` return the row? | Keep as it is. If the row is wanted on the seam: one line of `throttle.test.ts:428` (its stand-in must return a row) by the request-guards row's owner, and one line here |
| DN-3 | The raise of the event counter after prepared events (`EVENT_COUNTER_RAISE`) | Keep: without it a host that forgot the counter change would produce a duplicate event number at the next server-native event (a primary-key refusal, loud but late). Remove it if the rule becomes "the write-through alone writes the counter" |
| DN-4 | F-3, tables named without their schema | Route to the backend security review (W45). Options: (a) accept, with the unit's refusal of `CREATE`; (b) a migration slot that revokes `TEMPORARY` on the project databases from `PUBLIC`; (c) a static guard against creating a temporary table in the server runtime |
| DN-5 | What the mapping module lacks for the writers | One item for its owner, if wanted: a function of the store that takes n event numbers from the stored counter with the one statement of AT-5. Until then the statement is this row's (section 9) |
| DN-6 | Pass to W24, W28, W32, W33, W41 | Section 4.1, and: `unit.audit.append` returns the stored row; the nine server types take exactly the keys of section 8; a row for `ACCESS_DENIED` needs `operationId` and may carry `permission`, `role`, `reason`; an actor that names no operator is refused by the foreign key (`23503`) |
| DN-7 | Pass to W26 | Section 4.2 |
| DN-8 | Pass to W29 and W43 (the reset) | Stop the producers (hold readiness, stop the engine's scheduler), `await app.pipeline.drain()`, then close the pool. The pipeline reads `app.db.pool` when a unit starts, so after `reopen()` the next unit is on the new pool (tested with a replaced pool) |
| DN-9 | Pass to W39 (`verifyAuditChain`, result `stored`) | The report of B-8 is logged, not kept. The operation calls `checkStoredChain(app.db.pool, { verifyDigests: verifyStoredAuditRows })` itself |
| DN-10 | The allow-list of the nine types is closed | A module that needs another key asks for it; the list is one object in `audit-details.ts` |
| DN-11 | F-6, an unknown commit outcome | Accept as residual; it needs a COMMIT that hangs for five seconds on loopback |

## 18. For the code review (W38)

- One folder, twelve production files; no dependency added; nothing outside `src/core/` imports a
  file of the folder other than `index.ts`.
- Every error path writes a log line by code and, for a failure of the infrastructure or a broken
  rule, one entry in the persistent error log (`app.errorLog`), with the unit's number and label as
  context. A refusal thrown by a handler inside a unit is not logged by the pipeline above `debug`:
  its caller reports it.
- No rejected promise is left without a handler: the entry point stops the process on an
  unhandled rejection. The promise of a unit's opening sequence and the work of an abandoned unit
  have handlers of their own.

## 19. End state and cleanup (11:01:16)

```
session: role=dems_owner server=18.4 port=4432 postmaster started 2026-10-04 07:14:26.046351+07
databases with this row's prefix (dems_test_step_43_*): 0
test databases of all rows at this moment: 0
project databases: dems_demo
sessions of this row's test pools still open: 0
project roles: dems_admin(super=true,createdb=true) dems_app(super=false,createdb=false) dems_owner(super=false,createdb=true)
pid file: 19121
```

(A scratch script outside the repository, as `dems_owner`, read through the test helper's own
reader of the connection file. It prints names and counts.)

- No database of this row remains; every run ended with `0 remain with the run prefix`.
- `dems_demo` was never connected to by this row: every test ran on a clone.
- PostgreSQL was never stopped or reconfigured: PID 19121, started 07:14:26, as at the start.
- Nothing connected as the bootstrap superuser. No role was created, no server setting changed.
- No process of this row is left; every command ran in the foreground and returned. No port was
  bound (P18). No file `apps/core-server/logs/errors.log` exists: the tests that write a persistent
  error log write it into a temporary directory and remove it.
- The scratch copy used for the mutation check was removed.
- Leak check after both documents were written (11:07; a scratch script outside the repository
  takes the two project-role passwords as search patterns in its own process, through the test
  helper's reader, and prints counts only):

  ```
  ./apps/core-server/src/core: 21 file(s) scanned, 0 contain a credential value
  ./docs/.../implementation/21_core_services.md: 1 file(s) scanned, 0 contain a credential value
  ./docs/.../delegation_progress/coder_execution_step_43.md: 1 file(s) scanned, 0 contain a credential value
  ./apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts: 1 file(s) scanned, 0 contain a credential value
  ./apps/core-server/src/plugins/db/__tests__/db.test.ts: 1 file(s) scanned, 0 contain a credential value
  ./apps/core-server/test/db/boot-checks.db.test.ts: 1 file(s) scanned, 0 contain a credential value
  <scratchpad>: 1162 file(s) scanned, 0 contain a credential value
  total: 1188 file(s), 0 contain a credential value; patterns: 2
  ```

  This paragraph was added after that scan; it holds counts and paths only.

## 20. Rollback (R-NEW; not executed)

`src/core/` is this row's folder. Before this row it held one file, the scaffold's stub; everything
is untracked at `acaff20`, so the pre-image patch of P23 (`.cache/rollback/W21.pre.patch`) is empty
and copies were saved instead.

```sh
# from /Users/gsp-budi/Documents/DEMS
rm -rf apps/core-server/src/core
mkdir -p apps/core-server/src/core
cp .cache/rollback/W21.core-index.ts.pre          apps/core-server/src/core/index.ts
cp .cache/rollback/W21.readiness.test.ts.pre      apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts
cp .cache/rollback/W21.db.test.ts.pre             apps/core-server/src/plugins/db/__tests__/db.test.ts
cp .cache/rollback/W21.boot-checks.db.test.ts.pre apps/core-server/test/db/boot-checks.db.test.ts
```

Valid while no later row has built on the seams (W24, W26, W28, W32 and every module row do). If
another row has edited one of the three test files since (the readiness test is a multi-writer
path by D52), do not copy its pre-image: put back the lines of section 13 by hand. After the
rollback the stub's three assertions pass again, the boot has the one step B-1, and nothing can
append an audit row at run time.

## 21. Verification list of the row

| Check | Result | Section |
|---|---|---|
| `DEMS_TEST_STEP=43 npm run test:db -w @dems/core-server -- src/core` exits 0 | Yes: 4 files, 39 tests | 11.1 |
| 50 concurrent appends give a chain that `verifyAuditChain` accepts over all rows | Yes, twice (one pipeline; ten connections) | 11.2 |
| A writer that skips the lock is refused with SQLSTATE `ZA001` | Yes, three ways | 11.2, 11.3 |
| Every `at` follows the injected clock | Yes | 11.3 |
| `npm run test -w @dems/core-server -- --maxWorkers=2` passes | Yes: 41 files, 1,281 tests | 11.4 |
| The whole `db` project passes (controller's note) | Yes: 27 files, 382 tests | 11.4 |
| `npm run typecheck -w @dems/core-server`, `npm run lint -w @dems/core-server` | Exit 0, exit 0 | 11.4 |
| No leftover database of this run; `.locks/postgres.pid` unchanged | Yes: 0; 19121 | 19 |
| Test ledger with this row's files by name | Yes | 12 |
| The edited lines of other rows' tests, by file and line | Yes | 13 |
| One mapping: imports and what is held locally, line by line | Yes | 9 |
| No credential in this document | Yes: the tests' markers and example forms are made up | — |

Not verified by this row: a server started through `src/index.ts` with the boot checks (the backend
gate, W58, runs that path first); the engine host on the pipeline (W26); a COMMIT that hangs (F-6);
two server processes on one database beyond what the ten-connection test shows.

---
*Generated: 2026-10-04 11:05 WIB*
*Last Updated: 2026-10-04 11:09 WIB*
