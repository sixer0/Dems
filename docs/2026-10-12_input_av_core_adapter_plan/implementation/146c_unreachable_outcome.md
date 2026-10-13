---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 146c
milestone: M3 / AD-03, AD-12
date: 2026-10-13
agent: coder-execution (driver, track D)
tier: T3
requirement: decisions C58, C75 (1), C83; the request line of row V4 to "row 146c" (`delegation_progress/file_requests.md`); AD-03 point 5
status: complete (built and checked on doubles; the acceptance pair is red ONLY on operations 106 / 107 of row 111, in flight - section 5)
---

# Row 146c: the outcome entry of every stored-credential test that reached the reader

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CS` = `apps/core-server`, `CD` = `CS/src/modules/capture-discovery`, `CC` = `CS/src/modules/capture-config`.

## 1. Statement

`testAdoptedCamera` (`CD/adopted-test.ts`) now writes ONE `CAPTURE_DEVICE_CONNECTION_TESTED` entry for every test that reached the reader of the stored credential, whatever came after. The decision of row 146b "no outcome entry unless a camera answered" is reversed (decision C75 (1)). The entry is written by one function of the file, `recordOutcome`, called at the four ends of a test that reached the reader; it is handed the adapter KIND and a closed object of codes, a flag and a count (`OutcomeFacts`), and builds the details with the contract's one builder. No credential, address, locator or device text can reach it: it sees no camera object, no credential and no attempt.

The reveal entry is untouched: it is the reader's, committed in the reader's own unit before the credential is returned. The read is still outside any unit of work; the file opens none.

## 2. The table: case -> entries written

| Case | Answer | Entries, in order |
|---|---|---|
| Refused BEFORE the reader: session open, seam missing (503), unknown device or a microphone (404), no production camera row, stored address refused by the rule, NO NETWORK CONFIGURATION, single flight (409), spacing (429), lock-out guard (429) | the refusal | 0 |
| Answered and passed | 200 `REACHABLE` | 2: reveal; outcome `REACHABLE`, `usableProfileCount` n |
| Authentication refused | 200 `AUTHENTICATION_FAILED` | 2: reveal; outcome with `usableProfileCount: 0`, `guardTripped: true` on the one that closed the host, `reason: SCHEME_NOT_ALLOWED` when the credential was not sent |
| `WRONG_PROFILE`, `NOT_H264` | 200 | 2: reveal; outcome, `usableProfileCount: 0` |
| UNREACHABLE AFTER THE REVEAL: the camera or its stream does not answer, the whole-test deadline | 200 `UNREACHABLE` | 2: reveal; outcome `UNREACHABLE`, `usableProfileCount: 0`, NO `unreachableReason` |
| THE RELAY COULD NOT BE STARTED (the ONVIF half was asked) | 200 `UNREACHABLE` | 2: the same |
| Nothing stored for the camera | 409 `CREDENTIAL_REQUIRED` | 2: the reader's entry of the call; outcome `UNREACHABLE`, `unreachableReason: CREDENTIAL_NOT_READ`, no count |
| The store could not be read (the reader's failure after its gate) | 503 `CREDENTIAL_STORE_NOT_READY` | the reader's own entry if it committed one, then 1: outcome `UNREACHABLE`, `CREDENTIAL_NOT_READ` |
| REFUSED BY THE DESTINATION RULE AFTER THE READER WAS CALLED (the reader's own gate on the device or its stored address) | 409 `CANDIDATE_NOT_TESTABLE` | 1: outcome `UNREACHABLE`, `CREDENTIAL_NOT_READ` (that gate stands before the reveal function: the reader writes none - measured) |
| The adapter refused the camera before a request | 409 `CANDIDATE_NOT_TESTABLE` | 2: reveal; outcome `UNREACHABLE`, `unreachableReason: NOT_SENT`, no count |
| The tester FAILED (a fault) | the fault travels on | 2: reveal; outcome `UNREACHABLE`, no reason, no count |
| The outcome entry cannot be recorded, on any of the ends above | THE UNIT'S FAILURE travels on - in place of the result, of the 409 / 503, or of the tester's fault | the reader's entry only; code `CAPTURE_STORED_TEST_OUTCOME_NOT_RECORDED` in the log and the persistent error log |
| The test called from inside a unit of work | the fault `PIPELINE_REENTRANT` of the outcome unit (was 503) | 0 (the reader refused before its entry; the outcome unit cannot be opened) |

## 3. The description sentence followed for a test refused before the reader

Operation 108, `packages/shared/src/api/capture-discovery.ts:1499`: "Refusals **before the credential is read** and before any request leaves the Core, with no audit row: `404 NOT_FOUND` for a device that is no registered camera; `409 INVALID_STATE` with `details.reason` `CANDIDATE_NOT_TESTABLE` (...) or `CONNECTION_TEST_IN_PROGRESS`; the bounds below." So nothing is written for them. `CREDENTIAL_NOT_READ` is NOT their reason: the type's words (`:1407`) are "the reader was called and handed nothing on: nothing is stored for the camera, or the credential store could not be read" - a reason of a test that reached the reader.

## 4. Change set

| File | State | What |
|---|---|---|
| `CD/adopted-test.ts` | changed | header (step 10 and "what is audited"); `OutcomeFacts`; `recordOutcome` (the one builder call and the one `host.record(` of the file); three new calls of it (the read that handed nothing on, the adapter refusal, the tester's fault) before the refusal or the fault is thrown; `usableProfileCount` in the answered entry - ONE constant for the answer and the entry; code `CAPTURE_STORED_TEST_FAULT` (log and persistent error log); the 503 sentence is the shared constant `CAPTURE_DEVICE_TEST_NOT_READY_SENTENCE` |
| `CD/adopted-test-route.ts` | changed, header text only | the 200 line; a paragraph for the refusals that come after the reader was called |
| `CD/__tests__/adopted-test.test.ts` | changed | 22 -> 25 cases: section 2's rows on doubles; the source rule restated for the one writer |
| `CC/__tests__/adopted-camera-test.db.test.ts` | changed | 11 -> 15 cases; `bounds` takes an optional tester and reader |

Not touched: `packages/shared`, `CD/index.ts`, the acceptance files, `credentials.test.ts`.

## 5. Checks (this Mac; 2026-10-13; loopback only; sandbox off for runs that bind a port or reach PostgreSQL)

| Check | Command (in `CS`) | Result |
|---|---|---|
| Unit, the function | `npx vitest run --project unit --maxWorkers=2 src/modules/capture-discovery/__tests__/adopted-test.test.ts` | run 1: 1 red, MY source rule (the word "camera" of the entry's fixed sentence); run 2: `Test Files 1 passed (1)`, `Tests 25 passed (25)` |
| PostgreSQL, the real relay, test camera 8565, ONVIF double 8555 | `(ulimit -c 0; lockf heavy-host; lockf db-migrate; npx vitest run --project db --maxWorkers=2 src/modules/capture-config/__tests__/adopted-camera-test.db.test.ts)` | one run: `Test Files 1 passed (1)`, `Tests 15 passed (15)`, `0 remain with the run prefix` |
| The module's folder, the static set, the route list | `... --project unit ... src/modules/capture-discovery test/static src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts src/modules/capture-config/__tests__/static.test.ts src/modules/capture-config/__tests__/routes.test.ts` | `Test Files 2 failed, 28 passed (30)`, `Tests 2 failed, 520 passed (522)`. The two red are files of other rows in flight: `test/static/search-path.test.ts:94` (migration `0027_alias_removal_reasons_privileges.sql` not in its list) and `capture/adapters/__tests__/static.test.ts:296` (`src/capture/index.ts:69`) |
| `credentials.test.ts`, not edited by this row | `... --project unit ... test/static/credentials.test.ts` | `Test Files 1 passed (1)`, `Tests 14 passed (14)` |
| The acceptance pair | `(both locks) ... --project db --maxWorkers=2 test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts` | `Tests 6 failed, 76 passed (82)`, `0 remain`. ALL 6 name only `setCameraNetwork` / `getCameraNetworkJob` (operations 106 / 107, row 111: routed, pins at 108 not yet 110; INVESTIGATOR 24 -> 26, SUPERVISOR 7 -> 9). None names operation 108 |
| Typecheck | `npx tsc --noEmit -p .` | 0 errors in a file of this row; 3 in `src/modules/capture-config/factory-scan/index.ts` (another row, in flight) |
| Lint, secret scan of the four files | `npx oxlint <files>`; `node scripts/secret-scan/count-only.mjs <files>` | exit 0, no finding; `TOTAL: 0 in 0 file(s)` |

Facts of the database run (`.cache/task4-row146/facts.log`, lines `[row146c]`): inside a unit - fault `PIPELINE_REENTRANT`, entries +0; nothing stored - 409, `[CAPTURE_CREDENTIAL_REVEALED, CAPTURE_DEVICE_CONNECTION_TESTED UNREACHABLE CREDENTIAL_NOT_READ]`; the reader's gate - 409, `[CAPTURE_DEVICE_CONNECTION_TESTED UNREACHABLE CREDENTIAL_NOT_READ]`, reveals +0; unreachable after the reveal - 200 `UNREACHABLE`, relay exit 20, two entries; relay not startable - 200 `UNREACHABLE`, told `CAPTURE_STREAM_TEST_RELAY_FAILED / NOT_STARTED`, two entries; 409 `CREDENTIAL_REQUIRED` over HTTP - entries +2, ONVIF requests +0. The file's last case (0 occurrences of every synthetic text in the log, the error log, the audit trail, the answers and the notes) is green with the new entries in the trail.

## 6. Doubles, and what stays unproven

- Doubles: as row 146b - the test camera (`rtsp_test_camera.py`, 8565), the scripted ONVIF device (8555), the test rule for loopback. "The camera does not answer" is the camera's port with no double running; "the relay cannot be started" is a relay program path that names no file. Real: the relay binary through the production door, the reader through its wiring, the pipeline, the audit chain, the route on a booted app. The stored credential of every case is the test camera's synthetic constant or a value the test writes.
- Unproven (hardware package): a real camera that stops answering between the reveal and the request (`9A/H-10`); the entries on a Core composed under REAL_PRODUCTION with a real network configuration.

## 7. DRIVER DECISIONS (for the controller to confirm)

1. **A fault of the tester after the reveal is recorded as a plain `UNREACHABLE`** (no reason, no count), then the fault travels on. The type has two reasons and neither is true for sure: what was sent is not known, and unknown is not said as `NOT_SENT`. The contract reads a plain `UNREACHABLE` as "the camera was asked and did not answer" - the nearer of the two statements, and the code `CAPTURE_STORED_TEST_FAULT` in the log and the error log tells the two apart. A third reason word would be a vocabulary step.
2. **A relay that could not be started is a plain `UNREACHABLE` with count 0**: the tester answers it as an outcome, and the ONVIF half did ask the camera, so `NOT_SENT` would be false.
3. **The reader's own gate refusal gets the entry too** (one entry, no reveal beside it): the brief's rule is "every test that reached the reader", and the contract's `CREDENTIAL_NOT_READ` is "the reader was called and handed nothing on".
4. **An unrecordable entry replaces the 409 / 503 of a failed read** (the unit's failure travels on), as V4's request line states it. Consequence, measured: a test called from inside a unit of work now ends in the fault `PIPELINE_REENTRANT`, not `503`.
5. **`usableProfileCount` is the answer's own number** (`usableProfiles.length` of a REACHABLE test, else 0), as the builder's contract says ("the answer's own"), not `streams.length` as V4's request line (c) wrote: one number in the answer and in the audit. A count above 16 is dropped by the builder.
6. Every existing file with the Edit tool only; the two record files are new.

## 8. Requests left in `delegation_progress/file_requests.md`

None.

---
*Generated: 2026-10-13*
