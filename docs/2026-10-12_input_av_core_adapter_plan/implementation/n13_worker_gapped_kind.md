---
task_id: 2026-10-12_input_av_core_adapter_plan
row: N13 = work packages N1 + N3 of masterplan/06_design_macos_microphone.md revision 3 (wave 12, track D)
date: 2026-10-14
agent: coder-execution (agent N13)
tier: T3
builds_on: masterplan/06 sections 7.2, 7.2a, 8.2 (a)-(e), 9.2, 10.1 rows N1 and N3; verification/08b (SM-29, SM-30, SM-31, SM-33); decisions U25, C107, C110, C112 (5), C119 (1), C123, C124; test/a1_worker_baseline_and_kill_matrix.md (the baseline)
status: SEE SECTION 1 (filled after the series)
---

# Row N13: protocol version 5 and the worker's gapped microphone kind

Edit tool only for existing files (no scripted replace, no shell append, no generated rewrite of a tracked file): KEPT. New files with Write: `apps/capture-worker/test/gapped_mic.c`, `apps/capture-worker/test/n3gapped.py`, this record, `delegation_progress/row_n13.md`. Scratch scripts under `.cache/task4-n13/` (git-ignored; two of them, a minute old and mine, were changed by `sed`). No device, no real credential, no network probe: generated sources only (the stand-in writer, the existing fake cameras), loopback ports 8559 and 8561. Every process start under `.locks/heavy-host.lock`, one bounded hold per run, never held idle.

## 1. Result

(filled in section 9 when the series and the fixtures ended)

## 2. FIRST, BEFORE ANY EDIT: the `m5_gap_analyser` failure of row A1 (decision C123)

Question: is a 17-sample difference at a source switch a test margin, a race in the check, or a real miscount of the worker's audio timeline?

ANSWER: none of the three. It is a REAL INSERTION of 17 zeros by the worker, COUNTED EXACTLY by the worker and MEASURED EXACTLY by the check. Not a miscount: nothing to fix in the code this row changes. Evidence, all from files:

| # | Evidence | Source |
|---|---|---|
| 1 | Run 1 of A1: the worker's own end line `mic_summary` says `missing: 17` for BOTH microphones (`dropped 0`, `restarts 0`); the passing re-run says `missing: 0` | `.cache/m3worker/runs/e2e_a1_m5_switch_bound_intervals/worker.jsonl`, `e2e_a1r_.../worker.jsonl`; manifest end lines `missing0/missing1` 17/17 and 0/0 |
| 2 | Run 1's PCM tap holds exactly ONE run of exact zeros (3 or more): 17 samples at tap sample 451,663 (= quantum offset 463: the TAIL of a quantum, the buffer ran empty). The re-run's tap holds none | scan of `tap.s16` (`.cache/task4-n13/zr.py`) |
| 3 | The analyser's position errors `[0, 0, 17, 17, 17, 17]`: beeps 0 and 1 exact, every beep from beep 2 on 17 samples late; the run sits between beep 1 (device sample 419,777) and beep 2 (515,777) - 1.58 s AFTER the second switch (375,840), so not "at the switch" as A1's hypothesis read it | `.cache/m3worker/e2e/a1/m5_gap_analyser.out` |
| 4 | Cause: ONE `fake_mic` process writes BOTH pipes (`test-fixtures/fake_mic.c`), so a late delivery under load starves both microphones at once. The worker's buffer holds 1,903 samples at a take (= 3 x 480 + 463, `mic_clock` level 1,904); a writer one 480-sample chunk later than that slack leaves exactly 480 - 463 = 17 samples short: 17 is the SMALLEST insertion one late fixture chunk can cause. The rate controller's dead band is 48 samples (`audio.c` `MIC_DEADBAND_SAMPLES`), so a 17-sample offset is never pulled back: it stays to the end, exactly as the analyser saw | `audio.c` :88-89, :97, :467; A1 run 1 load 7.54 rising to 10.58 |
| 5 | DISTRIBUTION on the untouched baseline binary, six runs of `m5_switch_bound_intervals` + `m5_gap_analyser`, one lock hold each, load 5.56 to 7.46: 6 of 6 PASS; `missing` 0 in every run; spacing errors `[0,0,0,0,0]` five times and `[1,-1,0,0,0]` once (position error 1 on one beep, `missing` 0: the onset detector's own resolution of one sample, inside its tolerance of 2) | `.cache/task4-n13/m5dist.log`, `.cache/m3worker/e2e/n13d1..6/` |
| 6 | REPRODUCED ON PURPOSE (scratch harness `.cache/task4-n13/m5stall.py`: the same `m5switch` session, the fixture writer frozen with SIGSTOP 4.7 s after the cameras' epoch). Prediction: the worker's `missing`, the zero run of the tap and the analyser's error are ONE number. With the existing proof build `nocomp` (no compensation) and a 70 ms freeze: `missing0/1` 1,457 / 1,457; the tap's one zero run 1,457 samples at 442,063 (offset 463 again); spacing errors `[0, 1457, 0, 0, 0]`, positions `[0, 0, 1457, 1457, 1457, 1457]` - equal, to the sample. With the release worker the same freeze gives `missing` 1,457 and a first error of 1,205, then 728, 250, -208: above the dead band the rate controller pulls the offset back at up to 240 samples a second (and overshoots) - the 17 of A1 lies below the dead band and stays | `.cache/task4-n13/n13stall60*.out`, `.cache/m3worker/runs/n13stall60nc/` |

So: the check is right to fail when the host delays the fixture writer by more than the worker's 40 ms latency; it is load-sensitive by nature (the recording run is gated at load 8, and A1's analyser started at 10.58). Under the protocol of today the worker said so only in its end log line - exactly the gap section 7.2 point 2 names, which this row closes for the gapped kind. Recommendation (not done: the PCM_FIFO path must stay byte-for-byte): none for the code; the series could re-run a FAIL of this check once when its recording run's `missing` is non-zero, but that is the controller's call.

## 3. N1 - the protocol package (`packages/capture-protocol/src/index.ts`, `test/protocol.test.ts`)

| Change | Where |
|---|---|
| `CAPTURE_PROTOCOL_VERSION` 4 -> 5, with a VERSION 5 paragraph in the header (what changed and why a step) | index.ts header, `:148` area |
| Constants `CAPTURE_AUDIO_DAY_SAMPLES` 4,147,200,000; `CAPTURE_MIC_ACCOUNT_PERIOD_SAMPLES` 2,880,000; `CAPTURE_AUDIO_INSERTED_RUN_MIN_SAMPLES` 4,800; `CAPTURE_AUDIO_INSERTED_RUNS_MAX` 1,024; `CAPTURE_MIC_BUFFER_MAX_SAMPLES` 96,000 (8.2 (a), (d)) | beside `CAPTURE_SWITCH_BOUND_US` |
| `CaptureMicInputKind.PCM_FIFO_GAPPED` with its statement (8.2 (b)); the plan's `input` is one of TWO strict forms | `CaptureMicInputKind`, `CapturePlanMicSchema` |
| Every `TELEMETRY` level: FOUR REQUIRED members `timelineSamples`, `receivedSamples`, `insertedSamples` (whole numbers 0 to a day; inserted at most the timeline), `nonZero` (8.2 (c)) | `TelemetryMessageSchema` |
| Record `MIC_SAMPLE_ACCOUNT`, strict, all 19 members of 8.2 (d), with the cross rules: the IDENTITY `timeline = received - discarded - buffered + inserted`, timeline a multiple of 480, inserted <= timeline, discarded and nonFinite <= received, fed <= timeline, fedInserted <= fed and <= inserted, longest <= timeline, listed + notListed <= fedRuns, closing => buffered 0 and no open run. C119 (1): the Core writes it as two audit parts; this record carries every count | `MicSampleAccountRecordSchema` |
| Record `AUDIO_INSERTED_RUN` (8.2 (e)): index 1..1,024, fromSample, samples >= 4,800 | `AudioInsertedRunRecordSchema` |
| `MIC_RECORD_KINDS` + the two kinds; the record-rate contract of the header names them (at most ten runs a second) | |

Test: 36 of 36 pass (`vitest run`, 134 ms); typecheck clean. Every existing literal of the number moved (`:101`, `:163`, `:195-207` controls now use the package's `v`, `:244`); every existing level fixture gained the four members; five new cases (version 5 refuses every version-4 frame and a version-4 level; the constants and the four members, each required and bounded; the input kind and its near misses; the account's identity and every cross rule against its nearest wrong value; the run record). MUTATION HONESTY (`.cache/task4-n13/proto_mutants.py`, scratch copies, the unmutated control green): 12 mutants, 11 RED - identity removed, level inserted<=timeline removed, nonZero optional, closing rule removed, run minimum removed, listed+notListed rule removed, chunk rule removed, gapped kind out of the plan, version back to 4, day bound removed, fedInserted rule removed; 1 SURVIVOR, EQUIVALENT: `timelineSamples` made optional in the level - the `inserted <= timeline` refine compares with `undefined` and refuses the level anyway.

## 4. N3 - the worker (`src/audio.c`, `src/capture_worker.c`, `src/worker.h`), per place of section 7.2a

The flag: `Mic.gapped` (`worker.h`), set ONCE in the plan reader (`capture_worker.c` take_plan: two words accepted, any other `PLAN_INVALID`). `MicIn.plan` points to the planned microphone so that `mic_read` / `mic_take` read the one flag.

| # | Place (baseline lines) | What the gapped kind does now | PCM_FIFO |
|---|---|---|---|
| 1 | `mic_open` :353-358 | no resampler: `swr_alloc_set_opts2`, `swr_init`, `swr_set_compensation(0,0)` stand inside `if (!plan->gapped) {`; `m->swr` stays NULL (`mic_close` already tests it) | the same three calls (re-indented) |
| 2 | `mic_read` :393 | the replacement of a non-finite sample by zero, COUNTED (`nonfinite`); `nonzero` set on the sample AS READ, before the replacement | the same replacement; the two counters are kept and never reported |
| 3 | `mic_read` :395-396 | room = the chunk exactly (no +64); what the drop REMOVED (the function's clamped count, `fifo_drop_oldest` now returns it) is added to `discarded` | room +64 as before; `dropped` as before |
| 4 | `mic_read` :399 | `memcpy` into the buffer, value for value; `made` = samples | `swr_convert` as before, in the `else` |
| 5 | `mic_take` :423-427 | unchanged (the zeros are `missing` = `insertedSamples`) | unchanged |
| 6 | `mic_take` :428-434 | the re-placement's removed samples added to `discarded` | the same drop |
| 7 | `mic_take` :436-449 | unchanged; the quantum's SHAPE is kept for the run tracker: `head` = owed lead zeros (all 480 when nothing was taken) | `head` is counted, never used |
| 8 | `mic_take` :452-480 | `if (m->plan->gapped) return 0;` BEFORE :452 - no level followed, no `swr_set_compensation`, no `micwatch_rate` (so no `MIC_RATE_AT_LIMIT`) | unchanged |
| 9 | `telemetry` :494, :500-502 | `ratePpm` always null; + the four members | + the four members (the one designed change of an existing kind's wire form, SM-33 (3)) |
| 10 | `audio_main` :563-576 | unchanged; a silence the session opens on is inserted and, on the feeding microphone, a run from sample 0 (mode `late4`) | unchanged |
| 11 | `audio_main` :582 | the trim before sample 0 added to `discarded` | the same trim |
| 12 | the end :639-661 | the open run ends with the timeline (`AUDIO_INSERTED_RUN` if long); the buffer's rest is `discarded`; the CLOSING account of each gapped microphone, BEFORE `AUDIO_TIMELINE_END` | `mic_summary` and the manifest end line byte-for-byte as before |

New in `audio.c`: `run_end`, `run_insert`, `run_feed` (the run tracker on the TRACK: a run may cross a quantum's edge and a switch between gapped microphones, belongs to the microphone that fed at its first sample, is ended by a sample of a PCM_FIFO microphone or any received sample; the first 1,024 long runs are written, the rest counted with their sum) and `account` (checks the identity, and for the closing one that nothing is buffered and no run is open; when it does not hold it writes NO record and logs `mic_account_does_not_add_up` at level error in the worker's log file). A periodic account every 2,880,000 timeline samples. Records go through the existing `send_record` (lossless). `worker.h`: version 5 and the three constants restated. `WORKER_VERSION` stays `capture-worker/0.6.0` (8.2 design table: not moved; no rule of the worker's checks demands a new word).

FIT (SM-33 (5)), computed from the exact format strings at the bounds (two device IDs of 128 characters, every count at one day, `dbfs` -120.00, `ratePpm` -5000.0): the level list is 625 of the 767 usable characters of its buffer of 768 (unchanged size); the four members of one entry 103 of their own 160; the account record body 615 of `send_record`'s 1,535. Shown in a run: mode `nan` with 128-character IDs (every telemetry carries both levels).

## 5. The static rules (`check.sh` rule N3-GAP; `planted.tsv`; the self-test's mutations)

| Clause | Its own control (each seen RED by THAT clause: `.cache/task4-n13` replay of every mutation printed the clause's message) |
|---|---|
| exactly one assignment of the flag, as written in the plan reader; no address of it taken | planted `planted_gap_a` (a second place sets it), `planted_gap_b` (`&s->mic[0].gapped`); mutation "the plan reader sets the flag from another word" |
| its reads per function = `audio.c:audio_main:3 mic_open:1 mic_read:2 mic_take:1 telemetry:1`, `capture_worker.c:take_plan:1` (a `by_function` helper: the function a match stands in, by the sources' own layout) | planted `planted_gap_c` (a read in `ingest.c`) |
| the kind words are literals of the plan reader only (`capture_worker.c:take_plan:3`) | planted `planted_gap_d` (a branch on `"PCM_FIFO_GAPPED"` in `audio.c`) |
| the resampler: exactly five names, each mentioned as often as called, compensation only in mic_open and mic_take, convert only in mic_read | planted `planted_gap_e` (a compensation call), `_f` (a convert), `_g` (`swr_inject_silence`), `_h` (`#define` alias of the compensation) |
| mic_open: the three resampler lines inside `if (!plan->gapped) {` | mutation "mic_open makes the resampler for a gapped microphone too" |
| mic_read: the convert inside the `else` of `if (m->plan->gapped) {` | mutation "the copy branch never taken" |
| mic_take: `if (m->plan->gapped) return 0;` once, before the compensation and `micwatch_rate`; no jump in the function | mutations "the return removed", "the return made conditional", "a goto inside mic_take" |

Result: `check.sh src` OK; `check.sh --selftest` rc 0, 109 lines `refused as required` (95 at A1: +8 planted, +6 mutations). `pinned_calls.py` and `pinned-calls.tsv` NOT changed (DRIVER DECISION D1: the design names them as the rule's home, but the table pins file, mux and graph calls only - its header - and this change adds none; the rule is a `check.sh` rule beside AU2-07, held by its own controls). Core pin moved by delta at the controller's word: `apps/core-server/test/static/guard-family.test.ts` + the tag `N3-GAP` (4 of 4 pass).

## 6. The proof on the stand-in (`test/gapped_mic.c`, `test/n3gapped.py`; ten modes; each judged against the PCM TAP and the stand-in's own manifest)

The stand-in writes packets of 512 samples on its own clock and leaves out whole packets by rule (`--skip-every 10`: packet k with k % 10 = 9 - the measured pattern of MM3, about one in ten); its samples are a marker that is never zero (device sample j = ((j mod 30000) + 1) / 32767; output 2 negative), so the tap - sample n of the encoder's input - says by itself which samples were inserted and which device sample every other one is. Every criterion compares the worker's count with the TAP or the WRITER, never with the worker's other numbers.

| Mode | received = written | timeline (= AUDIO_TIMELINE_END = tap length) | inserted | discarded | tap zeros where gapped fed = fedInserted | tap runs = fedRuns; long ones = run records | other |
|---|---|---|---|---|---|---|---|
| measured (both gapped, PRIMARY -> STANDBY -> PRIMARY) | 801,792 = 801,792 (both) | 996,000 | 194,208 | 0 | 194,208 = 194,208; fed positions 996,000 | 266 = 266; 1 long = 1 record (the writer's end) | NO run listed while the writer ran (check (1)); copy exact: 672,608 tap samples + 129,184 taken while MIC-02 fed = 801,792 written, in order |
| whole (gapped PRIMARY whole pipe + PCM_FIFO STANDBY) | 927,232 = 927,232 (the writer outlived the worker; it ended at EPIPE) | 924,960 | 0 in every telemetry and in the closing account | 2,272 (the buffer's rest at the end only) | 0 = 0 | 0 = 0 | 927,232 - 2,272 - 0 + 0 = 924,960; copy 924,960 + 2,272 = 927,232; the PCM_FIFO STANDBY has no account and no run |
| late4 (PRIMARY's writer 4 s late) | 552,960 / 726,016 = written | 927,360 | 374,560 | 160 (the re-placement) | 374,560 = 374,560 | 187 = 187; run 1 = fromSample 0, 192,960 samples, MIC-01 | |
| trim (STANDBY began 0.2 s before sample 0) | 717,312 / 726,528 = written | 916,320 | 199,008 | MIC-02: 10,267 (the trim) | 199,008 = 199,008 | 244 = 244 | copy 717,312 = 717,312 |
| stop3 | 683,008 = 683,008 | 1,022,400 | 339,552 | 160 | 339,552 = 339,552 | 231 = 231; the stop's run 146,816 + the end's | |
| nan (128-character IDs) | 724,992 | 924,000 | 199,008 | 0 | 199,008 | 247 = 247 | nonFiniteSamples 1, at tap sample 334,500 |
| runs1025 (1,025 stops of 160 ms) | 1,814,016 = 1,814,016 | 9,805,920 | 7,991,904 | 0 | 7,991,904 = 7,991,904 | 1,240 = 1,240; 1,026 long = 1,024 records (index 1..1,024) + runsNotListed 2, 129,280 samples | three periodic accounts per microphone (2,880,000 / 5,760,000 / 8,640,000), each adding up |
| killbefore | - | - | - | - | - | - | no account, no run, no timeline end; 179 lines all decode |
| killbetween | - | killed 3 s after the first periodic account | the periodic account stands: 2,593,792 - 0 - 224 + 286,432 = 2,880,000 (9.95 % short) | | | longest run in a minute of ordinary running: 704 samples | no closing account; 1,456 lines all decode |
| killafter | 725,504 = 725,504 | 902,400 | 176,896 | 0 | 176,896 = 176,896 | 250 = 250 | the worker ended (rc 0) within ms of STOP, before the kill could land: the closing account was on the wire first. A kill BETWEEN the closing account and the exit was NOT exercised (timing) |

In every mode: `ratePpm` null in every level of a gapped microphone (830 levels in `measured`), no `mic_clock` line of the rate controller for it, no `MIC_RATE_AT_LIMIT` for it, every output line a version-5 message of the product decoder (`frames_check.ts`), records gapless, nothing left listening or running. THE 5,000 PPM PATH IS NOT REACHABLE for this kind: by the code (place 8 returns before it; no resampler exists for it, place 1), by the static rule (section 5, with its controls), and by the runs (no compensation line, ratePpm null, and the copy is value for value - a resampler in the path would have changed values or counts).

Negative control of the judge: `n3judge --control dropone` (one tap sample removed in memory) FAILS as required on exactly `account_closes_on_the_timeline_end`, `tap_zeros_are_the_inserted_ones`, `tap_runs_are_the_listed_runs`, `copy_is_exact`.

THE DISPLACEMENT (section 7.2 point 4; 10.1 "the displacement measured and stated"): where the track puts MIC-01's device sample j against its capture instant, (T0 + p/48000) - (e0 + j/48000), from the marker:

| Mode | min | median | max (ms) |
|---|---|---|---|
| whole pipe (the reference) | +0.447 | +0.447 | +0.447 |
| measured | -36.212 | -29.545 | -26.878 |
| stop3 | -38.639 | -28.639 | +10.028 |
| late4 | -38.033 | -29.366 | -14.699 |
| trim | -38.922 | -28.922 | -24.922 |

Against the product bound of +-40 ms (`av_analyse.py` `PRODUCT_MS`): INSIDE in every run, but by 1.1 ms at the worst sample. As design point 4 predicted ("up to 40 ms earlier"): once the buffer's 40 ms are spent on the first lost packets, every sample is taken as soon as it arrives. The row does not STOP (the bound is met), but the margin is thin and was measured at a load of 5 to 7 on one host: STATED FOR THE REVIEW, not decided here (the design forbids the row to move the zeros).

## 7. What a Core of today does with a version-5 worker

The Core compares the worker's `HELLO.protocolVersion` with the package's constant (`capture/boot/checks.ts:401` `workerVersionRefusalOf`; the supervisor's `helloRefusalOf`, `supervisor.ts:413-418`). (a) A Core BUILT FROM THE TREE BEFORE THIS CHANGE (package 4) refuses this worker at the boot check (`CAPTURE_WORKER_PROTOCOL_MISMATCH`) and at every HELLO (`WORKER_PROTOCOL_MISMATCH`, not retried): correct until row N11. (b) A Core of THIS tree (package 5) accepts it; its forwarder hands the levels on (`CaptureTelemetryLevel` of `packages/shared` is a structural type; the four members ride along unused); no gapped plan can be made by it (no adapter states the kind), so no new record arrives - if one did, `supervisor.ts:962` would refuse it as `RECORD_SUBJECT_UNKNOWN` (request line to N11). (c) Its TESTS: 8 typecheck errors are this change's (6 level fixtures in four test files + 2 in `mic-transport.ts`, whose `Record<CaptureMicInputKind, ...>` needs the gapped statement); the 21 others of the workspace (network service, adopted camera) are not. `protocol-pins.test.ts` is red on 2 of 10 (the literal 4 and the record-kind list; the version EQUALITY with worker.h passes). Kept REQUIRED on the wire against the controller's preference for optional TypeScript members (DRIVER DECISION D2): an optional member would let a worker leave out the four and switch off the non-zero gate and the notices without a word (SM-33 (5)); one request line per Core file instead (`file_requests.md`, row N13 lines).

C124 (media zero): NOTHING TO CHANGE IN THE WORKER. `AUDIO_SOURCE_INTERVAL` index 1 carries `capturedAtMs` = (t0_real + 0) / 1000 from the same `t0_real` that `audio_started.t0_real_us` logs (`interval_record(s, 0, t0_real, NULL, 0)`), truncated to whole ms; the Core already stores it as `session_audio_intervals.from_at` of the START row (`capture-session/index.ts:1017`). Request line for the Core side written.

## 8. Files, hashes

Changed: `packages/capture-protocol/src/index.ts`, `test/protocol.test.ts`; `apps/capture-worker/src/audio.c`, `src/capture_worker.c`, `src/worker.h`, `check.sh`, `Makefile` (the stand-in's target), `README.md`, `test/e2e.py` (11 checks, once each), `test/m3worker.py` (`V = 5`; `n3()` and two cases), `test/static/planted.tsv` (+8); `apps/core-server/test/static/guard-family.test.ts` (one pin, by delta, at the controller's word). New: `apps/capture-worker/test/gapped_mic.c`, `test/n3gapped.py`. NOT changed: `test/static/pinned_calls.py`, `pinned-calls.tsv`, any other C source.

Sources against A1's baseline (17 files): 3 changed, 14 byte-identical.
```
6740c10b60afc4bef956c0737071436964bc8c643b92b00d3b90fe8210acde29  apps/capture-worker/src/audio.c          (was 7029846c...)
260bdeaa550c407ec66d818bfa546f2f5f9349054e20e4ebd244cf944677e8fd  apps/capture-worker/src/capture_worker.c (was 5482a20d...)
360f072fc24956a8d59992b726079eb8abfbe783ab58a22a22e365af706c9481  apps/capture-worker/src/worker.h         (was f174603a...)
```
Binaries (`make` of 10:53):
```
2a0e36ced2b8083c1f1fc99c7d6cb7a147310847d0f3e4e3c94cb7f513ea3325  build/capture-worker  (was 84c8eceb...)
4d0c3cd692ea233c783022b66a2e8f3a66dd9077b8f5053e46628f9d9bb48f9a  build/capture-relay   (was c375c92f...; sources unchanged - relinked because Makefile is a prerequisite)
eae272715f12ffc274e59b237fecc35aa3e9bca2ff63c39cdd60107106a55400  build/capture-guard   (was 4f1e7a9c...; the same)
```

## 9. The existing series on the new tree

(filled when they ended)

## 10. Driver decisions (for the controller)

- D1: the rule lives in `check.sh` (N3-GAP), not in `pinned_calls.py` (section 5).
- D2: the four level members stay REQUIRED (section 7); request lines per Core file.
- D3: `discarded` and `nonfinite` are COUNTED for every microphone (they change nothing a microphone does) and REPORTED for a gapped one only; so the flag is read in 8 places, fewer than the design's list (places 6 and 11 need no read).
- D4: the displacement is measured and stated, not a criterion of the series (it depends on the host's load); inside the bound by 1.1 ms (section 6).
- D5: the new checks joined the series once each (171 checks); the series' "160" of the briefs is now 160 + 11.
- D6: the kill matrix and its three new kill cases of a gapped microphone (SM-33 (7)) are run B+'s (design 10.1), not run here; the three worker-level kill cases are in the series (modes killbefore, killbetween, killafter).
