---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 54
package: M3 / WP-10b
date: 2026-10-13
agent: coder-execution
status: complete
tier: T3
---

# Row 54 - web console: the camera tile and the live overlay state the slice's facts

## Statement

The Devices camera tile and the Session Monitor live overlay print the picture, rate and codec the `cameras` slice states. Neither file holds a value of its own any more: the three fallbacks `'1080p'`, `25` and `'H.264'` are gone from both. A stream that states no rate (`fps` null) reads picture and codec without a rate. A track the slice does not carry states no format. Simulated mode reads as before (`1080p • 25 fps`, `1080p • 25 fps • H.264`).

## Change set

| File | Change |
|---|---|
| `apps/core-web/src/features/devices/camera-tile.tsx` | The three fallbacks (:52-53, :129 before) removed. `formatChip` (picture's chip) and `formatLine` (the Format row) are built from `camera` alone; null rate uses the two new keys; no camera: empty chip, no Format row |
| `apps/core-web/src/features/session-monitor/model.ts` | `FeedModel.resolution: string \| null`, `fps: number \| null`, `codec: <the slice's codec type> \| null`; `selectFeed` passes the slice's values, `null` when there is no camera (the three `??` literals removed) |
| `apps/core-web/src/features/session-monitor/live-feed-panel.tsx` | ONLY the `formatLabel` statement: with rate, without rate, or `null` (no chip; `CameraFeed` draws the chip only for a non-empty label, `camera-feed.tsx:475`) |
| `packages/shared/src/i18n/en/common.ts` | Two keys beside the existing two: `common.devices.cameraFormatNoRate` = `{{resolution}}`, `common.devices.cameraFormatCodecNoRate` = `{{resolution}} • {{codec}}` |
| `apps/core-web/src/features/devices/__tests__/devices-page.test.tsx` | One new case (block "Camera tile: the format is the slice's statement") |
| `apps/core-web/src/features/session-monitor/__tests__/session-monitor.test.tsx` | Two new cases (overlay render; `selectFeed`), one import name |

All edits with the Edit tool. No dependency, no new component, no new element.

## What each screen states

| Slice | Tile chip | Tile Format row | Live overlay |
|---|---|---|---|
| `1080p`, 25, `H.264` (simulator) | `1080p • 25 fps` | `1080p • 25 fps • H.264` | `1080p • 25 fps • H.264` |
| `2160p`, 30, `HEVC` | `2160p • 30 fps` | `2160p • 30 fps • HEVC` | `2160p • 30 fps • HEVC` |
| `1080p`, null, `HEVC` | `1080p` | `1080p • HEVC` | `1080p • HEVC` |
| no camera for the track | none | none | none |

The tile's rule for a Core in real capture (no chip, no Format row; fix wave K, D222 (2)) is unchanged.

## Evidence

| Check | Command | Result line |
|---|---|---|
| Tile and overlay tests (one run) | `npx vitest run src/features/devices/__tests__/devices-page.test.tsx src/features/session-monitor/__tests__/session-monitor.test.tsx --maxWorkers=2` in `apps/core-web` | `Test Files  2 passed (2)` / `Tests  34 passed (34)` |
| The row's check "the tile test states HEVC for an HEVC slice" | same run, case "states HEVC for an HEVC slice, with the rate the slice states and with no rate when it states none" | passed: `Format 1080p • HEVC`, no `fps`, no `H.264` in the tile; second lens `2160p • 30 fps • HEVC` |
| "literal fallbacks in the two files: 0" | `grep -nE "'1080p'\|\?\? 25\|'H\.264'" camera-tile.tsx session-monitor/model.ts` | no line (exit 1) |
| Simulated mode unchanged | existing cases of both files (`1080p • 25 fps • H.264` at `devices-page.test.tsx:131`) and the new overlay case's first assertion | passed in the same run |
| Typecheck (once) | `npm run typecheck` (`tsc -b`) in `apps/core-web` | exit 0 |
| The i18n file's own test (one run) | `npx vitest run test/i18n.test.ts --maxWorkers=2` in `packages/shared` | `Tests  16 passed (16)` |

## Driver decisions (for the controller to confirm)

| # | Decision | Reason |
|---|---|---|
| D-1 | `live-feed-panel.tsx` edited (one statement) although the profile names two files | It is the only reader of `FeedModel`'s three members and the place the overlay's words are formed; with a null rate `t()` does not compile. Claimed before the edit |
| D-2 | Two keys, the rate-less form of each existing string, in `common.devices` | The brief's rule; no key-count pin exists in `i18n.test.ts` |
| D-3 | No camera for the track: nothing is stated (was `1080p • 25 fps • H.264`) | A format with no slice behind it is an invented one. Not reachable in the simulator (both cameras always exist) |
| D-4 | The three readers of integration pass I-1 and `session-new/devices-step.tsx:433` were NOT edited | Outside the row's files; two request lines |

## Double, and what stays unproven

The double is the shared simulator's store with its `cameras` entries overwritten in the test. That the Core states HEVC with a null rate in the slice is row 53; the screen with a real H.265 camera is the M-gate device session and hardware check `9A/H-17`. No browser session was run.

## Requirement identifiers

P12-F08 (web readers: tile and live overlay) - closed for these three files. Open under the same identifier: the two request lines.

---
*Generated: 2026-10-13*
