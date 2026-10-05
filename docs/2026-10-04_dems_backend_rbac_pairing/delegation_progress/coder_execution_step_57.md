---
task_id: 2026-10-04_dems_backend_rbac_pairing
step: 57
plan_row: W35
agent: coder-execution
date: 2026-10-04
status: complete
output_document: implementation/35_module_evidence.md
---

# Step 57 (W35): evidence module, operations 39 to 43 — progress

Status at 15:30 WIB: **complete**. The output document is
`implementation/35_module_evidence.md` (Tier 3). All times WIB, 2026-10-04.

## Result in one table

| Item | Result |
|---|---|
| Row tests | `unit` 5 files / 142 tests, exit 0 (15:25:42); `db` 6 files / 89 tests, exit 0, 0 databases remain (15:20:27) |
| Whole projects | `unit` 102 files / 2,660 tests, exit 0 (15:26:29 to 15:27:10); `db` 75 files / 1,081 tests, exit 0 (15:22:15 to 15:24:59), forced drops retried 0 |
| Typecheck, lint | Exit 0; exit 0 with no warning (15:25) |
| MODG | Route list equals registry operations 39 to 43 (printed); every documented status has a test; every answer validates against the contract |
| AC-B-69 | The SHA-256 of the item's stored sealed rows is equal before and after each of verify, tamper fault, failed verify, clearing, export, archive: five dataset items, one engine-sealed item; all 65 sealed rows of the seed and all 2,575 of the bulk template unchanged |
| Denied export | 403 `FORBIDDEN`, exactly one `EXPORT_DENIED` row, the guard's; 0 hosted commands run |
| AC-B-70 | Every track list is VIDEO-01, VIDEO-02, AUDIO-01, AUDIO-02: 13 and 515 items, detail reads, verdicts |
| Mutation check | 56 of 56 detected; a transform in a scratch runner configuration, no file of the tree changed (rule M15) |
| End state | 0 databases with the prefix `dems_test_step_57_`; `.locks/postgres.pid` 19121 |

## Milestones

| Time | What |
|---|---|
| 14:19 | Inputs read: gate report M1 to M13, blueprint row 57 and P1 to P25, spec §7.2, §7.3, §7.9, §7.17, §11, §12.3, the engine host §3 and §18, the guard §6 and §8, the mapping §3, the bulk fixture §15, contract C |
| 14:26 | Pre-image of the stub saved: `.cache/rollback/W35/src/modules/evidence/index.ts` |
| 14:30 | Five production files written |
| 14:33 | Rule M10 report sent to the controller (the guard row's tests pinned the registered routes) |
| 14:42 | Unit tests and static guard green |
| 14:45 to 14:56 | Database tests green: reads, commands, immutability, bulk, edge |
| 14:58 to 15:20 | Mutation check: 56 of 56 |
| 15:20 | Three tests of consistency (one snapshot per read; commands that arrive together) and a device session added; all green |
| 15:21 to 15:27 | Final runs: typecheck, lint, both whole projects, end state |
| 15:30 | Document and assets written |

## Controller notes received, and what was done

| Decision | Note | Done |
|---|---|---|
| D84 | Gap IDs are named with the row | `CONTRACT-GAP-W35-1`, `CONTRACT-GAP-W35-2` (document section 17; markers in `commands.db.test.ts`) |
| D85 | The guard row's test files are fixed by their owner; no module row edits them | Nothing of that row was edited; its files are green in the final runs |
| D87 | Rule M14 (an error is logged only as `{ err }`); the foundation fix round | The folder's one log call hands the logger a code and an operation ID, no error object; `reads.db.test.ts` fails a real statement whose bind parameter is the search text and scans the log and the persistent error log |
| D88 | Rule M15 (a mutation check never changes a file of the tree); whole-project runs only when needed | Met by construction (a transform outside the repository); the whole projects were run once at the end (the `unit` project twice: once more after the last edit of a test file) |

## Files created or updated

Created (production): `apps/core-server/src/modules/evidence/cursor.ts`, `export-request.ts`,
`media.ts`, `reads.ts`. Replaced: `apps/core-server/src/modules/evidence/index.ts` (the stub of
W08; the export `evidenceModule` kept).

Created (tests, under `apps/core-server/src/modules/evidence/__tests__/`): `cursor.test.ts`,
`export-request.test.ts`, `media.test.ts`, `routes.test.ts`, `static.test.ts`,
`reads.db.test.ts`, `commands.db.test.ts`, `immutability.db.test.ts`, `bulk.db.test.ts`,
`edge.db.test.ts`, `consistency.db.test.ts`, `support.ts`.

Created (documents): `implementation/35_module_evidence.md`; `implementation/assets/35_test_unit_verbose.txt`,
`35_test_db_verbose.txt`, `35_final_runs.log`, `35_mutations.json`, `35_mutations.log`,
`35_mutation_harness.vitest.config.mjs.txt`, `35_mutation_harness.run.sh.txt`,
`35_end_state.mts.txt`; this file. Pre-image: `.cache/rollback/W35/src/modules/evidence/index.ts`.

Not written (parallel run, P8): `delegation_progress_report.md`, `status_tasks.md`,
`decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md`.

## For the controller

Findings, deviations and decisions are in the document, sections 17, 18 and 19. The ones that
need a ruling or a hand-over:

- DN-1: the two reads answer from PostgreSQL in one read-only snapshot (the contract's own text
  and the database contract's indexes); equality with the engine's slice is tested on both
  templates.
- DN-2: the export's two 422 answers sit at two places of the precedence table: `INVALID_INPUT`
  for a body that breaks the schema before the engine; `INVALID_REASON` for a missing or
  too-short reason after the 404 and the 409, decided by the hosted action, which is handed an
  empty reason and never the refused text.
- DN-5: the search folds with PostgreSQL 18's built-in collation `pg_unicode_fast`, because the
  cluster's locale `C` folds ASCII only.
- DN-9: `CONTRACT-GAP-W35-1` (the 409 example of `archiveEvidence` lacks `from` and `event`) and
  `CONTRACT-GAP-W35-2` (the 422 text and example of `exportEvidence` name `INVALID_REASON` only)
  to W83.
- DN-10, DN-11, DN-12: hand-overs to W47 (no denied cell for operations 39 to 41 with seeded
  data; a malformed ID on `exportEvidence` is 404), to the client rows (the tamper fault sets the
  verification back to NOT_RUN; an archived item answers `NOT_SEALED` to an export) and to the
  security review W45 (the simulator's own denial row when a role changes mid-request).
