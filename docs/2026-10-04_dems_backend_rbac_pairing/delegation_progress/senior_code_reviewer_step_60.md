# Delegation progress — senior-code-reviewer, step 60 (plan row W38, checkpoint CP-B1)

- **Status:** complete
- **Date:** 2026-10-04, 14:16 to 14:40 WIB
- **Verdict:** PASS WITH FIXES — 26 findings: 1 Blocker, 2 High, 10 Medium, 9 Low, 4 Info
- **Open blockers:** 1 (CPB1-1, owning row W28; before W58)

## Files created

| File | Purpose |
|---|---|
| `gateway_check/04_cp_backend_foundation.md` | The report (Tier 2) |
| `delegation_progress/senior_code_reviewer_step_60.md` | This file |

No source file, no test file and no shared tracking file was edited. `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md` and `decisions/decisions.md` were not written (parallel run; the controller synthesises them).

## Commands run (workspace root, no `cd`, no database, no port)

| Time | Command | Result |
|---|---|---|
| 14:22:37 | `npm run typecheck -w @dems/core-server` | exit 0 |
| 14:22:40 | `npm run lint -w @dems/core-server` | exit 0 |
| 14:22:43 | `npm run test -w @dems/core-server -- --maxWorkers=2` | 77 files / 1,992 tests, exit 0 |
| 14:31:38 | one scratch vitest probe under `$TMPDIR` (logger options + `DrizzleQueryError`) | output in the report, CPB1-2 |
| 14:32:09 | the unit command with `src/plugins/permission-guard/__tests__/guard.test.ts` | 18 failed / 11 passed, exit 1 |
| 14:32:37 | whole unit project | 3 files / 20 tests failed of 83 / 2,168, exit 1 (all W28's; CPB1-1) |
| 14:35:25 | typecheck, lint | typecheck exit 2 with one error in `src/modules/admin/__tests__/rule.test.ts` (in flight, W33); lint two warnings in `src/modules/admin/__tests__/` (in flight) |

Scratch files under `$TMPDIR` were removed (only those this review created). `tsx` could not be used for the probe inside the sandbox (its IPC pipe is refused, as D62 DN-9 records); the probe ran through vitest instead, with no bypass.

## Findings by severity

- **Blocker:** CPB1-1 — three test files of the guard row pin which operations are registered; 20 unit tests red since the module rows register routes (reproduced); two database test files will fail the same way (by reading).
- **High:** CPB1-2 — an error logged under a key other than `err` writes statement, parameters and the server's DETAIL (reproduced; no foundation call does it today). CPB1-3 — F53: no `search_path` on the runtime pool; option (d) confirmed feasible, with a per-unit pin and a static guard; option (a) is weaker than recorded.
- **Medium:** CPB1-4 unit statement guard is first-keyword only; CPB1-5 `replace` is test-only by a regular expression and a replaced stage 6 lets the server start; CPB1-6 a connection lost in a unit answers 500; CPB1-7 `describeError` loses the SQLSTATE of wrapped errors, four copies of the helper; CPB1-8 the 503-on-read block exists twice and is not offered to modules; CPB1-9 `ApiFailure.code` is a string; CPB1-10 plugins import a module, cycle authenticate / identity; CPB1-11 the store's place; CPB1-12 test support shared from `__tests__` folders with a cycle; CPB1-13 database tests pin whole lists; CPB1-14, CPB1-15 two timing-sensitive tests.
- **Low / Info:** CPB1-16 to CPB1-26 (the report, section 4.4).

## Decisions for the controller

Listed in the report, section 11: the owner of the blocker fix; the logger change; F53 option (d) with two additions; the ruling on `app.ts` for `replace`; the six design answers (D67 DN-5 confirmed; store to `src/db/store/`; one API-7 hook in the engine unit; `windows.ts` to `src/core/`; the route walk stays in the boot step; the identity route hooks go and two handler calls stay); the D12 inventory; two additions to the standing rules.

## Deviations from the agent's standard workflow

- The plan file and an implementation report were not updated in place: the brief of this parallel run forbids writes to shared files.
- The skill `code-review-senior` was not loaded as a tool call; its six phases were followed by hand (structure, dependency impact, duplication, maintainability, reference integrity, challenge and report).
- The context graph was not queried: the import map was built by one script over all relative imports, which gives file and line for every edge.

## Not verified

Everything that needs PostgreSQL (no database test was run): the database half of CPB1-1, and CPB1-3, 4, 6, 13, 14, 15 are by reading.
