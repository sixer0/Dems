# B10-a: `session-live/live-gap-read-only-dialog` wall-clock independence (row 16, M0, class A, tier 3)

Date: 2026-10-07
Agent: coder-execution
Plan: identification/02_structured.md:196 row 16 — "make mobile test `session-live/live-gap-read-only-dialog` independent of wall-clock time (fake timers; behaviour unchanged)"; Verification column: "File passes 3/3 runs (2 + 1); real-time waits left in the file = 0 (grep quoted); production-code diff empty".
Target file: `apps/mobile/src/features/session-live/live-gap-read-only-dialog.test.tsx` (141 lines).

## Verdict

PASS on all three acceptance clauses. Headline finding: **the file already contains zero real-time waits** — there was nothing in it to convert. No edit to the file was needed, so none was made; the row's substance is the audit and the 3/3 proof below. Fabricating an edit would have violated the row's own "behaviour unchanged" mandate.

## 1. What was real-time before (with line numbers)

Audit of every await in the file at HEAD (`0a9e317`, confirmed by `git log --oneline -5 -- apps/mobile/src/features/session-live/live-gap-read-only-dialog.test.tsx`):

| Line | Call | Time source |
|---|---|---|
| `:54` | `await resetLiveMonitorBed()` | promise jobs only (AsyncStorage jest mock, `apps/mobile/jest.setup.ts:16-17`) |
| `:87` | `await b.flush()` | 40 microtask turns inside `act` (`live-monitor-bed.tsx:167-171`) |
| `:88` | `await b.elapse(200)` | fake transport clock (`live-monitor-bed.tsx:275-282`, `fake.clock.advance`) |
| `:100` | `await b.flush()` | microtasks |
| `:101` | `await b.elapse(500)` | fake transport clock |
| `:135` | `await b.elapse(40_000, 500)` | fake transport clock, 80 virtual 500 ms steps |

`grep -nE "setTimeout|setInterval|sleep\(|wait\(|Date\.now|performance\.now" apps/mobile/src/features/session-live/live-gap-read-only-dialog.test.tsx` printed nothing (exit 1) — the file has **no timer token of any kind**; the only time-control is `b.elapse`/`b.flush`.

Why the file is already fake-clock-driven (injection chain, each cited):

- The bed builds the app's real Live source with the fake transport's clock and timers: `apps/mobile/src/features/session-live/testing/live-monitor-bed.tsx:365` — `createMobileLive({ fetch: fake.fetch, socketFactory: fake.socketFactory, now, timers: fake.clock.timers, random: () => 0 })`.
- Those timers are virtual: `packages/shared/src/live/testing/clock.ts:81` — `setTimeout: (callback, delayMs) => schedule(delayMs, callback)`; consumed by the live source at `packages/shared/src/live/source/live-sim.ts:477` (`options.timers ?? LIVE_SOCKET_DEFAULT_TIMERS`) and `packages/shared/src/live/source/command-gate.ts:238`, so reconnect backoff, command timeouts and heartbeats all run on the fake clock.
- The recording-elapsed ticker is on the same injected timers: `apps/mobile/src/runtime/recording-elapsed.ts:100` (`clock.timers.clearTimeout`), `apps/mobile/src/runtime/stall-tolerant-timers.ts:50` ("(`Date.now` in the app, the fake transport's clock in a test)").
- `elapse` advances in steps with the promise jobs in between (`live-monitor-bed.tsx:275-282`), the convention every bed-based live test follows; none of the 8 files that import `live-monitor-bed` uses `jest.useFakeTimers` (verified by `grep -rln "live-monitor-bed" apps/mobile/src` + `grep -c 'useFakeTimers'` per file, all 0).

Real timers that still run during the test (unawaited, asserted on nothing):

- The one genuine real-clock timer scheduled on this path is HeroUI's toast auto-dismiss: `node_modules/heroui-native/lib/module/providers/toast/provider.js:318` (`const timeout = setTimeout(...)`), armed because the file's `useToast` mock delegates to the real manager after recording (`live-gap-read-only-dialog.test.tsx:40` `return real.toast.show(options);`). It is never awaited and no assertion depends on it by design — file header `:11-13` (D179 DC-6): "a test that claims 'one notice' counts the toast CALLS, not the toasts on screen". This is the file's deliberate wall-clock decoupling of assertions from toast lifetime.

Root cause of the D256 flake this backlog row targets (for the register/row 25): the file's historical failures under the root `npm test` were load-only CPU starvation against jest's 5 s default per-test timeout, not a wall-clock sleep — `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/16_t1_mobile_jest_timeout.md:23` ("Both passed alone ... Failure reason in the full run is therefore load-only, consistent with the 5 s default timeout"); mitigated since by `testTimeout: 20000` (`apps/mobile/jest.config.js:10`) and `maxWorkers: '50%'` (`:12`, T2). D256 grouped four files by their shared load-failure symptom; only three of them contain literal wall-clock waits — this file is the exception (`live-session-live-link.test.tsx:54`, `live-settings-boundary.test.tsx:159/:220`, `live-paired-devices-issue.test.tsx:373`).

## 2. What was changed (diff summary)

Nothing. `git diff --stat HEAD -- apps/mobile/src/features/session-live/live-gap-read-only-dialog.test.tsx` prints empty (`wc -l` = 0). No production file, no other test file, no config, no package/lockfile was touched: `git diff --stat -- apps/ packages/ scripts/ release/` prints empty; `git status --porcelain` lists only the pre-existing controller-owned docs entries (`decisions/decisions.md`, `delegation_progress_report.md`, `status_tasks.md`, untracked `delegation_progress/`, `initialization/`, `research/`) plus this row's two new docs artifacts.

Alternative considered and rejected: wrapping the file in `jest.useFakeTimers()` to control the HeroUI auto-dismiss timer. Rejected because (a) there is no awaited real timer to fake, so it could not change any assertion outcome; (b) jest 29 modern fake timers also intercept `Date`/`performance`/microtask-adjacent scheduling that the real `AppProviders`/router/Dialog tree uses during render — a behaviour-change risk to a file that passes deterministically; (c) it would deviate from the established bed convention (0 of 8 bed-based live tests use it).

## 3. The 3 runs (2 + 1, per D232/D233)

Command form (from the repository root): `npx jest --config apps/mobile/jest.config.js --rootDir apps/mobile --maxWorkers=2 src/features/session-live/live-gap-read-only-dialog` was tried first and **fails in this workspace for reasons unrelated to timing**: `Cannot find module '@/navigation/testing/router-harness'` — the `@/` path aliases resolve through the babel config relative to cwd, which this invocation leaves at the repository root. The sanctioned fallback applies ("if a `npm run test -w @dems/mobile -- <path>` form is the project's convention, use it"); it is the convention: root `package.json:34` runs workspace tests (`npm run test --workspaces --if-present`), and T1 ran the same file with cwd `apps/mobile` (`gateway_check/16_t1_mobile_jest_timeout.md:15`). `--maxWorkers=2` is honoured here because mobile is jest (note A-R5-7, `research/05_b2_dependency_triage.md` point 7; `apps/mobile/jest.config.js` has no CLI-conflict flag).

Host during runs: `uptime` = "load averages: 4.16 5.01 5.30" with spikes S1/S2 running in parallel (board state at delegation start). No run flaked; no re-run was needed.

Each of the 3 official runs: `npm run test -w @dems/mobile -- src/features/session-live/live-gap-read-only-dialog --maxWorkers=2`, exit code captured per run:

```
exit r1=0 r2=0 r3=0
== r1  PASS src/features/session-live/live-gap-read-only-dialog.test.tsx
       Test Suites: 1 passed, 1 total
       Tests:       1 passed, 1 total
       Time:        2.291 s   (test itself: 724 ms)
== r2  PASS src/features/session-live/live-gap-read-only-dialog.test.tsx
       Test Suites: 1 passed, 1 total
       Tests:       1 passed, 1 total
       Time:        2.313 s   (test itself: 722 ms)
== r3  PASS src/features/session-live/live-gap-read-only-dialog.test.tsx
       Test Suites: 1 passed, 1 total
       Tests:       1 passed, 1 total
       Time:        2.449 s   (test itself: 755 ms)
```

Three earlier diagnostic runs (baseline + the act-warning capture) also showed `Tests: 1 passed, 1 total`; the spread of the measured test time across all runs (670-755 ms) is under 90 ms, consistent with the bounded-CPU profile, not with a sleep-dependent path. No timeout was raised anywhere; `testTimeout: 20000` remains the config default (jest.config.js:10, untouched).

## 4. The 0-waits grep quote

```
$ grep -nE "setTimeout\( *[0-9]{3,}|sleep\(|await new Promise" apps/mobile/src/features/session-live/live-gap-read-only-dialog.test.tsx || echo "0 real-time waits"
0 real-time waits
```

Wider pattern, same result:

```
$ grep -nE "setTimeout|setInterval|sleep\(|wait\(|Date\.now|performance\.now" apps/mobile/src/features/session-live/live-gap-read-only-dialog.test.tsx || echo "0 timer/real-clock tokens"
0 timer/real-clock tokens
```

What remains in the file is exactly the controlled-timer mechanism, quoted with locations: `:87` `await b.flush();`, `:88` `await b.elapse(200);`, `:100` `await b.flush();`, `:101` `await b.elapse(500);`, `:135` `await b.elapse(40_000, 500);` — every one advances the fake transport clock (`live-monitor-bed.tsx:275-282`) or flushes promise jobs (`:167-171`).

## 5. Production-diff-empty proof

```
$ git diff --stat -- apps/ packages/ scripts/ release/
(empty)
$ git status --porcelain | grep -vE "^ M docs/2026-10-07_dems_real_capture_sealing/|^ \?\? docs/2026-10-07_dems_real_capture_sealing/"
(only the five docs entries of section 2; no source, config, or test path)
```

## 6. Residual risks for row 25 (senior code review)

1. **Unawaited real timer on the path**: HeroUI's toast auto-dismiss (`heroui-native/lib/module/providers/toast/provider.js:318`) fires in real milliseconds while the test runs (visible as `flushActQueue` stack output in the raw logs). Claim to check: it cannot flip any assertion, because DC-6 counts `toast.show` calls (`live-gap-read-only-dialog.test.tsx:113-114`, `:130`) and nothing asserts on-screen toast presence or dismissal. If a future edit asserts on-screen toasts in this file, the wall-clock coupling returns.
2. **Bounded-CPU cost vs the 20 s ceiling**: `:135` `elapse(40_000, 500)` runs 80 act+flush cycles; under pathological host load this throughput (never a sleep) competes against `testTimeout: 20000`. Measured 2.3-2.4 s wall for the suite at load 4-5 with two spikes running. A step increase (e.g. `elapse(40_000, 2_000)`, still 40 s of virtual time) would cut the worst case ~4x, but it changes the advance/flush interleaving inside the bed — deliberately not done here under "behaviour unchanged"; row 25 may rule it acceptable if load flakes persist in row 27.
3. **Classification note for the register**: D256's grouping of this file with the three literal-sleeper files was symptom-based, not cause-based; this row's audit shows the file was already fake-clock-driven. Rows 17/18/20 still carry real waits (quoted above) and remain genuinely in scope for their conversions. Row 27 should not expect a mobile jest diff from B10-a.
4. **Workspace command form**: root `npx jest --config ... --rootDir apps/mobile` breaks the `@/` babel aliases (module-not-found on `@/navigation/testing/router-harness`); the working root-level form is `npm run test -w @dems/mobile -- <pattern> --maxWorkers=2`. Relevant to rows 17-22 and the row-27 command list.

## Artifacts

- This report: `docs/2026-10-07_dems_real_capture_sealing/implementation/01_b10a_live_gap_read_only_dialog.md`
- Progress note: `docs/2026-10-07_dems_real_capture_sealing/delegation_progress/coder-execution__row16.md`
- Edited test file: none (`apps/mobile/src/features/session-live/live-gap-read-only-dialog.test.tsx` unchanged at HEAD `0a9e317`).
