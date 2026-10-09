# coder-execution - row 111 (driver) - 2026-10-09

Status: **needs-review** (both proofs pass; two findings need a controller decision before row 58).

## Files created
- `apps/capture-worker/src/capture_worker.c` (563 lines)
- `apps/capture-worker/Makefile`
- `docs/2026-10-07_dems_real_capture_sealing/implementation/59_m3_worker_proofs.md` (Tier 2)
- `docs/2026-10-07_dems_real_capture_sealing/implementation/evidence/59_m3proof/` - `fake_cam.c`, `m3proof.py`, `results/` (analyser JSON, one worker log, one truth file, bind check, uptime; no media)
- `docs/2026-10-07_dems_real_capture_sealing/delegation_progress/coder_execution_row111.md` (this file)
- Git-ignored, not for commit: `apps/capture-worker/build/`, `.cache/spikes/m3proof/` (sources, `bin/fake_cam`, `runs/`, `results/`)

Not edited (shared files in a parallel run): `masterplan/02_plan.md`, `status_tasks.md`,
`delegation_progress_report.md`, `implementation/99_implementation_report.md`, `decisions/decisions.md`.

## Milestones
- Skeleton builds with clang + make against the installed FFmpeg 9.0.2; no install, no npm change.
- H-4: 2/2 runs PASS (962/962 audio packets, 0 differing, 0 mismatches against the encoder manifest, both files decode rc 0). Negative controls fail as required.
- H-10: zero, +/-80 ms and +/-200 ppm drift, 2 runs each, all within 0.021 ms of truth, signs correct. Gap check 12/12 files PASS; the 1,000-samples-removed copy FAILS.
- Ports clean after every run; 0 media in git.

## Decisions for the controller to record
1. Worker location `apps/capture-worker/` - named by the spec (`05_capture_architecture_spec.md:117`), not chosen here.
2. Ready-made-frameworks rule: the worker uses only FFmpeg's own libraries (libavformat, libavcodec, libavfilter, libavutil) as the kit; own code is glue. Linkage is dynamic against the Homebrew FFmpeg 9.0.2 build (GPL build note for DOC-05, row 96).
3. Video timeline anchor = camera wall clock from the RTCP sender report; arrival-time anchoring exists only as an opt-in, untested fallback.
4. Proof ports 8555 and 8557, because 8554/8556/8558 are held by the Android emulators on this Mac.
5. OPEN - drift: the skeleton does not correct clock-rate drift (200 ppm = 2 ms after 10 s, 40 ms after 200 s). Recommended: re-anchor on later sender reports in row 58, with this fixture's drift case as the regression test.
6. OPEN - first video sample: with the pinned `frag_keyframe+empty_moov+default_base_moof` the first video sample of each file is placed at 0 and held (0.385 s in the measured file). Options in `59_m3_worker_proofs.md` section 6.2.

## Blockers
None.
