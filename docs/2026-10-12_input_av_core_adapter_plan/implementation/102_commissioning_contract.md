---
task_slug: input_av_core_adapter_plan
row: 102
milestone: M10 / WP-23b
date: 2026-10-13
agent: coder-execution (batch 9, agent R5)
tier: T3
status: complete (contract only: no Core route, no job, no screen)
---

# Row 102 - the contract package of the commissioning operations (101 to 107)

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `SH` = `packages/shared`, `CS` = `apps/core-server`, `WEB` = `apps/core-web`.

## 1. The seven operations

All seven: tag Device, mode `simulated`, access `CAPTURE_COMMISSION` + `WEB_CONSOLE_SESSION` (`CAPTURE_COMMISSION_ACCESS`: TECHNICIAN only by decision U10, web console only), denial `ACCESS_DENIED`. The four writes are idle only (`409 CAPTURE_CONFIG_LOCKED`).

| # | operationId | Method, path | Body | Success | Audit on success |
|--:|---|---|---|---|---|
| 101 | `getCaptureNetworkConfig` | GET `/api/v1/capture/network/config` | - | 200 `CaptureNetworkConfig` | NONE-R |
| 102 | `updateCaptureNetworkConfig` | POST `/api/v1/capture/network/config` | `CaptureNetworkConfigUpdateRequest` | 200 `CaptureNetworkConfig` (Core only) | `CAPTURE_NETWORK_CONFIG_CHANGED` |
| 103 | `scanFactoryCameras` | POST `/api/v1/capture/network/scan` | `CameraFactoryScanRequest` (optional) | 200 `CameraFactoryScan` | `CAMERA_FACTORY_SCANNED` (+ `HOST_ALIAS_ADDED`, `HOST_ALIAS_REMOVED`) |
| 104 | `getHostAlias` | GET `/api/v1/capture/network/alias` | - | 200 `HostAliasState` | NONE-R |
| 105 | `removeHostAlias` | POST `/api/v1/capture/network/alias/remove` | none | 200 `HostAliasState` (Core only) | `HOST_ALIAS_REMOVED` (+ `HOST_ALIAS_REMOVE_FAILED`) |
| 106 | `setCameraNetwork` | POST `/api/v1/capture/network/cameras/address` | `CameraNetworkSetRequest` | 202 `CameraNetworkJob` (Core only) | `CAMERA_NETWORK_SET` (+ the alias rows, + `CAPTURE_DEVICE_ADDRESS_CHANGED`) |
| 107 | `getCameraNetworkJob` | GET `/api/v1/capture/network/jobs/{id}` | - | 200 `CameraNetworkJob` (Core only) | NONE-R |

Every audit type exists since row 19; no vocabulary step was needed. Nine schemas were added (`CAPTURE_COMMISSIONING_SCHEMAS`): the seven above, `HostAlias` and `FactoryCamera`.

### The configuration (101, 102): the one row of `capture_network_config` (schema set B; record of row 99)

| Member | Form in the contract | In the table |
|---|---|---|
| `interfaceName` | `^[a-z0-9][a-z0-9._-]{0,14}$`, nullable, NO default: the Core never chooses | the same pattern |
| `cameraSubnet` | `a.b.c.d/n` inside a private range, prefix 16 to 30, nullable | any IPv4 network, prefix 16 to 30 (the contract is narrower) |
| `factoryAddresses` | at most 32 private host addresses (below) | at most 32 texts of digits and dots (the contract is narrower) |
| `aliasHost`, `aliasMinutes`, `cameraIpStart` | 2..254, 5..480, 2..250 | the same |
| `revision`, `updatedAt`, `updatedBy`, `configured` | the optimistic lock, the last write, "both chosen" | `revision`, `updated_at`, `updated_by` |

Defaults are stated once (`CAPTURE_NETWORK_CONFIG_DEFAULTS`): the reference application's, carried and tested against no camera. The names of the six settings are `CAPTURE_NETWORK_CONFIG_FIELDS` (equal to the list of `CS/src/core/audit-details.ts`).

### Destination-rule forms (no looser than `CS/src/capture/destination-rule.ts`)

`CAPTURE_PRIVATE_HOST_ADDRESS_PATTERN`: ONE strict dotted quad inside `10/8`, `172.16/12` or `192.168/16`, host part 1 to 254. It is the form of the scan's typed `address`, of `fromAddress`, `toAddress` and `gateway` of the set-network job, of every factory address and of every address in an answer. It cannot even write what point 1 of the rule refuses: a name, a leading zero, a hexadecimal or octal part, a bare integer, IPv6, a mapped address, a port, a prefix, loopback, the unspecified address, link-local, multicast, broadcast, a public address, the first or last address of a /24 (36 texts in the test, each refused on all five request members). It is a subset of the typed address of operation 93. No member exists for a port list, a prefix length or a DHCP mode. What the form cannot hold (the camera interface, the Core's own addresses, another interface's subnet, a registered camera) is the rule's decision: `422` with ONE reason, `COMMISSIONING_ADDRESS_NOT_ALLOWED`, never the address.

### The set-IP job and its typed credential (106, 107; decisions C1, C7)

`credential` is the pair of operation 89, REQUIRED, typed for this one job on this one camera. The contract states: in memory until the set call and its own read-back end, at most 3 authenticated reads (`CAMERA_NETWORK_SET_MAX_AUTHENTICATED_READS`), never in a log line, an audit row, an error, a file, an argument or the environment, never reused, never echoed; adoption asks again. No answer schema has a member named credential, username, secret or password (tested by member name). The job states the three hardware addresses row 113 shows (`neighbourMac`, `authenticatedMac`, `confirmedMac`), a closed `state` (3), `step` (5) and `failure` (8 codes, among them `MAC_MISMATCH`). Wait 180 s, poll 4 s as contract constants.

`CREDENTIAL_CARRYING_OPERATIONS` = `setCaptureDeviceCredential`, `testCaptureCandidateConnection`, `adoptCaptureCandidate`, `setCameraNetwork` - the list the row asks for; a test holds it equal to the operations whose request schema holds the credential pair, and each is web console only.

### The alias helper as contract facts (C19; `scripts/host/netalias/dems-core-netalias`)

`HOST_ALIAS_HELPER` = request line at most 64 bytes, verbs `add` / `del`, prefix 24, minutes 5 to 480, ONE alias at a time. `hostAliasAddLine(address, minutes)` = `add <a.b.c.d>/24 <minutes>\n`, `hostAliasDelLine(address)` = `del <a.b.c.d>/24\n`; both throw `HostAliasLineError` (naming the rule, never the value) for anything outside the form - a second line, a prefix, a name, a public address cannot be put into one. A test READS the delivered helper file and holds `REQUEST_MAX_BYTES`, `MINUTES_MIN`, `MINUTES_MAX`, `MAX_MARKED` and the two usage lines equal to these facts. The interface is not in the line. The Core's configuration key of the socket is `DEMS_CAPTURE_ALIAS_SOCKET` / `captureAliasSocketPath` (row 105); unset = `COMMISSIONING_HELPER_NOT_CONFIGURED`.

### Each refusal with its sentence (`CaptureCommissioningReason`, `CAPTURE_COMMISSIONING_REFUSAL_SENTENCES`)

| Status, code | Reason | Sentence |
|---|---|---|
| 409 INVALID_STATE | `COMMISSIONING_NOT_AVAILABLE` | The camera network can be set up on a production Core only. |
| 409 | `COMMISSIONING_HELPER_NOT_CONFIGURED` | The address helper of this Core is not configured. |
| 409 | `COMMISSIONING_NOT_CONFIGURED` | Choose the camera interface and the camera subnet first. |
| 409 | `COMMISSIONING_JOB_IN_PROGRESS` | A scan or an address change is running. Wait until it ends. |
| 409 | `HOST_ALIAS_NOT_PRESENT` | No temporary address is in place. |
| 409 | `HOST_ALIAS_FAILED` (+ `details.cause`) | The temporary address could not be added. |
| 409 | `HOST_ALIAS_REMOVE_FAILED` (+ `details.cause`) | The temporary address could not be removed. |
| 409 | `CAMERA_ADDRESS_CONFLICT` | More than one camera answers at this address. Unplug all but one and scan again. |
| 409 | `CAMERA_NEW_ADDRESS_IN_USE` | Something already answers at the new address. |
| 409 | `CAMERA_NO_FREE_ADDRESS` | No free address is left in the camera subnet. |
| 422 INVALID_INPUT | `COMMISSIONING_ADDRESS_NOT_ALLOWED` | This address is not allowed for a camera. |
| 422 | `NETWORK_CONFIG_NOT_ALLOWED` | These network settings are not allowed. |
| 429 RATE_LIMITED (envelope) | `COMMISSIONING_SCAN_RATE_LIMITED` | Too many scans. Try again shortly. |

Reused: `REVISION_CONFLICT` (409, a stale `revision` of 102), `CONNECTION_TEST_LOCKOUT_GUARD` (429 of 106: the one lock-out guard counts this fourth credential-carrying operation), `CAPTURE_CONFIG_LOCKED`, `NOT_FOUND` (an unknown job), `WEB_CONSOLE_ONLY`. No sentence quotes an address, an interface or a credential (tested).

### The simulator: synthetic, and it changes nothing

| # | Answer |
|--:|---|
| 101 | 200: a fixed configuration whose interface is named `simulated0` |
| 102 | 409 `COMMISSIONING_NOT_AVAILABLE` for a body of the right form; 400 / 422 otherwise |
| 103 | 200: ONE device named "Test camera at a factory address (simulated)" with a locally administered MAC, `synthetic: true`, no temporary address; nothing is asked of any address |
| 104 | 200 `alias: null` |
| 105 | 409 `HOST_ALIAS_NOT_PRESENT` |
| 106 | 409 `COMMISSIONING_NOT_AVAILABLE`; the credential is dropped unread |
| 107 | 404 for every id |

Order as the Core's: the role (a SUPERVISOR is refused 403), the web-console condition (a tablet or phone app: 403 `WEB_CONSOLE_ONLY`), for a write the idle lock, then the body. Tested: after eight calls the WHOLE simulator state is the SAME object - no audit row, no event, nothing stored. Simulated mode and the demo data are otherwise as before (simulator and live suites: 0 other changed results).

## 2. Files

| File | Change |
|---|---|
| NEW `SH/src/api/capture-commissioning.ts` | forms, bounds, helper facts, reasons and sentences, nine schemas, seven operations, the simulator's two fixed values, examples |
| `SH/src/api/core-api.ts`, `examples.ts`, `index.ts` | the seven operations after 100, the nine schemas, the examples, one barrel line |
| `SH/src/sim/api.ts` | seven route lines, seven handlers, two helpers, one import block; the header comment |
| `SH/src/api/openapi.ts` | header comments (counts) |
| NEW `SH/test/api-capture-commissioning.test.ts` | 15 cases |
| `WEB/src/features/api-reference/try-it.ts` | ONE entry: `setCameraNetwork` joins the Try-it deny list (10 -> 11) |
| `docs/2026-10-07_dems_real_capture_sealing/masterplan/03_api_contract.md` | seven rows (101-107) in the table of section 2.6; one sentence of the permission row of section 2.1 |
| `SH/openapi/openapi.json` | regenerated ONCE, last, by the repository's generator |

## 3. Count pins moved (each by its delta, from the values after row 194)

Operations 100 -> 107; GET 36 -> 39; POST 64 -> 68; offline scope 34 -> 41; simulated 33 -> 40 (live 67 unchanged); paths 94 -> 100; registry schemas 174 -> 183, offline components 58 -> 66; one-permission rules 60 -> 67, rules with a permission 61 -> 68; operations with a condition 16 -> 23; Device tag 26 -> 33; request bodies 38 -> 41; schemas "added" 156 -> 165; Core-server-only statuses 28 -> 33; cookie-or-bearer 90 -> 97; examples of Core-answered operations 90 -> 97; operations no action reaches 55 -> 62; guard cells 900 -> 963, denied INVESTIGATOR 37 -> 44, SUPERVISOR 3 -> 10 (TECHNICIAN 34); web-only refusal rows TECHNICIAN 6 -> 13 (SUPERVISOR 6); Try-it denied 10 -> 11, allowed 90 -> 96; composed rows of section 2.6 8 -> 15, delta rows 25 -> 32.

The same files as row 194 (10 shared test files, 7 Core unit test files, 3 Core acceptance files, 3 web test files), plus `CS/src/modules/rbac/__tests__/matrix.db.test.ts`. No audit pin and no action pin moved. Counts after the row: 107 operations (39 GET / 68 POST), 78 audit types, 51 actions, 15 permissions.

`SH/openapi/openapi.json`, generator line: `wrote openapi/openapi.json (all (committed): 107 operations, 2 security schemes, version 0.3.0; offline: 41 operations, 0 security schemes, version 0.2.0; 1603550 bytes)`. Against the tree before: 3439 insertions, 224 deletions (it also carries the audit type of row 201 and operation 100 of row 194).

## 4. Named deferrals

ENDED by this row - all three of row 100 (`implementation/100_commissioning_permission.md`; `file_requests.md` line 231), each list is now the named, empty set:

| List | Was | Is |
|---|---|---|
| `NOT_YET_ENFORCED` of `CS/test/acceptance/rbac-matrix.test.ts` | `['CAPTURE_COMMISSION']` | `[]` |
| `NOT_YET_ENFORCED` of `CS/src/modules/rbac/__tests__/matrix.db.test.ts` | `['CAPTURE_COMMISSION']` | `[]` |
| `['CAPTURE_COMMISSION', []]` of `ENFORCED_AT` in `SH/test/api-registry.test.ts` | no operation | `[101, 102, 103, 104, 105, 106, 107]` |

ADDED by this row (each pinned by literal, fails when it drifts, names the row that ends it; no response is faked):

| List | Entries | Ended by |
|---|---|---|
| `LANDED_UNROUTED` / `UNROUTED_UNTIL` of `CS/test/acceptance/contract.test.ts` | the seven route keys of 101-107 | 101, 102: row 108; 103: row 107; 104, 105: row 106; 106, 107: row 111 |
| the same file, block "no GET handler writes" | the three unrouted reads `getCaptureNetworkConfig`, `getHostAlias`, `getCameraNetworkJob` are not walked (routed reads 36 of 39) | rows 108, 106, 111 |
| the same file, block API-13 | `setCameraNetwork body.credential.username`, `body.credential.secret` are not walked | row 111 |
| `DEFERRED_ROUTE` of `CS/test/acceptance/rbac-matrix.test.ts` | the seven operation ids, each with its row | the same rows |

Together with row 194's entry the Core has EIGHT unrouted operations (100 to 107); the router still holds 102 routes.

## 5. Checks (2026-10-13)

| Check | Command | Result |
|---|---|---|
| The new contract test | `npx vitest run --maxWorkers=2 test/api-capture-commissioning.test.ts` in `packages/shared` | first run `1 failed, 14 passed` - the failure was in MY new test (a description says "holds no credential"; the check now reads member names); second run `Test Files 1 passed (1)`, `Tests 15 passed (15)` |
| Shared contract, simulator, live, client and i18n suites, after the regeneration | `npx vitest run --maxWorkers=2 test/api- test/openapi test/sim- test/live- test/client test/i18n` | `Test Files 76 passed (76)`, `Tests 2078 passed (2078)` (the run before it listed one missed pin, `openapi.test.ts:248`, 99 -> 107) |
| Core unit pins | `npx vitest run --project unit --maxWorkers=2 src/plugins/permission-guard/__tests__ src/modules/devices/__tests__/routes.test.ts src/modules/stt-config/__tests__/routes.test.ts src/engine/__tests__/hosted-actions.test.ts` (sandbox off: loopback) | `Test Files 11 passed (11)`, `Tests 299 passed (299)` |
| Web pins | `npx vitest run --maxWorkers=2 src/test/live-api-reference-page.test.tsx src/test/live-api-reference-document.test.tsx src/test/scalar-config.test.ts` | `Test Files 3 passed (3)`, `Tests 144 passed (144)` |
| Acceptance and the rbac matrix on throw-away databases (`.locks/db-migrate.lock`, sandbox off) | `npx vitest run --project db --maxWorkers=2 test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts src/modules/rbac/__tests__/matrix.db.test.ts` | first run `Tests 4 failed, 103 passed (107)` - four cases of `contract.test.ts` that WALK every read and every free-text member (they called the unrouted ones); after the two named deferrals of section 4: `contract.test.ts` `Test Files 1 passed (1)`, `Tests 39 passed (39)`; the other two files passed in the first run; `0 remain` |
| The two other database files that walk every operation | `... src/modules/devices/__tests__/simulated-no-source-class.db.test.ts src/engine/__tests__/api-headers.outcome.db.test.ts` | `Test Files 2 passed (2)`, `Tests 4 passed (4)`; `0 remain` |
| Typecheck | `npm run -s typecheck` in `packages/shared`, `apps/core-web`, `apps/mobile`, `apps/transcriber`, `apps/mock-core` | exit 0, five of five |
| Typecheck | the same in `apps/core-server` | exit 2, ONE line: `src/capture/fence/index.ts(472,3)` TS2739 (the registry parts of row 85, agent R1, in flight); 0 lines in a file of this row. It was exit 0 after rows 194 and 195 |

Verification cell: "every count pin passes at the new number" - section 3 at 107; "every operation has a stated simulator answer" - the table of section 1, the description of each operation (a test matches the sentence) and flow 17 of `openapi.test.ts`, which produces every offline status of the seven through the simulator; "no live path exists yet" - no file under `CS/src` was edited by this row, and the eight unrouted operations are pinned by literal.

## 6. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | SEVEN operations: the six of the cell plus the alias state as a read of its own (104) | the brief names "the alias state"; the screen of row 112 shows it without a scan |
| DD-2 | All seven are web console only, the reads too | U10 and DR-8, DR-9; the brief: "TECHNICIAN only, web console only" |
| DD-3 | The scan answers synchronously (200 with the list); only set-IP is a job | a scan is seconds; the result is in memory only and has no id to read later |
| DD-4 | `CAPTURE_PRIVATE_HOST_ADDRESS_PATTERN` is NARROWER than the table's CHECK and than the typed address of operation 93 | "no looser than the destination rule": the private range and the /24 host part are in the form, so a stored list can hold nothing the rule would refuse by point 1 |
| DD-5 | "Not available on this host" and "helper not configured" are `409 INVALID_STATE` reasons, not `503` | one documented status the simulator can also give; the sound-card operations' `503` stays theirs |
| DD-6 | The configuration's stale revision reuses `REVISION_CONFLICT`; the lock-out of 106 reuses `CONNECTION_TEST_LOCKOUT_GUARD` | one meaning per reason; the guard is one guard (row 111) |
| DD-7 | The job is data of the operator session that started it, in memory; one 404 for unknown, foreign and "Core restarted" | the pattern of the candidates; C7: the credential lives in the job's closure |
| DD-8 | No interface name and no helper text in any refusal; `details.cause` is a CODE | SEC35-30; S13-08 (9) |
| DD-9 | The simulator's configuration is "configured" with an interface named `simulated0` | clearly synthetic and lets a screen be drawn; nothing can be written |
| DD-10 | `setCameraNetwork` joined the web's Try-it deny list (ONE product line in `WEB`) | AR-3a: an operation whose body carries a credential is never offered for Try-it; leaving it open until row 113 would be the weaker state |
| DD-11 | Seven rows and one sentence in the TASK-3 contract document | the acceptance matrix composes its expectation from that table (as pass I-2 and row 194) |
| DD-12 | Two more named deferrals in `contract.test.ts` (the unrouted reads, the unrouted free-text members) | the two walks call every operation; without a route the answer is the router's 404 |
| DD-13 | No i18n string | the screens of rows 112, 113 own their string groups; the contract's sentences are the table above |
| DD-14 | Whether set-IP must name an address of the caller's last scan is said in words only (`fromAddress`: "an address of the caller's last scan"), with no refusal reason of its own | the design asks only for the conflict flag of the last scan (DR-6); row 111 decides |

## 7. Requests seen in `file_requests.md` and NOT served by this agent (outside the four rows)

| Line | Asked of the shared writer | Why not here |
|---|---|---|
| row 212 (R10) | move the password policy into `SH/src/api/` | moves a Core file and its test; not one of the four rows |
| row 199 (R4) | `usbSerial`, `usbPort` on `CaptureAudioCard` | a contract change of operation 98, not one of the four rows; it would also be in the one regeneration |
| row 191 (R2), row 105 (R7), the controller's routing | audit types for a worker restart, `HOST_ALIAS_REQUESTED`, `HOST_ALIAS_ADD_FAILED` | the audit step of row 201 was closed, recorded and pinned at 78 before the routing arrived: NOT reopened; a third step is the controller's to route |
| row 146 (R3) | an operation for the stored-credential connection test | a new operation, not one of the four rows |

## 8. The double, and what stays unproven

The in-app simulator, pure schema tests and the delivered helper file read as text; no host address was changed, no helper was run, no camera and no network were contacted. Unproven: every Core route and job (rows 105 to 111), the screens (112, 113), the helper on a Linux host (`9A/H-05`), a factory-new camera (E-13 to E-15).

Existing files were edited with the Edit tool only; `openapi.json` was written by the repository's generator.

---
*Generated: 2026-10-13*
