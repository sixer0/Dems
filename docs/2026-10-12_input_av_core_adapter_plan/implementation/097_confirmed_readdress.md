---
task: 2026-10-12_input_av_core_adapter_plan
row: 97
milestone: M8 / WP-12
agent: coder-execution (batch 7, agent R/T/X)
date: 2026-10-13
tier: T3
status: needs-review - the service is built and proven on doubles; no route and no live write exist, because the contract has no operation and the engine no door for it (three lines in file_requests.md)
---

# Row 97 - the operator-confirmed re-address of a registered camera, with its audit entry; never automatic

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CD` = `apps/core-server/src/modules/capture-discovery`.

## 1. What was found before building

| Question | Answer | Evidence |
|---|---|---|
| Does the contract hold an operation for a re-address? | No. 99 operations; on a registered device: 89 (credential); on a candidate: 95, 96 | `packages/shared/src/api/capture-discovery.ts` (operation ids at `:628-774`); search for a re-address member: 0 |
| Does the audit type exist? | Yes: `CAPTURE_DEVICE_ADDRESS_CHANGED`, keys **deviceId, fromAddress, toAddress, reason**, operationId, permission; the two addresses are IP literals | `implementation/019_audit_vocabulary.md:41`; `apps/core-server/src/core/audit-details.ts:496-503` |
| Can anything change the address of a registered device? | No. The address is `host` of slice 30; `registerCaptureDevice` refuses an id the registry holds; a statement beside the engine would leave the slice stale | `packages/shared/src/sim/capture-registry.ts` (`captureDeviceOf`); `CD/adoption.ts` |
| Does the search already say that a registered camera moved? | Yes: `addressChanged` of a candidate (registered by endpoint reference, answering from another address) | `apps/core-server/src/capture/adapters/camera/discovery-collector.ts:309`; `CD/search.ts:170` |

As instructed, `packages/shared` was not edited: the operation and the registry transition are requested, and the server part is built behind two seams.

## 2. Change set

| File | Change |
|---|---|
| NEW `CD/readdress.ts` | `confirmCameraReaddress(seams, caller, confirmation)`; the branded `OperatorReaddressConfirmation` and its one maker `operatorReaddressConfirmation`; the closed refusal set `ReaddressRefusal` (12 codes) and `ReaddressRefused`; the seams `ReaddressCandidates`, `ReaddressRule`, `DeviceReaddresser`, `ReaddressHost`; helpers `readdressTargetOf`, `storedHostLiteral` |
| `CD/store.ts` | ONE additive member of `HeldCandidate`: `addressChanged` (true only for a REGISTERED candidate whose search said so) |
| NEW `CD/__tests__/readdress.test.ts` | 31 cases on doubles, with the REAL destination rule |
| `CD/__tests__/limits-store.test.ts` | +1 case: `find` hands the fact on |
| `CD/__tests__/static.test.ts` | NEW rule 6 (4 cases); no existing rule changed |

## 3. The rule, as built

1. **Never automatic.** The function acts only on an `OperatorReaddressConfirmation` (a private brand; a look-alike object, a JSON copy, null are refused `READDRESS_NOT_CONFIRMED` before any seam is asked) from an OPERATOR session. The maker and the function have NO production caller: static rule 6 holds their callers to a closed list that is empty, and holds the search path (`search.ts`, `store.ts`, `registered.ts`, `search-ids.ts`, `limits.ts`, `session-expiry.ts`, `adoption.ts`) to 0 imports of the file.
2. **The operator confirms what was shown.** The confirmation carries the address; it must equal the address the candidate holds now (`host`, or `host:port` as adoption forms it), else `READDRESS_CONFIRMATION_MISMATCH`.
3. **The candidate is the registered camera by identity.** Of the caller's own live search; registered as the confirmed device; `addressChanged` (which is only ever true for a match by endpoint reference); not in an identity conflict (SEC35-28).
4. **The destination rule (AD-02) before the unit opens.** Through the seam `addressRule` (the composition binds `decideDestination`, purpose `STORED_CAMERA`). Allowed is the literal `true`; a rule that throws or answers nonsense allows nothing. The refusal carries the rule's own code.
5. **Idle only**, read before the unit and again inside it (as adoption).
6. **One unit:** the engine's door changes the address, then ONE audit entry `CAPTURE_DEVICE_ADDRESS_CHANGED` with `{ deviceId, fromAddress, toAddress, reason: OPERATOR_CONFIRMED, permission: CAPTURE_CONFIG }`, actor = the operator. Inside the unit also: the device exists, the address differs, no other device holds it, the stored address is an IP literal. A failing door rolls both back.
7. No log line carries an address or an endpoint reference (a test reads every note).

## 4. Checks (2026-10-13)

| Check | Result |
|---|---|
| `vitest run --project unit` on `readdress.test.ts`, `static.test.ts`, `limits-store.test.ts`, `search.test.ts` of the module, `--maxWorkers=2` | first run: 74 of 75 passed; the one failure was in MY new test (it expected port 80 to be part of a stored address; the default port of a locator is not, as in adoption). Second run of `readdress.test.ts`: `Test Files 1 passed (1)`, `Tests 31 passed (31)` |
| `vitest run --project unit test/static` (collateral of two new files) | `Test Files 16 passed (16)`, `Tests 180 passed (180)` |
| `npx tsc --noEmit` in `apps/core-server` | exit 0 |
| `npx oxlint src/modules/capture-discovery` | exit 0 |

Verification cell: "a confirmed re-address writes 1 entry" - case "the device holds the new address; the entry is ..." (1 entry, the registry changed) and its twin that runs the entry through the audit writer's closed detail rule. "re-addresses without a confirmation: 0" - case "re-addresses without a confirmation: 0" (5 non-confirmations, 3 non-operator callers: 0 units, 0 rule calls, 0 door calls, 0 entries) and static rule 6.

Destination rule with the real function: loopback, a public address, the host's own address, another interface's subnet, a private address outside the camera subnet, the subnet's broadcast address and a link-local address are each refused with the rule's code; nothing written.

## 5. The double, and what stays unproven

Doubles: a hand-built candidate list; an engine unit whose pending state is a hand-built registry and whose audit door collects entries; a door function that changes that state. Real: the destination rule, the audit detail rule of the type.

Unproven: (a) the unit of the real engine, the durable write of `capture_devices.address` and the audit chain - no database test was possible without the engine's door (no throw-away database was used in this row); (b) the route, its access rule and its contract answers; (c) a real camera that moved (`9A/H-12`).

## 6. Identifiers

WP-12, second half ("operator-confirmed re-address with its audit type; never automatic"): the rule and the audit entry are built and tested on doubles; NOT closed until the route and the door exist. NEW-1 / U12 A7 "a changed camera address is never followed automatically": held by static rule 6. AD-02 on the new address: held. S13-11: the rule is asked through the seam.

## 7. Requests (file_requests.md, three lines of row 97)

1. The contract operation (proposed `confirmCaptureDeviceAddress`, POST `/api/v1/capture/devices/{id}/address`) - blocking for a route.
2. The engine's door / INTERNAL action that changes `host` of a registered device inside a unit - blocking for a live write.
3. The wiring of the three seams and the one entry of `READDRESS_CALLERS`.

## 8. Driver decisions (for the controller to confirm)

- DD-1: no route and no statement were built. A route needs a registry entry; a statement on `capture_devices.address` beside the engine would make the replicated registry lie until a restart.
- DD-2: the permission written into the audit entry is `CAPTURE_CONFIG` (SUPERVISOR and TECHNICIAN), the one adoption and the credential write use; "the role the contract states" does not exist yet.
- DD-3: the audit reason is the new code `OPERATOR_CONFIRMED` (the detail rule takes any SCREAMING_SNAKE_CASE code; the set-IP job's is `SET_CAMERA_ADDRESS`). `operationId` is left out until an operation exists.
- DD-4: the stored credential stays with the device: the operator confirmed it is the same camera. A re-test with the stored credential before the write was NOT added (it would send the credential to the new address before the operator's act is recorded).
- DD-5: only a candidate with `addressChanged` (a match by endpoint reference) can be confirmed; a typed address without a candidate cannot re-address a camera. The port-only change of one host is out (the audit entry states IP literals).
- DD-6: refusals are the module's own closed code set (`ReaddressRefusal`), thrown as `ReaddressRefused`, not `ApiFailure`s: the contract reasons they map to do not exist yet.
- DD-7: `limits-store.test.ts` gained one case (the store's own test file; declared here, it was not in the first claim line).
