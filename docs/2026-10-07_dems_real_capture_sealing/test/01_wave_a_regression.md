---
task_id: dems_real_capture_sealing
blueprint_row: 27
milestone: M0
class: A
tier: 3
date: 2026-10-07
agent: test-expert
status: completed
gate: 5/5 workspaces exit 0 at or above every ledger floor; every added test named; root typecheck + lint exit 0
---

# Wave-A regression on the post-B2 tree (blueprint row 27)

All commands run from the repository root `/Users/gsp-budi/Documents/DEMS`, each suite exactly
once (regression run, not a device check), `--maxWorkers=2` everywhere per D12(c) — vitest honours
it (row 20 §5 correction of D8 item 6) and mobile jest takes the same flag. No file was edited
during this row; the run is report-only.

## 1. Verdict summary

| Gate item (Verification column, `identification/02_structured.md:207`) | Required | Observed | Verdict |
|---|---|---|---|
| 5/5 workspaces exit 0 | 5 exit 0 | shared 0, cs-unit 0, cs-db 0, core-web 0, mobile 0 | PASS |
| shared >= 71/1,851 | 71 / 1,851 | 71 / 1,851 | PASS |
| core-server unit >= 160/3,954 | 160 / 3,954 | 160 / 3,954 | PASS |
| core-server db >= 124/1,751 | 124 / 1,751 | 124 / 1,751 | PASS |
| core-web >= 117/1,495 | 117 / 1,495 | 117 / 1,495 | PASS |
| mobile >= 192/1,988 | 192 / 1,988 | 193 / 1,994 | PASS (+1 suite / +6 tests = the row-22 additions, every one named in §6) |
| every added test named | all | 6 tests named with file:line (§6) | PASS |
| root typecheck exit 0 | 0 | 0 (5/5 workspaces clean) | PASS |
| root lint exit 0 | 0 | 0 (5/5 workspaces clean) | PASS |
| live audit view recorded (R24-01) | re-record, not quote 49 | high 53 live-full / 49 lock-full (advisory-DB drift both directions), `<= 53` holds on every view, 0 unexpected roots | PASS |

**5/5 gate: PASS.** No suite failed; no re-run was needed anywhere; nothing was edited to make
anything pass.

## 2. Pre-flight state

| Item | Command | Quoted result |
|---|---|---|
| node | `node -v` | `v26.8.2` |
| npm | `npm -v` | `11.19.1` |
| host load | `uptime` | `21:56  up 6 days,  5:09, 2 users, load averages: 2.73 3.40 4.28` (moderate, consistent with other agents active; no effect observed — every suite passed first run) |
| PostgreSQL | `npm run pg:status` | `server     RUNNING, PID 47413 (postmaster.pid: 127.0.0.1:4432, status "ready", connect probe: open)` … `pg:status: OK, running` (exit 0; `pg:start` NOT needed and not run) |

`git status --porcelain` (pre-flight, verbatim, 25 lines — exactly the expected post-B2/post-row-22
set: `M package.json`, `M package-lock.json`, 12 gated sibling test edits, `M recording-elapsed.ts`,
untracked `live-rc1-elapsed-stop-hold.test.tsx`, controller docs, task-folder artifacts; nothing else):

```
 M apps/core-web/src/test/live-paired-devices-issue.test.tsx
 M apps/mobile/src/features/devices/devices-screen.test.tsx
 M apps/mobile/src/features/evidence/evidence-detail.test.tsx
 M apps/mobile/src/features/evidence/evidence-more-menu-title.test.tsx
 M apps/mobile/src/features/evidence/play-sheet.test.tsx
 M apps/mobile/src/features/more/more-live.test.tsx
 M apps/mobile/src/features/session-live/elapsed-ticker.test.ts
 M apps/mobile/src/features/session-live/live-session-live-link.test.tsx
 M apps/mobile/src/features/session-new/live-session-new-followups.test.tsx
 M apps/mobile/src/features/settings/live-settings-boundary.test.tsx
 M apps/mobile/src/features/storage/storage-screen.test.tsx
 M apps/mobile/src/navigation/__tests__/chrome-lost-updates.test.tsx
 M apps/mobile/src/runtime/recording-elapsed.ts
 M docs/2026-10-07_dems_real_capture_sealing/decisions/decisions.md
 M docs/2026-10-07_dems_real_capture_sealing/delegation_progress_report.md
 M docs/2026-10-07_dems_real_capture_sealing/status_tasks.md
 M package-lock.json
 M package.json
?? apps/mobile/src/features/session-live/live-rc1-elapsed-stop-hold.test.tsx
?? docs/2026-10-07_dems_real_capture_sealing/delegation_progress/
?? docs/2026-10-07_dems_real_capture_sealing/gateway_check/
?? docs/2026-10-07_dems_real_capture_sealing/implementation/
?? docs/2026-10-07_dems_real_capture_sealing/initialization/
?? docs/2026-10-07_dems_real_capture_sealing/masterplan/
?? docs/2026-10-07_dems_real_capture_sealing/research/
```

Note on the gated sibling count: 12 modified test files = the 11 B10 files of the row-25 review
("The B10 wave-A diff is **11 changed `*.test.tsx` files**, not 6", `gateway_check/02_b10_test_hygiene_review.md` §8)
plus row 22's `elapsed-ticker.test.ts` edit.

## 3. Per-suite results (each run ONCE)

| Workspace | Command (from root) | Exit | Suites (files) | Tests | Time | Ledger floor | Verdict |
|---|---|---|---|---|---|---|---|
| @dems/shared | `npm run test -w @dems/shared -- --maxWorkers=2` | 0 | 71 passed (71) | 1,851 passed (1,851) | 8.29 s | 71 / 1,851 | at floor |
| @dems/core-server unit | `npm run test -w @dems/core-server -- --maxWorkers=2` | 0 | 160 passed (160) | 3,954 passed (3,954) | 29.24 s | 160 / 3,954 | at floor |
| @dems/core-server db | `npm run test:db -w @dems/core-server -- --maxWorkers=2` | 0 | 124 passed (124) | 1,751 passed (1,751) | 122.67 s | 124 / 1,751 | at floor |
| @dems/core-web | `npm run test -w @dems/core-web -- --maxWorkers=2` | 0 | 117 passed (117) | 1,495 passed (1,495) | 170.33 s | 117 / 1,495 | at floor |
| @dems/mobile | `npm run test -w @dems/mobile -- --maxWorkers=2` | 0 | 193 passed (193) | 1,994 passed (1,994) | 234.612 s | 192 / 1,988 | floor + 1 suite / + 6 tests (row-22 additions, §6) |

Runner script lines confirming the flag actually reached each runner (verbatim `>` lines from the npm banners):

```
shared.log:  > vitest run --maxWorkers=2
cs_unit.log: > vitest run --project unit --maxWorkers=2
cs_db.log:   > vitest run --project db --maxWorkers=2
core_web.log:> vitest run --maxWorkers=2
mobile.log:  > jest --maxWorkers=2
```

Summary blocks, quoted verbatim from each run's log:

**shared** (vitest 5.0.3, `packages/shared`):

```
 Test Files  71 passed (71)
      Tests  1851 passed (1851)
   Start at  21:56:35
   Duration  8.29s (tests 58%, import 30%, transform 11%, worker 1%)
SHARED_EXIT=0
```

**core-server unit** (`vitest run --project unit`):

```
 Test Files  160 passed (160)
      Tests  3954 passed (3954)
   Start at  21:56:51
   Duration  29.24s (import 60%, tests 35%, transform 4%, worker 1%)
CSU_EXIT=0
```

**core-server db** (`vitest run --project db`, against PG 127.0.0.1:4432; clean self-managed teardown):

```
 Test Files  124 passed (124)
      Tests  1751 passed (1751)
   Start at  21:57:30
   Duration  122.67s (tests 82%, import 17%, transform 1%)
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 8 database(s) in 162 ms; 0 remain with the run prefix dems_test_local_tmjljuvc_
CSD_EXIT=0
```

**core-web** (vitest, jsdom console noise pre-existing — see §10):

```
 Test Files  117 passed (117)
      Tests  1495 passed (1495)
   Start at  21:59:42
   Duration  170.33s (tests 68%, import 16%, environment 11%, setup 4%, transform 2%)
WEB_EXIT=0
```

**mobile** (jest; PASS/FAIL log cross-check `grep -cE "^PASS"` → 193, `grep -cE "^FAIL"` → 0;
the `worker force exited` notice is the documented residual — §10):

```
A worker process has failed to exit gracefully and has been force exited. This is likely caused by tests leaking due to improper teardown. Try running with --detectOpenHandles to find leaks. Active timers can also cause this, ensure that .unref() was called on them.

Test Suites: 193 passed, 193 total
Tests:       1994 passed, 1994 total
Snapshots:   0 total
Time:        234.612 s
Ran all test suites.
MOB_EXIT=0
```

## 4. Counts vs floors (the 5/5 ledger gate)

| Workspace | Ledger floor (suites / tests) | Actual (suites / tests) | Delta | Verdict |
|---|---|---|---|---|
| shared | 71 / 1,851 | 71 / 1,851 | 0 / 0 | >= floor, PASS |
| core-server unit | 160 / 3,954 | 160 / 3,954 | 0 / 0 | >= floor, PASS |
| core-server db | 124 / 1,751 | 124 / 1,751 | 0 / 0 | >= floor, PASS |
| core-web | 117 / 1,495 | 117 / 1,495 | 0 / 0 | >= floor, PASS |
| mobile | 192 / 1,988 | 193 / 1,994 | +1 / +6 | >= floor, PASS (delta = row-22 tests, all named in §6; the D254 ledger predates row 22) |

Ledger source: `identification/02_structured.md:39` ("Test ledger | shared 71/1,851; core-server
unit 160/3,954; db 124/1,751; core-web 117/1,495; mobile 192/1,988").

**Gate verdict: 5/5 workspaces exit 0 with every count at or above its floor. PASS.**

## 5. Flake / re-run log

None. All five suites passed on their first and only run; no re-run was performed and none was
needed. Host load at pre-flight was moderate (2.73 1-min avg) and did not produce a flake.

## 6. Added tests vs the D254/ledger baseline (every added test named)

The only count deltas against the ledger are in `@dems/mobile`: +1 suite, +6 tests, produced by
rows 22 and the row-22 follow-up (D14/W9). `delegation_progress/coder-execution__row22_followup.md:32`
predicted exactly this: "the tree's delta vs that ledger is now +6 tests (row 22's 3-file
additions + these 3) in +1 suite (row 22's file)".

### 6.1 New suite — `apps/mobile/src/features/session-live/live-rc1-elapsed-stop-hold.test.tsx` (4 tests, file untracked/new)

Names and file:line (verbatim from `grep -n "it(" <file>`):

| # | Line | Test name | Origin |
|---|---|---|---|
| 1 | `:96` | `stop learned 7 s late while the ticker was 7 s ahead of the held store clock: the drawn duration keeps the larger value` | row 22 (RC-1 RED/GREEN, test 1) |
| 2 | `:117` | `the held value freezes at the stop: further Core-clock time does NOT push the duration past the stop` | row 22 (test 2) |
| 3 | `:143` | `SIMULATED (no Core clock): the hub draws the store value only, and it freezes at `stoppedAt` — the hold does not apply` | row 22 (test 3) |
| 4 | `:164` | `session boundary: a NEW session after a stop does not inherit the held second, it counts from its own start` | row-22 follow-up (closes review F2, `gateway_check/03_rc1_review.md:59`) |

Both this file and its 4-test count were independently re-run green by the row-26 reviewer
("3/3 passed" at review time + the follow-up test 4) and pass in this full run
(`PASS src/features/session-live/live-rc1-elapsed-stop-hold.test.tsx`).

### 6.2 Extended suite — `apps/mobile/src/features/session-live/elapsed-ticker.test.ts` (+2 tests)

Path correction recorded: the delegation prompt suggested `apps/mobile/src/runtime/__tests__/elapsed-ticker.test.ts`;
the file's actual path is `apps/mobile/src/features/session-live/elapsed-ticker.test.ts` (verified
by `git status` and the jest PASS line). The unit tests of `createElapsedTicker` live there.

| # | Line | Test name | Origin |
|---|---|---|---|
| 1 | `:91` | `RC-1: freeze() stops the advancement at the last drawn second and drops the armed timer` | row-22 follow-up (closes review F3, `gateway_check/03_rc1_review.md:60`) |
| 2 | `:108` | `RC-1: freeze() is idempotent, and a subscribe after a freeze keeps drawing the frozen second` | row-22 follow-up (closes review F3) |

`PASS src/features/session-live/elapsed-ticker.test.ts` in the full run. File total: 6 tests
(4 at HEAD, +2 above).

### 6.3 Removed tests: NONE (verified per file)

`it`/`test` declaration counts, `git show HEAD:<file>` vs working tree, verbatim command output:

```
apps/core-web/src/test/live-paired-devices-issue.test.tsx            HEAD=20 WT=20
apps/mobile/src/features/devices/devices-screen.test.tsx             HEAD=11 WT=11
apps/mobile/src/features/evidence/evidence-detail.test.tsx           HEAD=7  WT=7
apps/mobile/src/features/evidence/evidence-more-menu-title.test.tsx  HEAD=3  WT=3
apps/mobile/src/features/evidence/play-sheet.test.tsx                HEAD=5  WT=5
apps/mobile/src/features/more/more-live.test.tsx                     HEAD=5  WT=5
apps/mobile/src/features/session-live/elapsed-ticker.test.ts         HEAD=4  WT=6   (+2, §6.2)
apps/mobile/src/features/session-live/live-session-live-link.test.tsx HEAD=14 WT=14
apps/mobile/src/features/session-new/live-session-new-followups.test.tsx HEAD=8 WT=8
apps/mobile/src/features/settings/live-settings-boundary.test.tsx    HEAD=8  WT=8
apps/mobile/src/features/storage/storage-screen.test.tsx             HEAD=7  WT=7
apps/mobile/src/navigation/__tests__/chrome-lost-updates.test.tsx    HEAD=4  WT=4
apps/mobile/src/features/session-live/live-rc1-elapsed-stop-hold.test.tsx (new file)   WT=4 (+4, §6.1)
```

Cross-check against the rows' own claims: rows 17-21 converted real waits to fake timers without
touching test counts (row 17 "3/3 (8 tests)", row 18 "3/3 (14 tests)", row 20 "3/3 (20 tests)",
row 21 "3/3 (4 tests)" — D12(b), D13(b), status ledger rows 17/18/20/21); row 19 "removed only
timeouts, no tests" (status ledger: "7-file RC-8 list, 0 overrides … 40_000 removed"), and its
full-suite run sat at 192/1,988 (`delegation_progress/coder-execution__row19.md:15`). Every
before/after pair above is equal except the two row-22 additions. **Removed tests: 0.**

Arithmetic tie-out: 1,988 (D254 ledger) + 4 (§6.1) + 2 (§6.2) = 1,994 observed; 192 + 1 new suite
= 193 observed. Exact.

## 7. Optional extras (outside the 5/5 gate; both run because the five main suites were green)

| Suite | Command | Exit | Result | Floor | Verdict |
|---|---|---|---|---|---|
| pg-scripts | `npm run test:pg-scripts` | 0 | `ℹ tests 57 / ℹ pass 57 / ℹ fail 0 / ℹ duration_ms 227.265792` | 57 node tests | at floor |
| mock-core | `npm run test -w @dems/mock-core -- --maxWorkers=2` | 0 | `Test Files  4 passed (4)` / `Tests  19 passed (19)` / `Duration  3.87s` | 4 files / 19 tests | at floor (ran tests only; mock-core not edited) |

## 8. Root typecheck + lint (exit 0, both)

`npm run typecheck` — verbatim tail (`packages/shared`, `core-server`, `core-web`, `mobile`,
`mock-core` all run):

```
> @dems/mock-core@0.1.0 typecheck
> tsc --noEmit

TC_EXIT=0
```

(No diagnostics emitted between the five `> tsc --noEmit` / `> tsc -b` banners; 5/5 workspaces clean.)

`npm run lint` — verbatim tail (`oxlint` x4 workspaces + `eslint .` for mobile):

```
> @dems/mock-core@0.1.0 lint
> oxlint

LINT_EXIT=0
```

(No rule violations emitted; 5/5 workspaces clean.)

## 9. Live audit view (R24-01: re-record the live count, do not quote row 23's 49)

All four views captured this session (`npm audit --json`, registry reads only). `npm audit` exits
1 whenever advisories exist — that is the vulnerability-present signal, not a command failure;
exit 1 was observed for all views.

| View | Command | critical | high | moderate | low | total |
|---|---|---|---|---|---|---|
| LIVE full (installed tree) | `npm audit --json` | 0 | **53** | 20 | 7 | 80 |
| LIVE `--omit=dev` | `npm audit --json --omit=dev` | 0 | **46** | 16 | 7 | 69 |
| LOCK full | `npm audit --json --package-lock-only` | 0 | 49 | 20 | 7 | 76 |
| LOCK `--omit=dev` | `npm audit --json --omit=dev --package-lock-only` | 0 | 46 | 16 | 7 | 69 |

Parsed summary lines (verbatim from `node -e` over the saved JSON):

```
live-full: {"info":0,"low":7,"moderate":20,"high":53,"critical":0,"total":80}
live-omit-dev: {"info":0,"low":7,"moderate":16,"high":46,"critical":0,"total":69}
lock-full: {"info":0,"low":7,"moderate":20,"high":49,"critical":0,"total":76}
lock-omit-dev: {"info":0,"low":7,"moderate":16,"high":46,"critical":0,"total":69}
```

Root-cause census of the 53 live high entries (parsed `via[]`, verbatim):

```
HIGH_ENTRIES=53
ROOT: braces -> braces vulnerable to stack-exhaustion denial of service through deeply nested patterns (GHSA-vfj7-8cjw-p6xm, <=3.0.3)
ROOT: node-forge -> node-forge RSA PKCS#1 v1.5 signature verification accepts extra nested DigestAlgorithm elements (GHSA-86w9-cpqp-85rv, <=1.4.0)
PROPAGATION_ONLY=51
undici_present=false
```

Reading vs the gate:

- The recorded live view for downstream gates (R24-01 instruction to rows 27/39) is
  **53 (live full)**, within the `<= 53` gate — matching the delegation's expectation "expected
  about 53 / 50 (drift)".
- `--omit=dev` live reads **46**; row 24's 50 was its `--package-lock-only --omit=dev` view, and
  today the same lock views read **49 / 46**. The live advisory database has re-drifted since the
  row-24 snapshot (53 -> 49 on the lock projection; the installed-tree projection stays 53). This
  is the same registry-drift phenomenon row 5 anticipated as A-R5-1 — no package moved (lockfile
  unchanged this wave, §2 snapshot identical §11), no new advisory class, `undici` remains absent
  (the B2 scoped override holds), and the two accepted-risk roots (braces, node-forge — no
  published fix) plus 51 propagation-only entries are exactly row 24's census shape (1 cleared / 2
  accepted-risk / 51 propagation / 0 unexpected).
- Nothing on this row may change dependencies or code; the drift observation is recorded for
  row 39's M0 gate to re-confirm at its own run time.

## 10. Known issues / residual observations

| # | Observation | Classification |
|---|---|---|
| 1 | mobile jest printed `A worker process has failed to exit gracefully … force exited` while **exiting 0** (`MOB_EXIT=0`). Pre-existing, accepted since baseline as N-4 / C1-R1 (`docs/2026-10-04_dems_backend_rbac_pairing/initialization/02_baseline_gate.md:276`), caused by the W87-F1 unref'd 2 s flush timer, documented in this task at `implementation/04_b10e_rc8_redundant_timeouts.md:103`. Not a failure and not touched (exit code 0 is the ledger contract). | documented residual, exit 0 |
| 2 | core-web console noise (all 117 files pass): `Not implemented: HTMLMediaElement's pause() method` / `…play()…` / `Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package` — jsdom capability notices, pre-existing, unrelated to this wave. | noise, suite green |
| 3 | core-server db notices: `[FST_LIGHTMYREQUEST_DEP01] DeprecationWarning: You are accessing "request.connection", use "request.socket" instead.` — Fastify deprecation notice inside a passing suite, pre-existing. | noise, suite green |
| 4 | mobile log contains a stack-trace echo referencing `elapsed-ticker.test.ts:139/150` from the pre-existing W93-12 throw-and-continue test (`:129`), which intentionally logs an error; suite PASS. | noise, suite green |
| 5 | Row-25 follow-ups that persist by design and did not flake: `monitor-harness.waitForSheetExit` real sleep (2 mobile files) and `core-web pd-bed.clearToasts` 350 ms (`gateway_check/02_b10_test_hygiene_review.md:172`); no action taken, none needed. | watch item |

## 11. Post-state

`git status --porcelain` re-captured after the last command and diffed against the §2 snapshot:

```
$ diff <pre-flight snapshot> <post snapshot>
(no output; both files 25 lines, identical)
```

No source, test, config or lockfile file changed during the runs (test caches and the db
teardown left nothing in the tree; `[test:db] teardown: dropped 8 database(s) … 0 remain`).
The only writes by this row are the two task-folder files
(`test/01_wave_a_regression.md`, `delegation_progress/test-expert__row27.md`).

## 12. Constraint compliance

| Constraint | Status |
|---|---|
| Report-only (no edits outside the task folder) | satisfied — §11 diff empty; failing-test routing to producing rows not needed (0 failures) |
| Each suite exactly once (regression, not device check) | satisfied — §5, no re-runs |
| `--maxWorkers=2` on every workspace runner (D12c) | satisfied — §3 banner lines |
| PG via repo scripts only; `pg:start` only if DOWN | satisfied — status was RUNNING, nothing started/stopped |
| No emulators, no sudo, single writer per runner, SMART WMS untouched, `.data/pg*` untouched | satisfied — no emulator/AVD commands run; `pg:status` output read only (key names, never values) |
| Network | only `npm audit` registry reads (allowed) |
| Flakes | none (§5) |

---
*Generated: 2026-10-07 22:12 (host local; run window 21:56-22:10)*
*Last Updated: 2026-10-07 22:12*
