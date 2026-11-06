# Row 129 (R2.1) - AU-A1 `RELEASED` in both audit change lists

Status: complete. Tier 3.

## Changes
| File | Change |
|---|---|
| packages/shared/src/api/capture-audio-cards.ts:94-99 | `CaptureAudioInputChange` gains `RELEASED: 'RELEASED'` (4 values); doc comment: audit-only, equal to `CAPTURE_AUDIO_INPUT_CHANGES` |
| packages/shared/src/api/capture-audio-cards.ts:320 | op-99 audit paragraph (bundle M): "A release (`release: true`) writes two rows for the moved microphone: `change: RELEASED` with its old input number, then `change: REENABLED` with the new one." AU-A2 sentence not used (spec §2.4 table). Op-99 answer enum untouched (inline 3 values, :211) |
| apps/core-server/src/core/audit-details.ts:206-207 | `CAPTURE_AUDIO_INPUT_CHANGES` = `['REGISTERED','CARD_CHANGED','REENABLED','RELEASED']` |
| apps/core-server/src/modules/capture-inputs/audio-cards/service.ts:458 | `MESSAGE_OF_CHANGE.RELEASED` = `Microphone ${deviceId} released from its old input` (only entry added) |
| apps/core-server/src/core/__tests__/writers.test.ts | import `CAPTURE_AUDIO_INPUT_CHANGES`, `CaptureAudioInputChange`; accepted RELEASED example row (:355-356); pin: core list = 4 values = shared list, each value accepted by the writer (end of row-19 test) |
| packages/shared/test/api-capture-discovery.test.ts:789-790 | audit list pin 4 values; answer enum pin (3 values) and `RELEASED` refusal unchanged |
| apps/core-server/src/db/fixtures/__tests__/audit-details.test.ts | no change needed (no pin on the change list); run green |

## Audit reader check (spec §9.1)
`detailRulesOf` / `CAPTURE_AUDIO_INPUT_CHANGES` / `SERVER_AUDIT_DETAIL_RULES` are referenced only by write paths (`core/audit-writer.ts:123,220`, `db/fixtures/operations.ts`, `capture-discovery/connect/service.ts`); grep for `details.change` / `details?.['change']` outside tests: 0 hits. No reader checks `change` on read, so pre-R-FLEX code reading a `RELEASED` row is not refused (grep evidence; not run against an old build).

## Test results (verbatim counts)
- `npm test -w @dems/core-server -- src/core/__tests__/writers.test.ts --maxWorkers=2`: Test Files 1 passed (1), Tests 161 passed (161)
- `npm test -w @dems/core-server -- src/db/fixtures/__tests__/audit-details.test.ts --maxWorkers=2`: Test Files 1 passed (1), Tests 35 passed (35) (unit project, not test:db)
- `npx vitest run test/api-capture-discovery.test.ts` (packages/shared): Test Files 1 passed (1), Tests 39 passed (39)
- `npm run typecheck -w @dems/shared`: exit 0
- `npm run typecheck -w @dems/core-server` (heavy-host lock): 2 errors, both pre-existing and attributed to row 131 in file_requests.md: `service.ts(299,3)` TS2741 `boundTo` missing; `service.ts(533,5)` TS2741 `releasedDeviceId` missing (was :532, +1 line from the new entry). No new error.
- Side effect: `packages/shared/test/openapi.test.ts` "no drift" red (1 failed / 20 passed) because the op-99 description changed; openapi.json is row 100's (request filed, blocking no).

## Notes for row 131
`service.ts:491` `let change: CaptureAudioInputChange` now admits `RELEASED`; the answer at :533 still narrows to 3 values. Row 131 writes the RELEASED audit row with `MESSAGE_OF_CHANGE.RELEASED`.
