# Row 51b - the element CHECK on `capture_devices.profiles` (AD-06 (4)) - batch 9, agent R6

- Status: needs-review (built and green; one stated limit, four driver decisions). Record: `implementation/051b_profiles_check.md`.
- Migrations: `0021_profile_codes_data` (hand-written DATA STEP, runs first), `0022_profile_codes` (generated, the CHECK), `0023_profile_codes_privileges` (hand-written, the version step alone). Journal idx 21, 22, 23.
- Version: `[9, 'dbc-10']` -> `[10, 'dbc-11']`. Migration files 21 -> 24. Named CHECKs 217 -> 218. Nothing else moves.
- Data step, on the throw-away database seeded with the old form: 5 of 10 device rows changed (each to `[]`, no other column); the 5 others, the stream rows and the selector untouched; 0 rows on a database without the old form. An undo does NOT bring an emptied list back.
- Stated limit: the CHECK holds the form, not the origin - a camera token of the code form (`PROFILE_1`) passes and is not emptied. Bounded by the adapter's refusal of a code without a stream row. A wider data step is written in the record, not built.
- Checks: drift probe `No schema changes`; typecheck exit 0; `test/db` database project `18 files, 764 tests passed`; database-free `47 files, 933 passed`; outside files `9 files, 157 passed`, `10 files, 136 passed`, `9 of 10 files` then the tenth alone `7 passed` (port 8557 shared by two files of another agent).
- NOT run: anything on the demo or a lane database (C29). The record gives the read-only statement that names the rows the step will change there.
- Kept-table notes of rows 51 and 99: not served (`src/db/reset/kept-tables.ts` is reset code, not a schema-side file); they stay requests.
- Staging: `.cache/task4-r6/step2.patch`, applied after `step1.patch`; proven on a temporary index.
- Edit-only: kept. Generator-written: `0022_*.sql` with its snapshot, the three journal entries, the two stubs before their content was edited; `contract-inventory.json` by its own command.
