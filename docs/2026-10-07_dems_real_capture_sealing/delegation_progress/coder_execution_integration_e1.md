# coder-execution - integration pass E1

Status: complete (no commit, no migration, no db or schema pin touched).
Task: FAKE camera generated source - pacing and bitrate (row 82c F-82c-1, request line 01:17:07Z).
Present before: `realtime` in `GENERATED_INPUT` (camera-helper-args.ts:42). Added: `-b:v 4M -maxrate 4M -bufsize 4M` to `ENCODER.X264` (camera-helper-args.ts:45).
Measured (generated picture only): 8.03 s -> 240 frames, 4,221,074 bytes.
Checks run once: unit area 18 files / 291 passed (sandbox EPERM on first run, re-run unsandboxed), static.test.ts 49 passed, tsc exit 0, oxlint exit 0.

Files changed:
- apps/core-server/src/capture/adapters/local/camera-helper-args.ts
- apps/core-server/src/capture/adapters/local/__tests__/camera-helper.test.ts
- apps/core-server/src/capture/fence/__tests__/fence.test.ts
Docs: docs/2026-10-07_dems_real_capture_sealing/implementation/106_integration_pass_e1.md, this file; claim line appended to delegation_progress/file_claims.md.

Flag for the controller: ENCODER.X264 is shared with the opt-in DEVICE+X264 fallback list, which now also carries the 4 Mbit/s cap. The default real-camera list (VIDEOTOOLBOX) is unchanged.
