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
decisions: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/decisions/decisions.md (D4, D8, D10, D12)
last_updated: 2026-10-08 (RV-SPEC: D19(b) recording-duration refinement; proposed §8a Flow 8 STT configuration, R-8/D20; 2026-10-07 row-35 cross-refs SEC35-12/13)
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
| 2 | Resolved, idle | Two camera rows (`VIDEO-01`,`VIDEO-02` → `CAM-01`/`CAM-02` or one dual-lens profile) and two mic rows (`MIC-01` PRIMARY, `MIC-02` STANDBY) | 76; `C3 §2.4`; OD-05 |
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
| Empty device list | "No capture devices configured" | same | same | op 77 empty |
| `LOST` stream | Row shows LOST; PoE cycle (G9) offered only then | same | same | OD-22 |

### 2.6 Per-client definition

| Aspect | Web (`apps/core-web`) | Tablet (`apps/mobile`) | Phone (`apps/mobile`) |
|---|---|---|---|
| Surface | Devices page/drawer (WB-05), System entry (WB-07) | Devices screen (MB-08), Settings → capture (MB-09) | Settings → Devices (MB-09) |
| Read factory | New `captureConfigQueryOptions`/`captureDevicesQueryOptions` in `lib/core-queries.ts` (WB-11, E-17) | replicated slices via `useSim` | same |
| List rows | Device rows + kebab through `device-command-gate.ts` | Constant card border via `SelectionGlow` (`selection-glow.tsx:40`) | Compact rows; constant border |
| Edit affordance | Inline selects with a "Save" per field (ops 79/80) | Bottom sheet per field | Full-screen sheet per field |
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
| 6 | Verify | op 41 v2 verify: per-file chain (both hashes) + transcript hash + real signature; pinned verdict per run | op 41; P-16 |
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
| 4 | Start checks | `startSession` precheck states (existing) | op 25 |

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

## 8a. Flow 8 (PROPOSED) — STT configuration menu (R-8; pending Q-STT-CFG confirmation at the second gate)

> **Status: proposed (D20).** Not counted in the 7/7 flows, the 10/10 gated controls or the self-gate
> until the user confirms Q-STT-CFG. If confirmed: flows 8/8 (24 client definitions), gated controls
> G11-G12 added. Operations 90-92 (`C3 §2.5`), audit `STT_CONFIG_CHANGED`; no new slice.

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

## 9. P-01..P-16 pattern application (16/16)

Each pattern from `drift §2.1` is applied to this UX spec or marked NOT APPLICABLE with a reason.

| Pattern | Applied in flow(s) | Status and reason |
|---|---|---|
| P-01 mobile recording time from one source; progress forward-only from Core instants | 2, 3, 4, 7 | **Applied** — all timers use `coreClockOf`/`recording-elapsed.ts:1-21,128-144`; `core-clock.ts:82-88`; never steps back (E-13) while RECORDING; after the Core reports the stop the authoritative recorded duration wins (D19(b)) |
| P-02 server imports contract constants; extend `contract-values.test.ts` | 1, 2, 3 | **Applied** — the UI reads thresholds/enums from `@dems/shared/api` (`packages/shared/src/api/capture.ts`, CS-25); no copied literal (OD-11 values, v2 step codes) |
| P-03 device command map derived from the contract | 1 (G9) | **Applied** — the PoE cycle is the contract entry op 48 (`C3 §3`), rendered through the existing gate |
| P-04 web query factories + `lib/download.ts` + `device-command-gate.ts` | 1, 3, 5, 6 | **Applied** — new factories in `core-queries.ts` (WB-11, E-17); download via `download.ts:26-41`; G9 via `device-command-gate.ts:50-61` |
| P-05 Restart disabled while recording | 1 (G9) | **Applied** — PoE cycle refused during `RECORDING` (`409 RECORDING_ACTIVE`, `C3 §4`) |
| P-06 `AdminResource.DEVICES` is the paired-client registry | 1 | **Applied** — capture uses `captureConfig`/`captureDevices`, their own slice/kind (E-04; `C3 §6`) |
| P-07 blank `ses_`/`dvc_`/`bio_` values in web/mobile logs | 5 | **Applied** — the signed media URL prefix `mts_` and the camera-credential form `rtsp://user:pass@host` are added to the web error sink and `runtime/log.ts` (E-31/P-07; SEC35-13/SEC35-04) |
| P-08 mobile jest timeouts/`maxWorkers`; fake clocks | 2, 3, 4, 7 | **Applied** — every timing state (toggle latency, sealing progress, debounce) gets a fake-clock test; no wall-clock waits (notes for row 36) |
| P-09 static guards outside `src`; test-support imports | all (test notes) | **Applied** — new `capture/` guards follow the test-support rule; noted for row 36 (`drift §2.1 P-09`) |
| P-10 `selection-glow.tsx` constant border | 1, 5, 6 | **Applied** — new tablet list rows (selector, intervals, revisions) use `ROW_CARD_BORDER` (`selection-glow.tsx:40`) |
| P-11 in-place hand-offs, `animation:'none'` | 3, 4, 7 | **Applied** — mobile uses `monitor-handoff.ts`, `summary-handoff.ts`, `stacks.tsx:59` |
| P-12 session diagnostics for sealing progress / mic-switch latency | 2, 3 | **Applied** — `session-diagnostics.ts` is the instrumentation for the tablet gates; named for row 36 |
| P-13 "Checking your permissions..." on every gated control; web waits for the link | all flows | **Applied** — section 5 inventory (10 controls + 6 reads) |
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

**Gated interactive controls: 10/10** — each of the 30 client instances shows the state. **Gated reads
that also render the state: 6/6** — capture config (76), capture devices (77), sealing progress (83),
transcript (84), revisions (86), evidence item/media (39/40). Every one transitions
`Checking → allowed` or `Checking → refused-with-reason`; none hides or enables instantly.

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

**Open items carried to the M0 gate (row 39) — no blocker.**

1. Row 32 (`masterplan/06_evidence_package_spec.md`) is not yet written; this spec binds to its step
   list. The client renders whatever ordered step list op 83 returns and hard-codes only the label map,
   so a row-32 step-list change needs no UX change.
2. The `SESSION_HOLDER` access condition is proposed, not yet in `contract-model.ts` (`C3 §10`); M2
   materialises it. This spec assumes the op 81 gate exactly as `C3 §2.2` describes.
3. OD-13 loopback/class-C: physical-device behaviour is class C (C-5) and is not implemented here.

---

*Generated: 2026-10-07 17:30*
*Last Updated: 2026-10-08 (RV-SPEC: D19(b) refinement in §0/§3.7/§9 P-01; proposed §8a Flow 8, R-8/D20; earlier: row-35 cross-refs SEC35-12/SEC35-13)*
