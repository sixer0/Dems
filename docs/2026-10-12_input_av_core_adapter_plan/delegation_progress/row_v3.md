# Row V3 (wave 10, track D) - the third contract-and-vocabulary step

Status: **complete**. Record: `implementation/v3_third_contract_step.md`. Date: 2026-10-13.

Counts after: 108 operations (39 GET / 69 POST), 82 audit types, 51 actions, 15 permissions; schema `[11, 'dbc-12']` untouched.

| Item | Result |
|---|---|
| 1 alias intent types | done: `HOST_ALIAS_REQUESTED`, `HOST_ALIAS_ADD_FAILED` (SECURITY), closed lists |
| 2 audio gap type | done: `CAPTURE_AUDIO_ABSENT_ON_RESTART` (DEVICE); writer = row 191b |
| 3 stored-credential test outcome | done: NEW type `CAPTURE_DEVICE_CONNECTION_TESTED` (SECURITY) - the existing list requires a candidate and a search |
| 4 operation | done: 108 `testCaptureDeviceConnection`, POST `/api/v1/capture/devices/{id}/test`, no body, access of operation 95; simulator synthetic, changes nothing |
| 5 `usbSerial` / `usbPort` | done in the contract (optional, nullable, `/^[A-Za-z0-9:._-]{1,64}$/`); the server's two answer lines are a request |
| 6 password policy move | done: `packages/shared/src/api/password-policy.ts`, one barrel line, identity file re-exports and binds; the demonstration constant and the Web Crypto digest are HANDED IN (two rules of the shared package) |
| 7 revocation reason | not done here by rule: it lives in `apps/core-server/src/modules/identity/biometric/store.ts:172` - row 215 (X1) |

Pins: 26 files, each by its delta (list in the record, section 7). `openapi.json`: generator, once - `108 operations ... offline: 42 operations ... 1624892 bytes`.

Checks: shared `77 files / 2109 tests passed`; Core unit `44 of 45 files, 1152 of 1153 tests` (the one red is `src/credential-store/__tests__/static.test.ts:89`, not this row's); web `3 files / 144 tests passed` after one missed pin; database `5 files / 112 tests passed` and the bulk fixture `26 passed`, `0 remain`; typecheck exit 0 in six workspaces.

Named deferrals added: `POST /api/v1/capture/devices/{id}/test` in `LANDED_UNROUTED` / `UNROUTED_UNTIL` and the block-1 literal of `test/acceptance/contract.test.ts`; `testCaptureDeviceConnection` in `DEFERRED_ROUTE` of `test/acceptance/rbac-matrix.test.ts`. Both name row 146b.

Requests left in `file_requests.md` (seven lines "row V3"): the route and the outcome row of operation 108; the two answer lines of `cardAnswer`; three exports of the core barrel and the notes for rows 106 and 191b; a ruling on the Try-it deny list; the ruling on C53's "no second random source"; item 7 to row 215; the red of the credential-store static test.

Driver decisions: DD-1 to DD-16 in the record, section 9. The ones that change a ruling's letter: the two departures of the policy move (DD-15); the two bounds of the gap are optional (DD-5); the simulator of 108 writes no audit row (DD-9); 108 is not on the Try-it deny list (DD-14).

Existing files: Edit tool only. New files by Write: the shared policy file and its test, the two records. `openapi.json` by the repository's generator.
