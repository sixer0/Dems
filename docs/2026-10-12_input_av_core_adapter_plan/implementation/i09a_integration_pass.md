---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
row: integration pass I-9a (track D)
date: 2026-10-13
agent: coder-execution
status: needs-review - 8 items done, 3 not done by their own condition (4: the words do not cover it; 8: nothing to widen; 9: needs a file that is not mine)
---

# Integration pass I-9a - record (Tier 3, with the reasons of the three items not done)

Tree: branch `task4/input-av-core-port`, uncommitted work as found. Nothing committed, staged or reverted.
Every existing file was changed with the Edit tool only (small additive edits after a fresh read); the two
documents of this pass are new files. No scripted replace, no shell append.

## 1. The items

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Network facts, mount one (the entry's statement) | DONE | `src/index.ts`: one import line (`captureNetworkFacts` of `./modules/capture-config`) and the ONE statement is `composeProductionCaptureOf(app, { platform: process.platform, network: captureNetworkFacts(app) });`. The reader is handed in, never called at composition: `storedCameraAddressRuleOf` asks it inside each judgement. Proof: `src/__tests__/capture-composition.db.test.ts`, case "(1) the entry's statement" - with the stored choice LOADED before the composition, the host table was read 0 times at composition and exactly once per judgement; inside the subnet `allowed` (source 192.168.50.1), outside `OUTSIDE_CAMERA_SUBNET`; before the load, with the interface not chosen and with no row: `NOT_CONFIGURED` for everything, and the credential reader answers `CAPTURE_CREDENTIAL_ADDRESS_REFUSED`. The literal pin of the entry statement moved with it (`src/capture/__tests__/static.test.ts`, the entry-point case: three literals, one import line, one comment line; 11 -> 13 pinned lines) |
| 2 | Network facts, mount two (operation 100) | DONE | `src/capture-composition.ts`, `composeProductionCaptureOf`: `captureReaddressControl(app).provideNetworkFacts(input.network)` - once per app, in `REAL_PRODUCTION` and only when a reader was handed in, before the composition is recorded (a door that refuses throws: nothing is composed). Proof through the route, on a BOOTED production Core in the entry point's order (ready, composition, host facts, boot steps): `POST /api/v1/capture/devices/address/confirm` for a candidate at 192.168.50.31 answers 200, the row holds the new address, one `CAPTURE_DEVICE_ADDRESS_CHANGED`; for a candidate at 192.168.60.31: 422 `INVALID_INPUT` / `DISCOVERY_ADDRESS_NOT_ALLOWED`, the row unchanged, 0 entries |
| 3 | Network facts, mount three (typed address of operation 93) | DONE, no new rule kind | `src/capture/fence/production-parts.ts`: `typedProbeRuleOf(network, unreadable?)` beside `storedCameraAddressRuleOf` - `decideDestination` with `DestinationPurpose.TYPED_PROBE` (the purpose record 095 names; its decision 1: held to the camera subnet, never an alias) on the same injected reader, fail-closed the same way. Exported through the existing `export *` of the fence index (that file is unchanged). Composition: `typedAddressControl(app).provideRule(typedProbeRuleOf(input.network, ...))`. Proof: unit case in `src/__tests__/capture-composition.test.ts` (no reader / null / a thrower -> `NOT_CONFIGURED`, the thrower told of once per judgement; loopback refused for its class; a factory address is NOT reached through an alias); through the route on the booted Core: a typed address outside the subnet answers 422 and starts 0 searches, one inside answers 202 and the search carries the rule's own answer `{ address, port 80, sourceAddress 192.168.50.1, viaAlias false }` |
| 4 | `credential-store/__tests__/static.test.ts:89` | NOT ADDED - SR-7 does not cover it | see section 3 |
| 5 | Named entry SR-6 | DONE | `test/static/network.test.ts`: the stream-socket module joined `OUTBOUND_MODULE`; `OUTBOUND_EXEMPTIONS` gained `'src/host-alias-socket.ts'` with that one module, the comment is the request line's wording. The file was green before (23 of its tests) and is green after; no other production source imports the module (checked by search) |
| 6 | Schema pins behind the tree | NOTHING TO MOVE - 0 lines moved | both named lines already read `[11, 'dbc-12']` (`fence.db.test.ts:155`, `audio-cards/__tests__/routes.db.test.ts:157-159`; moved by an earlier writer). Search of `apps/core-server` for `dbc-9`, `dbc-10`, `dbc-11` and the `[8,` / `[9,` / `[10,` forms: every remaining hit is a migration-set file that states an OLD version on purpose (`test/db/set9..set12.db.test.ts`, the `contract-v8..v10-delta.ts` headers, comments of `contract-inventory*`, `catalog.db.test.ts`, `db/schema/*`, `db/commands/migrations.ts`) |
| 7 | `core/index.ts` export of `SYSTEM_BOOT_SIGNING_DETAIL_RULES` | DONE | one name added to the export line of `./audit-details`. `capture/fence/boot-key.ts` was NOT touched: its own table `MEMBER_FORM` stays, held equal value by value by the case "the two forms are the ones row 201 stated" of `fence/__tests__/fence.test.ts` (green) |
| 8 | `core/audit-writer.ts`, JSON null for the two members | NOTHING CHANGED - it enforces neither form | see section 3 |
| 9 | Port split of `camera-adapter-open.db.test.ts` | NOT DONE - needs a file that is not mine | see section 3 |
| 10 | Heavy-host lock around the case that starts `row046_adapter_listener.py` | DONE for the two real-worker cases | `camera-adapter-open.db.test.ts`: helper `underHeavyHostLock` (a child `/usr/bin/lockf -k -t 900 .locks/heavy-host.lock` holds the lock for the case and says one word once it has it; released when the case ends; skipped when an ancestor process is `lockf` on that lock, i.e. the header's RUN line), around `recordedThroughTheWorker` of the H.264 and HEVC cases; their timeouts grew by the wait. No in-process helper existed in the repository (the others wrap the whole command or re-start themselves, `test/e2e.py`). Both paths were run: under both outer locks 11 passed (27 s); the two worker cases alone under the database lock only, the lock taken by the file: 2 passed |
| 11 | Run bounds of the three fixtures | DONE | `row044_e12_search.py`: the 300 s alarm was there; added `RUN_BOUND_S`, `run_bound_s()` (the caller or `ROW44_RUN_BOUND_S` may ask for LESS, never more) and a WATCHDOG THREAD 20 s after the bound that ends the process without waiting for the main thread or for the handler's own cleanup (the likely cause of the 6-minute hold: the alarm handler cleans up before it exits). `row159_relay_hygiene.py`: states its own `RUN_BOUND_S = 240` and hands it to the engine. `row044_door_parent.mts`: a life bound of 330 s (`ROW44_PARENT_BOUND_MS` may ask for less): it says `life_bound`, kills its relay and ends with code 3 although its input is still open |

## 2. Files changed

| File | Change |
|---|---|
| `apps/core-server/src/index.ts` | one import line, the statement's second member, two comment lines, one header line |
| `apps/core-server/src/capture-composition.ts` | two import names (`captureReaddressControl`, `typedAddressControl`), one (`typedProbeRuleOf`); the two hand-overs in `composeProductionCaptureOf`; four header lines |
| `apps/core-server/src/capture/fence/production-parts.ts` | `TypedProbeRule`, `typedProbeRuleOf`; one type name in an import |
| `apps/core-server/src/capture/__tests__/static.test.ts` | the entry-point case only: the pinned lines of `src/index.ts` (DRIVER DECISION, section 4) |
| `apps/core-server/src/__tests__/capture-composition.test.ts` | one case (the typed binding), one import name |
| `apps/core-server/src/__tests__/capture-composition.db.test.ts` | one describe block of three cases, imports |
| `apps/core-server/test/static/network.test.ts` | SR-6: one module name, one entry |
| `apps/core-server/src/core/index.ts` | one export name |
| `apps/core-server/src/modules/capture-config/__tests__/camera-adapter-open.db.test.ts` | the lock helper and its two uses; a comment at `ONVIF_PORT` (the value is 8557 as before) |
| `apps/capture-worker/test-fixtures/row044_e12_search.py`, `row159_relay_hygiene.py`, `row044_door_parent.mts` | the bounds of item 11 |
| `delegation_progress/file_claims.md`, `file_requests.md` | one claims line; four request lines `pass I-9a` |

Not changed: `fence/index.ts`, `fence/boot-key.ts`, `core/audit-writer.ts`, `credential-store/__tests__/static.test.ts`,
`fence.db.test.ts`, `audio-cards/__tests__/routes.db.test.ts`, `test/support/onvif-odd-device.ts`, anything of agents A1-A5 and W1.

## 3. The three items not done, and why

**Item 4.** The red rule is rule 1 of the credential STORE: "the units that import this folder are the pinned list
`CREDENTIAL_STORE_USERS`. A new user is a decision: it adds exactly its one file here." SR-7 (decision C55, adopted
as built in C60) admits exactly two entries - rule R-6 `CAPTURE_CREDENTIAL_HOLDERS_IMPORTERS` and `EXPOSED` - and
says "nothing else of either list moves". It names the credential HOLDERS of the capture-config module, not the
store; a third list is not in its words. The import: `src/capture-composition.ts:86`
`import { coreCredentialStore } from './credential-store';`, used once, in the port `open`
(`opened.store.capture.open(deviceId, sealed)` after a `READY` test). It is the first production user of
`capture.open` outside the folder. What removes the red: a ruling that names the file in `CREDENTIAL_STORE_USERS`
with that one use; no listed user could offer the opener instead (the listed capture user is pinned to `seal`).

**Item 8.** `auditInputOf` calls `checkAllowList`, which returns at once for a type without a details rule;
`SYSTEM_BOOT` has none, and the file names neither `SYSTEM_BOOT_SIGNING_DETAIL_RULES` nor `fixedSeverityOf`.
There is no enforcement to widen. The open finding of rows 201 / 209 stands: a `SYSTEM_BOOT` entry of any other
writer than `systemBootDetailsOf` is unchecked; the enforcement, when written, admits JSON null for both members.

**Item 9.** `createOddOnvifDevice` refuses any port outside its closed list (8561, 8560, 8559, 8557, 8555) - seen
as `RangeError ... got 8571`, the whole file skipped. No port of 8565-8574 can be taken without
`test/support/onvif-odd-device.ts`, which is not in this pass's files (row 146b asked for the same list change).
The value was restored to 8557 and the file is green. The pair the item names no longer collides: A4 moved
`adopted-camera-test.db.test.ts` to 8555. Still on 8557 beside this file: `connect/__tests__/stream-test.db.test.ts`
and `minted-code.db.test.ts`.

## 4. Driver decisions (for the controller to confirm)

1. THE PIN OF THE ENTRY STATEMENT was moved by this pass although `src/capture/__tests__/static.test.ts` is not in
   the list of files: request line `row 108` names the pin as part of the one change ("the pin's three literals move
   with it"), and item 1 without it leaves the capture static file red. Only the entry-point case was edited.
2. THE TWO HAND-OVERS OF ITEMS 2 AND 3 ARE MADE IN PRODUCTION ONLY and only with a reader, inside
   `composeProductionCaptureOf` (the app-bound function), not as new members of `ProductionCapturePorts`. In any
   other operation the composition builds nothing, as its header says; a development or simulated Core keeps both
   doors closed (proved by a case), which is the answer those Cores gave before.
3. ITEM 10 covers the two real-worker cases, as the item says. The other cases of the four camera database files
   start the test camera on 8565 and the relay with no lock of their own (request line, information).
4. The watchdog of item 11 does not kill the run's children itself: it must not wait. The stand-in of the Core ends
   its relay when the driver's pipe closes and has its own life bound; the test camera ends with its input.
5. One run of `row159` used the number 901 inside `.cache/row159-hygiene/runs/` and its folder was removed by me
   afterwards, so that the summary of row 159 counts its 27 runs as before. The `row044` runs wrote to
   `.cache/i9a-row044/` (`ROW44_OUT`).

## 5. Checks (2026-10-13; database, loopback and process runs with the command sandbox off)

| Check | Command (from `apps/core-server` unless said) | Result |
|---|---|---|
| typecheck | `npx tsc --noEmit` | 0 errors (a first run during the pass named 2 lines of files in flight, both gone at the end: `capture/boot/__tests__/support.ts:83`, `capture-discovery/__tests__/adopted-test.test.ts:561`) |
| static rules | `npx vitest run --project unit test/static <every src/**/__tests__/static.test.ts> src/__tests__/capture-composition.test.ts --maxWorkers=2` | 45 files: 763 passed, 3 failed - none caused by this pass's edits beyond item 4 (section 6) |
| touched units | the composition unit file, `capture/__tests__/static`, `adapters/__tests__/static`, `test/static/network`, `src/core`, `fence/__tests__/fence.test.ts`, `src/__tests__/host-alias-socket.test.ts` | 14 files, 539 passed |
| composition on PostgreSQL | `/usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock npx vitest run --project db --maxWorkers=2 src/__tests__/capture-composition.db.test.ts` | 10 passed; "0 remain" |
| camera adapter, both locks | `(ulimit -c 0; lockf heavy-host; lockf db-migrate; ... camera-adapter-open.db.test.ts)` | 11 passed, 27 s; "0 remain" |
| the same, its own lock | the two worker cases with `-t`, database lock only | 2 passed, 9 skipped |
| row 44, one short case | repository root, `lockf heavy-host ... row044_e12_search.py run probe_wrong_password 1` | `PASS ... occurrences 0 in 11 places (74 samples) control ok relays left 0 6.9s` |
| row 44, the bound | `ROW44_RUN_BOUND_S=3 ... run stopped_at_the_25_s_bound 1` | `NO VERDICT: the run was ended after 3 s`, exit 3, 3 s; no fixture process left |
| row 159, one short case | `lockf heavy-host ... row159_relay_hygiene.py run usage_argument 901` | `PASS ... exit 2 occurrences 0 in 11 places (13 samples) control ok relays left 0 2.6s` |
| stand-in, the bound | `sleep 8 \| ROW44_PARENT_BOUND_MS=1500 node --import tsx .../row044_door_parent.mts` | `{"ev":"life_bound","ms":1500,"alive":false}`, exit 3 |

Not run: any full suite; the 42 / 69-run series; `fence.db.test.ts` and the audio-cards database file (not edited).

## 6. Reds seen that are not this pass's

| Red | Where | Area |
|---|---|---|
| `src/modules/capture-config/factory-scan/service.ts` is not in the list of places | `test/static/search-path.test.ts:94` | A2 (scan module) |
| `src/capture/host-alias/journal.ts`, `lifecycle.ts` write a reveal-reason text | `src/modules/capture-config/__tests__/static.test.ts:175` (R-5) | A1 (capture/host-alias) |
| `src/capture-composition.ts` imports the credential store | `src/credential-store/__tests__/static.test.ts:89` | item 4: a ruling (section 3) |
| seen once and gone: `factory-scan/service.ts` writes `sourceAddress` / `viaAlias` | `src/capture/__tests__/static.test.ts:406` (SR-2) | A2 |

## 7. What stays unproven

Everything is closed on doubles: the host interface table is a table of the test, the cameras are rows and a
scripted discovery adapter, no datagram left the process. Unproven on hardware: the reader on the real interface
table of the Linux host (`os.networkInterfaces`) with a real camera port, a typed probe and a confirmed re-address
against a real camera (hardware package, the commissioning checks of chapter 9A).
