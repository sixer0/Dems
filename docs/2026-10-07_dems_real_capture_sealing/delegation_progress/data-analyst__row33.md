---
task_id: 2026-10-07_dems_real_capture_sealing
row: 33
agent: data-analyst
milestone: M6
class: B (GA:OD-15, OD-20, OD-24)
tier: 1
status: complete
last_updated: 2026-10-07 17:05
---

# Row 33 — transcript spec (progress)

## Status

complete. Deliverable `masterplan/07_transcript_spec.md` written (427 lines). Nothing was executed:
no model downloads, no installs, no server start, no code changes. Inputs were read-only. No file
outside this task folder was edited.

## Inputs read (in order)

| # | Input | Used for |
|---|---|---|
| 1 | `identification/02_structured.md` row 33 (Verification gate), row 4, row 12, §6 M6, §9 C-7 | hard gate, dependencies, class placement |
| 2 | `masterplan/01_specs.md` §E.3 (row 28), §E.1/E.2 (cross-ref), §E.4 (sealing cross-ref), R-5/R-7, C-N1/C-N2/C-N3, §C.1, §G.2 | transcript mechanism, acceptance criteria, licence obligations |
| 3 | `research/04_collection_stt.md` | licence-clean route: Silero VAD, sherpa-onnx diarization, whisper.cpp flags, conversion, pre-converted ggml, G-1/G-4, LB-1..LB-5 |
| 4 | `research/10_spike_stt_functional_check.md` (row 12) | executed functional evidence (fixture, 17 segs/13 sentences, language `id`, unreliable `duration`, adapter findings, no-figure grep) |
| 5 | `research/03_analysis.md` | register rows NM-06/NM-07/NM-08/NM-13/SH-02/SH-03/SH-04/SH-13/SH-14/CS-22/DOC-05; errata E-21/E-22; W1-C3/W1-C5/W1-C12; RK-1; superseded list |
| 6 | `identification/01_translated.md` (R-5/R-7, C-PROC/C-TECH/C-SAFE) | requirement and constraint wording |
| 7 | `research/01_explore.md`, `research/02_collection.md` (F-44) | repo state; AAC 21.33 ms frame for chunk alignment |
| 8 | `decisions/decisions.md` (D4/D7/D8/D10/D12) | authority for OD-15/OD-20/OD-24 and the D7 re-scope |

## Output

| File | Content |
|---|---|
| `masterplan/07_transcript_spec.md` | 0 scope + design constants (proposals flagged); A six pipeline stages each with input/output/checkpoint/failure; B `TranscriberAdapter` (interface, `omlx-server`, `cpu-local`, selection rule, identical return contract, `TtsFixtureProvider`); C CPU priority rule + M6 proof; D chunk checkpoints + crash/resume + D223 sealing interaction; E M6 functional check (no figures) + row-12 reference + no-figure statement; F DOC-05 licence list (15 components); G out-of-scope/class C; H self-gate; references |

## Self-gate results

| Check | Result |
|---|---|
| Functional-check criteria measurable without benchmark figures (D230) | PASS — structural criteria only; explicit no-figure statement (E.3) |
| `RTF|WER|ms per|real-time factor` grep only in "no X" statements | PASS — 6 matching lines, all negations or the self-gate's own quotation of the pattern (lines 25, 335-338, 393, 404) |
| Every stage has input + output + checkpoint + failure behaviour | **6/6** (A.1-A.6) |
| DOC-05 licence entry list present | PASS — **15 components** |
| Cites row 12 or its SKIPPED record | PASS — cites the executed `research/10_spike_stt_functional_check.md` ("Row 12 acceptance: 7/7 PASS", 17 segments / 13 sentences); row 12 is not a SKIPPED record |
| `TranscriberAdapter` covers both backends | PASS — `omlx-server` + `cpu-local` + selection rule + identical return contract |
| OD-15 / OD-20 / OD-24 cited by decision ID | PASS |
| Every design choice cited | PASS — decision ID / register row / coll3/coll4 Fnn / row12 § / specs § |

## Notes / issues

- **No `masterplan/02_plan.md` contribution**: this is a mechanism spec (row 33), not an
  implementation plan. Row 37 owns the plan; row 40 produces the M2-M9 implementation rows
  (`structured` rows 33, 37, 40).
- **D7 flag preserved**: the `TranscriberAdapter` re-scope (Mac `omlx-server` reuse; `cpu-local`
  whisper.cpp deferred to the Core) touches the OD-24 default and remains flagged for confirmation at
  the second blueprint gate (D7(c); register §F W1-C12).
- **Proposals flagged, not decided**: `DIARIZATION_CLUSTER_THRESHOLD`, `DIARIZATION_MIN_SEGMENTS`,
  `STT_CHUNK_RETRIES`, the canonical document format and the checkpoint path are labelled PROPOSAL;
  M6 implements/calibrates. The LABELLED/UNAVAILABLE behaviour itself is decided (D226 labels part;
  R-5).
- **Escalated for confirmation (could not be resolved from D4/D7/D10)**: D226 is listed in the
  register as superseded, but only its **benchmark** part was superseded by D230; its **labels**
  part ("labels mandatory when possible") stays live per `structured` §1.2 ("D226 (labels part)") and
  R-5. This spec uses the labels part and cites it as "D226 (labels part)". Flagged here in case the
  M0 gate wants the register's superseded entry annotated.
- **Unresolved design point (flagged, not decided)**: what happens to sealing when STT **hard-fails**
  (all chunk retries exhausted). D223 says sealing waits for the transcript; OD-08 covers a crash
  during RECORDING. This spec's proposal is that the transcript step is marked FAILED and the package
  still seals with an explicit transcript state and no fabricated transcript, cross-referenced to row
  32 (evidence package). M6/row 32 should confirm.
- **Cross-refs only**: audio-source intervals (rows 29/31), package/sealing mechanics (row 32) and the
  API/DB contracts (rows 29/30) are consumed by reference, not duplicated.

---

*Generated: 2026-10-07 17:05*
