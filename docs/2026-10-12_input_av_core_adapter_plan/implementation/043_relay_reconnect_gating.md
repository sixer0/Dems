---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 43
date: 2026-10-13
agent: coder-execution (batch 8, agent W2)
tier: T3
work_package: WP-03c
requirement: F10 (a) after every re-open; design addendum 2.4 (1), (2) and 5.1; S13-06 = RC-4 (the relay's part: a resumed leg never becomes a second push); AD-06 (the two new lines are numbers only); C37 (every line carries its attempt)
status: complete on this Mac's doubles. The relay's RTSP client stays a CANDIDATE (C38, C39): one function was added to its interface, none of its readers was changed
---

# Row 43: the relay re-opens the camera leg, keeps its push, and gates on a keyframe after every re-open

Paths are under `apps/capture-worker/` unless they begin with `docs/`. All runs: this Mac (arm64, libavformat 63.1.102), loopback only, command sandbox off, heavy-host lock per run, 2026-10-13 08:55 to 09:40 local.

## 1. What was built

| File | State | What |
|---|---|---|
| `src/relay/relay.h` | changed | header text "THE RE-OPEN" (the rule in one place); `RELAY_RETRY_TRIES` 6, `RELAY_AUTH_REFUSALS` 2, `RELAY_COUNT_MAX`; `relay_loss_kind`, `relay_retry_wait_us`, `relay_same_stream`, `relay_loss_line`, `relay_reopened_line`; `relay_camera_drop`. NO new exit code (section 3) |
| `src/relay/relay_core.c` | changed, additive | the five pure functions (no socket, no clock) |
| `src/relay/relay_rtsp.c` | changed, additive | ONE function, `relay_camera_drop`: the connection closed without a request, everything of it forgotten, the Digest key of the realm kept. Nothing else of the candidate client was touched |
| `src/relay/relay.c` | changed | `camera_again` (the loss line, the waits, the tries, the refusal count); the loop of `main` runs once per leg; the gate after a re-open; the time of the first picture of a new leg; no TEARDOWN after a refused answer |
| `relay-check.sh` | changed | the pin "two callers of the report writer" is four; rules `RE-OPEN` (9 lines) and two `AD-06` lines, with 2 planted lines and 6 mutations |
| `test/relay_unit_test.c` | extended | 590 -> 918 checks: the rule, the announced-stream comparison, both lines into every room, and the REAL camera leg given up and opened again on socket pairs |
| `test-fixtures/row043_reopen.py` | new | 11 session runs, one of them the negative control |
| `test-fixtures/row041_relay.py`, `row042_probe.py`, `row186_bounds.py` | changed, by necessity | section 6 |

Not touched: `rtsp_test_camera.py`, the worker's sources, `test/relay_fuzz.c` (claimed, not needed: the two lines have no input of unbounded size; their bounds are unit-checked into every room).

## 2. The behaviour

Applies in record mode once the push stands. Before that, and in probe mode, every failure ends the relay exactly as before.

| Subject | Rule |
|---|---|
| Which ends are opened again | `CAMERA_LOST` (32), `CAMERA_STALLED` (31), `CAMERA_UNREACHABLE` (20); `AUTH_REFUSED` (23) is opened again AND counted |
| The push | untouched. `avformat_write_header` is still called once in the program (static rule BR-07); the worker sees ONE connection and writes ONE file (E-10: a second push is refused at TCP) |
| Retry | waits 2, 2, 4, 8, 16, 30 s before the tries of one loss (input-av's rule, S1-8); 6 tries. The count starts again when a picture is forwarded. Tries used up: the relay ends with the code of its LAST try |
| Refusals | the 2nd refused Digest answer of the relay's life (after the push stood) ends it with `AUTH_REFUSED`; no request leaves after it, not even TEARDOWN |
| Ends at once | `LOCATOR_NOT_FOUND` (the design's `LOCATOR_STALE`), `AUTH_SCHEME_NOT_ALLOWED`, redirect, foreign control address, description / codec / transport refusals, `CAMERA_PROTOCOL`, `KEYFRAME_TIMEOUT`, and `STREAM_INVALID` when the stream that came back is not the announced one (other codec, or a parameter set that differs by a byte) |
| Credential | the password was overwritten after the first open and is not needed: the Digest key of the realm answers. The challenge of the old connection is NOT carried over: the first request of a new connection carries no answer. A camera that asked for no answer at first and challenges on a re-open is not answered (`AUTH_REFUSED`, nothing sent) |
| The gate | closed from the loss on. It opens at the first KEYFRAME of the new leg for which complete parameter sets are held and equal the announced ones. Everything before is counted (`held_back`) |
| Time | the first picture of a new leg is placed as far after the last forwarded picture as this host's clock counted: one step inside the track |
| Sockets | the dead connection is closed at the loss; the relay's own socket rule is asked again after every re-open |

**The lines** (standard output, made in `relay_core.c` from numbers; never an address, a path or a text):

```
{"report":"camera_lost","v":1,"attempt":<n>,"loss":<k>,"cause":<20|23|31|32>}
{"report":"camera_reopened","v":1,"attempt":<n>,"loss":<k>,"tries":<1..6>,"held_back":<n>,"gap_ms":<n>}
```

`camera_lost` is written at the loss; `camera_reopened` when the first keyframe after it is about to be forwarded (addendum 5.1: the fault interval of `CAMERA_LOSS`). `attempt` is the start message's (C37). Standard error gains the marks `camera_lost` and `camera_reopened` in the unchanged fixed shape.

## 3. What the Core sees (for rows 44, 46, 48, 59)

- **Exit codes: none added, none renumbered.** `apps/core-server/.../onvif-relay.test.ts:505` reads `relay.h` and pins every code to the adapter's table, so a new code would have turned a file of another owner red. Meaning changed: a relay that ends with 20 / 31 / 32 AFTER "push established" has used up its tries.
- **Standard output is no longer one line.** The Core's reader (`relay-start.ts`, `createRelayReportReader`) counts and drops a line it does not know, so nothing breaks; until it learns the two lines a loss inside a session is invisible to the Core until the relay ends. Request filed.
- C35 / C40: the relay only reports. One loss = one `camera_lost` and at most one `camera_reopened`; what notice that becomes is the Core's.

## 4. The proof of the gate (as corrected by the coordinator after `test/014`)

"0 decode errors" cannot see the fault (E-10: 30 of 30 wrong pictures, silent decoder). `row043_reopen.py` therefore checks, per gap of the worker's file:

1. **keyframe-first**: the first sample after the gap is a sync sample of the container (`ffprobe` packet flag `K`; the worker sets it from the relay's keyframe flag: an IDR for H.264, an IRAP picture for HEVC);
2. **picture by picture against the source**: every decoded picture after the gap (`ffmpeg -f framemd5`) is compared, in order, with the decoded pictures of the camera's clip (250 pictures, 250 different MD5 values): the first must be the clip's picture `k * 25`, each later one the next of the clip, to the next gap or the end.

The camera (`--drop-after-frames 60`, `--drop-style fin|reset`, `--first-keyframe-delay-ms 400 --first-keyframe-fill inter`) ends the connection in mid group and begins the next one with 10 pictures of ANOTHER group that are no keyframes, then the 15 pictures up to the next keyframe.

| Run | Compared after the gap | Result |
|---|---|---|
| 4 drop runs (H.264 / HEVC x sets in the description / in the stream; orderly end and reset) | clip pictures 75 to 150: 76 of 76 equal in order; first sample sync; `held_back` 25 | PASS |
| dropped twice in one session | 75 to 119 (45 of 45), then 125 to 200 (76 of 76); `held_back` 25 and 15 | PASS |
| camera away 5 s, another process at the address | 0 to 75 (76 of 76); `tries` 3, `gap_ms` 8103 | PASS |
| **NEGATIVE CONTROL** (a relay from a copy of the sources whose gate opens at any picture after a re-open) | first sample after the gap NOT sync; first picture is no picture of the clip; 0 of 76 equal in order; 17 pictures of the file are no pictures of the clip; **`ffmpeg -v error`: 0 lines** | FAILS as required, on all three criteria |

A first version of the control passed the comparison: the camera's plain drop resumes with the very next picture, so nothing the decoder needs is missing. The lead of foreign pictures was added for that reason.

## 5. Checks

| Check | Command (repository root) | Result |
|---|---|---|
| Static rules | `sh relay-check.sh src/relay`; `--selftest` | `static rules OK (... RE-OPEN ...)`; 44 `refused as required` (36 before) |
| Unit, plain and sanitizers | `make -C apps/capture-worker relay-unit relay-asan` | `relay_unit_test: 918 checks passed; ... 34 of 34 pass`, twice; 3 controls fail as required |
| This row | `row043_reopen.py drop`, `back`, `refused`, `gone`, `control` (one lock hold each) | `ROW43 REOPEN: 11 run(s), 11 PASS, 0 FAIL` |
| Adapted fixtures | `row041_relay.py record`; `row186_bounds.py session` | 6 of 6 PASS; `ROW186 BOUNDS (capture-relay): 23 run(s), 23 PASS, 0 FAIL` |
| Whole build and the six fixtures | section 5 of `178_worker_gate_concurrency_leak_test.md` (run once, after row 178) | there |

The other runs of `row043_reopen.py` (each: ONE `ingest_connected`, 0 gate refusals, worker exit 0, every line with attempt 7, 0 session texts in the relay's output, control camera recorded, nothing left):

| Run | Result |
|---|---|
| address answers with another account | exit 23; requests at the second camera: `none`, `digest_refused`, `none`, `digest_refused` - exactly 2 with an answer; 3 s after the exit: the same 4; 4.0 s from the loss |
| stream path gone | exit 24 after `none` 401, `digest_ok` 404; 1.99 s |
| address challenges Basic only | exit 22; 1 request, 0 with an answer |
| camera never back | exit 20 `CAMERA_UNREACHABLE`, 62.14 s after the loss line (waits sum 62 s); the worker's file of the first leg decodes, 82 pictures |

In every drop run the gap is one step in the track (3.05 to 3.28 s for `gap_ms` 3001 to 3040) and the worker raised its own `KEYFRAME_INTERVAL_ABOVE_BOUND` warning once, as E-10 saw.

Observation, not this row's: every file of this worker has its first video sample at 0 and its second at the stream's real offset (2.6 s here; the control camera's file and row 41's files too).

## 6. Fixtures of earlier rows that this row made false by design

| File | Change |
|---|---|
| `row041_relay.py` | the relay's outputs are read as they come (`Relay.saw`); a `record` run stops the relay at the loss line (the camera's 150 pictures ended; the relay no longer ends by itself); `recorded()` for a loss expects exit `STOPPED` and exactly one loss line with that cause; standard output may hold the lines of section 2 |
| `row042_probe.py` | one criterion: the established line is followed by the loss line with the same attempt |
| `row186_bounds.py` | the session case "flood after 100 pictures": the 5 s bound is measured at the loss line (4.965 s), then the run stops the relay |

## 7. Unproven here

- A real camera: one that needs longer than a try to come back after a reboot and answers 5xx meanwhile (`CAMERA_PROTOCOL` ends the relay: conservative), parameter sets that differ after a restart (ends with `STREAM_INVALID`), a re-open after a stale nonce, a stall instead of a close on real hardware: `9A/H-10` to `H-12`, `H-21` to `H-23`.
- A gap longer than 8 s on the push connection with the worker of the Ubuntu library (62 s was survived here by relay and worker; nothing was pushed after it): row 141.
- The worker's and the Core reader's treatment of the step was measured in E-10, not again here.
- Linux: everything.

## 8. Left to the named rows

| Row | What |
|---|---|
| 44 | E-12 with the two new lines present (they hold numbers only); survivors after a killed parent while the relay WAITS between two tries (it ends when its input ends: seen within 50 ms by construction, not run with a killed parent) |
| 46 / 48 | the reader learns `camera_lost` / `camera_reopened`; loss raised and cleared (addendum 5.1); codes 20 / 31 / 32 after establishment mean "tries used up" |
| 59 | nothing of the worker's series (the relay is not in it) |
| 141 | the same fixture in the container |

## 9. Driver decisions (for the controller to confirm)

1. **No new exit code**; tries used up = the code of the last try (section 3).
2. **6 tries per loss** (the six waits of the rule); input-av retried without end. A camera that comes back and drops again and again is opened again each time, each loss said: no total bound.
3. **Refusals are counted for the relay's life**, never reset by a success (lock-out bound of D86 C-2).
4. **Only 20 / 31 / 32 (and 23, counted) are opened again**; a protocol surprise on a re-open ends the relay.
5. **The stream must come back byte-identical in its parameter sets**, else `STREAM_INVALID`.
6. **The first picture of a new leg is placed by this host's clock relative to the last forwarded one**; "arrival stamps" of addendum 5.1 only at that one point.
7. **Two report lines with numbers only**, `cause` as the code's number; `camera_reopened` at the first forwarded keyframe.
8. **No TEARDOWN on a leg that is given up, and none after a refused answer** (also at the end after a first-open refusal while playing).
9. **Three fixtures of earlier rows edited** (section 6); the test camera was not.

## 10. Requests

Two lines in `delegation_progress/file_requests.md` (none blocking): the Core's report reader and loss wiring; the meaning of codes 20 / 31 / 32.

---
*Generated: 2026-10-13*
