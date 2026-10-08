---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: data-analyst-local
type: mixed (errata-applied impact register, gate-answer mapping, requirement trace)
confidence: HIGH for the register and errata mapping (mechanical over two gated inputs plus wave-W1 facts); MEDIUM for class/milestone ownership and blueprint-row placement (analyst judgement, reconciled against blueprint §6)
source_translated_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/01_translated.md
source_structured_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/02_structured.md
last_updated: 2026-10-07
---

# Analysis Report — errata-applied impact register (blueprint row 6, M0)

## Source Tasks
- Structured: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/02_structured.md` (row 6; §4.1; §7 Requirement Trace; Gate Questions)
- Translated: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/01_translated.md` (G1-G7, R-1..R-7, C-PROC/C-REQ/C-TECH/C-SAFE)
- Original: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/01_original.md`
- Decisions: `decisions/decisions.md` D1-D9 (D4 = approved gate answers; D7 = STT reuse re-scope; D8 = wave-W1 corrections; D9 = tiering)

## Exploration & Collection Summary
- Row 1 re-verification: `research/01_explore.md` — 10/10 facts PASS; no repository delta after `85c0fb5`; three citation corrections (offline OpenAPI still `0.1.0`; `:335` hashes CHECK vs `:336` signature CHECK; 21 src guards beside a 13-file scanner suite in `test/static/`).
- Row 2 host readiness: `initialization/01_env_check.md` — FFmpeg 9.0.2 capability text captured; `frag_type`/`default_prft`/`frag_start_number` confirmed absent; CENC AES-CTR only, no AEAD.
- Row 3 media-stack collection: `research/02_collection.md` — 102 items; F-05/F-14/F-15, F-47/F-52, F-102.
- Row 4 STT stack collection: `research/04_collection_stt.md` — 105 items; whisper-cli flags, Homebrew `whisper.cpp`, pyannote gating (LB-1), sherpa-onnx + Silero VAD route.
- Row 5 B2 triage: `research/05_b2_dependency_triage.md` — 54 high (lock graph) / 51 (`--omit=dev`), not 99; braces and node-forge have no published fix.
- Gated inputs (read together): map `docs/2026-10-04_dems_backend_rbac_pairing/research/10_next_phase_impact_map.md` (D228) and drift check `.../research/11_next_phase_drift_check.md` (D260, errata E-01..E-31 §6).

## Overview

This register consolidates the gated impact map with all 31 drift-check errata and the wave-W1 fact corrections into the single artifact that blueprint rows 28-37 (specs) and the row-39 M0 gate are checked against. Every impact row ID appears exactly once (SH-01..SH-25, CS-01..CS-25, WB-01..WB-11, MB-01..MB-13, DOC-01..DOC-06, NM-01..NM-14 = 94 entries); the three drift-check additions (SH-25, CS-25, WB-11) are folded in as new-in-this-phase rows. All 29 answered gate items (OD-01..OD-26 + Q-AUTO + Q-INSTALL + Q-HW) are mapped to the register rows and blueprint rows they change, each citing D4 (answers) or D7 (STT reuse). R-1..R-7 are each traced to register rows, blueprint rows and milestones. The five superseded predecessor items are carried as history only and never as live requirements.

Row 6 does not create an implementation plan. `masterplan/02_plan.md` is written by row 37 (blueprint row 37, M0) and the M2-M9 implementation rows are produced by row 40 (rev 2); this artifact only supplies the register those later rows consume, so no `masterplan/02_plan.md` contribution is made here.

## Requirements

Functional (R-1..R-7, source `01_translated.md` C-REQ; decisions D219-D233):
- R-1 Device-selector config in the Core, editable from web/tablet/phone under RBAC + audit.
- R-2 Real capture worker behind the API, supervised, IPC, adapters under the device contract.
- R-3 One active mic, manual audited toggle, intervals in the manifest, warn never auto-switch.
- R-4 One whole fMP4 file per camera with the single audio track, running SHA-256, fragment checkpoints.
- R-5 Transcript inside the seal; CPU + RAM STT; incremental; labels when possible; signed revisions.
- R-6 One session per Core; blocked until SEALED; per-step progress + ETA; resumable via RECOVERY.
- R-7 Hardware >= this Mac, CPU-only; no benchmark here; working STT first; benchmark on the Core device.

Non-functional: loopback-only listener (SR-01) until OD-13; CPU priority capture > STT (RK-1); about 8 GB/h media kept out of git (OD-25); single lockfile writer; one Homebrew installer at a time; 2 + 1 test depth (D232/D233).

---

## A. Errata Ledger (E-01..E-31)

All 31 drift-check errata, each with before/after, affected map row IDs and the blueprint row(s) that now carry it. Sources: drift check §6 (D260), row 1 `research/01_explore.md`, and wave-W1 artifacts as named.

| # | Map said (before) | Drift check / new evidence (after) | Affected map row IDs | Blueprint row(s) |
|---|---|---|---|---|
| E-01 | F-14/§5.8/§6: new fault kinds need the `alerts_kind_check` (`:382`) and `session_history_outcome_check` (`:281`) updated | Also `health_snapshots_cause_check` at `0001_tables.sql:488` (column `:474`); migration 0004 updates **three** CHECKs | CS-16, CS-17, SH-03 | 30 |
| E-02 | SH-21/SH-17: meters shape change lives in `api/realtime-messages.ts` and `state-slices.ts` | Also `packages/shared/src/live/source/live-sim.ts:902-905` (`onMeters` commits `meters.audio` as `AudioSlice`); new row **SH-25** (S/Medium); coordinate with DR-1 (OD-26) | SH-17, SH-21, SH-25 | 29, 31; rev 2 (40) |
| E-03 | Process blockers = P25 freeze, 21 static guards, SR-01 loopback | Add task-2 SC8 "sim additions only" rule + `acaff20` diff gate (AC-B-59..62, DR-14); must be retired/re-baselined to `c2c983b` (OD-23) | SH-05, SH-06, SH-07, SH-08, CS-16, CS-19 | 30, 40 |
| E-04 | §5.5: config travels in new `captureConfig` slice | `AdminResource.DEVICES` (`realtime-messages.ts:156`) is the **paired-client registry event**; capture devices must use their own slice/kind, never this one | CS-15, NM-09, SH-16 | 29, 31 |
| E-05 | F-27: `index.ts:16` | It is `apps/core-server/src/index.ts:16`, not `packages/shared/src/index.ts` | CS-03 | 31 |
| E-06 | F-32/§7.1: shared 70/1,848; core-server 155/3,926; db 124/1,751; core-web 111/1,436; mobile 170/1,894; 630 test files | shared 71/1,851; core-server unit 160/3,954; db 124/1,751; core-web 117/1,495; mobile 192/1,988; 664 test files | test-ledger rows | 27, 36 |
| E-07 | SH-20: `examples.ts:267` | `:268` (health-example comment grew) | SH-20 | 29 |
| E-08 | WB-02: `devices-panel.tsx:23-42`, `:260` | `:24-43`, `:258`; panel now uses `lib/device-command-gate.ts` | WB-02 | 34 |
| E-09 | MB-03: `session-live-screen.tsx:231-256`; `use-monitor.ts:148`, `:227` | `:236-261`; `use-monitor.ts:165`, `:244`; timer path reads `runtime/recording-elapsed.ts` | MB-03 | 34 |
| E-10 | CS-14: `audit-details.ts:1-133` | `:1-140`; value sets imported from `@dems/shared/api` | CS-14 | 29, 35 |
| E-11 | WB-04: `integrity-tab.tsx:52-286` | `:52-295`; keep per-run pinned verdict (W92-10); export via `lib/download.ts`; media query gated on `useCoreSignedIn` | WB-04 | 32, 34 |
| E-12 | F-18/CS-06: device command map restated in `operations.ts:5-33` | `DEVICE_COMMAND_OF_OPERATION` derived from the contract (`operations.ts:42-52`); a new device command (PoE cycle, AV test) is a contract-table entry | CS-06, NM-01 | 29, 31 |
| E-13 | MB-04/MB-05/MB-06: v2 steps/progress added | Use in-place hand-offs (`monitor-handoff.ts`, `summary-handoff.ts`) + `animation: 'none'` (`navigation/stacks.tsx:59`, `summary/[sessionId]`); progress forward-only from Core instants (`coreClockOf`); MB-04 risk -> High; screen 441 -> 464 lines | MB-04, MB-05, MB-06 | 32, 34 |
| E-14 | MB-01: mic tiles/elapsed | Fold in B15 (tablet Home mic tiles "No signal" while recording) and RC-1 (`recording-elapsed.ts:129`); risk Low -> Low-Medium | MB-01 | 22, 34 |
| E-15 | MB-08/MB-09/MB-12: new list rows | Use `components/composed/selection-glow.tsx` with a constant border | MB-08, MB-09, MB-12 | 34 |
| E-16 | MB-03/MB-08/MB-09, WB-01/WB-05: gated controls | Follow "Checking your permissions..." (W93-11, DEC-FXR-M-3) and the web "waits for the link" rule | MB-03, MB-08, MB-09, WB-01, WB-05 | 34 |
| E-17 | §3.3: no new web row | New row **WB-11**: query factories in `apps/core-web/src/lib/core-queries.ts` (capture config/devices, transcript, export job), S/Low | WB-11 | 34 |
| E-18 | §3.2: no new core-server row | New row **CS-25**: capture constants in `@dems/shared/api`; extend `modules/__tests__/contract-values.test.ts`, S/Low | CS-25 | 29 |
| E-19 | CS-17: migration "applied on 4 live databases (4420-4423)" | Only `dems_demo` exists; lanes are recreated fresh and receive 0004/0005 via `db:migrate`; risk High -> Medium | CS-17 | 30, 40 |
| E-20 | §5.9 OD-02 L2 risk: "DB reseed on all four databases"; live lane sessions lost | One database (`dems_demo`); lanes no longer exist | CS-19, CS-20, SH-24 | 30, 32 |
| E-21 | G-1: "no model was downloaded" | Whisper large-v3-turbo is on disk (`~/.omlx/models/whisper-large-v3-turbo`, HF format, 1.5 GB; MLX copy excluded) (D229) | NM-06, NM-13 | 33 |
| E-22 | R-7/§8.1 M1/M6/M9/NM-13/§7.3: STT benchmark harness in M1/M6 | Per D230: no benchmark on this Mac; M1 = spikes + CPU STT runtime install with approval; M6 = functional check (+ "no dropped fragment while STT runs"); benchmark and NM-13 on the real Core device | NM-06, NM-13 | 33, 36, 40 |
| E-23 | §7.3/§9: long AV-drift run 1-2 h; loops | 2 + 1 per check (D232/D233); the 1-2 h AV-drift run and repeated kill loops only at handover or on request; no biometric steps (D231) | NM-07, NM-14, test rows | 36 |
| E-24 | §7.3 contract/DB + device e2e: "lanes 4420-4423 as today" | Lane re-creation (`db:create`/`db:migrate`/`db:seed` per lane), per-lane pairing, recordings only after redeem returns (D258) | CS-17, NM-14, device rows | 40 |
| E-25 | §8.2 OD-20 open | Partly answered by D229/D230; D7 adds reuse of the installed oMLX engine on this Mac (`omlx-server`) with `cpu-local` deferred | NM-06, DOC-05 | 33, 40 |
| E-26 | §8.2 OD-13 open | Add preconditions: replace the published demo password; W99-2/W99-3 hardening before any exposure (D248) | CS-02, DOC-02 | 34, 40 |
| E-27 | §8.2: OD-01..OD-21 | Add OD-22..OD-26 (PoE-cycle during RECORDING; retire/re-baseline SC8; CPU STT runtime approval; media-in-git policy; deferred-refactor order) | CS-06, SH-21, SH-25, NM-04, NM-06, CS-17 | Gate (D4), 40 |
| E-28 | §8.1 M0: specs + OD resolution only | Add backlog rows: B2 dependency refresh (before new deps), B10 wall-clock tests, B11 RF2-2 wait point, B16 database-contract errata | test rows, CS-16 | 5, 16-21, 23, 30, 40 |
| E-29 | §8.1 M9: benchmark + regression + docs | If the task leads to handover, M9 also hosts A1-A6 (release-build revoke-to-Pair, release timer lag, biometric if wanted, long campaigns) (D250) | class-C rows | 40 |
| E-30 | §5.4 audit types | Credential refusals of **camera credentials** write an audit row (W99-4 lesson); `AUDIO_SOURCE_SWITCHED` carries the sending device ID (B15) | SH-03, CS-14, NM-10 | 29 |
| E-31 | §9 mobile streaming: expo-video headers | If the signed-URL fallback is chosen, add its prefix to the web error sink and mobile `runtime/log.ts` blanking (P-07) | NM-11, WB-04, MB-07 | 34, 35 |

**Errata ledger count: 31/31 mapped, 0 dropped.**

## Key Findings

### Finding 1 — The register family is complete at 94 rows and the map is a valid starting input [Confidence: HIGH]
- Description: The map defines SH-01..SH-24, CS-01..CS-24, WB-01..WB-10, MB-01..MB-13, DOC-01..DOC-06, NM-01..NM-14; the drift check adds SH-25 (E-02), CS-25 (E-18), WB-11 (E-17). Row 1 re-verified the tree at `2a4f4ea` with no delta.
- Evidence: map §3.1-§3.5, §4.2; drift check §2.2, §6 E-02/E-17/E-18; row 1 §0 "no delta to fold in".
- Implication: The register below is the single consolidated list the specs and the M0 gate will be checked against.

### Finding 2 — Wave-W1 facts change four design assumptions that the specs must honour [Confidence: HIGH]
- Description: FFmpeg's mp4 muxer has no `frag_type`/`default_prft`/`frag_start_number`; CENC is AES-CTR only (no AEAD); `whisper-cli` has no `-otype`; the B2 baseline is 54/51 not 99.
- Evidence: `initialization/01_env_check.md` §3; `research/02_collection.md` F-05/F-14/F-15, F-47/F-52; `research/04_collection_stt.md` F-12; `research/05_b2_dependency_triage.md` §1, §3.
- Implication: NM-04, NM-05, NM-06, NM-13, DOC-05 and rows 7/10-12/23/27/31/32/33 carry the corrections (section F).

### Finding 3 — The M2 contract breadth is bounded by the errata, not the map's original counts [Confidence: HIGH]
- Description: three FAULT_KIND CHECKs (not two), only `dems_demo` exists (no lanes), `AdminResource.DEVICES` is taken, and the test-file count is 664 (not 630).
- Evidence: drift check E-01, E-04, E-19, E-06; `0001_tables.sql:281/:382/:488`; `realtime-messages.ts:156`.
- Implication: rows 29/30/36 and the pinned-count lists in the test strategy must use the errata values.

### Finding 4 — D7 re-scopes the Mac-side STT work and adds a `TranscriberAdapter` seam [Confidence: HIGH]
- Description: rows 10-12 reuse the installed oMLX engines; the portable x86 Linux `cpu-local` runtime stays a later wave; row 33 must define `omlx-server` and `cpu-local` backends plus a `TtsFixtureProvider`.
- Evidence: D7 (a)-(e); `initialization/01_env_check.md` §11.
- Implication: NM-06 and row 33 change shape; the change touches the OD-24 default and is flagged for confirmation at the second blueprint gate (row 40).

### Finding 5 — The five superseded items are absent from the live register [Confidence: HIGH]
- Description: D223 multitrack master, D226 benchmark plan, D219 MIC1/2 mapping, AUDIO-MIX/channel attribution and MLX fp16 copy are superseded and appear only in section E.
- Evidence: `01_translated.md` C-REQ notes; blueprint §1.3; D218/D220/D229/D230 references.
- Implication: The M0 gate's "superseded decisions absent" check passes against this register.

---

## B. Consolidated Impact Register

Every row ID appears exactly once. Columns: **ID** | current description (errata applied) | target workspace/file | class | owning milestone | blueprint row that implements it (rows 1-40, else "rev 2 (row 40)") | status. Class and milestone reconcile to blueprint §6 (milestone table) and §5 (work classes).

**Family counts: SH 25/25, CS 25/25, WB 11/11, MB 13/13, DOC 6/6, NM 14/14 (total 94).**

### B.1 packages/shared — SH-01..SH-25

| ID | Current description (errata applied) | Target workspace/file | Class | Milestone | Blueprint row | Status |
|---|---|---|---|---|---|---|
| SH-01 | Track model per OD-01 T1 (`AUDIO-01` = one session audio track; `AUDIO-02` legacy v1 only; `MIC-01`/`MIC-02` inputs, `MicRole` PRIMARY/STANDBY); FinalizationStep v2 (`CLOSE_TRACKS`..`STORE_SEALED_PACKAGE`) | packages/shared/src/domain/enums.ts | B | M2 | 29, 30; rev 2 (40) | carried |
| SH-02 | Add entities `EvidenceFile`, `AudioSourceInterval`, `FragmentCheckpoint`, `Transcript`, `TranscriptRevision`, `CaptureConfig`, `CaptureDevice` | packages/shared/src/domain/entities.ts | B | M2 | 29, 30; rev 2 (40) | carried |
| SH-03 | Vocabulary: `CAPTURE_CONFIG`, `TRANSCRIPT_REVISE`; precheck `MIC_PRIMARY`/`MIC_STANDBY`; `AUDIO_SWITCH`; `MIC_SILENT`, `CAPTURE_FAULT`; new audit types incl. E-30 (credential-refusal audit; `AUDIO_SOURCE_SWITCHED` carries sending device ID) | packages/shared/src/sim/vocabulary.ts | B | M2 | 29; rev 2 (40) | carried |
| SH-04 | RBAC table: grant `CAPTURE_CONFIG` to SUPERVISOR + TECHNICIAN and `TRANSCRIPT_REVISE`; keep D88 equality (OD-10, OD-15) | packages/shared/src/sim/auth.ts | B | M2 | 29; rev 2 (40) | carried |
| SH-05 | Sim types: `capture` option; step `progress`/`etaMs`/`detail`/`attempt`; session `captureConfig` snapshot + `audioSource` + `transcript`; MicStatus role; EvidenceItem v2; hosted/INTERNAL actions. OD-23 SC8 rule must be retired/re-baselined (E-03) | packages/shared/src/sim/types.ts | B | M2 | 29, 31; rev 2 (40) | carried |
| SH-06 | Session machine: snapshot config at start, open/close intervals; `external` mode advances on INTERNAL progress; `seal` builds a v2 item; RECOVERY resumes sealing (OD-08); `switchAudioSourceTransition` | packages/shared/src/sim/session-machine.ts | B | M2 | 31, 32; rev 2 (40) | carried |
| SH-07 | Evidence integrity: simulated v2 (2 files, fragment chain, transcript hash); v1 path kept/removed per OD-02 L2; tamper target = file/fragment (OD-21) | packages/shared/src/sim/evidence.ts | B | M2 | 32; rev 2 (40) | carried |
| SH-08 | Sim devices/audio/faults/derive/selectors/health/maintenance/scenarios/initial-state re-keyed by mic input; PRIMARY/STANDBY; simulated switch + silence warning; TEST_SIGNAL AV flash+beep; v2 scenarios (E-03) | packages/shared/src/sim/* | B | M2 | 31; rev 2 (40) | carried |
| SH-09 | Dataset: service list (worker, transcription health); v2 or legacy items per OD-02 | packages/shared/src/sim/dataset.ts | B | M2 | 30; rev 2 (40) | carried |
| SH-10 | Constants/store: `SIM_SNAPSHOT_VERSION` 1 -> 2; simulated-driver step timing constants | packages/shared/src/sim/constants.ts | B | M2 | 30; rev 2 (40) | carried |
| SH-11 | Demo alignment + demo-data verifier: v2 checks (per-file hash, chain head, transcript hash, intervals); v1 only under OD-02 L1 | packages/shared/src/sim/demo-alignment.ts, src/demo-data/verify.ts | B | M2 | 32; rev 2 (40) | carried |
| SH-12 | API area 6 devices: capture config/devices operations; inventory adds capture devices; `resetMicClip` keyed by mic input | packages/shared/src/api/devices.ts | B | M2 | 29; rev 2 (40) | carried |
| SH-13 | API area 4 sessions: `switchAudioSource` (`POST /api/v1/sessions/{id}/audio-source`) | packages/shared/src/api/sessions.ts | B | M2 | 29; rev 2 (40) | carried |
| SH-14 | API area 5 evidence: item v2 (files, intervals, transcript); media stream, transcript, revisions, composite export, export jobs; I11/MS-1 text rewritten | packages/shared/src/api/evidence.ts | B | M2 | 29, 33; rev 2 (40) | carried |
| SH-15 | Core API: new error codes; audio status = active + standby; export of a real package | packages/shared/src/api/core-api.ts | B | M2 | 29; rev 2 (40) | carried |
| SH-16 | State slices: shapes above; new replicated slices `captureConfig`, `captureDevices` (28 -> 30); never reuse `AdminResource.DEVICES` (E-04) | packages/shared/src/api/state-slices.ts | B | M2 | 29, 31; rev 2 (40) | carried |
| SH-17 | Realtime messages: `meters.audio` keyed by mic input + `activeMic` | packages/shared/src/api/realtime-messages.ts | B | M2 | 29; rev 2 (40) | carried |
| SH-18 | Sim-action table: hosted `switchAudioSource`, `setCaptureConfig`; INTERNAL `applyCaptureTelemetry`, `applySealingProgress`, `completeSeal`, `raiseCaptureWarning` | packages/shared/src/api/sim-actions.ts | B | M2 | 29, 31; rev 2 (40) | carried |
| SH-19 | OpenAPI: `all` 0.2.1 -> 0.3.0; `offline` constant still `0.1.0` (row 1); `all`-scope is `0.2.1`; row 29 plans both (OD-17) | packages/shared/src/api/openapi.ts; openapi/openapi.json | B | M2 | 29; rev 2 (40) | carried |
| SH-20 | Examples for every changed/new schema; `examples.ts:267 -> :268` (E-07) | packages/shared/src/api/examples.ts, state-examples.ts, realtime-examples.ts, example-parts.ts | B | M2 | 29; rev 2 (40) | carried |
| SH-21 | Live source: bindings for the two hosted actions; neutral audio keyed by mic; error mapping; also touch `live-sim.ts:902-905` (E-02); size M/Medium-High | packages/shared/src/live/source/bindings.ts, neutral-state.ts, rebuild-error.ts | B | M2 | 29, 31; rev 2 (40) | carried |
| SH-22 | React hooks: `useAudioChannel` keyed by mic input; 5 call sites (web 3, mobile 2) | packages/shared/src/sim/react.ts | B | M2 | 34; rev 2 (40) | carried |
| SH-23 | i18n: step v2 labels, PRIMARY/STANDBY copy, switch/warning/transcript copy; remove "never mixed" claims | packages/shared/src/i18n/en/*.ts | B | M2 | 34; rev 2 (40) | carried |
| SH-24 | Demo media/evidence generators and assets: v2 packages under OD-02 L2 using host FFmpeg and (D7) the installed TTS fixture | scripts/gen-demo-media.ts, scripts/gen-demo-evidence.ts; assets/demo-media, assets/demo-evidence | B | M2 | 32; rev 2 (40) | carried |
| SH-25 | **NEW (E-02):** `live-sim.ts:902-905` `onMeters` commits `meters.audio` as `AudioSlice`; must change with SH-17; coordinate with DR-1 (OD-26) | packages/shared/src/live/source/live-sim.ts | B | M2 | 29, 31; rev 2 (40) | new in this phase |

### B.2 apps/core-server — CS-01..CS-25

| ID | Current description (errata applied) | Target workspace/file | Class | Milestone | Blueprint row | Status |
|---|---|---|---|---|---|---|
| CS-01 | App/seams: register capture module(s); add `capture` seam (OD-14 waiver) | apps/core-server/src/app.ts | B | M2/M3 | 31; rev 2 (40) | carried |
| CS-02 | Config: `DEMS_CAPTURE_MODE`, worker command path, evidence store under `dataDir`, model dir; listener only under OD-13 (E-26) | apps/core-server/src/config.ts | B | M2/M3 | 31; rev 2 (40) | carried |
| CS-03 | Entry point: start/stop supervisor at boot/shutdown; E-05 path is `apps/core-server/src/index.ts:16` | apps/core-server/src/index.ts | B | M3 | 31; rev 2 (40) | carried |
| CS-04 | Engine host: INTERNAL entry points for telemetry/progress/seal (like `setTabletLink`); `capture: 'external'`; meters from worker; FINALIZING process start resumes sealing | apps/core-server/src/engine/host.ts, types.ts, headless-sim.ts, hosted-actions.ts, rehydrate.ts | B | M3/M7 | 31, 32; rev 2 (40) | carried |
| CS-05 | Engine static rule stays (worker code outside `engine/`); 21 src guards + 13-file `test/static/` suite (row 1) | apps/core-server/src/engine/__tests__/static.test.ts | A | M2 | 36; rev 2 (40) | carried |
| CS-06 | Devices module: status from supervisor-fed slices; `restartDevice(CAM-0x)` -> PoE cycle; command map derived from contract (E-12); never reuse `AdminResource.DEVICES` (E-04); OD-22 gating | apps/core-server/src/modules/devices/* | B | M4 | 29, 31; rev 2 (40) | carried |
| CS-07 | Sessions module: route `switchAudioSource`; start refuses when worker/device not ready; sealing refusals | apps/core-server/src/modules/sessions/* | B | M2/M5 | 29, 31; rev 2 (40) | carried |
| CS-08 | Evidence module: v2 reads, v2 verify, real export; `MediaRef` keeps `DEMO_PACKAGE` for demo items; streaming moves to NM-11 | apps/core-server/src/modules/evidence/* | B | M7/M8 | 32, 34; rev 2 (40) | carried |
| CS-09 | Storage module: real volume figures into `storage` slice; evidence-store usage | apps/core-server/src/modules/storage/* | B | M3 | 31; rev 2 (40) | carried |
| CS-10 | System module: services (worker, transcriber); `restartServices` restarts worker; health from telemetry | apps/core-server/src/modules/system/* | B | M3/M6 | 31; rev 2 (40) | carried |
| CS-11 | Network-time module: real time source/NTP state; camera clock offsets via telemetry | apps/core-server/src/modules/network-time/index.ts | B | M4 | 31; rev 2 (40) | carried |
| CS-12 | RBAC/permission guard: new permission(s) in the stored matrix; new access rules | apps/core-server/src/modules/rbac/index.ts, plugins/permission-guard/* | B | M2 | 29; rev 2 (40) | carried |
| CS-13 | Security-audit module: new audit types readable/exportable; real signing-key record replaces simulated | apps/core-server/src/modules/security-audit/* | B | M7 | 32; rev 2 (40) | carried |
| CS-14 | Audit-details allow-list: exact key lists for server-written capture types, no secret keys; `:1-133 -> :1-140` (E-10); value sets imported from `@dems/shared/api`; E-30 | apps/core-server/src/core/audit-details.ts | B | M2 | 29, 35; rev 2 (40) | carried |
| CS-15 | Realtime hub: meter shape; publication for config changes; capture devices get their own slice/kind (E-04) | apps/core-server/src/realtime/hub.ts, messages.ts, publication.ts, limits.ts | B | M2 | 29; rev 2 (40) | carried |
| CS-16 | DB schema: section 6; `manifest_version`; relax signature CHECK (`:336`) and widen `signature_value` (`:335`); three FAULT_KIND CHECKs (E-01) | apps/core-server/src/db/schema/sessions.ts, evidence.ts, core.ts, value-sets.ts, meta.ts, index.ts | B | M2 | 30; rev 2 (40) | carried |
| CS-17 | Migrations `0004_capture.sql` + `0005_capture_privileges.sql` + snapshots; only `dems_demo` exists, lanes recreated (E-19) | apps/core-server/src/db/migrations/* | B | M2 | 30; rev 2 (40) | carried |
| CS-18 | DB mapping: map v2 shapes; signature no longer forced simulated | apps/core-server/src/db/mapping/* | B | M2 | 30; rev 2 (40) | carried |
| CS-19 | Seed: permission rows, default capture config, v2 dataset (OD-02, E-20) | apps/core-server/src/db/seed/* | B | M2 | 30; rev 2 (40) | carried |
| CS-20 | Bulk fixture: v2 recordings | apps/core-server/src/db/fixtures/* | B | M2 | 30; rev 2 (40) | carried |
| CS-21 | Reset: keep capture config/devices/credentials; refuse/fence reset while real sealed packages exist (OD-19) | apps/core-server/src/db/reset/* | B | M7 | 30; rev 2 (40) | carried |
| CS-22 | Boot checks: real mode requires worker binary, writable evidence store, signer key, model files present | apps/core-server/src/core/boot-checks.ts, src/db/schema/boot-checks.ts | B | M3 | 31; rev 2 (40) | carried |
| CS-23 | Demo module: limit fault injection/scenario load in real mode (OD-18) | apps/core-server/src/modules/demo/* | B | M2 | rev 2 (40) | carried |
| CS-24 | Privileges: grants for new tables in `0005` (insert-only where immutable) | apps/core-server/src/db/migrations/0005_capture_privileges.sql | B | M2 | 30; rev 2 (40) | carried |
| CS-25 | **NEW (E-18):** capture constants in `@dems/shared/api`; extend `contract-values.test.ts` | packages/shared/src/api/capture.ts; apps/core-server/src/modules/__tests__/contract-values.test.ts | B | M2 | 29; rev 2 (40) | new in this phase |

### B.3 apps/core-web — WB-01..WB-11

| ID | Current description (errata applied) | Target workspace/file | Class | Milestone | Blueprint row | Status |
|---|---|---|---|---|---|---|
| WB-01 | Session Monitor: active/standby meters with toggle (confirm/pending/RBAC-disabled), warning banner with "switch to standby", finalization v2 steps with progress/ETA + transcript step; preview per OD-12; E-16 gated control | apps/core-web/src/features/session-monitor/* | B | M5/M7 | 34; rev 2 (40) | carried |
| WB-02 | Dashboard: mic tiles active/standby; sealing progress; E-08 line drifts; uses `lib/device-command-gate.ts` | apps/core-web/src/features/dashboard/* | B | M4/M5 | 34; rev 2 (40) | carried |
| WB-03 | Session New: precheck primary/standby; show the selector mapping used | apps/core-web/src/features/session-new/* | B | M4 | 34; rev 2 (40) | carried |
| WB-04 | Evidence detail/media/metadata/integrity/export: one player per camera file with embedded audio, audio-source band, transcript pane; v2 manifest fields; real signature; real export + composite; E-11 drift; keep pinned verdict; E-31 blanking | apps/core-web/src/features/evidence/* | B | M8 | 32, 34; rev 2 (40) | carried |
| WB-05 | Devices page/drawer: device selector, discovery list, write-only credential entry, PoE cycle; E-16 gated control | apps/core-web/src/features/devices/* | B | M4 | 34; rev 2 (40) | carried |
| WB-06 | Storage: real volumes and write rate | apps/core-web/src/features/storage/* | B | M4 | 34; rev 2 (40) | carried |
| WB-07 | System (Settings, services, demo): entry to selector; services list; demo faults re-keyed or disabled in real mode; E-16 | apps/core-web/src/features/system/* | B | M4 | 34; rev 2 (40) | carried |
| WB-08 | Security & Audit: new audit types, real key, custody with switch intervals | apps/core-web/src/features/security-audit/* | B | M7 | 34; rev 2 (40) | carried |
| WB-09 | API Reference: renders the 0.3.0 document (offline constant still 0.1.0, row 1) | apps/core-web/src/features/api-reference/* | B | M2 | 29; rev 2 (40) | carried |
| WB-10 | Composed components: meter keyed by mic input; stepper with progress; timeline kind `AUDIO_SWITCH` | apps/core-web/src/components/composed/* | B | M2/M4 | 34; rev 2 (40) | carried |
| WB-11 | **NEW (E-17):** query factories in `lib/core-queries.ts` for capture config/devices, transcript, export job | apps/core-web/src/lib/core-queries.ts | B | M4 | 34; rev 2 (40) | new in this phase |

### B.4 apps/mobile — MB-01..MB-13

| ID | Current description (errata applied) | Target workspace/file | Class | Milestone | Blueprint row | Status |
|---|---|---|---|---|---|---|
| MB-01 | Home/dashboard: mic tiles active/standby; sealing progress tile; E-14 folds B15 "No signal" + RC-1 (`recording-elapsed.ts:129`); risk Low-Medium | apps/mobile/src/features/dashboard/* | B | M5 | 22, 34; rev 2 (40) | carried |
| MB-02 | Session New: precheck primary/standby, selector mapping | apps/mobile/src/features/session-new/* | B | M4 | 34; rev 2 (40) | carried |
| MB-03 | Session Live: active/standby cards with toggle (confirm/pending/haptic), warning banner, copy changes; E-09 drifts; timer path `use-monitor.ts:92-160` untouched; E-16 | apps/mobile/src/features/session-live/* | B | M5 | 34; rev 2 (40) | carried |
| MB-04 | Session Finalizing: v2 steps, progress/ETA, transcript step, "resumed after restart"; E-13 in-place hand-offs + forward-only progress; risk High | apps/mobile/src/features/session-finalizing/* | B | M7 | 32, 34; rev 2 (40) | carried |
| MB-05 | Session Summary: per-file hashes, transcript hash, label status, real signature note; E-13 in-place hand-off | apps/mobile/src/features/session-summary/* | B | M7 | 34; rev 2 (40) | carried |
| MB-06 | Session Recovery: RECOVERY may end SEALED (resumed sealing); E-13 hand-offs (OD-08) | apps/mobile/src/features/session-recovery/* | B | M7 | 32, 34; rev 2 (40) | carried |
| MB-07 | Evidence detail/media/play sheet: single player of a camera file with embedded audio (expo-video `headers`), interval band, transcript view; v2 integrity; E-31 blanking | apps/mobile/src/features/evidence/* | B | M8 | 34; rev 2 (40) | carried |
| MB-08 | Devices: mic inputs re-keyed; selector UI on tablet/phone; E-15 selection-glow; E-16 | apps/mobile/src/features/devices/* | B | M4 | 34; rev 2 (40) | carried |
| MB-09 | Settings incl. device settings: new `capture` section (selector) or link to Devices; fault targets re-keyed; E-15/E-16 | apps/mobile/src/features/settings/* | B | M4 | 34; rev 2 (40) | carried |
| MB-10 | Network & Time: camera NTP sync/offset rows | apps/mobile/src/features/network-time/* | B | M4 | 34; rev 2 (40) | carried |
| MB-11 | Runtime audio values: keyed by mic input | apps/mobile/src/runtime/use-audio-shared-values.ts | B | M2 | 34; rev 2 (40) | carried |
| MB-12 | Audit tab: new audit type labels; E-15 selection-glow | apps/mobile/src/features/audit/* | B | M7 | 34; rev 2 (40) | carried |
| MB-13 | Test beds/gallery: beds for toggle, warnings, v2 sealing | apps/mobile/src/app/dev-gallery.tsx, features/*/testing/*.tsx | B | M5 | 34; rev 2 (40) | carried |

### B.5 README and docs — DOC-01..DOC-06

| ID | Current description (errata applied) | Target workspace/file | Class | Milestone | Blueprint row | Status |
|---|---|---|---|---|---|---|
| DOC-01 | README: real-capture mode, device setup, mic switch, sealing/transcript, new tamper demo | README.md | A | M9 | rev 2 (40) | carried |
| DOC-02 | Specs: media serving, listener, device rules (supersede task-2 MS/SR rules); E-26 preconditions | masterplan/01_specs.md | A | M9 | rev 2 (40) | carried |
| DOC-03 | Database contract: `dbc-3` (supersede `dbc-2`, 30 tables); carries B16 errata (i)-(v) | masterplan/03_database_contract.md | A | M0 | 30 | carried |
| DOC-04 | Asset READMEs: v2 package description | packages/shared/assets/demo-media/README.md, demo-evidence/README.md | A | M9 | 32; rev 2 (40) | carried |
| DOC-05 | Third-party notices: FFmpeg/GStreamer (LGPL/GPL build flags), whisper.cpp/sherpa-onnx (MIT/Apache), model-weight licences incl. pyannote gating (LB-1) and CC-BY-4.0 (LB-2), Silero MIT | THIRD_PARTY_NOTICES.md | A | M9 | 33; rev 2 (40) | carried |
| DOC-06 | Read-only areas: `apps/mock-core`, `release/` stay the 0.1.0 offline edition | apps/mock-core, release/ | A | all | n/a (no change) | carried |

### B.6 New modules — NM-01..NM-14

| ID | Current description (errata applied) | Target workspace/file | Class | Milestone | Blueprint row | Status |
|---|---|---|---|---|---|---|
| NM-01 | Device adapter layer: `CameraAdapter`, `PoeController`, `AudioInputAdapter` under the device contract; E-12 contract-entry commands; OD-05/06/07/22 | apps/capture-worker/src/adapters/ | B (fake) / C (real) | M4 | 31, 40 | carried |
| NM-02 | Capture worker: 2 RTSP/TCP ingests, 2 mic captures, audio selector -> one encoder -> muxed into both files (no re-encode), 20 Hz meters, silence/disconnect detection, PCM tap; GStreamer path via Homebrew `gstreamer` (bundles gst-plugins-rs) | apps/capture-worker/ | B | M3 | 31; rev 2 (40) | carried |
| NM-03 | Supervisor + IPC: spawn, heartbeat, restart with back-off, correlation IDs, back-pressure; maps to INTERNAL actions and native rows | apps/core-server/src/capture/*; packages/capture-protocol | B | M3 | 31; rev 2 (40) | carried |
| NM-04 | fMP4 writer, running hash, checkpoints: append-only `moof`+`mdat`, fsync, per-fragment record + chain hash; crash re-hash. W1 C-1: no `frag_type`/`default_prft`/`frag_start_number` — use `frag_duration`, `frag_size`, `fragment_index`, `min_frag_duration`, `movflags {default_base_moof, empty_moov, isml}` | apps/capture-worker/ (worker); core-server/src/capture/fragments.ts | B | M3 | 7, 31; rev 2 (40) | carried |
| NM-05 | Encryption: per-fragment AES-256-GCM outside the muxer. W1 C-2: the mp4 muxer CENC is AES-CTR only (no AEAD) | apps/capture-worker/, core-server/src/capture/keys.ts | B | M7 | 32; rev 2 (40) | carried |
| NM-06 | Transcript pipeline: VAD chunking, incremental STT at priority below capture, speaker embeddings, checkpoint per chunk, 2-speaker clustering, JSON/SRT/VTT. W1 C-3/C-5: `whisper-cli` has no `-otype` (`-ng`, `-t`, `-oj`); diarization via sherpa-onnx + Silero VAD (pyannote gated, LB-1). D7: `TranscriberAdapter` with `omlx-server` (this Mac) + `cpu-local` (Core) + `TtsFixtureProvider` | apps/transcriber/ | B | M6 | 10-12, 33; rev 2 (40) | carried |
| NM-07 | Sealing pipeline v2: job with steps, progress, ETA, checkpoint per step; RECOVERY resume; engine units | core-server/src/capture/sealing.ts | B | M7 | 32; rev 2 (40) | carried |
| NM-08 | Package layout, manifest v2, signer: `VIDEO-01.mp4`, `VIDEO-02.mp4`, transcript, fragments JSON, `manifest.json` (`dems.evidence-manifest/2`), signature, certificate, audit extract; `Signer` interface (OD-02/03/04) | packages/shared/src/evidence-package/; core-server/src/capture/signer/ | B | M7 | 32; rev 2 (40) | carried |
| NM-09 | Device-selector config store + API: persist VIDEO-01/02 sources + primary/standby mic; validate; locked while open; audit; publish slice; ops 76-80; own slice (E-04) | core-server/src/modules/capture-config/; packages/shared/src/api/capture.ts | B | M4 | 29, 31; rev 2 (40) | carried |
| NM-10 | Mic switch API + warnings: `switchAudioSource`; switch at audio frame boundary; interval record; audit with sending device ID (E-30); warning raiser (never auto-switch) | sessions module + supervisor | B | M5 | 31; rev 2 (40) | carried |
| NM-11 | Evidence media streaming: Range-served decrypted playback (EVIDENCE_VIEW), audited; own static rule; E-31 blanking if signed URLs | core-server/src/modules/evidence-media/ | B | M8 | 34; rev 2 (40) | carried |
| NM-12 | Export of package + composite: archive + export manifest + signature; composite side-by-side background job, marked derived, hashed | evidence module + worker job | B | M8 | 34; rev 2 (40) | carried |
| NM-13 | Benchmark harness: RTF, peak RAM, WER, label accuracy — DEFERRED to the real Core device (E-22); replaced in M6 by a functional check (S/Low) | apps/transcriber/bench/ | C | M9 (C-7) | 33, 40 | carried |
| NM-14 | Test fixtures: fake RTSP source, fake ONVIF stub, fake audio inputs, AV-sync flash+beep generator/analyser; MediaMTX needs Q-INSTALL item 4 | apps/capture-worker/test-fixtures/ | B | M3 | 9, 31; rev 2 (40) | carried |

---

## C. Gate-Answer Mapping

All 29 answered gate items (OD-01..OD-26 + Q-AUTO + Q-INSTALL + Q-HW). The answer column is the recommended default approved verbatim as "A, semua default" (D4). Each row cites its decision ID; OD-20/OD-24 also cite D7 (STT reuse).

| Gate | Answer (approved default) | Decision | Register rows changed | Blueprint rows |
|---|---|---|---|---|
| OD-01 | T1: `AUDIO-01` = one session audio track; `AUDIO-02` legacy v1; mic inputs `MIC-01`/`MIC-02` | D4 | SH-01, SH-03, SH-05, SH-16, CS-16 | 29, 30 |
| OD-02 | L2: regenerate demo evidence as v2; reseed `dems_demo` only; `release/` untouched | D4 | SH-07, SH-09, SH-11, SH-24, CS-19, CS-20, DOC-04, NM-08 | 30, 32 |
| OD-03 | (a) per-fragment AES-256-GCM; store both stored-bytes and plaintext hashes; confirm at M0 spec gate | D4 | SH-07, CS-16, NM-05, NM-08 | 30, 31, 32 |
| OD-04 | Software Ed25519 behind a `Signer` interface; TPM adapter class C | D4 | SH-07, CS-13, CS-22, NM-08 | 32 |
| OD-05 | Support both topologies; fakes emulate two cameras | D4 | NM-01, NM-09, CS-06 | 31, 40 |
| OD-06 | AAC-LC 48 kHz mono; transport behind `AudioInputAdapter`; USB working assumption | D4 | SH-05, SH-17, NM-01, NM-02 | 31 |
| OD-07 | `PoeController` interface with SNMP adapter + fake; real adapter class C | D4 | NM-01, CS-06 | 31, 40 |
| OD-08 | Seal the durable part flagged "interrupted" | D4 | SH-06, NM-07, CS-04, MB-06 | 31, 32 |
| OD-09 | (a) hot standby; toggle for session holder with `SESSION_START` + SUPERVISOR; web-only recording stays "no"; C5 folded here | D4 | SH-03, SH-13, CS-07, NM-10, WB-01, MB-03 | 29, 34 |
| OD-10 | New `CAPTURE_CONFIG` for SUPERVISOR + TECHNICIAN; idle only | D4 | SH-03, SH-04, CS-12, NM-09, WB-05 | 29, 34 |
| OD-11 | below -50 dBFS for 10 s -> `MIC_SILENT`; disconnect debounce 2 s; contract constants | D4 | SH-03, SH-05, NM-10 | 31 |
| OD-12 | No live preview of real cameras in this phase | D4 | SH-16, WB-01 | 34 |
| OD-13 | Keep loopback (emulators); LAN is class C; preconditions E-26 | D4 | CS-02, DOC-02 | 34, 40 |
| OD-14 | P25 waiver limited to module registration, `capture` seam, config keys, supervisor start/stop | D4 | CS-01, CS-02, CS-03 | 31 |
| OD-15 | `TRANSCRIPT_REVISE` for INVESTIGATOR + SUPERVISOR; Core key signs; author recorded; no approval flow | D4 | SH-03, SH-14, NM-06, WB-04, MB-07 | 29, 33 |
| OD-16 | Decrypted copy + manifest + signature; export audited; composite side-by-side on demand, marked derived | D4 | SH-14, NM-12, WB-04, MB-07 | 32, 34 |
| OD-17 | Simulator emulates v2; `offline` OpenAPI scope 0.2.0 (all-scope 0.3.0) | D4 | SH-05, SH-07, SH-19, CS-19 | 29 |
| OD-18 | Disable hardware-fault injection and scenario load in real mode; Simulated unchanged | D4 | CS-23, WB-07 | rev 2 (40) |
| OD-19 | Block reset while real sealed packages exist; capture config/devices/credentials kept tables | D4 | CS-16, CS-21 | 30 |
| OD-20 | Indonesian only; allow diarization + VAD downloads after the row-4 licence check; licences into DOC-05 | D4, D7 | SH-09, NM-06, DOC-05 | 33 |
| OD-21 | Fragmented MP4; fallback kept designed; legal confirmation before handover (no external authority found, F-102) | D4 | SH-07, NM-04, NM-05, NM-07 | 31, 32 |
| OD-22 | PoE-cycle only a lost-stream camera, confirmed + audited, gap marked | D4 | CS-06, NM-01, WB-05 | 29, 40 |
| OD-23 | Retire the SC8 "simulator untouched" rule; re-baseline Simulated regression at `c2c983b` (M2, M9) | D4 | SH-05, SH-06, SH-07, SH-08, CS-16, CS-19 | 30, 40 |
| OD-24 | whisper.cpp (Homebrew); conversion in an isolated venv under `.cache/`. D7 re-scope: Mac reuses installed oMLX; `cpu-local` later | D4, D7 | NM-06, NM-13, CS-22 | 10-12, 33, 40 |
| OD-25 | (a) all media in git-ignored paths; `docs/` text evidence + small stills | D4 | NM-04, CS-02, DOC-01 | 31 |
| OD-26 | (b) minimal targeted edits now; large refactors after M9 or a separate task | D4 | SH-21, SH-25, CS-05, WB-11 | 40 |
| Q-AUTO | Yes: full autonomy inside approved scope with a decision log; stops only at approval gates, installs, hardware arrival, handover | D4 | all (process) | all |
| Q-INSTALL | Blanket for items 1-6 (whisper.cpp, conversion venv, GStreamer + gst-plugins-rs, MediaMTX, sherpa-onnx + diarization/VAD, ONVIF npm after B2); user-space only; uninstall commands logged | D4, D7 | NM-01, NM-02, NM-06, NM-14 | 10, 13, 14, 40 |
| Q-HW | Unknown: class C deferred; task completes at the "done on this Mac with fake devices" line | D4 | NM-13, class-C rows | 40 |

**Gate-answer count: 29/29 mapped (26 OD + Q-AUTO + Q-INSTALL + Q-HW).**

---

## D. Requirement Trace (R-1..R-7)

Updates the blueprint §7 table with register IDs. Each requirement traces to >= 1 register row, >= 1 blueprint row and >= 1 milestone.

| Req | Requirement | Register rows | Blueprint rows | Milestones | Gate items |
|---|---|---|---|---|---|
| R-1 | Device-selector config in the Core, editable from web/tablet/phone under RBAC + audit | SH-03, SH-04, SH-12, SH-16, SH-22, NM-09, WB-03, WB-05, MB-02, MB-08, MB-09 | 6, 28, 29, 30, 34 | M2, M4 | OD-05, OD-10, OD-22 |
| R-2 | Capture worker behind the API, supervised, IPC, adapters under the device contract | SH-05, SH-06, NM-01, NM-02, NM-03, CS-01, CS-02, CS-03, CS-04, CS-06, CS-11, CS-22 | 3, 7, 14, 15, 31 | M1, M3, M4 | OD-05, OD-06, OD-07, OD-14 |
| R-3 | One active mic, manual toggle, audited, intervals in the manifest, warn never auto-switch | SH-03, SH-08, SH-13, SH-17, CS-07, NM-10, WB-01, WB-10, MB-01, MB-03 | 8, 29, 31, 34 | M1, M5 | OD-09, OD-11 |
| R-4 | One whole fMP4 file per camera with the single audio track, running SHA-256, fragment checkpoints | SH-07, SH-25, CS-16, CS-20, NM-04, NM-05, NM-08 | 7, 9, 31, 32 | M1, M3, M7 | OD-03, OD-21, OD-25 |
| R-5 | Transcript inside the seal; CPU + RAM STT; incremental; labels when possible; signed revisions | SH-09, SH-14, NM-06, NM-13, DOC-05 | 4, 10, 11, 12, 33 | M1, M6, M7 | OD-15, OD-20, OD-24 |
| R-6 | One session per Core; blocked until SEALED; per-step progress + ETA; resumable via RECOVERY | SH-06, CS-04, CS-21, NM-07, WB-01, MB-04, MB-06 | 28, 32, 34 | M2, M7 | OD-08 |
| R-7 | Hardware >= this Mac, CPU-only; no benchmark here; working STT first; benchmark on the Core device | CS-22, NM-06, NM-13 | 2, 12, 36, 40 | M1, M9 (class C) | OD-24, Q-HW |

**Requirement trace: 7/7 (each >= 1 register row, >= 1 blueprint row, >= 1 milestone).**

---

## E. Superseded Register (history only)

These five items are **SUPERSEDED** and must never appear as live requirements in rows 28-37 or the M0 gate (blueprint §1.3; `01_translated.md` C-REQ notes; D2/D218/D220/D229/D230).

| Superseded item | Superseded by | Evidence | Where it would otherwise appear |
|---|---|---|---|
| D223 "master multi-track remux" | D224, D225 (one whole file per camera) | blueprint §1.3; `01_translated.md` R-4 note | SH-05/SH-07 multitrack master path |
| D226 benchmark plan on this Mac | D230 (no benchmark on this Mac; benchmark on the Core device) | blueprint §1.3; E-22 | NM-13; M1/M6 gate criteria |
| D219 "audio input feeds MIC 1/2" | D220, D221 (primary/standby) | blueprint §1.3; `01_translated.md` R-1 note | SH-03 precheck MIC_1/MIC_2 |
| Controller's AUDIO-MIX track; speaker attribution by channel | D220 (withdrawn) | blueprint §1.3; `01_translated.md` Important Notes | SH-01/SH-17 track model |
| MLX fp16 copy of the model | D229 (Apple GPU only; conflicts with D222 and an x86 Core) | blueprint §1.3; `01_translated.md` R-7 note; env_check §5 | NM-06 runtime choice |

---

## F. Corrections from Wave W1

The twelve corrections the specs must honour (D8 plus the task's F list), each with its evidence and the register/blueprint rows that need it.

| # | Correction | Evidence | Register rows | Blueprint rows |
|---|---|---|---|---|
| W1-C1 | FFmpeg mp4 muxer has no `frag_type`, no `default_prft`, no `frag_start_number`; only `frag_duration`, `frag_size`, `fragment_index`, `min_frag_duration`, `movflags {default_base_moof, empty_moov, isml}` | row 3 F-05/F-14/F-15; `initialization/01_env_check.md` §3 | NM-04 | 7, 31 |
| W1-C2 | mp4 muxer CENC is AES-CTR only, no AEAD; per-fragment authentication must live outside the muxer | row 3 F-47/F-52; env_check §3 | NM-05, SH-07 | 31, 32 |
| W1-C3 | `whisper-cli` has no `-otype`; CPU-only is `-ng`, threads `-t`, JSON `-oj` | row 4 F-12; D8 | NM-06, NM-13 | 10-12, 33 |
| W1-C4 | Homebrew formula is `whisper.cpp` (not `whisper-cpp`); one formula bundles gst-plugins-rs | row 4 F-02; row 3 F-64/F-65; D8 | NM-02, NM-06 | 10, 13, 14 |
| W1-C5 | pyannote diarization models are gated on Hugging Face (human must accept terms); licence-clean route is sherpa-onnx + Silero VAD | row 4 F-110, LB-1; D8 | NM-06, DOC-05 | 33 |
| W1-C6 | B2 baseline is 54 high (lock graph) / 51 (`--omit=dev`), NOT 99; root causes undici 7.29.0, braces 3.0.3, node-forge 1.4.0, the latter two with no published fix; 15 `fixAvailable` entries name downgrades | row 5 §1, §3, §4 | backlog B2 (no SH/CS/WB/MB/DOC/NM row) | 5, 23, 24, 27 |
| W1-C7 | all four vitest workspaces (packages/shared, apps/core-server unit + db projects, apps/core-web) AND apps/mobile (jest) use `--maxWorkers=2` for per-workspace runs; vitest 5.0.3 DOES honour `--maxWorkers` (verified from `vitest --help` and by measurement in core-web: same 6 files 15.55 s at `--maxWorkers=1` with exactly one child worker observed vs 7.62 s / 8.05 s at `--maxWorkers=4`, identical pass counts); the prescribed substitute `--poolOptions.threads.maxThreads=2` rejects with `CACError: Unknown option` and core-web's default pool is `forks` (`apps/core-web/vite.config.ts:69-74`), so the substitute is both wrong and moot | row 5 §10 step 10 (superseded); D12(c); row 20 report `implementation/05_b10d_live_paired_devices_issue.md` §5 | test rows | 23, 27, 36 |
| W1-C8 | OD-21: no external authority found in public sources for fragmented-MP4-as-whole-file — unresolved legal confirmation | row 3 F-102; D8 | NM-04, NM-07, SH-07 | 32 |
| W1-C9 | Offline OpenAPI document constant still `0.1.0` while all-scope is `0.2.1` — row 29 must plan both | row 1 §2.5; D8 | SH-19, WB-09 | 29 |
| W1-C10 | `:335` is the hashes CHECK, `:336` the signature CHECK | row 1 §2.7; D8 | CS-16 | 30 |
| W1-C11 | Static guards: 21 src guards plus a separate 13-file scanner suite in `apps/core-server/test/static/` | row 1 §2.4; D8 | CS-05 | 36 |
| W1-C12 | D7: rows 10-12 use the installed oMLX engines on this Mac; portable whisper.cpp for the x86 Linux Core is a later wave; row 33 must define `TranscriberAdapter` with `omlx-server` and `cpu-local` backends plus a `TtsFixtureProvider`; flag as touching OD-24 for confirmation at the second blueprint gate | D7 (a)-(e); env_check §11 | NM-06, NM-13 | 10-12, 33, 40 |

---

## G. Open-Risk Delta (RK-1..RK-20)

Status of each blueprint risk with wave-W1 evidence. "Changed" means the W1 artifacts altered the risk's evidence or status.

| Risk | W1 status | Evidence |
|---|---|---|
| RK-1 STT starves capture | **Changed** — no benchmark on this Mac (D230); D7 reuses oMLX on this Mac; contention still unknown until the Core device; M6 functional check + C-7 remain | E-22; D7; row 5 A-R5-3 |
| RK-2 fMP4 not legally accepted | **Changed** — "no external authority found" (F-102); present as unresolved legal confirmation, not clearance | row 3 F-102; W1-C8 |
| RK-3 clock drift cameras/audio/Core | Unchanged — W1 adds no clock-drift evidence | blueprint §Risk; not touched by W1 |
| RK-4 repository growth from media | Unchanged — OD-25 default (a) already applied | blueprint §Risk; D4 |
| RK-5 tablet learns state late under load | Unchanged — W1 adds no new timing data | blueprint §Risk; P-12 still the instrument |
| RK-6 Reanimated lost updates in Finalizing | Unchanged — E-13 reconfirms the pattern but raises no new risk level beyond MB-04 High | E-13 |
| RK-7 SC8 rule blocks simulator edits | **Changed** — OD-23 answered (retire; re-baseline at `c2c983b`) | D4 OD-23; E-03 |
| RK-8 `live-sim.ts` edited while split deferred | **Changed** — E-02 adds SH-25 and names `live-sim.ts:902-905`; OD-26 default (b) | E-02; D4 OD-26 |
| RK-9 dependency debt grows | **Changed/quantified** — baseline is 54/51, not 99; braces + node-forge have no published fix | row 5 §1, §3; E-06 for test counts |
| RK-10 lanes gone; lane-based gates fail | **Changed/confirmed** — only `dems_demo` exists; lane re-creation opens M2 | E-19, E-24; D6 |
| RK-11 P25 freeze slows wiring | Unchanged — OD-14 limited waiver granted | D4 OD-14 |
| RK-12 camera credentials leak | Unchanged — T-33 design unchanged; E-30 adds refusal auditing | E-30 |
| RK-13 conversion toolchain heavy | **Confirmed** — macOS about 145 MB of wheels; x86 Linux default torch 554.6 MB; D7 defers conversion on this Mac | row 4 F-61/F-62; D7 |
| RK-14 contract breadth (up to 165 test files) | **Refined** — 664 test files (was 630); upper bound 165 stays fair | E-06 |
| RK-15 encryption scheme complicates streaming | **Changed/confirmed** — CENC AES-CTR only, no AEAD (W1-C2); OD-03(a) GCM must sit outside the muxer | W1-C2 |
| RK-16 demo reset erases real evidence | Unchanged — OD-19 default blocks reset | D4 OD-19 |
| RK-17 mobile streaming of large files | **Changed** — E-31 requires the signed-URL prefix in both blanking lists if the fallback is chosen | E-31 |
| RK-18 Simulated/Live divergence | Unchanged — OD-17 default emulates v2 | D4 OD-17 |
| RK-19 host-load test flakes mask failures | Unchanged — per-workspace runs + B10 first; W1-C7 adds the vitest pool caveat | W1-C7; E-23 |
| RK-20 long task loses state across compaction | Unchanged — checkpoint-resume + trackers | blueprint §Risk |

---

## External Research Synthesis

Dimensions in scope for this task (`01_translated.md` External Research Scope): **Technology Evaluation (Dim 2)** and **Regulatory & Compliance (Dim 5)**. No canonical `research/03_external_vocabulary.md` exists in this task folder, so dimension definitions follow the task's own scope statement.

### Technology Evaluation (Dim 2)
- **FFmpeg vs GStreamer** (`NM-02`, row 15 pick memo): FFmpeg 9.0.2 is on the host; GStreamer needs a Homebrew install (single `gstreamer` formula bundles `gst-plugins-rs`/`isofmp4mux`, W1-C4). Row 3 supplies capability facts, rows 7/8/14 measure, row 15 scores. Register impact: NM-02, NM-04, NM-14.
- **whisper.cpp vs CTranslate2** (`NM-06`, OD-24): both are CPU-capable; whisper.cpp is a native binary that also runs on x86 Linux; CTranslate2/faster-whisper is Python-only at run time. D7 chooses reuse-first on this Mac (`omlx-server`) and keeps `cpu-local` (whisper.cpp) for the Core. Register impact: NM-06, NM-13.
- **sherpa-onnx vs pyannote diarization** (`NM-06`): pyannote weights are gated (human terms acceptance, LB-1); the licence-clean route is sherpa-onnx + Silero VAD. Register impact: NM-06, DOC-05.
- **ONVIF clients** (`NM-01`): npm `onvif`/`@2bad/onvif` and Rust `oxvif` are current; Q-INSTALL item 6 permits an ONVIF npm package only after B2. Register impact: NM-01.
- **Signer and encryption** (`NM-05`, `NM-08`): OD-04 software Ed25519; OD-03(a) per-fragment GCM outside the muxer because CENC is CTR-only. Register impact: NM-05, NM-08.

### Regulatory & Compliance (Dim 5)
- **fMP4 as "one whole file"** (`NM-04`, `NM-07`): no public standards/forensic source found (F-102); carried as unresolved legal confirmation before handover (OD-21). Register impact: SH-07, NM-04, NM-07.
- **Licences for a distributed product** (`DOC-05`): FFmpeg LGPL base/GPL when optional parts are used; Homebrew GStreamer configured `-Dgpl=enabled`; whisper.cpp/ggml MIT, sherpa-onnx Apache-2.0, Silero MIT, pyannote weights gated, CC-BY-4.0 attribution for the WeSpeaker embedding (LB-2). Register impact: DOC-05, NM-06.

### Dimensions with no findings
- Technology Trends (Dim 1), Vendor Evaluation (Dim 3), Market Share & Positioning (Dim 4), Competitive Landscape (Dim 6), Industry Trends (Dim 7): no findings — out of scope for this task's external research statement; no register row is affected.

---

## Files and Modules Involved

| Area | Artifact / rows |
|---|---|
| Shared contract/sim | packages/shared/src/{domain,sim,api,live,i18n} (SH-01..SH-25) |
| Core server | apps/core-server/src/{engine,modules,db,realtime,core} (CS-01..CS-25) |
| Core web | apps/core-web/src/{features,components,lib} (WB-01..WB-11) |
| Mobile | apps/mobile/src/{features,runtime,app} (MB-01..MB-13) |
| Docs | README.md, masterplan/01_specs.md, masterplan/03_database_contract.md, THIRD_PARTY_NOTICES.md (DOC-01..DOC-06) |
| New workspaces/modules | apps/capture-worker/, apps/transcriber/, packages/capture-protocol, core-server/src/capture/, modules/capture-config/, modules/evidence-media/, packages/shared/src/evidence-package/ (NM-01..NM-14) |

## Implementation Order

1. **M0:** register (row 6) -> specs (rows 28-37) -> plan (row 37); backlog B2/B10/RC-1 (rows 5, 16-27). Rationale: the specs are checked against this register.
2. **M1:** spikes S1/S2/S4 (rows 7-9), STT install/conversion/functional check re-scoped by D7 (rows 10-12), engine pick (row 15). Rationale: evidence for NM-02/NM-04/NM-05/NM-06.
3. **M2:** contract + DB foundation + Simulated parity (SH-01..SH-25, CS-12/14/16-20/24/25, WB-09); lane re-creation first. Rationale: unblocks all later milestones.
4. **M3-M8:** worker/supervisor/IPC, adapters/selector, mic failover, transcript, sealing, playback/export (NM/CS/WB/MB rows), M9 hardening last.

## Risks

- Register drift: class/milestone/blueprint placement is analyst judgement (MEDIUM confidence) and must be re-checked at the M0 gate (row 39).
- D7 re-scope touches the OD-24 default; flagged for confirmation at the second blueprint gate (row 40).
- OD-21 legal confirmation remains unresolved (no external authority, F-102); the fallback must stay designed.

## Acceptance Criteria

1. 31/31 errata mapped with before/after (section A).
2. Every row ID present exactly once: SH 25/25, CS 25/25, WB 11/11, MB 13/13, DOC 6/6, NM 14/14 (section B).
3. R-1..R-7 each traced to >= 1 register row (section D).
4. Every answered gate item cited by decision ID: 29/29 (section C).
5. The twelve W1 corrections each appear in a register row that needs them (section F).
6. No superseded item appears as a live requirement (section E).

## Recommendations

1. Row 39 (M0 gate) should use section B as the checklist source and section D as the requirement trace.
2. Rows 29/30/33/34 should consume the errata IDs (E-01..E-31) directly when writing their specs, so the gate can trace each errata item to a spec location.
3. Carry W1-C6 (B2 54/51) and W1-C7 (vitest pool) into rows 23/24/27 as recorded decisions.
4. Present W1-C12 (D7 `TranscriberAdapter` + OD-24) explicitly at the second blueprint gate (row 40).

---
*Generated: 2026-10-07*
*Last Updated: 2026-10-07*
