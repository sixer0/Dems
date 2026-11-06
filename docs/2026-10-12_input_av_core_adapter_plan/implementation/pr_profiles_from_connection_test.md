# Row PR - the stored-credential connection test stores a camera's profiles (decision C117)

Wave 12, track D, agent PR, 2026-10-14. Tier 1 record. Branch `task4/input-av-core-port`, head 1fbeada7 plus the
uncommitted work of the wave. Nothing committed, staged or stashed by this row.

## 1. What was open (who, what, why)

- A camera's profile list (`capture_devices.profiles`) and its stream rows (`capture_device_streams`) had ONE writer:
  the adoption (`modules/capture-discovery/adoption.ts`, `registerAdoptedCamera`; rows 51, 187).
- Operation 108 (the connection test of a REGISTERED camera with its stored credential; rows 146, 146b, 146c) stored
  nothing (`adopted-test.ts`, header before this row: "WHAT IT KEEPS: nothing").
- So a camera with an EMPTY list could never be assigned to a slot (C36: no default profile) except by being removed
  and adopted again. Such cameras exist: every camera registered before the stream rows (the data step of migration
  0021 emptied old lists, C61 (1)), and a camera adopted when no stream half could run (a Core without a relay
  program, row 50). Source of the finding: `delegation_progress/file_requests.md`, line "row W5 ... A FACT AGAINST
  THE BRIEF'S WORDS"; ruling C117.

## 2. What is built

| Case | Condition, read INSIDE the unit of the outcome entry | Stored | Audit entry `CAPTURE_DEVICE_CONNECTION_TESTED` | Elsewhere |
|---|---|---|---|---|
| (a) | the list is empty AND the camera has no stream row | the list (minted codes) and one stream row per judged stream, by the adoption's own function | ONE entry; `details` unchanged (`outcome: REACHABLE`, `usableProfileCount: N`); message ends `; profiles stored: N` | log line: `profiles: PROFILES_STORED` |
| (b) | a statement is stored and the stream states something else | NOTHING | ONE entry; `details` unchanged; message ends `; STREAM_PROFILE_DIFFERS: stored N, stated N, differing N; nothing stored` | log line with the word and counts; persistent error log code `CAPTURE_STORED_TEST_PROFILE_DIFFERS` with the three counts |
| (c) | stored and stated agree | nothing | the entry of rows 146b / 146c, to the letter | the log line of row 146, to the letter |
| - | the test judged no stream (any other outcome; REACHABLE by the ONVIF half alone) | nothing, nothing compared | by `record`, as before | as before |
| - | (a) was due and could not be written: a session opened meanwhile, the row is gone, a judged stream is outside the table's bounds | nothing | the plain entry | `PROFILES_NOT_STORED` with a closed cause; error log code `CAPTURE_STORED_TEST_PROFILES_NOT_STORED` |

"Something else" in (b): another set of codes; a listed code with no stream row; another codec, width or height in a
code's row. The code itself carries the codec, the picture class and (H.264) the rate, so another rate is another code.

The ANSWER of operation 108 is unchanged in all cases: the test's own outcome and `usableProfileCount` = what the
stream states now.

### Files

| File | Change |
|---|---|
| `apps/core-server/src/modules/capture-discovery/adopted-profiles.ts` | NEW. `compareStoredProfiles` (pure judgement), `settleStatedProfiles` (the work in the unit: two reads, the judgement, in case (a) the adoption's write), `storedProfilesWords` (fixed words and counts for the entry's message). Imports the word from the engine's one definition (`STREAM_PROFILE_DIFFERS_REASON`). No write statement, no minting. |
| `.../capture-discovery/adoption.ts` | `writeAdoptedCameraColumns(unit, device)` EXTRACTED from the last three statements of `registerAdoptedCamera` (the code rule, the adoption's one UPDATE with its row-count check, the stream rows). The adoption calls it; so does the test. No new statement; the static rule on the file's statements holds unedited. |
| `.../capture-discovery/adopted-test.ts` | After step 9 (the guard has counted): a test that judged a stream ends through `settleOutcome` (the host's new seam `settle`), every other test through `recordOutcome` as before. `outcomeEntryOf` (the one builder of the entry) and `notRecorded` factored out of `recordOutcome`. Two codes for the error log. Header extended. Steps 1 to 9 untouched. |
| `.../capture-discovery/adopted-test-route.ts` | Header words only. |
| `.../capture-discovery/index.ts` | ONE member of the host object: `settle` = one unit of `app.engine.run` in which the work runs and the entry it hands back is appended. |
| `.../capture-discovery/__tests__/adopted-test.test.ts` | The world gained the unit (`settle`) and a stored state; 9 new cases; ONE existing case changed (the source pin, section 5). |
| `.../capture-config/__tests__/adopted-camera-test.db.test.ts` | `bounds()` host gained `settle`; `startCamera` / `setLocator` take a port; 2 new cases over HTTP on camera port 8571. No existing expectation changed. |

### Why these choices (alternatives considered)

- ONE UNIT. The stored rows and the entry that says so commit together or not at all: the host's `settle` runs the work
  and appends the entry the work hands back. Alternative rejected: decide outside the unit and write inside - a second
  test in between could store first. The unit is the ENGINE's so that V7's door for the device line needs no second
  unit (request line 1).
- NO SECOND MINTING, NO SECOND STATEMENT. The codes are the stream test's (the same tester as operations 95 / 96);
  the write is the adoption's function with the adoption's statement. The statement also sets `transport` (`RTSP`,
  the stored value of every adopted camera), `onvif_uuid` (handed back as the row holds it, read in the unit) and
  `last_seen_at` (the test's instant). Alternative rejected: a narrower UPDATE of `profiles` alone - a second write
  statement of the list, against the brief and static rule 3 of the module.
- THE WORD. `STREAM_PROFILE_DIFFERS` is the reason of the sealing notice (an alert's `params.reason`,
  `engine/sealing-notice-doors.ts:40`). It is in no closed list of operation 108: `CaptureConnectionTestReason` is
  `SCHEME_NOT_ALLOWED` only, the answer schema and the audit detail rules are strict. No outcome member fits either:
  `WRONG_PROFILE` means "no usable profile" (`packages/shared/src/i18n/en/common.ts:842`), false for a camera that
  answers with usable streams. So the outcome stays the test's own, and the word stands where a free member exists:
  the entry's `message`, the log line, the persistent error log. The members the contract lacks are request line 2.
- (c) IS BYTE-IDENTICAL to rows 146b / 146c (entry, note, error log): the existing cases hold it unedited.

## 3. Assumptions, limits, gaps

- ENGINE LINE NOT UPDATED: the engine state does not model `profiles` (`db/mapping/rows.ts` header at
  `captureDevicesToRows`); V7 is adding it. Built against the stored rows; ONE request line says what to call and
  where. Until then a client reads the stored list only after V7's member exists.
- NO CLIENT CAN TELL (a), (b), (c) APART from the answer: request line 2.
- NOT COMPARED: ONVIF tokens and lens. A camera that renames a profile token keeps "agree" while its stored token is
  stale. Driver decision 4.
- An empty list BESIDE a stream row is treated as stored (nothing written). No product path was found that produces
  it; such a row needs a hand. Driver decision 2.
- A Core WITHOUT a relay program judges no stream and so cannot give a camera its profiles through this test.
- UNPROVEN ON HARDWARE: a real camera's stream through the real relay on the camera network (checks 9A/H of the
  connection test). Here: the fake ONVIF device of `test/support` on loopback 8555 and the worker's
  `rtsp_test_camera.py` on loopback 8571, the built relay of `apps/capture-worker/build`.
- Runtime privileges: the storing statements are the adoption's, run as the runtime role in an engine unit - the same
  role and unit kind the adoption uses (held by database case (a), section 6).

## 4. Security (AD-06)

- Nothing a device chooses reaches the stored LIST: `assertAdoptedProfiles` is asked before any statement (and again
  inside the adoption's function); a stream outside the code pattern, the token pattern, the closed codecs or the
  picture bounds is not stored and is no fault of the test.
- A well-formed ONVIF token is stored in the TOKEN column, as the adoption stores it (the table's own CHECK admits
  lower case, 1 to 64). It is in no entry, log line or answer.
- The comparison's result is a verdict of a closed list and whole numbers. No code of a stream is in the audit entry,
  the log line, the error log or an error.
- Refusals before the reader, the guard (429), the destination rule and the bound source address: untouched code,
  held by the existing cases unedited and by one new case (no unit is opened for any refused test).

## 5. Tests

Unit (`adopted-test.test.ts`, block "row PR (C117)", 9 cases; doubles: the reader and tester spies of the file, a
unit whose writes reach the stored state only when the work and the append succeeded):

| Case | Seen RED on |
|---|---|
| (a) stored, the statements in order, ONE entry, then (c) on the second test | M1 `compareStoredProfiles` answering agree for an empty list; M6 `storedProfilesWords` answering '' |
| (a) is one unit with its entry (a failed append leaves nothing stored) | M1 (the write never asked) |
| (b) eight forms of a difference: nothing stored, the word, three counts | M2 a write on a difference ("replace what differs"); M3 codec / width / height not compared |
| (c) agree, list order irrelevant | - (written to hold the rows 146b / 146c forms; a position-wise comparison would turn it red - not run as a mutant, stated) |
| a test that judged no stream opens no unit | M4 `stated` read whatever the outcome |
| every refusal unchanged, no unit | M1 (its last assertion) |
| (a) due and not written: session, row gone, bounds | M5 the unit's session check removed; M7 |
| hostile descriptions on this path | M7 `assertAdoptedProfiles` a no-op (both walls: the pre-check and the adoption's own call are the same function) |
| the judgement and its words, pure; the source of `adopted-profiles.ts` | M1, M6 |

Mutants were made with the Edit tool on the product file, run, and reverted at once (7 mutants, 5 runs; each run RED
on the cases named, 28 to 33 of 34 green beside them).

ONE EXISTING EXPECTATION CHANGED, in the source pin "the sources: no unit of work opened in the file ...": the
fourth call of `recordOutcome` no longer carries an inline object - the facts are ONE object handed to exactly one of
two writers. The pin now reads the object from `const facts: OutcomeFacts = {...}`, expects 3 inline calls (was 4)
and pins the two-writer line, `host.settle(` once, `settleStatedProfiles(` once. Every other assertion of that case
and every other case of the file is unedited and green.

Database (`adopted-camera-test.db.test.ts`, HTTP block, 2 new cases, camera port 8571 - no other test file names it;
`test/t3_mutation_and_ports.md` lists 8571-8574 as free; ONVIF device 8555 as the file had it):

- (a) then (c) through the route, the app's own tester, the built relay.
- (b), then the fixture's hostile description (`--sdp-codec hostile`) at a camera with no stored profile.

## 6. Checks

Run on the final tree, 2026-10-14 (each once; the unit file three times while its own new hostile case was corrected):

| Check | Result line |
|---|---|
| `tsc --noEmit`, apps/core-server | exit 0 |
| unit: the capture-discovery folder, `test/static` (with `credentials.test.ts`, unedited), the two capture static files | Test Files 28 passed (28), Tests 499 passed (499) |
| db: `adopted-camera-test.db.test.ts` under the database lock, cases under the heavy-host lock | Test Files 1 passed (1), Tests 18 passed (18) |
| db: the adoption's files unedited (`connect.db.test.ts`, `minted-code.db.test.ts`, `capture-discovery.db.test.ts`) | Test Files 3 passed (3), Tests 48 passed (48) |

Measured by database case (a): CAM-01 with an empty list got `["HEVC_1080P"]` and one stream row (`profile_1`,
`vs_0`, lens 1, MAIN, HEVC, 1920 x 1080); `readCameraProfiles` (the reader of the assignment rule) then answered that
code; trail +2. Case (b): stored HEVC, stream H.264: rows unchanged, counts 1 / 1 / 2. The hostile description:
outcome `NOT_H264`, nothing stored.

Not run: `capture-discovery.booted.db.test.ts`, `capture-composition.db.test.ts`, `camera-adapter-open.db.test.ts`,
any full suite (U26: the controller's, at the end).
