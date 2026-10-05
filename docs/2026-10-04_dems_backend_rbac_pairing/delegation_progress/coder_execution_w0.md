# coder-execution — row W0 (web consolidation round) — progress

Started 2026-10-05 23:42 WIB. Status: **complete** (00:42). Item 7 partly stopped for a decision (burnt-in video line); item 3 needs no code (not possible as a one-line change). Report: `gateway_check/08a_w0_web_consolidation.md`.

| Item | Status | Notes |
|---|---|---|
| 1 StrictMode double-send | done 23:57 | helper `lib/effect-start.ts` `deferEffectStart`; 3 effect sites on it (session-new resume — a real Simulated double-run, red test 2 calls → green 1; evidence detail hand-off; evidence wizard source check); static guard + 10 tests in `test/live-strict-mode-starts.test.tsx`; typecheck 0; 14 files / 142 tests green |
| 2 One pending-control hook | done 00:08 | `lib/pending-control.ts` (`usePendingControl`: run/settle/busy/pending/key/ref; `usePendingReveal`); callers: session-new, session-monitor ×3 files, evidence ×2, dashboard devices-panel, storage manage-drawer, devices audio-input-card + device-menu; removed (pre-images in .cache/rollback/W0): session-monitor/use-pending-press.ts, evidence/use-pending-action.ts; session-new/use-pending-control.ts = one-line re-export; 32 files / 351 tests green + 19 hook tests; DN-4: A9 keeps DV-2 |
| 3 Busy mark on kit Button | done 00:10 (no code) | not possible as a one-line change: no Button in components/ui; @heroui/react Button → RAC filterDOMProps allowlist has no aria-busy; containers left; probe test pins it |
| 4 dbfs-meter resetClip | done ~00:12 | `resetClip` through settle + presenter first, own branch generic toast + one sink record; useSimActions → useCoreActions (same object); Live test 5/5 (`test/live-meter-clip-reset.test.tsx`) |
| 5 network-time log | done ~00:14 | `network-time/log.ts` → webErrorSink, fixed sentence + errorName + correlation ID; 3 tests (`test/live-w0-page-logs.test.tsx`); 18 files / 183 tests green |
| 6 F70-1 Identify label | done ~00:17 | `device-drawer.tsx` logDetail: IDENTIFY → `common.deviceMenu.identify` (both modes) — THE one deliberate Simulated change; 2 tests (`test/live-w0-device-log.test.tsx`) |
| 7 F70-4 camera overlay DEMO in Live | partial 00:21 | component-owned words fixed in Live only: procedural OSD `CAM-0n \| VIDEO-0n \| BUNDLED DEMO`, default accessible name "Camera n · Bundled demo picture", Devices tile name "Camera n, bundled demo picture"; 6 tests (`test/live-w0-camera-words.test.tsx`). STOPPED part: the "LIVE \| DEMO" line is burnt into the bundled MP4 frames (frozen asset, P13) → controller decision |
| 8 F70-5 report helper | done 00:25 | `createPageReporter(prefix)` in `dashboard/report.ts`; `devices/report.ts` binds 'dev' (no copy); callers unchanged; 4 tests; dashboard+devices 10 files / 124 tests green |
| 9 D158 two simulated labels | done 00:27 | metadata-tab Live: label "Core record", JSON `record: CORE` + Core note, data-package core; preview-card Live: `evidence.live.noPackage`; signature value left (DC-4); 3 tests; evidence 8 files / 66 tests green |

Baseline: protected file hashes in `.cache/w0/protected.pre.sha256` / `.githash`
(dashboard.test.tsx 1ab07579, storage-page.test.tsx 71f6f033).

## Final gate (00:38–00:40, `gateway_check/assets/08a_w0_final_gate.log`)

- `npm run test -w @dems/core-web -- --maxWorkers=2`: 78 files / 1,012 tests, exit 0 (floor 71 / 958).
- typecheck and lint of `@dems/core-web`: exit 0, exit 0 (no warning).
- `npm run test -w @dems/shared -- --maxWorkers=2`: 68 / 1,814, exit 0; its typecheck and lint exit 0.
- Six protected test files: sha256 OK; dashboard.test.tsx 1ab07579, storage-page.test.tsx 71f6f033.
- Mutation run (in memory, M15): 48 / 48 detected (H12 after one added test); tree files identical before/after.
- Removed with pre-images: `features/session-monitor/use-pending-press.ts`, `features/evidence/use-pending-action.ts`.

## Follow-up W0b (decision D165), 00:49–00:53 — complete

- `createPageReporter` moved to `apps/core-web/src/lib/page-report.ts`; `features/dashboard/report.ts` and
  `features/devices/report.ts` import it and bind their prefixes ('dash', 'dev'); callers unchanged; nothing
  deleted. W0's own `live-w0-page-logs.test.tsx` now names `lib/page-report.ts` as the one copy.
- typecheck 0, lint 0; dashboard + devices tests 11 files / 126 tests exit 0; whole web suite 78 / 1,012 exit 0
  (load 9.11 at start); protected files sha256 OK; mutants R01b–R03b 3 / 3 detected.
- Pre-images: `.cache/rollback/W0b/`. Assets: `gateway_check/assets/08a_w0b_gate.log`, `08a_w0b_changes.diff.txt`.
- `gateway_check/08a_w0_web_consolidation.md`: §15 paragraph amended (names `@/lib/page-report`), DC-7 marked
  done, §17 "Follow-up: the reporter in `lib/` (decision D165)" appended.

## Follow-up 2 W0c (decision D172), 01:52–02:00 — complete (one red not W0's)

- Harness `runtime/testing/live-harness.ts:369-374`: default answers for `getRoleMatrix` (200 `seeded`),
  `listPairedDevices` (200 `registry`), `getPairingCodeStatus` (200 `none`), each 401 `notSignedIn` when signed out.
- `test/live-pending-control.test.tsx:421-433`: the caller list is a minimum (`expect.arrayContaining`); import check kept.
- live-shell-admin 40/40; live-pending-control 20/20; live-runtime-* (harness's own) 7 files / 121; whole suite
  93 files / 1,238 exit 0 (no red file); live-devices-drawer 13/13; lint exit 0 (1 warning in W76's file).
- typecheck exit 2: ONE error in `test/live-system-demo.test.tsx:408` (W76, untracked, written 01:46) — not W0's.
- Pre-images `.cache/rollback/W0c/`; assets `08a_w0c_gate.log`, `08a_w0c_changes.diff.txt`; report §18 appended.
