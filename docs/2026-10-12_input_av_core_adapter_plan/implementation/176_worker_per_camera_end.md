---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 176
work_package: WP-11b (branch B)
date: 2026-10-13
agent: coder-execution
tier: T3
requirement: BR-05 of verification/05_security_branch_b.md
status: complete
---

# Row 176: a push without media ends its camera, not the worker

## 1. What was built

One block in `apps/capture-worker/src/ingest.c`, lines 571-592, directly after the missing-parameter-set test (`:570`) and before the output is set up (`:595`):

```
if (is->codecpar->width <= 0 || is->codecpar->height <= 0) { ... ingest_over(c, src, "INGEST_NO_PICTURE_SIZE", AVERROR_INVALIDDATA); return NULL; }
```

| File | Change |
|---|---|
| `apps/capture-worker/src/ingest.c` | the block above (22 lines, 13 of them comment). Nothing else of the file was touched |
| `apps/capture-worker/test-fixtures/row176_camera_end.py` (new) | the run script of section 3; imports `e11_listener_path.py`, `e11b_announced_path.py` and `test/m3worker.py` unchanged |

Not touched: `worker.h` (line 46, the version, is row 177), `Makefile`, `check.sh`, `test/static/*`, `test/e2e.py`, `test/m3worker.py`, `capture_worker.c`, `sink.c`, `ipc.c`, the Core, `packages/capture-protocol`.

## 2. The condition that was narrowed, exactly

**Before.** A stream that came out of the probe with parameter sets but without a picture size went on to `open_output`; the muxer's header refused it (library message `dimensions not set`, `Invalid argument`), and `ingest.c:604` (then `:582`, `:524` before row 58) made every failure of `open_output` a fatal error of the worker: `CRASH OUTPUT_SETUP_FAILED`, exit 70. The size of a copied H.264 stream is known only from a picture the probe read; a client that sends none (case A of `test/007`) therefore always reached that line.

**Now.** The condition is judged on the INPUT stream, before `open_output` is called: video stream found, extradata present, `width <= 0` or `height <= 0`. That camera ends through `ingest_over`, the same function and the same frame as the missing-parameter-set case one line above (`WARNING CAPTURE_FAULT`, reason `CAMERA_NOT_CONNECTED`, subject = the camera's device), with its own worker-log code `INGEST_NO_PICTURE_SIZE`. At that point no output context, no file and no byte exist for the camera; the audio that waited for it is dropped at the session's close as for every camera that never connected (`cam_mux_audio` stops queueing once the state is `ING_ENDED`).

**What stays fatal, unchanged.** The line `if (r < 0) { fatal(src, "OUTPUT_SETUP_FAILED", r); ... }` (`ingest.c:604`) was not edited. `open_output` is now only called for a stream that has a picture size, and whatever it refuses for such a stream still ends the worker: the output context, the I/O context, the stream copy, the header, a mux option that is not consumed, the audio that waited. Every error of the writer (`sink.c`, `cam_sync_failed`, `VIDEO_MUX_WRITE_FAILED`, `SAMPLE_ABOVE_FRAGMENT_BOUND`, `OUTPUT_CLOSE_FAILED`) is where it was. Both are shown on the real binary in section 3 (runs 5 and 6).

**Why this is not a weakened crash.** The fatal path protects a file that exists or is being made. In the narrowed case nothing of the camera's file exists and nothing can be made: there is no media. The other failure modes of `open_output` say that the worker cannot write a stream it was given, which is a defect of the worker or its host and stays loud.

**BR-03 kept.** The block writes no flag of the process: `g_stop_ingest` is read at `:113`, `:148`, `:618` and written by nothing in `ingest.c` (`grep -n g_stop_ingest`), `fatal(` is not called on this path.

**A camera already given up.** A client that holds the connection past the ingest window + 10 s is given up by the main loop (`INGEST_OPEN_STUCK`, one frame). When it closes later the block is reached with `abandoned` set: it writes the log line with `already_given_up: true` and no second frame (run 4).

## 3. Checks run (2026-10-13 00:56 to 01:02 WIB, this Mac, libavformat 63.1.102)

Every build and run under `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock` from the repository root, command sandbox off, ports 8559 and 8561 on loopback. 1-minute load before the runs: 3.6.

| Check | Command | Result line |
|---|---|---|
| Static rules, self-test, unit checks, build | `make -C apps/capture-worker` (after the edit; no source change since) | `make rc=0`; `check.sh: src: static rules OK (...)`; 75 lines `refused as required`; `announce_test: all 151 checks hold`; `writer_test`, `start_checks`, `log_test`, `anchor_test`, `micwatch_test`: `all checks hold`; output `.cache/row176-camera-end/make_1.out` |
| Proof builds | `make -C apps/capture-worker proof` | rc 0 |
| This row's fixture | `M3_PORTS=8559,8561 python3 apps/capture-worker/test-fixtures/row176_camera_end.py all` | `ROW176 CAMERA END: 6 run(s), 6 PASS, 0 FAIL` (`.cache/row176-camera-end/summary.txt`, `run_all.out`) |
| Red run | the same case on a copy of the sources with the new test replaced by `if (0)` (`.cache/row176-camera-end/bin/capture-worker-before`) | `FAIL`: worker rc 70, `CRASH OUTPUT_SETUP_FAILED`, the other camera's file 23116 bytes, 0 video frames, does not decode (`runs-red/red_before_this_row/result.json`); the numbers of `test/007` case A |
| Row 58's gate, once | `M3_PORTS=8559,8561 python3 apps/capture-worker/test-fixtures/row58_gate.py all` | `ROW58 GATE: 12 run(s), 12 PASS, 0 FAIL` (`.cache/row176-camera-end/row58_gate_rerun.out`) |
| Core tests that read the worker's sources | `npx vitest run --project unit src/capture/__tests__/protocol-pins.test.ts src/capture/__tests__/muxer-safety.test.ts --maxWorkers=2` | `Test Files 2 passed (2)`, `Tests 15 passed (15)` |
| Leftovers | `lsof -nP -iTCP:8559-8564 -sTCP:LISTEN`; `pgrep` of worker and fake microphone | 0 rows; 0 processes |

The six runs (ic = `ingest_connected` lines of the port; the client under test is `raw_client` of `e11b_announced_path.py`: `OPTIONS ANNOUNCE SETUP RECORD` with the parameter sets in the description, no media, close):

| # | Run | Camera under test | Its result | Other camera | Worker |
|--:|---|---|---|---|---|
| 1 | close, camera 1, right address | statuses 200 x4, closed after 0.3 s | ic 0, 0 bytes, 1 line `INGEST_NO_PICTURE_SIZE`, 1 frame `CAPTURE_FAULT CAMERA_NOT_CONNECTED` for `CAM-01` | ic 1, 826938 bytes, 175 video frames, 495 audio packets (10.56 s of AAC over 7.0 s of video), decodes with rc 0 and no message; fragments = durable fragments | alive after the close; STOP acknowledged; exit 0; no CRASH frame |
| 2 | the same | the same | the same | 826934 bytes, 175 frames, 495 audio packets, decodes | exit 0 |
| 3 | the same | the same | the same | 827362 bytes, 175 frames, 496 audio packets, decodes | exit 0 |
| 4 | hold, camera 2: the connection held 26 s (window 12 s + 10 s + 4 s), then closed | 200 x4 | ic 0, 0 bytes, 1 line `INGEST_OPEN_STUCK`, then 1 line `INGEST_NO_PICTURE_SIZE` with `already_given_up`, ONE frame | camera 1: 1102915 bytes, 175 frames, 1550 audio packets (33.07 s), decodes | exit 0 |
| 5 | forced output set-up failure WITH media: a build whose muxer gets an option it does not know, both cameras pushed normally | - | no line of this row's code | - | **exit 70, `CRASH OUTPUT_SETUP_FAILED`**, HELLO says `-PROOF` |
| 6 | forced writer failure: `capture-worker-writefault` (fragment 3 of camera 1), both pushed normally | - | no line of this row's code | - | **exit 70, `CRASH VIDEO_MUX_WRITE_FAILED`** |

In all six: 0 occurrences of a path text of the run in the worker's log and standard output, 0 leftover processes, 0 leftover listeners. 175 of the 200 pushed frames is the complete file of this pusher (`test/007`: the first second lies before the first placeable keyframe). The other camera's frame `CAPTURE_FAULT CAMERA_STREAM_ENDED` in runs 1-4 is its own push ending before STOP, as in every run of the E-11 fixtures.

## 4. Doubles, and what stays unproven

- The client is a raw socket client and the FFmpeg 9.0.2 command line; there is no relay yet. "A relay that dies between `RECORD` and its first packet" and "a camera that stalls after its description" are this client by reasoning (`verification/05` section 5), not by a run with a relay (rows 47 / 179 and the hardware package, `9A/H-01`).
- The library is this Mac's Homebrew build. Whether the Ubuntu 24.04 library leaves the same stream state (extradata set, no picture size) is row 141's container run; if it filled a size without a picture, the old fatal line would be reached again and the permanent case of rows 142 / 178 would show it.
- The whole e2e series was not run (row 59, BR-11).
- Not covered: a client that sends media the probe cannot size (garbage payload). By reading it ends on this block or on `INGEST_STREAM_INFO_FAILED`, both per camera; not run.

## 5. Driver decisions, for the controller to confirm

1. DRIVER DECISION: the condition is tested on the input stream before `open_output` instead of classifying the error `open_output` returns. `Invalid argument` from the header has other causes; an error number or the library's message text is not a safe way to tell them apart, and a test before the call leaves the fatal line untouched.
2. DRIVER DECISION: the frame reason is the existing `CAMERA_NOT_CONNECTED` ("no usable stream" in the protocol's own text); the named code is the worker-log code `INGEST_NO_PICTURE_SIZE`. The protocol package was not edited; the exact member, should the Core need to tell the cause apart in a frame, is in `file_requests.md` for row 175.
3. DRIVER DECISION: a camera already given up gets the log line and no second frame (the `abandoned` test inside the block). Without it the hold case sent two `CAPTURE_FAULT` frames for one camera.
4. DRIVER DECISION: the forced set-up failure of run 5 is compiled by the fixture into `.cache/row176-camera-end/bin/` with the Makefile's flags and the existing switch `DEMS_PROOF_MUX_EXTRA`; no Makefile line and no new proof switch was added.
5. The red run was made on a copy of the sources under `.cache/` (one line replaced in the copy); the tree was not changed for it.

## 6. Requests

One line in `delegation_progress/file_requests.md`: the optional protocol member for row 175, the version for row 177, the permanent cases for rows 142 / 178, the series for row 59. None blocks this row.

---
*Generated: 2026-10-13 01:04 WIB*
*Last Updated: 2026-10-13 01:04 WIB*
