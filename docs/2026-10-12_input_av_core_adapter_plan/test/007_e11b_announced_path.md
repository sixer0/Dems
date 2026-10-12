---
task_slug: input_av_core_adapter_plan
row: 7
work_package: WP-01 (step E-11b; security requirement AD-01 (5))
date: 2026-10-12
agent: test-expert
status: complete
---

# Row 7: step E-11b, can a listener read the path a client announced before the stream is probed; and which client ends the worker

Tier 2: what was found, why it matters, how it was verified, source. Observations only. **It selects no branch**; row 8 does, by the table of blueprint section 9.1. No worker source was edited, no binary under `apps/capture-worker/build/` was rebuilt.

## 1. Answer

**Can the announced path be read before media is accepted: PARTLY. Not from the context, its options or its metadata; yes from the text of the library's log messages, which the public log callback receives during `avformat_open_input`.**

| Public means | Shows the client's path | Instant | Runs |
|---|---|---|---|
| `AVFormatContext.url` (`avformat.h:1432`) | **No.** It stays the address the listener was opened with, after the open, after the probe and after 25 packets | - | 0 of 12 wrong-path runs |
| Every `AVOption` of the context and its children (`opt.h:586`, `:594`; 61 options read per instant), context and stream metadata, `event_flags` | **No** | - | 0 of 12 |
| `io_open` callback (`avformat.h:1921`) | **No**: it is not called by a listening RTSP input (0 calls in 18 runs) | - | 0 of 18 |
| `priv_data` (`avformat.h:1344`) | Not readable: the header documents it as format private data; its layout is in no installed header | - | - |
| **Log callback** (`av_log_set_callback`, `log.h:337`), message of level 32 `Updating control URI to <uri>` | **Yes, when the announced address differs from the listener's**; absent when it is equal | inside `avformat_open_input`, when the `ANNOUNCE` request line is read, before its answer is sent | 12 of 12 wrong-path runs; 0 of 6 right-path runs |
| **Log callback**, message of level 56 `Parsing[<n>]: ANNOUNCE <uri> RTSP/1.0` | **Yes, in every run**, right path and wrong path | the same instant (0.0 to 0.1 ms before the message above) | 18 of 18 |
| Log callback, level 24 `WARNING: Path <client's> differs from expected <listener's>` | Yes, on every request whose path differs, from `OPTIONS` on (and it names the listener's own path) | when each request line is read | 12 of 12 wrong-path runs |

By the letter of the gate condition AD-01 (5) ("for a push to a wrong path, the program prints a value equal to that wrong path and different from the address the listener was opened with"): **the condition is met in 12 of 12 wrong-path runs** (last character 3 observe + 3 refuse; the six other near misses 1 each). The value follows the client (it equals each of the seven near-miss paths as sent on the wire), so it is not the false READABLE of finding F-5.

**Qualification, for the controller and row 8 (it is not this row's reading to make):** the value does not come from a field or a function that returns it. It comes from parsing the text of diagnostic messages. `av_log_set_callback` is public; the wording and the level of a message are declared in no header. They are present in the installed binary (`strings` of `libavformat.63.dylib`: `Updating control URI to %s`, `WARNING: Path %s differs from expected %s`, `Host %s differs from expected %s`). Whether a value obtained this way counts as "read through the public interface" (addendum 5.2) is the open reading.

**Can the listener refuse at that instant: yes in the probe, 3 of 3**, by the one public means found: the interrupt callback (`avformat.h:1586`) answers 1 once the path differs. `avformat_open_input` then returned -1094995529 ("Invalid data found when processing input") 0.0 to 0.1 ms later; 0 packets read; the pusher had read `200` to `OPTIONS` and **no answer to `ANNOUNCE`** (connection closed, pusher rc 183). **This is not an RTSP error status.** No public means to answer a 4xx was found in `avformat.h` or `avio.h`. With the right path the same probe accepted the push 3 of 3 (25 packets).

## 2. Why it matters

Branch B of addendum 5.3 needs "the value compared is the one the client announced, read before `ingest_connected` and before a byte reaches a file" (`verification/04_security_addendum.md`, 5.1). Branch C is taken when it cannot be read. AD-01 (5) defines READABLE so that a probe printing the listener's own address does not count. RC-1 / S13-05 (`verification/02_security.md:155`) accept the comparison in the worker or the worker pulling, not a push accepted on any path.

## 3. Header lines (installed public headers of the library the worker links)

`make -C apps/capture-worker versions` (prints only): `63.1.102 / 63.1.102 / 12.1.102 / 7.1.102 / 61.1.102`, libdir `/opt/homebrew/Cellar/ffmpeg/9.0.2/lib`. Headers under `/opt/homebrew/Cellar/ffmpeg/9.0.2/include`; `libavformat/` holds `avformat.h`, `avio.h`, `version.h`, `version_major.h` only (no RTSP header).

| File:line | Text | Bearing |
|---|---|---|
| `libavformat/avformat.h:1421-1422`, `:1432` | "input or output URL ... demuxing: set by avformat_open_input()"; `char *url;` | the only address field; observed unchanged |
| `avformat.h:1337-1344` | "Format private data. This is an AVOptions-enabled struct if and only if iformat/oformat.priv_class is not NULL"; `void *priv_data;` | the RTSP state is behind it; reachable only as options |
| `avformat.h:1580-1586` | "Custom interrupt callbacks for the I/O layer. demuxing: set by the user before avformat_open_input()"; `AVIOInterruptCB interrupt_callback;` | the means used to end the open |
| `avformat.h:1885` | `av_format_control_message control_message_cb;` "Callback used by devices to communicate with application" | for devices; not used by the listener (not observed called; not instrumented) |
| `avformat.h:1902-1922` | "A callback for opening new IO streams ..."; `int (*io_open)(...)` | 0 calls |
| `avformat.h:1688`, `:1695` | `int event_flags;` `AVFMT_EVENT_FLAG_METADATA_UPDATED` | stayed 0 |
| `avformat.h:2997` | `void av_url_split(...)` | used to cut the path out of the address |
| `libavutil/log.h:337` | `void av_log_set_callback(void (*callback)(void*, int, const char*, va_list));` with the note `:329-330` "The callback must be thread safe" | the means that shows the path; process-wide, one callback for all contexts |
| `log.h:210, 216, 221, 236` | `AV_LOG_ERROR 16`, `AV_LOG_WARNING 24`, `AV_LOG_INFO 32`, `AV_LOG_TRACE 56` | levels of the messages above |
| `libavutil/opt.h:586`, `:594`, `:604` | `av_opt_next`, `av_opt_child_next`, `AV_OPT_SEARCH_CHILDREN` | the option walk |

Read of the headers for another route (a function returning the peer's request, a per-request callback, a listen/accept pair for RTSP): none found. `avio.h:809` `avio_accept` / `avio_handshake` exist for I/O contexts; a listening RTSP input has no I/O context (`pb=NULL` at every instant in the probe).

The worker today: its callback returns for every level above 16 (`apps/capture-worker/src/ingest.c:152`), so it sees none of the three messages; it already ends an open from inside the callback for another reason (`ingest.c:140-148`). In the 24 worker runs of section 6 the worker's log and standard output held 0 occurrences of any path text.

## 4. The probe

Source: `.cache/e11b-probe/probe.c` (158 lines, sha256 `6ed2cbda...bf1b`, git-ignored; printed in full in the appendix). It opens the listener as the worker does (`ingest.c:481-490`: `rtsp_flags=listen`, `listen_timeout`, `protocol_whitelist=tcp`, an interrupt callback), records every log message of every level, and prints the context's address, options, metadata at three instants: after the open, after `avformat_find_stream_info`, after 25 packets.

```
# compile (the worker Makefile's CC, CFLAGS and LDLIBS), from .cache/e11b-probe/
clang -std=c11 -O2 -g -Wall -Wextra -Werror $(pkg-config --cflags libavformat libavcodec libavfilter libswresample libavutil) \
  -o probe probe.c $(pkg-config --libs libavformat libavcodec libavfilter libswresample libavutil) -lm -lpthread
otool -L probe   ->  /opt/homebrew/opt/ffmpeg/lib/libavformat.63.dylib (... current version 63.1.102)

# run: repository root, command sandbox off (binds 127.0.0.1:8563, reads lsof)
M3_PORTS=8559,8561 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
  python3 apps/capture-worker/test-fixtures/e11b_announced_path.py probe      # 18 runs, about 1 min
python3 apps/capture-worker/test-fixtures/e11b_announced_path.py summary       # re-reads the results, runs nothing
```

Listener: `rtsp://127.0.0.1:8563/e11b/Hs3kP9wQ2nVb7Xc5`. Pusher: the FFmpeg command of row 6 (`e11_listener_path.py`, `ff_cmd`), 100 frames. Runs 2026-10-12 16:31:49 to 16:32:33 UTC.

### 4.1 Output, wrong path (last character), three runs

`observe_wrong_last_character_r1` (`.cache/e11b-probe/probe-runs/observe_wrong_last_character_r1/probe.out`), the lines that bear on the question, in order (`class=AVFormatContext` cut from each line; the `200` with `CSeq: 2` is the answer to `ANNOUNCE`, sent after the read):

```
PROBE libavformat=Lavf63.1.102 (63.1.102) mode=observe listener_url=rtsp://127.0.0.1:8563/e11b/Hs3kP9wQ2nVb7Xc5 listener_path=/e11b/Hs3kP9wQ2nVb7Xc5 needle=Hs3kP9wQ2nVb7Xc2
LOG t=    87.1ms phase=avformat_open_input level=56 ctx=listener text=Parsing[60]: OPTIONS rtsp://127.0.0.1:8563/e11b/Hs3kP9wQ2nVb7Xc2 RTSP/1.0
LOG t=    87.2ms phase=avformat_open_input level=24 ctx=listener text=WARNING: Path /e11b/Hs3kP9wQ2nVb7Xc2 differs from expected /e11b/Hs3kP9wQ2nVb7Xc5
LOG t=    87.2ms phase=avformat_open_input level=56 ctx=listener text=Sending response:|RTSP/1.0 200 OK||CSeq: 1||Server: Lavf63.1.102||Public: ANNOUNCE, PAUSE, SETUP, TEARDOWN, RECORD
LOG t=    88.0ms phase=avformat_open_input level=56 ctx=listener text=Parsing[61]: ANNOUNCE rtsp://127.0.0.1:8563/e11b/Hs3kP9wQ2nVb7Xc2 RTSP/1.0
READ_LINE t=    88.0ms phase=avformat_open_input announce_request_uri=rtsp://127.0.0.1:8563/e11b/Hs3kP9wQ2nVb7Xc2 announce_request_path=/e11b/Hs3kP9wQ2nVb7Xc2 equals_listener_path=0
LOG t=    88.0ms phase=avformat_open_input level=24 ctx=listener text=WARNING: Path /e11b/Hs3kP9wQ2nVb7Xc2 differs from expected /e11b/Hs3kP9wQ2nVb7Xc5
LOG t=    88.0ms phase=avformat_open_input level=32 ctx=listener text=Updating control URI to rtsp://127.0.0.1:8563/e11b/Hs3kP9wQ2nVb7Xc2
READ t=    88.0ms phase=avformat_open_input announced_uri=rtsp://127.0.0.1:8563/e11b/Hs3kP9wQ2nVb7Xc2 announced_path=/e11b/Hs3kP9wQ2nVb7Xc2
LOG t=    88.2ms phase=avformat_open_input level=56 ctx=listener text=Sending response:|RTSP/1.0 200 OK||CSeq: 2||Server: Lavf63.1.102
OPEN  t=    89.8ms avformat_open_input=0 (ok) log_messages=43 update_messages=1 differs_messages=2 io_open_calls=0 interrupt_refusals=0
FIELD t=    89.8ms phase=after_open AVFormatContext.url=rtsp://127.0.0.1:8563/e11b/Hs3kP9wQ2nVb7Xc5 equals_listener_url=1
SCAN  phase=after_open needle=Hs3kP9wQ2nVb7Xc2 options_read=61 options_holding_needle=0 metadata_entries=1 metadata_holding_needle=0 url_holds_needle=0
BEFORE_PROBE t=    89.8ms request_line_path=/e11b/Hs3kP9wQ2nVb7Xc2 request_line_equal=0 | update_message: read_from_log=yes announced_path=/e11b/Hs3kP9wQ2nVb7Xc2 read_in_phase=avformat_open_input listener_path=/e11b/Hs3kP9wQ2nVb7Xc5 equal=0
PROBED t=   712.1ms avformat_find_stream_info=0
FIELD t=   712.1ms phase=after_probe AVFormatContext.url=rtsp://127.0.0.1:8563/e11b/Hs3kP9wQ2nVb7Xc5 equals_listener_url=1
SCAN  phase=after_probe needle=Hs3kP9wQ2nVb7Xc2 options_read=61 options_holding_needle=0 metadata_entries=1 metadata_holding_needle=0 url_holds_needle=0
FIELD t=   712.1ms phase=after_read AVFormatContext.url=rtsp://127.0.0.1:8563/e11b/Hs3kP9wQ2nVb7Xc5 equals_listener_url=1
SCAN  phase=after_read needle=Hs3kP9wQ2nVb7Xc2 options_read=61 options_holding_needle=0 metadata_entries=1 metadata_holding_needle=0 url_holds_needle=0
RESULT mode=observe open=ok read_during_open=yes announced_path=/e11b/Hs3kP9wQ2nVb7Xc2 listener_path=/e11b/Hs3kP9wQ2nVb7Xc5 equal=0 packets=25 request_line_path=/e11b/Hs3kP9wQ2nVb7Xc2 request_line_equal=0 log_messages=407 io_open_calls=0
```

| Run | Pushed (on the wire) | Printed from `Updating control URI` | Printed from the `ANNOUNCE` line | Equals pushed | Differs from listener | Read at / open returned / probe ended (ms) | Outside the log | Pusher statuses, rc |
|---|---|---|---|---|---|---|--:|---|
| observe wrong r1 | `/e11b/Hs3kP9wQ2nVb7Xc2` | `/e11b/Hs3kP9wQ2nVb7Xc2` | the same | yes | yes | 88.0 / 89.8 / 712.1 | 0 | 200 200 200 200, 224 |
| observe wrong r2 | the same | the same | the same | yes | yes | 86.8 / 88.5 / 704.8 | 0 | 200 x4, 224 |
| observe wrong r3 | the same | the same | the same | yes | yes | 70.6 / 72.0 / 697.6 | 0 | 200 x4, 224 |

Pusher rc 224 in every accepted probe run: the probe closes after 25 packets and the pusher's write fails; it is the probe's own end, not a refusal.

### 4.2 Output, right path, three runs

`observe_right_r1`:

```
LOG t=    70.3ms phase=avformat_open_input level=56 ctx=listener text=Parsing[61]: ANNOUNCE rtsp://127.0.0.1:8563/e11b/Hs3kP9wQ2nVb7Xc5 RTSP/1.0
READ_LINE t=    70.3ms phase=avformat_open_input announce_request_uri=rtsp://127.0.0.1:8563/e11b/Hs3kP9wQ2nVb7Xc5 announce_request_path=/e11b/Hs3kP9wQ2nVb7Xc5 equals_listener_path=1
OPEN  t=    71.6ms avformat_open_input=0 (ok) log_messages=40 update_messages=0 differs_messages=0 io_open_calls=0 interrupt_refusals=0
RESULT mode=observe open=ok read_during_open=no announced_path=(none) listener_path=/e11b/Hs3kP9wQ2nVb7Xc5 equal=-1 packets=25 request_line_path=/e11b/Hs3kP9wQ2nVb7Xc5 request_line_equal=1 log_messages=404 io_open_calls=0
```

| Run | `Updating control URI` message | Printed from the `ANNOUNCE` line | Read at / open returned / probe ended (ms) | Pusher |
|---|---|---|---|---|
| observe right r1 | none | `/e11b/Hs3kP9wQ2nVb7Xc5` (equal) | 70.3 / 71.6 / 689.9 | 200 x4, 224 |
| observe right r2 | none | the same | 65.1 / 66.4 / 688.4 | 200 x4, 224 |
| observe right r3 | none | the same | 79.5 / 81.1 / 705.0 | 200 x4, 224 |

So for a right-path push the level-32 and level-24 messages give nothing (their absence is the signal); only the level-56 echo of the request line gives a positive value.

### 4.3 The six other near misses (one run each, supplementary)

| Near miss | Pushed | Printed (both sources) | Equals pushed | Open | Packets |
|---|---|---|---|---|--:|
| strict prefix | `/e11b/Hs3kP9wQ` | `/e11b/Hs3kP9wQ` | yes | ok | 25 |
| one more component | `/e11b/Hs3kP9wQ2nVb7Xc5/x` | the same | yes | ok | 25 |
| letter case | `/e11b/hs3kp9wq2nvb7xc5` | the same | yes | ok | 25 |
| trailing slash | `/e11b/Hs3kP9wQ2nVb7Xc5/` | the same | yes | failed at `SETUP` (level 16 `Unable to find requested track`, as in row 6) | 0 |
| query string | `/e11b/Hs3kP9wQ2nVb7Xc5?x=1` | the same, query included | yes | ok | 25 |
| percent-encoded | `/e11b/%48s3kP9wQ2nVb7Xc5` | the same, **not decoded** | yes | ok | 25 |

The value is the text of the request as sent: nothing is normalised (case, slash, query and percent form arrive as written). The address printed is the whole one (`rtsp://127.0.0.1:8563/...`); the probe cuts the path with `av_url_split`.

### 4.4 Refusing at that instant (mode `refuse`, three runs each)

`refuse_wrong_last_character_r1`:

```
READ_LINE t=    86.1ms phase=avformat_open_input announce_request_uri=rtsp://127.0.0.1:8563/e11b/Hs3kP9wQ2nVb7Xc2 announce_request_path=/e11b/Hs3kP9wQ2nVb7Xc2 equals_listener_path=0
REFUSE t=    86.1ms decided: path of the ANNOUNCE request differs from the listener's
READ t=    86.1ms phase=avformat_open_input announced_uri=rtsp://127.0.0.1:8563/e11b/Hs3kP9wQ2nVb7Xc2 announced_path=/e11b/Hs3kP9wQ2nVb7Xc2
REFUSE t=    86.1ms decided: announced path differs from the listener's
OPEN  t=    86.2ms avformat_open_input=-1094995529 (Invalid data found when processing input) log_messages=9 update_messages=1 differs_messages=2 io_open_calls=0 interrupt_refusals=1
RESULT mode=refuse open=failed read_during_open=yes announced_path=/e11b/Hs3kP9wQ2nVb7Xc2 listener_path=/e11b/Hs3kP9wQ2nVb7Xc5 equal=0 packets=0 request_line_path=/e11b/Hs3kP9wQ2nVb7Xc2 request_line_equal=0
```

| Run | Pushed | Decided at / open returned (ms) | Open | Packets | Pusher: statuses, rc |
|---|---|---|---|--:|---|
| refuse wrong r1 | `/e11b/Hs3kP9wQ2nVb7Xc2` | 86.1 / 86.2 | failed | 0 | `OPTIONS` 200, `ANNOUNCE` no answer; 183 |
| refuse wrong r2 | the same | 86.7 / 86.8 | failed | 0 | the same |
| refuse wrong r3 | the same | 85.4 / 85.5 | failed | 0 | the same |
| refuse right r1 to r3 | `/e11b/Hs3kP9wQ2nVb7Xc5` | no decision | ok | 25 each | 200 x4, 224 |

Every probe process ended with rc 0; no listener on 8563 after any of the 18 runs (`listener_left` empty 18 of 18).

## 5. What the probe does not show

- It is the probe, not the worker: that the worker can do the same inside its ingest thread (two listeners, a process-wide callback, its thread-local `tls_opening`) is not built and not shown. In the probe the first argument of the callback was the listener's own context for every message used (`ctx=listener`).
- The refusal seen is a closed connection without a status. By AD-01 (3) REFUSED means an RTSP error status; a push ended this way would be INCONCLUSIVE by that letter. Rows 48 and 142 (and AD-01 (7)) word their check with "no `ingest_connected`, 0 bytes".
- After the refusal the probe exits. Whether a listener that refused can listen again in the same session was not tested (row 6: the worker's listener takes one connection).
- The comparison is of text. A client that writes the host differently (`localhost`), or the right path in another form, is a different string; only the seven near misses were pushed.
- A client that sends `ANNOUNCE` more than once, or media without `ANNOUNCE`; only FFmpeg 9.0.2 as the client.
- **Linux and the production build**: all of this is this Mac's Homebrew libavformat 63.1.102. The message texts and levels on the pinned library in the container (row 141) and on the host (`9A/H-01`) are unproven.
- RC-2 side fact (HX-3): the level-24 message names the listener's own path, the future secret, whenever any request carries another path. It is below the worker's threshold today; the only level-16 message seen (`Unable to find requested track`) names no path.

## 6. The side observation of row 6: which client ends the worker

Subject: the release worker of row 6, unchanged (`apps/capture-worker/build/capture-worker`, 122144 bytes, Oct 10 10:46, sha256 `03795324e8a3910e74fa10aa7fa360c79ec056edbde5c481dd3cc9df7892f1dc` before and after). One worker session per run as in row 6 (two cameras on 8559 and 8561, two FIFO microphones, listen timeout 12 s); a raw client on the listener under test (alternating: runs 1 and 3 port 8559, run 2 port 8561); the FFmpeg control push to the right path of the other listener, started in the same moment. Wrong path = the last-character near miss.

```
M3_PORTS=8559,8561 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock \
  python3 apps/capture-worker/test-fixtures/e11b_announced_path.py exit       # 24 runs, about 5 min
```

Runs 2026-10-12 16:32:44 to 16:37:45 UTC; 1-minute load at the start of a run 4.3 to 5.1.

| Case: what the client does | Path | Statuses read | Worker exit code (3 runs) | When | Frame to the Core | Other camera of the session |
|---|---|---|---|---|---|---|
| A. `OPTIONS ANNOUNCE SETUP RECORD`, description **with** parameter sets, no media, **closes** 0.3 s later | wrong | 200 200 200 200 | **70, 70, 70** | 0.05 to 0.11 s after the close (2.00 to 2.06 s after START) | `CRASH` `OUTPUT_SETUP_FAILED` `exitCode 70` | cut short: 23116 bytes, 1 fragment, 0 video packets; its pusher rc 224 |
| A | **right** | 200 x4 | **70, 70, 70** | 0.05 to 0.11 s after the close | the same | the same (23116, 23116, 22848 bytes) |
| B. the same, connection **held open 16 s** without a byte, then closed | wrong | 200 x4 | **70, 70, 70** | not while the connection was open; 0.05 to 0.06 s after the close (17.68 to 17.72 s) | `CAPTURE_FAULT CAMERA_STREAM_ENDED` for the other camera (its push had ended), then `CRASH` as above | complete: 911180 bytes, 8 fragments, 175 frames, pusher rc 0 |
| B | **right** | 200 x4 | **70, 70, 70** | 0.05 to 0.10 s after the close | the same | complete: 910916 / 910916 / 911180 bytes, 175 frames |
| C. as A, description **without** `sprop-parameter-sets` | wrong | 200 x4 | 0, 0, 0 (STOP acknowledged) | - | `CAPTURE_FAULT CAMERA_NOT_CONNECTED` for that camera | complete, 175 frames |
| C | right | 200 x4 | 0, 0, 0 | - | the same | complete, 175 frames |
| D. `OPTIONS ANNOUNCE SETUP`, then closes (no `RECORD`) | wrong | 200 200 200 | 0, 0, 0 | - | `CAPTURE_FAULT CAMERA_NOT_CONNECTED` | complete, 175 frames |
| D | right | 200 200 200 | 0, 0, 0 | - | the same | complete, 175 frames |

**In one sentence: a client that completes the handshake through `RECORD` with a description that carries the H.264 parameter sets, sends no media and then closes the connection ends the whole worker with exit code 70, 12 of 12, with the right path (6 of 6) exactly as with a wrong path (6 of 6); the exit comes at the close, not while the connection is held (16 s tested).** Without the parameter sets in the description, or without `RECORD`, the worker stays up and reports a fault for that one camera (12 of 12). In no run did the port under test reach `ingest_connected`; its file is 0 bytes in 24 of 24.

The worker's last log lines, case A (`exit_record_close_wrong_r1/worker.jsonl`; the right-path run has the same lines):

```
warn  capture-worker.libav    LIBAV_MESSAGE        av_level 16  text "dimensions not set "
error capture-worker.ingest1  OUTPUT_SETUP_FAILED  av_error "Invalid argument"  av_code -22
info  capture-worker.filter   mic_summary mic 2 ... / audio_finished samples_in 86400 encoder_packets 83
info  capture-worker.main     worker_stopping  why "stop"
info  capture-worker.ingest2  ingest_connected  port 8561 codec h264 width 320 height 240      (the control, logged while stopping)
info  capture-worker.main     camera_summary cam 1  video_packets 0  bytes 0
info  capture-worker.sink     first_durable_fragment cam 2 bytes 23116 sync F_FULLFSYNC
info  capture-worker.main     camera_summary cam 2  video_packets 0  audio_packets 83  fragments 1  bytes 23116
error capture-worker.main     worker_exit  rc 70  code "OUTPUT_SETUP_FAILED"
```

Case B (`exit_record_hold_wrong_r1`), last lines: `INGEST_ENDED "End of file"` for the control's ingest (its push was over), then `LIBAV_MESSAGE "dimensions not set"`, `OUTPUT_SETUP_FAILED "Invalid argument" -22`, `mic_summary` x2, `audio_finished`, `worker_stopping why "stop"`, `camera_summary cam 1 video_packets 0 bytes 0`, `camera_summary cam 2 video_packets 175 fragments 8 durable_fragments 8 bytes 911180`, `worker_exit rc 70 code "OUTPUT_SETUP_FAILED"`.

Cases C and D, the lines that differ: C `warn ingest<n> INGEST_NO_EXTRADATA "Invalid data found when processing input"`; D `warn ingest<n> INGEST_OPEN_FAILED "End of file"`; both end `worker_exit rc 0 code ""` after `stop_received reason "STOPPED"`.

Where the two outcomes part in the source, as read (not changed): `apps/capture-worker/src/ingest.c:504` a failed open is `ingest_over` (a fault of that camera); `:512` no parameter sets is `ingest_over`; `:515` / `:524` a failed output setup is `fatal(...)`, which stops the worker (`src/capture_worker.c:63-71`) and sends `CRASH` (`:495`).

Not tested: a hold longer than 16 s; STOP sent while the connection is held; a client that sends some bytes that are not media, or media without a keyframe; a second such client in one session; any client but the raw one; Linux. Leftovers: 0 processes and 0 listeners in 24 of 24 runs.

## 7. Facts row 8 needs, and whether each is established

| Fact | Established | Where |
|---|---|---|
| O-1 ACCEPTED in at least one run (so E-11b applies) | Yes, 18 of 21 | row 6 |
| For a wrong-path push the probe prints a value equal to the wrong path and different from the listener's address (AD-01 (5)) | **Yes by the letter, 12 of 12**, all seven near misses | 4.1, 4.3, 4.4 |
| The value changes with the client (not the listener's own address, F-5) | Yes; `AVFormatContext.url` never changed and is not the source | 1, 4.1 |
| The value is available before the stream is probed and before a packet is read | Yes in the probe: inside `avformat_open_input`, before the answer to `ANNOUNCE`; 600 ms or more before the probe ends | 4.1, 4.2 |
| The source is a function or field of the public interface | **No.** It is the text of log messages handed to the public callback | 1, 3 |
| Whether that source counts as READABLE for the table of 9.1 | **Open: a reading for the controller / row 8** | 1 |
| The listener can end the push at that instant with no packet read | Yes in the probe, 3 of 3, as a closed connection | 4.4 |
| The listener can answer an RTSP error status | Not established; no public means found | 4.4, 5 |
| A right-path push is still accepted by a comparing listener | Yes in the probe, 3 of 3 | 4.4 |
| The same on the pinned Linux build | Not established (row 141, `9A/H-01`) | 5 |
| The same inside the worker | Not built here (no worker source edited) | 5 |
| Which client ends the whole worker, and that it does not depend on the path | Yes, 12 of 12 / 12 of 12 | 6 |

## 8. Rules kept, with evidence

| Rule | Evidence |
|---|---|
| Worker not rebuilt, no source edited | `shasum -a 256 apps/capture-worker/build/capture-worker` after the runs: `03795324...f1dc`, `122144 Oct 10 10:46`, as in row 6. The only `make` run: `versions` |
| No tracked file modified | `git status --short apps/capture-worker`: `?? test-fixtures/e11_listener_path.py` (row 6), `?? test-fixtures/e11b_announced_path.py` (new, this row). Docs: this record, `row_007.md`, one line in `file_claims.md` |
| Heavy-host lock | the three invocations that bound a port (probe smoke, probe series, exit series) ran under `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock` from the repository root |
| Ports 8559, 8561, 8563 on loopback only; no listener left | `listener_before_push` = `127.0.0.1:8563 (LISTEN)` in 18 of 18; `lsof -nP -iTCP -sTCP:LISTEN` after each series: no row for 8554-8564; 0 own processes alive |
| Only own processes stopped | the script ends the process groups it started (`m3worker.killall` over its own list) |
| Output outside the tracked tree | `.cache/e11b-probe/` (git-ignored by `.gitignore:47`), 24 MB |
| No commit, no stage | none made |

## 9. Files

- `apps/capture-worker/test-fixtures/e11b_announced_path.py` (new, untracked, test code: the run script of both parts; imports `e11_listener_path.py` and `test/m3worker.py` unchanged)
- `docs/2026-10-12_input_av_core_adapter_plan/test/007_e11b_announced_path.md` (this record)
- `docs/2026-10-12_input_av_core_adapter_plan/delegation_progress/row_007.md`
- one line appended to `delegation_progress/file_claims.md`
- Under `.cache/e11b-probe/` (git-ignored): `probe.c`, `probe`, `run_probe.out`, `run_exit.out`, `summary.txt`, `probe-runs/<run>/{probe.out,push.log,result.json}` (18 runs), `worker/runs/<run>/{result.json,worker.jsonl,control.log,...}` (24 runs)

## 10. Driver decisions, for the controller to confirm

1. DRIVER DECISION: the probe lives under `.cache/e11b-probe/` as the delegation says (the execution profile names `test-fixtures/`); its source is kept in this record's appendix because `.cache` is not tracked. The run script is a new file under `test-fixtures/`, declared in `file_claims.md`.
2. DRIVER DECISION: the answer is reported as PARTLY with the letter of AD-01 (5) stated beside it, instead of the single word READABLE, because the source is message text. The word for the table of 9.1 is left to row 8 / the controller.
3. DRIVER DECISION: a `refuse` mode and a second source (the level-56 request line) were added to the probe, and the six other near misses were run once each; cases B, C and D were added to the worker series. They add runs, no product change.
4. The first smoke run of the probe series (one run per case, the earlier probe without the request-line source) was overwritten by the series; its results agreed.

## Appendix: `probe.c`

```c
/* E-11b probe (blueprint row 7, AD-01 (5)). Test code, git-ignored, never part of the worker.
 * An RTSP listener opened the way the worker's ingest opens it (apps/capture-worker/src/ingest.c:481-490:
 * rtsp_flags=listen, listen_timeout, protocol_whitelist=tcp, an interrupt callback), through the PUBLIC
 * interface of libavformat / libavutil only. It prints, with the instant, every place of that interface in
 * which the address the CLIENT announced could show up:
 *   (1) the log callback (av_log_set_callback, libavutil/log.h): every message, every level
 *   (2) AVFormatContext.url, .metadata, .event_flags, stream metadata   (avformat.h)
 *   (3) every AVOption of the context and of its children              (libavutil/opt.h)
 *   (4) the io_open callback of the context                            (avformat.h)
 * at three instants: inside avformat_open_input, after it returned (before the stream is probed), and
 * after avformat_find_stream_info and the first packets.
 *   probe <port> <listener-path> observe|refuse [listen_timeout_s]
 * refuse: when a value read during the open differs from the listener's own path, the interrupt callback
 * answers 1 from then on (the only public way to end a blocking open). */
#include <libavformat/avformat.h>
#include <libavutil/opt.h>
#include <libavutil/log.h>
#include <libavutil/time.h>
#include <libavutil/avstring.h>
#include <stdio.h>
#include <string.h>

static const char *phase = "before_open";
static int64_t t0;
static AVFormatContext *ctx;
static char listener_url[600], listener_path[512], seen_uri[1024], seen_path[512];
static int n_log, n_update, n_differs, n_io_open, refuse_mode, refuse_now, n_interrupt_refusals;
static const char *seen_phase = "";
static char line_uri[1024], line_path[512];      /* from the request line of ANNOUNCE as the library echoes it (level trace) */
static int n_line;

static double ms(void) { return (av_gettime_relative() - t0) / 1000.0; }

static void log_cb(void *avcl, int level, const char *fmt, va_list vl) {
    char m[1500];
    vsnprintf(m, sizeof m, fmt, vl);
    size_t n = strlen(m);
    while (n && (m[n - 1] == '\n' || m[n - 1] == '\r')) m[--n] = 0;
    for (char *p = m; *p; p++) if (*p == '\n' || *p == '\r') *p = '|';
    n_log++;
    const char *cls = avcl && *(AVClass **)avcl ? (*(AVClass **)avcl)->class_name : "-";
    printf("LOG t=%8.1fms phase=%-17s level=%2d ctx=%s class=%s text=%s\n", ms(), phase, level, avcl == (void *)ctx ? "listener" : "other", cls, m);
    const char *u = "Updating control URI to ";
    if (avcl == (void *)ctx && !strncmp(m, u, strlen(u))) {
        char host[128], auth[128]; int port;
        n_update++;
        av_strlcpy(seen_uri, m + strlen(u), sizeof seen_uri);
        av_url_split(NULL, 0, auth, sizeof auth, host, sizeof host, &port, seen_path, sizeof seen_path, seen_uri);
        seen_phase = phase;
        printf("READ t=%8.1fms phase=%s announced_uri=%s announced_path=%s\n", ms(), phase, seen_uri, seen_path);
        if (refuse_mode && strcmp(seen_path, listener_path)) { refuse_now = 1; printf("REFUSE t=%8.1fms decided: announced path differs from the listener's\n", ms()); }
    }
    /* The request line itself, which the library hands to the callback at level trace for EVERY request, also
     * when the address equals the listener's: "Parsing[<n>]: ANNOUNCE <uri> RTSP/1.0". */
    const char *a = avcl == (void *)ctx && !strncmp(m, "Parsing[", 8) ? strstr(m, "]: ANNOUNCE ") : NULL;
    if (a) {
        char host[128], auth[128]; int port;
        n_line++;
        av_strlcpy(line_uri, a + 12, sizeof line_uri);
        char *sp = strchr(line_uri, ' ');
        if (sp) *sp = 0;
        av_url_split(NULL, 0, auth, sizeof auth, host, sizeof host, &port, line_path, sizeof line_path, line_uri);
        printf("READ_LINE t=%8.1fms phase=%s announce_request_uri=%s announce_request_path=%s equals_listener_path=%d\n", ms(), phase, line_uri, line_path, !strcmp(line_path, listener_path));
        if (refuse_mode && strcmp(line_path, listener_path)) { refuse_now = 1; printf("REFUSE t=%8.1fms decided: path of the ANNOUNCE request differs from the listener's\n", ms()); }
    }
    if (avcl == (void *)ctx && strstr(m, "differs from expected")) n_differs++;
    fflush(stdout);
}

static int interrupt_cb(void *opaque) { (void)opaque; if (refuse_now) { n_interrupt_refusals++; return 1; } return 0; }

static int (*default_io_open)(AVFormatContext *, AVIOContext **, const char *, int, AVDictionary **);
static int io_open_cb(AVFormatContext *s, AVIOContext **pb, const char *url, int flags, AVDictionary **o) {
    n_io_open++;
    printf("IO_OPEN t=%8.1fms phase=%s url=%s flags=%d\n", ms(), phase, url, flags);
    return default_io_open(s, pb, url, flags, o);
}

/* Every option of obj and of its children whose value is text; counts those that hold `needle`. */
static void dump_opts(void *obj, int depth, const char *needle, int *n_opts, int *n_hit) {
    const AVOption *o = NULL;
    while ((o = av_opt_next(obj, o))) {
        if (o->type == AV_OPT_TYPE_CONST) continue;
        uint8_t *v = NULL;
        if (av_opt_get(obj, o->name, 0, &v) < 0 || !v) continue;
        (*n_opts)++;
        int hit = needle && *needle && strstr((char *)v, needle) != NULL && !strstr((char *)v, listener_path);
        if (hit) (*n_hit)++;
        if (hit || strstr((char *)v, "rtsp") || strchr((char *)v, '/'))
            printf("OPT   phase=%s depth=%d class=%s name=%s value=%s%s\n", phase, depth, (*(AVClass **)obj)->class_name, o->name, v, hit ? "   <== holds the client's path" : "");
        av_free(v);
    }
    void *child = NULL;
    while ((child = av_opt_child_next(obj, child))) dump_opts(child, depth + 1, needle, n_opts, n_hit);
}

/* What the context itself shows at this instant. `needle` = the path component a wrong-path client sent (argv). */
static void dump_ctx(const char *needle) {
    int n_opts = 0, n_hit = 0, n_meta = 0, meta_hit = 0;
    printf("FIELD t=%8.1fms phase=%s AVFormatContext.url=%s equals_listener_url=%d\n", ms(), phase, ctx->url ? ctx->url : "(null)", ctx->url && !strcmp(ctx->url, listener_url));
    printf("FIELD phase=%s event_flags=%d nb_streams=%u pb=%s priv_data=%s\n", phase, ctx->event_flags, ctx->nb_streams, ctx->pb ? "set" : "NULL", ctx->priv_data ? "set (opaque)" : "NULL");
    const AVDictionaryEntry *e = NULL;
    while ((e = av_dict_iterate(ctx->metadata, e))) { n_meta++; if (needle && *needle && strstr(e->value, needle) && !strstr(e->value, listener_path)) meta_hit++; printf("META  phase=%s context %s=%s\n", phase, e->key, e->value); }
    for (unsigned i = 0; i < ctx->nb_streams; i++) {
        e = NULL;
        while ((e = av_dict_iterate(ctx->streams[i]->metadata, e))) { n_meta++; if (needle && *needle && strstr(e->value, needle) && !strstr(e->value, listener_path)) meta_hit++; printf("META  phase=%s stream%u %s=%s\n", phase, i, e->key, e->value); }
    }
    dump_opts(ctx, 0, needle, &n_opts, &n_hit);
    printf("SCAN  phase=%s needle=%s options_read=%d options_holding_needle=%d metadata_entries=%d metadata_holding_needle=%d url_holds_needle=%d\n",
           phase, needle && *needle ? needle : "(none)", n_opts, n_hit, n_meta, meta_hit, needle && *needle && ctx->url && strstr(ctx->url, needle) && !strstr(ctx->url, listener_path) ? 1 : 0);
    fflush(stdout);
}

int main(int argc, char **argv) {
    if (argc < 4) { fprintf(stderr, "usage: probe <port> <listener-path> observe|refuse [listen_timeout_s] [needle]\n"); return 2; }
    int port = atoi(argv[1]), timeout_s = argc > 4 ? atoi(argv[4]) : 12;
    const char *needle = argc > 5 ? argv[5] : "";
    refuse_mode = !strcmp(argv[3], "refuse");
    snprintf(listener_url, sizeof listener_url, "rtsp://127.0.0.1:%d/%s", port, argv[2]);
    snprintf(listener_path, sizeof listener_path, "/%s", argv[2]);
    printf("PROBE libavformat=%s (%u.%u.%u) mode=%s listener_url=%s listener_path=%s needle=%s\n", LIBAVFORMAT_IDENT, avformat_version() >> 16, (avformat_version() >> 8) & 255, avformat_version() & 255,
           argv[3], listener_url, listener_path, *needle ? needle : "(none)");
    av_log_set_callback(log_cb);
    AVDictionary *o = NULL;
    av_dict_set(&o, "rtsp_flags", "listen", 0);
    av_dict_set_int(&o, "listen_timeout", timeout_s, 0);
    av_dict_set(&o, "protocol_whitelist", "tcp", 0);
    ctx = avformat_alloc_context();
    ctx->interrupt_callback.callback = interrupt_cb;
    default_io_open = ctx->io_open;
    ctx->io_open = io_open_cb;
    AVFormatContext *mine = ctx;                 /* avformat_open_input frees the context and clears the pointer on failure */
    t0 = av_gettime_relative();
    phase = "avformat_open_input";
    int r = avformat_open_input(&mine, listener_url, NULL, &o);
    phase = "after_open";
    av_dict_free(&o);
    printf("OPEN  t=%8.1fms avformat_open_input=%d (%s) log_messages=%d update_messages=%d differs_messages=%d io_open_calls=%d interrupt_refusals=%d\n",
           ms(), r, r < 0 ? av_err2str(r) : "ok", n_log, n_update, n_differs, n_io_open, n_interrupt_refusals);
    if (r < 0) {
        ctx = NULL;
        printf("RESULT mode=%s open=failed read_during_open=%s announced_path=%s listener_path=%s equal=%d packets=0 request_line_path=%s request_line_equal=%d\n", argv[3], n_update ? "yes" : "no", n_update ? seen_path : "(none)", listener_path, n_update ? !strcmp(seen_path, listener_path) : -1,
               n_line ? line_path : "(none)", n_line ? !strcmp(line_path, listener_path) : -1);
        return 0;
    }
    dump_ctx(needle);                             /* the instant a listener would have to decide: opened, nothing probed yet */
    printf("BEFORE_PROBE t=%8.1fms request_line_path=%s request_line_equal=%d | update_message: read_from_log=%s announced_path=%s read_in_phase=%s listener_path=%s equal=%d\n", ms(), n_line ? line_path : "(none)", n_line ? !strcmp(line_path, listener_path) : -1, n_update ? "yes" : "no", n_update ? seen_path : "(none)", n_update ? seen_phase : "-", listener_path,
           n_update ? !strcmp(seen_path, listener_path) : -1);
    phase = "find_stream_info";
    r = avformat_find_stream_info(ctx, NULL);
    printf("PROBED t=%8.1fms avformat_find_stream_info=%d\n", ms(), r);
    phase = "after_probe";
    dump_ctx(needle);
    phase = "read";
    AVPacket *p = av_packet_alloc();
    int packets = 0;
    while (packets < 25 && av_read_frame(ctx, p) >= 0) { packets++; av_packet_unref(p); }
    av_packet_free(&p);
    phase = "after_read";
    dump_ctx(needle);
    printf("RESULT mode=%s open=ok read_during_open=%s announced_path=%s listener_path=%s equal=%d packets=%d request_line_path=%s request_line_equal=%d log_messages=%d io_open_calls=%d\n", argv[3], n_update ? "yes" : "no", n_update ? seen_path : "(none)", listener_path,
           n_update ? !strcmp(seen_path, listener_path) : -1, packets, n_line ? line_path : "(none)", n_line ? !strcmp(line_path, listener_path) : -1, n_log, n_io_open);
    phase = "close";
    avformat_close_input(&ctx);
    return 0;
}
```
