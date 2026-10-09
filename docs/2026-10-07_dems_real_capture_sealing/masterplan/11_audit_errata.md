---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-08
agent: data-analyst
revision_row: RV-SPEC (revision round of D19; relaunched per D20)
type: errata ledger (tier 3 — mechanical record with file:line evidence)
status: complete
sources:
  - verification/20_audit_code_tests.md (AU-1: AU1-2, AU1-4)
  - verification/21_audit_spikes_stt.md (AU-2: AU2-01..AU2-08, AU2-11)
  - verification/22_audit_docs_decisions.md (AU-3: AU3-01..AU3-04, AU3-07)
  - decisions/decisions.md D4, D7, D12, D13, D16-D20
  - section 5 (2026-10-09): delegation_progress/pair_57_navigator.md, pair_111_navigator.md, pair_113_navigator.md; implementation/19_m3_supervisor_ipc.md, 59_m3_worker_proofs.md, 52_m6_stt_config_api.md; decisions/decisions.md D24, D65-D68
last_updated: 2026-10-09 (section 5 added: pair-review errata of rows 57, 111, 113; section 5.7 added: R-8 / Q-D7 / Q-WORKER status sweep PE-R8-01..22)
---

# Audit errata applied to the task-3 specs (RV-SPEC)

## 0. What this file is

The ledger of every text change RV-SPEC made to the masterplan specs, the plan and three research/gate
files, after the three independent audits (D16-D19), plus the proposed R-8 additions (D20). Line
numbers are **after** the edit (verified with `grep -n` at write time). "Before" quotes are abridged.
The task folder's `masterplan/`, `research/` and `gateway_check/` are untracked in git (`git status`:
`??`), so the pre-edit copies were kept in the session scratch directory and compared with `diff`.

Rules followed: no approved D4 value changed — where a spec contradicted one, the approved value is
kept and the deviation is put to the gate (OD-24 Homebrew route, §3 OPEN-1); research and gate files
keep their measured history and carry an erratum note at the top; `identification/02_structured.md`,
`decisions/decisions.md`, trackers and code were not touched (owned by RV-BP, the controller and
RV-CODE).

## 1. Errata table

| document:line | before | after | source finding |
|---|---|---|---|
| `masterplan/05_capture_architecture_spec.md:53` | D10 row: "realised boundary = 1 AAC frame" | boundary = next worker input quantum (≤ 10 ms with 10 ms push chunks; ≤ 21.333 ms only in a 1024-sample pull loop) | AU2-07 |
| `masterplan/05_capture_architecture_spec.md:54` | D12 row: "Aligned AV offset −1.333 ms within ±40 ms; injected 80 ms flagged 78.667 ms" | aligned 0.00 ms (+0.021 ms = one sample); +80 ms → 80.021 ms; −80 ms → −80.052 ms; old values = 10 ms-window artefacts | AU2-03 |
| `masterplan/05_capture_architecture_spec.md:55` | — | new D18 row pointing to sections C, E, F, J and this file | AU2-03..08 |
| `masterplan/05_capture_architecture_spec.md:261` | NM-10 purpose "frame-boundary switch" | switch at the next worker input-quantum boundary on the filtering thread | AU2-07 |
| `masterplan/05_capture_architecture_spec.md:281` | NM-10 failure "worst-case 1 AAC frame, S2 §6 finding 4" | bound = one input quantum + IPC latency; command from a non-filtering thread forbidden | AU2-07 |
| `masterplan/05_capture_architecture_spec.md:299` | NM-14: flash+beep generator + `analyse.py` (10 ms windows implied) | three truths (0 / +80 / −80 ms), sample-resolution audio onset, long-GOP fake camera, separate-clock fake camera | AU2-03, AU2-04, AU2-06, AU2-08 |
| `masterplan/05_capture_architecture_spec.md:380` | §C.1: no crash-loss statement; `CAPTURE_GOP_FRAMES` treated as enforceable | new table: RPO = one fragment = one camera GOP; DEMS cannot enforce the GOP on `-c copy`; measured 10 s GOP killed at 7 s → 0 s durable; ONVIF `GovLength` at session start + observed-keyframe check; OPEN OP-GOP (warning vs `-frag_duration` ceiling); long-GOP fixture `M3-KC-4` | AU2-08 |
| `masterplan/05_capture_architecture_spec.md:446` | §C.5 ends at "Seal" | new row: mandatory RECOVERY tail validation by box walk; ffprobe/decoder are not detectors (rc 0 on a cut `mdat`, duration over-reported) | AU2-08 |
| `masterplan/05_capture_architecture_spec.md:515` | — | new row: `avfilter_graph_send_command` applied on the filtering thread only | AU2-07 |
| `masterplan/05_capture_architecture_spec.md:517` | "Guarantee: command → boundary ≤ 1 AAC frame (21.333 ms); file timeline never gaps (0.001 ms measured)" | ≤ one worker input quantum + IPC latency; placement error ≤ 1.17 ms | AU2-07 |
| `masterplan/05_capture_architecture_spec.md:518` | (gap evidence = "0.001 ms measured") | gaplessness = decoded sample count + per-input continuity + (secondary) 1 stream / monotonic PTS; packet-grid metric declared not gap evidence | AU2-05 |
| `masterplan/05_capture_architecture_spec.md:519` | — | new row: audible click (16-24x step); OPEN OP-CLICK (5-10 ms crossfade vs accepted click) | AU2-07 |
| `masterplan/05_capture_architecture_spec.md:544` | AV timeline "within ±40 ms … S4 measured −1.333 ms aligned, 78.667 ms" | relative offset, AAC priming shift cancels; sample-exact 0.00 / 80.021 / −80.052 ms | AU2-03 |
| `masterplan/05_capture_architecture_spec.md:545` | — | new row: regression bound ≤ 2 ms vs product bound ±40 ms; asymmetric standard bound OPEN | AU2-04 |
| `masterplan/05_capture_architecture_spec.md:546` | — | new row: analyser detects audio onset at sample resolution | AU2-03 |
| `masterplan/05_capture_architecture_spec.md:548` | "The measured pipeline skew of −1.333 ms is a bias of the copy path, not the content" | statement withdrawn; injections of any size detectable (~0.05 ms resolution); one-clock fixture → H-10 | AU2-03, AU2-04, AU2-06 |
| `masterplan/05_capture_architecture_spec.md:640` | H-4 without the worker-form question | adds Q-WORKER (C program vs Node binding) routed by AU3-04 | AU3-04 |
| `masterplan/05_capture_architecture_spec.md:646` | hypotheses H-1..H-9 | new H-10 camera video clock vs host audio clock alignment/drift, falsifier `M3-AV-2` | AU2-06 |
| `masterplan/05_capture_architecture_spec.md:659,663,664,681` + front matter `:31` | self-gate "nine items", H-1..H-9 | ten items; new self-gate row for the AU-2 errata; dates | AU2-06 (count) |
| `masterplan/01_specs.md:80` | A.1 "stands up a working CPU Speech-to-Text path (M1)" | working STT path on oMLX/MLX (Apple GPU) in M1; CPU path proven in M6 | AU3-01, AU2-01 |
| `masterplan/01_specs.md:93` | M1 "CPU STT runtime install/conversion/functional transcript" | CPU install/conversion/CPU-only check did not run in M1; moved to the M6 `cpu-local` row | AU3-01 |
| `masterplan/01_specs.md:164` | R-3 AC-1 "realised file gap/drop of 0 ms … within <= 1 AAC frame (21.333 ms)" | 0 inserted/dropped samples by sample count + continuity (not the 0.001 ms metric); boundary ≤ one input quantum + IPC latency | AU2-05, AU2-07 |
| `masterplan/01_specs.md:183` | R-5 narrative "On this Mac the engine is the installed oMLX server" | oMLX = development engine (Apple GPU); `cpu-local` also built GPU-off and proven on this Mac (M6); R-8 conditional sentence | AU3-01; D20 |
| `masterplan/01_specs.md:187` | R-5 AC-1 (CPU clause, status unstated) | criterion text **kept**; status "NOT yet met — row 12 ran on `Device(gpu, 0)`"; met only by the `cpu-local` check and `M6-TF-1` on `cpu-local` | AU3-01, AU2-01 |
| `masterplan/01_specs.md:190` | R-5 AC-4 (backend unstated) | run with `cpu-local` | AU3-01 |
| `masterplan/01_specs.md:241` | C-N1 verification "Row-12 functional check quoted command shows GPU disabled" | `cpu-local` functional check (`-ng`, GPU-off build) 2 + 1; row 12 did not meet it | AU3-01, AU3-03 |
| `masterplan/01_specs.md:302` | OD-24 "portable `cpu-local` … is a later wave" | approved text kept ("whisper.cpp (Homebrew)"); D7(b) "not cancelled", proven on this Mac in M6; Homebrew upgrade risk stated; source-build route put to the gate | AU3-01, AU2-02; D4 kept |
| `masterplan/01_specs.md:309` | — | note listing second-gate items touching this spec (Q-STT-CFG, Q-D7 reframed, Q-WORKER) | AU3-02, AU3-04; D20 |
| `masterplan/01_specs.md:336` | E.1 fragment quantum (GOP assumed controllable) | camera GOP set via ONVIF + observed check; RPO = one GOP; RECOVERY tail validation | AU2-08 |
| `masterplan/01_specs.md:342` | E.1 AV timeline "within +/- 40 ms … ~20 ms common lead-in" | two tolerances (≤ 2 ms regression / ±40 ms product); AAC priming shift; H-10 | AU2-04, AU2-06 |
| `masterplan/01_specs.md:350` | E.2 switch bound "exactly 1 AAC frame … never gaps (0.000 ms)" | input quantum + IPC latency; filtering thread; sample-level gaplessness; OP-CLICK | AU2-05, AU2-07 |
| `masterplan/01_specs.md:360` | E.3 `cpu-local` "(… x86 Linux Core, later wave)" | shipped on the Core and proven on this Mac in M6; nothing coded yet | AU3-01, AU3-02 |
| `masterplan/01_specs.md:365` | E.3 functional check "on CPU" (backend unstated) | on CPU (`cpu-local`); row 12 oMLX run does not satisfy the CPU clause | AU3-01 |
| `masterplan/01_specs.md:413` | F M1 "S4 measured -1.333 ms aligned, 78.667 ms … realised 0.001 ms" | sample-exact 0.00 / 80.021 / −80.052 ms; gaplessness by sample attribution | AU2-03, AU2-05 |
| `masterplan/01_specs.md:415` | F M3 "AV sync 2 + 1; each worker-crash check 2 + 1" | adds two-clock case (H-10) and long-GOP + tail validation | AU2-06, AU2-08 |
| `masterplan/01_specs.md:417` | F M5 "gap at switch within <= 1 AAC frame" | 0 inserted/dropped samples; input quantum + IPC latency | AU2-05, AU2-07 |
| `masterplan/01_specs.md:418` | F M6 (backend unstated) | `cpu-local` installed (source build, GPU off), converted, CPU run quoted; DF-1 on `cpu-local` | AU3-01 |
| `masterplan/10_test_strategy.md:100` | M1-S2-3 "boundary <= 1 AAC frame (21.333 ms); realised drop 0 ms" | sample count + continuity; input quantum bound; 0.001 ms metric not gap evidence | AU2-05, AU2-07 |
| `masterplan/10_test_strategy.md:102` | M1-S4-1 cites "S4 (measured -1.333 ms)" | erratum: true 0.00 ms (+0.021 ms) | AU2-03 |
| `masterplan/10_test_strategy.md:103` | M1-S4-2 "injected 80 ms … (78.667 ms flagged)" | +80 **and −80 ms**, correct sign; 80.021 ms sample-exact; −80.052 ms by AU-2 | AU2-03, AU2-04 |
| `masterplan/10_test_strategy.md:107` | M1-TT-4 "GPU/Metal disabled … (functional-path check on this Mac per D7 reuse)" | **NOT MET at M1** (ran on the Apple GPU); CPU clause moved to the `cpu-local` row and `M6-TF-1` | AU3-01, AU2-01 |
| `masterplan/10_test_strategy.md:157` | M3-AV-1 "within +/-40 ms" | ≤ 2 ms regression bound for 0/+80/−80 ms truths + ±40 ms product bound | AU2-03, AU2-04 |
| `masterplan/10_test_strategy.md:158` | — | new check `M3-AV-2` two-clock AV alignment (H-10), 2+1 | AU2-06 |
| `masterplan/10_test_strategy.md:160` | M3-KC-2 (no tail validation) | adds RECOVERY box-walk tail validation | AU2-08 |
| `masterplan/10_test_strategy.md:161` | — | new check `M3-KC-4` long-GOP crash loss, 2+1 | AU2-08 |
| `masterplan/10_test_strategy.md:196` | M5-SW-W "boundary <= 1 AAC frame (21.333 ms)" | 0 inserted/dropped samples + input quantum bound | AU2-05, AU2-07 |
| `masterplan/10_test_strategy.md:199` | M5-GAP-1 "proven on the S2 acceptance vectors" | plus a negative vector with 1,000 samples removed that must FAIL | AU2-05 |
| `masterplan/10_test_strategy.md:210` | M6-TF-1 (backend unstated, no CPU clause) | runs on both backends; `-ng` quoted on `cpu-local` — CPU clause restored | AU3-01 |
| `masterplan/10_test_strategy.md:211` | M6-DF-1 "with STT running" | with `cpu-local` STT running | AU3-01 |
| `masterplan/10_test_strategy.md:556` | K: "M3 18 … 205 active (+10 conditional) … 82 run 2+1" | M3 20; 207 active (+18 conditional); 84 run 2+1; inline erratum note | AU2-06, AU2-08 (counts); D20 |
| `masterplan/10_test_strategy.md:578` | L.5 "82 checks (40 bare …) … total active 205 + 10 conditional" | 84 (42 bare); 207 + 18 conditional | same |
| `masterplan/02_plan.md:96` | M1 gate "0.001 ms switch, -1.333 ms AV" | live switch, AV within ±40 ms; errata note (blind metric, window artefact, STT-5 CPU clause unmet) | AU2-03, AU2-05, AU2-01 |
| `masterplan/02_plan.md:100` | row 31 "hypotheses H-1..H-9" | + H-10 | AU2-06 |
| `masterplan/02_plan.md:105` | row 36 "205 … 82 run 2+1" | + post-errata 207 (+18 conditional), 84 | AU2-06, AU2-08; D20 |
| `masterplan/02_plan.md:108` | RC-1 "forward-only `ElapsedTicker.freeze()` … 6/6 paths" | erratum "never overshoots the stop" is wrong; ruling D19(b): Core's recorded duration wins once the Core reports the stop (RV-CODE) | AU1-4, AU1-2; D19 |
| `masterplan/02_plan.md:175` | M3-W2 checks without H-10; worker form unstated | `M3-AV-2`; build form per Q-WORKER | AU2-06, AU3-04 |
| `masterplan/02_plan.md:176` | M3-W3 (no tail validation / GOP check) | RECOVERY tail validation; observed-GOP check + OP-GOP; `M3-KC-4` | AU2-08 |
| `masterplan/02_plan.md:177` | M3-W4 fixtures (+80 only, windowed analyser) | 0/+80/−80 truths, sample-exact analyser, long-GOP and separate-clock fake cameras | AU2-03, AU2-04, AU2-06, AU2-08 |
| `masterplan/02_plan.md:201` | M5-W1 "frame-boundary switch" | input-quantum boundary on the filtering thread; sample-count gap check; OP-CLICK | AU2-05, AU2-07 |
| `masterplan/02_plan.md:212` | M6-W1 "`cpu-local` (whisper.cpp, Q-INSTALL item 1)"; deps "Q-INSTALL 1/5" | source build under `.cache/`, GPU off, model converted in the isolated venv; "nothing coded today"; deps add Q-INSTALL 2 + the `cpu-local` row | AU3-01, AU3-02, AU2-02 |
| `masterplan/02_plan.md:217` | — | new "M6 note — the CPU-only STT path on this Mac": build, convert, 2 + 1 proof with `-ng`, Homebrew risk, route at the gate | AU3-01, AU2-01, AU2-02 |
| `masterplan/02_plan.md:376,379` | M3/M6 gate check lists | + `M3-AV-2`, `M3-KC-4`; TF-1 both backends, DF-1 `cpu-local`; conditional R-8 checks | AU2-06, AU2-08, AU3-01; D20 |
| `masterplan/02_plan.md:419` | hypothesis table ends at H-9 | + H-10 → `M3-AV-2`, M3-W4 | AU2-06 |
| `masterplan/02_plan.md:432` | F-6 "Confirm / Reject D7 reuse" (two options) | reframed Q-D7 with three options (a)/(b recommended)/(c) + CPU-runtime route | AU3-02, AU2-02 |
| `masterplan/02_plan.md:434-435` | — | F-10 Q-WORKER; F-11 OP-GOP / OP-CLICK | AU3-04; AU2-07, AU2-08 |
| `masterplan/02_plan.md:470` | — | backlog row AU1-2 with ruling D19(b), implemented by RV-CODE | AU1-2; D19 |
| `masterplan/02_plan.md:593` | self-gate "H-1..H-9", "F-1..F-8" | H-1..H-10; F-1..F-11 | AU2-06; AU3-02/04; D20 |
| `masterplan/03_api_contract.md:235` | op 81 "at the next AAC frame boundary (≤ 1 frame = 21.333 ms)" | next worker input-quantum boundary (≤ 21.333 ms only for a pull loop) | AU2-07 |
| `masterplan/03_api_contract.md:634` | `CAPTURE_GOP_FRAMES` "S1 -g 50 @ 25 fps = 2.0 s; SP-4" | a **target**: enforced only where DEMS encodes; written to the camera via ONVIF; observed check on the copy path | AU2-08 |
| `masterplan/06_evidence_package_spec.md:239` | field 51 `avOffsetMs` "S4 relative flash-to-beep offset" | measured sample-exact; aligned copy path 0.00 ms, not −1.333 ms | AU2-03 |
| `masterplan/07_transcript_spec.md:34` | authority block (no audit note) | errata note: row 12 ≠ CPU proof; `cpu-local` source build/convert/2 + 1; nothing coded | AU3-01, AU2-01 |
| `masterplan/07_transcript_spec.md:228` | B.3 Nature "Portable whisper.cpp on the x86 Linux Core" | also proven on this Mac before the "done on this Mac" line (D7(b)) | AU3-01 |
| `masterplan/07_transcript_spec.md:232` | B.3 Install "Q-INSTALL item 1 (Homebrew `whisper.cpp`; conversion venv …)" | source build under `.cache/`, `GGML_METAL=OFF`, `cmake` from the isolated venv, zero Homebrew change; approved OD-24 text kept; route to the gate | AU2-02, AU3-01; D4 kept |
| `masterplan/07_transcript_spec.md:233-235` | — | new rows: Model (convert in isolated venv / official ggml), Proof on this Mac (2 + 1, `-ng`), Status today (not installed, no model, no code) | AU2-01, AU3-01, AU3-02 |
| `masterplan/07_transcript_spec.md:244` | B.4 Dev vs Core | oMLX = Apple GPU (D229 objection for the product path); only `cpu-local` satisfies the CPU clause | AU2-11, AU3-01 |
| `masterplan/07_transcript_spec.md:294` | C "The proof" (backend unstated) | run with `cpu-local` | AU3-01 |
| `masterplan/07_transcript_spec.md:337` | E.1-1 (backend unstated) | on both backends; `-ng` on `cpu-local` | AU3-01 |
| `masterplan/07_transcript_spec.md:355` | E.2 "Row 12 verdict 7/7 PASS" | + erratum: functional evidence for `omlx-server` only, not for the CPU clause | AU2-01 |
| `masterplan/08_client_ux_spec.md:84` | "forward-only time … the larger value is drawn" | larger value drawn while the Core reports RECORDING; after the stop the Core's recorded duration wins (D19(b)) | AU1-2, AU1-4; D19 |
| `masterplan/08_client_ux_spec.md:256` | §3.7 "they never step back (E-13; RC-1)" | + D19(b) refinement; "never overshoots" corrected (can exceed the stored duration by the stop-learning delay) | AU1-4, AU1-2; D19 |
| `masterplan/08_client_ux_spec.md:609` | P-01 "never steps back (E-13)" | never steps back while RECORDING; authoritative duration after the stop | AU1-2; D19 |
| `research/08_spike_s4_av_sync_fixture.md:21` | (no note; measured −1.333 / 78.667 ms, "common-mode skew", "≤ 40 ms undetectable", windowed analyser, −80 ms not run) | top-of-file ERRATUM table; history unchanged | AU2-03, AU2-04, AU2-06 |
| `research/12_spike_s3_media_engine_pick.md:30` | (no note; "+21.333 ms = 1 AAC frame", "file gap 0.001 ms", "−1.333 ms aligned … 78.667 ms") | top-of-file ERRATUM table; scores and FFmpeg pick unchanged | AU2-03, AU2-05, AU2-07 |
| `gateway_check/04_m1_spike_gate.md:27` | (no note; S2-3 "0.001 ms", S4-1/S4-2 "−1.333 / 78.667 ms", STT-5 PASS on "adaptation documented") | top-of-file ERRATUM table; STT-5 re-read as "CPU clause deferred to the `cpu-local` row", not PASS | AU2-03, AU2-05, AU2-07, AU2-01, AU3-03 |

## 2. R-8 addition (D20)

New user requirement (D20, verbatim: "tambahkan, server STT configurable dan active/deactivate via
config menu. konfigurasinya disimpan ke DB"). Every section is marked **proposed — pending
Q-STT-CFG confirmation at the second gate**; no pinned count changes until confirmed.

> **Status 2026-10-09:** historical record of the 2026-10-08 edit. Q-STT-CFG was answered (a), all 13 defaults, by D24; every R-8 section is now marked confirmed (`03_api_contract.md`, `01_specs.md`: PE-113-01..03, -15; the other spec files: section 5.7, PE-R8-01..22).

| document:line | before | after | source |
|---|---|---|---|
| `masterplan/01_specs.md:214` | requirements R-1..R-7 | new **R-8** (narrative, decisions, 7 proposed acceptance criteria with check IDs) | R-8 addition (D20) |
| `masterplan/01_specs.md:183` | R-5 "inside the sealed package" unconditional | applies only while STT is enabled (if R-8 confirmed) | R-8 addition (D20) |
| `masterplan/03_api_contract.md:107` | registry total 89 | + "proposed, not counted" row: ops 90-92 → 92 (35 GET / 57 POST), audit types 63 if confirmed | R-8 addition (D20) |
| `masterplan/03_api_contract.md:301` | — | new §2.5: ops 90 `getSttConfig`, 91 `updateSttConfig`, 92 `testSttConnection`; RBAC `CAPTURE_CONFIG`; next-session rule; credential never returned; loopback only; test connection rules; no new slice; no new error code | R-8 addition (D20) |
| `masterplan/03_api_contract.md:333` | — | proposed audit type `STT_CONFIG_CHANGED` with exact keys (field names only, `credentialChanged`) | R-8 addition (D20) |
| `masterplan/04_database_contract.md:469` | — | new §B.13 `stt_config` (proposed T-40): KEPT singleton, loopback CHECK, credential as REFERENCE or AES-256-GCM ciphertext, column-level SELECT excludes secrets | R-8 addition (D20) |
| `masterplan/04_database_contract.md:680` | kept set 11 | + proposed row `stt_config` (kept set 12 if confirmed) | R-8 addition (D20) |
| `masterplan/06_evidence_package_spec.md:316` | 120 manifest fields; `transcript.state` `ASSEMBLED`\|`PARTIAL` | new §B.7a: `DISABLED` state, fields 121-123 (`disabledReason`, `backendUnreachable`, `configSnapshot`), disabled package shape | R-8 addition (D20) |
| `masterplan/06_evidence_package_spec.md:575` | §E.5 D-EV-1 only | proposed extension: disabled → step completes as `DISABLED`; unreachable → D-EV-1 + flag | R-8 addition (D20) |
| `masterplan/07_transcript_spec.md:264` | — | new §B.7: configurable fields, DB-backed selection, next-session rule, disabled behaviour, unreachable-backend rule, test connection, never logged | R-8 addition (D20) |
| `masterplan/08_client_ux_spec.md:583` | flows 1-7 | new §8a Flow 8: web configuration menu (edit + test, gated G11/G12), read-only status on tablet/phone, errors, secrecy, checks | R-8 addition (D20) |
| `masterplan/10_test_strategy.md:217` | — | new §A.6a: 8 conditional checks (`M2-STTCFG-DB`, `M6-STTCFG-API/NEXT/OFF/UNREACH/WEB/TAB/PHONE`; 5 run 2 + 1) | R-8 addition (D20) |
| `masterplan/09_security_design_review.md:414` | — | §10 addendum: the R-8 credential/API/network/RBAC surface for the implementing security row | R-8 addition (D20) |
| `masterplan/02_plan.md:379,433` | — | M6 gate lists the conditional checks; F-9 Q-STT-CFG confirm/reject landing | R-8 addition (D20) |

## 3. Counts per finding

Count = rows of section 1 whose source column names the finding (a row may name several); computed by a script over this table (84 rows in section 1, 14 in section 2).

| Finding | Rows | Files touched |
|---|---:|---|
| AU2-03 (−1.333 ms artefact) | 16 | 05, 01, 10, 02, 06, research/08, research/12, gate 04 |
| AU2-04 (regression vs product tolerance; −80 ms case) | 8 | 05, 01, 10, 02, research/08 |
| AU2-05 (blind 0.001 ms gap metric) | 12 | 05, 01, 10, 02, research/12, gate 04 |
| AU2-06 (two-clock H-10) | 16 | 05, 01, 10, 02, research/08 |
| AU2-07 (input-quantum bound, filtering thread, click) | 16 | 05, 01, 10, 02, 03, research/12, gate 04 |
| AU2-08 (crash = one GOP; GOP not enforceable; tail validation) | 14 | 05, 01, 10, 02, 03 |
| AU2-01 / AU3-01 / AU3-03 (CPU-only STT path) | 26 | 01, 10, 02, 07, gate 04 |
| AU2-02 (Homebrew upgrade risk → source-build route) | 5 | 01, 02, 07 |
| AU3-02 (Q-D7 reframed; no "already coded") | 6 | 01, 02, 07 |
| AU3-04 (Q-WORKER) | 4 | 05, 01, 02 |
| AU2-11 (oMLX is Apple GPU) | 1 | 07 |
| AU1-4 / AU1-2 / D19(b) (RC-1 overshoot; authoritative duration) | 5 | 02, 08 |
| R-8 addition (D20) | 14 | 01, 02, 03, 04, 06, 07, 08, 09, 10 |

Before/after sweep (`grep -rn` over `masterplan/`, this file excluded): every remaining occurrence of
`1.333`, `78.667`, `0.001`/`0.000 ms` is inside erratum or withdrawal text — `01_specs.md:164, 350, 413`;
`02_plan.md:96`; `05_capture_architecture_spec.md:54, 518, 548-549`; `06_evidence_package_spec.md:239`;
`10_test_strategy.md:100, 102, 103`. `later wave`, `Q-INSTALL item 1 (Homebrew`, `frame-boundary`,
`common-mode`, `already coded`: 0 hits. `21.333 ms` remains where it is the AAC frame length
(`AUDIO_FRAME_MS`) or a pull-loop qualifier, which is correct. Self-gates
re-run: capture-spec forbidden-muxer grep = 0; transcript-spec `RTF|WER|ms per|real-time factor`
matches are negations only.

## 4. Open points and items outside this row

| # | Item | Owner / where it lands |
|---|---|---|
| OPEN-1 | **CPU-runtime install route.** OD-24 (D4) says "whisper.cpp (Homebrew)"; the specs now describe the source build under `.cache/` (GPU off) as the planned route and keep the approved text until the user answers the reframed Q-D7 | RV-BP (gate question); user at the second gate |
| OPEN-2 | OP-GOP: warning vs `-frag_duration` ceiling when the observed camera GOP is too long (a new `CAPTURE_GOP_TOO_LONG` code would change pinned counts) | M3-W3 design row; decisions log |
| OPEN-3 | OP-CLICK: 5-10 ms crossfade vs accepted click at the mic switch (reconcile with "one active mic") | M5-W1; may be put to the user as a UX choice |
| OPEN-4 | Asymmetric product AV bound (EBU R37 / ITU-R BT.1359) — the audit's figures were not re-verified online; ±40 ms stays in force | documentation row (DOC) before adoption |
| OPEN-5 | R-8 defaults (refuse-while-open vs next-session; `sttConfig` slice; seed default enabled/disabled) | Q-STT-CFG at the second gate |
| OUT-1 | `decisions/decisions.md` D12(a), D13(a)/(c) still state −1.333 / 78.667 ms, 0.001 ms and "never overshoots the stop" | controller (decision-log erratum entry; AU1-4 asks for it) |
| OUT-2 | `research/07_spike_s2_mic_switch_timeline.md` (0.001 ms metric, "1 AAC frame" bound) and `research/10_spike_stt_functional_check.md` (CPU clause) carry the same wrong facts but are outside this row's file list; no erratum note added | controller or a follow-up doc row |
| OUT-3 | `status_tasks.md:24`, `delegation_progress_report.md:25` quote −1.333 ms | controller (trackers) |
| OUT-4 | AU3-07 P-4 gate-file renumber (`10_test_strategy.md:56,120,262` still `06_m2_gate`/`13_m9_gate`) left to blueprint row 41 as scheduled | RV-BP / row 41 |
| OUT-5 | Blueprint rows for the `cpu-local` install + functional check, Q-D7 wording, Q-WORKER, Q-STT-CFG, R-8 rows | RV-BP (`identification/02_structured.md`) |

## 5. Pair-review errata 2026-10-09 (rows 57, 111, 113)

Placed by `data-analyst` on 2026-10-09 by order of decision D68(e). Sources: the three navigator
reviews (`delegation_progress/pair_57_navigator.md` incl. "Re-check of fix round 1",
`delegation_progress/pair_111_navigator.md`, `delegation_progress/pair_113_navigator.md`), the three
driver reports (`implementation/19_m3_supervisor_ipc.md`, `implementation/59_m3_worker_proofs.md`,
`implementation/52_m6_stt_config_api.md`) and decisions D24, D65, D66, D67, D68. Working record:
`delegation_progress/data_analyst_pair_errata_2026_10_09.md`.

Conventions, as in sections 1-2: line numbers are **after** the edit (verified with `grep -n` at
write time); "old text" quotes are abridged; every changed place in a spec carries the inline mark
**Erratum PE-<row>-<nn>** with its decision ID, and the front matter and footer of each edited file
name the range. The pre-edit copies were kept in the session scratch directory and compared with
`diff`; `masterplan/` is tracked in git now, so `git diff HEAD -- docs/.../masterplan/` shows the same
change. Each claim about the code was checked against the code before it was written (working tree
on HEAD `9d3a1ef`, rows 57 / 111 / 113 uncommitted, row 113's fix round 1 landed); code line
numbers are those of that tree.

Rules followed: only `03_api_contract.md`, `01_specs.md`, `05_capture_architecture_spec.md`,
`07_transcript_spec.md` (pointer only), `02_plan.md` (row-84 note only) and this file were edited;
`identification/02_structured.md`, `10_test_strategy.md`, `decisions/decisions.md`, the trackers and
all code were not touched (§5.4-§5.6 list what their owners must do).

### 5.1 Errata table

| ID | spec file:line (after the edit) | old text (abridged) | new text | source file:line | decision |
|---|---|---|---|---|---|
| **PE-113-01** | `masterplan/03_api_contract.md:18,21,771` (front matter, title, footer) | "proposed ops 90-92 for R-8 pending Q-STT-CFG ... registry stays 89 until confirmed"; title "operations 76-89"; footer "proposed §2.5 R-8 ops 90-92" | confirmed by D24 and counted; title "operations 76-92"; footer and front matter name the pair-review errata | `delegation_progress/pair_113_navigator.md:236-237,251`; `decisions/decisions.md:36` (D24) | D24 |
| **PE-113-02** | `masterplan/03_api_contract.md:104,106,107` (§1) | "New registry total 89 operations; projected 34 GET / 55 POST"; "Proposed, not counted (R-8, D20) ... if confirmed the total becomes 92 (35 GET / 57 POST) and audit types 63" | 17 new operations (14 + 3); registry **92**, **35 GET / 57 POST** (89 = the M2 figure); R-8 row "CONFIRMED (D24), COUNTED": audit types 63, error codes 40, slices 30, offline 26 | `delegation_progress/pair_113_navigator.md:238-239`; `packages/shared/test/api-registry.test.ts:285,470,692`; `packages/shared/test/api-openapi-scope.test.ts:297-299`; `packages/shared/test/api-envelope.test.ts:51`; `packages/shared/test/api-state-slices.test.ts:443` | D24 |
| **PE-113-03** | `masterplan/03_api_contract.md:301,303-315` (§2.5 heading and status block) | heading "(PROPOSED — pending Q-STT-CFG confirmation at the second gate; R-8, D20)"; "Status: proposed, not counted ... If confirmed ... If rejected: delete this section" | heading "(CONFIRMED — D24, Q-STT-CFG answer (a); R-8, D20; built by row 113)"; status "confirmed and counted" with the totals as facts, offline 23 -> 26, versions unchanged as built (0.3.0 / 0.2.0; a version step is an open controller item, N-12) | `delegation_progress/pair_113_navigator.md:240-241,43`; `packages/shared/src/api/transcription.ts:384-471`; `packages/shared/src/api/openapi.ts:108,114` | D24 |
| **PE-113-04** | `masterplan/03_api_contract.md:325` (§2.5 op 90, Errors) | "401" | 401; 403 `ORIGIN_NOT_ALLOWED` / revoked device (request-stage guard, Core server only); 503 `NOT_READY` (`STT_CONFIG_NOT_SEEDED`) when the singleton row is missing | `delegation_progress/pair_113_navigator.md:242`; `packages/shared/src/api/transcription.ts:403-405`; `apps/core-server/src/modules/stt-config/index.ts:219-225`; `apps/core-server/src/modules/stt-config/change.ts:75-79` | D68 |
| **PE-113-05** | `masterplan/03_api_contract.md:326` (§2.5 op 91, Request) | `SttConfigUpdate { revision, enabled?, backend?, endpoint?, model?, diarization?, credential? }` — no `language` member, although the reason `LANGUAGE_NOT_SUPPORTED` is named | optional member `language` in the body (only `id`, OD-20; anything else `422 LANGUAGE_NOT_SUPPORTED`, now reachable) | `delegation_progress/pair_113_navigator.md:53,243`; `packages/shared/src/api/transcription.ts:228,312-313`; `implementation/52_m6_stt_config_api.md:245` (D-113-5) | D68 |
| **PE-113-06** | `masterplan/03_api_contract.md:326` (§2.5 op 91, Request) | `credential?: { kind: 'REFERENCE', ref } \| { kind: 'SECRET', value } \| { kind: 'CLEAR' }` (a union) | `credential` is ONE closed object `{ kind, ref?, value? }` with a cross-member rule (REFERENCE: `ref` only; SECRET: `value` only; CLEAR: neither); same accepted set, wire-compatible; anything else 422 | `delegation_progress/pair_113_navigator.md:55`; `packages/shared/src/api/transcription.ts:175-208`; `implementation/52_m6_stt_config_api.md:247` (D-113-7) | D68 |
| **PE-113-07** | `masterplan/03_api_contract.md:326,340` (§2.5 op 91 Errors; new rule row "Stale revision") | "409 (the same optimistic-revision refusal as op 78)" — op 78 defines none (`03_api_contract.md:198`: only `409 CAPTURE_CONFIG_LOCKED`) | `409 INVALID_STATE`, `details.reason: REVISION_CONFLICT`, `details.currentRevision`; nothing stored, no audit row; refused before the named 422 values; a no-op update writes no row and keeps the revision | `delegation_progress/pair_113_navigator.md:52,243`; `packages/shared/src/api/transcription.ts:76-77,282-283,307,432-436`; `apps/core-server/src/modules/stt-config/change.ts:82-86,196-199`; `implementation/52_m6_stt_config_api.md:244` (D-113-4) | D68 |
| **PE-113-08** | `masterplan/03_api_contract.md:326,327,341` (§2.5 op 91 and 92 Errors; new rule row "Credential store (interim)") | no 503 on op 91; op 92 "503 NOT_READY (TRANSCRIBER_NOT_READY)" with no word on who provides the probe | op 91: `503 NOT_READY` (`CREDENTIAL_STORE_NOT_READY`) for a `SECRET` write until the Core credential sealer exists (nothing stored; REFERENCE and CLEAR work); row 84 owns `provideCredentialSealer` + opener; row 115 treats `ENCRYPTED` as unavailable; row 117 offers the reference form only. Op 92: runs a provided probe, answers 503 on every call until row 115 provides it | `delegation_progress/pair_113_navigator.md:56,208-223,243`; `packages/shared/src/api/transcription.ts:80-81`; `apps/core-server/src/modules/stt-config/seams.ts:12-20`; `apps/core-server/src/modules/stt-config/index.ts:110-111,147-149,175-180,264-266`; `apps/core-server/src/modules/stt-config/change.ts:96-100,173`; `implementation/52_m6_stt_config_api.md:242-243` (D-113-2, D-113-3) | D68(c), D68(d) |
| **PE-113-09** | `masterplan/03_api_contract.md:334,339` (§2.5 rules "When a change applies", "Slice") | "The alternative (refuse while open ...) is listed under Q-STT-CFG"; "A `sttConfig` slice is an alternative left to Q-STT-CFG" | both alternatives closed: Q-STT-CFG answered (a), D24 — accepted while open / applies to the next session; no `sttConfig` slice | `delegation_progress/pair_113_navigator.md:244-245`; `decisions/decisions.md:36` | D24 |
| **PE-113-10** | `masterplan/03_api_contract.md:343-351` (§2.5 `STT_CONFIG_CHANGED`) | "(proposed audit type ...)"; "`changedFields: string[]`" | confirmed audit type; `changedFields: string` = the changed field names joined with a comma in the fixed order `enabled, backend, endpoint, model, language, diarization, credential` (audit details are a flat map) | `delegation_progress/pair_113_navigator.md:54,246`; `packages/shared/src/api/transcription.ts:114-117,353-365`; `apps/core-server/src/core/audit-details.ts:118,268-271`; `apps/core-server/src/modules/stt-config/index.ts:248`; `implementation/52_m6_stt_config_api.md:246` (D-113-6) | D24, D68 |
| **PE-113-11** | `masterplan/03_api_contract.md:426` (§4, `NOT_READY` reasons) | `NOT_READY` gains `details.reason: CAPTURE_NOT_READY` only | three more reason values on the existing code (no new code; codes stay 40): `TRANSCRIBER_NOT_READY`, `CREDENTIAL_STORE_NOT_READY`, `STT_CONFIG_NOT_SEEDED` | `delegation_progress/pair_113_navigator.md:56,247`; `packages/shared/src/api/transcription.ts:78-81`; `apps/core-server/src/modules/stt-config/change.ts:57-58,75-79` | D68 |
| **PE-113-12** | `masterplan/03_api_contract.md:447-451` (§5 intro) | "The 9 new types bring the total from 53 to 62" | 10 new types with `STT_CONFIG_CHANGED` (category `DEVICE`); total **63** | `delegation_progress/pair_113_navigator.md:248`; `packages/shared/test/api-registry.test.ts:470`; `packages/shared/src/sim/vocabulary.ts:425,496` | D24 |
| **PE-113-13** | `masterplan/03_api_contract.md:696-722` (§8) | "Which of the 14 are visible in `offline`"; "13 ops"; offline 10 -> 23; `all` 75 -> 89, 34 GET / 55 POST; "The op-count change (89) and the offline count (23)" | 17 operations, 16 simulated (90, 91, 92 added to the visible column); offline 10 -> 23 (M2) -> **26** (M6); `all` 75 -> 89 -> **92**, **35 GET / 57 POST**; counted, with the pins named; versions unchanged at M6 | `delegation_progress/pair_113_navigator.md:43,57,249`; `packages/shared/test/api-registry.test.ts:690-692`; `packages/shared/test/openapi.test.ts:167,216`; `packages/shared/test/api-openapi-scope.test.ts:247,291-299`; `implementation/52_m6_stt_config_api.md:241` (D-113-1) | D24 |
| **PE-113-14** | `masterplan/03_api_contract.md:745,746,748,762-766` (§10 self-gate and open items) | "14/14 new"; "75 + 14 = 89 operations (projected 34 GET / 55 POST) ... offline grows 10 -> 23"; audit types "9/9"; "(88 -> 89), the offline count (22 -> 23), the audit-type count (60 -> 62)" | 17/17 new; 75 + 14 + 3 = **92** (35 GET / 57 POST), offline -> **26**; audit types 10/10; after row 113: operations 92, offline 26, audit types 63, error codes 40 | `delegation_progress/pair_113_navigator.md:250` | D24 |
| **PE-113-15** | `masterplan/01_specs.md:17,183,214,216-222,227,230,314,529` (R-5 narrative, R-8 heading / status / decisions / criteria heading, second-gate note, footer) | "R-8 ... (PROPOSED — pending Q-STT-CFG confirmation at the second gate)"; "Status: proposed (D20) ... not counted in the R-1..R-7 trace and no pinned count changes"; "If the proposed R-8 is confirmed"; "Measurable acceptance criteria (proposed)"; "Q-STT-CFG (R-8 defaults, D20) — pending" | R-8 CONFIRMED (D24, all 13 defaults); counts 92 / 35 / 57 / 63 / offline 26 are counted; criteria "(confirmed, D24)"; Q-STT-CFG answered (a) | `delegation_progress/pair_113_navigator.md:253-255`; `decisions/decisions.md:36` | D24 |
| **PE-113-16** | `masterplan/01_specs.md:229`; `masterplan/02_plan.md:243` (M7-W3 row) | R-8 narrative: credential "encrypted in the Core credential store" with no owner for that store; plan row M7-W3 "session key in Core credential store" with no word on the STT credential | interim rule and owner: blueprint row 84 (M7-W3) owns `provideCredentialSealer` + opener for the STT `SECRET` credential; until then `SECRET` = 503, row 115 treats `ENCRYPTED` as unavailable, row 117 offers the reference form only | `delegation_progress/pair_113_navigator.md:213-223`; `apps/core-server/src/modules/stt-config/seams.ts:15-20`; `apps/core-server/src/modules/stt-config/index.ts:110-111` | D68(c) |
| **PE-57-01** | `masterplan/05_capture_architecture_spec.md:155,162-176,397,427-432` (§A.3 interface sketch, §B.1 interface row, §B.2 "Who starts/stops it") | `CaptureSupervisor` = `start` / `stop` / `switchAudioSource` / `status` / `on` | plus `boot()` (opens the supervisor, starts no worker; edit 11) and `shutdown()` (stops the open session's worker, safe to call twice; edit 12); `status()` reports `queuedEvents`, `droppedEvents`, `droppedTelemetry` | `delegation_progress/pair_57_navigator.md:167-170,247`; `apps/core-server/src/capture/types.ts:90-95,118-129`; `apps/core-server/src/capture/supervisor.ts:553-557`; `implementation/19_m3_supervisor_ipc.md:348` (D57-3) | D65(d) |
| **PE-57-02** | `masterplan/05_capture_architecture_spec.md:408,412,419-425` (§B.2 message table) | eight messages: `START`, `STOP`, `SWITCH_AUDIO_SOURCE`, `TELEMETRY`, `PROGRESS`, `HEARTBEAT`, `WARNING`, `CRASH`; transport not stated | ten messages: `HELLO` (handshake, protocol version) and `ACK` (answer by correlation ID) added; transport NDJSON over stdin/stdout, no socket; strict message union | `delegation_progress/pair_57_navigator.md:167-170,247`; `packages/capture-protocol/src/index.ts:14-27,62-63,283`; `implementation/19_m3_supervisor_ipc.md:346-347` (D57-1, D57-2) | D65(d) |
| **PE-57-03** | `masterplan/05_capture_architecture_spec.md:434-443` (§B.2 "Delivery contract", new) | (no statement; §A.3 said "apply back-pressure") | the worker's output is never paused; `HEARTBEAT` / `ACK` handled inline; two delivery paths (the supervisor's own events are never queued or lost; worker events go through one queue); no back-pressure toward the worker; defaults are hypotheses | `delegation_progress/pair_57_navigator.md:284-302,441`; `apps/core-server/src/capture/supervisor.ts:30-43,59-61`; `packages/capture-protocol/src/index.ts:45-46,101-133`; `implementation/19_m3_supervisor_ipc.md:393-423` | D67 |
| **PE-57-04** | `masterplan/05_capture_architecture_spec.md:155,438-439` (§A.3 Purpose; §B.2 delivery contract rows 3-4) | §A.3 Purpose "apply back-pressure"; driver decision D57-9 "progress and warnings are never dropped" | the worker-event queue is hard-bounded (default 256) and LOSSY: telemetry and progress are levels that may be superseded or evicted; a warning is never evicted for a level; nothing that must never be lost may travel through it | `delegation_progress/pair_57_navigator.md:304-327,438-440`; `apps/core-server/src/capture/supervisor.ts:45-57,225-244`; `packages/capture-protocol/src/index.ts:128-129` | D67 (supersedes D57-9) |
| **PE-57-05** | `masterplan/05_capture_architecture_spec.md:445-455` (§B.2 "REQUIRED WORK for row 58", new) | (no lossless path in the protocol; §A.2 lists `FragmentCheckpoint[]` as published without saying how) | row 58 adds a lossless record frame class handled beside `ACK`: first durable fragment, fragment checkpoint, seal completion; per-session sequence number (a gap = `PROTOCOL_VIOLATION`); "the file is the truth, the frame is a hint"; plus N-1, N-2, N-3 | `delegation_progress/pair_57_navigator.md:323-352,433-437` | D67 |
| **PE-57-06** | `masterplan/05_capture_architecture_spec.md:429-430,457-482` (§B.2 "Restart rule", new) | "Crash handling: restart with exponential back-off" (unqualified) | option C per OD-08: once a session has a durable fragment a crash goes to FAULTED and the interrupted seal; no respawn writes into an existing evidence file; respawn applies before the first durable fragment and between sessions; until the worker reports durability "START acknowledged" = "may be durable"; the code still restarts in-session today (row 58 implements) | `delegation_progress/pair_57_navigator.md:36,380-404`; `implementation/19_m3_supervisor_ipc.md:425-444`; `apps/core-server/src/capture/__tests__/liveness.test.ts:168`; `packages/capture-protocol/src/index.ts:39-44`; `apps/core-server/src/capture/supervisor.ts:384-391` | D67 (OD-08, D4) |
| **PE-57-07** | `masterplan/05_capture_architecture_spec.md:703` (§G G-R1) | "Host modules ... must not import `node:fs`, `node:child_process`, `node:net` or `node:worker_threads`" (no exception) | for `node:fs` the rule holds for every host file except the two pre-capture importers `src/plugins/config/connection-file.ts` and `src/plugins/logger/error-log.ts`; the guard pins exactly those two | `delegation_progress/pair_57_navigator.md:191-194,248`; `apps/core-server/src/plugins/config/connection-file.ts:12`; `apps/core-server/src/plugins/logger/error-log.ts:26`; `apps/core-server/src/capture/__tests__/static.test.ts:113,120-122`; `implementation/19_m3_supervisor_ipc.md:351` (D57-6) | D65(d) |
| **PE-57-08** | `masterplan/05_capture_architecture_spec.md:58,735-788,822` (§0, §I, self-gate) | edits 1-12 with pre-edit anchors (`app.ts:93,129,145,245,310,354`; `index.ts:106,83`); "P25 edit count: 12 (6 in `app.ts`, 4 in `config.ts`, 2 in `index.ts`)"; self-gate "12/12" | edits 1-6 and 11-12 as landed by row 57 (`app.ts:83,90,141,156,258,324,325,371`; `index.ts:108,83`); edits 7-10 still planned (row 58); NEW edits 13-14 = `sttConfigModule` import (`app.ts:102`) and registration (`app.ts:323`) by row 113, waived by D68 extending OD-14's module-registration category; count 14 (8 / 4 / 2), 10 landed; header lines and both pins named | `delegation_progress/pair_57_navigator.md:100-107,196-201,418-422`; `delegation_progress/pair_113_navigator.md:34,199-206,255`; `apps/core-server/src/app.ts:17-21,50,83,90,102,141,156,258,323-325,371`; `apps/core-server/src/index.ts:83,108`; `apps/core-server/src/capture/__tests__/static.test.ts:208,233`; `implementation/19_m3_supervisor_ipc.md:100-160` | D65(e), D68(b) (OD-14, D4; D24) |
| **PE-57-09** | `masterplan/05_capture_architecture_spec.md:155,379-391` (§A.3 Purpose; §B.1 "Closure status", new) | §B.1 lists the six actions under SH-18 as if provided; blueprint row 57 "closes NM-03, CS-01, CS-03, CS-04, SH-18" | row 57 closes NM-03, CS-01, CS-03 only; SH-18 and CS-04 remain open: telemetry / warning actions + forwarder -> row 58; sealing-progress / complete-seal actions -> row 82; hosted pair -> row 66 | `delegation_progress/pair_57_navigator.md:35,145-165,241-245,432`; `implementation/19_m3_supervisor_ipc.md:40-60` | D65(b), D67 |
| **PE-57-10** | `masterplan/05_capture_architecture_spec.md:142` (§A.2 W-6) | (no statement that the row-111 skeleton speaks nothing compatible with the protocol) | row 58 conforms the C worker to `packages/capture-protocol`: the nine-point gap list | `delegation_progress/pair_57_navigator.md:172-189,437` | D67 |
| **PE-111-01** | `masterplan/05_capture_architecture_spec.md:57,682,808` (§0, §F "Video anchoring and drift", §J H-10) | (no anchoring rule; driver proposal "re-anchor on later RTCP sender reports ... expected slope near 0") | video anchored on the per-packet PRFT wall clock with a slew limit and a monotonic-dts guard; "re-anchor on later sender reports" NOT adopted (the fixture's SRs carry no rate information); arrival-vs-camera trend is telemetry only; the present drift case keeps its expectation; SR-drift fixture at row 62; long-session drift stays class C | `delegation_progress/pair_111_navigator.md:137-143,241-277`; `implementation/59_m3_worker_proofs.md:233-239` | D66 (4a) |
| **PE-111-02** | `masterplan/05_capture_architecture_spec.md:557-571` (§C.4 "`movflags` for the camera files", new) | (nothing pinned edit-list or negative-timestamp handling; the held first frame was unknown) | row 58 evaluates `delay_moov` against the S1 file-shape, running-hash and tail-validation checks; fallback = pinned flags + documented held first frame (up to one GOP) + true first video pts in the manifest; `use_editlist=1`, `negative_cts_offsets`, `avoid_negative_ts=disabled` FORBIDDEN with `empty_moov` (446.58 / 454.35 / 452.52 ms shift, decode rc 0), one kept as a negative control | `delegation_progress/pair_111_navigator.md:279-337`; `implementation/59_m3_worker_proofs.md:241-250` | D66 (4b) |
| **PE-111-03** | `masterplan/05_capture_architecture_spec.md:137,192,213-219,339-340` (§A.2 W-1, §A.4 bind address and `M3-RTSP-BIND-1`, §A.8) | bind rule and check cover the TCP listen URL / `lsof -nP -iTCP:<port>` only | the worker owns no datagram socket (RTP over UDP must not open `*:5000` / `*:5001`; `rtsp_transport=tcp` does not prevent it); the bind check covers every socket of the worker process, TCP and UDP, with a UDP-requesting client as negative control | `delegation_progress/pair_111_navigator.md:130,152-177` | D66 (N-1) |
| **PE-111-04** | `masterplan/05_capture_architecture_spec.md:138-139,515` (§A.2 W-2 / W-3, §C.2) | §C.2 "`-flush_packets 1`" as a CLI flag; nothing on a stalled camera | muxer option `flush_packets=1` on each output is required work (28 bytes on disk until close without it); audio keeps fragmenting after a camera stops (801 audio packets = 17.1 s in one final fragment today) | `delegation_progress/pair_111_navigator.md:179-199` | D66 (N-2) |
| **PE-111-05** | `masterplan/05_capture_architecture_spec.md:141,342-351,808` (§A.2 W-5, §A.8 fixture requirements, §J H-10) | fake mics unspecified as to process; one drift case | mics fed from a separate process in the AV checks; row-62 fixture whose sender reports express drift; "camera stops, audio keeps landing" case; one forbidden mux option as negative control | `delegation_progress/pair_111_navigator.md:144-148,221,268-271,334-337` | D66 |
| **PE-111-06** | `masterplan/05_capture_architecture_spec.md:683` (§F "File time 0", new) | "the copy path shifts both streams by one AAC priming frame, 21.333 ms, which cancels" (AV offset only) | file time 0 = T0 minus the AAC priming (21.333 ms = 1,024 samples); anything that maps file time to host time (PCM tap, STT timestamps) adds 1024/48000 s; the term disappears under `delay_moov` | `delegation_progress/pair_111_navigator.md:225,314` | D66 (N-12) |
| **PE-111-07** | `masterplan/05_capture_architecture_spec.md:140` (§A.2 W-4) | (no exit-code rule for a fatal error) | `fatal()` must force a non-zero exit code; a mid-session mux / encoder / selector failure must not look like a clean stop | `delegation_progress/pair_111_navigator.md:205-213` | D66 (N-5) |
| **PE-111-08** | `masterplan/07_transcript_spec.md:19,132,456` (§A.2 "Timeline mapping"; pointer only) | "Chunk `start_ms` / `end_ms` are media-pts offsets relative to `AUDIO-01`" (no priming term) | pointer to capture spec §F "File time 0": a tap sample index n lies at media time (n + 1024) / 48000 s with the pinned flags, 0 extra under `delay_moov` | `delegation_progress/pair_111_navigator.md:225` | D66 (N-12) |

### 5.2 Counts

34 errata: 16 for row 113 (PE-113-01..16), 10 for row 57 (PE-57-01..10), 8 for row 111
(PE-111-01..08). By file: `03_api_contract.md` 14; `01_specs.md` 2 (one shared with `02_plan.md`);
`05_capture_architecture_spec.md` 17; `07_transcript_spec.md` 1. By decision: D24 confirms R-8
(PE-113-01..03, -09, -12..15); D68 records the row-113 driver choices, the credential-store owner and
P25 edits 13-14 (PE-113-04..08, -10, -11, -16; PE-57-08); D65 / D67 carry the row-57 errata; D66 the
row-111 errata.

Sweep after the edit (`grep -n -i` over `03_api_contract.md` and the R-8 section of `01_specs.md`):
"PROPOSED —", "pending Q-STT-CFG", "not counted", "if confirmed" and "if rejected" no longer occur
as R-8 status (the one remaining "not counted" is the withdrawal sentence at `03_api_contract.md:107`;
the "proposed" at `:12`, `:84`, `:759` concern the M2 permission / access-condition additions, not R-8); the remaining "89" / "23" / "62" in
`03_api_contract.md` are the M2 figures, each followed by the M6 figure. The capture spec's
forbidden-muxer self-gate grep is still empty.

### 5.3 What the specs now say that they did not (short form)

| Topic | Statement in force | Where |
|---|---|---|
| R-8 status | confirmed (D24); 92 operations / 35 GET / 57 POST / 63 audit types / offline 26 are counted | C3 §1, §2.5, §5, §8, §10; specs R-8 |
| Stale revision (op 91) | `409 INVALID_STATE`, reason `REVISION_CONFLICT`, `currentRevision` | C3 §2.5 |
| `language` (op 91) | optional body member; `LANGUAGE_NOT_SUPPORTED` reachable | C3 §2.5 |
| `changedFields` | comma-joined string (audit details are flat) | C3 §2.5 |
| `credential` (op 91) | one closed object with a cross-member rule, not a union | C3 §2.5 |
| `SECRET` write | `503 NOT_READY` / `CREDENTIAL_STORE_NOT_READY` until row 84 provides the sealer | C3 §2.5, §4; specs R-8; plan M7-W3 |
| IPC protocol | ten messages incl. `HELLO`, `ACK`; `boot()` / `shutdown()` on the seam | cap §A.3, §B.2 |
| Worker output | never paused; no back-pressure toward the worker | cap §B.2 |
| Event queue | hard-bounded, lossy; levels may be superseded or evicted; warnings never evicted for a level | cap §B.2 |
| Records | lossless record frames with a per-session sequence number = required work for row 58; the file is the truth, the frame is a hint | cap §B.2 |
| Restart | option C (D67): no respawn into an existing evidence file | cap §B.2 |
| G-R1 | two pinned pre-capture `node:fs` importers | cap §G |
| P25 | 14 waived edits (13-14 = `sttConfigModule`, D68) | cap §I |
| Closure | row 57 closes NM-03, CS-01, CS-03 only | cap §B.1 |
| Video anchoring | per-packet PRFT wall clock with a slew limit; drift trend is telemetry only; long-session drift class C | cap §F, §J |
| Mux flags | `delay_moov` evaluated by row 58; fallback pinned flags; three options forbidden | cap §C.4 |
| Worker required work | no UDP sockets, `flush_packets`, audio keeps fragmenting, non-zero exit, separate-process mics | cap §A.2, §A.4, §A.8, §C.2 |
| File time 0 | T0 minus the AAC priming (21.333 ms) | cap §F; transcript spec §A.2 |

### 5.4 Sentences for `identification/02_structured.md` (not edited here; the task-architect owns it)

| Row | Sentence to add (exact) |
|---|---|
| 57 (closes list) | Replace "closes NM-03, CS-01, CS-03, CS-04, SH-18 (OD-14 waiver)" with: "closes NM-03, CS-01, CS-03 (OD-14 waiver); SH-18 and CS-04 are NOT closed by this row (D65, D67): the telemetry and warning INTERNAL actions and the forwarder go to row 58, the sealing-progress and complete-seal actions to row 82, the hosted pair `switchAudioSource` / `setCaptureConfig` to row 66; M3-KC-1 is met for its process half only (the file half is row 58's); the gate sentence 'a killed worker respawns under the supervisor' holds before the first durable fragment and between sessions only (D67, option C per OD-08)." |
| 58 (inherited work) | Add: "Inherited from the row-57 and row-111 pair reviews (D66, D67; cap §A.2 W-1..W-6, §B.2, §C.2, §C.4, §F): (1) lossless record frames with a per-session sequence number for first durable fragment, fragment checkpoint and seal completion - the file is the truth, the frame is a hint; (2) restart rule option C: no respawn into an existing evidence file, 'START acknowledged' counts as 'may be durable' until the durable record exists, F-7 pin renamed and its sibling test added, the init-segment-only file case decided; (3) supervisor N-1 (re-entrant `stop()` from a listener), N-2 (queue cleared at session end), N-3 (warning subjects restricted to device IDs and mic roles); (4) SH-18 / CS-04 part: `applyCaptureTelemetry`, `raiseCaptureWarning` and the forwarder; (5) the C worker speaks `packages/capture-protocol` (nine-point gap list); (6) no datagram socket - RTP over UDP must not open `*:5000` / `*:5001`, and M3-RTSP-BIND-1 covers UDP with a UDP-requesting client as negative control; (7) muxer option `flush_packets=1`, and audio keeps fragmenting after a camera stops; (8) `fatal()` exits non-zero; (9) fake mics fed from a separate process in the AV checks; (10) video anchored on the per-packet PRFT wall clock with a slew limit, arrival-vs-camera trend as telemetry only; (11) `delay_moov` evaluated against the S1 file-shape, running-hash and tail-validation checks, fallback = pinned flags + documented held first frame + true first video pts in the manifest; `use_editlist=1`, `negative_cts_offsets`, `avoid_negative_ts=disabled` forbidden with `empty_moov` by a static rule, one kept as a negative control; (12) file time 0 = T0 minus the AAC priming (21.333 ms) in every file-time to host-time mapping; (13) the file half of M3-KC-1. Starts after row 113 lands." |
| 84 (ownership) | Add: "Also owns `provideCredentialSealer` and the matching opener for the STT `SECRET` credential of operation 91 (D68(c); SEC35-03; same Core credential store, no second store); until this row lands a `SECRET` write answers `503 NOT_READY` (`CREDENTIAL_STORE_NOT_READY`), row 115 treats a stored `ENCRYPTED` kind as unavailable and row 117 offers the reference form only. Verification adds: a `SECRET` write answers 200 with `credentialKind: ENCRYPTED` on a booted server and the key-loader opens it." |

### 5.5 Test-catalogue changes needed (`masterplan/10_test_strategy.md` not edited here)

| # | Check (`masterplan/10_test_strategy.md`) | Change needed | Source |
|---|---|---|---|
| T-1 | `M3-RTSP-BIND-1` (`:165`) | widen from `lsof -nP -iTCP:<port>` to every socket of the worker process (`lsof -nP -a -p <pid> -i`), TCP and UDP, on `127.0.0.1`; negative control = a client that requests RTP over UDP | PE-111-03 |
| T-2 | `M3-KC-1` (`:159`) | record as two halves: process half met at row 57, file half ("fresh playable file") at row 58; its restart wording is true before the first durable fragment and between sessions only | PE-57-06; pair-57 F-5 |
| T-3 | `M3-KC-3` (`:162`) | add the scope of option C: in-session back-off applies before the first durable fragment; new sibling case "crash after the durable record -> FAULTED, launcher not called again, `CAPTURE_FAULT` once" | PE-57-06 |
| T-4 | `M3-AV-1`, `M3-AV-2` (`:157-158`) | fake mics from a separate process; one forbidden mux option kept as a negative control (expected: fails by about 450 ms); the first video sample excluded if the pinned flags stay; `M3-AV-2`'s present drift case keeps "slope = injected value within 2 ms"; a new row-62 case with SR-expressed drift may expect a slope near 0 | PE-111-01, -02, -05 |
| T-5 | `M3-WI-1` (`:156`) | add "both files grow on disk during the session" (size sampled, not only at close) and "a camera stops, the audio of its file keeps landing on disk"; add "a fatal error exits non-zero" | PE-111-04, -07 |
| T-6 | `M3-SR-2` (`:164`, `:407`) | add the static rule that forbids `use_editlist=1`, `negative_cts_offsets`, `avoid_negative_ts=disabled` in the worker (beside AU2-07) | PE-111-02 |
| T-7 | `M3-SR-1` (`:163`, `:406`) | G-R1 wording: `node:fs` except the two pinned pre-capture importers; note the P25 pin now covers edits 13-14 and every added line of `app.ts` | PE-57-07, PE-57-08 |
| T-8 | new check for the lossless record path (row 58) | sequence gap = `PROTOCOL_VIOLATION`; a record is never dropped under a flooded lossy queue; completion is not read from `PROGRESS` | PE-57-05 |
| T-9 | `M6-STTCFG-API` (`:231`) | add: stale revision = `409 INVALID_STATE` / `REVISION_CONFLICT`; a `SECRET` write = `503 CREDENTIAL_STORE_NOT_READY` until row 84; `changedFields` is a comma-joined string; op 92 answers 200 on a booted server once row 115 provides the probe | PE-113-07, -08, -10 |
| T-10 | M3 device gate | one line: after the lane restart the log shows `capture supervisor booted` after the last boot step and `capture supervisor stopped` on SIGTERM | pair-57 F-9 |

### 5.6 Open points and items outside this row

| # | Item | Owner |
|---|---|---|
| OUT-6 | **Other spec files still say PROPOSED / pending Q-STT-CFG** although D24 confirmed R-8: `04_database_contract.md:21,469-473,484,503,680`; `06_evidence_package_spec.md:26,316-319,575`; `07_transcript_spec.md:38-39,264-269` (this row was allowed a pointer only in that file); `08_client_ux_spec.md:583-586`; `09_security_design_review.md:414-418`; `02_plan.md:379,433,485` (this row was allowed the row-84 note only). `10_test_strategy.md` §A.6a is already ACTIVE (D64) | controller: a follow-up doc row with those files in its list. **RESOLVED 2026-10-09 by PE-R8-01..21 (section 5.7)** |
| OUT-7 | `01_specs.md:314-315` still says Q-D7 and Q-WORKER are "pending"; D24 answered both ((a) and (a)). Not a pair-review erratum, so not edited here | controller. **RESOLVED 2026-10-09 by PE-R8-22 (section 5.7)** |
| OUT-8 | OpenAPI `info.version` stayed 0.3.0 / 0.2.0 although `all` gained 3 operations and 6 schemas (pair-113 N-12). The specs now state the versions as built and name this as open | controller decision |
| OUT-9 | `identification/02_structured.md` rows 57, 58, 84: the sentences of §5.4 | task-architect via the controller |
| OUT-10 | `masterplan/10_test_strategy.md`: the changes of §5.5 | test-expert via the controller |
| OUT-11 | Code comments that still describe the open state: `packages/capture-protocol/src/index.ts:39-44` ("NOT decided in the specification yet" — decided by D67); `apps/core-server/src/capture/__tests__/liveness.test.ts:168` (pin to rename, PE-57-06) | row 58 |
| OUT-12 | Line numbers cited for `app.ts`, `stt-config/*` and `capture/__tests__/static.test.ts` are those of the working tree on 2026-10-09 after row 113's fix round 1 landed its header line (`app.ts:20`); a later waived edit moves them. The pins (`static.test.ts:208`, `:233`) are the authority | note |
| OUT-13 | The simulator differs from the server in two answers this erratum fixes for the server only (pair-113 N-10): the simulator accepts a `SECRET` with 200 `ENCRYPTED`, and its operation 92 always answers 200 | row 113 fix round / row 117 |

### 5.7 R-8 / Q-D7 / Q-WORKER status sweep 2026-10-09 (PE-R8-01..22)

Placed by `data-analyst` on 2026-10-09 by order of the controller (closes OUT-6 and OUT-7). Source of the
answers: decision D24 (`decisions/decisions.md:36`: "Q-STT-CFG (a) all 13 proposed R-8 defaults confirmed";
"Q-D7 (a) oMLX for development PLUS the whisper.cpp CPU path built and functionally proven on this Mac";
"Q-WORKER (a) a small C program against libavfilter/libavformat of the installed FFmpeg, spawned and
supervised by the Core"); D20 (`decisions/decisions.md:32`, the requirement and the 13 proposed defaults);
`identification/02_structured.md` "Gate Questions (rev 2.1)" (read only; cited by section because another agent edits that file and its line numbers move); D64 for the check statuses
(`decisions/decisions.md:77`). Working record: `delegation_progress/data_analyst_r8_status_sweep.md`.

Rule followed: **status wording only** - no requirement, number, table, column, field, flow or design text
changed. Where a section still carries a pre-R-8 figure (39 tables, 120 fields, 7/7 flows, the per-milestone
check counts) the figure was **not** restated; the status block says so. Marks are inline
**Erratum PE-R8-nn (D24)**; the front matter and footer of each edited file name the range. Line numbers are
after the edit. `identification/02_structured.md`, `10_test_strategy.md`, `03_api_contract.md` and
`05_capture_architecture_spec.md` were not edited.

| ID | spec file:line (after the edit) | old text (abridged) | new text | source | decision |
|---|---|---|---|---|---|
| **PE-R8-01** | `masterplan/04_database_contract.md:21,894` (front matter, footer) | "proposed §B.13 `stt_config` for R-8 pending Q-STT-CFG ... counts unchanged until confirmed" | "§B.13 `stt_config` CONFIRMED by D24, Q-STT-CFG answer (a)"; the 2026-10-08 entry kept as "added as a proposal" | `decisions/decisions.md:36` | D24 |
| **PE-R8-02** | `masterplan/04_database_contract.md:469-474` (§B.13 heading and status block) | "(proposed T-40) ... (PROPOSED - pending Q-STT-CFG confirmation at the second gate ...)"; "Status: proposed, not counted ... until the user confirms Q-STT-CFG. If confirmed: tables 39 -> 40, kept set 11 -> 12 ... If rejected: delete this section." | "(T-40) ... (CONFIRMED - D24, Q-STT-CFG answer (a) ...)"; "Status: confirmed (D24 ...). With it: tables 39 -> 40, kept set 11 -> 12 ..."; the 39 / 11 figures elsewhere not restated | `decisions/decisions.md:36` | D24 |
| **PE-R8-03** | `masterplan/04_database_contract.md:484` (§B.13 column `enabled`, default) | "seed value per Q-STT-CFG (proposed `true`)" | "seed value `true` (Q-STT-CFG item 11, confirmed D24)" | `identification/02_structured.md` "Gate Questions", Q-STT-CFG item 11 ("enabled"); `decisions/decisions.md:36` | D24 |
| **PE-R8-04** | `masterplan/04_database_contract.md:503,510` (§B.13 privileges; check status) | "Privileges (`0005`, if confirmed)"; "`M2-STTCFG-DB` (conditional ...)" | "(`0005`; confirmed, D24)"; "(active, D24/D64 ...)" | `decisions/decisions.md:36,77` | D24, D64 |
| **PE-R8-05** | `masterplan/04_database_contract.md:680` (kept-on-reset table) | "Proposed by R-8 (D20; pending Q-STT-CFG - not counted)"; "would make the kept set 12" | "Added by R-8 (D20; confirmed, D24, Q-STT-CFG (a))"; "makes the kept set 12" | `decisions/decisions.md:36` | D24 |
| **PE-R8-06** | `masterplan/06_evidence_package_spec.md:26,749` (front matter, footer) | "proposed §B.7a ... field count stays 120 until Q-STT-CFG" | "§B.7a and the §E.5 R-8 extension CONFIRMED by D24"; the 2026-10-08 entry kept as "added as a proposal" | `decisions/decisions.md:36` | D24 |
| **PE-R8-07** | `masterplan/06_evidence_package_spec.md:316-321` (§B.7a heading and status block) | "(PROPOSED - pending Q-STT-CFG confirmation at the second gate ...)"; "Status: proposed, not counted ... not in the 120-field count or the self-gate until the user confirms Q-STT-CFG; if confirmed the manifest has 123 fields ... If rejected: delete this section." | "(CONFIRMED - D24, Q-STT-CFG answer (a) ...)"; "Status: confirmed (D24 ...). With them the manifest has 123 fields and field 92's enum gains `DISABLED`"; the 120-field figures elsewhere not restated | `decisions/decisions.md:36` | D24 |
| **PE-R8-08** | `masterplan/06_evidence_package_spec.md:576,580` (§E.5 R-8 extension) | "Proposed extension (R-8, D20; pending Q-STT-CFG)"; "`M6-STTCFG-OFF` / `M6-STTCFG-UNREACH` (conditional)" | "Extension (R-8, D20; confirmed, D24, Q-STT-CFG (a))"; "(active, D24/D64)" | `decisions/decisions.md:36,77` | D24, D64 |
| **PE-R8-09** | `masterplan/07_transcript_spec.md:19,456` (front matter, footer) | "proposed §B.7 R-8 STT configuration" | "§B.7 R-8 CONFIRMED by D24"; the 2026-10-08 entry kept as "added as a proposal" | `decisions/decisions.md:36` | D24 |
| **PE-R8-10** | `masterplan/07_transcript_spec.md:38-39` (header note) | "R-8 STT configuration (§B.7, proposed, pending Q-STT-CFG)" | "(§B.7, confirmed by D24, Q-STT-CFG answer (a))" | `decisions/decisions.md:36` | D24 |
| **PE-R8-11** | `masterplan/07_transcript_spec.md:264-269` (§B.7 heading and status block) | "(PROPOSED - pending Q-STT-CFG confirmation at the second gate ...)"; "Status: proposed."; "Nothing here is counted or scheduled until Q-STT-CFG is confirmed." | "(CONFIRMED - D24, Q-STT-CFG answer (a) ...)"; "Status: confirmed (D24 ...)."; "Counted and scheduled as the R-8 rows of blueprint rev 2.1 (D24 ...)" | `decisions/decisions.md:36`; `identification/02_structured.md` rows 112-119 and the R-8 trace row | D24 |
| **PE-R8-12** | `masterplan/08_client_ux_spec.md:28,717` (front matter, footer) | "proposed §8a Flow 8 STT configuration" | "§8a Flow 8 CONFIRMED by D24"; the 2026-10-08 entry kept as "added as a proposal" | `decisions/decisions.md:36` | D24 |
| **PE-R8-13** | `masterplan/08_client_ux_spec.md:583-587` (§8a heading and status block) | "Flow 8 (PROPOSED) ... pending Q-STT-CFG confirmation at the second gate"; "Status: proposed (D20). Not counted in the 7/7 flows, the 10/10 gated controls or the self-gate until the user confirms Q-STT-CFG. If confirmed: flows 8/8 (24 client definitions), gated controls G11-G12 added." | "Flow 8 (CONFIRMED) ... D24, Q-STT-CFG answer (a)"; "Status: confirmed (D24 ...). With it: flows 8/8 (24 client definitions), gated controls G11-G12 added"; the 7/7 and 10/10 figures elsewhere not restated | `decisions/decisions.md:36` | D24 |
| **PE-R8-14** | `masterplan/09_security_design_review.md:27,429` (front matter, footer) | "§10 addendum for the proposed R-8 STT configuration surface" | "§10 confirmed by D24"; the 2026-10-08 entry kept as "added as a proposal" | `decisions/decisions.md:36` | D24 |
| **PE-R8-15** | `masterplan/09_security_design_review.md:414-420` (§10 heading, intro, table header) | "Addendum - proposed R-8 STT configuration surface (... pending Q-STT-CFG, D20)"; "if the user confirms Q-STT-CFG"; "Design in the proposed sections" | "Addendum - R-8 STT configuration surface (... CONFIRMED by D24, Q-STT-CFG answer (a); D20)"; "the user confirmed Q-STT-CFG on 2026-10-08 (D24)"; "Design in the R-8 sections" | `decisions/decisions.md:36` | D24 |
| **PE-R8-16** | `masterplan/02_plan.md:379` (M6 gate row) | "**conditional** M6-STTCFG-* + M2-STTCFG-DB (8, pending Q-STT-CFG, test §A.6a)" | "**active (were conditional)** ... (8; Q-STT-CFG answered (a), D24, test §A.6a active per D64)" | `decisions/decisions.md:36,77` | D24, D64 |
| **PE-R8-17** | `masterplan/02_plan.md:381` (M8 gate row) | "**proposed** M8-EV-SCOPE-1 (sec SEC35-16)" | "**active** M8-EV-SCOPE-1 (sec SEC35-16; Q-SEC-1 (a), D24; active per D64)" | `decisions/decisions.md:36,77`; `masterplan/10_test_strategy.md:278` (read only) | D24, D64 |
| **PE-R8-18** | `masterplan/02_plan.md:433` (F-9) | "Q-STT-CFG - R-8 STT configuration menu (D20)" with Confirm / Reject landing | "... - ANSWERED (a), all 13 defaults confirmed, D24: the Confirm branch is in force"; Confirm / Reject text unchanged | `decisions/decisions.md:36` | D24 |
| **PE-R8-19** | `masterplan/02_plan.md:485` (G.2 table header) | "Landing if confirmed" | "Landing if confirmed (in force: Q-SEC-1 (a), Q-SEC-2 (a), Q-SEC-3 default, D24)" | `decisions/decisions.md:36` | D24 |
| **PE-R8-20** | `masterplan/02_plan.md:575,576` (per-milestone check counts) | "M3 13 (incl. proposed `M3-RTSP-BIND-1`)"; "M8 11 (incl. proposed `M8-EV-SCOPE-1`)" | "(incl. `M3-RTSP-BIND-1`, active per D64)"; "(incl. `M8-EV-SCOPE-1`, active per D64)"; the figures 13 / 11 and the others NOT reconciled | `decisions/decisions.md:77` | D64 |
| **PE-R8-21** | `masterplan/02_plan.md:432,434` (F-6, F-10) | F-6 "OD-24 / D7 TranscriberAdapter confirmation"; F-10 "Q-WORKER - capture-worker build form" (open items) | F-6: "ANSWERED, D24: oMLX for development PLUS `cpu-local` proven on this Mac - this row's option (b), labelled Q-D7 (a) in the blueprint - is in force"; F-10: "ANSWERED (a), D24: C program is in force"; option texts unchanged | `decisions/decisions.md:36`; `identification/02_structured.md` (AU3-02, AU3-04 and Gate Questions Q-D7 / Q-WORKER) | D24 |
| **PE-R8-22** | `masterplan/01_specs.md:17,314-316,529` (front matter, second-gate note, footer) | "Q-D7 reframed ... - **pending**; Q-WORKER ... - **pending**" | "answered (a), D24: oMLX for development plus the whisper.cpp CPU path proven on this Mac"; "answered (a), D24: a small C program against libavfilter/libavformat of the installed FFmpeg, spawned and supervised by the Core" | `decisions/decisions.md:36` | D24 |

Counts: 22 errata. By file: `04_database_contract.md` 5, `06_evidence_package_spec.md` 3, `07_transcript_spec.md` 3,
`08_client_ux_spec.md` 2, `09_security_design_review.md` 2, `02_plan.md` 6, `01_specs.md` 1.

Left as they are (listed for the controller, not edited): `05_capture_architecture_spec.md:212` still
calls `M3-RTSP-BIND-1` a "proposed addition" (the file was out of scope for this sweep; the check is
active per D64); `07_transcript_spec.md:38` still says "Nothing of either backend is coded yet"
(a status statement from 2026-10-08 that is not an R-8 / Q-D7 / Q-WORKER item); `06_evidence_package_spec.md`
carries a second front-matter key `last_updated` at line 21 (pre-existing duplicate).

---
*Generated: 2026-10-08*
*Last Updated: 2026-10-09 (section 5: pair-review errata PE-57-01..10, PE-111-01..08, PE-113-01..16; D24, D65-D68; section 5.7: status sweep PE-R8-01..22, D24/D64)*
