# Row 34 delegation progress — data-analyst

- Blueprint row: 34 (class B, milestone M0, tier 1)
- Task: Write the client UX spec for web, tablet and phone (selector, mic toggle with warning,
  sealing progress/ETA, resumed-sealing state, playback with the audio-source band, transcript pane).
- Status: COMPLETE
- Date: 2026-10-07 17:30

## Output

| Artifact | Path |
|---|---|
| Client UX spec | `masterplan/08_client_ux_spec.md` |
| This progress note | `delegation_progress/data-analyst__row34.md` |

## Inputs read (source of truth)

| Input | Path |
|---|---|
| Structured blueprint row 34 | `identification/02_structured.md:214` |
| Phase spec (R-1..R-3, R-5, R-6, §E.5/§E.6, C-N12) | `masterplan/01_specs.md` |
| API contract C3 (ops 76-88, slices 29-30, audit, errors) | `masterplan/03_api_contract.md` |
| Transcript spec (transcript shape, revisions) | `masterplan/07_transcript_spec.md` |
| Capture architecture spec (mic switch, sealing, storage) | `masterplan/05_capture_architecture_spec.md` |
| Evidence package spec (row 32) | `masterplan/06_evidence_package_spec.md` — **NOT YET WRITTEN** |
| Database contract (sealing_jobs, step enum, kept tables) | `masterplan/04_database_contract.md` |
| Register (WB-01..WB-11, MB-01..MB-13, SH/CS/NM/E rows) | `research/03_analysis.md` |
| Predecessor P-01..P-16 and E-13..E-17 | `docs/2026-10-04_dems_backend_rbac_pairing/research/11_next_phase_drift_check.md` §2.1, §6 |
| Decisions (D4 gate answers, D8/D10/D12) | `decisions/decisions.md` |
| Explore §2.6 (test-file locations) | `research/01_explore.md` |
| Client patterns | `apps/core-web/src/lib/{core-queries,device-command-gate,download}.ts`; `apps/mobile/src/runtime/{recording-elapsed,core-clock}.ts`; `apps/mobile/src/components/composed/selection-glow.tsx`; `apps/mobile/src/features/session-live/monitor-handoff.ts`; `apps/mobile/src/navigation/stacks.tsx`; `packages/shared/src/domain/enums.ts`; `packages/shared/src/api/state-slices.ts` |

## Self-gate (row 34 hard gate)

| Check | Result |
|---|---|
| Each flow defined for all 3 clients | 7 flows × 3 clients = 21/21 |
| P-01..P-16 applied or N/A with reason | 16/16 (15 applied, 1 N/A: P-15) |
| E-13..E-17 accounted | 5/5 (applied) |
| Every gated control has the "Checking your permissions..." state | 10/10 controls (30 client instances) + 6/6 gated reads |
| OD-09/10/11/12/13 cited by decision ID | 5/5 |
| Every flow maps to row-29 operations/slices | 7/7 |

## Flows covered

1. Device selector (R-1) — ops 76-80, 44-48; slices `captureConfig`/`captureDevices`.
2. Mic toggle + warning (R-3) — ops 81-82, 44-45; slice `session` + `meters.audio`.
3. Sealing progress + ETA (R-6) — ops 83, 27; slice `session.finalization`.
4. Resumed sealing after crash/restart (R-6, OD-08) — ops 83, 27, 38, 39.
5. Playback with audio-source band (R-3/R-4) — ops 82, 88, 39-42, 87.
6. Transcript pane (R-5) — ops 84-86.
7. Session gating (R-6) — ops 24, 25, 27.

## Blockers / notes

- `masterplan/06_evidence_package_spec.md` (row 32) does not exist yet. Per the row-34 brief, the UX
  spec binds to row 32's sealing step list rather than redefining it: flow 3/4 render the op-83 step
  envelope and the SH-01 enum `CLOSE_TRACKS`..`STORE_SEALED_PACKAGE`; row 32 remains the owner of the
  definitive step list and checkpoints. Flagged in the spec (§4.1, §13).
- The `SESSION_HOLDER` access condition is proposed in `C3 §0/§10` and not yet in `contract-model.ts`;
  flow 2 assumes the op-81 gate exactly as `C3 §2.2` describes (M2 materialises it).
- No file outside the task folder was edited; no code change; no external service contacted.

## Red-line compliance

- No emoji; English; tables over prose.
- Every design choice cites `file:line` / decision ID (`D4`, `OD-nn`) / register row (`WB-nn`/`MB-nn`/
  `SH-nn`/`CS-nn`) / row-29 operation.
- Only the two contract files were written; M4/M5/M7/M8 implement.
