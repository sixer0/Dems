---
row: 105 (R2.1)
agent: coder-execution
date: 2026-10-22
status: complete
spec: masterplan/01_specs_rflex_network.md §4.3 B1/B2; overrides O-5, O-6 (masterplan/01_specs_rflex.md §3); RF-N3, RF-N7, RF-N8, RG-13
---

# Row 105 - network context builder (R-FLEX)

## Changes

| File:line | Change |
|---|---|
| `apps/core-server/src/modules/capture-config/network/facts.ts:1-47` | Header restated for B1/B2/RG-13/RF-N8 |
| `facts.ts:51-52` | Imports `CAPTURE_NETWORK_CONFIG_DEFAULTS` (`@dems/shared/api`) and `cameraNetworkDialRuleOf` (capture/fence) instead of `storedCameraAddressRuleOf` |
| `facts.ts:63` | `HostInterfaceAddress.mac?` - hardware address per address (optional; absent = not eligible) |
| `facts.ts:145` | `readHostInterfaces` keeps `entry.mac` per address |
| `facts.ts:160-167` | `eligible()` (RG-13): not internal, prefix not /0 or /32, mac stated and not all zero (same regex as `selectInterfaces`) |
| `facts.ts:174-213` | `networkFactsOf` (B1): null ONLY for unreadable host facts (non-array list/addresses, unparseable address/prefix) or a non-array stored port list. No row / interface or subnet not chosen / host lacks the interface / loopback / malformed stored subnet text -> context with `cameraSubnet: null`, `cameraAddresses: []`, `otherInterfaceSubnets` = every interface (O-6 kept). `interfaceSubnets` `{name,address,network,prefixLength}` from eligible addresses, host order, camera interface included. No row -> `allowedPorts` = `CAPTURE_NETWORK_CONFIG_DEFAULTS.onvifPorts` ([80], the column default, test-pinned equal to `DESTINATION_DEFAULT_PORTS`) |
| `facts.ts:216-225` | B2/RF-N8: `formAccepted` asks the SET_IP binding (`cameraNetworkDialRuleOf()`, C4); sentinel `NO_CAMERA_SOURCE` and both form checks unchanged |
| `network/index.ts:28-35` | Reader contract text: null = unknown or unreadable; known absence = context |
| `network/index.ts:203-204` | `facts` answers null while `control.known` is false (before load, after failed load/re-load): fail-closed kept (RF-N7); without this, "unknown" would have become "no row -> [80]" |
| `network/__tests__/service.test.ts` | HOST fixture states `mac`; STORED_CAMERA expectations moved to global (NO_SOURCE_INTERFACE / ALLOWED from 10.20.0.15); bound checks via new `boundJudged` (SET_IP); new cases: known absence is a context (7 states), RG-13 exclusion (utun all-zero MAC, no MAC, /32, /0), AC-5 on this machine's table; reader tests assert the held subnet via `subnet()` |
| `network/__tests__/routes.db.test.ts` | HOST fixture states `mac`; `judged` = SET_IP binding without alias entries (the old stored-camera answers, so all existing expectations kept); new `storedJudged` (global); 4 null expectations changed to "context without camera part" |

`cameraSubnetAccepted` / `factoryAddressAccepted` accept/refuse lists: unchanged and green (the subnet test's last loop needed `mac` on its host literal, its expectation unchanged).

## Tests (verbatim counts)

- `npm test -w @dems/core-server -- src/modules/capture-config/network/__tests__/service.test.ts --maxWorkers=2` -> first run after facts.ts change: `Tests 13 failed | 22 passed (35)` (old expectations); after test update: `Test Files 1 passed (1)`, `Tests 37 passed (37)`.
- Mutation: `eligible` -> `return true || ...`: RG-13 case red (`expected [ 'lo', 'eth0', 'eth1', 'utun3', …(3) ] to deeply equal [ 'eth0', 'eth1' ]`); restored.
- `/usr/bin/lockf -k .data/locks/db-runner.lock npm run test:db -w @dems/core-server -- src/modules/capture-config/network/__tests__/routes.db.test.ts --maxWorkers=2` (outside sandbox: sandbox EPERM on 127.0.0.1:4432) -> run 1 `Tests 14 failed | 7 passed (21)`, run 2 `1 failed | 20 passed`, run 3 `Test Files 1 passed (1)`, `Tests 21 passed (21)`.
- `/usr/bin/lockf -k .data/locks/heavy-host.lock npm run typecheck -w @dems/core-server` -> exit 2; errors only in `audio-cards/service.ts:299,533` and `audio-cards/__tests__/service.test.ts:135` (row 131, known). 0 errors in network/.

## Decisions / deviations

- D-105-1 `mac` member name: not in the register; it is the runtime's own field name (`os.networkInterfaces()`), optional on `HostInterfaceAddress`, no exported type added. Absent = not eligible (fail-closed).
- D-105-2 Camera part filled only on the full old condition (interface + subnet chosen, subnet parses, host holds non-loopback interface); otherwise `cameraSubnet: null` -> SCAN/SET_IP keep `NOT_CONFIGURED` (Q96-04 a). A stored subnet that parses but the rule rejects (host bits, public, /8) is still passed and the whole context refuses NOT_CONFIGURED (D-102-2).
- D-105-3 `control.known === false` -> null in index.ts (RF-N7).
- D-105-4 Default ports from `CAPTURE_NETWORK_CONFIG_DEFAULTS.onvifPorts`: `DESTINATION_DEFAULT_PORTS` is not exported through capture/fence and the import rule forbids `capture/destination-rule` from module production code.

## Effects outside ownership (not touched)

- Fixtures without `mac` (`src/__tests__/capture-composition.db.test.ts`, `camera-network/__tests__/routes.db.test.ts`, `factory-scan/__tests__/routes.db.test.ts`, `test/acceptance/contract.test.ts`) get `interfaceSubnets: []` -> TP/SC answer `NO_SOURCE_INTERFACE` where they expect ALLOWED; previously (after row 102) `NOT_CONFIGURED`. They need `mac` on their HostInterface literals (row 136 / owners).
- B6 `capture/host-alias/facts.ts:52-66`: with a stored interface but no subnet / host lacking it, the reader now gets a context with `cameraSubnet: null` instead of null and does not throw `HostAliasFactsUnknownError`; B6's row must add that throw (spec B6).
- Callers that tested `facts === null` for "not configured" (set-IP `camera-network/service.ts:621` also checks `cameraSubnet` null - fine; factory-scan `:565,:575` checks `settings.configured` - fine).
