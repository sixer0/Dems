---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 108
agent: coder-execution-local
milestone: M1 (B re-open) — CPU-STT addendum
date: 2026-10-08
status: complete
outcome: converter-incompatible (F-55/F-56/RK-27) -> controller-approved OD-20 official pre-converted ggml download; sha256+size verified; whisper-cli loads it
output_artifact: research/09_spike_stt_model_conversion.md
output_model: /Users/gsp-budi/Documents/DEMS/.cache/stt/models/ggml-large-v3-turbo.bin
depends_on: [107]
last_updated: 2026-10-08 09:26 (+07:00)
---

# Row 108 — coder-execution-local progress

## Stage 1 — conversion attempt (FAILED as anticipated)
1. Hashed every file in `~/.omlx/models/whisper-large-v3-turbo/` BEFORE (45 files). Read-only.
2. Inspected row-107 tree `models/` → used `convert-h5-to-ggml.py` (only HF-dir converter in v1.9.5;
   no safetensors-specific converter shipped — F-55). Used unmodified.
3. Created isolated venv `.cache/stt/venv-convert/` (python3.11): torch-2.14.1, numpy-2.4.6,
   transformers-5.19.0, openai-whisper-20250625 (+ safetensors-0.8.0); mel_filters.npz from the
   installed openai-whisper package dir (F-53).
4. Ran the conversion against the read-only source into `.cache/stt/models/`.
5. **Conversion FAILED** at `WhisperForConditionalGeneration.from_pretrained()` — 46 UNEXPECTED /
   48 MISSING / 3 MISMATCH then `RuntimeError`. Root cause: the on-disk `model.safetensors` (586
   keys) is already in **whisper.cpp ggml-native naming** (`encoder.blocks.N.mlp1`, `attn.query`,
   `ln_post`, `decoder.token_embedding.weight`, transposed convs `[1280,3,128]`) — an oMLX/MLX
   export, NOT a HuggingFace Transformers checkpoint. This is the F-55/F-56 / G-2 / RK-27 failure
   family (layout incompatibility), not host RAM and not the custom-vocab variant (vocab stock, 51866).
6. Stopped per instruction #6 / RK-27. No silent switch. Returned needs-review.

## Stage 2 — controller ruling ACCEPTED, sanctioned fallback APPROVED (OD-20 / Q-INSTALL item 2)
Controller confirmed the finding and approved the blueprint's own documented fallback: download the
official pre-converted ggml model. Explicitly instructed NOT to hand-write a repacker. Executed:

7. Downloaded `ggerganov/whisper.cpp` → `ggml-large-v3-turbo.bin` (MIT, F-70/F-71) into
   `.cache/stt/models/ggml-large-v3-turbo.bin` (curl resumable/retried; `CURL_EXIT=0`).
8. **Verified size + sha256 against F-71:**
   ```
   $ stat -f "%z bytes" .../ggml-large-v3-turbo.bin
   1624555275 bytes
   $ shasum -a 256 .../ggml-large-v3-turbo.bin
   1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69  .../ggml-large-v3-turbo.bin
   $ shasum -a 256 -c .cache/stt/ggml_expected.sha256
   .cache/stt/models/ggml-large-v3-turbo.bin: OK
   ```
   Expected F-71 = 1,624,555,275 B / `1fc70f77…e8e2bc69` — **both MATCH**.
9. **Load proof (row-107 binary, no transcription):** passed an existing-but-empty `.wav` so
   `whisper_init_from_file_with_params` (cli.cpp:1091) fully loads the model before the empty-audio
   decode fails harmlessly. Output shows `whisper_model_load: loading model`, `type=5 (large v3)`,
   `n_vocab=51866`, `n_audio_layer=32`, `n_text_layer=4`, `n_mels=128`, `ftype=1`, backend
   `no GPU found` (CPU), all compute buffers allocated, **load time = 892.72 ms**; sole error is the
   intentional empty-audio read (exit 11). Probe file removed. Full transcription NOT run (row 109).
10. Re-hashed the source model AFTER the download: **all 45 files byte-identical** (untouched).

## Verification summary
- Source read-only: 45/45 identical before/after conversion AND after download.
- Output: `/Users/gsp-budi/Documents/DEMS/.cache/stt/models/ggml-large-v3-turbo.bin`, 1,624,555,275 B,
  sha256 `1fc70f77…e8e2bc69` (matches F-71).
- Load: whisper-cli v1.9.5 loads it on CPU, no load error (raw in `.cache/stt/load_proof.txt`).
- Venvs only under `.cache/`: yes. `git status --porcelain`: 0 new tracked files; `.cache` → 0 entries.
- Host load at run: load avg 6.77/5.53/4.96; PhysMem 23G used / ~390M unused; swap 8.99G/10.24G.

## Constraints honoured
No Homebrew change; no sudo; no credential; `~/.omlx/models/**` untouched (read-only proven twice);
all outputs/venv under `.cache/`; nothing added to git; no repacker hand-written; one public MIT
download under OD-20.

## Uninstall
```
rm -rf .cache/stt/models .cache/stt/venv-convert
```

## Handoff to row 109
`cpu-local` ggml model is present, integrity-pinned, and load-proven. Row 109 can run the functional
STT check against `/Users/gsp-budi/Documents/DEMS/.cache/stt/models/ggml-large-v3-turbo.bin`.
