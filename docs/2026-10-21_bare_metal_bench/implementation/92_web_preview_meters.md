---
task_id: 2026-10-21_bare_metal_bench
task_slug: bare_metal_bench
row: 92W (part d of the D53 plan: web console live preview and idle meters)
date: 2026-10-23
agent: coder-execution
source_plan: controller plan zany-hugging-hippo.md (D53); decisions D51, D53
status: needs-review
---

# Implementation Report: web console live camera preview and idle-meter lease

Status is `needs-review`. The code is written, typechecked, linted and tested against the contract-checked fake transport. It was NOT run in a real browser against the bench Core. A review is recommended (scope below).

## Executed Steps
| Step | Task | Status | Notes |
|---|---|---|---|
| 1 | Read reports 90/91, the client call layer, the call sites, the test bed | done | operations are called as `useWebLive().client.call(...)` (the pattern of `adopted-camera-test.ts`); nothing changed in `packages/shared` |
| 2 | Baseline of the three test folders on the unchanged tree | done | `Test Files 1 failed / 32 passed (33)`, `Tests 5 failed / 393 passed (398)`; all 5 reds are in `camera-no-preview.test.tsx` (the old aria sentence) |
| 3 | `camera-live-preview.ts` (pure rules) and `LivePreview` in `camera-preview.tsx` | done | |
| 4 | `livePreview` on the Devices & Inputs tiles, the Session New previews and the Session Monitor feed (plus full screen) | done | Dashboard and the Monitor's input thumbs are untouched (they keep the tile) |
| 5 | `idle-meter-lease.ts` and the caption in `audio-input-card.tsx` | done | |
| 6 | Default test-bed answers for ops 112/113 | done | `runtime/testing/live-harness.ts` |
| 7 | Update the old pin, add tests | done | |
| 8 | Lint, typecheck, test runs | done | see Test Results |

## Changes Made
| File | Change Type | Description |
|---|---|---|
| apps/core-web/src/features/devices/camera-live-preview.ts | add | `previewRetryDelayMs` (starts at 2 s, doubles, caps at 30 s); `previewPathOf` (uses only the `/preview/cps_...` path of the answered URL); `previewRefusalOf` (429 -> LIMIT after max(retry-after, backoff); 409 `cause: AUTH_REFUSED` -> 5 min; other 409 -> 60 s; anything else -> backoff); `isSessionStarting` (CREATE/PRECHECK/ARMED); `isLivePreviewDevice` (CAMERA with sourceClass PRODUCTION) |
| apps/core-web/src/features/devices/camera-preview.tsx | modify | `CameraPreview` takes `livePreview?: boolean`. New `LivePreview`: token from op 112 inside `deferEffectStart`; `<img key={path} src={path}>`; states CONNECTING/LIVE/PAUSED/UNAVAILABLE/LIMIT with the `devices.preview.*` keys; aria from `devices.preview.aria`; on error, a new token after the backoff; on unmount a ref-callback cleanup removes `src`; REC badge and actions kept; `dimmed` overlay. Header doc updated (OD-12 reversed) |
| apps/core-web/src/features/devices/camera-tile.tsx | modify | `livePreview` on the tile |
| apps/core-web/src/features/session-new/devices-step.tsx | modify | `livePreview` on `PreviewTile` |
| apps/core-web/src/features/session-monitor/live-feed-panel.tsx | modify | `livePreview={!fullscreen}` on the feed and `livePreview` on the full-screen view, so only one viewer at a time |
| apps/core-web/src/features/devices/idle-meter-lease.ts | add | `createIdleMeterLease(call, timers?, report?)`: one call when the first holder arrives, renewal every `IDLE_METER_RENEW_MS` = 10 s, ref-counted holders, states OFF/PENDING/HELD/UNAVAILABLE, one record per run of refusals. `leaseOf(live)` keeps one lease per Live source. `useDocumentVisible`. `useIdleMeterLease()` holds only with Live + `useRealCaptureCore` + no active session + page visible, and takes the hold inside `deferEffectStart` |
| apps/core-web/src/features/devices/audio-input-card.tsx | modify | calls `useIdleMeterLease()`. Caption `audio-idle-<channel>` under the meter body: `devices.audio.idleLevel` when HELD, `idleUnavailable` when refused |
| apps/core-web/src/runtime/testing/live-harness.ts | modify (test-only) | default answers: `holdIdleMeters` 200 example `held` and `createCameraPreviewSession` 201 example `opened` (401 when signed out). Without them every Live Devices test would hit NO_ANSWER_SCRIPTED |
| apps/core-web/src/features/devices/__tests__/camera-no-preview.test.tsx | modify | aria pin changed from 'This build shows no live preview.' to 'The live preview is not open.'; header note added (its sources are DEVELOPMENT, so they keep the tile) |
| apps/core-web/src/features/devices/__tests__/camera-live-preview.test.tsx | add | 13 tests |
| apps/core-web/src/features/devices/__tests__/idle-meter-lease.test.tsx | add | 9 tests |

`capture-selector.test.tsx` was not red (it asserts against the i18n value itself), so it was left unchanged.

## Test Results
| Test Type | Command (in apps/core-web, node 26.12.1 on PATH, under `flock .data/locks/heavy-host.lock`) | Result | Notes |
|---|---|---|---|
| baseline (unchanged tree) | `npx vitest run src/features/devices/__tests__ src/features/session-new/__tests__ src/features/session-monitor/__tests__ --maxWorkers=2` | `Test Files 1 failed / 32 passed (33)`, `Tests 5 failed / 393 passed (398)` | the 5 reds are the camera-no-preview aria pin |
| new files | `npx vitest run src/features/devices/__tests__/camera-live-preview.test.tsx` and `.../idle-meter-lease.test.tsx` | `Tests 13 passed (13)` and `Tests 9 passed (9)` | |
| folders + statics | `npx vitest run src/features/devices/__tests__ src/features/session-new/__tests__ src/features/session-monitor/__tests__ src/test/live-strict-mode-starts.test.tsx src/test/live-runtime-static.test.tsx src/test/dev-proxy-blanking.test.ts --maxWorkers=2` | `Test Files 38 passed (38)`, `Tests 444 passed (444)` | final run |
| wider | `npx vitest run src/features/dashboard src/test src/components/media --maxWorkers=2` | `Test Files 3 failed / 86 passed (89)`, `Tests 7 failed / 1390 passed (1397)` | the 7 reds are not from this row, see Persistent Issues |
| typecheck | `npm run typecheck` (tsc -b) | exit 0, 0 `error TS` | |
| lint | `npx oxlint src/features/devices src/runtime/testing src/features/session-new src/features/session-monitor` | `Found 0 warnings and 0 errors.` | |

## Verification
- Token issue: one request per mount with `params {id: 'CAM-01'}`; `src` is the path only (`/preview/cps_000...`); CONNECTING -> LIVE on `load`; aria reads 'Live preview of <track> · <device>. <state>'. Test: camera-live-preview.test.tsx "issues ONE token...".
- Backoff: 2 s, then 4 s, back to the start after a `load`. Test: "a failed picture..." (fake timers).
- Refusals: on 429 PREVIEW_LIMIT the limit text shows and the next token comes only after the 5 s retry-after. On 409 AUTH_REFUSED the tile says "not available", with no token at 61 s and one at 5 min. Tests: the two refusal tests.
- Unmount removes `src`. Test: "unmount ends the stream".
- Simulated mode: no op 112 request, no live preview, the demo feed shows. Test: "Simulated mode...". Development sources and the Dashboard keep "No preview". Tests: the first test, "Dashboard...", and camera-no-preview.test.tsx.
- Session New in ARMED: both previews are `PAUSED` with `pausedForRecording`. Monitor while recording: the feed is the live preview with `rec-indicator`, and the input thumbs keep the tile.
- Lease with fake timers: one call at once and a renewal at exactly 10 s; a second holder adds no call; release is idempotent; renewals stop after the last release; a refusal gives UNAVAILABLE with one record; a late answer after release is ignored.
- Lease on the page: ONE call for two cards and the caption on both; hidden page -> caption gone, visible again -> new call; 409 -> `idleUnavailable`; active session or a simulated-capture Core -> no call.
- StrictMode rule: `src/test/live-strict-mode-starts.test.tsx` passes. It was red until both effects used `deferEffectStart`.

## Persistent Issues
| Issue | Attempts | Root Cause | Current Status | Blocking? |
|---|---|---|---|---|
| 6 reds in `src/test/live-api-reference-document.test.tsx` and `live-api-reference-page.test.tsx` ('expected 113 to be 111', '69 to be 67', '99' vs '97') | 0 | agent b's two new operations (ops 112/113). These pins count registry operations; the files are not this row's | open, for the controller or the API-reference owner | no for this row |
| 1 red in `src/test/box-check.test.ts` (CW-01: one more break-anywhere stylesheet rule than listed) | 0 | the test reads stylesheets only. This row touched no CSS; `devices.css` was modified by another row (the LCD work) | open | no |
| Not run in a browser against the bench | - | no browser session in this brief | unproven: MJPEG `<img>` load/error behaviour, the Vite `/preview` proxy with the cookie, pause/resume during a real start | yes, for the live test |

## Issues & Decisions
| Step | Issue / Decision | Resolution |
|---|---|---|
| 3 | The brief named the switch `live`, but `CameraFeedProps.live` already exists (the demo loop's decode switch, set by the Monitor and the thumbnails) | new prop `livePreview`. Reusing `live` would have turned the preview on in the Dashboard and the inputs thumbs, which already pass `live={false}` or `live` |
| 3 | The Core answers an absolute loopback URL (`http://127.0.0.1:4420/preview/cps_...`, pinned by the schema) | only its path is used, against the console's own origin (as `mediaPathOf` does for `/media`). A URL of any other form counts as unavailable |
| 3 | Which tracks get a preview | only a track whose device is `kind CAMERA` and `sourceClass PRODUCTION`, because the Core refuses anything else with 409. Development sources keep the "No preview" tile, so no pointless request loop |
| 3 | Paused state | shown whenever the session state is CREATE/PRECHECK/ARMED. The Core yields the camera then, but its viewers stay open, so the picture may just freeze instead of erroring. A picture error in these states still gets a new token after the backoff |
| 3 | Retry after a plain 409 PREVIEW_NOT_AVAILABLE | 60 s (the brief said "retry later" without a value). AUTH_REFUSED waits the Core's 5 min window |
| 3 | The Core can end a stream without an `error` event (UNAVAILABLE after 3 restarts), which leaves the last frame on screen | the client cannot detect this without a state route (report 90: `PreviewManager.states()` has no route) |
| 3 | `snapshot()` of the live preview | `null`, as the tile returned before (the Monitor's snapshot path still gets "no image") |
| 5 | Hook location | `useIdleMeterLease` lives in `idle-meter-lease.ts`, because a `.tsx` that exports a hook breaks the components-only export convention. The card calls it |
| 5 | Two cards would mean two renewal loops | one lease per Live source, with the cards as ref-counted holders: one call per 10 s |
| 5 | Lease gate uses `useRealCaptureCore` | a Live console on a simulated-capture Core asks nothing (its meters already move from simulated telemetry) |
| 3/5 | Error logging | the console has no client-log endpoint (decisions D3/D4/D41(g), `lib/page-report.ts`). Refusals and throws go to the page's own log via `reportDevicesError` at `warn`, once per run of failures, never with the URL or token. No toast for background polling, since it would repeat on every retry |
| 6 | Test bed | default answers for ops 112/113 added to the shared Live harness (test-only) |

## Next Steps
- Controller: decide on the API-reference pins (113 operations). Not this row.
- Review recommended: `camera-preview.tsx` (LivePreview effects, timers, token path handling) and `idle-meter-lease.ts`.
- Bench: open Devices & Inputs in a browser through the Vite proxy and check the MJPEG picture. Start a session and watch PAUSED, then the resume. Check the idle caption and the moving meters with the HANMUS card.
