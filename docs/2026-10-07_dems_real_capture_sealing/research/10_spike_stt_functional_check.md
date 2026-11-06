---

> **Erratum (2026-10-08, audit AU-2 / D18, D22):** measured history kept as recorded. The S2 '0.001 ms gap' metric is blind (it reads 0 on a copy with 20.8 ms removed) — replaced by a sample-count + continuity check; the switch bound is per input chunk (10 ms live), and the switch clicks audibly. The STT check ran on the oMLX server on the Apple GPU (`Device(gpu, 0)`); the CPU-only clause of R-5 AC-1 is still to be proven (blueprint rev 2.1). Corrections: `masterplan/11_audit_errata.md`.

task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 12 (RE-SCOPED by D7/D10d: functional STT check on a synthetic two-speaker Indonesian fixture via the installed oMLX engines; no benchmark, no throughput figures per D230)
milestone: M1
date: 2026-10-07
agent: coder-execution
tier: 2
status: complete
source_plan: docs/2026-10-07_dems_real_capture_sealing/masterplan/01_specs.md (row-12 AC items 1-2), decisions/decisions.md D7/D10/D12
external_queries: 0
installs_performed: 0
downloads_performed: 0
scratch: .cache/spikes/stt-check/ (git-ignored, .gitignore:47)
server_state_final: DOWN (hand-over state restored)
last_updated: 2026-10-07 16:45 (+07:00)
---

# Row 12 (re-scoped) - Functional STT check on a two-speaker Indonesian fixture

All work confined to `.cache/spikes/stt-check/` plus the two deliverable files.
No installs, no model downloads, no network calls beyond loopback `127.0.0.1:8000`.
`~/Documents/omlx-script/`, `~/.omlx/` and the SMART WMS project were not modified.
The API key (`~/.omlx/settings.json` -> `auth.api_key`) was consumed only inside the
operator scripts (`lib/common.sh`) and, for the JSON-capture requests, exported into a
shell variable in the same invocation as `curl` - never printed, never written to any file.
Scratch secret scan (2026-10-07): `grep -rliE "bearer|api_key|sk-" .cache/spikes/stt-check` -> **no matches**.

## 1. Criterion adaptation (stated explicitly, per the re-scope)

The original row-12 Verification column (`identification/02_structured.md:192`) reads:
"In 2 runs: non-empty JSON transcript with timestamps; **GPU/Metal disabled in the quoted
command**; >= 1 segment per scripted sentence; no throughput claim". The CPU/GPU clause was
written for the portable CPU runtime (`whisper-cli -ng`, research/04 F-row set; the row-4
board finding "`whisper-cli` has NO `-otype` flag ... CPU-only switch is `-ng/--no-gpu`,
threads `-t`"). Under **D7** this check runs on the **installed oMLX/MLX engine, which uses
the Apple GPU (Metal) by design** - the user's instruction was to reuse what is on this Mac
("gunakan saja yang ada di pc"), and a functional check proves the engines work, not their
speed. Quoted evidence that the GPU is used by design and that no CPU flag exists here:

```
$ grep -a "Metal\|Loaded model" ~/.omlx/logs/omlx-serve.log   (this session's run)
2026-10-07 16:27:45,774 - omlx.process_memory_enforcer - WARNING - Metal cap (17.8GB, Apple
max_recommended_working_set_size) is below the oMLX static ceiling (18.0GB); leaving Apple's
default Metal cap active because iogpu.wired_limit_mb is unset. ...
2026-10-07 16:28:44,378 - omlx.engine_pool - INFO - Loaded model: omnivoice-bfloat16 (actual: 2.09GB, local estimate: 1.20GB, full model: 1.20GB, total: 1.20GB)
2026-10-07 16:31:05,629 - omlx.engine_pool - INFO - Loaded model: whisper-large-v3-turbo (actual: 1.55GB, local estimate: 1.58GB, full model: 1.58GB, total: 2.78GB)
2026-10-07 16:32:40,182 - omlx.engine_pool - INFO - Loaded model: qwen3-asr-1.7b-8bit (actual: 2.26GB, local estimate: 2.41GB, full model: 2.41GB, total: 5.19GB)

$ omlx serve --help | grep -iE "device|metal|cpu|gpu"
no device/cpu/gpu flags in omlx serve --help
```

Discovery lines (same log) fix the engines unambiguously:
`Discovered model: omnivoice-bfloat16 (type: audio_tts, ...)`,
`Discovered model: qwen3-asr-1.7b-8bit (type: audio_stt, ...)`,
`Discovered model: whisper-large-v3-turbo (type: audio_stt, ...)`.

The CPU-only constraint is **not cancelled** - it governs the shipped production path:
the `cpu-local` backend (whisper.cpp, `-ng`, threads `-t`) remains the deferred Q-INSTALL
item 1 wave for the x86 Linux Core (D229/D230/R-7; `initialization/02_stt_runtime_install.md` §4
rows "CPU-only STT on the x86 Linux Core: NO ... portable whisper.cpp install stays required").

Also inherited from D10d and re-confirmed by this session: the server's `duration` JSON field
is unreliable and was not used for any criterion (section 6).

## 2. Fixture construction (scratch `/.cache/spikes/stt-check/`)

### 2.1 Two speaker reference voices (generated with the installed tools, kept in `refs/`)

The host has **no male Indonesian `say` voice** (`say -v '?'` lists exactly one `id_ID`
voice: `Damayanti`), so speaker A uses the guide §2.5 documented route (`say -v Daniel`,
en_GB male, with its recorded caveat that an English reference may carry accent into the
cloned timbre); speaker B uses the native Indonesian female voice. The two references are
acoustically distinct voices, which is all the fixture requires (diarization itself is M6 /
row 33, not this row).

| Speaker | Role | Voice used for reference | Generation command | ffprobe | sha256 |
|---|---|---|---|---|---|
| A | examiner (male timbre) | macOS `Daniel` (en_GB) | `say -v 'Daniel' -o ref-a.aiff "This is a reference recording of a calm male speaker. The interview will begin shortly. Please take your seat and review the agenda." && afconvert -f WAVE -d LEI16@24000 -c 1 ref-a.aiff ref-a.wav` | `duration=7.323667` `sample_rate=24000` `channels=1` `codec_name=pcm_s16le` `size=355632` | `88d83fae...a22d3e` |
| B | subject (female timbre) | macOS `Damayanti` (id_ID) | `say -v 'Damayanti' -o ref-b.aiff "Halo, nama saya Damayanti. Ini adalah rekaman referensi untuk uji sistem wawancara." && afconvert -f WAVE -d LEI16@24000 -c 1 ref-b.aiff ref-b.wav` | `duration=6.926833` `sample_rate=24000` `channels=1` `codec_name=pcm_s16le` `size=336584` | `a7df10aa...f0302` (full: see section 8) |

Both exact `TTS_REF_TEXT` strings are recorded in `refs/README-refs.txt` and used verbatim
in the synthesis calls below (guide §2.5: `ref_text` must match the reference content).

### 2.2 Ground-truth script (13 scripted sentences, turn-taking)

Saved at `.cache/spikes/stt-check/fixture-script.txt` (tab-separated turn-id / speaker / text).
Examiner = A (cloned from `ref-a.wav`), subject = B (cloned from `ref-b.wav`), alternating,
13 sentences (>= the 6 required):

```
A1 Selamat pagi, terima kasih sudah hadir pada wawancara hari ini.
B1 Selamat pagi, terima kasih atas undangannya.
A2 Sebelum kita mulai, tolong jelaskan peran Anda di gudang.
B2 Saya bekerja sebagai operator penerimaan barang dan memeriksa jumlah setiap kiriman.
A3 Berapa lama proses penerimaan biasanya berlangsung?
B3 Umumnya sekitar satu jam, tergantung padatnya kiriman.
A4 Apa harapan Anda terhadap sistem yang baru?
B4 Saya berharap pencatatan lebih cepat dan setiap bukti penerimaan tersimpan rapi.
A5 Sekarang saya ingin mendengar kendala teknis yang Anda alami sehari-hari.
B5 Kadang jaringan di gudang lambat, sehingga pemindaian harus diulang beberapa kali.
A6 Apakah ada saran perbaikan dari sisi pengguna?
B6 Sebaiknya perangkat pemindai diganti secara berkala dan pelatihan singkat diadakan rutin.
A7 Baik, wawancara kita tutup dengan rekaman ini, terima kasih atas kerja samanya.
```

Client-side normalisation per guide §2.2 is applied: **no raw digits and no acronyms appear
anywhere** (numbers would be spelled out - "satu jam" is already words; the risky "DEMS"/"WMS"
tokens were deliberately kept out of the spoken script).

### 2.3 Synthesis commands (one per turn, alternating clone references)

Driver: `.cache/spikes/stt-check/synth-turns.sh` (scratch only). Per turn it exports
`TTS_REF_AUDIO=<refs/ref-a.wav|ref-b.wav>` + `TTS_REF_TEXT=<exact reference text>` and runs
`/Users/gsp-budi/Documents/omlx-script/tts.sh "<turn text>" omnivoice-bfloat16 id turns/<ID>.wav`.
Quoted outputs (from `tts-synthesis.log`, 16:28-16:30) - every turn produced exactly one
chunk, `sample_rate=24000Hz`, e.g.:

```
=== turn A1 (speaker A) ===
chunks=1
voice cloning: ref_audio=/Users/gsp-budi/Documents/DEMS/.cache/spikes/stt-check/refs/ref-a.wav
durasi=4.4s  sample_rate=24000Hz
.../turns/A1.wav: RIFF (little-endian) data, WAVE audio, Microsoft PCM, 16 bit, mono 24000 Hz
OK: .../turns/A1.wav
```

Measured per-turn durations (ffprobe; the four later-added turns quote the `durasi` printout
rounded to 0.1 s):

| Turn | s | Turn | s | Turn | s |
|---|---|---|---|---|---|
| A1 | 4.440 | B3 | 3.920 | B5 | 5.9 |
| B1 | 3.160 | A4 | 3.040 | A6 | 3.3 |
| A2 | 4.040 | B4 | 5.800 | B6 | 6.6 |
| B2 | 6.120 | A5 | 5.3 | A7 | 5.600 |
| A3 | 3.760 | | | | |

Speech total 60.98 s.

### 2.4 Concatenation into one wav

```
/opt/homebrew/bin/ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t 0.4 -c:a pcm_s16le gap-04.wav
concat.txt = turns in script order separated by gap-04.wav (25 entries, `grep -c "^file" concat.txt` = 25)
/opt/homebrew/bin/ffmpeg -y -f concat -safe 0 -i concat.txt -c copy fixture-two-speaker-id.wav
```

Final fixture probe:

```
$ ffprobe -show_entries format=duration,size -show_entries stream=sample_rate,channels,codec_name,bits_per_sample fixture-two-speaker-id.wav
codec_name=pcm_s16le  sample_rate=24000  channels=1  bits_per_sample=16
duration=65.720000  size=3154638
sha256 = 6743181a7d976ca24c03ad8e427d6d7093fbb0b9f72257e6e2f91dcfc0f4fe71
```

~60 s achieved: **65.72 s** total (60.98 s of speech + 12 x 0.4 s inter-turn gaps).
Actual sample rate recorded honestly: **24 kHz mono** (the OmniVoice/TTS native rate). The
file endpoint accepts wav as-is; the realtime WebSocket profile (16 kHz mono PCM int16,
guide §1.6) is a capture-path concern for rows 33/36, not this file-endpoint check.

## 3. Server lifecycle (hand-over DOWN -> UP -> DOWN)

| Step | Command | Quoted output |
|---|---|---|
| Pre-check | `cd ~/Documents/omlx-script && ./status.sh` | `STATUS : DOWN (http://127.0.0.1:8000)`; `lsof -nP -iTCP:8000 -sTCP:LISTEN` -> `port 8000: no listener`; pidfile: none |
| Start | `./start.sh` | `Menjalankan omlx serve (model-dir=/Users/gsp-budi/.omlx/models, 127.0.0.1:8000)...` / `PID 17201  \|  log: /Users/gsp-budi/.omlx/logs/omlx-serve.log` / `oMLX siap: http://127.0.0.1:8000` |
| Up check | `./status.sh`; `lsof` | `STATUS : UP   http://127.0.0.1:8000` / `PID    : 17201`; `Python  17201 ... TCP 127.0.0.1:8000 (LISTEN)`; models listed incl. `omnivoice-bfloat16`, `qwen3-asr-1.7b-8bit`, `whisper-large-v3-turbo` |
| Work | TTS synthesis (17 calls incl. retries/turns) + 6 STT requests, serialised (D7 standing rule; no VLM session started - gemma untouched) | sections 2.3, 4 |
| Stop | `./stop.sh` | `Menghentikan oMLX (PID 17201)...` / `oMLX berhenti.` |
| Down check | `./status.sh`; `lsof`; pidfile; `pgrep -fl "omlx serve"` | `STATUS : DOWN (http://127.0.0.1:8000)`; `port 8000: no listener`; `pidfile: none`; pgrep empty |

PID before stop: **17201** (matches pidfile); PID after stop: **none** (process gone, pidfile
deleted by `stop.sh`). Memory: pool log reached `total: 5.19GB` with all three audio models
loaded (section 1 quote), consistent with the row-10 note (~5.2 GB); `status.sh` RSS showed
only `PID 17201 ... RSS 0.20 GB` before stop - the row-10 caveat that `ps`/`status.sh` RSS
under-reports Metal buffers stands.

## 4. The three functional runs

Run protocol: each **run** = the canonical script invocation
`~/Documents/omlx-script/stt.sh <fixture> <model> id` (stdout captured), plus one
identical-parameters `POST /v1/audio/transcriptions` (guide §1.2 shape) to capture the
**full JSON** response, because `stt.sh` itself prints only `.text` + `{language,duration,segments}`
(`stt.sh:32-35`). 6 decode requests total, serialised.

### 4.1 Run 1 - whisper-large-v3-turbo (stt.sh:083042-style first request after server start = model load)

Commands: `/usr/bin/time -p ~/Documents/omlx-script/stt.sh fixture-two-speaker-id.wav whisper-large-v3-turbo id`
then the identical curl; outputs `runs/whisper-run1.stdout.txt`, `runs/whisper-run1.json`.

JSON summary (`runs/whisper-run1.json`, 6,801 B): `language: "id"`, `text_len: 897`,
`segment_count: 17`, `first_start: 0.0`, `last_end: 95.52`, stt.sh meta line:
`{"language":"id","duration":0.0,"segments":17}`.
Latency observation (labelled, **not** a throughput statement): wall request time **7.36 s**
including the first-request model load (`Loaded model: whisper-large-v3-turbo ... total: 2.78GB`, log 16:31:05).

Per-segment dump (`|id|start-end|`):

```
0|0.0-4.26| Selamat pagi, terima kasih sudah hadir pada wawancara hari ini.
1|4.96-7.84| Selamat pagi, terima kasih atas undangannya.
2|8.52-12.38| Sebelum kita mulai, tolong jelaskan peran Anda di gudang.
3|13.08-18.72| Saya bekerja sebagai operator penerimaan barang dan memeriksa jumlah setiap kiriman.
4|19.74-23.06| Berapa lama proses penerimaan biasanya berlangsung?
5|23.62-27.36| Umumnya sekitar satu jam, tergantung padatnya kiriman.
6|27.36-30.74| Apa harapan Anda terhadap sistem yang baru?
7|31.4-37.1| Saya berharap pencatatan lebih cepat dan setiap bukti penerimaan tersimpan rapi.
8|37.88-41.04| Sekarang saya ingin mendengarkan dalam teknis yang...
9|41.04-42.66| ...yang zalami sehari-hari.
10|43.26-48.72| Kadang jaringan di gudang lambat, sehingga pemindaian harus diulang beberapa kali.
11|49.98-52.64| Apakah ada saran perbaikan dari sisi pengguna?
12|52.64-59.5| Sebaiknya perangkat pemindai diganti secara berkala dan pelatihan singkat diadakan rutin.
13|60.2-60.68| Baik.
14|61.02-63.4| Wawancara kita tutup dengan rekaman ini.
15|63.74-65.54| Terima kasih atas kerjasamanya.
16|65.54-95.52| Terima kasih atas kerjasamanya.   <-- phantom tail, past the 65.72 s of audio
```

Whisper segment fields present: `avg_logprob`, `compression_ratio`, `end`, `id`,
`no_speech_prob`, `seek`, `start`, `temperature`, `text`, `tokens` (`jq '.segments[0]|keys'`).

### 4.2 Run 2 - whisper-large-v3-turbo (verification run, warm)

`runs/whisper-run2.stdout.txt` / `runs/whisper-run2.json`: identical meta
`{"language":"id","duration":0.0,"segments":17}`. The two run JSONs are **byte-identical**
after key-sorting (`cmp -s <(jq -S . ...) <(jq -S . ...) && echo "run1 and run2 JSON byte-identical"`).
Latency observation (labelled): wall request time **6.43 s**.

### 4.3 Run 3 - qwen3-asr-1.7b-8bit (second data point per D10d; stt.sh first use = model load)

`runs/qwen3-run3.stdout.txt` / `runs/qwen3-run3.json` (1,830 B). stt.sh meta:
`{"language":"id","duration":12.432115077972412,"segments":1}`.
Latency observation (labelled): wall request time **14.82 s** including the first-request
qwen3 load (`Loaded model: qwen3-asr-1.7b-8bit ... total: 5.19GB`, log 16:32:40).

JSON: `language: "id"`, `text_len: 854`, **one segment** covering the whole file
(`start 0.0, end 65.72`); the segment keys are `[end, language, start, text]` - **no `id`,
no `avg_logprob`, no `no_speech_prob`, no `tokens`** on this engine.
The single segment's text contains all 13 turns in order (see 5.2 for the two word
mismatches); stt.sh reproduced it identically in its own request.

## 5. Qualitative transcript vs ground truth (prose only - no accuracy figures computed, per D230)

### 5.1 whisper runs 1-2 (identical)

- Turns **B1, A2, B2, A3, B3, A4, B4, B5, A6, B6: verbatim word matches** (punctuation as
  scripted).
- Turn A1 verbatim.
- Turn **A5 is the one real mismatch**: scripted *"Sekarang saya ingin mendengar kendala
  teknis yang Anda alami sehari-hari"* -> transcript *"Sekarang saya ingin mendengarkan
  dalam teknis yang... ...yang zalami sehari-hari"* spanning two segments (8+9); `mendengar`
  drifted to `mendengarkan`, `kendala` to `dalam`, `Anda alami` to `zalami`, with literal
  `...` filler artifacts.
- Turn A7: content present but split into three segments (13/14/15), comma became periods,
  and `kerja samanya` was written as one token `kerjasamanya`.
- **Phantom tail**: segment 16 repeats the closing sentence and is timestamped 65.54-95.52 s,
  i.e. its span runs ~29.8 s **past the end of the 65.72 s audio**. Its QA fields are the
  worst of the file: `avg_logprob -0.346` (others -0.09..-0.17) and `no_speech_prob 2.2e-9`
  (others ~1e-11) - machine-detectable.
- Timestamps track the fixture's turn structure within +/-0.5 s (section 6).

### 5.2 qwen3 run 3

- All 13 turns present in order; **eleven are verbatim word matches** (case drift only:
  `Anda` -> `anda` twice).
- Turn A5: `Anda alami` -> `dihadapi` (word substitution; `kendala teknis` was heard correctly).
- Turn B5: `pemindaian` -> `pemindayan` (one-letter word error).
- Turn A7: rendered as *"Baik, wawancara kita tutup dengan rekaman ini. Terima kasih atas
  kerjasamanya."* - `kerja samanya` glued to `kerjasamanya`, **no phantom repetition**.
- No per-sentence segmentation at all: one segment for the whole file (section 4.3) -
  timestamps exist but only file-wide.

## 6. Two-speaker / turn-taking evidence (diarization is M6 row 33 - NOT claimed here)

Expected turn starts computed from the per-turn ffprobe durations + 0.4 s gaps vs the
whisper run-1 segment starts:

| Turn | expected start | observed segment(s) | observed start | delta |
|---|---|---|---|---|
| A1 | 0.000 | 0 | 0.00 | 0.00 |
| B1 | 4.840 | 1 | 4.96 | +0.12 |
| A2 | 8.400 | 2 | 8.52 | +0.12 |
| B2 | 12.840 | 3 | 13.08 | +0.24 |
| A3 | 19.360 | 4 | 19.74 | +0.38 |
| B3 | 23.520 | 5 | 23.62 | +0.10 |
| A4 | 27.840 | 6 | 27.36 | -0.48 |
| B4 | 31.280 | 7 | 31.40 | +0.12 |
| A5 | 37.480 | 8 (+9) | 37.88 | +0.40 |
| B5 | 43.180 | 10 | 43.26 | +0.08 |
| A6 | 49.480 | 11 | 49.98 | +0.50 |
| B6 | 53.180 | 12 | 52.64 | -0.54 |
| A7 | 60.180 | 13+14+15 | 60.20 | +0.02 |

All 13 turns land within ±0.55 s of their constructed timeline positions, and the transcript
preserves the strict A/B/A/B... question/answer order - the two cloned voices produced a
dialogue the STT path transcribes in turn-taking order. Speaker **identity separation** in
the transcript (labels) is out of scope here (row 33/M6). Fixture distinguishability itself:
two distinct reference audios (`refs/ref-a.wav` 7.32 s male en_GB; `refs/ref-b.wav` 6.93 s
female id_ID), applied per turn via `TTS_REF_AUDIO` cloning (synth log quotes `voice cloning:
ref_audio=...` on every turn).

The `duration` field was NOT used anywhere (re-confirmed unreliable per D10d): whisper
returned `0.0` on all four requests, qwen3 returned `12.43` (stt.sh request) and `10.68`
(JSON-capture request) for the same 65.72 s file - the values are not the audio length and
differ between identical-parameter requests.

## 7. Acceptance table (row-12 verification, per run, with evidence above)

| Criterion | Run 1 (whisper) | Run 2 (whisper) | Run 3 (qwen3) | Row verdict |
|---|---|---|---|---|
| Non-empty JSON transcript with timestamps/segments | PASS - 897 chars, 17 segs with start/end (`runs/whisper-run1.json`) | PASS - identical shape | PASS - 854 chars, 1 seg with start/end (`runs/qwen3-run3.json`) | PASS |
| >= 1 segment per scripted sentence (13 scripted sentences) | PASS - 17 segments; per-sentence mapping in 4.1 (A5 split into 2, A7 split into 3, one phantom extra) | PASS - same counts | FAIL on granularity, reported honestly - one segment merges all 13 turns; text coverage complete | PASS at row level - the blueprint criterion is "In 2 runs" (`identification/02_structured.md:192`), which are the two whisper runs; run 3 is the D10d second data point |
| Language `id` | PASS | PASS | PASS | PASS |
| Two speakers distinguished in the fixture | PASS - two cloned reference voices documented (2.1/2.3); transcript shows turn-taking aligned to the constructed timeline (6). Diarization = row 33/M6, not claimed | | | PASS |
| No throughput claim in the artifact | PASS - section 9 grep proof; all timings are labelled latency observations (4.1-4.3) | | | PASS |
| Server stopped at end | PASS - `STATUS : DOWN`, `port 8000: no listener`, `pidfile: none`, pgrep empty (3) | | | PASS |
| 0 media files in `git status --porcelain` | PASS - media-extension grep count `0`; `.gitignore:47` `.cache/` confirmed by `git check-ignore -v` on the fixture | | | PASS |

**Row 12 acceptance: 7/7 PASS** (honest sub-notes: qwen3 single-segment granularity fails
the per-sentence mapping if applied to it, and transcript word mismatches exist - both
reported in prose above, neither is a metric).

## 8. Findings for row 33 (TranscriberAdapter `omlx-server` backend)

1. **Interface the backend must expose** (observed response shape): `text` (string),
   `language`, `segments[] {id?, start, end, text, avg_logprob?, compression_ratio?,
   no_speech_prob?, seek?, temperature?, tokens?}`. Confidence/VAD-ish fields
   (`avg_logprob`, `no_speech_prob`) exist **only on the whisper engine** - the adapter
   model must keep them optional and the qwen3 path must degrade to `start/end/text` (+ a
   per-segment `language` echo observed on qwen3).
2. **Segment granularity is engine-dependent**: whisper segments per utterance-ish (17
   segments here, sometimes merging/splitting scripted sentences - A7 became 3 segments);
   **qwen3-asr returns ONE segment for the whole file** - so per-turn timestamps from qwen3
   require pre-chunking (VAD) upstream; row 33's chunking design must decide which engine
   owns timestamp granularity on the Mac path.
3. **Do not trust `duration`** (re-confirmed, 6): use ffprobe/container duration or segment
   timestamps. **Clamp segment `end` to the media duration**: whisper's phantom tail
   extended to 95.52 s past a 65.72 s file; the adapter should treat segments starting at
   or beyond container duration as droppable QA artifacts, or gate them by
   `avg_logprob`/`no_speech_prob` thresholds (the phantom was the worst-scoring segment, 5.1).
4. Sentence-level exact string equality is the wrong assertion (row-10 §3.4 + this session):
   expect punctuation drift, letter-case drift (`Anda`/`anda`), token gluing
   (`kerja samanya`/`kerjasamanya`), and rare hallucination (`...` fillers, word
   substitutions like `kendala`->`dalam`/`dihadapi`); assert on normalised key tokens.
5. Wire facts (unchanged from row 10, re-used): endpoint `POST /v1/audio/transcriptions`,
   multipart `file/model/language/prompt[/word_timestamps]`; auth header from
   `~/.omlx/settings.json` (`auth.api_key`, never stored in DEMS config); loopback
   `127.0.0.1:8000`; 100 MB upload cap; realtime WS wants 16 kHz mono PCM int16 (this
   fixture's 24 kHz wav is a file-endpoint fixture only); `stt.sh` client timeout 600 s;
   first request per model pays the load (latency, labelled); pool memory with all three
   audio engines loaded: `total: 5.19GB` logged.
6. Biasing availability (guide §1.3): `prompt` maps to whisper `initial_prompt` (soft) and
   qwen3 system prompt (strong) - relevant if M6 wants term locks (e.g. `DEMS`); the A5
   mismatch class in 5.1 is exactly what biasing is offered against.
7. `TtsFixtureProvider` (D7c) is realised by this session's recipe: macOS `say`/`afconvert`
   references + per-turn `tts.sh` cloning + ffmpeg concat; keep it as the canonical fixture
   generator for tests (deterministic only if the sealed wav is reused, see 9.2).

## 9. Gap / recipe for row 38 (M1 gate, independent +1 run) and no-throughput proof

### 9.1 Grep-proof of "no throughput claim" in this artifact

`grep -nE "(RTF|WER|ms[- ]per[- ]token|real-time factor|words per minute|throughput)[^a-zA-Z]*[0-9]" research/10_spike_stt_functional_check.md` -> **0 matches**
(verified after writing this file, section 10). The only timing numbers present are the
three wall-clock request durations in §4, each explicitly labelled "Latency observation
(... not a throughput statement)", permitted by the row brief; no division by audio length
appears anywhere.

### 9.2 Row-38 re-run recipe (+1 independent run)

1. Start server (`start.sh`), verify UP (same as §3).
2. Re-transcribe the **sealed fixture** `.cache/spikes/stt-check/fixture-two-speaker-id.wav`
   (sha256 `6743181a...c0f4fe71`, 3,154,638 B) - do **not** re-synthesize it: OmniVoice
   generation is non-deterministic per request, so gate expectations must anchor on the
   sealed bytes.
3. Expected assertions (from this artifact): whisper -> `language id`, non-empty JSON,
   17 segments, byte-identical JSON across two runs (`jq -S` + `cmp`); qwen3 -> single
   segment, all 13 turn texts present. The two-run determinism observed here mirrors row
   7's byte-identical-chain check and gives row 38 an equality assertion it can reuse.
4. Stop server, verify DOWN + no listener (same commands as §3).
5. Known non-comparable point: the ">= 1 segment per scripted sentence" criterion is only
   meaningful on whisper at file-endpoint granularity (§8.2) - row 38 should scope it to the
   whisper runs as the blueprint does.
6. If the gate runs while the fixture folder is gone: the fixture is scratch (git-ignored),
   so the +1 run must either find `.cache/spikes/stt-check/` intact or re-generate via
   §2.1-2.4 with fresh (non-identical) audio - in which only the prose-level criteria apply.

## 10. Files

Scratch (all git-ignored, 34 files, 7.2 MB): `.cache/spikes/stt-check/`
`fixture-two-speaker-id.wav` (3,154,638 B), `fixture-script.txt`, `synth-turns.sh`,
`tts-synthesis.log`, `concat.txt`, `gap-04.wav`, `refs/{ref-a,ref-b}.{aiff,wav}`,
`refs/README-refs.txt`, `turns/{A1..A7,B1..B6}.wav`,
`runs/{whisper-run1,whisper-run2,qwen3-run3}.{json,stdout.txt,time.txt}`,
`runs/whisper-run1.segments.txt`.

Sources (all local, read-only): `identification/02_structured.md` (row 12 line 192, row 38
line 213, RF-4 line 121, R-7 line 254); `decisions/decisions.md` D7/D10/D12;
`initialization/02_stt_runtime_install.md` (procedure §5, caveats §3.3/§3.5);
`research/04_collection_stt.md` (licence table: F-19 whisper.cpp MIT, F-78 turbo weights
MIT - unchanged by this re-scope: no new components entered the path); `research/01_explore.md`
(repo untouched requirement honoured: no source edits); `~/Documents/omlx-script/`
`PANDUAN_STT_TTS.md` §1.2/§1.6/§2.2/§2.5/§4, `config.env`, `lib/common.sh`, `stt.sh`,
`tts.sh`, `start.sh`, `stop.sh`, `status.sh`; `~/.omlx/logs/omlx-serve.log` (quoted §1, §4).

---
*Generated: 2026-10-07 16:45*
*Last Updated: 2026-10-07 16:45*
