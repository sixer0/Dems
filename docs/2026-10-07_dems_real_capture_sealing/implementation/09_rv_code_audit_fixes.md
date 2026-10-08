---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: RV-CODE (revision round RV; audit AU-1 findings AU1-1, AU1-2 ruling D19(b), AU1-5, AU1-6)
date: 2026-10-08
agent: coder-execution (Claude Code)
source_plan: decisions/decisions.md D19; verification/20_audit_code_tests.md
narrative_tier: 2
status: completed
---

# RV-CODE: code and test fixes for audit AU-1

## 0. Summary

| Finding | Fix | Proof |
|---|---|---|
| AU1-1 (Major) | `issueMarker()` in `apps/core-web/src/test/live-paired-devices-issue.test.tsx:76-104` now plays the reveal to its end on a fake `setInterval`. It fakes `setInterval`/`clearInterval` only, and only inside the helper. It advances 1,000 ms (the scramble takes 600 ms plus a 40 ms frame, so 640 ms), asserts that no fake interval is left, restores real timers, then checks the digits exactly. | 20/20 alone ×2. Core-web full run 117/1,495. Mutation M4 (no advance): 14 failed with `expected 2 to be +0`, so both scramble groups are now under the fake interval. |
| AU1-2 (Major), ruling D19(b) | `apps/mobile/src/runtime/recording-elapsed.ts`: the ticker half applies only while the Core reports RECORDING **and** `stoppedAt === null` (`:180-194`). From the stop on it is 0, so every screen draws the store's frozen `stoppedAt - startedAt`. That value is the sealed history entry's `durationMs` (`session-machine.ts:854`, `endedAt = session.stoppedAt ?? at`; `:802`). Row 22's `heldAfterStop` hold was removed. | New test file covering the real hub row and detail pane, plus the reworked RC-1 file. Mutation M1 (row-22 hold restored): 6 of 7 failed, `Expected: 1122 / Received: 1129` and `Expected: "00:18:42" / Received: "00:18:49"`. |
| AU1-5 (Nit) | The three `toBeGreaterThanOrEqual(ticked)` checks became exact `toBe(...)`, using the value the new ruling fixes (`ticked - 7` = the recorded duration): `live-rc1-elapsed-stop-hold.test.tsx:127, :143-144, :252`. | 0 `toBeGreaterThanOrEqual` left in the file. |
| AU1-6 (Nit) | **Code option chosen.** A frozen ticker is never handed out again. `sharedTicker` replaces a cached ticker that is frozen (`:148-155`). `releaseStoppedTicker` (`:162-168`) freezes and drops the stopped session's ticker. It runs in a `useEffect` (`:190-192`), so the render-time side effect AU-1 flagged is gone. The invariant (the session machine's single RECORDING entry) is documented at `sharedTicker`. | New AU1-6 test (forced re-entry). Mutation M3 (reuse the frozen ticker, no cache drop): failed with `Expected: 1131 / Received: 1129`. |

`apps/mobile/src/features/sessions/sessions-model.ts` was **not changed**, because it does not compute its own value. The hub row and the detail draw `row.durationMs` (history), or else `useLiveElapsedSeconds()` (`use-sessions-data.ts:139-142` = max(store, `useRecordingTickerSeconds()`)). The fix in `recording-elapsed.ts` therefore covers all of them, and the D236/D246 single-source pattern is kept: every screen reads `recording-elapsed.ts`.

## 1. Ruling D19(b) as implemented

- **While the Core reports RECORDING and no stop instant is known:** unchanged. The drawn value is max(store clock, Core-clock ticker), forward only (DEC-FXR-M-2/D236/D246). Pinned by `elapsed-ticker.test.ts` "never steps back" and the RECORDING loop in the new hub test.
- **When the Core reports the stop** (state leaves RECORDING, or `stoppedAt` is known while the replica still says RECORDING): the ticker half drops to 0 and the screens draw `floor((stoppedAt - startedAt)/1000)`.
  - There is exactly one correction, at that moment. Under the RC-1 load model it is 7 s down from the ticker's lead.
  - After that the value does not move through STOPPING, FINALIZING and SEALED.
  - At SEALED the history row's `formatDuration(durationMs)` shows the same string, because `durationMs` = `stoppedAt - startedAt` exactly. The drawn duration is therefore never above the sealed duration.
- **FAULT out of scope:** a FAULT from RECORDING sets no `stoppedAt`, so it behaves as before row 22 (store clock only). D19(b) rules only on the stop. Recorded here as a scope note, not changed.
- **Accepted consequence (D19(b)):** the "one bounded correction" is a downward step at the moment the stop is learned. Under RF2-2 load that is 7.7-12.4 s on the tablet. The new tests pin it exactly.

## 2. Changes made

| File | Change | Description |
|---|---|---|
| `apps/core-web/src/test/live-paired-devices-issue.test.tsx` | modify (+28/-4 vs Kilo's tree) | `SCRAMBLE_SETTLE_MS`; deterministic `issueMarker()` (AU1-1). No assertion removed. `waitFor(...toBe(MARKER_CODE))` became an exact `expect(...).toBe(MARKER_CODE)` after the reveal has provably ended, plus a new `vi.getTimerCount() === 0` check (`expect(` 131 → 132). |
| `apps/mobile/src/runtime/recording-elapsed.ts` | modify (+44/-26 vs Kilo's tree) | Ruling D19(b); `heldAfterStop` removed; `isFrozen()` added; `releaseStoppedTicker` in an effect; `sharedTicker` replaces a frozen ticker (AU1-6); header and JSDoc rewritten to state the ruling. |
| `apps/mobile/src/features/session-live/live-rc1-elapsed-stop-hold.test.tsx` | modify (+100/-27) | Tests 1, 2 and 4 re-targeted to the ruling with exact values (AU1-5). Test 2 now runs through FINALIZING to SEALED and checks the sealed `durationMs`. New: "a stop instant known while RECORDING" and "AU1-6 re-entry". 4 → 6 tests, `expect(` 26 → 45. |
| `apps/mobile/src/features/session-live/elapsed-ticker.test.ts` | modify (+7/-3) | Comment updated to the ruling; `isFrozen()` checked before and after `freeze()` (`expect(` 23 → 25). |
| `apps/mobile/src/features/sessions/live-d19b-stop-duration.test.tsx` | **new** (156 lines, 1 test, 21 `expect(`) | REAL `SessionRow` plus the REAL detail pane (`sessions-harness`, tablet landscape, `/sessions/<id>`), with a manual Core clock 7 s ahead of the lagging store. It checks: RECORDING forward-only; late stop gives `session-row-duration-<id>` = `session-detail-duration` = `formatDuration(stoppedAt - startedAt)`; then 14 × 1 s through FINALIZING to SEALED with the same string every frame; the sealed `durationMs` equals the recorded duration; 0 timers armed. |

Rollback copies of the four pre-existing files (and of `sessions-model.ts`) were taken before any edit, in `/Users/gsp-budi/Documents/DEMS/.cache/rollback/RV-CODE/` (same relative paths; sha256 recorded at copy time, e.g. `recording-elapsed.ts` 9c9753d8…f2). Kilo's rows 16-27 changes were kept; all edits build on them.

## 3. Test results (verbatim count lines)

Load was checked before each heavy step: 08:20 load 5.06, 08:22 load 4.40, 08:25 load 4.02 and 3.89, 08:28 load 6.14. All were below 14.

### 3.1 Each new or changed test: 2 isolated runs + 1 run inside its full workspace

| Test | Run 1 | Run 2 | Full workspace run |
|---|---|---|---|
| core-web `src/test/live-paired-devices-issue.test.tsx` | `Tests  20 passed (20)` 3.72 s | `Tests  20 passed (20)` 3.28 s | inside core-web `Test Files  117 passed (117)` (exit 0) |
| mobile `session-live/live-rc1-elapsed-stop-hold.test.tsx` | `Tests:       6 passed, 6 total` 1.579 s | `Tests:       6 passed, 6 total` 0.99 s | `PASS src/features/session-live/live-rc1-elapsed-stop-hold.test.tsx` |
| mobile `session-live/elapsed-ticker.test.ts` | `Tests:       6 passed, 6 total` 1.017 s | `Tests:       6 passed, 6 total` 0.863 s | `PASS src/features/session-live/elapsed-ticker.test.ts` |
| mobile `sessions/live-d19b-stop-duration.test.tsx` (new) | `Tests:       1 passed, 1 total` 2.521 s | `Tests:       1 passed, 1 total` 2.007 s | `PASS src/features/sessions/live-d19b-stop-duration.test.tsx` |

### 3.2 Full suites (`--maxWorkers=2`), once each

```
$ npm run test -w @dems/mobile -- --maxWorkers=2          (exit 0)
Test Suites: 194 passed, 194 total
Tests:       1997 passed, 1997 total
Time:        132.259 s
$ npm run test -w @dems/core-web -- --maxWorkers=2        (exit 0)
 Test Files  117 passed (117)
      Tests  1495 passed (1495)
   Duration  131.49s
```

The mobile delta against AU-1's 193/1,994 is +1 suite (the new file) and +3 tests (2 new RC-1 tests and 1 new hub test). Nothing was removed. Core-web is unchanged at 117/1,495, because the helper changed and the tests did not.

### 3.3 Typecheck and lint

| Workspace | Command | Result |
|---|---|---|
| mobile | `npm run typecheck -w @dems/mobile` (`tsc --noEmit`) | exit 0 |
| mobile | `npm run lint -w @dems/mobile` (`eslint .`) | exit 0 |
| core-web | `npm run typecheck -w @dems/core-web` (`tsc -b`) | exit 0 |
| core-web | `npm run lint -w @dems/core-web` (`oxlint`) | exit 0 |

### 3.4 Mutation checks

All mutations ran in a scratch worktree. `git worktree add --detach $TMPDIR/rvcode_mut HEAD` was populated with every changed or untracked app file of the current tree, with `node_modules` symlinked. No tree file was modified. The baseline in the scratch copy was `Tests: 13 passed, 13 total` for the 3 mobile files. Afterwards the symlinks were unlinked and the worktree was removed (`git worktree remove --force`, rc=0). `git status --short -- apps packages` still lists 15 paths.

| ID | Mutation (scratch only) | Result |
|---|---|---|
| M1 | Stop handling reverted: `recording-elapsed.ts` = Kilo's row-22 version (the hold) | `Tests:       6 failed, 1 passed, 7 total`. RC-1: `Expected: 1122 / Received: 1129` (×5). Hub/detail: `Expected: "00:18:42" / Received: "00:18:49"`. Only the SIMULATED test passes. |
| M2 | The `stoppedAt === null` predicate removed | `✕ a stop instant known while the replica still says RECORDING …` `Expected: 1122 / Received: 1129` |
| M3 | AU1-6 reverted: frozen ticker reused, cache entry not dropped | `✕ AU1-6: …` `Expected: 1131 / Received: 1129` |
| M4 | core-web: `issueMarker` without `vi.advanceTimersByTime` | `Tests  14 failed \| 6 passed (20)`; `AssertionError: expected 2 to be +0` (×13) and `expected 3 to be +0` (×1). The scramble intervals are now fake-controlled at every `issueMarker` site. |

## 4. Issues / decisions

| Item | Decision |
|---|---|
| AU1-1 option | Option 2 (fake only `setInterval`/`clearInterval` inside the helper). Reduced motion for the whole page would also change toast and transition behaviour in 20 tests. Safety check: the page's own timing runs on the bed's fake Live clock (`issue-panel.tsx:48`, `devices-panel.tsx:187`), and no `setInterval` under `src/features/paired-devices` exists, so no long-lived interval is created inside the fake window and lost. Vitest 5.0.3 defaults to `shouldClearNativeTimers: true` (`node_modules/vitest/dist/chunks/defaults.D2ip7f-X.js:48`). |
| AU1-6 option | Code option (replace a frozen ticker), plus the invariant documented, plus `freeze()` moved out of render into an effect. |
| `sessions-model.ts` | Not changed. It holds no elapsed computation; history `durationMs` already equals `stoppedAt - startedAt`. |
| FAULT path | Out of scope of D19(b); unchanged from the pre-row-22 behaviour (store clock). It is a planning note for the controller if a ruling is wanted. |
| Plan and tracker files | Parallel run: `masterplan/02_plan.md`, `status_tasks.md` and `delegation_progress_report.md` were not written. The controller synthesises from `delegation_progress/rv_code_fixes.md`. |
| D13(c) / AU1-4 erratum | Superseded by D19(b) in code: the drawn duration no longer overshoots the stop. The decision-log erratum belongs to the controller. |

## 5. Persistent issues

None. No repair cycle was needed beyond one test-side typo: `stopRecording(...)` returns void, so the `.ok` read was removed from the new test before its first green run.

## 6. Next steps (controller)

- Record D19(b)'s implementation (this file) in the decision log, and close AU1-1, AU1-2, AU1-5 and AU1-6.
- `implementation/05` and `07` and `gateway_check/02` and `03` describe the row-22 hold. They are now superseded on the stop behaviour; add a pointer to this file.
- A device check of the stop correction (A4) is still planned. Expect one downward step at the stop and none at SEALED.

---
*Generated: 2026-10-08 08:31 WIB*
*Last Updated: 2026-10-08 08:31 WIB*
