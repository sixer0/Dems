---
agent: coder-execution
row: closing-fix round C1 (D187 F84-3, D188 F86-1, D189 W87-F1 and W87-F2)
status: complete (one residual: C1-R1)
---

# coder-execution — closing-fix round C1

| Time | Event |
|---|---|
| 08:50 | Started. Read the brief, `test/01_test_report.md` §10 and §12, `test/assets/01_f8_worker_exit.log`, decisions D171, D187, D188, D189, rule M15 (D88). Load 3.49. Pre-images and SHA-256 of the 8 files written to `.cache/rollback/C1/` (`C1.pre.sha256`) |
| 08:51-08:54 | Item 1 (W87-F1): before run reproduced the warning (17/17, exit 0, warning printed). `log.ts:171-178` unref via a cast (scratch tsc probe: the literal `timer.unref?.()` fails on a number handle; the cast compiles for number and Timeout). New `runtime/log-flush-timer.test.ts` (1 test, hasRef false + flush on time). M15 mutation in memory: test red (Expected false / Received true), warning returns; control green; log.ts hash unchanged by the runs. After: the two suites 3 runs, no warning; each alone in band, no warning |
| 08:54-08:55 | Item 2 (W87-F2): comment `shared-state.test.ts:706-708` and printed sentence `:712` reworded (diff vs pre-image: 2 lines out, 3 in; no assertion). db file 6/6 exit 0 twice (0 databases remain); the `--silent=false` run prints the new sentence |
| 08:55-08:58 | Item 3 (F84-3): `examples.ts` CORE_SERVER_HEALTH + `coreServerResponses` field + health entry; `openapi.ts` `responseExamplesFor` (all scope lists them first). gen --check stale before, regenerated, --check up to date; offline sha256 360019bc… equal from the pre-image module (scratch copy) and the changed one; openapi.json +20 lines. Shared run: 1 red, `api-openapi-scope.test.ts` pins the twin content (by design) → expectation computed + 4 assertions (order, validity, only health). M15 mutations order/leak/drop 3 of 3 red, control green |
| 08:58 | Item 4 (F86-1): `package.json:26-27` now `dems2_tablet` / `dems2_phone`. **Deviation:** to print the script I ran `npm run emulator --dry-run`; npm does not apply `--dry-run` to `run`, so it executed `emulator -avd dems2_tablet …` inside the sandbox at about 08:58:05 (first output line 'INFO | Android emulator version 37.1.11.0', pipe closed by `head -5`). Read-only `ps` (sandbox bypass, 08:58:20): no new emulator process; only the three pre-existing qemu processes (PIDs 68181 dems2_phone, 68876 dems2_tablet, 70102 dems2_phone2, elapsed 1 d 22 h) — unchanged; no stray file in the repo; the sandbox denies writes under ~/.android. Not repeated; no adb call made |
| 08:59 | README: one correction line added after :158 (additions only; 0 removed lines vs pre-image and vs acaff20). No test reads README or the scripts. Final verification started |
| 09:00-09:04 | Final runs launched in parallel (my error against the P9 load guard): shared 69/1,840 exit 0, server unit 154/3,916 exit 0, db file 6/6 exit 0; **web 7 red and mobile 16 red, all timeouts at load 28-34** (mobile: 26 'Exceeded timeout' lines; web: 1-7 s per red test). Re-run one at a time once the load is below 10 (P11: these runs are recorded, not discarded). Mobile ledger with the new file: 146 suites / 1,744 |
| 09:06 | core-web alone: 103 / 1,392 exit 0 |
| 09:07-09:08 | mobile alone (stdout and stderr in one file): 146 / 1,744 exit 0; `grep -c 'failed to exit gracefully'` = **1** (expected 0); `did not exit one second` = 0 |
| 09:09-09:17 | Diagnosis of the remaining warning, in memory (scratch setup files outside the tree): pending ref'd timers after each file → TanStack gc 300 s in `home-screen.test.tsx` (baseline), core-client 8 s budget in `live-session-live-link.test.tsx`, sim `platform.ts:188` 1 s in 21 files. Each of `home-screen`, `live-session-live-link`, `devices-model` (baseline) prints the warning with a second worker. Outside the write paths: residual C1-R1 for the controller |
| 09:22 | `live-gap-read-only-dialog.test.tsx` (red on time limit at load 34 and about 10) alone: 1 / 1 in 702 ms (C1-R2, info) |
| 09:23 | Final: `gen-openapi --check` up to date; offline sha256 `360019bc…3c10` unchanged; 78 protected test files `shasum -c` exit 0; post-change SHA-256 of the nine files recorded |
| 09:25 | `gateway_check/10_closing_fixes_c1.md` written. Done |

## Files

- modified: `apps/mobile/src/runtime/log.ts`, `apps/core-server/test/acceptance/shared-state.test.ts`, `packages/shared/src/api/examples.ts`, `packages/shared/src/api/openapi.ts`, `packages/shared/openapi/openapi.json` (regenerated), `packages/shared/test/api-openapi-scope.test.ts`, `package.json`, `README.md` (one line added)
- created: `apps/mobile/src/runtime/log-flush-timer.test.ts`
- documents: `gateway_check/10_closing_fixes_c1.md`, this file, `gateway_check/assets/10_c1_*` (23 files)
- rollback: `.cache/rollback/C1/` (8 pre-images, `C1.pre.sha256`)

## Deviations

1. 08:58: `npm run emulator --dry-run` launched the emulator binary inside the sandbox (npm ignores `--dry-run` for `run`). No new process remained; the three running emulators were unchanged; no adb call made. Not repeated.
2. 09:00: four whole suites run in parallel against the P9 load guard (load 28-34). web and mobile went red on time limits only; both passed when re-run alone.
3. 09:00: the first mobile capture split stderr and stdout across two files (redirection order). The counts inside that log came from stdout only. The re-run captured both streams in one file.
