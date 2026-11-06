---
row: 102 (R2.1)
agent: coder-execution
date: 2026-10-22
status: needs-review (own scope green; core-server typecheck red only in another row's file)
---

# Row 102: destination rule, TYPED_PROBE / STORED_CAMERA global (R-FLEX spec 2.5, O-4, O-5, O-6)

## What changed
| File | Change |
|---|---|
| apps/core-server/src/capture/destination-rule.ts:99, :105 | Added NW-R1 `NO_SOURCE_INTERFACE` and NW-R2 `SOURCE_INTERFACE_AMBIGUOUS` to `DestinationRefusal` (register names). `NOT_CONFIGURED` doc narrowed to RM-N4's remaining meaning |
| destination-rule.ts:193 | `DestinationContext.interfaceSubnets?` (NW-C1), OPTIONAL, beside `otherInterfaceSubnets` (kept, name and meaning, 2.7/O-6). Element type inline `{ name, address, network, prefixLength }` (no new unregistered exported type name). Callers compile unchanged |
| destination-rule.ts:126 | `GLOBAL_PURPOSES` (TP, SC); `ALIAS_PURPOSES` unchanged |
| destination-rule.ts:363 `globalFactsOf` | Step 0: `interfaceSubnets` absent or any member not well-formed -> `null` -> `NOT_CONFIGURED` (RF-N7, O-5). `cameraSubnet` may be null; if given it must be well-formed/private, own camera addresses inside it. Step 3 candidates: non-alias (RG-11), private, prefix not /0 or /32 (RG-13); others skipped, not unreadable. Host set = cameraAddresses + hostAddresses + interfaceSubnets addresses (RG-4) |
| destination-rule.ts:431, :465 `decideGlobal` | TP/SC branch after the class (step 1): HOST_ADDRESS -> on-link candidates, longest prefix -> none: NW-R1 -> >1 interface name at that prefix: NW-R2 (camera interface included, O-4) -> edges /24 + chosen prefix -> port list -> `sourceAddress`, `viaAlias: false` |
| COMMISSIONING_SCAN / SET_IP / `decideNewCameraAddress` | Code path unchanged (Q96-04 a); they do not read `interfaceSubnets` |
| apps/core-server/src/capture/__tests__/destination-rule.test.ts | `HOST` gains `interfaceSubnets`; point-2 cases restricted to `BOUND_PURPOSES` (assertions for SCAN/SET_IP unchanged; TP/SC expectations moved to the new block); new block :303 "R-FLEX: TYPED_PROBE and STORED_CAMERA are global" |

## Verification items -> tests
- Allow per lifted code, TP and SC: RM-N1, RM-N2, RM-N3, RM-N4 (90 AC-1: `cameraSubnet: null`, wlp3s0 192.168.0.73/24, 192.168.0.50 allowed from .73, `viaAlias` false), each with the bound purposes still refusing.
- NW-R1 off-link (incl. row 16 finding 4, camera port down; empty list); NW-R2 tie with and without the camera interface; longest prefix; RG-13 skips; NOT_CONFIGURED without `interfaceSubnets` (RF-N7) and for malformed lists.
- RG-1..RG-11 refusal per guard for TP and SC on the Wi-Fi (non-camera) interface (RG-7 via `scanSizeRefusal`/`spacingAllowance`, RG-8 via `decideNewCameraAddress`, RG-9 loopback-steered list, RG-10 alias /24 for SCAN, RG-11 alias /24 -> NW-R1).
- Vocabulary coverage test extended: every `DestinationRefusal` incl. NW-R1/NW-R2 reached.

## Commands and results
- `npm test -w @dems/core-server -- src/capture/__tests__/destination-rule.test.ts --maxWorkers=2` -> `Test Files 1 passed (1)`, `Tests 195 passed (195)` (one run, first pass).
- `/usr/bin/lockf -k .data/locks/heavy-host.lock npm run typecheck -w @dems/core-server` -> exit 2. Errors only in files of other rows: run 1 `src/capture/adapters/audio/__tests__/macos-card-listing.test.ts` (4) + `src/modules/capture-inputs/audio-cards/service.ts:299,532` (2); run 2 (`npx tsc --noEmit`) only `audio-cards/service.ts` (2: `boundTo`, `releasedDeviceId` missing - audio rows landing in parallel). 0 errors in destination-rule.ts, its test, or any caller.
- Extra (read-only check): `src/capture/__tests__/static.test.ts` 4 failures, none about destination-rule (SR-5 entry 2 lists `src/lcd/bridge.ts 1`; config.ts/capture-mode/DEMS_* pins) - caused by the pre-existing untracked `src/lcd/` and modified `config.ts` of the working tree, not this row.

## Deviations / decisions
- D-102-1 Order: the class (point 1) is decided BEFORE step 0 for TP/SC, as for every purpose (existing invariant "the class has its own code whatever the configuration says", 90 AC-2 "each point-1 code unchanged"). Both orders send 0 packets; only the code of a loopback/public target with unreadable facts differs (class code instead of NOT_CONFIGURED).
- D-102-2 Malformed `cameraSubnet`, `cameraAddresses`, `otherInterfaceSubnets` or `hostAddresses` still refuse TP/SC with NOT_CONFIGURED (one context judged whole, fail-closed); only `cameraSubnet: null` and an empty camera interface are lifted.
- D-102-3 Alias exclusion: an `interfaceSubnets` entry whose address is an alias of `cameraAddresses` is never a candidate (RG-11), but stays a host address.
- D-102-4 `interfaceSubnets` optional; element type inline (no unregistered exported type name).

## Expected effect on other rows (not edited here)
TP/SC callers whose context lacks `interfaceSubnets` (production builder `facts.ts`, `HOST_NOT_CONFIGURED`, and test literals that exercise TP/SC: e.g. `stored-address-cases.ts`, capture-composition, credential-reader, connect service, adopted-test, readdress, search tests) now get `NOT_CONFIGURED` for allowed-path cases until rows 103-106 fill the member. Not run here (outside ownership).
