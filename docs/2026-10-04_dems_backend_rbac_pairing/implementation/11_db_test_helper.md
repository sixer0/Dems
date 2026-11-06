---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
blueprint_row: 33
plan_row: W11
title: Template-clone test helper (HB-12) and the global setup of the Vitest project db
date: 2026-10-04
agent: database-specialist (tier R)
source_plan: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
evidence_tier: 3
status: complete
---

# W11: template-clone test helper and the global setup of the project `db`

All times are WIB (UTC+7) on 2026-10-04. Every command ran from `/Users/gsp-budi/Documents/DEMS`;
no command changed into a subfolder. Quoted runner output is unchanged except for what is marked
where it occurs: the reporter's pass mark is written as `[pass]`, the common path prefix
`|db| test/helpers/db/__tests__/` of test names is left out, stack frames are cut, and a few
blocks are shortened with a note in parentheses. **No password or other credential value appears
in this document**: only file names, key names, role names, database names, counts and times.

## 1. Result

| Item | Result |
|---|---|
| Row command `npm run test:db -w @dems/core-server -- test/helpers/db` | **Exit 0**: 10 files, 52 tests, 0 failed (08:33:42, section 8.1) |
| Two test files, two clones, each sees only its own row (T-TI-1) | Pass (section 8.2) |
| No database with the run prefix remains | Pass: after the runs `pg_database` holds `postgres`, `template0`, `template1` and nothing else (section 8.3) |
| A request to drop `dems_demo`, or a younger database of another run, is refused before a statement is sent (T-TI-2) | Pass: refused with the session's statement count unchanged, against the real server and on a stand-in (section 8.4) |
| `pg_database.datdba` is `dems_owner` for templates and clones (T-TI-3) | Pass (section 8.5) |
| First measured clone time | **26 to 35 ms** for the first clone; **27 to 40 ms** median of 15 (four measurements, section 9) |
| PostgreSQL unreachable | The run **fails, exit 1**, with a message that names `npm run pg:start`; no test runs, none is reported as passed or skipped. Proven with the probe pointed at a closed loopback port; the server was not stopped (section 8.6) |
| `npm run test -w @dems/core-server -- --maxWorkers=2` (project `unit`) | Exit 0 inside the command sandbox, where no connection to PostgreSQL is possible: 24 files, 526 tests (section 8.7) |
| Typecheck and lint of `@dems/core-server` | Exit 0 and exit 0, no error, no warning (section 8.8) |
| Root `npm run typecheck` | **Exit 2 in three runs, each time in files of other rows that are in flight** (`@dems/shared`, `@dems/core-web`); no error in this row's workspace (section 8.8, P11) |
| Several `test:db` runs at the same time | 18 of 18 runs pass (four at a time in three rounds, three at a time in two rounds; two of them with the same label each time); names never collide (section 8.9) |
| The PostgreSQL server | Never stopped, restarted or reconfigured: PID 19121, started 07:14:26, at the start of the row and at 08:34:54 |
| The other PostgreSQL of this host (`*:5432`, F27) | Never connected to. The helper refuses that port by name |
| Roles | The helper, the templates and the clones: `dems_owner`. The code under test: `dems_app`. Nothing connects as `dems_admin` |
| `vitest.config.ts`, any `package.json` | Not edited; the configuration needed no change |

## 2. What was written

`apps/core-server/test/global-setup.db.ts` and 45 files under
`apps/core-server/test/helpers/db/` (46 files, 6,257 lines). Nothing else was written outside the
task folder.

| File | Purpose |
|---|---|
| `test/global-setup.db.ts` | The path `vitest.config.ts` names (D27). Calls `setupDbTestProject` and returns its teardown |
| `helpers/db/index.ts` | **The API for test files**: `useTestDatabase`, `withTestDatabase`, `providedRun`, the types |
| `helpers/db/hooks.ts` | **The plug-in points**: `TemplateHook`, the three hook module paths, the resolvers |
| `helpers/db/global-setup.ts` | The core of the global setup: probe, credentials, roles, run prefix, sweep, templates, `provide`, teardown |
| `helpers/db/run.ts` | `TestRun` (start, attach, templates, clones, sweep, teardown) and `TestDatabase` (pools, cleanup, drop) |
| `helpers/db/names.ts` | Pure: run label, stamp, prefix, database names, **the name guard**, the sweep classification |
| `helpers/db/ddl.ts` | The five statements that create, change or drop a database, each taking a guarded name; catalog reads; the advisory locks |
| `helpers/db/session.ts` | The one place that builds a client or a pool; the role check (superuser refusal) |
| `helpers/db/credentials.ts` | Reads `.data/pg.owner.env` and `.data/pg.env`: mode, keys, endpoint, role |
| `helpers/db/endpoint.ts` | The endpoint guard (`127.0.0.1:4432` only), the TCP probe, the "unreachable" message |
| `helpers/db/constants.ts`, `errors.ts`, `provided.ts` | Constants; error codes; the type of what is provided to the workers |
| `helpers/db/testing/` (5 files) | Test support: the injected one-table migration, seed and bulk stand-ins (`probe-hooks.ts`); a stand-in cluster behind the driver seam (`fake-cluster.ts`); the shared body of the two isolation files; private runs; a closed loopback port |
| `helpers/db/selfcheck/` (11 files) | A separate Vitest configuration and fixtures that `nested-run.db.test.ts` starts as child processes: test files that throw, an unreachable server, hook modules found by convention. Not part of `npm test` or `npm run test:db` (the files end in `.selfcheck.ts`) |
| `helpers/db/__tests__/*.test.ts` (7 files) | Database-free tests: project `unit`, so they run in every row's gate |
| `helpers/db/__tests__/*.db.test.ts` (10 files) | Tests against the real PostgreSQL: project `db` |

## 3. How another row uses it

A database test file is named `*.db.test.ts` (anywhere under `src/` or `test/`) or lies under
`test/acceptance/`. It runs through `test:db`, never through `npm test`.

```ts
import { useTestDatabase } from '../../../test/helpers/db';        // the relative path of the file
import { unitTestConfig } from '../../plugins/config/__tests__/test-config';

const db = useTestDatabase({ template: 'seed' });                  // top level of the file

it('...', async () => {
  const app = buildApp({ config: unitTestConfig({ database: db.runtime, dataDir: db.run.dataDir }) });
  db.onCleanup(() => app.close());                                 // closed before the drop
  const rows = await db.ownerPool().query('SELECT ...');           // fixtures and assertions only
});
```

```sh
DEMS_TEST_STEP=41 npm run test:db -w @dems/core-server -- --maxWorkers=2 src/modules/identity
```

The command needs the per-command sandbox bypass (D32). `DEMS_TEST_STEP` is 1 to 12 letters or
digits (`41`, `W17`, `w01b`); anything else stops the run with `RUN_LABEL_INVALID`. The example
above is written from the types; what was run is narrower: the server's own pool factory
`createRuntimePool(db.runtime)` (`src/plugins/db`) connects to a clone as `dems_app`
(`cleanup.db.test.ts`, "drop() closes the pools ..."). No app was built on a clone by this row.

| API (`test/helpers/db/index.ts`) | Meaning |
|---|---|
| `useTestDatabase({ template, slug? }): TestDatabaseHandle` | Registers `beforeAll` (clone) and `afterAll` (close, drop). `template` is `'schema'`, `'seed'`, `'bulk'`, or a private definition `{ key: 'x_<name>', base, build }` |
| `handle.name` | `dems_test_<label>_<stamp>_f<nn>_<slug>` |
| `handle.runtime` | `{ host, port, database, user, password: Secret }` for **`dems_app`** on the clone: what `createConfig` takes as `database` (`src/config.ts`) |
| `handle.appPool()` | A pool of `dems_app` on the clone, at most 5 connections (TI-14); closed by the helper |
| `handle.ownerPool()` | A pool of `dems_owner` on the clone, at most 2 connections, **for fixtures and assertions only** (TI-17) |
| `handle.onCleanup(fn)` | Closed before the drop, in reverse order of registration: the app under test, a pool the test built itself |
| `handle.another({ template?, slug? })` | Another untouched clone for one test (TI-8); dropped with the file, or earlier by `.drop()` |
| `handle.run` | The `TestRun`: `identity.prefix`, `dataDir`, `listDatabases()`, `sessionRoles()`, `templateTimings` |
| `handle.timings` | `{ lockWaitMs, cloneMs, window }` of the clone |
| `withTestDatabase(options, body)` | A clone for the duration of `body`; dropped also when `body` throws |
| `providedRun()` | What the global setup provided: label, stamp, prefix, start time, server version, the templates it built |

Recipes for the next rows:

| Need | How |
|---|---|
| An empty database to run the migrations on (W17: "migrate on an empty clone, then a second run that applies nothing") | `useTestDatabase({ template: { key: 'x_empty', base: 'empty', build: async () => {} } })`, then the migrator on `db.ownerPool()` |
| A scenario built once and cloned by several files of one row | A private template `{ key: 'x_<name>', base: 'seed', build }`. The key must be unique in the run: two files that pass different definitions under one key get the one that was built first |
| The reset routine on a test database (W29) | Its `<name>_next` and `<name>_prev` copies start with the run prefix, so the teardown of the run drops them |
| A statement as the runtime role | `db.appPool()`; as the owner role `db.ownerPool()` |
| A test of the file's own that waits for a lock | Do not call `db.run` while one of the file's own clones waits for the clone lock (finding F-10); read the catalog through `db.ownerPool()` |

## 4. Plug-in points for W17, W20 and W25

The helper knows how a template is created, locked, cloned and dropped; what goes into it is a
**`TemplateHook`**. Each owning row adds **one file in a folder it owns**. No file of this row is
edited. The paths are relative to `apps/core-server` and are pinned in `helpers/db/hooks.ts`
(`TEMPLATE_HOOK_MODULES`):

| Template | Built from | Hook module | Row | Built by |
|---|---|---|---|---|
| `tpl_schema` | the empty template of PostgreSQL, `ENCODING 'UTF8' LOCALE 'C'` | `test/db/template-hook.schema.ts` | W17 | The global setup, once per run |
| `tpl_seed` | a clone of `tpl_schema` | `src/db/seed/__tests__/template-hook.seed.ts` | W20 | The global setup, once per run |
| `tpl_bulk` | a clone of `tpl_seed` | `src/db/fixtures/__tests__/template-hook.bulk.ts` | W25 | The first test file that asks, under the clone lock |

```ts
// helpers/db/hooks.ts
export interface TemplateHookContext {
  readonly template: string;            // 'schema' | 'seed' | 'bulk' | 'x_<name>'
  readonly database: string;            // the template database being built: dems_test_..._tpl_...
  readonly pool: Pool;                  // role dems_owner on that database; closed by the helper
  readonly connection: DatabaseConnection;  // the same as five fields (password: Secret)
  readonly run: RunIdentity;            // { label, stamp, prefix }
}
export type TemplateHook = (context: TemplateHookContext) => Promise<void>;
```

```ts
// apps/core-server/test/db/template-hook.schema.ts (W17 writes this file)
import type { TemplateHook } from '../helpers/db/hooks';

export const templateHook: TemplateHook = async ({ pool }) => {
  await migrate(drizzle(pool), { migrationsFolder });
};
```

| Rule for a hook | Why |
|---|---|
| Export the function as `templateHook` (a default export is accepted too) | `conventionResolver` looks for these two |
| Import **only the type**, from `helpers/db/hooks`; import nothing of Vitest at run time | The schema and seed hooks are loaded by the global setup in Vitest's main process; `helpers/db/index.ts` imports Vitest, `hooks.ts` does not |
| Use `context.pool`; close whatever else it opens | A template must have no session when it is locked (TI-5). A session left open fails the build (`TEMPLATE_BUILD_FAILED`) and the half-built database is dropped |
| Do not call the helper back | The bulk hook runs under the clone lock |
| Keep the bulk hook short | While `tpl_bulk` is built, the clone lock is held: no other clone starts, in any run (deviation DV-3) |

While a hook module does not exist its template is "not available". The global setup prints
`template tpl_schema: not built, no hook is plugged in (row W17: test/db/template-hook.schema.ts)`,
and a test file that asks for it gets `TEMPLATE_NOT_AVAILABLE` with the file to add. The chain
stops at the first missing hook (`tpl_seed` needs `tpl_schema`).

Proof that the convention works with real files in a real Vitest run (section 8.6, last quote):
the self-check project `convention` has the three hook modules at these places inside a fixture
workspace (`helpers/db/selfcheck/convention-workspace/`); its global setup built `tpl_schema` and
`tpl_seed` from them in the main process, and its test file built `tpl_bulk` from the third in a
worker. The same code looks in `apps/core-server` in a normal run; only the root folder differs.

## 5. Naming scheme (TI-2)

```
run prefix   dems_test_<label>_<stamp>_
             <label>   step_<row>  when DEMS_TEST_STEP=<row> is set (lower case), else  local
             <stamp>   eight base-36 characters: the start time in seconds (six), two random
templates    <prefix>tpl_schema   <prefix>tpl_seed   <prefix>tpl_bulk
             <prefix>tpl_x_<name>      a private template (1 to 16 letters or digits)
test file    <prefix>f<nn>_<slug>      nn = lowest free counter 01 to 99; slug = the file's base
                                       name reduced to [a-z0-9_]; the whole name at most 63 bytes
```

Example, from the run of 08:34:53 with `DEMS_TEST_STEP=33`:

```
dems_test_step_33_tmd0e5n2_tpl_x_selftest      the helper's private one-table template
dems_test_step_33_tmd0e5n2_f01_isolation_b     test/helpers/db/__tests__/isolation-b.db.test.ts
dems_test_step_33_tmd0e5n2_f02_isolation_a     test/helpers/db/__tests__/isolation-a.db.test.ts
```

The first six characters of a stamp are the start second in base 36: `tmd008` of an earlier run
is 1791077192, which is 2026-10-04 08:26:32 WIB (checked with `parseInt('tmd008', 36)`). Without
`DEMS_TEST_STEP` the same run is `dems_test_local_<stamp>_...`. A long row label and a long file
name are cut: `dems_test_step_abcdefghijkl_<stamp>_f99_a_very_long_test_file` is 62 bytes
(`names.test.ts`).

## 6. What one run does

| Step | Where | What |
|---|---|---|
| 1 | main process, `global-setup.ts` | The row label is checked. One TCP connect to `127.0.0.1:4432`; if nothing answers the run fails (section 8.6). **The helper attaches to the running server; it starts and stops nothing** (deviation DV-1) |
| 2 | main | `.data/pg.owner.env` and `.data/pg.env` are read: mode, five keys, endpoint, role |
| 3 | main | One session of `dems_owner` on `postgres`. Its first statement asks who it is: a superuser, another role or another address closes the session and stops the run. One short session of `dems_app` on `postgres` checks the runtime role in the same way |
| 4 | main | A fresh stamp; the session takes the advisory lock `(442002, k)`, `k` derived from the stamp ("this run is alive"), and holds it until the run ends. If the lock is held or a database with the prefix exists, another stamp is drawn |
| 5 | main | Stale sweep (TI-12): `dems_test_*` databases of runs older than six hours whose liveness lock is free are dropped. Younger runs, live runs and names outside the scheme are left |
| 6 | main | `tpl_schema` and `tpl_seed` are built if their hooks exist: `CREATE DATABASE` under the clone lock `(442002, 0)`, the hook, wait for sessions to end, `ALTER DATABASE ... IS_TEMPLATE true ALLOW_CONNECTIONS false` |
| 7 | main | `provide('demsTestRun', { label, stamp, prefix, startedAt, serverVersion, templates })`: names and times only. No credential travels to a worker; each worker reads the files itself |
| 8 | worker, `beforeAll` | The file attaches to the run with its own `dems_owner` session, takes the clone lock, picks the lowest free counter, `CREATE DATABASE <name> TEMPLATE <tpl> OWNER dems_owner`, releases the lock |
| 9 | worker, `afterAll` | Closes what the test registered and the two pools, waits until no session of another role is left, `DROP DATABASE IF EXISTS <name> WITH (FORCE)`. Runs also when a test or a hook of the file throws |
| 10 | main, teardown | Drops every database with the run prefix, clones first, templates after `IS_TEMPLATE false`. If one remains the run fails with `CLEANUP_INCOMPLETE` and its name |

Lock keys of class 442002 on the maintenance database: `0` is the clone lock of TI-7; `1` to
`1073741823` are liveness locks (decision DN-3). Statements wait at most 120 s for a lock
(`lock_timeout` of the helper's session); a longer wait ends with `CLONE_LOCK_TIMEOUT`.

## 7. Guards, and the test that proves each

A statement that creates, changes or drops a database takes a `GuardedDatabaseName`. Only
`guardOwnDatabase` and `guardStaleDatabase` (`names.ts`) produce one, and both throw before a
statement exists. `unit` tests are database-free and run in every gate; `db` tests run against
the real server. Test files are in `apps/core-server/test/helpers/db/__tests__/`.

| Guard | Proven by |
|---|---|
| Every created or dropped name matches `^dems_test_[a-z0-9_]+$` and starts with the own run prefix | `names.test.ts` "passes the templates and the per-file databases of the run"; `run.test.ts` "clones get <prefix>f<nn>_<slug> ... and name the own run only" (every identifier in every recorded `CREATE`, `ALTER`, `DROP DATABASE`) |
| Refuses `dems_demo`, `dems_demo_next`, `dems_lane_*`, `postgres`, `template0`, `template1`, `dems_proof_*`, `dems_trial_*`, any other name, a value that is not a string, an injected name | `names.test.ts` (19 names, 6 actions each); `run.test.ts` "dropDatabase(...) is refused before a statement is sent" (14 names; the stand-in recorded no statement); `guards.db.test.ts` "dems_demo, the lanes, the maintenance database and the templates of PostgreSQL" |
| **Before any statement**: a refused request leaves the session's statement count unchanged | `guards.db.test.ts` (`refusedDrop`: count before equals count after, for every name); `run.test.ts` (the stand-in recorded no statement) |
| Refuses every database that really exists in the cluster and is not of the run | `guards.db.test.ts` "every database that exists in the cluster and is not of this run" |
| Refuses a younger database of another run; it stays untouched | `guards.db.test.ts` "a younger database of another run: refused, and it stays as it is" (a real second run; its clone, its locked template and its row are still there); `names.test.ts` "refuses a database of another run, younger or older" |
| No pool and no connection fields for a database outside the run (TI-17) | `run.test.ts` "no pool and no connection is handed out for ..." (14 names); `guards.db.test.ts` "a clone or a pool can only be asked for inside the own run" |
| The stale sweep removes only test databases older than six hours that belong to no live run | `sweep.db.test.ts` (three real runs: old and dead is dropped; old and alive is kept; young is kept; then the old one that ended is taken); `run.test.ts` "drops only databases of runs that are older than six hours and not alive"; `names.test.ts` (exactly six hours is not stale; a stamp from the future is not stale; a name outside the scheme is left) |
| A sweep never names a database outside the stale run | `run.test.ts` (every identifier in the recorded statements starts with the stale run's prefix) |
| Clones are serialised | `clone-lock.db.test.ts` "a clone waits while another session holds the clone lock" (`pg_locks`: one granted, at least one waiting), "six clones asked for at once, from two sessions, never overlap", "a wait longer than the lock timeout ends with CLONE_LOCK_TIMEOUT"; `run.test.ts` "every CREATE DATABASE runs between taking and releasing the clone lock" |
| A template has no session and takes none | `templates.db.test.ts` "a locked template accepts no connection, not even from its owner" (SQLSTATE 55000), "a hook that leaves a session open: the build fails (TI-5)" |
| A template is built once and reused; two files that ask at the same time build it once | `templates.db.test.ts` "a second request builds nothing", "two test files that ask at the same time build the template once" |
| Cleanup runs even when a test file throws | `nested-run.db.test.ts` "test files that throw" (a whole Vitest run: one file whose test throws with open pools, one whose `beforeAll` throws; exit 1; no database remains); `cleanup.db.test.ts` "a body that throws" |
| The teardown removes what a crashed worker left | `cleanup.db.test.ts` "the teardown removes what a crashed worker left"; `templates.db.test.ts` "drops the clones and the locked templates" |
| The helper closes its pools and waits before a drop; a leaked `dems_app` session is not force-dropped (D32, T5-h) | `cleanup.db.test.ts` "drop() closes the pools ...", "a leaked session of the runtime role: the drop fails with SESSIONS_REMAIN and sends no DROP", "a leaked session of the owner role does not stop the drop" |
| A failed template build leaves nothing behind | `templates.db.test.ts` "a hook that throws", "a hook that leaves a session open"; `global-setup.db.test.ts` "a hook that fails stops the setup, provides nothing, and leaves no database" |
| Hard refusal: port 5432, any port but 4432, any host but `127.0.0.1` | `endpoint.test.ts` (the default port by name; 9 hosts; 14 ports); `credentials.test.ts` "D26, F27: the endpoint of a connection file"; `session.test.ts` "refuses ... before a client is built" (6 cases: no client built, no connect) |
| Hard refusal: connected as a superuser (`rolsuper`) | `session.test.ts` "the helper closes a session that reports rolsuper, after its first statement"; `run.test.ts` "a superuser session stops it" (one statement, the question, then closed). On the real server the same check passes at every session start: `dems_owner`, not a superuser |
| `dems_admin` is refused by name before a client exists | `session.test.ts` "refuses the bootstrap superuser by name before a client is built"; `credentials.test.ts` "refuses the bootstrap superuser in either file" |
| The strings `pg.pwfile` and `dems_admin` | `static.test.ts`: the first occurs in no file of the row; the second once, as the constant that is refused, and is used only in comparisons and refusal messages |
| One place builds a connection; host and port never come from the environment; no connection URL; no file written; no password in an argument | `static.test.ts` (17 tests); the scaffold's `test/static/*.test.ts` pass with this row's files present |
| Credential file missing, or readable by group or others | `credentials.test.ts` (7 modes; missing file; the message names the file and `npm run pg:init`, and holds no value) |
| No message, and no printable form of an error or of the connection fields, holds a password | `credentials.test.ts` (`expectNoValue`), `session.test.ts`; `isolation-*.db.test.ts` (`JSON.stringify(db.runtime)` gives `[redacted]`) |
| `test:db` fails, never skips, when PostgreSQL is unreachable | `nested-run.db.test.ts` "PostgreSQL unreachable"; `global-setup.db.test.ts` "TI-1"; `endpoint.test.ts`; section 8.6 |

## 8. Verification

The code was last changed at 08:33 (one test file). Every quote below is from a run after that,
except where a time before 08:33 is given.

### 8.1 The row command (08:33:42, outside the sandbox)

```
$ DEMS_TEST_STEP=33 npm run test:db -w @dems/core-server -- test/helpers/db
> @dems/core-server@0.2.0 test:db
> vitest run --project db test/helpers/db

 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/core-server

[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_33_tmd0c6zd_
[test:db] stale sweep: dropped 0; kept 0 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
[test:db] template tpl_schema: not built, no hook is plugged in (row W17: test/db/template-hook.schema.ts)

 Test Files  10 passed (10)
      Tests  52 passed (52)
   Start at  08:33:42
   Duration  7.25s (tests 98%, import 1%, transform 1%)

[test:db] teardown: dropped 2 database(s) in 23 ms; 0 remain with the run prefix dems_test_step_33_tmd0c6zd_
exit=0
```

Vitest picks its short reporter in this environment, which hides passed tests and their output
(finding F-7). The sections below quote the same suite with `--reporter=verbose --silent=false`
(08:34:44, exit 0, 52 pass marks, `Tests  52 passed (52)`, `Duration  8.51s`). The two databases
of the teardown line are the helper's private templates `tpl_x_selftest` and `tpl_x_timing`;
each file had already dropped its own clone.

### 8.2 T-TI-1: two files, two clones, each sees only its own row (08:34:53)

```
$ DEMS_TEST_STEP=33 npm run test:db -w @dems/core-server -- --maxWorkers=2 --reporter=verbose --silent=false test/helpers/db/__tests__/isolation
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_33_tmd0e5n2_
[test:db] stale sweep: dropped 0; kept 0 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
[test:db] template tpl_schema: not built, no hook is plugged in (row W17: test/db/template-hook.schema.ts)
[test:db] isolation_b: clone dems_test_step_33_tmd0e5n2_f01_isolation_b in 32 ms (waited 1 ms for the clone lock)
 [pass] isolation-b.db.test.ts > T-TI-1: one database per test file (isolation_b) > the file has its own clone, named by the scheme of TI-2 6ms
 [pass] isolation-b.db.test.ts > T-TI-1: one database per test file (isolation_b) > the code under test is dems_app: no superuser, no create-database, not the owner 3ms
 [pass] isolation-b.db.test.ts > T-TI-1: one database per test file (isolation_b) > writes the same token hash as the other file and sees only its own row 2ms
[test:db] isolation_b: pg_database of the run while the file runs
  dems_test_step_33_tmd0e5n2_f01_isolation_b  datdba=dems_owner  template=false  connections=true
  dems_test_step_33_tmd0e5n2_f02_isolation_a  datdba=dems_owner  template=false  connections=true
  dems_test_step_33_tmd0e5n2_tpl_x_selftest  datdba=dems_owner  template=true  connections=false
[test:db] isolation_a: clone dems_test_step_33_tmd0e5n2_f02_isolation_a in 33 ms (waited 33 ms for the clone lock)
[test:db] isolation_a: pg_database of the run while the file runs
  (the same three lines)
 [pass] isolation-b.db.test.ts > T-TI-1: one database per test file (isolation_b) > the privileges of the template came with the clone, and nothing more (OW-7) 20ms
 [pass] isolation-b.db.test.ts > T-TI-3: owners and roles (isolation_b) > pg_database.datdba is dems_owner for the template and for every clone of the run 1ms
 [pass] isolation-b.db.test.ts > T-TI-3: owners and roles (isolation_b) > the sessions on the databases of the run are dems_owner and dems_app only 5ms
 [pass] isolation-a.db.test.ts > T-TI-1: one database per test file (isolation_a) > the file has its own clone, named by the scheme of TI-2 6ms
 [pass] isolation-a.db.test.ts > T-TI-1: one database per test file (isolation_a) > the code under test is dems_app: no superuser, no create-database, not the owner 2ms
 [pass] isolation-a.db.test.ts > T-TI-1: one database per test file (isolation_a) > writes the same token hash as the other file and sees only its own row 1ms
 [pass] isolation-a.db.test.ts > T-TI-1: one database per test file (isolation_a) > the privileges of the template came with the clone, and nothing more (OW-7) 22ms
 [pass] isolation-a.db.test.ts > T-TI-3: owners and roles (isolation_a) > pg_database.datdba is dems_owner for the template and for every clone of the run 1ms
 [pass] isolation-a.db.test.ts > T-TI-3: owners and roles (isolation_a) > the sessions on the databases of the run are dems_owner and dems_app only 6ms
 Test Files  2 passed (2)
      Tests  12 passed (12)
   Start at  08:34:53
   Duration  406ms (tests 76%, transform 15%, import 8%, worker 1%)
[test:db] teardown: dropped 1 database(s) in 17 ms; 0 remain with the run prefix dems_test_step_33_tmd0e5n2_
exit=0
```

(The reporter's `stdout |` header lines and blank lines are left out.)

Both files insert `token_hash = 'sha256:9f2c1b7e-the-same-in-both-files'` as `dems_app` into
`helper_probe`, the table of the injected one-table migration, and each then reads exactly one
row with its own marker. A second insert of the same key into the same clone fails with `23505`,
so each clone is a database of its own. The two clones existed at the same time (both are in the
listing each file printed), and the second clone waited 33 ms for the clone lock while the first
was being copied.

T-TI-1 also asks that `db:status` of `dems_demo` prints the same row counts before and after a
run. `dems_demo` and `db:status` do not exist yet (W20, W17). The helper cannot name `dems_demo`
(section 7); that part of the test idea belongs to the gate of W58.

### 8.3 No database with the run prefix remains (08:34:54)

A scratch script (session scratchpad, not in the repository) read `.data/pg.owner.env` itself and
printed names only, after the runs of sections 8.1, 8.2 and 8.9:

```
pg_database (name, datdba, template, connections):
  postgres  dems_admin  false  true
  template0  dems_admin  true  false
  template1  dems_admin  true  true
sessions (datname, usename, application_name):
  postgres  dems_owner  dems-w11-state  x1
  null  dems_admin    x1
advisory locks of class 442002 (objid, granted):
```

No `dems_test_*` database, no session on one, no lock of class 442002. The first session line is
the script itself; the second is not a client (finding F-3). The listing was the same after every
batch of runs (08:09, 08:15, 08:18, 08:22, 08:25, 08:26, 08:34). One run of the suite drops 93
databases (counted at 08:29 as the `checkpoint starting: immediate force wait` lines the server
log gained); none is left.

### 8.4 T-TI-2: refused before a statement is sent (08:34:44)

```
[test:db] guards: 4 existing database(s) outside the run were refused, 0 statements sent
 [pass] guards.db.test.ts > T-TI-2: the helper refuses, before any statement, what is not its own > dems_demo, the lanes, the maintenance database and the templates of PostgreSQL 10ms
 [pass] guards.db.test.ts > T-TI-2: the helper refuses, before any statement, what is not its own > every database that exists in the cluster and is not of this run 2ms
 [pass] guards.db.test.ts > T-TI-2: the helper refuses, before any statement, what is not its own > a younger database of another run: refused, and it stays as it is 227ms
 [pass] guards.db.test.ts > T-TI-2: the helper refuses, before any statement, what is not its own > a clone or a pool can only be asked for inside the own run 58ms
 [pass] guards.db.test.ts > T-TI-2: the helper refuses, before any statement, what is not its own > its own database is dropped when it asks 60ms
```

How "before a statement is sent" is measured: the run's session counts every statement it hands
to the driver (`TestRun.statementCount`). `refusedDrop` in `guards.db.test.ts` reads the count,
calls `run.dropDatabase(name)`, expects a `DbGuardError` and expects the same count. The message
of the error begins `refused before any statement:`. The first test makes 14 such requests
(`dems_demo`, `dems_demo_next`, `dems_demo_prev`, `dems_lane_1` to `dems_lane_3`, `postgres`,
`template0`, `template1`, two `dems_proof_*` names, a hand-made `dems_test_` name, another name,
an injected name); the second one asks for every database the catalog held at that moment that
was not of the run (4 here). In the database-free project the stand-in cluster records every
statement it receives, and for each of 14 names it recorded none (`run.test.ts`, 14 tests).

For the younger run the test starts a real second run (`dems_test_step_33oth_<stamp>_`) with a
locked template and a clone that holds a row. The first run's requests to drop either are
refused (`GUARD_FOREIGN_RUN`, "a parallel row may be using it"); the catalog still shows both,
the template still locked, the row still there; the second run cannot drop the first run's
database either; and the second run's stale sweep leaves the first run's databases alone.

### 8.5 T-TI-3: `datdba`

Quoted in section 8.2: `datdba=dems_owner` for the template and for both clones. The same holds
for the three standard templates built from the injected migration, seed and bulk stand-ins
(`templates.db.test.ts`: `tpl_schema`, `tpl_seed`, `tpl_bulk` each
`{ owner: 'dems_owner', isTemplate: true, allowConnections: false }`; every clone
`{ owner: 'dems_owner', isTemplate: false, allowConnections: true }`) and for the templates the
global setup builds (`global-setup.db.test.ts`). The sessions on the databases of a run are
`dems_app` and `dems_owner` only (`pg_stat_activity.usename`, both isolation files). The table of
the template belongs to `dems_owner`; `dems_app` holds exactly the privileges the migration
granted (`UPDATE`, `DELETE`, `TRUNCATE`, `CREATE TABLE`, `DROP TABLE` each fail with `42501`).

### 8.6 PostgreSQL unreachable: the run fails, it does not skip

Three proofs; the server ran throughout.

**(a) A whole run with the probe pointed at a closed loopback port** (08:34:44; a child process
started by `nested-run.db.test.ts` with the self-check project `unreachable`, whose global setup
is the real one with `probeTarget: { host: '127.0.0.1', port: 1 }`):

```
[test:db] nested run "unreachable": exit 1; message: test:db needs the project's PostgreSQL on 127.0.0.1:1, and nothing answers there (ECONNREFUSED). Start it with "npm run pg:start" (state: "npm run pg:status"; first use: "npm run pg:init"). The database tests did NOT run and are NOT skipped: this run fails.
 [pass] nested-run.db.test.ts > a whole run, seen from the outside > PostgreSQL unreachable: the run fails with the clear message; nothing runs, nothing is skipped 258ms
```

The test asserts: exit code 1; the message; the marker that the project's only test prints is
absent; the output holds no "N passed" and no "N skipped"; no run prefix was printed, so no run
started and no database was created. With port 4432 in place of port 1, the text is what a
stopped server gives.

**(b) The same command inside the command sandbox** (08:35:45), where the operating system
refuses the connection. This is the case D32 describes: not "server down".

```
$ DEMS_TEST_STEP=33 npm run test:db -w @dems/core-server -- test/helpers/db        (inside the sandbox)
No test files found, exiting with code 1
DbTestHelperError: test:db cannot connect to PostgreSQL on 127.0.0.1:4432: the operating system refused the connection (EPERM). That is a command sandbox, not a stopped server: run the command again outside the sandbox (check the server with "npm run pg:status"). The database tests did NOT run and are NOT skipped: this run fails.
Serialized Error: { code: 'POSTGRES_UNREACHABLE' }
npm error code 1
exit=1
```

(Four lines of the output, in order; the lines between them are Vitest's banner, its filter
summary and the stack.) The first line is Vitest's own wording for a run whose global setup threw
(finding F-6); the helper's error follows it.

**(c) As a function** (`global-setup.db.test.ts` "TI-1: when PostgreSQL does not answer ..."):
the setup rejects with `POSTGRES_UNREACHABLE`, provides nothing and prints nothing. A probe
target that is not `127.0.0.1`, or is port 5432, is refused without a connect.

The two other whole runs of `nested-run.db.test.ts`, 08:34:44:

```
[test:db] nested run "throwing": exit 1; databases used dems_test_step_33thr_tmd0e0p4_f01_throwing_test_selfcheck, dems_test_step_33thr_tmd0e0p4_f01_throwing_hook_selfcheck; remaining 0
 [pass] nested-run.db.test.ts > a whole run, seen from the outside > test files that throw: the run fails, every database of it is dropped 959ms
[test:db] nested run "convention": exit 0; templates from hook modules: tpl_schema, tpl_seed (global setup), tpl_bulk (worker)
 [pass] nested-run.db.test.ts > a whole run, seen from the outside > hook modules found by convention: the templates are built from them, in the main process and in a worker 1046ms
```

### 8.7 The project `unit` passes and does not touch the database (08:35:07, inside the sandbox)

```
$ npm run test -w @dems/core-server -- --maxWorkers=2
> vitest run --project unit --maxWorkers=2

 Test Files  24 passed (24)
      Tests  526 passed (526)
   Start at  08:35:07
   Duration  1.79s (tests 48%, import 35%, transform 16%, worker 2%)
exit=0
```

It ran inside the command sandbox, where a connection to `127.0.0.1:4432` fails with `EPERM`
(section 8.6 b), so a test that needed the database could not pass. The seven test files of this
row in that project use a stand-in cluster behind the driver seam, temporary directories with
marker values, and text scans; none opens a socket. The scaffold's static tests
(`test/static/*.test.ts`) are among the 24 files and pass with this row's files in the tree: no
name of the superuser's password file under `apps/`, `DROP DATABASE` only in the allowed places
(`test/helpers/db/`, `test/global-setup.db.ts`), none of the forbidden statements.

### 8.8 Typecheck and lint (P11: every run recorded)

| Time | Command | Exit | Notes |
|---|---|---|---|
| 08:35:11 | `npm run typecheck -w @dems/core-server` | **0** | `tsc --noEmit`, 0 errors |
| 08:35:12 | `npm run lint -w @dems/core-server` | **0** | `oxlint`, 0 warnings |
| about 08:15 | `npm run typecheck` (root), first run | 2 | 6 errors, all in `packages/shared/src/api/core-api.ts` and `openapi.ts`, reported while `apps/mock-core` was checked. Those files were being written (modified 08:03 to 08:15) |
| 08:15:27 | `npm run typecheck -w @dems/core-server` | 2 | 1 error, in `../../packages/shared/src/api/openapi.ts`; 0 errors under `test/helpers/db` or in `test/global-setup.db.ts` |
| 08:19:14 | `npm run typecheck -w @dems/core-server` | 0 | The shared files had settled |
| 08:26:49 | `npm run typecheck` (root), second run | 2 | 2 errors: `packages/shared/test/client-types.test.ts(123,46)` (TS2344, workspace `@dems/shared`) and `apps/core-web/src/features/session-new/info-step.tsx(63,48)` (TS2345, workspace `@dems/core-web`) |
| 08:35:13 | `npm run typecheck` (root), third run | 2 | 1 error: `packages/shared/test/client-types.test.ts(123,46)` (TS2344, workspace `@dems/shared`). `@dems/core-server` passes |
| about 08:15, 08:26:50, 08:35 | `npm run lint` (root) | 0, 0, 0 | 12 warnings in `@dems/shared` `src/api/core-api.ts` in the first run, 1 in `@dems/shared` `test/api-text-rule.test.ts` in the second, none in the third; never one in `@dems/core-server` |

The root typecheck is red because of files that other rows are writing in `@dems/shared` and of
what those changes did to one web file. None of the paths is this row's, and the errors differ
from run to run, which shows work in progress. It needs a re-run at the next gate (decision
DN-8).

### 8.9 Several runs at the same time

Four `test:db` runs of this row's suite were started together, three times (08:23 to 08:25);
two of the four carried the same label.

```
round 1 a: dems_test_step_33_tmczx3ff_ | Tests  52 passed (52) | Duration  25.22s | exit=0
round 1 b: dems_test_step_33_tmczx3ez_ | Tests  52 passed (52) | Duration  25.22s | exit=0
round 1 c: dems_test_step_41_tmczx3t0_ | Tests  52 passed (52) | Duration  25.26s | exit=0
round 1 d: dems_test_local_tmczx3nd_ | Tests  52 passed (52) | Duration  25.24s | exit=0
round 2 a: dems_test_step_33_tmczxto7_ | Tests  52 passed (52) | Duration  25.25s | exit=0
round 2 b: dems_test_step_33_tmczxtk0_ | Tests  52 passed (52) | Duration  25.25s | exit=0
round 2 c: dems_test_step_41_tmczxty4_ | Tests  52 passed (52) | Duration  25.26s | exit=0
round 2 d: dems_test_local_tmczxty3_ | Tests  52 passed (52) | Duration  25.21s | exit=0
round 3 a: dems_test_step_33_tmczyj4o_ | Tests  52 passed (52) | Duration  25.86s | exit=0
round 3 b: dems_test_step_33_tmczyjei_ | Tests  52 passed (52) | Duration  25.81s | exit=0
round 3 c: dems_test_step_41_tmczyjs9_ | Tests  52 passed (52) | Duration  25.77s | exit=0
round 3 d: dems_test_local_tmczyjbj_ | Tests  52 passed (52) | Duration  25.84s | exit=0
```

(Each line is assembled by the shell from four lines of one run's output: the run prefix, the
`Tests` line, the `Duration` line and the exit code.) After the last edit of 08:33 the check was
repeated with three runs at a time, twice (08:34): six of six `Tests  52 passed (52)`, exit 0.
Two runs with `DEMS_TEST_STEP=33` that started in the same second got different stamps
(`tmczx3ff`, `tmczx3ez`). The catalog afterwards is the one of section 8.3. The suite takes 25 s
instead of 7.5 s here because its own tests hold the clone lock on purpose (the lock tests, the
hook that leaks a session); a module row holds it for about 30 ms per clone.

Before these rounds, earlier ones had shown three weaknesses **of the tests**, none of the
helper, and they were corrected: a test asked for an empty result right after a sweep while
another run's sweep was still dropping the same stale run (one failure in one of three runs,
08:21:43); a test looked for leftovers by label instead of by run prefix (one failure in each of
two rounds of four, about 08:22, each time in a run that shared its label with another); and two
tests compared the whole catalog before and after (found by review, never failed).

### 8.10 Credentials and the server

- Leak check at 08:19 and again at 08:40:46, after both documents were written: a scratch script
  takes the two password values from `.data/pg.owner.env` and `.data/pg.env` as search patterns
  and prints counts only. Scanned at 08:40:46: `apps/core-server/test/`, this task's `docs/`
  folder, the scratch scripts, `.data/postgres.log`, the Vite caches of the workspace and the 90
  test logs of this row in the two temporary directories: 317 files, **0 contain a credential
  value** (08:19: 93,372 files, 0).
- The helper never opened `.data/pg.pwfile`: no file of the row names it (`static.test.ts`; the
  scaffold's `credentials.test.ts`). The scratch scripts of this row read the two other files
  only.
- `cat .locks/postgres.pid` printed `19121` in the first command of the row and at 08:34:54;
  `ps` shows that process started at 07:14:26. No `pg:*` script was run by this row.
- Nothing was installed; no `package.json`, lockfile or `vitest.config.ts` was edited
  (`vitest.config.ts` was last modified at 06:33:38, by W03).

## 9. Measured times (this host, PostgreSQL 18.4, default copy strategy, one-table template)

A database of the injected one-table migration is 7,814 kB (`pg_database_size`): almost all of
it is the catalog every database carries. The real schema of 30 tables will be somewhat larger;
row 28 (W17) should repeat the measurement with its hook. The numbers come from
`timing.db.test.ts`, which prints them in every run (15 clones, 16 + 7 drops).

| What | 08:12 | 08:18 | 08:26 | 08:34 | Range |
|---|--:|--:|--:|--:|---|
| Template build, total (create, hook, wait for sessions, lock) | 40.3 ms | 32.4 ms | 59.6 ms | 81.9 ms | 32 to 82 ms |
| of which `CREATE DATABASE` from the empty template | 32.6 ms | 25.8 ms | 25.8 ms | 32.4 ms | 26 to 33 ms |
| of which the hook (one `CREATE TABLE`, one `GRANT`) | 6.2 ms | 5.7 ms | 5.4 ms | 7.9 ms | 5 to 8 ms |
| **First clone** | 34.0 ms | 26.5 ms | 28.1 ms | 35.4 ms | **26 to 35 ms** |
| **Clone, median of the next 15** | 30.9 ms | 26.5 ms | 29.4 ms | 39.9 ms | **27 to 40 ms** |
| Clone, minimum and maximum of the 15 | 27.5 / 45.7 ms | 26.1 / 29.4 ms | 27.2 / 43.8 ms | 35.5 / 43.8 ms | 26 to 46 ms |
| Drop, median (no session was open) | 11.9 ms | 9.0 ms | 17.6 ms | 15.9 ms | 9 to 18 ms |
| Drop, maximum | 167.8 ms | 117.5 ms | 184.7 ms | 319.0 ms | up to 319 ms |
| Drop, median after three sessions of two roles were closed | not measured | 9.1 ms | 15.7 ms | 12.2 ms | 9 to 16 ms |

The 08:18 run was the timing file alone; the others were inside the whole suite, with the second
worker busy. The 08:12 run was before the last edits of that test. Other agents were working on
the host throughout (load average 6.6 at 08:25, 4.8 at 08:35).

| What | Measured |
|---|---|
| `tpl_schema` then `tpl_seed` as the global setup builds them (injected hooks, private run) | 73 to 102 ms and 53 to 64 ms (create 28 to 37 ms each; hooks 4 to 10 ms) |
| A whole `npm run test:db` of two files, 12 tests, one lazily built template, two clones, with the global setup and the teardown | **0.51 to 0.54 s** wall clock (three runs at 08:28, `/usr/bin/time`) |
| **A whole `test:db` of this row's tests** (10 files, 52 tests, 2 workers) | **7.2 to 8.5 s** (Vitest `Duration` 7.15, 7.16, 7.25, 7.45, 7.48, 7.51, 7.60, 8.51 s; 7.22 s wall clock) |
| The same with 3 and with 4 runs at the same time | 18 s and 25 s each |
| A clone that waits for the clone lock | The wait is reported per clone (`timings.lockWaitMs`): 0 to 1 ms when free, 28 to 33 ms behind one other clone |

Budget for later rows: about **30 to 40 ms to clone and 10 to 20 ms to drop per test file**,
with an occasional drop of 100 to 300 ms; a template build costs one clone plus its hook. The
sources stated 30 to 400 ms per clone [DB:§10.1]; this host is at the low end. Hypothesis for
the slow drops: the checkpoint that every `DROP DATABASE` requests (finding F-4); it was not
measured separately.

## 10. Test ledger (P24)

`@dems/core-server` only; no other workspace was touched.

| Project | Before this row | After (08:35) | This row's files |
|---|---|---|---|
| `db` | 0 files, 0 tests (the project had no file; its global setup did not exist) | **10 files, 52 tests**, 0 failed | all 10 |
| `unit` | 17 files, 330 tests (the total without this row's files, at 08:17, 08:26 and 08:35) | 24 files, 526 tests, 0 failed | **7 files, 196 tests** |

| Project | File (`apps/core-server/test/helpers/db/__tests__/`) | Tests |
|---|---|--:|
| `db` | `cleanup.db.test.ts` | 7 |
| `db` | `clone-lock.db.test.ts` | 3 |
| `db` | `global-setup.db.test.ts` | 6 |
| `db` | `guards.db.test.ts` | 5 |
| `db` | `isolation-a.db.test.ts` | 6 |
| `db` | `isolation-b.db.test.ts` | 6 |
| `db` | `nested-run.db.test.ts` | 3 |
| `db` | `sweep.db.test.ts` | 3 |
| `db` | `templates.db.test.ts` | 12 |
| `db` | `timing.db.test.ts` | 1 |
| `unit` | `credentials.test.ts` | 30 |
| `unit` | `endpoint.test.ts` | 30 |
| `unit` | `hooks.test.ts` | 8 |
| `unit` | `names.test.ts` | 43 |
| `unit` | `run.test.ts` | 50 |
| `unit` | `session.test.ts` | 18 |
| `unit` | `static.test.ts` | 17 |

The counts are from the JSON reporter (`--reporter=json`) of the runs of 08:21:35 (`db`) and
08:35:07 (`unit`). The seven `unit` files are an addition the row text does not name (deviation
DV-5): they need no database, so the guards are checked in every later row's gate. No existing
test was changed.

## 11. Rules of the contract (TI-1 to TI-17)

| Rule | State | Where |
|---|---|---|
| TI-1 server; fails, never skips | Implemented, **attach only** (DV-1) | `endpoint.ts`, `run.ts` `TestRun.start`; section 8.6 |
| TI-2 naming | Implemented | `names.ts`; section 5 |
| TI-3 guard | Implemented | `names.ts` `guardOwnDatabase`; section 7 |
| TI-4 templates built once per run by the global setup, as `dems_owner` | Implemented; built when the hook exists | `global-setup.ts`; `hooks.ts` |
| TI-5 template locked, no connection | Implemented | `ddl.ts` `lockTemplate`; `templates.db.test.ts` (SQLSTATE 55000) |
| TI-6 clone, default strategy, owner `dems_owner` | Implemented | `ddl.ts` `cloneDatabase` |
| TI-7 clones serialised, `pg_advisory_lock(442002, 0)` on the maintenance database | Implemented, plus a queue inside the process (the lock is re-entrant within one session) | `run.ts` `withCloneLock` |
| TI-8 one database per file; another clone on request | Implemented | `index.ts` `useTestDatabase`, `handle.another` |
| TI-9 roles; nothing as `dems_admin` | Implemented | `session.ts`, `credentials.ts`; `static.test.ts` |
| TI-10 cleanup per file | Implemented; with a leaked `dems_app` session the drop is not sent and the file fails (`SESSIONS_REMAIN`, DV-7) | `run.ts` `TestDatabase.drop` |
| TI-11 cleanup per run | Implemented; a leftover fails the run | `run.ts` `teardown`, `global-setup.ts` |
| TI-12 stale databases, six hours, never a younger run | Implemented, with a liveness lock (DN-3) | `run.ts` `sweepStale` |
| TI-13 the seed and the bulk loader refuse a name without `dems_test_` | Belongs to W20 and W25; the helper hands their hooks only databases of that prefix | — |
| TI-14 two workers; at most five connections per application under test | The helper's `appPool()` has 5. The worker limit is in `vitest.config.ts` (W03). The scaffold's own pool allows 10 (finding F-5) | `constants.ts` |
| TI-15 root gate needs no database | Holds: section 8.7 | — |
| TI-16 manual clock | Not this row's | — |
| TI-17 no connection to `dems_demo` or a lane, none as `dems_admin`, the code under test never as `dems_owner` | The helper hands out pools and connection fields for databases of the own run only; `runtime` and `appPool()` are `dems_app` | `run.ts` `poolOn`, `connectionOn` |

## 12. Findings

| ID | Finding | Evidence |
|---|---|---|
| F-1 | **For a session of another role, `dems_owner` sees `datname`, `usename` and `application_name` in `pg_stat_activity`; `backend_type`, `state`, `client_addr` and `backend_start` are NULL and `query` reads `<insufficient privilege>`** (it has no `pg_read_all_stats`). A filter `backend_type = 'client backend'` therefore hides every `dems_app` session. PG-27 names the visible columns correctly, but a query that also filters on the backend type or the state sees only its own role. This matters for the reset routine (R-1, R-7 of [DB:§8.5]). The helper tests `usename IS NOT NULL` instead | The first run of the isolation tests at 07:58 failed with `expected [ 'dems_owner' ] to include 'dems_app'`. A scratch script at 08:29, a `dems_app` session read by `dems_owner`: `{ datname: 'postgres', usename: 'dems_app', application_name: 'dems-w11-visible-name', backend_type: null, state: null, query: '<insufficient privilege>', client_addr: null, has_backend_start: false }`; its own session: `{ backend_type: 'client backend', state: 'active' }` |
| F-2 | **A unique or foreign-key violation writes the key value into the server log** (`DETAIL:  Key (token_hash)=(...) already exists.`), with the default logging settings. PG-16 says the log holds the failed statement without its bind parameters; that is true of the `STATEMENT` line, but the `DETAIL` line carries the value. For the real tables: a duplicate on a unique column puts that column's value into `.data/postgres.log`. Token and credential columns hold hashes, so no secret in clear text is expected, but NL-5 and the log check of W17 should say so explicitly | `.data/postgres.log` at 08:15: 18 lines `DETAIL:  Key (token_hash)=(sha256:9f2c1b7e-the-same-in-both-files) already exists.` (the marker of this row's isolation test, not a secret), and 4 lines `DETAIL:  Key (id)=(role_admin) is referenced from table ...` from the proof row |
| F-3 | `pg_stat_activity` has at all times one row with `usename = dems_admin`, no database and an empty application name. It is not a client session of this project: nothing here connects as that role. Hypothesis: the server's logical replication launcher, which runs as the bootstrap role (its backend type is hidden from `dems_owner`, F-1, so this was not confirmed). A check "no session as `dems_admin`" must ask for `datname IS NOT NULL` | Section 8.3; the scratch script of 08:29: `{ datname: null, usename: 'dems_admin', application_name: '', backend_type: null, state: null }` |
| F-4 | Every `DROP DATABASE` requests a checkpoint, and the server logs checkpoints (two lines each: `checkpoint starting: immediate force wait`, `checkpoint complete`). **One run of this row's suite drops 93 databases and adds 217 lines, 40 kB, to `.data/postgres.log`** (measured at 08:29). Tests that expect a refusal add their `ERROR` and `STATEMENT` lines as well. The log was 9,739 bytes when the row began and 1,794,816 bytes (9,953 lines, 3,992 of them `checkpoint starting: immediate force wait`, which is 43 suite runs' worth of drops) at 08:39, from this row's test runs and the proof row's work. Nothing rotates it | `ls -la .data` at the start; `wc`, `stat` and `grep -c` at 08:15, 08:28, 08:29 and 08:39 |
| F-5 | The scaffold's pool allows 10 connections; TI-14 says at most five per application under test. The server has `max_connections = 100`. With several rows testing at once and several apps per file this can add up. The pool is lazy, so it rarely reaches its maximum | `apps/core-server/src/plugins/db/index.ts:30` (`POOL_MAX_CONNECTIONS = 10`); `pg_settings` in the first probe of the row |
| F-6 | When a global setup throws, Vitest 5.0.3 prints `No test files found, exiting with code 1` before the error. The exit code is 1 and the helper's message follows, but the first line misleads | Section 8.6 b |
| F-7 | Vitest 5.0.3 chooses a short reporter when it detects an agent environment (the variable `AI_AGENT` is set here): passed tests and their output are hidden. Evidence runs need `--reporter=verbose --silent=false`; a child process of a test needs `--reporter default` to give the same output everywhere | `node_modules/vitest/dist/chunks/index.DpLw24bj.js:18304`; section 8.1 |
| F-8 | `lock_timeout` applies to `pg_advisory_lock` (SQLSTATE `55P03`, "canceling statement due to lock timeout"), so a wait for the clone lock is bounded without a second connection | `clone-lock.db.test.ts`, third test; the same error in the run of 08:07 |
| F-9 | The `pg` driver warns that calling `client.query()` while another query of the same client runs is deprecated and will be removed in `pg` 9. The helper's session therefore queues its own statements. Rows that share one `Client` between concurrent calls (the reset routine, a command) should do the same or use a pool | The `DeprecationWarning` in the run of 08:07; `session.ts` `OwnerSession.run` |
| F-10 | A statement of the helper's session that waits for the clone lock holds back every later statement of that session. A test must not ask the run for anything while one of its own clones waits; the helper's lock test reads the catalog through a pool for that reason | The first version of `clone-lock.db.test.ts` waited on itself (run of 08:07, `Duration  200.97s`); corrected |
| F-11 | The root typecheck was red at 08:15, 08:26 and 08:35 in files of other rows | Section 8.8 |
| F-12 | `pg_hba.conf` lets `dems_app` connect to `postgres`, and the helper uses that once per run for the role check of step 3 (section 6). No project database is involved | `session.ts` `verifyAppRole` |

## 13. Deviations from the row text and the contract

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | **TI-1, GR-2 and [PL:§3.4] say `test:db` "attaches to or starts" PostgreSQL and stops it only if it started it. The helper attaches only**; with no server it fails and names `npm run pg:start` | The delegation of this row: "it may attach to the running instance (the plan's default) and, only if the plan row says so, start it"; the row text does not say so. P15 and D32: the instance is left running and no row but W89 and W90 stops it. A run that started the server and stopped it at its end would take the server away from a row that attached meanwhile. Inside a sandbox the probe fails with `EPERM` although the server runs, and a start attempt there would be wrong. See DN-1 |
| DV-2 | A fourth kind of template name, `<prefix>tpl_x_<name>`, beside the three of TI-2 | The helper's own tests must not depend on what W17 puts into `tpl_schema`: they clone a private one-table template. Module rows can use the same for an empty database or a scenario of their own (section 3). The names pass the guard of TI-3 |
| DV-3 | `tpl_bulk` (and any private template) is built with the clone lock held for the **whole** build, as §10.1 says; `tpl_schema` and `tpl_seed` hold it around `CREATE DATABASE` only, as TI-7 says | Both follow the contract. Consequence: while a bulk fixture loads, no clone starts in any run. If that proves slow, a lock per template would lift it (DN-4) |
| DV-4 | The helper imports `Secret`, `DatabaseConnection`, `DATABASE_HOST`, `FOREIGN_DATABASE_PORT` and `RUNTIME_ROLE` from `src/config.ts`; its static test imports `test/static/scan.ts`; one test imports `createRuntimePool` from `src/plugins/db` (all W08). The plan gives W11 the dependency W07 only | One secret type and one place for the refused port in the workspace; `db.runtime` then fits `createConfig` and the server's pool factory without a conversion. `src/config.ts` is frozen after W08 (P25) |
| DV-5 | Seven test files in the project `unit` (196 tests), not named by the row | Section 10 |
| DV-6 | `helpers/db/selfcheck/` holds a second Vitest configuration and fixtures, and one test starts Vitest as a child process three times | The only way to show from the outside that a failing global setup or a throwing test file ends the run as required, and that hook modules are found by convention, without editing `vitest.config.ts` and without stopping the server. The child gets paths and names only (`static.test.ts`). Cost: about 2 s of test time in the suite |
| DV-7 | The drop of a file's database is **not sent** when a session of another role is still open; TI-10 words it as "the drop fails" | The outcome is the same (T5-h: the forced drop is refused with `42501`), without an `ERROR` in the server log and with a message that says what to close |
| DV-8 | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were not written | Parallel run: the controller writes the shared files (P8). This document and the progress file are the row's record |
| DV-9 | The helper's session sets `lock_timeout` to 120 s; a file's `beforeAll` and `afterAll` have a timeout of 180 s | Bounds a wait for the clone lock that another run holds; without it a stuck holder would hang every run |

## 14. Decisions for the controller to record

| ID | Question | Recommendation |
|---|---|---|
| DN-1 | DV-1: should `test:db` start PostgreSQL when it is down? | Keep attach-only and amend the wording of TI-1, GR-2 and the `test:db` line of [PL:§3.4] to "attaches to the running PostgreSQL; fails, never skips, and names `npm run pg:start`". If a start is wanted, it is one place (`TestRun.start`, before the probe) calling `scripts/pg/start.mjs`; it must then never stop the server |
| DN-2 | DV-2: the private template names `tpl_x_<name>` | Accept and add to TI-2 |
| DN-3 | Lock key 442002 has a second use: `(442002, k)` with `k` from 1 to 1073741823 is "the run with this stamp is alive"; `(442002, 0)` stays the clone lock. A sweep that finds the lock taken leaves the run (the holder is the run itself or another sweeper) | Record beside the lock keys of [PL:§3.4] |
| DN-4 | DV-3: the clone lock is held while `tpl_bulk` is built | Accept now. Ask W25 to measure its hook; above about 2 s, schedule a change to a lock per template in this helper |
| DN-5 | F-1: the wording of PG-27, and the reset routine | Tell W29 and W17: never filter `pg_stat_activity` on `backend_type`, `state` or `query` when another role's sessions matter; use `usename IS NOT NULL` |
| DN-6 | F-2: key values in `DETAIL` lines of the server log | Route to the security checkpoint (W45) and to W17's log check: list which unique and foreign-key columns could be logged; confirm that each holds a hash or a non-secret |
| DN-7 | F-5: `POOL_MAX_CONNECTIONS = 10` against TI-14's five | Rule which number holds; `src/plugins/db/index.ts` is W08's |
| DN-8 | F-11: the root typecheck | Re-run at the next gate once the rows writing `@dems/shared` have returned |
| DN-9 | F-4: the growing server log | Tell W17 (log check) and W86 (README): the log is not empty after tests; it holds expected refusals and two checkpoint lines per dropped database. No rotation is planned in this task |
| DN-10 | The hook module paths of section 4 are now pinned names for W17, W20 and W25 | Add them to the delegations of those rows |
| DN-11 | DV-4: W11 depends on W08's `src/config.ts`, `src/plugins/db` and `test/static/scan.ts` | Record the dependency |

## 15. Rollback (R-NEW; not executed)

```sh
cd /Users/gsp-budi/Documents/DEMS
git clean -fd -- apps/core-server/test/helpers/db apps/core-server/test/global-setup.db.ts
```

Both paths are new and untracked. After it `vitest.config.ts` still names
`./test/global-setup.db.ts`, so `npm run test:db` fails at start, as it did before this row.
`npm test`, typecheck and lint are unaffected, except that the 7 `unit` files and 196 tests of
this row are gone. No database object remains to remove: every run drops its templates and
clones, and the catalog held no `dems_test_*` database at the end (section 8.3). If a run is
ever killed, its databases are swept by the first `test:db` that starts more than six hours
later, or go with `npm run pg:remove-data`.

## 16. Verification list of the row

| Check of the row | Result | Section |
|---|---|---|
| `npm run test:db -w @dems/core-server -- test/helpers/db` exits 0 | Yes: 10 files, 52 tests | 8.1 |
| Two files get two clones and see only their own row | Yes | 8.2 |
| No database with the run prefix remains | Yes | 8.3 |
| A request to drop `dems_demo` or a younger database of another run is refused before a statement is sent | Yes | 8.4 |
| The first measured clone time is recorded | 26 to 35 ms | 9 |
| `pg_database.datdba` shows `dems_owner` for templates and clones | Yes | 8.5 |
| Project `unit` passes and does not touch the database | Yes | 8.7 |
| Typecheck and lint of the workspace | Exit 0, exit 0 | 8.8 |
| Root typecheck | Exit 2 in files of other rows; three runs recorded (P11) | 8.8 |
| With PostgreSQL unreachable the run fails with a clear message | Yes, proven without stopping the server | 8.6 |
| Test ledger | `db` 0 to 52 tests in 10 files; `unit` plus 196 tests in 7 files | 10 |
| Leak check after this document and the progress file were written | 08:40:46: 317 files scanned, 0 contain a credential value | 8.10 |

Not verified by this row: a start of `test:db` after an interrupt signal (whether Vitest then
calls the teardown; if it does not, the sweep takes the leftovers after six hours); the helper
with the real migrations, seed and bulk fixture (W17, W20, W25 plug them in); an app built by
`buildApp` on a clone (the server's pool factory was run on one, section 3).

## 17. By-design change after acceptance (controller follow-up to D48, 09:46)

One existing test of this row was changed by design, on the controller's instruction. Nothing
else was touched.

**Why.** The migration writer plugged its hook in (`apps/core-server/test/db/template-hook.schema.ts`,
09:05). The self-check project `throwing` runs under the real global setup, which therefore now
builds `tpl_schema` as well, so its teardown drops two databases, not one; it will be three once
the seed hook exists. The test pinned the number 1. What the test is about did not change:
`0 remain with the run prefix`.

**The edited line.** `apps/core-server/test/helpers/db/__tests__/nested-run.db.test.ts:83`
(now lines 82 to 89):

Before:

```ts
    // The files dropped their own databases; the teardown had only the template left.
    expect(run.output).toMatch(/teardown: dropped 1 database\(s\) in \d+ ms; 0 remain with the run prefix/);
```

After:

```ts
    // The files dropped their own databases, so the teardown had only templates left: the ones the
    // global setup built (one output line each; how many depends on which hooks are plugged in)
    // and the private template the two files share, which a worker built. A clone that a file
    // had failed to drop would make the count larger.
    const builtBySetup = [...run.output.matchAll(new RegExp(`template ${prefix ?? 'none'}tpl_[a-z0-9_]+: built in \\d+ ms`, 'g'))].length;
    const dropped = Number(/teardown: dropped (\d+) database\(s\) in \d+ ms; 0 remain with the run prefix/.exec(run.output)?.[1]);
    expect(dropped, run.output).toBeGreaterThanOrEqual(1);
    expect(dropped, run.output).toBe(builtBySetup + 1);
```

The test is not weaker. The count is no longer a constant but is still exact: it must equal the
number of templates the nested run's own global setup reports as built, plus one for the private
template `tpl_x_selftest` that the two fixture files share (it is built in a worker, which prints
no line; that `1` is the one number still fixed, and it depends on the fixtures of this row
only). A clone that a throwing file had failed to drop would make the teardown count larger and
fail the test, as before; a missing teardown line or a line with anything but `0 remain` gives
`NaN` and fails it too. The third test of the file (`dropped 3 database(s)`, the project
`convention`) was not changed: that run takes its hooks from the fixture workspace, not from
`apps/core-server`, so it does not depend on which real hooks exist.

**What the test reads** (the project `throwing` run directly, 09:46:44; `DEMS_TEST_STEP=33thr`):

```
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_33thr_tmd3pwhs_
[test:db] stale sweep: dropped 0; kept 0 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
[test:db] template tpl_seed: not built, no hook is plugged in (row W20: src/db/seed/__tests__/template-hook.seed.ts)
[test:db] template dems_test_step_33thr_tmd3pwhs_tpl_schema: built in 80 ms (create 29 ms, hook 49 ms)
 Test Files  2 failed (2)
      Tests  1 failed | 1 passed | 1 skipped (3)
[test:db] teardown: dropped 2 database(s) in 29 ms; 0 remain with the run prefix dems_test_step_33thr_tmd3pwhs_
exit=1
```

One `built in` line, so `builtBySetup` is 1 and the expected count is 2. (These are the lines of
the output that begin with `[test:db]` and the two total lines; the failures between them are
the two on purpose.)

**The whole `db` project** (09:46:18, outside the sandbox):

```
$ DEMS_TEST_STEP=33 npm run test:db -w @dems/core-server
> @dems/core-server@0.2.0 test:db
> vitest run --project db
 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/core-server
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_33_tmd3p6xw_
[test:db] stale sweep: dropped 0; kept 0 of younger runs, 0 of live runs, 0 unrecognised; 0 failed
[test:db] template tpl_seed: not built, no hook is plugged in (row W20: src/db/seed/__tests__/template-hook.seed.ts)
[test:db] template dems_test_step_33_tmd3p6xw_tpl_schema: built in 76 ms (create 27 ms, hook 47 ms)
 Test Files  19 passed (19)
      Tests  285 passed (285)
   Start at  09:46:18
   Duration  11.27s (tests 92%, import 6%, transform 2%)
[test:db] teardown: dropped 4 database(s) in 61 ms; 0 remain with the run prefix dems_test_step_33_tmd3p6xw_
exit=0
```

(Blank lines of the output are left out.) No failure in any file, so no re-run was needed. The
test file alone, with the verbose reporter (09:46:41): `Test Files  1 passed (1)`,
`Tests  3 passed (3)`, exit 0.

| Check | Time | Result |
|---|---|---|
| `npm run typecheck -w @dems/core-server` | 09:46:11 | **Exit 0**, with the edit in place |
| the same | 09:46:57 | Exit 2: one error, `../../packages/shared/src/sim/evidence-actions.ts(276,47)` TS2304; that file was modified at 09:46:56 by another row. 0 errors in this row's paths (P11) |
| the same | 09:47:09 | **Exit 0**, 0 errors |
| `npm run lint -w @dems/core-server` | 09:46:56 | Exit 0; no warning in `test/helpers/db` |
| `npm run test -w @dems/core-server -- --maxWorkers=2 test/helpers/db` (project `unit`, inside the sandbox) | 09:46:55 | Exit 0: 7 files, 196 tests (the static test that reads this test file among them) |
| `pg_database` after the runs (the scratch script of section 8.3) | 09:46:44 | `postgres`, `template0`, `template1` and nothing else; no session on a test database; no advisory lock of class 442002 |
| The PostgreSQL server | 09:46:44 | PID 19121, as before |

Ledger: unchanged for this row (`db` 10 files, 52 tests; `unit` 7 files, 196 tests). The `db`
project as a whole is 19 files, 285 tests at 09:46, the other 9 files being the migration
writer's (`test/db/*.db.test.ts`).

Timing with the real migrations, which section 9 asked row 28 (W17) to repeat: `tpl_schema` was
built in 76 and 80 ms in the two runs above (create 27 and 29 ms, hook 47 and 49 ms).

---
*Generated: 2026-10-04 08:40 WIB*
*Last Updated: 2026-10-04 09:48 WIB*
