# coder-execution — row 131 (ONVIF WS-Discovery behind `CameraAdapter.discover()`)

- **Status:** complete
- **Date:** 2026-10-09
- **Note:** `implementation/62_r9_onvif_discovery.md`
- **Commit:** none (D94)

## Files created

- `apps/core-server/src/capture/adapters/camera/ws-discovery.ts`
- `apps/core-server/src/capture/adapters/camera/probe-answer.ts`
- `apps/core-server/src/capture/adapters/camera/discovery-collector.ts`
- `apps/core-server/src/capture/adapters/camera/onvif-discovery.ts`
- `apps/core-server/src/capture/adapters/camera/xml2js.d.ts`
- `apps/core-server/src/capture/adapters/camera/__tests__/support.ts`
- `apps/core-server/src/capture/adapters/camera/__tests__/probe-answer.test.ts`
- `apps/core-server/src/capture/adapters/camera/__tests__/discovery-collector.test.ts`
- `apps/core-server/src/capture/adapters/camera/__tests__/ws-discovery.test.ts`
- `apps/core-server/src/capture/adapters/camera/__tests__/discovery-recording.test.ts`
- `apps/core-server/src/capture/adapters/camera/__tests__/lan-probe.ts` (run by hand, not by the test runner)
- `docs/2026-10-07_dems_real_capture_sealing/implementation/62_r9_onvif_discovery.md`
- this file

## Files changed

| File | Change |
|---|---|
| `apps/core-server/package.json` | `onvif` 0.8.3, `xml2js` 0.6.2 (exact) |
| `package-lock.json` | +58 lines, 5 entries (sole lockfile writer of the wave; under `.locks/npm.lock`) |
| `THIRD_PARTY_NOTICES.md` | one section appended at the end (Edit tool): `onvif`, `xml2js`, `sax`, `xmlbuilder` |
| `apps/core-server/src/capture/adapters/camera/onvif-rtsp.ts` | header comment only (where the search lives) |
| `apps/core-server/src/capture/adapters/__tests__/static.test.ts` | five file names added to the pinned list (own line) |
| `apps/core-server/src/capture/__tests__/static.test.ts` | G-R2 socket rule exempts the one discovery file for the datagram module; new blocks G-R9 and G-R13 |
| `apps/core-server/test/static/network.test.ts` | per-file exemption map for the datagram module and its positive control |
| `delegation_progress/file_requests.md` | two lines appended (exports for row 132; note on the two guard files) |

Not in git (git-ignored): `.cache/npm-row131/` (private npm cache), `.data/discovery/row131-lan-run-1.json`, `.data/discovery/row131-lan-run-2.json` (identifying results of the real-LAN check).

## Results

- Camera tests: 4 files, 68 tests passed. `M4-SEC-DISC-3`: 2 runs, both passed.
- `M4-DISC-LAN-1`: run 1 `FOUND (25)`, run 2 `FOUND (25)`; sockets 0 / 1 / 0; 0 TCP connections; counts only in tool output.
- Typecheck and lint: 0 findings in this row's files.
- Red tests seen that are not this row's: static guards on `adapters/local/**` (rows 134 / 135), `modules/capture-config` (row 66), `src/transcription` (row 78); `tsc` on `src/capture/__tests__/records.test.ts:27` (capture-protocol change in flight).

## Install

First `npm install` failed with "Your cache folder contains root-owned files" (`~/.npm`); no sudo was used; one retry with `--cache .cache/npm-row131` succeeded. Fixing `~/.npm` needs `sudo chown -R 501:20 ~/.npm` and is the user's.

## Decisions and open points for the controller

1. Stub devices N > 1 answer from one loopback address and are listed as conflicting (SEC35-28 (1)); only N = 1 gives a testable candidate. Rows 137 / 142 may need a stub change (row 60).
2. Two guard files outside the row's paths were edited (logged in `file_requests.md`).
3. The adapter is exported by no barrel yet: request filed; row 132 needs it.
4. `masterplan/02_plan.md` and `status_tasks.md` not edited (D94).
5. Real network: 25 ONVIF responders answered. Any connection step is the user's (D76 (4)).
