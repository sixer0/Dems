# coder-execution — step 98 (plan row W76): Web System and the Demo Control Panel in Live mode

Status: complete (02:23 WIB) — report `implementation/76_web_system_demo.md`

| Time (WIB, 2026-10-06) | Milestone |
|---|---|
| 01:15 | Brief read; plan row W76, [CS] §7.3 G14, §8.2 A8/A10/A11, §8.3 B-10, §8.4 C-7/D-4, AC-C-48/52/60; 08 §8 + §30; 08a §15; implementation/40, 43, 50, 54, 63 read |
| 01:24 | Pre-images of the whole `features/system/` folder and `en/system.ts` saved under `.cache/rollback/W76/` with SHA-256 (`sha256_pre.txt`); both unchanged against `acaff20` and HEAD `b90a3c6` |
| 01:37 | Production code written in `features/system/` (new: `live.ts`, `live-log-export.ts`, `export-logs-dialog.tsx`; changed: `use-sim-command.ts`, `sim-adapter.ts`, `diagnostics.tsx`, `demo-panel.tsx`, `update-panel.tsx`, `settings-panel.tsx`, `quick-actions.tsx`, `index.tsx`, `log.ts`) and `system.live.*` keys (additive) in `en/system.ts` |
| 01:38 | `typecheck` and `lint` of `@dems/core-web` exit 0 (0 warnings); the folder's 2 existing test files + the StrictMode guard + runtime static + routes: 5 files / 69 tests exit 0 |
| 01:48 | Four Live test files written and green alone: `live-system-maintenance` 16, `live-system-export` 10, `live-system-demo` 20, `live-system-settings` 15 (61 tests) |
| 01:49-02:02 | Mutation check (M15, in memory, W0's config pattern under `.cache/w76/mut/`): 27 mutants; 4 survivors of the first pass (X07, X08, C03, C04) killed by 4 added tests; final 26 of 27 detected; P02 survives by design (behaviour equal under the ref marker; caught only by the on-disk static rule). Tree files identical before/after every batch |
| 02:00 | Controller note D172 received: `runtime/testing/live-harness.ts` and `test/live-pending-control.test.tsx` may be red by design (W0's owner fixing); not to be edited |
| 02:05-02:06 | Lane 3 check under `.locks/core-server.lane3.lock` (lockf exit 0), backend 4423 started with `DEMS_DEMO_CONTROLS=1`, Vite 5178, headless Chromium: System in Live, A10 202, A8 export EXP-000034 with a reason (file 155 audit rows = stored chain 1..155, 117 events), panel present for OPR-002 and absent for OPR-001; ONE demo action announced 02:06:23 WIB: resetDemo on lane 3, epoch 18 -> 19; all three processes stopped, 4423/5178/9398 free. Assets `76_lane_*`, 8 screenshots `76_*.png`; secret scan by count: 0 |
| 02:07-02:13 | Gate: web 93 / 1,242 exit 0 (02:07:50-02:11:34); shared 68 / 1,814 exit 0 + typecheck + lint 0; core-web typecheck 0, lint 0 warnings; CLG (a)/(c) evidence `assets/76_gate_clg.log` |
| 02:14-02:21 | Controller note D176 (F75-2): the log walk now asks before every page whether an operator is signed in; test "D176" (+1) and mutant X10 (detected). Re-gate: typecheck 0, lint 0 warnings, web **93 / 1,244** exit 0 (02:18:44-02:20:54, load 2.65) |
| 02:22 | Document `implementation/76_web_system_demo.md` written |

## Summary for the controller

- Sites A8, A10, A11, B-10, C-7, D-4 in Live mode; AC-C-52 gate; AC-C-60 log file from all pages of 59 and 63; CPC1-22 reason dialog; D176 guard.
- CLG (a)-(d) PASS; web 93 / 1,244 exit 0; shared 68 / 1,814 exit 0; typecheck and lint of both exit 0 (0 warnings).
- Lane 3 reset once at 02:06:24 WIB (epoch 18 -> 19, lineage 1); W75/W77/W81 see a fresh seed after that.
- Contract gaps: CONTRACT-GAP-W76-1 (reset 503 `details.reason` dropped by the Live layer), -2 (op 65 no `notPermitted` example), -3 (op 62 `rows`/`head` not passed by the binding).
- Decision asked: DC-1 remove the `system/sim-adapter.ts` entry from W0's guard `ALLOWED` list (now unused).
