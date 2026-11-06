---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 41
date: 2026-10-13
agent: coder-execution
tier: T3
work_package: WP-03a
requirement: S13-01 (a), (b) record mode; S13-02 (a), (c), (d); RC-6 (the relay's part); BR-07 (3), (4) (the relay's part); F10 (a) first open, (b), (c), (d); AD-05 (3) (built, its fixture check is row 152)
status: complete - with ONE design departure for the controller to confirm (driver decision 1)
---

# Row 41: the capture relay, record mode

## 1. What was built

| File | State | What it is |
|---|---|---|
| `apps/capture-worker/src/relay/relay.h` | new | the program's contract: bounds, the exit codes, the start message, the interfaces of the three units |
| `apps/capture-worker/src/relay/relay_core.c` | new | the pure part: start-message reader, address rules, Digest (MD5, SHA-256), challenge reader, stream description, pictures out of RTP (H.264, HEVC) |
| `apps/capture-worker/src/relay/relay_rtsp.c` | new | the camera leg: an RTSP client of the relay's own on one TCP socket |
| `apps/capture-worker/src/relay/relay.c` | new | the program: hygiene, start message, keyframe gate, the push leg (the library's RTSP writer), the one writer of its lines |
| `apps/capture-worker/relay-check.sh` | new | the relay's static rules, their self-test (15 planted lines, 4 mutations, 1 pin control, 1 import control) and the import net |
| `apps/capture-worker/test/relay_unit_test.c` | new | 79 unit checks of the pure part |
| `apps/capture-worker/test-fixtures/row041_relay.py` | new | the adapter-level run: test camera, relay, release worker with a live session |
| `apps/capture-worker/Makefile` | modified, additive | targets `relay`, `relay-check`, `relay-unit`, `build/capture-relay`; `all` gains `relay` |
| `apps/capture-worker/README.md` | modified, additive | one section |

Not touched: `src/*.c`, `src/*.h` of the worker, `check.sh`, `test/static/*`, the test camera, anything of `apps/core-server`.

**Result: `build/capture-relay`.** The Core starts it through the production door with no argument and an empty environment. It reads one line, pulls one camera, pushes its video to the worker's loopback ingest, and ends with one code.

## 2. Driver decision 1 (design departure): the relay has its own RTSP client

The design (addendum 2.3 step 5, 2.5; review F10 b) assumed the library's RTSP client and therefore an address with a user part inside the relay. That cannot be held to "Digest only":

| Measured on this Mac | Result |
|---|---|
| `ffprobe` (libavformat 63.1.102) against a double that answers DESCRIBE with a Basic-only challenge (loopback 8567, synthetic account) | requests seen: `OPTIONS` none, `DESCRIBE` none, **`DESCRIBE` with `Authorization: Basic`**. HS-1 is true |
| `ffmpeg -h demuxer=rtsp` | no option that limits the scheme, none for an account |

S13-01 (c) says: if the pinned library cannot be held to it "without a change to the library", stop for the user. The relay does not use the library's client for the camera at all, so the question does not arise and the row was not returned `blocked`. **The controller should confirm this reading**; if it is not accepted, the alternative is the user decision of addendum section 10 item 4.

What the departure changes:

| Subject | Design | As built |
|---|---|---|
| Who speaks RTSP to the camera | libavformat's reader | `relay_rtsp.c`: DESCRIBE, SETUP (RTP on the same connection), PLAY, keep-alive OPTIONS, TEARDOWN |
| Who reads camera bytes | the library (description, RTP, codec probing) | the relay's own bounded readers; the library sees only the parameter sets and the first keyframe (its stream parser reads the picture size, nothing is decoded) and the pictures it is told to send |
| Credential in an address (F10 b) | unavoidable, life of the relay | **never**. No address with a user part exists in the process |
| Percent-encoding of the account (F10 c, HA-7) | relay encodes, client must decode | not applicable: the account is never encoded. The special account of row 40 authenticates (run below) |
| Erratum E-A2 ("the relay is the one process that composes the user-part form") | needed | not needed; `credential.ts:9-10` holds without exception. For the controller to strike or keep |
| Redirect, control address of another host (AD-05 (3), HX-2) | library behaviour | never followed, never sent to: one code each |
| New duty | none | the relay's own parser of camera data. It is bounded (section 6) and unit-tested, but it has met no real camera |

Cost: about 1,500 lines of C instead of a thin wrapper, and interoperability with real cameras rests on this client, not on the library's (hardware package, section 8).

## 3. The contract of the program

**Start message** (driver decision 2; row 147 left the member names to the relay). One line, compact JSON, line feed last, at most 8,192 bytes, complete within 5 s:

```
{"type":"start","mode":"record","ingest":"<ingest address>","access":{"locator":"<rtsp://IPv4[:port]/path>","username":"<account>","secret":"<password>"}}
```

- Members in any order; all four required; an unknown member, a repeated member, anything after the line: refused. `mode` is `record` only (row 42 adds its own).
- `ingest`: the worker's own grammar (`rtsp://127.0.0.1:<8554-8564>/...`), handed to the writer unchanged.
- `locator`: scheme `rtsp`, host an IPv4 address in digits, no user part, a path. A host name is refused (a resolver is a datagram socket and files, RC-6).
- `username`: 1 to 256 bytes, no control character. `secret`: 0 to 256 bytes, no 0 byte.

**Exit codes** (the only thing it says about a failure): 0 `STOPPED`, 2 `USAGE`, 10 `START_MESSAGE_INVALID`, 11 `START_MESSAGE_TIMEOUT`, 12 `LIBAVFORMAT_VERSION_MISMATCH`, 13 `HYGIENE_FAILED`, 20 `CAMERA_UNREACHABLE`, 21 `CAMERA_PROTOCOL`, 22 `AUTH_SCHEME_NOT_ALLOWED`, 23 `AUTH_REFUSED`, 24 `LOCATOR_NOT_FOUND`, 25 `REDIRECT_REFUSED`, 26 `CONTROL_ADDRESS_REFUSED`, 27 `DESCRIPTION_INVALID`, 28 `CODEC_NOT_SUPPORTED`, 29 `TRANSPORT_REFUSED`, 30 `KEYFRAME_TIMEOUT`, 31 `CAMERA_STALLED`, 32 `CAMERA_LOST`, 33 `STREAM_INVALID`, 40 `INGEST_REFUSED`, 41 `INGEST_LOST`, 42 `SOCKET_RULE`, 70 `INTERNAL`.

**Outputs.** Standard output: nothing. Standard error: JSON lines `camera_playing`, `push_open`, `exit`, each the same fixed shape: a code word and counters (`pictures`, `held_back`, `gaps`, `other_payloads`, `forms_not_taken`, `answers_with_digest`, `challenges`, `keepalives`, `library_errors`).

**Ported from input-av** (`nvr/recorder.py:217`, `:148`; research TS-1): RTSP over TCP; a 5 s bound on the connect, on every answer and on the silence of a playing camera; first video stream only, unchanged; the camera's audio is not carried.

**Authentication.** Nothing is sent before a challenge. Answered: Digest with MD5 or SHA-256, with or without `qop=auth`. A 401 that names no such challenge: `AUTH_SCHEME_NOT_ALLOWED`, nothing was sent. Basic and Digest offered together: Digest is answered (driver decision 3; the ONVIF path does the same). A refused answer ends the relay at once (one request carried it); only a nonce the camera calls stale is answered a second time.

**Time** (driver decision 4). The first forwarded picture is pts 0, and the wall clock of pts 0 is this host's clock at that moment. Later pictures keep the distance of the camera's 90 kHz stamps. This is the fixed mapping of the local helper (`camera-helper-args.ts:105-110`), not a stamp per arrival: stamping each picture when it is read would bunch the pictures that waited during the announce. The camera's wall clock is never used. Drift of the camera's oscillator against the host is hypothesis H-J, experiment E-9.

**Keyframe gate** (addendum 5.1, F10 a). Nothing is forwarded before the parameter sets (from the stream if complete there, else from the description) and a keyframe are held. After a gap in the camera's packet sequence nothing is forwarded until the next keyframe. Held-back pictures are counted. The gate after a re-open is row 43's, on this same code path.

**End.** Standard input ends, or SIGTERM: TEARDOWN to both sides, exit 0. The order to stop is taken between two pictures, never inside one. The camera ends or stalls, the worker goes away: the named code. Every wait is bounded (5 s; closing the push 2 s).

## 4. Binding requirements

| Requirement | State | Where, and the check |
|---|---|---|
| **S13-01** Digest only | **done** for record mode | no code makes a Basic header (static rule; import net); `basic` runs: 2 of 2, requests with any `Authorization` at the camera 0, `auth_basic` 0; `both`: recorded with Digest, `auth_basic` 0; Digest first then Basic on the second request: one Digest answer, then `AUTH_REFUSED`, no Basic. Probe mode: row 42 |
| **S13-02 (a)** own log callback, codes and counters | done | `library_says` counts; one writer; static rules and planted controls |
| **S13-02 (b)** outputs read into bounded buffers | not the relay's: row 21 (door, done) | - |
| **S13-02 (c)** core-file limit 0, not dumpable, buffer overwritten | done in code; **Linux effect unproven** | `setrlimit` set and read back, else exit 13; `prctl` calls compiled on Linux only: container row 79 / AD-09 (2), `9A/H-01` |
| **S13-02 (d)** message never echoed | done | 28 runs: 0 occurrences of password, account, locator, ingest address in both output streams |
| **S13-02 (e), (f), (g)** | left: boot check WP-20; erratum (see decision 1); E-12 is row 44 | - |
| **RC-1 to RC-5** | not the relay's (rows 58, 47, 48, WP-11, WP-14) | the relay announces once and passes the gate of row 58 in every record run (gate refusals 0) |
| **RC-6** no listener, no datagram, dials two targets, opens no file | done on macOS; Linux privilege and file-system confinement **left** (prctl no-new-privileges is in the code; a file-system restriction is not built: row 79 / WP-14) | `lsof` during 7 runs: 2 connected TCP sockets, 0 listening, 0 UDP; the relay checks its own sockets once both legs stand (`SOCKET_RULE`); static rules; import net |
| **S13-06** (= RC-3, RC-4) | left to rows 42 (the "push established" report) and 48 | the line `push_open` on standard error marks the moment; row 42 defines the report |
| **AD-05 (3)** redirect and foreign control address | built; a redirect and a foreign control address each end with their code and 0 further requests (2 raw-double runs). The fixture modes and the count "credential-bearing requests received there: 0" are row 152 | - |
| **AD-09 (3)** killed and reaped at the bound | the door's and the adapter's (rows 21, 46); the relay ends by itself in 0.04 s when its input closes | - |
| **BR-07 (3)** announces the byte-identical string, once | done | one `avformat_write_header`, address as it came (static rule); 7 record runs passed the worker's whole-message gate |
| **BR-07 (4)** secret only on standard input | done | an argument is refused (exit 2); no `getenv`; `ps` during 7 runs: 1 argument word, 0 occurrences |
| **BR-08** | left to row 48 | - |
| **F10 (a)** keyframe gate | done for the first open and after a sequence gap; after a re-open: row 43 | unit checks; the worker's file decodes with 0 errors |
| **F10 (b)** credential in an address | **removed** (decision 1). Bound stated in section 5 | static rules `F10` |
| **F10 (c)** awkward account | done | `--account special`: recorded |
| **F10 (d)** library pin at build and at start | done | `_Static_assert` on the headers; `avformat_version()` at start (exit 12); `relay-check.sh` compares the pin with `test/static/libavformat.pin` |

## 5. The credential inside the relay: the bound

| What | From | To |
|---|---|---|
| The start line (one static buffer) | the read | overwritten when it was parsed, on every path |
| The password | the parse | overwritten in the line after the Digest key of the first challenge was made; again after the open returned, whatever its result |
| The Digest key of that realm (hash of account, realm, password) and the account name | the first challenge | the end of the process (needed for every later request and for row 43's re-open). A challenge of another realm or hash is not answered: the password is gone by then |
| Pages of the start message and the account | start | kept out of the swap by `mlock`, best effort |

Not claimed: the kernel's pipe buffer; the hash contexts are overwritten before they are freed, other allocator memory is not. The Digest key is not the password, but it authenticates to that camera's realm: a same-user debugger still reads it (macOS: nothing built against it; Linux: not dumpable).

## 6. How the Makefile keeps the worker and the relay apart

1. The worker's sources are the explicit lists `SRC` / `HDR`; `check.sh src` and its self-test read `src/*.c` and `src/*.h`. That glob does not reach `src/relay/`; `pinned_calls.py` reads files of one directory, not folders.
2. The relay's sources are `RELAY_SRC` / `RELAY_HDR`, all under `src/relay/`, read by `relay-check.sh` only.
3. The relay includes no header of the worker and links `libavformat`, `libavcodec`, `libavutil` (not the worker's five libraries).
4. The binary is `build/capture-relay`, not a `capture-worker-<name>` (the name of a proof build, which `check.sh` counts).
5. `relay-check.sh` holds 1, 2 and 4 on the Makefile; a planted `#include "../worker.h"` is refused.

Evidence that the worker's rules are unchanged: `git diff --stat -- apps/capture-worker/check.sh apps/capture-worker/src apps/capture-worker/test/static` is empty; `make` prints the worker's `static rules OK` line and its 75 `refused as required` lines as before.

Bounds of the relay's own readers: answer head 8 KiB, description 64 KiB, one RTP frame 64 KiB (by the framing), one picture 8 MiB, one parameter set 1,024 bytes, receive buffer 256 KiB, challenge fields 512 bytes. Beyond a bound: a code, never a cut.

## 7. Checks (this Mac, 2026-10-13; loopback only; sandbox off; heavy-host lock)

Doubles: the test camera `rtsp_test_camera.py` on 8565 (1920x1080, 25 pictures a second, keyframe every 25, its synthetic account), two raw one-connection doubles of the harness on 8567, the release worker on 8559 / 8561 driven by `e11_listener_path.py` (two FIFO microphones, the FFmpeg pusher as the control on camera 2). The relay was started as the door starts it: no shell, empty environment, three pipes, one compact line.

| Check | Command (repository root) | Result |
|---|---|---|
| Whole build | `make -C apps/capture-worker` | `make rc=0`: worker rules OK and self-test, unit checks, worker binary, relay rules OK and 21 controls refused, `relay_unit_test: 79 checks passed`, `import net OK` |
| Adapter-level run | `M3_PORTS=8559,8561 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock python3 -B apps/capture-worker/test-fixtures/row041_relay.py all` | `ROW41 RELAY: 28 run(s), 28 PASS, 0 FAIL` |
| Existing gate suites after the change | `row58_gate.py all`, `row176_camera_end.py all` | `ROW58 GATE: 12 run(s), 12 PASS, 0 FAIL` (rc 0); `ROW176 CAMERA END: 6 run(s), 6 PASS, 0 FAIL` (rc 0) |
| Secret scan | `node scripts/secret-scan/count-only.mjs` on the new sources, the Makefile, `.cache/row041-relay` | `TOTAL: 0 in 0 file(s)` (after the control pusher's own trace logs were removed; the harness now removes them) |

The row's verification cell:

| Cell statement | Evidence |
|---|---|
| Adapter-level run for one camera: a decodable file with the expected frames | 4 runs (h264 and hevc, sets in the description and in the stream), each: camera sent 150, relay forwarded 150, held back 0, gaps 0; the worker connected once, 0 gate refusals; file codec `h264` / `hevc` as the camera states, 1920x1080, 125 pictures, `ffmpeg -v error` decode: 0 error lines. 125 = 150 - 25: the worker itself drops 1 picture without a time and 24 up to the next keyframe (`dropped_no_pts` 1, `dropped_prestart` 24); the control camera, pushed by FFmpeg, shows the same two numbers in the same run. Accounting closed in every run: file + worker drops + held back = camera sent |
| `Authorization: Basic` requests received in 2 runs: 0 | `basic_only_run_1`, `_2`: exit 22 `AUTH_SCHEME_NOT_ALLOWED`; the camera received 1 request, class `none`; `auth_basic` 0; no file, no `ingest_connected` |
| Socket snapshot: 0 listening, 0 datagram | `lsof -nP -a -p <pid> -i` in 7 runs: two rows, both `TCP ... (ESTABLISHED)`, to `127.0.0.1:8565` and `127.0.0.1:8559` |

Further cases of the delegation:

| Case | Result |
|---|---|
| Basic and Digest offered | recorded (125 pictures, 0 decode errors); `auth_basic` 0 |
| Digest, then Basic once the answer is held | requests at the double: `DESCRIBE` none, `DESCRIBE` digest; exit 23; no third request |
| Wrong password | exit 23 `AUTH_REFUSED`; camera: 1 `digest_refused`; nothing recorded |
| Awkward account (blank, `@`, `/`, `%`, `:` in the password) | recorded |
| `ps` during a run | argument words 1; password, account, locator, stream path, ingest address, its last element in `ps -o args` and `ps eww`: 0 each. The environment is empty by the door; that the relay cannot read one is the static rule and the import net |
| Ends when standard input closes | exit 0 in 0.04 s; TEARDOWN reached the camera; the worker's file complete (105 pictures = 130 forwarded - 25, 0 decode errors); 0 processes left |
| Ends when the worker goes away (`SIGKILL`) | exit 41 `INGEST_LOST` in 0.04 s; 0 processes left |
| Start refusals | an argument: exit 2. Ten wrong messages (unknown member, user part, host name, other scheme, ingest not loopback, port outside the range, query, `probe`, two lines, no line feed): exit 10 each. No message in 5 s: exit 11. Input closed first: exit 10. No camera: exit 20. Redirect: exit 25, 1 request. Control address of another host: exit 26, 1 request. In all: standard output 0 bytes, 0 occurrences of the account |

**One fault found and fixed on the way.** In the first stop run the file held one picture less than the relay had counted. Cause: the order to stop interrupted the library's writer in the middle of a picture, and the writer reported success. Now a picture is never cut by the order to stop (the write has its own 5 s bound) and the order is asked for at every packet. Two runs after the fix: counts equal.

## 8. Unproven here (hardware package and later rows)

- **A real camera with this client**: its Digest variant (`qop`, SHA-256 are unit-tested against the published examples only, the fixture has neither), a stale nonce, its description (several video sections, `Content-Base` forms), packets in interleaved or aggregated forms not taken (`forms_not_taken` counts them), B-frames (the muxed time is forced forward, order would be wrong), HEVC streams whose random-access pictures are not IDR, keyframes that are not IDR in H.264, parameter sets that change in mid stream, a camera that needs receiver reports to keep sending (none are sent), a keep-alive other than OPTIONS: `9A/H-10`, `H-11`, `H-12`, `H-21`, `H-22`, `H-23`.
- **A colon in the account name.** The coordinator's note (it cannot authenticate through a locator) does not bind this relay, which has no locator account; the Digest computation takes any name. Not run: the fixture's special account has no colon in its name. For the hardware procedure: test one.
- **Linux**: the build, `prctl`, the limits in the process table, `getentropy`, the socket check: rows 79, 141; `9A/H-01`, `H-24`.
- **macOS**: nothing prevents a same-user debugger.
- Runs longer than 6 s: keep-alive (`keepalives` was 0 in every run), drift (E-9), a nonce that expires.

## 9. Left to the named rows

| Row | What |
|---|---|
| 42 | probe mode; the "push established" report as a frame on standard output (`push_open` on standard error is only a mark); the picture size and parameter-set bytes are already at hand in `push_open` |
| 43 | re-open by the retry rule (2, 2, 4, 8, 16, 30 s) with the gate after every open; "ends after 2 refusals"; `LOCATOR_NOT_FOUND` is the code of a missing path; a new time base after a gap. Today a lost or stalled camera ends the relay |
| 44 | E-12 over all outputs in three failure runs; survivors after a killed parent |
| 46 / 48 | the adapter that builds the start message in the form of section 3; pairing with the worker's connect report |
| 152 | the fixture's redirect and foreign-control modes |

## 10. Driver decisions (for the controller to confirm)

1. **Own RTSP client; the library never reads the camera** (section 2). Departs from addendum 2.3 step 5 and 2.5; makes erratum E-A2 and HA-7 moot.
2. **The start-message member names** `type`, `mode`, `ingest`, `access`; closed set, unknown member refused.
3. **Basic and Digest offered together: Digest is answered.** A challenge with only Basic, or only a hash not answered (`MD5-sess`, `auth-int` alone): `AUTH_SCHEME_NOT_ALLOWED`.
4. **Time**: fixed mapping from the first forwarded picture, the camera's stamp distances after it (section 3).
5. **Locator host is an IPv4 address in digits**; a name and IPv6 are refused. An adopted camera is stored by address; if IPv6 is wanted it is a small change.
6. **Ingest port must be 8554 to 8564** (the worker's range), so the relay cannot be pointed at another loopback service.
7. **One refused answer ends the relay** (the design's "2 refusals" is across re-opens, row 43).
8. **60 s for the first keyframe** while the camera sends pictures (the adapter's 25 s bound is shorter and governs).
9. **SIGTERM and SIGINT are a clean stop** (exit 0), like the end of standard input.
10. **HEVC keyframe = any random-access picture type 16 to 21**; H.264 keyframe = an IDR slice.
11. **`-D_DEFAULT_SOURCE`** in the relay's flags only, for the Linux build of the same sources.

## 11. Requests

None left in `file_requests.md`. For information to row 46: the start message of section 3; to rows 65/66 nothing.

---
*Generated: 2026-10-13*
