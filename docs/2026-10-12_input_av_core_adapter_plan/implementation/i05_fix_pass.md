# i05 - fix pass I-5 (the three failures and the lint warning of suite run c03)

Tier 3. Branch `task4/input-av-core-port`, uncommitted tree on top of `b7ed4c60`. Source of the list: `test/c03_suite_run_batch_4_5.md` (F1, F2, F3, the lint warning, the two untracked scan hits). Nothing else was changed; nothing committed, staged, stashed or cleaned. Every edit made with the Edit tool. Claim: one line in `delegation_progress/file_claims.md` ("fix pass I-5").

## Changes

| # | File:line | Before | After |
|---|---|---|---|
| F1 | `apps/core-server/src/capture/__tests__/forwarder.test.ts:17` | imports `CAPTURE_WORKER_PROCESS_SETTINGS` from `../index` | also imports `CAPTURE_WORKER_PRODUCTION_SETTINGS` and `PRODUCTION_INGEST_OPEN_WINDOW_MS` (both exported by `src/capture/index.ts:64`) |
| F1 | same file `:433` (now `:433-437`) | `expect(readFileSync(argsFile...)).toEqual([..., ...captureWorkerSettingArguments(CAPTURE_WORKER_PROCESS_SETTINGS)])` | the list is read once into `words`; expected `...captureWorkerSettingArguments(CAPTURE_WORKER_PRODUCTION_SETTINGS)`; plus `words[indexOf('--ingest-open-window-ms') + 1]` is `String(PRODUCTION_INGEST_OPEN_WINDOW_MS)`. No second literal |
| F1 | same file `:445-459` (NEW, one case beside it) | - | "mode real with the development-sources flag set": `unitTestConfig({ captureMode: 'real', captureDevSources: true, ... })`; the worker's words equal the list built from `CAPTURE_WORKER_PROCESS_SETTINGS`; the window word is `CAPTURE_WORKER_PROCESS_SETTINGS.ingestOpenWindowMs`; and that value is not the production constant (so the two cases cannot pass on one number) |
| F2 | `packages/shared/test/api-stt-config.test.ts:308` (now `:309`, one comment line above) | `toHaveLength(171)` | `toHaveLength(172)` (delta +1: the optional body of op 93, row 94); operations pin stays 99 |
| F3 | `apps/core-server/test/acceptance/contract.test.ts:1952-1954` (now `:1952-1967`) | `NOT_PRODUCED` = the statuses of `UNROUTED_OPERATIONS` only | NEW named list `LANDED_UNANSWERED` (`'startCaptureDiscovery 422'` -> "the Core ignores `address` until task 4 row 96 (LANDED_UNANSWERED)"), with a comment in the form of `LANDED_UNROUTED`; `NOT_PRODUCED` = the unrouted statuses spread with that list |
| F3 | same file, the coverage test, after `expect(stale).toEqual([])` (now `:2089-2096`) | - | `deferred` = the documented cells not produced whose key is in `LANDED_UNANSWERED`; printed (`[w52] documented responses deferred to a named row ...`); `expect(deferred).toEqual(['startCaptureDiscovery 422'])`; `expect(Object.keys(LANDED_UNANSWERED)).toEqual(deferred)`; no deferred entry belongs to an unrouted operation |
| L1 | `apps/core-server/src/modules/capture-config/credential-reader.ts:204` | `/^([0-9A-Za-z.\-]{1,100})(?::([0-9]{1,5}))?$/` | `/^([0-9A-Za-z.-]{1,100})(?::([0-9]{1,5}))?$/` (a hyphen last in a class is the literal hyphen: the same set of characters) |

### F1: is the test's configuration the production operation? Yes.

- The test builds `unitTestConfig({ logLevel: 'info', dataDir, captureMode: 'real', captureWorkerPath: command })` (`forwarder.test.ts:425`). `unitTestConfig` sets `demoControls: false` and passes no `captureDevSources` (`apps/core-server/test/support/config.ts:27-46`); `createConfig` defaults it to `false` (`src/config.ts:397`) and the listen host is the loopback constant (`src/config.ts:379`).
- `captureOperationDecisionOf` (`src/capture/fence/operation.ts:72-80`): real, not development, not demo -> `REAL_PRODUCTION`.
- `src/capture/index.ts:171` passes `operation === CaptureOperation.REAL_PRODUCTION` to `captureWorkerArguments`, which then uses `CAPTURE_WORKER_PRODUCTION_SETTINGS` (`src/capture/worker-arguments.ts:64-82`, window `PRODUCTION_INGEST_OPEN_WINDOW_MS`).
- So the received value is the designed one (AD-11); the expectation was stale. The source was not touched.

### F3: how the deferral holds

- A deferred entry that is not on the list: it has no reason -> `missing` is not empty -> fails (unchanged check).
- A listed entry that becomes produced (row 96): `stale` is not empty -> fails (unchanged check); `deferred` also no longer equals the literal.
- An entry added to the list, or a listed key that is no documented cell (a typing error, or the 422 taken out of the contract): `deferred` / `Object.keys(LANDED_UNANSWERED)` no longer equal the literal -> fails.
- No 422 is faked; the contract (`packages/shared`) was not edited. Row 96 produces the 422 in this file and deletes the entry and the literal.

## Checks (one run each, all passed at the first run)

| Check | Command | Sandbox | Result line |
|---|---|---|---|
| forwarder, credential reader (unit) and the unit's static test | `npx vitest run --project unit --maxWorkers=2 src/capture/__tests__/forwarder.test.ts src/modules/capture-config/__tests__/credential-reader.test.ts src/modules/capture-config/__tests__/static.test.ts` (in `apps/core-server`) | off (starts a process) | `Test Files  3 passed (3)` / `Tests  54 passed (54)` |
| shared pins | `npx vitest run --maxWorkers=2 test/api-stt-config.test.ts test/api-openapi-scope.test.ts` (in `packages/shared`) | on | `Test Files  2 passed (2)` / `Tests  73 passed (73)` |
| contract acceptance file and the credential reader's database test | `/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock npm run test:db -- --maxWorkers=2 test/acceptance/contract.test.ts src/modules/capture-config/__tests__/credential-reader.db.test.ts` (repository root; README "Tests": `npm run test:db`, PostgreSQL, throw-away databases, outside the sandbox) | off | exit 0; `Test Files  2 passed (2)` / `Tests  53 passed (53)`; `[test:db] teardown: dropped 3 database(s) in 76 ms; 0 remain with the run prefix dems_test_local_tmt5wl8w_`. No `db:migrate`; the demo and lane databases were not touched |
| lint | `npm run lint -w @dems/core-server` | on | exit 0, no finding printed; `npx oxlint | grep -c "warning\|no-useless-escape"` -> `0`. `npm run lint -w @dems/shared`: exit 0, no finding |
| typecheck | `npx tsc --noEmit` in `apps/core-server` and in `packages/shared` | on | exit 0 and exit 0 |

Not run: any full suite (as instructed). The `[w52]` print of the deferred list is a `console.info` of the coverage test; the log of the database run did not carry console output, so the print itself was not observed - the equality that pins the same list passed.

## S1 - judgement of the secret-scan hits in the two untracked files (decision C23), read only

Neither file was edited. The lines were found with the scan's own three patterns.

| File | Needle (count) | Lines | What the matched text is | Judgement |
|---|---|---|---|---|
| `apps/capture-worker/test/announce_test.c` | ingest-secret (3) | 203 (twice), 204 (once) | One string literal written three times in a unit check of the log-withholding function: loopback address at the test listener port 8559, path of the fixed test session `S-0001`, track `VIDEO-01`, and a 22-character mixed-case-and-digit element typed into the source (`Kq7x...nH8`). The same element is passed beside it as the text to be withheld. It appears in no other file of the tree; a real ingest secret is made at random per session and never in a source file | SYNTHETIC placeholder inside a test - allowed by C23 |
| `scripts/hardware-acceptance/test_hw_collectors_host.sh` | camera-credential (1) | 20 | `PLANTED_LOCATOR`: an RTSP locator with the account name `admin`, the password part being the shell variable `$PLANTED_PASSWORD` (not a value), a private-range address `192.168.50.20:554` and a vendor-style stream path. The variable is set on line 19 to the well-known joke word `hunter2` followed by `-Planted-Pass`; it is planted so the test can prove the collectors never print it | SYNTHETIC - allowed. Remark: the host is a private-range address, not a documentation address; nothing shows it is a real device, the controller may want `192.0.2.x` there (the owning rows' file) |
| same file | database-locator (2) | 237, 489 | Two fixture texts (a fake `sudo` profile line marked "a line that must never be printed as it is", and a fake `db:status` output) with role `dems_owner`, password part `$PLANTED_PASSWORD` again, loopback at port 5432 and database name `dems_demo`. Role and database names are this project's public names; the port is not the project's (4432); the password is the planted variable | SYNTHETIC - allowed |

No hit looks like a real value.

## Driver decisions

- DRIVER DECISION: the deferral list is named `LANDED_UNANSWERED` (a routed operation whose documented response the Core cannot answer yet), beside `LANDED_UNROUTED`; the list is pinned by a literal in the coverage test in addition to the constant, so growing the list needs a second, visible edit.
- DRIVER DECISION: the credential reader's static test and database test were run with the two requested files, because they are the "existing tests" of the edited expression.

## Unproven

Nothing of this pass needs hardware. The production window itself (30 s, hypothesis HA-8) stays with `9A/H-21`.

---
*Generated: 2026-10-13 01:58*
