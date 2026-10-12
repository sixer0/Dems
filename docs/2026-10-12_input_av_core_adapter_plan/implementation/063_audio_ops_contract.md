---
task: 2026-10-12_input_av_core_adapter_plan
row: 63
milestone: M4 / WP-07b
agent: coder-execution
date: 2026-10-12
tier: T3
status: needs-review
---

# Row 63 - the contract of the two microphone operations (97 to 99)

Status is `needs-review` for one reason only: the two acceptance files of the database project hold
operation pins and an "every operation is routed" rule that row 63 may not write and cannot run
(section "Left red, by ownership"). Everything inside the file set is built, passes and compiles.

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `SH` = `packages/shared`, `CS` = `apps/core-server`, `WEB` = `apps/core-web`.

THE CONTRACT ONLY. No Core route, no adapter, no screen: `git status` shows no file of row 63 under
`CS/src/modules/`, `CS/src/capture/`, `WEB/src/features/`. The registry now has two operations
with no route; the unit guard test registers a stand-in for each (`guard.test.ts:236-251`, green).

## 1. The two operations

New file `SH/src/api/capture-audio-cards.ts`. Both appended last to the table (`SH/src/api/core-api.ts:1078-1080`).

| # | operationId | Method, path | Tag, mode | Access | Audit (success / denial) | Statuses |
|--:|---|---|---|---|---|---|
| 98 | `searchCaptureAudioCards` | POST `/api/v1/capture/audio-cards/search`, no body | Device, simulated | `CAPTURE_CONFIG` + `WEB_CONSOLE_SESSION` | `CAPTURE_DISCOVERY_SEARCHED` (scope `AUDIO_CARDS`) / `ACCESS_DENIED` | 200, 401, 403, 409 |
| 99 | `registerCaptureAudioInput` | POST `/api/v1/capture/audio-cards/inputs`, body required | Device, simulated | `CAPTURE_CONFIG` + `WEB_CONSOLE_SESSION` | `CAPTURE_AUDIO_INPUT_CHANGED` / `ACCESS_DENIED` | 200\*, 201\*, 400, 401, 403, 404, 409, 422 |

\* sent by the Core server only (`services: CORE_SERVER_ONLY`): the simulator registers nothing.
429 and 503 are the envelope-level answers and are listed on no operation (the rule of
`SH/test/api-registry.test.ts:981`); the text of both operations names their reasons.

Source of each choice: design addendum `masterplan/04_design_addendum.md:319-331` (who triggers, role,
audit, body, storage, 503 outside production), `verification/04_security_addendum.md:249-265`
(AD-07), `verification/03_plan_review.md:61-62` (P12-F05 c, P12-F06).

### Schemas (4, merged into `CORE_API_SCHEMAS` at `core-api.ts:666-667`)

| Schema | Members |
|---|---|
| `CaptureAudioCard` | `cardId`, `deviceIndex` 0..31, `usbId` or null, `product`, `channelCount` 1..64, `sampleBits` (subset of 16, 24, 32), `registered[]` of `{ inputNumber 1..64, deviceId }` |
| `CaptureAudioCardSearch` | `searchedAt`, `cards[]` (at most 32), `truncated` |
| `CaptureAudioInputRegisterRequest` | `cardId`, `deviceIndex`, `inputNumber`: nothing else (strict) |
| `CaptureAudioInputRegistration` | `deviceId`, `change` (REGISTERED, CARD_CHANGED, REENABLED), `inputNumber`, `channelCount` |

The bounds are those of the stored row (`masterplan/03_db_schema_extension.md:216-221`): card id
`^[A-Za-z0-9_]{1,32}$`, USB id `^[0-9a-f]{4}:[0-9a-f]{4}$`, device 0 to 31, input and channels 1 to 64, bits 16 / 24 / 32.

### AD-07 in the schema

| Requirement | Where it is held | Test |
|---|---|---|
| AD-07 (1) closed character rule and caps | `CAPTURE_AUDIO_CARD_TEXT_PATTERN` `^[ -~]{1,64}$` (printable ASCII), the USB id and card id patterns, the list caps (32 cards, 64 registered inputs, 3 sample sizes) | `SH/test/api-capture-discovery.test.ts`, case "AD-07 (1)": 14 refused product names (control, DEL, non-ASCII, U+202E, U+200E, U+200B, U+200D, U+FEFF, lone surrogate, empty, 65 characters), 7 refused USB ids, 8 refused card ids |
| AD-07 (2) no descriptor text in a request | the body of 99 is a card id of the kernel's form and two integers; a strict object | case "AD-07 (2)": 12 extra members refused (`product`, `usbId`, `path`, ...), 12 malformed bodies refused (`hw:CARD=...`, `--device`, a shell fragment, numbers out of range) |
| No device text in an audit row | `captureAudioInputChangedDetails`: a registry id, a code, two integers | case "the answer of 99 and its audit row"; the simulator's search row is searched for the card id and the product: 0 hits (`SH/test/sim-capture-discovery.test.ts`) |

NOT done here (their rows): the function that replaces a failing string by a fixed word (row 64 / 67,
AD-07 (1) "before it leaves the adapter"); the helper argument built from two integers (row 66, AD-07 (2));
single flight and spacing in the Core (row 70, AD-07 (3): the constant
`CAPTURE_AUDIO_CARD_SEARCH_MIN_INTERVAL_MS` and the two reasons are stated); the match by USB id and port (row 70, AD-07 (4): the change code `CARD_CHANGED` is stated).

## 2. The stated answers

| Answerer | 98 | 99 |
|---|---|---|
| Core, `REAL_PRODUCTION` | the listing (row 70) | 201 REGISTERED, 200 REENABLED / CARD_CHANGED; 404 no such card; 409 `AUDIO_INPUT_BEYOND_CARD` (row 70) |
| Core, `SIMULATED` and `REAL_DEVELOPMENT` | `503 NOT_READY`, `details.reason: DISCOVERY_NOT_READY` | the same 503. Stated in the description of both operations (asserted by the test); the Core side is row 70 |
| In-app simulator (`SH/src/sim/api.ts:1539-1602`) | 200: a fixed list of two cards, `DEMS_TEST_A` (4 inputs) and `DEMS_TEST_B` (2 inputs), product "DEMS test sound card A/B (simulated)", no USB id, no registered input; one `CAPTURE_DISCOVERY_SEARCHED` row with scope `AUDIO_CARDS` | registers nothing, writes no row, changes no state: 404 for a card that is not in the list, 409 `AUDIO_INPUT_BEYOND_CARD` for an input the test card does not have, 409 `AUDIO_INPUT_NOT_REGISTRABLE` for one it has |
| Both simulator answers | 401 signed out; 403 without `CAPTURE_CONFIG`; 403 `WEB_CONSOLE_ONLY` inside a tablet or phone app; 409 `CAPTURE_CONFIG_LOCKED` with a session open | the same, each before the body is used |

## 3. Count pins moved (each by its delta)

Operations 97 -> 99; POST 61 -> 63 (GET stays 36); offline scope 31 -> 33; simulated 30 -> 32; paths 91 -> 93;
schemas of the registry 167 -> 171, offline components 53 -> 56; one-permission rules 57 -> 59, rules with a
permission 58 -> 60; operations with a condition 13 -> 15; Device tag 23 -> 25; request bodies 35 -> 36.

| File | Lines (after the change) |
|---|---|
| `SH/src/api/core-api.ts` | 52, 1078-1080 (registry); 666-667 (schemas) |
| `SH/src/sim/api.ts` | 2, 9-10, 124-125, 164-166 (route list), 1540 and 1579 (the comment marks `// 98`, `// 99` after `// 97` at 1493) |
| `SH/src/api/openapi.ts`, `index.ts` | comments 6-7, 13, 18, 233; 27 |
| `SH/test/api-registry.test.ts` | 2, 192-204, 307-343, 403-407, 512-519, 552-554, 565-567, 588-595, 743-748, 759-764, 806, 822-823, 849-850, 997, 1007, 1076, 1130-1131, 1164 |
| `SH/test/openapi.test.ts` | 65, 122-126, 180-182, 195-196, 204, 226, 232, 272, 422, 730-768 (flow 15), 792-794 (25 -> 27) |
| `SH/test/api-openapi-scope.test.ts` | 122-124, 140-143, 178, 206, 261, 299, 305, 311-320, 330-333, 393-394, 446-447, 458, 553 |
| `SH/test/api-capture-discovery.test.ts` | 122-124 (`slice(-7, -2)`), 129-140, 196-213; new block from 457, the `describe` at 461 (7 cases) |
| `SH/test/api-domain-operations.test.ts` | 688, 700-702 (52 -> 54), 863-865 |
| `SH/test/api-examples.test.ts`, `api-state-examples.test.ts` | 52, 76-78 (87 -> 89); 196 |
| `SH/test/api-text-rule.test.ts`, `api-stt-config.test.ts`, `sim-api.test.ts` | 160-161, 227-228; 306-309; 41-43 |
| `SH/test/sim-capture-discovery.test.ts` | new block "operations 98 and 99" (3 cases) |
| `CS/src/plugins/permission-guard/__tests__/guard.test.ts` | 251 |
| `.../access-rules.test.ts` | 62-68, 71, 79, 130-132 |
| `.../decision.test.ts` | 98, 109-114 (873 -> 891), 132 (INVESTIGATOR 34 -> 36), 135-137, 363-366, 371 |
| `.../denial.test.ts`, `matrix.test.ts` | 308 (3 -> 5); 33, 35 |
| `CS/src/modules/devices/__tests__/routes.test.ts`, `stt-config/__tests__/routes.test.ts` | 110-113; 123-124 |
| `WEB/src/test/live-api-reference-page.test.tsx` | 129, 133, 136, 290-295, 304-305, 324 |
| `WEB/src/test/live-api-reference-document.test.tsx` | 132-137, 143-147, 201, 210-211 (30 -> 32), 239-241, 335, 340-342 and 346 (87 -> 89) |
| `WEB/src/test/scalar-config.test.ts` | 70, 76-77 |

Baseline list (`research/002_baseline_pins.md`): all seven test lines moved; `sim/api.ts` carries the two new marks.
Fourteen further files were found by the runs, not by the baseline; they are in `file_claims.md` (row 63, two additions).

`SH/openapi/openapi.json`: regenerated ONCE, last, with the repository's generator. Generator line:
`wrote openapi/openapi.json (all (committed): 99 operations, 2 security schemes, version 0.3.0; offline: 33 operations, 0 security schemes, version 0.2.0; 1445768 bytes)`.
Against the tree before: 833 insertions, 1 deletion (the summary line "97 operations").

## 4. Checks run

| Check | Command | Result |
|---|---|---|
| Shared, the contract files (after the regeneration; one run) | `npx vitest run --maxWorkers=2` on 18 files (api-registry, openapi, api-openapi-scope, api-capture-discovery, api-text-rule, api-state-examples, api-examples, api-domain-operations, api-schemas, api-closeout, api-envelope, sim-api, sim-capture-discovery, sim-v2-parity, client-core, client-types, sim-api-validation, i18n-vocabulary-sync) | `Test Files 18 passed (18)`, `Tests 436 passed (436)` |
| Shared, the other files that read the registry (one run) | the same on 19 files (api-stt-config, api-verify-report, api-realtime, api-state-slices, api-export-job-id, client-credentials, live-source-*, live-testing-*, sim-contract, ...) | `Test Files 19 passed (19)`, `Tests 800 passed (800)` |
| Core server, unit files that read the registry (sandbox off: loopback binds) | `npx vitest run --project unit --maxWorkers=2` on permission-guard, throttle, engine/api-headers and 20 module route test paths | `Test Files 39 passed (39)`, `Tests 1203 passed (1203)` |
| Web console | `npx vitest run --maxWorkers=2` on live-api-reference-page, live-api-reference-document, scalar-config, sim-fetch | `Test Files 4 passed (4)`, `Tests 157 passed (157)` |
| Typecheck | `npm run -s typecheck` in `packages/shared`, `apps/core-server`, `apps/core-web` (after the last edit); `apps/mobile`, `apps/mock-core` (after the last source edit; no file of theirs changed) | exit 0, five of five |
| Lint of the new code | `npx oxlint` on the new file, `sim/api.ts` and the two test files | exit 0 |

Runs before those: the first shared run named 36 failing pins (the discovery of the list), the second
2 (the description not yet regenerated), the third passed. Core server: 8 failing pins, then 2 more in
module route tests, then passed. Web: 8, then passed. `apps/mock-core`: its four files were run once
under the sandbox by mistake of scope; 4 tests failed with `listen EPERM` (the sandbox refuses the
bind); it was not re-run outside the sandbox because its ports are in the forbidden range, and it
reads no registry (`grep` of `CORE_API_OPERATIONS`, `openapi` in `apps/mock-core/src`, `test`: 0).
NOT run: `npm test`, `npm run test:db`, any mobile test (no mobile file pins the count: `grep` of 97 in `apps/mobile/src`: 0).

## 5. Left red, by ownership (in `file_requests.md`, row 63)

| File (database project, not run) | What goes red at `npm run test:db` | Blocking |
|---|---|---|
| `CS/test/acceptance/contract.test.ts` | counts 97 / 61 / 93 at `:456-461`, `:536`, `:1263-1264`; the "every operation is routed" rule at `:484-489`; the 401 walk and the success ledger for the two unrouted operations (`:1265`, `:2055`). The file has the mechanism: `LANDED_UNROUTED` (`:169`) | yes |
| `CS/test/acceptance/rbac-matrix.test.ts`, `rbac-matrix.support.ts` | `DEFERRED_ROUTE` (`:171`) needs the two; the registry is compared with a table composed from task 3's contract document, which has no row for 98-99 (`:974-977`, `:1013`). Controller decision: where the identity table of the two lives | yes |
| `CS/src/core/audit-details.ts:185-191` | nothing: a stale comment (the shared scope carries `AUDIO_CARDS` since I-1). Not in this row's profile: left | no |
| comments and titles in `WEB/src/features/api-reference/`, `matrix.db.test.ts:139`, `api-verify-report.test.ts:130` | nothing: they say 31 / 97 | no |

## 6. Driver decisions, for the controller to confirm

| # | Decision | Why | Reversible |
|---|---|---|---|
| D-1 | Both operations are `mode: simulated` and both carry `WEB_CONSOLE_SESSION` | "a stated simulator answer" (row, P12-F06); "Web console only" (addendum 4.2, Role; security addendum 6.2 PASS) | yes |
| D-2 | The in-app simulator LISTS two test cards, although the addendum's row "In SIMULATED and REAL_DEVELOPMENT" says 503 | that row speaks of the Core's capture operation (it cites `development-discovery.ts`); the controller's brief asks for a fixed synthetic list in Simulated mode. The 503 of the Core is stated in the operation text | yes |
| D-3 | The simulator's registration is a refusal, `409 INVALID_STATE` / `AUDIO_INPUT_NOT_REGISTRABLE`, not a 503 and not a registration | a 503 may be listed on no operation and the simulator may produce only listed statuses (`api-registry.test.ts:981`, `openapi.test.ts:775-783`); a real registration needs a microphone transition of the simulator state (`sim/capture-registry.ts` registers cameras only), outside this row | yes |
| D-4 | The two successes of 99 are marked Core-server-only; the test that allowed one such success (93's 200) now names these two beside it (`api-registry.test.ts:403-407`) | consequence of D-3 | yes |
| D-5 | Paths `/capture/audio-cards/search` and `/capture/audio-cards/inputs`; 201 for a new microphone, 200 for REENABLED and CARD_CHANGED; 404 for a card that is not in the Core's own listing; one entry per capture device of a card with the registered inputs as a list | the addendum fixes the names, the body and the facts, not these forms | yes |
| D-6 | Product name at most 64 characters, printable ASCII; at most 32 entries per answer | AD-07 (1) asks for "a stated length"; `capture_devices.model` allows 120, so 64 fits | yes |
| D-7 | New reasons in their own set `CaptureAudioCardReason` (4); `CaptureDiscoveryReason` is unchanged; `AUDIO_INPUT_BEYOND_CARD` is the same word as the adapter's error code (`CS/src/capture/adapters/types.ts:230`) | no existing list or pin moves | yes |
| D-8 | Pins in fourteen test files outside the baseline list were moved by this row (claims additions 1 and 2), following row 19's precedent | they are operation-count pins of the single-writer set; leaving them red would fail the unit suite at the commit | yes |

## 7. Requirements

| Identifier | State after this row |
|---|---|
| P12-F06 (every new operation: registry entry, schema, simulator answer, description, pins) | closed for operations 98-99, except the two database-project files of section 5 |
| P12-F05 (c) (no operation registers a microphone) | contract closed; the live path is row 70 |
| AD-07 (1) | the schema half closed; the adapter's function is row 64 / 67 |
| AD-07 (2) | the request half closed (no descriptor text can be sent); the helper argument is row 66 |
| AD-07 (3), (4) | constants, reasons and the change code stated; behaviour is row 70 |

## 8. Unproven

Nothing here ran against a sound card, a Core route or a database. What a real card announces (its
product string, its card id as the kernel forms it, more than 32 capture devices) is checked by row
64 on fixed listings and by `9A/H-07` on hardware. The double of this row is the in-app simulator's fixed list.
