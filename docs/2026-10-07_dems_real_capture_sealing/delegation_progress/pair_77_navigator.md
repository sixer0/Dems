---
task_id: 2026-10-07_dems_real_capture_sealing
row: 77 (M6-W2) — pair review, NAVIGATOR
date: 2026-10-09
agent: verifier (navigator; independent of the driver)
reviewed: HEAD 4b62350 + working-tree diff of `apps/transcriber/test/real/row77-df1.real.test.ts`; driver docs `implementation/34_m6_vad_stt.md`, `delegation_progress/coder_execution_row77.md`
narrative_tier: 2
status: complete
verdict: ACCEPT-WITH-FINDINGS
---

# Row 77 — navigator review (VAD, STT per chunk, checkpoints, clamp, priority, tap signal)

No speed, duration or throughput figure is written here (D230). Where a file contains one, it is cited by line only.

## 0. Verdict

**ACCEPT-WITH-FINDINGS.** Every check the row's Verification names was re-run by me and passes with the driver's numbers. No finding blocks the row's own Verification text. Two findings are **major** and should be fixed in row 77's code before the M6 gate (row 81) — both are small: the tap-lost signal is not latched (N-1), and a killed pipeline leaves its engine running while the resume starts a second one (N-2). The licence finding is **confirmed** (N-3) and needs a user ruling for row 78.

Three things the controller must know about this review itself:

1. **The tree moved under me.** From 15:32 another agent (row 78, by the file contents) edited `pipeline/runner.ts`, `checkpoint.ts`, `constants.ts`, `types.ts`, `index.ts`, the static rules, and added `diarization.ts`, `assembly.ts`, `document.ts`, `resample.ts`. My code reading, the suites, my scratch tests, the planted rules and the mutation run were all made BEFORE that (file times of the row-77 pipeline files: 14:11–14:29). Only my real `cpu-local` run (15:45) ran with row 78's additive edits in the tree. Line numbers below are those of HEAD 4b62350.
2. **My real run overlapped another row's run by a race.** I gated (`pgrep` + `uptime`: no capture process, host calm), then started the real `cpu-local` test at 15:45:21. Row 60's `make -C apps/capture-worker e2e --tag row60` started at 15:45:23. My engine ran beside its first three cases (`static_rules`, `unit_r1`, `harness_leftover_scope_r1`, all PASS in `.cache/m3worker/e2e_row60.log`); my run ended at 15:46:21, before its capture cases. If row 60 sees a timing oddity in a case that started before 15:46:21, this is why. It is the same gate-then-act race the driver reported for the oMLX start; see N-16 for the guard.
3. **I left processes behind once and removed them.** My copy of the mutation script made `kill-resume.test.ts` fail (as intended); the failing test does not stop the pipeline child and the held stand-in engine it started. I found six such processes (three `kill-harness-child.ts` under `.cache/stt/checks/row77_nav/mutant/`, three `journal-whisper-cli`, all started 15:29:15–17), confirmed by path and start time that they were mine, and killed exactly those PIDs. See N-12.

## 1. My numbers beside the driver's

| Check | Driver | Navigator | Where |
|---|---|---|---|
| typecheck + lint + suite, transcriber (sandbox) | 15 files, 377 passed, 2 skipped | 15 files, 377 passed, 2 skipped; exit 0 x3 | re-run 15:2x |
| same suite OUTSIDE the sandbox, verbose | "host forbids it" x2 skipped, "host lowers" x2 ran; 31 lines `✓ … M6-CP-1` | identical: 2 `↓` both "host forbids it (a sandbox)"; 2 `✓ host lowers priorities`; 31 | `.cache/stt/checks/row77_nav/suite_outside_verbose.txt` (durations stripped) |
| mutation script | 16 red | 16 red (my copy writes to `row77_nav/`, the driver's `mutation-red.json` untouched) + 9 of my own: 8 red, 1 not red (N-15) | `row77_nav/mutation-red.json` |
| core-server static + module | 14 files, 145 passed | 14 files, 145 passed | `npx vitest run --root apps/core-server --project unit test/static src/modules/transcript-chunks </dev/null` |
| module db test under `lockf` | 22 passed | 22 passed (as `dems_app`, throw-away clone, 0 databases left) | |
| real `cpu-local`, 1 run | 3 passed; 3 chunks `640..27520, 28000..52800, 53190..65720`; 14 segments; 0 past the audio end; `-ng` in every command; kill: `DONE,RUNNING,PENDING`, starts `{1:1,2:2,3:1}`, byte-identical, transcript equal | 3 passed; the same three chunks; 14 segments; 0 past the end; `-ng` x3; the same kill record, `committedChunkByteIdenticalAfterResume: true`, `transcriptEqualsUninterruptedRun: true` | `.cache/stt/checks/row77/runs/20261009T084521273Z-50508-row77-cpu-local/` (the test writes into the driver's folder) |
| clamp on the stored raw oMLX answer, NO server | sha `08900b7c…`, 6801 B, 17 segments; 1 past the end unclamped (`65540..95520`); 0 after; index 16 dropped `CLAMPED_TAIL_REPEATS_PREVIOUS`; 16 left, last `63740..65540` | identical on `.cache/spikes/stt-check/runs/whisper-run1.json` (sha recomputed: `08900b7c5eb9…da6998`, 6801 B): 17 → 16, unclamped past end `[[65540,95520]]`, after clamp 0, last `[63740,65540]` | `row77_nav/scratch_out.json` key `rawOmlx` |
| known offset, wrong constant | red for 5 handed-in origins and 5 replaced shared values | my own tone (tap sample 479,040, off the grid): right constant → segment `10001..13001` ms as computed by hand; handed-in 2048 → 10023, 512 → 9991, 1 → 9980, 1048 → 10002 (all detected), 1000 → 10001 (24 samples = the stated resolution, not seen). Shared constant replaced by MY value 1200 through `vi.mock`: driver's `expectKnownOffset` THREW (`chunkStartMs 2000` instead of 2005, segment 2009) | `scratch_out.json` `knownOffset`; `row77_nav/wrong_constant_out.json` |
| asset hashes | as in section 5 of the driver doc | all four recomputed and equal (VAD model `2aa269b7…`, CAM++ `357a834f…`, archive `615761e9…`, LICENSE `68791425…`; VAD binary `4b5447ea…`, `whisper-cli` `2429de42…` unchanged) | |
| oMLX | one window, stopped | I started nothing. Port 8000: no listener (before and after my run). `~/.omlx/settings.json` hash prefix now `334d13f7a322` = the driver's "before" file; mtime 14:51:32 (the server's own start). `config.env` size and mtime = the driver's record | |

## 2. Findings

Severity: blocker / major / minor. "Owner" is the row that should act.

| ID | Sev | File:line (HEAD 4b62350) | Evidence | Suggested fix | Owner |
|---|---|---|---|---|---|
| N-1 | **major** | `pipeline/runner.ts:267` (`if (final && options.tapLost?.() === true)`) ; option doc `:67-73` ("the Core hands the latest value in") | Scratch test: tap written to 70 s of a 100 s session; `tapLost()` true during a non-final step, false again at the final step (a worker that is gone after the stop has no telemetry). Result: mid `["PENDING", audioUnavailable false]`, final `["READY", null, audioUnavailable false]`. A session whose tap was lost is reported READY. The signal is read only at the final step and nothing remembers an earlier `true` | Read the signal at EVERY step and record it at once (`recordAudioUnavailable('TAP_NOT_ACTIVE')` is already sticky in the checkpoint). Also write in the option doc that a single `true` is enough. Add the test | 77 (two lines + one test); 115 must still hand the signal in |
| N-2 | **major** | `backends/cpu-local.ts:262` (the one `spawn`; no record of the engine pid, no process group) ; `pipeline/runner.ts:302-317` | My kill test (`row77_nav/kill_out.json`): pipeline process SIGKILLed while the engine holds chunk 3; nobody stops the engine (the driver's tests do it by hand, `kill-resume.test.ts:79-86`, `row77-df1.real.test.ts:158-166`); a new pipeline process resumes at once → **2 engines alive at the same time** on the same chunk (`aliveAtTheSameTime: 2`), and `work/chunk-3.wav` (session audio) is left in the scratch directory. tx §C "One STT chunk decoded at a time" is broken exactly during recovery, with the capture worker beside it. The driver's own evidence shows the leftover: `runs/…-row77-df1/run1-stt-2/work/chunk-1.wav` | Before a decode, write the engine's pid and start identity to `<scratch>/work/engine.json`; a new runner that finds it checks that the pid still runs that binary and stops it before it decodes; remove `work/chunk-*.wav` and `vad-window.wav` leftovers at runner start. Alternative: the Core supervisor of row 115 owns a process group for the transcriber. One of the two must be decided now | 77 (preferred) or 115 — controller decides |
| N-3 | **major** (for row 78's route; not a defect of row 77's code) | `.cache/stt/diarization/segmentation/sherpa-onnx-reverb-diarization-v1/LICENSE` (11,111 B, sha `68791425…b180`), `README.md`; tx §A.4 `:152`, §F `:389`, `:398-400` | Confirmed by reading only: title "Rev Model Non-Production License"; §3.2 "You shall only use the Rev Models, Derivatives … and Outputs for testing, research, Personal, or evaluation purposes in Non-Production Environments … shall not supply the Rev Models, Derivatives, or Outputs in the course of a commercial activity"; "Personal" excludes use connected to employment; §1.2 binds whoever accesses or uses it; README: "accessible under a non-commercial license". tx §F records it as "Apache family" and LB-5 as licence-clean: **wrong**. Note that §3.2 and §4.2 also bind the OUTPUTS (speaker labels) | Section 4 below | user ruling; 78; spec erratum for tx §A.4/§F/LB-5 |
| N-4 | minor | `pipeline/runner.ts:280` (the guard needs `final`), `pipeline/chunker.ts:73-76`; `.cache/stt/whisper.cpp/src/whisper.cpp:5453-5472, 5509-5524, 6854` | (a) Scratch run, one unbroken speech run of 12 minutes while RECORDING: eleven non-final steps, each `planned 0, decoded 0`, cursor stays at 1 s; the VAD is run again on the capped window at every step; once stuck, later audio is not planned either. Only the final step cures it, by fixed windows and the flag `vad_fallback` (25 chunks, 0 speech samples uncovered). No audio is lost; the incremental transcript (R-5) stops. (b) Why the real VAD gives such a run: read in the source — a run hard-split at `-vmsd 30` restarts one frame later, and the program then merges runs closer than 200 ms, so `-vmsd` does not bound a run; `-vo 0.1` is read only by `whisper_full`, not by this program. Both arguments are inert in the command. Not run on the binary (derived from the source) | Drop `final` from the guard for a window that is at its cap, or close the part of an open run that already exceeds the maximum. Say in `silero-vad.ts` that the two arguments have no effect here, or remove them | 77 |
| N-5 | minor | `pipeline/clamp.ts:86-91` | Edge cases through `clampSegments` (10 s chunk): `("Ya." 5.0–7.5)`, then `("ya" 7.9–10.03)` → the second is DROPPED as `CLAMPED_TAIL_REPEATS_PREVIOUS` although 2.1 s of it lie inside the audio; with an overshoot of 20 ms or 10 ms it is kept. A short answer said twice at the end of a chunk is ordinary interview content. The rule matches the row text; the edge is that "repeats the previous text" is the only test. Also seen, as limits not defects: a phantom tail with OTHER text and no QA members is kept, clamped (`9820..10000 "…telah menonton"`); a phantom that is the FIRST segment of a chunk and repeats the last text of the previous chunk is kept; a segment starting 1 ms before the end with a far end is kept as 1 ms. The real tail's own QA would not have caught it (`avgLogprob -0.346`, `noSpeechProb 2.2e-9`), so the text rule is needed | Apply rule 3 only when the overshoot is larger than the part inside the audio (real tail: 0.18 s inside, 29.8 s outside). Row 78 assembly: compare the first segment of a chunk with the last of the previous one | 77; note for 78 |
| N-6 | minor | `pipeline/runner.ts:131, 158-166`; `modules/transcript-chunks/statements.ts:41` (`ON CONFLICT … DO NOTHING`) | Scratch test: transcript done (rows `1: 2005..22037`, `2: 33003..53035`, `3: 64021..84032`), checkpoint FILE lost, second run plans other ranges (VAD failed → fixed windows). Table afterwards: row 1 still `2005..22037` but its segments are `21..30037`; rows 2, 3 likewise; 0 mirror errors logged. The reconciliation compares `status|computedAt` only, the insert leaves an existing row alone, and the role may not update a range. The table then contradicts the file silently. dbc-3 §B.7 calls the table "the resume-after-kill checkpoint"; as built, a lost file cannot be rebuilt from it (`read` returns no segments) | `read` also returns the range; when a planned chunk meets a row with another range, take a `seq` above the highest existing one (new rows) and log it. Record as a decision that the FILE is the only resume source | 77; decision for the controller |
| N-7 | minor (cross-row) | `masterplan/06_evidence_package_spec.md:321` vs `pipeline/mirror.ts:11-13`, `runner.ts:389-402` | The package spec takes `transcript.failedChunks` "from `transcript_chunks.status='FAILED'`". Rows are ATTEMPTS: a chunk that failed and was re-run to DONE keeps its FAILED row. A plain count over-states failed chunks | Row 79 counts FAILED rows that have no later DONE row with the same range, or reads the checkpoint (`status` per chunk). Put it in row 79's brief | 79 |
| N-8 | minor | `.cache/stt/checks/row77/omlx-serve.log.bak-20261009T145131:38, :48` | The server's own log, backed up into THIS row's evidence folder, holds two lines "… transcribe done / synthesize done" with a duration in seconds and an output size. The driver doc `:15` says no duration figure is in the evidence this row stored. Everything else I grepped is clean (JSON keys: only `startMs`, `endMs`, `audioEndMs`, `computedAt`, `sampleRateHz`; the stored verbose suite output has its durations stripped) | Delete the backup or pass it through row 76's log-excerpt tool | 77 |
| N-9 | minor | `pipeline/runner.ts:268-274` ; `:338-351` | (a) Tap truncated below the cursor between two steps → final step READY, `audioUnavailable false` (the contract "a number once returned never shrinks" of `audio-source.ts:35` is not checked). (b) Tap file removed after the plan → chunks `FAILED:TRANSCRIPT_AUDIO_UNAVAILABLE`, state PARTIAL but `partialReason CHUNKS_FAILED`, `audioUnavailable false` | `available < cursorSample` → `recordAudioUnavailable`; a chunk that ends FAILED with that code sets it too | 77 |
| N-10 | minor (contract for 115) | `backends/cpu-local.ts:135-137` (`captureWorkerPid` optional → `{ ok: true }`), `silero-vad.ts:144`; `runner.ts:74` (`tapLost` optional) | The sibling rule and the tap rule are both OFF when the option is not handed in. Scratch: a 40 s tap of a 100 s session with `tapLost: () => false` → READY (the transcriber cannot know) | For a `PCM_TAP` timeline make both options mandatory (config error otherwise). Section 5 lists what row 115 must pass | 77 (types) + 115 |
| N-11 | minor | `pipeline/constants.ts:7` ("no chunk is longer"), `chunker.ts:56` | Snapping outwards makes tap chunks up to two frames longer than `VAD_MAX_CHUNK_MS`: observed 30,037 ms (and 30,016 ms) in my property run. Harmless for both engines; the comment is not true | Reword, or cut at `max − 2 frames` | 77 |
| N-12 | minor (test hygiene) | `__tests__/kill-resume.test.ts:75-88, :139-150` ; `test/real/row77-cpu-local.real.test.ts` criterion 3 | (a) When an assertion fails before the clean-up, the pipeline child and the held engine stay for ever (six processes after my mutation run; removed). (b) M6-TF-1 criterion 3 "at least one segment per scripted sentence" is asserted as a COUNT (14 ≥ 13). In my run the two closing sentences share one segment and another sentence is split in two; every scripted turn does have a segment, but the assertion would also pass if one turn had none and another were split twice | `try/finally` around the kills. Assert per turn (each scripted turn overlaps at least one segment in time) | 77 |
| N-13 | minor (gate) | `test/real/fmp4-fragments.ts`; `masterplan/10_test_strategy.md:222` | Section 3.7 below. Acceptable for this row, a gap for the M6 gate | Row 81's +1 over `recording_fragments` once row 115 mounts both; quiet host | 81 / 115 |
| N-14 | minor | `pipeline/media-time.ts:51-55` (D-77-6) | The grid step is the origin constant. Today both are one AAC frame. If the capture contract sets the origin to 0 (`delay_moov`, named in `packages/shared/src/api/capture.ts:77`) the transcriber refuses to build a tap timeline at all — a change of a mux flag becomes a transcript outage; with another encoder priming (2048, 2112) the "grid" is no longer the frame grid. Times stay correct in every case (they come from `(n + origin) / rate`), only the snapping is wrong | Add `CAPTURE_AAC_FRAME_SAMPLES` to `@dems/shared/api` beside the origin and take the grid from it; then origin 0 is legal | shared (row 58 owner) + 77 |
| N-15 | minor (rule limits) | `__tests__/static-rules.ts:335-383` | 18 violations of my own planted in the NEW pipeline files through `scanSources`: 12 reported (child_process by import, by dynamic import, by a built string; `-ug`, `--use-gpu`; `Date.now()`; `console`; a home path; `node:net`; `process.env`; a model literal). NOT reported: the origin written as `2 ** 10`, `512 * 2`, `64 / 3`; a duration computed from two `getTime()` instants; `openSync('/etc/passwd')` (the audio path has no confinement rule — the caller chooses it); `import pg`. The VAD child process: one starter (`runLoweredProcess`), fixed argv, `shell: false`, `ENGINE_ENVIRONMENT` (3 variables), `nice -n 10`, single thread — as the STT engine. My mutation "mirror not reconciled at the start of a resume" stayed green: the call after the plan does the same work (held twice, like the driver's two) | State the limits in the rule file; a rule for the tap path belongs to row 115 (it builds the path) | 77 (note) / 115 |
| N-16 | minor (process) | driver doc `:199`; section 0 item 2 | A `pgrep` gate followed by a start is a race; it bit the driver (oMLX start) and me (real run) | One lock for every heavy host action: `/usr/bin/lockf -k .locks/host-heavy.lock <cmd>` around capture e2e runs, real STT runs and the oMLX start script, plus a `globalSetup` in `vitest.real.config.ts` that refuses when a capture or engine process exists. The gate and the action are then one step | controller (all rows that run real engines or capture) |
| N-17 | minor (contract for 115) | `pipeline/checkpoint.ts:150-155`, `runner.ts:143` | A torn or foreign checkpoint file makes `createTranscriptRunner` THROW `CHECKPOINT_INVALID` (`CHECKPOINT_NOT_JSON` in my test). Correct and fail-closed, but nothing says what happens next: every new runner throws again | Row 115: move the file aside, log, and end the transcript PARTIAL (or re-plan under new `seq` numbers, N-6). Decide and write it down | 115; controller |

## 3. The ten questions

### 3.1 VAD chunking

- **Is it the VAD the spec names?** Yes. tx §A.2 "Model file": `cpu-local: ggml-silero-v6.2.0.bin … whisper.cpp-native`; "ggml route runs inside whisper.cpp". The file is at the address of whisper.cpp's own `models/download-vad-model.sh:6` (`huggingface.co/ggml-org/whisper-vad`), 885,098 B, sha recomputed equal; the program is the `vad-speech-segments` example of the row-107 tree, `otool -L`: `libSystem`, `libc++` only. `THIRD_PARTY_NOTICES.md:327-328` records source, version, size, hash, licence (MIT). Not verifiable on disk: the model file carries no licence text; MIT rests on findings F-90/F-95 of the collection — labelled as such.
- **Can speech be dropped at a chunk edge?** Not found. Property run of mine: 12 random sessions (tone bursts of 0.3–70 s, gaps of 0.25–4 s, the tap growing in random steps with non-final passes, then a final pass): **0 speech samples outside every chunk** in all 12; chunks ordered. The closed chunk ends at the padded end of a run; the next pass starts at the open run; the last 2 s of growing audio are never decided.
- **Cut mid-word?** Possible only where a run is longer than 30 s: `hardSplit` cuts by length with 100 ms shared (my 40-minute run in one window: 81 chunks, 0 gaps, smallest overlap 106.7 ms after snapping). A word longer than the overlap can be split across two chunks and both chunks carry the shared 100 ms: row 78's assembly must expect overlapping segment times and a possibly doubled or broken word there. This is what tx §A.2 specifies ("consecutive chunks overlap 0.10 s").
- **Pure silence**: VAD answers no run → 0 chunks, flag `no_speech`, READY, `audioUnavailable false`. Correct (tx §A.2 "not an error").
- **A 40-minute monologue**: complete at the final pass; while recording see N-4.
- **Audio shorter than one VAD frame**: with a stand-in VAD that calls it speech, a 100-sample (and a 1-sample) tap becomes one chunk `21..23` ms that is handed to the engine. With the real program a sub-frame file is padded to one frame and cannot reach the minimum speech length (source `whisper.cpp:5268-5270, 5504`), so the answer is no run → `no_speech`. I did not run the real binary or `whisper-cli` on such a file (host busy with row 60's captures at that moment): **unverified on the binary**.
- **D-77-3 (ranges are speech chunks, not contiguous)**: dbc-3 §B.7 has no CHECK or key that asks for contiguity ("one row per VAD chunk"); "contiguous audio ranges" is a property of the bulk fixture (`:832`). tx §D.2 resumes by `chunk_index`, not by coverage. The only later reader I found is the package spec `:321` (N-7). Nothing assumes that the rows cover the timeline. Note that ranges can also OVERLAP by 100 ms.

### 3.2 Media time

- Production code never writes the number: `grep -rnE '\b1024\b|1_024|21\.333|0\.0213'` over `apps/transcriber/src` without tests gives one line, `log.ts:107` (a byte size `5 * 1024 * 1024`). The import is `media-time.ts:28`.
- **Which audio**: the PCM tap as a regular file (`audio-source.ts:85-91` refuses a non-regular file with `AUDIO_TAP_NOT_A_REGULAR_FILE`). File time of tap sample n = `(n + origin) / 48000` (`media-time.ts:67-69, 101-103`).
- **Resampling**: none in row 77's code. A chunk is written as a 48 kHz WAV and both engines resample the file themselves; the VAD program likewise. There is no running sample counter that could drift: every chunk start is computed from its absolute sample index, every segment from the chunk start plus the engine's seconds, rounded ONCE.
- **Worst case at 2 hours** (scratch test, the code's own functions against exact arithmetic): chunk boundary error ≤ 0.5 ms, segment time error ≤ 0.5 ms (0.334 ms seen), the same bound as in the first seconds; `(n + origin) * 1000` at 2 h is far below 2^53; snapping at 2 h stays on the file grid (`(from + origin) mod 1024 = 0`). **No accumulation.** The VAD's centisecond output only moves a boundary, never a time.
- **D-77-6**: N-14.
- **Known offset**: section 1.

### 3.3 Phantom-tail clamp

Rule vs code: start at or after the end → dropped (`clamp.ts:80`); end past the end → clamped (`:85`, bounded again `:98`); clamped remainder that repeats the previous kept text → dropped (`:88`), only beyond a 20 ms tolerance; nothing left → dropped (`:99`). Stored raw answer: section 1. My edges: end exactly at the end → kept, not counted as clamped; start exactly at the end → `STARTS_PAST_AUDIO_END`; sub-millisecond remainder → `EMPTY`; `NaN` end, end before start → `EMPTY`; a negative start cannot arrive (`types.ts:48` refuses it at the adapter). The legitimate-repeat case: N-5.

### 3.4 Checkpoints and resume

- **Positions**: the driver kills while the engine runs (three positions). Not covered by a kill, read from the code: (a) engine finished, checkpoint not yet written — the chunk is still RUNNING in the file and is decoded again; nothing committed is touched. (b) Checkpoint says DONE, mirror not yet updated — the next runner reads the rows and updates the row (`runner.ts:155-166`); covered by the db test "resume on rows a killed process left behind". (c) During the file write — sibling file, fsync, rename, directory fsync (`checkpoint.ts:169-187`); my mutation "written in place after the rename" turned the kill tests red. (d) Torn file — N-17. **The nastiest point I found is not in the file at all: the engine that survives the kill (N-2).**
- **Byte-identical re-run**: on `cpu-local` yes (my real run). **Rule for `omlx-server`** (not written anywhere as a rule; it follows from the code): a DONE chunk is never decoded again on any backend, so determinism is not needed for committed text; an interrupted chunk is decoded again and may get other text, which replaces nothing. The one way committed text can change is a lost checkpoint file (N-6). Please record this as the rule.
- **Table**: writes as `dems_app` (db test, 22 passed): INSERT, UPDATE of four of the five permitted columns, no DELETE (42501), no UPDATE of key or range (42501). Idempotency key = the primary key `(session_id, seq)` with `ON CONFLICT DO NOTHING`.
- **D-77-4**: `GGML_LARGE_V3_TURBO` in `model_id`; the exact identifier is `checkpoint.model` (and the `stt_config` snapshot); `transcripts.model` (dbc-3 §B.8) is a jsonb object with name, version, quantisation, params and file hash. Nothing is lost as long as row 78 fills that object from the checkpoint and the model file, never from `model_id`. Two identifiers can share a label and labels are cut at 64 characters: `model_id` must not be used as a key.
- **Import structure**: `index.ts` imports `./statements` only; `statements.ts` imports a type of `pg` only. Static guards green (145).

### 3.5 CPU priority

M6-CP-1: section 1. **Sibling rule — enforceable or only against a stub?** The mechanism is real: it reads `os.getPriority(pid)` of whatever pid it is given, and in the driver's M6-DF-1 records the REAL worker was seen at niceness 0 and `whisper-cli` at 10 (`siblingRule` in all six evidence files). What is not there: (1) nobody hands a pid in yet, and without one the rule answers "ok" (N-10); (2) it is asked when an engine STARTS — a worker that starts while an engine is already decoding is not judged until the next chunk; (3) it judges one pid; (4) not applicable to `omlx-server` (D-77-10, agreed).

**What row 115 must pass:** `captureWorkerPid: () => supervisor.status().workerPid` (`apps/core-server/src/capture/supervisor.ts:774`, already `number | null`) to BOTH `createTranscriberAdapter(…, { captureWorkerPid })` (`adapter.ts:40, :57`) and `createSileroVad(…, { captureWorkerPid })` (and row 78's diarization engine); `priority: 'required'`; `tapLost` (sticky, N-1); the tap path under the session scratch; `shouldPause`; the `transcript_chunks` store as `mirror`; and a decision on N-2 and N-17.

### 3.6 R-8, tap lost

Values exist: `PARTIAL` in `packages/shared/src/api/state-slices.ts:350` and `:746`; `TRANSCRIPT_AUDIO_UNAVAILABLE` in `core-api.ts:217` and in tx §A.1; no new enum. My scratch results (`scratch_out.json` key `r8`):

| Case | Result |
|---|---|
| tap absent, non-final | PENDING (it may still appear) |
| tap absent, final | PARTIAL / `TRANSCRIPT_AUDIO_UNAVAILABLE` / `audioUnavailable true` / one error record; no `no_speech` flag |
| tap empty, final (with and WITHOUT the `tapLost` option) | the same |
| lost mid-session after one chunk, signal true at the final step | PARTIAL / `TRANSCRIPT_AUDIO_UNAVAILABLE`; the three captured chunks DONE; stays PARTIAL for a new runner whose signal is false |
| silence + signal true | PARTIAL, not `no_speech` |
| signal true only while recording | **READY** — N-1 |
| tap ends early, signal false | READY — N-10 |
| tap truncated / removed after the plan | N-9 |

Never an empty-but-successful transcript in the three cases asked for. The gap is N-1.

### 3.7 M6-TF-1 / M6-DF-1

Catalogue (`10_test_strategy.md:222`): "with `cpu-local` STT running beside the fake capture …, fragment `seq` stays contiguous with 0 dropped/duplicated (one functional check — not a throughput measurement)"; proof at "capture + transcriber integration, analyser over `recording_fragments`".

- **"every audio payload distinct" → row 58's "more than 90 % distinct"**: sound. Distinctness is not part of the definition; it only makes the position-by-position comparison with the encoder manifest meaningful. Raw records: series 2 run 1 `distinctPayloads 1825` of 1850, series 3 run 2 `1832` of 1853, with `differingBetweenFiles 0` and `mismatchesAgainstEncoder [0, 0]` in every record — every packet equals the encoder's packet at its position.
- **"same number of fragments in both files" → "same sample totals per track, audio track = encoder packet count"**: sound, and stronger where it matters. Series 3 run 1: `VIDEO-01` 17 fragments, `VIDEO-02` 16, both `samplesPerTrack {1: 1600, 2: 1852}`, both `firstSequence 1 … lastSequence = fragments`, `findings []`, encoder packets 1852. A dropped or doubled fragment changes the sequence, the timeline and the totals; the negative controls on the same files show all three (`SEQUENCE_NOT_CONSECUTIVE`, `TIMELINE_GAP`, `DUPLICATED_SEQUENCE`, `TIMELINE_OVERLAP`). One residue: the video total 1600 is compared between the two files, not with what the fake camera sent (the harness's own PASS covers that; this test does not). And one observation for row 81: the cut pattern of the two cameras differed once under STT load (17 vs 16) — not a drop, but worth a look at per-fragment lengths in the +1.
- **Container instead of `recording_fragments`**: acceptable for this row (the supervisor path is not mounted until row 115), a **gap for the gate**: the catalogue names the table. Row 81's +1 should be that run. The driver's two runs were also not on a quiet host (own statement).
- **Criteria 5 and 6 of M6-TF-1** are not this row's (agreed); criterion 3: N-12(b).
- My one real run: section 1 and section 0 item 2.

### 3.8 Licence

Section 4.

### 3.9 D230 hygiene and leftovers

Docs of the row: no timing figure (the only millisecond figures are media-time offsets). Evidence: N-8. Media or model files added to git by this row: 0 (`git diff --name-only --diff-filter=A 101ce62 HEAD` filtered by media extensions: 0; `.cache` is ignored; the tracked media in the repository are older demo assets of `packages/shared` and `apps/mobile`). Processes: none of mine left (`ps` for `whisper-cli`, `whisper-vad`, `omlx`: none); port 8000 free; settings hash: section 1.

### 3.10 Static rules

N-15.

## 4. The licence question — recommendation for row 78

Verified on disk (read only, nothing executed):

| Asset | On disk | THIRD_PARTY_NOTICES.md | Licence evidence |
|---|---|---|---|
| `ggml-silero-v6.2.0.bin` | 885,098 B, `2aa269b7…7fb6987` | `:327`, equal | no licence file with the asset; MIT per collection findings — **not verifiable from disk** |
| `3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx` (CAM++) | 29,596,978 B, `357a834f…4129b` | `:329`, equal | no licence file with the asset (LB-3); "Apache-2.0 per the source project" is the notices' statement — **not verifiable from disk**. Its name says it was trained on VoxCeleb; the terms of that data set were not checked by anyone in this task — **open point** |
| `sherpa-onnx-reverb-diarization-v1.tar.bz2` | 10,918,585 B, `615761e9…98eab`; LICENSE `68791425…b180` | `:330`, equal, marked NOT CLEARED | **Rev Model Non-Production License** — confirmed |

The driver's erratum on the embedding example (titanet size) I did not re-check against the release page (no network use in this review).

Options, in my order of preference. Claims marked (unverified) come from general knowledge of the sherpa-onnx project, not from a file on this disk or a page I opened; row 78 must confirm each on the official page and in the asset's own LICENSE before any download.

1. **No segmentation model: label the committed segments directly.** tx §A.4 already defines the input as "the committed segment set + PCM" and the output as a label per SEGMENT. Compute one CAM++ embedding per committed STT segment (or per VAD speech run), cluster into at most two, apply the existing UNAVAILABLE rules. Needs only assets already on disk (Silero VAD + CAM++) and sherpa-onnx's speaker-embedding and clustering parts (Apache-2.0 code, unverified for the exact build). Limit: a segment that holds two speakers gets one label; overlapped speech is not separated. For a two-person interview with turn-taking this is the licence-clean route with the fewest unknowns.
2. **sherpa-onnx's export of pyannote `segmentation-3.0`** (`sherpa-onnx-pyannote-segmentation-3-0`, published in the same release list; said to carry an MIT licence file — unverified). It is the model sherpa-onnx's offline diarization was built around. But the spec EXCLUDES the pyannote weights because the upstream is gated behind accepted terms (tx §A.4 "Excluded route", §F, W1-C5). A republished copy without a gate does not remove the reason for the exclusion; using it reverses a recorded decision and is the user's call, not a row's.
3. **Speaker labels UNAVAILABLE** for this release. The user requirement is "speaker labels when possible"; the state and the flag string exist; nothing else in M6 depends on labels.
4. Not an option: `reverb-diarization-v2` (same publisher; expect the same licence — unverified), or keeping v1 "for the functional check only" in a product repository whose outputs go into evidence packages (§3.2 and §4.2 of the licence bind outputs).

Also for the user: the licence binds whoever "accesses or uses" the model (§1.2) and asks for deletion on termination (§7.2). Whether the downloaded files stay on this machine is the user's decision; removal is `rm -rf .cache/stt/diarization/segmentation .cache/stt/downloads/row77/segmentation`. I see that row 78 is already in progress with a guard that refuses this model by marker and by hash (`pipeline/diarization.ts:28-31, :207-212`); that guard is consistent with this finding. I did not review row 78.

Spec errata to record: tx §A.4 "Route" (`:152`), §F row "sherpa-onnx diarization assets" (`:389`) and the LB-5 verdict (`:398-400`) are wrong for the segmentation asset.

## 5. Recommendations on the driver's decisions

| Decision | Recommendation |
|---|---|
| **D-77-1** tap as a regular file | **Confirm.** The pipe would be closed by the worker at the first STT pause (F-7). Conditions to write into rows 115 and 79/32: the raw tap is unencrypted session audio outside the sealed package, about 346 MB per hour of session (48,000 samples x 2 bytes), plus `work/vad-window.wav` and `work/chunk-N.wav` (mode 0600); all of it must be removed when the session is sealed or abandoned, and after a kill (N-2). A restarted worker records without a tap: the rest of such a session is PARTIAL by design (R-8) |
| **D-77-3** ranges are speech chunks | **Confirm.** Nothing reads coverage (3.1). Tell row 78: ranges have gaps AND 100 ms overlaps; tell row 79: N-7 |
| **D-77-4** `model_id` as a derived label | **Confirm, no migration.** The label is not an identifier; the exact model goes into `transcripts.model` from the checkpoint and the model file (3.4) |
| **D-77-6** grid from the origin constant | **Change, small.** A shared frame constant (N-14). Not urgent while the mux flags are pinned and a Core test holds the origin to them |
| **D-77-8** `@dems/transcriber` as a devDependency of core-server | **Confirm.** One lock line (`package-lock.json:44`), the dependency direction is core-server → transcriber → shared, no cycle. Row 115 moves it to `dependencies` |
| D-77-5 (proposal constants) | Keep as proposals; `CLAMP_ROUNDING_MS` is the only one a finding touches (N-5) |
| D-77-7, -9, -10 | Agreed |

## 6. What was not checked

- The full suites of shared, core-web, mobile, core-server and the full db project (controller's economy rule).
- M6-DF-1 real test and anything on oMLX (forbidden in this review); the clamp was re-run on the stored answer only.
- The real VAD binary and `whisper-cli` on a sub-frame file (3.1); the real VAD's behaviour on a long unbroken run (N-4b is from the source).
- The release pages of the downloaded assets and the licences of the alternatives (section 4).
- Row 78's files that appeared during the review.
- `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`, `implementation/99_implementation_report.md`: not edited (parallel run; the controller owns them).

## 7. Files

Created: this file. Scratch outputs, git-ignored: `.cache/stt/checks/row77_nav/` (`scratch_out.json`, `wrong_constant_out.json`, `kill_out.json`, `latch_out.json`, `static_out.json`, `mutation-nav.py`, `mutation-red.json`, `suite_outside_verbose.txt`, `real_cpu_local.txt`; runner durations stripped). One evidence folder written by the driver's own test during my run: `.cache/stt/checks/row77/runs/20261009T084521273Z-50508-row77-cpu-local/`. Scratch test files inside the repository (`apps/transcriber/src/__tests__/nav77-*.test.ts`, four files): deleted; `git status` shows none. No production file edited, nothing committed.

---
*Generated: 2026-10-09 (+07:00)*
