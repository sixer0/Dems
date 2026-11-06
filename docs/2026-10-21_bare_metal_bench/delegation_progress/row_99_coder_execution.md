# Row 99 (R2.1) coder-execution - shared audio-card contract

Status: complete. Report: implementation/51_rflex_shared_api.md.
Files written: packages/shared/src/api/capture-audio-cards.ts, packages/shared/test/api-capture-discovery.test.ts, packages/shared/test/sim-capture-discovery.test.ts. Claimed but unchanged: src/api/index.ts, src/api/examples.ts, src/sim/capture-registry.ts.
Tests: shared typecheck exit 0; api-capture-discovery + sim-capture-discovery 81/81 pass.
Red, expected, not fixed: openapi byte pins (2 tests) -> row 100 regenerates; core-server service.ts:298 / :451 lack boundTo / releasedDeviceId -> server row; web audio-card fixtures -> web row.
Deviations: op-99 release answer stated as bundle M (200 REENABLED, releasedDeviceId = deviceId) per spec 2.4, not api_ui 2.2's 201; `release` is `.optional()` not `.default(false)`; RELEASED audit sentence left to row 129.
