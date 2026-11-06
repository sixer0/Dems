# Integration pass I-1 (track D) - short record

Status: needs-review (two driver decisions to confirm; all checks green). Full record: `implementation/i01_integration_pass.md`.

## Done (items of the fixed list)
1. Ten `common.auditType` labels - `packages/shared/src/i18n/en/common.ts:437-447`. English only: no Indonesian resource exists in the repository (D-1).
2. Count pin 67 to 77 - `packages/shared/test/api-capture-discovery.test.ts:106,110`.
3. `AUDIO_CARDS` appended to `CaptureDiscoveryScope` - `packages/shared/src/api/capture-discovery.ts:75`; additive, order pin `writers.test.ts:484` holds.
4. `fps` nullable - `state-slices.ts:533-539`, `sim/types.ts:600`, `sim/api.ts:220`, test `api-state-slices.test.ts:774`; web readers `devices-panel.tsx:324`, `device-drawer.tsx:238`, `session-monitor/model.ts:377`, `inputs-panel.tsx:80`. Simulator still states 25. No mobile reader named by the typecheck.
5. Barrel exports - `apps/core-server/src/capture/adapters/index.ts:26,31,32,76,77`. No export-list pin exists.
6. `CAPTURE_START_MESSAGE_INVALID` - `errors.ts:31,54`, `credential.ts:226`, `credential.test.ts:248`. No refusal-list pin exists.
7. Comment wording - `adapters/types.ts:104`, `capture-discovery/store.ts:64`, `connect/service.ts:79`.
8. `openapi.json` regenerated once, last (`node --import tsx scripts/gen-openapi.ts`; 97 operations, 1409112 bytes).

## Checks
- Typecheck in the five workspaces: exit 0 each.
- Shared: 11 files, 328 tests passed.
- Core server unit: 11 files passed; `onvif-session.test.ts` failed in the sandbox (loopback bind refused), passed 27 of 27 on the second run with the sandbox off for that command.
- Core web: 4 files, 58 tests passed. Mobile: 4 of 4 passed. oxlint: exit 0.

## Requests closed in `file_requests.md`
Lines 1, 3, 4, 8, 10, 12, 13, 17, 18, 19, 20. (The file itself was not edited.)

## Open, for other rows
- Row 54: `apps/core-web/src/features/devices/camera-tile.tsx:53` and `session-monitor/model.ts:455` fall back to 25 for a null rate; a format string without a rate.
- Row 55: mobile `live-feed.tsx:216`, `device-detail.tsx:550` print an empty rate for null.
- Row 19 or 63: comment at `apps/core-server/src/core/audit-details.ts:187` is out of date (wording only).
- Lines 2, 5, 6, 7, 11, 14, 15, 16 of `file_requests.md` were not part of this pass.

## Driver decisions
D-1 English only. D-2 a null rate shows each screen's existing absent form (picture and codec are left out with it). D-3 the refusal text. D-4 `core-api.ts` claimed, not edited.
