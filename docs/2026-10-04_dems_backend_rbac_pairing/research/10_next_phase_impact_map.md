---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-06
agent: data-analyst
type: mixed (impact analysis, pre-planning for the NEXT task)
tier: 1
confidence: MEDIUM
confidence_note: repository facts are HIGH (read from files, graft and command output, cited file:line). Every technology choice is a CANDIDATE and every performance figure is a HYPOTHESIS until the M1 spike/benchmark runs. Sizes are analyst estimates.
implements_decisions: D219, D220, D221, D222, D223, D224, D225, D226 (decisions/decisions.md:225-232); context D202 FXC-1 (decisions.md:208)
source_translated_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/identification/01_translated.md
source_structured_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/identification/02_structured.md
status: complete (read-only analysis; no code, test, database or configuration changed)
last_updated: 2026-10-06 17:48 WIB
---

# Next-phase impact map: real capture devices, recording worker, whole-file sealing with transcript, manual microphone failover

## 0. Summary

| Item | Value |
|---|---|
| What changes | The Core gets a real capture/processing worker behind the existing API, a device-selector configuration, ONE evidence audio track with a manual hot-standby microphone switch, one whole fragmented-MP4 file per camera with a running SHA-256, an in-package machine transcript, and a resumable sealing pipeline v2 |
| Starting point | No real ingest anywhere: no RTSP/ONVIF/FFmpeg/child_process use in `apps/core-server/src` (grep, §2 F-01); media are bundled demo files (MS-1); hashes and signature are synthetic (`packages/shared/src/sim/evidence.ts:4-9`) |
| Core architectural finding | The Core server hosts the shared simulator as its ONE state machine (`apps/core-server/src/engine/host.ts:1-45`); the real pipeline must plug in UNDER it through a capture-driver seam and INTERNAL actions (precedent: `setTabletLink`, `engine/types.ts:205-209`), not beside it |
| Existing-file impact | 24 shared rows, 24 core-server rows, 10 core-web rows, 13 mobile rows, 6 docs rows (section 3) |
| New modules | 14 (section 4), the largest: capture worker, device adapters, transcript pipeline, sealing v2 |
| Contract | 75 -> about 88 operations (13 proposed), OpenAPI `all` 0.2.1 -> 0.3.0, 10 new audit types (+3 reused), 1-2 new permissions, 2 new fault kinds, manifest `dems.evidence-manifest/1` -> `/2` |
| Database | migration 0004 (+0005 privileges), schema version 1 -> 2, contract `dbc-2` -> `dbc-3`, 9 new tables, 5 changed tables |
| Test impact | 165 of 630 test files name a changing fact (upper bound by grep, section 7); 4 new test layers |
| Process blockers | `app.ts`, `index.ts`, `config.ts` are FROZEN (P25, `app.ts:6`, `config.ts:8`, `index.ts:16`); 21 static guard tests forbid `node:fs`/`child_process` in the modules that would host the work; SR-01 loopback-only listener blocks physical tablets/phones (`masterplan/01_specs.md:207`, `:1341`) |
| Milestones | M0-M9 (section 8), 21 open decisions OD-01..OD-21 |

---

## 1. Scope and sources

### 1.1 Tier-1 frame (5W1H)

| W/H | Content |
|---|---|
| What | A file-level map of every current module the decided changes touch, and of the new modules to build, so the NEXT task can write its blueprint from it |
| Who | Stakeholders: the user (decision owner, D219-D226); investigators/supervisors/technicians (RBAC roles `vocabulary.ts:17-20`); the next task's controller, task-architect, coder rows; legal/evidence reviewers (whole-file rule D224) |
| When | Written 2026-10-06 during the final re-test of the current task; applies to the NEXT task (D219: "Recorded as scope for a NEXT task (not this one)") |
| Where | Repository `/Users/gsp-budi/Documents/DEMS`: `packages/shared`, `apps/core-server`, `apps/core-web`, `apps/mobile`, README/docs. `apps/mock-core` and `release/` are read-only and out of scope |
| Why | D219 closes the "external devices" and "recording" gaps; D220-D221 correct the audio model (one active microphone); D222-D225 define the sealed package (whole files + transcript); D226 sets the hardware baseline |
| How | Read the decisions verbatim; verified the controller's facts in code; mapped sites with `graft callers --depth all`, `graft skeleton`, grep with `/usr/bin/grep -E` over `*.ts/*.tsx`; counted test files by pattern; checked host tools read-only (`ffmpeg -version`, `-demuxers`, `-h muxer=mp4`); verified four technology claims on the web (sources at the end) |

### 1.2 Requirements implemented (IDs used in the rest of this document)

| ID | Requirement (decision) | Source |
|---|---|---|
| R-1 | Device-selector configuration in the Core: which camera feeds VIDEO-01/VIDEO-02, which microphone is primary and which is standby; editable from web, tablet and phone under RBAC and audit | D219 (1), D220, D221 |
| R-2 | Real capture/processing worker BEHIND the API (adapter layer under the existing device contract): PoE cameras (ONVIF discovery/config, RTSP over TCP, PoE port power-cycle via the switch, NTP from the Core) and external microphones; a separate supervised process controlled by the Core over IPC | D219 (2) |
| R-3 | ONE active microphone per session; the second is a hot standby; switching is MANUAL via a UI toggle (tablet/phone monitor + web Session Monitor) for operators holding the session + SUPERVISOR; each switch audited and written to the manifest as audio source intervals; the Core warns, never auto-switches, on disconnect or prolonged silence | D220, D221 |
| R-4 | Evidence = one whole file per camera (2 files), each with that camera's video + the single audio track on one timeline, no re-encoding; append-only fragmented MP4 with a running SHA-256 (fallback: segments + lossless concatenation at sealing); per-fragment checkpoints in the manifest; segment/fragment-level encryption | D224, D225 |
| R-5 | Machine transcript inside the sealed package; local STT on CPU + RAM only; computed incrementally during recording; two fixed speakers labelled when possible, else sealed without labels and flagged; corrections only as signed revisions | D222, D223, D226 |
| R-6 | One active session per Core (kept); room blocked until SEALED; per-step sealing progress with an estimate on all clients; checkpointed, resumable through RECOVERY; composite video only on demand at export | D219 (3), D223 |
| R-7 | Hardware baseline: Apple M5 (4P + 6E), 24 GiB RAM, CPU-only; benchmark re-run on the chosen Core hardware | D226 |

### 1.3 Out of scope (for this map)

- Any change in this task: nothing is changed here (D220: "nothing is changed in this task").
- `apps/mock-core`, `release/` (read-only; the 0.1.0 offline edition stays as is).
- Choosing vendors/models; this map lists candidates only.
- Production deployment (OS image, installer, TLS PKI) beyond the dependencies it creates (OD-13).

### 1.4 Assumptions and gaps

| # | Assumption / gap | Effect |
|---|---|---|
| A-1 | The next task keeps the architecture "shared simulator as the Core's state machine" (`engine/host.ts:5-13`) | If it does not, sections 3.2 and 4 change shape (a server-native session pipeline) and most shared tests are rewritten |
| A-2 | The current camera model is ONE dual-lens camera on `POE_CAM_1` feeding both video tracks (`sim/initial-state.ts:186-216`, `sim/types.ts:557-563`, demo manifest "Dual-lens IP camera DL-2 (lens 1)") while D219 speaks of "PoE cameras" | The selector schema must address (device, media profile), not only device (OD-05) |
| A-3 | Microphones are modelled as the Core's analog inputs `MIC_IN_1/MIC_IN_2` with gain and phantom (`sim/initial-state.ts:221-247`, `:381-382`) while D219 says "external microphones" | Audio adapter transport is open (OD-06) |
| G-1 | No benchmark has been run; no model was downloaded (D226 requires the user's permission) | All STT throughput figures are hypotheses until M1 |
| G-2 | `sysctl` is refused by this sandbox; the hardware facts are the controller's (D226) | Cited, not re-measured |
| G-3 | No physical camera, PoE switch or microphone was available to this analysis | Device facts are design-level only |

---

## 2. Current-state facts

| # | Fact | Evidence | Status |
|---|---|---|---|
| F-01 | No real ingest in the Core server: no RTSP, ONVIF, FFmpeg, GStreamer, Whisper or `child_process` use in production sources | `/usr/bin/grep -rniE "rtsp\|onvif\|child_process\|spawn\(\|ffmpeg\|gstreamer" apps/core-server/src` (non-test) returned nothing; the only `child_process` import is a test helper `apps/core-server/test/helpers/db/__tests__/nested-run.db.test.ts:17`; the one client hit (`core-web/.../offset-panel.tsx`) is the icon name `ChartSpline` | Missing |
| F-02 | Server serves no media or package file (decision MS-1, MS-2, MS-3) | `masterplan/01_specs.md:1351-1365`; `modules/evidence/media.ts:1-32` (DEMO_PACKAGE join only); `api/evidence.ts:19-21` | By design, must change |
| F-03 | Static guard tests forbid files/processes in the modules that would host the work: evidence (`node:fs`, `stream`, `child_process`, `createReadStream`, `sendFile`, `@fastify/static`), engine (`fs`, `net`, `child_process`, `worker_threads`), storage/system (`os`, `fs`, `child_process`, `worker_threads`, `crypto`) | `modules/evidence/__tests__/static.test.ts:80-83`; `engine/__tests__/static.test.ts:29`; `modules/storage/__tests__/static-rules.ts:53`; `modules/system/__tests__/static-rules.ts:64`; 21 `static*.test.ts` files in total (section 7) | Constraint |
| F-04 | Hashes and signature are synthetic: per-track SHA-256 over a synthetic descriptor, manifest hash over the track list, signature `sha256(manifestHash ‖ keyId)` labelled simulated | `sim/evidence.ts:4-9`, `:65-135`; type `algorithm: 'SIMULATED-SHA256'` `sim/types.ts:675`; DB CHECK `0001_tables.sql:336` forces `SIMULATED-SHA256` and `signature_simulated`; `:335` forces a 64-hex signature | Simulated |
| F-05 | Two simultaneous audio tracks in the contract and model | `domain/enums.ts:132-140` (`AUDIO_01`, `AUDIO_02`); `sim/evidence.ts:36-52` (labels, `TRACK_ORDER`); `api/state-slices.ts:372` ("never merged (SYS-003)"), `:392`, `:588`; DB `value-sets.ts:54`, CHECK `0001_tables.sql:353` (4 tracks, position 1..4) | Drift vs D220 |
| F-06 | Microphone roles are Interviewer/Subject on fixed channels 1/2 | `sim/types.ts:438-453` (`role` :443, `channel` :444); `api/state-slices.ts:357-372` | Drift vs D220 |
| F-07 | One session slot; `isSessionActive` true until SEALED; create while open answers `SESSION_ACTIVE` | `sim/session-machine.ts:109-111`, `:378-385`; DB singleton `db/schema/sessions.ts:35-43` | Exists, kept (R-6) |
| F-08 | Finalization = 6 timed steps of 0.6-1.2 s each, then seal | `domain/enums.ts:222-239`; `sim/session-machine.ts:99-106` (`FINALIZATION_ORDER`), `:745-780` (`advanceStopping`), `:851-904` (`seal`), `:907-935` (`advanceFinalization`); web modal says "≤ 8.7 s after the stop" `core-web/src/features/session-monitor/finalization-modal.tsx:44` | Simulated, must become event-driven |
| F-09 | A process start during PRECHECK..FINALIZING raises POWER_FAIL; RECOVERY ends INCOMPLETE, never sealed | `engine/rehydrate.ts:300-326`; `sim/session-machine.ts:1009-1094` (`advanceRecovery`, `finishIncomplete`, S31-7 at :1028) | Must change for R-6 (resume sealing) |
| F-10 | Custody actor of start/stop comes from the session's own audit row (`recordingActor`); storing `startedBy`/`stoppedBy` would need new `active_session` columns, a database contract revision, migration 0004 and schema v2 (FXC-1) | `sim/session-machine.ts:841-849`; `decisions.md:208` (D202) | Exists; FXC-1 can ride on migration 0004 |
| F-11 | DB: 30 tables, schema version 1, contract `dbc-2`; 4 migrations | `db/schema/meta.ts:16`, `:18`; `masterplan/03_database_contract.md:451` ("Table inventory (30)"); `db/migrations/meta/_journal.json` (0000-0003) | Exists |
| F-12 | Session/evidence tables: `active_session` (singleton, JSON `finalization`), `session_history`, `evidence_items`, `evidence_tracks` (4 rows/item), `evidence_custody`, `exports` | `db/schema/sessions.ts:40-109`, `:112-159`; `db/schema/evidence.ts:53-151`, `:154-177`, `:180-208`, `:216-251` | Exists |
| F-13 | Audit `type` is a pattern, not an enum (new audit types need no migration); `category` is a fixed list | `0001_tables.sql:194-195` | Favourable |
| F-14 | Alerts `kind` and `session_history.fault_kind` are CHECKed against `FAULT_KIND` (new fault kinds need a migration) | `0001_tables.sql:382`, `:281`; `value-sets.ts:56-69` | Constraint |
| F-15 | Permissions are seeded, and the boot step `rbac.matrix` refuses a stored vocabulary or grant set that differs from the shared one (D88) | `db/seed/seed.ts:197`; `plugins/permission-guard/matrix.ts:1-17`; shared table `sim/auth.ts:46-72` | Constraint |
| F-16 | The registry holds 75 operations; OpenAPI `all` scope 0.2.1, `offline` scope 0.1.0 pinned byte for byte to the baseline | `api/openapi.ts:6-23`, `:101-106`; 14 test files pin 75 (section 7) | Exists |
| F-17 | 28 replicated slices; `audio` is streamed only in `meters` frames keyed `AUDIO-01`/`AUDIO-02` | `api/state-slices.ts:11`, `:390-397`; `api/realtime-messages.ts:12-22`, `:343`; 18 test files pin 28 | Exists |
| F-18 | A new simulator action reaches the server through: `SimActions` -> `SIM_ACTION_OPERATIONS` (hosted/internal) -> registry operation -> live binding -> engine allow list -> module route | `sim/types.ts:986`; `api/sim-actions.ts:15-110`; `live/source/bindings.ts:424-478`; `engine/hosted-actions.ts:16-35`; e.g. `modules/devices/operations.ts:5-33` | Pattern to follow |
| F-19 | INTERNAL action precedent: the server sets the tablet link from real connections through `engine.setTabletLink` with no actor | `engine/types.ts:205-209`; `engine/host.ts:897-899`; `realtime/tablet-link.ts:11` | Pattern for hardware telemetry |
| F-20 | `CreateSimOptions` has no subsystem/driver option; the tick always runs the synthetic audio and health subsystems | `sim/types.ts:139-163`; `sim/engine.ts:152-162` | Missing seam |
| F-21 | The network, time, storage and device slices are simulated hardware signals | `modules/network-time/index.ts:9-11`; `sim/initial-state.ts:186-382` | Simulated |
| F-22 | Recording profile: 1080p25 H.264 at 9 Mbit/s per camera | `sim/initial-state.ts:198`, `:214`; `sim/types.ts:285-292` | Simulated values; sizing input |
| F-23 | Manifest v1 exists in the 14 demo packages: `dems.evidence-manifest/1`, 4 track files, Ed25519 DEMO signature, self-signed DEMO certificate, encryption `applied: false` | `packages/shared/assets/demo-evidence/SESSION-SES-20260929-0011/manifest.json` (structure printed with python), `evidence-container.json` ("two H.264 video tracks, two AAC audio tracks"); client verifier `demo-data/verify.ts:1-22` | Exists (demo) |
| F-24 | Clients play evidence as silent video + two separate audio files with a MIC switch | `core-web/src/features/evidence/media-tab.tsx:18`, `:57-58`, `:78-256`; `mobile/src/features/evidence/use-evidence-playback.ts:3-7`, `:90-91`, `:155-156`; `mobile/src/components/media/demo-media.ts:11`, `:26` | Must change (R-4) |
| F-25 | Live monitor picture is the bundled demo loop | `README.md:338` | No live preview (OD-12) |
| F-26 | Listener bound to `127.0.0.1` only; physical tablet/PC cannot connect (U4) | `config.ts:21-22`; `masterplan/01_specs.md:207`, `:1340-1341`, `:1559` | Blocks real devices (OD-13) |
| F-27 | `app.ts`, `index.ts`, `config.ts` frozen after W08 (P25); a new seam is a `needs-review`; modules are imported explicitly in `buildApp` | `app.ts:6`, `:35-48`, `:81-94`, `:114-133`; `config.ts:8`; `index.ts:16` | Process constraint (OD-14) |
| F-28 | A demo reset carries only 8 kept tables; evidence rows are rebuilt from the seed | `db/reset/kept-tables.ts:63-70` | Risk with real files on disk (OD-19) |
| F-29 | Host tools: FFmpeg 9.0.2 at `/opt/homebrew/bin/ffmpeg` with RTSP and AVFoundation inputs, fMP4 flags `frag_keyframe`, `empty_moov`, `default_base_moof`, `frag_duration`, filters `silencedetect`, `astats`, `ebur128`; no `whisper` filter in this build; no GStreamer, whisper.cpp or Maestro on PATH | `ffmpeg -version`, `-demuxers`, `-h muxer=mp4`, `-filters`; `which gst-launch-1.0 whisper-cli maestro` | Available for M1 prototypes |
| F-30 | Test signal today: a microphone plays a steady −18 dBFS tone for 2 s on its meter; no video flash exists | `sim/maintenance.ts:186-221`; `sim/audio.ts:136-137` | AV-sync test needs a new flash+beep fixture |
| F-31 | Mobile video stack: Expo ~57.0.26, expo-video ~57.0.5; expo-video 57 `VideoSource.headers` exists (Android, iOS) | `apps/mobile/package.json`; Expo docs (sources) | Streaming with a bearer header is possible (verify in M8) |
| F-32 | Latest suite baselines: shared 70 files / 1,848 tests; core-server unit 155 / 3,926, db 124 / 1,751; core-web 111 / 1,436; mobile 170 / 1,894 | `decisions.md:208` (D202), `:223` (D217), `:224` (D218) | Baseline for section 7 |

---

## 3. Impact map (existing files)

Columns: Change = modify / new / remove / regenerate. Size: S ≤ 2 dev-days, M 3-7, L > 7 (estimates). Risk: Low / Medium / High. "Dep." names rows (SH/CS/WB/MB/DOC), new modules (NM) or open decisions (OD).

### 3.1 packages/shared

| ID | Area | File(s) with line refs | Change | What exactly changes | Size | Risk | Dep. |
|---|---|---|---|---|---|---|---|
| SH-01 | Domain enums | `src/domain/enums.ts:132-140` (TrackId), `:222-239` (FinalizationStep + labels), `:191-220` (lifecycle) | modify | Track model per OD-01 (T1: `AUDIO-01` = the single session audio track, `AUDIO-02` legacy v1 only; or T2: new `AUDIO`); new `MicInputId` (`MIC-01`/`MIC-02`) and `MicRole` (`PRIMARY`/`STANDBY`); FinalizationStep v2: `CLOSE_TRACKS`, `FINALIZE_HASHES`, `FINALIZE_TRANSCRIPT`, `BUILD_MANIFEST`, `SIGN_MANIFEST`, `STORE_SEALED_PACKAGE` (+ `CONCATENATE_SEGMENTS`/`ENCRYPT_PAYLOAD` only on the fallback path) | M | High | OD-01 |
| SH-02 | Domain entities | `src/domain/entities.ts:12-46` (`ENTITY_NAMES`), `:86-110` | modify | Add `EvidenceFile`, `AudioSourceInterval`, `FragmentCheckpoint`, `Transcript`, `TranscriptRevision`, `CaptureConfig`, `CaptureDevice` | S | Low | SH-01 |
| SH-03 | Vocabulary | `src/sim/vocabulary.ts:23-38` (Permission), `:88-108` (`PrecheckCheckId` MIC_1/MIC_2), `:131-141` (TimelineKind), `:193-224` (FaultKind, FaultEvt), `:260` (DeviceCommand), `:296-430` (AuditType + category map) | modify | Permission `CAPTURE_CONFIG` (+ `TRANSCRIPT_REVISE` per OD-15); precheck `MIC_PRIMARY` (BLOCK when absent) / `MIC_STANDBY` (WARN when absent; hypothesis rule); TimelineKind `AUDIO_SWITCH`; FaultKind `MIC_SILENT`, `CAPTURE_FAULT`; new AuditTypes (section 5.4) | M | Medium | OD-09, OD-10, OD-11 |
| SH-04 | RBAC table | `src/sim/auth.ts:46-72` (`ROLE_PERMISSIONS`) | modify | Grant `CAPTURE_CONFIG` to SUPERVISOR and TECHNICIAN (proposal); D88 equality with the stored matrix | S | Medium | CS-12, CS-19 |
| SH-05 | Sim types | `src/sim/types.ts:139-163` (CreateSimOptions), `:318-330` (FinalizationStepState), `:370-396` (ActiveSession), `:421-453` (CameraStatus, MicStatus), `:458-474` (AudioFrame/AudioSlice), `:629-645` (MicLevelPoint), `:664-740` (EvidenceTrack/Signature/Item), `:909-924` (verify results), `:986-1100` (SimActions) | modify | `capture: 'simulated' \| 'external'` option; step `progress`, `etaMs`, `detail`, `attempt`; session `captureConfig` snapshot, `audioSource {activeMicId, intervals[]}`, `transcript {status, chunksDone, chunksTotal}`; MicStatus `role` -> PRIMARY/STANDBY, `active`, transport; audio frames keyed by mic input; EvidenceItem `manifestVersion`, `files[]`, `audioSourceIntervals[]`, `transcript`, signature algorithm union; verify results add `fragments`, `transcript`; actions `switchAudioSource`, `setCaptureConfig` + INTERNAL telemetry actions | L | High | OD-01, OD-03, NM-03 |
| SH-06 | Session machine | `src/sim/session-machine.ts:99-106`, `:269-275`, `:446-502` (precheck, MIC_1/MIC_2 at `:461-464`), `:652-685` (start), `:688-724` (stop), `:745-780` (advanceStopping), `:851-904` (seal), `:907-935` (advanceFinalization), `:972-1094` (recovery) | modify | Snapshot capture config at start, open interval 1; close interval at stop; in `external` mode steps advance on INTERNAL progress actions (no timers); `seal` builds a v2 item from driver results; RECOVERY resumes sealing from the stored checkpoint instead of `finishIncomplete` for STOPPING/FINALIZING; new `switchAudioSourceTransition` (refuse outside RECORDING, refuse standby not READY) | L | High | SH-05, OD-08 |
| SH-07 | Evidence integrity | `src/sim/evidence.ts:30-53` (labels, `TRACK_ORDER`), `:88-135` (manifest, simulated signature), `:184` (`DEFAULT_TAMPER_TRACK = AUDIO-02`), `:220-252`, `:265-332` | modify | Simulated v2 integrity (2 files, fragment chain, transcript hash); v1 path kept or removed per OD-02; tamper target becomes a file/fragment | M | Medium | OD-02 |
| SH-08 | Sim devices, audio, faults, derive, selectors, health, maintenance, scenarios, initial state | `src/sim/devices.ts:222-301`; `audio.ts:136-253`; `faults.ts:80-83`, `:186-252`, `:391-399`; `derive.ts:78-79`, `:203-260`; `selectors.ts:326-361`; `health.ts` (micLevels); `maintenance.ts:186-221`; `scenarios.ts:79-188`; `initial-state.ts:131-132`, `:186-247`, `:299`, `:378-382` | modify | Re-key mic data by input ID; PRIMARY/STANDBY roles and `active` flag; simulated switch and silence warning; flags `MIC_<id>_*`; TEST_SIGNAL gains an AV flash+beep variant (simulated); scenarios produce v2 sessions | M | Medium | SH-05 |
| SH-09 | Dataset | `src/sim/dataset.ts:167-184` (`CORE_SERVICES`, 16 names), `:551-869` (`buildHistory`, 13 items) | modify | Service list (worker, transcription health); v2 or legacy items per OD-02. (Credential lines of this file were not read.) | M | Medium | OD-02 |
| SH-10 | Constants/store | `src/sim/constants.ts:14` (`SIM_SNAPSHOT_VERSION = 1`); `initial-state.ts:145` | modify | Bump to 2 (shape change of persisted slices); step timing constants for the simulated driver | S | Low | SH-05 |
| SH-11 | Demo alignment + demo-data verifier | `src/sim/demo-alignment.ts` (266); `src/demo-data/verify.ts:1-22` (v1 checks: `track:<ID>`, manifest, Ed25519 signature, certificate, audit chain); `packages.generated.ts` (3,709 lines), `documents.generated.ts`, `types.ts` | modify / regenerate | v2 checks (per-file hash, fragment chain head, transcript hash, intervals); v1 checks kept only under OD-02 L1 | L | Medium | NM-08, OD-02 |
| SH-12 | API area 6 devices | `src/api/devices.ts:1-20`, `:55-100` (`DeviceInventorySchema`), `:109-260` (ops 47-52) | modify / new | Capture config and capture devices operations (section 5.2); inventory adds capture devices; `resetMicClip` keyed by mic input | M | Medium | NM-09 |
| SH-13 | API area 4 sessions | `src/api/sessions.ts:1-40`, `:146-441` | new | `switchAudioSource` (`POST /api/v1/sessions/{id}/audio-source`) | S | Medium | NM-10, OD-09 |
| SH-14 | API area 5 evidence | `src/api/evidence.ts:15-21` (I11 "AUDIO-01 and AUDIO-02 are separate tracks"; MS-1 "no operation returns a file"), `:156-260` | modify / new | Item v2 (files, intervals, transcript); media stream, transcript, revisions, composite export, export jobs (section 5.2); I11 and MS-1 text rewritten | L | High | NM-11, NM-12 |
| SH-15 | Core API (design-book ops, error codes) | `src/api/core-api.ts:153-200` (ApiErrorCode), `:627-760` (24-27), `:775` (`getAudioStatus`), `:829` (`exportEvidence`) | modify | New error codes (section 5.7); audio status = active + standby; export of a real package | M | Medium | SH-14 |
| SH-16 | State slices | `src/api/state-slices.ts:217-288` (ActiveSessionSchema), `:335-372` (cameras, mics), `:390-397` (AudioSliceSchema), `:528-536` (micLevels), `:569-612` (EvidenceItemSchema; "never merged" `:588`; signature literal), `:744-827` (delivery, `REPLICATED_SLICE_SCHEMAS`) | modify | All shapes above; new replicated slices `captureConfig`, `captureDevices` (28 -> 30) | L | High | SH-05 |
| SH-17 | Realtime messages | `src/api/realtime-messages.ts:1-40`, `:343` (`meters`) | modify | `meters.audio` keyed by mic input + `activeMic`; table text | M | Medium | SH-16 |
| SH-18 | Sim-action table | `src/api/sim-actions.ts:15-110` | modify | Hosted `switchAudioSource`, `setCaptureConfig`; INTERNAL `applyCaptureTelemetry`, `applySealingProgress`, `completeSeal`, `raiseCaptureWarning` (names proposed) | M | Medium | CS-04 |
| SH-19 | OpenAPI | `src/api/openapi.ts:6-23`, `:101-106`; `openapi/openapi.json`; `scripts/gen-openapi.ts` | modify / regenerate | `all` 0.2.1 -> 0.3.0; `offline` 0.1.0 frozen or bumped (OD-17) | S | Medium | SH-12..SH-17 |
| SH-20 | Examples | `src/api/examples.ts:267`, `state-examples.ts:287`, `realtime-examples.ts`, `example-parts.ts` | modify | Examples of every changed/new schema | M | Low | SH-16 |
| SH-21 | Live source | `src/live/source/bindings.ts:145-478` (resetClip `:424`, deviceCommand `:453`, setActiveCamera `:474`), `neutral-state.ts:45-50`, `rebuild-error.ts:61-62` | modify | Bindings for the two new hosted actions; neutral audio state keyed by mic; error mapping for new codes | M | Medium | SH-18 |
| SH-22 | React hooks | `src/sim/react.ts:97` (`useAudioChannel(channel: AudioTrackId)`) | modify | Key by mic input; 5 client call sites (web 3, mobile 2) | S | Medium | SH-05 |
| SH-23 | i18n | `src/i18n/en/common.ts:293-298` (step labels), `:475-486` (tracks/mic labels), `devices.ts:83-84`, `system.ts:45` ("Two independent audio channels"), `session.ts`, `evidence.ts` | modify | Step v2 labels, PRIMARY/STANDBY copy, switch/warning copy, transcript copy, remove "never mixed" claims | M | Low | SH-01 |
| SH-24 | Demo media/evidence generators and assets | `scripts/gen-demo-media.ts` (1,551; `:1115-1153`, `:1322-1544`), `scripts/gen-demo-evidence.ts` (1,476; `:304-341`); `assets/demo-media/{evidence/0001..0013,live,mobile}`; `assets/demo-evidence/SESSION-*` (14 folders) | modify / regenerate | v2 packages (2 muxed files + transcript + manifest v2) under OD-02 L2; uses host FFmpeg 9.0.2 and espeak-ng (`README.md:459`) | L | Medium | OD-02, NM-08 |

### 3.2 apps/core-server

| ID | Area | File(s) with line refs | Change | What exactly changes | Size | Risk | Dep. |
|---|---|---|---|---|---|---|---|
| CS-01 | App and seams | `src/app.ts:6` (FROZEN), `:35-48`, `:81-94` (module imports), `:114-133` (Seams) | modify (waiver) | Register the capture module(s); add seam `capture` | S | High (process) | OD-14 |
| CS-02 | Config | `src/config.ts:8` (FROZEN), `:21-36`, `:160`, `:220`, `:262` (`dataDir`) | modify (waiver) | `DEMS_CAPTURE_MODE` (simulated/real), worker command path, evidence store under `dataDir`, model dir; listener change only under OD-13 | M | High | OD-13, OD-14 |
| CS-03 | Entry point | `src/index.ts:16` (FROZEN) | modify (waiver) | Start/stop the supervisor at boot/shutdown, graceful worker stop before the engine's last unit | S | Medium | NM-03 |
| CS-04 | Engine host | `src/engine/host.ts` (963; `:897-899` setTabletLink), `engine/types.ts:65-70` (EngineMeterFrame), `:174-258` (EngineHost), `engine/headless-sim.ts:74-88`, `engine/hosted-actions.ts:16-35`, `engine/rehydrate.ts:300-326` | modify | INTERNAL entry points for telemetry/progress/seal (like `setTabletLink`); pass `capture: 'external'` in real mode; meters from the worker; process start in FINALIZING resumes sealing instead of POWER_FAIL | L | High | SH-05, SH-06, NM-07 |
| CS-05 | Engine static rule | `src/engine/__tests__/static.test.ts:29` | keep | The worker code must live outside `engine/` (rule stays) | S | Low | NM-03 |
| CS-06 | Devices module | `src/modules/devices/index.ts:1-60`, `operations.ts:5-33`, `status.ts` (202) | modify | Status from slices fed by the supervisor; `restartDevice(CAM-0x)` -> PoE cycle; static test `devices/__tests__/static.test.ts:143` pins the engine-seam members | M | Medium | NM-01, NM-09 |
| CS-07 | Sessions module | `src/modules/sessions/routes.ts:1-160` (ops 24-38; `startSession` composite `:7`), `operations.ts`, `refusals.ts` | modify | Route `switchAudioSource`; start refuses when the worker is not ready; sealing refusals | M | High | NM-10 |
| CS-08 | Evidence module | `src/modules/evidence/index.ts:38`, `:73`, `:150-210`; `media.ts:1-32`; `reads.ts`; `export-request.ts`; static `__tests__/static.test.ts:80-96` (forbidden imports, file list pinned) | modify | v2 reads, v2 verify, real export; MediaRef keeps DEMO_PACKAGE for demo items; streaming goes to a NEW module (NM-11) with its own static rule | L | High | NM-11, NM-12 |
| CS-09 | Storage module | `src/modules/storage/index.ts`, `status.ts`, `policy.ts`; rule `static-rules.ts:53` | modify | Real volume figures arrive as telemetry into the `storage` slice; evidence store usage | M | Medium | NM-03 |
| CS-10 | System module | `src/modules/system/status.ts`, `operations.ts`, `settings.ts`; rule `static-rules.ts:64` | modify | Services (worker, transcriber); `restartServices` restarts the worker; health from host telemetry | M | Medium | NM-03 |
| CS-11 | Network-time module | `src/modules/network-time/index.ts:1-25` | modify | Real time source / NTP server state and camera clock offsets via telemetry | M | Medium | NM-01 |
| CS-12 | RBAC, permission guard | `src/modules/rbac/index.ts`; `plugins/permission-guard/matrix.ts:1-60`, `access-rules.ts` | modify | New permission(s) in the stored matrix; new access rules | S | Medium | SH-04, CS-19 |
| CS-13 | Security-audit module | `src/modules/security-audit/*` | modify | New audit types readable/exportable; real signing key record replaces the simulated key in the `security` slice | S | Low | NM-08 |
| CS-14 | Audit details allow-list | `src/core/audit-details.ts:1-133` (exact keys for server-written types) | modify | Exact key lists for server-written capture types (no secret keys) | S | Medium | section 5.4 |
| CS-15 | Realtime hub | `src/realtime/hub.ts:380-400` (onMeters), `messages.ts`, `publication.ts:1-22` (additive kinds), `limits.ts` | modify | Meter shape; publication for config changes | M | Medium | SH-17 |
| CS-16 | DB schema | `src/db/schema/sessions.ts:40-109`; `evidence.ts:53-177`; `core.ts:70-95` (alerts), `:207-237` (hardware_snapshot); `value-sets.ts:54-69`; `meta.ts:16`, `:18`; `index.ts` | modify / new | Section 6 | L | High | OD-01, OD-03 |
| CS-17 | Migrations | `src/db/migrations/0000-0003`, `meta/_journal.json` | new | `0004_capture.sql` (+ `0005_capture_privileges.sql`), snapshots; applied on 4 live databases (4420-4423) | M | High | CS-16 |
| CS-18 | DB mapping | `src/db/mapping/to-rows.ts:26-144`, `from-rows.ts:95-100`, `rows.ts:408-490`, `slices.ts`, `health-snapshot.ts` | modify | Map v2 shapes; signature no longer forced simulated | M | High | CS-16 |
| CS-19 | Seed | `src/db/seed/seed.ts:197`, `seed/dataset.ts:57-62` | modify | Permission rows, default capture config, v2 dataset | M | Medium | OD-02 |
| CS-20 | Bulk fixture | `src/db/fixtures/recordings.ts:113-624` (`:368`, `:475-503`, `:593` AUDIO-02 timeline), `build.ts:102-208` | modify | v2 recordings | M | Medium | SH-07 |
| CS-21 | Reset | `src/db/reset/kept-tables.ts:63-70`, `plan.ts`, `routine.ts` | modify | Keep capture config/devices/credentials; refuse or fence a reset while real sealed evidence exists | M | High | OD-19 |
| CS-22 | Boot checks | `src/core/boot-checks.ts`, `src/db/schema/boot-checks.ts` (471) | modify | In real mode: worker binary, writable evidence store, signer key, model files present | M | Medium | NM-03, NM-08 |
| CS-23 | Demo module | `src/modules/demo/*` | modify | Limit fault injection/scenario load in real mode | S | Medium | OD-18 |
| CS-24 | Privileges | `src/db/migrations/0003_privileges.sql:17-57` | new (in 0005) | Grants for the new tables (insert-only where immutable) | S | Medium | CS-17 |

### 3.3 apps/core-web

| ID | Area | File(s) with line refs | Change | What exactly changes | Size | Risk | Dep. |
|---|---|---|---|---|---|---|---|
| WB-01 | Session Monitor | `src/features/session-monitor/audio-panel.tsx:11-35` (two halves MIC 1/MIC 2), `inputs-panel.tsx:16`, `:82-87`, `model.ts:279-280`, `timeline-panel.tsx:46`, `action-bar.tsx` (741), `status-banner.tsx` (173), `finalization-modal.tsx:44`, `:93-172`, `live-feed-panel.tsx` (320) | modify | Active/standby meters with a toggle (confirm, pending, RBAC-disabled state); warning banner with a "switch to standby" action; finalization v2 steps with progress/ETA and the transcript step; preview per OD-12 | L | High | SH-16, NM-10 |
| WB-02 | Dashboard | `src/features/dashboard/devices-panel.tsx:23-42`, `:260`; `active-session-panel.tsx` (463); `dashboard-model.ts` (349) | modify | Mic tiles active/standby; sealing progress | M | Low | SH-16 |
| WB-03 | Session New | `src/features/session-new/devices-step.tsx:229`, `model.ts` (186), `ready-step.tsx` | modify | Precheck primary/standby; show the selector mapping used for the session | M | Medium | SH-03 |
| WB-04 | Evidence detail, media, metadata, integrity, export | `src/features/evidence/media-tab.tsx:18`, `:57-58`, `:78-256`; `use-evidence-media.ts`; `demo-assets.ts`; `components/media/demo-media.ts`; `metadata-tab.tsx:16-53`; `manifest-summary.ts:32-75`; `integrity-tab.tsx:52-286`; `use-verification.ts` (412); `check-list.tsx`; `labels.ts`; `export-wizard.tsx` (652); `export-download.ts` | modify | One player per camera file with embedded audio, audio-source band, transcript pane (revisions); v2 manifest fields; per-file hashes, fragment chain, transcript hash, real signature; export of a real package + composite option | L | High | NM-11, NM-12 |
| WB-05 | Devices page and drawer | `src/features/devices/audio-input-card.tsx:22-166`, `device-drawer.tsx:57-60`, `:183-236`, `camera-tile.tsx`, `port-map.tsx`, `other-devices.tsx`, `index.tsx`, `sim-adapter.ts`, `context.ts` | modify | Device selector (camera -> VIDEO-01/02, primary/standby mic), discovery list, write-only credential entry, PoE cycle | L | Medium | NM-09 |
| WB-06 | Storage | `src/features/storage/model.ts` (241), `capacity-panel.tsx` | modify | Real volumes and write rate | S | Low | CS-09 |
| WB-07 | System (Settings, services, demo) | `src/features/system/settings-panel.tsx:28-37`, `:88-100` (Device Settings: active camera), `services-panel.tsx`, `demo-panel.tsx` (510), `model.ts:182-183` (MIC faults on AUDIO-01/02) | modify | Entry to the device selector; services list; demo faults re-keyed or disabled in real mode | M | Medium | OD-18 |
| WB-08 | Security & Audit | `src/features/security-audit/audit-log-panel.tsx`, `model.ts` (484), `keys-panel.tsx`, `custody-panel.tsx` | modify | New audit types, real key, custody with switch intervals | S | Low | section 5.4 |
| WB-09 | API Reference | `src/features/api-reference/*`; tests `src/test/live-api-reference-document.test.tsx`, `live-api-reference-page.test.tsx` (pin 75) | modify | Renders the 0.3.0 document | S | Low | SH-19 |
| WB-10 | Composed components | `src/components/composed/dbfs-meter.tsx` (channel), `stepper.tsx`, `session-timeline.tsx` | modify | Meter keyed by mic input; stepper with progress; timeline kind AUDIO_SWITCH | S | Low | SH-22 |

### 3.4 apps/mobile

| ID | Area | File(s) with line refs | Change | What exactly changes | Size | Risk | Dep. |
|---|---|---|---|---|---|---|---|
| MB-01 | Home/dashboard | `src/features/dashboard/device-tiles.tsx` (180), `home-model.ts:76-77`, `use-home-data.ts`; `features/home/*` | modify | Mic tiles active/standby; sealing progress tile | S | Low | SH-16 |
| MB-02 | Session New | `src/features/session-new/device-previews.tsx:37-38` (camera+mic pairs), `session-new-model.ts`, `use-session-new.ts`, `devices-check-step.tsx`, `check-icon.tsx` | modify | Precheck primary/standby, selector mapping | M | Medium | SH-03 |
| MB-03 | Session Live (mic cards, audio monitor, connection banner) | `src/features/session-live/mic-card.tsx:5-126` (testIDs `monitor-mic-1/2`), `monitor-sheets.tsx:6`, `:100-125`, `session-live-screen.tsx:63`, `:231-256`, `use-monitor.ts:27`, `:148`, `:227`, `connection-banner.tsx` (56), `action-tiles.tsx` (284), `i18n.ts:54-69` ("never mixed") | modify | Active/standby cards with the toggle (confirm, pending, haptic), warning banner with "switch to standby", copy changes | L | High | NM-10 |
| MB-04 | Session Finalizing | `src/features/session-finalizing/finalizing.model.ts:10-18` (own copy of the six steps), `finalization-pipeline.tsx`, `session-finalizing-screen.tsx` (441), `use-finalizing.ts`, `handover.ts` | modify | v2 steps, progress/ETA, transcript step, "resumed after restart" state | M | Medium | SH-01 |
| MB-05 | Session Summary | `src/features/session-summary/summary.model.ts:2-10` ("four tracks… SYS-003"), `session-summary-screen.tsx` (706), `hash-sheet.tsx`, `use-summary.ts` | modify | Per-file hashes, transcript hash, label status, real signature note | M | Medium | SH-16 |
| MB-06 | Session Recovery | `src/features/session-recovery/recovery.model.ts` (284), `recovery-analysis.tsx`, `session-recovery-screen.tsx` (726) | modify | RECOVERY may end SEALED (resumed sealing) | M | Medium | SH-06, OD-08 |
| MB-07 | Evidence detail, media, play sheet | `src/features/evidence/media-tab.tsx:19`, `play-sheet.tsx:171-188`, `use-evidence-playback.ts:3-223`, `integrity-tab.tsx` (463), `live-integrity-tab.tsx`, `metadata-tab.tsx`, `evidence-model.ts:282-313`, `export-sheet.tsx` (567), `i18n.ts:65`, `:190-191`; `src/components/media/demo-media.ts:11-78` | modify | Single player of a camera file with embedded audio (expo-video `headers`, F-31), interval band, transcript view; v2 integrity | L | High | NM-11 |
| MB-08 | Devices | `src/features/devices/device-ids.ts:8-24`, `device-detail.tsx` (681), `device-mic-meter.tsx`, `device-row.tsx`, `device-command-dialog.tsx`, `devices-model.ts`, `sim-adapter.ts`, `i18n.ts:30-31` | modify | Mic inputs re-keyed, selector UI on tablet/phone | L | Medium | NM-09 |
| MB-09 | Settings incl. device settings | `src/navigation/params.ts:32` (`SETTINGS_SECTIONS`, no device section), `features/settings/maintenance-section.tsx:394`, `settings-model.ts:248-249` | modify / new | New section `capture` (device selector) or link to Devices; fault targets re-keyed | M | Medium | NM-09 |
| MB-10 | Network & Time | `src/features/network-time/*` (time-sync-card, tier-row) | modify | Camera NTP sync/offset rows | S | Low | CS-11 |
| MB-11 | Runtime audio values | `src/runtime/use-audio-shared-values.ts` | modify | Keyed by mic input | S | Medium | SH-22 |
| MB-12 | Audit tab | `src/features/audit/*` | modify | New audit type labels | S | Low | section 5.4 |
| MB-13 | Test beds / gallery | `src/app/dev-gallery.tsx`, `features/*/testing/*.tsx` (e.g. `session-live/testing/live-monitor-bed.tsx`) | modify | Beds for the toggle, warnings, v2 sealing | S | Low | MB-03 |

### 3.5 README and docs

| ID | Area | File(s) with line refs | Change | What exactly changes | Size | Risk | Dep. |
|---|---|---|---|---|---|---|---|
| DOC-01 | README | `README.md:201-218` (demo scenarios; `:212` EV 0005 FAIL on `track:AUDIO-02`), `:220-351` (Live mode; `:338` demo loop), `:352-382` (tests), `:397-412` (demo data), `:446-482` (rollback, FFmpeg note `:459`) | modify | Real-capture mode, device setup, mic switch, sealing/transcript, new tamper demo | M | Low | all |
| DOC-02 | Specs | `masterplan/01_specs.md:1351-1365` (MS-1..MS-3), `:207`, `:1559` (SR-01), `:1340-1341` | supersede (new task spec) | Media serving, listener, device rules | M | Medium | OD-13 |
| DOC-03 | Database contract | `masterplan/03_database_contract.md` (rev 2.2, `dbc-2`, 30 tables) | supersede | `dbc-3` (section 6) | M | Medium | CS-16 |
| DOC-04 | Asset READMEs | `packages/shared/assets/demo-media/README.md`, `demo-evidence/README.md` | modify | v2 package description | S | Low | SH-24 |
| DOC-05 | Third-party notices | `THIRD_PARTY_NOTICES.md` | modify | FFmpeg/GStreamer (LGPL/GPL build flags), whisper.cpp/sherpa-onnx (MIT/Apache), model weight licences | S | Medium | M1 |
| DOC-06 | Read-only areas | `apps/mock-core`, `release/` | none | Stay the 0.1.0 offline edition | – | – | – |

---

## 4. New modules to build

### 4.1 Proposed control and data flow (proposal)

```
 web / tablet / phone ──REST + WS──> core-server (Fastify)
                                     │  modules: sessions, devices, capture-config (new), evidence, evidence-media (new)
                                     │  engine host (shared simulator, capture: 'external')  <── INTERNAL actions (telemetry, progress, seal)
                                     │  capture/ supervisor (new) ──spawn + IPC (control, telemetry)──┐
                                     │  PostgreSQL: fragments, intervals, chunks, sealing jobs        │
                                     │                                                                ▼
                                     │                                capture-worker process (new)
                                     │                     RTSP/TCP x2 ──> video copy ─┐               ONVIF/WS-Discovery, NTP set, PoE (SNMP/API)
                                     │       mic A ─┐                                   ├─> fMP4 writer x2 (running SHA-256, checkpoints, encryption) ─> evidence store
                                     │       mic B ─┴─> selector (hot standby) ─> AAC ─┘
                                     │                         └─ PCM tap ─> transcriber process (new): VAD -> STT int8 -> embeddings -> chunks (checkpointed)
```

The media never pass through IPC; the worker writes files and reports checkpoints. Only control, meters (20 Hz), telemetry and checkpoint records cross the boundary.

### 4.2 Module table

| ID | Module | Responsibility | Interface to existing code | Suggested location | Technology candidates (candidates only) | Size | Risk |
|---|---|---|---|---|---|---|---|
| NM-01 | Device adapter layer | One interface per device class under the existing device contract: `CameraAdapter` (discover, describe profiles, set NTP, select stream profile, stream URI, clock offset), `PoeController` (port status, power-cycle), `AudioInputAdapter` (list, open, levels, health) | Telemetry -> INTERNAL action -> `cameras`, `mics`, `ports`, `otherDevices`, `network`, `time` slices; `restartDevice(CAM-0x)` -> PoE cycle; `testDeviceSignal` -> AV test | `apps/capture-worker/src/adapters/` (in the worker process) | ONVIF Profile S/T client (WS-Discovery on UDP 3702; npm `onvif`, python `onvif-zeep`, or a minimal SOAP client); RTSP over TCP via the media engine; PoE: SNMP POWER-ETHERNET-MIB (RFC 3621) or the switch vendor's API, or the Core's own PoE board (OD-07); audio: ALSA (Linux) / CoreAudio (macOS) | L | High |
| NM-02 | Capture worker | Per session: 2 RTSP ingests (TCP), 2 microphone captures (hot standby), audio selector -> one encoder -> muxed into both camera files with video copied (no re-encode), 20 Hz meters, silence/disconnect detection, PCM tap for STT | Commands/telemetry over IPC (NM-03); never imports `@dems/shared/sim` | `apps/capture-worker/` (new workspace; `apps/*` is already a workspace glob, root `package.json`) | GStreamer: `rtspsrc protocols=tcp`, `input-selector` (gapless switch), `isofmp4mux` from gst-plugins-rs (verified to exist, sources), `appsink` for hashing; FFmpeg libav* custom program; FFmpeg CLI 9.0.2 already on the host (F-29) for the M1 prototype | L | High |
| NM-03 | Supervisor + IPC | Spawn, heartbeat, restart with back-off, command/response with correlation IDs, back-pressure; maps worker events to engine units (INTERNAL actions) and server-native rows (fragments, chunks) | New seam `capture` (CS-01); `engine.run(label, work)` for atomic rows + actions (`engine/types.ts:197-203`); own static rule allowing `node:child_process` (+ `fs` for the store) | `apps/core-server/src/capture/{index,supervisor,ipc,protocol}.ts`; message schemas in a shared, Node-free package (e.g. `packages/capture-protocol`) | `child_process.spawn` + NDJSON over stdio (simplest); Unix domain socket + length-prefixed JSON; gRPC/protobuf (heavier) | M | High |
| NM-04 | fMP4 writer, running hash, checkpoints | Append-only write of `moof`+`mdat` fragments; fsync policy; running SHA-256; per-fragment record (seq, offset, length, sha256, media time range, chain hash `h_i = sha256(h_{i-1} ‖ frag_i)`); after a crash, re-hash the durable prefix to rebuild the running state | Rows into `recording_fragments` (section 6) in batches; final whole-file hash to sealing | Writer in the worker; DB writer in `core-server/src/capture/fragments.ts` | ISO-BMFF box parsing (size+type headers); SHA-256 from the platform crypto library; fallback: segment muxer + lossless concat (`-c copy`) at sealing (D224) | M | High |
| NM-05 | Encryption | Fragment-level encryption at rest (AES-256-GCM, nonce per fragment, per-session key wrapped by the Core key/TPM); decrypt-on-read for playback/export | Key record in the `security` slice; sealing step check | Worker (encrypt on write) + `core-server/src/capture/keys.ts` | (a) encrypted fragment store beside a plaintext-free layout; (b) ISO/IEC 23001-7 Common Encryption (`cenc`/`cbcs`) inside the MP4; (c) volume encryption + one package-encryption pass at sealing (conflicts with "segment-level") — OD-03 | M | High |
| NM-06 | Transcript pipeline | VAD chunking; incremental STT at a priority below capture; speaker embeddings per segment; checkpoint per chunk; at stop: last chunks + fixed 2-speaker clustering + confidence; outputs JSON + SRT + VTT with model name/version/params; "speaker labels unavailable" flag | Chunks into `transcript_chunks`; progress into the session slice; final hashes into the manifest | `apps/transcriber/` (separate supervised process) | STT: whisper.cpp (ggml quantised, CPU), faster-whisper (CTranslate2 int8); VAD: Silero VAD; diarization: sherpa-onnx offline diarization with `num_clusters=2` (verified option, sources) + 3D-Speaker/WeSpeaker embeddings; pyannote (heavier) | L | High |
| NM-07 | Sealing pipeline v2 | Job with steps, progress, ETA, checkpoint per step; RECOVERY resume; emits engine units per step | `sealing_jobs` table; INTERNAL actions to the session machine (SH-06) | `core-server/src/capture/sealing.ts` | Plain state machine; ETA from measured throughput of the previous steps | M | High |
| NM-08 | Package layout, manifest v2, signer | Package: `VIDEO-01.mp4`, `VIDEO-02.mp4`, `transcript.json/.srt/.vtt`, `fragments-VIDEO-0x.json`, `manifest.json` (`dems.evidence-manifest/2`), `signature.sig`, `device-certificate.pem`, `audit-session-extract.jsonl`; `Signer` interface `{keyId, algorithm, certificate, sign(digest)}` | Schema + verifier platform-neutral in shared (extends `demo-data/verify.ts`); signer behind the seam | `packages/shared/src/evidence-package/` + `core-server/src/capture/signer/` | Software Ed25519 (demo/dev); TPM 2.0 ECDSA P-256 via tpm2-tss (EdDSA is in the TPM 2.0 spec but hardware support is limited, sources); PKCS#11 | M | High |
| NM-09 | Device-selector config store + API | Persist VIDEO-01/02 sources and primary/standby mic; validate against the inventory; locked while a session is open; audit; publish slice | Hosted `setCaptureConfig`; ops 76-80; replicated slice `captureConfig` | `core-server/src/modules/capture-config/` + `packages/shared/src/api/capture.ts` | – | M | Medium |
| NM-10 | Mic switch API + warnings | `switchAudioSource(sessionId, target)`; worker switches at an audio frame boundary; interval record; audit; publish; warning raiser for silence/disconnect thresholds (never auto-switch) | Op 81; session machine transition; alerts slice; FaultKind `MIC_SILENT` | sessions module + supervisor | FFmpeg `silencedetect`/`astats` (present, F-29) or level math on the meters | M | High |
| NM-11 | Evidence media streaming | Range-served, decrypted playback of a sealed file for EVIDENCE_VIEW, audited (`EVIDENCE_REVIEW_OPENED` exists, `vocabulary.ts:323`) | Op 82; clients' players | `core-server/src/modules/evidence-media/` (own static rule) | Fastify stream reply with HTTP Range; expo-video `headers` (F-31) | M | High |
| NM-12 | Export of the package + composite | Export archive (package + export manifest + signature); composite side-by-side as an on-demand background job, marked derived, hashed in the export manifest | Ops 86-88; `exports` table; existing `exportEvidence` | evidence module + worker job | zip (store) or tar; FFmpeg `hstack`/`xstack` + an H.264 encoder (licence check) | M | Medium |
| NM-13 | Benchmark harness | STT real-time factor, peak RAM, WER on a hand-checked Indonesian sample, label accuracy — while a recording runs (D226) | Report gate for M1/M6 | `apps/transcriber/bench/` | `hyperfine`-style runner; WER via `jiwer` | S | Medium |
| NM-14 | Test fixtures | Fake RTSP source, fake ONVIF stub, fake audio inputs, AV-sync flash+beep generator and analyser | Worker integration tests (section 7.3) | `apps/capture-worker/test-fixtures/` | FFmpeg `lavfi testsrc`/`sine` -> RTSP server (MediaMTX or GStreamer rtsp-server); minimal SOAP stub | M | Medium |

---

## 5. Contract changes

### 5.1 Track model (OD-01)

| Option | Shape | Pros | Cons |
|---|---|---|---|
| T1 (recommended by the analyst) | Evidence tracks: `VIDEO-01` file, `VIDEO-02` file, each containing the ONE audio track `AUDIO-01`; microphones become inputs `MIC-01`/`MIC-02` (the device IDs already exist, `sim/initial-state.ts:224`, `:236`); `AUDIO-02` allowed only on manifest v1 items | Keeps `AUDIO-01` valid in every v2 artefact; the DB value set can keep 4 values; minimal churn in IDs | `AUDIO-01` changes meaning ("MIC 1" -> "session audio"); copy and tests that equate AUDIO-01 with MIC 1 must change |
| T2 | New track ID `AUDIO`; `AUDIO-01/02` legacy | Unambiguous | Every `TrackId` switch, DB CHECK and fixture changes; more churn |

### 5.2 Operations (proposed names; numbering continues the registry)

| # | operationId | Method and path | Access | Audit on success | Notes |
|--:|---|---|---|---|---|
| 76 | `getCaptureConfig` | GET `/api/v1/capture/config` | AUTHENTICATED | NONE-R | Also in slice `captureConfig` |
| 77 | `setCaptureConfig` | POST `/api/v1/capture/config` | `CAPTURE_CONFIG` | `CAPTURE_CONFIG_CHANGED` | 409 `SESSION_ACTIVE` while a session is open; optimistic `revision` |
| 78 | `listCaptureDevices` | GET `/api/v1/capture/devices` | AUTHENTICATED | NONE-R | No credential ever returned |
| 79 | `discoverCaptureDevices` | POST `/api/v1/capture/devices/discover` | `CAPTURE_CONFIG` | `CAPTURE_DEVICES_DISCOVERED` | WS-Discovery + audio enumeration |
| 80 | `setCaptureDeviceCredential` | POST `/api/v1/capture/devices/{id}/credential` | `CAPTURE_CONFIG` | `CAPTURE_CREDENTIAL_SET` | Write-only; details hold device ID only |
| 81 | `switchAudioSource` | POST `/api/v1/sessions/{id}/audio-source` | `SESSION_START` (Q16) or session holder + SUPERVISOR (OD-09) | `AUDIO_SOURCE_SWITCHED` | Body `{ target: 'PRIMARY' \| 'STANDBY' }` or a mic input ID; idempotent when already active |
| 82 | `getEvidenceFile` | GET `/api/v1/evidence/{id}/files/{trackId}` | `EVIDENCE_VIEW` | `EVIDENCE_REVIEW_OPENED` (once per open, throttled) | HTTP Range, decrypted stream; ID-only path (MS-3 spirit) |
| 83 | `getEvidenceTranscript` | GET `/api/v1/evidence/{id}/transcript?format=json\|srt\|vtt&revision=n` | `EVIDENCE_VIEW` | NONE-R | Machine transcript = revision 0 |
| 84 | `addTranscriptRevision` | POST `/api/v1/evidence/{id}/transcript/revisions` | `TRANSCRIPT_REVISE` (OD-15) | `TRANSCRIPT_REVISION_ADDED` | Signed; links parent hash; never alters revision 0 |
| 85 | `listTranscriptRevisions` | GET `/api/v1/evidence/{id}/transcript/revisions` | `EVIDENCE_VIEW` | NONE-R | – |
| 86 | `requestCompositeExport` | POST `/api/v1/evidence/{id}/composite` | `EVIDENCE_EXPORT` | `COMPOSITE_EXPORT_REQUESTED` | Background job, derived artefact |
| 87 | `getExportJob` | GET `/api/v1/exports/{id}` | `EVIDENCE_EXPORT` | NONE-R | Progress/ETA |
| 88 | `downloadExport` | GET `/api/v1/exports/{id}/download` | `EVIDENCE_EXPORT` | `EVIDENCE_EXPORTED` (exists) | Stream |

Modified operations: 24 `createSession` (snapshot of capture config), 25 `startSession` (refuses when the worker or a selected device is not ready), 26 `stopSession`, 27 `getCurrentSession` (v2 session), 33 `recoverSession` (resumes sealing), 40 `getEvidence` (v2 item), 41 `verifyEvidence` (v2 checks), 42 `exportEvidence` (real package), 44-46 health/audio/video status (active + standby), 47 `getDeviceInventory` (+ capture devices), 48 `restartDevice` (camera -> PoE cycle), 49 `testDeviceSignal` (+ AV flash+beep), 52 `resetMicClip` (keyed by mic input). 51 `setActiveCamera` keeps its meaning (which camera the monitor shows) and must not be confused with the selector.

### 5.3 OpenAPI

- `all` scope `OPENAPI_CORE_SERVER_DOCUMENT_VERSION` 0.2.1 -> 0.3.0 (`api/openapi.ts:106`; breaking shape changes, 0.x minor bump); regenerate `openapi/openapi.json`; 14 tests pin 75 operations (section 7).
- `offline` scope 0.1.0 is pinned byte for byte to the baseline (`api/openapi.ts:21-23`) and includes `getAudioStatus`/`exportEvidence`; if the in-app simulator adopts v2 shapes (OD-17), bump it to 0.2.0 and re-baseline `test/api-openapi-scope.test.ts`.

### 5.4 Audit types (no migration needed, F-13)

| Type | Category | Written by | Details (no secrets) |
|---|---|---|---|
| `CAPTURE_CONFIG_CHANGED` | DEVICE | server (hosted) | revision, `VIDEO-01`/`VIDEO-02` device IDs, primary/standby mic IDs |
| `CAPTURE_DEVICES_DISCOVERED` | DEVICE | server | counts by kind |
| `CAPTURE_DEVICE_REGISTERED` | DEVICE | server | device ID, kind, model |
| `CAPTURE_CREDENTIAL_SET` | SECURITY | server-native (allow-list CS-14) | device ID only |
| `AUDIO_SOURCE_SWITCHED` | SESSION | hosted | session ID, from, to, media time, actor |
| `CAPTURE_WORKER_RESTARTED` | SYSTEM | server-native | reason code, attempt |
| `SEALING_STEP_COMPLETED` | EVIDENCE | engine | step, duration (or an event only, to keep the trail small) |
| `SEALING_RESUMED` | SYSTEM | engine | session ID, step |
| `TRANSCRIPT_REVISION_ADDED` | EVIDENCE | server | evidence ID, revision, parent hash |
| `COMPOSITE_EXPORT_REQUESTED` | EVIDENCE | server | evidence ID, export ID |
| Reuse `FRAME_HASH`, `WRITE_VERIFIED`, `TIMESTAMP_CONFIRMED` (`vocabulary.ts:317-319`) | as today | engine | at a reduced rate (per N fragments), real values |

### 5.5 Realtime

- No new message type is required: sealing progress and audio source travel in the `session` slice `delta`; config in the new `captureConfig` slice; warnings in `alerts`/`events`.
- `meters` changes shape: `audio` keyed by mic input + `activeMic` (`realtime-messages.ts:343`, `state-slices.ts:390-397`).
- Replicated slices 28 -> 30 (`captureConfig`, `captureDevices`), 18 test files pin 28.

### 5.6 RBAC matrix (proposal, OD-09/10/15)

| Permission | INVESTIGATOR | SUPERVISOR | TECHNICIAN | Use |
|---|:-:|:-:|:-:|---|
| `SESSION_START` (exists) | yes | yes | – | Mic switch (Q16 rule; SUPERVISOR already holds it, `sim/auth.ts:55-57`) |
| `CAPTURE_CONFIG` (new) | – | yes | yes | Selector, discovery, credentials |
| `DEVICE_MANAGE` (exists) | – | – | yes | PoE cycle via `restartDevice` |
| `TRANSCRIPT_REVISE` (new, OD-15) | yes? | yes | – | Signed revisions |
| `EVIDENCE_VIEW` / `EVIDENCE_EXPORT` (exist) | as today | as today | as today | Playback / export, composite |

Stored matrix must equal the shared table at boot (F-15): seed + migration data step.

### 5.7 Error codes (additions to `ApiErrorCode`, `core-api.ts:153-200`)

`CAPTURE_NOT_READY` (409/503: worker or a selected device not ready at start), `DEVICE_NOT_SELECTABLE` (422: unknown/unsuitable device in a config), `STANDBY_NOT_READY` (409), `SEALING_IN_PROGRESS` (409), `REVISION_CONFLICT` (409: stale config or transcript revision), `RANGE_NOT_SATISFIABLE` (416), `MEDIA_UNAVAILABLE` (404/503). Existing `SESSION_ACTIVE`, `RECORDING_ACTIVE`, `NOT_READY` are reused where they fit.

### 5.8 Fault kinds (migration needed, F-14)

`MIC_SILENT` (active microphone silent beyond the threshold; WARNING; never auto-switch), `CAPTURE_FAULT` (worker/ingest failure; CRITICAL when a file stops growing). Existing `MIC_NO_SIGNAL` covers disconnect, `CAMERA_LOSS` covers a lost stream.

### 5.9 Manifest v1 -> v2

| Section | v1 (`dems.evidence-manifest/1`, F-23) | v2 (`dems.evidence-manifest/2`, proposal) |
|---|---|---|
| Tracks | 4 files (2 video without audio, 2 AAC audio) | `files[]`: `VIDEO-01.mp4`, `VIDEO-02.mp4`; each: container fMP4 brand, video codec (copied from the camera), audio codec, bytes, duration, whole-file `sha256`, `fragmentCount`, `fragmentChainHead`, fragment list file + its hash |
| Audio | `microphones[]` with roles | `audio`: single track, `sourceIntervals[]` (mic ID, role, from/to media ms and UTC, switched by, reason) |
| Capture | `cameras[]` | `captureConfig` snapshot (device, model, firmware, profile; never credentials), camera clock offsets at start/stop, NTP server |
| Transcript | – | file hashes (JSON, SRT, VTT), model name/version/quantisation/params/model-file hash, diarization model + `numSpeakers: 2` + status `LABELLED`/`UNAVAILABLE` + confidence, source audio statement, revisions policy |
| Encryption | `applied: false` (demo) | algorithm, scope (per-fragment or CENC), wrapped key reference, `applied: true` |
| Signature | Ed25519 DEMO key, self-signed cert | `ECDSA-P256-SHA256` (TPM) or `Ed25519` (software), key ID, signer kind, certificate chain |
| Sealing | `finalizationStatus` | steps with durations, `resumedFromRecovery` |

Treatment of the existing sealed demo evidence (OD-02):

| | L1 legacy v1 verify | L2 reseed to v2 |
|---|---|---|
| What | Keep the 13 dataset items + 14 packages as v1; `manifest_version` column; v1 verifier and v1 media tab kept beside v2 | Regenerate all demo packages as v2 (2 muxed files + transcript + manifest v2) with the generators (SH-24); drop v1 code paths; DB reseed/reset on all four databases |
| Code | Two verifiers, two players, two item shapes in schemas (union) | One of each |
| Tests | v1 tests stay, v2 tests added (larger suite) | v1 tests rewritten to v2 |
| Demo continuity | EV 0005 tamper demo unchanged (`README.md:212`) | Tamper demo re-scripted on a file/fragment |
| Risk | Permanent dual paths; CHECK constraints must allow v1 values | Regeneration effort (196 files, 41.46 MiB, `01_specs.md:1355`); live sessions recorded on the lanes are lost at reset (kept tables survive) |
| When it fits | If any v1 item must stay verifiable for a reviewer | All current evidence is synthetic (F-04, F-23), so nothing of legal value is lost |

---

## 6. Database changes

Migration set 2: `0004_capture.sql` (tables, columns, CHECKs, data rows) and `0005_capture_privileges.sql` (grants) with drizzle snapshots and journal entries; last file writes `schema_meta` = version 2, `dbc-3` (`meta.ts:5-18` rule MG-5). Code constants `DB_SCHEMA_VERSION = 2`, `DB_CONTRACT_REVISION = 'dbc-3'` change in the same commit. `SIM_SNAPSHOT_VERSION` 1 -> 2 (`sim/constants.ts:14`); `core_state.sim_schema_version`, `hardware_snapshot.sim_schema_version` follow.

| Object | Change | Content (proposal) | Runtime privileges | Kept on reset | Ref. |
|---|---|---|---|---|---|
| `active_session` | add columns | `capture_config jsonb` (snapshot), `audio_source jsonb` (active mic + open interval), `transcript_status jsonb`; optional `started_by`, `stopped_by` (closes FXC-1); `finalization` JSON gains progress/ETA (shape only) | UPDATE on new columns | no | `db/schema/sessions.ts:40-109`; D202 |
| `evidence_items` | add/alter | `manifest_version smallint default 1`; `transcript_sha256`, `labels_status`; relax `evidence_items_signature_check` (`0001_tables.sql:336`) to the algorithm list; widen `signature_value` from 64 hex (`:335`) to the real signature length; `signature_simulated` per item | as today (+ none on the new sealed columns) | no | `evidence.ts:53-151` |
| `evidence_tracks` | alter | One row per FILE for v2 (`kind`, `contains_audio`, `fragment_count`, `duration_ms`, `codec`, `fragment_chain_head`); `position` 1..2 for v2, 1..4 for v1 (code-validated or trigger); value set per OD-01 | INSERT only | no | `evidence.ts:154-177`; `0001_tables.sql:353` |
| `alerts`, `session_history` | alter CHECK | Add `MIC_SILENT`, `CAPTURE_FAULT` to `FAULT_KIND` | as today | no | `0001_tables.sql:281`, `:382`; `value-sets.ts:56-69` |
| `capture_config` (T-31, new) | create | singleton: `video_01_device_id`, `video_01_profile`, `video_02_device_id`, `video_02_profile`, `mic_primary_id`, `mic_standby_id`, `revision`, `updated_by`, `updated_at` | SELECT, UPDATE (columns) | yes (site configuration) | NM-09 |
| `capture_devices` (T-32, new) | create | `id`, `kind` (CAMERA/MIC/POE), `transport`, `model`, `firmware`, `address`, `mac`, `onvif_uuid`, `profiles jsonb`, `poe_port`, `enabled`, `last_seen_at` | SELECT, INSERT, UPDATE (state columns) | yes | NM-01 |
| `capture_device_credentials` (T-33, new) | create | `device_id`, `username`, `secret_ciphertext bytea`, `nonce`, `key_ref`, `rotated_at` — never in a slice, a log or an audit row (same class as device credentials, `0001_tables.sql:199` secret-key guard) | INSERT, UPDATE; SELECT only for the supervisor path (design review) | yes | security review |
| `session_audio_intervals` (T-34, new) | create | `session_id`, `seq`, `mic_device_id`, `role`, `from_media_ms`, `to_media_ms`, `from_at`, `to_at`, `switched_by`, `reason` (START/MANUAL/STOP) | INSERT, UPDATE of `to_*` on the open row only | no | R-3 |
| `recording_fragments` (T-35, new) | create | `session_id`, `track_id`, `seq`, `byte_offset`, `byte_length`, `media_start_ms`, `media_duration_ms`, `sha256`, `chain_hash`, `durable_at`; batched inserts (about 1 row/s/camera, hypothesis for 1-2 s fragments) | INSERT only | no | NM-04 |
| `transcript_chunks` (T-36, new) | create | `session_id`, `seq`, `audio_from_ms`, `audio_to_ms`, `status`, `segments jsonb`, `embedding_ref`, `model_id`, `computed_at` | INSERT, UPDATE (status) | no | NM-06 |
| `transcripts` (T-37, new) | create | `evidence_id`, `json_sha256`, `srt_sha256`, `vtt_sha256`, `model jsonb`, `diarization jsonb`, `labels_status`, `created_at` | INSERT only | no | R-5 |
| `transcript_revisions` (T-38, new) | create | `evidence_id`, `revision_no`, `parent_sha256`, `sha256`, `author_id`, `reason`, `signature`, `created_at` | INSERT only | no | R-5 |
| `sealing_jobs` (T-39, new) | create | `session_id`, `step`, `status`, `progress`, `eta_ms`, `attempt`, `checkpoint jsonb`, `started_at`, `updated_at`, `error_code` | INSERT, UPDATE | no | NM-07 |
| `permissions`, `role_permissions` | data | `CAPTURE_CONFIG` (+ `TRANSCRIPT_REVISE`) rows and grants, in 0004 for live databases and in the seed for new ones | read only | seeded | F-15 |
| `schema_meta` | data | version 2, `dbc-3` | read only | – | `meta.ts:20-29` |

Seed/reset impact: the seed writes the new permission rows, a default `capture_config` row and the v2 (or v1) dataset (`db/seed/seed.ts:197`, `seed/dataset.ts:57-62`); the reset carries `capture_config`, `capture_devices`, `capture_device_credentials` as kept tables (`kept-tables.ts:63-70`) and must refuse while real sealed packages exist on disk, or must leave evidence rows and files untouched (OD-19). The bulk fixture (`db/fixtures/*`) builds v2 recordings.

---

## 7. Test impact

### 7.1 Method and counts

Counts are files whose text names a changing fact (an upper bound; not every file will fail). Command: `find packages/shared/test apps/core-server/src apps/core-server/test apps/core-web/src apps/mobile/src -name '*.test.ts*'` = 630 files (shared 70, core-server 279, core-web 111, mobile 170; matches F-32), then `/usr/bin/grep -lE` per pattern.

| Category | Pattern (abridged) | Files | By layer |
|---|---|--:|---|
| A. Audio model, finalization steps, manifest/signature | `AUDIO-02`, `MIC 2`, `MIC_2`, `resetClip`, `micLevels`, `never merged`, `SYS-003`, `FINALIZATION_ORDER`, `FinalizationStep`, `finalization.steps`, `SIMULATED-SHA256`, `computeManifestHash`, `TRACK_ORDER`, `evidence-manifest`, `Two independent` | 104 | shared 25, core-server 20, core-web 27, mobile 32 |
| B. Operation count 75 | `toHaveLength(75)`, `75 operations`, `toBe(75)` | 14 | shared 5, core-server 7, core-web 2 |
| C. Replicated slice count 28 | `toHaveLength(28)`, `28 slices`, ... | 18 | shared 4, core-server 14 |
| D. Schema version, contract revision, table inventory, `evidence_tracks` | `DB_SCHEMA_VERSION`, `schema_version`, `dbc-2`, `schemaVersion`, `30 tables`, `evidence_tracks` | 31 | shared 2, core-server 27, core-web 2 |
| S. Static guard tests (file lists and forbidden imports) | `static*.test.ts` | 21 | core-server 21 |
| Union | – | 165 | shared 29, core-server 73, core-web 31, mobile 32 |

### 7.2 Lists

- A, shared (`packages/shared/test/`): api-domain-operations, api-registry, api-schemas, api-state-examples, api-state-slices, audio, demo-evidence, hash-chain, i18n, live-source-atomicity, live-source-bindings, live-source-react, live-source-replica, live-source-session, live-source-simulated-isolation, realtime-live-socket, session-machine, sim-api, sim-contract, sim-demo-data-alignment, sim-determinism, sim-faults-scenarios, sim-gap-closure, sim-selector-stability, sim-store.
- A, core-server: `src/db/fixtures/__tests__/{audit-details,bulk-fixture.db}`, `src/db/mapping/__tests__/to-rows`, `src/modules/alerts/__tests__/{alerts.db,routes}`, `src/modules/demo/__tests__/{faults.db,routes}`, `src/modules/devices/__tests__/{devices.db,effects.db,routes,static,status}`, `src/modules/evidence/__tests__/{bulk.db,commands.db,immutability.db,reads.db,routes}`, `test/acceptance/{contract,rbac-matrix}`, `test/db/constraints.db`.
- A, core-web (`apps/core-web/src/`): `components/composed/__tests__/{dbfs-meter,session-timeline,stepper}`, `components/media/__tests__/camera-feed`, `features/dashboard/__tests__/dashboard`, `features/devices/__tests__/devices-page`, `features/evidence/__tests__/{cf-web-custody-media,efix-integrity-metadata,evidence-integrity,evidence-media}`, `features/security-audit/__tests__/security-audit`, `features/session-monitor/__tests__/session-monitor`, `features/session-new/__tests__/session-new-model`, `features/system/__tests__/{system-model,system-page}`, `motion/__tests__/debug-overlay`, `test/{integrity-checks,live-dashboard-devices,live-dashboard-page,live-devices-clip,live-devices-commands,live-efix-evidence,live-evidence-verify,live-meter-clip-reset,live-session-monitor-panels,live-shell-notices,live-system-demo}`.
- A, mobile (`apps/mobile/src/features/` unless noted): dashboard/{dashboard-screen,home-model}, devices/{devices-live-static,devices-model,devices-screen,live-devices-sites}, evidence/{evidence-detail,evidence-model,live-evidence-export,live-evidence-metadata-record,live-evidence-verify,play-sheet}, session-finalizing/{finalizing.model,session-finalizing-screen}, session-live/{live-session-live-link,session-live-screen}, session-new/{live-session-new-sites,precheck,session-new-model,session-new-screen}, session-recovery/{live-recovery-restart,live-recovery-sites,recovery.model,session-recovery-screen}, session-summary/{live-summary-sites,session-summary-screen,summary.model}, settings/{live-settings-sites,settings-live-static,settings-model,settings-screen}, `runtime/use-audio-shared-values`.
- B: shared api-openapi-scope, api-registry, api-state-examples, client-types, openapi; core-server `src/modules/rbac/__tests__/matrix.db`, `src/plugins/permission-guard/__tests__/{access-rules,decision,guard,matrix}`, `test/acceptance/{contract,rbac-matrix}`; core-web `src/test/live-api-reference-{document,page}`.
- C: shared api-realtime, api-state-slices, live-source-replica, realtime-live-socket; core-server `src/db/mapping/__tests__/{round-trip,to-rows}`, `src/engine/__tests__/{delta,rehydrate,restart.db}`, `src/modules/devices/__tests__/status`, `src/modules/sessions/__tests__/routes`, `src/realtime/__tests__/{first-contact.db,hub.lifetime,messages,state.db}`, `test/acceptance/shared-state`, `test/db/{contract-inventory,migrate.db}`.
- D: shared api-state-slices, sim-store; core-server `src/core/__tests__/core-plugin`, `src/db/fixtures/__tests__/{build,bulk-fixture.db}`, `src/db/mapping/__tests__/to-rows`, `src/db/reset/__tests__/{cli.db,reset-failures.db}`, `src/db/seed/__tests__/{seed-order,seed.db}`, `src/db/store/__tests__/write-through.db`, `src/engine/__tests__/{commands.db,recording.db,restart.db,ring}`, `src/modules/evidence/__tests__/{bulk.db,commands.db,consistency.db,immutability.db,reads.db}`, `test/acceptance/contract`, `test/db/{boot-checks.db,catalog.db,commands.db,commands,constraints.db,contract-inventory,migrate.db,privileges.db}`; core-web `src/test/live-{security-audit,system}-export`.
- S (relevant ones to amend when their folder changes): devices, evidence, sessions, storage, system, network-time, engine, realtime, demo, permission-guard, db/mapping, db/reset, db/fixtures (`apps/core-server/src/**/__tests__/static.test.ts`); new folders (`capture/`, `modules/capture-config/`, `modules/evidence-media/`) need their own static rule.

### 7.3 New test layers

| Layer | What it proves | Fixtures / tools (candidates) | Gate |
|---|---|---|---|
| Worker integration | Ingest of 2 fake RTSP streams over TCP + 2 fake audio inputs -> 2 playable fMP4 files; running hash equals a re-read hash; fragment checkpoints contiguous; switch keeps one continuous audio timeline | NM-14: FFmpeg `lavfi` sources -> RTSP server; virtual/file audio sources | M3 |
| AV sync | Test signal flash (video luma spike) and beep (audio onset) emitted at the same instant land within ±40 ms (one frame at 25 fps) in each file; also measured across a mic switch | Synthetic flash+beep generator; analyser over the decoded file; on hardware the REC indicator/relay as flash source (hypothesis) | M3, M5 |
| Crash and resume | Kill the worker / the server / power at each recording phase and each sealing step; RECOVERY resumes and the final hashes equal an uninterrupted run; a truncated last fragment is detected and excluded | Fault injection hooks in the supervisor; `kill -9` harness | M7 |
| STT benchmark harness | RTF, peak RAM, WER, label accuracy per model size while capture runs; no dropped capture fragments under STT load | NM-13; Indonesian sample with a hand-checked reference (D226) | M1, M6 |
| Contract / DB | Registry 88 ops, OpenAPI 0.3.0 drift, migration 0004/0005 on a copy of each lane DB, `rbac.matrix` boot | Existing contract/db tooling (`test/db/*`, `test/acceptance/*`) | M2 |
| Device e2e | Web (agent-browser), tablet and phone (emulators; Maestro used before, `README.md:475`) against a Core with the fake worker, then with the target camera/mics: selector edit + audit, start, switch from each client, warning on silence, stop, sealing progress on all clients, playback, export | Lanes 4420-4423 as today; physical devices need OD-13 | M4, M5, M8 |

---

## 8. Proposed phase sequence and open decisions

### 8.1 Milestones

| M | Content | Depends on | Verification gate |
|---|---|---|---|
| M0 | Blueprint and specs: resolve OD-01..OD-21 that block design; contract C2 (ops 76-88), `dbc-3`; P25 waiver; security design review (camera credentials, signer, media streaming) | user approval | BLUEPRINT_APPROVAL; specs reviewed |
| M1 | Spikes (parallel with late M0): fMP4 + running hash from a fake RTSP source with host FFmpeg; GStreamer vs FFmpeg pick; ONVIF discovery/NTP against the target camera if available; STT benchmark on the M5 (needs model-download permission, D226) | M0 decisions OD-05/06/20 | Report: playable-while-growing file, hash re-read equality, crash truncation behaviour, AV ±40 ms on fake source, STT RTF with margin under capture load |
| M2 | Contract + DB foundation + Simulated-mode parity: SH-01..SH-23, CS-12, CS-14, CS-16..CS-20, CS-24; simulator produces v2 shapes (single audio, switch, new steps, transcript stub) | M0 | shared/core-server/web/mobile suites green; OpenAPI drift; migrate 0004/0005 on four lane DBs; `rbac.matrix` boot passes |
| M3 | Capture worker + supervisor + IPC with fake devices: NM-02, NM-03, NM-04, NM-14; engine INTERNAL actions (CS-04) | M1, M2 | Worker integration + AV sync + worker-crash tests |
| M4 | Real device adapters + selector: NM-01, NM-09; WB-05, WB-07, MB-08, MB-09; CS-06, CS-11 | M3 | Device e2e on target hardware; config audit rows; PoE cycle |
| M5 | Manual mic failover end to end: NM-10; WB-01, MB-03; intervals in custody | M3 (+ M4 for real mics) | Switch from web/tablet/phone during recording; gap measurement; intervals + audit; warning, never auto-switch |
| M6 | Transcript pipeline: NM-06, NM-13; incremental during recording | M1 benchmark, M3 PCM tap | No capture drop under STT load; WER sample; label accuracy; chunk resume after crash |
| M7 | Sealing v2 + package + signer + encryption + RECOVERY: NM-05, NM-07, NM-08; SH-06, CS-04, MB-04, MB-06, WB-01 modal | M3, M6 | Crash at every step resumes; v2 verify PASS server + clients; tamper of one fragment fails exactly that fragment |
| M8 | Playback, export, composite: NM-11, NM-12; WB-04, MB-07 | M7 | Playback e2e on all clients; export verifies at the destination; composite marked derived |
| M9 | Hardening and release: benchmark re-run on the chosen Core hardware (D226), full regression, docs (DOC-01..05) | all | verifier -> security-review -> test-expert -> senior-code-reviewer |

### 8.2 Open decisions

| ID | Decision | Options | Blocks |
|---|---|---|---|
| OD-01 | Track ID model | T1 / T2 (5.1) | M2 |
| OD-02 | Existing demo evidence | L1 legacy verify / L2 reseed (5.9) | M2 |
| OD-03 | Encryption scheme and what the whole-file hash covers | per-fragment sidecar / CENC in-file / volume + seal pass; hash over plaintext or ciphertext | M3, M7 |
| OD-04 | Signer and key provisioning | TPM ECDSA P-256 / software Ed25519 / PKCS#11; certificate chain | M7 |
| OD-05 | Camera topology | one dual-lens camera (current model, A-2) / two PoE cameras (D219 text) | M1, M4 |
| OD-06 | Microphone transport and audio codec | analog via the Core's inputs / USB / network; AAC-LC 48 kHz / lossless | M1, M3 |
| OD-07 | PoE control | Core's own PoE board / external managed switch (which model, SNMP or API) | M4 |
| OD-08 | Crash during RECORDING | seal the partial recording flagged "interrupted" / keep INCOMPLETE as today (`session-machine.ts:1028`) | M7 |
| OD-09 | Who may switch the mic; hot standby confirmation | Q16 (any SESSION_START) / session holder + SUPERVISOR (D221 proposed defaults) | M2, M5 |
| OD-10 | Who may edit the selector, and when | `CAPTURE_CONFIG` (SUPERVISOR + TECHNICIAN) / `DEVICE_MANAGE` (TECHNICIAN); idle only | M2 |
| OD-11 | Warning thresholds | silence level (dBFS) and duration; disconnect debounce | M5 |
| OD-12 | Live preview of real cameras on clients | WebRTC/LL-HLS via a media proxy / periodic JPEG / none (demo loop stays) | M4 |
| OD-13 | Physical tablets/phones reaching the Core | keep loopback (emulators only) / LAN listener + TLS + origin rules (changes SR-01) | M4 e2e on devices |
| OD-14 | P25 freeze waiver | allow edits of `app.ts`, `index.ts`, `config.ts` for the new module, seam and config keys | M2 |
| OD-15 | Transcript revisions | permission, who signs (operator vs Core key), review flow | M7 |
| OD-16 | Export form | encrypted package + wrapped key / decrypted copy; composite layout and codec | M8 |
| OD-17 | Simulated-mode parity | in-app simulator emulates v2 (recommended for demo and tests) / Live-only v2; offline OpenAPI bump | M2 |
| OD-18 | Demo controls in real mode | disable / limit to non-hardware faults | M2 |
| OD-19 | Reset vs real evidence on disk | block reset when real packages exist / reset keeps evidence rows and files / separate demo database | M2 |
| OD-20 | STT model download and licences; language set | user permission (D226); Indonesian only or more | M1 |
| OD-21 | Legal acceptance of fragmented MP4 as "one whole file" | fMP4 / fallback segments + lossless concatenation at sealing (D224) | M1 |

---

## 9. Risks and mitigations

| Risk | Trigger | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| CPU contention: STT starves capture | STT on the same CPU as ingest/mux/encryption; a dropped or late fragment | Medium (hypothesis: remux-only video is light, STT is heavy) | High (evidence gap) | Capture at higher priority/P-cores, STT at background QoS/E-cores with a bounded thread count; capture never decodes video; admission rule: STT may lag, capture may not; M1/M6 gate measures drops under load |
| Sealing waits long for STT backlog | STT slower than real time; long sessions | Medium | Medium (room blocked, accepted by D223) | Pick the largest model that stays faster than real time with margin (D226); ETA on all clients; incremental checkpoints so a restart does not redo chunks |
| Fragmented MP4 not accepted, or players mishandle it | Legal review or a player rejects fMP4 | Low-Medium | High | OD-21 early; keep the segment + lossless concatenation fallback designed (one extra pass, hash in the same pass, D224); test playback on the target players in M1 |
| Clock sync and drift between cameras, audio and Core | Cameras not on the Core's NTP; audio clock drift vs RTP clocks over hours | Medium | High (AV sync, interval times) | Core serves NTP; set via ONVIF; record offsets at start/stop in the manifest; mux on a common timeline from RTCP sender reports (general knowledge, verify); AV ±40 ms test at start and after 1-2 h |
| Storage throughput and capacity | 2 × 9 Mbit/s video (F-22) ≈ 8 GB/h (arithmetic: 18 Mbit/s × 3,600 s / 8) plus audio, encryption, fsync | Low (throughput) / Medium (capacity) | Medium | Bounded fsync cadence per fragment; free-space precheck from real volume telemetry (STORAGE_LOW/FULL exist); retention policy |
| Legal acceptance of a derived transcript | Transcript treated as evidence content | Medium | Medium | Manifest states model/params/source audio; verification checks hashes only (D222); corrections only as signed revisions; "labels unavailable" flag (D226) |
| Hardware unknown | Core hardware differs from the M5 baseline (D226: x86 may be slower per core) | High | Medium | Benchmark harness portable; re-run on the chosen hardware before release (M9); model size configurable |
| Real-device reach | SR-01 loopback-only listener (F-26) | High | High for device e2e | OD-13 in M0; until decided, e2e on emulators only |
| Process rules slow the work | P25 freeze, 21 static guards, pinned counts (75 ops, 28 slices) | High | Medium | OD-14 waiver at M0; new modules with their own static rules; update pinned counts in one contract row |
| Camera credentials leak | Stored or logged in clear; sent to clients | Low | High | Encrypted table (T-33), write-only API, audit details without secrets, secret-key CHECK guard, secret sweep test as in this task |
| Mobile streaming of large files | expo-video + bearer header on long recordings | Medium | Medium | `VideoSource.headers` exists in SDK 57 (F-31); verify Range support and memory in M8; fallback short-lived signed URL |
| Simulated/Live divergence | v2 only in Live; simulator stays v1 | Medium | Medium | OD-17: simulated driver produces v2 shapes in M2 so clients and tests develop without hardware |
| Demo reset deletes records of real evidence | Reset rebuilds evidence rows from the seed (F-28) | Medium | High | OD-19 before M2; boot/reset refuse when real packages exist |

---

## 10. Evidence log (read-only commands)

| Purpose | Command (abridged) | Result used in |
|---|---|---|
| Decisions | `sed -n '225,232p' decisions/decisions.md`; `grep '^\| D202 '` | §1.2, F-10 |
| No real ingest | `/usr/bin/grep -rniE "rtsp\|onvif\|child_process\|spawn\(\|ffmpeg\|gstreamer" apps/core-server/src` | F-01 |
| Static guards | `find apps/core-server/src -path '*__tests__*' -name 'static*.test.ts'` (21) | F-03, §7 |
| Call graph | `graft callers createEvidenceItem --depth all`, `verifyEvidenceItem`, `buildItemIntegrity`, `resetClipTransition`, `isSessionActive`; `graft skeleton` of `sim/session-machine.ts`, `sim/evidence.ts`, `sim/devices.ts`, `sim/audio.ts`, `sim/engine.ts` | SH-05..SH-08, CS-20 (callers include `db/fixtures/recordings.ts:368`, `scripts/gen-demo-evidence.ts:304-341`, mobile `evidence-model.ts:282-313`) |
| Site counts | helper over `find ... -name '*.ts' -o -name '*.tsx'` + `/usr/bin/grep -lE` per pattern | §3, §7 |
| Demo manifest | `python3` walk of `assets/demo-evidence/SESSION-SES-20260929-0011/manifest.json` | F-23, §5.9 |
| Host tools | `ffmpeg -version`, `-demuxers`, `-h muxer=mp4`, `-filters`, `-buildconf`; `which gst-launch-1.0 whisper-cli maestro` | F-29 |
| Versions | `apps/mobile/package.json` (expo, expo-video); root `package.json` (workspaces, Node `>=26.8.2 <27`) | F-31, NM-02 |

External sources (technology candidates only; no project data was sent):
- GStreamer `isofmp4mux` (gst-plugins-rs fmp4): https://gstreamer.freedesktop.org/documentation/fmp4/isofmp4mux.html
- sherpa-onnx offline speaker diarization (`num_clusters`): https://github.com/k2-fsa/sherpa-onnx/blob/master/python-api-examples/offline-speaker-diarization.py
- expo-video `VideoSource.headers` (SDK 57): https://docs.expo.dev/versions/latest/sdk/video/ (an older issue reported it missing: https://github.com/expo/expo/issues/29436)
- TPM 2.0 EdDSA in the algorithm registry; limited platform support: https://trustedcomputinggroup.org/wp-content/uploads/TCG-_Algorithm_Registry_r1p32_pub.pdf, https://trustedcomputinggroup.org/wp-content/uploads/TPM-2.0-1.83-Part-2-Structures.pdf

No implementation plan (`masterplan/02_plan.md`) was written: this is pre-planning research for the next task, which owns its own plan.

---
*Generated: 2026-10-06 17:48 WIB*
*Last Updated: 2026-10-06 17:48 WIB*
