# coder-execution — row 21 (B10-f, M0, class A, tier 3)

Status: DONE — converted, verification passed. Date: 2026-10-07. Session: coder-execution subagent (row 21 delegation).

Deliverable: `docs/2026-10-07_dems_real_capture_sealing/implementation/06_b10f_chrome_lost_updates.md`

Depends on: rows 19-20 (both gated complete); followed rows 16-18 method exactly (root-cause first, row 17's conversion pattern, D8 depth 2+1, D12 `--maxWorkers=2`).

## Result summary

- Census first (pre-edit, blob `b1a1c38`): the file had ONE real-wait engine — `wait(ms)` at `:123-127` (`await new Promise((resolve) => setTimeout(resolve, ms))` in `act`) — awaited at `:150`, `:162`, `:181` AND a fourth site `:216` that `research/01_explore.md` §2.6 missed (errata in report §1/§8.6). `MOTION_OVER_MS` (`:116`) = max(300, 600, 240) + 100 = 700 ms, each budget cited. No `jest.setTimeout` ever existed in this file — NOT part of row 19's out-of-scope `30_000` population (checked per that row's instruction; no separate finding).
- D246 residual root cause: the first `it()` (`:140`) is the file's most expensive — the ONLY test with two real 700 ms sleeps plus the heaviest route-tree CPU (baseline verbose today: 2778 ms; D246/15c record: "3.4 s alone", "timed out at 5 s at load ~11", `gateway_check/15c_fxr_mobile.md:80,86-88`; T1's load-only CPU-starvation class `16_t1_mobile_jest_timeout.md:23`). The residual IS wall-clock waits with timing-derived settling assertions behind them (removal timers at `nav-item.tsx:57`, `use-indicator.ts:81`, `app-tabs.tsx:123` all run on the global clock) → convert with row 17's pattern, drive the clock, touch no assertion.
- Conversion = row 17's exact pattern, five hunks (+23/−2, blob `b1a1c38`→`9e98b8a`): `wait()` → `act` + `jest.advanceTimersByTime(ms)` + 40-turn promise flush; `beforeEach` first line `jest.useFakeTimers({doNotFake:['nextTick','queueMicrotask','setImmediate']})`; `afterEach` last line `jest.useRealTimers()`; S72-12 `beforeAll` priming via two `promisify(setImmediate)`; `beforeAll`/`node:util` imports. No assertion/matcher/expected value/test name/`MOTION_OVER_MS` value/call-site changed; 4 tests before and after.
- Verification: 3/3 official runs exit 0 (npm-exit captured directly; an earlier trio was excluded because the exit echo came from the pipeline grep) — `Test Suites: 1 passed, 1 total` / `Tests: 4 passed, 4 total` / `Time: 4.846 s`, `3.746 s`, `3.306 s`; load 5-7, zero flakes, no re-run needed, no timeout raised, config untouched. First test collapsed 2778→1306 ms (the two 700 ms sleeps) — the CPU-only residual D246 left. Runs end clean (`Jest did not exit` count 0 per run). Gates: `tsc -p apps/mobile/tsconfig.json --noEmit` exit 0; `eslint` on the file exit 0.
- Acceptance grep: `0 real-time waits`; wider pattern matches only the virtualized `wait(` helper (`:130`) + its four call sites (`:171`, `:183`, `:202`, `:237`); `setTimeout` appears nowhere in the file. Console noise identical across runs (105/76/1/15 per run — pre-existing harness dev output).
- Production diff: `git diff --name-only -- apps/ packages/ scripts/ release/ | grep -v "\.test\."` prints nothing. 11 changed files, all `.test.tsx`: mine (this file) + the 10 gated sibling rows (17 boundary, 18 live-link, 19's seven RC-8 files, 20 core-web) — attributed, untouched.

## For row 25 / the chain

Residuals in the report §8; headline: (1) `doNotFake` list + `beforeAll` priming now load-bearing in THREE mobile files; (2) the full router-harness tree runs green under fake timers (new precedent — 8/8 green runs); (3) B10's file list is now fully settled at row 21's close — the only remaining known wall-clock sleeper in mobile live machinery is `monitor-harness.tsx:33-37 waitForSheetExit` (outside the row 16-22 list, row 18 residual 4); (4) register errata: §2.6 wait-site count 3 → 4.

Files written: the deliverable above, this progress note, and the one test file — `apps/mobile/src/navigation/__tests__/chrome-lost-updates.test.tsx` (the ONLY write outside the task folder). Blockers: none. Mobile jest runner released for the next wave row.
