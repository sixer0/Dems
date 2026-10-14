# Row RD1 (wave 12, agent RD1) - retiring a capture device in the database

Status: **complete** for the schema step (the fence pair: see the last line). Record: `implementation/rd1_schema_retirement.md`.

- ONE schema step: version 14 -> 15, `dbc-15` -> `dbc-16`, migration set 16 = `0032_capture_device_retirement.sql` (generated, 10 statements) + `0033_capture_device_retirement_privileges.sql` (hand-written, 12 statements). 34 files, 19 hand-written. Next free number 0034.
- Columns: `capture_devices.retired_at` bigint NULL, `capture_devices.retired_by` text NULL FK operators RESTRICT; `capture_audio_inputs.retired_at` bigint NULL (the mirror). CHECKs `capture_devices_retired_check` (both or neither) and `capture_devices_retired_kind_check` (never a POE row).
- `capture_devices_onvif_uuid_key` and `capture_audio_inputs_card_input_key` (was a constraint) are partial unique indexes on rows in service, names kept.
- Guard `dems_capture_retired_row_guard()` on both tables (BEFORE UPDATE, ENABLE ALWAYS): a retired row changes only `last_seen_at` / `enabled`; never un-retired; SQLSTATE `ZD001`, every role.
- `dems_capture_credential_destroy(text) -> integer` (owner, SECURITY DEFINER): deletes the credential of an ALREADY RETIRED device only; EXECUTE for `dems_app`; still no DELETE grant.
- Totals: 501 columns, 233 CHECKs, 49 FKs, 15 uniques, 8 unique indexes, 9 functions, 5 triggers.
- Pins: `[14, 'dbc-15']` -> `[15, 'dbc-16']` in 18 files (17 tests + meta.ts); file count 32 -> 34; inventory, catalog, privileges, constraints, bulk-fixture counts; one `ALLOWED` entry in `test/static/search-path.test.ts`.
- kept-tables.ts: checked, not edited - the carry reads every typed column; a retired camera and microphone cross a reset text for text (M16S-8). Design hypothesis confirmed.
- Compile fixes (driver decision): `rows.ts` `captureDevicesToRows` and 7 literals of `fixtures/pipeline.ts` state `retiredAt: null, retiredBy: null`.
- Checks: drift probe `No schema changes`; `set16.db.test.ts` 38 passed (from empty AND from 14 to 15 measured, rollback and undo measured); `test/db` 23 files (3 pins fixed, re-run 50 passed); batch A 15/18 files green (reds not schema: RD2's audit type, capture boot); connect + sound-card routes 1 red not schema (row 88); static rules 13 passed; unit `src/db test/db test/static` 965 passed + 2 mine fixed; typecheck 1 error not mine (`real.test.ts:134`); oxlint exit 0. 8 mutants all seen RED.
- Requests: 4 lines "row RD1" in `file_requests.md` (pin text; the retire unit for RD3; RD2's bulk-fixture row; reds of row 88 / NB).
- Driver decisions: 9, listed in section 10 of the record.
- Edit tool only for existing files: kept. Nothing committed, nothing staged. No `db:migrate` on the demo, a lane or `dems_test_m12_row232`.
- Fence pair (`fence.db.test.ts`, `development-session.db.test.ts`, both locks): PENDING the heavy-host lock (another session's worker e2e run held it).
