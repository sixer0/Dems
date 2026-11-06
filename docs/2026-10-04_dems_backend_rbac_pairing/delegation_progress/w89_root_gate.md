# verifier - W89 root gate (section 11.2)

Status: needs-review (every gate count equals the D238 ledger; test:db exit 0; root `npm test` exit 1 from 2 mobile timeout flakes under load 16.73, each green on an immediate re-run alone and inside the 2-worker mobile run)

| Time (WIB) | Event |
|---|---|
| 05:10 | Read W89 row, plan 11.1-11.3, D238/D195/D232/D233. Ports 4400/4410/4411/4420-4423/5173/5176-5178/8081 free; 4432 = postgres 19121. Load 2.45 |
| 05:10 | pg:status (outside the sandbox) OK running PID 19121; `npm run pg:stop` exit 0; pg:status "NOT RUNNING", exit 3; lsof 4432 empty |
| 05:11 | typecheck exit 0; lint exit 0 (no diagnostics) |
| 05:11-05:16 | root `npm test` (outside the sandbox) exit 1: mobile 2 failed / 1930 passed / 1932 (5 s timeouts in live-session-new-followups:166 and more-live:76); load peaked 16.73; other workspaces green |
| 05:16 | Waited for load < 14; re-ran each failing file alone: 9/9 and 5/5 PASS (flakes) |
| 05:16-05:22 | 2-worker runs: shared 70/1848, mock-core 4/19, core-web 111/1436, mobile 181/1932, server unit 155/3926, pg-scripts 57/57; all exit 0, all equal to the ledger |
| 05:22 | `npm run pg:start` exit 0 (PID 48897); pg:status OK, HA-1 to HA-4 PASS |
| 05:22-05:24 | `npm run test:db` exit 0: 124 files / 1751 tests (equal to the ledger; pg-behaviours green on the old-settings cluster, D195) |
| 05:24 | Final: pg:status OK running PID 48897; client ports free; git porcelain md5 unchanged (9154ddad...) |
| 05:25 | Report written: gateway_check/10_root_gate.md + 22 assets 10_root_* |

Files: gateway_check/10_root_gate.md; gateway_check/assets/10_root_01..19_*.log, 10_root_20_count_lines.txt; this file; one row appended to delegation_progress_report.md.
Decision needed (controller): accept the flake record for AC-B-58, or order one more root `npm test` at low load.
