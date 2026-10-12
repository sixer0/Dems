---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 8b
agent: database-specialist
date: 2026-10-12
status: complete
---

# Row 8b: Core schema extension for the input-av data (design only)

## Status

complete. Design document written; no migration written or run, no database connected, no source file modified, nothing under `apps/input-av/data/` and no `.env` opened.

## Files

| File | Action |
|---|---|
| `masterplan/03_db_schema_extension.md` | created (485 lines) |
| `delegation_progress/row_08b_db_schema_extension.md` | created (this file) |

Not touched: `masterplan/01_specs.md`, `masterplan/02_plan.md`, `decisions/*`, `status_tasks.md`, `delegation_progress_report.md`.

## Milestones

| # | Milestone | Evidence |
|---|---|---|
| 1 | Data-needs inventory: 63 items, one verdict each | section 1; mechanical tally of the `D-nn` rows: HAS 17, COL 2, TBL 20, NOT 16, WAIT 8 |
| 2 | Proposed shapes: 4 new tables and 1 new column recommended (sets A, B), 1 table gated (set C), 3 columns deferred (set D), 1 table specified and not recommended (set E) | section 2 |
| 3 | Check "record kinds with two homes" = 0 for sets A to D | section 2.8 |
| 4 | Delivery: three sets in today's pattern (generated file + hand-written privileges file, version 6 -> 7 -> 8 -> 9), pins with file:line, compatibility, rollback | section 3 |
| 5 | Open questions OQ-1 to OQ-5 with recommendations; assumptions AS-1 to AS-10; hypotheses H-DB-1 to H-DB-4 | section 4 |

## Decisions for the controller to record (proposals of this row, not rulings)

| # | Proposal |
|---|---|
| 1 | New work packages **WP-24** (schema set A: camera streams, sound-card inputs, per-session source facts), **WP-25** (set B: camera network settings, host alias state), **WP-26** (set C: installation acceptance, only if OQ-2 = yes). Highest existing number at the last read of `01_specs.md` was WP-23 |
| 2 | Side tables keyed by the device id instead of new columns on `capture_devices`, so the engine mapping and the Simulated mode stay untouched |
| 3 | SPEC S3-3's fallback (card identity packed into `capture_devices.address`) is replaced by typed columns; doing both would create a second home |
| 4 | Discovered-but-not-adopted devices are NOT stored (recommendation; the user decides, OQ-1 = SPEC F-4.3 point 6) |
| 5 | The alias lifetime is stored (`expires_at`); input-av keeps it in memory only |
| 6 | No automatic choice of the camera interface (OQ-4) |
| 7 | Reading AS-2: a point-in-time copy inside a session or acceptance record is not a second home |

## Findings outside the row's scope, for routing

| # | Finding | For |
|---|---|---|
| F-DB-1 | ONVIF profile tokens may hold lower-case letters, dots, colons, hyphens (`onvif-session.ts:140`); the selector column admits the upper-case `CODE` form only (`db/schema/capture.ts:145`). Hypothesis: such a camera can be adopted and not assigned. The design separates Core code from ONVIF token | WP-04 |
| - | Experiment E-10 (gap in one track) has not run; whether a gap table is needed depends on it (hypothesis H-DB-2) | WP-01, WP-11 |
| - | `01_specs.md` changed size during this pass (485 -> 619 lines); it is cited by section name only | controller |

## Blockers

None for the design. For execution: approval of implementation (U3, U5); OQ-2 for set C; the rulings of SPEC F-4.3 for the functions that use set B.

---
*Generated: 2026-10-12 18:27*
