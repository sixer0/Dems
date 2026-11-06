# Row R2 - follow-ups of the phase-3 code review (F3-02, F3-03, F3-04, F3-06, F3-11)

Status: complete on doubles. Agent: coder-execution (R2, track D). Date: 2026-10-13.
Full record: `implementation/r2_m3_review_follow_ups.md`.

## Result per item

1. F3-02 - DONE: named entry SR-14 in `apps/core-server/src/capture/__tests__/static.test.ts` (the hand-on site `stored-address.ts`, three lines pinned, one origin of the value) with its control. Code left: the plain form is three places, not one line.
2. F3-03 - DONE: named entry SR-5, entry 2 (the bound signature of `OnvifTimeReader.read`; three production callers, all bound) with its control. Code left: the overload's deletion needs about 12 calls of a test file that is not this row's.
3. F3-04 - DONE: erratum of RC-6 appended as section 12 of `verification/06_security_relay_client.md` and one bullet in `apps/capture-worker/README.md`. Script and C files untouched.
4. (a) F3-06 - DONE at the Core for operations 95 / 96: `409 INVALID_STATE`, `details.reason: COMMISSIONING_NOT_CONFIGURED` (existing contract member) with the fitting sentence. The web's sentence and operation 108 are open.
   (b) F3-11 / C93 - DONE: operations 78 / 79 refuse the same camera on both video slots with `422 INVALID_INPUT`, `CAMERA_ON_BOTH_TRACKS` (existing simulator word) where a device registry is provided; `assertRecordableSelector` refuses it too (`CAPTURE_PLAN_INVALID`, `PROTOCOL_SHAPE`, the device named) before the registry is asked.

## Files

Changed (Edit tool only): `apps/core-server/src/capture/__tests__/static.test.ts`; `src/modules/capture-discovery/connect/service.ts`, `connect/__tests__/service.test.ts`; `src/modules/capture-config/routes.ts`, `plan.ts`, `__tests__/routes.test.ts`, `__tests__/plan.test.ts`, `__tests__/capture-config.db.test.ts`; `apps/capture-worker/README.md`; `verification/06_security_relay_client.md`; one line in `file_claims.md`, five in `file_requests.md`.
New: `implementation/r2_m3_review_follow_ups.md`, this file.

## Checks

- Capture static file: `Tests 72 passed (72)`.
- Static set + fence + capture-session (unit): `Test Files 51 passed (51)`, `Tests 966 passed (966)`.
- Unit, capture-config and connect: `Tests 66 passed (66)`.
- Database (connect, capture-config, credential reader, acceptance pair): `Tests 1 failed, 162 passed (163)`, `0 remain` - the one red is the schema-version pin of `connect.db.test.ts:276-279` (row D3's, in flight).
- Database with the real relay, one file at a time: `Tests 33 passed (33)`, `0 remain`.
- Typecheck: 2 errors, both in `src/sealing/__tests__/production-key-proof.db.test.ts` (row P1's, in flight); none in a file of this row.

## Driver decisions (for the controller)

- The number SR-14 (SR-13 is named in the decisions as an amendment not taken).
- The same-device refusal stands in real capture only; the simulator's rule (`packages/shared`) is untouched.
- A selector that already holds the state is not locked for other edits; the start rule holds it.
- RC-6's erratum is written in one place and pointed to; the three defining documents are not a driver's.

## Requests left (five lines `row R2` in `file_requests.md`)

Shared i18n sentence for `CAMERA_ON_BOTH_TRACKS`; the web's kind for `409 COMMISSIONING_NOT_CONFIGURED` (needed before F3-06 is closed for the operator); the same reason on operation 108 and in the contract text; the plain forms in `onvif-session.ts` / `stored-address.ts`; a pointer to the erratum in the three RC-6 documents, then row 86.
