# Row 51a - coder-execution-local - Simulated v2 parity for the capture operations

Status: IN-SCOPE WORK COMPLETE (shared suite 1 red, both blockers outside this row's file set)
Artifact: implementation/61_m2_sim_capture_routes.md (Tier 3)
Started/finished: 2026-10-08 (single session)

## Files changed (only these three)

| File | Change |
|---|---|
| `packages/shared/src/sim/api.ts` | `SIM_API_ROUTES` 9 -> 22 with 13 real handlers (ops 76-87, 89); op 44/45/46 v2 shapes (`sourceDeviceId`, `streamState`, input-keyed `audio` + `role`, `activeInputId`); op 42 answer `status: 'QUEUED'` |
| `packages/shared/src/sim/types.ts` | Optional `EvidenceItem.transcriptRevisions` + `TranscriptRevisionRecord`/`Change`/`Signature` (no snapshot-version bump; v1 snapshots still resume) |
| `packages/shared/test/sim-api.test.ts` | Sim-owned fixture: re-pinned 3 stale v1 assertions (route count 9 -> 22, audio keyed by inputId+role+activeInputId, export receipt QUEUED) and added 8 proofs for the new routes |

Boundary kept: no `src/api/**`, no `openapi.json`, no lockfile, no `apps/**`, no trackers, no git write.

## Verification (quoted)

- `openapi.test.ts`: `Tests 1 failed | 20 passed (21)` - #16 (route table vs the registry's 22 simulated
  operations) and #18 (device-health + storage examples equal the idle simulator) now PASS; #17 red.
- `test/sim-api.test.ts`: `Test Files 1 passed (1) / Tests 20 passed (20)`.
- Full shared suite `timeout 1200 env CI=true npm run test -w @dems/shared -- --maxWorkers=2 --run </dev/null`:
  `Test Files 1 failed | 71 passed (72) / Tests 1 failed | 1874 passed (1875)` (row-50 baseline was
  3 failed / 1864 passed of 1867).
- `npx tsc --noEmit -p packages/shared` -> exit 0; `npm run lint -w @dems/shared` -> exit 0.

## Residual red and its owner

`openapi.test.ts` #17 has two blockers, neither inside `packages/shared/src/sim/**`:
1. :457 asserts the v1 export body `status: 'EXPORTED'` while the v2 registry pins `z.literal('QUEUED')`
   and the same test's own `validateCoreApiResponse` at :456 requires QUEUED (contradiction inside the test).
2. The coverage loop (:476-478) demands every offline-scope status of all 22 simulated ops from a flow
   that calls only the 9 baseline ops; six capture ops additionally document a `403` without the
   `services: ['dems-core-server']` marker although only the Core server sends it (Origin/revoked guards),
   so no simulator can ever produce it. Fix = extend the flow (13 routes) + mark those six 403s in
   `src/api/{devices,sessions,evidence}.ts` (row 48's files).

Evidence tables and the exact op lists are in artifact §5.

## Routed / flagged

- B1/B2 to the contract-test + registry lane (row 50 family or a dedicated row 51b).
- `SIM_SNAPSHOT_VERSION` bump unchanged (still the atomic cross-row edit row 51 routed).
- App lanes (52/54/67/68): any app reading `/audio/status`, `/video/status`, `/device/health` through
  `Sim.request` must adopt the v2 keys; no shared test depends on it today.
