---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 29
plan_row: W07
title: PostgreSQL provisioning and its trial; early proof (b), trial steps T2 to T7
date: 2026-10-04
agent: coder-execution (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
evidence_tier: 3
status: complete
---

# W07: project-local PostgreSQL 18.4, provisioning and trial

All times are WIB (UTC+7) on 2026-10-04. Every command ran from `/Users/gsp-budi/Documents/DEMS`;
no command changed into a subfolder. In the quoted output the workspace root is cut from long
paths where that keeps a line readable; nothing else is changed. **No password, hash of a password
or other credential value appears in this document**: only file names, modes, key names, role
names and PIDs.

## 1. Result

**TD-02 npm route CONFIRMED.** PostgreSQL 18.4 from the npm-distributed binaries runs on this
host, with three roles, on `127.0.0.1:4432`, TCP only. Early proof (b) passes; the fallback row
Fb is not needed.

| Item | Result |
|---|---|
| Trial T2 to T7, with T3-a, T3-b, T5-a to T5-j | **All PASS.** T5-h is recorded (section 5.4) |
| Time box (45 min for the trial) | Used about 2 minutes: T2 began at 07:12:16, T7 was finished by 07:14:25 |
| `lsof -nP -iTCP:4432 -sTCP:LISTEN` immediately before the first start | Printed nothing (section 4) |
| Listener | One, `127.0.0.1:4432`; nothing of this cluster on any other address; no Unix socket |
| Roles | `dems_admin` (bootstrap superuser, used in this row only), `dems_owner` (CREATEDB, no superuser flag), `dems_app` (no flag) |
| Superuser | Closed for good at 07:12:24. Nothing connected as `dems_admin` afterwards |
| Credentials | Three files of mode 600 in `.data/` (mode 700), git-ignored, never printed |
| `npm run test:pg-scripts` | Exit 0: 55 tests in 7 files, 0 failed |
| State at the end | Server **RUNNING**, PID 19121 in `.locks/postgres.pid`; `npm run pg:status` exit 0 |
| The other PostgreSQL server of this host (`*:5432`, F27) | Never connected to, never read, never signalled |

## 2. What was written

`scripts/pg/` (19 `.mjs` files, 12 scripts and 7 test files, and 3 fixtures; Node 26.8.2, no new dependency; the `pg`
driver 8.23.1 is the one W03 installed at the root). No `package.json` was edited.

| File | Purpose |
|---|---|
| `init.mjs` | `npm run pg:init`: RP-1 to RP-6, with the trial as RP-5 |
| `start.mjs`, `stop.mjs` | `npm run pg:start`, `npm run pg:stop` |
| `status.mjs` | `npm run pg:status`: state, endpoint, HA-1 to HA-4, modes, key names |
| `remove-data.mjs` | `npm run pg:remove-data` (rollback block RB-02). **Not executed** |
| `remove.mjs` | `npm run pg:remove` (RB-02 then RB-01). **Not executed** |
| `check-hba.mjs` | The host-authentication check HA-1 to HA-3; also a command of its own |
| `check-superuser-trigger.mjs` | The superuser trigger check, trial step T5-j. Called by `pg:init` only |
| `trial.mjs` | Trial steps T5 and T5-a to T5-i as `dems_owner`; the two commands of T6 |
| `lib.mjs` | Constants, the endpoint guard, the environment scrub, the secret guards, the credential loader, the settings reader, the script log |
| `server.mjs` | Server state, start, stop |
| `db.mjs` | The one place that opens a connection; the SCRAM verifier |
| `lib.test.mjs`, `server.test.mjs`, `check-hba.test.mjs`, `init.test.mjs`, `remove-data.test.mjs`, `db.test.mjs`, `static.test.mjs` | `node --test` files (section 8) |
| `fixtures/pg_hba.initdb.conf`, `pg_hba.trust.conf`, `pg_hba.any-address.conf` | The three files of test T-HA-1 |

Git-ignored, created by `pg:init`: `.data/` (the cluster `.data/postgres/`, `pg.pwfile`,
`pg.owner.env`, `pg.env`, `postgres.log`, `pg-scripts.log`); `.locks/postgres.pid`;
`.locks/postgres.lock`.

### 2.1 How the scripts keep away from the server on 5432 (D26, F27)

| Rule | Where | Test |
|---|---|---|
| One endpoint, `127.0.0.1:4432`. `assertEndpoint()` refuses port 5432 by name, any other port and any host other than `127.0.0.1` | `lib.mjs` | `lib.test.mjs` (four tests) |
| Every variable whose name starts with `PG` is removed from the script's environment when `lib.mjs` loads, and again from every child environment | `lib.mjs` `scrubPgEnv`, `childEnv` | `lib.test.mjs` (two tests; the second sets the seven variables with port 5432 and shows that a child sees none) |
| Binaries are called by absolute path under `node_modules/@embedded-postgres/darwin-arm64/native/bin/`, always with `-D <root>/.data/postgres` | `lib.mjs` `projectPaths`, `server.mjs`, `init.mjs` | `lib.test.mjs`, `init.test.mjs` |
| A connection file is refused when its host or port is not the endpoint | `lib.mjs` `readConnectionFile` | `lib.test.mjs` |
| `pg:start` reads `postgresql.conf` and `postgresql.auto.conf` first and refuses port 5432, another address or a Unix socket directory **before `pg_ctl` runs** | `server.mjs`, `lib.mjs` `assertClusterEndpoint` | `server.test.mjs` (stand-in binaries leave a marker when run; the marker never appears) |
| The same three settings are also on the server's command line (`pg_ctl -o`), so a later edit of the file or an `ALTER SYSTEM` cannot change them | `server.mjs` `SERVER_OPTIONS` | `server.test.mjs`; `postmaster.opts` in section 7 |
| Connections pass host and port as constants; the driver is loaded in one file; `ssl: false`; no socket path | `db.mjs` | `static.test.mjs` |
| Before it creates the roles, `pg:init` asks the server for its `data_directory` and stops if it is not `.data/postgres` | `init.mjs` `provisionRoles` | Run output, section 5.3 (RP-3) |
| No source file of `scripts/pg/` reads a host or a port from `process.env`; the number 5432 occurs once in code, as the constant that is refused | all | `static.test.mjs` |

## 3. Supply-chain record SU-1 (SR-80, AC-B-91)

Recomputed twice in this row and compared with the values W03 recorded
(`implementation/03_npm_slot_n1_server_shared.md` section 7.2). **All three are equal.**

```
$ shasum -a 256 native/bin/{postgres,initdb,pg_ctl}          (07:12:02, before provisioning)
515d8e4c690ecd6ae86074eedd5d6d0ed50df434b3743274085b9692f1e923f9  node_modules/@embedded-postgres/darwin-arm64/native/bin/postgres
b81069a19bcec5d2dd263f5c9bce2ce0b5075ae0f9b8a5c81b79f34bef503c39  node_modules/@embedded-postgres/darwin-arm64/native/bin/initdb
2c37317f9f606d9716e493d6765ff14f84d8df9b8c07eaa722431de16446f071  node_modules/@embedded-postgres/darwin-arm64/native/bin/pg_ctl
```

| Binary | SHA-256 at W03 (06:36 and 06:43) | SHA-256 at W07 (07:12:02, `shasum`; 07:12:23, `pg:init`) | Equal |
|---|---|---|---|
| `native/bin/postgres` | `515d8e4c690ecd6ae86074eedd5d6d0ed50df434b3743274085b9692f1e923f9` | `515d8e4c690ecd6ae86074eedd5d6d0ed50df434b3743274085b9692f1e923f9` | yes |
| `native/bin/initdb` | `b81069a19bcec5d2dd263f5c9bce2ce0b5075ae0f9b8a5c81b79f34bef503c39` | `b81069a19bcec5d2dd263f5c9bce2ce0b5075ae0f9b8a5c81b79f34bef503c39` | yes |
| `native/bin/pg_ctl` | `2c37317f9f606d9716e493d6765ff14f84d8df9b8c07eaa722431de16446f071` | `2c37317f9f606d9716e493d6765ff14f84d8df9b8c07eaa722431de16446f071` | yes |

With the two values of W03 (the install script and its symlink list) these are the five SHA-256
values of SU-1. `pg:init` prints the three again on every run.

## 4. Before the first start

```
2026-10-04 07:12:02 WIB
$ ls -d .data
ls: /Users/gsp-budi/Documents/DEMS/.data: No such file or directory
$ git check-ignore -v .data/postgres .data/pg.pwfile .data/pg.owner.env .data/pg.env .data/postgres.log
.gitignore:70:/.data/	.data/postgres
.gitignore:70:/.data/	.data/pg.pwfile
.gitignore:70:/.data/	.data/pg.owner.env
.gitignore:70:/.data/	.data/pg.env
.gitignore:70:/.data/	.data/postgres.log
rc=0
```

The ignore rule matched every path **before** `.data/` existed (CR-7). `pg:init` runs the same
check itself and refuses to create anything if a path is not matched.

```
$ socketfilterfw --getglobalstate
Firewall is disabled. (State = 0)
```

The macOS application firewall is off, so no firewall prompt could appear, and none did. Nothing
asked for a password or for administrator rights.

The port probe, immediately before the first start (outside the sandbox, same command as the
start):

```
2026-10-04 07:12:23 WIB
$ lsof -nP -iTCP:4432 -sTCP:LISTEN
rc=1 <end of lsof output>
$ netstat -an -p tcp | grep LISTEN | grep "\.4432 "
rc=1 <end of netstat output>
07:12:23
$ npm run pg:init
```

`lsof` printed nothing. `netstat` was added because `lsof` lists only this user's processes
(step 28 found the server on 5432 only through `netstat`); it printed nothing either. `pg:init`
probes once more inside the script, directly before `pg_ctl start` (section 5.3: "(no output)",
"connect probe ... closed").

## 5. The trial

### 5.1 Trial table

| Step | As | Check | Outcome | Verdict |
|---|---|---|---|---|
| T2 | shell | `postgres --version`; `xattr -l`; `codesign -dv` | `postgres (PostgreSQL) 18.4`; no load error; one attribute `com.apple.provenance`, no `com.apple.quarantine`; signed, identifier `com.edb.postgresql`, hardened runtime | PASS |
| T3 | shell | `initdb` | Exit 0; `.data/postgres/PG_VERSION` is `18` | PASS |
| T3-a | file | HA-1 to HA-3 on `.data/postgres/pg_hba.conf` | 6 lines: no `trust`, loopback addresses only, `scram-sha-256` on every line | PASS |
| T3-b | `dems_app` | A connection with a wrong password | Refused, SQLSTATE `28P01` | PASS |
| T4 | shell | Start, then `lsof -nP -iTCP:4432 -sTCP:LISTEN` | One listener, `127.0.0.1:4432`; no other listener of this cluster | PASS |
| T5 | `dems_owner` | `SELECT version()` through `pg` 8.23.1 on Node 26.8.2 over 127.0.0.1 | `PostgreSQL 18.4 ...`; role `dems_owner`, superuser false; server `127.0.0.1:4432` | PASS |
| T5-a | `dems_owner` | `CREATE DATABASE dems_trial_a OWNER dems_owner TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'` | OK | PASS |
| T5-b | `dems_owner` | `CREATE DATABASE dems_trial_b TEMPLATE dems_trial_a OWNER dems_owner` | OK (the clone) | PASS |
| T5-c | `dems_owner` | `BEGIN;` two `ALTER DATABASE ... RENAME TO`; `COMMIT;` | OK | PASS |
| T5-d | `dems_owner` | `ALTER DATABASE dems_trial_a WITH IS_TEMPLATE true ALLOW_CONNECTIONS false`, then back | OK, OK | PASS |
| T5-e | `dems_owner` | `DROP DATABASE dems_trial_b`; `DROP DATABASE dems_trial_a` after T5-h | OK, OK | PASS |
| T5-f | `dems_owner` | `SET session_replication_role = replica` | Refused, `42501` | PASS |
| T5-g | `dems_owner` | `CREATE ROLE dems_trial_role` | Refused, `42501` | PASS |
| T5-h | `dems_owner` | The `pg_stat_activity` query with one `dems_app` session open; `DROP DATABASE dems_trial_a WITH (FORCE)` | The query shows `(dems_trial_a, dems_app)`. The forced drop is **refused, `42501`: permission denied to terminate process** | RECORDED (not gating) |
| T5-i | `dems_owner` | `ALTER SYSTEM SET log_statement = 'all'`; `ALTER DATABASE dems_trial_a SET log_statement = 'all'` | Both refused, `42501` | PASS |
| T5-j | **`dems_admin`**, once | Scratch table, refusal trigger `ENABLE ALWAYS`, `SET session_replication_role = replica`, then UPDATE, DELETE, TRUNCATE; then the trigger in the default mode and the UPDATE again | `ZA002` three times; the UPDATE is accepted in the default mode; session closed | PASS |
| T6 | `dems_owner` | Write a row, stop with `-m fast`, start, read the row | The row is there; the server's start time is after the row's write time | PASS |
| T7 | shell | Stop; processes; `launchctl list`; `brew services list` | No process of this cluster, no launchd job of ours, no brew service | PASS |

T1 and T8 were done by step 25 (W03).

### 5.2 T2: the binaries (07:12:16, outside the sandbox)

```
$ native/bin/postgres --version
postgres (PostgreSQL) 18.4
rc=0
$ native/bin/initdb --version; native/bin/pg_ctl --version
initdb (PostgreSQL) 18.4
pg_ctl (PostgreSQL) 18.4
$ xattr -l native/bin/postgres
com.apple.provenance: 
$ xattr -l native/bin/initdb
com.apple.provenance: 
$ xattr -l native/bin/pg_ctl
com.apple.provenance: 
$ codesign -dv native/bin/postgres
Executable=node_modules/@embedded-postgres/darwin-arm64/native/bin/postgres
Identifier=com.edb.postgresql
Format=Mach-O universal (x86_64 arm64)
CodeDirectory v=20500 size=74206 flags=0x10000(runtime) hashes=2308+7 location=embedded
Signature size=8997
Timestamp=13 May 2026 at 16.32.46
Info.plist=not bound
TeamIdentifier=26QKX55P9K
Runtime Version=14.5.0
Sealed Resources=none
Internal requirements count=1 size=180
```

`initdb` and `pg_ctl` show the same identifier, team identifier and flags (timestamps 16.32.44
and 16.32.47). Quarantine state: **not quarantined** (the only extended attribute is
`com.apple.provenance`). Signature state: **signed** with a Developer ID, hardened runtime. This
closes the open point of the research on Gatekeeper behaviour (G-06).

### 5.3 `npm run pg:init` (07:12:23 to 07:12:24, outside the sandbox): RP-1 to RP-6, T3 to T5-j

The whole output, as printed. `.gitignore:70:/.data/<TAB>path` is the output of
`git check-ignore -v`.

```
> dems-demo@0.1.0 pg:init
> node scripts/pg/init.mjs

pg:init: project-local PostgreSQL on 127.0.0.1:4432

== Binaries (SU-1: SHA-256, recomputed here)
  515d8e4c690ecd6ae86074eedd5d6d0ed50df434b3743274085b9692f1e923f9  node_modules/@embedded-postgres/darwin-arm64/native/bin/postgres
  b81069a19bcec5d2dd263f5c9bce2ce0b5075ae0f9b8a5c81b79f34bef503c39  node_modules/@embedded-postgres/darwin-arm64/native/bin/initdb
  2c37317f9f606d9716e493d6765ff14f84d8df9b8c07eaa722431de16446f071  node_modules/@embedded-postgres/darwin-arm64/native/bin/pg_ctl
T2     PASS     [shell] node_modules/@embedded-postgres/darwin-arm64/native/bin/postgres --version
                -> postgres (PostgreSQL) 18.4

== CR-7: git check-ignore -v, before anything is created
  .gitignore:70:/.data/	.data/postgres
  .gitignore:70:/.data/	.data/pg.pwfile
  .gitignore:70:/.data/	.data/pg.owner.env
  .gitignore:70:/.data/	.data/pg.env
  .gitignore:70:/.data/	.data/postgres.log
  .gitignore:70:/.data/	.data/pg-scripts.log

== RP-1: .data/ (0700) and the three credential files (0600, created exclusively)
  created: .data/pg.pwfile, .data/pg.owner.env, .data/pg.env
  three passwords of 32 random bytes each (crypto.randomBytes, base64url); none is printed

== RP-2: initdb
  $ node_modules/@embedded-postgres/darwin-arm64/native/bin/initdb -D .data/postgres -U dems_admin -A scram-sha-256 --pwfile=.data/pg.pwfile -E UTF8 --locale=C
  | The files belonging to this database system will be owned by user "gsp-budi".
  | This user must also own the server process.
  | 
  | The database cluster will be initialized with locale "C".
  | The default text search configuration will be set to "english".
  | 
  | Data page checksums are enabled.
  | 
  | creating directory /Users/gsp-budi/Documents/DEMS/.data/postgres ... ok
  | creating subdirectories ... ok
  | selecting dynamic shared memory implementation ... posix
  | selecting default "max_connections" ... 100
  | selecting default "shared_buffers" ... 128MB
  | selecting default time zone ... Asia/Jakarta
  | creating configuration files ... ok
  | running bootstrap script ... ok
  | performing post-bootstrap initialization ... ok
  | syncing data to disk ... ok
  | 
  | Success. You can now start the database server using:
  | 
  |     '/Users/gsp-budi/Documents/DEMS/node_modules/@embedded-postgres/darwin-arm64/native/bin/pg_ctl' -D /Users/gsp-budi/Documents/DEMS/.data/postgres -l logfile start
  postgresql.conf: listen_addresses = '127.0.0.1', port = 4432, unix_socket_directories = '' appended
T3     PASS     [shell] initdb exit 0; .data/postgres/PG_VERSION
                -> 18

== First start
  $ lsof -nP -iTCP:4432 -sTCP:LISTEN
  (no output)
  connect probe to 127.0.0.1:4432: closed
  waiting for server to start.... done
  server started
  started: PID 16869, recorded in .locks/postgres.pid
  postgres 16869 gsp-budi    5u  IPv4 0x221f3bd13df085ec      0t0  TCP 127.0.0.1:4432 (LISTEN)
T4     PASS     [shell] lsof -nP -iTCP:4432 -sTCP:LISTEN
                -> 1 listener line(s): 127.0.0.1:4432 (LISTEN)

== RP-3: the two project roles (as dems_admin, on the maintenance database)
  connected as dems_admin; the server's data_directory is .data/postgres (this project's)
  role dems_owner: created (LOGIN NOSUPERUSER CREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS; PASSWORD given as a SCRAM-SHA-256 verifier, not printed)
  role dems_app: created (LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS; PASSWORD given as a SCRAM-SHA-256 verifier, not printed)
  the superuser session of RP-3 is closed

== RP-4: host authentication HA-1 to HA-4
  HA-1 PASS
  HA-2 PASS
  HA-3 PASS
  effective lines of .data/postgres/pg_hba.conf (6):
    local   all             all                                     scram-sha-256
    host    all             all             127.0.0.1/32            scram-sha-256
    host    all             all             ::1/128                 scram-sha-256
    local   replication     all                                     scram-sha-256
    host    replication     all             127.0.0.1/32            scram-sha-256
    host    replication     all             ::1/128                 scram-sha-256
T3-a   PASS     [file] HA-1 to HA-3 on .data/postgres/pg_hba.conf
                -> 6 lines: no trust, loopback addresses only, scram-sha-256 on every line
T3-b   PASS     [dems_app@postgres] a connection with a wrong password
                -> refused, SQLSTATE 28P01

== RP-5: the trial, as dems_owner (T5-j once as dems_admin)
T5     PASS     [dems_owner@postgres] SELECT version(), current_user, inet_server_addr(), inet_server_port() through the Node driver "pg" on Node 26.8.2
                -> PostgreSQL 18.4 on x86_64-apple-darwin24.6.0, compiled by Apple clang version 17.0.0 (clang-1700.6.3.2), 64-bit | role dems_owner, superuser false | server 127.0.0.1:4432
T5-a   PASS     [dems_owner@postgres] CREATE DATABASE dems_trial_a OWNER dems_owner TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'
                -> OK (CREATE)
T5-b   PASS     [dems_owner@postgres] CREATE DATABASE dems_trial_b TEMPLATE dems_trial_a OWNER dems_owner
                -> OK (CREATE)
T5-c   PASS     [dems_owner@postgres] BEGIN; ALTER DATABASE dems_trial_b RENAME TO dems_trial_c; ALTER DATABASE dems_trial_c RENAME TO dems_trial_b; COMMIT;
                -> OK; databases now: dems_trial_a, dems_trial_b
T5-d   PASS     [dems_owner@postgres] ALTER DATABASE dems_trial_a WITH IS_TEMPLATE true ALLOW_CONNECTIONS false
                -> OK (ALTER)
T5-d   PASS     [dems_owner@postgres] ALTER DATABASE dems_trial_a WITH IS_TEMPLATE false ALLOW_CONNECTIONS true
                -> OK (ALTER)
T5-e   PASS     [dems_owner@postgres] DROP DATABASE dems_trial_b
                -> OK (DROP)
T5-f   PASS     [dems_owner@postgres] SET session_replication_role = replica
                -> refused, SQLSTATE 42501: permission denied to set parameter "session_replication_role"
T5-g   PASS     [dems_owner@postgres] CREATE ROLE dems_trial_role
                -> refused, SQLSTATE 42501: permission denied to create role
T5-i   PASS     [dems_owner@postgres] ALTER SYSTEM SET log_statement = 'all'
                -> refused, SQLSTATE 42501: permission denied to set parameter "log_statement"
T5-i   PASS     [dems_owner@postgres] ALTER DATABASE dems_trial_a SET log_statement = 'all'
                -> refused, SQLSTATE 42501: permission denied to set parameter "log_statement"
T5-j1  PASS     [dems_admin@dems_trial_a] scratch table, refusal trigger (text of contract 6.3 group 4), ENABLE ALWAYS TRIGGER
                -> pg_trigger.tgenabled = 'A'
T5-j2  PASS     [dems_admin@dems_trial_a] SET session_replication_role = replica
                -> session_replication_role = replica; current_user is superuser = true
T5-j3  PASS     [dems_admin@dems_trial_a] UPDATE public.trial_append_only SET note = 'changed' WHERE id = 1
                -> refused, SQLSTATE ZA002: trial_append_only is append-only: UPDATE refused
T5-j4  PASS     [dems_admin@dems_trial_a] DELETE FROM public.trial_append_only WHERE id = 1
                -> refused, SQLSTATE ZA002: trial_append_only is append-only: DELETE refused
T5-j5  PASS     [dems_admin@dems_trial_a] TRUNCATE public.trial_append_only
                -> refused, SQLSTATE ZA002: trial_append_only is append-only: TRUNCATE refused
T5-j6  PASS     [dems_admin@dems_trial_a] trigger back in the default mode (tgenabled = 'O'), still replica: UPDATE public.trial_append_only SET note = 'changed' WHERE id = 1
                -> accepted, 1 row changed: the setting skips an ordinary trigger, so ALWAYS is what holds
T5-j   PASS     [dems_admin@dems_trial_a] the superuser session of T5-j
                -> closed; no superuser connection stays open
T5-h   PASS     [dems_owner@postgres] SELECT datname, usename FROM pg_stat_activity WHERE datname = 'dems_trial_a' (one dems_app session is open on it)
                -> (dems_trial_a, dems_app)
T5-h   RECORDED [dems_owner@postgres] DROP DATABASE dems_trial_a WITH (FORCE)
                -> refused, SQLSTATE 42501: permission denied to terminate process
T5-e   PASS     [dems_owner@postgres] DROP DATABASE dems_trial_a
                -> OK (DROP)
T5-end PASS     [dems_owner@postgres] trial databases left behind
                -> none

== RP-6: no superuser session is open; nothing connects as dems_admin from here on
  .data/pg.pwfile is read by scripts/pg/init.mjs and scripts/pg/check-superuser-trigger.mjs only
  roles (pg_roles: flags only):
    rolname       super  createdb  createrole  replication  bypassrls  login
    dems_admin    true   true      true        true         true       true
    dems_app      false  false     false       false        false      true
    dems_owner    false  true      false       false        false      true

== Files: modes (T-CR-1) and key names (AC-B-86)
  700  .data
  700  .data/postgres
  600  .data/pg.pwfile
  600  .data/pg.owner.env
  600  .data/pg.env
  600  .data/postgres.log
  600  .data/pg-scripts.log
  .data/pg.owner.env: DEMS_PG_HOST, DEMS_PG_PORT, DEMS_PG_DATABASE, DEMS_PG_OWNER_ROLE, DEMS_PG_OWNER_PASSWORD
  .data/pg.env: DEMS_PG_HOST, DEMS_PG_PORT, DEMS_PG_DATABASE, DEMS_PG_APP_ROLE, DEMS_PG_APP_PASSWORD

== Trial summary
  (27 lines: 26 PASS, 1 RECORDED)

pg:init: done. The server is RUNNING on 127.0.0.1:4432 (PID 16869). Stop it with "npm run pg:stop".
pg:init exit=0
07:12:24
```

(The summary block of the output repeats each step with its verdict; it is shortened to one line
here.)

Reading notes:

- **T5.** The string says `on x86_64-apple-darwin24.6.0` although the host is arm64. The binary
  is universal and the string is fixed when PostgreSQL is built. The process runs natively:
  `vmmap --summary 16869` printed `Code Type: ARM64`.
- **T3-b.** The server log has the refusal: `FATAL: password authentication failed for user
  "dems_app"`, matched by line 115 of `pg_hba.conf`, the `host all all 127.0.0.1/32
  scram-sha-256` line.
- **T5-j.** PG-21 is confirmed: an `ENABLE ALWAYS` trigger fires in a superuser session that has
  set `session_replication_role = replica`; an ordinary trigger does not. Guarantee G-2 of the
  database contract holds against that setting.
- **RP-3.** The server log holds no `CREATE ROLE` line (a statement that succeeds is not logged
  under the default settings, NL-5). The statement carried a SCRAM-SHA-256 verifier, not the
  password (deviation DV-1, section 10).

### 5.4 T5-h, recorded: a forced drop does not end a session of another role

```
T5-h   RECORDED [dems_owner@postgres] DROP DATABASE dems_trial_a WITH (FORCE)
                -> refused, SQLSTATE 42501: permission denied to terminate process
```

Server log: `DETAIL: Only roles with privileges of the role whose process is being terminated or
with privileges of the "pg_signal_backend" role may terminate this process.` PG-26 is confirmed,
and PG-27 too (the owner role sees the `datname` and `usename` of a `dems_app` session). For
TI-10 this is the second branch: with a leaked `dems_app` session the forced drop fails, the
helper reports the file as failed, and the stale-database sweep removes the database later.
`pg_signal_backend` is **not** granted to `dems_owner` (contract 15.1 item 26). Once the
`dems_app` session was closed, the plain `DROP DATABASE dems_trial_a` succeeded.

### 5.5 T4: listeners and the process (07:13:03, outside the sandbox)

```
$ cat .locks/postgres.pid
16869
$ lsof -nP -iTCP:4432 -sTCP:LISTEN
COMMAND    PID     USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
postgres 16869 gsp-budi    5u  IPv4 0x221f3bd13df085ec      0t0  TCP 127.0.0.1:4432 (LISTEN)
$ lsof -nP -a -c postgres -iTCP -sTCP:LISTEN   (every TCP listener of a postgres process of this user)
COMMAND    PID     USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
postgres 16869 gsp-budi    5u  IPv4 0x221f3bd13df085ec      0t0  TCP 127.0.0.1:4432 (LISTEN)
$ netstat -anv -p tcp | grep LISTEN | grep -E "\.(4432|5432) "   (any user; columns: proto, local address, state, process:pid)
tcp4  127.0.0.1.4432  LISTEN  postgres:16869
tcp4  *.5432          LISTEN  postgres:312
tcp6  *.5432          LISTEN  postgres:312
$ pgrep -P 16869 | xargs ps -o pid,ppid,user,command -p
  PID  PPID USER     COMMAND
16870 16869 gsp-budi postgres: io worker 0        
16871 16869 gsp-budi postgres: io worker 1        
16872 16869 gsp-budi postgres: io worker 2        
16873 16869 gsp-budi postgres: checkpointer         
16874 16869 gsp-budi postgres: background writer         
16876 16869 gsp-budi postgres: walwriter         
16877 16869 gsp-budi postgres: autovacuum launcher         
16878 16869 gsp-budi postgres: logical replication launcher         
$ /usr/bin/lockf -k -t 0 .locks/postgres.lock /usr/bin/true
rc=0 (0 = the lock is free: the server does not hold it)
$ ls /tmp/.s.PGSQL.*
srwxrwxrwx@ 1 postgres  wheel   0 Oct  4 06:36 /tmp/.s.PGSQL.5432
-rw-------  1 postgres  wheel  53 Oct  4 06:36 /tmp/.s.PGSQL.5432.lock
```

- Exactly one listener of this cluster, on `127.0.0.1:4432`, held by the server process only.
- `postgres:312` on `*:5432` is the host's own server (user `postgres`): **not ours**, untouched.
  The two entries in `/tmp` belong to it (owner `postgres`, port 5432). There is no
  `/tmp/.s.PGSQL.4432`: this cluster has no Unix socket and put nothing into `/tmp`.
- The server log confirms the single listener: its only "listening on" line is
  `listening on IPv4 address "127.0.0.1", port 4432`.

### 5.6 T6: a row survives stop and start (07:13:46 to 07:13:47)

```
$ node scripts/pg/trial.mjs t6-write
trial client -> 127.0.0.1:4432 as dems_owner
T6 write [dems_owner@dems_trial_p]: row (1, 'written before the stop') written at 2026-10-04T00:13:46.174Z
   server process started at 2026-10-04T00:12:24.210Z
exit=0
$ npm run pg:stop
waiting for server to shut down.... done
server stopped
pg:stop: stopped PID 16869; 127.0.0.1:4432 is free
exit=0
$ lsof -nP -iTCP:4432 -sTCP:LISTEN
rc=1 <end of lsof output>
$ ls .locks/postgres.pid
ls: .locks/postgres.pid: No such file or directory
$ npm run pg:start
waiting for server to start.... done
server started
pg:start: started, PID 18092, listening on 127.0.0.1:4432 (TCP only, no Unix socket)
  postgres 18092 gsp-budi    5u  IPv4 0x83a29694bc4e558      0t0  TCP 127.0.0.1:4432 (LISTEN)
  PID file: .locks/postgres.pid. Stop with "npm run pg:stop".
exit=0
$ node scripts/pg/trial.mjs t6-read
trial client -> 127.0.0.1:4432 as dems_owner
T6 read  [dems_owner@dems_trial_p]: row (1, 'written before the stop') written at 2026-10-04T00:13:46.174Z
   server process started at 2026-10-04T00:13:46.879Z (after the row was written)
   dems_trial_p dropped
T6 PASS: the row survived stop and start
exit=0
```

`pg:stop` runs `pg_ctl -D .data/postgres -m fast -w -t 60 stop`; the server log shows
`received fast shutdown request` at 07:13:46.401.

### 5.7 T7: nothing is left after stop (07:14:04, outside the sandbox)

```
$ npm run pg:stop
waiting for server to shut down.... done
server stopped
pg:stop: stopped PID 18092; 127.0.0.1:4432 is free
exit=0
$ lsof -nP -iTCP:4432 -sTCP:LISTEN
rc=1 <end of lsof output>
$ netstat -an -p tcp | grep LISTEN | grep "\.4432 "
rc=1 <end of netstat output>
$ pgrep -x -u gsp-budi postgres    (processes named postgres of this user)
rc=1 <end of pgrep output>
$ pgrep -fl -- "-D /Users/gsp-budi/Documents/DEMS/.data/postgres"    (any process on the project data directory)
rc=1 <end of pgrep output>
$ ps -axo pid,ppid,user,comm | awk "$4 ~ /postgres/"    (every user)
  312     1 postgres         /Library/PostgreSQL/18/bin/postgres
  380   312 postgres         postgres: logger 
  381   312 postgres         postgres: io worker 0
  382   312 postgres         postgres: io worker 1
  383   312 postgres         postgres: io worker 2
  384   312 postgres         postgres: checkpointer 
  385   312 postgres         postgres: background writer 
  387   312 postgres         postgres: walwriter 
  388   312 postgres         postgres: autovacuum launcher 
  389   312 postgres         postgres: logical replication launcher 
$ launchctl list | grep -i postgres
rc=1 <end of launchctl output>
$ ls ~/Library/LaunchAgents | grep -i postgres
$ ls /Library/LaunchAgents | grep -i postgres
$ ls /Library/LaunchDaemons | grep -i postgres
postgresql-18.plist
$ ls -l /Library/LaunchDaemons/postgresql-18.plist  (owner and date only; the file is not read)
-rw-r--r--@ 1 root  wheel  614 Sep 12 14:19 /Library/LaunchDaemons/postgresql-18.plist
$ ls .data/postgres/postmaster.pid .locks/postgres.pid
ls: .data/postgres/postmaster.pid: No such file or directory
ls: .locks/postgres.pid: No such file or directory
$ HOMEBREW_NO_AUTO_UPDATE=1 brew services list
Name   Status User File
colima none                 
omlx   none                 
rc=0 <end of brew services output>
$ brew list --formula | grep -i postgres
rc=1 <end>
```

- **No process of this cluster.** The ten processes listed belong to the operating-system user
  `postgres`, PID 312 and its children, started from `/Library/PostgreSQL/18`: the host's own
  server, **not ours**.
- **No launchd job of ours.** `launchctl list` of this user names none. The one PostgreSQL
  entry on the host is `/Library/LaunchDaemons/postgresql-18.plist`, owned by `root`, dated
  12 September: the host server's own job, **not ours**; this task did not create, read or
  change it.
- **No brew service.** The two entries are unrelated (`colima`, `omlx`, both `none`); no
  PostgreSQL formula is installed. Homebrew was only asked to list; nothing was installed.

### 5.8 The scripts are idempotent and refuse what they must (07:14:25)

```
$ npm run pg:stop   (already stopped)
pg:stop: no server running; nothing done
exit=0
$ npm run pg:status   (stopped)
server     NOT RUNNING. Start it with "npm run pg:start".
host authentication (HA-1 to HA-4)
  HA-1 PASS
  HA-2 PASS
  HA-3 PASS
  HA-4 not run (the server is stopped)
pg:status: stopped (file checks passed)
exit=3
$ npm run pg:init   (a cluster exists)
pg:init: refused: already provisioned, or partly provisioned (.data/postgres, .data/pg.pwfile, .data/pg.owner.env, .data/pg.env). Nothing was changed.
  The server:            npm run pg:status / npm run pg:start
  An interrupted init:   node scripts/pg/init.mjs --resume   (creates only what is missing)
  A new cluster:         npm run pg:remove-data, then npm run pg:init   (deletes every database)
exit=1
$ npm run pg:start
waiting for server to start.... done
server started
pg:start: started, PID 19121, listening on 127.0.0.1:4432 (TCP only, no Unix socket)
  postgres 19121 gsp-budi    5u  IPv4 0x2a042e4c1fb586a9      0t0  TCP 127.0.0.1:4432 (LISTEN)
  PID file: .locks/postgres.pid. Stop with "npm run pg:stop".
exit=0
$ npm run pg:start   (already running)
pg:start: already running, PID 19121 on 127.0.0.1:4432; nothing done
exit=0
$ node scripts/pg/check-hba.mjs
host-authentication check on .data/postgres/pg_hba.conf
  HA-1 PASS
  HA-2 PASS
  HA-3 PASS
exit=0
$ node scripts/pg/check-superuser-trigger.mjs
pg:check-superuser-trigger: this check is trial step T5-j: it runs inside "npm run pg:init" only, at provisioning (the one time the bootstrap superuser is used). It has no command of its own.
exit=2
```

`pg:remove-data` and `pg:remove` were **not executed**. Their guards are tested against
temporary directories (section 8).

## 6. Roles, credentials and host authentication

### 6.1 Roles (from `pg_roles`, read as `dems_owner`; flags only)

| Role | Superuser | Create database | Create role | Replication | Bypass RLS | Login | Use |
|---|---|---|---|---|---|---|---|
| `dems_admin` | true | true | true | true | true | true | The role `initdb` created. Used in this row only: RP-3 (two `CREATE ROLE`) and T5-j. **Nothing connects as it again** |
| `dems_owner` | false | **true** | false | false | false | true | Owns the project databases: `db:*` commands, the test helper, the reset routine |
| `dems_app` | false | false | false | false | false | true | The server's runtime role |

`pg_roles` shows no password; none was read or printed.

### 6.2 Credential files (names, modes, key names only)

```
$ stat -f '%Lp %N' .data .data/postgres .data/pg.pwfile .data/pg.owner.env .data/pg.env .data/postgres.log .data/pg-scripts.log     (07:16:16)
700 .data
700 .data/postgres
600 .data/pg.pwfile
600 .data/pg.owner.env
600 .data/pg.env
600 .data/postgres.log
600 .data/pg-scripts.log
```

| File | Mode | Holds | Read by |
|---|---|---|---|
| `.data/pg.pwfile` | 600 | One line: the password of `dems_admin` | `initdb`, by path (`--pwfile`); `scripts/pg/init.mjs` (RP-3) and `scripts/pg/check-superuser-trigger.mjs` (T5-j). **Read only by `scripts/pg/`, and only inside `pg:init`**; a static test holds this (section 8) |
| `.data/pg.owner.env` | 600 | Five keys: `DEMS_PG_HOST`, `DEMS_PG_PORT`, `DEMS_PG_DATABASE`, `DEMS_PG_OWNER_ROLE`, `DEMS_PG_OWNER_PASSWORD` | `scripts/pg/` for the trial; later the `db:*` commands, the test helper, the reset routine |
| `.data/pg.env` | 600 | Five keys: `DEMS_PG_HOST`, `DEMS_PG_PORT`, `DEMS_PG_DATABASE`, `DEMS_PG_APP_ROLE`, `DEMS_PG_APP_PASSWORD` | `scripts/pg/` for T3-b, T5-h and HA-4; later the server's loader and the test helper |

- `DEMS_PG_DATABASE` is `postgres` in the owner file (the maintenance database, DA-12) and
  `dems_demo` in the runtime file. `dems_demo` does not exist yet; W20 creates it.
- Generation: `crypto.randomBytes(32)` as base64url for each of the three (CR-5 asks for at
  least 24 bytes). Each file was created with the exclusive flag and mode 0600.
- A password is never a process argument and never in a child environment: `initdb` gets
  `--pwfile=<path>`; `run()` in `lib.mjs` refuses to start a child whose arguments or
  environment contain a registered secret, and `say()` replaces one by `[redacted]`.
- Leak check at 07:15 and again at 07:22, after both documents of this row were written
  (patterns read from the three files; counts only): 142 files scanned at 07:22
  (`.data/postgres.log`, `.data/pg-scripts.log`, `scripts/pg/**`, this task's `docs/` folder,
  `.locks/postgres.*`); **0** contain a credential value. The server's command line
  (section 7) holds none.

```
$ git check-ignore -v .data/postgres .data/pg.pwfile .data/pg.owner.env .data/pg.env     (07:16:16)
.gitignore:70:/.data/	.data/postgres
.gitignore:70:/.data/	.data/pg.pwfile
.gitignore:70:/.data/	.data/pg.owner.env
.gitignore:70:/.data/	.data/pg.env
rc=0
$ git status --porcelain -- .data | wc -l
       0
$ git status --porcelain --ignored -- .data .locks scripts
?? scripts/pg/
!! .data/
!! .locks/
!! scripts/.DS_Store
```

### 6.3 `pg_hba.conf`, effective lines

```
local   all             all                                     scram-sha-256
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
local   replication     all                                     scram-sha-256
host    replication     all             127.0.0.1/32            scram-sha-256
host    replication     all             ::1/128                 scram-sha-256
```

Written by `initdb -A scram-sha-256` and not edited. No `trust` line. Every line asks for a
SCRAM password. The two `local` lines and the two `::1/128` lines are inert: the Unix socket is
off (`unix_socket_directories = ''`) and the server listens on `127.0.0.1` only; they still
carry `scram-sha-256`, so none would give access without a password (HA-3). `check-hba.mjs`
fails on any other method, any other address, any other line type and any include directive.

## 7. State at the end, and how to start, stop and check

```
$ npm run pg:status                                         (07:16:01, outside the sandbox)
cluster    .data/postgres (PG_VERSION 18)
settings   listen_addresses = '127.0.0.1', port = 4432, unix_socket_directories = '' (configuration files)
server     RUNNING, PID 19121 (postmaster.pid: 127.0.0.1:4432, status "ready", connect probe: open)
pid file   .locks/postgres.pid = 19121
listener   postgres 19121 gsp-budi    5u  IPv4 0x2a042e4c1fb586a9      0t0  TCP 127.0.0.1:4432 (LISTEN)
host authentication (HA-1 to HA-4)
  HA-1 PASS
  HA-2 PASS
  HA-3 PASS
  effective lines of .data/postgres/pg_hba.conf (6):
    (the six lines of section 6.3)
  HA-4 PASS | a connection as dems_app with a wrong password: SQLSTATE 28P01
file modes (expected 700 for directories, 600 for files)
  700  .data
  700  .data/postgres
  600  .data/pg.pwfile
  600  .data/pg.owner.env
  600  .data/pg.env
  600  .data/postgres.log
  600  .data/pg-scripts.log
connection files (key names only)
  .data/pg.owner.env: DEMS_PG_HOST, DEMS_PG_PORT, DEMS_PG_DATABASE, DEMS_PG_OWNER_ROLE, DEMS_PG_OWNER_PASSWORD
  .data/pg.env: DEMS_PG_HOST, DEMS_PG_PORT, DEMS_PG_DATABASE, DEMS_PG_APP_ROLE, DEMS_PG_APP_PASSWORD
pg:status: OK, running
exit=0

$ cat .locks/postgres.pid; lsof -nP -iTCP:4432 -sTCP:LISTEN           (07:16:16)
19121
COMMAND    PID     USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
postgres 19121 gsp-budi    5u  IPv4 0x2a042e4c1fb586a9      0t0  TCP 127.0.0.1:4432 (LISTEN)
$ ps -o pid,ppid,user,command -p $(cat .locks/postgres.pid)
  PID  PPID USER     COMMAND
19121     1 gsp-budi /Users/gsp-budi/Documents/DEMS/node_modules/@embedded-postgres/darwin-arm64/native/bin/postgres -D /Users/gsp-budi/Documents/DEMS/.data/postgres -c listen_addresses=127.0.0.1 -c port=4432 -c unix_socket_directories=
$ tail -7 .data/postgres/postgresql.conf
# Add settings for extensions here

# --- DEMS project-local settings (scripts/pg/init.mjs; plan W07, analysis TD-02) ---
# Loopback IPv4 only, the project port, no Unix socket. Never the default port.
listen_addresses = '127.0.0.1'
port = 4432
unix_socket_directories = ''
$ cat .data/postgres/postgresql.auto.conf
# Do not edit this file manually!
# It will be overwritten by the ALTER SYSTEM command.
$ du -sh .data
 55M	.data
```

The logging settings were not touched: `postgresql.conf` holds them as the commented defaults
(`#log_statement = 'none'`, `#log_min_duration_statement = -1`,
`#log_parameter_max_length_on_error = 0`), and T5-i shows that the owner role cannot change them
(NL-5).

| To | Command | Notes |
|---|---|---|
| Check | `npm run pg:status` | Exit 0 running and every check passed; 1 a check failed; 2 running, but the caller may not connect to `127.0.0.1:4432` (a command sandbox), so HA-4 was not run; 3 stopped; 4 no cluster |
| Start | `npm run pg:start` | No-op if it runs. Refuses if the port is taken by anything else. Writes `.locks/postgres.pid` |
| Stop | `npm run pg:stop` | `pg_ctl -m fast -w stop`. No-op if it does not run. Removes `.locks/postgres.pid` |
| Final check of this row | `npm run pg:status` at 07:22:32 | `server RUNNING, PID 19121`, `HA-4 PASS`, `pg:status: OK, running`, exit 0; `lsof` shows the one listener on `127.0.0.1:4432`; the lock is free |
| Create (once) | `npm run pg:init` | Refuses if a cluster or a credential file exists. Leaves the server running |
| Check `pg_hba.conf` only | `node scripts/pg/check-hba.mjs` | Exit 0 pass, 1 fail |
| Repeat the owner-role trial steps | `node scripts/pg/trial.mjs owner-steps` | T5 and T5-a to T5-i as `dems_owner`; never T5-j |

- The server does **not** come back after a reboot or a logout: nothing starts it. Run
  `npm run pg:start`.
- Start, stop, init and the removals take `.locks/postgres.lock` through `/usr/bin/lockf -k`.
  The running server does not hold the lock (section 5.5).
- **P15 from here on:** no row stops the server except W89 and W90.
- **Sandbox.** Start, stop, `initdb` and every client connection need the per-command sandbox
  bypass (finding F-1, section 9).

## 8. Tests: `npm run test:pg-scripts`

```
$ npm run test:pg-scripts            (07:22:24, inside the sandbox, with the server running; after the last edit)
> node --test scripts/pg/
(55 lines that begin with the pass mark, one per test; none with the fail mark)
ℹ tests 55
ℹ suites 0
ℹ pass 55
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 114.573083
exit=0
```

Earlier runs of the same suite: 07:11 (55 of 55, before provisioning) and 07:15:35 (55 of 55).

No test needs a database, binds a port or opens a connection. Every test that writes uses a
temporary directory under `$TMPDIR`.

| File | Tests | Covers |
|---|--:|---|
| `lib.test.mjs` | 17 | The endpoint guard (5432 refused, any other host or port refused); the environment scrub; no secret in an argument or a child environment (CR-4); exclusive creation with mode 600 (CR-5); the five keys (CR-1); **T-CR-4** (mode 644 stops the loader, the message names the file and not the content); a connection file with port 5432 or another host; the settings reader |
| `server.test.mjs` | 8 | **`pg:start` refuses a cluster whose port is 5432 or whose host is not 127.0.0.1, before `pg_ctl` is run** (rule 1 of this row); a Unix socket directory; no cluster; `pg:stop` as a no-op; the state reader |
| `check-hba.test.mjs` | 7 | **T-HA-1** on the three fixtures (pass; fail on HA-1; fail on HA-2); other methods, addresses, line types, include directives |
| `init.test.mjs` | 8 | CR-7 on the real workspace; **T-CR-1** on a temporary root (700, 600, 600, 600); the pinned key names; three different passwords of at least 24 bytes; `pg:init` refuses an existing cluster or credential file and changes nothing; the `initdb` arguments carry `--pwfile=<path>`; no logging setting is written (NL-5); the role attributes |
| `remove-data.test.mjs` | 7 | The removal guards: only `<root>/.data` of a root whose manifest is named `dems-demo`; a symbolic link refused; a running server refused; the commands of `pg:remove` equal RB-01; no command acts under the test runner |
| `db.test.mjs` | 2 | The SCRAM-SHA-256 verifier against the example of RFC 7677 section 3 |
| `static.test.mjs` | 6 | **The static check** over `scripts/` and all six manifests: no libpq password variable, no connection URL variable or URL with a user part, no environment-file option, no sourcing of a file under `.data/`, no password option; no npm script carries a secret or a credential file; the superuser's password file is read by two files only; child processes start in `lib.mjs` only; host and port never come from the environment |

Test ledger (P24): `scripts/pg/` is not a workspace. `test:pg-scripts` went from 0 tests (the
folder did not exist) to **55 tests in 7 files**. No workspace total changed; no existing test
was changed.

## 9. Findings

| ID | Finding | Evidence |
|---|---|---|
| F-1 | **Inside the command sandbox three things do not work.** (a) `initdb` fails: `FATAL: could not create shared memory segment: Operation not permitted` (`shmget`). (b) A TCP connection to `127.0.0.1:4432` is refused with `EPERM`, so every database client (the `db:*` commands, `test:db`, the Core server) needs the per-command bypass, like a port bind. (c) `pg_ctl status` prints `pg_ctl: no server running` for a server that runs, because it may not signal it. `pg:status` does not use `pg_ctl status`; in a sandbox it reports `RUNNING` from the PID and the files, marks HA-4 as not run and exits 2 | A scratch `initdb` under `$TMPDIR` at 07:06 (no port bound; the scratch folder was deleted); `npm run pg:status` inside the sandbox at 07:13: `connect probe: error:EPERM`, and exit 2 after the change of DV-7; `pg_ctl -D .data/postgres status` inside the sandbox at 07:13 printed `pg_ctl: no server running` while PID 16869 ran |
| F-2 | T5-h: the owner role cannot force-drop a database on which a session of `dems_app` is open (`42501`). TI-10's second branch applies; `pg_signal_backend` is not granted | Section 5.4 |
| F-3 | **T-AO-4 needs one more exception.** The contract's own step T5-i makes `scripts/pg/trial.mjs` issue `ALTER SYSTEM SET log_statement = 'all'` (expected to be refused, and refused). T-AO-4 expects no match for `ALTER SYSTEM` in `scripts/` and lists an exception for `session_replication_role` only. Matches in `scripts/pg/`, non-test files: `ALTER SYSTEM` in `trial.mjs` (T5-i and its undo); `session_replication_role` in `trial.mjs` (T5-f) and `check-superuser-trigger.mjs` (T5-j); `DROP DATABASE` in `trial.mjs`. No `DISABLE TRIGGER`, no `DROP TRIGGER`, no `CREATE OR REPLACE` | Contract 6.5 T-AO-4, 7.1 T5-i |
| F-4 | The npm binaries are universal (x86_64 and arm64), signed by EDB (`com.edb.postgresql`, team `26QKX55P9K`, hardened runtime) and not quarantined. `version()` names `x86_64-apple-darwin24.6.0`; the process is `ARM64` | Section 5.2; `vmmap --summary` |
| F-5 | Hypotheses confirmed by execution: PG-21 (T5-j), PG-22 (T5-f), PG-23 (T5-a to T5-e, T5-g), PG-26 and PG-27 (T5-h), PG-28 (T3-a, T3-b), DA-11, DA-12, AS-01; and of TD-02: `pg_ctl -w` reports readiness without a Unix socket; `initdb` accepts `-E UTF8 --locale=C`. `initdb` 18 enables data page checksums by default and chose `max_connections` 100, `shared_buffers` 128MB | Section 5.3 |
| F-6 | The host's own PostgreSQL has a launchd job file dated 12 September (`/Library/LaunchDaemons/postgresql-18.plist`, owner `root`). **Hypothesis** from that file date: the server was installed before this task and before the predecessor's sessions, and F1 missed it only because it is not on the `PATH`. F27 infers that it was installed after the predecessor's last session; the file date speaks against that. The file was listed, not read; nothing was done to the server | Section 5.7 |
| F-7 | `.data/.DS_Store` (mode 644) appeared at 07:16. macOS Finder wrote it, not the scripts. It holds no project data and is ignored by git. A check that expects 600 on **every** file under `.data/` would trip on it; AC-B-64 names the three secret files and the log files only | `ls -la .data` at 07:16:16 |
| F-8 | The macOS firewall is disabled; no prompt appeared | Section 4 |
| F-9 | After a reboot `postmaster.pid` stays behind. PostgreSQL treats it as stale and starts, unless another live process happens to have the same PID; then `pg:start` fails with PostgreSQL's own "lock file already exists" message (shown from the log) and the file must be removed by hand. Input for the README row (W86) | PostgreSQL behaviour; not executed |
| F-10 | `/usr/bin/lockf` does not pass its lock to the server it starts: the lock is free while the server runs | Section 5.5 |

## 10. Deviations from the row text

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | RP-3 says the password is placed in `CREATE ROLE ... PASSWORD '...'` as a literal escaped by the driver. The script places the **SCRAM-SHA-256 verifier** there (computed by the script, escaped by the driver's `escapeLiteral`) | The clear password then never travels in a statement, so even a failed statement in the server log could not hold it. PostgreSQL stores a verifier of that form as it is. Proven: T5 and T6 log in with the passwords; T3-b is refused; `db.test.mjs` checks the function against RFC 7677 |
| DV-2 | One file more under `.data/` than the inventory of contract 7.6: `.data/pg-scripts.log` (mode 600), JSON lines with timestamp, level, source, message, stack trace, context and a run identifier | This agent's rule that every error path writes to a persistent log. It is git-ignored (`pg:init` checks that), holds no secret (leak check, section 6.2), is rotated at 1 MiB and goes with `.data/` |
| DV-3 | More files than the eight scripts the row names: `lib.mjs`, `server.mjs`, `db.mjs`, `trial.mjs` and three fixtures, all inside `scripts/pg/**` | Shared code in one place; the trial as its own file; the fixtures of T-HA-1 |
| DV-4 | `pg:init` has a flag `--resume` (create only what is missing, then RP-3 to RP-6 again). **It was not executed**: it connects as `dems_admin`, which this row may do only once | RP-6 allows "a repeat of this script"; without the flag `pg:init` refuses, as rule 6 asks. Its steps are the functions the first run executed, each behind an existence check |
| DV-5 | `pg:remove-data` stops the server itself and then refuses if a server still runs | The plan says it "stops the server and deletes `.data/`" (RB-02); this row's rule says it "refuses unless the server is stopped". Both hold |
| DV-6 | The endpoint settings are written to `postgresql.conf` (as TD-02 says) **and** passed on the server's command line | Section 2.1 |
| DV-7 | Three edits after the provisioning run of 07:12: `status.mjs` gained exit code 2 (F-1); in `trial.mjs` the `RESET` after T5-f now runs only if the `SET` was accepted (it was refused as well and only added a log line), and the command `owner-steps` was added; one variable in `init.mjs` was renamed | Re-verified: `node scripts/pg/trial.mjs owner-steps` at 07:16:01, every owner-role step PASS again, exit 0; `npm run pg:status` exit 0; `npm run test:pg-scripts` exit 0 at 07:22:24. **Not re-executed:** T5-j. Its file did not change, but its caller did: `trial.mjs` now runs it only when `pg:init` passes `{ superuserStep: true }` (a static test holds that only `init.mjs` does). That branch runs next in W90's clean rebuild |
| DV-8 | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were not written | Parallel run: the controller writes the shared files (P8) |

## 11. Decisions for the controller to record

| ID | Question | Recommendation |
|---|---|---|
| DN-1 | P10 does not name database connections. Inside the sandbox they fail with `EPERM` (F-1) | Add to P10: a connection to `127.0.0.1:4432` (`db:*`, `test:db`, the server) and `pg:start`, `pg:stop`, `pg:init` need the per-command bypass. `npm run pg:status` exit 2 means "run it outside the sandbox", not "down" |
| DN-2 | T5-h (F-2): grant `pg_signal_backend` to `dems_owner`? | No. Keep contract 15.1 item 26: the helper closes its pools first. A grant would need one more superuser session |
| DN-3 | T-AO-4 (F-3) | Tell the owner of that static test (W08, W17): exempt `ALTER SYSTEM` in `scripts/pg/trial.mjs`, beside the exception it already has |
| DN-4 | DV-1, the verifier in `CREATE ROLE` | Accept |
| DN-5 | DV-2, the file `.data/pg-scripts.log` | Accept, or ask for its removal (it is one function, `logEvent`, in `lib.mjs`) |
| DN-6 | F-6, the wording of F27 | Correct "installed after the predecessor's last session" |
| DN-7 | F-7, `.data/.DS_Store` | Tell W58 and W90 to `stat` the named files, as AC-B-64 says, not every file |

## 12. Removal and rollback (H-02, H-03): verbatim, not executed

From `masterplan/02_plan.md` section 14.3 (RB-01 to RB-03 in full; of RB-11 the two files of this
row). Run from the workspace root, only on the controller's or the user's instruction. The trial passed and the cluster is usable, so no rollback was run.

```sh
# Variables
ROOT=/Users/gsp-budi/Documents/DEMS
PGBIN="$ROOT/node_modules/@embedded-postgres/darwin-arm64/native/bin"
PGDATA="$ROOT/.data/postgres"

# RB-01  remove the PostgreSQL binary package and the root driver (after RB-02)
/usr/bin/lockf -k -t 3600 "$ROOT/.locks/npm.lock" npm uninstall embedded-postgres pg
npm install-scripts prune            # drops the allowScripts entry of the binary package
# RB-02 followed by RB-01 is what "npm run pg:remove" runs.

# RB-02  remove the cluster, the credentials and the log   (= npm run pg:remove-data)
"$PGBIN/pg_ctl" -D "$PGDATA" -m fast -w stop      # ignore "no server running"
rm -rf "$ROOT/.data"

# RB-03  stop the PostgreSQL process                        (= npm run pg:stop)
"$PGBIN/pg_ctl" -D "$PGDATA" -m fast -w stop
lsof -nP -iTCP:4432 -sTCP:LISTEN                  # expect no output

# RB-11  lock, PID and log files this task created (excerpt: the two files of this row)
rm -f "$ROOT"/.locks/postgres.pid "$ROOT"/.locks/postgres.lock
```

| Register line | What exists now | Removed by |
|---|---|---|
| H-02 | `.data/`: the cluster (55 MB), three credential files, `postgres.log`, `pg-scripts.log` | RB-02, or `npm run pg:remove-data` |
| H-03 | One process tree, PID 19121, listening on `127.0.0.1:4432`; not started at login | RB-03, or `npm run pg:stop` |
| H-11 (part) | `.locks/postgres.pid`, `.locks/postgres.lock` | RB-11; `pg:stop` removes the PID file |
| H-15 (part) | The roles `dems_owner` and `dems_app`, inside the cluster | With the cluster (RB-02) |

Nothing was written outside the project: no Docker, no Homebrew install, no launchd job, no
login item, no shell-profile edit, nothing in `/tmp` from this cluster. The scripts' rollback is
R-NEW: remove `scripts/pg/`.

## 13. Verification list of the row

| # | Check | Result | Evidence |
|--:|---|---|---|
| 1 | `lsof -nP -iTCP:4432 -sTCP:LISTEN` immediately before the first start prints nothing | PASS | 4; 5.3 "First start" |
| 2 | The version string names 18.4 | PASS | 5.2; 5.3 T5 |
| 3 | Exactly one listener on `127.0.0.1:4432`, nothing of ours on another address | PASS | 5.5 |
| 4 | A wrong password is refused with `28P01` | PASS | 5.3 T3-b; 7 HA-4 |
| 5 | As `dems_owner`, `SET session_replication_role = replica` and `CREATE ROLE` fail with `42501` | PASS | 5.3 T5-f, T5-g |
| 6 | As `dems_owner`, create from `template0`, clone, rename inside a transaction and drop succeed | PASS | 5.3 T5-a to T5-e |
| 7 | A row survives stop and start | PASS | 5.6 |
| 8 | After `pg:stop`: no process of this cluster, no launchd job of ours, no brew service | PASS | 5.7 |
| 9 | `git check-ignore -v` matches `.data/postgres` and the three credential files | PASS | 4; 6.2 |
| 10 | `stat -f '%Lp'`: 700 for `.data`, 600 for the three files (and the logs) | PASS | 6.2 |
| 11 | `pg_roles`: `dems_owner` with `rolcreatedb` only, `dems_app` with no flag | PASS | 6.1 |
| 12 | `pg_hba.conf`: only `scram-sha-256` lines for loopback | PASS | 6.3 |
| 13 | T5-j: UPDATE, DELETE and TRUNCATE refused with `ZA002` under `ENABLE ALWAYS`; the UPDATE succeeds in the default mode; no superuser connection stays open | PASS | 5.3 T5-j1 to T5-j |
| 14 | `npm run test:pg-scripts` exits 0 | PASS | 8 |
| 15 | At the end the server runs, `pg:status` exits 0, the PID is in `.locks/postgres.pid` | PASS | 7 |
| 16 | `git status --porcelain` shows only `scripts/pg/` as new files from this row | PASS | 6.2 (`?? scripts/pg/`; `.data/` and `.locks/` are ignored) |
| 17 | SU-1: the three hashes equal those of step 25 | PASS | 3 |

Acceptance criteria and requirements this row serves: AC-B-03 (the 4432 half), AC-B-64,
AC-B-86 (scripts, manifests, key names), AC-B-91 (the three binaries); SR-01, SR-02, SR-60,
SR-68 (the roles), SR-77, SR-80.

---
*Generated: 2026-10-04 07:18*
*Last Updated: 2026-10-04 07:23*
