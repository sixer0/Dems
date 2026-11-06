# coder-execution — row 18 (B10-c, M0, class A, tier 3)

Status: DONE — converted, verification passed. Date: 2026-10-07. Session: coder-execution subagent (row 18 delegation).

Deliverable: `docs/2026-10-07_dems_real_capture_sealing/implementation/03_b10c_live_session_live_link.md`

Depends on: rows 16-17 — followed their run-command form, grep form, and conversion pattern exactly.

## Result summary

- The `:54` pointer from rows 16/17 holds exactly: `apps/mobile/src/features/session-live/live-session-live-link.test.tsx` had ONE real wait — `await new Promise((resolve) => setTimeout(resolve, 1_100));` inside `waitA11yTick` (`:52-56`), called at `:87` and `:127`. Full-file token census pre-edit printed that line only; all 19 `b.flush`, 18 `b.elapse`, 2 `changeOnCore`, `resetLiveMonitorBed` and `settle` are microtask/fake-transport-clock (row 16's evidence reused, own grep quoted in the report). Unlike row 16, the premise was true — conversion was the right action.
- Root cause: the awaited refresh is `useAudioAccessibilityValue`'s global 1 s JS `setInterval` (`use-audio-shared-values.ts:99-106`) — not the bed's injected transport clock, so only the runner's clock can control it. Precedent that drives the same interval on the runner's clock: `use-audio-shared-values.test.tsx:79-103`.
- Conversion = row 17's exact pattern, four hunks: `jest.useFakeTimers({ doNotFake: ['nextTick','queueMicrotask','setImmediate'] })` first line of `beforeEach`; `jest.useRealTimers()` last of `afterEach`; `waitA11yTick` → `act` + `jest.advanceTimersByTime(1_100)` + the bed's 40-turn promise flush; S72-12 Reanimated priming in a new `beforeAll` via two `promisify(setImmediate)` hand-overs. No assertion, matcher, expected value, test name or the `1_100` value changed; 14 tests before and after.
- Verification: 3/3 official runs on the FINAL blob exit 0 — `Test Suites: 1 passed, 1 total` / `Tests: 14 passed, 14 total` / `Time: 9.638 s`, `12.743 s`, `8.376 s` (plus a first official trio 15.473/5.615/5.58 s on the identical pre-reword blob, baseline, and smoke: 6 post-conversion greens, zero flakes, no re-run needed). Host load 5-8 from the concurrent STT check/analyst; max per-test 712 ms vs the old ≥1.1 s sleep floor. No timeout raised; this file has NO `jest.setTimeout` — nothing for row 19 here. Gates: `tsc -p apps/mobile/tsconfig.json --noEmit` exit 0; `eslint` on the file (cwd `apps/mobile`) exit 0.
- Acceptance grep: `0 real-time waits`; wider pattern `0 timer/real-clock tokens` (a first draft's doc-comment mention of the production API was reworded, and the official trio re-run on the final blob).
- Production diff: empty of non-test files. `git diff --name-only -- apps/ packages/ scripts/ release/` = 3 test files: mine (`live-session-live-link.test.tsx`, blob `f242074`→`9961da5`) + the two already-gated sibling rows, attributed and untouched: row 17's `live-settings-boundary.test.tsx` (D12b) and row 20's core-web `live-paired-devices-issue.test.tsx` (D12c).

## For row 25 / the chain

Residuals listed in the report §7; the two newest facts: (1) the runner-fake-timers + bed virtual-clock combination now covers exactly 2 of the 9 `live-monitor-bed` importers, both via the same `doNotFake` list + `beforeAll` priming — future edits must keep them together; (2) `monitor-harness.tsx:33-37` `waitForSheetExit` still sleeps real ms (`SHEET_EXIT_MS + 50`) and is used by `live-session-live-sites.test.tsx` + `session-live-screen.test.tsx` — files outside the row 16-22 list; the wall-clock leak there is flagged for the register, not fixed here.

Files written: the deliverable above, this progress note, and the one test file — `apps/mobile/src/features/session-live/live-session-live-link.test.tsx` (the ONLY write outside the task folder). Blockers: none. Mobile jest chain ready for row 19 (RC-8 sweep; this file contributes no per-test override).
