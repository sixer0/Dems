---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-12
agent: request-translator
status: original
---

# Original Request: Rencana adaptasi logika input-av ke adapter Core (tanpa pencatatan ganda)

## User Request

Verbatim, Bahasa Indonesia, spacing and punctuation as received:

> buat rencana untuk adaptasi logika input av ke  adapter core.  agar tidak terjadi pencatatan ganda,

## Preceding User Request (same conversation, context only)

Verbatim:

> cek dan pelajari apps/input-av ini adalah api untuk jalur input onvif dan microphone cek dengan kompatibilitas dems secara keseluruhan

## Request Metadata

- **Task Title**: Rencana adaptasi logika input-av ke adapter Core (tanpa pencatatan ganda)
- **Date Received**: 2026-10-12
- **Folder**: `/Users/gsp-budi/Documents/DEMS/docs/2026-10-12_input_av_core_adapter_plan/`
- **History References Provided**: Yes
  - `/Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/` (task 3: real capture, sealing; adapter layer, class-C stubs, decision log)
  - `/Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/` (task 2: backend, RBAC, pairing)

## Raw Context

Everything in this section was supplied by the Master Controller with the delegation. It is recorded as received. The sources named are the controller's; this agent did not re-derive them.

### What `apps/input-av` is

- "DEMS EDGE" v0.3.0: a standalone, Linux-only Python FastAPI + SQLite + FFmpeg + MediaMTX forensic NVR. It has its own REST API `/api/v1`, web UI, users (admin / operator / auditor, JWT HS256), rooms, cameras, cases, sessions, recordings, markers, devices, settings and a hash-chained audit log. Sources: `apps/input-av/README.md`, `nvr/db.py`, `nvr/audit.py`, `nvr/security.py`, `docs/API-TABLET.md`, `docs/SERAH-TERIMA.md`.
- Hardware logic:
  - ONVIF WS-Discovery + ARP sweep + factory-IP scan + SetNetworkInterfaces (`nvr/discovery.py`, `nvr/onvif_client.py`, `nvr/factory.py`, `nvr/netalias.py`, `nvr/passive.py`)
  - RTSP record with stream copy to MPEG-TS, reconnect as a new part (`nvr/recorder.py`, `nvr/service.py`)
  - USB soundcard through ALSA dsnoop, per-room input selection, FLAC 24-bit / 48 kHz as a separate file, level meter, mixer gain, A/V offset (`nvr/audio.py`, `nvr/routers/audio.py`)
  - storage guard (`nvr/storage.py`)
  - MediaMTX preview (`nvr/mediamtx.py`)
- Tested on real hardware: Uniview IPC312LP and three Tiandy TC-C320N (all deliver H.265 although ONVIF reports H264), Audient EVO 8 (`docs/SERAH-TERIMA.md`).

### What the Core has today

- The production adapters are interface-complete stubs that refuse every call:
  - `apps/core-server/src/capture/adapters/camera/onvif-rtsp.ts` (kind `ONVIF_RTSP`, `hasOpener` false)
  - `apps/core-server/src/capture/adapters/audio/usb-audio.ts` (kind `USB_AUDIO`, `hasOpener` false)
- Adapter contract: `apps/core-server/src/capture/adapters/types.ts`; kinds in `kinds.ts`; the microphone transport statement in `mic-transport.ts` (one transport: a named pipe of raw PCM; a real USB / network microphone transport is class C-4, not built).
- WS-Discovery search and the ONVIF connection test already exist in the Core (`camera/ws-discovery.ts`, `camera/onvif-discovery.ts`, `camera/onvif-session.ts`). The connection test accepts H.264 profiles only (`onvif-session.ts:491`, outcome `NOT_H264`).
- The Core records through `apps/capture-worker` (C, FFmpeg libraries): fragmented MP4 per camera (`src/ingest.c:344,367`); one AAC encoder; mono 48 kHz session audio AUDIO-01 inside the camera files; microphones resampled (`src/audio.c`; `packages/shared/src/api/capture.ts:41,43`).
- One session open per Core (`apps/core-server/src/modules/sessions/index.ts:3`).
- Evidence is sealed: AES-256-GCM per fragment, signed manifest; camera credentials are sealed and write-only (root `README.md`, section "Real capture, sealing and transcript").

### Mismatches the controller found

| Area | input-av | Core |
|---|---|---|
| Stack / host | Python, SQLite, Linux-only | Node / TypeScript, PostgreSQL, macOS development host |
| Identity | own users, JWT HS256 | Core RBAC and pairing |
| Video codec | cameras deliver H.265 | connection test accepts H.264 only |
| Container | MPEG-TS, stream copy | fragmented MP4 |
| Audio | lossless FLAC, separate file | AAC mono, inside the camera file |
| Concurrency | 8 rooms recording at once | one session open per Core |
| Evidence | unsigned plain files with SHA-256 | sealed, signed package |
| Camera credential | plaintext password | sealed, write-only |
| Audit | own hash chain | own hash chain; the two are not connected |

### The controller's reading of "pencatatan ganda"

Marked by the controller as an **interpretation**, to be confirmed or flagged:

- Primary reading: no second system of record. One database, one audit chain, one user / RBAC base, one evidence format and custody chain, one device registry. So input-av must not keep running as a parallel recorder / API beside the Core.
- Alternative readings: "the same session recorded twice by two recorders", or "duplicate log entries".

### Four decisions already put to the user, unanswered

1. Accept H.265, or force the cameras to H.264.
2. Evidentiary audio stays AAC mono in-file, or becomes lossless and separate.
3. One Core serves many rooms concurrently, or one Core per room.
4. Whether the production Core host is Linux (the microphone path depends on ALSA).

### Stated by the controller about the deliverable and the limits

- The deliverable is a **plan** (*rencana*), not an implementation.
- The user works in Bahasa Indonesia. Deliverables in this repository's `/docs` are usually English with Indonesian summaries.
- `apps/input-av/data/` holds real recordings and an audit log and must never be modified (`apps/input-av/docs/SERAH-TERIMA.md`, rule 1).
- No real camera credential may be typed, stored or received by agents (root `README.md`, D76).

---
*Generated: 2026-10-12 (clock time not available to this agent)*
