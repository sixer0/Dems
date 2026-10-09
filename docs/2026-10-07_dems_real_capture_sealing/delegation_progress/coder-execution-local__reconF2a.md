# Progress — coder-execution-local / RECON-F2a (SH-10 snapshot CODE bump 1→2)

Task folder: `docs/2026-10-07_dems_real_capture_sealing/`
Artifact: `implementation/69b_recon_snapshot_code.md` (Tier 3)
Status: **COMPLETE** — ITEM 1 CODE half landed atomically. No live database touched.

## Steps

| # | Step | Status |
|---|---|---|
| 0 | Baselines: `pg:status`, read-only `db:status` ×4, read-only SELECT probe of `sim_schema_version` (all four DBs = 1), targeted shared (150) + mapping (137), SHA-256 of every target file | done |
| 1 | `sim/constants.ts:24` 1→2 + comment rewritten | done |
| 2 | `sim/types.ts:192` `MetaSlice.schemaVersion` 1→2 | done |
| 3 | `api/state-slices.ts:124` `z.literal(1)`→`z.literal(2)` | done |
| 4 | `sim/initial-state.ts:247` + `live/source/neutral-state.ts:158` literals →2 (the second is a coupling beyond the brief's list) | done |
| 5 | `db/mapping/rows.ts` both boot checks + returned literal now driven by the imported `SIM_SNAPSHOT_VERSION` (accepts 2, refuses anything else) | done |
| 6 | `openapi.json` regenerated under `lockf -k .locks/npm.lock`, non-interactive, determinism recheck green; const = 2; ops/versions unchanged | done |
| 7 | Test re-pins: shared parity/store/slices + core-server ring/to-rows/fixtures/seed.db/restart.db | done |
| 8 | Verification: shared full, mapping unit, core-server unit, core-server db, tsc ×2, lint ×2, live-DB after-probe | done |

## Proof summary (quoted in the artifact §4)

- Shared suite full: `72 passed (72)` / `1875 passed (1875)` → exit 0 (before: identical).
- v2 EMITS (`sim-store` envelope `version === 2`) and RESUMES (`wasRestored() === true` at v2); the
  row-51 optional-key merge test still passes.
- Boot check: new test `SH-10: the boot check ACCEPTS the stored version 2 …` green; wrong values 1
  and 3 still refused on both version columns. Mapping unit 137 → **138** passed, exit 0.
- OpenAPI: stale → regen → up-to-date (exit 1 → 0 → 0); `"const": 2`; drift guards 45 tests green;
  file size unchanged at 1132176 bytes.
- Core-server unit: `3 failed | 4049 passed (4052)` — same three MODG deferrals, +1 passing test.
- Core-server db: `12 failed | 1836 passed (1848)` — the same twelve R4 route-walk deferrals by name.
- tsc: shared 0, core-server 0. Lint: shared 0, core-server 0.

## Live databases

No migrate/seed/reset/write against `dems_demo` or `dems_lane_1..3`. Read-only before/after are
identical: all four still store `sim_schema_version = 1` on `core_state` and `hardware_snapshot`, and
all four report `db:status OK`. Throwaways only (`dems_test_local_*`, teardown "0 remain"). PG left
running; host :5432 never contacted; no lane Core started or restarted (their pid files hold no live
process). Code-v2 vs DB-v1 means lane Cores will not boot until RECON-F2b — intended transient state.

## Handover to RECON-F2b

1. One-shot `UPDATE … SET sim_schema_version = 2` on `core_state` + `hardware_snapshot` for
   `dems_demo` + `dems_lane_1..3` (kept tables + pairing preserved), then restart lane Cores and
   re-assert M2-LANE-1 boot.
2. Optional hygiene routed earlier and still open: `seed.ts:251` stale comment, RECON-E's four
   fail-closed CODE cases for `to-rows.test.ts`, C3 §6/dbc-3 doc erratum (data-analyst).
