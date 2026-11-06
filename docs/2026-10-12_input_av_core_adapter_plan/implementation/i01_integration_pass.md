---
task_id: 2026-10-12_input_av_core_adapter_plan
pass: I-1 (integration, track D; after rows 13, 19, 20, 38, 52, 95, 147)
date: 2026-10-12
agent: coder-execution
tier: T3
status: needs-review
---

# Integration pass I-1 - the requests of the first owner rows, applied

Status is `needs-review` for two driver decisions the controller has to confirm (D-1: no Indonesian
resource exists; D-2: what the three web readers show for a null rate) and for the two fallbacks of
row 54 listed under "Left for other rows". Every check of the pass is green.

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `SH` = `packages/shared`, `CS` = `apps/core-server/src`, `CW` = `apps/core-web/src`.
Source of the list: `delegation_progress/file_requests.md` lines 1, 3, 4, 8, 10, 12, 13, 17-20.

## Per item

| # | Item | What changed | File:line |
|---|---|---|---|
| 1 | Ten `common.auditType` labels | Ten labels appended after `CAPTURE_DEVICE_UNREACHABLE`, the texts of request line 17, under one comment line. English only (D-1). No pin moved: the three label tests compare against the vocabulary itself | `SH/src/i18n/en/common.ts:437-447` |
| 2 | Audit-type count 67 to 77 | Title and `toHaveLength` | `SH/test/api-capture-discovery.test.ts:106,110` |
| 3 | `AUDIO_CARDS` in `CaptureDiscoveryScope` | Member appended last; comment extended. Additive: the only schema over the scope is a literal of `CAMERA_NETWORK` (`capture-discovery.ts:199`), the other uses are single members; no exhaustive map exists (search of `apps`, `packages`). The Core's `CAPTURE_DISCOVERY_AUDIT_SCOPES` is a set of the shared values plus the literal, so its order pin `CS/core/__tests__/writers.test.ts:484` holds unchanged | `SH/src/api/capture-discovery.ts:71-75` |
| 4 | `fps` may be null | Schema `.nullable()` with its description; `CameraStatus.fps` and `ApiVideoTrack.fps` are `number \| null`; `VideoTrackStatusSchema` follows through `CameraStreamFactSchemas` (`core-api.ts` not edited). Two accepted cases added to row 52's test (`{ fps: null }`, HEVC with null). The simulator still states 25 (same test, all scenarios) | `SH/src/api/state-slices.ts:533-539`; `SH/src/sim/types.ts:596-600`; `SH/src/sim/api.ts:219-220`; `SH/test/api-state-slices.test.ts:774` |
| 4 | The three web readers | Dashboard tile: no format chip when the rate is null (`label` is `string \| null`). Device drawer: the format row reads the drawer's own "not reported" value (`common.platformNotReported.value`). Session monitor: `CameraTileModel.fps: number \| null`; its one reader, the inputs panel, shows no format line (the form it already has for a Core in real capture). No new string, no new element (D-2) | `CW/features/dashboard/devices-panel.tsx:323-324`; `CW/features/devices/device-drawer.tsx:237-238`; `CW/features/session-monitor/model.ts:376-377`; `CW/features/session-monitor/inputs-panel.tsx:80` |
| 4 | Mobile readers | None named by the typecheck (exit 0); not edited | - |
| 5 | Barrel exports | `startMessageBytes`, `type StartMessage`, `type StartMessagePlainMember` in the `./credential` block; `AUDIO_INPUT_BEYOND_CARD`, `AudioInputBeyondCardError` in the `./types` block. No test pins the barrel's export list (search: 0) | `CS/capture/adapters/index.ts:26,31,32,76,77` |
| 6 | Refusal code of a malformed start message | `START_MESSAGE_INVALID: 'CAPTURE_START_MESSAGE_INVALID'` with a fixed text naming no value; `startMessageBytes` refuses with it; the test expectation moved. The other uses of `CAPTURE_LOCATOR_INVALID` are unchanged (a forged sealed credential at `credential.ts:64` included). No test pins the refusal list (search: 0) | `CS/capture/adapters/errors.ts:30-31,54`; `CS/capture/adapters/credential.ts:226`; `CS/capture/adapters/__tests__/credential.test.ts:248` |
| 7 | Three comment lines | "usable H.264 profile codes" reads "usable profile codes" | `CS/capture/adapters/types.ts:104`; `CS/modules/capture-discovery/store.ts:64`; `CS/modules/capture-discovery/connect/service.ts:79` |
| 8 | `openapi.json` | Regenerated last with the repository's generator. Generator line: `wrote openapi/openapi.json (all (committed): 97 operations, 2 security schemes, version 0.3.0; offline: 31 operations, 0 security schemes, version 0.2.0; 1409112 bytes)`. Against HEAD: 72 insertions, 14 deletions (row 38's three texts, the ten audit types, the two camera components, the null rate). `AUDIO_CARDS` does not appear: no schema states it yet | `SH/openapi/openapi.json` |

All edits were made with the Edit tool after reading the lines; no scripted replace.

## Checks (one run each unless stated)

| Check | Command | Result line |
|---|---|---|
| Typecheck, 5 workspaces (before item 8; item 8 changes no type) | `npm run -s typecheck` in `packages/shared`, `apps/core-server`, `apps/mobile`, `apps/mock-core` (`tsc --noEmit`) and `apps/core-web` (`tsc -b`) | exit 0, no output, all five |
| Shared pins and contract | `npx vitest run --maxWorkers=2` on `test/i18n-vocabulary-sync`, `api-capture-discovery`, `api-state-slices`, `openapi`, `api-openapi-scope`, `api-registry`, `api-domain-operations`, `api-state-examples`, `api-examples`, `sim-capture-discovery`, `sim-v2-parity` | `Test Files 11 passed (11)`, `Tests 328 passed (328)` |
| Core server, unit | `npx vitest run --project unit --maxWorkers=2` on adapters `credential`, `static`, `fakes`, `registry`, `real`; `src/capture/__tests__/static`; `test/static/credentials`, `guard-family`; `src/core/__tests__/writers`; `capture-discovery/connect/__tests__/service`; `capture-discovery/__tests__/search`; `adapters/camera/__tests__/onvif-session` | `Test Files 1 failed, 11 passed (12)`, `Tests 24 failed, 281 passed (305)`: all 24 in `onvif-session.test.ts`, `no free port among 8561, 8560, 8559, 8557, 8555 on 127.0.0.1` (the command sandbox refuses a loopback bind) |
| The same file, second run, sandbox off for the bind (rule 8) | `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/camera/__tests__/onvif-session.test.ts` | `Test Files 1 passed (1)`, `Tests 27 passed (27)` |
| Core web | `npx vitest run --maxWorkers=2 src/lib/__tests__/event-words.test.ts src/features/dashboard/__tests__/dashboard.test.tsx src/features/devices/__tests__/devices-page.test.tsx src/features/session-monitor/__tests__/session-monitor.test.tsx` | `Test Files 4 passed (4)`, `Tests 58 passed (58)` |
| Mobile | `npx jest --maxWorkers=2 src/features/audit/audit-capture-labels.test.ts` | `Tests: 4 passed, 4 total` |
| Lint | `npx oxlint` on the twelve source files touched | exit 0 |

Generator note: `npm run openapi:gen` (the `tsx` command) stopped in the command sandbox before
writing anything (it could not open its pipe under `/tmp`); the same script was then run as
`node --import tsx scripts/gen-openapi.ts` from `packages/shared`, the form row 38 used. One write.

No database was opened, no full suite was run, nothing under `apps/input-av/` was read, no fence
file was edited, nothing was committed or staged.

## Remaining reds

None in the checks above. The three label tests, the count pin and the two OpenAPI tests that rows
19 and 52 left red are green.

## Left for other rows (not in the list, not edited)

| Where | What | Row |
|---|---|---|
| `CW/features/devices/camera-tile.tsx:53` and `CW/features/session-monitor/model.ts:455` | `camera?.fps ?? 25`: with a null rate these two state 25 fps. They compile; they are the fallbacks request line 15 gives to row 54. Until row 54 lands, the Devices camera tile and the live feed panel would state a rate the stream did not | 54 |
| `apps/mobile/src/features/session-live/live-feed.tsx:216`, `apps/mobile/src/features/devices/device-detail.tsx:550` | Compile with a null rate and would print the format words with an empty rate | 55 |
| `CS/core/audit-details.ts:187` | The comment still says the literal is stated "until the shared `CaptureDiscoveryScope` carries it"; the set makes the duplicate harmless. Row 19's file, wording only | 19 or 63 |
| `file_requests.md` lines 2, 5, 6, 7, 11, 14, 15, 16 | Not in the list of this pass (rows 47, static-adapters writer, i18n `NOT_H264` wording, 50, controller, 53, 54, 55) | as named |
| A format string without a rate | i18n and design; the web readers show the existing absent form until then | 54 |

## Driver decisions (for the controller to confirm)

| # | Decision | Reason |
|---|---|---|
| D-1 | The ten labels are English only | The repository has one language resource: `SH/src/i18n/` holds `en/` only, and `index.ts` states "the English UI resources". There is no Indonesian file to extend; adding a language is a new resource tree, outside the list |
| D-2 | For a null rate the three web readers show the absent form each screen already has (no chip; "not reported"; no line), which also leaves out the picture and codec in those places | Both format strings carry `{{fps}} fps`; a string without a rate is the `i18n` token and row 54's design. Nothing reaches this branch today: the simulator states 25 and the server states a number until row 53 |
| D-3 | The refusal text is "a start message must be a flat object of plain values and at most one stream access" | The rule of `errors.ts`: fixed text, no value of the caller |
| D-4 | `core-api.ts` was not edited although it is in the claim line | `VideoTrackStatusSchema.fps` is `CameraStreamFactSchemas.fps`; it became nullable with the slice |

## Double, and what stays unproven

Nothing runs against a device. That a real stream without a stated rate reaches the slice as null is
row 53; what the screens show for it is rows 54 and 55.

---
*Generated: 2026-10-12*
