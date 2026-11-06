---
task_slug: dems_real_capture_sealing
date: 2026-10-09
agent: coder-execution (integration pass C2, decision D120)
status: complete - two findings need a controller ruling (items 1 and 4)
---

# Integration pass C2 - local helpers, attended scripts, stub, loopback guard

Camera and microphone were NOT opened. No file under `.data/capture-local/**/media` was opened; of the
user's runs only `result.json` and `worker.jsonl` (plus the first line of `manifest.jsonl`, `mic.jsonl`,
`helper1.err`) were read. Nothing deleted under `.data/`. No commit.

## Per item

| # | Item | Status | Where |
|---|---|---|---|
| 1 | Microphone rate judge | done - **but the controller's hypothesis is contradicted by the code and the numbers** (below) | `adapters/local/__tests__/mic-stream-check.ts` (`judgeArrivalRate`), `e2e/local-mic-capture.ts`, test `mic-rate-judge.test.ts` |
| 2 | No silent wait (H-18) | done, N = **8 s** | `adapters/local/camera-helper.ts` (watch, `errorOfNoDelivery`, `firstFrameMs`), `mic-helper.ts` (`firstSampleMs`), `errors.ts` (2 reasons), `process-door.ts` (`onOutput`), both `*-helper-args.ts` (`-progress pipe:1`), test `no-delivery.test.ts` |
| 3 | Attended camera script: real bound | done | `e2e/local_camera_e2e.py` (`cmd_cam`), `e2e/camera_run_numbers.py` (new), test `camera-run-numbers.test.ts` |
| 4 | The 4 s gap | analysed; **not a device pause**; no helper-side defect found, so no fix; the measurement is now printed | same two files |
| 5 | Stub on several addresses | **not possible here; N = 1 is the documented limit; distinct ports NOT offered** | `test/support/fake-onvif-stub.ts` (`FAKE_ONVIF_TESTABLE_DEVICES_MAX`), its test |
| 6 | Loopback guard vs ONVIF client | done; one-line request filed for row 132's file | `adapters/camera/__tests__/support.ts`, new `loopback-guard.test.ts` |

| 7 | Fence control after pass C1 (controller mediation) | done | `capture/fence/__tests__/fence.db.test.ts` |

## 1. Microphone rate

Built as asked: the rate is samples after the first chunk / time since the first chunk (2 % tolerance, the
check's own), `openingLatencyMs` is its own number, and the script prints beside it the not-judged
"window from the helper start" rate, the median interval between chunks and the modal chunk size. A
generated input is judged from 1 s after its first chunk (the program paces a generated input with a
half-second burst; measured). Tests on generated arrivals: 48 kHz starting 1.1 s late PASSES with 1,100 ms
latency; 44.1 kHz FAILS; +/-1.9 % passes, +/-2.1 % fails.

**The hypothesis of D117 ("the opening latency of 1.1 s is charged to the rate") is the controller's and is
NOT confirmed - the evidence is against it.** The script the user ran already counted its window from the
FIRST chunk and took the rate from 1 s after it (old lines `firstAt` / `markAt`). The printed numbers are
`windowSeconds: 10` (first to last chunk), 426,496 samples, 832 chunks, largest gap 23 ms: no 1.1 s hole
anywhere, an even 42.7 kHz. 426,496 = 833 x 512, and 512 samples every 12 ms is 42,667 /s (8/9 of 48,000).
A test pins that this shape still FAILS under the new judge.
Hypothesis of this pass (not verified, no device opened): the helper's device input hands over one
512-sample buffer per read and reads about every 12 ms while the device produces one every 10.67 ms, so
about one buffer in nine is lost - real sample loss, which `longestZeroRunMs` cannot see. The user's re-run
decides it: `medianArrivalIntervalMs` near 12 with `modalChunkSamples` 512 = loss; near 10.67 = fine.

## 2. No silent wait

Signal: `-progress pipe:1` in both PUSH tables (a literal; not in list / pre-check); the door hands standard
output to an observer; only `frame=<n>` / `total_size=<n>` / `out_time_us=<n>` are read. A helper with no
frame / sample 8 s after its start is killed and the loss reaches `onExit` / `onLost` (-> `onSourceLost`) as
`OPEN_FAILED` / `NO_FRAME_WITHIN_8S` (`NO_SAMPLE_WITHIN_8S`), or `PERMISSION_DENIED` / `PATTERN` when its
text matches the pinned pattern. `open()` / `start()` still resolve at the 1.5 s settle time.
Why 8 and not 5: the one real-camera run stamped its first frame 3.2 s after the helper start and the
report comes up to 0.5 s later; 8 s is below the worker's 15 s listen bound.
Proof through the REAL door with a generated stand-in that blocks: camera lost at 8 s with the named error
and the process gone; with the permission words -> `PERMISSION_DENIED`; microphone the same; control (bound
moved away) = alive after 8 s and nothing reported (the old behaviour); the real FFmpeg with the generated
tone lives past the bound. The generated camera run (item 3) shows the report with an RTSP push: 21 blocks,
frame count 316.
Not proven: the bound on the real devices (no agent opens them); the permission words macOS prints (H-18
stays open). A microphone whose pipe nobody reads within 8 s is reported the same way.
Pinned argument lists in `camera-helper.test.ts` and `mic-helper-args.test.ts` updated for the two literals.

## 3. Attended camera script

New order: worker -> helper -> wait for the helper's connection -> only then the session audio (file time
0) -> first recorded frame (from the worker log) -> SIGTERM 0.5 s before the bound, SIGKILL AT the bound ->
worker stop. `recording_at_most_10s_plus_margin` = camera part <= seconds + 0.25 s AND file <= seconds + 2 s.
New option `--source generated` (no device; agent-runnable), `--open-delay-s`, `--overrun-s` (control).

| Run (ports 8563/8564, heavy-host lock) | Result |
|---|---|
| `cam c2_cam_gen1 --source generated --open-delay-s 3.2` | PASS 9/9: camera part 9.543 s, file 11.061 s, helper open 13.776 s, stop by SIGTERM |
| `cam c2_cam_gen_over ... --overrun-s 1.5 --expect-fail --must-fail-on recording_at_most_10s_plus_margin` | failed as required (11.04 s / 12.60 s) |
| the numbers of `l134_cam_t1` through the same judge | FAIL: camera part 10.273 s, file 15.331 s |

Correction to D119: the user's file was 15.33 s long, but the CAMERA part was 10.27 s (308 frames,
10.2747 -> 20.5475 on the wall clock). The other 5 s is generated-microphone audio: 3.99 s before the
camera's first recorded frame and 1.1 s after the helper stopped. The camera was OPEN for about 14.2 s.

## 4. The 4 s gap (`gap_after_first_frame_ms` 4,046.6)

Proven from `worker.jsonl` of `l134_cam_t1` (and reproduced on the generated run, residual 30.3 ms):

    4,046.6 = 3,992.3 (audio t0 -> first recorded frame) + 21.3 (audio priming, -1024 samples) + 33.0 (one frame interval)

The first video sample is held from the start of the file by design (`ingest.c`, comment at
`video_started`; spec C.4), so the "gap" measures how long the audio ran before the camera, not a pause of
the device. The 3,992 ms split: **3,198 ms** from t0 to the wall-clock stamp of the first frame the worker
placed, and **794 ms** = the first group of pictures not written (`dropped_no_pts` 1 + `dropped_prestart`
29 = 30 frames; the first keyframe arrives before a sender report can time it). The generated run shows the
same 1 + 29 with no camera at all, so this second part belongs to the worker's ingest (closed to this pass),
not to the helper or the device. The first GOP of the helper is 30 frames like every other
(`keyframe_interval_observed` 1,033 ms): no helper-side defect in the numbers -> nothing fixed.
Still a hypothesis: what the 3,198 ms are made of (device start, the permission answer, encoder start) -
the old script did not record the helper's start. The next attended run prints what decides it:
`start_up.helper_spawn_to_first_frame_stamp_ms` (the program alone: 145 ms on the generated run),
`helper_connected_after_ms` minus it (encoder start to first push), and
`first_frame_stamp_to_first_recorded_frame_ms`.
For the product (not this pass): a session that starts audio and a local camera together begins with about
4 s in which the picture is the camera's first frame, held.

## 5. Stub, several devices

Bind of 127.0.0.2 / 127.0.0.3 without setup: `EADDRNOTAVAIL` for TCP and UDP (lo0 carries 127.0.0.1 only).
No sudo, no network change. Distinct ports are not offered: the conflict rule takes a host from the
datagram's source ADDRESS (`discovery-collector.ts:293`), so answers from 127.0.0.1 are one host whatever
their ports - and SEC35-23 pins the fixture to the literal 127.0.0.1. N = 1 is documented in the stub and
pinned by a test (3 devices -> one source address carrying 3 endpoint references). A flow that needs two
cameras runs the sequence twice against a one-device stub.

## 6. Loopback guard

Cause: `net.createConnection` hands `Socket.connect` one normalised array; the guard read it as "no host" ->
`localhost` -> refused. Now the destination is read from inside it; the host must still be the literal
127.0.0.1. Against the old guard all 6 new tests fail (the ONVIF test read UNREACHABLE); now: the pinned
client against the stub is REACHABLE with the guard on, and the same client aimed at 192.0.2.10 is refused
with nothing reaching the stub. Request filed (`file_requests.md`): delete
`capture-discovery.db.test.ts:557` `guard.restore();`.

## 7. Fence control (added by the controller after pass C1)

The case pinned the old rule (boot stops for a selector naming `MIC-03`). Now: a stored selector with
`MIC-03` boots in SIMULATED and the engine's selector reads `[MIC-02 STANDBY, MIC-03 PRIMARY]`; the control
that the fixture can still fail is a microphone slot naming `CAM-01` -> stopped at `engine.rehydrate`, no
boot audit row. A malformed id (`MIC-3`, `MIC-AB`) cannot be the control: the slot is a foreign key to the
device table, so such a value is never stored (first attempt failed on exactly that; second run 14 / 14).
The comment of `assignProduction` is corrected.

## Commands and results (each run once)

| Command | Result |
|---|---|
| `lockf ... npx vitest run --root apps/core-server --project unit src/capture/adapters test/support/fake-onvif-stub.test.ts test/static` | 481 passed, 2 failed - neither from this pass: `adapters/__tests__/static.test.ts` A-5 (red by design, ownership §7) and `adapters/__tests__/credential.test.ts` (audit rule of `CAPTURE_CONNECTION_TESTED.endpointRef` / `CAPTURE_CANDIDATE_ADOPTED.endpointRef` in `src/core/audit-details.ts`, rows 132/142) |
| `npm run typecheck -w apps/core-server` / `oxlint` | clean / clean |
| `lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/capture/fence/__tests__/fence.db.test.ts` | 14 passed (after one fix of the new cases) |
| `local-mic-capture.ts --source generated --seconds 6` | PASS, 47,988 /s, opening latency 21.9 ms |
| the two generated camera runs above | as stated |

## Checks for the test runner

None outstanding: the worker runs of this pass were done under the lock.

## For the user's re-run (from the Terminal app, not from the Claude app)

Microphone:

    npx tsx apps/core-server/src/capture/adapters/local/__tests__/e2e/local-mic-capture.ts --program "$PWD/.data/helpers/ffmpeg" --source device --seconds 10

Camera (new run name):

    DEMS_USER_ATTENDED=1 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock python3 apps/core-server/src/capture/adapters/local/__tests__/e2e/local_camera_e2e.py cam l134_cam_t2 --ports 8563,8564

## Decisions for the controller

1. D117's hypothesis does not hold on the evidence; possible sample loss in the microphone helper's input (ruling after the re-run).
2. N = 8 s for the no-delivery bound (asked: 5 unless the timings argue otherwise).
3. D119 wording: 10.27 s of camera, not 15.33 s.
4. The unwritten first GOP (about 0.8 s at every camera start) and the held first frame at session start: worker / spec C.4 material for row 71 or the review row.
