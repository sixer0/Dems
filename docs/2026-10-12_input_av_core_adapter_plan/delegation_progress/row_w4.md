# Row W4 - the web and tablet readers of a camera's facts on a live Core

Status: needs-review. Agent W4 (coder-execution, track D). Date: 2026-10-13. Record: `implementation/w4_live_readers.md`.

## Items

| # | Item | Result |
|---|---|---|
| 1 | R-01 bitrate | done by the mode (never drawn on a Core in real capture); nullable member requested |
| 2 | R-02 tablet device detail | done (`cameraDetailFactsOf`: `STATED`) |
| 3 | `CameraPreview` and the readers that do not reach a real Core (R-03 to R-06, F3-07) | done on the web; the tablet's feed chip left with a request for a ruling (pin of D222 (2)) |
| 4 | S-01, the state-stream slice | done on the readers' side: the selector line's stored statement is read, never the slice; shared function requested |
| 5 | F3-06 for the operator | done on the web (kind `NETWORK_NOT_CONFIGURED`); sentence in the web's tree, move requested |
| 6 | Stale facts after a camera fault | done: the fault stands in the place of the facts |

## Files

Code: `apps/core-web/src/features/devices/stream-facts.ts` (new), `source-state.ts`, `camera-tile.tsx`, `camera-preview.tsx`, `device-drawer.tsx`, `camera-connect.ts`, `camera-connect-dialog.tsx`; `features/session-monitor/model.ts`, `inputs-panel.tsx`; `features/session-new/devices-step.tsx`; `i18n-web.ts`. `apps/mobile/src/features/devices/stream-facts.ts` (new), `devices-model.ts`, `device-detail.tsx`; `features/session-live/live-feed.tsx`.

Tests: web `features/devices/__tests__/source-state.test.tsx`, `camera-no-preview.test.tsx`, `camera-connect.test.tsx`, `camera-connect-canary.test.tsx`; tablet `features/devices/real-capture-one-rule.test.tsx`.

Docs: `implementation/w4_live_readers.md`, this file, two lines in `file_claims.md`, four lines in `file_requests.md`.

## Pins moved (a simulator value shown in LIVE mode)

1. web `source-state.test.tsx`: `measuredFiguresShown({ realCapture: true, recording: true })` `bitrate: true` -> `false`.
2. tablet `real-capture-one-rule.test.tsx`: the camera half of "blocks that keep model values carry the chip" (chip and "PoE CAM 1" for a production camera).

## Checks

- Web final targeted run: `Test Files 59 passed (59)`, `Tests 772 passed (772)`.
- Tablet: `Test Suites: 36 passed`, `Tests: 409 passed`; `Test Suites: 38 passed`, `Tests: 436 passed`.
- Typecheck: core-web `tsc -b` exit 0; mobile `tsc --noEmit` exit 0. Lint: `oxlint` exit 0; `eslint .` exit 0.
- No browser check and no emulator check was made.

## Requests (`file_requests.md`, `row W4`)

1. R1b: `bitrateMbps` nullable (slice and video track status). Not blocking.
2. R1b: one shared function for the stored profile code's stream facts. Not blocking.
3. R1b: move the sentence pair of F3-06 to the shared i18n. Not blocking.
4. Controller: a ruling on a format beside a recording of the Core's own capture (tablet pin of D222 (2) against the brief's item 3). Blocking for the tablet's feed.

## Driver decisions

D-1 the clients decode the selector line's code; D-2 the tablet's feed chip left, the web's Monitor changed; D-3 the fault replaces the facts in fact rows and hides the format on the tile; D-4 the format stands on the tile's state line.
