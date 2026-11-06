# B10-d: `src/test/live-paired-devices-issue` wall-clock independence (row 20, M0, class A, tier 3)

> **Superseded in part (2026-10-08, audit D19/D21):** see `implementation/09_rv_code_audit_fixes.md` — the `:132` failure site of `live-paired-devices-issue` is now deterministic, and the row-22 after-stop hold was replaced by ruling D19(b) (the Core's recorded duration wins once the stop is known).


Date: 2026-10-07
Agent: coder-execution
Plan: `identification/02_structured.md:200` row 20 — "B10-d: make core-web test `src/test/live-paired-devices-issue` independent of wall-clock time"; Verification column (same row): "File passes 3/3 runs; real-time waits = 0; production-code diff empty". Test depth 2 + 1 per D8/D10 (row 16 precedent: `implementation/01_b10a_live_gap_read_only_dialog.md`).
Target file: `apps/core-web/src/test/live-paired-devices-issue.test.tsx` (460 lines at HEAD `2a4f4ea`).

## Verdict

**PASS on all three acceptance clauses, with one real wait converted.** Row 16's pointer is confirmed by my own audit: the file's single literal wall-clock wait sat at **`:373`** (`await new Promise((resolve) => setTimeout(resolve, 50))` inside an `act`). It is now the bed's virtual clock (`bed.elapse(50, 50)`), the convention the same file already uses at `:166/:169/:172/:175/:179/:276`. Assertions are byte-identical otherwise; no production file, no shared helper, no config, no manifest or lockfile was touched. 3/3 runs exit 0 (20 tests each), both greps clean.

## 1. Per-wait root cause (pre-edit line numbers)

| Line | Token | Time source | Class | Disposition |
|---|---|---|---|---|
| `:43` | `configure({ asyncUtilTimeout: 8_000 })` | RTL polling ceiling | bound, not a wait | unchanged |
| `:44` | `vi.setConfig({ testTimeout: 30_000 })` | per-test ceiling | bound, not a wait | unchanged |
| `:71-74` | `pressIssue` = `act(async () => fireEvent.click(…))` | React act (microtasks) | virtual | unchanged |
| `:79`, `:273`, `:351` | `screen.findByTestId(…)` (3 sites) | RTL poll, condition-gated | real-poll sync (exits on first satisfied check) | unchanged |
| 25 sites (`:80, :191, :206, :211, :227, :245, :247, :266, :277, :287, :300, :313, :328, :337, :353, :359, :369, :389, :392, :398, :401, :414, :432, :440, :457`) | `waitFor(…)` | RTL poll, condition-gated | real-poll sync | unchanged |
| `:265, :312, :327, :371, :430, :439` | `bed.flush()` (6 sites) | 40 promise-job turns inside `act` (`live-harness.ts:381-385`) | virtual | unchanged |
| `:166, :169, :172, :175, :179, :276` | `bed.elapse(…)` (6 sites) | `fake.clock.advance` per step + flush (`live-harness.ts:446-453`), timers virtual at `packages/shared/src/live/testing/clock.ts:81` | virtual | unchanged — proven by grep, not touched (row 16 method) |
| `:122, :164, :188, …` | `openPairedDevices()` / `appendAuditRow()` | promise jobs + `act` only (`pd-bed.tsx:172-191`, `:194-219`) | virtual | unchanged |
| **`:373`** | **`await new Promise((resolve) => setTimeout(resolve, 50))`** inside `act` (`:372-374`) | **host wall clock (`setTimeout`)** | **REAL wait — the file's only one** | **converted** |
| `:220` | `Date.parse('2026-10-01T10:00:00+07:00')` | literal instant, no clock read | not time | unchanged |

Wide grep for other real-clock tokens (`setTimeout|setInterval|sleep(|wait(|Date.now|performance.now|requestAnimationFrame`) printed **0 hits after the edit**; before the edit its only hit was `:373`. Nothing in the file reads a clock or arms a runner timer directly.

Root cause of the `:373` wait, stated before converting (the row-16 discipline): it is W92-16's quiet window — "a test that claims ONE toast counts the toast CALLS, not the toasts on screen" (file header comment `:108-112`, `spyToastCalls` `:113-118`). The window must run (a) every pending promise job, (b) every app/runtime timer, (c) every delayed answer of the fake transport. Under this bed all three are virtual: (b) `live-harness.ts:410` injects `fake.clock.timers` into the runtime and `clock.ts:81` routes `setTimeout` to `schedule`; (c) `packages/shared/src/live/testing/http.ts:18` ("(`delayMs`) is kept on the fake's clock"), delivered at `http.ts:582` (`clock.schedule(delayMs, run)`); (a) `bed.flush`. Toast calls on this page are synchronous inside the mutation handlers (`issue-panel.tsx:136`, `:147`; `revoke-dialog.tsx:76`, `:93`, `:105`; presenter `core-errors.ts:238`, LIMIT branch `:250-254`), and the folder's only real timer is the device-highlight fade at 1,500 ms (`devices-panel.tsx:163`, `animated-list.tsx:41`), far outside a 50 ms window. So the virtual window covers the same, and in the delayed-answer direction a wider, set of mechanisms than the sleep did.

## 2. Change made

`git diff --numstat`: `4 3 apps/core-web/src/test/live-paired-devices-issue.test.tsx` — one hunk, one file.

```diff
     // W92-16: after a flush, ONE toast call — not only one toast on screen.
+    // B10-d (row 20): the quiet window is the bed's fake clock, not wall time — `elapse` moves it in
+    // virtual ms and flushes the promise jobs after each step (`live-harness.ts:446-453`), so every
+    // runtime timer and every delayed answer of the fake transport (`clock.ts:81`) runs inside it.
     await bed.flush()
-    await act(async () => {
-      await new Promise((resolve) => setTimeout(resolve, 50))
-    })
+    await bed.elapse(50, 50)
     expect(toastCalls()).toBe(1)
```

No assertion, no fixture, no helper, no ordering changed; the preceding `bed.flush()` is kept so the "after a flush" wording of W92-16 stays literally true. `act` is still imported and used at 10 other sites (`grep -c "await act("` = 10), so imports are untouched.

Alternative considered and rejected: `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })` + `vi.advanceTimersByTimeAsync(50)` — the sibling convention in `live-pending-control.test.tsx:66-70`/`:30-33` and `live-session-new-pending.test.tsx:62-65`/`:81-82`. Rejected because (a) it does not move the fake transport's manual clock, so delayed answers — the mechanism that can actually produce a second 429 toast — would stay unfired unless `bed.elapse` is also called; (b) the switch is global and this file's `afterEach` (`:100-105`) awaits `clearToasts()`, whose own `setTimeout(resolve, 350)` (`pd-bed.tsx:228`) would never fire while runner timers stay faked — a hang risk that needs a new restore hook, i.e. a behaviour change; (c) `bed.elapse` is already this file's established pattern (6 pre-existing sites) and needs no new import or hook.

## 3. The 3 runs (2 + 1, per D8/D10)

Form, from the repository root: `npm run test -w @dems/core-web -- src/test/live-paired-devices-issue --maxWorkers=2` (workspace script `apps/core-web/package.json:11` = `vitest run`). Exit codes captured per run.

```
== r1  exit=0   Test Files  1 passed (1)   Tests  20 passed (20)   Duration  4.51s (tests 55%, import 16%, transform 16%, environment 9%, setup 4%)
== r2  exit=0   Test Files  1 passed (1)   Tests  20 passed (20)   Duration  3.68s (tests 65%, transform 16%, import 11%, environment 6%, setup 2%)
== r3  exit=0   Test Files  1 passed (1)   Tests  20 passed (20)   Duration  3.95s (tests 68%, transform 15%, import 10%, environment 5%, setup 2%)
```

Pre-edit baseline (same command, unmodified file): exit 0, `Tests 20 passed (20)`, `Duration 4.61s`. No run flaked; no timeout raised (`testTimeout: 30_000` at `:44` and `asyncUtilTimeout: 8_000` at `:43` untouched). Host during the runs: `uptime` "load averages: 4.45 4.71 4.69" at start, "5.95 5.48 5.05" at the end, with spike S4 and a Homebrew install running in parallel.

Extra evidence that the edit does not disturb neighbours: the file ran twice more inside 6-file subsets (`live-paired-devices-issue`, `live-meter-clip-reset`, `live-devices-clip`, `live-w0-device-log`, `live-shell-indicator`, `src/lib/__tests__/download`) — both runs printed `Test Files 6 passed (6)` / `Tests 67 passed (67)`.

## 4. The 0-waits grep quote

```
$ grep -nE "setTimeout\( *[0-9]{3,}|sleep\(|await new Promise" apps/core-web/src/test/live-paired-devices-issue.test.tsx || echo "0 real-time waits"
0 real-time waits
```

Wider pattern, same result:

```
$ grep -nE "setTimeout|setInterval|sleep\(|wait\(|Date\.now|performance\.now|requestAnimationFrame|advanceTimers" apps/core-web/src/test/live-paired-devices-issue.test.tsx || echo "0 timer/real-clock tokens"
0 timer/real-clock tokens
```

What remains is exactly the controlled mechanism, quoted post-edit: 7 `bed.elapse` sites (`:166, :169, :172, :175, :179, :276`, and the new `:375 await bed.elapse(50, 50)`) and 6 `bed.flush` sites (`:265, :312, :327, :374, :431, :440`) — every one advances the fake transport clock (`live-harness.ts:446-453` → `clock.ts:106-116`) or runs promise jobs (`live-harness.ts:381-385`).

## 5. The concurrency flag that worked (for row 27) — corrects the vitest caveat in D8 and row 5

The caveat this row was told to check reads, verbatim, at `research/05_b2_dependency_triage.md:265` (the row-23 preconditions table, step 10: "the four vitest workspaces (vitest 5.0.3) express this as pool sizing, so verify `npx vitest --help` accepts the forwarded flag and otherwise pass `--pool=threads --poolOptions.threads.maxThreads=2`"), recorded as a live correction in `decisions/decisions.md:14` (D8: "vitest workspaces do not honour `--maxWorkers` (only mobile jest does) so rows 23/27 need `--poolOptions.threads.maxThreads=2`") and folded into the register as W1-C7 in `research/03_analysis.md:335`. The delegation brief labels it A-R5-7; the assumption table in that file only runs to A-R5-5 (`:289-293`), so the citations above are the claim's actual locations (row 16's report cites the same caveat as "A-R5-7 … point 7" at `implementation/01_b10a_live_gap_read_only_dialog.md:48`).

**Working form:** `npm run test -w @dems/core-web -- <path> --maxWorkers=2` (3/3 exit 0 above). `--maxWorkers` is a first-class, *honoured* CLI option of the installed vitest 5.0.3, not a silently ignored jest-ism:

- `npx vitest --help` (exit 0): `--pool <pool>  Specify pool, if not running in the browser (default: forks)` and `--maxWorkers <workers>  Maximum number or percentage of workers to run tests in`; declared in `node_modules/vitest/dist/chunks/cac.DfDGTQ9W.js:938`.
- Consumed by the node pools: `resolveMaxWorkers` reads `project.config.maxWorkers` then `project.vitest.config.maxWorkers` (`node_modules/vitest/dist/chunks/index.DpLw24bj.js:11850-11851`), the pool is sized with it (`:11780` `pool.setMaxWorkers(maxWorkers)`), and the scheduler refuses to exceed it (`:11498` `if (this.queue.length === 0 || this.activeTasks.length >= this.maxWorkers) return;`); percentage values resolve against `availableParallelism()` (`:14431` + `getWorkersCountByPercentage` `:7526-7529`).
- Empirical, same 6 files, same host: `--maxWorkers=1` → `Duration 15.55s` and `Test Files 6 passed (6) / Tests 67 passed (67)`; `--maxWorkers=4` → `Duration 7.62s` (re-run 8.05 s), same `6 passed (6) / 67 passed (67)`. Process attribution during the 1-worker run (`ps -eo pid,ppid,command`): exactly two vitest-matching processes, the main runner `4291 4264 node …/node_modules/.bin/vitest run …` and **one** child worker `4438 4291 /usr/local/bin/node --experimental-import-meta-resolve --require …/vitest/suppress-warnings.cjs …`. A flag that is ignored cannot halve wall time or hold the worker count to one.

**D8/A-R5-7's substitute is wrong for this workspace:** `npm run test -w @dems/core-web -- src/test/live-paired-devices-issue --poolOptions.threads.maxThreads=2` exits non-zero with

```
CACError: Unknown option `--poolOptions`
    at Command.checkUnknownOptions (…/node_modules/vitest/dist/chunks/cac.DfDGTQ9W.js:405:17)
```

and is moot even if accepted: `apps/core-web/vite.config.ts:69-74` sets no `pool`/`poolOptions`, so the pool is the default `forks`, where a `threads.*` knob would not apply. Row 27 (and row 21/23 if they throttle vitest workspaces) should use `--maxWorkers=N`; the four vitest workspaces accept it, only mobile jest needed the same flag for a different reason. This contradicts the note carried into `research/03_analysis.md` as a W1 correction ("vitest ignores --maxWorkers") — routed to the board.

## 6. Production-diff-empty proof

```
$ # measured 08:55-08:59 UTC, before row 17's mobile edit landed
$ git diff --stat -- apps/ packages/ scripts/ release/
 apps/core-web/src/test/live-paired-devices-issue.test.tsx | 7 ++++---
 1 file changed, 4 insertions(+), 3 deletions(-)
$ git diff --stat -- apps/ packages/ scripts/ release/ ':(exclude)*.test.ts' ':(exclude)*.test.tsx' ':(exclude)**/__tests__/**' ':(exclude)**/testing/**'
(empty)                       <- production code: 0 files, 0 lines
$ git diff --stat -- package.json package-lock.json apps/core-web/package.json
(empty)                       <- no manifest or lockfile change
$ git status --porcelain | grep -vE "docs/2026-10-07_dems_real_capture_sealing"
 M apps/core-web/src/test/live-paired-devices-issue.test.tsx
```

The blueprint's literal "production-code diff empty" command sweeps `apps/`, which contains the target test file itself; the honest reading is "no non-test path changed", proven by the excluded-path diff above. The single changed path in my scope is the row's own target file.

My own workspace scope, measured after a sibling row landed (so this stays reproducible):

```
$ git diff --stat -- apps/core-web/
 apps/core-web/src/test/live-paired-devices-issue.test.tsx | 7 ++++---
 1 file changed, 4 insertions(+), 3 deletions(-)
$ git diff --stat -- apps/core-web/ ':(exclude)*.test.ts' ':(exclude)*.test.tsx' ':(exclude)**/__tests__/**' ':(exclude)**/testing/**'
(empty)
```

Attribution note: the full-tree command now also lists `apps/mobile/src/features/settings/live-settings-boundary.test.tsx` (+24/-4) — that is row 17's concurrent mobile-chain edit, not this row's; it appeared after my section-6 measurement. It is a test path, so it does not disturb the production-diff-empty claim for either row.

Verification beyond the runs: `npm run lint -w @dems/core-web` (oxlint) exit 0; `npm run typecheck -w @dems/core-web` (`tsc -b`) exit 0 (`*.tsbuildinfo` is gitignored, `.gitignore:18`, so the tree stays as listed).

## 7. Residual risks for row 25 (and notes for 21 / 27)

1. **Coverage delta of the converted window.** The virtual window no longer executes real-timer callbacks due inside 50 ms. Evidence that nothing on this path loses its guard: the paired-devices production folder raises toasts only synchronously in mutation handlers (`issue-panel.tsx:136`, `:147`; `revoke-dialog.tsx:76`, `:93`, `:105`; `core-errors.ts:250-254`), its only real timer is 1,500 ms (`devices-panel.tsx:163`, `animated-list.tsx:41`), react-query retries are ≥1,000 ms real (the bed builds `new QueryClient()` with no retry override, `live-harness.ts:423`), and the presenter's coalescing gate uses real `Date.now` with a 3,000 ms window (`core-errors.ts:64`, `:218`, `:225-231`, `:243`) — all outside the old sleep too. If a future edit gives this path a short real timer, the W92-16 guard weakens silently; a reviewer may prefer an explicit second `expect(toastCalls()).toBe(1)` after another `bed.flush()`.
2. **Shared helper keeps an awaited real wait.** `clearToasts()` (`pd-bed.tsx:223-229`) waits a real 350 ms when the kit's toast queue holds exiting keys, and this file awaits it in `afterEach` (`:100-105`). It asserts on nothing, but it is the dominant real-time cost per test and is duplicated in **30** core-web files (`rg -l "getExitingKeys" apps/core-web/src | wc -l` = 30), including the two other paired-devices files row 21 depends on. Converting it is a multi-file change to a shared bed and is outside row 20's file-level acceptance (the row's grep is file-scoped, as in row 16). Recommend registering it as a B10 follow-up rather than folding it into rows 20/21.
3. **Bounded-CPU cost against the ceiling (unchanged by me).** The file's heaviest virtual loops are `bed.elapse(CODE_LIFETIME_MS - 61_000, 1_000)` = 239 act+flush cycles (`:166`) and `elapse(45_000, 1_000)` = 45 cycles (`:172`); that is throughput, not sleeping, and measured 3.68-4.61 s for 20 tests against `testTimeout: 30_000`. Row 27 under heavier load should read this file's duration, not its timeouts, first.
4. **RTL `waitFor`/`findBy*` still poll in real time** (25 + 3 call sites, bounded by `:43`/`:44`; 26 lines contain the token, the extra one is the header comment at `:110`). Inherent to testing-library and condition-gated; every B10 file shares it. Not a wall-clock *sleep* and not convertible without changing synchronisation semantics.
5. **New virtual advance in a refusal test.** `:373`'s window now moves the fake clock 50 ms in the 429 test, where no code is active (`answerOnce` consumed, `core.active` stays null), so the countdown/expiry machine has nothing to tick; proven by the unchanged `IDLE`/no-error/one-toast assertions passing 3/3 plus 2 extra runs in mixed-file subsets.
6. **Flag guidance for row 27** (section 5): use `--maxWorkers=2`; do **not** use `--poolOptions.threads.maxThreads=2` (hard error in vitest 5.0.3). Rows 21/22 can copy the working form verbatim.

## Artifacts

- This report: `docs/2026-10-07_dems_real_capture_sealing/implementation/05_b10d_live_paired_devices_issue.md`
- Progress note: `docs/2026-10-07_dems_real_capture_sealing/delegation_progress/coder-execution__row20.md`
- Edited test file: `apps/core-web/src/test/live-paired-devices-issue.test.tsx` (1 hunk, +4/-3)
- Scope discipline: no mobile or core-server suite was run, no root `npm test`, no second core-web suite concurrently, no emulator, no sudo, no network, no manifest/lockfile change.
