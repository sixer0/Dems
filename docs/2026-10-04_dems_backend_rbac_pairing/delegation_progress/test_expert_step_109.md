---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: test-expert (tier R)
blueprint_row: 109 (plan W87, test completion and the test strategy and coverage report)
date: 2026-10-06
status: needs-review (all work done and verified; test/01_test_report.md could not be written by this agent, see 08:40)
evidence_tier: 2
---

# test-expert progress: step 109 (W87)

All times WIB. No credential, token, password or pairing code is in this file.

## Milestones

| Time | Milestone |
|---|---|
| 05:33 | Started. Read the plan row W87, plan sections 8.1, 11, 12, 13; client spec section 8 and AC-C-53, AC-C-56, AC-C-101; server spec section 7 and AC-B-68; decisions routed to W87 (D121(4), D127(3), D147 DN-2, D171 F-8, D179 DC-6, D180 DN-5). Load 2.50. Scratch `.cache/w87/` created |
| 05:37-05:41 | Operation map: the server's `unit` (154 / 3,916) and `db` (122 / 1,740) projects run once through a scratch configuration with a response probe (`.cache/w87/opmap/`); 18,235 answers, 12,447 matched to the 75 operations. Result: every operation has a success test, all 41 with a permission a denial test, all 25 with a body a validation test, each in the `db` project. No server gap test needed |
| 05:56-06:01 | Mutation evidence in memory (`.cache/w87/mut/`: a Vite transform plugin and an fs-read patch for the web, a wrapping jest transformer and an fs-read patch for mobile; no tree file changed). 15 mutations: 14 detected at once; M-L1 (S4-7 heartbeat effect switched on in LIVE) survived, the S4-7 test was strengthened (spy on the source's `setTabletLink`, no `runtime.coreLink.tabletLink` line) and M-L1 is then detected (5 calls). 15 of 15 |
| 05:59-06:01 | D171 F-8 diagnosed in memory: the two baseline suites print the worker-exit warning; with the runtime log's 2 s flush timer unref'd in memory (`runtime/log.ts:171`) the warning is gone. Finding, no tree change |
| 06:02-06:13 | Typecheck and lint web, mobile exit 0. Full runs: shared 69 / 1,840; web 103 / 1,392; mobile 145 / 1,739; server unit 154 / 3,916; mock-core 4 / 19 (bypass); server db 122 / 1,740 (bypass, 0 databases left); coverage (both projects, bypass) 276 / 5,656, lines 96.93 %, statements 95.78 %, branches 90.12 %, functions 97.81 %. All exit 0 |
| 08:15 | RESUMED after the controller's stall notice (stream interrupted after 06:13). `find -newer coverage_run.log` over `apps/` and `packages/`: no file changed since 06:13. The 7 new files are complete; typecheck web and mobile exit 0; the new tests alone: web 2 / 8, mobile 5 / 18, exit 0. Next: assets, the four tables, the report, a final fresh run of every suite |
| 08:16-08:24 | Mutations re-run with fresh caches: 15 of 15 detected (M-L1 included). The site scan showed S1-3 named only in a file header (`auth/live-auth.test.tsx`), so four S1-3 tests were added to `features/settings/live-gap-s1-2-biometric.test.tsx` (now 8 tests); two more mutations (M-B3, M-B4) detected: 17 of 17 |
| 08:25-08:32 | FINAL fresh runs: shared 69 / 1,840; web 103 / 1,392; mobile 145 / 1,743; server unit 154 / 3,916; mock-core 4 / 19; server db 122 / 1,740 (0 databases left). Typecheck and lint web, mobile exit 0. The 78 protected test files identical to 06:07 and clean against HEAD. Assets `test/assets/01_*` written (32 files) |
| 08:40 | **BLOCKED for one artifact:** writing the report (first a template under `.cache/w87/parts/`, then `test/01_test_report.md`) was refused by the harness: "Subagents should return findings as text, not write report files". Not worked around. The full report text, with the four tables, is in this row's final response for the controller to persist as `test/01_test_report.md`; the generated tables are also in `.cache/w87/parts/{op_table,site_table,ac_table,ac_table_compact,coverage_area}.md` and the data in `test/assets/01_*` |
| 05:42-05:55 | New tests written, each run green alone: web `src/test/live-static-ac-c-53.test.ts` (6), `src/test/live-gap-indicator-connecting.test.tsx` (2); mobile `src/lib/live-static-ac-c-53.test.ts` (6), `features/session-live/live-gap-read-only-dialog.test.tsx` (1), `features/session-live/live-gap-s4-7-tablet-link.test.tsx` (1), `features/settings/live-gap-s1-2-biometric.test.tsx` (4), `features/pairing/live-gap-sites.test.tsx` (6) |

## Deviation log

- 05:33 one read-only command began with `cd /Users/gsp-budi/Documents/DEMS` (the repository root, no write). Not repeated.
- 05:40 one command copied this row's own scratch script to `packages/shared/.w87-tmp-never.ts` and removed it in the same command line (a leftover of a discarded idea, before the analysis ran from `.cache/w87/`). The file never existed before and does not exist now (`ls` at 05:41: "No such file or directory"). No other file of the tree was touched by it. Recorded because the row's rule is "never delete a file"; the only file removed was the row's own, created a moment before.
