# RC-1: Sessions hub duration never steps back after a late stop (row 22, B12/A4, M0, class A, tier 3)

> **Superseded in part (2026-10-08, audit D19/D21):** see `implementation/09_rv_code_audit_fixes.md` — the `:132` failure site of `live-paired-devices-issue` is now deterministic, and the row-22 after-stop hold was replaced by ruling D19(b) (the Core's recorded duration wins once the stop is known).


Date: 2026-10-07
Agent: coder-execution
Plan: `identification/02_structured.md:202` row 22 — "B12/A4 RC-1: Sessions hub duration never steps back after a late stop (`apps/mobile/src/runtime/recording-elapsed.ts:129`, keep the larger value), proven by a fake-clock regression test"; Verification column (hard gate): "New test fails on pre-fix code, passes after (both outputs quoted); `use-monitor.ts:92-160` diff empty; test file passes 3/3".
Source record: task `2026-10-04_dems_backend_rbac_pairing` — finding RC-1 (`verification/13_post_review_recheck.md:109`), ruling D255 (`decisions/decisions.md:261`), backlog A4/B12 (`report/01_report_inputs.md:192`; `identification/02_structured.md:272,279`).
Scope: the code fix only. A4's device-check half is explicitly pre-handover and was NOT run (no emulators, no devices, per the row's constraint).
Follow-up (W9, 2026-10-07): the four Minor findings F1-F4 and the two Nits F5-F6 of the row-26 senior review (`gateway_check/03_rc1_review.md`) are applied — dispositions in §8. The production change of §2 is byte-identical to the original row-22 delivery (`recording-elapsed.ts` blob pair still `9ba1468..4da7cd7`; `git diff --stat`: `1 file changed, 46 insertions(+), 7 deletions(-)`); this follow-up adds one test case to §3 (file now 4 tests) and two ticker units in `elapsed-ticker.test.ts` (file now 6 tests), and re-verifies every acceptance property in §5/§6.

## Verdict

PASS on all three acceptance clauses. The mechanism was root-caused in `recording-elapsed.ts` (as the blueprint states, `:129`), the minimal fix — keep the larger value, frozen — landed in that ONE file (+46/−7), the new fake-clock regression test was proven RED pre-fix (twice: pre-edit run and `git stash` run on the final files, both `Expected: >= 1129 / Received: 1122`) and GREEN post-fix, the file passes 3/3 exit 0, and `git diff -- apps/mobile/src/features/session-live/use-monitor.ts` prints 0 lines. W9 follow-up (row-26 findings F1-F6): all three acceptance properties re-verified on the current tree — the recorded RED/GREEN pair stands (§4), the stop-hold file now passes 4/4 across 3 runs exit 0 and the ticker unit file passes 6/6 across 3 runs exit 0 (§5), the `use-monitor.ts` diff is still empty and `recording-elapsed.ts` is byte-unchanged since row 22 (§6); dispositions in §8.

## 1. Mechanism (file:line, failure sequence)

The Sessions hub row draws `use-sessions-data.ts:139-142` (pre-fix, unchanged by this row):

```ts
export function useLiveElapsedSeconds(): number {
  const fromStore = useSim((s) => elapsedSeconds(s.session?.startedAt ?? null, s.session?.stoppedAt ?? null, s.clock.now));
  return Math.max(fromStore, useRecordingTickerSeconds());
}
```

`useRecordingTickerSeconds` at pre-fix `recording-elapsed.ts:128-137`:

```ts
export function useRecordingTickerSeconds(): number {
  const startedAt = useSim((s) => (s.session?.state === 'RECORDING' ? (s.session.startedAt ?? null) : null));   // :129
  ...
  const ticker = useMemo(
    () => (coreClock === null || startedAt === null ? null : sharedTicker(coreClock, startedAt, sessionId)),     // :132-133
    [coreClock, startedAt, sessionId],
  );
  return useSyncExternalStore(ticker?.subscribe ?? subscribeNothing, ticker?.getSnapshot ?? zeroSeconds);        // :136
}
```

Inside the ticker the value is already forward-only — `recording-elapsed.ts:75` `const next = Math.max(seconds, elapsedSecondsAt(startedAt, now));` (pinned by `elapsed-ticker.test.ts:75-87` "never steps back when the clock reads earlier"). The step back lives at the HOOK boundary, `:129` + `:136`: the whole ticker half is gated on `'RECORDING'` and collapses to `zeroSeconds` the moment the state leaves it.

Failure sequence (RC-1's hypothesis, `13_post_review_recheck.md:109`, reproduced numerically by the new test):

1. LIVE, under load: the store's clock lags (it is published by the stall-tolerant timer, `core-clock.ts:6-13`), while the Core-clock ticker counts real seconds. The hub draws the larger — the ticker — e.g. 1129 s (store 1122 s).
2. The recording really stops at ~1122 s; the client learns the stop δ seconds late (RF2-2 measured 7.7/12.4 s; `D243/D249`).
3. The late stop arrives: the state leaves RECORDING and the store stamps `stoppedAt` at its own (still-lagging) instant (`packages/shared/src/sim/session-machine.ts:705` `stoppedAt: now`; the state machine has no transition back to RECORDING — entry `:657` `state: SessionState.RECORDING`, `:704-705` STOPPING, `:767` FINALIZING, `:879` SEALED). `fromStore` becomes the frozen 1122.
4. Same render: `:129` yields `startedAt = null` → `:132` picks no ticker → `:136` draws 0. Hub: `Math.max(1122, 0) = 1122` — the row steps back by δ (the record's example "00:00:19 to 00:00:11"). Only the hub shows it because Home's RecRow and the mini-bar unmount at the stop and the monitor is replaced in place; the hub row stays mounted.
5. The module header's claim "the time never steps back" (`recording-elapsed.ts:12-13` pre-fix) held only while RECORDING — contradicting DEC-FXR-M-2 (forward only).

D255's ruling (quoted): "fix (keep the larger of drawn and stored value per session) and its device check routed to the next phase / pre-handover session". The consumers stay untouched: fixing the ticker half keeps every reader forward-only at once (`useRecordingElapsedSeconds` at pre-fix `:140-144` already takes `Math.max`), which is why the fix lands in `recording-elapsed.ts` and not in `use-monitor.ts:92-160` (the protected forward-only region; `use-monitor.ts:92-94` merely delegates to the runtime module).

## 2. The fix (diff summary)

One file: `apps/mobile/src/runtime/recording-elapsed.ts`, six hunks, +46/−7 (`git diff --stat`: `1 file changed, 46 insertions(+), 7 deletions(-)`). Blob `9ba1468..4da7cd7`.

| Hunk | Change |
|---|---|
| `@@ -10,7 +10,9 @@` | Header comment: the "never steps back" claim now covers the stop (RC-1/D255 hold). |
| `@@ -51,6 +53,13 @@` | `ElapsedTicker` gains `freeze(): void` (post-fix `:53-62`): freeze at the largest second drawn — no further clock read, no re-arm; idempotent. |
| `@@ -64,10 +73,12 @@` | `createElapsedTicker` gains `let stopped = false` (`:76`) and an early return in `tick` when stopped. |
| `@@ -81,7 +92,7 @@` | The `finally` re-arm is guarded `!stopped` (a frozen ticker never re-arms — interacts correctly with W93-12's re-arm path). |
| `@@ -93,7 +104,7 @@` | `subscribe` arms only `if (!stopped && handle === null)`; plus the new `freeze()` implementation (`:117-123`): sets `stopped`, clears the pending timer, drops the handle. |
| `@@ -103,34 +114,62 @@` | The session cache entry gains `sessionId` (`tickers: WeakMap<CoreClock, { key, sessionId, ticker }>`); new `heldAfterStop(clock, sessionId)` (`:143-155`); `useRecordingTickerSeconds` (`:167-176`) routes the not-RECORDING branch through it instead of to `null`/0. |

`heldAfterStop` semantics (post-fix `:149-155`): when the current session (`sessionId`) is exactly the one the shared ticker of this Core clock last ticked, return that ticker frozen — callers keep drawing its last second, so `Math.max(fromStore, ticked)` can never fall below the last drawn value ("keep the larger value"). When the session has no ticker on this clock (never recorded LIVE on it, SIMULATED/HEARTBEAT where `coreClockOf` is `null` per `core-clock.ts:26-27,104-106`, or a newer session replaced the cache entry), it returns `null` and the behavior is exactly as before (0). The frozen ticker never advances past the stop: its timer is cleared on `freeze()` and neither `subscribe` nor the `finally` path re-arms a stopped ticker. The frozen ticker is the SAME object the hook used while RECORDING, so `useSyncExternalStore` sees a stable `subscribe`/`getSnapshot` across the stop render — no resubscribe, no flicker, no decrease.

Not changed: `use-monitor.ts` (any line; gate proof in §5), `use-sessions-data.ts`, `sessions-model.ts`, `use-home-data.ts`, `live-mini-bar.tsx`, `core-clock.ts`, any config, any dependency.

## 3. The regression test (fake clock)

New file: `apps/mobile/src/features/session-live/live-rc1-elapsed-stop-hold.test.tsx` (untracked addition; placed next to the module's existing tests — `elapsed-ticker.test.ts` and `live-monitor-timer-core-clock.test.tsx` live in this folder).

Model (per-file fake clock, no `jest.useFakeTimers` — the module is clock-driven and the local convention for its Core-clock tests is the virtual `manualCoreClock`, copied from `live-mini-bar-core-clock.test.tsx:58-88`): `createTestSim({ scenario: 'recording' })` + `sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD)` (the scenario store hydrates SIGNED_OUT; the sign-in is this workspace's own pattern, `home-live.test.tsx:240`); the store's manual clock is NEVER advanced (models the "store clock holds under load", `core-clock.ts:6-13`); the registered Core clock (`registerCoreClock`, as `createMobileLive` registers the real one) is advanced by `act(core.advance(...))`, which runs the ticker's plain timers virtually; the stop is the real transition `sim.actions.stopRecording(...)` applied at the store's lagging instant (`packages/shared/src/sim/session-machine.ts:688-705`).

Four tests (test 4 added by the W9 follow-up for review finding F2):

1. **RC-1 core (fails pre-fix)**: hub probe (`useLiveElapsedSeconds`, the Sessions hub's own draw at `use-sessions-data.ts:140-141`) shows 1122, then 1129 after 7 s of Core time while the store holds; the late stop is learned; `expect(drawn()).toBeGreaterThanOrEqual(ticked)` — 1129, never back to 1122.
2. **Freeze at the stop (fails pre-fix)**: after the stop the drawn value `>= 1129`, stays EXACTLY equal through `core.advance(6_000)` and `core.advance(2_000)`, and `core.pending()` timers = 0 — the held value must not grow past the stop either, and nothing stays armed.
3. **SIMULATED guard (passes before and after)**: no Core clock — hub draws the store value only; +3 s advance grows it by exactly 3; the stop freezes it at `stoppedAt`; further advance does not move it. Proves the hold does not leak into SIMULATED/HEARTBEAT (`coreClockOf = null`).
4. **Session boundary (follow-up, F2 — regression guard for the guard at `recording-elapsed.ts:150,152`, previously untested)**: the late stop of test 1 runs first and the hub is holding 1129; A is then sealed through the real finalization (`test.advance(12_000)` drives `stopRecordingTransition`'s STOPPING 1.5 s + the six FINALIZING steps on the store clock — the store clock is deliberately advanced here, the load-hold premise only governs tests 1-2; the hub keeps drawing the held value while `s.session` stays the sealed session, asserted), and a NEW session B runs the full real lifecycle (`createSession` with the input shape of `features/audit/testing/audit-harness.tsx:58-66` → `beginPrecheck` → the timed precheck on the store clock → `acknowledgePrecheckWarnings` when still PRECHECK → `startRecording`). Assertions: while B is active but not yet RECORDING, `heldAfterStop` sees `cached.sessionId !== sessionId` and returns `null` — the hub draws 0, NOT A's held 1129 (`expect(drawn()).toBe(0)` at create and after the precheck: this is precisely the line the review found untested; without the guard A's frozen ticker would be handed to B and draw `held` here). When B enters RECORDING its `sharedTicker` key is `sessionId|startedAt` of B, so `:132-137` creates a fresh ticker that computes from B's OWN instant — 0 while the Core clock still reads before B's start — then `core.setLocal(startedAtB - startedAt + 100)` and `core.advance(3_000)` (the file's 100 ms boundary convention, multiples of 250 ms, so the last tick lands past the boundary exactly like tests 1-2) and the hub draws 3: B grows from its own Core instants, never inherits A's second. (`live-rc1-elapsed-stop-hold.test.tsx:164-229`; tests 1-3 stay byte-unchanged at `:95-159`.)

Fake-clock grep proof (original row run): `rg -n "new Promise|Date\.now|performance\.now|jest\.setTimeout|sleep|wait\(" live-rc1-elapsed-stop-hold.test.tsx` printed NOTHING (exit 1). The only `setTimeout` token in the file is `:39` — the `setTimeout:` member definition of the test's virtual `CoreClock.timers` adapter (scheduled callbacks run only when the test advances), the same construct as `live-mini-bar-core-clock.test.tsx:62-75`. No wall-clock waits; no timeouts raised.

Follow-up grep proof (W9, after test 4 and the two ticker units landed), covering BOTH test files with the review-cycle pattern — `rg -n 'setTimeout\( ?[0-9]{3,}|sleep\(|await new Promise|Date\.now|performance\.now' src/features/session-live/live-rc1-elapsed-stop-hold.test.tsx src/features/session-live/elapsed-ticker.test.ts` (cwd `apps/mobile`) printed NOTHING (exit 1); a bare `rg -n 'setTimeout'` on the same two files returned only the two virtual-adapter member definitions (`live-rc1-elapsed-stop-hold.test.tsx:39` and `elapsed-ticker.test.ts:20`, both `setTimeout: (run, ms) => {`), i.e. only the intentional fake-clock machinery. Test 4 stays on the file's existing machinery (`act(core.advance(...))`, `act(test.advance(...))`, `flushAsync` = `act` around `Promise.resolve`), with zero new timer tokens.

Ticker-unit additions (review finding F3, W9 follow-up): `elapsed-ticker.test.ts` now has 6 tests — the two new ones unit-test `freeze()` directly on `createElapsedTicker` (no component): (a) freeze at the last drawn second drops the armed timer AT the freeze (`pending()` = 0), further clock time does not move the snapshot, and no subscriber is notified again; (b) `freeze()` is idempotent, and a `subscribe` after a freeze returns the frozen value, never re-arms (`pending()` = 0, no listener calls on further advance). `freeze()` was already on the public `ElapsedTicker` contract (`recording-elapsed.ts:53-63`), exported through `./use-monitor` like the rest of the module — no public API was widened for the test; the module's existing fake-clock conventions (`fakeClock`, `f.advance`, boundary-aligned starts) are reused verbatim.

## 4. Hard gate: pre-fix FAILURE and post-fix PASS (outputs quoted)

**Pre-fix proof 1 (before the fix was applied):** 2 failed, 1 passed, exit 1.
**Pre-fix proof 2 (the stash gate, fix stashed after final files, test kept):** command `npm run test -w @dems/mobile -- src/features/session-live/live-rc1-elapsed-stop-hold --maxWorkers=2`, `npm-exit=1`:

```
FAIL src/features/session-live/live-rc1-elapsed-stop-hold.test.tsx
    ✕ stop learned 7 s late while the ticker was 7 s ahead of the held store clock: the drawn duration keeps the larger value (45 ms)
    ✕ the held value freezes at the stop: further Core-clock time does NOT push the duration past the stop (25 ms)
    ✓ SIMULATED (no Core clock): the hub draws the store value only, and it freezes at `stoppedAt` — the hold does not apply (16 ms)
Tests:       2 failed, 1 passed, 3 total
```

Failure body (both RC-1 tests, verbatim from the log):

```
expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 1129
Received:    1122

  114 |     expect(drawn()).toBeGreaterThanOrEqual(ticked);
```

— exactly the RC-1 mechanism: the ticker half drops to 0 at the stop render and the hub falls back to the store value frozen 7 s below what it was drawing (the record's 00:00:19-to-00:00:11 class).

**Post-fix PASS (fix re-applied; `git stash pop`, file byte-identical to the saved fixed copy — `cmp` printed `identical`):** `npm-exit=0`:

```
PASS src/features/session-live/live-rc1-elapsed-stop-hold.test.tsx
    ✓ stop learned 7 s late while the ticker was 7 s ahead of the held store clock: the drawn duration keeps the larger value (41 ms)
    ✓ the held value freezes at the stop: further Core-clock time does NOT push the duration past the stop (12 ms)
    ✓ SIMULATED (no Core clock): the hub draws the store value only, and it freezes at `stoppedAt` — the hold does not apply (16 ms)
Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

Honesty note (per row-16 precedent): the first run of the new test failed for two HARNESS reasons, not RC-1: (a) `resetMotionStateForTests`/`resetLoopRegistryForTests` are exported by `@/motion`, not `@/runtime` (fixed); (b) the scenario store is SIGNED_OUT after the memory-persist hydration merge, so `sim.actions.stopRecording` threw `SimPermissionError ... NOT_SIGNED_IN` (fixed by signing the operator in with `sim.actions.signIn` as `home-live.test.tsx:240` does; the failing line was printed by a scratch debug run, since deleted). The genuine RC-1 RED was produced only after those fixes, twice as above.

Follow-up validity note (W9): the pre-fix RED/GREEN outputs above stand unchanged and were NOT re-produced (the controller mandate: do not re-break the tree to re-prove recorded RED). They remain exactly valid for the two original RC-1 tests: the follow-up added test 4 only AFTER the SIMULATED test (file position > `:159`), so every line quoted by the RED evidence still matches — `sed -n '114p' apps/mobile/src/features/session-live/live-rc1-elapsed-stop-hold.test.tsx` prints today exactly the quoted excerpt line `expect(drawn()).toBeGreaterThanOrEqual(ticked);`. The two follow-up tests are regression guards, not RED reproductions: test 4 guards the session-boundary behavior the code already implements (its `toBe(0)` assertions fail if the guard at `recording-elapsed.ts:150,152` regresses — without it `heldAfterStop` would hand A's frozen ticker to B and draw `held`); the `freeze()` units could not run pre-fix at all (`freeze()` did not exist pre-fix), which is why row 26 asked for them, not for new RED.

## 5. Runs on the final tree (D8 depth 2 + 1, D12 command, single writer)

Row-22 original trio (3 tests) — `npm run test -w @dems/mobile -- src/features/session-live/live-rc1-elapsed-stop-hold --maxWorkers=2` from the repo root, one file, sequential (the mobile jest runner had no concurrent writer in this session):

```
r1 exit=0   Test Suites: 1 passed, 1 total   Tests: 3 passed, 3 total   Time: 1.453 s
r2 exit=0   Test Suites: 1 passed, 1 total   Tests: 3 passed, 3 total   Time: 1.125 s
r3 exit=0   Test Suites: 1 passed, 1 total   Tests: 3 passed, 3 total   Time: 1.167 s
```

Host: `uptime` = "17:37 up 6 days, 50 mins, 2 users, load averages: 6.11 6.07 6.21" (spike-gate row 38 may run concurrently per the wave note). Zero flakes; no re-run was needed; no timeout raised; config untouched. An earlier trio with the pre-lint-fix test file was also 3/3 exit 0 (`Tests: 3 passed, 3 total` at 2.035/1.318/1.156 s); the official trio above is the final file.

**W9 follow-up trio (current tree, 4 tests)** — same command, one file, sequential; npm-exit captured on the npm process itself:

```
r1 npm-exit=0   Test Suites: 1 passed, 1 total   Tests: 4 passed, 4 total   Time: 1.496 s
r2 npm-exit=0   Test Suites: 1 passed, 1 total   Tests: 4 passed, 4 total   Time: 1.051 s, estimated 2 s
r3 npm-exit=0   Test Suites: 1 passed, 1 total   Tests: 4 passed, 4 total   Time: 1.031 s, estimated 2 s
```

Run-3 detail (all four names, verbatim from the log):

```
✓ stop learned 7 s late while the ticker was 7 s ahead of the held store clock: the drawn duration keeps the larger value (44 ms)
✓ the held value freezes at the stop: further Core-clock time does NOT push the duration past the stop (11 ms)
✓ SIMULATED (no Core clock): the hub draws the store value only, and it freezes at `stoppedAt` — the hold does not apply (13 ms)
✓ session boundary: a NEW session after a stop does not inherit the held second, it counts from its own start (19 ms)
```

**W9 follow-up trio for `elapsed-ticker.test.ts` (6 tests)** — `npm run test -w @dems/mobile -- src/features/session-live/elapsed-ticker --maxWorkers=2`:

```
r1 npm-exit=0   Test Suites: 1 passed, 1 total   Tests: 6 passed, 6 total   Time: 0.92 s, estimated 2 s
r2 npm-exit=0   Test Suites: 1 passed, 1 total   Tests: 6 passed, 6 total   Time: 0.872 s, estimated 1 s
r3 npm-exit=0   Test Suites: 1 passed, 1 total   Tests: 6 passed, 6 total   Time: 0.887 s, estimated 1 s
```

Zero flakes in either file; no timeout raised; config untouched. Host at follow-up time: `uptime` = "21:43 up 6 days, 4:56, 2 users, load averages: 2.71 4.16 5.62".

Neighbor suites on the fixed tree (the module's existing tests + every consumer path): `npm run test -w @dems/mobile -- "elapsed-ticker|live-mini-bar-core-clock|live-monitor-timer-core-clock|features/sessions/live-sessions" --maxWorkers=2` → exit 0:

```
PASS src/features/session-live/live-monitor-timer-core-clock.test.tsx
PASS src/components/composed/nav/live-mini-bar-core-clock.test.tsx
PASS src/features/session-live/elapsed-ticker.test.ts
PASS src/features/sessions/live-sessions.test.tsx (6.64 s)
Test Suites: 4 passed, 4 total    Tests: 19 passed, 19 total
```

(`live-monitor-timer-core-clock.test.tsx` is the full LIVE-bed case: the real Live source with virtual clocks through the stop-adjacent machinery, proving the frozen ticker does not disturb the RF-PH-1 behavior; `live-sessions.test.tsx` drives the real hub screen.)

W9 follow-up neighbour spot-check (one run, per the follow-up brief — of row 22's four neighbour suites the LIVE-bed one is the single strongest side-effect guard): `npm run test -w @dems/mobile -- src/features/session-live/live-monitor-timer-core-clock --maxWorkers=2` → `npm-exit=0`, `Test Suites: 1 passed, 1 total`, `Tests: 2 passed, 2 total`, `Time: 3.547 s` (`✓ every heartbeat handled 8 s late for 6 s: the timer keeps within a second of the Core (it held still before) (463 ms)`, `✓ never backwards: late heartbeats, then timely ones again, the drawn value only grows (242 ms)`). The `elapsed-ticker` suite itself also ran 3/3 GREEN post-edit above (6 tests), covering a second neighbour file.

Gates: row 22 — `npm run typecheck -w @dems/mobile` exit 0 (before and after the test-file lint fix); `npx eslint src/runtime/recording-elapsed.ts src/features/session-live/live-rc1-elapsed-stop-hold.test.tsx` (cwd `apps/mobile`) exit 0, 0 errors, 0 warnings (one initial unused-`jest`-import warning in the test file was removed and re-verified). W9 follow-up — `npm run typecheck -w @dems/mobile` exit 0; `npx eslint src/features/session-live/live-rc1-elapsed-stop-hold.test.tsx src/features/session-live/elapsed-ticker.test.ts` (cwd `apps/mobile`) exit 0, 0 errors, 0 warnings.

## 6. Protected file and changed-files proofs

```
$ git diff -- apps/mobile/src/features/session-live/use-monitor.ts | wc -l
0
```

The protected forward-only region `use-monitor.ts:92-160` has an EMPTY diff (the whole file is untouched). Re-proved in the W9 follow-up: the same command printed `0` again.

W9 follow-up (after test 4 and the two ticker units landed):

```
$ git diff -- apps/mobile/src/features/session-live/use-monitor.ts | wc -l
0

$ git diff --name-only -- apps/ packages/ scripts/ release/
apps/core-web/src/test/live-paired-devices-issue.test.tsx
apps/mobile/src/features/devices/devices-screen.test.tsx
apps/mobile/src/features/evidence/evidence-detail.test.tsx
apps/mobile/src/features/evidence/evidence-more-menu-title.test.tsx
apps/mobile/src/features/evidence/play-sheet.test.tsx
apps/mobile/src/features/more/more-live.test.tsx
apps/mobile/src/features/session-live/elapsed-ticker.test.ts
apps/mobile/src/features/session-live/live-session-live-link.test.tsx
apps/mobile/src/features/session-new/live-session-new-followups.test.tsx
apps/mobile/src/features/settings/live-settings-boundary.test.tsx
apps/mobile/src/features/storage/storage-screen.test.tsx
apps/mobile/src/navigation/__tests__/chrome-lost-updates.test.tsx
apps/mobile/src/runtime/recording-elapsed.ts

$ git ls-files --others --exclude-standard -- apps/
apps/mobile/src/features/session-live/live-rc1-elapsed-stop-hold.test.tsx

$ git diff -- apps/mobile/src/runtime/recording-elapsed.ts | rg "^index"
index 9ba1468..4da7cd7 100644

$ git diff --stat -- apps/mobile/src/runtime/recording-elapsed.ts
 1 file changed, 46 insertions(+), 7 deletions(-)
```

Attribution: the 11 modified `.test.tsx` entries are all gated sibling files — row 20's `live-paired-devices-issue` (core-web), row 17's `live-settings-boundary`, row 18's `live-session-live-link`, row 21's `chrome-lost-updates`, and row 19's seven RC-8 files (`devices-screen`, `evidence-detail`, `evidence-more-menu-title`, `play-sheet`, `more-live`, `live-session-new-followups`, `storage-screen`) — left exactly as those rows gated them; this follow-up touched NONE of them. `apps/mobile/src/features/session-live/elapsed-ticker.test.ts` is NEW in the modified list: it is the W9 follow-up's F3 test edit only (2 added `it` cases, no change to the existing 4). `recording-elapsed.ts` shows the SAME blob pair and the SAME +46/−7 as the row-22 delivery (`9ba1468..4da7cd7`) — the follow-up made NO production change, exactly as the brief expects. This row's total footprint across both deliveries: one production file (row 22, unchanged since), two test files, and the report. Docs paths (`decisions.md`, `status_tasks.md`, `delegation_progress_report.md`, and the untracked docs folders) are controller-owned entries that pre-date this row; this row writes only its contract files (§9). `masterplan/02_plan.md` does not exist in this task folder (the tracker is `status_tasks.md`, owned by the controller) — nothing to update in place, recorded here instead.

## 7. Residuals for row 26 (senior review of this diff)

1. **SEALED replacement vs hold** (reworded in W9 per review finding F4; row 26 adjudicated this residual **Needs-follow-up**): at SEALED the hook half keeps working — `s.session` stays the sealed session (`packages/shared/src/sim/session-machine.ts:879`), so `heldAfterStop` still matches by id and the ticker half keeps drawing the held second (pinned by follow-up test 4: `expect(drawn()).toBe(held)` after the seal). What changes at the SEALED boundary is the DATA SOURCE of the hub row: the active-row path returns null for a SEALED session (`sessions-model.ts:111-114`, `:117-119`) and the sealed session surfaces as a HISTORY row whose duration comes from the Core's `endedAt - startedAt` (`session-machine.ts:802`; the history entry is prepended at `:886`), which can be BELOW the held 1129 by the stop-learning delay δ (the ticker overshoot; the review's example: held 1129 → Core 1122). The row's mandate ("keep the larger value" at `recording-elapsed.ts:129`) is met; the step-back lives at the row-swap, not in the hook. Honest wording of the ruling: D255 (`docs/2026-10-04_dems_backend_rbac_pairing/decisions/decisions.md:261`) accepted RC-1 "as a known display correction for this demo" and ruled the fix "keep the larger of drawn and stored value per session" — it did NOT explicitly rule on the SEALED→history row swap. This residual is therefore **consistent with D255's demo display tolerance; not explicitly ruled**. It is display-only and outside row 22's single-file scope. Recorded follow-up (per the review's remediation): "hub row: no step-back across the SEALED→history swap" — that would be a `use-sessions-data.ts` change, not a `recording-elapsed.ts` one.
2. **Interface widening**: `ElapsedTicker` gains a REQUIRED `freeze()`. Re-exported unchanged via `use-monitor.ts:97`; the only producer is `createElapsedTicker`, so no other implementer exists (grep of `ElapsedTicker` across `apps/`). Consider whether a unit-level test of `freeze()` directly on `createElapsedTicker` (the `elapsed-ticker.test.ts` fake-clock style) should be added by the reviewer — this row covered freeze behavior THROUGH the hook, not as a ticker unit. CLOSED by the W9 follow-up per review finding F3: two direct `freeze()` unit cases were added to `elapsed-ticker.test.ts` (§3), the reviewer (row 26) adjudicated the widening itself as Accept (R2), and row 26 confirmed `elapsed-ticker.test.ts` constructs no mock implementer.
3. **Accepted overshoot**: the held value can exceed the true Core duration by the stop-learning delay δ (7.7-12.4 s measured, D243/D249). By ruling ("keep the larger value"); the audit/history keeps the Core's truth. Reviewer should confirm the display-truth trade-off matches D255's intent.
4. **Wider effect than the hub**: every reader of `useRecordingTickerSeconds`/`useRecordingElapsedSeconds` (monitor, mini-bar, Home) now holds instead of dropping to 0 across the stop. RC-1's record noted those displays unmount/replace at the stop, so it should be invisible; their suites (5-§) all pass. DEC-FXR-M-2 (forward only) argues this is the correct generalization of the module's one rule.
5. **A4 device half** (RC-1 device check) stays pre-handover, not run here (no emulators; row constraint).
6. The test relies on the workspace's manual-clock `createTestSim` + `registerCoreClock` convention; if a future row converts these files to `jest.useFakeTimers` (row 17 pattern), this file's virtual timers need re-verification.

## 8. Review findings applied (W9 follow-up; source row 26, `gateway_check/03_rc1_review.md`)

| ID | Severity | Disposition | What changed |
|---|---|---|---|
| F1 | Minor | APPLIED (report text) | The mechanism citation is corrected and now carries the full real path everywhere this report names it: `packages/shared/src/sim/session-machine.ts:705` (`stoppedAt: now`) in §1 step 3 and §3 (`:688-705`), with the transition lines the review listed also cited (`:657` RECORDING entry, `:767` FINALIZING, `:879` SEALED). All five lines were re-verified by reading the file before and after editing (`sed -n '700,710p'`, `sed -n '655,658p;765,768p;877,880p'` and `sed -n '800,804p;884,888p'` on `packages/shared/src/sim/session-machine.ts`, plus `rg -n "state: SessionState.RECORDING"` — a single assignment site, `:657`, so there is no re-entry into RECORDING). Honest note on the finding's target: the report's §1/§3 already cited only the bare module name `session-machine.ts:705` — the non-existent path `apps/core-server/src/engine/session-machine.ts:705` was in the controller's task brief (not a file this row may edit); the unqualified module name is now qualified with the full real path so no reading can attach it to a wrong file. |
| F2 | Minor | APPLIED (test) | 4th case added to `live-rc1-elapsed-stop-hold.test.tsx` at `:164-229` (no new file; the review's cited three-test region `:95-159` stays byte-identical): late stop with the hold, seal A through the real finalization, run B's full lifecycle (`createSession` → `beginPrecheck` → timed precheck → conditional `acknowledgePrecheckWarnings` → `startRecording`), assert the held second does NOT bleed — `drawn()` is 0 at B's create, through B's precheck, and at B's RECORDING start (the `heldAfterStop` `sessionId` guard at `recording-elapsed.ts:150,152` is the line exercised), then grows from B's own Core instant (+3 s → draws 3, `:227`), never A's held 1129 (`expect(drawn()).toBeLessThan(held)` at `:228`). Existing fake-clock machinery only; the two original tests were not touched (the §4 failure excerpt's line `:114` still matches). Passes on the fixed tree by design — it is the guard's regression test the review said was missing; §4 records why it is not (and cannot be) a new RED. |
| F3 | Minor | APPLIED (test) | Two direct `freeze()` unit cases added to `elapsed-ticker.test.ts` at `:89-127` (the file row 26 cited at `:75-87`, same folder, same `fakeClock` conventions): (a) `:91-106` freeze halts advancement at the last drawn second, drops the armed timer at the freeze (`pending()` = 0), no growth under further clock time, no further listener notification; (b) `:108-127` freeze is idempotent and a `subscribe` after a freeze returns the frozen value and never re-arms. `createElapsedTicker` already returns the public `ElapsedTicker` with `freeze()` (`recording-elapsed.ts:53-63`, exported via `./use-monitor`), so no API was widened for the test. File 4→6 tests, 3/3 exit 0 (§5). |
| F4 | Minor | APPLIED (report text) | §7.1 reworded to the review's remediation: the residual is **consistent with D255's demo display tolerance; not explicitly ruled** — D255 accepted RC-1 "as a known display correction for this demo" and ruled the per-session "keep the larger" fix, but never ruled on the SEALED→history row swap. The mechanism is now stated precisely (at SEALED `s.session` stays the sealed session — `session-machine.ts:879` — and the hook keeps holding, pinned by test 4; the step-back appears when `sessions-model.ts:111-114,117-119` swaps the active row for the history row whose duration is the Core's `endedAt − startedAt` — `session-machine.ts:802,886` — δ below the held value, e.g. 1129 → 1122). The follow-up "hub row: no step-back across the SEALED→history swap" (a `use-sessions-data.ts` change) is recorded there, matching row 26's Needs-follow-up adjudication of R1. |
| F5 | Nit | ACKNOWLEDGED (report text only, per the follow-up brief — no code change) | `heldAfterStop` calls `freeze()` during render (inside the hook's `useMemo`, `recording-elapsed.ts:172` → `:153`). Accepted as-is: the call is idempotent (guard at `:118`), there is no React concurrent mode in this app, and the state machine has no return to RECORDING (`session-machine.ts:657` entry only; per §1 the stop is terminal), so render-phase freezing is safe here; an effect-based freeze keyed on the not-RECORDING transition is the cleaner alternative if a future row refactors this hook. |
| F6 | Nit | ACKNOWLEDGED (report text only, per the follow-up brief — no code change) | `freeze()` is irreversible and `sharedTicker:134` would hand back a frozen ticker if the same `sessionId|startedAt` key ever returned to RECORDING. Not reachable today (`session-machine.ts` has no re-entry into RECORDING; forward-only per DEC-FXR-M-2), and test 4 now pins the forward half of the invariant (a NEW key gets a FRESH ticker). The implicit coupling is recorded here; a one-line source comment or `stopped`-reset on cache replacement would close it in a future production row, and the follow-up brief excludes production changes from this pass. |

## 9. Files written by this row

- `docs/2026-10-07_dems_real_capture_sealing/implementation/07_rc1_recording_elapsed_monotonic.md` (this file; updated in place by the W9 follow-up)
- `docs/2026-10-07_dems_real_capture_sealing/delegation_progress/coder-execution__row22.md` (row 22)
- `docs/2026-10-07_dems_real_capture_sealing/delegation_progress/coder-execution__row22_followup.md` (W9 follow-up)
- Source: `apps/mobile/src/runtime/recording-elapsed.ts` (modified by row 22, +46/−7; UNCHANGED by the follow-up, blob pair `9ba1468..4da7cd7`)
- Test: `apps/mobile/src/features/session-live/live-rc1-elapsed-stop-hold.test.tsx` (new in row 22, untracked; 3→4 tests by the follow-up)
- Test: `apps/mobile/src/features/session-live/elapsed-ticker.test.ts` (pre-existing; 4→6 tests by the follow-up, F3 only)
