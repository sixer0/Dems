---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 154
milestone: M3 / AD-06
date: 2026-10-13
agent: coder-execution (batch 9, agent R3)
tier: T3
requirement: AD-06 point 5 (the check), over points 1, 2 and 4 as built by rows 50 and 51
status: complete on this Mac's doubles
---

# Row 154: the minted profile code against a hostile description

Paths are relative to `/Users/gsp-budi/Documents/DEMS`. `CD` = `apps/core-server/src/modules/capture-discovery`.

## 1. Statement

Row 50 showed that the TESTER's results carry no camera text. This row follows the text to where it could come to rest: through operations 95 and 96 of a booted Core on PostgreSQL into the registry row, the stream rows, the replicated slice, the audit table, the persistent error log and the log sink. It is a check: one new test file, no product file changed. Nothing a camera chose was found anywhere.

## 2. Change set

| File | State | What |
|---|---|---|
| `CD/connect/__tests__/minted-code.db.test.ts` | new | 7 cases: four hostile cameras that are refused, one that is taken and adopted, the named failure's control, the search of every place with its control |

## 3. What is hostile, and what happened to it (run of 2026-10-13, `.cache/task4-row154/facts.log`)

| Camera-chosen text | Double | Test (operation 95) | Relay exit | Adoption (operation 96) | Stored |
|---|---|---|---|---|---|
| a codec name of 300 characters, lower-case letters and markup, in the stream description | test camera `--sdp-codec hostile` (counter `hostile_codec_descriptions` 1) | `NOT_H264`, 0 usable | 28 | `409 CANDIDATE_NOT_TESTED` | nothing; no code exists |
| a media control address on another port | `--second-port 8566 --sdp-control other-port` | `WRONG_PROFILE` | 26 | `409` | nothing; the other port got 0 authorized requests |
| a redirect after the Digest answer | `--redirect authenticated` | `WRONG_PROFILE` | 25 | `409` | nothing; 0 authorized requests there |
| a flood in the place of the description | `--adversary flood-answer` (1.4 GB offered) | `UNREACHABLE` | 31 | `409` | nothing; no relay left |
| an ONVIF profile TOKEN of 300 characters with markup | scripted ONVIF device | `WRONG_PROFILE` | no relay started | `409` | nothing: the profile is not named at all |
| a lower-case codec name in the description AND an ONVIF ENCODING of 300 characters with markup | `--sdp-codec lower` and the scripted ONVIF device | `REACHABLE`, 1 usable | 0 (twice: the test and the re-verification) | `201`, `CAM-03` | `capture_devices.profiles` = `["HEVC_1080P"]`; one stream row `HEVC_1080P`, codec `HEVC`, 1920 x 1080, the bounded token `profile_1`; the same in the slice |

**The closed set, or a failure by name.** Every stored code (the candidate's record, `capture_devices.profiles`, `capture_device_streams.profile`) is held by the test's own check to `^(H264|HEVC)_<3 to 5 digits>P<0 to 3 digits>$` and to the layer's `STREAM_PROFILE_CODE`; a value outside it throws `MINTED_CODE_NOT_OF_THE_CLOSED_SET in <place>: a value of <n> characters` (its length, never its text). The control case shows nine values a camera could have chosen each failing by that name.

**Occurrences of the fixture text.** 14 texts are searched for: the markup of both doubles (`<script`, `script>`, `alert(1)`, `alert(154)`, `<b>`), 24 characters of each padding, the lower-case codec names `h265` and `h264`, the second port's address, the stream locator and its path, and the account.

| Place | Size searched | Occurrences |
|---|---|---|
| log sink (level `trace`) | 15,591 characters | 0 |
| persistent error log | empty | 0 |
| audit table, every row as JSON | 42,726 characters | 0 |
| `capture_devices`, every row | 1,523 characters | 0 |
| `capture_device_streams`, every row | 205 characters | 0 |
| replicated slices `captureDevices`, `captureConfig` | 1,599 characters | 0 |
| every answer of the 12 requests | 2,121 characters | 0 |
| notes of the stream tester | none told | 0 |

The places are shown not to be empty (the test and adoption rows, the adopted camera, the tested lines), and the control case shows the same search finding a planted line of each kind of text. The credential table is not searched: it holds the account name by design.

## 4. Checks (this Mac; 2026-10-13; loopback only; sandbox off; one hold of both locks per run)

| Check | Command (in `apps/core-server`) | Result |
|---|---|---|
| The file | `(ulimit -c 0; lockf heavy-host; lockf db-migrate; npx vitest run --project db --maxWorkers=2 src/modules/capture-discovery/connect/__tests__/minted-code.db.test.ts)` | run 1: `Test Files 1 passed (1)`, `Tests 7 passed (7)`, 12 s. Run 2, after ONE test title was corrected (it named the credential table, which is not searched): `Tests 7 passed (7)`; `0 remain with the run prefix` |
| Static rules and the folder | the 39-file unit run of row 146's record (it holds `connect/__tests__/service.test.ts`, whose static half reads every file of `connect/`) | `Test Files 39 passed (39)`, `Tests 662 passed (662)` |
| Typecheck, lint, secret scan | `npx tsc --noEmit -p .`; `npx oxlint` on the file; `count-only.mjs` on the folder and `.cache/task4-row154` | 0 errors in the file; exit 0; `TOTAL: 0 in 0 file(s)` |

6 relays were started and 6 ended (`28, 26, 25, 31, 0, 0`); none was left.

## 5. Doubles, and what stays unproven

- Doubles: the test camera on 8565 / 8566 with the switches of rows 152 and 186; the scripted ONVIF device on 8557, hostile in its announced encoding and token; the candidate list (a list of the test, kind `FAKE`: a loopback address is never a production candidate; the mint, the adoption and the rows are the same code for both classes). Real: the app with every stage, the routes, the connect flow, the tester with the relay binary through the production door, the seal's two functions, the module's registrar, the engine action, the credential store.
- Unproven here: **a manifest statement** - no session is sealed in this file. A manifest takes a stream's code from the sealed file's own sample entry (`session-reader.ts`) and the selector's column from `capture_devices.profiles`; that column is shown clean, the sealed statement of a session with an adopted production camera is row 89's check. The ONVIF NAME of a profile and of a video source (the double names them `p0`, `source`; the session file reads no name into a result). A hostile SDP on a real camera's firmware; a camera that changes its description between the test and a recording (`9A/H-10` to `H-12`). The CHECK of AD-06 (4) on `capture_devices.profiles` is agent R6's step in this batch; this run was made before or beside it and does not depend on it.

## 6. DRIVER DECISIONS (for the controller to confirm)

1. **A new file, not new cases in `connect.db.test.ts`**: that file's adoption cases use a door double in the place of the relay; this check needs the relay binary and the test camera, so it takes the heavy-host lock and stays apart, as `stream-test.db.test.ts` does.
2. **The ONVIF device is made hostile too** (encoding and token), beyond the switches the cell names: AD-06 (1) says "no string from the relay, the stream description or an ONVIF answer is ever a part of the code".
3. **The lower-case names `h264` and `h265` are among the searched texts.** They are words a description uses; the Core writes its codecs in upper case. Found: 0. If a later log line legitimately writes one in lower case, that needle goes.
4. **One adversary mode** (`flood-answer`) of row 186's set: the others are time-bound attacks on the relay, measured by rows 152 and 186; here the question is where text comes to rest.
5. New file with Write. No existing product or test file was edited for this row.

## 7. Requests left in `delegation_progress/file_requests.md`

None of its own. Row 146's line on the flaky expectation of `service.test.ts:378` was met in the same folder.

---
*Generated: 2026-10-13*
