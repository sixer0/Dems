# coder-execution, step 53 (plan row W31): the contract-checked fake transport HB-11

| Field | Value |
|---|---|
| Step / row | 53 / W31 (wave B4) |
| Agent | coder-execution |
| Status | **complete** |
| Result line | `@dems/shared/live/testing` exports one test double for Vitest and jest: a `fetch`-compatible function, a socket constructor and factory, one call log, a clock and six named errors, contract-checked in both directions. `@dems/shared`: 1,351 passed of 1,351 in 55 files (1,012 in 47 before; 209 new tests in six `live-testing-*` files; the other 130 in two files are W30's). Typecheck and lint of `@dems/shared` exit 0; typecheck of `@dems/core-web` and `@dems/mobile` exit 0; the module runs under the mobile jest configuration (6 of 6, two invocations) |
| Blocker | None |
| Started | 2026-10-04 about 09:45 WIB (reading); baseline run 09:50:37 |
| Last run | Final gate 10:31:11 to 10:31:39; confirmation after the documents 10:37:09 to 10:37:54 (five commands, exit 0 each) |
| Output document | `implementation/31_fake_transport.md` (Tier 3) |
| Write paths used | `packages/shared/src/live/testing/**` (9 files); `packages/shared/test/live-testing-*.test.ts` (6 files); the output document, 14 files `implementation/assets/31_*`, this file; scratch under the git-ignored `.cache/w31/` and `.cache/rollback/W31.*` |
| Shared trackers | Not written (parallel run, P8): `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md`. The controller records the status of row W31 from this file |
| Processes | None started that outlives a command; no port bound; no install; no git write; no sandbox bypass used |

## Files created or updated

| Path | Change |
|---|---|
| `packages/shared/src/live/testing/index.ts` | Replaced W03's one-line placeholder by the barrel of the fake transport |
| `packages/shared/src/live/testing/fake-transport.ts` | Created: `createFakeTransport`, `withFakeTransport`, `exampleAnswer`, `exampleInput`, `refusal`, `rateLimited`, `notReady`, the common sequences of TS-13 |
| `packages/shared/src/live/testing/http.ts` | Created: the `fetch`-compatible function and the scripted answers |
| `packages/shared/src/live/testing/socket.ts` | Created: `FakeSocket`, `FakeConnection`, the constructor, the factory, connect scripts |
| `packages/shared/src/live/testing/contract.ts` | Created: `checkRequest`, `checkAnswer`, `createFakeContract` |
| `packages/shared/src/live/testing/log.ts` | Created: the shared call log and its masked text |
| `packages/shared/src/live/testing/clock.ts` | Created: `createFakeClock`, `clockFromTimers` |
| `packages/shared/src/live/testing/errors.ts` | Created: the six named errors, the reason sets, the masking, `FAKE_CREDENTIALS` |
| `packages/shared/src/live/testing/install.ts` | Created: `installFakeTransport` |
| `packages/shared/test/live-testing-fetch.test.ts` | Created: 89 tests |
| `packages/shared/test/live-testing-socket.test.ts` | Created: 63 tests |
| `packages/shared/test/live-testing-log.test.ts` | Created: 28 tests |
| `packages/shared/test/live-testing-platform-neutral.test.ts` | Created: 20 tests |
| `packages/shared/test/live-testing-install.test.ts` | Created: 5 tests |
| `packages/shared/test/live-testing-live-socket.test.ts` | Created: 4 tests (imports W30's `live-socket-client.ts`) |
| `docs/2026-10-04_dems_backend_rbac_pairing/implementation/31_fake_transport.md` | Created: the output document |
| `.../implementation/assets/31_baseline_shared_test.log`, `31_baseline_shared_static.log`, `31_gate_final.log` | Created: the runs before and after, with exit codes |
| `.../assets/31_live_testing_tests_verbose.log` | Created: the 209 test names |
| `.../assets/31_jest_proof.log`, `31_jest_proof.test.ts.txt`, `31_jest_microtask.log`, `31_jest_microtask.test.ts.txt` | Created: the jest evidence of rule 4 and the scratch tests behind it |
| `.../assets/31_vitest_jsdom.log`, `31_client_probe.log`, `31_client_probe.ts.txt`, `31_doc_examples.log` | Created: the jsdom run, the compile probe under each client's options, the two usage examples run as written |
| `.../assets/31_mutations.log`, `31_mutate.py.txt` | Created: the check that the tests can fail |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_53.md` | Created: this file |
| `.cache/rollback/W31.pre.patch`, `.cache/rollback/W31.live-testing-index.ts.pre` (git-ignored) | Created before the first edit: the P23 patch (0 bytes: the folder is not in `acaff20`) and a copy of the placeholder |
| `.cache/w31/**` (git-ignored) | Scratch: the jest tests, the probes, the mutation script and its backups, the logs |

Not touched: `packages/shared/src/api/**`, `src/client/**`, `src/realtime/**`, `src/sim/**`,
`src/live/*.ts`, `src/live/source/**`, every `package.json`, the lockfile, every file under `apps/`,
every existing test file.

## Log

- 09:45-09:50 Inputs read: 02_structured (row 53; P6, P9 to P12, P21 to P24), 02_plan (W31, sections 3.4, 11, 12), 04_client_integration_spec (sections 2, 5.1, 12, 13.1), 03_analysis TD-12, 01_specs (API-1 to API-13, sections 4.1, 5.2, 9.2), the implementation documents 12, 18, 19 and 22, the contract folder, the typed client, the heartbeat client and its test, the mobile jest configuration, the web test block.
- 09:50:32 P23 pre-image saved; hash of the placeholder recorded (`0733335b...`).
- 09:50:37 Baseline: `@dems/shared` 1,012 of 1,012 in 47 files; typecheck and lint exit 0.
- 09:52-10:10 The nine source files written. A smoke script under `.cache/w31/` ran the typed client and a socket on the fake.
- 10:00 Row W30's `live-socket-client.ts` appeared; its factory `(url, headers)` and its `timers` shape read. The fake's factory already took both forms; the manual clock gained `timers` of that shape.
- 10:12 First typecheck: red in W30's test file only (P11). 10:13 `live-testing-fetch`: 87 of 89; two failures were this row's (a wrong member name in a test; a test that advanced the clock before the request had arrived). The second led to `arrived()`, a wait point that needs no timer. 89 of 89.
- 10:17 `live-testing-socket`: 63 of 63 on the first run.
- 10:19 `live-testing-log`: 25 of 28; the cause was a wrong sign-in body in the test (the contract's member is `username`). The failure diff showed the log entry masked: Vitest prints through `toJSON()` (finding F53-2). The masked form now carries the entry's own member names.
- 10:21 Install and static tests; one static rule was too broad (it took `readonly string[]` in a parameter's type for a parameter property) and was narrowed, with three controls.
- 10:22 The fake under W30's live socket client: 4 of 4 on the first run. Typecheck exit 0; lint exit 0 after six warnings were removed.
- 10:23 jest: scratch test 6 of 6 with the mobile configuration, from the workspace root and through the mobile workspace's own test script.
- 10:24 The five behaviour files in a jsdom environment: 189 of 189.
- 10:24-10:28 Review pass: a refused upgrade no longer counts as a connection; the response body is read once; the registry loop asserts the matched operation of every exchange.
- 10:26, 10:29 Mutation runs: 26 of 26 detected; source restored (identical to the copy).
- 10:29 Compile probe under each client's options: exit 0 twice; negative control exit 2 twice.
- 10:31:11 Final gate: shared 1,351 of 1,351 in 55 files; typecheck and lint of shared, typecheck of web and mobile: exit 0 four times.
- 10:32 Measurement: the jest fake timers hold a `queueMicrotask` callback back, a promise job runs.
- 10:33-10:36 Documents written; the two usage examples of the document run as written (Vitest in jsdom, jest): 1 of 1 each.
- 10:37:09 Confirmation run after the documents: shared 1,351 of 1,351 in 55 files; the five commands exit 0 (appended to `assets/31_gate_final.log`).

## Verification (the row's cell), with the place of the quoted output

| Point | Result | Where |
|---|---|---|
| `npm run test -w @dems/shared -- --maxWorkers=2` exits 0 | Pass: 1,351 of 1,351 in 55 files | 31_fake_transport.md §6.2 |
| A scripted response that violates its schema fails with a named error | Pass: `FakeTransportResponseError`, `INVALID_BODY`, thrown at scripting time | §4.2 |
| A request body that violates the operation's schema fails | Pass: `FakeTransportRequestError`, `INVALID_BODY`, `issues: ['reason: too_small']`, through the real typed client | §4.1 |
| The call log holds method, path, headers and body | Pass | §3.5, §4.4 |
| `npm run typecheck -w @dems/shared`, `npm run lint -w @dems/shared` exit 0 | Pass | §6.2 |
| `npm run typecheck -w @dems/core-web`, `-w @dems/mobile` exit 0 | Pass; the folder itself compiles under both option sets (probe) | §6.2, §6.4 |
| jest loadability (rule 4) | Pass: 6 of 6, two invocations; what is not proven is listed | §5.2 |
| Test ledger (P24) | shared 1,012 in 47 → 1,351 in 55; this row 209 in 6 files, by name | §6.3 |
| AC-C-02, AC-C-17 | Pass | §4.4, §4.2 |
| The tests can fail | 26 of 26 single changes detected | §6.5 |

## Test ledger (P24)

| Workspace | Before | After | This row's files |
|---|---|---|---|
| `@dems/shared` | 1,012 tests in 47 files (09:50) | 1,351 tests in 55 files (10:31 and 10:37) | `live-testing-fetch.test.ts` 89, `live-testing-socket.test.ts` 63, `live-testing-log.test.ts` 28, `live-testing-platform-neutral.test.ts` 20, `live-testing-install.test.ts` 5, `live-testing-live-socket.test.ts` 4: **209 in 6 files** |
| Others in the same time | | | W30: `realtime-live-socket.test.ts` 117, `realtime-live-platform-neutral.test.ts` 13: 130 in 2 files |

Expected total for the controller's ledger: 1,012 + 209 (W31) + 130 (W30, at 10:31) = 1,351.

## For the controller (P22)

### Findings

| ID | Finding |
|---|---|
| F53-1 | The typed client reports any transport rejection as `NETWORK` (CL-1), so a request the fake refuses looks like an outage to the code under test. The fake records every such error; a Live test must end with `fake.assertNoViolations()` or run inside `withFakeTransport` |
| F53-2 | Vitest and jest print a failed comparison through `toJSON()`: a log entry prints masked in a failure diff, with the entry's own member names. Compare single members when a value matters |
| F53-3 | Under the jest fake timers of the mobile configuration a `queueMicrotask` callback waits until the fake timers are advanced; a promise job runs (measured, `assets/31_jest_microtask.log`). The fake uses promise jobs only. No file under `packages/shared/src` uses `queueMicrotask` today |
| F53-4 | W30's live socket client ran on the fake without a change on either side (`LiveSocketFactory`, `LiveSocketTimers`); every message that client sent passed the client union |
| F53-5 | `OperationExamples` has no member for a query example, and the registry had no query schema at 10:31. A query schema with a required member would make the registry loops (this row's and W12's) fail and name the operation. For W27: keep list queries with defaults (API-9), or add a query example |
| F53-6 | `EXAMPLE_PLACEHOLDERS` is not exported by `@dems/shared/api`. Not a gap: the fake has `FAKE_CREDENTIALS` |
| F53-7 | The registry held 37 operations for the whole run (contract C had not written `src/api/` yet). The loop tests read the table at run time and pin "at least 37" |
| F53-8 | `.gitignore:48` (`*.log`) ignores the evidence logs under `implementation/assets/`; they stay on disk and are not part of a commit staged by path unless forced. This holds for the logs of earlier rows too |

### Deviations from the plan

| # | Deviation |
|---|---|
| 1 | `live-testing-live-socket.test.ts` imports W30's `src/realtime/live-socket-client.ts` (the row's dependencies are W22 and W12). If W30 is rolled back, this one file goes with it; the other five do not depend on W30 |
| 2 | The TS-15 static test also reads the `src` folders of the four apps (read only). A harness that imports the fake must sit under `test/`, `tests/`, `__tests__/`, `__mocks__/`, `testing/` or `e2e/`, or be named `*.test.*`, `*.spec.*` or `jest.setup.*` |
| 3 | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` not written (parallel run) |
| 4 | Evidence beyond the row's commands: the jsdom run, the compile probe, the mutation run, the microtask measurement, the two usage examples |

### Decisions needed

| ID | Decision | Proposal |
|---|---|---|
| DN53-1 | The strictness choices of 31_fake_transport.md §7 rows 4, 5, 6, 8: the bearer value has the contract's exact form; a query the contract does not state is refused; the path parameter pattern is checked; `hello` comes first | Accept |
| DN53-2 | Make "the test ends with `assertNoViolations()`" part of the client gate CLG item (b) and of W44's instructions | Accept |
| DN53-3 | Keep the app-side part of the TS-15 scan in the shared test until W87 lands its own | Keep |
| DN53-4 | Keep `live-testing-live-socket.test.ts` and note its dependency on W30 in the rollback table | Keep |

## Rollback (R-NEW)

`git clean -fd -- packages/shared/src/live/testing` and the six `packages/shared/test/live-testing-*.test.ts`
files, then put W03's placeholder back:
`mkdir -p packages/shared/src/live/testing && cp .cache/rollback/W31.live-testing-index.ts.pre packages/shared/src/live/testing/index.ts`
(`git hash-object`: `0733335ba79b660ccfb3841f5e52403368d0e6b9`). The full commands are in
31_fake_transport.md §9.
