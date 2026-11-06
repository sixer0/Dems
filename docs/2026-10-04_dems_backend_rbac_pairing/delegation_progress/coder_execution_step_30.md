---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: coder-execution (tier R)
blueprint_row: 30 (plan W08, backend scaffold and health)
date: 2026-10-04
status: complete (step 30, the touch-ups after contract A, and the request ID header of rulings D55 and D57)
evidence_tier: 3
---

# coder-execution progress: step 30 (W08, backend scaffold and health)

Status: **complete**. Every deliverable exists and every check of the row passes. Nothing blocks
W17, W21, W23, W24 or any later backend row technically.

Output document: `implementation/08_backend_scaffold_health.md` (evidence for every line below).

No port was bound, no server was started, no database was contacted, no package was installed,
no process was left running.

## Files created or updated

Workspace (the owned write paths of W08), all new, 55 files:

- `apps/core-server/src/index.ts`, `src/app.ts`, `src/config.ts`
- `apps/core-server/src/plugins/config/`: `index.ts`, `load-config.ts`, `connection-file.ts`,
  `__tests__/load-config.test.ts`, `__tests__/test-config.ts`
- `apps/core-server/src/plugins/logger/`: `index.ts`, `logger-options.ts`, `log-controller.ts`,
  `request-log.ts`, `error-log.ts`, `__tests__/log-capture.test.ts`
- `apps/core-server/src/plugins/error-envelope/`: `index.ts`, `api-failure.ts`, `json-body.ts`,
  `route-table.ts`, `__tests__/error-envelope.test.ts`
- `apps/core-server/src/plugins/response-headers/`: `index.ts`, `__tests__/response-headers.test.ts`
- `apps/core-server/src/plugins/db/`: `index.ts`, `__tests__/db.test.ts`
- `apps/core-server/src/plugins/readiness/`: `index.ts`, `__tests__/readiness.test.ts`,
  `__tests__/incomplete-scaffold.test.ts`
- Stubs, one `index.ts` each: `src/plugins/{origin-guard,throttle,authenticate,permission-guard}/`,
  `src/{core,engine,realtime}/`,
  `src/modules/{identity,rbac,admin,pairing,sessions,evidence,devices,storage,network-time,security-audit,system,alerts,demo}/`
- `apps/core-server/src/modules/health/`: `index.ts`, `health-schema.ts`, `__tests__/health.test.ts`
- `apps/core-server/test/static/`: `scan.ts`, `credentials.test.ts`, `audit-protection.test.ts`,
  `network.test.ts`, `logging.test.ts`, `scaffold.test.ts`

Git-ignored: `.cache/rollback/W08.pre.patch` (P23; empty: no multi-writer path existed at `acaff20`).

Task folder:

- `implementation/08_backend_scaffold_health.md`
- `delegation_progress/coder_execution_step_30.md` (this file)

Not written (parallel run): `status_tasks.md`, `delegation_progress_report.md`,
`decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md`.

Not touched: `apps/mock-core/**`, `release/**`, `scripts/**`, `.data/**`, `packages/shared/**`,
every `package.json`, the lockfile, `apps/core-server/src/modules/identity/password-hash/**` (W09),
`apps/core-server/test/helpers/**` (W11).

## Milestones

| Time (WIB) | Milestone |
|---|---|
| 07:00 to 07:10 | Inputs read. Baseline: `@dems/core-server` `unit` 75 passed in 4 files (1 of W03, 74 of W09 in progress) |
| 07:03 to 07:10 | In-process probes of Fastify, helmet and `pg` (scratch scripts outside the repository): hook order, helmet's output, the answer to an undecodable URL, a pool at a closed port |
| 07:12 | Rollback pre-image saved (0 bytes) |
| 07:13 to 07:27 | Configuration, loader, logger, error envelope, response headers, pool, readiness, 20 stubs, health, app factory, entry point. Workspace typecheck exit 0 |
| 07:30 | The log-capture test failed on its first run and showed a real leak: an error logged without a text lends its message, with the raw URL, to the log line. Closed with a log-method hook; test green |
| 07:31 to 07:37 | Tests of the envelope, the headers, readiness and the stages, the pool, health; the five static guard files |
| 07:38 | Entry point run with a refused port: exit 1, one JSON line, no listener. Its error-log entries removed again |
| 07:39 to 07:42 | Root typecheck exit 0, root lint exit 0; protected-path diff empty; four identical test runs: 330 passed in 17 files |
| 07:45 | Output document written |

## Verification summary

| # | Check | Result |
|---|---|---|
| 1 | `npm run test -w @dems/core-server -- --maxWorkers=2` exits 0 | PASS: 330 passed in 17 files (255 in 13 files are this row's) |
| 2 | Health validates with `service: dems-core-server`, `version: 0.2.0` | PASS, against the local widened schema (CONTRACT-GAP-1) |
| 3 | Closed pool or closed port: 200 with `ready.database: false` | PASS |
| 4 | A refusal in `onRequest` wins over an invalid body | PASS (SA-01 holds) |
| 5 | Five headers of OR-9 on every answer, no `Strict-Transport-Security` | PASS, ten kinds of answer |
| 6 | Log capture holds no credential, body, query string or marker | PASS at level `trace`, eight markers |
| 7 | A credential file of mode 0644 stops the loader, no content printed | PASS, and eight more modes |
| 8 | Static tests find none of the forbidden names | PASS, 87 tests, each file with a positive control |
| 9 | `npm run typecheck -w @dems/core-server`, `npm run lint -w @dems/core-server` | exit 0, exit 0 |
| 10 | Root `npm run typecheck`, `npm run lint` | exit 0, exit 0 |
| 11 | `git diff --stat acaff20 -- apps/mock-core release scripts/release` | prints nothing |
| 12 | Test ledger | `unit` +255 tests in 13 files; `db` unchanged (0) |

## Findings (details in the output document, section 14)

- F-1: SA-01 holds. F-2: SA-13 holds; helmet writes the policy without the space of OR-9, so the
  `onSend` hook states OR-9's text.
- F-3: Fastify 5.12.5 deprecates `disableRequestLogging`; the server uses `logController`.
- F-4: an error logged without a text puts its message, and with Fastify's own "answered twice"
  error the raw URL, into the log. Found by the test, closed by a hook.
- F-5: Fastify's default parsers accept `text/plain` and non-object JSON; removed and refused.
- F-6: in the sandbox a connect to a closed loopback port gives `EPERM`, outside `ECONNREFUSED`.
- F-7: an undecodable URL passes no hook; headers and log line are written by `frameworkErrors`.
- F-8: a plugin's own `onRequest` hook runs after all five stages; `onClose` runs in reverse order.
- F-9: `fastify-plugin` is not a declared dependency; `skip-override` is used instead.
- F-10: types of `@dems/shared/sim` type-check under the server's `tsconfig.json`.
- F-11: W11 was writing `test/helpers/db/` at the same time; the guards pass with its files.
- F-12: an unexpected failure is logged without its message (name, code, frames only).

## Deviations (section 15)

DV-1 a tenth seam `denialBudget`; DV-2 the scaffold's own decorators (`config`, `errorLog`, `db`,
`seams`, `stages`, `request.principal`, route `config.operationId`); DV-3 the `onSend` hook also
sets the policy text; DV-4 the static tests follow the database contract's exceptions; DV-5
`plugins/config` and `plugins/logger` export functions; DV-6 the loader requires the role
`dems_app`; DV-7 a test-support module for other rows; DV-8 the shared trackers were not written;
DV-9 guards beyond the row's list.

## Decisions for the controller (section 16)

- DN-1: accept `denialBudget` as a seam of P25 and brief W23, W24, W28, W32, W41.
- DN-2: **name the row that registers boot checks B-2 to B-9.** Recommendation: W17 exports them,
  W21 (`core`) registers them with `app.readiness.addBootStep`; W26 registers the epoch and
  rehydration step.
- DN-3: add section 6 of the output document to the briefs of W21, W23, W24, W26, W28, W32, W42
  (among other things: `@fastify/cookie` is already registered; tests set `ready.engine` until
  W26 lands; the realtime row registers `@fastify/websocket` at root scope).
- DN-4: keep the `skip-override` registration, or schedule `fastify-plugin` for a later npm slot.
- DN-5: add `apps/core-server/logs/errors.log` to the Host Impact Register.

## Gap

**CONTRACT-GAP-1** (closed on 2026-10-04 09:52, see the follow-up below): the shared
`HealthResponseSchema` fixed `service` to `dems-mock-core` and had no `ready`. Contract A widened
it; the local adapter `apps/core-server/src/modules/health/health-schema.ts` is removed.

## Follow-up after acceptance (D40): three touch-ups, 09:45 to 09:55 WIB

Status: **complete**. Project `unit` only; no port, no database; no file of another row edited;
`app.ts`, `index.ts` and `config.ts` untouched. The edits of ruling D52 in two of this row's
tests are kept.

Files updated:

- `apps/core-server/src/modules/health/index.ts`: validates against the shared
  `HealthResponseSchema`; keeps `CoreServerHealth` as a type only
- `apps/core-server/src/modules/health/__tests__/health.test.ts`: plain assertion against the
  shared schema; one new test (12, was 11)
- `apps/core-server/src/plugins/config/__tests__/load-config.test.ts`: the comparison with the
  shared `CORE_SERVER_*` constants is a plain assertion (46, unchanged)
- `apps/core-server/test/static/audit-protection.test.ts`: the parameter-logging setting of NL-5
  is forbidden outside `test/db/`; positive control (9, was 7)
- `apps/core-server/src/plugins/config/__tests__/test-config.ts`: new export `credentialLeaks`
  (additive)
- `apps/core-server/src/plugins/logger/__tests__/log-capture.test.ts`: searches for a credential
  value, not the bare word; credential-shaped requests; three new tests (21, was 18)
- `implementation/08_backend_scaffold_health.md`: section "Follow-up: touch-ups after contract A
  and the request guards"; this file

File removed: `apps/core-server/src/modules/health/health-schema.ts` (this row's own; its only
importers were the health module and its test).

| # | Check | Result |
|---|---|---|
| 1 | `npm run test -w @dems/core-server -- --maxWorkers=2` | exit 0, twice: **985 passed in 31 files** (979 before; +6, all in this row's files) |
| 2 | `npm run typecheck -w @dems/core-server` | exit 0 |
| 3 | `npm run lint -w @dems/core-server` | exit 0 |
| 4 | No `CONTRACT-GAP-1` marker in `apps/core-server` or `packages/shared/src` | none found |
| 5 | The new static rule against the other rows' files | 0 occurrences in `src/db/**`, `test/helpers/db/**`, `drizzle.config.ts`; 2 in `test/db/pg-behaviours.db.test.ts`, inside the exception |
| 6 | The log test is at least as strong | 8 mutation copies outside the repository: three leaks caught, among them one the old search missed; no false alarm on `hasBearer` |

For the controller:

- FU-1: contract A documents a response header `x-request-id` on every Core-server answer; the
  server sends the ID only in `error.requestId`. Nothing breaks (the typed client falls back to
  the envelope). If the header is wanted it is one line in `plugins/response-headers`, this row's
  file. Not done: not asked.
- A correction to the brief: the setting of item 2 is named once by the migration row, in its own
  database test under `test/db/`, which reads it to assert its default. That is the exception.

## Second follow-up (ruling D55, the `x-request-id` header): 09:54 to 10:02 WIB

Status: **needs-review**. The header change is written and proven but **not in the tree**: with
it, 97 tests of the request-guard row fail, because that row's test support
(`src/plugins/origin-guard/__tests__/guard-test-app.ts`) holds its own copy of "the five headers
and nothing else". That file is not this row's, so it was not edited. The tree is green.

Files updated:

- `apps/core-server/src/plugins/logger/__tests__/log-capture.test.ts`: the request ID as the
  correlation key of the log is asserted (22 tests, was 21)
- `implementation/08_backend_scaffold_health.md` (section F.6); this file

Files added (task folder):

- `implementation/assets/08_x_request_id_scaffold.patch`: the change to
  `plugins/response-headers/index.ts` and its test (28 tests, was 15)
- `implementation/assets/08_x_request_id_guard_helper.patch`: the two-line change the
  request-guard row's helper needs

Not changed in the end: `apps/core-server/src/plugins/response-headers/index.ts` and its test
(byte-equal to their state before this follow-up; `cmp` checked).

| # | Check | Result |
|---|---|---|
| 1 | The tree as it stands: `npm run test -w @dems/core-server -- --maxWorkers=2` | exit 0, twice: **986 passed in 31 files** |
| 2 | `npm run typecheck -w @dems/core-server`, `npm run lint -w @dems/core-server` | exit 0, exit 0 |
| 3 | Plugin change alone, in the tree (09:55:23) | exit 1: 107 failed (97 in the request-guard row's three files, 10 in this row's header test); one message, `expected [ 'x-request-id' ] to deeply equal []` |
| 4 | Both patches, proven outside the tree by a Vitest alias | 970 passed in 30 files, plus this row's new header test 28 passed: 998 in 31 files (999 with the new log test) |
| 5 | Both patches | `patch --dry-run -p1` clean |

For the controller:

- **Noise caused by this row:** from 09:55:13 to 09:57:50 the plugin change was in the tree and
  the shared `unit` project was red (107 failures). A row that ran its gate then saw failures in
  `origin-guard.test.ts`, `throttle.test.ts`, `denial-budget.test.ts` and
  `response-headers.test.ts` that were not its own.
- **Decision needed:** allow the two-line change in `guard-test-app.ts` (a by-design change, the
  mirror of D52) and have both patches applied. Expected afterwards: 999 passed in 31 files.

## Third follow-up (ruling D57: apply both patches): 10:02 to 10:04 WIB

Status: **complete**. The `x-request-id` header is in the tree. Every answer of the Core server
carries it.

**Apply window: start 10:02:52.729 WIB, end 10:02:52.747 WIB** (18 ms; one shell command, both
patches back to back, after both dry runs exited 0; no hand merge, no `.orig`, no `.rej`).

Files updated by the two patches:

- `apps/core-server/src/plugins/response-headers/index.ts`
- `apps/core-server/src/plugins/response-headers/__tests__/response-headers.test.ts` (28 tests, was 15)
- `apps/core-server/src/plugins/origin-guard/__tests__/guard-test-app.ts` (the request-guard
  row's file; lines 9, 30 and 31, under ruling D57)

Git-ignored: `.cache/rollback/W08c.response-headers.index.ts.pre`,
`.cache/rollback/W08c.response-headers.test.ts.pre`, `.cache/rollback/W08c.guard-test-app.ts.pre`
(the pre-images).

Task folder: `implementation/08_backend_scaffold_health.md` (end of section F.6); this file.

| # | Check | Result |
|---|---|---|
| 1 | Baseline before, 10:02:37 | 986 passed in 31 files |
| 2 | `npm run test -w @dems/core-server -- --maxWorkers=2` after the apply | exit 0, three runs (10:03:01, 10:03:27, 10:03:40): **999 passed in 31 files** |
| 3 | `npm run typecheck -w @dems/core-server` | run 1 exit 2, one error in the core-services row's `src/core/clock.ts` (its import of `./errors`, a file that row wrote a moment later): noise; runs 2 and 3 exit 0 |
| 4 | `npm run lint -w @dems/core-server` | exit 0, twice, no warning |
| 5 | The three files after the apply | byte-equal to the versions proven outside the tree |

For the controller:

- **Three lines changed in `guard-test-app.ts`, not two.** The stored patch also rewords the
  comment above the list (line 30). The earlier report said "two lines". Before and after are in
  the output document; the comment can be put back from the pre-image if the ruling means the two
  code lines only.
- The core-services row was mid-edit in `src/core/` during the verification; it has added no test
  file yet, so the total is exactly 999.
