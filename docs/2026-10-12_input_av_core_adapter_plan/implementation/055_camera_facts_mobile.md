---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 55
package: M3 / WP-10b
date: 2026-10-13
agent: coder-execution
status: needs-review
tier: T3
---

# Row 55 - mobile client: the camera detail states the slice's facts

## Statement

The one camera format display of `apps/mobile/src/features/devices` - the Format fact of the camera Overview - prints the picture, rate and codec the `cameras` slice states, and reads picture and codec without a rate when the slice's `fps` is null. It held no literal fallback before and holds none now. Simulated mode reads `1080p • 25 fps • H.264` as before.

Status is needs-review for two things outside the row's area: the mobile typecheck fails with one error that is not this row's, and the live screen's chip (`session-live/live-feed.tsx:216`) still prints an empty rate.

## Change set

| File | Change |
|---|---|
| `apps/mobile/src/features/devices/device-detail.tsx` | `CameraOverview`, the Format fact (:547-556): `cameraFormatCodecNoRate` for a null rate, else `cameraFormatCodec`; the fact carries `testID: 'device-fact-format'` (the identifier the same fact already has in the GENERATED branch, :532) |
| `apps/mobile/src/features/devices/devices-screen.test.tsx` | One new case, one import name (`act`) |

The strings are row 54's two keys in `packages/shared/src/i18n/en/common.ts`; no mobile string added. Searched `features/devices` for other format displays (`resolution`, `codec`, `cameraFormat`): none. The GENERATED branch (a Core in its own capture: the selector line's profile code or "Not reported") is unchanged.

## Evidence

| Check | Command | Result line |
|---|---|---|
| The devices suite of the touched file (one run) | `npx jest src/features/devices/devices-screen.test.tsx --maxWorkers=2` in `apps/mobile` | `Tests:       16 passed, 16 total` |
| The row's check "the device tests state HEVC for an HEVC slice" | same run, case "row 55: the camera detail states HEVC for an HEVC slice, with the stated rate, and with no rate when the slice states none" | passed: `1080p • 25 fps • H.264` (simulator), `2160p • 30 fps • HEVC`, `1080p • HEVC` with no text matching `fps` or `H.264` on screen |
| Typecheck (first run failed, second run to read the list) | `npm run typecheck` (`tsc --noEmit`) in `apps/mobile` | exit 2, ONE error: `src/features/devices/sim-adapter.ts(241,27): error TS2345 ... Property 'role' is missing in type '{ readonly inputId: string; }' but required in type 'RoleMicLine'` |

## The typecheck error is not this row's

`sim-adapter.ts:240-242` is unchanged in the working tree; `channelOf` hands its lines to the shared `channelOfMicLine`, whose parameter type changed in `packages/shared` (in flight: `sim/audio.ts`, `sim/selector-in-force.ts`, row 164). No line of the two files this row edited is named. Request written; not edited here (selector material, another row's change in motion).

## Driver decisions (for the controller to confirm)

| # | Decision | Reason |
|---|---|---|
| D-1 | `session-live/live-feed.tsx:216` NOT edited | Outside `features/devices`. For a null rate it prints `1080p •  fps`. One request line, marked blocking before the M-gate device session |
| D-2 | `testID: 'device-fact-format'` added to the Format fact | The test reads the fact by the identifier the other branch already uses; the two branches never render together |
| D-3 | `sim-adapter.ts:241` not repaired | See above |

## Double, and what stays unproven

The double is the test simulator's store with its `cameras` entries overwritten. No Metro, no emulator, no device session: the screen is judged at the M-gate. A real H.265 camera on the tablet is hardware check `9A/H-17`.

## Requirement identifiers

P12-F08 (mobile reader in `features/devices`) - closed. Open under the same identifier: the live screen's chip (request).

---
*Generated: 2026-10-13*
