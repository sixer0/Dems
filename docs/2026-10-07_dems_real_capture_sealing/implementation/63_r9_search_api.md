---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-09
agent: coder-execution
blueprint_row: 132
source_plan: identification/02_structured.md row 132; masterplan/03_api_contract.md sections 2.6, 3.1, 4, 5.2, 5.4, 10.1; decisions D86, D94, D95, D106, D114, D117
tier: 3
status: needs-review
---

# Row 132 - camera search and candidate list (R-9): the shared contract of operations 93 to 97, and operations 93 and 94 on the Core

Status `needs-review`. Everything this row owns is built and its tests pass. It is not `complete`
because of things only the coordinator can close (section 8): the acceptance walk
`contract.test.ts` is still red in 11 blocks that are not about this row's operations, the mobile
simulator line is an open request, and the device and browser checks belong to the gate.
No commit, no lockfile write, no new dependency, no migration, no real camera or real LAN probed
(D76), `.data/pg*.env` not read, no connection as `dems_admin`.

## 1. What was built

### 1.1 Part 1 - the shared contract (D106), `packages/shared`

| Piece | Where |
|---|---|
| Operations 93 `startCaptureDiscovery`, 94 `getCaptureDiscovery`, 95 `testCaptureCandidateConnection`, 96 `adoptCaptureCandidate`, 97 `rescanCaptureInputs`: registry entries, 8 schemas, value sets, audit detail builders, examples, simulator fixtures | `src/api/capture-discovery.ts` (new), wired in `src/api/core-api.ts`, `examples.ts`, `index.ts` |
| Bounds and the lift constant `CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED` | `src/api/capture.ts` |
| Access condition `WEB_CONSOLE_SESSION` (operations 89, 95, 96) and its reason `WEB_CONSOLE_ONLY` | `src/api/contract-model.ts`, `src/api/devices.ts` |
| Four audit types (`CAPTURE_DISCOVERY_SEARCHED`, `CAPTURE_CONNECTION_TESTED`, `CAPTURE_CANDIDATE_ADOPTED`, `CAPTURE_DEVICE_UNREACHABLE`) and their labels | `src/sim/vocabulary.ts`, `src/i18n/en/common.ts` |
| D117: camera `username` at most 120; camera `secret` 1 to 1024, never trimmed or altered (89, 95, 96) | `src/api/devices.ts`, `src/api/capture-discovery.ts` |
| `CaptureDeviceStatus` with OPTIONAL `adapter` and `sourceClass` | `src/api/state-slices.ts`, `src/sim/types.ts` |
| INTERNAL simulator action `registerCaptureDevice` and its transition | `src/sim/capture-registry.ts` (new), `src/sim/actions.ts`, `src/api/sim-actions.ts`, `src/live/source/bindings.ts` |
| Simulator REST facade: operations 93 to 97; operation 89 with the web-console refusal; operations 78 to 80 through the hosted action `setCaptureConfig` (D106 (3)) | `src/sim/api.ts` |
| Account-name rule of the redaction (SEC35-36) | `src/api/redaction.ts` |
| `openapi.json` regenerated (no version step) | `openapi/openapi.json` |

Totals, measured: 97 operations (36 GET, 61 POST), 67 audit types, 40 error codes, offline scope
31, 6 access conditions, Try-it deny list 10, 48 simulator actions (5 internal).

### 1.2 Part 2 - the Core server, `apps/core-server`

| Piece | Where |
|---|---|
| Stage 6: `WEB_CONSOLE_SESSION` gives 403 `NOT_PERMITTED`, `details.reason: WEB_CONSOLE_ONLY`, one `ACCESS_DENIED` row, before the body is read | `src/plugins/permission-guard/decision.ts`, `denial.ts` |
| The module: bounds, the per-session candidate store, the registered-camera lookup, the search runner (the ONE `.discover(` call), routes of 93 and 94, the plugin and its control | `src/modules/capture-discovery/limits.ts`, `store.ts`, `registered.ts`, `search.ts`, `routes.ts`, `index.ts` |
| Adoption of a candidate into the registry: the engine's in-unit door plus one `UPDATE` of the row it wrote | `src/modules/capture-discovery/adoption.ts`, `src/engine/internal-actions.ts` (new), `src/engine/host.ts`, `src/engine/index.ts` |
| Mount of row 142's connect routes (95, 96, 89) with the candidate directory, the connection tester and the registrar | `src/modules/capture-discovery/index.ts` |
| Read-back of an adopted camera with `adapter`, `sourceClass` | `src/db/mapping/rows.ts` |
| Barrel exports of the discovery adapter and of the connection tester | `src/capture/adapters/index.ts` |
| Server-native audit allow-list: 4 types more (23) | `src/core/audit-details.ts` |
| `app.ts` (D114): one header line, two imports, two `UNITS` entries (waived edits 19 to 22) | `src/app.ts` |
| Fixture rows of the four new audit types (the bulk fixture's "mix" rule) | `src/db/fixtures/operations.ts` |

Behaviour of operation 93, in the order of its refusals: no adapter (a Core that does not run real
capture and was given none) `503 NOT_READY`; `RECORDING` with the lift off `409`; the caller's own
running search `200 created: false` with no second probe; another running search `409
DISCOVERY_IN_PROGRESS`; a bound reached `429` with `retry-after` (MANUAL searches only). A search
that could not run is `FAILED` with a reason, never an empty list. "Already registered" is the
`onvif_uuid`, else the whole address. A list lives in memory for its owner session until its
`expiresAt`, the owner's next search, the owner's sign-out, or the end of the process.

## 2. Row 133's needs (coordinator message 2)

- Every closed search calls `captureNotices(app).notifier.searchClosed(...)`; the module hands the
  pre-check gate `captureNotices(app).provideDiscovery(precheckSearch)`.
- db test `capture-discovery.db.test.ts`: an empty search writes its one row and raises ONE
  situation-A alert; a second empty one leaves one; a search with a responder clears it; a failed
  search does neither. The pre-check search runs once, carries trigger `PRECHECK`, runs for an
  operator without `CAPTURE_CONFIG`, and takes no place in the operator's allowance.
- Row 133's `no-device.db.test.ts` passes on the mounted app (operation 97 answers on a booted
  server). Its support and that test were adapted in the smallest way: no own registration; the
  stand-in is a spy on `captureDiscoveryControl(app).precheckSearch`.

## 3. Row 142's four items (coordinator message 3)

1. Adoption action: INTERNAL `registerCaptureDevice` (shared) and `registerCaptureDeviceIn(scope,
   device)` (server). The device row, the slice republish, the credential and the audit rows are one
   unit. `CaptureDeviceStatusSchema` carries `adapter` and `sourceClass`.
2. Barrel export of the connection tester; the mount lines in the plugin; one
   `CREDENTIAL_STORE_USERS` entry (`connect/index.ts`).
3. D117 as in section 1.1; test `packages/shared/test/api-capture-discovery.test.ts` (a secret with
   leading and trailing spaces parses unchanged on 89, 95 and 96).
4. Redaction rule with tests in `packages/shared/test/redaction.test.ts`. One EXISTING expectation
   changed by the rule: `user` beside `password` is now blanked.

One addition to row 142's code, made to keep its db test alive on the mounted app:
`CaptureConnectControl.replaceForTest(parts)` in `connect/index.ts` (candidates, tester, registrar,
limits). `connect.db.test.ts` uses it in place of its own second registration. A static rule holds
that no production file calls it.

## 4. Real, and stand-in

| Thing | In the tests |
|---|---|
| PostgreSQL, the engine, every stage of the server, the audit chain | real (throw-away databases, `dems_app`; read as `dems_owner`) |
| The discovery adapter of row 131 | real, on the loopback fixture of row 60's fake ONVIF stub (127.0.0.1); and a scripted one where the window is closed by hand |
| The connection tester of row 142, the Core credential store | real, against the stub with a fixture account made in the test |
| The camera | row 60's stub. No real camera, no multicast group, no LAN |
| The capture path in the recording check | the production supervisor on the fake worker of the test support |
| The clock of the bounds | the manual server clock |

## 5. Checks and results

Commands (db runs with the sandbox off, one at a time, under the lock):
`npx vitest run --root apps/core-server --project unit <paths>`;
`/usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server -- <paths>`;
`npx vitest run --root packages/shared`; `node --import tsx packages/shared/scripts/gen-openapi.ts --check`.

| Check | Where | Result |
|---|---|---|
| Shared contract, all of `packages/shared` | 82 files | 2251 passed, 0 failed; `gen-openapi --check`: up to date, 97 operations |
| Bounds and store; search runner | `limits-store.test.ts`, `search.test.ts` | 12 and 15 passed (fake clock) |
| `M4-DISC-TRIG-1`, `M4-DISC-RBAC-1`, `M4-AUD-1`, `M4-DISC-LIFE-1`, `M4-SEC-RATE-1`, situation A, the pre-check search | `capture-discovery.db.test.ts` | passed |
| `M4-DISC-STUB-1` runs 1 and 2: N = 1 gives one NEW candidate, N > 1 on one address gives the conflict; datagrams to 127.0.0.1 only | same file | passed; control: a silent stub gives 0, the same assertion |
| The whole flow once, N = 1: 93 -> 95 -> 96 -> 79 | same file | passed: `CAM-03` stored with `adapter_kind FAKE`, `transport RTSP`, `onvif_uuid`, profiles; devices +1 and credentials +1; slice and operation 77 hold it; repeat adoption 409; another session 404 with 0 requests to the stub; audit order SEARCHED, TESTED (95), TESTED (96), CREDENTIAL_SET, CANDIDATE_ADOPTED, CONFIG_CHANGED; chain verifies; the fixture account is in no row, log line or answer |
| `M4-SEC-DISC-1`, booted-Core form | same file, block "searches during RECORDING" | PASS, 2 runs: nine hostile answer modes of the stub through operation 93 (wrong `RelatesTo`, foreign address, no address, two matches, empty, oversized, entity expansion, not XML, flood of 300): every search ends `COMPLETE` and validates; 0 uncaught errors, 0 unhandled rejections, the same process |
| `M4-SEC-DISC-3`, booted-Core form | same block | PASS, 2 runs: a session in `RECORDING`, the supervisor's fragment checkpoints contiguous and arriving during every search (more than 100 per search, more than 1,000 per run), 0 `CAPTURE_FAULT`, no worker lost, clean stop; control: a gap reads "not contiguous" |
| Operation 94 on a real listener | same file | passed |
| Row 133 `no-device.db.test.ts`, row 142 `connect.db.test.ts` on the mounted app | their files | passed (36 tests with this row's db file) |
| `rbac-matrix.test.ts` | acceptance | 39 passed, 0 failed (89 routed operations) |
| `contract.test.ts` | acceptance | 25 passed, 11 failed (13 before the routes were mounted); section 6 |
| Static: this module, `test/static`, capture, credential store, engine, guard | unit | passed, but for adapters A-5 (red by design, rows 66 / 71) |
| db: `src/db`, `src/engine`, `capture-config`, `devices` | 24 files | 320 passed, 1 failed: `capture-actions.db.test.ts` A-4, row 136's (its own request line names it) |
| Typecheck core-server, core-web, mobile; lint core-server, shared, core-web | | clean (shared: the one known error `test/evidence-package.test.ts(453)`, not this row's) |

The adapter-level forms of `M4-SEC-DISC-1` (deep nesting, 1,300 attributes, the heap figure) and
the database half of `M4-SEC-DISC-3` (`recording_fragments` analyser) are row 131's and row 70's;
they were not repeated here.

Lift: `CAPTURE_DISCOVERY_DURING_RECORDING_ENABLED` is `true`. `static.test.ts` rule 5 reads
`62_r9_onvif_discovery.md` and this document and fails when either stops recording the two checks.

## 6. The acceptance walk `contract.test.ts`: 13 failed -> 11 failed

Green now: "the committed openapi.json lists the same 97 operations" and the detector's baseline
(the six mounted routes left `LANDED_UNROUTED`, which is 8). No assertion was weakened.

Still red, none names operation 89 or 93 to 97 in its failure list:

| Block | What it says |
|---|---|
| router equals registry | 8 operations still unrouted (export job, transcript x3, audio-source x2, sealing, media sessions): later rows |
| area 4, sessions | 14 operations under `/session/{id}` where the walk pins 11 |
| area 5, evidence | `verifyEvidence` body |
| 401 for every guarded operation | pin 71, registry has 93 |
| 403 sample | 10 lines: evidence `{id}`, and the unrouted audio-source / sealing / transcript routes |
| 404 / 405 | `DELETE .../audio-source` is 404, unrouted |
| DEMO_DISABLED / grant removed | list pins 6, finds 9 (transcript, export job) |
| no GET writes | pin 27, registry has 36 |
| free text | 8 lines on audio-source and transcript revisions, unrouted |
| SC6 answers | count pin |
| SC6 coverage | 176 statuses not produced; the walk has no area for 89 and 93 to 97 yet (their 2xx, 401, 404, 409) |

The walk's INFO lines show this row's operations answering as specified where it reaches them
(403 for the INVESTIGATOR on all six; 422 for hostile text on 89, 95, 96).

## 7. Pins moved (D106 and after)

`packages/shared/test`: `api-registry.test.ts:299,327-331,492,546,719-721,735,1091`;
`api-openapi-scope.test.ts:254,298,308-312,326-327`; `openapi.test.ts:176,226`;
`api-domain-operations.test.ts:641`; `i18n-vocabulary-sync.test.ts:142`; `api-text-rule.test.ts`
(34 bodies, 148 schemas); `api-examples`, `api-state-examples`, `api-stt-config`, `sim-api`,
`live-source-bindings`, `live-source-platform-neutral`, `redaction`.
`apps/core-web/src/test`: `live-api-reference-document.test.tsx:146,169,238,424`;
`live-api-reference-page.test.tsx:133,293`; `scalar-config.test.ts`.
`apps/core-server`: `test/acceptance/contract.test.ts:414-419,480` and `LANDED_UNROUTED`;
`test/acceptance/rbac-matrix.test.ts:968,1191,1216`, `DEFERRED_ROUTE`, and
`rbac-matrix.support.ts`; `test/static/scaffold.test.ts:52,54`;
`src/plugins/permission-guard/__tests__/access-rules.test.ts:59`, `matrix.test.ts:35`,
`guard.test.ts:251`, `decision.test.ts`, `denial.test.ts`; `src/core/__tests__/writers.test.ts:54,292`;
`src/db/fixtures/__tests__/audit-details.test.ts:271,284`; `src/engine/__tests__/hosted-actions.test.ts:29`,
`static.test.ts`; `src/capture/__tests__/static.test.ts` (frozen-file pin, `DISCOVER_CALL_SITES`);
`src/credential-store/__tests__/static.test.ts`; `src/modules/capture-config/__tests__/routes.test.ts`;
`src/modules/stt-config/__tests__/routes.test.ts`; `src/modules/devices/__tests__/routes.test.ts`.
Schema pin of this row's db test: `[5, 'dbc-6']`.

Two acceptance-test changes that are not count pins, both in `rbac-matrix.test.ts`: the matrix
gives the module a discovery adapter that sends nothing and finds nothing (as it gives operation 92
a probe), and runs each PERMITTED search in a throttle window of its own. A 429 is still a failure
of the file.

## 8. Not proven here, and open

- `contract.test.ts` has no area for operations 89 and 93 to 97; its 11 red blocks need the walk's
  owner (count pins of earlier rows, and routes of later rows).
- Mobile: `apps/mobile/src/runtime/sim-adapters.ts` should pass `deviceConsole: true` (open line in
  `delegation_progress/file_requests.md`). Until then the in-app simulator answers 89, 95, 96 as a
  web console would.
- Built-in devices carry no `adapter` / `sourceClass` yet (rows 136 / 139). An adopted camera reads
  back with `streamState: null` until a row opens its stream.
- A session that EXPIRES (not signs out) frees its list at the list's own `expiresAt`, not sooner.
- The loopback guard of row 131 refuses any client built with `net.createConnection`; the flow test
  takes it off for operations 95 and 96 (request filed). The search itself ran under it.
- Browser and device checks of the setup screens: the gate's (rows 140 / 141 and the M4 device gate).
- Reds seen and not this row's: adapters static A-5 (by design); MODG pins in `sessions` (2) and
  `evidence` (1); `stt-config` operation-92 tests when run inside the sandbox (loopback bind);
  `capture-actions.db.test.ts` A-4 (row 136); shared typecheck `evidence-package.test.ts(453)`.

## 9. Decisions taken in this row

| Decision | Why |
|---|---|
| 409 (recording), 429 and 503 of operation 93 are envelope answers named by `details.reason`, not statuses of the operation | C3 section 5.4; keeps the operation's documented set to 200, 202, 401, 403 |
| The audit reason and the answer reason of the web-only refusal are the same word, `WEB_CONSOLE_ONLY` | one vocabulary |
| `adapter` and `sourceClass` are optional on the device slice | the built-in devices do not have them until rows 136 / 139 |
| The adoption reaches the registry through an INTERNAL action and an in-unit engine door, then one `UPDATE` for the columns the slice does not carry | one unit, no second writer of the slice |
| Simulator option `deviceConsole` decides the web-only refusal in the facade | the simulator has no transport |
| `replaceForTest` on the connect control | row 142's db test needs its own parts on an app that now mounts the routes itself |

---
*Generated: 2026-10-09*
