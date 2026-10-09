---
task_id: 2026-10-07_dems_real_capture_sealing
agent: coder-execution (driver, row 77)
date: 2026-10-09
status: needs-review
artifact: implementation/34_m6_vad_stt.md
---

# Row 77 — progress record (parallel run; the controller owns status_tasks.md and delegation_progress_report.md)

## Status

needs-review. All named checks ran and passed; four items need a ruling (implementation/34_m6_vad_stt.md section 10).

## Milestones

| Milestone | State | Evidence |
|---|---|---|
| Pipeline code (intake, VAD, chunk plan, clamp, media time, checkpoints, mirror port, runner) | done | `apps/transcriber/src/pipeline/` (9 files) |
| `transcript_chunks` store in the Core | done, not mounted (row 115) | `apps/core-server/src/modules/transcript-chunks/` |
| M6-CP-1 outside the sandbox, sibling rule | PASS | `.cache/stt/checks/row77/gate/transcriber_outside_sandbox_verbose.txt` |
| Known-offset check + negative controls | PASS / red with a wrong constant | `media-time.test.ts`, `media-time-wrong-constant.test.ts` |
| M6-KR-1 | PASS (unit harness, real SIGKILL; real engine) | `kill-resume.test.ts`; `runs/20261009T075020236Z-20817-row77-cpu-local/run2.evidence.json` |
| M6-TF-1 criteria 1-4, cpu-local x2 and omlx-server x1 | PASS | `runs/…-row77-cpu-local/`, `runs/…-row77-omlx-server/` |
| Phantom-tail clamp on the live server | PASS (1 past the end without the clamp, 0 with it) | `runs/20261009T075232545Z-21241-row77-omlx-server/clamp.evidence.json` |
| M6-DF-1, 2 runs | PASS, with caveats | `runs/20261009T080824013Z-29430-row77-df1/`; earlier series kept |
| Downloads (VAD, embedding, segmentation) | done; one licence finding | THIRD_PARTY_NOTICES.md |
| Coordinator message D84 (import guard, tap signal R-8) | done | 34_m6_vad_stt.md sections 7, 9 |

## Blockers / rulings needed

1. Licence of `sherpa-onnx-reverb-diarization-v1` (Rev Model Non-Production License): not usable for the product; row 78 route needs a decision; keeping the files is the user's call.
2. tx §A.4 erratum: embedding example name and size do not match the release.
3. D-77-1, -3, -4, -6, -8 need confirmation (34_m6_vad_stt.md section 8).
4. M6-DF-1: two of the driver's own assertions were corrected after a run; host not quiet for the whole run; analyser reads the container, not `recording_fragments`.

## Not edited

`masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`, `implementation/99_implementation_report.md`, any file of row 58, `packages/shared/**`, any migration. Nothing committed by this driver (commit 4b62350, made by someone else, contains an intermediate state of this row's files).
