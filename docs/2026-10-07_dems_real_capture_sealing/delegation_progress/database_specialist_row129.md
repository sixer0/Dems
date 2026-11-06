---
task_id: 2026-10-07_dems_real_capture_sealing
date: 2026-10-09
agent: database-specialist
blueprint_row: 129
status: needs-review
report: implementation/60_r9_migration_0008.md
---

# Row 129 - record

- Built migration set 4 (`0008` generated, `0009` hand-written), typed schema, seed, mapping,
  store, fixtures, reset guard, `db:status` fix; all pin groups of dbc-4 N.12 moved.
- Named checks M4-MT-9 (2 runs), -10, -11, -12, -14, -15, -16, M4-PIN-2, M4-SEC-RESET-1 (2 runs):
  pass on throw-away databases, each with a failing negative control (report section 2).
- Full db project once: 12 baseline reds + 12 own pin reds; own reds fixed and their files re-run
  green; no second full run.
- Live `dems_demo`, `dems_lane_1..3`: still `2 / dbc-3`, not migrated.
- D95: exclusive owner of `src/db/**`; both upsert rules are in `store.ts` (row 65's A-11 edit was
  already there and was kept). `test/static/*` not edited.
- Files of other rows touched: one schema-version line in each of row 78's two db tests.
- `masterplan/02_plan.md` has no status column or issues log for AP3-129; not edited.
- Open for the controller: report section 6 (disk side of the guard; fixture v2 mix; slice
  `adapter` member; confirmation on the command line). Deviation from N.12: 167 direct + 5 shadowed
  CHECK cases, not 168 + 4.
- Red outside this row at the end: typecheck and one static test in `src/capture/**` (rows 83, 134).
