---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: coder-execution
blueprint_row: W01b (controller row added by decision D25)
date: 2026-10-04
status: complete
---

# Progress: coder-execution, controller row W01b (calendar sweep)

## Status

**complete**. Window 06:40:19 to 07:22 WIB (about 42 minutes of the 75-minute box).

## Files created or updated

| Path | Kind | Note |
|---|---|---|
| `apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx` | test file, modified (12 lines added, 1 replaced) | `git hash-object` after: `1ab07579e928b9b545003899ec3265d4b8b6c762`; blob at `acaff20`: `c2d264bcd8ab2637b895e1e5aa3afa3ae29e835d` |
| `docs/2026-10-04_dems_backend_rbac_pairing/implementation/01b_calendar_sweep.md` | document, new | The row's output (Tier 3) |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_w01b.md` | document, new | This file |
| `.cache/w01b/` | scratch, git-ignored | Preloads, runner scripts, logs (6 MB) |
| `.cache/rollback/W01b.pre.patch` (0 bytes), `.cache/rollback/W01b.post.patch` (2,379 bytes) | scratch, git-ignored | Pre-image (empty: the file was at `acaff20`) and the fix as a patch against `acaff20` |

No production file, no helper, no `package.json`, no runner config, nothing under
`packages/shared/src/sim/`, `apps/mock-core/`, `release/` or `scripts/`. The two files of W01 were not
touched (hashes unchanged: `9e8b97c8…`, `71f6f033…`). Not written: `status_tasks.md`,
`delegation_progress_report.md`, `decisions/decisions.md`, `masterplan/02_plan.md`,
`implementation/99_implementation_report.md` (shared files, parallel run).

## Milestones

| When (WIB) | Milestone |
|---|---|
| 06:42 | Clock shift proven for jest: the Node preload alone does not reach the test contexts; a scratch `--setupFiles` file does; both together also cover `jest.useFakeTimers()` |
| 06:47 | Sweep before the fix done: 6 instants × 3 suites. One failing test (dashboard, at (i), (v), (vi)); shared and mobile green at all six |
| 06:48 | Fix applied to `dashboard.test.tsx`; the file passes 16 of 16 at the real clock and at (i), (v), (vi); typecheck and lint of `@dems/core-web` exit 0 |
| 06:54 | Re-verification done: real clock and all six instants, three suites, 0 failures (core-web 438 of 438 in 39 files, shared 508 of 508 in 28 files, mobile 833 of 833 in 72 suites) |
| 06:58 | Five extra instants green (run across midnight, year boundary, New Year's Day, leap day, 00:30) |
| 07:10 | Hour scan of the wall-clock test files green at 20 times of day (web 21 files, mobile 11 suites) |
| 07:14 | Final pass on the current tree green (real clock, (i), (iii), (v)); typecheck and lint run 2 exit 0 |

## Verification (runner output)

Real clock, 06:49 WIB:

- `@dems/core-web`: `Test Files  39 passed (39)`, `Tests  438 passed (438)`, `Start at  06:49:03`
- `@dems/shared`: `Test Files  28 passed (28)`, `Tests  508 passed (508)`, `Start at  06:49:44`
- `@dems/mobile`: `Test Suites: 72 passed, 72 total`, `Tests:       833 passed, 833 total`

Instants (i) `2026-10-06T00:05+07:00`, (iii) `2026-10-06T23:58+07:00`, (v) `2027-03-01T12:00+07:00`:
the same totals with 0 failures in each of the nine runs (`Start at  00:05:00`, `23:58:00`, `12:00:00`;
mobile probe: 72 test contexts at the shifted instant in each run). Typecheck and lint of
`@dems/core-web`: exit 0, twice. Full quotes: `implementation/01b_calendar_sweep.md` sections 3, 5, 6.

## Findings (for F-n)

1. **Sweep result.** At the six required instants the only test of the three suites that fails under a
   shifted clock is the dashboard test of F26. `@dems/shared` (508) and `@dems/mobile` (833) pass at
   all six. After the fix all three suites pass at 11 instants, and the wall-clock files pass at 20
   times of day.
2. **No production defect.** The failure came from the test's set-up (a simulator on the wall clock).
   The `0 sealed today` between 00:00 and about 00:25 WIB is the documented edge case of the seed
   (`packages/shared/src/sim/dataset.ts:451-452`).
3. **Residual list** (not changed, all green at every instant tried): 13 web files or helpers and 6
   mobile groups still read the wall clock (`01b_calendar_sweep.md` section 8). Two web files are new
   against W01's list: `features/session-monitor/__tests__/session-monitor.test.tsx` and
   `features/login/__tests__/login-page.test.tsx` (optional-clock helpers that fall back to the wall clock).
4. **Jest needs two parts to shift the clock**: `NODE_OPTIONS=--import <preload>` and
   `--setupFiles <scratch file>` as the last option. Measured: the preload alone leaves the tests on
   the real clock; the setup file alone leaves every test that uses fake timers on the real clock.
5. **Load noise at 07:03 to 07:08 WIB.** `uptime` showed load averages 14.10 (1 min) and 20.22 (5 min)
   on 10 cores, above the P9 guard value of 10. One web test timed out in the hour scan
   (`routes.test.tsx`, `/session renders page-session-monitor…`, 1 s wait) and passed three times alone
   and in the repeated scan. Both runs are recorded.
6. **The shared ledger moved during this row.** At 07:11 WIB `@dems/shared` held 31 files and 583
   tests, at 07:13 WIB 584: another row added `packages/shared/test/client-core.test.ts`,
   `client-platform-neutral.test.ts` and `client-types.test.ts`. They pass at the real clock and at
   (i), (iii), (v). Not this row's files.
7. `ps` and `pgrep` are refused inside the sandbox, so this row could not list processes (P7). Every
   runner it started reported its exit.

## Deviations

- The preload is W01's Proxy plus one addition (one offset shared by all processes of a run), not
  W01's file byte for byte. W01's file is kept beside it as `.cache/w01b/fake-clock.w01.mjs`.
- Beyond the row: five extra instants, an hour scan of the wall-clock files, a final pass after other
  rows changed the tree, and a re-apply patch of the fix (`.cache/rollback/W01b.post.patch`).
- Two void probe launches and one void lane launch (command-line mistakes of this row; no test ran;
  repeated correctly). Section 10 of the output document.
- Typecheck and lint were run for `@dems/core-web` only (the one workspace touched).

## Decisions needed (for D-n)

1. Record **"W01b's state"**: `apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx` =
   `1ab07579e928b9b545003899ec3265d4b8b6c762`, compared like W01's two files and added to the
   multi-writer list (the later owner of the dashboard folder rolls back by pre-image).
2. The gate rule of D25 ("a gate run between 00:00 and 00:25 WIB accepts exactly the one dashboard
   test") can end: no failure is accepted by name from now on.
3. Optional: whether a gate row (W58, W89) repeats the sweep at (i), (iii), (v) for the tests added
   after this row. The commands are in section 12 of the output document; about 90 s per instant for
   the three suites.
4. Optional: whether the residual list is pinned in advance by a later row. This row did not, by its rule.

## Blockers

None.
