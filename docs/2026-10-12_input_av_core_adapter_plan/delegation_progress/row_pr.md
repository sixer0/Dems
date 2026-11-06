# Row PR (wave 12, agent PR) - operation 108 stores a camera's profiles (C117)

Status: complete. Record: `implementation/pr_profiles_from_connection_test.md`. Nothing committed or staged.

## What each case does

- (a) no stored profile (empty list, no stream row): the list and one stream row per judged stream are stored by the
  adoption's `writeAdoptedCameraColumns`, in ONE engine unit with the outcome entry; entry `details` unchanged
  (`REACHABLE`, `usableProfileCount: N`), message ends `; profiles stored: N`.
- (b) a stored statement the stream no longer makes: nothing stored; message ends
  `; STREAM_PROFILE_DIFFERS: stored N, stated N, differing N; nothing stored`; error-log code
  `CAPTURE_STORED_TEST_PROFILE_DIFFERS` with the counts. Outcome stays `REACHABLE`.
- (c) agree: nothing stored; entry, log line and error log exactly as rows 146b / 146c.

## Files

Code: `apps/core-server/src/modules/capture-discovery/adopted-profiles.ts` (NEW), `adopted-test.ts`,
`adopted-test-route.ts` (header), `adoption.ts` (one extracted function), `index.ts` (one host member);
tests `capture-discovery/__tests__/adopted-test.test.ts`, `capture-config/__tests__/adopted-camera-test.db.test.ts`.
Docs: this file, the record, three lines in `file_requests.md`, one in `file_claims.md`.

## Checks (2026-10-14, final tree)

| Check | Result line |
|---|---|
| `tsc --noEmit` (apps/core-server) | exit 0, no output |
| unit: `src/modules/capture-discovery`, `test/static`, `src/capture/__tests__/static.test.ts`, `src/capture/adapters/__tests__/static.test.ts` | Test Files 28 passed (28), Tests 499 passed (499) |
| `adopted-test.test.ts` + `test/static/credentials.test.ts` (unedited: `git diff` empty) | Test Files 2 passed (2), Tests 48 passed (48); the first holds 34 cases, 9 new |
| db, under `.locks/db-migrate.lock`, cases under the heavy-host lock: `adopted-camera-test.db.test.ts` (camera 8569 as before; the row's cases on 8571; ONVIF 8555) | Test Files 1 passed (1), Tests 18 passed (18), 268 s; one run |
| db, the adoption unedited: `connect.db.test.ts`, `minted-code.db.test.ts`, `capture-discovery.db.test.ts` | Test Files 3 passed (3), Tests 48 passed (48), 292 s; one run |

Database tests that did NOT run: none of those planned. Not run at all (not in the brief's list, named for
honesty): `capture-discovery.booted.db.test.ts`, `capture-composition.db.test.ts`, `camera-adapter-open.db.test.ts`,
the full suites.

The cases' own lines (`.cache/task4-row146/`): `(a) stored for CAM-01: profiles ["HEVC_1080P"], one stream row
(profile_1, vs_0, lens 1, MAIN, HEVC 1920x1080)`; `(a) 200, stored 1 code and 1 stream row, entries +2; (c) 200,
nothing stored, entries +2`; `(b) 200 REACHABLE, nothing stored, STREAM_PROFILE_DIFFERS 1/1/2; hostile description:
NOT_H264, usable 0`.

## Mutations (each made with the Edit tool, run, reverted at once)

M1 empty list read as agree; M2 a write on a difference; M3 codec / width / height not compared; M4 streams read
whatever the outcome; M5 the unit's session check removed; M6 the entry's words empty; M7 `assertAdoptedProfiles` a
no-op. Each RED on the cases the record names (1 to 6 failed of 34). Not run as a mutant: a position-wise list
comparison for case (c) - stated in the record.

## One existing expectation changed

The source pin of `adopted-test.test.ts` ("the sources: ..."): 3 inline `recordOutcome` calls (was 4), the facts read
from `const facts: OutcomeFacts`, the two-writer line pinned. Nothing else of an existing case was edited.

## Requests (file_requests.md, three lines "row PR")

1. V7: the engine door for a device's stored list, called at the marked comment of `settleStatedProfiles` - blocking
   for a screen showing the list without a restart.
2. V7: contract members - `profiles` (`PROFILES_STORED` | `STREAM_PROFILE_DIFFERS`) on the answer of operation 108
   and on the audit details, with `storedProfileCount`, `statedProfileCount`, `differingProfileCount`.
3. Controller: seven driver decisions to confirm (engine unit; "no stored profile" = empty list and no stream row;
   a listed code without a row is a difference; tokens and lens not compared; `PROFILES_NOT_STORED` ends;
   `last_seen_at` set by the adoption's statement; one member in the module's `index.ts`).

## Rules kept

Edit tool only for existing files (new files with Write); no scripted replace, no shell append. No commit, stage,
stash. No real device, no credential. Doubles: the fake ONVIF device (8555), `rtsp_test_camera.py` (8571), the built
relay (not rebuilt). Throw-away databases only. Unproven: a real camera on the camera network (hardware package).
