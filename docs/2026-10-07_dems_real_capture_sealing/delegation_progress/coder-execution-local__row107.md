---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 107
agent: coder-execution
agent_type: coder-execution-local
tier: 3
milestone: M1 (B re-open)
date: 2026-10-08
status: COMPLETE
artifact: initialization/04_whisper_cpp_cpu_build.md
external_queries: 1 (GitHub pinned release tarball)
installs_performed: 1 (PyPI cmake 4.4.4 into .cache/stt/venv-build/)
homebrew_changes: 0
last_updated: 2026-10-08 09:12
---

# Row 107 progress - whisper.cpp v1.9.5 CPU-only source build (route a)

## Status

COMPLETE. Route (a) executed exactly per blueprint row 107 + D24 (Q-D7 = a,
Q-STT-ROUTE = a). Deliverable `initialization/04_whisper_cpp_cpu_build.md` written
(Tier 3) with the full recipe and raw verification outputs. RK-26 did not trigger —
the PyPI-cmake + Xcode-clang build succeeded on the first attempt; no Homebrew
fallback was touched.

**Binary:** `/Users/gsp-budi/Documents/DEMS/.cache/stt/whisper.cpp/build/bin/whisper-cli`
(version string `whisper.cpp version: 1.9.5-dev`, Mach-O arm64, 2,544,616 bytes).

## What was done

1. BEFORE host state saved: uptime/load 6.10, PhysMem 275M unused of 24 GiB,
   `brew list --formula --versions` (66 formulas, SHA-256 `a3fcd57f...`) ->
   `.cache/stt/host_state_before.txt`, `.cache/stt/brew_list_before.txt`.
2. Pinned release source v1.9.5 (research/04 F-01) fetched via curl from the GitHub
   tag tarball (SHA-256 `ff1a9053...`) into empty `.cache/stt/whisper.cpp/` only.
3. Isolated venv `.cache/stt/venv-build/` created with python3.11 (3.11.16); PyPI
   `cmake==4.4.4` installed into it; venv bin prepended to PATH. Compiler: Apple clang
   21.0.0 (Xcode CLT), GNU Make 3.81. No system install of any kind.
4. Configured Release with `-DBUILD_SHARED_LIBS=OFF -DGGML_METAL=OFF -DGGML_BLAS=OFF
   -DGGML_ACCELERATE=OFF -DWHISPER_COREML=OFF -DWHISPER_OPENVINO=OFF
   -DGGML_CUDA=OFF -DGGML_VULKAN=OFF -DGGML_HIP=OFF -DGGML_MUSA=OFF` (+ tests/server/
   SDL2 OFF). Configure log shows only the `ggml-cpu` backend variant; EXIT=0.
5. Built target `whisper-cli` with `-j 6` (load-aware cap per standing invariant);
   EXIT=0; static libs only (5x `.a`, 0x `.dylib`).
6. Recorded commands, versions, sizes (223M total under `.cache/stt/`), uninstall:
   `rm -rf /Users/gsp-budi/Documents/DEMS/.cache/stt/`.

## Verification column (raw outputs in the artifact, sections 5-7)

| Criterion | Result | Evidence |
|---|---|---|
| `cmake -LA` Metal/GPU OFF quoted | PASS | `GGML_METAL:BOOL=OFF`, `GGML_BLAS:BOOL=OFF`, `GGML_ACCELERATE:BOOL=OFF`, `WHISPER_COREML:BOOL=OFF`, `BUILD_SHARED_LIBS:BOOL=OFF`, CUDA/VULKAN/HIP/MUSA/OPENVINO all OFF |
| `otool -L whisper-cli`: no Metal, no `/opt/homebrew` | PASS | lists only `/usr/lib/libSystem.B.dylib` + `/usr/lib/libc++.1.dylib`; grep counts 0 and 0 |
| `brew list --formula --versions` identical before/after | PASS | `diff` empty, DIFF_EXIT=0, both files SHA-256 `a3fcd57fb24c...b55e5` |
| `whisper-cli --help` exit 0 | PASS | EXIT=0, usage text captured |
| Nothing outside `.cache/stt/` | PASS* | 0 project artefacts outside; disclosed footnotes: pip content-addressed HTTP cache +52M (tool-managed, purge deliberately not run - would hit other projects' entries) and auto-reaped `$TMPDIR` compiler temps |
| 0 new tracked git files | PASS | `git status --porcelain` = 8 lines, all pre-existing from parallel rows 41/43/translator; `git check-ignore` confirms `.cache/` ignored at .gitignore:47 |

## Deviations / notes for the controller

- No deviation from route (a). Flag names were verified against the pinned tree
  (`ggml/CMakeLists.txt:96-98,193,239`): on Apple hosts `GGML_METAL` and `GGML_BLAS`
  default ON and `BUILD_SHARED_LIBS` defaults ON, so explicit OFFs were mandatory -
  they are in the recorded command line and confirmed in the cache dump.
- Accelerate IS exposed by the pinned version (`GGML_ACCELERATE`) and was set OFF as
  the row requires ("wherever the pinned version exposes that flag").
- Ready for row 108 (model conversion): converter script + torch/numpy/transformers
  context is in research/04 F-50..F-56; nothing model-related was downloaded here.
