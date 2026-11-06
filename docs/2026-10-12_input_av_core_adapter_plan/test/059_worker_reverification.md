---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input-av-core-adapter-plan
row: 59
date: 2026-10-13
agent: test-expert (C2, track D)
subject: worker re-verification (BR-11) - the worker's whole end-to-end series with the BR-09 cases of rows 142 and 178, every fixture of the worker folder, and the kill matrix, once, in one session, on this Mac
status: needs-review - the series and every fixture are green; the KILL MATRIX WAS NOT RUN (0 of 35): its worker can only listen on 127.0.0.1:8554 and 8556, which driver rule 8 and this row's brief forbid. One ruling of the controller is needed (section 5)
tier: 2
---

# Row 59 - worker re-verification (BR-11)

No product file and no test file was written. Existing files: ONE line added to `delegation_progress/file_claims.md` with the Edit tool. New files (Write tool): this record and `delegation_progress/row_059.md`. Logs and three small run scripts of this session: `.cache/task4-row059/` (git-ignored).

Session: 2026-10-13, 13:33:48 to 15:38:30 WIB, **total wall time 7,482 s (2 h 4 min 42 s)**, of which about 2,900 s the series, about 2,900 s the fixtures and the rest waits for the two locks.

## 1. Result in one table

| # | Part | Command (repository root; sandbox off; every run its own hold of `.locks/heavy-host.lock`) | rc | Result line | Count |
|--:|---|---|--:|---|---|
| 1 | `make` (static rules, self-tests, unit checks, relay and guard checks, build) | `/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock make -C apps/capture-worker` | 0 | see section 3 | 154 planted lines refused; announce 187; relay unit 982 (34 of 34 cases), again under the sanitizers with 3 controls failing as required; fuzz 0 failures; guard 83 |
| 2 | **The whole series** | `make -C apps/capture-worker e2e E2E_ARGS="--tag row059 --ports 8559,8561 --load-wait 0"` | 0 | `160 checks (114 expected PASS, 46 negative controls expected FAIL): 160 as expected, 0 unexpected` / `ports still listening after the series: none` / `AGGREGATE EXIT CODE 0` | **160 of 160** |
| 2a | BR-09 cases inside it, row 142 | (part of 2: names `br09_...`, `neg_br09_...`) | - | 14 PASS as expected, 3 negative controls FAIL as expected | 17 of 17 |
| 2b | BR-09 cases inside it, row 178 | (part of 2: names `br09b_...`, `neg_br09b_...`) | - | 19 PASS as expected, 2 negative controls FAIL as expected | 21 of 21 |
| 3 | `row58_gate.py all`, run 1 | `M3_PORTS=8559,8561 ... python3 apps/capture-worker/test-fixtures/row58_gate.py all` | 0 | `ROW58 GATE: 12 run(s), 12 PASS, 0 FAIL` | 12 of 12 |
| 4 | the same, run 2 | the same | 0 | `ROW58 GATE: 12 run(s), 12 PASS, 0 FAIL` | 12 of 12 |
| 5 | the same, run 3 | the same | 0 | `ROW58 GATE: 12 run(s), 12 PASS, 0 FAIL` | 12 of 12 |
| 6 | `row176_camera_end.py all` | `M3_PORTS=8559,8561 ... row176_camera_end.py all` | 0 | `ROW176 CAMERA END: 6 run(s), 6 PASS, 0 FAIL` | 6 of 6 |
| 7 | `row175_log_hygiene.py repeat` | `M3_PORTS=8559,8561 ... row175_log_hygiene.py repeat` | 0 | 2 lines, each `PASS` | 2 of 2 |
| 8 | `row175_log_hygiene.py scan` (reads files; no lock, no port) | `python3 .../row175_log_hygiene.py scan` | 0 | `ROW175 LOG HYGIENE: 14 run(s) scanned, 14 PASS, 0 FAIL; path text in any worker log: 0; library lines above level 16: 0` | 14 of 14 |
| 9 | `br09_gate.py` | through the series runner: part of 2 (rows 2a, 2b) | - | - | 38 of 38 |
| 10 | `row041_relay.py all` | `M3_PORTS=8559,8561 ... python3 -B .../row041_relay.py all` | 0 | `ROW41 RELAY: 28 run(s), 28 PASS, 0 FAIL` | 28 of 28 |
| 11 | `row042_probe.py all` | `... python3 -B .../row042_probe.py all` | 0 | `ROW42 PROBE: 21 run(s), 21 PASS, 0 FAIL; probe runs 10, requests of the Basic scheme received by the camera in them: 0` | 21 of 21 |
| 12 | `row043_reopen.py` drop, back, refused, gone, control (one lock hold per case) | `... python3 -B .../row043_reopen.py <case>` | 0, 0, 0, 0, 0 | after the last case: `ROW43 REOPEN: 11 run(s), 11 PASS, 0 FAIL (a negative control passes when it FAILS on its named criteria)` | 11 of 11 (5 + 1 + 3 + 1 + 1 runs of this session) |
| 13 | `row186_bounds.py all` | `... python3 -B .../row186_bounds.py all` | 0 | `ROW186 BOUNDS (capture-relay): 23 run(s), 23 PASS, 0 FAIL` | 23 of 23 |
| 14 | `row143b_source_bind.py all` | `/usr/bin/lockf ... python3 -B .../row143b_source_bind.py all` | 0 | `row143b_source_bind: 14 of 14 runs PASS` | 14 of 14 |
| 15 | `row152_hostile_relay.py all` | `... python3 -B .../row152_hostile_relay.py all` | 0 | `ROW152 HOSTILE RELAY: 14 run(s), 14 PASS, 0 FINDING, 0 FAIL` | 14 of 14 |
| 16 | `row153_confinement.py all` | `... python3 -B .../row153_confinement.py all` | 0 | `ROW153 CONFINEMENT: 6 run(s), 6 PASS, 0 FAIL` | 6 of 6 |
| 17 | `make relay-fuzz-controls` (README: not part of `make`) | `/usr/bin/lockf ... make -C apps/capture-worker relay-fuzz-controls` | 0 | `relay_fuzz controls: 24 of 24 planted flaws found by the fuzz build (seed 186, at most 20 s each)` | 24 of 24 |
| 18 | `row046_adapter_listener.py`, through its database test | from `apps/core-server`, core-file limit 0, heavy-host lock then `.locks/db-migrate.lock`: `npx vitest run --project db --maxWorkers=2 src/modules/capture-config/__tests__/camera-adapter-open.db.test.ts` | 0 | `Test Files 1 passed (1)` / `Tests 11 passed (11)`; `teardown: dropped 2 database(s) ...; 0 remain with the run prefix` | 11 of 11 |
| 19 | guard tests (`test/guard_test.py all`) | part of 1, and again in the build step of 2 | 0 | `guard_test: all 83 checks hold (...; orphans: 0)`; 13 planted lines and 7 mutations refused; import net 19 names, none forbidden | 83 |
| 20 | **KILL MATRIX** | `npm run test:kill-matrix` - **NOT RUN** | - | - | **0 of 35 run** (section 5) |

Nothing failed, so nothing was run a second time (rule: a second run only after a failure). The three runs of the gate fixture are the brief's order, not repeats after a failure.

Source of every line: `.cache/task4-row059/` - `01_make.log`, `10_e2e.log`, `20_...` to `34_...` (one log per row of the table), `steps.tsv` (name, rc, seconds, end time), `hash_trail.tsv`; the series' own folder `.cache/m3worker/e2e/row059/` (`summary.txt`, `summary.json`, one `.out` per check, `build.out`).

## 2. The binaries - and a rebuild that this row did not order

| Moment | `capture-worker` | `capture-relay` | `capture-guard` |
|---|---|---|---|
| Before anything (13:33:48); file times 10:14, 12:20, 10:15 | `fe6bda4e4cf4fb79a726165392e7d7b80c89e42e5af76a739c8a664a7b2a00ba` | `9299b7cc1347c7b224591d3f01954eb3e7a480ec391a1eb63e133268c0ffdaa1` | `6da6c5821890b05f7058665dc841b0d371cbbd6edb1316229e9f68d40ac5f0ca` |
| After this row's `make` (rc 0, 171 s; no link line of the three in its log) | the same | the same | the same |
| **After the build step of the series** (files written 13:37:44, 13:39:07, 13:39:07) and unchanged at every later step (18 samples in `hash_trail.tsv`) and at the end (15:38:30) | `9b942d215156b9d9a2a819b078f4d66f70d9e89cc1903edad4be559c823fde55` | `f70f5d9d6a6288fb640a126ec81072c1c8b8e980b39b39ef98334d4df3baaea1` | `4f1e7a9ce9dc6c8e1a99e857e679ed3e4f4d09d7a48e21f5d17a6fe5a3893b67` |

What happened (measured, not assumed):

1. This row's `make` found the build current: rc 0, the three binaries untouched.
2. At **13:34:17**, while that `make` was running, `apps/capture-worker/Makefile` was changed by another agent: the three fixture compile lines (`fake_mic`, `m5_mic`, `capture-worker-skeleton111`) gained `-D_DEFAULT_SOURCE`. That is agent C1's declared edit (`delegation_progress/file_claims.md`, line "rows 141, 79"; decision C51 names the three lines). The worker's, the relay's and the guard's compile flags did not change (`Makefile:52`, `:106`, `:126` read as before).
3. Every binary has `Makefile` as a prerequisite, so the series' own build step (it runs `make`, `make proof`, `make fixtures`) linked all three again from the unchanged sources. `.cache/m3worker/e2e/row059/build.out` holds that second `make` with the same check lines as section 3 (154 refused, 187, 982, fuzz 0 failures, guard 83).
4. Why the hash moved with the same sources and flags: the link is not byte-reproducible. A third link of the worker's exact line into a scratch path gave a third hash (`99541a08...`, 123,264 bytes against 123,280 before and 123,536 now); the scratch file was removed. So a hash identifies one link, not the sources. (Likely cause, not measured further: `-g` with a one-step compile-and-link records temporary object paths.)

Consequences, as facts:

- **The series and every fixture ran on the binaries of the third row of the table** (the series' checks start after its build step). Rows 44 and 159 (decision C59) observed `815725e3...` / `fe6bda4e...`; the relay those rows saw was already replaced by row 143b, and the worker `fe6bda4e...` is now replaced too - same sources, another link.
- The relay binary the user's instance on port 4423 would start for a connection test was replaced at 13:39:07 (the brief accepts this: same sources as the tree).
- The worker's `make` of table row 1 judged the earlier link; the same checks ran again on the build that produced the present one (point 3).

## 3. Row 1 in detail (`01_make.log`, 192 lines)

`check.sh: src: static rules OK (...)`; 154 lines `refused as required` (the worker's and the relay's planted lines and mutations together) and one `accepted as required`; `anchor_test: all checks hold` with its 5 negative controls failing as required; `micwatch_test: all checks hold (M5-WARN-1)` with its control; `announce_test: all 187 checks hold`; `sink_kill_test: 200 kills in 8.9 s: ... violations 0`; `writer_test: all checks hold (... sync wanted F_FULLFSYNC and stated per file ...)` with 3 controls failing on 2, 3 and 4 checks of their rule and on nothing else; `start_checks: all checks hold`; `log_test: all checks hold` with its control; `relay-check.sh: src/relay: static rules OK`; `relay_unit_test: 982 checks passed; ... 34 of 34 pass`, the same under AddressSanitizer and UndefinedBehaviorSanitizer, 3 controls failing as required (1 sanitizer report; 3 and 6 failed check lines); `relay_fuzz: 864960 inputs over 8 entry point(s) in 16.0 s, seed 186: 0 failures`; `guard_test: all 83 checks hold`.

## 4. The series in detail

- 160 checks = 114 expected PASS + 46 negative controls expected FAIL; `as_expected` true on 160; no expected-PASS check with a non-zero rc; `unexpected: []`; `ports_still_listening: []`; ports 8559 and 8561; libraries libavformat 63.1.102, libavcodec 63.1.102, libavfilter 12.1.102, libswresample 7.1.102, libavutil 61.1.102 from `/opt/homebrew/Cellar/ffmpeg/9.0.2/lib` (`summary.json`).
- Time: the checks 2,605 s; the command 2,881 s from 13:37:09 (wait for the lock and the build included). The longest check: `want_r2_near_bound_clock_step_r2`, 90.1 s (bound 420 s).
- **Load.** 93 of the 160 checks are timing-sensitive. Load at their start: 2.1 to 7.92, every one under the runner's threshold of 8.
- DRIVER DECISION (for the controller to confirm): the series was started with `--load-wait 0` in place of the default 900. Reason: at 13:36 the 1-minute load was 16.07 (11.8 to 12.6 before); with the default the runner would sit up to 15 minutes before each sensitive check WHILE HOLDING the heavy-host lock, which the brief forbids. Effect on the result: none - no sensitive check started above the threshold, so the default would not have waited either (`waited_s` 0 on all 160).
- Row 142's block (17): `br09_right_path_both_cameras_each_its_own_line`, the seven `br09_near_miss_<kind>`, `br09_foreign_line_on_camera_1` / `_2`, `br09_announce_line_absent_refused`, `br09_second_announce_same_address` / `_other_address`, `br09_wrong_path_client_reads_no_secret` = 14 PASS; `neg_br09_right_path_judged_as_a_near_miss`, `neg_br09_line_absent_judged_on_the_release_worker`, `neg_br09_single_announce_judged_as_a_second` = 3 FAIL as expected. Row 178's block (21): 19 PASS, 2 negative controls FAIL as expected. The count 160 is the one row 178 recorded as "not yet run" (`implementation/178_worker_gate_concurrency_leak_test.md:74`).

**The gate fixture three times (row 184's and row 142's open observation).** 12 of 12, 12 of 12, 12 of 12; `INGEST_OPEN_STUCK` in 0 of the three logs; lock holds of 101 s and 107 s for runs 2 and 3 (run 1: 357 s with its wait for the lock). 1-minute load 7.2 at 14:25 and 5.3 at 14:45; the three runs lie between (14:26 to 14:36). As in row 178, this does not establish the cause of the earlier 10 of 12; it did not occur in 36 sessions here nor in the 160 checks of the series.

## 5. The kill matrix: not run - the one open point

What the Verification cell asks: "kill matrix 35 of 35". What was done: `run.sh --list` only (it starts nothing): 35 active cells, 10 parked (`.cache/task4-row059/04_kill_matrix_list.txt`).

Why it was not started:

- The matrix starts the Core as a process, and the Core's worker listens where the product says: `apps/core-server/src/capture/ingest-address.ts:30`, `CAPTURE_INGEST_PORT = { 'VIDEO-01': 8554, 'VIDEO-02': 8556 }`, a frozen constant with no configuration key; the rig says the same (`apps/core-server/src/sealing/__tests__/kill-matrix/rig.ts:8`, `run.sh:9`). There is no way to run a cell on 8559-8564 without changing a product file.
- Driver rule 8: "Ports: never 8554, 8556, 8558 ..."; this row's brief: "worker listeners 8559-8564". Decision C33 gives the reason (the Android emulators); row 191 did not run the matrix for the same reason (`delegation_progress/row_191.md:11`).
- Besides the emulators: a Core of the user on port 4423 is running, and so may be the real-device instance of row 232. Either starts its worker on the same two ports the moment a session starts. A matrix run would make such a start fail, or be failed by it. That is the user's own work, which the rule protects; the conflict between the brief's two orders was resolved to the conservative side.

Facts for the ruling (measured at 13:38 and again at 15:38): nothing listens on 8554, 8556 or 8558; the two running emulators (`dems2_phone -port 5554`, `dems2_tablet -port 5556`) listen on 5554 to 5557 and on ports above 55000, not on 8554 / 8556. So the matrix CAN run physically; what is missing is the controller's word that the two ports may be taken for about 10 minutes while no session is started on the user's instance. The command is `npm run test:kill-matrix` (sandbox off; it takes both locks itself). It should then state the worker hash it ran on (section 2, third row, if nobody rebuilds).

Until then BR-11 is met for the series and its count and NOT met for the kill matrix.

## 6. Row 57 - recorded as skipped for now

Row 57 (`the worker writes hvc1`) was NOT run. Reason: decision U20 (3) - the worker keeps writing `hev1` unless a PRODUCT client refuses it; the deciding tablet measurement is the controller's own device session (U20 (2), C45) and has produced no refusal so far. Row 59 was held for this run-or-skip record (C45); with it, the series above stands for the worker as it is: `capture-worker/0.6.0`, sample entry `hev1`. If row 57 runs later, the worker changes and the series is owed again (README: about 35 minutes; 48 minutes here). Row 34 is skipped by C45 as well; row 58 ran (C27).

## 7. Doubles, what stays unproven, what was not run

- Everything ran on doubles of this Mac, loopback only: generated cameras (`fake_cam`, the FFmpeg pusher, `rtsp_test_camera.py` on 8565 and above), generated microphones, the scripted ONVIF device of row 046's test (8557) and its sink (8563), throw-away databases (2, both dropped). No real camera, no microphone, no credential, no network probe; ports 4423 / 5178 and their instance not touched.
- Unproven, as before: everything on Linux (the fixtures and the series in the container are row 141's; branch B stays provisional, C45 / C51), power loss, a full volume, a volume without hard links, a real camera and microphone (hardware package).
- Not run, because neither the brief's list nor the README's series names them as parts of the series: `rtsp_test_camera_check.py` (the test camera's own check), `row044_e12_search.py` and `row159_relay_hygiene.py` (rows 44 / 159, decision C59), `row010_resumed_push.py`, the two `e11` experiments, `make relay-fuzz RELAY_FUZZ_SECONDS=40` (the long fuzz run).
- The summaries of rows 041, 042, 043, 152, 153, 186 are "of every recorded run" under their cache folders; the counts in section 1 were checked against the run lines of THIS session's logs (they are equal).

## 8. Deviations of this agent

1. **The heavy-host lock was held idle once, for about 9 minutes** (15:16 to 15:25): the first start of row 046's test took the heavy-host lock and then waited for the database lock, which another agent's suite held; C1 was waiting for the heavy-host lock meanwhile. Stopped by this agent (its own two `lockf` processes, pids 18332 and 19139; nothing had started), `steps.tsv` shows that try as rc 143. The run of table row 18 then took the heavy-host lock from the queue and gave the database lock 45 s only (`run_row046.sh`); it got both after 142 s. For the integration pass: the command in the header of `camera-adapter-open.db.test.ts` (heavy first, database second, both with 1,800 s) has this fault built in.
2. `--load-wait 0` (section 4), a driver decision.
3. The brief of batch 9 says "do NOT rebuild anything under apps/capture-worker"; this row's own brief orders one `make`, which was run once. The rebuild of section 2 came from the series' build step after C1's edit.
4. Edit tool only for existing files: kept (one Edit, `file_claims.md`). The three helper scripts under `.cache/task4-row059/` are new files of this session, git-ignored, written by the shell.

## 9. Processes and ports left

At 15:38:30: no listener on 8550-8574; no `capture-worker`, `capture-relay`, `capture-guard`, test camera, fixture or harness process; no `lockf` of this agent. The only matching processes belong to C1 (`.cache/task4-row141/`, `docker exec ... dems-c1-row141`) and were not touched. Throw-away databases: 0 remain.
