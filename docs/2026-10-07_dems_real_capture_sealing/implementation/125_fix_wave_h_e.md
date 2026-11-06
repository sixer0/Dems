---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave H, driver E - the development SPEECH microphone and the STT leftovers of gate 81
date: 2026-10-10
agent: coder-execution
tree: f293221 + the wave H edits in flight (no commit)
brief: delegation_progress/fix_brief_wave_h.md (decision D200); ruling D198 (gate 81, condition C1)
narrative_tier: 3
status: needs-review
---

# 125 - Fix wave H, driver E: a speech microphone for development capture; STT leftovers

No STT speed, throughput or run-duration figure is in this note (D230). The speech server on
127.0.0.1:8000 was never called, started, stopped or reconfigured; no key was read or printed; no
model was downloaded; no network was used. No camera and no microphone of this Mac was opened. The
only audio handled is SYNTHETIC speech made on this machine; it lies under `.data/` and `.cache/`
(both git-ignored, checked with `git check-ignore`) and was never played.

## 1. Findings

| Finding | Reproduced? | Fix | Test | Status |
|---|---|---|---|---|
| Gate 81 C1 / D198: the generated microphone carries no speech, so no chunk is planned and the engine never starts | By construction: the only generated inputs were two `sine=` tones (`adapters/local/mic-helper-args.ts:60-63`); the new test file failed 12 of 12 before the code existed | A third microphone source `FIXTURE` (a file of synthetic speech, real time, looped, same output line, no device) + the development setting `DEMS_CAPTURE_DEV_FAKE_MIC=tone\|speech` read ONCE by `fakeMicDecisionOf` at the boot of the fence (section 2) | `fence/__tests__/fake-mic.test.ts` (14), `adapters/local/__tests__/mic-helper-args.test.ts` (+5), `mic-helper.test.ts` (+3) | DONE in code; the live session is the re-gate's |
| C1, engine half of `M6-TF-1` on `cpu-local` | n/a (a proof, not a defect) | ONE run of the pipeline's own entry on the fixture with the real engine on the CPU (section 4) | `apps/transcriber/test/real/wave-h-speech-fixture.real.test.ts` | PROVEN outside a session; NOT proven in a session |
| C1 in a session (segments > 0, per-chunk source, ASSEMBLED, provenance) | not run (needs ports 8554 / 8556, held by lane 2) | a case added to the development e2e (section 5) | `fence/__tests__/e2e/development-session-e2e.db.test.ts`, describe "wave H" | WRITTEN, typechecked, NOT RUN: test runner |
| G81-03: the Investigator's hint says "Requires the Supervisor role"; the Technician may change it too | YES, red: `Expected "Read-only: Requires the Supervisor / Technician role." Received "Read-only: Requires the Supervisor role."` | the hint names every role that holds `CAPTURE_CONFIG`, read from the one role table (`stt-config-model.ts:38` `rolesHoldingPermission`; `stt-config-section.tsx:149-150`), the wording the storage policy drawer already uses | `apps/core-web/src/test/live-system-stt-config.test.tsx` "INVESTIGATOR ..." (1 expectation) | DONE |
| C4 / R80-16: the three limits of the transcript step | n/a (a ruling) | none in code; stated as named settings with defaults (section 6) + README request line | - | for the controller |
| `M6-DF-1` / `M6-KR-1` proven on doubles only | n/a | none; what each needs and whether the speech source makes it drivable (section 7) | - | stated |
| Mobile STT status | not a finding: the card makes no role statement ("Read-only on this device. Change the transcription settings from the web console.", `apps/mobile/src/features/transcription/i18n.ts:15`); gate 81 passed it | none | - | no change |

## 2. What was built

**The source** (`apps/core-server/src/capture/adapters/local/mic-helper-args.ts`).
`MicSource` gains `{ kind: 'FIXTURE', path }` (:54). Its input section is
`-re -stream_loop -1 -f wav -i <path>` (:69): paced by the timestamps of the file, started again at
the end for as long as the session records, the demuxer stated and never guessed. Everything before
and after the input is the tone source's list, literal for literal - the output line is
`-vn -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -y <pipe>`. No argument is
`avfoundation`. The path is the THIRD computed value of the table and is held to one shape
(`isSpeechFixtureArgument`, :110): absolute, the directory characters of a pipe path, the fixed tail
`dev-fixtures/speech-mic/dialogue.wav`, no `..`, no `//`. It is built from the data directory and
two literals (`speechFixturePath`, :102): no value of the environment becomes an argument.
The brief named lavfi `amovie` or `-re -stream_loop`; the second was taken because `amovie` needs
the path escaped inside a filter graph, and a plain `-i` argument does not.

**The helper** (`mic-helper.ts:146` `assertSource`). A fixture is held to the SAME path rule as the
helper program (SEC35-43 (a)) at `prepare` and again at `start`: a file another local user could
replace is not played into a recording. Refusal: `OPEN_FAILED` / `FIXTURE_REFUSED` (one new reason
in `errors.ts`), before a pipe is made or a process is started.

**The setting and its fence** (`apps/core-server/src/capture/fence/fake-mic.ts`, new).
`fakeMicDecisionOf(config, operation, inspect)` (:76) is the only reader of `captureDevFakeMic`.

| Setting | Operation | Answer |
|---|---|---|
| `tone` (default, unset) | any | the tones, as before; the file system is not asked |
| `speech` | `REAL_DEVELOPMENT`, fixture usable | `SPEECH` + the fixture path |
| `speech` | `REAL_DEVELOPMENT`, fixture absent or failing the path rule | boot refusal `DEV_SPEECH_FIXTURE_UNUSABLE`, `Reason: NOT_FOUND` (or `NOT_A_FILE`, `FILE_OWNER`, `FILE_WRITABLE`, `DIRECTORY_OWNER`, `DIRECTORY_WRITABLE`, `PATH_SHAPE`); the message names `npm run capture:dev-setup` |
| `speech` | `REAL_PRODUCTION` or `SIMULATED` | boot refusal `DEV_FAKE_MIC_NEEDS_DEV_SOURCES` |
| any other value | - | `ConfigError CAPTURE_DEV_FAKE_MIC_INVALID` at the loader |

A refused answer carries the TONE and no path, so a reader that forgot `refusal` plays no file. The
boot step asks once (`fence/boot.ts:230-231`), after the flag refusals (a combination the flags
refuse keeps its own code) and before anything is read or written: a refused boot registers
nothing and writes no audit row. The outcome carries `fakeMic { source, fixturePath }` (:194, :254);
one log line `DEV_FAKE_MIC_SPEECH` is written per boot when it is on (:261), without the path. A
refusal names keys and codes only, never a path.

**Which microphone.** `buildDevelopmentRegistry` (`fence/index.ts:170`, input `speechFixturePath`,
wired at :414): the FIRST stored `FAKE` microphone (`MIC-01` of the seed, the primary) plays the
fixture in the place of its 440 Hz tone; every other one keeps its 880 Hz tone
(`generated-sources.ts`, option `speechFixture`). The device stays kind `FAKE`, source class
development: the manifest and the badges say what they said.

**The key** (`apps/core-server/src/config.ts:55`, `:199`, `:274`, `:306`, `:357`;
`plugins/config/load-config.ts:78`, `:111`). `config.ts` is frozen (P25): the lines are WAIVED lines
of the same category as the two keys of the fence, and the pin
(`src/capture/__tests__/static.test.ts`, `WAIVED_CONFIG`, the `ENV_` list 5 -> 6, the fence file
list + `fake-mic.ts`) moved by delta in the same change. Decision 1 below.

**The fixture** (`scripts/capture/speech-fixture.mjs`, new; called by
`scripts/capture/dev-setup.mjs` after the helper copy).

| Item | Value |
|---|---|
| Where | `.data/dev-fixtures/speech-mic/dialogue.wav` + `dialogue.reference.json`; directories 0700, files 0600; `.gitignore:70` (`/.data/`) |
| What | 9 turns of a two-speaker dialogue in Indonesian (the first nine turns of the row-12 script, `TWO_SPEAKER_SCRIPT`); mono, signed 16-bit, 48,000 Hz; 45.0 s of audio |
| Method | `/usr/bin/say -v Damayanti` (macOS, local; the one `id_ID` voice of this host) written to a file per turn; speaker B is the voice as it is, speaker A the same voice lowered in pitch by the helper FFmpeg (`asetrate` x0.82, tempo restored); 400 ms between turns, 600 ms at both ends. No network, no cloud TTS, no speech server, no recording of a person; nothing is played |
| Reference | `dialogue.reference.json`: every turn's text, the whole text, the method, the SHA-256 and size of the WAV |
| Kept or made | a fixture whose bytes equal its reference file is KEPT; `--renew-speech-fixture` makes it again; `--no-speech-fixture` skips the step. A fixture that cannot be made is reported and does not fail the set-up |
| Row-12 fixture | `.cache/spikes/stt-check/fixture-two-speaker-id.wav` still exists (sha256 `6743181a...`), and is NOT copied: it is 65.72 s (over the bound of the one engine run allowed here), 24 kHz, and its recipe was the speech server's voice cloning, which this wave may not call. The new fixture is REGENERATED with `say`; the two share the script, not the bytes |

Found while building: inside the command sandbox `say -o` exits 0 and writes a header with no
sample. The step refuses such a turn by name (`TURN_EMPTY`) instead of producing a silent fixture.
The fixture of this session was made with the sandbox off, by calling the step's own function, NOT
`npm run capture:dev-setup`: the full command also replaces `.data/helpers/ffmpeg`, the helper the
running lane 2 was started with, and the gate environment is not mine to touch. The whole command
is in the list for the test runner (section 8).

## 3. Real and stand-in

| Part | Real | Stand-in |
|---|---|---|
| Argument list of the speech source | checked literal by literal in tests; accepted by the helper FFmpeg in one short local run to a file under `.cache/wave-h-e/probe/` (a looped short file gave the expected sample count) | not yet started by the product in a session |
| Fence refusals | the pure decision and the boot step with the in-memory tables | not run against PostgreSQL (`fence.db.test.ts` has no speech case) |
| Registry | the real adapters with the scripted process door and a real `mkfifo` | no real helper process |
| Engine | real `whisper-cli` and real Silero VAD, on the CPU, once | outside a session: a decoded file, not the tap of the capture worker |

## 4. The one engine run (the engine half of `M6-TF-1`, outside a session)

Command, once, sandbox off, under the heavy-host lock:
`/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock npx vitest run --root apps/transcriber --config vitest.real.config.ts test/real/wave-h-speech-fixture.real.test.ts`
-> `Test Files 1 passed (1)`, `Tests 2 passed (2)`. Evidence:
`.cache/stt/checks/wave-h-e/runs/20261010T095642543Z-84699-wave-h-speech-fixture/evidence.json`.

| Fact | Value |
|---|---|
| Chunks planned | 2, both `DONE`; report `planned 2, decoded 2, failed 0, reused 0, remaining 0, complete true, transcriptState READY` |
| Segments | 9 (scripted sentences: 9); language `id`; VAD speech runs 9; no `vad_fallback` |
| Command the pipeline issued (chunk 1) | `/usr/bin/nice -n 10 <repo>/.cache/stt/whisper.cpp/build/bin/whisper-cli -m <repo>/.cache/stt/models/ggml-large-v3-turbo.bin -ng -t 8 -l id -oj -of <run>/engine-work/stt-<uuid> -f <run>/work/chunk-1.wav` |
| `-ng` | in every issued command (2 of 2); exit codes 0, 0; niceness 10, 10 |
| VAD command | `/usr/bin/nice -n 10 .../whisper-vad-speech-segments -f <run>/work/vad-window.wav -vm .../ggml-silero-v6.2.0.bin -t 1 -vt 0.5 -vspd 250 -vsd 98 -vmsd 30 -vp 30 -vo 0.1 -np`: no GPU switch |
| Words | matches the reference text except: nothing. 78 reference words, 78 heard words, 0 missing, 0 added (lower case, punctuation removed) |
| GPU / Metal | NO LOG LINE OF THIS RUN SAYS IT: the pipeline keeps the engine's standard error only as the tail of a FAILED run (`backends/cpu-local.ts`, `STDERR_TAIL_BYTES`), so a successful run leaves no engine text. What is shown instead: `-ng` on every command, and `otool -L` of the engine binary lists `libSystem.B.dylib` and `libc++.1.dylib` only - no Metal, CoreML or GPU library. The engine's own "use gpu" line is NOT quoted, because it was not kept |
| QA flag | `intervals_incomplete`: expected here and only here - a file outside a session has no audio-source intervals. In a session the flag must be absent (section 5 asserts it) |

## 5. The session case (written, NOT run)

`development-session-e2e.db.test.ts`, mode `SPEECH` (:105) and the describe "wave H" (:402),
guarded by `DEMS_DEV_SPEECH_SESSION_E2E=1`. The GENERATED run with `captureDevFakeMic: 'speech'`,
the fixture copied into the run's throw-away data directory, a host file naming the engine files
under `.cache/stt/`, and STT enabled on `cpu-local`; 30 s of recording. It asserts: the fence says
`SPEECH` and logs `DEV_FAKE_MIC_SPEECH` once; the item's transcript is `ASSEMBLED`; the sealed
`transcript.json` has `chunks > 0`, `segments > 0`, `failed_chunks 0`, language `id`, no
`no_speech`, no `intervals_incomplete`, intervals naming `MIC-01` only; every chunk the checkpoint
showed while it existed names `MIC-01`; model provenance complete (name, declared version,
quantisation, SHA-256); verify `PASS` with `transcriptState READY / ASSEMBLED`; operation 84
answers the same number of segments; the fragments of both camera files are numbered without a gap
or a repeat and no `CAPTURE_FAULT` is active. It writes numbers, codes and the list of heard words
the reference does not hold - no rate.

One honest limit of that case: the sealed document holds no per-chunk source (the form has
`intervals[]`, not a source per chunk); the per-chunk member lives in the checkpoint, which the seal
removes. The case therefore reads the checkpoint while it exists and also holds the absence of
`intervals_incomplete`, the flag the runner raises for exactly a chunk without one source
(`apps/transcriber/src/pipeline/runner.ts:304-312`).

## 6. C4 / R80-16: the limits of the transcript step, as named settings

`FINALIZE_TRANSCRIPT_LIMITS`, `apps/core-server/src/sealing/finalize-transcript/bounds.ts:64-68`
(and :58). Set in code; a caller may state others per call (`FinalizeTranscriptInput.limits`);
there is no environment key (`config.ts` is frozen). They are bounds chosen by row 119, not
measurements of an engine.

| Setting | Default | What it bounds |
|---|---|---|
| `stepLimitMs` | 1,800,000 ms (30 min) | the whole step: waiting for a finished transcript plus closing it out |
| `callLimitMs` | 30,000 ms (30 s) | one question to the transcriber; also the most a gap between two calls counts (a Core that was down does not spend the budget) |
| `closeOutLimitMs` | 120,000 ms (2 min) | the part of the step kept for closing out; the wait is `stepLimitMs - closeOutLimitMs` = 28 min |
| `closeOutAttempts` (count) | 3 | failures at the bound before the next call seals WITHOUT a transcript (`PARTIAL`, `TRANSCRIPT_UNAVAILABLE_AT_SEAL`) |

Not changed: the file is not this driver's, and a ruling needs a backlog that no gate has produced.
The speech source makes a backlog producible (a long recording on a busy host), so the ruling can
rest on an OBSERVED OUTCOME - did a session of the agreed length seal `ASSEMBLED` or `PARTIAL` -
without quoting a figure of the engine. Decision 3.

## 7. `M6-DF-1` and `M6-KR-1`: what each needs with the real engine

| Check | Proven today | What a proof with the real engine in a product session needs | Drivable at the re-gate with the speech source? |
|---|---|---|---|
| `M6-DF-1` no dropped fragment while STT runs | doubles (`capture-priority.test.ts`); `test:real:row77:df1` on an earlier tree, outside the product session | (1) a `REAL_DEVELOPMENT` session with `speech` and STT on `cpu-local`, long enough that the engine decodes WHILE the cameras record: the runner is stepped as the tap grows (`transcription/session-run.ts`, `final: false`), so a chunk is decoded once the VAD has closed a span - a recording of a few minutes, not seconds; (2) the proof that a decode overlapped the recording: a `whisper-cli` process seen while the session is `RECORDING`, or a checkpoint chunk `RUNNING` / `DONE` in that state; (3) then `recording_fragments` of the session: `seq` contiguous per track, no repeat, and no `CAPTURE_FAULT` active; verify PASS. One functional check, no figure | YES. The e2e case of section 5 already asserts (3) and records (2) as a fact (`decodeSeenWhileRecording`); with 30 s the overlap may not happen, so the gate should record longer |
| `M6-KR-1` chunk resume after a kill | doubles (`kill-resume.test.ts`); the real engine on the sealed fixture in `row77-cpu-local.real.test.ts` (earlier trees), outside the product | In the product the transcriber runs INSIDE the Core process and the engine is its child. So "kill the transcriber mid-session" is (a) SIGKILL of the Core while `whisper-cli` decodes chunk N >= 2 of a recording that already has a committed chunk, or (b) SIGKILL of the `whisper-cli` child alone. For (a): note the `transcript_chunks` rows and the checkpoint bytes of the committed chunk before the kill; restart the Core; expect the orphan engine reaped (engine guard, `transcription/session.ts`), the session taken through recovery, the seal's `availability` reopening the run from the snapshot and the checkpoint, the committed chunk byte-identical, no committed row decoded twice (one finished engine run per chunk row), and a sealed transcript. For (b): expect the chunk row FAILED with its code, a new row number for the retry, the session still sealing | (b) YES: with speech a chunk exists and the engine process can be found and killed. (a) PARTLY: a kill of the Core also kills the capture of that session, so the recording ends INTERRUPTED and what is proven is "resume after a Core kill", which is the product's real case; it needs the gate's own lane (a kill of the lane Core) and is not a driver's run. Neither was run here (brief) |

## 8. Commands and results (each once; a second run only after a fail)

| Check | Command | Result |
|---|---|---|
| Fence setting, helper, arguments | `npx vitest run --root apps/core-server --project unit src/capture/fence/__tests__/fake-mic.test.ts src/capture/adapters/local/__tests__/mic-helper.test.ts src/capture/adapters/local/__tests__/mic-helper-args.test.ts src/capture/fence/__tests__/fence.test.ts src/capture/fence/__tests__/open-sources.test.ts` | first run of `fake-mic.test.ts` before the code: 12 failed (red); with the code 135 passed, 2 failed - both mistakes in my own test (a default parameter; a control that booted production with development sources assigned); after the test fix `fake-mic.test.ts` 14 passed |
| Config loader | `npx vitest run --root apps/core-server --project unit src/plugins/config` | 46 passed |
| Capture static guards + `test/static` | `npx vitest run --root apps/core-server --project unit src/capture/__tests__/static.test.ts src/capture/adapters/__tests__/static.test.ts src/capture/adapters/local/__tests__/mic-static.test.ts test/static ...` | 295 passed, 4 failed, NONE mine: `capture/__tests__/static.test.ts` fence file list lacks `development-discovery.ts` (driver D's new file; `fake-mic.ts` is in the list); `test/static/credentials.test.ts` and `network.test.ts` name `src/evidence-export/receiver-cli.ts` (driver C1); `test/static/imports.test.ts` names `src/evidence-facts` (a new unit of another driver). The `config.ts` frozen-digest case PASSES with the waived lines |
| Web STT hint | `npx vitest run --root apps/core-web src/test/live-system-stt-config.test.tsx src/test/live-system-stt-secret.test.tsx` | red first (1 failed, the text above); after the fix 36 passed |
| Transcriber static + fixture provider | `npx vitest run --root apps/transcriber src/__tests__/static.test.ts src/__tests__/tts-fixture-provider.test.ts` | 120 passed |
| Real engine, once | section 4 | 2 passed |
| Typecheck core-server | `npx tsc --noEmit -p apps/core-server` | no error in a file of mine; errors of others in flight: `capture-session/__tests__/facts-fy.test.ts`, `sealing-host/__tests__/sealing-host.test.ts`, `db/reset/routine.ts`, `modules/evidence-export/__tests__/{download,routes}.test.ts`, `evidence-facts/index.ts`, `modules/evidence/__tests__/detail-facts.db.test.ts`, `packages/shared/src/sim/generator.ts` |
| Typecheck transcriber, core-web | `npm run typecheck -w @dems/transcriber`; `npx tsc --noEmit -p apps/core-web/tsconfig.app.json` | one error each, the same foreign one: `packages/shared/src/sim/generator.ts(27,15) TS2459` (driver A's file) |
| Lint | `npm run lint -w @dems/core-server`, `-w @dems/transcriber`, `-w @dems/core-web` | 0 errors; one foreign warning each in core-server (`db/reset/session-artefacts.ts`) and core-web (`session-monitor/interrupted-seal.tsx`) |

### Checks for the test runner

| # | Command | Lock / condition | Expected | Check |
|---|---|---|---|---|
| 1 | `DEMS_DEV_SPEECH_SESSION_E2E=1 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock /usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts` | sandbox off; ONLY when no real-capture Core is up (ports 8554 / 8556: lane 2 holds them now); needs the fixture, the built worker, `.data/helpers/ffmpeg`, the engine files under `.cache/stt/`; it starts the real engine on the CPU | the "wave H" case passes; `row140-result.json` in the run's data directory with `transcriptState ASSEMBLED`, `chunks > 0`, `segments > 0`, `chunkSourcesSeen` all `MIC-01`. The two older describes of the file stay skipped | `M6-TF-1` on `cpu-local` in a session; chunk sources; `M6-DF-1` (fragment numbering) |
| 2 | `npm run capture:dev-setup` then `npm run capture:dev-setup -- --renew-speech-fixture` | from a Terminal of the logged-in user (inside the command sandbox `say` writes no audio); ONLY when lane 2 is stopped (it replaces the helper copy) | first: `speech  kept ...`; second: `speech  created ...`, 45 s, mode 0600; `git status --porcelain` shows no file under `.data/` | the set-up step end to end |
| 3 | `/usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db src/capture/fence/__tests__/fence.db.test.ts src/capture/fence/__tests__/development-session.db.test.ts` | sandbox off | as before this wave (the outcome gained one member; both use `toMatchObject`) | regression of the fence with PostgreSQL |
| 4 | the core-server unit project and `test/static`, once per commit | - | the four foreign failures above gone once D and C1 have moved their pins | - |

## 9. Gate checks to re-drive on a device / browser because of this change

1. **C1 / `M6-TF-1` on `cpu-local`, lane 2**: `npm run capture:dev-setup` (lane 2 stopped), start
   lane 2 with the speech microphone (`--speech-mic` once driver D has added it; until then
   `DEMS_CAPTURE_DEV_FAKE_MIC=speech scripts/lane/lane.sh start 2`, never exported), check the log
   line `DEV_FAKE_MIC_SPEECH`; one STT-enabled session of a few minutes on the FAKE sources; then
   non-empty segments, the `-ng` command (process table while it decodes), no
   `intervals_incomplete`, fragment `seq` contiguous, verify PASS.
2. **C2 revisions** on that item (web and tablet): the first item of lane 2 with a segment.
3. **Boot refusals, live**: lane 2 with `speech` and the fixture moved aside ->
   `DEV_SPEECH_FIXTURE_UNUSABLE`, no listener; lane 1 (simulated) with `speech` ->
   `DEV_FAKE_MIC_NEEDS_DEV_SOURCES`.
4. **G81-03, web**: System & Maintenance > Transcription (STT) as INVESTIGATOR: "Read-only: Requires
   the Supervisor / Technician role."; as TECHNICIAN the controls stay enabled.
5. **No-speech wording** (driver C2's): a tone-microphone session still seals with zero segments;
   the speech session must NOT show the no-speech line.
6. `M6-DF-1` and `M6-KR-1 (b)` as in section 7, if the gate takes them.

## 10. Decisions for the controller

1. **A waived edit of the frozen `config.ts`** (one key, `DEMS_CAPTURE_DEV_FAKE_MIC`) and of
   `load-config.ts`, with the pin moved in the same change. Taken because the brief asks for an
   environment form fenced like `DEMS_CAPTURE_DEV_SOURCES`, and the capture folder may not read the
   environment. The alternative that leaves `config.ts` alone is a file in the data directory (the
   pattern of `transcriber/host.json`, D-115-1); it was not taken: the data directory is shared by
   every lane, so a file would switch the speech microphone on for every development Core and stop
   a production Core of the same installation. To confirm, and to give the waiver its number.
2. **Only the first test microphone plays speech.** The standby keeps its tone, so a switch of the
   audio source during a session ends the speech. If the re-gate wants speech on both, it is one
   line of `buildDevelopmentRegistry`.
3. **R80-16**: confirm the four defaults of section 6 as they are, or name the session length that
   must still seal `ASSEMBLED` on the Core device and let a gate observe the outcome.
4. **The fixture is regenerated, not the sealed row-12 file.** `M6-TF-1`'s text says "on the sealed
   two-speaker fixture"; a product session cannot play that file as it is (24 kHz, made through the
   speech server). If the gate must use the sealed bytes, the set-up needs a conversion step and a
   ruling that a resampled copy still counts as "the sealed fixture".
5. **The fixture's content is checked by the path rule only, not by its bytes.** A file at the path
   that is not WAV audio passes the boot and fails at the session start as a lost microphone
   (`-f wav` refuses it). Holding the bytes to the reference hash at boot would need a file read in
   the capture folder, which its static rule forbids outside the inspector.
6. **The engine's "no GPU" line is not kept by the product** on a successful run (section 4). If
   the gate must quote it from a product run, the transcriber needs to keep one line of the
   engine's start text: a change of `apps/transcriber/src/backends/cpu-local.ts`, not made here.

## 11. Not done

- The session case (section 5) and the full set-up command were not run (ports and the live helper
  of lane 2). Nothing else of the brief is open.
- `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were
  not written: the brief asks for this note and the progress file, and the driver rules reserve the
  shared trackers for the controller.

---
*Generated: 2026-10-10 17:10 WIB*
