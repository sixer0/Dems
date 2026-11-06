---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-11
agent: test-expert
row: 95 (M9-W1 full regression, M9-RG-*, M9-QA-1, M9-SIM-1, M9-PIN-1) and proof run of the test-suite consolidation (D233)
tree: commit a5d75ed plus the uncommitted test-only consolidation (test/14_*.md, test/15_*.md) plus five comment-only product files
status: needs-review (every run is GREEN; the one open point is the M9-PIN-1 literal grep, section 4)
---

# Row 95: full regression, run on the consolidated tree (2026-10-11)

Runner: test-expert, decision D122 (run, measure, report; no product file, no test file, no git write, no install). Procedure: `test/12_precommit_wave_m.md`, command for command. Every check ran once and none was red, so nothing was run a second time except the stability series of 7(d), which is the brief's own 5 x 3.

Start 18:58:02, last check 19:28:30 (about 31 minutes). Before each whole suite I waited until the 1-minute load was below 4 (`uptime`; the waits are in section 7). One heavy thing at a time. `env | grep ^DEMS_` printed nothing at the start; the only flags set were `DEMS_SEAL_E2E=1` (+ `DEMS_SEAL_E2E_OUT=.cache/row95/seal-e2e`), `DEMS_KILL_MATRIX` (set by `run.sh`) and `DEMS_DEV_SESSION_E2E=1`, each on its own command. `lane.sh status` at the start and the end: main, 1, 2, 3 all `stopped`; no lane started, nothing reset (lane 2's data untouched); `pgrep -fl 'capture-worker|ffmpeg|whisper'` empty (rc 1) before the kill matrix and at the end. Metro and the emulators were not touched. No `.data/pg*.env` read, no port 5173-5175 / 8000 / 5432, no local-device selector, no `DEMS_*_ATTENDED`, no audio. `git status --short` had 412 entries at the start and the same 412 at the end (identical): nothing changed under me.

## Result: GREEN overall

| # | check | command | result | counts | wall |
|---|-------|---------|--------|--------|------|
| 1a-g | typecheck x 7 (M9-QA-1) | `npm run typecheck -w @dems/<ws>` (shared, core-server, core-web, mobile, capture-protocol, transcriber, mock-core) | GREEN, exit 0 x 7 | 0 `error TS` in each | 4 / 7 / 11 / 5 / 1 / 1 / 1 s |
| 2a-g | lint x 7 (M9-QA-1) | `npm run lint -w @dems/<ws>` | GREEN, exit 0 x 7 | 0 errors; mobile (eslint) 1 warning, the known `src/runtime/log.test.ts:160:19 @typescript-eslint/array-type`; six oxlint workspaces silent | 0 / 1 / 0 / 15 / 0 / 0 / 0 s |
| 1h | root typecheck | `npm run typecheck` (root = `--workspaces --if-present`) | GREEN, exit 0 | 0 `error TS` | 31 s |
| 2h | root lint | `npm run lint` | GREEN, exit 0 | the same 1 mobile warning | 15 s |
| 3 | shared | `npm run test -w @dems/shared` | GREEN | 101 files; 2612 passed / 0 failed / 0 skipped | 5 s (vitest 4.91 s) |
| 3b | capture-protocol | `npm run test -w @dems/capture-protocol` | GREEN | 1 file; 31 passed | 0.1 s |
| 4 | core-server unit | `npx vitest run --root apps/core-server --project unit --maxWorkers=4` | GREEN | 324 files; 6700 passed / 0 failed / 0 skipped | 63 s (vitest 62.37 s) |
| 5 | core-server db | `/usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2` | GREEN | 181 files: 178 passed, 3 skipped; 2430 tests: 2423 passed, 7 skipped, 0 failed | 208 s (vitest 207.49 s) |
| 6 | core-web | `npm run test -w @dems/core-web` | GREEN | 164 files; 2224 passed / 0 failed / 0 skipped | 85 s (vitest 84.23 s) |
| 7 | mobile | `npx -w apps/mobile jest --maxWorkers=2` | GREEN, exit 0 | 272 suites passed; 2915 tests passed / 0 failed / 0 skipped | 178 s (Jest "Time: 177.055 s") |
| 8a | transcriber (real-engine tests not run) | `npm run test -w @dems/transcriber` | GREEN | 18 files; 564 passed / 0 failed / 3 skipped (567) | 15 s (vitest 14.73 s) |
| 8b | mock-core | `npm run test -w @dems/mock-core` | GREEN | 4 files; 19 passed | 4 s (3.91 s) |
| 9 | pg-scripts | `npm run test:pg-scripts` (= `node --test scripts/pg/`) | GREEN | 7 files, 57 tests: 57 pass / 0 fail / 0 skipped (floor >= 57) | 0.2 s (node:test duration_ms 206) |
| 10 | seal e2e (built worker `apps/capture-worker/build/capture-worker`, lanes stopped) | `DEMS_SEAL_E2E=1 DEMS_SEAL_E2E_OUT="$PWD/.cache/row95/seal-e2e" /usr/bin/lockf -k -t 3600 .locks/heavy-host.lock /usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=1 src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts` | GREEN | 1 file; 3 passed ((a) start-record-stop-seal-verify, (b) worker killed mid-recording then recovery seals as interrupted, (c) UNSEALABLE ends in quarantine); teardown "dropped 2 database(s) in 46 ms; 0 remain" | 47 s |
| 11 | development-session e2e, generated sources, built worker | `DEMS_DEV_SESSION_E2E=1 /usr/bin/lockf -k -t 1800 .locks/heavy-host.lock /usr/bin/lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=1 src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts` | GREEN | 1 file; 2 passed, 2 skipped (the speech case needs `DEMS_DEV_SPEECH_SESSION_E2E`, the attended case is the user's) | 17 s |
| 12 | kill matrix, all 35 active cells in one call | `apps/core-server/src/sealing/__tests__/kill-matrix/run.sh` with 35 x `--only <id>` (ids from `run.sh --list`, the 10 PARKED OD-21 cells excluded) | GREEN | 1 file; 35 passed / 0 failed; teardown "dropped 2 database(s) in 43 ms; 0 remain"; "forced drops that needed a retry: 0" | 588 s |
| 13a | contract guard, shared | `npx vitest run --root packages/shared test/api-registry.test.ts test/api-openapi-scope.test.ts` | GREEN | 2 files; 66 passed | 1 s |
| 13b | contract guard, db | `/usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=1 test/acceptance/contract.test.ts` | GREEN | 1 file; 38 passed | 16 s |
| 13c | totals read directly | `node -e` over `packages/shared/openapi/openapi.json`; `packages/shared/test/api-registry.test.ts:299,330,331,492`; `apps/core-server/src/db/schema/meta.ts:38,40` | GREEN | 97 operations: 36 GET / 61 POST / 0 other (`info.version` 0.3.0); registry `toHaveLength(97)` (:299), GET 36 (:330), POST 61 (:331), `AUDIT_TYPES` `toHaveLength(67)` (:492), all pinned and green in 13a; `DB_SCHEMA_VERSION = 6`, `DB_CONTRACT_REVISION = 'dbc-7'`, `meta.ts` and `packages/shared/openapi` not in `git status` | - |
| 14 | M9-SIM-1 (Simulated regression vs `c2c983b`) | M2-SIM-1: the shared sim suites are inside check 3 and mock-core is check 8b; M2-SIM-2: `git diff --name-status c2c983b..HEAD -- packages/shared/src/sim/` | GREEN for SIM-1; SIM-2 listed, see section 5 | 30 sim-named test files in shared, all passed (incl. `sim-determinism` 8, `live-source-simulated-isolation` 4, `sim-demo-data-alignment` 12, `sim-gap-closure` 32, `sim-selector-stability` 25); mock-core 4 / 19 unchanged | within 3 / 8b |
| 15 | M9-PIN-1 pin sweep | section 4 | assertion-form stale pins 0; literal grep not 0 (stale prose only) | section 4 | 1 min |
| 16 | consolidation proof | section 6 | counts match every claim; no lost test | section 6 | - |
| 17 | stability series, 3 files x 5 alone | section 6(d) | 15 of 15 passes | section 6(d) | 3 min |

Totals of the eight whole suites (checks 3 to 8): 17,498 tests, of which 2612 + 31 + 6700 + 2423 + 2224 + 2915 + 564 + 19 = 17,488 passed, 0 failed, 7 (db) + 3 (transcriber) = 10 skipped. All floors of the ledger (71/1,851 shared; 160/3,954 core-server unit; 124/1,751 db; 117/1,495 web; 192/1,988 mobile; 4/19 mock-core; 57 pg-scripts) are met or exceeded in files and in tests.

Skips: db 7 tests in 3 files (`kill-matrix`, `seal-e2e`, `development-session-e2e`: the env-gated runner checks; checks 10, 11, 12 ran them), the same as run 12; transcriber 3 (host-conditional), as run 12.

Mobile: Jest printed NO "A worker process has failed to exit gracefully" line in the whole run (0 lines; run 12 printed it once), and none in the ten single-file runs of 6(d). This agrees with `test/14_consolidation_mobile.md` section 2 (the `gcTime` and the timer fixes).

Transcriber and port 8000: the default suite was run. `cpu-priority.test.ts:313-326` names `http://127.0.0.1:8000`, but only as a string handed to `createFakeOmlx(...).fetchImpl`, an injected in-process fake: no socket is opened. The `test/real/**` tests (and `vitest.real.config.ts`) were not run.

## The reds

None. No check was red, so no second run, no failure output to quote.

Two things that were NOT test failures, for the record:

- The first `run.sh --list` ran inside the command sandbox and died with `listen EPERM /tmp/claude-501/tsx-501/<pid>.pipe` (tsx's own IPC socket). It was re-run outside the sandbox and printed the 35 + 10 ids.
- My first kill-matrix call built its `--only` arguments as one string; zsh did not split it and `run.sh` answered `unknown argument` with rc 2 after 0 s, before any database or process was started. It was re-run with an array (check 12, 35 passed). Nothing ran twice.

## 1. What the load did

Load (1-minute) at the start of each whole suite: shared 2.6, capture-protocol 3.1, unit 2.9, db 3.8, web 3.1, mobile 3.5 (after a wait, below), transcriber 3.4, mock-core 3.0, seal e2e 3.1, development e2e 3.6, kill matrix 3.3. The load rose to 16.6 at the end of the core-web run (the same as run 12, where it rose to 16.8). I waited from 19:06:42 to 19:08:52 (2 min 10 s) for it to fall to 3.5 before mobile, which then ran at 3.2 to 5.1 and did not time out.

## 2. Timing and the ten slowest files (file wall inside its worker; files run in parallel, so the sum is larger than the run's wall)

| workspace | files | tests | wall of the run | workers | sum of per-file times | median file |
|-----------|-------|-------|-----------------|---------|-----------------------|-------------|
| shared | 101 | 2612 | 4.91 s | default | 17.3 s | 84 ms |
| capture-protocol | 1 | 31 | 0.12 s | default | 0.01 s | - |
| core-server unit | 324 | 6700 | 62.4 s | 4 | 138.7 s | 46 ms |
| core-server db | 181 (178 ran) | 2430 | 207.5 s | 2 | 278.9 s | 410 ms |
| core-web | 164 | 2224 | 84.2 s | default | 479.1 s | 2.09 s |
| mobile | 272 | 2915 | 177.1 s | 2 | 343.9 s | 718 ms |
| transcriber | 18 | 567 | 14.7 s | default | 26.5 s | 484 ms |
| mock-core | 4 | 19 | 3.9 s | default | 5.7 s | 2.06 s |
| pg-scripts | 7 | 57 | 0.2 s | node:test | - | - |
| seal e2e | 1 | 3 | 47 s | 1 | - | - |
| development-session e2e | 1 | 4 (2 ran) | 17 s | 1 | - | - |
| kill matrix | 1 (35 cells) | 35 | 588 s | 1 | - | - |

### shared

| # | file | tests | s |
|---|------|-------|---|
| 1 | `packages/shared/test/live-source-local-end.test.ts` | 86 | 4.2 |
| 2 | `packages/shared/test/api-capture-discovery.test.ts` | 18 | 0.9 |
| 3 | `packages/shared/test/live-source-session.test.ts` | 75 | 0.8 |
| 4 | `packages/shared/test/api-state-slices.test.ts` | 103 | 0.8 |
| 5 | `packages/shared/test/api-realtime.test.ts` | 74 | 0.8 |
| 6 | `packages/shared/test/openapi.test.ts` | 21 | 0.5 |
| 7 | `packages/shared/test/api-openapi-scope.test.ts` | 24 | 0.4 |
| 8 | `packages/shared/test/demo-evidence.test.ts` | 18 | 0.4 |
| 9 | `packages/shared/test/live-source-atomicity.test.ts` | 39 | 0.4 |
| 10 | `packages/shared/test/live-source-replica.test.ts` | 15 | 0.4 |

capture-protocol: one file, `packages/capture-protocol/test/protocol.test.ts`, 31 tests, 0.0 s.

### core-server unit

| # | file | tests | s |
|---|------|-------|---|
| 1 | `apps/core-server/src/capture/adapters/local/__tests__/mic-helper.generated.test.ts` | 8 | 11.3 |
| 2 | `apps/core-server/src/capture/adapters/local/__tests__/no-delivery.test.ts` | 17 | 9.5 |
| 3 | `apps/core-server/src/capture/__tests__/ipc.test.ts` | 16 | 9.2 |
| 4 | `apps/core-server/src/capture/adapters/camera/__tests__/ws-discovery.test.ts` | 28 | 8.4 |
| 5 | `apps/core-server/src/sealing/__tests__/pipeline.test.ts` | 61 | 8.3 |
| 6 | `apps/core-server/src/sealing/__tests__/stt-states-verify.test.ts` | 57 | 8.0 |
| 7 | `apps/core-server/test/support/fake-onvif-stub.test.ts` | 38 | 5.3 |
| 8 | `apps/core-server/src/sealing/__tests__/finalize-transcript.test.ts` | 31 | 5.2 |
| 9 | `apps/core-server/src/db/mapping/__tests__/round-trip.test.ts` | 43 | 5.2 |
| 10 | `apps/core-server/src/transcription/__tests__/session-run.test.ts` | 21 | 4.4 |

(`encrypted-credential.test.ts` was 12.3 s in run 12 and is no longer in the top 10: the 0.3 s fix of `test/14_consolidation_core_server_unit.md`.)

### core-server db

| # | file | tests | s |
|---|------|-------|---|
| 1 | `apps/core-server/src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts` | 16 | 38.1 |
| 2 | `apps/core-server/src/db/reset/__tests__/reset-failures.db.test.ts` | 54 | 25.3 |
| 3 | `apps/core-server/src/db/reset/__tests__/cli.db.test.ts` | 8 | 22.9 |
| 4 | `apps/core-server/src/capture-session/__tests__/session-capture.db.test.ts` | 54 | 21.2 |
| 5 | `apps/core-server/test/acceptance/contract.test.ts` | 38 | 12.2 |
| 6 | `apps/core-server/src/engine/__tests__/restart.db.test.ts` | 32 | 9.4 |
| 7 | `apps/core-server/src/db/fixtures/__tests__/bulk-fixture.db.test.ts` | 26 | 8.2 |
| 8 | `apps/core-server/src/modules/capture-discovery/__tests__/capture-discovery.booted.db.test.ts` | 4 | 7.5 |
| 9 | `apps/core-server/src/modules/capture-discovery/__tests__/lane-camera-stub.db.test.ts` | 2 | 7.4 |
| 10 | `apps/core-server/src/modules/demo/__tests__/reset-failures.db.test.ts` | 15 | 5.5 |

### core-web

| # | file | tests | s |
|---|------|-------|---|
| 1 | `apps/core-web/src/features/evidence/__tests__/sealed-player.test.tsx` | 29 | 38.7 |
| 2 | `apps/core-web/src/test/live-session-new-local-notice.test.tsx` | 13 | 14.4 |
| 3 | `apps/core-web/src/test/live-evidence-verify.test.tsx` | 14 | 11.5 |
| 4 | `apps/core-web/src/test/live-evidence-export.test.tsx` | 10 | 10.9 |
| 5 | `apps/core-web/src/test/live-security-audit-chain.test.tsx` | 15 | 10.0 |
| 6 | `apps/core-web/src/test/live-shell-notices.test.tsx` | 22 | 9.0 |
| 7 | `apps/core-web/src/test/live-security-audit-export.test.tsx` | 10 | 8.9 |
| 8 | `apps/core-web/src/test/real-core-facts.test.tsx` | 84 | 8.4 |
| 9 | `apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx` | 16 | 7.4 |
| 10 | `apps/core-web/src/test/live-session-new-create.test.tsx` | 16 | 7.1 |

### mobile

| # | file | tests | s |
|---|------|-------|---|
| 1 | `apps/mobile/src/features/evidence/evidence-detail.test.tsx` | 74 | 19.6 |
| 2 | `apps/mobile/src/features/storage/live-storage-sites.test.tsx` | 15 | 9.1 |
| 3 | `apps/mobile/src/features/evidence/live-evidence-export.test.tsx` | 31 | 8.6 |
| 4 | `apps/mobile/src/features/pairing/pairing-live.test.tsx` | 28 | 7.2 |
| 5 | `apps/mobile/src/features/evidence/sealed-player.test.tsx` | 42 | 5.8 |
| 6 | `apps/mobile/src/features/session-new/live-session-new-sites.test.tsx` | 29 | 5.8 |
| 7 | `apps/mobile/src/runtime/connection-banner-live.test.tsx` | 9 | 5.5 |
| 8 | `apps/mobile/src/features/capture-selector/local-source-start-notice.test.tsx` | 8 | 4.5 |
| 9 | `apps/mobile/src/features/capture-selector/selector-lines.test.tsx` | 32 | 4.4 |
| 10 | `apps/mobile/src/features/devices/devices-states.test.tsx` | 4 | 4.4 |

### transcriber

| # | file | tests | s |
|---|------|-------|---|
| 1 | `apps/transcriber/src/__tests__/checkpoint-runner.test.ts` | 70 | 7.2 |
| 2 | `apps/transcriber/src/__tests__/kill-resume.test.ts` | 7 | 6.9 |
| 3 | `apps/transcriber/src/__tests__/assembly.test.ts` | 31 | 4.6 |
| 4 | `apps/transcriber/src/__tests__/backends.test.ts` | 94 | 2.0 |
| 5 | `apps/transcriber/src/__tests__/diarization.test.ts` | 60 | 1.7 |
| 6 | `apps/transcriber/src/__tests__/cpu-priority.test.ts` | 26 | 1.2 |
| 7 | `apps/transcriber/src/__tests__/silero-vad.test.ts` | 17 | 0.7 |
| 8 | `apps/transcriber/src/__tests__/adapter-contract.test.ts` | 11 | 0.7 |
| 9 | `apps/transcriber/src/__tests__/media-time-wrong-constant.test.ts` | 6 | 0.5 |
| 10 | `apps/transcriber/src/__tests__/media-time.test.ts` | 14 | 0.3 |

### mock-core (all 4 files)

`apps/mock-core/test/standalone-launcher.test.ts` 13 tests 3.6 s; `heartbeat.test.ts` 1 test 2.1 s; `health.test.ts` 3 tests 0.0 s; `ws-origin.test.ts` 2 tests 0.0 s.

### Wall time against the audit's estimate (test/13 section 8) and against run 12

| suite | run 12 (before) | this run (after) | audit estimate | reading |
|-------|-----------------|------------------|----------------|---------|
| shared | 5 s | 5 s | 5 s | as expected |
| unit | 70 s | 62 s | 60-70 s | as expected |
| db | 243 s | 208 s | 150-200 s | -14 %, 8 s above the range (the 101 s file is now 38 s, not under 20 s: test/14 db section 9) |
| core-web | 87 s | 84 s | 70-80 s | -3 %; above the range. The test/14 core-web run measured 72.6 s at load 5.9; this one started at 3.1 and the load rose to 16.6 at its end, as in run 12 |
| mobile | 195 s | 178 s | 160-180 s | in range |
| transcriber | 15 s | 15 s | 15 s | as expected |
| mock-core + capture-protocol | 5 s | 4 s | - | - |
| sum of the eight whole suites | 620 s | 558 s | 465-555 s | -10 %, at the top of the estimate |
| kill matrix / seal e2e / dev e2e | 588 / 47 / 17 s | 588 / 47 / 17 s | protected, unchanged | unchanged |

## 3. Wall time of the whole regression

18:58:02 to 19:28:30, about 31 minutes: typecheck + lint (per workspace and root) 3 min; shared + capture-protocol 6 s; unit 63 s; db 208 s; core-web 85 s; wait for load 2 min 10 s; mobile 178 s; transcriber 15 s; mock-core 4 s; pg-scripts 0.2 s; seal e2e 47 s; development e2e 17 s; kill matrix 588 s; contract guards 17 s; pin sweep, SIM-2 and consolidation proof by reading about 8 min; stability series (3 x 5 runs) 3 min. Test run time alone (checks 3 to 12) about 20 minutes.

## 4. M9-PIN-1, the pin sweep as row 95 defines it

Definition used (`masterplan/10_test_strategy.md` section C, "Review that confirms no stale pin survives", line 750, and the extension PE-127-10, line 757; the `M4-PIN-1` stale list at line 281): the X-PIN-1 grep over the FULL repo (`apps`, `packages`, `scripts`, `release`, root files; excluded: `node_modules`, `build`, `dist`, `.data`, `.cache`, `docs`, `package-lock.json`, `graft`, `ui_design`, mobile native folders). Patterns, written out in the scratchpad (`scratchpad/r95/pins.sh`):

- original: `toHaveLength\(75\)|75 operations|toHaveLength\(28\)|28 slices|dbc-2|'0\.1\.0'|'0\.2\.1'|DB_SCHEMA_VERSION = 1`
- extended (PE-127-10, a number alone is never a pattern): `toHaveLength\(92\)|92 operations|35 GET|57 POST|toHaveLength\(63\)|63 audit|offline ... 26|dbc-3|DB_SCHEMA_VERSION = [2-5]|40 tables|419 columns|166 CHECK|eight files`
- the intermediate values of rows 132/133 and the M2 values (89 / 34 / 55; 93-96 operations; 62, 64-66 audit types; offline 28-30): 14 further lines, all prose or deliberate history (below).

Result, literal: NOT 0. Result by form:

| form | count | reading |
|------|-------|---------|
| an assertion on a current count, version or floor that is stale | **0** | the live pins are right: registry 97 / 36 / 61 (`api-registry.test.ts:299,330,331`), 67 audit types (:492), 30 replicated slices (`api-state-slices.test.ts:443`), OpenAPI `OPENAPI_DOCUMENT_VERSION = '0.2.0'` and `OPENAPI_CORE_SERVER_DOCUMENT_VERSION = '0.3.0'` (`openapi.ts:109,115`), `DB_SCHEMA_VERSION = 6` / `'dbc-7'` (`meta.ts:38,40`); `'0.2.1'` 0 hits; `DB_SCHEMA_VERSION = 1..5` 0 hits |
| deliberate history, base label or negative control | all other hits of `dbc-2` (6), `dbc-3` quoted forms, `40 tables`, `eight files`, `'0.1.0'` (27), `rbac-matrix.test.ts:1136` `baseOps` `toHaveLength(75)` | `dbc-2`: `0003_privileges.sql:70`, `schema/index.ts:35` comment, `contract-inventory.test.ts:256`, `constraints.db.test.ts:170`, `boot-checks.db.test.ts:116,118` (pre-state injections); `dbc-3` / `40 tables` / `eight files`: `test/db/set4.db.test.ts` (it tests the pre-state (2, dbc-3) on purpose), migrations `0005`/`0007` SQL, `meta.ts` comment; `'0.1.0'`: all 27 are device-app / health / launcher / protocol version fixtures (`fixtures.ts`, `*-page.test.tsx`, `standalone-launcher.test.ts`, `build-web-packages.ts`, `protocol.test.ts`...), none is an OpenAPI `info.version`; `rbac-matrix.test.ts:1136` is the closed task-2 base table of 75, accepted at the M2 gate. The 370 lines of `dbc-3` are mostly spec references ("dbc-3 §B.11"); I read the quoted-literal and code forms, not every prose line |
| unrelated number | 5 | `toHaveLength(28)` at `evidence-package.test.ts:183`, `contract-inventory.test.ts:343`, `writers.test.ts:161`; `toHaveLength(63)` at `names.test.ts:126`, `commands.test.ts:113` (database-name lengths) |
| **stale PROSE: a comment or test title that states an old count** | **34 lines** | the open point, below |

Stale prose, none of it an assertion on the old number (the tests iterate the registry or the slice list and assert the current count elsewhere):

- "75 operations" (current 97), 13 lines: `permission-guard/__tests__/decision.test.ts:98` (describe title), `modules/rbac/__tests__/matrix.db.test.ts:139` (describe title), `:225`, `test/acceptance/contract.test.ts:2051`, `test/acceptance/rbac-matrix.test.ts:4,14,1130`, `core-web/src/test/live-api-reference-page.test.tsx:14`, `live-api-reference-document.test.tsx:13`, `core-web/src/features/api-reference/api-document.ts:22,275`, `.../index.tsx:16`, `packages/shared/src/api/index.ts:27`. The last four lines (`api-document.ts` x2, `index.tsx`, `api/index.ts`) are PRODUCT comments (JSDoc), not test files.
- "28 replicated slices" / "28 slices" (current 30), 20 lines: titles `realtime/__tests__/hub.lifetime.test.ts:69`, `state.db.test.ts:76`, `messages.test.ts:67`; comments and one runtime failure message in `test/acceptance/shared-state.support.ts:118,130,230,643,1090,1127`, `first-contact.db.test.ts:368,495`, `restart.db.test.ts:302` (a console line), and 8 lines of product comments: `engine/types.ts:265`, `realtime/messages.ts:8,96`, `packages/shared/src/live/source/live-sim.ts:46`, `api/realtime-messages.ts:16,37`, `api/realtime-examples.ts:11`, `api/core-api.ts:605`.
- "92 operations", 1 stale line: `packages/shared/test/openapi.test.ts:14` ("The committed openapi.json now holds the `all` scope (92 operations ..."; the committed document has 97). Three more lines name 92 / 35 / 57 as dated history ("C3 §2.5 ... 92 operations x 9 callers. C3 §10.1: 97 x 9": `decision.test.ts:111`; `core-api.ts:1058`; `api-registry.test.ts:171`) and are correct as written.

Was it the consolidation? No. I ran the same combined pattern with `git grep` on `HEAD` (a5d75ed) and on the working tree including untracked files: 445 lines each; the sets differ in exactly 2 lines (a `version: '0.1.0'` fixture whose indentation changed in `security-audit.test.tsx`, and a `dbc-3 §B.11` comment that moved from `integration-c1.test.ts` into `sim-evidence-item-kind.test.ts`). The consolidation introduced no stale pin and removed none. These 34 lines were already there at the M2 gate (which grepped only the section-C file list) and at every gate since.

Verdict on M9-PIN-1: the criterion "0 stale counts / versions / floors" holds for every count, version and floor that a test asserts; the literal grep over the full repo returns 34 stale prose lines in 22 files. That is for the controller to rule on (fix the 34 comments in a hygiene row, or accept them as history). Not fixed here (D122).

## 5. M9-SIM-1, the diff audit (M2-SIM-2)

`git diff --name-status c2c983b..HEAD -- packages/shared/src/sim/` lists 37 files: 12 added (`capture-config.ts`, `capture-fault-wording.ts`, `capture-notices.ts`, `capture-registry.ts`, `capture-session.ts`, `capture-telemetry.ts`, `core-facts.ts`, `core-not-running.ts`, `seal-blocked.ts`, `seal-unsealable.ts`, `selector-in-force.ts`, `start-refused.ts`) and 25 modified (`actions`, `api`, `audio`, `auth`, `constants`, `dataset`, `demo-alignment`, `derive`, `engine`, `errors`, `events`, `evidence-actions`, `evidence`, `faults`, `generator`, `health`, `index`, `initial-state`, `react`, `scenarios`, `selectors`, `session-machine`, `store`, `types`, `vocabulary`). Working tree against HEAD: only `selector-in-force.ts` (one comment line, test/15). Ownership by blueprint row: 36 of the 37 file names appear in implementation notes; `scenarios.ts` (a 4-line change, commit `abf742f`) is covered by notes 14 / 17 / 61 / 64 / 126 that name "scenarios" without the file name. I did not map each file to its row; that mapping is the verifier's, this list is the evidence.

## 6. Consolidation proof

### (a) Files and tests: BEFORE (test/12) against AFTER (this run) against the claim of the test/14 report

| workspace | BEFORE files / tests (test/12) | AFTER files / tests (this run) | claimed by test/14 | audit expectation (test/13 s.8) | match |
|-----------|-------------------------------|--------------------------------|---------------------|---------------------------------|-------|
| shared | 121 / 2612 | **101 / 2612** | 121 -> 101 / 2612 | about 100 / 2612 | yes |
| capture-protocol | 1 / 31 | **1 / 31** | 1 / 31 | 1 / 31 | yes |
| core-server unit | 356 / 6691 | **324 / 6700** | 356 -> 324 / 6691 -> 6700 | about 315 / about 6690 | yes (9 files and 10 tests above the audit's estimate; the claim is exact) |
| core-server db | 196 (193 passed, 3 skipped) / 2443 (2436 passed, 7 skipped) | **181 (178 passed, 3 skipped) / 2430 (2423 passed, 7 skipped)** | 196 -> 181 / 2443 -> 2430, 2423 passed, 7 skipped | about 180 / about 2426 | yes |
| core-web | 182 / 2224 | **164 / 2224** | 182 -> 164 / 2224 | about 150 / about 2207 | yes (18 files fewer; the test count did not drop: the W4 collapse of 17 tests was not done, test/14 core-web) |
| mobile | 311 / 2924 | **272 / 2915** | 311 -> 272 / 2924 -> 2915 | about 255 / 2898-2924 | yes |
| transcriber | 20 / 567 (564 + 3 skipped) | **18 / 567 (564 + 3 skipped)** | 20 -> 18 / 567 | 18 / 567 | yes |
| mock-core | 4 / 19 | **4 / 19** | 4 / 19 | 4 / 19 | yes |
| total | 1,191 / 17,511 | **1,065 / 17,498** (skipped tests included in the test counts) | 1,191 -> 1,065 follows from the rows | about 1,020 / about 17,450 | files -10.6 % (audit: -14 %), tests -13 = -0.07 % |

No mismatch: all eight AFTER pairs equal the numbers in the five reports.

An independent title check, beyond the counts. The raw JSON of run 12 (`scratchpad/wm/*.json`, written 15:49-16:06 that day) against the JSON of this run, test by test, by the leaf test title as a multiset (the describe blocks were renamed on purpose, so the full path cannot be compared):

| workspace | tests before / after | titles in BEFORE and not in AFTER | titles in AFTER and not in BEFORE | reading |
|-----------|----------------------|-----------------------------------|-----------------------------------|---------|
| shared | 2612 / 2612 | 3 | 3 | the three static scans that now read "every source file of the folder" instead of "the thirteen files" / "eight files" / "exactly 15 namespace files": same tests, new wording (test/14 shared, rule R1) |
| capture-protocol | 31 / 31 | 0 | 0 | - |
| core-server unit | 6691 / 6700 | 8 | 17 | 5 scan tests reworded into 5 "reads the production files of the folder" tests, 3 `workerDown` cases whose title carries an inline source text that only changed in whitespace and import alias; +9 net: the 9 new tests of the R1 scan rule ("a file that JOINS the folder is covered at once", "an empty folder ... is EMPTY, never a pass", "the walk is independent of the scanner" ...) |
| core-server db | 2443 / 2430 | 13 | 0 | exactly the 13 titles `test/14_consolidation_core_server_db.md` section 10 names, all schema-version stamps (`schema version 6, contract dbc-7` x 4, `: no migration` x 3, `` `alerts.reason` exists`` x 1, `is at the schema version of the code: [6, 'dbc-7']` x 2, `is at schema version 4 / dbc-5 ... no migration` x 2, `... no migration belongs to this pass` x 1), each deleted with its covering test named in test/13 |
| core-web | 2224 / 2224 | **0** | **0** | every one of the 2,224 titles preserved |
| mobile | 2924 / 2915 | 14 | 5 | the 9 "copy of Simulated mode is as it was at `acaff20` (N texts, one digest)" tests removed on purpose (test/14 mobile section 5, M6) and 5 folder-scan tests reworded; -9 net |
| transcriber | 567 / 567 | 1 | 1 | one scan test reworded (rule R1) |
| mock-core | 19 / 19 | 0 | 0 | - |

So no test was lost to a merge: every title difference is either a deliberate removal that its report lists (db -13, mobile -9) or a reworded or added scan test. A test that lost its setup or order in a merge would show here as a red or a lost title; there is none.

### (b) No per-wave test file left

Command: `find apps packages -type f` for names matching `wave-*`, `pass-*`, `fix-*`, `fxr-*`, `integration-*`, `copy-round-*`, `row[0-9]*`, `review-*`, `gate*`, excluding `node_modules` and build output.

Test files matching: 6, and none of them is a per-wave file of the consolidation's scope.

| file | what it is | reported as kept? |
|------|-----------|-------------------|
| `apps/core-server/src/modules/demo/__tests__/gate.db.test.ts` | the gate of the demo controls (flag OFF / ON; spec DC-1..DC-3), a feature name. Tracked, unchanged, not a wave file | not named in a report; a false positive of the pattern `gate*` |
| `apps/transcriber/test/real/wave-h-speech-fixture.real.test.ts` | real-engine test, outside the default suite (`vitest.real.config.ts`) | not named; `test/14_consolidation_shared_and_small.md:17` states "no `test/real/**`" was touched |
| `apps/transcriber/test/real/row77-cpu-local.real.test.ts`, `row77-omlx-server.real.test.ts`, `row77-df1.real.test.ts`, `row78-speaker-labels.real.test.ts` | real-engine tests (4 files), not run here by instruction | same |

Non-test support files that still carry a per-wave name (5, all unchanged and imported by renamed tests): `apps/core-server/src/media-stream/__tests__/wave-k-z1-real-tables.ts` (used by `seek-index.test.ts`), `apps/core-server/src/sealing-host/__tests__/fix-151-init-segments.ts` (used by `stream-profile.test.ts`), `apps/core-web/src/features/evidence/__tests__/wave-h-c2-bed.ts` (used by 5 evidence tests), `apps/transcriber/test/real/wave-h-speech-pipeline-child.ts` and `row77-pipeline-child.ts` (real tests). The reports do not name these five as kept or as deferred. Findings, low: a rename of the three non-real helpers would finish the naming job; the six `test/real` files are a decision for the controller (they run only by hand).

### (c) `git status --short`: what changed outside `docs/`

412 entries: 172 deleted (` D`), 176 modified (` M`), 64 untracked (`??`). Outside `docs/` and outside test / test-support paths there are exactly five entries, the five comment-only product files of `test/15_consolidation_closing.md` section 1:

| file | changed lines | non-comment lines among them |
|------|---------------|------------------------------|
| `apps/core-server/src/capture/boot/checks.ts` | 2 (1 removed, 1 added) | 0 |
| `apps/core-server/src/capture/supervisor.ts` | 2 | 0 |
| `apps/mobile/src/features/capture-selector/selector-in-force.ts` | 2 | 0 |
| `apps/mobile/src/features/capture-selector/source-state.ts` | 2 | 0 |
| `packages/shared/src/sim/selector-in-force.ts` | 2 | 0 |

(`git diff -U0`, lines not starting with `*`, `//` or `/*` after the +/-: 0 in each.) No other product file. The non-`*.test.*` files that the filter lets through are all test support: `apps/core-server/test/helpers/db/index.ts` (adds `useFurtherDatabase`), `apps/core-server/test/static/{scan,module-rules}.ts`, `apps/core-web/src/runtime/testing/fake-time.ts`, `apps/core-web/src/test/{real-core-bed.tsx,static-scan.ts}`, `apps/mobile/src/features/evidence/testing/*`, `apps/mobile/src/features/session-new/testing/live-session-new-bed.tsx`, `apps/mobile/src/runtime/testing/*`, the untracked `packages/shared/test/support/` (6 beds). No media extension in `git status --porcelain` (X-MEDIA-1: 0). The seal e2e wrote to `.cache/row95/seal-e2e/` (4 JSON files, git-ignored by `.gitignore:47`); nothing else was left behind.

### (d) Stability: the three files that were flaky or racy, each 5 times alone

Quiet host (load 1.7 to 2.9 during the series); the db file with the same command as run 12 row 5b.

| file | command | passes out of 5 | tests per run | wall per run |
|------|---------|-----------------|---------------|--------------|
| `apps/core-server/src/modules/capture-config/__tests__/capture-config.db.test.ts` (holds the old `integration-d1b` cases: `:617` "REAL_DEVELOPMENT: MIC-03 is selected through the API, stored, equal to the committed state, and held across a restart" is the case that raced in run 1 of the db suite in test/12) | `/usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2 src/modules/capture-config/__tests__/capture-config.db.test.ts` | **5 / 5** | 17 | 4-5 s |
| `apps/mobile/src/features/evidence/live-evidence-export.test.tsx` (new home of `wave-k-m2-operator-export.test.tsx`, test/14 mobile line 200; the `observersTold()` fix of note 150 now lives in `features/evidence/testing/live-evidence-bed.tsx`) | `npx -w apps/mobile jest --maxWorkers=2 src/features/evidence/live-evidence-export.test.tsx` | **5 / 5** | 31 | 7-8 s |
| `apps/mobile/src/features/session-live/mic-source.test.tsx` | `npx -w apps/mobile jest --maxWorkers=2 src/features/session-live/mic-source.test.tsx` | **5 / 5** | 19 | 3-4 s |

15 of 15. The `integration-d1b` race of test/12 (a health-sampler tick between a database read and `engine.state()`) did not occur in the whole db suite run (check 5, 181 files, 0 failed) nor in the five solo runs. That is not proof that the race is gone: test/12 saw it once in two whole db runs and not in the solo run; this run saw it in none. I did not read the assertion at `:154` of the old file against its new place to see whether the `health` comparison was changed.

## 7. What row 95 names that I could not run, or ran in a different form

- `npm audit`: row 95 does not name it (it is the standing check X-DEP-1 of the milestone checkpoints). Not run.
- Root `npm test`: row 95 does not name it, and `masterplan/10_test_strategy.md` section B says it is not accepted as gate evidence (load flakes). Not run. Root `npm run typecheck` and `npm run lint` were run (rows 1h, 2h) because row 95 and M9-QA-1 name "root typecheck/lint".
- "Release build only if the user asks" (M9-QA-1): not asked, not run.
- "Every added test named" (row 95 Verification): there is no list of the roughly 6,000 tests this task added over `c2c983b` in this file. What is named is the delta against run 12 by title (section 6(a)); the earlier gates name the additions of their own waves. A full list since `c2c983b` would need the JSON report of `c2c983b`, which does not exist.
- M9-SIM-1 as "M2's SIM-1/SIM-2 pair": SIM-1 is checks 3 and 8b (the whole shared suite, which holds the 30 sim-named files, and the mock-core suite), SIM-2 is the file list of section 5; I did not re-run them as separate commands.
- "At the final C3 count incl. R-8 if confirmed": R-8 (the STT configuration menu) is confirmed (D24); its tests are inside the whole suites above (for example `api-stt-config.test.ts` in shared, `stt-states-verify.test.ts` in unit). No separate check.
- Class-C items of A.9 (physical device e2e, TPM signer, benchmark on the real Core device, real cameras / PoE): listed, not executable on this Mac, not run, as the strategy says.
- Real-engine transcriber tests and anything that calls port 8000, `test/real/**`: not run, by instruction.
- The attended and the speech cases of the development-session e2e (2 skipped): the user's, by decision D163.
- The kill-matrix log has no `CAPTURE_FAULT` lines to read (the default reporter prints 16 lines); the 35 passing cells are the evidence, as in test/12.

## 8. Findings for the controller (none is a red)

| # | finding | where | severity | kind |
|---|---------|-------|----------|------|
| 1 | The M9-PIN-1 literal grep returns 34 stale prose lines (75 operations x13, 28 slices x20, 92 operations x1); no assertion is stale; identical to HEAD, not caused by the consolidation | section 4 | low | stale comments / titles; 12 of the 34 lines are comments in product files |
| 2 | Five per-wave-named support files remain, and 6 `test/real` files; no report names them as kept | section 6(b) | low | naming |
| 3 | Run-time targets of the audit not reached: db 208 s against 150-200 s (`capture-discovery.db.test.ts` 38 s against under 20 s), core-web 84 s against 70-80 s and 164 files against about 150, 2224 tests against about 2207 (W4 not done) | section 2 | info | estimate versus measurement; the reports already say so |
| 4 | `integration-d1b`'s old race is not shown to be gone, only not seen | section 6(d) | info | flake watch |

## Status

needs-review for finding 1 only (the literal reading of M9-PIN-1). Overall GREEN: 8 whole suites 17,488 passed, 0 failed, 10 skipped; pg-scripts 57 of 57; seal e2e 3 of 3; development-session e2e 2 passed (2 skipped by design); kill matrix 35 of 35; contract guards 66 + 38; 97 operations (36 GET / 61 POST), 67 audit types, schema 6 / dbc-7 unchanged; typecheck and lint of 7 workspaces and of the root exit 0.

---
*Generated: 2026-10-11 19:40 WIB*
