# coder-execution — integration pass C1

Status: **complete** (two items with a stated limit: 1 selector scope only, 2 seam only). Note: `implementation/92_integration_pass_c1.md`.

## Files

New
- `packages/shared/test/integration-c1.test.ts`
- `apps/core-server/src/modules/capture-config/__tests__/integration-c1.db.test.ts`
- `apps/core-server/src/modules/capture-discovery/session-expiry.ts`
- `apps/core-server/src/modules/capture-discovery/__tests__/session-expiry.test.ts`
- `apps/core-server/src/modules/capture-discovery/__tests__/session-expiry.db.test.ts`

Edited
- `packages/shared/src/api/{patterns.ts,state-slices.ts,devices.ts,capture-discovery.ts,core-api.ts}`
- `packages/shared/src/sim/{types.ts,audio.ts,capture-telemetry.ts,session-machine.ts,capture-config.ts,api.ts}`
- `packages/shared/openapi/openapi.json` (regenerated)
- `apps/core-server/src/modules/capture-config/{index.ts,slices.ts,routes.ts (comment)}`, `__tests__/slices.test.ts` (one message)
- `apps/core-server/src/modules/capture-discovery/{index.ts,store.ts,limits.ts}`, `__tests__/static.test.ts` (file list +1)
- `apps/core-server/src/modules/devices/status.ts` (one narrowing; outside the map, forced by the typecheck)
- `apps/core-server/test/static/imports.test.ts` (`EXPOSED` +1)
- `apps/core-server/test/acceptance/contract.test.ts` (one new block + imports)
- `delegation_progress/file_claims.md` (3 lines), `file_requests.md` (5 lines)

## Open for the controller

1. `fence.db.test.ts` 'CONTROL of the fixture' is red by design now (pass C2).
2. Op 78 cannot assign `MIC-03`; a recording start on it is refused by name (rows 71 / 140, clients).
3. `captureDurable` is carried by nothing yet (row 71; where it is stored).
4. `micsInInputOrder` kept (a closed test holds it).
5. Client typecheck errors seen are rows 87 / 141 (`V-15`) and 138 (`capture-notices-model.test.ts`).

## Checks for the test runner

All checks of this pass were run once after the last change; none is left over. Not run by this
pass (controller, once per commit): the whole core-server unit and db projects, core-web and mobile suites.
