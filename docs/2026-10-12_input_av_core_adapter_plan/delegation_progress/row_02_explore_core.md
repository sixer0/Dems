# Row 2 progress - explore (Core capture target as built)

- Status: complete
- Artifact: `research/01_explore_core.md` (13 numbered sections plus supporting units; seams S1-S6 tagged in the index table)
- Read-only: nothing outside this task folder written; `apps/input-av/data/` and `.env` not opened; no build, test, server or worker run.
- Method: Graft skeletons for `local/mic-helper.ts`, `local/mic-pipe.ts`, `capture-session/index.ts`; direct reads and grep for the rest.
- Key facts for the controller:
  - `OPENER_CAPABLE_KINDS` = FAKE, LOCAL_DEVICE; 3 source lines (registry.ts:36,82; fence/sources.ts:86,106) and pins in registry.test.ts:89-90, camera-helper.test.ts:532, plus behaviour tests listed in section 3.
  - `onvif-session.ts:491` returns NOT_H264 when no profile is H.264; `loadProductionAdapters` has no non-test caller; REAL_PRODUCTION registry is empty.
  - Worker: no codec name, test or refusal for HEVC in `apps/capture-worker`; stream copy to mp4 muxer (ingest.c:361-362,344); tests assert h264 only; audio fixed to 48 kHz mono, plan refused otherwise (capture_worker.c:149), pipe read as 4-byte float; no 24-bit anywhere.
  - Local opener pattern: FFmpeg helper pushes RTSP/TCP to the worker loopback listener (camera, encodes, avfoundation input) and writes f32le 48 kHz mono to a named pipe (mic).
- Not covered: listed in "What was not examined" of the artifact.
- Decisions: none taken.
