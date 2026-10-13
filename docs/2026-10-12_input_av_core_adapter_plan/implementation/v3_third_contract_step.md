---
task_slug: input_av_core_adapter_plan
row: V3 (wave 10, track D)
date: 2026-10-13
agent: coder-execution (wave 10, agent V3)
tier: T3
status: complete (items 1-6 built and checked; item 7 is not in the shared package and is left to row 215, as the brief says)
---

# Row V3 - the third contract-and-vocabulary step (107 -> 108 operations, 78 -> 82 audit types)

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `SH` = `packages/shared`, `CS` = `apps/core-server`, `WEB` = `apps/core-web`. Decisions: C53, C56, C57, C58, C62. ONE change set; `SH/openapi/openapi.json` written once, last, by the repository's generator.

Counts after the row: **108 operations (39 GET / 69 POST), 82 audit types, 51 actions, 15 permissions**; schema `[11, 'dbc-12']` untouched.

## 1. The seven items

| # | Item | Result |
|--:|---|---|
| 1 | `HOST_ALIAS_REQUESTED`, `HOST_ALIAS_ADD_FAILED` (SECURITY) with closed lists | done |
| 2 | one type for "audio absent across a worker restart" | done: `CAPTURE_AUDIO_ABSENT_ON_RESTART` (DEVICE). Vocabulary and details rule only; the writer is row 191b |
| 3 | the outcome of a stored-credential connection test | done: a NEW type `CAPTURE_DEVICE_CONNECTION_TESTED` (SECURITY) - why in section 3 |
| 4 | the contract operation of that test | done: operation 108 `testCaptureDeviceConnection`; named deferral for the missing route |
| 5 | `usbSerial` / `usbPort` on the answer of operation 98, sentences of 99 | done; the server's two answer lines are a request (not this row's file) |
| 6 | the move of the password policy | done, with two stated departures from "as it is" (section 6) |
| 7 | `CREDENTIAL_REPLACED` on an OPERATOR-scope revocation | NOT done here by rule: the type lives in `CS/src/modules/identity/biometric/store.ts:172`, not in `SH`; left to agent X1 (row 215), said in `file_requests.md` |

## 2. The four audit types (appended last, in this order)

| Type | Category | Required keys | Optional keys |
|---|---|---|---|
| `HOST_ALIAS_REQUESTED` | SECURITY | `action` (ADD or REMOVE), `address` (IPv4 literal) | `reason` (FACTORY_SCAN, SET_CAMERA_ADDRESS), `removeReason` (EXPIRED, MANUAL, JOB_DONE, BOOT_SWEEP), `minutes` (5..480, the helper's bounds), `aliasId` (row UUID), `operationId`, `permission` |
| `HOST_ALIAS_ADD_FAILED` | SECURITY | `address`, `reason`, `failureReason` (a CODE) | `aliasId`, `operationId`, `permission` |
| `CAPTURE_AUDIO_ABSENT_ON_RESTART` | DEVICE | `sessionId`, `earlierAttempt`, `laterAttempt` (each >= 1) | `audioAbsentAtLeastMs`, `audioAbsentAtMostMs` (each 0..86 400 000) |
| `CAPTURE_DEVICE_CONNECTION_TESTED` | SECURITY | `deviceId` (`CAM-NN`), `outcome` (the five), `adapter` (code), `sourceClass`, `operationId` (`testCaptureDeviceConnection` only) | `guardTripped`, `reason` (SCHEME_NOT_ALLOWED), `permission` |

Where: `SH/src/sim/vocabulary.ts` (the four names and their categories), `SH/src/i18n/en/common.ts` (four labels), `CS/src/core/audit-details.ts` (four lists beside the three existing `HOST_ALIAS_*` types and after `OPERATOR_PASSWORD_SET`; the list now holds 38, the simulator's 44 do not move), `CS/src/db/fixtures/operations.ts` (one fixture row of each, `at(25)` to `at(28)`), `SH/src/api/capture-discovery.ts` (`captureDeviceConnectionTestedDetails`, the one builder of the fourth).

Categories as the existing types of their kind: the three alias types are SECURITY; the capture-fault types `MIC_SILENT` and `CAPTURE_DEVICE_UNREACHABLE` are DEVICE; `CAPTURE_CONNECTION_TESTED` and `CAPTURE_CREDENTIAL_REVEALED` are SECURITY.

No key of the four can hold a credential, a locator, an interface name or device text: the general key rule refuses the credential names, and the lists hold none of `host`, `endpointRef`, `url`, `port`, `path`, `model`, `interfaceName`, `error` (tested by name, 6 + 18 names per type). `failureReason` is a code form: the helper's own text is refused (`RTNETLINK answers: File exists`).

## 3. Item 3: a new type, not a member - why

The vocabulary's pattern: a variant that keeps the SAME required keys became a member (`scope: AUDIO_CARDS` on `CAPTURE_DISCOVERY_SEARCHED`, the third reveal reason); a variant with OTHER required keys became a type of its own (`HOST_ALIAS_REMOVED` beside `HOST_ALIAS_REMOVE_FAILED`). `CAPTURE_CONNECTION_TESTED` REQUIRES `candidateId` and `searchId`, which a registered camera has not; the audit writer checks key by key and cannot say "one pair or the other", so admitting a `deviceId` would mean making the candidate pair optional for every writer, the candidate's test included. That weakens an existing closed rule. Hence `CAPTURE_DEVICE_CONNECTION_TESTED`. It has no `host`, no `endpointRef`, no `candidateId`, no `searchId` and no `authenticated` (a stored credential is always the one used). A test holds that the list of `CAPTURE_CONNECTION_TESTED` is what it was and still refuses the new operation id.

Consequence, said in the contract and in `file_requests.md`: a test that reaches the reader writes TWO entries (the reader's `CAPTURE_CREDENTIAL_REVEALED`, then the outcome); "exactly one audit entry per test" of row 146 is restated by the route row.

## 4. Operation 108 `testCaptureDeviceConnection`

| Member | Value |
|---|---|
| Method, path | POST `/api/v1/capture/devices/{id}/test` |
| Tag, mode | Device, `simulated` |
| Access | `CAPTURE_CONFIG` + `WEB_CONSOLE_SESSION` - the same access object as operation 95 |
| Body | NONE. No credential, address, port, path or profile member can exist. Not a member of `CREDENTIAL_CARRYING_OPERATIONS` |
| 200 | `CaptureDeviceConnectionTest` { `deviceId`, `outcome`, `authenticated: true`, `testedAt`, `usableProfileCount`, `failedAttemptsRemaining`, `reason?` } - exactly `AdoptedCameraTest` of `adopted-test.ts` |
| Refusals | 401; 403 (the role; `WEB_CONSOLE_ONLY`); 404 (no registered camera); 409 `CAPTURE_CONFIG_LOCKED`; 409 `INVALID_STATE` with `CANDIDATE_NOT_TESTABLE`, `CREDENTIAL_REQUIRED`, `CONNECTION_TEST_IN_PROGRESS` (the server's own sentences, `CAPTURE_DEVICE_TEST_REFUSAL_SENTENCES`); 422 (the path form; Core only) |
| Envelope-level | `429 RATE_LIMITED` with `retry-after`: `CONNECTION_TEST_RATE_LIMITED`, `CONNECTION_TEST_LOCKOUT_GUARD` - stated as THE guard of operation 95 (a typed and a stored credential count together); `503 NOT_READY`: `DISCOVERY_NOT_READY`, `CREDENTIAL_STORE_NOT_READY` |
| Audit | success `CAPTURE_DEVICE_CONNECTION_TESTED`, also `CAPTURE_CREDENTIAL_REVEALED`; denial `ACCESS_DENIED` |
| Simulator | synthetic and it changes nothing: for a registered camera 200 `REACHABLE`, one usable profile, the full bound of the guard; 404 otherwise; the order is the Core's (role, web console, idle lock, device). No audit row, no event: the whole state is the SAME object before and after (asserted twice) |

Files: `SH/src/api/capture-discovery.ts` (last section: schema, builder, sentences, operation, examples), `core-api.ts`, `examples.ts`, `openapi.ts` (header counts), `SH/src/sim/api.ts` (one route line, one handler, one type import, the header).

NAMED DEFERRAL of the missing Core route, each pinned by literal and naming row 146b:

| List | Entry |
|---|---|
| `LANDED_UNROUTED`, `UNROUTED_UNTIL` and the literal of block 1 in `CS/test/acceptance/contract.test.ts` | `POST /api/v1/capture/devices/{id}/test` / `testCaptureDeviceConnection` |
| `DEFERRED_ROUTE` of `CS/test/acceptance/rbac-matrix.test.ts` | `testCaptureDeviceConnection` |

The router pin stays 105 (the operation has no route). The contract document the acceptance matrix reads gained ONE row (`docs/2026-10-07_dems_real_capture_sealing/masterplan/03_api_contract.md`, table of section 2.6, row 108).

## 5. Item 5: `usbSerial`, `usbPort`

`CaptureAudioCard` gained two members after `usbId`: each a string of `/^[A-Za-z0-9:._-]{1,64}$/`, nullable, optional (`CAPTURE_AUDIO_USB_SERIAL_PATTERN`, `CAPTURE_AUDIO_USB_PORT_PATTERN`). The form is the CHECK of the two columns of migration 0017 and the listing's own rule (`CardStringKind.USB_SERIAL`, `USB_PORT` in `CS/src/capture/adapters/audio/card-listing.ts:84,91`), read, not assumed. Backward compatible: the simulator's fixed cards state neither and still parse.

FINDING against the brief ("the server already produces them"): the listing produces them, but `cardAnswer` of `CS/src/modules/capture-inputs/audio-cards/service.ts:289` does not answer them yet (its header says so). The two lines are a request to that file's writer; the schema accepts exactly what those lines will send (`identityTextOf(...)`: a text of the rule, or null). The two description sentences of row 199 are in the contract (operation 99: `CARD_CHANGED` does not re-enable; a USB card with neither a serial nor a port is `AUDIO_INPUT_NOT_REGISTRABLE`).

## 6. Item 6: the password policy - what moved, and two departures

`SH/src/api/password-policy.ts` (NEW) holds the numbers, the ten refusals, the seven rules, the comparison without an early exit, and the guard of one run. ONE barrel line (`SH/src/api/index.ts`). `CS/src/modules/identity/password-policy.ts` re-exports it and binds two facts; `identity/index.ts` was NOT edited and its eight exported names and signatures are unchanged (row 215's command imports them). The rule table moved to `SH/test/api-password-policy.test.ts` (NEW, 24 cases); the identity test keeps what the server binds (11 cases).

| Departure from "as it is" | Why (measured) | What was built |
|---|---|---|
| The shared file does NOT import `../sim/dataset` | `SH/test/live-source-platform-neutral.test.ts:120` holds `sim/dataset.ts` out of the Live run-time graph; the contract folder loads two leaf files of the simulator only (`vocabulary`, `constants`) | The demonstration password is HANDED IN: `checkNewPasswordAgainst(password, operator, { demonstrationPassword })`. A missing or empty fact THROWS (`PasswordPolicyFactsError`): the rule cannot be skipped. The identity file names the seed's constant by import and binds it: `checkNewPassword(password, operator)` |
| The per-run keyed digest is NOT in the shared file | The shared package is loaded by the phone and tablet client; its runtime (Hermes) has no Web Crypto - the package says so itself (`SH/src/demo-data/verify.ts:231`). This is the case the brief names | "The helper server-side behind an injected comparer": `createRunRepeatGuardWith(digest)` in the shared file keeps digests and nothing else; `createRunRepeatGuard()` in the identity file makes the key (32 random bytes, HMAC-SHA-256, not exportable, bytes zeroed) and hands the digest in |

Verified under the shared package's own test environment (node): the guard on a handed-in digest, and one case that builds it on that runtime's Web Crypto as the server does. A static case holds that the shared file names no `crypto`, `subtle`, `globalThis`, `Buffer` or random source. `apps/mobile` and `apps/core-web` typecheck with the new barrel line.

NOT MET, said to the controller: C53's sentence "after the move the identity folder holds no second random source". The run key is still made in that folder. The remedy is one step and is exported for it (`createRunRepeatGuardWith`): the command makes the digest and hands it in.

## 7. Count pins moved (each by its delta)

Operations 107 -> 108; POST 68 -> 69 (GET 39); offline scope 41 -> 42; simulated 40 -> 41 (live 67); paths 100 -> 101; registry schemas 183 -> 184, offline components 66 -> 67, schemas "added" 165 -> 166; one-permission rules 67 -> 68, rules with a permission 68 -> 69; operations with a condition 23 -> 24; Device tag 33 -> 34; request bodies 41 (unchanged: no body); Core-server-only statuses 33 -> 34; cookie-or-bearer 97 -> 98; examples of Core-answered operations 97 -> 98; operations no action reaches 62 -> 63; guard cells 963 -> 972, denied INVESTIGATOR 44 -> 45 (SUPERVISOR 10, TECHNICIAN 34); web-only refusal rows SUPERVISOR 6 -> 7, TECHNICIAN 13 -> 14; Try-it allowed 96 -> 97 (denied 11); composed rows of section 2.6 15 -> 16, delta rows 32 -> 33; guarded (not PUBLIC) 103 -> 104.
Audit types 78 -> 82; types with a list 34 -> 38 (44 without one, unchanged); fixture by source ALLOW-LIST 34 -> 38; listed types with no builder 25 -> 29 names; positions of the earlier groups each by four (`slice(-25,-16)` -> `slice(-29,-20)`, `at(-16)` -> `at(-20)`, `slice(-15,-11)` -> `slice(-19,-15)`, `slice(-11,-1)` -> `slice(-15,-5)`, `at(-1)` -> `at(-5)`; new `slice(-4)`).
No action pin moved (51).

26 pin files: 11 in `SH/test` (`api-capture-discovery`, `api-registry`, `api-domain-operations`, `api-examples`, `api-openapi-scope`, `api-stt-config`, `api-text-rule`, `api-verify-report`, `i18n-vocabulary-sync`, `openapi`, `sim-api`), 9 Core unit (`core/__tests__/writers`, `db/fixtures/__tests__/audit-details`, `modules/devices/__tests__/routes`, `modules/stt-config/__tests__/routes`, `plugins/permission-guard/__tests__/access-rules`, `decision`, `denial`, `guard`, `matrix`), 3 Core acceptance (`contract.test.ts`, `rbac-matrix.test.ts`, `rbac-matrix.support.ts`), 3 web (`live-api-reference-page`, `live-api-reference-document`, `scalar-config`). New cases extend the existing files of their subject: `api-capture-discovery.test.ts` (one describe, 6 cases, for operation 108), `writers.test.ts` (one case for the four types), `sim-capture-discovery.test.ts` (one case), `openapi.test.ts` (flow 18).

Generator line: `wrote openapi/openapi.json (all (committed): 108 operations, 2 security schemes, version 0.3.0; offline: 42 operations, 0 security schemes, version 0.2.0; 1624892 bytes)` (`node --import tsx scripts/gen-openapi.ts` from `packages/shared`; a later `--check`: "is up to date").

## 8. Checks (2026-10-13, `--maxWorkers=2`)

| Check | Command | Result |
|---|---|---|
| Shared contract, simulator, live, client, i18n | `npx vitest run --maxWorkers=2 test/api- test/openapi test/sim- test/live- test/client test/i18n` in `packages/shared`, after the regeneration | `Test Files 77 passed (77)`, `Tests 2109 passed (2109)`. Runs before it listed the pins (38 red, then 4: one missed pin and the three that wait for the regeneration) |
| Core unit: pins, writer, fixture, identity, static | `npx vitest run --project unit --maxWorkers=2 src/plugins/permission-guard/__tests__ src/modules/devices/__tests__/routes.test.ts src/modules/stt-config/__tests__/routes.test.ts src/engine/__tests__/hosted-actions.test.ts src/core/__tests__/writers.test.ts src/db/fixtures/__tests__/audit-details.test.ts src/modules/identity/__tests__/password-policy.test.ts src/modules/identity/__tests__/static.test.ts build.test.ts static.test.ts target.test.ts src/core/__tests__/static.test.ts` (sandbox off: loopback) | `Test Files 1 failed, 44 passed (45)`, `Tests 1 failed, 1152 passed (1153)`. The one red is NOT this row's: `src/credential-store/__tests__/static.test.ts:89` (the importer list gained `src/capture-composition.ts`; rows 85b / 85c) - a request line, file not edited |
| The writer after a fix in my own new rule | `... src/core/__tests__/writers.test.ts` | first run 1 failed (MY new case: `deviceId` accepted a candidate id because the general hardware-id form is wide; the rule now uses the contract's `CAM-NN` form); second run `Tests 143 passed (143)` |
| Web pins | `npx vitest run --maxWorkers=2 src/test/live-api-reference-page.test.tsx src/test/live-api-reference-document.test.tsx src/test/scalar-config.test.ts` | `Tests 1 failed, 143 passed (144)` (one missed pin, `:327`), then that file `Tests 7 passed (7)` |
| Acceptance and matrix on throw-away databases (`.locks/db-migrate.lock`, sandbox off) | `npx vitest run --project db --maxWorkers=2 test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts src/modules/rbac/__tests__/matrix.db.test.ts src/modules/devices/__tests__/simulated-no-source-class.db.test.ts src/engine/__tests__/api-headers.outcome.db.test.ts` | `Test Files 5 passed (5)`, `Tests 112 passed (112)`; `0 remain` |
| The bulk fixture (it gained four rows) | `... src/db/fixtures/__tests__/bulk-fixture.db.test.ts` | `Test Files 1 passed (1)`, `Tests 26 passed (26)`; `0 remain` |
| Typecheck | `npm run -s typecheck` in `packages/shared`, `apps/core-web`, `apps/mobile`, `apps/transcriber`, `apps/mock-core`, `apps/core-server` | exit 0, six of six |

## 9. Driver decisions (for the controller to confirm)

| # | Decision | Why |
|---|---|---|
| DD-1 | The names `CAPTURE_AUDIO_ABSENT_ON_RESTART`, `CAPTURE_DEVICE_CONNECTION_TESTED`, `testCaptureDeviceConnection` | fixed here, as each row asks; the prefixes of their neighbours |
| DD-2 | `operationId` and `permission` are OPTIONAL on the two alias types (the request line lists them without a mark) | as on the three existing alias types: a removal by a timer or the boot sweep has neither |
| DD-3 | `reason` / `minutes` (ADD) and `removeReason` (REMOVE) of `HOST_ALIAS_REQUESTED` are optional keys; "which belongs to which action" is the writer's (row 106) | the audit writer checks key by key; it cannot state a rule between keys |
| DD-4 | `minutes` is held to 5..480, the helper's bounds, by import of the contract's `HOST_ALIAS_HELPER` | a row cannot state a lifetime the helper would refuse |
| DD-5 | The two bounds of the audio gap are OPTIONAL, each 0..86 400 000 ms; the keys are the session's own (`audioAbsentAtLeastMs`, `audioAbsentAtMostMs`) | the session computes null for a bound whose instant is unknown (`capture-session/index.ts:966`); a refused row of a real gap would be worse than a row without a number. C57 says "with the measured bounds": row 191b writes them whenever they are measured |
| DD-6 | The gap type has no `deviceId`, no `role`, no `operationId` | C57 names the session, the attempts and the bounds; one more key is a decision of row 191b / the security acceptance |
| DD-7 | Item 3 is a new type (section 3) | the pattern of the vocabulary |
| DD-8 | `deviceId` of the new type is the contract's camera form `CAM-NN`, narrower than the general hardware id | the general form accepts a candidate id (found by my own case) |
| DD-9 | The simulator answers a synthetic `200 REACHABLE` and writes nothing | the brief: "synthetic, changes nothing". It differs from operation 95's simulator, which writes its audit row |
| DD-10 | The 422 of a path of the wrong form is Core-server-only; the simulator answers 404 | as the other operations with a path parameter (operation 107) |
| DD-11 | `CREDENTIAL_REQUIRED` and `CANDIDATE_NOT_TESTABLE` are reused as 409 reasons of 108 | they are the server's own answers in `adopted-test.ts`; no new reason |
| DD-12 | The deferral names "row 146b" | the route row has no number yet; the controller names it |
| DD-13 | One row in the TASK-3 contract document | the acceptance matrix composes its expectation from that table (as rows 194 and 102 did) |
| DD-14 | `testCaptureDeviceConnection` was NOT put on the web's Try-it deny list | AR-3a's letter does not name it and no product line of the web is this row's; a ruling is asked |
| DD-15 | The two departures of section 6, and the run key staying in the identity folder | the two rules of the shared package; the least change for row 215, which is editing in parallel |
| DD-16 | The fixture gained four rows (`at(25)` to `at(28)`), severity WARNING on the failed add and on the gap | "the fixture writes all types" is a pinned rule; as rows 19 and 201 |

## 10. The double, and what stays unproven

The in-app simulator, pure schema and rule tests, the fixture builder, throw-away databases. No camera, no network probe, no credential, no helper, no host address. Unproven here: the route of operation 108 and its outcome row written inside a real test (row 146b), the alias intent written before a real helper line (row 106), the gap row of a real restart (row 191b), the serial and the port of a real card (`9A/H-07`, `H-08`), the password command with the bound policy on a real terminal (rows 215, 216).

Existing files were edited with the Edit tool only; `openapi.json` was written by the repository's generator, once. New files (Write): `SH/src/api/password-policy.ts`, `SH/test/api-password-policy.test.ts`, this record and `delegation_progress/row_v3.md`.

---
*Generated: 2026-10-13*
