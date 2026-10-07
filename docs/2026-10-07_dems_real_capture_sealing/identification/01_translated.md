---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: request-translator
model_tier: default
status: translated
---

# Translated Tasks: DEMS — real capture devices, sealing v2 and transcript (next phase)

## Intent

The user wants a **mature, decision-ready work framework** for DEMS task 3 (the "next phase"). In that phase the demo Core stops simulating capture. It records real cameras and microphones through a capture worker behind the API, seals one whole file per camera with a running hash, and puts a local CPU transcript inside the signed package.

"Mature" (*matang*) means the framework is complete enough that the user can approve it in **one** sitting and work can then start without re-planning. Concretely:

- every requirement the user has already decided is traced into it
- every still-open decision is put to the user at once, with options, a recommended default and what it blocks
- work is sorted by what can start now, what waits for a decision and what waits for hardware
- each milestone has a verification gate that already includes the corrections from the drift check

**Why the user wants this:** they have already made the product decisions (D219-D233) in conversation. They want those turned into a plan they can approve once. Work that needs no new decision or hardware (spikes, backlog) should then start in parallel. This matches their usual pattern: short directives, quick approvals, speed of delivery (`user-profile-dems` memory).

**Scale category:** Enhancement, major and contract-breaking: API 75 -> about 88 operations, OpenAPI 0.3.0, DB schema v2 / `dbc-3`, manifest v1 -> v2, new workspaces. It includes Research in the form of technical spikes. **This delegation cycle covers planning only**, from identification up to the BLUEPRINT_APPROVAL gate.

## Goals

1. **G1 — Requirement traceability.** Every decided requirement R-1..R-7 traces to at least one blueprint row and milestone (impact map §1.2, refined by D229-D233). Superseded decisions are marked superseded, not carried as live requirements (see Constraints C-REQ).
2. **G2 — One consolidated decision package.** The gate presents OD-01..OD-26, each with:
   - current status (answered / partly answered / open)
   - options and a recommended default
   - the milestone it blocks
   - whether the default lets work proceed

   Two further questions join the package: Q-AUTO (autonomy mode for this task) and Q-INSTALL (host installs). The user can approve with "all defaults" or override item by item.
3. **G3 — Three-class work split.** Every row is classified:
   - **A**: can start right after approval with no new decision and no hardware
   - **B**: unblocked by a named OD
   - **C**: needs hardware or the real Core device

   A **hardware-independent completion line** states what "done" means on this Mac with fake devices. Class-C items get a documented hand-over point.
4. **G4 — Milestones with real gates.** M0-M9 (impact map §8.1) are restated with:
   - the drift-check errata E-01..E-31 applied
   - M1 = spikes + CPU STT runtime install with approval, no benchmark (D230)
   - M6 = functional transcript check
   - the benchmark and NM-13 moved to the real Core device
   - 2 + 1 test depth; lanes recreated before any lane-based gate
   - every gate stated as a checkable criterion
5. **G5 — Backlog placement.** Every carried backlog item has a placement (milestone, wave, or "pre-handover only"): B2-B17 and A1-A6 (conditional on handover) from task 2's `report/01_report_inputs.md` §4, plus the task-2 user decisions that interact with this scope (C5 web-only recording vs mic-switch permissions; C9 iii STT install approval).
6. **G6 — Parallel start plan.** The approved framework allows class-A work (spikes, M0 specs, backlog hygiene) to run in parallel waves within the 8-agent ceiling, with file-collision isolation.
7. **G7 — Risk register.** Impact map §9 and the drift check §5 "top risks that changed" are carried with mitigations tied to milestones.

## Primary Task

Produce the next phase's structured blueprint (`identification/02_structured.md`, owned by task-architect) and present it, together with the consolidated OD-01..OD-26 decision package, at the BLUEPRINT_APPROVAL gate. The blueprint covers M0-M9, classifies all work as A/B/C, and applies the drift-check errata. No research execution, no code, no installs and no spikes before approval.

## Scope

### This cycle (identification -> approval gate)

- **Files written by the pipeline:** `identification/01_original.md`, `identification/01_translated.md` (this agent); `identification/02_structured.md` (task-architect); controller trackers (`README.md`, `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`).
- **Read-only inputs:** see Source Documents.
- **No repository source file changes** in this cycle.

### The phase the framework plans (for task-architect's scoping)

- **Workspaces touched:** `packages/shared` (domain, sim, api, live source, i18n, demo assets), `apps/core-server` (engine host, modules, db schema/migrations/seed/reset, realtime, boot checks), `apps/core-web`, `apps/mobile`, `README.md`, `THIRD_PARTY_NOTICES.md`. Row-level detail: impact map §3 (SH-01..SH-24, CS-01..CS-24, WB-01..WB-10, MB-01..MB-13, DOC-01..DOC-06) plus drift-check additions SH-25, CS-25, WB-11.
- **New modules / workspaces (proposed):** NM-01..NM-14, e.g.:
  - `apps/capture-worker/`, `apps/transcriber/`, `packages/capture-protocol`
  - `apps/core-server/src/capture/`, `modules/capture-config/`, `modules/evidence-media/`
  - `packages/shared/src/evidence-package/`
- **Systems/Domains:**
  - capture: RTSP/TCP ingest, ONVIF discovery/NTP, PoE control, audio inputs
  - storage and integrity: fragmented MP4 writer with running SHA-256 and fragment chain; encryption at rest; manifest v2 and signer
  - transcript: VAD + CPU STT (Whisper large-v3-turbo via whisper.cpp or CTranslate2) + 2-speaker diarization
  - session lifecycle: resumable sealing pipeline v2 via RECOVERY
  - platform: PostgreSQL migration 0004/0005 (9 new, 5 changed tables, three FAULT_KIND CHECKs per E-01); RBAC (new `CAPTURE_CONFIG`, possibly `TRANSCRIPT_REVISE`); realtime slices 28 -> 30
  - clients: web/tablet/phone UI for the selector, mic toggle, sealing progress, playback and transcript
- **Read-only / out of scope:** `apps/mock-core`, `release/` (0.1.0 offline edition); the confidential design-book `.docx`; production deployment (OS image, installer, TLS PKI) beyond the dependencies it creates.

## Constraints

### C-PROC — process (explicit)

- Full orchestration protocol. **No research execution, spikes, installs or implementation before BLUEPRINT_APPROVAL** (this task's D1; CLAUDE.md §2, §4).
- All B/C decisions go to the user **at once** at the blueprint gate (controller's proposal, accepted by the user's request).
- Test depth **2 runs + 1 verification** per device/browser check; repeated loops (>= 10) only on request or at handover (D232, D233, standing). Crash/kill matrices are distinct checks, each 2 + 1, not loops (drift check §3.2).
- Biometric device test out of scope (D231).
- Parallelism ceiling 8 agents (CLAUDE.md §6; memory `feedback-parallelism-push-to-limit`); parallel agents never share an output file.
- Git: local commits only, no remote, no push (task 2 D1, carried in this task's D1).
- Reports to the user in Indonesian; `/docs` in English; no emoji in deliverables.
- Use ready-made frameworks and libraries before hand-building (memory `feedback-ready-made-frameworks`). This applies to the capture stack too (GStreamer/FFmpeg, whisper.cpp/CTranslate2, sherpa-onnx, an ONVIF client library), and any hand-built component is recorded as a decision.

### C-REQ — product requirements (explicit, from user decisions)

| ID | Requirement | Source | Supersession notes |
|---|---|---|---|
| R-1 | Device-selector config in the Core (which camera feeds VIDEO-01/VIDEO-02; which mic is primary and which standby), editable from web, tablet and phone under RBAC and audit | D219 (1), D220, D221 | D219's "audio input feeds MIC 1/2" is superseded by primary/standby (D220, D221) |
| R-2 | Real capture/processing worker behind the API, as a supervised separate process; the Core controls it over IPC; adapter layer under the existing device contract | D219 (2) | — |
| R-3 | One active mic per session; the second is a failover; **manual** toggle in the UI. Each switch is audited and written as source intervals in the manifest. The Core warns but never auto-switches | D220, D221 | Hot standby and "who may switch" are controller defaults pending confirmation (OD-09) |
| R-4 | One **whole** file per camera (2 files), each holding that camera's video + the single session audio track on one timeline, no re-encode. Append-only fragmented MP4 with a running SHA-256; per-fragment checkpoints in the manifest | D224, D225 | D223's "master multi-track remux" is **withdrawn** by D224. Fallback "segments + lossless concat at sealing" applies only if fMP4 is not accepted (OD-21) |
| R-5 | Machine transcript inside the sealed package. STT on CPU + RAM only, computed incrementally during recording. Two speakers labelled when possible; otherwise sealed unlabelled with the flag "speaker labels unavailable". Corrections only as signed revisions | D222, D223, D226 | D222's fallback question is resolved by D223 (sealing waits for the transcript, no addendum) |
| R-6 | One active session per Core; a new session is blocked until SEALED (rooms may wait). Per-step sealing progress with an estimate on all clients. Checkpointed and resumable through RECOVERY. Composite video only on demand at export | D219 (3), D223 | — |
| R-7 | Hardware baseline at least equal to this PC (Apple M5 4P+6E, 24 GiB), CPU-only. **No benchmark on this PC**; working STT first with Whisper large-v3-turbo (HF copy at `~/.omlx/models/whisper-large-v3-turbo`) through a CPU runtime, model size configurable. Benchmark (RTF, RAM, WER, labelling) later on the real Core device | D226, D229, D230 | D226's benchmark plan is **superseded** by D230. The MLX copy is excluded (Apple GPU only; conflicts with D222 and an x86 Core) |

### C-TECH — technical and process constraints (from code, cited in history)

- The real pipeline plugs in **under** the shared simulator hosted by the Core (`apps/core-server/src/engine/host.ts`), through a capture-driver seam and INTERNAL actions (precedent `setTabletLink`, `engine/types.ts:205-209`). Source: impact map §0, A-1.
- **P25 freeze** on `apps/core-server/src/app.ts`, `config.ts`, `src/index.ts` needs an explicit waiver (OD-14).
- 21 static guard tests forbid `node:fs`/`child_process` in the host modules. New modules need their own static rules, and new `capture/` tests follow the test-support import rule (drift check P-09).
- The SC8 "simulator untouched / additions only" rule and the `acaff20` diff gate from task 2 block SH-05..SH-08. They must be retired or re-baselined at `c2c983b` (OD-23).
- Pinned counts (75 operations, 28 slices, schema v1 / `dbc-2`) change in single contract rows.
- `evidence_items_signature_check` (`0001_tables.sql:336`) accepts only `SIMULATED-SHA256`, which blocks real signatures.
- Three FAULT_KIND CHECKs must change in migration 0004 (`:281`, `:382`, `:488`, E-01).
- Capture devices must not reuse `AdminResource.DEVICES`, which is the paired-client registry event (E-04).
- Listener is loopback-only (SR-01). Physical tablets/phones cannot reach the Core until OD-13, which has preconditions: replace the demo password, harden W99-2/W99-3.
- Only the `dems_demo` database exists. Lanes must be recreated (`db:create/migrate/seed`) and devices re-paired per lane before any lane-based gate (D240, E-24).
- Reuse the established patterns:
  - mobile: `runtime/recording-elapsed.ts` + `core-clock.ts` (progress forward-only, from Core instants); in-place hand-offs (`monitor-handoff.ts`, `summary-handoff.ts`); `selection-glow.tsx`
  - shared: contract constants imported from `@dems/shared/api` + `contract-values.test.ts`
  - web: `lib/core-queries.ts` factories; `lib/download.ts`; `lib/device-command-gate.ts`
  - all gated controls: the "Checking your permissions..." rule
  - tests: fake clocks only, no new wall-clock waits (drift check P-01..P-16)
- New credential-shaped values (signed media URL, export token) must be added to the web error sink and the mobile `runtime/log.ts` blanking lists (P-07, E-31).

### C-SAFE — safety and red lines (explicit and implicit)

- **Host installs need the user's explicit approval:** CPU STT runtime, model conversion, GStreamer, an RTSP test server such as MediaMTX, Python packages (D230; task 2 report C9 iii).
- No model download is needed for the first STT candidate (D229).
- Never send project data, the design book, credentials or recordings to external services, including web-search queries; generic queries only (CLAUDE.md §4; memory `reference-dems-environment-gotchas`).
- Real recordings and large media stay out of git and `docs/` until OD-25 is decided (`.git` is already 1.5 GB; about 8 GB/h at 2 x 9 Mbit/s).
- Emulator security: the test PIN is the user's; agents never set or type it and hand the user a one-click command instead (memory `feedback-no-device-security-changes`). Never kill or reboot emulators from a snapshot.
- Never delete or rename files the user did not ask about. Frame dumps are ignored, not deleted (D227 precedent).
- Do not touch the SMART WMS project's ports and processes on this Mac (`[::1]:5173`, `127.0.0.1:5174`, `[::1]:5175`).

## Assumptions Made

| # | Assumption | Justification | Effect if wrong |
|---|---|---|---|
| AS-1 | "bukatkan" = "bulatkan"/"buatkan"; both mean "produce/finalise the framework" | Both readings converge on the same action; the controller read it the same way (D1) | None material |
| AS-2 | This task folder covers the **whole next phase** (M0-M9). This cycle stops at BLUEPRINT_APPROVAL. Research (explore/data-collector/data-analyst) and `masterplan/01_specs.md` / `02_plan.md` follow after approval | Folder title "real capture devices, sealing v2 and transcript"; protocol order in CLAUDE.md §2 | If the user wanted only an M0 document, scope shrinks to G1-G2 |
| AS-3 | The framework is built from the existing impact map + drift check; task-architect does not repeat their codebase analysis before the gate | Both are gated (D228, D260) and the drift check verified 471 references against HEAD `c2c983b` with 0 gone | If HEAD moved after `85c0fb5`, a quick drift re-check is a research-phase row |
| AS-4 | Class-C milestones (M4 real adapters, device e2e on physical devices, Core-device benchmark) cannot finish on this Mac. The framework defines a hardware-independent completion line (fake RTSP/ONVIF/audio fixtures, NM-14) and treats class-C items as deferred with entry criteria | No physical camera, PoE switch or microphone is available (impact map G-3) | If hardware arrives, class-C rows activate without re-planning |
| AS-5 | The full-autonomy mode of task 1 does **not** carry over automatically. The gate asks once whether it applies (Q-AUTO) | Memory `feedback-autonomy-with-decision-log`: "do not assume it for a new task — ask once" | — |
| AS-6 | Output format is Markdown under `/docs` | No format keyword in the request; standing practice | — |
| AS-7 | The architecture "shared simulator as the Core's state machine" is kept (impact map A-1) | No decision says otherwise | If changed, impact map §3.2/§4 change shape; would be a MAJOR blueprint change |
| AS-8 | Controller defaults recorded in D221 (hot standby; switch allowed to session holders with `SESSION_START` + SUPERVISOR; warning not auto-switch) are **proposals**, put to the user as OD-09/OD-11 defaults | D221 text: "to be confirmed in that task's blueprint" | — |

## Source Documents

| Path | Type | Purpose | References |
|---|---|---|---|
| `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/research/10_next_phase_impact_map.md` | md (Tier-1 analysis) | Primary planning input | §1.2 R-1..R-7; §2 F-01..F-32; §3 impact rows; §4 NM-01..NM-14; §5 contract; §6 DB; §7 tests; §8.1 M0-M9; §8.2 OD-01..OD-21; §9 risks |
| `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/research/11_next_phase_drift_check.md` | md (drift check) | Corrections to the map | §2 P-01..P-16; §2.2 size/risk changes, new rows SH-25/CS-25/WB-11; §3.1-3.4 milestone/test changes, OD-22..OD-26; §4 environment; §6 errata E-01..E-31 |
| `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/decisions/decisions.md` | md (decision log) | Verbatim user decisions | D219-D233, D260 (lines 225-239, 266); DR-14, DR-15 |
| `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/report/01_report_inputs.md` | md | Backlog and pending user decisions | §4: 3(a) A1-A6, 3(b) B1-B17, 3(c) C1-C9 |
| `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/report/report.md` | md | Final state of task 2 | §1 SC results; §2 test ledger; §3-§5 open items, host state |
| `/Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/decisions/decisions.md` | md | This task's decisions | D1 |

## Output Requirements

- **Format**: `md` (no format keyword in the request; default per STEP 4a)
- **Destination**: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/` — next artifact `identification/02_structured.md` (task-architect); after approval `research/`, `masterplan/01_specs.md`, `masterplan/02_plan.md`
- **Style**: English, tables over prose, every factual claim cited (`file:line`, decision ID or command); Tier-1 5W1H for specs and plan (CLAUDE.md §8); no emoji. User-facing gate summary in Indonesian (controller)
- Output Format Question: **skipped**. The task is enhancement/planning, not a research-report deliverable, so a DOCX question does not apply

## Success Criteria (for this cycle)

1. `identification/02_structured.md` exists, is non-empty, and contains:
   - a requirement trace R-1..R-7 -> rows/milestones (G1)
   - an A/B/C classification of every row with the hardware-independent completion line (G3)
   - M0-M9 with checkable gates including errata E-01..E-31 (G4)
   - placement of B2-B17 and A1-A6 (G5)
   - parallel waves within 8 agents with no shared output file (G6)
   - a risk register (G7)
2. A single decision package lists OD-01..OD-26 + Q-AUTO + Q-INSTALL, each with status, options, recommended default and the milestone it blocks (G2).
3. Pre-HIL validation V1-V7 passes on the blueprint table (master-controller step 4a).
4. The controller stops at BLUEPRINT_APPROVAL with an Indonesian summary. Nothing is executed before the user answers.

## External Research Scope

The raw request contains no research keywords. The scope context passed by the controller does trigger:

- **Technology Evaluation** (Dim 2): FFmpeg vs GStreamer for ingest/mux (`isofmp4mux`); whisper.cpp (ggml) vs CTranslate2 int8 for CPU STT (OD-24); sherpa-onnx vs pyannote for 2-speaker diarization; ONVIF client options; RTSP test server for fixtures (MediaMTX vs gst-rtsp-server); signer options (TPM ECDSA P-256 / software Ed25519 / PKCS#11, OD-04); encryption scheme (per-fragment sidecar vs CENC vs volume, OD-03).
- **Regulatory & Compliance** (Dim 5): evidential acceptance of fragmented MP4 as "one whole file" (OD-21); chain-of-custody content of manifest v2; licences of FFmpeg/GStreamer build flags (LGPL/GPL), whisper.cpp/sherpa-onnx, and Whisper/diarization model weights (DOC-05).

Rule for any external lookup: generic queries only. Nothing from the repository, the design book or recordings leaves the machine (CLAUDE.md §4).

## History Relevance Assessment

| Reference | Relevance | Notes |
|---|---|---|
| `2026-10-04_dems_backend_rbac_pairing/research/10_next_phase_impact_map.md` | **Direct** | Written as pre-planning for exactly this task (D228). File-level impact rows, new modules, contract/DB deltas, M0-M9, OD-01..OD-21 |
| `2026-10-04_dems_backend_rbac_pairing/research/11_next_phase_drift_check.md` | **Direct** | Verifies the map against HEAD `c2c983b` (D260); 31 errata, OD-22..OD-26, environment drift; must be applied together with the map |
| `2026-10-04_dems_backend_rbac_pairing/decisions/decisions.md` D219-D233, D260 | **Direct** | Verbatim user decisions that define R-1..R-7, test depth and STT approach |
| `2026-10-04_dems_backend_rbac_pairing/report/01_report_inputs.md` §4 | **Direct** | Backlog B2-B17 / A1-A6 and pending user decisions C1-C9 to merge into this task |
| `2026-10-04_dems_backend_rbac_pairing/report/report.md` | **Direct** | Final state and test ledger baseline (shared 71/1,851; core-server unit 160/3,954, db 124/1,751; core-web 117/1,495; mobile 192/1,988); commits `0a9e317`, `c2c983b` |
| `2026-09-30_dems_demo_stack_setup/` (task 1) | **Indirect** | Origin of the shared simulator, demo media/evidence (14 packages, Ed25519 DEMO signatures, tamper demo EV-0005), release 0.1.0 (read-only), host toolchain (ffmpeg, espeak-ng, Maestro). Informs OD-02 (demo evidence) and keeps `release/` untouched; no decision of it governs this scope directly |
| This task's `decisions/decisions.md` D1 | **Direct** | Interpretation of the request and inherited standing rules |

### Important Notes From History

- **Superseded decisions must not be revived:** D223 multitrack master (withdrawn by D224); D226 benchmark plan (superseded by D230); D219's "MIC 1/2" mapping (superseded by primary/standby, D220/D221); the controller's AUDIO-MIX and channel-based speaker attribution (withdrawn in D220).
- Partly answered: OD-20 (model on disk, Indonesian; runtime install and licences still open). OD-13 gained preconditions (demo password replacement, W99-2/W99-3).
- Blocking ODs named by D228: OD-01, -02, -05, -09/-10, -13, -14, -17, -19, -21. D260 adds OD-22..OD-26.
- Backlog placement already suggested by the drift check §3.3:
  - B2 dependency refresh **in M0, before new capture dependencies**
  - B3 before OD-13
  - B4 with the audit design
  - B5/B7 ordering via OD-26
  - B10 as an M2 test-hygiene row
  - B11 before the M5/M7 tablet gates
  - B12 RC-1 with MB-04/MB-01
  - B16 with DOC-03 (`dbc-3`)
  - B17/C5 interacts with R-3
  - A1-A6 in M9 only if the task leads to handover
- Repository baseline for diffs: HEAD `c2c983b` (docs commit `85c0fb5` after it); `acaff20` is task 1's baseline and the old SC8 gate.
- Environment on 2026-10-07:
  - running: PostgreSQL on `127.0.0.1:4432` (`dems_demo` only); three emulators booted and paired to the main instance (DEV-0003/0004/0005)
  - not running: Core, Vite, Metro
  - tools: no GStreamer, whisper.cpp, CTranslate2, torch or Maestro on PATH; FFmpeg 9.0.2 present (drift check §4)

### Lessons from History

- Tablet timing gates should use a release build and a quiet host. The tablet learns state late under load (2.3-21.2 s, RF2-2), so use the session diagnostics (P-12).
- The Reanimated lost-update family concentrates in Finalizing/Stepper (MB-04 risk raised to High). Use the Stepper rest-value and `selection-glow` patterns.
- Root `npm test` with three idle emulators flakes on wall-clock tests. Per-workspace runs with limited workers are the reliable evidence (D256; memory gotchas).
- Pairing hand-off recordings start only after redeem returns, and web codes are blurred before capture (D258).
- Keep large evidence (frame dumps) ignored, not deleted. Real media needs a policy before the first recording (OD-25).
- Document progress before compaction. Long multi-wave tasks were resumed from `status_tasks.md` + `delegation_progress_report.md` (task 2 practice).

## Dependencies

- User answers at BLUEPRINT_APPROVAL (OD package, Q-AUTO, Q-INSTALL) before any class-B row starts.
- User approval before any host install (CPU STT runtime + model conversion; GStreamer or an RTSP test server if chosen).
- Hardware (target cameras, PoE switch, microphones, real Core device) for class-C rows. Unknown availability date.
- Lane re-creation and per-lane pairing before lane-based e2e gates.
- Gated inputs D228 (impact map) and D260 (drift check). If HEAD moved after `85c0fb5`, a short drift re-check comes first in research.

## Notes

**For task-architect (content routed here because this agent may not write other artifacts):**

1. **Proposed decision-package questions beyond OD-01..OD-26:**
   - **Q-AUTO**: does task 1's full-autonomy-with-decision-log mode apply to this task?
   - **Q-INSTALL**: blanket or per-item approval for host installs (STT runtime, converter, GStreamer/MediaMTX, Python packages)?
   - **Q-HW**: expected availability and models of the cameras, PoE switch, mics and Core device. This feeds OD-05/06/07 and the class-C schedule.
2. **Answered ODs** go into the package as "answered" (with source) so the user sees closure, not only open items (e.g. OD-20 partly answered by D229/D230).
3. **Class-A candidates** named by the controller and the drift check:
   - M0 specs and contract design
   - spike S1: fMP4 + running hash + crash truncation from a fake RTSP source via host FFmpeg
   - spike S2: mic switch on one audio timeline with fake audio
   - spike S3: FFmpeg vs GStreamer pick (GStreamer requires an install, so S3 may be B/Q-INSTALL)
   - backlog: B2 (dependency refresh, before new dependencies), B10, B12 RC-1, B16

   Whether each is truly decision-free should be checked against OD-23 (simulator rule) and OD-25 (media in git: spike outputs go to a git-ignored scratch path).
4. **Prior controller statement.** The task-2 report C9 (iii) and D230 already told the user that the STT install needs approval, so the gate should ask, not assume.
5. **Gate presentation.** At the gate, the user-facing summary is in Indonesian, and each OD carries a one-line plain-language consequence of the default. The user approves quickly when defaults are clear (user profile).

---
*Generated: 2026-10-07*
*Last Updated: 2026-10-07*
