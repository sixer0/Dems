---
task_slug: input_av_core_adapter_plan
row: 108
milestone: M10 / WP-19d
date: 2026-10-13
agent: coder-execution (wave 10, agent N1)
tier: T3
status: complete for the row's own files (operations 101 and 102 live, the reader built and proven); the reader's MOUNT in the entry point is requested, not done (the file is another row's)
---

# Row 108 - read and write of `capture_network_config`, and the reader of the network facts

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`, `NET` = `CS/src/modules/capture-config/network`.

## 1. What was built

| Item | Where | What |
|---|---|---|
| Operation 101 `getCaptureNetworkConfig` | `NET/routes.ts`, `NET/service.ts` (`readNetworkConfig`) | the one row; an empty table answers the contract's defaults, `revision: 1`, no interface, no subnet, `updatedAt: null`. Answers on every Core |
| Operation 102 `updateCaptureNetworkConfig` | `NET/routes.ts`, `NET/service.ts` (`changeNetworkConfig`) | one unit of work of the engine: the row, ONE audit entry, the hand-over to the reader after the commit |
| The statements | `NET/store.ts` | `READ_`, `INSERT_` (first change; `ON CONFLICT DO NOTHING`), `UPDATE_NETWORK_CONFIG` (compare-and-set on `revision`); bind parameters only; run as `dems_app` (grants of migration 0018) |
| The network facts | `NET/facts.ts` | `networkFactsOf(stored, interfaces)` (the join), `readHostInterfaces` (the product's host reader: `os.networkInterfaces`, synchronous), `cameraSubnetAccepted`, `factoryAddressAccepted` (the forms of a write, asked of the destination rule) |
| The mount, the control, the reader | `NET/index.ts` | `mountCaptureNetworkConfig(app)`, `captureNetworkConfigControl(app)`, `captureNetworkFacts(app)` |
| The mount in the module | `CS/src/modules/capture-config/index.ts` | one import, one export line, `const network = mountCaptureNetworkConfig(app)`, `await network.load()` at the end of the existing boot step `capture.config` |

Audit type: `CAPTURE_NETWORK_CONFIG_CHANGED` - it EXISTS in the vocabulary (`packages/shared/src/sim/vocabulary.ts:449`) and in the Core's detail rules (`CS/src/core/audit-details.ts:449`: `changedFields` required, `revision` required, `operationId`, `permission` optional). No type was added; nothing of `packages/shared` was touched.

## 2. Operation 102: the order of its refusals

Each refusal stores nothing, writes no audit entry and hands nothing to the reader.

| # | Answer | When |
|--:|---|---|
| stage 6 | 401; 403 `NOT_PERMITTED` (`CAPTURE_COMMISSION`: INVESTIGATOR, SUPERVISOR); 403 `WEB_CONSOLE_ONLY` (a tablet or phone session, TECHNICIAN included) | before the body is used; one `ACCESS_DENIED` row each (the guard's) |
| stage 7 | 400 (no JSON); 422 `INVALID_INPUT` (outside the schema: a name as subnet, a public or edge factory address, 33 addresses, an unknown member such as a port, a gateway, a DHCP mode or a credential) | the contract's schema |
| 1 | 409 `CAPTURE_CONFIG_LOCKED` | a session is open; asked before the unit and again inside it |
| 2 | 409 `INVALID_STATE` / `COMMISSIONING_NOT_AVAILABLE` | the Core is not in production capture (`captureOperationOf(config) !== REAL_PRODUCTION`); also when a chosen interface cannot be judged because the host's table cannot be read (one persisted failure) |
| 3 | 409 `INVALID_STATE` / `REVISION_CONFLICT` (+ `currentRevision`) | the body's `revision` is not the stored one (1 for an empty table); also when the compare-and-set finds no row |
| 4 | 422 `INVALID_INPUT` / `NETWORK_CONFIG_NOT_ALLOWED` | a CHANGED setting is refused as a whole: an interface the host does not have (or a loopback interface), a subnet the destination rule does not accept (host bits), a factory address listed twice or one the rule does not class as a private host address |
| 5 | 200, unchanged revision, no entry | the body changes nothing |
| 6 | 200 | the row (first change: INSERT at revision 2; later: `revision + 1`), ONE `CAPTURE_NETWORK_CONFIG_CHANGED` entry with `changedFields` (names, comma-joined, the contract's order), `revision`, `operationId`, `permission`; then, after the commit, the reader's stored choice is replaced |

NO AUTOMATIC CHOICE: the host is read only to compare a name the body states and changes; never when the body states none, never by the read. Proven by a counter of host reads (`service.test.ts`, "NO AUTOMATIC CHOICE").

EVERY VALUE THROUGH THE RULE'S FORMS: the subnet and each factory address are asked of the destination rule itself, through the capture unit's stored-address binding (`storedCameraAddressRuleOf`) on a host that holds nothing: only the rule's answer `NO_CAMERA_SOURCE` ("the form is good, no source is there") passes. So private range, prefix 16 to 30 and "no host bit" are the rule's own bounds, not a second copy. The list bound (32) is the contract's schema and is checked again in the service.

## 3. The reader of the network facts

`captureNetworkFacts(app): CaptureNetworkFactsReader` = `() => DestinationContext | null` (types of `CS/src/capture/fence`). The same function at every call.

| Property | How |
|---|---|
| Synchronous, asked at every judgement | no promise, no I/O but the operating system's interface table |
| The stored choice is current | held in memory; LOADED by the boot step `capture.config` (`control.load()`, never rejects: a failed read is logged and persisted and the facts stay unknown); REPLACED by `unit.afterCommit` of the unit that commits a change - never for a unit that rolled back. No other code path of the Core writes the row |
| The host is current | the interfaces are read at EACH call (an address the camera interface gains or loses is seen at the next judgement) |
| null | no row; the interface or the subnet not chosen; the host has no interface of that name, or it is a loopback interface; a host fact that is no IPv4 address with a prefix length |
| throws | only what the host reader throws; `storedCameraAddressRuleOf` turns it into a refusal and one report |

The context it builds: `cameraSubnet` as stored (the rule holds it to its bounds); `cameraAddresses` = the camera interface's IPv4 addresses inside the subnet (`alias: false`) and its private addresses outside it (`alias: true`); `otherInterfaceSubnets` = the subnet of every address of every other interface; `hostAddresses` = every IPv4 address of the host.

PROOF (`service.test.ts` on a table of interfaces; `routes.db.test.ts` on the booted Core's own reader after a real commit): with the reader handed to `storedCameraAddressRuleOf`, `192.168.50.101` inside the configured `192.168.50.0/24` is `allowed` from `192.168.50.1`; `192.168.60.101` is `OUTSIDE_CAMERA_SUBNET`; an office-network address is `OTHER_INTERFACE_SUBNET`; the Core's own is `HOST_ADDRESS`; with null (no reader, a reader answering null, and each of nine "not configured" states) everything is `NOT_CONFIGURED`. After a committed change of the subnet the address that was allowed is refused at the next judgement and the other way round; after a unit that failed after its statement ran, the reader still answers from the old row.

## 4. Named deferrals ENDED (exactly the two of this row)

| File | Change, by delta |
|---|---|
| `CS/test/acceptance/contract.test.ts` | `LANDED_UNROUTED` / `UNROUTED_UNTIL` 8 -> 6 entries (the two `.../capture/network/config` keys); the pinned literal of unrouted operation ids lost `getCaptureNetworkConfig`, `updateCaptureNetworkConfig`; router routes 102 -> 104; block "no GET handler writes": unrouted reads `['getHostAlias', 'getCameraNetworkJob']`, routed reads 36 -> 37 (operation 101 is walked); ONE new area case "the camera network configuration" that produces 200 / 401 / 409 / 422 of the two operations with real requests |
| `CS/test/acceptance/rbac-matrix.test.ts` | `DEFERRED_ROUTE` 7 -> 5; routed operations 100 -> 102; `routedDelta` INVESTIGATOR 15 -> 17, SUPERVISOR 0 -> 2; `cellsOf('SUPERVISOR')` = the two operations |
| `CS/src/modules/capture-config/__tests__/routes.test.ts` | list `OTHER_UNITS` names the two routes the module mounts from its sub-folder (beyond the first claim; declared in the closing line) |

## 5. Checks (2026-10-13; database runs with the command sandbox off under `.locks/db-migrate.lock`, throw-away databases, "0 remain")

| Check | Command (in `CS`) | Result |
|---|---|---|
| Unit: facts, forms, both operations | `npx vitest run --project unit --maxWorkers=2 src/modules/capture-config/network/__tests__/service.test.ts` | run 1: `1 failed, 22 passed` - MY new test (a fixture operator id of the wrong form, `OP-0003`; the contract's is `OPR-nnn`); run 2: `Test Files 1 passed (1)`, `Tests 23 passed (23)` |
| Database: both operations on a booted Core, RBAC, the booted reader | `npx vitest run --project db --maxWorkers=2 src/modules/capture-config/network/__tests__/routes.db.test.ts` | `Test Files 1 passed (1)`, `Tests 12 passed (12)`; `0 remain` (one run) |
| Static rule files and the folder | `npx vitest run --project unit --maxWorkers=2 src/modules/capture-config/network test/static/imports.test.ts test/static/routes.test.ts test/static/network.test.ts test/static/logging.test.ts test/static/log-calls.test.ts src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts src/modules/capture-config/__tests__/static.test.ts` | `Test Files 9 passed (9)`, `Tests 172 passed (172)` |
| Other database files that walk every operation, and the module's boot | `... src/modules/devices/__tests__/simulated-no-source-class.db.test.ts src/engine/__tests__/api-headers.outcome.db.test.ts src/modules/rbac/__tests__/matrix.db.test.ts src/modules/capture-config/__tests__/capture-config.db.test.ts` | `Test Files 4 passed (4)`, `Tests 67 passed (67)`; `0 remain` |
| The two acceptance files | `... test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts` | NOT GREEN, two runs: `21 failed, 58 passed (79)`. My new area case passes; no unproduced status of the coverage list names operation 101 or 102. Every red read in the log is another row's in flight: operation 108 `testCaptureDeviceConnection` of agent V3 (the 107 pins, its unrouted literal, its spec row, the 401 / 403 / 405 walks that stop on it) and operation 100 of agent N2 (`READDRESS_ADDRESS_UNCHANGED` at `contract.test.ts:1043`, the one `routedDelta` cell 17 -> 18). NOT PROVEN by me: a green run of the two files |
| `test/static` as a whole, permission-guard pins | first wide unit run | `11 failed, 755 passed`: 1 mine (the `OTHER_UNITS` list, fixed; what is left of that case is N2's route of operation 100), 8 are the 107 pins of V3's operation 108, 2 are `test/static/credentials.test.ts` on the script `operator:set-password` (agent X1) |
| Typecheck | `npx tsc --noEmit -p .` | one line, not in a file of this row: `src/capture/fence/index.ts(717,120)` TS2322 `SystemBootDetails` (row 209 in flight). 0 lines in `modules/capture-config` |

## 6. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | The routes are a FOLDER of the existing module `capture-config` (`network/`), mounted by one line there | the profile says "routes of 107", which is not built; `app.ts` is frozen (P25) and a new module needs a waiver. Row 107 can move the folder under its module with one line |
| DD-2 | No boot step of its own: the load is one line at the end of the existing step `capture.config` | no step list and no pin moves. Consequence: it runs AFTER `capture.fence` (told to rows 85c / 88 in the request) |
| DD-3 | "Production capture on its Linux host" is read as the fence's one decision `REAL_PRODUCTION`; no platform check here | the host checks of the real entry own "Linux" (C46); a second platform rule here would be a second source |
| DD-4 | Only CHANGED settings are judged; a setting repeated unchanged is not judged again | "a setting that is absent is left as it is"; a console that sends the whole form back must be able to change the alias minutes while the camera port is unplugged |
| DD-5 | A loopback interface is refused as "an interface the host does not have" | it can never be a camera port; no new reason |
| DD-6 | A chosen interface that cannot be judged (host table unreadable) is `409 COMMISSIONING_NOT_AVAILABLE`, not accepted unjudged | fail-closed; the one documented 409 of the operation for "the Core cannot commission" |
| DD-7 | A private address of the camera interface OUTSIDE the subnet is stated as `alias: true`; a non-private one (link-local) only as a host address | it is what the host holds; the rule lets an alias be a source for the two commissioning purposes only, never for a stored camera or a typed probe. Row 106 may narrow "alias" to the helper's open row |
| DD-8 | An interface without any address is not in the operating system's table, so it cannot be chosen until it holds one | `os.networkInterfaces` lists addressed interfaces only; conservative. Hardware check `9A/H-05` |
| DD-9 | The first change inserts at revision 2 (the unwritten configuration is revision 1) | the optimistic lock must move with the first write |
| DD-10 | A boot load that fails does not stop the boot: logged, persisted, facts unknown (every stored address refused) | fail-closed without taking a simulated or development Core down for a table it does not use |
| DD-11 | `rbac-matrix.test.ts` and `capture-config/__tests__/routes.test.ts` were edited beside `contract.test.ts` | the same two deferrals are pinned there; without them the route cannot land |

## 7. Requests left in `delegation_progress/file_requests.md` (five lines, all `row 108 | ...`)

1. THE MOUNT (the writer of `src/index.ts` and its pin): `import { captureNetworkFacts } from './modules/capture-config';` and `composeProductionCaptureOf(app, { platform: process.platform, network: captureNetworkFacts(app) });` - with the boot-order note. BLOCKING for any stored production camera.
2. The same reader for the typed-address probe (one binder in the fence file and `typedAddressControl(app).provideRule(...)` in the composition - NOT one line in capture-discovery, so requested) and for operation 100 (`captureReaddressControl(app).provideNetworkFacts(captureNetworkFacts(app))`).
3. Row 197's own pins seen red (one `routedDelta` cell, one `OTHER_UNITS` entry, one reason at `contract.test.ts:1043`).
4. Agent V3: the reds of operation 108, and the exact list of what I moved in the two acceptance files.
5. The reset module: a demo reset empties the table without telling the reader.

## 8. The doubles, and what stays unproven

The host is a table of interfaces written in the tests; the operating system's table of this Mac is read in ONE case for its shape only (no value asserted, no address changed). The test Core is SIMULATED: "this Core accepts a change" is said with `replaceForTest`. No camera, no network device and no credential was involved; nothing was sent anywhere.

Unproven: the reader handed in by the real entry point (request 1) and a booted `REAL_PRODUCTION` Core (rows 86, 88); a real interface name and a real interface table on the Linux host (`9A/H-05`); a real camera inside the configured subnet (row 88's proof on hardware); a green run of the two acceptance files while operations 100 and 108 are in flight.

Existing files were edited with the Edit tool only; new files were written with Write. Nothing was committed or staged.

---
*Generated: 2026-10-13*
