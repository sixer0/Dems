---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 110
depends_on: [109]
milestone: M1 (gate addendum) — CPU-STT addendum
date: 2026-10-09
agent: verifier-local
tier: 2
verdict: STT-5 CPU clause CLOSED
runs: 2 serialised +1 runs on the sealed fixture (functional re-run + DYLD runtime probe), both exit 0
command_form: whisper-cli -m <ggml.bin> -ng -t 8 -l id -oj -of <out> -f <fixture.wav>
outputs: /Users/gsp-budi/Documents/DEMS/.cache/stt/checks/ (git-ignored)
own_run_json_sha256: 6039a9447ed165b94d01cfff94ae7c4d17e034f2366e4af4c0c0d4e7cab94439
cross_agent_determinism: own JSON byte-identical to row-109 run1 and run2 (same sha256)
coverage: 13/13 scripted sentences matched to >= 1 segment (own mechanical check, not row-109's table)
gpu_evidence: own otool -L + nm + CMakeCache + compile-DB + runtime DYLD trace all CPU-only
homebrew_changes: 0 (formula list sha256 identical to the row-107 recorded state, before and after my runs)
d230: no throughput / RTF / WER figure anywhere in this artifact; none found in the row-109 artifact
omlx_touches: 0 (DOWN before and after; never started, stopped, upgraded)
new_tracked_git_files: 0
host_load_at_run: load avg 7.00/5.78/4.52 at first check, 4.60 -> 6.02 around run A, 3.37 -> 5.59 around run B, on 10 cores
last_updated: 2026-10-09 03:05 (+07:00)
---

# Row 110 — Independent +1 of the CPU-only STT check (row 109) and the build evidence (row 107)

Blueprint row 110 `[M1|gate addendum]`, depends on row 109 (DONE). Verifier +1 in the
2 + 1 depth rule (row 109 produced two runs; this row is the independent third-party run).
Nothing here is taken on trust from rows 107/108/109: every figure below is quoted from a
command executed in this session. Where this row *compares* against a row-107/108/109
artefact, it re-measures its own side of the comparison first.

**Verdict: STT-5 CPU clause CLOSED.** All three clauses confirmed:

| # | Clause | Result |
|---|---|---|
| 1 | Own CPU transcription of the sealed two-voice Indonesian fixture with the row-107 binary + row-108 model: non-empty JSON, timestamps, >= 1 segment per scripted sentence, language `id`, `-ng` in the command | **CONFIRMED** — sections 3-6 |
| 2 | Genuinely CPU-only build: no Metal framework and no `/opt/homebrew` library in `otool -L`, `use gpu = 0` / `no GPU found` in the run log, `brew list --formula --versions` unchanged vs the row-107 recorded state | **CONFIRMED — five proofs (sections 7.1-7.5), three of them new here**: live cmake cache, symbol table + compile DB, runtime `DYLD_PRINT_LIBRARIES` trace |
| 3 | No throughput / RTF / WER figure in the row-109 artefact (D230) | **CONFIRMED** — section 9 |

Failure routing: none. No discrepancy was found between row 107/108/109 claims and the
measured state; nothing is routed back.

---

## 1. Host state and solo discipline (standing invariant: check `uptime` first)

```
$ uptime                                   # first action of this row
 2:54  up 14:34, 1 user, load averages: 7.00 5.78 4.52
$ sysctl -n hw.ncpu hw.memsize
10
25769803776
```

Load 7.0 on 10 cores is above the idle line, so it was attributed before launching anything.
`top -l 1` at that moment reported `CPU usage: 15.13% user, 11.51% sys, 73.35% idle` and the
busiest processes were all sleeping at 0.0% CPU (`seserviced`, `managedcorespotlight`,
`postgres`, ExtensibleSSO agent) — the load average is carrying background/IO debt, not an
active test or build. Direct confirmation:

```
$ ps aux | grep -E "vitest|jest|node .*test|npm (run|exec)|cmake|xcodebuild|gradle|pytest|whisper|ffmpeg" | grep -v grep
```

The only hits were the *idle* DEMS dev-server watchers (`npm run start:server` x3 on ports
4421-4423, `npm run dev`, `npm run dev:mobile`, `npm run dev --port 5176-5178`,
`npm exec tsx watch apps/api/src/index.ts`, the puppeteer MCP helper) — every one at
`0.0` %CPU, plus this shell's own grep command line. **No jest/vitest/cmake/xcodebuild/gradle/
pytest/whisper/ffmpeg job was in flight.** This row is a single-process run; the two runs
below were executed strictly one at a time, and no other heavy row is running against this host.

```
$ uptime                                   # immediately before run A launch
 2:55  up 14:34, 1 user, load averages: 4.60 5.33 4.41
$ uptime                                   # immediately after run A finished
 2:55  up 14:35, 1 user, load averages: 6.02 5.60 4.53
$ uptime                                   # immediately before run B (DYLD probe) launch
 2:56  up 14:35, 1 user, load averages: 3.37 4.94 4.35
$ uptime                                   # after run B finished
 2:57  up 14:36, 1 user, load averages: 5.59 5.33 4.50
```

Per D230 no duration was measured by the runner; the `uptime` lines above are minute-resolution
host snapshots taken as the standing-invariant record, not as elapsed time.

## 2. Inputs — re-verified by this row, never modified

| Input | Path | This row's own verification |
|---|---|---|
| Binary (row 107) | `/Users/gsp-budi/Documents/DEMS/.cache/stt/whisper.cpp/build/bin/whisper-cli` | exists, 2,544,616 B, `Mach-O 64-bit executable arm64`; `shasum -a 256` -> `2429de4293e9fa7bcc54b9b4e303e96ee3fb8a2327872a54da2bdb474086a3db`; mtime `Oct 8 09:06:26 2026` = still the row-107 build artefact, unmodified since; `--version` -> `whisper.cpp version: 1.9.5-dev`, `VERSION_EXIT=0` |
| Model (row 108) | `/Users/gsp-budi/Documents/DEMS/.cache/stt/models/ggml-large-v3-turbo.bin` | `shasum -a 256 -c .cache/stt/ggml_expected.sha256` -> `.cache/stt/models/ggml-large-v3-turbo.bin: OK` (expected `1fc70f774d38eb16…e8e2bc69`) — checked **before and again after** my runs |
| Fixture (sealed, row 12) | `/Users/gsp-budi/Documents/DEMS/.cache/spikes/stt-check/fixture-two-speaker-id.wav` | `shasum -a 256` -> `6743181a7d976ca24c03ad8e427d6d7093fbb0b9f72257e6e2f91dcfc0f4fe71` = the sealed value in `identification/02_structured.md` row 109 (`6743181a…c0f4fe71`); ffprobe `pcm_s16le 24000 Hz mono, duration=65.720000, size=3154638`; `fixture-script.txt` = **13 scripted sentences** A1..A7 / B1..B6 |
| Row-109 outputs (comparison target only) | `.cache/stt/checks/run{1,2}_sealed_fixture.json` | read-only, used only for the byte-identity comparison in section 6 |

The AU-2 independent fixture (`1944fd74…1514a388`) was **not** re-run: the row-110 brief scopes
the +1 to "once on the sealed two-voice Indonesian fixture", and the sealed fixture is the one
carrying the D222/R-5 AC-1 clause. Row 109 already ran AU-2 twice; that stays covered.

## 3. Command (clause 1: `-ng` present, output under `.cache/stt/checks/`)

Row script kept at `.cache/stt/checks/run_row110.sh`; the executed command, expanded:

```
/Users/gsp-budi/Documents/DEMS/.cache/stt/whisper.cpp/build/bin/whisper-cli \
  -m /Users/gsp-budi/Documents/DEMS/.cache/stt/models/ggml-large-v3-turbo.bin \
  -ng -t 8 -l id -oj \
  -of /Users/gsp-budi/Documents/DEMS/.cache/stt/checks/row110_sealed_fixture \
  -f /Users/gsp-budi/Documents/DEMS/.cache/spikes/stt-check/fixture-two-speaker-id.wav
```

Matches the canonical form required by the row brief and `masterplan/07_transcript_spec.md`
§B.3: `-m <bin> -ng -t <n> -l id -oj`. `-ng` (GPU/Metal disabled) is present; `-t 8` on the
4P+6E / 10-core host; `-l id` fixed language; `-oj -of` JSON export under `.cache/`.

Anti-hang, as instructed (`timeout … </dev/null`): GNU `timeout`/`gtimeout` are **not installed**
here and a Homebrew install is forbidden by AU2-02, so the equivalent bound is a `perl` alarm
that survives `exec` and therefore kills `whisper-cli` itself at 1800 s, with stdin closed:

```
$ which timeout gtimeout 2>&1
timeout not found
gtimeout not found
$ perl -e 'alarm shift @ARGV; exec @ARGV' 1800 "$W" -m "$M" -ng -t 8 -l id -oj -of "$O/$name" -f "$F_SEALED" </dev/null > "$O/$name.log" 2>&1
```

Exit codes recorded in `.cache/stt/checks/exit_codes_row110.txt`:

```
row110_sealed_fixture EXIT=0
row110_dyld_probe EXIT=0
```

Both runs (section 7.5's DYLD probe is the second) exited 0 well inside the bound.

## 4. My own run output — non-empty JSON with timestamps and language `id`

```
$ ls -la .cache/stt/checks/row110_sealed_fixture.*
-rw-r--r--@ 1 gsp-budi  staff  3717 Oct  9 02:55 row110_sealed_fixture.json
-rw-r--r--@ 1 gsp-budi  staff  4285 Oct  9 02:55 row110_sealed_fixture.log

$ jq -e '.transcription | length' row110_sealed_fixture.json
14

$ jq -c '{params_lang: .params.language, detect: .params.detect_language, result: .result}' row110_sealed_fixture.json
{"params_lang":"id","detect":null,"result":{"language":"id"}}

$ jq '.transcription[0] | keys' row110_sealed_fixture.json
[
  "offsets",
  "text",
  "timestamps"
]
```

Non-empty (3,717 B, 14 segments), every segment carries `timestamps.from/to` and `offsets`,
language is `id` in both `params` and `result` (`detect_language` null because `-l id` forces it).

Segments from my own run (`jq -r '.transcription[] | "\(.timestamps.from)-\(.timestamps.to)| \(.text)"'`):

```
00:00:00,000-00:00:04,240|  Selamat pagi. Terima kasih sudah hadir pada wawancara hari ini.
00:00:04,960-00:00:07,840|  Selamat pagi. Terima kasih atas undangannya.
00:00:08,520-00:00:12,380|  Sebelum kita mulai, tolong jelaskan peran Anda di gudang.
00:00:13,080-00:00:18,720|  Saya bekerja sebagai operator penerimaan barang dan memeriksa jumlah setiap kiriman.
00:00:19,740-00:00:23,060|  Berapa lama proses penerimaan biasanya berlangsung?
00:00:23,620-00:00:27,360|  Umumnya sekitar satu jam, tergantung padatnya kiriman.
00:00:27,360-00:00:30,740|  Apa harapan Anda terhadap sistem yang baru?
00:00:31,400-00:00:37,080|  Saya berharap pencatatan lebih cepat dan setiap bukti penerimaan tersimpan rapi.
00:00:37,880-00:00:42,680|  Sekarang saya ingin mendengar kendala teknis yang yanza alami sehari-hari.
00:00:43,260-00:00:48,720|  Kadang jaringan di gudang lambat, sehingga pemindaian harus diulang beberapa kali.
00:00:49,980-00:00:52,640|  Apakah ada saran perbaikan dari sisi pengguna?
00:00:52,900-00:00:59,520|  Sebaiknya perangkat pemindai diganti secara berkala dan pelatihan singkat diadakan rutin.
00:01:00,200-00:01:03,400|  Baik. Wawancara kita tutup dengan rekaman ini.
00:01:03,740-00:01:05,540|  Terima kasih atas kerjasamanya.
```

## 5. Per-sentence coverage (>= 1 segment per scripted sentence) — my own mechanical check

Rather than reuse row 109's mapping table, this row wrote its own checker
(`.cache/stt/checks/coverage_row110.py`): normalises `fixture-script.txt` and the JSON segment
texts, walks them in turn order, and requires `difflib` similarity >= 0.60 per scripted sentence.

```
$ python3 .cache/stt/checks/coverage_row110.py </dev/null
scripted sentences: 13   segments: 14
params.language='id'  result.language='id'

A1 (A) -> segment 0   sim=1.00  COVERED
B1 (B) -> segment 1   sim=1.00  COVERED
A2 (A) -> segment 2   sim=1.00  COVERED
B2 (B) -> segment 3   sim=1.00  COVERED
A3 (A) -> segment 4   sim=1.00  COVERED
B3 (B) -> segment 5   sim=1.00  COVERED
A4 (A) -> segment 6   sim=1.00  COVERED
B4 (B) -> segment 7   sim=1.00  COVERED
A5 (A) -> segment 8   sim=0.98  COVERED      # heard "...kendala teknis yang yanza alami..." (word drift)
B5 (B) -> segment 9   sim=1.00  COVERED
A6 (A) -> segment 10  sim=1.00  COVERED
B6 (B) -> segment 11  sim=1.00  COVERED
A7 (A) -> segment 12  sim=0.73  COVERED      # remainder carried by segment 13

COVERAGE: 13/13 scripted sentences have >= 1 matching segment
segments used: [0,1,2,3,4,5,6,7,8,9,10,11,12]  of 14 (A7 expected to span 2 segments)
all segments carry timestamps: True; all carry offsets: True
last segment ends at 00:01:05,540
PY_EXIT=0
```

Speaker A and B turns alternate in the correct order throughout. The one content imperfection is
the same hard sentence the GPU run also mishandled (`Anda alami` heard as `yanza alami`,
sim 0.98) — a recognised defect class, recorded as prose, **not** scored (D230 forbids WER here).
`A7` splits into two segments (0.73 on the first half plus segment 13 carrying
"Terima kasih atas kerjasamanya") which is a segmentation boundary, not a missing sentence.
No phantom tail segment: the last segment ends inside the 65.72 s of audio.

**Semantics of the `sim` column (do not misread it).** Each value is a `difflib` string-similarity
ratio between one scripted sentence and its best candidate segment, used purely as a *match
threshold* (`>= 0.60`) to prove that a sentence is represented somewhere in the output. It is not a
transcription-quality metric: it is computed on normalised strings with punctuation removed, is
word-order sensitive but not word-aligned, covers only 13 of 14 segments (segment 13 is the tail of
the A7 split), and **must not be averaged or quoted as accuracy or WER**. No aggregate figure over
these values appears anywhere in this artefact.

## 6. Cross-agent determinism (the strongest single result of this row)

My JSON, produced by a different agent, in a different session, hours after row 109:

```
$ cmp row110_sealed_fixture.json run1_sealed_fixture.json && echo "row110 == run1 BYTE-IDENTICAL"
row110 == run1 BYTE-IDENTICAL
$ cmp row110_sealed_fixture.json run2_sealed_fixture.json && echo "row110 == run2 BYTE-IDENTICAL"
row110 == run2 BYTE-IDENTICAL

$ shasum -a 256 row110_sealed_fixture.json run1_sealed_fixture.json run2_sealed_fixture.json
6039a9447ed165b94d01cfff94ae7c4d17e034f2366e4af4c0c0d4e7cab94439  row110_sealed_fixture.json
6039a9447ed165b94d01cfff94ae7c4d17e034f2366e4af4c0c0d4e7cab94439  run1_sealed_fixture.json
6039a9447ed165b94d01cfff94ae7c4d17e034f2366e4af4c0c0d4e7cab94439  run2_sealed_fixture.json
```

This converts the +1 from "it worked again" into expected-value equality across agents: the same
binary, the same model, the same fixture produce bit-identical transcripts, including the drift
word. Row 109's transcript body claim is therefore not self-consistency — it reproduces.

The raw log diff between my run and row-109 run 1 isolates exactly what differs. Hunk 1,
verbatim:

```
$ diff row110_sealed_fixture.log run1_sealed_fixture.log
56c56
< output_json: saving output to '/Users/gsp-budi/Documents/DEMS/.cache/stt/checks/row110_sealed_fixture.json'
---
> output_json: saving output to '/Users/gsp-budi/Documents/DEMS/.cache/stt/checks/run1_sealed_fixture.json'
```

The remaining hunks are reported by their exact headers — `58c58`, `60,62c60,62`,
`64,66c64,66` — and every line in them is a `whisper_print_timings:` line, i.e. the engine's own
internal millisecond counters. Per D230 their values are withheld here and stay only in the
git-ignored raw logs. Size of the whole difference:

```
$ diff row110_sealed_fixture.log run1_sealed_fixture.log | grep -c '^[<>]'
16          # 16 differing lines across those 4 hunks (8 changed pairs)
```

i.e. the output-path line and the engine's own timing footer only. Every transcript line and every
init line (`use gpu = 0`, `no GPU found`, `n_threads = 8 / 10`) is identical.

## 7. Clause 2 — the build is genuinely CPU-only (five independent proofs)

### 7.1 `otool -L` — my own run, not row 107's quote

```
$ otool -L .cache/stt/whisper.cpp/build/bin/whisper-cli
.cache/stt/whisper.cpp/build/bin/whisper-cli:
	/usr/lib/libSystem.B.dylib (compatibility version 1.0.0, current version 1359.0.0)
	/usr/lib/libc++.1.dylib (compatibility version 1.0.0, current version 2200.27.0)

$ otool -L .cache/stt/whisper.cpp/build/bin/whisper-cli | grep -ci metal
0
$ otool -L .cache/stt/whisper.cpp/build/bin/whisper-cli | grep -c /opt/homebrew
0

$ otool -l .cache/stt/whisper.cpp/build/bin/whisper-cli | grep -B1 -A3 LC_LOAD_DYLIB | grep "name "
         name /usr/lib/libSystem.B.dylib (offset 24)
         name /usr/lib/libc++.1.dylib (offset 24)
```

Two dylibs total, both `/usr/lib`; zero Metal framework, zero Homebrew linkage. Consistent with
row 107 §6.2. Static build confirmed independently: `find build -name '*.dylib' | wc -l` -> `0`.

### 7.2 My own run log — the runtime says CPU

```
$ grep -nE "use gpu|no GPU found|devices =|system_info" row110_sealed_fixture.log
2:whisper_init_with_params_no_state: use gpu    = 0
26:whisper_backend_init_gpu: no GPU found
37:system_info: n_threads = 8 / 10 | WHISPER : VITISAI = 0 | COREML = 0 | OPENVINO = 0 | CPU : NEON = 1 | ARM_FMA = 1 | FP16_VA = 1 | MATMUL_INT8 = 1 | DOTPROD = 1 | SME = 1 | SME2 = 1 | REPACK = 1 |

$ grep -ci metal row110_sealed_fixture.log
0
```

Also in the init block: `devices    = 1`, `backends   = 1`, and
`whisper_model_load:          CPU total size =  1623.92 MB` — the model is loaded into a CPU
buffer and exactly one device/backend exists.

### 7.3 The cmake cache read live from the build tree (not row 107's transcribed quote)

```
$ grep -E "^(GGML_METAL|GGML_BLAS|GGML_ACCELERATE|WHISPER_COREML|WHISPER_OPENVINO|GGML_CUDA|GGML_VULKAN|GGML_HIP|BUILD_SHARED_LIBS):" build/CMakeCache.txt
BUILD_SHARED_LIBS:BOOL=OFF
GGML_ACCELERATE:BOOL=OFF
GGML_BLAS:BOOL=OFF
GGML_CUDA:BOOL=OFF
GGML_HIP:BOOL=OFF
GGML_METAL:BOOL=OFF
GGML_VULKAN:BOOL=OFF
WHISPER_COREML:BOOL=OFF
WHISPER_OPENVINO:BOOL=OFF
```

### 7.4 Symbol table and compile definitions — Metal is not compiled in

```
$ nm build/bin/whisper-cli | grep -icE "mtl|metal"
0
$ nm -u build/bin/whisper-cli | grep -icE "MTL|Metal|_objc"
0
$ nm build/bin/whisper-cli | grep -iE "ggml_backend_(metal|cuda|vk|sycl|openvino|blas|rpc)_reg"
(no output; exit 1 — no non-CPU backend registration symbol exists in the binary)
$ nm build/bin/whisper-cli | grep -E " [Tt] _ggml_backend_[a-z_]*reg$"
00000001000c784c T _ggml_backend_cpu_reg
0000000100186194 T _ggml_backend_dev_backend_reg

$ grep -o "GGML_USE_[A-Z0-9_]*" build/compile_commands.json | sort | uniq -c
  16 GGML_USE_CPU
  16 GGML_USE_CPU_REPACK
```

Zero Metal symbols, and zero undefined Objective-C references (`_objc` count 0) — the Objective-C
runtime is not linked at all, which alone rules out Metal. The only backend registration entry
point defined is `_ggml_backend_cpu_reg`; `_ggml_backend_dev_backend_reg` is the device-to-registry
accessor, not a backend. The compile DB defines only `GGML_USE_CPU` / `GGML_USE_CPU_REPACK`. In the
source, `register_backend(ggml_backend_metal_reg())` sits inside `#ifdef GGML_USE_METAL`
(`ggml/src/ggml-backend-reg.cpp:123-125`), so it is compiled out.

### 7.5 Runtime library trace — what actually loaded (new proof, beyond rows 107/109)

`whisper-cli` does call `ggml_backend_load_all()` (`examples/cli/cli.cpp:1059`), which probes for
loadable backend dylibs by name — including the literal `"metal"`. That is why a `strings` scan of
the binary returns exactly one case-insensitive `metal` hit, and it is worth being precise about
it rather than claiming "zero hits":

```
$ strings -a build/bin/whisper-cli | grep -i metal
metal                                  <- 1 hit
$ grep -n 'ggml_backend_load_best("metal"' ggml/src/ggml-backend-reg.cpp
590:    ggml_backend_load_best("metal", silent, dir_path);
```

It is a dlopen *filename argument* (`libggml-metal.dylib`), not linked Metal code. To show that the
probe loads nothing, run B repeated the transcription with `DYLD_PRINT_LIBRARIES=1`:

```
$ env DYLD_PRINT_LIBRARIES=1 <same -ng command> ...  -> DYLD_PROBE_EXIT=0

$ grep "^dyld\[" row110_dyld_probe.log | awk '{print $NF}' | grep -v "^/usr/lib"
/Users/gsp-budi/Documents/DEMS/.cache/stt/whisper.cpp/build/bin/whisper-cli
$ grep "^dyld\[" row110_dyld_probe.log | grep -icE "metal|coreml|accelerate|iosurface|iokit|homeframework|opt/homebrew|usr/local"
0
```

All 81 images loaded at runtime are either `whisper-cli` itself or `/usr/lib/**` system
libraries. Not one Metal, CoreML, Accelerate, IOKit/IOSurface, `/opt/homebrew` or `/usr/local`
image was loaded, and the probe had nothing to find:

```
$ for d in /opt/homebrew/lib /usr/local/lib build/bin; do echo "--- $d ---"; ls "$d" | grep -i "ggml\|whisper" || echo "(no ggml/whisper entry)"; done
--- /opt/homebrew/lib ---
(no ggml/whisper entry)
--- /usr/local/lib ---
(no ggml/whisper entry)
--- build/bin ---
whisper-cli                    <- the executable only, no dylib

$ find /Users/gsp-budi/Documents/DEMS/.cache -iname 'libggml*'
.../build/ggml/src/libggml-base.a      <- static archives only
.../build/ggml/src/libggml-cpu.a
.../build/ggml/src/libggml.a
.../ggml/src/ggml-hexagon/libggml-htp.inf
                                         # no libggml-metal.dylib anywhere reachable
$ find build -iname '*metal*' | wc -l
0
$ brew list | grep -i "whisper\|ggml"
(empty)
```

`GGML_BACKEND_PATH` was unset (`env | grep -i "GGML|WHISPER|DYLD"` -> empty). The run-B log still
shows `use gpu = 0`, `devices = 1`, `backends = 1`, `no GPU found`.

Run-B transcript determinism held too; the single JSON difference is my own invocation detail —
run B passed `-m` as a relative path and the engine echoes that string back:

```
$ diff <(jq -S . row110_dyld_probe.json) <(jq -S . row110_sealed_fixture.json)
23c23
<     "model": ".cache/stt/models/ggml-large-v3-turbo.bin",
---
>     "model": "/Users/gsp-budi/Documents/DEMS/.cache/stt/models/ggml-large-v3-turbo.bin",
```

Nothing differs inside `transcription`. (Footnote, for completeness: `libRosetta.dylib` appears in
the trace. That is a dyld support library, not an indicator of translated execution — `file` reports
`Mach-O 64-bit executable arm64` and the engine's own feature line reports native ARM capabilities
`NEON = 1 | ARM_FMA = 1 | DOTPROD = 1 | SME = 1 | SME2 = 1`.)

## 8. Homebrew unchanged vs the row-107 recorded state

Row 107 recorded `brew_list_before.txt` with sha256
`a3fcd57fb24c618e0ff3b8279bc1a0c4fefac3d2e9a6e24657e871eee86b55e5` (66 formulas). Snapshot taken
by this row **before** any run:

```
$ brew list --formula --versions > .cache/stt/brew_list_row110.txt
BREW_EXIT=0
$ wc -l < .cache/stt/brew_list_row110.txt
      66
$ shasum -a 256 .cache/stt/brew_list_row110.txt .cache/stt/brew_list_before.txt
a3fcd57fb24c618e0ff3b8279bc1a0c4fefac3d2e9a6e24657e871eee86b55e5  .cache/stt/brew_list_row110.txt
a3fcd57fb24c618e0ff3b8279bc1a0c4fefac3d2e9a6e24657e871eee86b55e5  .cache/stt/brew_list_before.txt
$ diff .cache/stt/brew_list_before.txt .cache/stt/brew_list_row110.txt ; echo DIFF_EXIT=$?
DIFF_EXIT=0
```

and again **after** the runs:

```
$ brew list --formula --versions > .cache/stt/brew_list_row110_after.txt
$ diff .cache/stt/brew_list_before.txt .cache/stt/brew_list_row110_after.txt ; echo DIFF_EXIT=$?
DIFF_EXIT=0
a3fcd57fb24c618e0ff3b8279bc1a0c4fefac3d2e9a6e24657e871eee86b55e5  .cache/stt/brew_list_row110_after.txt
```

Byte-identical before and after: 66 formulas, same sha256 as the row-107 baseline (and as
row 107's own `after`/`final` snapshots). This also proves no *other* row installed anything into
Homebrew since row 107 ran. No `brew install/upgrade/unlink` was run in this session — only the
read-only `brew list` twice. `openssl@3` (the AU2-02 risk item shared with ffmpeg and omlx) is
untouched inside that identical list.

## 9. Clause 3 — D230 audit of the row-109 artefact

Re-running row 109's own claimed grep against the saved file, plus my own broader rate-pattern
grep (independent of row 109's pattern):

```
$ grep -nE "(RTF|WER|ms[- ]per[- ]token|real-time factor|words per minute|throughput)[^a-zA-Z]*[0-9]" research/13_stt_cpu_functional_check.md
EXIT=1     # 0 matches
$ grep -nE "[0-9][0-9., ]*(x|times)?[ ]*(real[- ]?time|RTF)|RTF[ :=][0-9]|WER[ :=][0-9]|[0-9][ ]*(tokens|words|chars|samples|frames|bytes)/s|[0-9][ ]*(files|hours|minutes)/[ ]*(hour|minute|second)|[0-9][ ]*fps|[0-9][ ]*x[ ](faster|slower)" research/13_stt_cpu_functional_check.md
EXIT=1     # 0 matches
$ grep -nE "whisper_print_timings.*[0-9]" research/13_stt_cpu_functional_check.md
EXIT=1     # the footer is mentioned, never reproduced with a number
```

For completeness, every time-flavoured number that *does* appear in row 109's artefact, with the
judgement on each (none is a throughput figure):

| Line | Value | Nature |
|---|---|---|
| 82 | `1800 s` | the anti-hang alarm bound (a limit, not a measurement) |
| 107, 165 | `65.7 sec`, `28.0 sec` inside the engine's `main: processing ... (N samples, X sec)` line | audio length echoed by the engine, not a rate |
| 58, 59 | `duration=65.720000`, `duration=28.032063`, `24000 Hz`, `16000 Hz` | fixture properties from ffprobe (input metadata) |
| 220 | "inside the 65.72 s of audio" | prose reference to the input length |

**D230 CONFIRMED for row 109.** The same discipline is applied to this artefact: no rate, no
elapsed time, and the engine-native `whisper_print_timings` millisecond counters stay in the
git-ignored raw logs under `.cache/stt/checks/` and are not reproduced here (section 6 shows them
redacted). Nothing in either document divides by audio length or scores accuracy.

Self-scan of this artefact with the same patterns, so the claim is not exempted from its own test:

```
$ grep -nE "(RTF|WER|ms[- ]per[- ]token|real-time factor|words per minute|throughput)[^a-zA-Z]*[0-9]" gateway_check/26_m1_cpu_stt_addendum.md | grep -vc "grep -nE"
0        # every hit of these patterns in this file is a quoted command line, never a figure
```

## 10. Red-line proofs (this row)

- **oMLX untouched**: `pgrep -fl "omlx serve"` -> empty (`PGREP_EXIT=1`); `lsof -nP -iTCP:8000 -sTCP:LISTEN` -> empty (`LSOF_EXIT=1`) — checked before and after both runs. Server DOWN throughout; never started, stopped or upgraded. No oMLX material printed.
- **`~/.omlx/models/**` read-only respected**: never read or written by this row. The ggml model used is the row-108 artefact under `.cache/stt/models/`, whose hash re-verifies `OK` after my runs.
- **Outputs under `.cache/` only**: runner, coverage script, logs, JSONs and brew snapshots all live in `.cache/stt/`. `git check-ignore -v .cache/stt/checks/row110_sealed_fixture.json` -> `.gitignore:47:.cache/`.
- **0 new tracked git files**: `git status --porcelain | wc -l` -> `277` before my writes (all pre-existing from other rows) and nothing staged; this row adds only its two untracked doc paths (artifact + progress note), the practice of rows 106/107/108/109. No commit, no push, no remote.
- **No controller trackers touched**: `status_tasks.md`, `masterplan/*`, `identification/*`, `decisions/*` are owned by the controller and were not edited (same discipline as row 106: "No masterplan, spec, plan, code or tracker file was modified"). `packages/shared`, `apps/**`, migrations, `openapi.json`, lockfiles untouched.
- **No sudo**; no `brew` write; no emulator PIN; no biometric step; docs English; no emoji.

## 11. Verification table (row 110 Verification column)

| Check | Result | Evidence (this row's own commands) |
|---|---|---|
| +1 run PASS with the quoted command | **PASS** | sections 3-4: `-ng -t 8 -l id -oj` executed, `EXIT=0`, 3,717 B valid JSON, 14 segments |
| Non-empty JSON with timestamps | **PASS** | section 4: `jq '.transcription | length'` -> 14; every segment has `timestamps` + `offsets` |
| >= 1 segment per scripted sentence | **PASS** | section 5: own checker, 13/13 sentences COVERED in turn order |
| Language `id` | **PASS** | `.params.language="id"`, `.result.language="id"`, `detect_language` null |
| `otool -L` re-checked (no Metal, no `/opt/homebrew`) | **PASS** | section 7.1: 2 system dylibs, `grep -ci metal` 0, `grep -c /opt/homebrew` 0 |
| Formula list re-checked unchanged | **PASS** | section 8: sha256 `a3fcd57f…b55e5` before and after, `DIFF_EXIT=0`, 66 formulas |
| Run log proves CPU (`use gpu = 0`, `no GPU found`) | **PASS** | section 7.2, plus `devices = 1`, `backends = 1`, zero `metal` hits in my log |
| No Metal linkage (beyond row 107) | **PASS** | sections 7.4-7.5: zero Metal/ObjC symbols, only `_ggml_backend_cpu_reg`, `GGML_USE_CPU` only, runtime trace loads 0 GPU images |
| No throughput / RTF / WER figure in row 109 (D230) | **PASS** | section 9: two greps 0 matches; all four numeric time values classified as input metadata |
| Host load noted / solo | **PASS** | section 1: `uptime` at five points; `ps` grep shows no test/build job in flight |
| Verdict "STT-5 CPU clause closed" or routed back | **CLOSED** | front matter + nothing routed to 107/108/109 |

## 12. Caveats recorded honestly

1. Coverage of the +1 is the sealed fixture only, per the row brief; AU-2's independent fixture was
   not re-run here (row 109 covered it twice, byte-identically).
2. `A5` word drift (`yanza`) and punctuation drift are accuracy defects of the CPU engine. They are
   described, not measured: a WER would violate D230. Functional proof is the scope of this clause;
   accuracy and speed belong to class C-7 on the real Core device.
3. The one `metal` string literal in the binary is a dlopen probe argument, fully explained and
   empirically inert (section 7.5) — this row chose to disclose and prove it instead of reporting a
   tidier `grep` count.
4. The `-ng` flag is belt-and-braces on this build: with `GGML_METAL=OFF` there is no GPU backend to
   disable, so `-ng` matters for the *product* contract (the adapter must keep passing it) more than
   for this binary's behaviour. Both hold.

## 13. Files left behind + cleanup

Raw evidence, all git-ignored under `.cache/stt/`:

- `checks/run_row110.sh` — the bounded, serialised runner
- `checks/coverage_row110.py` — the independent coverage checker
- `checks/row110_sealed_fixture.{json,log}` — clause-1 +1 run
- `checks/row110_dyld_probe.{json,log}` — runtime library trace
- `checks/exit_codes_row110.txt` — exit codes
- `brew_list_row110.txt`, `brew_list_row110_after.txt` — formula snapshots
- Row 107/108/109 artefacts were read, never modified (`whisper-cli` sha + mtime, model `OK`,
  sealed fixture hash all re-verified after the runs)

Cleanup command:

```
rm -f /Users/gsp-budi/Documents/DEMS/.cache/stt/checks/{run_row110.sh,coverage_row110.py,exit_codes_row110.txt,row110_sealed_fixture.*,row110_dyld_probe.*} \
      /Users/gsp-budi/Documents/DEMS/.cache/stt/brew_list_row110*.txt
```

Full STT teardown (rows 107-110 together): `rm -rf /Users/gsp-budi/Documents/DEMS/.cache/stt/`.

## 14. Handover

- **STT-5 CPU clause: CLOSED.** Gate 04's deferred clause (`04_m1_spike_gate.md:35`, "CPU clause NOT
  met — re-read as deferred to the `cpu-local` functional-check row") is now discharged on evidence:
  R-5 AC-1 / C-N1 CPU-only behaviour is proven functionally on this Mac.
- **Row 76 (`TranscriberAdapter`, `cpu-local` backend)** may invoke the row-107 binary per
  `07_transcript_spec.md` §B.3 with `-ng` retained, against the row-108 ggml model; the command form
  and the resulting document shape are validated by rows 109 + 110 (three independent runs,
  bit-identical).
- **Row 81 (`M6-TF-1` +1 on both backends)** inherits the `-ng` command quote from section 3.
- **Rows 77 / M6-DF-1** ("no dropped fragment while STT runs") must run on `cpu-local` with no other
  heavy row in flight, per the single-writer rule in `identification/02_structured.md` section 10.
- Benchmark class **C-7** stays open for the Core device: RTF, peak RAM and WER may not be computed
  here (D230).
- If `~/.omlx/logs` or oMLX state ever changes, nothing in this clause depends on it: three of the
  three proofs here are Homebrew-free and oMLX-free.

---
*Generated: 2026-10-09 03:05 (+07:00)*
