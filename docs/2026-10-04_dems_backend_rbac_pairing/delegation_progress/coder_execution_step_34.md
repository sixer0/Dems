# coder-execution, step 34 (plan row W12): early proof (e), the registry-driven typed client and its emulator proof

| Field | Value |
|---|---|
| Step / row | 34 / W12 |
| Agent | coder-execution |
| Status | **complete**. The emulator proof ran on 2026-10-04 at 11:06 WIB on the lock-free `dems2_phone` (15 of 15 PASS; section "Device part" below). The code part, the contract A follow-up and the contract C adaptation are complete and verified |
| Result line | **TD-09 registry-driven client CONFIRMED on Hermes / expo-fetch**; fallback row Fe is not needed. (At 07:25 the proof was open: the emulators of that time were PIN-locked, F34-1) |
| Blocker | F34-1: user 0 is `RUNNING_LOCKED` on `dems_phone`, `dems_tablet`, `dems_phone2` (cold boot of step 24, no unlock since). The unlock is typing the emulator PIN into the Android lock screen (`README.md:141`); this agent does not enter credentials into an operating-system prompt, and the row has no mandate to change emulator state. The user, or a row the controller names with the user's agreement, has to do it |
| To finish | After the unlock: `/usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock /bin/sh .cache/proof-harness/run_w12.sh` (about 2 to 5 minutes; no code change expected) |
| Started | 2026-10-04 06:53:51 WIB |
| Last run | 07:20:51 WIB (gates); device attempt 07:10:39 to 07:16:52. Follow-up: final gates 08:54:51 to 08:55:12 WIB |
| Time box | 90 min; kept (stopped at the blocker after about 31 min) |
| Write paths used | `packages/shared/src/client/**`; `packages/shared/test/client-*.test.ts`; `apps/mobile/src/runtime/dev-probes.ts`; `apps/mobile/src/runtime/debug.ts`; `.cache/proof-harness/**`; `.cache/rollback/W12.pre.patch`; `.locks/core-server.lane1.pid` (written and removed by each run); the output document, its assets and this file |
| Shared trackers | Not written (parallel run, P8): `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md`. The controller records the status of row W12 from this file |

## Files created or updated

| Path | Change |
|---|---|
| `packages/shared/src/client/core-client.ts` | Created: the client (HB-9), 670 lines with types and comments |
| `packages/shared/src/client/index.ts` | Replaced W03's one-line placeholder by the public exports |
| `packages/shared/test/client-core.test.ts` | Created: 63 tests |
| `packages/shared/test/client-types.test.ts` | Created: 6 tests (type assertions checked by `tsc`) |
| `packages/shared/test/client-platform-neutral.test.ts` | Created: 7 tests (static scan) |
| `apps/mobile/src/runtime/dev-probes.ts` | Created: the debug-only probe module (probe `core-client`, twelve checks) |
| `apps/mobile/src/runtime/debug.ts` | Modified: the one hook `runDevProbeFromUrl`, inside `if (__DEV__)`, called from the existing deep-link loader (41 lines added, 1 changed against `acaff20`) |
| `docs/2026-10-04_dems_backend_rbac_pairing/implementation/12_typed_client_emulator_proof.md` | Created: the output document (Tier 3) |
| `.../implementation/assets/12_run_w12_device_blocked.log` | Created: the device run that was blocked |
| `.../assets/12_host_control.txt`, `12_harness_host_control.log` | Created: the Node control run and the harness log of it |
| `.../assets/12_release_bundle_check.log` | Created: the release-gate evidence (Metro transform, development bundle, release bundle) |
| `.../assets/12_gate_static.log`, `12_gate_shared_test.log`, `12_gate_mobile_test.log` | Created: typecheck, lint and test runs with exit codes |
| `.../assets/12_screen_dems_phone_locked.png` | Created: the phone's display during the attempt (black, keyguard) |
| `.../assets/12_harness.mjs`, `12_run_w12.sh`, `12_device_w12.sh`, `12_host_control_w12.mjs`, `12_release_gate_w12.cjs`, `12_release_bundle_check.sh` | Created: copies of the scratch scripts |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_34.md` | Created: this file |
| `.cache/proof-harness/harness.mjs` (git-ignored) | Extended (W05's routes kept): canned contract answers checked against the registry at start, header logging, socket hello with the `Authorization` facts |
| `.cache/proof-harness/run_w12.sh`, `device_w12.sh`, `host_control_w12.mjs`, `release_gate_w12.cjs`, `release_bundle_check.sh`, `out_w12/**` (git-ignored) | Created |
| `.cache/rollback/W12.pre.patch` (git-ignored) | Created before the first edit of `debug.ts`; 0 bytes (the file equalled `acaff20`) |

Not touched: `packages/shared/src/api/**`, `packages/shared/src/sim/**`, `apps/mobile/package.json`, the lockfile, `device-session.sh`, any test file of another row, any emulator setting.

## Log

- 06:53-06:59 Inputs read: 02_structured (row 34, P1-P25, early proofs, Fe), 02_plan (W12, §5.3, §6), 04_client_integration_spec §2 (CL-1 to CL-6a, AC-C-01 to 05, CA-08, WT-4, WT-6), 01_specs §7.1 to 7.3 and §9, 02d_collection (F9-12 to F9-15), 05_proof_vite_proxy, the registry (`core-api.ts`, `examples.ts`), `debug.ts`, `core-link.ts`, `device-session.sh`, the release-gate test, Expo's `winter/runtime.native.ts` and `fetch.ts`.
- 06:59-07:03 Client written; three test files written. 07:03:53: typecheck exit 0, 75 client tests pass.
- 07:05 P23 pre-image saved (0 bytes). Found: step 35 had already added `DEMS_CORE_HOST_PORT` to `device-session.sh`.
- 07:05-07:08 `dev-probes.ts` and the hook in `debug.ts`. Mobile typecheck and lint exit 0.
- 07:08-07:10 Harness extended; run script, device commands and Node control script written.
- 07:10:19-07:10:21 Lane 1, host only: harness up, Node control run 7 of 7 PASS, harness stopped (`lockf` exit 0).
- 07:10:39 Lane 1, full run started. 07:10:40-07:13:58 waited for the phone lock (another row's session, Metro on 8085).
- 07:10-07:13 Meanwhile: shared suite 583 then 584 of 584; mobile suite 833 of 833; the client's default table type made to follow the contract module (CONTRACT-GAP-1); a query type hook (CONTRACT-GAP-2); Metro's release transform mirrored on `debug.ts`.
- 07:13:58 Phone lock held; Metro 8082 up; reverse rules set by `device-session.sh`. 07:14:00 `am start` of the deep link: "unable to resolve Intent".
- 07:14-07:16 Diagnosis with read-only `adb`: package installed and debuggable, filters present, but user 0 `RUNNING_LOCKED` and `isKeyguardShowing=true` on all three emulators; the other row's start at 07:08:43 got the same result code (-91).
- 07:16:51 My device session ended early (TERM to my own session shell); Metro stopped, reverse rules removed, harness stopped; no listener on 4421 or 8082.
- 07:17-07:19 Release check with real bundles: `expo export --dev` holds the probe, the client and `expo/fetch`; `expo export` (release) holds none of them. The URL parser was made module-private so that the release bundle drops it too.
- 07:19-07:20 Final gates: typecheck and lint exit 0 for `@dems/shared` and `@dems/mobile`; shared 584 of 584; mobile 833 of 833.
- 07:20 `device_w12.sh` now stops at once (exit 69) on a locked device or a failed `am start`.
- 07:20-07:27 Evidence copied to `implementation/assets/12_*`; documents written.
- 07:27 Controller note (ruling D33): unlock the emulator with the README procedure. Not carried out: the three emulators were read (all `RUNNING_LOCKED`) and a read-only wait for an unlock by the device's owner was started.
- 07:28 Controller note: D33 withdrawn. The read-only wait was stopped. **Not unlocked**: this row sent no input to any lock screen and ran no unlock command; at 07:28:18 all three emulators are still `RUNNING_LOCKED`; no reverse rule on `dems_phone`; no listener on 4421 or 8082. `.cache/proof-harness/run_w12.sh` is ready for the re-run after the user has unlocked the emulators.

## Verification (the row's cell), with the place of the quoted output

| Point | Result | Where |
|---|---|---|
| `adb logcat -d` shows the probe lines: GET `getServiceHealth` 200 zod-valid; POST `createSession` 201 zod-valid; POST `exportEvidence` 403 as `ApiError`; a socket with an `Authorization` header and its close code | **Not run: blocked (F34-1)** | 12_typed_client_emulator_proof.md §8 |
| The harness log shows which `Origin` arrived on the REST calls and on the upgrade | **Not run: blocked.** Static reading only, labelled as such | §10 |
| `npm run test -w @dems/shared -- --maxWorkers=2` exits 0 with the `client-*` tests | Pass: 584 of 584 in 31 files (508 + 76) | §3, §11 |
| `npm run typecheck`, `npm run lint` for `@dems/shared` and `@dems/mobile` | Pass: four times exit 0 | §11 |
| `npm run test -w @dems/mobile -- --maxWorkers=2` still 833; the release-gate test unchanged | Pass: 833 of 833 in 72 suites; the file's hash equals `acaff20`'s | §11, §5.3 |
| The probe is unreachable in a release build | Pass: Metro's release transform drops the `require`; the release bundle holds no probe, hook, parser or client text; positive controls present | §5.3 |
| The same client against the harness under Node (control) | Pass: 7 of 7 | §7 |
| The reverse rule is removed; nothing listens on 4421; Metro is stopped | Pass: empty reverse list, `lsof` exit 1 | §13 |
| Test ledger (P24) | `@dems/shared` 508 → 584 (three new files named); `@dems/mobile` 833 → 833 | §11 |

## For the controller to record

**Findings**

- **F34-1 (blocker).** All three emulators are at the PIN keyguard since the cold boot of step 24: user 0 `RUNNING_LOCKED`, `isKeyguardShowing=true`. No DEMS activity can start (`am start` result -91 / -92), and `run-as` cannot write the app's preferences. This blocks W12's proof, step 35's launch check (its own start at 07:08:43 got -91) and every later device row. `README.md:141` holds the unlock line. Step 28's check could not see it: package state is readable while locked.
- **F34-2.** `device-session.sh` does not detect a locked device (it checks `sys.boot_completed` only); the sole sign is the warning "could not set the bundler location". A `dumpsys user` check for `RUNNING_UNLOCKED` with exit 69 would stop a session in seconds. Owner of the file: W13.
- **F34-3.** The client is 670 lines with types and comments (about 230 of runtime logic), not the "about 150" of TD-09.
- **F34-4.** No response header for the request ID is named in the contract; the client reads the envelope's `requestId` when the schema keeps it, else a header whose name is an option (default `x-request-id`).
- **F34-5.** The type of `x-dems-epoch` is not stated; the client returns it as text and the revision as an integer.
- **F34-6.** While lane 1 was mine, another row's device session mapped `tcp:4420 -> tcp:4421` on the phone. No request of it reached the harness.
- **F34-7.** Static reading, not measured: React Native's Android socket module adds `origin: http://<host>:<port>` of the URL it opens and a `Cookie` header when the platform cookie store holds one for that origin (`WebSocketModule.kt:99-127`); `expo/fetch` defaults to `credentials: 'include'` (`fetch.ts:71`), which the typed client overrides with `'omit'` on mobile. The real run measures all three.

**CONTRACT-GAPs** (nothing under `packages/shared/src/api/` was edited)

- **CONTRACT-GAP-1.** `CORE_API_OPERATIONS` is declared `readonly CoreApiOperation[]`, so no per-operation types can be derived. Exact change: declare the array `as const satisfies readonly CoreApiOperation[]`, export it as `CORE_API_OPERATION_TABLE`, and keep `CORE_API_OPERATIONS: readonly CoreApiOperation[] = CORE_API_OPERATION_TABLE`; 2xx response specs stay inline literals. The client's default table type already looks for that export name, so closing the gap needs no edit in `src/client`. Until then: any string ID, loose input, `data: unknown`; runtime validation unchanged.
- **CONTRACT-GAP-2.** `CoreApiOperation` has no query member (API-9 lists use `cursor` and `limit`). Exact change: `query?: { schema: CoreApiSchemaName }`. Until then `input.query` is an unvalidated flat record, sent on GETs only.

**Decisions needed**

- **D34-1.** Who unlocks the emulators (recommendation: the user runs the README line on the three emulators; then this row's one command is run again).
- **D34-2.** CONTRACT-GAP-1 goes to W19 with the binding export name `CORE_API_OPERATION_TABLE`.
- **D34-3.** CONTRACT-GAP-2 goes to the contract row that adds the first list read.
- **D34-4.** A non-envelope answer: `transport` is `CORE_OFFLINE` only for 502, 503, 504 (WT-4), `UNAVAILABLE` otherwise (CL-21). Confirm or correct for W44.
- **D34-5.** Pin the request-ID response header (`x-request-id`) in the contract, or keep the envelope member only.

**Deviations from the plan**

1. The emulator proof is not done (F34-1).
2. The probe has twelve checks instead of four (fetch identity, raw answer shape, contract violation, no answer, time-out, close code 4401 added).
3. A Node control run inside the lane lock, to tell a harness or client fault from a device difference.
4. `fetch` is optional in the client (CL-3: the global is the default); both paths are in the probe.
5. Two `expo export` runs into a temp folder for the release check; nothing in the tree changed.
6. Evidence copies under `implementation/assets/12_*`.

**Processes.** Started and stopped by this row: two harness processes (14637, 15183), one Metro (18279, through `device-session.sh`), one device session (ended by TERM to my own shell 18237), one log monitor, test and export runs. Nothing is left; no process of another row was touched; no emulator was killed, booted, wiped, unlocked or changed.

## Follow-up: contract A adaptation (controller request after W19; 08:46 to 08:56 WIB)

Code only: no device, no emulator, no harness process, no Metro, no port. Nothing under `packages/shared/src/api/**` was edited. Details and quoted output: `implementation/12_typed_client_emulator_proof.md` section 16.

| Field | Value |
|---|---|
| Status | **complete** (the emulator proof of the row stays open) |
| Literal table as the client's default | **Yes**, with no change under `src/api/**`: the default table type is `CoreApiOperationTable` (already exported by `core-api.ts`); the run-time default stays `CORE_API_OPERATIONS`. `call(operationId, ...)` is typed per operation. The loose form is `operations: CORE_API_OPERATIONS` |
| `npm run typecheck -w @dems/shared` | exit 0 |
| `npm run test -w @dems/shared -- --maxWorkers=2` | 804 passed of 804 in 44 files, exit 0 (W19 left 784 passed, 1 failed; this row's files 76 → 95) |
| `npm run typecheck -w @dems/mobile`; lint of both | exit 0; exit 0; exit 0 |
| `npm run test -w @dems/mobile -- --maxWorkers=2` | 833 passed of 833 in 72 suites, exit 0; release-gate test hash equals `acaff20`'s |
| Release bundle (re-run: `dev-probes.ts` changed) | No probe, hook, parser or client text in the release bundle; positive controls present; the development bundle holds the probe and the client |
| Second runs (P11) | None needed: no run failed |

### Files updated

| Path | Change |
|---|---|
| `packages/shared/src/client/core-client.ts` | Default table type `CoreApiOperationTable`; `epoch` an integer; request ID from `x-request-id`, else from the envelope; `details` and `requestId` carried in `failure.error`; the query of a GET parsed with `operation.query.schema`; no parse for a success without a body; header names imported from the contract (the four `*_HEADER` exports kept as aliases, a test of W19 imports them); option `requestIdHeader` removed |
| `packages/shared/src/client/index.ts` | `parseCounterHeader` exported; `RegistryTableOf` removed |
| `packages/shared/test/client-core.test.ts` | By-design changes 2 to 6 below; 18 tests added (63 → 81) |
| `packages/shared/test/client-types.test.ts` | By-design changes 1 and 7 below; the default-client block (6 → 7) |
| `apps/mobile/src/runtime/dev-probes.ts` | Request bodies typed by parsing the contract's examples with the registry schemas; `epoch` checked as an integer |
| `docs/.../implementation/12_typed_client_emulator_proof.md` | Section 16 appended; one row in the top table; two pointers (sections 2 and 4) |
| `docs/.../implementation/assets/12b_gate_static.log`, `12b_gate_shared_test.log`, `12b_gate_mobile_test.log`, `12b_release_bundle_check.log`, `12b_harness_canned_check.txt`, `12b_canned_check_w12.mjs` | Created |
| `.cache/proof-harness/canned_check_w12.mjs`, `.cache/rollback/W12b.*.pre` (git-ignored) | Created: the harness's start check without a port; pre-images of the changed files |
| This file | Updated |

Not changed: `apps/mobile/src/runtime/debug.ts`, `packages/shared/test/client-platform-neutral.test.ts`, the harness and the run scripts.

### By-design test changes (line numbers before the follow-up, then now)

1. `packages/shared/test/client-types.test.ts:123` → `:128-131`. `toEqualTypeOf<{ code: string; message: string }>()` became `toEqualTypeOf<ApiError['error']>()` plus `toExtend<{ code: string; message: string }>()` and two lines for the types of `details` and `requestId`. Reason: the envelope's two new optional members (01_specs §7.2; W19 F-1 a).
2. `packages/shared/test/client-core.test.ts:118` → `:138-139`. The example is taken only for a status that has a schema. Reason: five operations answer 204 without a body (W19 F-1 b).
3. `packages/shared/test/client-core.test.ts:129-130` → `:152`. `expect(schemaName).toBeDefined()` removed; a success without a schema must have `data` undefined. Reason: the same.
4. `packages/shared/test/client-core.test.ts:145` → `:165-166`. "at least as many exchanges as operations" became "exactly one exchange per documented status" and "at least 37 operations". Reason: stronger, and it counts the 204 answers.
5. `packages/shared/test/client-core.test.ts:413` → `:434-435`. `epoch: '3'` became `epoch: 3`, and both values are checked to be integers. Reason: `x-dems-epoch` is an integer (API-7 as stated by W19; D36).
6. `packages/shared/test/client-core.test.ts:416-420` → `:443-447`. A malformed epoch is `null`, no longer passed on as text. Reason: the same.
7. `packages/shared/test/client-types.test.ts:163-173` → removed; replaced by the block at `:172`. The test of the helper type `RegistryTableOf` went with that type. Reason: the default is the registry's literal table itself.

Set-up changes that the typed default requires (no assertion): `client-core.test.ts:86`, `:406`, `:736` pass `operations: CORE_API_OPERATIONS`.

### Log

- 08:46-08:48 Read `19_contract_a.md` (model, envelope, 204 operations, section 8, F-1, F-2, DR-1, DN-8), the proposed patch, the measured errors, `operation-table.ts`, `contract-model.ts`, `constants.ts`, and W19's uses of the client (`api-registry.test.ts`, `api-envelope.test.ts:28`).
- 08:48 Pre-images saved to `.cache/rollback/W12b.*.pre`.
- 08:49-08:50 Client changed. First typecheck: W19's `api-envelope.test.ts` imports the client's four header constants, so they were kept as aliases of the contract's.
- 08:51-08:52 Tests adapted and extended; `dev-probes.ts` typed. Shared typecheck exit 0; client tests 95 of 95.
- 08:53 Shared suite 804 of 804. The harness's canned answers checked against the new registry without a port: all valid.
- 08:53:28-08:54:02 Mobile suite 833 of 833.
- 08:54 Two new bundles (`expo export --dev`, `expo export`): release bundle clean.
- 08:54:51-08:55:12 Final gates, all exit 0. Evidence copied to `implementation/assets/12b_*`; section 16 written.

### For the controller to record (follow-up)

- **Closed:** CONTRACT-GAP-1, CONTRACT-GAP-2 (in use now); D34-2, D34-3, D34-5; F34-4, F34-5. **Still open:** D34-1 (the unlock, with the user), D34-4 (transport reason of an answer without an envelope).
- **F34-8.** A client made without `operations` is now strictly typed. A loop over the registry or a test that sends invalid input on purpose passes `operations: CORE_API_OPERATIONS`. For W18, W30, W31, W44.
- **F34-9.** The comment of `packages/shared/src/api/operation-table.ts:14-21` describes a switch that is no longer needed; a later contract row can shorten it. Nothing has to move.
- **F34-10.** A POST 2xx whose `x-dems-epoch` or `x-dems-revision` is missing or not an integer is still a success with `null` there; how the Live source reacts is W44's decision (CL-17).
- **F34-11.** The query is sent as the schema's output, so a query schema must yield a string, a number or a boolean per member. For contract C.
- **Deviation.** The four `*_HEADER` exports of the client were kept as aliases instead of removed (W19's `api-envelope.test.ts:28, 209-212` imports them).

## Device part: the emulator proof (controller note of 11:01; 11:02 to 11:07 WIB)

Details and quoted output: `implementation/12_typed_client_emulator_proof.md` section 17.

| Field | Value |
|---|---|
| Status | **complete** |
| Device | `dems2_phone` = `emulator-5554`, lane 1; lock-free (no keyguard); nothing typed, no lock or device setting read, set or changed by this row |
| Command | `/usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock /bin/sh .cache/proof-harness/run_w12.sh` (the proof harness on 127.0.0.1:4421, device `tcp:4420` by `DEMS_CORE_HOST_PORT=4421`, Metro 8082). Not used: the Core server, port 4420, any project database |
| Run 1 (11:04:20 to 11:04:32) | 13 PASS, 1 FAIL: P0a. The probe assumed that the global `fetch` is the function `expo/fetch` exports; on the device it is Expo's wrapper `_fetch` around it. All REST and socket checks passed |
| Run 2 (11:06:30 to 11:06:40) | **15 PASS, 0 FAIL**, after the probe's fetch check was corrected (it now also requires that the answer has the class of an `expo/fetch` answer) and a cookie-store measurement was added |
| The row's four lines | P1 GET `getServiceHealth` 200 zod-valid (request ID `req-000014` on both sides); P2 POST `createSession` 201 zod-valid, epoch 1, revision 103 (`req-000018`); P3 POST `exportEvidence` 403 as `ApiError`, class `FORBIDDEN` (`req-000020`); P9 socket with `Authorization` in the upgrade, echo, close code 4403 (P10: 4401) |
| `Origin` | REST: none. Socket upgrade: `http://127.0.0.1:4420` |
| Afterwards | Reverse list empty; app not running; Simulated mode, sign-in screen (screencap); the same two stored keys as before; no cookie left; no listener on 4421 or 8082; no keyguard |

### Log (device part)

- 11:02-11:03 Read the new header of `device-session.sh` (AVD prefix, exit 77). Probe extended: request ID in failure lines; P11 and P12 (the harness's dummy cookie is deleted again; it also has `Max-Age=60`). Device script: lists the app's stored keys before and after; stops with 77 on a locked user. The harness's canned answers checked against the 75-operation registry without a port: valid.
- 11:03 Typecheck of shared and mobile red (TS2590, contract C; not from this part). Run time unaffected, so the device run went first, as the controller ordered.
- 11:04:03 A first command line of mine ended before `lockf` (a file pattern that matched nothing); no effect.
- 11:04:20-11:04:32 Run 1: 13 PASS, 1 FAIL (P0a).
- 11:05 Cause found in `@expo/metro-runtime/src/location/install.native.ts:55-91`. Probe corrected; P1b added.
- 11:06:30-11:06:40 Run 2: 15 PASS. 11:06:55 read-only checks: reverse list empty, app not running, nothing listening.

## Contract C adaptation (controller decision D64; 11:07 to 11:10 WIB)

Details: `implementation/12_typed_client_emulator_proof.md` section 18. Done after the device session, so no running app saw a file change. Nothing under `packages/shared/src/api/**` was edited.

| Field | Value |
|---|---|
| Status | **complete** |
| Patch | `implementation/assets/27_proposed_client_changes.patch` applied as proposed (`git apply -p0`, exit 0); no deviation |
| `packages/shared/src/client/core-client.ts:244-247` → `:243-253` | Type only: the helper `InputOfOperation<Op>` (distributive) replaces `ParamsOf<U> & BodyOf<U> & QueryOf<U>` over the union of all operations, which is n × n × n members and refused above 100,000 (n = 47; TS2590). The comment at the type names the limit |
| By-design test change | `packages/shared/test/client-core.test.ts:483-485` → `:482-490`: the loop over the 204 operations also passes `examples.pathParams` (ten of contract C's 204 operations have `{id}`) |
| Regression test (new) | `packages/shared/test/client-types.test.ts:208-232`, against the full registry (75 operations): the input over all IDs can be evaluated; a literal ID's input is that operation's own intersection; mixed parts are refused. The unknown-ID compile error is covered by `:238-239`; the four directives that were "unused" before the fix (`:240-247`) are in use again |
| `npm run test -w @dems/shared -- --maxWorkers=2` | 1,406 passed of 1,406 in 57 files, exit 0 (1,405 of the contract row plus this regression test) |
| `npm run typecheck` for `@dems/shared`, `@dems/mobile`, `@dems/core-web`, `@dems/core-server` | exit 0, four times |
| `npm run lint` for `@dems/shared`, `@dems/mobile` | exit 0, twice |
| `npm run test -w @dems/mobile -- --maxWorkers=2` | 833 passed of 833 in 72 suites, exit 0; release-gate test unchanged |
| Release bundle (re-run: `dev-probes.ts` changed) | No probe, hook, parser or client text; positive controls present |
| Second runs (P11) | None needed |

### Files created or updated (device part and contract C)

| Path | Change |
|---|---|
| `packages/shared/src/client/core-client.ts` | `InputOfOperation` (type only) |
| `packages/shared/test/client-core.test.ts` | The by-design change above |
| `packages/shared/test/client-types.test.ts` | The regression test (7 → 8 tests; the three client files hold 96) |
| `apps/mobile/src/runtime/dev-probes.ts` | P0a and P0b corrected, P1b, P11, P12 added, request ID in failure lines |
| `docs/.../implementation/12_typed_client_emulator_proof.md` | Sections 17 and 18 appended; result line, status and top table updated |
| `docs/.../implementation/assets/12c_*` (20 files) | Two device runs (logs, harness logs, logcat lines, screencaps, app data listings), the scripts as run, gate logs, the diff, the release bundle check |
| `.cache/proof-harness/harness.mjs`, `device_w12.sh`, `host_control_w12.mjs`, `out_w12/**`; `.cache/rollback/W12c.*.pre`, `W12d.*.pre` (git-ignored) | Updated / created |
| This file | Updated |

Not changed: `apps/mobile/src/runtime/debug.ts`, `packages/shared/src/client/index.ts`, `client-platform-neutral.test.ts`, `device-session.sh`, anything under `packages/shared/src/api/**`.

### For the controller to record (device part and contract C)

- **F34-12.** The app's global `fetch` is Expo's wrapper `_fetch` around `expo/fetch` (`@expo/metro-runtime/src/location/install.native.ts:55-91`), in debug and release builds. Its answers have the class of an `expo/fetch` answer. The client is unaffected.
- **F34-13 (security).** React Native's socket sends the cookie store's cookie for the host on the upgrade, next to the bearer header (measured). 01_specs §9.2 answers a cookie together with `Authorization` with 401 (ID-12). The store is filled only by a fetch with default options; the typed client (`credentials: 'omit'`) neither sends nor stores one (both measured). Cookies are scoped by host, not by port.
- **F34-14.** REST calls carry no `Origin`; the upgrade carries `http://127.0.0.1:4420`; `Host` is `127.0.0.1:4420` also for a lane backend; `User-Agent` `okhttp/4.12.0`; the upgrade offers `permessage-deflate`.
- **F34-15.** Close codes 4403 and 4401 reach the app with their reason text: CA-08 holds.
- **F34-16.** Hermes V1 `250829098.0.17`, React Native 0.86.3, API 36. zod validates on the device without `jitless`. The abort of a timed-out request works (the harness logged it).
- **F34-18.** Residue on `dems2_phone`: the app's runtime log grew to 2,686 bytes and holds one error record of run 1's FAIL; the bundler-location preference written by `device-session.sh`. No setting of the app changed; no cookie left.
- **D34-6 (decision needed).** How a cookie is kept off the mobile socket: (a) every request of the app to the Core origin goes through the typed client, enforced by a static test in the mobile app; (b) the server never sends `Set-Cookie` on an answer to a device's bearer or public request, and its "cookie and bearer together" refusal looks only at its own cookie name (W23, W24, W42); (c) F34-13 goes to the security review (W45).
- **Closed.** D34-1 (the unlock): by the lock-free emulators. F34-1, F34-2: by row W02b (exit 77). The emulator proof of the row.
- **Deviations.** The probe has 15 checks (12 before the device part). Two device runs instead of one, both recorded. The harness and the device script were extended (cookie clean-up, app data listing).

## Fix round after CP-C1 (decision D80; 13:08 to 13:15 WIB)

Details: `implementation/12_typed_client_emulator_proof.md` section 19. Written only: `packages/shared/src/client/core-client.ts` and the new `packages/shared/test/client-credentials.test.ts`.

| Field | Value |
|---|---|
| Status | **complete** |
| CPC1-3 (Medium) | Fixed. The credential provider runs inside the call's one time-out budget. A provider that rejects: `kind` `CREDENTIALS`, code `CREDENTIALS_UNAVAILABLE`. A provider that does not answer in time: `kind` `CREDENTIALS`, code `CREDENTIALS_TIMEOUT`. Both `status: null`, `transport: 'CORE_OFFLINE'`, no provider text and no token in the message. A provider that answers after the time-out sends nothing and throws nothing |
| CPC1-12 (Low) | The contract exports three patterns and no prefix constant (`api/patterns.ts:52-54`). The client keeps its expression under a `CONTRACT-GAP-4` comment (`core-client.ts:59-70`); five tests tie it to every token pattern the contract exports |
| Red before / green after | 8 of the 18 new tests fail on the unchanged client (`84db3a2f…`), all 18 pass on the fixed one (`37a7782b…`); the prefix test fails when `bio` is removed from the guard |
| API change | Additive: `CoreErrorKind.CREDENTIALS`; codes `CREDENTIALS_UNAVAILABLE`, `CREDENTIALS_TIMEOUT`; `coreTransportReason` gives `CORE_OFFLINE` for it. No export removed, no option added, `index.ts` unchanged. Behaviour: one budget; the input is checked before the provider is asked |
| Live source | Nothing to change: `transportErrorOf` already turns it into `LiveTransportError('CORE_OFFLINE', { code })` |
| `npm run test -w @dems/shared -- --maxWorkers=2` | 1,668 passed of 1,668 in 65 files, exit 0 (baseline 64 / 1,650; plus `client-credentials.test.ts` with 18) |
| `npm run typecheck` for `@dems/shared`, `@dems/mobile`, `@dems/core-web`; `npm run lint -w @dems/shared` | exit 0, four times |
| Mobile | No mobile file edited; `dev-probes.ts` type-checks; release-gate test hash unchanged |
| Second runs (P11) | None needed |

### Log

- 13:08-13:10 Read `gateway_check/07_cp_shared_client.md` (CPC1-3, CPC1-12), the contract's `patterns.ts`, the Live source's `rebuild-error.ts`.
- 13:10-13:12 New test file written first; run against the unchanged client: 8 failed, 10 passed (`assets/12d_cpc1_red_before.log`).
- 13:12-13:13 The fix in `core-client.ts`. The same tests: 18 passed (`assets/12d_cpc1_green_after.log`). Mutation of the prefix expression: one test fails; file restored.
- 13:13:39-13:14:00 Gates: typecheck of shared, mobile, core-web and lint of shared exit 0; shared suite 1,668 of 1,668.
- 13:14-13:18 Evidence copied to `implementation/assets/12d_*`; section 19 written.

### For the controller to record

- **CONTRACT-GAP-4.** For the contract close-out row (W83), in `packages/shared/src/api/patterns.ts`: `export const BEARER_SECRET_PREFIXES = ['ses_', 'dvc_', 'bio_'] as const;` (the three patterns can be built from it). The client then builds its guard from that list.
- **F34-19.** CPC1-3 was real in all three forms: a hang, a rejection carrying the provider's text, and a late request.
- **F34-20.** The old order read a credential also for a call that was then refused as invalid; the new order does not.
- **F34-21.** The provider gets no abort signal and may still be running after the time-out; the client ignores its late answer. The reviewer's rule for W51 stays sensible: the provider returns a value held in memory.
- **For W44 and the presenter rows.** The new failure arrives as `LiveTransportError('CORE_OFFLINE')` with `code` `CREDENTIALS_UNAVAILABLE` or `CREDENTIALS_TIMEOUT` and `status: null`: word it as "nothing was sent" (LB-6), not as a time-out (LB-7).

