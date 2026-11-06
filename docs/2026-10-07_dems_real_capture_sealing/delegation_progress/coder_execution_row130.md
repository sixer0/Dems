---
agent: coder-execution
blueprint_row: 130
date: 2026-10-09
status: complete
---

# coder-execution - row 130

Status: complete.

Files created:
- docs/2026-10-07_dems_real_capture_sealing/implementation/61_r9_lane_migration.md
- docs/2026-10-07_dems_real_capture_sealing/delegation_progress/coder_execution_row130.md

Source files touched: none. Commit: none. Reseed / reset: none. Core started: none.

Result: set 4 (`0008` + `0009`) applied to `dems_lane_1`, `dems_lane_2`, `dems_lane_3`, then `dems_demo`,
each under `/usr/bin/lockf -k -t 600 .locks/db-migrate.lock`. All four: 2 (dbc-3) -> 3 (dbc-4), 10 files, ledger
matches, second run applies nothing. Only table-count and `session_capture_sources 0` lines differ in
`db:status` before vs after; every kept-table count, the audit head and the lineage line are identical.

Open points for the controller:
1. `db:status` prints counts only: pairing is proven by counts (`paired_devices` 1/1/1/5), not by row contents.
2. Stored services stay 16 until a reseed; `db:status` does not show it; not determined what a boot shows.
3. The "old code refused (B-3)" part of M4-DB-APPLY-1 was not exercised on the live databases (needs a Core of older code).
