---
task_slug: input_av_core_adapter_plan
row: 70
milestone: M4 / WP-07c
date: 2026-10-13
agent: coder-execution (batch 6, agent I)
tier: T3
status: needs-review
---

# Row 70 - the live path of the two microphone operations (98, 99)

Status is `needs-review` for ONE reason: the writer of the registry row of a microphone does not exist in the product (section 5, request 1). Everything else of the row is built, passes and compiles; the registration unit is proven with a stand-in registrar.

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`, `AC` = `CS/src/modules/capture-inputs/audio-cards`.

## 1. What was built

| File | State | What it is |
|---|---|---|
| `AC/index.ts` | NEW | The plugin `captureAudioCardsModule`, its control (`provideEnumerator`, `provideRegistrar`, `provideAdmission`, `ready`, `registrable`, `replaceForTest`), the host adapters over `app.engine.run`, the search ids, the admission with its log and error-log entry |
| `AC/routes.ts` | NEW | Operations 98 and 99 from their registry entries (`routeOfOperation`): permission and client kind are stage 6's |
| `AC/service.ts` | NEW | `searchAudioCards`, `registerAudioInput`, `createListingGate`; the shapes of the listing this module is handed; the seam `MicrophoneRegistrar` |
| `AC/statements.ts`, `AC/store.ts` | NEW | Two reads; INSERT and UPDATE of `capture_audio_inputs`. No statement writes `capture_devices` |
| `AC/__tests__/fixtures.ts`, `service.test.ts`, `routes.db.test.ts` | NEW | 13 unit cases, 17 database cases |
| `CS/src/modules/capture-inputs/index.ts` | MOD | one import, one call: the folder is mounted by the registered microphone module |
| `CS/test/acceptance/contract.test.ts` | MOD | `LANDED_UNROUTED` emptied (decision C31); one block that produces every documented status of 98 and 99; router pin 100 -> 102 |
| `CS/test/acceptance/rbac-matrix.test.ts` | MOD | `DEFERRED_ROUTE` emptied; routed 97 -> 99; denied cells of INVESTIGATOR 13 -> 15; a listing that finds nothing for the matrix |

NOT touched: `packages/shared`, `capture/adapters/**`, the three capture static-rule files, `capture/supervisor.ts`, `capture-session/index.ts`, `modules/devices/status.ts`, any schema or migration file. `CS/src/app.ts` and `CS/test/static/scaffold.test.ts` were edited and TAKEN BACK: both equal the committed file (`git diff --stat`: empty).

## 2. Structure, and the static rules that decided it

The first structure (a unit in `app.ts`, an import of the adapter index, an INSERT into `capture_devices`) made four rules red. No rule was amended; the structure was changed.

| Rule | What it forbids | Structure now |
|---|---|---|
| P25 (`CS/src/capture/__tests__/static.test.ts:508, :595`) | any line in `app.ts` that is not a waived one | no line in `app.ts`; the folder sits under `modules/capture-inputs/` and is mounted by it, as `capture-discovery/connect` is |
| imports rule 5 (`CS/test/static/imports.test.ts:399`) | a module importing another module's value | hence a sub-folder, not a sibling module |
| A-5 (`CS/src/capture/adapters/__tests__/static.test.ts:278`) | an importer of the adapter layer that is no wiring unit | no import of `capture/adapters`; the enumerator is handed in and `service.ts` states the shape it reads (`AudioCardEnumerator`; row 64's `CardEnumerator` satisfies it) |
| SEC35-41 (c) (`CS/src/capture/__tests__/static.test.ts:1040`) | an INSERT into `capture_devices` outside the fence's statement file | the registry row is written by a `MicrophoneRegistrar` handed in, inside the unit; the module's statements write `capture_audio_inputs` only |

## 3. Behaviour

Order of the refusals, both operations: 503 `NOT_READY` / `DISCOVERY_NOT_READY` (no enumerator; for 99 also no registrar) -> 409 `CAPTURE_CONFIG_LOCKED` (asked again inside the unit) -> 409 `AUDIO_CARD_SEARCH_IN_PROGRESS` -> 429 `AUDIO_CARD_SEARCH_RATE_LIMITED` (98 only). Then for 99 on the Core's OWN second listing: 404, 409 `AUDIO_INPUT_BEYOND_CARD`, 409 `AUDIO_INPUT_NOT_REGISTRABLE` (a guessed channel count).

The registration unit (one `app.engine.run`): registrar writes or re-enables the registry row -> input row inserted or refreshed -> ONE `CAPTURE_AUDIO_INPUT_CHANGED` entry through the shared builder -> after the commit the device is handed to the adapter registry (default: the fence's `admitDevice`; a failure is logged and persisted, never undoes the commit). An input that has a row is REENABLED; when the card behind the stored key announces another USB id the change is CARD_CHANGED.

Permission (plan review F07): `CAPTURE_CONFIG`, an existing stored permission of SUPERVISOR and TECHNICIAN. No permission row is needed; no migration was written or requested. U10 does not apply (no network function). C25: `capture_config` is neither read nor written (asserted).

AD-07: the listing's strings are used as returned; none is in an audit detail, a log line, an error-log entry or a refusal (swept in both test files). No helper argument is built here.

## 4. Evidence (database runs: sandbox off, `/usr/bin/lockf -k .locks/db-migrate.lock`, throw-away databases, "0 remain")

| Check | Command (from `CS`) | Result |
|---|---|---|
| Service, unit | `npx vitest run --project unit --maxWorkers=2 src/modules/capture-inputs ...` (with the rows below) | `Test Files 1 failed, 28 passed (29)`, `Tests 1 failed, 449 passed (450)`; the one failure is `test/static/search-path.test.ts:94`, agent H's `alsa-config-writer.ts` |
| The two capture static files, `test/static`, `permission-guard`, `capture-discovery` static | same run | all green but the line above; P25, A-5, SEC35-41 (c), imports rule 5: green, unchanged |
| Routes on PostgreSQL | `npx vitest run --project db --maxWorkers=2 src/modules/capture-inputs/audio-cards/__tests__/routes.db.test.ts` | runs 1 and 2: expectations of the test itself (the admission list, an error code, the spacing arithmetic); run 3: `Tests 17 passed (17)` |
| The module folder on PostgreSQL | `... --project db src/modules/capture-inputs` | `Test Files 2 passed (2)`, `Tests 21 passed (21)` |
| Acceptance files, alone, deferral removed | `... --project db test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts` | run 1: 2 count pins (router 100, denied cells 13); run 2: `Test Files 2 passed (2)`, `Tests 78 passed (78)` |
| Typecheck | `npm run -s typecheck` | exit 0 (final state) |
| Lint | `npx oxlint src/modules/capture-inputs test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts` | exit 0 |

Documented responses, each produced on PostgreSQL:

| Op | Response | Where |
|---|---|---|
| 98 | 200 | routes.db "operation 98"; contract block |
| 98 | 401, 403 (permission), 403 `WEB_CONSOLE_ONLY` | routes.db "who may call"; the acceptance walks |
| 98 | 409 `CAPTURE_CONFIG_LOCKED`, 409 `AUDIO_CARD_SEARCH_IN_PROGRESS` | routes.db; contract block (in progress) |
| 98 | 429 with `retry-after`, 503 (envelope level) | routes.db |
| 99 | 201 REGISTERED, 200 REENABLED, 200 CARD_CHANGED | routes.db; contract block (201, 200) |
| 99 | 400, 401, 403 x2, 404, 422 | routes.db; contract block and walks |
| 99 | 409 locked, 409 beyond the card, 409 in progress | routes.db; contract block (beyond) |
| 99 | 409 `AUDIO_INPUT_NOT_REGISTRABLE` | service.test only (a guessed count) |

Verification cell: registering one input twice yields 1 device (routes.db "200 REENABLED"); the unit rolls back as a whole on a failed second write (routes.db: 500, row counts and trail unchanged, nothing admitted, the next registration takes the same id); each change writes 1 `CAPTURE_AUDIO_INPUT_CHANGED` entry with the six closed keys and no device text. `assertRecordable` refuses the registered microphone (`SOURCE_KIND_NOT_RECORDABLE`), and a `USB_AUDIO` adapter that claims an opener is refused at registration.

## 5. Not built, and requests (`delegation_progress/file_requests.md`, four lines)

1. BLOCKING for the product: no registrar of a microphone exists. The engine's one action that adds a device takes a camera only (`packages/shared/src/sim/capture-registry.ts`), and rule SEC35-41 (c) admits no statement of a module. Consequence: operation 99 answers 503 on every Core today; "publishes `captureDevices`" and "assignable at once in the selector" are not proven (the test line "STATED GAP" measures it).
2. Nothing hands the enumerator in yet (row 85): operation 98 answers 503 on a production Core too.
3. The match of a stored input by USB id and port path, and CARD_CHANGED for a card on another port: row 156. `capture_audio_inputs` has no port column.
4. The profile line of row 70 names `app.ts` and a new module folder; the built place differs (section 2).

## 6. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | The folder is `modules/capture-inputs/audio-cards`, mounted by one call in `modules/capture-inputs/index.ts` (a file outside the profile line, claimed before the edit) | the only place the rules admit without an amendment |
| DD-2 | The registry row is a seam (`MicrophoneRegistrar`); without one, 99 answers 503 | SEC35-41 (c); the precedent is the adoption's registrar |
| DD-3 | Single flight AND the spacing of 98 are built here (`createListingGate`); a registration is not spaced | the contract documents both answers; row 156 keeps the match |
| DD-4 | Same key, another USB id = CARD_CHANGED | AD-07 (4): said, never silent |
| DD-5 | A card whose count is `ASSUMED` is refused 409 `AUDIO_INPUT_NOT_REGISTRABLE` | row 64 DD-6; the nearest documented reason |
| DD-6 | Stored `sample_bits` = the largest sample size the listing states, 24 when none | input-av stores a chosen size with default 24; the body has no such member |
| DD-7 | A failed listing answers 503, is persisted, writes no audit row | nothing was listed |
| DD-8 | Search id `DSC-` + 13 digits of the clock, strictly increasing per process | the form of operation 97 |
| DD-9 | Count pins moved in the two acceptance files (102 routes, 99 routed, 15 denied cells) and both got test parts through `replaceForTest` | they follow from the routes; C31 |

Deviation, stated: edits of this row's own NEW files were partly made by script; every pre-existing file was edited with the Edit tool.

## 7. The double, and what stays unproven

The Core of every test is SIMULATED with parts put in by `replaceForTest`; the host is a table of fixed listing texts; the registrar is a stand-in; the adapter is a class-C stand-in in a real production registry. Unproven: a booted `REAL_PRODUCTION` Core with the enumerator of row 85; a real card (`9A/H-07`); recording from a registered input (WP-13, `9A/H-08`).

## 8. Requirements

| Identifier | State |
|---|---|
| P12-F05 (c) | live path built; a registration in the product waits for request 1 |
| P12-F06 | closed for 98-99: both acceptance files pass with no deferral |
| P12-F07 | nothing needed: the permission is stored already |
| AD-07 (3) | built (single flight, spacing) |
| AD-07 (4) | the not-silent half built; the match by port is row 156 |
| C31 (DD-2 of pass I-2) | closed: `LANDED_UNROUTED` and `DEFERRED_ROUTE` are empty |

---
*Generated: 2026-10-13*
