---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 51
date: 2026-10-13
agent: coder-execution (batch 8, agent T2)
tier: T3
work_package: WP-05
requirement: P12-F08 (adoption half); AD-06 (4) - in code: built; by a CHECK: handed over as the exact statement; C36
status: complete on this Mac's doubles for the adoption; the CHECK of AD-06 (4) is a request to the schema writer (section 4)
---

# Row 51: an adoption writes the stream rows

Paths are under `apps/core-server/`.

## 1. Statement

Operation 96 now stores, in its one transaction, the Core's minted code of every stream the re-verification judged, with the ONVIF tokens that stream is found by: one row of `capture_device_streams` per stream, and `capture_devices.profiles` as exactly those codes. An ONVIF token is stored in the stream row only. Until this row the profile list held the tokens (`["profile_1"]`).

## 2. Change set

| File | State | What |
|---|---|---|
| `src/modules/capture-discovery/adoption.ts` | changed | `INSERT_ADOPTED_CAMERA_STREAM`, `ADOPTED_STREAM_ROLE` (`MAIN`), `AdoptedCameraStream`, `AdoptedCamera.streams`; `assertAdoptedProfiles` (the code rule at the write); `writeAdoptedCameraStreams`; `registerAdoptedCamera` holds the rule first, then registers, updates, inserts |
| `src/modules/capture-discovery/connect/service.ts` | changed | `AdoptedDevice.streams`; the registrar is handed `profiles` = the codes of the re-verification's judged streams |
| `src/modules/capture-discovery/index.ts` | changed | export lines of the adoption's new members |
| `src/modules/capture-discovery/connect/__tests__/connect.db.test.ts` | changed | the stand-in registrar calls `writeAdoptedCameraStreams`; a door double of the relay; the case of line 400 moves from `['profile_1']` to `['H264_1080P25']` with its stream row; 7 new cases; three cleanup lines delete the stream rows first |
| `src/modules/capture-discovery/connect/__tests__/service.test.ts` | changed | 3 new cases (what the registrar is handed; no code without a stream half; the code rule, 3 accepted and 20 refused forms) |
| `src/modules/capture-discovery/__tests__/static.test.ts` | changed | rule 3: the adoption's statements are the UPDATE and the INSERT of the stream rows; the rule is called before both |
| `src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts` | changed, 1 pin | an adoption on a Core without a relay program stores an empty list (it read "greater than 0": the tokens) and no stream row |

No file of `src/db` was written.

## 3. What is stored

| Column | Value |
|---|---|
| `capture_devices.profiles` | the codes of the judged streams (`["HEVC_1080P"]`); `[]` when the test had no stream half |
| `capture_device_streams.profile` | the code |
| `onvif_profile_token`, `video_source_token` | the ONVIF tokens as the session file bounded them (`A-Z a-z 0-9 _ . : -`, 1 to 64); the source token may be null |
| `lens` | the place of the video source in the camera's answer, 1 to 4 |
| `stream_role` | `MAIN` |
| `codec`, `width`, `height` | `H264` or `HEVC`; the bounded picture |
| `read_at` | the instant of the adoption |

`assertAdoptedProfiles` refuses, before the engine's action and before any statement, by the code `CAPTURE_ADOPTION_PROFILE_INVALID` and a sentence that names no value: an element that is no text of the code pattern, a code twice, a list that is not exactly the codes of the streams, a token outside its form, a codec outside the two, a code whose prefix is not its codec, a lens outside 1 to 4, a side outside 1 to 16,384.

The comparison of operation 96 ("the camera changed since it was tested") compares the code sets of the two attempts; a stream that is H.264 at the test and HEVC at the adoption is `409 CONNECTION_TEST_FAILED`, cause `DEVICE_CHANGED`.

## 4. The CHECK of AD-06 (4): not generated, handed over

Agent D is the single writer of the schema and its pins in this batch. Set B (`0017`, `0018`) was in the tree when this row finished; the line "PINS OF SET B ARE DONE" was not. The CHECK moves the same pins (CHECK count, migration files 19 to 20), so it was left as a request with the exact statement, as the brief allows:

```
ALTER TABLE "capture_devices" ADD CONSTRAINT "capture_devices_profiles_code_check"
  CHECK (NOT jsonb_path_exists("capture_devices"."profiles",
    'strict $[*] ? (@.type() != "string" || !(@ like_regex "^[A-Z][A-Z0-9_]{0,63}$"))'));
```

Measured in `connect.db.test.ts` (case "every stored profile element is a code of the Core"), as a predicate on a clone of the seed after this file's adoptions:

| Input | Holds |
|---|---|
| every stored row of `capture_devices` | yes (0 rows fail) |
| `[]`, `["HEVC_1080P"]`, two codes, a 64-character code | yes |
| `["profile_1"]`, a code beside a token, lower case, `[7]`, `[null]`, an object, a 65-character text, a trailing blank, `[""]` | no |
| `[["HEVC_1080P"]]` | no; in lax mode (without `strict`) it holds - the reason for `strict` |

A database a Core ran on before this row holds token lists of adopted cameras; the request names the one data step that must precede the CHECK.

## 5. Checks (this Mac; 2026-10-13; throw-away databases; sandbox off; both locks per command)

| Check | Command (in `apps/core-server`) | Result |
|---|---|---|
| Adoption on PostgreSQL, as `dems_app` | `npx vitest run --project db --maxWorkers=2 src/modules/capture-discovery/connect/__tests__/connect.db.test.ts` | run 1 and 2: 21 of 24 (three OLDER cleanup lines deleted `CAM-03` while it now has a stream row: `capture_device_streams_device_id_fkey`; run 2 was made to read them). Run 3: `Tests 24 passed (24)`. Run 4, after the predicate case was added: 23 of 24 (my control expected the lax form to refuse a nested list). Run 5: `Tests 24 passed (24)` |
| The module's own registrar and composition | `... --project db ... capture-discovery.db.test.ts` | run 1: 15 of 16 (the pin of section 2). Run 2: `Tests 16 passed (16)` |
| Booted adopt, assign, pre-check; lane stub | `... capture-discovery.booted.db.test.ts lane-camera-stub.db.test.ts` | passed, unedited |
| Unit | `... --project unit ... service.test.ts static.test.ts` and `test/db/set4-rules.test.ts` | passed (part of the run of 8 files, `Tests 149 passed (149)`) |
| Typecheck | `npx tsc --noEmit -p .` | no output |

**The row's verification cell.**

| Cell statement | Evidence |
|---|---|
| a profile whose token has a lower-case letter is adopted and assigned to a slot | `connect.db.test.ts`, case "with the module's REAL registrar": token `profile_1`; the device is in the engine's registry; `profiles` `["HEVC_1080P"]`; its stream row holds the token; operation 78 with profile `HEVC_1080P` answers 200 and `capture_config.video_02_profile` is `HEVC_1080P`; the same request with `profile_1` is refused |
| for the H.264 and the HEVC fixture the minted code equals the statement of the recorded file | `stream-test.db.test.ts` (row 50): minted `H264_1080P25` and `HEVC_1080P`; the files row 46 recorded from the same test camera through the relay and the release worker (`.cache/row046-camera-adapter/runs/{h264,hevc}/media/VIDEO-01.mp4`) state `H264_1080P25` and `HEVC_1080P` by the seal's own readers; asserted equal |
| `STREAM_PROFILE_DIFFERS` not due | follows from the equality above: the notice compares the configured code with the code the seal reads from the file. No sealed session was run by this row |

Other cases of the database file: the transaction rolls the stream rows back with the device row; an adoption without a stream half stores `[]` and no stream row, and no row holds a token; the audit details of the test and of the adoption hold neither token nor code; the answer of operation 96 holds no token.

## 6. Driver decisions (for the controller to confirm)

1. **A test without a stream half is adopted with an empty profile list**, for both source classes. No default stands in (C36), and a token is no code. For a development camera of a lane this is the visible change of this row (`[]` where `["profile_1"]` stood); nothing read that list as a selector profile. For a PRODUCTION camera, operation 78 then refuses it (row 187).
2. **The CHECK is a request**, not a migration of this row (section 4).
3. **`stream_role` is always `MAIN`**: the test probes the main stream of each video source; no sub stream is stored.
4. **`OTHER` is never written** as a codec by an adoption, although the stored value set holds it.
5. **The streams of a test are not kept in the candidate store**: the adoption stores what its own re-verification judged. `store.ts` was not edited.

## 7. Doubles, and what stays unproven

- Doubles: the fake ONVIF stub (one device, token `profile_1`, source `vs_1`); a door double that says the relay's probe line; the stand-in registrar of the database file in most cases and the module's real one in one.
- Unproven: a camera with several lenses (the lens number, two equal codes); a demo reset after such an adoption - `capture_device_streams` is not a kept table (request line); the CHECK on a real database with older rows; the whole path on Linux. Hardware `9A/H-17`.

## 8. Requests

Two lines in `delegation_progress/file_requests.md`: the CHECK with its data step (agent D); the kept set of a demo reset.

---
*Generated: 2026-10-13*
