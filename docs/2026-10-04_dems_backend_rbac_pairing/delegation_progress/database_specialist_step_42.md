---
task_id: 2026-10-04_dems_backend_rbac_pairing
blueprint_row: 42
plan_row: W20
agent: database-specialist (tier R)
date: 2026-10-04
status: complete
artifact: implementation/20_db_mapping_seed.md
---

# Step 42 (W20): mapping module, seed program, first build of `dems_demo`

Times are WIB. No credential value appears in this file.

## Status

**complete** for everything the row owns. Two whole-project commands exit 1 in one test each that
belongs to rows running at the same time (the core-services row now registers the boot checks in
the app; a scaffold test and a migration-row test pinned the opposite). Every test of this row
passes in each of those runs. Detail: `implementation/20_db_mapping_seed.md` section 8.3.

## Milestones

| Time | What |
|---|---|
| 09:51 | Baseline: `unit` 31 files / 985 tests, `db` 19 files / 285 tests, both exit 0; PostgreSQL PID 19121; `pg_database` holds `postgres`, `template0`, `template1` |
| 09:56 to 10:07 | Mapping module written (`src/db/mapping`, 11 files); workspace typecheck exit 0 |
| 10:08 to 10:10 | Seed program written (`src/db/seed`); first seed of a private template passed unchanged; the hook of `tpl_seed` put in place at 10:10:28 |
| 10:12 to 10:25 | Tests: round trip (strict), rows and guards, change detection (model check), static guards, ST-1 to ST-6, clock rule, write-through as `dems_app`, command |
| 10:28:34 | **`dems_demo` built** under `.locks/db-migrate.lock`: `db:create`, `db:migrate`, `db:seed`, `db:status`, each exit 0; 301 rows in 21 of 30 tables; seed 80 ms |
| 10:28:46 | Second run of the four commands: 0, 0, **1 (already seeded, nothing written)**, 0 |
| 10:29:33 | `dems_demo` read as `dems_app`: B-2 to B-9 pass, B-8 `digests: ok` over 82 rows, rehydration equals `createIdleState(now = seeded_at)` |
| 10:36 | Two helpers split out of the diff (`newAuditRows`, `newEvents`) for a writer that takes shared rows; the seed path untouched |
| 10:37:44 | Row command exit 0: 4 files, 58 tests. Unit tests of the two folders: 6 files, 169 tests |
| 10:38:24 | End state: `dems_demo` owned by `dems_owner`; 0 databases of this row's prefix; PID 19121 unchanged |

## Files created (all new; nothing else was edited)

`apps/core-server/src/db/mapping/`: `index.ts`, `slices.ts`, `rows.ts`, `to-rows.ts`,
`from-rows.ts`, `changes.ts`, `guards.ts`, `exports.ts`, `rbac.ts`, `health-snapshot.ts`,
`audit-verify.ts`; `__tests__/round-trip.test.ts`, `__tests__/to-rows.test.ts`,
`__tests__/changes.test.ts`, `__tests__/static.test.ts`.

`apps/core-server/src/db/seed/`: `seed.ts`, `dataset.ts`, `store.ts`, `cli.ts`, `index.ts`;
`__tests__/template-hook.seed.ts`, `__tests__/support.ts`, `__tests__/seed.db.test.ts`,
`__tests__/seed-clock.db.test.ts`, `__tests__/write-through.db.test.ts`,
`__tests__/cli.db.test.ts`, `__tests__/cli.test.ts`, `__tests__/seed-order.test.ts`.

Documents: `implementation/20_db_mapping_seed.md`, this file.

Host change (H-15): the database `dems_demo` in the project-local cluster on `127.0.0.1:4432`,
owner `dems_owner`, seeded as of 2026-10-04 10:28:35 WIB.

Not edited, on purpose: `masterplan/02_plan.md` (a shared file in a parallel run; the controller
updates the tracking row), `delegation_progress_report.md`, `status_tasks.md`,
`decisions/decisions.md`.

## Verification (quoted in the artifact)

| Check | Result |
|---|---|
| `DEMS_TEST_STEP=42 npm run test:db -w @dems/core-server -- src/db/seed src/db/mapping` | exit 0; 4 files, 58 tests (10:37:44) |
| `fromRows(toRows(state))` equals the durable slices | Yes, strictly; one asserted tolerance (`-0` becomes `0`) |
| Row counts of contract §9.4 | All 30 confirmed; 82 audit rows and 59 events confirmed by running; none corrected |
| `db:create`, `db:migrate`, `db:seed`, `db:status` for `dems_demo` | exit 0 each |
| `npm run typecheck -w @dems/core-server`; `npm run lint -w @dems/core-server` | exit 0; exit 0 |
| `npm run test -w @dems/core-server -- --maxWorkers=2` | exit 1: 1,275 of 1,276 (10:45:26); the one failure is `src/plugins/db/__tests__/db.test.ts > boot step B-1` (not this row) |
| Whole `db` project | exit 1: 377 of 378; the one failure is `test/db/boot-checks.db.test.ts > T-PV-3 ... every blocking check passes, in order` (not this row) |
| Seed dump and server log | 0 occurrences of the demo password and of the pairing code constant |
| Cleanup | No database of this row's prefix; PostgreSQL PID 19121 unchanged; no role created, no setting changed |

## Blockers

None for this row.

## Findings for the controller (F-n of the artifact, section 11)

1. All counts of contract §9.4 are confirmed by running (F-1).
2. A negative zero in a rounded clock offset is stored as zero by JSON columns; harmless, also for
   the audit hash, but a strict comparison of a rehydrated state sees it (F-2).
3. `ActiveSession.startTimeSource` and `.stopTimeSource` are absent, not null, until set (F-3).
4. A database seeded with a scenario is exactly the engine's start state for that scenario (F-4).
5. Every `npm run db:*` process run needs the sandbox bypass because of the `tsx` launcher's IPC
   pipe, also a call that opens no connection (F-6).
6. One `unit` and one `db` test of other rows are red since the core-services row registers the boot
   checks in the app (F-7).
7. The core-services row wrote a second mapping of audit rows and events (F-8).
8. An audit or log-bundle export without a reason cannot become a row of `exports` (F-9).

## Deviations from the plan and the contract

| ID | Deviation |
|---|---|
| CONTRACT-DEVIATION-1 | MR-2 for two members: NULL of the active session's two time sources is read back as "absent", because the shared code never sets them to null; otherwise the round trip would not be exact |
| CONTRACT-DEVIATION-2 | §9.5: the seed takes the chain lock as its first statement (AP-2, AP-7), not after the other tables; the table order is unchanged |
| Layout | The statements of the mapping (`store.ts`) are in `src/db/seed/`, because the mapping folder holds no database access |
| Scope added | Change detection (`diffSlices`), the health snapshot row, the export record derivation and the digest check for boot check B-8 are in the mapping module: they are the "mapping half" of HB-13 and of MR-6 to MR-8 |

`SCHEMA-GAP`: none.

## Decisions needed (DN-n of the artifact, section 12)

DN-1 accept CONTRACT-DEVIATION-1 and reword MR-2. DN-2 accept CONTRACT-DEVIATION-2. DN-3 accept
`-0` to `0` as the wire form and tell W26 and W53. DN-4 accept that the mapping refuses text and
numbers PostgreSQL cannot store exactly. DN-5 one mapping: the core-services row calls this row's
row builders, or the review records the two as equivalent. DN-6 the core-services row adapts the two
red tests. DN-7 contract C requires a reason for the audit and log-bundle exports. DN-8 `db:seed`
has no default database and no `--scenario`. DN-9 add the launcher reason to P10. DN-10 where the
statements of the mapping live. DN-11 the controller updates the tracking row of W20.

---
*Generated: 2026-10-04 10:47 WIB*
