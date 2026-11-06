---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 50
date: 2026-10-13
agent: coder-execution (batch 8, agent T2)
tier: T3
work_package: WP-05
requirement: amendment AM-2 (the codec is judged from the stream); P12-F08 rows 1, 7, 8 (server half); AD-06 (1), (2), (3), (5); S13-01 (b) (probe mode, Digest only, as the Core sees it); S13-04 (d) (a refused RTSP authentication is counted); C36 (no default profile); C38, C39 (the relay's interface only)
status: complete on this Mac's doubles
---

# Row 50: the stream-level half of the connection test

Paths are under `apps/core-server/` unless they begin with `docs/` or `apps/`.

## 1. Statement

A connection test now has two halves. The ONVIF half (unchanged in what it sends) says that the camera answers, takes the credential and names its streams. The stream half starts the capture relay in probe mode through the production door for each named stream, and the Core judges what the relay reports. A camera that announces H264 over ONVIF and sends HEVC is `REACHABLE` with the usable profile `HEVC_1080P`. What the camera announces is advice only, in both directions.

## 2. Change set

| File | State | What |
|---|---|---|
| `src/capture/adapters/camera/stream-probe.ts` | new | the schema of the probe line (`probeReportOf`, `createProbeReportReader`); the Core's own judgement of the codec from the parameter-set bytes (`codecOfParameterSets`); the mint (`streamFactsOf`); the tester of both halves (`createStreamConnectionTester`) |
| `src/capture/adapters/camera/relay-start.ts` | changed, additive | `startCameraProbe`, `CameraProbeStart`; both starts go through one private `launch`. Still ONE call of `credentialAtInjection`, one door line; the record start's message is byte-identical (row 46's unit case passes unedited) |
| `src/capture/adapters/camera/onvif-session.ts` | changed, 3 places | the announcement verdict (`NOT_H264`, `NO_H264_PROFILE`) now also names the streams (`profiles`); three comment blocks. No request added, no export changed |
| `src/capture/adapters/index.ts` | changed, additive | export lines of the new file and of `createOnvifStreamLocator` |
| `src/capture/fragments.ts` | changed, ONE word | `export` on `avcDeclaredFrameRate` (DRIVER DECISION 1) |
| `src/sealing-host/index.ts` | changed, ONE line | `streamProfileOf` and `SealVideoFormat` exported (DRIVER DECISION 1) |
| `src/modules/capture-discovery/index.ts` | changed | the composition: the tester of both halves with `startProductionProcess`, `config.captureRelayPath`, the seal's two functions; a fault of the relay goes to the log and the persistent error log by its code |
| `src/modules/capture-discovery/connect/service.ts` | changed, additive | `ConnectionAttempt.streams`; the attempt's judged streams leave `contact`; the log line of a test carries `testReason` (a code word) and `judgedStreams` (a count) |
| `src/capture/adapters/__tests__/static.test.ts` | changed, 1 entry | rule A-9: `camera/stream-probe.ts` is the second file that may name the relay start |
| `src/capture/adapters/camera/__tests__/stream-probe.test.ts` | new | 29 cases on a door double |
| `src/modules/capture-discovery/connect/__tests__/stream-test.db.test.ts` | new | 10 cases with the real relay binary, the test camera and a scripted ONVIF device |
| `src/capture/adapters/camera/__tests__/onvif-session.test.ts` | changed, 2 cases | the pin "a result that is not REACHABLE names none" now excepts the announcement verdict |

Not touched: `apps/capture-worker` (the existing `build/capture-relay` was driven as it is), `packages/shared`, `production-door.ts`, `credential.ts`, the static-capture list.

## 3. How the Core decides (AD-06)

| Fact | Source | Rule |
|---|---|---|
| Shape of the report | the relay's one line | one pattern: the members of `implementation/042_relay_probe_mode.md` in their order, version 1, plain decimals inside their bounds (attempt 999,999,999; side 16,384; rate 1,000,000), each set lower-case hexadecimal of at most 1,024 bytes, line at most 6,400 bytes. Anything else is counted and dropped |
| Codec | the BYTES of the sets | H.264: unit type 7 and 8 in the low 5 bits of one header byte, no video parameter set. HEVC: unit types 32, 33, 34 in bits 1 to 6 of a two-byte header, temporal id not 0. Neither: no codec. The relay's own word must agree; the stream description and the ONVIF answer take no part |
| Rate | the sequence parameter set | read by `avcDeclaredFrameRate`, the seal's own reader. HEVC: none (`test/011_e8_reader.md`). The rate of the description (`rate_milli`) is not used |
| Code | `streamProfileOf`, the seal's own function | held to `^[A-Z][A-Z0-9_]{0,63}$` and to its codec prefix before it leaves the file; a failure is `PROFILE_CODE_INVALID` and the test is not passed |

The two seal functions are handed in by the composition (`statement`), so the adapter file imports neither the sealing host nor the fragment reader.

## 4. Outcomes

No sixth member (row 38, DD-1). The stream half runs when the test has a credential AND a relay program is configured.

| End | Outcome | Reason code | Counted for the lock-out |
|---|---|---|---|
| a stream judged H.264 or HEVC, code holds | `REACHABLE` | - | 0 |
| relay exit 28, or sets of neither kind | `NOT_H264` (widened meaning) | `STREAM_CODEC_NOT_USABLE` | 0 |
| relay exit 22 (Basic only) | `AUTHENTICATION_FAILED` | `SCHEME_NOT_ALLOWED` (told to the client: the credential was not sent) | 0 |
| relay exit 23 | `AUTHENTICATION_FAILED` | `STREAM_CREDENTIAL_REFUSED` | 1; nothing more is asked of the camera |
| relay exit 24; 21, 25, 26, 27, 29, 33 | `WRONG_PROFILE` | `STREAM_NOT_FOUND`; `STREAM_REFUSED` | 0 |
| line not the form, another attempt, codec word against its bytes; code fails the pattern | `WRONG_PROFILE` | `PROBE_REPORT_INVALID`; `PROFILE_CODE_INVALID` | 0 |
| relay exit 20; 30, 31, 32; exit 0 without a line | `UNREACHABLE` | `STREAM_UNREACHABLE`; `STREAM_NO_PICTURE`; `STREAM_NO_ANSWER` | 0 |
| probe bound 8,000 ms; the caller's deadline (15,000 ms) | `UNREACHABLE` | `STREAM_PROBE_TIMEOUT`; `DEADLINE` | 0; the relay is killed and waited for first |
| the relay's own failure, a signal, a refused start | `UNREACHABLE` | `RELAY_FAILED`; `RELAY_NOT_STARTED` | 0; said to the log and the error log by code |

Several streams (at most 4, one after another): one judged stream is enough for `REACHABLE`; with none the first failure is the outcome.

## 5. Checks (this Mac; 2026-10-13; loopback only; sandbox off for the runs that bind a port; one lock hold per command)

| Check | Command (in `apps/core-server`) | Result |
|---|---|---|
| Unit, door double | `npx vitest run --project unit --maxWorkers=2 src/capture/adapters/camera/__tests__/stream-probe.test.ts` | `Tests 29 passed (29)`, first run |
| Real relay | `(ulimit -c 0; lockf heavy-host; lockf db-migrate; npx vitest run --project db --maxWorkers=2 src/modules/capture-discovery/connect/__tests__/stream-test.db.test.ts)` | run 1: 9 of 10 (my own criterion named the camera's request class `digest`; it is `digest_ok`; the relay and the tester were right). Run 2: `Tests 10 passed (10)`. Run 3, after the fact lines were sent to a file: `Tests 10 passed (10)` |
| ONVIF session file | `... --project unit ... onvif-session.test.ts` (under the heavy-host lock: it binds ports of the fixture range) | run 1: 44 of 45 (the pinned case of section 2). Run 2: `Tests 45 passed (45)` |
| Touched unit folders and static rules | `... --project unit ... src/capture/adapters src/modules/capture-discovery src/modules/devices test/static test/db/set4-rules.test.ts src/sealing-host/__tests__/stream-profile.test.ts src/capture/__tests__` | `Test Files 79 passed, 1 failed (80)`, `Tests 1748 passed, 1 failed`: rule G-R16, caused by row 53 and fixed there; that file and the folders row 53 touched were run again, `Test Files 21 passed (21)`, `Tests 357 passed (357)`. The 80 files were not run a second time as one command |
| Record mode unharmed | `... --project db ... camera-adapter-open.db.test.ts capture-discovery.booted.db.test.ts lane-camera-stub.db.test.ts` (row 46's T-2 with the real relay and worker) | 3 files passed |
| Typecheck | `npx tsc --noEmit -p .` | no output |
| Secret scan | `node scripts/secret-scan/count-only.mjs` on the new files, `modules/capture-discovery`, `.cache/row050-stream-test` | `TOTAL: 0 in 0 file(s)` |

Facts of run 3 (`.cache/row050-stream-test/facts.log`):

| Case | Outcome | Relay exit | Camera's counters |
|---|---|---|---|
| ONVIF says H264, camera sends HEVC | `REACHABLE`, `["HEVC_1080P"]`, 77 ms | 0 | `auth_digest_ok` 4, `auth_none` 1, no `auth_basic` |
| ONVIF says H264, camera sends H.264 | `REACHABLE`, `["H264_1080P25"]` | 0 | the same |
| ONVIF says H265 only, camera sends HEVC | `REACHABLE`, `["HEVC_1080P"]` | 0 | - |
| Basic-only camera | `AUTHENTICATION_FAILED`, `SCHEME_NOT_ALLOWED`, 0 counted | 22 | 1 request, class `none`; `auth_basic` absent (0) |
| wrong password at the stream | `AUTHENTICATION_FAILED`, `STREAM_CREDENTIAL_REFUSED`, 1 counted | 23 | `auth_digest_refused` 1 |
| wrong password at the ONVIF half | `AUTHENTICATION_FAILED`, 1 counted, no relay started | - | 0 requests |
| nothing listens | `UNREACHABLE`, `STREAM_UNREACHABLE` | 20 | - |
| codec name of 300 characters with markup (`--sdp-codec hostile`) | `NOT_H264`, `STREAM_CODEC_NOT_USABLE`; 0 occurrences of its text | 28 | `hostile_codec_descriptions` 1 |
| codec name in lower case (`--sdp-codec lower`) | `REACHABLE`, `["HEVC_1080P"]`: the code is the Core's | 0 | - |
| control address on another port | `WRONG_PROFILE`, `STREAM_REFUSED` | 26 | `foreign_control_descriptions` 1 |
| redirect after the Digest answer | `WRONG_PROFILE`, `STREAM_REFUSED` | 25 | `redirects_sent` 1 |

10 relays started, 10 ended; 0 left; no note of a host fault; 0 occurrences of the account, a stream address or the markup in any result.

**The row's verification cell.**

| Cell statement | Evidence |
|---|---|
| a fixture that reports H264 and delivers HEVC is reported HEVC with code `HEVC_1080P` | rows 1 and 3 of the table above; the same on the door double |
| the whole test stays inside 15,000 ms on a fake clock | unit block "the bounds": a silent probe is killed at 8,000 ms (plus at most 2,000 ms of waiting); the caller's signal ends a probe at once with `DEADLINE`, the relay killed first, no further stream tried |
| the development connection test shows 0 changed results on the H.264 fixtures | a test without a credential or without a relay program answers the ONVIF half's own result (unit block "when the stream half runs"); `connect.db.test.ts` outcome table (`H265_ONLY` still `NOT_H264` there), `capture-discovery.booted.db.test.ts` and `lane-camera-stub.db.test.ts` pass with no outcome edited |

## 6. Driver decisions (for the controller to confirm)

1. **Two one-word exports outside the row's area**: `avcDeclaredFrameRate` (`capture/fragments.ts`) and `streamProfileOf` (`sealing-host/index.ts`). The row's cell says "formed by the seal's own function"; a second copy of either would be a second rule. Both are claimed.
2. **The stream half needs a credential and a relay program.** Without either the answer is the ONVIF half's own and NO code exists. So a PRODUCTION candidate on a Core without `captureRelayPath` still passes on its ONVIF answer; row 51 then stores an empty profile list for it. The alternative, refusing the test as "not testable", changes what a development Core does with a real camera today; left to the controller.
3. **Host faults map to `UNREACHABLE`**, since the contract has five outcomes; the code goes to the log and the error log.
4. **The probe bound is 8,000 ms** per stream, inside the 15,000 ms of the whole test; the relay's own keyframe bound is longer.
5. **Width and height are the relay's bounded numbers**, not a second parse of the sets in the Core. AD-06 (1) names the codec for the Core's parse; (2) asks for bounded integers.
6. **Two streams with one code**: the first is kept, the second counted (`duplicateCodes`). The stream table's key is (device, code). Request line filed: a dual-lens camera with two equal main streams needs a rule.
7. **A-9 gained one entry.** The relay start is reached by a live path (the connect flow) before the lift, only for a credentialed test on a Core with a relay program.
8. **The attempt of a probe** is a counter of the tester (1 upward); a report that names another number is `PROBE_REPORT_INVALID`.

## 7. Doubles, and what stays unproven

- Doubles: `apps/capture-worker/test-fixtures/rtsp_test_camera.py` (1920 x 1080, 25 a second; ports 8565, 8566), the scripted ONVIF device of `test/support/onvif-odd-device.ts` (8557), a door double in the unit file. No real camera.
- Unproven: a real camera's parameter sets (a picture whose coded size is cropped; sets that change between the test and a recording); a camera whose first keyframe needs longer than 8,000 ms; a dual-lens camera; the i18n wording with an operator; everything on Linux. Hardware package `9A/H-09`, `H-10` to `H-12`, `H-17`.
- The stored-credential test of an ADOPTED camera (reader, reason `CONNECTION_TEST`) is row 146: the tester takes any sealed credential.
- The wording of `NOT_H264` was served by agent U on row 38's request; no line was needed from this row.

## 8. Requests

Lines in `delegation_progress/file_requests.md`: the dual-lens gap (controller); the answer to row 49's time-read line; the answer to the reds agents SC and G reported; the information for rows 85, 88 and 146.

---
*Generated: 2026-10-13*
