---
task_id: 2026-10-07_dems_real_capture_sealing
audit_row: AU-2 (D16 independent audit, item 2)
date: 2026-10-08
agent: verifier (Claude Code controller audit)
tier: 2
status: needs-review
verdict: S1 CONFIRMED; S2 CONFIRMED (mechanism) / evidence metric INVALID; S4 CONFIRMED (pass/fail) / -1.333 ms interpretation WRONG; STT functional check CONFIRMED; STT approach PARTIALLY CONFORMANT (CPU path unproven, install risk unstated); GStreamer deferral reason CONFIRMED
media_root: /Users/gsp-budi/Documents/DEMS/.cache/spikes/au2/ (git-ignored, .gitignore:47)
inputs_read:
  - research/06_spike_s1_fmp4_running_hash.md, 07_spike_s2_mic_switch_timeline.md, 08_spike_s4_av_sync_fixture.md, 10_spike_stt_functional_check.md, 12_spike_s3_media_engine_pick.md
  - initialization/02_stt_runtime_install.md; gateway_check/04_m1_spike_gate.md
  - identification/02_structured.md (rev 1 via `git show 2a4f4ea:...` rows 7-15, 38; rev 2 working copy rows 76-81, lines 54, 345-361)
  - masterplan/01_specs.md, 05_capture_architecture_spec.md, 07_transcript_spec.md, 10_test_strategy.md, 02_plan.md (grep-located lines cited below)
  - decisions/decisions.md D4, D7, D10-D13, D16; predecessor decisions D220-D230
---

# AU-2 — Independent re-execution of spikes S1, S2, S4 and the STT functional check

## 0. Summary

| Item | Verdict | One-line reason |
|---|---|---|
| S1 fMP4 + running SHA-256 | **CONFIRMED** | Own tail-reader tap (hashes only appended bytes) equals the whole-file SHA-256 in 4/4 graceful runs; Kilo's exact RTSP commands reproduce `3c80f46e…c14c05` byte-for-byte; killed writers leave a decodable prefix |
| S2 one-track manual mic switch | **CONFIRMED (mechanism)**, **evidence metric invalid** | Own push-mode libavfilter harness with an external asynchronous trigger switches live with 0 inserted/dropped samples; Kilo's "0.001 ms" metric reports 0.0000 ms even for a file with 20.8 ms of samples removed |
| S4 AV-sync fixture | **CONFIRMED (pass/fail)**, **-1.333 ms interpretation wrong** | Sample-exact analyser measures +0.021 ms / 80.021 ms on Kilo's own pipeline files; the -1.333 ms "pipeline skew" is the 10 ms window quantisation of Kilo's analyser |
| STT functional check | **CONFIRMED** | Own two-voice Indonesian fixture 6/6 sentences; Kilo's sealed fixture reproduces Kilo's JSON byte-identically (incl. phantom tail) |
| STT approach conformity (D222/D229/D230/OD-24) | **PARTIALLY CONFORMANT — revision required before rev 2 approval** | The tested path runs on the Apple GPU (`Device(gpu, 0)`); the CPU-only path exists only on paper, rev 2 drops its install, and its Homebrew install would also upgrade `openssl@3` (dependents ffmpeg, omlx) |
| GStreamer deferral (D12) | **CONFIRMED** | Dry-run: 1 formula + 62 dependencies + the same 11 upgrades; installed formulae unchanged (66 before/after) |

Findings: **2 High, 5 Medium, 4 Low** (section 6). Run discipline per D233: each spike ran 1 run plus 1 verification run. Host load was checked before the heavy steps (`uptime` 3.40-6.03 load on 10 cores; memory 59 % free before STT).

## 1. S1 — fragmented MP4 with a running SHA-256

**Method (own, independent of Kilo's `monitor.py`).** `.cache/spikes/au2/s1/s1_run.py` spawns `/opt/homebrew/bin/ffmpeg` (lavfi `testsrc2` + `sine`, libx264/aac mono, direct fMP4 output, `-flush_packets 1`). A tail reader polls every 50 ms, reads **only the bytes appended since the last poll**, updates one `hashlib.sha256` and logs `(offset, len, running digest)`. At about 5 s it copies the bytes present on disk to `mid.mp4` and runs ffprobe while the writer is alive. Afterwards it proves the file is append-only by recomputing `sha256(final[0:E])` for every logged chunk end `E`. Kilo's monitor re-parses boxes from its own buffer. Mine never looks at box structure, so it would also catch an in-place rewrite by the muxer.

Variants: `kf` = `+frag_keyframe+empty_moov+default_base_moof -min_frag_duration 1000000` (the recommended SP-4 default); `kilo` = Kilo's claimed flags `+empty_moov+default_base_moof -frag_duration 1500000 -fragment_index 1`.

| Claim (Kilo, `research/06` / gate `04`) | My measurement | Method | Match? |
|---|---|---|---|
| ffprobe reads the file while it grows (§4.3: 173,101 B, 6.061 s) | mid-run copy at 5.01-5.05 s: **402,959 B, 4.032 s, 2 streams, rc 0** (kf, runs 1/2/kill); **462,803 B, 4.544 s** (kilo flags); `writer_alive: true` each time | own tail + copy + ffprobe (`run*/result.json`) | **Yes** |
| Running hash = `shasum -a 256` of the closed file | kf run 1 and run 2: running `259be11a…99d99f4` = whole = `shasum`; kilo flags: `6d5df2d3…18606e3` = `shasum`; append-only prefix mismatches **0**, shrink events **0** in all 7 runs | own tap + full prefix re-hash | **Yes** |
| Exact anchor `3c80f46e…c14c05`, 327,141 B (Kilo's RTSP commands, §3) | **`3c80f46ed569b7a2bdf030ecbb23d5e923ffbe2f6464b5484e8fb399efc14c05`, 327,141 B** — reproduced with Kilo's two commands verbatim (listener 127.0.0.1:8554, pusher) | `s1/rtsp_repro/sha256.txt` | **Yes, byte-exact** |
| Determinism (SP-8) | kf run 1 == run 2 byte-identical (`259be11a…`) | own runs | **Yes** |
| SIGKILL leaves a durable prefix; kill lands on a fragment boundary (§5.3) | 4/4 own kills (kf 5.3 s, 7.7 s; kilo 5.3 s; GOP-250 7.0 s) ended on a top-level box boundary; running digest at kill = `shasum` of the killed file; normal-GOP prefixes decode rc 0 with 0 error lines (4.03 s / 6.04 s / 4.54 s durable) | own tap + box walk + `ffmpeg -v error -f null` | **Yes** (caveat AU2-08) |
| Partial-tail detection by size mismatch (§5.5) | cut inside the 3rd `mdat` (505,132 B): **ffprobe rc 0, decoder rc 0, 0 error lines, duration reported 6.037 s although only ~5 s present** — codec tools do not flag the truncation | synthetic cut of `run2_kf/out.mp4` | **Consistent** — supports Kilo's box-size detector; codec tools alone are insufficient |
| G-1: the listener exits after TEARDOWN | ingest rc 0 immediately after the pusher ends; `lsof` 8554 free afterwards | rtsp_repro | **Yes** |
| Truncation detected in 10-15 ms | not re-measured (the value is the detector's poll period triggered by writer exit, not a format property) | — | n/a |

Quoted verification (kf run 2):

```text
"running_sha256_at_stop": "259be11a5dd51e546c06124b7dfe84158d5dd0e91e90e2128df0043cc99d99f4",
"whole_file_sha256":      "259be11a5dd51e546c06124b7dfe84158d5dd0e91e90e2128df0043cc99d99f4",
"shasum_cli":             "259be11a5dd51e546c06124b7dfe84158d5dd0e91e90e2128df0043cc99d99f4",
"running_equals_whole": true, "append_only_prefix_mismatches": 0, "shrink_events": 0,
boxes: ftyp@0+28 moov@28+1220 moof@1248+960 mdat@2208+190700 … mfra@1220008+300 (n=15)
$ shasum -a 256 out.mp4   (rtsp_repro, Kilo's exact commands)
3c80f46ed569b7a2bdf030ecbb23d5e923ffbe2f6464b5484e8fb399efc14c05  out.mp4   (327,141 B)
```

Extra measurement (feeds AU2-08). With a camera-like 10 s GOP (`GOP=250 @ 25 fps`, kf flags) and a kill at 7.0 s, the file is **1,248 B (`ftyp`+`moov` only), 0 s of media, decoder rc 183**. The crash-loss window equals one fragment, and with keyframe fragments that is one camera GOP.

## 2. S2 — one audio track, manual mic switch

**Method (own, independent of Kilo's `opswitch.c`).** `.cache/spikes/au2/s2/au2_switch.c` uses two **push-mode** `abuffer` sources (`mic1` 440 Hz amplitude 0.50, `mic2` 660 Hz amplitude 0.25). Both are generated from the absolute sample index `n` and fed in **real-time 10 ms chunks** (480 samples), as a device callback would. They go into `astreamselect@asel` and then `abuffersink`, and the output is written as raw float32, which is sample-exact. The **operator trigger is an external `SIGUSR1`** sent by the shell at arbitrary moments. The handler only sets a flag, and the filtering thread then calls `avfilter_graph_send_command(g,"asel","map",…)` before the next push. Nothing about the switch time exists in the graph or the command line. Each run has two switches (A→B→A). `analyse_switch.py` attributes **every sample** to a source by exact comparison (|error| < 1e-6) with each reference evaluated at the same absolute index.

| Claim (Kilo, `research/07`, D10c) | My measurement | Method | Match? |
|---|---|---|---|
| Operator-triggered live switch works through the libavfilter API; the CLI cannot (D10c) | **Live switch confirmed** with push-fed inputs and an asynchronous external trigger: run 1 signals at wall 3018.2 / 5467.1 ms → realised at samples **144,480 (3010.000 ms) / 262,080 (5460.000 ms)**; run 2 at 1922.6 / 6473.2 ms → **91,680 (1910.000 ms) / 310,560 (6470.000 ms)** | own C harness + sample attribution (`run*_analysis.json`) | **Yes — live, not an offline render** |
| Discontinuity "0.001 ms" (file gap/drop) | **0 inserted / 0 dropped samples** across 4 switches; 384,000 samples = 8.000 s exactly; 3 runs per file, 0 unexplained samples | sample-level attribution | **Property yes** |
| … measured as the packet-grid metric (max - min packet delta) | the metric is **0.0000 ms for the intact file AND for a copy with 1,000 samples (20.8 ms) cut out at the switch** (`run1.m4a` vs `run1_drop1000.m4a`, both 376 packets, monotonic) | ffprobe packet pts | **Metric invalid** (AU2-05) |
| Exactly 1 audio stream, strictly monotonic PTS | AAC encodes of my output: 1 stream, 376 packets, monotonic | ffprobe | **Yes** |
| Realised boundary exactly +1 AAC frame (21.333 ms) after the command | in a push-mode worker the switch lands at the **next input-chunk boundary (≤ 10 ms here)**; the "1 AAC frame" figure is a property of Kilo's pull loop with 1024-sample frames | own harness log vs realised sample | **Partly** (AU2-07) |
| Hot standby (the standby input keeps running) | after every switch the samples equal the standby reference at the **absolute** index → standby timeline continuous | sample attribution | **Yes** |
| Hard tone jump, no silence, no crossfade | waveform step at the switch **0.464 / 0.423 / 0.464 / 0.706** vs normal max per-sample step 0.029 (mic1) / 0.022 (mic2) → audible click | sample analysis | **Yes** (quantified) |
| AAC round trip keeps the boundary | `run2.m4a` decoded back: switch points at the same samples (1 ms block resolution); only 144 "mixed" samples at file start (encoder priming) | `run2_aac_decodeback.json` | **Yes** |

Kilo's harness check (read, not re-run): `s2/opswitch.c:71-86` builds the sources as in-graph `sine` generators (pull mode). `:125-139` polls stdin inside the pull loop and calls `avfilter_graph_send_command` at runtime on the running graph, so it is a genuine live switch, not an offline render. It does not exercise device-fed push inputs, fMP4, or video in the same process. My harness closes the push-input gap. Fan-out into two camera files remains open as H-4 (`05_capture_architecture_spec.md:611`).

## 3. S4 — AV-sync flash + beep fixture

**Method (own).** `make_fixture.sh` generates 50 fps video that is gray (16) except frame `N==150` (luma 235). Kilo used `drawbox`; mine uses a `geq` keyed on the frame index. The audio is a 1 kHz, 0.5 amplitude, 200 ms burst keyed on the **sample index** (`aevalsrc` on `n`): aligned start 144,000, late +80 ms start 147,840, early -80 ms start 140,160. Output goes to direct fMP4 (kf flags), and the same generator is also pushed through Kilo's RTSP-listen ingest with S1 flags. `av_offset.py` takes flash = pts of the first frame whose 16x16 gray mean is above 128, and beep = audio `start_time` plus the index of the **first sample with |x| > 0.05**. That is sample-exact, where Kilo's analyser uses 10 ms peak windows.

| Claim (Kilo, `research/08`) | My measurement | Method | Match? |
|---|---|---|---|
| Aligned offset **-1.333 ms** "pipeline common-mode skew" (S4-1) | **Kilo's own `s4/run3/out_aligned.mp4`: +0.021 ms**; my fixture through the RTSP ingest **+0.021 ms**; my direct fMP4 **-0.052 ms** (video timescale rounding). The +0.021 ms is one sample: the sine starts at 0, so the 2nd sample is the first above threshold | `kilo_files_offsets.jsonl`, `au2_offsets.jsonl` | **Value reproducible only with Kilo's 10 ms windows; true offset 0.00 ms — interpretation wrong** (AU2-03) |
| Injected 80 ms measured **78.667 ms** | Kilo's `out_shifted.mp4` **80.021 ms**; mine **80.021 ms** (RTSP) / **79.948 ms** (direct) | same | **Same artefact** |
| Direct controls 0.0 / 80.0 ms "exact" | Kilo's direct files: 0.021 / 80.021 ms. They looked exact only because 3.000 s / 3.080 s fall on the 10 ms window grid; 3.021354 s (pipeline) falls 1.354 ms into a window → -1.333 ms | analysis | **Explains the artefact** |
| Pipeline shifts both streams by ~20 ms (S4-1) | both streams shifted **+21.333 ms (one AAC priming frame)**: flash pts 3.021333, beep sample 145,025 = 144,000 + 1,024 + 1 | sample/pts analysis | **Yes** (common mode, cancels) |
| Byte determinism, anchors `58425017…`/`78e88811…` | Kilo's files hash `58425017f374…` / `78e88811b9e0…`; my fixtures byte-identical across runs 1/2 (`fb369f6b…`, `9ea5f872…`) | `shasum -a 256` | **Yes** |
| Exactly one bright frame, index 150 | `bright_frames 1`, `flash_frame_index 150` in all 11 files | analyser | **Yes** |
| -80 ms case not run (Kilo gap 1) | **-80.052 ms** (audio early) correctly signed | own fixture | new evidence |
| "Injections ≤ 40 ms are undetectable by construction at this frame rate" (S4-3) | resolution of a sample-exact analyser on this fixture is about 0.05 ms; detectability is set by the chosen tolerance, not by the 50 fps grid (the flash is on the grid by construction) | analysis | **No** (AU2-04) |

**Is the ±40 ms target logic sound?** As a product sync tolerance, partly. A symmetric ±40 ms is conservative on the audio-late side. For reference (auditor knowledge, **not re-verified online in this session**): ITU-R BT.1359 puts detectability at about +45 ms (audio early) / -125 ms (audio late), and EBU R37 recommends +40 / -60 ms. As a **regression** threshold on a deterministic synthetic fixture it is **not sound**: measurement resolution is about 0.05 ms, so any regression that adds up to 39 ms of skew would pass. The fixture also cannot exercise the real DEMS failure mode, because audio and video come from one pusher and one clock (AU2-06).

## 4. STT — inventory, functional re-run, conformity

### 4.1 Inventory (read-only)

| Item | Result | Command |
|---|---|---|
| Homebrew | `espeak-ng 1.52.0`, `ffmpeg 9.0.2`, `omlx 0.6.4`; `whisper.cpp` / `whisper-cpp` / `gstreamer` **not installed** | `brew list --versions omlx ffmpeg espeak-ng whisper-cpp whisper.cpp gstreamer` |
| CPU STT binaries | `whisper-cli`, `faster-whisper`, `ct2-transformers-converter` **none**; no `whisper`/`gst`/`ctranslate`/`onnx`/`sherpa` in `/opt/homebrew/Cellar` | `command -v`, `ls /opt/homebrew/Cellar` |
| oMLX venv modules | `mlx` True, `mlx_audio` True, `faster_whisper` False, `ctranslate2` False, `whisper` False, `torch` False, `onnxruntime` True | `importlib.util.find_spec` (read-only) |
| `~/.omlx/models/` names | `gemma-4-12b-coder-oq4`, `omnivoice-bfloat16`, `qwen3-asr-1.7b-8bit`, `whisper-large-v3-turbo` (HF format, `model.safetensors`) | `ls` |
| Build tools for a source build | `cmake` **none**; `make`, `clang`, `git`, `python3.11` present | `command -v` |

### 4.2 Server lifecycle (D7 rules: serialised, logged, key never printed)

| Step | Time (+07:00) | Evidence |
|---|---|---|
| Pre-check | 2026-10-08 05:26:33 | `lsof -iTCP:8000 -sTCP:LISTEN` → none; `pgrep -fl omlx` → none; no pidfile; `status.sh` → `STATUS : DOWN`; last oMLX log write 2026-10-07 17:29 (Kilo gate). SMART WMS `tsx watch` dev servers were running, but with oMLX down no SMART WMS job could be using it |
| Log preserved | 05:26 | `start.sh` truncates `~/.omlx/logs/omlx-serve.log`; the previous 6,851 B log was copied to `au2/stt/prev_omlx-serve.log.bak` after a count-only secret scan (0 matches) |
| Start (`~/Documents/omlx-script/start.sh`) | 05:26:48 | `PID 25196`, `oMLX siap: http://127.0.0.1:8000`; `lsof`: `Python 25196 … TCP 127.0.0.1:8000 (LISTEN)` |
| Run 1 request | 05:26:55 | own fixture, whisper-large-v3-turbo, http 200 |
| Verification request | 05:27:04 | Kilo's sealed fixture, http 200 |
| Stop (`stop.sh`) | 05:27:18 | `Menghentikan oMLX (PID 25196)... oMLX berhenti.` |
| Down confirmed | 05:27:21 | `STATUS : DOWN`; port 8000 no listener; `pgrep` none; pidfile absent; log secret-like count 0 |

oMLX was UP for **30 s**, two serialised requests, no VLM session, no upgrade. The key was loaded only inside `lib/common.sh` (`:13-20`) by `transcribe.sh`, sent as a curl header, and `unset` afterwards. It never appears in output or files (`grep` count 0 over `.cache/spikes/au2/`).

### 4.3 Functional runs

Run 1 uses my own fixture (`au2_two_voice_id.wav`, 28.03 s, 16 kHz mono, sha256 `1944fd74…1514a388`): espeak-ng `id` (male) alternating with `id+f3` (female), six scripted sentences of an interview, 0.5 s gaps.

```text
http=200   request_wall_s=1.98 (latency observation only, not a throughput figure)
{"language":"id","text_len":306,"segments":6,"first":{"start":0.0,"end":4.7},"last":{"start":22.22,"end":27.12}}
0.0-4.7| Selamat siang. Kita mulai pemeriksaan saksi pada hari ini.
5.6-8.4| Baik, saya siap memberikan keterangan.
9.38-12.38| Di mana Anda berada pada malam kejadian itu?
13.32-16.42| Saya berada di rumah bersama keluarga saya.
17.36-21.28| Apakah ada orang lain yang dapat memastikan hal tersebut?
22.22-27.12| Ya, tetangga saya melihat saya pulang sekitar pukul 8 malam.
```

Result: 6/6 sentences, one segment per sentence, all timestamps inside the file. The only deviation is spoken "delapan" written as the digit "8", a numeral-normalisation behaviour row 33 should expect.

The verification run uses Kilo's sealed fixture (`stt-check/fixture-two-speaker-id.wav`, sha256 `6743181a…c0f4fe71`, matches row 12):

```text
6801 …/stt-check/runs/whisper-run1.json
6801 run2_whisper_kilofixture.json
IDENTICAL to Kilo whisper-run1.json (jq -S)
65.54-95.52| Terima kasih atas kerjasamanya.     <- phantom tail past the 65.72 s file, as Kilo reported
```

| Claim (row 10 / row 12 / gate) | My measurement | Match? |
|---|---|---|
| whisper: 17 segments, 897 chars, `language id`, byte-identical across runs | identical JSON (`jq -S` + `cmp`), 6,801 B | **Yes** |
| phantom tail segment 65.54-95.52 s | present | **Yes** |
| engine uses Metal by design (row 12 §1) | log `MLX executor thread initialized: generation_stream = ThreadLocalStream(Device(gpu, 0), 4)`; `mx.default_device() = Device(gpu, 0)`, `metal available = True`; `Metal cap (17.8GB …)` | **Yes — it runs on the Apple GPU** |

### 4.4 Conformity of the STT approach

| Decision | What it requires | What exists | Conformant? |
|---|---|---|---|
| D222 | "STT full compute di cpu + ram" — product STT on CPU + RAM, no GPU | Tested path = MLX on `Device(gpu, 0)` | **No** for evidence purposes; acceptable only as a dev tool under D7 |
| D229 | MLX copy excluded **because** it runs on the Apple GPU only and conflicts with D222 | rev 2 `02_structured.md:54` keeps the oMLX server as "a different artifact". It loads the HF copy **through MLX onto the GPU**, so the reason for the exclusion applies equally | **Wording misleading** (AU2-11); allowed only through D7's later explicit user instruction |
| D230 | "a working STT path first — the existing Whisper large-v3-turbo through a **CPU runtime**" | no CPU runtime installed, no model in a CPU format, no code (`git grep cpu-local\|whisper-cli\|TranscriberAdapter -- ':!docs'` → 0 hits) | **No** |
| OD-24 (D4) | whisper.cpp (Homebrew) + conversion venv | rev 2 `02_structured.md:349`: "item 1 -> D7 reuse (row 10 done, no install)"; no rev-2 row installs it; but D7(b) says the CPU runtime "is NOT cancelled … the install moves to a later wave", and `02_plan.md:212` M6-W1 still depends on "Q-INSTALL 1/5" | **Internally inconsistent** (AU2-01) |
| C-N1 (`01_specs.md:219`) | verification: "Row-12 functional check quoted command shows GPU disabled" | row 12 ran on the GPU; gate `04` STT-5 marked PASS on "adaptation documented" | **Criterion unmet; gate softened** (AU2-01) |
| D7 | reuse the installed oMLX for Mac-side transcription work | reused correctly; start/stop logged; key never printed; never upgraded | **Yes** |
| Test proving `cpu-local` | — | M6-AD-1 (`10_test_strategy.md:212`) is a 1-run contract unit test; M6-TF-1 (`:208`) names no backend and, with no CPU runtime on this Mac, would run on `omlx-server`; row 76 verification = "cpu-local backend code-complete" | **Paper only** until class C |

**Conformity verdict: PARTIALLY CONFORMANT.** The oMLX/MLX path conforms to D7 as a development and functional-check tool, and its functional behaviour is confirmed. It provides **no evidence** for the user's CPU + RAM requirement (D222/D230). The CPU-only `cpu-local` path is specified (`07_transcript_spec.md` §B.3) but has no install row, no model-conversion row (row 11 was skipped "by reuse", which only holds for the oMLX path), and no executable test anywhere in M1-M9. Its Homebrew install also carries an unstated shared-library upgrade risk (AU2-02). As planned, the first time a CPU transcription would ever run is class C on the real Core hardware, which contradicts D230's "working STT path first".

## 5. GStreamer deferral (D12) — read-only re-check

`HOMEBREW_NO_AUTO_UPDATE=1 brew install --dry-run gstreamer` (run outside the sandbox because Homebrew refuses read-only prefixes; nothing installed):

```text
==> Would install 1 formula:            gstreamer 1.28.7_2
==> Would install 62 dependencies for gstreamer: aom faac faad2 libogg flac gdk-pixbuf … (62)
==> Would upgrade 11 dependencies for gstreamer:
libpng pcre2 glib xorgproto ca-certificates openssl@3 sdl3 sdl2-compat xz harfbuzz readline
brew list --formula --versions: 66 before, 66 after, identical (cmp)
brew uses --installed --recursive openssl@3 -> ffmpeg jundot/omlx/omlx libgit2 libssh2 python@3.11 rust
brew uses --installed --recursive glib      -> cairo harfbuzz openjdk@17
brew uses --installed --recursive harfbuzz  -> openjdk@17
```

**D12 reason confirmed** (1 + 62 + 11, same package names; omlx, ffmpeg and openjdk@17 are installed dependents). The dry-run prints names without versions, so Kilo's from→to versions were not re-verified. The claim that an upgrade "would destroy the mlx-audio patch" is plausible (an `openssl@3` upgrade can trigger a dependent reinstall of `omlx`) but was not demonstrated; it stays a hypothesis.

## 6. Findings and proposed revisions

| ID | Severity | Finding (evidence) | Proposed revision |
|---|---|---|---|
| AU2-01 | 🔴 High | **The CPU-only STT path has no executable proof and rev 2 dropped its install.** Rev 2 `02_structured.md:349` maps Q-INSTALL item 1 to "D7 reuse … no install". That contradicts D7(b) and `02_plan.md:212`. Row 76's verification is "code-complete" only; M6-AD-1 is a 1-run contract unit test; no repo code exists (0 `git grep` hits). C-N1's verification (`01_specs.md:219`) is unmet, yet gate `04` STT-5 passed on "adaptation documented". Row 11 (model conversion) was skipped although `cpu-local` needs a ggml/CT2 model. | Add a rev-2 row after 76, **"cpu-local functional check"**: install the CPU runtime (route per AU2-02), obtain the model in CPU format (row 11 un-skipped for `cpu-local`: convert `~/.omlx/models/whisper-large-v3-turbo` in the isolated `.cache/` venv, or download ggml turbo weights under OD-20), then run M6-TF-1 on `cpu-local` with `-ng` visible in the quoted command, 2+1, no RTF. The M6 gate (row 81) must run the functional check on **both** backends. Reword `02_structured.md:349`. Mark gate `04` STT-5 and row-12 acceptance as "CPU clause deferred to row X", not PASS. In Q-D7, state that default (a) without this row leaves the CPU path untested until class C. |
| AU2-02 | 🔴 High | **The whisper.cpp Homebrew install has the same shared-library upgrade problem as GStreamer and is unstated.** `brew install --dry-run whisper-cpp` → `whisper.cpp 1.9.5` + 3 dependencies (`libomp ggml llama.cpp`) + **4 upgrades (`ca-certificates openssl@3 sdl3 sdl2-compat`)**; `openssl@3` installed dependents include `ffmpeg` and `jundot/omlx/omlx`. `cmake` is absent, so a source build also needs a tool. | Put a CPU-runtime route question at the second gate (next to Q-INST-1): (a) Homebrew `whisper.cpp` in a maintenance window with the Q-INST-1 procedure (record the omlx libexec patch state first, then re-verify ffmpeg/omlx); (b) a source build of whisper.cpp under `.cache/` with `cmake` from an isolated venv (Q-INSTALL item 2), `GGML_METAL=OFF`, zero Homebrew change; (c) defer explicitly to class C and state the risk. Auditor recommendation: (b). |
| AU2-03 | 🟡 Medium | **The S4 "-1.333 ms pipeline skew" is an analyser artefact.** A sample-exact analyser on Kilo's own files gives +0.021 / 80.021 ms (§3); the -1.333 ms is 10 ms window quantisation of an onset at 3.021354 s. Pinned as fact in `05_capture_architecture_spec.md:54`, `:522`, `:524` ("bias of the copy path"), `01_specs.md:386`, `10_test_strategy.md:102-103`, `02_plan.md:96`, `research/08` S4-1/S4-2/§7.5. | Replace with "relative offset 0.00 ms (±0.05 ms, sample-exact); the copy path shifts both streams by one AAC priming frame (21.333 ms), which cancels; -1.333 ms was row 9's 10 ms-window resolution". The NM-14 analyser should detect audio onset at sample resolution (or report its resolution next to every anchor). Anchors: aligned 0 ± 0.1 ms, injected ±80 ± 0.1 ms. |
| AU2-04 | 🟡 Medium | **±40 ms is a product tolerance, not a regression tolerance.** On a deterministic fixture with about 0.05 ms resolution, a regression adding up to 39 ms of skew passes. S4-3's "≤ 40 ms injections are undetectable by construction at this frame rate" is wrong. Only +80 ms was tested; -80 ms measures -80.052 ms. | Split the thresholds: synthetic-fixture regression bound **≤ 2 ms** (or ≤ 1 AAC frame if the analyser stays windowed); product/class-C bound stated asymmetrically with a cited standard (EBU R37 / ITU-R BT.1359, to be verified by the doc row). Add the -80 ms fixture to NM-14 and M1-S4-2. |
| AU2-05 | 🟡 Medium | **The S2 "0.001 ms discontinuity" metric cannot detect a gap.** Packet-grid uniformity reads 0.0000 ms for a file with 20.8 ms of samples removed (§2). The property holds (0 dropped/inserted samples, own sample-level test), but specs/tests use the blind metric: `05_capture_architecture_spec.md:497`, `01_specs.md:163`, `:323`, `:386`, `10_test_strategy.md:100` (M1-S2-3), `:194` (M5-SW-W). | Redefine the check: (1) decoded sample count = media duration × 48,000 (± priming); (2) per-input continuity across the boundary checked against the pre-encode capture manifest (or reference tones in fixtures); (3) keep 1-stream + monotonic PTS as secondary checks. Drop "0.001 ms measured" as evidence of gaplessness. |
| AU2-06 | 🟡 Medium | **S4 does not exercise the DEMS AV topology.** In S4, audio and video come from one pusher and one clock. In DEMS, camera video arrives by RTSP copy (camera clock/RTP) and mic audio is captured on the host, selected and encoded (host clock), then muxed into **two** camera files. Clock-domain alignment and drift are not in `05_capture_architecture_spec.md` §J (H-1..H-9; H-4 covers only the two-file fan-out). | Add **H-10 "camera video clock vs host audio clock alignment/drift"** to §J. Add an M3 check: fake camera in a separate process (own clock, injected ±80 ms and a slow drift) plus host-fed audio through the selector, flash/beep across both, analysed per camera file. Long-session drift stays class C (pre-handover campaign per D233). |
| AU2-07 | 🟢 Low | **The S2 latency bound and thread rule are harness-specific.** "Command → boundary exactly 1 AAC frame (21.333 ms)" comes from Kilo's 1024-sample pull loop; a push-mode worker switches at the next input chunk (≤ 10 ms in AU-2). `avfilter_graph_send_command` must run on the filtering thread (AU-2 used signal → flag → filter thread). The switch is a hard cut with a waveform step of 16-24x the normal per-sample step (audible click). | `05_capture_architecture_spec.md` §E "Guarantee": "≤ one worker input quantum + IPC latency (≤ 21.333 ms with 1024-sample frames)"; add "commands are applied on the filtering thread only"; record a UX decision on an optional 5-10 ms crossfade (runtime `volume` commands) or explicitly accept the click. **D10c verdict: confirmed live.** |
| AU2-08 | 🟡 Medium | **The crash-loss window and GOP control are unstated on the copy path.** All kills land on a box boundary, so a SIGKILL loses the whole in-RAM fragment. With keyframe fragments that is one GOP, and on `-c copy` the GOP is the **camera's** setting, not `CAPTURE_GOP_FRAMES=50` (row 48 / Q-SP-4). Measured: 10 s GOP, kill at 7 s → **0 s durable media** (1,248 B). A truncated `mdat` is silent to ffprobe/decoder (rc 0, duration over-reported). | §C.1: state RPO = one fragment = one camera GOP. Enforce camera `GovLength` through ONVIF at session start (H-7) and verify the observed keyframe interval from the first fragments; add a hard ceiling (`-frag_duration` max, accepting a mid-GOP cut) or a `CAPTURE_GOP_TOO_LONG` warning. Add a long-GOP fake-camera fixture (e.g. `-g 250`) to M3. Keep box-size truncation detection mandatory (codec tools are not a detector). |
| AU2-09 | 🟢 Low | S1-S4 spikes ran only on synthetic sources (by guard rail). The RTSP listener in S1/S4 binds 127.0.0.1 (matches SEC35-23). No issue; recorded for completeness. | None. |
| AU2-10 | 🟢 Low | `start.sh` truncates `~/.omlx/logs/omlx-serve.log` (`> "$OMLX_LOG"`), so the log lines quoted in rows 10/12/38 cannot be re-read after any later start. | Runbook (`initialization/02` §5): copy the relevant log lines into the task folder at use time, or back up the log before `start.sh` (as AU-2 did). |
| AU2-11 | 🟢 Low | `02_structured.md:54` says the MLX fp16 copy is excluded but the oMLX server "is a different artifact and stands". The server runs the HF copy through MLX on `Device(gpu, 0)`, so D229's reason (Apple-GPU only) applies to it as well. | Reword: "excluded for the product path; D7 permits the oMLX/MLX server (Apple GPU) for development and functional checks only; product STT = `cpu-local` (D222)". |

## 7. Hygiene

- Media only under `/Users/gsp-budi/Documents/DEMS/.cache/spikes/au2/` (`git check-ignore -v` → `.gitignore:47:.cache/`). Large temporaries were deleted (S1 `out.mp4`/`mid.mp4`/`partial.mp4`, S2 `.f32`, STT turn wavs); the folder is 1.5 MB with small evidence kept (S4 mp4s about 25 KB each, `run1.m4a`, `run1_drop1000.m4a`, `run2.m4a`, the 0.9 MB STT fixture, JSON/TSV results, scripts).
- `git status --porcelain` media count **0**; `.cache` entries **0**; no tracked file changed by AU-2. Kilo's producer folders under `.cache/spikes/{s1,s2,s4,stt-check}` were only read.
- Secret scan over `.cache/spikes/au2/`: 0 files with key-like strings; the oMLX log has a 0 count after the run.
- Ports: 8554 used twice for single loopback sessions (free before and after); 8000 restored to no listener; oMLX left **DOWN** as found.
- Sandbox notes: local port binding, Homebrew dry-run and oMLX start/stop needed unsandboxed execution (EPERM / unwritable prefix inside the sandbox). Each was a single, scoped command; no install, no upgrade.

## 8. Evidence index (`/Users/gsp-budi/Documents/DEMS/.cache/spikes/au2/`)

| Path | Content |
|---|---|
| `s1/s1_run.py` | own S1 harness (tail-hash tap, mid-run probe, append-only proof, kill mode, `GOP` env) |
| `s1/run{1,2}_kf/`, `run1_kill/`, `run2_kill/`, `run1_kilo/`, `run1_kilo_kill/`, `gop250_kill/` | `result.json`, `chunks.tsv`, `writer.err` per run |
| `s1/rtsp_repro/sha256.txt` | `3c80f46e…c14c05  out.mp4` (Kilo's exact commands) |
| `s2/au2_switch.c` (+ binary), `s2/analyse_switch.py` | own push-mode switch harness and sample-level analyser |
| `s2/run{1,2}.log`, `run{1,2}_analysis.json`, `run2_aac_decodeback.json`, `run1.m4a`, `run1_drop1000.m4a`, `run2.m4a` | switch logs, sample attribution, blind-metric demonstration |
| `s4/make_fixture.sh`, `s4/av_offset.py` | own generator and sample-exact analyser |
| `s4/au2_offsets.jsonl`, `s4/kilo_files_offsets.jsonl`, `s4/run1/*.mp4`, `s4/run2/*.mp4` | measurements on own and Kilo files |
| `stt/transcribe.sh`, `stt/script.tsv`, `stt/au2_two_voice_id.wav` | key-safe client, own fixture script and audio |
| `stt/run1_whisper_au2fixture.json`, `stt/run2_whisper_kilofixture.json`, `stt/prev_omlx-serve.log.bak` | transcripts; pre-run oMLX log backup |

## Issues / Decisions

| Item | Decision |
|---|---|
| `masterplan/02_plan.md` tracking table | Not edited: parallel run, shared file. The controller should add AU-2 = done (needs-review) and route AU2-01..AU2-11 |
| Kilo's 10-15 ms truncation-detection figure | Not re-measured: it is a detector-poll property, not a format property |
| Use of Kilo's sealed STT fixture | Allowed by the brief; my own espeak-ng fixture was added so the functional verdict does not rest only on Kilo's bytes |

## Next steps

1. Controller: route AU2-01 and AU2-02 to the rev-2 blueprint (task-architect) before the second approval gate, as one new row plus one gate question.
2. Route AU2-03, AU2-04, AU2-05, AU2-07 and AU2-08 as text/test-definition errata to rows 31/36 owners (capture spec §C.1/§E/§F/§J, test strategy M1-S2-3, M1-S4-1/2, M5-SW-W).
3. Route AU2-06 as a new hypothesis H-10 and an M3 check.

---
*Generated: 2026-10-08 05:40*
*Last Updated: 2026-10-08 05:40*
