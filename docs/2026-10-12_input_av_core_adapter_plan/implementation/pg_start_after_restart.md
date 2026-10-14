# pg:start after the Mac restart (2026-10-14)

Scope: start the project's own embedded PostgreSQL (127.0.0.1:4432) with `npm run pg:start`. Nothing else was changed. No init, create, migrate, seed, reset, stop or remove ran. The system PostgreSQL (`/Library/PostgreSQL/18`) was not touched. No file was deleted by hand.

## What the scripts do (read first)

- `scripts/pg/start.mjs`: runs under `.locks/postgres.lock` (lockf), calls `startServer(paths)`, prints PID and the lsof line.
- `scripts/pg/server.mjs` `startServer`: requires an existing cluster (`.data/postgres/PG_VERSION`), else it fails with "run pg:init". `serverState` counts a postmaster.pid whose process is gone, or whose port refuses a connection, as "stopped" (stale), not as an error. It refuses only if 127.0.0.1:4432 is already used by a foreign process. Then `pg_ctl -D .data/postgres -l .data/postgres.log -w -t 30 -o "-c listen_addresses=127.0.0.1 -c port=4432 -c unix_socket_directories=''" start`. After success it writes the new PID into `.locks/postgres.pid` with `fs.writeFileSync`, i.e. it overwrites a stale pid file itself. It never deletes one.
- `scripts/pg/init.mjs` is not run; it only provisions a fresh cluster and refuses when one exists.

## Step 1: before

| Command | Output |
|---|---|
| `lsof -nP -iTCP:4432 -sTCP:LISTEN` | (no output, exit 1): nothing listens |
| `cat .locks/postgres.pid` | `32505` |
| `ps -p 32505` | not permitted inside the command sandbox (`operation not permitted: ps`); liveness checked instead with `node -e 'process.kill(32505,0)'` -> `ESRCH`: process does not exist (stale) |
| `ls -ld .data .data/postgres` | `drwx------ gsp-budi staff 768 Oct 13 18:53 .data` / `drwx------ gsp-budi staff 864 Oct 13 19:45 .data/postgres` |
| `ls -ld .data/postgres/postmaster.pid` | No such file or directory (cluster was shut down cleanly or the file was gone; nothing for pg_ctl to complain about) |

Data directory used by the script: `/Users/gsp-budi/Documents/DEMS/.data/postgres` (`paths.pgdata`, scripts/pg/lib.mjs:136).

## Step 2: `npm run pg:start` (sandbox OFF for this one command, because it binds a port)

```
> dems-demo@0.1.0 pg:start
> node scripts/pg/start.mjs

waiting for server to start.... done
server started
pg:start: started, PID 65169, listening on 127.0.0.1:4432 (TCP only, no Unix socket)
  postgres 65169 gsp-budi    6u  IPv4 0x4934eee0b68ebc59      0t0  TCP 127.0.0.1:4432 (LISTEN)
  PID file: .locks/postgres.pid. Stop with "npm run pg:stop".
EXIT=0
```

## Step 3: after

| Command | Output |
|---|---|
| `lsof -nP -iTCP:4432 -sTCP:LISTEN` | `postgres 65169 gsp-budi 6u IPv4 ... TCP 127.0.0.1:4432 (LISTEN)` |
| `cat .locks/postgres.pid` | `65169` (mtime Oct 14 09:22; overwritten by the script; the stale 32505 is replaced) |

### Database names / status

There is no separate listing script under scripts/pg. `apps/core-server/src/db/commands/status.ts` was read first: it only SELECTs (pg_database, schema_meta, ledger, counts, triggers); a missing database yields `DATABASE_MISSING`, nothing is created. It was run for the four project databases (names from `database-names.ts`: `dems_demo`, `dems_lane_1`, `dems_lane_2`, `dems_lane_3`). All four exist and answered.

Command: `npm run db:status -w @dems/core-server -- --database <name>`; last lines per database (row-count and ledger detail lines omitted; exit code 1 for each, see below).

| Database | audit head | lineage | status result |
|---|---|---|---|
| dems_demo | seq 83 | 4 rows, newest reset_no 4 | NOT OK: 2 problems |
| dems_lane_1 | seq 392 | 21 rows, newest reset_no 21 | NOT OK: 2 problems |
| dems_lane_2 | seq 1946 | 15 rows, newest reset_no 15 | NOT OK: 2 problems |
| dems_lane_3 | seq 83 | 4 rows, newest reset_no 4 | NOT OK: 2 problems |

All four, identical last lines (shown for dems_demo):

```
audit triggers   audit_chain_history_append_only=A, audit_log_append_only=A, audit_log_chain_guard=A
row counts       43 table(s)
db:status: 15 migration(s) are not applied: 0015_capture_streams_audio_inputs, 0016_..., ... 0029_alias_removal_reason_unconfirmed_privileges. Run "npm run db:migrate".
db:status: The database is at schema version 6 (dbc-7); this code expects 13 (dbc-14). Run "npm run db:migrate" with the code that matches the database, or migrate the database.
db:status: NOT OK: 2 problem(s) on dems_demo.
```

Interpretation: the databases are intact and untouched (audit heads, lineage, 43 tables, three audit triggers in mode A). "NOT OK" is not caused by the restart or by this task: the checked-out code (task 4 migrations 0015-0029, schema version 13 / dbc-14) is ahead of the databases (schema version 6 / dbc-7), because no migration has been applied to these four. Migrating them is out of scope here and was not done.

## Statement

No `pg:init`, `pg:stop`, `db:create`, `db:migrate`, `db:seed`, `db:reset`, `initdb` ran. Only `pg:start` changed state (server process started; `.locks/postgres.pid`, `.data/postgres.log` and `.data/pg-scripts.log` written by the script). The system PostgreSQL was not touched.
