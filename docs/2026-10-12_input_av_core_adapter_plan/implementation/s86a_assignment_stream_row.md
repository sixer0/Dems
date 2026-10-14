# Row S86a - assignment refuses a profile without its stored stream row (caution C-1 of row 86)

Agent S86a, wave 12, track D, 2026-10-14. Status: **complete**. Size S.
Source: `verification/086_pre_lift_security.md` line 76 (C-1) and section 4 answer (1); decision C127 (routing of C-1 to S86a); C61 (1) (raw token in code form); C117, C126 and `implementation/pr_profiles_from_connection_test.md` case (b) (operation 108 stores nothing on a difference, and "a listed code with no stream row" is a difference).

## 1. What was found

On a Core in real capture, the assignment of a production camera (adapter `ONVIF_RTSP`) by operations 78 / 79 checked only the device's stored profile LIST (`routes.ts` `assertOwnProfile` with `store.ts` `readCameraProfiles`, `SELECT d.id, d.profiles`). The camera adapter's open reads the code's STORED STREAM ROW (`capture_device_streams`, `capture/adapters/camera/onvif-relay.ts:662-667`, statement `READ_STORED_STREAM_TOKEN` in `capture-composition.ts:202`) and refuses a code without one (`CAPTURE_PROFILE_UNKNOWN`, before the reveal). So a raw token in code form (C61, e.g. `PROFILE_1`) or a listed code no stream stated was accepted at assignment and refused only at the start.

## 2. What is built

| File | Change |
|---|---|
| `apps/core-server/src/modules/capture-config/store.ts` | NEW `READ_CAMERA_STREAM_PROFILES` = `SELECT s.device_id AS id, s.profile FROM public.capture_device_streams s` (key columns only, no token, no parameter, no credential table; `dems_app` holds SELECT on the table since migration 0016) and `readCameraStreamProfiles(reader)` -> codes with a stream row, by camera; a row whose key is not text states nothing (fail closed). `readCameraProfiles` unchanged (row PR's test imports it). |
| `apps/core-server/src/modules/capture-config/routes.ts` | NEW pure judge `ownProfileFindingOf(inForce, listed, streamed)` -> `NOT_STATED` / `NOT_OF_DEVICE` / `WITHOUT_STREAM` / null; `assertOwnProfile` answers each finding through one table (`OWN_PROFILE_ANSWER`); the edit reads the stream codes with the list, under the same condition. Header lists the new refusal. |
| `__tests__/routes.test.ts` | one describe appended, three cases (judge, seam, reader). |
| `__tests__/capture-config.db.test.ts` | block 5 fixture: the OWN code now also gets its stream row (what an adoption leaves; without it the earlier cases would now meet the new refusal - no expectation of theirs changed); one case appended. |

### The refusal

`422 INVALID_INPUT`, `details: { in: 'body', reason, deviceId, trackId }`, nothing stored, no audit row.
- `details.reason`: `PROFILE_WITHOUT_STREAM_REASON` = `CAMERA_PROFILE_NOT_OF_DEVICE` - the closest EXISTING word (clients already have a sentence for it). A new word is a contract change in packages/shared (V7b's in this wave): **request line** in `file_requests.md` proposes `CAMERA_PROFILE_WITHOUT_STREAM`; when it lands, `PROFILE_WITHOUT_STREAM_REASON` is the one line to change.
- `error.message` (`PROFILE_WITHOUT_STREAM_TEXT`): "This camera was not assigned: the Core holds no stream facts for this profile, so the camera cannot record it. A connection test does not repair this. Adopt the camera again, then assign one of the profiles it states."
- Order: no profile -> `CAMERA_PROFILE_NOT_STATED`; not listed -> `CAMERA_PROFILE_NOT_OF_DEVICE` (list sentence); listed without a stream row -> the new refusal. A stream row alone admits no unlisted code. Applies to a HELD slot too (operation 79 keeps a code the open would refuse).

### Real and simulated paths

Unchanged gate of row 187: the rule runs only when a device registry is provided (`seams.deviceRegistry() !== null` - a real capture operation; Simulated mode provides none) AND the committed device slice says the camera's adapter is `ONVIF_RTSP` (production class). Both reads (list and stream codes) happen only then (`assignsProductionCamera`). Simulated mode, development, fake and built-in cameras and microphones make no read and meet no new rule; the simulator's engine (packages/shared) is not touched.

## 3. Tests and mutations

| Test | Proves |
|---|---|
| unit `row S86a ... the judgement` | four outcomes; fail closed for a camera with no reads |
| unit `... the seam` | existing word, sentence names re-adoption and "connection test does not repair", no code or token in it |
| unit `... the reader` | statement on the stream table only, no `$1` / token / credential; codes by camera; non-text rows dropped |
| db `row S86a (C-1)` (REAL_PRODUCTION, throw-away clone) | `PROFILE_1` (C61) and `H264_1080P25_MAIN` (listed, no row) refused by 78 with reason + sentence, 0 rows, nothing stored; unlisted code with a stream row refused by the list rule (control); the code with its stream row admitted (1 row); stream row removed -> 79 on the held slot refused, slot unchanged; SIMULATED: `PROFILE_1` without a stream row assigned (200) as before |

Mutations (each seen RED, then reverted; leftovers grep empty):
- M1 judge admits a listed code without a stream row (`|| true`): unit judgement RED, db S86a case RED.
- M2 the refusal answers the list sentence (`OWN_PROFILE_TEXT`): db S86a RED ("expected 'A production camera is assigned with ...' to be 'This camera was not assigned: the Cor...'").
- M3 the reader merges all cameras' codes: unit reader RED.
- M4 the profile/stream rule also on the simulated path (`registry === null` gate removed): db S86a (SIMULATED leg) and the existing row 187 SIMULATED control RED.

## 4. Checks (result lines)

- Unit, `src/modules/capture-config/__tests__/` (`--maxWorkers=2`): `Tests 1 failed | 125 passed (126)`. The one red is `static.test.ts:175` R-5 (`src/modules/capture-discovery/adopted-profiles.ts` writes a reveal reason) - **I-9c's**, not this row's. (A first run also showed `credential-reader.test.ts` C127 / S-04 red - V7b in flight; green on the second run.)
- `routes.test.ts` alone: `Tests 28 passed (28)`.
- DB, `capture-config.db.test.ts` whole file on throw-away clones under `.locks/db-migrate.lock`: `Tests 36 passed (36)`. Block 5 alone before mutations: `5 passed | 31 skipped`.
- Core typecheck `tsc --noEmit`: exit 2, errors ONLY in files not touched here: `capture/__tests__/fault-lifecycle.test.ts`, `forwarder-advisories.test.ts`, `forwarder-engine.test.ts`, `capture/adapters/mic-transport.ts`, `capture/fence/__tests__/development-session.db.test.ts`, `capture-config/__tests__/adopted-camera-test.db.test.ts:366`, `camera-adapter-open.db.test.ts:431` (stored-address port type - V7b's S-04 in flight), `capture-config/network/service.ts` (V7b), `test/support/capture.ts`. 0 in `routes.ts`, `store.ts`, `routes.test.ts`, `capture-config.db.test.ts`.
- Core lint `oxlint`: exit 0 (warnings in other files only); the four files of this row: 0 findings.

## 5. Not done / open

- Clients: until the new word lands, a refused raw code reads the client's LIST sentence ("not one of the profiles stored for this camera"), which is imprecise; the Core's `error.message` carries the re-adopt sentence. The device entry (`captureDeviceProfilesOf`, packages/shared) lists every listed code, including a raw one, so a client can still offer it (C-1's V7 half, "the entry lists only codes with a stream row", is not built by this row and not in its files).
- README sentence: request line to C2.
- The check is made at assignment from reads OUTSIDE the engine unit (as row 187's list read); a stream row removed between assignment and start is still refused at the open (unchanged). The runtime role cannot delete stream rows.
- DRIVER DECISION: reused `CAMERA_PROFILE_NOT_OF_DEVICE` behind the seam constant rather than inventing a module-only word the clients cannot word.

Edit tool only for existing files; the record and the row file are new files (Write). Nothing committed, nothing left running; packages/shared not touched.
