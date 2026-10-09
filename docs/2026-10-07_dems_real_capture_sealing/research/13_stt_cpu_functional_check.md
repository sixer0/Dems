---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 109
depends_on: [107, 108]
milestone: M1 (B re-open) — CPU-STT addendum
date: 2026-10-09
agent: coder-execution
tier: 2
status: complete
runs: 4 serialised (sealed fixture x2, AU-2 independent fixture x2), all exit 0
command_form: whisper-cli -m <ggml.bin> -ng -t 8 -l id -oj -of <out> -f <fixture.wav>
outputs: /Users/gsp-budi/Documents/DEMS/.cache/stt/checks/ (git-ignored)
language_evidence: params.language = "id", result.language = "id" in all four JSONs
gpu_evidence: "-ng" in every command; every run log shows "use gpu    = 0" and "whisper_backend_init_gpu: no GPU found"; zero case-insensitive "metal" hits in all four logs
d230: no speed-related figure computed, quoted, or reproduced in this artifact (see section 8)
omlx_touches: 0 (server never started; DOWN before and after)
homebrew_changes: 0
new_tracked_git_files: 0
host_load_at_run: load avg 4.38/4.75/3.89 then 3.00/4.32/3.77 on 10 cores (24 GiB host)
last_updated: 2026-10-09 03:05 (+07:00)
---

# Row 109 — CPU-only functional STT check with the row-107 `whisper-cli` and the row-108 ggml model

Blueprint row 109 `[M1|B re-open]`, depends on rows 107 (CPU-only build) and 108 (ggml model).
Closes the R-5 AC-1 / C-N1 CPU clause and the CPU clause of gate-04 STT-5. Functional only —
this row is deliberately not a benchmark (D230).

**Verdict: PASS.** Four serialised runs, all exit 0. Both fixtures produce non-empty JSON with
per-segment timestamps, language `id`, at least one segment per scripted sentence, and every run
log proves the CPU path (`use gpu = 0`, `no GPU found`, no Metal backend line anywhere).

## 1. Host state and solo discipline (standing invariant: check `uptime` first)

```
$ uptime                                   # immediately before setup
 2:50  up 14:29, 1 user, load averages: 4.38 4.75 3.89
$ uptime                                   # at runner launch
 2:50  up 14:30, 1 user, load averages: 3.00 4.32 3.77
$ sysctl -n hw.physicalcpu hw.logicalcpu hw.memsize hw.model
10
10
25769803776
Mac17,3                                    # Apple Silicon, 4P+6E = 10 physical cores, 24 GiB
```

SOLO check before launching: `ps aux` grep over `vitest|jest|node .*test|npm (run|exec)|cmake|xcodebuild|gradle|pytest|whisper|ffmpeg`
found **no test/build job in flight** — only idle DEMS dev-server watchers (`npm run start:server`,
`npm run dev`, `tsx watch`) at 0.0% CPU and IDE helpers. No oMLX process existed (section 9). The four
transcriptions were then run strictly one at a time (serialised script, one process alive at any moment).

## 2. Inputs (all pre-existing artefacts of rows 107/108/12/AU-2; verified, never modified)

| Input | Path | Verification |
|---|---|---|
| Binary (row 107) | `/Users/gsp-budi/Documents/DEMS/.cache/stt/whisper.cpp/build/bin/whisper-cli` | exists, 2,544,616 B; row-107 `otool -L` shows only `libSystem.B.dylib` + `libc++.1.dylib` (no Metal framework, no `/opt/homebrew` lib) |
| Model (row 108) | `/Users/gsp-budi/Documents/DEMS/.cache/stt/models/ggml-large-v3-turbo.bin` | re-hashed after the runs: `shasum -a 256 -c .cache/stt/ggml_expected.sha256` -> `.cache/stt/models/ggml-large-v3-turbo.bin: OK` (sha256 `1fc70f77…e8e2bc69`) |
| Fixture (a) sealed two-voice Indonesian (row 12) | `/Users/gsp-budi/Documents/DEMS/.cache/spikes/stt-check/fixture-two-speaker-id.wav` | `shasum -a 256` -> `6743181a7d976ca24c03ad8e427d6d7093fbb0b9f72257e6e2f91dcfc0f4fe71` (matches the sealed value); ffprobe `pcm_s16le 24000 Hz mono duration=65.720000 size=3154638`; **13 scripted sentences** (`fixture-script.txt` A1..A7/B1..B6) |
| Fixture (b) AU-2 independent (audit 21 §4.3) | `/Users/gsp-budi/Documents/DEMS/.cache/spikes/au2/stt/au2_two_voice_id.wav` | `shasum -a 256` -> `1944fd74e04a86bb63168254cce91ee1c4f03f78dfe32bfe16a2f99f1514a388` (matches `1944fd74…1514a388`); ffprobe `pcm_s16le 16000 Hz mono duration=28.032063 size=897104`; **6 scripted sentences** (`script.tsv`) |

## 3. Command form (quoted verbatim, per the row brief and `masterplan/07_transcript_spec.md` §B.3)

Canonical form required by the row:

```
<whisper-cli> -m <ggml.bin> -ng -t <n> -l id -oj -of <out> -f <fixture.wav>
```

Executed (run 1 shown in full; runs 2-4 differ only in `-of` and `-f`):

```
/Users/gsp-budi/Documents/DEMS/.cache/stt/whisper.cpp/build/bin/whisper-cli \
  -m /Users/gsp-budi/Documents/DEMS/.cache/stt/models/ggml-large-v3-turbo.bin \
  -ng -t 8 -l id -oj \
  -of /Users/gsp-budi/Documents/DEMS/.cache/stt/checks/run1_sealed_fixture \
  -f /Users/gsp-budi/Documents/DEMS/.cache/spikes/stt-check/fixture-two-speaker-id.wav
```

- `-ng` (GPU/Metal disabled) is present in all four commands; `use gpu = 0` in every run log confirms it took effect (section 7).
- `-t 8`: sane thread count for the 4P+6E / 10-core host — 8 worker threads leave 2 cores for the OS and the idle dev-server watchers; the run log confirms `n_threads = 8 / 10`.
- `-l id`: fixed language (tx §B.3, F-13); `-oj -of`: JSON export to `.cache/stt/checks/` (git-ignored).
- Anti-hang: every invocation ran bounded with stdin closed — `</dev/null` plus `perl -e 'alarm shift @ARGV; exec @ARGV' 1800 …` (the alarm timer survives `exec`, so the bound kills the whisper-cli process itself at 1800 s). GNU `timeout`/`gtimeout` are **not installed** on this host and installing them via Homebrew is forbidden (AU2-02), so this is the equivalent bound; all four runs finished well inside it with `EXIT=0`.
- Runner script kept at `.cache/stt/checks/run_row109.sh`; per-run logs `run{1,2}_sealed_fixture.log`, `run{3,4}_au2_fixture.log`; exit codes in `.cache/stt/checks/exit_codes.txt`:

```
run1_sealed_fixture EXIT=0
run2_sealed_fixture EXIT=0
run3_au2_fixture EXIT=0
run4_au2_fixture EXIT=0
```

No wall-clock duration was measured or recorded anywhere by this row (D230).

## 4. Raw output — sealed fixture, run 1 (`run1_sealed_fixture.log` + `.json`)

Key init lines (verbatim):

```
whisper_init_from_file_with_params_no_state: loading model from '/Users/gsp-budi/Documents/DEMS/.cache/stt/models/ggml-large-v3-turbo.bin'
whisper_init_with_params_no_state: use gpu    = 0
...
whisper_model_load: type          = 5 (large v3)
whisper_model_load:          CPU total size =  1623.92 MB
whisper_backend_init_gpu: no GPU found
...
system_info: n_threads = 8 / 10 | WHISPER : VITISAI = 0 | COREML = 0 | OPENVINO = 0 | CPU : NEON = 1 | ARM_FMA = 1 | FP16_VA = 1 | MATMUL_INT8 = 1 | DOTPROD = 1 | SME = 1 | SME2 = 1 | REPACK = 1 |
main: processing '/Users/gsp-budi/Documents/DEMS/.cache/spikes/stt-check/fixture-two-speaker-id.wav' (1051520 samples, 65.7 sec), 8 threads, 1 processors, 5 beams + best of 5, lang = id, task = transcribe, timestamps = 1 ...
```

JSON segments (`jq -r '.transcription[] | "\(.timestamps.from)-\(.timestamps.to)| \(.text)"'`, 14 segments):

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

Every segment carries `offsets` + `timestamps` + `text` (`jq '.transcription[0] | keys'` ->
`["offsets","text","timestamps"]`; e.g. `{"offsets":{"from":0,"to":4240},"timestamps":{"from":"00:00:00,000","to":"00:00:04,240"}}`).
Language fields: `jq -c '{language: .params.language, detect: .params.detect_language}'` ->
`{"language":"id","detect":null}` and `jq -c '.result'` -> `{"language":"id"}`.

## 5. Raw output — sealed fixture, run 2 (repeat run)

Run 2 JSON is **byte-identical** to run 1:

```
$ cmp -s run1_sealed_fixture.json run2_sealed_fixture.json && echo "sealed run1==run2 byte-identical"
sealed run1==run2 byte-identical
```

The full log diff between the two runs shows the ONLY differences are the output-file path line and
the engine's own native timing footer (deliberately not reproduced here, section 8):

```
$ diff run1_sealed_fixture.log run2_sealed_fixture.log
56c56
< output_json: saving output to '.../run1_sealed_fixture.json'
---
> output_json: saving output to '.../run2_sealed_fixture.json'
58c58 ... whisper_print_timings lines ...
```

The transcript body (all 14 segment lines) is identical between the runs — same content as quoted in
section 4, including the same drift word in the A5 line.

## 6. Raw output — AU-2 independent fixture, runs 3 and 4

Key init lines from `run3_au2_fixture.log` (verbatim):

```
read_audio_data: reading audio data from '/Users/gsp-budi/Documents/DEMS/.cache/spikes/au2/stt/au2_two_voice_id.wav' ...
system_info: n_threads = 8 / 10 | WHISPER : VITISAI = 0 | COREML = 0 | OPENVINO = 0 | CPU : NEON = 1 | ARM_FMA = 1 | FP16_VA = 1 | MATMUL_INT8 = 1 | DOTPROD = 1 | SME = 1 | SME2 = 1 | REPACK = 1 |
main: processing '/Users/gsp-budi/Documents/DEMS/.cache/spikes/au2/stt/au2_two_voice_id.wav' (448513 samples, 28.0 sec), 8 threads, 1 processors, 5 beams + best of 5, lang = id, task = transcribe, timestamps = 1 ...
whisper_init_with_params_no_state: use gpu    = 0        (log line 2)
whisper_backend_init_gpu: no GPU found                    (log line 26)
```

JSON segments (6 segments, identical in both runs):

```
00:00:00,000-00:00:04,700|  Selamat siang. Kita mulai pemeriksaan saksi pada hari ini.
00:00:05,600-00:00:08,380|  Baik, saya siap memberikan keterangan.
00:00:09,380-00:00:12,380|  Di mana Anda berada pada malam kejadian itu?
00:00:13,320-00:00:16,420|  Saya berada di rumah bersama keluarga saya.
00:00:17,360-00:00:21,300|  Apakah ada orang lain yang dapat memastikan hal tersebut?
00:00:22,220-00:00:27,100|  Ya, tetangga saya melihat saya pulang sekitar pukul 8 malam.
```

Determinism: `cmp -s run3_au2_fixture.json run4_au2_fixture.json` -> **byte-identical**; the run3-vs-run4
log diff is again only the output-path line plus the engine's native timing footer. Language fields:
`.params.language = "id"`, `.result.language = "id"` in both runs.

## 7. Per-sentence mapping (>= 1 segment per scripted sentence)

Sealed fixture (13 scripted sentences, `research/10` §2.2) vs the 14 segments (identical in runs 1-2):

| # | Scripted sentence | Segment(s) | Coverage |
|---|---|---|---|
| A1 | Selamat pagi, terima kasih sudah hadir pada wawancara hari ini. | 0 | yes |
| B1 | Selamat pagi, terima kasih atas undangannya. | 1 | yes |
| A2 | Sebelum kita mulai, tolong jelaskan peran Anda di gudang. | 2 | yes |
| B2 | Saya bekerja sebagai operator penerimaan barang dan memeriksa jumlah setiap kiriman. | 3 | yes |
| A3 | Berapa lama proses penerimaan biasanya berlangsung? | 4 | yes |
| B3 | Umumnya sekitar satu jam, tergantung padatnya kiriman. | 5 | yes |
| A4 | Apa harapan Anda terhadap sistem yang baru? | 6 | yes |
| B4 | Saya berharap pencatatan lebih cepat dan setiap bukti penerimaan tersimpan rapi. | 7 | yes |
| A5 | Sekarang saya ingin mendengar kendala teknis yang Anda alami sehari-hari. | 8 | yes (word drift, prose note below) |
| B5 | Kadang jaringan di gudang lambat, sehingga pemindaian harus diulang beberapa kali. | 9 | yes |
| A6 | Apakah ada saran perbaikan dari sisi pengguna? | 10 | yes |
| B6 | Sebaiknya perangkat pemindai diganti secara berkala dan pelatihan singkat diadakan rutin. | 11 | yes |
| A7 | Baik, wawancara kita tutup dengan rekaman ini, terima kasih atas kerja samanya. | 12 + 13 | yes (split into two segments) |

AU-2 fixture (6 scripted sentences, `script.tsv`) vs the 6 segments (identical in runs 3-4):

| # | Scripted sentence | Segment | Coverage |
|---|---|---|---|
| 1 | Selamat siang. Kita mulai pemeriksaan saksi pada hari ini. | 0 | yes |
| 2 | Baik, saya siap memberikan keterangan. | 1 | yes |
| 3 | Di mana Anda berada pada malam kejadian itu? | 2 | yes |
| 4 | Saya berada di rumah bersama keluarga saya. | 3 | yes |
| 5 | Apakah ada orang lain yang dapat memastikan hal tersebut? | 4 | yes |
| 6 | Ya, tetangga saya melihat saya pulang sekitar pukul delapan malam. | 5 | yes ("delapan" written as the digit "8" — the same numeral-normalisation behaviour AU-2 §4.3 recorded on the oMLX engine) |

Honest prose notes (no metrics): the CPU engine reproduces the turn-taking order exactly; the known
hard sentence A5 again drifts (`Anda alami` heard as `yanza alami` — same error class row 12 §5.1
documented for the GPU engine, different surface form); punctuation drifts as expected (commas to
periods, `kerja samanya` glued to `kerjasamanya`). Unlike the row-12 oMLX run, **no phantom tail
segment** appeared here: the last segment ends at `00:01:05,540`, inside the 65.72 s of audio.

## 8. No-GPU proof and D230 compliance

`-ng` visible in the quoted commands: section 3 (all four carry `-ng`).

Run-log evidence (identical pattern in all four logs):

```
whisper_init_with_params_no_state: use gpu    = 0
whisper_backend_init_gpu: no GPU found
system_info: n_threads = 8 / 10 | WHISPER : VITISAI = 0 | COREML = 0 | OPENVINO = 0 | CPU : NEON = 1 | ARM_FMA = 1 | FP16_VA = 1 | MATMUL_INT8 = 1 | DOTPROD = 1 | SME = 1 | SME2 = 1 | REPACK = 1 |
```

Metal absence, counted per log:

```
$ grep -ci metal run1_sealed_fixture.log run2_sealed_fixture.log run3_au2_fixture.log run4_au2_fixture.log
run1_sealed_fixture.log:0
run2_sealed_fixture.log:0
run3_au2_fixture.log:0
run4_au2_fixture.log:0
```

Consistent with the row-107 build evidence: `GGML_METAL=OFF` in the cmake cache, `otool -L` lists no
Metal framework, and the binary links only the two system dylibs. The single device enumerated is the
CPU (`devices = 1`, `whisper_backend_init_gpu: no GPU found`).

**D230 — functional only, never a benchmark.** This row computes, quotes, and reproduces **no**
throughput, real-time-factor, or word-error-rate figure anywhere in this artifact; no wall-clock time
was even measured by the runner. Disclosure: whisper.cpp's CLI natively prints its own internal
`whisper_print_timings` block (raw millisecond counters) at the end of stderr; those engine-native
lines exist only in the git-ignored raw logs under `.cache/stt/checks/` and are deliberately NOT
reproduced in this document. No division by audio length, no rate, and no accuracy score is derived
from them anywhere. Grep proof over this artifact (run after writing, quoted in section 10):

```
grep -nE "(RTF|WER|ms[- ]per[- ]token|real-time factor|words per minute|throughput)[^a-zA-Z]*[0-9]" research/13_stt_cpu_functional_check.md   -> 0 matches
```

## 9. Red-line proofs

- **oMLX untouched**: `pgrep -fl "omlx serve"` -> empty (exit 1); `lsof -nP -iTCP:8000 -sTCP:LISTEN` -> empty (exit 1). Server was DOWN before the runs (solo check) and remains DOWN; never started, stopped, or upgraded. No oMLX material printed.
- **Read-only `~/.omlx/models/**`**: this row never read or wrote that tree (the ggml model is the row-108 download under `.cache/stt/models/`); its sha256 re-verified OK after the runs (section 2).
- **Outputs under `.cache/` only**: all JSON/log/script files live in `.cache/stt/checks/`; `git check-ignore -v .cache/stt/checks/` -> `.gitignore:47:.cache/`.
- **0 new tracked git files**: nothing staged; `git status --porcelain` gains exactly the two untracked doc paths written by this row (artifact + progress file), matching the practice of rows 107/108. No commit, no push, no remote touched.
- **Homebrew untouched**: no brew command run in this session (nothing needed installing).
- **No sudo**; docs English; no emoji.

## 10. Verification table (row 109 Verification column)

| Check | Result | Evidence |
|---|---|---|
| 2 runs per fixture: non-empty JSON | **PASS** | 4 files, 3,717 B (sealed x2) / 1,901 B (AU-2 x2); valid JSON, all exit 0 |
| Timestamps present | **PASS** | every segment carries `timestamps.from/to` (+ `offsets`) — sections 4/6 |
| >= 1 segment per scripted sentence | **PASS** | sealed 13/13 sentences covered by 14 segments; AU-2 6/6 by 6 segments — section 7 |
| Detected language `id` | **PASS** | `.params.language = "id"`, `.result.language = "id"`, `detect_language` null (forced via `-l id`) — sections 4/6 |
| Quoted command shows `-ng` | **PASS** | section 3 (canonical + executed form) |
| GPU/Metal off proven (build evidence + run log) | **PASS** | section 8 — `use gpu = 0`, `no GPU found`, `grep -ci metal` = 0 on all four logs, row-107 `otool -L` consistency |
| No throughput figure anywhere | **PASS** | section 8 disclosure + grep proof below |
| Host load noted | **PASS** | section 1 |
| Runs repeatable | **PASS (bonus)** | per-fixture JSONs byte-identical across the two runs (`cmp`) — sections 5/6 |

Post-write grep proof (executed against this saved file):

```
$ grep -nE "(RTF|WER|ms[- ]per[- ]token|real-time factor|words per minute|throughput)[^a-zA-Z]*[0-9]" research/13_stt_cpu_functional_check.md ; echo EXIT=$?
EXIT=1     # 0 matching lines
```

## 11. Files + cleanup

Raw evidence (git-ignored): `.cache/stt/checks/` — `run_row109.sh`, `exit_codes.txt`,
`run{1,2}_sealed_fixture.{json,log}`, `run{3,4}_au2_fixture.{json,log}`.

Cleanup command:

```
rm -rf /Users/gsp-budi/Documents/DEMS/.cache/stt/checks
```

Handover: row 110 (verifier +1) can re-run the exact section-3 command on either fixture and reuse the
byte-identity assertions from sections 5/6. The M6 `cpu-local` adapter (§B.3/B.4) now has its
functional precedent on this Mac; the shipped-Core x86 run remains class C.

---
*Generated: 2026-10-09 03:05 (+07:00)*
