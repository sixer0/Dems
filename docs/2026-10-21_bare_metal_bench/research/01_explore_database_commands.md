---
task_id: 2026-10-21_bare_metal_bench
date: 2026-10-22
agent: explore
scope: Q4 - how db:create/migrate/seed/status and operator:set-password obtain PostgreSQL connection settings and which role they use (read-only, code only)
tier: 2
---

# Q4: database commands, connection settings and roles

Method: direct file reads (no graft query; paths known from package.json). All paths below are under `/Users/gsp-budi/Documents/DEMS`. No secret value was read or copied; only key, file and role NAMES appear.

## 1. Scripts and entry files
| Script | Runs | Source |
|---|---|---|
| db:create | `tsx src/db/commands/create.ts` | apps/core-server/package.json:16 |
| db:migrate | `tsx src/db/commands/migrate.ts` | package.json:17 |
| db:seed | `tsx src/db/seed/cli.ts` | package.json:18 |
| db:status | `tsx src/db/commands/status.ts` | package.json:20 |
| operator:set-password | `tsx cli/operator-set.ts` | package.json:27 |
Root package.json:41-45 forwards `db:*` to `-w @dems/core-server --`. (db:reset, package.json:19, is out of scope.)

## 2. db:create, db:migrate, db:seed, db:status: owner role, owner file
All four go through `runCommand` (apps/core-server/src/db/commands/cli.ts:114). Seed uses it too (src/db/seed/cli.ts:69).

- **Role: `dems_owner`** (OWNER_ROLE, owner-connection.ts:28). Not a superuser; the session is verified after connect and refused otherwise (`verifyOwnerSession`, owner-connection.ts:246-266). The runtime role `dems_app` (APP_ROLE = RUNTIME_ROLE, owner-connection.ts:30; config.ts:134) is only checked for existence (`assertProjectRoles`, owner-connection.ts:272-284), used by create and migrate (create.ts:52, migrate.ts:~28). No db command creates a role; missing roles point to `npm run pg:init`.
- **Settings source: one file, `<data dir>/pg.owner.env`** (OWNER_FILE_NAME, owner-connection.ts:32), read by `readOwnerConnection` (owner-connection.ts:122-179) via cli.ts:126. Mode must be 0600 (owner-connection.ts:99-116).
- **Keys (five, closed, exact):** `DEMS_PG_HOST`, `DEMS_PG_PORT`, `DEMS_PG_DATABASE`, `DEMS_PG_OWNER_ROLE`, `DEMS_PG_OWNER_PASSWORD` (owner-connection.ts:34-40). Unknown, duplicate or empty keys are refused (owner-connection.ts:134-152).
- **Validation:** `DEMS_PG_OWNER_ROLE` must equal `dems_owner` (156-161); host must equal `127.0.0.1` (DATABASE_HOST, config.ts:126; check owner-connection.ts:162-165); port numeric 1-65535 and not 5432 (FOREIGN_DATABASE_PORT, config.ts:132; check owner-connection.ts:166-176). No default for host or port.
- **Data dir:** default `DEFAULT_DATA_DIR` = `<repo root>/.data`, computed five levels above `src/plugins/config/` (load-config.ts:53-61), imported at owner-connection.ts:25 and used at :122. `CommandOptions.dataDir` exists (cli.ts:41) but is a test seam; no CLI flag or env var sets it (cli.ts:188-191 passes only argv).
- **Env and flags:** no secret from env or argument (cli.ts:13-14). `main()` calls `scrubDriverEnvironment`, which deletes every env var starting with `PG` before any client exists (cli.ts:188-189; owner-connection.ts:93-97). So PGHOST/PGPORT/PGUSER/PGPASSWORD have no effect. The only flag is `--database <name>` or `--database=<name>`, exactly once, required (cli.ts:58-78).
- **Which database the owner connects to:** the file's `DEMS_PG_DATABASE` is not the target; target comes from `--database` (owner-connection.ts:119-121 comment; cli.ts:123). Maintenance connections use database `postgres` (MAINTENANCE_DATABASE, owner-connection.ts:42; cli.ts:149); target-database work uses `withPool(target)` (cli.ts:128-141).
- **Per command:**
  - db:create: maintenance DB, `CREATE DATABASE <name> OWNER dems_owner TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C'` (create.ts:9-10, 50-59).
  - db:migrate: maintenance DB for role/owner check, then target DB (migrate.ts:28-66).
  - db:seed: maintenance DB for facts, then target DB (seed/cli.ts:69-93). Also reads process env NAMES to decide demo packages (seed/cli.ts:100, `environment ?? process.env`), unrelated to connection.
  - db:status: maintenance + target via same context (status.ts:219-227).
- Connection options: TLS off, pool max 2, 5 s timeout, application_name `dems-db-command` (owner-connection.ts:46-48, 186-197).

## 3. operator:set-password: runtime role, runtime file
Entry cli/operator-set.ts; logic cli/operator-set-password-command.ts.
- **Role: `dems_app`** (RUNTIME_ROLE). Pool = `createRuntimePool` (operator-set.ts:66; src/plugins/db/index.ts:136-147). Session role is checked: must be RUNTIME_ROLE, not superuser, on the named database (operator-set-password-command.ts:401-403).
- **Settings source: `<--data-dir>/pg.env`** (CONNECTION_FILE_NAME, config.ts:137; path built at operator-set-password-command.ts:170-173, 374). Read with the server's own `readConnectionFile` (src/plugins/config/connection-file.ts:52-94; imported at command:89). File entry checked as private regular file of the calling uid (command:176, 375).
- **Keys (five):** `DEMS_PG_HOST`, `DEMS_PG_PORT`, `DEMS_PG_DATABASE`, `DEMS_PG_APP_ROLE`, `DEMS_PG_APP_PASSWORD` (config.ts:139-145). Role must be `dems_app`, host `127.0.0.1`, port numeric (command:380-382). The file's `DEMS_PG_DATABASE` is ignored; the connection is built with `database: args.database`, host forced to the constant, port from the file (command:383).
- **Flags (all required, no default):** `--database <name>`, `--data-dir <absolute dir>`, and one of `--username <u>` | `--all-demo` (command:282-284, 295-315). `--database` is validated only by regex `^[a-z_][a-z0-9_]{0,62}$` (command:290, 308), NOT against the closed list below.
- **Env:** no password through env: any env var matching `PASSWORD_VARIABLE_NAME` refuses the run (command:190, 366-368); stdin must be a TTY (command:369). PG* variables are not scrubbed in this entry (operator-set.ts has no scrub call; the pool options set host/port/database/user/password explicitly, plugins/db/index.ts:137-147, but fields not set, e.g. sslmode, would fall to driver env: HYPOTHESIS, not tested).
- Preconditions: schema current (run db:migrate first, command:413), Core for that database stopped (no other connections, command:423).

## 4. Closed list of database names
`PROJECT_DATABASES = ['dems_demo', 'dems_lane_1', 'dems_lane_2', 'dems_lane_3']`, defined at `apps/core-server/src/db/commands/database-names.ts:18`. `guardTargetDatabase` (database-names.ts:35-53) refuses anything else with exit 2 before any file read or connection (cli.ts:122-125). Test-only extension: `dems_test_*` via `allowTestDatabase`, never set by a CLI entry (database-names.ts:10-13, 22). Usage text prints the list (cli.ts:54). The Core maps listen port to name: 4420 -> `dems_demo`, 442k -> `dems_lane_k` (config.ts:147-150), and takes its database from that, not from `pg.env` (load-config.ts:9-10, 128).

## 5. How the running Core gets its settings (context)
`loadConfig({ env: process.env })` (src/index.ts:58) reads only `<DEFAULT_DATA_DIR>/pg.env` (load-config.ts:105-107) with role `dems_app` (109-114). Its env inputs are named at load-config.ts:75-103 and include none for database host, port, user or password.

## 6. Provisioning side (who writes the files)
- scripts/pg (dev, macOS embedded Postgres): `pg:init` writes `.data/pg.pwfile`, `.data/pg.owner.env`, `.data/pg.env` (scripts/pg/init.test.mjs:38, 50); fixed endpoint 127.0.0.1:4432 (scripts/pg/lib.test.mjs:42-65). package.json:47-52.
- scripts/host/95-database.sh: print-only proposal, no apply mode (95-database.sh:3, 10-11; HP_APPLY_SUPPORTED=0 at :14). DB-05 says two roles are created by the user and "the runtime settings reach the Core through /etc/dems/core.env (HOST-34)" and leaves "where the owner settings live on a root-owned tree" OPEN (:73-78). DB-06 runs `npm run db:create|migrate|seed -- --database dems_demo` "with the owner settings of DB-05" (:86-89); DB-06 check `db:status` (:96). DB-04 leaves the port OPEN (dev 4432, distro 5432) (:64).
- Docker: tools service writes `pg.owner.env` into the data volume from the owner secret for a `db:*` command and removes it afterwards; data dir fixed at `/opt/dems/core/.data` (deploy/docker/README.md:49, 105-106, 113).

## 7. Findings that matter for a bare-metal bench (verified against code)
1. **Mismatch with host profile.** HOST-34 (scripts/host/HOST-PROFILE-UBUNTU-24.04.md:111) and DB-05 say the database settings go in `/etc/dems/core.env`. The code has no env input for them: the Core reads `pg.env` in the data dir only (load-config.ts:105-107; env keys at :75-103). PG* env vars are even deleted by the db commands. A bare-metal install must put `pg.env` (and `pg.owner.env` for db:* commands) in `.data` of the product tree (`<repo>/.data`, DEFAULT_DATA_DIR, derived from the source file location, not configurable by env), i.e. inside the install tree that HOST-05 makes root-owned (95-database.sh:34). Hence the OPEN item at 95-database.sh:77.
2. **Port 5432 is refused** by Core, db commands and (via the same reader) operator:set-password; Ubuntu's apt package defaults to 5432 (DB-04, :64), so the server must be reconfigured to another port (dev uses 4432).
3. **Host must be literally `127.0.0.1`**; `localhost` is refused (owner-connection.ts:162-165; config.ts:380).
4. `db:*` commands are run from the repo with `tsx` (package.json:16-20), so the install needs the workspace dev dependencies on the host (HYPOTHESIS about packaging, not verified here).
5. operator:set-password uses the runtime role and `<--data-dir>/pg.env`; db:* uses the owner role and the fixed `<repo>/.data/pg.owner.env`. Two different directories may be in play if `--data-dir` is not the repo `.data`.

## Unknowns
- Whether `pg.owner.env` provisioning for Ubuntu exists anywhere beyond Docker `tools` and macOS `pg:init` (none found in scripts/host; deploy/installer not read in depth, only grep hits for secrets names at deploy/docker/installer/install.sh:103).
- scripts/pg/*.mjs internals were not read beyond test assertions and headers.
- PG* env leak in operator:set-password (see 3) untested.

*Generated: 2026-10-22*
