---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 63
milestone: M3 (checkpoint)
date: 2026-10-10
agent: senior-code-reviewer
tier: 2
artifact_type: code review (gateway check)
baseline: git diff 9d3a1ef..abf742f (tree at abf742f)
status: complete
gate_criterion: "0 Blocker / Major open" is NOT met - 3 MAJOR open (R63-01, R63-02, R63-03)
---

# 16 - M3 code review (blueprint row 63)

Reviewer only: no product or test file was changed; this file is the only file written.
Count line: **BLOCKER 0 / MAJOR 3 / MINOR 12 / NOTE 5**

## 1. What was reviewed, and how

| Item | How |
|---|---|
| Worker C sources | Read in full: `worker.h`, `sink.c`, `ingest.c`, `capture_worker.c`, `ipc.c`, `anchor.h`, `anchor.c`. `audio.c`: the lines that carry T0, the switch, the fan-out, the stall cut, the tap and the fatal paths (grep), not the whole file |
| Core capture unit | Read in full: `supervisor.ts`, `ipc.ts`, `index.ts`, `forwarder.ts`, `fragments.ts`, `boot/{checks,index,worker-probe,evidence-volume}.ts` |
| Protocol | `packages/capture-protocol/src/index.ts:100-951` read in full |
| Fragment store | `modules/recording-fragments/{index,statements}.ts` read in full |
| Static rules | `check.sh`, `Makefile`, `test/static/{pinned_calls.py,pinned-calls.tsv,libavformat.pin}` read in full; `capture/__tests__/static.test.ts` P25 pins (lines 451-662); the diff of `apps/core-server/test/static/**` |
| Frozen files | `git diff 9d3a1ef..abf742f -- app.ts config.ts index.ts` line by line against spec §I |
| Notes | `implementation/20`, `21`, `23`, `24` (capture part), `97`, `108`; `test/03`, `test/05`; decisions D24, D85, D126, D127, D130, D136, D142, D144, D167 |
| Read-only runs | (a) the protocol schema on four sample frames (`node --experimental-strip-types`); (b) the production supervisor + forwarder in memory with a fake launcher (`node --import tsx`, no process, no port, no database); (c) `check.sh` `rules()` and `pinned_calls.py` over temporary copies of `src/` in `$TMPDIR`, with a positive control; (d) `clang -fsyntax-only` on two of those copies. No suite, no e2e, no device, no port |

Ownership area `src/capture/boot/**` of the task text does not exist at the repository root; the folder is `apps/core-server/src/capture/boot/**` and was reviewed there.

## 2. Verdict per area

| # | Area (row) | Verdict | Findings |
|--:|---|---|---|
| 1 | Worker proofs (111) | PASS (limited: the vendored skeleton is a negative control and was not read) | - |
| 2 | Supervisor + IPC + seam (57) | PASS WITH FINDINGS | R63-01 (MAJOR), R63-04, R63-05 |
| 3 | Worker, engine seam, forwarder (58, 71a parts in scope) | PASS WITH FINDINGS | R63-03 (MAJOR), R63-10, R63-11, R63-13, R63-18 |
| 4 | fMP4 writer, chains, tail validation, fragment store (59) | PASS WITH FINDINGS | R63-02 (MAJOR), R63-09, R63-17 |
| 5 | Fixtures and the e2e target (60) | PASS WITH FINDINGS (harness verdict logic read; fixture bodies not) | R63-15, R63-19 |
| 6 | Static rules + boot checks (61) | PASS WITH FINDINGS | R63-04, R63-06, R63-07, R63-08 |
| 7 | Instrumentation (62) | PASS WITH FINDINGS for the capture half (clock rules, SR camera use); the mobile late-stop half is outside the scope paths and was NOT reviewed | R63-12, R63-16 |
| - | P25 edits against OD-14 | PASS WITH FINDINGS: every added line is inside one of the four waived categories; the record of the waiver is out of date | R63-14 |
| - | Worker-form decision record against the ready-made-frameworks rule | PASS: the form is the user's own answer Q-WORKER (a) (D24); FFmpeg's API is the kit, SHA-256 is libavutil's, the protocol schema is zod | R63-20 (NOTE) |

## 3. Findings (sorted by severity)

### MAJOR

| ID | File:line | What is wrong | Evidence | Smallest fix (owner) |
|---|---|---|---|---|
| **R63-01** | `apps/core-server/src/capture/supervisor.ts:499-506`, `:900-903`; effect at `apps/core-server/src/capture-session/index.ts:951-962` | **A stop cannot tell a clean worker exit from a failed or killed one.** Once `stopping` is set, `afterDown` goes straight to `finishStop()`: no `workerDown` event, `lastCrash` not set, `stop()` resolves void. A worker that ends `CRASH` / exit 70 while it closes (a failed final sync, `OUTPUT_CLOSE_FAILED`, a failed last write that was truncated back, `SHUTDOWN_STUCK`), or that the supervisor itself SIGKILLs after `stopGraceMs` (5 s) before the open fragment was flushed, is reported exactly like exit 0. The session unit then says `STOPPED` and the recording goes to a normal seal with its last fragment(s) missing or never synced, not marked interrupted | In-memory run of the production supervisor: `stop()` while the worker sends `CRASH WRITER_SYNC_FAILED` and exits 70 -> events `["phase:STOPPING","phase:IDLE"]`, `lastCrash: null`. No test of `supervisor.test.ts` / `liveness.test.ts` asserts the opposite (the code has no branch for it) | In `afterDown`, when `stopping !== null` and the cause is not (exit code 0, no signal, no `CRASH`): set `lastCrash` and emit `workerDown` with `restartInMs: null` before `finishStop()`; `capture-session` maps that to `INTERRUPTED` instead of `STOPPED`. Add the two tests (CRASH during stop; kill at the grace). Owner: supervisor (row 57 area) + row 71b |
| **R63-02** | `apps/capture-worker/src/sink.c:77`, `:560-564` (the only size bound: 256 MiB of pending bytes); `apps/capture-worker/src/ingest.c:326-340` (the only forced cut: a STALLED camera); `apps/core-server/src/sealing/pipeline/pipeline.ts:337` (where it fails) | **Nothing during a recording holds a fragment under the verifier's 64 MiB bound; the first notice is a refused seal of the whole session.** The worker writes, syncs and checkpoints any fragment up to 256 MiB; neither the worker, the supervisor, the recorder nor the forwarder compares `len` with `VERIFY_MAX_OPEN_FRAGMENT_BYTES`. A camera whose video flows is never cut "whatever its GOP" (`ingest.c:328`). See carried question 2 for why the "64 times below" arithmetic is not a guarantee | D167 itself: four kill cells ended at `FRAGMENT_TOO_LARGE` with 98-108 MiB fragments the worker had written without a word. `grep` for the bound in `src/capture`, `capture-session`, `recording-fragments`: no hit | Either (a) worker: the bound as a named setting; a fragment above it is refused before the write (`WRITER_FRAGMENT_TOO_LARGE`, exit 70) so the session ends FAULTED with a sealable durable prefix (OD-08) instead of an unsealable whole; or (b) Core only, no worker change: `capture-session` raises a fault at the first `FRAGMENT_CHECKPOINT` whose `len` is above the bound, and a warning at half of it. (a) is the safer of the two; a forced cut below the bound (`av_write_frame(ctx, NULL)`, as W-3 already does) keeps even that session whole and needs a ruling on fragments without a keyframe. Owner: row 59 area + protocol |
| **R63-03** | `apps/core-server/src/capture/forwarder.ts:318`, `:373-374`, `:294`; `apps/core-server/src/capture/index.ts:155-159`; `apps/capture-worker/src/ingest.c:240-244`, `:567` | **The long-keyframe-interval warning and the clock-near-bound flag reach no operator.** The forwarder drops the advisory `WARNING` (`:318`); what remains is a `notice`, which the capture unit writes to the log and the persistent error log only. The shared model has the two advisory alerts (`packages/shared/src/sim/capture-notices.ts:69-74`, D144 (4)), and the forwarder raises only the third (`MIC_RATE_AT_LIMIT`). In addition the `KEYFRAME_INTERVAL` record is written only when an interval COMPLETES or the ingest ends, so in the worst case - one long open interval, nothing of that camera durable (AU2-08: 0 s of durable media) - not even the log notice exists while it matters | `grep -rn "CaptureAdvisoryReason\." apps/core-server/src`: two hits, both `MIC_RATE_AT_LIMIT`. Q-GOP (a) as approved by the user (D24): "warning when exceeded"; D142 (4): "71b shows a warning" | In the forwarder, treat `KEYFRAME_INTERVAL_ABOVE_BOUND` like `advise()` does the microphone rate: raise the named advisory alert at the `ACTIVE` warning (which the worker sends the moment the open interval passes the bound, `ingest.c:235-239`), and raise `AV_OFFSET_NEAR_BOUND` from the `nearBound` level. Owner: row 71b (forwarder) |

### MINOR

| ID | File:line | What is wrong | Evidence | Smallest fix (owner) |
|---|---|---|---|---|
| R63-04 | `apps/core-server/src/capture/supervisor.ts:598`; `apps/core-server/src/capture/boot/checks.ts:195-212` | The version ALLOWLIST is applied at boot only. A session's `HELLO` (first start and every restart) is held to the protocol version and the `-PROOF` mark, not to `RELEASE_WORKER_VERSION`. The comment "ONE rule for the boot check and for the supervisor's handshake" (`checks.ts:203-206`) is not what the code does; D138 lists the allowlist without that limit | In-memory run: `HELLO "capture-worker/0.4.0+negctl"` -> boot rule `CAPTURE_WORKER_VERSION_UNKNOWN`, supervisor `started`, phase `RECORDING` | Call `workerVersionRefusalOf(message)` at `supervisor.ts:594-603` (one rule, as the comment says). Owner: row 61 / 71b |
| R63-05 | `packages/capture-protocol/src/index.ts:432`, `:583-595`, `:640`, `:722`, `:779`; `supervisor.ts:663-665`, `:713` | Members the Core accepts and does not validate (carried question 8). `id` is "any string of 1 to 128 characters". `TELEMETRY.levels/ingest/fragments/clocks[].deviceId` are not held to the plan (only `WARNING.subject` and `RECORD.deviceId` are), go to the engine, and - with `nearBound` or `ratePpm` at the limit - into the log and the persistent error log as `deviceId`; the `noticed` set (`forwarder.ts:194`, `:279-288`) grows by one entry per distinct ID until the next session. `CRASH.signal` is free text of 16 characters and is logged (`index.ts:170`). `AUDIO_SOURCE_INTERVAL.correlationId` of a switch nobody commanded is accepted and handed on. `FRAGMENT_CHECKPOINT.keyId` is free text | Schema run: all four sample frames decode `ok: true`. Supervisor run: a `TELEMETRY` frame with `clocks[0].deviceId = "rtsp://admin:pw@10.0.0.5/live"` -> phase stays `RECORDING`, notice `{"code":"CAPTURE_CLOCK_NEAR_BOUND","deviceId":"rtsp://admin:pw@10.0.0.5/live"}`. Precondition: a worker that misbehaves (the worker builds these from the plan's validated IDs); same class and same rating as pair-57 N-3 | `id` gets the worker's own character class (`[A-Za-z0-9._:-]`, `ipc.c:398-405`); the supervisor refuses telemetry that names a device outside the plan (`WorkerDownCode.PROTOCOL_VIOLATION`), and an `OPERATOR_SWITCH` interval whose `correlationId` is no waiting command; `signal` becomes `/^SIG[A-Z0-9]{1,12}$/`. Owner: protocol + supervisor |
| R63-06 | `apps/capture-worker/src/ipc.c:253`; `apps/capture-worker/Makefile:37`, `:52-54`; `check.sh:118-128` | The `-PROOF` mark hangs on ONE macro (`DEMS_PROOF_MUX_EXTRA`). The other switches (`DEMS_PROOF_KEEP_TORN_TAIL`, `DEMS_PROOF_NO_REFUSAL_EXIT`, `DEMS_PROOF_WRITE_FAULT`, `DEMS_PROOF_INTERVAL_SKEW`, `MIC_MAX_PPM`, `DEMS_MOVFLAGS`, `DEMS_VERIFIED_LAVF_VERSION_INT`) do not mark anything by themselves; `proof_rule` checks the Makefile's lines only. `CFLAGS ?=` takes the environment, so `CFLAGS='... -DDEMS_PROOF_KEEP_TORN_TAIL' make` yields `build/capture-worker` that says `capture-worker/0.4.0` | By inspection of the three places named; not built | In `worker.h`: define `DEMS_PROOF_BUILD` when ANY of those macros is defined and use it for the mark; `CFLAGS :=` for the release target. Owner: row 61 |
| R63-07 | `apps/capture-worker/src/ingest.c:58-61`; `Makefile:52-54`; `check.sh:231` | The libavformat pin holds at compile time (headers) and at `make` / `make check` / `make proof`; it is not held when the program RUNS. The worker links Homebrew's shared library (D108 states that); after an upgrade with the same major version the same binary runs on another libavformat with no refusal. `av_version_info()` is only logged (`capture_worker.c:233`). `make build/capture-worker` skips `check.sh` (stated in note 23 §4.6) | `grep -rn "avformat_version" apps/capture-worker/src`: no hit | One line in `main`: `avformat_version() != LIBAVFORMAT_VERSION_INT` -> exit before `HELLO` (or the version in `HELLO` and the boot rule). Make `$(BIN)` depend on `check`. Owner: row 61 / 71a |
| R63-08 | `apps/capture-worker/test/static/pinned_calls.py:30-36`, `:46-55`, `:70`, `:113` | Four evasions pass BOTH nets (spelling rules and pinned calls) and are not among the stated limits: a token paste written as the digraph `%:%:`; an alias through an assembler label (`__asm__("_open")`) with numeric flags; another muxer name in the `ARGS_FREE` call `avformat_alloc_output_context2` (`"segment"` opens its own files, so "the worker hands libavformat no file name" is not held by any rule); `removefile()` (not in `FILE_MAKING`) | Temporary copies of `src/`, `rules()` of `check.sh`: control `open(p, O_WRONLY \| O_TRUNC)` -> rc 1 (D58-1, R-6); `digraph`, `asmlabel`, `fmt`, `removefile` -> rc 0, 0 messages each. `clang -std=c11 -Wall -Wextra -Werror -fsyntax-only` accepts the digraph and the label copies (rc 0) | A ready-made, spelling-independent net beside the tokenizer: pin the IMPORTED SYMBOLS of the built binary (`nm -u build/capture-worker` against a list; `_open`, `_removefile`, `_creat` ... appear whatever the source spelling). Pin the third argument of `avformat_alloc_output_context2` to `"mp4"` and the fourth to `NULL`; add `%:%:` and `__asm__` / `asm` to the refused tokens; add `removefile` to `BANNED`. Owner: row 61 |
| R63-09 | `apps/capture-worker/src/sink.c:302-320`; `apps/core-server/src/capture/boot/evidence-volume.ts:100` | The sync level that is reported is the compile-time one. When `F_FULLFSYNC` answers `ENOTSUP` / `EINVAL` / `ENOTTY`, `full_sync` silently uses `fsync()` (on macOS: not through the drive cache) while the log line and `session_starting.sync` still say `F_FULLFSYNC`, and `durableAt` is claimed the same way. The boot probe uses Node's `fsyncSync` and cannot tell either | By inspection | Remember that the fallback ran (one flag), report the level actually used; decide whether real capture may run on such a volume at all (a boot refusal is the stricter choice). Owner: row 59 / 61 |
| R63-10 | `apps/capture-worker/src/ingest.c:405`, `:427`, `:473-474` | The allowance of the clock sanity bound at anchoring counts from AFTER `avformat_find_stream_info` and `open_output` (`opened_mono`, `:427`), but the packets it is meant for waited inside libavformat DURING that probe (`:405`). The comment at `:427` says the opposite ("waited at most since now"). A camera with a correct clock whose probe takes more than 2 s is refused with `CAMERA_CLOCK_OUT_OF_BOUND` and lost for the session | By inspection; NOT reproduced (the fixtures probe fast). A probe that long is plausible for a low frame rate or a late first sender report | Take the reference before `avformat_find_stream_info` (after `avformat_open_input` returned). Add a slow-probe case to the SR camera fixture. Owner: row 71a |
| R63-11 | `apps/capture-worker/src/ingest.c:546-548` | The monotonic guard rewrites timestamps without a word: `dts <= last_dts` -> `last_dts + 1`, then `pts < dts` -> `pts = dts`. No counter, no log line, no record. For a stream with B-frames whose `dts` libavformat does not supply (the fallback `dts = pts`), or with repeated RTP timestamps, presentation times are moved forward and nothing says so. Every fixture and the local helper encode with no B-frames (`fake_cam.c:61`, `camera-helper-args.ts:53-54`), so no check exercises it | By inspection; behaviour of libavformat 9.0.2 for B-frame RTP input not determined | Count the packets the guard changed (`v_retimed`), log the first and the total in `camera_summary`; treat a non-zero count on a production source as a warning. A B-frame fixture decides whether more is needed. Owner: row 71a / 60 |
| R63-12 | `apps/capture-worker/src/ingest.c:454`, `:499-510`; `apps/capture-worker/test/anchor_test.c:144-175`; `apps/capture-worker/test/m3worker.py:1633` | The clock floor is proven on the pure rule only (D142 says so); the WIRING in the ingest is exercised by no check. `anchor_test.c` re-implements "what the ingest does" (`judge`), and the only e2e offset case is 10 s, which is refused at anchoring (`:474`) before the floor is ever asked. Removing `ingest.c:500-510` would turn no check red | The files named. The fixture already has the lever: `fake_cam_sr.py:148` `--clock-offset-ms` | Two e2e cases through `srcam`: offset -2,600 ms with a delayed first hand-over (must be given up by the floor, `rule: floor` in the log), and the stalled camera with a correct clock (must be kept). Owner: row 62 / 71a |
| R63-13 | `apps/capture-worker/src/ingest.c:441`, `:536-544`; `packages/capture-protocol/src/index.ts:670-675`; spec `05_capture_architecture_spec.md:1069-1076` | `skippedSpanMs` understates what was not written whenever untimestamped packets lead: they are counted (`noTimestamp`) and carry no duration, so a camera whose first sender report comes seconds after PLAY reports a short span for a long hole. The session unit persists the span as the amount (`capture-session/index.ts:552-557`). And §C.4 describes a keyframe BEFORE T0; the measured case (D130: "1 without timestamp + 29 before start") is video AFTER T0 that is lost because its first keyframe had no timestamp - a different cause the spec does not state | D130; the lines named | Add an arrival-based span (monotonic time from the first skipped packet to the first written one) beside the camera-time span; one erratum sentence in §C.4 for the timestamp-less first keyframe. Owner: row 71a + spec |
| R63-14 | `apps/core-server/src/app.ts:17-21`; `apps/core-server/src/capture/__tests__/static.test.ts:478-518`; spec §I `:1314`, `:1343` | The record of the P25 waiver is behind the code. `app.ts` has 29 added lines (21 of code); spec §I still says "14, all landed" and "planned 18"; edits 19-22 (D114) are in the header but not in §I; the four registrations of `modules/evidence-export`, `media-stream`, `transcripts`, `sealing` (8 lines) have no edit number, no header line and no §I row - their authority (D140, D143, D146, D147 (E)) is quoted only in comments of the pin test. Row 63's acceptance text "12/12" is three revisions old. All 29 + 69 + 2 lines ARE inside OD-14's categories (module registration, the seam, configuration keys, supervisor start / stop); no stage, route, boot order or existing seam changed | `git diff 9d3a1ef..abf742f --numstat`: `app.ts` 29 / 0, `config.ts` 69 / 0, `index.ts` 2 / 0; every `+` line read | Spec §I erratum: edits 15-18 landed, 19-22 and 23-30 listed with their decisions; one header line in `app.ts` for the four M6-M8 modules (itself a waived line, pin moved by delta). Owner: spec owner + the row that next touches the pin |
| R63-15 | `test/03_worker_e2e_wave_e.md:19-21`; `implementation/108_integration_pass_e2.md:7-8`, `:46`; `test/05_checkpoint_wave_de_suites.md:20-22` | No whole run of the capture e2e target with exit 0 exists for the committed tree. `waveE_full`: 113 checks, exit 1 (27 without a verdict); `waveE_fix`: the 31 affected checks once, exit 0; the series is now 117 checks; the checkpoint suite run has `check`, `selftest`, `unit` and not `e2e`. Every check has ONE expected verdict across the two runs, on a harness that changed between them | The three files named | One whole `make -C apps/capture-worker e2e` at `abf742f` on a quiet host, ports away from the fake ONVIF stub (note 108 §"Port assignment"). Owner: gate row 64 / test runner |

### NOTE

| ID | File:line | Note |
|---|---|---|
| R63-16 | `apps/capture-worker/src/ingest.c:500-510`, `:326-340` | A camera given up by the floor (or one that anchored inside the allowance and is refused a second later) has up to 1 s of video placed at a wrong time in its file; the stall cut then makes that fragment durable and the file keeps receiving the session audio. The worker says `CAPTURE_FAULT / CAMERA_CLOCK_OUT_OF_BOUND`. Whether the manifest marks such a track is not visible in this scope: question to the reviewers of rows 82 / 83 |
| R63-17 | `modules/recording-fragments/index.ts:31-34`; `capture/index.ts:27-32`; `capture/ipc.ts:144-147` | Three headers describe a state that is over ("Nothing mounts it yet", "no unit persists them yet", "This build has none yet"). `capture-session/index.ts:742` mounts the recorder. They will mislead the next reader |
| R63-18 | `apps/capture-worker/src/capture_worker.c:151`, `:371`, `:370` | `gop_frames` is parsed from the plan and read nowhere. `--listen-timeout-s` is a second spelling of the ingest-open window, parsed with `atoi` (so is `--heartbeat-ms`), while the four named settings use the strict `whole_number` |
| R63-19 | `apps/capture-worker/test/m3worker.py:461-471` | Row 60's `playable()` lets the null muxer re-time video to the nominal rate. It will print the same lines for any production camera that is itself variable-rate (carried question 1). The pass-through form already exists (`adapters/local/__tests__/e2e/local_camera_e2e.py:177`): use it for the timestamp judgement, keep the count of close pairs as a number |
| R63-20 | `apps/capture-worker/src/ipc.c:270-405`; `test/static/pinned_calls.py:82-119` | Two hand-written parts where a kit exists - the JSON reader (135 lines) and the C tokenizer - are not recorded as decisions under the ready-made-frameworks rule (note 20 names the reader in a table, without the reason "no install"). The tokenizer is the part that missed the digraph and the label (R63-08); the import list of the linked binary is the ready-made answer there |

## 4. Carried questions

### Q1 - "non monotonically increasing dts" and production cameras (D130 / D136)

**Not a defect of the worker's timestamps; the lines are made by the check.** Evidence:

- The worker places every video packet at `rescale(p->pts) + shift` in the INPUT stream's time base (`ingest.c:267` `c->ov->time_base = is->time_base`, `:517-518`). No grid, no rounding to a frame period. The files have a 90,000 Hz video timescale (the analysis divides packet times by 90.0, `local_camera_e2e.py:179`), and intervals of 0.1 ms survive into the file (`implementation/97_integration_pass_d3.md:89-95`: "intervals 0.1 / 33.33 / 71.52 ms").
- Arrival time is not used for placement at all: it feeds the clock floor and the trend only (`ingest.c:454`, `:499`, `:513`). RTP or network jitter cannot move a frame. The slew of the anchor is at most 500 us per second of media (`anchor.h:12`), about 17 us per frame at 30 fps.
- The lines come from `ffmpeg -i <file> -map 0 -f null -` (`m3worker.py:463`): the program re-times decoded video onto the nominal frame rate for the null muxer, and two frames closer than half a nominal period land on one tick. The same file decoded with `-fps_mode passthrough -enc_time_base demux` is held to zero lines (`local_camera_e2e.py:177`, `:181`). 16.67 ms is half of 1/30 s; for a 25 fps file the threshold is 20 ms.

So a production camera raises the lines only if ITS OWN consecutive RTP timestamps are closer than half its nominal frame period - a variable-rate or bursting camera - and then the check is wrong for it, not the file (R63-19). The one place where the worker itself can make two samples 1 tick apart is the monotonic guard (`ingest.c:547`), which fires only on timestamps that repeat or go backwards (R63-11).

### Q2 - no fragment-size cap (F-82c-2, D167)

**The arithmetic is right; as an argument that the bound cannot be reached it is not sound.** "4 Mbit/s x 2 s" needs two facts, and the code holds neither:

| Factor | What bounds it in the worker / plan | Evidence |
|---|---|---|
| GOP duration | Nothing. On stream copy the camera sets it (spec §C.1, "DEMS cannot enforce"); setting `GovLength` is class C. `gopFrames` of the plan is read nowhere (R63-18). `fragmentTargetMs` is used for the advisory warning and the stall cut only. A camera whose video flows is never cut (`ingest.c:326-340`) | `grep -n "gop_frames\|fragment_target_ms" apps/capture-worker/src/*.c` |
| Bitrate | Nothing. No member of the plan, no check, no telemetry of bytes per second | protocol `CapturePlanConstantsSchema` (`index.ts:483-490`) |
| Fragment bytes | 256 MiB of pending memory (`sink.c:77`), four times the verifier's bound; above it `WRITER_NO_MEMORY`, exit 70 | `sink.c:560-564` |

The bound is reached at bitrate x GOP = 512 Mbit: 8 Mbit/s x 64 s, 16 x 32, 25 x 20. That is outside a 2 s camera and inside what cameras with long or adaptive keyframe intervals and 4K streams are configured to; the project's own fake camera did it (98-108 MiB, D167), and AU2-08 already measured a 10 s camera-like GOP. Between 64 and 256 MiB the worker records, syncs and checkpoints every fragment and the session is lost at the seal.

**Yes, it should act during recording** (finding R63-02): detection costs one comparison per fragment, and the consequence of not detecting is the worst one this product has - a whole interview that cannot be sealed, learned after the interview.

### Q3 - the unwritten first group of pictures (D142 (2)) and `skippedSpanMs` on restart option C

**The reading is right about the outcome and the bound, and loose about the cause.** A camera file begins with the first keyframe that can be placed at or after T0 (`ingest.c:519-529`); what came before is not written; the bound is one camera GOP. That matches §C.4 "held first frame - up to one GOP" and its row "Not available: start the file on a keyframe with an aligned first dts". But §C.4's text is about a keyframe from BEFORE T0. The measured case is different: D130 reads "1 without timestamp + 29 before start" - the camera's first keyframe arrived AFTER T0, before its first sender report, so libavformat handed it over without a time (`ingest.c:441`) and the 29 frames behind it could not start a file. That is delivered post-T0 video that is not recorded, and it grows with the camera's GOP (10 s on an AU2-08 camera). It is reported honestly in `FIRST_VIDEO_SAMPLE.skipped`; the spec should say it (R63-13).

`skippedSpanMs`:
- **On restart option C it is correct.** A restart is a new process (`supervisor.ts:717-741`), so every counter and `first_skipped_pts_us` start fresh; the supervisor's once-per-camera set is per worker (`:169`, `:728`), so the second `FIRST_VIDEO_SAMPLE` is accepted; the session unit keeps the newest per device (`capture-session/index.ts:553`, a `Map.set`). The record of the worker that wrote the file is the one that is kept. A restart exists only before any durable fragment (`supervisor.ts:518`), so no file of the earlier worker is at a final name.
- **In general it understates** when untimestamped packets lead (R63-13): the span starts at the first skipped packet that HAD a timestamp.
- Not in it, by construction: the time between the first worker's T0 and the second worker's T0. Each worker has its own audio timeline; nothing in this scope reconciles the operator's start instant with the T0 of the worker that finally recorded.

### Q4 - can a camera 2-3 s behind still be anchored wrongly? (D142 / row 71a)

**Above 2.0 s behind: no, by the code as read. Up to 2.0 s: yes, silently, by design. Neither is proven end to end.**

- Lag = arrival - camera time. A delay only adds to it, so for a clock behind by `d` every packet has lag >= `d`. The floor is the minimum over every packet since the ingest opened, including those before T0 (`ingest.c:454`) and after anchoring (`:499`); it is judged once, without allowance, on the first armed packet at least 1 s after the stream opened (`:500-510`, `anchor.c:99-101`). With `d` > 2,000 ms no packet can bring the floor inside the bound: the camera is given up. Where anchoring happens right after the probe the allowance is near zero and the camera is refused at `:474` already.
- What can still go wrong for `d` > 2 s: up to 1 s of video placed at the wrong time before the judgement, which stays in the file (R63-16); and the wiring is covered by no check (R63-12) - the answer above is a reading, not a measurement.
- For `d` <= 2,000 ms (or a clock ahead by as much) the camera is anchored `d` away from the truth and nothing is raised: `trend_near_bound` sees only movement since its own baseline (`anchor.h:58-62`). The bound is a gross-error bound, 50 times the +-40 ms product tolerance; inside it correctness rests on the camera's clock being disciplined (H-7, class C). That is stated in `anchor.h:81-83`; it should be read as "the worker does not protect the AV tolerance against a camera clock offset under 2 s".
- A separate risk in the other direction: a correct camera refused because the allowance is counted from the wrong instant (R63-10).

### Q5 - the durability point, the thread hand-over, truncate-and-exit-70 (row 59)

**Confirmed.**

- Writing thread (under the camera's mutex): `append_fragment` computes the digests, writes (`sink.c:482` / `:490`), advances `bytes` and the chains, then `enqueue` (`:501`) - always after the write returned.
- Sync thread: takes the whole waiting list under `sync_mx` (`:379-383`), then `full_sync` (`:388`). Every job of the batch was written before the batch was taken, so the sync started after each of those writes. For the first fragment: data sync, `link()`, `sync_dir`, `unlink` (`:389-394`). Only when all of it returned 0 are `durable_at_ms` taken and `on_durable` called, in fragment order (`:399-409`); on a failure no checkpoint is given and `fatal` is raised (`:395-398`, `ingest.c:191-194`).
- `on_durable` is `cam_fragment_durable` (`ingest.c:164-188`): it sends `FIRST_DURABLE_FRAGMENT` (once, `:167`) and `FRAGMENT_CHECKPOINT` through `send_record`, which takes the sequence number and the place in the output under one mutex (`capture_worker.c:81-84`); frames of the lossless class are never dropped (`ipc.c:162-182`).
- At a stop: `cam_close` -> `sink_close` joins the sync thread, which drains what waits (`sink.c:579-589`, `:384`); `ipc_stop` hands on every queued frame before the process ends (`ipc.c:260-268`).
- Failed or short write: `truncate_back` cuts only above the last good length and syncs (`sink.c:358-368`), `fail()` makes the writer sticky, the mux call returns the error, `fatal` sets the code, the session closes, `CRASH` is sent and the exit code is 70 (`capture_worker.c:467-477`). Checkpoints of earlier fragments still leave.

Limits found: the level named `F_FULLFSYNC` may have been `fsync()` (R63-09); and on the Core side a failure in this very path during a STOP is not seen (R63-01).

### Q6 - the pinned-call rule and the libavformat pin (row 61)

**A tripwire with stated limits, honestly labelled (`pinned_calls.py:30-36`, note 23 §4.7) - and with four limits it does not state** (R63-08: digraph paste, assembler label, muxer name of an `ARGS_FREE` call, `removefile`), each shown to pass both nets. The fifteen evasions of D84 / D85 are refused (`planted.tsv`, 52 planted lines; the self-test's control copy passes and my own control is refused). Its sound parts: token reading (comments and strings apart), calls AND mentions counted, table-independent rules for `open` / `fopen` / option keys, forbidden names in joined strings and identifiers. A fence would be the import list of the linked binary; that is one `nm -u` away.

**libavformat pin:** at compile time yes - `_Static_assert` on the headers (`ingest.c:61`), which a `-D` can move (`:58`); at build yes - `check.sh:231` through `make`, `make check`, `make proof`, not through `make build/capture-worker` (`Makefile:52-54`); at RUN time no (R63-07).

### Q7 - `-PROOF` refusal and the version allowlist: any start without them?

| Path | `-PROOF` mark | Allowlist |
|---|---|---|
| Boot probe (`boot/checks.ts:300-304`) | yes | yes |
| First worker of a session (`supervisor.ts:598`) | yes | **no** (R63-04) |
| Restart inside a session, option C (`launch()` -> the same `onMessage`) | yes | **no** |
| RECOVERY | no worker is started by any recovery path in this scope (`boot()` starts none, `supervisor.ts:781-783`) | - |
| `SIMULATED`, or `real` without a program | `unconfiguredLauncher`, nothing starts (`index.ts:132-134`) | - |

Every production start goes through `launch()` and the `HELLO` branch; there is no second launcher. Test seams: `CaptureBootMount.launcher / inspect / probeEvidenceVolume / signingKeyProblem` and `ProcessLauncherOptions.env / inheritDiagnostics` are parameters that `capture/index.ts:128-136`, `:238-246` never pass; `sink_fault_hook` and `g_mux_extra` are NULL outside their macros (held by `check.sh:80-82`, `:126`). Two things to keep in mind: the mark is the worker's own statement, and it depends on one macro (R63-06); and the path rule of the program (owner, mode) is inspected at boot only.

### Q8 - protocol 4: accepted but not validated

**`WARNING` is tight; `TELEMETRY` is not.** `WARNING` has no free-text member: `code` and `reason` are enums paired by `WARNING_REASONS_OF` (`index.ts:608-632`), `state` is an enum, `subject` must be a device of the plan or the worker is ended (`supervisor.ts:670-674`). `RECORD.deviceId` is held to the plan (`:692`), `ACK.code` / `CRASH.code` / `PROGRESS.step` to a code pattern. What is accepted and not validated is R63-05: the device IDs of `TELEMETRY` (to the engine; to the log and the persistent error log through the two level notices), `CRASH.signal`, the `correlationId` of a switch interval nobody commanded, and `keyId`. Shown by a decode run and by the supervisor run quoted in R63-05. Nothing of it reaches an AUDIT row in this scope: notices write no audit row.

## 5. Checked and found sound (one line each)

- Creation rule of a camera file: `O_EXCL` temporary name, one `link()`, directory sync, never a truncating open (`sink.c:475-487`, `:389-394`; `check.sh:65-69`).
- Whole fragments only: box walk before every write, `moof` then `mdat`, sequence 1, 2, 3 (`sink.c:531-552`, `:441`).
- Chains: genesis, stored-bytes and plaintext chain, running prefix on a copied state (`sink.c:442-473`); the Core re-derives them by an implementation of its own (`fragments.ts:404-441`).
- Tail validation is a comparison of declared sizes with bytes present, never a probe (`fragments.ts:169-186`, `:407-441`); `.part` names are told apart by device and inode (`:680-685`).
- Zero-gap rule inside the INSERT statement, idempotent on replay, conflict keeps the stored row (`statements.ts:55-65`; `recording-fragments/index.ts:178-196`).
- The recorder never blocks the supervisor and bounds its backlog (`recording-fragments/index.ts:328-368`).
- Restart option C: `durable` set before the sequence is judged, late records of an ended worker counted for that one fact under two guards, `OUTPUT_EXISTS` final (`supervisor.ts:564-576`, `:623`, `:695`).
- Records are inline, sequenced, rate-bounded, once-per-camera, never in the lossy queue (`supervisor.ts:687-715`).
- The worker's output is never paused; `close`, not `exit`, ends the channel, so every line written is handed on (`ipc.ts:89-114`).
- One spawn, no shell, empty environment, fixed arguments (`ipc.ts:56-63`; `index.ts:133`).
- Worker sockets: `protocol_whitelist=tcp`, a check of every descriptor after open and once a second (`ingest.c:79-93`, `:388`, `:404`; `capture_worker.c:427-431`).
- The plan is refused strictly on both sides; the worker's reader counts members and rejects doubled keys (`capture_worker.c:138-217`; `ipc.c:390-396`).
- The switch has one writer of `cur_map` beside the build, on the filtering thread, behind a thread guard (`audio.c:127`, `:175`, `:192-202`; `check.sh:31-38`).
- The log is bounded per source and per run (`ipc.c:38-127`).
- The e2e verdict logic: a negative control counts only as a FAIL the harness accepted on named criteria (`--must-fail-on`); a crash or timeout is never "failed as required" (`e2e.py:253-276`).
- Boot checks: path rule before anything is started, exclusive create / sync / hard link / link-refuses-existing probed on the real volume, refusals carry codes and never a path (`boot/checks.ts:286-304`; `evidence-volume.ts:86-121`).
- Frozen files: the digest pins see every added line of `app.ts` and `config.ts`, with positive controls (`static.test.ts:520-541`, `:634-662`).
- Server-wide guards: process and outbound-module exemptions are by file name with planted controls (`test/static/credentials.test.ts`, `network.test.ts` diff).
- Duplication: the twin box readers (`sink.c:171-299`, `fragments.ts:197-331`) are independent on purpose; the constants shared by the worker and the package are held equal by a pin test (`capture/__tests__/protocol-pins.test.ts`). No copy that would mislead was found.

## 6. Not reviewed

- `apps/core-server/src/capture/adapters/**` other than `local` (camera, audio, poe, fake, registry: rows 65, 131, 142) and `capture/signer/**` (row 83): in the path list, outside the seven areas of row 63; not read.
- `apps/capture-worker/src/audio.c` as a whole (671 lines) and `micwatch.c`; the vendored `skeleton111.c`.
- The bodies of the Python harness (`m3worker.py`, 2,199 lines; `m5mic.py`; `av_analyse.py`) and of the C fixtures; the vitest files of the unit other than the P25 pins.
- The mobile half of row 62 (late-stop instrumentation) and the CS-10 service surfacing.
- `capture-session/**`, `sealing/**`, `engine/**`: read only where a finding or a carried question led there.
- Nothing was built and no suite or e2e series was run; no behaviour of libavformat 9.0.2 itself was verified (R63-10, R63-11 say where that matters).
