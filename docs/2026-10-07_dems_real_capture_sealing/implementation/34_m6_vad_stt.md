---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: 77 (phase C, milestone M6, wave M6-W2, class B; blueprint rev 2.3)
date: 2026-10-09
agent: coder-execution (DRIVER of the row-77 pair; a navigator reviews and re-runs)
source_plan: identification/02_structured.md rev 2.3 row 77 (:329); masterplan/07_transcript_spec.md (tx) §A.1-§A.3, §C, §D; masterplan/04_database_contract.md (dbc-3) §B.7; masterplan/10_test_strategy.md M6-TF-1 (:221), M6-DF-1 (:222), M6-KR-1 (:223), M6-CP-1 (:226); decisions D70, D71, D72(d), D79, D84
narrative_tier: 3
status: needs-review — every named check ran and passed; four items need a controller or user ruling (section 10), one of them a licence finding
verification: M6-TF-1 criteria 1-4 PASS on cpu-local (2 runs) and on omlx-server (1 run); M6-KR-1 PASS (unit harness with a real SIGKILL x3 positions, and the real engine); M6-CP-1 PASS outside the sandbox, "host forbids it" shown as the skipped block; M6-DF-1 PASS, 2 runs; phantom-tail clamp check PASS on the live server answer; known-offset check PASS and red with a wrong constant
---

# Row 77 — VAD chunking, STT per chunk, checkpoints and resume (M6-W2)

No throughput, speed or duration figure is in this document, in the code or in the evidence this row stored (D230). Every "done" has a file and a line.

## 1. What exists now

| Piece | File:line | What it does |
|---|---|---|
| Media time (tx §A.2, PE-111-08, D72(d)) | `apps/transcriber/src/pipeline/media-time.ts:28` (the import), `:51`, `:59`, `:67`, `:88`, `:101` | Imports `CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES` and `CAPTURE_AUDIO_SAMPLE_RATE_HZ` from `@dems/shared/api`; `captureTapTimeline()`, `decodedFileTimeline()`, sample-to-millisecond conversion (rounded), outward snap to the frame grid of the file |
| Audio intake (tx §A.1) | `apps/transcriber/src/pipeline/audio-source.ts:79` | Reads mono 16-bit PCM from a raw tap FILE (growing) or a WAV file; no resampling; missing or malformed audio is `TRANSCRIPT_AUDIO_UNAVAILABLE` |
| VAD engine (tx §A.2) | `apps/transcriber/src/pipeline/silero-vad.ts:56`, `:88`, `:121`, `:152` | Runs whisper.cpp's `vad-speech-segments` with the Silero ggml model through `nice`; reads its output strictly; every failure is `VAD_FAILED` |
| Chunk plan (tx §A.2) | `apps/transcriber/src/pipeline/chunker.ts:51` | Speech runs joined up to 30 s, long runs cut with 100 ms overlap, fixed-window fallback, open tail while audio still grows |
| Phantom-tail clamp (tx §A.3, D-76-5) | `apps/transcriber/src/pipeline/clamp.ts:73` | Four rules (section 3.4); pure |
| Checkpoint file (tx §D.1) | `apps/transcriber/src/pipeline/checkpoint.ts:68`, `:136` | `transcript-checkpoint.json`, strict schema, atomic replace (sibling file, fsync, rename, fsync of the directory), refusal of a foreign or malformed file |
| Mirror port of `transcript_chunks` | `apps/transcriber/src/pipeline/mirror.ts:46`, `:64`, `:70`, `:91` | Three members (`insertMissing`, `update`, `read`); `toModelCode`; a stand-in that refuses what the table's CHECK constraints refuse |
| Runner (tx §A.1-§A.3, §C, §D) | `apps/transcriber/src/pipeline/runner.ts:133` (`createTranscriptRunner`), plan `:251`, decode `:302`, step `:361`, `retryFailed` `:389` | Plan (boundaries written before decode), decode one chunk at a time with `STT_CHUNK_RETRIES`, commit per chunk, resume, mirror reconciliation, `shouldPause`, the tap signal |
| Sibling priority rule (tx §C) | `apps/transcriber/src/cpu-priority.ts:57` (`engineIsBelowCaptureWorker`); `apps/transcriber/src/backends/cpu-local.ts:135` (`judgeAgainstCaptureWorker`), `:339` (refusal before an engine start) | The engine and the VAD engine never start at or above the observed priority of a capture worker |
| One engine starter | `apps/transcriber/src/backends/cpu-local.ts:254` (`runLoweredProcess`) | The only `spawn` of an engine: through `nice`, no shell, the fixed environment; now also used by the VAD engine |
| Core side: the table | `apps/core-server/src/modules/transcript-chunks/statements.ts:41`, `:44`, `:47`; `index.ts:97` (`createTranscriptChunkStore`) | Three constant statements with bind parameters; the store IS the mirror port on PostgreSQL |
| Static rules | `apps/transcriber/src/__tests__/static-rules.ts` rule `MEDIA_TIME_ORIGIN_NEVER_WRITTEN`, required `MEDIA_TIME_ORIGIN_IS_IMPORTED` | The origin is imported by name; the number is written in no production file of the workspace |

Files I took in `apps/core-server` (the brief asked me to say): a NEW folder `src/modules/transcript-chunks/` (`statements.ts`, `index.ts`, `__tests__/store.test.ts`, `__tests__/transcript-chunks.db.test.ts`), following the `modules/stt-config` statement pattern. Nothing under `src/capture/**`, `test/support/capture*`, `src/db/store/**` or `src/db/schema/**` was edited. **No migration was added**: the db test asserts schema version 2 / `dbc-3` on its throw-away clone.

## 2. Design statements the row asked for

**Which audio is chunked.** While a session records, the pipeline chunks the capture worker's **PCM tap** (48 kHz mono signed 16-bit, sample `n` at T0 + n/48000 s) and converts to media time of the sealed file by adding the shared origin: file time of tap sample `n` = `(n + CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES) / 48000` s. For the functional checks on the sealed fixture it chunks a **decoded file**, which is already in file time (origin 0). The kind is stored in every checkpoint (`audio.kind`, `originSamples`, `gridSamples`) and a checkpoint of another kind or origin is refused. Chunk offsets (`startMs`, `endMs`, `transcript_chunks.audio_from_ms/audio_to_ms`) and segment times are media time of the sealed file, whole milliseconds, rounded.

**The tap is read as a regular file, never as a pipe** (`audio-source.ts:9-13`). Pair-58 finding F-7: the worker closes a pipe tap for the session when its reader pauses; an STT run is such a pause. A file tap lets the worker append without waiting for anybody.

**The frame grid.** Tap chunk boundaries snap outwards to the AAC frame grid of the file. Under the pinned mux flags the origin is exactly one frame of priming, so the grid step is taken from the same shared constant; if the capture contract ever sets the origin to 0, `captureTapTimeline` refuses instead of inventing a step (`media-time.ts:52-54`).

**No resampling in this workspace.** A chunk is cut at the rate of its source and handed to the engine as a WAV file; both engines resample a file themselves (row 76 N-13).

**`transcript_chunks` rows are attempts.** `seq` counts rows of a session from 1. A FAILED chunk keeps its row; `retryFailed()` gives it a NEW row with the same audio range (the "FAILED -> rerun pair" of dbc-3 §G). The checkpoint FILE is the truth; the table follows and is reconciled at every write and every resume. A mirror failure is logged to the persistent log and never stops a transcript.

## 3. Verification

### 3.1 Automated suite

```
$ npm run test -w @dems/transcriber
 Test Files  15 passed (15)
      Tests  377 passed | 2 skipped (379)
```

Was 8 files / 259 passed / 1 skipped. Same totals inside and outside the sandbox; the two skips are the complementary niceness blocks. Stored verbose output (durations stripped): `.cache/stt/checks/row77/gate/transcriber_outside_sandbox_verbose.txt`.

### 3.2 M6-CP-1, run OUTSIDE the sandbox, with the block that ran

```
$ npm run test -w @dems/transcriber -- --reporter=verbose        # sandbox disabled
 ✓ cpu-priority.test.ts > M6-CP-1 … > host lowers priorities: the engine process itself observes the niceness of its parent + 10 …
 ↓ cpu-priority.test.ts > M6-CP-1 … > host forbids it (a sandbox): `required` starts NO engine; `best-effort` runs and says so in the log
 ✓ capture-priority.test.ts > M6-CP-1 sibling rule … > host lowers priorities: the STT engine and the VAD engine are observed at a higher niceness than the worker; a worker that is itself lowered further gets NO engine
 ↓ capture-priority.test.ts > M6-CP-1 sibling rule … > host forbids it (a sandbox): beside a capture worker NO engine is started …
```

"host forbids it" is the skipped block (`↓`) in both files; "host lowers priorities" ran. `grep -cE '✓.*M6-CP-1'` on the stored output: 31 (was 25).

**The sibling rule** (`capture-priority.test.ts`). The capture supervisor does not lower its worker (no `nice` or priority call in `apps/core-server/src/capture/supervisor.ts`, read-only), so "lower than the worker" is: engine niceness strictly greater than worker niceness, both OBSERVED. The test starts a stub worker (a process that only waits), starts the stand-in engine through the real backend, and reads `os.getPriority(pid)` for both, the engine's own report, and `ps` where the host allows it: worker at the niceness of the test process, engine 10 above it. Negative control: a stub worker started through `nice -n 15` sits below where the engine would run; the adapter refuses with `ENGINE_NOT_BELOW_CAPTURE_WORKER`, the journal of the stand-in engine is empty (no process existed). The VAD engine obeys the same rule (`VAD_FAILED`, reason `ENGINE_NOT_BELOW_CAPTURE_WORKER`). On the real engines the rule was observed in M6-DF-1: capture worker niceness 0, `whisper-cli` niceness 10 (section 3.7).

### 3.3 Known-offset check — fails with a wrong constant

`apps/transcriber/src/__tests__/known-offset.ts`, `media-time.test.ts`, `media-time-wrong-constant.test.ts`. A synthetic tap holds one tone that starts at tap sample 95,232. The whole pipeline runs on it; the stand-in engine reports the tone where it finds it in the chunk audio. The expectation is written as numbers, not computed from the constant: (95232 + 1024) / 48000 s = 2.005333 s, so chunk start 2005 ms, segment start 2005 ms, segment end 3505 ms, mirror row 2005..3520.

| Case | Result |
|---|---|
| shared constant as it is | PASS |
| origin 0, 2048, 512, 960, wrong sign (timeline handed in) | the same check throws (5 cases) |
| quantified | without the origin the tone is reported 21 ms early; with twice the origin 22 ms late |
| `CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES` of `@dems/shared/api` REPLACED by 2048, 512, 960, 1536, 1100 (`vi.mock`; production code unchanged) | the check throws in all five; the tone is reported at `(95232 + value) / 48000` s |
| control of the control: replaced by 1024 | PASS |
| stated limit | the output is whole milliseconds: an origin wrong by one sample is not seen; 24 samples (half a millisecond) is |

### 3.4 Phantom-tail clamp

Rules (`clamp.ts:73`): (1) a segment that starts at or after the audio end is dropped; (2) an end past the audio end becomes the audio end; (3) the remainder of a segment clamped by more than the engine's time resolution is dropped when it repeats the previous kept text, or when its own QA members say no speech; (4) nothing left: dropped. The audio length is the chunk's sample count; the engine's `duration` member is never read.

**On the live server** (`test/real/row77-omlx-server.real.test.ts`, evidence `.cache/stt/checks/row77/runs/20261009T075232545Z-21241-row77-omlx-server/clamp.evidence.json`): the whole sealed fixture as one chunk; raw answer SHA-256 `08900b7c5eb97d8364aa3df55bb3036a4c14f7d9924ec17023f0eb69f3da6998`, 6801 bytes (byte-identical to rows 12 and 76), 17 segments.

| | Segments ending after the audio end (65,721 ms) |
|---|---|
| converted WITHOUT the clamp (negative control on the live answer) | 1: `65540 .. 95520` |
| after the clamp | 0; dropped `CLAMPED_TAIL_REPEATS_PREVIOUS` index 16; 16 segments left, the last `63740 .. 65540` |

Through the pipeline on the same server (VAD chunks, three requests): 14 segments, 0 end after the audio end, in the checkpoint and in the mirror.

**By mutation in a scratch copy** (`.cache/stt/checks/row77/mutation-red.py`, result `mutation-red.json`): clamp fully removed -> 3 tests red; repeated tail not dropped -> 1; start-past-end kept -> 1; runner commits without clamping -> 1.

### 3.5 M6-TF-1 on `cpu-local` (2 runs) and M6-KR-1 on the real engine

```
$ npm run test:real:row77:cpu-local -w @dems/transcriber      # outside the sandbox, host quiet at the start
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

Evidence `.cache/stt/checks/row77/runs/20261009T075020236Z-20817-row77-cpu-local/`. The commands, as recorded:

```
/usr/bin/nice -n 10 …/.cache/stt/whisper.cpp/build/bin/whisper-vad-speech-segments -f …/work/vad-window.wav
  -vm …/.cache/stt/models/ggml-silero-v6.2.0.bin -t 1 -vt 0.5 -vspd 250 -vsd 98 -vmsd 30 -vp 30 -vo 0.1 -np
/usr/bin/nice -n 10 …/.cache/stt/whisper.cpp/build/bin/whisper-cli -m …/.cache/stt/models/ggml-large-v3-turbo.bin
  -ng -t 8 -l id -oj -of …/engine-work/stt-<uuid> -f …/work/chunk-1.wav
```

| Criterion (tx §E.1) | Run 1 (uninterrupted) | Run 2 (killed, resumed) |
|---|---|---|
| 1. transcript produced; `-ng` in every command | yes; `everyCommandHasNoGpuFlag: true`; engine niceness 10 under a parent at 0 | the same |
| 2. non-empty, every segment with start, end, text | 14 segments | 14 segments |
| 3. at least one segment per scripted sentence (13) | 14 >= 13 | 14 >= 13 |
| 4. language `id` | `id` | `id` |
| VAD | 17 speech runs, 3 chunks (`640..27520`, `28000..52800`, `53190..65720` ms), no `vad_fallback` | the same plan |
| segments ending after the audio end | 0 | 0 |

**Criteria 5 and 6 of §E.1 are not this row's**: the transcript sealed and verified inside the package (rows 79+) and the speaker state (row 78). M6-TF-1 is therefore PASS for criteria 1-4 only; say so in the ledger.

**M6-KR-1, real**: the pipeline PROCESS was killed with SIGKILL while `whisper-cli` decoded chunk row 2 (the orphaned engine was still running and was stopped). Statuses at the kill: `DONE, RUNNING, PENDING`. A new process on the same directory: `planned 0, decoded 2, reused 1`. The committed chunk is byte-identical after the resume; engine starts per row `{1: 1, 2: 2, 3: 1}`; finished engine runs `[1, 2, 3]` (no committed chunk decoded twice); the VAD ran once over both processes; the resumed transcript equals the uninterrupted one segment for segment.

### 3.6 M6-KR-1 in the automated suite, and "a deleted chunk checkpoint re-runs exactly that chunk"

`kill-resume.test.ts`: the pipeline runs as its own process (`kill-harness-child.ts`) with stand-in engine PROGRAMS that keep a journal of every start. Killed inside chunk 3, 1 and 5 (three cases): the checkpoint is readable and equal to what it was at the kill, no half-written file, committed chunks byte-identical after the resume, engine starts = 1 per chunk and 2 for the interrupted one (same audio bytes both times), the VAD not run again, the file mirror in line. A third process on the finished transcript decodes nothing. Negative control: with the checkpoint file deleted after the kill the journal shows chunks 1 and 2 decoded twice.

`checkpoint-runner.test.ts`, "NEGATIVE CONTROL — the checkpoint of ONE chunk deleted": for chunk 0 and chunk 3, exactly that chunk is handed to the engine again, the other four are byte for byte unchanged.

### 3.7 M6-DF-1 — no dropped capture fragment while `cpu-local` STT runs

```
$ npm run test:real:row77:df1 -w @dems/transcriber        # outside the sandbox
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

Capture: row 58's harness, read-only (`python3 apps/capture-worker/test/m3worker.py session <name> --case long --tap`): the real capture worker, two fake cameras, the fake microphones. Beside it for the whole capture: the row-77 pipeline with `whisper-cli -ng`, restarted whenever one finished. Judged per camera file by `test/real/fmp4-fragments.ts`: `mfhd` sequence numbers are consecutive, every track's timeline is continuous from fragment to fragment, every `moof` has its `mdat`; plus the harness's own comparison of audio packets with the encoder manifest.

Final passing series, evidence `.cache/stt/checks/row77/runs/20261009T080824013Z-29430-row77-df1/run{1,2}.evidence.json`; the two earlier series are kept beside it (see the honest account below).

| | Both runs of every series |
|---|---|
| fragment sequence, each file | consecutive from 1, 0 findings |
| track timelines | continuous, 0 gaps, 0 overlaps |
| audio packets vs encoder manifest | equal count in both files, 0 differing between files, 0 mismatches against the encoder |
| harness verdict / exit codes | PASS / cam1 0, cam2 0, worker 0 |
| STT beside the capture | engine running when the capture started; pipeline process alive when it ended; engine seen beside the worker; 0 failed pipeline processes |
| sibling rule from `ps` | capture worker niceness 0, engine niceness 10 |
| negative controls on the same files | one fragment removed: `SEQUENCE_NOT_CONSECUTIVE` + `TIMELINE_GAP`; one fragment twice: `DUPLICATED_SEQUENCE` + `TIMELINE_OVERLAP` |

**Honest account of three attempts.** (a) The first attempt failed on MY process filter: it matched a shell whose command line contained the text `whisper-cli`; fixed to match by executable name. (b) The second series: run 2 passed, run 1 failed on an assertion I had written stricter than the check — "every audio payload distinct". 25 of 1,850 packets shared a payload with another, and every packet still equalled the encoder's packet at its position; row 58's own rule is "more than 90 % distinct" (`m3worker.py` h4). I aligned to that rule. (c) The third series: run 2 passed, run 1 failed on "both files have the same NUMBER of fragments": 17 and 16, with identical sample totals on both tracks, both timelines continuous, harness PASS. Each camera file is cut at its own keyframes; I replaced the assertion by "same sample totals per track in both files, and the audio track equals the encoder's packet count". In no run was a fragment, a sample or a packet missing or repeated. The navigator should judge these two corrections; the raw records of all series are kept.

**Deviations from the test-strategy wording.** (1) "analyser over `recording_fragments`": the table is written by the supervisor path, which this harness does not drive; the analyser reads the container itself. A `recording_fragments`-based repeat belongs to the row that mounts both in the Core (115) or to the +1 of row 81. (2) "no other heavy row in flight": checked at the START of each series (no capture or STT process, load at most 8). Other agents' jobs started during the runs (host load after the last series was above 20, of which this check's own engine is 8 threads). The check passed under that extra load; it was not a quiet run. (3) The harness keeps its own `result.json` under `.cache/m3worker/runs/row77_df1_*` with row 58's media measurements; nothing of it was copied into this row's evidence.

### 3.8 The table, under the runtime role

```
$ /usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server -- src/modules/transcript-chunks
 Test Files  1 passed (1)
      Tests  22 passed (22)
```

`transcript-chunks.db.test.ts`, as `dems_app` on a throw-away clone: rows in and out; 9 refusals where PostgreSQL (23514) and the transcriber's stand-in mirror name the SAME constraint; no DELETE and no UPDATE of key or audio range (42501); then the REAL runner of `@dems/transcriber` writing through the store: every boundary in the table before the first chunk is decoded, rows equal to the checkpoint (media-time ranges, model as a `CODE`, clamped segments), a FAILED chunk and its re-run as a new row, a database that is away (transcript goes on; a new runner reconciles and decodes nothing), and a resume on a row left RUNNING.

### 3.9 Baseline

| Check | Result |
|---|---|
| typecheck, lint: transcriber, shared, core-server | exit 0 x6 |
| shared | 75 files, 1993 passed |
| core-server unit (outside the sandbox) | 3 failed / 4309 passed: the three MODG route-list tests (`modules/sessions` x2, `modules/evidence` x1) |
| core-server static guards + this module | 14 files, 145 passed (after the import-guard fix, section 9) |
| db project, full | 12 failed / 1878 passed; all 12 in `test/acceptance/contract.test.ts` |
| media or model files in git | 0 |
| Homebrew | `brew list --formula --versions` identical before and after |

## 4. oMLX — one start/stop window (D7(d))

All times 2026-10-09, +07:00.

| Step | Time | Evidence |
|---|---|---|
| Pre-check | 14:51 | port 8000: no listener; no `omlx serve`, no `whisper-cli`; `omlx 0.6.4`; secret-pattern count in the log 0 |
| Log backed up first | 14:51:31 | `.cache/stt/checks/row77/omlx-serve.log.bak-20261009T145131` (8,286 B) |
| Start | 14:51:31 | `~/Documents/omlx-script/start.sh` -> `PID 21035`, `oMLX siap`, exit 0 |
| One serialised test file | 14:52 | `npm run test:real:row77:omlx-server` -> 2 passed: three chunk requests (M6-TF-1) and one whole-file request (clamp check); `maxCallsInFlight: 1` |
| Stop | 14:52:39 | `stop.sh` -> `oMLX berhenti.` |
| Down confirmed | after | no listener; `STATUS : DOWN`; `omlx 0.6.4`; settings file hash and `config.env` unchanged |

Two uses, one window. Never beside a CPU STT run. Key never printed (`keyFreeOutputs: true`; a grep for key patterns over the evidence folder, log backup aside, finds no file). **One lapse, stated:** a navigator's capture run was in progress at the moment I ran the start script (my gate was on the previous command). I held the requests until it had ended; only the server start overlapped it.

## 5. Downloads and the one new build target (OD-20, Q-INSTALL item 5)

| File | Source | Size | SHA-256 | Licence |
|---|---|---|---|---|
| `ggml-silero-v6.2.0.bin` | `https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin` | 885,098 B | `2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987` | MIT (F-90, F-95) |
| `3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx` | `https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/…` | 29,596,978 B | `357a834f702b80161e5b981182c038e18553c1f2ca752ed6cec2052365d4129b` | Apache-2.0 per the source project; no licence file with the asset (LB-3) |
| `sherpa-onnx-reverb-diarization-v1.tar.bz2` | `https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-segmentation-models/…` | 10,918,585 B | `615761e980be1688da0ef81618c056134d63aa55ea0a5f1494c47393b9398eab` | **Rev Model Non-Production License** (the archive's own LICENSE) — see section 10, item 1 |

Each into its own empty directory under `.cache/stt/downloads/row77/`; then the VAD model to `.cache/stt/models/`, the two diarization assets to `.cache/stt/diarization/`. The archive was listed before it was unpacked (12 entries, no absolute path, no `..`); none of its scripts was run. All three hosts were reachable through the sandbox proxy. `whisper-vad-speech-segments` (2,425,016 B, `4b5447ea…179456`) is one more target of the row-107 build tree: `cmake --build .cache/stt/whisper.cpp/build --target whisper-vad-speech-segments`; `otool -L` lists `libSystem` and `libc++` only; `whisper-cli` unchanged (`2429de42…86a3db`). Recorded in `THIRD_PARTY_NOTICES.md` (new subsection). Uninstall: `rm -rf .cache/stt/downloads/row77 .cache/stt/diarization .cache/stt/models/ggml-silero-v6.2.0.bin .cache/stt/whisper.cpp/build/bin/whisper-vad-speech-segments`.

## 6. Measurements that can fail

| Check | Negative control | Where |
|---|---|---|
| known offset | wrong origin, by argument and by replacing the shared constant | section 3.3 |
| chunk resume | checkpoint of one chunk deleted -> exactly that chunk; checkpoint file deleted -> committed chunks decoded twice | section 3.6 |
| clamp | live answer converted without the clamp; four mutations | section 3.4 |
| sibling rule | worker lowered below the engine -> no engine; mutations "rule removed" and "equal counts as below" red | section 3.2 |
| no dropped fragment | one fragment removed, one written twice, on the same files | section 3.7 |
| mirror stand-in | the real table refuses the same rows under the same constraint names | section 3.8 |
| 16 mutations in a scratch copy | all red (`mutation-red.json`) | `.cache/stt/checks/row77/` |

Two mutations stayed green and were taken out of the set, said plainly: "an end past the audio is no longer clamped" (the end is bounded a second time two lines below) and "the boundaries are not saved after the plan" (the plan is in the file again with the RUNNING write of the first chunk, before any engine). Both properties are held twice in the code; neither mutation alone can break them.

## 7. The tap signal (pair-58 R-8, D84)

**What I consume:** one function, `tapLost: () => boolean` (`runner.ts`, option of the runner), true when the capture worker's telemetry says `tapActive: false` (`packages/capture-protocol/src/index.ts:386`). Row 115 hands in the latest value; the transcriber reads no telemetry itself.

**What the transcription path does with it:** at the final step, a tap that is absent, empty, or reported lost makes the outcome explicit and recorded: `audioUnavailable: true` in the checkpoint, one `error` record in the persistent log with code `TRANSCRIPT_AUDIO_UNAVAILABLE`, and the step report says `transcriptState: 'PARTIAL'`, `partialReason: 'TRANSCRIPT_AUDIO_UNAVAILABLE'`. It is never `READY` and never flagged `no_speech`. What was captured before the loss is still transcribed. No new enum value: `PARTIAL` is a value of the session slice (`state-slices.ts:350`) and of the manifest (`06_evidence_package_spec.md` §B.7), and `TRANSCRIPT_AUDIO_UNAVAILABLE` is the existing C3 reason (`core-api.ts:217`; D-EV-1). Tests: `checkpoint-runner.test.ts`, group "no tap for this session is a RECORDED outcome" (5 tests incl. the negative control "live tap to the end is READY; silence with a live tap is READY + `no_speech`").

**What row 71 must raise:** the operator warning at the moment `tapActive` turns false while a session with STT enabled is recording (and at session start when a restarted worker records without a tap, D58-15). Not built here. Row 78/79 must carry `audioUnavailable` into `transcript.state = 'PARTIAL'` of the manifest.

## 8. Decisions taken in this row

| ID | Decision | Needs confirmation |
|---|---|---|
| D-77-1 | The tap is consumed as a regular FILE under the session scratch directory, never as a pipe (F-7). Cost: disk for the raw tap until the session is sealed; removing it after sealing is the sealing row's | yes |
| D-77-2 | The VAD runs through whisper.cpp's own `vad-speech-segments` (the ggml route of tx §A.2), one more target of the row-107 build; no ONNX runtime, no npm dependency | record |
| D-77-3 | Chunks are speech runs joined up to 30 s (silence between joined runs stays inside the chunk); `transcript_chunks` ranges are therefore NOT contiguous, unlike the bulk fixture of dbc-3 §G (a fixture property, not a CHECK) | yes |
| D-77-4 | `transcript_chunks.model_id` is checked `CODE`; `stt_config.model` is a free identifier. The row writes a derived label (`ggml-large-v3-turbo` -> `GGML_LARGE_V3_TURBO`, `toModelCode`); two identifiers can map to one label; the exact identifier is in the checkpoint file | yes — or a later migration relaxes the CHECK |
| D-77-5 | PROPOSAL constants added: `VAD_TAIL_GUARD_MS` 2000, `VAD_WINDOW_MAX_MS` 300000, `CLAMP_ROUNDING_MS` 20, `PHANTOM_NO_SPEECH_PROB` 0.6, `PHANTOM_AVG_LOGPROB` -1 | no (flagged) |
| D-77-6 | The grid step of the tap timeline is taken from the media-time origin constant (one AAC frame of priming); refused when the origin is 0 | yes — a shared `AAC frame` constant would be cleaner |
| D-77-7 | A chunk refused by the sibling rule or by a missing priority is FAILED after its retries and can be re-run later; capture is never slowed for it | record |
| D-77-8 | `apps/core-server` gained `"@dems/transcriber": "*"` as a devDependency (the db test drives the real runner); lockfile: one added line, written under `/usr/bin/lockf -k .locks/npm.lock`, offline, lock only. Row 115 moves it to `dependencies` when it mounts the transcriber | yes |
| D-77-9 | `StepReport` reports `transcriptState` (PENDING / PARTIAL / READY) and `partialReason`; FAILED of that value set is not produced (D-EV-1 seals PARTIAL) | record |
| D-77-10 | For `omlx-server` the sibling rule does not apply: DEMS starts no process there (D7(d)); that backend is a development tool | record |

## 9. Coordinator message during the row (D84)

1. `test/static/imports.test.ts` was red on `modules/transcript-chunks/index.ts:21` (a type import from `db/schema`). Fixed without touching the guard: the four states are a constant of the module's own `statements.ts`, and the unit test holds that list equal to the schema's value set. `npx vitest run --root apps/core-server --project unit test/static src/modules/transcript-chunks` -> 14 files, 145 passed; full unit suite back to the 3 MODG failures.
2. R-8: section 7.

## 10. For the controller and the user

1. **Licence finding (blocks row 78's route as specified).** `sherpa-onnx-reverb-diarization-v1`, the segmentation asset tx §A.4 names, ships a "Rev Model Non-Production License" (section 3.2 of its LICENSE: testing, research, personal or evaluation use in non-production environments only; its README says "non-commercial"). tx §F and LB-5 record it as Apache-family and the combination as licence-clean. I downloaded and unpacked it as the row instructed, read only its LICENSE and README, ran nothing, and placed `DO_NOT_USE__LICENCE_NOT_CLEARED.txt` beside it. The licence text binds whoever "accesses or uses" the model: whether to keep the files is the user's decision. Row 78 needs a ruling before it starts: another segmentation model, or labels left UNAVAILABLE.
2. **Spec erratum, tx §A.4.** "`nemo_en_titanet_small.onnx` 23.41 MB" does not match the release (F-105: titanet_small is 40.26 MB; 23.41 MB is `nemo_en_speakerverification_speakernet.onnx`). I took the other example the spec names, CAM++ 29.6 MB, whose name and size agree. The embedding choice is row 78's.
3. **Commit 4b62350** (not mine; I committed nothing) already contains an intermediate state of this row's files. Later edits of this row are in the working tree.
4. **M6-DF-1**: passed, 2 runs, but see the three caveats in section 3.7 (two of my own assertions corrected after a run; host not quiet for the whole run; container-level analyser instead of `recording_fragments`). A navigator repeat on a quiet host is the +1.
5. Not done here: mounting in the Core, the `stt_config` snapshot, the tap path in the capture plan and its clean-up, the Core's `shouldPause` pressure signal (row 115); diarization, assembly, `embedding_ref` (row 78); the operator warning for a lost tap (row 71); Linux per-thread niceness (class C). `masterplan/02_plan.md`, `status_tasks.md`, `implementation/99_implementation_report.md` were not edited (parallel run).

## 11. Commands for the navigator

```
# automated (sandbox is fine; the same totals outside it)
npm run typecheck -w @dems/transcriber && npm run lint -w @dems/transcriber
npm run test -w @dems/transcriber                                   # 15 files, 377 passed, 2 skipped
npm run test -w @dems/transcriber -- --reporter=verbose | grep -E '↓|host lowers'     # OUTSIDE the sandbox: "host forbids it" x2 skipped
npx -w @dems/transcriber vitest run src/__tests__/media-time.test.ts src/__tests__/media-time-wrong-constant.test.ts   # 19 passed
npx -w @dems/transcriber vitest run src/__tests__/kill-resume.test.ts                 # 4 passed
python3 .cache/stt/checks/row77/mutation-red.py                     # outside the sandbox: 16 RED

# core-server
npx vitest run --root apps/core-server --project unit test/static src/modules/transcript-chunks </dev/null   # 14 files, 145 passed
npm run test -w @dems/core-server                                   # 3 failed (MODG), outside the sandbox
/usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server -- src/modules/transcript-chunks   # 22 passed

# real engines: alone, outside the sandbox, after `pgrep -fl 'capture-worker|m3worker|fake_cam|fake_mic'` and `uptime`
npm run test:real:row77:cpu-local -w @dems/transcriber              # 3 passed
R=$(ls -d .cache/stt/checks/row77/runs/*-row77-cpu-local | tail -1)
jq -c '{chunks, segments, segmentsEndingAfterAudioEnd, everyCommandHasNoGpuFlag}' $R/run1.evidence.json
jq -c '{statusesAtKill, engineStartsPerChunkRow, finishedEngineRunsPerChunkRow, committedChunkByteIdenticalAfterResume, transcriptEqualsUninterruptedRun}' $R/run2.evidence.json
npm run test:real:row77:df1 -w @dems/transcriber                    # 3 passed (binds 127.0.0.1:8555 and :8557 through row 58's harness)

# omlx-server: only inside the sanctioned start/stop procedure (section 4); never beside a CPU STT run
npm run test:real:row77:omlx-server -w @dems/transcriber            # 2 passed
jq -c . "$(ls -d .cache/stt/checks/row77/runs/*-row77-omlx-server | tail -1)/clamp.evidence.json"
lsof -nP -iTCP:8000 -sTCP:LISTEN                                    # no listener
shasum -a 256 .cache/stt/models/ggml-silero-v6.2.0.bin              # 2aa269b7…7fb6987
```

---
*Generated: 2026-10-09 15:20 (+07:00)*
