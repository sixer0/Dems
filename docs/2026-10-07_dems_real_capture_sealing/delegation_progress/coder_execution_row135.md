# coder-execution - row 135 (local microphone source helper, R-11)

Status: complete (code and automated tests); `M4-LOCAL-MIC-1` is a user-attended step, documented in `implementation/66_r11_local_mic_helper.md`.

## Files created (all new)
Production, `apps/core-server/src/capture/adapters/local/`: `mic-helper-args.ts`, `pipe-files.ts`, `mic-pipe.ts`, `mic-helper.ts`, `mic-adapter.ts`.
Tests, `.../local/__tests__/`: `mic-helper-args.test.ts`, `mic-pipe.test.ts`, `mic-helper.test.ts`, `mic-helper.generated.test.ts` (real FFmpeg, unsandboxed, heavy-host lock), `mic-static.test.ts`, support `mic-support.ts`, `mic-stream-check.ts`; attended script `e2e/local-mic-capture.ts`.
Docs: `implementation/66_r11_local_mic_helper.md`, this file. Appended 3 lines to `delegation_progress/file_requests.md`.
Outside the repo tree of the row: `.data/helpers/ffmpeg` (git-ignored copy of the host FFmpeg 9.0.2 for the program-rule check); two empty `.data/run/capture/SES-ATTENDED-*` directories.

## Files changed that existed before
None. Nothing under `apps/capture-worker`, no shared file, no lockfile, no pin edited.

## Requests filed
Static pins for the `local/` folder (G-R2 fs allowlist `pipe-files.ts`; G-R8 and G-R2 for row 134's `process-door.ts`; adapters file list), and the microphone exports for row 134's `local/index.ts`.

## Not touched or not done
No microphone opened, no permission or settings tool used, no audio played or described. Worker read of the pipe not exercised (row 60 owns the worker). No commit.
