# 108 - Integration pass E2: the worker e2e target after wave E (27 checks without a verdict)

Date 2026-10-10. Driver: coder-execution. Input: `test/03_worker_e2e_wave_e.md` (series `waveE_full`, 113 checks, 86 as expected, 27 NO-RESULT, exit 1). No commit, no migration, no database file, no product file changed.

## Result

Series `waveE_fix` (the 25 unjudged checks that still exist + the 6 checks that replace the 2 retired ones), run ONCE:
`31 checks (13 expected PASS, 18 negative controls expected FAIL): 31 as expected, 0 unexpected`, `ports still listening after the series: none`, `AGGREGATE EXIT CODE 0`, 542 s, load 0.95 .. 2.04, heavy-host lock held by the target. No check waited for a port (`ports were busy` occurs in no `.out`).

## A. Who was `node 62736` on 8563 / 8564

Neither of the two suspected defects. The brief's order of events is not what the artefacts show.

| Evidence | Where |
|---|---|
| `neg_sup_forbidden_mux_option_r1` ended 08:39:49. The next two checks started at once and passed their own "ports busy" guard: `neg_mic_no_compensation_r1` (40.7 s, as expected), `neg_kc3_no_restart_allowed_r1` (as expected, `leftovers: {processes: [], listeners: []}`). 41 further checks ran as expected for the next 10 minutes, among them `sup_av2_pm80_r2`, `kc1_r2`, `kc3_r2`. | `.cache/m3worker/e2e/waveE_full/summary.json` (order), `ls -lT` of the `.out` files |
| The refused start itself was clean: `workerDown CAPTURE_WORKER_PROOF_BUILD` -> `phase IDLE (previous STARTING)` -> `startFailed` -> `timing ... signal SIGKILL` (the supervisor killed the worker). The worker never got a `START` (its log is one line, `worker_starting`), so it never listened. | `neg_sup_forbidden_mux_option_r1.out`; run dir `worker.jsonl` |
| The harness DOES stop its driver on the error path: `cmd_sup` `finally: drv.close(); killall(procs)` (`m3worker.py:1581-1583`; `Driver.close` asks for `exit`, then kills the process group). | code |
| The port holder appears at 08:50:01, between `kc4_longgop_loss_reported_r2` (as expected) and `writer_short_write_truncates_r2`. The 22 "ports busy" checks all fall inside 3 seconds (08:50:01 .. 08:50:04, 0.1 s each). It did not "keep listening until the series ended" for long: the series ended 3 s later. | `.out` times |
| The holder is one `node` process with descriptor 17 on **8564** and 18 on **8563**. The harness starts `node` only as the supervisor driver (`npx tsx capture-session-driver.ts`, listens on nothing) and as `tail_check.ts` / `frames_check.ts` (no socket). The capture worker (a C program) is the only listener of a run. | `m3worker.py:1325`, `:1784`; `m5mic.py:38` |
| `apps/core-server/test/support/fake-onvif-stub.ts:212-227` (`freeFakeOnvifPorts`): the fake ONVIF stub of the core-server unit tests takes its two TCP ports **from the top of 8554-8564**: device = first free = 8564, RTSP = next = 8563, and `start()` listens on the device port first (`:647-650`). Exactly the descriptor order seen. Its comment: "the capture end-to-end harness takes its two from the bottom". The series was started with `--ports 8563,8564`, the top. | code |
| Core-server test runs of other rows were writing at 08:48-08:53 (`.data/test-row61-row140-64710-1/`, `.data/test-row61-row140d131-64883-1/`, `.data/test-row61-d10volume-66456-1/`). | `find -newer` |

Conclusion: a vitest worker of a parallel core-server unit run (a camera-adapter test using `startFakeOnvif`: `ws-discovery`, `discovery-recording`, `lan-probe` or `fake-onvif-stub.test`) took 8564 and 8563 for a few seconds while both were free between two e2e checks. The pid's command line was not captured by the old guard, so the test FILE is not known; the rest is direct evidence.

- (i) harness teardown: not the cause. What WAS wrong in the harness: the guard ended a check at once on a listener that was not its own, so 3 seconds of a foreign fixture cost 22 checks, and it printed `node <pid>` without saying whose.
- (ii) product leak: none. `supervisor.ts` is unchanged. The refusal is now proven on the real binaries (`sup_refuses_proof_build`, below); the in-memory proof was already there (`src/capture/__tests__/fault-lifecycle.test.ts:288-309`, with its control).

Fix (harness only), `apps/capture-worker/test/m3worker.py`:
- `:92-124` `ports_free_or_exit()` replaces the four `if tcp_listeners(): sys.exit(...)` (`:557`, `:1043`, `:1446`, `:1839`). A listener found before the check has started anything is waited for up to `M3_PORT_WAIT_S` (90 s), then the check ends without a verdict as before. Either way the holder is named WITH ITS COMMAND LINE (`port_holders`, `:95`). Nothing is hidden: every check still judges its own `no_leftover`, the runner still looks at both ports after the series, and a wait is written into `summary.txt` / `summary.json` (`ports_waited`, `e2e.py:377-379`).

## B. Controls that started a `-PROOF` build through the supervisor

All of them: **one check, two runs** - `neg_sup_forbidden_mux_option_r1 / _r2` (`sup --mode run --variant negctl`). `cmd_sup` is the only caller of the supervisor driver and that was the only series line giving it a `--variant`. Every other proof build (`negctl`, `delaymoov`, `skeleton111`, `norefusal`, `nocomp`, `writefault`, `writefault-notrunc`, `intervalskew`) runs on the direct worker driver (`run_session` / `run_until`), including all `m5_*` / `neg_m5_*` checks: no M5 check goes through the supervisor.

The product rule stays: no switch, no bypass, `supervisor.ts` untouched. The retired control is replaced by three checks per run (`e2e.py:121-135`):

| Check | Expect | What it proves |
|---|---|---|
| `sup_refuses_proof_build_r{1,2}` (`sup --mode refuse --variant negctl`, `m3worker.py:1541-1576`) | PASS | The SAME binary through the production supervisor: `startFailed CAPTURE_FAULT / CAPTURE_WORKER_PROOF_BUILD`, one `workerDown [CAPTURE_WORKER_PROOF_BUILD, PROOF_BUILD, restartInMs null]`; 3 s later `phase IDLE`, `workerPid null`, one launch, no RECORDING / RESTARTING phase, no worker process alive; no listener on the media ports and none in any process of the run while the supervisor still lives; media folder empty, no record, worker log = `worker_starting` only. First proof of rows 61 / 71b's refusal on the real worker. |
| `neg_sup_release_worker_is_accepted_r{1,2}` (same mode, release worker) | FAIL on `refused_with_proof_build_code` | The control of the line above: the criterion reads the supervisor's answer; a release worker is started (`phase RECORDING`), then stopped. |
| `neg_sup_av_judged_as_no_offset_r{1,2}` (`avcheck --assume-inject-ms 0,0` on the files of `sup_av2_pm80_r{1,2}`, `m3worker.py:740-751`) | FAIL on `av_regression_2ms, av_product_40ms` | The AV judgement of a session recorded THROUGH THE SUPERVISOR can fail: judged as "no offset injected" it is 80.03 / 79.97 ms off. |

What is no longer proven as it was: "a worker with a forbidden mux option, started by the supervisor, yields files that fail the AV bounds". It cannot be, by design. Its parts are covered: the forbidden option breaks AV -> `neg_av_forbidden_mux_option` (direct driver, same binary, same analyser; as expected in r1 and r2); the product build cannot carry the option and every proof build marks its `HELLO` -> row 61's static rules (`make check`: `proof_rule`); the supervisor never records with such a build -> `sup_refuses_proof_build`; the supervisor path's AV judgement is able to fail -> `neg_sup_av_judged_as_no_offset`.

The series is now 117 checks (113 - 2 + 6).

## C. The re-run

```
make -C apps/capture-worker e2e E2E_ARGS="--tag waveE_fix --on-tag waveE_full --ports 8563,8564 --only '<regex of the 31 names>'"
```
`--on-tag` (new, `e2e.py:297`, `:359-363`): a check on a finished run that is not selected reads the run of the named earlier series (here only `neg_sup_av_judged_as_no_offset_r{1,2}` -> `e2e_waveE_full_sup_av2_pm80_r{1,2}`; recorded as `on_run`). Log `.cache/waveE_fix/e2e.log`; results `.cache/m3worker/e2e/waveE_fix/`; runs `.cache/m3worker/runs/e2e_waveE_fix_<check>/`.

Every check as expected. The groups never judged before:

| Check | Verdict | Figures |
|---|---|---|
| `p4_delay_pm80`, `p4_shape_delay`, `p4_stall_pinned` | PASS | +80.015 / -79.985 ms, max error 0.015 ms; stall 0.018 ms |
| `neg_p4_stall_delay_moov` | FAIL as required (both AV bounds) | error 5,770 / 5,930 ms |
| `m5_switch_bound_intervals` | PASS, 10 of 10 criteria | applied delay 5,429 and 4,793 us (bound 21,333); tap boundary error 0 and 0 samples; boundary 45.1 / 46.84 ms before the command (D142 ruling 1) |
| `m5_gap_analyser` | PASS | spacing and position error 0 |
| `neg_m5_gap_1000_removed_at_the_switch` | FAIL as required (count, position, spacing, tone window) | -1,000 samples |
| `neg_m5_switch_bound_judged_at_1us` | FAIL as required | |
| `neg_m5_interval_record_skewed` | FAIL as required, on `interval_record_is_the_tap_boundary` only | |
| `m5_warn_silent_disconnect_never_switch` | PASS, 8 of 8 | raises 0.04 s after their duration, clears 0.05 .. 0.141 s |
| `m5_rate_limit_reported` | PASS | telemetry 5,000.0 ppm on MIC-01 and MIC-02 |
| `neg_m5_rate_inside_the_range` | FAIL as required | |

No M5 or p4 finding. Note for the reader: these prove the WORKER half (row 71a) of the switch and the warnings on the direct driver. Row 71b's session wiring (op 81 through the Core to the supervisor) is not exercised by any check of this target; through the real worker the supervisor is exercised by `sup_av2_pm80`, `kc1`, `kc3`, `sup_nocam` (as expected in `waveE_full`, both runs) and now `sup_refuses_proof_build`.

## Not proven

- Which test file owned pid 62736 (the process was gone before anyone asked; the guard now records it).
- The bounded wait itself was not exercised: no port was busy in `waveE_fix`.
- A foreign fixture that binds a port in the instant between the guard and the worker's own bind still fails that one check.
- The whole 117-check series was not run (only the unjudged checks, as ordered).

## End state

`lsof -nP -iTCP:8563 -iTCP:8564 -sTCP:LISTEN`: nothing (rc 1). `pgrep -fl 'capture-worker|m3worker|e2e.py|ffmpeg|mediamtx'`: five processes, none of this pass - a release `capture-worker` (81883) and four `ffmpeg` helpers (81884-81887) under `.data/test-row61-row86-M7-KM-P4-S6-81865-1/` on ports 8554 / 8556 (row 86's kill-matrix run). Not touched.

## Files

- `apps/capture-worker/test/m3worker.py` - port guard, `sup --mode refuse`, `avcheck --assume-inject-ms`
- `apps/capture-worker/test/e2e.py` - series lines, `--on-tag`, `ports_waited` in the summary

## For the controller

1. Port assignment: 8563 / 8564 are where the fake ONVIF stub looks first. Give the worker e2e a pair from the bottom (its default 8555, 8557) or keep core-server unit runs with the camera-adapter tests out of the e2e's window. The wait added here only absorbs a short overlap.
2. Request to the owner of `apps/core-server/test/support/fake-onvif-stub.ts` (not in this pass's area): `freeFakeOnvifPorts` (`:212-227`) takes any free port of the shared range with no lock; a rule ("never the pair an e2e series holds", or its own sub-range) is theirs to decide.
3. Request to the owner of `apps/capture-worker/README.md:79`: the row names `neg_sup_forbidden_mux_option`; the names are now `sup_refuses_proof_build`, `neg_sup_release_worker_is_accepted`, `neg_sup_av_judged_as_no_offset`.
4. D168's sentence "then a `node` process kept listening ... after a refused start" should be corrected: the two events are 10 minutes apart and unrelated.
5. Accept or reject: the series grew by 4 checks (about 12 s per series).
