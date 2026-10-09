# database-specialist - row 129a (D99)

Status: **needs-review** (three points for the controller; all checks pass). 2026-10-09.

Report: `implementation/60a_r9_migration_credential_replace.md`.

## Files

Created
- `apps/core-server/src/db/migrations/0010_credential_replace_privileges.sql`
- `apps/core-server/src/db/migrations/meta/0010_snapshot.json` (tool output)
- `apps/core-server/test/db/set5.db.test.ts`
- `docs/2026-10-07_dems_real_capture_sealing/implementation/60a_r9_migration_credential_replace.md`
- this file

Edited
- `apps/core-server/src/db/migrations/meta/_journal.json` (idx 10, tool output)
- `apps/core-server/src/db/schema/meta.ts` (4 / `dbc-5`), `src/db/schema/index.ts` (comment), `src/db/commands/migrations.ts` (eleventh tag)
- `apps/core-server/test/db/{boot-checks.db,migrate.db,commands.db,set4.db,privileges.db}.test.ts`, `test/db/contract-inventory.test.ts`
- `apps/core-server/src/db/seed/__tests__/seed.db.test.ts`, `src/db/reset/__tests__/{m4-sec-reset,reset-failures}.db.test.ts`, `src/db/fixtures/__tests__/bulk-fixture.db.test.ts`
- `apps/core-server/src/modules/stt-config/__tests__/credential-store.db.test.ts` (row 84's file: the F-84-1 assertion + REPLACE case, and the `count(*)` line)
- `docs/.../masterplan/04_database_contract.md` (section N.7, erratum PE-129a-01)
- `docs/.../delegation_progress/file_requests.md` (one appended line)

Not edited: `0000`-`0009`; any lockfile; `status_tasks.md`; `delegation_progress_report.md`; `masterplan/02_plan.md` (it has no row 129a).

## Live databases

`dems_lane_1`, `dems_lane_2`, `dems_lane_3`, `dems_demo`: each 3 (dbc-4) -> 4 (dbc-5), `0010` applied, second run applied nothing, row counts unchanged.

## Open for the controller

1. Row 78's two version pins (`[3, 'dbc-4']` -> `[4, 'dbc-5']`), requested, red until moved.
2. F-129a-1: the `EXCLUDED` upsert stays 42501; rows 142 / 66 send bind parameters in SET.
3. Row 84's file: the `count(*)` assertion moved in addition to the one named in the brief.
