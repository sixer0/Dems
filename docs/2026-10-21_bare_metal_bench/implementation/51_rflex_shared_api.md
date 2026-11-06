---
task_id: 2026-10-21_bare_metal_bench
row: 99 (R2.1)
date: 2026-10-22
agent: coder-execution
status: complete
---

# Row 99: shared audio-card contract (R-FLEX)

Spec: `masterplan/01_specs_rflex.md` §5.3 with §2.4 corrections (bundle M); `masterplan/01_specs_rflex_api_ui.md` §2.1-2.2, §9. Names: register AU-L1, AU-B1, AU-B2, AU-R1 (no new name).

## Changes (all in `packages/shared/src/api/capture-audio-cards.ts`)

| Id | file:line | Change |
|---|---|---|
| AU-R1 | :114 | `CaptureAudioCardReason.AUDIO_CARD_ALREADY_BOUND` (409 INVALID_STATE, `details.deviceId` = holder), placed after `AUDIO_INPUT_NOT_REGISTRABLE` |
| AU-L1 | :163 | `CaptureAudioCardSchema.boundTo`: `HARDWARE_DEVICE_ID_PATTERN` or null, required; `usbPort` text gains "Informational: it is no longer compared" |
| AU-B1 | :192 | request `release`: `z.boolean().optional()` (absent = false; not `.default(false)`, so the output type and openapi keep it optional) |
| answer enum | :207 | `change` is an inline 3-value `z.enum([REGISTERED, CARD_CHANGED, REENABLED])`, not `z.enum(CaptureAudioInputChange)`; CARD_CHANGED text per api_ui §2.2 |
| AU-B2 | :211 | answer `releasedDeviceId`: MIC id or null, required |
| op 98 text | :284 | "...and, per card, the microphone that holds it (`boundTo`), or null" |
| op 99 :289 text | :314 | identity by serial, else USB id, on any port; one microphone per card; 409 AUDIO_CARD_ALREADY_BOUND unless `release: true`; bundle M answer = 200 REENABLED with `releasedDeviceId` = `deviceId` (spec 2.4, not row 92's 201) |
| op 99 refusals / :305 text | :315, :330 | ALREADY_BOUND named; "neither a serial number nor a port" -> "the Core could not find again (it states no USB id)" (RM-A5 per 88 D-A1.4) |
| op 99 200 text | :323 | names the release case |
| simulator | :359, :369 | `boundTo: null` on both test cards |
| examples | :414, :434, :445, :465 | listing `boundTo: 'MIC-03'`; request `release`; 200 `released`; `releasedDeviceId: null` on reenabled/registered; 409 `alreadyBound` with `deviceId` |

Not changed (no change needed): `packages/shared/src/api/index.ts` (already `export * from './capture-audio-cards'` at :50), `src/api/examples.ts`, `src/sim/capture-registry.ts`. Op 99 audit paragraph NOT changed: the `RELEASED` sentence belongs with AU-A1 (row 129).

## Tests

- `packages/shared/test/api-capture-discovery.test.ts`: reason list incl. AU-R1 and its text in description/409; `boundTo` shape+pattern+required; request 4 keys, `release` boolean/optional; answer 5 keys, `change.options` = 3 values, `RELEASED` refused, `releasedDeviceId` required/nullable; examples (`boundTo`, `release`, `released`, `alreadyBound` with deviceId); simulator `boundTo: null`.
- `packages/shared/test/sim-capture-discovery.test.ts`: listing `boundTo` [null, null]; `release: true|false` still 409 AUDIO_INPUT_NOT_REGISTRABLE; `release: 'true'` 422.

| Command | Result |
|---|---|
| `npm run typecheck -w @dems/shared` | exit 0 |
| `npx vitest run test/api-capture-discovery.test.ts test/sim-capture-discovery.test.ts --maxWorkers=2` (run 1, before a test-file type fix) | `Test Files 2 passed (2)`, `Tests 81 passed (81)` |
| same + `test/openapi.test.ts test/api-openapi-scope.test.ts` (run 2, after the fix) | `Test Files 2 failed \| 2 passed (4)`, `Tests 2 failed \| 124 passed (126)`; the 2 failures are the openapi byte pins (below) |

## Reported, not fixed

1. openapi drift (expected, row 100): `test/openapi.test.ts` "committed openapi/openapi.json matches the builder byte for byte" and `test/api-openapi-scope.test.ts` "AC-B-11 ... byte for byte" fail. `gen-openapi.ts --print` to $TMPDIR (openapi.json untouched): 104 diff lines; this row's part = boundTo / release / releasedDeviceId / examples / op 98-99 texts; the rest is text from capture-discovery.ts / capture-commissioning.ts (row 137). `release` is not in `required`.
2. Core server seam (rows 107-111, not mine): `apps/core-server/src/modules/capture-inputs/audio-cards/service.ts:298` `cardAnswer` returns `CaptureAudioCard` without `boundTo`, and the op-99 `CaptureAudioInputRegistration` answer (`:451`) lacks `releasedDeviceId`: core-server typecheck is expected red until the server row lands (not run here: heavy-host lock, not in this row's verification).
3. Web fixtures (row 101/web rows): `apps/core-web/src/features/devices/audio-cards.ts`, `audio-cards-panel.tsx`, `__tests__/audio-cards.test.tsx` may build cards/answers without the new required members.
