---
task_id: 2026-10-07_dems_real_capture_sealing
blueprint_row: 64
milestone: M3 (capture worker, protocol, supervisor, writer, static rules, boot checks)
date: 2026-10-10
agent: verifier (independent +1)
tier: 2
artifact_type: milestone gate report
tree: commit f29322113aac338a62b58297c47c7107e14b4b4f (product tree clean: `git status --porcelain` shows only files under docs/)
verdict: PASS WITH CONDITIONS
status: complete
---

# 08 - M3 milestone gate (blueprint row 64)

Verifier only. No product or test file was changed; this file is the only file written. Written to
git-ignored places by my runs: `.cache/m3worker/e2e/gate64/` and `.cache/m3worker/runs/e2e_gate64_*`
(the e2e harness), throw-away databases (dropped, 0 remain), logs in the session scratch folder.
No lane, emulator, adb, standing database, `.data/pg*.env`, local camera or microphone was used; no
`DEMS_LOCAL_SESSION_ATTENDED` / `DEMS_USER_ATTENDED`; nothing under `adapters/local/__tests__/e2e/`.
Lane LOG files (`.locks/core-server.lane*.log`) were read, nothing else of a lane.

## 0. Verdict

**PASS WITH CONDITIONS.** Entry condition met (review 63: 0 BLOCKER, 0 MAJOR open). Every named
check of the row is PASS with output on the code under test. No named check is FAIL or NOT PROVEN.
The conditions (section 6) are limits that are accepted but not yet stated where an operator or an
installer reads them, and proofs that belong to later gates. None blocks M3.

## 1. The code under test, and which run counts for it (D122)

| Fact | Evidence (how verified) |
|---|---|
| Tree = `f293221`, committed 12:29:36 | `git rev-parse HEAD`; `git status --porcelain`: `decisions.md` modified and untracked files under `docs/` only, before and after my runs |
| Worker sources and protocol package last changed 10:46:41 | `find apps/capture-worker packages/capture-protocol -newer .cache/m3worker/e2e/fixM3_full/build.out`: no file. Newest: `src/capture_worker.c`, `ingest.c`, `worker.h`, `test/e2e.py`, `test/m3worker.py` at 10:46:41 |
| The binary the series used IS the sources of HEAD | I built `build/capture-worker`'s exact command (`make -n`) into a temporary folder and compared the sections with `otool -s`: `__TEXT,__text` `f2c07c7aaa3b6f99...`, `__cstring` `2870cf3e55738a6c...`, `__TEXT,__const` `1997f8532a443dc8...`, `__DATA,__data` `42a199e6268119db...` - identical for both, both 122,144 bytes, both say `capture-worker/0.5.0`. (The binary and three sources share the mtime 10:46:41, so make's timestamps alone would not show it) |
| Worker series `fixM3_full`: build 10:53:02, summary 11:31:09 | `stat`; `summary.txt`: `122 checks (81 expected PASS, 41 negative controls expected FAIL): 122 as expected, 0 unexpected` / `ports still listening after the series: none` / `AGGREGATE EXIT CODE 0` |
| Core files changed AFTER the series began | `find -newer build.out`: 128 files, 10:53 to 12:27. Of the files the worker harness loads: `capture/supervisor.ts` 11:39:28 (changed after); `capture/ipc.ts` 10:25, `capture/types.ts` 10:22, `capture/fragments.ts` 00:23, `test/support/capture-session-driver.ts` 10-09, `capture-worker/test/tail_check.ts` 10-09 (unchanged). So only the checks that go through the production supervisor (`sup_*`, `kc1`, `kc3`) ran on a Core file that changed later |
| What covers the Core + worker pair after those changes | (a) MY RUN, section 3: `sup_av2_pm80_r1`, `kc1_r1`, `kc3_r1`, `sup_refuses_proof_build_r1` on `f293221`, 12:38-12:40. (b) `test/06` part A (11:57-12:08: seal e2e 3 of 3, kill matrix 35 of 35, development e2e 2 + 1 skipped): every file under `capture/**`, `capture-session/**`, `packages/**` was last changed at or before 11:53:02 |
| Changed after the wave-F runs (pass F-Z, 12:26-12:27) | `find -newermt '11:57'`: `sealing-host/index.ts`, `modules/sessions/routes.ts` (product: the seal-retry hand-on), five test files, `apps/mobile/expo-env.d.ts`. None is on the capture path. The whole core unit and db projects were therefore run by me on `f293221` (section 2) |

## 2. Named checks

Result PASS = the quoted output, on the code under test. "series" = `.cache/m3worker/e2e/fixM3_full/<name>_r1.out`
(each also ran as `_r2` with the same verdict); "gate64" = my run `.cache/m3worker/e2e/gate64/`.

| Check | Result | Evidence (source) |
|---|---|---|
| M3-RG core-server unit | PASS (my run, f293221, 12:31:42) | `npm run test -w @dems/core-server -- --maxWorkers=2`: `Test Files 309 passed (309)` / `Tests 6247 passed (6247)`, exit 0 (wave F had 3 red before F-Z) |
| M3-RG core-server db | PASS (my run, f293221, 12:33:40) | `/usr/bin/lockf -k .locks/db-migrate.lock npm run test:db -w @dems/core-server -- --maxWorkers=2`: `Test Files 177 passed \| 3 skipped (180)` / `Tests 2381 passed \| 6 skipped (2387)`, exit 0; `teardown: dropped 8 database(s) ...; 0 remain`. The 3 skipped files are the env-gated heavy ones (seal e2e, development e2e, kill matrix), green in `test/06` A2-A4 |
| M3-RG mobile | PASS | `test/06` B8: 249 of 250 suites green; the one red file was changed by F-Z (test only) and nothing else in `apps/mobile/src` changed since. My run of that file: `PASS src/features/session-summary/summary-live-static.test.ts` / `Tests: 10 passed, 10 total`. The whole suite was not run again |
| M3-RG shared, capture-protocol, core-web, mock-core (+ transcriber) | PASS (D122: unchanged since the run) | `test/06` B3 `104 files; 2476 passed`, B4 `31 passed`, B7 `154 files; 1900 passed`, B9b `19 passed`, B9a `561 passed, 3 skipped`, all exit 0, run after 12:08. Last change: `packages/shared` 11:53:02, `apps/core-web` 11:17:36, capture-protocol before 10:53 (`find -newer`) |
| M3-RG capture-worker (check, selftest, unit) | PASS (D122) | series `static_rules`: `check.sh: src: static rules OK (AU2-07, N-10, C.4 ..., R63-06 every proof switch marks, R63-09 sync seam, D85 libavformat 63.1.102; fixtures: SEC35-23)`, 75 x `refused as required`; `unit_r1`: `writer_test: all checks hold`, `sink_kill_test: 200 kills ... violations 0`, every negative control `fails ..., as required`; again `test/06` A1b exit 0 at 11:57 |
| M3-RG pg-scripts | PASS, CARRIED - not run by me | `git log -1 -- scripts/pg` = `0a9e317` (2026-10-07, before task 3); 57 of 57 at row 53 (D49); `07_m2_gate.md:84` carried it the same way. Not run: it works on the host cluster |
| M3-QA-1 typecheck + lint | PASS | `test/06` B1 / B2: exit 0 in 7 workspaces. Re-run by me for the two workspaces F-Z touched: `typecheck @dems/core-server exit 0 error-TS-lines 0`, `lint ... exit 0`; `typecheck @dems/mobile exit 0`, `lint @dems/mobile exit 0 ... (0 errors, 1 warning)` (`src/runtime/log.test.ts:160`, known) |
| M3-WI-1 | PASS | series `av1_zero_switch_tap`: 25 criteria, `failed_criteria: []`: `files_playable`, `files_grow_during_session` (25 samples, 6 distinct sizes per file), `checkpoints_contiguous`, `running_hash_equals_closed_file_rehash`, `tail_validation_clean_and_matches_records`. (b) `wi1_camstop`: after camera 2 ended its file grew through 5 sizes in 19 samples, `audio_only_fragments: 4`. (c) `wi1_fatal_rmdir`: `worker_rc: 70`, `CRASH VIDEO_MUX_WRITE_FAILED`; control `fatal_clean_control` `worker_rc: 0`; `optc_planted`: planted file SHA-256 equal before and after. Same check again on f293221: gate64 `av1_zero_switch_tap_r1 expect PASS got PASS`, 25 criteria. Core + worker: gate64 `sup_av2_pm80_r1` `files_growth_h4_records: PASS`; `test/06` A2 seal e2e (a), (b) verify `overall: PASS` 15 of 15 |
| M3-AV-1 | PASS | 0 ms incl. a mic switch: `offset_ms 0.0194, truth_ms 0.0, error_ms 0.0194` on 6 of 6 events (series and gate64), `mic_switch_acknowledged: PASS`. +80 / -80: series `av1_av2a_pm80` `80.0222 / 80.0` and `-79.9778 / -80.0`, error 0.0222 ms. `av_regression_2ms: PASS`, `av_product_40ms: PASS`. Mics are a separate process (`fake_mic`). Negative control `neg_av_forbidden_mux_option`: `expect FAIL got FAIL` on `av_product_40ms`, `av_regression_2ms` (measured 5,568.35 ms against 80; the catalogue's "about 450 ms" is not the figure of this build - the control fails all the same); `neg_av_mic_latency_5ms` FAIL on `av_regression_2ms` |
| M3-AV-2 | PASS | (a) cameras in their own processes, +-80 ms, through the production supervisor on f293221: gate64 `sup_av2_pm80_r1`: cam1 `80.025 / 80.0`, cam2 `-79.975 / -80.0`, `av_regression_2ms: PASS`. (b) series `av2b_drift_200ppm`: `fitted_slope_ppm 200.09` and `-199.78` for +-200 injected, `drift_slope_is_the_injected_one: PASS`. (c) series `av2c_srdrift_200ppm`: `fitted_slope_ppm 0.02` / `-0.09`, `max_abs_error_vs_truth_ms 0.1153`, `drift_slope_near_zero: PASS`. Controls `neg_av2b_drift_judged_as_none`, `neg_av2c_reports_without_rate`, `neg_sup_av_judged_as_no_offset`: FAIL as required |
| M3-KC-1 | PASS (both halves; my run on f293221) | gate64 `kc1_r1 expect PASS got PASS`: session 1 killed after the durable record `[['EXITED','SIGKILL',None]]`, worker pid 53454; next session a new process pid 53467, both files `playable: True`, `video 600, audio 912` decoded. Process half also in the unit suite (`capture/__tests__/supervisor.test.ts:327` "M3-KC-1: one worker process per session, never reused", in the 309-file run) |
| M3-KC-2 | PASS | series `kc2_sigkill_tail_validation`: 10 criteria, none failed; `truncation_detected_ms: 1.122` (bound 20); the cut file `ffprobe_rc: 0`, `decoder_rc: 0`, yet `tail_validation: ok false, flags [TORN_TAIL, FILE_SHORTER_THAN_RECORDS]`, reason `DECLARED_SIZE_EXCEEDS_BYTES_PRESENT` in an `mdat`; `drop_fragment_rule_recovers_the_previous_prefix: PASS`. Control `neg_kc2_file_not_cut`: FAIL on `tail_validation_flags_the_cut`. Worker and `capture/fragments.ts` unchanged since. Pair: seal e2e (b) (worker killed, RECOVERY, `interrupted true / true`, verify PASS) and the kill matrix 35 of 35 (`test/06` A2, A3) |
| M3-KC-3 | PASS (my runs on f293221) | Unit (the catalogue's form, `FakeWorkerProcess`): `liveness.test.ts` blocks "F-7 / M3-KC-3" and "sibling: a crash AFTER the durable record (option C)" with two CONTROL cases, in my targeted run `Test Files 10 passed (10)` / `Tests 245 passed (245)`. Real worker: gate64 `kc3_r1`: `restarted_after_a_kill_before_any_fragment: PASS`, `respawned_worker_records: PASS`, pid 53524 -> 53525, attempt 2. Control series `neg_kc3_no_restart_allowed`: FAIL as required |
| M3-KC-4 | PASS | series `kc4_longgop_loss_reported`: `camera_gop_frames 250` (5.0 s), `loss_bounded_by_one_fragment: PASS`, `gop_warning_raised_before_the_kill: PASS`, record `observedMs 5000, boundMs 2000, aboveBound true`, `loss_window_stated_from_the_record_ms: 5000`. Control `neg_kc4_camera_inside_the_bound`: FAIL on the two report criteria. Worker unchanged since |
| M3-SR-1 | PASS (my run on f293221) | `apps/core-server/src/capture/__tests__/static.test.ts` (G-R1, G-R2, G-R4, G-R5, G-R7, G-R8, the P25 pin; also G-R9..G-R16) in the whole unit run and in the targeted run above |
| M3-SR-2 | PASS (D122) | The worker is a C program (D24): the guard is `apps/capture-worker/check.sh` + `--selftest` (`implementation/23_m3_static_boot.md:101`), not a vitest file. Series `static_rules expect PASS got PASS`: `C.4 forbidden options` in the OK line; selftest `refused as required (C.4): forbidden mux option use_editlist / negative_cts_offsets / avoid_negative_ts in the worker`. Its pins are held from the Core side by `test/static/guard-family.test.ts` (green in my unit run) |
| M3-SR-3 | PASS (my run on f293221) | `capture/__tests__/muxer-safety.test.ts` "M3-SR-3: capture constants muxer safety" (5 cases incl. a planted CONTROL), in the targeted run; worker side: selftest `refused as required (W1-C1): non-existent mux option frag_type` and `(SR-3): the options the worker sets are not the decided set` |
| M3-MG-1 | PASS (my run on f293221) | gate64 `mg1_no_media_in_git`: `media_lines_in_status: []`, `control_the_search_finds_a_planted_media_line: PASS`, run folders git-ignored. My own: media-extension lines in `git status --porcelain --untracked-files=all` = 0; media files added since `c2c983b` (`git diff --diff-filter=A`) = 0; `.cache/m3worker/runs`, `.data`, `apps/capture-worker/build` ignored (`git check-ignore`) |
| M3-BC-1 | PASS (my run on f293221) | `capture/boot/__tests__/checks.test.ts` "M3-BC-1: what a real start is refused for (one refusal each)": no worker program, path rule, proof mark, other protocol version / no answer, evidence volume, signing key; control "a real operation that has everything passes". The "model files" clause is the transcriber's boot step: `transcription/__tests__/boot.test.ts` "CS-22: the boot step ... REFUSES an unresolvable transcriber configuration" (in the 309-file run). In a running Core: lane 2 log, 12:31:35.091 `CAPTURE_BOOT_CHECKS_PASSED`, mode real |
| M3-RTSP-BIND-1 | PASS | series `bind_udp`: 41 socket snapshots of the worker pid with a UDP-requesting client connected (`udp_client_rc: 183`): `udp_sockets: []`, `sockets_not_on_loopback: []`, `sockets_seen: [127.0.0.1:8563 (LISTEN), 127.0.0.1:8564 (LISTEN), ...]`. Control `neg_bind_skeleton` (the row-111 skeleton): FAIL on `no_udp_socket`, `every_socket_on_loopback`. Fixture readers: `fixture_and_worker_sockets_loopback_only: PASS`. On f293221: gate64 `av1_zero_switch_tap_r1` `worker_sockets_tcp_loopback_only: PASS`; static `SEC35-23`, `W-1` |
| M3-REC-1 | PASS (my run on f293221) | `capture/__tests__/records.test.ts`: "M3-REC-1 (a)" sequence gap = violation, with CONTROL; "(b)" flooded queue, every record in order, with CONTROL; "(c)" SEAL_COMPLETE arrives though the final PROGRESS is evicted. In the targeted run (245 passed) and the whole unit run; protocol side `packages/capture-protocol` 31 passed (`test/06` B4, unchanged) |
| Row-111 H-4 proof (+1) | PASS (my run on f293221, once) | gate64 `av1_zero_switch_tap_r1`: `h4_one_encoder_both_files: {"audio_packets": [909, 909], "encoder_packets_in_manifest": 909, "packets_differing_between_files": 0, "payload_mismatches_vs_encoder": [0, 0], "worker_encoders": 1}`, both files playable. Control `neg_h4_reencoded_r1 expect FAIL got FAIL`: `packets_differing_between_files: 909`, "failed as required" |
| T-10 gate note | PASS (boot line on this tree; stop line on unchanged code) | Lane 2 (restarted by the environment agent on f293221, mode real, pid 44593): line 32 `boot step passed` 12:31:35.107, line 33 `CAPTURE_SUPERVISOR_BOOTED ... "mode":"real","worker":"configured","msg":"capture supervisor booted"` 12:31:35.107, line 34 `Server listening at http://127.0.0.1:4422` 12:31:35.109. Stop: `.locks/core-server.lane3.log` lines 39-41, 10:00:45.976: `"signal":"SIGTERM","msg":"shutdown requested"` then `"code":"CAPTURE_SUPERVISOR_STOPPED","msg":"capture supervisor stopped"`. That run is before this commit; the code is unchanged: `apps/core-server/src/index.ts` has no diff `abf742f..f293221` (mtime 10-09 09:40), and the diff of `capture/index.ts` touches no line of the seam's `boot()` / `shutdown()` (`:215-241`). The module's two lines are also asserted in `capture/__tests__/module.test.ts:92,95` (my targeted run). I stopped no lane (forbidden to me) |

My e2e run, in full (`make -C apps/capture-worker e2e E2E_ARGS="--tag gate64 --ports 8563,8564 --runs 1 --no-build --only '^(...)'"`, 12:38:20-12:40:08, heavy-host lock held, load 2.72-3.94):

    av1_zero_switch_tap_r1       expect PASS got PASS   rc 0   21.4 s
    sup_av2_pm80_r1              expect PASS got PASS   rc 0   21.4 s
    kc1_r1                       expect PASS got PASS   rc 0   34.1 s
    kc3_r1                       expect PASS got PASS   rc 0   25.3 s
    neg_h4_reencoded_r1          expect FAIL got FAIL   rc 0    0.2 s
    sup_refuses_proof_build_r1   expect PASS got PASS   rc 0    4.5 s
    mg1_no_media_in_git          expect PASS got PASS   rc 0    0.2 s
    7 checks (6 expected PASS, 1 negative controls expected FAIL): 7 as expected, 0 unexpected
    ports still listening after the series: none
    AGGREGATE EXIT CODE 0

`--no-build`: the binaries of the series were used; the release binary equals HEAD (section 1). A first
call selected nothing (`no check selected`: my shell expanded `$$` in the pattern); nothing ran, not a result.

## 3. Entry condition: review 63, finding by finding

"Fixed" = I read the fix in the code at `f293221` and its test, and the test passed on this code.
Red-first runs are the fix notes' statements unless a negative control in the tree shows the test can fail.

| Finding | State | My evidence |
|---|---|---|
| **R63-01** MAJOR | FIXED | `capture/supervisor.ts:560-570` (`stopFailureOf`), `:582-594` (stop path: `lastCrash`, `workerDown` with `restartInMs: null`, then `finishStop`), `:1012`, `:1022` (`STOP_TIMEOUT`); `capture-session/index.ts:1247-1248`, `:1265` (not clean -> interrupted, `CAPTURE_STOP_NOT_CLEAN`). Test `capture/__tests__/review-m3.test.ts:56-174`: 7 cases, each asserts `outcome.clean`, `lastCrash`, the `workerDown` list and the order `phase:STOPPING, down:..., phase:IDLE`; against a `stop()` that resolves `undefined` each fails; a CONTROL keeps the clean stop clean. Run once by me (10 files, 245 passed). Real worker: clean stop `exitCode 0, stopToExitMs 24.83, supervisor_reports []` (gate64 `sup_av2_pm80_r1`); seal e2e (a) `interrupted false`, (b) `true` |
| **R63-02** MAJOR | FIXED (proven at a 2 MiB bound - section 4) | `ingest.c:301-326` (`write_bounded_locked`: cut before the bound, warning once), `sink.c:484` (`WRITER_FRAGMENT_TOO_LARGE` backstop), `capture_worker.c:167`, `:386`; one number: `capture-protocol/src/index.ts:401`, `capture/index.ts:120` (`VERIFY_MAX_OPEN_FRAGMENT_BYTES`), `worker.h` `DEFAULT_MAX_FRAGMENT_BYTES 67108864`. Tests: `protocol-pins.test.ts` (my run); `writer_test` + control `without the size bound it fails on the 3 checks of that rule and on nothing else` (series `unit_r1`); e2e `r63_02_fragment_size_bound` PASS 14 criteria (`every_durable_fragment_inside_the_bound`, `no_sample_lost`, `size_bound_warning_once_per_camera`), control `neg_r63_02_no_size_bound` FAIL on exactly the three bound criteria |
| **R63-03** MAJOR | FIXED | `capture/forwarder.ts:362-363` (`AV_OFFSET_NEAR_BOUND` on / off from `nearBound`), `:387`, `:453-456` (`KEYFRAME_INTERVAL_ABOVE_BOUND` from the ACTIVE warning or the record), `:390` (`FRAGMENT_SIZE_BOUND_REACHED`). Tests `forwarder-advisories.test.ts:62-151` (8 cases, with a CONTROL "a frame that never says nearBound raises nothing") and `forwarder-fx-size-bound.test.ts`; run once by me |
| R63-04 | FIXED | `supervisor.ts:274`, `:680` (`helloRefusalOf` = `workerVersionRefusalOf` on every HELLO); `review-m3.test.ts:176-239` (first start, six other words, CONTROL, restart option C, RECOVERY). Real binary: gate64 `sup_refuses_proof_build_r1`: `detail: CAPTURE_WORKER_PROOF_BUILD`, `worker_launches: 1` |
| R63-05 | FIXED | `capture-protocol/src/index.ts:489-494` (`CAPTURE_WIRE_ID`, `CAPTURE_SIGNAL_NAME`, `CAPTURE_KEY_ID`); `supervisor.ts:754` (`TELEMETRY_SUBJECT_UNKNOWN`), `:814` (`SWITCH_NOT_COMMANDED`); `review-m3.test.ts:241-301` with two CONTROLs; `protocol.test.ts` (31 passed, `test/06` B4) |
| R63-06 | FIXED | `worker.h` `DEMS_PROOF_BUILD` on any of 12 switches; `ipc.c:250-251`; `Makefile:43` `CFLAGS :=`; `test/start_checks.sh:23,32`; series `unit_r1`: `start_checks: all checks hold (R63-06: one proof switch marks HELLO, control: release word; ...)` |
| R63-07 | FIXED, on a seam (section 4). Residual: `$(BIN)` does not depend on `check` (the note's reason: test binaries); the import net IS in the `$(BIN)` recipe (`Makefile:61-64`) | `ingest.c:73`, `capture_worker.c:419`, `supervisor.ts:731`; `start_checks.sh:24,35-39`; `review-m3.test.ts:303-325` with CONTROL |
| R63-08 | FIXED (a tripwire with stated limits + the import net) | `test/static/pinned_calls.py:30-49,74,98,227-229,358`; `imports.pin` (fopen, ftruncate, link, open, rename, unlink); `planted.tsv` 60 lines; series `static_rules`: 75 `refused as required` |
| R63-09 | FIXED, on a seam (section 4) | `sink.c:327-343`, `:430-435` (`WRITER_SYNC_LEVEL_CHANGED`); `ingest.c:185-187` (`syncLevel` in `FIRST_DURABLE_FRAGMENT`); `capture/index.ts:202-203`; control `with the silent sync fallback it fails on the 4 checks of that rule`; every session criterion `first_durable_fragment_states_its_sync_level: PASS` (`sync_level: F_FULLFSYNC`) |
| R63-10 | FIXED | `ingest.c:498` (reference taken at the ingest's opening), `:584`; series `r63_12_clock_floor_wiring`: `camera_1500ms_behind_is_anchored_and_records: PASS` (the old worker refused it: the note's statement) |
| R63-11 | FIXED as "said, not changed". Residual: B-frame RTP input is undetermined (no fixture) | `ingest.c:668-674`; series `r63_11_moved_timestamp_is_said`: `video_timestamp_moved` logged once (`dts_in 650084 -> 650085`), `retimed {"1": 1, "2": 0}`, `the_file_time_never_goes_backwards: PASS` |
| R63-12 | FIXED (check added) | series `r63_12_clock_floor_wiring` PASS 8 criteria: 1.5 s behind `camera_clock_floor lag_ms 1520.8`, 3 s behind `camera_clock_out_of_bound lag_ms 3020.7`, warning `CAMERA_CLOCK_OUT_OF_BOUND CAM-02`; control `neg_r63_12_floor_not_acted_on` FAIL on exactly `camera_3000ms_behind_is_given_up_by_the_clock_floor` |
| R63-13 | FIXED | `anchor.c:109` (`skipped_span_ms`); `anchor_test.c:193-197`; control `the span without the untimestamped lead fails it, as required`; spec erratum PE-R63-13 (`05_capture_architecture_spec.md:1078`) |
| R63-14 | FIXED (record) | spec erratum PE-R63-14 (`05_capture_architecture_spec.md:1385`); the digest pins of `static.test.ts` green in my run |
| R63-15 | CLOSED | `fixM3_full/summary.txt`: 122 of 122, `AGGREGATE EXIT CODE 0`, on the binary shown equal to HEAD |
| R63-16 NOTE | RULED - D188 decision 2, known limit (section 4, item 1) | series: `video_packets_of_the_given_up_camera: 27` (0.54 s at 50 fps; note 116 says 28) |
| R63-17 NOTE | FIXED | `modules/recording-fragments/index.ts:31-34` "WHO CALLS IT ..."; grep for the three stale phrases in `capture/index.ts`, `capture/ipc.ts`, that file: no hit |
| R63-18 NOTE | FIXED | `capture_worker.c:379-380` (`whole_number` for both arguments); `:234-238` (`gop_frames_target` logged, nothing enforced) |
| R63-19 NOTE | OPEN (not changed; no decision number). Not a defect of the worker (review Q1): the judge re-times variable-rate video | note 116, R63-19 line |
| R63-20 NOTE | RECORDED in `implementation/116_fix_m3_review.md` section 1 (not in `decisions.md`) | - |

Count: BLOCKER 0, MAJOR 0 open of 3, MINOR 0 open of 12 (two with a stated residual), NOTE 1 open of 5. **Entry condition met.**

## 4. Known limits and open rulings - judged as gate matters

| # | Limit / ruling | What I found | Judgement |
|---|---|---|---|
| 1 | D188 decision 2: a camera more than 2 s behind that connects early has up to 1 s of wrongly timed video before the floor gives it up | Measured 27 packets (0.54 s). The camera is then faulted by name (`CAPTURE_FAULT / CAMERA_CLOCK_OUT_OF_BOUND`, severity CRITICAL, `packages/shared/src/sim/capture-fault-wording.ts:40,110`). Whether the manifest marks such a track was not shown to me. Stated in `decisions.md` and note 116 only; `README.md` and `apps/capture-worker/README.md` do not say it | ACCEPTABLE LIMIT for M3 (the failure is loud and named). NOT stated where an operator or installer reads it -> conditions C1, C3 |
| 2 | D188 / D190: a camera clock up to 2 s off is accepted and recorded in manifest field 40; advisory above 500 ms | Worker: reports, does not correct - series `r63_12`: lag 1,520.078-1,520.218 ms over 540 frames, `near_bound_true_frames: 0`. Core: `capture-session/index.ts:135` (`CAMERA_CLOCK_OFFSET_ADVISORY_MS = 500`), `:564`; `sealing-host/session-reader.ts:287` (measured ?? adapter ?? stand-in); db cases `session-capture.db.test.ts:1297-1323` and `facts-fy.test.ts:61-70`, green in my runs - on the FAKE worker. **Not proven:** the real worker's `lagMs` arriving in field 40 of a product-sealed manifest (`test/06`: "NOT AVAILABLE ... a gap"; D191 sends it to gate 89). Below 500 ms nothing is shown to the operator: the +-40 ms AV tolerance then rests on the cameras' clocks being disciplined (review Q4) | ACCEPTABLE LIMIT as ruled; the operator sentence exists above 500 ms. Field 40 end to end is NOT PROVEN -> condition C2; the installer requirement (cameras synchronised to the Core's clock) -> C1 |
| 3 | R63-02 proven at 2 MiB, not 64 MiB | One comparison against `g_max_fragment_bytes` (`ingest.c:305`, `:317`), the same path at any number; the number is held equal by `protocol-pins.test.ts` and passed on every launch (`tidy-fy.test.ts`, both green in my unit run); every ordinary session also holds `every_durable_fragment_inside_the_seal_bound: PASS`; the seal keeps `FRAGMENT_TOO_LARGE` as the last net | ACCEPTABLE. Proven by equivalence, not by a run above 64 MiB. No condition |
| 4 | R63-07 / R63-09 proven on seams only | No second FFmpeg and no volume without the full sync on this host. A volume without the full sync is said (`syncLevel`, alert `EVIDENCE_VOLUME_SYNC_NOT_FULL`: CRITICAL in production) and recording continues (D189) | ACCEPTABLE. The volume requirement belongs in the installer text -> C1 |
| 5 | D190: the supervisor's other refusals (`WARNING_SUBJECT_UNKNOWN`, `RECORD_*`, `HELLO_EXPECTED`) raise a fault without a reason | Needs a misbehaving worker; the operator gets the neutral sentence, the log and `lastCrash.detail` hold the code | MINOR, open, not blocking -> C4 |
| 6 | D190: a SYSTEM notice raised by a Core that then dies stays active; a new raise for the same target writes nothing | Read in note 118 section 2; not exercised by me. It fails toward over-warning, but a stale CRITICAL line (`EVIDENCE_VOLUME_SYNC_NOT_FULL`) can outlive its cause | DEFECT, minor, not blocking M3 (the notices unit is not an M3 check) -> C4 |
| 7 | D167 / note 21 section 4: no power-loss proof, no real ENOSPC, no volume without hard links | Power loss is class C (H-1 open). ENOSPC: injected write fault only (`writer_short_write_truncates` PASS, control FAIL). A volume without hard links is refused at boot by the probe (`capture/boot/evidence-volume.ts:108-116`), on a seam | ACCEPTABLE, class C. State the volume precondition -> C1 |
| 8 | Protocol stays 4 with additive members; worker 0.5.0 | The additions are additive (a warning reason, a named setting, an optional record member). But the allowlist is a FORM (`boot/checks.ts:247`, `capture-worker/n.n.n`) and the protocol number did not move, so nothing at BOOT tells a pre-fix `capture-worker/0.4.0` binary (no size bound, no stated sync level, the R63-10 allowance) from this one: the boot probe's launcher passes only `--log` and `--heartbeat-ms` (`capture/boot/index.ts:161`) and that binary answers `HELLO` with protocol 4. It cannot RECORD: the session launcher passes `--max-fragment-bytes` (`capture/index.ts:144-145`) and the 0.4.0 argument reader ends with usage on an unknown argument (`git show abf742f:apps/capture-worker/src/capture_worker.c:378`), so every session start fails. By reading, not by a run | ACCEPTABLE for M3 (it fails closed: no recording with an unfixed worker). The refusal comes at the first session start instead of at boot -> condition C7 |

## 5. Not proven by this gate (plainly)

- Manifest field 40 from the real worker's measurement in a sealed package (C2).
- R63-02 above 64 MiB; R63-07 / R63-09 on a real second library / a real volume without the full sync.
- `capture supervisor stopped` on SIGTERM in a run of THIS commit: quoted from the 10:00 run on unchanged code.
- pg-scripts: carried, not run. The whole mobile suite after F-Z's one test-file change: that file only.
- Red-first runs of the review fixes: read from the fix notes, except where a negative control in the tree shows it.
- Form: `test/06` ran core-web with `--maxWorkers=4` (B.4 says 2); result exit 0 (X-MAX-1 note).
- After the wave-F heavy runs, F-Z changed `sealing-host/index.ts` and `modules/sessions/routes.ts`: unit and db green on f293221 (my runs); seal e2e and kill matrix were not run again - a matter for gate 89, not for M3.

## 6. Conditions

| # | Condition | Owner |
|---|---|---|
| C1 | State in the operator / installer documentation: cameras must be time-synchronised to the Core (an offset up to 2 s is recorded, not corrected; advisory only above 500 ms; beyond 2 s the camera is faulted and up to 1 s of its video may be wrongly timed); the evidence volume must give hard links and the full sync; power loss is not proven | Row 96 (docs, M9-W2) |
| C2 | Read field 40 per track in a product-sealed manifest made with the built worker and hold it against the worker's first `lagMs` | Gate row 89 (already assigned by D191) |
| C3 | Answer review R63-16's question: does the sealed package mark a track whose camera was given up by the clock floor (beyond the `FAULT_RAISED` row)? Rule it or record the limit in the evidence spec | Controller, with the reviewers of rows 82 / 83; checked at gate 89 |
| C4 | Stale SYSTEM notice after a Core crash (no boot clear) and the reason-less supervisor refusals: fix or rule with a decision number | Controller -> the forwarder / capture-notices owner (rows 71b / 97) |
| C5 | Quote `capture supervisor stopped` once more from the first lane stop of this commit (lane 2, mode real) | Controller / environment agent, at the next lane stop |
| C6 | Run pg-scripts (floor 57) and the whole mobile suite once at the final regression | Row 95 |
| C7 | A worker binary older than this tree passes the boot checks and fails only at the first session start: make the boot refuse it (the probe passes the session's arguments, or the allowlist names this tree's version word - `protocol-pins.test.ts` already holds the word equal to `worker.h`), or rule it as accepted | Controller -> the owner of `capture/boot/**` (row 61 area) |

## 7. End state

`git status --porcelain` after my runs: `decisions.md` modified and untracked files under `docs/` only
(this report is the one that is mine); no product or test file. Ports 8563 / 8564: `ports still listening after the series: none`,
`lsof` shows no listener. Databases: `0 remain with the run prefix`.

---
*Generated: 2026-10-10 12:50*
