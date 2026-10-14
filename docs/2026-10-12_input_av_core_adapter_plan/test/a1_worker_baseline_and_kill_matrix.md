---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input-av-core-adapter-plan
row: A1 (wave 12, track D) - closes row 59's open point (BR-11, kill matrix) and is the worker baseline of C110 / U26 (3) / C112 (5)
date: 2026-10-14
agent: test-expert (A1)
status: complete - make rc 0, static rules rc 0, series 160 of 160 after ONE re-run of one failed check (first run 159 of 160, named below), every fixture green, kill matrix 35 of 35 green
tier: 2
---

# A1 - worker baseline and kill matrix

No product file and no test file was written. Existing file changed: ONE line appended to `delegation_progress/file_claims.md` (Edit tool). New files (Write tool): this record and `delegation_progress/row_a1.md`. Logs and small run scripts of this session: `.cache/task4-a1/` (git-ignored); the series' own folders `.cache/m3worker/e2e/a1/` and `.cache/m3worker/e2e/a1r/`; the kill matrix's per-cell reports `.cache/task4-a1/kill-matrix/` (35 JSON files).

Session: 2026-10-14 08:31:22 to 10:18:34 WIB, **wall time 6,431 s (1 h 47 min)** (`t0` file to the last database check). Branch `task4/input-av-core-port`, head `1fbeada7`.

## 1. Result in one table

| # | Part | Command (repository root; sandbox off) | Load (1/5/15 min) at start | rc | Result line | Count |
|--:|---|---|---|--:|---|---|
| 1 | `make` | `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock make -C apps/capture-worker` | 3.91 4.05 3.80 | 0 | see section 3; 119 s | 189 lines `refused as required`, announce 187, relay unit 989 (34 of 34), fuzz 0 failures, guard 83 |
| 1a | `check.sh src` | `cd apps/capture-worker && sh check.sh src` | - | 0 | `check.sh: src: static rules OK (...)` | - |
| 1b | `check.sh --selftest` | `sh check.sh --selftest` | - | 0 | 95 lines `refused as required` | - |
| 1c | `relay-check.sh src/relay` | `sh relay-check.sh src/relay` | - | 0 | `relay-check.sh: src/relay: static rules OK (...)` | - |
| 1d | `relay-check.sh --selftest` | `sh relay-check.sh --selftest` | - | 0 | 94 lines `refused as required`, last: `refused as required (HARDEN): the relay linked without its hardening` | - |
| 2 | **The series, run 1** | `make -C apps/capture-worker e2e E2E_ARGS="--tag a1 --ports 8559,8561 --load-wait 60"` (takes the heavy-host lock itself) | 4.07 4.09 3.81 (08:31) | 2 (make), aggregate 1 | `160 checks (114 expected PASS, 46 negative controls expected FAIL): 159 as expected, 1 unexpected: m5_gap_analyser` / `ports still listening after the series: none` / `AGGREGATE EXIT CODE 1` | **159 of 160** |
| 2r | **Re-run ONCE of the failed check with the run it judges** | `make -C apps/capture-worker e2e E2E_ARGS="--tag a1r --ports 8559,8561 --load-wait 60 --only 'm5_switch_bound_intervals\|m5_gap_analyser'"` | 4.00 4.72 5.88 (09:40) | 0 | `2 checks (...): 2 as expected, 0 unexpected` / `AGGREGATE EXIT CODE 0` | 2 of 2 |
| 2a | BR-09, row 142 (inside 2) | names `br09_*`, `neg_br09_*` | - | - | 14 PASS, 3 controls FAIL as expected | 17 of 17 |
| 2b | BR-09, row 178 (inside 2) | names `br09b_*`, `neg_br09b_*` | - | - | 19 PASS, 2 controls FAIL as expected | 21 of 21 |
| 3 | `row58_gate.py all`, run 1 | `M3_PORTS=8559,8561`, one bounded lock hold per run (`run_step.sh`, bound 900 s) | 3.95 4.45 5.51 | 0 | `ROW58 GATE: 12 run(s), 12 PASS, 0 FAIL` | 12 of 12 |
| 4 | the same, run 2 | the same | 3.88 4.40 5.38 | 0 | `ROW58 GATE: 12 run(s), 12 PASS, 0 FAIL` | 12 of 12 |
| 5 | the same, run 3 | the same | 4.42 4.38 5.26 | 0 | `ROW58 GATE: 12 run(s), 12 PASS, 0 FAIL` | 12 of 12 |
| 6 | `row176_camera_end.py all` | the same | 3.64 4.11 5.05 | 0 | `ROW176 CAMERA END: 6 run(s), 6 PASS, 0 FAIL` | 6 of 6 |
| 7 | `row175_log_hygiene.py repeat` | the same | 3.41 3.89 4.86 | 0 | 2 lines, each `PASS` | 2 of 2 |
| 8 | `row175_log_hygiene.py scan` (reads files) | no lock | - | 0 | `ROW175 LOG HYGIENE: 14 run(s) scanned, 14 PASS, 0 FAIL; path text in any worker log: 0; library lines above level 16: 0` | 14 of 14 |
| 9 | `br09_gate.py` | inside the series (2a, 2b) | - | - | - | 38 of 38 |
| 10 | `row041_relay.py all` | as 3 | 3.51 3.88 4.83 | 0 | `ROW41 RELAY: 28 run(s), 28 PASS, 0 FAIL` | 28 of 28 |
| 11 | `row042_probe.py all` | as 3 | 4.34 4.18 4.80 | 0 | `ROW42 PROBE: 21 run(s), 21 PASS, 0 FAIL; probe runs 10, requests of the Basic scheme received by the camera in them: 0` | 21 of 21 |
| 12 | `row043_reopen.py` drop, back, refused, gone, control (one hold each) | as 3 | 3.31 .. 7.08 | 0, 0, 0, 0, 0 | after each case: `ROW43 REOPEN: 11 run(s), 11 PASS, 0 FAIL (...)` | 11 of 11 |
| 13 | `row186_bounds.py all` | as 3 | 7.18 4.85 4.77 | 0 | `ROW186 BOUNDS (capture-relay): 23 run(s), 23 PASS, 0 FAIL` | 23 of 23 |
| 14 | `row143b_source_bind.py all` | as 3 | 4.03 4.55 4.66 | 0 | `row143b_source_bind: 14 of 14 runs PASS` | 14 of 14 |
| 15 | `row152_hostile_relay.py all` | as 3 | 4.31 4.59 4.68 | 0 | `ROW152 HOSTILE RELAY: 14 run(s), 14 PASS, 0 FINDING, 0 FAIL` | 14 of 14 |
| 16 | `row153_confinement.py all` | as 3 | 4.20 4.54 4.66 | 0 | `ROW153 CONFINEMENT: 6 run(s), 6 PASS, 0 FAIL` | 6 of 6 |
| 17 | `make relay-fuzz-controls` | as 3 | 4.49 4.51 4.63 | 0 | `relay_fuzz controls: 24 of 24 planted flaws found by the fuzz build (seed 186, at most 20 s each)` | 24 of 24 |
| 18 | row 046's database test (not in the brief's list; run because row 59 ran it; 113 s) | from `apps/core-server`: `DEMS_TEST_STEP=a1r046 lockf db-migrate.lock lockf heavy-host.lock bounded.py 600 npx vitest run --project db --maxWorkers=2 src/modules/capture-config/__tests__/camera-adapter-open.db.test.ts` | ~2.5 | 0 | `Test Files 1 passed (1)` / `Tests 12 passed (12)` / `teardown: dropped 2 database(s) in 38 ms; 0 remain with the run prefix dems_test_step_a1r046_tmvnrvsc_` | 12 of 12 (11 at row 59) |
| 19 | **KILL MATRIX** | `.cache/task4-a1/run_kill_matrix.sh all <35 ids>` (section 5) | 4.12 4.45 4.60 (10:05) | 0 | `Test Files 1 passed (1)` / `Tests 35 passed (35)` / `Duration 595.29s` / `teardown: dropped 2 database(s) in 37 ms; 0 remain with the run prefix dems_test_step_a1km_tmvn8sen_` | **35 of 35** |

Per-step times, rc and load: `.cache/task4-a1/steps.tsv`. One log per row: `01_make.log`, `03_*`, `04_*`, `10_e2e.log`, `12_e2e_rerun_m5gap.log`, `20_...` to `34_...`, `43_kill_matrix_all.log`.

Not run, as at row 59 (the README does not list them as parts of the series and the brief makes them conditional on that): `row044_e12_search.py`, `row159_relay_hygiene.py`, `row010_resumed_push.py`, the two `e11` experiments, `rtsp_test_camera_check.py`, the long `make relay-fuzz RELAY_FUZZ_SECONDS=40`.

## 2. The one failure and its re-run

`m5_gap_analyser` (M5-GAP-1, AU2-05; not timing-sensitive, judges the recording made by `m5_switch_bound_intervals` just before it):

| | Recording check (load at start) | Intervals: `fromSample` / `appliedDelayUs` of the two switches | `spacing_error_samples` (both files) | `position_error_samples` | Verdict |
|---|---|---|---|---|---|
| Run 1 (`a1`) | PASS, 21.3 s (load 7.54; analyser started at 10.58) | 350400 / 17004 ; 375840 / 5334 | `[0, 17, 0, 0, 0]` | `[0, 0, 17, 17, 17, 17]` (position criterion PASS) | FAIL on `spacing` only; count, position, tone, one stream, tone window PASS |
| Re-run (`a1r`) | PASS, 20.4 s (load 4.30) | 355200 / 4502 ; 380160 / 9906 | `[0, 0, 0, 0, 0]` | all 0 | PASS |

Fact: in run 1 the second beep interval of BOTH files was 17 samples (about 0.35 ms at 48 kHz) off the expected spacing, across the first switch; the re-run on a quieter host was exact. The cause is NOT established; it is not a known case of this check in row 59's record (160 of 160 there). Hypothesis only: the first switch was applied 17,004 us after the order (re-run: 4,502 us) while the host load was 7.5 to 10.6; whether a late switch can shift a beep by whole samples is a question for the owner of the microphone path (worker `audio.c` / the M5 switch), and it matters for the macOS microphone rows that will edit that file. Evidence: `.cache/m3worker/e2e/a1/m5_gap_analyser.out`, `.cache/m3worker/e2e/a1r/m5_gap_analyser.out`.

Everything else of the series ran once.

## 3. Row 1 in detail (`01_make.log`, 227 lines)

`check.sh: src: static rules OK`; 189 `refused as required` lines (worker, relay and guard planted lines and mutations together; 154 at row 59) and one `accepted as required (R-6)`; `anchor_test: all checks hold`; `micwatch_test: all checks hold (M5-WARN-1)`; `announce_test: all 187 checks hold`; `sink_kill_test: 200 kills in 5.4 s: ... violations 0`; `writer_test: all checks hold`; `start_checks: all checks hold`; `log_test: all checks hold`; `relay-check.sh: src/relay: static rules OK`; `relay_unit_test: 989 checks passed; ... 34 of 34 pass` (982 at row 59), the same under the sanitizers; `relay_fuzz: 1474112 inputs over 8 entry point(s) in 16.0 s, seed 186: 0 failures`; `guard_test: all 83 checks hold`. `make` found the three binaries current: none was relinked (section 4).

## 4. THE BASELINE (hashes; the next worker row compares against this list)

Taken at 08:31:22 before `make`, again after `make`, after the series, at every fixture step (18 samples in `.cache/task4-a1/hash_trail.tsv`) and at 10:17:38 after everything: **identical at every point**. `git status --short apps/capture-worker packages/capture-protocol`: empty (no uncommitted change). Source list before and after: `diff` empty.

Binaries (`apps/capture-worker/build/`):

| File | SHA-256 | Size | File time |
|---|---|---|---|
| `capture-worker` | `84c8ecebe0167411ea74945b51482d13659ad9424649da2a0ac4ad63b80c9438` | 123,536 | 2026-10-13 15:47 |
| `capture-relay` | `c375c92ff35573e8c9038611d90721c3bcbde50d971d9a5319b3840861dce135` | 79,424 | 2026-10-13 17:29 |
| `capture-guard` | `4f1e7a9ce9dc6c8e1a99e857e679ed3e4f4d09d7a48e21f5d17a6fe5a3893b67` | 34,896 | 2026-10-13 13:39 |

Sources (`apps/capture-worker/src`, every file, 17):

```
0f88364043b9180f3a8b11f0cfad102c0af801b480e14242c3a1ecf2b0c2d44a  apps/capture-worker/src/anchor.c
4521fb2b8a6f01bde98fa7d755368250cb88fcf710949536729b26b63d01fc8b  apps/capture-worker/src/anchor.h
fcaa82bc70c6ace8006529780f5ceb542833977d16950665dc1cecc36b251779  apps/capture-worker/src/announce.c
7c6b62c28f67847610e8356693ddce8f288525abaf91540ae97d31973cbfe547  apps/capture-worker/src/announce.h
7029846c9a222c38e780c87c141ac7cb5fd19b54d3d85f0f6869cab8c76ab50e  apps/capture-worker/src/audio.c
5482a20d5dd56c375ba426960570433ade23ebcdbc0d871bc866a7289504e13d  apps/capture-worker/src/capture_worker.c
5a98669417169620bc37dfe42fbe93197ef986929a74f044396c3fe7b88a1cbc  apps/capture-worker/src/guard/guard.c
371221a1c7076db51a1ae1759f81d93082054e86fdb106683d8a3199aef7db80  apps/capture-worker/src/ingest.c
1ca630d2e5408bde03ac908736b6749eb492ea901c4a4b517d3084f9b04fefbe  apps/capture-worker/src/ipc.c
59759335c99d05cc9a8b5326b5499b4a607681452e334dfa95b20d89ecbbcfbe  apps/capture-worker/src/micwatch.c
43efa7ad16b9a15d56a0ea047bbba14a724f8b7a07bcbd0cd03bc8b6b4278a5c  apps/capture-worker/src/micwatch.h
d13d191418c1b599d50194fedf2ad3157ad2876d0262de6a439ed7daccaf9b1b  apps/capture-worker/src/relay/relay.c
55cbb29a4037138f43a0e4da3c81d494c2005dacfb5013f17c33c1e832bd3ab5  apps/capture-worker/src/relay/relay.h
1e712a40dfc007cfc16cfa9e66fa9abf033d430d63f2e3d00920411325bfffd4  apps/capture-worker/src/relay/relay_core.c
5b64df0a721a7ae616cc17b05184fb02901a6ab51c60c5ec6527a8fc236c519e  apps/capture-worker/src/relay/relay_rtsp.c
e9f8265351e59bb8c60472d84ee9bdec0d8f30bb47dcd5e5d0afd39da68b5750  apps/capture-worker/src/sink.c
f174603ab0ac6cac22b884b97f43188541d9ccdb7e27fb0f336c5b1c39e6ab1e  apps/capture-worker/src/worker.h
```

Against row 59 / C88 (worker `9b942d21`, relay `f70f5d9d`, guard `4f1e7a9c`): the guard is the same link; the worker (file time 13 Oct 15:47) and the relay (13 Oct 17:29) were relinked AFTER row 59 ended (15:38) by other rows' builds, not by this row. Row 59 showed that a link is not byte-reproducible, so a hash names one link, not the sources; for the next worker row the SOURCE list above is the comparison that means "the C source changed", the binary hashes say which link the series and the matrix ran on. Libraries: libavformat 63.1.102, libavcodec 63.1.102, libavfilter 12.1.102, libswresample 7.1.102, libavutil 61.1.102 (`/opt/homebrew/Cellar/ffmpeg/9.0.2/lib`, `summary.json`).

## 5. The kill matrix (row 59's open point; C88, C110, U26 (3), C112 (5))

How it is run: `npm run test:kill-matrix` = `scripts/test/kill-matrix.sh`, which reads the cells from `run.sh --list` and calls `apps/core-server/src/sealing/__tests__/kill-matrix/run.sh --only <id> ...` once; `run.sh` takes the HEAVY-HOST lock first and the db lock second (`run.sh:36`). Wave 12 rule 1 orders the db lock FIRST, and nesting the two orders would deadlock. DRIVER DECISION: the runner's own final command was run with the locks in the brief's order - `.cache/task4-a1/run_kill_matrix.sh`: `lockf -k -t 1800 .locks/db-migrate.lock lockf -k -t 1800 .locks/heavy-host.lock sh run_kill_matrix_inner.sh`, the inner script runs `DEMS_KILL_MATRIX=<the 35 ids> DEMS_TEST_STEP=a1km DEMS_KILL_MATRIX_OUT=.cache/task4-a1/kill-matrix vitest run --root apps/core-server --project db --maxWorkers=1 src/sealing/__tests__/kill-matrix/kill-matrix.db.test.ts` (the same arguments as `run.sh:37`; the two extra variables only label the databases and move the report folder), bounded at 3,000 s, core files 0. The preconditions of `run.sh` held (worker built, `.data/helpers/ffmpeg` present - existence test only).

The cells: `run.sh --list` - 35 active (M7-REF-1; C-S1..S6; P1-0, P1-S1..S6; P2-0, P2-S1..S6; P3-0, P3-S1..S6; P4-0, P4-S1..S6), 10 parked (C/P1/P2/P3/P4 x S7/S8, not started). List: `.cache/task4-a1/04_kill_matrix_list.txt`.

Port and instance checks (`lsof`, sandbox off):
- 10:04:53, before the locks: `lsof -nP -iTCP:8554 -iTCP:8556 -sTCP:LISTEN` rc 1 (nothing); nothing on 4420-4423 or 5173-5178; the only listeners on the host: PostgreSQL 127.0.0.1:4432 (pid 65169), the two `claude` processes, macOS services (`ControlCe` 5000/7000, `rapportd`). At that moment agent D1 held both locks with its own capture-worker test (`.cache/task4-d1/`), so the check was repeated INSIDE the locks.
- 10:05:16, inside both locks (`41_inside_locks_all.txt`): 8554/8556 rc 1 (nothing); 4420-4423, 5173-5178: nothing. The inner script would have exited (3 or 4) without starting the matrix otherwise.

Database: the controller's broadcast (received during the series; noted at 09:23:55, `pg_notice_received.txt`) said the project's PostgreSQL had not been running since the morning restart and was started (pid 65169). No database step of this row had run before that message: `make`, the static rules and the series use no database. **The kill matrix (10:05) and the row 046 test (10:16) both ran AFTER the database came up.** The kill matrix's own line: `PostgreSQL 18.4 on 127.0.0.1:4432; ... run prefix dems_test_step_a1km_tmvn8sen_`.

Every cell, from its report (`.cache/task4-a1/kill-matrix/<id>-<ms>.json`; one report per cell, `wrong: []` in all 35):

| Cell | Kills recorded | Expectation | Result |
|---|---|---|---|
| M7-REF-1 | none | SEALED | green |
| M7-KM-C-S1 .. C-S6 | the step kill at CLOSE_TRACKS / FINALIZE_HASHES / FINALIZE_TRANSCRIPT / BUILD_MANIFEST / SIGN_MANIFEST / STORE_SEALED_PACKAGE (`AFTER_WORK`, SIGKILL) | SEALED | 6 green |
| M7-KM-P1-0, P1-S1 .. P1-S6 | `P1 SIGKILL` only | FAILED_START | 7 green |
| M7-KM-P2-0, P2-S1 .. P2-S6 | `P2 SIGKILL`, then the step kill of S1..S6 | SEALED_INTERRUPTED | 7 green |
| M7-KM-P3-0, P3-S1 .. P3-S6 | `P3 SIGKILL`, then the step kill | SEALED_INTERRUPTED | 7 green |
| M7-KM-P4-0, P4-S1 .. P4-S6 | `P4 SIGKILL`, then the step kill | SEALED | 7 green |

**35 of 35 green, none not green, nothing re-run.** Two facts a reader should have: (1) the P1 step cells record ONE kill - a kill before the first durable fragment is a failed start (`cells.ts:13`, `:78`), the session row is `FAULT` after the boot (`M7-KM-P1-S1` facts), so no sealing step runs and the named step kill is never reached; that is the matrix's design, not a gap of this run. (2) Every cell lists as not staged "a transcript chunk in flight (STT is off in the rig ...)" - as designed (`kill-matrix.db.test.ts`, the rig disables STT). The matrix ran on worker `84c8eceb...`, the helper `.data/helpers/ffmpeg` and the Core of the working tree at head `1fbeada7`.

## 6. Doubles, unproven, deviations

- Doubles only, loopback only: generated cameras and microphones (`fake_cam`, `fake_mic`, the FFmpeg pusher, `rtsp_test_camera.py` on the fixtures' own ports), the development helper's generated picture and tone, throw-away databases. No real camera, no microphone, no credential, no network probe; the worker's listeners 8559/8561 for the series and fixtures, 8554/8556 for the matrix only.
- Unproven, as before: Linux, power loss, a full volume, no hard links, the 10 parked cells (OD-21), real devices (hardware package).
- DRIVER DECISIONS: (a) `--load-wait 60` instead of the default 900 (never hold the heavy-host lock idle; 22 of 93 sensitive checks waited, 1,155 s in all; 14 started above load 8 after their 60 s and passed); (b) the matrix's lock order (section 5); (c) row 046's database test was run although the brief does not list it.
- Edit tool only for existing files: kept (one Edit, `file_claims.md`). The run scripts under `.cache/task4-a1/` are new files of this session; one of them (`run_step.sh`, my own, a minute old) was changed by a scripted replace to call `bounded.py` - recorded.
- The heavy-host lock was never held idle by this row: each hold ran a command at once (the series' own waits at most 60 s before a sensitive check).

## 7. Left behind - nothing

At 10:17:38 (`91_after.txt`): no listener on 8550-8574, 4420-4423 or 5173-5178; no `capture-worker`, `capture-relay`, `capture-guard`, helper, test camera, fixture, `bounded.py` or `lockf` process of this row (the only matches were agent D1's `vitest` under `.cache/task4-d1/`, untouched); no OS-temporary `row86-*` fixture directory. Databases: both teardowns `0 remain with the run prefix`; checked again with the repository's own `test:db:drop-run` for `dems_test_step_a1km_tmvn8sen_` and `dems_test_step_a1r046_tmvnrvsc_`: `dropped 0 ... remaining with that prefix: 0` each (`92_db_after.txt`). The demo, lane and `dems_test_m12_row232` databases were not touched.
