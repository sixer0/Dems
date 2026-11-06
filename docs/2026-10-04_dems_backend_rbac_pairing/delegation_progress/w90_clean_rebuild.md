# W90 clean-state rebuild: progress (verifier)

Status: **complete**. PASS with one CAUTION for a ruling (F-1).
Report: `verification/03_clean_state_rebuild.md`. Assets: `verification/assets/03_*` (42 files).

## Timeline (2026-10-07 WIB)
- 05:29 Baseline captured (03_00). Old cluster: databases and log settings (03_01).
- 05:30:01 SU-1: all 5 hashes OK (03_02).
- 05:30:12 `pg:status` 0, `pg:stop` 0, `pg:remove-data` 0 (03_10 to 03_12).
- 05:30:17 `pg:status` 4 (no cluster, as documented), then `pg:init` 0, new PID 32434 (03_13, 03_14).
- 05:30:24 `pg:status` 0, `pg:start` 0 (no-op) (03_15, 03_16).
- 05:30:32 CPS1-9: terse, collector on, `log/postgresql-05.log` mode 600, 0 DETAIL lines (03_17).
- 05:30:38-45 `db:create`, `db:migrate`, `db:seed` and `db:status` each exit 0; counts equal W20's, 30/30 (03_20 to 03_23).
- 05:30:56 Server started; health ok (03_30, 03_31). State change: sign-in 200, sign-out 204 (03_33).
- 05:31-05:34 Checksums C0, A1, A2, B, C and B2/C2: 28/30 equal across the restart; `core_state.epoch` and `hardware_snapshot` telemetry differ (F-1).
- 05:34:22 lsof: 4432 and 4420 on 127.0.0.1 only (03_50). 05:34:33 `pg:status` 0, HA-1..HA-4 PASS, modes 700/600; databases afterwards: `dems_demo`, `postgres`, `template0`, `template1` (03_51 to 03_53).
- 05:34:57 Backend stopped; PostgreSQL left RUNNING on PID 32434 (03_60).
- 05:35 AC-B-92: the Live section holds the password literal on 0 lines; asset secret scan 0 hits (03_55).

## Blockers
None.

## Decisions / items for the controller
- F-1: rule on W90's checksum criterion. The `core_state.epoch` +1 at every start is required by E-23/D14.
- F-2: `adb reverse tcp:4420` is still set on emulator-5558 (also 5554→4421 and 5556→4422). Its app hit the new server with a stale credential. No database writes; nothing was touched.
- F-3: the first server start after a seed adds 1 audit row and 1 event (83/60).
- F-4: `STATEMENT:` lines remain in the collector file under terse logging (no secret found).
- Disclosed: one exploratory grep printed the published demo password to my console only (no file).
