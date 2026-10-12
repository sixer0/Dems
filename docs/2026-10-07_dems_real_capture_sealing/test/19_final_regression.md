---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-12
agent: test-expert (test runner, D122)
scope: final regression of the uncommitted fix wave Q (notes 176 Q-M, 177 Q-W, 178 Q-N) on top of commit b4b0c25; run of record for the task
status: complete
result: GREEN (all 16 steps exit 0, script exit code 0, no red, nothing run twice)
---

# Final regression of fix wave Q (2026-10-12)

Runner only (D122): no product file, no test file, no git write, no install, no Gradle build, nothing fixed. The one run:
`npm run test:regression` WITHOUT `DEMS_REGRESSION_SKIP_WORKER_E2E`, run once, outside the command sandbox, through a
time-stamping wrapper (`scratchpad/run_regression.sh`: every output line prefixed with the clock, the script's exit code
captured, the 1-minute load sampled every 15 s). Raw log 52 MB, 558,499 lines, in the session scratchpad
(`regression19.log`, `load19.log`), not in the repository.

- Script clock: start **17:23:52**, end **18:43:14** = **79 min 22 s** (4,762 s). Last line: `== test:regression GREEN: 16 steps`. `SCRIPT_EXIT_CODE=0`.
- Lanes: `lane.sh stop 1` (was PID 49604) and `lane.sh stop 2` (was PID 49674) at 17:06, both exit 0, not piped, outside the sandbox. Lane status after:
  main, 1, 2, 3 all `stopped`. Nothing reset, lane 2's data untouched, no lane started afterwards. Metro and the two emulators were not touched (no adb).
- No `.data/pg*.env` read; PostgreSQL only through the project's scripts and the db test project (under `.locks/db-migrate.lock`); no port 5173-5175 / 8000 / 5432;
  no local-device selector, no `DEMS_*_ATTENDED`; no audio played; no install.

## 0. Deviation from the order: the load rule was NOT met at the start

The order said: start only when the 1-minute load is below 4. I waited 17:06 to 17:23 (17 minutes, load sampled every 20 s: 9.9 at 17:06, 7.9 at 17:08,
7.3 at 17:13, 6.9 at 17:17, 7.3 at 17:23). It did not fall below 6.9. Cause, read with `top` at 17:12: two `qemu-system-aarch64` processes (the two emulators) at 175 % and
166 % CPU each, WindowServer 33 %. They were to be left alone (no adb), so the load could not be lowered by me. I started at **6.86** and say so here.
Test/18 started at 3.53 with the emulators up (the app was then not in the foreground on them, apparently).
Consequences seen: every wall time below is from a loaded host (mean 8.7, max 27.1 over the whole run); the worker e2e series waited 15 times for the load to fall
(962 s in all, longest 226 s; that is the series' own load gate, it works) and its own line reads "load at the start of the timing-sensitive checks: 4.62 .. 7.95".
Nothing failed under it, so the load did not change a verdict. A runner whose result is red would have had to call it load; there is no red.

## 1. The table: step, result, counts, wall

Wall = script clock (difference of the time stamps of two step lines) / the runner's own figure. Load = mean / max of my 15-second samples inside the step (a step shorter than 15 s has 0 or 1 sample).

| # | step | command (as the script runs it) | result | files | tests (passed / failed / skipped) | wall (script / runner) | load mean / max |
|---|------|---------------------------------|--------|-------|-----------------------------------|------------------------|-----------------|
| 1 | typecheck, all workspaces | `npm run typecheck` | GREEN | - | no output = 0 `error TS` | 39 s | 8.4 / 11.2 |
| 2 | lint, all workspaces | `npm run lint` | GREEN | - | no output = no finding | 18 s | 16.0 / 16.0 |
| 3 | shared unit | `npm run test -w @dems/shared` | GREEN | 102 | 2685 / 0 / 0 | 7 s / 6.42 s | 17.3 / 17.3 |
| 4 | capture-protocol unit | `npm run test -w @dems/capture-protocol` | GREEN | 1 | 31 / 0 / 0 | 1 s / 122 ms | - |
| 5 | core-server unit | `npx vitest run --root apps/core-server --project unit --maxWorkers=4` | GREEN | 324 | 6732 / 0 / 0 | 78 s / 78.32 s | 16.1 / 21.2 |
| 6 | core-server db | `lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2` | GREEN | 181 (178 passed, 3 skipped) | 2436: 2429 / 0 / 7 | 233 s / 232.20 s | 12.3 / 19.8 |
| 7 | core-web unit | `npm run test -w @dems/core-web` | GREEN | 172 | 2367 / 0 / 0 | 96 s / 95.67 s | 18.8 / 27.1 |
| 8 | mobile unit | `npx -w apps/mobile jest --maxWorkers=2` | GREEN | 281 suites | 3166 / 0 / 0 (snapshots 0); 281 `PASS` lines, 0 `FAIL` lines, 0 "failed to exit gracefully" | 269 s / 267.80 s | 13.7 / 24.0 |
| 9 | transcriber unit (real-engine tests not run) | `npm run test -w @dems/transcriber` | GREEN | 18 | 567: 564 / 0 / 3 | 16 s / 16.15 s | 8.6 / 8.6 |
| 10 | mock-core unit | `npm run test -w @dems/mock-core` | GREEN | 4 | 19 / 0 / 0 | 5 s / 4.26 s | - |
| 11 | pg-scripts | `npm run test:pg-scripts` | GREEN | - | 57 / 0 / 0 (suites 0, cancelled 0, skipped 0, todo 0) | 1 s / 318 ms | - |
| 12 | capture worker checks | `npm run test:capture-worker` (`make -C apps/capture-worker`) | GREEN | - | `check.sh` static rules OK; `check.sh` self-test: every planted line "refused as required", the comment case "accepted as required"; 5 binaries print "all checks hold" (anchor, micwatch, writer, start_checks, log_test) plus `sink_kill_test`: 200 kills; each negative control "fails, as required" | 42 s | 7.9 / 8.5 |
| 13 | seal e2e | `npm run test:seal-e2e` | GREEN | 1 | 3 / 0 / 0; forced-drop retries 0; "dropped 2 database(s) in 55 ms; 0 remain" | 46 s / 46.51 s | 6.8 / 7.0 |
| 14 | development-session e2e | `npm run test:dev-session-e2e` | GREEN | 1 | 4: 2 / 0 / 2 (speech case and attended case stay skipped, as before) | 18 s / 17.02 s | 7.3 / 7.3 |
| 15 | kill matrix, the 35 active cells | `npm run test:kill-matrix` | GREEN | 1 | 35 / 0 / 0; forced-drop retries 0; "dropped 2 database(s) in 75 ms; 0 remain" | 598 s / 597.40 s | 7.4 / 10.9 |
| 16 | capture worker e2e series | `npm run test:capture-worker-e2e` (`make -C apps/capture-worker e2e` = `python3 test/e2e.py`, series 10121748, ports 127.0.0.1:8555 and :8557, results in `.cache/m3worker/e2e/10121748`, under `.locks/heavy-host.lock`) | GREEN | - | **122 checks (81 expected PASS, 41 negative controls expected FAIL): 122 as expected, 0 unexpected**; "ports still listening after the series: none"; "AGGREGATE EXIT CODE 0" | 3295 s = 54 min 55 s (17:48:19 - 18:43:14) | 7.7 / 15.6 |

Step 6 teardown: "dropped 8 database(s) in 173 ms; 0 remain"; "forced drops that needed a retry: 1" (SQLSTATE 42501, the drop then went through; test/18 also had 1).
Step 8 (the number to watch against test/18): 281 suites, 3166 tests, 0 failed, 267.8 s; the earlier Q-M run reported 3,152 (note 176 section 4).

Step 16, what the series ran: every check of `m3worker.py` twice (`_r1`, `_r2`) and every negative control (`neg_*`), as the script's own header says. The names that appear: static rules (`static_rules`, 1), unit (`unit_r1/_r2`), harness (leftover scope),
protocol and fatal-path checks (`proto`, `fatal`, `f2`, `h4`, `wi1_fatal_rmdir`), the camera/mic chain families (`av`, `av1`, `av2b`, `av2c`, `kc1` - `kc4`, `nocam`, `optc`, `bind`, `chain`, `continuity`, `longgop`, `gop50`), the mic watch (`mic_*`, `m5_*` with M5-WARN
negative controls such as `neg_m5_rate_inside_the_range`), the clock/anchor wants (`want_r2_*`, the 90 s `want_r2_near_bound_clock_step` pair), supervision (`sup_*`), the writer (`writer_*`), the R63 review rules (`r63_02_fragment_size_bound`, `r63_11_moved_timestamp_is_said`,
`r63_12_clock_floor_wiring` and their negative controls), and `mg1_no_media_in_git`. Result line, verbatim: `122 checks (81 expected PASS, 41 negative controls expected FAIL): 122 as expected, 0 unexpected`.
Every verdict line (122) reads `ok`; none carries another word (checked: 0 lines without ` ok `).

Totals of the eight whole suites (steps 3 to 10): 2685 + 31 + 6732 + 2429 + 2367 + 3166 + 564 + 19 = **17,993 passed, 0 failed, 10 skipped** (7 db, 3 transcriber).
Plus pg-scripts 57, seal e2e 3, development-session e2e 2 (+2 skipped), kill matrix 35, worker e2e 122 checks. Failures: **0**.

### Contract totals (read from the tree after the run)

| Total | Value | Source |
|-------|-------|--------|
| operations | **97** | `node -e` over `packages/shared/openapi/openapi.json` `paths`: 97 operations; `info.version` 0.3.0; `packages/shared/test/api-registry.test.ts:299` `toHaveLength(97)` |
| GET / POST / other | **36 / 61 / 0** | same script; `api-registry.test.ts:330` (36), `:331` (61) |
| audit types | **67** | `api-registry.test.ts:492` `AUDIT_TYPES` `toHaveLength(67)` |
| schema version / contract revision | **6 / dbc-7** | `apps/core-server/src/db/schema/meta.ts:38` `DB_SCHEMA_VERSION = 6`, `:40` `DB_CONTRACT_REVISION = 'dbc-7'` |

The pins themselves passed: `api-registry.test.ts` in step 3 (102 files green), `test/acceptance/contract.test.ts` in step 6 (178 files green). Unchanged against test/18.

## 2. Deltas against test/18 (BEFORE = wave J tree on 035150b, run 12:03-12:26; AFTER = this tree)

| Suite | before (files / tests) | after (files / tests) | delta | wall before -> after | reading |
|-------|-----------------------|-----------------------|-------|----------------------|---------|
| shared | 102 / 2685 | 102 / 2685 | 0 | 5.45 s -> 6.42 s | wave Q touched no shared test |
| capture-protocol | 1 / 31 | 1 / 31 | 0 | 0.12 s -> 0.12 s | - |
| core-server unit | 324 / 6732 | 324 / 6732 | 0 | 67.4 s -> 78.3 s | - |
| core-server db | 181 (178 ran) / 2436 (2429 passed, 7 skipped) | same | 0, skipped unchanged (7) | 211.0 s -> 232.2 s | - |
| core-web | 170 / 2335 | **172 / 2367** | **+2 files, +32 tests** | 87.0 s -> 95.7 s | the two new test files of note 177: `src/lib/__tests__/event-words.test.ts` and `src/test/box-check.test.ts`; the rest is the additions and moved pins in existing files (note 177 section 6 says "172 files, 2367 tests": exact match) |
| mobile | 281 / 3130 | **281 / 3166** | **0 suites, +36 tests** | 225.75 s -> 267.80 s | new cases in existing suites (Q-M keyboard guard, list position, toast area, foreign-session signal; Q-N's static `brand-media.test.ts` block "library source patches", 13 of 13 in that file per note 178). Note 176 reported 3,152 at its second run; the +14 since is hypothesis-level (note 178's static cases, which came after 176), not measured by me |
| transcriber | 18 / 564 (+3 skipped) | same | 0 | 15.2 s -> 16.2 s | - |
| mock-core | 4 / 19 | same | 0 | 4.0 s -> 4.3 s | - |
| pg-scripts | 57 | 57 | 0 | 0.2 s -> 0.3 s | - |
| seal e2e | 3 | 3 | 0 | 46 s -> 46 s | - |
| development-session e2e | 2 passed, 2 skipped | same | 0 | 17 s -> 17 s | - |
| kill matrix | 35 | 35 | 0 | 594 s -> 597 s | - |
| worker e2e series | (left out in test/18) | 122 checks, 122 as expected | new | - -> 54 min 55 s | first run of record since the skip flag was used; no earlier count in test/18 to compare |

Totals: 17,925 -> **17,993 passed** (+68 = 32 web + 36 mobile), failed 0 -> 0, skipped 10 -> 10. Wall times are 6 to 19 % longer on every JS suite (shared +18 %, unit +16 %, db +10 %, web +10 %, mobile +19 %, transcriber +7 %): the host was at load 6.9+ at the start and 13 to 19 on average inside the web, mobile and unit steps (test/18: web mean 13.3, mobile 10.7); the e2e and kill matrix steps are within 1 % of test/18.

## 3. Checks for the test runner of notes 176, 177, 178, against what the script ran

| Note | "Checks for the test runner" | Covered by | Result |
|------|------------------------------|-----------|--------|
| 176 Q-M | the note has **no** section of that name (sections: quiet window, findings, 9+9 rows, "Proof at the end", disclosures, decisions, state left). Its proof: mobile `tsc`, mobile lint, whole mobile suite | steps 1, 2, 8 | GREEN (3166, 0 failed; `pairing/pairing-handoff-routes.test.tsx`, the file that failed in Q-M's run 1, is among the 281 PASS suites) |
| 177 Q-W | the note has **no** section of that name (section 6 "Checks": web typecheck, lint, whole web suite 172 / 2367) | steps 1, 2, 7 | GREEN, 172 files / 2367 tests: exactly the note's number |
| 178 Q-N native, section 9 | (1) `npm ci` in a scratch clone + `--ignore-scripts` + `./gradlew :app:demsCheckLibraryPatches` | **not run**: forbidden by the order (no install, no Gradle build) | NOT RUN, as ordered. Still open for whoever may install |
|  | (2) tablet item 6: session as another console, sign out and in | **not run**: device flow, outside this order | NOT RUN, as ordered |
|  | (3) phone 60 s session after the 40 rounds | **not run**: device flow | NOT RUN, as ordered |
|  | (4) whole regression of the other workspaces | the whole script | GREEN |
|  | (order) `sh apps/mobile/scripts/apply-patches.sh` must say "already applied", exit 0 | run twice, before the regression: `--check` and without argument | `apply-patches: react-native-reanimated 4.5.1 is already patched: nothing to do.` exit 0, both times. It changed nothing (marker present, `patch -R --dry-run` clean) |

The script covers every other check of the three notes. Nothing was run outside the script except `apply-patches.sh`.

## 4. Reds in full

**None.** All 16 steps exited 0; no test failed; nothing ran a second time; no flaky signal (0 failed, 0 retries in the e2e and kill matrix steps, 1 forced-drop retry in the db step, same as test/18).

Not reds, but for the reader of the log:

1. **Mobile console volume (continues the observation of test/18, no baseline before that).** Step 8 wrote 557,538 lines (test/18: 555,695): 9,278 `console.error` blocks (9,243), 5,232 `console.warn` blocks (5,221), of which 8,684 `colorKit.RGB` errors (8,652) and 4,057 `"invalid" is not a valid color or brush` warnings (4,046). The growth is under 1 % and the same cause as in test/18; it fails nothing. Still an unowned observation: the log is unreadable and hides real warnings. 231 "not wrapped in act(...)" lines, 17 `findNodeHandle is deprecated in StrictMode`.
2. **Core-web log noise (old):** 373 jsdom "Not implemented" lines (test/18: 380), harmless.
3. **Node warnings:** `ExperimentalWarning: localStorage is not available because --localstorage-file was not provided` (2 lines, the mobile step's Jest workers).
4. **Load.** See section 0. The run did not hold the order's load rule (6.86 at the start; mean 8.7). No verdict depended on it.
5. **One concurrent writer in the tree.** `git status` untracked entries grew during the run (section 5): a different task, `docs/2026-10-12_input_av_core_adapter_plan/`, was being written by another agent while I ran ("nobody else edits" did not hold for `docs/`). Only documentation files; no test or product file of this task changed, and no step read them.

## 5. `git status` and the untracked-scratch list

`git status --short | wc -l`: **143** (before the run: 143; after: 143). 120 modified (` M`) and 23 untracked entries in the short form (directories collapsed); with `--untracked-files=all`: 77 files before the run, **105 after** (+28, all under `docs/2026-10-12_input_av_core_adapter_plan/`, written by another agent during my run; the `diff` of the two lists shows only those). Test/18 reported 512 because it ran before the checkpoint commit `b4b0c25`.

Modified, by area: `apps/core-web` 49, `apps/mobile` 66, `docs/2026-10-07_dems_real_capture_sealing` 3, `package.json` + `apps/mobile/package.json` (the `postinstall` / `patches:*` lines of note 178), `README.md` 1.

Untracked, by area (105 files): `apps/input-av` 50, `docs/2026-10-12_input_av_core_adapter_plan` 33, `apps/mobile` 10, `docs/2026-10-07_dems_real_capture_sealing` 9, `apps/core-web` 3. By kind: 48 md, 34 py, 6 ts, 3 tsx, 3 sh, 2 service, 1 each of yml, txt, patch, js, html, .gitignore, .env.example, Caddyfile, `dems-netalias` (a script without extension). Not one media, APK/AAB, model, database, log, key, keystore, `.orig`, `.rej`, `.pyc` among them (filtered by extension: 0 lines; `git ls-files --others --exclude-standard` for `apk|aab|mp4|m4a|wav|mp3|mov|gguf|onnx|bin|wasm|sqlite|log|jks|keystore`: none).

Untracked and NOT ignored, to rule on (none is build output, none is a film):

| Path | What it is | Belongs to this task's commit? |
|------|-----------|-------------------------------|
| `apps/core-web/src/lib/__tests__/event-words.test.ts`, `apps/core-web/src/test/box-check.test.ts`, `apps/core-web/src/test/box-check.ts` | note 177's new test files and the box-check module | YES, source |
| `apps/mobile/patches/README.md`, `apps/mobile/patches/react-native-reanimated+4.5.1.patch`, `apps/mobile/plugins/with-dems-library-patches.js`, `apps/mobile/scripts/apply-patches.sh` | note 178's patch, its script, its Gradle guard plugin | YES, source (the patch file is the product of the native fix) |
| `apps/mobile/src/features/session-new/configured-profile.ts`, `src/features/sessions/foreign-session-toasts.tsx`, `src/lib/keyboard-guard.tsx`, `src/lib/list-position.ts`, `src/providers/toast-area.tsx`, `src/runtime/foreign-session-signal.ts` | note 176's new modules | YES, source |
| `docs/2026-10-07_dems_real_capture_sealing/` 9 files: `delegation_progress/coder-execution_wave_q_w.md`, `delegation_progress/git_specialist_wave_j_checkpoint.md`, `implementation/176_..., 177_..., 178_...md`, `initialization/12_environment_confirmation.md`, `report/confirm_c1_tablet.md`, `confirm_c2_phone.md`, `confirm_c3_web.md` | this task's documents | YES (plus this report, `test/19_final_regression.md`, the tenth) |
| **`apps/input-av/` (50 files)**, incl. `.env.example` (kept by the explicit `!.env.example` rule, `.gitignore:42`), `deploy/*.service`, `nvr/*.py`, `scripts/*` | a Python NVR application, **a different task** than this one; not touched by any wave; not scratch, not generated | NO - should not go into the wave Q commit; the controller rules where it goes (its own `.gitignore` already covers `.venv/`, `bin/`, `data/`, `__pycache__/`: those show as ignored) |
| **`docs/2026-10-12_input_av_core_adapter_plan/` (33 files)** | the folder of that other task (a task-architect / explore / analysis tree), still being written during my run | NO - other task |

Ignored folders written to or present, checked with `git check-ignore -v` (all covered): `apps/mobile/android` (`apps/mobile/.gitignore:43 /android`), `apps/core-web/.tanstack` (`.gitignore:48 .tanstack/` - covered now; test/18's finding is resolved), `.cache/` (`:47`; the wave Q films and logs live in `.cache/wave-q/`, and the series' results in `.cache/m3worker/e2e/10121748`), `.data/` (`:71`), `.locks/` (`:60`), `apps/capture-worker/build` (`:16 build/`), `apps/core-web/dist` (`apps/core-web/.gitignore:11`). `git status --ignored` also lists `apps/mobile/signing/`, `apps/mobile/.expo/`, `apps/mobile/expo-env.d.ts`, `apps/core-server/logs/`, `.DS_Store` files, `apps/input-av/{.venv,bin,data}`: ignored, so not a commit risk. No APK or `.gradle` path appears among the untracked files.

## 6. State left

Lanes main, 1, 2, 3 `stopped` (1 and 2 stopped by me at 17:06 as ordered; the controller restarts them; lane 2's data kept). PostgreSQL left as found (running). Metro and the two emulators untouched. The worker e2e series left "ports still listening after the series: none"; every db step reported `0 remain` of its throw-away databases (4 times). `pgrep`/`ps` are denied in the sandbox, so no process check of a leftover `capture-worker` or `ffmpeg` was possible beyond those lines. Files written: this report only; the wrapper script, the raw log, the load log, and the two git-status snapshots are in the session scratchpad.

---
*Generated: 2026-10-12 18:50*
