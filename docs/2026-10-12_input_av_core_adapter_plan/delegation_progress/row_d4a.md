# Row D4a (wave 12, agent D4a) - the network settings in the database

Status: **complete** for the schema step. Record: `implementation/d4a_network_config_schema.md`.

- ONE schema step: version 13 -> 14, `dbc-14` -> `dbc-15`, migration set 15 = `0030_network_config_onvif_ports.sql` (generated, 7 statements) + `0031_network_config_onvif_ports_privileges.sql` (hand-written: one grant, the version row). 32 files, 18 hand-written. Next free number 0032.
- Interface name: the table's pattern is now the alias helper's own, `^[A-Za-z0-9][A-Za-z0-9_.-]{0,14}$`, in both CHECKs that hold one (`capture_network_config`, `host_network_aliases`).
- Seventh setting: `capture_network_config.onvif_ports`, jsonb, NOT NULL, default `[80]`; `capture_network_config_onvif_ports_check` (a list of 1..8 whole numbers 1..65535) and `capture_network_config_onvif_ports_distinct_check` (no two equal); `GRANT UPDATE (onvif_ports)` to the runtime role.
- Totals: 48 tables, 498 columns (497), 231 CHECKs (229).
- Pins: `[13, 'dbc-14']` -> `[14, 'dbc-15']` in 18 files; file count 30 -> 32; columns and CHECKs in the catalog, privileges, constraints, inventory and bulk-fixture tests. New pin text in `file_requests.md`, line "row D4a".
- Checks: drift probe `No schema changes`; `test/db` `22 passed`, `998 passed`; batch A (pins, seed, reset, fixtures, the network module's database tests) `19 passed`, `234 passed`; batch B under both locks `4 passed`, `101 passed`; database-free `48 passed`, `964 passed`; typecheck 0 errors; lint clean. Apply, rollback and undo proven on throw-away databases (`set15.db.test.ts`, 66 tests).
- NOT built, by instruction: the network module, the rule's context, the contract of operations 101 / 102, `packages/shared`, the settings screen, the demo reset's kept-table handling. F-4 and S2-02 are not closed until the follow-up row.
- Red seen, not this row's: `src/capture/host-alias/__tests__/lifecycle.test.ts`, 8 cases (`HELPER_NOT_MARKED`), a file another row is writing.
- PostgreSQL: found stopped at the first attempt; NOT started by this row; the controller started it; all database checks ran after that. No `db:migrate` on any database.
- Driver decisions to confirm: at least one port; two CHECKs; distinctness in plain SQL; `80.0` counts as 80; the column's name; the undo refuses while a stored name has a capital; the set test reads the helper's pattern line.
- Edit tool only for existing files: kept. Nothing committed, nothing staged.
