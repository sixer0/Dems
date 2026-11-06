---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 107
milestone: M1 (B re-open)
date: 2026-10-08
agent: coder-execution
tier: 3
status: complete
gate: D24 — Q-D7 = a, Q-STT-ROUTE = a (route (a) in force)
source_plan: docs/2026-10-07_dems_real_capture_sealing/masterplan/02_plan.md
external_queries: 1 (GitHub release tarball download, pinned public source only)
installs_performed: 1 (PyPI cmake into an isolated venv under .cache/stt/)
homebrew_changes: 0 (proven byte-identical brew list)
last_updated: 2026-10-08 09:10 (+07:00)
---

# Row 107 — whisper.cpp v1.9.5 CPU-only source build under `.cache/stt/` (route a)

Blueprint row 107 `[M1|B re-open]`, gate answers D24 (Q-D7 = a, Q-STT-ROUTE = a).
Built the pinned whisper.cpp **v1.9.5** (research/04 F-01) from release source with the
Xcode command-line clang toolchain and a PyPI cmake inside an isolated venv — **zero
Homebrew change, zero sudo, everything under `.cache/stt/`**. RK-26 (build fails ->
re-ask route) did not trigger: the build succeeded on the first attempt.

**Result: `whisper-cli` 1.9.5-dev, Mach-O arm64, linked against exactly two system
dylibs (`libSystem.B.dylib`, `libc++.1.dylib`) — no Metal framework, no `/opt/homebrew`
library.**

- Binary absolute path: `/Users/gsp-budi/Documents/DEMS/.cache/stt/whisper.cpp/build/bin/whisper-cli`
- All raw evidence files live beside this doc's evidence trail in
  `/Users/gsp-budi/Documents/DEMS/.cache/stt/` (`host_state_before.txt`,
  `brew_list_before.txt`, `brew_list_after.txt`, `configure_log.txt`,
  `cmake_LA_flags.txt`, `build_log.txt`, `help_output.txt`, `otool_L_output.txt`).

## 1. Acceptance (row 107 Verification column)

| Check | Result | Evidence |
|---|---|---|
| `cmake -LA` quoted with Metal/GPU OFF | PASS | section 5.2 |
| `otool -L whisper-cli`: no Metal framework, no `/opt/homebrew` lib | PASS | section 6.2 |
| `brew list --formula --versions` identical before/after (diff empty) | PASS | section 2 + 7.1 |
| `whisper-cli --help` exit 0 | PASS | section 6.1 |
| Nothing written outside `.cache/stt/` | PASS with disclosed tool-cache footnote | section 8 |
| 0 new tracked git files | PASS | section 7.2 |
| Q-INSTALL item 1+2: install commands, versions, size, uninstall recorded | PASS | sections 3-5, 9 |

## 2. Host state BEFORE (also the RK-26 / AU2-02 guard)

```
$ uptime   (recorded 2026-10-08 09:05 local, saved to .cache/stt/host_state_before.txt)
 9:05  up 6 days, 16:18, 2 users, load averages: 6.10 5.43 4.65

$ top -l 1 -n 0 | grep PhysMem
PhysMem: 23G used (3925M wired, 5731M compressor), 275M unused.   # 24 GiB host (hw.memsize 25769803776)
```

Load 6.1 on 10 cores and low free RAM honoured the standing invariant "check `uptime`
before CPU-heavy rows": build parallelism was capped at `-j 6` and no jest suite was
running alongside.

```
$ brew list --formula --versions > .cache/stt/brew_list_before.txt   # 66 formulas
$ shasum -a 256 .cache/stt/brew_list_before.txt
a3fcd57fb24c618e0ff3b8279bc1a0c4fefac3d2e9a6e24657e871eee86b55e5  .cache/stt/brew_list_before.txt
```

## 3. Toolchain found (no installs, no changes)

```
$ which python3.11 && python3.11 --version
/opt/homebrew/bin/python3.11
Python 3.11.16                      # used read-only to create the venv

$ which make && make --version | head -1
/usr/bin/make
GNU Make 3.81

$ which clang && clang --version | head -2
/usr/bin/clang
Apple clang version 21.0.0 (clang-2100.3.34.2)
Target: arm64-apple-darwin27.0.0    # xcode-select -p -> /Library/Developer/CommandLineTools

$ which cmake
cmake not found                     # as expected (AU-2 §4.1): cmake NOT installed
```

## 4. Pinned source fetch (research/04 F-01: release v1.9.5)

```
$ cd /Users/gsp-budi/Documents/DEMS/.cache/stt
$ curl -sSL -o whisper.cpp-v1.9.5.tar.gz \
    https://github.com/ggml-org/whisper.cpp/archive/refs/tags/v1.9.5.tar.gz
$ shasum -a 256 whisper.cpp-v1.9.5.tar.gz
ff1a9053feb509ff9d7729703355541ae9690073a6b1c40eb692c962e0dc1720  whisper.cpp-v1.9.5.tar.gz   # 9,626,464 bytes

$ mkdir whisper.cpp && tar -xzf whisper.cpp-v1.9.5.tar.gz -C whisper.cpp --strip-components=1
```

`.cache/stt/whisper.cpp/` was empty before extraction and holds the source exclusively
(no other location). Bundled ggml reports `ggml version: 0.26.0, commit 0024068`
(matches research/04 F-20's ggml 0.26.0 reference).

## 5. Isolated cmake venv + configure (all GPU paths OFF, static)

### 5.1 Install commands (Q-INSTALL item 1+2 record)

```
$ cd /Users/gsp-budi/Documents/DEMS/.cache/stt
$ python3.11 -m venv venv-build
$ ./venv-build/bin/pip install --no-input cmake
Successfully installed cmake-4.4.4          # PyPI wheel, 54.4 MB download
$ ./venv-build/bin/cmake --version
cmake version 4.4.4
$ ./venv-build/bin/pip freeze
cmake==4.4.4                                 # the venv contains exactly one package
```

### 5.2 Configure (full log: `.cache/stt/configure_log.txt`)

```
$ export PATH="/Users/gsp-budi/Documents/DEMS/.cache/stt/venv-build/bin:$PATH"
$ cd whisper.cpp
$ cmake -B build -S . \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_SHARED_LIBS=OFF \
    -DGGML_METAL=OFF -DGGML_BLAS=OFF -DGGML_ACCELERATE=OFF \
    -DWHISPER_COREML=OFF -DWHISPER_COREML_ALLOW_FALLBACK=OFF \
    -DWHISPER_OPENVINO=OFF \
    -DGGML_CUDA=OFF -DGGML_VULKAN=OFF -DGGML_HIP=OFF -DGGML_MUSA=OFF \
    -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF -DWHISPER_SDL2=OFF
...
-- Including CPU backend
-- Adding CPU backend variant ggml-cpu: -U__ARM_FEATURE_SVE;-mcpu=native+dotprod+i8mm+nosve+sme
-- ggml version: 0.26.0
-- ggml commit:  0024068
-- Configuring done (3.8s)
-- Generating done (0.1s)
EXIT=0
```

Only a CPU backend was included — no Metal backend line appears anywhere in the log.
Flag names verified against the pinned tree itself: `GGML_METAL` defaults ON and
`GGML_BLAS` defaults ON (vendor "Apple") on Apple hosts (`ggml/CMakeLists.txt:96-98,
239`), so both were passed explicitly; `GGML_ACCELERATE` is exposed at
`ggml/CMakeLists.txt:193` (default ON) and was set OFF; `BUILD_SHARED_LIBS` defaults ON
on macOS (`CMakeLists.txt:73`) and was set OFF for static libraries.

`cmake -LA` from the generated cache (raw, `.cache/stt/cmake_LA_flags.txt`):

```
BUILD_SHARED_LIBS:BOOL=OFF
CMAKE_BUILD_TYPE:STRING=Release
CMAKE_OSX_ARCHITECTURES:STRING=
GGML_ACCELERATE:BOOL=OFF
GGML_BLAS:BOOL=OFF
GGML_CUDA:BOOL=OFF
GGML_HIP:BOOL=OFF
GGML_METAL:BOOL=OFF
GGML_MUSA:BOOL=OFF
GGML_VULKAN:BOOL=OFF
WHISPER_COREML:BOOL=OFF
WHISPER_COREML_ALLOW_FALLBACK:BOOL=OFF
WHISPER_OPENVINO:BOOL=OFF
WHISPER_SDL2:BOOL=OFF
```

## 6. Build + binary verification

### 6.1 Build (full log: `.cache/stt/build_log.txt`)

```
$ cmake --build build --config Release --target whisper-cli -j 6
...
[ 95%] Linking CXX static library libcommon.a
[100%] Linking CXX executable ../../bin/whisper-cli
[100%] Built target whisper-cli
EXIT=0
```

Static libraries produced (zero `.dylib` anywhere in the build tree):

```
build/examples/libcommon.a   build/ggml/src/libggml-base.a   build/ggml/src/libggml-cpu.a
build/ggml/src/libggml.a     build/src/libwhisper.a          (*.dylib count: 0)
```

### 6.2 Verification battery (must-be-able-to-fail checks)

```
$ ./build/bin/whisper-cli --help > ../help_output.txt 2>&1; echo EXIT=$?
EXIT=0
usage: ./build/bin/whisper-cli [options] file0 file1 ...
supported audio formats: flac, mp3, ogg, wav

$ ./build/bin/whisper-cli --version
whisper.cpp version: 1.9.5-dev            # pinned version confirmed by the binary itself

$ otool -L build/bin/whisper-cli          # raw, .cache/stt/otool_L_output.txt
build/bin/whisper-cli:
	/usr/lib/libSystem.B.dylib (compatibility version 1.0.0, current version 1359.0.0)
	/usr/lib/libc++.1.dylib (compatibility version 1.0.0, current version 2200.27.0)

$ otool -L build/bin/whisper-cli | grep -ci metal   -> 0     # no Metal framework
$ otool -L build/bin/whisper-cli | grep -c /opt/homebrew -> 0 # no Homebrew library

$ file build/bin/whisper-cli
Mach-O 64-bit executable arm64            # 2,544,616 bytes
```

## 7. Red-line proofs

### 7.1 Homebrew untouched

```
$ brew list --formula --versions > .cache/stt/brew_list_after.txt
$ diff .cache/stt/brew_list_before.txt .cache/stt/brew_list_after.txt   # (empty)
DIFF_EXIT=0
$ shasum -a 256 .cache/stt/brew_list_{before,after}.txt
a3fcd57fb24c618e0ff3b8279bc1a0c4fefac3d2e9a6e24657e871eee86b55e5  ...before.txt
a3fcd57fb24c618e0ff3b8279bc1a0c4fefac3d2e9a6e24657e871eee86b55e5  ...after.txt
```

Byte-identical (same SHA-256). No `brew install/upgrade/unlink` was ever run. RK-26's
silent-Homebrew fallback did not occur.

### 7.2 Git clean

```
$ git status --porcelain | wc -l
8        # all 8 lines pre-exist from parallel rows 41/43/translator work; none from row 107
$ git check-ignore -v .cache/stt/
.gitignore:47:.cache/	.cache/stt/
```

0 new tracked files; the whole build lives under the git-ignored `.cache/`.

## 8. Writes outside `.cache/stt/` — disclosure

No project artifact or install was placed outside `.cache/stt/` (plus this doc and the
progress file). Two tool-managed footprints are disclosed for completeness:

1. **pip HTTP download cache** (`~/Library/Caches/pip`, content-addressed): 8 files /
   52 MB added by the cmake wheel fetch. Unavoidable with default pip behaviour; not
   addressable by `pip cache remove cmake` (0 matched — the entry sits in the hashed
   http-v2 store). Left in place deliberately: `pip cache purge` would also destroy
   other projects' cache entries, which is outside this row's authority.
2. **Compiler temporaries** under `$TMPDIR` — Darwin-managed, auto-reaped.

## 9. On-disk size + uninstall (Q-INSTALL items 1+2)

```
$ du -sh .cache/stt  -> 223M total
  57M  .cache/stt/whisper.cpp          (source tree incl. build)
  14M   └─ build/                      (objects + static libs + bin)
 2.4M   └─ build/bin/                  (whisper-cli 2,544,616 B)
 156M  .cache/stt/venv-build           (PyPI cmake 4.4.4)
 9.8M  .cache/stt/whisper.cpp-v1.9.5.tar.gz
```

**Uninstall command (removes every artefact of this row):**

```
rm -rf /Users/gsp-budi/Documents/DEMS/.cache/stt/
```

## 10. Notes / handover to rows 108-110

- The runtime is ready for model conversion (F-50..F-53: `models/convert-h5-to-ggml.py`
  needs torch/numpy/transformers + the OpenAI whisper source for `mel_filters.npz`) —
  conversion belongs to row 108, not this row; nothing was downloaded for models here.
- CLI facts already pinned by research/04 apply to this binary: `-ng/--no-gpu` (F-10),
  separate `-oj/-osrt` format flags (F-12), `-l id` fixed language (F-13).
- Rebuild recipe if ever needed: sections 4-6 verbatim; the venv cmake must stay on
  PATH ahead of any future system cmake.
