---
task_slug: input_av_core_adapter_plan
row: 6
work_package: WP-01 (experiment E-11; security requirement AD-01 (1) to (3))
date: 2026-10-12
agent: test-expert
status: complete
---

# Row 6: experiment E-11, the RTSP listener of the release worker and a push it was not told about

Tier 2: what was found, why it matters, how it was verified, source. This record states observations only. **It selects no branch**; row 8 does, by the table of blueprint section 9.1.

## 1. What was found

Subject: `apps/capture-worker/build/capture-worker` (122144 bytes, dated Oct 10 10:46, sha256 `03795324e8a3910e74fa10aa7fa360c79ec056edbde5c481dd3cc9df7892f1dc`, `capture-worker/0.5.0`, protocol 4), linked against `/opt/homebrew/opt/ffmpeg/lib/libavformat.63.dylib` 63.1.102 (FFmpeg 9.0.2) on this Mac. Not rebuilt; no worker source edited.

| Observation | Runs | Outcome by the letter of AD-01 | In one sentence |
|---|--:|---|---|
| O-1 last character | 3 | **ACCEPTED 3** | every request answered `200`, `ingest_connected` logged for the port, 175 frames in the file |
| O-1 strict prefix | 3 | **ACCEPTED 3** | the same |
| O-1 one more component | 3 | **ACCEPTED 3** | the same |
| O-1 letter case | 3 | **ACCEPTED 3** | the same |
| O-1 trailing slash | 3 | **INCONCLUSIVE 3** | `OPTIONS` and `ANNOUNCE` to the wrong path answered `200`; the connection was closed without a status at `SETUP`; no `ingest_connected`, no file. Not ACCEPTED, and not REFUSED as AD-01 (3) defines it (section 4.1) |
| O-1 query string | 3 | **ACCEPTED 3** | as the first four |
| O-1 percent-encoded character | 3 | **ACCEPTED 3** | as the first four |
| O-1 total | **21 of 21 recorded** | ACCEPTED 18, INCONCLUSIVE 3, REFUSED 0 | controls ACCEPTED 21 of 21 |
| O-2 second client, right path | 3 | **INCONCLUSIVE 3** | the second client's TCP connection was refused (`Connection refused`); it sent no request and read no RTSP status. One `ingest_connected` for the port; the first client's file complete (175 frames). AD-01 (3) counts a refused connection as INCONCLUSIVE (section 4.2) |
| O-3 right path after a wrong-path push | 3 | **listener consumed 3**; precondition not met | the wrong-path push before it was ACCEPTED, not refused (it is an O-1 last-character push). The right-path push that followed, 9.2 s after the start and inside a 30 s listen window, got `Connection refused` |
| O-3s (supplementary, section 4.3) | 3 | listener consumed 3 | a client that sent one `OPTIONS` to a wrong path (answered `200`) and closed: the right-path push 0.5 s later got `Connection refused`; the camera ended `INGEST_OPEN_FAILED` / `CAMERA_NOT_CONNECTED`, 0 bytes |
| O-1s (supplementary, section 4.1) | 4 | 2 + 2 | raw handshake to the trailing-slash path, no media: with the track asked as `<path>/streamid=0` all four requests `200`; with `<path>//streamid=0` closed at `SETUP` |

No run recorded an RTSP error status (4xx or 5xx) from the listener for a wrong path. In no run did the worker's log or standard output contain any of the path texts used (0 occurrences in 34 runs).

### Cells of the decision table (blueprint 9.1), as observed

| Column of the table | Observed | Note |
|---|---|---|
| O-1 (all near misses) | ACCEPTED in 18 runs (six of the seven near misses, 3 of 3 each); INCONCLUSIVE in 3 (trailing slash); REFUSED in 0 | "REFUSED in every run" was not observed. "ACCEPTED in any run" was observed. The trailing-slash runs also fall under "INCONCLUSIVE ... runs" |
| O-2 | INCONCLUSIVE in 3 of 3 by AD-01 (3): refused TCP connection, no RTSP status | the facts behind the label are the same in all three runs and are not a timeout: no second `ingest_connected`, the first stream undisturbed |
| E-11b | not run here (row 7) | row 7's condition "O-1 or O-2 ACCEPTED in any run" is met by O-1 |

## 2. Why it matters

RC-1 and S13-05 ask that a push addressed to another path than the session's never reaches `ingest_connected` and never puts a byte in a file (`verification/02_security.md:155`). Branch A of addendum 5.3 rests on the library refusing such a push by itself. HX-1 / HS-3 expected the opposite (`verification/04_security_addendum.md:220`, `:313`). The observations here are the input of gate RC-1 (row 8) and decide whether row 7 runs.

## 3. How it was run (repeatable)

Driver (tracked, new, test code only): `apps/capture-worker/test-fixtures/e11_listener_path.py`. It imports `apps/capture-worker/test/m3worker.py` unchanged (`Worker`, `make_plan`, `spawn`, `own_sockets`, `leftovers`, `worker_log`, byte-code writing off), the way `.cache/hevc-experiment/hevc_experiment.py` does: HELLO, START (two cameras, two FIFO microphones fed by `build/fake_mic`), pushers, STOP reason STOPPED.

```
# repository root, command sandbox off (binds 127.0.0.1:8559 and :8561, reads ps and lsof)
M3_PORTS=8559,8561 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
  python3 apps/capture-worker/test-fixtures/e11_listener_path.py all        # 21 + 3 + 3 + 3 runs, about 6.5 min
M3_PORTS=8559,8561 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
  python3 apps/capture-worker/test-fixtures/e11_listener_path.py o1s --runs 2   # 4 supplementary runs
python3 apps/capture-worker/test-fixtures/e11_listener_path.py summary      # re-reads the results, runs nothing
# parts: o1 | o2 | o3 | o3s | o1s | smoke, each with [--runs N]
```

Pusher (both pushers of a run are this command; only the address differs):

```
/opt/homebrew/bin/ffmpeg -hide_banner -nostdin -loglevel trace -re -f lavfi -i testsrc2=size=320x240:rate=25 \
  -frames:v 200 -an -pix_fmt yuv420p -g 25 -bf 0 -c:v libx264 -preset ultrafast -tune zerolatency \
  -x264-params scenecut=0:keyint=25:min-keyint=25 -f rtsp -rtsp_transport tcp rtsp://127.0.0.1:<port>/<path>
```

Design of a run:

- **One worker session, two listeners.** The plan names `rtsp://127.0.0.1:8559/e11/Kq7xR2mV9tLc4Zp1` (camera 1) and `rtsp://127.0.0.1:8561/e11/Wd5nH8bJ3yGs6Tf0` (camera 2); both are in the worker's grammar (`src/capture_worker.c:110-126`). Worker options as the harness sets them: `--listen-timeout-s 12` (30 in O-3 and O-3s), `--heartbeat-ms 500`.
- **Control (AD-01 (1)).** In every run the other camera of the same session is pushed by the same command, started in the same moment (within 0.1 s), to its right path. A listener serves one client by design (`src/ingest.c:540`), so the control cannot use the listener under test. The listener under test alternates: runs 1 and 3 port 8559, run 2 port 8561.
- **Near misses (AD-01 (2)),** derived from the right path of the listener under test; for port 8559: `e11/Kq7xR2mV9tLc4Zp2`, `e11/Kq7xR2mV`, `e11/Kq7xR2mV9tLc4Zp1/x`, `e11/kq7xr2mv9tlc4zp1`, `e11/Kq7xR2mV9tLc4Zp1/`, `e11/Kq7xR2mV9tLc4Zp1?x=1`, `e11/%4Bq7xR2mV9tLc4Zp1`; for port 8561: `e11/Wd5nH8bJ3yGs6Tf2`, `e11/Wd5nH8bJ`, `.../x`, `e11/wd5nh8bj3ygs6tf0`, `.../`, `...?x=1`, `e11/%57d5nH8bJ3yGs6Tf0`.
- **What is read.** The path on the wire and the statuses come from the pusher's own trace log: each `Sending:` block (the request line as sent) and each `line='RTSP/1.0 ...'` it read back. `ingest_connected` comes from the worker's log (`worker.jsonl`), by port. Bytes are the size of the camera file of that port; frames by `ffprobe -count_frames`.
- **Classification (AD-01 (1) to (3)), fixed in the script before the series ran** (`classify`): ACCEPTED = `ingest_connected` for the port and bytes > 0; REFUSED = an RTSP status of 400 or more read by the pusher, no `ingest_connected`, 0 bytes, and the control ACCEPTED; anything else, and any run whose control was not accepted, INCONCLUSIVE.

Runs: 2026-10-12, 16:14:49 to 16:21:01 UTC (series `all`), then the four O-1s runs; 1-minute load at the start of a run 4.6 to 8.3. One single smoke run of `o1 last_character` preceded the series (ACCEPTED, the same record); the series overwrote its folder.

## 4. Per run

Wire statuses are in request order: `OPTIONS, ANNOUNCE, SETUP, RECORD` (the pusher's `TEARDOWN` gets no answer in any run, accepted or control). "ic" = `ingest_connected` lines for that port. Every worker of the 30 series runs acknowledged STOP and exited 0; 0 leftover processes, 0 leftover listeners in every run.

### 4.1 O-1: a push to another path, before any other client

| Run | Port | Path pushed (as sent on the wire) | Statuses read | Pusher rc | ic | Bytes (frames) | Control: path, ic, bytes, rc | Outcome |
|---|--:|---|---|--:|--:|---|---|---|
| last_character r1 | 8559 | `e11/Kq7xR2mV9tLc4Zp2` | 200 200 200 200 | 0 | 1 | 827083 (175) | `e11/Wd5nH8bJ3yGs6Tf0`, yes, 827083, 0 | ACCEPTED |
| last_character r2 | 8561 | `e11/Wd5nH8bJ3yGs6Tf2` | 200 200 200 200 | 0 | 1 | 827083 (175) | `e11/Kq7xR2mV9tLc4Zp1`, yes, 827079, 0 | ACCEPTED |
| last_character r3 | 8559 | `e11/Kq7xR2mV9tLc4Zp2` | 200 200 200 200 | 0 | 1 | 827358 (175) | yes, 827358, 0 | ACCEPTED |
| strict_prefix r1 | 8559 | `e11/Kq7xR2mV` | 200 200 200 200 | 0 | 1 | 827083 (175) | yes, 827083, 0 | ACCEPTED |
| strict_prefix r2 | 8561 | `e11/Wd5nH8bJ` | 200 200 200 200 | 0 | 1 | 827079 (175) | yes, 827079, 0 | ACCEPTED |
| strict_prefix r3 | 8559 | `e11/Kq7xR2mV` | 200 200 200 200 | 0 | 1 | 826938 (175) | yes, 826938, 0 | ACCEPTED |
| one_more_component r1 | 8559 | `e11/Kq7xR2mV9tLc4Zp1/x` | 200 200 200 200 | 0 | 1 | 827083 (175) | yes, 827083, 0 | ACCEPTED |
| one_more_component r2 | 8561 | `e11/Wd5nH8bJ3yGs6Tf0/x` | 200 200 200 200 | 0 | 1 | 827168 (175) | yes, 827168, 0 | ACCEPTED |
| one_more_component r3 | 8559 | `e11/Kq7xR2mV9tLc4Zp1/x` | 200 200 200 200 | 0 | 1 | 826934 (175) | yes, 826934, 0 | ACCEPTED |
| letter_case r1 | 8559 | `e11/kq7xr2mv9tlc4zp1` | 200 200 200 200 | 0 | 1 | 827358 (175) | yes, 827358, 0 | ACCEPTED |
| letter_case r2 | 8561 | `e11/wd5nh8bj3ygs6tf0` | 200 200 200 200 | 0 | 1 | 827164 (175) | yes, 827164, 0 | ACCEPTED |
| letter_case r3 | 8559 | `e11/kq7xr2mv9tlc4zp1` | 200 200 200 200 | 0 | 1 | 827618 (175) | yes, 827618, 0 | ACCEPTED |
| trailing_slash r1 | 8559 | `e11/Kq7xR2mV9tLc4Zp1/` | 200 200, then no answer to `SETUP` | 183 | 0 | no file, 0 | yes, 826649, 0 | INCONCLUSIVE |
| trailing_slash r2 | 8561 | `e11/Wd5nH8bJ3yGs6Tf0/` | 200 200, then no answer to `SETUP` | 183 | 0 | no file, 0 | yes, 826649, 0 | INCONCLUSIVE |
| trailing_slash r3 | 8559 | `e11/Kq7xR2mV9tLc4Zp1/` | 200 200, then no answer to `SETUP` | 183 | 0 | no file, 0 | yes, 826825, 0 | INCONCLUSIVE |
| query_string r1 | 8559 | `e11/Kq7xR2mV9tLc4Zp1?x=1` | 200 200 200 200 | 0 | 1 | 827164 (175) | yes, 827164, 0 | ACCEPTED |
| query_string r2 | 8561 | `e11/Wd5nH8bJ3yGs6Tf0?x=1` | 200 200 200 200 | 0 | 1 | 826649 (175) | yes, 826649, 0 | ACCEPTED |
| query_string r3 | 8559 | `e11/Kq7xR2mV9tLc4Zp1?x=1` | 200 200 200 200 | 0 | 1 | 827168 (175) | yes, 827168, 0 | ACCEPTED |
| percent_encoded r1 | 8559 | `e11/%4Bq7xR2mV9tLc4Zp1` | 200 200 200 200 | 0 | 1 | 828140 (175) | yes, 828140, 0 | ACCEPTED |
| percent_encoded r2 | 8561 | `e11/%57d5nH8bJ3yGs6Tf0` | 200 200 200 200 | 0 | 1 | 827590 (175) | yes, 827590, 0 | ACCEPTED |
| percent_encoded r3 | 8559 | `e11/%4Bq7xR2mV9tLc4Zp1` | 200 200 200 200 | 0 | 1 | 827164 (175) | yes, 827164, 0 | ACCEPTED |

Sample of an accepted wrong-path push (`runs/o1_last_character_r1/test.log`, the listener's plan path being `e11/Kq7xR2mV9tLc4Zp1`):

```
OPTIONS  rtsp://127.0.0.1:8559/e11/Kq7xR2mV9tLc4Zp2 RTSP/1.0              -> line='RTSP/1.0 200 OK'
ANNOUNCE rtsp://127.0.0.1:8559/e11/Kq7xR2mV9tLc4Zp2 RTSP/1.0              -> line='RTSP/1.0 200 OK'
SETUP    rtsp://127.0.0.1:8559/e11/Kq7xR2mV9tLc4Zp2/streamid=0 RTSP/1.0   -> line='RTSP/1.0 200 OK'
RECORD   rtsp://127.0.0.1:8559/e11/Kq7xR2mV9tLc4Zp2 RTSP/1.0              -> line='RTSP/1.0 200 OK'
worker.jsonl: capture-worker.ingest1 ingest_connected {"port":8559,"codec":"h264","width":320,...}
```

**The trailing-slash runs.** Pusher log (`runs/o1_trailing_slash_r1/test.log:256-330`):

```
ANNOUNCE rtsp://127.0.0.1:8559/e11/Kq7xR2mV9tLc4Zp1/ RTSP/1.0             -> 200 OK
SETUP    rtsp://127.0.0.1:8559/e11/Kq7xR2mV9tLc4Zp1//streamid=0 RTSP/1.0  -> Failed reading RTSP data: End of file
```

Worker log of the same run: `LIBAV_MESSAGE av_level 16 "Unable to find requested track"`, then `INGEST_OPEN_FAILED` port 8559 `"Invalid data found when processing input"`, reason `CAMERA_NOT_CONNECTED`; a `WARNING CAPTURE_FAULT CAMERA_NOT_CONNECTED` frame for that camera; the other camera recorded normally. So the wrong path itself was answered `200` at `ANNOUNCE`; what ended the connection was the track address with two slashes that the FFmpeg client builds from a path ending in a slash.

Supplementary O-1s (a raw client of the script, `raw_handshake`: the four requests, the description copied from the pusher's log, no media; control as in every run):

| Run | Port | Path | Track asked in `SETUP` | Statuses | ic | Bytes | Worker | Control |
|---|--:|---|---|---|--:|--:|---|---|
| o1s_single r1 | 8559 | `e11/Kq7xR2mV9tLc4Zp1/` | `.../Zp1/streamid=0` | 200 200 200 200 | 0 | 0 | **exited 70** (below) | connected, 22572 bytes, pusher rc 224 (cut short by the worker's exit) |
| o1s_single r2 | 8561 | `e11/Wd5nH8bJ3yGs6Tf0/` | `.../Tf0/streamid=0` | 200 200 200 200 | 0 | 0 | **exited 70** | connected, 22572 bytes, pusher rc 224 |
| o1s_double r1 | 8559 | `e11/Kq7xR2mV9tLc4Zp1/` | `.../Zp1//streamid=0` | 200 200, no answer to `SETUP` | 0 | 0 | exit 0 | ACCEPTED, 826649, rc 0 |
| o1s_double r2 | 8561 | `e11/Wd5nH8bJ3yGs6Tf0/` | `.../Tf0//streamid=0` | 200 200, no answer to `SETUP` | 0 | 0 | exit 0 | ACCEPTED, 826649, rc 0 |

With a single slash the listener answered `200` to all four requests of a push addressed to the trailing-slash path. Whether a push with media to that path then reaches `ingest_connected` was not shown: the raw client sends no media, and no pusher was built that announces a trailing-slash path and asks for the track with one slash.

**Side observation of the two `o1s_single` runs, outside the row's question.** After the completed handshake without media the worker logged `LIBAV_MESSAGE "dimensions not set"`, `OUTPUT_SETUP_FAILED` (`av_error "Invalid argument"`, level error) on the ingest under test, then `worker_exit rc 70 code OUTPUT_SETUP_FAILED`: **the whole worker ended, and with it the other camera's recording** (the control, 22572 bytes). Observed 2 of 2. It was not run with the right path, so it is not shown to depend on the path; the client was a local process that completed an RTSP handshake and sent nothing. A first attempt of these four runs, in which the raw client's `RECORD` did not name its session, got `454` at `RECORD` and the worker did not exit (its output is kept in `superseded/`; its run folders were overwritten by the corrected runs).

### 4.2 O-2: a second client on the right path after the first is connected

The second pusher was started when the worker's log held `ingest_connected` for the port (`first_connected_before_second: true` in all three).

| Run | Port | Path of both clients | Second client: statuses | Second client: failure, rc | ic for the port | File of the port | Control | Outcome |
|---|--:|---|---|---|--:|---|---|---|
| o2 r1 | 8559 | `e11/Kq7xR2mV9tLc4Zp1` | none (no request sent) | `Connection to tcp://127.0.0.1:8559 failed: Connection refused`, rc 195 | 1 | 827333 bytes, 175 frames; first client rc 0, statuses 200 x4 | ACCEPTED, 827333, rc 0 | INCONCLUSIVE |
| o2 r2 | 8561 | `e11/Wd5nH8bJ3yGs6Tf0` | none | the same on 8561, rc 195 | 1 | 827358 bytes, 175 frames; first client rc 0 | ACCEPTED, 827358, rc 0 | INCONCLUSIVE |
| o2 r3 | 8559 | `e11/Kq7xR2mV9tLc4Zp1` | none | the same, rc 195 | 1 | 826650 bytes, 175 frames; first client rc 0 | ACCEPTED, 826650, rc 0 | INCONCLUSIVE |

What makes the label ambiguous: the row's definition of REFUSED asks for an RTSP error status; here the port no longer listens once the first client is connected, so the second client is turned away one layer below RTSP. By the letter that is INCONCLUSIVE; in substance the three runs agree, the second client produced no second connect report and wrote nothing, and the first stream was complete. The table of 9.1 has rows for O-2 "REFUSED" and "ACCEPTED" only. Not tested: a second client that connects before the first one (that is a first client), and a second client in the interval between the first client's TCP connection and its `ingest_connected`.

### 4.3 O-3: the right path after a wrong-path push on the same listener

Listen timeout 30 s in these runs, so that the following push is inside the window.

| Run | Port | First client: path, result | Then right path, started | Statuses | Failure, rc | ic for the port | Bytes in the port's file | Control | Outcome |
|---|--:|---|---|---|---|--:|---|---|---|
| o3 r1 | 8559 | `e11/Kq7xR2mV9tLc4Zp2`, 200 x4, rc 0, **ACCEPTED** | `e11/Kq7xR2mV9tLc4Zp1`, 9.22 s after start | none | `Connection refused`, rc 195 | 1 (the wrong-path push) | 828148, 175 frames, all of the wrong-path push | ACCEPTED, 828148, rc 0 | listener consumed; precondition not met |
| o3 r2 | 8561 | `e11/Wd5nH8bJ3yGs6Tf2`, ACCEPTED | `e11/Wd5nH8bJ3yGs6Tf0`, 9.16 s | none | `Connection refused`, rc 195 | 1 | 827730 | ACCEPTED, 827730, rc 0 | the same |
| o3 r3 | 8559 | `e11/Kq7xR2mV9tLc4Zp2`, ACCEPTED | `e11/Kq7xR2mV9tLc4Zp1`, 9.19 s | none | `Connection refused`, rc 195 | 1 | 828263 | ACCEPTED, 828263, rc 0 | the same |
| o3s r1 | 8559 | raw `OPTIONS` to `e11/Kq7xR2mV9tLc4Zp2`: `RTSP/1.0 200 OK`, `Server: Lavf63.1.102`, `Public: ANNOUNCE, PAUSE, SETUP, TEARDOWN, RECORD`; closed | right path, 2.48 s (0.5 s after) | none | `Connection refused`, rc 195 | 0 | no file, 0 | ACCEPTED, 826686, rc 0 | listener consumed |
| o3s r2 | 8561 | raw `OPTIONS` to `e11/Wd5nH8bJ3yGs6Tf2`: 200; closed | right path, 2.46 s | none | `Connection refused`, rc 195 | 0 | no file, 0 | ACCEPTED, 826934, rc 0 | listener consumed |
| o3s r3 | 8559 | as r1 | right path, 2.43 s | none | `Connection refused`, rc 195 | 0 | no file, 0 | ACCEPTED, 827083, rc 0 | listener consumed |

O-3 as the addendum words it ("after a wrong-path push was turned away") could not be produced: no wrong-path push was turned away. What the runs show instead: the listener takes one TCP connection, whatever its path, and does not listen again. In O-3 the camera of the session was recorded from the wrong-path client and the right-path client never got in. In O-3s (worker log: `INGEST_OPEN_FAILED` `"End of file"`, `CAMERA_NOT_CONNECTED`) one request and a close cost the session that camera.

## 5. What makes an outcome ambiguous

1. **O-1 trailing slash is neither ACCEPTED nor REFUSED** by AD-01 (3): no RTSP error status, a closed connection after two `200`. The cause seen is the two-slash track address of this client, not a comparison of the path (O-1s: with one slash, four `200`). No run shows a trailing-slash push with media being recorded, and none shows it being refused with a status.
2. **O-2 is INCONCLUSIVE by the letter** (refused TCP connection) while its facts are uniform. Whether a refused connection on a closed listener may count as REFUSED for O-2 is a reading of AD-01 (3) that this row does not make.
3. **O-3's precondition does not exist** on this build; the recorded outcome is that of "after an ACCEPTED wrong-path push" and, supplementary, "after an OPTIONS-only client".
4. **Attribution.** Test push and control send the same picture, so their files have equal or near-equal sizes; a file is attributed to a pusher by its port (one pusher per port) and by the worker's `ingest_connected` line for that port, not by content.
5. **One pusher implementation.** All media pushes are the FFmpeg 9.0.2 command-line client (the raw client sends no media). The fixture `build/fake_cam` was not used as a second implementation.
6. **Classification label of the two `o1s_single` controls.** The script prints "control ACCEPTED" (connected, bytes > 0) although those controls were cut short by the worker's exit; the table above states what happened.
7. **Runs.** 3 per near miss and 3 per observation, as AD-01 (2) asks; the addendum's own 5.2 asked 2. All on one host, within 7 minutes, 1-minute load 4.6 to 8.3.

## 6. What stays unproven

- **Linux and the production build.** Everything here is this Mac's Homebrew libavformat 63.1.102. The repeat against the pinned library in the Ubuntu 24.04 container is row 141 (AD-01 (6)); **the repeat on the production host's build belongs to hardware check `9A/H-01`** (row 125 writes its procedure). Nothing here was run on Linux.
- A real camera or relay as the client; a client that speaks RTSP differently from FFmpeg's (other track addressing, authentication, other transports).
- E-11b (row 7): whether the worker can read the announced path before it probes.
- The worker-exit side observation of 4.1 with the right path, and with any other client.

## 7. Rules kept, with evidence

| Rule | Evidence |
|---|---|
| Worker not rebuilt, no source edited | `ls -la` and `shasum -a 256` of `build/capture-worker` after the runs: `122144 Oct 10 10:46`, `03795324...f1dc`, as before; no `make` run |
| Product source files changed: 0 | `git status --short apps/capture-worker` -> one line, `?? apps/capture-worker/test-fixtures/e11_listener_path.py` (the new test fixture); `git diff --stat -- apps/capture-worker` empty |
| Heavy-host lock for every run | each of the four invocations ran under `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock` from the repository root |
| Ports 8559 and 8561 on loopback only; no listener left | `listeners_before_pushers` = `127.0.0.1:8559`, `127.0.0.1:8561` in every result; after the last run `lsof -nP -iTCP -sTCP:LISTEN` shows no row for 8559-8564; `leftovers` empty in 34 of 34 results; no process of the script alive |
| Only own processes stopped | the script ends the process groups it started (`m3worker.killall` over its own list) |
| No media or log in the tracked tree | everything a run writes is under `.cache/e11-listener-path/` (git-ignored by `.gitignore:47`), 60 MB |
| No commit, no stage | none made |

## 8. Files

Tracked tree (new, uncommitted):
- `apps/capture-worker/test-fixtures/e11_listener_path.py` (516 lines: the run script, the FFmpeg pusher command, the two raw clients)
- `docs/2026-10-12_input_av_core_adapter_plan/test/006_e11_listener_path.md` (this record)
- `docs/2026-10-12_input_av_core_adapter_plan/delegation_progress/row_006.md`
- one line appended to `delegation_progress/file_claims.md`

Under `.cache/e11-listener-path/` (git-ignored):
- `summary.txt` (one line per run, 34 runs), `summary.json` (counts per observation)
- `run_all.out`, `run_o1s.out` (what the two invocations printed)
- `runs/<run>/`: `result.json` (every fact of the run), `test.log` / `control.log` / `first.log` / `second.log` / `wrong_first.log` / `right_after.log` (pusher trace logs), `worker.jsonl` (the worker's log), `manifest.jsonl`, `mic.jsonl`, `media/VIDEO-0n.mp4`
- `superseded/run_o1s_attempt1_record_without_session.out`

## 9. Driver decisions, for the controller to confirm

1. DRIVER DECISION: the control uses the **other listener of the same session**, because a listener serves one client; the listener under test alternates between the two ports.
2. DRIVER DECISION: O-2 and O-3 were run 3 times each (the addendum says 2); the O-3 runs use a 30 s listen timeout.
3. DRIVER DECISION: two supplementary observations were added (O-3s, O-1s), marked as such, because O-3's precondition did not occur and the trailing-slash result needed its cause separated from the path. They add 7 runs and no product change.
4. DRIVER DECISION: the "strict prefix" near miss drops the last 8 characters; the "percent-encoded" one encodes the first character of the second component.
