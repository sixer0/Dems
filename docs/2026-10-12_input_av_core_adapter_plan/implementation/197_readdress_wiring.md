---
task_slug: input_av_core_adapter_plan
row: 197
milestone: M8 / WP-12
date: 2026-10-13
agent: coder-execution (wave 10, agent N2)
tier: T3
status: needs-review - the live path is built and proven on PostgreSQL with the fake ONVIF device; the two named deferrals of row 194 are ended; the two acceptance files are NOT green as a whole while operation 108 of row V3 is in flight (18 reds, none of operation 100), and on a production Core every confirmation answers 422 until the composition hands in the network facts (one request, blocking)
---

# Row 197 - the live path of operation 100 `confirmCaptureDeviceAddress`

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`, `CD` = `CS/src/modules/capture-discovery`.

## 1. What was built

| File | State | What |
|---|---|---|
| `CD/readdress-route.ts` | NEW | the route of operation 100 (built from its registry entry); `captureReaddressControl(app)` with `provideNetworkFacts(reader)`, `factsProvided()`, `replaceForTest`; `readdressRuleOf` (the rule on the injected reader); `readdressRefusedAnswer` (refusal -> the contract's answer); `engineDeviceReaddresser` (the door of row 196 as the seam takes it) |
| `CD/index.ts` | MOD | one import; the registration statement `registerCaptureReaddressRoute(app, { candidates })`; export lines: the control of the re-address, and `typedAddressControl` (record 096's request) |
| `CD/readdress.ts` | MOD | the header (it IS wired now); ONE constant `READDRESS_OPERATION_ID` and the member `operationId` in the audit entry (DD-2). The rule of row 97 is otherwise unchanged |
| `CD/__tests__/static.test.ts` | MOD | rule 6: `READDRESS_CALLERS` = the ONE route file; two new cases (the confirming request; its planted control); the import of the route file held to the module's plugin |
| `CD/__tests__/readdress.test.ts` | MOD | the audit member; two new describe blocks (7 cases): the rule on injected facts, the answer of every refusal |
| `CD/__tests__/readdress.db.test.ts` | NEW | 4 cases on one booted Core with the fake ONVIF stub |
| `CS/test/acceptance/contract.test.ts` | MOD | the deferral ended (section 4); the requests of operation 100 in the camera-search area; router count 104 -> 105 |
| `CS/test/acceptance/rbac-matrix.test.ts` | MOD | the deferral ended (section 4) |
| `CS/src/modules/capture-config/__tests__/routes.test.ts` | MOD | ONE entry of the list `OTHER_UNITS` (row 108's request line (2); DD-9) |

NOT touched: `src/capture-composition.ts`, `src/capture/**` (the camera adapter, the fence), `src/index.ts`, the sources of `modules/capture-config`, `packages/shared`. No operation, audit type or action was added; no count pin of those moved.

### The three seams of `readdress.ts`

| Seam | Given as |
|---|---|
| the caller's own candidate directory | the module's candidate state, asked with the SESSION of the request on the server clock; absent while the Core has no camera search (then `503 DISCOVERY_NOT_READY`) |
| the destination rule on the NEW address, before anything is written | `storedCameraAddressRuleOf` of the capture fence (the one binding of `decideDestination`, purpose `STORED_CAMERA`) on the INJECTED reader `CaptureNetworkFactsReader`, handed in through `captureReaddressControl(app).provideNetworkFacts(reader)` (once; a second is refused). No reader, a reader that answers null, a reader that throws: EVERY address is refused (the rule runs on the facts of a host of which nothing is known). The file holds no interface, subnet or address (static case) |
| the engine's door | `readdressCaptureDeviceIn` (row 196) inside the unit of the request |

### Answers (the contract of row 194; nothing is stored for any refusal)

| Status | Code, reason | When |
|---|---|---|
| 200 | - | `{ deviceId, device }`: the camera as the registry holds it now |
| 401 / 403 | stage 4 / stage 6 (role; `WEB_CONSOLE_ONLY`) | the guard's own answers and its one `ACCESS_DENIED` row |
| 422 | `INVALID_INPUT` | the body (stage 7) |
| 409 | `CAPTURE_CONFIG_LOCKED` | a session is open |
| 404 | `NOT_FOUND` | no registered camera of this id (checked at the route, DD-3); the candidate is unknown, expired or another session's - one answer |
| 503 | `NOT_READY`, `DISCOVERY_NOT_READY` | the Core has no camera search |
| 409 | `INVALID_STATE`, one of the six `READDRESS_*` | the strings of `ReaddressRefusal`; nothing is mapped (a test holds the two sets equal) |
| 422 | `INVALID_INPUT`, `DISCOVERY_ADDRESS_NOT_ALLOWED` | the destination rule refused, or no network facts; one sentence, never the address, never the rule's code |

### An open session and the camera adapter

The operation is refused while a session is open (`CAPTURE_CONFIG_LOCKED`, read before the unit and again inside it; row 97's rule 5). So no open session ever has its camera re-addressed: nothing is done to a running capture and the adapter is not told anything. The production camera adapter reads the stored address when it OPENS a camera (`READ_STORED_CAMERA` of the composition, one read per open) and holds the destination rule in front of every use of it (row 143): the next open after a confirmed change reads the new address. The adapter files were not touched.

## 2. Never automatic (the static rule of row 97, kept and extended)

- The closed list of callers holds ONE file, the route file; the maker and the function are named by no other production file of the Core server.
- NEW case: the route file makes the confirmation ONCE, from `request.body`, as the argument of the ONE call of the function, inside the handler of a route built from the registry entry; it holds no timer, hook or listener, no statement, no socket and no dotted quad.
- NEW control: a planted call with a made-up confirmation (a search's candidate), a second call from a listener, a call outside the handler and a timer are each reported.
- No file of the search path imports `readdress.ts` or the route file; the route file is imported by the module's plugin only.
- At run time: two searches that list the registered camera at a changed address write no address and no entry (database case 1).

## 3. Checks (2026-10-13; database and loopback runs: sandbox off, `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock` and `.locks/db-migrate.lock`, throw-away clones, "0 remain")

| Check | Command (in `CS`) | Result |
|---|---|---|
| The live path, one run | `npx vitest run --project db --maxWorkers=2 src/modules/capture-discovery/__tests__/readdress.db.test.ts` | `Test Files 1 passed (1)`, `Tests 4 passed (4)`, 22.20 s |
| Unit and static of the module | `npx vitest run --project unit --maxWorkers=2 src/modules/capture-discovery/__tests__/static.test.ts src/modules/capture-discovery/__tests__/readdress.test.ts` | `Test Files 2 passed (2)`, `Tests 51 passed (51)` |
| The wider unit set (module, `test/static`, capture and adapter static, engine pins, the guard) | `npx vitest run --project unit --maxWorkers=2 <those folders>` | `Tests 9 failed | 572 passed (581)`: 8 in `src/plugins/permission-guard/__tests__/` (107 -> 108: operation 108 of row V3, in flight) and 1 in `test/static/credentials.test.ts:88` that named another agent's file and passed alone a minute later (`Tests 13 passed (13)`); 0 in a file of this row |
| The last unit run | `... static.test.ts readdress.test.ts capture-config/__tests__/routes.test.ts devices/__tests__/routes.test.ts test/static/imports.test.ts` | `Tests 1 failed | 126 passed (127)`: the Device area list of `devices/__tests__/routes.test.ts` lacks `testCaptureDeviceConnection` (operation 108) |
| The search path and the stored matrix, unedited | `... --project db ... capture-discovery.db.test.ts src/modules/rbac/__tests__/matrix.db.test.ts` | `Test Files 2 passed (2)`, `Tests 45 passed (45)` |
| The two acceptance files, run 1 | `... --project db ... test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts` | `Tests 21 failed | 58 passed (79)`: 3 of this row (a case of my own that asked the product's rule too early; the pin `routedDelta` 17 -> 18; the 401 of operation 100 not reached), 18 of operation 108 |
| The two acceptance files, run 3 (a third run: the reds of run 1 were in this row's own new lines; run 2 was the same run written to a file) | same | `Tests 18 failed | 61 passed (79)`. All 18 name operation 108 `testCaptureDeviceConnection` (registry 107 -> 108, no route, no row in the composed document). The ledger line of operation 100: `200; 400 INVALID_JSON; 401 NOT_SIGNED_IN; 403 NOT_PERMITTED; 404 NOT_FOUND; 409 INVALID_STATE; 422 INVALID_INPUT` - every documented status produced by a real request; the camera-search area and "AC-B-16: every denied cell wrote exactly one row" pass |
| Typecheck | `npx tsc --noEmit -p .` | one error, `src/capture/fence/index.ts(717,120)` (row 209's file, in flight); 0 in a file of this row |
| Lint | `npx oxlint src/modules/capture-discovery test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts` | no finding printed |

The verification cell:

| Cell | Evidence (`readdress.db.test.ts`, a booted REAL_DEVELOPMENT Core, the lane's fake ONVIF stub on loopback behind the loopback guard) |
|---|---|
| a confirmed re-address writes 1 audit entry | case "CONFIRMED": 200; the rows after the request are exactly `['CAPTURE_DEVICE_ADDRESS_CHANGED']`, actor the technician, details exactly `deviceId, fromAddress, toAddress, reason: OPERATOR_CONFIRMED, operationId, permission` with the two IP literals (no port, no reference); the chain verifies; the same confirmation again: `409 READDRESS_ADDRESS_UNCHANGED`, still one entry |
| the next open of that camera uses the new address | the row and the engine's slice hold the new address (revision + 1); the statement the production camera adapter's reader runs at every open (`READ_STORED_CAMERA`) answered the old address before and answers the new one after, with the same endpoint reference; the next search lists the camera as registered with no changed address. The credential rows and the endpoint reference are byte-equal; NOTHING was sent (the stub's request log, the guard's connections and datagrams are unchanged across the request) |
| a candidate that is not the caller's and an address the destination rule refuses each answer their named code with 0 audit entries and the address unchanged | case "REFUSALS": the supervisor (who holds the permission) naming the technician's candidate: `404 NOT_FOUND`; the PRODUCT's rule, first with no facts and then on injected facts of a camera subnet, on the stub's loopback address: `422 INVALID_INPUT / DISCOVERY_ADDRESS_NOT_ALLOWED`, the body without the address or the rule's word. After each, and after a mismatched address (409), an unknown device (404), another camera (409), six bodies outside the schema (422), an INVESTIGATOR (403, exactly one more `ACCESS_DENIED` row) and no session (401): the row, the slice, the count of entries of the type, the credential rows and the endpoint reference are equal to before |
| the static rule of row 97 passes and fails on a planted call without a confirming request | section 2; `static.test.ts` rule 6, four cases |

Also: "LOCKED" - with a session open the request answers `409 CAPTURE_CONFIG_LOCKED` and writes nothing. Unit: the rule on injected facts refuses with no reader, a null answer and a throwing reader (told once), equals the binding row 97 was built against on eight addresses, and asks the reader at every judgement; every code of `ReaddressRefusal` has its answer and no answer carries an address or the rule's code. No log line holds the old address, the endpoint reference or the stub's account.

## 4. The two named deferrals of row 194: ENDED

| List | What left it |
|---|---|
| `LANDED_UNROUTED`, `UNROUTED_UNTIL` and the pinned literal of `CS/test/acceptance/contract.test.ts` | `'POST /api/v1/capture/devices/address/confirm'` / `'confirmCaptureDeviceAddress'` (6 -> 5 entries). The camera-search area produces every documented status of the operation with real requests; no response is faked. The literal router count moved 104 -> 105 |
| `DEFERRED_ROUTE` of `CS/test/acceptance/rbac-matrix.test.ts` | `confirmCaptureDeviceAddress`; routed operations + 1 (the pin reads 102 with row 108's two); `routedDelta` INVESTIGATOR 17 -> 18 |

NOT YET SEEN GREEN: the router count 105 (the expectation in front of it is red on operation 108; by count: 108 registry routes less 6 without a route plus 3 outside the registry) and the whole of both files, until row V3's step lands.

## 5. Requests (`delegation_progress/file_requests.md`, five lines of row 197)

1. BLOCKING for a re-address on a production Core: the composition's one statement `captureReaddressControl(app).provideNetworkFacts(captureNetworkFacts(app))`.
2. The typed-address probe of operation 93: NOT a one-line hand-over inside this module (no door hands `decideDestination` with the purpose `TYPED_PROBE` to a module), so not wired; `typedAddressControl` is exported now; the binder and the composition line remain.
3. Row V3: what I moved in the acceptance files, and the reds that are operation 108's.
4. Row 198 (the dialog): the address form and the repeat answer.
5. (in line 3) `OTHER_UNITS` of the capture-config route test gained my route.

## 6. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | A NEW file `readdress-route.ts`, not a block in `routes.ts` | the closed list of rule 6 names files: the search routes would otherwise be a caller of the re-address |
| DD-2 | The audit entry carries `operationId: confirmCaptureDeviceAddress` | row 97's DD-3 left it out "until an operation exists"; the sibling entries of the module carry theirs; the detail rule lists the key as optional |
| DD-3 | "No registered camera of this id" is answered 404 at the route, before the function | the contract's one 404; the function would answer `NOT_THE_REGISTERED_CAMERA` for a live candidate and an unknown device |
| DD-4 | Absent facts answer 422 (the rule refuses), not 503 | the task's "absent facts refuse (fail-closed)"; the same answer as a typed address on such a Core (row 96) |
| DD-5 | The door takes the FACTS READER, and binds the fence's function itself | the task's instruction; one binding of `decideDestination` in the tree stays one |
| DD-6 | `replaceForTest({ addressRule })` on the control | every camera double lives on loopback, which the product's rule refuses on any facts; the permissive rule is a value under `test/` (AD-02 (2)); static rule 4 keeps the call out of production |
| DD-7 | The candidate state is not rewritten after a confirmed change | the store is the search's; a repeat answers `READDRESS_ADDRESS_UNCHANGED`, the next search lists the camera where it is |
| DD-8 | Refused while a session is open; the adapter is not told | row 97's rule 5; section 1 |
| DD-9 | ONE list entry in `modules/capture-config/__tests__/routes.test.ts` although the brief keeps me out of capture-config | its owner asked for it by a request line; a test list, no source |
| DD-10 | A third run of the acceptance files | the reds of the first were in this row's own new lines |

## 7. The double, and what stays unproven

Doubles: the fake ONVIF stub of the lane on 127.0.0.1 (a search finds it, operation 96 adds it); the "move" is a fixture (the stored address set to 192.168.50.20 through the engine's door); the host facts are synthetic; the permissive rule of the confirmed case is `test/support/loopback-destination.ts`.

| Unproven | Where it closes |
|---|---|
| The PRODUCT's rule ADMITTING an address through the route (a candidate on a private camera subnet) - proven at function level only (row 97's cases and this row's unit cases) | a production Core with network facts; `9A/H-12` |
| A real camera that moved, and the next real open at the new address | `9A/H-12` |
| The 503 by a request, and a paired tablet's `WEB_CONSOLE_ONLY` in this row's own file (the guard's cells of the matrix cover the second) | the matrix file once green |
| The acceptance files green as a whole; the router count 105 | after row V3's step |
| The mount of the facts reader | request 1 |

EDIT-ONLY RULE: every existing source, test and document file of both rows was changed with the Edit tool; new files with Write. ONE BREACH, stated: the first claims line of these rows was appended to `delegation_progress/file_claims.md` with a shell append (one line at the end of the file; nothing else of it was touched). Nothing was committed, staged or stashed.

---
*Generated: 2026-10-13*
