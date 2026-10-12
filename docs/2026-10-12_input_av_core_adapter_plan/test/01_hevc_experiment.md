---
task_slug: input_av_core_adapter_plan
work_package: WP-01 (fork F-2, runs E-1 and E-2, worker half)
date: 2026-10-12
agent: coder-execution
status: complete
---

# WP-01: HEVC through the existing capture worker - experiment report

## 1. Verdict

The existing release worker (`apps/capture-worker/build/capture-worker`, dated Oct 10 10:46, sha256 `03795324e8a3910e74fa10aa7fa360c79ec056edbde5c481dd3cc9df7892f1dc`, not rebuilt, no source touched) **carries an HEVC RTSP/TCP push into its fragmented MP4 camera file, with and without parameter sets in the SDP.**

| Variant | Source | SDP carries `sprop-*` | Ingest | File | Verdict |
|---|---|---|---|---|---|
| `h264_control` | FFmpeg libx264 | yes (`sprop-parameter-sets`) | `ingest_connected` h264, extradata 37 | h264 / `avc1`, 350 frames, 0 decode errors, 8 `moof` | **PASS** (the setup works) |
| `hevc_a` (E-1, parameter sets announced) | FFmpeg libx265 | yes (`sprop-vps/sps/pps`) | `ingest_connected` hevc, extradata 85 | hevc / `hev1`, 1920x1080, 350 frames, 0 decode errors, 8 `moof` | **PASS** |
| `hevc_b` (first attempt at "in-band only") | FFmpeg libx265 + `-flags:v -global_header` | **yes** - the flag did not remove them | as `hevc_a` | as `hevc_a` | **NOT THE INTENDED CASE**: a second run of variant A. Counted as nothing for E-2 |
| `hevc_b2` (E-2, in-band only) | own helper, libx265 opened without a global header | **no** | `ingest_connected` hevc, **extradata 87** (taken from the stream) | hevc / `hev1`, 1920x1080, 350 frames, 0 decode errors, 8 `moof` | **PASS** |

`INGEST_NO_EXTRADATA` was not logged in any run. No `error` line in any worker log. Hypotheses of F-2: **H-C holds** (the pinned muxer writes a usable HEVC sample entry), **H-F holds on this host for this stream** (the library's stream probe fills the parameter sets from in-band data), **H-G holds** (the track is named `hev1`, not `hvc1`).

Meaning for a real H.265 camera: the worker itself is not the obstacle, neither by codec nor by a camera that announces no parameter sets, **provided** the parameter sets arrive in-band inside the library's probe window (here: with the first keyframe, GOP 1 s). The stored sample entry is `hev1`; whether the clients play `hev1` is the open playback question (E-8), not a worker question.

## 2. What stays unproven

- **A real camera** (Uniview, Tiandy): their RTP packetisation, their sender-report clock (the worker gives up a camera more than 2 s off), long GOPs, B-frames, parameter sets that come late or only once, higher bit rates. The sources here were FFmpeg/libx265 encoders on the same host.
- **A camera that sends its first parameter sets later than the probe window** (in `hevc_b2` every keyframe carried VPS/SPS/PPS and the first one came at once). `INGEST_NO_EXTRADATA` remains reachable in that case; not exercised.
- **The Core's sealing and verification of an HEVC session, and playback** in the web console, tablet and export (E-8, H-L). Only the Core's tail validation was run on the files (section 6): CLEAN. The Core reader's codec name (`HEVC`, `fragments.ts:453-459`) and the frame-rate gap for HEVC (`fragments.ts:541-546`) were not exercised.
- **`hev1` acceptance by players** (H-G consequence): not tested.
- **Linux** and another libavformat build: the result rests on FFmpeg 9.0.2 (libavformat 63.1.102) on this Mac.
- E-10 and E-11 of WP-01 (pause/resume push, wrong path) were not part of this task.

## 3. How it was run (repeatable)

Driver (git-ignored): `.cache/hevc-experiment/hevc_experiment.py`. It imports `apps/capture-worker/test/m3worker.py` read-only (`Worker`, `make_plan`, `boxes`, `leftovers`, `own_sockets`; byte-code writing off) and drives the release worker over its standard streams as the harness does: HELLO, START (two cameras, two FIFO microphones, `build/fake_mic`), cameras pushed, STOP reason STOPPED. Per camera: 25 fps, GOP 25, 375 frames (15 s), RTSP over TCP; cam1 1920x1080 to `127.0.0.1:8559`, cam2 640x360 to `127.0.0.1:8561` (small, to spare the host).

```
# from the repository root, Bash sandbox off
M3_PORTS=8559,8561 /usr/bin/lockf -k -t 600 .locks/heavy-host.lock \
  python3 .cache/hevc-experiment/hevc_experiment.py h264_control hevc_a hevc_b
cc -O2 -o .cache/hevc-experiment/hevc_cam_inband .cache/hevc-experiment/hevc_cam_inband.c \
  $(/opt/homebrew/bin/pkg-config --cflags --libs libavformat libavcodec libavutil)
M3_PORTS=8559,8561 /usr/bin/lockf -k -t 600 .locks/heavy-host.lock \
  python3 .cache/hevc-experiment/hevc_experiment.py hevc_b2
```

Pusher of cam1 (cam2: `size=640x360`, port 8561, path `cam2`):

```
h264_control: ffmpeg -hide_banner -nostdin -loglevel verbose -re -f lavfi -i testsrc2=size=1920x1080:rate=25 -frames:v 375 -an -pix_fmt yuv420p -g 25 -bf 0 -c:v libx264 -preset ultrafast -tune zerolatency -x264-params scenecut=0:keyint=25:min-keyint=25 -f rtsp -rtsp_transport tcp rtsp://127.0.0.1:8559/cam1
hevc_a:       ... -c:v libx265 -preset ultrafast -tune zerolatency -x265-params scenecut=0:keyint=25:min-keyint=25:bframes=0:log-level=warning -f rtsp -rtsp_transport tcp rtsp://127.0.0.1:8559/cam1
hevc_b:       as hevc_a plus  -flags:v -global_header
hevc_b2:      .cache/hevc-experiment/hevc_cam_inband --url rtsp://127.0.0.1:8559/cam1 --width 1920 --height 1080 --frames 375 --gop 25
```

`hevc_cam_inband.c` is derived from `test-fixtures/fake_cam.c`: libx265 opened **without** `AV_CODEC_FLAG_GLOBAL_HEADER`, a moving diagonal pattern, the RTSP muxer of libavformat, sender-report origin = its own wall clock. It prints the SDP it announced and counts the parameter-set NAL units it sent.

Results: `.cache/hevc-experiment/runs/<variant>/result.json`, with `worker.jsonl`, `push1.log`, `push2.log` and `media/VIDEO-0n.mp4` beside it.

Run history, in full: (1) two waits for the heavy-host lock ended without a run (17:59-18:09 and 18:10-18:40, `lockf` exit 75; holder: another session's `apps/capture-worker/test/e2e.py`, pid 30858, not touched). (2) 18:41: the lock was had; `h264_control` recorded, then the driver's own analysis stopped on a Python error (`TypeError` sorting the `level` field: the worker's `mic_clock` lines carry a number there); its media is kept under `runs_attempt1_analysis_crash/`. The driver was corrected and (3) 18:43:53-18:44:59 the three variants ran once each. (4) `hevc_b` turned out not to be the intended case, so `hevc_b2` was built and run once, 18:45:58. Host load (1 min) at the starts: 6.48, 5.83, 9.17, about 7.

## 4. Evidence per variant

Common to all four runs (from each `result.json`): `rc = {push1: 0, push2: 0, worker: 0}`; `start_ack.ok = true`, `stop_ack.ok = true`; listeners before the sources `['127.0.0.1:8559', '127.0.0.1:8561']`; worker log levels `info 23, warn 2, error 0`; no CRASH frame; no stdout line that is not a frame; `leftovers = {processes: [], listeners: []}`.

The only warn lines and WARNING frames, identical in kind in the H.264 control: the end of each push.

```
{"level":"warn","source":"capture-worker.ingest1","message":"INGEST_ENDED","port":8559,"av_error":"End of file","video_packets":350,"reason":"CAMERA_STREAM_ENDED"}
{"type":"WARNING","code":"CAPTURE_FAULT","reason":"CAMERA_STREAM_ENDED","state":"ACTIVE","subject":"CAM-01"}
```
(`av_error` was `Connection reset by peer` instead of `End of file` for ingest1 in `h264_control` and `hevc_b`: how the FFmpeg client closed, not codec-related.)

Frames against expected, all variants and both cameras: pushed 375; the worker states what it left out, `"skipped":{"noTimestamp":1,"beforeAudioStart":0,"noCameraClock":0,"beforeKeyframe":24}` (the frame before the first sender report, then the rest of the first GOP: its documented start rule); expected in the file 375 - 25 = **350**; `camera_summary.video_packets` 350; ffprobe `nb_read_frames` **350**; 14 keyframes; `retimed 0`. Fragments: 8 `moof` / 8 `mdat` after `ftyp, moov`; boxes tile the file exactly; video samples per fragment `25, 50, 50, 50, 50, 50, 50, 25`; 8 FRAGMENT_CHECKPOINT records per camera; `KEYFRAME_INTERVAL observedMs 1000`.

### 4.1 `h264_control`

```
SDP:  a=rtpmap:96 H264/90000
      a=fmtp:96 packetization-mode=1; sprop-parameter-sets=Z0LAKNoB4AiflwEQAAADABAAAAMDKPGDKg==,aM4PyA==; profile-level-id=42C028
LOG:  ingest1 ingest_connected {"port":8559,"codec":"h264","width":1920,"height":1080,"extradata":37}
      ingest2 ingest_connected {"port":8561,"codec":"h264","width":640,"height":360,"extradata":37}
      camera_clock_floor lag_ms -461.6 (bound 2000)
VIDEO-01.mp4 24860520 bytes: {"codec_name":"h264","profile":"Constrained Baseline","codec_tag_string":"avc1","width":1920,"height":1080,"r_frame_rate":"25/1","duration":"16.547544","nb_read_frames":"350"}
                             {"codec_name":"aac","profile":"LC","codec_tag_string":"mp4a","duration":"17.541333","nb_read_frames":"823"}
VIDEO-02.mp4  3517416 bytes: h264 / avc1, 640x360, 350 frames
decode (ffmpeg -v error -i <file> -map 0 -f null -): rc 0, 0 error lines, both files
```

### 4.2 `hevc_a` (E-1)

```
SDP:  a=rtpmap:96 H265/90000
      a=fmtp:96 sprop-vps=QAEMAf//AWAAAAMAkAAAAwAAAwB4ugJA; sprop-sps=QgEBAWAAAAMAkAAAAwAAAwB4oAPAgBEHy5bpKTC8BaAgAAADACAAAAMDIQ==; sprop-pps=RAHAcYMS
LOG:  ingest1 ingest_connected {"port":8559,"codec":"hevc","width":1920,"height":1080,"extradata":85}
      ingest2 ingest_connected {"port":8561,"codec":"hevc","width":640,"height":360,"extradata":85}
      video_anchored mode prft; camera_clock_floor lag_ms -458.8 (bound 2000)
      camera_summary cam 1 {"video_packets":350,"audio_packets":821,"fragments":8,"durable_fragments":8,"bytes":15915317,"dropped_no_pts":1,"dropped_prestart":24,"retimed":0,"size_bound_cuts":0}
VIDEO-01.mp4 15915317 bytes: {"codec_name":"hevc","profile":"Main","codec_tag_string":"hev1","width":1920,"height":1080,"pix_fmt":"yuv420p","r_frame_rate":"25/1","duration":"16.552156","nb_read_frames":"350","extradata_size":111}
                             {"codec_name":"aac","profile":"LC","codec_tag_string":"mp4a","duration":"17.511333","nb_read_frames":"821"}
VIDEO-02.mp4  2277923 bytes: hevc / hev1, 640x360, 350 frames
decode: rc 0, 0 error lines, both files
```

### 4.3 `hevc_b` (not the intended case)

The pusher's own log shows that `-flags:v -global_header` did not take the parameter sets out of the announce:

```
SDP:  a=rtpmap:96 H265/90000
      a=fmtp:96 sprop-vps=QAEMAf//AWAAAAMAkAAAAwAAAwB4ugJA; sprop-sps=QgEBAWAAAAMAkAAAAwAAAwB4oAPAgBEHy5bpKTC8BaAgAAADACAAAAMDIQ==; sprop-pps=RAHAcYMS
```
`result.json: sdp_has_sprop = {push1: true, push2: true}`. The run therefore repeats variant A (same outcome: hevc / `hev1`, 350 frames, 0 decode errors, extradata 85, first durable fragment of cam1 1143349 bytes, identical to `hevc_a`). It is reported, and not used as evidence for E-2. Why the option had no effect in FFmpeg 9.0.2 was not investigated.

### 4.4 `hevc_b2` (E-2, parameter sets in-band only)

Proof of the case, from `push1.log` (the helper's stderr; `push2.log` the same):

```
HEVC_CAM encoder_extradata_size=0 global_header_flag=0
HEVC_CAM muxer_stream_extradata_size=0
[rtsp @ 0x74aaec8000] SDP:
v=0
o=- 0 0 IN IP4 127.0.0.1
s=No Name
c=IN IP4 127.0.0.1
t=0 0
a=tool:libavformat 63.1.102
m=video 0 RTP/AVP 96
a=framerate:25
a=rtpmap:96 H265/90000
a=control:streamid=0
HEVC_CAM DONE packets=375 keyframes=15 keyframes_with_vps_sps_pps_inband=15 nal_vps32=15 nal_sps33=15 nal_pps34=15
```
No `a=fmtp` line at all, so no `sprop-vps/sps/pps`; every one of the 15 keyframes carried VPS, SPS and PPS in-band. `result.json: sdp_has_sprop = {push1: false, push2: false}`.

```
LOG:  ingest1 ingest_connected {"port":8559,"codec":"hevc","width":1920,"height":1080,"extradata":87}
      ingest2 ingest_connected {"port":8561,"codec":"hevc","width":640,"height":360,"extradata":87}
      video_anchored mode prft; camera_clock_floor lag_ms 46.7 (bound 2000)
      camera_summary cam 1 {"video_packets":350,"audio_packets":907,"fragments":8,"durable_fragments":8,"bytes":2525587,"dropped_no_pts":1,"dropped_prestart":24,"retimed":0}
VIDEO-01.mp4 2525587 bytes: {"codec_name":"hevc","profile":"Main","codec_tag_string":"hev1","width":1920,"height":1080,"pix_fmt":"yuv420p","r_frame_rate":"25/1","duration":"17.867256","nb_read_frames":"350","extradata_size":110}
                            {"codec_name":"aac","profile":"LC","codec_tag_string":"mp4a","duration":"19.341333","nb_read_frames":"907"}
VIDEO-02.mp4  557355 bytes: hevc / hev1, 640x360, 350 frames
decode: rc 0, 0 error lines, both files
```
The worker's `extradata 87` with an empty announce can only come from the stream: `avformat_find_stream_info` (`src/ingest.c`, before the check at `:512`) filled it. (The smaller file is the simpler picture of the helper, not a loss: 350 of 350 expected frames.)

## 5. Observations that are not HEVC findings

- Video stream duration 16.5-17.9 s for 350 frames (14 s of pictures): the first sample is held from file time 0 to the first keyframe after T0 (`FIRST_VIDEO_SAMPLE pts 227359/90000` = 2.5 s; in `hevc_b2` 346133 = 3.8 s). The H.264 control shows the same; it is the worker's documented start rule (`src/ingest.c`, "THE START OF A CAMERA FILE").
- ffprobe `avg_frame_rate` is therefore not 25 (`31500000/1489279`), for H.264 as for HEVC; `r_frame_rate` is `25/1`.
- The FFmpeg command-line pushers ran about 460 ms "ahead" by the worker's clock floor (`lag_ms -46x`), the helper +47 ms: both inside the 2000 ms bound. A real camera's clock is its own question.

## 6. The Core's tail validation on the files (read-only)

`npx tsx apps/capture-worker/test/tail_check.ts .cache/hevc-experiment/runs/<variant>/media/VIDEO-01.mp4` (the Core's `validateCameraFile`, `apps/core-server/src/capture/fragments.ts`; changes nothing; sandbox off because `tsx` opens a local pipe):

```
hevc_a:       {"ok":true,"flags":[],"state":"CLEAN","fileLength":15915317,"initLength":1322,"durableLength":15915317, 8 fragments, first {"mediaStartMs":0,"mediaDurationMs":3552,"keyframe":true}}
hevc_b2:      {"ok":true,"flags":[],"state":"CLEAN","fileLength":2525587,"initLength":1305,"durableLength":2525587, 8 fragments, first {"mediaStartMs":0,"mediaDurationMs":4867,"keyframe":true}}
h264_control: {"ok":true,"flags":[],"state":"CLEAN","fileLength":24860520,"initLength":1251,"durableLength":24860520, 8 fragments}
```
The Core's fragment walk accepts the HEVC files as it accepts the H.264 one. This is not sealing and does not print the codec name.

## 7. Rules kept

- `git status --short apps/capture-worker apps/core-server packages | wc -l` -> `0` before the first attempt, before each run and after the last. No tracked file modified; no `make` target run; `build/capture-worker` still `122144 Oct 10 10:46` after the runs (the other session's e2e series had rebuilt the proof builds at 17:48-17:49, not the release worker).
- Ports 8559 and 8561 on 127.0.0.1 only. After the runs `lsof -nP -iTCP -sTCP:LISTEN | grep ':85[56][0-9] '` returned no row. Only processes started by the driver were ended, by the driver.
- Heavy-host lock held for every capture. No input-av data, no `.env`, no network device.
- Everything written by the experiment is under `.cache/hevc-experiment/` (git-ignored) and this task folder.
