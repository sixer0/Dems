# Row 50 — coder-execution-local (phase C, M2-W8) — FINAL

## Status: COMPLETE (shared side)
OpenAPI versions bumped, `openapi.json` regenerated, category-B shared pins re-pinned. Sole lockfile writer honoured.

## Gates (fresh, quotable)
- regen `lockf -k .locks/npm.lock timeout 300 node --import tsx packages/shared/scripts/gen-openapi.ts` -> `wrote ... openapi.json (all (committed): 89 operations, 2 security schemes, version 0.3.0; offline: 23 operations, 0 security schemes, version 0.2.0; 1132176 bytes)`
- determinism `... gen-openapi.ts --check` -> `is up to date (...)` exit **0**
- recount: paths 85 / ops 89 / GET 34 / POST 55 / components 152 / version 0.3.0; offline 23 ops / 0.2.0
- versions: `OPENAPI_CORE_SERVER_DOCUMENT_VERSION` 0.2.1->**0.3.0**, `OPENAPI_DOCUMENT_VERSION` 0.1.0->**0.2.0**, `OPENAPI_VERSION` stays 3.1.0
- typecheck `timeout 300 npx tsc --noEmit -p packages/shared </dev/null` -> **exit 0**
- lint `npm run lint -w @dems/shared </dev/null` -> **exit 0**
- suite `timeout 1800 env CI=true npm run test -w @dems/shared -- --maxWorkers=2 </dev/null` -> **Tests 3 failed / 1864 passed (1867); Test Files 1 failed / 71 passed (72)**

## Stale-pin greps
- off-by-one (88/54/22): `toHaveLength(88)`/`88 operations` 0 hits; `toHaveLength(54)`/`54 POST` 0 hits; every `22` is the correct simulated-op count (offline asserts 23).
- section-C X-PIN-1 over the 5 category-B shared files (75/28/dbc-2/'0.1.0'/'0.2.1'/schema v1): **0 hits**.

## Remaining red (ONLY the three designated tests)
- `openapi.test.ts` #16/#17/#18 = simulator parity (SIM_API_ROUTES 9 vs 22; op-44 device-health v2 shape). They read `sim/api.ts`, NOT `openapi.json`; regen cannot clear them. Owned by **row 51a** (post-row-48 sim re-run). `src/sim/**` is off-limits here.
- `api-openapi-scope.test.ts` fully green (was 12 red). Delta vs row-48 baseline = +15 pass / -15 fail = the 15 drift tests this row greens.

## Lockfile discipline
All three generator steps (`--check`, write, recheck) ran inside `/usr/bin/lockf -k .locks/npm.lock`. No npm install. Released promptly. No collision with concurrent row 49.

## Boundary + gap routed (board to main)
- Did NOT touch apps/**, src/sim/**, mock-core/release, controller trackers. Edited only openapi.ts version literals/comments (C3 §8-owned), gen-openapi.ts comment, openapi.json, and the 5 category-B shared test files.
- App-side category-B pins still at 75/27/48 (core-server contract.test.ts/rbac-matrix.test.ts; core-web live-api-reference-document/page) — outside my apps/** boundary; needs an app-side owner (row 50b / M2 gate).
- Two stale comments in row-48-owned src/api (core-api.ts:52, index.ts:27) left untouched per ownership.
- R-8 ops 90-92 NOT pinned (row 113/M6, CF-11).

## Files
Artifact: implementation/16_m2_openapi_pins.md (Tier 3). Full changed-file list in artifact §6.
Did NOT edit status_tasks.md or delegation_progress_report.md.
