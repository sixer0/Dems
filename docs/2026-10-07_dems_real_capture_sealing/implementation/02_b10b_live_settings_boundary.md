# Row 17 — B10-b: `settings/live-settings-boundary` wall-clock independence (CONVERTED)

**Verdict: converted and proven.** `apps/mobile/src/features/settings/live-settings-boundary.test.tsx` contained two real-time waits (`:159` and `:220`, the file at HEAD `2a4f4ea`, blob `0505dd9` — row 16's pointers hold exactly). Both are converted to the runner's controlled clock following the workspace's established fake-timer pattern. The file now passes **3/3 (2 + 1)** targeted runs exit 0 (8/8 tests each), the zero-waits grep prints `0 real-time waits`, no assertion or expected value changed, and the production diff is empty.

## 1. Per-wait root cause (read-only first, before any edit)

| Pre-edit line | Token | Kind | Action |
|---|---|---|---|
| `:159` (inside `wait()`, `:156-161`) | `await new Promise((resolve) => setTimeout(resolve, ms))` | REAL wait — a global-`setTimeout` sleep of `ms` ∈ {20, 100, 300, 600} ms inside `act`; also the engine of `until()` (`:166-172`), which polls every 50 ms with a 8000/2000 ms real budget | Converted: `jest.advanceTimersByTime(ms)` + the bed's 40-turn promise-jobs flush, inside the same `act` |
| `:220` (inside `beforeAll`, `:218-221`) | `await new Promise((resolve) => setTimeout(resolve, 50))` | REAL wait — S72-12 priming for Reanimated's UI-side frame-callback registry; NOT on any virtual clock | Converted: two deterministic event-loop hand-overs (`promisify(setImmediate)`), no timer at all |
| `:48` | `jest.setTimeout(40_000)` | NOT a wait: a per-test wall-clock *ceiling* | Left untouched (row 19's timeout sweep owns per-test timeouts; grep-safe) |
| `:242` | `clockFromTimers({ now: () => Date.now(), setTimeout: (task, ms) => setTimeout(task, ms), … })` | NOT a wait: the fake transport's clock *bridge* — reads the globals at call time (`packages/shared/src/live/testing/clock.ts:9-11`: "A test that runs under the runner's fake timers passes runner-controlled functions, so a single runner call … moves both the client's timers and the fake's delays") | Left untouched; with the runner's fake timers installed it becomes virtual automatically — this is the helper's designed pairing |

So unlike row 16 (whose file turned out to be already virtual), this file's two waits ARE real — the mechanism is documented in `docs/2026-09-30_dems_demo_stack_setup/implementation/45_mobile_brand_media.md:275` (S72-12): the first render under fake timers finds no registry. Reanimated instantiates the registry at module load (`node_modules/react-native-reanimated/src/hook/useFrameCallback.ts:22` → `FrameCallbackRegistryUI.ts:30` `prepareUIRegistry` → `scheduleOnUI`), and the worklets mock runs that on a 0 ms real timer (`node_modules/react-native-worklets/lib/module/mock.js` `runOnUI` → `runLoop/uiRuntime/mockedRequestAnimationFrame.js:8` `return setTimeout(() => callback(performance.now()), 0)`). The 50 ms sleep was the old, load-sensitive drain; setting `global._frameCallbackRegistry` (`FrameCallbackRegistryUI.ts:130`) needs exactly one macrotask turn, which two `setImmediate` hand-overs guarantee deterministically (Node runs due timers before the next check-phase immediate).

## 2. The conversion — the established workspace pattern, not a new one

The file renders the real `AppProviders` → `BootGate` → `RootNavigator` tree with the real HeroUI dialog and the runtime-built Live source. The precedent for this exact shape is `camera-feed-video.test.tsx:41-58` (prime in `beforeAll` before fake timers, `jest.useFakeTimers()` in `beforeEach`, `jest.useRealTimers()` in `afterEach`), and the fake-timer islands in provider/live tests (`app-providers.test.tsx:101-130`, `:135-141`; `live-core-errors.test.tsx:257`). Changes, all in the one test file:

| New line | What | Why |
|---|---|---|
| `:27` | `import { promisify } from 'node:util';` | the beforeAll drain; `node:` builtins are an accepted import in mobile tests (`runtime/use-pending-press.test.tsx:10` `node:fs`) |
| `:157-164` | `wait(ms)` = `act` + `jest.advanceTimersByTime(ms)` + 40 microtask turns | the bed's own flush convention (`live-monitor-bed.tsx:167-171`, `:275-282` `elapse`); `until()` (`:166-172` pre-edit) untouched, its 50 ms polls and budgets become virtual |
| `:221-231` | `nextTurn = promisify(setImmediate)`; `beforeAll` = `await nextTurn(); await nextTurn();` | S72-12 priming as scheduler hand-overs instead of a duration sleep — zero dependency on elapsed real ms |
| `:233-238` | `beforeEach` first line: `jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] })` | the exact `doNotFake` list proven in this workspace for promise-heavy live plumbing (`probe-failure.test.ts:213`); keeps `act` hand-overs and the worklets mock `runOnJS` (queueMicrotask, `mock.js`) off the clock |
| `:262-271` | `afterEach` last line: `jest.useRealTimers()` (after the existing `wait(20)`, asserts) | camera-feed/app-providers restore discipline |

With the runner owning the clock, `clockFromTimers` (`:257`) makes the fake transport's delays, the Live source's housekeeping (`packages/shared/src/realtime/live-socket-client.ts:468-472` — "the global timer functions, looked up at every call"), the mobile adapter timers (`sim-adapters.ts:308-313` `DEFAULT_LIVE_TIMERS`, wrapped by `createStallTolerantTimers` at `:402`) and every component timer advance together — one clock, test-driven.

## 3. Behaviour unchanged

`git diff` of the file (`0505dd9..d4f232e`) is exactly six hunks: one import, `wait()`, the `beforeAll` body, the `beforeEach` install line, the `afterEach` restore line, and their comments — verified hunk by hunk (`git diff -- apps/mobile/src/features/settings/live-settings-boundary.test.tsx`). No assertion, matcher, expected value, test name, `until()` body, budget, or `:257` clock wiring changed; 8 tests before and after. The spinner case (`wait(600)` before `settings-core-mode-confirm-spinner`, now `:405`) keeps its exact causal chain: the reveal is a store-clock rule (`use-pending-press.ts:53`, `s.clock.now - pressedAt >= LIVE_PENDING_REVEAL_MS` = 420 ms, published in 100 ms steps), and the store-clock ticker runs on the same runner-controlled timers — it now fires *deterministically* rather than approximately.

## 4. Verification — 3/3 (2 + 1), no timeouts raised

Same command form as row 16 (mobile jest honours `--maxWorkers`; `research/05_b2_dependency_triage.md:265`):

`npm run test -w @dems/mobile -- src/features/settings/live-settings-boundary --maxWorkers=2`

| Run | Exit | Summary lines |
|---|---|---|
| baseline (unmodified) | 0 | `Tests: 8 passed, 8 total` / `Time: 7.924 s` |
| 1 | 0 | `Test Suites: 1 passed, 1 total` / `Tests: 8 passed, 8 total` / `Time: 5.165 s` |
| 2 | 0 | `Test Suites: 1 passed, 1 total` / `Tests: 8 passed, 8 total` / `Time: 5.492 s` |
| 3 | 0 | `Test Suites: 1 passed, 1 total` / `Tests: 8 passed, 8 total` / `Time: 5.684 s` |

Plus one earlier conversion smoke run (exit 0, `Time: 6.834 s`). Wall time dropped and per-test times collapsed (max test 752-788 ms vs 333-1176 ms) because the sleeps are gone; what remains is pure CPU work — that is the point of the row. No flakes: host load was 5.4-6.0 the whole time (S4, row 20, row 13 agents running concurrently; `uptime` quoted above), and no timeout was raised.

Additional gates: `npx tsc -p apps/mobile/tsconfig.json --noEmit` → exit 0. `npx eslint src/features/settings/live-settings-boundary.test.tsx` (cwd `apps/mobile`, the workspace's own `eslint.config.js`) → exit 0.

## 5. Zero real-time waits — the acceptance grep, quoted

```
$ grep -nE "setTimeout\( *[0-9]{3,}|sleep\(|await new Promise" apps/mobile/src/features/settings/live-settings-boundary.test.tsx || echo "0 real-time waits"
0 real-time waits
```

The wider completeness grep row 16 used (`grep -nE "setTimeout|setInterval|sleep\(|wait\(|Date\.now|performance\.now"`) returns only non-wait tokens: `:49 jest.setTimeout(40_000)` (a ceiling, not a sleep), `:107`/`:257` `Date.now`/`setTimeout` (script content times + the `clockFromTimers` bridge — call-time lookups of the runner's *fake* globals), and the file's own `wait(` helper name (now virtual). No `setInterval`, no `sleep(`, no `await new Promise`, no `performance.now` anywhere in the file.

## 6. Production diff empty

`git diff --stat -- apps packages scripts release` returns exactly two entries, both test files:

```
 .../src/test/live-paired-devices-issue.test.tsx    |  7 ++++---
 .../settings/live-settings-boundary.test.tsx       | 24 ++++++++++++++++++----
```

- `live-settings-boundary.test.tsx` — mine: the only file this session wrote under `apps/` (test-only; the six hunks above).
- `live-paired-devices-issue.test.tsx` — NOT mine: the core-web row-20 agent (`Board participant "Row 20 B10-d wall-clock test (@coder-execution subagent)" state=busy`) is mid-conversion of that file at its own `:373` literal wait; the hunk at `:368-373` is their edit, already modified when this row started (this session wrote only the boundary file and its two task-folder docs).

`git diff --name-only | grep -v "\.test\."` → only `docs/…` controller files (pre-existing, untouched by me). `package.json`/`package-lock.json` do not appear in any diff. Zero production (non-test) files changed.

## 7. Residual risks / notes for row 25 (and rows 18-22)

1. **`jest.setTimeout(40_000)` remains at `:49`.** Real time can no longer make this file slow (virtual advance is CPU-bound), so the 40 s ceiling is now doubly redundant against `jest.config.js:10` `testTimeout: 20000` — but it is a ceiling, not a wait, and per-test timeout ownership is row 19's RC-8 sweep. Left untouched deliberately.
2. **`doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate']` is load-bearing.** It is copied from the only workspace precedent that drives this same promise-heavy live machinery under fake timers (`probe-failure.test.ts:213`). `camera-feed`'s and `app-providers`' bare `jest.useFakeTimers()` work for their narrower trees; if a future edit to this file removes the list, `act` hand-overs and worklet `runOnJS` callbacks would wait on clock advances.
3. **One-shot global priming.** The Reanimated registry is prepared once per file on the real queue; the per-test fresh fake clocks never see that 0 ms timer. If a future change installs fake timers earlier (e.g. module scope), the S72-12 error returns — the two `nextTurn()` calls in `beforeAll` are the guard to keep.
4. **Toast timers are now virtual.** Row 16 residual #1 (`heroui-native/provider.js:318` unawaited auto-dismiss `setTimeout`) existed in this file on the real clock too; under the runner's clock it either advances inside a `wait()` or is discarded by the next `beforeEach` re-install — asserted on nothing by DC-6, same as row 16 concluded.
5. **`serverTime` values move to the runner's clock.** `scriptCore`'s `now()` (`:107`) and the transport clock (`:257`) read faked `Date.now`; mock-core compares its own `now()` against values *it* stamped (`live-paired-devices.ts` per row 16 §7.2), so consistency holds — proven by 3/8-test runs, not by assumption: `fake.assertNoViolations()` passes every `afterEach`.
6. **Duration ceiling vs CPU.** The `until()` 8000 ms virtual budget is now a step count (160 × 50 ms advances) plus microtask flushes: bounded CPU, immune to host starvation — which is exactly the D256 SC7 failure mode this row removes. A genuinely stuck predicate now fails fast with the `boundary test: timed out waiting for …` error rather than after 40 s of wall clock.
7. **Command form for the chain:** `npm run test -w @dems/mobile -- <path> --maxWorkers=2` works unchanged for rows 18-22 (verified 3/3 here); `--maxWorkers=2` accepted (mobile is jest, `research/05_b2_dependency_triage.md:265`).

---
*Row 17, blueprint `identification/02_structured.md:197`; baseline HEAD `2a4f4ea`; file blob `0505dd9` → `d4f232e`. Row 16's precedent: `implementation/01_b10a_live_gap_read_only_dialog.md`. Prepared 2026-10-07.*
