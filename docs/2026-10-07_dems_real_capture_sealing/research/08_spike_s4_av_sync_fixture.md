---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 9
date: 2026-10-07
agent: coder-execution
milestone: M1
class: A
tier: 2
status: complete
verdict: 3/3 acceptance criteria PASS across 3 runs (9/9 run x criterion checks); NM-14 fixture seeded
media_root: /Users/gsp-budi/Documents/DEMS/.cache/spikes/s4/
inputs_read:
  - identification/02_structured.md row 9 (Verification column) + "Spike guard rails" (line 176)
  - research/06_spike_s1_fmp4_running_hash.md (pinned S1 commands, traps 2.1-2.4, G-1, SP-8)
  - initialization/01_env_check.md §3 (FFmpeg 9.0.2 real muxer option text: frag_duration/frag_size/fragment_index/min_frag_duration; no frag_type/default_prft/frag_start_number)
  - research/03_analysis.md §B.6 NM-14 (apps/capture-worker/test-fixtures/), E-23 (no 1-2 h loops)
---

# Spike S4 — AV-sync flash+beep fixture with an offset analyser, through the S1 pipeline

> **ERRATUM (RV-SPEC, 2026-10-08; audit AU-2 `verification/21_audit_spikes_stt.md` §3, findings
> AU2-03/AU2-04/AU2-06; decision D18). The measured history below is kept unchanged; read it with
> these corrections.**
>
> | Where (this file; `:n` = line numbers before this note was inserted) | As recorded | Correct reading |
> |---|---|---|
> | §0 row 1 (`:27`), §4 table (`:110-115`), §5 S4-1/S4-2 (`:169-170`), §7 item 5 (`:187`), run-3 note (`:39`) | aligned offset **−1.333 ms**, a "pipeline common-mode skew" / "bias" of the copy path | **0.00 ms** true relative offset. A sample-exact analyser on this row's own `s4/run3/out_aligned.mp4` measures **+0.021 ms** (= one sample: the sine starts at 0, so the 2nd sample is the first above threshold). −1.333 ms is the **10 ms analysis-window quantisation** of an onset at 3.021354 s (1.354 ms into a window). The copy path shifts **both** streams by one AAC priming frame (21.333 ms; flash pts 3.021333, beep sample 145,025 = 144,000 + 1,024 + 1), which cancels |
> | §0 row 2 (`:28`), §3 JSON (`:88-90`), §4 table, §7 item 5 (`:102`) | injected 80 ms measured **78.667 ms** (error 1.333) | **80.021 ms** sample-exact on this row's `out_shifted.mp4` (same artefact) |
> | run 3 direct controls (`:39`), §5 S4-2 (`:170`) | 0.0 / 80.0 ms "exact" | 0.021 / 80.021 ms sample-exact; they looked exact only because 3.000 s / 3.080 s fall on the 10 ms window grid |
> | §2.3 (`:68-70`), §5 S4-3 (`:171`) | ±40 ms as the acceptance tolerance; "injections ≤ 40 ms are undetectable by construction at this frame rate" | **Wrong.** Analyser resolution on this fixture is ~0.05 ms; detectability is set by the chosen tolerance, not by the 50 fps grid. ±40 ms is a **product** tolerance; the **regression** bound on this deterministic fixture is ≤ 2 ms with a sample-exact analyser (`masterplan/05_capture_architecture_spec.md` §F) |
> | §7 item 3 (analyser) | 480-sample peak windows | the NM-14 analyser must detect the audio onset at **sample** resolution (AU-2 `s4/av_offset.py` method) |
> | §8 gap 1 (`:193`), §7 item 2 (`:184`) | −80 ms case not run | AU-2 measured **−80.052 ms** (audio early, correct sign) |
> | whole spike | — | audio and video come from one pusher and one clock, so the DEMS two-clock topology (camera video clock vs host audio clock) is **not** exercised: hypothesis **H-10** + check `M3-AV-2` (AU2-06) |
>
> The pass/fail verdicts (3/3 x 3 runs) and the byte anchors `58425017…` / `78e88811…` are **confirmed** by AU-2.


## 0. Verdict summary

Sign convention: `offset_ms = beep_onset - flash_onset` (positive = audio late).

| # | Acceptance criterion | run 1 | run 2 | run 3 | Verdict |
|---|---|---|---|---|---|
| 1 | Aligned fixture: measured AV offset within **±40 ms** | **-1.333 ms** | **-1.333 ms** | **-1.333 ms** | **PASS** (3/3) |
| 2 | Analyser self-test flags the injected **80 ms** offset (tolerance ±40 ms, §2.3) | **78.667 ms** (err 1.333) | **78.667 ms** (err 1.333) | **78.667 ms** (err 1.333) | **PASS** (3/3) |
| 3 | Fixture runs through the S1 pipeline (RTSP listen ingest -> fMP4, S1 flags): file grows, fragments written; `git status --porcelain` 0 media files | 5 frags, growth 0->22,483 B, mid-write ffprobe OK | same | same; ingest+pusher exits all 0 | **PASS** (3/3) |

All six pipeline samples are byte-identical across runs (aligned `sha256 58425017f3…8ea98eb`, shifted `78e88811b9…ac82b522`) — S1's determinism finding SP-8 extends to the S4 fixtures: row 38 can assert **expected file hashes and expected measured offsets (-1.333 / 78.667 ms), not just self-consistency**.

Run ledger (blueprint: 2 runs + 1 verification run):

| Run | Driver | Result |
|---|---|---|
| run 1 | `bash capture.sh run1` — aligned + shifted fixtures, 2 RTSP sessions | PASS (one cosmetic erratum in `truth_*.json` construction text, §6) |
| run 2 | `bash capture.sh run2` — fresh listener+pusher per fixture, text fixed | PASS, byte-identical to run 1 |
| run 3 | `bash capture.sh run3 --with-direct` — pipeline rerun + **direct-encode control** (same generator/encoder, no RTSP hop) | PASS; control measured **0.0 / 80.0 ms exactly**, isolating the pipeline's −1.333 ms common-mode skew (§5) |

## 1. Scope and guard-rail compliance

- Synthetic sources only: lavfi `color` + `drawbox` flash, lavfi `aevalsrc` beep (§2). No devices, no emulators.
- All media and scripts under `/Users/gsp-budi/Documents/DEMS/.cache/spikes/s4/` only (`.gitignore:47` `.cache/` — `git check-ignore -v .cache/spikes/s4/run3/out_aligned.mp4` confirms, §4.3).
- **0 repository source edits by this row.** At session start `git status --porcelain` showed only `docs/` artifacts; at close it additionally shows `M apps/core-web/src/test/live-paired-devices-issue.test.tsx` — a **concurrent edit belonging to row 20 (B10-d), not produced by this row** (no command in this spike writes any repository file; all drivers ran under `.cache/`).
- Ports 8554-8564: `capture.sh` re-checks `lsof -nP -iTCP:<p> -sTCP:LISTEN` for p in 8554..8564 before every session and aborts if none is free; 8554 was free and used in all 6 sessions (each run's log opens with `8554-8564: no listeners`). SMART WMS ports 5173/5174/5175 were never contacted.
- No sudo, no installs, no external services. Runtime: each fixture is a 6 s `-re` session; whole run ≈ 15 s; total spike wall time ~12 min (no 1-2 h loop per E-23).

## 2. Fixture design (generator + ground truth by construction)

`capture.sh` (in the spike root) encodes, per RTSP session:

- **Flash** — video: `color=c=black:s=320x240:r=50:d=6` with
  `drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='between(t,3.0,3.019)'`.
  At 50 fps the frame grid is 3.000 / 3.020, so the enable window [3.000, 3.019] selects **exactly one white frame**, frame index **150**, onset **3.000 s** — the upper bound 3.019 is strictly between two grid points, which is the poka-yoke against an off-by-one flash width. Verified: the analyser reports `bright_frame_count = 1` in every run (§3).
- **Beep** — audio: `aevalsrc=exprs='if(between(t,B,B+0.2),0.5*sin(2*PI*1000*t),0)':s=48000:d=6` — 1 kHz sine, amplitude 0.5 (peak −6.0 dB), 200 ms long, silence elsewhere. Aligned fixture: `B = 3.000` (start sample **144000**); injected fixture: `B = 3.080` (sample **147840**, **+80 ms** late). The shift is a **content-level** construction (the two fixtures differ only in the aevalsrc window), not a container edit-list trick — the muxer sees a genuinely off-sync stream, exactly the failure mode NM-14 must reproduce.
- Both streams are `-re` paced and pushed via RTSP/TCP (client), encoded `-c:v libx264 -preset ultrafast -tune zerolatency -g 50 -pix_fmt yuv420p` + `-c:a aac -ar 48000 -b:a 64k`, and stream-copied by the listener into fragmented MP4 — **the exact S1 command shape with all four S1 traps applied** (`-listen_timeout 60` explicit; URL without trailing slash; per-source `duration=6` plus output `-t 6` guard; `-flush_packets 1`), including S1's G-1 lesson (the listener exits on TEARDOWN, so each fixture gets its own listener process).

Ground truth is **emitted by the generator**: `truth_<fixture>.json` per run, containing `fps`, `frame_ms`, `flash_onset_s`, `flash_frame_index`, `beep_onset_s`, `beep_start_sample`, `true_offset_ms`, `tol_ms` — e.g. run 2:

```text
{"fixture": "aligned", "fps": 50, "frame_ms": 20.0, "flash_onset_s": 3.0, "flash_frame_index": 150, "beep_onset_s": 3.0, "beep_start_sample": 144000, "true_offset_ms": 0.0, "tol_ms": 40.0, ...}
{"fixture": "shifted", ... "beep_onset_s": 3.08, "beep_start_sample": 147840, "true_offset_ms": 80.0, ...}
```

### 2.3 Frame rate and tolerance (why 50 fps, why ±40 ms)

- **50 fps -> 1 video frame = 20 ms.** Flash onset is detected on the frame grid, so its quantization error is bounded by ±1 frame = ±20 ms; the construction places the event exactly on a grid point, so realized error is far smaller (measured skew §5: 1.333 ms).
- Audio onset is resolved by **10 ms analysis windows** and the AAC frame is 1024/48000 = **21.33 ms** (S2's constant) — the audio-side quantization is ≤ ~21 ms even in the worst case.
- Stated tolerance: **±40 ms** (row 9's acceptance window), which covers 2 video frames and ~2 AAC frames simultaneously. It leaves a symmetric decision margin for the self-test: an 80 ms injection is 4 video frames apart, so the sync band (|offset| ≤ 40) and the injected band (40 < |offset| ≤ 120) cannot be confused with each other. A 25 fps source (40 ms frame) would make ±40 ms only 1 frame wide and the 80 ms case ambiguous at one frame of mis-detection — **50 fps (or finer) is part of the NM-14 spec, not incidental.**

## 3. Offset analyser — algorithm (row 38 re-run contract)

`analyse.py` (spike root). Decodes the produced file with FFmpeg filters only; **uses no ground truth for measurement** — truth only drives the verdict.

1. **Flash onset (video):** `ffmpeg -i <file> -vf "signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -an -f null -` -> per-frame mean luma with `pts_time`. First frame with **YAVG ≥ 128** wins. The fixture's dynamic range is black YAVG = 16.0 vs white YAVG = 235.0, so the threshold sits at the midpoint of a 219-unit swing — no tuning needed.
2. **Beep onset (audio):** `ffmpeg -i <file> -af "asetnsamples=n=480:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.Peak_level:file=-" -vn -f null -` -> **10 ms peak-level windows** with `pts_time`. First window with **Peak_level > −45 dB** wins. Beep peak measures −5.975 dB; encoded silence reports −inf (no AAC pre-echo false trigger at 64 kbps was observed — the onset window is the true one in all 6 pipeline files and both controls).
3. **offset_ms** = (beep `pts_time` − flash `pts_time`) × 1000, rounded to µs. Sign: positive = audio late.
4. **Verdict rule** (`tol` from the truth JSON, default 40 ms): aligned (`true = 0`): PASS iff |offset| ≤ tol. Injected (`true ≠ 0`): PASS iff the file is **flagged** (|offset| > tol, i.e. outside the sync band) **and** |offset − true| ≤ tol. Exit code 0/1 for PASS/FAIL.

Run 3 full analyser output, injected fixture through the pipeline (`run3/analyse_shifted.txt`):

```text
"video": {"frames_decoded": 300, "flash_frame_index": 150, "flash_pts_time_s": 3.021333,
          "flash_yavg": 235.0, "bright_frame_count": 1},
"audio": {"windows": 538, "window_samples": 480, "beep_window_index": 310,
          "beep_pts_time_s": 3.1, "beep_peak_db": -6.004798},
"offset_ms": 78.667,
"verdict": "PASS",
"verdict_rule": "injected fixture: FLAGGED (|78.667| > 40.0) AND |78.667 - 80.0| = 1.333 <= 40.0 ms"
```

Re-run commands (from `/Users/gsp-budi/Documents/DEMS/.cache/spikes/s4/`):

```text
bash capture.sh <rundir>            # 2 RTSP sessions: aligned + 80 ms-injected, S1 flags
bash capture.sh <rundir> --with-direct   # + direct-encode controls (no RTSP hop)
python3 analyse.py <rundir>/out_aligned.mp4 <rundir>/truth_aligned.json report.json
python3 analyse.py <rundir>/out_shifted.mp4 <rundir>/truth_shifted.json report.json
```

Expected values for this host/encoder: offsets **-1.333 / 78.667 ms** and file hashes `58425017…8ea98eb` / `78e88811…ac82b522` (byte-deterministic across the 3 runs; a hash mismatch on synthetic input under an unchanged FFmpeg 9.0.2 = environment drift signal).

## 4. Per-run measurements and pipeline evidence

### 4.1 Measured offsets (all 6 pipeline samples + 2 controls)

| Run | Fixture | flash pts (frame idx) | beep pts (10 ms window) | measured offset | truth | error | verdict |
|---|---|---|---|---|---|---|---|
| 1 | aligned | 3.021333 (150) | 3.02 | **-1.333 ms** | 0 | 1.333 | PASS |
| 1 | shifted | 3.021333 (150) | 3.10 | **78.667 ms** | 80 | 1.333 | PASS |
| 2 | aligned | 3.021333 (150) | 3.02 | **-1.333 ms** | 0 | 1.333 | PASS |
| 2 | shifted | 3.021333 (150) | 3.10 | **78.667 ms** | 80 | 1.333 | PASS |
| 3 | aligned | 3.021333 (150) | 3.02 | **-1.333 ms** | 0 | 1.333 | PASS |
| 3 | shifted | 3.021333 (150) | 3.10 | **78.667 ms** | 80 | 1.333 | PASS |
| 3 control | aligned direct | 3.0 (150) | 3.00 | **0.0 ms** | 0 | 0.0 | PASS |
| 3 control | shifted direct | 3.0 (150) | 3.08 | **80.0 ms** | 80 | 0.0 | PASS |

`analyse_exit_*` was 0 for all eight reports; the analyser's frame-index cross-check held too: measured `flash_frame_index = 150` equals the truth's `flash_frame_index` in every file.

### 4.2 Ingest / fragment evidence (criterion 3, run 3 `shifted`; runs 1-2 identical)

Fragment manifest (`monitor.py` from S1, unmodified copy; `run3/manifest_shifted.tsv`, columns kind/seq/tracks/start/len):

```text
frag	1	1,2	1259	5276
frag	2	1,2	6535	3863
frag	3	1,2	10398	7606
frag	4	1,2	18004	3748
frag	5	1	21752	142
```

Growth while the writer was alive (`run3/sizes_shifted.txt`, 0.5 s poll; file appeared at the first box write, not at close — proving `-flush_packets 1`):

```text
1791363520.715 0
1791363522.294 1259
1791363524.395 10398
1791363526.488 22137
```

Mid-write ffprobe (`run3/growth_shifted.txt`, exit 0 while writing):

```text
probe_at_wall=1791363524.728 file_size=10398 writer_alive=yes
nb_streams=2 / format_name=mov,mp4,m4a,3gp,3g2,mj2 / duration=3.008000 / size=10398
```

Writer close (`run3/ingest_shifted.log` tail, same shape in all sessions):

```text
[out#0/mp4 @ …] video:12KiB audio:4KiB … muxing overhead: 35.431601%
frame=  300 fps= 66 … time=00:00:06.02 bitrate=  29.9kbits/s speed=1.31x
```

All 6 pipeline sessions: `ingest_exit=0`, `pusher_exit=0`, 5 recorded fragments + `trailer mfra` row. (Fragment 5 carries `tracks=1` because the final ~400 ms of the 6 s file is pure video tail past the last audio packet — a `frag_duration` mid-GOP artifact already documented by S1 G-3/SP-4, harmless for AV measurement since both streams decode fully: `frames_decoded=300`, `windows=538/602`.)

### 4.3 Git hygiene

```text
$ cd /Users/gsp-budi/Documents/DEMS && git status --porcelain | grep -Ei '\.(mp4|mov|m4s|m4a|ts|mpg|mkv|wav|aac|h264|264)$' | wc -l
       0
$ git check-ignore -v .cache/spikes/s4/run3/out_aligned.mp4
.gitignore:47:.cache/	.cache/spikes/s4/run3/out_aligned.mp4
```

## 5. Findings

- **S4-1 (pipeline sync skew is common-mode, not differential).** The RTSP-listen copy path shifts both timelines at file start: first decoded video pts 0.000000 then **0.041333** (one extra leading video frame; grid resumes at +21.333 ms = one AAC frame 1024/48000), and audio decodes **602** 10 ms windows instead of 600 (beep +20 ms). The two nearly cancel: net relative skew **-1.333 ms** (0.07 of the ±40 ms window), stable to the microsecond across 3 runs and between the two fixtures. Consequence for NM-14/M3: **AV-sync checks must assert the relative flash-to-beep offset, never absolute stream start times**; the ingest adds a ~20 ms common lead-in that is invisible to a correct relative measurement.
- **S4-2 (analyser accuracy).** On the direct controls the whole generator+analyser path is exact (0.000 / 80.000 ms — flash frame idx 150 at pts 3.0, beep window pts 3.0/3.08). The analyser has no detection bias beyond the −1.333 ms pipeline skew; AAC at 64 kbps produced **no pre-echo false onset** at the −45 dB gate, and the one-frame flash is reliably a single `bright_frame_count=1` event.
- **S4-3 (80 ms self-test semantics).** The flag decision needs a deadband, not a point: |offset| > 40 ms declares out-of-sync; the injected sample then measures inside 40–120 ms. With 20 ms video frames and 21.33 ms AAC frames, 80 ms is 4 frames of separation — the largest injection row 9 could ask for under the stated tolerance is *exactly* the smallest meaningful one; smaller injections (<= 40 ms) are **undetectable by construction** at this frame rate. M3/M4 thresholds should therefore quote (fps, window size, tolerance) together.
- **S4-4 (determinism inherited).** All three pipeline captures of each fixture are byte-identical (S1 SP-8 holds with the flash+beep source too). Row 38 can store the two SHA-256s as regression anchors; a real camera feed loses this property and must use the relative-offset rule (S4-1) instead.
- **S4-5 (one listener per fixture).** Confirms S1 G-1 operationally: 2 fixtures = 2 fresh listener processes; a driver that reused one listener would silently record only the first session.

## 6. Erratum

Run 1's `truth_aligned.json` / `truth_shifted.json` `construction` field mislabels the flash enable window's upper bound (prints the beep end instead of 3.019 — a string-formatting bug in the truth emitter). The actual FFmpeg command always used `enable='between(t,3.0,3.019)'` (the driver text is the command, §2), all measured values are unaffected, and the emitter was fixed before run 2 (run 2/3 JSONs read `[3.000,3.019]`).

## 7. Input to NM-14 (what the M3/M4 fake fixtures should look like)

Seed for `apps/capture-worker/test-fixtures/` (impact register B.6, row 31 spec hook, row 38 re-run):

1. **Generator**: black `color` source at **≥ 50 fps**, exactly one white `drawbox` fill frame whose enable window is `[T, T + 0.5/fps)`; `aevalsrc` 1 kHz burst, amplitude 0.5, length ≥ 0.2 s, start `T + injected_offset`; event time T on the frame grid and at least 2 s into the file; total duration 6 s; per-source `duration=` plus output `-t` guard. Emit a truth JSON (`flash_frame_index`, `beep_start_sample`, `true_offset_ms`).
2. **Offsets to seed**: 0 ms (sync), **±80 ms** (out-of-sync) — run 9 only proved +80; the −80 variant is one parameter change (`BEEP = 2.92`) and is the natural row-38/39 addition (§8).
3. **Analyser**: the two FFmpeg passes of §3 verbatim (signalstats YAVG ≥ 128 first-bright; 480-sample peak windows first > −45 dB); relative offset only (S4-1); verdict rule with a stated tolerance tied to fps (S4-3).
4. **Pipeline pairing**: the fixture must be exercised through the S1 capture command (same traps and flags) — S4 proves the analyser distinguishes pipeline skew from content skew; M3 fake-camera workers reuse `capture.sh`'s session shape (fresh listener per session, S4-5).
5. **Anchors**: expected relative offset −1.333 ms (pipeline) / 0 ms (direct) for the aligned fixture on this host+FFmpeg 9.0.2; byte-hash anchors `58425017…8ea98eb` (aligned) / `78e88811…ac82b522` (shifted) while inputs stay synthetic.

## 8. Gaps left for row 38 (and class C)

| # | Left open | Why not here |
|---|---|---|
| 1 | Negative injection (audio **early**, −80 ms) | row 9 specifies one injected 80 ms; analyser handles the sign (rule stated in §3) — +1 run should flip `BEEP` once |
| 2 | Detection under host load (B11 flakes) — pusher `speed` jitter could stretch fragment boundaries and perturb pts | guard rail: keep runtime short; M3 worker integration re-tests under supervision |
| 3 | Long-session AV drift (1-2 h monotonic drift fixture) | E-23: long campaigns only at handover; row 9 scope is the fixed-offset self-test |
| 4 | Sub-frame injection (e.g. 10 ms) and threshold mapping | impossible to certify below the 20 ms frame grid (§2.3); only meaningful with higher fps — row 31/38 decision |
| 5 | Real camera PTZ/MIC start-offset behaviour | class C — needs hardware; this fixture only proves the synthetic path survives ingest+fMP4 |
| 6 | Container-level injection (`adelay`/`itsoffset` on a muxed file) as a second generator mode | content-level construction was chosen for truth-by-construction; a re-mux mode would additionally test edit-list handling — cheap NM-14 add-on |

## 9. Artifacts

| Path (under `/Users/gsp-budi/Documents/DEMS/.cache/spikes/s4/`) | Role |
|---|---|
| `analyse.py` | offset analyser (measurement + verdict), re-runnable by row 38 |
| `capture.sh` | driver: port precheck, generator, S1 pipeline sessions, truth emitter |
| `monitor.py` | S1 fragment/hash watcher, unmodified copy (fragment evidence) |
| `run1/`, `run2/` | formal runs: `out_aligned.mp4` 22,483 B, `out_shifted.mp4` 22,137 B, per fixture: `manifest_*.tsv/jsonl`, `ingest_*.log`, `pusher_*.log`, `growth_*.txt`, `sizes_*.txt`, `truth_*.json`, `report_*.json`, `analyse_*.txt` |
| `run3/` | verification run: same 6 pipeline artifacts (byte-identical hashes) + `out_direct_aligned.mp4` 23,059 B, `out_direct_shifted.mp4` 23,132 B controls + `report_direct_*.json` |

Total media under `.cache/spikes/s4/`: 8 mp4 files, 181,097 B (528 KiB dir incl. manifests).

---
*Generated: 2026-10-07 17:25 · Last Updated: 2026-10-07*
