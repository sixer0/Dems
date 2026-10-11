# Pre-commit whole run, wave M (2026-10-11)

Runner: test-runner agent (decision D122). Tree: commit `7b1aded` plus the uncommitted work of fix wave M (notes 158 M-S, 159 M-W, 160 M-M, 161 M-S2); `git status --short` showed 75 entries at the start and 75 at the end: nothing changed under me. Procedure: `test/11_precommit_wave_l.md`, plus the "Checks for the test runner" of notes 158, 159, 160, 161. Sequential, from the repo root; sandbox off for everything that binds loopback, talks to PostgreSQL or signals a process (unit, db, web, transcriber, mock-core, seal e2e, kill matrix, development e2e, guard 12b, lane stop); typecheck, lint, shared, capture-protocol, mobile and guard 12a ran inside the sandbox. `env | grep ^DEMS_` printed nothing at the start; the only flags set were `DEMS_SEAL_E2E=1` (+ `DEMS_SEAL_E2E_OUT`), `DEMS_KILL_MATRIX` (set by `run.sh`) and `DEMS_DEV_SESSION_E2E=1`, each on its own command. No product file and no test file changed; no git write; no install. No local device selected, no `DEMS_*_ATTENDED`, no `.data/pg*.env` read, no port 5173-5175 / 8000 / 5432, no audio played. Metro and both emulators untouched.

Step 0: `scripts/lane/lane.sh stop 1` answered "lane 1 stopped (was PID 31434); port 4421 is free"; `scripts/lane/lane.sh stop 2` answered "lane 2 stopped (was PID 34466); port 4422 is free" (both outside the sandbox, not piped). Nothing was reset; lane 2's database and data are as they were. At the end `lane.sh status`: main, 1, 2, 3 all `stopped`; `pgrep -fl 'capture-worker|ffmpeg|whisper'` empty (rc 1). No lane was started.

Load (1-minute): 1.6 to 4.7 at every start. It rose to 16.8 at the end of the core-web run (row 6); I waited (to 4.7, about 2 minutes, 16:01 to 16:03) before the mobile run, which then ran alone at load 4.6 to 5.9 and did not time out.

Wall time of the whole task: 15:48:49 to 16:28 WIB, about 39 minutes. Of that, the extra `--detectOpenHandles` run took 9 minutes (538 s), the kill matrix 10 minutes, the db suite twice 8 minutes.

## Result: RED overall by the letter, 1 red that cleared on its second run (flaky test); needs-review on that one test

One red: `src/modules/capture-config/__tests__/integration-d1b.db.test.ts`, in the first run of the core-server db suite. The same file alone (4 passed) and the whole db suite a second time (0 failed) are green. Every other check ran once and is green. My reading: a timing flake of an old test (engine health sampler tick), not a stale pin of D232..D237 and not a defect of wave M (section "Red list").

| # | check | command | result | counts (files / tests) | duration |
|---|-------|---------|--------|------------------------|----------|
| 1a-g | typecheck x 7 | `npm run typecheck -w @dems/<ws>` (shared, core-server, core-web, mobile, capture-protocol, transcriber, mock-core) | GREEN, exit 0 x 7 | 0 `error TS` in each | 4 / 8 / 11 / 6 / 0 / 2 / 1 s |
| 2a-g | lint x 7 | `npm run lint -w @dems/<ws>` | GREEN, exit 0 x 7 | 0 errors; mobile (eslint) 1 warning, the known `src/runtime/log.test.ts:160:19 @typescript-eslint/array-type`; six oxlint workspaces silent | 0 / 0 / 1 / 14 / 1 / 0 / 0 s |
| 3 | shared | `npm run test -w @dems/shared` | GREEN | 121 files; 2612 passed / 0 failed | 5 s |
| 3b | capture-protocol | `npm run test -w @dems/capture-protocol` | GREEN | 1 file; 31 passed | 1 s |
| 4 | core-server unit | `npx vitest run --root apps/core-server --project unit --maxWorkers=4` | GREEN | 356 files; 6691 passed / 0 failed / 0 skipped | 70 s |
| 5 | core-server db, run 1 | `/usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2` | RED, 1 test | 196 files: 192 passed, 1 failed, 3 skipped; 2443 tests: 2435 passed, 1 failed, 7 skipped | 242 s |
| 5b | the red file alone | the same command with `src/modules/capture-config/__tests__/integration-d1b.db.test.ts` | GREEN | 1 file; 4 passed | 4 s |
| 5c | core-server db, run 2 (whole, after the red) | the command of 5 | GREEN | 196 files: 193 passed, 3 skipped; 2443 tests: 2436 passed, 7 skipped, 0 failed | 243 s |
| 6 | core-web | `npm run test -w @dems/core-web` | GREEN | 182 files; 2224 passed / 0 failed / 0 skipped | 87 s |
| 7 | mobile | `npx -w apps/mobile jest --maxWorkers=2` | GREEN | 311 suites passed; 2924 tests passed / 0 failed / 0 skipped | 195 s (Jest "Time: 194.2 s") |
| 8a | transcriber | `npm run test -w @dems/transcriber` | GREEN | 20 files; 564 passed / 0 failed / 3 skipped (567) | 15 s |
| 8b | mock-core | `npm run test -w @dems/mock-core` | GREEN | 4 files; 19 passed | 4 s |
| 9 | seal e2e (built worker `apps/capture-worker/build/capture-worker`) | `DEMS_SEAL_E2E=1 DEMS_SEAL_E2E_OUT="$PWD/.cache/waveM/seal-e2e" /usr/bin/lockf -k -t 3600 .locks/heavy-host.lock /usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=1 src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts` | GREEN | 1 file; 3 passed | 47 s |
| 10 | kill matrix, all 35 active cells in one call | `apps/core-server/src/sealing/__tests__/kill-matrix/run.sh` with 35 x `--only <id>` (ids from `run.sh --list`, the 10 PARKED cells excluded; the list built by a small bash loop in the scratchpad) | GREEN | 1 file; 35 passed / 0 failed; teardown "dropped 2 database(s) in 44 ms; 0 remain" | 588 s |
| 11 | development-session e2e, generated sources | `DEMS_DEV_SESSION_E2E=1 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock /usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=1 src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts` | GREEN | 1 file; 2 passed, 2 skipped (speech case needs `DEMS_DEV_SPEECH_SESSION_E2E`; the attended case is the user's) | 17 s |
| 12a | contract guard, shared | `npx vitest run --root packages/shared test/api-registry.test.ts test/api-openapi-scope.test.ts` | GREEN | 2 files; 66 passed | 1 s |
| 12b | contract guard, db | `/usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=1 test/acceptance/contract.test.ts` | GREEN | 1 file; 38 passed | 15 s |
| 12c | totals read directly | `node -e` over `packages/shared/openapi/openapi.json`; `expect(AUDIT_TYPES).toHaveLength(67)` at `packages/shared/test/api-registry.test.ts:492`; `apps/core-server/src/db/schema/meta.ts:38,40` | GREEN | 97 operations: 36 GET / 61 POST / 0 other; 67 audit types (pinned, 12a green); `DB_SCHEMA_VERSION = 6`, `DB_CONTRACT_REVISION = 'dbc-7'`, `meta.ts` not in `git status` | - |
| 13 | mobile `--detectOpenHandles` (extra, section "Timing") | `npx -w apps/mobile jest --maxWorkers=2 --detectOpenHandles src/features/session-new src/features/evidence src/features/storage src/features/pairing src/features/capture-selector` | GREEN, 6 open handles reported | 93 suites; 858 passed | 538 s wall (Jest "Time: 239.4 s") |

Skips: db 7 tests in 3 files (the env-gated runner checks `seal-e2e`, `development-session-e2e`, `kill-matrix`; rows 9, 10 and 11 ran them), the same as 11; transcriber 3 (host-conditional); development-session e2e 2 (above).

Note 158's expectation "the kill matrix log has no error-level `CAPTURE_FAULT` after a kill other than the ACTIVE one": NOT checkable from this run. `run.sh` runs vitest's default reporter; its output is 16 lines (cell count, summary, teardown) and carries no Core or worker log lines (grep count of `CAPTURE_FAULT` is 0 because nothing of the sort is printed at all). The 35 cells passing is the evidence I have.

## Red list

### R1. `src/modules/capture-config/__tests__/integration-d1b.db.test.ts`, run 1 of the core-server db suite only

- Test: `operation 78: pair replacement of the microphone inputs > REAL_DEVELOPMENT: MIC-03 is selected through the API, stored, equal to the committed state, and held across a restart` (line 131; the assertion is line 154: `expect(await storedSlices(owner)).toStrictEqual(withoutBootDerivedSourceFacts(server.app.engine.state()))`).
- Output (first 30 lines of the failure block, `AssertionError: expected { …(30) } to strictly equal { …(30) }`):

```
 FAIL  |db| src/modules/capture-config/__tests__/integration-d1b.db.test.ts > operation 78: pair replacement of the microphone inputs > REAL_DEVELOPMENT: MIC-03 is selected through the API, stored, eq...
AssertionError: expected { …(30) } to strictly equal { …(30) }

- Expected
+ Received

@@ -3463,15 +3463,20 @@
    "faults": {
      "active": [],
    },
    "health": {
      "ambientTempC": 27,
-     "cpuPercent": 18.4,
-     "cpuTempC": 51.9,
+     "cpuPercent": 15.5,
+     "cpuTempC": 51.8,
      "fanOk": true,
-     "fanRpm": 2444,
+     "fanRpm": 2317,
      "micLevels": [
+       {
+         "AUDIO-01": -51.1,
+         "AUDIO-02": -53.9,
+         "at": 1790823481000,
+       },
        {
          "AUDIO-01": -51.9,
          "AUDIO-02": -53.6,
```

  (the rest of the diff: further `micLevels` / `series` samples of the `health` slice shifted by one sample: the engine's value, "Expected", is one sample newer than the stored value, "Received".)
- Second run: the file alone: 4 passed in 4 s. Whole db suite again: 0 failed (193 files passed, 3 skipped; 2436 passed, 7 skipped). So the failure did not repeat.
- Reading (HYPOTHESIS, from the diff and line 154, not proven): the assertion compares the stored slices with the engine's in-memory state; only the `health` slice (simulated CPU, fan, mic-level ring buffer) differs, by exactly one sampler tick, so the engine's health sampler ticked between the database read and `engine.state()`. A timing race of the test under a loaded db run, not a stale pin and not a product defect. Owner note: none of 158-161 (the file is not in `git status`, was last touched in `57b80a9`; the cases of 161's `wave-i-a2-adopt-assign.db.test.ts` all passed). If the consolidation of the suite wants it stable, the comparison should exclude `health`, or read both sides under the engine's clock; that is the test owner's call, I changed nothing.
- Cannot rule out: that the tick is more frequent under wave M's changes to `capture/index.ts` / `media-stream/service.ts`; nothing in the evidence points there, and run 2 of the same suite on the same tree is green.

No other red. No stale pin for D232..D237 was found; nothing is attributed to 158, 159, 160 or 161.

## Checks of the notes, read against this run

- Note 158 (M-S, server + source rig): core-server unit 356 files green (the new `test/support` rig tests are inside); db green apart from R1; shared green; seal e2e 3 of 3 and kill matrix 35 of 35 green. No test elsewhere that pins the launcher's argument list, the log lines of a session start or the number of files under `test/support` failed.
- Note 159 (M-W): core-web whole 182 files green, typecheck and lint clean.
- Note 160 (M-M): mobile whole green (311 suites, 2924 tests); typecheck clean; lint shows only the one known warning.
- Note 161 (M-S2): unit green; `wave-i-a2-adopt-assign.db.test.ts` passed in both db runs (its case "M-S2" is one of its 4); I did not count its cases myself, the db total is +1 test against 11, which fits.

## Deltas of the counts against 11 (wave L)

| suite | 11 files / tests | 12 files / tests | delta |
|-------|------------------|------------------|-------|
| shared | 121 / 2612 | 121 / 2612 | none |
| core-server unit | 355 / 6666 | 356 / 6691 | +1 file, +25 tests |
| core-server db (run 2, the green one) | 196 (193 passed, 3 skipped) / 2442 (2435 passed, 7 skipped) | 196 (193 passed, 3 skipped) / 2443 (2436 passed, 7 skipped) | +1 test; skipped unchanged |
| core-web | 182 / 2205 | 182 / 2224 | +19 tests, files unchanged |
| mobile | 311 / 2900 | 311 / 2924 | +24 tests, suites unchanged |
| transcriber | 20 / 567 (564 passed, 3 skipped) | 20 / 567 (564 passed, 3 skipped) | none |
| mock-core | 4 / 19 | 4 / 19 | none |
| capture-protocol | 1 / 31 | 1 / 31 | none |
| kill matrix | 35 of 35 | 35 of 35 | none |
| seal e2e | 3 | 3 | none |
| development-session e2e (generated) | 2 passed, 2 skipped | 2 passed, 2 skipped | none |
| contract guards | shared 66, db 38 | shared 66, db 38 | none |
| OpenAPI | 97 ops (36 GET / 61 POST), 67 audit types, schema 6 / dbc-7 | the same | none |

I did not map the per-file deltas to the notes' claims; the per-suite totals are the facts.

## Timing (measure only, no judgement)

Method: the vitest suites ran with `--reporter=default --reporter=json --outputFile.json=<scratchpad>/x.json` (the default console output unchanged; the JSON adds a file); mobile with `--json --outputFile=<scratchpad>/mobile.json`. The per-file time below is the report's `endTime - startTime` of the file, i.e. the file's wall time inside its worker (includes its imports/setup in the worker; files run in parallel, so the sum of the files is larger than the run's wall time). The kill matrix, seal e2e and development e2e are one file each (no list). Raw JSON: session scratchpad only, not in git. The db list is from run 2; run 1 had the same order at the top (the same 196 files).

### Per workspace

| workspace | files | tests | wall time of the run | workers | sum of per-file times | median file |
|-----------|-------|-------|----------------------|---------|-----------------------|-------------|
| shared | 121 | 2612 | 5 s (vitest "Duration 5.29s": tests 47%, import 36%, transform 16%) | default | 17.5 s | 61 ms |
| capture-protocol | 1 | 31 | 1 s (113 ms) | default | 12 ms | 12 ms |
| core-server unit | 356 | 6691 | 70 s (69.9 s: tests 62%, import 36%) | 4 | 156 s | 41 ms |
| core-server db | 196 (193 ran) | 2443 | 242 s run 1 / 243 s run 2 (tests 86%, import 13%) | 2 | 344 s | 395 ms |
| core-web | 182 | 2224 | 87 s (tests 65%, import 17%, environment 10%, setup 4%) | default | 499 s | 1.5 s |
| mobile | 311 | 2924 | 195 s | 2 | 376 s | 0.7 s |
| transcriber | 20 | 567 | 15 s | default | 27 s | 0.5 s |
| mock-core | 4 | 19 | 4 s | default | 5.7 s | 12 ms |
| kill matrix | 1 (35 cells) | 35 | 588 s (about 17 s per cell) | 1 | - | - |
| seal e2e | 1 | 3 | 47 s | 1 | - | - |
| development-session e2e | 1 | 4 (2 ran) | 17 s | 1 | - | - |

One file dominates the db suite: `capture-discovery.db.test.ts` at 101 s of 243 s wall (the db run is two workers).

### The 20 slowest test files per workspace

### shared (files=121 sum-of-file-ms=17456 median=61)

| # | file | tests | s |
|---|------|-------|---|
| 1 | `packages/shared/test/live-source-local-end.test.ts` | 86 | 4.0 |
| 2 | `packages/shared/test/live-source-session.test.ts` | 75 | 1.0 |
| 3 | `packages/shared/test/api-capture-discovery.test.ts` | 18 | 0.8 |
| 4 | `packages/shared/test/api-state-slices.test.ts` | 103 | 0.8 |
| 5 | `packages/shared/test/api-realtime.test.ts` | 74 | 0.8 |
| 6 | `packages/shared/test/api-openapi-scope.test.ts` | 24 | 0.6 |
| 7 | `packages/shared/test/openapi.test.ts` | 21 | 0.5 |
| 8 | `packages/shared/test/demo-evidence.test.ts` | 18 | 0.4 |
| 9 | `packages/shared/test/live-source-replica.test.ts` | 15 | 0.4 |
| 10 | `packages/shared/test/live-source-atomicity.test.ts` | 39 | 0.4 |
| 11 | `packages/shared/test/live-source-resilience.test.ts` | 27 | 0.3 |
| 12 | `packages/shared/test/realtime-live-socket.test.ts` | 117 | 0.3 |
| 13 | `packages/shared/test/api-domain-operations.test.ts` | 25 | 0.2 |
| 14 | `packages/shared/test/audio.test.ts` | 14 | 0.2 |
| 15 | `packages/shared/test/client-credentials.test.ts` | 18 | 0.2 |
| 16 | `packages/shared/test/live-testing-fetch.test.ts` | 89 | 0.2 |
| 17 | `packages/shared/test/live-source-bindings.test.ts` | 111 | 0.2 |
| 18 | `packages/shared/test/evidence-transcript-states.test.ts` | 29 | 0.2 |
| 19 | `packages/shared/test/live-source-simulated-isolation.test.ts` | 4 | 0.2 |
| 20 | `packages/shared/test/api-stt-config.test.ts` | 44 | 0.2 |

### unit (files=356 sum-of-file-ms=156178 median=41)

| # | file | tests | s |
|---|------|-------|---|
| 1 | `apps/core-server/src/transcription/__tests__/encrypted-credential.test.ts` | 4 | 12.3 |
| 2 | `apps/core-server/src/capture/adapters/local/__tests__/mic-helper.generated.test.ts` | 8 | 11.2 |
| 3 | `apps/core-server/src/sealing/__tests__/stt-states-verify.test.ts` | 57 | 10.5 |
| 4 | `apps/core-server/src/capture/adapters/local/__tests__/no-delivery.test.ts` | 17 | 9.5 |
| 5 | `apps/core-server/src/capture/__tests__/ipc.test.ts` | 16 | 9.0 |
| 6 | `apps/core-server/src/capture/adapters/camera/__tests__/ws-discovery.test.ts` | 28 | 8.4 |
| 7 | `apps/core-server/src/sealing/__tests__/finalize-transcript.test.ts` | 30 | 6.1 |
| 8 | `apps/core-server/src/sealing/__tests__/pipeline.test.ts` | 61 | 5.8 |
| 9 | `apps/core-server/src/transcription/__tests__/session-run.test.ts` | 21 | 5.5 |
| 10 | `apps/core-server/test/support/fake-onvif-stub.test.ts` | 38 | 5.3 |
| 11 | `apps/core-server/src/db/mapping/__tests__/round-trip.test.ts` | 43 | 5.2 |
| 12 | `apps/core-server/src/sealing/__tests__/stt-states.test.ts` | 20 | 4.0 |
| 13 | `apps/core-server/src/sealing-host/__tests__/transcript-step.test.ts` | 14 | 2.6 |
| 14 | `apps/core-server/src/sealing/__tests__/sealed-plaintext.test.ts` | 12 | 2.5 |
| 15 | `apps/core-server/src/capture/boot/__tests__/wave-h-f-boot.test.ts` | 10 | 2.5 |
| 16 | `apps/core-server/src/realtime/__tests__/plugin.test.ts` | 9 | 2.4 |
| 17 | `apps/core-server/src/capture/boot/__tests__/boot.test.ts` | 8 | 2.2 |
| 18 | `apps/core-server/src/sealing/__tests__/last-resort.test.ts` | 15 | 2.1 |
| 19 | `apps/core-server/src/sealing-host/__tests__/demo-seed.test.ts` | 13 | 2.1 |
| 20 | `apps/core-server/src/db/fixtures/__tests__/build.test.ts` | 60 | 2.0 |

### db (files=196 sum-of-file-ms=343719 median=395)

| # | file | tests | s |
|---|------|-------|---|
| 1 | `apps/core-server/src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts` | 16 | 101.3 |
| 2 | `apps/core-server/src/db/reset/__tests__/reset-failures.db.test.ts` | 54 | 24.8 |
| 3 | `apps/core-server/src/db/reset/__tests__/wave-i-a1-reset-lane.db.test.ts` | 3 | 20.7 |
| 4 | `apps/core-server/src/capture-session/__tests__/session-capture.db.test.ts` | 55 | 18.3 |
| 5 | `apps/core-server/test/acceptance/contract.test.ts` | 38 | 12.4 |
| 6 | `apps/core-server/src/db/fixtures/__tests__/bulk-fixture.db.test.ts` | 26 | 8.6 |
| 7 | `apps/core-server/src/modules/capture-discovery/__tests__/wave-i-a2-adopt-assign.db.test.ts` | 4 | 7.4 |
| 8 | `apps/core-server/src/modules/capture-discovery/__tests__/lane-camera-stub.db.test.ts` | 2 | 7.4 |
| 9 | `apps/core-server/src/engine/__tests__/restart.db.test.ts` | 27 | 6.2 |
| 10 | `apps/core-server/src/modules/transcripts/__tests__/transcript-routes.db.test.ts` | 23 | 5.7 |
| 11 | `apps/core-server/test/acceptance/rbac-matrix.test.ts` | 39 | 5.5 |
| 12 | `apps/core-server/src/modules/demo/__tests__/reset-failures.db.test.ts` | 15 | 5.5 |
| 13 | `apps/core-server/test/acceptance/shared-state.test.ts` | 6 | 4.5 |
| 14 | `apps/core-server/src/engine/__tests__/clock-floor.db.test.ts` | 13 | 3.9 |
| 15 | `apps/core-server/src/capture/fence/__tests__/fence.db.test.ts` | 16 | 3.7 |
| 16 | `apps/core-server/test/acceptance/demo-seed-v2.test.ts` | 4 | 3.5 |
| 17 | `apps/core-server/test/acceptance/restart.test.ts` | 16 | 3.2 |
| 18 | `apps/core-server/test/helpers/db/__tests__/templates.db.test.ts` | 12 | 3.2 |
| 19 | `apps/core-server/test/helpers/db/__tests__/dead-run.db.test.ts` | 7 | 3.1 |
| 20 | `apps/core-server/src/db/reset/__tests__/reset.db.test.ts` | 6 | 3.1 |

### web (files=182 sum-of-file-ms=498666 median=1534)

| # | file | tests | s |
|---|------|-------|---|
| 1 | `apps/core-web/src/features/evidence/__tests__/wave-k-w-player.test.tsx` | 29 | 38.5 |
| 2 | `apps/core-web/src/features/evidence/__tests__/export-job.test.tsx` | 22 | 27.3 |
| 3 | `apps/core-web/src/features/session-new/__tests__/wave-h-z2-countdown-sources.test.tsx` | 3 | 20.5 |
| 4 | `apps/core-web/src/test/live-session-new-local-notice.test.tsx` | 13 | 17.7 |
| 5 | `apps/core-web/src/test/live-evidence-verify.test.tsx` | 12 | 10.6 |
| 6 | `apps/core-web/src/test/live-evidence-export.test.tsx` | 10 | 10.0 |
| 7 | `apps/core-web/src/test/wave-l-w-real-core.test.tsx` | 44 | 9.4 |
| 8 | `apps/core-web/src/test/live-security-audit-chain.test.tsx` | 15 | 9.2 |
| 9 | `apps/core-web/src/test/live-shell-notices.test.tsx` | 22 | 8.2 |
| 10 | `apps/core-web/src/test/live-security-audit-export.test.tsx` | 10 | 7.8 |
| 11 | `apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx` | 16 | 6.9 |
| 12 | `apps/core-web/src/features/evidence/__tests__/evidence-integrity.test.tsx` | 9 | 6.7 |
| 13 | `apps/core-web/src/test/live-session-new-create.test.tsx` | 16 | 6.6 |
| 14 | `apps/core-web/src/test/live-security-audit-page.test.tsx` | 19 | 6.3 |
| 15 | `apps/core-web/src/features/login/__tests__/login-page.test.tsx` | 17 | 6.3 |
| 16 | `apps/core-web/src/test/live-session-monitor-panels.test.tsx` | 10 | 6.1 |
| 17 | `apps/core-web/src/features/evidence/__tests__/evidence-export.test.tsx` | 7 | 6.0 |
| 18 | `apps/core-web/src/test/live-login-page.test.tsx` | 31 | 5.9 |
| 19 | `apps/core-web/src/features/devices/__tests__/camera-connect.test.tsx` | 11 | 5.6 |
| 20 | `apps/core-web/src/features/system/__tests__/system-page.test.tsx` | 9 | 5.5 |

### mobile (files=311 sum-of-file-ms=376141 median=729)

| # | file | tests | s |
|---|------|-------|---|
| 1 | `apps/mobile/src/features/session-new/wave-h-z2-countdown-sources.test.tsx` | 2 | 18.8 |
| 2 | `apps/mobile/src/features/evidence/evidence-detail.test.tsx` | 9 | 11.0 |
| 3 | `apps/mobile/src/features/storage/live-storage-sites.test.tsx` | 15 | 9.2 |
| 4 | `apps/mobile/src/features/pairing/pairing-live.test.tsx` | 28 | 8.2 |
| 5 | `apps/mobile/src/features/capture-selector/local-source-start-notice.test.tsx` | 8 | 5.6 |
| 6 | `apps/mobile/src/runtime/connection-banner-live.test.tsx` | 9 | 5.5 |
| 7 | `apps/mobile/src/features/devices/devices-states.test.tsx` | 4 | 4.5 |
| 8 | `apps/mobile/src/features/devices/live-devices-sites.test.tsx` | 22 | 4.5 |
| 9 | `apps/mobile/src/features/capture-selector/wave-h-mic-lines.test.tsx` | 23 | 4.5 |
| 10 | `apps/mobile/src/features/devices/wave-l-z-one-rule.test.tsx` | 29 | 4.3 |
| 11 | `apps/mobile/src/features/session-live/session-live-screen.test.tsx` | 22 | 4.1 |
| 12 | `apps/mobile/src/features/settings/live-settings-sites.test.tsx` | 25 | 4.0 |
| 13 | `apps/mobile/src/features/evidence/wave-h-c2-media.test.tsx` | 24 | 3.9 |
| 14 | `apps/mobile/src/features/evidence/wave-h-c2-item-lines.test.tsx` | 18 | 3.8 |
| 15 | `apps/mobile/src/features/capture-selector/camera-search.test.tsx` | 19 | 3.7 |
| 16 | `apps/mobile/src/features/evidence/live-evidence-export.test.tsx` | 15 | 3.7 |
| 17 | `apps/mobile/src/features/evidence/wave-k-z1-player.test.tsx` | 15 | 3.6 |
| 18 | `apps/mobile/src/features/session-live/live-session-live-sites.test.tsx` | 15 | 3.6 |
| 19 | `apps/mobile/src/features/evidence/media-session-canary.test.tsx` | 16 | 3.5 |
| 20 | `apps/mobile/src/features/session-new/live-session-new-followups.test.tsx` | 13 | 3.5 |

### transcriber (files=20 sum-of-file-ms=27083 median=518)

| # | file | tests | s |
|---|------|-------|---|
| 1 | `apps/transcriber/src/__tests__/kill-resume.test.ts` | 7 | 6.1 |
| 2 | `apps/transcriber/src/__tests__/checkpoint-runner.test.ts` | 50 | 6.0 |
| 3 | `apps/transcriber/src/__tests__/assembly.test.ts` | 26 | 3.6 |
| 4 | `apps/transcriber/src/__tests__/row79-carried.test.ts` | 5 | 2.4 |
| 5 | `apps/transcriber/src/__tests__/backends.test.ts` | 94 | 1.9 |
| 6 | `apps/transcriber/src/__tests__/diarization.test.ts` | 60 | 1.7 |
| 7 | `apps/transcriber/src/__tests__/row77-review-fixes.test.ts` | 20 | 1.2 |
| 8 | `apps/transcriber/src/__tests__/cpu-priority.test.ts` | 26 | 1.1 |
| 9 | `apps/transcriber/src/__tests__/silero-vad.test.ts` | 17 | 0.7 |
| 10 | `apps/transcriber/src/__tests__/adapter-contract.test.ts` | 11 | 0.6 |
| 11 | `apps/transcriber/src/__tests__/media-time-wrong-constant.test.ts` | 6 | 0.5 |
| 12 | `apps/transcriber/src/__tests__/media-time.test.ts` | 14 | 0.3 |
| 13 | `apps/transcriber/src/__tests__/capture-priority.test.ts` | 7 | 0.3 |
| 14 | `apps/transcriber/src/__tests__/static.test.ts` | 111 | 0.3 |
| 15 | `apps/transcriber/src/__tests__/key-loader.test.ts` | 22 | 0.1 |
| 16 | `apps/transcriber/src/__tests__/tts-fixture-provider.test.ts` | 9 | 0.1 |
| 17 | `apps/transcriber/src/__tests__/document.test.ts` | 53 | 0.0 |
| 18 | `apps/transcriber/src/__tests__/evidence-runs.test.ts` | 3 | 0.0 |
| 19 | `apps/transcriber/src/__tests__/chunker-clamp.test.ts` | 23 | 0.0 |
| 20 | `apps/transcriber/src/__tests__/log-excerpt.test.ts` | 3 | 0.0 |

### mockcore (files=4 sum-of-file-ms=5712 median=12)

| # | file | tests | s |
|---|------|-------|---|
| 1 | `apps/mock-core/test/standalone-launcher.test.ts` | 13 | 3.6 |
| 2 | `apps/mock-core/test/heartbeat.test.ts` | 1 | 2.1 |
| 3 | `apps/mock-core/test/health.test.ts` | 3 | 0.0 |
| 4 | `apps/mock-core/test/ws-origin.test.ts` | 2 | 0.0 |

### cp (files=1 sum-of-file-ms=12 median=12)

| # | file | tests | s |
|---|------|-------|---|
| 1 | `packages/capture-protocol/test/protocol.test.ts` | 31 | 0.0 |

### Mobile: "worker failed to exit gracefully" and open handles

- Whole mobile run (row 7): Jest printed "A worker process has failed to exit gracefully and has been force exited. This is likely caused by tests leaking due to improper teardown. Try running with --detectOpenHandles to find leaks. Active timers can also cause this, ensure that .unref() was called on them." YES, once; exit code 0, 311 of 311 suites passed. (Wave L printed the same line; 11 notes it too.)
- The brief says "the 5 suspect folders" without naming them and no earlier note names any (grep of the task folder for `detectOpenHandles`: no hit). I took the folders of the five slowest files of the whole run: `src/features/session-new`, `src/features/evidence`, `src/features/storage`, `src/features/pairing`, `src/features/capture-selector` (93 suites). That choice is mine; the first four are the top four of the slowest-file list, the fifth is the folder of the 5th file.
- Run 13: `npx -w apps/mobile jest --maxWorkers=2 --detectOpenHandles <the five folders>`: 93 suites, 858 tests, all passed, 538 s wall (Jest "Time: 239.4 s"; the rest was start-up and the log of 337 829 lines it wrote, mostly console output of the tests). `--detectOpenHandles` runs the suites in band, so the "worker failed to exit" line does not appear in this run (count 0).
- Result: Jest reported 6 open handles, ALL `Timeout`, ALL from one file: `apps/mobile/src/features/evidence/transcript-follows-revision.test.tsx`. Each is the garbage-collection timer that TanStack Query's `Query.scheduleGc` sets (`@tanstack/query-core/src/removable.ts:27`, `timeoutManager.ts:50`) when the test seeds a `QueryClient` with `setQueryData` at lines 25 and 26 (two handles per `mounted(...)` call; calls at lines 39, 51 and 57). The default `gcTime` is five minutes, so the timer outlives the test; the QueryClient is not cleared or given `gcTime: 0` there. No other file in the five folders was reported. Whether this one file is also what keeps the whole-run worker from exiting is not proven: the rest of `src` (for example `src/runtime`, `src/features/devices`) were not run under `--detectOpenHandles`.
- The file is not in `git status` (committed in `abf742f`), so it is not a wave M change.

### Wall time per check, in the order run

typecheck 7 + lint 7: about 50 s; shared 5 s; capture-protocol 1 s; unit 70 s; db 242 s; db red file 4 s; db run 2 243 s; core-web 87 s; wait for the load 2 min; mobile 195 s; transcriber 15 s; mock-core 4 s; seal e2e 47 s; development e2e 17 s; kill matrix 588 s; guards about 20 s; mobile `--detectOpenHandles` 538 s. Total from the first command to the last: 39 minutes.

## Notes

- Db run 1, closing lines: `forced drops that needed a retry: 1 (1 refusal(s) with SQLSTATE 42501 ...)`; `teardown: dropped 8 database(s) in 150 ms; 0 remain with the run prefix`. Run 2: the same, 1 retried drop, `dropped 8 database(s) in 191 ms; 0 remain`. No "remaining connection slots" error. Kill matrix teardown: `dropped 2 database(s) in 44 ms; 0 remain`.
- The first attempt of run 13 failed in 0 s with `timeout: command not found` (rc 127; macOS has no `timeout`), before Jest started; nothing ran. The second attempt, without it, is the result in row 13.
- Raw logs and JSON reports: session scratchpad only (`.../scratchpad/wm/`), not in git. Files left behind by the tests' own design and ignored by git: `.cache/waveM/seal-e2e/` (4 JSON files: 2 verify reports, 2 facts files, session SES-20261011-0024), `.cache/kill-matrix/*.json`. Deleted nothing.
- `pgrep` inside the sandbox fails ("Cannot get process list"); the empty check was made outside the sandbox (before the kill matrix and at the end).
- Lane 2 was stopped with its data kept and is NOT running now: the re-drive lists of 158 (section 9), 159 (section 8), 160 (section 4) and 161 (section 8) need `lane.sh start 2 ...` again (no reset).

## Status

needs-review (one flaky test, R1). Overall: every suite and every heavy check is green; the core-server db suite was RED once in run 1 (1 test, `integration-d1b.db.test.ts:131`, health-slice timing race by my reading) and GREEN in the second run of the whole suite and in the file alone. No product defect or stale pin found; no owner note attributed (158, 159, 160, 161: no red of theirs).

---
*Generated: 2026-10-11 16:29 WIB*
