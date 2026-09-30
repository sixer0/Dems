---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 1
agent: document-reader
artifact: research/01_explore.md
narrative_tier: 2
status: complete
date: 2026-09-30
source: "/Users/gsp-budi/Documents/DEMS/DEMS_Edge_Client_Engineering_Design_Book_v0.2_DOWNLOAD(2).docx"
source_version: "v0.2, Engineering Baseline, dated 30 September 2026"
source_sha256: d29761195cf3a318029dab5515aa5e7e98b13f303374d40eb8dabf7e14b1a46c
confidentiality: CONFIDENTIAL. This digest is derived from a confidential engineering document. Keep it local. Do not paste it into web queries, AI services or any remote.
web_tool_calls: 0
---

# Research 01: DEMS Design Book Digest (for the React web console + React Native tablet demo)

## How this digest was extracted

| Code | Method (all local, on this Mac; output streamed to stdout, nothing saved in the workspace) |
|---|---|
| **M1** | `textutil -convert txt -stdout "<docx>"` produces 1,667 lines and 53,658 bytes. Each `L<n>` in this digest is a line number in that stdout stream, so any citation can be re-checked with `textutil ... \| sed -n '<n>p'`. |
| **M2** | `unzip -p "<docx>" word/document.xml`, parsed with an inline Python regex. Used to recover line breaks inside the two ASCII diagrams (the §5.4 recording screen and the §6.2 state machine) that M1 flattens. |
| **M3** | `unzip -l` inventory of the package, plus a text dump of the header, footer and docProps parts. The package holds 21 parts. There are **no images, drawings, text boxes or comments** (the grep count for `w:drawing`, `w:pict`, `v:textbox`, `w:txbxContent` and `w:comment` is 0), so M1 captures all of the document's content. The header reads "DEMS EDGE CLIENT \| ENGINEERING DESIGN BOOK". The footer reads "Engineering Baseline v0.2 \| Page". |
| **M4** | `grep -n -i` scans of the M1 stream for role, RBAC, LCD, LED, heartbeat and related terms. These scans back the "absent from the book" findings. |

**Reading conventions**
- **"Why it matters"** means why the item matters for the demo (a React web console plus a React Native Android tablet app on synthetic data).
- **[Inference]** marks a statement by this agent that the book does not say.
- **[Gap]** marks something the book leaves undefined.

**Source status conventions** (book §Document Control, L28–L36):
- LOCKED: accepted baseline.
- PRELIMINARY: an assumption for sizing.
- TBD: not yet selected.
- OPTIONAL: not required.

§5 and §6 are both titled "Final Baseline".

---

## Part A: Sections covered in full

### §5 Tablet Software Design (Final Baseline), L568–L638

**§5 intro: role of the tablet** (M1, L569–L573)

| Finding | Why it matters |
|---|---|
| The tablet is the "Primary operator interface for authentication, metadata entry, preview, pre-check, Start/Stop Session and monitoring." | Defines the scope of the tablet app: every operator workflow lives on the tablet. |
| "Tablet is NOT a recording endpoint and does not directly control camera, storage, TPM or relay." | The tablet only sends commands and renders state. All authority sits on the Core (the mock-core in the demo). The UI must never imply local recording. |
| Connectivity: USB-C to a Gigabit Ethernet dock with Power Delivery, then CAT6 to the MGMT LAN. | A wired, stable link, so preview streaming over the LAN is plausible. In the demo this is the loopback path from the emulator to mock-core. |
| "Loss of tablet connectivity must not stop an active recording session." | The UI must handle disconnects gracefully and never tie session life to the app. |

#### §5.1 Application Modules (13) (M1, L575–L588)

| # | Module (exact) | Why it matters |
|---|---|---|
| 1 | Authentication & device pairing | Login screen plus a pairing state. §20.1 adds certificate-bound pairing and brute-force rate limiting, which the demo can show as a lockout message. |
| 2 | Dashboard | Landing screen: Core link, device health summary, entry to New Session. |
| 3 | New Session / Session Preparation | Maps to `POST /api/v1/session` (§21.2), which moves the session to state CREATE (§6.2). |
| 4 | Metadata Entry | Form screen. Fields come from §11.3 and §21.3 (case reference, operator/investigator, subject/witness). Needs form validation. |
| 5 | Camera Preview | Needs video playback of two lenses (VIDEO-01 and VIDEO-02). The demo uses looped synthetic clips. |
| 6 | Dual Audio Level Monitor | Two independent realtime meters with clip indication. This is the highest-frequency UI element. |
| 7 | Pre-Recording Health Check | The §5.3 gate checklist, with states and blocking rules. |
| 8 | Recording Control | Start and Stop commands (§21.2 start and stop endpoints). |
| 9 | Live Session Monitor | The §5.4 recording screen: timer, per-track REC, meters, storage, time source. |
| 10 | Session Finalization Status | Progress through FINALIZING to SEALED (§6.2), driven by the steps in §12.2. A good candidate for animated progress. |
| 11 | Authorized Evidence Review | Review of sealed sessions (§19.1 AUTHORIZED REVIEW), including hash-verification results (EVT-13 and EVT-14). |
| 12 | Device Health & Diagnostics | Health snapshot (`GET /api/v1/device/health`) plus per-track, audio and storage status. |
| 13 | Operator Audit View | Table of audit events (§21.3 AuditEvent, AuthenticationEvent, TrackHealthEvent). |

#### §5.2 Primary Screen Flow (10 steps) (M1, L589–L590)

Exact: `LOGIN -> DASHBOARD -> NEW SESSION -> METADATA -> PRE-CHECK -> START -> RECORDING MONITOR -> STOP -> FINALIZATION -> SESSION SUMMARY`

| Step | Screen | Maps to (§6.2 / §21.2) [Inference] | Why it matters |
|---|---|---|---|
| 1 | LOGIN | (auth; no endpoint listed) | Entry; pairing state. |
| 2 | DASHBOARD | `GET /device/health`, `GET /session/current` | Also the resume point after reconnect. |
| 3 | NEW SESSION | `POST /session` → CREATE | Returns the Session ID. |
| 4 | METADATA | (metadata binding; no endpoint listed) | Form. |
| 5 | PRE-CHECK | PRECHECK | §5.3 gate. |
| 6 | START | `POST /session/{id}/start` → ARMED → RECORDING | The start endpoint "Runs Core pre-check". |
| 7 | RECORDING MONITOR | RECORDING | The §5.4 screen. |
| 8 | STOP | `POST /session/{id}/stop` → STOPPING | "Transitions to finalization". |
| 9 | FINALIZATION | FINALIZING | §12.2 steps. |
| 10 | SESSION SUMMARY | SEALED | Summary from the manifest (§11.3). |

Why the flow matters: it is linear and state-gated, so the navigation must be driven by server state. On reconnect the app must jump to the screen that matches `GET /session/current` (§5.6), not to wherever the user was.

#### §5.3 Pre-Recording Gate (8 checks) (M1, L591–L618)

| Check | Displayed state (exact) | Blocking behaviour (exact) | Why it matters |
|---|---|---|---|
| Core Machine | ONLINE/OFFLINE | Offline blocks Start | Hard block. The Start button is disabled with a reason. |
| Video Lens 1 | READY/FAULT | Configurable block | Needs a policy flag in the mock config. |
| Video Lens 2 | READY/FAULT | Configurable block | Same as Lens 1. |
| MIC 1 | READY/NO SIGNAL/CLIP | Fault warning/block policy TBD | Three states. The warn-or-block policy is open, so the demo picks one. [Gap] |
| MIC 2 | READY/NO SIGNAL/CLIP | Fault warning/block policy TBD | Same as MIC 1. |
| Storage | READY/LOW/FULL | Full blocks Start | Hard block on FULL. LOW is a warning [Inference]. |
| Time Sync | GNSS/NTP/RTC | Show active source | Informational, non-blocking. |
| Security | READY/FAULT | Critical security fault blocks Start | Hard block. |

Why the gate matters:
- It is the richest status-enumeration table in the book and maps directly to shared TypeScript enums.
- The UI needs three gate outcomes: pass, warn and block. The configurable and TBD rows need a policy object, not hard-coded logic.

#### §5.4 Recording Screen (M2, line breaks recovered from document.xml)

```
● RECORDING     00:42:18
VIDEO 1   REC     VIDEO 2   REC
MIC 1     REC  [level meter]
MIC 2     REC  [level meter]
STORAGE   OK      TIME   GNSS LOCKED

              [ STOP SESSION ]
```

| Element | Content | Why it matters |
|---|---|---|
| Recording indicator | "● RECORDING" (filled dot) | Pulsing live indicator. The main animation opportunity. |
| Session timer | "00:42:18" (HH:MM:SS) | Must be driven by Core time over WSS (§5.5) and survive a reconnect without resetting. |
| VIDEO 1 / VIDEO 2 | "REC" per track | Per-track status. The book shows no preview tile on this screen; adding one is a demo choice [Inference]. |
| MIC 1 / MIC 2 | "REC [level meter]" | Two independent meters, never mixed (SYS-003). |
| STORAGE | "OK" | Note: the gate uses READY/LOW/FULL but this screen shows "OK". The book does not reconcile the two vocabularies [Gap]. |
| TIME | "GNSS LOCKED" | Active source plus lock state. "LOCKED" is the only time-quality word the book uses. |
| Stop action | "[ STOP SESSION ]" | Primary destructive action. A confirmation is advisable [Inference]. |

#### §5.5 Communication (M1, L622–L632)

| Function (exact) | Protocol baseline (exact) | Why it matters |
|---|---|---|
| Login/metadata/control | HTTPS REST API | Typed REST client. The demo mock uses plain HTTP on loopback (TLS is out of scope, per the blueprint). |
| Realtime status/timer/audio levels | Secure WebSocket (WSS) | One WS channel carries the timer, status and levels. It sets the update-rate requirement. |
| Live preview | Low-bitrate preview stream; protocol selection TBD | The demo can play local looped video files. The protocol is not constrained [Gap]. |
| Reconnect | Session-state query + state resynchronization | The WS client needs auto-reconnect plus a REST resync (`GET /session/current`). |

ICD-24 (§17, L1296–L1300) refines the WS payload as "Timer/health/levels/events" with "State resynchronization after reconnect". ICD-23 (L1291–L1295) says: "Versioned API; direct hardware access prohibited".

#### §5.6 Failure Behaviour (M1, L634–L638)

| Event | Required behaviour (exact) | Why it matters |
|---|---|---|
| Tablet disconnect | "Core recording continues." | Needs a disconnected banner while the web console keeps showing RECORDING. A strong two-screen demo moment. |
| Tablet app crash | "Core recording continues." | On relaunch the app restores state from the Core. |
| Tablet reboot | "Core recording continues; app reconnects and retrieves current session state." | Cold-start routing reads `GET /session/current`. |
| Network restored | "app re-authenticates/reconnects and resumes monitoring without creating a second recording session." | Idempotent resume: the mock must refuse a second active session. |

---

### §6 Core Machine Software Design (Final Baseline), L640–L701

#### §6.1 Core Services (16) (M1, L641–L675)

| # | Service (exact) | Responsibility (exact) | Why it matters |
|---|---|---|---|
| 1 | API Gateway | Tablet-to-Core command and data interface | Represented by mock-core REST + WS. |
| 2 | Authentication Service | Operator authorization and device pairing | Login and pairing. RBAC source. |
| 3 | Session Manager | Session state machine and orchestration | Owns §6.2. The mock's core logic. |
| 4 | Video Management Service | Camera discovery/control and stream ingest | VIDEO-01 and VIDEO-02 status; preview source. |
| 5 | Recording Engine | Session-based recording of video/audio tracks | Per-track REC state. |
| 6 | Audio Capture Service | Two independent audio channels | Level and clip stream for AUDIO-01 and AUDIO-02. |
| 7 | AV Synchronization | Common session timeline | Timer and track alignment (§22.2). |
| 8 | Metadata Manager | Binds investigative/session metadata to evidence | Metadata Entry target. |
| 9 | Time Service | GNSS/NTP/RTC management | Time-source indicator. |
| 10 | Storage Manager | System/evidence storage policy and health | Storage READY/LOW/FULL and capacity. |
| 11 | Security Manager | Key orchestration, crypto workflow, TPM interaction | Security READY/FAULT; sealing steps. |
| 12 | Evidence Manager | Final evidence package and manifest | Finalization and sealed package view. |
| 13 | Relay/GPIO Service | Recording indicator, tamper, external I/O | "SEDANG MEREKAM" lamp and tamper events. |
| 14 | LCD Display Service | Local status display | The 800x480 LCD simulation in the web console. |
| 15 | Health Monitor | CPU/storage/fan/network/camera/audio health | Health dashboard metrics. |
| 16 | Audit Service | Security and operational events | Audit tables. |

Why it matters: this list is a ready-made "services status board" for the Core web console, each tile healthy or faulted. §3.3 extends it to 27 software components (see Part B).

#### §6.2 Session State Machine (M1 L677–L678; M2 for the branch layout)

```
CREATE -> PRECHECK -> ARMED -> RECORDING -> STOPPING -> FINALIZING -> SEALED
                          |
                          +-> FAULT/RECOVERY states as defined by ICD and test plan
```

| State | Order | Notes | Why it matters |
|---|---|---|---|
| CREATE | 1 | Session ID issued (§21.2, §12.2) | Shared `SessionState` enum. |
| PRECHECK | 2 | §5.3 gate | |
| ARMED | 3 | Meaning not defined in the book [Gap]. Plausibly "gate passed, ready to record" [Inference]. | Needs a brief visual "armed" state before the recording starts. |
| RECORDING | 4 | §5.4 | |
| STOPPING | 5 | Tracks closing (§6.4) | |
| FINALIZING | 6 | Hash, manifest, encrypt, sign (§12.2) | Animated step list. |
| SEALED | 7 | Terminal. SYS-008: never seal an incomplete or unfinished session | |
| FAULT/RECOVERY | branch | Not enumerated: "as defined by ICD and test plan". In the XML the branch is drawn at column 27, under "ARMED", but the text does not name the origin state(s) [Gap]. §18.1 supplies recovery vocabulary (RECOVERY_SCAN, INCOMPLETE_SESSION_ANALYSIS). §18.2 says "recoverable/incomplete status". | The demo must invent FAULT/RECOVERY sub-states. They should be labelled as demo assumptions. |

Why the state machine matters: it is the spine of both apps and the mock. One shared state definition in `packages/shared` should drive the mock transitions and both UIs.

#### §6.3 Track Model (M1, L679–L694)

| Logical track | Source | Preservation requirement |
|---|---|---|
| VIDEO-01 | Dual-lens camera Lens/Channel 1 | Independent logical video track |
| VIDEO-02 | Dual-lens camera Lens/Channel 2 | Independent logical video track |
| AUDIO-01 | MIC IN 1 | Independent audio track |
| AUDIO-02 | MIC IN 2 | Independent audio track |

Why it matters: the track IDs are fixed strings used by §21.2 (audio and video status) and §11.1. UI components should be parametrised per track. The book forbids any UI or data path that merges MIC 1 and MIC 2 (§1.1 L83, SYS-003).

#### §6.4 Core Resilience Requirements (M1, L696–L701)

1. "Continue recording when tablet disconnects." This backs the §5.6 disconnect scenario.
2. "Record explicit audit events for camera/audio/storage/time/security faults." Each simulated fault must produce a visible audit row.
3. "Avoid silent track failure: loss of any expected source must create health and audit events." A fault needs both a health alert and an audit entry.
4. "Finalize evidence only after the recording engine has closed track data and the security/evidence workflow has completed or declared a recoverable failure." FINALIZING can end in SEALED or in a recoverable failure.
5. "After unexpected reboot, perform controlled session-recovery analysis before allowing evidence to be treated as sealed." This is the recovery-status screen (§18.1).

Why it matters: these rules define what the fault-injection demo must show. A fault always produces an alert plus an audit entry, and recording is never silently masked.

---

### §11 Evidence File Specification (Draft 0.2), L920–L955

**§11.1 Logical Evidence Tracks** (L921–L936): the same four tracks as §6.3 (VIDEO-01 and VIDEO-02 from camera channels 1 and 2; AUDIO-01 and AUDIO-02 from MIC 1 and MIC 2), each "Independent". Why it matters: it confirms the fixed four-track model for the sealed-package view.

**§11.2 Evidence Package Concept** (L938–L939). Exact items:

| Item | Why it matters |
|---|---|
| `SESSION-<ID>/` | Folder name pattern. The Session ID format is undefined [Gap]. |
| evidence-container / encrypted media payload | Shown as a locked, encrypted blob. |
| `metadata.json` | JSON viewer candidate. |
| `manifest.json` | JSON viewer candidate (fields in §11.3). |
| `signature.sig` | Signature badge. |
| device-certificate / certificate reference | Certificate chip. |
| audit-session-extract | Per-session audit table. |

The book adds: "Exact media container and encryption packaging remain TBD". Why it matters: this list is a ready-made package-explorer tree for the Evidence Review screen and the Core console.

**§11.3 Manifest Minimum Fields (13)** (L940–L953):
1. Session ID
2. Device ID and certificate identifier
3. Operator/investigator identifier
4. Subject/witness metadata as authorized
5. Document/case reference number
6. Start/stop timestamps
7. Active time-source status
8. Camera/device identifiers
9. MIC 1 and MIC 2 track identifiers
10. Per-track cryptographic hashes
11. Encryption algorithm identifier
12. Digital signature and certificate chain reference
13. Finalization status

Why it matters:
- These fields define the Session Summary screen and the `Manifest` type.
- Fields 3–5 are the only metadata-entry fields the book names.
- "Finalization status" values are undefined. §18.2 implies at least sealed and recoverable/incomplete [Gap].

**§11.4 Hashing Rule** (L954–L955): "Each logical track should be independently hashable/verifiable, then bound into the session manifest. The manifest is itself hashed and digitally signed."
- Algorithms named elsewhere: SHA-256 Hash Service (SW.15) and AES-256-GCM Encryption Service (SW.16) in §3.3.
- Why it matters: the demo needs four per-track SHA-256 strings plus a manifest hash and signature, in a monospace display with a verified or failed badge (EVT-13, EVT-14).

### §12 Security & Key Provisioning, L957–L973

**§12.1 Security Model** (L958–L963):
- Software-managed security on RK3588, with a TPM 2.0 / Secure Element hardware root of trust.
- No plaintext private keys on NVMe or HDD.
- Per-session keys are wrapped with hardware-rooted keys.

Why it matters: a Security status card (TPM/SE present, device certificate, key reference). §21.3 has Certificate and KeyReference entities.

**§12.2 Session Security Flow** (L965–L966), exact order:
1. START SESSION
2. Generate Session ID
3. Generate cryptographically secure session key
4. Record independent video/audio tracks
5. Finalize tracks
6. Calculate hashes
7. Build manifest
8. Encrypt evidence payload
9. Sign manifest using device identity/private-key operation
10. Store sealed evidence package

Why it matters: steps 5–10 are the natural animated checklist for the Session Finalization Status module (FINALIZING → SEALED).

Consistency check: the §12.2 order (hashes → manifest → encrypt → sign) matches the §19.1 lifecycle order (HASH → MANIFEST → ENCRYPT → SIGN) and the §11.4 rule that the manifest is "hashed and digitally signed". A single step list can serve both screens.

**§12.3 Manufacturing Provisioning** (L967–L973): unique serial/UUID; device identity and certificate; hardware-protected private key; provisioning audit; secure-boot enable/verify; recovery and re-provisioning under authorization. Why it matters: optional factory/provisioning screen content (see §25 in Part B).

### §19 Evidence Lifecycle, Export & Chain of Custody, L1344–L1372

**§19.1 Evidence Lifecycle (12 stages)** (L1345–L1357), exact:
1. CAPTURE
2. RECORDING
3. FINALIZING
4. HASH
5. MANIFEST
6. ENCRYPT
7. SIGN
8. SEALED LOCAL EVIDENCE
9. AUTHORIZED REVIEW
10. AUTHORIZED EXPORT / TRANSFER
11. DESTINATION VERIFICATION
12. RETENTION / ARCHIVE / DISPOSITION

Why it matters: this lifecycle continues past the §6.2 session machine (SEALED). A lifecycle stepper per evidence item fits the Core console's evidence view and the tablet's review screen.

**§19.2 Export Package (8 items)** (L1358–L1366):
1. Evidence payload or approved interoperable representation
2. Session manifest and per-track hash values
3. Digital signature and certificate-chain reference
4. Export identifier, export timestamp and exporting operator identity
5. Source device identity and source session identifier
6. Destination identifier or approved media identifier
7. Export-package hash and verification result
8. Purpose/reason and authorization reference

Why it matters: these are the fields of an Export wizard and the `ExportEvent` type. Item 8 means the wizard needs a mandatory reason field.

**§19.3 Chain-of-Custody Rules (5)** (L1367–L1372):
1. Export is role-authorized and "shall never silently modify the sealed source session".
2. "Every export/re-export shall create a new immutable/tamper-evident audit event."
3. "Verification of the source evidence shall occur before export."
4. The exported package is verifiable independently of the live Core.
5. Delete, retention and disposition need separate policy and authorization; they are "not implied by export".

Why it matters:
- The export flow order is: authorize → verify source (animated check) → build package → hash and verify → audit row.
- There is no delete button in the export UI.

### §21 Network, API & Data Model Specification, L1410–L1481

#### §21.1 Network Policy (4 domains) (L1411–L1431)

| Domain | Purpose | Baseline access | Rule |
|---|---|---|---|
| Camera Domain | IP camera ingest/control | Camera <-> Core only | No direct Tablet routing |
| Management Domain | Tablet/Core operation | Tablet <-> Core approved services | Default deny other services |
| Service/Update | Controlled maintenance | Authorized service workflow only | Disabled/restricted in normal mode |
| Export/Transfer | Evidence delivery | Role-authorized flow only | Audited + verified |

Why it matters:
- The tablet never talks to the camera. The preview must come through the Core (the mock).
- It also yields a simple network-segmentation diagram for the Core console.
- Related sources: §7.1 (L810) and SYS-005.

#### §21.2 Core API Baseline (9 endpoints) (L1432–L1472)

| Method | Endpoint concept (exact) | Purpose | Notes (exact) | Demo consumer |
|---|---|---|---|---|
| POST | `/api/v1/session` | Create session | Returns Session ID | Tablet NEW SESSION |
| POST | `/api/v1/session/{id}/start` | Start recording | Runs Core pre-check | Tablet START |
| POST | `/api/v1/session/{id}/stop` | Stop recording | Transitions to finalization | Tablet STOP |
| GET | `/api/v1/session/current` | Retrieve active state | Used after reconnect | Tablet resync; web console |
| GET | `/api/v1/device/health` | Health snapshot | Camera/audio/storage/time/security | Pre-check, Diagnostics, web health |
| GET | `/api/v1/audio/status` | Per-channel levels/faults | AUDIO-01/AUDIO-02 | Meters (initial snapshot; live data via WS) |
| GET | `/api/v1/video/status` | Per-track status | VIDEO-01/VIDEO-02 | Preview and track badges |
| GET | `/api/v1/storage/status` | Capacity/health | Includes low/full state | Storage card and gauge |
| POST | `/api/v1/evidence/{id}/export` | Authorized export | RBAC + audit required | Export wizard |

Why it matters:
- This is the mock-core REST surface for the feature phase. It is `/api/v1`-versioned (ICD-23).
- **Not defined in the book [Gap]:**
  - auth/login, pairing, metadata-submit, evidence-list, audit-list and verify endpoints;
  - WebSocket path and message schema;
  - request and response bodies.
- §26 lists "OpenAPI + firewall/port matrix" as the next gate (L1651–L1653), so the demo must define these itself.

#### §21.3 Core Data Entities (24) (L1473–L1481)

| Group (as listed on one line in the book) | Entities |
|---|---|
| Device | Device, HardwareRevision, SoftwareRelease |
| Identity | Operator, Role, AuthenticationEvent |
| Session | Session, CaseReference, Subject/Witness metadata |
| Tracks | VideoTrack, AudioTrack, TrackHealthEvent |
| Evidence | EvidenceObject, Manifest, SignatureRecord |
| Audit | AuditEvent, ExportEvent, TamperEvent |
| Trust | Certificate, KeyReference, ProvisioningRecord |
| Health | HealthSnapshot, StorageDevice, TimeSourceState |

Why it matters:
- These 24 names are the type-stub list for `packages/shared` (blueprint row 15). The group labels are this agent's; the book lists three entities per line without headings.
- The book defines **no attributes** for any entity [Gap]. Field sets must come from §11.3 (Manifest), §19.2 (ExportEvent), §24.1 (Device/config identity), §25.3 (ProvisioningRecord) and §5.3 (health and status enums).

---

## Part B: Remaining sections scanned (only what a demo UI would display or simulate)

### §1 Executive Engineering Baseline and §1.1 Principles (L69–L87)

| Finding | Why it matters | § / line |
|---|---|---|
| One dual-lens IP camera over one PoE link gives two video tracks. Two balanced Mic/Line inputs at a 24-bit/48 kHz minimum give two audio tracks. | Fixed 2+2 track layout in every screen. | §1, L71–L73 |
| Storage: NVMe for OS/DB/cache; a separate HDD for evidence. | Two storage devices on the storage card. | §1, L74 |
| Local machine UI: a 4.3–5 inch LCD, navigation buttons and status LEDs. The tablet remains the primary operator interface. | The LCD simulation shows status only, not a second operator UI. | §1, L76; §1.1, L85 |
| "No AI/video analytics requirement." | The demo should not show AI or analytics features. | §1, L78 |
| MIC 1 and MIC 2 are never permanently mixed. | Two meters, no combined meter. | §1.1, L83 |

### §2 System Architecture (L88–L96)
- **Service zones inside the Core** (L89): "Video / Recording / Audio / Session / Metadata / Security / Time / Storage / Relay / Display / Health". A compact grouping for a Core architecture diagram.
- **§2.2 Time Architecture** (L92): "GNSS/PPS → System Time Service → Recording Timestamps; NTP priority; RTC fallback". The time-source hierarchy is GNSS, then NTP, then RTC. Why it matters: the time-source widget should show the hierarchy and the active tier.

### §3 Detailed Engineering BOM (L97–L556), UI-relevant rows only

| Item | Finding (exact where quoted) | Why it matters |
|---|---|---|
| A.04 / A.05 | NVMe SSD "2 TB"; Evidence HDD "4 TB baseline; capacity TBD by retention calculation" | Capacity numbers for the storage demo. |
| A.14–A.21 | Two independent balanced Mic/Line inputs; independent gain per channel; "48 V phantom power", "Independently controlled"; ADC "2-channel simultaneous, >=24-bit/48 kHz"; "Level/clipping monitor", "Per-channel"; XLR connectors "MIC IN 1 / MIC IN 2" | Audio card per channel: gain, a 48V phantom indicator, a level meter and a clip LED. The book never says whether the tablet can change gain or phantom [Gap]. |
| A.22–A.24 | High-accuracy RTC with battery or supercap backup; GNSS "NMEA + PPS" | Time-source details. |
| A.27 | TPM 2.0 / Secure Element | Security card. |
| A.28–A.31 | Relay board with ≥2 dry contacts; ≥2 isolated digital inputs; chassis tamper switch; recording indicator output with role "SEDANG MEREKAM" (Indonesian for "currently recording") | An external "recording" lamp simulation. The Indonesian label suggests an Indonesian deployment, which is relevant to the UI-language decision (A10) [Inference]. |
| A.32 | Local LCD "4.3–5.0 inch, approx. 800x480", "Machine status display" | Fixed 800x480 canvas in the web console. |
| A.33 | Navigation buttons "UP/DOWN/ENTER/BACK" | Four-button LCD menu navigation. Can be keyboard-mapped in the web demo. |
| A.34 | Status LEDs, 5: "POWER/REC/NET/STORAGE/FAULT" | LED strip. §4.2 names the same LEDs "POWER, RECORD, NETWORK, STORAGE, FAULT". Colours and blink patterns are undefined [Gap]. |
| A.35 | Buzzer, OPTIONAL, "Fault indication" | Optional audible fault cue. |
| A.48 / A.49 / A.62 | PWM fan with tachometer and "fan-failure detection"; temperature sensor(s) | Fan RPM and temperature metrics. |
| A.58 | Recessed recovery button | Recovery-mode entry (service UI). |
| A.59–A.61 | Power-Fail Detector; Hold-up / Safe-Shutdown Energy Module (PRELIMINARY); Hardware Watchdog | Power-fail simulation (§18). |
| A.63 | Secure Export Interface, "disabled by default" | Export-interface status: disabled or enabled. |
| B.01 | Dual-lens forensic IP camera: "two logical video tracks" | Two preview tiles. |
| D.01–D.05 | Operator tablet ("USB-C capable"), USB-C GbE dock, charger, CAT6, stand | The tablet model and screen size are not specified [Gap]. The landscape tablet AVD is a demo choice. |

**§3.3 Software/Firmware BOM (27 components, SW.01–SW.27)** (L470–L556). It adds the following to the §6.1 services:
- SW.01 Linux BSP / OS
- SW.02 DEMS Backend/API
- SW.15 SHA-256 Hash Service
- SW.16 AES-256-GCM Encryption Service
- SW.17 Signature/Certificate Service
- SW.19 Evidence Verification Service
- SW.20 DEMS Native Tablet App
- the v0.2 services SW.21 Power-Fail / Safe Shutdown, SW.22 Evidence Export & Chain-of-Custody, SW.23 Tamper-Evident Audit / Audit Checkpoint, SW.24 Platform Firewall / Network Policy, SW.25 Secure Update / A-B Rollback Manager, SW.26 Configuration Inventory / SBOM Agent
- SW.27 Factory Test & Provisioning Mode ("manufacturing only")

Why it matters: this is the full list for a services status board or an "About / SBOM" view. It also supplies the algorithm labels SHA-256 and AES-256-GCM.

### §4 Appliance Physical Design (L557–L567)
- **Front panel** (L560; §4.2 L566): LCD; five LEDs "POWER/RECORD/NETWORK/STORAGE/FAULT"; UP/DOWN/ENTER/BACK; the label "DEMS EDGE CLIENT / Digital Evidence Recording Controller". No connectors on the front.
- **Rear panel** (L561; §4.2): "AC INPUT; PoE CAM 1; PoE CAM 2/AUX; MGMT LAN; MIC IN 1; MIC IN 2; GNSS SMA; RELAY/DIGITAL I/O TERMINAL; SERVICE USB; RECESSED RECOVERY BUTTON".
- **Envelope**: about 280 x 240 x 70 mm, PRELIMINARY.
- **§4.2 local display**: "machine status only, not primary operator GUI".
- **Why it matters**: the book fully specifies the front and rear panels, so the web console can render an animated front-and-rear "digital twin" of the appliance, with the LCD, LEDs and per-port link lights.

### §7 ICD (L703–L819) and §17 ICD v0.2 (L1254–L1309)

| Item | Finding | Why it matters |
|---|---|---|
| ICD-03 | Tablet Dock → MGMT LAN, payload "HTTPS/WSS/preview", "Primary operator link" | Tablet link status. |
| ICD-04 / ICD-05 | "Independent CH1 + 48V phantom" / "Independent CH2 + 48V phantom" | Per-channel phantom indicator. |
| ICD-15 | "UP/DOWN/ENTER/BACK + 5 LEDs" | LCD panel controls. |
| ICD-17 | "POWER_FAIL asserted before rail collapse" | Power-fail simulation trigger. |
| ICD-19 | Watchdog "Heartbeat/reset", "Independent from main application process" | Watchdog status metric. The book's only use of "heartbeat" for a signal, apart from FMEA "Core heartbeat/API state" (L1521). |
| ICD-20 | Fan tach "RPM/pulse feedback", "Loss/stall threshold TBD" | Fan RPM chart and stall alarm. |
| ICD-21 | Core → Export Target, "MGMT LAN or secured removable media TBD", "Role-authorized only" | Export destination choice in the wizard. |
| ICD-22 | Signed update bundle; "Signature + compatibility + anti-rollback policy" | Update screen (§20.2). |
| ICD-23 / ICD-24 | HTTPS commands/metadata/query, versioned API; WSS "Timer/health/levels/events", resync after reconnect | See §5.5. |
| §7.1 | Camera domain and management domain; "Direct Tablet -> Camera access is not part of baseline design." | See §21.1. |

### §8 Power Budget (L820–L858), UI use: optional power panel
- Preliminary ranges (L826–L853):
  - RK3588 SBC + RAM: 20–35 W
  - NVMe: 5–10 W
  - HDD: 8–25 W
  - PoE Camera Port 1: up to a 30 W budget
  - PoE Port 2: "0 W normal / reserve up to 30 W"
  - Audio + phantom: 5–10 W
  - LCD + LEDs: 3–6 W
  - GNSS/RTC/TPM/Relay: 2–5 W
  - Fans: 2–5 W
- Why it matters: plausible synthetic values for a PoE port card and a power-draw gauge. They are all marked PRELIMINARY.

### §9 Thermal (L859–L889)
- **Heat sources** (L861–L880): RK3588 SoC (High), NVMe (High), HDD (Medium/High), PoE/PSE (Medium/High), PSU/DC-DC (High), audio analog (a "Sensitivity priority").
- **§9.1**: "Fan failure response and thermal throttling/shutdown policy".
- **Why it matters**: per-zone temperature tiles, and thermal throttle or shutdown as alert types.

### §10 Storage & Retention (L890–L918)

| Item | Finding | Why it matters |
|---|---|---|
| §10.1 roles | NVMe 2 TB: "Linux OS, applications, database, indexes, metadata, logs, cache, temporary processing". Evidence HDD: "Finalized forensic video/audio evidence and evidence packages". | A two-disk storage card with role labels. |
| §10.2 formula | `Daily_GB = ((Video1_Mbps + Video2_Mbps + Audio1_Mbps + Audio2_Mbps) / 8) x 3600 x Recording_Hours_Per_Day / 1000`; `Required_Storage = Daily_GB x Retention_Days x Overhead_Factor` | An interactive retention calculator in the web console. |
| §10.3 example ("Example Only — Not Final") | Video 1 "8 Mbps", Video 2 "8 Mbps", Audio 1+2 "Approximately 2.3 Mbps if uncompressed 24-bit/48 kHz mono each", total "Approximately 18.3 Mbps", result "Approximately 8.2 GB/hour before overhead" | Synthetic numbers for the storage demo. Checked by this agent: 24 bit x 48,000 Hz x 2 ch = 2.304 Mbps; 18.3/8 x 3600/1000 = 8.235 GB/h. |
| Derived [Inference, not in the book] | A 4 TB HDD at 8.2 GB/h holds about 488 recording hours before overhead (4000 / 8.2 = 487.8). | A plausible "hours remaining" readout, to be labelled illustrative. |
| Thresholds | "Storage free-space warning, block and reserve thresholds" are TBD (§16.1, L1251). | The LOW and FULL percentages are demo choices [Gap]. |

### §13 Prototype Verification & Test Plan (EVT-01 to EVT-35) (L975–L1085), rows that surface in the UI

| EVT | Test | Acceptance intent (exact or near-exact) | UI surface |
|---|---|---|---|
| 01 | Power-on / boot | "System reaches READY with valid time/storage/security state" | A device-level READY state (boot splash, then READY) |
| 03 | Tablet disconnect | Recording continues; reconnect restores monitoring | Disconnect banner and resync |
| 04 | Camera disconnect | "Fault logged and surfaced" | Lens FAULT, alert, audit |
| 05 / 06 | MIC 1 / MIC 2 disconnect | Fault detected "without silently masking" the other channel | Per-channel NO SIGNAL |
| 07 | Audio clipping | "Per-channel clipping event visible/logged" | CLIP indicator and audit row |
| 08 | Storage low/full | "Warning/block/finalization behavior verified" | LOW warning; FULL blocks Start |
| 09 | Unexpected power loss | "incomplete session not falsely sealed" | Recovery status |
| 10 / 11 | GNSS loss / RTC fallback | Fallback source "identified and logged" | Time-source change toast |
| 12 | Tamper input | "Tamper event recorded" | TamperEvent alert |
| 13 / 14 | Hash verification / evidence modification | Unmodified evidence verifies; verification fails after modification | Verify PASS/FAIL badge |
| 17 | HDD SMART fault | "Health warning generated" | Storage health warning |
| 19 | LCD/LED status | "Local status agrees with core state" | The LCD/LED simulation must mirror Core state |
| 21 | Power-fail early warning | "journals active state and begins controlled shutdown" | §18.1 sequence |
| 23 | Hardware watchdog | Controlled recovery and audit event | Watchdog alert |
| 24 | Fan stall | "Tach loss is detected; thermal policy and alarm operate" | Fan alarm |
| 25 / 26 | Authorized export / unauthorized export attempt | Verifiable package plus export audit record / "Access denied and security event logged" | Export success; RBAC denial |
| 27–29 | Signed update / invalid signature / A/B rollback | Install and health check / rejected / automatic rollback | Update screen outcomes |
| 30 | Audit tamper | "Modified/deleted audit record or chain discontinuity is detected" | Broken-chain indicator in the audit log |
| 32 | Network isolation | Tablet cannot route to the camera domain | Network policy view |
| 33 | RBAC enforcement | "Each role is limited to its approved actions" | Role-gated UI |
| 34 | Factory provisioning | Serial, keys/certificate, inventory, production record | Factory screen |

Why it matters: this table is a ready-made list of fault-injection scenarios for the demo simulator (feature phase, per A2).

### §14 Manufacturing Package, §15 Roadmap and §26 Closure Status (L1086–L1186, L1632–L1667)
- **Content**: document and engineering-gate status only. There are no UI states.
- **Relevant items**:
  - §15.1 (L1150–L1160) says the camera model, bitrate, codec and evidence container are undecided. The preview and evidence visuals are therefore unconstrained.
  - §26 (L1651–L1653): the Network/API "Next Gate" is "OpenAPI + firewall/port matrix". No formal API spec exists yet.

### §16 SRS (SYS-001 to SYS-018) (L1187–L1253), UI-relevant items
- **SYS-001**: recording continues on tablet disconnect.
- **SYS-008**: never mark an incomplete session SEALED.
- **SYS-010**: export needs authorization and a chain-of-custody event.
- **SYS-012**: the audit log is tamper-evident.
- **SYS-014**: source loss creates a health event and an audit event; "silent masking is prohibited".
- **SYS-015**: "record the active time source and time-quality state in session metadata".
- **SYS-016**: "The local LCD shall remain a machine-status interface and shall not be required for session recording."
- **SYS-017**: fan failure is reported.
- **SYS-018**: configuration identity (see §24.1).
- **§16.1 TBD numerics** (L1246–L1253): A/V sync offset and drift; camera resolution, fps, codec and bitrate; hold-up time; temperature ranges; storage thresholds; "boot-to-READY time, session start latency and recovery time"; retention.
- **Why it matters**: no timing budget constrains the demo, so animation durations are free design choices.

### §18 Power-Fail Protection & Safe Shutdown (L1310–L1343)
- **§18.1 Power-Fail State Flow** (L1327–L1337), exact:
  `NORMAL -> POWER_FAIL_DETECTED -> RECORDING_RECOVERY_MARKER_WRITTEN -> FLUSH_MEDIA_AND_METADATA -> STORAGE_SYNC -> SAFE_SHUTDOWN -> POWER_OFF`
  - On next boot: `RECOVERY_SCAN -> INCOMPLETE_SESSION_ANALYSIS -> operator-visible recovery status`
- **Diagram steps** (L1322–L1326): "Flush buffers / journal", "Persist recovery metadata", "Stop noncritical services", "Safe storage sync", "Controlled shutdown".
- **§18.2**:
  - PoE camera power may be shed first.
  - The session "shall carry a recoverable/incomplete status until media and security finalization rules are satisfied".
  - Power-fail events are audit-logged "on next successful persistence opportunity".
  - The hold-up duration is TBD.
- **Why it matters**:
  - A scripted power-fail sequence for the web console: LEDs change and the LCD shows the countdown.
  - A matching "Recovery status" screen on the tablet after reconnect.
  - `PowerFailState` is a clean enum for `packages/shared`.

### §20 Cybersecurity, Secure Update & Recovery (L1373–L1409)
- **§20.1 hardening** (L1374–L1382):
  - default-deny firewall;
  - SSH disabled by default or restricted to service mode;
  - "certificate-bound pairing for Tablet-to-Core control is preferred";
  - "Rate limiting / brute-force protection for authentication endpoints";
  - encrypted transport;
  - no credentials in logs.
  - Why it matters: pairing and lockout states on the login screen, and a "service mode" flag.
- **§20.2 Secure Update Architecture** (L1383–L1400): Signed update bundle → Signature Verification → Compatibility / Hardware-Revision Check → Anti-Rollback Policy → Install to INACTIVE System Slot → Reboot → Post-Boot Health Check. On PASS, commit the new slot. On FAIL, automatic rollback to the last-known-good slot.
  - Why it matters: a step-list animation with PASS and FAIL branches.
- **§20.3 Partition Strategy** (L1401–L1409): NVMe partitions are Boot/Recovery, System Slot A, System Slot B, Persistent Configuration, Database/Metadata, Logs/Audit and Cache/Temporary Processing.
  - Why it matters: an A/B slot indicator and a disk-layout visual.

### §22 Audio Clock & AV Synchronization (L1482–L1513)
- **§22.1**: both channels share one master clock, and the "driver shall expose stable channel order so MIC 1 cannot swap with MIC 2 across boots". "Per-channel gain/phantom control state shall be part of device configuration and audit where appropriate."
  - Why it matters: gain and phantom changes are audit events [Inference: if the demo exposes them].
- **§22.2** (L1495–L1513):
  - initial A/V offset: TBD ms maximum;
  - A/V drift: TBD ms per hour;
  - CH1 vs CH2 skew: "Sample-synchronous by common ADC clock";
  - track start: "Common session timeline";
  - time-source metadata: "Record active GNSS/NTP/RTC source and state".
  - Why it matters: an optional A/V sync health metric, and a time source shown on each session.

### §23 Reliability, FMEA (10 failure modes that become UI alerts) (L1514–L1559)

| Failure mode | Detection | Effect | Required response (exact) |
|---|---|---|---|
| Tablet disconnect | Core heartbeat/API state | Operator monitoring lost | Recording continues; reconnect/resync |
| MIC 1 failure | Signal/ADC health | AUDIO-01 degraded/lost | Alert + audit; do not mask AUDIO-02 |
| MIC 2 failure | Signal/ADC health | AUDIO-02 degraded/lost | Alert + audit; do not mask AUDIO-01 |
| Camera stream loss | Video health | One/both video tracks affected | Alert + audit; policy-driven session behavior |
| HDD write failure | I/O + SMART | Evidence persistence risk | Critical fault; controlled stop/recovery policy |
| GNSS loss | Time Service | Primary time source lost | Fallback to trusted NTP, then RTC; log source |
| Fan stall | Tachometer | Thermal risk | Alarm, throttle and/or controlled shutdown |
| TPM/SE failure | Security Manager | Cannot safely sign/seal | Block sealing/export; service required |
| Power loss | Power-fail detector | Abrupt shutdown risk | Hold-up + controlled shutdown |
| OS/service hang | Hardware watchdog | System unavailable | Controlled reset + recovery analysis |

Why it matters:
- Each row is an alert type with a severity. "Critical fault" and "Block sealing/export" are the highest.
- Each row also drives a detection-source label and a required-response message.
- "Degraded/lost" gives a third track health level beyond READY and FAULT [Inference].
- §23.2 (L1560–L1568): environmental and EMC categories. There is no UI content.

### §24 Configuration Management, SBOM & Release Control (L1569–L1589)
- **§24.1 Per-Device Configuration Identity (12 fields)**:
  1. serial number and hardware UUID;
  2. chassis/mechanical revision;
  3. SBC/SOM part number and revision;
  4. audio board revision;
  5. PoE/network board revision;
  6. power board revision;
  7. bootloader/BSP/kernel/device-tree version;
  8. DEMS Core software version;
  9. DEMS Tablet App version;
  10. TPM/SE model and firmware;
  11. camera model and firmware;
  12. factory provisioning record and device certificate identifier.
- **§24.3**: each release has a unique version, build ID and checksum. "Configuration drift ... shall be detectable."
- **Why it matters**: an "About this device" panel, and a "configuration drift" warning as an alert type.

### §25 Factory Test, Provisioning & Production Acceptance (L1590–L1631)
- **§25.1 Factory Mode test groups (10)**, each with its minimum check:
  - Compute: RAM/CPU/boot/NVMe
  - Evidence Storage: HDD presence, SMART, write/read
  - Network: MGMT LAN + camera link
  - PoE: port detection and PSE output
  - Audio: CH1/CH2 gain, phantom, capture
  - Display/HMI: LCD, buttons, LEDs, buzzer
  - Time: RTC set/read; GNSS/PPS
  - I/O: relays, digital inputs, tamper
  - Security: TPM/SE detect, key/cert provisioning, secure-boot state
  - Thermal: fan/tach, sensors
- **§25.2 Secure Provisioning Sequence (10 steps)**:
  1. Record hardware inventory
  2. Assign serial/UUID
  3. Validate TPM/SE identity
  4. Generate or provision the device key
  5. Issue/install the device certificate
  6. Install the signed Core image
  7. Enable/verify secure boot
  8. Run the full factory functional test
  9. Create the production acceptance record
  10. Lock/restrict Factory Mode
- **§25.3 Acceptance Record (6 fields)**: serial, MACs and certificate ID; hardware/PCB revisions; software versions and checksum; test result and operator/station ID; date/time; deviation reference.
- **Why it matters**: an optional "Factory / Provisioning" screen in the web console, with a 10-group self-test grid and a 10-step provisioning stepper. It suits a device-lifecycle demo, but it is outside the operator flow.

---

## Part C: Consolidated enumerations (candidate `packages/shared` types)

| Enum (proposed name) | Values (exact from the book) | Source |
|---|---|---|
| SessionState | CREATE, PRECHECK, ARMED, RECORDING, STOPPING, FINALIZING, SEALED, plus FAULT/RECOVERY (unenumerated) | §6.2 |
| TabletScreen | LOGIN, DASHBOARD, NEW SESSION, METADATA, PRE-CHECK, START, RECORDING MONITOR, STOP, FINALIZATION, SESSION SUMMARY | §5.2 |
| CoreLinkState | ONLINE, OFFLINE | §5.3 |
| LensState | READY, FAULT | §5.3 |
| MicState | READY, NO SIGNAL, CLIP | §5.3 |
| StorageState | READY, LOW, FULL (the recording screen shows "OK") | §5.3, §5.4 |
| TimeSource | GNSS, NTP, RTC (priority order); time quality: only "LOCKED" is named | §5.3, §5.4, §2.2, §23.1 |
| SecurityState | READY, FAULT | §5.3 |
| TrackId | VIDEO-01, VIDEO-02, AUDIO-01, AUDIO-02 | §6.3, §11.1 |
| TrackRecState | REC (the only value shown); "degraded/lost" appears in the FMEA | §5.4, §23.1 |
| DeviceReadiness | READY (boot target) | EVT-01 |
| PowerFailState | NORMAL, POWER_FAIL_DETECTED, RECORDING_RECOVERY_MARKER_WRITTEN, FLUSH_MEDIA_AND_METADATA, STORAGE_SYNC, SAFE_SHUTDOWN, POWER_OFF; boot: RECOVERY_SCAN, INCOMPLETE_SESSION_ANALYSIS | §18.1 |
| EvidenceLifecycleStage | CAPTURE, RECORDING, FINALIZING, HASH, MANIFEST, ENCRYPT, SIGN, SEALED LOCAL EVIDENCE, AUTHORIZED REVIEW, AUTHORIZED EXPORT / TRANSFER, DESTINATION VERIFICATION, RETENTION / ARCHIVE / DISPOSITION | §19.1 |
| FinalizationStep | Finalize tracks, Calculate hashes, Build manifest, Encrypt evidence payload, Sign manifest, Store sealed evidence package | §12.2 |
| UpdateStep | Signature Verification, Compatibility / Hardware-Revision Check, Anti-Rollback Policy, Install to INACTIVE System Slot, Reboot, Post-Boot Health Check; outcome PASS (commit) or FAIL (rollback) | §20.2 |
| SystemSlot | A, B | §20.3 |
| Led | POWER, REC/RECORD, NET/NETWORK, STORAGE, FAULT | §3 A.34, §4.2 |
| LcdButton | UP, DOWN, ENTER, BACK | §3 A.33 |
| NetworkDomain | Camera, Management, Service/Update, Export/Transfer | §21.1 |
| HealthCategory | CPU, storage, fan, network, camera, audio (§6.1); plus time and security (§21.2 health) | §6.1, §21.2 |
| AuditEventKind (book-sourced) | AuthenticationEvent, TrackHealthEvent, AuditEvent, ExportEvent, TamperEvent (§21.3). Also: audio clipping event (EVT-07); camera/audio/storage/time/security fault events (§6.4); power-fail event (§18.2); watchdog recovery (EVT-23); unauthorized export security event (EVT-26); audit-chain discontinuity (EVT-30); gain/phantom change (§22.1); provisioning audit (§12.3); configuration drift (§24.3) | as listed |
| Roles (RBAC) | **None named in the book [Gap].** Actors referenced: Operator (§5, §21.3), "Operator/investigator" (§11.3), exporting operator (§19.2), authorized service workflow (§21.1), factory operator/station (§25.3). RBAC is required for export (§21.2, §19.3, EVT-33). | M4 grep |

## Part D: Gaps the feature phase must decide (the book is silent)

| # | Missing information | Impact on the demo | Evidence of absence |
|---|---|---|---|
| G1 | Role names and permission matrix | The demo must define roles, e.g. Operator vs. Supervisor/Custodian [Inference], for RBAC gating and the EVT-26 denial | M4 grep for role/RBAC/admin/supervisor/investigator: only generic mentions (L1076–L1077, L1285, L1368, L1430, L1472, L1475) |
| G2 | Local LCD screen content and menu tree | The 800x480 LCD layout is a design choice. The book only says "machine status" and that it must agree with Core state (EVT-19) | L260, L671, L1238 |
| G3 | LED colours and blink semantics | A mapping is needed (e.g. REC solid or blinking, FAULT on alert) | L270 and L566 name the LEDs only |
| G4 | FAULT/RECOVERY sub-states and the meaning of ARMED | The mock defines them. Label them as demo assumptions | L678 |
| G5 | Audio meter scale (dBFS), update rate and clip threshold | Choose the meter ballistics and WS rate (e.g. 20–30 Hz) [Hypothesis] | §5.4 and A.20 give no numbers |
| G6 | WebSocket path, message schema and event names; request/response bodies; auth/metadata/list endpoints | Define them in `packages/shared` | §21.2 endpoint concepts only; §26 "OpenAPI" is the next gate |
| G7 | Preview protocol, resolution, fps and bitrate | Use local looped clips | §5.5 "protocol selection TBD"; §16.1 |
| G8 | Storage LOW/FULL thresholds; MIC warn-or-block policy; lens block policy | Demo policy config | §5.3; §16.1 L1251 |
| G9 | Time-quality states other than "LOCKED" | Define e.g. LOCKED, SYNCED, FREE-RUNNING [Hypothesis] | §5.4; SYS-015 requires a time-quality state but does not list values |
| G10 | Entity attributes for all 24 §21.3 entities; Session ID format | Derive from §11.3, §19.2, §24.1 and §25.3 | L1474–L1481 names only |
| G11 | Metadata-entry form fields beyond the manifest-level ones | Minimal form: case reference, operator/investigator, subject/witness | §11.3 fields 3–5 |
| G12 | Tablet model and screen size; UI language; theme or branding | Landscape tablet AVD; language per A10 ("SEDANG MEREKAM" hints at Indonesian); theme is a free choice | D.01 "USB-C capable" only; A.31 |
| G13 | Whether the tablet exposes gain or phantom control | Show read-only indicators unless decided otherwise | §5 says the tablet does not control camera, storage, TPM or relay; audio control is unmentioned |
| G14 | A Core-side operator or admin GUI | **The book defines none.** The Core's own UI is the LCD, 4 buttons and 5 LEDs. The React "Core" web console (A1) is therefore a demo visualisation of the appliance, not a baseline product surface. | §1.1 L85; §4.2; §20.1 (only required services enabled) |

---

## Stack capability needs

Each capability is tied to the book section that creates the need. Items marked [Hypothesis] are this agent's design inference, not a book requirement.

| # | Capability the demo stack must support | Applies to | § reference |
|---|---|---|---|
| S1 | Typed REST client for a versioned `/api/v1` surface (9 endpoints), with shared request/response types | web, mobile, mock | §5.5, §21.2, ICD-23 |
| S2 | WebSocket realtime channel carrying timer, health, levels and events, with auto-reconnect and backoff and a REST resync (`GET /session/current`) on reconnect | web, mobile, mock | §5.5, §5.6, ICD-24 |
| S3 | High-frequency rendering of two independent audio level meters (peak hold, clip latch) without JS-thread jank: UI-thread animation on mobile and GPU-friendly transforms or canvas on web. The update rate is undefined; 20–30 Hz is assumed [Hypothesis] | web, mobile | §5.1 (Dual Audio Level Monitor), §5.3 MIC states, §5.4, A.20, EVT-07 |
| S4 | Server-authoritative session timer (HH:MM:SS) that survives reconnect and app restart | web, mobile | §5.4, §5.5, §5.6 |
| S5 | Video playback of two looped, local synthetic preview clips (VIDEO-01 and VIDEO-02) in tiles, with a fault or offline overlay | web, mobile | §5.1 (Camera Preview), §5.5, §6.3, B.01 |
| S6 | A single shared state machine definition (session states plus power-fail states) driving the mock transitions and both UIs; state-guarded navigation that blocks back-navigation during RECORDING and routes to the right screen on resync | shared, mock, mobile, web | §5.2, §6.2, §18.1 |
| S7 | Gate/checklist component with per-item status badges and pass/warn/block evaluation from a policy object (configurable and TBD rules) | mobile (web mirror) | §5.3 |
| S8 | Shared status-to-design-token mapping (colour, icon, label) for every enumeration in Part C, consumable by both the web and mobile styling systems | shared | §5.3, §5.4, §4.2 LEDs |
| S9 | Connection-state banner and degraded mode (offline, reconnecting, resynced), with the web console still showing RECORDING while the tablet is offline | mobile, web | §5.6, §23.1, EVT-03 |
| S10 | Forms with schema validation for session metadata | mobile | §5.1 (Metadata Entry), §11.3, §21.3 |
| S11 | Login and pairing screen, with a rate-limit or lockout state | mobile | §5.1, §20.1 |
| S12 | Animated stepper or progress list for multi-step pipelines (finalization, lifecycle, secure update, provisioning, power-fail) | mobile, web | §12.2, §19.1, §20.2, §25.2, §18.1 |
| S13 | Data tables with sort, filter and virtualisation for audit, evidence and export records, plus a tamper-chain status indicator | web, mobile | §5.1 (Operator Audit View), §21.3, §19.3, SYS-012, EVT-30 |
| S14 | Time-series charts and gauges for health metrics: CPU, temperatures per zone, fan RPM, storage usage, network link, camera and audio health | web (primary), mobile (Device Health) | §6.1 Health Monitor, §9, ICD-20, EVT-16/17/24, §21.2 |
| S15 | Capacity gauge and retention calculator (bitrate inputs to GB/hour and hours remaining) | web | §10.2, §10.3, §5.3 Storage |
| S16 | Toast, alert and notification system with severity levels (info, warning, critical/block), each alert paired with an audit entry | web, mobile | §6.4, §23.1, SYS-014 |
| S17 | Fixed 800x480 LCD simulation component (scaled canvas) with 4-button navigation mapped to the keyboard, plus a 5-LED strip with on, off and blink animations and a "SEDANG MEREKAM" recording-lamp indicator | web | §3 A.31–A.34, §4.2, SYS-016, EVT-19 |
| S18 | Front and rear appliance panel visual ("digital twin") with per-port link indicators | web | §4.1, §4.2, §7 |
| S19 | Monospace hash and signature display with copy, and a verification PASS/FAIL badge; JSON viewer for `manifest.json` and `metadata.json`; package tree explorer | web, mobile | §11.2–§11.4, §19.2, EVT-13/14 |
| S20 | RBAC-aware UI gating (hide or disable plus a denial message), driven by the session operator's role | web, mobile | §19.3, §21.2 export, EVT-26, EVT-33 |
| S21 | Modal confirmation dialogs with a mandatory reason field (Stop Session, Export) | mobile, web | §5.4, §19.2 item 8 |
| S22 | Time-source widget showing the GNSS → NTP → RTC hierarchy, the active tier and its lock state, with fallback toasts | web, mobile | §2.2, §5.3, §5.4, §22.2, §23.1, EVT-10/11 |
| S23 | Landscape-locked tablet layout with multi-pane composition (preview, meters, status column) | mobile | §5 (tablet as primary operator UI); A3; §5.4 layout |
| S24 | Dark-theme suitability: a recording console for interview rooms, and an LCD-style panel [Hypothesis, since the book has no theme guidance] | web, mobile | §5.4, §4.2; G12 |
| S25 | Mock-core fault-injection hooks and scripted scenarios keyed to EVT IDs and FMEA rows, run deterministically for a live demo (feature phase, per A2) | mock, web control panel | §13, §23.1 |
| S26 | Idempotent session creation in the mock (a second active session is refused), so reconnect never starts a second recording | mock | §5.6 |
| S27 | i18n readiness (English technical terms plus possible Indonesian labels) | web, mobile | §3 A.31 "SEDANG MEREKAM"; A10 |
| S28 | Keep the tablet screen awake during the Live Session Monitor [Hypothesis, UX inference] | mobile | §5.4 |
| S29 | Timestamp formatting that shows the time source next to start and stop times | web, mobile | §11.3 fields 6–7, SYS-015 |

## Suggested demo screen inventory

### Tablet app (React Native, Android, landscape)

| # | Screen | Content | § |
|---|---|---|---|
| T1 | Login & Device Pairing | Credentials, pairing status, lockout after repeated failures | §5.1, §5.2 LOGIN, §20.1 |
| T2 | Dashboard | Core ONLINE/OFFLINE, health summary, time source, storage, "New Session", recent sealed sessions | §5.1, §5.2, §21.2 health |
| T3 | New Session / Session Preparation | Create session and receive a Session ID (CREATE) | §5.1, §6.2, §21.2 `POST /session` |
| T4 | Metadata Entry | Case reference, operator/investigator, subject/witness (authorized fields) | §5.1, §11.3, §21.3 |
| T5 | Pre-Recording Health Check | The 8-item gate with states and block reasons; Start is enabled only when the gate passes | §5.3, §6.2 PRECHECK |
| T6 | Camera Preview & Dual Audio Level Monitor | Two preview tiles plus two meters with clip, used before recording (can be embedded in T5) | §5.1, §5.5, §6.3 |
| T7 | Recording Control (Armed / Start) | Brief ARMED state, then the start transition | §5.1, §5.2 START, §6.2 ARMED, §21.2 start |
| T8 | Live Session Monitor (Recording) | Pulsing RECORDING indicator, HH:MM:SS timer, VIDEO 1/2 REC, MIC 1/2 meters, STORAGE, TIME, STOP SESSION | §5.4, §5.1 |
| T9 | Stop Confirmation | Confirm the stop (STOPPING) | §5.4, §21.2 stop |
| T10 | Session Finalization Status | Animated steps: finalize, hash, manifest, encrypt, sign, seal (FINALIZING → SEALED) | §5.1, §12.2, §6.2 |
| T11 | Session Summary | Manifest fields, per-track hashes, time source, finalization status | §5.2, §11.3 |
| T12 | Authorized Evidence Review | Sealed session list, package tree, verify with PASS/FAIL, lifecycle stage | §5.1, §11.2, §19.1, EVT-13/14 |
| T13 | Device Health & Diagnostics | Camera, audio, storage, time and security health; per-track status | §5.1, §6.1, §21.2 |
| T14 | Operator Audit View | Filterable audit table | §5.1, §21.3 |
| T15 | Connection Lost / Reconnecting overlay | Banner, reconnect progress, resync, then routing to the current state | §5.6, §5.5 |
| T16 | Recovery Status | Shown after a Core power-fail or reboot: incomplete session analysis | §18.1, §6.4, EVT-09 |

### Core web console (React; a demo visualisation of the Core Machine, per A1 and G14)

| # | Screen | Content | § |
|---|---|---|---|
| C1 | Appliance Overview (digital twin, front panel) | 800x480 LCD simulation with UP/DOWN/ENTER/BACK, five LEDs, recording lamp ("SEDANG MEREKAM") | §3 A.31–A.34, §4.1, §4.2, SYS-016, EVT-19 |
| C2 | Rear Panel & Connectivity | Port map (PoE CAM 1, PoE CAM 2/AUX, MGMT LAN, MIC IN 1/2, GNSS SMA, relay I/O) with link status and PoE power | §4.1, §4.2, §7, §8 |
| C3 | Services Board | 16 Core services (or 27 SW components) with health | §6.1, §3.3 |
| C4 | Live Session Mirror | Session state-machine visual, 4 tracks, timer, meters, and tablet connection status (shows recording continuing while the tablet is offline) | §6.2, §6.3, §5.4, §5.6 |
| C5 | Health & Diagnostics | Charts for CPU, zone temperatures, fan RPM, storage, network, camera and audio | §6.1, §9, ICD-20, §21.2 |
| C6 | Storage & Retention | NVMe and HDD roles and capacity, READY/LOW/FULL, retention calculator | §10, §5.3 |
| C7 | Time Sources | GNSS → NTP → RTC hierarchy, active source, lock state, fallback history | §2.2, §22.2, §23.1 |
| C8 | Evidence Store | Sealed sessions, lifecycle stepper, package explorer, manifest and hash viewer, verify | §11, §19.1 |
| C9 | Export Wizard (chain of custody) | Authorize, verify source, choose destination, enter reason, build, hash, record audit; RBAC denial path | §19.2, §19.3, §21.2 export, ICD-21, EVT-25/26 |
| C10 | Audit Log | Tamper-evident chain view, event types, discontinuity alert | §21.3, SYS-012, EVT-30 |
| C11 | Security & Keys | TPM/SE status, device certificate, key references, session security flow | §12, §20.1 |
| C12 | Power-Fail Simulation | Scripted §18.1 sequence with LED and LCD reactions, then recovery on "reboot" | §18, EVT-21/22 |
| C13 | Secure Update (A/B) | Update steps, slot A/B indicator, PASS commit or FAIL rollback | §20.2, §20.3, EVT-27–29 |
| C14 | Device Identity / SBOM | 12-field configuration identity, release info, drift warning | §24 |
| C15 | Network Policy | Four-domain segmentation diagram | §21.1, §7.1, EVT-32 |
| C16 | Factory Mode / Provisioning (optional) | 10-group self-test grid, 10-step provisioning stepper, acceptance record | §25 |
| C17 | Demo Control Panel (demo-only) | Fault-injection buttons keyed to EVT and FMEA scenarios (camera loss, MIC clip, storage full, GNSS loss, tamper, fan stall, power fail) | §13, §23.1 |

---
*Extraction: local only (textutil, unzip, python3, grep). No full-text copy was written to the workspace. Zero web tool calls.*
*Generated: 2026-09-30 by document-reader (blueprint row 1).*
