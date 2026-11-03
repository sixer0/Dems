# Row 143 (new, controller): factory scan refuses a choice on an absent interface again (review F1)

Date: 2026-10-22, host .73. Source: `verification/07_rflex_code_review.md` finding F1 (BLOCKING, owner row 105).

## Defect
Since row 105, `networkFactsOf` answers a context with `cameraSubnet: null` (not null) when the stored interface is not on the host. `factory-scan/service.ts` checked only `before === null`, so op 103 no longer refused: it took the spacing gate, wrote a `CAMERA_FACTORY_SCANNED` `COMPLETE` audit row with `addressCount: 0`, and answered 422 for a typed address instead of `409 COMMISSIONING_NOT_CONFIGURED` - against Q96-04 a. The existing tests stubbed `facts: () => null`, which the real reader no longer returns.

## Change
- `apps/core-server/src/modules/capture-config/factory-scan/service.ts`: `if (before === null || before.cameraSubnet === null) throw invalidState(R.COMMISSIONING_NOT_CONFIGURED);` (the form of `camera-network/service.ts:621`), with a two-line comment.
- `factory-scan/__tests__/service.test.ts`: helper `absentInterfaceFacts` built with the PRODUCT `networkFactsOf`; three refusal rows (no address; typed address; fake-ONVIF stub, 0 requests).

## Evidence
- Before the service change: `Tests 3 failed | 76 passed (79)` - exactly the three new rows.
- After: `vitest --project unit src/modules/capture-config/` -> `Test Files 13 passed (13)`, `Tests 368 passed (368)`; `vitest --project db` factory-scan + network + camera-network -> `Tests 37 passed (37)`; `npm run typecheck -w @dems/core-server` rc 0 (NODE_OPTIONS=--max-old-space-size=6144; the default heap aborted).
- Delta re-check (D32 a): the change is the remedy the row-118 reviewer named; rows 116/117 are not affected (no guard, posture or requirement text changes).
