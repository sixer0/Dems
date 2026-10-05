---
task_id: 2026-10-04_dems_backend_rbac_pairing
step: 61
plan_row: W39
agent: coder-execution
date: 2026-10-04
status: complete
output_document: implementation/39_module_security_audit.md
---

# Step 61 (W39): security-audit module, operations 58 to 63 — progress

Status at 16:43 WIB: **complete**. The output document is
`implementation/39_module_security_audit.md` (Tier 3). All times WIB, 2026-10-04.

## Result in one table

| Item | Result |
|---|---|
| Row tests | `unit` 5 files / 196 tests, exit 0 (16:32:58); `db` 6 files / 126 tests, exit 0, 0 databases remain (16:33:22) |
| Whole projects | `unit` 134 files / 3,503 tests, exit 0 (16:33:42 to 16:34:35); `db` 105 files / 1,513 tests, exit 0 (16:34:41 to 16:38:20), forced drops retried 0 |
| Typecheck, lint | Typecheck exit 0 (16:39:46). Lint exit 0; no warning under this module; three warnings under `src/realtime` (another row, in flight) |
| MODG | Route list equals registry operations 58 to 63 (printed); every documented status the module can produce has a test; every answer validates against the contract |
| Paging proof | Bulk template, ascending: 5,012 rows at the start, 35 appended during the walk, 26 pages of 200 returned sequences 1..5047 each once. Descending: 5047..1 each once while 40 were appended |
| Export without a reason | 422 `INVALID_REASON`, seven bodies on each of the two operations; nothing stored |
| Lineage | After two resets: both rows, newest first, `lineageTotal` 2. Bulk: 20 of 25, `lineageTotal` 25 |
| Incremental stored check | After k appended rows the call reads exactly k audit rows (query spy; k = 1, 4, 9, 7, 1, 0). Two concurrent calls: 1 run. Ten: 1 run |
| Full verification | 5,004 stored rows: the whole call 35 ms (quiet host) to 61 ms (loaded); not bounded (decision DN-1) |
| Mutation check | 99 of 99 detected (97 in the first pass); a transform in a scratch runner configuration, no file of the tree changed (rule M15) |
| End state | 0 databases with the prefix `dems_test_step_61_`; `.locks/postgres.pid` 19121 (16:39:23) |

## Milestones

| Time | What |
|---|---|
| 15:35 to 15:45 | Inputs read: gate report M1 to M15, blueprint row 61 and P1 to P25, spec §7.1 to §7.3, §7.13, §7.17, §7.18, §11, database contract §4.12 to §4.14, §4.20, §4.30, §6, the contract file `security-audit.ts`, contract C §3, the core services §3 and DN-9, the engine host §3, §10, §11, §18, the guard §6 and §8, the reset routine §11, the bulk fixture §6 and §15, the evidence module (approach) |
| 15:46 | Pre-image of the stub saved: `.cache/rollback/W39/src/modules/security-audit/index.ts` (SHA-256 `e1a3646b…ad3d`) |
| 15:48 | The foundation fix round's `app.db.read(…)` seen in `src/plugins/db/index.ts`: the module's reads use it |
| 15:50 | Five production files written; typecheck and lint exit 0 |
| 15:53 to 15:56 | Unit tests: cursor, export body, the bookkeeping of the stored check (in-memory table) |
| 16:00 to 16:09 | Database tests green: reads (seed), chain (seed; query spy, concurrent calls, tamper, epoch), exports, reset (the routine twice), bulk (paging proof, full verification measured) |
| 16:11 to 16:17 | Routes test (MODG) and static guard of the folder green; production code final (16:17:36) |
| 16:19 to 16:31 | Mutation check, first pass: 97 of 99 |
| 16:32 | One unit test added (an empty table under a verified position), one mutant's text corrected; second pass: both detected. Round-trip measurement file added |
| 16:33 to 16:39 | Final runs: own files verbose, both whole projects, typecheck, lint, end state |
| 16:43 | Document and assets written |

## Files created or updated

Created (production, under `apps/core-server/src/modules/security-audit/`): `cursor.ts`,
`export-request.ts`, `reads.ts`, `stored-chain.ts`. Replaced: `index.ts` (the stub of W08; the
export `securityAuditModule` kept).

Created (tests, under `apps/core-server/src/modules/security-audit/__tests__/`): `cursor.test.ts`,
`export-request.test.ts`, `stored-chain.test.ts`, `routes.test.ts`, `static.test.ts`,
`reads.db.test.ts`, `chain.db.test.ts`, `exports.db.test.ts`, `reset.db.test.ts`,
`bulk.db.test.ts`, `roundtrips.db.test.ts`, and the support file `support.ts`.

Created (documents): `implementation/39_module_security_audit.md`; this file; under
`implementation/assets/`: `39_test_unit_verbose.txt`, `39_test_db_verbose.txt`,
`39_final_runs.log`, `39_mutation_harness.vitest.config.mjs.txt`,
`39_mutation_harness.run.sh.txt`, `39_mutations.json`, `39_mutations.log`,
`39_end_state.mts.txt`, `39_end_state.txt`.

Created outside the tracked tree: `.cache/rollback/W39/src/modules/security-audit/index.ts` (the
pre-image).

Not written: `delegation_progress_report.md`, `status_tasks.md`, `decisions/decisions.md`,
`masterplan/02_plan.md` (parallel run). No file of another row, the contract, the schema, the
mapping, the core, the engine or a plugin.

## Findings (document section 18)

| ID | Finding |
|---|---|
| F-1 / `SIM-GAP-W39-1` | The simulator's `AUDIT_EXPORTED` row counts its ring (`details.rows`, the message): 1,000 on a chain of 5,200. The answer of the operation is right (the row's sequence minus one) |
| F-2 | `verifyStoredAuditRows` returns the first bad sequence only inside a text; this module reads it with one expression, and a test pins the format |
| F-3 | The one stored-chain check reads only "the newest n rows": a full verification cannot be done in bounded pieces |
| F-4 | The view of operation 60 is a unit of work per call (chain lock, operators mirror), not shared between calls |
| F-5 | `checkStoredChain` sends its LN-3 lookups at every pass |
| F-6 | The bulk fixture's digest changed three times while the row ran (another row's change under `src/db/fixtures`); the bulk tests passed on all three |
| F-7 | A stored break seen through the route with a running engine was not run (a foreign writer makes the engine reload) |
| F-8 | A reset re-stamps the seed history: a cursor on a seed row is invalid after it too |
| F-9 | `app.db.read` turns readiness off after a failed read: the next request is answered by stage 2 |
| `CONTRACT-GAP-W39-1` | The 422 text of the list reads does not say that a reset invalidates a cursor (text proposed) |
| `CONTRACT-GAP-W39-2` | `AuditExportAccepted.rows` / `.head`: the descriptions do not say which rows (text proposed) |
| `CONTRACT-GAP-W39-3` | The comment of `LIST_CURSOR_PATTERN` (a sentence proposed) |

## Deviations (document section 19)

DV-1 the remembered row is looked up with one statement that returns a truth value, beside the k
rows; DV-2 the full verification is not bounded and cannot be with the one implementation; DV-3
reads through `app.db.read`; DV-4 the export body is validated in the handler; DV-5 a test-only
export `securityAuditControl(app)`.

## Decisions needed (document section 20)

DN-1 a range option on `checkStoredChain` (accept as built for the demo); DN-2 `SIM-GAP-W39-1`;
DN-3 structured members on the digest verdict; DN-4 the cursor names its row, so a reset
invalidates it; DN-5 `rows` of an export's answer is the stored count; DN-6 the view as a unit per
call, to the security review; DN-7 a remembered break is not re-checked until a new chain.

## Other rows' reds seen (P11; document section 13.4)

Typecheck red at 15:59 (`src/realtime/messages.ts`), 16:13 (`src/db/fixtures/identity.ts`),
16:38:31 and 16:38:53 (`src/realtime/__tests__/first-contact.db.test.ts`,
`packages/shared/src/realtime/*`); green at 16:39:46. Lint warnings under `src/realtime` at every
run from 16:13. No test of any row failed in the two whole-project runs.
