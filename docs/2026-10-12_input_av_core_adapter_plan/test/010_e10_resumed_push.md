---
task_slug: input_av_core_adapter_plan
row: 10
work_package: WP-01 (experiment E-10 extended; design addendum 5.1, review finding F10 (a))
date: 2026-10-13
agent: test-expert
status: complete
tier: T2
---

# Row 10: experiment E-10 extended - a camera push that pauses and resumes with a time jump, and a resumed push that does not begin on a keyframe

Tier 2: what was found, why it matters, how it was verified, source. **Observations only. It decides nothing**: row 14 writes the verdict and the consequence for WP-11. No product file was changed, nothing was built into `apps/capture-worker/build/`, the release worker ran as it is.

## 1. Answer, per question

21 runs: 7 cases, 3 runs each, every run one worker session with its own control (the other camera of the same session, the same clip from the same pusher, no pause). The control was clean in 21 of 21 (section 6).

| Question | Outcome observed | Runs |
|---|---|---|
| A push that pauses and resumes **on the same connection**, timestamps jumped by the length of the pause: what lands in the file | **one file with a gap, 0 decode errors**. One file per camera; the video track steps by 6.02 s (pause 6 s) or 20.02 s (pause 20 s) at the resume; the audio track is unbroken; worker exit 0 | 9 of 9 (`key` 3, `nonkey` 3, `long` 3) |
| The same, the resumed push **begins in the middle of a group of pictures** | the worker writes the pictures as they come. The file decodes with **0 messages** at level error and at level warning, exit 0 also with `-xerror -err_detect explode`; but **30 of 30** pictures between the resume and the next keyframe are **not the pictures the camera encoded** (their MD5 differs from the clip's; every picture before the pause and from the next keyframe on is identical) | 12 of 12 (`nonkey` 3, `long` 3, `far` 3, `back` 3). Control of the question: `key` (resumed on a keyframe) 0 damaged pictures, 3 of 3 |
| Does the worker drop what precedes a keyframe after the gap | **no**: 0 pictures dropped after the resume (330 written of 330 sent after the file's first keyframe) | 12 of 12 |
| Does the Core reader accept the file | **yes**: `validateCameraFile` `ok true`, state `CLEAN`, flags `[]`, durable length = file length, the worker's checkpoints `MATCH`. The fragment that holds the resume **does not start on a keyframe** by the reader's own walk, in every pause run, also in `key` (it begins with the last picture before the pause, which the muxer held); its media start lies before the start of the audio-only fragment written during the pause | 15 of 15 one-connection runs |
| Time jump **larger than the pause** (600 s after a 6 s pause) | one file; the video track steps by 599.72 s and ends at 609 s while the audio ends at 20.8 s; no decode message; reader `ok` | 3 of 3 (`far`) |
| Timestamps that **restart earlier** (2 s before the last one sent) | one file **without a visible gap**: the worker moves 100 pictures forward to one tick after the one before (`video_timestamp_moved` once, `retimed 100` in `camera_summary`); the video track ends at 7.3 s while the audio ends at 20.8 s; no fault frame names the pause | 3 of 3 (`back`) |
| What the worker reports during and after the pause | **during the pause: nothing** (0 log lines of level warn or error, 0 `WARNING` frames between the last picture before and the first after, 15 of 15). **At the resume** (11 to 26 ms after the first resumed picture): `WARNING CAPTURE_FAULT KEYFRAME_INTERVAL_ABOVE_BOUND ACTIVE` with the record `KEYFRAME_INTERVAL observedMs 7000 / 7600 / 21600 / 601300`, in 12 of 12 forward-jump runs; in `back` only the log line `video_timestamp_moved`, 3 of 3. No frame of state other than `ACTIVE` in any run | 15 of 15 |
| Is there a bound on the silence | none met up to 20 s: the connection stayed open, the pusher's sends after the pause succeeded, 0 send errors | 3 of 3 (`long`); 12 of 12 at 6 s |
| A **second connection** for the same track in the same session, after the first one ended | **refused at TCP level**: `Connection refused` on 10 of 10 attempts per run, 2.4 to 5.2 s after the first connection ended, 7.1 to 9.9 s after T0 (the audio start the worker logs, under 0.1 s after the START acknowledgement), **inside** the 30 s ingest window. No RTSP request was ever answered, so **no address was reached**: the question "under which address" has no case on this worker | 6 of 6 (`teardown` 3, `close` 3) |
| What the worker does with the first stream's file then | it keeps it and goes on: `INGEST_ENDED` (`av_error "End of file"`, reason `CAMERA_STREAM_ENDED`) logged in the same hundredth of a second as the end of the first connection, one `WARNING CAPTURE_FAULT CAMERA_STREAM_ENDED ACTIVE`; the file holds the 100 pictures of the first connection (decodes, 0 messages, 100 of 100 intact, reader `ok`, `CLEAN`, `MATCH`) and the session audio up to STOP (video ends at 4.7 s, audio at 17.8 s); worker stays up, exit 0 at STOP | 6 of 6 |
| Listener | the port under test is listening only until the first client connects (1 sample of 32 to 40 per run, the one before the push); never again in the session | 21 of 21 |

Named outcomes, for row 14:

- **E-10, one connection: "one file with a gap, 0 decode errors"** - 9 of 9 with a jump equal to the pause; with the qualification of the second line of the table (pictures after a mid-group resume are wrong and nothing says so).
- **E-10, a re-opened push: `SECOND_CONNECTION_REFUSED`** (TCP, no listener after the first client) - 6 of 6.

"WP-11 triggered: yes or no" is not answered here (the delegation: rows 14 and the controller decide). What the two readings rest on is in section 7.

## 2. Why it matters

- Addendum 5.1: "E-10 is extended as the review asks: the resumed push carries a time jump and does not begin on a keyframe at the camera side. If the worker, the muxer or the Core reader does not accept the jump, WP-11 is triggered." And its fact: "the worker drops what precedes a keyframe only at the start of a file (`WRK/ingest.c:631-639`); after a gap it would mux whatever comes first" - observed, 12 of 12.
- Addendum 2.4 (3): "the worker takes one push per listener per session (`WRK/ingest.c:540`). So a relay restart inside a session exists only if WP-11 is built" - observed, 6 of 6: the second connection finds no listener.
- The keyframe gate of the relay (F10 (a), HA-1) is the only place where a mid-group resume is stopped: neither the worker, nor the decoder of the installed FFmpeg, nor the Core reader reports it.

## 3. What was run

Fixture (new, declared): `apps/capture-worker/test-fixtures/row010_resumed_push.py`. It imports, without editing, `e11_listener_path.py` (the session: two cameras, two FIFO microphones of `build/fake_mic`, the worker driven over its standard streams by `test/m3worker.py`), `fake_cam_sr.py` (the RTP packet and sender-report writers) and `test/m3worker.py` (`boxes`, `tail_check`, `checkpoints_of`). Its sub-command `push` is the pusher: a hand-written RTSP client (ANNOUNCE, SETUP, RECORD, interleaved RTP over TCP, a sender report before the first picture of each part and before every 25th after it, TEARDOWN at the end) that connects to `127.0.0.1` only.

```
# repository root, command sandbox off (two loopback ports, ps / lsof); one lock hold per case
M3_PORTS=8559,8561 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
    python3 apps/capture-worker/test-fixtures/row010_resumed_push.py clip
for c in key nonkey back far long teardown close; do
  M3_PORTS=8559,8561 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
    python3 apps/capture-worker/test-fixtures/row010_resumed_push.py $c --runs 3
done
python3 apps/capture-worker/test-fixtures/row010_resumed_push.py summary     # one line per recorded run
```

- Worker: `apps/capture-worker/build/capture-worker`, 123184 bytes, `Oct 13 01:21`, SHA-256 `5c4493854a497c3e33d424977c880f23228966f11716846f0c3bc6639b249d08`, the same before the first and after the last run; `HELLO workerVersion capture-worker/0.6.0` in 21 of 21. Not rebuilt. Started with `--listen-timeout-s 30` (the production window of row 47), an empty environment.
- Installed FFmpeg 9.0.2 (`/opt/homebrew/bin/ffmpeg`, `ffprobe`); libavformat 63.1.102.
- The clip, encoded once by the script: `ffmpeg -f lavfi -i testsrc2=size=320x240:rate=50 -frames:v 1450 -pix_fmt yuv420p -c:v libx264 -preset ultrafast -tune zerolatency -threads 1 -x264-params scenecut=0:keyint=50:min-keyint=50:sliced-threads=0:slices=1:bframes=0:aud=0 -bsf:v h264_mp4toannexb -f h264`. 1450 pictures, a keyframe every 50, one slice a picture, 1749 to 10940 bytes a picture, 4231964 bytes, SHA-256 `fd67a13c...11e125`. Its reference decode gives 1450 different MD5 values (`-f framemd5`), which is what "intact" is measured against.
- The camera under test alternates (run 1 and 3: port 8559 / `CAM-01`; run 2: port 8561 / `CAM-02`). Addresses are synthetic, two path elements of 3 and 16 characters, never printed.
- Times: runs between 2026-10-12T19:08:23Z and 19:24:31Z; 1-minute load at the start of a run 2.5 to 9.2. A picture was sent at most 22 ms late (pusher's own measure, all runs).

### The seven cases

Every push under test: pictures 0-149 (3 s), then the case; the file begins at clip picture 50 (the worker's start rule: first keyframe after T0), so 100 pictures of the first part are in the file.

| Case | Connection | Pause | Timestamp of the first resumed picture | Resumes at clip picture | Then |
|---|---|---|---|---|---|
| `key` | the same | 6 s | the next one + 6 s | 200 (keyframe) | to 399, TEARDOWN |
| `nonkey` | the same | 6 s | + 6 s | 170 (20 pictures into a group; 150-169 never sent) | to 399 |
| `back` | the same | 6 s | 2 s **before** the next one (RTP 180000 after 358200) | 170 | to 399 |
| `far` | the same | 6 s | + 600 s | 170 | to 399 |
| `long` | the same | 20 s | + 20 s | 170 | to 399 |
| `teardown` | first ends with TEARDOWN; a second to the same address 2.4 s later, up to 10 attempts 0.3 s apart | 3 s | + 3 s | 170 | (never sent) |
| `close` | first closed without TEARDOWN; the same second connection | 3 s | + 3 s | 170 | (never sent) |

A sender report stating the true time of the first resumed picture precedes it. RTP sequence numbers continue without a hole on the same connection: the loss is at the camera side, as it is behind a relay that forwards without a gate.

### What is measured per file

`ffprobe` packets of both tracks (steps of the presentation time, key flags); the box walk of `m3worker.py`; three decodes by the `ffmpeg` program (`-v error`; `-v error -xerror -err_detect explode`; `-v warning` video only); one MD5 per decoded picture against the clip picture at its place; the Core's `validateCameraFile` through `apps/capture-worker/test/tail_check.ts` with the `FRAGMENT_CHECKPOINT` records of that camera; the worker's log lines and its `WARNING` / `RECORD` / `CRASH` frames; `lsof` listeners on the two ports every 0.4 s.

## 4. Facts per run - one connection

Identical in the three runs of a case unless two values are given. `pk` = video packets in the file.

| | `key` | `nonkey` | `long` | `far` | `back` |
|---|---|---|---|---|---|
| Pusher | DONE, 150 + 200 sent, 0 send errors | DONE, 150 + 230, 0 | DONE, 150 + 230, 0 | DONE, 150 + 230, 0 | DONE, 150 + 230, 0 |
| `ingest_connected` lines for the port | 1 | 1 | 1 | 1 | 1 |
| Video packets in the file | 300 | 330 | 330 | 330 | 330 |
| Largest step of video time, and where | 6.02 s before pk 100 | 6.02 s before pk 100 | 20.02 s before pk 100 | 599.72 s before pk 100 | none at the resume (the largest is the held first sample, 2.7 s before pk 1, as in every control) |
| Packet after the step flagged keyframe | yes | no | no | no | - |
| Steps not forward / under 10 ms | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 100 |
| End of video / end of audio (s) | 14.7 / 20.2 | 15.3 / 20.8 | 29.3 / 34.8 | 609.0 / 20.8 | 7.3 / 20.8 |
| Audio packets, steps other than 1024 samples | 946-948, 0 | 972-976, 0 | 1630-1632, 0 | 975-977, 0 | 975-977, 0 |
| Fragments (`moof`); video samples per fragment | 8; `50, 49, 0, 1, 100, 100, 0, 0` | 8; `50, 49, 0, 31, 100, 100, 0, 0` | 15; `50, 49, 0 x8, 31, 100, 100, 0, 0` | 8; `50, 49, 0, 31, 150, 50, 0, 0` | 6; `50, 49, 0, 231, 0, 0` |
| Decode, level error: lines, exit | 0, 0 | 0, 0 | 0, 0 | 0, 0 | 2 / 2 / 4, 0 - all of the checker's own null output ("non monotonically increasing dts to muxer", pictures one tick apart), none of the decoder |
| Decode `-xerror -err_detect explode`: exit | 0 | 0 | 0 | 0 | 0 |
| Pictures decoded | 300 | 330 | 330 | 330 | 330 |
| Intact / damaged: before the pause | 100 / 0 | 100 / 0 | 100 / 0 | 100 / 0 | 100 / 0 |
| Intact / damaged: resumed, before the next keyframe | 0 / 0 (none sent) | **0 / 30** | **0 / 30** | **0 / 30** | **0 / 30** |
| Intact / damaged: from the next keyframe on | 200 / 0 | 200 / 0 | 200 / 0 | 200 / 0 | 200 / 0 |
| Core reader | ok, `CLEAN`, `[]`, `MATCH` | the same | the same | the same | the same |
| Video-bearing fragments / of them starting on a keyframe (reader's walk) | 5 / 4 | 5 / 4 | 5 / 4 | 5 / 4 | 3 / 2 |
| Fragments whose media start lies before the one before | 1 | 1 | 1 | 1 | 1 |
| Worker log, warn or error, for the camera | `keyframe_interval_above_bound` (since 7000 ms, `open false`), `keyframe_interval_observed` 7000 ms, `INGEST_ENDED` | the same with `open true`, observed 7600 ms | 21000 ms, observed 21600 ms | 600699 ms, observed 601300 ms | `video_timestamp_moved` (once: `dts_in 241520 -> 419721` in run 1), `INGEST_ENDED`; `keyframe_interval_observed` 1000 ms, not above the bound |
| `camera_summary retimed` | 0 | 0 | 0 | 0 | 100 |
| `WARNING` frames for the camera | `KEYFRAME_INTERVAL_ABOVE_BOUND`, `CAMERA_STREAM_ENDED` (both `CAPTURE_FAULT`, `ACTIVE`) | the same | the same | the same | `CAMERA_STREAM_ENDED` only |
| Worker | exit 0, STOP acknowledged, 0 `CRASH` frames | the same | the same | the same | the same |

- `CAMERA_STREAM_ENDED` comes from the pusher's TEARDOWN at the end of its clip, before STOP, in the test camera and in the control alike. It is not an effect of the pause.
- The reader's fragment list of `nonkey` run 1, `[media start ms, duration ms, starts on a keyframe]`: `[0, 3670, true] [3584, 2987, true] [6570, 2005, false] [4650, 6620, false] [11200, 2070, true] [13205, 3968, true] [17173, 2005, false] [19178, 1593, false]`. Fragment 3 is audio only (cut during the pause); fragment 4 holds the last picture before the pause and the 30 resumed ones. In `far` the fragments after the resume have durations of 594777 to 600320 ms.

## 5. Facts per run - two connections

Identical in the 6 runs (3 `teardown`, 3 `close`) but for the figures given as ranges.

| | Value |
|---|---|
| First connection | ANNOUNCE 200, SETUP 200, RECORD 200; 150 pictures sent; ended 4.64 to 4.70 s after T0 |
| Worker at that instant | log `INGEST_ENDED`, `av_error "End of file"`, `video_packets 100`, reason `CAMERA_STREAM_ENDED`, at the same hundredth of a second; one `WARNING CAPTURE_FAULT CAMERA_STREAM_ENDED ACTIVE`. The same for TEARDOWN and for a close without it |
| Second connection | 10 attempts from 7.07-7.12 s to 9.83-9.88 s after T0; each `ConnectionRefusedError: [Errno 61] Connection refused`; 0 RTSP requests sent; pusher result `SECOND_CONNECTION_NOT_ESTABLISHED` |
| Listener on the port under test | seen in 1 of 32-33 samples (before the first client); absent from then on |
| `ingest_connected` lines for the port | 1 |
| File of the camera | 503123 to 504216 bytes; 100 video packets (clip pictures 50-149), 100 of 100 intact, 0 decode messages; video ends at 4.7 s, audio at 17.7-17.8 s (833-837 packets, 0 irregular steps); 8 fragments, video samples `50, 50, 0, 0, 0, 0, 0, 0`; reader ok, `CLEAN`, `[]`, `MATCH`; 2 of 2 video fragments start on a keyframe |
| Worker | alive when the pusher gave up; exit 0 at STOP; 0 `CRASH` frames |

A second START in the same worker process was not sent. Read, not run: `apps/capture-worker/src/capture_worker.c:13` ("it serves ONE session and exits; a second START is refused (SESSION_ALREADY_SERVED)") and `:313`. An address other than the plan's therefore exists only in another worker process (a new attempt, rows 47 / 179); that path was not exercised here.

## 6. The control

In 21 of 21 runs the other camera of the session, pushed without a pause: `ingest_connected` 1; 0 damaged pictures (every decoded picture intact: 650 in `key`, 680 in `nonkey`, `far` and `back`, 1380 in `long`, 530 in the two-connection cases; decoded = sent from the file's first keyframe on); 0 decode messages; 1 step of video time above 60 ms (the held first sample, 2.69 to 2.75 s); every video-bearing fragment starts on a keyframe; reader ok, `CLEAN`, `MATCH`; `WARNING` frames: `CAMERA_STREAM_ENDED` only, at its own TEARDOWN. So the 6.02 s step, the damaged pictures, the non-keyframe fragment and `KEYFRAME_INTERVAL_ABOVE_BOUND` belong to the pause and the resume, not to the pusher or the host.

## 7. What makes it ambiguous

1. **"0 decode errors" does not mean the pictures are right.** The installed decoder conceals a mid-group resume without a message at level error or warning and without a non-zero exit, also with `-xerror -err_detect explode`. The damage shows only against the source (30 of 30 pictures, 12 of 12 runs). The row's verification cell is met by its letter in `nonkey` and `long`; whether that is the "pass" the design means is row 14's reading.
2. **The clip is easy.** 320x240, a moving test picture, a keyframe every second, no B-frames: a mid-group resume damages 0.6 s. A camera with a group of several seconds damages as long; B-frames and HEVC were not run.
3. **"Accepts the jump" has two meanings.** On one connection (the relay lives, addendum 2.4 (1)) the worker, the muxer and the Core reader accept it in 15 of 15 runs. A re-opened push (the relay ended, 2.4 (3)) is refused in 6 of 6. The sentence of addendum 5.1 names the first; the title of WP-11 ("the ingest accepts a resumed push") names the second.
4. **The reader accepts; nothing here seals.** `validateCameraFile` is the walk the seal uses for the fragments. That the fragment after the pause begins on a non-keyframe and starts earlier than the one before it raised no flag there; sealing, verifying and the players were not run on these files.
5. **A jump that is not the pause** (`far`, `back`) cannot come from a relay that stamps by arrival (addendum 5.1); it shows what the worker does if the camera's own timestamps are forwarded: a video track of 609 s beside 21 s of audio, or a pause that leaves no trace in the video timeline. Both are recorded without a fault that names them (`far` raises the keyframe-interval fault with `observedMs 601300`).
6. **The fault at the resume is the keyframe-interval fault, not a camera-loss fault**, and it is raised when the first picture after the gap arrives, never during the silence. Nothing of the worker says "no picture for 6 s" while it lasts.
7. Pauses of 6 s and 20 s only; one connection per run; the hand-written pusher, not a camera and not the relay of row 41. A real camera: `9A/H-09`, `9A/H-20`.
8. One fragment-order observation is not explained here: the audio-only fragment cut during the pause carries a later media start than the video-bearing fragment that follows it. It is in every pause run and in no control.

## 8. Rules kept

- Heavy-host lock for every run, one hold per case (66 to 118 s). Ports 8559 and 8561 on 127.0.0.1; no source served by the row.
- No Mac camera or microphone opened: the picture is `lavfi testsrc2`, the microphones are `build/fake_mic`.
- Leftovers: 0 processes and 0 listeners of the run in 21 of 21 (`leftovers` of the harness). After the last run `pgrep -fl 'row010_resumed_push|capture-worker/build/capture-worker|fake_mic'` printed nothing (exit 1) and `lsof -nP -iTCP -sTCP:LISTEN` showed no row on 8559-8574.
- Path text of the run in the worker's log and standard output: 0 in 21 of 21.
- `node scripts/secret-scan/count-only.mjs .cache/row010-resumed-push apps/capture-worker/test-fixtures/row010_resumed_push.py`: `TOTAL: 0 in 0 file(s)`.
- Written: the fixture, this record, `delegation_progress/row_010.md`, and `.cache/row010-resumed-push/` (git-ignored: `clip/`, `runs/<case>_r<n>/result.json` with media and logs, `console/<case>.txt`, `summary.txt`; 95 MB).
- DRIVER DECISION 1: the cases `back`, `far` and `long` are not named by the row; they were added because "a time jump" is not the same as "the pause" and because a bound on the silence would change what WP-11 has to do. DRIVER DECISION 2: the fixture's static rules of `check.sh` (`fixture_rules`) name four files and do not read this one; it follows them (no listener, no wildcard address, loopback-only URL guard) but is not checked by them.
