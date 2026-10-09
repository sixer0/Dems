---
task_id: 2026-10-07_dems_real_capture_sealing
row: 111
milestone: M3 (wave B, proof-first)
date: 2026-10-09
agent: coder-execution (driver; navigator re-runs independently, D63)
tier: 2
status: needs-review
source_row: identification/02_structured.md:274
---

# Row 111 - capture-worker skeleton and the two first proofs (H-4, H-10)

Status: **both proofs pass, 2 runs each, every negative control fails as required.** Two findings
need a controller decision before row 58 (section 6): the skeleton does not bound clock drift, and
the pinned fMP4 flags mis-time the first video sample of each file.

## 0. Summary

| Item | Result | Evidence |
|---|---|---|
| Worker form (Q-WORKER (a), D24) | one C file, 563 lines, clang + make, links the installed FFmpeg 9.0.2; 0 npm changes | `apps/capture-worker/src/capture_worker.c`, `apps/capture-worker/Makefile` |
| H-4 one encoder, both files | run 1 and run 2: 962 / 962 audio packets, 0 differing in any field, 0 payload mismatches against the encoder's own manifest, both files decode with rc 0 and 0 error lines | section 3 |
| H-4 negative controls | two encoders 480 samples apart: 41 payloads differ, check FAILS; two encoders on the same grid: bytes identical, check FAILS on encoder count only | section 3.2 |
| H-10 zero injection | +0.0194 ms (run 1), +0.0208 ms (run 2), both files | section 4 |
| H-10 +80 / -80 ms | +80.0194 / -79.9806 ms (run 1), +80.0208 / -79.9792 ms (run 2); signs correct | section 4 |
| H-10 drift +200 / -200 ppm | measured +200.02 / -200.02 ppm (run 1), +199.78 / -200.09 ppm (run 2); max error against truth 0.0194 ms; uncorrected offset reaches 6.02 / -6.40 ms after 30-32 s | section 4 |
| Gap check (AU2-05) | 0 spacing error on all 12 files; copy with 1,000 samples removed FAILS (-1000 samples), packet-grid metric reads `[1024]` on both copies | section 4.3 |
| Listeners | worker only, `127.0.0.1:8555` and `127.0.0.1:8557`; none left after any run | section 5 |
| Media in git | 0 | section 5 |

## 1. Environment

| Fact | Value | Source |
|---|---|---|
| FFmpeg | `ffmpeg version 9.0.2 Copyright (c) 2000-2026 the FFmpeg developers` | `ffmpeg -version \| head -1` |
| pkg-config dir | `/opt/homebrew/Cellar/ffmpeg/9.0.2/lib/pkgconfig` (via `/opt/homebrew/lib/pkgconfig`) | `pkg-config --variable=pcfiledir libavformat` |
| Compile / link flags | `-I/opt/homebrew/Cellar/ffmpeg/9.0.2/include -L/opt/homebrew/Cellar/ffmpeg/9.0.2/lib -lavfilter -lavformat -lavcodec -lavutil` | make output |
| Library versions | libavformat 63.1.102, libavcodec 63.1.102, libavfilter 12.1.102, libavutil 61.1.102 | `pkg-config --modversion`, `otool -L build/capture-worker` |
| Compiler | `/usr/bin/clang` (Xcode), `/usr/bin/make` | `which` |
| Installs | none. No Homebrew command was run. MediaMTX is not on this Mac and was not needed | - |
| Host load | 9.34 at start of the proof runs, 11.05 at the end (three emulators and a dev stack idle, two other agents working) | `evidence/59_m3proof/results/uptime_*.txt` |

**Port finding.** The spec's media range is `127.0.0.1:8554-8564` (`05_capture_architecture_spec.md:308`).
On this Mac 8554, 8556 and 8558 are already bound by the three Android emulators (`qemu-syst`,
`lsof -nP -iTCP -sTCP:LISTEN`). The proofs therefore use 8555 and 8557. The emulators were not
touched.

## 2. What was built

### 2.1 Skeleton (`apps/capture-worker/`)

The spec names the location: `05_capture_architecture_spec.md:117` ("Target `apps/capture-worker/`").
Build output goes to `apps/capture-worker/build/`, ignored by `.gitignore:16` (`build/`).

| Part | Where | Note |
|---|---|---|
| RTSP listen ingest, loopback only | `capture_worker.c:324` (`ingest_main`), options `:331-332` | `rtsp_flags=listen`, explicit `listen_timeout` (S1 trap); an unconsumed option is fatal |
| URL rule (SEC35-23) | `capture_worker.c:415` (`parse_listen_url`) | accepts only `rtsp://127.0.0.1:<8554-8564>/<name>`, no credentials, no trailing slash. Checked: `0.0.0.0`, port 9000, trailing slash and `user:pass@` are each refused with rc 2 |
| Two mic inputs -> selector -> one encoder | `capture_worker.c:220` (`filter_build`), `:425` (`open_encoder`) | `abuffer@mic1`, `abuffer@mic2` -> `astreamselect@asel` -> `aformat` -> native `aac`, 48 kHz mono, 10 ms input quantum |
| Fan-out into both files (H-4) | `capture_worker.c:162` (`fanout`), clone at `:179` | each encoder packet is `av_packet_clone`d into both muxers; nothing is re-encoded |
| Per-file timeline (H-10) | `capture_worker.c:269` (T0), `:360-373` (video anchor) | audio pts = host sample count since T0; video pts = camera wall clock (`start_time_realtime` from the RTCP sender report) + demuxer pts - T0 |
| fMP4 output | `capture_worker.c:439` (`open_output`), flags `:453` | `frag_keyframe+empty_moov+default_base_moof` (S1 section 3), video stream copy |
| Fake mics | `capture_worker.c:142` (`mic_fill`) | the seam row 58 replaces with device capture |
| Structured log | `capture_worker.c:104` (`logj`) | one JSON line per event on stderr and in `--log <file>`; fields `ts_us, level, source, pid, message` + context; camera index and port only, never a URL |
| Proof-only switch | `--proof-two-encoders <skew>` (`capture_worker.c:228`) | the H-4 negative control; not for production use |

**AU2-07 (avfilter commands only on the filtering thread).** The guarantee has three parts:

1. `avfilter_graph_send_command` has exactly one call site, `capture_worker.c:214`, inside
   `filter_apply_commands` (`:205`).
2. That function aborts unless `pthread_self()` is the filtering thread (`:206`). The graph is also
   built, fed, drained and freed inside `filter_main` (`:257`), so no other thread calls any
   `avfilter_*` function.
3. The control thread only stores an atomic (`capture_worker.c:405`); `make check`
   (`Makefile:25-26`) fails the build if the call-site count is not 1 or the guard is missing.

Runtime smoke (1 run, not a row-111 proof): `switch 1` on stdin at about 4.5 s produced
`selector_switched map=1 applied_before_sample=214080`; decoded peak before the boundary 0.0014,
after 0.1002 (the 880 Hz standby mic at 0.1).

### 2.2 Throw-away fixtures (`.cache/spikes/m3proof/`, git-ignored by `.gitignore:47`)

| File | Role |
|---|---|
| `fake_cam.c` -> `bin/fake_cam` | fake camera, **separate process, own clock model**: frame k is paced at true time `epoch + k*20 ms*(1+drift)`, while the camera claims `claimed + k*20 ms`. The claim travels only as RTP timestamps and the RTCP sender report. 320x240, 50 fps, GOP 50 (1 s), one white frame per event |
| `m3proof.py` | runner (`run`), analysers (`h4`, `h10`, `gap`), process-group cleanup, listener checks |
| `runs/<name>/` | media, logs, truth JSON (not copied anywhere else) |
| `results/` | analyser JSON per run |

Text copies of the two sources and all result JSON are kept in
`implementation/evidence/59_m3proof/` (no media).

## 3. Proof 1 - H-4

**Question.** Can one AAC encoder feed both camera fMP4 files without a re-encode?

**Method.** Two `fake_cam` processes push to the worker's two loopback listeners; the worker runs
20.5 s. `m3proof.py h4` then compares, per audio packet, `pts, dts, duration, size` and the SHA-256
of the payload (`ffprobe -show_data_hash sha256`) across the two files, compares both lists with
the SHA-256 list the worker wrote at the encoder output (`manifest.jsonl`), and takes a second,
independent digest (`ffmpeg -c copy -f streamhash`). Playable = full decode with `-xerror` rc 0 and
0 stderr lines, decoded frame count = packet count for both streams, exactly one `h264` and one
`aac` stream, and the top-level boxes tile the file exactly (AU2-08: a truncated `mdat` is silent
to the decoder).

### 3.1 Results (2 runs)

| Run | Encoders | Audio packets cam1 / cam2 | Payload bytes | Differing packets (any field / payload) | Mismatches vs encoder manifest | Audio stream SHA-256 (both files) | Video packets | Decode rc / error lines | Boxes | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| `h4_run1` | 1 | 962 / 962 | 15,755 / 15,755 | 0 / 0 | 0 / 0 | `af8f710b...413f9ea5` | 600 / 600 | 0 / 0 | 1 ftyp, 1 moov, 12 moof, 12 mdat, 1 mfra | PASS |
| `h4_run2` | 1 | 962 / 962 | 15,981 / 15,981 | 0 / 0 | 0 / 0 | `9d20fa70...f055beed36` | 600 / 600 | 0 / 0 | same | PASS |

The same check also passed on the six H-10 runs, where the two files carry **different** video
timelines (`h10_pm80_*`: file sizes 52,390 vs 52,918 bytes, audio identical; `h10_drift_*`: 1,900 /
1,900 packets, 0 differing).

Payload bytes differ between runs because the beep lands on a different sample phase each run;
within a run the two files always agree.

### 3.2 Negative controls

| Run | Variant | Result | Check |
|---|---|---|---|
| `h4_neg_skew480` | two encoders, the second starts 480 samples later | 42 packets differ (41 payloads), first at index 65; stream digests `32e1a1c9...` vs `070592ce...` | **FAIL, as required** |
| `h4_neg_skew0` | two encoders on the identical frame grid | **0 packets differ**, digests equal | **FAIL, as required** - but only because the worker reported 2 encoders |

**Why this matters.** The native AAC encoder is deterministic, so byte equality across the files
does not by itself prove that there is one encoder. The proof is the pair: byte equality **and**
the structural fact that both muxers receive clones of one packet (`capture_worker.c:179`), which
the analyser ties to the files through the encoder-side manifest. Row 58 should keep both halves
in the regression test.

**Limit.** The fake mic is silent between beeps, so most packets are the encoder's silence frame.
Only the 41 beep-carrying packets distinguish the skewed control. A continuous tone on the active
mic would make the equality test stricter; that is a fixture change for row 62.

## 4. Proof 2 - H-10 (AU2-06)

**Question.** With camera video stamped by the camera clock and audio stamped by the host, are the
two aligned in **each** file, and what happens when the camera clock is offset or drifts?

**Method.** Each event is one real instant: the camera shows one white frame, and the host-side
fake mic starts a 1 kHz burst at the first sample at or after that instant (hard cosine onset).
Camera 1's events are at 2, 6, 10 s..., camera 2's at 4, 8, 12 s..., so the single audio track
carries both trains and each file is analysed against its own flashes. The audio passes through
the selector (`astreamselect`, map 0) and the one encoder. `m3proof.py h10` takes the flash from
the video frame pts and the beep from the audio frame pts plus the index of the first sample with
`|x| > 0.25` after 50 ms of quiet. No analysis windows. `offset = beep - flash`, positive = audio
late. Truth per event = injected offset + drift * elapsed camera time.

Two tolerances, kept apart (AU2-04): **regression** `|measured - truth| <= 2 ms` on this
deterministic fixture; **product** `|offset| <= 40 ms`.

### 4.1 Results (2 runs per case; cam1 / cam2 are separate files of the same run)

| Case | Run | File | Injected | Measured offsets (ms) | Max error vs truth | Regression (2 ms) | Product (40 ms) |
|---|---|---|---|---|---|---|---|
| zero | 1 | cam1 | 0 | 0.0194, 0.0194, 0.0194 | 0.0194 | PASS | within |
| zero | 1 | cam2 | 0 | 0.0194, 0.0194, 0.0194 | 0.0194 | PASS | within |
| zero | 2 | cam1 | 0 | 0.0208 x3 | 0.0208 | PASS | within |
| zero | 2 | cam2 | 0 | 0.0208 x3 | 0.0208 | PASS | within |
| +/-80 | 1 | cam1 | +80 ms | 80.0194 x3 | 0.0194 | PASS, sign + | **exceeded** |
| +/-80 | 1 | cam2 | -80 ms | -79.9806 x3 | 0.0194 | PASS, sign - | **exceeded** |
| +/-80 | 2 | cam1 | +80 ms | 80.0208 x3 | 0.0208 | PASS, sign + | **exceeded** |
| +/-80 | 2 | cam2 | -80 ms | -79.9792 x3 | 0.0208 | PASS, sign - | **exceeded** |
| drift | 1 | cam1 | +200 ppm | 0.4153, 1.2069, 2.0194, 2.8111, 3.6028, 4.4153, 5.2069, 6.0194 | 0.0194 | PASS | within |
| drift | 1 | cam2 | -200 ppm | -0.7931, -1.5847, -2.3972, -3.1889, -3.9806, -4.7931, -5.5847, -6.3972 | 0.0194 | PASS | within |
| drift | 2 | cam1 | +200 ppm | 0.4194, 1.2111, 2.0028, 2.8153, 3.6069, 4.4194, 5.2111, 6.0028 | 0.0194 | PASS | within |
| drift | 2 | cam2 | -200 ppm | -0.7889, -1.5806, -2.3931, -3.1847, -3.9972, -4.7889, -5.5806, -6.3931 | 0.0194 | PASS | within |

Drift fit: run 1 +200.02 / -200.02 ppm, run 2 +199.78 / -200.09 ppm; change over the 28 s between
first and last event +5.604 / -5.604 ms (run 1), +5.583 / -5.604 ms (run 2).

The residual 0.008-0.021 ms is at most one audio sample (20.8 us): the beep starts on the first
sample at or after the instant.

### 4.2 Reading the result

1. **Measurement.** Per-file offsets are sample-exact and correctly signed; every case is within
   0.021 ms of truth, in both files, in both runs. The row's pass condition is met.
2. **Negative controls built into the cases.** The zero case reads 0.02 ms, the +/-80 cases read
   +80 / -80 and breach the product bound, so the measurement can fail and does.
3. **Drift against the regression bound.** The skeleton copies the camera's timestamps and counts
   host samples; it does **not** correct rate. A camera clock 200 ppm off leaves the 2 ms
   regression bound after 10 s and would leave the 40 ms product bound after 200 s. By the same
   arithmetic a 50 ppm camera leaves 40 ms after about 800 s (hypothesis: typical crystal figures
   were not measured here; real cameras are class C-9). **H-10's "does not drift beyond the
   tolerance within a session" is therefore not provided by the mechanism itself.** See 6.1.
4. **Start alignment depends on the camera's wall clock.** A camera whose clock is 80 ms off puts
   80 ms into the file. Camera time sync (ONVIF NTP set, H-7) becomes a correctness dependency.

**Limits.** (a) The fixture is deterministic by construction: the camera clock is a model (offset
and rate) on the same host oscillator, and the fake mic is a function of host time. What is
exercised end to end is the timestamp path: fake camera -> RTP/RTCP over loopback TCP -> libavformat
-> the worker's mapping -> fMP4 -> independent analyser, in two files. Real capture latency (mic
device buffering, camera encode delay before stamping) is not in it. (b) The mapping relies on how
FFmpeg 9.0.2 exposes the sender report: observed in `h10_pm80_run1`, `start_time_realtime` was the
same for both cameras (1791513809690000) while their first copied pts differed by 14,400 ticks
(160.000 ms). Only the sum is meaningful, and `capture_worker.c:362-373` uses the sum. (c) Pacing
lateness of the fake cameras (max 29.7 ms on a loaded host) does not enter the result because the
timestamps are computed, not sampled.

### 4.3 Gap check (AU2-05) and its negative control

Check = (1) decoded sample count minus encoder input in `[0, 2048]` (priming + last-frame padding)
and (2) every beep-to-beep spacing in the decoded audio equals the pre-encode manifest within 2
samples.

| File set | Decoded - input | Spacing errors (samples) | Verdict |
|---|---|---|---|
| 8 files of the zero and +/-80 runs | 1,088 each | all 0 | PASS |
| 4 files of the drift runs | 1,600 each | all 0 (15 spacings) | PASS |
| `gapctl_intact.m4a` (re-encode of cam1 audio, nothing removed), runs 1 and 2 | 64 | 0, 0, 0, 0, 0 | PASS |
| `gapneg_minus1000.m4a` (1,000 samples removed between beeps 2 and 3), runs 1 and 2 | -936 | 0, **-1000**, 0, 0, 0 | **FAIL, as required** |

The packet-grid metric that AU2-05 rejected reads `[1024]` for both the intact and the cut copy,
which confirms again that it cannot see a gap.

## 5. Hygiene

| Check | Result |
|---|---|
| Listeners during a run | `capture-w ... TCP 127.0.0.1:8555 (LISTEN)`, `... 127.0.0.1:8557 (LISTEN)`; `non_loopback: []` (`evidence/59_m3proof/results/h4_run1.bind_check.json`) |
| Listeners after each run | `listeners_after: []` in all 10 `*.run.json` |
| Processes after | `pgrep -fl "capture-worker\|fake_cam"` -> none |
| Other ports | 8554/8556/8558 (emulators), 5173-5178, 8000, 4421-4423, 8081, 4432 not touched |
| Media in git | `git status --porcelain --untracked-files=all \| grep -icE "\.(mp4\|m4a\|aac\|mp3\|wav\|mov\|mkv\|h264)$"` -> `0` |
| npm / lockfile | not touched by this row |

## 6. Findings for the controller

### 6.1 Drift is not bounded (decision needed before row 58)

Why: section 4.2 item 3. Options: (a) re-anchor video against later RTCP sender reports and
correct pts in small steps; (b) keep video as is and resample audio to the camera clock - not
possible with two cameras and one shared track; (c) accept and bound session length per measured
camera ppm (class C-9). Recommendation: (a), specified in row 58 with the drift case of this
fixture as its regression test (expected: measured slope near 0 instead of 200 ppm).

### 6.2 First video sample is mis-timed with the pinned fMP4 flags

Found while checking the anchors: with `frag_keyframe+empty_moov+default_base_moof`, the mov muxer
places each track's first sample at time 0. Audio starts first, so the first video packet of
`h10_pm80_run1/cam1.mp4` has pts 0 and duration 34,652 ticks (0.385 s) instead of pts 32,852 and
duration 1,800. Every later sample is correct (that is what section 4 measures). Effect: the first
frame is shown early and held. Options: `+delay_moov` (changes the S1 file shape and must be
re-checked against the fragment hash chain), or start the session timeline at a common instant and
accept a held first frame as documented behaviour. Not changed here because the flags are pinned
by S1 section 3.

### 6.3 Smaller items

| Item | Detail |
|---|---|
| Port range | 8554/8556/8558 collide with emulator gRPC ports on this Mac; the fixture and the worker config should pick free ports from the range (rows 58, 62) |
| Anchor fallback | `--anchor-arrival-fallback` exists but is off by default and untested; without a sender report the worker drops video and logs `no_camera_wall_clock` |
| libav stderr | libav's own log lines still go to stderr unstructured; row 58 should install an `av_log` callback so nothing raw reaches the supervisor log (spec A.6) |
| Fixture promotion | `fake_cam.c` and `m3proof.py` are throw-away; row 62 (NM-14) should rebuild them under `apps/capture-worker/test-fixtures/` |
| Encoder bit rate | 96 kb/s is a placeholder; the config key belongs to row 58 |
| Not in the skeleton | meters, PCM tap, IPC protocol, supervisor, real devices, crash behaviour - rows 57-61 |

## 7. Reproduce

All commands from the repository root. The `run` step binds loopback ports, so it needs the Bash
sandbox off; the analysers do not.

```
make -C apps/capture-worker clean all
python3 .cache/spikes/m3proof/m3proof.py build

# H-4
python3 .cache/spikes/m3proof/m3proof.py run nav_h4 --case zero
python3 .cache/spikes/m3proof/m3proof.py h4 nav_h4
python3 .cache/spikes/m3proof/m3proof.py run nav_h4_neg --case zero --two-encoders 480
python3 .cache/spikes/m3proof/m3proof.py h4 nav_h4_neg --expect-fail

# independent of the harness:
R=.cache/spikes/m3proof/runs/nav_h4
for f in cam1 cam2; do ffprobe -v error -select_streams a:0 -show_entries packet=pts,dts,duration,size,data_hash \
  -show_data_hash sha256 -of csv=p=0 $R/$f.mp4 | shasum -a 256; done
for f in cam1 cam2; do ffmpeg -v error -xerror -i $R/$f.mp4 -map 0 -f null - ; echo "rc=$?"; done

# H-10
for c in zero pm80 drift; do
  python3 .cache/spikes/m3proof/m3proof.py run nav_$c --case $c
  python3 .cache/spikes/m3proof/m3proof.py h10 nav_$c
  python3 .cache/spikes/m3proof/m3proof.py gap nav_$c
done
python3 .cache/spikes/m3proof/m3proof.py gap nav_zero --negative

lsof -nP -iTCP -sTCP:LISTEN | grep -E ":85(55|57) " ; pgrep -fl "capture-worker|fake_cam"
```

Every analyser exits 0 on PASS and 1 on FAIL; `--expect-fail` inverts that for a negative control.

---
*Generated: 2026-10-09 09:55*
