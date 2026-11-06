---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 58
milestone: M3-W2
date: 2026-10-09
agent: coder-execution (driver of the pair; one helper agent for the INTERNAL actions slice of P5)
tier: 3
source_plan: identification/02_structured.md rev 2.2 row 58; masterplan/05_capture_architecture_spec.md
status: needs-review
---

# Row 58 - capture worker, engine seam, config keys (M3-W2)

Status: **needs-review**. Every part P1 to P6 is implemented and verified by the checks below, each
run twice with a negative control that fails. It is not "complete" because (a) seven decisions taken
here need the controller's ruling (section 8), (b) one line outside the row was changed by the helper
(`db/store/store.ts`, section 5.4), (c) six code paths are written but not exercised by any check
(section 9), and (d) `M3-BC-1` itself is row 61's and was not run.

All commands are run from `/Users/gsp-budi/Documents/DEMS`. Commands that bind `127.0.0.1` or reach
PostgreSQL need the Bash sandbox off (EPERM inside it). Media and run directories are under
`.cache/m3worker/` (git-ignored). Text evidence: `implementation/evidence/20_m3_worker/`.

## 0. What is real and what is a stand-in

| Thing | State |
|---|---|
| Capture worker `apps/capture-worker` (C, FFmpeg 9.0.2 linked, no install) | REAL: speaks the protocol, records two playable fMP4 files from one AAC encoder |
| Supervisor, launcher, forwarder in `apps/core-server/src/capture` | REAL; the Core starts the worker only in `DEMS_CAPTURE_MODE=real` with `DEMS_CAPTURE_WORKER` set |
| Cameras | STAND-IN: `fake_cam` (row 111, a process each, RTSP push over TCP). Real cameras are class C |
| Microphones | STAND-IN: `apps/capture-worker/test/fake_mic.c`, ONE separate process, into two named pipes. The plan knows one mic input kind, `PCM_FIFO`. Real device adapters are row 65 / class C |
| Who calls `app.capture.start` in production | NOBODY yet. No module builds a capture plan. The supervisor-to-worker path is driven by `apps/core-server/test/support/capture-session-driver.ts` (the production supervisor and launcher in a process of their own) |
| `FRAGMENT_CHECKPOINT`, `SEAL_COMPLETE` | frames and supervisor handling exist; the worker emits neither (rows 59, 82) |
| Lossless records after the supervisor | handed to `record` listeners; nothing persists them yet (row 59) |
| `MIC_SILENT`, mic disconnect warning | NOT raised by the worker (the thresholds are NM-10's, not in the plan). Telemetry carries `dbfs: null` for a mic that delivers nothing |
| Hash chain, fsync, encryption, `recording_fragments` | not here (row 59). `sink.c` is the place each fragment passes as one buffer |
| The end-to-end checks | a Python harness (`apps/capture-worker/test/m3worker.py`), not part of any `npm test`. Gate row 64 runs it |

## 1. P1 - protocol: the lossless RECORD class

`packages/capture-protocol/src/index.ts`:

| What | Where |
|---|---|
| `CAPTURE_PROTOCOL_VERSION = 2` (the message set is a strict union; spec B.2 R-4) | `:68` |
| `WorkerMessageType.RECORD` | `:93` |
| `CaptureRecordKind`: `FIRST_VIDEO_SAMPLE`, `FIRST_DURABLE_FRAGMENT`, `FRAGMENT_CHECKPOINT`, `SEAL_COMPLETE` | `:114`; schemas `:375`, `:387`, `:395` (spec A.5 fields; `seq` of the sketch is named `index`), `:412` |
| `RecordMessageSchema { v, sessionId, type, seq >= 1, record }` | `:419` |
| `DURABLE_RECORD_KINDS` (the two kinds that say a fragment is on the disk) | `:415` |
| Plan: `mics[].input { kind: 'PCM_FIFO', path }`, `pcmTapPath`, port range 8554-8564 (`CAPTURE_MEDIA_PORT_MIN/MAX`, gap-list item 8) | `:131`, `:266`, `:74` |
| Telemetry `clocks[] { deviceId, lagMs, trendPpm, nearBound }` (arrival-vs-camera trend, telemetry only) | `:339` |
| Header: levels and records; "the file is the truth, the frame is a hint"; the never-overwrite rule as decided by D67 (OUT-11) | `:22-64` |

HELLO, ACK and the other frames are unchanged in shape; only `v` moved from 1 to 2.

Supervisor handling (`apps/core-server/src/capture/supervisor.ts`): `onRecord` `:602` runs inline in
`onMessage` beside `ACK`; the sequence check is `:610` (`RECORD_SEQUENCE_GAP`); a record is handed to
`record` listeners through the supervisor's own-event path and never through `emitFromWorker`. A
record before `START` was acknowledged (`RECORD_BEFORE_START`) and a fragment record about a device
that is no camera of the plan (`RECORD_SUBJECT_UNKNOWN`) are violations too. `status()` gained
`durable` and `lastRecordSeq` (`:711`).

Sequence scope (decision D58-3): a worker counts its records from 1. The supervisor resets its
expectation when it starts a new worker of a session (`:622`), which it does only while the session
holds no durable fragment, so the fragment records of one session are always one sequence.

**M3-REC-1** = `apps/core-server/src/capture/__tests__/records.test.ts` (19 tests) plus the frame half
in `packages/capture-protocol/test/protocol.test.ts`.

```
$ npm run test -w @dems/capture-protocol </dev/null
 Test Files  1 passed (1)
      Tests  20 passed (20)          (was 18)
$ npx vitest run --root apps/core-server --project unit src/capture </dev/null
 Test Files  8 passed (8)
      Tests  141 passed (141)        (was 86 in 6 files)
```

| M3-REC-1 clause | Test | Negative control (mutation of `supervisor.ts`, `evidence/20_m3_worker/mutate_supervisor.sh`) |
|---|---|---|
| (a) sequence gap, repeat, wrong first, step back = `PROTOCOL_VIOLATION` | "a gap (1, then 3) ..." x4; CONTROL "1, 2, 3, 4 end nobody" | M3 sequence not checked: 5 tests fail |
| (b) 0 records dropped under a flooded queue: 500 rounds of telemetry + 4 progress steps + a record at `eventQueueLimit` 8 with stuck listeners; all 500 records arrive in order while `droppedEvents > 1900`, `droppedTelemetry > 400`, one overflow report | "with the queue at its bound ..."; CONTROL "the SAME flood loses progress values" (9 of 500 delivered) | M2 record sent through the lossy queue: 2 tests fail |
| (c) seal completion is the record: final `PROGRESS SEAL:1` is evicted and never delivered, `SEAL_COMPLETE` arrives | "the final PROGRESS (progress 1) is evicted ..." | M2 |

## 2. P2 - supervisor: option C, N-1 to N-4

**Restart rule as implemented (decision D58-1, read from spec B.2 lines 457-481).** A worker is
restarted inside a session only while the session is not `durable`. `durable` is set by the first
`FIRST_DURABLE_FRAGMENT` / `FRAGMENT_CHECKPOINT` record (`supervisor.ts:609`), and by a worker that
refuses `START` with `OUTPUT_EXISTS` (`:544`, not retried). The give-up branch has the one extra term
the spec names (`:474-475`). A durable session whose worker goes down, for any cause, goes to
`FAULTED` with one `CAPTURE_FAULT` and stays open until `stop`.

The clause "until the worker reports durability, START acknowledged counts as may be durable" is met
by the version gate: a worker that cannot report (version 1) is refused at `HELLO`
(`PROTOCOL_MISMATCH`). I did NOT implement "no restart after RECORDING whatever the records say":
that reading would turn eleven row-57 tests round (they restart a worker that reported no fragment)
and contradicts the spec's "one flag set by the durable record, one more term". The gap that reading
would close (a fragment written, its record lost) is closed on the worker's side instead, by the
file: see D58-2. If the controller wants the stricter reading it is one predicate, `:475`.

**Init-segment-only file (decision D58-2).** Spec B.2 leaves two options; the first is implemented:
*the file is created at its first complete fragment* (`apps/capture-worker/src/sink.c:81`,
`O_CREAT|O_EXCL`). Consequences: a file that holds only an init segment cannot exist; a worker that
dies before its first fragment leaves no file; a worker never opens an existing path. A worker that
finds anything at an output path refuses `START` with `OUTPUT_EXISTS`
(`capture_worker.c` `take_plan`, `:122`), the supervisor marks the session durable and ends it
`FAULTED`; a file that appears after `START` makes the exclusive create fail, which is a fatal
error (exit 70). In both cases the existing bytes are untouched (SHA-256 compared, section 3.4).

| Finding | Fix | Test (all in `records.test.ts` unless named) | Mutation that turns it red |
|---|---|---|---|
| F-7 pin | renamed "F-7 / M3-KC-3: a restart inside a session, BEFORE the first durable fragment" (`liveness.test.ts:171`); assertions unchanged | - | - |
| F-7 sibling | `liveness.test.ts:184`: after the durable record a crash -> `FAULTED`, `fake.calls() === 1`, events exactly `down EXITED null`, `warning CAPTURE_FAULT supervisor`, `phase FAULTED`; heartbeat timeout and protocol violation likewise; `OUTPUT_EXISTS` case; two CONTROLS | 5 tests | M1 option-C term removed: 6 fail. M7 `OUTPUT_EXISTS` retried: 1 fails |
| N-1 re-entrant `stop()` | every entry into the supervisor is a `step` (`:222`); own events are collected and handed out when the outermost step is finished (`:212`, `:334`) | `stop()` from the `CAPTURE_FAULT` listener -> phases `RECORDING>FAULTED`, `FAULTED>STOPPING`, `STOPPING>IDLE`, status `IDLE`; `stop()` from `workerDown` -> `IDLE`, no timer armed, no second worker; listener sees the finished step; `start()` from the last phase listener | M4 events handed out mid-step: 3 fail |
| N-2 queue at session end | `dropQueued` `:426` (counted in `droppedEvents` / `droppedTelemetry`) | session 2 receives only its own events; CONTROL without the end | M5: 1 fails |
| N-3 warning subjects | `:585-589`: subject must be a device ID or a held mic role of the plan, or null | 7 accepted, 6 refused, 300 invented subjects queue 0, a role nobody holds | M6: 8 fail |
| N-4 title | `supervisor.test.ts:479` reworded | - | - |

```
$ .cache/row58/mutate.sh        (copy: evidence/20_m3_worker/mutate_supervisor.sh)
=== MUTATION M1 option C term removed                         Tests  6 failed | 119 passed (125)
=== MUTATION M2 record sent through the lossy queue           Tests  2 failed | 123 passed (125)
=== MUTATION M3 sequence not checked                          Tests  5 failed | 120 passed (125)
=== MUTATION M4 own events handed out in the middle of a step Tests  3 failed | 122 passed (125)
=== MUTATION M5 queue not cleared at session end              Tests  1 failed | 124 passed (125)
=== MUTATION M6 warning subject not checked                   Tests  8 failed | 117 passed (125)
=== MUTATION M7 OUTPUT_EXISTS retried                         Tests  1 failed | 124 passed (125)
=== RESTORED                                                  Tests  125 passed (125)
```
(125 = the capture folder before the forwarder and pin tests were added; the file is restored and
its SHA-256 compared after the run.)

Existing tests changed, each because the thing it pinned changed: `supervisor.test.ts:53` `v: 1` ->
`v: 2`; `:265` the mismatching version `2` -> `1`; `ipc.test.ts:223` `protocolVersion: 1` -> `2`;
`module.test.ts` one more log line and one more error-log entry (`CAPTURE_WARNING_NOT_RAISED`, the
forwarder, section 5); `static.test.ts` file list + the config pin. No test was skipped, weakened or
given a longer timeout.

## 3. P3 - the worker

Five translation units, 1,910 lines (`apps/capture-worker/src`): `capture_worker.c` 381 (main,
commands, session), `ipc.c` 346 (frames out, JSON in, log), `sink.c` 129 (the camera file),
`ingest.c` 384 (RTSP ingest, PRFT anchoring, muxer), `audio.c` 477 (THE filtering thread), `worker.h`
193. Build: `make -C apps/capture-worker` (static rules, their self-test, then the binary).

### 3.1 The nine-point gap list (W-6)

| # | Gap | Now | Evidence (`m3worker.py proto`, 2 runs PASS) |
|---|---|---|---|
| 1 | plain-text control | NDJSON commands, own JSON reader (`ipc.c:323`), lines up to 4 x 65,536 bytes | not-JSON, unknown type, another version, too-long line -> `CRASH PROTOCOL_VIOLATION`, exit 64 (x4) |
| 2 | no frames | `HELLO` first, `HEARTBEAT` (own thread, `ipc.c:169`), `ACK`, `TELEMETRY`, `WARNING`, `RECORD`, `CRASH`; one writer thread, nothing else on stdout (`check.sh` rule B.2) | first frame `{"v":2,"type":"HELLO","protocolVersion":2,"workerVersion":"capture-worker/0.2.0"}`; 12-13 heartbeats in 1.2 s at 100 ms, counters 1..n; 0 lines that are no frame in every run |
| 3 | session in argv | plan from `START` (`capture_worker.c:122`); argv = `--log`, `--heartbeat-ms`, `--listen-timeout-s`, `--audio-manifest` | `ps` argv holds no session ID, address or path |
| 4 | end of stdin | stops recording, closes the files, exit 0 (`:344`); a failed write to stdout = supervisor gone (`ipc.c:162`) | exit 0 after stdin closed; CONTROL: with stdin open it keeps running |
| 5 | one session | second `START` -> `ACK ok=false SESSION_ALREADY_SERVED` | measured |
| 6 | logs on closed stderr | JSON lines to `--log` only; stderr unused; descriptors 0-2 are filled if closed so that no log line can land in a media file | `worker.jsonl` in every run |
| 7 | environment | reads none (`check.sh` rule); harness and `ipc.ts` start it with `env = {}` | every run |
| 8 | port range | 8554-8564 in the package and in `worker.h`, held equal by `protocol-pins.test.ts` | plan with port 9000 -> `PLAN_INVALID` |
| 9 | F-7 / F-1 | never opens an existing path (3.4); heartbeats on their own thread, telemetry is replaced, never queued (`ipc.c:125`) | 3.4; heartbeat intervals 492.9-507.2 ms in 28 sessions |

Other refusals measured: every-interface host, trailing slash, credentials, unknown member, relative
output -> `PLAN_INVALID`; 44.1 kHz -> `PLAN_UNSUPPORTED`; mic input that is a regular file ->
`MIC_INPUT_NOT_FIFO`.

### 3.2 Recording (M3-WI-1) - `m3worker.py session`, 2 runs each, all PASS

| Case | Files | Growth during the session | H-4 (one encoder, both files) | AV offset vs truth (regression bound 2 ms) | T0 error |
|---|---|---|---|---|---|
| zero, with mic switch and tap, r1 / r2 | 268,539 / 271,466 B each, 600 video frames, 900 / 913 audio, decode rc 0, boxes tile exactly | 6 distinct sizes per file in 25 samples | 900/900 and 913/913 packets, 0 differing, 0 vs encoder manifest, 900 / 913 distinct payloads | 0.035 / 0.025 ms | 13 / 13 us |
| +80 / -80 ms, r1 / r2 | 270,911 / 270,860 B | 6 distinct sizes | 912/912, 0 differing | 80.0236 and -79.9764 / 80.0194 and -79.9806 ms (error 0.024 / 0.019) | 9 / 12 us |
| drift +200 / -200 ppm, r1 / r2 | 569,574 / 568,946 B, 1,600 video frames | 16 distinct sizes in 65 samples | 1852/1852, 1849/1849, 0 differing | fitted slope 199.78 and -200.09 / 200.09 and -200.03 ppm, max error vs truth 0.029 / 0.028 ms | 10 / 13 us |

- The drift case keeps its present expectation (the injected slope, within the 2 ms regression
  bound); nothing corrects it. The worker's own trend telemetry in those runs read +200.3 / -201.1
  and +208.1 / -201.8 ppm (`clocks[].trendPpm`, last frame of each run), telemetry only.
- The product bound (+-40 ms) is reported apart from the regression bound in every result
  (`product_bound_40ms`); it is never used as the pass criterion of a fixture run.
- The mics are a separate process (`fake_mic`): the truth of a beep is that process's own clock read
  (`mic.jsonl`), so the T0 error of the worker is IN the measured offset. It was 9-18 us in all runs.
  With a plain `nanosleep` in the fixture the same measurement read 772 us and the offsets 0.79 ms:
  the check does see a capture latency (found during development, then the fixture was made to hand
  its chunks over on time).
- Mic switch (`SWITCH_AUDIO_SOURCE` STANDBY, then PRIMARY): acknowledged in 4.1-10.4 ms, applied by
  the filtering thread before its next 10 ms quantum (`audio.c:121`, guard `:107`).
- Meters: telemetry at 20.1-20.8 Hz (17 sessions). PCM tap (file): 920,160 / 933,600 samples = the
  worker's `samples_in`; decoded minus tap = 1,440 / 1,312 = priming 1,024 + encoder tail.
- Negative control H-4: the same check on a copy whose second file was re-encoded FAILS (900 of 900
  packets differ). Negative control AV: the proof build with one forbidden mux option FAILS (5,520 /
  3,680 ms) while both files stay "playable" (section 4).

### 3.3 Camera stops (W-3), fatal error (W-4)

| Check | Result r1 / r2 |
|---|---|
| Camera 2 ends after 4.4 s, camera 1 after 13 s (`camstop`) | file 2 keeps growing: 5 distinct sizes in the 19 samples taken after camera 2 ended; 4 / 5 audio-only fragments, longest 2.112 s; file 2 playable; `WARNING CAPTURE_FAULT` subject `VIDEO-02`; worker exit 0 |
| Output directory removed after `START` (`fatal --mode rmdir`) | exit **70**, one `CRASH {code: VIDEO_MUX_WRITE_FAILED, exitCode: 70}`, no file |
| CONTROL (`fatal --mode clean`) | exit 0, no `CRASH` |

Mechanism of W-3: `cam_cut_if_stalled` (`ingest.c:217`) forces a fragment when a camera delivered no
video for `fragmentTargetMs` and no fragment was cut for as long. A camera whose video still flows is
never cut there, so OP-GOP (long GOP) stays undecided as the spec requires. `av_write_frame` replaces
`av_interleaved_write_frame`: the interleaver held the audio back for a camera that had stopped.

`fatal()` (`capture_worker.c:52`) is sticky: first code wins, exit code `EXIT_FATAL` 70
(`worker.h:50`), `CRASH` is sent after the files were closed as far as they go. `check.sh` forbids
any other success exit.

### 3.4 Option C on the disk

| Check | Result r1 / r2 |
|---|---|
| File at the path BEFORE `START` (`fatal --mode exists`) | `ACK ok=false OUTPUT_EXISTS`; SHA-256 of the file before = after (`68f97e86f714...`); no second file created |
| File planted AFTER `START`, before the first fragment (`--mode planted`) | exit 70, `CRASH`, SHA-256 before = after; the other camera's file exists |

### 3.5 Sockets (W-1, M3-RTSP-BIND-1 worker half) - `m3worker.py udp`

The ingest allows the protocol `tcp` only (`ingest.c:271`), so libavformat never creates the RTP
socket. libavformat 9.0.2 then retries the refused open in a loop that does not end (measured with
the CLI: 99 % CPU, no exit); the refusal is therefore caught where it is logged (`av_log_cb`
`:94`): the client is disconnected, the camera reported as `CAPTURE_FAULT`, the ingest thread ends.
Backstops: after every ingest open the process must own no datagram socket and no socket off
127.0.0.1 (`sockets_violation` `:56`, fatal), and an ingest still opening 10 s after its listen
timeout is fatal (`INGEST_OPEN_STUCK`).

```
bind_udp_r1 / r2   PASS   41 snapshots of `lsof -nP -a -p <pid> -i`, one every 100 ms while the UDP client tries
   udp []   not-loopback 0
   seen: 127.0.0.1:8555 (LISTEN), 127.0.0.1:8557 (LISTEN), 127.0.0.1:8557->127.0.0.1:<port> (ESTABLISHED)
   UDP client rc 183; log INGEST_TRANSPORT_REFUSED; camera 2 (TCP) recorded a playable file; worker exit 0
neg_bind_skeleton  FAIL (as required)   the row-111 binary, same client
   udp ['UDP *:5000', 'UDP *:5001']
```
Limit: `lsof` every 100 ms cannot exclude a bind shorter than that. The exclusion rests on the
mechanism (the open is refused before any socket call) and on the in-process check after each open.

### 3.6 Other items of the row-111 review

| Item | State |
|---|---|
| N-5 `fatal()` exits 0 | fixed, 3.3 |
| N-6 wrong log code | `INGEST_OPEN_FAILED` and `INGEST_OPTION_NOT_CONSUMED` are separate (`ingest.c:281-282`) |
| N-7 unchecked returns, `g_stop` | every allocation, `pthread_create`, `fopen`, `pthread_mutex_init` checked; `g_stop` is `atomic_int` |
| N-8 beep inside the worker | removed; the worker generates no audio |
| N-9 only 34 packets could differ | fixture mic 1 carries quiet noise: 900-1852 distinct payloads per run |
| N-10 static rule sees one symbol | libavfilter is named in `audio.c` only; graph pointer `static` there; `check.sh` holds it (4.2) |
| N-11 single-shot listener | unchanged by design (S1 G-1); a refused or ended ingest is a `CAPTURE_FAULT` warning |
| N-12 file time 0 | section 4.3 |
| N-13 analyser pairs nearest beep | unchanged (row 60's analyser); visible in the negative controls, whose errors read 5.5 s / 1.5 s / -0.5 s |
| N-14 arrival fallback | removed: a camera without a wall clock is not placed (`no_camera_wall_clock`) |
| PRFT anchoring | `ingest.c:320`; anchor follows a new report by at most `SLEW_US_PER_S` 500 us per second of media (`:46`); dts never goes backwards |

## 4. P4 - mux flags: decision with proof

**Decision D58-4: keep the pinned flags, plus `skip_trailer` (spec C.6):
`+frag_keyframe+empty_moov+default_base_moof+skip_trailer` (`ingest.c:41`). `delay_moov` is
rejected.**

Measured with two builds of the same sources (`make -C apps/capture-worker proof` builds
`capture-worker-delaymoov`), cases +80 / -80 ms:

| Criterion | Pinned flags | `delay_moov` |
|---|---|---|
| (a) first video sample | file shows `(pts 0, duration 529,706)`: held from file time 0; true pts 525,986 is in the record `FIRST_VIDEO_SAMPLE` | `(496,797, 1,800)`: correct |
| (b) offsets, normal run | 80.0236 / -79.9764 ms | 80.0333 / -79.9667 ms |
| (b') offsets when both cameras freeze 0.6 s after their first frame for 4 s (`--stall`: the first fragment is an audio-only stall cut, before any video sample) | **80.0264 / -79.9736 ms PASS** | **FAIL: 5,827 / 3,987 ms. The moov is written without the video's start offset; the whole video track sits at file time 0 (file first packet `(0, 1800)` while the true pts is 524,426). The file still decodes rc 0 and is "playable"** |
| (b'') a reader that ignores edit lists (`ffprobe -ignore_editlist 1`) | first packets unchanged (timing is in `tfdt` and durations; 0 edit lists) | video first packet moves from 496,797 to 0, audio from -1024 to 0: the video track is 5.5 s early (file 2: 511,197 to 0). Under `delay_moov` the video `tfdt` of the first fragment is 0; its offset exists only in the edit list |
| (c) file shape | `ftyp moov (moof mdat)*`, init 1,231 B, 0 `elst`, 0 `mfra` | same sequence, init 1,315 B, **2 `elst`** |
| (c) running hash = re-hash of the closed file at every fragment end | 0 mismatches in 7 fragments; final = whole file | 0 mismatches in 6 fragments |
| (c) tail validation: cut 45 bytes into the last `mdat` | box walk finds it; ffprobe rc 0, decoder rc 0 | same |
| (d) bytes on disk during the session | first file sample at 7.09 s, then every fragment | first at 8.08 s (the first flush writes the moov only), then every fragment |

(b') is a W-3 case: the worker must cut audio-only fragments for a stalled camera, and with
`delay_moov` that cut can come before the camera's first video sample. So the two requirements
cannot both hold; W-3 is normative. (b'') alone would also be a reason: evidence timing would
depend on every reader honouring edit lists.

With the file created at its first fragment (`sink.c`), the on-disk shape is the same for both flag
sets, so "0 bytes until the first fragment" is no longer a difference.

**The held first frame (known muxer behaviour, documented).** Under the pinned flags the first video
sample of a file is shown from file time 0 until its true time. In this worker the audio of every
file starts at T0, before the camera's first usable keyframe, so the hold lasts from the session
start to that keyframe (5.6-5.9 s in these fixtures, where the cameras start 5 s after the mics; in a
session whose cameras already stream it should be the time to the first keyframe after the first
sender report - HYPOTHESIS, not measured: no fixture streams before the session starts. Measured
here: the first packets of a camera carry no timestamp before its first sender report, the worker
waits for the next keyframe, and 49 frames (one fixture GOP minus the keyframe) are dropped at the
start of every camera, `dropped_prestart: 49` in every `camera_summary`). Every later sample is exact. The true
value is the lossless record `FIRST_VIDEO_SAMPLE { deviceId, pts, timescale }` (also in the log as
`video_started.first_pts` and `camera_summary.first_video_pts`); row 59 writes it into the manifest.
The AV checks exclude the first video sample (`first_video_sample_excluded: true`).

### 4.2 Static rule (M3-SR-2, row 58 part) - `apps/capture-worker/check.sh`

`make -C apps/capture-worker check` -> `check.sh: src: static rules OK (AU2-07, N-10, C.4 forbidden
options, W1-C1, H-4 one encoder, W-1, W-4, B.2)`. `make selftest` copies `src/`, appends ONE planted
line (`test/static/planted.tsv`, 13 lines), and requires the refusal by that rule:

```
refused as required (AU2-07): expected exactly 1 call site of the graph command, found 2
refused as required (N-10): libavfilter is named outside audio.c: audio.c capture_worker.c
refused as required (N-10): av_opt_set is not used by the worker (a second way to command the graph)
refused as required (C.4): forbidden mux option use_editlist in the worker
refused as required (C.4): forbidden mux option negative_cts_offsets in the worker
refused as required (C.4): forbidden mux option avoid_negative_ts in the worker
refused as required (W1-C1): non-existent mux option frag_type in the worker
refused as required (H-4): expected exactly 1 encoder lookup, found 2
refused as required (SEC35-23): a wildcard address in the worker
refused as required (W-1): rtsp_transport does not keep a listen ingest off UDP; it must not be relied on
refused as required (W-4): an exit with a success code outside main's return
refused as required (B.2): a print to standard output (only frames go there)
refused as required (B.2): the worker reads no environment variable
```
Where the forbidden option lives: nowhere in `src/`. One line of the `Makefile` (target `proof`)
builds `capture-worker-negctl` with `use_editlist=1`; `check.sh` holds the Makefile to exactly that
one line. That binary is the negative control of the AV checks: `neg_av_forbidden_option` FAIL
5,520 / 3,680 ms, `neg_sup_forbidden_option` (through the supervisor) FAIL 5,872 / 4,032 ms, files
playable in both. (Row 111 measured about 450 ms because its video started 0.45 s after T0; the
shift equals the true first video time.) A proof build says `-PROOF` in its `HELLO`.

### 4.3 THE media-time-origin constant

`CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES = 1_024` in `packages/shared/src/api/capture.ts:82`, exported
from `@dems/shared/api` (the transcriber depends on `@dems/shared`: row 77 imports it there).

    file time 0 = T0 - 1024 / 48000 s = T0 - 21.333 ms
    file time of tap sample n               = (n + 1024) / 48000 s
    file time of FIRST_VIDEO_SAMPLE         = pts / timescale + 1024 / 48000 s

Check on a run: record pts 525,986 + one frame 1,800 + 1,920 ticks (21.333 ms at 90 kHz) = 529,706 =
the second packet of the file. `protocol-pins.test.ts` holds the constant to the worker's flags
(1,024 without `delay_moov`, 0 with it).

## 5. P5 - engine seam and config

### 5.1 `config.ts` (P25 edits 7-10)

`git diff HEAD --numstat -- apps/core-server/src/config.ts` -> `45 0`. Keys: `DEMS_CAPTURE_MODE`
(`simulated` default | `real`), `DEMS_CAPTURE_WORKER` (absolute path), `DEMS_MEDIA_DIR` (absolute
path; default `<dataDir>/media/sessions`) - `config.ts:43-45`; fields `captureMode`,
`captureWorkerPath`, `mediaStoreDir` `:177-181`; parsing `:234`, `:242`; input `:263-267`; frozen
object `:312-314`. The loader reads them (`plugins/config/load-config.ts:65-67`; not a frozen file).
A bad mode or a path that is not absolute stops the boot (`ConfigError`); **no key is required
here**: `real` without a worker boots and every start fails cleanly with `CAPTURE_FAULT`. Whether
that boot is refused is CS-22 / row 61.

Pin: `apps/core-server/src/capture/__tests__/static.test.ts:290`. With the 45 waived lines taken
out, in order, `config.ts` hashes to `de6f7bc9...54f9`, the file as committed at 101ce62
(`shasum -a 256` taken before the edit, `git diff --quiet HEAD` confirmed it unmodified). Positive
controls in the test: one more line anywhere changes the digest; a changed waived line is "missing".
`app.ts` and `index.ts`: no diff from this row (`git diff HEAD --numstat` prints nothing for them).

### 5.2 Launcher

`capture/index.ts:87-107`: mode `real` AND a worker path -> `createProcessLauncher` with the fixed
arguments `--log <dataDir>/capture-worker.jsonl --heartbeat-ms 500`; otherwise
`unconfiguredLauncher`. Test `forwarder.test.ts` "which launcher ...": a program at an absolute path
is started with exactly those arguments and an environment that holds nothing of the server's;
CONTROLS: mode `simulated` with a program, and mode `real` without one, start no process.

### 5.3 Forwarder

`capture/forwarder.ts:47`: `telemetry` -> `engine.applyCaptureTelemetry({levels, ingest,
fragments})`, `warning` (worker's and supervisor's) -> `engine.raiseCaptureWarning({code, subject})`.
The listeners return nothing, so the supervisor's queue never waits for the engine. A telemetry
failure is reported once per episode and its recovery once; every refused warning is reported.
Reports go to the log and the persistent error log through `index.ts` (still the only file of the
folder that logs). `progress` is not forwarded (row 82). `clocks` is not forwarded (no slice).

`forwarder.test.ts` (13 tests): mapping; never a switch command; an engine that never answers
delays nothing (50 frames + a warning handed over, queue 0, worker alive) with the CONTROL that a
listener returning its promise does hold the queue (1 of 50 delivered); 40 failures = 1 report.

### 5.4 The INTERNAL actions (helper agent; full detail in
`delegation_progress/coder_execution_row58_p5_actions.md`)

`applyCaptureTelemetry` and `raiseCaptureWarning`: `packages/shared/src/api/sim-actions.ts:95-96`
(INTERNAL, `operations: []`), `sim/capture-telemetry.ts`, `sim/types.ts`, `live/source/bindings.ts`
(local), `engine/types.ts:228`, `:239`, `engine/host.ts:923`. A telemetry frame that changes no
durable slice opens no unit, writes no statement and bumps no revision; levels go to the streamed
meters.

Count pins moved (the count changed: 42 -> 44 actions, internal 1 -> 3, local 2 -> 4, hosted stays
31): `packages/shared/test/api-domain-operations.test.ts:639` (42 -> 44), `:643` (`[31, 9, 1, 1]` ->
`[31, 9, 1, 3]`), `:648`; `packages/shared/test/live-source-bindings.test.ts:203` (42 -> 44), `:220`,
`:130-137`; `apps/core-server/src/engine/__tests__/hosted-actions.test.ts:27` (42 -> 44), `:20-21`;
`apps/core-server/src/engine/__tests__/commands.db.test.ts:302`. core-web and mobile hold no pin of
the count. OpenAPI was not regenerated; the public totals are untouched.

**Outside the row, needs a ruling:** `apps/core-server/src/db/store/store.ts` lost `kind` from the
`ON CONFLICT DO UPDATE SET` list of `capture_devices`. `dems_app` has no UPDATE grant on `kind`
(`0005_capture_privileges.sql:39-40`), so every update of an existing row failed with 42501; this
row is the first writer of that path. No migration; schema version stays 2.

## 6. P6 - end to end through the supervisor (`m3worker.py sup`)

Fake cameras + fake mics -> production supervisor (`createCaptureSupervisor` + `ipc.ts`) -> real
worker. 2 runs each, all PASS; each negative control FAILS.

| Check | Result r1 / r2 | Negative control |
|---|---|---|
| M3-WI-1 `sup --mode run --case pm80` | two playable files 270,128 / 270,611 B, 6 distinct sizes each during the session, H-4 909/909 and 911/911 with 0 differing, offsets 80.0167 and -79.9833 / 80.0194 and -79.9806 ms, records seq 1-4 (`FIRST_VIDEO_SAMPLE` x2, `FIRST_DURABLE_FRAGMENT` x2), 0 supervisor reports | `neg_sup_forbidden_option`: FAIL 5,872 / 4,032 ms |
| M3-KC-1 file half `--mode kc1` | session 1: worker SIGKILLed after both durable records -> `FAULTED`, `durable true`, attempt 1, no worker, `workerDown [EXITED, SIGKILL, restartInMs null]` once, `CAPTURE_FAULT` once; file sizes before the kill = 3 s after = at the end (117,763 / 117,403 and 117,188 / 117,097 B), 2 fragments each, boxes tile exactly, playable. Session 2 on the same supervisor: another pid, other paths, playable 270,707 / 270,795 B, offsets 0.015 / 0.018 ms | `neg_kc1_option_c_removed` (supervisor mutated, M1): FAIL - the supervisor respawned (attempt 2), **the respawned real worker refused `START` with `OUTPUT_EXISTS`**, files unchanged 117,773 / 117,413 B and playable |
| M3-KC-3 `--mode kc3` | worker SIGKILLed right after `RECORDING`, before any source: `workerDown [EXITED, SIGKILL, 250]`, attempt 2, new pid, same paths; the respawned worker records playable files 316,179 / 314,751 B, offsets 0.029 / 0.019 ms | `neg_kc3_no_restart_allowed` (`--limits '{"maxRestarts":0}'`): FAIL, not restarted |
| M3-REC-1 | section 1 (unit, fake worker); the real worker's records arrive in order in every `sup` run | mutations M2, M3 |
| M3-SR-2 (row 58 part) | section 4.2 | 13 planted lines |
| M3-RTSP-BIND-1 (worker half) | section 3.5 | row-111 binary |
| M3-BC-1 | NOT RUN: boot checks are row 61's. This row's share is the keys and the launcher choice (5.1, 5.2) | CONTROLS in 5.2 |

The growth criterion can fail: after the kill of session 1 the same sampler reads constant sizes.

Leftovers after the whole series: `pgrep -fl "capture-worker|fake_cam|fake_mic|capture-session-driver"`
-> nothing; `lsof -nP -iTCP -sTCP:LISTEN | grep -E ":85(55|57|59|6[0-4]) "` -> nothing. Ports used:
8555 and 8557 only.

Harness changes AFTER the official series (no measured value depends on them): `sup --limits` (used
by `neg_kc3_no_restart_allowed`); the leftover check now matches the NAME OF THE PROGRAM (`ps`), not
any command line that mentions it - a later run, started from a shell line that contained the
words "capture-worker", reported that shell as a leftover and gave a false FAIL with every real
criterion passing. Control for the new check: a `fake_mic` blocked on a pipe is found, and is gone
after its kill. Re-run after the change: `session final_zero --case zero --switch` PASS (error
0.019 ms), `proto final_proto` PASS.

## 7. Measured timing (D57-4)

Idle host, all official runs (`evidence/20_m3_worker/official_runs_summary.txt`):

| Quantity | Measured | Default | Kept because |
|---|---|---|---|
| spawn -> `HELLO` | 17.8-42.7 ms (31 starts); 349.7 and 363.3 ms for the first start of a freshly built binary (417 ms seen once in development) | `helloTimeoutMs` 5,000 | 12x the slowest start seen |
| `START` -> `ACK` (worker) | 0.12-0.65 ms (n=19); through the supervisor, `start()` to `RECORDING` (spawn, `HELLO`, `ACK`) 22.0-51.1 ms (n=12) | `ackTimeoutMs` 5,000 | a switch is acknowledged when applied: 4.1-10.4 ms |
| heartbeat interval at 500 ms | min 492.9-497.5, median 499.1-501.3, max 502.1-507.2 ms (28 workers) | 500 / `heartbeatTimeoutMs` 2,500 | jitter +-7 ms; the timeout is five intervals |
| `STOP` -> exit | 7.1-15.5 ms (n=21); `supervisor.stop()` 20.8-29.9 ms (n=8) | `stopGraceMs` 5,000 | the flush is one fragment |
| restart after a kill | new worker `HELLO` 34.4-42.7 ms after its launch (n=3), which follows the 250 ms back-off; the ports were free at once | 250 ms x 2, max 8 s, 5 restarts | unchanged |
| `stableAfterMs` 30 s | not reachable in these runs: restarts stop at the first durable fragment (2 s after the cameras' first keyframe) | 30,000 | kept; comment says so |

No default changed; each is now stated with its measurement in
`packages/capture-protocol/src/index.ts:153-191`. These are numbers of one idle host: with STT
running they are not measured.

## 8. Decisions taken here (for the controller)

| ID | Decision | Alternative |
|---|---|---|
| D58-1 | Restart rule: restart only while not `durable`; durable = first fragment record or `OUTPUT_EXISTS` | "no restart after RECORDING at all" (one predicate; turns 11 row-57 tests round) |
| D58-2 | Init-segment-only file: the file is created at its first complete fragment, exclusively; any file at an output path = `OUTPUT_EXISTS` / fatal, never overwritten. No attempt-suffixed paths | replace a file that holds no fragment; suffixed paths |
| D58-3 | Protocol version 2; record sequence counted per worker | keep version 1 (no worker of version 1 exists outside the stub) |
| D58-4 | Mux flags: pinned + `skip_trailer`; `delay_moov` rejected on measurement (b'), (b'') | - |
| D58-5 | Fourth record kind `FIRST_VIDEO_SAMPLE` carries the true first video pts for the manifest; it does not mark the session durable | read it from the worker log |
| D58-6 | Mic input kind `PCM_FIFO` and `pcmTapPath` in the plan; T0 = earliest (arrival - samples/48000) over the first 300 ms; mics consumed by position on the host clock with 40 ms latency | the device adapter rows may replace the transport |
| D58-7 | `clocks` in `TELEMETRY`; "warning before the product bound" = the flag `nearBound` and a log line, NOT a `WARNING` frame (the warning codes are a pinned set) | a new warning code (contract change) |
| D58-8 | `sink.c` (fragment-granular append) sits in what row 59 calls the fMP4 writer; it holds no hash, fsync or checkpoint | row 59 may restructure it |
| D58-9 | The worker's own log is `<dataDir>/capture-worker.jsonl`, one generation kept at 8 MB | another place |
| D58-10 | Helper's choices on the INTERNAL actions (seven points) and the `store.ts` line | `coder_execution_row58_p5_actions.md` section 4 |

## 9. Written but not exercised by any check

1. PCM tap into a named pipe (the non-blocking path; only the file tap was measured).
2. A mic that starts late or stops (`fake_mic --start2-after / --stop2-after` exist, no case uses them); mic underrun fill.
3. The slew limit: no fixture changes its sender reports (row 62's fixture will).
4. `nearBound`: never true in 30 s runs.
5. `INGEST_OPEN_STUCK` and the 10 s shutdown watchdog.
6. One camera or one mic in the plan (the code takes 1 or 2; all runs used 2 and 2).

Known limits: the UDP refusal keys on libavformat's log text ("not on whitelist"), guarded by the
bind check and two backstops; a camera that never connects gets no file (its audio is dropped after
the listen timeout); the first GOP of a camera is not recorded; the forwarder is attached to the
unit's own supervisor, not to one a test puts in its place.

## 10. Suites

See `delegation_progress/coder_execution_row58.md` section "Baseline" for the full table with
commands and outputs.

---

# Fix round 1 (navigator findings; controller rulings D72)

Date 2026-10-09. Sources: `delegation_progress/pair_58_navigator_a.md` (A-1..A-15),
`pair_58_navigator_b.md` (F-1..F-14). No finding is disputed. Where this round changes what the
sections above say, this section is the current text (the camera subject is now `CAM-0x`, not
`VIDEO-0x`; the file is linked, not created in place; mics are resampled, not placed by index).

## FR-1 Outcome per finding

| Finding | Outcome | What changed | Test, and how it was seen red |
|---|---|---|---|
| A-1 camera identity | fixed | Frames carry capture device IDs (`CAM-0x`, `MIC-0x`, a mic role). The plan's camera entry is `{ deviceId: 'CAM-01', trackId: 'VIDEO-01', ... }`; the worker, the stub, the fixtures and the harness follow. Protocol header "IDENTITIES" | joined test `capture/__tests__/forwarder-engine.test.ts` (helper; real supervisor + forwarder + real simulator, 3 tests): `CAM-02` ENDED while recording -> LOST, `CAPTURE_FAULT CAM-02` -> alert + audit, mic warnings by device ID and by role, CLEARED, second ACTIVE = new audit row; control: `VIDEO-02` ends the worker (`WARNING_SUBJECT_UNKNOWN`) and the simulator refuses it. Helper's mutations: `coder_execution_row58_p5_actions.md` F5 |
| A-2 clearing | fixed | `WARNING` gains `state: ACTIVE \| CLEARED` (still protocol 2). Third INTERNAL action `clearCaptureWarning` (helper; 45 actions, internal 4, local 5, hosted 31; public totals unchanged). Forwarder: `CLEARED` clears after `CAPTURE_WARNING_CLEAR_HOLD_MS = 2000` (looked at on the next telemetry), an `ACTIVE` inside the hold cancels it; a later session reaching `RECORDING` clears every fault raised before. The supervisor says its own `CAPTURE_FAULT` `CLEARED` when a later session records | `forwarder.test.ts` "D72 (A-2)" x4, `records.test.ts` "D72 (A-2)"; mutations F1, F2, F3, M14 |
| A-4 NO SIGNAL | fixed (helper) | capture mode `real` -> the simulator is created with `capture: 'external'`: nothing is generated, a missing or stale feed reads NO SIGNAL | `sim-capture-telemetry.test.ts`, `capture-actions.db.test.ts` (helper) |
| A-5 record ceiling | fixed | Protocol header "RECORDS ARE LOW-RATE BY CONTRACT"; `recordBurstLimit 64` per `recordWindowMs 1000` (contract rate about 2/s: two cameras, one checkpoint per fragment of about 2 s; 64 is 32x that); the 65th = `PROTOCOL_VIOLATION / RECORD_RATE_EXCEEDED`, worker ended, session `FAULTED` | `records.test.ts` "A-5": 64 taken, 65th ends the worker, 100,000 more are not listened to (64 handed on in total); control 10/s for 10 s. Mutation M9 |
| A-6 attempt | fixed | `record` event carries `attempt` | "A-6"; M15 |
| A-7 final refusals | fixed | `FINAL_START_REFUSALS` (7 codes) are not retried. A regular-file tap: the first worker is refused (`TAP_PATH_OCCUPIED`, final); a RESTARTED worker that finds the tap file leaves it alone and records without a tap (`tapActive: false` in telemetry) | "A-7" x7 + control `NO_DEVICE` retried; M10. The tap rule for attempt 2 is code only (`capture_worker.c` `take_plan`), not run |
| A-8 surviving mutation | fixed | the lines of a retired worker: nothing is handed on; a fragment record among them marks the session durable and calls the waiting restart off | "A-8" x3; M8 (2 red), M13 |
| A-9 static rule | fixed | `check.sh`: no `O_TRUNC`; every `O_CREAT` with `O_EXCL`; exactly one `link()` (in `sink.c`); `rename()` only for the log; one `fopen(..., "w")` (the diagnostic manifest) | 4 planted lines refused (`make selftest`: 18 planted lines) |
| A-10 record content | fixed | second first-fragment / first-video record of a camera = `RECORD_REPEATED`; anything after the seal = `RECORD_AFTER_SEAL` | "A-10" x4 + control; M11, M12 |
| A-13 forwarder report | fixed | `report` wrapped | "A-13"; F4 |
| A-15 hysteresis | fixed for warnings (the 2 s hold above); ingest states cannot flap (one-shot listener: WAITING -> CONNECTED -> ENDED) | "a condition that flaps 50 times ... raises ONCE" | F2 |
| A-3, A-12 | carried: row 61 | - | - |
| A-11 | carried: row 65 | - | - |
| A-14 | carried: controller (closes list) | - | - |
| F-1 slew limit | fixed | `anchor.c` `anchor_follow`: the allowance is counted from the last packet that carried a report, used or not | `test/anchor_test.c` (`make unit`): 600 s quiet then +200 ms: first step <= 10 us (500 us/s x one 20 ms frame), 5 ms in 10 s. Red: the same file with `-DOLD_SLEW` (the previous rule): "first step after a quiet time: 200000 us (allowed 10)"; `make unit` runs both every time |
| F-5 `nearBound` | fixed (D58-7 reworked now, not deferred) | `nearBound` = the best arrival of the last 10 s is 30 ms or more from camera time (a late arrival can only raise a lag, so a stall cannot set it); `lagMs` is that value; the trend is fitted on per-second best arrivals | `anchor_test.c`: a 4 s stall alone -> never true; clock +-10 s -> true; drift 3.5 ms/s -> true (up to one window late) and 3,500 ppm fitted; healthy camera -> never. Consequence: the +-80 ms fixture cameras now read `nearBound true`, which is correct (their clocks are 80 ms off) |
| F-2 UDP refusal | fixed | (1) no message text is read: the 4th error-level report of libav on a thread that is opening its ingest ends that ingest (`ingest.c` `OPEN_ERROR_LIMIT`); `check.sh` forbids the old text. (2) log bounded: 200 lines/s, 16 MiB per worker run, 8 MiB rotation at start. (3) an ingest still opening at its listen timeout + 10 s is given up for THAT camera only. (4) at the end the worker waits 3 s for the ingest threads, closes every other camera's file, sends `CRASH INGEST_THREAD_STUCK`, exits 70. (5) sockets re-checked every second | harness `udp --variant norefusal` (a build that does not take the exit: navigator B's scenario): 0 UDP, log 0.56 MB with about 10 million lines suppressed (navigator: 1.23 GB), camera 2 playable and whole, `CRASH`, exit 70, no hang; `udp` (normal) still PASS |
| F-3 0-byte file | fixed | `sink.c`: first fragment to `<path>.<pid>.part` (`O_EXCL`), `link()` to the final name, unlink; stale `.part` files are reported at START and never reused or removed | `test/sink_kill_test.c` (`make unit`): 200 kill -9 swept over the child's life in about 1 s: final name absent or init + whole first fragment, 0 violations; the next worker refuses every existing file untouched. Red: the same test against the previous in-place create: 6 violations ("a file of 0 bytes at the final name") |
| F-4 mics | fixed | each mic runs through libswresample (compensation interface) into a short buffer; a controller holds the buffer level by asking for at most +-5,000 ppm; a mic that stops reads NO SIGNAL (`dbfs: null`) and is re-placed when it returns; nothing is dropped for lateness. `fake_mic` gains `--ppm`, `--stop-at`, `--resume-at` | harness `mic --mode slow` (2,000 ppm slow, 33 s) and `mic --mode gap` (stop 12 s, return 17 s). Red: navigator B's measurement on the previous code (silent from second 19 / silent to the end); control now: `--variant nocomp` (compensation off) FAILS |
| D72(k) no camera | implemented | no camera connected and none still waiting -> fatal `NO_CAMERA_CONNECTED`, exit 70, no file; the supervisor treats that crash code as final: `FAULTED`, one `CAPTURE_FAULT`, no restart. One camera = a valid degraded session | harness `nocam --mode none / one`, `sup --mode nocam`; unit "a crash a new worker would repeat"; M16 |
| F-8, F-9, F-11, F-13 | fixed | `dropped_no_pts` counted; `v` must be a whole number, a NUL inside a line is no frame; sockets checked every second; telemetry lists clamped, the shutdown watchdog covers the no-session path | proto case; code |
| F-6 camera clock sanity | carried: row 62 / class C (now visible: `nearBound`) | - | - |
| F-7 pipe tap | carried: rows 76/77; `tapActive` in telemetry now says when a tap ended | - | - |
| F-10, `-PROOF` refusal | carried: row 61 | - | - |
| F-12 | carried: row 59 (the last telemetry before close was removed) | - | - |
| F-14 | carried: row 60 | - | - |

Limits stated: `RECORDING` still means "the worker accepted the plan"; with no camera it lasts
until the ingest window closes (4.1-4.2 s at a 4 s listen timeout, 15 s by default), then `FAULTED`.
The mic bounds are mine: 5 ms for a 2,000 ppm mic (measured about 1-2 ms), 15 ms after a return
(measured up to 4.5 ms; the re-placement is by arrival, one 10 ms chunk coarse); product bound
+-40 ms. A mic on the host's clock is passed through unchanged (AV error still one sample).

## FR-2 New decisions taken in this round

| ID | Decision |
|---|---|
| D58-11 | `trackId` in the plan's camera entry; frames never carry it |
| D58-12 | Clearing: `state` on `WARNING`; hold 2,000 ms evaluated on telemetry; session-level clear at the next `RECORDING`. The real worker writes no `CLEARED` (its conditions do not end inside a session); the path is exercised with the fake worker and the joined test |
| D58-13 | Record ceiling 64 per second; content rules; late fragment record of a retired worker = durable |
| D58-14 | Mic input: libswresample compensation, +-5,000 ppm, level learnt over 200 ms, 1 ms dead band, gap 200 ms |
| D58-15 | Restarted worker + existing tap file: records without the tap |
| D58-16 | Refusal of a non-TCP transport = 4 error-level libav reports during one open (text-independent). A legitimate open that logs 4 errors would be refused too (fails closed) |
| D58-17 | Helper: `clearCaptureWarning` with subject null clears every active `MIC_SILENT`; in mode `real` an idle Core also shows NO SIGNAL; ignored IDs are logged once per engine run |

## FR-3 Harness series after the fixes (2 runs each; `evidence/20_m3_worker/fix_round_1_runs_summary.txt`)

`.cache/row58/official.sh` (copy in the evidence folder): 48 lines, every one `rc=0`.

| Check | Run 1 / run 2 |
|---|---|
| `make unit` | anchor checks hold, the old slew rule fails them; sink: 200 kills in 0.8 s, absent 19, present whole 181 (each refused untouched by the next worker), 0 violations |
| AV zero (switch + tap) | error 0.032 / 0.039 ms |
| AV +80 / -80 | 80.0236 and -79.9764 / 80.0292 and -79.9708 ms |
| Drift +-200 ppm | 199.78 and -200.09 / 200.03 and -200.09 ppm; max error 0.033 / 0.025 ms |
| `proto`, `camstop`, `fatal rmdir / planted / exists`, `udp`, `sup run`, `kc1`, `kc3` | PASS both runs |
| `mic --mode slow` (2,000 ppm slow, 33 s) | audible every second, 0 telemetry frames with `dbfs: null`; max AV error 1.81 / 2.11 ms (bound 5 ms) |
| `mic --mode gap` (stop 12 s, return 17 s) | silence in the gap, sound from second 17 on; beeps after the return within 1.22 / 1.25 ms (bound 15 ms); one restart per mic |
| `nocam --mode none` (listen timeout 4 s) | exit 70, `CRASH NO_CAMERA_CONNECTED`, no file, no `.part`, 4.22 / 4.20 s after START |
| `nocam --mode one` | file 1 playable, no file 2, `CAPTURE_FAULT` for `CAM-02`, exit 0 |
| `sup --mode nocam` (production supervisor) | `FAULTED`, attempt 1, `[EXITED, NO_CAMERA_CONNECTED, 70, restartInMs null]`, no file, 4.16 / 4.19 s |
| `udp --variant norefusal` | 0 UDP, 0 off loopback; log 559,565 bytes with 9.9 / 9.7 million lines suppressed; camera 2: 150 video frames, playable; `CRASH INGEST_THREAD_STUCK`, exit 70 |
| Negative controls | re-encoded file, forbidden mux option (worker and supervisor), row-111 binary, `maxRestarts 0`, no mic compensation (`nocomp`: errors 36.6 / 32.6 ms), option-C term removed from the supervisor (real worker refuses `OUTPUT_EXISTS`, files 117,392 / 117,032 B unchanged): each FAILS as required |
| P4 (`delay_moov` normal, shapes, stall pinned PASS, stall `delay_moov` FAIL) | as before |

Timing over this series: HELLO 18.3-471.6 ms (the two slow ones are first starts of fresh
binaries), START->ACK 0.12-2.7 ms, heartbeat interval 489.2-511.1 ms, switch 2.1-7.9 ms,
STOP->exit 4.6-15.6 ms, telemetry 20.1-20.7 Hz. No default changed.

Mutations (`.cache/row58/mutate.sh`, copy `mutate_supervisor.sh`; output
`fix_round_1_mutations.txt`): 16 of the supervisor (M1-M16) and 4 of the forwarder (F1-F4), each
turns 1 to 8 of the 171 tests red; restored: 171 passed.

## FR-4 Suites after the fixes

| Command | Result |
|---|---|
| `npm run test -w @dems/capture-protocol -- --maxWorkers=2` | 20 passed |
| `npx vitest run --root apps/core-server --project unit src/capture` | 9 files, 171 passed |
| `npm run test -w @dems/shared -- --maxWorkers=2` | 1993 passed |
| `npm run test -w @dems/core-web -- --maxWorkers=2` | 1523 passed |
| `npm run test -w @dems/mobile -- --maxWorkers=2` | 2020 passed |
| `npm run test -w @dems/core-server -- --maxWorkers=2` (sandbox off) | 3 failed (MODG: sessions routes x2, evidence routes x1) / 4301 passed |
| `/usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server -- --maxWorkers=2` (once) | 12 failed (all `test/acceptance/contract.test.ts`) / 1856 passed |
| `npm run test -w @dems/transcriber -- --maxWorkers=2` | **1 failed / 299 passed / 1 skipped**: `src/__tests__/chunker-clamp.test.ts` "a segment that starts at or after the audio end is dropped". That file is untracked and is not this row's (row 77 is being written in `apps/transcriber`; this row touched nothing there). Reported, not fixed |
| typecheck + lint: shared, core-server, capture-protocol (and transcriber) | exit 0, 0 warnings (two `no-useless-spread` warnings in `forwarder.ts` were fixed after the run; lint re-run: 0) |
| typecheck core-web / mobile | the 2 + 1 known `PrecheckCheckId` errors |
| `node --import tsx packages/shared/scripts/gen-openapi.ts --check` | "up to date (all (committed): 92 operations ...; offline: 26 operations ...)" |
| `npm run db:status` x4 | schema version 2, dbc-3, ledger matches |
| media in git (incl. `.part`) | 0 |
| processes / listeners | none of ours; 8554 / 8556 / 8558 still the emulators' |
| `git diff HEAD --numstat` frozen files | `config.ts` 45 / 0; `app.ts`, `index.ts` no diff |

## FR-5 For the navigators to re-run

```
python3 apps/capture-worker/test/m3worker.py build
make -C apps/capture-worker check selftest unit
npx vitest run --root apps/core-server --project unit src/capture </dev/null
.cache/row58/mutate.sh
python3 apps/capture-worker/test/m3worker.py mic nav_slow --mode slow
python3 apps/capture-worker/test/m3worker.py mic nav_gap --mode gap
python3 apps/capture-worker/test/m3worker.py mic nav_nocomp --mode slow --variant nocomp --expect-fail
python3 apps/capture-worker/test/m3worker.py nocam nav_none --mode none
python3 apps/capture-worker/test/m3worker.py nocam nav_one --mode one
python3 apps/capture-worker/test/m3worker.py sup nav_supnocam --mode nocam
python3 apps/capture-worker/test/m3worker.py udp nav_norefusal --variant norefusal
.cache/row58/official.sh && python3 .cache/row58/summarize.py
```
Navigator A: sections FR-1 rows A-*, `records.test.ts` (from "Fix round 1"), `forwarder.test.ts`
("D72 (A-2)"), `forwarder-engine.test.ts`. Navigator B: rows F-*, `test/anchor_test.c`,
`test/sink_kill_test.c`, `src/anchor.c`, `src/sink.c`, the mic part of `src/audio.c`.

Not exercised by any check after this round: the restarted worker that leaves an existing tap file
alone (code only); a `CLEARED` written by the real worker (it writes none); `INGEST_OPEN_STUCK`
give-up at listen timeout + 10 s (the session of the `norefusal` run ends before it); the PCM tap
into a named pipe; a mic outside +-5,000 ppm.
