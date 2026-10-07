---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: task-architect
revision: 1.0 (initial blueprint, for BLUEPRINT_APPROVAL)
status: draft-for-approval
tiering: default  # 01_translated.md carries no `tiering` field; its `model_tier: default` is copied here
scale_category: Enhancement (major, contract-breaking) with embedded Research (technical spikes)
professional_document: false
source_original: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/01_original.md
source_translated: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/01_translated.md
repository_baseline: HEAD 85c0fb5 (docs) on top of c2c983b (last code state); diff baseline for this task c2c983b
---

# Structured Task Blueprint: DEMS — real capture devices, sealing v2 and transcript (next phase)

## 0. Summary

| Item | Value |
|---|---|
| What this blueprint is | The mature framework for task 3. It covers milestones M0-M9 and sorts all work into class A (starts right after approval), class B (waits for a gate answer) and class C (waits for hardware). It puts every open decision to the user in one batch (`## Gate Questions`, 29 items) |
| What it is not | A full spec. The detailed specs and the implementation plan are blueprint rows 28-37 (masterplan phase) and run after approval |
| Inputs consumed | Impact map `10_next_phase_impact_map.md` (D228) and drift check `11_next_phase_drift_check.md` (D260), both in `docs/2026-10-04_dems_backend_rbac_pairing/research/`; decisions D219-D233, D260; report inputs §4 (B2-B17, A1-A6, C1-C9). No codebase re-analysis before the gate (AS-3). Row 1 re-verifies the tree after approval |
| Rows in this revision | 40: research/initialization 15, class-A backlog implementation 8, checkpoint reviews and regression 4, masterplan specs and plan 10, gates 2, refinement 1 |
| Hardware-independent completion line | Defined in §5 and marked in the milestone table: M0-M8 complete against fake RTSP, fake audio and a fake ONVIF stub; M9 complete for regression, docs and security. Real adapters, physical devices and the Core-device benchmark are class C |
| Next approval | BLUEPRINT_APPROVAL now. A second gate follows row 40, because the refinement adds the M2-M9 implementation rows (MAJOR by construction) |

---

## 1. Prior Task Continuity

### 1.1 Summary of the predecessor (task 2, closed 2026-10-07)

| Item | State | Source |
|---|---|---|
| Outcome | Fastify Core on PostgreSQL 18 (`127.0.0.1:4432`), 75 operations, server-side RBAC, pairing, Live mode on web and mobile; SC 8 PASS / 3 CAUTION / 0 FAIL | `report/report.md` §1 |
| Commits | `0a9e317` (code + evidence), `c2c983b` (report), `85c0fb5` (drift check docs); local only, no remote | report §6; git log |
| Test ledger | shared 71/1,851; core-server unit 160/3,954; db 124/1,751; core-web 117/1,495; mobile 192/1,988 | report §2; drift check E-06 |
| Host state | PostgreSQL running, only `dems_demo`; three emulators paired to the main instance (DEV-0003/0004/0005); no Core, Vite or Metro running | drift check §4 |

### 1.2 Inherited decisions (live)

| Decision | Content carried | Where it lands |
|---|---|---|
| D219 (1)-(3) | Selector in the Core (web/tablet/phone); capture worker behind the API; no new session until SEALED | R-1, R-2, R-6 |
| D220, D221 | One active mic, the second is a failover; manual UI toggle; one audio source at playback | R-3; OD-09, OD-11 |
| D222, D223 | Transcript inside the seal; STT on CPU + RAM; sealing waits for the transcript; rooms may wait | R-5, R-6 |
| D224, D225 | One whole file per camera; append-only fMP4 with a running SHA-256 | R-4; OD-21 |
| D226 (labels part), D229, D230 | Labels mandatory when possible; Whisper large-v3-turbo on disk; no benchmark on this Mac | R-5, R-7; OD-20, OD-24 |
| D231 | No biometric device steps | §11 test strategy |
| D232, D233 | 2 runs + 1 verification per check; long campaigns only when the user announces handover | all gates |
| This task D1, D2 | Full protocol; nothing executes before approval; local commits only; Indonesian to the user, English in `/docs` | process |

### 1.3 Superseded (never revived as requirements)

| Superseded item | Superseded by |
|---|---|
| D223 "master multi-track remux" | D224, D225 |
| D226 benchmark plan on this Mac | D230 |
| D219 "audio input feeds MIC 1/2" | D220, D221 (primary/standby) |
| Controller's AUDIO-MIX track; speaker attribution by channel | D220 (withdrawn) |
| MLX fp16 copy of the model | D229 (Apple GPU only; conflicts with D222 and an x86 Core) |

### 1.4 Open items inherited

B2-B17, A1-A6 and C1-C9 from `report/01_report_inputs.md` §4. Placement in §8 (after the table).

### 1.5 Conflicts found and how this blueprint resolves them

| # | Conflict | Resolution |
|---|---|---|
| CF-1 | The task-architect agent file quotes "max 2 per agent type". `~/.claude/CLAUDE.md` §6 and memory `feedback-parallelism-push-to-limit` say 8 | CLAUDE.md governs: 8 in flight, 8 per type, single-writer resources still serialise (§10 parallel plan) |
| CF-2 | The protocol puts only research/spec rows in an initial non-research blueprint. The user and controller asked for class-A backlog to start right after approval | Admitted only for backlog rows that need no decision and no research result (B2, B10, RC-1; rows 16-27). Each has its own review and a regression checkpoint. **Controller to record as a decision** |
| CF-3 | Impact map M1 = benchmark | D230 removes it; M1 = spikes + functional STT (E-22) |
| CF-4 | Task 2's SC8 "simulator untouched" rule and the `acaff20` diff gate | Retirement is OD-23; until answered, no simulator edit is planned (none in rows 1-40) |
| CF-5 | D229 says "no download needed" for STT. Diarization and VAD models are not on disk, and converting the HF model may need Python packages | Surfaced in OD-20, OD-24 and Q-INSTALL (items 2, 5) |

---

## 2. Memory Screening

| Memory | Finding used here |
|---|---|
| `feedback-parallelism-push-to-limit` | 8 parallel agents is the standing ceiling |
| `feedback-test-depth-2-plus-1` | Every device/browser/spike check: 2 runs + 1 verification run |
| `feedback-autonomy-with-decision-log` | Autonomy is not assumed for a new task; asked once (Q-AUTO) |
| `feedback-ready-made-frameworks` | FFmpeg/GStreamer, whisper.cpp/CTranslate2, sherpa-onnx, an ONVIF library before hand-building; hand-built parts become decisions |
| `feedback-no-device-security-changes` | No agent sets or types the emulator PIN; no emulator rows in this revision |
| `user-profile-dems` | Short directives, quick approvals: every gate item carries a default and a one-line consequence |
| `reference-dems-environment-gotchas` | Stay at the repo root (sandbox cwd); never touch SMART WMS ports `[::1]:5173`, `127.0.0.1:5174`, `[::1]:5175`; use `/usr/bin/lockf -k`, not `flock`; per-workspace test runs with `--maxWorkers=2`; the design-book `.docx` never leaves the machine |
| `project-dems-demo-state` | Confirms the task 3 scope, the closed task 2 state and the start rule (request-translator first, all ODs at the gate) |

---

## 3. Architecture Challenge & Refinement

### 3.1 Dimension challenge

| Dimension | Challenge | Result |
|---|---|---|
| Intent | "Mature framework" could mean an M0 document or the whole phase | Whole phase M0-M9, stopping at the gate (AS-2). Success = one-sitting approval, then work starts without re-planning |
| Scale category | Enhancement or New Project? | Enhancement, major and contract-breaking: 75 -> about 88 operations, schema v2/`dbc-3`, manifest v2, new workspaces. The spikes are an embedded Research track. Not greenfield: the Core, contract and clients exist and are extended under the shared simulator (A-1) |
| Source | Is the impact map still true? | The drift check verified 471 references against `c2c983b` (0 gone). HEAD is now `85c0fb5` (docs only). Row 1 re-verifies after approval and does not repeat the analysis |
| Spec | Which requirements are measurable today? | R-1..R-7 are decided. Acceptance criteria are not yet measurable for R-3 (thresholds OD-11), R-4 (encryption OD-03, legal OD-21) or R-5 (runtime OD-24). These become measurable in rows 28-33 after the gate answers |
| Impact | Blast radius | 165 of 630 test files at most (map §7; recount 159 of 664); 4 workspaces plus 3 new ones; 9 new and 5 changed tables; 3 FAULT_KIND CHECKs (E-01); P25 frozen files; 21 static guards. Row 6 consolidates this into one register |
| Goals | Testable? | G1-G7 of the translation map onto sections 5-12 and rows 6, 28-40 (§7 trace) |
| Scope | What is out? | `apps/mock-core`, `release/`, the design book, production OS/installer/TLS PKI, QR scanning (B14, DR-02), biometric device test (D231) |
| Constraints | Hidden non-functional ones | (a) CPU-only STT; (b) capture must outrank STT for CPU; (c) about 8 GB/h of media (map §9), so real media stay out of git (OD-25); (d) loopback-only listener (SR-01); (e) host load flakes wall-clock tests; (f) one lockfile writer; (g) one Homebrew installer at a time |
| Assumptions | Risky ones | (1) FFmpeg 9.0.2 alone can stand in for an RTSP camera through RTSP listen (push) mode: **hypothesis**, tested in row 7. (2) FFmpeg `astreamselect` can switch inputs at runtime: **hypothesis**, row 8. (3) Converting HF safetensors to ggml/CT2 needs Python packages: **hypothesis**, row 4. (4) espeak-ng has an Indonesian voice: **hypothesis**, row 2 |
| History | Applicable lessons | Lane DBs are gone (E-24); tablet learns state late under load (B11, P-12); Reanimated lost updates in Finalizing (MB-04 High); evidence frames ignored, not deleted (D227) |
| Multi-document | Paths valid? | All six source paths read on 2026-10-07; the decision rows D219-D233 (lines 225-239) and D260 (line 266) are present |

### 3.2 Refinements made

| # | Refinement |
|---|---|
| RF-1 | Class-A spikes use only the FFmpeg already on the host. The GStreamer comparison needs an install, so it is class B (Q-INSTALL item 3). If the install is declined, the pick becomes a desk memo (row 15) |
| RF-2 | Spike S1 uses RTSP listen (push) mode because no RTSP server is installed. The real topology is pull from a camera; pull fixtures need MediaMTX (Q-INSTALL item 4) and belong to M3 (NM-14) |
| RF-3 | The AV-sync fixture is its own spike (S4, row 9), not part of S1. It is a separate concern and seeds NM-14 |
| RF-4 | The STT path is split into install (row 10), conversion (row 11) and functional check (row 12), each with one verifiable output. No RTF figure is produced (D230) |
| RF-5 | Diarization and VAD model downloads are not covered by D229. They are added to OD-20 and Q-INSTALL item 5 and placed in M6 |
| RF-6 | OD-03 default records two hashes: one over the stored bytes, so integrity can be checked without the key, and one over the plaintext whole file, for decrypted exports. This avoids choosing one before S1 evidence exists |
| RF-7 | Task-2 decision C5 (web-only recording) is folded into OD-09, and C9 (iii) into Q-INSTALL. C1-C4, C6 and C8 stay outside this scope with their defaults |
| RF-8 | The `chrome-lost-updates` test's workspace is not named in the sources. Row 1 locates it before row 21 runs |
| RF-9 | Q-AUTO governs behaviour inside approved scope. It never removes an approval gate (CLAUDE.md §4) |
| RF-10 | Every spike writes media only under git-ignored `.cache/spikes/<id>/` (`.gitignore` has `.cache/`, drift check §4). This keeps the spikes decision-free before OD-25 is answered |

---

## 4. Scale Category Design

| Aspect | Enhancement posture (this task) | Embedded Research posture (spikes) |
|---|---|---|
| Research focus | Existing contract, DB, simulator seam, clients; compatibility of v1 evidence (OD-02) | Feasibility of fMP4 + running hash, gapless mic switch, AV sync, CPU STT path, engine choice |
| Specification output | Change spec per domain (rows 28-36): API contract C3, `dbc-3`, capture architecture, evidence package v2, transcript, client UX, security design, test strategy | Spike reports with measured criteria; engine pick memo (row 15) |
| Impact validation | Regression per workspace; Simulated-mode regression against `c2c983b` (OD-23); migrations on a throw-away copy of `dems_demo` plus fresh lanes | Independent +1 verification run at the M1 gate (row 38) |
| Agent mapping | explore, data-collector (source); data-analyst, database-specialist (spec); security-review, test-expert (impact); coder-execution (spikes, backlog); verifier (gates) | coder-execution for prototypes in scratch; data-analyst for the decision memo |

### 4.1 Source -> Spec -> Impact (consume and verify, not redo)

| Triad leg | What already exists | What this task adds | Rows |
|---|---|---|---|
| Source | Impact map (D228), drift check (D260), decisions, report inputs | Re-verification of repository facts after `85c0fb5`; host readiness; generic technology/licence facts; dependency triage | 1, 2, 3, 4, 5 |
| Spec | Map §5 (contract), §6 (DB), §4 (modules), proposals only | Gate answers turned into measurable specs; spike evidence turned into design facts | 28-37 |
| Impact | Map §3, §7, §9; drift check §2, §5, §6 | One errata-applied register (31/31 errata), security design review, test strategy with pinned-count lists | 6, 35, 36 |

---

## 5. Work Classes and the Hardware-Independent Completion Line

| Class | Definition | Start condition | Examples |
|---|---|---|---|
| **A** | Needs no new user decision and no hardware | Right after BLUEPRINT_APPROVAL | Rows 1-9, 16-27; M0 specs parts that depend only on decided items; S1, S2, S4 spikes; B2, B10, RC-1 |
| **B** | Unblocked by a named gate answer (OD-xx, Q-AUTO, Q-INSTALL) | When that answer is recorded in `decisions/decisions.md` (normally at the same gate) | Rows 10-14 (installs), rows 28-37 (specs needing OD answers); M2-M8 implementation |
| **C** | Needs physical hardware or the real Core device | When Q-HW hardware is on the LAN and the entry criteria in §9 hold | Real camera/PoE/mic adapters, physical tablet/phone e2e, Core-device STT benchmark, TPM signer, long AV-drift run |

**DONE ON THIS MAC WITH FAKE DEVICES (hardware-independent completion line).** The task reaches its Mac-complete state when all of these hold:

1. M0-M3 and M5-M8 gates pass against fake RTSP sources, fake audio inputs and a fake ONVIF stub (NM-14), plus the simulated capture driver.
2. M4 passes for the selector (API, DB, audit, three clients on emulators) and for the fake adapters.
3. M9 passes the full regression, docs and the final verification chain.

Every class-C item then sits in a documented "class-C entry pack" (§9) with its entry criteria and its own gate, so hardware can activate those rows without re-planning.

---

## Structured Task Breakdown

> **PRIMARY OUTPUT — Controller-Executable Table.** The master controller reads each row as one delegation unit. If any narrative text conflicts with this table, the table governs.
>
> **Row conventions:**
> - **Description prefixes.** `[Mx|A]`, `[Mx|B: ...]`: milestone and class, with the gate item that unblocks a class-B row. `GA` = the BLUEPRINT_APPROVAL answers recorded in `decisions/decisions.md`; `GA:OD-xx` = that specific answer.
> - **Tier tags.** These are given in Expected Output. The controller appends the matching tier block (CLAUDE.md §8) to each prompt.
> - **Output paths.** All are relative to `/Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/`.
> - **Spike guard rails (rows 7-14).** Use synthetic sources only. Write media only under `/Users/gsp-budi/Documents/DEMS/.cache/spikes/<id>/`. Make no repository source edits. Use ports 8554-8564 only after row 2 shows them free. Never touch SMART WMS ports. Use no emulators. Run no sudo commands.
> - **Test rows (16-27).** Run per workspace with `--maxWorkers=2`, from the repository root.

| Step | Task Description | Agent_to_Invoke | Expected Output | Depends On | Verification | Phase |
|------|------------------|-----------------|-----------------|------------|--------------|-------|
| 1 | [M0\|A] Re-verify the impact map's repository facts against the current tree: HEAD hash, source files under apps/ packages/ scripts/ changed after 2026-10-07 12:40, the F-01 ingest grep, the static-guard count, the registry operation count; record the path of the `chrome-lost-updates` test named in B10 | explore | research/01_explore.md (Tier 2) | GA | Each fact has its command plus output; changed-file count stated (0, or listed with the map rows they hit); F-01 non-test hits = 0 or listed; static guards = 21 or delta listed; operations = 75; `chrome-lost-updates` path stated | research |
| 2 | [M0\|A] Probe host readiness read-only: PostgreSQL on 127.0.0.1:4432 with its database list, FFmpeg version with RTSP-listen plus fMP4 muxer options, free disk, file names/sizes under `~/.omlx/models/whisper-large-v3-turbo`, ports 8554-8564 free, absence of gst-launch-1.0 / whisper-cli / ct2 tools, espeak-ng Indonesian voice | explore | initialization/01_env_check.md (Tier 3) | GA | Every probe line has command plus output; free disk stated in GiB; listening-port list identical before vs after the probe (no process started or stopped); SMART WMS ports not contacted | initialization |
| 3 | [M0\|A] Collect capture/media-stack facts with generic queries only: FFmpeg fMP4 flags, RTSP listen mode, runtime input switching (astreamselect), CENC in the mp4 muxer; GStreamer isofmp4mux/input-selector on Homebrew; MediaMTX; ONVIF client libraries; LGPL/GPL build-flag implications | data-collector | research/02_collection.md (Tier 2) | GA | Every fact cites a URL or local `ffmpeg -h` output; query log lists every query with 0 project names, paths or identifiers | research |
| 4 | [M0\|A] Collect STT/diarization-stack facts with generic queries only: whisper.cpp vs CTranslate2 CPU runtimes, the conversion path for an HF-format large-v3-turbo (required Python packages, download sizes), pre-converted model alternatives, sherpa-onnx 2-speaker diarization models, Silero VAD, licences of code plus weights | data-collector | research/04_collection_stt.md (Tier 2) | GA | Every fact cites a URL; conversion toolchain listed per runtime with package names plus download size; licence named per component; query log with 0 project identifiers | research |
| 5 | [M0\|A] Triage B2: run `npm audit` (full plus `--omit=dev`), classify every high advisory by path (Core runtime, client runtime, dev), propose target versions incl. `undici` >= 7.29.1; no `npm audit fix` | security-review | research/05_b2_dependency_triage.md (Tier 2) | GA | Advisory rows = `npm audit --json` high total (99 expected, delta explained); each row has path class plus action; `git diff --stat package-lock.json` empty | research |
| 6 | [M0\|A+B] Build the errata-applied impact register: E-01..E-31 applied to the map rows, new rows SH-25/CS-25/WB-11, row-1 deltas folded in, each gate answer mapped to the rows it changes, R-1..R-7 trace, superseded decisions marked | data-analyst | research/03_analysis.md (Tier 1) | 1, GA | 31/31 errata mapped with before/after; every row ID SH-01..25, CS-01..25, WB-01..11, MB-01..13, DOC-01..06, NM-01..14 present once; R-1..R-7 each traced to >= 1 row; every answered gate item cited by decision ID | research |
| 7 | [M1\|A] Spike S1 in `.cache/spikes/s1/`: synthetic RTSP/TCP source (FFmpeg lavfi pushing into an FFmpeg ingest in RTSP listen mode) copied without re-encode into fragmented MP4 with 1-2 s fragments, running SHA-256 per fragment with a chain hash, SIGKILL mid-write, durable-prefix re-hash | coder-execution | research/06_spike_s1_fmp4_running_hash.md (Tier 2) | 2 | In 2 runs: ffprobe reads the file while it grows; running hash = `shasum -a 256` of the closed file; fragment sequence contiguous; truncated tail after SIGKILL detected, prefix hash recomputed; `git status --porcelain` lists 0 media files | research |
| 8 | [M1\|A] Spike S2 in `.cache/spikes/s2/`: two synthetic mic inputs (sine 440 Hz, 880 Hz) feeding ONE AAC 48 kHz track through a runtime-switchable selector (FFmpeg astreamselect commands, candidate), one manual switch per run, switch instant logged as a source interval | coder-execution | research/07_spike_s2_mic_switch_timeline.md (Tier 2) | 2 | In 2 runs: ffprobe shows exactly 1 audio stream; audio PTS strictly monotonic; discontinuity at the switch <= 1 AAC frame (21.3 ms); interval log holds from/to media ms for both inputs | research |
| 9 | [M1\|A] Spike S4 in `.cache/spikes/s4/`: synthetic flash+beep generator with an offset analyser (NM-14 seed), passed through the S1 pipeline | coder-execution | research/08_spike_s4_av_sync_fixture.md (Tier 2) | 7 | In 2 runs: measured AV offset within ±40 ms; analyser self-test flags an injected 80 ms offset | research |
| 10 | [M1\|B: GA:OD-24, GA:Q-INSTALL] Install the approved CPU STT runtime (default whisper.cpp via Homebrew), with an isolated Python venv under `.cache/stt-venv/` only if row 4 shows conversion needs it; record each uninstall command; no sudo | coder-execution | initialization/02_stt_runtime_install.md (Tier 3) | 2, 4, GA:OD-24, GA:Q-INSTALL | Runtime `--help` (or CTranslate2 import) exits 0; per item: version, size, uninstall command; 0 files written outside the Homebrew prefix plus `.cache/`; or a SKIPPED record citing the decision ID | initialization |
| 11 | [M1\|B: GA:OD-24] Convert `~/.omlx/models/whisper-large-v3-turbo` (read-only source) into the runtime format under `.cache/stt-models/`, behind a configurable model path | coder-execution | research/09_spike_stt_model_conversion.md (Tier 2) | 10 | Converted file exists with size plus SHA-256 recorded; source folder file list plus sizes identical before vs after; conversion output quoted | research |
| 12 | [M1\|B: GA:OD-24] Functional STT check on a synthetic two-voice Indonesian sample (espeak-ng, about 60 s) through the converted model on CPU only; JSON segments; no RTF figure (D230) | coder-execution | research/10_spike_stt_functional_check.md (Tier 2) | 11 | In 2 runs: non-empty JSON transcript with timestamps; GPU/Metal disabled in the quoted command; >= 1 segment per scripted sentence; no throughput claim | research |
| 13 | [M1\|B: GA:Q-INSTALL item 3] Install GStreamer with gst-plugins-rs (isofmp4mux) via Homebrew after row 10 finishes (one Homebrew installer at a time); record uninstall; SKIPPED record if declined | coder-execution | initialization/03_gstreamer_install.md (Tier 3) | 3, 10, GA:Q-INSTALL | `gst-inspect-1.0 isofmp4mux` plus `gst-inspect-1.0 input-selector` exit 0; uninstall command recorded; or SKIPPED record citing the decision ID | initialization |
| 14 | [M1\|B: GA:Q-INSTALL item 3] GStreamer prototype in `.cache/spikes/s3/` reproducing the S1 fMP4/hash path plus the S2 switch with rtspsrc, input-selector, isofmp4mux | coder-execution | research/11_spike_gstreamer_prototype.md (Tier 2) | 7, 8, 13 | The S1 plus S2 criteria measured in 2 runs, or a SKIPPED record citing row 13 | research |
| 15 | [M1\|A/B] Media-engine pick memo: FFmpeg vs GStreamer from rows 7, 8, 9, 14 with row-3 facts | data-analyst | research/12_spike_s3_media_engine_pick.md (Tier 1) | 3, 7, 8, 9, 14 | Matrix scores both engines on >= 7 named criteria (fragment control, gapless switch, hash tap, crash behaviour, licence, install footprint, x86 Linux portability); every score cites a row artifact; residual risk stated | research |
| 16 | [M0\|A] B10-a: make mobile test `session-live/live-gap-read-only-dialog` independent of wall-clock time (fake timers; behaviour unchanged) | coder-execution | implementation/01_b10a_live_gap_read_only_dialog.md (Tier 3) | 1 | File passes 3/3 runs (2 + 1); real-time waits left in the file = 0 (grep quoted); production-code diff empty | implementation |
| 17 | [M0\|A] B10-b: make mobile test `settings/live-settings-boundary` independent of wall-clock time | coder-execution | implementation/02_b10b_live_settings_boundary.md (Tier 3) | 16 | File passes 3/3 runs; real-time waits = 0; production-code diff empty | implementation |
| 18 | [M0\|A] B10-c: make mobile test `session-live/live-session-live-link` independent of wall-clock time | coder-execution | implementation/03_b10c_live_session_live_link.md (Tier 3) | 17 | File passes 3/3 runs; real-time waits = 0; production-code diff empty | implementation |
| 19 | [M0\|A] B10-e: remove the RC-8 redundant 20 s per-test timeouts left after T1 in mobile tests (jest config already sets 20000) | coder-execution | implementation/04_b10e_rc8_redundant_timeouts.md (Tier 3) | 18 | Per-test 20000 overrides in the RC-8 file list = 0; mobile suite exit 0 with test count >= 1,988 | implementation |
| 20 | [M0\|A] B10-d: make core-web test `src/test/live-paired-devices-issue` independent of wall-clock time | coder-execution | implementation/05_b10d_live_paired_devices_issue.md (Tier 3) | 1 | File passes 3/3 runs; real-time waits = 0; production-code diff empty | implementation |
| 21 | [M0\|A] B10-f: settle the `chrome-lost-updates` first-test residual (D246) without wall-clock waits, in the workspace located by row 1 | coder-execution | implementation/06_b10f_chrome_lost_updates.md (Tier 3) | 19, 20 | File passes 3/3 runs; real-time waits = 0; production-code diff empty | implementation |
| 22 | [M0\|A] B12/A4 RC-1: Sessions hub duration never steps back after a late stop (`apps/mobile/src/runtime/recording-elapsed.ts:129`, keep the larger value), proven by a fake-clock regression test | coder-execution | implementation/07_rc1_recording_elapsed_monotonic.md (Tier 3) | 21 | New test fails on pre-fix code, passes after (both outputs quoted); `use-monitor.ts:92-160` diff empty; test file passes 3/3 | implementation |
| 23 | [M0\|A] B2: apply the dependency refresh from row 5 (targeted bumps, `undici` >= 7.29.1, no blind audit fix) as the single lockfile writer under `/usr/bin/lockf -k .locks/npm.lock`, with no test row running | coder-execution | implementation/08_b2_dependency_refresh.md (Tier 3) | 5, 22 | `npm audit` high count after <= the target in row 5; `npm ls undici` >= 7.29.1; root typecheck plus lint exit 0 | implementation |
| 24 | [M0\|A] Review the B2 diff (package.json files, package-lock.json) | security-review | gateway_check/01_b2_dependency_review.md (Tier 2) | 23 | Verdict PASS/CAUTION/FAIL; every changed direct dependency listed with the advisory closed or the reason kept; count of new install scripts stated; findings routed to row 23 | gateway_check |
| 25 | [M0\|A] Review the B10 test-hygiene diffs of rows 16-21 | senior-code-reviewer | gateway_check/02_b10_test_hygiene_review.md (Tier 2) | 21 | Verdict per file (6 files); 0 production files in the diff; each finding routed to its producing row | gateway_check |
| 26 | [M0\|A] Review the RC-1 diff of row 22 | senior-code-reviewer | gateway_check/03_rc1_review.md (Tier 2) | 22 | Verdict; forward-only rule (DEC-FXR-M-2) checked with file:line; findings routed to row 22 | gateway_check |
| 27 | [M0\|A] Wave-A regression: per-workspace suites (shared, core-server unit, core-server db, core-web, mobile) on the post-B2 tree | test-expert | test/01_wave_a_regression.md (Tier 3) | 23, 24, 25, 26 | 5/5 workspaces exit 0; counts >= 71/1,851, 160/3,954, 124/1,751, 117/1,495, 192/1,988 with every added test named; root typecheck plus lint exit 0 | test |
| 28 | [M0\|B: all answered ODs] Write the phase spec: functional plus non-functional requirements, acceptance criteria per R-1..R-7, success criteria, the hardware-independent completion line, class-C entry criteria, out-of-scope list | data-analyst | masterplan/01_specs.md (Tier 1) | 3, 4, 6 | Each R-1..R-7 has >= 1 measurable acceptance criterion; every answered gate item cited by decision ID; the 5 superseded items appear only as superseded; 5W1H frame present | masterplan |
| 29 | [M0\|B: GA:OD-01, OD-09, OD-10, OD-15, OD-17, OD-22] Write API contract C3: operations 76-88 with the modified operations, error codes, audit types (E-30 rules), slices 28 -> 30 with own capture kinds (E-04), OpenAPI `all` 0.3.0, `offline` scope per OD-17, capture constants in `@dems/shared/api` (CS-25) | data-analyst | masterplan/03_api_contract.md (Tier 1) | 28 | Every new or modified operation has method, path, access, audit type; total operation count stated; 0 uses of `AdminResource.DEVICES` for capture; every new audit type has an exact detail-key list with 0 secret keys | masterplan |
| 30 | [M0\|B: GA:OD-01, OD-02, OD-03, OD-19] Write database contract `dbc-3`: migrations 0004/0005, schema v2, 9 new plus 5 changed tables, three FAULT_KIND CHECKs (E-01), relaxed signature CHECK (`0001_tables.sql:335-336`), privileges, kept-on-reset set, lane re-creation procedure; B16 errata (i)-(v) carried in | database-specialist | masterplan/04_database_contract.md (Tier 1) | 28 | 3/3 CHECK sites listed with file:line; every new table has columns, privileges, reset policy; B16 items (i)-(v) each applied or carried with a reason; migration test plan names a throw-away copy of `dems_demo` plus fresh lanes | masterplan |
| 31 | [M0\|B: GA:OD-03, OD-05, OD-06, OD-11, OD-14, OD-21, OD-25] Write the capture architecture spec: capture-driver seam, INTERNAL actions, supervisor/IPC protocol, worker topology on the picked engine, fMP4 writer with fragment chain plus fsync policy, encryption scheme, mic-switch mechanics, warning raiser, static rules for new folders, media storage paths | data-analyst | masterplan/05_capture_architecture_spec.md (Tier 1) | 15, 28 | NM-01..NM-05, NM-09, NM-10, NM-14 each have interface, failure modes, test hook; each mechanism cites rows 7, 8, 9 or 15, or is labelled hypothesis; every P25 edit listed by file:line | masterplan |
| 32 | [M0\|B: GA:OD-02, OD-03, OD-04, OD-08, OD-21] Write the evidence-package spec: package layout, manifest v2 schema, signer interface, verify-v2 checks, sealing pipeline v2 steps with checkpoints plus RECOVERY resume, tamper demo | data-analyst | masterplan/06_evidence_package_spec.md (Tier 1) | 28, 30 | Every manifest v2 field has type plus source; every sealing step has checkpoint, resume rule, progress source; verify checks enumerated incl. the one-fragment tamper expectation | masterplan |
| 33 | [M0\|B: GA:OD-15, OD-20, OD-24] Write the transcript spec: VAD chunking, CPU STT runtime with a configurable model, chunk checkpoints, 2-speaker diarization with LABELLED/UNAVAILABLE, signed revisions, CPU priority rule (capture above STT), functional-check definition | data-analyst | masterplan/07_transcript_spec.md (Tier 1) | 4, 12, 28 | Functional-check criteria measurable without RTF/WER figures (D230); each stage has input, output, checkpoint, failure behaviour; DOC-05 licence entry list present; cites row 12 or its SKIPPED record | masterplan |
| 34 | [M0\|B: GA:OD-09, OD-10, OD-12, OD-13] Write the client UX spec for web, tablet, phone: selector, mic toggle with warning, sealing progress/ETA, resumed-sealing state, playback with the audio-source band, transcript pane; applies P-01..P-16, E-13..E-17 | data-analyst | masterplan/08_client_ux_spec.md (Tier 1) | 28, 29 | Each flow defined for all 3 clients; P-01..P-16 each marked applied or not applicable with reason; every gated control has the "Checking your permissions..." state | masterplan |
| 35 | [M0\|B] Security design review of rows 29-33: camera credential store, signer keys, encryption keys, media-streaming auth, credential-shaped values in log blanking (E-31), new static rules permitting child_process/fs, OD-13 preconditions | security-review | masterplan/09_security_design_review.md (Tier 1) | 29, 30, 31, 32, 33 | Verdict per surface (>= 7 surfaces); each finding has severity, mitigation, owning spec section; 0 Critical left open | masterplan |
| 36 | [M0\|B] Write the test strategy: named checks per milestone gate with run counts (2 + 1), fake-clock rule, pinned-count files (categories B/C/D), static rules for new folders, lane re-creation with per-lane pairing, kill matrix as distinct checks, long campaigns only pre-handover, no biometric steps | test-expert | masterplan/10_test_strategy.md (Tier 1) | 29, 30, 31, 32, 33, 34 | Every gate M1-M9 maps to named checks with run counts; pinned-count file list matches row 6; 0 checks with >= 10 loops outside the pre-handover section | masterplan |
| 37 | [M0\|B] Write the implementation plan: W-rows per milestone M2-M9 with class A/B/C, files, rollback, waves <= 8 agents, file-collision map, backlog placement, class-C entry criteria | data-analyst | masterplan/02_plan.md (Tier 1) | 29, 30, 31, 32, 33, 34, 35, 36 | Every spec section of rows 28-36 maps to >= 1 W-row; every W-row has class, milestone, owner agent, rollback; no wave > 8; no two rows of one wave share an output path | masterplan |
| 38 | [M1] M1 spike gate: independent +1 verification run of S1, S2, S4 (with row 12 if it ran) against the criteria of rows 7-12; check that the row-15 pick cites evidence | verifier | gateway_check/04_m1_spike_gate.md (Tier 2) | 7, 8, 9, 12, 15 | Each criterion PASS/FAIL with command output; failures routed to the producing row; 0 media files tracked by git | gateway_check |
| 39 | [M0] M0 gate: cross-check rows 28-37 against row 6 (errata applied, R-1..R-7 traced, gate answers applied, superseded decisions absent), with the wave-A regression of row 27 | verifier | gateway_check/05_m0_spec_gate.md (Tier 2) | 27, 37, 38 | Checklist counts stated (errata 31/31, R 7/7, answered ODs n/n); verdict; each gap routed to its producing row | gateway_check |
| 40 | Post-research implementation planning: refine this blueprint to rev 2 from rows 6 and 28-39, expanding M2-M9 into atomic single-owner rows with lane re-creation as the first M2 row; classify the change MAJOR/MINOR for the controller | task-architect | identification/02_structured.md rev 2 (Tier 1) | 39 | Every new row traces to a W-row of masterplan/02_plan.md plus a spec section; one output per row; DAG acyclic; MAJOR/MINOR stated with reason | masterplan |

---

## 6. Milestone Framework M0-M9 (drift-check corrections applied)

Each milestone ends in a verification gate. Gate checks run 2 times by the producing row plus 1 independent verification run, except unit/regression suites, which run once per workspace per checkpoint. Every implementation milestone has its own checkpoint (unit tests + code review per unit) inside the milestone. Rows for M2-M9 are produced by row 40.

| M | Content (corrected) | Class | Blocking gate items | Errata applied | Verification gate (checkable) |
|---|---|---|---|---|---|
| M0 | Specs, contract C3, `dbc-3`, capture/package/transcript/UX specs, security design review, test strategy, plan (rows 28-37); register (row 6); backlog B2, B10, RC-1, B16 (rows 5, 16-27, 30) | A + B | OD-01, -02, -03, -09, -10, -14, -15, -17, -19, -21, -23 (for rows 28-37) | E-03, E-05, E-06, E-27, E-28 | Row 39: errata 31/31, R-1..R-7 7/7, answered ODs applied; row 27: 5/5 workspaces green at or above the ledger; then the second approval gate (MAJOR) |
| M1 | Spikes S1 fMP4 + running hash + crash truncation, S2 mic switch, S4 AV sync, S3 engine pick; CPU STT runtime install, conversion, functional transcript (rows 7-15). ONVIF on a target camera = class C | A (S1, S2, S4, S3 memo) + B (rows 10-14) | OD-24, Q-INSTALL, OD-25 (default already applied by RF-10) | E-21, E-22, E-23 | Row 38: playable-while-growing; running hash = re-read hash; contiguous chain; truncation detected; AV within ±40 ms; one audio stream with switch gap <= 21.3 ms; STT produces a transcript. **No RTF figure** |
| M2 | Contract + DB foundation + Simulated parity: SH-01..SH-25, CS-12, CS-14, CS-16..CS-20, CS-24, CS-25, WB-09; first row = lane re-creation (db:create/migrate/seed per lane) + per-lane pairing; B4 audit rule (E-30); retire SC8 (OD-23) | B | OD-01, -02, -09, -10, -14, -17, -18, -19, -23, -26 | E-01, E-02, E-04, E-12, E-18, E-19, E-20, E-24 | All workspace suites green per workspace; OpenAPI drift test at 0.3.0; migrations 0004/0005 on a throw-away copy of `dems_demo` and on fresh lanes; `rbac.matrix` boot passes; three FAULT_KIND CHECKs accept the new kinds; Simulated regression against `c2c983b` (replaces the `acaff20` gate) |
| M3 | Capture worker + supervisor + IPC with fake devices: NM-02, NM-03, NM-04, NM-05 (scheme per OD-03), NM-14 (incl. pull fixtures if MediaMTX approved); CS-01..CS-04 under the P25 waiver; CS-22 boot checks; static rules for `capture/`; B11 instrumentation before the M5 tablet gate | B | OD-03, -06 (codec), -14, -21, -25 | E-05 | Worker integration 2 + 1 (two fake RTSP + two fake mics -> two playable fMP4 files, hash equality, contiguous checkpoints); AV sync 2 + 1; each worker-crash check 2 + 1; 0 media in git |
| M4 | Device adapters + selector: NM-01 with fake adapters (real adapters = class C), NM-09, WB-05, WB-07, WB-11, MB-08, MB-09, CS-06, CS-11 | B (fake) / C (real) | OD-05, -07, -10, -12, -13, -22; Q-HW | E-04, E-12, E-15, E-16, E-17 | Mac: selector edit + audit row from web (agent-browser) and tablet/phone emulators on recreated lanes, 2 + 1 each; config locked while a session is open. Class C: discovery, NTP, profile, PoE cycle on target hardware |
| M5 | Manual mic failover end to end: NM-10, WB-01, MB-03, MB-01 (B15 mic tiles, RC-1 already done), intervals in custody; B11 result applied | B | OD-09, -11 | E-09, E-14, E-16, E-30 | Switch from web, tablet, phone during recording, 2 + 1 each; gap at switch within the spec bound; interval rows + `AUDIO_SOURCE_SWITCHED` audit with sending device ID; silence warning raised, never an auto-switch; "Checking your permissions..." state present |
| M6 | Transcript pipeline: NM-06 (VAD, STT, 2-speaker diarization), incremental chunks with checkpoints; diarization/VAD model download per OD-20 | B | OD-15, -20, -24; Q-INSTALL item 5 | E-21, E-22 | Functional check: transcript produced, sealed, verified, labelled when possible on the synthetic Indonesian sample (2 + 1); "no dropped capture fragment while STT runs" (one 2 + 1 check, not a throughput measurement); chunk resume after a kill |
| M7 | Sealing v2 + package + signer + encryption + RECOVERY: NM-05, NM-07, NM-08, SH-06, CS-04, CS-21, MB-04 (+B9 FXR-DEV-2), MB-06, WB-01 modal | B | OD-02, -03, -04, -08, -15, -19 | E-13 | Kill matrix (each recording phase x each sealing step) as distinct checks, each 2 + 1, final hashes equal an uninterrupted run; v2 verify PASS on server, web, mobile; tampering one fragment fails exactly that fragment; progress forward-only from Core instants |
| M8 | Playback, export, composite: NM-11, NM-12, WB-04, MB-07 | B | OD-16; OD-13 for physical devices | E-11, E-31 | Playback on web, tablet, phone (emulators) 2 + 1 each with Range support; export verifies at the destination; composite marked derived and hashed in the export manifest; any signed-URL prefix in both log-blanking lists |
| **—** | **DONE ON THIS MAC WITH FAKE DEVICES: M0-M8 gates passed on fakes + M9 Mac part below** | — | — | — | — |
| M9 | Hardening and release: full regression, DOC-01..DOC-06 (DOC-05 licences), hygiene backlog (B6 runbook, B8, B12 RC-2..RC-7; B5/B6 splits/B7 per OD-26; B13 only if packaging); final chain verifier -> security-review -> test-expert -> senior-code-reviewer. Class C: NM-13 benchmark on the real Core device (RTF, RAM, WER, labelling), physical device e2e, TPM signer. Pre-handover A1-A6 only if the user announces handover | A + B (Mac) / C | OD-26; Q-HW; handover announcement | E-22, E-23, E-29 | Mac: all workspaces green; final chain verdicts recorded; docs updated. Class C: benchmark report on the Core device; device e2e 2 + 1; long campaigns (AV drift 1-2 h, repeated kill loops) only in the pre-handover session |

---

## 7. Requirement Trace (G1)

| Req | Requirement | Milestones | Rows in rev 1 | Gate items |
|---|---|---|---|---|
| R-1 | Device-selector config in the Core, editable from web/tablet/phone under RBAC + audit | M2, M4 | 6, 28, 29, 30, 34 | OD-05, OD-10, OD-22 |
| R-2 | Capture worker behind the API, supervised, IPC, adapters under the device contract | M1, M3, M4 | 3, 7, 14, 15, 31 | OD-06, OD-07, OD-14 |
| R-3 | One active mic, manual toggle, audited, intervals in the manifest, warn never auto-switch | M1, M5 | 8, 29, 31, 34 | OD-09, OD-11 |
| R-4 | One whole fMP4 file per camera with the single audio track, running SHA-256, fragment checkpoints | M1, M3, M7 | 7, 9, 31, 32 | OD-03, OD-21, OD-25 |
| R-5 | Transcript inside the seal; CPU + RAM STT; incremental; labels when possible; signed revisions | M1, M6, M7 | 4, 10, 11, 12, 33 | OD-15, OD-20, OD-24 |
| R-6 | One session per Core; blocked until SEALED; per-step progress + ETA on all clients; resumable via RECOVERY | M2, M7 | 28, 32, 34 | OD-08 |
| R-7 | Hardware >= this Mac, CPU-only; no benchmark here; working STT first; benchmark on the Core device | M1, M9 (class C) | 2, 12, 36 | Q-HW |

---

## 8. Backlog Placement (G5)

| ID | Item | Class | Milestone | Rows / route |
|---|---|---|---|---|
| B2 | Dependency refresh (`npm audit` 99 high; `undici` >= 7.29.1) before any capture dependency | A | M0 | 5, 23, 24, 27 |
| B3 | W99-2 pairing bucket, W99-3 socket cap | B | Precondition of OD-13 = LAN; only if OD-13 is not "keep loopback" | row 40 |
| B4 | `DEVICE_CREDENTIAL_REQUIRED` refusal writes no audit row; camera credential refusals audited | A (rides on contract) | M0 spec (row 29), M2 code | 29, row 40 |
| B5 | DR-1 `live-sim.ts` split (+ W92-6/-12/-15/-17, W92-27) | B | Per OD-26 (default: after M9 or a separate task; minimal edit at `live-sim.ts:902-905` in M2) | row 40 |
| B6 | W91-10 file splits; W91-17 runbook for `scripts/pg/server.mjs` | A (runbook) / B (splits, OD-26) | M9 | row 40 |
| B7 | HBX-13 static scanners -> lint rules | B | Per OD-26 | row 40 |
| B8 | W93-10/-18/-19/-26/-27 minor mobile items; B15 empty frame Login -> Home | A | M9 hygiene | row 40 |
| B9 | FXR-DEV-2 Reanimated warnings at the Finalizing hand-over | B | M7 with MB-04 | row 40 |
| B10 | Wall-clock-independent tests (4 files), RC-8, `chrome-lost-updates` | A | M0 (drift check placed it in M2; moved earlier because it is decision-free and steadies every later gate) | 16-21, 25, 27 |
| B11 | RF2-2: exact wait point of the late stop on the tablet | A | M3 window, before the M5/M7 tablet gates | row 40 |
| B12 | RC-1 (fix); RC-2..RC-7 nits | A | RC-1 in M0; nits in M9 | 22, 26; row 40 |
| B13 | Packaged CSP `localhost`; `release/web/BUILD-INPUTS.txt:168` | A | Only if a release build is made (A1/A2); otherwise carried | row 40 |
| B14 | QR scanning on device | — | Out of scope (DR-02), carried | — |
| B15 | Tablet Home mic tiles "No signal"; phone-sent commands without device ID in audit | B | Mic tiles with MB-01 (M5); device ID via E-30 (row 29, M2) | 29, row 40 |
| B16 | Errata owed to the database contract (C2-R3, F-4, F-6, F-7, hour-change path) | A | M0 | 30 |
| B17 / C5 | Web-only Live demo cannot record without a paired tablet | B | Folded into OD-09 | Gate Questions |
| A1-A3, A6 | Release-build revoke-to-Pair, timer lag, tablet late stop, long campaigns | C-like (session) | M9 pre-handover, only if the user announces handover | row 40 |
| A4 | RC-1 device check | A (code) / pre-handover (device) | Code M0 (row 22); device check pre-handover | 22 |
| A5 / C7 | Biometric device test | — | Stays skipped (D231) unless the user asks | — |
| C1-C4, C6, C8 | Shim, AVDs, host PostgreSQL, `.DS_Store`, host clean-up | — | Not in scope; task-2 defaults stand | — |
| C9 (iii) | STT install needs approval | B | Q-INSTALL | Gate Questions |

---

## 9. Class-C Entry Pack (hardware-dependent items)

| # | Item | Entry criteria | Gate when activated |
|---|---|---|---|
| C-1 | ONVIF discovery, NTP set, profile listing against the target camera | Camera model known (Q-HW), on the Mac's LAN; OD-05 answered | Discovery lists the camera; NTP offset recorded; 2 + 1 |
| C-2 | Real `CameraAdapter` RTSP/TCP pull into the worker | C-1 passed; M3 gate passed | Worker integration on the real camera; AV within ±40 ms; 2 + 1 |
| C-3 | Real `PoeController` | Switch model + control path known (OD-07); OD-22 answered | PoE cycle on the lost-stream camera, audited; 2 + 1 |
| C-4 | Real `AudioInputAdapter` | Mic model + transport known (OD-06) | Primary/standby levels; switch gap within the bound; 2 + 1 |
| C-5 | Physical tablets/phones on the LAN | OD-13 = LAN; demo password replaced; B3 applied; TLS/origin rules specified | M4/M5/M8 device e2e on physical devices; 2 + 1 |
| C-6 | Live preview of real cameras | OD-12 not "none" | Preview latency per spec; 2 + 1 |
| C-7 | NM-13 STT benchmark on the real Core device | Core device available (Q-HW) | RTF, peak RAM, WER on a hand-checked sample, labelling accuracy; model size picked |
| C-8 | TPM/PKCS#11 signer adapter | OD-04 hardware option chosen; device with TPM | Signature verifies with the device certificate chain |
| C-9 | Long AV-drift run (1-2 h) and repeated kill loops | User announces handover (D233) | Pre-handover session report |

---

## Gate Questions

All items in one batch for BLUEPRINT_APPROVAL. The user may answer "all defaults" or override item by item. "Proceeds on default" means work can start with the default without a further question.

| ID | Question | Status | Options | Recommended default | Consequence of the default (plain) | Blocks | Proceeds on default |
|---|---|---|---|---|---|---|---|
| OD-01 | Evidence track ID model | Open | T1: `AUDIO-01` becomes the one session audio track, `AUDIO-02` only on old v1 items, mics become inputs `MIC-01`/`MIC-02` / T2: new track ID `AUDIO`, both old IDs legacy | T1 | Fewer ID changes; "AUDIO-01" now means "session audio", not "MIC 1" | M2 (rows 29, 30) | Yes |
| OD-02 | Existing demo evidence (14 packages, 13 dataset items, all synthetic) | Open | L1: keep v1 beside v2 (two verifiers, two players) / L2: regenerate all demo evidence as v2, drop v1 code paths | L2 | One code path; tamper demo EV-0005 is re-scripted on one fragment; only `dems_demo` is reseeded (E-20); `release/` 0.1.0 untouched | M2, M7, M8 (rows 30, 32) | Yes |
| OD-03 | Encryption at rest, and what the whole-file hash covers | Open | (a) per-fragment AES-256-GCM in the camera file / (b) CENC inside the MP4 / (c) disk-volume encryption + one pass at sealing / (d) none in this phase (design only); hash over stored bytes, plaintext, or both | (a) with both hashes recorded; confirmed at the M0 spec gate | Files are encrypted while recording; integrity can be checked without the key; decrypted exports still have a matching hash | M3, M7 (rows 30, 31, 32) | Yes |
| OD-04 | Signer and key provisioning | Open | TPM ECDSA P-256 / software Ed25519 / PKCS#11 token | Software Ed25519 behind a `Signer` interface on this Mac; TPM adapter is class C (C-8) | Real (non-simulated) signatures now; hardware key later without a format change | M7 (row 32) | Yes |
| OD-05 | Camera topology | Open | One dual-lens camera (two profiles) / two PoE cameras / support both | Support both: selector picks device + media profile; fakes emulate two cameras | Works with either hardware; the real model comes with Q-HW | M2 schema, M4 (class C) | Yes |
| OD-06 | Microphone transport and audio codec | Open | Analog into the Core / USB class-compliant / network audio; AAC-LC 48 kHz / lossless | AAC-LC 48 kHz mono; transport behind `AudioInputAdapter`; USB as working assumption | Small, widely playable audio; transport fixed when mics are known | M3 (codec), M4 (class C) | Yes |
| OD-07 | PoE control | Open | Core's own PoE board / managed switch via SNMP (RFC 3621) / vendor API / manual only | `PoeController` interface with an SNMP adapter + a fake; real adapter class C | Power-cycle designed now, wired to hardware later | M4 (class C) | Yes |
| OD-08 | Crash during RECORDING | Open | Seal the durable part flagged "interrupted" / keep INCOMPLETE as today (`session-machine.ts:1028`) | Seal the durable part, flagged "interrupted" | Recorded evidence up to the crash is kept and signed, clearly marked | M7 (row 32) | Yes |
| OD-09 | Who may switch the mic; hot standby; (C5) web-only recording | Open (D221 proposals) | (a) hot standby; toggle for the session holder with `SESSION_START` + SUPERVISOR / (b) anyone with `SESSION_START`; C5: allow web-only recording yes/no | (a); C5 stays "no" (as specified) | Near-gapless switch; only the operator and supervisors switch; web still needs a paired tablet to record | M2, M5 (rows 29, 34) | Yes |
| OD-10 | Who may edit the selector, and when | Open | New `CAPTURE_CONFIG` for SUPERVISOR + TECHNICIAN / existing `DEVICE_MANAGE` (TECHNICIAN only); idle only or also during a session | `CAPTURE_CONFIG` for SUPERVISOR + TECHNICIAN; idle only | Investigators cannot change devices; no change while recording | M2 (rows 29, 34) | Yes |
| OD-11 | Warning thresholds | Open | Silence level and duration; disconnect debounce | Proposal: below -50 dBFS for 10 s -> `MIC_SILENT` warning; disconnect debounce 2 s; values are contract constants, tunable | Operator is warned, never switched automatically; numbers can be tuned without code change | M5 (row 31) | Yes |
| OD-12 | Live preview of real cameras on clients | Open | WebRTC/LL-HLS via a media proxy / periodic snapshot / none (demo loop stays) | None in this phase; revisit with hardware (C-6) | Monitor keeps the demo loop picture; no extra CPU for decoding | M4 (row 34) | Yes |
| OD-13 | Physical tablets/phones reaching the Core | Open; preconditions added (E-26) | Keep loopback (emulators only) / LAN listener + TLS + origin rules (needs the demo password replaced and B3 first) | Keep loopback in this phase; LAN is class C (C-5) | Tests use emulators; no network exposure | M4/M5/M8 physical e2e | Yes |
| OD-14 | P25 freeze waiver for `apps/core-server/src/app.ts`, `config.ts`, `src/index.ts` | Open | Grant for listed edits only / no waiver | Grant, limited to module registration, the `capture` seam, capture config keys, supervisor start/stop; each edit reviewed | The capture module can be wired in; nothing else in those files changes | M2, M3 (row 31) | Yes |
| OD-15 | Transcript revisions | Open | Permission `TRANSCRIPT_REVISE` for INVESTIGATOR + SUPERVISOR / SUPERVISOR only; signed by the Core key with author / by personal keys; approval flow or none | INVESTIGATOR + SUPERVISOR; Core key signs, author recorded; no approval flow | Officers can correct; the sealed machine transcript never changes | M7, M8 (rows 29, 33) | Yes |
| OD-16 | Export form; composite | Open | Encrypted package + wrapped key / decrypted copy with manifest + signature; composite layout and codec | Decrypted copy with manifest + signature, export audited; composite side-by-side on demand, marked derived; encoder chosen with a licence check in M8 | The receiver can verify the package without the Core's key | M8 | Yes |
| OD-17 | Simulated-mode parity | Open | Simulator emulates v2 (single audio, switch, new steps, transcript stub) / v2 only in Live | Emulate v2; `offline` OpenAPI scope bumped to 0.2.0; `release/` 0.1.0 untouched | Demo and tests work without hardware; one behaviour in both modes | M2 (row 29) | Yes |
| OD-18 | Demo controls in real-capture mode | Open | Disable all / allow only non-hardware faults | Disable hardware-fault injection and scenario load in real mode; Simulated unchanged | A real recording cannot be disturbed by demo buttons | M2 | Yes |
| OD-19 | Demo reset vs real evidence on disk | Open | Block reset while real sealed packages exist / reset keeps evidence rows + files / separate demo database | Block reset while real packages exist; capture config/devices/credentials become kept tables | A reset can never erase records of real evidence | M2 (row 30) | Yes |
| OD-20 | STT model, licences, language; diarization/VAD model download | Partly answered (D229 model on disk, D226 Indonesian) | Indonesian only / Indonesian + English; allow download of the diarization + VAD models yes/no | Indonesian only; allow the diarization + VAD downloads after the row-4 licence check; licences into DOC-05 | Speaker labels become possible; no project data leaves the machine (downloads only) | M1 (partly), M6 (row 33) | Yes |
| OD-21 | Legal acceptance of fragmented MP4 as "one whole file" | Open | fMP4 / fallback: segments + one lossless concatenation at sealing (D224) | fMP4; fallback kept designed; legal confirmation before handover | No merge pass at sealing; if legal says no, the fallback adds one pass | M1, M3 (rows 31, 32) | Yes |
| OD-22 | PoE-cycle a camera during RECORDING | New (D260) | Never (UI gate stays) / only for a camera whose stream is lost (`CAMERA_LOSS`), confirmed + audited, gap marked in the manifest | Only for a lost-stream camera, confirmed + audited | A dead camera can be revived mid-session; healthy ones cannot be cut | M2 contract, M4 (class C) | Yes |
| OD-23 | Retire task 2's SC8 "simulator untouched" rule and the `acaff20` diff gate | New (D260) | Retire / re-baseline at `c2c983b` with allowed rows listed / keep (blocks SH-05..SH-08) | Retire; replace with "simulator changes only through blueprint rows" + Simulated regression against `c2c983b` at M2 and M9 | The shared simulator can be extended for v2; Simulated mode is still checked | M2 | Yes |
| OD-24 | CPU STT runtime and install approval | New (D260) | whisper.cpp (native binary, Homebrew) / CTranslate2 int8 via faster-whisper (Python venv); conversion locally (may need Python packages) / download a pre-converted model | whisper.cpp; conversion in an isolated venv under `.cache/`, removed after; pre-converted download only if conversion is heavy and you allow it | One native runtime that also runs on an x86 Linux Core; no Python at run time | M1 (rows 10-12), M6 | Yes, with Q-INSTALL |
| OD-25 | Real recordings and large media in git and `docs/` | New (D260) | (a) all media in git-ignored paths, `docs/` carries text evidence + small stills / (b) commit short clips / (c) Git LFS | (a) | `.git` (1.5 GB) does not grow by about 8 GB per recorded hour | M1, M3 (row 31) | Yes |
| OD-26 | Order of deferred refactors (DR-1 `live-sim.ts` split, HBX-13 lint conversion, W91-10 splits) vs the capture work | New (D260) | (a) refactors first, at M2 start / (b) minimal targeted edits now, refactors after M9 or in a separate task / (c) HBX-13 first, DR-1 later | (b) | No large refactor inside a contract-breaking change; the three new static rules use today's scanner form | M2, M9 | Yes |
| Q-AUTO | Does the full-autonomy-with-decision-log mode of tasks 1-2 apply to this task? | Open (AS-5) | Yes / milestone-gated (stop at every milestone gate) / step-gated | Yes: agents proceed inside approved scope, every decision logged; stops only at approval gates (the second blueprint gate, any MAJOR change), host installs per Q-INSTALL, hardware arrival, handover | Fast progress; you see decisions at milestone summaries; no gate is skipped | All milestones (process) | Yes |
| Q-INSTALL | Blanket or per-item approval for host installs | Open (C9 iii) | Blanket for the list / per item / decline items. Items: (1) CPU STT runtime (whisper.cpp, Homebrew); (2) Python venv for model conversion (packages and size from row 4); (3) GStreamer + gst-plugins-rs (Homebrew); (4) MediaMTX RTSP test server; (5) sherpa-onnx + diarization/VAD model files; (6) an ONVIF client npm package (after B2) | Blanket for items 1-6; user-space only (Homebrew prefix, `.cache/`, project `node_modules`), no sudo, each with its uninstall command logged in `initialization/` | Spikes and the STT path start right after approval; everything is removable | M1 (rows 10, 13), M3, M4, M6 | Yes |
| Q-HW | When will the hardware arrive, and which models? | Open | Known now (give models: cameras, PoE switch, microphones, Core device CPU/RAM/OS) / unknown | Unknown: class C stays deferred; the task completes at the "done on this Mac with fake devices" line; class-C rows activate on arrival without re-planning | Work is not held up by hardware; real-device proof comes later | Class C (§9), M4 real, M9 benchmark | Yes |

---

## Dependencies

| # | Dependency | Needed by | State |
|---|---|---|---|
| DP-1 | BLUEPRINT_APPROVAL + gate answers recorded in `decisions/decisions.md` (GA) | All rows | Pending |
| DP-2 | Install approvals (Q-INSTALL) | Rows 10, 13; M3/M4/M6 rows | Pending |
| DP-3 | HEAD unchanged since `85c0fb5` for code paths | Row 6 trusts row 1 | Row 1 checks |
| DP-4 | PostgreSQL on `127.0.0.1:4432` (`dems_demo`) | Row 27 db suite; M2 | Running per drift check §4; row 2 re-probes |
| DP-5 | FFmpeg 9.0.2 at `/opt/homebrew/bin/ffmpeg`; espeak-ng | Rows 7-9, 12 | Present per F-29 and memory; row 2 re-probes |
| DP-6 | Hardware (Q-HW) | Class C only | Unknown |
| DP-7 | Lane re-creation + per-lane pairing | First M2 row (rev 2); every lane-based gate | Not needed by rows 1-40 |
| DP-8 | Second approval gate after row 40 (MAJOR) | M2-M9 implementation | Expected |

---

## 10. Parallel Execution Plan (<= 8 agents in flight)

The controller launches every row whose dependencies are met, up to 8 in flight (CLAUDE.md §6). The following single-writer resources serialise rows even when slots are free:

| Resource | Rule | Rows |
|---|---|---|
| Lockfile / `node_modules` | One writer; no test row runs during it | 23 alone |
| Homebrew | One installer at a time | 10 -> 13 |
| Mobile jest runner | Sequential chain to avoid host-load flakes | 16 -> 17 -> 18 -> 19 -> 21 -> 22 |
| core-web jest runner | Sequential | 20 -> 21 |
| Host CPU | If any test row times out under load, the controller holds new spike rows until it passes | 7-14 vs 16-22 |
| Output paths | Every row writes its own file; no two rows share an output (checked: 40 distinct paths) | all |

| Earliest wave | Rows (in flight) | Count |
|---|---|---|
| W1 (approval) | 1, 2, 3, 4, 5 | 5 |
| W2 | 6, 7, 8, 10, 16, 20 | 6 |
| W3 | 9, 11, 13, 17, 28 | 5 |
| W4 | 12, 14, 18, 29, 30 | 5 |
| W5 | 15, 19, 32, 33, 34 | 5 |
| W6 | 21, 31, 38 | 3 |
| W7 | 22, 25, 35, 36 | 4 |
| W8 | 23, 26, 37 | 3 |
| W9 | 24 | 1 |
| W10 | 27 | 1 |
| W11 | 39 | 1 |
| W12 | 40 | 1 |

No row in this revision needs lanes, emulators or the Core running. Lane re-creation (`db:create`, `db:migrate` under `.locks/db-migrate.lock`, `db:seed` per lane, then Core 4421-4423 and Vite 5176-5178) and per-lane re-pairing open M2 in rev 2.

---

## Verification & Testing Strategy

- **Unit testing:** per workspace, `--maxWorkers=2`, fake clocks only, no new wall-clock waits (B10, P-08). Checkpoint per implementation unit inside each milestone; test-expert at milestone checkpoints. Coverage expectation: every new module (NM-xx) ships with unit tests and a static-rule test for its folder.
- **Integration testing:** worker integration with fake RTSP/audio/ONVIF fixtures (M3); contract/DB (OpenAPI drift 0.3.0, migrations 0004/0005 on a throw-away copy of `dems_demo` + fresh lanes, `rbac.matrix` boot) (M2).
- **Functional testing:** STT functional check (M1 row 12, M6), sealing kill matrix as distinct checks (M7), v2 verify on server + clients (M7). Runs against the seeded demo dataset and the v2 bulk fixture (CS-20) on recreated lanes.
- **UAT:** device e2e on web (agent-browser) and tablet/phone emulators on recreated lanes, 2 + 1 per check (M4, M5, M8); physical devices are class C (C-5). The release build is preferred for timing criteria; session diagnostics on (P-12).
- **Security testing:** design review (row 35); dependency review (row 24); secret sweep of captures before any commit; credential-shaped values in both blanking lists (E-31); final security-review in M9.
- **Performance testing:** none on this Mac beyond correctness ("no dropped fragment while STT runs"). The benchmark is class C (C-7).
- **Bulk data seeding:** existing seed + bulk fixture (`apps/core-server/src/db/fixtures/*`) rebuilt as v2 recordings in M2 (CS-20), applied per lane; row counts stated in `masterplan/04_database_contract.md` (row 30).
- **Test depth:** 2 runs + 1 verification per device/browser/spike check; >= 10-run loops and the 1-2 h AV-drift run only in a pre-handover session; no biometric device steps (D231).
- **Acceptance criteria:** M0-M8 gates passed on fakes + M9 Mac part = "done on this Mac with fake devices" (§5); each class-C gate passed when hardware arrives.

---

## Risk Assessment

| # | Risk | Likelihood / Impact | Mitigation | Milestone |
|---|---|---|---|---|
| RK-1 | STT starves capture on a shared CPU | Unknown until the Core device / High | Capture above STT priority, bounded STT threads, configurable model size; "no dropped fragment" check in M6; benchmark C-7 | M3, M6, M9 |
| RK-2 | fMP4 not legally accepted as "one whole file" | Low-Medium / High | OD-21 asked now; fallback designed in row 31 | M1, M3 |
| RK-3 | Clock drift between cameras, audio and the Core | Medium / High | Core NTP, offsets in the manifest; AV ±40 ms at M1/M3; long drift run pre-handover | M3, C-9 |
| RK-4 | Repository growth from media (`.git` 1.5 GB; about 8 GB/h) | High if unmanaged / Medium | RF-10 now; OD-25 default (a) | M1 onward |
| RK-5 | Tablet learns state late under load (2.3-21.2 s) | Medium / Medium | B11 before M5; P-12 diagnostics; release build + quiet host for timing gates | M3-M7 |
| RK-6 | Reanimated lost updates in Finalizing/Stepper | Medium / High (MB-04) | Stepper rest-value + `selection-glow` patterns; B9 with MB-04 | M7 |
| RK-7 | SC8 rule blocks simulator edits | High / Medium | OD-23 | M2 |
| RK-8 | `live-sim.ts` edited while its split is deferred | Medium / Medium | OD-26 default: minimal edit at `:902-905` | M2 |
| RK-9 | Dependency debt grows with capture dependencies | Medium / Medium | B2 first (row 23) | M0 |
| RK-10 | Lanes gone; lane-based gates fail | Certain if skipped / Medium | Lane re-creation as the first M2 row | M2 |
| RK-11 | P25 freeze slows wiring | High / Medium | OD-14 limited waiver | M2, M3 |
| RK-12 | Camera credentials leak | Low / High | Encrypted table T-33, write-only API, no secrets in audit, review row 35 | M2-M4 |
| RK-13 | Conversion toolchain is heavy (Python packages) | Medium / Low | Row 4 measures; venv under `.cache/`; pre-converted download as an alternative (OD-24) | M1 |
| RK-14 | Contract breadth: up to 165 test files change | High / Medium | Pinned counts updated in single contract rows; pinned-count list from row 6 | M2 |
| RK-15 | Encryption scheme complicates streaming | Medium / Medium | OD-03 default with both hashes; confirmed at the M0 spec gate | M3, M7, M8 |
| RK-16 | Demo reset erases records of real evidence | Medium / High | OD-19 default: block reset | M2 |
| RK-17 | Mobile streaming of large files | Medium / Medium | expo-video headers (F-31), Range tests in M8; E-31 if signed URLs | M8 |
| RK-18 | Simulated/Live divergence | Medium / Medium | OD-17 default: emulate v2 | M2 |
| RK-19 | Host-load test flakes mask real failures | High / Medium | Per-workspace runs, `--maxWorkers=2`, B10 first | all |
| RK-20 | Long task loses state across compaction | Medium / Medium | `checkpoint-resume`; `status_tasks.md` + `delegation_progress_report.md` updated per row | all |

**Assumptions and caveats.** The spike mechanisms (RTSP listen mode, `astreamselect` switching, CENC in the mp4 muxer, espeak-ng Indonesian voice, conversion package needs) are hypotheses until rows 2-4 and 7-12 report. Sizes and thresholds in the Gate Questions are proposals.

---

## Recommendation & Next-Plan Summary

### Key Findings Summary

| # | Finding | Confidence | Evidence Source | Implication |
|---|---|---|---|---|
| 1 | The impact map is still a valid starting input; 31 errata apply | High | drift check §0, §6; D260 | Row 6 consolidates; no re-analysis |
| 2 | M1 shrinks to spikes + functional STT; no benchmark on this Mac | High | D230; drift check §3.1 | Rows 7-15; benchmark is C-7 |
| 3 | Only `dems_demo` exists; lanes and lane pairings are gone | High | D240; drift check §4 | Lane re-creation opens M2 |
| 4 | Migration 0004 must change three FAULT_KIND CHECKs | High | `0001_tables.sql:281`, `:382`, `:488` (E-01) | Row 30 |
| 5 | Signature CHECK accepts only `SIMULATED-SHA256` | High | `0001_tables.sql:336` (D228) | Row 30; OD-04 |
| 6 | All 29 gate items have a default that lets work proceed | Medium (defaults are proposals) | Gate Questions | One-batch approval possible |
| 7 | Diarization/VAD models and possibly conversion packages need downloads | Medium (hypothesis) | D229 scope; row 4 to confirm | OD-20, OD-24, Q-INSTALL |

### Priority Recommendations

| Priority | Recommendation | Rationale | Risk if Ignored | Target Phase/Task |
|---|---|---|---|---|
| P0 | Answer the gate in one batch ("all defaults" is acceptable) | Rows 28-37 need OD answers | Spec work stalls; class B cannot start | Gate |
| P0 | Run B2 before any new npm dependency | Dependency debt + capture dependencies collide | Larger, riskier refresh later | Row 23 |
| P0 | Grant OD-14 and OD-23 | They unblock M2/M3 wiring and simulator v2 | M2 cannot start | M2 |
| P1 | Blanket Q-INSTALL for items 1-6 | Spikes and STT start without further round-trips | Each install becomes its own question | Rows 10, 13 |
| P1 | Give Q-HW information as soon as known | Class-C timing and OD-05/06/07 defaults depend on it | Real-device proof stays open | Class C |
| P2 | Keep OD-26 at default (b) | No large refactor inside a contract-breaking change | Merge conflicts in `live-sim.ts` | M2, M9 |

### Pending Decisions for Human-in-Loop

All pending decisions are in `## Gate Questions` (OD-01..OD-26, Q-AUTO, Q-INSTALL, Q-HW). Controller-level decision to record: **CF-2**, admitting class-A backlog implementation rows (16-27) into the initial blueprint at the user's request.

### Next-Plan Recommendations

- **Immediate next step:** after approval, record the gate answers (controller), then launch wave W1 (rows 1-5).
- **Subsequent tasks:** register (6) -> specs (28-36) -> plan (37); spikes (7-15) in parallel; backlog chain (16-27); gates 38, 39; refinement (40); second approval gate; then M2 opens with lane re-creation.
- **Parallelizable work:** spikes, backlog test hygiene and research collection run together within 8 slots, subject to the single-writer rules in §10.
- **Cross-task continuity notes:** diff baseline `c2c983b`; ledger 71/1,851, 160/3,954, 124/1,751, 117/1,495, 192/1,988; three emulators stay paired to the main instance until M2 re-pairs per lane; nothing under `release/`, `apps/mock-core` or the design book is touched.

---

## Agent Mapping Rationale

| Agent | Rows | Why |
|---|---|---|
| explore (tier D) | 1, 2 | Mechanical re-verification and read-only probes with one correct output, checkable against command output |
| data-collector (tier D) | 3, 4 | Generic external fact collection with citations; no design judgement |
| security-review | 5, 24, 35 | Vulnerability triage, dependency diff review and security design are security judgements |
| data-analyst | 6, 15, 28, 29, 31-34, 37 | Requirements synthesis, impact register, specs and plan. Matches task-2 precedent: `masterplan/01_specs.md`, `02_plan.md`, `04_client_integration_spec.md` were data-analyst |
| database-specialist | 30 | `dbc-3`, migrations, CHECKs, privileges. Task-2 precedent: `03_database_contract.md` |
| coder-execution | 7-14, 16-23 | Prototype code in scratch and code/test edits. Rows 10 and 13 are scripted installs: per-call downgrade to `model="sonnet"` is allowed (CLAUDE.md §11), escalate once on failure |
| senior-code-reviewer | 25, 26 | Per-unit code review checkpoints of the class-A diffs |
| test-expert | 27, 36 | Regression run and test strategy |
| verifier | 38, 39 | Independent +1 verification run (M1) and spec gate (M0); never downgraded |
| task-architect | 40 | Refinement of this blueprint only; never executes rows |

## Atomicity and Format Self-Check

| Check | Result |
|---|---|
| 7 columns, no merged cells, no multi-line cells, no prose between rows | PASS |
| One expected output per row; 40 distinct output paths | PASS |
| Agents only from `~/.claude/agents/` | PASS |
| Phases only from the standard folders (research, initialization, implementation, gateway_check, test, masterplan) | PASS |
| DAG: every dependency points to a lower step number or GA | PASS |
| Last row = task-architect refinement | PASS |
| Same-type in-flight <= 8; total <= 8 per wave | PASS (max 6) |
| No biometric, emulator-PIN, git-push or sudo step | PASS |

---
*Generated: 2026-10-07*
*Last Updated: 2026-10-07*
