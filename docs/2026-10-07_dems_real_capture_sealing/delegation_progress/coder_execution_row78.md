---
task_id: 2026-10-07_dems_real_capture_sealing
agent: coder-execution (driver, row 78)
date: 2026-10-09
status: needs-review
artifact: implementation/35_m6_diarization.md
---

# Row 78 — progress record (parallel run; the controller owns status_tasks.md and delegation_progress_report.md)

## Status

needs-review. Everything the row names is built and its checks pass, except one thing that is not proven: a LABELLED transcript on real audio. Speaker labelling ended on option 2 of ruling D90 (UNAVAILABLE with a reason).

## Milestones

| Milestone | State | Evidence |
|---|---|---|
| Labelling rule + engine module + post-pass (no segmentation model) | done | `apps/transcriber/src/pipeline/diarization.ts`, `native/speaker-embed.c` |
| M6-LB-1 (unit, model stubbed) | PASS | `src/__tests__/diarization.test.ts`, `assembly.test.ts` |
| M6-TF-1 criterion 6 on the sealed fixture | PASS as UNAVAILABLE / `NOT_TWO_SPEAKERS` with the flag | `.cache/stt/checks/row78/runs/20261009T092436935Z-86592-row78-labels/fixture.evidence.json` |
| LABELLED on real audio | NOT PROVEN (fixture: forced split 11 of 14; two built-in voices: 6 of 8) | same folder, `control.evidence.json` |
| `dems.transcript/1` document, canonical rule, hash, SRT/VTT | done | `pipeline/document.ts`; `document.test.ts` |
| Assembly, written once, PARTIAL carried | done | `pipeline/assembly.ts`; `assembly.test.ts` |
| `transcripts` / `transcript_revisions` / `evidence_items.transcript_sha256` as `dems_app`, one unit of work | done, not mounted | `apps/core-server/src/modules/transcripts/`; `transcripts.db.test.ts` 36 passed |
| SH-09 `CORE_SERVICES` + pins | done | `packages/shared/src/sim/dataset.ts:189`; list in 35 §4 |
| DOC-05 remainder (sherpa-onnx, ONNX Runtime, CAM++, Silero re-established) | done | `THIRD_PARTY_NOTICES.md` (row-78 section) |
| W1-C5 | closed as "the gated route stays excluded; refused by marker, hash and static rule" | `diarization.ts:285`; static rule `NO_UNCLEARED_DIARIZATION_MODEL` |
| Row-77 review fixes | 11 fixed, N-4 carried | 35 §8 |
| Mutations | 29 of 29 red | `.cache/stt/checks/row78/mutation-red.json` |

## Blockers / rulings needed

1. Speaker labels: no LABELLED on real audio; route to take next (35 §7.1).
2. Spec errata tx §A.4, §F, LB-5, §0.2 (35 §5).
3. Decisions D-78-1, -2, -4, -5, -7, -8, -10, -11 (35 §6).
4. Pyannote segmentation files: downloaded and run once by hand before D90; kept with a marker; removal is the user's call.
5. Existing seeded databases and browser snapshots keep 16 services until a reseed/reset.
6. Edits outside this row's D95 ownership, made before D95 arrived: `delegation_progress/file_requests.md` (6 lines).
7. N-4 has no owner.

## Not edited

`masterplan/**`, `status_tasks.md`, `delegation_progress_report.md`, `implementation/99_implementation_report.md`, any migration, `apps/core-server/src/db/**`, `apps/capture-worker/**`. Nothing committed. oMLX not started.
