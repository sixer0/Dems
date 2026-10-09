---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: data-analyst
blueprint_row: 34
milestone: M0
class: B (GA:OD-09, OD-10, OD-12, OD-13)
tier: 1
type: mechanism-spec (client UX: web, tablet, phone)
status: draft-for-M0-gate
confidence: >-
  HIGH for the per-flow client states, operation/slice/audit mapping, gate and error behaviour
  (mechanical over masterplan/03_api_contract.md, 05_capture_architecture_spec.md and
  07_transcript_spec.md, decisions D4 and the errata-applied register research/03_analysis.md);
  MEDIUM for the exact sealing step list because masterplan/06_evidence_package_spec.md (row 32) owns
  it and is not yet written (this spec binds to the op-83 step envelope and the SH-01 enum, flagged in
  section 9).
source_structured_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/02_structured.md
source_translated_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/01_translated.md
source_analysis: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/research/03_analysis.md
source_phase_spec: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/masterplan/01_specs.md
source_api_contract: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/masterplan/03_api_contract.md
source_capture_spec: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/masterplan/05_capture_architecture_spec.md
source_transcript_spec: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/masterplan/07_transcript_spec.md
source_predecessor_drift: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/research/11_next_phase_drift_check.md
decisions: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/decisions/decisions.md (D4, D8, D10, D12; rev 2.3 client delta: D72(k), D73-D78, D80, D81)
last_updated: 2026-10-09 (row 125, PE-125-01..19: client delta for R-9..R-11 — flows 9-13, gated controls G13-G18, sections 8b-8g, 14, 15; D73-D81); 2026-10-09 (status sweep PE-R8-12..13: §8a Flow 8 CONFIRMED by D24, Q-STT-CFG answer (a); status wording only); 2026-10-08 (RV-SPEC: D19(b) recording-duration refinement; §8a Flow 8 STT configuration added as a proposal, R-8/D20; 2026-10-07 row-35 cross-refs SEC35-12/13)
---

# Client UX Spec — web, tablet and phone (blueprint row 34, M0)

> **Authority in force.** Blueprint row 34 (`identification/02_structured.md:214`) is the hard gate:
> *"Each flow defined for all 3 clients; P-01..P-16 each marked applied or not applicable with reason;
> every gated control has the 'Checking your permissions...' state."* Decisions: **D4 OD-09** (hot
> standby; the switch toggle is for the session holder with `SESSION_START` + SUPERVISOR; web-only
> recording stays "no"), **D4 OD-10** (`CAPTURE_CONFIG` for SUPERVISOR + TECHNICIAN; selector editable
> ONLY while idle), **D4 OD-12** (NO live preview of real cameras in this phase; the demo loop stays),
> **D4 OD-13** (loopback only; emulators for tests; physical devices are class C), **D4 OD-11**
> (`MIC_SILENT` warning, never an auto-switch) and **D4 OD-15** (`TRANSCRIPT_REVISE` for INVESTIGATOR
> + SUPERVISOR; Core key signs; no approval flow; sealed original immutable).
>
> This spec owns the client presentation only. The API contract is method/path/access/audit/slice from
> `masterplan/03_api_contract.md` (row 29); the mic-switch mechanics are
> `masterplan/05_capture_architecture_spec.md` (row 31) §E; the transcript data shape is
> `masterplan/07_transcript_spec.md` (row 33); the sealing step list and checkpoints are owned by
> `masterplan/06_evidence_package_spec.md` (row 32 — not yet written; this spec binds to it, section 9).
> No file outside this task folder is edited by this row; M4/M5/M7/M8 implement (red line).
>
> **Rev 2.3 delta (blueprint row 125, `identification/02_structured.md:377`; erratum PE-125-01).**
> Flows 9-13 (sections 8b-8g) add the client side of R-9 (camera search, connect flow), R-10
> (no-device notifications) and R-11 (development sources). Authority: `specs` §B.2, the contract
> delta `C3 §2.6, §3.1, §5.4` (row 121), `06_evidence_package_spec.md` §B.12 / §D.1 (row 124) and
> the controller rulings **D80** and **D81**, which are binding and override the row text where they
> differ (a camera password is entered on the **web console only**, D80(3)). Changed cells of the
> existing sections carry a `PE-125-nn` mark; the totals are restated once, in section 13.1.

**Citation short forms.**

| Short | Source |
|---|---|
| `C3 §x`, `op N` | `masterplan/03_api_contract.md` (row 29): operation N |
| `capture-spec §x` | `masterplan/05_capture_architecture_spec.md` (row 31) |
| `transcript-spec §x` | `masterplan/07_transcript_spec.md` (row 33) |
| `specs §x` / `R-n` / `C-Nn` | `masterplan/01_specs.md` (row 28) |
| `register §x` / `WB-nn`/`MB-nn`/`SH-nn`/`CS-nn` | `research/03_analysis.md` (row 6) |
| `drift §2.1 P-nn` / `drift §6 E-nn` | `docs/2026-10-04_dems_backend_rbac_pairing/research/11_next_phase_drift_check.md` |
| `Dn` / `OD-nn` | `decisions/decisions.md` (D4 = approved gate answers) |
| `file:line` | the existing client source at HEAD (read-only input) |

---

## 0. Gate answers and the standing client rules

| Gate (D4) | Answer | How this UX spec applies it |
|---|---|---|
| **OD-09** | hot standby; the mic toggle is for the **session holder** with `SESSION_START` **+ SUPERVISOR**; web-only recording stays "no" | Flow 2: the toggle is enabled only for the session holder or a supervisor (op 81 access = `PERMISSION SESSION_START` + the new `SESSION_HOLDER` condition, C3 §2.2); web still needs a paired tablet to record |
| **OD-10** | new `CAPTURE_CONFIG` for SUPERVISOR + TECHNICIAN, editable **only while idle** | Flow 1: reads open to every role (`AUTHENTICATED`); the edit controls are gated by `CAPTURE_CONFIG` and additionally locked while a session is open (`409 CAPTURE_CONFIG_LOCKED`, C3 §4) |
| **OD-11** | below −50 dBFS for 10 s → `MIC_SILENT` warning; disconnect debounce 2 s; contract constants | Flow 2: the banner is `WARNING` severity and never switches the source; the 2 s debounce is presented as a pending state |
| **OD-12** | no live preview of real cameras in this phase | Flows 1 and 5: the monitor keeps the demo loop; the selector shows device state text, never a decoded frame |
| **OD-13** | keep loopback; LAN is class C (C-5) | Flow 5 and section 7: signed media URLs are loopback (`127.0.0.1`), tests run on emulators; physical devices change the host only |

**Standing client rules reused (all verified live by row 1 and the B10 rows).**

| Rule | Source of truth | Where used |
|---|---|---|
| Every gated control shows **"Checking your permissions..."** while the role/link is unresolved — never a silent hide, never an instant enable | `drift §2.1 P-13` (DEC-FXR-M-3); `drift §6 E-16`; `specs C-N12` | every flow (section 5 inventory) |
| Web gated reads "wait for the link" | `apps/core-web/src/lib/core-queries.ts:65-77` (`useCoreSignedIn`, `useCoreReadBase`, `LiveLinkState.ONLINE`) | flows 1, 3, 5, 6 |
| Web one query factory per Core key, gate inside the factory; presenter first, then the page record | `apps/core-web/src/lib/core-queries.ts:1-23,106-151` | flows 1, 3, 5, 6 (WB-11) |
| Web device commands go through one gate (`devices-panel`, `device-menu`) | `apps/core-web/src/lib/device-command-gate.ts:50-61,71-84` | flow 1 (PoE cycle) |
| Web one Blob-URL download, revoke ≥ 1 s | `apps/core-web/src/lib/download.ts:15,26-41` | flow 5 (export/download) |
| Mobile forward-only time from Core instants (`coreClockOf`); the larger value is drawn **while the Core reports RECORDING**; once the Core reports the stop, the Core's recorded duration wins (one bounded correction; ruling D19(b), AU1-2) | `apps/mobile/src/runtime/recording-elapsed.ts:1-21,75,128-144`; `apps/mobile/src/runtime/core-clock.ts:52-94,104-106` | flows 2, 3, 4, 7 |
| Mobile tablet list rows use a constant card border (`SelectionGlow` always mounted, React-drawn) | `apps/mobile/src/components/composed/selection-glow.tsx:1-21,40,43,45-56` | flows 1, 5, 6 |
| Mobile in-place hand-offs, `animation: 'none'` on `finalizing`/`summary` | `apps/mobile/src/features/session-live/monitor-handoff.ts:1-29`; `apps/mobile/src/features/session-summary/summary-handoff.ts`; `apps/mobile/src/navigation/stacks.tsx:59` | flows 3, 4, 7 |
| Reanimated only for removable overlays; final UI state drawn by React (lost-update family) | `selection-glow.tsx:1-21`; `drift §6 E-13`; risk MB-04 **High** | flows 1, 3, 4 |
| Session states and the v1 step enum | `packages/shared/src/domain/enums.ts:14-25,223-239` | flows 3, 4, 7 |
| Contract constants live in `@dems/shared/api` and are imported, not copied | `drift §2.1 P-02`; `specs C-N9`; `C3 §7` (`packages/shared/src/api/capture.ts`) | flows 1, 2, 3 |

**Rev 2.3 rulings applied by flows 9-13 (erratum PE-125-02).**

| Ruling | Answer | How this UX spec applies it |
|---|---|---|
| **D80(3)**, D81 | a camera user name and password is entered on the **web console only**; the server refuses operations 89, 95, 96 from a tablet or phone session (`WEB_CONSOLE_SESSION`) | Flow 10 exists on the web console; tablet and phone show Connect disabled with "Connect this camera from the web console." (§8d.1, §8d.10) |
| **D80(4)** | searching is allowed while a session is open; every connect step answers `409 CAPTURE_CONFIG_LOCKED` | Flow 9 has no locked state; in flow 10 the lock is a **disabled, explained state**, never an error toast (§8d.5) |
| **D80(2)** | an operator without `CAPTURE_CONFIG` sees the outcome of the pre-check search as a notification only | §8e.3: no list, no Connect, Search again disabled with the role sentence |
| **D80(5)** | microphones are local inputs; "Search again" for a microphone re-reads them (op 97); no network microphone discovery | Flow 13 (§8g.1) |
| **D80(6)**, **D81**, D72(k) | both cameras or both microphones unreachable = blocked; one camera or the standby microphone unreachable = warning, degraded session allowed; the selected ACTIVE microphone unreachable = blocked until the operator makes a reachable microphone active, then degraded with a warning; no camera connected at session start = the session FAULTS with `NO_CAMERA_CONNECTED` and nothing claims to record | §8g.3 (start rule), §8e.2 (situation C) |
| **D80(7)** | before row 84 an adoption with a password answers `503 CREDENTIAL_STORE_NOT_READY`; development sources without a password are adoptable | §8d.5, worded for an operator |
| **D80(9)**, D81 | the development mark is a per-source class and covers every package whose sources are not production devices | Flow 12: one badge on every surface, drawn from the Core's data (§8f) |
| **D80(10)** | typed-address entry is not in scope | no address field anywhere (§8c.1) |
| **D80(11)** | a local device that cannot be opened is never silently replaced by a fake; no frame or audio excerpt of a local-device recording in `docs/` | §8f.3 |

---

## 1. Flow catalogue — operations, slices, audit

Each flow below maps to exactly the operations, realtime slices and audit types of row 29. `read` =
`NONE-R` (no audit row); `denial` = `ACCESS_DENIED` on a refused call (`C3 §2.1-§2.2`).

| # | Flow | Requirement | Operations (row 29) | Realtime slices | Audit types | D4 |
|--:|---|---|---|---|---|---|
| 1 | Device selector | R-1 | 76 `getCaptureConfig`, 77 `getCaptureDevices`, 78 `updateCaptureConfig`, 79 `setCaptureCameraSource`, 80 `setPrimaryMic`; modified 44/45/46/47; existing 48 (PoE, camera) | `captureConfig` (29), `captureDevices` (30); re-keyed `meters.audio`; `session` (44/45 read shapes) | `CAPTURE_CONFIG_CHANGED` (78/79/80); `CAMERA_POE_CYCLED` (48); denial `ACCESS_DENIED` | OD-10, OD-12, OD-22 |
| 2 | Mic toggle + warning | R-3 | 81 `switchAudioSource`, 82 `listAudioSourceIntervals`; modified 44 `getDeviceHealth`, 45 `getAudioStatus` | `session` (`audioSource`); re-keyed `meters.audio` (`MIC-01`/`MIC-02` + `activeInputId`) | `AUDIO_SOURCE_SWITCHED` (81, carries sending device id); `MIC_SILENT` (warning raiser); denial `ACCESS_DENIED` | OD-09, OD-11 |
| 3 | Sealing progress + ETA | R-6 | 83 `getSealingProgress`; modified 27 `getCurrentSession` | `session` (`finalization` v2 steps) | `EVIDENCE_SEALED` once at seal; denial `ACCESS_DENIED` | OD-08 |
| 4 | Resumed sealing after crash/restart | R-6, OD-08 | 83 (re-read, `resumed: true`); modified 38 `listSessionHistory` (`interrupted`), modified 27, modified 39 `listEvidence` (v2, `interrupted`) | `session` (`recovery` + `finalization`) | `RECOVERY_STARTED`, `RECOVERY_COMPLETED`, `EVIDENCE_SEALED` (unchanged types, C3 §5.3) | OD-08 |
| 5 | Playback with audio-source band | R-3/R-4 | 82 `listAudioSourceIntervals`; 88 `createEvidenceMediaSession`; modified 39, 40 `getEvidence`, 41 `verifyEvidence`; existing 42 `exportEvidence` + 87 `getEvidenceExportJob` | `evidence` (`mediaRef`/`transcript`/`exportJob`) | `EVIDENCE_MEDIA_SERVED` (88); `EVIDENCE_EXPORTED`/`EVIDENCE_EXPORT_FAILED` (42/87); denial `ACCESS_DENIED`/`EXPORT_DENIED` | OD-12, OD-13, OD-16 |
| 6 | Transcript pane | R-5 | 84 `getTranscript`, 85 `createTranscriptRevision`, 86 `listTranscriptRevisions` | `evidence` (transcript summary) | `TRANSCRIPT_REVISED` (85); denial `ACCESS_DENIED` | OD-15 |
| 7 | Session gating | R-6 | existing 24 `createSession` (`409 SESSION_ACTIVE`), existing 25 `startSession`, 27 `getCurrentSession` | `session` | `SESSION_ACTIVE` is a typed refusal, **no** audit row; denial `ACCESS_DENIED` | OD-08 |
| 8 | STT configuration menu (section 8a; restated here, **PE-125-03**) | R-8 | 90 `getSttConfig`, 91 save, 92 test connection (`C3 §2.5`) | none | `STT_CONFIG_CHANGED`; denial `ACCESS_DENIED` | D20, D24 |
| 9 | Search for cameras (section 8c) **PE-125-03** | R-9, R-10 | 93 `startCaptureDiscovery`, 94 `getCaptureDiscovery` | **none** for the list (owner session only); `alerts` for the outcome | `CAPTURE_DISCOVERY_SEARCHED`; denial `ACCESS_DENIED` | D73-D76, D80 |
| 10 | Connect a camera — web console only (section 8d) **PE-125-03** | R-9 | 95 `testCaptureCandidateConnection`, 96 `adoptCaptureCandidate`; then existing 78 / 79; later 89 | `captureDevices` (the adopted device); `captureConfig` (lock flag, assignment) | `CAPTURE_CONNECTION_TESTED`, `CAPTURE_CANDIDATE_ADOPTED`, `CAPTURE_CREDENTIAL_SET`; denial `ACCESS_DENIED` (`WEB_CONSOLE_ONLY`); a locked step writes no row | D76, D80(3), D80(4), D80(7), D81 |
| 11 | No-device notifications (section 8e) **PE-125-03** | R-10 | no new read; modified `beginPrecheck` / `retryPrecheck`; 93, 97 as the offered actions | `alerts`, `captureDevices`, `captureConfig`, `session` | `CAPTURE_DISCOVERY_SEARCHED` (A), `CAPTURE_DEVICE_UNREACHABLE` (B; C degraded), `FAULT_RAISED` (C) — all written by the Core | D72(h)(i)(k), D80(2), D80(6), D80(8) |
| 12 | Development sources: label and local-device rows (section 8f) **PE-125-03** | R-11 | reads 76, 77, 94, 27, 39 / 40, 41 | `captureConfig`, `captureDevices`, `session`, `evidence` | none of its own | D73, D74, D78(2), D80(9), D80(11), D81 |
| 13 | Microphones: Search again and the active-microphone rule (section 8g) **PE-125-03** | R-10 | 97 `rescanCaptureInputs`; modified `beginPrecheck` / `retryPrecheck`, existing `acknowledgePrecheckWarnings` | `captureDevices`, `session` | `CAPTURE_DISCOVERY_SEARCHED` (`scope: MIC_LOCAL`); `PRECHECK_BLOCKED` / `PRECHECK_PASSED` (existing) | D80(5), D80(6), D81 |

**Slices are additive and correctly named.** `captureConfig` and `captureDevices` are the two new
replicated slices (28 → 30); capture devices **never** reuse `AdminResource.DEVICE[S]` (E-04/P-06;
`C3 §6`, `C3 §9 N-2`). The `meters.audio` slice is re-keyed from `AUDIO-01`/`AUDIO-02` channels to
inputs `MIC-01`/`MIC-02` plus `activeInputId` (E-02; `C3 §6`; current shape
`packages/shared/src/api/state-slices.ts:375-395`).

---

## 2. Flow 1 — Device selector (R-1)

### 2.1 Trigger and entry state

| Item | Definition |
|---|---|
| Trigger | Operator opens Devices (web), Devices (tablet), Settings/Devices (phone) and enters the capture section |
| Entry state | Any session state; reads always allowed; edits allowed only when **no session is open** (OD-10) |
| Data read on entry | op 76 `getCaptureConfig`, op 77 `getCaptureDevices`; slice `captureConfig`/`captureDevices` |
| Preview | **None** (OD-12): state is text/icon only (`online`, `streamState: LIVE\|LOST`, `role`), because no real-camera preview exists in this phase; the Monitor keeps the demo loop (`specs §A.3`, `C3 §9 N-5`) |

### 2.2 Per-step states

| # | Step | State drawn | Source |
|--:|---|---|---|
| 1 | Reading config/devices | Loading skeleton; controls show "Checking your permissions..." (gated read) | 76/77; E-16 |
| 2 | Resolved, idle | Two camera rows (`VIDEO-01`,`VIDEO-02` → `CAM-01`/`CAM-02` or one dual-lens profile) and two mic rows (`MIC-01` PRIMARY, `MIC-02` STANDBY). **PE-125-04:** a camera row may name any registered camera, including one added by flow 10 (`CAM-NN`); a row whose line has `sourceClass: DEVELOPMENT` carries the "Development source" badge (flow 12) | 76; `C3 §2.4`, `§2.6` "Device shapes", `§3.1`; OD-05 |
| 3 | Edit affordance | Edit/enable only if `CAPTURE_CONFIG` and idle; otherwise the control is shown disabled with a reason sentence | OD-10; `C3 §2.2` note |
| 4 | Save camera source | Optimistic-free: the row shows a pending state until `captureConfig` republishes | 79; `C3 §2.3` |
| 5 | Save primary mic | The chosen mic becomes `PRIMARY`, the other `STANDBY` in the same republish | 80; `C3 §2.4` |
| 6 | Locked (attempted edit during a session) | `409 CAPTURE_CONFIG_LOCKED`; the control returns to the locked state with the message "The capture configuration cannot be changed while a session is open." and **no** audit row | `C3 §4`; OD-10 |

### 2.3 Operations, slices, audit

| Operation | Access (marker) | Slice published/read | Audit |
|---|---|---|---|
| 76 `getCaptureConfig` | `AUTHENTICATED` | reads `captureConfig` | `NONE-R` |
| 77 `getCaptureDevices` | `AUTHENTICATED` | reads `captureDevices` | `NONE-R` |
| 78 `updateCaptureConfig` | `PERMISSION CAPTURE_CONFIG` | publishes `captureConfig` | `CAPTURE_CONFIG_CHANGED` |
| 79 `setCaptureCameraSource` | `PERMISSION CAPTURE_CONFIG` | publishes `captureConfig` | `CAPTURE_CONFIG_CHANGED` |
| 80 `setPrimaryMic` | `PERMISSION CAPTURE_CONFIG` | publishes `captureConfig` | `CAPTURE_CONFIG_CHANGED` |
| 44 `getDeviceHealth` / 45 `getAudioStatus` / 46 `getVideoStatus` / 47 `getDeviceInventory` | existing | read re-keyed `mics`/`audio` shapes | unchanged |
| 48 `restartDevice` (camera = PoE cycle) | existing `DEVICE_MANAGE` | publishes `captureConfig` (gap marked) | `DEVICE_COMMAND` + `CAMERA_POE_CYCLED` |

### 2.4 Permissions and gated-control behaviour

| Control | Permission / condition | Checking state | Allowed | Refused / locked |
|---|---|---|---|---|
| G1 Selector edit (open/save) | `CAPTURE_CONFIG` (SUPERVISOR + TECHNICIAN) | "Checking your permissions..." until the role and link resolve | Editable when idle | Not permitted → disabled + "Requires the SUPERVISOR or TECHNICIAN role" (`403 NOT_PERMITTED`); open session → locked with the OD-10 sentence (`409 CAPTURE_CONFIG_LOCKED`) |
| G2 Camera-source edit | `CAPTURE_CONFIG` + idle | same | Assign a device to `VIDEO-01`/`VIDEO-02` | same two refusals; `404 NOT_FOUND` for an unknown device id |
| G3 Primary-mic edit | `CAPTURE_CONFIG` + idle | same | Set `MIC-01`/`MIC-02` PRIMARY | same; the other input becomes STANDBY |
| G9 Camera PoE cycle | `DEVICE_MANAGE` **and** the stream is `LOST` **and** not RECORDING | "Checking your permissions..." | Confirmed cycle (`{ confirm: true }`) | `409 CAMERA_NOT_LOST` when the stream is healthy; `409 RECORDING_ACTIVE` during recording (`C3 §4`; P-05) |

### 2.5 Error / empty / loading states

| Situation | Web | Tablet | Phone | Rule |
|---|---|---|---|---|
| Loading | Skeleton on the two panels; controls in Checking | Skeleton; controls in Checking | Skeleton; controls in Checking | E-16 |
| Not live / link down | "Waiting for the link" (never an instant enable) | Waiting-state row | Waiting-state row | `core-queries.ts:65-77`; P-13 |
| `403 NOT_PERMITTED` | Read-only selector; reason under the disabled edit | same | same | E-16 |
| `409 CAPTURE_CONFIG_LOCKED` | Locked banner + disabled edit | Locked banner | Locked banner | OD-10; `C3 §4` |
| `422 INVALID_INPUT` | Field-level message; no config change | same | same | `C3 §2.3` |
| `503 NOT_READY` (`details.reason: CAPTURE_NOT_READY`) | "Capture is not ready yet" with Retry (invalidates the key) | same | same | `C3 §4`; `core-queries.ts:149-151` |
| Empty device list | "No capture devices configured" + the action **Search for cameras** (G13, flow 9) **PE-125-04** | same | same | op 77 empty; R-10 AC-1 |
| `422 INVALID_INPUT` (`DEVELOPMENT_SOURCE_NOT_ALLOWED`) **PE-125-04** | Field message "This source can only be used in the development configuration."; no config change | same | same | `C3 §3.1` (78 / 79); R-11 AC-2 |
| `LOST` stream | Row shows LOST; PoE cycle (G9) offered only then | same | same | OD-22 |

### 2.6 Per-client definition

| Aspect | Web (`apps/core-web`) | Tablet (`apps/mobile`) | Phone (`apps/mobile`) |
|---|---|---|---|
| Surface | Devices page/drawer (WB-05), System entry (WB-07) | Devices screen (MB-08), Settings → capture (MB-09) | Settings → Devices (MB-09) |
| Read factory | New `captureConfigQueryOptions`/`captureDevicesQueryOptions` in `lib/core-queries.ts` (WB-11, E-17) | replicated slices via `useSim` | same |
| List rows | Device rows + kebab through `device-command-gate.ts` | Constant card border via `SelectionGlow` (`selection-glow.tsx:40`) | Compact rows; constant border |
| Edit affordance | Inline selects with a "Save" per field (ops 79/80) | Bottom sheet per field | Full-screen sheet per field |
| Source options **PE-125-04** | Every registered camera of op 77 (seeded or added by flow 10), each development source with the badge; never a row of the search list (a found camera is not selectable until it was added on the web console) | same options in the sheet | same |
| Demo loop | Monitor keeps the demo loop (OD-12) | same | same |

### 2.7 Forward-only rule

No timer is drawn here. The `locked` flag and `streamState` are snapshot values; a stale snapshot is
refreshed by the slice republish, never by a client-side countdown.

---

## 3. Flow 2 — Mic toggle + warning (R-3)

### 3.1 Trigger and entry state

| Item | Definition |
|---|---|
| Trigger | The session holder (or a supervisor) presses the mic toggle during `RECORDING`, or presses "switch to standby" on the `MIC_SILENT` banner |
| Entry state | A session in `RECORDING`; `AUDIO-01` carries the active mic; both inputs are fed (hot standby, OD-09) |
| Data read | slice `session.audioSource` (`activeInputId`, `standbyInputId`) + `meters.audio` (`MIC-01`/`MIC-02` levels + `activeInputId`) |
| Manual only | The Core never auto-switches (OD-11; `capture-spec §E.1`); the warning offers the operator the switch |

### 3.2 Per-step states

| # | Step | State drawn | Source |
|--:|---|---|---|
| 1 | Idle meters | Two input meters (`MIC-01`, `MIC-02`); the active one marked PRIMARY | `meters.audio`; E-02 |
| 2 | Toggle pressed | Confirmation step (web dialog; mobile confirm); "Checking your permissions..." resolves first | E-16; OD-09 |
| 3 | Pending | The toggle shows a pending state until op 81 answers with the new active/standby state | op 81; `C3 §2.3` |
| 4 | Switched | Active moves to the other input; one `AUDIO_SOURCE_SWITCHED` audit row; the interval is appended | op 81; `C3 §5.2` |
| 5 | Denied | `403 NOT_PERMITTED` (not the session holder and not a supervisor) → reason sentence, no state change | OD-09; `C3 §2.2` |
| 6 | Conflict | `409 AUDIO_SOURCE_CONFLICT` ("The requested microphone cannot become the active source.") | `C3 §4` |
| 7 | Not recording | `409 INVALID_STATE` when the session is not `RECORDING` | `C3 §4` |
| 8 | `MIC_SILENT` warning | Banner, severity WARNING: sustained level below −50 dBFS for 10 s; text names the silent input; a "switch to standby" action is offered but **never** taken automatically | OD-11; `C3 §5.2`; `capture-spec §E.1` |
| 9 | Disconnect debounce | While a mic drops, a 2 s debounce shows "Input interrupted — verifying" before any warning/fault is raised | OD-11; `capture-spec §E.1` |

### 3.3 Operations, slices, audit

| Operation | Access | Slice | Audit |
|---|---|---|---|
| 81 `switchAudioSource` | `PERMISSION SESSION_START` + `SESSION_HOLDER` | publishes `session`; updates `meters.audio.activeInputId` | `AUDIO_SOURCE_SWITCHED` (`fromInput`,`toInput`,`fromMs`,`toMs`,`sendingDeviceId`) |
| 82 `listAudioSourceIntervals` | `AUTHENTICATED` | reads `session` (intervals) | `NONE-R` |
| 44 `getDeviceHealth` / 45 `getAudioStatus` | existing | re-keyed inputs + `activeInputId` | unchanged |

No `trigger` key exists in `AUDIO_SOURCE_SWITCHED` because every switch is operator-initiated
(`C3 §5.2`). The sending device id is recorded (E-30/B15), never a credential.

### 3.4 Permissions and gated-control behaviour

| Control | Permission / condition | Checking state | Allowed | Refused |
|---|---|---|---|---|
| G4 Mic toggle | `SESSION_START` **and** `SESSION_HOLDER` | "Checking your permissions..." until the role + holder status resolve | Session holder or supervisor switches | `403 NOT_PERMITTED`; no state change |
| G5 Banner "switch to standby" | same as G4 | same | Performs op 81 after confirm | same |

### 3.5 Error / empty / loading states

| Situation | Web | Tablet | Phone | Rule |
|---|---|---|---|---|
| Loading role | Toggle disabled with Checking label | same | same | E-16 |
| `409 AUDIO_SOURCE_CONFLICT` | Banner with the fixed message; meters unchanged | same | same | `C3 §4` |
| `409 INVALID_STATE` | Toggle hidden-with-reason (session not recording) | same | same | `C3 §4` |
| `404 NOT_FOUND` | "That session is not the open session" | same | same | `C3 §4` |
| `MIC_SILENT` | WARNING banner + optional action | same | same | OD-11 |
| Both inputs down | Capture-fault presentation (session-level), never an auto-switch | same | same | `capture-spec §A.7` |

### 3.6 Per-client definition

| Aspect | Web | Tablet | Phone |
|---|---|---|---|
| Surface | Session Monitor (WB-01), Dashboard mic tiles (WB-02) | Session Live mic cards (MB-03), Home mic tiles (MB-01) | Session Live mic cards (MB-03) |
| Interaction | Confirm dialog + pending spinner | Confirm + haptic + pending | Confirm + haptic + pending |
| Home tile defect | n/a | Home mic tiles must not show "No signal" while recording (B15, folded by MB-01) | same |
| Meter key | `useAudioChannel` keyed by mic input (SH-22, `react.ts`) | same | same |
| Development-source badge **PE-125-05** | On a mic meter or tile whose input is a development source (flow 12; from the session's `captureConfig` snapshot) | on the mic card and the Home tile | on the mic card |

### 3.7 Forward-only rule

Any "silent for Ns" counter, the 2 s disconnect debounce, and any switch latency read derive from
**Core instants** via `coreClockOf` and only grow (`recording-elapsed.ts:1-21,128-144`;
`core-clock.ts:82-88`); they never step back (E-13; RC-1). **Refinement D19(b) for the recording
duration:** the forward-only hold applies only while the Core still reports RECORDING; it can exceed
the stored duration by the stop-learning delay (erratum AU1-4 — it does not "never overshoot"), so
once the Core reports the stop, the Core's authoritative recorded duration wins with one bounded
correction and the evidence record never shows more than the sealed duration. The meters themselves are push frames
(20 Hz, `CAPTURE_METER_RATE_HZ`), not client-timed.

---

## 4. Flow 3 — Sealing progress + ETA (R-6)

### 4.1 Trigger and entry state

| Item | Definition |
|---|---|
| Trigger | The session enters `FINALIZING` after `STOPPING`; the client mounts the progress view |
| Entry state | `FINALIZING`; the finalization slice carries v2 steps with `progress`/`etaMs`/`attempt` |
| Step ownership | **Row 32 (`masterplan/06_evidence_package_spec.md`) owns the definitive step list**; this spec binds to op 83's step envelope and the SH-01 enum `CLOSE_TRACKS`..`STORE_SEALED_PACKAGE` (`register §B.1`; op 27; `C3 §2.4`). The v1 six-step enum (`enums.ts:223-239`) is replaced by the v2 set |
| Cadence | `SEALING_PROGRESS_INTERVAL_MS = 1_000` recompute (`C3 §7`); op 83 reads the `session.finalization` slice |

### 4.2 Per-step states

| # | Step | State drawn | Source |
|--:|---|---|---|
| 1 | `CLOSE_TRACKS` … `STORE_SEALED_PACKAGE` | Ordered stepper; each step `PENDING` → `RUNNING` (with `%` + ETA) → `DONE`/`FAILED` | op 83; op 27 |
| 2 | Overall progress | `progressPct` (0-100) and `etaMs`; the transcript step is included in the list (R-5; `transcript-spec §D.3`) | op 83 |
| 3 | Long step | The step shows its own `startedAt`/`durationMs`; the ETA may be absent (`null`) rather than guessed | op 83 shape (`C3 §2.3`) |
| 4 | Completed | On `EVIDENCE_SEALED` the client hands off to the Summary (mobile, in place) or shows the sealed item | `C3 §5.3`; P-11 |
| 5 | Failed step | Step `FAILED` with `error_code`; the client shows the failure, never a lower percentage | op 83 |

### 4.3 Operations, slices, audit

| Operation | Access | Slice | Audit |
|---|---|---|---|
| 83 `getSealingProgress` | `AUTHENTICATED` | reads `session.finalization` | `NONE-R` |
| 27 `getCurrentSession` | `AUTHENTICATED` | `session` with `captureConfig` snapshot + v2 `finalization` | `NONE-R` |
| engine INTERNAL `applySealingProgress` / `completeSeal` | server-side seam (no client call) | publishes `session` | `EVIDENCE_SEALED` once at seal |

### 4.4 Permissions and gated-control behaviour

| Control | Permission | Checking state | Notes |
|---|---|---|---|
| Progress view (read) | `AUTHENTICATED` (link + signed-in on web) | The view shows "Checking your permissions..." while the link resolves; then the stepper | E-16; `core-queries.ts:65-77` |
| No write control | — | — | There is no "advance seal" or "retry" control (RECOVERY drives it, flow 4) |

### 4.5 Error / empty / loading states

| Situation | Web | Tablet | Phone | Rule |
|---|---|---|---|---|
| Loading | Stepper skeleton | same | same | E-16 |
| `409 INVALID_STATE` (sealing not started) | "Sealing has not started" | same | same | `C3 §4` |
| ETA absent | Show elapsed + "estimating…" (no fabricated number) | same | same | op 83 `etaMs?` |
| Failed step | Step marked FAILED; RECOVERY state if a fault follows | same | same | flow 4 |

### 4.6 Per-client definition

| Aspect | Web | Tablet | Phone |
|---|---|---|---|
| Surface | Session Monitor finalization (WB-01); Dashboard progress tile (WB-02) | Session Finalizing stepper (MB-04); Home progress tile (MB-01) | Session Finalizing stepper (MB-04) |
| Animation | React-drawn stepper; no Reanimated for final state | React-drawn rest values (`drift §6 E-13`); `SelectionGlow` constant border if list rows | same |
| Hand-off | In-place card swap on the monitor | In-place `finalizing → summary` (`stacks.tsx:59`, `summary-handoff.ts`, `animation:'none'`) | same |
| Risk | — | MB-04 **High**: lost Reanimated updates cluster in Finalizing/Stepper — React must draw the final state | same |

### 4.7 Forward-only rule

Progress is **forward-only and derived from Core instants** (`coreClockOf`), never the client wall
clock (`C3 §2.4`; `specs §E.5`; E-13; `register E-13`). The client aggregates per step with
`max(previous, server)` and counts `DONE` steps monotonically; a resumed attempt (flow 4) may
legitimately rewrite a step's `progress`, but the displayed overall must never rewind
(`04_database_contract.md:270`). ETA uses the monotonic `recording-elapsed.ts` ticker pattern
(`specs §E.5`).

---

## 5. Flow 4 — Resumed sealing after a crash/restart (R-6, OD-08)

### 5.1 Trigger and entry state

| Item | Definition |
|---|---|
| Trigger | A crash during `RECORDING` (durable part sealed `interrupted`) or a crash during sealing, followed by `RECOVERY` |
| Entry state | `FAULT → RECOVERY → SEALED` (or `INCOMPLETE`); `SealingProgress.resumed` is set on a resumed seal |
| Data read | op 83 (`resumed: true`, `attempt` ≥ 2), op 27 (`session.recovery` + `finalization`), op 38 (`interrupted: boolean`), op 39 (v2 item carries `interrupted`) |
| No user action | The client never offers a "restart seal" or "resume" button; RECOVERY is engine-driven (OD-08) |

### 5.2 Per-step states

| # | Step | State drawn | Source |
|--:|---|---|---|
| 1 | `RECOVERY` scan | Recovery view: `RECOVERY_SCAN` → `INCOMPLETE_SESSION_ANALYSIS` with a progress read | `session-machine.ts:971-1015`; MB-06 |
| 2 | Resumed sealing | The stepper shows `attempt ≥ 2` and a "resumed after restart" note; progress forward-only | op 83; E-13 |
| 3 | Interrupted package | If the durable part was sealed, the item/tile is marked **"interrupted"** (not a normal seal) | op 38 `interrupted`; op 39; OD-08 |
| 4 | Completion | RECOVERY ends `SEALED`; `EVIDENCE_SEALED`; hand-off to Summary | `specs §E.5`; P-11 |
| 5 | Transcript | The transcript covers the durable timeline and records `intervals_incomplete` if the interval map was truncated | `transcript-spec §A.1` |

### 5.3 Operations, slices, audit

| Operation | Access | Slice | Audit |
|---|---|---|---|
| 83 `getSealingProgress` | `AUTHENTICATED` | `session.finalization` (`resumed`, `attempt`) | `NONE-R` |
| 27 `getCurrentSession` | `AUTHENTICATED` | `session.recovery` + `finalization` | `NONE-R` |
| 38 `listSessionHistory` | existing | session list with `interrupted` | `NONE-R` |
| 39 `listEvidence` | existing | v2 item with `interrupted` | `NONE-R` |
| engine INTERNAL `applySealingProgress`, `completeSeal` | server-side | publishes `session` | `RECOVERY_STARTED`, `RECOVERY_COMPLETED`, `EVIDENCE_SEALED` |

### 5.4 Permissions and gated-control behaviour

| Control | Permission | Checking state | Notes |
|---|---|---|---|
| Recovery view (read) | `AUTHENTICATED` | "Checking your permissions..." while the link resolves | E-16 |
| Resumed progress (read) | `AUTHENTICATED` | same | forward-only |
| No write control | — | — | RECOVERY-driven only |

### 5.5 Error / empty / loading states

| Situation | Web | Tablet | Phone | Rule |
|---|---|---|---|---|
| Crash during sealing | Progress resumes; "Resumed after restart" note | same; in-place recovery hand-off | same | E-13 |
| Crash during recording | Durable part presented as "interrupted" | same | same | OD-08 |
| No committed transcript | Transcript shows UNAVAILABLE/partial note; no fake text | same | same | `transcript-spec §A.5` |
| `409 INVALID_STATE` | "Sealing has not started" | same | same | `C3 §4` |

### 5.6 Per-client definition

| Aspect | Web | Tablet | Phone |
|---|---|---|---|
| Surface | Monitor finalization + dashboard tile (WB-01/WB-02) | Session Recovery (MB-06) → Finalizing (MB-04) → Summary (MB-05) | same, compact |
| Hand-off | Card swap | In-place, `animation:'none'` | same |
| "Interrupted" badge | On the evidence item/tile | same | same |

### 5.7 Forward-only rule

On resume, `attempt` increments and a step's `progress` may be rewritten (`04_database_contract.md:270`),
but the client must not draw a lower value than it already showed for a `DONE` step, and the overall
percentage must never decrease. All reads come from Core instants (`coreClockOf`); E-13 applies.

---

## 6. Flow 5 — Playback with the audio-source band (R-3/R-4)

### 6.1 Trigger and entry state

| Item | Definition |
|---|---|
| Trigger | The operator opens a sealed evidence item and plays it |
| Entry state | A `SEALED` v2 item with two files (`VIDEO-01.mp4`, `VIDEO-02.mp4`), each carrying the single `AUDIO-01` track, and `audioSourceIntervals[]` |
| Whole file | One whole file per camera with the single audio track (R-4; OD-21); Range-request streaming |
| No live preview | OD-12: playback is of the sealed files, not a live real camera (the Monitor keeps the demo loop) |

### 6.2 Per-step states

| # | Step | State drawn | Source |
|--:|---|---|---|
| 1 | Open item | op 40 `getEvidence`; `media.source: LIVE_STREAM` means a signed media session is required | op 40; `C3 §3` |
| 2 | Media session | op 88 `createEvidenceMediaSession` returns a signed, loopback-only URL with `ranges: true`; `EVIDENCE_MEDIA_SERVED` audited (never the URL) | op 88; E-31 |
| 3 | Stream | Two players, one per camera file, synchronised on the shared `AUDIO-01` timeline; Range requests map to the fragment quantum | op 88; `capture-spec §D.4` |
| 4 | Audio-source band | A band under the timeline drawn from `audioSourceIntervals` (`fromMs`/`toMs`, media-pts) marks which mic was active when | op 82; `capture-spec §E`; `C3 §2.4` |
| 5 | Transcript pane | Sealed transcript alongside (flow 6) | op 84 |
| 6 | Verify | op 41 v2 verify: per-file chain (both hashes) + transcript hash + real signature; pinned verdict per run. **PE-125-06:** for a package with development sources the line "DEVELOPMENT SOURCES — this package was not recorded from production devices." is shown first, above the checks, never collapsed; the verdict (PASS when the checks pass) is unchanged (flow 12, §8f.2) | op 41; P-16; `06_evidence_package_spec.md` §D.1 (V-15) |
| 7 | Export / composite | op 42 creates a job (`202`, `status: QUEUED`); op 87 polls; composite marked `derived` | op 42/87; OD-16 |
| 8 | No media | `409 MEDIA_NOT_AVAILABLE` → "No playback media is available for this evidence item." | `C3 §4` |

### 6.3 Operations, slices, audit

| Operation | Access | Slice | Audit |
|---|---|---|---|
| 82 `listAudioSourceIntervals` | `AUTHENTICATED` | reads `session` intervals | `NONE-R` |
| 88 `createEvidenceMediaSession` | `PERMISSION EVIDENCE_VIEW` (live only) | none (not replicated) | `EVIDENCE_MEDIA_SERVED` (`fileId`,`bytesServed`,`range*`,`signed`,`expiresAt?`) |
| 39 `listEvidence` / 40 `getEvidence` / 41 `verifyEvidence` | existing | reads `evidence` | `NONE-R` |
| 42 `exportEvidence` / 87 `getEvidenceExportJob` | `PERMISSION EVIDENCE_EXPORT` | reads `evidence.exportJob` | `EVIDENCE_EXPORTED`; failure `EVIDENCE_EXPORT_FAILED` |

### 6.4 Permissions and gated-control behaviour

| Control | Permission | Checking state | Allowed | Refused |
|---|---|---|---|---|
| G7 Playback (open media session) | `EVIDENCE_VIEW` | "Checking your permissions..." while the role resolves; the player then opens | Op 88 signed URL (HMAC-signed, bound to `(operatorId, sessionId, evidenceId, fileId)`, TTL `EVIDENCE_MEDIA_SESSION_TTL_MS` — SEC35-12; `03_api_contract.md §2.4`) | `403 NOT_PERMITTED`; `409 MEDIA_NOT_AVAILABLE` |
| G8 Export / composite | `EVIDENCE_EXPORT` (SUPERVISOR) | same | Op 42 job | `403` (`EXPORT_DENIED`); `409 EXPORT_IN_PROGRESS` |

### 6.5 Error / empty / loading states

| Situation | Web | Tablet | Phone | Rule |
|---|---|---|---|---|
| Loading media | Player skeleton; Checking label on the play control | same | same | E-16 |
| `409 MEDIA_NOT_AVAILABLE` | Fixed message, no player | same | same | `C3 §4` |
| `409 EXPORT_IN_PROGRESS` | Job progress already shown | same | same | `C3 §4` |
| Failed export job | `status: FAILED` (HTTP 200), `EVIDENCE_EXPORT_FAILED` | same; FAIL wording (`drift E-11`, P-16) | same | OD-16 |
| Tampered fragment | Exactly that fragment fails the v2 verify; verdict pinned per run | same | same | op 41; P-16 |

### 6.6 Per-client definition

| Aspect | Web | Tablet | Phone |
|---|---|---|---|
| Player | HTML5/media element with Range streaming; download via `lib/download.ts:26-41` | expo-video with signed-URL **headers** (F-31; MB-07) | expo-video with headers (MB-07) |
| Two files | Two synchronised players + band | Two synchronised players + band | Two synchronised players + band (compact) |
| Band | Canvas/SVG band from intervals | Drawn band from intervals | Drawn band from intervals |
| Development-source label **PE-125-06** | Badge on the item header and on each camera file recorded from a development source; band segments of a development microphone carry it in their legend. Data: the manifest mark (fields 124-126) or the verify result — never the current device list | same on the evidence sheet | same, compact |
| Blanking | Signed-URL prefix `mts_` added to the web error sink `runtime/error-sink.ts:52` (E-31/P-07; SEC35-13; `06_evidence_package_spec.md §G.4`) | Added to `runtime/log.ts:46` blanking; both regexes become `\b(ses|dvc|bio|mts)_` (E-31/P-07; SEC35-13) | same |

### 6.7 Forward-only rule

The playhead follows the media clock; the audio-source band is a static manifest overlay, not a
client timer. The v2 verify verdict is pinned per run and never flips mid-run (`drift §1.4 WB-04`,
P-16).

---

## 7. Flow 6 — Transcript pane (R-5)

### 7.1 Trigger and entry state

| Item | Definition |
|---|---|
| Trigger | The operator opens the transcript pane of a sealed item (web evidence page; mobile evidence sheet) |
| Entry state | The sealed machine transcript is inside the package; revisions are append-only and signed |
| Data shape | `TranscriptDocument { documentVersion, language, speakerState, segments[], sha256, machineTranscriptHash, assembledAt, revision }` (op 84; `C3 §2.3`) |
| Fixture note | `TtsFixtureProvider` is **dev-side only** (`transcript-spec §B.6`); it never appears in a production client |

### 7.2 Per-step states

| # | Step | State drawn | Source |
|--:|---|---|---|
| 1 | Load transcript | op 84; Loading while not ready | op 84 |
| 2 | Not ready | `409 TRANSCRIPT_NOT_READY` → "The transcript is not available yet." | `C3 §4` |
| 3 | Segments | Each segment with a timestamp (`start`/`end`) and, when LABELLED, a speaker label | op 84; `transcript-spec §A.5` |
| 4 | UNAVAILABLE | Exact state string **"speaker labels unavailable"**; segments still shown unlabelled | `transcript-spec §A.4`; R-5 |
| 5 | Revise | op 85 with `baseRevision` + `changes[]`; `201` signed revision (Core Ed25519, author recorded, no approval flow) | op 85; OD-15 |
| 6 | Revision list | op 86 lists the append-only revisions with author and number | op 86 |
| 7 | Conflict | `409 TRANSCRIPT_REVISION_CONFLICT` → "The transcript revision is based on a revision that is no longer current." | `C3 §4` |
| 8 | In-package indicator | The pane marks the transcript as **inside the sealed package** (immutable original) | `transcript-spec §A.5`; R-5 |

### 7.3 Operations, slices, audit

| Operation | Access | Slice | Audit |
|---|---|---|---|
| 84 `getTranscript` | `PERMISSION EVIDENCE_VIEW` | reads `evidence` (transcript summary) | `NONE-R` |
| 85 `createTranscriptRevision` | `PERMISSION TRANSCRIPT_REVISE` | publishes `evidence` | `TRANSCRIPT_REVISED` (`revisionId`,`authorId`,`number`,`baseRevision`,`changeCount`,`machineTranscriptHash`,`reason?`,`permission?`) |
| 86 `listTranscriptRevisions` | `PERMISSION EVIDENCE_VIEW` | reads `evidence` | `NONE-R` |

`TRANSCRIPT_REVISED` carries counts and the binding hash, never the transcript body (`C3 §5.2`).

### 7.4 Permissions and gated-control behaviour

| Control | Permission | Checking state | Allowed | Refused |
|---|---|---|---|---|
| Transcript read | `EVIDENCE_VIEW` (every role) | "Checking your permissions..." while the role resolves | Segments + revisions visible | `403 NOT_PERMITTED` |
| G6 Revise | `TRANSCRIPT_REVISE` (INVESTIGATOR + SUPERVISOR) | same | Signed revision appended | `403`; `409 TRANSCRIPT_NOT_READY`; `409 TRANSCRIPT_REVISION_CONFLICT` |

### 7.5 Error / empty / loading states

| Situation | Web | Tablet | Phone | Rule |
|---|---|---|---|---|
| Not ready | Fixed message | same | same | `C3 §4` |
| UNAVAILABLE | "speaker labels unavailable" badge; no fabricated speaker | same | same | R-5 |
| Conflict | Reload revisions, then re-edit | same | same | OD-15 |
| Empty revisions | "No revisions" | same | same | op 86 |

### 7.6 Per-client definition

| Aspect | Web | Tablet | Phone |
|---|---|---|---|
| Surface | Evidence → transcript pane (WB-04) | Evidence sheet → transcript (MB-07) | same, compact |
| Segment list | Virtualised list; constant card border if rows | `SelectionGlow` constant border (`drift E-15`) | compact rows; constant border |
| Author/number | Shown per revision | same | same |
| Original immutable | "Sealed original — immutable" note | same | same |

### 7.7 Forward-only rule

Timestamps are media-pts (segment `start`/`end`); no client timer drives them. The transcript revision
number is monotonic and append-only (op 86); the pane never hides a newer revision.

---

## 8. Flow 7 — Session gating (R-6)

### 8.1 Trigger and entry state

| Item | Definition |
|---|---|
| Trigger | An operator tries to create/start a session while the previous one is not `SEALED` |
| Entry state | Any open session; a new session is blocked until the previous reaches `SEALED` (rooms may wait) |
| Behaviour | `createSession` refuses with `409 SESSION_ACTIVE`; **no** audit row (a typed refusal) |

### 8.2 Per-step states

| # | Step | State drawn | Source |
|--:|---|---|---|
| 1 | New session pressed | "Checking your permissions..." resolves first | E-16 |
| 2 | Blocked | Blocking presentation: "A session is still being sealed"; the Seal progress is linked | `C3 §4` (`78-80 vs 24` note); op 27 |
| 3 | Sealed reached | The blocker clears; the new-session action enables | op 27 |
| 4 | Start checks | `startSession` precheck states (existing). **PE-125-07:** each run also checks every configured camera and microphone for reachability; the camera and microphone rows follow the start rule of §8g.3 (blocked / warning with acknowledgement / the active-microphone rule), and an unreachable device raises the notification of flow 11 (situation B) | op 25; `beginPrecheck` / `retryPrecheck` (`C3 §3.1`); D80(6), D81 |

### 8.3 Operations, slices, audit

| Operation | Access | Slice | Audit |
|---|---|---|---|
| 24 `createSession` | `PERMISSION SESSION_START` | reads/publishes `session` | `409 SESSION_ACTIVE` = no row |
| 25 `startSession` | `PERMISSION SESSION_START` | `session` | existing |
| 27 `getCurrentSession` | `AUTHENTICATED` | `session` + v2 `finalization` | `NONE-R` |

### 8.4 Permissions and gated-control behaviour

| Control | Permission | Checking state | Blocked | Refused |
|---|---|---|---|---|
| G10 Session start (New/Start) | `SESSION_START` | "Checking your permissions..." | Blocked while a session is open (not SEALED) | `403 NOT_PERMITTED`; `409 SESSION_ACTIVE` |

### 8.5 Error / empty / loading states

| Situation | Web | Tablet | Phone | Rule |
|---|---|---|---|---|
| Loading | New-session button in Checking | same | same | E-16 |
| Previous not sealed | Blocking card with a link to progress | same | same | R-6 |
| Permission refused | Disabled + role sentence | same | same | E-16 |
| A configured camera or microphone is unreachable **PE-125-07** | The row names the device (label and id) and, for a camera, the count of the one search the pre-check ran; blocked or warning `Alert` per §8g.3; Search again (G13 / G17) and Retry | same in `DevicesCheckStep` | same | R-10 AC-2; §8e.2, §8g.3 |
| No camera connected at session start **PE-125-07** | Fault presentation "No camera connected. Nothing was recorded." — no timer, no recording indicator, no meters | same | same | D72(k); §8e.2 situation C |

### 8.6 Per-client definition

| Aspect | Web | Tablet | Phone |
|---|---|---|---|
| Surface | Session New (WB-03) | Session New (MB-02) | Session New (MB-02) |
| Blocking presentation | Inline blocking card + progress link | Modal + progress link | Full-screen card + progress link |
| Hand-off on start | Monitor | In-place `monitor-handoff.ts` | same |

### 8.7 Forward-only rule

The blocker reads the session state (not a local countdown); when `SEALED` arrives the UI unblocks. No
client timer decides the unblock.

---

## 8a. Flow 8 (CONFIRMED) — STT configuration menu (R-8; D24, Q-STT-CFG answer (a)) **Erratum PE-R8-13 (D24)**

> **Status: confirmed (D24, 2026-10-08: Q-STT-CFG answered (a), all 13 defaults; D20).** With it: flows
> 8/8 (24 client definitions), gated controls G11-G12 added. The 7/7 flow and 10/10 gated-control figures
> and the self-gate elsewhere in this file were not restated by the status sweep (**Erratum PE-R8-13**,
> status wording only). Operations 90-92 (`C3 §2.5`), audit `STT_CONFIG_CHANGED`; no new slice.

| Aspect | Web console (edit) | Tablet | Phone |
|---|---|---|---|
| Entry | System → **Transcription (STT)** configuration page next to the capture devices entry (WB-07 pattern) | Settings → Transcription status (MB-09 pattern), **read-only** | same as tablet, **read-only** |
| Content | enabled/disabled switch; backend (`omlx-server` / `cpu-local`); endpoint (loopback URL, server backend only); model; language (Indonesian, fixed); speaker labelling on/off; credential field (write-only, never pre-filled; shows "set" / "not set" and kind REFERENCE/ENCRYPTED only); last connection test result | enabled/disabled, backend, model, labelling, last test result, "applies to the next session" note when pending | same |
| Actions | Save (op 91; optimistic `revision`); **Test connection** (op 92) | none | none |
| Gated control | G11 "Save STT configuration" and G12 "Test connection": `CAPTURE_CONFIG` (SUPERVISOR + TECHNICIAN); every other role sees the **"Checking your permissions..."** state, then the disabled control with its reason | read-only view for every role (op 90 is `AUTHENTICATED`) | same |
| Saved while a session is open | banner "Saved — applies to the next session" (`appliesFrom: NEXT_SESSION`); the session monitor keeps showing the current session's transcript state | status shows "pending for the next session" | same |
| Disabled state elsewhere | sealing progress shows the transcript step as "disabled by configuration" (completed, not failed); the evidence transcript pane shows "Transcript disabled by configuration" instead of an error (flows 3, 6) | same | same |
| Errors | `422 INVALID_INPUT` with `ENDPOINT_NOT_LOOPBACK` → field message "Only a local (loopback) address is allowed"; revision conflict → reload prompt; test result `reachable: false` → inline "Not reachable" (not an error toast) | — | — |
| Secrecy | the credential value is never displayed, logged or cached client-side; it is sent once on save and cleared from the form state (E-31; both log-blanking lists) | never received | never received |
| Checks | `M6-STTCFG-WEB` (2 + 1) | `M6-STTCFG-TAB` (2 + 1) | `M6-STTCFG-PHONE` (2 + 1) |

---

## 8b. Rev 2.3 client delta — frame for flows 9-13 (R-9, R-10, R-11; D73, approved D78; rulings D80, D81) **Erratum PE-125-08**

> **Status: spec delta of blueprint row 125.** Target for rows 137 (web), 138 (tablet, phone), 133 and
> 139 (server side of the notifications). **Nothing here is built**: the capture selector itself is
> not in the clients yet (`grep -rl "captureConfig\|captureDevices" apps/core-web/src apps/mobile/src`
> = 0 files on 2026-10-09), and operations 93-97 are a contract target (`C3 §2.6` status line).
> Flows 1-8 keep their text except the cells marked PE-125-04..07.

| Axis | Content |
|---|---|
| Subject | What the three clients draw for: a camera search and its list (flow 9), the connect flow (flow 10), the three no-device notifications (flow 11), the development-source label and the local-device rows (flow 12), the microphone re-read and the active-microphone rule at pre-check (flow 13) |
| Stakeholders | The user (D73-D78); the controller (D80, D81); rows 126, 127, 128 (review, checks, spec gate); rows 133, 137, 138, 139 (builders); operators with `CAPTURE_CONFIG` (SUPERVISOR, TECHNICIAN) and operators who only start sessions |
| Timeline | Spec row of 2026-10-09; built in M4 (137, 138, 133) and M5 (139); adoption **with** a password works after row 84 (M7) |
| Scope — in | Screens, states, texts, gated controls, placement of notifications, the badge, the i18n keys proposed, counts, hand-over |
| Scope — out | Typed-address entry (D80(10)); network microphone discovery (D80(5)); removing an adopted camera (D81 gap); a camera password on tablet or phone (D80(3)); live preview of a real camera (OD-12); code, the i18n file itself, any other spec |
| Rationale | D73 -> `specs` §B.2 (R-9 16 AC, R-10 6 AC, R-11 10 AC) -> D80 / D81 rulings -> `C3 §2.6, §3.1, §5.4` (row 121) and `06_evidence_package_spec.md` §B.12, §D.1 (row 124) -> this delta |
| Method | Read this file whole, `specs` §B.2, `C3 §2.6, §3.1, §4, §5.2, §5.4, §7`, the records of rows 121 and 124, D72-D81; read the client sources named in the tables below (read-only, working tree of 2026-10-09, HEAD `101ce62`) to name existing building blocks; every state is mapped to a contract answer |
| Alternatives not chosen | (1) Camera password on tablet / phone — overruled by D80(3). (2) Ask for the password twice (once for the test, once for adding) — rejected: two typings double the chance of a typo against a guard of 3 failures per camera; the form keeps the typed values until the dialog closes instead (§8d.3). (3) A numeric countdown during a search or after a rate limit — rejected by R-10 AC-4 and §2.7. (4) A second badge wording per source kind — rejected: one badge everywhere (R-11 AC-6), the kind is a secondary text. (5) An error toast for "session open" or "web console only" — rejected by the ruling: both are disabled, explained states |
| Assumptions | A-1: `captureConfig.locked` (`packages/shared/src/api/state-slices.ts:894-901`) is the flag the clients read to grey the connect controls. A-2: the session's `captureConfig` snapshot (op 27, `C3 §3`) carries `sourceClass` per line like op 76. A-3: an alert reaches every client through the `alerts` slice with `params.reason` (`C3 §5.4`) |
| Gaps | Open items OP-125-1..7 in §15.3 — four of them are members or operations the contract does not carry yet |

**Building blocks the delta is specified with (the apps' own kit; nothing hand-built).**

| Need | Web (`apps/core-web`, `@heroui/react` 3.2.6) | Tablet and phone (`apps/mobile`, `heroui-native` 1.0.10) |
|---|---|---|
| Page and panel | `PageHeader` (`features/devices/index.tsx:33`); `DevicesPanel` (`features/devices/panel.tsx:32`); kit `Card` | `SafeScreen`, `Pane` / `PaneLayout` (`@/layout`); `SectionCard` (`components/kit/section-card.tsx`, as `devices-screen.tsx:110`) |
| List | kit `Table` (as `device-drawer.tsx:2`, `users-roles/users-panel.tsx:2`) | kit `ListGroup` rows (as `devices/device-row.tsx:14`) with the always-mounted `SelectionGlow` and `ROW_CARD_BORDER` (`device-row.tsx:21,214`) |
| Detail surface | kit `Drawer` (`features/devices/device-drawer.tsx:88-132`) for a registered device | `DeviceDetail` (`devices/device-detail.tsx:93`); kit `BottomSheet` with `useSheetPresence` (`devices/diagnostics-sheet.tsx:53-95`) |
| Dialog with a form | kit `Modal` + `TextField`, `Label`, `Description`, `FieldError`, `Button`, `Spinner`, `Alert` (as `users-roles/role-dialog.tsx:2`); `react-hook-form` 7.89.0 | **none — no password field exists on tablet or phone** (D80(3)) |
| Banner | `DevicesBanner` (`features/devices/devices-banner.tsx:16,46`, `role="status" aria-live="polite"`); kit `Alert` (as `other-devices.tsx:137-141`) | kit `Alert` (as `devices-screen.tsx:176-180`, test id `devices-attention`) |
| Empty state | kit `EmptyState` (as `device-drawer.tsx:533`) | `SectionCard` with title and description (as `devices-screen.tsx:194`) |
| Badge / chip | `StatusChip` (`features/devices/status-chip.tsx:23`); kit `Chip` | `StatusChip` (`components/kit/status-chip.tsx`), `DeviceStatusChip` (`devices/device-status-chip.tsx`) |
| Loading | kit `Skeleton`, `Spinner`, `ProgressBar` (as `evidence/integrity-tab.tsx:2`) | kit `SkeletonGroup` (as `devices-screen.tsx:135-137`), `Spinner`, `PendingSpinner` + `busyState` (`@/runtime`) |
| Pending press | `usePendingControl` (`lib/pending-control`) | `usePendingPress` (`devices/use-pending-press.ts`) |
| Command path | `useCoreActions` + `settle` (`@dems/shared/live`); `useCoreErrorPresenter` (`lib/core-errors`) | `useCoreActions` + `settle`; `useCoreErrorPresenter` (`@/runtime`) |
| Gated read | one query factory per Core key in `lib/core-queries.ts`, gate inside the factory (§0; WB-11) | replicated slices through `useSim`; for op 94 (no slice) a read through the Core client with the same gate |
| Permission state | "Checking your permissions…" then the reason `common.rbac.requiresRole` (`packages/shared/src/i18n/en/common.ts:585`) | `useRoleGate` (`features/rbac/use-role-gate.ts:18,46`); text `rbac.checking` (`apps/mobile/src/i18n/en.mobile.ts:35`) |
| Alert centre | `NotificationsBell` (`components/shell/notifications-bell.tsx:38-67`: kit `Badge` + `Popover`, latest 5 active alerts, severity icon map `:19-22`) | Home header bell (`features/dashboard/home-header.tsx:175-233`, test id `home-alerts`) |
| Pre-check list | `DevicesStep` (`features/session-new/devices-step.tsx:82`; blocked `Alert` at `:169-175`) | `DevicesCheckStep` (`features/session-new/devices-check-step.tsx:59`; blocked `Alert` `:110-116`, warning `Alert` `:124-128`) |

---

## 8c. Flow 9 — Search for cameras (R-9 AC-1..AC-4, AC-11..AC-13; R-10 AC-1, AC-4) **Erratum PE-125-09**

### 8c.1 Trigger and entry state

| Item | Definition |
|---|---|
| Trigger | An operator presses **"Search for cameras"** (first search) or **"Search again"** (any later one). Both are the same control (G13) and the same operation (op 93). A search is never started by opening a screen, by a timer or by a read (R-9 AC-1; op 94 never probes) |
| Entry points — web | Devices page (WB-05): the action in the `PageHeader` action area and in the "Camera search" panel; the empty state of §2.5; "Search again" on each camera notification of flow 11. System (WB-07): a link "Search for cameras" that opens the Devices page at the search panel — a link, not a second implementation |
| Entry points — tablet | Devices screen (MB-08): the header action and the empty state; Settings -> capture section (MB-09): a row that opens the Devices screen at the search panel; "Search again" on each camera notification of flow 11 |
| Entry points — phone | Settings -> Devices (MB-09): the same panel, compact; "Search again" on each camera notification of flow 11 |
| Entry state | Signed in, link online, **any session state** — a search is allowed while a session is open (D80(4); op 93 never answers `409 CAPTURE_CONFIG_LOCKED`) |
| Read on entry | op 94 `getCaptureDiscovery` once: it restores the caller's own live result after a navigation or a reload (`search: null` = idle) |
| Not offered | No address, subnet, port or filter field anywhere: op 93 has no request member, and typed-address entry is not in scope (D80(10)). A camera that does not answer the search cannot be listed — the empty-state text says what to check, it does not promise a manual way |

### 8c.2 States, per client

Every state is drawn from an answer of op 93 / op 94; none is inferred by the client.

| # | State | Contract answer | Web | Tablet | Phone |
|--:|---|---|---|---|---|
| S1 | Checking | role or link unresolved | Search button disabled with "Checking your permissions…"; panel body is a `Skeleton` | same; `SkeletonGroup` | same |
| S2 | Idle | op 94: `search: null` | Panel with one sentence ("Search the network for cameras. Searching connects to nothing.") and the enabled **Search for cameras** button | same in a `SectionCard` | same, compact |
| S3 | Searching (bounded) | op 93 `202` (or `200`, `created: false`); op 94: `state: RUNNING` | Button pending (`Spinner`, disabled); a kit `ProgressBar` whose value is `(Core now − startedAt) / windowMs`, clamped to 0..100 and never lowered; text "Searching the network for cameras…" and "This takes up to {{seconds}} seconds." (`windowMs / 1000`, a fixed number, **not** a countdown); the list area is empty. op 94 is polled no faster than once per second. At 100 % the text becomes "Finishing the search…" until op 94 answers `COMPLETE` or `FAILED` — the bar never decides the end | same; the bar inside the `SectionCard` | same |
| S4 | Results | op 94: `state: COMPLETE`, `candidates.length ≥ 1` | Summary line "{{count}} found · {{newCount}} new · {{registeredCount}} already registered"; kit `Table` (§8c.3); the freshness line (§8c.4); **Search again** | `ListGroup` rows with the constant border; same summary and freshness line | compact rows; same |
| S5 | Empty | `COMPLETE`, `responderCount: 0` | kit `EmptyState`: title "No camera answered the search", body "Check that each camera is powered and on the same network as the Core, then search again.", action **Search again**. The situation-A alert of flow 11 is raised by the Core, not by this screen | `SectionCard` with the same title, body and action | same |
| S6 | Only registered cameras | `COMPLETE`, `newCount: 0`, `registeredCount ≥ 1` | The list as S4 with every row "Already registered"; **no** empty state and no alert (R-10 AC-1) | same | same |
| S7 | Truncated | op 94: `truncated: true` | A line above the list: "More than {{max}} devices answered. The first {{max}} are listed." (`CAPTURE_DISCOVERY_MAX_CANDIDATES`) | same | same |
| S8 | Error | op 94: `state: FAILED` (`failureReason` is a code and is not shown as text); or the request failed | kit `Alert` (danger): "The search could not be completed. Nothing was changed." + **Search again**. A link outage uses the existing presenter sentences (`common.coreErrors.offline`, `…timedOut`) | same | same |
| S9 | Search unavailable | op 93: `503 NOT_READY` (`DISCOVERY_NOT_READY`) | kit `Alert` (warning): "Camera search is not available on this Core yet." with **Retry** that repeats the call once per press (the §2.5 `503` pattern); no automatic retry | same | same |
| S10 | Another search is running | op 93: `409 INVALID_STATE` (`DISCOVERY_IN_PROGRESS`) | Inline note (not a toast): "Another operator is searching right now. Search again when their search has finished." The button stays enabled; nothing is polled for the other search | same | same |
| S11 | Too many searches | op 93: `429 RATE_LIMITED` (`DISCOVERY_RATE_LIMITED`, `retry-after`) | The existing sentence `common.coreErrors.limited` with the seconds value of the answer as a fixed number; the button is disabled until that instant and re-enables by itself; **no ticking label, no automatic search** (R-10 AC-4) | same | same |
| S12 | Result no longer kept | op 94 answers `search: null` after a result was drawn (expiry, sign-out, Core restart, replaced by the owner's new search) | The list is removed and the panel reads "This search result is no longer kept. Search again to see the cameras." + **Search again** | same | same |
| S13 | Not permitted | role without `CAPTURE_CONFIG` (op 93 / op 94 `403 NOT_PERMITTED`) | Button disabled with `common.rbac.requiresRole` ("Requires the SUPERVISOR or TECHNICIAN role"); **no list is requested or drawn**; the notifications of flow 11 are still shown | same | same |

### 8c.3 Candidate row content

A row is one `CaptureCandidate` of op 94 (`C3 §2.6`). Order = the order op 94 returns; the client never
re-sorts, filters or merges (the list is forward-only during its life).

| Content | Field | Drawn as | Rule |
|---|---|---|---|
| Address | `host` | monospace text | plain text, never a link and never a URL; it is the address the answer came from |
| Make and model | `vendor`, `model` | one text "{{vendor}} {{model}}" | either may be null: the missing part is omitted; both null -> "Make and model not announced" |
| Name hint | `name` | secondary line | omitted when null |
| Trust note | — | one caption per list, not per row: "Make, model and name are what each device announced. They are not checked." | the three texts are **untrusted device text**: drawn as text nodes only (never as markup, never as a link), one line with an ellipsis, bidirectional text isolated (`<bdi>` on web), the full text in the accessible label; maximum 120 characters by contract |
| Registered or new | `status`, `deviceId` | chip **"New"**, or chip **"Already registered"** followed by the device label (for example "CAM-01 · Camera 1") | a registered row offers "View device" (web: opens `DeviceDrawer`; mobile: opens `DeviceDetail`) and no Connect |
| Cannot be connected | `testable: false` | chip "Cannot be connected" + "This device announced an address that is not its own." | listed, never connectable (D80(11)) |
| Last test | `lastTest` | web only: chip with the outcome word of §8d.4 and the time | always null on tablet and phone: a test can only be run by the web session that owns the list, and each client session has its own list |
| Development source | `sourceClass: DEVELOPMENT`, `adapter` | the row sits in a **separate group "Development sources"** under the network cameras, with the one badge of flow 12 and the kind text ("This Mac's camera" for `LOCAL_DEVICE`, "Test source" for `FAKE`) | the group and its header are drawn only when op 94 lists at least one such candidate; with the development flag off the Core lists none (R-11 AC-2) and the client has no switch or filter of its own |
| Action — web | — | **Connect** (G14) on a row that is `NEW` and `testable` | flow 10 |
| Action — tablet, phone | — | **Connect** drawn disabled with the sentence "Connect this camera from the web console." | flow 10, §8d.7 |
| Never drawn | `candidateId`, `searchId`, `endpointRef` (row), `failureReason` | — | ids are keys and test ids only; `endpointRef` appears once, in the connect dialog header on web |

### 8c.4 Result freshness and who sees it

| Point | Rule | Source |
|---|---|---|
| Who sees the list | **Only the operator session that ran the search**, on the client it ran on. Another operator, another role and the same operator on another client see nothing of it; they run their own search. The panel says so once: "Only you see this list, on this device." | op 94 owner session only; `C3 §2.6` "Candidate state: ownership" |
| What everyone sees | The outcome as a notification (flow 11): an alert when nothing answered. Never the list | `C3 §5.4` |
| Freshness line | "Searched at {{time}}. Kept until {{time}}." — two clock times formatted from `completesAt` and `expiresAt` with the existing `formatClock` (`@dems/shared/realtime`); no countdown | op 93 / 94 `CaptureDiscoverySearch` |
| Expiry | Detected by the next op 94 read (on focus, on entering the screen, before opening the connect dialog) -> state S12. A client clock never removes the list | §2.7; `CAPTURE_DISCOVERY_RESULT_TTL_MS` |
| Search again | Replaces the list: the old rows and their test results are gone the moment the new search is accepted (state S3). While the caller's own search is `RUNNING` a second press changes nothing (op 93 `200`, `created: false`) | `C3 §2.6` "lifetime", "Idempotency" |
| Sign-out, session expiry, Core restart | The list is gone; after signing in again the panel is idle (S2) | R-9 AC-4 |
| Cache | The op 94 answer is kept only in the query cache of the signed-in session and is dropped at sign-out; it is not persisted to storage and is not part of any slice | `C3 §2.6` "Why no slice" |

### 8c.5 Operations, slices, audit

| Operation | Access | Slice | Audit |
|---|---|---|---|
| 93 `startCaptureDiscovery` | `PERMISSION CAPTURE_CONFIG`; web, tablet, phone; any session state | none; raises or resolves the situation-A alert in `alerts` when the window closes | `CAPTURE_DISCOVERY_SEARCHED` once per search |
| 94 `getCaptureDiscovery` | `PERMISSION CAPTURE_CONFIG`; owner session only | **none** | `NONE-R` |

### 8c.6 Permissions and gated-control behaviour

| Control | Permission / condition | Checking state | Allowed | Refused |
|---|---|---|---|---|
| G13 Search for cameras / Search again | `CAPTURE_CONFIG` (SUPERVISOR + TECHNICIAN); any session state | "Checking your permissions…" until the role and link resolve | starts a search (S3) | not permitted -> disabled + the role sentence (S13); `409` S10; `429` S11; `503` S9 |
| Candidate list (gated read, op 94) | `CAPTURE_CONFIG`; owner session | the panel shows the Checking state, then S2 / S4 | the caller's own list | `403`: no list, role sentence |

### 8c.7 Per-client definition

| Aspect | Web | Tablet | Phone |
|---|---|---|---|
| Surface | Devices page (WB-05), panel "Camera search" under `DevicesBanner`; entry link on System (WB-07) | Devices screen (MB-08), list pane; entry row in Settings -> capture (MB-09) | Settings -> Devices (MB-09) |
| Read | new factory `captureDiscoveryQueryOptions` in `lib/core-queries.ts` (gate inside the factory; polling only while `RUNNING`) — WB-11 | Core client read behind the same gate; polled only while `RUNNING` | same |
| List | kit `Table`: Address, Make and model, Name, Status, action | `ListGroup` rows, constant border (`ROW_CARD_BORDER`) | compact `ListGroup` rows, constant border |
| Row action | Connect (flow 10) | Connect disabled + web-console sentence | same |
| Leaving the screen | does not cancel the search; returning restores the state from op 94 | same | same |

### 8c.8 Forward-only rule

The progress value derives from **Core instants** (`startedAt`, `windowMs`, `coreClockOf`) and only
grows; the end of a search is the answer of op 94, never the bar. The list never shrinks or reorders
while it lives. No countdown is drawn for the search window, the result lifetime or a rate limit, and
nothing retries by itself (R-10 AC-4; §2.7).

---

## 8d. Flow 10 — Connect a camera (web console only; R-9 AC-5..AC-10, AC-12, AC-13) **Erratum PE-125-10**

### 8d.1 Which client may enter a camera password — and the source

| Client | May enter a camera user name and password | Source |
|---|---|---|
| **Web console** | **Yes** — the only client | **D80(3)** (`decisions/decisions.md:93`): "credential entry for a camera is WEB CONSOLE ONLY in this phase"; enforced by the server through the access condition `WEB_CONSOLE_SESSION` on operations 89, 95, 96 (`C3 §2.6` access notes; D81) |
| Tablet | **No** — search, list, statuses, notifications, label; a pointer to the web console | D80(3); a forced call answers `403 NOT_PERMITTED` (`WEB_CONSOLE_ONLY`) before the body is read |
| Phone | **No** — as the tablet | D80(3) |

This overrides the wording of blueprint row 125 ("web System/Devices and tablet/phone Devices") and the
proposal in `specs` R-9 AC-12. Precedent: the R-8 secret field of §8a is web-only.

### 8d.2 Trigger and entry state (web)

| Item | Definition |
|---|---|
| Trigger | **Connect** (G14) on a row of the caller's own live result that is `NEW` and `testable` |
| Entry state | `CAPTURE_CONFIG`; a web console session; **no session open** (`captureConfig.locked: false`); the result not expired (op 94 is re-read before the dialog opens) |
| Surface | kit `Modal` titled "Connect {{name}}" (the announced name, else the address). Header lines: address, make and model, device reference (`endpointRef`) — all as plain text |
| Order | Connect -> user name and password -> **Test connection** (op 95) -> outcome -> **Add as camera** (op 96) -> result -> assign in the selector (flow 1). No step can be skipped: Add as camera exists only after a *reachable* outcome (`adoptable: true`) |

### 8d.3 The password prompt

| Rule | Definition | Source |
|---|---|---|
| Fields | "Camera user name" (kit `TextField`, 1..255 characters) and "Camera password" (kit `TextField` with `type="password"`, 1..1024 characters), each with a kit `Label`; a `Description`: "Enter the user name and password set on this camera. They are used for this connection only and are never shown again." | op 95 `CaptureConnectionTestRequest`; `devices.ts:149-156` |
| Always empty | Both fields are empty every time the dialog opens. Nothing is pre-filled: no stored value exists on the client, the Core returns none (0 response shapes carry a credential, `C3 §2.6`), and the browser is told not to fill them (`autocomplete="off"` on the user name, `autocomplete="new-password"` on the password, no `name` a password manager would match) | R-9 AC-7; §8a "Secrecy" |
| No "show stored" | There is no control that shows a stored password, a stored user name, a hint, a length or a last-changed value — on any client. This phase also has **no** reveal toggle for the value being typed (as §8a); see OP-125-6 | row 125 verification; C-N15 |
| Where the typed values live | In the form state of the open dialog only (`react-hook-form`, local to the `Modal`). They are sent in the body of op 95 and, unchanged, in the body of op 96, through `useCoreActions` + `settle` — not through a query or mutation cache. They are never written to the URL, router state, browser storage, a toast, a log line or the error sink | `C3 §2.6` "Credential in memory"; P-07 |
| Kept for two requests, not asked twice | After a *reachable* outcome the two fields become read-only and keep their values so that **Add as camera** sends exactly what was tested. "Change" re-enables them and removes the outcome (a new test is needed) | row 121 hand-over ("decide whether the form keeps it"); frame, alternative (2) |
| Cleared | The password is cleared after an *authentication failed* outcome (the user name is kept). **Both fields are cleared when the dialog closes** — by Close, by Escape, by a completed adoption, by navigation, by sign-out — and the form unmounts | R-9 AC-8 |
| Development source | For a candidate of `sourceClass: DEVELOPMENT` the dialog shows "This development source needs no password." and no field; a kit `Switch` "Enter a user name and password" reveals the two fields for a test camera that has them | op 95: `credential` optional for `DEVELOPMENT` |
| Validation | Empty field on Test -> `FieldError` "Enter the camera user name and password." before any request (and for `422 CREDENTIAL_REQUIRED`) | `C3 §4` |

### 8d.4 Per-step states and outcomes (web)

| # | Step | State drawn | Source |
|--:|---|---|---|
| 1 | Dialog open | Fields empty and enabled; **Test connection** enabled once both have text; no **Add as camera** | §8d.3 |
| 2 | Test running | **Test connection** pending (`Spinner`), fields read-only, Close disabled; text "Testing the connection…" and "This can take up to {{seconds}} seconds." (`CAPTURE_CONNECTION_TEST_TIMEOUT_MS / 1000`, fixed number). One request; nothing repeats it | op 95 |
| 3 | Outcome | one kit `Alert` under the fields, see the table below; focus moves to it | op 95 `200 CaptureConnectionTest` |
| 4 | Adding | **Add as camera** pending, Close disabled; "Adding the camera…" | op 96 |
| 5 | Added | The dialog body is replaced by the result (§8d.6) | op 96 `201` |

A failed test is a **result**, not an error: it is drawn as an outcome in the dialog, never as an error toast.

| Outcome (`outcome`) | Tone | Message | What the fields do | Next action offered |
|---|---|---|---|---|
| `REACHABLE` | success | "Connection works. This camera can be added." (with "{{count}} usable video profile(s)" from `usableProfileCount`) | read-only, values kept | **Add as camera**; "Change" |
| `UNREACHABLE` | warning | "The camera did not answer. Check its power and network cable, then test again." | unchanged | **Test connection** again (a new operator action) |
| `AUTHENTICATION_FAILED` | danger | "The camera refused this user name or password." and, from `failedAttemptsRemaining`: "{{count}} more attempt(s) before testing this camera is paused." | password cleared, focus in the password field | type again, **Test connection**; at `0` remaining the button is disabled with the lock-out sentence below |
| `WRONG_PROFILE` | warning | "The camera answered, but it offers no video profile this system can use. Change the video settings on the camera, then test again." | unchanged | **Test connection** again |
| `NOT_H264` | warning | "The camera answered, but none of its video profiles is H.264. Set the camera to H.264, then test again." | unchanged | **Test connection** again |

### 8d.5 Refusals (web) — each is an explained state in the dialog or on the row

| Answer | Where it is drawn | Message | Next action |
|---|---|---|---|
| `429 RATE_LIMITED` (`CONNECTION_TEST_LOCKOUT_GUARD`) | dialog, kit `Alert` (warning); Test and Add disabled until the instant of `retry-after` | "Testing this camera is paused so that the camera does not lock its account. Try again after {{time}}." (a clock time, not a countdown) | Close; test again after that time |
| `429 RATE_LIMITED` (`CONNECTION_TEST_RATE_LIMITED`) | dialog, inline | `common.coreErrors.limited` with the fixed seconds value | the button re-enables by itself; no automatic test |
| `409 CAPTURE_CONFIG_LOCKED` | **before the dialog:** the row's Connect is disabled with "A camera cannot be connected while a session is open." (from `captureConfig.locked`). **Inside an open dialog** (a session opened meanwhile): the same sentence in a kit `Alert` (`status="accent"`, as `evidence/integrity-tab.tsx:246` — not a danger state), Test and Add disabled | as written | Close; search stays available; **never a toast** (D80(4)) |
| `404 NOT_FOUND` | dialog | "This search result is no longer kept. Search again." | **Search again** closes the dialog and starts flow 9 |
| `409 INVALID_STATE` (`CANDIDATE_ALREADY_REGISTERED`) | dialog | "This camera is already registered as {{device}}." | "View device" |
| `409 INVALID_STATE` (`CANDIDATE_NOT_TESTABLE`) | row (Connect is not offered, §8c.3) | "This device announced an address that is not its own." | none |
| `409 INVALID_STATE` (`CONNECTION_TEST_IN_PROGRESS`) | dialog | "A connection test for this camera is already running." | wait; the button re-enables when the pending request answers |
| `409 INVALID_STATE` (`CANDIDATE_NOT_TESTED`) on Add | dialog | "The connection test is too old. Test the connection again." | fields enabled, **Test connection** |
| `409 INVALID_STATE` (`CONNECTION_TEST_FAILED`, `details.outcome`) on Add | dialog | "The camera did not pass the final check, so it was not added." followed by the message of that outcome (§8d.4) | as for that outcome |
| **`503 NOT_READY` (`CREDENTIAL_STORE_NOT_READY`) on Add — the state before row 84** | dialog, kit `Alert` (warning), `role="alert"` | "This Core cannot store camera passwords yet, so this camera cannot be added. Nothing was saved." | **Close**. The candidate stays "New". A development source without a password can be added in this state |
| `503 NOT_READY` (`DISCOVERY_NOT_READY`) | dialog | "Camera search is not available on this Core yet." | Close |
| `403 NOT_PERMITTED` (role) | the row's Connect is disabled after the Checking state with the role sentence | `common.rbac.requiresRole` | none |
| `422 INVALID_INPUT` (`CREDENTIAL_REQUIRED`; schema) | `FieldError` on the field | "Enter the camera user name and password." | type, test |
| link down / time-out | dialog | the existing presenter sentences (`common.coreErrors.offline`, `…timedOut`) | Close or test again |

### 8d.6 Adoption result and assignment

| Step | Drawn | Source |
|---|---|---|
| Added | "{{device}} was added." (for example "CAM-03"), the make and model, and one of: "Password stored." (`credentialSet: true`) / "No password is used for this source." (`credentialSet: false`). **No value is shown** — only that fact | op 96 `201 CaptureCandidateAdoption` |
| What "added" means | A line: "The camera is registered but not yet used. Assign it to Camera 1 or Camera 2." Adoption changes no track (`captureConfig` is not changed) | `C3 §2.6` "Adoption is not assignment" |
| Assign | **Assign to a camera slot** closes the dialog and opens the camera-source edit of **flow 1** (G2; ops 78 / 79) — the existing selector, in which the new device is now an option. No track is preselected. **Done** only closes | R-9 AC-5; §2 |
| In the lists | After the answer the Devices page shows the new device (slice `captureDevices`) with its label and, for a development source, the badge; the candidate row reads "Already registered as {{device}}" at the next op 94 read | op 96 realtime; op 94 `status` |
| Replacing the password later | Not in this flow: it is op 89 on the registered device (web only), with the same field rules; removing an adopted camera is not designed (D81 gap) | `C3 §2.6` "Adoption and operation 89" |

### 8d.7 Abandon and close — nothing is registered, and what the UI shows

| Exit | What the UI shows afterwards | Registered |
|---|---|---|
| Close or Escape before a test | The dialog is gone, both fields cleared. The row is unchanged: "New", Connect enabled | nothing |
| Close after any failed outcome | The row stays "New" with the last-test chip of that outcome (from `lastTest`); opening Connect again shows two empty fields | nothing |
| Close after *reachable* without adding | The row stays "New" with the chip "Connection works"; opening Connect again shows two empty fields — the password must be typed again to add | nothing |
| Close while a test or an adoption is pending | Not possible: Close and Escape are disabled until the answer arrives (the request cannot be recalled). If the page is left or the browser closed, the next visit shows what op 94 and the `captureDevices` slice say | whatever the Core answered — never a half state |
| Sign-out, session expiry, Core restart in mid-flow | After signing in again: no dialog, the search panel idle (S2), no new device | nothing |

In none of these exits does a device row, a "password set" mark or a pending row appear: a device
exists only after op 96 answered `201` (`C3 §2.6`, R-9 AC-8). No "draft" is kept on the client.

### 8d.8 Operations, slices, audit

| Operation | Access | Slice | Audit |
|---|---|---|---|
| 95 `testCaptureCandidateConnection` | `PERMISSION CAPTURE_CONFIG` + `WEB_CONSOLE_SESSION`; idle only | none | `CAPTURE_CONNECTION_TESTED`, one row per attempt, every outcome |
| 96 `adoptCaptureCandidate` | `PERMISSION CAPTURE_CONFIG` + `WEB_CONSOLE_SESSION`; idle only | publishes `captureDevices` | `CAPTURE_CANDIDATE_ADOPTED` (+ `CAPTURE_CONNECTION_TESTED`; + `CAPTURE_CREDENTIAL_SET` when a password is stored) |
| 78 / 79 (assignment, flow 1) | `PERMISSION CAPTURE_CONFIG`; idle only | publishes `captureConfig` | `CAPTURE_CONFIG_CHANGED` |
| 89 `setCaptureDeviceCredential` (later replacement) | `PERMISSION CAPTURE_CONFIG` + `WEB_CONSOLE_SESSION`; idle only | publishes `captureConfig` | `CAPTURE_CREDENTIAL_SET` |

### 8d.9 Permissions and gated-control behaviour

| Control | Permission / condition | Checking state | Allowed | Refused / locked |
|---|---|---|---|---|
| G14 Connect (opens the prompt) | `CAPTURE_CONFIG` + web console + idle | "Checking your permissions…" | web: opens the dialog | web: role sentence; session open -> disabled + "A camera cannot be connected while a session is open." **Tablet, phone: always disabled + "Connect this camera from the web console."** |
| G15 Test connection (op 95) | same; web only | inherits the dialog's state | one test | the refusals of §8d.5 |
| G16 Add as camera (op 96) | same; `adoptable: true`; web only | inherits | adoption | the refusals of §8d.5 |

### 8d.10 Per-client definition

| Aspect | Web | Tablet | Phone |
|---|---|---|---|
| Connect flow | The whole flow of §8d.2-§8d.7 | **Not available.** Each `NEW` row shows Connect disabled with "Connect this camera from the web console." and one panel note: "Camera passwords are entered on the web console only. Open Devices on the web console and search there." | same as the tablet |
| Why "search there" | — | A list belongs to the session that searched (§8c.4): the tablet's list is not on the web console, so the operator runs the search again there | same |
| Session open | Connect disabled, explained (§8d.5) | The web-console sentence stays; no second reason is stacked on it | same |
| Password field | two kit `TextField`s in the `Modal` | **none in the component tree** | **none in the component tree** |
| After a camera was added on the web | row "Already registered"; device in the lists | the device appears through the `captureDevices` slice; the selector (flow 1) offers it | same |

### 8d.11 Forward-only rule

No timer is drawn. The test duration, the lock-out pause and the validity of a *reachable* outcome
(`CAPTURE_CONNECTION_TEST_VALIDITY_MS`) are decided by the Core: the client learns an expired outcome
from `adoptable: false` at the next op 94 read or from `409 CANDIDATE_NOT_TESTED`, never from its own clock.

---

## 8e. Flow 11 — No-device notifications (R-10) **Erratum PE-125-11**

### 8e.1 Rules for all three situations

| Rule | Definition | Source |
|---|---|---|
| One alert, drawn everywhere | Each notification is one alert raised by the Core and read by every client from the `alerts` slice; a client never raises, counts or stores its own copy | R-10 AC-6; `C3 §5.4` |
| Told apart by reason | The title and body come from `params.reason` (+ `phase`, `deviceKind`, `cause`), **not** from `common.faultKind.*`: the WARNING cases have the kind `SYSTEM`, which has no fault label or icon of its own — the severity icon of the alert centre is used (`notifications-bell.tsx:19-22`) | `C3 §5.4`; row 121 hand-over |
| Names, never values | Texts name the device by label and id ("Camera 2 (CAM-02)"), and counts. Never an address, a user name, a password or a URL | R-10 AC-6; E-30 / E-31 |
| Cleared by the Core only | A banner, a row mark or an alert-centre item disappears at the first state update after the Core resolved the alert. No client hides it by a timer; "Acknowledge" in the alert centre keeps its existing meaning (the unread count) and resolves nothing | R-10 AC-5; D72(h) |
| No countdown, no automatic retry | — | R-10 AC-4 |

### 8e.2 The three situations — placement, severity, text, action

| Situation (alert) | Severity | Web | Tablet | Phone | Text keys (§14.2) | Action offered |
|---|---|---|---|---|---|---|
| **A — a search found nothing** (`SYSTEM`, `reason: CAPTURE_DISCOVERY_EMPTY`) | WARNING | (1) the searching operator: the empty state S5 in the search panel; (2) everyone: `DevicesBanner` on the Devices page; (3) alert centre item in `NotificationsBell` | (1) empty state S5 on the Devices screen; (2) the `devices-attention` `Alert` on the Devices screen; (3) Home header bell | (1) and (2) in Settings -> Devices; (3) Home header bell | `captureNotice.discoveryEmpty.*` | **Search again** (G13) |
| **B — a configured camera or microphone is unreachable at pre-check** (`SYSTEM`, `reason: CAPTURE_DEVICE_UNREACHABLE`, `phase: PRECHECK`; one alert per device) | WARNING (the pre-check item itself is WARN or BLOCK by the start rule of §8g.3) | (1) **Session New** (WB-03): the item's row in `DevicesStep` names the device and, for a camera, the count of the one search the pre-check ran; the blocked or warning `Alert` of that step lists the devices; (2) Devices page: the device row reads "Not reachable" and the banner names it; (3) alert centre item | (1) **Session New** (MB-02): the row in `DevicesCheckStep` and its blocked / warning `Alert`; (2) Devices screen row + `devices-attention`; (3) Home header bell | same as the tablet, compact | `captureNotice.unreachable.precheck.*`, `captureNotice.cause.*` | Camera: **Search again** (G13). Microphone: **Search again** = re-read of the local inputs (G17, flow 13). In Session New also the existing **Retry** of the pre-check (`retryPrecheck`, `SESSION_START`) |
| **C — no camera connected at session start** (`CAPTURE_FAULT`, `reason: NO_CAMERA_CONNECTED`, `evidenceFiles: 0`) | **CRITICAL** | (1) **Session Monitor** (WB-01): the fault presentation of `StatusBanner` — "No camera connected. Nothing was recorded."; (2) Dashboard (WB-02): the session tile shows the fault, both camera tiles NO SIGNAL; (3) alert centre item; (4) Devices banner | (1) **Session Live** (MB-03) fault presentation, then the existing fault hand-off; (2) Home (MB-01) session and camera tiles; (3) Home header bell; (4) Devices `devices-attention` | (1) Session Live; (3) Home header bell; (4) Settings -> Devices | `captureNotice.noCamera.*` | **Search again** (G13; it works while the faulted session is still open, D80(4)). Connecting is refused while a session is open (flow 10) |
| **C, degraded — one camera of two connected** (`SYSTEM`, `reason: CAPTURE_DEVICE_UNREACHABLE`, `phase: SESSION_START`) | WARNING | Session Monitor: a warning banner naming the missing camera; that camera's tile reads NO SIGNAL; the recording timer and the other tile run normally; alert centre item | Session Live: warning banner + NO SIGNAL tile; Home header bell | same | `captureNotice.unreachable.sessionStart.*` | **Search again** (G13); no connect while the session is open |

What situation C must **not** draw (D72(i), D72(k), R-10 AC-3): a running recording timer, a recording
indicator, generated audio meters, a camera loop presented as live, or any wording that suggests
evidence exists. The texts say "Nothing was recorded." in full.

### 8e.3 The operator without `CAPTURE_CONFIG`

| Point | What this operator gets | Source |
|---|---|---|
| Pre-check search | It runs once for the pre-check they started (no `CAPTURE_CONFIG` needed) and they see **its outcome as the notification only**: the pre-check row "Camera 2 (CAM-02) is not reachable. A search found {{count}} camera(s)." (count from `params.searchResponderCount`) and the alert-centre item | D80(2); `C3 §2.6` "Search trigger" |
| Candidate list, Connect | **None.** No list is requested (op 94 would answer `403`) and no Connect control is drawn for them | R-9 AC-12 |
| Search again | Drawn after "Checking your permissions…" as **disabled** with "Requires the SUPERVISOR or TECHNICIAN role" | R-10 AC-4 |
| What they can do | The existing **Retry** of the pre-check (their `SESSION_START`), which checks reachability again and runs the one search again; acknowledge a warning and start degraded when the start rule allows it; otherwise ask a supervisor or technician | `C3 §3.1` |
| Situations A and C | The same banners and alert-centre items as everyone, with the disabled Search again | R-10 AC-6 |

### 8e.4 Clearing on a later success

| Notification | Cleared when the Core resolves the alert after | What every client then shows |
|---|---|---|
| A | the next search of **any** session with at least one responder | banner and alert item gone; the searching operator sees the list |
| B | a later pre-check run in which that device is reachable | the row passes; banner and alert item gone; the Devices row returns to its normal status |
| C | the capture side, when a camera connects in a later session (`FAULT_CLEARED`; never the demo fault operation 74) | fault presentation gone with that session's end state; alert item gone |
| C, degraded | the capture side, when that camera connects in a later session | warning banner and alert item gone |

A later occurrence is a **new** alert (new id, new audit row): it is drawn as new and counted as unread
again. After clearing, 0 stale banners remain after the next state update (R-10 AC-5).

### 8e.5 Operations, slices, audit

| Read / operation | Access | Slice | Audit |
|---|---|---|---|
| alerts (existing) | `AUTHENTICATED` | `alerts` | none by the client; the Core wrote `CAPTURE_DISCOVERY_SEARCHED` (A), `CAPTURE_DEVICE_UNREACHABLE` (B; C degraded), `FAULT_RAISED` (C) |
| device state | `AUTHENTICATED` | `captureDevices`, `captureConfig` (`online`, `streamState`) | `NONE-R` |
| pre-check result, session fault | existing | `session` | existing |
| 93 (Search again), 97 (microphones) | `CAPTURE_CONFIG` | see flows 9, 13 | see flows 9, 13 |

### 8e.6 Per-client definition and forward-only rule

| Aspect | Web | Tablet | Phone |
|---|---|---|---|
| Banner component | `DevicesBanner` (new banner kinds ranked in `features/devices/model.ts` beside the existing ones); kit `Alert` in `DevicesStep`; `StatusBanner` on the monitor | kit `Alert` (`devices-attention`; `DevicesCheckStep`); the Session Live banner | same, compact |
| Alert centre | `NotificationsBell` popover | Home header bell | Home header bell |
| Announcement | banners are `role="status"`; the CRITICAL fault is `role="alert"` | `accessibilityLiveRegion="polite"` / `"assertive"` for CRITICAL | same |

No notification carries a timer. Each is a snapshot of the `alerts` slice and changes only when the slice does.

---

## 8f. Flow 12 — Development sources: one label everywhere, and the local-device rows (R-11 AC-2, AC-5, AC-6) **Erratum PE-125-12**

### 8f.1 The badge

| Property | Definition |
|---|---|
| Wording | **"Development source"** — one text on every surface and every client (`common.sourceClass.badge`) |
| Form | One small presentational badge per client, built on the kit chip (web kit `Chip` / the devices `StatusChip`; mobile `StatusChip` from `@/components/kit`), tone `warning`, with an icon **and** the text — never colour alone. The same component is used on every surface below; no surface draws its own variant |
| Kind text | A secondary text beside or under the badge names the kind: "This Mac's camera" / "This Mac's microphone" (`adapter: LOCAL_DEVICE`; on tablet and phone "Core Mac's camera" / "Core Mac's microphone", because the tablet is not the Mac — OP-125-7) or "Test source" (`adapter: FAKE`) |
| Never hidden | The badge is not collapsible, not behind a tooltip, not dropped on a compact layout: when space is short the name is shortened, the badge stays |
| Decided by the Core | The client draws the badge **only** from a `sourceClass` the Core sent. It has no development switch, no filter and no local rule ("loopback address means development") |

### 8f.2 Where it is drawn, and from which data

| Surface | Web | Tablet | Phone | Data source (never client state) |
|---|---|---|---|---|
| Devices rows | camera tiles and audio-input cards of the Devices page (WB-05); the device drawer header | `DeviceRow`, `DeviceDetail` (MB-08) | Settings -> Devices rows (MB-09) | `CaptureDevice.sourceClass`, `adapter` (op 77; slice `captureDevices`) |
| Selector (flow 1) | each camera and mic line, and each option of the source selects | each line and each sheet option | same | `CaptureConfig` line `sourceClass` (op 76); options from op 77 |
| Search list (flow 9) | the separate group, each row | same | same | `CaptureCandidate.sourceClass` (op 94) |
| Pre-check (flow 7, 11) | camera and microphone rows of `DevicesStep` (WB-03) | rows of `DevicesCheckStep` (MB-02) | same | the session's `captureConfig` snapshot (op 27) |
| Session Monitor tiles | camera tiles and mic meters (WB-01); Dashboard tiles (WB-02) | Session Live camera tiles and mic cards (MB-03); Home tiles (MB-01) | Session Live (MB-03) | the session's `captureConfig` snapshot (op 27); `audioSource` for the active mic |
| Sealed evidence item | evidence list row, preview card, detail header (WB-04) | evidence row, detail header, Session Summary (MB-07, MB-05) | same | the **package** mark: manifest field 126 `developmentSources`; per file, field 124 `tracks[].sourceClass` (`06_evidence_package_spec.md` §B.12) — see OP-125-3 for the response member |
| Verify result | integrity tab (WB-04): the line **"DEVELOPMENT SOURCES — this package was not recorded from production devices."** first, above the per-check results, never collapsed, then one entry per source; the verdict chip follows unchanged | integrity tab / live integrity (MB-07) and Session Summary (MB-05): same line first | same | the `sources` block of the verify result (V-15, `06_evidence_package_spec.md` §D.1) |

Rules for the sealed item (row 124, `06` §D.1, lines 644-648). (1) The label of a sealed item comes
from the manifest or the verify result, **never** from the current device list — a camera re-registered
later does not change an old package. (2) A development package verifies **PASS**; the badge and the
PASS verdict are shown together and neither replaces the other. (3) "REAL" in an integrity field does
not mean "production": no text may present a development package as production. (4) When verification
fails on the manifest (V-03 / V-09) the source line reads "Sources: not trustworthy — the manifest was
altered" and no class is printed as fact. (5) An all-production package reads "Sources: declared as
production devices by the Core that sealed this package." (the word *declared* is required). (6) A v1
item reads "Sources: not recorded (v1 package)". (7) The two vocabularies are not mixed: device shapes
say `PRODUCTION` / `DEVELOPMENT` with `adapter` `LOCAL_DEVICE` / `FAKE` (`C3 §2.6`); the manifest says
`PRODUCTION` / `LOCAL_DEVICE` / `FAKE` (`06` §B.12). Both map to the one badge: badge = not `PRODUCTION`.

### 8f.3 The local-device rows

In the development configuration camera 1 is this Mac's camera and microphone 1 this Mac's microphone;
camera 2 and microphone 2 are test sources (D74(2); R-11 AC-3). Each local device is one ordinary
device row with the badge and one of these states:

| State | Shown when | Chip | Sentence | Action |
|---|---|---|---|---|
| Ready | the device is present and reachable (`online`; for a microphone op 97 `present: true`, `errorCode: null`) | "Ready" (success) | — | the normal row actions |
| Permission needed | `PERMISSION_DENIED` (op 97 `errorCode` for a microphone; `params.cause` of the active situation-B alert for a camera) | "Permission needed" (warning) | Camera: "macOS has not allowed camera access for the Core. On the Mac that runs the Core, open System Settings > Privacy & Security > Camera, allow it, then search again." Microphone: the same with "Microphone" | **Search again** (G13 camera / G17 microphone). **No control opens or changes a system setting** — allowing access is the user's own action on the Mac (R-11 AC-9) |
| Busy | `DEVICE_BUSY` | "In use" (warning) | "Another application is using this camera (microphone). Close that application, then search again." | Search again |
| Not connected | `DEVICE_NOT_FOUND` | "Not found" (danger) | "This Mac's camera (microphone) was not found." | Search again |

**Never silently replaced (D80(11); R-11 AC-5).** A local device in any state but Ready stays the same
row with the same name and the same badge, reads as not reachable, and ends in the notification of
flow 11 (situation B at pre-check; the degraded warning or situation C at session start). The client
never shows a test source in its place, never renames the row, and offers no "use a test source
instead" shortcut; choosing another source is an ordinary selector edit (flow 1) by an operator.

**Not in the production configuration (R-11 AC-2).** With the development flag off, ops 76 / 77 list 0
development devices and a search lists 0 development candidates, so: 0 badges, no "Development sources"
group and header, no local-device rows, no option in any select. An assignment that names one answers
`422 INVALID_INPUT` (`DEVELOPMENT_SOURCE_NOT_ALLOWED`), shown as the field message "This source can
only be used in the development configuration."

**Simulated mode (row 121 asked).** The in-app simulator's devices are `adapter: FAKE`,
`sourceClass: DEVELOPMENT` (`C3 §2.6` "Simulator"), so in Simulated mode every device, tile and demo
package carries the badge. This is kept — one rule, drawn from the data, and D81 rules demo packages
`FAKE` "(truthful)". The empty state S5 is not reachable in Simulated mode (the simulator always
answers two candidates); it is covered by component tests and by the Core with the fake stub set empty.

**Privacy (D80(11); R-11 AC-8).** No frame and no audio excerpt of a local-device recording appears
in any document, screenshot evidence or fixture under `docs/`; checks of this flow record text, ids,
counts and DOM / view-tree facts only.

### 8f.4 Operations, permissions, per-client definition

| Aspect | Definition |
|---|---|
| Operations | none of its own: reads 76, 77, 94, 27, 39 / 40, 41; the row actions are G13 / G17 |
| Gated control | none new; the badge and the rows are visible to every signed-in role (ops 76 / 77 are `AUTHENTICATED`) |
| Web | badge on the surfaces of §8f.2; local rows in the Devices page panels |
| Tablet | same surfaces through `DeviceRow` / `DeviceDetail`, constant border |
| Phone | same, compact |
| Forward-only | the badge is a property of the data and never changes during a session: the adapter of a device is written once (`C3 §2.6`), and a sealed item's mark is in the signed manifest |

---

## 8g. Flow 13 — Microphones: "Search again" re-reads the local inputs, and the active-microphone rule at pre-check (R-10 AC-2; D80(5), D80(6), D81) **Erratum PE-125-13**

### 8g.1 Trigger, entry state, states

| Item | Definition |
|---|---|
| Trigger | **Search again** (G17) on a microphone notification, on a microphone row that is not reachable, or in the microphone panel of Devices. Visible label "Search again" (R-10 AC-4: one action name on every notification); accessible name "Search again for microphones"; description under it: "Re-reads the microphones connected to the Core. Microphones are not searched on the network." |
| What it is | Operation 97 `rescanCaptureInputs`: one request, one answer. **No network search, no list of candidates, nothing to connect, no password** — microphones are local inputs (D80(5); OD-06) |
| Entry state | `CAPTURE_CONFIG`; web, tablet, phone; any session state (op 97 is not locked by an open session, `C3 §2.6` "Config lock"; whether it is safe during RECORDING is row 123's open point — if the contract restricts it, the control is disabled with that reason while recording) |

| # | State | Contract answer | Web | Tablet | Phone |
|--:|---|---|---|---|---|
| 1 | Checking | role / link unresolved | button disabled, "Checking your permissions…" | same | same |
| 2 | Idle | — | button enabled | same | same |
| 3 | Reading | request pending | button pending (`Spinner`); no progress bar, no polling | same (`PendingSpinner`) | same |
| 4 | Result | op 97 `200 CaptureInputScan` | each registered microphone row reads present ("Ready") or not, with the sentence for its `errorCode` (§8f.3); "Checked at {{time}}" from `scannedAt`; the rows also follow the `captureDevices` slice | same | same |
| 5 | Other inputs present | `unregisteredCount ≥ 1` | one line: "{{count}} other microphone(s) are connected to the Core but not registered." No action — registering a microphone is not designed in this phase | same | same |
| 6 | Too soon | `429` (`INPUT_RESCAN_RATE_LIMITED`) | `common.coreErrors.limited`, fixed seconds; re-enables by itself | same | same |
| 7 | Not ready | `503` (`CAPTURE_NOT_READY`) | "Capture is not ready yet" + Retry (§2.5) | same | same |
| 8 | Not permitted | `403` | disabled + role sentence | same | same |

### 8g.2 Operations, slices, audit

| Operation | Access | Slice | Audit |
|---|---|---|---|
| 97 `rescanCaptureInputs` | `PERMISSION CAPTURE_CONFIG`; web, tablet, phone | publishes `captureDevices` (`online` of the microphones) | `CAPTURE_DISCOVERY_SEARCHED` with `scope: MIC_LOCAL` |

### 8g.3 The start rule at pre-check (binding: D80(6), D81, D72(k))

Drawn in Session New on all three clients (WB-03 `DevicesStep`; MB-02 `DevicesCheckStep`), on the
existing blocked (`PRECHECK_BLOCKED`) and warning (`PRECHECK_WARNINGS` + acknowledge) paths.

| Reachability at pre-check | Row(s) | Start | What the operator is told and offered |
|---|---|---|---|
| Both cameras unreachable | both camera rows BLOCK | **Blocked** | "No camera is reachable. A session cannot start." + the search count; Search again (G13); Retry |
| One camera unreachable | that row WARN | **Allowed, degraded** after acknowledging | "Camera 2 (CAM-02) is not reachable. The session will record one camera only." Acknowledge; Search again; Retry |
| Both microphones unreachable | both microphone rows BLOCK | **Blocked** | "No microphone is reachable. A session cannot start." Search again (G17); Retry |
| **The selected ACTIVE microphone unreachable, the other reachable** | active-microphone row BLOCK | **Blocked until the operator makes the reachable microphone active**; then **allowed, degraded**, with a warning | "MIC 1 (MIC-01) is the active microphone and is not reachable. Make MIC 2 the active microphone to continue." Action **Use MIC 2 as the active microphone** (G18). After it and a re-check the old active microphone is the unreachable standby: WARN "MIC 1 (MIC-01) is not reachable. The session will record with one microphone and no standby." Acknowledge to start |
| The standby microphone unreachable | that row WARN | **Allowed, degraded** after acknowledging | "MIC 2 (MIC-02) is not reachable. The session will record with no standby microphone." Acknowledge; Search again (G17); Retry |
| At session start: no camera connects within the ingest-open window | — | the session **FAULTS**, reason `NO_CAMERA_CONNECTED` | flow 11, situation C: "No camera connected. Nothing was recorded." Nothing claims to record |

The client never switches the active microphone by itself (OD-11) and never starts a degraded session
without the operator's acknowledgement.

**G18 has no operation in the contract yet (OP-125-1).** D81 rules the behaviour; `C3 §3.1` still
proposes "blocked, with a sentence telling the operator to make the other microphone primary before
starting", because op 80 (`setPrimaryMic`) answers `409 CAPTURE_CONFIG_LOCKED` once a session exists —
and the pre-check runs on a session in `PRECHECK` (`packages/shared/src/api/sessions.ts:248`) — while
op 81 (`switchAudioSource`) is valid only in `RECORDING`. Until rows 121 / 128 name the operation, the
row is drawn with the blocked sentence and the path that works today: "Cancel this session, make MIC 2
the primary microphone on Devices, then start again." (op 80 while idle, `CAPTURE_CONFIG`). This spec
fixes the control, its place and its texts; it does not invent the operation.

### 8g.4 Permissions and per-client definition

| Control | Permission / condition | Checking state | Allowed | Refused |
|---|---|---|---|---|
| G17 Search again (microphones) | `CAPTURE_CONFIG` | "Checking your permissions…" | re-reads the inputs | role sentence; `429`; `503` |
| G18 Use the other microphone as active (pre-check) | proposed: `SESSION_START` + session holder, as G4 — to be fixed with the operation (OP-125-1) | "Checking your permissions…" | makes the reachable microphone active, then the pre-check runs again | role sentence; until the operation exists: the fallback sentence above |

| Aspect | Web | Tablet | Phone |
|---|---|---|---|
| Surface | Devices audio-input cards (WB-05); Session New `DevicesStep` (WB-03) | Devices microphone rows (MB-08); Session New `DevicesCheckStep` (MB-02) | Settings -> Devices (MB-09); Session New (MB-02) |
| Forward-only | "Checked at" is a Core instant (`scannedAt`); no timer, no automatic re-read | same | same |

---

## 9. P-01..P-16 pattern application (16/16)

Each pattern from `drift §2.1` is applied to this UX spec or marked NOT APPLICABLE with a reason.

| Pattern | Applied in flow(s) | Status and reason |
|---|---|---|
| P-01 mobile recording time from one source; progress forward-only from Core instants | 2, 3, 4, 7 | **Applied** — all timers use `coreClockOf`/`recording-elapsed.ts:1-21,128-144`; `core-clock.ts:82-88`; never steps back (E-13) while RECORDING; after the Core reports the stop the authoritative recorded duration wins (D19(b)) |
| P-02 server imports contract constants; extend `contract-values.test.ts` | 1, 2, 3 | **Applied** — the UI reads thresholds/enums from `@dems/shared/api` (`packages/shared/src/api/capture.ts`, CS-25); no copied literal (OD-11 values, v2 step codes) |
| P-03 device command map derived from the contract | 1 (G9) | **Applied** — the PoE cycle is the contract entry op 48 (`C3 §3`), rendered through the existing gate |
| P-04 web query factories + `lib/download.ts` + `device-command-gate.ts` | 1, 3, 5, 6 | **Applied** — new factories in `core-queries.ts` (WB-11, E-17); download via `download.ts:26-41`; G9 via `device-command-gate.ts:50-61`. **PE-125-14:** flows 9, 10 add one factory `captureDiscoveryQueryOptions` for op 94 (gate inside the factory, polling only while `RUNNING`); the typed camera password never enters a query or mutation cache (§8d.3) |
| P-05 Restart disabled while recording | 1 (G9) | **Applied** — PoE cycle refused during `RECORDING` (`409 RECORDING_ACTIVE`, `C3 §4`) |
| P-06 `AdminResource.DEVICES` is the paired-client registry | 1 | **Applied** — capture uses `captureConfig`/`captureDevices`, their own slice/kind (E-04; `C3 §6`) |
| P-07 blank `ses_`/`dvc_`/`bio_` values in web/mobile logs | 5 | **Applied** — the signed media URL prefix `mts_` and the camera-credential form `rtsp://user:pass@host` are added to the web error sink and `runtime/log.ts` (E-31/P-07; SEC35-13/SEC35-04). **PE-125-14:** flow 10 adds the request members `username`, `secret` and the nested `credential` object of ops 95 / 96 to the web blanking list (the mobile clients never hold them) |
| P-08 mobile jest timeouts/`maxWorkers`; fake clocks | 2, 3, 4, 7 | **Applied** — every timing state (toggle latency, sealing progress, debounce) gets a fake-clock test; no wall-clock waits (notes for row 36) |
| P-09 static guards outside `src`; test-support imports | all (test notes) | **Applied** — new `capture/` guards follow the test-support rule; noted for row 36 (`drift §2.1 P-09`) |
| P-10 `selection-glow.tsx` constant border | 1, 5, 6 | **Applied** — new tablet list rows (selector, intervals, revisions) use `ROW_CARD_BORDER` (`selection-glow.tsx:40`). **PE-125-14:** the search-list rows of flow 9 too |
| P-11 in-place hand-offs, `animation:'none'` | 3, 4, 7 | **Applied** — mobile uses `monitor-handoff.ts`, `summary-handoff.ts`, `stacks.tsx:59` |
| P-12 session diagnostics for sealing progress / mic-switch latency | 2, 3 | **Applied** — `session-diagnostics.ts` is the instrumentation for the tablet gates; named for row 36 |
| P-13 "Checking your permissions..." on every gated control; web waits for the link | all flows | **Applied** — section 5 inventory (10 controls + 6 reads). **PE-125-14:** with flow 8 and flows 9-13 the inventory of section 11 holds 18 controls + 8 reads |
| P-14 `sweeper.ts` core-timer template | 3 | **Applied** — the 1 Hz progress recompute (`SEALING_PROGRESS_INTERVAL_MS`) is the server-side source; the UI consumes the slice |
| P-15 `statements.ts` one `CREATE DATABASE` text | — | **NOT APPLICABLE** — a database-command rule with no client surface (row 30 owns it) |
| P-16 pinned verify verdict (web) / FAIL wording (mobile) | 5, 6 | **Applied** — the v2 verify verdict is pinned per run; export-failure and revision-conflict wording is fixed (`drift §1.4 WB-04`, E-11) |

**Count: 15 applied, 1 NOT APPLICABLE (P-15, with reason) = 16/16 accounted.**

---

## 10. E-13..E-17 handling (5/5)

| Errata | Content (`drift §6`) | How this spec applies it | Status |
|---|---|---|---|
| **E-13** | MB-04/MB-05/MB-06: use in-place hand-offs + `animation:'none'`; progress forward-only from Core instants; MB-04 risk → High | Flows 3, 4, 7 (mobile): in-place `finalizing → summary` and `monitor`; all progress forward-only from Core instants; MB-04 High acknowledged; React draws final stepper state | **Applied** |
| **E-14** | MB-01: fold B15 (tablet Home mic tiles "No signal") and RC-1 (`recording-elapsed.ts:129`); risk Low → Low-Medium | Flow 2: Home mic tiles (MB-01) never show "No signal" while recording; the forward-only timer (RC-1) is reused; Home progress tile in flow 3 | **Applied** |
| **E-15** | MB-08/MB-09/MB-12: new tablet list rows use `SelectionGlow` constant border | Flows 1, 5, 6: selector device rows, audio-source intervals, transcript revisions use `ROW_CARD_BORDER` | **Applied** |
| **E-16** | MB-03/MB-08/MB-09, WB-01/WB-05: gated controls show "Checking your permissions..."; web "waits for the link" | Section 5: 10 controls × 3 clients + 6 gated reads; web `core-queries.ts:65-77` | **Applied** |
| **E-17** | new WB-11: query factories for capture config/devices, transcript, export job | Flows 1, 3, 5, 6: `captureConfigQueryOptions`, `captureDevicesQueryOptions`, `transcriptQueryOptions`, `exportJobQueryOptions` added to `lib/core-queries.ts` | **Applied** |

**Count: 5/5 applied.**

---

## 11. Gated controls and the "Checking your permissions..." state (inventory)

Every gated control shows the **"Checking your permissions..."** state while the role/link resolves —
never a silent hide, never an instant enable (`drift §2.1 P-13`, `drift §6 E-16`, `specs C-N12`).

| ID | Control | Flow | Permission / condition | Client instances |
|---|---|---|---|---|
| G1 | Selector edit | 1 | `CAPTURE_CONFIG` + idle | web, tablet, phone |
| G2 | Camera-source edit | 1 | `CAPTURE_CONFIG` + idle | web, tablet, phone |
| G3 | Primary-mic edit | 1 | `CAPTURE_CONFIG` + idle | web, tablet, phone |
| G4 | Mic toggle | 2 | `SESSION_START` + `SESSION_HOLDER` | web, tablet, phone |
| G5 | Banner "switch to standby" | 2 | `SESSION_START` + `SESSION_HOLDER` | web, tablet, phone |
| G6 | Transcript revise | 6 | `TRANSCRIPT_REVISE` | web, tablet, phone |
| G7 | Playback (media session) | 5 | `EVIDENCE_VIEW` | web, tablet, phone |
| G8 | Export / composite | 5 | `EVIDENCE_EXPORT` | web, tablet, phone |
| G9 | Camera PoE cycle | 1 | `DEVICE_MANAGE` + `LOST` + not recording | web, tablet, phone |
| G10 | Session start | 7 | `SESSION_START` | web, tablet, phone |
| G11 | Save STT configuration (section 8a; restated, **PE-125-15**) | 8 | `CAPTURE_CONFIG` | web (tablet and phone are read-only) |
| G12 | Test STT connection (section 8a; restated, **PE-125-15**) | 8 | `CAPTURE_CONFIG` | web |
| G13 | Search for cameras / Search again **PE-125-15** | 9, 11 | `CAPTURE_CONFIG`; any session state | web, tablet, phone |
| G14 | Connect (opens the password prompt) **PE-125-15** | 10 | `CAPTURE_CONFIG` + web console + idle | web (active); tablet, phone (always disabled with the web-console sentence) |
| G15 | Test connection (op 95) **PE-125-15** | 10 | `CAPTURE_CONFIG` + web console + idle | web |
| G16 | Add as camera (op 96) **PE-125-15** | 10 | `CAPTURE_CONFIG` + web console + idle + a reachable test | web |
| G17 | Search again for microphones (op 97) **PE-125-15** | 13, 11 | `CAPTURE_CONFIG` | web, tablet, phone |
| G18 | Use the other microphone as active, at pre-check **PE-125-15** | 13 | proposed `SESSION_START` + session holder; operation open (OP-125-1) | web, tablet, phone |

**Gated interactive controls: 10/10** — each of the 30 client instances shows the state. **Gated reads
that also render the state: 6/6** — capture config (76), capture devices (77), sealing progress (83),
transcript (84), revisions (86), evidence item/media (39/40). Every one transitions
`Checking → allowed` or `Checking → refused-with-reason`; none hides or enables instantly.

**Restated for flow 8 (D24) and flows 9-13 (erratum PE-125-15).** Gated interactive controls:
10 (G1-G10) + 2 (G11-G12, flow 8) + 6 (G13-G18, flows 9-13) = **18/18**. Client instances:
30 (G1-G10 on three clients) + 2 (G11, G12: web only) + 14 (G13: 3, G14: 3, G15: 1, G16: 1,
G17: 3, G18: 3) = **46**. Gated reads that render the state: 6 + 1 (STT configuration, op 90 —
flow 8, not counted before) + 1 (the search list, op 94 — `CAPTURE_CONFIG`, owner session) = **8/8**.
The "10/10" and "6/6" figures above are the row-34 baseline and stay as written.

---

## 12. Class C note — what changes when physical devices arrive

This spec is written for **emulators and loopback** (OD-13; C-5; `C3 §9 N-5`). When physical devices
arrive, the client behaviour changes only as follows (no UX redefinition):

| Aspect | Emulator / loopback (this phase) | Physical LAN (class C, C-5) |
|---|---|---|
| Host | Signed media URL host is `127.0.0.1:<port>`; `adb reverse tcp:8081/tcp:4420` | LAN host; `adb reverse` no longer maps the Core; the URL host changes |
| Listener | Loopback only | LAN listener + TLS + origin rules; demo password replaced; B3 (W99-2/W99-3) applied first |
| Live preview | None; demo loop stays (OD-12) | Still none unless OD-12 is revisited (C-6) |
| Device e2e | Emulators; 2 + 1 per check | Physical tablet/phone e2e at M4/M5/M8 (2 + 1); release build preferred for timing (C-5) |
| Media at rest | `.data/` git-ignored (OD-25) | unchanged; long AV-drift run and repeated kill loops only pre-handover (C-9) |
| Camera/mic/PoE | `FakeOnvifStub`, fake mics, `FakePoeController` | Real ONVIF (C-1), real `CameraAdapter` (C-2), real `PoeController` (C-3), real `AudioInputAdapter` (C-4) |
| Camera search and development sources **PE-125-16** | Flows 9-13 are checked on the fake stub and fixture cameras on loopback; in the development configuration camera 1 / microphone 1 are this Mac's own devices and every such surface carries the "Development source" badge | The same screens list real cameras; the connect flow needs the Core credential store (row 84); with the development flag off no badge, no "Development sources" group and no local-device row exists. Development-mode results close no class-C item (D80(11)) |
| STT | Mac oMLX (`omlx-server`), no benchmark (D230) | `cpu-local` whisper.cpp on the Core; benchmark (RTF/RAM/WER/labelling) on the Core device (C-7) |
| Signer | Software Ed25519 (OD-04) | TPM/PKCS#11 adapter (C-8) |

The UX contract (flows, states, gated-control behaviour, forward-only rule) is unchanged; only the
transport host, the auth preconditions and the device adapters change.

---

## 13. Self-gate (this document's own acceptance)

| Gate check (from `structured row 34`) | Result |
|---|---|
| **Each flow defined for all 3 clients** | **7/7 flows × 3 clients = 21/21** — each flow has a per-client table for web, tablet and phone (sections 2.6, 3.6, 4.6, 5.6, 6.6, 7.6, 8.6) |
| **P-01..P-16 each marked applied or not applicable with reason** | **16/16** — 15 applied, 1 NOT APPLICABLE (P-15, with reason) (section 9) |
| **E-13..E-17 accounted** | **5/5** applied (section 10) |
| **Every gated control has the "Checking your permissions..." state (count them, n/n)** | **10/10 controls** (30 client instances) + **6/6 gated reads** (section 11); each transitions `Checking → allowed` or `Checking → refused-with-reason` |
| **OD-09/OD-10/OD-11/OD-12/OD-13 cited by decision ID** | **5/5** — OD-09 (flows 1, 2, 7), OD-10 (flow 1), OD-11 (flow 2), OD-12 (flows 1, 5), OD-13 (flows 5, section 12); all D4 |
| **Every flow maps to operations/slices from row 29** | **7/7** — operations: F1 76-80/44-48; F2 81-82/44-45; F3 83/27; F4 83/27/38/39; F5 82/88/39/40/41/42/87; F6 84-86; F7 24/25/27 (section 1) |
| **No emoji; English; tables over prose** | PASS |
| **Every choice cites file:line / decision ID / register row / op** | PASS (sections 0-12) |
| **Row 32 dependency stated, not redefined** | PASS — flow 3/4 bind to the op-83 envelope and SH-01 enum; row 32 owns the step list (section 4.1, section 9) |

### 13.1 Self-gate of the rev 2.3 delta (blueprint row 125) **Erratum PE-125-17**

| Gate check (row 125 as amended by D80 / D81) | Result |
|---|---|
| **Each flow has its states listed for web, tablet and phone** | **5/5 new flows** — flow 9: §8c.2 (13 states × 3 clients); flow 10: §8d.4-§8d.7 (web) and §8d.10 (the tablet and phone state: Connect disabled with the web-console sentence); flow 11: §8e.2 (4 notifications × 3 clients), §8e.3; flow 12: §8f.2 (7 surfaces × 3 clients), §8f.3 (4 local-device states); flow 13: §8g.1 (8 states × 3 clients), §8g.3 (6 start-rule cases) |
| **The client set allowed to write a camera password is stated with its source** | **Web console only** — §8d.1, source **D80(3)** (`decisions/decisions.md:93`), enforced by `WEB_CONSOLE_SESSION` on operations 89, 95, 96 (`C3 §2.6`; D81) |
| **0 flows show a stored credential** | **0/13** — table below |
| Every flow maps to operations of the contract | 5/5 — F9: 93, 94; F10: 95, 96, 78 / 79, 89; F11: `alerts` + pre-check + 93 / 97; F12: reads 76, 77, 94, 27, 39 / 40, 41; F13: 97 + pre-check (one control, G18, has no operation yet — OP-125-1) |
| Every gated control has the "Checking your permissions…" state | 18/18 controls, 46 client instances, 8/8 gated reads (section 11) |
| Rulings applied | D80(2), (3), (4), (5), (6), (7), (9), (10), (11) and D81 — table in section 0 |
| Specified with the apps' existing kit | PASS — table in §8b; no hand-built component is introduced |
| No emoji; English; tables over prose; every choice cited | PASS |

**Stored credential shown, per flow.**

| Flow | Does any state show a stored user name, password or secret? |
|---|---|
| 1 Device selector | No — no credential member in ops 76-80 |
| 2 Mic toggle | No |
| 3 Sealing progress | No |
| 4 Resumed sealing | No |
| 5 Playback | No (the signed media URL is never drawn; P-07) |
| 6 Transcript | No |
| 7 Session gating | No |
| 8 STT configuration | No — "set" / "not set" and the kind only (§8a) |
| 9 Search for cameras | No — no response shape of ops 93 / 94 carries one |
| 10 Connect a camera | No — the fields open empty; the operator sees only what they are typing (masked); after adding only "Password stored." |
| 11 No-device notifications | No — ids, labels and counts only |
| 12 Development sources | No |
| 13 Microphones | No — a microphone has no password |
| **Total** | **0 of 13** |

**Totals restated once (arithmetic).**

| Total | Row 34 | + flow 8 (D24) | + flows 9-13 (row 125) | Now |
|---|--:|--:|--:|--:|
| Flows | 7 | 1 | 5 | **13** |
| Client definitions (flows × 3) | 21 | 3 | 15 | **39** |
| Gated interactive controls | 10 (G1-G10) | 2 (G11-G12) | 6 (G13-G18) | **18** |
| Client instances of those controls | 30 | 2 | 14 | **46** |
| Gated reads | 6 | 1 (op 90) | 1 (op 94) | **8** |
| Flows that show a stored credential | 0 | 0 | 0 | **0** |
| Proposed i18n keys (§14.2) | — | — | 120 | **120** |

**Register items touched (`research/03_analysis.md` §B.3, §B.4; no new id is minted here).**
Web, by screen: WB-01 (monitor: situation C, degraded warning, badge), WB-02 (dashboard tiles),
WB-03 (Session New pre-check rows), WB-04 (evidence badge, verify line), WB-05 (Devices: search,
list, connect, banner, local rows — its register text already names "discovery list, write-only
credential entry", `research/03_analysis.md:193`), WB-07 (System entry link), WB-11 (one query
factory) = **7 of 11**; by label only: WB-08 (four audit-type labels), WB-09 (Try-it denial of 95 /
96). Mobile, by screen: MB-01, MB-02, MB-03, MB-05, MB-06, MB-07, MB-08, MB-09 = **8 of 13**; by
label only: MB-12. The alert centre (web `components/shell/notifications-bell.tsx`, mobile
`features/dashboard/home-header.tsx`) has no register id.

**Existing flows and controls whose text changed (everything else is unchanged).**

| Place | Change | Mark |
|---|---|---|
| Front matter, authority note, footer | decisions and dates; the rev 2.3 paragraph | PE-125-01 |
| Section 0 | new table "Rev 2.3 rulings applied by flows 9-13" | PE-125-02 |
| Section 1 catalogue | rows 8-13 added; rows 1-7 unchanged | PE-125-03 |
| Flow 1 — §2.2 step 2 | adopted cameras; badge | PE-125-04 |
| Flow 1 — §2.5 "Empty device list" | gains the action Search for cameras | PE-125-04 |
| Flow 1 — §2.5 | new row `DEVELOPMENT_SOURCE_NOT_ALLOWED` | PE-125-04 |
| Flow 1 — §2.6 | new row "Source options" (affects what G2 offers; the texts of G1-G3, G9 are unchanged) | PE-125-04 |
| Flow 2 — §3.6 | new row: badge on mic meters and tiles | PE-125-05 |
| Flow 5 — §6.2 step 6, §6.6 | verify line first; badge on the item and files | PE-125-06 |
| Flow 7 — §8.2 step 4, §8.5 | reachability, start rule, two new situations | PE-125-07 |
| Section 9 — P-04, P-07, P-10, P-13 | one sentence each | PE-125-14 |
| Section 11 | rows G11-G18; restated counts | PE-125-15 |
| Section 12 | one row | PE-125-16 |
| Flows 3, 4, 6, 8 (§4, §5, §7, §8a) and controls G4-G8, G10-G12 | **0 changes** | — |

**Open items carried to the M0 gate (row 39) — no blocker.**

1. Row 32 (`masterplan/06_evidence_package_spec.md`) is not yet written; this spec binds to its step
   list. The client renders whatever ordered step list op 83 returns and hard-codes only the label map,
   so a row-32 step-list change needs no UX change.
2. The `SESSION_HOLDER` access condition is proposed, not yet in `contract-model.ts` (`C3 §10`); M2
   materialises it. This spec assumes the op 81 gate exactly as `C3 §2.2` describes.
3. OD-13 loopback/class-C: physical-device behaviour is class C (C-5) and is not implemented here.

---

## 14. Vocabulary, proposed i18n keys and accessibility for flows 9-13 **Erratum PE-125-18**

### 14.1 Vocabulary — the operator's words

The UI uses the product's English vocabulary (`packages/shared/src/i18n/en/common.ts`: "Camera 1",
"MIC 1", "Retry", "Requires the {{role}} role"). Contract words stay in the contract.

| Contract / spec term | UI word | Never shown to an operator |
|---|---|---|
| discovery, probe | "Search for cameras", "Search again" | "discovery", "probe", "WS-Discovery", "ONVIF", "multicast" |
| candidate | "camera found"; in the list simply a row | "candidate", `CND-…` ids |
| `status: NEW` / `REGISTERED` | "New" / "Already registered" | — |
| credential (`username`, `secret`) | "Camera user name", "Camera password" | "credential", "secret" |
| connection test | "Test connection" | outcome codes (`WRONG_PROFILE`, …) as raw text |
| adopt | "Add as camera" | "adopt", "adoption" |
| assignment (ops 78 / 79) | "Assign to a camera slot"; "Camera 1" / "Camera 2" | "track", `VIDEO-01` as the only name (it may follow the label) |
| `sourceClass` not `PRODUCTION` | "Development source" | "sourceClass", "DEVELOPMENT" as a raw code |
| `adapter: LOCAL_DEVICE` | "This Mac's camera", "This Mac's microphone" | "LOCAL_DEVICE", "helper", "loopback" |
| `adapter: FAKE` | "Test source" (not "Simulated": that word names the Simulated mode of the clients) | "fake", "stub", "fixture" — except in the verify report line, whose text is fixed by `06` §D.1 |
| `CAPTURE_CONFIG_LOCKED` | "…while a session is open." | the code |
| `WEB_CONSOLE_ONLY` | "…from the web console." | the code |
| `CREDENTIAL_STORE_NOT_READY` | "This Core cannot store camera passwords yet…" | "sealer", "credential store", "row 84" |
| lock-out guard | "Testing this camera is paused so that the camera does not lock its account." | "rate limit", "guard" |
| op 97 | "Search again" (microphones), "Re-reads the microphones connected to the Core." | "rescan", "enumerate" |

### 14.2 Proposed keys (not applied — this row edits no code)

All under `common` in `packages/shared/src/i18n/en/common.ts`, because each text is used by web and
mobile and by more than one feature (Devices, Session New, Monitor, Evidence). Plural texts written
"(s)" here use the i18next `_one` / `_other` forms. Rows 137 / 138 add them; the vocabulary-sync test
(`test/i18n-vocabulary-sync.test.ts`) and the mobile missing-key check (`getMissingKeys`, `@/i18n`) apply.

| Key | English text |
|---|---|
| `common.captureSearch.action` | Search for cameras |
| `common.captureSearch.again` | Search again |
| `common.captureSearch.intro` | Search the network for cameras. Searching connects to nothing. |
| `common.captureSearch.searching` | Searching the network for cameras… |
| `common.captureSearch.searchingHint` | This takes up to {{seconds}} seconds. |
| `common.captureSearch.finishing` | Finishing the search… |
| `common.captureSearch.summary` | {{count}} found · {{newCount}} new · {{registeredCount}} already registered |
| `common.captureSearch.freshness` | Searched at {{searchedAt}}. Kept until {{keptUntil}}. |
| `common.captureSearch.ownerNote` | Only you see this list, on this device. |
| `common.captureSearch.trustNote` | Make, model and name are what each device announced. They are not checked. |
| `common.captureSearch.emptyTitle` | No camera answered the search |
| `common.captureSearch.emptyBody` | Check that each camera is powered and on the same network as the Core, then search again. |
| `common.captureSearch.truncated` | More than {{max}} devices answered. The first {{max}} are listed. |
| `common.captureSearch.failed` | The search could not be completed. Nothing was changed. |
| `common.captureSearch.unavailable` | Camera search is not available on this Core yet. |
| `common.captureSearch.busy` | Another operator is searching right now. Search again when their search has finished. |
| `common.captureSearch.expired` | This search result is no longer kept. Search again to see the cameras. |
| `common.captureSearch.developmentGroup` | Development sources |
| `common.captureSearch.columns.address` | Address |
| `common.captureSearch.columns.makeModel` | Make and model |
| `common.captureSearch.columns.name` | Name |
| `common.captureSearch.columns.status` | Status |
| `common.captureSearch.makeModelUnknown` | Make and model not announced |
| `common.captureSearch.status.NEW` | New |
| `common.captureSearch.status.REGISTERED` | Already registered |
| `common.captureSearch.registeredAs` | Already registered as {{device}} |
| `common.captureSearch.notTestable` | Cannot be connected |
| `common.captureSearch.notTestableBody` | This device announced an address that is not its own. |
| `common.captureSearch.viewDevice` | View device |
| `common.captureSearch.a11y.progress` | Camera search in progress |
| `common.captureSearch.a11y.done` | Search finished: {{count}} found, {{newCount}} new. |
| `common.captureConnect.action` | Connect |
| `common.captureConnect.webOnly` | Connect this camera from the web console. |
| `common.captureConnect.webOnlyNote` | Camera passwords are entered on the web console only. Open Devices on the web console and search there. |
| `common.captureConnect.locked` | A camera cannot be connected while a session is open. |
| `common.captureConnect.title` | Connect {{name}} |
| `common.captureConnect.reference` | Device reference |
| `common.captureConnect.intro` | Enter the user name and password set on this camera. They are used for this connection only and are never shown again. |
| `common.captureConnect.username` | Camera user name |
| `common.captureConnect.password` | Camera password |
| `common.captureConnect.required` | Enter the camera user name and password. |
| `common.captureConnect.noPasswordNeeded` | This development source needs no password. |
| `common.captureConnect.enterPassword` | Enter a user name and password |
| `common.captureConnect.change` | Change |
| `common.captureConnect.test` | Test connection |
| `common.captureConnect.testing` | Testing the connection… |
| `common.captureConnect.testingHint` | This can take up to {{seconds}} seconds. |
| `common.captureConnect.outcome.REACHABLE` | Connection works. This camera can be added. |
| `common.captureConnect.outcome.UNREACHABLE` | The camera did not answer. Check its power and network cable, then test again. |
| `common.captureConnect.outcome.AUTHENTICATION_FAILED` | The camera refused this user name or password. |
| `common.captureConnect.outcome.WRONG_PROFILE` | The camera answered, but it offers no video profile this system can use. Change the video settings on the camera, then test again. |
| `common.captureConnect.outcome.NOT_H264` | The camera answered, but none of its video profiles is H.264. Set the camera to H.264, then test again. |
| `common.captureConnect.outcomeShort.REACHABLE` | Connection works |
| `common.captureConnect.outcomeShort.UNREACHABLE` | No answer |
| `common.captureConnect.outcomeShort.AUTHENTICATION_FAILED` | Password refused |
| `common.captureConnect.outcomeShort.WRONG_PROFILE` | No usable profile |
| `common.captureConnect.outcomeShort.NOT_H264` | Not H.264 |
| `common.captureConnect.profiles` | {{count}} usable video profile(s) |
| `common.captureConnect.attemptsLeft` | {{count}} more attempt(s) before testing this camera is paused. |
| `common.captureConnect.lockoutGuard` | Testing this camera is paused so that the camera does not lock its account. Try again after {{time}}. |
| `common.captureConnect.inProgress` | A connection test for this camera is already running. |
| `common.captureConnect.add` | Add as camera |
| `common.captureConnect.adding` | Adding the camera… |
| `common.captureConnect.added` | {{device}} was added. |
| `common.captureConnect.passwordStored` | Password stored. |
| `common.captureConnect.noPasswordUsed` | No password is used for this source. |
| `common.captureConnect.addedNext` | The camera is registered but not yet used. Assign it to Camera 1 or Camera 2. |
| `common.captureConnect.assign` | Assign to a camera slot |
| `common.captureConnect.storeNotReady` | This Core cannot store camera passwords yet, so this camera cannot be added. Nothing was saved. |
| `common.captureConnect.testTooOld` | The connection test is too old. Test the connection again. |
| `common.captureConnect.finalCheckFailed` | The camera did not pass the final check, so it was not added. |
| `common.captureConnect.alreadyRegistered` | This camera is already registered as {{device}}. |
| `common.captureConnect.resultGone` | This search result is no longer kept. Search again. |
| `common.captureNotice.discoveryEmpty.title` | No camera found |
| `common.captureNotice.discoveryEmpty.body` | The last search found no camera on the network. |
| `common.captureNotice.unreachable.precheck.title` | {{device}} is not reachable |
| `common.captureNotice.unreachable.precheck.camera` | It did not answer the pre-check. A search found {{count}} camera(s). |
| `common.captureNotice.unreachable.precheck.microphone` | It did not answer the pre-check. |
| `common.captureNotice.unreachable.sessionStart.title` | {{device}} is not connected |
| `common.captureNotice.unreachable.sessionStart.body` | The session is recording one camera only. |
| `common.captureNotice.noCamera.title` | No camera connected |
| `common.captureNotice.noCamera.body` | Nothing was recorded. |
| `common.captureNotice.cause.UNREACHABLE` | It did not answer. |
| `common.captureNotice.cause.AUTHENTICATION_FAILED` | It refused the stored password. Set the camera password again on the web console. |
| `common.captureNotice.cause.NOT_CONNECTED` | It did not connect in time. |
| `common.captureNotice.cause.PERMISSION_DENIED` | macOS has not allowed access for the Core. |
| `common.captureNotice.cause.DEVICE_BUSY` | Another application is using it. |
| `common.captureNotice.cause.DEVICE_NOT_FOUND` | It was not found. |
| `common.captureNotice.start.noCamera` | No camera is reachable. A session cannot start. |
| `common.captureNotice.start.oneCamera` | {{device}} is not reachable. The session will record one camera only. |
| `common.captureNotice.start.noMicrophone` | No microphone is reachable. A session cannot start. |
| `common.captureNotice.start.activeMicrophone` | {{device}} is the active microphone and is not reachable. Make {{other}} the active microphone to continue. |
| `common.captureNotice.start.activeMicrophoneFallback` | Cancel this session, make {{other}} the primary microphone on Devices, then start again. |
| `common.captureNotice.start.useOther` | Use {{other}} as the active microphone |
| `common.captureNotice.start.noStandby` | {{device}} is not reachable. The session will record with no standby microphone. |
| `common.captureNotice.start.oneMicrophone` | {{device}} is not reachable. The session will record with one microphone and no standby. |
| `common.sourceClass.badge` | Development source |
| `common.sourceClass.kind.localCamera` | This Mac's camera |
| `common.sourceClass.kind.localMicrophone` | This Mac's microphone |
| `common.sourceClass.kind.test` | Test source |
| `common.sourceClass.notAllowed` | This source can only be used in the development configuration. |
| `common.sourceClass.verify.development` | DEVELOPMENT SOURCES — this package was not recorded from production devices. |
| `common.sourceClass.verify.production` | Sources: declared as production devices by the Core that sealed this package. |
| `common.sourceClass.verify.untrusted` | Sources: not trustworthy — the manifest was altered |
| `common.sourceClass.verify.v1` | Sources: not recorded (v1 package) |
| `common.localDevice.state.READY` | Ready |
| `common.localDevice.state.PERMISSION_DENIED` | Permission needed |
| `common.localDevice.state.DEVICE_BUSY` | In use |
| `common.localDevice.state.DEVICE_NOT_FOUND` | Not found |
| `common.localDevice.permissionCamera` | macOS has not allowed camera access for the Core. On the Mac that runs the Core, open System Settings > Privacy & Security > Camera, allow it, then search again. |
| `common.localDevice.permissionMicrophone` | macOS has not allowed microphone access for the Core. On the Mac that runs the Core, open System Settings > Privacy & Security > Microphone, allow it, then search again. |
| `common.localDevice.busyCamera` | Another application is using this camera. Close that application, then search again. |
| `common.localDevice.busyMicrophone` | Another application is using this microphone. Close that application, then search again. |
| `common.localDevice.notFoundCamera` | This Mac's camera was not found. |
| `common.localDevice.notFoundMicrophone` | This Mac's microphone was not found. |
| `common.captureInputs.againLabel` | Search again for microphones |
| `common.captureInputs.description` | Re-reads the microphones connected to the Core. Microphones are not searched on the network. |
| `common.captureInputs.checkedAt` | Checked at {{time}} |
| `common.captureInputs.unregistered` | {{count}} other microphone(s) are connected to the Core but not registered. |
| `common.rbac.checking` | Checking your permissions… |

Notes. (1) `common.rbac.checking` exists today only in the mobile file
(`apps/mobile/src/i18n/en.mobile.ts:35`); the web sources and the shared i18n tree contain no such
string (`grep -rn "ermissions…\|ermissions\.\.\." apps/core-web/src packages/shared/src` = 0 lines), so
the web console needs it for every gated control of this file — proposed as a shared key with the
mobile text, which uses the ellipsis character. (2) Existing keys reused, not duplicated:
`common.rbac.requiresRole` (`common.ts:585`), `common.actions.retry` / `close` / `cancel` / `acknowledge`
(`common.ts:27-61`), `common.coreErrors.offline` / `timedOut` / `limited` (`common.ts:651-664`),
`common.devices.camera1` / `camera2` / `mic1` / `mic2` (`common.ts:500-507`). (3) The labels of the
four new audit types (`CAPTURE_DISCOVERY_SEARCHED`, `CAPTURE_CONNECTION_TESTED`,
`CAPTURE_CANDIDATE_ADOPTED`, `CAPTURE_DEVICE_UNREACHABLE`) go to `common.auditType.*` and its mirror
with the rows that add the types (132 / 142); proposed texts: "Camera search performed", "Camera
connection tested", "Camera added", "Capture device not reachable". (4) On tablet and phone the two
`kind.local*` texts are overridden in the mobile file as "Core Mac's camera" / "Core Mac's
microphone" (OP-125-7).

### 14.3 Accessibility

| Point | Web | Tablet and phone |
|---|---|---|
| Search progress | the status text is `role="status"`, `aria-live="polite"` (the pattern of `devices-banner.tsx:46`, `session-new/devices-step.tsx:154`); the `ProgressBar` has the label `captureSearch.a11y.progress` and no spoken seconds; the end is announced once with `captureSearch.a11y.done` | `accessibilityLiveRegion="polite"`; `accessibilityState={{ busy: true }}` through `busyState` |
| Disabled with a reason | the reason is **visible text** beside the control and is tied to it with `aria-describedby`; never a tooltip only | the reason is visible text in the row and part of the `accessibilityLabel`; `accessibilityState={{ disabled: true }}` |
| Connect dialog | kit `Modal` focus trap; first focus on the user-name field; each field has a `Label`; errors through `FieldError`; the outcome `Alert` is `role="status"` for *reachable* and `role="alert"` otherwise and receives focus; Escape closes except while a request is pending; closing returns focus to the row's Connect button | not applicable (no dialog) |
| Password field | `type="password"`; no reveal control; no value in any attribute, title or label | not applicable |
| Device text | one line with an ellipsis; the full text in the accessible name; `<bdi>` isolation | `numberOfLines={1}`; full text in `accessibilityLabel` |
| Badge | icon + text; the text is the accessible name; contrast from the shared tone tokens (`toneChipProps`, `@dems/shared/tokens`) | same through the kit `StatusChip` |
| Notifications | WARNING banners `role="status"`; the CRITICAL "nothing was recorded" presentation `role="alert"`; the alert-centre popover keeps its heading (`notifications-bell.tsx:66-67`) | polite / assertive live regions; touch targets of the actions at least 44 pt |
| Motion | no decorative animation carries a state; the final state of the list, the bar and the outcome is drawn by React (§0, E-13); reduced-motion follows the existing policy (`@/motion`) | same; `SelectionGlow` always mounted |
| Language | English UI vocabulary of §14.1; sentences say what happened, what was not changed, and what to do next | same |

---

## 15. Hand-over, proposed checks and open items of the rev 2.3 delta **Erratum PE-125-19**

### 15.1 What each row must take

| Row | Takes from this delta |
|---|---|
| **126 security review** | (1) §8d.3: the typed user name and password live in the dialog's form state for two requests (95, then 96) and are cleared on close — judge against "in memory for that request"; the command path must not keep request variables in a query or mutation cache. (2) OP-125-6: no reveal control for the typed password, against a guard of 3 failed tests per camera in 15 minutes. (3) Browser autofill: the `autocomplete` values of §8d.3 and the check that a saved login of the console origin is not offered. (4) Untrusted device text (§8c.3): text nodes only, bidirectional isolation, 120 characters. (5) The address of a found camera is shown to the searching `CAPTURE_CONFIG` operator and to nobody else; alert texts carry no address. (6) Both log-blanking lists (P-07) must cover the members `username`, `secret` and the nested `credential` object of ops 95 / 96 on the web console. (7) The verify report must never print an edited source class as fact (§8f.2 rule 4). (8) The macOS permission sentence only tells the user what to do; no control opens or edits a system setting |
| **127 test catalogue** | The named checks of §15.2 with method, depth and owning row; the two depths of the connect check (before and after row 84); R-9 AC-5 "2 + 1 on each client that row 125 allows" = **the web console only**, with the tablet and phone pointer checks in its place |
| **133 server notifications (A, B)** | The alert `params` the texts need: A `reason`, `searchId`, `trigger`; B `reason`, `deviceId`, `deviceKind`, `phase`, `cause`, `searchResponderCount` (camera). The device **label** is resolved by the client from the id — the alert carries no label text and no address. One active alert per (`reason`, `target`), so five empty searches give one banner. Resolution must republish `alerts` so that 0 stale banners remain (§8e.4) |
| **137 web Devices** | Flows 9, 10 (whole), 11, 12, 13 on the web console with the building blocks of §8b; the factory `captureDiscoveryQueryOptions` (WB-11); G13-G18 with the Checking state; the keys of §14.2; the System entry link (WB-07); badge on WB-01..WB-05; Try-it stays denied for 95 / 96 (row 142). Its own acceptance "the credential is never rendered" = §8d.3 |
| **138 tablet and phone Devices** | Flows 9, 11, 12, 13; from flow 10 **only** the disabled Connect with the web-console sentence and the panel note (§8d.10) — **no password field, no call of 95 / 96 / 89**. The blueprint wording "the connect flow for the roles and clients row 125 allows" therefore means: none on these clients (D80(3)). The mobile overrides of the two local-device names (OP-125-7) |
| **139 session-start notification** | Situation C and the degraded warning of §8e.2: the fault presentation must show no timer, no recording indicator and no generated meters; `params.reason: NO_CAMERA_CONNECTED`, `evidenceFiles: 0`; the degraded alert names the missing camera's device id. OP-125-5: which state follows the fault when nothing is durable, so that the tablet hand-off is defined |
| 128 spec gate | OP-125-1..5 (contract members and one operation); the wording of blueprint rows 125, 137, 138 and of `specs` R-9 AC-5 / AC-12 against D80(3) |
| 141 mark + verify | The report lines of §8f.2 verbatim; the `sources` block reaching the clients through op 41 |

### 15.2 Named checks proposed to row 127

Depth "2 + 1" = two runs and one verification. Emulator lanes as in `masterplan/10_test_strategy.md`
(`M4-SEL-T`: `dems2_tablet`, emulator-5556, lane 2; `M4-SEL-P`: `dems2_phone`, emulator-5554, lane 1).
No agent types a device PIN; every check uses the fake ONVIF stub and fixture cameras on loopback.

| Check | Client | What it proves | Method | Depth | Row |
|---|---|---|---|---|---|
| `M4-DISC-W` | web | search with N stub devices: states S1 -> S3 -> S4, N rows, "New" / "Already registered", the development group, freshness line, Search again replaces the list | agent-browser on a lane | 2 + 1 | 137 |
| `M4-DISC-T` / `M4-DISC-P` | tablet / phone | the same on each emulator | emulator lane | 2 + 1 each | 138 |
| `M4-DISC-EMPTY-W` / `-T` / `-P` | all three | stub empty: empty state, one banner, one alert-centre item, Search again; five searches still one alert; a later search with a responder leaves 0 banners | agent-browser / emulator | 2 + 1 each | 137, 138, 133 |
| `M4-DISC-RBAC-W` / `-T` / `-P` | all three | a role without `CAPTURE_CONFIG`: Checking state, then disabled with the role sentence; 0 calls of op 94 | agent-browser / emulator + request log | 2 + 1 each | 137, 138 |
| `M4-DISC-OWNER-W` | web | a second operator session sees no list and the alert only | two browser sessions | 2 + 1 | 137 |
| **`M4-CONN-W`** | web | **the connect flow with a fake camera**: both fields empty on open; each of the five outcomes once with its message and next action; a development source added without a password, then assigned through the selector; before row 84 an add with a password ends in "This Core cannot store camera passwords yet…". After each run the fixture password string has **0** occurrences in the page text, the DOM snapshot, the field values after close, `localStorage`, `sessionStorage`, the URL and the console log | **agent-browser** on a lane with fixture credentials on the fake stub | 2 + 1 | 137 |
| `M7-CONN-W-CRED` | web | after row 84: add with a password succeeds, "Password stored." and no value anywhere | agent-browser | 2 + 1 | 137 (re-run at M7) |
| `M4-CONN-ABANDON-W` | web | each exit of §8d.7: the UI state described there and 0 new rows in `capture_devices` / `capture_device_credentials` | agent-browser + row count | 2 + 1 | 137 |
| `M4-CONN-LOCK-W` | web | with a session open: Connect disabled with its sentence, 0 toasts, search still works | agent-browser | 2 + 1 | 137 |
| `M4-CONN-GUARD-W` | web | three refused passwords: attempts-left text counts down by the server's value, then the lock-out sentence and a disabled Test | agent-browser, fake clock on the Core | 2 + 1 | 137 |
| `M4-CONN-PTR-T` / `-P` | tablet / phone | Connect disabled with the web-console sentence; **0 password fields in the view tree**; 0 calls of 95 / 96 / 89 | emulator + static test over `apps/mobile/src` | 2 + 1 each | 138 |
| `M4-NODEV-B-W` / `-T` / `-P` | all three | pre-check with one fake camera stopped: warning row naming the device with the search count, start allowed after acknowledging; both stopped: blocked; a later reachable run leaves 0 banners | agent-browser / emulator | 2 + 1 each | 133, 137, 138 |
| `M4-NODEV-NOCFG-T` | tablet | an operator with `SESSION_START` and without `CAPTURE_CONFIG`: the notification only, Search again disabled, Retry works, no list | emulator | 2 + 1 | 138 |
| `M4-MIC-RESCAN-W` / `-T` / `-P` | all three | Search again on a microphone: one request, per-microphone result, 0 network probes | agent-browser / emulator | 2 + 1 each | 137, 138 |
| `M4-MIC-ACTIVE-W` / `-T` / `-P` | all three | active microphone unreachable: blocked with its sentence; after the other microphone is made active: warning, degraded start (depends on OP-125-1) | agent-browser / emulator | 2 + 1 each | 137, 138 |
| `M5-NODEV-C-W` / `-T` / `-P` | all three | no camera at start: fault presentation "Nothing was recorded.", 0 timer, 0 recording indicator, 0 meters; one camera: warning banner and a NO SIGNAL tile | agent-browser / emulator | 2 + 1 each | 139 |
| `M4-DEVSRC-LABEL-W` / `-T` / `-P` | all three | the badge on Devices rows, selector, search list, pre-check and monitor tiles in the development configuration; with the flag off 0 badges, 0 local rows, no group header | agent-browser / emulator | 2 + 1 each | 137, 138 |
| `M7-DEVSRC-EVID-W` / `-T` / `-P` | all three | sealed development package: badge on the item, the verify line first with a PASS verdict; an edited mark reads "not trustworthy" | agent-browser / emulator | 2 + 1 each | 141 with 137 / 138 |
| `M4-DEVSRC-LOCAL` | component | local-device row states (ready, permission needed, busy, not found) from a stub helper; the row keeps its name and badge, no test source appears; 0 media frames written to `docs/` | jest `--maxWorkers=2` on web and mobile | per run | 137, 138 |
| `M4-UX-UNIT` | component | fields cleared on close and unmounted; no request variables in the query cache; a device name containing markup is drawn literally; progress is forward-only under a fake clock; the list order equals the answer order | jest `--maxWorkers=2`, fake clocks (P-08) | per run | 137, 138 |

### 15.3 Open items (none decided silently)

| ID | Open item | Why it matters for the UI | Owner |
|---|---|---|---|
| OP-125-1 | **No operation exists for "make the other microphone active" at pre-check.** D81 rules the behaviour; op 80 is locked once a session exists, op 81 is valid only in RECORDING; `C3 §3.1` still carries the older proposal | G18 cannot be built as a one-press action until the contract names it; the fallback path of §8g.3 works today | rows 121 / 128; controller |
| OP-125-2 | `CaptureDevice` (op 77) has no `credentialSet` member; only the answer of op 96 has | a registered camera row cannot say "Password set" after the dialog closed; nothing is inferred client-side | row 128 |
| OP-125-3 | `03_api_contract.md` carries neither the package mark on ops 39 / 40 nor the `sources` block on op 41 (0 matches of `developmentSources` in that file on 2026-10-09; row 124 A-2 and its hand-over) | the evidence-list badge and the verify line have no response member yet | rows 121 / 128; row 122 for a column |
| OP-125-4 | The named cause for a **local camera** (`PERMISSION_DENIED`, `DEVICE_BUSY`) reaches the client only inside the situation-B alert of a pre-check; op 97 reports microphones only | on the Devices page a local camera reads "Not reachable" without its reason until a pre-check ran | rows 123 / 128 |
| OP-125-5 | Which session state follows the situation-C fault when nothing is durable | the tablet's fault hand-off (MB-03 -> MB-06) must not show a recovery of evidence that does not exist | rows 71 / 139 |
| OP-125-6 | No reveal control for the typed password (kept as §8a) against a guard of 3 failures per camera | a typing mistake costs one of three attempts | row 126 |
| OP-125-7 | Two presentation choices of this row: (a) on tablet and phone the local devices read "Core Mac's camera / microphone", because "This Mac" would name the wrong device there; (b) in Simulated mode every device and demo package carries the badge | (a) departs from the wording in the row brief; (b) changes the look of the demo | controller / user |

---

*Generated: 2026-10-07 17:30*
*Last Updated: 2026-10-09 (row 125, PE-125-01..19: client delta for R-9..R-11 — flows 9-13, sections 8b-8g, 14, 15; D73-D81); 2026-10-09 (status sweep PE-R8-12..13: §8a Flow 8 confirmed by D24); 2026-10-08 (RV-SPEC: D19(b) refinement in §0/§3.7/§9 P-01; §8a Flow 8 added as a proposal, R-8/D20; earlier: row-35 cross-refs SEC35-12/SEC35-13)*
