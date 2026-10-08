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
last_updated: 2026-10-08
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

---
*Generated: 2026-10-08*
*Last Updated: 2026-10-08*
