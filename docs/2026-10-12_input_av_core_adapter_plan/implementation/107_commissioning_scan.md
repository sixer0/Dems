---
task_slug: input_av_core_adapter_plan
row: 107
milestone: M10 / WP-19c
date: 2026-10-13
agent: coder-execution (wave 11, agent A2)
tier: T3
status: needs-review - operation 103 is routed, built and proven on doubles; the live scan waits for ONE call of the composition (requested), the two acceptance files are not proven green (row 116 in flight), and the design's WS-Discovery, ping and neighbour-table halves are not built (named in section 7)
closes_requirements: S13-11 for the scan (the one rule judges every address, 0 packets on a refusal); S13-12 (b) for the scan (device text in the answer only); the Core half of S13-10 for a scan (the temporary address is asked away on every way out); U9 (active, once, on request); U10 (stage 6, from the registry)
---

# Row 107 - the commissioning scan, operation 103 `scanFactoryCameras`

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`, `FS` = `CS/src/modules/capture-config/factory-scan`.

**Plain statement.** No camera, no network device and no helper was contacted; no address of any host was read or changed; no credential exists anywhere in this row. The camera is the fake ONVIF stub on 127.0.0.1; the temporary address is a recording double; the host is a table of interfaces written in the tests.

## 1. What was built

| Item | Where | What |
|---|---|---|
| Operation 103 | `FS/routes.ts` | `POST /api/v1/capture/network/scan` from its registry entry (`routeOfOperation`); optional strict body `{ address? }`; response held to `CameraFactoryScanSchema` |
| The scan | `FS/service.ts` (`scanFactoryCameras`) | the stored factory list plus ONE typed address; every address through the destination rule; one temporary address per /24, one at a time; the scan's OWN probe call; the result in memory only; one audit entry of counts |
| The gate | `FS/service.ts` (`createFactoryScanGate`) | one scan at a time per Core; 10,000 ms between two starts (`CAPTURE_DISCOVERY_MIN_INTERVAL_MS`, the rule's number) |
| The text rule | `FS/service.ts` (`announcedTextOf`) | a string only; the first 1,024 units read; control, invisible and direction characters and unpaired surrogates taken out; white space made one space; at most 120 characters |
| The door of the composition | `FS/index.ts` (`captureFactoryScanControl(app).provide(parts)`, once) | `parts` = `{ rule, alias, probe, mac? }`. Until it is called every scan is `409 COMMISSIONING_NOT_AVAILABLE` |
| The mount | `CS/src/modules/capture-config/index.ts` | one import, one export line, `mountCaptureFactoryScan(app)` after the mount of `network`, one header paragraph |

The folder opens no socket, starts no process, reads no file and no clock of its own, and logs only through its host: everything that touches the host or the network is a port.

## 2. The ports (`FactoryScanParts`)

| Port | Shape | Production value (requested, section 8) |
|---|---|---|
| `rule` | `(address, facts) => { allowed: true, destination } \| { allowed: false }` | `decideDestination` with purpose `COMMISSIONING_SCAN`, bound inside the capture unit |
| `alias.helper` | `() => Promise<string \| null>`; dials nothing | `transport.preflight()` of row 105 |
| `alias.add` / `alias.remove` | `({ address, minutes?, subject }) => { refusal, effect }` - the shape of row 105's caller | an adapter of 10 lines over row 106's lifecycle (`acquire` / `release`) |
| `probe` | `(destination, signal) => { answered, onvifReachable, endpointCount?, vendor?, model?, name? }` | the unauthenticated ONVIF time read (`createOnvifTimeReader().read(candidate, signal, sourceAddress)`) |
| `mac` (optional) | `(address) => string \| null` | not built (section 7) |

`destination` is the rule's own object, handed on unchanged: the folder makes no answer of the rule (static rule SR-2 (2) of the capture unit forbids it, and found my first draft).

## 3. The order of a scan

Each refusal sends nothing to any address, asks for no temporary address and writes no audit entry.

| # | Answer | When |
|--:|---|---|
| stage 6 | 401; 403 `NOT_PERMITTED` (`CAPTURE_COMMISSION`: INVESTIGATOR, SUPERVISOR); 403 `WEB_CONSOLE_ONLY` | before the body is used; one `ACCESS_DENIED` row each |
| stage 7 | 400; 422 `INVALID_INPUT` | a list, a range, a subnet, a port, an interface, a timeout, a name, a public or loopback address |
| 1 | 409 `CAPTURE_CONFIG_LOCKED` | a session is open (asked again before the first step and before every group) |
| 2 | 409 `COMMISSIONING_NOT_AVAILABLE` | not production capture; no parts handed in; the helper's check says "not on this platform" (macOS) or throws; the host's facts cannot be read |
| 3 | 409 `COMMISSIONING_JOB_IN_PROGRESS` | a scan runs |
| 4 | 409 `COMMISSIONING_HELPER_NOT_CONFIGURED` | any other word of the helper's check (no socket path, socket absent or unsafe) |
| 5 | 409 `COMMISSIONING_NOT_CONFIGURED` | no interface or subnet stored; the reader of row 108 answers null |
| 6 | 422 `COMMISSIONING_ADDRESS_NOT_ALLOWED` | the rule refuses the TYPED address. A refused STORED address is skipped and not counted |
| 7 | 429 `COMMISSIONING_SCAN_RATE_LIMITED` + `retry-after` | sooner than the spacing; a refusal 1 to 6 uses no spacing up |
| 8 | 409 `HOST_ALIAS_FAILED` + `details.cause` (a code) | a temporary address not confirmed in place. ONE audit entry `FAILED` |
| 9 | 200 `CameraFactoryScan`, `alias: null` | ONE audit entry `COMPLETE` |

**The temporary address.** An address outside the camera subnet is reached from `<its /24>.<aliasHost>`. It is judged twice by the rule: first on the host's facts with that ONE address supposed (so a refusal is known before the helper is asked), then, after `add` answered `refusal: null, effect: DONE`, on the facts the host states NOW. Only a target the second judgement admits with `viaAlias: true` and that very `sourceAddress` is dialled; if one target of the group is not, none is. An address already on the camera port that this scan did not add is never a source. Groups that need a temporary address run first, the camera subnet last.

**Audit entry** `CAMERA_FACTORY_SCANNED` (existing type): `outcome`, `addressCount` (addresses asked), `responderCount`, `failureReason` when failed, `operationId`, `permission`. Never an address, never a text. Written in a unit of its own after the scan; if it cannot be written the scan answers nothing.

## 4. Files

| File | Change |
|---|---|
| NEW `FS/index.ts`, `FS/routes.ts`, `FS/service.ts` | the folder |
| NEW `FS/__tests__/service.test.ts` | 75 cases (12 of them on the fake ONVIF stub) |
| NEW `FS/__tests__/routes.db.test.ts` | 8 cases on a booted Core |
| `CS/src/modules/capture-config/index.ts` | the mount (4 small edits) |
| `CS/src/modules/capture-config/__tests__/routes.test.ts` | `OTHER_UNITS`: one entry |
| `CS/test/acceptance/contract.test.ts`, `rbac-matrix.test.ts` | the deferral of operation 103 ended, by delta (section 6) |

Nothing of `packages/shared`, `capture/`, `capture-composition.ts`, `app.ts`, the schema or a static-rule list was edited.

## 5. Checks (2026-10-13; loopback and PostgreSQL runs with the command sandbox off; heavy-host lock per unit run with the stub, `.locks/db-migrate.lock` per database run, throw-away databases, "0 remain")

| Check | Command (in `CS`) | Result |
|---|---|---|
| Unit: the scan | `npx vitest run --project unit --maxWorkers=2 src/modules/capture-config/factory-scan/__tests__/service.test.ts` | run 1: did not parse - MY test file (three invisible characters stood in it as themselves; now written by number); run 2: `Test Files 1 passed (1)`, `Tests 75 passed (75)` |
| Unit: module, every static rule file, `test/static` | `... src/modules/capture-config test/static <the 29 static.test.ts files>` | run 1: `3 failed / 949 passed` - one MINE (`test/static/search-path.test.ts:94`, rule F53: a word in two of my message texts; reworded); run 2: `Test Files 2 failed / 52 passed (54)`, `Tests 2 failed / 950 passed (952)`. The 2 are not this row's: `src/credential-store/__tests__/static.test.ts:89` (names `src/capture-composition.ts`; decision C67 (3)), `src/modules/capture-config/__tests__/static.test.ts:175` (rule R-5 names `src/capture/host-alias/journal.ts`, `lifecycle.ts`: row 106) |
| Final unit run of my files and the rules they met | `... src/modules/capture-config/factory-scan src/modules/capture-config/__tests__/routes.test.ts src/capture/__tests__/static.test.ts test/static/search-path.test.ts test/static/imports.test.ts test/static/log-calls.test.ts` | `Test Files 6 passed (6)`, `Tests 189 passed (189)` |
| Database: operation 103 on a booted Core | `npx vitest run --project db --maxWorkers=2 src/modules/capture-config/factory-scan` | runs 1 and 2 failed in MY new test (the error log file does not exist before a first failure; the seed's own demo rows name addresses, so a search now reads what was written after a mark); final: `Test Files 1 passed (1)`, `Tests 8 passed (8)`; `0 remain` |
| Database: module boot, row 108's routes, the two files that walk every operation | `... capture-config.db.test.ts network/__tests__/routes.db.test.ts simulated-no-source-class.db.test.ts api-headers.outcome.db.test.ts` | `Test Files 4 passed (4)`, `Tests 50 passed (50)`; `0 remain` |
| The two acceptance files | `... test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts` (with my database file) | **NOT GREEN, two runs: `Tests 21 failed / 67 passed (88)`.** Every red read is operations 109 / 110 of row 116 (the registry holds 110, the pins of these files read 108). My area case "the commissioning scan" passes; the file's own report lists `scanFactoryCameras: 200; 400; 401; 403; 409; 422` as produced; no red names operation 103. NOT PROVEN by a run: my pins `router 107`, `routedDelta 19 / 3`, `cellsOf('SUPERVISOR')` - their cases stop earlier on the missing spec rows of 109 / 110 |
| Typecheck | `npx tsc --noEmit -p .` | exit 0 |
| Lint | `npx oxlint src/modules/capture-config/factory-scan src/modules/capture-config/index.ts` | exit 0 |

The row's verification cell:

| Cell | Evidence |
|---|---|
| against the stub a listed address is found with 1 scan entry | `service.test.ts`, stub block: the default-shaped list of four; the camera at `192.168.1.64` is the one device of the answer; `stub.httpRequests()` = ONE `POST GetSystemDateAndTime`, no Authorization header, no token; no RTSP and no discovery request; 0 violations; the temporary address gone |
| rows stored for a device that is not adopted: 0 | `routes.db.test.ts`: the row count of EVERY table of the public schema before and after a scan that found two cameras - one table differs, by 1, and its name holds "audit"; the same after a failed scan |
| a reply with oversized or control-character text reaches no log, detail or error | unit: canary, markup (`FAKE_ONVIF_MARKUP_TEXT`), NUL, escape sequence, direction mark, 8,000 characters - cleaned in the answer, absent from every note, persisted failure, audit entry and refusal, also when a probe THROWS that text as message, code and cause; database: the same against the real log (trace level), the persistent error log file and the audit trail |

Refusals with 0 requests at the stub (11 cases, `stub.httpRequests()` and `stub.requestLog()` both empty): session open; configuration absent; host without the camera interface; macOS (the PRODUCT seam `hostAliasSocketTransportOf({ platform: 'darwin' })`); helper not configured (the product seam, Linux without a path); not a production Core; typed loopback (the stub's own address), public, office network; a temporary address refused; a temporary address "done" but not on the camera port. In the pure block: 26 typed texts the rule refuses, each with no call at all.

The temporary address on every way out: confirmed and used; a probe that throws; a session that opens meanwhile; "done" but not in place; `add` unknown, throwing, or answering nonsense; an audit entry that cannot be written - the removal was asked in each.

## 6. Named deferrals ENDED (exactly the one of this row)

| File | Change, by delta |
|---|---|
| `CS/test/acceptance/contract.test.ts` | `LANDED_UNROUTED` / `UNROUTED_UNTIL` 5 -> 4 entries (`POST /api/v1/capture/network/scan`); the pinned literal of unrouted ids lost `scanFactoryCameras`; router routes 106 -> 107; two import lines; ONE new area case that produces 200 / 401 / 409 / 422 with real requests |
| `CS/test/acceptance/rbac-matrix.test.ts` | `DEFERRED_ROUTE` 5 -> 4; routed operations 103 -> 104; `routedDelta` INVESTIGATOR 18 -> 19, SUPERVISOR 2 -> 3; `cellsOf('SUPERVISOR')` gained `scanFactoryCameras` |

## 7. Not built, and what waits

| Not built | Why | Who |
|---|---|---|
| **The hand-over of the parts** | `capture-composition.ts` and the fence are other rows' | request 1; pass I-9 |
| **The unicast WS-Discovery probe per address, ping, the neighbour table** (specs F-4.1 row 8) | each needs a file inside the capture unit and a static-list entry (G-R9, G-R13, G-R2) | request 2. Until then on a production Core: `endpointCount` 1, `conflict` false, `vendor` / `model` / `name` null, `mac` null; a camera that answers ping but not ONVIF is not listed |
| `registeredDeviceId` | needs the hardware address first | request 2 |
| Memory of the last scan's conflict flag for row 111 (DR-6) | the scan keeps nothing between two calls | request 2, with row 111 |
| `alias` of the answer as the lifecycle's own state | **waits for row 106's real lifecycle**: today `null` by "this scan removed what it added"; a removal that was not confirmed is a persisted failure and a count in the log line, and operation 104 says what is on the port |
| The single flight shared with the set-network job | row 111 asks `captureFactoryScanControl(app).busy()`; a shared claim is its to add |

**What waits for row 106's lifecycle** (its interface read from `delegation_progress/row_106.md` and `lifecycle.ts`: `acquire` / `release`, not `add` / `remove`): the adapter of request 1 (b); the `HOST_ALIAS_REQUESTED` / `ADDED` / `REMOVED` rows of a scan (the lifecycle's, one pair per /24); its refusal while a session is open; its ruling D-1.

## 8. Requests left in `delegation_progress/file_requests.md` (five lines, all `row 107 (agent A2) | ...`)

1. THE PARTS (composition, one fence binding, one adapter export): blocking for the live scan.
2. What the scan does not do yet (controller).
3. Three sentences of operation 103's description that differ from what is built (agent A5).
4. The exact list of what I moved in the two acceptance files, and that they are not proven green (A5, A4, controller).
5. Two static reds in files of other rows.

## 9. DRIVER DECISIONS (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | The scan is a FOLDER of `modules/capture-config` (`factory-scan/`), mounted by one line there - I edited that index although the brief says "request lines for mounts" | `app.ts` is frozen (P25) and a module imports no other module, while the scan needs row 108's settings and reader; the brief also orders "route it and END its deferral", which a requested mount cannot do. Rows 70 and 108 took the same way |
| DD-2 | **No removal after an `add` that itself answered `NOT_DONE`** - the one departure from "ALWAYS asks for removal" | `NOT_DONE` is row 105's "certainly nothing changed". A removal then could only take away an address ANOTHER operation holds at the same place (a set-network job in that /24); over row 106's `release` it would take away whatever alias is open. Every other way out asks the removal |
| DD-3 | The scan removes its temporary address and answers `alias: null`; the contract's sentence says it is left in place | the brief's order; request 3 |
| DD-4 | An unconfirmed temporary address ends the WHOLE scan (409), also for a later /24 | a partial list would read as "no camera there". For a later group devices were already asked: the audit entry carries the count |
| DD-5 | A refused STORED address is skipped and not counted; only the TYPED address is a 422 | a list entry that lies in an office network today must not make every scan unusable; nothing is sent to it either way |
| DD-6 | An address already on the camera port, not added by this scan, is never a source | "confirmed in place" must be this scan's own confirmation |
| DD-7 | "Helper not available on this platform", no parts, not production, unreadable host facts: all `COMMISSIONING_NOT_AVAILABLE`; every other word of the helper's check: `COMMISSIONING_HELPER_NOT_CONFIGURED` | the contract's two reasons; fail closed |
| DD-8 | `details.cause` is the port's word only when it is a SCREAMING_SNAKE code, else one of three own codes | row 102 DD-8: a code, never a text of the helper |
| DD-9 | An empty list without a typed address answers 200 with nothing asked and one audit entry | the contract names no refusal for it |
| DD-10 | One address gets 2,000 ms; 8 at a time; at most 16 endpoints are stated | the reference's numbers (specs F-4.1 row 8); a bound for a device-stated count |
| DD-11 | Markup is not taken out of device text | the contract: "draw it as text only"; taking it out would be a second, weaker rule |
| DD-12 | The probe's errors are never read (no message, no stack persisted): a fixed text, a code and a count | what a probe throws may hold a device's words |
| DD-13 | `FactoryScanDestination` declares `sourceAddress?` / `viaAlias?` as unknown and checks them at run time | the form `stored-address.ts` uses; SR-2 (2) refuses any other declaration outside the rule's file |
| DD-14 | Three runs of my database file and two of my unit file | each repeat after a red in my own new test |

## 10. The doubles, and what stays unproven

| Unproven | Check |
|---|---|
| The parts handed in by the real composition; a booted `REAL_PRODUCTION` Core | pass I-9; rows 86, 88 |
| The dial really leaves from the temporary address on a host with several interfaces (the stub is reached from 127.0.0.1 through a mapping of the test) | `9A/H-13` |
| A real helper adding and removing the address around a scan; the address gone after a scan | `9A/H-05`, `9A/H-06` |
| A factory-new camera found from the stored list or from the typed address | `9A/H-13` (E-13) |
| Two cameras on one factory address (the conflict flag has no production input yet) | `9A/H-15` (E-15) |
| A green run of the two acceptance files | after row 116 |

Existing files were edited with the Edit tool only; new files were written with Write. Nothing was committed or staged.

---
*Generated: 2026-10-13*
