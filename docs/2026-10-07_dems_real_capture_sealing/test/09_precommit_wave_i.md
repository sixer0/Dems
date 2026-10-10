# Pre-commit whole run, wave I (2026-10-10)

Runner: test-runner agent (decision D122). Tree: commit `74fd1f1` plus the uncommitted work of fix wave I (194 entries in `git status --short` at the start). Procedure: `test/08_precommit_wave_h.md`, extended with the kill matrix and the seal e2e as `test/07_checkpoint_wave_h.md` ran them, and with the checks listed in notes 131 to 135. Sequential, from the repo root, sandbox off for everything that binds loopback or talks to PostgreSQL (typecheck and lint ran inside the sandbox). `env | grep ^DEMS_` printed nothing at the start; the only flags set were `DEMS_SEAL_E2E=1` (+ `DEMS_SEAL_E2E_OUT`), `DEMS_KILL_MATRIX` (set by `run.sh`) and `DEMS_DEV_SESSION_E2E=1`, each on its own command. No product file and no test file changed; no git write; lanes stayed stopped (`lane.sh status`: main, 1, 2, 3 all `stopped` at the end), Metro and the emulators untouched; `pgrep -fl 'capture-worker|ffmpeg|whisper'` empty at the end. No local device selected, no `DEMS_*_ATTENDED`, no `.data/pg*.env` read, no port 5173-5175 / 8000 / 5432. Load average: 2 to 6 at every start; it rose to 19.7 at the end of the core-web run, so I waited (to 4.8) before the mobile run.

## Result: RED overall, 4 reds in 3 files (db 3, mobile 1); every other check green

Each check ran once. Only the three red files were run a second time: the same failures, byte for byte in the assertions, so none is a flake.

| # | check | command | result | counts (files / tests) | duration |
|---|-------|---------|--------|------------------------|----------|
| 1a-g | typecheck x 7 | `npm run typecheck -w @dems/<ws>` (shared, core-server, core-web, mobile, capture-protocol, transcriber, mock-core) | GREEN, exit 0 x 7 | 0 `error TS` in each | 3 / 9 / 12 / 6 / 0 / 2 / 2 s |
| 2a-g | lint x 7 | `npm run lint -w @dems/<ws>` | GREEN, exit 0 x 7 | 0 errors; mobile (eslint) 1 warning, the known `log.test.ts:160:19 @typescript-eslint/array-type`; six oxlint workspaces silent | 0 / 0 / 1 / 16 / 0 / 0 / 0 s |
| 3 | shared | `npm run test -w @dems/shared` | GREEN | 116 files; 2570 passed / 0 failed / 0 skipped | 6 s |
| 3b | capture-protocol | `npm run test -w @dems/capture-protocol` | GREEN (08 ran typecheck and lint only; 07 ran this) | 1 file; 31 passed | 1 s |
| 4 | core-server unit | `npx vitest run --root apps/core-server --project unit --maxWorkers=4` | GREEN | 338 files; 6517 passed / 0 failed / 0 skipped | 69 s |
| 5 | core-server db | `/usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2` | RED | 193 files: 188 passed, 2 failed, 3 skipped; 2429 tests: 2419 passed, 3 failed, 7 skipped | 246 s |
| 5r | db re-run of the two red files | `lockf db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=1 test/acceptance/pairing-lifecycle.test.ts src/engine/__tests__/commands.db.test.ts` | RED again, identical | 2 files failed; 51 tests: 48 passed, 3 failed | 8 s |
| 6 | core-web | `npm run test -w @dems/core-web` | GREEN | 176 files; 2069 passed / 0 failed / 0 skipped | 94 s |
| 7 | mobile | `npx -w apps/mobile jest --maxWorkers=2` | RED | 287 suites: 286 passed, 1 failed; 2693 tests: 2692 passed, 1 failed, 0 skipped | 177 s |
| 7r | mobile re-run of the red suite | `npx -w apps/mobile jest src/runtime/pending-control.test.tsx` | RED again, identical | 1 suite failed; 10 tests: 9 passed, 1 failed | not timed |
| 8a | transcriber | `npm run test -w @dems/transcriber` | GREEN | 20 files; 561 passed / 0 failed / 3 skipped (564) | 16 s |
| 8b | mock-core | `npm run test -w @dems/mock-core` | GREEN | 4 files; 19 passed | 4 s |
| 9 | seal e2e (built worker `apps/capture-worker/build/capture-worker`) | `DEMS_SEAL_E2E=1 DEMS_SEAL_E2E_OUT="$PWD/.cache/waveI/seal-e2e" lockf -k -t 3600 .locks/heavy-host.lock lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=1 src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts` | GREEN | 1 file; 3 passed | 46 s |
| 10 | kill matrix, all 35 active checks in one call | `apps/core-server/src/sealing/__tests__/kill-matrix/run.sh` with 35 x `--only <id>` (ids from `run.sh --list`, the 10 PARKED cells excluded by design) | GREEN | 1 file; 35 passed / 0 failed; teardown "0 remain" | 589 s |
| 11 | development-session e2e, generated sources (131 #4, 132, 135) | `DEMS_DEV_SESSION_E2E=1 lockf -k -t 1800 .locks/heavy-host.lock lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=1 src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts` | GREEN | 1 file; 2 passed, 2 skipped (the speech case needs `DEMS_DEV_SPEECH_SESSION_E2E`, the attended case is the user's) | 17 s |
| 12a | contract guard, shared | `npx vitest run --root packages/shared test/api-registry.test.ts test/api-openapi-scope.test.ts` | GREEN | 2 files; 66 passed | 1 s |
| 12b | contract guard, db | `lockf db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=1 test/acceptance/contract.test.ts` | GREEN | 1 file; 38 passed | 16 s |
| 12c | totals read directly | `node -e` over `packages/shared/openapi/openapi.json`; `AUDIT_TYPES` pin at `packages/shared/test/api-registry.test.ts:492`; `apps/core-server/src/db/schema/meta.ts:38,40` | GREEN | 97 operations: 36 GET / 61 POST (also pinned at `test/acceptance/contract.test.ts:456`); 67 audit types; `DB_SCHEMA_VERSION = 6`, `DB_CONTRACT_REVISION = 'dbc-7'`, `meta.ts` not in `git status` | - |
| 13 | pg-scripts suite | not run: 08 did not run one, and the repo has no such step in 08's list | - | - | - |

Skips: db 7 tests in 3 files (the env-gated runner checks `seal-e2e`, `development-session-e2e`, `kill-matrix`; rows 9, 10 and 11 ran them); transcriber 3 (host-conditional). Skipped names were not listed in the output and not looked up beyond that. Step 5 closing lines: `forced drops that needed a retry: 1 (1 refusal(s) with SQLSTATE 42501 ...; each drop then went through)`; `teardown: dropped 8 database(s) in 189 ms; 0 remain`. The db run showed no "remaining connection slots" error, and `restart.db.test.ts` / `session-capture.db.test.ts` did not fail (the 135 expectation holds). Mobile jest and core-web printed their usual console noise (`console.error` records, `HTMLMediaElement` not implemented); not failures.

## Red list (full)

### RED 1 and 2: `apps/core-server/test/acceptance/pairing-lifecycle.test.ts`, two tests (db project)

Both red in the whole run and again, identically, alone (8 s).

Test A: `SC5: a tablet is paired from the portal, used, revoked, refused and paired again; every step has its audit row > the investigator starts a recording from the tablet: the pre-check passes because the Core link is connected by the tablet's own socket`

```
AssertionError: expected [ [ 'SESSION_CREATED', …(2) ], …(2) ] to deeply equal [ [ 'SESSION_CREATED', …(2) ], …(2) ]
- Expected
+ Received
  [
    [ "SESSION_CREATED",    "OPR-001", -null, +"DEV-0001" ],
    [ "PRECHECK_PASSED",    "OPR-001", -null, +"DEV-0001" ],
    [ "RECORDING_STARTED",  "OPR-001", -null, +"DEV-0001" ],
  ]
 ❯ test/acceptance/pairing-lifecycle.test.ts:989:23
    989|     expect(who(rows)).toEqual([
    990|       ['SESSION_CREATED', INVESTIGATOR.id, null],
    991|       ['PRECHECK_PASSED', INVESTIGATOR.id, null],
```
(shown compacted: the runner prints each tuple member on its own line.)

Test B: `the audit trail of the whole journey > is exactly this sequence of types with their actors and devices; every row belongs to a step of this file; the chain verifies`

```
AssertionError: expected [ [ 'AUTH_SUCCESS', …(2) ], …(46) ] to deeply equal [ [ 'AUTH_SUCCESS', …(2) ], …(46) ]
@@ -115,21 +115,21 @@
   "SESSION_CREATED", "OPR-001", -null, +"DEV-0001"
   "PRECHECK_PASSED", "OPR-001", -null, +"DEV-0001"
   "RECORDING_STARTED", "OPR-001", -null, +"DEV-0001"
 ❯ test/acceptance/pairing-lifecycle.test.ts:1371:26
    1371|     expect(who(journey)).toEqual(expected);
```

Reading: the file is not in `git status` (neither the test nor `who()` at `:235` changed). The product now writes the paired tablet's `DEV-0001` as `deviceId` on the session rows SESSION_CREATED, PRECHECK_PASSED and RECORDING_STARTED sent from the tablet. That is exactly fix G75b-04 (D216 (2)) of note 132 (`132_fix_wave_i_a2.md`, row G75b-04: `sentFrom` in `packages/shared/src/sim/session-machine.ts`, optional `precheck.sendingDeviceId`). The pin of this acceptance file (`deviceId` null on those three rows, `:990-992`, and the matching rows of the journey list) was not moved with it; 132's section 7 list of edited tests does not name `pairing-lifecycle.test.ts`. **Owner: 132 A2 (adapters/audit; the sending device).** The expected value must be decided by A2: the new behaviour is the intended one per its note, so the pin is stale, not the product wrong (my reading; I changed nothing).

### RED 3: `apps/core-server/src/engine/__tests__/commands.db.test.ts` (db project)

Test: `the log of the engine (SR-48) > holds codes, counts, labels, action names and operator IDs; never an argument of a command, a slice or a row`. Red in the whole run and again alone (same file run together with RED 1/2, 8 s).

```
AssertionError: expected [ 'tabletLinkOfflineUnwritten' ] to deeply equal []
- Expected
+ Received
- []
+ [
+   "tabletLinkOfflineUnwritten",
+ ]
 ❯ src/engine/__tests__/commands.db.test.ts:741:114
    741|     expect([...new Set(engineLines.flatMap((line) => Object.keys(line).filter((key) => !engineKeys.has(key))))]).toEqual([]);
```

Reading: the test holds an allow-list (`engineKeys`, ends at `:735`) of the keys an engine log line may carry. The engine's `engine started` line now carries one more key, `tabletLinkOfflineUnwritten` (`apps/core-server/src/engine/host.ts:1044`, fed by `rehydrate.ts:245,384`), added by the G75b-03 fix (a process start of a Core in its own capture puts the stored link OFFLINE without a row). The key is a boolean, not a secret, so the guard's purpose (SR-48) is not hit, but the list was not extended. The file is not in `git status`. `wave-i-a2-graceful-restart.test.ts:85,101` proves the member's meaning. **Owner: 132 A2** (`engine/host.ts` and `engine/rehydrate.ts` are in A2's edited list, section 7; the `rehydrate.ts` ownCapture/Pass-J change that came after is 135 pass J's, but the member is A2's).

### RED 4: `apps/mobile/src/runtime/pending-control.test.tsx` (mobile jest)

Test: `one helper in the app (row M1 follow-up) > every caller takes the helpers from the barrel`. Red in the whole run and again alone (1 failed, 9 passed).

```
expect(received).toEqual(expected) // deep equality
- Expected  - 1
+ Received  + 0
@@ -2,7 +2,6 @@
    "devices/busy-state.ts",
    "devices/device-command-dialog.tsx",
    "devices/device-detail.tsx",
    "devices/diagnostics-sheet.tsx",
    "session-new/devices-check-step.tsx",
-   "session-new/session-new-screen.tsx",
  ]
  111 |   it('every caller takes the helpers from the barrel', () => {
  112 |     const users = matching(/\b(?:busyState|PendingSpinner)\b/);
> 113 |     expect(users).toEqual([
at Object.toEqual (src/runtime/pending-control.test.tsx:113:19)
```

Reading: the test lists the files that use `busyState` or `PendingSpinner`. `apps/mobile/src/features/session-new/session-new-screen.tsx` no longer does: `git diff` of that file removes `PendingSpinner` (the import and three `<PendingSpinner testID="session-new-...-spinner">` uses; the added comment names the Reanimated "SurfaceMountingManager" cause, G75b-05). The test file is not in `git status`; the list still names the screen. **Owner: 134 C (mobile)**, `session-new-screen.tsx` edit for G75b-05. The pin must lose the line, or the screen must use the helper again: 134's decision.

## Deltas of the counts against 08 (wave H)

| suite | 08 files / tests | 09 files / tests | delta |
|-------|------------------|------------------|-------|
| shared | 113 / 2546 | 116 / 2570 | +3 files, +24 tests |
| core-server unit | 329 / 6467 | 338 / 6517 | +9 files, +50 tests |
| core-server db (passed + failed, skipped) | 186 (183 passed, 3 skipped) / 2413 (2406 passed, 7 skipped) | 193 (188 passed, 2 failed, 3 skipped) / 2429 (2419 passed, 3 failed, 7 skipped) | +7 files, +16 tests (+13 passed, +3 failed); skipped unchanged |
| core-web | 170 / 2001 | 176 / 2069 | +6 files, +68 tests (133 expected 2001 + 51, and 135's `pass-j.test.tsx` 17: 2069 exactly) |
| mobile | 275 / 2610 | 287 (286 passed, 1 failed) / 2693 (2692 passed, 1 failed) | +12 suites, +83 tests (134 expected 275 + 10 new files, 135 adds 2: 287 suites) |
| transcriber | 20 / 564 (561 passed, 3 skipped) | 20 / 564 (561 passed, 3 skipped) | none |
| mock-core | 4 / 19 | 4 / 19 | none |
| capture-protocol | not run in 08 (07: 1 / 31) | 1 / 31 | none against 07 |
| kill matrix | 07: 35 of 35 | 35 of 35 | none |
| seal e2e | 07: 3 | 3 | none |
| development-session e2e (generated) | 07: 2 passed, 2 skipped | 2 passed, 2 skipped | none |
| OpenAPI | 97 ops (36 GET / 61 POST), 67 audit types, schema 6 / dbc-7 | the same | none |

Expectation checks against the notes: 135's "`restart.db.test.ts` + `session-capture.db.test.ts` no longer fail together" holds (no failure in either); `pass-j-restart-recording.db.test.ts` and `pass-j-core-not-running.test.ts` are inside the green parts of rows 4 and 5 (not listed individually, the reporter prints passing files only as a count). 133's guard `npm run typecheck` / `lint` for core-web: green.

## Notes

- The 07 reds (speech session, `integration-d4.db.test.ts`, `ws-discovery.test.ts` flake) did not appear: the speech case was not requested here (not run), `integration-d4.db.test.ts` and `export-e2e.db.test.ts` (131 #5) passed inside the db suite, `ws-discovery.test.ts` passed in the unit suite.
- Raw logs: session scratchpad only (`.../scratchpad/wi/`), not in git. Files left behind by the tests' own design and ignored by git: `.cache/waveI/seal-e2e/` (4 JSON files: 2 verify reports, 2 facts files), `.cache/kill-matrix/*.json` (35 new reports), `.data/test-row61-row140e2e-*` fixture directory of row 11. Deleted nothing.
- First kill matrix launch failed at once (`unknown argument`, exit 2, nothing started) because of my own quoting of the 35 `--only` arguments; it was launched again correctly and is the one run reported. No check ran twice for any other reason.

## Status

complete; overall RED: 4 failing tests in 3 files (2 files db, 1 file mobile), all deterministic on re-run, all three stale pins or allow-lists after an intended behaviour change (owners: 132 A2 x 2 files, 134 C x 1 file). 131 A1, 133 B and 135 pass J: no red attributed.

---
*Generated: 2026-10-10 21:50 WIB*
