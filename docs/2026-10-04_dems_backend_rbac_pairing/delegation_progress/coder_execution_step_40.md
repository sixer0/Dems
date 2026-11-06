# coder-execution, step 40 (plan row W18): the light Live API and the settle helper HB-15

| Field | Value |
|---|---|
| Step / row | 40 / W18 (wave B1) |
| Agent | coder-execution |
| Status | **complete** (first delivery accepted by D43; follow-up F40-2 done 08:00 to 08:07 WIB, section "Follow-up" below) |
| Result line | `@dems/shared/live` exports the light API from six files with no network code. `@dems/shared`: 680 passed of 680 in 37 files (587 in 31 before; 93 new tests in six `live-light-*` files). Typecheck and lint of `@dems/shared` exit 0; typecheck of `@dems/core-web` and `@dems/mobile` exit 0 |
| Blocker | None |
| Started | 2026-10-04 07:37 WIB (baseline run 07:38:49) |
| Last run | First delivery: final gate 07:54:15, confirmation 07:58:28. Follow-up: gate 08:02:43 (689 of 689 in 38 files, five commands exit 0); later runs 08:04:44 to 08:05:46, see "Follow-up" |
| Output document | `implementation/18_live_light_api_settle.md` (Tier 3) |
| Write paths used | `packages/shared/src/live/{index,settle,core-actions,errors,mode,hooks}.ts`; `packages/shared/test/live-light-*.test.ts` (six files); the output document, ten files `implementation/assets/18_*`, this file; `.cache/rollback/W18.pre.patch` (P23, git-ignored, 0 bytes) |
| Shared trackers | Not written (parallel run, P8): `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md`. The controller records the status of row W18 from this file |
| Processes | None started that outlives a command; no port bound; no install; no git write |

## Files created or updated

| Path | Change |
|---|---|
| `packages/shared/src/live/index.ts` | Replaced W03's one-line placeholder by the barrel of the light API |
| `packages/shared/src/live/core-actions.ts` | Created: `CoreResult`, `CoreActions`, `coreActionsOf` |
| `packages/shared/src/live/settle.ts` | Created: `SettleHandlers`, `settle` |
| `packages/shared/src/live/errors.ts` | Created: `LiveTransportError`, `CoreRefusalError`, `LiveTransportReason`, re-export of the three simulator classes |
| `packages/shared/src/live/mode.ts` | Created: `CoreMode`, `CORE_MODES`, `DEFAULT_CORE_MODE`, `parseCoreMode`, `LiveLinkState`, `LiveSessionHint`, `LiveHandle`, `liveOf`, `coreModeOf`, `liveLinkOf`, `corePermissionOf` |
| `packages/shared/src/live/hooks.ts` | Created: `useCoreActions`, `useCoreMode`, `useLive`, `useLiveLink`, `useCorePermission` |
| `packages/shared/test/live-light-settle.test.ts` | Created: 32 tests |
| `packages/shared/test/live-light-core-actions.test.ts` | Created: 9 tests |
| `packages/shared/test/live-light-errors.test.ts` | Created: 13 tests |
| `packages/shared/test/live-light-mode.test.ts` | Created: 13 tests |
| `packages/shared/test/live-light-hooks.test.ts` | Created: 14 tests |
| `packages/shared/test/live-light-platform-neutral.test.ts` | Created: 12 tests |
| `docs/2026-10-04_dems_backend_rbac_pairing/implementation/18_live_light_api_settle.md` | Created: the output document |
| `.../implementation/assets/18_gate_final.log`, `18_gate_shared_test.log`, `18_gate_static.log` | Created: the gate runs with exit codes |
| `.../assets/18_live_light_tests_verbose.log` | Created: the 93 test names |
| `.../assets/18_mutation_runtime.py`, `18_mutation_runtime.log`, `18_mutation_types.py`, `18_mutation_types.log` | Created: the checks that the tests can fail, run on a copy outside the repository |
| `.../assets/18_client_probe.ts.txt`, `18_client_probe.log` | Created: the subpath under each client's compiler options |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_40.md` | Created: this file |
| `.cache/rollback/W18.pre.patch` (git-ignored) | Created before the first edit; 0 bytes (the folder is not in `acaff20`) |

Not touched: `packages/shared/src/live/source/**`, `src/live/testing/**` (hashes equal before and
after), `src/client/**`, `src/api/**`, `src/sim/**`, `src/realtime/**`, every `package.json`, the
lockfile, every client file, every existing test file.

## Log

- 07:37-07:40 Inputs read: 02_structured (row 40, P6, P9, P10, P12, P21, P22, P24), 02_plan (W18, section 3.4), 04_client_integration_spec (sections 1.7, 1.8, 2, 3, 6, 7.2, 8, 12, 13.1, 17), 03_analysis (ADQ-2, ADQ-3), the simulator's `react.ts`, `errors.ts`, `engine.ts`, `types.ts`, the typed client's failure shape, the heartbeat hook, three call sites.
- 07:38:49 Baseline: `@dems/shared` 587 of 587 in 31 files; typecheck and lint exit 0.
- 07:39 P23 pre-image saved (0 bytes); hashes of the three placeholders recorded.
- 07:40-07:42 The six source files written. Typecheck and lint exit 0.
- 07:43-07:48 The six test files written. First run: 91 of 93; two failures were wrong operator roles in my own test data (the INVESTIGATOR and TECHNICIAN operators), corrected; 93 of 93.
- 07:48 Lint: five warnings in the new tests (exit 0); two removed, one file-level directive with its reason for the thenable test doubles; the linter prints nothing after it.
- 07:49 Mutation checks on an isolated copy in the scratchpad: 23 of 23 runtime mutations detected.
- 07:49-07:50 Probe outside the repository under each client's `tsconfig`: exit 0 for both; negative control exit 2 for both.
- 07:50:50 Gate: shared 680 of 680 in 37 files. 07:51 typecheck and lint of shared, typecheck of web and mobile: exit 0 four times.
- 07:52 Type mutation checks: 6 of 6 detected. Evidence copied to `implementation/assets/18_*`.
- 07:54:15 Final gate: 680 of 680; five commands exit 0.
- 07:55-07:58 Documents written.
- 07:58:28 Confirmation run after the documents: shared 680 of 680 in 37 files; the five commands exit 0 (appended to `assets/18_gate_final.log`).

## Verification (the row's cell), with the place of the quoted output

| Point | Result | Where |
|---|---|---|
| `npm run test -w @dems/shared -- --maxWorkers=2` exits 0 with the baseline tests unchanged and the `live-light-*` tests | Pass: 680 of 680 in 37 files; the 28 baseline files and the three `client-*` files were not written by this row | 18_live_light_api_settle.md §6.2, §6.3 |
| `useCoreActions()` returns `sim.actions` itself for a simulator | Pass: rendered under the real `SimProvider` | §5.1 |
| `settle` runs `ok` and `done` before it returns for a plain value | Pass | §4 rows 1 to 3 |
| `settle` runs `fail` and `done` for a synchronous throw | Pass | §4 row 4 |
| The promise paths: once, in order, never both; an exception of `ok` is not passed to `fail`; `done` once in every path | Pass | §4 rows 5 to 10 |
| Error classes: members; class identity of the simulator's classes | Pass | §5.2 |
| Mode values, default, derivation from the source; hooks | Pass | §5.3, §5.4 |
| Static: no network code; AC-C-02 | Pass | §5.5 |
| `npm run typecheck -w @dems/shared`, `npm run lint -w @dems/shared` | Pass: exit 0, exit 0 | §6.2 |
| `npm run typecheck -w @dems/core-web`, `-w @dems/mobile` | Pass: exit 0, exit 0; the subpath compiles under both clients' options (probe) | §6.2, §6.4 |
| Test ledger (P24) | `@dems/shared` 587 → 680; six new files named; no other workspace changed | §6.3 |

## For the controller to record

**Findings**

- **F40-1.** `@dems/shared` declares no React renderer. `live-light-hooks.test.ts` imports `react-test-renderer`, resolved from the root (19.2.3; declared by `@dems/mobile`, pinned by the root `overrides`). No manifest was edited. If it should be declared, the two lines for an npm slot are `"react-test-renderer": "19.2.3"` and `"@types/react-test-renderer": "19.3.0"` in the devDependencies of `packages/shared/package.json`.
- **F40-2.** The UI constants of the client specification (`LIVE_PENDING_REVEAL_MS`, `LIVE_RESYNCED_NOTICE_MS`) have no home in the light module, which is the only Live module a feature file may import statically. This row's task list names no constant; none was added.
- **F40-3.** Row W44 must: carry `coreMode: 'LIVE'`, `link`, `session` (replaced, never edited in place) and `onLiveChange` on the Live source; return action results whose `then` callbacks run in the turn of CL-16 (a bare native promise calls back one microtask later); contain an exception that a callback throws and report it through `onError`.
- **F40-4.** The suite stood at 587 when this row started (508 + 76 of step 34 + 3 added by step 38 by design).
- **F40-5.** One file-level lint directive in a test (`unicorn/no-thenable`, the thenable test doubles).
- **F40-6.** `parseCoreMode` accepts the stored spelling only; the lowercase environment value of MD-2 is mapped by the web runtime row.

**Deviations from the plan**

- Six test files instead of one, all matching `live-light-*.test.ts`.
- Ten evidence files under `implementation/assets/18_*`; the P23 file under `.cache/rollback/`.
- `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` not written (parallel run).

**Decisions asked**

1. Accept the choices O-1 to O-14 of the output document (section 7) as the contract of the light API. The ones later rows depend on: `fail` is required (O-2); an exception of a handler is not caught and never passed to `fail` (O-3); the marker `coreMode: 'LIVE'` and `onLiveChange` (O-10); `useCorePermission()` is false in Simulated mode (O-12).
2. F40-1: accept the renderer as resolved from the root, or schedule the two manifest lines.
3. F40-2: where the light constants live and which row writes them.
4. F40-3: add the obligations to the delegation of row W44.

**Rollback**: R-NEW, commands in the output document, section 9.

## Follow-up: the light constants (finding F40-2, decision D43), 08:00 to 08:07 WIB

Controller ruling received: O-1 to O-14 accepted as written; F40-1 stays as it is (no manifest line);
F40-3 goes into W44's brief; F40-2 is done by this row now.

| Field | Value |
|---|---|
| Status | **complete** |
| Result line | `packages/shared/src/live/constants.ts` holds `LIVE_PENDING_REVEAL_MS = 420` and `LIVE_RESYNCED_NOTICE_MS = 3_000`, exported from `@dems/shared/live`. Gate 08:02:43: `@dems/shared` 689 of 689 in 38 files; typecheck and lint of `@dems/shared`, typecheck of `@dems/core-web` and `@dems/mobile` exit 0 |
| Output document | `implementation/18_live_light_api_settle.md`, section 11 |

**Files of the follow-up**

| Path | Change |
|---|---|
| `packages/shared/src/live/constants.ts` | Created: the two constants, no import |
| `packages/shared/src/live/index.ts` | Updated: `export * from './constants';` and one sentence of the header comment |
| `packages/shared/test/live-light-constants.test.ts` | Created: 9 tests |
| `packages/shared/test/live-light-platform-neutral.test.ts` | Updated: the pinned file list (seven), the allowed imports, the pinned export list (24 names), one assertion that `constants.ts` imports nothing |
| `docs/.../implementation/18_live_light_api_settle.md` | Updated: a pointer under the result line; section 11 appended |
| `docs/.../implementation/assets/18_gate_followup.log`, `18_mutation_constants.py`, `18_mutation_constants.log` | Created |
| `docs/.../implementation/assets/18_client_probe.log` | Appended: the two names under each client's compiler options |
| This file | Updated |

**The constants and their sources**

| Constant | Value | Source |
|---|--:|---|
| `LIVE_PENDING_REVEAL_MS` | 420 | `04_client_integration_spec.md:262` (§2.4: "420 (the motion token `duration.slow`)"); used by LB-1 (`:720`); name pinned at `02_plan.md:343`; the token at `packages/shared/src/tokens/tokens.ts:286` |
| `LIVE_RESYNCED_NOTICE_MS` | 3,000 | `04_client_integration_spec.md:267` (§2.4: "3,000", equal to the mobile `RESYNCED_BANNER_MS`, `apps/mobile/src/runtime/connection-banner.ts:21`); used by §3.5 "Link back" (`:394`); name pinned at `02_plan.md:343` |

**Not added (nothing invented)**: `LIVE_COMMAND_TIMEOUT_MS` (8,000; it is the typed client's and
exists at `packages/shared/src/client/core-client.ts:40`); `LIVE_SETTLE_TIMEOUT_MS` (2,000),
`LIVE_BOOT_TIMEOUT_MS` (4,000), `LIVE_TOUCH_INTERVAL_MS` (60,000) (used by the Live source only, row
W44); and the display values that the specification states without a name (LB-6 "one per 3 s"; the
1 s and 2 s limits of CL-23 and CL-11; the page-local figures of §10.3).

**Log**

- 08:00:32 Baseline of the follow-up: 680 of 680 in 37 files.
- 08:00:51 `constants.ts` written; 08:01:07 barrel line; 08:01:20 static test updated. Between 08:00:51 and 08:01:20 the static test of this row would have failed in a run of another row (it pinned six files).
- 08:01:57 First run of the new test: 102 of 102 in the `live-light-*` group; the typecheck failed with two errors in `live-light-constants.test.ts` (a type assertion on the value instead of on its type). Corrected 08:02:06; typecheck exit 0 at 08:02:13.
- 08:02:31 Six mutations of the constants on the isolated copy: six detected.
- 08:02:43 Gate: 689 of 689 in 38 files; the five commands exit 0.
- 08:03:10 The two names under each client's compiler options: exit 0 twice; negative control exit 2 twice.
- 08:04:44, 08:05:11, 08:05:40 Later full runs: 1 failed, 688 passed. The failure is `test/openapi.test.ts > AC-56 … matches the committed openapi/openapi.json byte for byte (no drift)`, a pinned test of the contract-owner row, which edited `packages/shared/src/api/**` from 08:03:00 on; the committed JSON is not regenerated yet. 08:05:43 with `--exclude test/openapi.test.ts`: 37 files, 668 of 668, exit 0. 08:05:46 `test/live-light`: 102 of 102. In the run of 08:04:44 typecheck and lint of shared and both client typechecks exit 0.
- 08:06:34 Last reading: the same one test failure, and the typecheck of `@dems/shared` red with two errors in `src/api/example-parts.ts`, a file the contract-owner row created at 08:06:30. Lint exit 0. No file of this row changed after 08:02:06.

**For the controller to record**

- **F40-2** closed for the two named display timings.
- **F40-7 (new).** LB-6's interval for the offline toast (one per 3 s; AC-C-59) is a light-layer display rule with a value and no name in the specification or the plan. It was not added. If the web and the mobile presenter are to share it, a name has to be pinned.
- **Deviation from the ruling's "no other file changes".** `live-light-platform-neutral.test.ts` was updated: it pins the file list and the export list of the light API, so it fails with any seventh file. No assertion was weakened.
- **P11 note.** Two short red intervals were caused by this row (08:00:51 to 08:01:20 in the static test; from the creation of the constants test until 08:02:06 in the typecheck). The red full runs after 08:04:44 are not this row's: they are the contract-owner row's drift check, mid-edit.
- **Ledger.** `@dems/shared`: 680 in 37 files before the follow-up; 689 in 38 after (9 tests in `live-light-constants.test.ts`). Row total 587 → 689: seven new files, 102 tests.
