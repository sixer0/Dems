# Test report 03 - capture worker e2e target, wave E (tag waveE_full)

Runner: test-expert (Sonnet 5.5), D122 test-runner role. One run, no repeat, no file changed except this report. Sandbox off for the build and the series (loopback binds).

## Commands (each run once)

```
make -C apps/capture-worker                                                             # build, exit 0
make -C apps/capture-worker e2e E2E_ARGS="--tag waveE_full --ports 8563,8564"           # the series
```

| Item | Value |
|---|---|
| Build | start 2026-10-10 08:23 +0700, end 08:24:04, exit 0 (check, selftest, anchor_test, micwatch_test, sink_kill_test, writer_test, log_test all printed "all checks hold" / "fails, as required") |
| Series start | 2026-10-10 08:24:06 +0700 (heavy-host lock obtained at once, no wait) |
| Series end | 2026-10-10 08:50 +0700 (summary.json written 08:50; the log was read at 08:52:30); `seconds` in summary.json: 1532 |
| Heavy-host lock | held by the target itself ("heavy-host lock held (.locks/heavy-host.lock)") |
| Load at the start of timing-sensitive checks | 0.73 .. 3.79 |
| AGGREGATE EXIT CODE | **1** |

Harness summary line, verbatim start: `113 checks (76 expected PASS, 37 negative controls expected FAIL): 86 as expected, 27 unexpected: ...`
Harness line after it, verbatim: `ports still listening after the series: [8563, 8564]`

## Count by result

| Result | Count |
|---|---|
| As expected | 86 |
| Not as expected | 27 (every one printed `got NO-RESULT rc 1`, none printed a PASS/FAIL verdict contrary to its expectation) |
| Total | 113 (76 expected PASS, 37 negative controls expected FAIL) |

Earlier row docs quote 105 checks; this tree has 113 (the m5_ and p4 checks were added since).

## Artefact locations (named by the harness)

- Log of this run: `.cache/waveE_full/e2e.log`; build log: `.cache/waveE_full/build.log`
- Series results: `.cache/m3worker/e2e/waveE_full/` (`summary.txt`, `summary.json`, one `<check>.out` per check)
- Per-check run directories: `.cache/m3worker/runs/e2e_waveE_full_<check>/`

## Checks not as expected

### Group 1 - one check that raised an exception (first unexpected check in time order)

| Check | Expected | Got | Criterion / line the harness printed | Artefact |
|---|---|---|---|---|
| `neg_sup_forbidden_mux_option_r1` | FAIL | NO-RESULT, rc 1 | `RuntimeError: timeout waiting for started S-M3SUP-RUN; last events: [{'event': 'workerDown', ... 'down': {... 'code': 'CAPTURE_WORKER_PROOF_BUILD', 'detail': 'PROOF_BUILD', 'exitCode': None, 'signal': None, 'attempt': 1}, ... {'event': 'startFailed', ... 'error': 'the capture worker could not be started', 'code': 'CAPTURE_FAULT', 'detail': 'CAPTURE_WORKER_PROOF_BUILD'} ...` (traceback ends in `m3worker.py:1345 sup_session` called from `cmd_sup` at line 1409) | `.cache/m3worker/e2e/waveE_full/neg_sup_forbidden_mux_option_r1.out`; run dir `.cache/m3worker/runs/e2e_waveE_full_neg_sup_forbidden_mux_option_r1/` |

### Group 2 - 22 checks that stopped before start with a port message

Each of these printed, as the last line of its `.out`:
`ports busy before start: ['node      62736 gsp-budi   17u  IPv4 0x... 0t0  TCP 127.0.0.1:8564 (LISTEN)', 'node      62736 gsp-budi   18u  IPv4 0x... 0t0  TCP 127.0.0.1:8563 (LISTEN)']`
(same pid 62736 in every one; socket handles differ between the first group below and the second).

First block (r2 repetition of the negative controls and wants, run after `kc4_longgop_loss_reported_r2`), `.out` in `.cache/m3worker/e2e/waveE_full/`:
`writer_short_write_truncates_r2`, `neg_kc2_file_not_cut_r2`, `neg_kc4_camera_inside_the_bound_r2`, `neg_writer_no_truncation_r2`, `neg_av_forbidden_mux_option_r2`, `neg_av_mic_latency_5ms_r2`, `neg_av2c_reports_without_rate_r2`, `want_r2_near_bound_steady_delay_r2`, `want_r2_near_bound_clock_step_r2`, `want_f6_camera_clock_sanity_bound_r2`, `neg_bind_skeleton_r2`, `neg_sup_forbidden_mux_option_r2`, `neg_mic_no_compensation_r2`, `neg_kc3_no_restart_allowed_r2` (14 checks; criterion line: the `ports busy before start` line above; expected: 1 PASS-expected writer check, 2 want_r2 PASS-expected, 1 want_f6 PASS-expected, the rest FAIL-expected)

Second block (the single-run checks), same message:
`p4_delay_pm80`, `p4_stall_pinned`, `neg_p4_stall_delay_moov`, `m5_switch_bound_intervals`, `neg_m5_interval_record_skewed`, `m5_warn_silent_disconnect_never_switch`, `m5_rate_limit_reported`, `neg_m5_rate_inside_the_range` (8 checks)

Artefact for each: `.cache/m3worker/e2e/waveE_full/<check>.out` (the message is the whole stderr; no run directory content produced).

### Group 3 - 4 checks that read a result of a check of Group 2

| Check | Expected | Got | Line the harness printed | Artefact |
|---|---|---|---|---|
| `p4_shape_delay` | PASS | NO-RESULT, rc 1 | `FileNotFoundError: [Errno 2] No such file or directory: '.../.cache/m3worker/runs/e2e_waveE_full_p4_delay_pm80/result.json'` | `.cache/m3worker/e2e/waveE_full/p4_shape_delay.out` |
| `m5_gap_analyser` | PASS | NO-RESULT, rc 1 | `FileNotFoundError: ... runs/e2e_waveE_full_m5_switch_bound_intervals/truth.json` | `.cache/m3worker/e2e/waveE_full/m5_gap_analyser.out` |
| `neg_m5_gap_1000_removed_at_the_switch` | FAIL | NO-RESULT, rc 1 | `FileNotFoundError: ... runs/e2e_waveE_full_m5_switch_bound_intervals/truth.json` | `.cache/m3worker/e2e/waveE_full/neg_m5_gap_1000_removed_at_the_switch.out` |
| `neg_m5_switch_bound_judged_at_1us` | FAIL | NO-RESULT, rc 1 | `FileNotFoundError: ... runs/e2e_waveE_full_m5_switch_bound_intervals/result.json` | `.cache/m3worker/e2e/waveE_full/neg_m5_switch_bound_judged_at_1us.out` |

Count: 1 + 14 + 8 + 4 = 27, equal to the harness list.

## What the log shows, without attribution of cause

- All `_r1` checks other than `neg_sup_forbidden_mux_option_r1` were as expected, including `sup_av2_pm80_r1`, `kc1_r1`, `kc3_r1`, `sup_nocam_r1` (the checks the row 71a note said failed before row 71b).
- All `_r2` checks up to and including `kc4_longgop_loss_reported_r2` were as expected; `writer_short_write_truncates_r2` is the first with the ports message. `chain_replay_same_bytes_r2`, `neg_chain_replay_one_byte_changed_r2`, `neg_h4_reencoded_r2`, `neg_av2b_drift_judged_as_none_r2`, `neg_continuity_cut_r2`, `neg_continuity_toneslip_r2`, `neg_gop50_judged_as_250_r2`, `p4_shape_pinned` and `mg1_no_media_in_git` were as expected afterwards (their `.out` carries no ports message; run times 0.1 to 0.6 s).
- No check that actually ran against the worker after `neg_sup_forbidden_mux_option_r1` produced a verdict contrary to its expectation; the checks from Group 2 and 3 produced no verdict at all, so the following were NOT judged in this run: the second repetition of 14 writer / negative-control / want checks, `p4_delay_pm80`, `p4_shape_delay`, `p4_stall_pinned`, `neg_p4_stall_delay_moov`, and all 8 `m5_` checks plus their 4 negative controls (`m5_switch_bound_intervals`, `m5_gap_analyser`, `m5_warn_silent_disconnect_never_switch`, `m5_rate_limit_reported`, `neg_m5_gap_1000_removed_at_the_switch`, `neg_m5_switch_bound_judged_at_1us`, `neg_m5_interval_record_skewed`, `neg_m5_rate_inside_the_range`). Rerunning these requires the controller to resume the driver (D122 rule 4).
- The harness itself named the leftover: `ports still listening after the series: [8563, 8564]`.

## Cleanup confirmation

After the series ended (checked 2026-10-10 about 08:55 +0700, sandbox off):
- `pgrep -fl "capture-worker|m3worker|e2e.py|ffmpeg|mediamtx"`: no process (rc 1).
- `lsof -nP -iTCP:8563 -iTCP:8564 -iUDP:8563 -iUDP:8564`: nothing listening (rc 1).
- `ps -p 62736`: no such process (it was gone by the time I looked; I killed nothing).
- The heavy-host lock was released by the target on exit (no `lockf` child of mine remains). I did not touch `.locks/db-migrate.lock`, any database, `.data/`, the local devices, or ports 5173-5175, 8000, 5432.

## Files

- Written: this report only.
- Scratch (git-ignored): `/Users/gsp-budi/Documents/DEMS/.cache/waveE_full/` (build.log, e2e.log, build_start.txt, e2e_start.txt).
