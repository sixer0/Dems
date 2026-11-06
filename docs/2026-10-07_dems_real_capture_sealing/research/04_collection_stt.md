---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 4
milestone: M0
date: 2026-10-07
agent: data-collector-local
tier: 2
items_collected: 105
external_queries: 34
project_identifiers_sent_externally: 0
last_updated: 2026-10-07 07:05
---

# Data Collection Report - STT / diarization / VAD stack facts (row 4)

## Task Overview

Collect externally-sourced facts about CPU-only speech-to-text runtimes, model-conversion paths,
pre-converted model availability, VAD and 2-speaker diarization options, Indonesian ASR quality,
incremental operation and licences. Generic external queries only; no design decision is made here
(the engine pick memo is blueprint row 15 / the transcript spec is row 33).

Acceptance criteria for this row (blueprint row 4 Verification column):

| Criterion | Status in this file |
|---|---|
| Every fact cites a URL | PASS - column `Citation` on every F-row |
| Conversion toolchain listed per runtime with package names plus download size | PASS - section "Conversion toolchain per runtime" |
| Licence named per component | PASS - section "Licence table" |
| Query log with 0 project identifiers | PASS - section "Query log", 34 fetches, 0 identifiers |

Constraints honoured as inputs (already decided, not re-litigated): weights already on disk in
Hugging Face `safetensors` form, large-v3-turbo class, about 1.6 GB; runtime must be CPU-only;
production target is x86 Linux; language is Indonesian; no benchmark numbers are produced on this host.

Neutral need statement used for every external lookup: "CPU-only speech-to-text for recorded
interview audio, Apple Silicon development host, x86 Linux production target, Indonesian language."

---

## Fact table

Confidence key: H = stated by the project's own primary source (repo, official docs, package index);
M = stated by a secondary or community source; L = inferred, needs a local check.

### Group 1 - whisper.cpp (ggml)

| ID | Fact | Value | Citation | Conf | Unblocks |
|---|---|---|---|---|---|
| F-01 | Latest release | v1.9.5, tagged "Latest", published 06 Oct; nightly build b5454 same day | https://github.com/ggml-org/whisper.cpp/releases | H | R10 (pin version), Q-INSTALL 1 |
| F-02 | Homebrew formula name | `whisper.cpp` (class `WhisperCpp`); `whisper-cpp` is recorded as an old name, so `formulae.brew.sh/formula/whisper-cpp` returns 404 | https://formulae.brew.sh/api/formula/whisper.cpp.json ; https://github.com/Homebrew/homebrew-core/blob/master/Formula/w/whisper.cpp.rb | H | R10, Q-INSTALL 1 |
| F-03 | Homebrew version tracked | stable 1.9.5 (matches upstream latest), head available | https://formulae.brew.sh/api/formula/whisper.cpp.json | H | R10 |
| F-04 | What the formula builds | shared lib + examples: `WHISPER_BUILD_EXAMPLES=ON`, `WHISPER_SDL2=ON`, `WHISPER_BUILD_SERVER=OFF`, `WHISPER_USE_SYSTEM_GGML=ON`, `WHISPER_USE_SYSTEM_LLAMA=ON`, `BUILD_SHARED_LIBS=ON` | https://github.com/Homebrew/homebrew-core/blob/master/Formula/w/whisper.cpp.rb | H | R10, R12 |
| F-05 | Installed executables | `whisper-cli`, `whisper-bench`, `whisper-stream`, `whisper-command`, `whisper-server` (not built by the bottle - flag is OFF), `whisper-quantize`, `whisper-vad-speech-segments`, `whisper-talk-llama`, `whisper-lsp`, `parakeet-cli`, `parakeet-quantize` | https://formulae.brew.sh/api/formula/whisper.cpp.json (`executables` field) ; https://github.com/Homebrew/homebrew-core/blob/master/Formula/w/whisper.cpp.rb | H | R10, R12, R33 |
| F-06 | Formula dependencies | `ggml` (runtime, "reject all PRs that try to bundle ggml"), `llama.cpp`, `sdl2-compat`; build dep `cmake`; test dep `pkgconf`; `deny_network_access!` at build time | https://github.com/Homebrew/homebrew-core/blob/master/Formula/w/whisper.cpp.rb | H | R10, Q-INSTALL 1 |
| F-07 | Prebuilt bottle platforms | `arm64_golden_gate`, `arm64_tahoe`, `arm64_sequoia`, `arm64_linux`, `x86_64_linux`. No Intel-macOS bottle | https://github.com/Homebrew/homebrew-core/blob/master/Formula/w/whisper.cpp.rb | H | R10 (dev host), R11/R33 (x86 Linux portability) |
| F-08 | Native CLI binary name | `whisper-cli` (renamed from `main`); usage `whisper-cli [options] file0 file1 ...`; supported input audio: flac, mp3, ogg, wav | https://github.com/ggml-org/whisper.cpp/blob/master/README.md ; https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/cli.cpp | H | R10, R12 |
| F-09 | Thread-count flags | `-t N, --threads N` (threads during computation) and `-p N, --processors N` (processors during computation) | https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/cli.cpp | H | R12, R33 (CPU priority rule), Q-INSTALL 1 |
| F-10 | CPU-only switch | `-ng, --no-gpu` ("disable GPU"); device selection `-dev N, --device N`; OpenVINO encoder device `-oved D` | https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/cli.cpp | H | R12 (quoted command must show GPU disabled), R33 |
| F-11 | Build-time GPU disable | GPU backends are opt-in cmake flags: `-DGGML_CUDA=1`, `-DGGML_VULKAN=1`, `-DGGML_HIP=1`, `-DGGML_MUSA=1`, `-DWHISPER_COREML=1`, `-DWHISPER_OPENVINO=1`, `-DGGML_BLAS=1`. Default cmake build has none of them; README lists "Support for CPU-only inference" | https://github.com/ggml-org/whisper.cpp/blob/master/README.md | H | R10, R12 |
| F-12 | Output-format flags | There is **no** `-otype` option in `whisper-cli`. Formats are separate flags: `-oj/--output-json`, `-ojf/--output-json-full`, `-osrt`, `-ovtt`, `-otxt`, `-ocsv`, `-olrc`, `-owts`, plus `-of FNAME` for the output path. `-ot N` means `--offset-t` (time offset), not output type | https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/cli.cpp | H | R12 (JSON segments), R33 |
| F-13 | Language flag | `-l LANG, --language LANG` (`auto` for detect), `-dl/--detect-language` to exit after detection; `-tr/--translate` exists but is a different task | https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/cli.cpp | H | R12, R33 (Indonesian fixed, no auto-detect) |
| F-14 | Model flag and format | `-m FNAME, --model FNAME`; consumes the custom `ggml` binary container holding model parameters, mel filters, vocabulary and weights in one file | same as F-12; https://github.com/ggml-org/whisper.cpp/blob/master/README.md#ggml-format | H | R11, R12, Q-INSTALL 2 |
| F-15 | Model download script | `models/download-ggml-model.sh <name>` (`.cmd` on Windows); optional second argument = target directory | https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md ; https://github.com/ggml-org/whisper.cpp/blob/master/models/download-ggml-model.sh | H | R10, R11 |
| F-16 | Quantize tool | `whisper-quantize` (built by the bottle; upstream name `quantize`) writes a quantized ggml file, e.g. method `q5_0`, given an input ggml file and an output file | https://github.com/ggml-org/whisper.cpp/blob/master/README.md#quantization ; F-05 | H | R11, R33 (configurable model size) |
| F-17 | Platform support | macOS Intel and Arm, Linux, FreeBSD, Windows (MSVC/MinGW), iOS, Android, WebAssembly, Raspberry Pi, Docker | https://github.com/ggml-org/whisper.cpp/blob/master/README.md | H | R10 (dev host), R33 (x86 Linux Core) |
| F-18 | Container images | `ghcr.io/ggml-org/whisper.cpp:main` for `linux/amd64` and `linux/arm64` (CPU); CUDA/MUSA/Vulkan variants amd64 only | https://github.com/ggml-org/whisper.cpp/blob/master/README.md | H | R33 (portability reference) |
| F-19 | Code licence | MIT | https://github.com/ggml-org/whisper.cpp/blob/master/README.md (license badge); https://formulae.brew.sh/api/formula/whisper.cpp.json (`license: MIT`) | H | DOC-05, R33 |
| F-20 | ggml library licence (formula dependency) | `ggml` 0.26.0, MIT, depends on `libomp` | https://formulae.brew.sh/api/formula/ggml.json | H | DOC-05, R10 |
| F-21 | Built-in VAD | `--vad` plus `-vm FNAME` (VAD model path); documented as "only the detected speech segments are extracted and passed to whisper", reducing the audio Whisper must process | https://github.com/ggml-org/whisper.cpp/blob/master/README.md#voice-activity-detection-vad | H | R33 (VAD chunking stage) |
| F-22 | VAD tuning flags and defaults | `--vad-threshold` 0.5, `--vad-min-speech-duration-ms` 250, `--vad-min-silence-duration-ms` (default value printed at run time), `--vad-max-speech-duration-s` FLT_MAX (auto-split longer at silence above 98 ms), `--vad-speech-pad-ms` 30, `--vad-samples-overlap` 0.10 s | https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/cli.cpp (defaults at lines 109-114 and the VAD option block) | H | R33, R12 |
| F-23 | Standalone VAD segmenter | `whisper-vad-speech-segments` is installed by the formula (separate tool that emits VAD segments) | https://formulae.brew.sh/api/formula/whisper.cpp.json ; https://github.com/ggml-org/whisper.cpp/blob/master/README.md#voice-activity-detection-vad | H | R33 (checkpoint/chunk planning without decoding) |
| F-24 | Segment-quality control knobs relevant to Indonesian | `-et` entropy threshold, `-lpt` logprob threshold, `-nth` no-speech threshold, `-nf` no temperature fallback, `-ps` print special tokens, `--suppress-nst`, `--carry-initial-prompt` (always prepend the initial prompt) | https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/cli.cpp | H | R12, R33 |
| F-25 | Word-level timestamps | Two documented routes: `-dtw MODEL` ("compute token-level timestamps") and the `-ml 1` max-segment-length trick; neither is required for readable text | https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/cli.cpp ; https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md | H | R33 (aligner question) |
| F-26 | Speaker-turn option inside whisper.cpp | `-tdrz, --tinydiarize` needs a special `small.en-tdrz` model; output marks `[SPEAKER_TURN]`; `-di/--diarize` is stereo-channel diarization | https://github.com/ggml-org/whisper.cpp/blob/master/README.md#speaker-segmentation-via-tinydiarize-experimental ; F-09 | H | R33 (why a separate diarizer is still needed: tdrz model is English-only, stereo route assumes channel separation) |
| F-27 | Published RAM/disk footprint | tiny 75 MiB disk / ~273 MB mem; base 142 MiB / ~388 MB; small 466 MiB / ~852 MB; medium 1.5 GiB / ~2.1 GB; large 2.9 GiB / ~3.9 GB. The table does not list large-v3-turbo | https://github.com/ggml-org/whisper.cpp/blob/master/README.md#memory-usage | M (table not updated for turbo) | R33 (model-size configurability) |

### Group 2 - CTranslate2 / faster-whisper

| ID | Fact | Value | Citation | Conf | Unblocks |
|---|---|---|---|---|---|
| F-30 | faster-whisper current version and licence | 1.2.1, MIT, Python >= 3.9 | https://pypi.org/pypi/faster-whisper/json | H | Q-INSTALL 1 alternative, DOC-05 |
| F-31 | Runtime Python requirement | Yes - faster-whisper is a Python package; `import faster_whisper` is the entry point. CTranslate2 itself ships C++/C/Python/other bindings, but the faster-whisper layer is Python-only | https://pypi.org/pypi/faster-whisper/json ; https://github.com/SYSTRAN/faster-whisper/blob/master/README.md | H | OD-24 trade-off, R33 |
| F-32 | Runtime dependency set (no torch) | `ctranslate2>=4.0,<5`, `huggingface-hub>=0.21`, `tokenizers>=0.13,<1`, `onnxruntime>=1.14,<2`, `av>=11`, `tqdm`. `transformers[torch]` appears only as the `conversion` extra | https://pypi.org/pypi/faster-whisper/json (`requires_dist`) | H | Q-INSTALL 2 (torch only for conversion), R33 |
| F-33 | ctranslate2 standalone | 4.8.2, MIT, Python >= 3.9, deps only `numpy` and `pyyaml` | https://pypi.org/pypi/ctranslate2/json | H | DOC-05, R33 |
| F-34 | int8 on CPU | Supported. Quantization types exposed by converters and by `compute_type`: `int8`, `int8_float32`, `int8_float16`, `int8_bfloat16`, `int16`, `float16`, `bfloat16`, `float32`. Type may be chosen at load time, so a float16 CT2 model can be run as int8 without reconversion | https://opennmt.net/CTranslate2/quantization.html | H | R33, Q-INSTALL 1 |
| F-35 | Public description of CPU behaviour vs whisper.cpp | faster-whisper's own README benchmark, "Small model on CPU", 8 threads, Intel Core i7-12700K: openai/whisper fp32 6m58s / 2335 MB; **whisper.cpp fp32 2m05s / 1049 MB**; whisper.cpp OpenVINO 1m45s / 1642 MB; faster-whisper fp32 2m37s / 2257 MB; faster-whisper int8 1m42s / 1477 MB; faster-whisper int8 batch 8 51s / 3608 MB. On that CPU, whisper.cpp fp32 is faster and uses less RAM than faster-whisper fp32; faster-whisper int8 is faster than both | https://github.com/SYSTRAN/faster-whisper/blob/master/README.md#benchmarks | H (self-reported, single machine, single model size) | R15 memo, R33 |
| F-36 | Headline claim | "up to 4 times faster than openai/whisper for the same accuracy while using less memory ... efficiency can be further improved with 8-bit quantization on both CPU and GPU" | https://github.com/SYSTRAN/faster-whisper/blob/master/README.md#benchmarks | H (claim, self-reported) | R15 memo |
| F-37 | x86 Linux support | Officially supported platform for the project; CPU performance tips assume x86 ISA (AVX512 recommended); MKL/oneDNN/Accelerate/OpenBLAS backends selectable at build time | https://opennmt.net/CTranslate2/performance.html ; https://opennmt.net/CTranslate2/installation.html | H | R33 (x86 Linux Core) |
| F-38 | CPU threading guidance | "Use int8 quantization"; "Use an Intel CPU supporting AVX512"; "prefer increasing `inter_threads` over `intra_threads`" for large volume; "Avoid the total number of threads `inter_threads * intra_threads` to be larger than the number of physical cores" | https://opennmt.net/CTranslate2/performance.html#cpu | H | R33 (CPU priority rule vs capture), RK-1 |
| F-39 | Built-in VAD | Silero VAD integrated: `model.transcribe("audio.mp3", vad_filter=True)`; conservative default removes silence longer than 2 s; parameters via `vad_parameters` | https://github.com/SYSTRAN/faster-whisper/blob/master/README.md#vad-filter | H | R33 |
| F-40 | VAD defaults in code | `threshold 0.5`, `min_speech_duration_ms 250`, `max_speech_duration_s inf`, `min_silence_duration_ms 2000`, `speech_pad_ms 400`, `min_silence_at_max_speech 98`, internal window 512 samples (32 ms at 16 kHz), sampling rate 16 kHz | https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/vad.py | H | R33 |
| F-41 | Batched pipeline | `BatchedInferencePipeline.transcribe` is a drop-in replacement for `WhisperModel.transcribe`; VAD filter is enabled by default for batched transcription | https://github.com/SYSTRAN/faster-whisper/blob/master/README.md#batched-transcription | H | R33 |
| F-42 | Model directory layout produced by CT2 converters | a directory with `config.json`, `model.bin`, `source_vocabulary.json`, `target_vocabulary.json` (Whisper: `vocabulary.json` + `tokenizer.json` in practice); `ctranslate2.contains_model()` detects it | https://opennmt.net/CTranslate2/conversion.html | H | R11 (output shape), R33 |
| F-43 | Converted-model version portability | New CT2 versions stay backward compatible with previously converted models ("rarely broken, even for major versions"); forward compatibility is NOT guaranteed - the runtime must not be older than the converter used | https://opennmt.net/CTranslate2/conversion.html#backward-compatibility | H | R11, R33 (pin converter and runtime versions together) |

### Group 3 - Conversion path from an HF safetensors large-v3-turbo checkpoint

| ID | Fact | Value | Citation | Conf | Unblocks |
|---|---|---|---|---|---|
| F-50 | ggml conversion script names | `models/convert-pt-to-ggml.py` (OpenAI `.pt` checkpoint) and `models/convert-h5-to-ggml.py` (Hugging Face Transformers directory, including fine-tuned and distilled models). Both live in the whisper.cpp repo under `models/` | https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md ; https://github.com/ggml-org/whisper.cpp/tree/master/models | H | R11, Q-INSTALL 2 |
| F-51 | ggml HF-path invocation shape | `python3 convert-h5-to-ggml.py <hf_model_dir> <path_to_openai_whisper_source> <out_dir> [use_f32]` - three positional arguments, fourth switches to f32 output | https://github.com/ggml-org/whisper.cpp/blob/master/models/convert-h5-to-ggml.py (argv handling lines 75-117) | H | R11 |
| F-52 | ggml converter Python packages | `torch`, `numpy`, `transformers` (imports `WhisperForConditionalGeneration`); loads the checkpoint with `from_pretrained(dir_model)`, which reads `safetensors` natively | https://github.com/ggml-org/whisper.cpp/blob/master/models/convert-h5-to-ggml.py (lines 18-28, 97) | H | Q-INSTALL 2 (packages), R11 |
| F-53 | ggml converter extra input | It also opens `<whisper_source>/whisper/assets/mel_filters.npz`, so a copy of the OpenAI `whisper` source tree (or an installed `openai-whisper` package directory) must be present next to the model | https://github.com/ggml-org/whisper.cpp/blob/master/models/convert-h5-to-ggml.py (line 102) | H | R11 (second read-only input) |
| F-54 | Source folder write requirement (ggml path) | Read-only safe: the script only opens `config.json`, `vocab.json`, `added_tokens.json` for reading and writes a single file `ggml-model.bin` (or `ggml-model-f32.bin`) into the third argument directory | https://github.com/ggml-org/whisper.cpp/blob/master/models/convert-h5-to-ggml.py (lines 83-117) | H | R11 (source must stay read-only), Q-INSTALL 2 |
| F-55 | Community safetensors-only variant | Issue "how to use the safetensors turbo model with whisper.cpp" answers: (a) use the pre-converted ggml collection, or (b) a community script `convert-safetensors-to-ggml.py` adapted from the h5 converter, same three positional arguments | https://github.com/ggml-org/whisper.cpp/issues/2762 | M (community script, not in the official repo) | R11 fallback |
| F-56 | Known ggml conversion failure mode | Reported failure converting a fine-tuned turbo checkpoint ("Headers too large") traced to hard-coded vocabulary definitions; fixed by PR "eliminate hard-coded vocab definitions to make the Whisper model compatible with custom vocabularies and embedding layer lengths" | https://github.com/ggml-org/whisper.cpp/issues/3431 ; https://github.com/ggml-org/whisper.cpp/pull/3555 | M | R11 (use current master of the script) |
| F-57 | CT2 conversion tool name | `ct2-transformers-converter`, installed with the `ctranslate2` Python package; takes `--model <name_or_local_dir> --output_dir <dir> [--quantization <type>] [--copy_files ...]` | https://opennmt.net/CTranslate2/guides/transformers.html ; https://opennmt.net/CTranslate2/conversion.html | H | R11, Q-INSTALL 2 |
| F-58 | CT2 converter Python packages | `pip install transformers [torch]` is the documented prerequisite; Whisper conversion requires `transformers >= 4.23.0`; Whisper is in the list of supported Transformers architectures | https://opennmt.net/CTranslate2/guides/transformers.html | H | Q-INSTALL 2 |
| F-59 | Source folder write requirement (CT2 path) | Read-only safe: output goes to `--output_dir`; the documented recipe adds `--copy_files tokenizer.json preprocessor_config.json`, i.e. copies FROM the source tree | https://huggingface.co/deepdml/faster-whisper-large-v3-turbo-ct2 (model card, "Conversion details") | H | R11 |
| F-60 | Reference conversion command actually used for this model class | `ct2-transformers-converter --model deepdml/whisper-large-v3-turbo --output_dir faster-whisper-large-v3-turbo --copy_files tokenizer.json preprocessor_config.json --quantization float16` | https://huggingface.co/deepdml/faster-whisper-large-v3-turbo-ct2 (model card, 'Conversion details') | H | R11 |
| F-61 | Conversion toolchain download size (macOS ARM64 dev host) | `torch` 2.14.1 `cp312-macosx_14_0_arm64.whl` = 127.3 MB; `transformers` 5.19.0 = 12.6 MB; `tokenizers` 0.23.2 = 3.39 MB; `safetensors` 0.8.0 = 0.52 MB; `huggingface-hub` 2.1.1 = 0.84 MB. Order of magnitude: about 145 MB of wheels before install | https://pypi.org/pypi/torch/json ; https://pypi.org/pypi/transformers/json ; https://pypi.org/pypi/tokenizers/json ; https://pypi.org/pypi/safetensors/json ; https://pypi.org/pypi/huggingface-hub/json | H (wheel metadata) | Q-INSTALL 2 (size), R11 |
| F-62 | Conversion toolchain download size (x86 Linux) | Default PyPI `torch` 2.14.1 `manylinux_2_28_x86_64.whl` = 554.6 MB (CUDA-bundled). A CPU-only build exists on the separate index `https://download.pytorch.org/whl/cpu/torch/` (`torch-*-+cpu-linux_x86_64.whl`), which avoids the CUDA payload | https://pypi.org/pypi/torch/json ; https://download.pytorch.org/whl/cpu/torch/ | H | R33 (Core-device install size), Q-INSTALL 2 |
| F-63 | Runtime-free alternative to conversion | Not applicable to ggml: ggml files are produced by a Python script. For CT2 the runtime is Python either way, so conversion adds no new language dependency to the deployment, only to the build step | https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md ; https://opennmt.net/CTranslate2/guides/transformers.html | H | OD-24 comparison, R33 |

### Group 4 - Pre-converted model alternatives

| ID | Fact | Value | Citation | Conf | Unblocks |
|---|---|---|---|---|---|
| F-70 | Official pre-converted ggml collection | Hugging Face repo `ggerganov/whisper.cpp` (linked from the whisper.cpp README; VAD models now under `ggml-org/whisper-vad`), licence tag `license:mit` | https://huggingface.co/ggerganov/whisper.cpp/tree/main ; https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md ; https://huggingface.co/api/models/ggerganov/whisper.cpp | H | R11 (skip conversion), Q-INSTALL 5 |
| F-71 | ggml large-v3-turbo file sizes and checksums | `ggml-large-v3-turbo.bin` 1,624,555,275 B (about 1.55 GiB), sha256 `1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69`; `ggml-large-v3-turbo-q8_0.bin` 874,188,075 B, sha256 `317eb69c...24e259a1`; `ggml-large-v3-turbo-q5_0.bin` 574,041,195 B, sha256 `394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2` | https://huggingface.co/api/models/ggerganov/whisper.cpp/tree/main?blobs=true | H | R11 (compare against converted output), R33 |
| F-72 | Published SHA-1 list for the same files | models/README publishes SHA-1 per model: large-v3-turbo `4af2b29d7ec73d781377bfd1758ca957a807e941`, large-v3-turbo-q5_0 `e050f7970618a659205450ad97eb95a18d69c9ee`, large-v3 `ad82bf6a9043ceed055076d0fd39f5f186ff8062` | https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md | H | R11 verification step |
| F-73 | Other ggml tiers on disk-free download | tiny 75 MiB, base 142 MiB, small 466 MiB, medium 1.5 GiB, large-v3 2.9 GiB (3,095.0 MB), large-v3-q5_0 1.1 GiB (1,081.1 MB); q8_0 variants exist for tiny/base/small/medium/large-v2 | https://huggingface.co/api/models/ggerganov/whisper.cpp/tree/main?blobs=true ; https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md | H | R33 (configurable model path) |
| F-74 | Community ggml mirrors | Several community turbo-ggml repos exist (e.g. `Pomni/whisper-large-v3-turbo-ggml-allquants` MIT, `openresearchtools/whisper-large-v3-turbo-GGML` MIT, language-specific forks under Apache-2.0/MIT); download counts are near zero compared with the official collection | https://huggingface.co/api/models?search=whisper-large-v3-turbo-ggml | M | R11 (prefer the official collection) |
| F-75 | Pre-converted CT2 turbo | `deepdml/faster-whisper-large-v3-turbo-ct2`, licence tag `license:mit`, about 145k downloads; `model.bin` 1,617.9 MB (float16) + `tokenizer.json` 2.7 MB + `vocabulary.json` 1.1 MB; card lists `id` (Indonesian) among supported languages | https://huggingface.co/deepdml/faster-whisper-large-v3-turbo-ct2 ; https://huggingface.co/api/models/deepdml/faster-whisper-large-v3-turbo-ct2/tree/main?recursive=true&blobs=true | H | OD-24 alternative, R11 comparison |
| F-76 | Other pre-converted CT2 builds | `Systran/faster-whisper-large-v3` (`model.bin` 3,087.3 MB, the non-turbo tier); many language-specific turbo CT2 forks, mostly MIT or Apache-2.0, low download counts | https://huggingface.co/api/models/Systran/faster-whisper-large-v3/tree/main?recursive=true&blobs=true ; https://huggingface.co/api/models?search=faster-whisper-large-v3-turbo-ct2 | M | R15 memo |
| F-77 | Trust/verification posture for downloads | The ggml collection publishes SHA-1 per model in the repository (F-72) and Hugging Face exposes a sha256 blob id per file (F-71); the CT2 cards publish no checksum list, so integrity must be established by hashing after download and pinning the hash locally | https://huggingface.co/api/models/ggerganov/whisper.cpp/tree/main?blobs=true ; https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md ; https://huggingface.co/deepdml/faster-whisper-large-v3-turbo-ct2 | H | R11, R33, DOC-05 |
| F-78 | Weight licence of the source checkpoint class | `openai/whisper-large-v3-turbo` carries `license:mit` (808,878,080 parameters); `openai/whisper-large-v3` carries `license:apache-2.0` | https://huggingface.co/api/models/openai/whisper-large-v3-turbo ; https://huggingface.co/api/models/openai/whisper-large-v3 | H | DOC-05, R33 |

### Group 5 - Model-size configurability

| ID | Fact | Value | Citation | Conf | Unblocks |
|---|---|---|---|---|---|
| F-80 | Tiers available as ggml | tiny, tiny.en, base, base.en, small, small.en, small.en-tdrz, medium, medium.en, large-v1, large-v2, large-v3, large-v3-turbo plus `-q5_0`/`-q8_0` variants of the larger tiers | https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md ; https://github.com/ggml-org/whisper.cpp/blob/master/models/download-ggml-model.sh | H | R33 (configurable model path) |
| F-81 | ggml disk sizes (published) | tiny 75 MiB / base 142 MiB / small 466 MiB / medium 1.5 GiB / large-v3 2.9 GiB / large-v3-turbo 1.5 GiB; quantized: large-v3-q5_0 1.1 GiB, large-v3-turbo-q5_0 547 MiB | https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md | H | R33 |
| F-82 | ggml RAM figures (published) | Only up to `large`: 273 MB / 388 MB / 852 MB / 2.1 GB / 3.9 GB. No published RAM figure for large-v3-turbo | https://github.com/ggml-org/whisper.cpp/blob/master/README.md#memory-usage | M | R33, gap G-3 |
| F-83 | CT2 tier sizing rule | CT2 stores one `model.bin` whose size follows the chosen `--quantization`; the published size table for a base Transformer shows float32 364 MB, float16 182 MB, int8_float16 95 MB - i.e. roughly 0.5x for fp16 and 0.26x for int8 relative to fp32. Applied to the turbo class: fp16 about 1.6 GB (F-75), int8 about 0.4-0.5 GB expected | https://opennmt.net/CTranslate2/quantization.html ; F-75 | M (ratio is for a translation model, not Whisper) | R33, gap G-3 |
| F-84 | Quantization accuracy statement | "Quantization is a technique that can reduce the model size and accelerate its execution with little to no degradation in accuracy" (CTranslate2 docs) | https://opennmt.net/CTranslate2/quantization.html | H | R33 (smaller tiers are viable) |

### Group 6 - VAD: Silero

| ID | Fact | Value | Citation | Conf | Unblocks |
|---|---|---|---|---|---|
| F-90 | Licence | MIT (LICENSE file, "Copyright (c) 2020-present Silero Team"); README states "Published under permissive license (MIT) ... no telemetry, no keys, no registration, no built-in expiration, no keys or vendor lock". Note the README badge image text still reads "License: CC BY-NC 4.0" while its label and link point to the MIT LICENSE file | https://raw.githubusercontent.com/snakers4/silero-vad/master/LICENSE ; https://github.com/snakers4/silero-vad/blob/master/README.md | H (LICENSE governs) | DOC-05, R33, Q-INSTALL 5 |
| F-91 | Model file sizes | `silero_vad.onnx` 2,327,524 B; `silero_vad_16k_op15.onnx` 1,289,603 B; `silero_vad_half.onnx` 1,280,395 B; `silero_vad_16k_sequence.onnx` 1,246,165 B; `silero_vad.jit` 2,272,526 B; `silero_vad_16k.safetensors` 1,239,748 B. README: "JIT model is around two megabytes in size" | https://github.com/snakers4/silero-vad/tree/master/src/silero_vad/data (contents API) ; F-90 README | H | Q-INSTALL 5 (tiny download) |
| F-92 | Runs without PyTorch | Yes on the ONNX path: "If you are planning to run the VAD using solely the onnx-runtime, it will run on any other system architectures where onnx-runtime is supported", with the caveats that I/O and post-processing are the integrator's job. The pip package `silero-vad` itself lists `torch>=1.12.0` as Required; the ONNX route is provided by the extra `silero-vad[onnx-cpu]` = `onnxruntime>=1.16.1` + `numpy` | https://github.com/snakers4/silero-vad/blob/master/README.md | H | R33 (no torch at run time), Q-INSTALL 5 |
| F-93 | CPU cost | "One audio chunk (30+ ms) takes less than 1 ms to be processed on a single CPU thread"; batching/GPU improve further; "under certain conditions ONNX may even run up to 4-5x faster". Recommended hardware note: 1 GB+ RAM and a CPU with AVX/AVX2/AVX-512/AMX | https://github.com/snakers4/silero-vad/blob/master/README.md#performance | H | RK-1 (VAD is cheap next to Whisper), R33 |
| F-94 | Normal pairing with Whisper | Segment-then-decode: run VAD over the whole buffer, keep speech intervals, feed only those to Whisper. faster-whisper does this internally (`vad_filter=True`, F-39); whisper.cpp does it with `--vad -vm <ggml-vad-model>` (F-21); the README of Silero links a C++ ONNX example for the same pattern | F-39, F-21, https://github.com/snakers4/silero-vad/tree/master/examples/cpp | H | R33 |
| F-95 | whisper.cpp-native VAD model | Downloaded with `./models/download-vad-model.sh silero-v6.2.0` from `https://huggingface.co/ggml-org/whisper-vad`; saved as `ggml-silero-v6.2.0.bin`, reported as 864.35 KB; convertible with `models/convert-silero-vad-to-ggml.py` (needs `pip install silero-vad`) | https://github.com/ggml-org/whisper.cpp/blob/master/README.md#silero-vad | H | Q-INSTALL 5, R10, R33 |

### Group 7 - Speaker diarization for 2 speakers

| ID | Fact | Value | Citation | Conf | Unblocks |
|---|---|---|---|---|---|
| F-100 | sherpa-onnx diarization support | Yes - a dedicated "Speaker Diarization" section with Python, C, C++, C#, Dart, Go, Java, JavaScript, Kotlin, Pascal, Rust and Swift API examples plus a Hugging Face space and Android APKs. Pipeline = speaker segmentation model + speaker embedding model | https://k2-fsa.github.io/sherpa/onnx/speaker-diarization/index.html | H | R33, Q-INSTALL 5 |
| F-101 | sherpa-onnx code licence | Apache-2.0 (LICENSE file is the full Apache 2.0 text); PyPI `sherpa-onnx` 1.13.8 declares "Apache licensed, as found in the LICENSE", requires Python >= 3.7 | https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/master/LICENSE ; https://pypi.org/pypi/sherpa-onnx/json | H | DOC-05, Q-INSTALL 5 |
| F-102 | sherpa-onnx CPU and architecture support | ONNX-runtime project; support matrix lists x86 and arm64 across Linux, macOS, Windows plus Android/iOS/HarmonyOS; also x86_64, 32/64-bit ARM, RISC-V riscv64, Raspberry Pi. Runs on CPU (NPU/GPU paths are additional) | https://github.com/k2-fsa/sherpa-onnx/blob/master/README.md | H | R33 (ARM64 dev host + x86 Linux Core) |
| F-103 | sherpa-onnx install footprint | PyPI wheels: `sherpa_onnx-1.13.8-cp310-macosx_10_15_universal2.whl` 4.43 MB, `...manylinux2014_x86_64...whl` 4.4 MB; the actual engine is `sherpa-onnx-core==1.13.8` (e.g. `...manylinux2014_aarch64.whl` 13.35 MB). C API / shared libraries also ship, so the runtime does not have to be Python | https://pypi.org/pypi/sherpa-onnx/json ; https://pypi.org/pypi/sherpa-onnx-core/json | H | Q-INSTALL 5, R33 |
| F-104 | Segmentation model assets and sizes | GitHub release tag `speaker-segmentation-models`: `sherpa-onnx-pyannote-segmentation-3-0.tar.bz2` 6.96 MB; `sherpa-onnx-reverb-diarization-v1.tar.bz2` 10.92 MB; `sherpa-onnx-reverb-diarization-v2.tar.bz2` 254.08 MB | https://github.com/k2-fsa/sherpa-onnx/releases/tag/speaker-segmentation-models | H | Q-INSTALL 5 (must download) |
| F-105 | Embedding model assets and sizes | GitHub release tag `speaker-recongition-models` (sic): `3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx` 29.6 MB; `3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx` 28.28 MB; `3dspeaker_speech_eres2net_sv_en_voxceleb_16k.onnx` 26.49 MB; `nemo_en_speakerverification_speakernet.onnx` 23.41 MB; `nemo_en_titanet_small.onnx` 40.26 MB; `nemo_en_titanet_large.onnx` 101.41 MB; `wespeaker_en_voxceleb_resnet34.onnx` 26.53 MB; largest `3dspeaker_speech_eres2net_sv_zh-cn_16k-common.onnx` 220.62 MB | https://github.com/k2-fsa/sherpa-onnx/releases/tag/speaker-recongition-models | H | Q-INSTALL 5 (must download) |
| F-106 | Licences of the sherpa-onnx model families | The 3D-Speaker source project (modelscope/3D-Speaker) is Apache-2.0 per its repository licence; NeMo and WeSpeaker are Apache-2.0 projects; the pyannote segmentation-3.0 weights are the gated case (F-110). sherpa-onnx republishes converted ONNX copies under its own release tag without a per-asset licence statement | https://github.com/modelscope/3D-Speaker ; F-104 | M (per-family licence is inherited, not restated by sherpa-onnx) | DOC-05, R33 |
| F-107 | pyannote.audio code licence and runtime | Code is MIT ("Copyright (c) 2020 CNRS"). The toolkit is "written in Python for speaker diarization. Based on PyTorch"; setup notes require ffmpeg and `pip install pyannote.audio` | https://raw.githubusercontent.com/pyannote/pyannote-audio/develop/LICENSE ; https://github.com/pyannote/pyannote-audio/blob/develop/README.md | H | DOC-05, R33 |
| F-108 | pyannote.audio needs Python + PyTorch at runtime | Yes - PyTorch is the framework; the quick-start imports `torch` and the pipeline runs `.to(torch.device(...))`. There is no CPU-only non-Python deployment documented in the README | https://github.com/pyannote/pyannote-audio/blob/develop/README.md | H | OD-24 contrast, R33 |
| F-109 | pyannote needs an HF access token | Yes - README step 4: "Create Huggingface access token at hf.co/settings/tokens" and the pipeline call passes `token="HUGGINGFACE_ACCESS_TOKEN"` | https://github.com/pyannote/pyannote-audio/blob/develop/README.md | H | OD-20 licence check, Q-INSTALL 5 |
| F-110 | Gating on the pyannote pipeline weights | `pyannote/speaker-diarization-3.1` and `pyannote/segmentation-3.0` are both `gated: auto` on Hugging Face (account + accepted user conditions, auto-approved), even though their declared weight licence tag is `license:mit`. Anonymous raw-file fetch of the gated model card returns HTTP 401, i.e. downloads really are blocked without a token. The companion embedding model `pyannote/wespeaker-voxceleb-resnet34-LM` is NOT gated and is tagged `license:cc-by-4.0` | https://huggingface.co/api/models/pyannote/speaker-diarization-3.1 ; https://huggingface.co/api/models/pyannote/segmentation-3.0 ; https://huggingface.co/api/models/pyannote/wespeaker-voxceleb-resnet34-LM ; probe of `.../raw/main/README.md` -> 401 | H | OD-20, Q-INSTALL 5, DOC-05 |
| F-111 | MIT/Apache ONNX CPU alternative | sherpa-onnx (Apache-2.0 code, ONNX models, CPU, arm64+x86) is the only fully non-gated option found; its own segmentation option `sherpa-onnx-reverb-diarization-v1/v2` avoids the gated pyannote weights entirely (F-104). A second non-Python route exists through its C API (F-103) | https://k2-fsa.github.io/sherpa/onnx/speaker-diarization/index.html | H | R33, Q-INSTALL 5 |
| F-112 | Fixed-speaker-count option | The diarization pages document a `max_speakers` style constraint through the clustering configuration of the diarization pipeline rather than a dedicated 2-speaker model; the release assets are generic (no 2-speaker-specific checkpoint exists) | https://k2-fsa.github.io/sherpa/onnx/speaker-diarization/index.html | M | R33 (LABELLED/UNAVAILABLE rule) |

### Group 8 - Indonesian quality

| ID | Fact | Value | Citation | Conf | Unblocks |
|---|---|---|---|---|---|
| F-120 | Turbo architecture and quality claim | "the exact same model, except that the number of decoding layers have reduced from 32 to 4 ... the model is way faster, at the expense of a minor quality degradation"; 808,878,080 parameters | https://huggingface.co/openai/whisper-large-v3-turbo ; https://huggingface.co/api/models/openai/whisper-large-v3-turbo | H | R33, R15 memo |
| F-121 | Whisper's own limitation statement for non-English | "Our models perform unevenly across languages, and we observe lower accuracy on low-resource and/or low-discoverability languages ..."; hallucination and repetition risks are expected to be worse on lower-resource languages | https://huggingface.co/openai/whisper-large-v3 (model card, Limitations) | H | R33 (transcript must be revisable - OD-15), R12 |
| F-122 | Published Indonesian WER, off-the-shelf Whisper | Indonesian Speech Variabilities (IDSV) test set, overall: `whisper-small` WER 30.87 / CER 13.84; per group (read-formal-clean 27.22/9.85, read-formal-moderate 23.04/7.36, spontaneous-formal-moderate 38.85/20.64, scripted-informal-clean 40.66/25.41, spontaneous-informal-moderate 22.85/11.56) | https://arxiv.org/abs/2410.08828v2 (Table 3) ; HTML https://arxiv.org/html/2410.08828v2 | H (peer-reviewed workshop paper, small tier only) | R33, C-7 benchmark design |
| F-123 | Published Indonesian WER, fine-tuned | Same table: `FT-whisper` (fine-tuned whisper-small) WER 14.85 / CER 5.44 overall; `FT-mms` with LM 19.95/6.45; `mms-1b-all` 29.30/9.57. Speaking-style variability hurt performance most | https://arxiv.org/html/2410.08828v2 (Table 3) | H | R33 (accuracy ceiling without fine-tuning), C-7 |
| F-124 | Indonesian in the turbo distribution | The pre-converted CT2 turbo card lists `id` among its supported languages; the OpenAI multilingual model family covers 100 languages including Indonesian | https://huggingface.co/deepdml/faster-whisper-large-v3-turbo-ct2 (card front matter) ; F-122 §4.2 | M | R12 (Indonesian sample is valid) |
| F-125 | Punctuation model | Not needed for Whisper: the model emits punctuated, case-restored text as part of the transcription task (the IDSV paper describes Whisper's "extensive text normalizer"; the HF card describes long-form stitching, not a punctuation stage). Contrast: sherpa-onnx documents a separate "Punctuation" model section for its non-Whisper ASR models | F-122 §4.2 ; https://huggingface.co/openai/whisper-large-v3 ; https://k2-fsa.github.io/sherpa/onnx/punctuation/index.html (nav entry seen in sherpa docs) | M | R33 (no extra punctuation download) |
| F-126 | Forced aligner | Optional, only for word-level timing: whisper.cpp `-dtw MODEL` or `-ml 1` (F-25); faster-whisper exposes word timestamps through its own options. Sentence-level timestamps come from the decoder itself | https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/cli.cpp ; https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/transcribe.py | M | R33 (segment timestamps suffice for the transcript pane) |
| F-127 | Long-form algorithm choice | Whisper's receptive field is 30 s. Two long-form strategies: sequential sliding-window (more accurate, "up to 0.5% WER more accurate", better for batches and when accuracy dominates) and chunked with small overlap and boundary stitching (faster, better for a single long file). "For large-v3, a chunk length of 30-seconds is optimal" | https://huggingface.co/openai/whisper-large-v3 (Chunked Long-Form section) | H | R33 (chunk checkpoint design), R12 |

### Group 9 - Incremental / streaming operation

| ID | Fact | Value | Citation | Conf | Unblocks |
|---|---|---|---|---|---|
| F-130 | whisper.cpp streaming example | `whisper-stream` "samples the audio every half a second and runs the transcription continuously"; documented invocation `whisper-stream -m <model> -t 8 --step 500 --length 5000` (needs `WHISPER_SDL2=ON`, which the Homebrew bottle enables) | https://github.com/ggml-org/whisper.cpp/blob/master/README.md#real-time-audio-input-example ; F-04 | H | R33, R12 |
| F-131 | Chunk continuity controls | `-ot/--offset-t` (time offset ms), `-on/--offset-n` (segment index offset), `-d/--duration` (duration to process), `--prompt`, `--carry-initial-prompt` (always prepend the prompt) - the documented way to keep context across successive chunks | https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/cli.cpp | H | R33 (chunk checkpoints, resume after kill) |
| F-132 | VAD-seeded chunking in whisper.cpp | With `--vad`, only detected speech is decoded; long speech is auto-split at silence above 98 ms once `--vad-max-speech-duration-s` is reached, and consecutive segments overlap by `--vad-samples-overlap` (default 0.10 s) so edges are not cut | https://github.com/ggml-org/whisper.cpp/blob/master/README.md#voice-activity-detection-vad | H | R33 |
| F-133 | Practical chunk sizes in the wild | faster-whisper caps VAD speech chunks at the feature-extractor `chunk_length` (`max_speech_duration_s=chunk_length`, default 30 s window, overridable per call); its VAD trims silence of 2 s or more and pads speech by 400 ms. HF guidance: 30 s chunks are optimal for large-v3. whisper-stream default step/length: 0.5 s sampling, 5 s decode window | https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/vad.py ; https://huggingface.co/openai/whisper-large-v3 ; https://github.com/ggml-org/whisper.cpp/blob/master/README.md#real-time-audio-input-example | H | R33 |
| F-134 | Documented streaming layer on top of CT2 | Whisper-Streaming "implements real-time mode for offline Whisper-like speech-to-text models with faster-whisper as the most recommended back-end", using a local agreement policy with self-adaptive latency; reports 3.3 s latency on an unsegmented long-form test; exposes `--min-chunk-size` (minimum audio chunk in seconds), `--buffer_trimming {sentence,segment}` and `--buffer_trimming_sec` | https://github.com/ufal/whisper_streaming/blob/main/README.md ; paper https://aclanthology.org/2023.ijcnlp-demo.3.pdf | H | R33 (incremental design reference) |
| F-135 | State carried between chunks | Whisper-Streaming keeps a growing hypothesis buffer and trims only confirmed (punctuated/segment-complete) text; faster-whisper's generator yields segments lazily and `condition_on_previous_text=True` by default (previous segment text becomes the next prompt). whisper.cpp equivalent is `--carry-initial-prompt` plus `-ot/-on` offsets | F-134 ; https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/transcribe.py (line 277) ; F-131 | H | R33 (checkpoint semantics) |
| F-136 | CPU-contention guidance, whisper.cpp side | Only the thread/processor caps are documented (`-t`, `-p`); the README documents no interaction with other real-time processes and no dropped-audio figure | https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/cli.cpp ; https://github.com/ggml-org/whisper.cpp/blob/master/README.md (absence verified in both) | H (absence verified in README/CLI help) | RK-1, R33 |
| F-137 | CPU-contention guidance, CT2 side | Explicit rule: keep `inter_threads * intra_threads` at or below the number of physical cores; prefer raising `inter_threads` over `intra_threads` for volume work and use the stream/iterable methods | https://opennmt.net/CTranslate2/performance.html#cpu | H | RK-1, R33 |
| F-138 | Dropped-audio risk documentation | No public source found that quantifies audio-drop risk when a Whisper CPU runtime shares cores with another real-time capture process; the closest documented evidence is the VAD cost (<1 ms per 30 ms chunk, F-93) and the thread-cap rules (F-136, F-137). This must be proven locally by the M6 "no dropped capture fragment while STT runs" check | https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/cli.cpp ; https://opennmt.net/CTranslate2/performance.html#cpu (absence verified in both) | H (absence) | RK-1, M6 gate, C-7 |

---

## Conversion toolchain per runtime

| Item | Runtime A: whisper.cpp (ggml) | Runtime B: CTranslate2 / faster-whisper |
|---|---|---|
| Converter name | `models/convert-h5-to-ggml.py` (HF directory input) or `models/convert-pt-to-ggml.py` (OpenAI `.pt` input) | `ct2-transformers-converter` (console script of the `ctranslate2` wheel) |
| Command shape | `python3 convert-h5-to-ggml.py <hf_dir> <whisper_src_dir> <out_dir>` | `ct2-transformers-converter --model <hf_dir> --output_dir <out_dir> --copy_files tokenizer.json preprocessor_config.json --quantization float16\|int8` |
| Python packages needed | `torch`, `numpy`, `transformers` (script imports all three) | `ctranslate2`, `transformers>=4.23.0`, `torch` (documented as `pip install transformers [torch]`) |
| Extra non-package input | a copy of the OpenAI `whisper` source tree for `whisper/assets/mel_filters.npz` | none beyond the checkpoint files |
| Download size, macOS ARM64 | about 145 MB of wheels (torch 127.3 + transformers 12.6 + tokenizers 3.4 + safetensors 0.5 + hub 0.8) | same order (same stack; `ctranslate2` wheel adds a few MB) |
| Download size, x86 Linux | default `torch` wheel 554.6 MB (CUDA-bundled); CPU-only index `download.pytorch.org/whl/cpu` avoids it | same, unless the CT2 wheel alone is installed and conversion is done elsewhere |
| Does the source model folder stay read-only | Yes - reads `config.json`, `vocab.json`, `added_tokens.json`, the weights; writes only `<out_dir>/ggml-model.bin` | Yes - writes only `--output_dir`; `--copy_files` copies out of the source |
| Output artefact | one file, `ggml-model.bin` (about 1.5 GiB fp16 for turbo) | one directory: `config.json`, `model.bin`, `vocabulary.json`, `tokenizer.json` |
| Python needed at run time | No - native `whisper-cli` / libwhisper | Yes - faster-whisper is a Python package (CTranslate2 also has C/C++ APIs, but the faster-whisper layer is Python) |
| Install footprint of the runtime | Homebrew bottle, one keg, deps `ggml`, `llama.cpp`, `sdl2-compat` | pip venv: `faster-whisper` + `ctranslate2` + `onnxruntime` + `av` + `tokenizers` + `huggingface-hub` + `tqdm` |
| Skip-conversion option | Official pre-converted ggml turbo, MIT, sha256 published (F-71) | Community pre-converted CT2 turbo, MIT, about 145k downloads, no published checksum (F-75, F-77) |
| Version coupling | ggml format is read by the matching whisper.cpp/ggml version | Converted model must not be loaded by a CT2 runtime older than the converter used (F-43) |

Evidence rows: F-50 to F-63, F-70 to F-77, F-04 to F-06, F-30 to F-33, F-42, F-43.

---

## Licence table (feeds DOC-05)

| Component | Code licence | Model-weight licence | Redistribution constraints | Evidence |
|---|---|---|---|---|
| whisper.cpp | MIT | n/a (converter script only) | Permissive; keep the copyright notice in distributed copies | F-19 |
| ggml (Homebrew dependency) | MIT | n/a | Permissive | F-20 |
| llama.cpp (Homebrew dependency of the formula) | MIT (formula-reported dependency chain) | n/a | Permissive; verify the exact pinned version before shipping | F-06 |
| SDL2-compat (Homebrew dependency) | zlib family (formula-reported) | n/a | Verify per version pin | F-06 |
| Whisper large-v3-turbo weights | n/a | MIT (`license:mit`) | Redistributable; a converted ggml/CT2 derivative inherits the MIT terms | F-78 |
| Whisper large-v3 weights (non-turbo) | n/a | Apache-2.0 | Redistributable | F-78 |
| Pre-converted ggml collection (`ggerganov/whisper.cpp`) | MIT | MIT tag on the repo | Redistributable; SHA-1 published per file for integrity | F-70, F-72 |
| Pre-converted CT2 turbo (`deepdml/...-ct2`) | MIT | MIT tag | Redistributable in principle; no published checksum, so hash-on-download is required | F-75, F-77 |
| faster-whisper | MIT | n/a | Permissive | F-30 |
| CTranslate2 | MIT | n/a | Permissive | F-33 |
| Silero VAD | MIT (LICENSE file) | MIT (same grant; README states "permissive license (MIT)") | Redistributable; ignore the stale CC BY-NC badge text and cite the LICENSE file | F-90 |
| Silero VAD ggml copy (`ggml-org/whisper-vad`) | MIT (whisper.cpp project) | MIT (Silero) | Redistributable | F-95, F-90 |
| sherpa-onnx | Apache-2.0 | Inherited per model family | Apache-2.0 code; model assets inherit their upstream family terms, which sherpa-onnx does not restate per asset | F-101, F-106 |
| 3D-Speaker embeddings (CAM++ / ERes2Net) | Apache-2.0 (source project) | Apache-2.0 per the source project licence | Redistributable; record the exact checkpoint used | F-106 |
| NeMo / WeSpeaker embeddings used by sherpa-onnx | Apache-2.0 projects | Per-checkpoint terms should be recorded at download time | Record per asset | F-106 |
| pyannote.audio (code) | MIT (CNRS) | n/a | Permissive | F-107 |
| pyannote segmentation-3.0 / speaker-diarization-3.1 (weights) | n/a | Declared `license:mit` **but gated** (`gated: auto`) | Requires a Hugging Face account, acceptance of the user conditions and an access token; anonymous download returns 401. Acceptance is a human action, not an agent action | F-110 |
| pyannote WeSpeaker voxceleb resnet34-LM embedding | n/a | CC-BY-4.0, not gated | Attribution obligation if redistributed | F-110 |
| espeak-ng (synthetic Indonesian sample source, row 12) | GPL-3.0-class tool used only to generate test audio | n/a | Test fixture generation only; not linked into the product | out of row-4 scope, noted for DOC-05 completeness |

---

## Model downloads required (Q-INSTALL item 5)

| Need | Model | Size | Download required | Token / accepted licence required |
|---|---|---|---|---|
| VAD for whisper.cpp | `ggml-silero-v6.2.0.bin` (via `models/download-vad-model.sh silero-v6.2.0`) | 864 KB | Yes | No (MIT) |
| VAD for a Python/ONNX path | `silero_vad_16k_op15.onnx` or `silero_vad.onnx` | 1.29 MB / 2.33 MB | Yes | No (MIT) |
| Diarization, non-gated route | `sherpa-onnx-reverb-diarization-v1.tar.bz2` (+ one embedding ONNX, e.g. CAM++ en 29.6 MB or speakernet 23.4 MB) | 10.9 MB + 23-30 MB | Yes | No (Apache-2.0 family) |
| Diarization, pyannote-quality route | `sherpa-onnx-pyannote-segmentation-3-0.tar.bz2` (converted copy) or `pyannote/segmentation-3.0` direct | 7 MB | Yes | Direct HF download: yes (gated, token + accepted terms). sherpa-onnx release copy: no token, but the family terms still apply to redistribution - record it in DOC-05 |
| Transcript punctuation | none - Whisper emits punctuation | 0 | No | No |
| Forced aligner | optional `-dtw` alignment model only if word-level timestamps are wanted | not sized here | Optional | No |
| STT weights | already on disk (large-v3-turbo class, HF safetensors, about 1.6 GB) | 0 | No (conversion output is new, about 1.5 GiB) | No |

Evidence rows: F-91, F-95, F-104, F-105, F-110, F-125, F-25, F-78.

---

## Licence blockers found

| # | Blocker | Severity | Detail | Where it bites |
|---|---|---|---|---|
| LB-1 | pyannote gated weights | Blocking for the pyannote route | `speaker-diarization-3.1` and `segmentation-3.0` are `gated: auto`; downloading needs a named HF account, acceptance of the user conditions and a stored token. An agent cannot accept model terms on a human's behalf | OD-20 (download allowed "after the row-4 licence check"), Q-INSTALL 5, M6 |
| LB-2 | CC-BY-4.0 attribution | Low, but real | `pyannote/wespeaker-voxceleb-resnet34-LM` is CC-BY-4.0, not MIT; attribution text is needed if the model is redistributed inside a package | DOC-05, M9 packaging |
| LB-3 | sherpa-onnx per-asset licence silence | Medium | sherpa-onnx is Apache-2.0 but its diarization release assets do not carry per-asset licence files; the effective terms come from the upstream families (3D-Speaker Apache-2.0, NeMo/WeSpeaker Apache-2.0, pyannote gated). A per-asset record is required before redistribution | DOC-05, Q-INSTALL 5 |
| LB-4 | Silero badge ambiguity | Cosmetic | The README badge image alt-text still says "CC BY-NC 4.0" while the linked LICENSE file is MIT. Quote the LICENSE file, not the badge, in DOC-05 | DOC-05 |
| LB-5 | No blocker on the decided path | - | whisper.cpp (MIT) + ggml turbo weights (MIT) + Silero VAD (MIT) + sherpa-onnx diarization (Apache-2.0 family) is a licence-clean combination with no token and no accepted-terms gate | R10, R11, R33 |

---

## Gaps / needs more data

| # | Gap | Why it matters | Suggested owner |
|---|---|---|---|
| G-1 | No published Indonesian WER for large-v3 or large-v3-turbo was reachable from this host (search engines are blocked; arXiv and Hugging Face were reachable). The only citable Indonesian figures found are for `whisper-small` (F-122, F-123) | Accuracy expectations for the transcript cannot be quoted from public sources; D230 forbids benchmarking here | Class C-7 benchmark on the Core device; row 33 must define the functional criterion without a WER number |
| G-2 | Whether `convert-h5-to-ggml.py` at current master converts a stock `openai/whisper-large-v3-turbo` directory end-to-end is not stated in any official document; the turbo tier is officially offered as a pre-converted download (F-70, F-71) and the known turbo conversion complaints concern custom-vocabulary fine-tunes (F-56) | Row 11 feasibility | Row 11 measures it directly on the read-only source; pre-converted download is the documented fallback |
| G-3 | No published RAM figure for large-v3-turbo in either runtime; the CT2 int8 ratio is published only for a translation model (F-82, F-83) | Model-size configurability claims in the transcript spec | Class C-7 measurement; row 33 states configurability without a RAM number |
| G-4 | No public documentation quantifies dropped-audio risk when a CPU Whisper runtime shares cores with a real-time capture process (F-138) | RK-1 mitigation design | M6 "no dropped fragment while STT runs" check (2 + 1) |
| G-5 | sherpa-onnx 2-speaker behaviour: no dedicated 2-speaker checkpoint exists; speaker-count limiting is a pipeline/clustering setting (F-112) and its accuracy on two similar voices is not published | LABELLED/UNAVAILABLE rule in row 33 | Row 12/33 spike evidence, or accept UNAVAILABLE as the default outcome |
| G-6 | Exact installed (unpacked) size of the conversion venv was not collected - only wheel download sizes (F-61, F-62) | Q-INSTALL 2 size logging | Row 10 logs installed size per item as part of its normal record |
| G-7 | Homebrew bottle availability for Intel macOS is absent (F-07); irrelevant to the stated hosts but relevant if an x86 Mac ever becomes the dev host | Portability note only | None needed |

---

## Query log

All external access was to public vendor/project sources. Every lookup was phrased in neutral terms
(CPU-only speech-to-text, recorded interview audio, Apple Silicon development host, x86 Linux target,
Indonesian). Zero project names, repository names, repository paths, file names from the repository,
identifiers, customer data or repository content were sent to any external service. No repository
content was pasted into any external service. General search engines were unreachable from this host
(one connection failure recorded below), so lookups went directly to primary-source URLs.

| # | Time | Neutral need expressed | Target fetched | Project identifiers sent |
|---|---|---|---|---|
| 1 | 06:46 | current release of a ggml-based Whisper C++ runtime | github.com releases page of that runtime | 0 |
| 2 | 06:46 | package name in the macOS Homebrew index (dash spelling) | formulae.brew.sh formula page - 404 | 0 |
| 3 | 06:46 | feature list, CPU-only support, CLI name, VAD section of that runtime | its README (raw) | 0 |
| 4 | 06:46 | package name in the Homebrew index (dot spelling) | formulae.brew.sh JSON API - 200 | 0 |
| 5 | 06:46 | build flags, bottles, installed binaries of that package | homebrew-core Formula file (raw) | 0 |
| 6 | 06:46 | command-line flags of the native CLI | `examples/cli/cli.cpp` (raw) | 0 |
| 7 | 06:46 | model format, sizes, checksums, conversion scripts | `models/README.md` (raw) | 0 |
| 8 | 06:47 | dependency and licence of the underlying tensor library | formulae.brew.sh JSON API for that library | 0 |
| 9 | 06:47 | imports and output location of the two conversion scripts | both scripts (raw) | 0 |
| 10 | 06:47 | whether a pre-converted model of this class is published, with sizes and checksums | Hugging Face tree API of the official ggml collection | 0 |
| 11 | 06:48 | licence tag of the source weight checkpoints | Hugging Face model API for three repos | 0 |
| 12 | 06:49 | install path, CPU behaviour, quantization options of the alternative runtime | its README plus CTranslate2 quantization and conversion docs | 0 |
| 13 | 06:49 | version, licence, dependency list of two Python packages | PyPI JSON API | 0 |
| 14 | 06:50 | CPU performance guidance and thread limits of the alternative engine | CTranslate2 performance and installation docs | 0 |
| 15 | 06:50 | converter script name and prerequisites | CTranslate2 Transformers guide | 0 |
| 16 | 06:51 | whether pre-converted builds of this model class exist | Hugging Face model search API (three generic queries) | 0 |
| 17 | 06:51 | file sizes of those pre-converted builds | Hugging Face tree API for two repos | 0 |
| 18 | 06:52 | licence, size, ONNX usage, CPU cost of the VAD model | VAD project README and LICENSE (raw), contents API of its model directory | 0 |
| 19 | 06:53 | diarization support, model families, CPU and architecture support | sherpa-onnx diarization docs and README (raw) | 0 |
| 20 | 06:53 | diarization model asset names and sizes | GitHub releases API, two tags | 0 |
| 21 | 06:53 | licence of the diarization code and of the embedding family project | two LICENSE files / repository API | 0 |
| 22 | 06:54 | whether the diarization weights are gated and what licence they carry | Hugging Face model API for three repos plus an anonymous raw-file probe (returned 401) | 0 |
| 23 | 06:54 | install footprint of the diarization runtime | PyPI JSON API for two packages | 0 |
| 24 | 06:55 | published accuracy of this model class for Indonesian | arXiv API (three generic queries) plus one HTML full text | 0 |
| 25 | 06:55 | architecture and quality claim of the pruned tier | Hugging Face raw model cards for two checkpoints | 0 |
| 26 | 06:56 | long-form chunking strategies and recommended chunk length | same model card (Chunked Long-Form section) | 0 |
| 27 | 06:56 | how the runtimes are driven on growing audio | streaming example section of the ggml README; VAD and transcribe sources of the Python layer (raw) | 0 |
| 28 | 06:57 | documented streaming policy and practical chunk sizes | Whisper-Streaming README (raw) | 0 |
| 29 | 06:57 | whether a safetensors checkpoint of this class can be fed to the ggml converter | GitHub issue search API plus one issue thread and its comments | 0 |
| 30 | 06:58 | known conversion failure modes for this model class | GitHub issues API for two identifiers found in step 29 | 0 |
| 31 | 06:58 | wheel download sizes of the conversion toolchain | PyPI JSON API for six packages | 0 |
| 32 | 06:58 | existence of a CPU-only wheel index for the tensor library | the tensor library's CPU wheel index listing | 0 |
| 33 | 06:46 | (failed attempt) general web search for Indonesian accuracy figures | DuckDuckGo HTML endpoint - connection failed, nothing was transmitted beyond the aborted TCP attempt | 0 |
| 34 | 07:00 | local re-read of already fetched public files for quoting | local temp copies of the fetched public documents | 0 |

Red-line self-check: 34 external accesses, 0 containing a project name, repository path, repository
file name, internal identifier, decision ID, device identifier or any repository content.

---

## Collection log

| Time | Action | Details |
|---|---|---|
| 06:41 | Read | `identification/02_structured.md` row 4 and Gate Questions (OD-20, OD-24, Q-INSTALL) |
| 06:42 | Read | `report/report.md` section 3 (approved defaults) and section 7 (host state) |
| 06:42 | Read | `identification/01_translated.md` External Research Scope; `decisions/decisions.md` D1-D6 |
| 06:43 | Checked | `research/` folder empty - no prior `04_collection_stt.md` to merge with |
| 06:46-06:58 | Collected | 34 external lookups per the query log above |
| 07:02 | Wrote | this file |
| 07:05 | Wrote | `delegation_progress/data-collector-local__row4.md` |

---

*Generated: 2026-10-07 07:05*
*Last Updated: 2026-10-07 07:05*
*Row 4, class A, milestone M0, tier 2. Facts only - the runtime pick memo is row 15, the transcript spec is row 33.*
