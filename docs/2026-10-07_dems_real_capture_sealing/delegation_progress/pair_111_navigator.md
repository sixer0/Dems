---
task_id: 2026-10-07_dems_real_capture_sealing
row: 111
role: navigator (verifier, independent of the driver)
date: 2026-10-09
tier: 2
status: complete
verdict: ACCEPT-WITH-FINDINGS
reviewed: apps/capture-worker/src/capture_worker.c, apps/capture-worker/Makefile, implementation/59_m3_worker_proofs.md, implementation/evidence/59_m3proof/
---

# Row 111 - navigator review of the capture-worker skeleton and the H-4 / H-10 proofs

## 0. Verdict

**ACCEPT-WITH-FINDINGS.** Both row-111 proofs reproduce on my own runs and with my own analysis code
(no code shared with `m3proof.py`): H-4 audio is byte-identical in both files and comes from one
encoder; H-10 offsets are sample-exact, correctly signed, and the drift is reported. The negative
controls fail as required. No blocker for row 111.

Row 58 must not start from the skeleton as it is. Five major findings are carried forward
(N-1..N-5), two of them are the driver's own open points, for which the recommendation in sections 5
and 6 differs from the driver's.

| Sev | Id | Finding | Belongs to |
|---|---|---|---|
| major | N-1 | A client that asks for RTP over UDP makes the worker open UDP sockets on `*:5000` / `*:5001` (all interfaces). `rtsp_transport=tcp` does not prevent it. The bind check looks only at TCP LISTEN on two ports and cannot see it | row 58, check `M3-RTSP-BIND-1`, SEC35-23 |
| major | N-2 | Nothing reaches the disk during a session: both files stay at 28 bytes until close (S1 trap 4, `flush_packets`, is missing). After a camera stops, that file's audio is never cut into a fragment again (801 packets = 17.1 s in one final fragment) | row 58 ("two growing playable files"), AU2-08 crash-loss window |
| major | N-3 | Drift (driver 6.1): "re-anchor on later sender reports" cannot be tested with this fixture, and corrects drift only under an assumption about the camera that nobody has measured | row 58 decision, row 62 fixture |
| major | N-4 | First video sample (driver 6.2): reproduced; it is deliberate FFmpeg behaviour; the hold lasts until the first keyframe, so up to one GOP (10 s with the AU2-08 long-GOP camera). Three "obvious" flag fixes destroy AV alignment by 446-454 ms | row 58 decision |
| major | N-5 | A fatal error in the middle of a session exits with rc 0 (`fatal()` never sets `rc`; by inspection, not reproduced) | row 57/58 supervisor |
| minor | N-6..N-14 | see section 4 | rows 58, 62 |

## 1. What I ran

Host: `uptime` 7.69 at start, between 5.2 and 15.8 during the runs (I waited once at 15.8).
FFmpeg 9.0.2 (`ffmpeg -version | head -1`), libavformat 63.1.102 (`otool -L`). Worker rebuilt from
the reviewed source: `make -C apps/capture-worker clean all` -> `AU2-07 static rule: OK`, clang
`-Wall -Wextra -Werror` clean. Evidence copies of `m3proof.py` and `fake_cam.c` are byte-identical
to the harness copies (`diff -q`).

Port binding fails in the Bash sandbox (`[rtsp] Unable to open RTSP for listening`, EPERM), so the
capture runs used the sandbox-off retry, on ports 8555 and 8557 only.

My scratch (git-ignored, `.gitignore:47`), all under `.cache/spikes/m3proof_nav/`:

| File | Role |
|---|---|
| `nav_check.py` | my own fMP4 box parser (moov/trex/tfhd/tfdt/trun, no FFmpeg), box-level H-4, H-10 by template fit, player-view check |
| `nav_run.py` | my own runner (worker + the driver's `fake_cam` binary), with camera kill, SIGTERM, selector switch, size sampling |
| `nav_break.sh`, `nav_udp.sh` | break attempts against the listeners |
| `worker_variant.c` -> `bin/worker_variant` | scratch **copy** of the worker with the mux flags, mux options and ingest options taken from the environment, plus a per-keyframe log of arrival time, pts and `AV_PKT_DATA_PRFT`. The driver's file was not edited |
| `src_ref/` | `rtpdec.c`, `rtpenc.c`, `rtsp.c`, `rtspdec.c`, `movenc.c` from FFmpeg **master** (fetched 2026-10-09 from raw.githubusercontent.com). Not the 9.0.2 tag: line numbers are for orientation, every behaviour quoted from them was also observed on 9.0.2 here |
| `runs/`, `results/` | media, logs, analyser output |

## 2. Re-run numbers beside the driver's

Driver runs: `.cache/spikes/m3proof/runs/h4_*`, `h10_*`. Mine: `.cache/spikes/m3proof/runs/nav_*`
(1 run each, as instructed). Columns "harness" = `m3proof.py` on my runs; "own" = `nav_check.py`.

### 2.1 H-4

| Quantity | Driver (run 1 / run 2) | Mine, harness | Mine, own method |
|---|---|---|---|
| Audio packets cam1 / cam2 | 962 / 962 | 962 / 962 | 962 / 962 (box parser) |
| Packets differing, any field / payload | 0 / 0 | 0 / 0 | 0 payload, 0 timing-or-size |
| Mismatches vs encoder manifest | 0 / 0 | 0 / 0 | 0 / 0 (SHA-256 of bytes cut out of `mdat` by my parser vs `manifest.jsonl`) |
| Payload bytes | 15,755 / 15,981 | 18,603 | 18,603 |
| `ffprobe` packet list (pts,dts,duration,size,sha256), `shasum` | - | - | cam1 `28fc80ea8ce3c818...`, cam2 `28fc80ea8ce3c818...`; `diff` 0 lines |
| `ffmpeg -c copy -f adts` of both files, `cmp` | - | - | identical, 25,337 bytes |
| `ffmpeg -v error -xerror -i <f> -map 0 -f null -` | rc 0, 0 lines | rc 0, 0 lines | rc 0 for both; `nb_read_frames` 600 video / 962 audio in both |
| Boxes | 1 ftyp, 1 moov, 12 moof, 12 mdat, 1 mfra | same | same, tiling exact |
| Verdict | PASS | PASS (rc 0) | IDENTICAL (rc 0) |
| Negative, two encoders 480 samples apart | 42 differ (41 payloads), FAIL as required | 35 differ (34 payloads), first at 66; `--expect-fail` rc 0, plain rc 1 | 34 payloads + 32 timing differ; cam2 vs encoder-0 manifest 34 mismatches, vs encoder-1 manifest 0; ADTS `cmp` differs at byte 746; rc 1 |

The difference 42 vs 35 is the beep phase of the run, not a discrepancy. The `skew0` control (same
grid, fails on the encoder count only) was not re-run; see N-9.

H-4 also held on every other run I made: `nav_zero`, `nav_pm80`, `nav_drift` (harness rc 0), after a
selector switch (`t4_switch`), after SIGTERM (`t3_sigterm`, 271 / 271), with one camera killed
(`t2_killcam2`, 962 / 962) and with `delay_moov` (`v2_delay`).

**One encoder, by code review.** `main` opens `n_enc` encoders (`capture_worker.c:531`), `n_enc` is
1 unless the proof-only flag is given (`:508`); `fanout` (`:162-190`) hashes the encoder packet for
the manifest (`:163-174`) and then, for each camera, `av_packet_clone`s that same packet (`:179`),
rescales only the timestamps (`:182`) and writes it under the camera's mutex (`:183-185`). There is
no second encode path. Confirmed.

### 2.2 H-10

Offsets in ms, `beep - flash`, positive = audio late.

| Case | File | Driver run 1 / run 2 | Mine, harness | Mine, own method |
|---|---|---|---|---|
| zero | cam1, cam2 | 0.0194 / 0.0208 | 0.0042 x3 (both files) | cam1 0.0042 (max err 0.0042) |
| +80 | cam1 | 80.0194 / 80.0208 | 80.0014 x3, sign + | 80.0014 x3, err +0.0014 |
| -80 | cam2 | -79.9806 / -79.9792 | -79.9986 x3, sign - | -79.9986 x3, err +0.0014 |
| +200 ppm | cam1 | 0.4153 ... 6.0194; fit +200.02 / +199.78 ppm | 0.4167, 1.2083, 2.0, 2.8125, 3.6042, 4.4167, 5.2083, 6.0; fit 199.78 ppm; max err 0.0167 | same eight values; max err 0.0167 |
| -200 ppm | cam2 | -0.7931 ... -6.3972; fit -200.02 / -200.09 ppm | -0.7917 ... -6.3958; fit -200.09 ppm; max err 0.0167 | same eight values; max err 0.0167 |
| Regression bound 2 ms | all | PASS | PASS (rc 0) | PASS (rc 0) |
| Product bound 40 ms | +/-80 | exceeded | EXCEEDED | - |

Own method (`nav_check.py h10`): video time of the flash frame = `tfdt` + summed `trun` durations
from my box parser (cross-checked against `ffmpeg -vf showinfo` `pts_time`: equal to 1 us on every
event); audio time = first audio `tfdt` + the lag that maximises the correlation of the decoded PCM
with a 100 ms 1 kHz cosine burst (fit 0.999-1.000), not a threshold. Expected value computed from the
case definition, not read from `truth.json`. The sub-sample residual differs run to run (0.0014 to
0.0208 ms) because the beep starts on the first sample at or after the instant; it is always under
one sample (20.8 us).

### 2.3 Gap check

| Quantity | Driver | Mine |
|---|---|---|
| Decoded - input, zero and +/-80 files | 1,088 | 1,088 |
| Decoded - input, drift files | 1,600 | 1,600 |
| Spacing errors | all 0 | all 0 (5 and 15 spacings) |
| Negative: intact re-encode | 64, spacing 0, PASS | 64, spacing 0, PASS |
| Negative: 1,000 samples removed | -936, spacing `[0,-1000,0,0,0]`, FAIL | -936, `[0,-1000,0,0,0]`, FAIL; packet grid `[1024]` on both copies |

## 3. Can each check fail? (report section 0 rule 3)

| Check | Can it fail | Evidence |
|---|---|---|
| H-4 equality | yes | two-encoder control fails in the harness, in my parser, in `ffprobe`+`diff` and in ADTS `cmp` |
| H-4 "one encoder" | only through the worker's self-reported encoder count (`m3proof.py:251`, `end["encoders"]`) plus code review. Byte equality alone cannot tell (driver's `skew0` control). Acceptable, stated by the driver | section 2.1, N-9 |
| H-10 offset | yes, and for a real mechanism, not only for an injected number: three scratch mux variants read **446.58 / 454.35 / 452.52 ms** where +80 / -80 was expected (section 6) | `nav_check.py player .cache/spikes/m3proof_nav/runs/v3_editlist 80 -80` etc. |
| H-10 independence | the measured value comes from the decoded media (frame brightness, PCM), the truth from the case definition; my second implementation agrees to the last printed digit | section 2.2 |
| Gap | yes | 1,000-sample cut fails |
| Bind check | **no** for anything that is not a TCP listener on 8555/8557 | N-1 |
| AU2-07 static rule | yes: a second call site makes `make check` exit 2 (`AU2-07: expected 1 ... found 2`, tried on a scratch copy) | N-10 for what it does not cover |

**"Separate process with its own clock" - is it honest?** As a process: yes (own pid, own
`clock_gettime`). As a clock: it is a model, and the driver says so (59 section 4.2 limits a, c).
What I add:

1. The camera's rate error reaches the worker **only** through real arrival timing, which the worker
   ignores by design. The sender reports cannot carry it: `rtpenc.c:325` derives the SR's RTP
   timestamp linearly from the host's NTP time. Measured on a +/-200 ppm run with my variant
   (`t1_drift_vlog`): `PRFT wallclock - pts` stayed constant within 1 us over 31 s on both cameras,
   `start_time_realtime` never changed. So the reported "+200 ppm" is the harness's beep schedule
   passing through the worker's arithmetic, the encoder and the muxer. That is a valid test of the
   timestamp path and an invalid test of anything that depends on a second oscillator.
2. The audio side has no independent source at all. `mic_fill` lives inside the worker
   (`capture_worker.c:142`) and places the beep from the same `t0_real` (`:269-272`) that the video
   shift uses (`:373`). An error in T0, or any real capture latency, cancels on both sides and
   cannot be seen. Gate row 64 (`M3-AV-2`) inherits this unless row 58 feeds the mics from outside
   the worker process (N-8).

## 4. Findings

### N-1 (major) - UDP sockets on all interfaces when the client asks for UDP

- Where: `capture_worker.c:330-335` (listen options: only `rtsp_flags`, `listen_timeout`);
  harness `m3proof.py:36-38` and `:100-104` (TCP LISTEN on the two ports only).
- Evidence (`bash .cache/spikes/m3proof_nav/nav_break.sh`, T5; pusher `ffmpeg ... -f rtsp
  -rtsp_transport udp rtsp://127.0.0.1:8555/cam1`), `lsof -nP -a -p <worker pid> -i`:
  ```
  capture-w 74171 gsp-budi 4u IPv4 ... UDP *:5000
  capture-w 74171 gsp-budi 6u IPv4 ... TCP 127.0.0.1:8555->127.0.0.1:59412 (ESTABLISHED)
  capture-w 74171 gsp-budi 7u IPv4 ... UDP *:5001
  worker rc=0   (125 video packets written from the UDP source)
  ```
- The obvious fix does not work: with the ingest option `rtsp_transport=tcp` on the scratch variant
  (`nav_udp.sh "rtsp_transport=tcp"`) the same two `UDP *:5000` / `*:5001` sockets appear and the
  session records. Source agrees: `rtspdec.c:276-286` accepts UDP or TCP from the client,
  `:330` opens `rtp://<host>:<localport>` with `buffer_size` as the only option, so no local
  address.
- Why it matters: SEC35-23 and the row text ("all listeners on 127.0.0.1"). The proof runs
  themselves were clean (TCP clients; `sockets_at_listen.txt` shows only `127.0.0.1:8555` and
  `127.0.0.1:8557`), so row 111 is met. The worker does not enforce it and the check cannot fail on
  it. An open UDP port accepts RTP from the LAN.
- Recommendation for row 58: (1) refuse a non-interleaved session in the worker (no option exists;
  e.g. after `avformat_open_input`, fail if the process owns any datagram socket, or keep listen
  ingest for fixtures only and use pull with `rtsp_transport=tcp` for cameras); (2) widen
  `M3-RTSP-BIND-1` to `lsof -nP -a -p <pid> -i` = every socket of the worker is on `127.0.0.1`,
  with a UDP-requesting client as the negative control.

### N-2 (major) - nothing is written during a session; audio-only starvation after camera loss

- Where: `capture_worker.c:451-455` (no `flush_packets`, no `avio_flush`), `:184`, `:389`.
- Evidence (`python3 .cache/spikes/m3proof_nav/nav_run.py t2_killcam2 --kill-cam2-at 4 --sizes`,
  driver's binary): file sizes sampled every 0.5 s were `28, 28` (the `ftyp`) from 1.2 s to 20.3 s;
  final sizes 52,837 and 33,055 appear only at close. With the mux option `flush_packets=1` on the
  variant (`u2_flush`) the files grow every second: `1231, 5131, 9725, 13104, ...`.
  The 28 bytes are explained by the 256 KB write buffer of the file protocol (`file.c:327`,
  FFmpeg master) and were observed on 9.0.2.
- Second effect, same run: camera 2 was killed at 4.18 s. Its file ends with one fragment holding
  9 video samples and **801 audio packets (17.1 s)**; samples per `moof` for audio: `67, 47, 47,
  801`. With `flush_packets=1` the size freezes for the last 8 s after video ends (44,112 from
  12.5 s to 20.5 s). `frag_keyframe` cuts only on a video keyframe, so a stalled camera stops the
  audio of its own file from ever becoming durable.
- Why it matters: S1 trap 4 (`05_capture_architecture_spec.md:179-180`), row 58's "two growing
  playable files", and the AU2-08 crash-loss window, which today is the whole session. Not a
  row-111 criterion.
- Recommendation for row 58: set `flush_packets=1` (verified above) and add a bounded cut when no
  keyframe arrives (hypothesis, not tested here: `frag_duration` as an upper bound above the GOP,
  or a timed `av_write_frame(ctx, NULL)`); add a "camera stops, audio keeps landing on disk" case
  to the fixtures.

### N-3 (major) - drift: see section 5.

### N-4 (major) - first video sample: see section 6.

### N-5 (major, by inspection) - fatal error mid-session exits 0

- Where: `fatal()` sets `g_stop` and `g_stop_ingest` only (`capture_worker.c:128-133`); `main`
  then applies `rc = w->samples_in ? 0 : 1` (`:540`). A mux write failure (`:187`, `:391`), an
  encoder failure (`:194`, `:199`) or a failed selector command (`:215`) after the first quantum
  therefore ends with `worker_exit rc 0`, the same code as a clean SIGTERM stop (`t3_sigterm`:
  `stopped_early:true`, rc 0).
- Not reproduced (it needs a write failure); stated from the code path.
- Recommendation: a sticky error flag set by `fatal()` that forces a non-zero rc.

### Minor

| Id | Where | Finding | Evidence |
|---|---|---|---|
| N-6 | `capture_worker.c:336-338` | Every failed `avformat_open_input` is logged as `ingest_option_not_consumed`, because the option dictionary is still full when the open fails | EPERM in the sandbox: `"message":"ingest_option_not_consumed","av_error":"Operation not permitted"`; T6 `"Operation timed out"`; T8 `"Protocol not found"` and `"Immediate exit requested"` |
| N-7 | `:166`, `:232`, `:264-265`, `:288`, `:333`, `:347`, `:428` (allocations); `:517`, `:537-538` (`pthread_create`); `:488` (`fopen` for `--log`); `:93` with `:131`, `:250`, `:282`, `:406` | Unchecked returns (null dereference only on out-of-memory; a failed `pthread_create` at `:538` leads to `pthread_join` on an uninitialised id). `g_stop` is `volatile sig_atomic_t` but written and read by several threads; it should be atomic like `g_stop_ingest`. Buffer handling is otherwise sound (`snprintf` everywhere, `hex[65]`, `line[64]` with `fgets`, bounded beep list) | code reading |
| N-8 | `capture_worker.c:142`, `:269-272`, `:373` | H-10 audio is synthesised inside the worker from the same T0 as the video shift (section 3 item 2). Disclosed in part by the driver. Row 58's fake mics must be a separate process timed by its own wall-clock reads, or `M3-AV-2` cannot detect a capture-latency or T0 error | code reading; `t1_drift_vlog` |
| N-9 | `m3proof.py:251`; 59 section 3.2 | Only 34 of 962 audio packets differ in the skewed control (928 are the silence frame), and "one encoder" rests on the worker's own count. Disclosed by the driver. A continuous signal on the active mic would make the equality test bite on every packet | my `nav_h4_neg`: 34 payloads differ |
| N-10 | `Makefile:25-28` | The static rule counts one symbol. It does not see `avfilter_graph_queue_command`, `avfilter_process_command`, `av_opt_set` on a filter, or `av_buffersrc_*` / `av_buffersink_*` from another thread. Today all graph calls are in `filter_build`, `filter_drain`, `filter_main` (`:232-319`), confirmed by `grep`. Row 58 should keep the graph pointer private to the filtering thread's translation unit | `grep -n "avfilter_\|av_buffersrc\|av_buffersink"` |
| N-11 | `capture_worker.c:324-339` | Single-shot listener: any local process that connects first ends the session (garbage bytes -> worker rc 1 after 1 s) or becomes "the camera". By design for S1 G-1; the supervisor's restart policy and the fixture ordering must account for it | T8 |
| N-12 | pinned flags, `capture_worker.c:453` | File time 0 is T0 minus 21.333 ms: the 1,024 priming samples are presented (no edit list) and the muxer shifts both tracks by the same amount. AV offset is unaffected. Anything that maps file time to host time (PCM tap, STT timestamps, R-8) must add 1024/48000 s | manifest onset sample 68,799 decodes at sample 69,823; harness `abs_position_error_samples` = 1024 on every beep; decoded - input = 1,088 |
| N-13 | `m3proof.py:271` | The analyser pairs each flash with the nearest beep. Events of the two cameras alternate every 2 s, so an error near or above 1 s would be paired with the other camera's beep and under-reported | code reading |
| N-14 | `capture_worker.c:364-366` | `--anchor-arrival-fallback` remains untested (in my T5 run the anchor mode was still `rtcp_sr`). Disclosed by the driver | T5 log |

Confirmed good: URL rule (`:415-423`) refuses `0.0.0.0`, `localhost`, port 9000, trailing slash,
credentials, no path, `127.0.0.1.evil.test`, `8555x`, `[::]` (rc 2 each) and equal ports;
one-camera-only start exits rc 1 after 3 s with no output file and no listener left; SIGTERM gives
two decodable, identical-audio files; a selector switch through stdin is applied on the filtering
thread at a quantum boundary (`applied_before_sample:203040` = 423 x 480) with no abort.

**AU2-07 review.** `avfilter_graph_send_command` has one call site (`:214`) inside
`filter_apply_commands` (`:205`), whose only caller is the filtering loop (`:286`). The guard
(`:206`) compares against `filter_tid`, written by the filtering thread itself (`:259`); any other
thread would see either zero or the filter thread's id and abort. The control thread stores
`want_map` and `g_stop` only (`:405-406`). Confirmed.

## 5. Recommendation 4(a) - drift

**Reproduced.** Uncorrected: +/-200 ppm gives 2.0 ms at 10 s and 6.0 / -6.4 ms at 30-32 s
(section 2.2), i.e. 40 ms after 200 s.

**The driver's proposal** is "re-anchor on later RTCP sender reports, with this fixture's drift case
as the regression test (expected slope near 0)". Three facts stand against adopting it as worded:

| Fact | Evidence |
|---|---|
| This fixture's sender reports carry no rate information, so that regression test could never show a slope near 0, however good the implementation | `rtpenc.c:325` (`rtp_ts` computed from `ntp_time - first_rtcp_ntp_time`); measured: `PRFT - pts` constant within 1 us across 31 s at +/-200 ppm (`t1_drift_vlog`); the driver's own drift runs received a report every 5 s and still show the full 200 ppm |
| libavformat does not fold later reports into `pts` for a single-stream (video-only) session, but it does hand over the latest report per packet as `AV_PKT_DATA_PRFT` side data | `rtpdec.c:652` (`nb_streams > 1` condition), `:645-647` and `:597-612` (PRFT); observed on 9.0.2: `prft_us` present on every keyframe and equal to `start_time_realtime + pts` |
| A sender report can only correct drift if the camera's wall clock is disciplined (NTP against the Core) while its media clock free-runs. If the camera's wall clock free-runs too, no report helps | reasoning; real cameras are class C-9 / H-7, not measured (hypothesis) |

What the fixture **can** express is arrival timing: on the same run, `arrival - PRFT` moved from
22.19 to 30.35 ms on camera 1 and from 22.19 to 14.64 ms on camera 2, least-squares slope **+165
and -217 ppm** against a true +/-200, with residuals up to 7.5 ms on this loaded host. So an
arrival-based estimate is possible but needs windows far longer than 30 s and cannot meet a 2 ms
regression bound here.

**Recommendation for row 58.**

1. Anchor each video packet on its PRFT wall clock (the ready-made hook) instead of
   `start_time_realtime + pts`, with a slew limit and a monotonic-dts guard. It is identical today
   and follows later reports automatically. Record as an explicit assumption that this bounds drift
   only for a camera whose wall clock is disciplined against the Core (H-7 becomes a correctness
   dependency, as the driver already notes for the start offset).
2. Keep the existing drift case with its present expectation (slope equals the injected value
   within 2 ms): it stays a valid test of the timestamp path. Add a **new** fixture case in row 62
   whose sender reports pair a true wall clock with a drifting media clock (this needs hand-written
   RTCP or a different sender; `rtpenc` cannot do it). Only that case may expect a slope near 0.
3. In row 58 emit the `arrival - PRFT` trend as telemetry and warn before the product bound; do not
   correct from it yet.
4. Long-session drift stays class C-9. Note for the plan (hypothesis, not measured): with real
   devices the microphone's sample clock is a third oscillator. The skeleton paces the fake mics
   from the host's monotonic clock (`capture_worker.c:284`), so that term is invisible today. Any
   correction should move video timestamps only and never resample the evidentiary audio.

## 6. Recommendation 4(b) - first video sample

**Reproduced** at box level and in `ffprobe` (`nav_check.py boxes`, `nav_check.py player`), run
`nav_pm80`:

```
cam1 track 1 vide: frags (moof#, tfdt, n) [(1, 0, 50), (2, 123718, 50), ...]
                   first samples (dts, cts, dur, sync) [(0, 0, 35518, 1), (35518, 0, 1800, 0), ...]
cam2 track 1 vide: first samples [(0, 0, 49918, 1), (49918, 0, 1800, 0), ...]
ffprobe first video packets (pts,dts,duration), run v0_base: 0,0,35151 / 35151,35151,1800 / ...
```

The first keyframe is placed at 0 and stretched (0.395 s and 0.555 s here) instead of starting at
33,718 and 48,118 ticks. Every later sample is exact.

**Cause.** Deliberate in FFmpeg: `movenc.c:7416-7423` - "Not using edit lists and shifting the first
track to start from zero ... move the timestamp for this first sample to 0, increasing its duration
instead". With `empty_moov` and no `delay_moov` the muxer disables edit lists (`:8343-8354`) and
selects make-zero (`:8364-8366`).

**Size of the effect.** The hold lasts from T0 to the first keyframe after T0, so it is bounded by
the GOP, not by 0.4 s: up to 2 s at the S1 anchor and up to 10 s with the AU2-08 long-GOP camera
(`-g 250`). During the hold a frame is shown before it was captured.

**What the spec pins.** `05_capture_architecture_spec.md:373` pins `frag_keyframe` (+
`min_frag_duration`), `:180` records the `empty_moov` behaviour (G-2), `:427` quotes
`default_base_moof` / `empty_moov`, `:451` recommends `+skip_trailer` (not set in the skeleton,
`capture_worker.c:453`). Nothing pins edit-list or negative-timestamp handling.

**Options tested** (scratch variant, cameras injected +80 / -80 ms, expected offsets +80 / -80):

| Variant | First video packet (pts, duration) | Edit lists | Offsets cam1 / cam2 (ms) | Result |
|---|---|---|---|---|
| pinned flags (`v0_base`) | 0, 35151 | none | 80.0163 / -79.9837 | first sample held |
| `+frag_discont` (`v1_discont`) | 0, 34950 | none | 80.0003 / -79.9997 | no change |
| `delay_moov` instead of `empty_moov` (`v2_delay`) | **31359, 1800** | video: empty edit then media; audio: media_time 1024 | 80.0045 / -79.9955 | **fixed**; priming trimmed (decoded 984,064 = input + 64); audio still identical in both files; decode rc 0 |
| pinned + `use_editlist=1` (`v3_editlist`) | 0, 1800 | none ("No meaningful edit list will be written") | **446.58 / 446.58** | whole video track shifted - broken |
| pinned + `negative_cts_offsets` (`v4_negcts`) | 0, 1800 | none | **454.35 / 454.35** | broken |
| pinned + `avoid_negative_ts=disabled` (`v5_avoidneg`) | 0, 1800 | none | **452.52 / 452.52** | broken |

"Start the file on a keyframe with an aligned first dts" is not available: the one audio track is
shared and the two cameras have different keyframe phases (160 ms apart in the +/-80 run), so at
most one file could start aligned.

**Recommendation for row 58.**

1. Prefer `+frag_keyframe+delay_moov+default_base_moof`. It is the only tested variant that times
   the first sample correctly, and it also removes N-12. Before adopting, re-check what S1 measured
   under `empty_moov`: the file is 0 bytes until the first fragment is cut (`u3_delay_flush`: size
   0 at 1.4 s, then growing), the `moov` now depends on the first fragment, edit lists are present
   (readers must honour them), and the fragment hash chain and the tail validation (AU2-08) must be
   re-run on the new shape. A camera that never sends a keyframe leaves no `moov` until close.
2. If S1's shape must stay: keep the pinned flags, document the held first frame as known muxer
   behaviour, store the true first video pts per file in the manifest (the worker already logs it:
   `video_started.first_pts`), and exclude the first sample from AV checks.
3. Whatever is chosen, forbid `use_editlist=1`, `negative_cts_offsets` and
   `avoid_negative_ts=disabled` together with `empty_moov` in the worker (a static rule beside
   AU2-07), and keep one of them as a negative control for `M3-AV-1/2`: they shift the video by
   about 450 ms and still decode with rc 0.

## 7. Hygiene

| Check | Result |
|---|---|
| `git status --porcelain --untracked-files=all \| grep -icE "\.(mp4\|m4a\|aac\|mp3\|wav\|mov\|mkv\|h264)$"` | `0` |
| Build dir ignored | `git check-ignore -v apps/capture-worker/build/capture-worker` -> `.gitignore:16:build/` |
| Scratch ignored | `.gitignore:47:.cache/` for `.cache/spikes/m3proof/` and `.cache/spikes/m3proof_nav/` |
| Listeners after the last run | `lsof -nP -iTCP -sTCP:LISTEN \| grep -E ":85(55\|57) "` -> empty; `lsof -nP -iUDP \| grep -E "capture\|worker_va\|fake_cam"` -> empty |
| Processes after the last run | `pgrep -fl "capture-worker\|worker_variant\|fake_cam"` -> empty (run outside the sandbox at the end of each capture batch; inside the sandbox `pgrep` cannot list processes) |
| Other ports | 8554 / 8556 / 8558 still held by the three `qemu-syst` processes, untouched; no other port used |
| Driver files | not edited; nothing committed |

Untracked by design and waiting for the controller's commit decision: `apps/capture-worker/`
(sources only), `implementation/59_m3_worker_proofs.md`, `implementation/evidence/59_m3proof/` (text
only), the two `delegation_progress` files of this row.

## 8. Not done

- The `skew0` negative control and the driver's second runs were not repeated (1 run each was the
  instruction; the +1 belongs to gate row 64).
- N-5 was not reproduced with a real write failure.
- FFmpeg source quotes are from master, not from the 9.0.2 tag.
- `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md` and
  `implementation/99_implementation_report.md` were not edited (parallel run, shared files).

---
*Generated: 2026-10-09 10:20*
