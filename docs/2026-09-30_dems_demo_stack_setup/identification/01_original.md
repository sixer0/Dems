---
task_id: 2026-09-30_dems_demo_stack_setup
task_slug: dems_demo_stack_setup
date: 2026-09-30
agent: request-translator
status: original
---

# Original Request: DEMS Demo Stack Setup

## User Request

Verbatim, original language (Indonesian), line breaks preserved:

```text
pelajari dokumen di project dems.
kita akan membuat core dan mobile apps android based on dokumen untuk demo
stacknya react / react native fokus ke UI Elegant, Modern, Full Animation untuk action dan transisi. fokus ke User Interface dan Experience yang mewah dan elegan.

pertama siapkan dulu stacknya, kamu saya ijinkan untuk mengunduh dan install semua aplikasi yang dibutuhkan. gunakan framework2 siap pakai agar pekerjaan sesingkat mungkin
```

## Request Metadata

- **Task Title**: DEMS Demo Stack Setup
- **Date Received**: 2026-09-30
- **Request Language**: Indonesian
- **Workspace Root**: `/Users/gsp-budi/Documents/DEMS`
- **Task Folder**: `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/`
- **History References Provided**: No. The controller reported "No relevant history (no prior /docs folder, no memory files)".
  - request-translator checked this independently. `docs/` contains only this task's `README.md` and `status_tasks.md`. `/Users/gsp-budi/Documents/DEMS/.claude/` contains no files (Glob `.claude/**/*` returned no matches).

## Raw Context

### Source document

- **Path**: `/Users/gsp-budi/Documents/DEMS/DEMS_Edge_Client_Engineering_Design_Book_v0.2_DOWNLOAD(2).docx`
- **Title**: "DEMS EDGE CLIENT Engineering Design Book — Digital Evidence Recording Controller", v0.2, dated 30 Sep 2026, about 6,963 words, 26 sections. Sections cover hardware BOM, ICD, power, thermal, storage, evidence spec, security, SRS, API, FMEA and factory provisioning.
- **Classification**: Confidential engineering working document.
- **Note**: request-translator cannot open `.docx` files. The software-relevant content below is the controller's read-only extract, copied as received.

**§5 Tablet Software Design.** The tablet is the primary operator interface: authentication, metadata entry, preview, pre-check, Start/Stop session and monitoring. It is NOT a recording endpoint. It connects through a USB-C GbE dock and CAT6 cable to the MGMT LAN. Losing the tablet must not stop a recording.
- §5.1 modules: Authentication & device pairing; Dashboard; New Session/Session Preparation; Metadata Entry; Camera Preview; Dual Audio Level Monitor; Pre-Recording Health Check; Recording Control; Live Session Monitor; Session Finalization Status; Authorized Evidence Review; Device Health & Diagnostics; Operator Audit View.
- §5.2 flow: LOGIN → DASHBOARD → NEW SESSION → METADATA → PRE-CHECK → START → RECORDING MONITOR → STOP → FINALIZATION → SESSION SUMMARY.
- §5.3 pre-recording gate: Core Machine ONLINE/OFFLINE; Video Lens 1/2 READY/FAULT; MIC 1/2 READY/NO SIGNAL/CLIP; Storage READY/LOW/FULL; Time Sync GNSS/NTP/RTC; Security READY/FAULT.
- §5.4 recording screen: timer; VIDEO 1/2 REC; MIC 1/2 with level meters; STORAGE; TIME GNSS LOCKED; STOP SESSION.
- §5.5 communications: HTTPS REST for login, metadata and control; Secure WebSocket for realtime status, timer and audio levels; low-bitrate preview stream; reconnect with state resync.

**§6 Core Machine Software.** 16 services: API Gateway, Auth, Session Manager, Video Mgmt, Recording Engine, Audio Capture, AV Sync, Metadata Manager, Time Service, Storage Manager, Security Manager, Evidence Manager, Relay/GPIO, LCD Display, Health Monitor, Audit.
- Session state machine: CREATE → PRECHECK → ARMED → RECORDING → STOPPING → FINALIZING → SEALED, plus FAULT/RECOVERY.
- Tracks: VIDEO-01, VIDEO-02, AUDIO-01, AUDIO-02.
- Local LCD, 800x480, showing machine status.

**§11 / §12 / §19 Evidence.**
- Evidence package: `metadata.json`, `manifest.json`, `signature.sig`, with a hash per track.
- Lifecycle: CAPTURE → … → SEALED → AUTHORIZED REVIEW → EXPORT → VERIFICATION → RETENTION.
- Chain-of-custody rules apply.

**§21.2 Core API baseline:**
- `POST /api/v1/session`
- `POST /session/{id}/start`
- `POST /session/{id}/stop`
- `GET /session/current`
- `GET /device/health`
- `GET /audio/status`
- `GET /video/status`
- `GET /storage/status`
- `POST /evidence/{id}/export`

**§21.3 Data entities:** Device, Operator, Role, Session, CaseReference, VideoTrack, AudioTrack, EvidenceObject, Manifest, AuditEvent, ExportEvent, HealthSnapshot, TimeSourceState, and others.

### Environment pre-screen (controller, read-only, 2026-09-30)

- Host: macOS 27.0.1, arm64, 725 GiB free.
- Present: node v26.8.2, npm 11.19.1, git 2.55.0, Homebrew 6.0.22.
- Missing: JDK, Android SDK (`ANDROID_HOME` unset), adb, emulator, sdkmanager, watchman, pnpm, yarn, bun, expo/eas CLI.
- The workspace is not a git repository.

### Controller interpretation notes (for request-translator to validate)

- "core" most plausibly means a React web application representing the Core Machine: an operator/admin console, and probably a simulated Core backend so the demo runs without hardware. It is unclear whether a mock Core API/WebSocket server belongs in this stack step.
- "mobile apps android" means a React Native app for the operator tablet. Tablet versus phone form factor is unclear; the document says tablet.
- The immediate scope is stack preparation ("pertama siapkan dulu stacknya"), not the feature screens.
- The user explicitly authorised downloading and installing all required applications.

---
*Generated: 2026-09-30 (clock time not available to this agent)*
