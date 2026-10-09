---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: data-analyst-local
blueprint_row: 28
milestone: M0
class: B (all answered ODs)
tier: 1
type: phase-spec (5W1H tier 1)
status: draft-for-M0-gate
confidence: HIGH for scope, requirement, decision and citation mapping (mechanical over the errata-applied register `research/03_analysis.md`, blueprint §5-§9, D4/D7/D8/D10/D12); MEDIUM for mechanism design intent that rows 31-34 deepen, and for class/milestone placement inherited from the register's analyst-judgement confidence
source_translated_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/01_translated.md
source_structured_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/02_structured.md
source_analysis: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/research/03_analysis.md
decisions: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/decisions/decisions.md (D1-D12)
last_updated: 2026-10-09 14:20 (row-128 spec-gate fix pass PE-128-01..16 (D89, D91; `gateway_check/27_r9_r11_spec_gate.md`); requirements delta of blueprint row 120, marks PE-120-00..PE-120-10: R-9, R-10, R-11 in new section B.2, constraints C-N13..C-N15, class-C boundary in G.2; D73-D78; R-1..R-8 changed by cross-references only); 2026-10-09 (status sweep PE-R8-22: Q-D7 and Q-WORKER answered by D24); 2026-10-09 (pair-review errata PE-113-15/PE-113-16: R-8 CONFIRMED by D24, credential-store owner D68; see masterplan/11_audit_errata.md §5; earlier: 2026-10-08 RV-SPEC AU-1/AU-2/AU-3 errata + R-8 added as a proposal, D20)
---

# Phase Spec — DEMS real capture devices, sealing v2 and transcript

> **The register is the contract.** This spec is written against the errata-applied impact register
> `research/03_analysis.md` (blueprint row 6; 31/31 errata, 94/94 register rows, gate answers 29/29,
> R-1..R-7 7/7). Where the raw impact map and the register disagree, **the register wins**
> (`research/03_analysis.md` §Overview; D10(a); task instruction). Every later spec
> (`masterplan/03_api_contract.md`, `04_database_contract.md`, `05_capture_architecture_spec.md`,
> `06_evidence_package_spec.md`, `07_transcript_spec.md`, `08_client_ux_spec.md`), the plan
> (`masterplan/02_plan.md`) and the row-39 M0 gate (`gateway_check/05_m0_spec_gate.md`) are checked
> against this document and the register.
>
> **D12 corrections supersede earlier register/test lines.** D12(c) corrects the vitest `--maxWorkers`
> claim that the register records as W1-C7 (`research/03_analysis.md` §F, its line ~335) and D8 item 6:
> vitest 5.0.3 **does** honour `--maxWorkers`. A parallel data-analyst errata task fixes that register
> line; this spec must not edit it, so it cites D12(c) as the governing correction. D12(d) defers rows
> 13/14 (GStreamer). D12(a) adds the S4 measurements (row 9). D12(b) records rows 17/20 PASS.

**Citation short forms used throughout**

| Short | Source |
|---|---|
| `register §A/§B/§C/§D/§E/§F/§G` | `research/03_analysis.md` (A errata ledger, B register, C gate-answer mapping, D requirement trace, E superseded, F W1 corrections, G risk delta) |
| `structured §x` / `row N` | `identification/02_structured.md` section / row N |
| `translated` | `identification/01_translated.md` (G1-G7; C-PROC/C-REQ/C-TECH/C-SAFE) |
| `S1` / `S2` / `S4` | `research/06_spike_s1_fmp4_running_hash.md` / `research/07_spike_s2_mic_switch_timeline.md` / `research/08_spike_s4_av_sync_fixture.md` |
| `explore` | `research/01_explore.md` (row 1 re-verification) |
| `coll3` / `coll4` / `b2` | `research/02_collection.md` (F-nn) / `research/04_collection_stt.md` (F-nn) / `research/05_b2_dependency_triage.md` |
| `env` / `stt-install` / `gst` | `initialization/01_env_check.md` / `initialization/02_stt_runtime_install.md` / `initialization/03_gstreamer_install.md` |
| `Dn` | `decisions/decisions.md` decision Dn (D4 = approved gate answers; D7 = STT reuse re-scope; D8 = W1 corrections; D10 = W2 findings; D12 = W3 gate + deferral) |
| `CLAUDE §8` | `~/.claude/CLAUDE.md` §8 (tiered 5W1H) |

---

## 0. 5W1H frame (CLAUDE §8, tier 1)

| Axis | Content |
|---|---|
| **Who — subject** | The DEMS next phase: the demo Core stops simulating capture and records real cameras/microphones through a supervised capture worker, seals **one whole file per camera**, and puts a local CPU transcript inside the signed package (`translated` Intent; `structured` §0). Owning agent roles: `data-analyst` (specs rows 28, 31-34, 37), `database-specialist` (30), `security-review` (35), `test-expert` (36), `coder-execution` (spikes/implementation), `verifier` (gates), assigned in `structured` row table and D5/D9. |
| **Who — stakeholders** | (a) The user, who made the product decisions D219-D233 and approves at the second blueprint gate after row 40 (`translated` Intent; RF-9; D3). (b) The operator/investigator/supervisor roles who use the selector, mic toggle and transcript revisions (`translated` C-REQ R-1..R-5; register §C OD-10/OD-15). (c) The Kilo agent workflow that executes rows 1-40 (`report/report.md` §2, §5). |
| **What — scope** | Deliver the phase framework: scope statement and out-of-scope list (A), R-1..R-7 with measurable acceptance criteria (B), non-functional requirements incl. licences (C), the 29 answered gate items + 5 superseded items (D), mechanism design intent for capture/audio/transcript/sealing/lifecycle/clients (E), per-milestone success criteria (F), the hardware-independent completion line and class-C entry pack (G), backlog and deferrals incl. the GStreamer deferral (H). This spec does not implement; rows 31-34 deepen mechanisms and row 37 writes `masterplan/02_plan.md`. |
| **When — timeline** | Milestone order, no calendar dates: M0 (this spec + contract/DB/specs/plan) -> M1 (spikes S1/S2/S4 + working CPU STT) -> M2 (contract + DB foundation + Simulated parity; first row = lane re-creation) -> M3-M8 (worker, adapters/selector, mic failover, transcript, sealing, playback/export) -> **done-on-this-Mac line** -> M9 (hardening/regression/docs). A second approval gate (MAJOR) follows row 40 (`structured` §6; RF-9; D3). |
| **Where — where** | Repository `/Users/gsp-budi/Documents/DEMS`, branch `main`, code diff baseline `c2c983b`; re-verified HEAD `2a4f4ea` with no source delta (`structured` frontmatter; `explore` §0, §2.1). Touch points: `packages/shared` (SH-01..SH-25), `apps/core-server` (CS-01..CS-25), `apps/core-web` (WB-01..WB-11), `apps/mobile` (MB-01..MB-13), docs (DOC-01..DOC-06), new modules (NM-01..NM-14). Read-only: `apps/mock-core`, `release/` (register §B DOC-06; report §6). |
| **Why — rationale** | The user wants already-decided product requirements turned into a plan executable without re-planning (`translated` Intent; G1). The register consolidates 31 drift errata so later specs cannot silently rely on the outdated map (`register` §Overview). Every requirement traces to decisions, register rows and milestones so the M0 gate is mechanical (`register` §D; `structured` §7). |
| **How — methodology** | Consume gated inputs only (AS-3: no pre-gate re-analysis; `explore` re-verifies after approval). Evidence chain: decisions D4/D7/D8/D10/D12 -> register rows -> measured spikes (S1/S2/S4) and host truth (env/stt-install) -> this spec -> rows 31-34 detail -> row 39 gate. Every requirement carries >= 1 measurable acceptance criterion checkable on this Mac with fakes where the class allows. |
| **How — verification** | Each R-1..R-7 criterion names its mechanism (spike evidence `S1`/`S2`/`S4`, a suite run, or an e2e check) and the **2 runs + 1 verification** rule for every device/browser/spike check (`translated` C-PROC; D232/D233; `structured` §Verification). Unit/regression suites run once per workspace per checkpoint. |
| **Alternatives considered** | Media engine FFmpeg vs GStreamer (`coll3` F-63..F-74; row 15 memo; D10(c): GStreamer is a comparison prototype, not an R-3 dependency; D12(d): its install is deferred). CPU runtime whisper.cpp vs CTranslate2 (`coll4` F-01..F-43; OD-24; D7 reuse-first on this Mac with `cpu-local` for the Core). Diarization sherpa-onnx + Silero VAD vs pyannote (`coll4` F-100..F-112, LB-1; D8). Encryption per-fragment GCM outside the muxer vs CENC-in-muxer (`coll3` F-47/F-52; OD-03; register §F W1-C2). Signer software Ed25519 vs TPM vs PKCS#11 (OD-04). |
| **Assumptions** | (1) A real capture worker can embed libavfilter and trigger the mic switch at runtime — measured true (S2 §3 run3). (2) The FFmpeg RTSP-listen ingest is single-session and must be restarted per session — measured true (S1 §4.5). (3) The on-disk Whisper model is usable by the installed oMLX server without conversion — measured true (stt-install §3.3). (4) Class-C hardware is unknown (Q-HW); work completes on fakes. (5) The register's class/milestone placement is analyst judgement (MEDIUM) and is re-checked at the M0 gate (`register` §Risks). |
| **Gaps** | OD-21 legal acceptance of fMP4 as "one whole file" has **no external authority found** — carried as unresolved legal confirmation, not clearance (`coll3` F-102; D8; register §F W1-C8). OS-level fsync/power-loss durability untested (S1 §10 gap 2). No published Indonesian WER for the turbo tier (`coll4` G-3) and no benchmark on this Mac (D230) — the functional check uses no WER/RTF. D7's `TranscriberAdapter` touches the OD-24 default and is flagged for confirmation at the second blueprint gate (D7(c); register §F W1-C12). GStreamer rows 13/14 deferred (D12(d)). |

---

## A. Scope statement

### A.1 What this phase delivers (M0-M9, one-paragraph summary)

This phase turns the previously-decided DEMS capture requirements into an executable, verifiable
programme across nine milestones: it writes the phase specs, API contract C3, database contract
`dbc-3`, capture/package/transcript/client-UX specs, security design review and test strategy plus
the implementation plan, and the M0 register and macro backlog hygiene (M0); it proves the hard
mechanisms with measured spikes for fragmented MP4 with a running hash and crash truncation, a
gapless manual mic switch, AV-sync, and the media-engine comparison, and stands up a working
Speech-to-Text path (M1; executed on the installed oMLX/MLX server, which runs on the Apple GPU —
the CPU-only `cpu-local` path is installed, converted and proven on this Mac in M6, erratum AU3-01/AU2-01); it lays the contract, database and simulator foundation with lane
re-creation (M2); it builds the supervised capture worker with IPC and encryption over fake devices
(M3); the device adapters and Core-side selector (M4); manual mic failover end to end (M5); the
transcript pipeline with VAD, CPU STT and two-speaker diarization (M6); sealing v2 with the evidence
package, signer, per-fragment encryption and RECOVERY resume (M7); playback, export and on-demand
composite (M8); and finally hardening, full regression, third-party notices and a class-C benchmark
on the real Core device (M9) (`structured` §6; `translated` G4; register §Overview).

| M | Deliverable (corrected per `structured` §6) | Class |
|---|---|---|
| M0 | Specs + contract C3 + `dbc-3` + capture/package/transcript/UX specs + security design review + test strategy + plan (rows 28-37); register (row 6); backlog B2/B10/RC-1/B16 | A + B |
| M1 | Spikes S1 (fMP4 + running hash + crash truncation), S2 (mic switch), S4 (AV sync), S3 engine pick; STT functional transcript (rows 7-15, re-scoped by D7 to the installed oMLX server — **the CPU install/conversion/CPU-only check did not run in M1**; it moves to the M6 `cpu-local` functional-check row, erratum AU3-01) | A (S1/S2/S4/S3 memo) + B (rows 10-14) |
| M2 | Contract + DB foundation + Simulated parity; first row = lane re-creation + per-lane pairing; retire SC8 (OD-23) | B |
| M3 | Capture worker + supervisor + IPC with fake devices; CS-01..CS-04 under the P25 waiver; CS-22 boot checks; `capture/` static rules; B11 instrumentation | B |
| M4 | Device adapters + selector with fake adapters (real = class C); NM-01/09, WB-05/07/11, MB-08/09, CS-06/11 | B (fake) / C (real) |
| M5 | Manual mic failover end to end: NM-10, WB-01, MB-01/03, intervals in custody; B11 applied | B |
| M6 | Transcript pipeline: VAD, STT, 2-speaker diarization, incremental chunks with checkpoints | B |
| M7 | Sealing v2 + package + signer + encryption + RECOVERY; kill matrix; v2 verify; tamper demo | B |
| M8 | Playback, export, on-demand composite | B |
| — | **DONE ON THIS MAC WITH FAKE DEVICES** (see A.2) | — |
| M9 | Hardening and release: full regression, DOC-01..DOC-06, hygiene backlog, final verification chain; class-C benchmark on the real Core device | A + B (Mac) / C |

Source: `structured` §6; report §4.

### A.2 Hardware-independent completion line ("done on this Mac with fake devices")

The phase reaches its Mac-complete state when all three conditions of `structured` §5 hold:

1. M0-M3 and M5-M8 gates pass against **fake RTSP sources, fake audio inputs and a fake ONVIF stub (NM-14)**, plus the simulated capture driver.
2. M4 passes for the **selector** (API, DB, audit, three clients on emulators) and for the **fake adapters**.
3. M9 passes the **full regression, docs and the final verification chain**.

Every class-C item then sits in the class-C entry pack (G) with its entry criteria and its own gate,
so hardware can activate those rows without re-planning (`structured` §5; register §C Q-HW).

**Cross-reference (PE-120-03; D78).** With `AP3` recorded, the single definition of the line in `structured` §5 also includes the new-scope rows 120-142 and the "with AP3" clauses of gates 70, 75 and 89, and "fake devices" also covers the development sources of R-11 (section B.2). The wording of the line is not restated here; `structured` §5 holds it.

### A.3 Out of scope (never a deliverable of this phase)

| Out-of-scope item | Why / authority |
|---|---|
| `apps/mock-core` and `release/` (frozen 0.1.0 offline edition) | Read-only (register §B DOC-06; report §6; b2 §8 class D) |
| Production OS image, installer, TLS PKI beyond the dependencies it creates | `translated` Scope; report §10 |
| QR scanning on device (backlog B14, DR-02) | `structured` §8 B14 (carried, no row) |
| Biometric device test | D231; `translated` C-PROC; `structured` §8 A5/C7 |
| Live preview of real cameras | OD-12 "none in this phase" (D4); register §C OD-12; class C-6 |
| LAN listener for physical tablets/phones | OD-13 "keep loopback" (D4); class C-5 (needs demo password replaced + B3) |
| Release builds and pre-handover campaigns (A1-A6) unless the user announces handover | `structured` §8; report §9, §10 |

---

## B. Functional requirements R-1..R-7 (each with >= 1 measurable acceptance criterion)

Every requirement traces to decisions, register rows and milestones per `register` §D and
`structured` §7. Acceptance criteria are checkable on this Mac with fakes where the class allows;
each device/browser/spike check follows the **2 runs + 1 verification** rule (`translated` C-PROC;
D232/D233; `structured` §Verification).

### R-1 — Device-selector config in the Core, editable from web/tablet/phone under RBAC + audit

- **Narrative:** The Core persists which camera feeds `VIDEO-01`/`VIDEO-02` and which microphone is primary/standby. The selector is editable from all three clients under the new `CAPTURE_CONFIG` permission, only while idle, and every edit is audited. Fakes emulate two cameras (both topologies supported). **Cross-reference (PE-120-01; D76):** see R-9 (section B.2) for how a camera found on the network becomes assignable here, and R-11 for development sources.
- **Decisions:** D4 OD-05 (support both topologies), OD-10 (`CAPTURE_CONFIG` for SUPERVISOR + TECHNICIAN; idle only), OD-22 (PoE-cycle only a lost camera, audited).
- **Register rows:** SH-03, SH-04, SH-12, SH-16, SH-22, NM-09, WB-03, WB-05, MB-02, MB-08, MB-09 (register §D R-1).
- **Measurable acceptance criteria:**
  1. An edit of the capture config through the web selector writes exactly **one** audit row whose detail carries the permission `CAPTURE_CONFIG` and the changed fields, and a second edit attempted while a session is open is **refused** with a typed error and **no** audit row; verified by the M4 e2e check on web (agent-browser) **2 + 1** and by a unit test on the config store (`NM-09`). Cites OD-10, OD-05; register §C OD-10. **How:** agent-browser e2e + unit test (fake clock).
  2. The selector change is visible on tablet and phone emulators after refresh on recreated lanes; verified **2 + 1 each** (`structured` §6 M4). Cites OD-05; register §A E-24.
  3. Capture devices/state never reuse the paired-client registry slice `AdminResource.DEVICES`; verified by a unit test on the new `captureConfig`/`captureDevices` slices (`SH-16`). Cites register §A E-04.

### R-2 — Capture worker behind the API, supervised, IPC, adapters under the device contract

- **Narrative:** A separate supervised worker does real capture/processing; the Core controls it over IPC through a capture-driver seam and INTERNAL actions (precedent `setTabletLink`), with adapters (`CameraAdapter`, `PoeController`, `AudioInputAdapter`) under the existing device contract. The RTSP-listen ingest is single-session, so the supervisor **restarts the ingest process per session**. **Cross-reference (PE-120-02; D72(k), D73):** see R-10 AC-3 (section B.2) for the session start with no camera connected, and R-11 AC-4 for development sources in front of the unchanged worker.
- **Decisions:** D4 OD-05, OD-06, OD-07, OD-14 (limited P25 waiver).
- **Register rows:** SH-05, SH-06, NM-01, NM-02, NM-03, CS-01, CS-02, CS-03, CS-04, CS-06, CS-11, CS-22; blueprint rows 3, 7, 14, 15, 31 (register §D R-2).
- **Measurable acceptance criteria:**
  1. Worker integration with **two fake RTSP sources + two fake mics produces two playable fMP4 files**, the running hash equals the closed-file `shasum`, and checkpoints are contiguous; verified by the M3 worker-integration check **2 + 1** (`structured` §6 M3). Cites S1 §4.4/§6.3.
  2. Killing the ingest process mid-session and restarting the supervisor yields a fresh, playable file for the next session — the supervisor restarts the **ingest** (not only the pusher); verified by the M3 worker-crash check **2 + 1**. Cites S1 §4.5 (G-1), S1 SP-5; register §C OD-14.
  3. Real-mode boot checks require the worker binary, a writable evidence store, the signer key and the model files, and refuse boot otherwise; unit test (`CS-22`). Cites OD-24; `env` §12.

### R-3 — One active mic, manual audited toggle, intervals in the manifest, warn never auto-switch

- **Narrative:** One `AUDIO-01` session audio track carries the active mic (`MIC-01`/`MIC-02`, `MicRole` PRIMARY/STANDBY). The operator toggles the mic manually during recording; each switch is audited and recorded as a source interval in the manifest; low signal raises a warning but never auto-switches. The switch runs through the embedded libavfilter selector because the bare CLI cannot be operator-triggered.
- **Decisions:** D4 OD-09 (hot standby; toggle for the session holder with `SESSION_START` + SUPERVISOR; web-only recording stays "no"), OD-11 (below -50 dBFS for 10 s -> `MIC_SILENT`; disconnect debounce 2 s).
- **Register rows:** SH-03, SH-08, SH-13, SH-17, CS-07, NM-10, WB-01, WB-10, MB-01, MB-03 (register §D R-3).
- **Measurable acceptance criteria:**
  1. A manual switch produces exactly **1 AAC 48 kHz stream** with strictly monotonic PTS, **0 inserted / 0 dropped samples** — proven by the decoded sample count (= media duration x 48,000, ± the 1,024-sample priming) and by per-input continuity across the boundary against the pre-encode capture manifest, **not** by the packet-grid "0.001 ms" metric, which cannot see a gap (erratum AU2-05) — and a content boundary within **one worker input quantum + IPC latency** of the command (<= 21.333 ms only for a 1024-sample pull loop; erratum AU2-07); verified against the S2 mechanism (confirmed live by AU-2) and re-run at M5 from web/tablet/phone **2 + 1 each**. Cites S2 §0, §4; AU-2 §2; D10(c); register §A (NM-10).
  2. Each switch writes interval rows with `from_ms`/`to_ms` in media-pts domain (recoverable from the file within <= 1.17 ms) and an `AUDIO_SOURCE_SWITCHED` audit row carrying the **sending device ID**; verified by the M5 check **2 + 1**. Cites S2 §6 finding 3; register §A E-30; §C OD-09.
  3. A simulated silence crossing the threshold raises `MIC_SILENT` and the mic does **not** change; unit test on the warning raiser (no device needed). Cites OD-11; register §C OD-11.
  4. The M5 device checks present the **"Checking your permissions..."** state for every gated control (`translated` C-TECH; register §A E-16); verified in the same 2 + 1 runs.

### R-4 — One whole fMP4 file per camera with the single audio track, running SHA-256, fragment checkpoints

- **Narrative:** Two files (`VIDEO-01.mp4`, `VIDEO-02.mp4`), each holding that camera's video plus the single session audio track on one timeline, copy-only (no re-encode). Append-only fragmented MP4 with a running SHA-256 chain and per-fragment checkpoints in the manifest. Per-fragment authentication lives **outside** the muxer (CENC in the muxer is CTR-only).
- **Decisions:** D4 OD-03 (per-fragment AES-256-GCM; both stored-bytes and plaintext hashes), OD-21 (fMP4; fallback designed; legal confirmation before handover), OD-25 (all media in git-ignored paths).
- **Register rows:** SH-07, SH-25, CS-16, CS-20, NM-04, NM-05, NM-08; blueprint rows 7, 9, 31, 32 (register §D R-4).
- **Measurable acceptance criteria:**
  1. The running prefix hash recorded at close **equals** `shasum -a 256` of the closed file, the fragment sequence is contiguous with no gap, and a SIGKILL mid-write is detected within <= 20 ms with the durable prefix re-hashing to the recorded prefix; verified against S1 acceptance (5/5) and re-verified at the M1 gate **2 + 1** (`structured` §6 M1). Cites S1 §4.4, §5.2/§5.4, §6.3; register §A (NM-04).
  2. Fragment granularity is keyframe-aligned using `frag_keyframe + min_frag_duration` (the **GOP is the fragment quantum**); each fragment is independently decodable and, in the S1 variant, carries exactly 50 video packets at the 2.0 s GOP; verified at M1 and recorded as contract constants. Cites S1 §6.5 (SP-4); register §A W1-C1.
  3. Both the stored-bytes hash and the plaintext hash are present for each file in the v2 manifest; verified by the M7 v2 verify check on server + web + mobile **2 + 1**. Cites OD-03; register §C OD-03, RF-6.
  4. `git status --porcelain` lists **0 media files** after a capture run; verified at M3. Cites OD-25; S1 §7; register §C OD-25.
  5. Correctness must not rely on non-existent options: the mp4 muxer is specified with `frag_duration`, `frag_size`, `fragment_index`, `min_frag_duration` and `movflags {default_base_moof, empty_moov, isml, skip_trailer}` only — no `frag_type`/`default_prft`/`frag_start_number`; verified by a static test on the capture constants (`CS-25`). Cites `coll3` F-05/F-14/F-15; `env` §3; register §A W1-C1.

### R-5 — Transcript inside the seal; CPU + RAM STT; incremental; labels when possible; signed revisions

- **Narrative:** A machine transcript is produced incrementally during recording on CPU-only, placed inside the sealed package. Two speakers are labelled when possible; otherwise the transcript is sealed unlabelled with the flag "speaker labels unavailable". Corrections exist only as signed revisions; the sealed machine transcript never changes. On this Mac the development engine is the installed oMLX server (Apple GPU); the shipped production engine is CPU-only whisper.cpp (`cpu-local`) on the Core, which is also built GPU-off and proven on this Mac in M6 (erratum AU3-01). R-8 is confirmed (D24; erratum PE-113-15), so "inside the sealed package" applies only while STT is enabled by configuration (D20).
- **Decisions:** D4 OD-15 (`TRANSCRIPT_REVISE` for INVESTIGATOR + SUPERVISOR; Core key signs; author recorded; no approval flow), OD-20 (Indonesian only; diarization + VAD downloads after the licence check), OD-24 (whisper.cpp; D7 re-scope: Mac reuses installed oMLX, `cpu-local` later).
- **Register rows:** SH-09, SH-14, NM-06, NM-13, DOC-05; blueprint rows 4, 10, 11, 12, 33 (register §D R-5).
- **Measurable acceptance criteria:**
  1. The functional STT check on the synthetic two-voice Indonesian fixture returns a **non-empty JSON transcript with timestamps, >= 1 segment per scripted sentence, on CPU**, and the quoted command proves GPU/Metal disabled; **no RTF/WER figure** is claimed (D230); verified **2 + 1**. Cites stt-install §3.3 (engines usable; `duration` field unreliable), OD-20/OD-24; D230; `structured` §6 M1/M6. **Status (erratum AU3-01/AU2-01, D17/D18): NOT yet met** — row 12 ran on the oMLX/MLX server on the Apple GPU (`Device(gpu, 0)`); this criterion is met only by the `cpu-local` functional check on this Mac (whisper.cpp built from source under `.cache/` with GPU off, model converted in the isolated `.cache/` venv, `-ng` quoted, 2 + 1; the rev-2.1 blueprint row) and by `M6-TF-1` on `cpu-local`.
  2. The transcript is sealed and verifies **inside** the package; 2-speaker labels are either present or the `LABELLED/UNAVAILABLE` flag is set; verified by the M6 check **2 + 1**. Cites OD-15, OD-20; register §A (NM-06).
  3. A revision writes a new signed revision by the Core Ed25519 key with the author recorded, and the original sealed transcript is byte-unchanged; verified by a unit/e2e check at M7/M8. Cites OD-15; register §C OD-15.
  4. No dropped capture fragment while STT runs — one **2 + 1** check, not a throughput measurement, run with the **`cpu-local`** backend (a GPU engine gives no evidence about CPU starvation; AU3-01). Cites E-22; register §G RK-1; `coll4` F-138.
  5. `TranscriberAdapter` exposes two backends (`omlx-server` on this Mac, `cpu-local` on the Core) behind one interface plus a `TtsFixtureProvider`, so the same transcript code is used in dev and on the Core; verified by a contract unit test. Cites D7(a)-(c); register §F W1-C12.

### R-6 — One session per Core; blocked until SEALED; per-step progress + ETA; resumable via RECOVERY

- **Narrative:** One active session per Core; a new session is blocked until the previous reaches `SEALED` (rooms may wait). Sealing progress (per step) with an estimate is shown on all clients, forward-only from Core instants. Sealing is checkpointed and resumable through RECOVERY.
- **Decisions:** D4 OD-08 (a crash during RECORDING seals the durable part flagged "interrupted").
- **Register rows:** SH-06, CS-04, CS-21, NM-07, WB-01, MB-04, MB-06; blueprint rows 28, 32, 34 (register §D R-6).
- **Measurable acceptance criteria:**
  1. A start request while a session is open is refused; after `SEALED` it succeeds; verified by a unit/integration test on the session machine (`SH-06`) with a fake clock. Cites OD-08; register §C OD-08.
  2. Progress is **forward-only** and derived from Core instants (`coreClockOf`), never from the client wall clock; verified by the M7 kill matrix (each recording phase x each sealing step as distinct checks, **2 + 1**), with the final hashes equal to an uninterrupted run. Cites `structured` §6 M7; register §A E-13 (MB-04 risk High).
  3. After a kill during sealing, RECOVERY resumes and the session ends `SEALED`; verified in the same M7 kill matrix. Cites OD-08; register §A (MB-06).
  4. A crash during RECORDING seals the durable part and marks it `interrupted`; verified by the M7 kill matrix. Cites OD-08; S1 §5.4.

### R-7 — Hardware >= this Mac, CPU-only; no benchmark here; working STT first; benchmark on the Core device

- **Narrative:** The production hardware baseline is at least this Mac (Apple M5 4P+6E, 24 GiB) and **CPU-only for STT**. The model path is configurable. No benchmark is produced on this Mac; the benchmark (RTF, RAM, WER, labelling) runs later on the real Core device (class C).
- **Decisions:** D4 OD-24, Q-HW; D230 (no benchmark on this Mac); D7 (Mac reuse vs Core CPU engine).
- **Register rows:** CS-22, NM-06, NM-13; blueprint rows 2, 12, 36, 40 (register §D R-7).
- **Measurable acceptance criteria:**
  1. Real-mode boot checks require the worker binary, a writable evidence store, the signer key and the model files, and refuse boot otherwise; boot-check unit test (`CS-22`) with no hardware. Cites OD-24; `env` §12; register §C OD-24.
  2. The functional STT check runs with a **configurable model path** and produces a transcript (same evidence as R-5 AC-1); the benchmark harness `NM-13` is **not executed** on this Mac and is deferred to C-7. Cites D230; register §A E-22; `coll4` G-1/G-3.
  3. The production engine is CPU-only (`-ng`, no `--enable-*GPU` backends), while the Mac-side `omlx-server` engine uses the Apple GPU/Metal by design and is **not the shipped engine**; verified by the boot-check/model-path test and by the licence/portability record (DOC-05). Cites D7(b),(c); `coll4` F-10/F-11; `stt-install` §4.

### R-8 — STT server configurable, activated/deactivated from a configuration menu, stored in the database (CONFIRMED — D24, Q-STT-CFG answer (a))

> **Status: confirmed (erratum PE-113-15; D24).** New user requirement recorded as D20 (verbatim:
> "tambahkan, server STT configurable dan active/deactivate via config menu. konfigurasinya disimpan
> ke DB"). The defaults below were the controller's reading in D20; the user **confirmed all 13 of
> them at the second blueprint gate** (D24: "Q-STT-CFG (a) all 13 proposed R-8 defaults confirmed").
> R-8 is a requirement of this phase beside R-1..R-7 (the "R-1..R-7 7/7" self-gate rows of this file
> describe the M0 gate and are history). The pinned counts changed with row 113 and are **counted**:
> 92 operations (35 GET / 57 POST), 63 audit types, `offline` 26 (`03_api_contract.md` §1, §2.5, §8) (as built at row 113; targets after R-9..R-11: 97 / 36 / 61, 67 audit types, `offline` 31 — C3 §10.1). **Erratum PE-128-15 (C3 §10.1).**
> Sibling sections: `03_api_contract.md` §2.5, `04_database_contract.md` §B.13, `06_evidence_package_spec.md`
> §B.7a, `07_transcript_spec.md` §B.7, `08_client_ux_spec.md` §8a, `10_test_strategy.md` §A.6a.

- **Narrative:** The Core holds one STT configuration: enabled/disabled, backend (`omlx-server` on this Mac for development, `cpu-local` whisper.cpp for the Core), server endpoint (loopback URL, server backend only), model, language (Indonesian, OD-20), speaker labelling on/off. A SUPERVISOR or TECHNICIAN edits it from a configuration menu on the web console; tablets and phones show read-only status. The configuration is persisted in PostgreSQL in a **kept** table that survives the demo reset (OD-19 pattern). A change applies to the **next** session — the open session keeps the snapshot taken at its start (OD-10 pattern). Any server credential (for example the oMLX API key) is stored only as a **secret reference** (the oMLX key stays in `~/.omlx/settings.json`, SEC35-14) or encrypted in the Core credential store — never returned by the API, never in a slice, a log or an audit row. A "test connection" action checks the backend. When STT is **disabled**, no transcript work runs during recording and the sealed package records "transcript disabled by configuration"; R-5's "transcript inside the sealed package" applies only when STT is enabled. When STT is **enabled but the backend is unreachable**, sealing proceeds under the transcript failure rule (D-EV-1) and the package flags it.
- **Decisions:** D20 (requirement); D24 (Q-STT-CFG (a): confirmed with all defaults); D68 (credential-store owner, see the interim note below); D4 OD-10 (idle-only/next-session pattern, `CAPTURE_CONFIG` for SUPERVISOR + TECHNICIAN), OD-19 (kept tables), OD-20 (Indonesian only), OD-24 + D7 (backends), OD-13 (loopback only); SEC35-14 (oMLX key by reference only); D-EV-1 (seal with an explicit transcript state, never fabricate).
- **Register rows:** none yet (new requirement after the register); proposed owners NM-06 (transcript pipeline), NM-09 pattern (config store + API), CS-21 (kept set), WB-07 (web System entry), MB-09 (settings), E-30/E-31 (audit/credential rules).
- **Credential store, interim (erratum PE-113-16; D68(c)):** the encrypted form needs the Core credential store, which is built by **blueprint row 84** (M7-W3 key store, SEC35-03): row 84 owns `provideCredentialSealer` and the matching opener. Until row 84 lands, a `SECRET` write to operation 91 answers `503 NOT_READY` (`details.reason: CREDENTIAL_STORE_NOT_READY`) and stores nothing; the **secret reference** form works now. Row 115 treats a stored `ENCRYPTED` kind as "credential unavailable"; row 117's menu offers the reference form only. AC-3 below does not require the encrypted form. Source: `apps/core-server/src/modules/stt-config/seams.ts:15-20`, `change.ts:96-100,173`; `delegation_progress/pair_113_navigator.md:213-223`.
- **Measurable acceptance criteria (confirmed, D24):**
  1. The STT configuration is stored in the kept table `stt_config` and is image-equal after `db:reset`; the secret column is never selectable by the runtime role and no API response carries it; DB check `M2-STTCFG-DB` (1). Cites D20; OD-19; `04_database_contract.md` §B.13.
  2. An edit from the web configuration menu by SUPERVISOR or TECHNICIAN (`CAPTURE_CONFIG`) writes exactly **one** `STT_CONFIG_CHANGED` audit row whose detail carries the changed field **names** only (and `credentialChanged: true|false`, never a value); an INVESTIGATOR is refused (`403 NOT_PERMITTED`, "Checking your permissions..." state); tablet and phone show the status read-only; `M6-STTCFG-WEB`/`-TAB`/`-PHONE` **2 + 1 each**.
  3. The credential is never returned (responses carry `credentialSet: boolean` and `credentialKind` only), never in a slice, log or audit row; the test-connection action reports reachable/unreachable and model availability without echoing it; `M6-STTCFG-API` (1).
  4. A change while a session is open is stored and applies to the next session; the open session's transcript uses its start snapshot; `M6-STTCFG-NEXT` (1, fake clock).
  5. With STT **disabled**: a recorded session runs no transcriber work, seals with `transcript.state = 'DISABLED'` and the reason "transcript disabled by configuration" in the manifest, and v2 verify passes (verify clause proven at M7 by `M7-VV-SRV` / the CF-12 split check, blueprint row 119); seal-state clause `M6-STTCFG-OFF` **2 + 1**.
  6. With STT **enabled but unreachable**: sealing proceeds per D-EV-1 (`transcript.state = 'PARTIAL'`, failed chunks counted, no fabricated text) and the package flags the unreachable backend; `M6-STTCFG-UNREACH` **2 + 1**.
  7. The server endpoint accepts loopback hosts only (`127.0.0.1`/`localhost`); any other host is refused `422 INVALID_INPUT` (`details.reason: ENDPOINT_NOT_LOOPBACK`) — LAN is class C (OD-13); covered by `M6-STTCFG-API`.

---

## B.2 Requirements delta rev 2.3 — R-9, R-10, R-11 (NEW SCOPE D73; approved `AP3` = D78)

> **Status: approved new scope (delta PE-120-00; D73, D74, D75, D76, D77, D78).** Written by blueprint
> row 120 (`structured` row 120, §0.3 "NEW SCOPE (D73)", G-4). The three requirements are the user's
> own words of 2026-10-09 (D73, verbatim: "bagaiimana jika belum ada kamera yang terhubung ? harus ada
> mekanisme pencarian kamera di network loh, nah kalau tidak ada juga perlu ada notifikasi. dan agar
> semua fungsi bisa berjalan jika kamera / mic di network tidak ada yang terhubung, saat development
> bisa menggunakan kamera dan mic di device ini dulu"), sharpened by the user's answers D74 ("setuju
> dengan rekomendasi kamu"), D75 ("kamu juga boleh uji pencarian onvif kamera di network ini"), D76
> ("device yang ketemu boleh di list probe dulu, tidak perlu di koneksikan, jika ada aksi
> konektifitas, semua di forward ke user untuk input crredential. jadi perlu dibuat mekanismenya")
> and D78 ("1. network dimana mac ini bisa uji 2. confirmed"). R-9..R-11 are requirements of this
> phase beside R-1..R-8. This section states **what** must hold and how it is checked; the operations,
> the schema, the adapter and helper design, the manifest field, the screens, the security findings
> and the named checks are owned by rows 121-127 (open points in B.2.6). Names marked *(proposed)* are
> this row's proposals and are fixed by the row named beside them.
>
> **Where a sentence is the controller's reading and not the user's words, it says so.** The bounds of
> D75 (probe only, no authentication attempt, no configuration change, identifying results only in
> git-ignored paths) are recorded in D75 as the controller's reading; D76 confirms them in the user's
> words for the connect rule. Places where the user's answers leave a real ambiguity are listed in
> B.2.7 and are not silently decided here.

### B.2.0 5W1H frame of the delta (CLAUDE §8, tier 1)

| Axis | Content |
|---|---|
| **Subject** | Three gaps the user named after the D72(k) ruling: there is no way to find a camera on the network from the product (R-9), no operator-visible message when nothing is found or connected (R-10), and no way to run every function on this Mac when no network camera or microphone exists (R-11). Source: D73. |
| **Stakeholders** | The user (requirement owner; answers D74-D76, approval D78; answers the macOS permission prompt, D74 (3); types every real camera credential, D76 (4)). The roles holding `CAPTURE_CONFIG` — SUPERVISOR and TECHNICIAN (OD-10) — who search and connect. Every operator who starts a session and must be told that nothing is recording (D72(k)). The agents of rows 121-142, bound by D75/D76 on the real network. |
| **Scope — in** | Search for cameras on the network (ONVIF WS-Discovery behind `CameraAdapter.discover()`, `cap` §A.6); a candidate list; an operator-driven, credential-gated connect flow; three no-device notifications with a "Search again" action; a development-only local-device source set. |
| **Scope — out** | Authenticated ONVIF actions and configuration changes on a real camera (NTP set, GOP set, PoE cycle, profile change) — class C until the user supplies the account (D75, D76; G.2 C-1/C-2). Network discovery of microphones (not asked for; mics are local inputs behind `AudioInputAdapter.enumerate()`, OD-06 — see B.2.7 item 5). Entering a camera address by hand (not asked for; see "Alternatives"). Live preview of a found camera (OD-12). A LAN listener (OD-13; C-N4). Desk View (D74 (2)). |
| **Timeline** | Spec rows 120-127, spec gate row 128; implementation rows 129-142 in M4 (search, notifications, helpers, adapter kind, clients, connect flow), M5 (session-start notification, local-device session) and M7 (manifest mark); gates 70, 75 and 89 gain "with AP3" clauses (`structured` §0.3 table; rows 129-142). |
| **Rationale (evidence chain)** | D72(k) fixed "no camera connects -> the session FAULTS" without telling the operator anything and without a way to find a camera -> the user's reply D73 -> design questions answered D74 -> real-network permission D75 -> list-first / credential-gated rule D76 -> rev 2.3 Part B, PRE-HIL V1-V7 PASS, D77 -> approval D78. What exists today: `CameraAdapter.discover()` is an interface sketch (`05_capture_architecture_spec.md:268-273`) whose real implementation was class C (G.2 C-1 before this delta; `cap` §J H-7, `05_capture_architecture_spec.md:805`); operation 89 exists in the contract and in the simulator (`packages/shared/src/api/devices.ts:519`, `packages/shared/src/sim/api.ts:111`), and `grep -rn setCaptureDeviceCredential apps/core-server/src` returns 0 non-test hits on 2026-10-09 — the Core-server side of the credential path is not built yet. |
| **Methodology** | Each requirement is written as numbered, observable acceptance criteria; each criterion names its decision IDs, how it is checked and its depth (unit / contract test once; device, browser and real-LAN checks **2 runs + 1 verification**, C-N7). Check IDs are assigned by row 127 and are not invented here. |
| **Alternatives considered** | (1) *Search at boot or in the background* — rejected by D74 (1): a probe is multicast traffic on a network the operator may not own; it runs only on an operator action. (2) *Adopt a found camera automatically, or try a vendor default account* — rejected by D76 (1)-(2). (3) *A second, simpler credential store for the connect flow* — rejected: one write-only path, operation 89, and one Core credential store (D68(c); D76 (3)). (4) *Typed address entry instead of discovery* — not asked for, and it would turn the connection test into a request to an operator-chosen host; not offered in this phase (gap, B.2.7 item 10). (5) *Audio-only evidence when no camera connects* — not designed (D72(k)). (6) *Teach the worker to open a local device* — rejected by the D73 design constraint: the worker is unchanged and a local device enters as a loopback source. (7) *Refuse to seal development-source recordings* — rejected by D78 (2): they seal and verify PASS with the mark reported. (8) *Use the Mac's second camera view (Desk View) as camera 2* — rejected by D74 (2). |
| **Assumptions** | A-1: this Mac has one usable camera and one microphone through avfoundation and FFmpeg 9.0.2 needs no install (the coordinator's measurement quoted in D73 and `structured` §0.3; not re-measured by this row). A-2: a WS-Discovery `ProbeMatch` carries enough unauthenticated data (address, endpoint reference, scopes with vendor / model / name) to draw a useful candidate row — **hypothesis** from the ONVIF and WS-Discovery specifications as this analyst recalls them, with no source file in this repository; row 123 verifies it on the fake stub and on the real-LAN probe. A-3: most ONVIF cameras refuse `GetDeviceInformation` without an account — **hypothesis** on the same basis; it is why AC-2 of R-9 does not depend on that call. A-4: the mic transport that `AudioInputAdapter` exposes after row 65 can be fed by a local helper without a worker change (`structured` rows 65, 135). |
| **Gaps** | No ONVIF npm package is named yet (DP-13; row 123 names it and checks licence and maintenance, row 96 carries the licence entry — C.1 is not edited here). No measurement exists of a real ONVIF device answering on this Mac's network (zero responders is a valid outcome, D75). "Production configuration" has no single written definition yet (row 61 fixes capture mode `real` versus the demo flag; B.2.7 item 7). The items of B.2.7. |

### R-9 — Camera discovery on the network: a search yields a candidate list only; every connectivity action is operator-initiated and credential-gated

- **Narrative:** The Core can search the network for cameras. A search is started by an operator and returns a **list of candidates** built only from what a device announces without authentication. A search connects, registers and authenticates **nothing**. To use a found camera the operator starts a separate **connect flow**: candidate -> operator action -> the operator types the camera's credential in the product UI -> the credential travels only in the request body of the connection test (operation 95, held in memory for that request) and of the adoption (operation 96, whose credential leg is the operation-89 write inside the adoption transaction); it is stored only in the one Core credential store (D80(7), D81) -> a connection test with a named outcome -> only after a successful test is the camera assignable in the R-1 selector. No default, reused or guessed credential exists anywhere in the product; without an operator-entered credential a connection attempt cannot be made. In this phase a found real camera can be tested, adopted and assigned but not recorded: no listener opens for a source kind without an opener (D82, D86 C-5). **Erratum PE-128-01 (D81; D80(7); D86 C-5).**
- **Decisions:** D73 (requirement); D74 (1) (when a search may run); D75 (probe of this Mac's current network allowed; bounds); D76 (list first; connect only through the operator's credential; agent rule); D78 (1) (which network the real-LAN check uses); D4 OD-10 (`CAPTURE_CONFIG`, idle-only), OD-13 (loopback); D68(c) (one Core credential store, sealer owned by row 84); E-30/E-31 (audit without values).
- **Register rows:** none (new scope after the register; `structured` §5.6 note "Rows 120-142 have no register row; they trace to D73-D76"). Touches NM-09 (`CameraAdapter`), NM-01 (selector registry), NM-14 (fake ONVIF stub), WB-05, MB-08, MB-09.
- **Measurable acceptance criteria:**
  1. **Search trigger.** A search runs in exactly two cases: (a) an operator presses "Search for cameras" (or "Search again") on the web console, the tablet or the phone; (b) **once** inside a pre-check that an operator started, when a configured camera is unreachable. It never runs at boot, on a timer, in the background or as a side effect of a read. Checked by a unit test that boots the Core in capture mode `real` against the fake stub and counts **0** probes until one of the two triggers fires, and by a static rule that `CameraAdapter.discover()` has no other call site. Cites D73, D74 (1).
  2. **The result is a candidate list from unauthenticated probe data only.** Each candidate carries its network address, its endpoint reference, and name and hardware (model) hints from the announced scopes; a vendor hint only when a device announces a non-standard scope (ONVIF has no vendor scope category, `cap` §A.6.1 V-9), plus one mark: **new** or **already registered** (matched against `capture_devices` by `onvif_uuid` = endpoint reference, else by the whole stored `address`; `dbc-4` §N.5; D83) **Erratum PE-128-02 (D83; D-DB-15).** No field of a candidate needs a credential to obtain. Checked on the fake stub: N stub devices -> N candidates with the announced fields, and a stub device whose identifier is already in `capture_devices` reads "already registered"; unit / contract test. Cites D76 (1), D75.
  3. **A search connects, registers and authenticates nothing.** After a search: `capture_devices` and `capture_device_credentials` have **0** new and **0** changed rows; the request log of the adapter shows **0** authenticated requests, **0** configuration requests (no NTP set, no GOP set, no profile change, no PoE cycle) and **0** RTSP sessions. Checked on the fake stub (request log of the stub) and in the real-LAN check of AC-15. Cites D76 (1), D75.
  4. **Candidates are not capture devices.** The candidate list lives only as data of the operator session that ran the search, has a bounded lifetime (a contract constant, value by row 121), and is discarded at its expiry, at sign-out and at a Core restart; it never appears in the `captureDevices` slice or in operation 77. Checked by a unit test with a fake clock. Cites D76 (1); `structured` row 132.
  5. **Connect flow, in this order and no other.** candidate -> the operator presses "Connect" on that candidate -> the web console asks the operator for the camera's credential (web console only, D80(3)) -> the credential is sent in the body of operation 95 for the connection test (held in memory for that request) -> it answers one named outcome (AC-6) -> operation 96 adopts the candidate and stores the credential in one transaction through the operation-89 write path -> **only** after the success outcome and the adoption can the camera be assigned to `VIDEO-01` / `VIDEO-02` by operations 78 / 79 (R-1). Assigning a candidate that has not passed the test is refused. Checked on fixtures (fake stub + fake cameras with fixture credentials on loopback): the full sequence succeeds once, and an assignment attempted before the success outcome is refused with a typed error; **2 + 1** on the web console. With a credential the full sequence is provable only after row 84 (`M7-CONN-CRED-1`, `M7-CONN-W-CRED`); from M4 it is proven for a fixture candidate without a credential, and with a credential up to `503 CREDENTIAL_STORE_NOT_READY`. **Erratum PE-128-03 (D81; D80(3); D80(7)).** Cites D76 (2)-(3).
  6. **The connection test has enumerated outcomes.** At least: *reachable* (authenticated, a usable H.264 profile found), *authentication failed*, *wrong profile* (no usable media profile), *not H.264*, and *unreachable* (no answer within the timeout; proposed by this row, `structured` row 121 lists the first four). Each outcome is reached once on fixtures. The connection test only **reads** from the camera: it changes no setting on it (no NTP set, no GOP set — those stay class C, G.2). Checked by contract tests on fixtures. Cites D76 (3), D75.
  7. **No default, reused or guessed credential — by construction.** The connection test takes its credential from one place only: the `credential` member of the request of operation 95 or 96, typed by the operator for that candidate in that request (D80(7), D81). Without it a `PRODUCTION` candidate is refused (`422 CREDENTIAL_REQUIRED`) **before any network request** (asserted: 0 outbound requests). A stored credential is never read for a test, so a credential stored for device A can never be offered to device B. **Erratum PE-128-04 (D81; D80(7)).** The adapter and the helper sources contain no credential literal and no vendor-default table (static rule). An *authentication failed* outcome is never followed by another attempt that the operator did not start. Cites D76 (2); `structured` row 142.
  8. **A failed or abandoned flow leaves nothing registered.** After a closed prompt, an *authentication failed* / *wrong profile* / *not H.264* / *unreachable* outcome that the operator does not retry, a sign-out or a Core restart in mid-flow: **0** rows for that candidate in `capture_devices` and **0** rows in `capture_device_credentials`; the candidate is still a candidate marked "new" while its search result lives. A retry is a new operator action with a newly typed credential. Checked on fixtures for each exit, with a row count before and after. Cites D76 (2)-(3); G-4 item 4.
  9. **Every step is audited, without values.** One audit row each for: search performed (*proposed* `CAPTURE_DISCOVERY_SEARCHED`, with the trigger — manual or pre-check — and the responder counts), candidate adopted (*proposed* `CAPTURE_CANDIDATE_ADOPTED`), credential set (existing `CAPTURE_CREDENTIAL_SET`, detail `deviceId` only, `03_api_contract.md` §2.4 / §5.2) and connection-test outcome (*proposed* `CAPTURE_CONNECTION_TESTED`, with the outcome name). No detail key or value carries the credential, the typed username or a credential-bearing URL (E-30 / E-31; `03_api_contract.md` §5.1); an *authentication failed* outcome is audited as a fact (camera-credential refusals are audited, C-N9). Names and exact detail-key lists are fixed by row 121. Checked by the detail-key rule test with 0 secret keys. Cites D76 (3).
  10. **The connection test is not an SSRF or port-scan primitive.** It may target only (i) an address that a search returned **in the same operator session** and whose result has not expired, or (ii) a loopback fixture (`127.0.0.1`, fixture ports, C-N4) outside a production configuration. The operator cannot type a host, a port or a URL. A service address announced by a responder is used only if its host is the address the answer came from. A test against any other address is refused before any network request. Checked by unit tests: a foreign address, an expired result, another session's result and a responder announcing a third-party host are each refused with 0 outbound requests. Cites D76 (2); `structured` rows 126, 142.
  11. **Searches and connection tests are rate-limited.** Contract constants (values by rows 121/126) bound how often one operator session may search and how often a connection test may run per device and per Core; the bound on failed tests per device is low enough not to trip a camera's own account lock-out. An attempt over the bound is refused with a typed error and no network request. Checked by a unit test with a fake clock (C-N5). Cites D75, D76; `structured` row 126.
  12. **Roles.** The manual search, the candidate list and every step of the connect flow need `CAPTURE_CONFIG` (SUPERVISOR + TECHNICIAN, OD-10) — the same permission as operations 78-80 and 89; no new permission is created. Every other role is refused (`403 NOT_PERMITTED`) and sees the control in the "Checking your permissions..." state, then disabled with its reason (C-N12). The one search inside a pre-check (AC-1 (b)) runs for the operator who started the pre-check; that operator sees its outcome as the R-10 notification, and a candidate list or a "Connect" control only if they hold `CAPTURE_CONFIG`. **Mobile rule:** search, candidate list and notifications are required on web, tablet and phone. Entering the camera credential is **web console only** in this phase (D80(3)); the server enforces it (`WEB_CONSOLE_SESSION` on operations 89, 95, 96 -> `403 NOT_PERMITTED`, `WEB_CONSOLE_ONLY`). On tablet and phone "Connect" is shown disabled with the sentence that points to the web console, never hidden. **Erratum PE-128-05 (D80(3)).** Checked per client, **2 + 1** each. Cites D73, D76 (2), OD-10.
  13. **Config lock.** *Proposed and justified:* while a session is open, **searching is allowed** and read-only — it changes no configuration, registers nothing (AC-3) and is the remedy the R-10 notifications offer, so refusing it would leave the operator with a message and no action; **every step of the connect flow is refused** `409 CAPTURE_CONFIG_LOCKED` with no state change and no audit row, exactly like operations 78-80 and 89 (`03_api_contract.md` §2.2 access notes), because adoption and the credential write change the capture configuration and a connection test opens sessions to a camera while evidence is being recorded. The stricter alternative (refuse the search too) was not chosen for the reason above; rows 121 and 126 confirm or overturn this. Checked by a unit test on the session machine with a fake clock. **Narrowed by D86 C-4:** while the session state is `RECORDING`, operation 93 answers `409 INVALID_STATE` (`DISCOVERY_NOT_ALLOWED_WHILE_RECORDING`) until `M4-SEC-DISC-1` and `M4-SEC-DISC-3` are recorded PASS; the lift is checked by `M4-DISC-REC-1`. In every other open state a search is allowed. **Erratum PE-128-06 (D86 C-4, narrows D80(4)).** Cites OD-10; D76 (2).
  14. **The automated suite never touches the real network.** Every automated test of search and connect uses the fake ONVIF stub and fake cameras on loopback with fixture credentials; a suite run with no camera on the LAN passes. Checked by the suite itself and by a socket snapshot showing no non-loopback traffic during the suite. Cites D74 (1).
  15. **Real-LAN verification.** One named check runs the search against the network this Mac is on at test time: **2 runs + 1 verification**, outcome "N responders found", where **N = 0 is a valid outcome that must end in the R-10 notification** (AC-1 of R-10). If the Mac is on no network it can test at that time, the check is recorded **"not run"** with the reason and is reported, not replaced by a probe elsewhere. A socket snapshot shows one UDP socket during the search and none before or after (C-N13); the request log shows 0 authentication and 0 configuration requests. Cites D75, D78 (1).
  16. **Agent rule on the real network.** On the user's network an agent lists and probes only. An agent never types, stores, receives or guesses a real camera credential; a check that needs a real connection stops and hands over to the user, who types the credential in the product UI. Identifying results of a real probe (IP address, MAC address, serial number) are written only under git-ignored `.data/` or `.cache/`; committed documents quote counts and vendor or model class only. Checked at each gate by a credential-pattern search over the evidence files (0 matches) and `git status --porcelain`. Cites D75, D76 (4).

### R-10 — Operator-visible notification when no camera or microphone is found or connected, with a "Search again" empty state

- **Narrative:** Whenever the product has no camera or microphone to work with, the operator is told so in plain words on the client in front of them, and is offered the action that can fix it. Three situations are covered: a search that finds nothing; a configured camera or microphone that cannot be reached at pre-check; and no camera connected at session start, where D72(k) already rules that the session FAULTS and nothing claims to record. A later success clears the notification.
- **Decisions:** D73 (requirement); D72(k) (no camera within the ingest-open window -> the session FAULTS; one camera = a valid degraded session with a warning; no audio-only evidence), D72(h) (a capture-originated fault is cleared by the capture side, never by demo operation 74; a later occurrence is a new fault with its own audit row), D72(i) (in mode `real` a missing feed reads NO SIGNAL; generated meters never replace telemetry); D74 (1); D75 (zero responders is a pass that ends here); D4 OD-10, OD-11.
- **Register rows:** none (new scope). Touches WB-05, WB-01, MB-08, MB-09, MB-01, the fault / alert vocabulary (SH-03) and the session machine (SH-06).
- **Conventions followed:** an alert in this product is a fault kind with a severity and an audit row (`packages/shared/src/sim/faults.ts:31-66`: `FAULT_EVENT_KIND`, `FAULT_SEVERITY`; existing capture kinds `CAMERA_LOSS` CRITICAL, `MIC_NO_SIGNAL` WARNING, `MIC_SILENT` WARNING, `CAPTURE_FAULT` CRITICAL). The three fault-kind CHECK constraints of the database accept a closed list (section F, row M2: "three FAULT_KIND CHECKs"), so a **new** fault kind is a schema change (row 122), while a new **reason** on an existing kind is not. The names below are *proposed*; row 121 fixes names, severities and detail keys, and chooses between new kinds and reasons on existing kinds.
- **Measurable acceptance criteria:**
  1. **Situation A — a search returned nothing.** *Operator sees:* on web (Devices page, WB-05), tablet (Devices screen, MB-08) and phone (Settings -> Devices, MB-09) an empty state that says no camera answered the search, with a **"Search again"** action; the existing empty text "No capture devices configured" (`08_client_ux_spec.md` §2.5) gains the "Search for cameras" action so that a Core with no camera at all leads straight to a search. *Records:* the search audit row of R-9 AC-9 with a responder count of 0, and exactly **one** alert for the occurrence (*proposed* `CAPTURE_DISCOVERY_EMPTY`, WARNING) — not one per client and not one per screen refresh. A search that finds only already-registered cameras is not "nothing": the list is shown and no alert is raised. Checked on the fake stub set to empty: one alert, the audit rows fixed by row 121, the empty state on all three clients, **2 + 1** each. Cites D73, D75.
  2. **Situation B — a configured camera or microphone is unreachable at pre-check.** *Operator sees:* the pre-check result names each unreachable device by its device ID and label (never by a credential, never by a credential-bearing URL), on the client where the pre-check was started and on the other two as the same Core state. For a camera, the one search of R-9 AC-1 (b) has run and its count is shown; "Search again" repeats it. For a microphone, "Search again" re-reads the local inputs (`AudioInputAdapter.enumerate()`), because a microphone is not a network device in this phase (OD-06). *Records:* exactly **one** alert per unreachable device per occurrence (*proposed* `CAPTURE_DEVICE_UNREACHABLE`, WARNING, naming the device ID) and its audit row. *Proposed start rule, consistent with D72(k):* both cameras unreachable, or both microphones unreachable, blocks the start; one camera of two, or the standby microphone, unreachable lets the operator proceed into a degraded session after the warning (B.2.7 item 6). Checked on fakes with one configured fake camera stopped and with one fake microphone removed: one alert naming the device, **2 + 1** per client. Cites D73, D74 (1), D72(k).
  3. **Situation C — no camera connected at session start.** When no camera connects within the ingest-open window the session **FAULTS**, nothing claims to record and **0** evidence files exist (D72(k)). *Operator sees:* on all three clients a fault presentation that says no camera is connected and **nothing was recorded** — never a running timer, never a recording indicator, never generated meters (D72(i)) — with "Search again" (subject to R-9 AC-12 and AC-13). *Records:* exactly **one** CRITICAL alert (*proposed* a `CAPTURE_FAULT` with the reason `NO_CAMERA_CONNECTED`, or a new kind) and exactly one audit row stating that nothing was recorded. With **one** camera of two connected the session records as a valid degraded session, with exactly **one** WARNING naming the missing camera and its audit row. Checked on fakes: 0 cameras -> FAULTED, one alert, one audit row, 0 evidence files; 1 camera -> recording with one warning; **2 + 1**. Until the first durable fragment the session presents 'connecting cameras', never 'recording' (the stored state stays `RECORDING`; the session payload gains the boolean `captureDurable`, `false` until the first durable fragment — ruling R-1 option A, D91). `FAULTED` with nothing durable is a failed start: 0 evidence files, 0 evidence items, no interrupted seal (D84). **Erratum PE-128-07 (D84; D82(f); D91).** Cites D72(k), D73; `structured` row 139.
  4. **"Search again".** Each of the three notifications and the empty state carries the action; it runs the operator search of R-9 AC-1 (a) under the same permission, config-lock and rate-limit rules (R-9 AC-11..AC-13); an operator without `CAPTURE_CONFIG` sees the action disabled with the sentence naming the roles that can search, after the "Checking your permissions..." state (C-N12). No client-side countdown or automatic retry is drawn (forward-only rule, `08_client_ux_spec.md` §2.7). Checked in the same **2 + 1** runs. Cites D73, D74 (1).
  5. **A later success clears the notification.** Situation A is cleared by a later search with at least one responder; situation B by a later pre-check in which the device is reachable; situation C and the degraded warning by the capture side when a camera connects in a later session — a capture-originated alert is cleared by the capture side and never by the demo operation 74, and a later occurrence is a **new** alert with its own audit row (D72(h)). After clearing, no client shows the notification after its next state update. Checked on fakes by raising, clearing and raising again: 2 alerts and 0 stale banners; audit rows per situation as C3 §5.4 — A: one `CAPTURE_DISCOVERY_SEARCHED` row per search and none for raise or resolve; B and C-degraded: 2 `CAPTURE_DEVICE_UNREACHABLE` rows, none on resolve; C: `FAULT_RAISED` twice and `FAULT_CLEARED` once. **Erratum PE-128-08 (D80(8); C3 §5.4).** Cites D72(h), D73.
  6. **Raised once, shown everywhere, no values.** An alert is raised once per occurrence by the Core and is drawn by each client from the Core state; a client never raises its own copy. Alert and audit text carry device IDs, labels and counts only — no credential, no username, no credential-bearing URL (E-30 / E-31). Checked by the detail-key rule test and by a three-client run that counts one alert in the Core. Cites D76 (3); C-N8, C-N9.

### R-11 — Development-only fallback to this Mac's camera and microphone

- **Narrative:** So that every function — start, mic switch, stop, sealing, verification, playback — can be run end to end when no network camera or microphone exists, the Core has a development mode in which camera 1 and microphone 1 are this Mac's own devices and camera 2 and microphone 2 are fake sources. It is a development tool, fenced off from any production configuration, visibly labelled, marked in the evidence manifest, and it does not change the capture worker.
- **Decisions:** D73 (requirement and the design constraints given with it: worker unchanged, `LOCAL_DEVICE` adapter kind development-only with a boot fence and a manifest mark); D74 (2) (which device fills which slot; Desk View not used); D74 (3) (recordings only under git-ignored `.data/`; the user answers the macOS prompt; no agent touches TCC or system settings); D78 (2) (a development-source package may be sealed and verifies PASS with the mark reported); D72(l) (one definition of capture mode `real` versus the demo flag, with boot refusal — row 61); D4 OD-25, OD-13.
- **Register rows:** none (new scope). Touches NM-01 (adapter registry), NM-09 / NM-10 (adapter seams), NM-14 (fake sources), NM-08 (manifest), CS-22 (boot checks), WB-05, MB-08, MB-09.
- **Measurable acceptance criteria:**
  1. **Development-only fence at boot.** The Core refuses to boot (a) with a configuration that names a development source while the development flag is off, and (b) with the development flag set together with a production configuration. The flag is defined **through** the one capture-mode definition that row 61 fixes ("one function reads the other", D72(l)) — R-11 adds no second, independent definition of "real", "demo" or "development". Checked by two boot-refusal unit tests (one per case) and a static test that the flag is read in one place. Cites D73, D72(l); `structured` rows 61, 136.
  2. **Never selectable in a production configuration.** In `REAL_PRODUCTION` (capture mode real, development flag off) operations 76 / 77 list **0** development sources, the selector on all three clients offers none, and an assignment that names one is refused; in `SIMULATED` every stored kind is inert and the seeded `FAKE` built-ins stay listed as today (D83 O-2). **Erratum PE-128-09 (D83 O-2).** Checked by a contract test and in the client runs of AC-6. Cites D73.
  3. **Which source fills which slot.** In development mode: camera 1 = this Mac's camera, camera 2 = a fake source; microphone 1 = this Mac's microphone, microphone 2 = a fake source. Desk View is not used. The plan built in development mode names exactly these four sources. Checked by a unit test on the plan builder. The local camera and the local microphone are device rows of their own (the next free `CAM-NN` / `MIC-NN`); `CAM-01`, `CAM-02`, `MIC-01`, `MIC-02` stay `FAKE` and the adapter kind of a row never changes (D83). **Erratum PE-128-10 (D83; D-DB-13).** Cites D74 (2).
  4. **The worker is not changed.** A local device enters as a **loopback source in front of the existing paths**: the camera as an H.264 stream over RTSP/TCP on `127.0.0.1` into the worker's unchanged stream-copy ingest, the microphone through the mic transport that `AudioInputAdapter` exposes (`cap` §A.6, §A.7; `structured` rows 134, 135). Each helper is a separate process. Checked by `git diff` of the worker sources over the R-11 rows = **0 changed lines**, and by a socket snapshot of each helper showing **0 listening sockets** and one outbound TCP connection to `127.0.0.1` (the worker is the listener and the helper pushes; `cap` §A.6.4, §G.1) **Erratum PE-128-11 (D82(d)).** Cites D73.
  5. **A local device that cannot be opened ends in R-10, never in a silent substitute.** When macOS has not granted camera or microphone access, when the device is busy in another application, or when it is absent, the helper exits with a **named** error (permission denied / device busy / device not found), the adapter reports the source unreachable, and the operator gets the R-10 notification of situation B at pre-check or the degraded-session warning of situation C at session start. The Core never swaps in a fake source for a local device without saying so. Checked by a unit test with a stub helper for each of the three errors; the real permission-denied path is observed only if the user chooses to deny. Cites D73, D74 (3), D72(k).
  6. **Visible label.** Every place where a client lists or shows a device, a live session or a piece of evidence that comes from a development source carries a visible "development source" label, on web, tablet and phone. Checked in the client runs, **2 + 1** each. Cites D73; `structured` §0.3.
  7. **Development-source mark in the evidence manifest.** Every track recorded from a development source — a local device or a fake source — is marked in the manifest; such a package **may be sealed and verifies PASS with the mark reported**; a package whose mark was edited after signing fails verification. The field, its type and values are fixed by row 124. Checked on the server at M7, **2 + 1**. Cites D73, D78 (2); `structured` rows 124, 141.
  8. **Recordings stay out of git.** Local-device recordings — the developer's own face and voice — are written only under git-ignored `/.data/` (`.gitignore:70`) and are never committed; `git status --porcelain` lists **0** media files after a development-mode session. *Proposed tightening of C-N3 for this case:* from a local-device session no still, no audio excerpt, no waveform or spectrogram, no transcript text and no playback screenshot enters `docs/`; no agent opens local-device media with a viewing tool (D86 C-7); the recordings are deleted only on the user's instruction (D87(5)) **Erratum PE-128-12 (D86 C-7; D87(5)).** Checked after each run. Cites D74 (3), OD-25.
  9. **The macOS permission prompt is the user's.** The camera and microphone permission is granted by the user answering the system prompt. No agent touches the permission database, the system settings or any tool that edits them. A row that finds the permission missing stops and hands the user a one-click command (DP-12). Checked by a search of the row's command log for permission-database tools (0 hits). Cites D74 (3).
  10. **Every function runs end to end in development mode.** A session started, switched between microphones, stopped, sealed and verified with this Mac's camera and microphone plus the two fake sources yields two playable camera files with the one audio track, inside the product AV bound of ± 40 ms (E.1), **2 + 1**. This result is evidence that the product functions run; it closes **no** class-C item (G.2 C-2, C-4): a laptop camera behind a helper is not the target camera. Cites D73; `structured` rows 140, 141.

### B.2.5 Traceability of the delta

| Requirement | Decisions | Constraints added | Class-C effect | Spec rows | Implementation rows |
|---|---|---|---|---|---|
| R-9 | D73, D74 (1), D75, D76, D78 (1) | C-N13, C-N15 | unauthenticated discovery leaves C-1 (G.2) | 120-128 | 129, 130 (conditional), 131, 132, 142, 137, 138 |
| R-10 | D73, D72(k), D72(h), D72(i), D75 | — | none | 120, 121, 125, 127 | 133, 139, 137, 138 |
| R-11 | D73, D74 (2), D74 (3), D78 (2), D72(l) | C-N14 | none (closes no class-C item) | 120, 123, 124, 126, 127 | 134, 135, 136, 140, 141, 137, 138 |

Source: the requirement trace table of `structured` (rows R-9..R-11, its lines 431-433) and rows 120-142.

### B.2.6 Open points for the later spec rows (each with the row that must answer it)

**Status after the spec gate (row 128):** items 1-13 and the ambiguities of B.2.7 are closed by rows 121-127, rulings D80-D89 and `gateway_check/27_r9_r11_spec_gate.md`. **Erratum PE-128-16 (D80-D89).**

| # | Open point | Owner |
|--:|---|---|
| 1 | The operations for search, candidate list, adoption and connection test (new or extended), their methods, request and response shapes, and the error codes — including the refusals of R-9 AC-5, AC-7, AC-10, AC-11 and the outcome names of AC-6 (is *unreachable* a fifth outcome?) | row 121 |
| 2 | **Whether operation 89 can hold a camera credential before the Core credential sealer of row 84 exists, and what the connect flow offers until then.** Facts: the sealer and its opener are owned by row 84 (M7; D68(c); R-8 "Credential store, interim"); the connect flow is built in M4 (row 142); the Core-server side of operation 89 is not built (B.2.0 "Rationale"). No second credential store may be invented (D76 (3)). Options seen by this row, **not decided here**: (a) operation 89 answers `503 NOT_READY` (`CREDENTIAL_STORE_NOT_READY`) like operation 91, and the connect flow is provable only up to the prompt until row 84; (b) the sealer part of row 84 is pulled forward ahead of row 142 (a blueprint change for the controller); (c) fixture credentials only on loopback until row 84 | row 121 (and the controller for (b)) |
| 3 | How operation 89, whose path names a capture device (`/capture/devices/{id}/credential`), addresses a candidate that R-9 AC-8 says is **not** registered — and how "nothing registered after a failed or abandoned flow" is kept true (pending state, one transaction, or clean-up) | rows 121 and 122 |
| 4 | Alert and audit names, severities and exact detail keys for R-9 AC-9 and R-10 AC-1..AC-3; new fault kinds versus reasons on existing kinds; how many audit rows an empty search writes (`structured` row 133 asks for "exactly one alert and one audit row" while row 132 already writes a "search performed" row) | row 121 |
| 5 | Schema impact: where the adapter kind and the development source are recorded, where candidates live (never as registered capture devices), the candidate matching key, whether a new fault kind touches the three fault-kind CHECK constraints — migration `0008` or the statement "no schema change" | row 122 |
| 6 | Adapter and helper design: the probe-only `discover()`, what is read beyond the `ProbeMatch` (B.2.7 item 1), the search window, which process owns the discovery socket (it cannot be the worker: `cap` §A.2 W-1 "the worker owns no datagram socket"), the `LOCAL_DEVICE` kind, the two helpers, port use inside 8554-8564 next to the fixtures, the helper error names, the development flag and its place in the row-61 definition, the ONVIF package (DP-13), and the split of hypothesis H-7 (discovery now testable here; NTP set and profile listing still class C) | row 123 |
| 7 | The manifest field for the development-source mark (name, type, values, per track), the verify rule (reported, not a failure; an edited mark fails), and whether the mark also covers every package made from fake fixtures | row 124 |
| 8 | UX: the search action, the candidate list, the credential prompt (write-only, never pre-filled, cleared from the form state after sending), the connection-test result, the three notifications, the empty state, the label; where "Search again" sits after a FAULTED session | row 125 |
| 9 | **Which clients may enter a camera credential** (R-9 AC-12: web required; tablet and phone proposed, against the web-only precedent of R-8) and what an operator without `CAPTURE_CONFIG` sees after the pre-check search | row 125 (security view: row 126) |
| 10 | Security review of: the C-N13 exception, the connection test as a non-SSRF / non-port-scan primitive (R-9 AC-10, including the "announced host = answering host" rule), no credential reuse, the rate limits and camera lock-out, searching while a session is open (R-9 AC-13), the development fence, the privacy of local-device recordings | row 126 |
| 11 | Named checks: every acceptance criterion of R-9 (16), R-10 (6) and R-11 (10) mapped to at least one check with method, depth and owning row; catalogue totals | row 127 |
| 12 | Licence and maintenance entry of the ONVIF dependency in C.1 / DOC-05 | row 123 (name and check), row 96 (entry) |
| 13 | Agreement of rows 120-127 with each other and with D73-D78 | row 128 |

### B.2.7 Where the user's answers leave a real ambiguity (for the controller; none decided silently)

| # | Ambiguity | What this row wrote meanwhile |
|--:|---|---|
| 1 | D75 (controller's reading) allows "probes and unauthenticated device information"; D76 (user) says a found device is listed and **not connected**. Reading a device's information beyond its `ProbeMatch` opens a TCP connection to the camera — is that still "list only"? | R-9 AC-2 relies on probe data only; anything beyond it is left to rows 123 / 126, with the rule that an unauthenticated read that is refused is never retried with a credential |
| 2 | The pre-check is started by an operator who may hold `SESSION_START` but not `CAPTURE_CONFIG`; the search inside it then runs for someone who may not search by hand | R-9 AC-12: that operator sees the outcome as a notification only |
| 3 | No user statement says on which clients a camera credential may be typed | R-9 AC-12: web required, tablet / phone proposed, open point 9 |
| 4 | "Search while a session is open" was not asked | R-9 AC-13: proposal with its reason |
| 5 | D73 speaks of "kamera / mic di network"; the search mechanism it asks for names cameras only, and microphones are local inputs here (OD-06) | R-10 AC-2: "Search again" for a microphone re-reads the local inputs; no network microphone discovery |
| 6 | D72(k) rules the session start (ingest-open window), not the pre-check: does one unreachable camera at pre-check block the start or only warn? | R-10 AC-2: proposed start rule mirroring D72(k) |
| 7 | "Production configuration" (R-11 AC-1 (b)) has no written definition | left to rows 61 / 123; R-11 AC-1 only forbids a second definition |
| 8 | Operation 89 before row 84, and a candidate that is not a device (open points 2, 3) | not decided |
| 9 | Whether the development-source mark also applies to every fake-fixture package (`structured` row 124 says "adapter kind `LOCAL_DEVICE` or fake") | R-11 AC-7 follows row 124's wording; open point 7 |
| 10 | A camera that does not answer multicast (another subnet, discovery switched off) cannot be found, and typed address entry is not offered | recorded as a gap; such a camera stays class C |

---

## C. Non-functional requirements

| # | Non-functional requirement | Constraint / value | Authority | How verified |
|---|---|---|---|---|
| C-N1 | **CPU-only STT on the production path; Mac-side engine uses the Apple GPU by design** | Shipped Core engine = portable whisper.cpp CPU (`-ng`, no GPU backends); dev/`omlx-server` engine = Apple-silicon MLX/Metal and is **not** shipped | `translated` C-TECH; coll4 F-10/F-11; D7(b)/(c); R-7 | `cpu-local` functional check on this Mac (rev-2.1 row): quoted command shows `-ng` on a GPU-off build, 2 + 1; `cpu-local` backend contract test; DOC-05 records MLX not shipped. **Erratum AU3-01:** row 12 did **not** meet this (it ran on the Apple GPU); gate `04` STT-5 recorded only the documented adaptation |
| C-N2 | Capture **outranks** STT for CPU | bounded STT threads; capture priority; `inter_threads * intra_threads` <= physical cores | `structured` §3.1; RK-1; coll4 F-136/F-137 | M6 "no dropped capture fragment while STT runs" check 2 + 1 |
| C-N3 | Media stays out of git and `docs/` | all media in git-ignored paths (`.cache/`, evidence store); `docs/` text evidence + small stills only; **~8 GB/h** at 2 x 9 Mbit/s | OD-25 (D4); RF-10; `translated` C-SAFE; register §C OD-25 | `git status --porcelain` media count = 0 (S1 §7) |
| C-N4 | Listener is loopback-only | SR-01; **RTSP ingest binds `127.0.0.1` only** (normative rule stays in `cap` §A.4 — referenced here, not moved; fixture listeners per `cap` §A.8): FFmpeg `-rtsp_flags listen -listen 1` defaults to `0.0.0.0`, so the ingest URL host literal MUST be `127.0.0.1` and the NM-14 fake-fixture readers likewise (ports 8554-8564, never a wildcard); LAN is class C (C-5); preconditions = replace demo password + B3 (W99-2/W99-3) | OD-13 (D4); register §A E-26; SEC35-23 (pin the RTSP ingest and the fake-fixture listeners to `127.0.0.1` with a static assertion) | Host listener snapshot identical before/after (`env` §1); OD-13 default; static assertion `M3-RTSP-BIND-1` (named in `cap` §A.4, carried by `02_plan.md` M3-W4 and the M3 gate; not yet in the `10_test_strategy.md` catalogue). **Cross-reference (PE-120-04; D75):** one bounded exception for the camera search is constraint C-N13; it opens no listener for clients |
| C-N5 | **No wall-clock test waits; `--maxWorkers=2` for ALL workspaces (jest and vitest)** | fake clocks only; P-01..P-16; B10 rows; vitest 5.0.3 honours `--maxWorkers` | `translated` C-TECH; D12(c); register §F W1-C7 (corrected); `explore` §2.6 | Real-time-wait grep = 0 per B10 file (rows 16-21); each workspace run states `--maxWorkers=2` |
| C-N6 | One lockfile writer; one Homebrew installer at a time | serialize lockfile (row 23 under `/usr/bin/lockf -k .locks/npm.lock`); Homebrew rows 10/13 | `structured` §10; D8; b2 §10; register §MemoryScreening | `git diff --stat package-lock.json` scope; one install at a time (`gst` §1 probe 11) |
| C-N7 | Test depth 2 runs + 1 verification for device/browser/spike checks; >= 10 loops and 1-2 h AV drift only pre-handover; no biometric steps | standing | D232/D233; D231; `translated` C-PROC | Run counts recorded per gate (rows 36, 38) |
| C-N8 | Security boundaries | per-fragment **AES-256-GCM** with **both** hashes (stored bytes + plaintext) OD-03; software **Ed25519** behind a `Signer` interface OD-04; camera credentials **write-only**; credential-shaped values in **both** log-blanking lists (web error sink + mobile `runtime/log.ts`, E-31/P-07) | OD-03, OD-04 (D4); register §A E-31; §C OD-03; RK-12 | Row 35 security design review (>= 7 surfaces, 0 Critical); M8 blanking check |
| C-N9 | Audit and RBAC | `CAPTURE_CONFIG` (SUPERVISOR + TECHNICIAN, idle only) OD-10; `TRANSCRIPT_REVISE` (INVESTIGATOR + SUPERVISOR) OD-15; E-30 audit rules: camera-credential refusals audited, `AUDIO_SOURCE_SWITCHED` carries sending device ID | OD-10, OD-15 (D4); register §A E-30; §C OD-10/OD-15 | Row 29 exact detail-key lists with 0 secret keys; M2 `rbac.matrix` boot test (D88 equality) |
| C-N10 | Dependency hygiene before capture dependencies | B2 targeted bump (`undici` >= 7.29.1); baseline **54 high (lock) / 51 (`--omit=dev`)**, not 99; braces + node-forge have **no published fix** (accepted-risk entries); class A (Core runtime) = 0 | b2 §1/§3/§6; register §F W1-C6; `structured` §8 B2 | Row 23 apply + row 24 review; `npm ls undici` >= 7.29.1 |
| C-N11 | Licence obligations for a distributed product | see C.1 | DOC-05; coll3 F-88..F-96; coll4 licence table; `stt-install` §4 | Row 33 licence list present; M9 DOC-05 |
| C-N12 | Client interaction rules | every gated control shows the **"Checking your permissions..."** state; web "waits for the link"; selection-glow + Reanimated rest-value patterns; in-place hand-offs; forward-only timers | `translated` C-TECH; register §A E-13/E-16; `structured` row 34 | M4/M5/M7/M8 e2e 2 + 1 each |
| C-N13 | **Discovery socket — the one exception to the loopback-only rule (PE-120-05)** | For a camera search the Core may open **one UDP socket** for ONVIF WS-Discovery, and **only for the duration of that search**. Bounds: (1) opened only by the two triggers of R-9 AC-1, never at boot or in the background; (2) one socket per search, closed when the search window ends (a contract constant) and on every error path — none exists before or after; (3) it sends the multicast probe and receives the answers to that probe, and carries nothing else; it accepts no client connection and serves no request; (4) it is **not** owned by the capture worker (`cap` §A.2 W-1: the worker owns no datagram socket); (5) the RTSP ingest, the fixtures and the R-11 helpers stay on `127.0.0.1` (C-N4 unchanged); (6) no authentication and no configuration request leaves on any socket as part of a search (R-9 AC-3); (7) the automated suite never opens it against the real network (R-9 AC-14). OD-13 is not reopened: no LAN listener for tablets or phones exists (C-5 stays class C) | D75 ("SEC35-23 exception: one UDP socket for the duration of a search"); D74 (1); D76 (1); SEC35-23; OD-13 (D4); `structured` rows 123, 126, 131 | Socket snapshot: one UDP socket during a search, none before or after (R-9 AC-15; `structured` row 131); request log with 0 authentication / configuration requests; findings SEC35-27..SEC35-30 (`sec` §11.2); checks `M4-DISC-SOCK-1`, `M4-SEC-NET-1`, `M4-DISC-LAN-1` **Erratum PE-128-14 (row 126 / row 127 as gated; D86, D89).** |
| C-N14 | **Development fence (PE-120-06)** | The development sources of R-11 exist only behind the development flag: the Core refuses to boot with a configuration that names one while the flag is off, and refuses the flag together with a production configuration; with the flag off no development source is listed or selectable. One definition of the flag, read through the capture-mode definition that row 61 fixes — no second definition. Every development source is labelled in the UI and marked in the evidence manifest. Local-device recordings live only under git-ignored `/.data/`. The macOS camera / microphone permission is granted by the user; no agent touches the permission database or the system settings | D73; D74 (2), (3); D78 (2); D72(l); OD-25 (D4) | R-11 AC-1, AC-2, AC-6..AC-9: two boot-refusal tests, 0 development sources with the flag off, `git status --porcelain` media count = 0, command-log search = 0 hits |
| C-N15 | **Credential-gated connectivity; agents on the real network (PE-120-07)** | No default, reused or guessed camera credential anywhere in the product or its tests; a connection attempt without an operator-entered credential is impossible by construction; the credential travels only in the request bodies of operations 95 and 96 (web console only) and is stored only through the operation-89 write path into the one Core credential store (no second store) **Erratum PE-128-13 (D81).** On the user's network an agent lists and probes only and never types, stores or receives a real camera credential. Identifying results of a real probe (IP, MAC, serial) only under git-ignored `.data/` / `.cache/`; committed documents quote counts and vendor or model class | D76 (2)-(4); D75; D68(c); C-N8; E-30 / E-31 | R-9 AC-7, AC-8, AC-16: 0 outbound requests without a credential; static rule (no credential literal, no default table); credential-pattern search over evidence files = 0 matches at each gate |

### C.1 Licence obligations (DOC-05)

| Component | Obligation | Authority |
|---|---|---|
| FFmpeg | LGPL base; **this host's build is GPL** (`--enable-gpl`, `--enable-libx264`, `--enable-libx265`); distributing it triggers the GPL and the project's LGPL compliance checklist | coll3 F-88, F-89, F-90, F-91 |
| GStreamer | Formula declares LGPL but is configured **`-Dgpl=enabled`** with x264/x265/ffmpeg deps; GStreamer requires LGPL plugin code and rejects GPL code inside plugin modules; **its install is deferred (D12(d))** so it is not a shipped dependency now | coll3 F-92, F-93, F-94; gst §7; D12(d) |
| whisper.cpp + ggml | MIT | coll4 F-19, F-20 |
| Whisper large-v3-turbo weights | MIT (redistributable; derivatives inherit MIT) | coll4 F-78, F-70/F-72 |
| Silero VAD | MIT (cite the LICENSE file, not the stale CC BY-NC badge) | coll4 F-90 |
| sherpa-onnx | Apache-2.0 code; model assets inherit upstream family terms (3D-Speaker/NeMo/WeSpeaker Apache-2.0); per-asset record required | coll4 F-101, F-106, LB-3 |
| pyannote | Code MIT; `speaker-diarization-3.1` and `segmentation-3.0` weights are **gated** (`gated: auto`; token + accepted terms — a human action); companion WeSpeaker embedding **CC-BY-4.0** attribution | coll4 F-107, F-110, LB-1, LB-2 |
| OmniVoice (TTS fixture) | Weights Apache-2.0, but the **HiggsAudio tokenizer is under an extended licence above 100k MAU**; internal-dev fixtures only, must **not** ship in the Core product | `stt-install` §4 licence note; D7 |
| espeak-ng | GPL-class tool used only to generate test audio; not linked into the product | coll4 licence table; `env` §7 |
| MediaMTX | MIT (only if Q-INSTALL item 4 is used) | coll3 F-96 |

---

## D. Decision register (all 29 answered gate items)

All items are answered with the recommended default approved verbatim as "A, semua default" (D4).
OD-20 and OD-24 also cite D7 (STT reuse re-scope). "Consequence (plain)" restates the gate table's
own plain-language column. Milestones/blocking per `structured` Gate Questions and §6.

| # | Answer (D4; D7 where noted) | Decision | Plain-language consequence | Milestone unlocked |
|---|---|---|---|---|
| OD-01 | T1: `AUDIO-01` = the one session audio track; `AUDIO-02` legacy v1 only; mic inputs `MIC-01`/`MIC-02` | D4 | "AUDIO-01" now means the session audio, not "MIC 1"; fewer ID changes | M2 (rows 29, 30) |
| OD-02 | L2: regenerate demo evidence as v2, drop v1 code paths; reseed `dems_demo` only; `release/` untouched | D4 | One code path; tamper demo re-scripted on one fragment | M2, M7, M8 (rows 30, 32) |
| OD-03 | (a) per-fragment AES-256-GCM; record both stored-bytes and plaintext hashes; confirmed at the M0 spec gate | D4 | Files are encrypted while recording; integrity checkable without the key; decrypted exports still match | M3, M7 (rows 30, 31, 32) |
| OD-04 | Software Ed25519 behind a `Signer` interface; TPM/PKCS#11 adapter class C | D4 | Real (non-simulated) signatures now; hardware key later without a format change | M7 (row 32) |
| OD-05 | Support both topologies (one dual-lens or two PoE); fakes emulate two cameras | D4 | Works with either hardware; real model comes with Q-HW | M2 schema, M4 (class C) |
| OD-06 | AAC-LC 48 kHz mono; transport behind `AudioInputAdapter`; USB as working assumption | D4 | Small, widely playable audio; transport fixed when mics are known | M3 (codec), M4 (class C) |
| OD-07 | `PoeController` interface with an SNMP adapter + a fake; real adapter class C | D4 | Power-cycle designed now, wired to hardware later | M4 (class C) |
| OD-08 | Seal the durable part flagged "interrupted" | D4 | Recorded evidence up to the crash is kept and signed, clearly marked | M7 (row 32) |
| OD-09 | (a) hot standby; toggle for the session holder with `SESSION_START` + SUPERVISOR; web-only recording stays "no"; C5 folded here | D4 | Near-gapless switch; only operator/supervisors switch; web still needs a paired tablet to record | M2, M5 (rows 29, 34) |
| OD-10 | new `CAPTURE_CONFIG` for SUPERVISOR + TECHNICIAN; idle only | D4 | Investigators cannot change devices; no change while recording | M2 (rows 29, 34) |
| OD-11 | below -50 dBFS for 10 s -> `MIC_SILENT`; disconnect debounce 2 s; contract constants | D4 | Operator is warned, never switched automatically; numbers tunable without code change | M5 (row 31) |
| OD-12 | no live preview of real cameras in this phase | D4 | Monitor keeps the demo loop; no extra CPU for decoding | M4 (row 34) |
| OD-13 | keep loopback (emulators); LAN is class C; preconditions E-26 | D4 | Tests use emulators; no network exposure | M4/M5/M8 physical e2e |
| OD-14 | P25 waiver limited to module registration, the `capture` seam, capture config keys, supervisor start/stop; each edit reviewed | D4 | The capture module can be wired in; nothing else in those files changes | M2, M3 (row 31) |
| OD-15 | `TRANSCRIPT_REVISE` for INVESTIGATOR + SUPERVISOR; Core key signs, author recorded; no approval flow | D4 | Officers can correct; the sealed machine transcript never changes | M7, M8 (rows 29, 33) |
| OD-16 | decrypted copy + manifest + signature; export audited; composite side-by-side on demand, marked derived (encoder after a licence check) | D4 | The receiver can verify the package without the Core's key | M8 |
| OD-17 | simulator emulates v2; `offline` OpenAPI scope 0.2.0 (all-scope 0.3.0); `release/` 0.1.0 untouched | D4 | Demo and tests work without hardware; one behaviour in both modes | M2 (row 29) |
| OD-18 | disable hardware-fault injection and scenario load in real mode; Simulated unchanged | D4 | A real recording cannot be disturbed by demo buttons | M2 |
| OD-19 | block reset while real sealed packages exist; capture config/devices/credentials become kept tables | D4 | A reset can never erase records of real evidence | M2 (row 30) |
| OD-20 | Indonesian only; allow diarization + VAD downloads after the row-4 licence check; licences into DOC-05 | D4, D7 | Speaker labels become possible; no project data leaves the machine | M1 (partly), M6 (row 33) |
| OD-21 | fMP4; fallback kept designed; legal confirmation before handover (no external authority found, F-102) | D4 | No merge pass at sealing; if legal says no, the fallback adds one pass | M1, M3 (rows 31, 32) |
| OD-22 | PoE-cycle only a lost-stream camera, confirmed + audited, gap marked | D4 | A dead camera can be revived mid-session; healthy ones cannot be cut | M2 contract, M4 (class C) |
| OD-23 | retire SC8 "simulator untouched"; Simulated regression against `c2c983b` at M2 and M9 | D4 | The shared simulator can be extended for v2; Simulated mode is still checked | M2 |
| OD-24 | whisper.cpp (Homebrew); conversion in an isolated venv under `.cache/`. **D7 amendment:** this Mac reuses the installed oMLX server (`omlx-server`) for development; portable `cpu-local` whisper.cpp for the x86 Linux Core is **not cancelled** (D7(b)) and is installed, converted and functionally proven **on this Mac** in M6 (erratum AU3-01). **Install route (AU2-02):** the approved text says Homebrew; a Homebrew `whisper.cpp` install would also upgrade `ca-certificates openssl@3 sdl3 sdl2-compat`, and `openssl@3` has `ffmpeg` and `omlx` as installed dependents (same risk class as D12(d)). The proposed route is a **source build under `.cache/` with GPU backends off and zero Homebrew change**; the route choice is put to the user at the second gate (Q-D7 reframed) — the approved value is kept until then | D4, **D7**, D17/D18 | One native CPU runtime for the Core; on this Mac the already-installed engines are reused for development, and the CPU path is proven here too | M1 (rows 10-12), M6 |
| OD-25 | (a) all media in git-ignored paths; `docs/` text evidence + small stills | D4 | `.git` does not grow by ~8 GB per recorded hour | M1, M3 (row 31) |
| OD-26 | (b) minimal targeted edits now; large refactors after M9 or a separate task | D4 | No large refactor inside a contract-breaking change; the three new static rules use today's scanner form | M2, M9 |
| Q-AUTO | yes: full autonomy inside approved scope with a decision log; stops only at approval gates, host installs per Q-INSTALL, hardware arrival, handover | D4 | Fast progress; no gate is skipped | All milestones (process) |
| Q-INSTALL | blanket for items 1-6 (whisper.cpp, conversion venv, GStreamer + gst-plugins-rs, MediaMTX, sherpa-onnx + diarization/VAD, ONVIF npm after B2); user-space only; uninstall logged | D4, D7 | Spikes and STT path start right after approval; everything is removable. (Item 3 install later deferred by D12(d).) | M1 (rows 10, 13), M3, M4, M6 |
| Q-HW | unknown: class C deferred; task completes at the "done on this Mac with fake devices" line | D4 | Work is not held up by hardware; real-device proof comes later | Class C (§9), M4 real, M9 benchmark |

**Second-gate items that touch this spec (not D4 answers; added by the RV-SPEC revision, D17-D20).**
Q-STT-CFG (R-8 defaults, D20) — **answered (a), all 13 defaults confirmed (D24; erratum PE-113-15)**; Q-D7 reframed with the CPU-runtime route (OD-24 text
above, AU3-02/AU2-02) — **answered (a), D24: oMLX for development plus the whisper.cpp CPU path proven on this Mac (erratum PE-R8-22)**; Q-WORKER (capture-worker build form, AU3-04) — **answered (a), D24: a small C program against libavfilter/libavformat of the installed FFmpeg, spawned and supervised by the Core (erratum PE-R8-22)**. Each
is owned by the blueprint revision (RV-BP); this spec records only the consequence.

**Superseded items (history only; never live requirements).** These appear **only** in this subsection
and are excluded from R-1..R-7, sections A-C and E-H (register §E; `translated` C-REQ notes;
blueprint §1.3).

| Superseded item | Superseded / withdrawn by |
|---|---|
| D223 "master multi-track remux" | D224, D225 (one whole file per camera) |
| D226 benchmark plan on this Mac | D230 (no benchmark on this Mac; benchmark on the Core device) |
| D219 "audio input feeds MIC 1/2" | D220, D221 (primary/standby) |
| Controller's AUDIO-MIX track; speaker attribution by channel | D220 (withdrawn) |
| MLX fp16 copy of the model | D229 (Apple GPU only; conflicts with D222 and an x86 Core) |

---

## E. Mechanism chapters (design intent; rows 31-34 write the deep detail)

### E.1 Capture and ingest

| Aspect | Design intent | Evidence / authority |
|---|---|---|
| Ingest lifecycle | One recording session = one RTSP-listen ingest process + one output file; the ingest exits 0 on client `TEARDOWN` and refuses re-push, so the supervisor **restarts the ingest per session** (restarting only the pusher is provably insufficient) | S1 §4.5 (G-1), SP-5; register §A (NM-03, NM-04) |
| Command shape (four pinned traps) | explicit finite `-listen_timeout 60`; RTSP URL **without trailing slash**; per-source `duration=` (not a bare `-t` before the first `-i`); `-flush_packets 1` | S1 §2 (SP-1); register §A W1-C1 |
| Fragment quantum | `frag_keyframe + min_frag_duration` so cuts are keyframe-aligned on the GOP grid; the **GOP becomes the fragment quantum**; contract constants pair fragment target, GOP and `min_frag_duration` (S1 used `-g 50 @ 25 fps` = 2.0 s). **Erratum AU2-08:** on the copy path the GOP is the camera's setting — DEMS sets it through ONVIF at session start and verifies the observed keyframe interval; crash-loss window (RPO) = one fragment = one camera GOP; RECOVERY validates the file tail explicitly (ffprobe is not a truncation detector) | S1 §6.4/§6.5 (SP-4); register §A W1-C1; `cap` §C.1/§C.5; AU-2 §1 |
| fMP4 options | use `frag_duration`, `frag_size`, `fragment_index`, `min_frag_duration`, `movflags {default_base_moof, empty_moov, isml, skip_trailer}`; **do not spec** `frag_type`/`default_prft`/`frag_start_number` (they do not exist in this build) | S1 §3; `env` §3; coll3 F-05/F-14/F-15; register §A W1-C1 |
| Copy path / auto-BSF note | `empty_moov` **does** disable automatic bitstream filtering, but the codec-copy path still works: SDP `sprop-parameter-sets` extradata + movenc internal AVCC conversion produced a fully decodable file; keep an **extradata presence check at ingest start** (a camera SDP without `sprop` would meet the disabled-BSF condition for the first time) | S1 §4.6 (G-2), SP-6 |
| Durability / fsync | `-flush_packets 1` is a userspace flush, **not fsync** (it does not survive OS/power loss); the writer needs an explicit per-fragment fsync policy (`F_FULLFSYNC`/`F_BARRIERFSYNC` after each fragment hash record), recorded as a row-31 decision; OS-level durability is a pre-handover (class-C) concern | S1 §8 (SP-2), §10 gap 2 |
| Running hash chain | per-fragment SHA-256 over **stored bytes** + digest chain + running prefix, all independently re-derivable with `dd`/`head`/`shasum`/`xxd`; the manifest stores byte ranges + declared sizes so crash detection is writer-independent; chain anchor `chain_0 = SHA-256("")` | S1 §3.1 (SP-7), §5.4/§5.5 |
| Whole-file hash semantics | prefer `movflags +skip_trailer` for the camera file (pure append-only bytes) or hash the `mfra` trailer as an end-of-stream record; row 31 chooses | S1 §3.1 (SP-3), §10 gap 5 |
| AV timeline | single timeline per file; relative AV flash-to-beep offset (never absolute stream start times — the copy path shifts both streams by one AAC priming frame, 21.333 ms, which cancels); **two tolerances (erratum AU2-04):** regression bound on the deterministic synthetic fixture \|measured − truth\| <= 2 ms with a sample-exact analyser, and the **product/class-C** bound +/- 40 ms (an asymmetric published bound is an open point for the documentation row); camera video clock vs host audio clock alignment is hypothesis H-10 (`cap` §J, AU2-06); Core NTP + camera offset in the manifest; long drift is pre-handover | `structured` §6 M1/M3; S4 §5 (S4-1), §0; AU-2 §3; register §G RK-3 |

### E.2 Audio

| Aspect | Design intent | Evidence / authority |
|---|---|---|
| One session track | `AUDIO-01` is the one session audio track carrying the active mic; `MIC-01`/`MIC-02` are inputs (`MicRole` PRIMARY/STANDBY); `AUDIO-02` is legacy v1 only | OD-01 (D4); register §C OD-01 |
| Manual switch mechanism | embedded libavfilter capture worker: two `abuffersrc`/device-fed inputs -> `astreamselect` (named instance) -> `aformat` (48 kHz mono) -> native `aac` -> mp4/fMP4; UI toggle -> worker IPC -> `avfilter_graph_send_command("asel","map","1")` | S2 §1, §3 run3, §6 finding 1; D10(c); register §A (NM-10) |
| Switch bound | realised content boundary within **one worker input quantum + IPC latency** of the command (S2 run3 measured +21.333 ms in a 1024-sample pull loop; AU-2's push-mode harness switched at the next 10 ms input chunk); the command runs on the filtering thread only; gaplessness = 0 inserted/0 dropped samples by sample count + per-input continuity (the packet-grid "0.000/0.001 ms" figure is not gap evidence); placement error vs the capture record <= 1.17 ms; the hard cut clicks audibly (crossfade or acceptance = open point OP-CLICK) — errata AU2-05/AU2-07 | S2 §0, §4, §5; AU-2 §2; `cap` §E |
| CLI limitation | the bare `ffmpeg` CLI **cannot** serve R-3: `asendcmd` is init-parsed media-time scheduling only (append-after-init ignored) and this build has no `zmq`; the API path is required | S2 §1 channels 3/4/5, §6 finding 2; register §A (D10c) |
| Intervals in manifest | store per-interval `from_ms`/`to_ms` in **media-pts domain**, derived capture-side (raw pre-encode per-frame manifest); do not reconstruct from operator wall clock (media-vs-wall offset drifts with startup latency) | S2 §6 finding 3; S2 §3 run3 (`run3_manifest.csv`) |
| Warning | below **-50 dBFS for 10 s** -> `MIC_SILENT`; disconnect debounce 2 s; warn, **never** auto-switch; values are contract constants (tunable without code change) | OD-11 (D4); register §C OD-11 |
| Level separation for tests | the fake fixture separates inputs by amplitude (a `sine` filter has no amplitude option on this build; use `volume=0.3`), and the analyser does an energy/spectral comparison — real mics need per-input reference windows | S2 §2, §7 L-1 |

### E.3 Transcript

| Aspect | Design intent | Evidence / authority |
|---|---|---|
| `TranscriberAdapter` | two backends behind one interface: `omlx-server` (this Mac; loopback HTTP `POST /v1/audio/transcriptions` on `127.0.0.1:8000`; models already on disk; MLX/Apple-silicon, **uses the Apple GPU by design and is not shipped**) and `cpu-local` (portable whisper.cpp, CPU-only; shipped on the x86 Linux Core and **also built GPU-off and proven on this Mac in M6** — nothing is coded yet, erratum AU3-01/AU3-02); plus a `TtsFixtureProvider` for test audio | D7(a)-(c); `stt-install` §2-§4; register §F W1-C12; D17/D18 |
| Server caveat | the oMLX server's `duration` JSON field is unreliable (0.0 / 2.49 s for 4.65 s audio on official engines); use ffprobe or segment timestamps | `stt-install` §3.3; D10(d); register §F W1-C12 |
| Incremental chunking | VAD-seeded chunks (Silero), checkpoint per chunk, resume after kill; long-form window 30 s; `-ot`/`-on` offsets plus a carry prompt for continuity | coll4 F-127/F-131/F-132/F-133; register §A (NM-06) |
| CPU priority | STT runs **below** capture priority; bounded threads (`-t`/`-p`); `inter_threads * intra_threads` <= physical cores (CT2 rule) | coll4 F-136/F-137; C-N2; register §G RK-1 |
| Diarization route | sherpa-onnx + Silero VAD (licence-clean; pyannote weights are **gated**); 2-speaker labels or the `LABELLED/UNAVAILABLE` flag | coll4 F-100..F-112, LB-1; D8; OD-20 |
| Functional check | non-empty JSON transcript with timestamps, >= 1 segment per sentence, on CPU (`cpu-local`; the oMLX run of row 12 is GPU-only and does not satisfy the CPU clause, AU3-01); **no RTF/WER** figure (D230); the synthetic two-voice Indonesian fixture is synthesised with the installed OmniVoice TTS (voice cloning; spell numbers/acronyms client-side) | D230; D7; `stt-install` §3.3/§3.4; register §A E-22; coll4 G-3 |
| Ops / licence | `omlx-server` is a shared host service: DEMS never binds port 8000, never restarts/upgrades oMLX (`brew upgrade omlx` reverts mlx-audio and breaks TTS), serialises STT/TTS calls; `cpu-local` uses whisper.cpp (MIT) | D7(d); `stt-install` §3.1/§4/§7; register §C Q-INSTALL |
| Revisions | corrections are signed revisions by the Core Ed25519 key with the author recorded, no approval flow; the sealed machine transcript is never overwritten | OD-15 (D4); register §C OD-15 |

### E.4 Evidence package and sealing v2

| Aspect | Design intent | Evidence / authority |
|---|---|---|
| Package layout | `VIDEO-01.mp4`, `VIDEO-02.mp4`, transcript, fragments JSON, `manifest.json` (`dems.evidence-manifest/2`), signature, certificate, audit extract | register §B NM-08; `structured` row 32 |
| Manifest v2 fields | per-file fragment chain (start/len/`moof.sequence_number` + both hashes), audio-source intervals, transcript hash, signer info, clock offsets, `interrupted` flag, `derived` marker for composite | register §B NM-04/NM-08; OD-03/OD-08/OD-16; S1 §3.1/§8 SP-7 |
| Signing | software Ed25519 behind a `Signer` interface; TPM/PKCS#11 adapter class C (C-8); the signature CHECK in `0001_tables.sql:336` is relaxed to accept non-`SIMULATED-SHA256` values | OD-04 (D4); register §C OD-04; `explore` §2.7; `structured` §C-TECH |
| Per-fragment encryption | AES-256-GCM **outside** the muxer (CENC in the muxer is AES-CTR only, no AEAD); record both the stored-bytes hash (integrity without the key) and the plaintext whole-file hash (decrypted exports) | OD-03 (D4); coll3 F-47/F-52; register §F W1-C2; register §C OD-03 |
| Interrupted seal | a crash during RECORDING seals the durable part flagged `interrupted`; the durable prefix re-hashes to the recorded prefix | OD-08 (D4); S1 §5.4; register §C OD-08 |
| RECOVERY resume | sealing is checkpointed per step; RECOVERY resumes to `SEALED`; progress forward-only from Core instants | OD-08; register §A E-13, §B NM-07/MB-06 |
| Tamper demo | tampering one fragment fails exactly that fragment (OD-02 L2 re-scripts EV-0005 on one fragment); the byte-range fragment hash + chain design makes this locatable without re-muxing | OD-02; `structured` §6 M7; S1 §8 SP-7 |
| Whole-file vs parts | fMP4 is a defined form of the same container (`moov` + repeated `moof`/`mdat`); C2PA's BMFF hash assertion is the published precedent for hashing a fragmented MP4 as one asset made of hashable parts; **no public authority for evidentiary "one whole file" was found** | coll3 F-97..F-101; coll3 F-102; register §F W1-C8 |

### E.5 Session lifecycle

| Aspect | Design intent | Evidence / authority |
|---|---|---|
| One active session | one active session per Core; a new session is blocked until `SEALED` (rooms may wait) | register §D R-6; `structured` §6 |
| Progress + ETA | per-step sealing progress with an estimate on all clients; forward-only, from Core instants (`coreClockOf`), never the client wall clock; ETA from `recording-elapsed.ts` (monotonic) | register §A E-13/E-14; `structured` §6 M7; D12(b) |
| Resumable | RECOVERY may end `SEALED` (resumed sealing); in-place hand-offs (`monitor-handoff.ts`, `summary-handoff.ts`) with `animation: 'none'` | OD-08; register §B MB-06, §A E-13 |
| Composite | composite video only on demand at export, marked `derived` and hashed in the export manifest | OD-16; register §B NM-12 |
| Reset fencing | reset blocked while real sealed packages exist (OD-19) | OD-19 (D4); register §C OD-19 |

### E.6 Clients (web, tablet, phone)

| Flow | Design intent | Evidence / authority |
|---|---|---|
| Device selector | selector on web (`WB-05`), tablet/phone (`MB-08`/`MB-09`); config locked while a session is open; new query factories `WB-11` | OD-10; register §B WB-05/MB-08/MB-09/WB-11 |
| Mic toggle | active/standby meters with a manual toggle (confirm/pending/RBAC-disabled); warning banner offers "switch to standby"; interval band at playback | OD-09/OD-11; register §B WB-01/MB-03/WB-10 |
| Sealing progress | v2 steps with progress/ETA + transcript step; resumed-sealing state; forward-only timers | OD-08; register §B MB-04/MB-06/WB-01 |
| Playback with audio-source band | one player per camera file with embedded audio; audio-source interval band; transcript pane; Range support | register §B WB-04/MB-07; `structured` §6 M8 |
| Selection / animation patterns | `components/composed/selection-glow.tsx` constant border; Reanimated rest-value in the Stepper; in-place hand-offs with `animation:'none'`; B9 FXR-DEV-2 warnings handled with MB-04 | register §A E-13/E-15; `structured` §8 B9 |
| Gated controls | every gated control shows the **"Checking your permissions..."** state; web "waits for the link" | `translated` C-TECH; register §A E-16; `structured` row 34 |
| Test hygiene | apply P-01..P-16; fake clocks only, no wall-clock waits; mobile jest `npm run test -w @dems/mobile -- <path> --maxWorkers=2`; **vitest also honours `--maxWorkers=2` (D12c)** — the earlier `--poolOptions.threads.maxThreads` substitution is wrong and is not to be used | `translated` C-TECH; D8/D10(f); D12(c); `explore` §2.6 |

---

## F. Success criteria per milestone (checkable)

Sources: `structured` §6 and §5; register §B for row IDs; class per `structured` §5.

| M | Success criterion (checkable) | Gate artifact that records it | Class |
|---|---|---|---|
| M0 | errata 31/31 applied, R-1..R-7 7/7 traced, all answered ODs applied, 5 superseded absent; 5/5 workspaces green at or above the ledger (71/1,851; 160/3,954; 124/1,751; 117/1,495; 192/1,988); then the second approval gate (MAJOR) | `gateway_check/05_m0_spec_gate.md` (row 39); `test/01_wave_a_regression.md` (row 27) | A + B |
| M1 | playable-while-growing; running hash = re-read hash; contiguous chain; truncation detected within <= 20 ms; AV relative offset within **+/- 40 ms** (S4 pass/fail confirmed; sample-exact values 0.00 ms aligned (+0.021 ms = one sample), 80.021 ms on the +80 ms injection, −80.052 ms on the −80 ms case — the earlier "-1.333 / 78.667 ms" were 10 ms-window artefacts, erratum AU2-03); one audio stream, mic switch confirmed live with 0 inserted/dropped samples by sample-level attribution (AU-2; the "0.001 ms" packet-grid figure is not gap evidence, erratum AU2-05); STT produces a transcript; **no RTF figure** | `gateway_check/04_m1_spike_gate.md` (row 38) | A + B |
| M2 | workspace suites green per workspace; OpenAPI drift test at 0.3.0 (offline constant 0.2.0); migrations 0004/0005 on a throw-away copy of `dems_demo` and fresh lanes; `rbac.matrix` boot passes; three FAULT_KIND CHECKs accept the new kinds (`:281`/`:382`/`:488`); signature CHECK relaxed; Simulated regression against `c2c983b` | row 39 checklist; `structured` §6 M2 | B |
| M3 | worker integration 2 + 1 (two fake RTSP + two fake mics -> two playable fMP4 files, hash equality, contiguous checkpoints); AV sync 2 + 1 incl. the two-clock case (H-10, AU2-06); each worker-crash check 2 + 1 incl. a long-GOP fake camera and RECOVERY tail validation (AU2-08); 0 media in git | M3 checkpoint | B |
| M4 | Mac: selector edit + audit row from web (agent-browser) and tablet/phone emulators on recreated lanes, 2 + 1 each; config locked while a session is open. Class C: discovery, NTP, profile, PoE cycle on target hardware. **Cross-reference (PE-120-08; D75, D76):** with `AP3` the unauthenticated camera search, the connect flow on fixtures, the no-device notifications and the development sources join the Mac part of M4 (section B.2; `structured` rows 131-138, 142, gate 70); what stays class C is in G.2 | M4 checkpoint; class-C C-1..C-5 | B (fake) / C (real) |
| M5 | switch from web/tablet/phone during recording, 2 + 1 each; 0 inserted/dropped samples (sample count + continuity) and boundary within one input quantum + IPC latency (AU2-05/AU2-07); interval rows + `AUDIO_SOURCE_SWITCHED` audit with sending device ID; silence warning raised, never auto-switch; "Checking your permissions..." state present | M5 checkpoint | B |
| M6 | `cpu-local` installed (source build, GPU off) and model converted under `.cache/`; transcript produced on **CPU** (`-ng` quoted) and on `omlx-server`, sealed, verified, labelled when possible on the synthetic Indonesian sample (2 + 1); no dropped capture fragment while `cpu-local` STT runs (one 2 + 1 check); chunk resume after a kill (AU3-01) | M6 checkpoint | B |
| M7 | kill matrix (each recording phase x each sealing step) as distinct checks, each 2 + 1, final hashes equal an uninterrupted run; v2 verify PASS on server, web, mobile; tampering one fragment fails exactly that fragment; progress forward-only from Core instants | M7 checkpoint | B |
| M8 | playback on web, tablet, phone (emulators) 2 + 1 each with Range support; export verifies at the destination; composite marked derived and hashed; any signed-URL prefix in both log-blanking lists | M8 checkpoint | B |
| **—** | **DONE ON THIS MAC WITH FAKE DEVICES: M0-M8 gates passed on fakes + M9 Mac part** | — | — |
| M9 | Mac: all workspaces green; final chain verdicts recorded (verifier -> security-review -> test-expert -> senior-code-reviewer); docs updated. Class C: benchmark report on the Core device; device e2e 2 + 1; long campaigns only pre-handover | M9 checkpoint; `structured` §6 M9 | A + B (Mac) / C |

---

## G. Hardware-independent completion line + class-C entry criteria

### G.1 Completion line (restated from `structured` §5)

1. M0-M3 and M5-M8 gates pass against fake RTSP sources, fake audio inputs and a fake ONVIF stub (NM-14), plus the simulated capture driver.
2. M4 passes for the selector (API, DB, audit, three clients on emulators) and for the fake adapters.
3. M9 passes the full regression, docs and the final verification chain.

**Cross-reference (PE-120-03; D78).** See A.2: with `AP3` the line includes rows 120-142 as defined once in `structured` §5.

### G.2 Class-C entry pack (so hardware can activate later without re-planning)

| # | Item | Entry criteria |
|---|---|---|
| C-1 | **Authenticated** ONVIF actions on the target camera: profile listing with an account, NTP set, GOP set (PE-120-09; D75, D76). *Moved out of class C:* the unauthenticated part — the WS-Discovery probe and reading what the responders announce — is scheduled work (R-9; `structured` rows 131, 132). Before this delta the item read "ONVIF discovery, NTP set, profile listing against the target camera" | Camera model known (Q-HW), on the Mac's LAN; OD-05 answered; **the user names the camera and types its credential in the product UI** (D76) |
| C-2 | Real `CameraAdapter` RTSP/TCP pull into the worker (PE-120-09: an RTSP session to a real camera is a connectivity action — only with the operator-entered credential, D76; the development sources of R-11 do not close this item) | C-1 passed; M3 gate passed |
| C-3 | Real `PoeController` | Switch model + control path known (OD-07); OD-22 answered |
| C-4 | Real `AudioInputAdapter` | Mic model + transport known (OD-06) |
| C-5 | Physical tablets/phones on the LAN | OD-13 = LAN; demo password replaced; B3 applied (W99-2/W99-3); TLS/origin rules specified |
| C-6 | Live preview of real cameras | OD-12 not "none" |
| C-7 | NM-13 STT benchmark on the real Core device | Core device available (Q-HW); RTF, peak RAM, WER on a hand-checked sample, labelling accuracy, model size picked |
| C-8 | TPM/PKCS#11 signer adapter | OD-04 hardware option chosen; device with TPM; signature verifies with the device certificate chain |
| C-9 | Long AV-drift run (1-2 h) and repeated kill loops | User announces handover (D233) |

Source: `structured` §9.

**Moved class-C boundary (PE-120-09; D75, D76; `structured` §9 "Rev 2.3, only with AP3").** The line now runs between *asking who is there* and *logging in*. On this Mac, scheduled: the multicast probe, the candidate list, and the whole connect flow proven on loopback fixtures with fixture credentials. Class C until the user supplies a real camera's account: every request that authenticates against a real camera or changes it (profile listing with an account, NTP set, GOP set, PoE cycle, RTSP pull). Hypothesis H-7 (`cap` §J) splits the same way; row 123 records the split.

---

## H. Backlog and deferrals

### H.1 Backlog placement (`structured` §8)

| ID | Item | Class | Milestone | Rows / route |
|---|---|---|---|---|
| B2 | Dependency refresh (54 high lock / 51 `--omit=dev`; `undici` >= 7.29.1) before any capture dependency | A | M0 | 5, 23, 24, 27 |
| B3 | W99-2 pairing bucket, W99-3 socket cap | B | precondition of OD-13 = LAN | row 40 |
| B4 | `DEVICE_CREDENTIAL_REQUIRED` refusal writes no audit row; camera credential refusals audited | A | M0 spec (row 29), M2 code | 29, row 40 |
| B5 | DR-1 `live-sim.ts` split | B | per OD-26 (default: after M9 or separate task; minimal edit at `live-sim.ts:902-905` in M2) | row 40 |
| B6 | W91-10 splits; W91-17 runbook for `scripts/pg/server.mjs` | A (runbook) / B (splits, OD-26) | M9 | row 40 |
| B7 | HBX-13 static scanners -> lint rules | B | per OD-26 | row 40 |
| B8 | W93-10/-18/-19/-26/-27 minor mobile items; B15 empty frame Login -> Home | A | M9 hygiene | row 40 |
| B9 | FXR-DEV-2 Reanimated warnings at the Finalizing hand-over | B | M7 with MB-04 | row 40 |
| B10 | Wall-clock-independent tests (4 files), RC-8, `chrome-lost-updates` (row 16 closed as "no change required"; rows 17/18/20 converted, D10(e)/D12(b)/D12(c)) | A | M0 | 16-21, 25, 27 |
| B11 | RF2-2 exact wait point of the late stop on the tablet | A | M3 window, before M5/M7 tablet gates | row 40 |
| B12 | RC-1 (fix, done row 22); RC-2..RC-7 nits | A | RC-1 in M0; nits in M9 | 22, 26; row 40 |
| B13 | Packaged CSP `localhost` | A | only if a release build is made | row 40 |
| B14 | QR scanning on device | — | out of scope (DR-02), carried | — |
| B15 | Tablet Home mic tiles "No signal"; phone-sent commands without device ID in audit | B | mic tiles with MB-01 (M5); device ID via E-30 (row 29, M2) | 29, row 40 |
| B16 | Errata owed to the database contract (C2-R3, F-4, F-6, F-7, hour-change path) | A | M0 | 30 |
| B17 / C5 | Web-only Live demo cannot record without a paired tablet | B | folded into OD-09 | Gate Questions |
| A1-A3, A6 | Release-build revoke-to-Pair, timer lag, tablet late stop, long campaigns | C-like (session) | M9 pre-handover, only if the user announces handover | row 40 |
| A4 | RC-1 device check | A (code) / pre-handover (device) | code M0 (row 22); device check pre-handover | 22 |
| A5 / C7 | Biometric device test | — | stays skipped (D231) unless the user asks | — |
| C1-C4, C6, C8 | Shim, AVDs, host PostgreSQL, `.DS_Store`, host clean-up | — | not in scope; task-2 defaults stand | — |
| C9 (iii) | STT install needs approval | B | Q-INSTALL | Gate Questions |

### H.2 OD-26 deferred refactors

OD-26 = default (b): **minimal targeted edits now**; the `live-sim.ts` split (DR-1), the HBX-13
static-scanner-to-lint conversion (B7) and the W91-10 splits (B6) happen **after M9 or in a separate
task** (D4 OD-26; register §C OD-26). The one M2 exception is the minimal edit at
`live-sim.ts:902-905` required by SH-25 (register §A E-02; §B SH-25). The three new static rules for
the `capture/` folders use today's scanner form, not the deferred lint form (`structured` §8;
register §C OD-26).

### H.3 GStreamer deferral (rows 13/14) and re-evaluation trigger

Row 13 (GStreamer install) was **DEFERRED by the controller** (D12(d), option C of the agent's ASK):
`brew install --dry-run gstreamer` showed 1 formula + **62 new dependencies + 11 upgrades of
already-installed shared toolchain libraries** whose installed dependents include **omlx** (the
D7-protected STT/TTS stack; a reinstall destroys the hand-applied mlx-audio 0.5.3 patch), **ffmpeg
9.0.2** (the S1/S2/S4 evidence base), **openjdk@17** (mobile builds), the kilo runtime, python@3.11,
ripgrep, rust, sqlite and llvm@22 (gst §3-§4). Q-INSTALL item 3 approved a user-space install, not an
implicit upgrade of another project's toolchain mid-wave, and the uninstall path cannot revert those
11 upgrades (gst §8). Nothing was installed (66 formulae before and after; listeners identical,
gst §0/§10).

| Consequence | Detail | Authority |
|---|---|---|
| Row 14 | deferred with row 13 (SKIPPED-by-deferral record) | D12(d); gst §12 |
| Row 15 | runs as the RF-1 desk memo with GStreamer scored "not evaluated on host"; the M1 gate (row 38) proceeds on rows 7/8/9/12/15 | D12(d); `structured` row 15 |
| R-3 status | unaffected: the operator-triggered mic switch is proven on FFmpeg's libavfilter API, so GStreamer is a comparison prototype, **not** an R-3 dependency | D10(c); S2 §6 |
| Evidence kept | `initialization/03_gstreamer_install.md` (272 lines) is the evidence base for any re-run, incl. the caveat that an approved install must verify `gst-inspect-1.0 isofmp4mux` first (meson `isobmff=auto` can skip the plugin silently) | gst §6, §12 |
| **Re-evaluation trigger** | If the user later approves the 11 shared-library upgrades, rows 13 -> 14 re-run and row 15 is refreshed **before** row 38. It must run only in a maintenance window with no sibling work in flight and with the omlx libexec patch state recorded first | D12(d); gst §12, §13 |
| Surfaced to the user | this install decision is surfaced at the next gate | D12(d) |

---

## I. Self-gate (this document's own acceptance)

| Gate check | Result |
|---|---|
| R-1..R-7 each have >= 1 measurable acceptance criterion | **7/7** — R-1 (3), R-2 (3), R-3 (4), R-4 (5), R-5 (5), R-6 (4), R-7 (3) |
| Every answered gate item cited by decision ID | **29/29** — OD-01..OD-26 (26) + Q-AUTO + Q-INSTALL + Q-HW, each with `D4` in section D (OD-20/OD-24 also `D7`) |
| The five superseded items appear only as superseded | **5/5** — section D "Superseded" subsection only; excluded from A-C and E-H (register §E) |
| R-9..R-11 (delta of row 120, PE-120-10) each have numbered measurable acceptance criteria citing D72-D78 | **3/3** — R-9 (16), R-10 (6), R-11 (10); 5W1H frame of the delta in B.2.0; open points B.2.6 (13); ambiguities B.2.7 (10) |
| 5W1H frame present | **yes** — section 0 (subject/stakeholders/what/when/where/why/how + alternatives/assumptions/gaps); CLAUDE §8 tier 1 |
| Every factual claim cited | **yes** — `file:line`, decision ID, or research/spike/init artifact reference on every table row and finding |

---

*Generated: 2026-10-07 09:24*
*Last Updated: 2026-10-09 14:20 (row-128 spec-gate fix pass PE-128-01..16 (D89, D91; `gateway_check/27_r9_r11_spec_gate.md`); blueprint row 120, PE-120-00..PE-120-10: requirements delta R-9..R-11, C-N13..C-N15, class-C boundary; D73-D78); 2026-10-09 (status sweep PE-R8-22: Q-D7 and Q-WORKER answered by D24); 2026-10-09 (pair-review errata PE-113-15/PE-113-16: R-8 confirmed by D24; credential-store owner row 84, D68; `masterplan/11_audit_errata.md` §5)*
