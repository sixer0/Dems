# Row R1 (agent R1, track D) - finding F3-01: the Core reads the relay's `camera_lost` / `camera_reopened`

Status: **complete** on this Mac's doubles. Record: `implementation/r1_relay_report_reader.md`.

## Files
- Source (apps/core-server/src): `capture/adapters/camera/relay-start.ts` (the reader), `capture/adapters/camera/onvif-relay.ts`, `capture/adapters/camera/camera-watch.ts`, `capture-session/ingest-pairing.ts` (interface only), `capture-session/index.ts`.
- Tests extended: `capture/adapters/camera/__tests__/onvif-relay.test.ts`, `camera-watch.test.ts`, `capture-session/__tests__/ingest-pairing.test.ts`, `session-capture.db.test.ts`, `modules/capture-config/__tests__/camera-adapter-open.db.test.ts`.
- Docs: `implementation/r1_relay_report_reader.md`, this file; one line in `file_claims.md` (+ closing line), three in `file_requests.md`.

## Checks
- Unit (reader, adapter, watch, session, composition, log calls): `Test Files 7 passed (7)`, `Tests 201 passed (201)`.
- Session database suite: `Tests 96 passed (96)`, `0 remain` (third run; runs 1 and 2 after a failure in my own new case and after two lint edits).
- T-2 file with the scenario: 11 existing cases passed; the scenario `Tests 1 passed, 11 skipped (12)` on its third run (both failures in my own new assertions).
- Static set: `1 failed, 399 passed (400)` - `src/capture/__tests__/static.test.ts:646`, row B1's, not edited.
- Typecheck: 0 errors in this row's files; 7 in `src/capture/boot/__tests__/` (boot rows in flight).

## Measure
Camera's loss to the Core's fault. Before: never when the camera comes back; 62.14 s when it stays away (the relay's end). After: 1 ms to the line read, 25 ms to the fault active on the engine; cleared 11 ms after the re-open line; absence 3,048 ms on the two audit rows = the relay's own gap.

## Requests left
1. Contract members for a video absence (audit type, signed manifest member, warning reason, README limit) - not blocking; before M6.
2. Row 88 / composition: information and three conditions; one composition test asked.
3. Reds not this row's.

## Driver decisions
1. Leg reports on the existing `relayReports` source, marked by `leg` (no composition change needed).
2. The fault is the existing `CAMERA_STREAM_ENDED` of that camera.
3. Order doubts are settled toward the fault standing.
4. The session states the absence in the persistent error log (warn); no audit row of its own.
5. `relay-start.ts` edited: the reader lives there.

Edit-only rule kept. Nothing committed. No C changed, no binary rebuilt.
