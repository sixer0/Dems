# Row 146c - the outcome entry of every stored-credential test that reached the reader

Status: **complete**. Record: `implementation/146c_unreachable_outcome.md`. Date: 2026-10-13.

## Files changed (Edit tool only)
- `apps/core-server/src/modules/capture-discovery/adopted-test.ts`
- `apps/core-server/src/modules/capture-discovery/adopted-test-route.ts` (header text)
- `apps/core-server/src/modules/capture-discovery/__tests__/adopted-test.test.ts`
- `apps/core-server/src/modules/capture-config/__tests__/adopted-camera-test.db.test.ts`

## Case -> audit entries
| Case | Entries |
|---|---|
| refused before the reader (lock, 503, 404, not testable, address rule, single flight, spacing, guard 429) | 0 |
| answered (five outcomes; unreachable after the reveal; relay not startable) | 2: reveal, outcome with `usableProfileCount` |
| nothing stored (409) | 2: reader's entry, outcome `UNREACHABLE` / `CREDENTIAL_NOT_READ` |
| reader's own gate (409) | 1: outcome `UNREACHABLE` / `CREDENTIAL_NOT_READ` |
| adapter refused before a request (409) | 2: reveal, outcome `UNREACHABLE` / `NOT_SENT` |
| tester fault | 2: reveal, plain `UNREACHABLE`; the fault travels on |
| outcome not recordable | the unit's failure travels on |

## Sentence followed (operation 108's description)
"Refusals **before the credential is read** and before any request leaves the Core, with no audit row" - so a test refused before the reader writes nothing.

## Checks
- unit `adopted-test.test.ts`: `Tests 25 passed (25)` (second run; first: 1 red of my own source rule)
- database with the real relay: `Tests 15 passed (15)`, 0 databases left
- folder + static set: `2 failed, 520 passed (522)` - both red in files of other rows (`search-path.test.ts:94`, adapters `static.test.ts:296`)
- `credentials.test.ts`: `14 passed (14)`, not edited by this row
- acceptance pair: `6 failed, 76 passed (82)` - all six on operations 106 / 107 (row 111 in flight), none on 108
- typecheck: 0 errors in this row's files (3 in `factory-scan/index.ts`, another row)

## Driver decisions (to confirm)
1. Tester fault after the reveal -> plain `UNREACHABLE` plus code `CAPTURE_STORED_TEST_FAULT`.
2. Relay not startable -> plain `UNREACHABLE`, count 0 (the ONVIF half asked the camera).
3. Reader's own gate refusal gets the entry (`CREDENTIAL_NOT_READ`).
4. An unrecordable entry replaces the 409 / 503; inside a unit of work the test now ends in `PIPELINE_REENTRANT`, not 503.
5. `usableProfileCount` is the answer's own number, not `streams.length`.

## Requests left
None.
