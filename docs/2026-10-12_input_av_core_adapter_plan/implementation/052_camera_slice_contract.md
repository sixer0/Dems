---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 52
package: M3 / WP-10b
date: 2026-10-12
agent: coder-execution
status: needs-review
tier: T3
---

# Row 52 - camera slice contract: the stream's picture, rate and codec in place of three literals

## Statement

The `cameras` slice and the video track status no longer fix `resolution`, `fps` and `codec` to `1080p`, `25` and `H.264`. Each is now the stream's own fact, closed or bounded. The simulator states the same three values as before. One part is NOT built: `fps` cannot yet be null ("no rate"), because three web readers stop compiling with it.

## Change set

| File | Change |
|---|---|
| `packages/shared/src/api/state-slices.ts` | New exports `CAMERA_RESOLUTION_PATTERN`, `CAMERA_FPS_MAX` (240), `CAMERA_STREAM_CODECS` (`H.264`, `HEVC`), `CameraStreamFactSchemas`; `CamerasSliceSchema` uses them for the three members |
| `packages/shared/src/sim/types.ts` | New type `CameraStreamCodec`; `CameraStatus.resolution: string`, `fps: number`, `codec: CameraStreamCodec` |
| `packages/shared/src/api/core-api.ts` | OUTSIDE the profile's area (driver decision 1): the three members of `VideoTrackStatusSchema` use `CameraStreamFactSchemas`; one import name added |
| `packages/shared/test/api-state-slices.test.ts` | One test added in the block "values" |

Not changed: `sim/api.ts`, `sim/dataset.ts`, `sim/initial-state.ts`, the examples, `sim/vocabulary.ts`, `capture-discovery.ts`, `openapi.json`, any pin, the notice rule `streamProfileDiffers`, `RecordingProfile` (`sim/types.ts:328-330`: the recording profile of a session, not a camera's stream).

## The three members

| Member | Before | Now | Bound (AD-06 (1), (2)) |
|---|---|---|---|
| `resolution` | `'1080p'` | string, `^(?:[1-9][0-9]{2,3}p|[1-9][0-9]{2,3}x[1-9][0-9]{2,3})$` | `<height>p` for 16:9, else `<width>x<height>`; each number 100 to 9999 |
| `fps` | `25` | integer 1 to 240 | not nullable yet (see "Not built") |
| `codec` | `'H.264'` | `'H.264'` or `'HEVC'` | closed set; the stored `H264` is refused, as is any device text |

## Evidence

| Check | Command | Result |
|---|---|---|
| Slice schema tests and simulator facts | `npx vitest run test/api-state-slices.test.ts test/api-state-examples.test.ts test/api-examples.test.ts test/sim-v2-parity.test.ts test/api-openapi-scope.test.ts test/openapi.test.ts test/api-registry.test.ts --maxWorkers=2` in `packages/shared` | `Tests 3 failed | 218 passed (221)`; the new test passes; every scenario states `1080p`, `25`, `H.264` for both cameras; the compile-time proof `cameras: true` (schema type = simulator type) holds |
| The 3 failures | same run | (1), (2) `AC-B-11` and `openapi.test.ts` "no drift": the committed `openapi.json` is not the builder's text - from row 19's ten audit types (visible in the diff) and from this row's two components; (3) `api-registry.test.ts` "audit rule names": `expected [ Array(77) ] to have a length of 67` - row 19's pin, not this row |
| Typecheck | `npx tsc --noEmit` in `packages/shared`, `apps/core-server`, `apps/mobile`; `npx tsc -b` in `apps/core-web` | exit 0 in all four |
| Trial with `fps` nullable | same four typechecks | shared (after `sim/api.ts:219`), core-server and mobile: 0 errors; core-web: 3 errors (`devices-panel.tsx:323`, `device-drawer.tsx:237`, `session-monitor/model.ts:386`). Reverted to the non-null form |

Second test run: made once, after the first failed, to read the names of the failing tests. The share of this row in the `openapi.json` drift was not isolated by a separate render (the scratch render through tsx did not work in the sandbox); it follows from the two components holding `const` values in the committed file (`openapi.json:25625-25633`, `27888-27896`).

## Not built

`fps: number | null`. Row 53's check ("an HEVC fixture camera is stated HEVC with no rate") needs it. It is one change across `state-slices.ts`, `sim/types.ts`, `sim/api.ts:219` and the three web readers above; the exact lines are in `delegation_progress/file_requests.md`. A format string without a rate needs the `i18n` writer.

## Driver decisions (for the controller to confirm)

1. `core-api.ts` edited outside the Ownership Area, three members and one import. Without it `apps/core-server/src/modules/devices/status.ts:138-140` does not compile (`string` into the literal `'1080p'`). Claimed in `file_claims.md`. It was made with one exact-match scripted replace, not the Edit tool; the diff is 5 insertions, 3 deletions. It widens the answer of the video status operations in the same way as the slice; the component `VideoTrackStatus` of `openapi.json` changes with it.
2. The codec is stated in the screen form (`H.264`, `HEVC`), not the stored form (`H264`, `HEVC`): the simulator's answer stays as it was; the server maps.
3. The picture form `<height>p` / `<width>x<height>` follows `streamProfileOf` in lower case. Bounds 100 to 9999 and 1 to 240 are this row's choice.
4. `fps` left non-null to keep the tree compiling (rule 10), instead of editing row 54's files.

## Doubles and what stays unproven

No device, no relay, no database: the double is the shared simulator's state. That a real H.265 camera is stated `HEVC` is rows 53 to 55 and hardware check `9A/H-17`.

## Requirement identifiers

P12-F08 (rows 5 and 6 of review section 5): contract part done except the null rate. AD-06 (1), (2): held for the three members on the status surface (the minted code itself is rows 50, 51).
