# coder-execution — row 86 (M7-W5 kill matrix)

Status: **needs-review** (2026-10-09). Note: `implementation/41_m7_kill_matrix.md`.

## Files (all new; no product file, no existing test, no pin edited)

- `apps/core-server/src/sealing/__tests__/kill-matrix/cells.ts`
- `apps/core-server/src/sealing/__tests__/kill-matrix/judge.ts`
- `apps/core-server/src/sealing/__tests__/kill-matrix/core-child.ts`
- `apps/core-server/src/sealing/__tests__/kill-matrix/rig.ts`
- `apps/core-server/src/sealing/__tests__/kill-matrix/cells.test.ts`
- `apps/core-server/src/sealing/__tests__/kill-matrix/kill-matrix.db.test.ts`
- `apps/core-server/src/sealing/__tests__/kill-matrix/run.sh`
- `docs/2026-10-07_dems_real_capture_sealing/implementation/41_m7_kill_matrix.md`
- appended: `delegation_progress/file_claims.md` (3 lines), `delegation_progress/file_requests.md` (3 lines)
- run output (git-ignored): `.cache/kill-matrix/*.json`

## Run by the driver, once each

Green: `M7-KM-P1-0`, `M7-KM-P2-0`, `M7-KM-P3-0`, `M7-KM-P4-0`, `M7-KM-P1-S1`, `M7-KM-P2-S1`, `M7-KM-P3-S4`. `M7-REF-1`: run 1 red, run 2 green (F-86-1). `M7-KM-P4-S6`: red (F-86-2). Unit `cells.test.ts` 10 passed; typecheck and lint clean in the folder.

## Not run (test runner, note §8)

26 checks: `M7-KM-C-S1..S6`, `M7-KM-P1-S2..S6`, `M7-KM-P2-S2..S6`, `M7-KM-P3-S1/S2/S3/S5/S6`, `M7-KM-P4-S1..S5`. Parked, not built: 10 `S7` / `S8` cells (OD-21).

## Blockers / decisions for the controller

- F-86-1 and F-86-2: owners to be routed (request lines 2026-10-09, row 86).
- Carried demo regeneration: stopped; needs a ruling (seed-time generator in `apps/core-server`).
- P3's transcript half is not staged until row 71c lands.
