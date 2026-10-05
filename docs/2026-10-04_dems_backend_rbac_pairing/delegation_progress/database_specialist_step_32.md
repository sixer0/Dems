# database-specialist, step 32 (plan row W10): early proof (c), drizzle-kit and drizzle-orm on PostgreSQL 18.4

| Field | Value |
|---|---|
| Step / row | 32 / W10 |
| Agent | database-specialist (tier R) |
| Status | **complete** (one delegated sub-check not run: the live statements as `dems_app`; see Deviations) |
| Result line | TD-03 / TD-04 drizzle route CONFIRMED on PostgreSQL 18.4; the fallback row Fc is not needed; no `0002a_extra_constraints` file is needed |
| Started | 2026-10-04 07:25:56 WIB (first tool timestamp) |
| Proof finished | 2026-10-04 07:36:36 WIB (scratch databases dropped, scans done): 11 of 45 minutes |
| Documents written | 2026-10-04 07:41 WIB |
| Write paths used | `.cache/proof-drizzle/**` (git-ignored); the output document; this file |
| Shared trackers | Not written (parallel run, P8): `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md` |
| Sandbox bypass | Every command that opened a database connection (`tsx .cache/proof-drizzle/run.ts ...`), per P10. `generate`, `check`, `tsc` and the file checks ran inside the sandbox |
| Database connections | Only as `dems_owner`, only to `127.0.0.1:4432`, only to `postgres` (create, drop, list) and to the two scratch databases. Nothing connected as `dems_admin` or as `dems_app`. The server on `*:5432` was never connected to |
| Credentials | `.data/pg.owner.env` parsed inside the script; no value printed, passed as an argument, copied or put in a config. `.data/pg.env` and `.data/pg.pwfile` were not read |
| Packages installed | None. No `package.json` or lockfile touched |
| Processes left running | None started in the background. PostgreSQL untouched and still answering |

## Files created or updated

| Path | Change |
|---|---|
| `docs/2026-10-04_dems_backend_rbac_pairing/implementation/10_proof_drizzle_kit.md` | Created: the output document (Tier 3) |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/database_specialist_step_32.md` | Created: this file |
| `.cache/proof-drizzle/schema.ts`, `schema_b/index.ts`, `schema_b/flat.ts` | Created: the scratch schema (6 probe tables) |
| `.cache/proof-drizzle/drizzle.config.ts`, `drizzle.b.config.ts`, `tsconfig.json` | Created: scratch configs |
| `.cache/proof-drizzle/run.ts` | Created: create, migrate, catalog, behave, drop, list |
| `.cache/proof-drizzle/custom/*.sql` (4 files) | Created: the hand-written SQL |
| `.cache/proof-drizzle/migrations/**` (5 files), `migrations_b/**` (13 files) | Written by `drizzle-kit`; the `--custom` files filled by this row |
| `.cache/proof-drizzle/out_*.txt` (9 files), `state.json` | Created: captured output |

No tracked file was changed by this row. Scratch databases created and dropped:
`dems_proof_drizzle_20261004003235_a`, `dems_proof_drizzle_20261004003453_b`.

## Milestones

| Time (WIB) | Milestone |
|---|---|
| 07:25 | Inputs read; versions confirmed (drizzle-kit 0.31.11, drizzle-orm 0.45.3, pg 8.23.1, TypeScript 6.0.3, Node 26.8.2) |
| 07:29 | `generate --name=probe` and `generate --custom --name=probe_guard`: `0000_probe.sql`, `0001_probe_guard.sql`, journal |
| 07:32 | Scratch database A; `migrate()` applied 2, second run applied 0; catalog 34 PASS; behaviour 37 PASS |
| 07:33 | Second `generate`: no change, same 5 file hashes |
| 07:34 | Layout B (the contract's order): custom prelude first, 6 tables, guards, privileges; a failing last file rolled back the whole set; then 5 applied, second run 0 |
| 07:35 | Catalog B 7 PASS; behaviour B 30 PASS; `drizzle-kit check` fine; `tsc --noEmit` exit 0 |
| 07:36 | Ordering and edited-file behaviour shown; both scratch databases dropped; `pg_database` shows none; credential scan 0 hits |

## Verification of the row (output quoted in the output document)

| Check | Result |
|---|---|
| `generate --name=probe`, `generate --custom --name=probe_guard`: files, names, order | PASS (section 3) |
| `migrate()` applies them in order as `dems_owner` | PASS (section 5) |
| The catalog shows the named CHECK, the partial unique index with its `WHERE`, the composite key, `bytea` and `jsonb` as declared | PASS, 34 of 34 (sections 4 and 6) |
| A second `migrate()` applies nothing | PASS (section 5) |
| A second `generate` writes no file | PASS (section 7) |
| Behaviour (23514, the partial unique index inside and outside its predicate, the trigger for the owner, `bytea`, `jsonb` and `bigint` round trips) | PASS, 37 of 37 (section 8) |
| As `dems_app` an UPDATE on the guarded table is refused | **NOT RUN** (catalog evidence only) |
| `tsc --noEmit` with TypeScript 6.0.3 and the server's strict settings | PASS, exit 0 (section 10) |
| The migrations table: `drizzle.__drizzle_migrations`, owner `dems_owner`, no right for `dems_app` | PASS (section 11) |
| The scratch databases are dropped | PASS: 0 rows `LIKE 'dems_proof_drizzle_%'`, checked twice (section 16) |
| No tracked file changed by this row | `git status --porcelain -- .cache` 0 lines; `git ls-files .cache` 0 |

## Blockers

None.

## Findings (for the controller to number)

1. **drizzle route confirmed.** No constraint name is rewritten, no partial index loses its `WHERE`, `--custom` works also as the first file of an empty folder, files apply in generation order, a second `migrate()` and a second `generate` do nothing. File names are `NNNN_<name>.sql` with a running four-digit index: the hypothesis of MG-3 holds.
2. **No built-in `bytea` in drizzle-orm 0.45.3.** The schema needs one `customType<{ data: Buffer; driverData: Buffer }>` returning `'bytea'`. Generated as `"bytea"` (quoted), accepted by PostgreSQL; values are `Buffer` both ways.
3. **The breakpoint marker is a plain text split.** `--> statement-breakpoint` inside a comment or a string cuts the file there. A hand-written file applies with or without markers.
4. **`migrate()` runs the whole pending set in one transaction.** A failure in the last file leaves nothing applied. The `id` column of the migrations table can have gaps.
5. **What is pending is decided by the journal time, not by the file hash or name.** A file whose journal `when` is older than the newest applied row is skipped without a message; an applied file edited afterwards is not noticed. MG-4 is therefore not enforced by the tool.
6. **Relative `schema` and `out` paths resolve against the process directory**, not the config file.
7. **The migrations table is `drizzle.__drizzle_migrations`**, outside `public`, owned by `dems_owner`; `dems_app` has no USAGE on the schema and no right on the table. N-1 ("everything lives in `public`") has this one exception.
8. **PostgreSQL 18.4 reports SQLSTATE 23001 for a delete refused by `ON DELETE RESTRICT`**, not 23503 (23503 remains for an unknown parent). Every foreign key of the contract is `RESTRICT`.
9. **drizzle-orm wraps driver errors**: `DrizzleQueryError`, with `code` and `constraint` on `error.cause`.
10. **`bigint` in `mode: 'number'`** returns a JavaScript number and is exact up to 2^53-1; a larger stored value is rounded without an error. Plain `pg` returns `bigint` as a string.
11. **The catalog stores normalised text**: unqualified columns, `= ANY (ARRAY[...])` for `IN (...)`, casts such as `'ACTIVE'::text`, no `ON UPDATE NO ACTION`. A catalog test must compare against that form.
12. **`SET ROLE dems_app` is refused for `dems_owner`** (42501), and `dems_owner` cannot create a role: a session as `dems_app` needs the runtime credential file.
13. Closed: AS-02, DA-03, GD-06, PG-08, the `drizzle-kit` part of F23. Observed on the probe, for W17 to mark: PG-02 (owner half), PG-03, PG-07, PG-11, PG-13 (in part), PG-15 (in part), PG-21 (first half), PG-22. Not closed here: PG-01, PG-04, PG-17.

## Deviations from the plan or the brief

| # | Deviation | Reason |
|---|---|---|
| 1 | The live check "as `dems_app` an UPDATE on the guarded table is refused" was **not run**; the privilege state is shown through `has_table_privilege` instead | The brief limits this row to connections as `dems_owner` and names only `.data/pg.owner.env`. From the owner session `SET ROLE dems_app` is refused. Reading `.data/pg.env` to open a second role's session was outside what the brief gave this row |
| 2 | A second layout (B) and a second scratch database were added | The contract's set starts with a hand-written file whose function a generated CHECK calls (8.2); the row's verification text names the opposite order. Both were proven |
| 3 | Three extra demonstrations: a failing last file, a pending file with an older journal time, an applied file edited afterwards | They show how `migrate()` decides what to apply, which W17, `db:status` and the reset routine rely on |
| 4 | `masterplan/02_plan.md` and `implementation/99_implementation_report.md` were not updated, although the agent's default workflow names them | Parallel run: shared files are written by the controller only (P8, CLAUDE.md 3.4) |
| 5 | `drizzle-kit` was run inside a subshell whose directory is the scratch folder | Relative config paths resolve against the process directory (finding 6). The session directory never changed |

## Decisions for the controller to record

| # | Decision needed | Proposal |
|---|---|---|
| 1 | Accept early proof (c) as PASS; Fc not scheduled | Accept |
| 2 | The live `dems_app` statements of this row | Leave them to W17 (T-AO-1, T-PV-1), whose helper reads the runtime file by design; or name a row that may open a `dems_app` session for the probe |
| 3 | Contract N-1: the migrations table sits in schema `drizzle` | Record the exception; keep the default schema and table name (a table in `public` would receive SELECT for `dems_app` from the grant on all tables) |
| 4 | MG-4 is not enforced by the tool (finding 5) | `db:status` (W17) compares the stored `hash` with the SHA-256 of each file and reports a difference |
| 5 | SQLSTATE 23001 (finding 8) and `error.cause` (finding 9) | Pass both to the rows that map database errors (W20 and the module rows) |
| 6 | The `bytea` custom type (finding 2) | W17 declares it once in the schema folder and every table file imports it |
| 7 | The scratch folder `.cache/proof-drizzle/` | Keep until W17 has read it; removal `rm -rf .cache/proof-drizzle` (R-NEW, H-17) |
