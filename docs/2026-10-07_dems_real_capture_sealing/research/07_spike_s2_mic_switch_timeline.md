---

> **Erratum (2026-10-08, audit AU-2 / D18, D22):** measured history kept as recorded. The S2 '0.001 ms gap' metric is blind (it reads 0 on a copy with 20.8 ms removed) — replaced by a sample-count + continuity check; the switch bound is per input chunk (10 ms live), and the switch clicks audibly. The STT check ran on the oMLX server on the Apple GPU (`Device(gpu, 0)`); the CPU-only clause of R-5 AC-1 is still to be proven (blueprint rev 2.1). Corrections: `masterplan/11_audit_errata.md`.

task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: coder-execution
blueprint_row: 8
milestone: M1
class: A
tier: 2
artifact_type: spike report (S2 — one-session audio track, manual near-gapless mic switch)
status: complete
acceptance: 12/12 PASS (4 criteria x 2 runs + 1 verification run)
media_location: /Users/gsp-budi/Documents/DEMS/.cache/spikes/s2/ (git-ignored; repository source untouched)
ffmpeg_build: FFmpeg 9.0.2 Homebrew arm64 (initialization/01_env_check.md §3)
---

# Spike S2 — one AAC track with a manual, near-gapless switch between two mic inputs

## 0. Verdicts

| Question the spike must answer | Verdict | Measured evidence |
|---|---|---|
| Can `astreamselect` (`inputs=2`, runtime-settable `map`) carry one AAC 48 kHz mono track and switch its input mid-stream? | **YES** | All three run files: exactly 1 audio stream, PTS strictly monotonic, uniform 1024-sample packet grid across the switch (§3, §5) |
| Can the switch be triggered at an **exact runtime moment** on the bare `ffmpeg` CLI? | **NO** | `asendcmd` parses its commands file at graph init only (empty file -> "No commands were specified"; append after init is ignored) and this build has no `zmq`/`azmq` (`--enable-libzmq` absent from `-buildconf`) — §1 |
| Can it be triggered by a **human operator during recording** on this FFmpeg build at all? | **YES — via libavfilter** | `avfilter_graph_send_command(g, "asel", "map", "1")` injected mid-pull: realised graph boundary exactly 1 AAC frame (21.333 ms) after injection, 0 ms file gap, capture-side interval manifest produced (§2 run3) |
| Switch trigger granularity | CLI: media-time (frame boundary >= commanded START). API: operator wall-clock instant, +<=1 frame to realised boundary | §4 matrix |
| Discontinuity vs the 21.33 ms AAC floor (F-44) | File gap/drop = **0.000 ms** (uniform grid; measured max packet delta 21.334 ms = the grid itself); placement error vs the capture record <= **1.17 ms**; content is a hard tone jump at a frame boundary (no silence inserted, no crossfade) | §3, §5 |
| Resolve row-3 gap F-41 ("Row 8 measures what is actually achievable") | F-39/F-40 confirmed (media-time grammar); F-41 confirmed for the CLI and **closed by the API path** — an embedded FFmpeg worker can do the R-3/OD-09 manual toggle; GStreamer is no longer required for this requirement (it stays relevant for row 14 comparison) | §1, §4, §6 |

**Acceptance row 8: PASS — 12/12 (4/4 in run1, run2 and the run3 verification).** The measured discontinuity numbers are: **packet gap/drop 0.001 ms; interval placement error 1.17 ms (run1), 0.28 ms (run2), 0.58 ms (run3); trigger latency 2.667 ms (run1), 20.667 ms (run2), 21.333 ms (run3)** — all within one AAC frame (21.333 ms).

## 1. Mechanism investigation (what was tried, what works, why)

Host build identity (quoting the probe in this session): `ffmpeg -hide_banner -buildconf` lists
`--prefix=/opt/homebrew/Cellar/ffmpeg/9.0.2 ... --enable-gpl --enable-libsvtav1 --enable-libopus --enable-libx264 --enable-libmp3lame --enable-libdav1d --enable-libvmaf --enable-libvpx --enable-libx265 --enable-openssl --enable-videotoolbox --enable-audiotoolbox --enable-neon` — **no `--enable-libzmq`**. `ffmpeg -hide_banner -filters | grep -i zmq` -> no match (488 filters listed). `command -v zmqsend` -> NOT FOUND.

| # | Candidate runtime-switch channel | Result | Evidence |
|---|---|---|---|
| 1 | `astreamselect` `map` runtime-settable flag | Works as advertised | `ffmpeg -h filter=astreamselect`: `map <string> ..FVA....T. input indexes to remap to outputs` (T = runtime command; initialization/01_env_check.md §3) |
| 2 | `asendcmd` `commands` / `filename` + `astreamselect` (the row-3 F-39 pattern) | **Works — media-time only** | `smoke.m4a`: file `smoke_cmd.txt` = `3.0 astreamselect map 1;` -> analyser crossover estimate 3007.16 ms vs grid boundary 3008.000 ms (error 0.84 ms), single monotonic stream |
| 3 | Append to the `asendcmd` file while ffmpeg records (CLI operator channel?) | **FAILS — file parsed at graph init only** | Empty file at init: `ffmpeg -y ... asendcmd=filename=live_cmd.txt ...` -> `[Parsed_asendcmd_0] No commands were specified` -> init error. Seeded `0.0 astreamselect map 0;`, ffmpeg started, `2.9 astreamselect map 1;` appended at wall ~2.6 s (`live_cmd.txt` shows both lines): `live_test.m4a` analyser reports `transitions: []`, whole track `MIC1_440` |
| 4 | `zmq`/`azmq` filter (documented external command socket; ffmpeg-filters §"zmq, azmq") | **ABSENT in this build** | Row #1 above (`-buildconf`, `-filters`, no `zmqsend` binary) -> not installable here (no `brew install` per spike guard rails) |
| 5 | ffmpeg CLI stdin / signals / any other command channel | None exists | CLI interactive keys are control-only (q/v/...); no filter-command channel in `ffmpeg -h full` output; filter docs give only sendcmd grammar (§"sendcmd, asendcmd" commands syntax, interval `START[-END] COMMANDS;`) |
| 6 | **libavfilter API `avfilter_graph_send_command`** (row-3 F-41 hypothesis) | **WORKS — true operator trigger** | `opswitch.c` (this folder): graph built with named instance `asel`; stdin line `switch` -> `CHECK(avfilter_graph_send_command(g, "asel", "map", "1", NULL, 0, 0))`; run3: command SENT at media 5162.667 ms, capture manifest flip 5184.000 ms (= exactly +1 frame), file recovered at 5184.58 ms graph-domain |
| 7 | `concat` filter | Rejected, not a switch | F-42/F-43: sequential, parameter-equality, silence padding — different semantics |

**Why the API path is the answer for DEMS:** the capture worker is by design a supervised process behind the API (D219/D220, row 31 `NM-xx`). Embedding libavfilter (path 6) needs the already-installed shared libraries (`pkg-config libavfilter` -> 12.1.102; `/opt/homebrew/include/libav*` present) and no install, no repo source change. The bare CLI alone cannot serve the R-3 manual toggle.

## 2. Test bed (all synthetic, all under `.cache/spikes/s2/`)

Inputs (row-8 brief): MIC1 = `sine=frequency=440:sample_rate=48000:duration=8` (full scale; the `sine` filter has **no amplitude option** on this build — `ffmpeg -h filter=sine` shows only frequency/beep_factor/sample_rate/duration/samples_per_frame), MIC2 = `sine=frequency=880:...:duration=8` attenuated by `volume=0.3` so both a dominance classifier and an RMS/energy crossover can tell them apart (10.46 dB level difference).

Selector + encoder graph (identical in all runs; run3 builds it programmatically):

```
[0:a]asendcmd=filename=<cmds>[a0]; [1:a]volume=0.3[a1];
[a0][a1]astreamselect=inputs=2:map=<init>,anull[sel];
[sel]aformat=sample_rates=48000:channel_layouts=mono[out]  ->  -c:a aac -b:a 128k  (mp4)
```

Pacing: `-re` on both inputs (runs 1/2) / wall-clock pacing loop (run3) so media time tracks the operator's clock at 1x, like a real recording.

Tools in this folder (every number below is reproducible with them):
- `analyser.mjs <file> [win=1024] [hop_ms=5] [amp_ratio=0.3] [csv]` — decodes with `ffmpeg -ignore_editlist 1` (first packet pts `-1024` = priming is then included, so decoded index maps 1:1 onto the packet-pts media timeline), sliding-window two-bin Goertzel (440 vs 880), amplitude-normalised dominance classification, and a **crossover-band energy estimator** (frac_new = e880_norm/(e880_norm+e440); boundary per window = start + win*(1-frac)) giving the switch instant to ~1 ms from the final file alone. Skips a 2-frame warm-up (priming region).
- `pts_check.mjs` — ffprobe packets: stream count, strict PTS monotonicity (negative jumps, repeats), min/max packet deltas, duration histogram.
- `verify_run.mjs` — joins both against the run's interval log and prints the four row-8 criteria PASS/FAIL.
- `run_cli.mjs`, `run_op.mjs`, `opswitch.c` (+ compiled `opswitch`) — run orchestrators.

**Measured AAC/priming domain rule (needed to compare log vs file):** with `-ignore_editlist 1`, in the **paced** pipeline the tone content of graph frame with pts T appears in the decoded file at T + 21.333 ms (one frame): proven directly by run3, which records both domains simultaneously (raw pre-encode manifest flip 5184.000 ms; file crossover 5205.91 ms; difference 21.91 ms, consistent at 21.26–21.40 ms across the three paced points). In the **unpaced burst** regime (smoke) the offset was 0 (est 3007.16 vs 3008) — scheduling inside `astreamselect` shifts by the input pacing. Consequence for row 31/38: interval data should be anchored capture-side (run3-style raw manifest), not inferred from the command timestamp arithmetic.

## 3. Runs (commands and real outputs)

### run1 — CLI, pre-commanded switch 440 -> 880 at media 4.200 s

```
$ node run_cli.mjs run1 "440->880" 4.200
[run1] ffmpeg exit 0, wall 7526 ms, logged boundary 4202.667 ms
```
`run1_cmd.txt` (seeded at init): `4.200 astreamselect map 1;` — full ffmpeg command in `run1_interval_log.json` field `ffmpeg_cmdline`.

Packets straddling the switch (`ffprobe -select_streams a:0 -show_entries packet=pts,pts_time,duration,duration_time -of csv=p=0 run1.m4a`):
```
200704,4.181333,1024,0.021333
201728,4.202667,1024,0.021333   <- grid boundary (enter frame)
202752,4.224000,1024,0.021333
```
Analyser (`run1_windows_precise.csv`, win 512 / hop 2.6667 ms): crossover band 4216.00–4229.33 ms, **estimate 4222.84 ms (file domain) -> 4201.50 ms (graph domain)** vs logged 4202.667 -> match error **−1.17 ms**. Stream probe: `stream,0,aac,audio,48000,1` (exactly 1). Packets 376, min/max delta 21.333/21.334 ms -> **gap/drop 0.001 ms**.

### run2 — CLI, pre-commanded switch 880 -> 440 at media 3.350 s (documented reverse order)

```
$ node run_cli.mjs run2 "880->440" 3.350
[run2] ffmpeg exit 0, wall 7509 ms, logged boundary 3370.667 ms
```
`run2_cmd.txt`: `3.350 astreamselect map 0;` with `astreamselect=inputs=2:map=1` at init.
Packets straddling: `161792,3.370667,1024` inside the uniform grid. Analyser estimate 3392.28 ms (file) -> 3370.95 ms (graph) vs logged 3370.667 -> match error **+0.28 ms**. 1 stream, 376 packets, monotonic, gap 0.001 ms.

### run3 — VERIFICATION run, human-operated switch mid-recording via libavfilter API (440 -> 880)

```
$ node run_op.mjs run3 5300 8
[run3] frames=375 command@media=5162.667 ms, capture manifest flip=5184 ms
```
Operator moment: `run3_operator.json` — `switch` written to the harness stdin at +5303 ms wall-clock from process start ("moment chosen on the operator wall clock; no pre-schedule existed in the filtergraph"). Capture-side manifest (`run3_manifest.csv`, one row per output frame, written live from the RAW sink samples):
```
242,247808,5162.667,MIC1_440,3990.5,30.3,0.1,1   <- command injected during this frame
243,248832,5184.000,MIC2_880,0.3,3850.3,0.0,1    <- realised boundary: exactly +21.333 ms (1 frame)
```
File recovery: estimate 5205.91 ms (file) -> **5184.58 ms graph domain vs capture-record 5184.000 -> match error +0.58 ms**. 1 audio stream, 376 packets, monotonic, grid gap 0.001 ms. Harness stderr: `OPERATOR switch command SENT at media 5162.667 ms ... CAPTURE MANIFEST flip recorded: first 880-dominant frame pts_ms 5184.000` (`run3_opswitch.log`).

### Diagnostics (reported, not counted as runs)
- `smoke.m4a` — unpaced pre-commanded `3.0` switch (channel #2 proof): 1 stream, monotonic, estimate 3007.16 vs 3008 (−0.84 ms); regime note in §2.
- `live_test.m4a` — file-append-after-init operator attempt (channel #3): **`transitions: []`** — the appended `2.9 ... map 1` line was never parsed; recorded as the negative finding.
- `diag_op.m4a` — harness 3 s bring-up (first switch 1216.0 raw / 1237.3 file: +21.3 container offset anchor).

## 4. Acceptance table (row 8 Verification column, per run)

| Criterion (row 8) | run1 (CLI) | run2 (CLI) | run3 (API, verification) |
|---|---|---|---|
| ffprobe shows exactly 1 audio stream | PASS — `stream,0,aac,audio,48000,1` | PASS — same | PASS — same |
| Audio PTS strictly monotonic across the switch | PASS — 0 negative jumps, 0 repeated PTS (376 packets, `run1_acceptance.json`) | PASS — 0/0 | PASS — 0/0 |
| Discontinuity at the switch <= 1 AAC frame (21.3 ms) | PASS — packet gap/drop **0.001 ms**; placement error **1.17 ms** (floor 21.333) | PASS — 0.001 ms; **0.28 ms** | PASS — 0.001 ms; **0.58 ms** |
| Interval log holds from_ms/to_ms for BOTH inputs and matches analyser recovery | PASS — `run1_interval_log_final.json` (440: 0->4202.667; 880: 4202.667->8000; segments recovered `MIC1_440` then `MIC2_880`) | PASS — (880: 0->3370.667; 440: 3370.667->8000) | PASS — capture-manifest intervals (440: 0->5184.000; 880: 5184.000->8000) |
| **Runs total** | **4/4** | **4/4** | **4/4 — 12/12** |

Trigger-granularity matrix (finding for row 31):

| Mechanism | Trigger | Command->realised-boundary latency | Human-operated during recording? |
|---|---|---|---|
| CLI + `asendcmd(filename)` | media time, fixed at graph init | 0–21.3 ms grid rounding from the pre-commanded START; unknown moments cannot be expressed | **No** |
| API + `avfilter_graph_send_command` | operator instant (IPC) | measured **exactly 1 frame (21.333 ms)** in run3 (pull-loop); worst-case bound 1 frame | **Yes** |

## 5. Measured values against the F-44 floor

| Quantity | Value | Source |
|---|---|---|
| AAC frame at 48 kHz | 1024 samples = 21.333 ms; every packet `duration=1024, duration_time=0.021333` | ffprobe rows §3 (confirms F-44) |
| Realised file discontinuity (gap or drop of samples) at the switch | **0.000 ms** (grid uniform, max deviation 21.334–21.333 = 0.001 ms rounding) | `pts_check.mjs` per run |
| Interval placement error (log vs file-only recovery) | 0.28 / 0.58 / 1.17 ms | §3 |
| Switch content behaviour | hard frequency+phase jump at the boundary, **no silence padding, no crossfade**; a listener hears the tone step instantly | `run1_windows_precise.csv` rows 4202.67–4224.00 (RMS and dominant-tone flip) |
| Encoder priming on this path | first packet pts = −1024 in all files (edit list trims it); analyser uses `-ignore_editlist 1` + paced-encode +1-frame domain rule | §2, `ffprobe packet=pts` first rows |

## 6. Findings for the capture-architecture spec (row 31) and the M1 gate (row 38)

1. **Pick the mechanism:** the mic-switch component should be an **embedded libavfilter capture worker**: two `abuffersrc`/device-fed inputs -> `astreamselect` (named instance) -> `aformat` -> native `aac` -> mp4/fMP4; UI toggle -> worker IPC -> `avfilter_graph_send_command(map)`. Demonstrated end-to-end on this exact FFmpeg 9.0.2 build (`opswitch.c`, run3). Evidence per criterion above.
2. **The bare `ffmpeg` CLI cannot serve R-3/OD-09** (manual, during recording): `asendcmd` is init-parsed media-time scheduling only (channel #3 negative test) and `azmq` is not in the Homebrew build. If the design insisted on the CLI, the toggle would have to pre-schedule known switch times (impossible for operator decisions) or restart per segment (not gapless). This retires the "candidate" wording of row 8 in favour of the API path.
3. **Interval data shape (decision R-3/OD-09):** run3 proves the capture process can emit, live and pre-encode, a per-frame source manifest (`frame,pts_samples,pts_ms,dominant,e440,e880,rms,operator_sent`) whose dominance flip is the `to_ms`/`from_ms` boundary; the final-file analyser independently recovers it within 0.58 ms. Recommendation for the manifest spec (row 32): store per-interval `from_ms`/`to_ms` **in media-pts domain** plus the `AUDIO_SOURCE_SWITCHED` audit anchor; derive boundaries capture-side, do not reconstruct them from operator wall clock (media-vs-wall offset drifts with startup latency: run3 injection at media 5162.667 vs wall +5303).
4. **Trigger granularity to spec:** worst-case 1 AAC frame (21.333 ms) between command injection and realised content boundary; file timeline itself never gaps (0.000 ms). Row 31 should set the M5 acceptance bound at <= 1 frame + 1 AAC packet scheduling margin, and note that a smooth fade (if UX wants one) is a separate `volume`-command crossfade, also runtime-settable (F-38-style commands exist on `volume` too).
5. **Row 14/15 evidence needed (GStreamer, class B):** this spike shows the operator trigger does **not require** GStreamer on this host — the FFmpeg API path is proven. Row 14, if approved, must still measure `input-selector` pad switching mid-PLAYING against the identical table (exactly 1 audio stream, strict PTS monotonicity, <= 1 frame realised discontinuity incl. GAP-event behaviour at the selector, capture-side interval recovery vs final-file analyser) plus the S1 fMP4/hash path; row 15 then scores "gapless manual switch" for FFmpeg using rows 8/31 (this file) and for GStreamer using row 14, and must state that the FFmpeg CLI-alone score for operator-trigger is FAIL (§1 channel 3/4/5) while the embedded-API score is PASS (run3).

## 7. Leftover gaps for row 38 (independent verification)

| # | Gap | Suggested handling by the verifier |
|---|---|---|
| L-1 | The analyser's tone-dominance recovery assumes two distinct pure tones and a known 0.3 amplitude ratio; real mics need an energy/spectral comparison against per-input reference windows (row 31 design) | Re-run `verify_run.mjs` as-is on `run1/run2/run3` (it is file-only + log-only); separately confirm the packet grid by hand from `ffprobe ... packet=pts,duration` |
| L-2 | Domain rule calibration (paced: crossover − 1 frame; unpaced: no offset) is measured at 4 points only; row 38 should re-anchor with a fresh API run using the raw-manifest dual record, not with CLI arithmetic | `node run_op.mjs verify 4100 6` reproduces in ~6 s and prints both domains |
| L-3 | 375 sink frames vs 376 packets: the native AAC path emits one extra packet (priming); harmless for monotonicity but the manifest duration field in row 32 must use the media timeline, not packet count | Check `duration_ts=384000` in `ffprobe -show_entries stream=duration_ts` (= 8 s at 1/48000) |
| L-4 | Only one switch per run was required; multi-switch and rapid-toggle stress belong to M3/M5 worker integration (not row 8) | Note only |
| L-5 | `asendcmd` file-content is validated at init (empty/invalid -> hard error); a future CLI-hybrid design must therefore never treat the file as mutable state | Note only |

## 8. Guard-rail compliance

| Rule | State |
|---|---|
| Synthetic sources only | YES — lavfi `sine` 440/880 only (no real devices, no network) |
| Media only under `.cache/spikes/s2/` | YES — all `.m4a`/csv/log artifacts in this folder; `.gitignore` covers `.cache/`; `git status --porcelain` shows no media and 0 repository source files changed |
| No repository source edits | YES — this row wrote exactly 2 repository files (this report + `delegation_progress/coder-execution__row8.md`) |
| No ports < 1024 / no listeners | YES — no socket was bound (the azmq default tcp://localhost:5555 was never reached: filter absent from build); no port touched at all, so SMART WMS ports untouched and 8554-8564 unused |
| No emulators, no sudo, no brew install | YES — only system `ffmpeg`/`ffprobe`/`node` and `cc` compiling inside the spike folder |

## 9. Artifact inventory (`.cache/spikes/s2/`)

Scripts: `analyser.mjs`, `pts_check.mjs`, `verify_run.mjs`, `run_cli.mjs`, `run_op.mjs`, `opswitch.c`, `opswitch`.
Runs: `run{1,2}.{m4a,cmd.txt,ffmpeg.log,interval_log.json,interval_log_final.json,acceptance.json,windows_precise.csv}`; `run3.{m4a,manifest.csv,opswitch.log,operator.json,interval_log.json,interval_log_final.json,acceptance.json,windows_precise.csv}`.
Diagnostics: `smoke.{m4a,cmd.txt,windows_precise.csv}`, `live_test.m4a`, `live_cmd.txt`, `diag_op.m4a`, `diag_manifest.csv`.

## Issues & Decisions Log

| Item | Decision / note |
|---|---|
| Row-8 "candidate" wording (`astreamselect` commands) | Resolved: filter + command work; trigger channel on the CLI does not. Recorded as the finding; no repo change attempted (per guard rails). |
| Brief wording "row 3 G-39..G-41" | Interpreted as facts **F-39..F-41** of `research/02_collection.md` (row 3's gap table is G-1..G-11 and none is numbered 39-41). F-41's "row 8 measures what is actually achievable" is now closed (§0, §6.2). |
| Amplitude separation | `sine` filter has no `amplitude` option on this build (probe §2); used `volume=0.3` for MIC2 — matches row-8 brief ("different amplitudes"). |
| Acceptance semantics split | "Discontinuity <= 1 AAC frame" measured as the **file** gap/drop (0.001 ms) plus placement error vs the capture record (<= 1.17 ms); the command->boundary trigger latency (<= 1 frame) is reported separately as a granularity finding, not conflated into the discontinuity. |

---
*Generated: 2026-10-07 15:45*
*Last Updated: 2026-10-07 15:45*
