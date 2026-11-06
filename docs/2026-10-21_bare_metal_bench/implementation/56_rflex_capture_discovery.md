---
row: 104 (R2.1)
agent: coder-execution
date: 2026-10-22
status: complete
---

# Row 104: capture-discovery on the global destination rule (U4, RF-N3)

## What changed
| File | Change |
|---|---|
| apps/core-server/src/modules/capture-discovery/connect/service.ts:56-61 | Header: F3-06 paragraph replaced by "one reason for every refusal" (U4, RF-N3, RM-N4); :42-52 source wording "the address the destination rule names" (global STORED_CAMERA) |
| service.ts (imports) | `CAPTURE_COMMISSIONING_REFUSAL_SENTENCES`, `CaptureCommissioningReason` removed (no other use) |
| service.ts:289 | `invalidState` reason type narrowed to `CaptureDiscoveryReason` |
| service.ts:357 | `CANDIDATE_ADDRESS_REFUSED_TEXT` loses "from its camera interface" (U4) |
| service.ts:~363-366 (old) | `RULE_NOT_CONFIGURED`, `NETWORK_NOT_SET_UP_TEXT` removed |
| service.ts:376 (old :385) | Branch `RULE_NOT_CONFIGURED -> COMMISSIONING_NOT_CONFIGURED` removed; every refusal -> `409 CANDIDATE_NOT_TESTABLE` |
| connect/__tests__/service.test.ts:673-690 | FACTS gain `interfaceSubnets` (eth0 camera, eth1 office); new `WIFI_ONLY` rule (cameraSubnet null, no camera address, wlp3s0 192.168.0.73/24) |
| service.test.ts:752 | F3-06 case flipped: rule `NOT_CONFIGURED` (unreadable facts) -> `CANDIDATE_NOT_TESTABLE`, "This device cannot be tested." (test + adopt) |
| service.test.ts:780 | NEW: empty network config, Wi-Fi candidate 192.168.0.50 -> tester bound to 192.168.0.73, one bound test, 0 unbound |
| service.test.ts:~795-825 | Lifted pin: office-subnet `OTHER_INTERFACE_SUBNET` case removed from refusals, NEW case: tested from 10.20.0.5; NEW NW-R1 case 172.16.9.9 -> `NO_SOURCE_INTERFACE` |
| __tests__/adopted-test.test.ts:37, :316 | `interfaceSubnets` added; `192.168.60.20` pin `OUTSIDE_CAMERA_SUBNET` -> `NO_SOURCE_INTERFACE`; `10.20.0.77` (`OTHER_INTERFACE_SUBNET`) removed from refusals, asserted admitted from 10.20.0.5 |
| __tests__/readdress.test.ts:40, :282, :392 | `interfaceSubnets` added; "subnet of another interface" row replaced by "a private address no interface holds" (172.16.9.9); cameraSubnet null / empty cameraAddresses flipped to allowed (RM-N4); new pin: facts without `interfaceSubnets` -> `NOT_CONFIGURED` (RF-N7) |
| __tests__/readdress.db.test.ts:67 | `interfaceSubnets` added to HOST_FACTS |
| search.test.ts, capture-discovery.db.test.ts | No change needed (no TP/SC context literal; green as-is) |

## Commands and results
- AC-4: `grep -n COMMISSIONING_NOT_CONFIGURED apps/core-server/src/modules/capture-discovery/connect/service.ts | wc -l` -> `0`
- `npm test -w @dems/core-server -- <service.test, search.test, adopted-test.test, readdress.test> --maxWorkers=2` -> run 1: `Tests 41 failed`; after fixes run 2: `Tests 3 failed | 126 passed (129)`; run 3: `Test Files 4 passed (4)`, `Tests 129 passed (129)`
- `npm test -w @dems/core-server -- src/modules/capture-discovery --maxWorkers=2` -> `Test Files 9 passed (9)`, `Tests 182 passed (182)`
- `lockf db-runner.lock npm run test:db -w @dems/core-server -- readdress.db.test.ts capture-discovery.db.test.ts connect/__tests__/connect.db.test.ts --maxWorkers=2` (outside sandbox: EPERM on 127.0.0.1:4432 in sandbox) -> `Test Files 3 passed (3)`, `Tests 45 passed (45)`
- `lockf heavy-host.lock npm run typecheck -w @dems/core-server` -> exit 2, only `audio-cards/service.ts(299,3)`, `(533,5)` (known red, row 131); 0 errors in this row's files

## Deviations
- None from U4. `CANDIDATE_ADDRESS_REFUSED_TEXT` wording: phrase simply dropped (row 92 gave no replacement text).
