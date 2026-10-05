---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 39
plan_row: W17
title: Schema, migrations and database commands (the only migration writer)
date: 2026-10-04
agent: database-specialist (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
source_contract: masterplan/03_database_contract.md rev 2.2 (contract revision dbc-2)
evidence_tier: 3
status: needs-review (one item, NR-1; everything this row owns is complete and verified)
---

# W17: schema, migrations and database commands

All times are WIB (UTC+7) on 2026-10-04. Every command ran from `/Users/gsp-budi/Documents/DEMS`;
no command changed the session directory (two used a subshell). Database commands ran with the
per-command sandbox bypass (P10): inside the sandbox a connection to `127.0.0.1:4432` fails with
`POSTGRES_UNREACHABLE` (EPERM), which was observed once at 09:06 and is not "server down".
Quoted runner output is unchanged except that Vitest's pass mark is written `[pass]` and long
lines are cut where marked. **No password or other credential value appears in this document.**
The hash values quoted in section 11 are SHA-256 of strings this row's test made up at random;
they are not hashes of any credential.

## 1. Result

| Item | Result |
|---|---|
| Row command `npm run test:db -w @dems/core-server -- test/db` | **Exit 0**: 9 files, 233 tests, 0 failed (09:36:51, section 8.1) |
| Migrate on an empty clone, then a second run | 4 files applied as `dems_owner` in 43 to 58 ms; second run applies 0 (section 8.2) |
| Catalog against contract §4 | **Difference empty**: 30 tables, 302 columns, 98 named CHECKs, 25 foreign keys, 15 UNIQUE, 2 unique indexes, 22 indexes; 5 functions; 3 triggers with `tgenabled = 'A'` (section 7) |
| Ownership | Every object belongs to `dems_owner` (section 8.5) |
| Audit guards | UPDATE, DELETE, TRUNCATE on `audit_log` and `audit_chain_history`: `42501` for `dems_app`, `ZA002` for `dems_owner`; INSERT on `audit_chain_history`: `42501` for `dems_app`; a row that does not continue the chain: `ZA001` (section 8.3) |
| T-PV-1 to T-PV-3, T-AT-1 to T-AT-5, T-CH-1 to T-CH-3 | Pass, live, as `dems_app`, with real parallel connections (sections 8.3 to 8.6) |
| `db:create`, `db:migrate`, `db:status` | Written and proven; `db:status` exits 1 on an edited applied file (section 5) |
| Boot checks B-2 to B-9 | Exported from `src/db/schema/boot-checks.ts`, each with a passing and a failing test; nothing registered (section 6) |
| PG-01 to PG-28 | 21 confirmed, 1 corrected (PG-16), 6 not exercised here (section 12) |
| `dems_demo` | **Absent, as before.** The plan row names no project database for W17; its verification runs on clones; the first build of `dems_demo` is W20's (section 9) |
| D-1 (the last committed instant) | **Stored**: `hardware_snapshot.written_at`, with `active_session.updated_at`. `SCHEMA-GAP-1` is **not raised** (section 10) |
| Unit project, typecheck, lint | Exit 0, exit 0, exit 0 (section 8.8) |
| Drift | `drizzle-kit generate` on the final schema: "No schema changes, nothing to migrate" (section 3.3) |
| **Whole `db` project** | **Exit 1: 284 of 285 pass. The one failure is a test of the helper row (W11), not of this row** (NR-1, section 14) |
| PostgreSQL | Never stopped or reconfigured: PID 19121, started 07:14:26, at the start and at 09:36 |

## 2. What was written

41 source files (8,942 lines), the inventory JSON, and the generated migration metadata; all under
the five owned paths. Nothing else in the repository was edited.

| Path under `apps/core-server/` | Content |
|---|---|
| `drizzle.config.ts` | `dialect`, `schema`, `out`. No credential, no address |
| `src/db/schema/index.ts` | The entry of the typed schema: re-exports the modules below. What later rows import |
| `src/db/schema/bytea.ts` | **The one `bytea` custom type** (D38) |
| `src/db/schema/value-sets.ts` | The 28 closed value sets of §2.4 as literal arrays and union types; `REGISTRY_COUNTER`, `ENGINE_COUNTER`, `TIME_FORMAT`; **`AUDIT_DETAIL_FORBIDDEN_KEYS`** (17 names); `FlatJson` |
| `src/db/schema/checks.ts` | The format rules of §2.4 as SQL fragments (`hex64`, `code`, `flat`, `noSecretKeys`, the five ID patterns) |
| `src/db/schema/rbac.ts` | T-01 to T-05 |
| `src/db/schema/identity.ts` | T-06 |
| `src/db/schema/pairing.ts` | T-07 to T-11 |
| `src/db/schema/audit.ts` | T-12, T-13, T-14, T-30 |
| `src/db/schema/sessions.ts` | T-15, T-16 |
| `src/db/schema/evidence.ts` | T-17 to T-20 |
| `src/db/schema/core.ts` | T-21 to T-28 |
| `src/db/schema/meta.ts` | T-29; **`DB_SCHEMA_VERSION` = 1**, **`DB_CONTRACT_REVISION` = `dbc-2`** |
| `src/db/schema/public-columns.ts` | The public column sets of NL-6 |
| `src/db/schema/boot-checks.ts` | Boot checks B-2 to B-9 (section 6) |
| `src/db/migrations/0000_prelude.sql` | Hand-written: `dems_jsonb_is_flat(jsonb)` |
| `src/db/migrations/0001_tables.sql` | Generated from the typed schema: 30 tables |
| `src/db/migrations/0002_audit_guards.sql` | Hand-written: the six statement groups of §6.3 |
| `src/db/migrations/0003_privileges.sql` | Hand-written: the statements of §8.3 |
| `src/db/migrations/meta/` | `_journal.json` and four snapshots, written by `drizzle-kit` |
| `src/db/commands/create.ts`, `migrate.ts`, `status.ts` | The three entry files D27 fixed |
| `src/db/commands/cli.ts` | Argument, output, exit code, owner pools |
| `src/db/commands/database-names.ts` | The closed list of database names and its guard |
| `src/db/commands/migrations.ts` | The migration set, the ledger comparison, `applyMigrations` |
| `src/db/commands/owner-connection.ts` | Reads `.data/pg.owner.env`; the owner pool; the role check |
| `test/db/template-hook.schema.ts` | The hook of `tpl_schema` (W11's plug-in point) |
| `test/db/contract-inventory.ts`, `.json` | The expected inventory, parsed from the contract itself |
| `test/db/fixtures.ts`, `support.ts` | One valid row per table; refusal helpers; the append protocol with the shared code |
| `test/db/*.db.test.ts` (9 files) | Project `db` (section 15) |
| `test/db/*.test.ts` (2 files) | Project `unit`, database-free (section 15) |

One file outside the owned paths was created as a side effect: `.locks/db-migrate.lock` (0 bytes),
by the one `db:migrate` run that used the lock the protocol prescribes (section 5.4).

## 3. The migration set

### 3.1 The four files

```
$ ( cd apps/core-server && shasum -a 256 src/db/migrations/*.sql ; wc -c src/db/migrations/*.sql )
ca4c6e034ea1d154c65e3723643e7999a1c99cee0ed339a9a56ba338ad603a0b  src/db/migrations/0000_prelude.sql
46b6bcbe51442598111ae47168d105ce1550063483bf00fde13fad24869224e9  src/db/migrations/0001_tables.sql
35429449ba9cfd1595b0285e75bb97370b9d921dd0ee100244e5650f6aa9cf41  src/db/migrations/0002_audit_guards.sql
7a054fd46ec24bf9d96480fcc040162a2d3256641467a23347c2530e450871d4  src/db/migrations/0003_privileges.sql
     727 src/db/migrations/0000_prelude.sql
   39407 src/db/migrations/0001_tables.sql
    3426 src/db/migrations/0002_audit_guards.sql
    3706 src/db/migrations/0003_privileges.sql
```

| Order | File | Kind | Bytes | Lines | Journal `when` | Content |
|--:|---|---|--:|--:|---|---|
| 1 | `0000_prelude.sql` | hand-written (`--custom`) | 727 | 19 | 1791079049782 | `dems_jsonb_is_flat(jsonb)` |
| 2 | `0001_tables.sql` | generated | 39,407 | 556 | 1791079050043 | 30 `CREATE TABLE`, 25 `ADD CONSTRAINT ... FOREIGN KEY`, 24 `CREATE [UNIQUE] INDEX`, 98 CHECKs, 15 UNIQUE |
| 3 | `0002_audit_guards.sql` | hand-written | 3,426 | 95 | 1791079059138 | Genesis row; `audit_chain_lock()`; the guard and its trigger; two refusal functions and triggers; three `ENABLE ALWAYS` |
| 4 | `0003_privileges.sql` | hand-written | 3,706 | 70 | 1791079059404 | REVOKE, GRANT (SELECT on all; INSERT on 16 tables; column UPDATE; DELETE on `active_session`; EXECUTE on two functions); the `schema_meta` row |

`meta/_journal.json`: SHA-256 `3300fa9a169a809b29c9ca1dee01c2f69be631e59984acafade30fe88e2fddca`,
four entries, `idx` 0 to 3, rising `when`. The hashes above are also what the migrator stored in
`drizzle.__drizzle_migrations` (asserted by `migrate.db.test.ts`, and printed by `db:status`).

### 3.2 How they were produced

```
npm run db:generate -w @dems/core-server -- --custom --name=prelude        -> 0000_prelude.sql
npm run db:generate -w @dems/core-server -- --name=tables                  -> 0001_tables.sql   ("30 tables")
npm run db:generate -w @dems/core-server -- --custom --name=audit_guards   -> 0002_audit_guards.sql
npm run db:generate -w @dems/core-server -- --custom --name=privileges     -> 0003_privileges.sql
```

The three `--custom` files keep the tool's first comment line; the SQL below it was written by
hand from the contract. The database-free test `contract-inventory.test.ts` compares the
STATEMENTS of each hand-written file (comment lines and white space removed) with the SQL block
of the contract (§8.3, §6.3, §8.3) and they are equal. The fallback file `0002a_extra_constraints`
of §8.2 was not needed: the tool emitted every constraint of section 4 under its name.

### 3.3 No drift (09:36)

```
$ npm run db:generate -w @dems/core-server -- --name=drift
No schema changes, nothing to migrate [emoji]
$ ( cd apps/core-server && npx drizzle-kit check )
Everything's fine [emoji]
$ diff <sha256 of the 9 files before> <after>
DIFF: none (same files, same hashes)
```

## 4. The typed schema: what later rows import

```ts
import { operators, authSessions, auditLog, ... } from '<...>/src/db/schema';          // tables, row types, value sets, constants
import { authSessionPublicColumns, ... } from '<...>/src/db/schema/public-columns';     // NL-6
import { BLOCKING_BOOT_CHECKS, checkStoredChain } from '<...>/src/db/schema/boot-checks';
```

| Group file | Table objects (TypeScript name) | Row types |
|---|---|---|
| `rbac.ts` | `roles`, `permissions`, `rolePermissions`, `operators`, `operatorCredentials` | `RoleRow`, `PermissionRow`, `RolePermissionRow`, `OperatorRow`, `OperatorCredentialRow` |
| `identity.ts` | `authSessions` | `AuthSessionRow` |
| `pairing.ts` | `pairingCodes`, `pairedDevices`, `deviceCredentials`, `biometricTokens`, `registryCounters` | `PairingCodeRow`, `PairedDeviceRow`, `DeviceCredentialRow`, `BiometricTokenRow`, `RegistryCounterRow` |
| `audit.ts` | `auditLog`, `auditChainHead`, `events`, `auditChainHistory` | `AuditLogRow`, `AuditChainHeadRow`, `EventRow`, `AuditChainHistoryRow` |
| `sessions.ts` | `activeSession`, `sessionHistory` | `ActiveSessionRow`, `SessionHistoryRow` |
| `evidence.ts` | `evidenceItems`, `evidenceTracks`, `evidenceCustody`, **`exportRecords`** (table `exports`) | `EvidenceItemRow`, `EvidenceTrackRow`, `EvidenceCustodyRow`, `ExportRow` |
| `core.ts` | `alerts`, `storagePolicy`, `consoleSettings`, `engineCounters`, `coreDevice`, `coreState`, `hardwareSnapshot`, `healthSnapshots` | `AlertRow`, `StoragePolicyRow`, `ConsoleSettingsRow`, `EngineCounterRow`, `CoreDeviceRow`, `CoreStateRow`, `HardwareSnapshotRow`, `HealthSnapshotRow` |
| `meta.ts` | `schemaMeta` | `SchemaMetaRow` |

Each select type has an insert twin (`New...Row`), from `$inferSelect` and `$inferInsert`.

| Convention | What the schema does |
|---|---|
| Time (TY-1) | `bigint(name, { mode: 'number' })`: a JavaScript number |
| Byte counts, durations, counters (TY-6) | Also `mode: 'number'`. The shared types are numbers, and MR-9 has the mapping assert `Number.isSafeInteger`. A value above 2^53-1 would be rounded on read (proof row, S-9) |
| Secret hashes and the salt (TY-5) | The one `bytea` type; `Buffer` in both directions. Seven columns use it |
| Value sets (TY-3) | `text` with `.$type<Union>()`; the lists are literals in `value-sets.ts`, NOT derived from the shared vocabulary at run time, so a change of a closed set is a visible edit followed by a migration (MG-11) |
| JSON columns | `jsonb(...).$type<SharedType>()` with type-only imports from `@dems/shared/sim` (erased at run time, so neither the server nor `drizzle-kit` loads the simulator through the schema) |
| Keys | Explicit names for every composite key, foreign key, UNIQUE, CHECK and index (N-4); every foreign key `.onDelete('restrict').onUpdate('no action')` |
| Descending index columns | `.desc().nullsFirst()`. PostgreSQL's default for `DESC` is NULLS FIRST, and the catalog then prints plain `DESC`, as the contract writes it. `.desc()` alone makes the tool emit `DESC NULLS LAST`, an index a query with `ORDER BY ... DESC` could not use for ordering |
| No hook | No `$onUpdate`, no `updated_at` automation (MR-8); asserted by a test |
| No query code | No repository, no seed |

## 5. The commands

All three run as `dems_owner`, with the five fields of `.data/pg.owner.env` parsed inside the
process (mode checked first; host must be `127.0.0.1`; the default PostgreSQL port is refused by
the constant `FOREIGN_DATABASE_PORT`; no default for host or port; every variable whose name
starts with `PG` is removed from the environment before a client exists). They verify after
connecting that the session is `dems_owner` and not a superuser. Nothing reads `.data/pg.pwfile`.

Order inside a command: the database name is checked first (closed list), then the owner file is
read, then a connection is opened. Exit codes: **0** done; **1** the command could not do its work
or the database is not in the state this code expects; **2** a wrong call (usage, refused name).

### 5.1 Real process runs (09:31, `dems_demo` does not exist)

```
$ npm run db:status -w @dems/core-server -- --database dems_demo
db:status: The database dems_demo does not exist. Create it with: npm run db:create -w @dems/core-server -- --database dems_demo
exit=1
$ npm run db:create -w @dems/core-server -- --database postgres
db:create: refused before any connection: the database name is not one of dems_demo, dems_lane_1, dems_lane_2, dems_lane_3. Test databases are reachable only through the test helper.
exit=2
$ npm run db:create -w @dems/core-server -- --database dems_test_local_abc12345_f01_x
db:create: refused before any connection: ... (the same line)
exit=2
$ npm run db:migrate -w @dems/core-server -- --database=dems_lane_9
db:migrate: refused before any connection: ... (the same line)
exit=2
$ npm run db:status -w @dems/core-server -- --database dems_demo --force
db:status: usage: npm run db:status -w @dems/core-server -- --database <dems_demo|dems_lane_1|dems_lane_2|dems_lane_3>
unexpected argument.
exit=2
$ npm run db:status -w @dems/core-server --
db:status: usage: npm run db:status -w @dems/core-server -- --database <dems_demo|dems_lane_1|dems_lane_2|dems_lane_3>
exit=2
$ /usr/bin/lockf -k .locks/db-migrate.lock npm run db:migrate -w @dems/core-server -- --database dems_demo
db:migrate: The database dems_demo does not exist. Create it first: npm run db:create -w @dems/core-server -- --database dems_demo
exit=1
```

None of these created or changed anything. An earlier attempt of the first four lines at 09:31
passed its arguments wrongly from a shell loop and ran nothing (npm reported a missing script);
it was repeated correctly, and the output above is from the repeat.

### 5.2 On a real database (`commands.db.test.ts`, 15 tests)

The commands are proven end to end on databases of the test run, through the function each
command-line entry calls, with the option `allowTestDatabase`, which no entry point sets and no
argument or environment variable reaches. Printed lines, as the tests assert them:

```
db:create: created <name> (owner dems_owner, encoding UTF8, locale C) on PostgreSQL 18.4 as dems_owner.
db:create: next: npm run db:migrate -w @dems/core-server -- --database <name>
db:create: <name> already exists (owner dems_owner, encoding UTF8, locale C); nothing to do.          (second run, exit 0)

db:migrate: <name> on PostgreSQL 18.4 as dems_owner
db:migrate: schema version before: none (not migrated)
db:migrate: applied 4 migration(s): 0000_prelude, 0001_tables, 0002_audit_guards, 0003_privileges
db:migrate: schema version after: 1 (dbc-2)

db:migrate: schema version before: 1 (dbc-2)                                                            (second run, exit 0)
db:migrate: no pending migration; nothing was applied.
db:migrate: schema version after: 1 (dbc-2)

database         <name> on PostgreSQL 18.4                                                              (db:status, exit 0)
owner            dems_owner; encoding UTF8; locale C
schema version   1; contract revision dbc-2; this code expects 1 (dbc-2)
migrations       4 file(s); ledger matches
  0000_prelude         applied  file sha256 ca4c6e03...603a0b  stored ca4c6e03...603a0b               (full hashes are printed)
  ... three more lines
seeded_at        not seeded
last_reset_at    never
audit head       seq 0; hash 0000000000000000...
audit triggers   audit_chain_history_append_only=A, audit_log_append_only=A, audit_log_chain_guard=A
lineage          0 row(s)
row counts       30 table(s)
  ... 30 lines
db:status: OK: <name> is at the schema version this code expects and the ledger matches the files.
```

`db:create` creates no role: `pg_roles` has the same number of rows before and after; when a
project role is missing it stops with a message that names `npm run pg:init` (OW-8). The one
statement built from a name is
`CREATE DATABASE <name> OWNER dems_owner TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'`, and the
name is a value that only the guard of `database-names.ts` produces.

### 5.3 The hash comparison of D38

The migrator decides "pending" by journal time, so `migrations.ts` compares each file's SHA-256
with the hash stored when it was applied (`inspectLedger`, `compareLedger`, `assertLedgerCurrent`).

| Case (test) | `db:status` | `db:migrate` |
|---|---|---|
| An applied file was edited | Exit 1. `migrations 4 file(s); ledger DOES NOT MATCH`; the line of the file reads `edited` with both hashes; `db:status: 0001_tables.sql was edited after it was applied: the file's SHA-256 is <16>..., the stored hash is <16>.... An applied file is never edited; a correction is a new file (MG-4).` | Exit 1, the same sentence; nothing applied |
| A file the migrator would skip (journal time not newer than the newest applied) | Exit 1; the line reads `skipped`; `... is not applied and never will be: ...` | Exit 1; the table of that file was not created |
| An applied row with no file | Exit 1; `(no file) unknown stored <hash> journal time <n>` | Exit 1 |
| Journal times that do not rise | Exit 1; `entry 0003_privileges is out of order` | Exit 1 |
| Migrated but files pending | Exit 1; `4 migration(s) are not applied: ...` | Applies them |
| The last file of the set fails | — | Exit 1 (`22012`); 0 tables, 0 functions, 0 migrator rows: the set is one transaction. The corrected set then applies |

**Limit, and a decision for the controller (DN-2).** D38 says "the boot check built on it fails".
The stored hashes are in `drizzle.__drizzle_migrations`, on which the runtime role has no
privilege (OW-5, and D38's own ruling). A check as `dems_app` therefore cannot read them. What
exists: `db:status` (exit code), `db:migrate` (refuses), and `assertLedgerCurrent(ownerPool)` for
the reset routine's step R-6 and for a start procedure. The server's own boot check B-3 compares
`schema_meta`, as the contract says.

### 5.4 The migrate lock

`db:migrate` starts no child process and does not take the lock itself. On `dems_demo` it is run
as `/usr/bin/lockf -k .locks/db-migrate.lock npm run db:migrate -w @dems/core-server -- --database dems_demo`
(P16, MG-9); the command prints a reminder line for that database. Lanes and test databases
migrate freely. Two `migrate()` calls on one empty database at the same time would not corrupt it:
the second fails on the first `CREATE FUNCTION` and rolls back (an inference from the
one-transaction behaviour proven above; not run).

## 6. Boot checks B-2 to B-9

Path: **`apps/core-server/src/db/schema/boot-checks.ts`**. Neither the plan row nor the contract
names a file, so the path the delegation gives for that case is used. It is not re-exported from
`index.ts`, so `drizzle-kit` never loads it. Nothing is registered and `app.ts` is untouched (D40).

| Check | Function | Blocking | Fails when (tested) |
|---|---|:-:|---|
| B-2 | `checkServerVersion(pool)` | yes | Major version not 18; encoding not `UTF8` (stand-in pool) |
| B-3 | `checkSchemaVersion(pool, expected?)` | yes | Another version or revision in `schema_meta`, in either direction; no table `schema_meta`. The message names both numbers and the migrate command |
| B-4 | `checkRuntimeRole(pool)` | yes | The pool is not `dems_app` or has a role attribute (a real owner pool: `rolcreatedb`) |
| B-5 | `checkAuditProtection(pool)` | yes | A trigger in the default mode; UPDATE, DELETE or TRUNCATE on `audit_log` or `audit_chain_history`; INSERT on `audit_chain_history`; UPDATE on `audit_chain_head`; also when granted on ONE COLUMN only (six real grants on a clone, each revoked again) |
| B-6 | `checkSeeded(pool)` | yes | `core_state` has no row; names the seed command |
| B-7 | `checkChainHead(pool)` | yes | Head sequence or hash differs from the newest row (set by hand as the owner on a clone) |
| B-8 | `checkStoredChain(pool, { limit?, verifyDigests? })` | **no** | Returns a report (`ok`, `rowsChecked`, `linkBreaks`, `digests`, `lineage`, `problems`); never throws for a chain that does not verify. Tested with a forged digest and with the lineage rule LN-3 |
| B-9 | `checkOwnerRole(pool)` | yes | `dems_owner` has a role attribute; a guarded object belongs to another role (stand-in pool) |

`BLOCKING_BOOT_CHECKS` is the list B-2, B-3, B-4, B-5, B-6, B-7, B-9 in order. For W21:

```ts
for (const check of BLOCKING_BOOT_CHECKS) {
  app.readiness.addBootStep({ id: check.id, run: () => check.run(app.db.pool) });
}
// B-8 between B-7 and B-9, not blocking: log `report.problems` when `report.ok` is false.
```

Two choices of this row. (1) B-5 asks `has_any_column_privilege` as well as `has_table_privilege`
for UPDATE and INSERT: a grant on one column would otherwise pass, and a column grant is enough
for `SELECT ... FOR UPDATE` (PG-25). (2) B-8's digest check is a parameter: the database checks
links, not digests (GD-01); the digest needs the shared `verifyAuditChain`, and passing it in keeps
the one row mapping of MR-1 in W20's module instead of a second one here. Without the parameter
the report says `digests: 'not-checked'`.

**T-PV-3** runs the real app factory on a clone, with these checks added as boot steps: a pool
configured with the owner role stops at `B-4` (steps passed: `B-1`, `B-2`, `B-3`); one trigger set
back to the default mode stops at `B-5` (passed: `B-1` to `B-4`); a migrated, never seeded clone
stops at `B-6`; a migrated and seeded clone passes all eight. `server.listening` is false in every
case. The failing step's log line is written by `src/index.ts`, which a test cannot start against
a clone; the test asserts `BootError.stepId` and the `boot step passed` lines.

## 7. The catalog comparison

Expected side: `test/db/contract-inventory.json`, parsed from sections 2.4 and 4 of the contract by
`test/db/contract-inventory.ts` (30 column tables, 30 key tables, the value sets and format rules
written out). The database-free test parses the contract again on every run and fails when the
checked-in file differs. Actual side: `information_schema.columns`, `pg_constraint`, `pg_index`,
`pg_proc`, `pg_trigger` of a clone of `tpl_schema`.

```
[w17] catalog of dems_test_step_39_tmd29f6c_f02_catalog
  contract: {"tables":30,"columns":302,"primaryKeys":30,"foreignKeys":25,"uniques":15,"uniqueIndexes":2,"indexes":22,"checks":98}
  catalog : {"tables":30,"columns":302,"primaryKeys":30,"foreignKeys":25,"uniques":15,"uniqueIndexes":2,"indexes":22,"checks":98}
  diff (0 line(s)): (empty)
[w17] pg_constraint in public by contype: {"c":98,"f":25,"n":245,"p":30,"u":15} (n = NOT NULL constraints of PostgreSQL 18)
```

| Compared | How |
|---|---|
| Tables | Names, both directions |
| Columns | Name, position, type, nullability, default (cast removed), for all 302 |
| Primary keys, UNIQUE | Name and column list |
| Foreign keys | Name, columns, target; `confdeltype = 'r'`, `confupdtype = 'a'` (K-2) |
| Indexes, unique indexes | Name, column list with direction, predicate (casts and parentheses removed) |
| CHECK | Name; the columns it names; its string literals; its numbers. PostgreSQL rewrites the expression (`IN` becomes `= ANY (ARRAY[...])`, `BETWEEN` becomes two comparisons), so these three survive and are compared |
| Functions | 5: name, arguments, result, language, `SECURITY DEFINER`, volatility, parallel safety, `search_path` setting, owner, and **the body against the migration file** (GD-13) |
| Triggers | 3: table, name, `tgenabled = 'A'`, `pg_get_triggerdef` |
| Nothing else | No sequence, view, enum or domain in `public`; 69 indexes = 30 + 15 + 22 + 2 |

The comparison is not vacuous: a second test changes ten things in a copy of the inventory (a type,
a default, a nullability, a value list, a number, a predicate, a direction, a foreign-key target,
a key, an extra CHECK) and expects exactly ten difference lines.

**The counts agree on both sides**: the contract's text (§15.6), the parse of its tables, the typed
schema, the generated SQL and the catalog all give 30 / 302 / 98 / 25. One defect was found on the
way and it was in this row's parser, not in the contract or the schema: the macro pattern did not
accept the column name `sha256`, which left `HEX64(sha256)` unexpanded and produced one difference
line; corrected, with the inventory regenerated.

Behaviour, beside the catalog (`constraints.db.test.ts`, 134 tests): one refused row for **each of
the 98 CHECKs** (96 by the constraint's own name with `23514`; 2 that another rule refuses first,
section 13 CD-4); one refused row for **each of the 25 foreign keys** (`23503`); a referenced row
cannot be deleted (`23001`, seven tables) or re-keyed (`23503`); uniqueness (`23505`) for every
reachable rule; and one valid row accepted in each of the 30 tables.

## 8. Verification

### 8.1 The row command (09:36:51)

```
$ DEMS_TEST_STEP=39 npm run test:db -w @dems/core-server -- test/db
> vitest run --project db test/db
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_39_tmd39fsv_
[test:db] stale sweep: dropped 0; kept 0 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
[test:db] template tpl_seed: not built, no hook is plugged in (row W20: src/db/seed/__tests__/template-hook.seed.ts)
[test:db] template dems_test_step_39_tmd39fsv_tpl_schema: built in 81 ms (create 29 ms, hook 50 ms)
 Test Files  9 passed (9)
      Tests  233 passed (233)
   Start at  09:36:51
   Duration  4.45s (tests 82%, import 12%, transform 5%)
[test:db] teardown: dropped 2 database(s) in 29 ms; 0 remain with the run prefix dems_test_step_39_tmd39fsv_
exit=0
```

The same suite with `--reporter=verbose --silent=false` (09:37): exit 0, 233 pass marks. The
quotes below are from verbose runs.

### 8.2 Migrate on an empty clone, then a second run (AC-B-01)

```
[w17] first migrate: applied 0000_prelude, 0001_tables, 0002_audit_guards, 0003_privileges in 57.5 ms; 30 tables
[w17] second migrate: applied 0 migration(s) in 1.6 ms; the migrator's table still holds 4 rows
 [pass] the clone is empty: no table, no migrator table, no schema version
 [pass] first run, as dems_owner: applies the four files and sets schema version 1 (dbc-2)
 [pass] second run: applies nothing and changes nothing (MG-10)
 [pass] the migrations inserted the two mechanism rows and no dataset row (MG-8)
 [pass] the migrator's table is in schema drizzle, owned by dems_owner, and closed to the runtime role (D38, OW-5)
```

The session that migrates reports `current_user = dems_owner`, `rolsuper = false`. After the
second run the migrator's rows and the object count of `public` are unchanged.

### 8.3 Audit guards and the chain

| Test | What ran | Result |
|---|---|---|
| T-AO-1 | As `dems_app`: `UPDATE audit_log SET message = 'x' WHERE seq = 1`; `DELETE ... WHERE seq = 1`; `TRUNCATE audit_log`; an UPDATE that matches no row | `42501` four times; table checksum unchanged; `has_table_privilege` false for UPDATE, DELETE, TRUNCATE; true for INSERT, SELECT |
| T-AO-2a | The same as `dems_owner`, with `UPDATE ... WHERE false` | `ZA002` four times, message `audit_log is append-only: <OP> refused`; checksum unchanged |
| T-AO-2b | `SET session_replication_role = replica` as `dems_owner` and as `dems_app` | `42501` both; the mode stays `origin` |
| T-AO-2d | The contract's statement, as `dems_app` | Three rows, each `'A'` |
| T-AO-3 | One lineage row. As `dems_app`: INSERT, UPDATE, DELETE, TRUNCATE. As `dems_owner`: UPDATE, DELETE, TRUNCATE | `42501` four times; `ZA002` three times, message `audit_chain_history is append-only: <OP> refused`; checksum unchanged; INSERT privilege false; the owner's INSERT works |
| T-AO-4 | The scaffold's static test `test/static/audit-protection.test.ts` | Passes with this row's files in the tree (section 8.8) |
| T-CH-1 | 50 tasks on a pool of 10 `dems_app` connections, each AP-1 to AP-5 with a pause of 0 to 20 ms between lock and INSERT; rows built with the shared `auditId` and `chainHash` | `50 commits, 0 errors; seq 2..51 without a gap; verifyAuditChain ok=true over 51 rows`; 10 in flight at once; head = last row |
| T-CH-2 | Two sessions read the head with a plain SELECT and insert the same next row; a gap row; a wrong `prev_hash` | One commits; the other waits inside the guard and gets `ZA001`. Gap and wrong link: `ZA001`, message `audit chain: row N does not continue head M`; also for the owner; table unchanged |
| T-CH-3 | As `dems_app`: `UPDATE audit_chain_head SET seq = 0`; `SELECT ... FOR UPDATE`; DELETE; INSERT | `42501` four times |
| Lock | Two `dems_app` sessions call `audit_chain_lock()` | The second waits (seen in `pg_locks`) until the first COMMITs, then returns the committed head `seq 1` (PG-04, PG-05, PG-06) |

### 8.4 T-PV-1 and T-PV-2

```
[w17] T-PV-1: UPDATE is granted on 106 of 302 columns (30 of them are every column of active_session)
[w17] T-PV-1 live: 106 column UPDATEs allowed, 196 refused with 42501, 0 unexpected
[w17] T-PV-2 ownership in dems_test_step_39_..._privileges:
  database           dems_owner  x1
  drizzle index      dems_owner  x1
  drizzle sequence   dems_owner  x1
  drizzle table      dems_owner  x1
  public function    dems_owner  x5
  public index       dems_owner  x69
  public table       dems_owner  x30
  schema drizzle     dems_owner  x1
```

The expected matrix is written in the test from the table of §7.3, not from the migration file.
Catalog: 30 tables times 8 privileges (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES,
TRIGGER and PostgreSQL 17's MAINTAIN) and 302 column UPDATE privileges equal the matrix. **Live as
`dems_app`**: for every table one SELECT, INSERT, DELETE and TRUNCATE, and one UPDATE per column
(302 statements), each matching no row; the outcomes equal the matrix (120 + 302 statements, 0
unexpected). Functions: EXECUTE for `dems_app` on `audit_chain_lock()` and
`dems_jsonb_is_flat(jsonb)` only, for PUBLIC on none; live, the three trigger functions are
refused with `42501`. `dems_app` cannot `CREATE TABLE` in `public`, `CREATE SCHEMA`,
`CREATE DATABASE`, `CREATE ROLE`, read `drizzle.__drizzle_migrations`, change a trigger or alter a
function (`42501` each). No `ALTER DEFAULT PRIVILEGES` exists; a table added without grants is
closed to `dems_app`.

T-PV-2: `dems_owner` has `rolcreatedb` and no other attribute; `dems_app` has none; no row of
`pg_auth_members` or `pg_db_role_setting` names either. As `dems_owner`: `CREATE ROLE` `42501`;
the session setting `42501`; `ALTER DATABASE postgres RENAME TO ...` `42501`
(`must be owner of database postgres`). T-PV-3: section 6.

### 8.5 Ownership

The table of 8.4: the database, 30 tables, 69 indexes, 5 functions, schema `drizzle` with its
table, index and sequence all belong to `dems_owner`. Schema `public` belongs to
`pg_database_owner`, the pseudo-role "the owner of this database". Nothing belongs to the
bootstrap superuser.

### 8.6 T-AT-1 to T-AT-5 (the contract's exact statements, as `dems_app`, without AP-2)

Every participant is a session of its own. Every race is forced: a holder session takes the row
lock, the participants send their statements, the test waits until `pg_locks` shows every one of
them waiting, and only then releases the holder.

| Test | Sessions | Result |
|---|---|---|
| T-AT-1 | A sign-in (AT-C1) and a disable (AT-C5) of the same operator; the disable commits first while the sign-in's UPDATE waits on its row lock | The sign-in's first UPDATE returns no row; no `auth_sessions` row is inserted; the operator's one open session ends `USER_DISABLED`. Control: alone, the UPDATE returns the row and the session is inserted |
| T-AT-2 | 20 sessions run the consuming UPDATE of AT-C2; all 20 wait on the one `ACTIVE` row | `20 sessions waited at once; attempts taken [1,2,3,4,5]; 15 got no row; code EXHAUSTED at failed_attempts 5`; one closing UPDATE; `closed_at` set |
| T-AT-3 | Two sessions run AT-C2 then AT-C3 with the right code | One redeems; the other gets no row. One `paired_devices` row and one `device_credentials` row; the code is `REDEEMED` with `failed_attempts` 2, as before; the device counter moved by 1. A second device for the code: `23505` on `paired_devices_paired_with_code_id_key`. AT-5: 20 concurrent mints give 20 consecutive numbers |
| T-AT-4 (a) | Two sessions run the first UPDATE of AT-C4 on one token | One row in total; one new token row, one new `BIOMETRIC` session |
| T-AT-4 (b) | The used token again, with an open `BIOMETRIC` and an open `PASSWORD` session on that device and a `BIOMETRIC` session on another device | Both rows of the family revoked with `TOKEN_REUSE`; only the `BIOMETRIC` session of that device and operator ends `TOKEN_REUSE`; ending the `PASSWORD` session with `TOKEN_REUSE`: `23514` on `auth_sessions_token_reuse_check` |
| T-AT-5 | Exactly two enabled administrators; two sessions each run the lock SELECT and then demote a different one. Variant: one demotion, one disable | The second waits at the SELECT, reads the committed result, counts one administrator, refuses; afterwards one enabled operator holds `USER_ADMIN`. Both variants |
| Other transitions | End, touch, rotate, cancel, expire, revoke, unpair, promote | Each changes one row once and none the second time; a second `ACTIVE` code: `23505` on `pairing_codes_one_active_key` |

The contract numbers its parameters sparsely (`$1`, `$2`, `$5`, ...); the driver wants a dense
list, so the test renumbers them and changes nothing else in the statements.

### 8.7 Boot checks, commands, PostgreSQL behaviours

Sections 6, 5 and 12. 25, 15 and 7 tests.

### 8.8 Unit project, typecheck, lint (09:37)

```
$ npm run test -w @dems/core-server -- --maxWorkers=2          (inside the sandbox: no database is reachable)
 Test Files  31 passed (31)
      Tests  979 passed (979)
unit exit=0
$ npm run typecheck -w @dems/core-server      exit=0
$ npm run lint -w @dems/core-server           exit=0, 0 warnings
$ npm run typecheck   (root)                  exit=0
$ npm run lint        (root)                  exit=0
```

The scaffold's static guards (`test/static/*.test.ts`) are among the 31 files and pass with this
row's files present. No exception had to be asked for; three things were written with the guards
in mind: the comment of statement group 6 does not name the session setting (CD-1); no file of
this row contains the forbidden statements; the default PostgreSQL port appears nowhere (the
constant of `src/config.ts` is imported).

## 9. `dems_demo`

Left **absent**. The plan row W17 [PL:684] names no project database: its verification is
`test:db` on clones, and W20's row reads "the first build of `dems_demo` (create, migrate,
seed)". `pg_database` at 09:37 holds `postgres`, `template0`, `template1` and nothing else.
`db:create` and `db:migrate` are proven on a database of the test run (section 5.2).

## 10. D-1: is the last committed instant stored? (D28; `SCHEMA-GAP-1`)

**Yes. `SCHEMA-GAP-1` is not raised.**

| Column | Table | Written | What it gives |
|---|---|---|---|
| **`written_at`** `bigint NOT NULL` | `hardware_snapshot` (T-27) | With every snapshot write: at most once a second when a slice changed, and at shutdown (§4.27; spec §8.6 "Stop"). The `health` slice changes at 1 Hz, so while the server runs it advances about every second (GD-03). In the runtime role's UPDATE grant | The engine's last persisted instant, at most about one second behind the last tick. After a clean stop: the stop instant exactly |
| `updated_at` `bigint NOT NULL` | `active_session` (T-15) | With every write of the session row: a transition at once, the progress columns at most once a second | The instant the stored `bytes_written` belongs to |
| `at` of the newest row | `audit_log`, `events` | With every appended row | A lower bound that keeps `at` from going backwards |

The shared `enterFault` computes the bytes as `recordingBytes(now - session.startedAt)`
(`session-machine.ts:916-918`), so the instant to pass to `injectFaultTransition` is the latest
one at which the engine is known to have committed. That is
`GREATEST(hardware_snapshot.written_at, active_session.updated_at)`, and the newest audit `at` if
it is later. All three are stored.

What this answer rests on, for the controller to overrule if it reads D-1 more strictly:

1. No column is DEFINED as "the instant of the last committed unit of work". The instant is the
   greatest of the stored write instants. Its precision is the write cadence: up to about one
   second of recording before a crash is not counted, which is what "last committed" means.
2. W26 must read it during rehydration, BEFORE the epoch update and before any row of the new run
   is written (the tablet-link row of §8.6 is stamped at the restart instant).
3. If W26 lowers the snapshot cadence (GD-03 allows it), the instant lags by that cadence.

If a single authoritative column is wanted instead, the proposal is
`core_state.last_committed_at bigint NOT NULL`, set by every unit of work, added to the UPDATE grant
of `core_state`. Before the gate of this row the migration folder may still be regenerated (MG-4);
after it, that is a forward migration and schema version 2. This row did not add it: the contract
does not have it and the purpose is met without it.

## 11. The server log: what a violation writes into `.data/postgres.log`

Rule 7 of the delegation, and finding F-2 of the helper row. Run live as `dems_app` by
`pg-behaviours.db.test.ts`, which reads only what the server appended while its statements ran and
searches it for values the test made up at random. **Nothing was added to PostgreSQL's
configuration.**

```
[w17] server log check: the made-up secret occurs 0 times in what the server appended; 7 STATEMENT lines, each with placeholders only; 6 DETAIL line(s) carry a stored hash value:
  DETAIL:  Key (token_hash)=(\x6059086e693d573b607978c6274d9aa7aa76223dfd73ed6553d658acbb47bc1a) already exists.
  DETAIL:  Failing row contains (74e6eb36-d460-48bb-8344-10b0f0570d86, \xb7f89bf16d7b068402a76b5109ed7c38d313e08d704657298790856a4727c3..., OPR-002, null, PASSWORD, 1790823   (cut)
  DETAIL:  Failing row contains (OPR-002, argon2id, 19456, 2, 1, \x07070707070707070707070707070707, \xd1371196f26483c2d9059bac18160fc932bec68c6cf90b65266d2357ff2ece, 17908   (cut)
  DETAIL:  Key (current_hash)=(\xfed7fd4bd198040d3a9b3cb4f5aff1194dd745a4a53824795a5e3c75bafb4c3f) already exists.
  DETAIL:  Key (next_hash)=(\x303c20e89892d3bd867c738d6e65b275fdda798497e02d758974f7d9468a1356) already exists.
  DETAIL:  Key (token_hash)=(\x769739c71eb3850ccdda41c0f9b2a38da4802e061f4f9aa8f687a8e1877f9ecf) already exists.
```

**For each UNIQUE or FOREIGN KEY on a column that stores the hash of a secret:**

| Constraint | Column | A violation writes | The secret itself |
|---|---|---|---|
| `auth_sessions_token_hash_key` | `auth_sessions.token_hash` | `ERROR: duplicate key value violates unique constraint "auth_sessions_token_hash_key"`; `DETAIL: Key (token_hash)=(\x<64 hex digits>) already exists.`; `STATEMENT: INSERT ... VALUES ($1, ...)` | Never: the server receives only the SHA-256 |
| `device_credentials_current_hash_key` | `device_credentials.current_hash` | `DETAIL: Key (current_hash)=(\x<64 hex digits>) already exists.` | Never |
| `device_credentials_next_hash_key` | `device_credentials.next_hash` | `DETAIL: Key (next_hash)=(\x<64 hex digits>) already exists.` | Never |
| `biometric_tokens_token_hash_key` | `biometric_tokens.token_hash` | `DETAIL: Key (token_hash)=(\x<64 hex digits>) already exists.` | Never |

All four were produced and read back. **No foreign key sits on a hash column.**
`pairing_codes.code_hash` has no UNIQUE, no index and no foreign key (§5.2), and
`operator_credentials.salt` and `.hash` have none either, so a key violation never names them.
A foreign-key violation names an ID: `Key (operator_id)=(OPR-777) is not present in table "operators".`

**Wider than the rule asked (finding F-1 of this row).** A CHECK violation, and by the same
server code a NOT NULL violation, writes `DETAIL: Failing row contains (...)` with EVERY column of
the row the statement tried to write, because the runtime role may read every column. Each value
is cut at 64 bytes, so 31 of the 32 bytes of a hash are shown. Observed for `auth_sessions` (the
token hash) and for `operator_credentials` (the salt in full and the hash value of the refused
UPDATE). NL-1 says these columns must not appear in a log line; with the default logging they can,
in the PostgreSQL server log, whenever a statement on those tables is refused by a constraint.
What bounds it: such a row is a defect (the server always sends 32-byte hashes and valid states),
the file is mode 0600 under `.data/`, and what is shown is a hash, never a token, a code or a
password. The six settings of NL-5 are at their defaults, four of the five that decide what is
logged can be changed by a superuser only, and `log_parameter_max_length_on_error` can be set by
any role for its own session (no program of the project does). Decision DN-3.

## 12. PG-01 to PG-28

| ID | State | Evidence |
|---|---|---|
| PG-01 | **Confirmed** | T-AO-1; T-PV-1 live: `42501`; TRUNCATE is a privilege of its own (refused on all 30 tables) |
| PG-02 | **Confirmed** for the owner; the superuser half is W07's T5-j | T-AO-2a: `ZA002` as `dems_owner` |
| PG-03 | **Confirmed** | The trigger exists as written; `UPDATE ... WHERE false` is refused with `ZA002` |
| PG-04 | **Confirmed** | `SELECT ... FOR UPDATE` on `audit_chain_head` as `dems_app`: `42501`; `audit_chain_lock()` works for `dems_app`; its owner is `dems_owner`, not a superuser |
| PG-05 | **Confirmed** | The second caller of the lock gets the committed head (`seq 1`); T-AT-5 reads the committed role |
| PG-06 | **Confirmed** | The second caller stays in `pg_locks` as waiting until the first COMMITs |
| PG-07 | **Confirmed** | `ZA001` and `ZA002` arrive as `error.code` |
| PG-08 | **Confirmed** | `pairing_codes_one_active_key`, `biometric_tokens_one_live_key`: `23505` inside the predicate; duplicates accepted outside it |
| PG-09 | Not exercised here | W07 trial T5-c; W29 |
| PG-10 | **Confirmed**, first half | Every test database is a clone, and T-PV-1 ran on one. Second half: the clone has the defaults (CONNECT and TEMPORARY for every role, CREATE for none); the template had no database-level grant to copy, so "not copied" is not distinguishable here |
| PG-11 | **Confirmed** | `12345678901234567890.123456789` kept; U+0000: `22P05`, also through a bind parameter |
| PG-12 | Not exercised here | W98 |
| PG-13 | **Confirmed** (functions, 63 bytes); the forced drop is W07's and the helper's | `sha256('abc')` equals Node's; `repeat('a', 70)::name` is 63 bytes; no extension installed |
| PG-14 | Not used | No ENUM type exists (catalog test) |
| PG-15 | **Confirmed** | The whole set, with `REVOKE` and `GRANT` on `public` and `CREATE SCHEMA drizzle`, ran as `dems_owner`; `dems_app` connects to a new database and cannot create a table in `public` even before the revoke |
| PG-16 | **Corrected** | The STATEMENT line holds placeholders only (7 of 7). But the DETAIL line of a unique or foreign-key violation holds the key VALUE, and that of a CHECK or NOT NULL violation the whole failing row (section 11) |
| PG-17 | **Confirmed**, all three clauses | EXECUTE revoked from PUBLIC (catalog and live); the guard fires for `dems_app`, which has no EXECUTE on it; with EXECUTE on `dems_jsonb_is_flat` revoked, an INSERT by `dems_app` fails with `42501 permission denied for function dems_jsonb_is_flat` |
| PG-18 | Not relied on | One INSERT per row (AP-4) |
| PG-19 | **Confirmed** | `CREATE DATABASE $1`: `42601` |
| PG-20 | **Confirmed** | `lower('ÀÉZ')` is `ÀÉz`; the sort order of `a B é Z _` is `BZ_aé` |
| PG-21 | **Confirmed**, first sentence; the rest is W07's T5-j | `tgenabled = 'A'` for the three triggers |
| PG-22 | **Confirmed** for both project roles | `42501`, `permission denied to set parameter "session_replication_role"` |
| PG-23 | **Confirmed** in part | As `dems_owner`: `CREATE DATABASE ... TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'` with itself as owner (`db:create`); `CREATE ROLE`: `42501`; renaming a database it does not own: `42501`. The rest: W07, the helper |
| PG-24 | **Confirmed** | T-AT-1 to T-AT-4: a waiting UPDATE evaluates its predicate again and returns nothing |
| PG-25 | **Confirmed** | T-AT-5: `FOR UPDATE` on `operators` with a column-level grant only (`has_table_privilege` false, `has_any_column_privilege` true); T-CH-3: `42501` without any |
| PG-26 | Not exercised here | W07 trial T5-h; the helper never forces a drop over another role's session |
| PG-27 | **Confirmed**, and narrower than written | `dems_owner` sees `datname`, `pid`, `usename`, `application_name` of a `dems_app` session; `query` reads `<insufficient privilege>`; `client_addr`, `state` and `backend_type` are NULL (the helper row's F-1) |
| PG-28 | Not exercised here | W07 trial T3-a, T3-b |

21 confirmed (PG-02, PG-10, PG-13, PG-21 and PG-23 for the part this row can reach; PG-27 with a narrower result), 1 corrected (PG-16), 6 not exercised here (PG-09, PG-12, PG-26, PG-28; PG-14 is not used and PG-18 is not relied on).

## 13. Contract deviations and corrections

Nothing in the schema deviates: every table, column, type, default, key, constraint, index,
function, trigger and grant is the contract's, and the catalog test shows it.

| ID | What | Reason and evidence |
|---|---|---|
| CD-1 | **A comment, not a statement.** The comment above statement group 6 in `0002_audit_guards.sql` says "the replication-role session setting" instead of naming the setting | The scaffold's static guard T-AO-4 allows that name only under `test/db/`, and the migration folder is not there. The statements are the contract's: the unit test compares them |
| CD-2 | **Contract §6.2, row "a GRANT to `dems_app`", column `dems_app`: "Refused: not the owner, `42501`" is not what PostgreSQL 18.4 does** | A GRANT by a role that holds some privilege on the object without the grant option is not an error: the server answers with warning `01007`, `no privileges were granted for "audit_log"`, and grants nothing. With no privilege at all on the object (a function it may not execute) it is `42501`. The outcome the contract wants holds: no new privilege. Tested for `audit_log`, `audit_chain_history` and a trigger function |
| CD-3 | **PG-16 and NL-3 are true of the STATEMENT line only** | Section 11 |
| CD-4 | **Two CHECKs cannot be broken alone, and three UNIQUE constraints cannot be broken at all** | `audit_log_seq_check`: the guard trigger runs first and answers `ZA001`. `paired_devices_state_check`: the lifecycle rule lists the three states, and CHECKs run in name order, so `paired_devices_lifecycle_check` answers. `audit_log_id_key` and `events_id_key`: the ID is a function of `seq` by CHECK, and `seq` is the key. `audit_log_prev_hash_key`: the guard fixes `prev_hash`. All five exist in the catalog as the contract lists them; they are second lines of defence |
| CD-5 | The CHECK and NOT NULL counts | PostgreSQL 18 catalogues NOT NULL as constraints (`contype = 'n'`, 245 here). "98 named CHECKs" is `contype = 'c'` |
| CD-6 | The TypeScript name `exportRecords` for the table `exports` | `exports` is a reserved binding in the CommonJS form in which `drizzle-kit` loads a schema file. The table name is the contract's |

## 14. Needs review

| ID | Item | Evidence | Proposed resolution |
|---|---|---|---|
| **NR-1** | **One test of the helper row (W11) fails now that this row's hook exists.** `apps/core-server/test/helpers/db/__tests__/nested-run.db.test.ts:83` expects `teardown: dropped 1 database(s)` from a nested run under the real global setup. That was true while no hook was plugged in. With `test/db/template-hook.schema.ts` the nested run also builds `tpl_schema`, so its teardown reports 2. What the test is about still holds: `0 remain with the run prefix`, and the catalog query of the next line returns nothing | `whole db project exit=1`; `Test Files 1 failed \| 18 passed (19)`; `Tests 1 failed \| 284 passed (285)` (09:36:56). Alone: `[test:db] template dems_test_step_39thr_..._tpl_schema: built in 78 ms`; `teardown: dropped 2 database(s) in 31 ms; 0 remain ...` | One line, by the owner of `test/helpers/**`: replace `dropped 1 database` by `dropped \d+ database` in that pattern, and its comment "only the template left" by "only templates left". The count becomes 3 when W20 adds the seed hook. This row may not edit `test/helpers/**` and did not |

## 15. Test ledger (P24)

`@dems/core-server` only.

| Project | Before this row | After (09:37) | This row |
|---|---|---|---|
| `db` | 10 files, 52 tests | **19 files, 285 tests: 284 passed, 1 failed (NR-1, a file of W11)** | **9 files, 233 tests**, all passing |
| `unit` | 24 files, 526 tests (09:05, this row's `src/` files present, no test of this row yet) | 31 files, 979 tests, 0 failed | **2 files, 108 tests**. The other 5 files and 345 tests were added by rows that ran at the same time |

| Project | File (`apps/core-server/test/db/`) | Tests |
|---|---|--:|
| `db` | `migrate.db.test.ts` | 6 |
| `db` | `catalog.db.test.ts` | 10 |
| `db` | `audit-guards.db.test.ts` | 11 |
| `db` | `atomic.db.test.ts` | 12 |
| `db` | `privileges.db.test.ts` | 13 |
| `db` | `boot-checks.db.test.ts` | 25 |
| `db` | `constraints.db.test.ts` | 134 |
| `db` | `commands.db.test.ts` | 15 |
| `db` | `pg-behaviours.db.test.ts` | 7 |
| `unit` | `contract-inventory.test.ts` | 38 |
| `unit` | `commands.test.ts` | 70 |

No existing test was changed. The two `unit` files need no database; they read the contract file
under `docs/`, and fail with a clear error if a contract revision changes a table without a
regenerated inventory (`node apps/core-server/test/db/contract-inventory.ts --write`).

## 16. Measurements (this host, PostgreSQL 18.4, the real schema)

| What | Measured |
|---|---|
| `tpl_schema` build by the global setup | 75 to 156 ms (create 26 to 43 ms; hook, which is the four migrations, 47 to 110 ms) |
| `migrate()` on an empty database, the call | 43 to 58 ms; second run 1.6 ms |
| Clone of `tpl_schema` | First 41.9 ms; of 7: min 37.7, median 39.2, max 41.9 ms |
| Drop | Median 12.6 ms |
| Size of a migrated database | 9,430 kB (the helper row's one-table template: 7,814 kB) |
| This row's database tests | 4.5 s for 233 tests |
| `drizzle-kit generate` for 30 tables | Under 1 s |

## 17. Findings

| ID | Finding | Evidence |
|---|---|---|
| F-1 | A CHECK or NOT NULL violation logs the whole failing row, hash columns and salt included, each value cut at 64 bytes | Section 11 |
| F-2 | A GRANT by a role without the grant option is a warning, not an error | CD-2 |
| F-3 | Every role may create TEMPORARY tables and connect to a new database (PostgreSQL defaults for PUBLIC). The contract's matrix is about tables of `public` and does not mention it; no migration changes it. `pg_temp` is last in the pinned `search_path` of the two SECURITY DEFINER functions, as the contract writes it | `has_database_privilege('dems_app', ..., 'TEMPORARY')` is true |
| F-4 | `log_parameter_max_length_on_error` has context `user`: any role may set it for its own session, and bind parameters of a failed statement would then be logged. No program sets it; the scaffold's static guard does not search for it | `pg_settings`, section 11 |
| F-5 | `drizzle-kit` emits `DESC NULLS LAST` for `.desc()`; the contract's `DESC` is PostgreSQL's default, NULLS FIRST | Section 4 |
| F-6 | drizzle-orm's wrapper error repeats the whole statement in its message; the SQLSTATE is on `cause`. The commands print the cause's class, code and server message only | `cli.ts`; `commands.test.ts` |
| F-7 | PostgreSQL 18 catalogues NOT NULL constraints in `pg_constraint` | CD-5 |
| F-9 | One run of this row's database tests adds 184 kB and 1,281 lines to `.data/postgres.log`; the helper row measured 40 kB for its own suite. The file is not rotated; the clean-rebuild row recreates `.data/` | Section 19 |
| F-8 | The helper's private templates are keyed per run: two inline definitions of one key in one test file are refused, so this row shares one constant (`EMPTY_DATABASE` in `test/db/support.ts`) | First run of `commands.db.test.ts` |

## 18. Decisions for the controller to record

| ID | Question | Recommendation |
|---|---|---|
| DN-1 | NR-1: who changes the one line of the helper's test? | The helper row's owner, or a controller ruling that lets the migration writer do it. Until then `npm run test:db` as a whole exits 1 |
| DN-2 | D38's "the boot check built on it fails": the runtime role cannot read the migrator's table | Accept: `db:status` and `db:migrate` carry the hash check; R-6 of the reset calls `assertLedgerCurrent`; the gate rows run `db:status`. The alternatives change the contract: SELECT for `dems_app` on the migrator's table (against OW-5), or a digest column in `schema_meta` |
| DN-3 | F-1: hash columns and the salt can reach the PostgreSQL log through a constraint violation | Route to the backend security review (W45). Options: (a) accept and reword NL-1, NL-3 and PG-16: the PostgreSQL log may hold hashes, never a secret; (b) at provisioning, as the superuser, `ALTER ROLE dems_app SET log_error_verbosity = terse`, which drops DETAIL lines for that role, changes OW-9 and NL-5, and loses the key detail when debugging. Nothing was changed by this row |
| DN-4 | Section 10: `SCHEMA-GAP-1` not raised | Accept, and pass the three notes of section 10 to W26. If a dedicated column is preferred, rule before this row's gate |
| DN-5 | F-4: add the setting name `log_parameter_max_length_on_error` to the scaffold's static guard? | Yes, one pattern in `test/static/audit-protection.test.ts` (W08's file) |
| DN-6 | `db:status` exits 1 for any state the server would refuse (not migrated, pending, another version, ledger mismatch, a trigger not `'A'`, another owner), 0 otherwise; "not seeded" is printed and is exit 0 | Record as the meaning of the exit code for W58, W86 and W90 |
| DN-7 | CD-2: reword the cell of §6.2 | "No effect: warning `01007`, nothing is granted (`42501` when the role holds no privilege on the object)" |
| DN-8 | Should `db:migrate` take the reset's advisory lock (442001, slot) as well as rely on the caller's `lockf`? | Not done: it would give key 442001 a second meaning. It would make a migration and a reset of one target exclude each other inside the database |
| DN-9 | B-5 asks column-level privileges too; B-8 takes the digest check as a parameter | Accept (section 6) |

## 19. End state and cleanup

```
session: role=dems_owner database=postgres server=18.4 endpoint=127.0.0.1:4432          (09:37, a scratch script outside the repository)
pg_database:
  postgres  owner=dems_admin  template=false
  template0  owner=dems_admin  template=true
  template1  owner=dems_admin  template=true
databases with a prefix of this row (dems_test_step_39*): 0
project roles: dems_admin(super=true,createdb=true) dems_app(super=false,createdb=false) dems_owner(super=false,createdb=true)
pg_db_role_setting rows: 0
advisory locks of class 442002: 0
postmaster start time: 2026-10-04 07:14:26.046351+07
$ cat .locks/postgres.pid
19121
```

- No test database of this row remains; every run ended with `0 remain with the run prefix`.
- No role was created; the three roles are those of provisioning. No server setting was changed.
- PostgreSQL was never stopped: PID 19121, started 07:14:26, as at the start of the row.
- Nothing connected as the bootstrap superuser; nothing read `.data/pg.pwfile`. The other
  PostgreSQL of this host was never connected to.
- No process of this row is left; every command ran in the foreground and returned.
- Leak check after both documents were written (a scratch script outside the repository takes the
  two project-role passwords as search patterns in its own process and prints counts only):

  ```
  ./apps/core-server: 171 file(s) scanned, 0 contain a credential value
  ./docs/2026-10-04_dems_backend_rbac_pairing: 189 file(s) scanned, 0 contain a credential value
  ./.locks: 21 file(s) scanned, 0 contain a credential value
  <scratchpad>: 836 file(s) scanned, 0 contain a credential value
  ./.data/postgres.log: 3884234 bytes scanned, 0 credential value(s) found
  total: 1218 file(s), 0 contain a credential value; patterns: 2, each at least 24 bytes
  ```

  The counts are those of 09:43:14. The scan was repeated at 09:43:35 with both documents on disk
  and this paragraph in place, with the same result. The only edit after that corrected the time
  stamps of this paragraph and of the two footers.
- The server log grew from 1,795,200 bytes (08:47) to 3,884,234 bytes (about 09:41), from this row's
  test runs and those of other rows. **One run of this row's database tests adds 184 kB (1,281
  lines)**, measured at about 09:41: about 400 expected refusals with their ERROR, DETAIL and STATEMENT
  lines, and two checkpoint lines per dropped database. Nothing rotates the file (finding F-9).

## 20. Rollback (R-NEW; not executed)

```sh
cd /Users/gsp-budi/Documents/DEMS
git clean -fd -- apps/core-server/drizzle.config.ts apps/core-server/src/db/schema \
  apps/core-server/src/db/migrations apps/core-server/src/db/commands apps/core-server/test/db
rm -f .locks/db-migrate.lock
```

Every path is new and untracked. Afterwards `tpl_schema` is "not built" again, NR-1's test passes
again, and `db:create`, `db:migrate`, `db:status` and `db:generate` have no entry file. No
database object remains to remove: `dems_demo` was never created and every test database was
dropped.

## 21. Verification list of the row

| Check | Result | Section |
|---|---|---|
| `npm run test:db -w @dems/core-server -- test/db` exits 0 | Yes: 9 files, 233 tests | 8.1 |
| Migrate on an empty clone; a second run applies nothing | Yes | 8.2 |
| The catalog equals contract §4; the diff is quoted and empty | Yes: 30, 98, 25, 5, 3 with `'A'` | 7 |
| Every object belongs to `dems_owner` | Yes | 8.4, 8.5 |
| UPDATE, DELETE, TRUNCATE on the two tables refused (`42501`, `ZA002`); INSERT on the lineage table refused for `dems_app` | Yes | 8.3 |
| T-PV-1 to T-PV-3; T-AT-1 to T-AT-5 | Pass | 8.4, 6, 8.6 |
| The hash-mismatch behaviour of `db:status`; the schema-version check | Yes | 5.3, 6 |
| Unit project still exits 0 | Yes: 31 files, 979 tests | 8.8 |
| Typecheck and lint of the workspace | Exit 0, exit 0 | 8.8 |
| `drizzle-kit generate` reports no change | Yes | 3.3 |
| No leftover database; `.locks/postgres.pid` unchanged | Yes | 19 |
| Test ledger | `db` 10 / 52 before, 19 / 285 after (1 failing, NR-1); this row's files by name | 15 |
| Each PG-n marked | 21 confirmed, 1 corrected, 6 not exercised here | 12 |
| Leak check | 1,218 files and the server log scanned; 0 contain a credential value | 19 |

Not verified by this row: the superuser half of PG-02 and PG-21 (W07's trial step); two
`migrate()` calls at the same time; the commands against `dems_demo` itself (W20 runs them first);
the boot checks registered in a server started through `src/index.ts` (W21, W58).

---
*Generated: 2026-10-04 09:42 WIB*
*Last Updated: 2026-10-04 09:44 WIB*
