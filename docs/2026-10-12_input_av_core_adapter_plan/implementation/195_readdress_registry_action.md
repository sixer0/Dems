---
task_slug: input_av_core_adapter_plan
row: 195
milestone: M8 / WP-12
date: 2026-10-13
agent: coder-execution (batch 9, agent R5)
tier: T3
status: complete
---

# Row 195 - the shared INTERNAL action that changes the address of one registered camera

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `SH` = `packages/shared`, `CS` = `apps/core-server`.

## 1. What was built

The INTERNAL action `readdressCaptureDevice`, the sibling of `registerCaptureDevice` (adoption) and `registerCaptureMicrophone` (row 185). The engine door of row 196 runs it inside the caller's unit; the seam it serves is `DeviceReaddresser` of `CS/src/modules/capture-discovery/readdress.ts`.

| File | Change |
|---|---|
| `SH/src/sim/capture-registry.ts` | `readdressCaptureDeviceTransition`, `READDRESS_CAPTURE_DEVICE_ACTION`; the two existing actions are untouched |
| `SH/src/sim/types.ts` | `ReaddressCaptureDeviceInput`; ONE member of `SimActions`, the last |
| `SH/src/sim/actions.ts` | one line: the action commits the transition |
| `SH/src/api/sim-actions.ts` | one entry: `{ operations: [], execution: INTERNAL }` |
| `SH/src/live/source/bindings.ts` | one binding, flow `LOCAL` (resolves without a request) |

Input: `{ deviceId: string, address: string }`. Nothing else of a device can be named.

| Rule | Held how |
|---|---|
| ONE device by id; its `host` becomes `address` AS THE CALLER GIVES IT (`host`, or `host:port`) | every other member of the device is equal; every other device and every other slice is the SAME object |
| An address the camera already holds | the SAME state object: the engine writes nothing |
| An unknown id, a microphone (built-in or registered), the switch | refused, `SimTransitionError` code INVALID_INPUT, state untouched |
| The address is a `host` in the form registration holds: 1 to 120 characters, no `/`, no `@`, no blank | refused the same way |
| No permission and no session check, NO audit row, no event, `captureConfig` untouched | as adoption; the caller (operation 100) holds the idle lock, the confirmation and the destination rule, and writes `CAPTURE_DEVICE_ADDRESS_CHANGED` in the same unit |

The destination rule is NOT asked here and cannot be (the shared package has no host facts): the action stores `127.0.0.1` when told to, and a test says so. "Never automatic" is the caller's rule: the action has no operation and no client binding that sends anything.

The simulator: its operation 100 does NOT run the action (`SH/src/sim/api.ts` not edited in this row); the seeded state is unchanged; no simulated answer moved.

## 2. Pins moved (by delta; no operation and no audit pin moved)

| Pin | File | From -> to |
|---|---|---|
| members of `SimActions` / bindings / table keys | `SH/test/live-source-bindings.test.ts`, `SH/test/api-domain-operations.test.ts`, `CS/src/engine/__tests__/hosted-actions.test.ts` | 50 -> 51 (three places; two describe titles follow) |
| executions `[hosted, server-native, not-available, internal]` | `SH/test/api-domain-operations.test.ts` | `[33, 9, 1, 7]` -> `[33, 9, 1, 8]`; the internal list gains the name (case title follows) |
| flow `local` | `SH/test/live-source-bindings.test.ts` | 8 -> 9 names (case title follows); the argument table gains the action |
| not-hosted names | `CS/src/engine/__tests__/hosted-actions.test.ts` | + `readdressCaptureDevice` (one more parametrised case) |

Unchanged: hosted 33; "42 actions reach 45 operations". Counts after the row: 100 operations, 78 audit types, 51 actions.

The profile names the Core's hosted-action pin as "a request to the controller"; this batch's brief makes this agent the single writer of every action count pin wherever it lives, so the pin was moved here (two lines).

## 3. Checks (2026-10-13, one run each)

| Check | Command | Result |
|---|---|---|
| The unit table and the pins | `npx vitest run --maxWorkers=2 test/sim-capture-discovery.test.ts test/live-source-bindings.test.ts test/api-domain-operations.test.ts` in `packages/shared` | `Test Files 3 passed (3)`, `Tests 184 passed (184)` |
| 0 other changed results in the simulator suites | `npx vitest run --maxWorkers=2 test/sim- test/live- test/api-closeout` | `Test Files 54 passed (54)`, `Tests 1439 passed (1439)` |
| The Core's pin | `npx vitest run --project unit --maxWorkers=2 src/engine/__tests__/hosted-actions.test.ts` in `apps/core-server` | `Test Files 1 passed (1)`, `Tests 23 passed (23)` |
| Typecheck | `npm run -s typecheck` in the six workspaces | exit 0, six of six |

Verification cell, case by case (`SH/test/sim-capture-discovery.test.ts`, describe "the INTERNAL action `readdressCaptureDevice`", 4 cases): "the address of the named device changes and no other member or device does" - case 1 (also: with a port, an address the rule would refuse, the same address, an adopted camera); "an unknown id and a microphone are refused" - case 2 (15 refused inputs, each on the transition and on the action, the state object unchanged; a registered USB microphone too); "a client call is refused as for `registerCaptureDevice`" - case 3 (INTERNAL, no operation, bound LOCAL, equal to the camera's entry); "0 other changed results in the simulator suites" - the second check; case 4: the simulated operation 100 leaves every address.

## 4. Driver decisions

| # | Decision | Why |
|---|---|---|
| DD-1 | A NEW member `readdressCaptureDevice`, not a wider `registerCaptureDevice` | the row asks for a sibling; registration refuses an id the registry holds, and that refusal stays |
| DD-2 | The same address gives the same state object, not a refusal | the server refuses `ADDRESS_UNCHANGED` before the door; an action that throws there would turn a no-op of the engine into a rolled-back unit |
| DD-3 | "Another device holds this address" is NOT checked here | the server checks it inside the unit (`ADDRESS_TAKEN`) with its own code; two refusals for one fact would differ in wording |
| DD-4 | The input has no `at` | the seam of row 97 hands `at`; no member of slice 30 holds a time, so the door of row 196 drops it |
| DD-5 | `online` and `streamState` are not touched | "nothing else of the device changed"; presence at the new address is the watch's finding |
| DD-6 | The stale header counts of `sim-actions.ts` and `bindings.ts` were not renumbered (row 185's DD-6) | the new entries say "one more again" |

## 5. The double, and what stays unproven

Pure functions and the in-memory simulator; no process, no port, no database. On a database (the device row and the slice together, the rollback): row 196. A real camera that moved: `9A/H-12`.

Existing files were edited with the Edit tool only.

---
*Generated: 2026-10-13*
