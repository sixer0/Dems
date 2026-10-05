---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: coder-execution (tier R)
blueprint_row: 45 (plan W23, request guards)
date: 2026-10-04
status: complete
evidence_tier: 3
---

# coder-execution progress: step 45 (W23, request guards)

Status: **complete** (09:35, after the follow-up of decision D52; it was `needs-review` at 09:30).
The Origin guard, the throttle and the denial budget are built and tested: the row's own command
exits 0 with 345 tests in 5 files. The one open clause, "the whole `unit` project still passes",
is met since the follow-up: the controller authorised two by-design changes in two test files of
the scaffold (W08), which asserted the behaviour of the stubs this row replaced. The whole `unit`
project is now 979 passed in 31 files, 0 failed, 0 skipped.

The sections below the follow-up are the report of 09:30 and are left as written.

## Follow-up of decision D52 (09:31 to 09:35)

Rulings received: DN-2 to DN-6 accepted, DN-7 noted, DN-8 to the security review, DN-1 and DN-9
to apply now. Applied; full record in `implementation/23_request_guards.md`, section 16.

Files updated, exactly the two that were authorised, plus the two documents:

- `apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts`: the title at line 236
  corrected (DN-9); two comment lines with the standing rule added at 247 and 248; the one
  assertion that pinned `app.originDecision` as unimplemented removed (old line 253). The
  assertions for W21, W24 and W26 are untouched. `git hash-object`:
  `b7f56e8b9122343db81c09a6e626cbb688e375b6`.
- `apps/core-server/src/plugins/logger/__tests__/log-capture.test.ts`: four lines added after
  `await app.ready();` (one comment; `originGuard`, `authenticate` and `throttle` replaced by
  no-ops on the file's app). No test of the file needs a guard to be active; the test that builds
  its own second app keeps the real stages 3 and 5 and passes with them. `git hash-object`:
  `57642327a9ddba8b2fde5daf878b92b43790849b`.
- `implementation/23_request_guards.md`: section 16 appended; the status in the front matter
  changed to `complete`.
- This file.

Pre-images (git-ignored): `.cache/rollback/W23b.readiness.test.ts.pre`,
`.cache/rollback/W23b.log-capture.test.ts.pre`.

Totals after the follow-up:

```
$ npm run test -w @dems/core-server -- --maxWorkers=2
 Test Files  31 passed (31)
      Tests  979 passed (979)
   Start at  09:32:21
exit=0

$ npm run test -w @dems/core-server -- --maxWorkers=2 src/plugins/origin-guard src/plugins/throttle
 Test Files  5 passed (5)
      Tests  345 passed (345)
   Start at  09:32:24
exit=0

$ npm run lint -w @dems/core-server        exit=0
$ npm run typecheck -w @dems/core-server   exit=0   (the migration writer's file is fixed; also exit 0 with test/db excluded)
```

Skipped tests: **none now** (979 `passed`, 0 `failed`, 0 `pending`, 0 `todo` in the JSON report;
no `.skip`, `.todo` or `.only` in a `unit` test file). The 18 reported as skipped at 09:29 were
the 18 tests of `src/plugins/logger/__tests__/log-capture.test.ts` (W08's file, not this row's):
its `beforeAll` hook failed on the status expectation at line 89, so the runner ran none of the
file's tests and reported each as skipped, with the file as a failed suite. They all run and pass
now. No test of this row's five files was skipped in any run.

Ledger: 979 = 526 (baseline) + 345 (this row) + 38 + 70 (two files of the migration writer:
`test/db/contract-inventory.test.ts`, `test/db/commands.test.ts`).

One observation, no change made: `log-capture.test.ts:103` searches the log for the text
`Bearer`; the Origin guard's refusal line has a field named `hasBearer`. It is never written in
that file now. A later log test that keeps stage 3 active and provokes a refusal should search for
a header value, not for that substring, or the field is renamed in a later slot.

---

# The report of 09:30

Output document: `implementation/23_request_guards.md` (evidence for every line below).

No port was bound, no server was started, no database was contacted, no package was installed,
no process was left running.

## Files created or updated

Workspace (the owned write paths of W23), 12 files:

- `apps/core-server/src/plugins/origin-guard/index.ts` (replaces the stub)
- `apps/core-server/src/plugins/origin-guard/origin-decision.ts`
- `apps/core-server/src/plugins/origin-guard/__tests__/origin-decision.test.ts`
- `apps/core-server/src/plugins/origin-guard/__tests__/origin-guard.test.ts`
- `apps/core-server/src/plugins/origin-guard/__tests__/guard-test-app.ts` (test support)
- `apps/core-server/src/plugins/throttle/index.ts` (replaces the stub)
- `apps/core-server/src/plugins/throttle/limits.ts`
- `apps/core-server/src/plugins/throttle/windows.ts`
- `apps/core-server/src/plugins/throttle/denial-budget.ts`
- `apps/core-server/src/plugins/throttle/__tests__/windows-limits.test.ts`
- `apps/core-server/src/plugins/throttle/__tests__/throttle.test.ts`
- `apps/core-server/src/plugins/throttle/__tests__/denial-budget.test.ts`

Git-ignored: `.cache/rollback/W23.pre.patch` (P23: the two stubs as they were).

Task folder:

- `implementation/23_request_guards.md`
- `delegation_progress/coder_execution_step_45.md` (this file)

Not written (parallel run): `status_tasks.md`, `delegation_progress_report.md`,
`decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md`.

Not touched: `apps/core-server/src/app.ts`, `index.ts`, `config.ts`, every other plugin and
module, `apps/core-server/test/**`, `apps/core-server/src/db/**`, `packages/shared/**`, every
`package.json`, the lockfile.

Temporary files, created and removed again inside this row's folder: two patched copies of W08's
test files (section 9 of the output document) and one file that compiled the usage example.

## Milestones

| Time (WIB) | Milestone |
|---|---|
| 09:00 | Inputs read. Baseline `@dems/core-server` `unit`: 526 passed in 24 files, exit 0 |
| 09:06 | Rollback pre-image of the two stubs saved: `.cache/rollback/W23.pre.patch` (115 lines) |
| 09:09 | Both stubs replaced; workspace typecheck exit 0. First whole `unit` run: the two W08 files fail, everything else passes |
| 09:19 | Tests written: 5 files, 345 tests, exit 0. The two proposed W08 patches proven on temporary copies: 2 files, 48 tests passed |
| 09:21 | Three repeat runs: 345 passed each. 30 of 30 mutations detected; sources restored |
| 09:27 | Final runs. Row command: 345 passed, exit 0. Lint exit 0. Whole `unit`: 890 passed, 1 failed, 18 skipped of 909 in 30 files. Workspace typecheck exit 2 in `test/db/catalog.db.test.ts` (W17, in flight); exit 0 without `test/db` |
| 09:30 | Output document and this file written |

## Blocker (closed at 09:35 by the follow-up above)

**The two scaffold tests (DN-1).** Neither file is in this row's write paths.

1. `apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts:253` asserts that
   `app.originDecision` is not implemented (`.toThrow('plan row W23')`). Patch: delete line 253.
2. `apps/core-server/src/plugins/logger/__tests__/log-capture.test.ts:89`: the file sends this
   instance's cookie and a bearer value together on two POSTs without an `Origin`, which the
   specification answers with 403. Patch: after `await app.ready();` in `beforeAll`, add
   `app.stages.replace('originGuard', () => {});`, `app.stages.replace('authenticate', () => {});`
   and `app.stages.replace('throttle', () => {});`.

With both patches the two files pass (48 tests) and the `unit` project is expected at 909 passed.

## The seam `denialBudget`, for the rows that write an audited refusal

```ts
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ApiFailure } from '../../plugins/error-envelope';

export async function refuseAndAudit(app: FastifyInstance, request: FastifyRequest, operatorId: string): Promise<never> {
  // 1. BEFORE the row. Throws 429 RATE_LIMITED when the key already holds 20 refusals in its window.
  await app.denialBudget.consume(request);
  // 2. The row, in its unit of work.
  await app.pipeline.run('rbac.denied', (unit) =>
    app.auditWriter.append(unit, {
      type: 'ACCESS_DENIED',
      actorId: operatorId,
      deviceId: null,
      details: { operationId: 'startSession', permission: 'SESSION_START', role: 'TECHNICIAN' },
    }),
  );
  // 3. The refusal.
  throw new ApiFailure(403, 'NOT_PERMITTED', 'Your role does not allow this action. The attempt was audited.');
}
```

It resolves for the first 20 refusals of a key within 60 s (write the row, refuse) and throws the
429 from the 21st (let it propagate, write no row). Call it before the row, once per row; do not
catch it. For tests: `throttleControl(app).reset()`, `.reset(key)`, `.inspect(key)`, or advance
the server clock by 60 s.

## Findings (for the controller to number)

1. SA-14 holds: the budget is a `rate-limiter-flexible` memory limiter that a test can reset or
   advance. Neither limiter library takes a clock (both read the system time), so the window is
   named in the counter's key and opened and closed by `app.clock`.
2. `@fastify/rate-limit` is driven through `app.createRateLimit()`, which returns the outcome; the
   handler form would add `x-ratelimit-*` headers to every answer.
3. Two test files of the scaffold assert stub behaviour (the blocker). The same test in
   `readiness.test.ts` will stop W21 (lines 250 to 252), W24 (254, 255) and W26 (256, 257).
4. The upgrade request passes the stage hook, so stage 3 applies the upgrade table and stage 5
   counts upgrades without any code in the realtime channel.
5. A request refused at stage 3 or 4 is not counted by the throttle (the stage order of the
   specification): a flood with a foreign `Origin` is visible only in the log.
6. The 20 rows of AC-B-80 and of each burst of AC-B-76 use a key's whole budget: the next REST
   request of that key answers 429 until the clock is 60 s past the key's first refusal.
7. With the real guards, every test app answers 429 to the 31st request without a principal
   within 60 s of the server clock.
8. A backwards step of the wall clock can end a library counter before its window ends, by at
   most the size of the step. Not handled.
9. The static readings of the mobile client and the measured browser facts fit the table.
10. The workspace typecheck is red in one file of W17 (`test/db/catalog.db.test.ts`), in flight.
11. `readiness.test.ts:236-245` ("a budget that counts nothing") still passes but its title is stale.

## Deviations

1. `consume` is called before the row and throws the 429; the stub's comment said after the row
   and "never throws". The type is unchanged.
2. `app.createRateLimit()` instead of `app.rateLimit()`.
3. `windows.ts`: the window a key is in, by the server clock (about 30 lines of logic; not a counter).
4. The throttle's constants are in `plugins/throttle/limits.ts`; `config.ts` is frozen and holds none.
5. Stage 3 applies the upgrade table to a request with an `Upgrade` header.
6. `ThrottleControl` and `throttleControl(app)` exported for tests; `DenialBudget` stays one function.
7. Two log lines of this row besides the request line.
8. The shared tracking files were not written (parallel run).
9. The clause "the whole `unit` project still passes" is not met (the blocker).

## Decisions needed

| ID | Question | Recommendation |
|---|---|---|
| DN-1 (blocking) | The two patches in W08's test files | Accept as recorded by-design test changes and have them applied; re-run the `unit` project |
| DN-2 | `consume` before the row, throwing the 429 | Accept; pass section 6.2 of the output document to W24, W28, W32, W41 |
| DN-3 | The window by the server clock | Accept |
| DN-4 | The constants outside `config.ts` | Accept |
| DN-5 | Stage 3 decides the Origin of an upgrade | Accept; tell W42 not to decide it again and to test the handshake |
| DN-6 | A preflight answers 405 (404 for an unknown path) from routing | Accept |
| DN-7 | Tests of other rows and the real guards | Add section 6.3 of the output document to the briefs of W21, W24, W28, W32, W41, W42, W47 |
| DN-8 | A flood with a foreign `Origin` is not throttled | Leave to the security review W45 |
| DN-9 | The stale title in `readiness.test.ts:236` | Fix with DN-1 or leave |

## Verification (quoted in full in the output document, sections 8 and 15)

```
$ npm run test -w @dems/core-server -- --maxWorkers=2 src/plugins/origin-guard src/plugins/throttle
 Test Files  5 passed (5)
      Tests  345 passed (345)
   Start at  09:28:57
exit=0

$ npm run test -w @dems/core-server -- --maxWorkers=2
 Test Files  2 failed | 28 passed (30)
      Tests  1 failed | 890 passed | 18 skipped (909)
   Start at  09:29:00
exit=1      (the two W08 files of the blocker; nothing else)

$ npm run lint -w @dems/core-server
exit=0

$ npm run typecheck -w @dems/core-server
test/db/catalog.db.test.ts(198,21): error TS2352: …
exit=2      (a file of W17; 0 errors outside test/db)
```

Test ledger (P24), `@dems/core-server` `unit`: before 526 in 24 files; after 909 in 30 files;
this row +345 in 5 files (`origin-decision.test.ts` 108, `origin-guard.test.ts` 151,
`windows-limits.test.ts` 35, `throttle.test.ts` 27, `denial-budget.test.ts` 24). The other +38
is `test/db/contract-inventory.test.ts` of W17.
