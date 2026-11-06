---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 51
plan_row: W29
title: Reset and carry-over routine (HB-3), db:reset, and the three lane databases
date: 2026-10-04
agent: database-specialist (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
source_contract: masterplan/03_database_contract.md rev 2.2 (contract revision dbc-2), section 8.5
evidence_tier: 3
status: complete for everything this row owns; the whole `db` project is red in four tests of three files that belong to rows running at the same time (section 13.4); follow-up of 12:45 to 13:02 in section 21 (one test defect and one defect of the routine, both fixed; whole `unit` and whole `db` exit 0)
---

# W29: the reset and carry-over routine, `db:reset`, and the lane databases

All times are WIB (UTC+7) on 2026-10-04. Every command ran from `/Users/gsp-budi/Documents/DEMS`;
no command changed the session directory. Commands that open a database connection, and every
`npm run db:*` process run, ran with the per-command sandbox bypass (P10): inside the sandbox the
`tsx` launcher cannot create its pipe (`listen EPERM`, observed at 10:58) and `test:db` cannot
reach the server (`POSTGRES_UNREACHABLE`, observed at 10:59). Quoted runner output is unchanged
except that long lines are cut where marked. **No password, token, pairing code or other
credential value appears in this document.** The hash values quoted are heads of audit chains:
integrity values, not secrets (contract §4.30, NL-8).

Evidence files are in `implementation/assets/`, each named `29_*`.

## 1. Result

| Item | Result |
|---|---|
| Row command `DEMS_TEST_STEP=51 npm run test:db -w @dems/core-server -- src/db/reset` | **Exit 0**: 4 files, 69 tests, 0 failed (11:41:18; section 13.1). T-RS-1 to T-RS-6 are all in it |
| After two resets `audit_chain_history` holds two rows and the first is byte-equal before and after the second | **Yes** (T-RS-1; the row is quoted in section 6) |
| The sessions the routine opens | **`dems_owner` only**, at most two at a time, none after R-9 (T-RS-5; quoted in section 3.3) |
| A stubbed superuser answer | **Stops with `RESET_ROLE_PRIVILEGED` before R-1; the one statement sent is the check itself** (T-RS-4, seven answers; section 4) |
| Eight kept tables carried over unchanged | **Byte-equal**, by a record dump and by the contract's checksum, after one and after two resets; a `bigint` beyond 2^53 kept its last digit; 1,200 rows cross in chunks (section 5) |
| The lineage row | Holds the head hash, row count, first and last sequence and epoch that the test read from the old database before the reset (section 6) |
| An ACTIVE pairing code | Written `CANCELLED`, closed at the reset's instant by the resetting operator (NULL from the command line), **no audit row** (section 5.3) |
| The epoch | Continues: previous plus 1 at each of three resets in a row (0, 1, 2, 3) |
| Everything else | Equals a fresh seed for the same instant and epoch, table for table (16 tables as a whole; `operators` apart from the last sign-in; the audit log and the events up to the one `SCENARIO_LOADED` row) |
| A failure before the swap | Leaves the target untouched: same database (OID), same content digest of all 30 tables, nothing left behind. Forced at **all 15 checkpoints** before the swap, and provoked for real at R-0, R-1, R-2, R-3, R-4, R-5, R-6, R-7 (section 4) |
| What the routine sends | Recorded statement by statement on a real reset: four database statements, all on `<t>_next` / `<t>_prev` / the swap; no UPDATE, DELETE or TRUNCATE of `audit_log` or `audit_chain_history`; three databases connected to (section 3.2) |
| **`dems_lane_1`, `dems_lane_2`, `dems_lane_3`** | **Created at 11:36:42 to 11:36:43** by `db:reset` under `.locks/db-migrate.lock`, each **exit 0**; `db:status` of each: exit 0, owner `dems_owner`, the seed counts (301 rows in 21 of 30 tables), lineage 0 (section 9) |
| `dems_demo` | **Not reset, not connected to by the routine.** `db:status` at 10:58:44 and at 11:44:24: the same 45 lines (section 10) |
| `npm run typecheck -w @dems/core-server`, `npm run lint -w @dems/core-server` | Exit 0, exit 0 (11:41:06). The two lint warnings are in files of other rows |
| Whole `unit` project | Exit 0: 51 files, 1,541 tests (11:45:02). This row: 6 files, 157 tests |
| Whole `db` project | Exit 1: 468 of 472 pass (11:45:21). The 4 failures are in 3 files of rows in flight, none of this row; at 11:34:33, before those rows' edits, the whole project was green (32 files, 470 tests) |
| `SCHEMA-GAP` | None |
| `CONTRACT-DEVIATION` | Three, all inside this row's folder and within what the contract wants (section 12.2) |
| PostgreSQL | Never stopped or reconfigured: PID 19121, started 07:14:26, before and after; three roles, settings digest unchanged |
| Databases at the end | `dems_demo`, `dems_lane_1`, `dems_lane_2`, `dems_lane_3` (and PostgreSQL's own three); none with this row's prefix, no staging or previous copy |

## 2. What was written

All files are new, under `apps/core-server/src/db/reset/` (5,487 lines). Nothing else was edited:
not the schema, the migrations, the commands, the mapping, the seed, the test helper, the core,
a plugin, a module, or any `package.json` (the script `db:reset` was already wired to
`src/db/reset/cli.ts` by D27).

| File | Lines | Content |
|---|--:|---|
| `routine.ts` | 1,014 | `resetDatabase(options, internals)`: R-0 to R-9; `readSource` (R-3); `verifyBuilt` (R-6) |
| `names.ts` | 194 | `guardResetTarget`: which names a reset may touch; the four database-level statements |
| `kept-tables.ts` | 263 | The eight kept tables; the read, carry and compare of row images; the statements of R-5c to R-5e |
| `plan.ts` | 221 | Pure: the epoch, the lineage row, the `SCENARIO_LOADED` row, from what R-3 read |
| `errors.ts` | 191 | `ResetError` (code, step, `targetUntouched`); the 17 checkpoints; what may be said about a server answer |
| `cli.ts` | 213 | `db:reset --database <name> [--scenario <name>]` |
| `index.ts` | 77 | Exports, and the instructions for the server-side caller |
| `__tests__/reset.db.test.ts` | 464 | T-RS-1, T-RS-3, T-RS-5, T-RS-6 (`db`) |
| `__tests__/reset-failures.db.test.ts` | 758 | T-RS-2; the forced-failure matrix; the real failures of each step; concurrency; the statement record (`db`) |
| `__tests__/guard.db.test.ts` | 44 | T-RS-4 inside the row command; the real answers to the role question (`db`) |
| `__tests__/cli.db.test.ts` | 207 | `db:reset` end to end on test databases; no credential in any line (`db`) |
| `__tests__/guard.test.ts` | 216 | T-RS-4 and the refusals of R-0 to R-2 on stand-in pools (`unit`) |
| `__tests__/names.test.ts`, `kept-tables.test.ts`, `plan.test.ts`, `cli.test.ts`, `static.test.ts` | 175, 269, 195, 188, 158 | The pure parts and the static guards of the folder (`unit`) |
| `__tests__/support.ts`, `pools.ts`, `guard-cases.ts` | 402, 161, 77 | Test support: fixtures, dumps, a stand-in pool, a recording pool |

## 3. R-0 to R-9 as implemented

### 3.1 The connections and their role

Every statement is sent as **`dems_owner`**. The routine opens three connections in the course of
one reset, at most two at a time, each with `application_name` `dems-db-reset`:

| Connection | Database | Open during | Used for |
|---|---|---|---|
| A | `postgres` | R-0 to R-9 | The role check, the advisory lock, the catalog, `pg_stat_activity`, `CREATE`, the swap, `DROP` |
| B | `<t>` | R-3 only | One read-only transaction |
| C | `<t>_next` | R-5 and R-6 | Migrations, the build transaction, the verification |

The first statement of **each** connection is the role check of R-0. The owner connection file is
read once, at R-0, through `readOwnerConnection` of the database commands (one parser); the fields
live in a local variable of the call and are dropped in its `finally` (HC-3). The routine never
reads another credential file and never connects as `dems_app` or `dems_admin`.

### 3.2 Statement by statement

Recorded on a real reset by a pool that writes down every statement before it is sent
(`reset-failures.db.test.ts`, "what the routine sends"; a whole trace, one line per statement, is
in `assets/29_statement_trace.log`, run of 11:39:45). `<t>` is the target. The statements of the migrator (R-5a) and of
the seed (R-5b) are W17's and W20's and are summarised.

| Step | Conn. | Statement (bind parameters as `$n`) |
|---|---|---|
| before R-0 | — | No statement. The options and the name are checked; a refusal has read no file |
| R-0 | A | `SELECT rolname::text AS rolname, rolsuper FROM pg_roles WHERE rolname = current_user` (must be `dems_owner`, `false`) |
| R-0 | A | `SELECT pg_try_advisory_lock($1::int, $2::int) AS locked` with 442001 and the slot (0 `dems_demo`, 1 to 3 the lanes) |
| R-0 | A | `SELECT current_setting('server_version') AS version` |
| R-1 | — | The caller's `quiesce` hook, when one is given (the server closes its pool here) |
| R-1 | A | `SELECT datname::text AS database, usename::text AS role, count(*)::int AS sessions FROM pg_stat_activity WHERE datname = ANY($1::text[]) AND usename IS NOT NULL AND pid <> pg_backend_pid() GROUP BY 1, 2 ORDER BY 1, 2`, repeated until empty or `sessionDrainMs` (3 s) have passed. Then the clock is read, once |
| R-2 | A | `SELECT datname::text AS name, pg_get_userbyid(datdba)::text AS owner, datistemplate AS template FROM pg_database WHERE datname = ANY($1::text[])` for `<t>`, `<t>_next`, `<t>_prev` |
| R-2 | A | When they exist: `DROP DATABASE "<t>_next"`; `DROP DATABASE "<t>_prev"` (target present); or `ALTER DATABASE "<t>_prev" RENAME TO "<t>"` and stop (target missing) |
| R-3 | B | The role check; `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY` |
| R-3 | B | `SELECT to_regclass('public.schema_meta') IS NOT NULL AS present`; `SELECT schema_version, contract_revision FROM public.schema_meta` |
| R-3 | B | Seven times `SELECT to_jsonb(k)::text AS image FROM public.<table> AS k ORDER BY k."<key>"`, and for `pairing_codes` the same with `id`, `state` and the image without `state`, `closed_at`, `closed_by_operator_id` |
| R-3 | B | `SELECT (SELECT epoch::text FROM public.core_state) AS epoch, h.seq::text AS head_seq, h.hash AS head_hash, (SELECT min(seq)::text FROM public.audit_log) AS first_seq, (SELECT count(*)::text FROM public.audit_log) AS row_count, ...lineage count, max(reset_no), max(epoch)... FROM public.audit_chain_head AS h`; `COMMIT`; the connection is closed |
| R-4 | A | `CREATE DATABASE "<t>_next" OWNER dems_owner TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'` |
| R-5a | C | The role check; `applyMigrations` of W17 (the ledger check, the four files in one transaction, the ledger and version check again) |
| R-5b | C | `BEGIN`; the seed of W20 (`writeSeed`): `SELECT seq, hash FROM public.audit_chain_lock()` first, then 19 tables, 82 single-row INSERTs into `audit_log`, the events, the head check. Seeded with `now`, the scenario, `epoch` = previous + 1, `last_reset_at = now` |
| R-5c | C | `UPDATE public.registry_counters AS n SET "next_value" = c."next_value" FROM jsonb_populate_recordset(NULL::public.registry_counters, $1::jsonb) AS c WHERE n."name" = c."name"`; the same form for `console_settings` (five columns) |
| R-5c | C | `INSERT INTO public.<table> (<all columns>) SELECT c.<all columns> FROM jsonb_populate_recordset(NULL::public.<table>, $1::jsonb) AS c ORDER BY c."<key>"` for `pairing_codes`, `paired_devices`, `device_credentials`, `auth_sessions`, `biometric_tokens`, `audit_chain_history` (the carried rows, in `reset_no` order), 500 rows per statement |
| R-5d | C | `UPDATE public.pairing_codes SET state = 'CANCELLED', closed_at = $1::bigint, closed_by_operator_id = $2::text WHERE state = 'ACTIVE'` |
| R-5d | C | `UPDATE public.operators AS o SET last_sign_in_at = s.newest FROM (SELECT operator_id, max(issued_at) AS newest FROM public.auth_sessions GROUP BY operator_id) AS s WHERE o.id = s.operator_id` |
| R-5e | C | `INSERT INTO public.audit_chain_history (reset_no, epoch, head_hash, row_count, first_seq, last_seq, reset_at, actor_id, reason, scenario) VALUES ($1::bigint, ... $10::text)`, when the old audit log had a row |
| R-5f | C | Through `applyChanges` of W20: `SELECT seq, hash FROM public.audit_chain_lock()` (the head must be the seed's own, AP-6); `update "engine_counters"` (the event counter); one `insert into "audit_log"` (`SCENARIO_LOADED`); one `insert into "events"`. Then `COMMIT` |
| R-6 | C | Reads only: the eight image reads again; the state of the new database; the newest lineage row; the `SCENARIO_LOADED` row by `previousHead`; the schema version; the three triggers; `has_table_privilege('dems_app', ...)` for the eight privileges of B-5; `checkOwnerRole` (B-9); the 30 row counts. The connection is closed |
| R-7 | A | The session question of R-1 for `<t>` and `<t>_next`, until empty or the drain time has passed |
| R-7 | A | `BEGIN`; `ALTER DATABASE "<t>" RENAME TO "<t>_prev"`; `ALTER DATABASE "<t>_next" RENAME TO "<t>"`; `COMMIT` (a first build: only the second rename) |
| R-8 | A | `DROP DATABASE "<t>_prev"` |
| R-9 | A | `SELECT pg_advisory_unlock($1::int, $2::int) AS unlocked`; the connection is closed |

The test records two resets of one database. Counts of the first: 13 statements on `postgres`,
14 on `<t>`, 298 on `<t>_next` (325); the second, which also carries a lineage row, has 326.
Assertions over the first record: the database statements are exactly the four above, in that
order, the drop after the last `COMMIT`; none carries `WITH (FORCE)`; on `<t>` the verbs are
`BEGIN`, `SELECT`, `COMMIT` and nothing else; no statement is an UPDATE, DELETE or TRUNCATE of
`audit_log` or `audit_chain_history`; none ends, cancels or signals a session or changes a role.
Over the second: R-5 is one transaction (`BEGIN` at position 0, the chain lock at position 1,
`COMMIT` last), its twenty marked statements stand in the order of the contract, and after its
`COMMIT` the staging database is only read.

### 3.3 The sessions, measured (T-RS-5)

Read at every checkpoint by a second `dems_owner` connection of the test (`pg_stat_activity`,
`application_name` of the routine), verbose run of 11:41:45 (condensed: R-5c to R-5:commit read as
R-5b; the line as printed is in `assets/29_row_command_verbose.log`):

```
R-0=[] R-1=[dems_owner@postgres] R-2=[dems_owner@postgres] R-3=[dems_owner@postgres]
R-4=[dems_owner@postgres] R-5a=[dems_owner@postgres]
R-5b=[dems_owner@<t>_next, dems_owner@postgres] ... R-6=[dems_owner@<t>_next, dems_owner@postgres]
R-7=[dems_owner@postgres] R-7:rename=[dems_owner@postgres] R-8=[dems_owner@postgres] R-9=[dems_owner@postgres]
```

Roles seen on the three databases and under the routine's application name: `dems_owner` and no
other. After the call: no session of the routine, and none on `<t>`, `<t>_next`, `<t>_prev`.

### 3.4 Time

| Run | Total | R-4 create | R-5 build | R-6 verify | R-8 drop |
|---|--:|--:|--:|--:|--:|
| `dems_lane_1` to `_3`, first build, nothing else running on them | 162 to 163 ms | 27 to 28 | 118 to 119 | 7 | 0 |
| A reset of a used test database, other rows' tests running (eight resets of two runs) | 240 to 577 ms | 31 to 65 | 122 to 303 | 6 to 12 | 51 to 265 |

The drop of the old database forces a checkpoint; it is the part that varies.

## 4. The failure table, and the test for each row

`targetUntouched` is true in every `ResetError` below. "Untouched" is checked three ways after
each failure: the OID of the database behind the name is the same, the content digest of each of
the 30 tables is the same, and nothing is left (no `<t>_next`, no `<t>_prev`, no session of the
routine, the advisory lock free). Test files are in `src/db/reset/__tests__/`.

| Step | Contract: on failure | Forced (an observer throws at the checkpoint) | Real (the server or a check of the routine refuses) |
|---|---|---|---|
| before R-0 | — | — | A refused name or option: `RESET_TARGET_REFUSED` / `RESET_OPTIONS_INVALID`; no pool is asked for, not even the first checkpoint is announced (`guard.test.ts`, 7 cases; `names.test.ts`, 22 names; `cli.test.ts`, 9 names with exit 2) |
| R-0 | Refuse: nothing was touched; the owner connection is closed | `R-0`: `RESET_DATABASE_UNREACHABLE` | **T-RS-4**, 7 answers of `pg_roles` (superuser, the owner as a superuser, the runtime role, another role, no row, two rows, a flag that is not a boolean): `RESET_ROLE_PRIVILEGED`, one statement sent, R-1 not reached, the connection released and the pool ended, the code logged (`guard.test.ts`, `guard.db.test.ts`). The lock held by another session, and two resets at once: `RESET_ALREADY_RUNNING`, the quiesce hook not called (`reset-failures.db.test.ts`). The owner file missing, readable by others, or naming another role: `RESET_OWNER_CREDENTIALS`. Nothing answers: `RESET_DATABASE_UNREACHABLE` (stand-in) |
| R-1 | Reopen the pool; nothing changed | `R-1`: `RESET_QUIESCE_FAILED` | A session of `dems_app`, and one of `dems_owner`, on the target: `RESET_TARGET_IN_USE` after the drain time; the session is the same backend afterwards and still answers. A quiesce hook that throws: `RESET_QUIESCE_FAILED`. The CLI on a database in use: exit 1 (`cli.db.test.ts`) |
| R-2 | As R-1 | `R-2`: `RESET_LEFTOVER_FAILED` | A leftover `<t>_next`: dropped, the reset goes on. `<t>` missing and `<t>_prev` present: renamed back with its data, `RESET_RECOVERED_PREVIOUS`, a second run succeeds. A leftover that cannot be dropped: `RESET_LEFTOVER_FAILED` (stand-in). **A database of another owner, or a template: `RESET_TARGET_NOT_OURS`, no database statement sent (stand-in only: the real server cannot be brought to this state without a superuser)** |
| R-3 | As R-1 | `R-3`: `RESET_READ_FAILED` | A database that was never migrated, and one at schema version 2: `RESET_SCHEMA_MISMATCH`, the message names `db:migrate`, nothing was created |
| R-4 | As R-1 | `R-4`: `RESET_CREATE_FAILED` | A database of the staging name appears after R-2: `CREATE DATABASE` fails with `42P04` |
| R-5 | Drop `<t>_next`; then as R-1. The live database was not touched | `R-5a`, `R-5b`, `R-5c`, `R-5d`, `R-5e`, `R-5f`, `R-5:commit`: `RESET_BUILD_FAILED` | **T-RS-2**: a carried session names an operator the seed does not create: `23503`, `auth_sessions_operator_id_fkey`; the lineage table of `<t>` unchanged. The migrations cannot be applied. A clock behind an ACTIVE code: `23514`. An actor the seed does not create: `23503` |
| R-6 | As R-5 | `R-6`: `RESET_VERIFY_FAILED` | Seven tamperings of the staging database at the start of R-6: a carried row changed; a carried row missing; a carried counter changed; the closed code ACTIVE again; `UPDATE` on `audit_log` granted to `dems_app`; a guard trigger no longer `ENABLE ALWAYS`; another epoch. Each: `RESET_VERIFY_FAILED` with the problem named |
| R-7 | The transaction rolls back: as R-5 | `R-7`, `R-7:rename`: `RESET_SWAP_FAILED` | A `dems_app` session opened during the reset, found by the routine's check: `RESET_TARGET_IN_USE` at R-7. The same after the check: PostgreSQL refuses the rename with `55006`, the transaction is rolled back, `RESET_SWAP_FAILED`. **A connection lost while the swap commits (`targetUntouched: false`) is not provoked: it would need the server or the connection to be cut, which no row may do (P7); the code path is three lines and R-2 repairs either outcome** |
| R-8 | The reset has succeeded; the leftover is logged and removed by R-2 next time | `R-8`: the report says `previousDropped: false`, the log holds `RESET_PREVIOUS_LEFT`, the old database exists as `<t>_prev` with its old OID, the next reset removes it | A session on `<t>_prev`: the drop fails with `55006`; the same outcome; the session still answers |
| R-9 | (server part) | `R-9`: the report is returned; nothing is left open | The routine's part cannot fail visibly: the unlock and the close are best effort, and a closed session releases its lock |

The contract's second sentence for R-7 ("if DA-04 is wrong and the second of two separate renames
fails") does not apply: DA-04 holds (the two renames commit in one transaction, T-RS-1), so the
renames are never separate.

## 5. The kept tables

### 5.1 The list

`kept-tables.ts`, in the carry-over order of R-5c. Keys and column lists come from the typed
schema (`kept-tables.test.ts` holds them against the primary keys).

| # | Table | How | Key |
|--:|---|---|---|
| 1 | `registry_counters` | UPDATE of the two seeded rows | `name` |
| 2 | `console_settings` | UPDATE of the one seeded row | `singleton` |
| 3 | `pairing_codes` | INSERT | `id` |
| 4 | `paired_devices` | INSERT | `id` |
| 5 | `device_credentials` | INSERT | `device_id` |
| 6 | `auth_sessions` | INSERT | `id` |
| 7 | `biometric_tokens` | INSERT | `id` |
| 8 | `audit_chain_history` | INSERT of the carried rows; then one more (R-5e) | `reset_no` |

Continued scalar: `core_state.epoch`.

### 5.2 How a row crosses, unchanged

The two databases are not linked, so a row travels through the routine's process, as text that
only PostgreSQL reads and writes: `to_jsonb(row)::text` in the old database, and
`jsonb_populate_recordset(NULL::public.<table>, $1::jsonb)` in the new one, with `$1` the images
joined into a JSON array. The routine never parses an image and never turns a value into a
JavaScript number. R-6 then reads the images back from the new database and compares them with the
carried ones, text for text, before anything is swapped.

Proof in the tests, independent of that mechanism (a dump of `t::text`, the composite output, in
key order; and the checksum of contract §9.6):

```
[w29] kept tables, rows and checksum before = after the first reset: registry_counters 2 3f418618ba1f74b3d2ff2c2c82caa027;
console_settings 1 a81bddfd8671e78ed26275bde826199e; paired_devices 2 b024afc7f7453ed10611a3a8f2711eac;
device_credentials 2 acf9443180f330a912dddcf52c9f04e3; auth_sessions 3 97db93e62c975d8b497e2b49b940de52;
biometric_tokens 3 5476744440d7a4e52343bab7c7eb96ac
```

- After the **second** reset all seven tables of revision 1, `pairing_codes` included (no code was
  ACTIVE any more), have the dumps and checksums they had after the first.
- A session row holds `absolute_expires_at = 9007199254740993` (2^53 + 1). It is that number after
  the reset; `Number()` of it would be `...992`.
- A device name with quotes, a backslash, accents and an astral character, and a revoke reason
  with a line break and a tab, are the same text afterwards.
- 1,200 sessions cross in three statements (500, 500, 200) and are byte-equal.
- Each open session is still found by the hash of its token, with the same session identifier and
  operator. That the token **authenticates** through the server is the identity module's and the
  demo-control module's test, not this row's.

### 5.3 The two values the reset changes (D14)

- **An ACTIVE pairing code** becomes `CANCELLED`, `closed_at` = the reset's `now`,
  `closed_by_operator_id` = the actor (`OPR-002` in T-RS-1; NULL from the command line, in
  `cli.db.test.ts`). Every other column of that row is unchanged (`failed_attempts` is still 2).
  The new chain holds no `PAIRING_CODE_*` row and names the code nowhere: 83 audit rows, the 82 of
  the seed and `SCENARIO_LOADED`.
- **`operators.last_sign_in_at`** (a seeded table): the newest `issued_at` of the operator's
  carried sessions; NULL for an operator with none.

### 5.4 Everything else is the seed, as of the clock passed in

Compared with a database seeded by `seedDatabase` for the same `now`, scenario and epoch: 16 tables
have the same content digest; `operators` the same apart from `last_sign_in_at` (the role that
the test had changed and the disabled flag are the seed's again); the first 82 audit rows and the
first 59 events are the seed's; the event counter is one higher. The boot checks B-2 to B-9 pass
on the new database as `dems_app`, and B-8 with the shared digest check reports
`ok, digests ok, lineage ok`.

## 6. The lineage row

T-RS-1, the verbose run of the row command at 11:41:45. The test reads the chain of the old database itself before
each reset (84 rows after the fixtures; then 83) and compares:

```
[w29] lineage row 1 before the second reset: (1,0,145fb7f6275881d0689b70ddad0fbcd5f9f88c933e807b2329911544d059cc09,84,1,84,1790827200000,OPR-002,RESET,idle)
[w29] lineage row 1 after the second reset:  (1,0,145fb7f6275881d0689b70ddad0fbcd5f9f88c933e807b2329911544d059cc09,84,1,84,1790827200000,OPR-002,RESET,idle)
[w29] lineage row 2:                         (2,1,2a44b9004c973b663a1649a29e267c251af6320a5c6444171a63c97bed8c65c9,83,1,83,1790830800000,,SCENARIO_LOAD,recording)
```

Columns: `reset_no, epoch, head_hash, row_count, first_seq, last_seq, reset_at, actor_id, reason,
scenario`. Row 1 is byte-equal, by the dump and by the checksum of the row. `head_hash`,
`row_count`, `last_seq` and `epoch` of each row are the head, the count and the epoch the test read
before that reset. LN-3: the newest row's `head_hash` and `row_count` equal `previousHead` and
`previousRows` of exactly one `SCENARIO_LOADED` row of the new chain. The routine also hands one
log entry `RESET_CHAIN_DISCARDED` with the same values to the caller's `log` (DC-7); the command
prints it.

No lineage row is written for a first build or for a database with an empty audit log (T-RS-6).
With eleven carried rows the appended one is number 12 and the carried ones stay in order
(`reset-failures.db.test.ts`; see finding F-2).

## 7. Guards against destroying the wrong thing

| Guard | Where | Proven by |
|---|---|---|
| A reset touches three names, all derived from the one it was asked for | `guardResetTarget` | `names.test.ts`; the statement record of section 3.2 |
| Only `dems_demo` and the three lanes are targets; `postgres`, `template0`, `template1`, a staging or previous copy, any other name, a value that is not a string are refused before a file is read | `names.ts` | `names.test.ts` (22 names), `cli.test.ts`, the real process runs of section 8 |
| In a test: only a per-file database of the caller's **own** run; a template, and a database of another run or row, stay refused | `testRunPrefix`, which no entry point sets | `names.test.ts`, `cli.db.test.ts` |
| A drop can name only `<t>_next` or `<t>_prev` | `dropStatement(DisposableDatabase)`: a type that only the guard produces, and a run-time check below it | `names.test.ts`; `static.test.ts` (one `DROP DATABASE` in the routine's sources) |
| The old database is dropped last, after the new one is complete and swapped | Order of `routine.ts` | The record: the drop follows the last `COMMIT`; the forced-failure matrix |
| Two resets of one database cannot interleave | `pg_try_advisory_lock(442001, slot)` on connection A, held to the end | Two concurrent calls: the second is refused, the first completes |
| Never as a superuser | The role check, first statement of every connection | T-RS-4 |
| Never an UPDATE, DELETE or TRUNCATE of the two append-only tables | No such statement exists in the folder | `static.test.ts`; the record of a real reset |
| It ends nobody's session | No forced drop, no `pg_terminate_backend`; a database in use is refused | `static.test.ts`; the R-1, R-7 and R-8 tests (the foreign session still answers) |
| Only databases of `dems_owner`, never a template | R-2 | `guard.test.ts` |
| No message holds a row value or a credential | `ResetError` carries SQLSTATE, constraint and table only; never a `cause` | `guard.test.ts` (a server answer with a detail line), T-RS-2, `cli.db.test.ts`, `static.test.ts` |

## 8. `db:reset`

```
npm run db:reset -w @dems/core-server -- --database <dems_demo|dems_lane_1|dems_lane_2|dems_lane_3> [--scenario <idle|recording|finalizing|fault-demo>]
```

Exit 0 reset; 1 not reset (the message says why, and that the database is unchanged); 2 a wrong
call. The clock is read once. From the command line the reset has no actor and the reason `RESET`.
Real process runs with wrong calls (11:36:29, no connection opened; `assets/29_cli_wrong_calls.log`):

```
$ npm run db:reset -w @dems/core-server --
db:reset: usage: npm run db:reset -w @dems/core-server -- --database <dems_demo|dems_lane_1|dems_lane_2|dems_lane_3> [--scenario <idle|recording|finalizing|fault-demo>]
exit=2
$ npm run db:reset -w @dems/core-server -- --database postgres
db:reset: refused before any connection: the maintenance database and the templates of PostgreSQL are never reset. A reset takes one of dems_demo, dems_lane_1, dems_lane_2, dems_lane_3.
exit=2
$ npm run db:reset -- --database dems_lane_1_next
db:reset: refused before any connection: a staging or previous copy of a database is not a target; name the database itself. A reset takes one of dems_demo, dems_lane_1, dems_lane_2, dems_lane_3.
exit=2
$ npm run db:reset -- --database dems_lane_1 --scenario night
db:reset: refused: scenario must be one of idle, recording, finalizing, fault-demo.
exit=2
```

(also `dems_lane_9`, `template1` through the root alias, and `--force`: exit 2 each.)

**The migrate lock.** The lock is the caller's `lockf`, as for `db:migrate` and `db:seed` (D54,
DN-8): the command starts no child process, and for `dems_demo` it prints, first, that it must be
run as `/usr/bin/lockf -k .locks/db-migrate.lock npm run db:reset ...`. What the routine takes
itself is the advisory lock. See CONTRACT-DEVIATION-1.

**A database that does not exist** is created by the routine (contract §8.4): no `db:create`.
**A database that is in use** is not reset: stop the lane's backend first (plan §5.3 does).

## 9. The lane databases (host change H-15)

Before (11:36:37; `assets/29_lanes_before.log`): `pg_database` held `dems_demo`, `postgres`,
`template0`, `template1`; nothing listened on 4421 to 4423.

```
$ /usr/bin/lockf -k -t 120 .locks/db-migrate.lock npm run db:reset -w @dems/core-server -- --database dems_lane_1
db:reset: dems_lane_1 on PostgreSQL 18.4 as dems_owner
db:reset: dataset as of 2026-10-04T04:36:42.518Z (1791088602518); scenario idle; reason RESET; actor none (command line)
db:reset: first build: dems_lane_1 did not exist. Nothing was carried over and no chain was discarded; epoch 0.
db:reset: done in 163 ms (R-0 7, R-1 1, R-2 0, R-3 0, R-4 28, R-5 119, R-6 7, R-7 1, R-8 0, R-9 0); the database now holds 301 row(s) in 21 of 30 table(s)
row counts       30 table(s)
  ... (the 30 lines of contract §9.4: audit_log 82, events 59, operators 3, ...)
audit head       seq 82; hash 6f50ffeaaa8b8173...
lineage          0 row(s); 0 carried over, 0 appended
db:reset: OK: dems_lane_1 is reset. State: npm run db:status -w @dems/core-server -- --database dems_lane_1
exit=0
```

`dems_lane_2` (11:36:42, 162 ms, head `49727e3e1ac0b44c...`) and `dems_lane_3` (11:36:43, 162 ms,
head `777fa372a98d2e42...`): the same lines, **exit=0** each. Whole output:
`assets/29_lanes_db_reset.log`. `-t 120` only bounds the wait for the lock.

`db:status` of each (11:37; `assets/29_lanes_db_status.log`). An excerpt: the four ledger lines
and the 30 row-count lines are left out here:

```
database         dems_lane_1 on PostgreSQL 18.4
owner            dems_owner; encoding UTF8; locale C
schema version   1; contract revision dbc-2; this code expects 1 (dbc-2)
migrations       4 file(s); ledger matches
seeded_at        2026-10-04T04:36:42.518Z (1791088602518)
last_reset_at    2026-10-04T04:36:42.518Z (1791088602518)
audit head       seq 82; hash 6f50ffeaaa8b8173...
audit triggers   audit_chain_history_append_only=A, audit_log_append_only=A, audit_log_chain_guard=A
lineage          0 row(s)
row counts       30 table(s)
db:status: OK: dems_lane_1 is at the schema version this code expects and the ledger matches the files.
exit=0
```

The same for `dems_lane_2` and `dems_lane_3`, exit 0 each. The 30 row-count lines of each lane are
identical to those of `dems_demo` (one MD5 over the lines of each: `0689ad2ddd67bd205b450808c1dae343`,
four times).

Read as the runtime role through the server's own configuration loader, where the database follows
the port (11:37:32; `assets/29_lane_boot_checks.log`):

```
port 4421: dems_app on dems_lane_1; blocking checks passed: B-2, B-3, B-4, B-5, B-6, B-7, B-9; B-8 ok=true rows=82 linkBreaks=0 digests=ok lineage=none; epoch 0, scenario idle
port 4422: dems_app on dems_lane_2; (the same)
port 4423: dems_app on dems_lane_3; (the same)
```

## 10. `dems_demo` before and after

`db:status --database dems_demo` at 10:58:44 (`assets/29_dems_demo_status_before.log`, copied from
the session) and at 11:44:24 (`assets/29_final_state.log`): `diff` of the 45 lines is empty. In
both: `seeded_at 2026-10-04T03:28:35.448Z (1791084515448)`, `last_reset_at never`,
`audit head seq 82; hash 22eb48f72bb6ffea...`, `lineage 0 row(s)`, 82 audit rows, 59 events, 301
rows in 21 tables, exit 0. No test and no command of this row named `dems_demo` as a target; the
two unit tests that pass the name stop at the owner file of a directory that does not exist.

## 11. The API for the server-side caller (W43)

```ts
import { resetDatabase, ResetError, type ResetReport } from '<...>/src/db/reset';

const report = await resetDatabase({
  database,                       // the instance's own database (it follows the port)
  clock: () => app.clock.now(),   // read ONCE by the routine, after the quiesce
  actorId,                        // the operator of the request; null only from the command line
  reason,                         // 'RESET' for resetDemo, 'SCENARIO_LOAD' for loadScenario
  scenario,                       // 'idle' for resetDemo
  quiesce: async () => { ... },   // R-1, server part
  log: (entry) => ...,            // level, code, message, details: no secret, no row of a kept table
});
```

| When | The caller |
|---|---|
| Before | Has checked the permission and the demo flag (DC-1, DC-2). With the flag off it does not call the routine: the routine is the only code of the server that opens the owner file, at R-0, for one call (HC-2, HC-3) |
| `quiesce` (called after R-0 passed, before anything is read) | Readiness off; the pipeline drained; the engine stopped; the hardware snapshot written; **the runtime pool closed**. The routine ends nobody's session: with the pool still open it waits `sessionDrainMs` (3 s) and refuses with `RESET_TARGET_IN_USE` |
| Resolve | The name points at the new database; the routine's lock is released and its connections are closed. Open the runtime pool; boot checks B-1 to B-9; rehydrate; a snapshot to every operator socket; readiness on; answer 200 with `report.epoch`. **Do not add 1 to the epoch again**: the routine has written previous + 1 (AC-B-57 "by exactly 1"; a server START adds 1, a reset inside a running server must not add a second) |
| Reject, `targetUntouched: true` | The database is exactly what it was: reopen the pool, readiness on, answer 503 `NOT_READY`. `RESET_ALREADY_RUNNING` and every refusal at R-0 happen before `quiesce`, so nothing was stopped. `RESET_ROLE_PRIVILEGED` was logged with that code |
| Reject, `targetUntouched: false` | Only when the connection was lost while the swap committed: the boot checks tell which database the name points at; the next reset's R-2 removes what is left |

`ResetReport` holds: `epoch`, `previousEpoch`, `firstBuild`, `kept` (rows per kept table),
`cancelledPairingCodes`, `operatorsWithSignIn`, `lineage` (`carried`, `appended`, `total`),
`scenarioLoadedSeq`, `auditHead`, `counts` (30 tables), `leftoversRemoved`, `previousDropped`,
`stepMs`, `totalMs`. The second parameter of `resetDatabase` is for tests only.

A test of the caller must reset a clone of **`tpl_seed`**, not of `tpl_bulk` (finding F-3).

## 12. What the contract left open, and the choices of this row

### 12.1 Choices

| # | Open point | Choice |
|--:|---|---|
| 1 | The lock slot of a test database | 1,000 plus a hash of the name; slots 0 to 3 stay the project databases |
| 2 | How long R-1 and R-7 wait for sessions to end | `sessionDrainMs`, default 3 s, then a refusal. The routine never ends a session |
| 3 | A target that exists and has no schema | `RESET_SCHEMA_MISMATCH`, as for any other version: "migrate first" |
| 4 | A target that was migrated and never seeded (T-RS-6) | Built with epoch 0 and no lineage row. R-5c to R-5f still run, as the contract says for a target that exists: the new chain gets a `SCENARIO_LOADED` row with `previousRows` 0 and the head of an empty chain. The seed's own counter and settings rows stay, since there is none to carry; R-6's count rule is read accordingly |
| 5 | A state row missing while the audit log or the lineage is not empty (a damaged database; no program of the project produces it) | Not refused: a reset is the way out of it. The discarded chain is recorded under the epoch after the newest one in the lineage (0 when there is none) |
| 6 | `last_reset_at` of a first build | `now`, as R-5b is worded for every build. `db:status` of a new lane therefore shows a reset time |
| 7 | The detail `reset` of `SCENARIO_LOADED` | Always present: `true` for the reason `RESET`, `false` for `SCENARIO_LOAD` (the simulator leaves it out for a scenario load). The messages are the simulator's |
| 8 | R-6 | The contract's checks, and more: every carried row image compared; `core_state.epoch`, `last_reset_at` and `scenario`; B-5 asked for the runtime role by name, since the routine is the owner |
| 9 | The role check | On each of the three connections, not only the first |
| 10 | `closed_at` of the cancelled code | `now` exactly. A clock behind the code's issue time fails R-5 (tested); nothing is clamped |
| 11 | Leftovers and the old database are dropped | Never with force. A leftover that is in use stops the routine |
| 12 | A lost connection during the swap's `COMMIT` | `RESET_SWAP_FAILED` with `targetUntouched: false`; R-2 of the next run repairs either outcome |
| 13 | Error codes beyond the three the contract names | `RESET_OPTIONS_INVALID`, `RESET_TARGET_REFUSED`, `RESET_OWNER_CREDENTIALS`, `RESET_DATABASE_UNREACHABLE`, `RESET_ALREADY_RUNNING`, `RESET_QUIESCE_FAILED`, `RESET_TARGET_IN_USE`, `RESET_TARGET_NOT_OURS`, `RESET_LEFTOVER_FAILED`, `RESET_READ_FAILED`, `RESET_CREATE_FAILED`, `RESET_BUILD_FAILED`, `RESET_VERIFY_FAILED`, `RESET_SWAP_FAILED` |
| 14 | An observer of the routine | `onCheckpoint`, 17 points, for progress lines and for the forced-failure tests |

### 12.2 Deviations from the wording of the contract

| ID | Contract | This row | Why |
|---|---|---|---|
| CONTRACT-DEVIATION-1 | R-0: "On `dems_demo` the routine holds `.locks/db-migrate.lock`" | The lock is the caller's `lockf`; the command prints that for `dems_demo` | The ruling for `db:migrate` (D54, DN-8), and the instruction to run the lane builds under the caller's `lockf`: a routine that took the same file lock inside would wait on its own caller. A migration that overlaps a reset is still stopped: its session on `<t>` makes R-1 or R-7 refuse. See DN-1 for the server-triggered reset |
| CONTRACT-DEVIATION-2 | R-1: `SELECT count(*) FROM pg_stat_activity WHERE datname = <t>` | Sessions that have a role, by role, without the routine's own | A count of every row includes autovacuum workers, which the server stops itself at a rename or a drop, and which do visit a fresh database (finding F-1): the reset would be refused at random. The helper's finding F-1 (D48) asks for the same test |
| CONTRACT-DEVIATION-3 | R-6: "The row count of each kept table equals the count read in R-3" | For the two seeded tables with no row read (a never-seeded target): the seed's rows stay | T-RS-6 requires that such a database can be reset |

## 13. Verification

### 13.1 The row command (11:41:17; `assets/29_row_command.log`, verbose: `29_row_command_verbose.log`)

```
$ DEMS_TEST_STEP=51 npm run test:db -w @dems/core-server -- src/db/reset
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_51_tmd90uce_
[test:db] stale sweep: dropped 0; kept 0 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
[test:db] template dems_test_step_51_tmd90uce_tpl_schema: built in 78 ms (create 27 ms, hook 49 ms)
[test:db] template dems_test_step_51_tmd90uce_tpl_seed: built in 122 ms (create 41 ms, hook 80 ms)

 Test Files  4 passed (4)
      Tests  69 passed (69)
   Start at  11:41:18
   Duration  27.00s (tests 96%, import 3%, transform 1%)

[test:db] teardown: dropped 3 database(s) in 45 ms; 0 remain with the run prefix dems_test_step_51_tmd90uce_
exit=0
```

| Test ID | Where | Tests |
|---|---|--:|
| T-RS-1 | `reset.db.test.ts` | 2 |
| T-RS-2 | `reset-failures.db.test.ts` | 1 |
| T-RS-3 | `reset.db.test.ts` (five statements as `dems_app`, each `42501`) | 1 |
| T-RS-4 | `guard.db.test.ts` (and `guard.test.ts` in `unit`) | 7 |
| T-RS-5 | `reset.db.test.ts` | 1 |
| T-RS-6 | `reset.db.test.ts` | 2 |
| The failure matrix and the rest | `reset-failures.db.test.ts` 47, `guard.db.test.ts` 3, `cli.db.test.ts` 5 | 55 |

### 13.2 Typecheck and lint (P11: every run recorded)

| Time | Command | Result |
|---|---|---|
| while the files were written (several runs up to about 11:22; times not recorded) | `npm run typecheck -w @dems/core-server` | Exit 0 |
| about 11:31 | the same | **Exit 2**: `src/db/fixtures/__tests__/build.test.ts(20,3): error TS2305` (a file of the bulk-fixture row, mid-edit) |
| 11:40:48, 11:41:06 | the same | Exit 0 |
| 11:41:06 | `npm run lint -w @dems/core-server` | Exit 0; two warnings, in `src/engine/__tests__/support.ts` and `src/plugins/readiness/__tests__/readiness.test.ts` (other rows); none in `src/db/reset` |

### 13.3 The `unit` project

| Time | Result |
|---|---|
| 10:58:58 (before) | 41 files, 1,281 tests, exit 0 |
| 11:34:13 | 51 files, 1,541 tests, exit 0 (the log of this run was overwritten by the next; the figures are as printed in the session) |
| 11:42:20 | Exit 1: 1,538 of 1,541; 3 failures in `src/core/__tests__/core-plugin.test.ts` (2) and `src/plugins/readiness/__tests__/readiness.test.ts` (1), files of rows in flight (`assets/29_unit_after_1142_others_red.log`) |
| 11:42:53 | This row's six files, the five static guard files of the scaffold, and the unit files of the helper, the commands, the mapping and the seed: 26 files, 719 tests, exit 0 (`assets/29_unit_mine_and_guards.log`). The static guards with this row's files present: `audit-protection` 9, `credentials` 13, `logging` 3, `network` 13, `scaffold` 51 |
| 11:45:02 | **51 files, 1,541 tests, exit 0** (`assets/29_unit_final.log`) |

### 13.4 The `db` project

| Time | Result |
|---|---|
| 10:59:15 (before) | 27 files, 382 tests, exit 0 |
| 11:34:33 | 32 files, 470 tests, exit 0 (log overwritten; figures as printed in the session) |
| 11:43:05 | Exit 1: 468 of 472 (`assets/29_db_after_1143_others_red.log`) |
| 11:45:21 | Exit 1: 468 of 472 in 33 files (`assets/29_db_final.log`); 0 databases remain |

The four failures, both times: `test/db/boot-checks.db.test.ts` (1), `src/core/__tests__/boot-checks.db.test.ts`
(2), `src/core/__tests__/seeded.db.test.ts` (1). Each reports `boot step engine.rehydrate failed`:
the engine-host row, whose files under `src/engine/` were written between 11:28 and 11:44, now
registers a boot step that those tests do not expect. No file of this row is among them, and
`src/db/reset` does not occur in the failure output.

### 13.5 No credential in any output

- The command: `cli.db.test.ts` collects every line `db:reset` printed in seven calls (a first
  build, two resets, a refusal while in use, three refused names) and searches it for the owner role's password, the runtime role's password
  (both read through the project's readers only to be searched for), the demo password, the pairing
  code constant, every token, credential and code hash of the kept rows and every password salt
  and hash, whole and by their first 16 digits: no occurrence.
- The routine: a failed statement is reported by SQLSTATE, constraint and table; a server answer
  with a `DETAIL` line that quotes a key is reduced to those three (`guard.test.ts`; T-RS-2 on the
  real server: the message names neither the operator nor the hash). A `ResetError` has no `cause`.
- This row's outputs (11:52:05; `assets/29_no_credential.log`): the two documents, the `29_*`
  evidence files and `src/db/reset/**`, 49 files, searched for both role passwords and the demo
  password: 0 occurrences each. Only counts were printed.

## 14. Test ledger (P24)

`@dems/core-server` only. No existing test was changed.

| Project | Before this row | After | This row |
|---|---|---|---|
| `unit` | 41 files, 1,281 tests, 0 failed (10:58:58) | 51 files, 1,541 tests, 0 failed (11:45:02) | **6 files, 157 tests**, all passing. The other 4 files and 103 tests were added by rows that ran at the same time |
| `db` | 27 files, 382 tests, 0 failed (10:59:15) | 33 files, 472 tests: 468 passed, 4 failed in files of other rows (11:45:21) | **4 files, 69 tests**, all passing. The other 2 files and 21 tests were added by rows that ran at the same time |

| Project | File under `apps/core-server/src/db/reset/__tests__/` | Tests |
|---|---|--:|
| `unit` | `names.test.ts` | 43 |
| `unit` | `kept-tables.test.ts` | 24 |
| `unit` | `plan.test.ts` | 20 |
| `unit` | `guard.test.ts` | 27 |
| `unit` | `cli.test.ts` | 30 |
| `unit` | `static.test.ts` | 13 |
| `db` | `reset.db.test.ts` | 6 |
| `db` | `reset-failures.db.test.ts` | 48 |
| `db` | `guard.db.test.ts` | 10 |
| `db` | `cli.db.test.ts` | 5 |

## 15. Findings

| ID | Finding | Evidence |
|---|---|---|
| F-1 | **The test helper's forced drop is refused while an autovacuum worker is connected to the database.** `DROP DATABASE ... WITH (FORCE)` by `dems_owner` fails with `42501` "permission denied to terminate process": the owner may not signal the worker. A database that was just built is where autovacuum goes next. The file is then reported as failed and the run leaves a database behind for six hours. A plain drop does not have the problem: the server stops the worker itself. The reset routine uses only the plain form | At 11:22:56 the helper's drop of `dems_test_step_51_tmd85m2e_f02_rfbulk` was refused three times (`.data/postgres.log`: .685, .686, .712), with no client session of another role on it. The database's own statistics: autovacuum analysed five of its tables at 11:22:56.702 to .716 (`assets/29_helper_forced_drop_refused.log`). A plain `DROP DATABASE` then removed it. The same refusal is in the log at 10:45:39 for a database of another row's run. This row's tests now remove their databases with a plain drop first |
| F-2 | `SELECT x::text AS x ... ORDER BY x` orders by the text of the select list, so `'9'` sorts after `'10'`. The first version of the routine's "newest lineage row" read would have refused every reset after the ninth at R-6. Fixed before anything used it (the order names the column), with a test with eleven carried rows. `db:status` and the boot checks of W17 do not have the pattern | First test run of 11:16:20 (the same slip in a test query); `kept-tables.test.ts`, `reset-failures.db.test.ts` |
| F-3 | **A database built from the bulk fixture cannot be reset**, by design (DA-08): its kept rows name operators the seed does not create. The routine refuses at R-5 and the database stays untouched | A one-off probe at about 11:36 on a clone of `tpl_bulk` (12 operators; 203 sessions of the nine added ones): `RESET_BUILD_FAILED at R-5 ... SQLSTATE 23503 (constraint pairing_codes_issued_by_operator_id_fkey, table pairing_codes)`; the OID unchanged. The probe file was removed |
| F-4 | Assumptions of the contract confirmed by running: DA-04 and PG-09 (both renames commit in one transaction; a rename and a drop are refused with `55006` after about 5 s when a session is on the database); PG-27 (`dems_owner` sees the database and the role of a `dems_app` session); DA-08 (a carried row that names a missing operator fails the carry-over and the old database stays) | Sections 4 and 5 |
| F-5 | Between R-3 and R-7 the routine does not see a session that connects to the old database, writes and disconnects again; what it wrote would be lost. The procedures exclude it (the server's pool is closed, a lane's backend is stopped, one process per database), and a session that is still there at R-7 stops the swap | By reading; not provoked |
| F-6 | The whole `db` project is red in four tests of three files since the engine-host row registers a boot step (section 13.4) | `assets/29_db_final.log` |
| F-7 | The brief cites decision D62; `decisions/decisions.md` ended at D61 when this row read it (shortly before 10:58) | `grep` of the file |

## 16. Decisions for the controller to record

| ID | Question | Recommendation |
|---|---|---|
| DN-1 | CONTRACT-DEVIATION-1: who holds `.locks/db-migrate.lock` for a reset of `dems_demo` | The caller's `lockf` for the command line (as now). For the reset from inside the server, record that no file lock is taken: the advisory lock and the session checks of R-1 and R-7 are what keeps a migration and a reset apart |
| DN-2 | CONTRACT-DEVIATION-2 and -3 | Accept; reword R-1 and R-6 at the next document slot |
| DN-3 | F-1: the helper's forced drop | Route to the helper's owner: try the plain drop first (or retry a refused forced drop after a short wait). Until then any `test:db` run can fail in this way, rarely |
| DN-4 | F-3 | Tell the rows that test `resetDemo` and `loadScenario` (W43, W53): use a `tpl_seed` clone |
| DN-5 | Section 11: the epoch after a reset inside the server | Tell W43 and W26: rehydrate after a reset without the start-up increment |
| DN-6 | Choices 4, 6 and 7 of section 12.1 (a never-seeded target, `last_reset_at` of a first build, the detail `reset`) | Accept, or rule otherwise; each is one line to change |
| DN-7 | `masterplan/02_plan.md` was not edited by this row (a shared file in a parallel run) | The controller updates the tracking row of W29 |

## 17. End state and cleanup (11:44:24; `assets/29_final_state.log`)

Condensed here: column padding removed and the three role lines joined; the output as printed is
in the asset file.

```
19121 Sun Oct  4 07:14:26 2026
postgres.pid file: 19121
session        dems_owner (superuser false) on 127.0.0.1:4432, PostgreSQL 18.4, postmaster started 2026-10-04 07:14:26 WIB
pg_database    7 row(s)
  dems_demo     owner dems_owner  template false allowconn true  UTF8 C
  dems_lane_1   owner dems_owner  template false allowconn true  UTF8 C
  dems_lane_2   owner dems_owner  template false allowconn true  UTF8 C
  dems_lane_3   owner dems_owner  template false allowconn true  UTF8 C
  postgres      owner dems_admin  template false allowconn true  UTF8 C
  template0     owner dems_admin  template true  allowconn false UTF8 C
  template1     owner dems_admin  template true  allowconn true  UTF8 C
pg_roles       3 role(s) outside pg_*: dems_admin, dems_app, dems_owner (attributes unchanged)
pg_settings    375 visible setting(s), digest 6373391cbc111bce33dc5cf487c0c1e8; pg_db_role_setting 0 row(s)
advisory locks 0
```

- The same roles and the same settings digest as at 11:00:09 (`assets/29_cluster_state_before.log`).
  No role was created, no setting changed, PostgreSQL was not stopped.
- No database with the prefix `dems_test_step_51_`, no `_next`, no `_prev`. The one database a run
  of this row left behind (F-1) was dropped by this row at 11:24:22.
- This row started no process that outlives a command. It bound no port.
- Scratch scripts (the cluster state, the leftover drop, the lane boot checks) are outside the
  repository; copies are in `assets/` as `29_*.ts.txt`.

## 18. Rollback (R-NEW and H-15; not executed)

```sh
# H-15: remove the three lane databases. As dems_owner, on the maintenance database "postgres" of
# 127.0.0.1:4432, with no session on them (stop the lane backends first):
#     DROP DATABASE dems_lane_1;  DROP DATABASE dems_lane_2;  DROP DATABASE dems_lane_3;
# and, if a reset was interrupted, DROP DATABASE dems_lane_<k>_next / dems_lane_<k>_prev.
# No command of the project drops a project database by its own name; the statements are typed in
# a client that reads the owner connection file. `npm run pg:remove-data` (W90) removes the whole
# cluster with them. Every lane pairing is lost with its database (PR-13).
# R-NEW: every file of this row is new and untracked.
rm -rf apps/core-server/src/db/reset
# After that `npm run db:reset` has no entry file; the lane procedure of plan §5.3 needs it.
```

## 19. Not done, and not verified by this row

- The server side of a reset (the demo operations, the quiesce, the pool, the rehydration, the
  snapshot to the sockets, the 200 and the 503): W43. `resetDatabase` was not called from a server.
- That a kept session token authenticates through the HTTP layer after a reset: the table-level
  half is proven here (section 5.2).
- A reset of `dems_demo`: not run, on purpose. The routine was proven on test databases and on the
  first build of the lanes; a reset of an existing project database with the real process was not
  run either, so that the lanes hold exactly the seed counts.
- A connection lost during the swap's `COMMIT` (section 4, R-7).
- `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md` and
  `decisions/decisions.md` were not written (a parallel run; the controller's files).

## 20. Verification list of the row

| Criterion | State |
|---|---|
| `npm run test:db -w @dems/core-server -- src/db/reset` exits 0 (T-RS-1 to T-RS-6) | Yes: 4 files, 69 tests (13.1) |
| After two resets `audit_chain_history` holds two rows and the first is byte-equal | Yes (6) |
| The sessions the routine opens are `dems_owner` only | Yes (3.3) |
| A stubbed superuser answer stops the routine with `RESET_ROLE_PRIVILEGED` before R-1 | Yes (4) |
| `db:reset` for `dems_lane_1`, `dems_lane_2`, `dems_lane_3` exits 0; `db:status` prints the seed counts and the owner `dems_owner` | Yes (9) |
| `unit` project incl. the static guards passes for everything of this row | Yes (13.3) |
| `typecheck` and `lint` exit 0 | Yes (13.2) |
| `pg_database` lists `dems_demo` and the three lanes and no leftover | Yes (17) |
| Test ledger with the files by name | Section 14 |
| `dems_demo` not reset; same `db:status` before and after | Yes (10) |
| Writes only under `apps/core-server/src/db/reset/**` | Yes (2) |

## 21. Follow-up: load-sensitive wait (controller request after D74; 12:45 to 13:02)

The engine-host row saw `src/db/reset/__tests__/reset-failures.db.test.ts` fail in three runs
between 12:32 and 12:35, a different test each time, always with the same assertion
(`sessions of the routine: expected [ { database: 'postgres', … } ] to deeply equal []`), while
another database run was in flight; alone it passed (its report, section 12.5 and finding F-15).
The request: locate it, make the test's wait independent of load, fix the routine if the cause is
there, prove it under a parallel run. Evidence files of this section: `assets/29b_*` (16 files).
Sections 1 to 20 are the record of the row as it was accepted; where this section changes a
figure, it says so.

### 21.1 The cause: not a short wait, and not load

**The test took another run's connection for its own.** `expectNothingLeft` asked the server for
sessions whose `application_name` was `dems-db-reset-failures`, a constant of the file. Every run
of `test:db` shares one maintenance database, and `pg_stat_activity` lists the sessions of all of
them. When the same file runs in a second run at the same time (a whole-project run of another
row), that run's routine holds a connection on `postgres` with the same name. The test saw it and
waited 3 s for a session that was not its own to go away.

| Evidence | |
|---|---|
| The engine row's own log | One of the failing tests is the forced failure at checkpoint `R-0`, in which the routine opens no connection at all. Nothing of that run could have been listed |
| Reproduced at the first attempt, at a load average of 1.40 (12:45:45 and 12:45:48; `29b_repro_run_a.log`, `29b_repro_run_b.log`) | Two runs of the file started 3 s apart. Run A: 1 failed of 48. Run B: 2 failed of 48, `R-0` among them. Each with the assertion above; the row received was `{ application: 'dems-db-reset-failures', database: 'postgres', role: 'dems_owner' }` |
| The same pair after the fix (12:54:30 and 12:54:33; `29b_repro_fixed_run_a.log`, `_b.log`) | 54 of 54 and 54 of 54, exit 0 both |

A longer wait would not have cured it: the other run's file keeps a routine connected for about
25 s, in one reset after another.

### 21.2 A second thing, found while looking: a real defect of the ROUTINE

**The routine resolved before the driver had closed its owner connection.** The driver's
`pool.end()` resolves when the pool has ASKED its clients to close: it drops them from its list,
calls their `end`, and does not wait for a socket to end (`node_modules/pg-pool/index.js:133-144`
and `:172-188`). `resetDatabase` awaited exactly that, so at the moment its promise settled the
connection on `postgres` was still being closed. Measured, with the routine unchanged, by a test
that reads the driver's own events at once after the promise settled (12:47:26;
`29b_close_before_fix.log`):

```
 × ... R-9: when the routine settles, the driver has closed every connection it opened > after a reset that succeeds: the three connections, each closed
 × ... > after a failure at R-1 / R-3 / R-5c / R-6 / R-7:rename: every connection opened so far is closed   (five cases)
AssertionError: connections the driver had not closed when the reset resolved: expected [ 'postgres' ] to deeply equal []
      Tests  6 failed | 48 skipped (54)
```

It is not what the engine row saw (that session belonged to another run), and no effect on a
reset was found: the advisory lock is released by its own awaited statement before the close, and
where the routine itself needs a database to be free (R-1, R-7) it asks the server. But step R-9
said "the owner connection is closed" a moment before it was, and section 3.1 of this report said
"none after R-9" on the strength of it.

**Fix** (`routine.ts`, `closePool`): the routine ends a pool and then waits for the pool's `remove`
event, which the driver emits when a connection has really ended, once per connection the pool
held. The wait is bounded (`CONNECTION_CLOSE_WAIT_MS`, 5 s): a socket that never reports its end
must not hold a reset whose work is done; the routine then goes on and logs
`RESET_CONNECTION_SLOW_TO_CLOSE`. The same close is used for the two side connections, so the
connection on `<t>` is closed before `<t>_next` is created. After the fix (12:49:08;
`29b_close_after_fix.log`): the same six tests pass.

| Test | Project | What it holds |
|---|---|---|
| `reset-failures.db.test.ts`, "R-9: when the routine settles, the driver has closed every connection it opened" (6) | `db` | On the real server: after a reset that succeeds, three connections were opened (`postgres`, `<t>`, `<t>_next`) and each is closed when the promise resolves; after a failure at R-1, R-3, R-5c, R-6 and R-7:rename, every connection opened so far is closed when it rejects. No polling: the driver's events, in this process |
| `guard.test.ts`, "R-9: the routine settles only when the driver has closed the owner connection" (3) | `unit` | On a stand-in pool: the routine has not settled when the pool was asked to end, and settles when the connection is reported closed; a connection that never reports its end holds it for exactly 5,000 ms (fake clock), then it goes on and logs the warning; a pool that never connected is ended without a wait |
| `reset.db.test.ts`, T-RS-5 (changed) | `db` | The connections the driver holds open at each of the 17 checkpoints, exactly: none at R-0; `postgres` alone up to R-5a; `postgres` and `<t>_next` from R-5b to R-6; `postgres` alone from R-7 on; none at the moment the promise resolved |

What the routine cannot wait for is the server: a backend leaves `pg_stat_activity` a moment
after its connection ended. A check against the server therefore still polls, after the promise
has settled (21.3).

### 21.3 What changed in the tests

The production bound `sessionDrainMs` (default 3 s, the routine's wait at R-1 and R-7) is NOT
changed. What changed is what the tests wait for, and how.

| Before | After |
|---|---|
| The routine's connections named `dems-db-reset-failures`, the same in every run | `resetApplicationName(runStamp, file)`: `dems-db-reset-rf-<stamp>`, `dems-db-reset-t5-<stamp>`. The run stamp is unique among live runs, and a file runs once per run |
| `waitForSessionsGone(pool, name, 3 s)` returned what was left, and the test compared it with `[]` | `untilNoSession(pool, filter, what, cap = 30 s)`: a poll that returns as soon as the server lists no matching session. At the cap it throws, and the message says what was still connected: a count, the role, the application name. It is called only after the routine's promise has settled |
| Two more silent waits: 3 s before a rename, 5 s before a plain drop | The same poll |
| Every reset of the tests ran with `sessionDrainMs: 400` (300 in the command's test): the routine's own bound, shortened. A backend of a pool that the test had just closed, still listed after 400 ms, would have made the routine refuse a reset that the test expected to succeed | A reset that must go through first makes its target quiet (`quiet()`: the test's pools closed, then the poll until the server lists no session on the target) and gives the routine a generous bound, which costs nothing when no session is there. Only the four calls that hold a session ON PURPOSE and expect the refusal pass the short bound (R-1 twice, the R-7 check, the command on a database in use), so that the refusal is quick |
| T-RS-5 counted the sessions the SERVER listed for the routine and required at most two | The count is taken from the driver (21.2), where it is exact. The server's list is used for WHO is connected (`dems_owner` only), and for "one session on `postgres` from R-1 on" |
| Vitest's defaults: 5 s per test, 10 s per hook; two tests carried 30 s | `vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 })` in the three database test files. Caps, not waits |

**The "plain drop first" work-around is kept**, and now waits with the same poll. Since D76 the
helper retries a refused forced drop itself; the plain form stays in these tests because it needs
no retry, ends nobody's session and is the form the routine uses. The test waits until the server
lists no client session on the database before it drops, so the drop has nothing to wait for (a
plain drop with a session still connected takes about 5 s to fail, as the helper row measured).

### 21.4 Proof

Ten runs of the file in a row (`DEMS_TEST_STEP=51b`), with whole-project `db` runs in flight the
whole time (12:55:18 to 12:59:42; `29b_ten_runs_under_load.log`, `29b_parallel_whole_db_runs.log`):

| Run | Start | Load average | Result | Duration | Helper retries | Databases left | Exit |
|--:|---|--:|---|--:|--:|--:|--:|
| 1 | 12:55:23 | 1.56 | 1 file passed; 54 of 54 tests | 22.52 s | 0 | 0 | 0 |
| 2 | 12:55:45 | 2.11 | 54 of 54 | 24.14 s | 0 | 0 | 0 |
| 3 | 12:56:10 | 2.39 | 54 of 54 | 22.41 s | 0 | 0 | 0 |
| 4 | 12:56:32 | 2.49 | 54 of 54 | 24.82 s | 0 | 0 | 0 |
| 5 | 12:56:58 | 2.63 | 54 of 54 | 23.40 s | 0 | 0 | 0 |
| 6 | 12:57:21 | 3.75 | 54 of 54 | 23.24 s | 0 | 0 | 0 |
| 7 | 12:57:45 | 4.06 | 54 of 54 | 25.34 s | 0 | 0 | 0 |
| 8 | 12:58:11 | 3.95 | 54 of 54 | 24.18 s | 0 | 0 | 0 |
| 9 | 12:58:35 | 4.08 | 54 of 54 | 23.31 s | 0 | 0 | 0 |
| 10 | 12:58:59 | 4.02 | 54 of 54 | 24.89 s | 0 | 0 | 0 |

The six whole-project runs in parallel (started 12:55:18, 12:56:02, 12:56:45, 12:57:30, 12:58:14,
12:58:59): **each 45 files, 629 tests, exit 0**, 0 databases left. Each of them runs the same file,
so for the whole time two runs of it were on the cluster at once, the situation that failed
before. In the fourth the helper retried one forced drop (`forced drops that needed a retry: 1`,
SQLSTATE 42501, the drop then went through). This row's files drop their own databases with the
plain form before the helper's drop, so that retry was of another file's database (an inference
from the code, not read from the log).

Then, with nothing else of this row running:

| Time | Command | Result |
|---|---|---|
| 12:53:59 | `DEMS_TEST_STEP=51b npm run test:db -w @dems/core-server -- src/db/reset` | Exit 0: 4 files, 75 tests |
| 12:59:54 | `npm run test -w @dems/core-server -- --maxWorkers=2` | **Exit 0: 70 files, 1,850 tests** |
| 13:00:05 | `npm run typecheck -w @dems/core-server`; `npm run lint -w @dems/core-server` | Exit 0; exit 0, no warning |
| 13:00:27 | `DEMS_TEST_STEP=51b npm run test:db -w @dems/core-server -- --maxWorkers=2` | **Exit 0: 45 files, 629 tests**; 0 retries; 0 databases left |
| 13:01:44 | Cluster state (`29b_final_state.log`) | `dems_demo`, the three lanes and PostgreSQL's own three; no database with the prefix `dems_test_step_51`; PID 19121, started 07:14:26; three roles; the settings digest of 11:00:09 |
| 13:03:32 | No credential (`29b_no_credential.log`) | The two documents, the `29_*` and `29b_*` evidence files and `src/db/reset/**`, 65 files, searched for both role passwords and the demo password: 0 occurrences each. Only counts were printed |

Ledger against the controller's baseline of 12:37 (`unit` 70 files / 1,848; `db` 45 files / 623):

| Project | Now | This follow-up | Other rows |
|---|---|---|---|
| `unit` | 70 files, 1,850 tests | +3: `guard.test.ts` 27 to 30 | −1: `src/plugins/readiness/__tests__/readiness.test.ts` 30 to 29 (not this row; the identity row had announced the removal of an empty test there) |
| `db` | 45 files, 629 tests | +6: `reset-failures.db.test.ts` 48 to 54 | none |

This row's files now: `unit` 6 files, 160 tests (`names` 43, `kept-tables` 24, `plan` 20,
`guard` 30, `cli` 30, `static` 13); `db` 4 files, 75 tests (`reset.db` 6, `reset-failures.db` 54,
`guard.db` 10, `cli.db` 5). These figures replace those of sections 13.1 and 14. No test of the
identity row was red in any of these runs.

T-RS-5 as it prints now (13:01; `29b_row_command_verbose.log`), the driver's connections and the
server's sessions at each checkpoint:

```
(driver) R-0=[] R-1=[postgres] R-2=[postgres] R-3=[postgres] R-4=[postgres] R-5a=[postgres] R-5b=[postgres, <t>_next] ... R-6=[postgres, <t>_next] R-7=[postgres] R-7:rename=[postgres] R-8=[postgres] R-9=[postgres]
(server) R-0=[] R-1=[dems_owner@postgres] ... R-5b=[dems_owner@<t>_next, dems_owner@postgres] ... R-7=[dems_owner@postgres] ... R-9=[dems_owner@postgres]
```

(condensed with `...`; R-5c to R-5:commit read as R-5b.)

### 21.5 Files changed (all under `apps/core-server/src/db/reset/`)

`routine.ts` (`closePool`, `CONNECTION_CLOSE_WAIT_MS`, the log code
`RESET_CONNECTION_SLOW_TO_CLOSE`), `index.ts` (one export; the caller's note says when the promise
settles), `__tests__/support.ts` (`untilNoSession`, `quiet`, `resetApplicationName`, `PATIENT_MS`;
`waitForSessionsGone` removed), `__tests__/pools.ts` (`watchedPools`; the stand-in pool can report
a held connection), `__tests__/reset-failures.db.test.ts`, `__tests__/reset.db.test.ts`,
`__tests__/cli.db.test.ts`, `__tests__/guard.test.ts`. Nothing outside the folder was written. The
lanes and `dems_demo` were not named by any test or command.

### 21.6 Findings of the follow-up

| ID | Finding |
|---|---|
| F-8 | **A test that reads `pg_stat_activity` (or `pg_locks`) on the shared maintenance database sees every run on the cluster.** Whatever it asks for must be keyed by something of its own run: a database name of the run, or a name that carries the run stamp. A fixed `application_name` is not such a key. This row's file had one; it is the cause of the three red runs. Other rows' tests that filter on a fixed application name have the same latent failure whenever two runs overlap |
| F-9 | **The routine resolved before its owner connection was closed** (21.2). Fixed, with tests in both projects |
| F-10 | **`pool.end()` of the driver resolves before the sockets have ended**, and the server lists a backend a moment longer still. It concerns every caller that ends a pool and then expects the database to be free: the server's quiesce before a reset (the routine waits at R-1 for exactly that, up to `sessionDrainMs`), the helper's `closeResources`, a shutdown test. A check of "no session" belongs after the close and must poll |
| F-11 | The engine row's reading "the 3 s wait is short for a loaded host" (its F-15) was the natural one from the outside; the reproduction at a load average of 1.40 shows that load was not involved |

---
*Generated: 2026-10-04 11:50 WIB*
*Last Updated: 2026-10-04 13:05 WIB (section 21)*
