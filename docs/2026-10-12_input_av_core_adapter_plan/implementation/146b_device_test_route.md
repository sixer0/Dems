---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 146b (and the served request of rows 199 / 200 -> V3: `cardAnswer`)
milestone: M3 / AD-03, AD-12
date: 2026-10-13
agent: coder-execution (wave 11, agent A4)
tier: T3
requirement: AD-03 point 5 and AD-12 "S13-04 (d)" over HTTP; decision C58 (the OUTCOME of a stored-credential test is audited), C67 (operation 108, `CAPTURE_DEVICE_CONNECTION_TESTED`, `usbSerial` / `usbPort`)
status: complete (the route, the outcome entry and the two answer members are built and checked on doubles; the acceptance files are red ONLY on two operations another agent put into the registry in flight - section 5)
---

# Row 146b: the route of operation 108 and the outcome entry of a stored-credential test

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`, `CD` = `CS/src/modules/capture-discovery`, `CC` = `CS/src/modules/capture-config`, `AC` = `CS/src/modules/capture-inputs/audio-cards`.

## 1. Statement

**The route.** `POST /api/v1/capture/devices/{id}/test` (operation 108 `testCaptureDeviceConnection`) is registered by the capture-discovery module from a new file, `CD/adopted-test-route.ts`: ONE handler that calls `adoptedCameraTestControl(app).test({ principal }, request.params.id)`. It has no body schema and reads no body; the one input is the `{id}` of the path, held to the registry's pattern. Access is stage 6's (the access object of operation 95). The file maps no answer: every status is the function's own.

| Contract answer | Produced by | Where shown |
|---|---|---|
| 200, a failed test is a result | the function | DB over HTTP (REACHABLE; AUTHENTICATION_FAILED twice); acceptance (REACHABLE on the fake ONVIF stub) |
| 401, 403 (`ACCESS_DENIED`, one row), 422 (path form) | stages 4, 6, 7 | DB over HTTP; acceptance walk |
| 404 unknown device; 404 a device that is no camera (WRONG KIND) | the function | DB over HTTP (a seeded microphone); acceptance (`MIC-01`); unit |
| 409 `CAPTURE_CONFIG_LOCKED` (session open) | the function | acceptance area 4, with a session open; unit |
| 409 `CANDIDATE_NOT_TESTABLE`: a development source | the function | acceptance (`CAM-03`, adapter FAKE); unit |
| 409 `CANDIDATE_NOT_TESTABLE`: DESTINATION REFUSED | the function, by the rule | DB over HTTP (the stored address moved off loopback); DB function level, the product's rule: LOOPBACK, LINK_LOCAL, PUBLIC_ADDRESS, OUTSIDE_CAMERA_SUBNET, HOST_ADDRESS |
| 409 `CANDIDATE_NOT_TESTABLE`: NO NETWORK CONFIGURATION | `storedCameraAddressRuleOf(undefined)` refuses every address (`NOT_CONFIGURED`, C55) | unit (new case) |
| 409 `CREDENTIAL_REQUIRED`, 503 `CREDENTIAL_STORE_NOT_READY` | the function | DB function level; unit |
| 409 `CONNECTION_TEST_IN_PROGRESS`, 429 `CONNECTION_TEST_RATE_LIMITED` | the limits | unit |
| 429 `CONNECTION_TEST_LOCKOUT_GUARD` with `retry-after` | the limits | DB over HTTP (this camera, and the right camera of the same host); DB function level; unit |
| 503 `DISCOVERY_NOT_READY` | no reader handed in | DB over HTTP; acceptance |
| RELAY PROGRAM NOT CONFIGURED | no refusal: the module's tester answers the ONVIF half's own outcome | acceptance (that Core has no `captureRelayPath`: 200 REACHABLE) |

**The outcome entry.** `testAdoptedCamera` (`CD/adopted-test.ts`), after `turn.end(...)`, hands ONE `CAPTURE_DEVICE_CONNECTION_TESTED` entry to a new host seam, `record(entry)`; the module's plugin gives it `app.pipeline.run(...)` with `unit.audit.append(entry)` - one unit of work. The details are built by the contract's one builder, `captureDeviceConnectionTestedDetails`: `deviceId`, `outcome`, `adapter`, `sourceClass`, `operationId`, `permission`, and `guardTripped: true` on the refused credential that closed the host, `reason: SCHEME_NOT_ALLOWED` for a credential that was not sent. The builder takes no credential, address, locator or device text; a source test holds that it is handed `camera.adapterKind` and `attempt.outcome` and nothing else of either object.

So a test the camera answered writes EXACTLY TWO entries, in this order: the reader's `CAPTURE_CREDENTIAL_REVEALED` (committed in the reader's own unit before the credential is returned, unchanged), then the outcome. The read is still outside any unit: the file opens none.

| Test | Entries |
|---|---|
| refused before the reader (lock, 503, 404, not testable, the bounds, the guard) | 0 |
| the read failed (nothing stored; store not ready) | 1: the reader's entry of the call. No outcome entry |
| the adapter refused before a request | 1: the reveal. No outcome entry; code `CAPTURE_STORED_TEST_NOT_SENT` in the log and the persistent error log (new) |
| the camera answered (any of the five outcomes) | 2: the reveal, then the outcome |
| the outcome unit failed | 1 (the reveal); the failure TRAVELS ON (no answer), code `CAPTURE_STORED_TEST_OUTCOME_NOT_RECORDED` in the log and the persistent error log; the guard has counted |

**The served request.** `cardAnswer` of `AC/service.ts` answers `usbSerial` and `usbPort` for operations 98 / 99's listing: the listing's own text when it has the contract's closed form (`CAPTURE_AUDIO_USB_SERIAL_PATTERN`, `CAPTURE_AUDIO_USB_PORT_PATTERN`, imported), else `null` - never cut, never repaired. Neither value is in a log line or an audit detail.

## 2. Change set

| File | State | What |
|---|---|---|
| `CD/adopted-test-route.ts` | new | the route of operation 108 |
| `CD/adopted-test.ts` | changed | header; host seam `record`; step 10 (the outcome entry); two codes; a note and an error-log entry where the adapter refuses after the reveal |
| `CD/index.ts` | changed | the import, the `record` line of the host, the mount line `registerAdoptedCameraTestRoute(app)`, the comment |
| `CD/__tests__/adopted-test.test.ts` | changed | the seam in the world; 6 new cases (outcome entry x4 + no network configuration, the route file x1); the source rule restated |
| `CC/__tests__/adopted-camera-test.db.test.ts` | changed | the app is BOOTED with the relay as its relay program; `record` real; "exactly one" restated; 4 cases over HTTP; ONVIF double 8557 -> 8555 |
| `CS/test/acceptance/contract.test.ts` | changed | the named deferral ended (both lists, the literal of block 1), router pin 105 -> 106; operation 108 called in the camera-search area and in area 4 |
| `CS/test/acceptance/rbac-matrix.test.ts` | changed | `DEFERRED_ROUTE` entry out; routed operations 102 -> 103; denied cells of an INVESTIGATOR 19 -> 20 |
| `CC/__tests__/routes.test.ts` | changed, ONE entry | the route named in `OTHER_UNITS` (as rows 197 and 108 did) - outside the first claim, declared |
| `AC/service.ts` | changed | `cardAnswer`: two members, `answeredIdentityOf`, the header sentences |
| `AC/__tests__/service.test.ts`, `AC/__tests__/routes.db.test.ts` | changed | the pinned answer gains both members; one new unit case; two assertions that said "not answered" restated |

## 3. Tests whose "exactly one" became two

| File | Case | Before | Now |
|---|---|---|---|
| `CC/__tests__/adopted-camera-test.db.test.ts` | "a passed test ... REACHABLE through the real relay" | `added` has length 1 (the reveal) | length 2: `[CAPTURE_CREDENTIAL_REVEALED, CAPTURE_DEVICE_CONNECTION_TESTED]`, the reveal's `seq` lower, the outcome's keys exact |
| same | "THE CELL ... refuses the stored RTSP credential twice" | trail +2; two reveals | trail +4: reveal, outcome, reveal, outcome (`guardTripped: true` on the second); the refused third, fourth and same-host attempt still +0 |
| same | "no credential is stored" | 1 entry (the reader's) | UNCHANGED at 1 - title says why: no camera answered |
| `CD/__tests__/adopted-test.test.ts` | "the order: stored facts ..." | calls `query, rule, reader, tester` | `..., record` |
| same | "the control of an app" | the same four calls | `..., record` |
| same | "the sources: no unit of work and no audit append in the file" | the file names no `audit`, no `AuditType` | the file opens no unit and appends nothing; it names ONE audit type once, builds its details once, calls `host.record(` once, after `turn.end(` |
| `CD/adopted-test.ts` header | "EXACTLY ONE ENTRY PER TEST THAT REACHED THE READER" | - | "EXACTLY TWO ENTRIES PER TEST THAT GOT AN ANSWER FROM THE TESTER" |

## 4. Deferrals ended (by delta)

`LANDED_UNROUTED` and `UNROUTED_UNTIL` of `contract.test.ts`: the entry `POST /api/v1/capture/devices/{id}/test` out of both; the literal of block 1 without `testCaptureDeviceConnection`; router 105 -> 106. `DEFERRED_ROUTE.testCaptureDeviceConnection` of `rbac-matrix.test.ts` out; routed 102 -> 103; INVESTIGATOR denied cells 19 -> 20. Agent A2 (row 107) moved the same pins on top in the same hour: they read 107, 104 and 19 -> 20 after `row 107`'s own +1 now. The coverage block lists operation 108 as `200; 401 NOT_SIGNED_IN; 403 NOT_PERMITTED; 404 NOT_FOUND; 409 CAPTURE_CONFIG_LOCKED|INVALID_STATE; 422 INVALID_INPUT` - every documented status produced, none listed as not produced.

## 5. Checks (this Mac; 2026-10-13; loopback only; sandbox off for runs that bind a port or reach PostgreSQL)

| Check | Command (in `CS`) | Result |
|---|---|---|
| Unit: the adopted test and the module's static rules | `npx vitest run --project unit --maxWorkers=2 src/modules/capture-discovery/__tests__/adopted-test.test.ts src/modules/capture-discovery/__tests__/static.test.ts` | last run: `Test Files 2 passed (2)`, `Tests 36 passed (36)`. Run 1 of the file: 1 red, MY new case (seven tests in one minute met the per-minute bound); fixed |
| Unit: folder, audio cards, route list, `credentials.test.ts` (unedited), adapters static | `... src/modules/capture-discovery src/modules/capture-inputs/audio-cards/__tests__/service.test.ts src/modules/capture-config/__tests__/routes.test.ts test/static/credentials.test.ts src/capture/adapters/__tests__/static.test.ts` | `Test Files 1 failed, 12 passed (13)`, `Tests 1 failed, 261 passed (262)`. The one red: `capture-config/__tests__/routes.test.ts:73`, the route `scanFactoryCameras` of row 107 not yet named there (agent A2); my entry is in |
| PostgreSQL, real relay, test camera on 8565 | `(ulimit -c 0; lockf heavy-host; lockf db-migrate; npx vitest run --project db --maxWorkers=2 src/modules/capture-config/__tests__/adopted-camera-test.db.test.ts)` | run 1: the suite did not start (the ONVIF double refuses port 8568: its closed list); run 2: `Test Files 1 passed (1)`, `Tests 11 passed (11)`, `0 remain with the run prefix`; passed again inside the last acceptance run |
| Audio-cards routes, composition | `... --project db ... src/modules/capture-inputs/audio-cards/__tests__/routes.db.test.ts src/__tests__/capture-composition.db.test.ts` | both files passed (in the first acceptance run: `2 passed` of 4 files) |
| Acceptance contract and rbac matrix | `... --project db --maxWorkers=2 test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts` (both locks) | run 1: `Tests 22 failed, 87 passed (109)` - one mine (the INVESTIGATOR cell, moved); run 2: `Tests 21 failed, 70 passed (91)`, `0 remain`. ALL 21 are the two operations `acceptInstallation` and `revokeInstallationAcceptance` that are in the registry in flight (110 operations, no route, no deferral entry, no row in the composed document): `108` pins that read 110, `spec §7 has no row for the registry operation acceptInstallation`, the two paths in every unregistered list, and the 401 walk that stops at its count. No failure names operation 108 |
| Static rule files | `... test/static src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts src/modules/capture-config/__tests__/static.test.ts src/plugins/permission-guard/__tests__` | `credentials.test.ts` green, unedited; adapters static green. Red in files of other rows, none from this row: `test/static/search-path.test.ts:94` (`factory-scan/service.ts`, row 107), `capture/__tests__/static.test.ts:406, :738` (SR-2 and the `index.ts` edit list), `capture-config/__tests__/static.test.ts:175` (`host-alias/journal.ts`, `lifecycle.ts`, row 106), the five permission-guard pin files (108 -> 110) |
| Typecheck | `npx tsc --noEmit -p .` | 0 errors in a file of this row. At the end: `src/__tests__/capture-composition.test.ts(256..267)` `typedProbeRuleOf` (another row, in flight) |
| Lint, secret scan | `npx oxlint` on the touched files; `node scripts/secret-scan/count-only.mjs` | 0 warnings after one fix; `TOTAL: 0 in 0 file(s)` |

Facts of the database run over HTTP (`.cache/task4-row146/facts.log`): refusals 401, 403, 422, 404, 404, 409 with audit entries +1 (the `ACCESS_DENIED` row), reveals +0, outcome entries +0, ONVIF requests +0; `200 REACHABLE`, `usableProfileCount 1`, the camera's `auth_digest_ok 4`, `auth_basic 0`, entries `[CAPTURE_CREDENTIAL_REVEALED, CAPTURE_DEVICE_CONNECTION_TESTED]`; the guard: `AUTHENTICATION_FAILED`, `AUTHENTICATION_FAILED`, then `429`, `429` (same host), entries +4 then +0, the camera's `auth_digest_refused 2`. The last case of the file: 0 occurrences of 7 texts (the account, both secrets, the locator, the path, the decoy account of the request body) in the log at trace, the error log, the audit trail, every answer and every note.

## 6. Doubles, and what stays unproven

- Doubles: the test camera (`rtsp_test_camera.py`, 8565), the scripted ONVIF device (8555), the fake ONVIF stub of the acceptance file with a reader that is an object of that file (static rule R-6 keeps the wiring in `CC`'s tests), the test rule of `test/support` for loopback. Real: the relay binary through the production door (not rebuilt), the reader through its wiring, the pipeline, the audit chain, the route through all stages of a booted app. The stored credential of every case is the test camera's synthetic constant or a value the test writes.
- Unproven: the route on a Core whose reader is handed in by the production composition under REAL_PRODUCTION with a real network configuration; a real camera's lock-out rule (`9A/H-10`); the source address on a host with two interfaces (`9A/H-09` to `H-11`, row 143b's list); the serial and port of a real card (`9A/H-07`, `H-08`).

## 7. DRIVER DECISIONS (for the controller to confirm)

1. **A Core in simulated capture answers `503 DISCOVERY_NOT_READY`, not the simulator's synthetic 200.** V3's request line (1) asked for the synthetic answer; the brief of this row does not. A server that contacted nothing does not say `REACHABLE`; the contract already states the 503 for a Core whose reader was not provided.
2. **No outcome entry without an answer of a camera** (a failed read, an adapter refusal before a request). The type's `outcome` is one of five answers; none fits. Both are codes in the log and the persistent error log. Request line (b).
3. **The stream count is not in the audit entry**: the type's closed list has no key for it. It stays in the log line. Request line (a).
4. **An outcome that cannot be recorded fails the request** (the error travels on) instead of answering a result that is not in the audit. The guard has counted by then.
5. **The entry's `deviceId` column is the caller's client device** (null for the web console), as on `CAPTURE_CONNECTION_TESTED`; the camera is `details.deviceId`.
6. **`cardAnswer` holds each value to the contract's pattern itself** (null outside it) although the listing has the same rule: an answer outside its schema would be a 500.
7. **Edits outside the first claim**, each a direct consequence of the route: one entry in `CC/__tests__/routes.test.ts`; the two count lines of `rbac-matrix.test.ts` (routed, INVESTIGATOR cells). Declared in the closing claims line.
8. **The ONVIF double on 8555** (not 8557, by the brief; the double's closed list has no port of 8565-8574). Request line.
9. New files with Write; every existing file with the Edit tool only - no scripted replace, no shell append.

## 8. Requests left in `delegation_progress/file_requests.md`

Three lines beginning `row 146b (agent A4)`: the outcome type (stream count; no outcome for a test that was not sent); text of operation 108 in `packages/shared` and one stale comment; the port list of the scripted ONVIF double.

---
*Generated: 2026-10-13*
