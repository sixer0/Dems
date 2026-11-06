---
task: 2026-10-12_input_av_core_adapter_plan
row: 106b
milestone: M10 / WP-19b (the remainder of row 106; decisions C74, C78)
agent: coder-execution (driver)
date: 2026-10-13
tier: T3
status: needs-review - items (1) to (5) are built and green on doubles and on throw-away databases; ONE part of the mount is not wired in the product (the interface-file source of an `add`: section 7, request filed); eight driver decisions (section 9); UNPROVEN ON LINUX
closes_requirements: the Core half of S13-10 for a scan (the alias rows around every call, the removal on every way out, the removal at shutdown and at boot through the real composition); C74 D-1 at the route (a MANUAL removal is refused while a session is open); C78 DD-2 as ONE behaviour; C78 DD-3 (the member `alias`); U10 (operations 104 / 105: TECHNICIAN, web console only)
---

# Row 106b - the alias routes, the mount, the adapter, the scan's parts

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`.

**Plain statement.** The helper is a DOUBLE in every test: a transport that answers from a script. No `ip`, `arping`, `sudo` or other network command ran; no host address was read or changed; no socket of the helper was opened; no probe left this process (the scan's probe is a double wherever a scan runs to its end); no real device and no credential was touched. The instance on ports 4423 / 5178 was not touched. Nothing here is proven on Linux (section 8).

## 1. Item by item

| # | Item | State | Where |
|---|---|---|---|
| 1 | The routes of operations 104 `getHostAlias` and 105 `removeHostAlias`; their deferrals ended | DONE | NEW `CS/src/modules/capture-config/host-alias/` (`index.ts`, `routes.ts`, `service.ts`), mounted by one line of `modules/capture-config/index.ts`; `CS/test/acceptance/contract.test.ts`, `rbac-matrix.test.ts` |
| 2 | The mount: one lifecycle per app, its parts, `boot()` at the start, `shutdown()` at the close | DONE but ONE source (section 7) | `CS/src/capture-composition.ts` (`mountHostAliasOf`, section 10 of its header); the entry `src/index.ts` is UNCHANGED |
| 3 | The adapter between the scan's alias port and `acquire` / `release`, with C78 DD-2 as the one behaviour; `alias` of the answer from the lifecycle's state; the alias audit rows of a scan | DONE | NEW `CS/src/capture/host-alias/job-port.ts`; `factory-scan/service.ts` (member `state`, `aliasInPlace`) |
| 4 | The composition hands the scan its parts: operation 103 is live on a production Core | DONE on the helper double | `capture-composition.ts`; `CS/src/capture/fence/production-parts.ts` (`factoryScanRuleOf`, `factoryScanProbeOf`) |
| 5 | The two static reds | DONE: one fixed on the product side, one was already green | `capture/host-alias/lifecycle.ts`, `journal.ts` (the refusal code); `test/static/search-path.test.ts` needed nothing |

## 2. Operations 104 and 105

| # | Route | What it does |
|---|---|---|
| 104 | `GET /api/v1/capture/network/alias` | A PLAIN READ of the journal's one open row (`readHostAliasState` of the capture unit, with the Core's read on the pool). No helper, no write, no audit entry. It answers on EVERY Core and while a session is open: `200 { alias }` |
| 105 | `POST /api/v1/capture/network/alias/remove`, no body | `release({ removeReason: 'MANUAL', actor })` of the ONE lifecycle the composition handed in. The address is the lifecycle's own state |

Stage 6 (the registry entry: `CAPTURE_COMMISSION` + `WEB_CONSOLE_SESSION`) refuses every role but TECHNICIAN and every tablet or phone session before a handler runs.

The order of 105; each refusal but the last asks nothing of the helper and writes nothing:

| # | Answer | When |
|--:|---|---|
| 1 | 409 `CAPTURE_CONFIG_LOCKED` | a session is open (C74 D-1) - looked at by the route, again by the lifecycle, again inside the unit of the intent |
| 2 | 409 `COMMISSIONING_NOT_AVAILABLE` | not production capture, or no lifecycle was handed in |
| 3 | 409 `COMMISSIONING_JOB_IN_PROGRESS` | a scan runs |
| 4 | 409 `HOST_ALIAS_NOT_PRESENT` | none is in place (`removed: false`) |
| 5 | 409 `COMMISSIONING_NOT_AVAILABLE` / `COMMISSIONING_HELPER_NOT_CONFIGURED` | an alias is in place and the helper does not exist on this platform / cannot be reached as installed |
| 6 | 409 `HOST_ALIAS_REMOVE_FAILED` + `details.cause` (a CODE, never a text) | the helper was asked and did not remove it: ONE `HOST_ALIAS_REMOVE_FAILED` entry by the lifecycle, the row stays open, its retry is armed |
| 7 | 200 `{ alias: null }` | `HOST_ALIAS_REQUESTED` (before the call), then `HOST_ALIAS_REMOVED`, both `removeReason: MANUAL`, `operationId: removeHostAlias`, the technician as the actor |

The folder also registers the SHUTDOWN HOOK (section 3) and offers `captureHostAliasControl(app)`: `provide(lifecycle)` once, `provided()`, `available()`, `replaceForTest`.

## 3. The mount

In `REAL_PRODUCTION` only and only with the reader of the network facts (the facts are production-only, decision C76). Everything is inside the composing file's body: **the entry statement and `src/index.ts` are unchanged**.

| Part of the lifecycle | What it is handed |
|---|---|
| transport | `hostAliasSocketTransportOf({ platform: input.platform, socketPath: app.config.captureAliasSocketPath })` - the ONE caller of the seam in the product (the pin of `src/__tests__/host-alias-socket.test.ts` names it now). A test hands a double in as `aliasTransport` |
| host | the Core's clock, session state, read on the pool, the engine's unit of work with `scope.pending().session` and the audit chain, a report to the log AND the persistent error log (codes and counts) |
| the journal's store | the folder's own statements (`createHostAliasStore`, the default of the lifecycle) on the unit's connection |
| `network` | the SAME reader the destination rule is bound to (`input.network`) |
| `storedInterface` | `captureNetworkConfigControl(app).storedInterface()` - new, additive: the interface the network folder holds in memory |
| `fileInterface` | `input.aliasInterfaceFile`; **not wired in the product** - section 7 |
| `configuredCandidates` | `aliasCandidatesOfConfiguration` on `captureNetworkConfigControl(app).factoryList()` - new, additive: the stored factory list and alias host, read at the sweep; `[]` for no row |

Handed on through the doors that exist:

| Door | What |
|---|---|
| `captureHostAliasControl(app).provide(lifecycle)` | operations 104 / 105 and the shutdown hook |
| `captureFactoryScanControl(app).provide({ rule, alias, probe })` | operation 103 (section 5) |
| `app.readiness.addBootStep({ id: 'capture.hostAlias' })` | `boot()`. Added at composition, so it runs AFTER every step a unit registered (after `capture.config` loaded the network choice, after the engine started) and BEFORE the listener. It never stops a start. One log line of counts (`asked`, `attempted`, `stillOpen`, `stateRead`, `interfaceTableRead`), never an address; a warning and a persisted entry when a row is still open or the state could not be read |
| the `preClose` hook of `modules/capture-config/host-alias` | `shutdown()` at the close of the app |

**This platform (macOS).** The seam answers `NOT_AVAILABLE_ON_THIS_PLATFORM`. The boot step then does not call `boot()` at all and says so ONCE (`HOST_ALIAS_BOOT_SWEEP_NOT_ON_THIS_PLATFORM`, `asked: 0`); the scan and a removal of an alias in place answer `409 COMMISSIONING_NOT_AVAILABLE`; operation 104 still reads.

**Shutdown.** Fastify runs `preClose` hooks in the order of registration, so the engine has stopped when this one runs. The lifecycle's unit of work then falls back to `app.pipeline.run` (the pipeline closes after every `preClose` hook): the removal still writes its intent and its result. No session state can be read then; the unit answers "not idle", which refuses an `add` and a technician's removal and holds back no system removal.

## 4. The adapter (`hostAliasJobPortOf`) - C78 DD-2 in one place

| What happened to the `add` | Who asks the removal | The job is told |
|---|---|---|
| done | the job, in its `finally` (`remove`) | `{ refusal: null, effect: 'DONE' }` |
| nothing was sent (a session is open, the facts refuse, the helper cannot be reached, ...) | nobody | `NOT_DONE` |
| THE HELPER DEFINITELY REFUSED (a code that says nothing was added) | **nobody** | `NOT_DONE` |
| another alias is open (`ALIAS_ALREADY_OPEN`) | nobody - it is another operation's | `NOT_DONE` |
| `effect: UNKNOWN`: a bound exceeded, a broken connection, an answer not of the table, a result that was not recorded | **the lifecycle, at once, with its own intent and result entry** | `NOT_DONE` when that removal is on record as done; `UNKNOWN` when it failed too - then the job's `remove` asks the helper AGAIN and that is recorded too |

`effect: NOT_DONE` therefore always means "nothing of this job is on the camera port and nothing is left to take away". `remove` names an address and `release` takes away THE alias in place: the adapter asks a removal only when the alias in place IS the address named (none in place: "done", nothing asked; another address: `ALIAS_IN_PLACE_IS_NOT_THIS_ADDRESS`, nothing asked).

**What row 111 gets:** the same object - `productionHostAlias(app).jobs` (`HostAliasJobPort`), with `reason: 'SET_CAMERA_ADDRESS'`; one line of the composing file hands it to row 111's door (request filed).

## 5. Operation 103 live, and the member `alias`

- `rule`: `factoryScanRuleOf()` - `decideDestination` with the purpose `COMMISSIONING_SCAN`, on the facts the SCAN states (it judges each address twice). `probe`: `factoryScanProbeOf(timers)` - the unauthenticated ONVIF clock read FROM the source the rule named; a target without a source or of another form is not asked. Both in `capture/fence/production-parts.ts` (the capture unit is closed; the fence index is the way in). `alias`: the adapter of section 4.
- `alias` of the answer (C78 DD-3) is the lifecycle's state, asked ONCE after the scan's own audit entry: `null` after a scan that took every address away again; the address with its `removeError` when the removal of the LAST /24 was not confirmed (operation 104 then answers the same). Held to the contract's schema; a state that cannot be read is `null`.
- The audit rows of a scan are the lifecycle's, one pair per call: `HOST_ALIAS_REQUESTED` BEFORE the call, then `HOST_ALIAS_ADDED` / `HOST_ALIAS_ADD_FAILED`, `HOST_ALIAS_REQUESTED`, `HOST_ALIAS_REMOVED` / `HOST_ALIAS_REMOVE_FAILED`; then the scan's ONE `CAMERA_FACTORY_SCANNED`.

## 6. Checks (2026-10-13, in `CS`, `--maxWorkers=2`; database runs with the command sandbox off, under `.locks/db-migrate.lock`, on throw-away databases, "0 remain" each time)

| Check | Command | Result |
|---|---|---|
| Unit: the lifecycle, the adapter, the caller, rule R-5 | `npx vitest run --project unit src/capture/host-alias/__tests__/lifecycle.test.ts src/capture/host-alias/__tests__/caller.test.ts src/modules/capture-config/__tests__/static.test.ts` | run 1: `Test Files 3 passed (3)`, `Tests 93 passed (93)` |
| Unit: routes folder, module route list, static files, composition | `... src/modules/capture-config/host-alias src/modules/capture-config/__tests__/routes.test.ts ... src/capture/host-alias src/__tests__/capture-composition.test.ts test/static src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts src/credential-store/__tests__/static.test.ts` | run 1: `Test Files 26 passed (26)`, `Tests 486 passed (486)` |
| Unit: the composition file after the scan-binding case | `... src/__tests__/capture-composition.test.ts` | `Tests 34 passed (34)` |
| Database: the composition and the lifecycle | `... --project db src/__tests__/capture-composition.db.test.ts src/capture/host-alias/__tests__/lifecycle.db.test.ts` | run 1: 13 failed - 12 by `ReferenceError: provideRevisionSigner is not defined` at app build (another row's file mid-edit, gone in run 2) and the gap case of row 106, red since step V4 landed (section 9, D-5). Run 2: `Tests 1 failed / 19 passed (20)` - MY new case (rows of one instant read by their order; the Core's clock stands still). Run 3, the block alone (`-t "row 106b"`): `Tests 3 passed / 10 skipped` |
| Database: the two acceptance files | `... --project db test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts` | run 1: **`Test Files 2 passed (2)`, `Tests 82 passed (82)`** - no red remains in either file |
| Static set, last run | `... test/static <every src/**/__tests__/static.test.ts> src/capture/host-alias src/modules/capture-config/host-alias ...` | `Test Files 1 failed / 50 passed (51)`, `Tests 2 failed / 946 passed (948)`. Both reds in `src/capture/__tests__/static.test.ts`, neither names a file of this row: `:220` lists `src/capture/signer/host-key.ts:583, :585, :590`; the C46 case no longer finds its text in `src/capture/boot/index.ts`. Both were green in my run an hour earlier (request filed) |
| The scan's unit file and the socket seam's, the port-free cases | `... service.test.ts host-alias-socket.test.ts -t "what the lifecycle states\|the file itself\|the mechanism has one caller\|every refusal comes BEFORE\|the order of everything"` | `Tests 43 passed / 51 skipped` |
| The same two files IN FULL (the fake ONVIF stub on loopback; a local socket in a temporary folder) | `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock ... src/__tests__/host-alias-socket.test.ts src/modules/capture-config/factory-scan/__tests__/service.test.ts`, sandbox off | ONE run, after the last edit of either file (it waited for the lock most of the row): `Test Files 2 passed (2)`, `Tests 94 passed (94)` |
| Typecheck | `npx tsc --noEmit -p .` | 0 lines at the end. During the row, each in a file of another row in flight: `modules/capture-config/installation-acceptance/index.ts(129)`, `packages/shared/src/sim/api.ts(48)`, `packages/shared/src/api/capture-discovery.ts(1559)` |
| Lint | `npx oxlint <every changed file>` | exit 0 |

What the cases show, against the brief:

| Asked | Where |
|---|---|
| a MANUAL removal is refused while a session is open | `host-alias/__tests__/service.test.ts` (the route: the lifecycle is not asked; and the lifecycle's own word maps to the same answer); `lifecycle.test.ts` / `lifecycle.db.test.ts` (0 lines, 0 entries) |
| DD-2, both | `lifecycle.test.ts`, block "the port of a job": (a) two definite refusals - 0 `del` lines, 2 entries; (b) a bound exceeded, a broken connection, the helper's own "unknown", a transport that throws - exactly ONE `del`, 4 entries; and the removal failing too - UNKNOWN, a second `del`, 6 entries. Through the route on a booted production Core: `capture-composition.db.test.ts` (`ADDRESS_IN_USE`: `add` only; `TIMED_OUT`: `add`, `del`, 5 entries) |
| `alias` from the lifecycle's state | `factory-scan/__tests__/service.test.ts` (none; left in place; six values that are no alias; a state that throws; not asked on a refused scan); the booted Core (the last /24's removal fails: the answer and operation 104 name `192.168.0.253` with `HELPER_CONNECTION_LOST`) |
| the alias audit rows of a scan, the intent BEFORE the call | the booted Core: the double reads the trail when each line ARRIVES and finds the intent of that action committed; the trail of one scan is 2 x (`REQUESTED:ADD`, `ADDED`, `REQUESTED:REMOVE`, `REMOVED`) then `CAMERA_FACTORY_SCANNED` |
| `boot()` and `shutdown()` through the doors | the booted Core: a row a dead Core left is swept and closed `BOOT_SWEEP` by step `capture.hostAlias`; `app.close()` asks an alias in place away with its two entries, by no operator |
| macOS | the booted Core with NO double: ONE log line `HOST_ALIAS_BOOT_SWEEP_NOT_ON_THIS_PLATFORM`, the scan and the removal `COMMISSIONING_NOT_AVAILABLE`, 0 entries, the state still read |
| not production / no network facts | no lifecycle, neither door opened |

## 7. NOT BUILT - the exact remainder

| Not built | Why | What exists |
|---|---|---|
| **The product's source of `fileInterface`** (the ONE name in `/etc/dems/netalias-interface`, asked at every `add`: finding F-07) | It needs the host's command runner. `hostCommandRunnerOver(` has two pinned callers in agent S1's static file, the entry statement's members are pinned (row 157), and the runner the entry hands to the boot checks is not handed out again (`capture/boot` is agent K3's) | `interfaceFileNameOf`, `hostAliasInterfaceFileSourceOf(run, command)` (tested), and the input `aliasInterfaceFile`. UNTIL IT IS WIRED EVERY `add` IS REFUSED `INTERFACE_FILE_UNREADABLE` before the helper is asked - fail closed; removals, the sweep and the shutdown are not affected. Request line with the two ways to wire it |
| The hand-over of the job port to row 111 | row 111 is not built | `productionHostAlias(app).jobs`; request line |
| A database test of the routes folder of its own | the 16 caller columns of 104 / 105 are the RBAC matrix's cells (green), their statuses the contract file's area case (green), the live path the booted production Core's | - |

## 8. Unproven without the host

| Unproven | Check |
|---|---|
| Every call through the real socket; a real `del` at boot, at shutdown, at the end of a scan, by the technician | `9A/H-05`, `9A/H-06` |
| The shutdown removal inside the 10 s the entry gives a shutdown, with a helper that answers slowly (its own bound is 35 s) | `9A/H-06` |
| The interface file read through the host runner | after the request of section 7; `9A/H-05` |
| The scan's production probe leaving from the alias on a host with several interfaces; a factory-new camera found | `9A/H-13` (E-13) |
| Node's interface table lists the secondary address on Linux (source 2 of the sweep, and the scan's second judgement) | `9A/H-06` |

## 9. DRIVER DECISIONS (for the controller to confirm)

| # | Decision | Reason / alternative |
|---|---|---|
| D-1 | The shutdown is a `preClose` hook of the routes folder, and the lifecycle's unit falls back to the pipeline when the engine has stopped | A hook cannot be added after `ready()`; the call row 106 asked for in `src/index.ts` would move S1's entry pin, which the brief told me not to do. Measured on the booted Core |
| D-2 | The refusal code while a session is open is `SESSION_IS_OPEN` (was `SESSION_OPEN`) | Rule R-5 is right: that text is a credential reveal reason. The product changed; no list was widened. Not in the audit vocabulary (a refusal before the helper writes nothing) |
| D-3 | After an unknown `add` whose removal the lifecycle already made and recorded, the job is told `NOT_DONE` and asks no second removal | "A removal IS asked and its result recorded, as row 106's lifecycle does" (C78) - it is, once. A second one could only reach another operation's alias |
| D-4 | On a platform without the helper the boot step does not call `boot()` | A refused removal of an open row would arm five retries that cannot succeed. The row stays open and operation 104 shows it |
| D-5 | Row 106's "PINNED GAP" database case was turned into a passing case, and one unit title and one header paragraph of `journal.ts` reworded | The brief said to keep it while `aliasId` was required; step V4 landed in the tree during this row and its agent asked this row for exactly this change (request line `row V4 \| agent 106b`) |
| D-6 | Operation 104 reads on every Core with the module's own read; 105 and the scan need the composition's lifecycle | 104 documents no refusal but 401 / 403; a row can only exist where a lifecycle wrote one, but a database may outlive its Core's operation |
| D-7 | With none in place 105 answers `HOST_ALIAS_NOT_PRESENT` without looking at the helper | request line `row 106`'s mapping; nothing can be removed either way |
| D-8 | `capture/fence/production-parts.ts` and `modules/capture-config/network/index.ts` were edited (additive) | request line `row 107` names the binding in the fence file; `row 106` names the two sources in the network folder; the capture unit is reached only through that index |

FINDING for the controller (not a decision of mine): since step V4, EVERY production boot with a stored factory list writes two audit entries per address the list can produce (`HOST_ALIAS_REQUESTED`, then `HOST_ALIAS_REMOVE_FAILED` severity INFO, "nothing of the Core was there") - four per start with the default list.

## 10. Files

| File | Change |
|---|---|
| NEW `CS/src/capture/host-alias/job-port.ts` | the adapter |
| `CS/src/capture/host-alias/facts.ts`, `index.ts` | the interface-file source; two export lines |
| `CS/src/capture/host-alias/lifecycle.ts`, `journal.ts` | the value of ONE code each; one header paragraph |
| `CS/src/capture/host-alias/__tests__/lifecycle.test.ts`, `lifecycle.db.test.ts`, `caller.test.ts` | the new block (11 cases) and one facts case; the code's literal (6 places, the tool's `replace_all` on one literal per file); the gap case; one import pin by delta |
| `CS/src/capture/fence/production-parts.ts` | one export block, `factoryScanRuleOf`, `factoryScanProbeOf`, one import name |
| NEW `CS/src/modules/capture-config/host-alias/` | `index.ts`, `routes.ts`, `service.ts`, `__tests__/service.test.ts` (17 cases) |
| `CS/src/modules/capture-config/index.ts` | one import, one export line, one mount line, one header paragraph |
| `CS/src/modules/capture-config/network/index.ts` | `storedInterface()`, `factoryList()`, one label |
| `CS/src/modules/capture-config/factory-scan/service.ts` | the member `state`, `aliasInPlace`, two import names |
| `CS/src/modules/capture-config/factory-scan/__tests__/service.test.ts` | one rig option, one case, the count of `catch` 7 -> 8 |
| `CS/src/modules/capture-config/__tests__/routes.test.ts` | two entries of `OTHER_UNITS` |
| `CS/src/capture-composition.ts` | imports, two optional input members, section 10 (`mountHostAliasOf`, `productionHostAlias`), one statement in `composeProductionCaptureOf` |
| `CS/src/__tests__/capture-composition.test.ts`, `capture-composition.db.test.ts`, `host-alias-socket.test.ts` | one case; one block of three cases; the seam's caller pin |
| `CS/test/acceptance/contract.test.ts` | `LANDED_UNROUTED` / `UNROUTED_UNTIL` 4 -> 2; the literal of unrouted ids lost two; router 109 -> 111 (both lines); unrouted reads lost `getHostAlias`, walked reads 37 -> 38; one import line; ONE new area case |
| `CS/test/acceptance/rbac-matrix.test.ts` | `DEFERRED_ROUTE` 4 -> 2; routed operations 106 -> 108; `routedDelta` INVESTIGATOR 22 -> 24, SUPERVISOR 5 -> 7; `cellsOf('SUPERVISOR')` gained the two ids |

Not edited: `src/index.ts`, `src/capture/__tests__/static.test.ts`, `test/static/search-path.test.ts`, `capture/adapters/index.ts`, anything of `packages/shared`, `capture/boot`, `apps/core-web`.

## 11. Rules kept

Edit tool only for every existing file; new files with Write (the three files of the routes folder, its test, `job-port.ts`, the two documents). No scripted replace, no shell append. The claims line was the first act. Each list of the two acceptance files was re-read immediately before its Edit and moved by this row's delta only. No commit, no stage. No full suite. Throw-away databases under `.locks/db-migrate.lock`, "0 remain". No port bound and no process started by this row. `apps/input-av/data/` not opened; no `.env` read.

---
*Generated: 2026-10-13*
