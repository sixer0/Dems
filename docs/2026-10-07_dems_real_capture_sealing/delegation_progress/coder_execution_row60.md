---
task_id: 2026-10-07_dems_real_capture_sealing
row: 60
date: 2026-10-09
agent: coder-execution (driver)
status: needs-review
---

# Row 60 - driver progress (parallel run; the controller synthesises the shared trackers)

Report: `implementation/22_m3_fixtures.md`. Evidence: `implementation/evidence/22_m3_fixtures/`.
Not written by this agent (parallel isolation): `status_tasks.md`, `delegation_progress_report.md`,
`masterplan/02_plan.md`, `implementation/99_implementation_report.md`, `decisions/decisions.md`.

## Milestones

| Time | What |
|---|---|
| 15:10 | fixtures vendored into `apps/capture-worker/test-fixtures/` (skeleton SHA-256 equal to commit 101ce62) |
| 15:15 | R-1 (`anchor_tick`) + red build; D58-16 limit 32 / `INGEST_OPEN_REFUSED` |
| 15:28 | ONVIF stub 35 tests; 8 mutations red |
| 15:45 | first full pass of the series (one run each): all as expected |
| 15:59 | unlocked official series stopped at check 23 (lock rule arrived); lock built into the target |
| 16:26 | official series under the heavy-host lock: 78 of 78 as expected, exit 0, 1,420 s |
| 16:35 | aggregate proofs (78 flips, one real flipped verdict, crash case); suites |

## Files created

- `apps/capture-worker/test-fixtures/fake_cam.c`, `fake_mic.c`, `av_analyse.py`, `negative-control/skeleton111.c`, `negative-control/README.md`
- `apps/capture-worker/test/e2e.py`, `apps/capture-worker/README.md`
- `apps/core-server/test/support/fake-onvif-stub.ts`, `apps/core-server/test/support/fake-onvif-stub.test.ts`
- `docs/.../implementation/22_m3_fixtures.md`, `docs/.../implementation/evidence/22_m3_fixtures/{e2e_row60_summary.txt, e2e_prove_aggregate.txt, e2e_scratch_real_flip.txt, e2e_scratch_flip_negative.txt, mutate_onvif_stub.sh}`, this file

## Files changed

- `apps/capture-worker/Makefile` (targets `fixtures`, `e2e`; red build `NO_TICK` in `unit`), `check.sh` (fixture rules + 5 planted controls)
- `apps/capture-worker/src/anchor.c`, `anchor.h`, `ingest.c` (R-1, D58-16 only)
- `apps/capture-worker/test/anchor_test.c`, `test/m3worker.py`, `test/fake_mic.c` (now a 3-line include stub of the moved file)

No shared file (package index, static pin, notices) was edited. No file deleted. Nothing committed.

## Blockers / open

- Mediated request of row 65 (mic lateness bound, out-of-range telemetry, +-20,000 ppm cases): NOT done; follow-up. Values for the row-65 pin stay as they are: buffer cap 2,000 ms, no out-of-range report.
- Row 59: the worker reports nothing about an observed long keyframe interval (measured with the 250-frame camera).
- Coordination note: my first series stalled 5 minutes because another row's shell command line contained the text `whisper-cli`, while that shell was waiting for my processes to end. Fixed on my side (program-name match) and superseded by the heavy-host lock.
