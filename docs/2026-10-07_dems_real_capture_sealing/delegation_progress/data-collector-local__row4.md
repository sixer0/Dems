---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 4
agent: data-collector-local
agent_type: data-collector
tier: 2
date: 2026-10-07
status: COMPLETE
artifact: research/04_collection_stt.md
external_queries: 34
project_identifiers_sent_externally: 0
last_updated: 2026-10-07 07:05
---

# Row 4 progress - STT / diarization / VAD stack facts

## Status

COMPLETE. Artifact written to `research/04_collection_stt.md` (354 lines, 105 fact rows F-01..F-138
in nine groups, every row carrying an explicit URL citation - verified: 105/105 rows contain a URL),
plus the conversion-toolchain table, licence table, download list, blocker list, gap list and query log.
No design decision taken; no repository file other than the two permitted outputs was touched.

## Acceptance criteria of row 4 (Verification column)

| Check | Result | Evidence |
|---|---|---|
| Every fact cites a URL | PASS | `Citation` column populated on all 68 fact rows |
| Conversion toolchain listed per runtime with package names plus download size | PASS | section "Conversion toolchain per runtime", rows F-50..F-63 |
| Licence named per component | PASS | section "Licence table", 18 components |
| Query log with 0 project identifiers | PASS | 34 logged lookups, all neutral; one aborted search-engine attempt recorded |

## Recommended-by-evidence install and conversion path per runtime

Facts only; the pick itself is row 15 / OD-24 territory. Both paths are documented end to end.

| Runtime | Install path (evidence) | Conversion path (evidence) | Source stays read-only | Python at run time |
|---|---|---|---|---|
| whisper.cpp (ggml) | Homebrew formula `whisper.cpp` v1.9.5, MIT, bottles for arm64 macOS and x86_64/arm64 Linux, installs `whisper-cli`, `whisper-vad-speech-segments`, `whisper-quantize`; deps ggml + llama.cpp + sdl2-compat (F-01..F-07) | `models/convert-h5-to-ggml.py <hf_dir> <whisper_src_dir> <out_dir>` with `torch`, `numpy`, `transformers`; writes one `ggml-model.bin` into `out_dir`. Documented alternative that needs no conversion at all: official pre-converted MIT ggml turbo, sha256 published (F-50..F-56, F-70..F-72) | Yes - reads config/vocab/weights, writes only to the out dir (F-54) | No - native CLI and shared library (F-08) |
| CTranslate2 / faster-whisper | pip venv: `faster-whisper` 1.2.1 (MIT) pulling `ctranslate2` 4.8.2, `onnxruntime`, `av`, `tokenizers`, `huggingface-hub`, `tqdm`; no torch at run time (F-30..F-33) | `ct2-transformers-converter --model <hf_dir> --output_dir <out> --copy_files tokenizer.json preprocessor_config.json --quantization float16\|int8`, prerequisite `pip install transformers [torch]` (F-57..F-60). Pre-converted community turbo exists (MIT, about 145k downloads, no published checksum) (F-75, F-77) | Yes - output is a separate directory (F-59) | Yes - faster-whisper is a Python package (F-31) |

Conversion-toolchain download size: about 145 MB of wheels on Apple Silicon (torch 127.3 MB +
transformers 12.6 + tokenizers 3.4 + safetensors 0.5 + hub 0.8); on x86 Linux the default torch wheel
is 554.6 MB unless the CPU-only index is used (F-61, F-62).

## Does conversion need Python packages, and which

Yes for both runtimes, and only for the conversion step:

- ggml path: `torch`, `numpy`, `transformers` (the script imports all three), plus a copy of the
  OpenAI `whisper` source tree for `whisper/assets/mel_filters.npz` (F-52, F-53).
- CT2 path: `ctranslate2`, `transformers>=4.23.0`, `torch` (documented as
  `pip install transformers [torch]`) (F-58).
- Neither runtime needs torch at run time; whisper.cpp needs no Python at all at run time (F-31, F-32).

This confirms blueprint assumption (3) / CF-5 / RK-13: conversion does need Python packages, so the
Q-INSTALL item 2 venv under `.cache/` is required unless the pre-converted download is chosen instead.

## Diarization / VAD models that must be downloaded

| Purpose | Model | Size | Token or accepted terms needed |
|---|---|---|---|
| VAD (whisper.cpp native) | `ggml-silero-v6.2.0.bin` from `ggml-org/whisper-vad` | 864 KB | No (MIT) |
| VAD (ONNX path) | `silero_vad_16k_op15.onnx` / `silero_vad.onnx` | 1.29 MB / 2.33 MB | No (MIT) |
| Diarization, licence-clean | `sherpa-onnx-reverb-diarization-v1.tar.bz2` + one embedding ONNX (CAM++ en 29.6 MB or NeMo speakernet 23.4 MB) | 10.9 MB + 23-30 MB | No (Apache-2.0 family) |
| Diarization, pyannote-quality | `sherpa-onnx-pyannote-segmentation-3-0.tar.bz2` (7 MB) or `pyannote/segmentation-3.0` direct | 7 MB | Direct HF download yes (gated); sherpa release copy no token but family terms apply |
| Punctuation | none needed - Whisper emits punctuation | 0 | No |
| Forced aligner | optional `-dtw` model only for word-level timestamps | not sized | No |
| STT weights | already on disk | 0 | No |

## Licence blockers found

1. LB-1 blocking: `pyannote/speaker-diarization-3.1` and `pyannote/segmentation-3.0` are `gated: auto`
   on Hugging Face - a named account, acceptance of the user conditions and an access token are needed;
   anonymous raw download returns HTTP 401. Accepting model terms is a human action. This is the answer
   to the OD-20 "after the row-4 licence check" condition.
2. LB-3 medium: sherpa-onnx is Apache-2.0 but its diarization release assets carry no per-asset licence
   files; effective terms come from the upstream families and must be recorded per asset in DOC-05.
3. LB-2 low: `pyannote/wespeaker-voxceleb-resnet34-LM` is CC-BY-4.0 (attribution), not MIT.
4. LB-4 cosmetic: the Silero README badge still reads "CC BY-NC 4.0" while the LICENSE file is MIT -
   cite the LICENSE file.
5. LB-5 none on the decided path: whisper.cpp (MIT) + turbo ggml weights (MIT) + Silero VAD (MIT) +
   sherpa-onnx diarization (Apache-2.0 family) is licence-clean, needs no token and no accepted terms.

## Gaps reported to the controller

- G-1 no published Indonesian WER for large-v3 / large-v3-turbo was reachable from this host (search
  engines unreachable; arXiv and Hugging Face were). Only `whisper-small` Indonesian figures are
  citable (WER 30.87 off-the-shelf, 14.85 fine-tuned). Row 33 must define its functional criterion
  without a WER number; the number belongs to class C-7.
- G-2 no official document states that `convert-h5-to-ggml.py` converts a stock turbo checkpoint
  end to end; the turbo tier is officially offered as a pre-converted download. Row 11 measures it.
- G-3 no published RAM figure for large-v3-turbo in either runtime.
- G-4 no public source quantifies dropped-audio risk when a CPU Whisper runtime shares cores with a
  real-time capture process; only thread-cap rules exist (`-t`/`-p`; `inter_threads * intra_threads`
  at or below physical cores). Must be proven by the M6 "no dropped fragment" check.
- G-5 no dedicated 2-speaker diarization checkpoint exists; speaker-count limiting is a clustering
  setting, accuracy on two similar voices is unpublished.
- G-6 installed (unpacked) venv size not collected - wheel download sizes only; row 10 logs it.

## Red-line compliance

No project name, repository path, repository file name, internal identifier, decision ID or repository
content was sent to any external service. All 34 lookups used neutral wording. No benchmark numbers were
produced on this host. No file outside the two permitted outputs was created or modified.

## Handoff to dependent rows

| Consumer | What this row gives it |
|---|---|
| Row 10 (install) | Formula name and version, what the bottle builds and installs, dependency set, uninstall-relevant facts, VAD model download command, per-item sizes |
| Row 11 (conversion) | Exact script names, argument shapes, required packages plus the extra `mel_filters.npz` input, read-only safety of the source folder, output artefact shape, published checksums to compare against, and the pre-converted fallback |
| Row 12 (functional check) | The CPU-disable flag (`-ng`), thread flags (`-t`, `-p`), language flag (`-l`), JSON output flags (`-oj`, `-ojf`, `-of`) and the correction that `-otype` does not exist in `whisper-cli` |
| Row 33 (transcript spec) | VAD chunking knobs and defaults, chunk-size guidance (30 s window, VAD caps, 0.5 s/5 s stream example, buffer trimming), continuity/state controls, model-size configurability table, diarization options with gating, licence table for DOC-05 |
| Row 15 (memo) | The only public head-to-head CPU comparison found (faster-whisper's own README, i7-12700K, small tier) with its self-reported caveat |
| Rows 28/35/36 | Licence blockers LB-1..LB-5 and gaps G-1..G-7 as inputs |

---
*Generated: 2026-10-07 07:05*
*Last Updated: 2026-10-07 07:05*
