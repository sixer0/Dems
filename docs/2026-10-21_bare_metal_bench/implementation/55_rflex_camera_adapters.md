---
row: 103 (R2.1)
agent: coder-execution
date: 2026-10-22
status: complete (own scope green; core-server typecheck red only in row 131's audio-cards files)
---

# Row 103: camera adapters on the global destination rule (network spec 5.2, 4.4 U1-U3, U6)

## What changed (non-test: ordering code only)
| File | Change |
|---|---|
| apps/core-server/src/capture/adapters/camera/discovery-collector.ts:59-84 `selectInterfaces(table, sourceAddress?)` | Collects every eligible interface (DS-4 test unchanged), then places the one holding `sourceAddress` FIRST, others in table order, sliced to `DISCOVERY_MAX_INTERFACES` (NW-K1 = 4, unchanged). Absent / unheld source: table order (behaviour identical to before). No new exported name |
| apps/core-server/src/capture/adapters/camera/ws-discovery.ts:187-192 | Passes `unicast?.sourceAddress` to `selectInterfaces`; the U6 check (`sourceHeld`, NO_ELIGIBLE_INTERFACE) is unchanged and now holds by construction |
| Consumers U1-U3 (stored-address.ts, camera-watch.ts, onvif-relay.ts, onvif-session.ts, stream-probe.ts, onvif-network.ts) | Not touched |

## Tests
| File | Change |
|---|---|
| __tests__/stored-address-cases.ts:14-27, :63 | `HOST_FACTS` gains `interfaceSubnets` (eth1 192.168.50.1/24, eth0 10.20.0.5/24; RF-N7 heads-up of row 102). Lifted pins: `192.168.60.20` OUTSIDE_CAMERA_SUBNET -> NO_SOURCE_INTERFACE; `10.20.0.77` OTHER_INTERFACE_SUBNET removed from the refused table and exported as `ADMITTED_OFFICE_HOST` (test-local constant) |
| __tests__/stored-address.test.ts | New case "R-FLEX (RF-N1, row 103)": 10.20.0.77 admitted with source 10.20.0.5; control camera-subnet host keeps 192.168.50.1; facts without `interfaceSubnets` -> NOT_CONFIGURED |
| __tests__/discovery-collector.test.ts | New case: 5 eligible, source on 5th -> first, length 4; source on 2nd -> moved to front; unheld / internal source -> table order (controls) |
| __tests__/ws-discovery.test.ts | Row-96 `HOST_FACTS` gains `interfaceSubnets`. New AC-6 case: 5 eligible interfaces 10.0.1-5.10/24, typed 10.0.5.20 -> rule source 10.0.5.10; `selectInterfaces` probed = [10.0.5.10, 10.0.1.10, 10.0.2.10, 10.0.3.10] (length 4; control: table order omits it); product search NOT `NO_ELIGIBLE_INTERFACE` - outgoing interfaces asked in that order (spy on `setMulticastInterface`), host holds none so `SOCKET_ERROR`, 0 datagrams, 0 sockets left |
| camera-watch.test.ts, onvif-relay.test.ts | No edit needed: green once the shared cases file carried `interfaceSubnets` |

## Commands and results
- Before (baseline, sandbox off): `npx vitest run src/capture/adapters/camera/__tests__ --maxWorkers=2` -> `Tests 18 failed | ...` (stored-address 5, ws-discovery 5, onvif-relay 5, camera-watch 2, discovery-recording 1), all NOT_CONFIGURED from row 102 except discovery-recording (passed on later runs; not in my area, not edited).
- After: `npx vitest run src/capture/adapters/camera/__tests__ --maxWorkers=2` -> `Test Files 12 passed (12)`, `Tests 336 passed (336)`.
- `/usr/bin/lockf -k .data/locks/heavy-host.lock npm run typecheck -w @dems/core-server` -> errors only in `src/modules/capture-inputs/audio-cards/service.ts(299,533)` and `audio-cards/__tests__/service.test.ts(135)` (row 131, known red); 0 in camera files.
- Note: the camera tests bind loopback sockets; inside the Seatbelt sandbox they fail `listen EPERM 127.0.0.1` - run with the sandbox off.

## Deviations / decisions
- D-103-1: spec section 8 lists B1/B2 (`facts.ts`) under row 103; the brief's Ownership excludes `facts.ts`, so B1/B2 were NOT done here (controller to route).
- D-103-2: ordering expressed as an optional second parameter of the existing `selectInterfaces`, named after the rule's own member `sourceAddress` (no new register name).
- D-103-3: bench interface count (spec 5.2 hypothesis "camera port plus Wi-Fi is two") not measured in this row (no host access in scope); fixtures use 5.
