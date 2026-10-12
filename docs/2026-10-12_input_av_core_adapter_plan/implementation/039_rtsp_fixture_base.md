---
task_slug: input_av_core_adapter_plan
row: 39
work_package: WP-03b (test camera, base)
date: 2026-10-13
agent: coder-execution
status: complete
---

# Row 39: the test camera, base - a pull-side RTSP server on loopback

## 1. What was built

| File | State | What it is |
|---|---|---|
| `apps/capture-worker/test-fixtures/rtsp_test_camera.py` | new, 671 lines, untracked | the test camera: an RTSP server a client connects to and pulls from |
| `apps/capture-worker/test-fixtures/rtsp_test_camera_check.py` | new, 345 lines, untracked | the reference-client check of this row's verification cell |
| `.cache/rtsp-test-camera/` | git-ignored | two encoded clips (18.6 MB H.264, 6.9 MB HEVC) and the run folders |

No tracked file was modified. No Makefile target was run, nothing was built into `apps/capture-worker/build/`, no dependency was added: Python standard library plus the installed `ffmpeg` program (FFmpeg 9.0.2, Python 3.14.7).

**The double.** It stands for a real IP camera on the camera leg of the relay. It is the opposite of `fake_cam.c` and `fake_cam_sr.py`, which push into a listener (ANNOUNCE, RECORD): this one listens, and the client sends OPTIONS, DESCRIBE, SETUP, PLAY, TEARDOWN and receives RTP on the RTSP connection.

**Why hand-written and not FFmpeg.** Checked, not assumed: `ffmpeg -h muxer=rtsp` lists no listen option (the RTSP writer of 9.0.2 only pushes); `ffmpeg -h demuxer=rtsp` has `rtsp_flags listen`, which receives a push. Neither serves a pulling client, with or without Digest. `test/01_hevc_experiment.md` 4.3 further shows that the RTSP writer cannot be told to leave the parameter sets out of its description. So the dialogue, the description and the RTP packets are written by the fixture; the picture is encoded once by the `ffmpeg` program into an Annex B elementary stream and read back unit by unit. Both parameter-set forms are therefore exact by construction, and the check counts them from the wire.

**Where, and why there.** `apps/capture-worker/test-fixtures/` (the profile line allowed this folder or `apps/core-server/test/support/`). It is a stand-alone program, not a module: the relay rows 40 to 44 drive the worker folder with the Python harness (`test/m3worker.py`) and can import its constants or start it; the session rows (49, 50, 89, 146) start it as a child process from a TypeScript test, as they start the worker binary, and read the port from its first output line. Python is already a prerequisite of the worker build (`test/static/pinned_calls.py` in the Makefile), so the Core's tests gain no new one. Placing it in the Core's support folder would have made the worker folder's own series depend on another workspace.

## 2. Behaviour

| Subject | What the camera does |
|---|---|
| Modes of this row | `--codec h264\|hevc` times `--param-sets sdp\|inband`. `sdp`: parameter sets in the `a=fmtp` line (`sprop-parameter-sets`; `sprop-vps`, `sprop-sps`, `sprop-pps`) and nowhere in the stream. `inband`: the description names the codec only (HEVC: no `a=fmtp` line at all, as in the experiment); every keyframe carries the sets |
| Picture | default 1920x1080, 25 pictures a second, a keyframe every 25 pictures, no B-frames (bench cameras, `research/01_explore_input_av.md`); `--width --height --fps --gop` change it; the 250-picture clip repeats; `--frames N` sends N pictures per PLAY and then ends the connection, 0 = until stopped |
| Transport | RTP on the RTSP connection only. A SETUP that asks for UDP gets 461; the source holds no datagram socket |
| Authentication | Digest (RFC 2617, MD5, no `qop`), a new nonce with every challenge. OPTIONS is answered without an account; every other method needs it. A Basic or other header is counted and answered with the Digest challenge |
| Stream path | `--path`, default `/media/video1`; another path gets 404 after authentication |
| Bind rule | `127.0.0.1` only, no option for another address. Ports 8554 to 8564, 4400 to 4432, 5173, 8081 and anything below 1024 are refused before a socket exists (exit code 2). `--port 0` takes a free port and states it in the `ready` line |
| Account | ONE synthetic constant, `ACCOUNT_USER` / `ACCOUNT_PASSWORD` / `REALM` at `rtsp_test_camera.py:66-68`; tests import it (S13-16 (2): it is the needle of E-12). It is never written: events carry the authentication class of a request (`none`, `digest_ok`, `digest_refused`, `basic`, `other`) and counters, an error line carries type and place only |
| Output | JSON lines on standard output and in `--event-log`: `ready`, `request`, `stream_start`, `stream_end`, `connection_closed`, `error`, `exit` with the counters (`auth_basic`, `auth_digest_refused`, `challenges_sent`, `frames_sent`, `parameter_set_nals_sent`, ...). Rows 42 and 43 read their "requests carrying a credential" counts here |
| End | SIGTERM or SIGINT, `--max-seconds` (default 900), or the close of its standard input with `--exit-on-stdin-eof`; exit code 0, listener closed |

## 3. Verification

Commands, from the repository root, command sandbox off, 2026-10-12 18:10 to 18:18 UTC:

```
/usr/bin/lockf -k -t 240 .locks/heavy-host.lock \
  python3 -B apps/capture-worker/test-fixtures/rtsp_test_camera_check.py --port 8565 --runs 3 \
  --out .cache/rtsp-test-camera/check/row039
```

Per run a fresh camera with `--frames 125` at 1920x1080. The reference client of the stream is, with the account in the user part of `rtsp://127.0.0.1:8565/media/video1`:

```
ffprobe -v error -rtsp_transport tcp -count_frames -select_streams v:0 \
  -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames -of json <locator>
```

The challenge, the description and the unit types in the stream are read by a second, own RTSP client inside the check (not libavformat), so that what the camera answers is seen directly.

Output of the series (12 runs, exit code 0):

```
BIND RULE refused_ports=11 all_rc_2=True no_address_option=True bind_calls=1 datagram_sockets=0
PASS h264 sdp    run 1..3  ffprobe h264 1920x1080 25/1 frames 125/125 errors 0  sdp sprop-parameter-sets  stream sets {'7': 0, '8': 0}  401 ['digest']/['digest']
PASS h264 inband run 1..3  ffprobe h264 1920x1080 25/1 frames 125/125 errors 0  sdp none  stream sets {'7': 2, '8': 2}  401 ['digest']/['digest']
PASS hevc sdp    run 1..3  ffprobe hevc 1920x1080 25/1 frames 125/125 errors 0  sdp sprop-pps,sprop-sps,sprop-vps  stream sets {'32': 0, '33': 0, '34': 0}  401 ['digest']/['digest']
PASS hevc inband run 1..3  ffprobe hevc 1920x1080 25/1 frames 125/125 errors 0  sdp none  stream sets {'32': 2, '33': 2, '34': 2}  401 ['digest']/['digest']
RESULT PASS  runs 12  passed 12  listener_left []  .cache/rtsp-test-camera/check/row039/result.json
```

(The three lines of a mode were identical; they are folded into one here. `result.json` has every run.)

| Cell statement | Evidence (each in 3 of 3 runs per mode, `result.json`) |
|---|---|
| Each of the 4 modes answers a reference client as stated | `ffprobe` rc 0: codec `h264` (Constrained Baseline) or `hevc` (Main), 1920x1080, `yuv420p`, `r_frame_rate` 25/1, `nb_read_frames` 125 of 125 sent, 0 error lines |
| Parameter sets in the description or in band | description: the `sprop` fields above, none in `inband`; stream, 30 pictures read by the own client: H.264 units 7 and 8, HEVC units 32, 33 and 34, counted 0 in `sdp` and 2 each (one per keyframe) in `inband` |
| No account: the challenge | DESCRIBE without a header: 401, schemes offered `['digest']`, realm `DEMS test camera`, nonce of 32 characters |
| Wrong account: refused with a Digest challenge | own client with a wrong password: 401, `['digest']`, a new nonce; `ffprobe` with a wrong password: rc 1, "401 Unauthorized", 0 streams read |
| Binds `127.0.0.1` only | `lsof -nP -a -p <pid> -i` while running: `['127.0.0.1:8565 (LISTEN)']` and nothing else; `--host` is not an option (rc 2); one `.bind(` in the source, 0 `SOCK_DGRAM`; a UDP SETUP gets 461 |
| No port of 8554 to 8564 | 8554, 8556, 8558, 8559, 8561, 8564 (and 4400, 4432, 5173, 8081, 80) each: rc 2, `REFUSED`, 0 bytes of output |
| Camera's own account of the run | per run rc 0, counters `auth_basic` 0, `errors` 0, `auth_digest_refused` 2, `challenges_sent` 5, `frames_sent` 155 (125 + 30) |

Beside the cell, one run each (ports 8566, same lock):

```
LOOP h264 ffmpeg rc 0 frame=300 of 300 (clip 250, repeats) error_lines 0 camera rc 0 frames_sent 300 errors 0
LOOP hevc ffmpeg rc 0 frame=300 of 300 (clip 250, repeats) error_lines 0 camera rc 0 frames_sent 300 errors 0
STDIN_EOF camera rc 0 after 0.5 s listening []
```

(`ffmpeg -v error -rtsp_transport tcp -i <locator> -map 0:v -f null -`: the clip's repeat is decoded without an error; a camera whose parent closes its input ends within a second.)

After the runs:

```
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':85[5-7][0-9] '     -> no row
pgrep -fl rtsp_test_camera                                 -> no row
node scripts/secret-scan/count-only.mjs .cache/rtsp-test-camera <the two fixture files>
  -> camera-credential: 0, ingest-secret: 0, TOTAL: 0 in 0 file(s)
grep -rl <the password, the wrong password> .cache/rtsp-test-camera | wc -l   -> 0
```

One fault found and fixed on the way: the first series kept `ffprobe`'s error text with the account replaced value by value, which left the shape the scan counts (16 hits, no value among them). The check now removes the whole user part of a locator before it writes; the kept files were rewritten and the series re-run. The figures above are of the re-run.

## 4. What stays unproven (hardware package)

- A real camera: its Digest variant (`qop=auth`, SHA-256, a stale nonce), its description, RTP packing with several slices or aggregation packets, B-frames, long groups, parameter sets that come late or once, an audio track, UDP: `9A/H-10`, `H-11`, `H-12`, `H-21`, `H-22`, `H-23`.
- The reference client here is FFmpeg 9.0.2 on this Mac. The relay (rows 41 to 43) is the client that matters; Linux is row 141.
- The camera's sender reports pair its host clock with the media clock linearly; no drift model (that is `fake_cam_sr.py`'s subject, on the push side).

## 5. Not built here (the rows the blueprint names)

- Row 40: a Basic-only challenge (S13-01), a delay before the first keyframe, a drop and a resume in mid group, an account with `@ : / %` and a space.
- Row 152: a redirect to a second loopback port, a description whose control address names another host, a hostile codec name.
- Stalls, a wrong realm, a refusal of the credential on re-open: with the row that needs them. The places are one class each (`Connection.challenge`, `Connection.stream`, `Camera.description`).

## 6. Requests and driver decisions

Requests (`delegation_progress/file_requests.md`, both not blocking): a line for the fixture table of `apps/capture-worker/README.md`; a ruling on the port range.

DRIVER DECISIONS for the controller to confirm:

1. **Ports.** The delegation text said to use only 8559 to 8564; the verification cell of this row says the camera binds no port of 8554 to 8564. They exclude each other. Taken: the cell, because the range is the worker's ingest range (the relay dials the camera and the ingest port, RC-5 and RC-6 tell them apart by port). The runs bound `127.0.0.1:8565` and `:8566`, checked free before, under the heavy-host lock, never the emulator or development ports. If the controller wants the range the other way, the rule is one tuple (`REFUSED_PORTS`).
2. **A second file**, the check script, beside the fixture: the cell's verification is repeatable by the gate with one command.
3. **OPTIONS without an account**, everything else with it (common camera behaviour; the relay's first authenticated request is DESCRIBE either way).
4. **`sdp` mode strips the parameter sets from the stream** (strictly "in the description"), so the two modes differ in both places and a client that reads only one of them is caught. A camera that does both is not a mode of this row.
5. **No `qop`** in the challenge (the simplest form the pinned client answers); a `qop` variant belongs to a later row if the relay design asks for it.
6. Also refused beyond the cell: the development ports of this host (4400 to 4432, 5173, 8081).

Requirement identifier: S13-16 (2) for the test camera (one synthetic account constant in one test file; no environment file read).

---
*Generated: 2026-10-13 01:20 (local)*
