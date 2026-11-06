# database-specialist - migration 0013 (schema 6 / dbc-7)

Status: **needs-review** (2026-10-10). Note: `implementation/107_migration_0013.md`. Contract:
`masterplan/04_database_contract.md` section N.18, erratum PE-0013-01. No commit.

## Done

- Migration set 7: `0013_key_id_fault_reason_media_root.sql` (generated) +
  `0014_key_id_fault_reason_media_root_privileges.sql` (hand-written, the version row). Schema
  version 6, contract `dbc-7`. 43 tables, 440 columns, 182 CHECKs, 13 kept tables, 15 files.
- Consumer 1: operation 85 with the product key stores its revision; V-11 PASS.
- Consumer 2: the fault key (kind, reason, device) from the worker frame to the stored alert and
  back across a restart; one fault at a time for the capture as a whole.
- Consumer 3: the Core records its media store root at boot; `db:reset` reads it, prints it,
  refuses by name without it; the removal of a permitted reset below a configured root is tested.
- Every pin of the version and the counts moved by delta (list: note section 3).

## Files

New: `apps/core-server/src/db/migrations/{0013_key_id_fault_reason_media_root.sql,0014_key_id_fault_reason_media_root_privileges.sql,meta/0013_snapshot.json,meta/0014_snapshot.json}`,
`apps/core-server/src/db/commands/media-store-root.ts`,
`apps/core-server/test/db/{set7.db.test.ts,contract-v6-delta.ts}`,
`apps/core-server/src/db/mapping/__tests__/fault-key.db.test.ts`,
`apps/core-server/src/db/reset/__tests__/store-root.db.test.ts`,
`packages/shared/test/sim-fault-key.test.ts`.

Changed, product: `apps/core-server/src/db/schema/{checks,transcript,core,meta,index}.ts`,
`db/migrations/meta/_journal.json`, `db/commands/migrations.ts`, `db/store/store.ts`,
`db/mapping/{rows,index}.ts`, `db/fixtures/{minimums,validate,report,build,world,load}.ts`,
`db/reset/{kept-tables,errors,routine,cli}.ts`, `plugins/db/index.ts`,
`modules/transcripts/routes.ts` (comments), `capture/forwarder.ts`, `engine/write-plan.ts`;
`packages/shared/src/sim/{types,derive,faults,capture-telemetry}.ts`,
`packages/shared/src/api/state-slices.ts`, `packages/shared/openapi/openapi.json` (generator).

Changed, tests and pins: note section 3.

## Results

Whole db project once: 2,311 of 2,335 passed, 19 failed (17 mine, fixed and re-run green; 2 foreign);
after the fix 3 db cases stay red, none mine. Whole unit project once: 5,896 of 5,904, 8 failed
(7 mine, fixed; 1 foreign). Shared 2,395 of 2,395. Typecheck and lint of core-server and shared clean.

## Open for the controller

- Reds not mine: `test/db/device-upsert.db.test.ts` (pass D4 / D1b), `integration-d1b.db.test.ts`
  (pass D11 item 1), `test/acceptance/restart.test.ts` long-history case (pass D11 item 2),
  unit adapters static A-5 (held since row 65).
- Decisions D-0013-1..7 (note section 6); the edit of the closed `capture/forwarder.ts` among them.
- The four standing databases are NOT migrated: commands in note section 7.
