---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 94
date: 2026-10-13
agent: coder-execution
status: complete
tier: T3
---

# Row 94 - shared contract of the typed address on the camera search (M8, WP-12)

Contract only. The Core's probe is row 96; the web form is row 98. No operation was added: the registry holds 99.

## 1. What was changed

| File | Change |
|---|---|
| `packages/shared/src/api/capture-discovery.ts` | (a) `CAPTURE_DISCOVERY_TYPED_ADDRESS_PATTERN` and `CAPTURE_DISCOVERY_TYPED_ADDRESS_MAX_LENGTH` (15). (b) `CaptureDiscoveryStartRequestSchema` / type `CaptureDiscoveryStartRequest`: a strict object with ONE optional member `address`; registered as `CaptureDiscoveryStartRequest`, first of `CAPTURE_DISCOVERY_SCHEMAS`. (c) Operation 93: `requestBody: { schema, required: false }`; responses 400 and 422 added, the 403 text extended; the description rewritten in its first three paragraphs, its rate line and its simulator line; `source` extended. Access, audit, path, mode: unchanged. (d) `CaptureDiscoveryReason.DISCOVERY_ADDRESS_NOT_ALLOWED` (one new member, under 422). (e) Simulator fixture: `SIM_TYPED_ADDRESS_CANDIDATE_ID` (`CND-000000000003`), `SIM_TYPED_ADDRESS_CANDIDATE_NAME`, `SIM_TYPED_ADDRESS_EXAMPLE` (`192.168.10.20`), `simTypedAddressAllowed`, `simTypedAddressCandidate`. (f) Examples of operation 93: two request examples (the first is `{}`), a second 202, a 400, a `webConsoleOnly` 403, two 422. (g) The header comment: "no caller-supplied target, with one exception" |
| `packages/shared/src/sim/api.ts` | The handler of operation 93 only (and two import lines; one import that became unused was removed). It now reads the body. Without `address` every added line is passed untouched |
| `packages/shared/openapi/openapi.json` | Regenerated once, last, by the repository's generator (section 5) |
| `packages/shared/test/api-capture-discovery.test.ts` | Two cases added to "no caller-supplied target"; three pins moved (statuses of operation 93, its offline statuses, "takes no body") |
| `packages/shared/test/sim-capture-discovery.test.ts` | Five cases added to the block of operations 93 and 94 |
| `packages/shared/test/openapi.test.ts`, `api-openapi-scope.test.ts`, `api-registry.test.ts`, `api-text-rule.test.ts` | Count and name-list pins by delta (section 4) |

## 2. The schema and the destination rule (S13-11)

The rule's strict literal (`apps/core-server/src/capture/destination-rule.ts:192`, `:206-216`, `:249-251`): the text matches `^(0|[1-9]\d{0,2})\.(...){3}$`, each part is at most 255, the text is at most 15 characters; anything else is `MALFORMED_IPV4`, `HOST_NAME`, an IPv6 code or `NOT_AN_ADDRESS`.

The contract's pattern: `^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}$`, with `maxLength` 15. It holds the 0-255 bound in the pattern itself, so it accepts exactly the texts the rule reads as one address and no other. No port member exists: the rule's address member has none (a port glued on is `MALFORMED_IPV4`), and the probe's port is not the caller's.

Shown by the case "the typed address of operation 93 is ONE strict dotted quad": the 14 texts of the rule's own table "is not a strict dotted quad" (`destination-rule.test.ts:94-108`) are refused one by one, with 7 more malformed texts, 8 names and locators, 11 ways of writing an address as IPv6, and 5 values that are no text. A control line shows that the loose pattern of a candidate's `host` would let two of them pass.

The schema is the FORM only. `127.0.0.1`, `8.8.8.8`, `224.0.0.1` match it; whether an address may be dialled needs the host's interfaces, which only the Core has. The contract states that refusal as `422 INVALID_INPUT`, `details.reason: DISCOVERY_ADDRESS_NOT_ALLOWED`, never quoting the address.

S13-12: `address` is the operator's text, not a device's, and it is bound by a pattern (it is not free text, so the API-13 walk of the acceptance suite does not list it). A candidate found by a typed address carries device text under the same bounded, "draw as text only" members as every candidate; no new member carries device text.

## 3. The simulator

| Request | Answer |
|---|---|
| no body, `{}`, the text `{}` | Exactly as before: 202, `DSC-000001`, 2 responders, 1 new, the two fixed candidates, the same audit row. Shown by the case "a search without the member answers exactly as before" (the three answers, lists, rows and registries are deeply equal) and by the cases the file held before, which pass unedited |
| `{ address }`, a private address | 202; a THIRD, synthetic candidate, last in the list: `CND-000000000003`, adapter `FAKE`, class `DEVELOPMENT`, vendor `DEMS`, name "Test camera at the typed address", `host` = the typed address. Counts 3 / 2 / 1. Nothing is probed. The audit row has the same ten keys and holds no address |
| `{ address }`, outside the form, or a member too many | 422 `INVALID_INPUT`, `details.in: body`; no search, no id spent, no row; the input is not quoted |
| `{ address }`, of the form, outside the stand-in of the rule | 422 with `details.reason: DISCOVERY_ADDRESS_NOT_ALLOWED`; the same "nothing happened" |
| `{ address }` on a tablet or phone | 403 `NOT_PERMITTED`, `details.reason: WEB_CONSOLE_ONLY`, decided on the presence of the member; the same session still searches without it |

The stand-in (`simTypedAddressAllowed`): the three private ranges, not the first or last address of the `/24`. It is not the rule and says so in its comment: the simulator has no interface and no address of its own.

One line of the existing handler changed its means, not its result: the fixture candidate read REGISTERED "when the registry holds `CAM-03`"; it now reads REGISTERED "when the registry holds a camera with the candidate's whole address". In a store where no typed address was adopted the two are the same statement (the earlier cases of `sim-capture-discovery.test.ts` pass unedited). The change was needed because a typed-address candidate adopted first takes `CAM-03`.

## 4. Pins moved (each by its delta)

Operations 99, GET 36, POST 63, offline 33, paths: unchanged. Registry schemas 171 -> 172; offline components 56 -> 57; request bodies 36 -> 37; schemas after the first 18: 153 -> 154; documented statuses of operation 93 `[200, 202, 401, 403, 409]` -> `[200, 202, 400, 401, 403, 409, 422]`, offline `[202, 401, 403]` -> `[202, 400, 401, 403, 422]`.

| File | Line (after the change) |
|---|---|
| `SH/test/api-capture-discovery.test.ts` | the statuses table and the offline statuses of operation 93; the case "operations 94 and 97 take no body ..." |
| `SH/test/openapi.test.ts` | the offline name list (+1 name); the comment "57 schemas"; flow 14: three lines that produce the 400 and the 422 of operation 93 |
| `SH/test/api-openapi-scope.test.ts` | the offline name list (+1 name); title "57 offline components ... 9 of the camera search"; `toHaveLength(172)` |
| `SH/test/api-registry.test.ts` | the schema name list (+1 name); the sum `... + 4 + 1` |
| `SH/test/api-text-rule.test.ts` | `toHaveLength(37)`; `toHaveLength(154)` |

No pin of `apps/core-server`, `apps/core-web` or `apps/mobile` moved.

## 5. The generated document

Regenerated ONCE, at 2026-10-13 00:48:57 WIB, with `node --import tsx scripts/gen-openapi.ts` in `packages/shared`. State read first: `git status` showed `openapi/openapi.json` unmodified (the file of commit b7ed4c60, 1445768 bytes), so row 28 had not regenerated it. Generator line: `wrote openapi/openapi.json (all (committed): 99 operations, 2 security schemes, version 0.3.0; offline: 33 operations, 0 security schemes, version 0.2.0; 1457158 bytes)`. Against HEAD: 207 insertions, 24 deletions.

The generator builds from the whole tree, so the file also holds what row 28 had in `packages/shared/src/api/devices.ts` and `state-slices.ts` at that minute (the selector texts and the `MIC-NN` members: about 20 of the 24 replaced lines). If row 28 changed a schema after 00:48:57 the file must be regenerated once more by whoever lands last; the byte-for-byte test says so.

## 6. Checks

| Check | Command | Result |
|---|---|---|
| Contract and simulator, first run | `npx vitest run --maxWorkers=2` in `packages/shared` on `api-capture-discovery`, `sim-capture-discovery`, `api-registry`, `openapi`, `api-openapi-scope`, `api-examples`, `api-state-examples`, `api-domain-operations`, `api-text-rule`, `sim-api`, `sim-v2-parity` | `Test Files 5 failed, 6 passed (11)`, `Tests 10 failed, 229 passed (239)`: nine expected (the count pins of section 4, the stale generated file, flow 14) and one real finding (the `CAM-03` match of section 3) |
| The same, second run after the fixes and the regeneration | the same command | `Test Files 11 passed (11)`, `Tests 239 passed (239)` |
| No drift of the generated file | `openapi.test.ts` "matches the builder byte for byte", `api-openapi-scope.test.ts` AC-B-11 | passed in the second run |
| Web reading of the document | `npx vitest run --maxWorkers=2` in `apps/core-web` on `src/test/scalar-config.test.ts`, `live-api-reference-document.test.tsx`, `live-api-reference-page.test.tsx` | `Test Files 3 passed (3)`, `Tests 142 passed (142)` |
| Typecheck | `npm run -s typecheck` in `packages/shared`, `apps/core-server`, `apps/core-web`, `apps/mobile`, `apps/mock-core` | exit 0, each, one run |

Verification cell: "the operation count is unchanged" - M4-PIN-1 `[99, 36, 63]` passes untouched; "the body pins pass" - section 4, second run; "the search without a body answers as before in the simulator" - section 3, first line.

NOT RUN: `npm test`, `npm run test:db`, the acceptance suites of the Core (the controller's, per commit). Read, not run: `apps/core-server/test/acceptance/contract.test.ts:1004,1311,1348-1362` and `rbac-matrix.support.ts:764-765` send the FIRST request example of an operation with a body and expect a 400 for a body that is no JSON object; the first example of operation 93 is `{}` and the 400 is documented for that reason. Their answer on the changed contract is a prediction until the controller's run.

## 7. Driver decisions (for the controller to confirm)

1. **The schema holds the form, not the ranges.** The private ranges, the camera interface and the host's own addresses are the rule's; a pattern that also held the ranges would be a second copy of point 1 that can drift from the function.
2. **A new reason, `DISCOVERY_ADDRESS_NOT_ALLOWED`, on 422 INVALID_INPUT.** No document names the answer of a refused address. One reason for every refusal of the rule: the rule's own codes say which interface or address the host holds, so they are not carried to the client. Additive: no exhaustive map over `CaptureDiscoveryReason` exists (search of `apps`, `packages`).
3. **Web console only is a rule of the MEMBER, not of the operation (C10).** The operation keeps its access (`CAPTURE_CONFIG`, no condition), so a tablet and a phone search as before; `address` from such a session is 403 `WEB_CONSOLE_ONLY`. The pin "exactly the operations whose body carries a credential are web console only" therefore holds unchanged. Row 96 must decide it on the presence of the member, with one ACCESS_DENIED row.
4. **No port member.** The rule's port list is for the ONVIF service; a WS-Discovery probe has one port, and it is not the caller's.
5. **A typed address sent while the caller's own search is RUNNING is not probed** (the answer is the 200 of before). The conservative reading of "no second probe".
6. **The simulator applies a stand-in of the rule**, so that a client can show the refusal in Simulated mode; and its typed-address candidate can be tested and adopted by the unchanged operations 95 and 96 (AM-3: "a candidate like any other"). The device it leaves is `FAKE` / `DEVELOPMENT` and a demo reset removes it.
7. **The fixture candidate's REGISTERED match by address instead of by the id `CAM-03`** (section 3).

## 8. Requests left in `file_requests.md`

Four lines, none blocking for row 94: the live route of operation 93 has no body schema, so a Core accepts and ignores `address` until row 96 (blocking for row 96); the audit row has no key for "a typed address was probed" (open, the controller's); a stale comment in `apps/mobile/.../capture-discovery-port.ts:7`; count comments in `core-api.ts` / `sim/api.ts` not edited.

## 9. Double, and what stays unproven

The double is the in-app simulator: no socket, no packet, no rule. Unproven here: that a Core refuses the same cases with 0 packets (row 96, against the fake ONVIF device); that a real camera answers a unicast probe and yields a candidate (`9A/H-12`).

## 10. Requirement identifiers

F-11 (contract half: the permission of the search, the member web console only); AM-3 and U12 A7 (contract half: one typed address, probe-answer data only, stated in the contract text); S13-11 point 1, form half (the schema is no looser than the rule's literal); C10; SR-2 is untouched (no datagram code). Closed by row 96: the probe, the rule's refusals with 0 packets, the spacing.
