# database-specialist - row 129b (D109)

Status: **needs-review** (points for the controller below; every check of the row passes). 2026-10-09.

Report: `implementation/60b_m6_snapshot_column_and_mapping.md`.

## Files

Created
- `apps/core-server/src/db/migrations/0011_session_stt_config.sql`, `0012_session_stt_config_privileges.sql`, `meta/0011_snapshot.json`, `meta/0012_snapshot.json`
- `apps/core-server/test/db/set6.db.test.ts`, `test/db/contract-v5-delta.ts`
- `apps/core-server/src/db/mapping/__tests__/from-rows.test.ts`
- `docs/2026-10-07_dems_real_capture_sealing/implementation/60b_m6_snapshot_column_and_mapping.md`, this file

Edited (own paths)
- `apps/core-server/src/db/schema/{stt.ts,meta.ts,index.ts}`, `src/db/commands/migrations.ts`, `src/db/store/store.ts`, `src/db/migrations/meta/_journal.json`
- `apps/core-server/src/db/mapping/{rows.ts,index.ts}`, `src/db/mapping/__tests__/{to-rows,round-trip}.test.ts`
- `apps/core-server/src/db/fixtures/{minimums.ts,build.ts,report.ts,world.ts,load.ts}` (count and comments), `src/db/fixtures/__tests__/{build.test.ts,support.ts,bulk-fixture.db.test.ts}`
- `apps/core-server/src/db/seed/__tests__/{seed.db,cli,cli.db}.test.ts`, `src/db/reset/__tests__/{m4-sec-reset.db,reset-failures.db,reset.db,cli.db}.test.ts`
- `apps/core-server/test/db/{boot-checks.db,migrate.db,commands.db,commands,catalog.db,constraints.db,privileges.db,set4.db,set5.db,contract-inventory}.test.ts`, `test/db/{fixtures.ts,contract-inventory.ts,contract-inventory.json}`

Edited (other owners, Edit tool, smallest edit)
- `apps/core-server/test/support/seed.ts` (one count line)
- `apps/core-server/src/sealing/__tests__/stt-states.db.test.ts`, `src/modules/transcript-chunks/__tests__/transcript-chunks.db.test.ts`, `src/modules/transcripts/__tests__/transcripts.db.test.ts` (version pin, one line each)
- `apps/core-server/src/engine/__tests__/recording.db.test.ts`, `src/modules/demo/__tests__/reset.db.test.ts` (table-count pin, one line each)
- `apps/core-server/src/modules/capture-config/__tests__/capture-config.db.test.ts` (the named mic-order exclusion removed)
- `docs/.../masterplan/04_database_contract.md` (new section N.17, erratum PE-129b-01)
- `docs/.../delegation_progress/file_requests.md` (four appended lines)

Not edited: `0000`-`0010`; `packages/shared/**`; `src/transcription/**`; `src/modules/capture-config/routes.ts`; any lockfile; `status_tasks.md`; `delegation_progress_report.md`; `masterplan/02_plan.md` (it has no row 129b).

## Live databases

`dems_lane_1`, `dems_lane_2`, `dems_lane_3`, `dems_demo`: each 4 (dbc-5) -> 5 (dbc-6), `0011` + `0012` applied, second run applied nothing, the 41 existing row counts unchanged, `session_stt_config` 0 rows.

## Open for the controller

1. The snapshot is a TABLE (`session_stt_config`, INSERT-only), not a column; no `credential_ref` in it.
2. Row 115 to wire the two statements (report section 5).
3. Shared type / schema for `manifestVersion?` + `labelsStatus?` before rows 82 / 83 insert items (request filed, blocking them).
4. In-flight db tests of rows 116, 132, 133, 136, 142 with `[4, 'dbc-5']` need `[5, 'dbc-6']`.
5. Six red fixture tests from the 63 -> 67 audit types (row 132), not this row's.
