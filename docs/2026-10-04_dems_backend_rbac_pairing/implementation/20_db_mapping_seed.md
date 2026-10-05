---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 42
plan_row: W20
title: Slice-to-table mapping, seed program, first build of dems_demo
date: 2026-10-04
agent: database-specialist (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
source_contract: masterplan/03_database_contract.md rev 2.2 (contract revision dbc-2)
evidence_tier: 3
status: complete for everything this row owns; two whole-project commands are red in one test each that belongs to rows running at the same time (section 8.3)
---

# W20: the slice-to-table mapping, the seed program, and the first build of `dems_demo`

All times are WIB (UTC+7) on 2026-10-04. Every command ran from `/Users/gsp-budi/Documents/DEMS`;
no command changed the session directory. Commands that open a database connection, and every
`npm run db:*` process run, ran with the per-command sandbox bypass (P10; finding F-6). Quoted
runner output is unchanged except that long lines are cut where marked and Vitest's pass mark is
written `[pass]`. **No password, pairing code or other credential value appears in this document.**
The one hash value quoted (16 digits of an audit chain head) is an integrity value, not a secret.

## 1. Result

| Item | Result |
|---|---|
| Row command `DEMS_TEST_STEP=42 npm run test:db -w @dems/core-server -- src/db/seed src/db/mapping` | **Exit 0**: 4 files, 58 tests, 0 failed (10:37:44; section 8.1) |
| `fromRows(toRows(state))` equals the durable slices | **Yes, strictly** (`toStrictEqual`): idle at the fixed instant, the three other scenarios, eight other instants times four scenarios, and three driven journeys (recording, stopping, finalizing, sealed, export, verify, archive; fault, recovery, incomplete close, new session; a ring that dropped rows). One tolerated difference, asserted: a negative zero becomes zero (finding F-2) |
| The same against PostgreSQL | **Yes**: the rows read back from a seeded database as `dems_app` equal the durable slices, for all four scenarios and after a 21-step write-through journey applied as `dems_app` (section 8.2) |
| ST-1 to ST-6 | Pass (section 8.2) |
| Row counts of contract §9.4 | **All 30 confirmed by running, none corrected**: 82 audit rows, 59 events (section 6) |
| Matrix (AC-B-17) | The stored grants equal the shared `ROLE_PERMISSIONS`: 4, 10, 4 |
| Audit chain of a seeded database | Every row re-hashed with the shared `chainHash`; `verifyAuditChain` ok over all 82 rows; boot check B-8 with the shared digest check passed in: `digests: 'ok'` |
| Boot checks B-2 to B-9 on a seeded database, as `dems_app` | Pass, on clones and on `dems_demo` |
| A second seed | Refused, exit 1, nothing written; also when two seeds run at the same time |
| `audit_chain_history` after a first seed | Empty; no session, no paired device, no pairing code, no biometric token |
| **`dems_demo`** | **Built at 10:28:34**: `db:create`, `db:migrate`, `db:seed`, `db:status` each **exit 0**; 301 rows in 21 of 30 tables; owner `dems_owner` (section 9) |
| Seed time | 80 ms on `dems_demo` (dataset, mapping and three Argon2id derivations 42 ms; the transaction 33 ms) |
| Seed dump and server log (AC-B-28) | 0 occurrences of the demo password and of the pairing code constant (section 8.5) |
| `npm run typecheck -w @dems/core-server`, `npm run lint -w @dems/core-server` | Exit 0, exit 0 (0 warnings); root `npm run typecheck` exit 0 |
| Whole `unit` project | Exit 1: 1,275 of 1,276 pass (10:45:26). The one failure is a scaffold test that the core-services row in flight breaks, not a file of this row (section 8.3) |
| Whole `db` project | Exit 1: 377 of 378 pass. The one failure is a migration-row test, for the same reason (section 8.3) |
| `SCHEMA-GAP` | None |
| `CONTRACT-DEVIATION` | Two, both inside this row's folders and both within what the contract wants (section 10) |
| PostgreSQL | Never stopped or reconfigured: PID 19121, started 07:14:26, before and after |

## 2. What was written

28 files, 6,189 lines, all under the two owned paths. Nothing else in the repository was edited:
not the schema, the migrations, the commands, the helper, `app.ts`, a plugin, a module, a
`package.json`, or anything under `packages/`.

| Path under `apps/core-server/src/db/` | Lines | Content |
|---|--:|---|
| `mapping/index.ts` | 102 | The public surface of the mapping |
| `mapping/slices.ts` | 145 | The 28 durable slices (13 stored, 15 snapshot), the 5 that are not mapped and why, with a compile-time proof that every slice of `SimState` is one or the other |
| `mapping/rows.ts` | 694 | One row builder and one way back per entity; the rule for absent optional members |
| `mapping/to-rows.ts` | 187 | `toRows(state, context)`, the write order, `assertCompleteRings` |
| `mapping/from-rows.ts` | 143 | `fromRows(rows)`: order (MR-3), rings (MR-4), the evidence join (MR-5) |
| `mapping/changes.ts` | 411 | `diffSlices`, `diffStored`, `diffSnapshot`, `newAuditRows`, `newEvents`: change detection for the write-through (MR-6, MR-7, MR-8) |
| `mapping/guards.ts` | 105 | `MappingError`; MR-9; text and number guards |
| `mapping/exports.ts` | 68 | Export records derived from audit rows (SD-7) |
| `mapping/rbac.ts` | 46 | Roles, permissions and grants from the shared vocabulary (SD-5) |
| `mapping/health-snapshot.ts` | 51 | The health snapshot row (one direction) |
| `mapping/audit-verify.ts` | 45 | The shared digest check over stored rows: the parameter of boot check B-8 |
| `seed/seed.ts` | 331 | `prepareSeed`, `writeSeed`, `seedDatabase`, `SeedError` |
| `seed/dataset.ts` | 62 | The shared dataset as of one instant (SD-2) |
| `seed/store.ts` | 404 | The statements: `writeRows`, `insertRows`, `readStoredRows`, `applyChanges`, `lockAuditChain`, `countAllTables` |
| `seed/cli.ts` | 105 | `db:seed` (the entry file D27 names) |
| `seed/index.ts` | 43 | The public surface of the seed folder |
| `seed/__tests__/template-hook.seed.ts` | 23 | The hook of `tpl_seed` (the helper's plug-in point) |
| `seed/__tests__/support.ts` | 328 | Test support: a headless engine host, the wire form, dumps, checksums |
| `mapping/__tests__/*.test.ts` (4 files) | 1,450 | Project `unit` (section 13) |
| `seed/__tests__/*.test.ts` (2 files) | 347 | Project `unit` |
| `seed/__tests__/*.db.test.ts` (4 files) | 1,099 | Project `db` |

The mapping folder is pure: it imports the shared simulator, `node:util` and its own files at run
time, and the typed schema for its row TYPES only (a static test asserts all of this). The database
side of the mapping (`store.ts`) is in the seed folder, because rule 2 of the delegation keeps
database access out of the mapping.

## 3. The mapping

### 3.1 Slice, table, direction notes, lossless test

`R` = `mapping/__tests__/round-trip.test.ts` (no database); `D` = `seed/__tests__/seed.db.test.ts`
and `write-through.db.test.ts` (PostgreSQL, read back as `dems_app`); `S` = the per-slice test of
`to-rows.test.ts` ("the slice reaches the rows ... and it comes back").

| # | Slice (class) | Table(s) | To rows | Back | Tests |
|--:|---|---|---|---|---|
| 1 | `meta` (S) | `core_state` (seed, sim schema version, scenario, epoch, created) and `engine_counters` (one row per counter) | `seeded_at`, `last_reset_at`, `updated_at` come from the context, not from the state. `export` has no row until the first export | Counters rebuilt in the shared order; a missing counter or another sim schema version is refused | R, D, S |
| 2 | `device` (S) | `core_device` | 5 columns and the 14 members of `identity`; `certificate_fingerprint` is the one stored member of the `pairing` slice | `identity` rebuilt | R, D, S |
| 3 | `operators` (S, server-native) | `operators` | Identity fields and `role` to `role_id`; `enabled = true`, no sign-in, no role change (SD-4). Written by the seed and the reset only | Sorted by `id` (MR-3); never `enabled`, never a hash | R, D, S |
| 4 | `session` (S) | `active_session` (0 or 1 row) | `input` flattened to 7 columns; six JSON columns passed by reference | A NULL time source is read back as an ABSENT member (section 3.4) | R, D, S |
| 5, 6 | `lastSealedSessionId`, `lastSealedAcknowledged` (S) | `core_state` | Two columns | Direct | R, D, S |
| 7 | `sessionHistory` (S) | `session_history` | `evidenceId` is not a column (MR-5) | `ORDER BY ended_at DESC, id DESC`; `evidenceId` joined from `evidence_items.session_id` | R, D, S |
| 8 | `storagePolicy` (S) | `storage_policy` | 3 columns | Direct | R, D, S |
| 9 | `evidence` (S) | `evidence_items`, `evidence_tracks`, `evidence_custody` | `signature` to 4 columns, `verification` to 2; tracks get `position` 1 to 4, custody entries `seq` 1 to n; `created_at`, `updated_at` from the context | `ORDER BY recorded_at, id`; tracks by `position`; custody by `seq` | R, D, S |
| 10 | `events` (S) | `events` | `category` derived with the shared `eventCategory` | Newest 500 by `seq` (MR-4); `category` dropped | R, D, S |
| 11 | `alerts` (S) | `alerts` | Direct | Newest 100 by `at, id` | R, D, S |
| 12 | `audit` (S) | `audit_log`; `audit_chain_head` (derived, never written by a program); `exports` (derived, section 3.5) | Rows exactly as the shared chain built them: `seq`, `prev_hash`, `hash` copied | Newest 1,000 by `seq`; `total` and `head` from the chain head; `dropped = total - rows kept` | R, D, S |
| 13 | `settings` (S) | `console_settings` | 4 columns | Direct | R, D, S |
| 14 to 28 | `tabletLink`, `activeCameraId`, `cameras`, `mics`, `storage`, `time`, `network`, `security`, `services`, `health`, `otherDevices`, `ports`, `faults`, `diagnostics`, `update` (SN) | `hardware_snapshot`, one column each (`time` is `time_status`, `update` is `software_update`) | The slice by reference; `diagnostics` null is SQL NULL (J-4); `written_at` from the context | The column | R, D, S |

Tables the mapping writes that hold no slice: `exports` (derived from audit rows) and, one way only,
`health_snapshots` (`healthSnapshotToRow`). Tables the seed writes beside the mapping:
`roles`, `permissions`, `role_permissions` (`rbacRows()`), `operator_credentials`,
`registry_counters`.

### 3.2 What is not mapped, and why (spec §3.1, §3.2)

| Slice | Class | Why it is not stored |
|---|---|---|
| `clock` | E | The server clock; rebuilt at start |
| `audio` | X | 20 Hz meter frames are streamed, never written (Q4) |
| `authLockout` | M | The lockout counters live in the server's own limiter, in memory |
| `auth` | S, server-native | A sign-in is a row of `auth_sessions`, written by the identity module. The engine's `auth` slice is only the actor scope of one command |
| `pairing` | S, server-native | Devices and codes are the pairing module's four tables. One member is stored: the Core's certificate fingerprint, in `core_device` |

13 + 15 + 5 = 33. `slices.ts` proves at compile time that the three lists together are exactly the
keys of `SimState` and that no key is in two lists. Tests: changing `clock`, `auth`, `authLockout`
or `audio` changes no row; of `pairing` only the fingerprint does.

### 3.3 The mapping rules of the contract

| Rule | How it is met | Test |
|---|---|---|
| MR-1 one mapping | `toRows`, `fromRows` and `diffSlices` are built from the same row builders (`rows.ts`). The seed uses `toRows`; the reset will; the engine host will use `diffSlices` and `fromRows` | Section 8.2 |
| MR-2 absent member | Stored as NULL; read back in the empty form the shared code itself uses for that member (section 3.4) | `to-rows.test.ts` "an absent optional member" |
| MR-3 order | `fromRows` sorts its input itself (operators by `id`; history by `ended_at DESC, id DESC`; evidence by `recorded_at, id`; tracks by `position`; custody by `seq`; alerts by `at, id`; audit and events by `seq`), so the result does not depend on the order of the rows. `readStoredRows` also asks PostgreSQL for that order | Round trip through rows in a scrambled order |
| MR-4 rings | The newest 1,000, 500 and 100 are kept; `total`, `head` from the chain head; `dropped = total - kept` | A two-hour headless recording: 1,000 of more than 1,100 rows |
| MR-5 `evidenceId` | Joined from `evidence_items.session_id` | Every round trip (13 history entries; an incomplete session) |
| MR-6 parents first | `WRITE_ORDER`; `diffSlices` returns its changes in that order | `changes.test.ts` (the seal step), `seed-order.test.ts` |
| MR-7 rows above the head | `newAuditRows`: only rows with `seq` above the last written total; an altered ring row is never written | Unit and database tests with the `AUDIT_TAMPER` demo fault |
| MR-8 changed and writable columns only | An UPDATE of `diffSlices` names the changed columns and the row time; a change of a column the runtime role may not update throws (`IMMUTABLE_CHANGED`, `NOT_WRITABLE`) instead of being skipped | 14 refusal cases; the journey applied as `dems_app` |
| MR-9 safe integers | `safeInteger` before every integer column | `to-rows.test.ts` |

### 3.4 What "lossless" means exactly

`fromRows(toRows(state))` is compared with `toStrictEqual`: an absent member must stay absent, a
null must stay null, no member may appear. Two things needed a decision.

**The empty form of an optional member.** A nullable column cannot tell "absent" from "null". The
shared code uses exactly one of the two for each member, so NULL is read back as that one:

| Member | Empty form in the shared code | NULL reads back as |
|---|---|---|
| `ActiveSession.startTimeSource`, `.stopTimeSource` | Absent until the recording starts or stops (`session-machine.ts:658, 706, 926`); never null | **Absent** (CONTRACT-DEVIATION-1) |
| `SessionHistoryEntry.startTimeSource`, `.endTimeSource` | null (`session-machine.ts:805-806`) | null |
| `EvidenceItem.startTimeSource`, `.endTimeSource`, `.tamperedTrackId` | null (`evidence.ts:244, 249-250`) | null |
| `EvidenceItem.caseType`, `.integritySource` | Always set | Absent (the type has no null) |
| `EvidenceItem.markers`, `.notes` | Always set (an empty list) | An empty list (the column is NOT NULL) |
| `SimAlert.target` | null (`faults.ts:158-170`) | null |
| `SimAlert.params` | Always set | Absent (the type has no null) |
| `meta.counters.export` | Absent until the first export | Absent (no row) |

With this table every state the shared code builds comes back unchanged. A state that held the
other form (a snapshot from before those members existed) would come back in the form of the table;
the shared code reads all of them with `?? null` or `?? []`, so it behaves the same.

**Negative zero.** JSON has one zero, so a `-0` inside a JSON column comes back as `0`. The shared
code produces `-0` in one kind of value, a rounded clock offset (`offsetMs`): in the back-filled
time history of the dataset at some instants, and in the details of a `TIMESTAMP_CONFIRMED` audit
row of a running engine. Evidence (a scratch run, 200 simulated minutes of recording):
`$.time.history[].offsetMs: seen in 40 minute samples`, `$.audit.rows[].details.offsetMs: seen in
232 minute samples`, `canonicalJSON equal after the JSON round trip: true; hash still matches:
true`. The shared canonical form writes `-0` as `0`, so such an audit row still verifies after it
was stored (tested directly). The dataset of `dems_demo` holds two (section 9.3). The tests compare
against the state with `-0` written as `0` and assert that nothing else differs.

### 3.5 What the mapping refuses

The mapping is lossless or it throws a `MappingError` (code, place; never a value of the row).

| Code | When | Why not silently |
|---|---|---|
| `NOT_SAFE_INTEGER` | A value for an integer column is not a safe integer (MR-9) | `bigint` is read back as a JavaScript number |
| `NOT_FINITE` | A number inside a JSON value is NaN or infinite | JSON would store `null` |
| `TEXT_NOT_STORABLE` | A text holds U+0000 or a lone surrogate | PostgreSQL has no U+0000, and the driver would send U+FFFD for a lone surrogate. For an audit row the stored text would then no longer hash to the stored `hash`, and an audit row can never be corrected. Nothing is sanitised; a well-formed astral character is stored as it is |
| `RING_INCOMPLETE` | A whole-state write of a ring that already dropped rows; or more new rows than the ring still holds | The tables keep every row |
| `IMMUTABLE_CHANGED`, `NOT_WRITABLE` | The diff meets a change the runtime role cannot write (a sealed evidence column, a track, a custody entry, a history entry, the seed or scenario of the state, the device name) | Skipping it would let the tables drift from the engine without a sign |
| `EXPORT_NOT_STORABLE` | An accepted export without operator, reason or destination (finding F-9) | The table requires them; an export without a record is worse than a refused unit of work |
| `ROW_SHAPE` | Rows that do not form a state (no `core_state` row, a head that disagrees with the newest row, another sim schema version) | Rehydration must not invent a state |

## 4. The API for the engine host (W26) and the reset routine (W29)

```ts
import {
  toRows, fromRows, pickDurable,                    // whole state <-> rows
  diffSlices, diffStored, diffSnapshot,              // change detection
  newAuditRows, newEvents,                           // the new rows in the SHARED shape
  healthSnapshotToRow, operatorFromRow,              // one-way and single-entity helpers
  verifyStoredAuditRows,                             // the parameter of boot check B-8
  RING_LIMITS, RUNTIME_UPDATABLE_COLUMNS, WRITE_ORDER, MappingError,
  type DurableSlices, type MappedRows, type StoredRows, type RowChange, type RowContext,
} from '<...>/src/db/mapping';
import {
  readStoredRows, applyChanges, writeRows, insertRows, lockAuditChain, countAllTables,
  prepareSeed, writeSeed, seedDatabase, SeedError, StoreError,
  type RowExecutor, type PreparedSeed, type SeedOptions,
} from '<...>/src/db/seed';
```

| Function | Signature | Use |
|---|---|---|
| `toRows` | `(state: MappableState, context: { at, seededAt, lastResetAt }) => MappedRows` | A whole state as full rows of 16 tables and the chain head it implies. `context` supplies the bookkeeping instants; nothing reads a clock |
| `fromRows` | `(rows: StoredRows) => DurableSlices` | The 28 durable slices. Rows may come in any order |
| `diffSlices` | `(previous: DurableSlices, next: DurableSlices, at: number) => RowChange[]` | The inserts, updates and the one possible delete between two states, in write order |
| `diffStored`, `diffSnapshot` | the same arguments | The two halves: records at once, the snapshot row at most once a second |
| `newAuditRows`, `newEvents` | `(previous, next) => AuditRow[] / SimEvent[]` | The same new rows as the diff inserts, in the shared shape, for a writer that takes shared rows |
| `readStoredRows` | `(executor, { rings?: 'newest' \| 'all' }) => Promise<StoredRows>` | The rows `fromRows` needs, rings limited to 1,000, 500, 100 |
| `applyChanges` | `(executor, changes, { expectedHead? }) => Promise<void>` | Applies a change list; takes the chain lock first when it holds audit rows; checks AP-6; an UPDATE must hit exactly one row |
| `prepareSeed`, `writeSeed` | `(options, deps?) => Promise<PreparedSeed>`; `(executor, prepared) => Promise<void>` | The seed in two halves, for the reset routine's own transaction (R-5 b) |
| `seedDatabase` | `(ownerPool, { now, seed?, scenario?, epoch?, lastResetAt?, target }) => Promise<SeedReport>` | The whole seed |

**Change detection inputs.** `previous` is the state the tables hold, that is the engine state at
the last successful write, held by reference; `next` is the current engine state; `at` is the server
clock instant of the write. A slice whose reference did not change costs one comparison. Because the
diff is against the last WRITTEN state, coalescing (the snapshot row once a second, the session's
progress once a second) is simply calling it less often; a test shows that one diff over ten seconds
yields the same rows as a diff per step. After a failed commit the host keeps `previous`.

**Rehydration.** `fromRows(await readStoredRows(tx))` inside one transaction, then
`store.setState(slices)`; the host then adds 1 to the epoch (the diff writes `core_state.epoch`,
which the runtime role may update). The `operators` slice is never written by the diff: the table
is the server's, mirrored into the engine with `operatorFromRow`.

**An executor** is a Drizzle database or transaction on node-postgres. No function of `store.ts`
opens, commits or rolls back anything.

**With the unit of work of the core-services row (W21, in flight; read, not edited).** Its unit takes
the chain lock in every transaction and owns the INSERTs into `audit_log` and `events`
(`unit-of-work.ts`, `isWriterOwnedInsert`). The host therefore hands `newAuditRows(previous, next)`
and `newEvents(previous, next)` to that row's writers and passes the rest of the change list
(`changes.filter((c) => c.table !== 'auditLog' && c.table !== 'events')`) to `applyChanges` on the
unit's own database object. Both paths write the event counter as an absolute value, so they agree.

## 5. The seed program

### 5.1 What it does, in order

`seedDatabase(pool, options)`:

1. The session must be `dems_owner` and not a superuser (`verifyOwnerSession` of the commands, the
   check the reset makes at R-0).
2. The database name: a project database or its staging copy `<name>_next` for `target: 'project'`;
   a `dems_test_` database for `target: 'test'` (TI-13).
3. The schema version must be the one this code writes; a database that is not migrated is refused
   with the migrate command.
4. A first look at `core_state`: an already seeded database is refused before any password
   derivation.
5. `prepareSeed`: `createIdleState({ now, seed })`, `buildScenarioState` for the three other
   scenarios (SD-2), the epoch set, `assertCompleteRings`, `toRows`, `rbacRows()`, and one
   `hashPassword` per operator. No transaction is open yet.
6. **One transaction** (`writeSeed`), READ COMMITTED:
   `SELECT seq, hash FROM public.audit_chain_lock()`; the binding "not seeded yet" check (no
   `core_state` row and the chain at its genesis); then the tables in the order of contract §9.5:
   `roles`, `permissions`, `role_permissions`, `operators`, `operator_credentials`, `core_device`,
   `core_state`, `storage_policy`, `console_settings`, `engine_counters`, `registry_counters`,
   `hardware_snapshot`, `session_history`, `evidence_items`, `evidence_tracks`, `evidence_custody`,
   `exports`, `active_session` and `alerts` (scenarios only), `audit_log` in ascending `seq`,
   `events`; then a read of `audit_chain_head`, which must be the dataset's own head.
7. After the commit: the row counts of all 30 tables, for the report.

`seed-order.test.ts` records the statements of `writeSeed` against a stand-in executor and asserts
exactly this order: the lock first, 19 tables for `idle`, 82 single-row INSERTs into `audit_log`
with `seq` 1 to 82, 299 rows in total, nothing written to `audit_chain_history`,
`audit_chain_head`, `schema_meta` or the five identity and pairing tables.

### 5.2 How the audit chain is seeded under the guards

Exactly as the contract says (SD-6, AP-2 to AP-4), and with no exception to the guards:

- The 82 rows are written as the shared replay built them. `seq`, `prev_hash` and `hash` are
  copied; **nothing is hashed again**. Test ST-2 recomputes every stored hash with the shared
  `chainHash` and finds it equal, and the stored head equals `createIdleState(now).audit.head`.
- The transaction takes the chain lock, then issues **one INSERT per row, in ascending sequence**.
  The guard trigger `audit_log_chain_guard` fires for the owner as for every role: it accepts each
  row because the row continues the head, and moves the head. A bulk INSERT was not needed and is
  not used (the trigger would fire in no fixed order, AP-4).
- `audit_chain_head` is never written by the seed. After the last row it is read and must equal
  the dataset's head (`seq` 82 and the hash); otherwise the transaction fails (`VERIFY_FAILED`).
- No trigger is touched, no row is updated, no session setting is changed. `audit_chain_history`
  is not written: a first seed discards nothing (LN-1).

### 5.3 Idempotence

A seeded database is refused with `ALREADY_SEEDED`: by the first look (step 4), and again inside
the transaction under the chain lock. So two seeds of one database at the same time queue at the
lock; the second sees a chain that is not at its genesis and writes nothing (tested: exactly one of
two concurrent seeds writes; the database then holds one whole dataset). A partial second seed is
impossible: everything is one transaction, and the append-only trigger would refuse an in-place
rewrite in any case. Seeding again is a reset (`db:reset`, W29).

### 5.4 The demo password (SD-4, SR-63)

The published demo password is read by import (`DEMO_OPERATOR_PASSWORD`) in one file,
`seed/seed.ts`, and passed to `hashPassword`, once per operator, and to nothing else. What reaches a
statement is the Argon2id record (algorithm, three cost parameters, a 16-byte salt, a 32-byte
hash) as bind parameters. A static test asserts that the constant is named by exactly that file, in
exactly two lines (the import and the call), that its VALUE occurs in no file of the two folders,
and that no seed file renders a salt or a hash as text or passes one to an output line. A failed
INSERT into `operator_credentials` is reported as "the statement was refused" with no detail,
because the query builder's own error message would quote the parameters. Test: the stored record
verifies the constant for each of the three operators, and a changed value does not.

### 5.5 `db:seed`

```
npm run db:seed -w @dems/core-server -- --database <dems_demo|dems_lane_1|dems_lane_2|dems_lane_3>
```

It uses the frame of the migration row's commands (`runCommand`, the owner connection, the name
guard), so it accepts the same four names and nothing else, runs as `dems_owner`, and takes no
secret as an argument. It reads the clock **once** (an injectable `clock` option; the default is the
real clock) and passes the instant down (DR-1). `--database` is required, as for `db:create`,
`db:migrate` and `db:status` (plan §3.4: "each takes `-- --database <name>`"); there is no default
database, by the same rule that a command takes its database from `--database` only.

| Exit code | When |
|--:|---|
| 0 | Seeded |
| 1 | Not seeded: the database does not exist, is not migrated, **is already seeded**, or a write failed |
| 2 | A wrong call: usage, a refused name. Nothing is read and no connection is opened |

Real process runs with wrong calls (10:27, outside the sandbox, no connection opened):

```
$ npm run db:seed -w @dems/core-server --
db:seed: usage: npm run db:seed -w @dems/core-server -- --database <dems_demo|dems_lane_1|dems_lane_2|dems_lane_3>
exit=2
$ npm run db:seed -w @dems/core-server -- --database postgres
db:seed: refused before any connection: the database name is not one of dems_demo, dems_lane_1, dems_lane_2, dems_lane_3. Test databases are reachable only through the test helper.
exit=2
$ npm run db:seed -- --database dems_demo --scenario recording
db:seed: usage: npm run db:seed -w @dems/core-server -- --database <dems_demo|dems_lane_1|dems_lane_2|dems_lane_3>
unexpected argument.
exit=2
$ npm run db:seed -- --database=dems_lane_9
db:seed: refused before any connection: ... (the same line)
exit=2
```

The scenario is not an argument of `db:seed` (the contract gives `--scenario` to `db:reset`); the
function `seedDatabase` takes it, and the reset routine and the tests use it.

### 5.6 The template hook

`src/db/seed/__tests__/template-hook.seed.ts` exports `templateHook`, which runs
`seedDatabase(pool, { now: 2026-10-01 10:00 WIB, scenario: 'idle', target: 'test' })`. From now on
every `test:db` run builds `tpl_seed`: `built in 125 to 334 ms (create 40 to 118 ms, hook 82 to
214 ms)`, the higher figures under load. A test asks for it with
`useTestDatabase({ template: 'seed' })`.

## 6. Row counts: expected (contract §9.4) versus actual

Actual = `ST-1` on a clone of `tpl_seed` (fixed instant) and `db:seed` / `db:status` on `dems_demo`
(the instant of the build). Both give the same 30 numbers.

| Table | Expected | Actual | |
|---|--:|--:|---|
| `operators` | 3 | 3 | confirmed |
| `operator_credentials` | 3 | 3 | confirmed |
| `roles` | 3 | 3 | confirmed |
| `permissions` | 12 | 12 | confirmed |
| `role_permissions` | 18 | 18 | confirmed (4 + 10 + 4) |
| `core_device` | 1 | 1 | confirmed |
| `core_state`, `storage_policy`, `console_settings`, `hardware_snapshot` | 1 each | 1 each | confirmed |
| `engine_counters` | 5 | 5 | confirmed: `event` 60, `session` 24, `caseNumber` 8, `evidence` 14, `item` 1; no `export` row |
| `registry_counters` | 2 | 2 | confirmed: `device` 1, `pairingCode` 1 |
| `session_history` | 13 | 13 | confirmed |
| `evidence_items` | 13 | 13 | confirmed |
| `evidence_tracks` | 52 | 52 | confirmed |
| `evidence_custody` | 28 | 28 | confirmed |
| `exports` | 1 | 1 | confirmed: `EXP-000031`, scope `EVIDENCE`, evidence suffix 0004, operator `OPR-002` |
| **`audit_log`** | **82** | **82** | **confirmed by running**, and equal to `createIdleState(now).audit.total` |
| `audit_chain_head` | 1 (with `seq` 82) | 1 (`seq` 82) | confirmed |
| **`events`** | **59** | **59** | **confirmed by running**, and equal to `createIdleState(now).events.length` |
| `active_session`, `alerts`, `health_snapshots` | 0 | 0 | confirmed |
| `auth_sessions`, `pairing_codes`, `paired_devices`, `device_credentials`, `biometric_tokens` | 0 | 0 | confirmed |
| `audit_chain_history` | 0 | 0 | confirmed |
| `schema_meta` | 1 | 1 | confirmed (`1`, `dbc-2`) |

30 tables: 21 with rows, 9 empty; 301 rows, of which the seed writes 299 (the row of
`audit_chain_head` and the row of `schema_meta` are written by the migrations). **No number of the
contract had to be corrected.** The counts that the research derived by reading (3 operators,
3 roles, 1 Core device, 13 items with 52 tracks, 4 scenarios, 82 audit rows, 59 events) are all
confirmed by running. For the three other scenarios, also by running: `recording` 218 audit rows and
80 events, `finalizing` 231 and 83, `fault-demo` 229 and 85 with 3 alerts; one `active_session` row
each.

## 7. The seed clock rule and the frozen demo packages (ST-5)

`seed-clock.db.test.ts` seeds a migrated clone one day after the fixed instant and compares it with
a clone of `tpl_seed`.

| Statement | Result |
|---|---|
| Identifiers carry the later date (DR-2) | Evidence dates `20260929, 20260930, 20261001` become `20260930, 20261001, 20261002`; case numbers move with them |
| `matchDemoPackage` joins all 13 items on both days, from the four stored columns (DR-3) | 13 of 13 on both days; another subject, case sequence or evidence suffix joins nothing |
| `integrity_source` is `DEMO_PACKAGE` 13 times; the stored manifest and track hashes ARE the frozen package values on both days (DR-4) | Equal to `DEMO_PACKAGE_INTEGRITY`, item by item and track by track. No package or media path is stored |
| The database seeded a day later is the dataset of that day | `fromRows(rows read back)` equals `createIdleState(later)` |
| **The two seeds differ only where the date rule says** | Not at all: `roles`, `permissions`, `role_permissions`, both counter tables, `schema_meta` (equal checksums); policy, settings, device and operators apart from the row time. By exactly one day and one calendar date: every row of `session_history`, `evidence_items`, `evidence_tracks`, `evidence_custody`, `exports`, `events`, and every column of `audit_log` except the two hashes (each row of day one, with its times plus 86,400,000 ms and the dated identifiers in its texts moved one day, EQUALS the row of day two). Different: every audit hash and the head (DR-2); each chain verifies. Hardware snapshot: the same shape, its times one day on, the 24-hour usage curve equal; the back-filled chart values are a function of the absolute time and are other numbers |
| Two seeds with the same `now` (contract §9.6) | Equal checksums on 26 tables; `operator_credentials` differs (three fresh salts per seed) |

On `dems_demo` (seeded 2026-10-04 10:28 WIB) the evidence IDs run from `EV-20261002-0001` to
`EV-20261004-0013`, and all 13 join their package (section 9.3).

## 8. Verification

### 8.1 The row command (10:37:44)

```
$ DEMS_TEST_STEP=42 npm run test:db -w @dems/core-server -- src/db/seed src/db/mapping
> vitest run --project db src/db/seed src/db/mapping
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_42_tmd62w7y_
[test:db] stale sweep: dropped 0; kept 0 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
[test:db] template dems_test_step_42_tmd62w7y_tpl_schema: built in 145 ms (create 54 ms, hook 88 ms)
[test:db] template dems_test_step_42_tmd62w7y_tpl_seed: built in 220 ms (create 78 ms, hook 141 ms)
 Test Files  4 passed (4)
      Tests  58 passed (58)
   Start at  10:37:44
   Duration  5.63s (tests 71%, import 21%, transform 8%)
[test:db] teardown: dropped 3 database(s) in 92 ms; 0 remain with the run prefix dems_test_step_42_tmd62w7y_
exit=0
```

The same command passed at 10:32:22 and 10:38:05 (4 files, 58 tests, exit 0). The pure tests of the
two folders, which carry the `fromRows(toRows(state))` statement without a database (10:37:30):

```
$ npm run test -w @dems/core-server -- --maxWorkers=2 src/db/mapping src/db/seed
 Test Files  6 passed (6)
      Tests  169 passed (169)
unit exit=0
```

### 8.2 ST-1 to ST-6 and the other required tests

Quotes are from the verbose run of 10:32:31 (`--reporter=verbose --silent=false`, 58 pass marks).

| Required | Test (file under `src/db/seed/__tests__/` unless stated) | Result |
|---|---|---|
| ST-1 row counts | `seed.db.test.ts` "all 30 tables hold what the contract states: 21 with rows, 9 empty" | `[w20] ST-1 row counts of dems_test_step_42_tmd5u7ks_f02_seed:` followed by the 30 lines of section 6 |
| ST-2 chain | "every audit row read back hashes to its stored hash, and verifyAuditChain is ok over all 82 rows"; "boot check B-8, as the runtime role, with the shared digest check passed in: ok over all rows" | `{ ok: true, rowsChecked: 82, firstSeq: 1, lastSeq: 82, linkBreaks: 0, digests: 'ok', lineage: 'none', problems: [] }`; a forged row is reported as `HASH_MISMATCH at sequence 30` |
| ST-3 member by member | "the 82 audit rows"; "the 59 events"; "every durable slice: fromRows of the rows read from PostgreSQL equals the durable slices of createIdleState"; "the stored rows are the rows toRows gives, column by column" | Equal (`toStrictEqual`) |
| ST-4, AC-B-17 | "3 roles and 12 permissions in declaration order, 18 grants (4, 10, 4), role by role equal" | Equal to `ROLE_PERMISSIONS`; the runtime role reads the same matrix and cannot insert a grant (`42501`) |
| ST-5 | `seed-clock.db.test.ts` (12 tests) | Section 7 |
| ST-6, AC-B-28, AC-B-65 | "holds neither the demo password nor the pairing code constant; counts only are reported"; "holds no person name beyond the operators and subjects of the shared dataset, and no e-mail address" | Section 8.5 |
| Boot checks B-2 to B-9 | "the seeded database passes the boot checks" (7 blocking checks as `dems_app`; B-8 above; B-6 fails on a migrated, not seeded clone) | Pass |
| A second seed is refused | "refuses a seeded database with ALREADY_SEEDED, and every table keeps its checksum"; "refuses under the chain lock too"; "two seeds of one database at the same time"; `cli.db.test.ts` "a second run exits 1" | Refused; no password derivation happens; 26 table checksums and the three credential rows unchanged |
| Operators and credentials | "each has one Argon2id record at the current parameters, a 16-byte salt of its own and a 32-byte hash"; "the stored record verifies the published demo password and nothing else" | `argon2id`, 19,456 KiB, 2 passes, parallelism 1; three distinct salts and hashes |
| The seed runs as the owner only | "the runtime role is refused before anything is read" | `OWNER_ROLE_REFUSED` |
| Scenarios against PostgreSQL | `write-through.db.test.ts` "recording / finalizing / fault-demo: the rows read back are the scenario state, and the boot checks pass" | `[w20] scenario recording: audit 218 rows, events 80, session RECORDING; seed 128 ms (transaction 63 ms)`; `finalizing: audit 231 rows, events 83`; `fault-demo: audit 229 rows, events 85` |
| The driven journey against PostgreSQL, **as `dems_app`** | "the whole journey: every change is a statement dems_app may issue, and the rows read back are the engine state" | `[w20] write-through journey as dems_app: 21 units of work, 238 audit rows, 96 events`; after it: 14 history entries, 14 items, 56 tracks, 4 export records (`EVIDENCE`, `EVIDENCE`, `AUDIT`, `LOGS`), 6 counters, the stored chain verified over all rows |
| MR-7 against the table | "the demo fault alters a ring row, and the stored row stays as it was" | The stored message is the original; the stored chain verifies; a rehydrated ring has no altered row |
| AP-6, rollback | "a head that is not the one the engine committed last stops the unit of work"; "a refused statement rolls the whole unit of work back" | `AUDIT_HEAD_DIVERGED`; `42501` for a sealed column; `ZA001` for a gap row; all checksums unchanged |

The journey's first unit of work, as the test printed it: `1 s of recording:
{"hardwareSnapshot":{"inserted":0,"updated":1,"deleted":0},"activeSession":{"inserted":0,"updated":1,"deleted":0}}`;
the unit test asserts that this session write names exactly `bytesWritten` and `updatedAt`.

Can the tests fail? No mutation run was made on the sources: the hook of `tpl_seed` is live for every
row that tests at the same time, so a deliberately broken seed would have broken their runs. Instead
the tests carry their own controls: 19 single-column changes of stored rows each change what
`fromRows` returns; a forged audit row, a gap and a wrong head are each reported; a subject or case
that does not match joins no package; another instant gives other checksums; the static patterns
find a planted clock, statement and driver import; the dump search finds a value that is there.
During development the tests did fail for real reasons: the negative zero in an audit detail
(finding F-2) was found by the failing ring test, and a wrong row total (293 written in a test,
301 in the database) by the command test. The absent `stopTimeSource` (CONTRACT-DEVIATION-1) was
found earlier, by a scratch script that listed the members of each scenario state.

### 8.3 The whole projects, and noise from a row in flight (P11)

| Command | Time | Result |
|---|---|---|
| `npm run test -w @dems/core-server -- --maxWorkers=2` | 09:51:12 (before this row wrote a file) | exit 0: 31 files, 985 tests |
| the same | 10:25:58 | exit 1: `1 failed \| 1157 passed (1158)` |
| the same | 10:33:03 | exit 1: `1 failed \| 1259 passed (1260)` |
| the same | 10:39:02 | exit 1: `1 failed \| 1274 passed (1275)` |
| the same | 10:45:26 (the last run of this row) | exit 1: `Test Files 1 failed \| 40 passed (41)`; `Tests 1 failed \| 1275 passed (1276)` |
| `DEMS_TEST_STEP=42 npm run test:db -w @dems/core-server -- --maxWorkers=2` | 09:51:25 (before) | exit 0: 19 files, 285 tests |
| the same | 10:26:26 | exit 1: `1 failed \| 377 passed (378)` |
| the same | 10:34:00 | exit 1: `Test Files 1 failed \| 25 passed (26)`; `Tests 1 failed \| 377 passed (378)` |

The two failures, the same in every run:

```
FAIL |unit| src/plugins/db/__tests__/db.test.ts > boot step B-1 > passes when the database answers and sets the flag
  Caused by: BootCheckError: B-2: the server reports version number NaN; PostgreSQL 18 is expected.
   > Object.run src/core/boot-checks.ts:99:11
FAIL |db| test/db/boot-checks.db.test.ts > T-PV-3 ... > a migrated and seeded clone with the runtime pool: every blocking check passes, in order
  AssertionError: expected [ 'B-1', 'B-2', 'B-3', 'B-4', ...(12) ] to deeply equal [ 'B-1', 'B-2', 'B-3', 'B-4', ...(4) ]
```

Cause, established by reading: the core-services row (W21), which runs at the same time, now
registers the boot checks B-2 to B-9 in the app itself (`src/core/boot-checks.ts`,
`registerBootChecks`, written 10:12). The scaffold's test boots an app on a stand-in pool that
cannot answer B-2; the migration row's test adds the same checks itself and now sees them twice.
Neither test, and none of the three files involved, is in this row's paths, and no file of this row
is on either stack. Both are the pattern of decision D52 (the row that fills a seam adapts the
assertion that pinned the stub). **Every one of this row's 227 tests passes in each of these runs.**
The static guards (`test/static/*.test.ts`) pass with this row's files present. The helper's own
`nested-run.db.test.ts` passes.

### 8.4 Typecheck and lint

```
$ npm run typecheck -w @dems/core-server      exit=0   (10:45:18, the final tree; and after every change before)
$ npm run lint -w @dems/core-server           exit=0, no warning (10:45:22)
$ npm run typecheck   (root, five workspaces)  exit=0   (10:34:39)
```

### 8.5 The seed dump and the server log (AC-B-28, AC-B-65)

The dump of the criterion is taken from a CLONE (the file's clone of `tpl_seed`), not from
`dems_demo`: every row of each of the 30 tables as `to_jsonb(row)` text, hash columns included
(`bytea` as hexadecimal). The test reads the two constants by import into variables and prints
counts only:

```
[w20] ST-6 dump of dems_test_step_42_tmd5u7ks_f02_seed: 140738 characters, 331 lines; occurrences
{"password":0,"passwordLowerCase":0,"passwordAsHex":0,"passwordAsBase64":0,"pairingCodeStandalone":0};
the pairing code as a substring of longer digit runs: 0
```

331 lines = 301 rows and 30 table headers. The search is not vacuous: the dump holds the three
credential rows with `"algorithm": "argon2id"` and their salt and hash columns, and the helper finds
an operator's username. The pairing code is six digits; it is searched as a value of its own (not
inside a longer run of hexadecimal digits), and its raw substring count is reported beside it.

AC-B-65: every `subject_name` is one of the 13 of the shared dataset, every operator name is one of
the three shared operators, every person named in an audit or event message is a dataset operator,
and the dump holds no e-mail address. Stronger, by ST-3: the database holds nothing but what the
shared builders made, slice by slice (SD-8). A static test asserts that no operator or subject name
is written in a production file of the two folders (SD-1).

The PostgreSQL server log, searched by a scratch script outside the repository that reads the two
constants by import and prints counts only (10:30:11):

```
server log: 4844967 bytes, 30975 lines; window from "2026-10-04 09:51:00": 729405 bytes, 4805 lines
  whole log: demo password 0; pairing code as a value of its own 0; pairing code digits inside longer hex or digit runs 0
  window: demo password 0; pairing code as a value of its own 0; pairing code digits inside longer hex or digit runs 0
apps/core-server/src/db/mapping: 15 file(s); with the demo password 0; with the pairing code as a value of its own 0
apps/core-server/src/db/seed: 13 file(s); with the demo password 0; with the pairing code as a value of its own 0
```

The window starts before this row's first database run. It also holds the lines of rows that ran at
the same time; the file has no database name per line, so they cannot be told apart. What this row's
own tests write, measured around one run of the row command (10:38:05): **7,489 bytes, 40 lines, 3
ERROR lines**, each a refusal the tests provoke on purpose (`permission denied for table
role_permissions`, `permission denied for table evidence_items`, `audit chain: row N does not
continue head N`), with placeholders in the statements, no `Failing row contains` line and no row of
`operator_credentials`. **No seed of this row ever produced a failing statement**: finding F-1 of the
migration row (a refused row is logged whole) had nothing to log. The salts and hashes that
`dems_demo` now holds were searched too: `3 credential row(s); of their 15 search patterns ... found
in the server log (5083336 bytes): 0` (10:32:17).

### 8.6 Measured seed time (this host, PostgreSQL 18.4, other rows running)

| What | Measured |
|---|---|
| `db:seed` on `dems_demo` (a real process run) | **80 ms**: dataset, mapping and three Argon2id derivations 42 ms; the transaction 33 ms |
| `seedDatabase` inside the test runs (two workers, other rows testing) | 148 and 154 ms (73 to 75 ms and 67 to 69 ms) |
| The hook of `tpl_seed` | 82 to 94 ms when quiet; up to 214 ms under load |
| A scenario seed (218 to 231 audit rows, one INSERT each) | 106 to 128 ms; the transaction 54 to 69 ms |
| A seeded database | 10,174 kB (a migrated, empty one: 9,430 kB) |
| A dump of every table | 140,738 characters |

## 9. The first build of `dems_demo` (host change H-15)

### 9.1 The four commands, under the migrate lock (10:28:34 to 10:28:35)

One `/usr/bin/lockf -k -t 60 .locks/db-migrate.lock` held for all four, with the sandbox bypass:

```
$ npm run db:create -- --database dems_demo
db:create: created dems_demo (owner dems_owner, encoding UTF8, locale C) on PostgreSQL 18.4 as dems_owner.
db:create: next: npm run db:migrate -w @dems/core-server -- --database dems_demo
exit=0
$ npm run db:migrate -- --database dems_demo
db:migrate: dems_demo is migrated under the migrate lock: this command must be run as "/usr/bin/lockf -k .locks/db-migrate.lock npm run db:migrate ...".
db:migrate: dems_demo on PostgreSQL 18.4 as dems_owner
db:migrate: schema version before: none (not migrated)
db:migrate: applied 4 migration(s): 0000_prelude, 0001_tables, 0002_audit_guards, 0003_privileges
db:migrate: schema version after: 1 (dbc-2)
exit=0
$ npm run db:seed -- --database dems_demo
db:seed: dems_demo is seeded under the migrate lock: this command must be run as "/usr/bin/lockf -k .locks/db-migrate.lock npm run db:seed ...".
db:seed: dems_demo on PostgreSQL 18.4 as dems_owner
db:seed: dataset as of 2026-10-04T03:28:35.448Z (1791084515448); scenario idle; seed 20261001; epoch 0
db:seed: seeded in 80 ms (dataset and hashes 42 ms, transaction 33 ms); the database now holds 301 row(s) in 21 of 30 table(s)
row counts       30 table(s)
  active_session           0
  alerts                   0
  audit_chain_head         1
  audit_chain_history      0
  audit_log                82
  auth_sessions            0
  biometric_tokens         0
  console_settings         1
  core_device              1
  core_state               1
  device_credentials       0
  engine_counters          5
  events                   59
  evidence_custody         28
  evidence_items           13
  evidence_tracks          52
  exports                  1
  hardware_snapshot        1
  health_snapshots         0
  operator_credentials     3
  operators                3
  paired_devices           0
  pairing_codes            0
  permissions              12
  registry_counters        2
  role_permissions         18
  roles                    3
  schema_meta              1
  session_history          13
  storage_policy           1
audit head       seq 82; hash 22eb48f72bb6ffea...
db:seed: OK: dems_demo is seeded. State: npm run db:status -w @dems/core-server -- --database dems_demo
exit=0
$ npm run db:status -- --database dems_demo
database         dems_demo on PostgreSQL 18.4
owner            dems_owner; encoding UTF8; locale C
schema version   1; contract revision dbc-2; this code expects 1 (dbc-2)
migrations       4 file(s); ledger matches
  0000_prelude         applied  file sha256 ca4c6e03...603a0b  stored ca4c6e03...603a0b      (the four lines print the full, equal hashes)
  0001_tables          applied  file sha256 46b6bcbe...9224e9  stored 46b6bcbe...9224e9
  0002_audit_guards    applied  file sha256 35429449...a9cf41  stored 35429449...a9cf41
  0003_privileges      applied  file sha256 7a054fd4...0871d4  stored 7a054fd4...0871d4
seeded_at        2026-10-04T03:28:35.448Z (1791084515448)
last_reset_at    never
audit head       seq 82; hash 22eb48f72bb6ffea...
audit triggers   audit_chain_history_append_only=A, audit_log_append_only=A, audit_log_chain_guard=A
lineage          0 row(s)
row counts       30 table(s)
  ... the same 30 lines as above
db:status: OK: dems_demo is at the schema version this code expects and the ledger matches the files.
exit=0
lockf exit=0
```

`2026-10-04T03:28:35.448Z` is 10:28:35 WIB: the dataset is as of the server clock of the seed.

### 9.2 A second run of each, with the exit code read directly (10:28:46)

Each command under its own `/usr/bin/lockf -k -t 60 .locks/db-migrate.lock`, output to a file, the
exit code taken from the process:

```
$ ... npm run db:create -- --database dems_demo   -> exit=0
db:create: dems_demo already exists (owner dems_owner, encoding UTF8, locale C); nothing to do.
$ ... npm run db:migrate -- --database dems_demo  -> exit=0
db:migrate: schema version before: 1 (dbc-2)
db:migrate: no pending migration; nothing was applied.
db:migrate: schema version after: 1 (dbc-2)
$ ... npm run db:seed -- --database dems_demo     -> exit=1
db:seed: the database dems_demo is already seeded (seeded_at 2026-10-04T03:28:35.448Z). Nothing was written. Seeding again is a reset.
db:seed: to rebuild the dataset: npm run db:reset -w @dems/core-server -- --database dems_demo
db:seed: NOT SEEDED (ALREADY_SEEDED).
$ ... npm run db:status -- --database dems_demo   -> exit=0
seeded_at        2026-10-04T03:28:35.448Z (1791084515448)
audit head       seq 82; hash 22eb48f72bb6ffea...
db:status: OK: dems_demo is at the schema version this code expects and the ledger matches the files.
```

The refused second seed changed nothing: the same `seeded_at`, the same head, the same counts.

### 9.3 What `dems_demo` holds, read as the runtime role (10:29:33, repeated 10:38:24)

A read-only scratch script outside the repository: the server's own configuration loader (port 4420
gives `dems_demo` as `dems_app`), the boot checks, `readStoredRows` and `fromRows`; and an owner
connection for the catalog. No test connects to `dems_demo` (TI-17).

```
runtime configuration: database dems_demo as dems_app on 127.0.0.1:4432 (listen port 4420)
runtime session: role=dems_app database=dems_demo
  B-2 pass: server version and encoding
  B-3 pass: schema version
  B-4 pass: the runtime role is not privileged
  B-5 pass: the audit table and the lineage table are protected
  B-6 pass: the database is seeded
  B-7 pass: the chain head agrees with the table
  B-9 pass: the owner role is not a superuser and owns the guarded objects
  B-8 (reported): {"ok":true,"rowsChecked":82,"firstSeq":1,"lastSeq":82,"linkBreaks":0,"digests":"ok","lineage":"none","problems":[]}
rehydration as dems_app: fromRows(rows of dems_demo) equals the durable slices of createIdleState(now = seeded_at 1791084515448): true (negative zeros in that dataset: 2 at $.time.history[73].offsetMs, $.time.history[93].offsetMs)
  audit rows 82 (shared function: 82); events 59 (shared function: 59); chain head seq 82 hash equal to the shared head: true
  shared verifyAuditChain over the rows read back: {"ok":true,"checked":82,"head":"22eb48f72bb6ffea..."}
  evidence: 13 items, ids EV-20261002-0001 .. EV-20261004-0013; matchDemoPackage joins 13; integrity_source DEMO_PACKAGE: 13
  grants: INVESTIGATOR 4, SUPERVISOR 10, TECHNICIAN 4; equal to the shared ROLE_PERMISSIONS: true
owner view: dems_demo owner=dems_owner size=10166 kB; 5 function(s) owned by dems_owner; 30 table(s) owned by dems_owner
operator_credentials: {"n":"3","salts":"3","salt_bytes":16,"hash_bytes":32,"algorithm":"argon2id","memory_kib":19456,"passes":2,"parallelism":1}
empty after a first seed: {"lineage":"0","sessions":"0","devices":"0","codes":"0","tokens":"0"}
```

`dems_demo` is left in place, seeded, owned by `dems_owner`. The mapping sources changed once after
the build (two helpers were split out of the diff, 10:36); the seed path was not touched, and the
check above was repeated at 10:38:24 with the final code, with the same result.

## 10. Schema gaps and contract deviations

**`SCHEMA-GAP`: none.** Every slice member has a column or is derived; the runtime role's grants
were enough for every statement of the write-through journey.

| ID | What | Evidence | Why it still satisfies the contract |
|---|---|---|---|
| CONTRACT-DEVIATION-1 | **MR-2, for two members.** MR-2 says an absent optional member is "rehydrated as `null`". For `ActiveSession.startTimeSource` and `.stopTimeSource` the mapping rehydrates NULL as ABSENT | The shared session machine never sets these two to null; it leaves them out until the recording starts and stops (`session-machine.ts:658, 706, 926`). The state of scenario `recording` has no `stopTimeSource` key (seen by running), so `null` would change the state on its way through the database, and `fromRows(toRows(state))` would not equal the durable slices. For the members the shared code does set to null (history entries, evidence items, the alert target) NULL is read as null, as MR-2 says (section 3.4) | The shared code reads both members with `?? null`, the reason MR-2 gives; behaviour is the same. One table in `rows.ts` holds the rule; changing it back is two lines |
| CONTRACT-DEVIATION-2 | **§9.5, the place of the chain lock.** §9.5 takes "the chain lock and `audit_log`" after the other tables. The seed takes the lock as its FIRST statement | `seed-order.test.ts`: `lock audit_chain_head`, `select core_state`, `insert roles`, ... | The order of the TABLES is §9.5's, unchanged. AP-2 and AP-7 ask for the lock first; §9.5 only explains why later is safe on a database nothing else reaches. First is stricter, and it is what makes two concurrent seeds queue and the second be refused with nothing written (tested) |

Two wording notes on the contract, no deviation: §9.3 row 34 lists `hardware_snapshot.faults,
.diagnostics (NULL)`; only `diagnostics` is NULL at a seed, `faults` is the object `{ "active": [] }`
(the column is NOT NULL). §9.4 says "The table above covers all 30 tables: 21 with at least one row
and 9 empty": confirmed.

## 11. Findings

| ID | Finding | Evidence |
|---|---|---|
| F-1 | Every row count of contract §9.4 is confirmed by running; none corrected. 301 rows, 299 written by the seed | Section 6 |
| F-2 | **Negative zero.** The shared code produces `-0` in rounded clock offsets (`time.history[].offsetMs`; `details.offsetMs` of `TIMESTAMP_CONFIRMED` audit rows). A JSON column stores `0`. It costs nothing (`-0 === 0`; the shared canonical form hashes `-0` as `0`, so the audit row verifies), but a comparison with `Object.is` semantics (`toEqual`, `isDeepStrictEqual`) sees it. The engine host's test "a rehydrated engine equals the state before the stop" must compare with that tolerance (`withoutNegativeZeros` in `seed/__tests__/support.ts`) | Section 3.4; `dems_demo` holds two |
| F-3 | The active session's two time-source members are absent, not null, until set | CONTRACT-DEVIATION-1 |
| F-4 | `createSim({ scenario })` at an instant starts in exactly the state `buildScenarioState(name, createIdleState({ now, seed }))`: a database seeded with a scenario IS the engine's start state for it | The journey test's first assertion |
| F-5 | The `recording`, `finalizing` and `fault-demo` scenario states do not share a prefix of audit rows: each scenario has its own random stream, so their chains differ from early on. One cannot be used as "the state before" another | A test of this row failed on that assumption and was rewritten on a driven engine |
| F-6 | **Every `npm run db:*` process run needs the sandbox bypass, also a wrong call that opens no connection**: the `tsx` launcher creates an IPC pipe under the temp folder, and the sandbox refuses the `listen` (`Error: listen EPERM: operation not permitted .../tsx-501/57291.pipe`). `node --import tsx <file>` does not create the pipe and runs inside the sandbox | A run at 10:27 inside the sandbox: exit 1 before the program started |
| F-7 | One `unit` test and one `db` test of other rows are red since the core-services row registers the boot checks in the app | Section 8.3 |
| F-8 | **A second mapping of audit rows exists in the tree.** The core-services row (in flight) wrote its own `AuditLogRow` to `AuditRow` function and its own digest check (`src/core/boot-checks.ts`: `sharedAuditRowOf`, `verifyStoredDigests`), and binds the 14 audit columns and the 10 event columns itself (`audit-writer.ts`, `event-writer.ts`). It could not import this row's module, which did not exist yet. MR-1 says "no second mapping exists" | Read at 10:35; not edited |
| F-9 | An audit-log or log-bundle export without a reason cannot become a row of `exports` (the table's CHECK). The shared `exportAudit()` allows a call without a request; the mapping refuses such a row (`EXPORT_NOT_STORABLE`) rather than drop the record | `evidence-actions.ts:267-300`; `to-rows.test.ts` |
| F-10 | The published demo constants also sit in scratch copies of repository files that other rows left in the session scratchpad (a mutation copy of the workspace). They are the same published values the repository's own sources hold; none is in a file of this row | A name-only scan at 10:31 |
| F-11 | The hook file of `tpl_seed` existed for about one minute (10:08 to 10:09) before the seed had run once; it was then moved out until the seed was proven on a private template (10:10:21) and put back at 10:10:28. A `test:db` run of another row in that minute would have built `tpl_seed` with the same code that passed unchanged afterwards | This row's own log |
| F-12 | One run of this row's database tests adds about 7.5 kB and 40 lines to `.data/postgres.log` (3 deliberate refusals, checkpoint lines of dropped databases). The file is not rotated | Section 8.5 |
| F-13 | `db:status` exits 0 on the seeded `dems_demo` and prints the 30 counts; W58, W86 and W90 can compare with section 6 | Section 9 |

## 12. Decisions for the controller to record

| ID | Question | Recommendation |
|---|---|---|
| DN-1 | CONTRACT-DEVIATION-1: NULL of the active session's two time sources is read back as "absent" | Accept, and reword MR-2: "rehydrated in the empty form the shared code uses for that member (`null`, or absent for the two time sources of the active session)" |
| DN-2 | CONTRACT-DEVIATION-2: the seed takes the chain lock first | Accept; §9.5's last sentence becomes "the lock is the first statement, as for every writer" |
| DN-3 | F-2: `-0` becomes `0` in JSON columns | Accept as the meaning of "the wire form" (J-3), and tell W26 and W53 to compare rehydrated states with that tolerance |
| DN-4 | The mapping refuses what PostgreSQL cannot store exactly (U+0000, a lone surrogate, a non-finite number) instead of storing a changed value | Accept. With the simulator's text cut fixed (the row for SIM-GAP-1) and the string rule of the contract registry on every input, the refusal is a backstop; without it a lone surrogate in an audit message would break the stored chain for good |
| DN-5 | F-8: two mappings of audit rows and events | After the core-services row returns: either its writers and its boot-check code call `auditRowToRow`, `eventToRow`, `auditRowFromRow` and `verifyStoredAuditRows` of `src/db/mapping`, or the code review W38 records the two as equivalent and a test pins it. The first is MR-1 as written |
| DN-6 | F-7: who adapts the two red tests | The core-services row (the D52 pattern): the scaffold's `db.test.ts` boot test and the migration row's T-PV-3 test both pinned "the app registers no boot check yet" |
| DN-7 | F-9: an export always needs a reason and a destination in Live mode | Contract C makes `reason` required for `exportAuditLog` and `exportLogs` (the specification already asks for at least 5 characters), and the module supplies the default destination |
| DN-8 | `db:seed` has no default database and no `--scenario` | Accept: the same argument form as the three commands of W17; a scenario is `db:reset --scenario` (W29) |
| DN-9 | F-6: record that `db:*` process runs need the bypass because of the launcher, not only because of the database | Add to P10 |
| DN-10 | The database side of the mapping (`store.ts`) lives in `src/db/seed/` | Accept, or let the engine host row move `readStoredRows` and `applyChanges` under `src/engine/` when it lands; the pure mapping stays where it is |
| DN-11 | `masterplan/02_plan.md` was not edited by this row (a shared file in a parallel run) | The controller updates the tracking row of W20 |

## 13. Test ledger (P24)

`@dems/core-server` only. No existing test was changed.

| Project | Before this row (09:51) | After (unit 10:45:26, db 10:34:00) | This row |
|---|---|---|---|
| `unit` | 31 files, 985 tests, 0 failed | 41 files, 1,276 tests: 1,275 passed, 1 failed (section 8.3, not a file of this row) | **6 files, 169 tests**, all passing. The other 4 files and 122 tests were added by rows that ran at the same time |
| `db` | 19 files, 285 tests, 0 failed | 26 files, 378 tests: 377 passed, 1 failed (section 8.3, not a file of this row) | **4 files, 58 tests**, all passing. The other 3 files and 35 tests were added by rows that ran at the same time |

| Project | File under `apps/core-server/src/db/` | Tests |
|---|---|--:|
| `unit` | `mapping/__tests__/round-trip.test.ts` | 41 |
| `unit` | `mapping/__tests__/to-rows.test.ts` | 60 |
| `unit` | `mapping/__tests__/changes.test.ts` | 25 |
| `unit` | `mapping/__tests__/static.test.ts` | 9 |
| `unit` | `seed/__tests__/cli.test.ts` | 25 |
| `unit` | `seed/__tests__/seed-order.test.ts` | 9 |
| `db` | `seed/__tests__/seed.db.test.ts` | 32 |
| `db` | `seed/__tests__/seed-clock.db.test.ts` | 12 |
| `db` | `seed/__tests__/write-through.db.test.ts` | 9 |
| `db` | `seed/__tests__/cli.db.test.ts` | 5 |

## 14. End state and cleanup (10:38:24)

```
session: role=dems_owner database=postgres server=18.4 endpoint=127.0.0.1/32:4432
pg_database:
  dems_demo  owner=dems_owner  template=false  encoding=UTF8  locale=C  size=10174 kB
  postgres  owner=dems_admin  template=false  encoding=UTF8  locale=C  size=7782 kB
  template0  owner=dems_admin  template=true  encoding=UTF8  locale=C  size=7782 kB
  template1  owner=dems_admin  template=true  encoding=UTF8  locale=C  size=7846 kB
databases with a prefix of this row (dems_test_step_42*): 0
test databases of other runs in flight: 0
project roles: dems_admin(super=true,createdb=true) dems_app(super=false,createdb=false) dems_owner(super=false,createdb=true)
roles that are not built in: 3
pg_db_role_setting rows: 0
postmaster start time: 2026-10-04 07:14:26.046351+07
logging settings: log_error_verbosity=default log_min_duration_statement=-1 log_parameter_max_length_on_error=0 log_statement=none
$ cat .locks/postgres.pid
19121
```

- `pg_database` lists `dems_demo` and nothing of this row besides it. Before the build (10:27:31)
  it held `postgres`, `template0` and `template1` only.
- No role was created; no server setting was changed. PostgreSQL was never stopped: PID 19121,
  started 07:14:26, as at 09:51. `.locks/postgres.pid` and `.locks/db-migrate.lock` are unchanged
  (the lock file existed, 0 bytes, 09:31).
- Nothing connected as the bootstrap superuser; nothing read its password file. The other
  PostgreSQL of this host (port 5432) was never connected to: every connection of this row went
  through the project's owner connection or runtime configuration, which refuse that port.
- No process of this row is left. Every command ran in the foreground and returned, except one:
  a scratch scan over the whole session scratchpad (file names only) ran longer than 60 s, was
  moved to the background by the tool, and was stopped by this row at 10:46 (PID 60117 and its
  shell 60110; `pgrep` then found none). Scratch scripts are in the session scratchpad, outside
  the repository. An empty folder `.cache/w20` that a first command created by mistake was removed at
  once. No `.vitest` folder was created (the two JSON reports went to the scratchpad).
- Leak check after both documents were written: section 17.

## 15. Rollback (R-NEW and H-15; not executed)

```sh
cd /Users/gsp-budi/Documents/DEMS
# H-15: remove the project database. As dems_owner, on the maintenance database "postgres" of
# 127.0.0.1:4432, with no session on dems_demo (stop the Core server first):
#     DROP DATABASE dems_demo;
# No command of the project issues that statement outside the reset routine (W29) and the test
# helper; until W29 lands it is typed by hand in a client that reads the owner connection file.
# `npm run pg:remove-data` (W90) removes the whole cluster with it.
# R-NEW: every file of this row is new and untracked.
git clean -fd -- apps/core-server/src/db/mapping apps/core-server/src/db/seed
```

Afterwards `tpl_seed` is "not built" again (its hook is gone), `db:seed` has no entry file, and
`db:status -- --database dems_demo` reports that the database does not exist. Rows that import
`src/db/mapping` or `src/db/seed` (W21 if it adopts DN-5, W25, W26, W29) no longer compile.

## 16. Not done, and not verified by this row

- The reset (`db:reset`, the lane databases, a seed inside the reset's transaction): W29. `prepareSeed`
  and `writeSeed` are written for it and tested, but not inside a reset.
- The engine host: W26. `diffSlices`, `applyChanges` and `readStoredRows` are proven with a headless
  engine and a manual clock in tests, not inside the server's pipeline, its scheduler or its
  unit of work.
- Mutation testing of the sources (section 8.2 says why, and what stands in for it).
- A seed in the first hours after midnight WIB against PostgreSQL: the mapping is tested at 00:10,
  02:00 and 06:59 WIB without a database; the database tests use 10:00 WIB.
- The stored chain of a database older than 1,000 audit rows at a server start: B-8 over the newest
  1,000 is tested here with up to 238 rows; the ring logic above 1,000 is tested without a database.
- Whether the web console and the mobile app show the seeded data: the client rows.

## 17. Verification list of the row

| Check | Result | Section |
|---|---|---|
| `DEMS_TEST_STEP=42 npm run test:db -w @dems/core-server -- src/db/seed src/db/mapping` exits 0 | Yes: 4 files, 58 tests | 8.1 |
| ST-1 to ST-6 | Pass | 8.2, 7 |
| `fromRows(toRows(state))` equals the durable slices | Yes: idle, every scenario, the driven journey; without and with PostgreSQL | 3.4, 8.2 |
| `db:create`, `db:migrate`, `db:seed`, `db:status` for `dems_demo` exit 0, with the counts of §9.4 | Yes; 82 audit rows and 59 events confirmed | 9.1, 6 |
| The seeded matrix equals `ROLE_PERMISSIONS` (AC-B-17) | Yes | 8.2 |
| The chain of the seeded database verifies with the shared digest check through B-8 | Yes, over all rows | 8.2, 9.3 |
| The seeded database passes boot checks B-2 to B-9 | Yes, on clones and on `dems_demo` | 8.2, 9.3 |
| A second seed is refused | Yes: exit 1, nothing written | 5.3, 9.2 |
| Two instants: rows differ only where the date rule says | Yes | 7 |
| The demo evidence join resolves for every item that has a package | 13 of 13, on three days | 7, 9.3 |
| The seed dump and the server log hold neither constant | 0 and 0 | 8.5 |
| `npm run test -w @dems/core-server -- --maxWorkers=2` | **Exit 1: one failing test of another row** (1,275 of 1,276 pass; this row's 169 pass; the static guards pass) | 8.3 |
| `npm run typecheck -w @dems/core-server`, `npm run lint -w @dems/core-server` | Exit 0, exit 0 | 8.4 |
| `pg_database` lists `dems_demo` and no leftover; `.locks/postgres.pid` unchanged | Yes | 14 |
| Test ledger | `unit` 31 / 985 before, 41 / 1,276 after; `db` 19 / 285 before, 26 / 378 after; this row's 10 files by name | 13 |
| Leak check | The two folders, both documents and the scratch files of this row: 0 files with either constant | below |

Leak check, with both documents on disk (10:44:34 and 10:44:48; two scratch scripts outside the
repository, counts only). The first reads the two published demo constants by import. The second
takes the connection passwords of the two project roles as search patterns inside its own process,
through the project's own loaders, and prints neither. The scratch files are the ones this row
wrote, given by name (scripts, the verbose test log, two JSON reports, four command outputs):

```
apps/core-server/src/db/mapping: 15 file(s); with the demo password 0; with the pairing code 0
apps/core-server/src/db/seed: 13 file(s); with the demo password 0; with the pairing code 0
docs/2026-10-04_dems_backend_rbac_pairing/implementation/20_db_mapping_seed.md: 1 file(s); with the demo password 0; with the pairing code 0
docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/database_specialist_step_42.md: 1 file(s); with the demo password 0; with the pairing code 0
<scratchpad>/... 16 files of this row, one line each: with the demo password 0; with the pairing code 0
total: 46 file(s); 0 hold a constant

47 file(s) scanned; 0 contain a connection credential; patterns: 2, each at least 24 characters
```

Both scans were repeated at 10:47:17, with both documents on disk and this paragraph in place, over 47
files (the second scratch script included), with the same result: 0 and 0. The only edit after that
corrected the time in this sentence and in the footer.

---
*Generated: 2026-10-04 10:46 WIB*
*Last Updated: 2026-10-04 10:47 WIB*
