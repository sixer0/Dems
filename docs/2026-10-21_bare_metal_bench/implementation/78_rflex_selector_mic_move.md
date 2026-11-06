---
row: 132 (R2.1 NEW)
agent: coder-execution
date: 2026-10-22
status: complete (with one in-row fix; see Verdict)
check: T-13 (masterplan/01_specs_rflex_audio.md §10; masterplan/01_specs_rflex.md §5.1; risk R-2; D16 Q96-02 (B))
---

# Row 132 - T-13: op 78 moves a MIC from PRIMARY to STANDBY in one edit

## Case added
`apps/core-server/src/modules/capture-config/__tests__/capture-config.db.test.ts:987-1012`, block "task 4 row 29 ... / 2. operation 78 `unassign` ...".
Precondition: seed clone with STANDBY stored NULL (PRIMARY = MIC-01, STANDBY empty), SIMULATED Core, TECHNICIAN on the web console.
Edit: `POST /api/v1/capture/config {unassign: ['PRIMARY'], mics: [{inputId: 'MIC-01', deviceId: 'MIC-01', role: 'STANDBY'}]}`.
Asserts: 200 + contract-valid answer; lines = STANDBY MIC-01, VIDEO-01 CAM-01, VIDEO-02 CAM-02; moved line transport `USB`; stored row mic_primary_id NULL, mic_standby_id MIC-01; exactly 2 new CAPTURE_CONFIG_CHANGED rows, both scope MIC (one = cleared PRIMARY row with `from`, one with `to: MIC-01`); stored slices = committed state.

## Verdict (first run, quoted)
Op 78 does NOT refuse the move. All T-13 criteria passed on the first run (200, PRIMARY empty, STANDBY = MIC-01, 2 x MIC rows). The extra stored = committed assertion failed:
```
AssertionError: expected { …(30) } to strictly equal { …(30) }
          "role": "STANDBY",
-         "transport": "UNKNOWN",     (committed engine state)
+         "transport": "USB",         (stored row read back)
 ❯ capture-config.db.test.ts:1008:41
 Tests  1 failed | 36 skipped (37)
```
Cause: `withRegisteredTransports` (routes.ts) judged "held" on the selector BEFORE the clear, so MIC-01 (held on PRIMARY) got no registry transport; the action (unassign first, `packages/shared/src/sim/capture-config.ts:29`) then made it a new STANDBY line with `UNKNOWN`. A restart would publish `USB` (stored/committed divergence).

## Fix (routes.ts only, R-2 shape: unassign first, as the camera rule)
`apps/core-server/src/modules/capture-config/routes.ts:399-408`: roles named in `unassign` are dropped from "held" before transports are filled. No contract, service, or simulator change.

## Test results (after fix, one run each)
| Command | Result |
|---|---|
| `lockf db-runner.lock npm run test:db -w @dems/core-server -- src/modules/capture-config/__tests__/capture-config.db.test.ts --maxWorkers=2` | Test Files 1 passed (1); Tests 37 passed (37) |
| `npm test -w @dems/core-server -- src/modules/capture-config/__tests__/routes.test.ts --maxWorkers=2` | Test Files 1 passed (1); Tests 28 passed (28) |
| `lockf heavy-host.lock npm run typecheck -w @dems/core-server` | FAIL, 0 errors in capture-config; 2 errors only in `src/modules/capture-inputs/audio-cards/service.ts` (TS2741 `releasedDeviceId` missing, line 532) - another row in flight, not owned, not touched |

## Notes
- The project PostgreSQL was stopped; started with `npm run pg:start` under the db-runner lock (left running).
- routes.test.ts not edited (no change needed).
