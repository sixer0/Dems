---
task_id: dems_real_capture_sealing
date: 2026-10-10
agent: test-expert (test runner, decision D122)
status: needs-review (3 reds: speech session e2e, one db file with 2 tests, one unit flake)
tree: commit f293221 + uncommitted wave-H fix work (schema 6 / dbc-7, worker capture-worker/0.5.0)
---

# Wave-H checkpoint - test runner report

Run on 2026-10-10 between about 18:04 and 18:40 WIB. No source file was changed; nothing was committed; no git write was made.
Each check ran once; a red was re-run once (one file / one check). No STT speed, throughput or timing figure is given anywhere in this report (D230).

## STEP 0 - host freed

- `scripts/lane/lane.sh stop 1` -> "lane 1 stopped (was PID 72245); port 4421 is free"
- `scripts/lane/lane.sh stop 2` -> "lane 2 stopped (was PID 77722); port 4422 is free"
- `lane.sh status`: main, 1, 2, 3 all `stopped`.
- Lane 2 log (`.locks/core-server.lane2.log:125`): `{"level":30,...,"code":"CAPTURE_SUPERVISOR_STOPPED","msg":"capture supervisor stopped"}` - present.
- Emulators, Metro (8081) and the two web dev servers (5176 / 5177) were not touched. The lanes were NOT started again.

## PART A - heavy runs

| # | check | result | attempts | duration |
|---|-------|--------|----------|----------|
| A1a | `make -C apps/capture-worker` (builds, then runs its own checks; run twice to get the exit code) | exit 0 | 2 (first exit code not captured, second exit 0) | 35 s / 32 s |
| A1b | `make -C apps/capture-worker check selftest unit` | exit 0, no check reported a failure; every negative control printed "as required" | 1 | 32 s |
| A2 | worker e2e `--tag waveH_sup --ports 8563,8564 --runs 1 --no-build --only '^(sup_|neg_sup_)'` | PASS | 1 | 36 s |
| A3 | seal e2e `seal-e2e.db.test.ts` (DEMS_SEAL_E2E=1) | PASS, 1 file, 3 tests passed | 1 | 46 s |
| A4 | kill matrix, all 35 active checks in one `run.sh` call (35 x `--only`) | PASS, 35 of 35 | 1 | 591 s |
| A5 | development-session e2e, generated sources (DEMS_DEV_SESSION_E2E=1) | PASS: 2 passed, 2 skipped (the speech case and the attended case) | 1 | 17 s |
| A6 | SPEECH SESSION (DEMS_DEV_SPEECH_SESSION_E2E=1) | FAIL (red twice, same assertion) | 2 | 41 s / 41 s |
| A7 | `test/acceptance/demo-seed-v2.test.ts` | PASS, 4 of 4 | 1 | 6 s |

### A2 - quoted aggregate

```
5 checks (3 expected PASS, 2 negative controls expected FAIL): 5 as expected, 0 unexpected
ports still listening after the series: none
AGGREGATE EXIT CODE 0
```
(checks: sup_av2_pm80_r1, sup_nocam_r1, sup_refuses_proof_build_r1 PASS; neg_sup_release_worker_is_accepted_r1, neg_sup_av_judged_as_no_offset_r1 FAIL as expected)

### A3 - facts for case (a) from the reports in `.cache/waveH/seal-e2e/`

Two JSON reports were written (cases (a) and (b); case (c) writes none):
`verify-SES-20261010-0024-1791630448356.json` (interruptedExpected false) and `verify-SES-20261010-0024-1791630462293.json` (interruptedExpected true).

Case (a), quoted from the report:
- verify verdict: `"overall": "PASS"`, `"ok": true`, HTTP status 200, `"interrupted": false`, `"failedFragmentCount": 0`.
- check count: 15 (V-01 .. V-15), all `PASS`, no findings, none skipped.
- `sources.development`: `true`; `sources.code`: `DEVELOPMENT`; `sources.report`: "DEVELOPMENT SOURCES - this package was not recorded from production devices."; tracks VIDEO-01 / CAM-01 FAKE, VIDEO-02 / CAM-02 FAKE; audio interval seq 1 / MIC-01 FAKE.
- transcriptState: `DISABLED_BY_CONFIGURATION`, sealedState `DISABLED`.
- Case (b) report: the same, with `"interrupted": true`, 15 checks all PASS.

NOT IN THE REPORT (the test writes `ok, overall, interrupted, sources, transcriptState, failedFragmentCount, checks` only - `seal-e2e.db.test.ts:183` - and removes its fixture in `afterAll`, `:192-194`; no manifest text was kept): notices, `signature.developmentKey`, time source members (RTC / GNSS), `softwareVersion`, device serial / hardware UUID, device id / name (fields 20 / 21), `tracks[].codec`, the clock-offset member, the audit extract (any `FRAME_HASH` / `WRITE_VERIFIED` / `TIMESTAMP_CONFIRMED` row) and `RECORDING_STARTED.timeSource`. I did not guess them. The test itself asserts on the manifest only `developmentSources: true`, `integrity: 'REAL'`, track source class FAKE, transcript state `DISABLED` and the interrupted flag (`:155-161`).

### A4 - kill matrix

Listed: 35 active checks, 10 parked. Result: `Test Files 1 passed (1)`, `Tests 35 passed (35)`, Duration 590.82 s, teardown "0 remain".
Active ids, all passed: M7-REF-1; M7-KM-C-S1..S6; M7-KM-P1-0, P1-S1..S6; M7-KM-P2-0, P2-S1..S6; M7-KM-P3-0, P3-S1..S6; M7-KM-P4-0, P4-S1..S6.
Parked (not run, refused by design; condition "OD-21 fallback path activated (CONCATENATE_SEGMENTS / ENCRYPT_PAYLOAD are not built)"): M7-KM-C-S7, C-S8, P1-S7, P1-S8, P2-S7, P2-S8, P3-S7, P3-S8, P4-S7, P4-S8.

### A5 - quoted result line

```
[row140 e2e GENERATED] {"sessionId":"SES-20261010-0024","verdict":"pass","seconds":6,"fragments":["VIDEO-01:3","VIDEO-02:3"],"microphoneHelpersWhileRecording":2,"microphoneFaultsWhileRecording":[],"evidenceId":"EV-20261010-0014","developmentSources":true,"verify":"PASS","sources":["CAM-01 FAKE","CAM-02 FAKE"]}; left at ./.data/test-row61-row140e2e-69040-1
```
The attended real-device case was SKIPPED (`↓`), as required (DEMS_LOCAL_SESSION_ATTENDED was never set).

### A6 - the speech session: FAILED (red on both attempts)

Fixture check: `ls -l .data/dev-fixtures/speech-mic/` -> `dialogue.reference.json` (2531 bytes), `dialogue.wav` (4320312 bytes). The engine binary file the test requires exists (the speech case was not skipped; it ran).

Test: `src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts` > "wave H: a development session on the SPEECH microphone with STT enabled on cpu-local (no device) > seals ASSEMBLED with segments > 0, chunks > 0 that each name the primary test microphone, and complete model provenance; verify PASS".
First error (both attempts, verbatim): `AssertionError: expected 1 to be +0 // Object.is equality` at `development-session-e2e.db.test.ts:316:45`, the line `expect(processesWith(`/${sessionId}/`)).toBe(0);` (after the stop, `sessionCapture(app).idle()` and `liveSessionId()` null had passed at :314-315; `processesWith` is a `pgrep -f` count at :145).
Because the test stops at that assertion, which comes BEFORE the transcript checks, the requested facts are NOT obtained: transcript state, segment count, per-chunk `audioSource`, model provenance and `intervals_incomplete` were not observed. Not in the output - not guessed.
After the run `pgrep -fl 'capture-worker|ffmpeg|whisper'` showed nothing (rc 1). No timing is reported. The runs left fixture directories under `.data/` (the test's design; nothing was deleted).
Re-run on the single file: red again, identical message. Not attributed beyond the file / line above.

### A7

`Test Files 1 passed (1)`, `Tests 4 passed (4)`.

## PART B - whole suites

| # | command | exit | files / tests passed / failed / skipped | duration |
|---|---------|------|------------------------------------------|----------|
| B1 | `npm run typecheck -w <ws>` for @dems/shared, core-server, core-web, mobile, capture-protocol, transcriber, mock-core | 0 x 7 | 0 `error TS` in each of the 7 | 3 / 8 / 12 / 6 / 0 / 2 / 1 s |
| B2 | `npm run lint -w <ws>` for the same 7 | 0 x 7 | 0 errors; mobile (eslint) 1 warning: `apps/mobile/src/runtime/log.test.ts:160:19 @typescript-eslint/array-type`; the six oxlint workspaces print nothing | 1 / 0 / 0 / 15 / 0 / 0 / 0 s |
| B3 | `npm run test -w @dems/shared` | 0 | 112 files, 2542 tests passed, 0 failed, 0 skipped | 5 s |
| B4 | `npm run test -w @dems/capture-protocol` | 0 | 1 file, 31 passed, 0 failed, 0 skipped | 1 s |
| B5 | `npx vitest run --root apps/core-server --project unit --maxWorkers=4` | 1 | 329 files (328 passed, 1 failed); 6466 tests: 6465 passed, 1 failed, 0 skipped | 65 s |
| B5 re-run | same file alone: `src/capture/adapters/camera/__tests__/ws-discovery.test.ts` | 0 | 1 file, 28 passed | n/a |
| B6 | `lockf db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2` | 1 | 186 files (182 passed, 1 failed, 3 skipped); 2413 tests: 2404 passed, 2 failed, 7 skipped. No "remaining connection slots" error occurred, so no `--maxWorkers=1` re-run | 225 s |
| B6 re-run | `test/db/integration-d4.db.test.ts` alone | 1 | 5 tests: 3 passed, 2 failed | 3 s |
| B7 | `npm run test -w @dems/core-web -- --maxWorkers=4` | 0 | 170 files, 2001 tests passed, 0 failed, 0 skipped | 126 s |
| B7 first try | `npx vitest run --root apps/core-web --maxWorkers=4` (my invocation error: wrong cwd, see below) | 1 | 170 files (169 passed, 1 failed to load); 1971 tests passed | 114 s |
| B8 | `npx -w apps/mobile jest --maxWorkers=2` | 0 | 275 suites passed; 2610 tests passed, 0 failed, 0 skipped, 0 todo | 199 s |
| B9a | `npm run test -w @dems/transcriber` | 0 | 20 files passed; 564 tests: 561 passed, 0 failed, 3 skipped | 16 s |
| B9b | `npm run test -w @dems/mock-core` | 0 | 4 files, 19 tests passed | 4 s |

The db suite's last line: `[test:db] teardown: dropped 8 database(s) in 152 ms; 0 remain with the run prefix dems_test_local_tmovn2mi_` (also `forced drops that needed a retry: 1 (SQLSTATE 42501, autovacuum-type backend; each drop then went through)`).

## RED LIST

1. **A6 speech session** - `apps/core-server/src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts`, test "wave H: a development session on the SPEECH microphone ... seals ASSEMBLED with segments > 0 ...". First error: `AssertionError: expected 1 to be +0 // Object.is equality` (line 316, `processesWith(`/${sessionId}/`)`). Red again on the single re-run: YES (identical).
2. **B6 db** - `apps/core-server/test/db/integration-d4.db.test.ts` (2 tests), "F-82-4 and F-82-3: a real seal, then a restart > seal (developmentSources true) -> restart: the Core boots, holds the same REAL item, and what is stored is what is committed" and the same with "(developmentSources false)". First error: `AssertionError: expected { id: 'EV-20261001-0014', ...(32) } to deeply equal { id: 'EV-20261001-0014', ...(31) }` at `integration-d4.db.test.ts:99:26` (`expect(rehydrated).toEqual(sealed)`); the diff shows one extra received key: `+ "sealedPackage": "NOT_READABLE",`. Red again on the single re-run: YES (2 of 5 tests, identical).
3. **B5 unit** - `apps/core-server/src/capture/adapters/camera/__tests__/ws-discovery.test.ts`, "M4-SEC-DISC-1 on the stub: each hostile answer of ST-2 is dropped and counted, and the search completes > NOT_XML: 0 listed, dropped as NOT_XML". First error: `AssertionError: expected { NOT_XML: 3, DECLARATION: 1 } to deeply equal { NOT_XML: 4 }` at `ws-discovery.test.ts:182`. Red again on the single re-run: NO (28 of 28 passed alone). It was red once inside the 4-worker whole-suite run only.
4. B7 first try (not a product red): `apps/core-web/src/test/shell-motion.test.tsx` failed to load with `ENOENT ... open '/Users/gsp-budi/Documents/DEMS/src/components/shell/shell.css'` (`:513`, the test reads `process.cwd()/src/components/shell/shell.css`). I had started vitest from the repo root with `--root`; the prescribed `npm run test -w @dems/core-web` sets the workspace cwd and the whole workspace then passed (B7 row). My command error.

Not red: the 12 `contract.test.ts` reds of the old baseline (D94 note) are gone - the db suite shows no failure there.

## DEBT LIST (expected-failing / todo / skipped)

Source scan (`it|test|describe` + `.fails|.failing|.todo|.skip`, `xit|xdescribe|xtest`, over apps / packages / scripts): **0 real uses.** The only text hits are comments recalling that a case "was `it.fails`" (development-session.db.test.ts:342 and :358; development-session-e2e.db.test.ts:393; source-class.db.test.ts:121) and the string `'test.failing'` (unit-of-work.db.test.ts:135). So no `it.fails` / `.failing` / `todo` is left: the two expected-failing cases of wave H are gone (the comments at :393 and :358 say so; both cases are now plain checks and ran green in A5 or are in the suite).

Skipped at run time (JSON reports of each run):
- core-server unit: 0 skipped, 0 todo.
- core-server db: 7 skipped tests + 3 skipped files, all environment-gated runner checks (run on purpose in Part A):
  - `src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts`: 3 skipped (gate DEMS_SEAL_E2E) - ran green in A3.
  - `src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts`: 4 skipped (DEMS_DEV_SESSION_E2E / DEMS_DEV_SPEECH_SESSION_E2E / the attended gate) - generated case ran green in A5, speech case ran red in A6, attended case never runs for an agent.
  - `src/sealing/__tests__/kill-matrix/kill-matrix.db.test.ts`: file counted as skipped (0 tests registered without DEMS_KILL_MATRIX) - ran green in A4 (35).
- shared 0, capture-protocol 0, core-web 0, mobile 0 (0 todo), mock-core 0.
- apps/transcriber: 3 skipped, 1 per file (host-conditional `runIf` / `skipIf`; the other branch of each pair ran):
  - `src/__tests__/capture-priority.test.ts`: 1
  - `src/__tests__/cpu-priority.test.ts`: 1
  - `src/__tests__/kill-resume.test.ts`: 1
- The `test:real:*` scripts of the transcriber were not run (as instructed).

## END CHECKS

- `pgrep -fl 'capture-worker|ffmpeg|whisper'` at the end: nothing (rc 1).
- `scripts/lane/lane.sh status`: main, 1, 2, 3 all `stopped`.
- db suite: "0 remain with the run prefix dems_test_local_tmovn2mi_".
- Left in place (tests do not clean them; I deleted nothing): `.data/test-row61-row140e2e-*` fixture directories from A5 / A6, the output `.cache/waveH/seal-e2e/` (2 JSON files), the series results `.cache/m3worker/e2e/waveH_sup`.
- Scratch outputs of this run are under the session scratchpad `.../scratchpad/wh/` (not in the repository).
