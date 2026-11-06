---
row: closing-fix round C1 (before the root gate W89)
decisions: D187 ruling 3 (F84-3), D188 (F86-1), D189 (W87-F1, W87-F2)
agent: coder-execution
date: 2026-10-06
tier: 3
status: complete with one residual (C1-R1, see section 6)
---

# Closing-fix round C1

Four small items, one change each. Assets are in `gateway_check/assets/10_c1_*`. Pre-images and their SHA-256 are in `.cache/rollback/C1/` (`C1.pre.sha256`). Progress log: `delegation_progress/coder_execution_c1.md`.

## 1. Summary

| Item | Finding | Files | Outcome |
|---|---|---|---|
| 1 | W87-F1: jest's "worker failed to exit gracefully" warning | `apps/mobile/src/runtime/log.ts:171-178`; new `apps/mobile/src/runtime/log-flush-timer.test.ts` | Fixed for the cause W87 named. The two baseline suites no longer print the warning. A whole mobile run still prints it once, and three other suites cause that. They are outside this row's write paths: residual C1-R1 |
| 2 | W87-F2: stale comment | `apps/core-server/test/acceptance/shared-state.test.ts:706-708` (comment), `:712` (printed sentence) | Done. The comment and the printed text are reworded; no assertion changed |
| 3 | F84-3: the `all` scope's health example | `packages/shared/src/api/examples.ts:152-167, 361-367, 374`; `packages/shared/src/api/openapi.ts:85, 654-667, 728`; `packages/shared/openapi/openapi.json` (regenerated); `packages/shared/test/api-openapi-scope.test.ts` (the pinned test, granted) | Done. The `all` scope lists a Core-server example first. The offline document is byte-identical |
| 4 | F86-1: emulator npm scripts | `package.json:26-27`; `README.md:159` (one line added) | Done. The scripts name `dems2_tablet` / `dems2_phone`. README line 158 became false, so a correction line now follows it |

## 2. Item 1: W87-F1, the runtime log's flush timer

**Before** (`.cache/rollback/C1/apps/mobile/src/runtime/log.ts.pre`, line 171):

```ts
      if (timer === null) timer = setTimeout(() => void flush(), flushMs);
```

**After** (`apps/mobile/src/runtime/log.ts:171-178`):

```ts
      if (timer === null) {
        timer = setTimeout(() => void flush(), flushMs);
        // W87-F1 (D189): ... (four comment lines)
        (timer as { unref?: () => void }).unref?.();
      }
```

**Why a cast instead of the literal `timer.unref?.()`.** The brief asked for a handle type that compiles in both environments. `@types/node` types `setTimeout` as returning a `Timeout`, while React Native's `globals.d.ts:112` says `number`. The mobile `tsc` happens to resolve the handle to Node's `Timeout`, so the literal form would compile today. It would break as soon as the typings resolved to `number`. A scratch probe (`assets/10_c1_f1_tsc_probe.txt`; tsc 6.0.3, `--strict`) shows the cast form compiles for both a `number` handle and a `Timeout` handle. On a `number` handle the literal form fails, which proves the probe's `@ts-expect-error` is needed. At runtime in React Native the handle is a number: `unref` is `undefined` and the optional call does nothing.

**Commands and output**

| Step | Command | Output | Asset |
|---|---|---|---|
| Before | `npm test -w @dems/mobile -- src/features/session-summary/session-summary-screen.test.tsx src/features/session-finalizing/session-finalizing-screen.test.tsx --maxWorkers=2` (08:51) | `A worker process has failed to exit gracefully …`; `Tests: 17 passed, 17 total`; exit 0 | `10_c1_f1_before.log` |
| After, 3 runs | same command (08:53:49, 08:53:53, 08:53:56) | `Tests: 17 passed, 17 total`, exit 0, no warning, all three times | `10_c1_f1_after.log` |
| After, each suite alone in band | `npm test -w @dems/mobile -- <suite> --runInBand` | 9 / 9 and 8 / 8 passed, exit 0. Neither "failed to exit" nor "did not exit one second" (before, W87's log showed "Jest did not exit one second after the test run has completed") | `10_c1_f1_after.log` |
| New test + the existing baseline log test | `npm test -w @dems/mobile -- src/runtime/log-flush-timer.test.ts src/runtime/log.test.ts` | `Tests: 8 passed, 8 total` | — |
| Typecheck, lint | `npm run typecheck -w @dems/mobile`; `npx eslint src/runtime/log.ts src/runtime/log-flush-timer.test.ts` | exit 0; exit 0 | — |

**The runtime test (made precise).** `apps/mobile/src/runtime/log-flush-timer.test.ts` is one test that runs on real timers. It spies on `setTimeout` and writes one record. It then checks that the handle the log created reports `hasRef() === false`. In Node's timers API, a `Timeout` keeps the event loop active exactly while `hasRef()` is true, so this is a precise check of "does not keep the process alive". The test also checks that the unref'd timer still flushes the record to storage while the process runs, so the debounce still works.

**Mutation check (rule M15: in memory only; scratch jest config and transformer outside the tree, `assets/10_c1_mut_mobile.*.txt`):**

| Run | Result |
|---|---|
| Control (scratch config, no mutation) | `✓ is unref'd …`, 1 passed, exit 0 |
| Unref call removed in memory | `✕`, `Expected: false / Received: true`, exit 1; marker file `applied` written |
| Same mutant, the two baseline suites with two workers | the warning is back; 17 / 17 passed |
| `log.ts` SHA-256 after the runs | `54eae203…8419`, the same before and after: the tree did not change |

Asset: `10_c1_f1_mutation.log`.

## 3. Item 2: W87-F2, the stale comment in `shared-state.test.ts`

Diff against the pre-image (`diff .cache/rollback/C1/…/shared-state.test.ts.pre …`):

```
707c707,708
<         // holds one here, so it is OFFLINE (the comparison above ran the channel's pace step).
---
>         // holds one here, so it is OFFLINE from the first snapshot of the new epoch (the engine starts
>         // it with the link of the open sockets, D127).
711c712
<  … at ${positionText(renewed)} (recomputed from the open sockets at the channel's pace step)`);
---
>  … at ${positionText(renewed)}: OFFLINE from the first snapshot of the new epoch (the engine starts it with the link of the open sockets, D127)`);
```

No `expect` line changed. Line 706, the first line of the comment ("Spec §12.4: …"), stays as it was.

| Command | Output | Asset |
|---|---|---|
| `npm run test:db -- test/acceptance/shared-state.test.ts` (sandbox bypass, 08:54, 08:55, final 09:00:32) | `Test Files 1 passed (1)`, `Tests 6 passed (6)`, `0 remain with the run prefix …`, exit 0 each time | `10_c1_f2_db_shared_state.log`, `10_c1_final_db_shared_state.log` |
| Same with `--silent=false` (08:55:21) | `[w49] demo reset: the Core link: OFFLINE in the snapshot of the new epoch, OFFLINE at 2/0: OFFLINE from the first snapshot of the new epoch (the engine starts it with the link of the open sockets, D127)` | `10_c1_f2_db_shared_state.log` |

The db project prints console lines only with `--silent=false`. The final run of the file came after item 3, so it also covers the changed shared module.

## 4. Item 3: F84-3, the health example of the `all` scope

**Before:** `getServiceHealth` had one example in both scopes, `{ 200: { live: { summary: 'mock-core is up', value: HEALTH } } }` (`examples.ts` pre-image :349-351). The Live API Reference prefills from the first example (`apps/core-web/src/features/api-reference/api-document.ts:10`), so it showed "mock-core is up".

**After:**

- `examples.ts:152-167`: a new constant `CORE_SERVER_HEALTH`. It holds `service: 'dems-core-server'`, version `0.2.0` (the `version` of `apps/core-server/package.json:3`), `ready: { database: true, engine: true }`, the example instant, `uptimeMs` 5,400,000 and 2 clients. All values are synthetic.
- `examples.ts:361-367`: an optional field on `OperationExamples`, `coreServerResponses`, for examples of answers that only the Core server sends for a status the offline scope also documents.
- `examples.ts:374`: `getServiceHealth.coreServerResponses = { 200: { coreServer: { summary: 'The Core server is up, database and engine ready', … } } }`. `responses` is unchanged, so every existing reader of `responses[200]` still gets mock-core's example. Those readers are `client-credentials.test.ts:28`, `live-testing-fetch.test.ts:85, :607`, `api-schemas.test.ts:65` and `contract.support.ts:112, :128`.
- `openapi.ts:654-667`: `responseExamplesFor(examples, status, all)`. In the `all` scope it returns `{ ...coreServerResponses[status], ...responses[status] }`, so the Core server's example comes first. In the offline scope it returns `responses[status]`, the same as before. `:728` calls it; `:85` imports the type.

**Generation**

| Command | Output |
|---|---|
| `node --import tsx packages/shared/scripts/gen-openapi.ts --check` (before) | `… is stale …`, exit 1 |
| `node --import tsx packages/shared/scripts/gen-openapi.ts` | `wrote packages/shared/openapi/openapi.json (all (committed): 75 operations, 2 security schemes, version 0.2.1; offline: 10 operations, 0 security schemes, version 0.1.0; 901541 bytes)`, exit 0 |
| `… --check` (after, and again at 09:23:07) | `… is up to date (…)`, exit 0 |
| Offline document from the pre-image module (scratch copy of `packages/shared` outside the tree) | `360019bc02f8a4a0255d7a5df9bfe7d074d41f26f1a04a55551bf7b0d7263c10` |
| Offline document from the changed module (and again at 09:23:07) | `360019bc02f8a4a0255d7a5df9bfe7d074d41f26f1a04a55551bf7b0d7263c10`, identical |
| `all` document from the pre-image module vs the pre-image `openapi.json` | both `7f76ed79…ee0`: the scratch copy is faithful |
| `openapi.json` diff | +20 lines, all of them the `coreServer` example under `GET /api/v1/health` 200, placed before `live` (`assets/10_c1_f3_openapi_json.diff.txt`) |

**The pinned test (granted, by design).** The first shared run had 1 red test, `api-openapi-scope.test.ts`, "holds one component per registry schema, and the ten existing operations …". It requires every status the offline scope documents to have the same `content` in the `all` scope (`getServiceHealth 200: expected … to deeply equal …`). The change:

- `:494-500`: the expected content is the offline content with the operation's `coreServerResponses` for that status listed first, plus a "Changed by design (closing-fix round C1; F84-3, D187 ruling 3)" comment. The single `toEqual` stays.
- `:508-514`: four assertions. Health is the only operation with `coreServerResponses`; the example keys of the `all` scope are in the order `['coreServer', 'live']`; `validateCoreApiResponse('getServiceHealth', 200, …)` returns `{ ok: true }`; the value says `dems-core-server` with both `ready` flags.
- Imports `CORE_API_EXAMPLES` and `validateCoreApiResponse` (`:17`, `:42`).

The offline hash pins (`BASELINE.*`, `:129-180`) were not touched, and they pass.

**Mutation check (rule M15; scratch vitest config with an in-memory transform, `assets/10_c1_mut_shared.vitest.config.mts.txt`), on `api-openapi-scope.test.ts` and `openapi.test.ts`:**

| Mutant | Result |
|---|---|
| none (control) | 2 files, 45 tests passed |
| `order`: shared example first | 3 red, including `expected [ 'live', 'coreServer' ] to deeply equal [ 'coreServer', 'live' ]` and both drift tests |
| `leak`: example also in the offline scope | 2 red: the offline `paths` hash and the ten operation hashes |
| `drop`: the `all` scope ignores it (the F84-3 defect) | 3 red, including `getServiceHealth 200: … to deeply equal …` and both drift tests |
| `openapi.ts` SHA-256 after the runs | `03c15d67…7776`, unchanged |

Asset: `10_c1_f3_mutation.log`. Typecheck and lint of `@dems/shared` exit 0 (08:58).

## 5. Item 4: F86-1, the emulator npm scripts

```
26,27c26,27
<     "emulator": "emulator -avd dems_tablet -no-metrics -gpu host -no-boot-anim",
<     "emulator:phone": "emulator -avd dems_phone -no-metrics -gpu host -no-boot-anim",
---
>     "emulator": "emulator -avd dems2_tablet -no-metrics -gpu host -no-boot-anim",
>     "emulator:phone": "emulator -avd dems2_phone -no-metrics -gpu host -no-boot-anim",
```

**The README lines that name these scripts** (`grep -n "npm run emulator"`; no other README, test or script reads them):

| Line | Text (short) | Still true? | Action |
|---|---|---|---|
| 157 | "`npm run emulator` and `npm run emulator:phone` still boot from the snapshot, so prefer the command above." | Yes: the scripts still pass neither `-no-snapshot-load` nor `-port` | none |
| 158 | "… also name the old `dems_tablet` and `dems_phone` AVDs: do not use them for the `dems2_*` emulators." | **No** | line 159 added |

Line 159 (added): "- Correction (2026-10-06): the line above no longer holds. `npm run emulator` now boots `dems2_tablet` and `npm run emulator:phone` boots `dems2_phone`. They still boot from the snapshot and pass no `-port`, so the command above remains the one to use."

Evidence (`assets/10_c1_f4_scripts_readme.log`): README vs pre-image `158a159`, removed lines 0; `git diff acaff20 -- README.md` removed lines 0; `package.json` parses.

**Deviation (disclosed).** To print the script after the change I ran `npm run emulator --dry-run`. npm does not apply `--dry-run` to `run`, so at about 08:58:05 this actually executed `emulator -avd dems2_tablet -no-metrics -gpu host -no-boot-anim` inside the sandbox. Its first output line was `INFO | Android emulator version 37.1.11.0`; `head -5` then closed the pipe. A read-only `ps` with the sandbox bypassed (08:58:20) shows no new emulator process. Only the three pre-existing qemu processes remain, unchanged: PID 68181 `dems2_phone` (5554), PID 68876 `dems2_tablet` (5556) and PID 70102 `dems2_phone2` (5558), each up for 1 d 22 h. No stray file appeared in the repository. The sandbox denies writes under `~/.android`. I did not repeat it and made no `adb` call. The brief said no emulator start, so the controller should know this happened. As far as the process list shows, it changed nothing.

## 6. Final verification

| Check | Command | Result | Asset |
|---|---|---|---|
| Typecheck and lint, four workspaces (08:59, after every code change) | `npm run typecheck -w <ws>`, `npm run lint -w <ws>` for shared, core-server, core-web, mobile | all eight exit 0 | `10_c1_final_typecheck_lint.log` |
| shared, full | `npm test -w @dems/shared` (09:00) | 69 files / 1,840 tests passed, exit 0 | `10_c1_final_shared_web.log` |
| core-server `unit`, full | `npm test -w @dems/core-server` (09:00-09:03) | 154 files / 3,916 tests passed, exit 0 | `10_c1_final_server_unit.log` |
| core-server `db`, the file | `npm run test:db -- test/acceptance/shared-state.test.ts` (09:00:32) | 1 file / 6 tests passed, 0 databases remain, exit 0 | `10_c1_final_db_shared_state.log` |
| core-web, full (first run 09:00, in parallel) | `npm test -w @dems/core-web` | 7 red / 1,392, exit 1: all timeouts at load 28-34, see note | `10_c1_final_shared_web.log` |
| core-web, full, alone (09:06) | same | **103 files / 1,392 tests passed, exit 0** | `10_c1_final_web_rerun.log` |
| mobile, full (first run 09:00, in parallel) | `npm test -w @dems/mobile` | 16 red / 1,744, exit 1: 26 "Exceeded timeout" lines at load 28-34, see note | `10_c1_final_mobile.log` (+ `.raw.log`) |
| mobile, full, alone (09:07) | `npm test -w @dems/mobile > raw 2>&1` | **146 suites / 1,744 tests passed, exit 0** | `10_c1_final_mobile_rerun.log`, `10_c1_final_mobile_rerun.raw.log` |
| Mobile output searched for the warning | `grep -c 'failed to exit gracefully'` over the whole-run output | **1 (expected 0)**; `did not exit one second`: 0. Residual C1-R1 | `10_c1_final_mobile_rerun.log` |
| `gen-openapi --check`, offline document | see item 3 | up to date, exit 0; offline `360019bc…3c10` = pre-image | `10_c1_final_checks.log` |
| 78 protected test files (6 web + 72 mobile baseline) | `shasum -a 256 -c` against `test/assets/01_protected_tests_sha256.txt` | exit 0, 78 listed | `10_c1_final_checks.log` |

**Note on the runs at 09:00 (P11: recorded, not discarded).** I started shared, web, mobile and server `unit` in parallel. That broke the load guard of P9 (the load reached 28-34), and web and mobile failed only on time limits. Each was re-run alone once the load was under 8, and both passed (above). In the first mobile run jest's stderr went to `10_c1_final_mobile.log` and stdout to `.raw.log` because of a redirection-order mistake; the counts appended inside that file were taken from the stdout half only. The re-run captures both streams in one file.

**Ledger after C1:** shared 69 / 1,840 (unchanged; the new assertions sit inside an existing test). Web 103 / 1,392 (unchanged). **Mobile 146 / 1,744 (+1 suite, +1 test: `log-flush-timer.test.ts`)**. Server `unit` 154 / 3,916 (unchanged). The `db` file is 6 / 6.

### C1-R1 (residual, Low): the whole mobile run still prints the warning once

The fix removes the cause W87 measured: the two baseline suites. But jest prints the warning whenever the last file a worker runs leaves a ref'd timer pending longer than about the worker's exit window. Which file runs last on a worker changes from run to run, which explains why the warning "comes and goes" (F37-8). Diagnosis, in memory with scratch recorders outside the tree:

1. A recorder of ref'd timers still pending after each file (wrapped `setTimeout` / `setInterval`, scratch config, full run 09:12) listed three long-lived sources:
   - `node_modules/@tanstack/query-core/src/timeoutManager.ts:50` (300,000 ms, the query cache's default `gcTime`) in `src/features/home/home-screen.test.tsx`. That file is a **baseline** file (in `acaff20`) and creates `new QueryClient({ defaultOptions: { queries: { retry: false } } })` at `:51` with no `gcTime`.
   - `packages/shared/src/client/core-client.ts:656` (8,000 ms, the call budget timer of CL-6) in `src/features/session-live/live-session-live-link.test.tsx`.
   - `packages/shared/src/sim/platform.ts:188` (`DEFAULT_TIMERS.setTimeout`, 1,000 ms) in 21 files. Hypothesis, not traced: the simulator store's 1 s throttled snapshot write.
2. Each suspect, run with one clean suite on two workers (`assets/10_c1_f1_remaining_warning_diag.log`, 09:17):

| Suite | With a second worker | Alone in band |
|---|---|---|
| `features/home/home-screen.test.tsx` (baseline) | **warning printed** | "Jest did not exit one second …" |
| `features/session-live/live-session-live-link.test.tsx` | **warning printed** | "Jest did not exit one second …" |
| `features/devices/devices-model.test.ts` (baseline) | **warning printed** | clean |
| `runtime/use-pending-press.test.tsx` | clean | clean |

None of these files is in this row's write paths, and two of them are baseline test files that must not change. Possible owner actions, for the controller to choose (W92 / W100 hygiene):

- (a) Make jest's own timers not hold the worker: a test-setup-level unref or cleanup in `apps/mobile/jest.setup.ts`, or TanStack's `timeoutManager` timer provider.
- (b) Unref the simulator's timers in `packages/shared/src/sim/platform.ts`. This is a design decision, because those timers also run in mock-core and the server.
- (c) Find why `live-session-live-link.test.tsx` leaves a call unanswered until its 8 s budget runs out.

A W89 gate that expects "no warning" in the whole mobile run needs one of these first.

### C1-R2 (Info): one W87 test is near its time limit under load

`src/features/session-live/live-gap-read-only-dialog.test.tsx` failed with "Exceeded timeout of 5000 ms" in the load-34 run and once more in a diagnosis run at load about 10 (7.9 s). Alone it passes in 702 ms (09:22:53, `10_c1_f1_remaining_warning_diag.log`). Nothing in this row touches its path. It is the timer of the monitor bed under CPU load, not a failure of its logic.

## 7. Rollback

All pre-images are in `.cache/rollback/C1/<path>.pre`; their SHA-256 values are in `.cache/rollback/C1/C1.pre.sha256`.

```
cp .cache/rollback/C1/apps/mobile/src/runtime/log.ts.pre apps/mobile/src/runtime/log.ts
cp .cache/rollback/C1/apps/core-server/test/acceptance/shared-state.test.ts.pre apps/core-server/test/acceptance/shared-state.test.ts
cp .cache/rollback/C1/packages/shared/src/api/examples.ts.pre packages/shared/src/api/examples.ts
cp .cache/rollback/C1/packages/shared/src/api/openapi.ts.pre packages/shared/src/api/openapi.ts
cp .cache/rollback/C1/packages/shared/openapi/openapi.json.pre packages/shared/openapi/openapi.json
cp .cache/rollback/C1/packages/shared/test/api-openapi-scope.test.ts.pre packages/shared/test/api-openapi-scope.test.ts
cp .cache/rollback/C1/package.json.pre package.json
cp .cache/rollback/C1/README.md.pre README.md
```

The new file `apps/mobile/src/runtime/log-flush-timer.test.ts` has no pre-image. Removing it takes a controller decision (no agent deletes a file), and it only passes while the `log.ts` change is in place. After a rollback, run `gen-openapi --check` and the shared suite again.

| File | SHA-256 before | SHA-256 after |
|---|---|---|
| `apps/mobile/src/runtime/log.ts` | `a7894005…b793` | `54eae203…8419` |
| `apps/mobile/src/runtime/log-flush-timer.test.ts` | (new) | `343a7c4a…cf18` |
| `apps/core-server/test/acceptance/shared-state.test.ts` | `bf629ad2…2160` | `177a80f4…bad6` |
| `packages/shared/src/api/examples.ts` | `151e8061…7802` | `5aaaeea2…e216` |
| `packages/shared/src/api/openapi.ts` | `4562bc52…b49f` | `03c15d67…7776` |
| `packages/shared/openapi/openapi.json` | `7f76ed79…fee0` | `f6fa3762…2d83` |
| `packages/shared/test/api-openapi-scope.test.ts` | `141d1451…4030` | `2ca2b091…13b1` |
| `package.json` | `c556e9c0…c922` | `2ad899e8…39aa` |
| `README.md` | `b04b4904…1918` | `64ec762b…8dcc` |

The full values are in `assets/10_c1_final_checks.log` and `.cache/rollback/C1/C1.pre.sha256`.

## 8. Boundaries kept

- Files written: only the nine files above, plus this document, the progress file and the `10_c1_*` assets. Scratch files live in the session scratchpad and in `.cache/rollback/C1/`.
- No baseline mobile test file and no protected web test file was changed (78 / 78 hashes equal).
- No git write, no Docker, no `cd`, no `timeout` command. The server `db` file ran only through `npm run test:db` with the per-command sandbox bypass.
- Every mutation ran in memory only (M15).
- Exception: one unintended emulator launch in the sandbox, with no lasting effect found (section 5).
