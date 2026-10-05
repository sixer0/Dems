---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: coder-execution (tier R)
blueprint_row: 43 (plan W21, core services)
date: 2026-10-04
status: complete
evidence_tier: 3
---

# coder-execution progress: step 43 (W21, core services)

Status: **complete** (11:09 WIB). The server clock, the serial unit-of-work queue with its
transaction helper, the audit writer on the append protocol, the event writer and the registration
of the boot checks are built in `apps/core-server/src/core/` and tested. The row's command exits 0
(4 files, 39 tests); the whole `unit` project (41 files, 1,281 tests) and the whole `db` project
(27 files, 382 tests) of `@dems/core-server` exit 0; workspace typecheck and lint exit 0. The
controller's note of 10:50 (one mapping; two tests of other rows; the seed facts) is applied.

Full record: `implementation/21_core_services.md` (21 sections). No credential appears in either
document.

## Milestones (WIB)

| Time | What |
|---|---|
| 09:59 | Baselines taken: `unit` 31 files / 985 tests, `db` 19 files / 285 tests. Pre-images saved under `.cache/rollback/W21.*` |
| 10:14 | Clock, queue, unit of work, two writers, boot-check registration written; typecheck exit 0; the stub assertions removed from `readiness.test.ts` (3 lines, standing rule of D52) |
| 10:20 | First run of the 50-writer tests against PostgreSQL: pass |
| 10:31 | The registration of the boot checks makes one test of the scaffold and one of the migration row red (by design, D40): reported as found |
| 10:37 | Row command green with 36 tests; log capture, watchdog, shutdown, boot checks on broken clones |
| 10:45 | Mutation check on a copy outside the repository; an outage is announced once |
| 10:50 | Controller's note received |
| 10:56 | Note applied: the writers and B-8 use `src/db/mapping`; the two tests adapted; a test file on the seed template added |
| 11:00 | Final runs: row command exit 0; whole `db` exit 0; whole `unit` exit 0 (11:02) |
| 11:01 | End state: no database of this row, PostgreSQL PID 19121 and start time unchanged |

## Files created or updated

Created, all under `apps/core-server/src/core/`:

- `types.ts`, `limits.ts`, `clock.ts`, `errors.ts`, `pipeline.ts`, `unit-of-work.ts`,
  `audit-writer.ts`, `event-writer.ts`, `payload-rules.ts`, `audit-details.ts`, `boot-checks.ts`
- `__tests__/support.ts` (test support, not a test file)
- `__tests__/pipeline.test.ts` (39), `__tests__/writers.test.ts` (51),
  `__tests__/core-plugin.test.ts` (14), `__tests__/static.test.ts` (9): project `unit`
- `__tests__/audit-chain.db.test.ts` (12), `__tests__/unit-of-work.db.test.ts` (19),
  `__tests__/boot-checks.db.test.ts` (6), `__tests__/seeded.db.test.ts` (2): project `db`

Replaced: `apps/core-server/src/core/index.ts` (the scaffold's stub; its exports are kept).

Updated, by-design changes to existing tests (every line in `21_core_services.md` section 13):

- `apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts`: three assertion lines
  deleted (old lines 252 to 254). By the brief (D52).
- `apps/core-server/src/plugins/db/__tests__/db.test.ts`: the test "boot step B-1 > passes when the
  database answers and sets the flag" (old lines 225 and 226). By the controller's note.
- `apps/core-server/test/db/boot-checks.db.test.ts`: block "T-PV-3" (old lines 287, 307 to 309,
  350). By the controller's note.

Outside the repository's tracked tree: `.cache/rollback/W21.pre.patch` (empty),
`W21.core-index.ts.pre`, `W21.readiness.test.ts.pre`, `W21.db.test.ts.pre`,
`W21.boot-checks.db.test.ts.pre`.

Documents: `implementation/21_core_services.md`; this file. Not written (parallel run):
`delegation_progress_report.md`, `status_tasks.md`, `decisions/decisions.md`,
`masterplan/02_plan.md`, `implementation/99_implementation_report.md`.

## The controller's note of 10:50, point by point

1. **One mapping.** Now imported from `src/db/mapping`: `auditRowToRow` (`audit-writer.ts`),
   `eventToRow` (`event-writer.ts`), `verifyStoredAuditRows` (`boot-checks.ts`, for B-8),
   `isStorableText` (`payload-rules.ts`). Deleted here: the binding of the 14 audit columns and of
   the 10 event columns, the call of the shared `eventCategory`, `sharedAuditRowOf`,
   `verifyStoredDigests`, the safe-integer checks. The INSERTs go through the typed tables of the
   schema with the mapped row. Still held locally, with the reason for each, and the one thing the
   mapping module lacks (a statement that takes n event numbers from the stored counter, AT-5):
   `21_core_services.md` section 9. Nothing under `src/db/mapping/**` or `src/db/seed/**` was
   edited.
2. **The two red tests.** Adapted as recorded by-design changes; only what the registration of the
   boot checks made untrue was changed; each test keeps its intent. The readiness assertions were
   already removed.
3. **The seed facts.** No test of this row connects to `dems_demo`. One test file clones the seed
   template: the nine boot checks pass on it, B-8 verifies the 82 seeded rows, and the writers
   append row 83 and event 60 without a gap.

## Findings (for the controller to record)

| ID | Finding |
|---|---|
| F-2 | The query builder wraps a driver error in one whose message quotes the statement and its parameters. The writers hand on the driver's error; a module that uses `unit.db` must not log `error.message` |
| F-3 | The query builder names tables without their schema, the temporary schema is searched first, and the runtime role may create temporary tables. A unit refuses `CREATE`; outside a unit nothing does. For the security review |
| F-4 | The check AP-6 and an insert into `audit_log` and `events` exist a second time in `src/db/seed/store.ts`, for the owner-role programs. At run time the unit refuses that path for the two tables |
| F-5 | A test of the request-guards row replaces the seam `auditWriter` with a stand-in that returns nothing, so the seam keeps the scaffold's signature; the row is returned by `unit.audit.append` |
| F-6 | A COMMIT under way when the watchdog fires has an outcome the process does not know (log line with `phase: closing`). Not produced in a test |
| F-7 | Load average 21.99 at 10:40 (guard of P9: 10). This row's tests passed 5 of 5 then. One file of the helper row (`cleanup.db.test.ts`) failed once as a whole in a whole-project run at 10:45 and passed alone and in every later run; cause not captured |
| F-8 | Root typecheck red in files of other rows (mobile `dev-probes.ts`; shared `api-registry.test.ts`, `client-types.test.ts`). Workspace typecheck exit 0 |
| F-9 | The engine's ring does not know the rows server-native units append: the engine host merges them through `pipeline.onCommit`. A divergence is detected (503), never stored |
| F-10 | A database-free test whose handler runs a unit needs a pool with `connect()`: `standInDatabase()` of `src/core/__tests__/support.ts` |
| F-12 | `decisions/decisions.md` held no entry D62 at 10:50 |

F-1, F-11 and F-13 are in the main document.

## Deviations from the row text

| ID | Deviation |
|---|---|
| DV-1 | `app.auditWriter.append` returns nothing by its type (F-5); the appended row comes from `unit.audit.append` |
| DV-2 | The unit's opening sequence has a third statement (the statement time limit of the transaction), and `BEGIN` names the isolation level |
| DV-3 | The audit INSERT is the query builder's statement for the typed table, not the literal text of contract §6.4: same columns, same order, bind parameters, one per row |
| DV-4 | Three test files of other rows edited (one by the brief, two by the controller's note) |
| DV-5 | One database test file uses the seed template besides the schema template |
| DV-7 | A test-support module is offered to other rows |
| DV-8 | `Pipeline` has `onCommit`, `snapshot` and `close` beyond the scaffold's sketch |

## Decisions needed

| ID | Question | Recommendation |
|---|---|---|
| DN-1 | Queue limits: 256 waiting, 5,000 ms a unit, 6,000 ms to close (the specification is silent) | Accept |
| DN-2 | Should the seam `auditWriter.append` return the row? | Keep; otherwise one line of `throttle.test.ts:428` by its owner |
| DN-3 | Keep the raise of the event counter after prepared events? | Keep |
| DN-4 | F-3 | To the backend security review (W45): accept with the unit's refusal of `CREATE`, or revoke `TEMPORARY` from `PUBLIC` in a migration slot, or a static guard |
| DN-5 | The one thing the mapping module lacks for the writers | A store function that takes n event numbers (AT-5), if wanted |
| DN-6 to DN-9 | Notes to pass to W24, W28, W32, W33, W41 (how a handler uses a unit), W26 (the engine host's recipe), W29 and W43 (the reset: stop the producers, drain, close the pool), W39 (B-8's report is logged, not kept) | Add to their briefs: `21_core_services.md` sections 4 and 17 |
| DN-10 | The allow-list of the nine server-written audit types is closed | A module that needs another key asks for it |
| DN-11 | F-6 | Accept as residual |

## Blockers

None.

---
*Generated: 2026-10-04 11:09 WIB*
