---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
row: fix wave K, the intermittent mobile test named in implementation/149 section 4
date: 2026-10-11
agent: coder-execution
tree: 57b80a9 + the working-tree edits of wave K (no commit, no git write)
status: complete
---

# 150 - The intermittent export test (`wave-k-m2-operator-export.test.tsx`)

## 1. Verdict

**(a) A race in the TEST. The product is not at fault.** One file changed, a test file. No product
file changed.

The test moves the bed's FAKE clock and runs promise jobs, but `@tanstack/query-core` tells a query's
observers on the SYSTEM's `setTimeout(callback, 0)`. Nothing in the test waited for that real timer,
so the assertion raced it. On a device that timer simply fires; an operator cannot see this.

## 2. Cause, with sources

| # | Fact | Source |
|---|---|---|
| 1 | The job's answer reaches the screen through an observer notification that query-core schedules on the real `setTimeout(callback, 0)` | `node_modules/@tanstack/query-core/build/modern/notifyManager.js:7` (`defaultScheduler = systemSetTimeoutZero`), `timeoutManager.js:154` (version 5.104.0) |
| 2 | The test's waits never run a real timer: `b.elapse` advances the fake clock and runs promise jobs, `b.flush` runs promise jobs only | `apps/mobile/src/features/evidence/testing/live-evidence-bed.tsx:177` (`flushJobs`), `:282` (`elapse`) |
| 3 | The test asserted straight after `b.elapse(EXPORT_BUILD_MS + 600)` and one `b.flush()` | `wave-k-m2-operator-export.test.tsx`, end of `exportThrough` and the two `evidence-export-job-COMPLETE` assertions (before this change: lines 308-309, 327, 344) |
| 4 | The sheet draws `evidence-export-job-WAITING` while the observer has no data yet | `apps/mobile/src/features/evidence/export-job-status.tsx:78` |
| 5 | The list refresh of G94b-05 is one more step behind the same timer: it runs in an effect of the render that the notification causes, and its own answer is told to the screen by a second notification | `export-job-status.tsx:71-75` |

Whether the test passed depended on whether about one millisecond of real time went by between the
job's answer and the assertion (each `act` exit yields one macrotask turn, so sometimes it did).

Ruled out, each by the log below or by the code:

| Candidate | Finding |
|---|---|
| The poll misses COMPLETE or stops early (product) | The FIRST read answers COMPLETE and it is stored in the cache in every run, passing or failing (`cache evidence-export-job: success status=COMPLETE`). `refetchInterval` stops only at a terminal job or an error (`export-job.ts:53`) |
| The list refresh runs before the completion is stored (product) | The invalidation is an effect keyed on the terminal job the component already holds (`export-job-status.tsx:71-75`); in the log `evidence-media: invalidate` always follows the job's notification |
| A `waitFor` window shorter than the poll interval | The test uses no `waitFor`; the poll interval (`EXPORT_JOB_POLL_MS = 2_000`, `export-job-model.ts:84`) is never reached because the first read is terminal |
| Shared state between cases, per-operator scope not reset | A copy holding ONLY the "after an export" cases fails the same way (5 of 8 runs) |

## 3. The failing interleaving (log order)

A temporary copy of the two cases logged the cache events, the notification's scheduling and running
(the same `setTimeout(callback, 0)`, wrapped with two log lines) and what the sheet drew. The copy is
removed. Times are milliseconds from the file's start.

Failing run (case "the job reaches COMPLETE"):

```
481.00 ms  TEST elapse(EXPORT_BUILD_MS + 600) begins
502.00 ms  cache evidence-export-job: fetch
510.00 ms  cache evidence-export-job: success status=COMPLETE
510.00 ms  notify #3 SCHEDULED on the real setTimeout(0)
514.00 ms  TEST exportThrough ends; the sheet shows: evidence-export-job-WAITING
516.00 ms  TEST ASSERTS COMPLETE; the sheet shows: evidence-export-job-WAITING
525.00 ms  notify #3 RUN (observers told)
```

Passing run, same code:

```
482.00 ms  TEST elapse(EXPORT_BUILD_MS + 600) begins
504.00 ms  cache evidence-export-job: fetch
511.00 ms  cache evidence-export-job: success status=COMPLETE
511.00 ms  notify #3 SCHEDULED on the real setTimeout(0)
513.00 ms  notify #3 RUN (observers told)
514.00 ms  cache evidence-media: invalidate
514.00 ms  cache evidence-media: fetch
515.00 ms  cache evidence-media: success status=-
515.00 ms  notify #4 SCHEDULED on the real setTimeout(0)
515.00 ms  notify #4 RUN (observers told)
534.00 ms  TEST exportThrough ends; the sheet shows: evidence-export-job-COMPLETE
536.00 ms  TEST ASSERTS COMPLETE; the sheet shows: evidence-export-job-COMPLETE
```

In the failing run COMPLETE is in the cache 6 ms before the assertion; only the notification is late.

## 4. The change

`apps/mobile/src/features/evidence/wave-k-m2-operator-export.test.tsx` only:

- New helper `observersTold(b)` (line 304). One turn = a real zero timer awaited inside `act`, then
  `b.flush()`. A zero timer set after the notification's runs after it (timers of one delay run in
  the order they were set), so this waits by the scheduler's own rule and not by a length of time.
  The turn repeats until one whole turn produced no cache event and nothing is being read, because a
  notification can start the next read (the job's end reads operation 40 again). It throws after 20
  turns instead of going on silently.
- Called at the end of `exportThrough` (line 342) and after the press of `evidence-export-finish`
  (line 365).

No timeout was lengthened and no assertion was changed or removed: the sheet must still reach
`evidence-export-job-COMPLETE`, operation 40 must still be asked again, and the list must still show
`EXP-000041` and not "No finished export of this item."

The test still catches the defect it was written for: with the invalidation of
`export-job-status.tsx:74` taken out for one run, the case fails (`Expected: > 1, Received: 1` on the
count of operation 40). The product file was then restored byte for byte (`cmp` identical).

## 5. Runs

| Run | Command | Result |
|---|---|---|
| Before, the file alone, 10 times | `npx jest src/features/evidence/wave-k-m2-operator-export.test.tsx` | 4 passed, 6 failed. Failing cases: G94b-06 in all 6, "the job reaches COMPLETE" in 1 of them |
| Logging copy (two cases only), 8 times | the same on the temporary copy | 2 passed, 6 failed; every failure has the order of section 3 |
| After, the file alone, 20 times | the same command | 20 passed, 0 failed (16 tests each) |
| Evidence folder, once | `npx jest src/features/evidence --maxWorkers=2` | 32 suites, 314 tests, all passed |
| Typecheck, once | `npm run typecheck` (apps/mobile) | exit 0, 0 `error TS` |
| Lint, once | `npm run lint` (apps/mobile) | exit 0, 0 errors, the one known warning (`src/runtime/log.test.ts:160:19 array-type`) |

## 6. Open points for the controller

| Point | Detail |
|---|---|
| Same pattern elsewhere | Any Live test that asserts on a query's answer right after `b.elapse` / `b.flush` has the same race in principle. `live-evidence-export.test.tsx:260` already loops until the job box appears. The other cases of this file passed in all 10 unchanged runs and were left as they are. Not swept here (one test was the task) |
| Formatting | `prettier --check` reports this test file. It was not run with `--write`: the file holds driver M2's long lines and I did not establish whether it conformed before my edit |
| A wider fix | `observersTold` could move into `live-evidence-bed.tsx` (for instance at the end of `elapse`) so every Live test gets it. That changes a shared test bed used by about 20 files, so it is a decision for the controller, not made here |

---
*Generated: 2026-10-11*
