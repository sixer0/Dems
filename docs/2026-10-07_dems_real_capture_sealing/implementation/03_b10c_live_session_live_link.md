# Row 18 — B10-c: `session-live/live-session-live-link` wall-clock independence (CONVERTED)

**Verdict: converted and proven.** `apps/mobile/src/features/session-live/live-session-live-link.test.tsx` contained exactly one real-time wait — the literal `await new Promise((resolve) => setTimeout(resolve, 1_100));` at `:54` (row 16/17's pointer holds exactly), inside the helper `waitA11yTick` (`:52-56`), called from two tests (`:87`, `:127`). Every other await in the file was already on the bed's virtual clock or on promise jobs. The real wait is converted to the runner's controlled clock with row 17's exact pattern. The file now passes **3/3 (2 + 1) targeted runs exit 0** (14/14 tests each, re-run on the final blob), the zero-waits grep prints `0 real-time waits`, no assertion or expected value changed, and the production diff is empty.

Date: 2026-10-07. Agent: coder-execution. Blueprint: `identification/02_structured.md:198` row 18 — Verification: "File passes 3/3 runs; real-time waits = 0; production-code diff empty". Depends on rows 16-17; precedents: `implementation/01_b10a_live_gap_read_only_dialog.md`, `implementation/02_b10b_live_settings_boundary.md`.

## 1. Per-wait root cause (read-only audit at HEAD `2a4f4ea`, blob `f242074`, before any edit)

| Pre-edit line | Token | Kind | Action |
|---|---|---|---|
| `:25` | `await resetLiveMonitorBed()` | NOT a wait: AsyncStorage jest mock promise jobs + synchronous resets (`live-monitor-bed.tsx:174-182`) | untouched |
| `:54` (inside `waitA11yTick`, `:52-56`) | `await new Promise((resolve) => setTimeout(resolve, 1_100));` | **REAL wait** — a global-`setTimeout` sleep of 1100 ms inside `act` | Converted: `jest.advanceTimersByTime(1_100)` + the bed's 40-turn promise-jobs flush, inside the same `act` |
| `:87` | `await waitA11yTick();` (meters test) | call site of the real wait | rides the conversion |
| `:127` | `await waitA11yTick();` (link-lost test) | call site of the real wait | rides the conversion |
| `:116, :140, :150, :160, :167, :177, :195, :200, :202, :228, :238, :247, :249, :262, :275, :281, :295, :297, :302` | `await b.flush()` | NOT real: `flushJobs` = 40 microtask turns inside `act` (`live-monitor-bed.tsx:167-171`) | untouched — proof by the section-5 grep that the file's only timer token was `:54` |
| `:117, :141, :144, :151, :161, :178, :181, :191, :196, :203, :216, :229, :239, :252, :263, :276, :282, :299` | `await b.elapse(ms[, step])` | NOT real: fake transport clock, `act(fake.clock.advance)` + `flushJobs(20)` per step (`live-monitor-bed.tsx:275-282`, `packages/shared/src/live/testing/clock.ts:81`) | untouched |
| `:270, :292` | `await b.changeOnCore(...)` | NOT real: engine call + `flushJobs` (`live-monitor-bed.tsx:261-266`) | untouched |
| `:310` | `await settle()` | NOT real: `flushAsync` = one microtask inside `act` (`apps/mobile/src/runtime/testing/test-sim.tsx:151-155`) | untouched |

Token census pre-edit — `grep -nE "setTimeout|setInterval|sleep\(|Date\.now|performance\.now|advanceTimers|useFakeTimers|new Promise" <file>` printed exactly one line: `54:    await new Promise((resolve) => setTimeout(resolve, 1_100));`. No `jest.setTimeout` ceiling exists in this file (unlike row 17's `:48`), so nothing is in row 19's scope here.

Why the wait could not simply ride the bed's clock (the distinction from row 16): the value it waits for is refreshed by `useAudioAccessibilityValue`, which arms a **global JS `setInterval`** at 1 s (`apps/mobile/src/runtime/use-audio-shared-values.ts:99-106` — `const timer = setInterval(...)`, `intervalMs = AUDIO_A11Y_INTERVAL_MS = 1000` at `:28`). That is the runtime's own timer, not the fake transport clock the bed injects (`live-monitor-bed.tsx:365` `timers: fake.clock.timers`); `b.elapse` cannot fire it. The runner's clock is the only clock that owns it — exactly the situation row 17's pattern is for. The precedent that drives this same interval on the runner's clock: `apps/mobile/src/runtime/use-audio-shared-values.test.tsx:79-103` (`jest.useFakeTimers()` + `jest.advanceTimersByTime(900)` / `(100)` across the 1 s tick).

## 2. The conversion — row 17's exact pattern, no new invention

All changes are in the one test file (post-edit lines):

| New line | What | Why (precedent) |
|---|---|---|
| `:13` | `beforeAll` and `jest` added to the `@jest/globals` import | row 17 `:20` |
| `:15` | `import { promisify } from 'node:util';` | row 17 `:27`; `node:` builtins accepted in mobile tests |
| `:25-26` | `nextTurn = promisify(setImmediate) as () => Promise<void>` | row 17 `:222` — scheduler hand-overs, not duration waits |
| `:28-35` | `beforeAll`: `await nextTurn(); await nextTurn();` | S72-12 Reanimated frame-callback registry priming before the first fake install (row 17 `:221-231`); this file renders the real `DbfsMeter`/shared-value tree (`:46` `screen.UNSAFE_getAllByType(DbfsMeter)`) so the same priming guard applies |
| `:43` | `beforeEach` first line: `jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });` | the exact `doNotFake` list row 17 used (`live-settings-boundary.test.tsx:233-238`, from `probe-failure.test.ts:213`): promise jobs, `act` hand-overs and the worklets mock `runOnJS` must stay off the clock |
| `:45-51` | `afterEach` last line: `jest.useRealTimers()` (after the existing `bed?.stop(); bed = null;`) | camera-feed/app-providers/row 17 restore discipline |
| `:70-78` | `waitA11yTick()` body: `act(async () => { jest.advanceTimersByTime(1_100); for (let turn = 0; turn < 40; turn += 1) await Promise.resolve(); })` | row 17's converted `wait()` (`:157-164`): advance + the bed's own 40-turn flush convention (`live-monitor-bed.tsx:167-171`); the 1100 ms value and the `act` wrapper kept verbatim |

Why the install is safe over the whole file: every bed primitive is microtask-driven (`flushJobs` `:167-171`, `elapse` `:275-282`) and the bed's transport clock is its own scheduler (`clock.ts:81` `setTimeout: (callback, delayMs) => schedule(delayMs, callback)`), untouched by jest's faking of the globals — the same coexistence row 17 proved green 3/3 on this tree shape.

## 3. Behaviour unchanged

`git diff -- apps/mobile/src/features/session-live/live-session-live-link.test.tsx` (`f242074..9961da5`) is exactly four hunks, 27 insertions / 3 deletions — the import line, the `beforeAll`+`beforeEach`+`afterEach` block, the `waitA11yTick` body, and their comments. No assertion, matcher, expected value, test name, `1_100` value or bed call touched; **14 tests before and after, all 14 green in every run**. The causal chain of both converted call sites is preserved: at `:111` (was `:87`) the advance fires the 1 s interval once (1000 ≤ 1100 < 2000, exactly as the real sleep fired it once), then the promise turns commit the `setValue` re-render the following `a11yOf` assertions read; at `:151` (was `:127`) the same tick delivers `NO SIGNAL`. Determinism is asserted by the runs, not assumed: the interval firing is now a step count, immune to host starvation — the D256 SC7 load-failure mode this row removes. Side effect with no assertion riding on it: the baseline run ended with "Jest did not exit one second after the test run has completed" (stray real toast-auto-dismiss handles, row 16 residual 1); every post-conversion run ends clean, because pending runner timers are dropped by `jest.useRealTimers()`.

## 4. Verification — 3/3 (2 + 1), no timeouts raised

Command (row 16's working form, repository root; the `npx jest --rootDir` form is forbidden — cwd-relative `@/` babel aliases, row 16 §3):

`npm run test -w @dems/mobile -- src/features/session-live/live-session-live-link --maxWorkers=2`

Official trio on the **final blob `9961da5`** (each exit 0):

```
exit r1=0  PASS src/features/session-live/live-session-live-link.test.tsx (9.395 s)
           Test Suites: 1 passed, 1 total   /  Tests: 14 passed, 14 total  /  Time: 9.638 s
exit r2=0  PASS src/features/session-live/live-session-live-link.test.tsx (12.622 s)
           Test Suites: 1 passed, 1 total   /  Tests: 14 passed, 14 total  /  Time: 12.743 s
exit r3=0  PASS src/features/session-live/live-session-live-link.test.tsx (8.28 s)
           Test Suites: 1 passed, 1 total   /  Tests: 14 passed, 14 total  /  Time: 8.376 s, estimated 13 s
```

A first official trio on the pre-reword blob (identical code, comment wording only; each exit 0): `Tests: 14 passed, 14 total`; `Time: 15.473 s` / `5.615 s` / `5.58 s`. Plus a pre-edit baseline (`Time: 9.671 s`, 14 passed, the open-handle warning quoted above) and one conversion smoke (exit 0, `Time: 10.447 s`). Total: 8 green runs of this file, 6 of them post-conversion, zero flakes — **no re-run was needed**.

Host during runs: `uptime` load averages moved 4.98 → 7.99 (the concurrent STT functional check and analyst work noted in the assignment; quoted at run time, e.g. "load averages: 7.04 6.40 5.93" after the first trio). The suite's *wall* time tracks that load (5.6 → 12.7 s), but it is pure CPU now: the max per-test time across all post-conversion runs is 712 ms (the first meters test at load ~7), against a pre-conversion arithmetic floor of ≥1.1 s on each of the two converted tests (two literal 1100 ms sleeps at `:87`/`:127`). Comfortably inside `testTimeout: 20000` (`apps/mobile/jest.config.js:10`, untouched); no `jest.setTimeout` added anywhere (row 19's sweep).

Additional gates: `npx tsc -p apps/mobile/tsconfig.json --noEmit` → exit 0. `npx eslint src/features/session-live/live-session-live-link.test.tsx` (cwd `apps/mobile`, workspace `eslint.config.js`) → exit 0.

## 5. Zero real-time waits — the acceptance grep, quoted

```
$ grep -nE "setTimeout\( *[0-9]{3,}|sleep\(|await new Promise" apps/mobile/src/features/session-live/live-session-live-link.test.tsx || echo "0 real-time waits"
0 real-time waits
```

Wider pattern (row 16's completeness check), on the final blob:

```
$ grep -nE "setTimeout|setInterval|sleep\(|wait\(|Date\.now|performance\.now" apps/mobile/src/features/session-live/live-session-live-link.test.tsx || echo "0 timer/real-clock tokens"
0 timer/real-clock tokens
```

and `grep -cE "await new Promise|setTimeout"` on the file prints `0`. What remains as time-control is exactly the bed's mechanism: `b.flush()` / `b.elapse(...)` (`live-monitor-bed.tsx:167-171`, `:275-282`, `clock.ts:81`) plus the one runner-clock advance in `waitA11yTick` (`:76`).

## 6. Production diff empty

```
$ git diff --name-only -- apps/ packages/ scripts/ release/
apps/core-web/src/test/live-paired-devices-issue.test.tsx
apps/mobile/src/features/session-live/live-session-live-link.test.tsx
apps/mobile/src/features/settings/live-settings-boundary.test.tsx
$ git diff --name-only -- apps/ packages/ scripts/ release/ | grep -v "\.test\." || echo "no non-test entries"
no non-test entries
```

Attribution of all three entries (all test files, zero production files):
- `live-session-live-link.test.tsx` — **mine** (row 18): the only file this session wrote under `apps/` (`f242074` → `9961da5`, the four hunks of section 3).
- `live-settings-boundary.test.tsx` — **NOT mine**: row 17's gated conversion (`implementation/02_b10b_live_settings_boundary.md` §2, D12(b) — row 17 PASS), still uncommitted in the shared tree. Touched by me in no way; D10(e)/D12 already attribute it.
- `live-paired-devices-issue.test.tsx` — **NOT mine**: core-web row 20's gated conversion (D12(c) — row 20 PASS, 3/3 × 20 tests), also uncommitted. Already modified when this row started; left untouched per the assignment's sibling-attribution rule.

`git status --porcelain` outside the task folder shows exactly those three test files — no config, no `package.json`/`package-lock.json`, no other source path. The two artifacts of this row are the only files written under `docs/2026-10-07_dems_real_capture_sealing/` by this session.

## 7. Residual risks / notes for row 25 (senior code review)

1. **The `doNotFake` list is load-bearing** (row 17 residual 2, now for a second file): without `['nextTick', 'queueMicrotask', 'setImmediate']` the bed's `flushJobs` microtask turns still run, but `act` hand-overs and the worklets mock `runOnJS` would queue behind clock advances. Two files now depend on the list: `live-settings-boundary.test.tsx`, this file.
2. **The `beforeAll` two-turn priming is load-bearing** (row 17 residual 3): if fake timers are ever installed earlier than `beforeEach`, the S72-12 Reanimated-registry error returns.
3. **Toast lifetime is now runner-controlled here too**: an on-screen toast could disappear if a `waitA11yTick` (1.1 s advance) runs while a toast armed ≤1.1 s earlier is up. Neither of this file's two converted tests asserts `toastShown` after a tick, and the tests that do assert toasts (`:192-193`, `:264`, `:288`, `:301`, `:344` post-edit — the `OFFLINE`/refusal/Simulated cases) never advance the runner clock between arming and asserting, so presence is deterministic. A future edit combining the two must re-check this. (Row 16 residual 1, updated for the fake clock.)
4. **Wall-clock leaks via the shared harness, not this file**: `monitor-harness.tsx:33-37` `waitForSheetExit` still sleeps `SHEET_EXIT_MS + 50` in real time; it is used by `live-session-live-sites.test.tsx` and `session-live-screen.test.tsx`, which are NOT in the row 16-22 file list (census: the other seven `live-monitor-bed` importers contain no literal waits themselves — per-file `grep -cE "await new Promise|setTimeout\( *[0-9]{2,}"` all 0). If the M0 gate wants whole-suite wall-clock independence, the harness helper is the next conversion; out of scope here by the row's file target.
5. **Runner fake timers + bed virtual clock is now the pattern for exactly two mobile files** (`grep -rln "live-monitor-bed" apps/mobile/src | xargs grep -ln "useFakeTimers"` → this file + the boundary file). The other seven bed files stay on row 16's finding — already virtual, install nothing.
6. **Suite wall under host load**: 5.6-12.7 s observed at load 5-8; it is bounded CPU (module transform + the 37 `b.flush`/`b.elapse` loops), max test 712 ms, all inside `testTimeout: 20000`. If row 27 sees load flakes in the full-suite run, the lever is worker count, not this file's clock.
7. **Command form for the chain**: `npm run test -w @dems/mobile -- <pattern> --maxWorkers=2` verified unchanged (8 green runs). Row 19 has no per-test override to remove in this file (section 1); rows 21-22 can reuse the pattern of section 2 directly.

---
*Row 18, blueprint `identification/02_structured.md:198`; baseline HEAD `2a4f4ea`; file blob `f242074` → `9961da5`. Precedents: `implementation/01_b10a_live_gap_read_only_dialog.md` (row 16), `implementation/02_b10b_live_settings_boundary.md` (row 17). Prepared 2026-10-07.*
