---
task_id: 2026-10-07_dems_real_capture_sealing
row: 58 (pair review, navigator B: parts P3, P4, P6)
date: 2026-10-09
agent: verifier (navigator B)
reviewed: uncommitted diff on HEAD 101ce62; driver report `implementation/20_m3_worker_engine.md`
status: complete
---

# Row 58 - navigator B review (C worker, mux flags, end to end on fakes)

Tier 2. Every number below is from my own run unless it says "driver". Commands were run from
`/Users/gsp-budi/Documents/DEMS`, sandbox off where a loopback port is bound. Scratch (sources,
binaries, media, results): `.cache/row58_nav/` (git-ignored). No repo file was edited; this file is
the only artifact written under `/docs`.

## 1. Verdict

| Part | Verdict | In one line |
|---|---|---|
| P3 - the C worker | **ACCEPT-WITH-FINDINGS** | Every acceptance criterion of the row reproduces on fakes. 0 blocker, 4 major (F-1..F-4), all outside what the row's checks can see. F-1 is a one-line defect in a requirement the row names (slew limit) |
| P4 - mux flags | **ACCEPT** | The rejection of `delay_moov` is right; I reproduced the failing case and found a second, independent reason. My round-1 recommendation is withdrawn |
| P6 - end to end | **ACCEPT-WITH-FINDINGS** | M3-KC-1 file half, M3-KC-3, option C on disk, sockets and AV all reproduce. One major (F-3: a 0-byte evidence file in a kill window) and the harness is not yet a gate-runnable thing |

Recommendation to the controller: close row 58 after a short fix round for **F-1** (one line) and
**F-2** (rate limit + a refusal that does not depend on a log text). F-3 and F-4 can be carried by
decision to rows 59 and 65/71, but they must be written into D58-2 and D58-6, because both
decisions state something the code does not hold.

## 2. Findings

Severity: blocker = the row cannot close; major = real defect or a stated invariant that is false;
minor = hygiene. "Measured" = my run; "inspection" = read in the code, not run.

| ID | Sev | Where | What, and the evidence | Suggested fix | Owner |
|---|---|---|---|---|---|
| F-1 | major | `ingest.c:336-343` | **The slew limit is a token bucket with no cap: after a quiet period the anchor moves in ONE step.** `room = (pts_us - slew_ref_pts_us) * 500 / 1e6` and `slew_ref_pts_us` is only advanced when a step was taken (`:342`). On this fixture `PRFT - pts` never changed (0 differing packets out of 350, logged by a scratch build), so the budget grows for the whole session. Measured with a scratch build that adds +200 ms to the reported wall clock from the 300th written packet (7 s after the anchor): the file's video jumps **314 ticks = 3,489 us in one frame**, then creeps 1 tick per frame (the intended 500 us/s). 7 s x 500 us/s = 3.5 ms: the whole saved budget at once. After 10 min of stable reports the same code allows a 300 ms step, after 1 h 1.8 s. Row text item (10) and spec F ("with a **slew limit**") | advance `slew_ref_pts_us = pts_us` on every packet that carries a report (or cap `room` at one frame interval's worth) | row 58 fix round; test at row 60/62 (section 7) |
| F-2 | major | `ingest.c:94-104`, `ipc.c:55-68`, `capture_worker.c:336-339`, `:209-214`, `:216-222` | **The UDP refusal keys on the text "not on whitelist". If an FFmpeg update rewords it, sockets still fail closed, but the session fails badly.** Measured with a scratch build whose `strstr` text does not match (same client, listen timeout 3 s): (a) 1,056 `lsof` snapshots, **0 UDP rows, 0 rows off 127.0.0.1** - the socket guarantee comes from `protocol_whitelist=tcp` (`:271`), not from the text; (b) the ingest thread spins in libavformat's retry loop and every turn is logged: **6,132,949 lines = 1.23 GB of `worker.jsonl` in 11 s** (no rate limit, `fflush` per line; rotation only at worker start); (c) at timeout + 10 s `INGEST_OPEN_STUCK` ends the WHOLE worker: the healthy camera 2 was still streaming and its file stopped at 431,853 B; (d) the spinning thread never returns, `session_close` hangs in `pthread_join`, so `cam_close` runs for NO camera: camera 2's open fragment is lost and **no `CRASH` frame is sent**; the 10 s watchdog logs `SHUTDOWN_STUCK` and `_exit(70)`. Both backstops work as written (no orphan, non-zero exit) but one UDP-asking client costs the session, a CPU core and gigabytes in the data directory | (1) rate-limit `LIBAV_MESSAGE` (N per second + a suppressed counter) and cap the log size while running; (2) make the refusal text-independent: count error-level callbacks on the opening thread and take the same exit path after N of them; (3) close the cameras whose threads did end before waiting on the one that did not; (4) row 61 boot check pins the libavformat version the worker reports | row 58 fix round (1, 2); row 61 (4) |
| F-3 | major | `sink.c:79-85` (and its header, lines 4-7) | **"A file that holds no fragment never exists" is false between `open(O_EXCL)` and `write()`.** Measured on the first attempt, real binary, real supervisor: SIGKILL the moment a camera file appears -> `VIDEO-01.mp4` 87,747 B (one whole fragment), **`VIDEO-02.mp4` 0 bytes** (no `ftyp`, ffmpeg rc 183). Bytes are never overwritten afterwards (option C holds), but D58-2 states the invariant, and D58-1 treats `OUTPUT_EXISTS` as "durable": a 0-byte file sends the session to `FAULTED` with nothing durable in it. Also by inspection: a short write (disk full) leaves a torn fragment on disk and the counter untouched (`:84-85`), no `ftruncate` back | write the first fragment to `<path>.<pid>.part`, then `link()` to the final name (atomic, fails if it exists), unlink the temp name, keep the descriptor; `ftruncate` to the last good length on a failed write | row 59 (it owns the writer, D58-8), or the row-58 fix round; controller amends D58-2 either way |
| F-4 | major (design; passes on fixtures) | `audio.c:20-28`, `:275`, `:288-308`, `:409` | **Mics are consumed by position on the HOST clock with 40 ms of slack, and late samples are dropped for good. A mic whose sample clock is slower than the host, or that stops and comes back, goes silent for the rest of the session with no warning.** Measured: (a) scratch fake mic 2,000 ppm slow: RMS per second 0.06-0.09 until second 19, then **0.0000 for the last 20 s**, `missing_primary 940,800` samples, telemetry `dbfs: null`, no `WARNING`. 40 ms / 2,000 ppm = 20 s; at 100 ppm (an ordinary USB crystal) the same code goes silent after about 6.7 min, at 20 ppm after 33 min. (b) mic process ends at 12 s, a new one writes the same pipes from 17 s: silence from second 12 **to the end (28 s)**, `missing 1,317,120`; the returning samples keep their old index and are always "late". (c) T0 takes the delivery instant as the capture instant: a 5,000 us delivery delay injected in the mic process -> `t0 - e0 = 5,014 us` and AV error **+5.012 ms on both files** (so W-5 holds: the check can now fail). Spec F marks the third oscillator as a HYPOTHESIS; this is its first measurement | D58-6 must say "fixture transport only". For a device: drive the audio timeline from the mic's own sample count (never drop on lateness; account xruns explicitly), re-place a mic after a gap, and raise the disconnect / `MIC_SILENT` warnings | row 65 (adapters), row 71 (warnings); controller amends D58-6 |
| F-5 | minor | `audio.c:346-347`, `ingest.c:346` | `nearBound` is slope x span of the ARRIVAL lag fitted over the whole session. Measured: after one 4 s network stall `trendPpm -246,549, nearBound true` (no drift at all); with a camera clock 10 s wrong `lagMs +10,004 / -9,998, nearBound false` | fit over a sliding window; add an absolute-lag term | row 62 / 71 (D58-7) |
| F-6 | minor (class C risk) | `ingest.c:351`, `:321-324` | No sanity bound on the camera wall clock. Measured, cameras +10 s / -10 s off: file 1 lost **299 frames (6 s) silently** as `dropped_prestart` (pts < 0), file 2 has its first frame "held" for 15.98 s; offsets are the full 10 s; no warning, only `lagMs`. By inspection: a clock hours ahead overflows the 32-bit first-sample duration (13.25 h at 90 kHz). Spec F records the dependency (H-7) | at anchoring, if abs(arrival - camera time) is above a bound: `CAPTURE_FAULT` for that camera instead of recording at a wrong time | row 62 / class C |
| F-7 | minor | `audio.c:226-233`, `:405-424` | PCM tap into a named pipe is closed for the session on the first `EAGAIN`, and the worker writes a start burst (about 340 ms of audio at once after the T0 window). Measured: with `cat` as reader the tap is complete (931,680 samples = `samples_in`); with a Python reader that was open and reading, **closed after 6,144 samples (0.128 s)**, `pcm_tap_closed errno 35`. Only a log line says so: no frame, no telemetry flag. Under STT load a reader pause of 170 ms (16 KB pipe) ends transcription for the session | bounded ring (1-2 s) before giving up; a telemetry flag or warning when the tap ends | the row that connects the transcriber to the tap (76/77) |
| F-8 | minor | `ingest.c:313` | Packets without a pts (before the first sender report, incl. the first keyframe) are skipped without a counter; `camera_summary` cannot say where frame 0 went. The "first GOP dropped" is this plus `dropped_prestart: 49` | count them (`dropped_no_pts`) | row 58 fix round |
| F-9 | minor | `capture_worker.c:245`, `:90` | UBSan: `runtime error: inf is outside the range of representable values of type 'int'` for `"v":1e999` (the frame is still refused, rc 64). `"v":2.9` is accepted as 2. Text after a NUL inside a line is ignored and the line accepted | require `is_int` and a range before the cast | row 58 fix round |
| F-10 | minor | `check.sh` | The static rules are text matches. My direct plant (`av_dict_set(o, "avoid_negative_ts", "disabled", 0)`) is refused (rc 2). Two evasions pass: the option written as `"use_" "editlist"`, and a function pointer to the graph command in `audio.c`. Also nothing in the Core refuses a worker whose `HELLO` says `-PROOF` (grep of `apps/core-server/src/capture`, `packages/capture-protocol/src`: 0 hits) | accept as a tripwire, say so; row 61 boot check refuses a `-PROOF` worker | row 61 |
| F-11 | minor | `ingest.c:56-70`, `:284` | The in-process socket check runs once per ingest, right after the open. "At any time" rests on the whitelist. A periodic call from the control loop is three lines | call `sockets_violation` once a second in `main`'s loop | row 58 fix round |
| F-12 | minor | `audio.c:457`, `capture_worker.c:223-232` | The last `TELEMETRY` is sent before the files close: it never carries the final fragment (`count 6, bytes 236,396` against 7 / 270,561 on disk) and its levels are `dbfs: null` in half the runs | row 59's checkpoint record covers the count; send levels only when there are samples | row 59 |
| F-13 | minor | `audio.c:314-349`, `ipc.c:201-208` | `snprintf` results are added to an offset without a truncation check (safe today: worst case 471 of 512 bytes with two 128-character IDs); a writer thread blocked on a full pipe makes `ipc_stop` hang when no session was served (no watchdog on that path) | clamp the offsets; start the watchdog in `main` | row 58 fix round |
| F-14 | minor | harness | `m3worker.py` imports its analysers and compiles `fake_cam.c` from `implementation/evidence/59_m3proof/` (docs tree) and builds its negative control with `git show 101ce62:...`; `official.sh` lives in the git-ignored `.cache/row58/` and has no aggregate exit code | section 8 | row 60 |

Not findings (checked, hold): every allocation, `pthread_create`, `pthread_mutex_init`, `fopen` and
libav return is checked; cross-thread flags are atomics; each muxer is only touched under its
camera's mutex; the filter graph is private to `audio.c`; `fatal()` is sticky, exits 70 and sends
`CRASH` after the close; stdout is written by one thread only.

## 3. What I ran, with the driver's numbers beside mine

Host load (1-minute average) at the start of each timing-sensitive run is in the table. One run
(`pm80`) started at 12.01, marginally above the limit I was given; its result equals later runs at
load 3-8, so I kept it and say so.

| Check | Driver | Mine | Load |
|---|---|---|---|
| Build `make -C apps/capture-worker clean all` | - | rc 0, 0 warnings with `-Wall -Wextra -Werror`; static rules OK; 13 planted lines refused | - |
| clang static analyzer, 5 files | - | 0 warnings | - |
| ASan + UBSan, full session (2 cameras, camera 2 killed at +6 s, 2 mic switches, file tap, STOP) | - | rc 0, **0 reports**; files playable | 4.4 |
| TSan, same session | - | rc 0, **0 data-race reports** (worker code only; libav is not instrumented) | 7.2 |
| AV zero (harness, switch + tap) | 0.035 / 0.025 ms; T0 13 us | PASS, 0.0208 ms; T0 10 us; H-4 913/913, 0 differing | 5.2 |
| AV +80 / -80 ms, **my analysis code from round 1** (`nav_check.py h10`, box-level timing + template fit) | 80.0236 / -79.9764 | **+80.0153 / -79.9847 ms, error 0.0153**; my player-view code: 0.0148 | 12.0 |
| AV drift +200 / -200 ppm (harness) | 199.78 / -200.09; max 0.029 ms | PASS, 200.03 / -200.50 ppm, max error 0.0375 ms | 6.6 |
| H-4, my box-level byte compare | 912/912 | 911/911 audio samples, payload differing 0, timing differing 0, 0 vs encoder manifest | - |
| H-4 negative control (`h4neg`) | fails | FAIL as required: 913 of 913 differ | - |
| Mic-side delay 5,000 us injected (scratch fake mic) | "772 us seen in development" | T0 error **5,014 us**, AV error **+5.0122 ms** on both files: the T0 error is observable | 4.4 |
| Files grow during the session, `stat` once a second | 6 distinct sizes | none for 7 s, then 88,016 -> 117,746 -> 146,815 -> 176,613 -> 206,328 -> 236,396, final 270,561 (camera 1) | 12.0 |
| `kill -9` mid-session (worker alone) | - | sizes before = after = 2 s later (176,938 / 176,578), SHA equal; my box walk: `ftyp moov` + 4 whole `moof mdat` pairs, no torn tail; ffmpeg decode rc 0, 0 error lines, 350 video / 605 audio packets | 8.3 |
| SIGTERM mid-session | - | rc 0, both files closed with their last fragment (192,271 B), shape OK, decode rc 0 | 7.1 |
| Camera 2 dies at +6 s | 4-5 audio-only fragments, longest 2.112 s | file 2 keeps growing; fragments `[video, audio]`: [50,276] [100,94] [100,191] [0,94] [0,98] [0,94] [0,18]; longest audio-only 2.09 s; the fragment in which the camera died holds 4.07 s of audio | 4.4 |
| Sockets, UDP-asking client | 41 snapshots, 0 UDP | **334 snapshots** from before the client connects to after STOP: `127.0.0.1:8555 (LISTEN)`, `127.0.0.1:8557 (LISTEN)`, one ESTABLISHED on 8557; **0 UDP, 0 off loopback**; `INGEST_TRANSPORT_REFUSED`; camera 2 recorded; rc 0. Normal session: 746 snapshots, same result | 7.5 |
| M3-KC-1 file half (harness, once) + my parser | 117,763 / 117,403 | PASS: `FAULTED`, `durable true`, attempt 1, no respawn, `[EXITED, SIGKILL, null]`; 117,389 / 117,029 B before = after; my walk: 2 whole fragments each, decode rc 0. Session 2: new pid, 271,987 / 270,787 B, shape OK, error 0.025 ms | 8.0 |
| M3-KC-3 (harness, once) + my parser | 316,179 / 314,751 | PASS: `[EXITED, SIGKILL, 250]`, attempt 2, new pid; 315,615 B each, 7 fragments, decode rc 0, error 0.036 ms | 6.1 |
| Kill in the window after the first fragment reached the disk (real binary) | - | supervisor had the record 2 ms before the exit: `FAULTED`, no respawn; SHA before = after; **one file 0 bytes (F-3)** | 5.0 |
| Same, record held back 500 ms (scratch build; refusal path untouched) | `neg_kc1` (mutated supervisor) | no durable record at the kill -> supervisor respawns after 250 ms -> **attempt 2 refuses `START` with `OUTPUT_EXISTS`** -> `START_REFUSED`, `CAPTURE_FAULT` once, `FAULTED`; both files 83,595 B, **SHA-256 identical before, 6 s later and after stop** | 4.1 |
| Framing (11 cases) | 4 cases | line split over 3 writes: accepted; 2 commands in one write with CRLF: 2 ACKs in order; end of input: rc 0; not JSON, extra member, other version, duplicate member, 270,000 bytes without newline: `CRASH PROTOCOL_VIOLATION`, rc 64 | - |
| Timing | hello 17.8-42.7 ms; START->ACK 0.12-0.65; STOP->exit 7.1-15.5; heartbeat 492.9-507.2; switch 4.1-10.4 | hello 22.4-30.6; START->ACK 0.49 and **4.62** (one run, load 5.2: above the driver's range, 0.1 % of the 5 s timeout); STOP->exit 10.9-16.8; heartbeat 494.0-505.7; switch 1.1-4.4 (11-13 under ASan/TSan) | 4-8 |

## 4. Durability and file content (task item 4)

- **What the code does.** The muxer writes into memory; `sink.c` holds the bytes until they end on
  a complete `mdat`, creates the file with `O_CREAT | O_EXCL | O_APPEND` at the first one, then
  appends fragment by fragment. `lstat` at `START` plus `O_EXCL` at create: an existing path
  (symlink included) is never opened. **No fsync anywhere** (grep: one hit, in a comment,
  `sink.c:17`); "on disk" here means visible to other processes and safe against the death of the
  worker, not against power loss. The fsync policy is row 59's (spec C.2: "`-flush_packets 1` ...
  **not** crash-durability").
- **After `kill -9`:** whole fragments only, in every run but the F-3 window.
- **"A camera that never connects gets no file."** Measured (`nosrc`, and camera 1 of the UDP run):
  no file, `CAPTURE_FAULT` for the device, rc 0. Acceptable against the spec: W-3 is about a
  camera that "stalled or dead ... must not stop the audio of its own file from becoming durable",
  and a stream-copy file cannot get its `moov` without the camera's parameters. The limit to record:
  **if no camera connects, the session's audio is durable nowhere** (281 encoder packets went to no
  file in `nosrc`). That is a product decision (refuse to start, or an audio-only file), not a row-58
  defect.
- **"The first GOP of each camera is dropped."** Measured `dropped_prestart: 49` in every run, plus
  the uncounted frame 0 (F-8). Spec C.4 accepts "held until the first keyframe after T0 - up to one
  GOP". The cost is one more GOP than that sentence implies whenever the camera connects after
  `START`, which is every session in this design (the listener exists only from `START`). With the
  long-GOP camera of A.8 that is up to 10 s of video per camera at the start. Acceptable for row 58;
  it belongs in the row-59 manifest notes and can be removed later by keeping the pre-report packets
  until the first sender report arrives.
- **Audio after a camera stops:** holds (section 3). One open point by inspection: a camera that
  keeps sending without keyframes is never cut (`ingest.c:214-216`), so the muxer's fragment buffer
  is unbounded there. That is OP-GOP, open in spec C.1, row 59.

## 5. P4 - mux flags (task item 5)

I recommended evaluating `delay_moov` in round 1. Re-examined with my own runs:

| Case | Pinned flags | `delay_moov` |
|---|---|---|
| Normal +80 / -80 | 80.0153 / -79.9847 | correct too (file time 0 = T0: decoded onset - mic onset = 0) |
| Both cameras stall 0.6 s after connecting, for 4 s | **80.0185 / -79.9815 ms**, 9 fragments, records in the order durable, durable, first-video, first-video | **video at file time 0**: first video packets `0, 1800, 3600` where the record says 497,583; errors of 5.5 s and 3.7 s; decode rc 0; only ONE `elst` in the file (audio), none for video |
| Reader that ignores edit lists, normal run | unchanged (0 edit lists) | first video pts 528,637 -> **0**; the offset exists only as an empty edit `(4229096, -1)`; video `tfdt` of fragment 1 is 0 |

So the rejection is right for two independent reasons. Is it rescuable by "no audio-only cut before
the first video sample"? Technically yes, but it gives up W-3 in exactly that window (a camera that
connects and stalls before its first keyframe would keep its audio in memory with no file), and the
edit-list dependence stays. Not worth it. **D58-4: accept.**

Chosen flags `+frag_keyframe+empty_moov+default_base_moof+skip_trailer`:

- **Held first frame / `FIRST_VIDEO_SAMPLE`.** Record 527,933 (camera 1); file: first packet
  `(0, duration 531,653)`, second at 531,653 = 527,933 + 1,920 (priming at 90 kHz) + 1,800 (one
  frame). Independent cross-check: under `delay_moov` the muxer itself shows the first video pts,
  and it equals the record in that run (528,637 = 528,637). The harness only compares the record
  with the worker's own log; the comparison above is the one that can fail.
- **`skip_trailer`.** 0 `mfra`, 0 `elst`, the file ends on the last `mdat` in every file I walked
  (clean stop, SIGTERM, SIGKILL): the stored bytes are purely append-only, which is what spec C.6
  and the S1 running-hash / tail-validation expect.
- **Static rule.** Section 2, F-10.
- **`CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES = 1_024`** (`packages/shared/src/api/capture.ts:82`).
  Measured in every pinned-flag file I decoded (at least 12 files of 6 sessions): decoded beep onset - the mic process's own onset sample =
  **1,024 for every beep, both files** -> file time 0 = T0 - 1024/48000 s for the audio track.
  **Not the same for the tap:** tap onset - mic onset = **0** (pipe tap and file tap): tap sample n
  is at T0 + n/48000, so a tap consumer adds the constant only when it converts to FILE time
  (`(n + 1024) / 48000`), as the driver's 4.3 says.

## 6. Untested paths the driver listed (task item 8)

| Path | Exercised by me | Result | Class |
|---|---|---|---|
| Tap into a named pipe | yes, 2 runs | complete with `cat`; dead after 0.128 s with a slower reader (F-7) | acceptable for row 58; finding for the tap consumer row (76/77) |
| Mic starts late / stops | stop + return, and a slow clock | F-4 | **not acceptable to inherit**; row 65 / 71. Not a blocker for row 58: the row text asks for "2 mic captures" on fakes, and `MIC_SILENT` is rows 48 / 71 (`02_structured.md:408`) |
| `INGEST_OPEN_STUCK` | yes | fires at timeout + 10 s, ends the whole worker (F-2) | row 58 fix round |
| Shutdown watchdog | yes | fires after 10 s, `SHUTDOWN_STUCK`, `_exit(70)`, no `CRASH` frame, no orphan | acceptable as a last resort; F-2 (3) removes the common cause |
| One camera, one mic | yes | 1 playable file 270,925 B, records seq 1-2, error 0.037 ms, telemetry with one level; the log still prints `missing_standby` for the absent mic (cosmetic) | acceptable |
| No `MIC_SILENT` / disconnect warning; `dbfs: null` | observed in 3 runs | telemetry shows `null`, no `WARNING` | belongs to row 71 (OD-11); acceptable for row 58 |
| Slew limit | yes, scratch build | F-1 | row 58 fix round + test below |
| `nearBound` | yes (stall run, offset run) | F-5 | row 62 / 71 |

## 7. PRFT anchoring: judgement and the missing test (task item 6)

Correct: anchor from the packet's PRFT, monotonic dts guard (`:362`), trend as telemetry only,
no arrival fallback (N-14 closed), `seen` identical on every packet of this fixture. Defect: F-1.

Proposed checks:

1. **Unit (row 60, no fixture needed):** move lines 336-343 into a pure function
   `anchor_follow(anchor, ref, seen, pts_us)` and test: constant `seen` for 600 s then +200 ms ->
   the first step is at most `SLEW_US_PER_S x one frame interval` (10 us at 50 fps), the total
   moved after t seconds is at most 500 us x t, and a negative step never lowers dts. Today this
   fails with 300,000 us in one step.
2. **Fixture (row 62, the hand-written RTCP camera of A.8 (2)):** (a) a +200 ms and a -200 ms step
   in the sender report after 30 s: every video sample duration in the file stays within
   1,800 +/- 1 ticks; (b) reports that express +/-200 ppm: fitted AV slope near 0; (c) negative
   control: the same fixture against a build without the limit must fail.
3. **`nearBound`:** arrival lag growing 3.5 ms/s for 10 s -> true; one 4 s stall then normal ->
   false after the window (today: true, F-5).

## 8. The harness and gate row 64 (task item 9)

A documented command is not enough as it stands: `official.sh` is in a git-ignored folder, has no
aggregate exit code (the gate would have to read 30 lines), and the harness depends on two files of
the docs tree and on a commit hash (F-14). Recommendation:

- **Row 60 absorbs it**: `fake_mic.c`, `fake_cam.c`, the analysers and `m3worker.py` move to the
  fixture folder spec A.8 names; the skeleton used as negative control is vendored.
- One entry point, e.g. `make -C apps/capture-worker e2e`, which runs the series including the
  negative controls and exits non-zero unless every verdict is the expected one; it states that it
  needs loopback binding (sandbox off) and about 15 minutes.
- Row 64 runs that target once and quotes its summary. It should stay outside `npm test`: it needs
  ports, FFmpeg and real time, and under the parallel JS suites its timing checks would be noise.
- It must be re-run after any FFmpeg upgrade (F-2 is found only there).

## 9. Hygiene (task item 10)

- `git status --porcelain --untracked-files=all | grep -icE "\.(mp4|m4a|aac|mp3|wav|mov|mkv|h264|pcm)$"` -> **0**.
- `git check-ignore`: `apps/capture-worker/build/` (`.gitignore:16`), `.cache/` (`.gitignore:47`).
- After my last run: `pgrep -fl "capture-worker|fake_cam|fake_mic|capture-session-driver|ffmpeg"` ->
  nothing (rc 1); no listener on 8555, 8557, 8559-8564; no UDP socket on 5000 / 5001 or the media
  ports. 8554 / 8556 / 8558 still belong to the three emulators, untouched.
- The timing table of the driver's section 7 holds engineering parameters of the IPC (spawn, ACK,
  heartbeat, stop). No STT throughput figure appears in `20_m3_worker_engine.md` or
  `coder_execution_row58.md` (grep for throughput / RTF / D230: 0 hits).
- Left behind by me, all git-ignored: `.cache/row58_nav/` (21 MB) and four run folders
  `.cache/m3worker/runs/navb_*`. One command of mine printed the flood log of F-2 and the session
  tooling kept a 64 MB copy of that output under `~/.claude/projects/.../tool-results/` (outside the
  repository). I ran `make clean all` and `m3worker.py build` in place, as asked:
  `apps/capture-worker/build/` was rebuilt from the same sources.

## 10. Recommendation on the decisions

| ID | Recommendation | Condition |
|---|---|---|
| D58-2 | **Accept, amended** | The sentence "a file that holds no fragment never exists" is not true today (F-3). Either fix by temp name + `link()`, or record that a 0-byte file can exist and that row 59's recovery treats it as "no fragment"; then D58-1 must say whether `OUTPUT_EXISTS` on such a file really means durable |
| D58-4 | **Accept** | none; my round-1 recommendation is withdrawn (section 5) |
| D58-5 | **Accept** | value verified against the file and against the `delay_moov` muxer. Note for row 59: the record is skipped silently when the track time base numerator is not 1 (`ingest.c:358`), and it can arrive AFTER `FIRST_DURABLE_FRAGMENT` (stall run) |
| D58-6 | **Accept for the fixture transport only** | F-4 written into the decision: by-position consumption on the host clock and "T0 = earliest arrival" must not be inherited by the device adapters |
| D58-7 | **Accept (telemetry flag, no new warning code)** | F-5: the flag as built reports network stalls and misses a wrong camera clock; rework at row 62 / 71 |
| D58-8 | **Accept** | row 59 takes F-3, the `ftruncate` on a failed write, the fsync policy and F-12 |
| D58-9 | **Accept, with a fix** | F-2 (1): rate limit and a size cap while running. 1.23 GB in 11 s next to the evidence files is not acceptable as a failure mode |

## 11. Limits of this review

- Fakes only: no real camera, no real microphone. F-4 and F-6 are measured on fixtures built to
  show them; their size on real devices is not measured.
- F-1, F-2 and the second kill-window run use scratch builds with one changed line each
  (`.cache/row58_nav/src/{slewstep,reworded,slowrecord}`); the production binary was not changed.
  F-3 and everything in section 3 not marked "scratch" is the production binary.
- Each kill check was run once, as asked. The 0-byte window was hit on the first attempt; I did not
  measure how often it is hit.
- TSan and the analyzer see the worker's code, not libav's. `pthread_exit` from inside libav's log
  callback (`ingest.c:103`) worked in my one run and in the driver's two; I cannot show it is safe on
  another libav.
- Navigator A's side (protocol package, supervisor, config, INTERNAL actions) was not reviewed. Seen
  in passing and left to that review: after a respawn that is refused, the supervisor status reads
  `durable: true, lastRecordSeq: 0`.

---
*Generated: 2026-10-09 13:30*

---

# Re-check of fix round 1 (2026-10-09, navigator B)

Reviewed: the tree after fix round 1 (driver's sections FR-1..FR-5, decision D72). Same rules as
round 1: report only, no repo file edited, scratch under `.cache/row58_nav/`. All my sessions ran
on ports **8559 / 8561** (the harness itself was run unchanged through a two-line wrapper that sets
its port pair), because the row-77 driver was running harness sessions on 8555 / 8557 during my
re-check. Load is the 1-minute average at the start of each run. `whisper-cli` was not running
during any timing-sensitive run of mine (checked before each batch); it started after my last run.

## R.1 Final verdict

| Part | Verdict | Who inherits what |
|---|---|---|
| P3 - the C worker | **ACCEPT-WITH-FINDINGS** - 0 blocker, 0 major | the four majors of round 1 are fixed and reproduce as fixed; 8 minors (R-1..R-8) go to rows 59, 60, 61, 62, 65, 71 |
| P4 - mux flags | **ACCEPT** | unchanged; AV and file shape re-measured |
| P6 - end to end | **ACCEPT-WITH-FINDINGS** | kill checks, kill window, sockets, no-camera rule all hold; harness weaknesses to row 60 |

Row 58 can close on my side. Three carried items have **no home in the rev 2.3 row text** (R.6).

## R.2 The four majors

| Round-1 finding | State | My evidence |
|---|---|---|
| F-1 slew limit | **fixed** | Same scratch build as round 1 (+200 ms on the reported wall clock from the 300th written packet, 7 s after the anchor): the file now moves **1 tick (11 us) per frame**, 511 us after 1 s, 3,000 us after 6 s - 500 us/s, no jump (round 1: 3,489 us in one frame). Sample durations: 1,800 x 329, 1,801 x 270, nothing larger. Own unit run of `anchor.c` (ASan/UBSan, not the driver's test): after 7 s quiet, max step 10 us and 5,000 us in 10 s; after **1 h** quiet and a -1 s report, max step 10 us and -30,000 us in 60 s; extreme values, no overflow |
| F-2 UDP refusal | **fixed** | Production binary, UDP-asking client: 314 `lsof` snapshots, **0 UDP, 0 off loopback**, `INGEST_TRANSPORT_REFUSED` on the 4th error report (3 lines logged), camera 2 recorded, rc 0; a normal session: 783 snapshots, same. The scenario of round 1 (the exit is never taken; driver's `norefusal` build, listen timeout 3 s, healthy camera streaming 25 s): 1,173 snapshots, 0 UDP; **log 1.29 MB** with 21,989,029 lines suppressed (round 1: 1.23 GB in 11 s); camera 1 given up alone (`CAPTURE_FAULT CAM-01`), **camera 2 kept recording to its end at 25 s** and its last fragment is in the file (965,764 B, 13 whole fragments, decode rc 0; last size seen before stop 900,739); `CRASH INGEST_THREAD_STUCK`, exit 70, 3.68 s after `STOP`. This run also exercised the give-up at listen timeout + 10 s |
| F-3 0-byte file | **fixed** | **100 kills, production binary** (54 at first sight of anything in the media folder plus 0-1.5 ms, 46 timed -12..+4 ms around the learnt instant): final name absent or whole in every case - both whole 44, one whole 29, none 27; **smallest final file 34,078 B = init + one whole fragment**; 0 violations by my box walk. 24 kills left a `.part` (4 of them 0 bytes, the rest whole). The next worker (attempt 2, same plan) after every kill: `OUTPUT_EXISTS` 73 times, accepted 27 times, exactly "a final name exists" in all 100; every file byte-identical afterwards; stale `.part` reported in 2 of 2 accepted starts that had one. Through the real supervisor: kill at first sight -> `VIDEO-01.mp4` 87,752 B whole, `VIDEO-02.mp4` **absent** (round 1: 0 bytes) |
| F-4 mics | **fixed for the cases asked** | table R.3 |

## R.3 Mic clock (D58-14), my analysis code

| Case (33 s session, 8 beeps per camera) | Driver | Mine |
|---|---|---|
| 2,000 ppm slow | audible every second; max 1.81 / 2.11 ms | no silent second (RMS 0.065-0.111 from second 6 to 37); errors **-2.10 ... -1.19 ms**, largest at the first beep, still shrinking at the end; `missing 0`; last asked 2,022 ppm; load 4.9 |
| **100 ppm slow** (the realistic case) | not run | max **1.46 ms**; the 1 ms dead band lets the error grow for about 10 s, then one correction of about 1,030 ppm; load 5.2 |
| **100 ppm fast** | not run | max **0.90 ms**; load 5.9 |
| stop at 12 s, return at 17 s | after the return within 1.22 / 1.25 ms | silence in seconds 13-16 (RMS 0.0000), heard from second 17; beeps after the return **+1.36 ms** on both files; telemetry `dbfs: null` during the gap; one restart per mic; no `WARNING` (row 71); load 11.9 |
| +80 / -80 ms, mics on the host clock | 80.0236 / -79.9764 | **+80.0307 / -79.9693** (player view), box-level round-1 code: max error 0.051 / 0.031 ms; asked 0.0 ppm for the whole run; load 6.5 |
| H-4 | holds | my box-level compare: 911 / 911, payload differing 0, timing differing 0, 0 against the encoder manifest; negative control fails 914 of 914 |
| **20,000 ppm slow** (outside the range) | not run | audible, 27,877 samples (0.58 s) of silence inserted, error -17 ... -34 ms, asked pinned at 5,000 ppm; nothing in telemetry |
| **20,000 ppm fast** (outside the range) | not run | **audio late and getting later: 101 ms at the first beep, 549 ms at the last** (15 ms/s), buffer 27,144 samples at the end, nothing dropped yet (cap 2 s), levels normal, **nothing in telemetry or frames** |
| 120 ms of samples lost at 12 s (below the 200 ms "stopped" threshold) | not run | error up to -25.9 ms right after, back inside 1.5 ms after about 7 s (the controller refills at 5,000 ppm), one overshoot of +4.0 ms |

Judgement. The 5 ms bound for the 2,000 ppm fixture is defensible as a regression bound of an
extreme case (measured 2.1 ms, the product bound is 40 ms), and the 15 ms after a return follows
from the mechanism (placement by arrival, one 10 ms chunk coarse). But both numbers exist only in
the harness; they belong in D58-14 and the test strategy. The realistic rate has no check: a
+-100 ppm case with the ordinary 2 ms bound would pass today (1.46 / 0.90 ms) and should be in the
series (row 60). Outside the range the worker neither fails nor says anything (R-3).

## R.4 New and residual findings (all minor)

| ID | Where | What | Suggested fix | Owner |
|---|---|---|---|---|
| R-1 | `anchor.c:15-17`, `ingest.c:353-354` | The allowance is counted from the last packet that **carried a report**; packets without one do not advance it. Own unit run: 600 s without a report, then +200 ms -> **one step of 200,000 us**. Not reachable with libavformat 9.0.2 (it attaches the reference time to every packet once the first sender report arrived; by inspection), so it is a hardening point. Also by my runs: the first packet after a 4 s video stall may take 1,990 us at once (per second of MEDIA, as specified), and a camera whose pts restarts below the old reference is frozen until it passes it (fail-safe) | advance the reference on every video packet | row 60 (unit test) |
| R-2 | `anchor.c:56-64` | `nearBound` is better and still not what its name says. (a) "A stall alone never sets it" holds only while stall plus catch-up is shorter than the 10 s window: a 4 s stall with a 6 s drain sets it (own unit run). (b) The lag is arrival minus camera time, so it contains encode and network delay: a camera with a correct clock and a steady 35 ms delay reads `true`; a real IP camera will probably read `true` all the time. (c) A clock that jumps ahead is seen at once, one that falls behind up to 9 s later ("one window late" confirmed: 69.0 s for a jump at 60 s). Fine as telemetry | per-camera baseline learnt at start, or a round-trip measurement | row 62 / class C |
| R-3 | `audio.c` mic controller, `FIFO_CAP` | Outside +-5,000 ppm (table R.3): a fast mic becomes late without bound up to the 2 s buffer and nothing reports it; a slow one gets gaps. The answer to "fail closed or go silent": **neither - it degrades silently** | cap the buffer near the level to hold (about 100 ms) so lateness is bounded; a telemetry field when the controller is pinned at its limit | rows 65 / 71; say it in D58-14 |
| R-4 | `ipc.c` log rate limit | The 200 lines/s are one shared quota. In the flood run the log holds 6,400 `LIBAV_MESSAGE`, 31 `log_lines_suppressed`, `worker_starting`, `session_starting` - and **none of** `INGEST_OPEN_STUCK`, `ingest_thread_abandoned`, `INGEST_THREAD_STUCK`, `camera_summary`, `worker_exit`. The incident is in the frames, not in the log | quota per source (limit only the libav lines) | row 58 nit or row 61 |
| R-5 | `sink.c:116-117` | A kill between `link()` and `unlink()` leaves the `.part` as a **second name of the evidence file** (seen: same inode for `VIDEO-01.mp4` and `VIDEO-01.mp4.<pid>.part`). It is never removed by design, and it is reported only when a later `START` is accepted (0 reports in the 73 refused starts). Sealing and recovery must know these names. By inspection: `link()` needs a file system with hard links; on a volume without them every session would end fatally | row 59 / 82 decide what recovery does with a `.part`; row 61's storage check tests `link()` on the evidence volume | rows 59, 61, 82 |
| R-6 | `ingest.c:53`, `:103` (D58-16) | Still a heuristic on log events - a count instead of a text. Measured: a normal TCP open logs 0 error lines, a listen timeout 1, the refused transport reaches 4 within microseconds. A legitimate open that reports 4 errors would be refused under the name `INGEST_TRANSPORT_REFUSED`; it fails closed for that camera only | raise the limit (the retry loop reports about 700,000 times a second, so 32 or 64 costs nothing and makes a wrong refusal much less likely) and give the event a neutral code | row 58 nit |
| R-7 | `m3worker.py` `leftovers()` | Processes are matched by program name on the whole host: two of my harness runs (`kc3`, `nocam none`) were marked FAIL only because the row-77 driver's own worker and fixtures were alive. Every real criterion passed (R.5) | match own process groups / own ports | row 60 |
| R-8 | `check.sh` | The exclusive-create rules are text matches. My plants in scratch copies: `O_TRUNC` refused; `creat(p, 0600)`, `ftruncate(fd, 0)`, `linkat(...)` and `fopen(p, mode)` with the mode in a variable all pass | accept as a tripwire and say so | row 61 (with F-10) |

Also noted, no action for row 58: every mic now passes through libswresample at all times. Spec F
still says (as a hypothesis) that a correction "never resamples the evidentiary audio"; D72(j)
ruled the opposite, so the spec sentence needs an erratum. With mics on the host clock the
controller asked for 0.0 ppm throughout and AV, H-4 and the tap alignment are unchanged; I did not
measure the frequency response of the pass-through.

## R.5 Regression of what held before

| Check | Driver (fix round) | Mine | Load |
|---|---|---|---|
| Build, static rules, unit | all hold | `make clean all`: 0 warnings; 21 planted lines refused; `anchor_test` holds and the old rule fails it; driver's `sink_kill_test` 200 kills, 0 violations (158 of them after the child had finished) | - |
| clang analyzer, 6 files | - | 0 warnings | - |
| ASan + UBSan session (camera 2 killed, 2 switches, file tap, mic 2,000 ppm slow) | - | rc 0, 0 reports | 7.3 |
| TSan session (same, mic stops and returns) | - | rc 0, 0 reports | 6.3 |
| AV zero (harness, switch + tap) | 0.032 / 0.039 ms | PASS, 0.025 ms; T0 12 us; H-4 914 / 914 | 7.9 |
| AV drift +-200 ppm (harness) | 199.78..200.03 / -200.09; max 0.033 / 0.025 | PASS, 200.03 / -200.02 ppm, max 0.028 ms | 6.8 |
| M3-KC-1 file half | PASS | PASS: `FAULTED`, durable, no respawn; 117,729 / 117,369 B before = after; my walk 2 whole fragments each; session 2 270,968 B, error 0.033 ms | 4.9 |
| M3-KC-3 | PASS | all criteria hold: `[EXITED, SIGKILL, 250]`, attempt 2, new pid, 315,049 B each, 7 fragments, decode rc 0, error 0.025 ms. Harness verdict FAIL for R-7 only | 4.8 |
| Kill in the window, real supervisor, production binary | - | `FAULTED`, no respawn, SHA unchanged, no partial file | 11.2 |
| Same with the record held back (scratch build) | `neg_kc1` | respawn after 250 ms, **attempt 2 refuses `OUTPUT_EXISTS`**, `FAULTED`; both files 83,588 B, SHA identical before, 6 s later and after stop | 9.7 |
| `kill -9` mid-session / SIGTERM | - | 4 whole fragments, SHA stable, decode rc 0 / rc 0, files closed with their last fragment | 5.9 / 8.1 |
| D72(k) no camera | exit 70, 4.22 / 4.20 s | exit 70, `CRASH NO_CAMERA_CONNECTED`, no file, no `.part`, **4.37 s**; harness verdict FAIL for R-7 only | 12.6 |
| D72(k) one camera | PASS | PASS: file 1 169,133 B, 5 fragments, decode rc 0; no file 2; `CAPTURE_FAULT CAM-02`; exit 0 | 14.5 (not timing-sensitive) |
| Framing | - | 11 cases as round 1; now also refused: a NUL inside a line, `"v":2.9`; `"v":1e999` no longer trips UBSan (F-9 fixed) | - |
| Timing | HELLO 18.3-471.6, ACK 0.12-2.7, heartbeat 489.2-511.1, switch 2.1-7.9, STOP 4.6-15.6 ms | HELLO 20.1-21.9, ACK 0.48-1.9, heartbeat 494.8-505.5, switch 5.3-9.0, STOP 11.4-13.1 ms | 4-8 |

Unexercised paths of the driver's list: **restarted worker and an existing tap file** - run: attempt 1
`TAP_PATH_OCCUPIED`; attempt 2 accepted, `pcm_tap_left_alone`, `tapActive false` in all 157
telemetry frames, tap file SHA unchanged, both camera files recorded. **Named-pipe tap** - run:
complete with `cat` (929,760 samples = `samples_in`, onset difference 0, `tapActive true`); with a
reader that stops after 2 s the tap ends at 100,352 samples and `tapActive` goes true -> false.
**Give-up at listen timeout + 10 s** - exercised in the `norefusal` run above. Still unexercised: a
`CLEARED` written by the real worker (it writes none).

## R.6 Round-1 minors

| Finding | Driver says | Confirmed |
|---|---|---|
| F-5 `nearBound` | reworked | yes, with R-2: false after the 4 s stall of the fixture kind, true for a clock +-80 ms or +-10 s off |
| F-8 | fixed | `dropped_no_pts: 1` per camera in every summary |
| F-9 | fixed | framing cases above |
| F-11 | fixed | `capture_worker.c` main loop calls `sockets_violation` once a second (read; not provoked) |
| F-13 | fixed | lists clamped, watchdog started in `main` (read; not provoked) |
| F-10 -> row 61 | carried | **has a home**: row 61 text names the concatenation-proof rule and the `-PROOF` refusal |
| F-14 -> row 60 | carried | **has a home**: one target, aggregate exit code, no docs-tree dependency |
| F-12 -> row 59 | carried | home in substance: row 59 emits `FRAGMENT_CHECKPOINT` records; the final-telemetry point itself is not named |
| **F-6 -> row 62** | carried | **fell through**: row 62's text has the drifting-clock camera only; nothing about a sanity bound on the camera wall clock |
| **F-7 -> rows 76 / 77** | carried | **fell through**: row 77's text states the tap's time origin only; neither row says what the transcriber does when the pipe tap ends (`tapActive false`), and row 76 does not mention the tap |
| **F-2 (4) version pin -> row 61** | not mentioned | **fell through**; partly covered by row 60's "re-run after any FFmpeg upgrade" |

## R.7 Recommendation on the decisions

| ID | Recommendation | Condition |
|---|---|---|
| D58-14 (libswresample, +-5,000 ppm, 200 ms learn, 1 ms dead band, gap 200 ms) | **Accept** | write the two bounds (5 ms at 2,000 ppm, 15 ms after a return) and the measured +-100 ppm figures into the decision; add the +-100 ppm case at row 60; R-3 to rows 65 / 71; erratum for the spec F sentence on resampling |
| D58-15 (restarted worker leaves an existing tap file and records without a tap) | **Accept the mechanism** | verified as written. What it means for transcription of that session is navigator A's judgement; from my side only: `tapActive` is the one signal, and nothing in rows 76 / 77 reads it yet |
| D58-16 (refusal on the 4th error-level report during one open) | **Accept** | it is a heuristic on log events, honestly described; raise the limit and rename the code (R-6), limit the log per source (R-4). The socket guarantee does not depend on it: `protocol_whitelist=tcp` plus the once-a-second socket check |

## R.8 Hygiene and limits

- `git status --porcelain --untracked-files=all` filtered for media, `.part` and tap files: **0**.
  `apps/capture-worker/build/` and `.cache/` are ignored.
- After my last run: no process of mine, no listener on 8559-8564, no UDP socket on 5000 / 5001 or
  the media ports. The capture processes alive on the host at that moment were the row-77 driver's
  (8555 / 8557), with `whisper-cli` just started. My runs on 8559 / 8561 overlapped that driver's
  waiting loop and at least two of its sessions: if its M6-DF-1 run requires a host with no other
  capture session, the runs it made between about 14:50 and 15:01 were not alone.
- Scratch builds with one changed line each: `slewstep`, `slowrecord` (`.cache/row58_nav/src/`);
  the `norefusal` build is the driver's proof target. Everything else is the production binary.
- Kill loop: one run of 100, as asked; kill checks once each. F-11 and F-13 confirmed by reading.
- Left behind, git-ignored: `.cache/row58_nav/` (50 MB), `.cache/m3worker/runs/navb2_*`.

*Re-check written: 2026-10-09 15:05*
