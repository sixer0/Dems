---
task_id: 2026-10-07_dems_real_capture_sealing
row: RV-SPEC (revision round D19, relaunched under D20)
agent: data-analyst
date: 2026-10-08
status: complete
---

# RV-SPEC — audit errata applied to the specs + proposed R-8

## Status

complete — all confirmed audit errata in scope applied; R-8 (D20) added as proposed sections pending
Q-STT-CFG. No server started, no test run, no secret printed, no file outside the owned list edited.

## Files updated (13) and created (2)

Updated:
- `masterplan/01_specs.md` — AU2-03/04/05/06/07/08, AU3-01/02/04 errata; new R-8 (proposed)
- `masterplan/02_plan.md` — errata incl. AU1-4 / D19(b); `cpu-local` M6 note; F-6 reframed; F-9..F-11; H-10
- `masterplan/03_api_contract.md` — AU2-07 (op 81), AU2-08 (`CAPTURE_GOP_FRAMES`); new §2.5 ops 90-92 (proposed)
- `masterplan/04_database_contract.md` — new §B.13 `stt_config` (proposed, kept)
- `masterplan/05_capture_architecture_spec.md` — AU2-03..AU2-08 in §0, §A.7, §A.8, §C.1, §C.5, §E, §F, §J (H-10); Q-WORKER note on H-4
- `masterplan/06_evidence_package_spec.md` — AU2-03 (field 51); new §B.7a + §E.5 extension (proposed)
- `masterplan/07_transcript_spec.md` — `cpu-local` source build / conversion / 2 + 1 proof / status; new §B.7 (proposed)
- `masterplan/08_client_ux_spec.md` — D19(b) refinement; new §8a Flow 8 (proposed)
- `masterplan/09_security_design_review.md` — §10 addendum for the R-8 surface
- `masterplan/10_test_strategy.md` — M1/M3/M5/M6 check errata; new `M3-AV-2`, `M3-KC-4`; §A.6a 8 conditional R-8 checks; counts 205 -> 207 active, 82 -> 84 run 2+1, +10 -> +18 conditional
- `research/08_spike_s4_av_sync_fixture.md` — top-of-file erratum note only
- `research/12_spike_s3_media_engine_pick.md` — top-of-file erratum note only
- `gateway_check/04_m1_spike_gate.md` — top-of-file erratum note only (STT-5 re-read as "CPU clause deferred")

Created:
- `masterplan/11_audit_errata.md` — the ledger (84 errata rows + 14 R-8 rows, counts per finding, open points)
- `delegation_progress/rv_spec_errata.md` — this file

## Errata counts per finding (rows in `11_audit_errata.md` §1; computed by script)

AU2-03 16 · AU2-04 8 · AU2-05 12 · AU2-06 16 · AU2-07 16 · AU2-08 14 · AU2-01/AU3-01/AU3-03 26 ·
AU2-02 5 · AU3-02 6 · AU3-04 4 · AU2-11 1 · AU1-4/AU1-2 (D19(b)) 5 · R-8 addition (D20) 14.

## Decisions taken in this row

- OD-24's approved text ("whisper.cpp (Homebrew)") was **kept**; the source build under `.cache/`
  with GPU off is described as the planned route and flagged for the reframed Q-D7 (OPEN-1).
- New active checks `M3-AV-2` (H-10) and `M3-KC-4` (long GOP) were added rather than folded into
  existing rows, and the test-strategy totals were updated with an inline erratum note.
- R-8 proposed defaults beyond D20's text: change while a session is open is **stored and applies
  to the next session** (alternative refuse-while-open listed under Q-STT-CFG); no new slice; no new
  error code; one new audit type `STT_CONFIG_CHANGED`; manifest `transcript.state = 'DISABLED'`.

## Left open / outside this row

OPEN-1 install route (gate); OPEN-2 OP-GOP; OPEN-3 OP-CLICK; OPEN-4 asymmetric AV standard bound
(unverified); OPEN-5 R-8 defaults (Q-STT-CFG). Not edited (not owned): `decisions/decisions.md`
D12/D13 wording (−1.333 ms, 0.001 ms, "never overshoots"), `research/07`, `research/10`,
`status_tasks.md:24`, `delegation_progress_report.md:25`, the AU3-07 P-4 renumber (row 41), and all
blueprint rows (RV-BP).
