# Progress: database-specialist, blueprint step 39 (plan row W17)

**Row**: [W17] Schema, migrations and database commands (the only migration writer).
**Status**: `needs-review` (one item, NR-1). Everything this row owns is complete and verified.
**Output document**: `implementation/17_db_schema_migrations.md`.
**Started** 2026-10-04 08:47 WIB; **verified** 09:37 to 09:41 WIB. No credential value is in this
file: names, counts and times only.

## Milestones

| Time (WIB) | Milestone |
|---|---|
| | (Times are the runner's `Start at` lines or file times; the two marked "about" were not printed) |
| 08:47 | Inputs read: blueprint row and protocol P1 to P25; contract rev 2.2 (§1.9, §2 to §8, §10, §12, §13, §15); proof of row 32; helper of row 33; scaffold §6; decisions D14, D16, D19, D26, D27, D28, D32, D38, D40. PostgreSQL PID 19121 |
| 08:57 | Typed schema of 30 tables written; `drizzle-kit generate` wrote the four files in order (`--custom` prelude, generated tables, `--custom` guards, `--custom` privileges). Generated SQL: 30 tables, 302 columns, 98 CHECKs, 25 foreign keys |
| 09:06 | First apply on PostgreSQL 18.4 as `dems_owner`: all four files in one call; second call applies nothing; `tpl_schema` built by the helper through this row's hook |
| 09:10 | Inventory parsed from the contract's own tables: 30 / 302 / 98 / 25; the typed schema and the hand-written files equal the contract (database-free test) |
| 09:15 | Catalog difference empty; T-AO-1, 2a, 2b, 2d, 3 and T-CH-1, 2, 3 pass |
| 09:17 | T-AT-1 to T-AT-5 pass with the contract's statements and forced races (20 sessions waiting at once in T-AT-2) |
| 09:19 | T-PV-1 (catalog and live, 302 column UPDATEs) and T-PV-2 pass |
| 09:21 | Boot checks B-2 to B-9 and T-PV-3 pass |
| about 09:25 | One refused row for each of the 98 CHECKs and 25 foreign keys |
| about 09:28 | `db:create`, `db:migrate`, `db:status` proven on a database of the run; hash mismatch gives exit 1 |
| 09:29 | Server-log check: what a violation writes (section 11 of the output document) |
| 09:32 | Whole `db` project run: one test of the helper row fails (NR-1) |
| 09:37 | Final runs: row command exit 0 (9 files, 233 tests); unit 31 files, 979 tests; typecheck, lint exit 0; no drift |
| 09:43 | Output document and this file written; leak check, twice |

## Files created (all new; nothing existing was edited)

Under `apps/core-server/`:

- `drizzle.config.ts`
- `src/db/schema/`: `index.ts`, `bytea.ts`, `value-sets.ts`, `checks.ts`, `rbac.ts`, `identity.ts`,
  `pairing.ts`, `audit.ts`, `sessions.ts`, `evidence.ts`, `core.ts`, `meta.ts`,
  `public-columns.ts`, `boot-checks.ts`
- `src/db/migrations/`: `0000_prelude.sql`, `0001_tables.sql`, `0002_audit_guards.sql`,
  `0003_privileges.sql`, `meta/_journal.json`, `meta/0000_snapshot.json` to `meta/0003_snapshot.json`
- `src/db/commands/`: `create.ts`, `migrate.ts`, `status.ts`, `cli.ts`, `database-names.ts`,
  `migrations.ts`, `owner-connection.ts`
- `test/db/`: `template-hook.schema.ts`, `contract-inventory.ts`, `contract-inventory.json`,
  `fixtures.ts`, `support.ts`, `migrate.db.test.ts`, `catalog.db.test.ts`,
  `audit-guards.db.test.ts`, `atomic.db.test.ts`, `privileges.db.test.ts`,
  `boot-checks.db.test.ts`, `constraints.db.test.ts`, `commands.db.test.ts`,
  `pg-behaviours.db.test.ts`, `contract-inventory.test.ts`, `commands.test.ts`

Under `docs/2026-10-04_dems_backend_rbac_pairing/`:

- `implementation/17_db_schema_migrations.md`
- `delegation_progress/database_specialist_step_39.md` (this file)

Outside the owned paths, as a side effect of the lock the protocol prescribes:

- `.locks/db-migrate.lock` (0 bytes), created by one `/usr/bin/lockf -k` run of `db:migrate`
  against the absent `dems_demo`, which changed nothing

Not written, by the parallel-run rule: `masterplan/02_plan.md`, `status_tasks.md`,
`delegation_progress_report.md`, `decisions/decisions.md`, `implementation/99_implementation_report.md`.

## Verification (quoted in the output document)

| Check | Result |
|---|---|
| `DEMS_TEST_STEP=39 npm run test:db -w @dems/core-server -- test/db` | exit 0; `Test Files 9 passed (9)`; `Tests 233 passed (233)` (09:36:51) |
| Catalog against contract §4 | `diff (0 line(s)): (empty)`; 30 tables, 302 columns, 98 CHECKs, 25 foreign keys, 5 functions, 3 triggers `'A'` |
| `npm run test -w @dems/core-server -- --maxWorkers=2` | exit 0; 31 files, 979 tests (09:37:20) |
| `npm run typecheck -w @dems/core-server`; `npm run lint -w @dems/core-server` | exit 0; exit 0, 0 warnings |
| Root `npm run typecheck`; `npm run lint` | exit 0; exit 0 (09:37) |
| `npm run db:generate -w @dems/core-server -- --name=drift` | `No schema changes, nothing to migrate`; the nine files unchanged by hash |
| `pg_database` | `postgres`, `template0`, `template1`; 0 databases of this row; `dems_demo` absent |
| `.locks/postgres.pid` | 19121, started 07:14:26: unchanged |
| **Whole `db` project** | **exit 1**: 19 files, 285 tests, 284 passed, **1 failed: a file of row 33 (NR-1)** |
| Leak check (09:43:14, repeated 09:43:35 with both documents on disk) | 1,218 files and `.data/postgres.log` scanned; 0 contain a credential value |

## Blockers

None for this row's own scope.

## Needs review

| ID | Item |
|---|---|
| NR-1 | `apps/core-server/test/helpers/db/__tests__/nested-run.db.test.ts:83` (row 33, W11) expects `teardown: dropped 1 database(s)` from a nested run under the real global setup. With this row's hook plugged in, that run also builds `tpl_schema` and reports 2. The property under test still holds (`0 remain with the run prefix`). Fix: `dropped \d+ database` in that pattern. This row may not edit `test/helpers/**`. Until it is changed, `npm run test:db` as a whole exits 1 |

## Findings (details in section 17 of the output document)

- F-1: a CHECK or NOT NULL violation writes the whole failing row into `.data/postgres.log`,
  hash columns and the password salt included (values cut at 64 bytes). A unique violation writes
  the key value: for the four UNIQUE constraints on a hash column, the stored hash. Never a
  secret: the server only ever receives hashes. PG-16 is corrected accordingly.
- F-2: a GRANT by the runtime role to itself is a warning (`01007`), not `42501`; nothing is granted.
- F-3: every role may create temporary tables in a project database (a PostgreSQL default).
- F-4: `log_parameter_max_length_on_error` can be set by any role for its own session.
- F-5: `drizzle-kit` emits `DESC NULLS LAST` for `.desc()`; the schema uses `.desc().nullsFirst()`.
- F-6: drizzle-orm's wrapper error repeats the statement; the commands print the cause only.
- F-7: PostgreSQL 18 catalogues NOT NULL constraints (245 here); "98 CHECKs" is `contype = 'c'`.
- F-8: a private template key takes one definition per test file.
- F-9: one run of this row's database tests adds 184 kB to the server log.

## Deviations from the contract (section 13)

CD-1 a comment reworded in `0002_audit_guards.sql` (the static guard); CD-2 the contract's
`42501` for a GRANT by `dems_app` is a warning on 18.4; CD-3 PG-16 and NL-3 hold for the STATEMENT
line only; CD-4 two CHECKs and three UNIQUE constraints are shadowed by stronger rules;
CD-5 NOT NULL constraints are catalogued; CD-6 the TypeScript name `exportRecords`.
No table, column, constraint, index, function, trigger or grant deviates.

## Deviations from the row text

- The boot checks live in `src/db/schema/boot-checks.ts` (the path the delegation gives when
  neither the plan nor the contract names one).
- B-5 also asks column-level privileges; B-8 takes the shared digest check as a parameter.
- The hash comparison of D38 is in `db:status`, `db:migrate` and `assertLedgerCurrent`, which need
  the owner role; it cannot be a boot check of the runtime role (OW-5).
- `SCHEMA-GAP-1` is not raised: the instant D-1 asks for is stored (`hardware_snapshot.written_at`,
  `active_session.updated_at`).
- Two database-free test files were added beside the nine database test files.
- One shell loop passed its arguments wrongly once (it ran nothing); the commands were repeated.

## Decisions for the controller (section 18)

DN-1 who changes the helper's one line (NR-1). DN-2 the hash check as a command check, not a
runtime boot check. DN-3 hash columns in the PostgreSQL log (to the backend security review).
DN-4 `SCHEMA-GAP-1` not raised; three notes for the engine-host row. DN-5 one more pattern for the
static guard. DN-6 the meaning of `db:status`'s exit code. DN-7 reword one cell of contract §6.2.
DN-8 `db:migrate` does not take the reset's advisory lock. DN-9 the two choices in the boot checks.

## For the next rows

- W20 (seed): import tables from `src/db/schema`; apply migrations in a hook with
  `applyMigrations(pool)` from `src/db/commands/migrations`; the first build of `dems_demo` is
  `db:create`, then `db:migrate` under `/usr/bin/lockf -k .locks/db-migrate.lock`, then the seed.
- W21 (core services): register `BLOCKING_BOOT_CHECKS` with `app.readiness.addBootStep`; call
  `checkStoredChain` with the shared `verifyAuditChain` between B-7 and B-9;
  `DB_SCHEMA_VERSION` and `AUDIT_DETAIL_FORBIDDEN_KEYS` are exported from `src/db/schema`.
- W26 (engine host): section 10 of the output document.
- W29 (reset): `applyMigrations`, `assertLedgerCurrent`, `checkAuditProtection`, `checkOwnerRole`.
- Every row with database tests: `test/db/fixtures.ts` has one valid row per table and the append
  protocol with the shared code; a clone of `tpl_schema` costs about 40 ms.

---
*Generated: 2026-10-04 09:44 WIB*
