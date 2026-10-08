# Row 21 — B10-f: `chrome-lost-updates` first-test residual (D246) settled without wall-clock waits (CONVERTED)

**Verdict: converted and proven.** `apps/mobile/src/navigation/__tests__/chrome-lost-updates.test.tsx` contained four real-time waits — the `wait(MOTION_OVER_MS)` sleeps at pre-edit `:150`, `:162`, `:181` and `:216` — all driven by the literal `await new Promise((resolve) => setTimeout(resolve, ms))` helper at `:123-127`. The D246 first-test residual sat on two of them (`:150`, `:162`). All four are converted to the runner's controlled clock with row 17's exact pattern. The file now passes **3/3 (2 + 1, D8) targeted runs exit 0** (4/4 tests each), the zero-waits acceptance grep prints `0 real-time waits`, no assertion or expected value changed, and the production diff is empty.

Date: 2026-10-07. Agent: coder-execution. Blueprint: `identification/02_structured.md:201` row 21 — Verification: "File passes 3/3 runs; real-time waits = 0; production-code diff empty". Depends on rows 19 (done, `implementation/04_b10e…`) and 20 (done, `implementation/05_b10d…`); precedents: `implementation/01_b10a…` (row 16, root-cause-first), `implementation/02_b10b…` (row 17, the conversion pattern), `implementation/03_b10c…` (row 18). Workspace located by row 1: `apps/mobile`, jest (`research/01_explore.md` §2.6).

## 1. Wait census — pre-edit lines, each quoted (read-only audit at HEAD `2a4f4ea`, blob `b1a1c38`, before any edit)

Pre-edit the file had exactly one timer token. Quoted from the file (`git show HEAD:…test.tsx`):

```
123:  async function wait(ms: number): Promise<void> {
124:    await act(async () => {
125:      await new Promise((resolve) => setTimeout(resolve, ms));
126:    });
127:  }
```

| Pre-edit line | Token | Kind | Action |
|---|---|---|---|
| `:123-127` | `wait(ms)` helper — `await new Promise((resolve) => setTimeout(resolve, ms))` inside `act` | **REAL wait engine** — a global-`setTimeout` sleep of `ms` wall-clock | Converted: `act` + `jest.advanceTimersByTime(ms)` + 40 microtask turns (row 17's `wait()` shape) |
| `:150` (first `it()`, `:140`) | `await wait(MOTION_OVER_MS);` | **REAL wait** — 700 ms sleep (D246 residual test, step 1) | rides the conversion |
| `:162` (first `it()`) | `await wait(MOTION_OVER_MS);` | **REAL wait** — second 700 ms sleep (D246 residual test, the "later switch" step `:160-167`) | rides the conversion |
| `:181` (second `it()`, `:170`) | `await wait(MOTION_OVER_MS);` | **REAL wait** — full-motion overlay-removal test | rides the conversion |
| `:216` (fourth `it()`, `:207`) | `await wait(MOTION_OVER_MS);` | **REAL wait** — tablet-rail E2E-T-2 test | rides the conversion |
| `:116` | `MOTION_OVER_MS = Math.max(colorFadeBudgetMs(FULL_MOTION), indicatorTravelBudgetMs(FULL_MOTION), tabFadeBudgetMs(FULL_MOTION)) + 100` | NOT a wait: a computed budget constant = **700 ms** — `colorFadeBudgetMs = 240 + 60 = 300` (`nav-item.tsx:30,33-34`), `indicatorTravelBudgetMs = 600` (`use-indicator.ts:31,34`, `FULL_MOTION.slow === false`, `motion/tokens.ts:33,69-72`), `tabFadeBudgetMs = 160 + 80 = 240` (`app-tabs.tsx:104-106`, `packages/shared/src/tokens/tokens.ts:284` `fast: 160`) | value kept verbatim — it is now the clock-advance quantum |
| `:189-203` (third `it()`, reduced motion) | — | NO wait: fully synchronous body, asserts state at once | untouched |

Census completeness: post-edit `grep -nE "jest\.setTimeout\(|setTimeout" <file>` prints nothing ("no setTimeout tokens at all"), so no timer token existed anywhere else pre-edit either. Token check for row 19's residual question (was this file one of the 20 `jest.setTimeout(30_000)` files outside RC-8?): **no** — pre-edit `grep -n "jest.setTimeout" <file>` exit 1 (quoted in the working log); the file never carried a per-test override, exactly as D246 noted ("no explicit timeout"). No separate finding for row 19's sweep.

**Errata note for row 25/row 6:** `research/01_explore.md` §2.6 lists the wait sites as "`:150`, `:162`, `:181`" — the file actually has **four** sites; `:216` (the E2E-T-2 tablet test) was missed. Same symptom-grouping pattern row 16 flagged (D256): the grouping by file was right, the per-site detail was not. The acceptance criterion is file-level ("real-time waits = 0"), so the conversion covers all four; only the first test's two waits were the D246 residual.

## 2. D246 residual root cause (why the FIRST `it()` flaked)

Record trail, quoted:

- `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/15c_fxr_mobile.md:80` (full-suite run 2, load 6.79 climbing to ~11): "`navigation/__tests__/chrome-lost-updates.test.tsx` 4 tests (the first timed out at 5 s at load ~11, the other three cascade on the unmounted renderer; alone it passes 4/4, first test 3.4 s)".
- `15c_fxr_mobile.md:86-88` (residual to the controller): "`chrome-lost-updates.test.tsx` 'Sessions -> a session detail -> Evidence' has no explicit timeout and takes ~3.4 s alone; it hit the 5 s default at load ~11. It is the same load-flake class as W93-17 (D239) but was not one of the routed tests; this row did not change its budget."
- D246 (`docs/2026-10-04_dems_backend_rbac_pairing/decisions/decisions.md:252`): "Residual: the first test in `navigation/__tests__/chrome-lost-updates.test.tsx` has no explicit timeout (3.4 s alone) — same load-flake class; added to the pre-commit tidy-up." Row 21 is that tidy-up.

Mechanism, matching the load-flake class T1 root-caused for the family (`gateway_check/16_t1_mobile_jest_timeout.md:23` — "Failure reason in the full run is therefore load-only, consistent with the 5 s default timeout"): the first test is the file's most expensive by construction — it is the only test with **two** real 700 ms sleeps (`:150`, `:162`, 1400 ms of the measured 2.8-3.4 s wall) **and** the heaviest CPU path (initial `/sessions` render, `router.push` to a session detail, two tab switches, full route-tree re-commits). Under host load the render CPU, not the sleeps, is what competes with the timeout: sleeps wait without CPU, but the CPU work around them was squeezed past the then-default 5 s. The config mitigation (`apps/mobile/jest.config.js:9-10` `testTimeout: 20000`, the comment citing D239/D246) raised the ceiling; the file itself stayed wall-clock-coupled — the residual D246 explicitly left open.

Classification per the row-21 mandate: the residual **is a wall-clock wait** (two literal `setTimeout` sleeps of the same `wait()` engine as rows 17/18) with timing-derived *settling* assertions behind it — the post-`wait` asserts read React commits made by component timers armed at the switch (`nav-item.tsx:57` fade removal, `use-indicator.ts:81` travel removal, `app-tabs.tsx:123` veil removal). The evidence therefore says: convert to the fake/virtual pattern and drive the clock explicitly — exactly row 17's method; no assertion change is needed because the same 700 ms virtual advance fires the same timers in the same order.

## 3. The conversion — row 17's exact pattern, no new invention

All changes are in the one test file (post-edit lines; `git diff` = five plumbing hunks, +23/−2, blob `b1a1c38` → `9e98b8a`):

| New line | What | Why (precedent) |
|---|---|---|
| `:16` | `beforeAll` added to the `@jest/globals` import | row 17 `:20` / row 18 `:13` |
| `:21` | `import { promisify } from 'node:util';` | row 17 `:27` / row 18 `:15`; `node:` builtins accepted in mobile tests |
| `:129` | `wait(ms)` body: `jest.advanceTimersByTime(ms)` + 40-turn `await Promise.resolve()` flush inside the same `act` | row 17's converted `wait()`; the 40-turn flush is the bed convention (`live-monitor-bed.tsx:167-171`); the value `MOTION_OVER_MS` (700) kept verbatim |
| `:139` | `const nextTurn = promisify(setImmediate) as () => Promise<void>;` | row 17 `:221-231` / row 18 `:25-26` |
| `:141-144` | `beforeAll`: `await nextTurn(); await nextTurn();` | S72-12 Reanimated frame-callback-registry priming before the first fake install — this tree really touches Reanimated at runtime (`useFrameCallback` users in the app tree: `dbfs-meter.tsx`, `camera-feed.tsx`, `motion/debug-overlay.tsx`; the worklets mock drains on a 0 ms timer) |
| `:149` | `beforeEach` first line: `jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });` | the exact `doNotFake` list proven for promise-heavy trees (`probe-failure.test.ts:213`, rows 17/18); keeps `act` hand-overs and the worklets `runOnJS` off the clock |
| `:157` | `afterEach` last line: `jest.useRealTimers()` (after the existing `resetMotionStateForTests()`) | camera-feed/app-providers/row 17/18 restore discipline |

The three `beforeEach` setup calls that already existed (`resetShellState()`, `resetMotionStateForTests()`, `await AsyncStorage.clear()`) are unchanged; the AsyncStorage jest mock is promise-based (`jest.setup.ts:15-17` mock; the package mock's `clear` resolves via microtasks), so it is unaffected by the fake clock.

## 4. Behaviour unchanged

The `git diff` hunks are exactly: two import lines, the `wait()` body, the `nextTurn` + `beforeAll` block, the `beforeEach` install line, the `afterEach` restore line, and their comments — verified hunk by hunk. **No assertion, matcher, expected value, test name, `MOTION_OVER_MS` value or call-site changed; 4 tests before and after** (`describe`/`it` blocks untouched, lines 134-224 pre-edit verbatim). Equivalence of the conversion:

- Same quantum: each converted site advances the runner clock by the identical 700 ms; the component removal timers (300/600/240 ms budgets, §1) fire on the advance exactly once, as they did during the real sleep.
- The assertions are state-existence checks — router pathname from the store (`app-tabs`/harness `getPathname`), effective opacity/color/transform reads (`effectiveOpacity`, `visibleTints`, `visibleIndicators`), testID presence, veil counts, `REDUCED_MOTION.policy` — none reads a clock-derived value, so modern fake timers also faking `Date.now`/`performance.now` is inert here.
- The pre-sleep assertion at `:148`/`:149` (screen drawn at full opacity at once) runs before any advance, exactly as before.
- Determinism is proven by runs, not assumed: three official + two verbose runs on the final code all green with **identical console noise counts** (§6) — the D246 load-coupling (test time = CPU contention + real sleeps) is now CPU-only.

## 5. Verification — 3/3 (2 + 1, D8), no timeouts raised

Command (D10(f)/row 16's working form, repository root; `--maxWorkers=2` per D12): `npm run test -w @dems/mobile -- src/navigation/__tests__/chrome-lost-updates --maxWorkers=2`

Official trio, exit codes captured directly from npm, each run exit 0:

```
== RUN 1 ==  EXIT_r1=0
PASS src/navigation/__tests__/chrome-lost-updates.test.tsx
Test Suites: 1 passed, 1 total   /   Tests:       4 passed, 4 total   /   Time:        4.846 s
== RUN 2 ==  EXIT_r2=0
PASS src/navigation/__tests__/chrome-lost-updates.test.tsx
Test Suites: 1 passed, 1 total   /   Tests:       4 passed, 4 total   /   Time:        3.746 s, estimated 5 s
== RUN 3 ==  EXIT_r3=0
PASS src/navigation/__tests__/chrome-lost-updates.test.tsx
Test Suites: 1 passed, 1 total   /   Tests:       4 passed, 4 total   /   Time:        3.306 s, estimated 4 s
```

(An earlier identical trio had valid PASS lines but the exit echo was captured from the `grep` pipeline instead of npm, so it is excluded from the official 3/3 evidence; the trio above re-ran with `$?` immediately after npm. Total green runs of this file this session: 8 — 1 baseline, 1 smoke, 3 excluded-form, 3 official — zero flakes, no re-run needed under load.)

Baseline and smoke, `--verbose`, per-test durations showing the sleeps collapse (same command + `--verbose`):

| | pre-edit baseline | post-conversion smoke |
|---|---|---|
| first `it()` (D246 residual) | **2778 ms** | **1306 ms** |
| full-motion overlay test | 1012 ms | 388 ms |
| reduced-motion test | 374 ms | 291 ms |
| tablet-rail test | 1030 ms | 474 ms |
| suite `Time:` | 8.291 s | 5.749 s |

The 2778→1306 ms delta on the residual test matches the two removed 700 ms sleeps (1400 ms) within commit-scheduling noise; the first test's own baseline time (~2.8-3.4 s, cf. D246's "3.4 s alone") is what made it the 5-s-default casualty at load ~11 (§2). Host during all runs: load averages 5.2-7.0 (`uptime` at 17:10-17:14, concurrent spec agents). No timeout was raised anywhere; `apps/mobile/jest.config.js` untouched (not in the diff); no `jest.setTimeout` added (grep in §1). All three official runs end clean — `grep -cE "Jest did not exit|A worker process has failed"` printed `0` for every run (row 18's same side effect: pending runner timers are dropped by `useRealTimers()`).

Additional gates: `npx tsc -p apps/mobile/tsconfig.json --noEmit` → exit 0; `npx eslint src/navigation/__tests__/chrome-lost-updates.test.tsx` (cwd `apps/mobile`, workspace `eslint.config.js`) → exit 0.

## 6. Zero real-time waits — the acceptance grep, quoted

```
$ grep -nE "setTimeout\( *[0-9]{3,}|sleep\(|await new Promise" apps/mobile/src/navigation/__tests__/chrome-lost-updates.test.tsx || echo "0 real-time waits"
0 real-time waits
```

Wider pattern (rows 16/18 completeness check):

```
$ grep -nE "setTimeout|setInterval|sleep\(|wait\(|Date\.now|performance\.now" apps/mobile/src/navigation/__tests__/chrome-lost-updates.test.tsx
130:async function wait(ms: number): Promise<void> {
171:    await wait(MOTION_OVER_MS);
183:    await wait(MOTION_OVER_MS);
202:    await wait(MOTION_OVER_MS);
237:    await wait(MOTION_OVER_MS);
```

The five hits are the virtualized helper itself (now `jest.advanceTimersByTime` + microtask turns, `:130-135`) and its four call sites — the same "helper name is the only token" shape row 17 reported. `setTimeout` as a substring appears **nowhere** in the file (§1's third grep). Console noise is pre-existing harness dev output and is identical in every run (`grep -c` per official run: `console.error` 105, `flushActQueue` 76, Uniwind `couldn't find your variable` 1, `"invalid" is not a valid color` 15 — the react-test-renderer stack dumps and Skia mock warnings row 16 already noted), with zero open-handle warnings.

## 7. Production diff empty — with sibling attribution

```
$ git diff --name-only -- apps/ packages/ scripts/ release/ | grep -v "\.test\."
(no output; exit 1 — "no non-test entries")
```

All 11 entries of `git diff --name-only -- apps/ packages/ scripts/ release/` are `*.test.tsx` files:

| Changed file | Owner | This row's touch |
|---|---|---|
| `apps/mobile/src/navigation/__tests__/chrome-lost-updates.test.tsx` | **row 21 (mine)** | the five hunks of §3 only |
| `apps/mobile/src/features/settings/live-settings-boundary.test.tsx` | row 17 conversion + row 19 `40_000` deletion (D12(b), gated) | not touched |
| `apps/mobile/src/features/session-live/live-session-live-link.test.tsx` | row 18 conversion (gated) | not touched |
| `apps/core-web/src/test/live-paired-devices-issue.test.tsx` | row 20 conversion (D12(c), gated) | not touched |
| `devices-screen`, `evidence-detail`, `evidence-more-menu-title`, `play-sheet`, `more-live`, `live-session-new-followups`, `storage-screen` `.test.tsx` (7 files) | row 19 RC-8 sweep (gated) | not touched |

Zero production (non-test) entries; `jest.config.js`, `jest.setup.ts`, `package.json`, `package-lock.json` not in the diff; `git status --porcelain` outside the task folder shows exactly those 11 test files. Constraint compliance: only this file's jest suite was run (single writer of the mobile runner this wave), no other workspace, no root `npm test`, no config/dependency change, no emulator/sudo/network.

## 8. Residual risks / notes for row 25

1. **The `doNotFake` list is load-bearing for a third file** (rows 17/18 residuals): `chrome-lost-updates.test.tsx` now joins `live-settings-boundary` and `live-session-live-link` depending on `['nextTick','queueMicrotask','setImmediate']`; without it `act` hand-overs and worklet `runOnJS` queue behind clock advances.
2. **The `beforeAll` two-turn priming is load-bearing** (same three files): installing fake timers earlier than `beforeEach` would bring back the S72-12 Reanimated-registry failure.
3. **This file is now the fourth wall-clock conversion in the B10 chain** and completes it: the register line B10 ("4 files + RC-8 + chrome-lost-updates", `identification/02_structured.md:270`) is fully settled at row 21's close — rows 16 no-change, 17/18/20 converted, 19 timeout sweep, 21 converted. No mobile test file with a literal sleep remains in the row 16-22 list; row 18's residual 4 (`monitor-harness.tsx:33-37 waitForSheetExit`, used by two files outside the list) stays the known next conversion if the M0 gate wants whole-suite independence.
4. **Runner-fake + full route tree is newly proven here**: before this row the harness tree had never run under fake timers (`route-error-fallback.test.tsx:19` fakes only a single-component render); 8 green runs establish the combination, including expo-router's synchronous store updates (the `getPathname` asserts before any advance still hold).
5. **Toast lifetime is now runner-controlled** (rows 16/17/18 residual, updated): no assertion in this file touches toasts, so nothing couples; a future edit asserting on-screen toasts must re-check §2 of rows 17/18.
6. **Register errata for row 6/25**: `research/01_explore.md` §2.6 undercounts this file's wait sites (3 listed, 4 actual — `:216` missed); classification (real waits, convert) unaffected.
7. **Suite wall under load**: 3.3-4.8 s at load 5-7; bounded CPU only (module transform + two route-tree renders + advances), max converted test 1306 ms vs the config `testTimeout: 20000`. If row 27 sees load flakes in a full run, the lever is worker count/host load, not a re-added sleep or ceiling (row 19 residual 5).

## Artifacts

- This report: `docs/2026-10-07_dems_real_capture_sealing/implementation/06_b10f_chrome_lost_updates.md`
- Progress note: `docs/2026-10-07_dems_real_capture_sealing/delegation_progress/coder-execution__row21.md`
- Edited test file: `apps/mobile/src/navigation/__tests__/chrome-lost-updates.test.tsx` (blob `b1a1c38` → `9e98b8a`)
- No `masterplan/02_plan.md` exists in this task folder (only `01_specs.md` + spec files), so plan-table tracking was not applicable; `status_tasks.md` and `decisions.md` are controller-owned and were not touched, per this row's Documentation Contract (exactly two files written in the task folder).

---
*Row 21, blueprint `identification/02_structured.md:201`; baseline HEAD `2a4f4ea`. Verification evidence: sections 5-7. Prepared 2026-10-07.*
