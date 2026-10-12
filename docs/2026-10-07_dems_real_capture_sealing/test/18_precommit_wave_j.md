---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-12
agent: test-expert (test runner, D122)
scope: pre-commit regression of the uncommitted fix wave J (notes 167..175) on top of commit 035150b
status: complete
result: GREEN (every step green, script exit code 0, no red, nothing run twice)
---

# Pre-commit regression of fix wave J (2026-10-12)

Runner only (D122): no product file, no test file, no git write, no install, nothing fixed. The one command was
`DEMS_REGRESSION_SKIP_WORKER_E2E=1 npm run test:regression`, run ONCE, outside the command sandbox (loopback ports and PostgreSQL).
Nothing was red, so no suite ran a second time.

Start 12:03:49, end 12:26:35 (**22 min 46 s**, 1366 s) in the script's own run. Lanes: `lane.sh stop 1` and `lane.sh stop 2` at 12:03
(both reported "stopped", PIDs 5105 and 4987, exit 0, not piped); `lane.sh status` afterwards and at the end: main, 1, 2, 3 all `stopped`.
Nothing reset, lane 2's data untouched, no lane started. Metro and the two emulators were not touched (no adb). No `.data/pg*.env`
read; PostgreSQL only through the db test project under `.locks/db-migrate.lock` (`pg:status` read-only before the run); no port 5173-5175 /
8000 / 5432; no local-device selector, no `DEMS_*_ATTENDED` (step 14 runs with them `env -u` unset by its own script); no audio played.
Before the start: 1-minute load 3.53 (below 4, as ordered). Flags set: only `DEMS_REGRESSION_SKIP_WORKER_E2E=1` by me; the script's steps 13 to 15
set `DEMS_SEAL_E2E=1`, `DEMS_DEV_SESSION_E2E=1` and (inside kill-matrix.sh) `DEMS_KILL_MATRIX`.

Raw log (every line time-stamped by a wrapper of mine, 53 MB, 556,518 lines): the scratchpad of the session, not in the repository
(`.../scratchpad/regression.log`; per-step excerpts are below). The load was sampled every 15 s into `load.log` of the same folder.

## 1. How the regression script behaved (`scripts/test/regression.sh`, first real run)

| Question | Answer (evidence) |
|----------|-------------------|
| Does it run as documented? | YES. 15 numbered steps ran in the header's order (1 typecheck, 2 lint, 3 shared, 4 capture-protocol, 5 core-server unit, 6 core-server db, 7 core-web, 8 mobile, 9 transcriber, 10 mock-core, 11 pg-scripts, 12 capture worker checks, 13 seal e2e, 14 development-session e2e, 15 kill matrix; 16, the worker e2e series, left out). Each step prints `== test:regression step N: <name>` before it starts. One step at a time, never two at once (the timestamps do not overlap). |
| Commands | Those of test/17 Part A: step 5 `--maxWorkers=4`, step 6 `lockf -k -t 3600 .locks/db-migrate.lock ... --project db --maxWorkers=2`, step 8 `npx -w apps/mobile jest --maxWorkers=2`; steps 3, 4, 7, 9, 10 the workspaces' `npm run test`; the three gated suites through their package scripts. One difference from test/17: steps 1 and 2 are the ROOT `npm run typecheck` / `npm run lint` (one call over all seven workspaces), not seven calls; test/17 ran both forms. |
| Exit code | 0 (`SCRIPT_EXIT_CODE=0`, printed by my wrapper). Last line: `== test:regression GREEN: 15 steps; the capture worker e2e series was LEFT OUT (DEMS_REGRESSION_SKIP_WORKER_E2E=1)`. The skip is named in the last line, as documented. |
| Stops or continues at a red step? | By reading the code (`set -eu`; `step()` does `"$@" \|\| { rc=$?; echo "== test:regression FAILED at step $n: $name (exit $rc)" >&2; exit "$rc"; }`): it STOPS at the first failing step, prints the FAILED line on stderr and exits with that step's exit code. NOT exercised: nothing was red, and no failure was injected (no test or product file may be touched). Consequence to know: after a red, the steps behind it do not run, so one regression run finds one red step. |
| Where does its output go? | Only to the terminal (stdout and stderr of the caller). It writes no log file and no summary file, and prints no per-suite table, no timings, no counts at the end. The counts of this report were read from the runners' own summary lines in the log (vitest "Test Files / Tests / Duration", Jest "Test Suites / Tests / Time", `node --test` "tests / pass / fail"). Typecheck (tsc) and lint (oxlint, eslint) print nothing when clean: the script gives their exit code only, no "0 warnings" line. |
| Load rule of test/17 ("1-minute load below 4 before each whole suite") | NOT enforced: the script starts the next step at once. 1-minute load at the start of the steps: step 1 3.53; step 3 about 4.1-4.8; step 5 4.1-7.5; step 6 6.56; step 7 4.57; step 8 23.4 (the web workers were still ending); step 9 7.1; step 12 7.0; step 13 5.9; step 14 3.8; step 15 3.2. Mean during the db suite 5.1 (max 7.2), the web suite 13.3 (max 23.4), the mobile suite 10.7 (max 21.0), the kill matrix 4.1 (max 6.5). Part of it is the run itself (4 + 2 + parallel workers) and the Metro / emulators that were left up. Nothing failed under it, but the wall times below are from a loaded host (web +7 s, mobile +43 s against test/17). |
| Time against its header | The header says "About 75 minutes on a quiet host, of which step 16 is about 35", so about 40 minutes without step 16. Measured: 22 min 46 s. The header overstates by about 17 minutes (a suggestion for the docs, no more). |
| Pre-conditions it names | All met: PostgreSQL running (`pg:status` RUNNING, ready, 127.0.0.1:4432), the built worker and `.data/helpers/ffmpeg` present (steps 13 to 15 found them), the sandbox off. |
| Noise | The mobile step alone wrote 555,695 lines (48 MB) to the terminal, see section 5. A caller that shows the output live gets about 53 MB for one run. |

## 2. The table: check, result, counts, wall

| # | check (step) | command (as the script runs it) | result | files | tests (passed / failed / skipped) | wall (script clock / runner's own) |
|---|--------------|---------------------------------|--------|-------|-----------------------------------|-----------------------------------|
| 1 | typecheck, all workspaces | `npm run typecheck` (= `--workspaces --if-present`: capture-protocol, shared, core-server, core-web `tsc -b`, mobile, mock-core, transcriber) | GREEN | - | no output = 0 `error TS` | 35 s |
| 2 | lint, all workspaces | `npm run lint` (oxlint x 6, eslint for mobile) | GREEN | - | no output = no finding; no "0 warnings" line is printed | 18 s |
| 3 | shared unit | `npm run test -w @dems/shared` | GREEN | 102 | 2685 / 0 / 0 | 6 s / 5.45 s |
| 4 | capture-protocol unit | `npm run test -w @dems/capture-protocol` | GREEN | 1 | 31 / 0 / 0 | 0 s / 124 ms |
| 5 | core-server unit | `npx vitest run --root apps/core-server --project unit --maxWorkers=4` | GREEN | 324 | 6732 / 0 / 0 | 68 s / 67.43 s |
| 6 | core-server db | `lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2` | GREEN | 181 (178 passed, 3 skipped) | 2436: 2429 / 0 / 7 | 211 s / 211.00 s; teardown "dropped 8 database(s) in 203 ms; 0 remain"; "forced drops that needed a retry: 1" (SQLSTATE 42501, each drop then went through; test/17 had 2) |
| 7 | core-web unit | `npm run test -w @dems/core-web` | GREEN | 170 | 2335 / 0 / 0 | 88 s / 86.99 s |
| 8 | mobile unit | `npx -w apps/mobile jest --maxWorkers=2` | GREEN | 281 suites | 3130 / 0 / 0 (snapshots 0); 0 "failed to exit gracefully" lines, 0 `FAIL` lines, 281 `PASS` lines | 226 s / 225.75 s |
| 9 | transcriber unit (real-engine tests are not run) | `npm run test -w @dems/transcriber` | GREEN | 18 | 567: 564 / 0 / 3 | 16 s / 15.16 s |
| 10 | mock-core unit | `npm run test -w @dems/mock-core` | GREEN | 4 | 19 / 0 / 0 | 4 s / 3.96 s |
| 11 | pg-scripts | `npm run test:pg-scripts` | GREEN | - | 57 / 0 / 0 (cancelled 0, todo 0) | 0 s / 229 ms |
| 12 | capture worker checks | `make -C apps/capture-worker` (`npm run test:capture-worker`) | GREEN (make exit 0) | - | `check.sh` static rules OK; `check.sh` self-test: every planted line refused as required; anchor_test, micwatch_test, sink_kill_test (200 kills), writer_test, start_checks, log_test: "all checks hold", each negative control "fails, as required" | 36 s |
| 13 | seal e2e | `npm run test:seal-e2e` | GREEN | 1 | 3 / 0 / 0; 0 retries, "dropped 2 database(s) in 51 ms; 0 remain" | 46 s / 46.21 s |
| 14 | development-session e2e | `npm run test:dev-session-e2e` | GREEN | 1 | 4: 2 / 0 / 2 (the speech case and the attended case stay skipped, as in test/17) | 17 s / 16.92 s |
| 15 | kill matrix, the 35 active cells | `npm run test:kill-matrix` | GREEN | 1 | 35 / 0 / 0; "forced drops that needed a retry: 0"; "dropped 2 database(s) in 48 ms; 0 remain" | 595 s / 593.69 s |
| 16 | worker e2e series | - | LEFT OUT by `DEMS_REGRESSION_SKIP_WORKER_E2E=1` (as ordered) | - | - | - |

Totals of the eight whole suites (steps 3 to 10): 2685 + 31 + 6732 + 2429 + 2335 + 3130 + 564 + 19 = **17,925 passed, 0 failed, 10 skipped** (7 db, 3 transcriber). Plus 57 pg-scripts, 3 + 2 + 35 gated tests (the gated 40 run inside the db project, listed above separately). Failures: **0**.

### Contract totals (read directly from the tree after the run, as in test/17 13c)

| Total | Value | Source |
|-------|-------|--------|
| operations | **97** | `packages/shared/openapi/openapi.json` counted by a `node -e` script over `paths`: 97 operations; `info.version` 0.3.0; `api-registry.test.ts:299` `toHaveLength(97)` |
| GET / POST / other | **36 / 61 / 0** | same script; `api-registry.test.ts:330` (36) and `:331` (61) |
| audit types | **67** | `api-registry.test.ts:492` `AUDIT_TYPES` `toHaveLength(67)` |
| schema version / contract revision | **6 / dbc-7** | `apps/core-server/src/db/schema/meta.ts:38` `DB_SCHEMA_VERSION = 6`, `:40` `DB_CONTRACT_REVISION = 'dbc-7'` |

The pins themselves passed in this run: `api-registry.test.ts` in step 3 (shared, 102 files green), `test/acceptance/contract.test.ts` in step 6 (db, 178 files green). Unchanged against test/17.

## 3. Deltas against test/17 Part A (BEFORE = commit 713d83f run; AFTER = this tree)

| Suite | before (files / tests) | after (files / tests) | delta | wall before -> after | reading |
|-------|-----------------------|-----------------------|-------|----------------------|---------|
| shared | 101 / 2614 | 102 / 2685 | +1 file, **+71 tests** | 5.0 s -> 5.45 s | +1 file = `test/sim-system-truth.test.ts` (new, untracked); the rest is the J-S / J2-S additions to existing files (`sim-core-driven-seal`, `sim-seal-blocked-unsealable`, the text rules) |
| capture-protocol | 1 / 31 | 1 / 31 | 0 | 0.1 s -> 0.12 s | - |
| core-server unit | 324 / 6702 | 324 / 6732 | 0 files, **+30 tests** | 61.6 s -> 67.4 s | J-S / J2-S additions in existing files |
| core-server db | 181 (178 ran, 3 skipped) / 2430 (2423 passed, 7 skipped) | 181 (178 ran, 3 skipped) / 2436 (2429 passed, 7 skipped) | 0 files, **+6 tests**, skipped unchanged (7) | 206.6 s -> 211.0 s | the db tests of J-S / J2-S (reads, unsealable doors, system, sessions history) |
| core-web | 164 / 2224 | 170 / 2335 | **+6 files, +111 tests** | 79.6 s -> 87.0 s | the 6 untracked test files: `components/shell/__tests__/open-alerts.test.ts`, `features/evidence/__tests__/playback-link.test.ts`, `features/sessions/__tests__/model.test.ts`, `features/sessions/__tests__/page.test.tsx`, `lib/__tests__/product-versions.test.ts`, `test/press-outside.test.tsx`; the +111 tests are those and additions to existing files |
| mobile | 273 / 2917 | 281 / 3130 | **+8 suites, +213 tests** | 182.2 s -> 225.75 s | new suites: `motion/ui-runtime-watch.test.tsx`, `motion/testing/worklet-closure.test.ts`, `lib/sheet-open.test.tsx`, `lib/app-version.test.ts`, `lib/core-components.test.ts`, `features/evidence/playback-link.test.ts`, `session-annotations.test.tsx`, `features/sessions/foreign-session-notice.test.tsx` (the 8 untracked mobile test files) |
| transcriber | 18 / 564 (+3 skipped) | 18 / 564 (+3 skipped) | 0 | 14.8 s -> 15.2 s | - |
| mock-core | 4 / 19 | 4 / 19 | 0 | 3.9 s -> 4.0 s | - |
| pg-scripts | 57 | 57 | 0 | 0.2 s | - |
| seal e2e | 3 | 3 | 0 | 46 s -> 46 s | - |
| development-session e2e | 2 passed, 2 skipped | 2 passed, 2 skipped | 0 | 17 s -> 17 s | - |
| kill matrix | 35 | 35 | 0 | 589 s -> 594 s | - |

Totals: 17,494 -> **17,925 passed** (+431), failed 0 -> 0, skipped 10 -> 10. Cross-check with the notes: 171 reports mobile "281 suites, 3,123 tests" (this run +7 after notes 174 / 175 touched the Home header tests); 173 expected web "170 files, 2327 tests, 0 failed" (this run 2335: +8 from notes 174 / 175, which came after 173); 172 reports shared "102 files, 2683" (this run 2685, +2 from 174). The kill matrix, the seal e2e and the development-session e2e are unchanged to the count.

## 4. "Checks for the test runner" of notes 167 to 175, against what the script ran

| Note | Checks listed | Covered by | Run separately? |
|------|---------------|-----------|-----------------|
| 167 J-S | shared, core-server (unit), whole db suite (`test:db` under `db-migrate.lock`), typecheck + lint of both workspaces, `test:regression` at the end; web and mobile typecheck | steps 1, 2, 3, 5, 6 and the whole script | no |
| 168 J-W | `npm test -w apps/core-web` once more on a quiet host | step 7 (170 files, 2335 passed; the host was NOT quiet: mean load 13.3 during it, and it still passed) | no |
| 169 J-T | mobile typecheck, lint, the whole mobile suite | steps 1, 2, 8 | no |
| 170 J-P | the whole mobile suite once; expect `pairing-handoff-routes` to follow `_layout.tsx` | step 8; `src/features/pairing/pairing-handoff-routes.test.tsx` PASS in the log | no |
| 171 J2-M | (no section of that name) its table lists lint, whole mobile suite 281 / 3,123 | steps 2, 8 | no |
| 172 J2-S | whole db suite once; web and mobile suites after their drivers; openapi byte-for-byte tests | steps 6, 7, 8; the two byte-for-byte tests are in step 3 | no |
| 173 J3-W | `npm test -w apps/core-web` on a quiet host, expected 170 files / 2327 / 0 failed | step 7 (170 files, 2335 passed, 0 failed) | no |
| 174 J4 | shared; core-server unit; core-web (watch the pins of "Acknowledge all" and the lock sentence); mobile (watch the files that open the Home bell or avatar); db unchanged | steps 3, 5, 7, 8 (`session-start-home.test.tsx` PASS in the log; the other Home files are in the 281 passed) | no |
| 175 J5 | `npm run test -w apps/core-web`; watch `export-job`, `item-exports`, `evidence-media`, `live-efix-evidence`, `lib/__tests__/download.test.ts` | step 7 (the default reporter prints no per-file line for a passed file: those five are inside the 170 passed files; not named in the log) | no |

Every check of the nine notes is a command the script already runs. **Nothing was run outside the script.**

## 5. Reds in full

**None.** All 15 steps exited 0. No test failed, none was flaky in a way that showed, nothing ran twice.

Things that are NOT reds and that the reader of the log should know:

1. **Mobile console volume (observation, no baseline).** The mobile step wrote 555,695 lines to the terminal while passing: 9,243 `console.error` blocks, 5,221 `console.warn` blocks. Of the `console.error`, 8,652 are `[colorKit.RGB] An error occurred while attempting to convert the provided parameter into an RGB color ... "black" will be used instead`; of the `console.warn`, 4,046 are `"invalid" is not a valid color or brush`, 506 + 506 are `"invalid" is not a valid color or "N%" is not a valid offset`, 163 are the Uniwind `--theme` variable warning. Others: 85 + 24 + 22 + 16 + about 40 "update to X inside a test was not wrapped in act(...)", 24 `[runtime]` error records (one is the intended `sheet.open` failure of `lib/sheet-open.test.tsx`, a new test of J-T/J-P), 13 `findNodeHandle is deprecated in StrictMode`. The colour messages come mostly from `features/evidence/evidence-detail.test.tsx` (1,233 colour errors), `evidence/sealed-player.test.tsx` (564), `evidence/live-evidence-export.test.tsx` (494), `devices/real-capture-one-rule.test.tsx` (380), `evidence/media-session-canary.test.tsx` (261), `devices/live-devices-sites.test.tsx` (254), `capture-selector/selector-lines.test.tsx` (235), `evidence/evidence-list.test.tsx` (233), `audit/audit-screen.test.tsx` (227). test/17 does not record the console volume of the mobile run, so I cannot say whether it grew with wave J; I did not measure the commit `035150b` tree. It does not fail anything (the "invalid" colour string is some mock's or a test fixture's value reaching the colour library); it makes the log unreadable and hides a real warning. Owner: unknown (candidates 169 J-T and 171 J2-M, which touched these screens' tests); for the controller to rule, not a blocker for the commit.
2. **Core-web log noise (old).** 380 lines of `Not implemented: HTMLMediaElement's pause()/play() method`, `Window's scrollTo()`, `HTMLCanvasElement's getContext()` from jsdom: unchanged kind, harmless.
3. **Core-server db retry.** "forced drops that needed a retry: 1" (SQLSTATE 42501 while an autovacuum-type backend was on a throw-away database; the drop then went through; 0 databases remained). test/17 had 2, test/16 had 0.
4. **Node warning in the db step:** `ExperimentalWarning` / `--trace-deprecation` line at 12:08:41 (one line, no test affected); the mobile step prints `ExperimentalWarning: localStorage is not available because --localstorage-file was not provided` (jest).
5. **Load.** The run did not hold the test/17 load rule (section 1). It had no consequence for the result; it is why the web and mobile suites are slower than before.

## 6. `git status` and the untracked-scratch list

`git status --short | wc -l`: **512** (before the run: 512; after: 512; the run created nothing that git sees). 436 modified (` M`), 76 untracked entries in the short form (87 files with `--untracked-files=all`).

New top-level paths: none. Every untracked path is under `apps/core-web`, `apps/mobile`, `packages/shared` or `docs/2026-10-07_dems_real_capture_sealing`. No media file (mp4, m4a, wav, mp3, mov, gguf, onnx, bin, wasm, sqlite), no `.log`, `.tmp`, `.orig`, `.rej` among the untracked files (`git status --porcelain --untracked-files=all` filtered by extension: 0 lines).

Untracked and NOT covered by `.gitignore` (the two that are not a `.ts`, `.tsx` or a `.md` of the task folder):

| Path | What it is | `.gitignore` | Reading |
|------|-----------|-------------|---------|
| `apps/core-web/.tanstack/tmp/b0485eb2-f8dea1922743d603235f107b5c484e7e` (14,536 bytes, 2026-10-12 05:21, i.e. BEFORE this run; the directory `.tanstack/` is from 2026-10-01) | a file the TanStack Router plugin generates (header: "automatically generated by TanStack Router ... You should NOT make any changes"); `git ls-files apps/core-web/.tanstack` is empty, `git check-ignore -v` prints nothing | **NOT covered** (the root `.gitignore` has `.cache/`, `.data/`, `.locks/`; `apps/core-web/.gitignore` only `dist` among build folders) | SCRATCH: should not be committed. A line `.tanstack/` (or `apps/core-web/.tanstack/`) in `.gitignore` is the fix (the controller's, I touch no file) |
| `apps/core-web/src/features/sessions/sessions.css` | a new stylesheet, imported by `features/sessions/index.tsx:13` and `features/alerts/index.tsx:15` | n/a | SOURCE, belongs in the commit (listed only because it is not a `.ts`/`.tsx`) |

Untracked source directories that are collapsed in the short form (all intended product / test source of wave J, none scratch): `apps/core-web/.tanstack/` (the scratch above), `apps/core-web/src/components/shell/__tests__/`, `apps/core-web/src/features/alerts/`, `apps/core-web/src/features/sessions/`, `apps/mobile/src/features/alerts/`, `apps/mobile/src/motion/testing/`. In the task folder: nine implementation notes (167 to 175), eight delegation_progress files, `initialization/11_gate_environment_judging.md`, four `report/judging_*.md`. This report (`test/18_precommit_wave_j.md`) is the one more file.

Ignored folders that this run wrote to and that are covered (checked with `git check-ignore -v`): `.cache/` (`.gitignore:47`), `.data/` (`:70`), `.locks/` (`:59`), `apps/core-web/dist` (`apps/core-web/.gitignore:11`); `apps/capture-worker/build/`, `apps/core-server/.vitest/`, `packages/shared/.vitest/`, `packages/shared/tsconfig.tsbuildinfo`, `graft/` and `release/` show as ignored (`!!`) in `git status --ignored`.

## 7. State left

Lanes main, 1, 2, 3 stopped (lane 1 and 2 stopped by me at the start, as ordered; the controller restarts them). PostgreSQL left running (it was running). Metro and the two emulators untouched. `pgrep` could not be used in the sandbox (sysmond), so no process check of leftover `capture-worker` / `ffmpeg` was possible; the kill matrix and the e2e steps reported their databases dropped (`0 remain` x 4) and finished by exit code. Files written: this report only (plus the time-stamped log and load log in the session scratchpad).

---
*Generated: 2026-10-12 12:40*
