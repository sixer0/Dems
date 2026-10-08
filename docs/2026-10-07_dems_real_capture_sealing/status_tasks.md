# Status — DEMS real capture, sealing v2 and transcript

| Step | Status | Note |
|---|---|---|
| A.1 task folder | done | 2026-10-07 |
| A.3 request-translator | done | D2 |
| A.4 task-architect | done | D3 (V1-V7 PASS) |
| A.5 BLUEPRINT_APPROVAL | APPROVED (D4): format A, all defaults | execution authorised later by D5 |
| HANDOFF | done | `report/report.md` = handoff to Kilo; resume at B.7 with rows 1-40, second approval gate after row 40 |
| B.7 execution authorised | started 2026-10-07 | D5 (max parallel delegation), D6 baseline re-check at HEAD `2a4f4ea`, D7 reuse installed STT/TTS, D8 wave-W1 gate, **D9 paid-first tiering** |

## Row ledger (blueprint rev 1, 40 rows)

| Row | Agent (paid-first per D9) | Output | Depends | Status |
|---|---|---|---|---|
| 1 | explore | research/01_explore.md | GA | **done (W1)** — 10/10 PASS, persisted by controller |
| 2 | explore | initialization/01_env_check.md | GA | **done (W1)** — 11/11 READY; closure probes by controller; Graft INITIALIZED; STT/TTS inventory (D7) |
| 3 | data-collector | research/02_collection.md | GA | **done (W1)** — 102 cited facts |
| 4 | data-collector | research/04_collection_stt.md | GA | **done (W1)** — 105 cited facts; pyannote gated; conversion needs Python |
| 5 | security-review | research/05_b2_dependency_triage.md | GA | **done (W1)** — 54 high, 3 root causes, 2 unfixed |
| 6 | data-analyst | research/03_analysis.md | 1, GA | **done (W2)** — 31/31 errata, 94/94 rows, gate answers 29/29, R 7/7 |
| 7 | coder-execution | research/06_spike_s1_fmp4_running_hash.md | 2 | **done (W2)** — S1 PASS 5/5; G-1/G-2/G-3 answered; media in .cache/spikes/s1/ |
| 8 | coder-execution | research/07_spike_s2_mic_switch_timeline.md | 2 | **done (W2)** — S2 PASS 12/12; gap 0.001 ms; libavfilter API switch works (D10c) |
| 9 | coder-execution | research/08_spike_s4_av_sync_fixture.md | 7 | **done (W3)** — S4 PASS 9/9 (−1.333 ms aligned (artefact; true 0.00 ms — D18), 80 ms flagged); media .cache/spikes/s4/ |
| 10 | coder-execution | initialization/02_stt_runtime_install.md | 2, 4, OD-24, Q-INSTALL | **done (W2)** — STT+TTS round trip PASS, server restored DOWN, 0 installs (D7) |
| 11 | coder-execution | research/09_spike_stt_model_conversion.md | 10 | **SKIPPED on this Mac (D7/D10d)** — server loads the model directly |
| 12 | coder-execution | research/10_spike_stt_functional_check.md | 10, 11(skipped) | **done (W4)** — 7/7 PASS; TTS 2-speaker fixture 65.72 s; 17 segs/13 sentences; server DOWN after |
| 13 | coder-execution | initialization/03_gstreamer_install.md | 3, 10, Q-INSTALL | **DEFERRED (D12)** — dry run = 11 shared-dep upgrades (omlx/ffmpeg/openjdk at risk); pending user choice at next gate |
| 14 | coder-execution | research/11_spike_gstreamer_prototype.md | 7, 8, 13 | **DEFERRED with 13 (D12)** — comparison-only post-D10c; re-runs if install approved |
| 15 | data-analyst | research/12_spike_s3_media_engine_pick.md | 3, 7, 8, 9, 14 | **done (W4)** — 12 criteria; pick = FFmpeg + embedded libavfilter worker; GStreamer 8 cells not evaluated |
| 16 | coder-execution | implementation/01_b10a_live_gap_read_only_dialog.md | 1 | **done (W2)** — file already had 0 real-time waits; 3/3 PASS, no edit (audit AU-1 CONFIRMED) |
| 17 | coder-execution | implementation/02_b10b_live_settings_boundary.md | 16 | **done (W3)** — converted to fake timers; 3/3 (8 tests); 0 waits; prod diff empty |
| 18 | coder-execution | implementation/03_b10c_live_session_live_link.md | 17 | **done (W4)** — :54 -> fake timers; 3/3 (14 tests); 0 waits; prod diff empty |
| 19 | coder-execution | implementation/04_b10e_rc8_redundant_timeouts.md | 18 | **done (W5)** — 7-file RC-8 list, 0 overrides; full suite 192/1,988 exit 0; 40_000 removed |
| 20 | coder-execution | implementation/05_b10d_live_paired_devices_issue.md | 1 | **done (W3)** — :373 -> bed.elapse; 3/3 (20 tests); **vitest honours --maxWorkers=2 (D12c)** |
| 21 | coder-execution | implementation/06_b10f_chrome_lost_updates.md | 19, 20 | **done (W6)** — D246 residual converted; 3/3 (4 tests); B10 list fully settled |
| 22 | coder-execution | implementation/07_rc1_recording_elapsed_monotonic.md | 21 | **done (W7)** — RED pre-fix / GREEN post-fix proven; 3/3; use-monitor diff 0 |
| 23 | coder-execution | implementation/08_b2_dependency_refresh.md | 5, 22 | **done (W8)** — scoped undici override; high 54->49 (target <=53); typecheck+lint 0; braces/node-forge accepted-risk |
| 24 | security-review | gateway_check/01_b2_dependency_review.md | 23 | **done (W9)** — PASS; diff = scoped override only; 1 cleared / 2 accepted-risk / 51 propagation / 0 unexpected |
| 25 | senior-code-reviewer | gateway_check/02_b10_test_hygiene_review.md | 21 | **done (W7)** — PASS; 11 test files, 0 production, 4 Minor + 2 Nit |
| 26 | senior-code-reviewer | gateway_check/03_rc1_review.md | 22 | **done (W8)** — PASS-with-findings; forward-only 6/6 paths; 4 Minor + 2 Nit routed to row 22 |
| 27 | test-expert | test/01_wave_a_regression.md | 23, 24, 25, 26 | **done (W10)** — **5/5 PASS**; floors met (mobile 193/1,994 = +1/+6); typecheck+lint 0; live audit 53 |
| 28 | data-analyst | masterplan/01_specs.md | 3, 4, 6 | **done (W4)** — 498 lines; self-gate R 7/7, gate items 29/29, superseded 5/5, 5W1H |
| 29 | data-analyst | masterplan/03_api_contract.md | 28 | **done (W5)** — 598 lines; 13 new ops (75+13=88; later op 89 added -> 89; R-8 proposes 90-92, D22), 24 modified, 7 audit types, slices 28->30 |
| 30 | database-specialist | masterplan/04_database_contract.md | 28 | **done (W5)** — 815 lines; dbc-3; 9 new/5 changed tables; 3/3 CHECK sites; B16 5/5 |
| 31 | data-analyst | masterplan/05_capture_architecture_spec.md | 15, 28 | **done (W5)** — 636 lines; NM 9/9; P25 12 edits by file:line; no non-existent muxer option |
| 32 | data-analyst | masterplan/06_evidence_package_spec.md | 28, 30 | **done (W6)** — 120 manifest fields w/ type+source; 8 sealing steps; 14 verify checks (tamper V-08) |
| 33 | data-analyst | masterplan/07_transcript_spec.md | 4, 12, 28 | **done (W5)** — 427 lines; stages 6/6; DOC-05 15 components; no throughput figures; 2 open points to row 32/39 |
| 34 | data-analyst | masterplan/08_client_ux_spec.md | 28, 29 | **done (W6)** — 692 lines; 7 flows x 3 clients; P 16/16; E 5/5; gated controls 10/10 |
| 35 | security-review | masterplan/09_security_design_review.md | 29-33 | **done (W7)** — PASS-with-findings; 10 surfaces; 0 Critical, 4 High routed |
| 36 | test-expert | masterplan/10_test_strategy.md | 29-34 | **done (W7)** — 578 lines; 205 active checks; 10/10 milestones; 0 >=10-loop |
| 37 | data-analyst | masterplan/02_plan.md | 29-36 | **done (W9)** — 44 W-rows, 19 waves (max 4), 123/123 sections mapped, 94/94 register, collision map 0 |
| 37a | (controller) | gate after 38/39 -> row 40 -> second BLUEPRINT_APPROVAL | 40 | **WAITING FOR USER** — rev 2.0 + 6 questions (Q-SEC-1..3, Q-INST-1, Q-SP-4, Q-D7) |
| 38 | verifier | gateway_check/04_m1_spike_gate.md | 7, 8, 9, 12, 15 | **done (W7)** — **M1 GATE PASS 25/25**, 0 FAIL routed; server DOWN after |
| 39 | verifier | gateway_check/05_m0_spec_gate.md | 27, 37, 38 | **done (W11)** — **M0 GATE PASS**; errata 31/31, R 7/7, OD 29/29, 0 blocking; GAP-01/02 = rev-2 items |
| 40 | task-architect | identification/02_structured.md rev 2 | 39 | **done (W12)** — rev 2.0, 65 rows (41-105), MAJOR, self-gates PASS |

_Note: register errata applied in W4 (`research/03_analysis.md:335` W1-C7 corrected per D12c); counts re-verified 31/25/25/11/13/6/14._

**GAP remediation (W12):** GAP-01 + GAP-02 closed in rows 36/31 (self-gates re-verified); GAP-03..05 informational, not edited.

## Audit and revision by the Claude Code controller (2026-10-08)

| Step | Status | Note |
|---|---|---|
| AU-1 code + tests | done | D19: 8 CONFIRMED / 4 PARTLY, no regression |
| AU-2 spikes + STT | done | D18: results hold; CPU-only STT only on paper; measurement artefacts |
| AU-3 docs + decisions | done | D17: rev 2.0 not ready; REV-1..4 |
| R-8 STT config (user) | recorded | D20 |
| RV-CODE | done | D21: mobile 194/1,997, core-web 117/1,495 |
| RV-SPEC | done | D22: 84 errata + 14 R-8 rows |
| RV-BP rev 2.1 | done | D23: 79 rows (41-119), V1-V7 PASS, 9 gate questions |
| Second BLUEPRINT_APPROVAL | APPROVED (D24): all recommended answers | execution -> Kilo, rows 41-119 |
