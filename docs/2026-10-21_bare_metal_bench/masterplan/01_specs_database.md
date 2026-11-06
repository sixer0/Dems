---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
date: 2026-10-22
agent: database-specialist
row: 13
type: specification (database delta, install)
tier: 1
status: complete (one DEP placeholder, four REQ names; see section 11)
source_structured_task: identification/02_structured.md row 13 (line 181); W2, W3, W10 (lines 118-126); rows 39-41, 43, 44 (lines 207-212)
inputs: research/01_explore_database_commands.md, research/02_collection_pgdg.md, research/01_explore_cli_invocation.md, masterplan/01_specs_register.md, masterplan/01_specs_service.md, masterplan/01_specs_rflex_register.md, decisions.md D8-D13
last_updated: 2026-10-22
---

# Database delta for host .73 (row 13)

Names come only from `masterplan/01_specs_register.md` (written "register" below, with its section number). A name the register does not hold is written `<REQ:name>` and filed in `delegation_progress/file_requests.md`. A value that depends on the unfinished R-FLEX database spec (row 91) is written `<DEP:row91:...>` with its default. No secret value appears in this file, and no command in it prints one.

Repository paths are relative to `/Users/gsp-budi/Documents/DEMS`. Host paths are absolute.

## 0. 5W1H frame

| | |
|---|---|
| What | The PostgreSQL part of the bare-metal install on .73: package source and version pin, cluster creation, port and listen address, unix socket, server data directory, the two project roles, the two settings files `pg.env` and `pg.owner.env` (place, owner, mode, lifetime, how they are written), the secret flow of OI-4 option B, the `db:*` run as the service user, and HOST-50..HOST-56 each as a command plus a check |
| Who | Written by database-specialist (row 13). Applied by rows 39 (install), 40 (configure), 41 (roles and settings files, HIL OI-4), 43 (unit ordering, with row 15's unit), 44 (create, migrate, seed, status). Runbook text by row 18. Checked by rows 74-75 |
| When | Spec stage S3 (driver_rules.md, "Spec waves"), started under D13 beside rows 88-94. Applied after gate G-RF (row 119) like every install row |
| Where | Host `gsp-dems@192.168.0.73`, Ubuntu 24.04.1 noble, x86_64 (register 0). One ext4 file system (register 1.1, HOST-07) |
| Why | `scripts/host/95-database.sh` is print-only (`HP_APPLY_SUPPORTED=0`, :14) and leaves the port (DB-04, :64), the owner settings place (DB-05, :77) and the unit name (DB-07) open. Wave 1 found that the code fixes three of these: port 5432 refused (W2), data dir fixed at `<install-dir>/.data` (W1), and nothing writes `pg.owner.env` on Ubuntu (W3) (research/01_explore_database_commands.md §6-§7) |
| How | Every setting traced to the code that reads it (owner-connection.ts, config.ts, boot-checks.ts, the migrations), to the dev provisioning script that is the project's own precedent (`scripts/pg/init.mjs`), or to the PGDG collection (row 10). Choices state their alternatives and the reason |

## 1. Facts from code that bind this spec

| # | Fact | Source |
|---|---|---|
| C1 | `db:create`, `db:migrate`, `db:seed`, `db:status` connect as `dems_owner` and refuse a superuser session (`OWNER_ROLE_REFUSED`) | apps/core-server/src/db/commands/owner-connection.ts:28, :246-266 |
| C2 | They read only `<data dir>/pg.owner.env`; mode must have no group/other bit (`OWNER_FILE_MODE`), else nothing is read | owner-connection.ts:32, :99-116, :122-124 |
| C3 | Owner file: exactly five keys `DEMS_PG_HOST`, `DEMS_PG_PORT`, `DEMS_PG_DATABASE`, `DEMS_PG_OWNER_ROLE`, `DEMS_PG_OWNER_PASSWORD`; lines `KEY=value`; unknown, duplicate or empty key refused; host must be `127.0.0.1`; port numeric and not 5432 | owner-connection.ts:34-40, :132-178 |
| C4 | The target database comes from `--database` (required, exactly once, closed list `dems_demo`, `dems_lane_1..3`); the maintenance database is `postgres`. The file's `DEMS_PG_DATABASE` is required non-empty but is not the target | research/01_explore_database_commands.md:31-33, :54; database-names.ts:18 |
| C5 | All `PG*` environment variables are deleted before any client exists; no secret from env or argument | cli.ts:13-14, :188-189; owner-connection.ts:93-97 |
| C6 | Data dir is `DEFAULT_DATA_DIR` = `<install-dir>/.data` = `/opt/dems/core/.data`; no flag or env sets it for `db:*` | register 1.1 (W1); load-config.ts:53-61 |
| C7 | No `db:*` command creates a role; both roles must exist before `db:create` / `db:migrate` (`ROLE_MISSING`) | owner-connection.ts:272-284 |
| C8 | `db:create` runs `CREATE DATABASE <name> OWNER dems_owner TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'` from the maintenance database, so `dems_owner` needs `CREATEDB` | create.ts:9-10, :50-59 |
| C9 | All object grants to `dems_app` are made by the migrations (`REVOKE ALL ON SCHEMA public FROM PUBLIC; GRANT USAGE ... TO dems_app`, column-level `GRANT UPDATE`, `GRANT EXECUTE`), first in `0003_privileges.sql`, then in every `*_privileges.sql`. `0003` requires `dems_app` to exist | apps/core-server/src/db/migrations/0003_privileges.sql:4-66; ls of the migrations folder |
| C10 | The project's role attributes: owner `LOGIN NOSUPERUSER CREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`; app `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS` | scripts/pg/init.mjs:58-59 |
| C11 | Passwords are stored as a SCRAM-SHA-256 verifier computed client-side, "so the clear password never travels in a statement and cannot reach the server log" (`scramVerifier`, exported) | scripts/pg/db.mjs:29-38 |
| C12 | Boot check B-2 accepts any server whose major is 18 and whose database encoding is `UTF8`; the minor is not checked | apps/core-server/src/db/schema/boot-checks.ts:77-90 |
| C13 | No migration creates an extension (grep `extension` over the migrations: one comment hit, 0007:57, not a statement). No superuser-only object is needed | grep this session |
| C14 | Migrations today: 34 journal entries, `0000_prelude` .. `0033_capture_device_retirement_privileges`; version row schema 15, contract `dbc-16` | apps/core-server/src/db/migrations/meta/_journal.json (python count = 34); apps/core-server/src/db/schema/meta.ts:121, :123 |
| C15 | `db:seed` decides the demo packages from the process environment: a development-capture Core gets them, "any other Core a named skip". Under `sudo` the environment carries no Core key, so the seed takes the skip | apps/core-server/src/db/seed/cli.ts:40-47, :98-100 |
| C16 | The Core reads its database settings only from `<data dir>/pg.env` (role `dems_app`), never from `/etc/dems/core.env` | register 3.2, 6.1; load-config.ts:105-114 |

## 2. HOST-50 / HOST-51: package source and version pin (U-RF10)

### 2.1 Source

Choice **B** of HOST-50 (PGDG packages), approved as A3 in D8. Repository, suite and key path as in register 7.3 and research/02_collection_pgdg.md §2: `/etc/apt/sources.list.d/pgdg.sources`, suite `noble-pgdg`, `Signed-By: /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc`. Packages named explicitly: `postgresql-18`, `postgresql-client-18` (a bare `postgresql` may resolve to 19 or 20; 02_collection_pgdg.md:58).

### 2.2 Minor version decision (U-RF10, delegated to this row by D12)

**Decision: pin `18.6-1.pgdg24.04+2` (current 18.x in PGDG noble on 2026-10-19), hold it with `apt-mark hold`.**

| | 18.4-1.pgdg24.04+1 (pinned to the tested minor) | **18.6-1.pgdg24.04+2 (current minor)** |
|---|---|---|
| Matches what the tests ran on | Yes: the dev cluster is embedded-postgres `18.4.0-beta.17` (package.json:65) and the Docker image `postgres:18.4` (02_collection_pgdg.md:12) | Same major, different minor |
| Code acceptance | Passes B-2 (major 18) | Passes B-2 (major 18). No code reads the minor (C12) |
| Fixes | Lacks the fixes of 18.5 and 18.6 | Carries them |
| Reproducible re-install | 18.4 is still in the index but "older versions may be pruned later" (02_collection_pgdg.md:56) | Current; stays installable for longer |
| Catalog / on-disk format | Same as 18.6 within major 18 | Same as 18.4 |

Reasons, in order:
1. The product's only server-version contract is the major (C12, HOST-51 text "a host on another major version runs the product on an untested server"). HOST-51 is met by choice B with major 18 either way.
2. PostgreSQL's published policy is that minor releases carry fixes only, never a change of the internal storage format, and that users should run the current minor (https://www.postgresql.org/support/versioning/; cited from knowledge, **not fetched this session**; row 39 reads the page or the 18.5/18.6 release notes before the install and records them).
3. A pin that the publisher may prune turns a later re-install or rollback into a failure; 18.6 has the longer life in the index.
4. The residual risk (migrations and seed never ran on 18.6) is covered by row 44 itself: `db:migrate`, `db:seed` and `db:status` run on the pinned server before anything else uses it, and B-2/B-3 run at the first Core start.

Fallback: if row 39 finds 18.6 gone from the index, or the release notes of 18.5/18.6 name a change in behaviour this product depends on, install `18.4-1.pgdg24.04+1` with the same commands and record it in decisions.md. If neither pin is installable, stop (do not take whatever version apt offers).

`apt-mark hold` keeps a later `apt upgrade` from moving the server to an untested minor. A minor update later is a deliberate step: unhold, install, run `db:status`, restart the Core.

### 2.3 Signing key gate

Fingerprint from row 10: `B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8` (register 7.3), computed on the Mac, **hypothesis until checked with gpg on the host**. Gate at row 39: the gpg-reported fingerprint of the downloaded key equals this value AND equals the value from one independent source read over a separate channel (for example the key on `keyserver.ubuntu.com` searched by `0xACCC4CF8`; which source was used is recorded). Any mismatch, or no independent source found: stop and ask the user; do not add the source.

## 3. HOST-52 / HOST-53: cluster, port, listen address, socket, data directory

### 3.1 Choices

| Setting | Value | Reason | Alternative rejected |
|---|---|---|---|
| Cluster | version 18, name `main`, created by hand with `pg_createcluster` after automatic creation is switched off | The package would otherwise create `18/main` on 5432 and `localhost` at install time (postgresql-common default; **hypothesis**, confirmed at row 39 with `pg_lsclusters`), which would listen briefly on a port the code refuses | Let the package create it and edit after: possible, fallback below |
| Port | `4432` | register 5.4 (W2): 5432 refused by `FOREIGN_DATABASE_PORT`; 4432 is the project's value in every other form | - |
| `listen_addresses` | `'127.0.0.1'` | HOST-53; code requires host literal `127.0.0.1` (C3). No `::1` | `localhost` (would add `::1`) |
| Unix socket | **kept** in the package's socket directory `<REQ:pg_socket_dir>` (proposal `/var/run/postgresql`), `unix_socket_permissions = 0700`, and in `pg_hba.conf` only `local all postgres peer` | The dev cluster turned the socket off (`unix_socket_directories = ''`, scripts/pg/init.mjs:72) because its admin role had a password file. On .73 the server's own superuser `postgres` creates the roles (register 8) and has no password; peer authentication over the socket is the only way to reach it without creating and storing a third secret. With mode 0700 on the socket and `peer` limited to `postgres`, no other OS account can use it | Socket off: needs a superuser password (a third secret to generate, store and protect). Recorded as deviation from the dev form for row 78 |
| Server data directory | `/var/lib/postgresql/18/main` (register 7.3), owner `postgres`, mode 0700 | HOST-52 requires it outside `<install-dir>`. .73 has one ext4 file system, so "on the evidence disk beside `<data-dir>`" gives no separation (register 1.1, HOST-07). The package default is used | `/opt/dems/pgdata`: no gain on one disk, a new name, and a non-default path for `pg_createcluster` |
| Encoding / locale of the cluster | `UTF8`, `C.UTF-8` | `dems_demo` is created from `template0` with `UTF8` and locale `C` by `db:create` (C8), so the cluster locale does not reach the project database; `UTF8` keeps `postgres` consistent | - |
| Authentication | `password_encryption = scram-sha-256` (the 18 default); every TCP line `scram-sha-256` | Dev rule HA-1 (scripts/pg/check-hba.mjs:6) for TCP lines | `md5`, `trust`: refused |
| Server log | `log_error_verbosity = terse` | Carried from the dev cluster's security ruling 14 (scripts/pg/init.mjs:73-74): a failed statement leaves no DETAIL line with row or key values. What is logged stays at the defaults (no statement logging). The Debian log file and logrotate stay as packaged (`<REQ:pg_log_file>`, proposal `/var/log/postgresql/postgresql-18-main.log`) | The dev 24-hourly-file ring: not needed with logrotate; recorded as a difference |
| `ssl` | left as packaged | Clients connect with TLS off over loopback (owner-connection.ts:46-48); not used either way | - |

### 3.2 `pg_hba.conf` (whole file, replaces the packaged one)

```
# DEMS bench .73 (row 13 spec). Loopback TCP with scram only; the socket for the server account only.
local   all         postgres                          peer
host    postgres    dems_owner             127.0.0.1/32  scram-sha-256
host    dems_demo   dems_owner,dems_app    127.0.0.1/32  scram-sha-256
```

Why these lines: `db:*` uses `postgres` and the target as `dems_owner` (C4); the Core uses `dems_demo` as `dems_app` (port 4420 maps to `dems_demo`, research/01_explore_database_commands.md:55); `operator:set-password` uses `--database dems_demo` as `dems_app` (research/01_explore_database_commands.md:41-47). No `replication` line, no `::1`, no lane database (not used on the bench). If the Core is found to open a session to another database, its start fails with a `pg_hba` refusal in its journal, which is the intended loud failure; the line is then added on a recorded decision.

Owner and mode as packaged (`postgres:postgres`, 0640; **hypothesis**, row 40 records `stat`).

## 4. HOST-54: roles, grants, settings files

### 4.1 Roles

| Role | Attributes | Password at creation | Grants given here |
|---|---|---|---|
| `dems_owner` | `LOGIN NOSUPERUSER CREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS` (C10) | `NULL` (cannot log in until an owner run opens it, 4.3) | none. It owns `dems_demo` through `db:create` (C8) and every object through `db:migrate` |
| `dems_app` | `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS` (C10) | set once by the app block of 4.4 (verifier only) | none. Schema, table, column and function grants come from the migrations (C9); `CONNECT` on `dems_demo` comes from the default `PUBLIC` privilege, and `pg_hba.conf` limits who reaches it |

No other role. The Docker-era `dems_admin` is not created (register 8). The superuser `postgres` is used only over the socket, only for `CREATE ROLE` / `ALTER ROLE ... PASSWORD`, and never by any DEMS program.

### 4.2 The two settings files

| File | Owner:group | Mode | Keys (names; values per register 3.2) | Lifetime |
|---|---|---|---|---|
| `/opt/dems/core/.data/pg.env` | `dems-core:dems-core` | 0600 | `DEMS_PG_HOST`=`127.0.0.1`, `DEMS_PG_PORT`=`4432`, `DEMS_PG_DATABASE`=`dems_demo`, `DEMS_PG_APP_ROLE`=`dems_app`, `DEMS_PG_APP_PASSWORD`=SECRET | **Persistent**. The Core reads it at every start (C16) |
| `/opt/dems/core/.data/pg.owner.env` | `dems-core:dems-core` | 0600 | `DEMS_PG_HOST`=`127.0.0.1`, `DEMS_PG_PORT`=`4432`, `DEMS_PG_DATABASE`=`dems_demo`, `DEMS_PG_OWNER_ROLE`=`dems_owner`, `DEMS_PG_OWNER_PASSWORD`=SECRET | **Exists only while an owner run (4.3) is in progress** (decision below) |

Both live in the data dir because the code reads them nowhere else (C2, C6, C16). The data dir is `dems-core:dems-core` 0700 (register 3.1), so the `db:*` commands must run as `dems-core`, and so must `operator:set-password` (owner of `pg.env` must equal the caller, research/01_explore_cli_invocation.md §3).

Note on `DEMS_PG_DATABASE` in the owner file: the register gives `dems_demo`; the dev script writes the maintenance database `postgres` there (scripts/pg/init.mjs:156). Both pass, the code requires only a non-empty value and does not use it as the target (C4). The register value is kept.

### 4.3 Decision: `pg.owner.env` lifetime (gap W3, register G6)

**Decided: the owner file exists only during an owner run, and between runs the owner role has no password (`PASSWORD NULL`), so it cannot log in at all.** Each owner run generates a fresh owner secret.

| Option | Exposure between runs | Cost |
|---|---|---|
| (a) Kept on disk, 0600 `dems-core` | The running Core's account can read the owner secret. A compromise of the Core process then reaches the owner of every table and of the two `SECURITY DEFINER` functions (owner-connection.ts:242-244), which defeats the two-role split of HOST-54 | none |
| (b) Removed after each run, secret kept in a root-only file elsewhere | Root-only copy; a new name and a second secret store | a new path; rotation still manual |
| **(c) Removed after each run, owner login closed (`PASSWORD NULL`), fresh secret per run** | No owner secret anywhere between runs; a leaked old file or disk block holds a dead secret | one root block per owner run (4.4), run by the agent (D3, OI-4 B) |

Docker precedent for "present only while a db command runs": the `tools` service writes the owner file and removes it when the command ends (deploy/docker/README.md:113). Option (c) adds closing the login, which Docker could not do because its owner secret was a stored Docker secret.

Removal is `rm -f`, not `shred`: on ext4 with a journal `shred` gives no guarantee, and the secret is dead once `PASSWORD NULL` is set, which the block does in the same trap.

### 4.4 Secret flow, OI-4 option B (D8): generated straight into the targets, never printed

Rule: the agent generates each secret inside one process that writes it to exactly two targets, the settings file (clear value, the file is pre-created 0600 `dems-core`) and the server (as a SCRAM verifier, C11). The secret is never an argument (`ps`), never on a terminal, never in a doc, transcript or shell variable of the agent's own session. Both blocks are sent as one `sudo bash -s` here-document over SSH, so the agent's side holds only the script text.

Prerequisites: the pinned Node at `/opt/dems/node-26.12.1/bin/node` (register 7.1) and the tree at `/opt/dems/core` with `scripts/pg/db.mjs` (row 121 transfers `scripts/`; 02_structured.md:289). Dry check, prints `function`: `/opt/dems/node-26.12.1/bin/node --input-type=module -e "import('/opt/dems/core/scripts/pg/db.mjs').then(m=>console.log(typeof m.scramVerifier))"`.

The generator (G), used by both blocks. Arguments: the file and `owner` or `app` (no secret in them). It appends the five lines to the file and writes one `ALTER ROLE` statement carrying only the verifier to stdout:

```
G='import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";
import { scramVerifier } from "/opt/dems/core/scripts/pg/db.mjs";
const [file, kind] = process.argv.slice(1);
const role = kind === "owner" ? "dems_owner" : "dems_app";
const k = kind === "owner" ? "OWNER" : "APP";
const secret = randomBytes(32).toString("base64url");
appendFileSync(file, `DEMS_PG_HOST=127.0.0.1\nDEMS_PG_PORT=4432\nDEMS_PG_DATABASE=dems_demo\nDEMS_PG_${k}_ROLE=${role}\nDEMS_PG_${k}_PASSWORD=${secret}\n`);
process.stdout.write(`ALTER ROLE ${role} PASSWORD \x27${scramVerifier(secret)}\x27;\n`);'
```

`base64url` gives `[A-Za-z0-9_-]`, which the `KEY=(.*)` parser takes as is (owner-connection.ts:136). The verifier holds no quote character (db.mjs:37).

**Block R (row 41, once): roles and the runtime file.**

```
set -euo pipefail
umask 077
PSQL='sudo -u postgres -- psql -X -q -v ON_ERROR_STOP=1 -p 4432 -d postgres'
NODE=/opt/dems/node-26.12.1/bin/node
APP_FILE=/opt/dems/core/.data/pg.env
G='...as above...'
test ! -e "$APP_FILE"
printf '%s\n' \
  'CREATE ROLE dems_owner LOGIN NOSUPERUSER CREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD NULL;' \
  'CREATE ROLE dems_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD NULL;' | $PSQL
install -m 0600 -o dems-core -g dems-core /dev/null "$APP_FILE"
trap 'rm -f -- "$APP_FILE"' ERR
"$NODE" --input-type=module -e "$G" "$APP_FILE" app </dev/null | $PSQL >/dev/null
trap - ERR
```

**Block O (rows 44 and every later schema change): one owner run.** `STEPS` lists the entry files to run, in order.

```
set -euo pipefail
umask 077
PSQL='sudo -u postgres -- psql -X -q -v ON_ERROR_STOP=1 -p 4432 -d postgres'
NODE=/opt/dems/node-26.12.1/bin/node
TSX=/opt/dems/core/node_modules/tsx/dist/cli.mjs
OWNER_FILE=/opt/dems/core/.data/pg.owner.env
STEPS='src/db/commands/create.ts src/db/commands/migrate.ts src/db/seed/cli.ts src/db/commands/status.ts'
G='...as above...'
close() { rm -f -- "$OWNER_FILE"; printf 'ALTER ROLE dems_owner PASSWORD NULL;\n' | $PSQL >/dev/null; }
test ! -e "$OWNER_FILE"
trap close EXIT
install -m 0600 -o dems-core -g dems-core /dev/null "$OWNER_FILE"
"$NODE" --input-type=module -e "$G" "$OWNER_FILE" owner </dev/null | $PSQL >/dev/null
cd /opt/dems/core/apps/core-server
for step in $STEPS; do
  echo "== $step"
  sudo -u dems-core -- "$NODE" "$TSX" "$step" --database dems_demo </dev/null
done
```

Notes on the blocks:
- `</dev/null` on every child: the block itself arrives on stdin, and a child that reads stdin would eat the rest of the script.
- The `db:*` lines are the package.json script entries (`tsx src/db/commands/create.ts` etc., research/01_explore_database_commands.md:9-14) written in the direct-tsx form of the service spec 7.2 (absolute Node + `tsx/dist/cli.mjs`, cwd `apps/core-server`), so no npm cache or `HOME` is needed. The `npm run db:* -- --database dems_demo` form of HOST-55 is equivalent and needs `<REQ:cli_cache_dir>` (service spec 7.3).
- A failing step stops the loop (`set -e`), and the `EXIT` trap still removes the file and closes the owner login.
- For a later upgrade, `STEPS='src/db/commands/migrate.ts src/db/commands/status.ts'` with the Core stopped.
- Rotation of the runtime secret: Core stopped, `rm -f /opt/dems/core/.data/pg.env`, then the last three lines of Block R, then start the Core.
- The agent runs both blocks (D3; OI-4 option B). They contain no password the user must type; the user's terminal is not needed (OI-1 concerns operator passwords only).

## 5. HOST-55: create, migrate, seed, status of `dems_demo`

Invocation: Block O with the default `STEPS`, as `dems-core`, `--database dems_demo`, with the Core stopped (it does not run yet at row 44).

Migration count to expect, `<DEP:row91:migrations>`:
- Today's tree: **34** files, `0000_prelude.sql` .. `0033_capture_device_retirement_privileges.sql`, version row schema **15**, contract **`dbc-16`** (C14).
- Default if row 91 adds a schema object (R-FLEX register DB-M1..DB-M4): **36** files, adding `0034_audio_input_binding.sql` and `0035_audio_input_binding_privileges.sql`, version row schema **16**, contract **`dbc-17`**.
- If row 91 decides that no database object changes (R-FLEX register :109): 34, schema 15, `dbc-16`.
- Row 95 resolves this placeholder. Row 44 does not depend on it at run time: its check compares against the deployed tree (below), not against a number typed here.

The seed takes the "named skip" for the v2 demo packages (C15) and prints a row count per table. Whether the bench goes into service on the seeded `dems_demo` or on a new database after acceptance is the profile's open item (HOST-55); see "For row 96".

## 6. HOST-56: the Core starts after the database server

The PostgreSQL server unit is `postgresql@18-main.service` (register 4; **hypothesis** for the instance name, confirmed at row 39 with `systemctl list-units 'postgresql@*'`). File G as specified by row 15 already carries `After=... postgresql@18-main.service` and `Wants=... postgresql@18-main.service` (masterplan/01_specs_service.md:93-94). This spec confirms those two lines and adds nothing to the unit.

Ordering of the install rows (for the controller; the B edges of the blueprint do not hold all of these today):
1. Row 39 (install) -> row 40 (cluster and config) -> row 41 (Block R) -> row 44 (Block O) -> first Core start (row 45).
2. Row 41 needs the pinned Node and the placed tree (the generator imports `scripts/pg/db.mjs`). Blueprint row 41 lists only `40:B, 14:C` (02_structured.md:209). **Recommend adding B edges from row 41 to the Node install row and to the tree placement row (26/27).**
3. Row 43 (unit file) should follow row 40, so that the unit named in `After=`/`Wants=` exists when `systemd-analyze verify` runs. Blueprint row 43 lists `42:B, 35:B, 23:B` (02_structured.md:211). **Recommend adding `40:B` to row 43.**

## 7. HOST-50..HOST-56: command and check

All commands run on .73 through the agent's SSH (driver_rules.md). No check prints a secret: only names, modes, booleans and counts.

| Item | Row | Command(s) | Check (expected result) |
|---|---|---|---|
| **HOST-50** source | 39 | Reachability: `curl -sfI https://apt.postgresql.org/pub/repos/apt/dists/noble-pgdg/Release`. Key: `sudo apt-get install -y curl ca-certificates gnupg`; `sudo install -d /usr/share/postgresql-common/pgdg`; `sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc`. Gate 2.3. Source: write `/etc/apt/sources.list.d/pgdg.sources` with the six lines of 02_collection_pgdg.md:29-36; `sudo apt-get update` | `gpg --show-keys --with-colons /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \| awk -F: '/^fpr/{print $10; exit}'` prints `B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8` and the independent source agrees (2.3). `apt-cache policy postgresql-18` lists `18.6-1.pgdg24.04+2` from `apt.postgresql.org` |
| **HOST-51** version | 39 | Switch off the automatic cluster: `sudo apt-get install -y postgresql-common` (PGDG's, it wins on version), then in `<REQ:pg_common_conf>` (proposal `/etc/postgresql-common/createcluster.conf`) set `create_main_cluster = false`. Then `sudo apt-get install -y postgresql-18=18.6-1.pgdg24.04+2 postgresql-client-18=18.6-1.pgdg24.04+2`; `sudo apt-mark hold postgresql-18 postgresql-client-18` | `dpkg-query -W -f='${Version}\n' postgresql-18` prints `18.6-1.pgdg24.04+2`; `apt-mark showhold` lists both packages; `pg_lsclusters` shows no cluster yet. After row 40: `sudo -u postgres psql -X -At -p 4432 -c 'SHOW server_version'` starts with `18.6`, recorded in the acceptance header |
| **HOST-52** data dir | 40 | `sudo pg_createcluster 18 main --port 4432 --encoding UTF8 --locale C.UTF-8 -- --auth-local=peer --auth-host=scram-sha-256` | `pg_lsclusters` shows `18 main 4432 down postgres /var/lib/postgresql/18/main`; `sudo stat -c '%U %a' /var/lib/postgresql/18/main` prints `postgres 700`; the path does not start with `/opt/dems/core` |
| **HOST-53** listen, port, socket | 40 | Before start: `sudo ss -H -ltn 'sport = :4432'` empty. `sudo pg_conftool 18 main set listen_addresses 127.0.0.1`; `sudo pg_conftool 18 main set unix_socket_permissions 0700`; `sudo pg_conftool 18 main set log_error_verbosity terse`; replace `<REQ:pg_conf_dir>/pg_hba.conf` (proposal `/etc/postgresql/18/main/pg_hba.conf`) with 3.2 keeping owner and mode; `sudo systemctl start postgresql@18-main.service` | `sudo ss -H -ltn 'sport = :4432'` shows exactly one line, local `127.0.0.1:4432`; `sudo ss -H -ltn 'sport = :5432'` empty; `sudo stat -c '%U %a' <REQ:pg_socket_dir>/.s.PGSQL.4432` prints `postgres 700`; `sudo -u postgres psql -X -At -p 4432 -c 'SHOW listen_addresses'` prints `127.0.0.1`; `sudo grep -v -E '^\s*(#\|$)' <REQ:pg_conf_dir>/pg_hba.conf` equals 3.2; `sudo ufw status \| grep -c 4432` prints `0` |
| **HOST-54** roles and files | 41 | Block R (4.4) | `sudo -u postgres psql -X -At -p 4432 -d postgres -c "SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolcanlogin, rolpassword IS NULL FROM pg_authid WHERE rolname IN ('dems_app','dems_owner') ORDER BY 1"` prints `dems_app\|f\|f\|f\|f\|f\|t\|f` and `dems_owner\|f\|t\|f\|f\|f\|t\|t`. `sudo stat -c '%U %G %a' /opt/dems/core/.data/pg.env` prints `dems-core dems-core 600`; `sudo cut -d= -f1 /opt/dems/core/.data/pg.env` prints the five key names of 4.2; `sudo test ! -e /opt/dems/core/.data/pg.owner.env` exits 0. After row 44, in `dems_demo`: `SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tableowner <> 'dems_owner'` prints `0` (so `dems_app` owns no table). Transcript holds no secret (row 75 scan) |
| **HOST-55** dems_demo | 44 | Block O with the default `STEPS` | Each of the four steps exits 0 (the block reaches its end); `db:status` prints `OK: dems_demo is at the schema version this code expects and the ledger matches the files` (status.ts:231) and a schema version equal to `DB_SCHEMA_VERSION` in `/opt/dems/core/apps/core-server/src/db/schema/meta.ts` of the deployed tree; the ledger lines it prints number the entries of the deployed `src/db/migrations/meta/_journal.json` (count recorded; expected per section 5); the seed row counts are recorded. After the block: `sudo test ! -e /opt/dems/core/.data/pg.owner.env` exits 0 and `rolpassword IS NULL` for `dems_owner` is `t` |
| **HOST-56** ordering | 43 (unit), 71/128 (reboot) | Unit file G from row 15 with `After=`/`Wants=postgresql@18-main.service` | `systemctl show -p After -p Wants dems-core.service` contains `postgresql@18-main.service` in both; `systemctl is-enabled postgresql.service` prints `enabled` and `<REQ:pg_conf_dir>/start.conf` holds `auto`; after a host restart `systemctl is-active postgresql@18-main.service dems-core.service` prints `active` twice without a manual start, `systemd-analyze critical-chain dems-core.service` lists `postgresql@18-main.service` before it, and `journalctl -u dems-core.service -b --no-pager \| grep -c -i -E 'ECONNREFUSED\|could not connect\|pg_hba'` prints `0` |

Fallback for HOST-51/52 if the package created `18/main` anyway (createcluster.conf not honoured): before any role exists, `sudo pg_dropcluster --stop 18 main`, then the HOST-52 command. The fresh cluster holds nothing, so nothing is lost.

## 8. Alternatives considered (summary)

| Topic | Chosen | Rejected and why |
|---|---|---|
| Server source | PGDG (D8 A3) | Distribution package: major 16 per the profile author (untested major, HOST-51); embedded binaries: no Linux package (HOST-50 C) |
| Minor | 18.6, held | 18.4: tested minor but loses fixes and may be pruned (2.2) |
| Owner settings | ephemeral file + `PASSWORD NULL` between runs | kept on disk: the Core's account could act as owner (4.3) |
| Secret into the server | SCRAM verifier from the repo's `scramVerifier` | clear password in `ALTER ROLE` (reaches the statement text; C11); `\password` (needs a TTY and a person) |
| Admin access | `postgres` over the socket, peer | socket off + superuser password (third secret) |
| `db:*` form | direct tsx as `dems-core` | npm form: needs a cache dir (`<REQ:cli_cache_dir>`) |

## 9. Assumptions and gaps

| # | Item | Status | Closed at |
|---|---|---|---|
| A1 | Unit name `postgresql@18-main.service`, server account `postgres`, socket dir, config dir, log file follow postgresql-common conventions | hypothesis | row 39 (`pg_lsclusters`, `systemctl list-units 'postgresql@*'`, `ls` of the config dir) |
| A2 | `create_main_cluster = false` in createcluster.conf stops the automatic cluster | hypothesis (postgresql-common behaviour, not read on the host) | row 39 (`pg_lsclusters` empty after install); fallback in 7 |
| A3 | Content of the 18.5 and 18.6 release notes | not read | row 39, before the install (2.2 fallback rule) |
| A4 | Importing `scripts/pg/db.mjs` has no side effect beyond Node built-ins (lib.mjs imports only `node:*` modules, read this session) | read, not run | row 41 dry check (4.4) |
| A5 | The Core opens no session to a database other than `dems_demo` | read from config.ts:147-150 mapping; not run | first Core start (a `pg_hba` refusal would be loud) |
| A6 | The independent source for the key fingerprint | not chosen yet | row 39 records it |
| A7 | `pg_conftool ... set` writes into `postgresql.conf` of `18/main` | hypothesis (postgresql-common tool) | row 40 (`SHOW` checks in 7) |

## For row 96

| # | Question | Options | Recommendation | Consequence |
|---|---|---|---|---|
| 96-R13-1 | HOST-55 open item: does the bench go into service on the seeded `dems_demo` or on a fresh database after acceptance | keep `dems_demo` / reset to a fresh database after acceptance | keep `dems_demo` for the bench (D1: .73 stays the bench) | a fresh database later is one Block O run with `db:reset` rules of the code, outside this spec |
| 96-R13-2 | Notice only (decided here under U-RF10 and W3, the user may overrule): PostgreSQL 18.6 held; owner settings ephemeral with the owner login closed between runs | as decided / 18.4 / owner file kept | as decided | overruling either changes only rows 39 and 41/44 |

## 10. Notes for the controller

- Blueprint edges (6): add Node install and tree placement as B edges of row 41; add `40:B` to row 43.
- Row 41's verification text "settings files exist with spec mode" (02_structured.md:209) must read: `pg.env` exists `dems-core dems-core 600`, `pg.owner.env` is absent (4.3).
- Deviation for row 78: unix socket kept with `peer` for `postgres` only (dev form had none); server log via packaged logrotate rather than the dev hourly ring.
- HOST-54 text "runtime settings reach the Core through `/etc/dems/core.env`" is wrong for this code (C16); already recorded for row 11 (register 3.2).

## 11. Placeholders for row 95

| Placeholder | Default used | Resolves from |
|---|---|---|
| `<DEP:row91:migrations>` | 36 files (0034, 0035 added), schema 16 / `dbc-17` if row 91 adds a DB object; else 34 files, schema 15 / `dbc-16` | masterplan/01_specs_rflex_database.md (row 91) |
| `<REQ:pg_socket_dir>` | `/var/run/postgresql` | register (request filed) |
| `<REQ:pg_conf_dir>` | `/etc/postgresql/18/main` | register (request filed) |
| `<REQ:pg_common_conf>` | `/etc/postgresql-common/createcluster.conf` | register (request filed) |
| `<REQ:pg_log_file>` | `/var/log/postgresql/postgresql-18-main.log` | register (request filed) |
| `<REQ:cli_cache_dir>` | only for the npm form; filed by row 15 | register |

---
*Generated: 2026-10-22*
*Last Updated: 2026-10-22*
