---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: data-analyst
blueprint_row: 33
milestone: M6
class: B (GA:OD-15, GA:OD-20, GA:OD-24)
tier: 1
type: mechanism-spec (transcript pipeline)
status: draft-for-M0-gate
confidence: HIGH for stage contracts, citations and licence mapping (mechanical over research/03_analysis.md, research/10_spike_stt_functional_check.md and masterplan/01_specs.md §E.3); MEDIUM for mechanism design constants (proposals flagged; M6 implements and calibrates)
source_structured_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/02_structured.md
source_translated_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/01_translated.md
source_analysis: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/research/03_analysis.md
source_functional_check: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/research/10_spike_stt_functional_check.md
source_spec: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/masterplan/01_specs.md
decisions: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/decisions/decisions.md (D4, D7, D10, D12)
last_updated: 2026-10-08 (RV-SPEC: errata AU3-01/AU2-01/AU2-02 on the cpu-local path; proposed §B.7 R-8 STT configuration, D20; 2026-10-07 row-35 remediation SEC35-14/22)
---

# Transcript Spec — VAD chunking, CPU STT, 2-speaker diarization, signed revisions

> **Authority in force.** Blueprint row 33 (`identification/02_structured.md:213`) is the hard
> gate: *"Functional-check criteria measurable without RTF/WER figures (D230); each stage has input,
> output, checkpoint, failure behaviour; DOC-05 licence entry list present; cites row 12 or its
> SKIPPED record."* Decisions: **D4 OD-15** (`TRANSCRIPT_REVISE` for INVESTIGATOR + SUPERVISOR; Core
> key signs; author recorded; no approval flow; the sealed machine transcript never changes),
> **D4 OD-20** (Indonesian only; diarization + VAD downloads cleared after the row-4 licence check),
> **D4 OD-24 + D7** (whisper.cpp CPU for the portable path; on this Mac the installed oMLX engines are
> reused; `TranscriberAdapter` has `omlx-server` + `cpu-local`; **D7 is flagged for confirmation at the
> second blueprint gate**). **D230** forbids any benchmark figure on this Mac.
>
> **Errata and additions (RV-SPEC, 2026-10-08; `masterplan/11_audit_errata.md`).** D17/D18 (audits
> AU-3/AU-2): the CPU-only path is **not** proven by row 12 (row 12 ran on the Apple GPU,
> `Device(gpu, 0)`); `cpu-local` is now specified as built from source under `.cache/` with GPU
> backends off, the model converted in the isolated `.cache/` venv, and proven on this Mac 2 + 1
> (§B.3). **Nothing of either backend is coded yet.** D20: R-8 STT configuration (§B.7, proposed,
> pending Q-STT-CFG).
> This spec is row 33 of the M0 masterplan; it is checked against `research/03_analysis.md` (the
> register) and `masterplan/01_specs.md`. It **consumes** the audio-source intervals defined by
> blueprint rows 29/31 (§E.2, §E.4) and the sealing pipeline of row 32; it does not redefine them.

**Citation short forms**

| Short | Source |
|---|---|
| `register §x` / row `SH-nn`/`CS-nn`/`NM-nn`/`DOC-nn` | `research/03_analysis.md` |
| `specs §x` / R-5 / R-7 / C-N1 / C-N2 | `masterplan/01_specs.md` |
| `coll4 F-nn` | `research/04_collection_stt.md` |
| `coll3 F-nn` | `research/02_collection.md` |
| `row12 §x` | `research/10_spike_stt_functional_check.md` |
| `structured §x` / row N | `identification/02_structured.md` |
| `stt-install §x` | `initialization/02_stt_runtime_install.md` |
| `Dn` | `decisions/decisions.md` |

---

## 0. Scope and design constants

### 0.1 What this spec covers

| In scope (M6) | Out of scope (this spec) |
|---|---|
| VAD chunking, CPU STT per chunk via the `TranscriberAdapter`, 2-speaker diarization, assembly of the machine transcript document, chunk checkpoints + resume, signed revisions, CPU priority | Benchmarking (class C-7), real-time/interactive streaming diarization, the evidence-package sealing mechanics (row 32 / `specs` §E.4) and the API/DB contracts themselves (rows 29/30) |

Register row: `NM-06` (transcript pipeline; register §B.6). Blueprint rows: 4, 12, 28, 33
(`structured` row 33 Depends On). Milestone: **M6** (`structured` §6).

### 0.2 Design constants (PROPOSALS unless marked decided — M6 implements and calibrates)

| Constant | Value (proposal) | Basis |
|---|---|---|
| `STT_SAMPLE_RATE_HZ` | 16000, mono | `coll4` F-92/F-40; row12 §1.6 (realtime WS profile 16 kHz mono) |
| `VAD_MAX_CHUNK_MS` | 30000 | `coll4` F-127 ("chunk length of 30-seconds is optimal" for large-v3), F-133 |
| `VAD_THRESHOLD` / `VAD_MIN_SPEECH_MS` | 0.5 / 250 | `coll4` F-22 (whisper.cpp VAD defaults) |
| `VAD_SPEECH_PAD_MS` / `VAD_OVERLAP_MS` | 30 / 100 | `coll4` F-22, F-132 (0.10 s overlap) |
| `AUDIO_FRAME_MS` | 21.333 (48 kHz AAC, 1024 samples) | `coll3` F-44/F-46; S2 §0 |
| `DIARIZATION_MAX_SPEAKERS` | 2 | `coll4` F-112 (no dedicated 2-speaker checkpoint; speaker count is a pipeline/clustering setting) |
| `DIARIZATION_CLUSTER_THRESHOLD` | 0.5 | PROPOSAL — no published value; `coll4` G-5 (calibrate at M6 or accept UNAVAILABLE) |
| `DIARIZATION_MIN_SEGMENTS` | 4 | PROPOSAL — below this S/U default UNAVAILABLE |
| `STT_MAX_THREADS` | bounded; `inter_threads * intra_threads` <= physical cores | `coll4` F-38/F-137 (CT2 rule); `specs` C-N2 |
| `STT_CHUNK_RETRIES` | 2 | PROPOSAL |
| `TRANSCRIPT_DOC_VERSION` | `dems.transcript/1` | PROPOSAL (document format is fixed here) |
| `TRANSCRIPT_CHECKPOINT_PATH` | `<session-scratch>/transcript-checkpoint.json` under the git-ignored evidence store | OD-25 (`specs` C-N3) |

`DIARIZATION_MAX_SPEAKERS` and `DIARIZATION_CLUSTER_THRESHOLD` are explicitly labelled **proposals**
because the register records no decided value; the LABELLED/UNAVAILABLE behaviour itself is decided
(D226 labels part; R-5; `specs` §E.3).

---

## A. Pipeline stages

Every stage below carries **input**, **output**, **checkpoint** and **failure behaviour** (row-33
gate). The stage order is the data order; stages A.4 and A.6 are post-passes that never block the
STT text.

### A.0 Stage contract matrix (6/6)

| # | Stage | Input | Output | Checkpoint | Failure behaviour |
|---|---|---|---|---|---|
| A.1 | Audio intake | `AUDIO-01` session track + `AudioSourceInterval[]` | 16 kHz mono PCM stream + interval map | first/last decoded sample media-pts | `TRANSCRIPT_AUDIO_UNAVAILABLE`; flag `intervals_incomplete`; never guess |
| A.2 | VAD chunking | PCM stream + interval map | ordered speech chunks `{index,start_ms,end_ms}` | chunk-boundary table, written before decode | fall back to fixed 30 s windows; empty speech -> flagged empty |
| A.3 | STT per chunk | chunk PCM + `language=id` + optional prompt | segments `{start,end,text,QA?}` | append segments per committed chunk | retry chunk, then mark chunk FAILED and continue |
| A.4 | Diarization | committed segments + PCM | per-segment speaker label + state | label map + state, written once | state `UNAVAILABLE` (never blocks text) |
| A.5 | Assembly | committed segments + labels + header | canonical document + SHA-256 | document + hash, marked `assembled` | rebuild from committed chunks; never seal a partial doc as complete |
| A.6 | Revisions | author + change + `TRANSCRIPT_REVISE` | signed appended revision | append-only revision list + signature | typed refusal (permission / signature / hash mismatch) |

### A.1 Audio intake

| Field | Contract | Citation |
|---|---|---|
| Input | Single session audio track `AUDIO-01` (AAC-LC 48 kHz mono) + its `AudioSourceInterval` rows from the mic switch | OD-01 (D4); OD-06 (D4); `specs` §E.1/§E.2; register SH-02/SH-06/NM-10 |
| Source of intervals | Media-pts `from_ms`/`to_ms`, derived capture-side (never from operator wall clock) | S2 §6 finding 3; `specs` §E.2; row 29 (API C3) owns the `switchAudioSource` op + `AUDIO_SOURCE_SWITCHED` audit (register SH-13/SH-14, E-30); row 31 owns the media-pts derivation |
| Output | Resampled 16 kHz mono PCM access stream + the interval map carried into the document header | `coll4` F-92/F-40; row12 §1.6 (16 kHz mono PCM int16 profile) |
| Checkpoint | The interval map and the media-pts of the first/last decoded sample are written as the resume anchor, snap-aligned to the AAC frame grid | `coll3` F-44 (21.33 ms) |
| Failure behaviour | Missing/unreadable track -> stage fails with typed `TRANSCRIPT_AUDIO_UNAVAILABLE` (**now in row 29's final error-code list**, `03_api_contract.md §4`; SEC35-22) and **no transcript is fabricated**; missing or overlapping intervals -> proceed but set `intervals_incomplete` in the document header. Channel-based speaker attribution is **withdrawn** and must not be reintroduced | register §E (superseded: "speaker attribution by channel"); OD-08 (`specs` §E.5) for the crash/durable-part case; SEC35-22 |

Cross-ref only (not duplicated here): the mic-switch mechanism and interval rows are specified in
`specs` §E.2 and owned by blueprint rows 29/31; this spec only consumes them.

### A.2 VAD chunking

| Field | Contract | Citation |
|---|---|---|
| Input | 16 kHz PCM stream + interval map | A.1 |
| Model file (per backend) | `cpu-local`: `ggml-silero-v6.2.0.bin` (864.35 KB, whisper.cpp-native `--vad -vm`). ONNX path: `silero_vad_16k_op15.onnx` (1.29 MB) or `silero_vad.onnx` (2.33 MB) | `coll4` F-95, F-91, F-21/F-132 |
| Runtime | ONNX route runs on `onnxruntime` + `numpy`, no torch; ggml route runs inside whisper.cpp | `coll4` F-92 |
| Chunk boundaries | Speech intervals from Silero; long speech auto-split at silence above 98 ms; consecutive chunks overlap 0.10 s; padding 30 ms | `coll4` F-132, F-22 |
| Max chunk length | `VAD_MAX_CHUNK_MS` = 30 s window | `coll4` F-127, F-133 |
| Timeline mapping | Chunk `start_ms`/`end_ms` are media-pts offsets relative to `AUDIO-01`, so a transcript segment replays against the video; boundaries snap to the **AAC frame grid** (>= 1 frame = 21.333 ms) | `coll3` F-44 (1024/48000 s), F-46; S2 §0; row12 §6 (timestamps track the turn structure within +/-0.5 s) |
| Why VAD owns granularity on the Mac path | The `qwen3-asr` engine returns **one segment for the whole file**; per-turn timestamps therefore require pre-chunking upstream | row12 §4.3, §8.2 |
| Output | Ordered chunk list `{chunk_index, start_ms, end_ms}`, each carrying its audio-source interval | A.1 |
| Checkpoint | The chunk-boundary table is persisted **before** the chunk is decoded (boundaries are deterministic given sealed audio) | `coll4` F-131; row12 §9.2 (re-run must anchor on the sealed fixture bytes) |
| Failure behaviour | VAD model absent -> fall back to fixed 30 s windows (`VAD_MAX_CHUNK_MS`) and flag `vad_fallback`; VAD yields no speech -> empty transcript flagged (not an error); VAD error -> same fixed-window fallback | `coll4` F-127, F-22 |

### A.3 STT per chunk via the `TranscriberAdapter`

| Field | Contract | Citation |
|---|---|---|
| Input | Chunk PCM + `language = "id"` (fixed, no auto-detect) + optional `prompt` for domain-term biasing + backend/model selection | OD-20 (D4); `coll4` F-13 (no auto-detect; `-l id`); row12 §8.6 (prompt = whisper `initial_prompt` soft / qwen3 system prompt strong) |
| Output | Segments `{start, end, text, avg_logprob?, compression_ratio?, no_speech_prob?, seek?, temperature?, tokens?, language?}`; only `start/end/text` are mandatory, QA fields are optional | row12 §8.1 (whisper only exposes `avg_logprob`/`no_speech_prob`; qwen3 degrades to `start/end/text`) |
| Checkpoint | After each chunk decodes: append its segments to the checkpoint store and advance the committed media-pts offset; mark the chunk `committed` | §D below |
| Failure behaviour | Engine error/timeout -> retry the chunk up to `STT_CHUNK_RETRIES`, then mark the chunk FAILED and continue (one failed chunk must not abort the transcript); `duration` JSON field is **ignored** (unreliable); segment `end` is clamped to container duration and segments starting beyond duration are droppable QA artifacts; a low-`avg_logprob`/high-`no_speech_prob` phantom tail is gated the same way | row12 §4.1 (phantom tail 65.54-95.52 s past a 65.72 s file), §8.3, §6; D10(d) |

### A.4 Diarization / speaker labelling (2 speakers)

| Field | Contract | Citation |
|---|---|---|
| Input | The committed segment set + PCM | A.3 |
| Route | **sherpa-onnx** + Silero VAD (licence-clean). Segmentation model `sherpa-onnx-reverb-diarization-v1.tar.bz2` (10.92 MB) + one embedding ONNX (23-30 MB, e.g. `nemo_en_titanet_small.onnx` 23.41 MB / CAM++ 29.6 MB). Code Apache-2.0; model families Apache | `coll4` F-100, F-104, F-105, F-101, F-106, F-111; LB-5 (licence-clean combination, no token) |
| Excluded route | pyannote `speaker-diarization-3.1` / `segmentation-3.0` are **gated** (`gated: auto`; token + accepted terms, a human action) -> **NOT the route** | `coll4` F-110, LB-1; W1-C5 (register §F); D8 |
| Speaker count | `max_speakers`-style clustering limit `DIARIZATION_MAX_SPEAKERS = 2`; no dedicated 2-speaker checkpoint exists | `coll4` F-112 |
| Output | Per-segment speaker label (A/B), plus a document-level state **LABELLED** or **UNAVAILABLE** | R-5; D226 (labels part); `specs` §E.3 |
| When **LABELLED** is produced | The segmentation + embedding models are present and loadable, clustering yields exactly 2 clusters, the mean cluster-assignment confidence is >= `DIARIZATION_CLUSTER_THRESHOLD`, and segment count >= `DIARIZATION_MIN_SEGMENTS` | `coll4` F-112, G-5 (both constants are proposals) |
| When **UNAVAILABLE** is produced | Any of: model absent (downloaded? boot-check CS-22 satisfied?), model load failure, clustering yields >2 clusters or a singleton cluster, mean confidence < threshold, or too few segments. The transcript is then sealed **unlabelled** with the exact flag string `speaker labels unavailable` | R-5; D226 (labels part); `specs` §E.3; register CS-22 (boot checks require model files) |
| Checkpoint | The label map + state are written once after clustering and are immutable; diarization runs as a **post-pass** so it never blocks the STT text | §D |
| Failure behaviour | Diarization crash or low confidence -> state `UNAVAILABLE` (never aborts the transcript, never fabricates a speaker) | R-5 |

### A.5 Assembly into the machine transcript document (sealed)

| Field | Contract | Citation |
|---|---|---|
| Input | Committed segments + label map/state + header metadata (session id, language, backend, model, doc version) | A.3, A.4 |
| Document format (proposal) | Canonical JSON `dems.transcript/1`: `header` + `segments[] {index, start_ms, end_ms, text, speaker|null}` + `speaker_state` (`LABELLED`/`UNAVAILABLE`) + `intervals[]` + `qa_flags` | `specs` §E.4 (package layout: transcript inside the seal); row12 §8.1 (segment shape) |
| Document hash | SHA-256 over the canonical JSON (sorted keys, UTF-8); recorded as the manifest v2 `transcript hash` | `specs` §E.4 (manifest v2 fields include transcript hash); register NM-08 |
| Sealing interaction | The package is byte-sealed **only after** the transcript is assembled and hashed; sealing waits for the transcript (D223), and the transcript lives **inside** the sealed package (D222), never as an addendum | D222/D223 (structured §1.2); `specs` §E.3/§E.4; row 32 (evidence package) is the owning spec |
| Checkpoint | Document + hash written and marked `assembled`; only then may the sealing pipeline's transcript step complete | §D; `specs` §E.4 (sealing pipeline checkpoints) |
| Failure behaviour | Assembly error -> rebuild from committed chunks; a partial document is sealed as complete **never**; under OD-08 (crash during RECORDING) the durable part is sealed flagged `interrupted` with the transcript state recorded | OD-08 (D4); `specs` §E.5; row 32 |

### A.6 Revision handling (OD-15)

| Field | Contract | Citation |
|---|---|---|
| Input | A correction request (author id, target segment/field, new text) under the `TRANSCRIPT_REVISE` permission | D4 OD-15; register SH-03 (vocabulary), SH-04 (RBAC: INVESTIGATOR + SUPERVISOR) |
| Output | A signed revision record appended to the **append-only** revision list; the sealed machine transcript is **byte-unchanged** | OD-15 (D4); register SH-02 (`TranscriptRevision` entity), SH-14 (evidence API revisions) |
| Signing | The **Core Ed25519 key** signs each revision via the `Signer` interface; the **author is recorded** in the record; there is **no approval flow** | OD-15 (D4); OD-04 (D4); `specs` §E.3 |
| Revision record (proposal) | `{revision_id, machine_transcript_hash, author_id, created_at, signed_by, signature, changes[]}` — `machine_transcript_hash` binds the revision to the immutable original | OD-15; register SH-02 |
| Where | `transcript-revisions.json` inside the package + a `TranscriptRevision` row; row 32 owns the package-side placement | register SH-02/SH-14; `specs` §E.4; row 32 |
| Checkpoint | Each revision is written and signed atomically; the original transcript hash is never rewritten | OD-15 |
| Failure behaviour | Missing/insufficient permission -> typed refusal with **no** revision written; signature failure -> revision not appended; `machine_transcript_hash` mismatch -> refused. The original is never mutated | OD-15; register E-30 (audit rules) |

---

## B. `TranscriberAdapter` (D7)

The adapter is the single seam that keeps the transcript document format identical in development, in
functional verification and on the Core (`specs` §E.3; D7(a)-(c); W1-C12). It touches the OD-24 default
and is **flagged for confirmation at the second blueprint gate** (D7(c); register §F W1-C12).

### B.1 Interface sketch (spec only — M6 implements; no code is changed by this row)

```text
interface TranscriberBackend {
  id: 'omlx-server' | 'cpu-local'
  transcribe(chunk: TranscriberChunk, opts: TranscribeOptions): Promise<TranscribeResult>
}

TranscriberChunk   { pcm, sampleRateHz: 16000, offsetMs, durationMs }
TranscribeOptions  { language: 'id', prompt?: string, modelPath?: string, modelId?: string }
TranscribeResult   { engine, model, language, text, segments: TranscriptSegment[] }
TranscriptSegment  { id?, start, end, text,
                     avgLogprob?, compressionRatio?, noSpeechProb?,
                     seek?, temperature?, tokens?, language? }   // QA fields optional
```

`start`/`end` are seconds at the backend boundary; A.5 converts them to integer milliseconds for the
canonical document. A `TtsFixtureProvider` (B.6) supplies test audio.

### B.2 Backend `omlx-server` (this Mac — **not shipped**)

| Aspect | Contract | Citation |
|---|---|---|
| Nature | The installed oMLX server, an OpenAI-compatible endpoint on loopback; **uses the Apple GPU (Metal) by design and is not the shipped engine** | D7(a)/(c); `specs` §E.3; row12 §1 (Metal cap log line; no device/CPU/GPU flag in `omlx serve --help`) |
| Endpoint | `POST /v1/audio/transcriptions` on `127.0.0.1:8000`; multipart `file/model/language/prompt[/word_timestamps]`; 100 MB upload cap | row12 §8.5; `specs` §E.3 |
| Models | `whisper-large-v3-turbo` (long-form, word timestamps) and `qwen3-asr-1.7b-8bit` (stronger biasing) | D7; row12 §1 |
| Response shape | `text`, `language`, `segments[]` with `avg_logprob`/`no_speech_prob` on whisper, absent on qwen3 (adapt to optional) | row12 §8.1 |
| Unreliable field | The `duration` JSON field is unreliable and must be ignored; use container duration / segment timestamps | row12 §6; D10(d); `specs` §E.3 (server caveat) |
| Cold start / memory | First request per model pays the load; with all three audio engines loaded the pool logged `total: 5.19GB` | row12 §1, §3, §8.5 |
| Ops rules | DEMS never binds port 8000, never restarts/upgrades oMLX, serialises STT/TTS calls; the API key comes from `~/.omlx/settings.json` and is never written to DEMS config | D7(d); `specs` §E.3 |
| API key handling (SEC35-14) | the key at `~/.omlx/settings.json` `auth.api_key` is **referenced by path only, never printed or logged**; read at start into **memory only**, sent only as an `Authorization` header to the loopback endpoint, never persisted, audited, placed in a slice or copied into an env var. The transcriber log-blanking rule covers the `Authorization` value and the key token, and a static test asserts `apps/transcriber/**` reads the settings file only in the single key-loader module and never logs a header (row 36 `M6` transcriber static test; E-31) | D7(d); E-31; `specs` C-N8; SEC35-14 |

### B.3 Backend `cpu-local` (production — the shipped Core path)

| Aspect | Contract | Citation |
|---|---|---|
| Nature | Portable whisper.cpp, **CPU-only by decision** (D229/D230/R-7); the shipped engine on the x86 Linux Core **and** the CPU path proven on this Mac before the "done on this Mac" line (D7(b): "NOT cancelled"; erratum AU3-01) | D4 OD-24; D7(b); R-7; `specs` C-N1; D17/D18 |
| Command shape | `whisper-cli -ng -t <n> -l id -oj -m <model>` (plus `--prompt` for biasing, `-ot`/`-on` for chunk offsets); **there is no `-otype`** | `coll4` F-10 (`-ng`), F-09 (`-t`), F-13 (`-l`), F-12 (`-oj`; no `-otype`), F-131 (`-ot`/`-on`/`--prompt`); W1-C3 (register §F) |
| Model path | Configurable (`-m FNAME`); model size configurable across tiers (tiny..large-v3-turbo, q5_0/q8_0) | `coll4` F-14, F-80, F-81 |
| Model source | Conversion of the on-disk HF turbo checkpoint (ggml script + openai/whisper `mel_filters.npz`) **or** the official pre-converted ggml (MIT, sha256 published) — row 4 facts | `coll4` F-50..F-56, F-71; `specs` §E.3 |
| Install (route corrected, AU2-02) | **Source build under `.cache/`** (git-ignored): whisper.cpp built with GPU backends **off** (`GGML_METAL=OFF`; no CUDA/Vulkan/OpenCL), `cmake` taken from the isolated `.cache/` venv because `cmake` is absent on this host (AU-2 §4.1), **zero Homebrew change**. Logged with its uninstall command (`rm -rf` of the `.cache/` build tree) per Q-INSTALL. **Approved value kept:** OD-24 (D4) reads "whisper.cpp (Homebrew)"; a Homebrew install would also upgrade `ca-certificates openssl@3 sdl3 sdl2-compat` and `openssl@3` has `ffmpeg` and `omlx` as installed dependents (AU-2 dry run; D12(d) risk class), so the route is put to the user at the second gate (reframed Q-D7) and is not changed silently | D4 Q-INSTALL items 1/2; OD-24 (D4); AU2-02; D12(d) |
| Model (this Mac) | Convert `~/.omlx/models/whisper-large-v3-turbo` (HF) to ggml in the **isolated `.cache/` venv** (row 11 un-skipped for `cpu-local`; the venv is removed after), **or** download the official pre-converted ggml turbo weights (MIT, sha256 published) under OD-20's download rule; the model file's sha256 is recorded | `coll4` F-50..F-56, F-71; AU2-01; D7(a) (row 11 was skipped only for the oMLX path) |
| Proof on this Mac | `cpu-local` functional check (rev-2.1 blueprint row) on the sealed two-speaker fixture, **2 + 1**, `-ng` visible in the quoted command, the run log showing no GPU backend initialised, no RTF/WER figure (D230). Then `M6-TF-1` runs on **both** backends and `M6-DF-1` on `cpu-local` | R-5 AC-1; C-N1; AU3-01; `10_test_strategy.md` §A.6 |
| Status today | **not installed, no model in a CPU format, no code** (`git grep cpu-local\|whisper-cli\|TranscriberAdapter -- ':!docs'` → 0 hits, AU-2 §4.4) | AU2-01 |
| GPU disable evidence | `-ng` disables GPU; GPU backends are opt-in cmake flags absent from the default CPU build | `coll4` F-10, F-11 |

### B.4 Selection rule (config-driven, never automatic mid-session)

| Rule | Contract | Citation |
|---|---|---|
| Config-driven | The backend is a config value (`TranscriberAdapter.backend = omlx-server | cpu-local`); the Core's boot check requires the model files for the selected backend | D7; `specs` R-2 AC-3 / R-7 AC-1; register CS-22 |
| Never automatic | The backend is chosen at boot and fixed for a session's lifetime; it is **never** switched automatically mid-session (which would break document determinism and checkpoint validity) | D7; `specs` §E.3 |
| Dev vs Core | `omlx-server` is development + functional verification only (Apple GPU; D229's objection applies to it for the product path, AU2-11); `cpu-local` is the production Core path and the only backend whose run satisfies the CPU clause of R-5 AC-1 | D7(b)/(c); R-7 AC-3; `specs` C-N1; AU2-11 |

### B.5 Return contract (why the document format is identical)

Both backends normalise to `TranscribeResult`: `text`, `language`, `segments[]` with mandatory
`start/end/text` and optional QA fields, plus `engine` and `model` identifiers. Because A.5 assembles
the canonical document only from those normalised fields (converting seconds to ms), the sealed
transcript is byte-identical in shape regardless of backend; QA fields present on one backend and
absent on the other are omitted, never zero-filled (row12 §8.1 — "the adapter model must keep them
optional and the qwen3 path must degrade").

### B.6 `TtsFixtureProvider` (test audio, dev-side only)

Realises the row-12 recipe: macOS `say`/`afconvert` reference voices + per-turn installed-TTS cloning
+ `ffmpeg` concat, producing `.cache/spikes/stt-check/fixture-two-speaker-id.wav` (65.72 s, 2 scripted
voices, sha256 `6743181a7d976ca24c03ad8e427d6d7093fbb0b9f72257e6e2f91dcfc0f4fe71`). Test runs must
reuse the **sealed fixture bytes** (generation is non-deterministic per request). An `espeak-ng`
(GPL-3) fixture is a fallback generator only (see F). Citations: row12 §2.1-2.4, §8.7, §9.2; `coll4`
licence table; `specs` §E.3.

### B.7 STT configuration — enable/disable, backend, endpoint (PROPOSED — pending Q-STT-CFG confirmation at the second gate; R-8, D20)

> **Status: proposed.** Implements R-8 (`specs` R-8; D20). Operations 90-92 (`03_api_contract.md
> §2.5`), table `stt_config` (`04_database_contract.md §B.13`), manifest fields (`06_evidence_package_spec.md
> §B.7a`), web menu and read-only mobile status (`08_client_ux_spec.md §8a`), conditional checks
> (`10_test_strategy.md §A.6a`). Nothing here is counted or scheduled until Q-STT-CFG is confirmed.

| Rule | Contract | Citation |
|---|---|---|
| What is configurable | `enabled`, `backend` (`omlx-server` \| `cpu-local`), `endpoint` (server backend; loopback only), `model`, `language` (`id` only, OD-20), `diarization` on/off; a credential held only as a reference (oMLX: the key stays in `~/.omlx/settings.json`, SEC35-14) or encrypted in the Core credential store | D20; OD-20; OD-13; SEC35-14 |
| Selection rule (refines B.4) | the backend is now a **database** configuration value rather than a boot-time file value; the boot check still requires the model files of the configured backend (CS-22); the value is **never switched mid-session** | B.4; D20 |
| Config applies to the next session | the transcriber reads the `stt_config` snapshot taken at session start; a change saved while a session is open (op 91 `appliesFrom: NEXT_SESSION`) never affects the open session's chunks, checkpoints or document determinism | D20; OD-10 pattern; §D |
| Disabled | with `enabled = false` in the session snapshot: no VAD, STT or diarization work during recording (no CPU taken from capture); `FINALIZE_TRANSCRIPT` completes immediately and the manifest records `transcript.state = 'DISABLED'` with reason "transcript disabled by configuration" (`DISABLED_BY_CONFIGURATION`); no transcript document is fabricated | D20; `06_evidence_package_spec.md §B.7a`; D-EV-1 spirit |
| Enabled but backend unreachable | each chunk retries `STT_CHUNK_RETRIES` times; a chunk that still fails is `FAILED`; sealing proceeds under D-EV-1 (`transcript.state = 'PARTIAL'`, `failedChunks`, no fabricated text) and the manifest flags `transcript.backendUnreachable = true`. Capture is never blocked or slowed by an unreachable backend. The server is never started or restarted by DEMS (D7(d)) | D-EV-1; D7(d); §A.3 failure behaviour |
| Test connection | op 92 asks the configured backend for its model list/health once, reports `reachable`/`modelAvailable`, sends no audio and records no speed figure (D230); serialised with other oMLX calls | D7(d); D230 |
| Never logged | the credential, the reference target and the `Authorization` header are covered by the transcriber log-blanking rule (B.2 SEC35-14) and never appear in `STT_CONFIG_CHANGED` (field names only) | E-31; SEC35-14 |

---

## C. CPU priority rule (capture outranks STT)

R-7/RK-1/C-N2: capture outranks STT for CPU. The mechanism and the minimum proof are fixed here; the
proof is a **functional** check, never a throughput measurement.

| Aspect | Contract | Citation |
|---|---|---|
| Priority direction | Capture (ingest + mux + hash) outranks STT; STT must never starve capture | `specs` C-N2, R-7 AC-4; RK-1 (register §G); `coll4` F-138 |
| Thread caps | `whisper-cli -t <n>` (+ `-p`) bounded; the adapter clamps `inter_threads * intra_threads` <= physical cores | `coll4` F-09/F-136; F-38/F-137; `specs` C-N2 |
| Bounded worker | One STT chunk decoded at a time; a small bounded chunk queue; no unbounded parallelism between VAD, STT and diarization | PROPOSAL; `coll4` F-136/F-137 |
| Suspend/degrade under pressure | STT is **suspended or degraded during RECORDING** if CPU pressure is detected (pause between chunks; defer the diarization post-pass until after capture); configurable model size selects a smaller tier under pressure | PROPOSAL; `coll4` F-80/F-81 (tier configurability), F-137 |
| The proof | **M6 check: "no dropped capture fragment while STT runs"** — one **2 + 1** check (2 runs by the producing row + 1 independent verification), run with the **`cpu-local`** backend (a GPU engine gives no evidence about CPU starvation, AU3-01), explicitly **NOT** a throughput measurement | E-22 (register §A); RK-1 (register §G); `coll4` F-138, G-4; `structured` §6 M6; `specs` R-7 AC-4 |
| Why only this check | No public source quantifies dropped-audio risk when a CPU Whisper runtime shares cores with a real-time capture process; the M6 check is the only proof | `coll4` F-138, G-4 |

---

## D. Checkpoints and resume

### D.1 Chunk-level checkpoints

| Question | Answer | Citation |
|---|---|---|
| What is written | Per chunk: `{chunk_index, start_ms, end_ms, audio_source, backend, model, vad_hash?, segments, committed}`; plus the document-level `{assembled, doc_hash, speaker_state}` | `coll4` F-131 (offsets/indices for continuity); register SH-02 |
| Where | `<session-scratch>/transcript-checkpoint.json` in the git-ignored evidence store, mirrored to the DB (`Transcript`/`TranscriptRevision` entities, SH-02) | OD-25 (`specs` C-N3); register SH-02 |
| When | The **boundary** is written before decode (A.2); the **segments** are written after each chunk commits (A.3); labels/state once after clustering (A.4); the document + hash once after assembly (A.5) | `coll4` F-131; `specs` §E.4 (checkpoint per step) |

### D.2 Behaviour after a crash mid-transcript

| Situation | Behaviour | Citation |
|---|---|---|
| Crash during decode | Committed chunks are **immutable and reusable** by `chunk_index`; only the chunk after the last committed offset is re-decoded | `coll4` F-131, F-135 (state carried between chunks) |
| Resume | RECOVERY reads the last committed chunk, re-derives VAD boundaries (deterministic on the sealed audio), and continues; the re-run must anchor on the sealed fixture/audio bytes, not regenerate audio | row12 §9.2; `coll4` F-131; register NM-07 |
| Sealing resume cross-ref | Sealing is checkpointed per step and resumed through RECOVERY (row 32; register NM-07, `specs` §E.4/§E.5); if the transcript is already committed, sealing does not re-run STT | OD-08 (D4); `specs` §E.4; register NM-07 |
| Durable-part case | A crash during RECORDING seals the durable part flagged `interrupted`; the transcript covers the durable timeline and records `intervals_incomplete` if the interval map is truncated | OD-08 (D4); `specs` §E.5 |

### D.3 Interaction with sealing waiting for the transcript (D223)

| Rule | Contract | Citation |
|---|---|---|
| Order | Sealing waits until the transcript is assembled and hashed (its transcript step completes only after all chunks are committed and A.5 has run) | D223 (`structured` §1.2); `specs` §E.3/§E.4 |
| Placement | The transcript lives **inside** the sealed package (no addendum) | D222/D223; `specs` §E.4 |
| Idempotence | A resumed seal consumes the committed transcript + hash; it never recomputes or rewrites the machine transcript | OD-15 (D4); `specs` §E.4 |

---

## E. Functional-check definition (M6) — measurable without benchmark figures

Blueprint row 33's hard gate: functional-check criteria measurable **without** performance/accuracy
figures (D230). The reference evidence is the **executed** row-12 check (row12, not a SKIPPED record).

### E.1 M6 functional-check criteria

| # | Criterion (checkable) | Reference / citation |
|---|---|---|
| 1 | A transcript is produced on the synthetic two-speaker sample `.cache/spikes/stt-check/fixture-two-speaker-id.wav` (65.72 s, 2 scripted voices) on **both** backends; on `cpu-local` the quoted command shows `-ng` on the GPU-off build (R-5 AC-1 CPU clause; AU3-01) | row12 §2.4, §10; `specs` §E.3; §B.3 |
| 2 | Non-empty with timestamps: every segment carries `start`/`end` and text | row12 §4.1/§7 (897 chars, 17 segments with start/end); R-5 AC-1 |
| 3 | >= 1 segment per scripted sentence (13 scripted sentences) on the full-granularity path; the merged single-segment path is scoped out of this assertion | row12 §7, §9.3 (whisper 17 segs / 13 sentences; qwen3 merged to 1) |
| 4 | Language is `id` | row12 §4.1/§7 (language `id`); OD-20 |
| 5 | The transcript is sealed and verifies **inside** the package | R-5 AC-2; `specs` §E.4; M6/M7 checks |
| 6 | Speaker state present: **LABELLED** when the model is loaded, otherwise **UNAVAILABLE** with the flag `speaker labels unavailable` | R-5; D226 (labels part); A.4 |
| 7 | A kill mid-transcript resumes without losing committed chunks (one **2 + 1** check) | `structured` §6 M6; D232/D233; §D |
| 8 | "No dropped capture fragment while STT runs" (one **2 + 1** check; not a throughput measurement) | E-22; RK-1; `coll4` F-138 |

### E.2 Reference evidence from row 12 (executed, quoted)

| Observation | Value | Citation |
|---|---|---|
| whisper run 1 | `language: id`, 897 chars, **17 segments** over **13 scripted sentences** (`{"language":"id","duration":0.0,"segments":17}`) | row12 §4.1/§7 |
| whisper run 2 | Byte-identical JSON to run 1 after key-sorting | row12 §4.2 |
| qwen3 run 3 | 854 chars, **one segment** for the whole file; keys `[end, language, start, text]` only | row12 §4.3 |
| Fixture | 65.72 s, 24 kHz mono, sha256 `6743181a...c0f4fe71`, 3,154,638 B | row12 §2.4 |
| QA artifact | Phantom tail segment timestamped past the 65.72 s file (worst `avg_logprob`) | row12 §4.1/§8.3 |
| Row 12 verdict | **7/7 PASS**; sub-notes honest (qwen3 granularity, word mismatches) — all prose, no figures. **Erratum AU2-01:** row 12 ran on the oMLX/MLX server on the Apple GPU, so it is functional evidence for `omlx-server` only and **not** evidence for the CPU clause; AU-2 re-ran it (Kilo's fixture byte-identical JSON; own espeak-ng fixture 6/6 sentences) | row12 §7; AU-2 §4 |

Row 12 is **not** a SKIPPED record; it executed and passed (status_tasks.md row 12: "done (W4) —
7/7 PASS"). This spec cites it as the reference evidence (row-33 gate: "cites row 12 or its SKIPPED
record").

### E.3 No-figure statement (D230)

> **This document records no RTF, no WER, and no ms per audio-second figure, and computes no
> real-time factor.** No accuracy or speed figure is claimed anywhere in this spec or in the M6
> check definition. This is required by **D230** and matches the row-12 proof (row12 §9.1: the
> `RTF|WER|ms-per-token|real-time factor|throughput` grep returned **0 matches**). The reason is that
> any benchmark is a **class-C** activity on the real Core device (C-7; `structured` §9;
> `specs` §G.2; register E-22/NM-13), not a Mac-side functional check. The absence of a benchmark is
> also forced by the gaps: no published Indonesian result for the turbo tier (G-1) and no published
> CPU-sharing dropped-audio quantification (G-4) — so the functional criterion must use structural
> properties (segments, timestamps, language, sealing) rather than any figure.

---

## F. DOC-05 licence entry list

Register row DOC-05 (register §B.5) and `specs` §C.1. This is the licence entry list the transcript
pipeline contributes to `THIRD_PARTY_NOTICES.md`; **15 components**. Sources are the row-4 facts.

| Component | Code licence | Model-weight licence | Source (row-4 fact) | Redistribution note |
|---|---|---|---|---|
| whisper.cpp | MIT | n/a | `coll4` F-19 | Keep the copyright notice in distributed copies |
| ggml (whisper.cpp dependency) | MIT | n/a | `coll4` F-20 | Permissive |
| Whisper large-v3-turbo weights (+ pre-converted ggml) | n/a | MIT; sha256 published | `coll4` F-78, F-70, F-71 | Redistributable; a converted ggml/CT2 derivative inherits MIT |
| faster-whisper | MIT | n/a | `coll4` F-30 | Only if chosen (not on the decided path) |
| CTranslate2 | MIT | n/a | `coll4` F-33 | Only if chosen |
| Silero VAD (code + weights) | MIT | MIT | `coll4` F-90, F-95 | Cite the LICENSE file, ignore the stale CC BY-NC badge (LB-4) |
| sherpa-onnx | Apache-2.0 | inherited per model family (Apache) | `coll4` F-101, F-106 | Per-asset licence-file gap **LB-3**; record the exact checkpoint |
| sherpa-onnx diarization assets (segmentation `reverb-diarization-v1` + embedding ONNX) | n/a | Apache family (3D-Speaker/NeMo/WeSpeaker) | `coll4` F-104, F-105, F-106 | Record per asset; no token; no accepted-terms gate |
| pyannote.audio (code) | MIT (CNRS) | n/a | `coll4` F-107 | **Not used** (gated route) |
| pyannote `segmentation-3.0` / `speaker-diarization-3.1` weights | n/a | declared MIT but **GATED** (token + accepted terms — human action) | `coll4` F-110, LB-1 | **EXCLUDED** (W1-C5); do not ship |
| pyannote WeSpeaker embedding | n/a | CC-BY-4.0 | `coll4` F-110, LB-2 | Attribution required if redistributed; not on the decided path |
| OmniVoice (TTS fixture) | n/a | Apache-2.0; **HiggsAudio tokenizer under an extended licence above 100k MAU** | `stt-install` §4 licence note; D7 | Dev-side fixture only; **must not ship** in the Core product |
| espeak-ng (fallback fixture generator) | GPL-3 | n/a | `coll4` licence table; `env` §7 | Test-audio generation only; not linked into the product |
| FFmpeg (capture stack) | LGPL base; **this host's build is GPL** (`--enable-gpl`, `--enable-libx264`, `--enable-libx265`) | n/a | `coll3` F-88, F-89, F-90, F-91 | Distributing it triggers GPL; cross-ref DOC-05 in row 36 |
| MediaMTX (optional RTSP fixture server) | MIT | n/a | `coll3` F-96 | Only if Q-INSTALL item 4 is used |

**Licence verdict (LB-5):** whisper.cpp (MIT) + ggml turbo weights (MIT) + Silero VAD (MIT) +
sherpa-onnx diarization (Apache-2.0 family) is a licence-clean combination with **no token and no
accepted-terms gate** (`coll4` LB-5). pyannote is the gated route and is excluded (LB-1).

---

## G. Out of scope / class C

| Item | Status | Citation |
|---|---|---|
| C-7 benchmark on the real Core device (performance and accuracy measurements, model size pick) | **Class C** — not produced here | `structured` §9 C-7; register NM-13/E-22; `specs` §G.2; class-C entry criteria include the Core device (Q-HW) |
| Real-time / interactive streaming diarization | **Not required** — the transcript is incremental during recording but not interactive | R-5 ("incremental"); `specs` §E.3; `structured` §6 M6 |
| Hand-built components | **None expected** — the pipeline uses ready-made frameworks (whisper.cpp, sherpa-onnx, Silero VAD, FFmpeg). If a hand-built component is later proposed it must be recorded as a decision | `structured` §2 (memory `feedback-ready-made-frameworks`); `coll4` F-100, F-90, F-19 |
| Evidence-package sealing mechanics | Owned by row 32; this spec only records the transcript's interface to sealing (A.5, D.3) | `specs` §E.4; register NM-08 |
| API contract and DB schema for transcript/revisions | Owned by rows 29/30; this spec only names the operation/permission/entities | register SH-02/SH-13/SH-14, CS-16 |

---

## H. Self-gate (this document's own acceptance)

| Gate check | Result |
|---|---|
| Functional-check criteria measurable without benchmark figures (D230) | **PASS** — E.1 uses structural criteria only; the no-figure statement (E.3) is explicit |
| `RTF|WER|ms per|real-time factor` grep — only "no X" statements | **PASS** — see the grep quote below; every match is inside a negation or the self-gate quote itself |
| Every stage has input + output + checkpoint + failure behaviour | **6/6** — A.1, A.2, A.3, A.4, A.5, A.6 (matrix A.0 + per-stage tables) |
| DOC-05 licence entry list present | **PASS — 15 components** (section F) |
| Cites row 12 or its SKIPPED record | **PASS** — cites the executed `research/10_spike_stt_functional_check.md`: *"Row 12 acceptance: 7/7 PASS"* (row12 §7), 17 segments / 13 sentences (row12 §4.1), language `id` (row12 §4.1); row 12 is **not** a SKIPPED record (status_tasks.md row 12) |
| `TranscriberAdapter` covers both backends | **PASS** — B.2 `omlx-server`, B.3 `cpu-local` (install route, model, proof on this Mac, status corrected by the RV-SPEC errata), B.4 selection rule, B.5 identical return contract, B.6 `TtsFixtureProvider`; B.7 R-8 configuration (proposed) |
| OD-15 / OD-20 / OD-24 cited by decision ID | **PASS** — OD-15 (A.6, D.3), OD-20 (A.2/A.3, E.1), OD-24 (B.3, B.4, F) |
| Every design choice cited | **PASS** — decision ID / register row / `coll3`/`coll4` Fnn / row12 § nn / `specs` § / `file:line` style references on every table row |
| Row-35 security remediation applied (SEC35-14; SEC35-22 cross-ref) | **PASS** — B.2 API-key handling (memory-only, `Authorization` header on loopback, never logged, static test), A.1 `TRANSCRIPT_AUDIO_UNAVAILABLE` reconciled into row 29's list. Stage **6/6**, licence entries **15**, OD citations unchanged |

**Grep proof** (run over this file; the pattern is the row-33 self-gate pattern):

```text
$ grep -nE "RTF|WER|ms per|real-time factor" masterplan/07_transcript_spec.md
```

All matches occur only inside a "no X" negation (E.3), the row-12 reference to `G-1`/`G-4`, or this
self-gate table's own quotation of the pattern. No match asserts a figure.

---

## References

| Ref | Path / section |
|---|---|
| Register | `research/03_analysis.md` — NM-06 (transcript pipeline), NM-07/NM-08 (sealing/package), NM-13 (benchmark, class C), SH-02/SH-03/SH-04/SH-13/SH-14, CS-22, DOC-05; §F W1-C3/W1-C5/W1-C12; §G RK-1; §E superseded |
| Row-12 functional check | `research/10_spike_stt_functional_check.md` — §1 (criterion adaptation), §2 (fixture), §4 (runs), §6 (`duration` unreliable), §7 (7/7), §8 (adapter findings), §9.1 (no-figure grep), §9.2 (re-run recipe) |
| STT collection | `research/04_collection_stt.md` — F-09/F-10/F-12/F-13/F-14/F-19/F-20/F-22/F-30/F-33/F-38/F-40/F-50..F-56/F-70..F-81/F-90..F-106/F-107..F-112/F-127..F-138; LB-1..LB-5; G-1..G-5 |
| Media collection | `research/02_collection.md` — F-44/F-46 (AAC 21.33 ms frame) |
| Specs | `masterplan/01_specs.md` — R-5, R-7, C-N1, C-N2, C-N3, §C.1, §E.2, §E.3, §E.4, §E.5, §G.2 |
| Decisions | `decisions/decisions.md` — D4 (OD-15, OD-20, OD-24), D7 (a)-(d), D8, D10(d), D12 |
| Blueprint | `identification/02_structured.md` row 33 (gate), row 4, row 12, §6 M6, §9 C-7 |

---

*Generated: 2026-10-07 17:05*
*Last Updated: 2026-10-08 (RV-SPEC errata AU3-01/AU2-01/AU2-02 + proposed §B.7 R-8; earlier: row-35 security remediation SEC35-14; SEC35-22 cross-ref)*
