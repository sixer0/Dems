---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-09
agent: coder-execution
blueprint_row: 130
source_plan: masterplan/02_plan.md (AP3-130); spec masterplan/04_database_contract.md section N.8 (order), N.14
tier: 3
status: complete
---

# Row 130 - migration set 4 applied to the four development databases

Scripted operation, no code change, no source file touched, no commit, no reseed, no reset, no
Core started. Project PostgreSQL 127.0.0.1:4432 only, through the repo's npm commands, sandbox
disabled for the database commands (EPERM inside the sandbox). `.data/pg*.env` and the pwfile were not
read or printed; `dems_admin` was not used (the migrate command connects as `dems_owner`, the
repo's own path).

Full raw outputs of every `db:status` (before/after) are kept in the session scratchpad
`.../scratchpad/row130/` (not part of the repo). The excerpts below are verbatim.

## 1. Pre-flight

`npm run pg:status` (first lines and last line):

```
cluster    .data/postgres (PG_VERSION 18)
settings   listen_addresses = '127.0.0.1', port = 4432, unix_socket_directories = '' (configuration files)
server     RUNNING, PID 32505 (postmaster.pid: 127.0.0.1:4432, status "ready", connect probe: open)
pid file   .locks/postgres.pid = 32505
listener   postgres 32505 gsp-budi    6u  IPv4 0x53064be641b95a38      0t0  TCP 127.0.0.1:4432 (LISTEN)
host authentication (HA-1 to HA-4)
  HA-1 PASS
  HA-2 PASS
  ...
  HA-4 PASS | a connection as dems_app with a wrong password: SQLSTATE 28P01
pg:status: OK, running
```

`lsof -nP -iTCP -sTCP:LISTEN | grep -E ':442[0-3] '` printed nothing (grep exit 1). No Core on
4420-4423. (Stale `.locks/core-server.lane*.pid` files exist from earlier sessions; nothing listens.)

## 2. Per database

Commands, per database `<db>` in the order `dems_lane_1`, `dems_lane_2`, `dems_lane_3`, `dems_demo`:

```
npm run db:status  -w @dems/core-server -- --database <db>                                   # before
/usr/bin/lockf -k -t 600 .locks/db-migrate.lock npm run db:migrate -w @dems/core-server -- --database <db>
npm run db:status  -w @dems/core-server -- --database <db>                                   # after
/usr/bin/lockf -k -t 600 .locks/db-migrate.lock npm run db:migrate -w @dems/core-server -- --database <db>   # run 2
```

### 2.1 BEFORE (identical shape on all four)

`dems_lane_1`, full header of `db:status` (the migration list shows 0000-0007 applied):

```
database         dems_lane_1 on PostgreSQL 18.4
schema version   2; contract revision dbc-3; this code expects 3 (dbc-4)
migrations       10 file(s); ledger matches
  0008_capture_sources pending  file sha256 2c1e485da34bbf17b4ed8aa811ab5590e6a808ea3bf2d9b7cdb1fdcdd16fba8e  stored -
  0009_capture_sources_privileges pending  file sha256 3100b5ee098fa10a3d31033c48203e4709343caf3346eee2c331c8691e24bf8b  stored -
...
row counts       40 table(s)
db:status: 2 migration(s) are not applied: 0008_capture_sources, 0009_capture_sources_privileges. Run "npm run db:migrate".
db:status: The database is at schema version 2 (dbc-3); this code expects 3 (dbc-4). Run "npm run db:migrate" with the code that matches the database, or migrate the database.
db:status: NOT OK: 2 problem(s) on dems_lane_1.
```

(exit 1 by design.) `dems_lane_2`, `dems_lane_3` and `dems_demo` printed the same three `db:status:`
lines naming their own database, the same two pending files and `row counts 40 table(s)`.
Assumption A-122-1 holds on all four: version 2 / dbc-3 and `capture_devices 5`.

### 2.2 APPLY, run 1 (all four exit 0)

```
db:migrate: dems_lane_1 on PostgreSQL 18.4 as dems_owner
db:migrate: schema version before: 2 (dbc-3)
db:migrate: applied 2 migration(s): 0008_capture_sources, 0009_capture_sources_privileges
db:migrate: schema version after: 3 (dbc-4)
```

`dems_lane_2` and `dems_lane_3`: the same four lines with their own name. `dems_demo`: the same, preceded by

```
db:migrate: note - dems_demo is shared with db:reset, so its caller runs this command under /usr/bin/lockf -k .locks/db-migrate.lock. This command takes no lock of its own and never checks for one; it prints this note on every dems_demo run.
```

### 2.3 AFTER (all four exit 0)

`dems_lane_1`, header:

```
database         dems_lane_1 on PostgreSQL 18.4
schema version   3; contract revision dbc-4; this code expects 3 (dbc-4)
migrations       10 file(s); ledger matches
  ... 0008_capture_sources applied  file sha256 2c1e485d...fba8e  stored 2c1e485d...fba8e
  ... 0009_capture_sources_privileges applied  file sha256 3100b5ee...4bf8b  stored 3100b5ee...4bf8b
row counts       41 table(s)
  session_capture_sources  0
db:status: OK: dems_lane_1 is at the schema version this code expects and the ledger matches the files.
```

`dems_lane_2`, `dems_lane_3`, `dems_demo`: each prints `schema version   3; contract revision dbc-4; this code expects 3 (dbc-4)`,
`migrations       10 file(s); ledger matches`, `row counts       41 table(s)`, `session_capture_sources  0` and
`db:status: OK: <db> is at the schema version this code expects and the ledger matches the files.`
Applied-file hashes equal the file hashes on every database.

### 2.4 APPLY, run 2 (no-op; all four exit 0)

```
db:migrate: dems_lane_1 on PostgreSQL 18.4 as dems_owner
db:migrate: schema version before: 3 (dbc-4)
db:migrate: no pending migration; nothing was applied.
db:migrate: schema version after: 3 (dbc-4)
```

The same on `dems_lane_2`, `dems_lane_3`, `dems_demo` (the last with the `dems_demo is shared with db:reset` note).

## 3. Before / after table

| Database | Version before | Version after | Pending before / after | Ledger / files after | Run 1 | Run 2 | Tables before / after |
|---|---|---|---|---|---|---|---|
| `dems_lane_1` | 2 (dbc-3) | 3 (dbc-4) | 2 / 0 | matches / 10 | applied 0008, 0009 | nothing applied | 40 / 41 |
| `dems_lane_2` | 2 (dbc-3) | 3 (dbc-4) | 2 / 0 | matches / 10 | applied 0008, 0009 | nothing applied | 40 / 41 |
| `dems_lane_3` | 2 (dbc-3) | 3 (dbc-4) | 2 / 0 | matches / 10 | applied 0008, 0009 | nothing applied | 40 / 41 |
| `dems_demo` | 2 (dbc-3) | 3 (dbc-4) | 2 / 0 | matches / 10 | applied 0008, 0009 | nothing applied | 40 / 41 |

## 4. Kept tables and pairing (M4-DB-APPLY-1 beyond the versions)

Method: `diff` of the full `db:status` output before vs after for each database, with the migration
lines removed. On every database the only differences are three lines: the schema-version line, the
`row counts` table total (40 -> 41) and the new line `session_capture_sources  0`. Every one of the
40 prior row counts is identical, and so are `seeded_at`, `last_reset_at`, `audit head` (seq and
hash prefix), the audit-trigger line and the `lineage` line.

Row counts that matter, equal before and after (from `db:status`):

| Database | capture_devices | evidence_items | paired_devices | device_credentials | pairing_codes | auth_sessions | core_device | audit head |
|---|--:|--:|--:|--:|--:|--:|--:|---|
| `dems_lane_1` | 5 | 13 | 1 | 1 | 2 | 11 | 1 | seq 102 |
| `dems_lane_2` | 5 | 13 | 1 | 1 | 1 | 10 | 1 | unchanged |
| `dems_lane_3` | 5 | 13 | 1 | 1 | 1 | 11 | 1 | unchanged |
| `dems_demo` | 5 | 13 | 5 | 5 | 5 | 11 | 1 | seq 83 |

The shape matches the design: one paired device per lane, five on `dems_demo` (main instance).

What could and could not be compared: `db:status` prints counts only. The repo has no other
read-only command for the paired-device identities (`apps/core-server/src/db/commands/` holds
cli, create, database-names, evidence-store, migrate, migrations, owner-connection, statements,
status; the package scripts are create / migrate / seed / reset / status / generate). No ad-hoc SQL
was written. So the per-lane pairing is proven intact by the counts of `paired_devices`,
`device_credentials`, `pairing_codes` and `auth_sessions` plus the untouched audit head, not by
comparing the row contents; a content comparison would need the lane Core to be booted and its
device list read (the gate-70 device session, `M2-LANE-1`).

## 5. Note: the 17th service

`db:status` prints nothing about the stored services list (no services line, no count). The list is
part of the simulated state seeded from `CORE_SERVICES` (`packages/shared/src/sim/initial-state.ts:460`);
an already-seeded database keeps the 16 services it was seeded with until a reseed, and migration set 4
does not touch it. No boot check in `apps/core-server/src/db/schema/boot-checks.ts` mentions services.
What a boot would show was not determined, since no server was started.

## 6. Final state

- `npm run pg:status` after the work: `pg:status: OK, running`.
- `lsof ... ':442[0-3] '`: nothing listening (no Core started by this row).
- Four databases: `dems_lane_1`, `dems_lane_2`, `dems_lane_3`, `dems_demo` all at schema version 3 / `dbc-4`, 10 files, ledger matches, 0 pending.
- `M4-DB-APPLY-1`: run 1 applied, run 2 applied nothing, the four report the same version, kept tables and pairing counts unchanged. One part of the check ("old code is refused on each database (B-3)") needs a Core of older code and was not run; it is a unit-level fact covered by `M4-MT-16` in row 129.
- Consequence to remember (N.9): a Core built from code older than row 129 is now refused at boot by B-3 on all four databases.

---
*Generated: 2026-10-09*
