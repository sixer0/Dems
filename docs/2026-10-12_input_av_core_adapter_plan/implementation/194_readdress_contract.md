---
task_slug: input_av_core_adapter_plan
row: 194
milestone: M8 / WP-12
date: 2026-10-13
agent: coder-execution (batch 9, agent R5)
tier: T3
status: complete (contract only; the committed openapi.json is regenerated once, after row 102)
---

# Row 194 - the contract of operation 100 `confirmCaptureDeviceAddress`

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `SH` = `packages/shared`, `CS` = `apps/core-server`, `WEB` = `apps/core-web`.

## 1. The operation

| Member | Value |
|---|---|
| Number, id | 100, `confirmCaptureDeviceAddress` |
| Method, path | `POST /api/v1/capture/devices/address/confirm` (no path parameter) |
| Tag, mode | Device, `simulated` |
| Access | `CAPTURE_CONFIG` + `WEB_CONSOLE_SESSION` - the access object of operation 96 (`CAPTURE_CREDENTIAL_ACCESS`); row 97's DD-2, confirmed by C47 (29) |
| Audit | success `CAPTURE_DEVICE_ADDRESS_CHANGED`, denial `ACCESS_DENIED` |
| Body | `CaptureDeviceAddressConfirmRequest`: `deviceId` (`CAM-` and 2 to 8 digits), `candidateId`, `address` - three members, all required, no other |
| Answer 200 | `CaptureDeviceAddressConfirmation`: `deviceId`, `device` (slice 30's entry; its `host` is the confirmed address). Core server only |

THE AUDIT TYPE: `CAPTURE_DEVICE_ADDRESS_CHANGED` is in the vocabulary since row 19 (category DEVICE; keys deviceId, fromAddress, toAddress, reason, operationId?, permission?). Step 201 was NOT needed for this operation and added nothing for it. The reason code of the row is `OPERATOR_CONFIRMED` (`CAPTURE_READDRESS_AUDIT_REASON`, the server's `READDRESS_AUDIT_REASON`).

THE ADDRESS FORM (`CAPTURE_DEVICE_CONFIRMED_ADDRESS_PATTERN`): the strict dotted quad of row 94's typed address (`CAPTURE_DISCOVERY_TYPED_ADDRESS_PATTERN`), optionally `:port` (1 to 65535, no leading zero) - `host` or `host:port`, as adoption stores an address. The test holds: whatever the typed-address form refuses, this body refuses (21 texts: names, a leading zero, hexadecimal, a bare integer, a prefix, blanks, IPv6, mapped IPv6, URLs, `user:password@`), and the quad of every accepted text passes the typed-address form. A FORM only: the destination rule (`CS/src/capture/destination-rule.ts`, purpose `STORED_CAMERA`) decides.

NEVER AUTOMATIC, in the contract's words: the body IS the operator's confirmation; the Core takes the new address from its own search state and compares; a typed address without a candidate re-addresses nothing; the stored credential stays; nothing is sent to the new address.

### Answers and refusals

| Status | Code, reason | Sentence (`message`) |
|---|---|---|
| 200 | - (Core server only) | - |
| 400 | `INVALID_JSON` | the contract's |
| 401 | `NOT_SIGNED_IN` | the contract's |
| 403 | `NOT_PERMITTED` (role, or `WEB_CONSOLE_ONLY`) | the contract's |
| 404 | `NOT_FOUND`: no registered camera of this id, or the candidate is unknown, expired or another session's (one answer) | No camera or candidate has this ID. |
| 409 | `CAPTURE_CONFIG_LOCKED` | The capture configuration cannot be changed while a session is open. |
| 409 | `INVALID_STATE`, `READDRESS_NOT_THE_REGISTERED_CAMERA` | The search did not find this camera at a new address. |
| 409 | `INVALID_STATE`, `READDRESS_IDENTITY_CONFLICT` | Two devices answer as this camera. Neither address is accepted. |
| 409 | `INVALID_STATE`, `READDRESS_CONFIRMATION_MISMATCH` | The search result changed. Search again and confirm the address shown. |
| 409 | `INVALID_STATE`, `READDRESS_ADDRESS_UNCHANGED` | The camera already has this address. |
| 409 | `INVALID_STATE`, `READDRESS_ADDRESS_TAKEN` | Another capture device has this address. |
| 409 | `INVALID_STATE`, `READDRESS_STORED_ADDRESS_UNREADABLE` | The stored address of this camera cannot be replaced this way. |
| 422 | `INVALID_INPUT` (the body), or `INVALID_INPUT` with `DISCOVERY_ADDRESS_NOT_ALLOWED` (the destination rule; the reason of row 94, one for every rule) | This address is not allowed for a camera. |
| 503 | `NOT_READY`, `DISCOVERY_NOT_READY` (envelope level) | - |

The six `READDRESS_*` values (`CaptureReaddressReason`) are the strings of the server's `ReaddressRefusal` (`CS/src/modules/capture-discovery/readdress.ts`), so the route of row 197 maps nothing. No sentence quotes an address (tested).

### The stated answers by mode

| Mode | Answer |
|---|---|
| `SIMULATED` (the in-app simulator) | never a success. `401`, `403` (role; tablet or phone), `409 CAPTURE_CONFIG_LOCKED`, `400`, `422`; `404` for a device that is no registered camera or a candidate not in its live search; else `409 INVALID_STATE` / `READDRESS_NOT_THE_REGISTERED_CAMERA`. It stores nothing, writes no audit row, changes no state (tested: slice `captureDevices` is equal before and after) |
| `REAL_DEVELOPMENT` (a Core with development sources) | its candidates are registered by their whole address, so none has a changed address: `409` / `READDRESS_NOT_THE_REGISTERED_CAMERA`, nothing stored. Without a camera search: `503` / `DISCOVERY_NOT_READY`. Stated in the description; the Core has NO route yet |
| Production | the table above; the route is row 197, behind the engine door of row 196 |

## 2. Files

| File | Change |
|---|---|
| `SH/src/api/capture-discovery.ts` | a last section: patterns, `CaptureReaddressReason`, sentences, two schemas, `CAPTURE_READDRESS_SCHEMAS`, `CAPTURE_READDRESS_OPERATIONS`, `CAPTURE_READDRESS_EXAMPLES`; one line in the header table |
| `SH/src/api/core-api.ts`, `examples.ts` | the operation appended after 99, the two schemas, the examples (three spreads, one import each) |
| `SH/src/sim/api.ts` | one route line, one handler, three imports |
| `docs/2026-10-07_dems_real_capture_sealing/masterplan/03_api_contract.md` | ONE row (100) in the identity table of section 2.6 - the acceptance matrix composes its expectation from that table (as pass I-2 did for 98 and 99) |

## 3. Count pins moved (each by its delta)

Operations 99 -> 100; POST 63 -> 64 (GET 36); offline scope 33 -> 34; simulated 32 -> 33 (live 67 unchanged); paths 93 -> 94; registry schemas 172 -> 174, offline components 57 -> 58; one-permission rules 59 -> 60, rules with a permission 60 -> 61; operations with a condition 15 -> 16; Device tag 25 -> 26; request bodies 37 -> 38; schemas "added" 154 -> 156; Core-server-only statuses 27 -> 28; cookie-or-bearer 89 -> 90; examples of Core-answered operations 89 -> 90; operations no action reaches 54 -> 55; guard cells 891 -> 900, INVESTIGATOR denied 36 -> 37; web-only refusal rows 5 -> 6 per holder role; Try-it allowed 89 -> 90.

| File | What moved |
|---|---|
| `SH/test/api-registry.test.ts` | header, new `T4_READDRESS_OPERATIONS` / `T4_LATER_OPERATIONS`, totals, access counts, `ENFORCED_AT` (CAPTURE_CONFIG gains 100), conditions, offline, tag, schema count and list, the named Core-only success, the source pattern, the typed table length |
| `SH/test/api-capture-discovery.test.ts` | M4-PIN-1, the web-only list; the two position pins now read from the START of the table (`slice(92, 97)`, `slice(97, 99)`) so that a later operation does not move them; NEW describe "task 4 row 194" (4 cases) |
| `SH/test/api-openapi-scope.test.ts`, `openapi.test.ts` | offline ids and components, totals, paths, simulated, permissions, security shapes, summary, components; NEW flow 16 through the simulator; Core-only statuses 28 |
| `SH/test/api-domain-operations.test.ts`, `api-examples.test.ts`, `api-stt-config.test.ts`, `api-text-rule.test.ts`, `api-verify-report.test.ts` (title), `sim-api.test.ts` | their totals |
| `CS/src/plugins/permission-guard/__tests__/access-rules.test.ts`, `decision.test.ts`, `denial.test.ts`, `guard.test.ts`, `matrix.test.ts` | totals, the condition list, the web-only list, the cells |
| `CS/src/modules/devices/__tests__/routes.test.ts`, `stt-config/__tests__/routes.test.ts` | the Device area list; the totals |
| `CS/test/acceptance/contract.test.ts` | totals; the NAMED DEFERRAL (section 4) |
| `CS/test/acceptance/rbac-matrix.test.ts`, `rbac-matrix.support.ts` | totals, the composed rows (2.6: 7 -> 8; delta rows 24 -> 25), the web-only rows, `DEFERRED_ROUTE` |
| `WEB/src/test/live-api-reference-page.test.tsx`, `live-api-reference-document.test.tsx`, `scalar-config.test.ts` | 99 -> 100, 33 -> 34, 32 -> 33, 89 -> 90 |

No audit pin and no action pin moved. Counts after the row: 100 operations, 78 audit types, 50 actions.

## 4. Named deferrals ADDED (each pinned by literal; row 197 ends both)

| List | Entry |
|---|---|
| `LANDED_UNROUTED` and `UNROUTED_UNTIL` of `CS/test/acceptance/contract.test.ts` | `'POST /api/v1/capture/devices/address/confirm'` -> `'task 4 row 197'`; block 1 holds `UNROUTED_OPERATIONS` equal to `['confirmCaptureDeviceAddress']` and the two lists equal; the coverage block names every documented status of the operation as "no route until task 4 row 197". No response is faked |
| `DEFERRED_ROUTE` of `CS/test/acceptance/rbac-matrix.test.ts` | `confirmCaptureDeviceAddress: 'task 4 row 197 (M8 / WP-12): ...'`; the routed count stays 99 |

## 5. Checks (2026-10-13)

| Check | Command | Result |
|---|---|---|
| Shared contract suites | `npx vitest run --maxWorkers=2 test/api- test/openapi test/sim-api.test.ts test/sim-capture-discovery.test.ts test/live- test/client` in `packages/shared` | second run (the first listed the 39 pins to move): `Test Files 3 failed, 42 passed (45)`, `Tests 3 failed, 1371 passed (1374)`. The 3 are the three cases that read the COMMITTED `openapi/openapi.json` (two byte-for-byte cases, one count of its paths): red until the one regeneration after row 102 |
| Core unit pins | `npx vitest run --project unit --maxWorkers=2 src/plugins/permission-guard/__tests__ src/modules/devices/__tests__/routes.test.ts src/modules/stt-config/__tests__/routes.test.ts src/engine/__tests__/hosted-actions.test.ts` (sandbox off: the STT test listens on loopback) | `Test Files 11 passed (11)`, `Tests 297 passed (297)` |
| Web pins | `npx vitest run --maxWorkers=2 src/test/live-api-reference-page.test.tsx src/test/live-api-reference-document.test.tsx src/test/scalar-config.test.ts` | `Test Files 3 passed (3)`, `Tests 142 passed (142)` |
| Typecheck | `npm run -s typecheck` in the six workspaces | exit 0, six of six |
| Acceptance (database) | the two files of `CS/test/acceptance` | run once after the regeneration (see the record of row 102) |

Verification cell: "every count pin passes at 100" - section 3, with the three committed-document cases waiting for the regeneration; "the operation has a stated simulator answer that changes no registered address" - flow 16 of `openapi.test.ts`; "the body schema refuses an address outside the form of row 94" - case "the body: three members ...".

## 6. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | The device is a member of the BODY and the path has no parameter (`/capture/devices/address/confirm`), not `/capture/devices/{id}/address` with two body members as row 97 proposed | the row's cell: "body schema with the three members row 97 built against (device, candidate, address)" - the body is exactly the argument of `operatorReaddressConfirmation`; one statement of the device, no path-against-body mismatch case |
| DD-2 | `deviceId` is held to `CAM-NN` in the schema | a microphone or the switch can never be re-addressed; the server answers `DEVICE_UNKNOWN` for them anyway |
| DD-3 | IPv4 only, with an optional port | the destination rule is IPv4 only (S13-11 point 1); the port is what adoption stores when the service address names one |
| DD-4 | One 404 for "no such camera" and "no such candidate" | the pattern of operations 95 and 96; no oracle for which of the two ids exists |
| DD-5 | The destination-rule refusal is `422` with the EXISTING reason `DISCOVERY_ADDRESS_NOT_ALLOWED`; the rule's own code is not in the envelope | row 94's ruling: one reason for every rule |
| DD-6 | The six 409 reasons are a NEW set `CaptureReaddressReason`, not members of `CaptureDiscoveryReason` | that set's member list is pinned by other tests and rows; the values equal the server's codes |
| DD-7 | Mode `simulated` with a simulator that only refuses | every operation a client can reach offline is answerable there; a simulated success would have to move a camera of the demo data |
| DD-8 | Not denied for the web Try-it (allowed 89 -> 90) | its body holds ids and an address, no secret; the denied ten carry a credential or an identity |
| DD-9 | One row added to the TASK-3 contract document (section 2.6) | the acceptance matrix reads its expectation from that table; pass I-2 did the same for 98 and 99 |
| DD-10 | No i18n string | the dialog of row 198 owns its string group; the contract's sentences are `CAPTURE_READDRESS_REFUSAL_SENTENCES` |

## 7. The double, and what stays unproven

The in-app simulator and pure schema tests. Unproven: the route and the durable write (rows 196, 197), the dialog (row 198), a real camera that moved (`9A/H-12`).

Existing files were edited with the Edit tool only.

---
*Generated: 2026-10-13*
