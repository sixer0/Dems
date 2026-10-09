---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 108
depends_on: [107]
milestone: M1 (B re-open) — CPU-STT addendum
date: 2026-10-08
agent: coder-execution
tier: 2
status: complete
final_route: converter-incompatible (F-55/F-56/RK-27) -> controller-approved OD-20 official pre-converted ggml download
output_model: /Users/gsp-budi/Documents/DEMS/.cache/stt/models/ggml-large-v3-turbo.bin
output_size_bytes: 1624555275
output_sha256: 1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69
load_proof: whisper-cli v1.9.5 (row-107 binary) initialised the model, type=5 large v3, ftype=1, CPU-only, load time 892.72 ms
also_satisfies: row 11 CPU-backend conversion record (the long-missing `research/09` per §5.5 / D10(d))
risk: RK-27 TRIGGERED then RESOLVED via the recorded fallback (no silent switch)
host_load_at_run: load avg 6.77/5.53/4.96; PhysMem 23G used / ~390M unused; swap 8.99G/10.24G used (24 GiB host)
external_queries: 1 (public MIT ggml download from HuggingFace ggerganov/whisper.cpp under OD-20)
installs_performed: 1 venv under .cache/stt/venv-convert (kept; not required by the fallback route)
homebrew_changes: 0
omlx_touches: 0 (source model read-only; sha256 identical before/after AND after the download)
last_updated: 2026-10-08 09:26 (+07:00)
---

# Row 108 — HF→ggml conversion of `whisper-large-v3-turbo` for `cpu-local`

Blueprint row 108 `[M1|B re-open]`, depends on row 107 (whisper.cpp v1.9.5 CPU build, DONE).
Goal: obtain a whisper.cpp ggml `.bin` of `whisper-large-v3-turbo` under `.cache/stt/models/` that
`whisper-cli` can load on the CPU backend. This file also supplies the long-missing **row-11**
CPU-backend conversion record (§5.5: "row 108 writes `research/09` for `cpu-local`").

## 0. Final verdict (read this first)

**COMPLETE via the controller-approved sanctioned fallback.** Two stages:

1. **Conversion attempt FAILED as anticipated.** The pinned-tree HF converter
   `convert-h5-to-ggml.py` cannot consume the on-disk `model.safetensors`, because that file is
   **not** a HuggingFace Transformers checkpoint — it stores tensors in **whisper.cpp ggml-native
   naming** (an oMLX/MLX export). This is exactly the pre-flagged **F-55 / F-56 / G-2 / RK-27**
   failure family. Per instruction #6 I **stopped and did NOT silently switch**, and returned
   needs-review.
2. **Controller ruling accepted the finding and APPROVED the blueprint's own documented fallback
   (OD-20 / Q-INSTALL item 2):** download the official pre-converted `ggerganov/whisper.cpp`
   `ggml-large-v3-turbo.bin`. Executed, **sha256 + size verified against F-71**, and **proven to
   load in the row-107 `whisper-cli`**. No repacker was hand-written; no source-model write; nothing
   outside `.cache/`; no Homebrew/sudo.

Loaded model absolute path:
`/Users/gsp-budi/Documents/DEMS/.cache/stt/models/ggml-large-v3-turbo.bin`

## 1. Host state at start (standing invariant: check `uptime` before CPU-heavy rows)

```
$ uptime
 9:12  up 6 days, 16:25, 2 users, load averages: 6.77 5.53 4.96
$ top -l 1 -n 0 | grep PhysMem
PhysMem: 23G used (3940M wired, 6310M compressor), 228M unused.     # 24 GiB host
$ sysctl vm.swapusage
vm.swapusage: total = 10240.00M  used = 9028.81M  free = 1211.19M
```

Memory-tight (three Android emulator `qemu` ≈ 3.8 GB RSS + IDE helpers; no oMLX session running —
server DOWN). The conversion failure was **not** an OOM: it aborted at weight-loading with a clean
Python traceback (§5), before any large allocation. Disk had ~493 GiB free for the 1.55 GiB download.

## 2. Read-only proof of the shared source model (SMART WMS oMLX asset)

Every file under `~/.omlx/models/whisper-large-v3-turbo/` hashed BEFORE the conversion attempt,
AFTER the attempt, and AGAIN after the download. 45 files total (14 model files + 31 under
`.cache/huggingface/`). Model-file hashes (BEFORE):
```
11ad7efa24975ee4b0c3c3a38ed18737f0658a5f75a0a96787b576a78a023361  ./.gitattributes
654c778494779fcf4b9bd4799ea2060cc931c516328b0408838604d5dc89bd3d  ./README.md
3c51f66c4c21f9e126970078f11ae77a78c74aee8df606ee9daba86e467108e0  ./added_tokens.json
47ef28115e4b7e08c604546cc98eb1ead8ff72152cfaeb5d7bcb7ef1640a5bdd  ./config.json
cce11bfe3aaa6ae9e072ea2637caaec8795e68d9b67e655a5af16ee509681a4c  ./generation_config.json
2df2990a395e35e8dfbc7511e08c12d56018d8d04691e0133e5d63b21e154dc6  ./merges.txt
a76ee3af9c01b616ab7caf1eed663dceb7d68e9dc62c990dac48112db6e57e34  ./model.safetensors
9cf894da1061ccc1657c6dabf1fa19dfcf1f0603df4194ab4fb913a554da789d  ./model.safetensors.index.json
bf1c507dc8724ca9cf9903640dacfb69dae2f00edee4f21ceba106a7392f26dd  ./normalizer.json
7ccc62c6f2765af1f3b46c00c9b5894426835a05021c8b9c01eecb6dfb542711  ./preprocessor_config.json
baea4ea09372eb4fca86b4e4346139fd73cb807d5087e9de0948e971739c3e74  ./special_tokens_map.json
297b13372ac43916285644fb9687add3cc62ee2a1adb60da3dc25cc94c1871fd  ./tokenizer.json
844b642c73a91359722f47b35705f7174686df33d252695d8572cf9ac03a6389  ./tokenizer_config.json
e2aa043ef015641d363d8288e7c241c85e36a5c761fb303598e0710233344387  ./vocab.json
```

Diff AFTER the conversion attempt and AGAIN after the download (both empty):
```
$ diff .cache/stt/source_sha_before_full.txt .cache/stt/source_sha_after_full.txt      # after conversion
IDENTICAL: all 45 source files unchanged (read-only proven)
$ diff .cache/stt/source_sha_before_full.txt .cache/stt/source_sha_after_final.txt     # after download
SOURCE UNTOUCHED: all 45 files byte-identical
```
Nothing under `~/.omlx/models/**` was created, modified, moved, or deleted at any point.

## 3. Converter selection (instruction #2)

Inspected `.cache/stt/whisper.cpp/models/` (row-107 v1.9.5 tree). For an HF model directory the
blueprint names **`convert-h5-to-ggml.py`** (F-50); it is the **only** HF-directory converter in
this tree (`convert-pt-to-ggml.py` needs an OpenAI `.pt`; there is **no** safetensors-specific
converter shipped — F-55 confirms the community `convert-safetensors-to-ggml.py` is *not* in the
official repo). Used unmodified. Invocation shape (F-51):
```
python convert-h5-to-ggml.py <dir_model> <path_to_openai_whisper_source> <dir_out> [use_f32]
```
It requires `<dir_whisper>/whisper/assets/mel_filters.npz` (F-53), supplied by the pip-installed
`openai-whisper` package dir (`site-packages/whisper/assets/mel_filters.npz`, 4271 bytes).

## 4. Isolated venv (instruction #3, F-50..F-54)

Venv ONLY under `.cache/`:
```
$ python3.11 -m venv .cache/stt/venv-convert          # /opt/homebrew/bin/python3.11, 3.11.16
$ .cache/stt/venv-convert/bin/pip install --no-input torch numpy transformers openai-whisper
Successfully installed ... numpy-2.4.6 openai-whisper-20250625 safetensors-0.8.0 \
    torch-2.14.1 transformers-5.19.0 ...
$ # import smoke test: torch 2.14.1 numpy 2.4.6 transformers 5.19.0 ; WhisperForConditionalGeneration OK
```

## 5. Conversion attempt — raw failure evidence (root cause of the fallback)

Command (as-provided converter, read-only source; full log `.cache/stt/convert_run.log`, 19,358 B):
```
$ OMP_NUM_THREADS=6 .cache/stt/venv-convert/bin/python \
    .cache/stt/whisper.cpp/models/convert-h5-to-ggml.py \
    "$HOME/.omlx/models/whisper-large-v3-turbo" \
    ".cache/stt/venv-convert/lib/python3.11/site-packages" ".cache/stt/models"
```
`from_pretrained` could not map the checkpoint: **46 UNEXPECTED / 48 MISSING / 3 MISMATCH**, then:
```
[transformers] WhisperForConditionalGeneration LOAD REPORT from: /Users/gsp-budi/.omlx/models/whisper-large-v3-turbo
encoder.blocks.{0...31}.mlp1.weight       | UNEXPECTED |
decoder.token_embedding.weight            | UNEXPECTED |
encoder.ln_post.weight                    | UNEXPECTED |
model.encoder.layers.{0...31}.fc1.weight  | MISSING    |
model.decoder.embed_tokens.weight         | MISSING    |
proj_out.weight                           | MISSING    |
model.encoder.conv1.weight | MISMATCH | ckpt torch.Size([1280, 3, 128]) vs model torch.Size([1280, 128, 3])
model.encoder.conv2.weight | MISMATCH | ckpt torch.Size([1280, 3, 1280]) vs model torch.Size([1280, 1280, 3])
Traceback (most recent call last):
  File ".../models/convert-h5-to-ggml.py", line 97, in <module>
    model = WhisperForConditionalGeneration.from_pretrained(dir_model)
RuntimeError: You set `ignore_mismatched_sizes` to `False`, thus raising an error.
```

**Root cause.** The on-disk `model.safetensors` (586 keys, verified read-only from
`model.safetensors.index.json`) uses **whisper.cpp ggml-native tensor names**:
`encoder.blocks.N.{attn.query,attn.key,attn.value,attn.out,attn_ln,mlp1,mlp2,mlp_ln}`,
`decoder.blocks.N.{attn.*,cross_attn.*,…}`, `decoder.token_embedding.weight`,
`decoder.positional_embedding`, `encoder.ln_post.*`, with conv kernels transposed relative to HF
(`[1280,3,128]` vs HF `[1280,128,3]`). These are exactly the names the converter *emits* as ggml
output — i.e. the file is an **oMLX/MLX export already in whisper.cpp's own variable scheme**, not a
HuggingFace Transformers checkpoint. `WhisperForConditionalGeneration.from_pretrained()` expects
`model.encoder.layers.N.self_attn.q_proj` / `fc1` / `fc2` and cannot map it. Matches **G-2** and the
**F-55/F-56** failure family. It is a layout/format incompatibility, independent of host RAM. The
vocabulary is stock (`vocab_size 51866`), so this is *not* the custom-vocab "Headers too large"
variant of F-56.

Per instruction #6 / RK-27 I stopped here (needs-review). Controller approved the fallback below.

## 6. Approved fallback executed — official pre-converted ggml download (OD-20)

Source: HuggingFace `ggerganov/whisper.cpp` (MIT, F-70), file `ggml-large-v3-turbo.bin` (F-71).
Download into git-ignored `.cache/stt/models/` (resumable, retried; log
`.cache/stt/download_progress.log`):
```
$ curl -fL -C - --retry 3 --retry-delay 2 \
    -o .cache/stt/models/ggml-large-v3-turbo.bin \
    https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin
# HEAD probe: HTTP/2 302 -> CDN, x-linked-size: 1624555275, content-length: 1624555275
# progress log ends: 100 1549M ... CURL_EXIT=0
```

### Size + sha256 verification (against F-71)
```
$ stat -f "%z bytes  %N" .cache/stt/models/ggml-large-v3-turbo.bin
1624555275 bytes  .cache/stt/models/ggml-large-v3-turbo.bin

$ shasum -a 256 .cache/stt/models/ggml-large-v3-turbo.bin
1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69  .cache/stt/models/ggml-large-v3-turbo.bin

$ shasum -a 256 -c .cache/stt/ggml_expected.sha256
.cache/stt/models/ggml-large-v3-turbo.bin: OK
```
Expected (F-71): size **1,624,555,275 B**, sha256 **`1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69`**.
Both MATCH exactly. (No corrupt file; hash-check passed before any use.)

## 7. Load proof — `whisper-cli` accepts the model (row-107 binary, no transcription)

Row 107 binary: `/Users/gsp-budi/Documents/DEMS/.cache/stt/whisper.cpp/build/bin/whisper-cli`.
To prove a genuine model-init without running a transcription, an existing-but-empty `.wav` was
passed: `parse_args` records the input, `whisper_init_from_file_with_params` (cli.cpp:1091) fully
loads the ggml and prints its metadata, and only then does the empty-audio decode fail harmlessly.
Raw output (`.cache/stt/load_proof.txt`):
```
whisper_init_from_file_with_params_no_state: loading model from '.cache/stt/models/ggml-large-v3-turbo.bin'
whisper_model_load: loading model
whisper_model_load: n_vocab       = 51866
whisper_model_load: n_audio_ctx   = 1500
whisper_model_load: n_audio_state = 1280
whisper_model_load: n_audio_head  = 20
whisper_model_load: n_audio_layer = 32
whisper_model_load: n_text_ctx    = 448
whisper_model_load: n_text_state  = 1280
whisper_model_load: n_text_head   = 20
whisper_model_load: n_text_layer  = 4
whisper_model_load: n_mels        = 128
whisper_model_load: ftype         = 1
whisper_model_load: type          = 5 (large v3)
whisper_model_load: adding 1609 extra tokens
whisper_model_load: n_langs       = 100
whisper_model_load:          CPU total size =  1623.92 MB
whisper_backend_init_gpu: device 0: CPU (type: 0)
whisper_backend_init_gpu: no GPU found
whisper_init_state: compute buffer (decode) =   99.12 MB
read_audio_data: trying to decode with miniaudio
error: failed to read audio file '.cache/stt/empty_probe.wav'      <-- intentional (empty probe), AFTER load
whisper_print_timings:     load time =   892.72 ms
error: 1 input file(s) failed                                        <-- exit 11 = audio only, model loaded fine
```
The parsed metadata matches the turbo config (`n_audio_layer=32`, `n_text_layer=4`,
`n_audio_state=1280`, `n_mels=128`, `n_vocab=51866`), `ftype=1` (f16), `type=5 (large v3)`, and the
backend is **CPU** (`no GPU found`) — consistent with the row-107 CPU-only build. The model loaded
in 892.72 ms with no load error; the sole failure is the deliberate empty-audio read. The probe file
was removed afterwards. **Full transcription is deliberately NOT run here — that is row 109.**

## 8. Verification table (row 108 Verification column)

| Check | Result | Evidence |
|---|---|---|
| sha256 of every source file identical before/after (read-only) | **PASS** | §2 — 45/45 identical, twice (after conversion + after download) |
| output size + sha256 recorded | **PASS** | §6 — 1,624,555,275 B; sha256 `1fc70f77…e8e2bc69`; `shasum -c` OK |
| `whisper-cli -m <bin>` loads it | **PASS** | §7 — full metadata, CPU backend, load time 892.72 ms, no load error |
| venvs only under `.cache/` | **PASS** | `.cache/stt/venv-convert/` only |
| nothing added to git; `.cache/` ignored | **PASS** | `git status --porcelain`: 0 new tracked files; `.cache` → 0 entries |
| uninstall command recorded | **PASS** | §9 |
| host load noted | **PASS** | §1 |
| no silent switch on failure (RK-27) | **PASS** | stopped at failure → controller-approved OD-20 fallback, verified |

## 9. Uninstall / cleanup command

```
rm -rf .cache/stt/models .cache/stt/venv-convert
```
Removes the downloaded ggml model and the conversion venv. Everything lives under `.cache/stt/`;
nothing else on the host was installed or changed.

## 10. Reproduction / audit pointers

- Downloaded model: `/Users/gsp-budi/Documents/DEMS/.cache/stt/models/ggml-large-v3-turbo.bin`
- Raw evidence under `.cache/stt/`: `convert_run.log` (conversion failure), `download_progress.log`,
  `ggml_expected.sha256`, `load_proof.txt`, `source_sha_before_full.txt`,
  `source_sha_after_full.txt`, `source_sha_after_final.txt`
- Converter used: `.cache/stt/whisper.cpp/models/convert-h5-to-ggml.py` (unmodified)
- Facts: `research/04_collection_stt.md` F-50..F-56, F-70/F-71/F-77, G-2; risk RK-27; gate OD-20.

---
*Generated: 2026-10-08 09:26 (+07:00)*
