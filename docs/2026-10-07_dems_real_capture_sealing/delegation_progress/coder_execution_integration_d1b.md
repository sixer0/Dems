# coder-execution — integration pass D1b

Status: **needs-review** (item 5's target not met: 12 red blocks, 5 operations unrouted; item 13's fault key not built).
Note: `implementation/95_integration_pass_d1b.md`. No commit.

## Files

New:
- `packages/shared/test/integration-d1b.test.ts`
- `apps/core-server/src/db/reset/package-removal.ts`
- `apps/core-server/src/db/reset/__tests__/package-removal.test.ts`
- `apps/core-server/src/modules/capture-config/__tests__/integration-d1b.db.test.ts`

Edited, shared: `src/api/{devices,state-slices,core-api,sessions,evidence,examples,capture-discovery}.ts`;
`src/sim/{types,api,actions,audio,capture-config,capture-telemetry,capture-notices,evidence-actions,faults,health,react}.ts`;
`src/i18n/en/common.ts` (one key); `openapi/openapi.json` (generator);
`src/live/source/{live-sim,neutral-state}.ts` (forced by the meters type);
tests `api-realtime, audio, live-source-session, sim-capture-telemetry, sim-contract, sim-determinism, sim-platform-neutral, sim-store` (type-only),
`integration-c1, openapi, sim-api, api-registry, api-openapi-scope, api-stt-config, api-text-rule` (pins by delta).

Edited, core-server: `src/modules/capture-config/{routes,store}.ts` + `__tests__/{routes.test,integration-c1.db.test}.ts`;
`src/modules/devices/status.ts` + `__tests__/effects.db.test.ts`; `src/evidence-verify/index.ts` + `__tests__/core-verification.test.ts`;
`src/db/reset/{real-evidence,routine,index}.ts` + `__tests__/{static.test,m4-sec-reset.db.test}.ts`;
`src/modules/evidence/__tests__/routes.test.ts`; `test/acceptance/{contract,rbac-matrix}.test.ts`; `test/db/device-upsert.db.test.ts`.

Outside the declared area, each forced or ordered: `src/db/mapping/__tests__/to-rows.test.ts` (1 type assertion),
`src/engine/__tests__/capture-actions.db.test.ts` (type-only), and the wording pin of item 11 in
`apps/core-web/src/features/devices/__tests__/mic-input-name.test.tsx`, `apps/core-web/src/test/live-d2-client-seams.test.tsx`,
`apps/mobile/src/features/capture-selector/{mic-input-name.test.ts,development-source-rule.test.tsx}`.

## Checks for the test runner

| ID | Command | Lock | Expected |
|---|---|---|---|
| D1B-1 | `npm run test -w @dems/shared` | none | 88 files, 2348 passed |
| D1B-2 | `npx vitest run --root apps/core-server --project unit --maxWorkers=4` | none | no red in `modules/{devices,capture-config,evidence}`, `db/reset`, `evidence-verify`, `test/static`; `modules/sessions/__tests__/routes.test.ts` 2 red (request filed) |
| D1B-3 | `npx vitest run --root apps/core-server --project db test/acceptance/contract.test.ts` | `db-migrate` | 12 red / 25 passed, the list of the note; 5 unrouted operations |
| D1B-4 | `npx vitest run --root apps/core-server --project db test/acceptance/rbac-matrix.test.ts` | `db-migrate` | 1 red: AC-B-16 literal `{11,0,0}` vs `{13,0,2}` |
| D1B-5 | `npx vitest run --root apps/core-server --project db src/modules/capture-config src/modules/devices test/db/device-upsert.db.test.ts src/db/reset` | `db-migrate` | green |
| D1B-6 | whole db project once | `db-migrate` | a stored alert of severity INFO with `params.reason` of the three advisory codes survives the mapping (not run by the driver in a db test) |
| D1B-7 | `npm run test -w @dems/core-web`, `npx -w apps/mobile jest` | none | no red from "MIC 3", from the meters type or from `micInputOfChannel` |
