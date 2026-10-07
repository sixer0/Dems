# RF-T — final re-test, tablet (emulator-5556, lane 2) — progress

Report: `test/10b_final_retest_tablet.md`. Assets: `test/assets/retest2/t/`. Status: **needs-review** (all checks executed; R-T-4 partial and five new defects).

| Time | Step | State |
|---|---|---|
| 16:35–16:37 | Environment checked (load 10.21 → 7.98; reverse `8081→8081`, `4420→4422`; Core 4422 and web 5177 health 200); drivers adapted (`drivers/*.txt`) | done |
| 16:38 | Force-stop + relaunch `demsdemo:///login?core=LIVE&motion=off` (pid 8856 → 12423); budi signed in 16:38:58 | done |
| 16:39–16:41 | R-T-1 detail and row menus PASS; R-T-2 EV-0017 "Not verified yet" and EV-0015 "Verified by the Core" + last-verification line PASS | done |
| 16:41–16:43 | RF-T-1: the Evidence row that loses the selection is drawn empty (2 of 2; 3 of 3 by 17:24) | defect |
| 16:44:59 | R-T-2c: web Verify (andi) → tablet heading changed without reload at device 16:44:59.399 (+0.23 s after the Core line); audit #222 | done |
| 16:47–16:49 | R-T-3 Bandwidth whole PASS; R-T-4 list column PASS, detail pane 206 dp with subject name missing (RF-T-2) | done (R-T-4 partial) |
| 16:50–16:53 | Crash run 1 (SES-0028 → EV-0018): no crash, Finalizing next frame, no banner, no backward timer; timer held 17 for 10.1 s (RF-T-3); 2 single blank frames at route changes (RF-T-4) | done |
| 17:03–17:07 | Run 2 armed; paused for host load (16.97 > 14) until 11.97 | done |
| 17:07–17:11 | Run 2 (SES-0029 → EV-0019): tablet driver stopped by the 30-min task limit at ~17:07:50 (D-RF-T-1); web session idle-expired at 17:07:35 so the first stop failed (D-RF-T-2); Chrome and drivers relaunched; web stop 17:11:21; clean hand-over | done (deviations) |
| 17:16–17:18 | Run 3 (SES-0030 → EV-0020): clean; 0 blank frames | done |
| 17:21–17:27 | Smoke walk 8/8; sign out → Login; web signed out; browser closed; reverse rules unchanged | done |
| 17:28– | Frame analysis, report, secret scan | done |

Files created (all new; no tracked file modified):

- `test/10b_final_retest_tablet.md`
- `test/assets/retest2/t/` (74 PNG captures, 5 recordings with frames and PTS lists, `rec/analysis/`, `q/`, `wq/`, `misc/`, `drivers/`, `core_log_lane2_window.txt`, `jslog_tablet_full.txt`, `jswarn_tablet_full.txt`, `jserr_tablet_full.txt`)
- `delegation_progress/rf_t_tablet.md` (this file)

Secret scan (count-only, `drivers/scan.mts.txt`):
17:33:48 scanned 197 text files (test/assets/retest2/t/, test/10b_final_retest_tablet.md, this file); password exact 0; password loose 0; token shapes 0; 3+3-digit shapes 39, all tap or swipe screen coordinates in `q/*.cmd` (no pairing code was issued in this row).
