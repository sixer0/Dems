# coder-execution — row 140 (R-11: development sources in sessions, client surfaces)

Status: **needs-review**. Note: `implementation/71_r11_local_sources_in_sessions.md`.
No commit, no migration, no emulator / adb / browser / build. No camera or microphone opened by any run.

## Files

Server (`apps/core-server/`):
- EDITED `src/capture/fence/index.ts`, `src/capture/fence/sources.ts`
- EDITED `src/modules/devices/status.ts`, `src/modules/devices/index.ts`, `src/modules/devices/__tests__/status.test.ts`
- EDITED `src/capture/adapters/local/camera-helper-args.ts` (ONE literal: the generated camera input is paced), `src/capture/fence/__tests__/fence.test.ts` (its pin)
- EDITED `src/capture/adapters/local/__tests__/e2e/camera_run_numbers.py`, `.../e2e/local_camera_e2e.py`, `src/capture/adapters/local/__tests__/camera-run-numbers.test.ts`
- NEW `src/capture/fence/__tests__/open-sources.test.ts`, `.../development-session.db.test.ts`, `.../e2e/development-session-e2e.db.test.ts`
- NEW `src/modules/devices/__tests__/source-class.db.test.ts` (D131 pin, decision D156)

Web (`apps/core-web/src/features/devices/`):
- NEW `registered-devices-model.ts`, `registered-devices.tsx`, `registered-device-drawer.tsx`, `__tests__/registered-devices.test.tsx`
- EDITED `index.tsx`, `devices.css` (appended block)

Mobile (`apps/mobile/src/features/devices/`):
- NEW `registered-devices-model.ts`, `registered-device-rows.tsx`, `registered-device-detail.tsx`, `registered-devices-model.test.ts`, `registered-devices.test.tsx`
- EDITED `devices-screen.tsx`, `device-detail.tsx`, `devices-live-static.test.ts` (file list by delta)

Shared: `packages/shared/src/i18n/en/common.ts` (ONE appended block `developmentRoster`).

Docs: `implementation/71_r11_local_sources_in_sessions.md`, this file, seven lines in `file_requests.md`, five in `file_claims.md`.

Not edited: `mic-helper-args.ts`, the DEVICE input of the camera and `fixedGrid`; `capture-session/**`; session-new / session-live / session-monitor; shared api / sim; the worker.

## Requests filed (`file_requests.md`)

| Time | To | What | State |
|--|--|--|--|
| 16:28:30Z | row 71c | start the microphone helpers after the worker's acknowledgement | LANDED 16:49:46Z |
| 16:28:30Z | pass D4 | `sourceOpen` on a capture device + its producer (fence: `openSources()`, `onOpenSourcesChanged()`) | open |
| 16:28:30Z | controller (`src/capture/index.ts`) | raise / clear the advisory alert `MIC_RATE_AT_LIMIT` from the notice sink | open |
| 16:28:30Z | row 139 / controller | `captureNotices(app).provideProbe(probeOfAdapters(captureFenceControl(app).probeAdapters()))` | open |
| 16:37:10Z | pass D4 (`db/mapping/rows.ts`) | built-in test sources of a development Core carry `adapter: FAKE`, `sourceClass: DEVELOPMENT` | open; two `it.fails` cases go red when it lands (remove `.fails`) |
| 17:17:40Z | row 71c | start the microphone helpers together (the standby starts 2 s late: 96,000 samples missing) | open |
| 17:17:40Z | rows 82b / 86 / test runner | NOTICE: the generated camera was unpaced until this row's fix | — |

## For the user — the attended run (NOT run; `M5-LOCAL-E2E-1` with the real devices)

Terminal app, repository root, you present at the Mac (not from the Claude app):

    DEMS_LOCAL_SESSION_ATTENDED=1 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock /usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts

- **Opens:** this Mac's camera AND this Mac's microphone (one product session: camera 1 = the Mac's camera, primary microphone = the Mac's microphone; slot 2 = generated test picture and tone). macOS asks the Terminal for each permission the first time; only you answer it.
- **For how long:** 10 s of recording, plus the time until the first fragment is durable (at most 40 s) and the stop — under one minute of camera and microphone in the worst case, about 15 s normally. The green / orange indicators go off at the stop.
- **Recorded where:** only below `.data/test-row61-row140local-<pid>-1/media/` — the sealed (encrypted) package of that one session; the plaintext camera files are removed by the seal. Nothing is played, shown or sent anywhere; the terminal and `.data/test-row61-row140local-<pid>-1/row140-result.json` hold numbers, ids and codes only.
- **A camera that cannot be opened** (permission not given, in use, not found) ends the run with `verdict: "blocked: user action"` in that file — not a failure.
- **Expect:** `verdict: "pass"`, `sources: ["CAM-03 LOCAL_DEVICE", "CAM-02 FAKE"]`; the microphone warnings seen are printed, none is judged (known state D128: this microphone delivered 8/9 of its declared rate, so a rate or disconnect warning is possible — the case "no microphone fault" belongs to the generated run only and is skipped here).
- **Delete it:** `rm -rf .data/test-row61-row140local-*` (yours to run; no agent deletes it).
- The clap check `M5-LOCAL-CLAP-1` is not part of this command.
