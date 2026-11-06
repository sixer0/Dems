# coder-execution — step 91, plan row W69 (Web Evidence in Live mode)

Status: complete (23:37)

| Time (WIB) | Milestone |
|---|---|
| 22:40 | Started. Read the plan row, [CS] §8 (A5, A6, B-1, C-5, D-1, D-6), §14 point 7, gateway 08 §8 + §30, W54 §21.2, the harness, W63's page pattern, the server's evidence log 35 |
| 22:47 | Pre-images: `.cache/rollback/W69/pre/` (36 files, `pre.sha256`); `W69.pre.patch` is 0 bytes (the folder equals `acaff20`) |
| 22:47 | Controller note D152 received: busy mark on the nearest container (F63-2); Simulated screenshot by the simulator's stored sign-in (F63-3, W63 DV-2); lane 3 free; floor web 62 files / 853 tests |
| 22:59 | Production code written: `log.ts` (sink), `use-pending-action.ts`, `use-archive.ts` (B-1), `use-evidence-media.ts` (op 40, MS-2), `export-outcome.ts`, `use-verification.ts` (A6, D-1), `sim-adapter.ts` (no `.actions` read), `integrity-tab.tsx`, `detail-page.tsx`, `list-page.tsx`, `evidence-table.tsx`, `export-wizard.tsx` (A5, C-5, D-6), `evidence.css`, i18n `evidence.live.*`. tsc: only W70's `live-devices-drawer.test.tsx:372` red (not mine); oxlint folder exit 0; folder tests 4 files / 28 passed |
| 23:05 | Controller note: my new `__tests__/live-evidence-bed.ts` imported a type from `@dems/shared/live/testing` and turned `live-runtime-static.test.tsx` (TS-15) red at 23:04. Fixed: the type is derived from the harness (`ReturnType<LiveTestBed['fake']['example']>`); the static test is 9/9 green at 23:05:57. `live-evidence-verify.test.tsx` 10/10 green |
| 23:14 | Live tests written and green: `live-evidence-verify` 10, `live-evidence-export` 10, `live-evidence-archive` 13 (33 tests, 3 files); with the folder's 4 files and the static runtime test: 8 files / 70 passed. `typecheck` exit 0, `lint` exit 0 (23:13). Next: lane 3 check |
| 23:18 | Lane 3 check done (23:17:23 to 23:18:31, lockf exit 0): A6 Core verdict FAIL on AUDIO-02 for EV-20261003-0005, PASS for 0001; A5 refused by the Core (422) back on Reason; D-6 INVESTIGATOR 403 with one EXPORT_DENIED guard row (0 to 1); Simulated: 0 API requests, 0 dev-server sockets; 7 screenshots `assets/69_*.png`; ports 4423/5178/9398 free after |
| 23:20 | Finding F69-1 from the lane counts: StrictMode (every Live session, dev builds) sent the wizard's source check and the list hand-off's verification twice. Fixed (start waits one task) with two StrictMode regression tests; verify file now 12 tests |
| 23:21 | Mutation check (M15, in-memory) started: 29 mutations; baseline 3 files / 35 tests green. Draft `implementation/69_web_evidence.md` written |
| 23:30 | Mutation check: 29 mutations, 29 detected, 0 survived (in memory; no file of the tree changed) |
| 23:34 | Whole web suite: 71 files / 958 tests, exit 0 (floor 62 / 853); `@dems/shared` 68 / 1,814 exit 0; typecheck and lint of both workspaces exit 0 (23:35); row run 8 files / 72 tests (23:36) |
| 23:37 | `implementation/69_web_evidence.md` complete; assets `69_*` (7 screenshots, lane log/json/scripts, gate log, CLG (a)/(c) log, mutation log/runner/config) |

## Files created or updated by this row

| Kind | Path |
|---|---|
| updated | `apps/core-web/src/features/evidence/{detail-page.tsx,evidence-table.tsx,evidence.css,export-wizard.tsx,integrity-tab.tsx,list-page.tsx,log.ts,sim-adapter.ts,use-verification.ts}` |
| created | `apps/core-web/src/features/evidence/{export-outcome.ts,use-archive.ts,use-evidence-media.ts,use-pending-action.ts}`, `apps/core-web/src/features/evidence/__tests__/live-evidence-bed.ts` |
| created | `apps/core-web/src/test/live-evidence-{verify,export,archive}.test.tsx` |
| updated (additive) | `packages/shared/src/i18n/en/evidence.ts` (`evidence.live.*`) |
| docs | `implementation/69_web_evidence.md`, `implementation/assets/69_*`, this file |

## For the controller

Contract gaps: CONTRACT-GAP-W69-1 (no `notPermitted` 403 example for operation 41), CONTRACT-GAP-W69-2 (no evidence key in `CORE_QUERY_KEYS`). Finding F69-1: StrictMode sends a mount-effect command twice in every Live session (fixed in this folder; DC-2 asks to brief the other rows). Decisions DC-1 to DC-5 in §13 of the row's document. Ledger: web +3 files / +35 tests; shared +0.
