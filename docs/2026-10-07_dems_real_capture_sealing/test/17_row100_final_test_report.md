---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-11
agent: test-expert
row: 100 (M9 final chain, step 3 of 4: M9-CH-3, the test strategy against what was run)
tree: commit 713d83f (main, local); working tree = that commit plus documentation files only
status: needs-review (Part A is GREEN; the open points are the gaps of section 0 and the findings T100-01..09)
---

# Row 100: final test report (2026-10-11)

Runner and reader only (D122): no product file, no test file, no git write, no install, nothing fixed. Every check of Part A ran ONCE and none was red, so nothing ran a second time; the only repeated runs are the 5 x 5 flake watch of Part D, which the brief asks for.

Start 20:45:26, end of Part A 21:13:36 (28 min 10 s); flake watch 21:14 to 21:17. One heavy thing at a time; before each whole suite the 1-minute load was below 4 (the waits are in D.5). `scripts/lane/lane.sh status` at the start and at the end: main, 1, 2, 3 all `stopped` (identical output); no lane started, nothing reset, lane 2's data untouched. `pgrep -fl 'capture-worker|ffmpeg|whisper'` empty before the kill matrix and after it. Metro and the two emulators were not touched; no device, no browser. No `.data/pg*.env` read; PostgreSQL only through the db test project under `.locks/db-migrate.lock`; no port 5173-5175 / 8000 / 5432; no local-device selector, no `DEMS_*_ATTENDED`; no audio played. `git status --short` at the start: `decisions.md` modified and one untracked progress note; at the end the same plus five untracked files of the three other chain agents (their reports). Nothing outside `docs/` changed. Flags set, each on its own command only: `DEMS_SEAL_E2E=1` (+ `DEMS_SEAL_E2E_OUT=.cache/row100/seal-e2e`), `DEMS_DEV_SESSION_E2E=1`, `DEMS_KILL_MATRIX=<35 ids>`.

What was read, and how. Row 100 of `identification/02_structured.md:432` word for word. `masterplan/10_test_strategy.md`: sections 0, B, G, I, J and A.9 as text; the catalogue tables A.3 to A.8 (lines 160 to 635) row by row through a column extract (check id, name, command, runs) and the rows of M3, M4 base, CR-1..7 and the M9-PIN-1 erratum in full; the assertion text of the other rows was NOT read clause by clause. `test/16`, `test/13` sections 6 and 8, `implementation/162` and `163` (the sections on pins, renames, skips, timeouts, proof, open items). The gate reports by their check tables and their "NOT PROVEN" sections: `08_m3_gate`, `09`, `09b`, `09c`, `09d`, `10`, `10b`, `10c`, `10d`, `10e`, `11`, `11b`, `12`, `12b`, `12c`, `12d`, `13b`, `13c`, `13d`, `14_wave_m_confirmation`. `test/14_consolidation_*.md` were not re-read: their claims were proven by count and by title in test/16 section 6, and this run compares titles against that run (A.3).

Row 100's own text names `gateway_check/23_test_final.md` as the output; the controller's brief for this run names this file. One file was written (plus the progress note); `masterplan/02_plan.md` and `implementation/99_implementation_report.md` were not touched (T100-06).

## 0. Verdict

**Is the test evidence sufficient for "DONE ON THIS MAC WITH FAKE DEVICES"? YES WITH LISTED GAPS.**

Why yes: the whole regression is green on `713d83f` (17,494 passed, 0 failed, 10 skipped by stated condition; kill matrix 35 of 35; seal e2e 3 of 3; development-session e2e 2 of 2 that an agent may run; contract totals 97 / 36 / 61 / 67, schema 6 / dbc-7; typecheck and lint clean, 0 warnings), and of the 235 named check ids of M3..M9, 204 are proven by a suite of this run, by a gate session on a lane, or by a harness record on unchanged code.

The gaps, all of them (none is a red; each is a thing the words "done on this Mac with fake devices" should not be read to include):

| # | Gap | Checks | Whose |
|---|-----|--------|-------|
| G1 | NOT PROVEN, never closed and never ruled: no listener for a source kind without an opener (socket snapshot + push attempt) | `M5-SEC-SRC-1` | controller: a test or a ruling (T100-02) |
| G2 | NOT PROVEN: composite export is blocked on the licence decision; the job answers `COMPOSITE_ENCODER_NOT_SELECTED` | `M8-CMP-1` | user |
| G3 | The local microphone of this Mac failed its only recorded run on `rate` (D128, D136); the product states the limit | `M4-LOCAL-MIC-1` | user / next task |
| G4 | Proven by tests only where the strategy asked for a device or a browser: notification B with a camera on the tablet and the phone, the operator without `CAPTURE_CONFIG`, the unreachable active microphone on web and phone | `M4-NODEV-B-T`, `-P`, `M4-NODEV-NOCFG-T`, `M4-MIC-ACTIVE-W`, `-P` | controller: accept the tests or schedule |
| G5 | User-attended, not run by anyone on record: the local-device session, the clap, the "is on" line on three clients | `M5-LOCAL-E2E-1` (local half), `M5-LOCAL-CLAP-1`, `M5-SEC-PRIV-2-W/-T/-P` | user |
| G6 | Real network and hardware: the real-LAN probe was not run; class C (real cameras, PoE, TPM signer, the real Core device, physical-device e2e) is listed in the strategy and not executable here | `M4-DISC-LAN-1`, class C register | user / handover |
| G7 | Eleven checks rest on a harness or row record that this run did not repeat: the capture-worker series of gate 64 (worker sources unchanged since: `git log -- apps/capture-worker` shows only `README.md` in `74fd1f1`), the generated-picture AV run of row 134, the migration of the four development databases | `M3-WI-1`, `M3-AV-1`, `M3-AV-2`, `M3-KC-1`, `M3-KC-2`, `M3-KC-4`, `M3-SR-2`, `M3-RTSP-BIND-1`, `M5-GAP-1`, `M4-LOCAL-AV-1`, `M4-DB-APPLY-1` | controller (T100-03) |
| G8 | Live proofs that are partial, each stated at its gate: `M4-PC-1` ("Checking your permissions..." never observed), `M4-CONN-GUARD-W` (lock-out half by tests), `M4-SEC-UI-1` (two parts not run), `M5-SW-W/-T/-P` (no file analyser on a product recording), `M5-NODEV-C-T` (connecting state only), `M6-KR-1` form (a) (a Core kill while the engine decodes), `M7-FF-*` (first half), 12d F-2 (one-camera seal, truncated tail, kept-plaintext alert, boot sweep, every REAL_PRODUCTION refusal: tests only) | as listed | as ruled at the gates |
| G9 | The server STT backend was never driven live (the user's rule, port 8000): `M6-TF-1` on `omlx-server`, `M6-STTCFG-UNREACH` live. The speech case of the development e2e and every `test/real` engine test were not run in this row (row 100 does not name them) | as listed | user |
| G10 | Biometric steps: skipped by the user (D151). The strategy holds NO biometric check id (section G), so no row of Part B carries this state | - | user |
| G11 | Ten kill-matrix cells are PARKED (fallback steps S7 / S8, OD-21): conditional, not triggered | `M7-KM-*-S7`, `-S8` | as designed |

## A. The run

### A.1 Result: GREEN

| # | check | command | result | counts | wall | against test/16 |
|---|-------|---------|--------|--------|------|-----------------|
| 1a-g | typecheck x 7 | `npm run typecheck -w @dems/<ws>` (shared, core-server, core-web, mobile, capture-protocol, transcriber, mock-core) | GREEN, rc 0 x 7 | 0 `error TS` in each log | 4 / 8 / 12 / 6 / 0 / 2 / 1 s | same |
| 2a-g | lint x 7 | `npm run lint -w @dems/<ws>` | GREEN, rc 0 x 7 | 0 errors, **0 warnings** | 0 / 0 / 1 / 15 / 0 / 1 / 0 s | the one mobile eslint warning of test/16 is gone (commit `2c0855c`) |
| 1h | root typecheck | `npm run typecheck` | GREEN, rc 0 | 0 `error TS` | 36 s | same |
| 2h | root lint | `npm run lint` | GREEN, rc 0 | 0 warnings | 17 s | warning gone |
| 3 | shared | `npm run test -w @dems/shared` | GREEN | 101 files; 2614 passed / 0 failed / 0 skipped | 5 s (vitest 5.02 s) | +2 tests (R96-1, the two README-note tests) |
| 4 | capture-protocol | `npm run test -w @dems/capture-protocol` | GREEN | 1 file; 31 passed | 1 s (114 ms) | same |
| 5 | core-server unit | `npx vitest run --root apps/core-server --project unit --maxWorkers=4` | GREEN | 324 files; 6702 passed / 0 failed / 0 skipped | 62 s (61.62 s) | +2 tests (RC-3 error log, rule A-7) |
| 6 | core-server db | `/usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2` | GREEN | 181 files: 178 passed, 3 skipped; 2430 tests: 2423 passed, 7 skipped, 0 failed; teardown "dropped 8 database(s) in 198 ms; 0 remain" | 207 s (206.60 s) | same counts, -1 s |
| 7 | core-web | `npm run test -w @dems/core-web` | GREEN | 164 files; 2224 passed / 0 failed / 0 skipped | 80 s (79.57 s) | same counts, -5 s |
| 8 | mobile | `npx -w apps/mobile jest --maxWorkers=2` | GREEN, rc 0 | 273 suites passed; 2917 passed / 0 failed / 0 skipped; 0 "failed to exit gracefully" lines | 182 s (Jest 182.2 s) | +1 suite, +2 tests (the hand-off mark test); +4 s |
| 9a | transcriber (real-engine tests not run) | `npm run test -w @dems/transcriber` | GREEN | 18 files; 564 passed / 0 failed / 3 skipped (567) | 16 s (14.84 s) | same |
| 9b | mock-core | `npm run test -w @dems/mock-core` | GREEN | 4 files; 19 passed | 4 s (3.91 s) | same |
| 10 | pg-scripts | `npm run test:pg-scripts` | GREEN | 57 tests: 57 pass / 0 fail / 0 skipped | 0.2 s | same |
| 11 | seal e2e, built worker | `DEMS_SEAL_E2E=1 DEMS_SEAL_E2E_OUT=$PWD/.cache/row100/seal-e2e lockf heavy-host lockf db-migrate npx vitest run --root apps/core-server --project db --maxWorkers=1 src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts` | GREEN | 1 file; 3 passed (a, b, c); 0 databases remain | 46 s | same (47 s) |
| 12 | development-session e2e, generated sources, built worker | `DEMS_DEV_SESSION_E2E=1 lockf heavy-host lockf db-migrate npx vitest run ... src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts` | GREEN | 1 file; 2 passed, 2 skipped (speech case; attended case) | 17 s | same |
| 13a | contract guard, shared | `npx vitest run --root packages/shared test/api-registry.test.ts test/api-openapi-scope.test.ts` | GREEN | 2 files; 66 passed | 0.6 s | same |
| 13b | contract guard, db | `lockf db-migrate npx vitest run --root apps/core-server --project db --maxWorkers=1 test/acceptance/contract.test.ts` | GREEN | 1 file; 38 passed | 16 s | same |
| 13c | totals read directly | `node -e` over `packages/shared/openapi/openapi.json`; `api-registry.test.ts:299,330,331,492`; `apps/core-server/src/db/schema/meta.ts:38,40` | GREEN | 97 operations: 36 GET / 61 POST / 0 other, `info.version` 0.3.0; `toHaveLength(97)` (:299), 36 (:330), 61 (:331), `AUDIT_TYPES` `toHaveLength(67)` (:492), all in 13a; `DB_SCHEMA_VERSION = 6`, `DB_CONTRACT_REVISION = 'dbc-7'` | - | same |
| 14 | kill matrix, 35 active cells, one call | the last line of `kill-matrix/run.sh` (same two locks, same file, `--maxWorkers=1`, `DEMS_KILL_MATRIX=<35 ids of run.sh --list>`) with the JSON reporter added, so that the titles can be named; `run.sh`'s two pre-checks (built worker, `.data/helpers/ffmpeg`) done first | GREEN | 1 file; 35 passed / 0 failed; "forced drops that needed a retry: 0"; "dropped 2 database(s) in 50 ms; 0 remain" | 589 s | same (588 s) |
| 15 | M9-PIN-1 under the corrected rule | the literal grep of the erratum (`10_test_strategy.md:647`), scope of test/16 | GREEN | 3 lines, exactly the three exempt dated-history lines: `permission-guard/__tests__/decision.test.ts:111`, `packages/shared/src/api/core-api.ts:1058`, `packages/shared/test/api-registry.test.ts:171`; no other. Further forms: `'0.2.1'` 0, `DB_SCHEMA_VERSION = 1..5` 0; `toHaveLength(75)` 1 (`rbac-matrix.test.ts:1136`, the task-2 base table, accepted at M2); `toHaveLength(28)` 3 and `toHaveLength(63)` 2, the unrelated numbers test/16 lists | 1 s | test/16: 34 stale prose lines; now 0 |
| 16 | media out of git (M3-MG-1 / X-MEDIA-1) | `git status --porcelain --untracked-files=all` filtered by media extension, after 11, 12, 14 | GREEN | 0 lines | - | same |

Totals of the eight whole suites (rows 3 to 9b): 17,504 tests; 2614 + 31 + 6702 + 2423 + 2224 + 2917 + 564 + 19 = **17,494 passed, 0 failed, 10 skipped** (7 db, 3 transcriber). test/16: 17,498 / 17,488 / 10. The ledger floors (71/1,851; 160/3,954; 124/1,751; 117/1,495; 192/1,988; 4/19; 57) are exceeded in files and in tests.

Not part of Part A as briefed, and not run: the capture worker's own checks (`apps/capture-worker/check.sh`, `--selftest`, the C unit tests, the e2e series). They are the evidence of eight M3 / M5 checks (gap G7, finding T100-03).

One thing that is not a failure: the db suite's teardown printed "forced drops that needed a retry: 2 (2 refusal(s) with SQLSTATE 42501 while a backend that the owner role may not end, such as an autovacuum worker, was on the database; each drop then went through)". 0 databases remained. test/16 had 0 such retries.

### A.2 The env-gated describes still run when their env is set (titles changed by commit `7101661`)

| file | describe title that RAN (from the JSON report) | tests that ran |
|------|-----------------------------------------------|----------------|
| `seal-e2e.db.test.ts` | "row 82b end to end: recorded by the built worker, sealed by the composition, verified by operation 41 (skipped unless DEMS_SEAL_E2E=1: it needs the built worker and the heavy-host lock)" | (a) start, record, stop, seal, verify PASS (15 checks, development sources); (b) the worker is KILLED mid-recording and the Core goes down, then RECOVERY; (c) no camera file can be sealed, UNSEALABLE, quarantine: 3 passed |
| `development-session-e2e.db.test.ts` | "row 140 end to end with the BUILT worker and GENERATED sources (no device; skipped unless DEMS_DEV_SESSION_E2E=1: it needs the built worker and the heavy-host lock)" | "a development session starts, reaches durable, stops and is sealed; four FAKE source rows; no local source is ever on; ..." and "both generated microphone helpers run while the session records, and no microphone fault is raised": 2 passed |
| same file | "wave H: a development session on the SPEECH microphone with STT enabled on cpu-local (... skipped unless DEMS_DEV_SPEECH_SESSION_E2E=1 with the speech fixture and the cpu-local engine on this host)" | did NOT run: 1 skipped (its flag was not set: row 100 does not name it; it needs the speech fixture and the cpu-local engine and model files on the host, nothing on port 8000 by its title) |
| same file | "row 140 ATTENDED: this Mac's camera and microphone in slot 1 ... (the user runs this ...; skipped unless DEMS_LOCAL_SESSION_ATTENDED=1, which no agent sets: D163)" | did NOT run: 1 skipped, the user's |
| `kill-matrix.db.test.ts` | "M7 kill matrix (row 86): each named check once (skipped unless DEMS_KILL_MATRIX names cells)" | 35 titles, each beginning with its check id: `M7-REF-1 [no kill] ...`, `M7-KM-C-S1 [CORE@CLOSE_TRACKS:AFTER_WORK (SIGKILL of itself)] ...` to `M7-KM-P4-S6`: 35 passed (each id of `run.sh --list` matched to its title in Part B) |

The two renamed transcriber children (`apps/transcriber/test/real/speech-fixture-pipeline-child.ts`, `sealed-fixture-pipeline-child.ts`): NOT RUN. They are started only by `wave-h-speech-fixture.real.test.ts:28`, `row77-df1.real.test.ts:32` and `row77-cpu-local.real.test.ts:29`, which are real-engine tests (`vitest.real.config.ts`); row 100 does not name them, so by the binding rule they were not run. What they would need: the cpu-local engine, its model files and the sealed / speech fixtures on this host; the two files hold no reference to port 8000 or oMLX (`rg '8000|omlx'` on both: 0 lines). What IS proven: the three `join(import.meta.dirname, '<new name>')` strings name files that exist, and the transcriber typecheck covers `test/` (`tsconfig.json:6`) and is clean (row 1). T100-07.

### A.3 Test titles against the run of test/16 (leaf titles as a multiset, JSON against JSON)

| workspace | before / after | titles lost | titles gained | reading |
|-----------|----------------|-------------|---------------|---------|
| shared | 2612 / 2614 | 0 | 2 | the two "README = the generator's text ... + the note" tests (R96-1, `f48fe86`) |
| capture-protocol | 31 / 31 | 0 | 0 | - |
| core-server unit | 6700 / 6702 | 4 | 6 | 3 reworded (28 -> 30 slices x 2, "one builder" for "two builders"; `c0be906`, `a02e305`), 1 reworded + 1 new for the error log (`c946cb5`), 1 new rule A-7 control (`d6b55f4`) |
| core-server db | 2430 / 2430 | 2 | 2 | 2 reworded: "30 slices", and the "PENDING (engine)" title replaced by "the engine alone ... (F-5, closed by F73)" (`abc93a5`) |
| core-web | 2224 / 2224 | 0 | 0 | every title preserved |
| mobile | 2915 / 2917 | 0 | 2 | the two tests of the one hand-off mark (`1379cf3`) |

No test was lost: every difference is a rewording or an addition that a row-97 commit names.

### A.4 Timing and the ten slowest files (file time inside its worker)

| suite | files | tests | wall of the run | workers | sum of file times | median file |
|-------|-------|-------|-----------------|---------|-------------------|-------------|
| shared | 101 | 2614 | 5.0 s | default | 18.1 s | 80 ms |
| capture-protocol | 1 | 31 | 0.1 s | default | 0.01 s | - |
| core-server unit | 324 | 6702 | 61.6 s | 4 | 133.0 s | 46 ms |
| core-server db | 181 (178 ran) | 2430 | 206.6 s | 2 | 274.0 s | 418 ms |
| core-web | 164 | 2224 | 79.6 s | default | 462.3 s | 1.67 s |
| mobile | 273 | 2917 | 182.2 s | 2 | 353.4 s | 762 ms |
| transcriber | 18 | 567 | 14.8 s | default | 26.6 s | 536 ms |
| mock-core | 4 | 19 | 3.9 s | default | 5.7 s | 2.05 s |

shared: `live-source-local-end.test.ts` (86 tests) 4.3 s; `live-source-session` 1.0; `api-state-slices` 0.9; `api-capture-discovery` 0.9; `api-realtime` 0.8; `openapi` 0.5; `api-openapi-scope` 0.5; `demo-evidence` 0.5; `live-source-replica` 0.5; `live-source-resilience` 0.4. As test/16.

core-server unit: `capture/adapters/local/__tests__/mic-helper.generated.test.ts` 11.3 s; `.../local/__tests__/no-delivery.test.ts` 9.5; `capture/__tests__/ipc.test.ts` 9.0; `capture/adapters/camera/__tests__/ws-discovery.test.ts` 8.4; `sealing/__tests__/finalize-transcript.test.ts` 5.5; `sealing/__tests__/pipeline.test.ts` 5.4 (test/16: 8.3); `test/support/fake-onvif-stub.test.ts` 5.3; `db/mapping/__tests__/round-trip.test.ts` 5.3; `sealing/__tests__/stt-states-verify.test.ts` 4.4 (test/16: 8.0); `evidence-verify/__tests__/verify-v2.test.ts` 3.2 (new in the list; `transcription/__tests__/session-run.test.ts` left it).

core-server db: `modules/capture-discovery/__tests__/capture-discovery.db.test.ts` 37.6 s; `db/reset/__tests__/reset-failures.db.test.ts` 25.4; `db/reset/__tests__/cli.db.test.ts` 22.8; `capture-session/__tests__/session-capture.db.test.ts` 16.2 (test/16: 21.2); `test/acceptance/contract.test.ts` 12.4; `engine/__tests__/restart.db.test.ts` 8.1; `db/fixtures/__tests__/bulk-fixture.db.test.ts` 8.0; `capture-discovery.booted.db.test.ts` 7.4; `lane-camera-stub.db.test.ts` 7.3; `test/acceptance/shared-state.test.ts` 5.2 (new in the list).

core-web: `features/evidence/__tests__/sealed-player.test.tsx` 38.8 s; `test/live-session-new-local-notice.test.tsx` 15.2; `live-evidence-verify` 12.3; `live-evidence-export` 12.0; `live-security-audit-chain` 11.1; `real-core-facts` 10.8; `live-shell-notices` 10.5; `live-security-audit-export` 10.1; `features/dashboard/__tests__/dashboard.test.tsx` 8.2; `live-session-new-create` 7.7. The same ten files as test/16, each within 2.5 s.

mobile: `features/evidence/evidence-detail.test.tsx` 19.6 s; `features/storage/live-storage-sites.test.tsx` 11.6 (test/16: 9.1); `features/pairing/pairing-live.test.tsx` 7.0; `features/evidence/live-evidence-export.test.tsx` 6.0; `features/session-new/live-session-new-sites.test.tsx` 5.7; `features/evidence/sealed-player.test.tsx` 5.6; `features/capture-selector/selector-lines.test.tsx` 5.0; `runtime/connection-banner-live.test.tsx` 4.9; `features/capture-selector/local-source-start-notice.test.tsx` 4.9; `features/capture-selector/camera-search.test.tsx` 4.7 (new in the list; `devices-states` left it).

transcriber: `checkpoint-runner` 7.6 s; `kill-resume` 6.3; `assembly` 5.1; `backends` 1.9; `diarization` 1.6; `cpu-priority` 1.1; `media-time-wrong-constant` 0.7; `silero-vad` 0.7; `adapter-contract` 0.5; `media-time` 0.5. mock-core: `standalone-launcher` 3.6 s, `heartbeat` 2.1, `health` 0.0, `ws-origin` 0.0.

Runner forms: the commands are those of test/16 (unit with 4 workers; shared, core-web, transcriber, mock-core with the runner's default), not the `--maxWorkers=2` for ALL of strategy B.4 / X-MAX-1 (T100-05).

## B. The strategy's coverage table

Every named check id of sections A.3 to A.9 of `masterplan/10_test_strategy.md`, 235 ids. How the count is formed: a table row that names several ids (`-W / -T / -P`) is split; the kill-matrix rows are expanded to their 35 + 10 cells; `Mx-RG-*` is one id per milestone (it stands for the workspace runs); the tables of A.4a.9 to A.4a.12 (traceability, changed texts) name no new id. The strategy's own total (D89: 330 active + 10 conditional) covers M0..M9 and counts each workspace run of the RG families.

Method. Nothing was re-driven. "Suite evidence" = a test file that exists at HEAD, cites the id, and PASSED in Part A; the cell gives file:line of the id, whether that line is a test or describe TITLE or a COMMENT, the run and the file's result. It was produced by a script (grep of the id in `apps`, `packages`, `scripts`; join with the JSON reports of Part A), not by reading 235 assertions: that a file cites an id and passes does not prove that it asserts every clause of the check (T100-01). "Gate lines" = report:line of the rows that name the id in their first cell, last three reports. The state is my reading of the last gate that speaks of the check.

Counts per state:

| state | count |
|-------|-------|
| PROVEN BY SUITE (a suite of Part A at HEAD) | 140 |
| PROVEN LIVE AT A GATE | 53 |
| PROVEN BY TEST ONLY (was to be live) | 5 |
| NOT PROVEN | 3 |
| USER-ATTENDED not run | 5 |
| HARDWARE not run | 1 |
| SKIPPED BY THE USER (biometrics, D151) | 0 (no check id of the catalogue is biometric: strategy section G) |
| extra: PROVEN BY HARNESS OR ROW RECORD, not re-run at HEAD | 11 |
| extra: USER-ATTENDED, run by the user | 1 |
| extra: CONDITIONAL, not triggered (parked kill-matrix cells) | 10 |
| extra: CHAIN REPORT or document check, not a test | 6 |
| total | 235 |

The four "extra" states are mine: the seven of the brief do not hold these 28 rows without bending a word. Of the 157 ids that a test file of Part A cites, 108 are cited in a test or describe title and 49 only in comments. No check's evidence file is missing at HEAD and none of the cited files failed: no finding of the kind "evidence file no longer exists". Five suite-class ids are cited by no test at all (T100-01).

| check id | class | suite evidence at HEAD (file:line of the id, run, result) | gate lines (report:line) | state |
|---|---|---|---|---|
| M3-RG-* | suite | - | 08:54 | PROVEN BY SUITE - Part A rows 3-9 of this report |
| M3-QA-1 | suite | - | 08:55 | PROVEN BY SUITE - Part A rows 1-2 |
| M3-WI-1 | suite (worker harness) | - | 08:56 | PROVEN BY HARNESS OR ROW RECORD, not re-run at HEAD (extra state) - worker e2e series at gate 64; worker sources unchanged since (only README.md in 74fd1f1) |
| M3-AV-1 | suite (worker harness) | - | 08:57 | PROVEN BY HARNESS OR ROW RECORD, not re-run at HEAD (extra state) - same series; negative control in the series |
| M3-AV-2 | suite (worker harness) | - | 08:58 | PROVEN BY HARNESS OR ROW RECORD, not re-run at HEAD (extra state) - series + gate64 run sup_av2_pm80_r1 |
| M3-KC-1 | suite (worker harness) | `core-server/src/capture/__tests__/supervisor.test.ts:327` title (unit: 61 passed) | 08:59 | PROVEN BY HARNESS OR ROW RECORD, not re-run at HEAD (extra state) - file half = harness kc1_r1 at gate 64; process half also in the unit suite |
| M3-KC-2 | suite (worker harness) | `core-server/src/capture/__tests__/fragments.test.ts:152` title (unit: 51 passed) | 08:60 | PROVEN BY HARNESS OR ROW RECORD, not re-run at HEAD (extra state) - harness kc2_sigkill_tail_validation; the tail-validation rule also in the unit suite |
| M3-KC-4 | suite (worker harness) | - | 08:62 | PROVEN BY HARNESS OR ROW RECORD, not re-run at HEAD (extra state) - harness kc4_longgop_loss_reported |
| M3-KC-3 | suite | `core-server/src/capture/__tests__/supervisor.test.ts:135` title (unit: 61 passed); `core-server/src/capture/__tests__/liveness.test.ts:171` title (unit: 15 passed) | 08:61 | PROVEN BY SUITE |
| M3-SR-1 | suite | `core-server/src/capture/__tests__/static.test.ts:1` comment (unit: 49 passed); `core-server/test/static/guard-family.test.ts:1` comment (unit: 4 passed) | 08:63 | PROVEN BY SUITE |
| M3-SR-2 | suite (worker check.sh) | `core-server/test/static/guard-family.test.ts:1` comment (unit: 4 passed) | 08:64 | PROVEN BY HARNESS OR ROW RECORD, not re-run at HEAD (extra state) - the guard is apps/capture-worker/check.sh + --selftest (C program, D24), run in the gate-64 series; not part of Part A; guard-family.test.ts counts the family |
| M3-RTSP-BIND-1 | suite (worker harness) | - | 08:68 | PROVEN BY HARNESS OR ROW RECORD, not re-run at HEAD (extra state) - harness bind_udp, 41 socket snapshots |
| M3-SR-3 | suite | `core-server/src/capture/__tests__/muxer-safety.test.ts:29` title (unit: 5 passed) | 08:65 | PROVEN BY SUITE |
| M3-MG-1 | suite (shell grep) | - | 08:66 | PROVEN BY SUITE - this run: media-extension lines in git status after the seal e2e, development e2e and kill matrix = 0 (Part A row 16) |
| M3-BC-1 | suite | `core-server/src/capture/boot/__tests__/checks.test.ts:101` title (unit: 59 passed); `core-server/src/capture/boot/__tests__/boot.test.ts:1` comment (unit: 18 passed) | 08:67 | PROVEN BY SUITE |
| M3-REC-1 | suite | `core-server/src/capture/__tests__/records.test.ts:52` title (unit: 62 passed); `packages/capture-protocol/test/protocol.test.ts:424` title (cp: 31 passed) | 08:69 | PROVEN BY SUITE |
| M4-RG-* | suite | `mobile/src/features/capture-selector/capture-selector-model.test.ts:3` comment (mobile: 18 passed); `mobile/src/features/capture-selector/capture-selector.test.tsx:3` comment (mobile: 10 passed) | 09:63, 09b:139 | PROVEN BY SUITE - Part A rows 3-9 |
| M4-QA-1 | suite | - | 09:63, 09b:139 | PROVEN BY SUITE - Part A rows 1-2 |
| M4-SEL-W | gate-driven | `core-server/src/modules/capture-config/__tests__/capture-config.db.test.ts:2` comment (db: 17 passed); `core-server/src/modules/capture-config/__tests__/routes.test.ts:2` comment (unit: 16 passed) | 09:57, 09b:108 | PROVEN LIVE AT A GATE |
| M4-SEL-T | gate-driven | `mobile/src/features/capture-selector/selector-lines.test.tsx:12` comment (mobile: 32 passed); `mobile/src/features/capture-selector/capture-selector.test.tsx:3` comment (mobile: 10 passed) | 09:58, 09b:111 | PROVEN LIVE AT A GATE |
| M4-SEL-P | gate-driven | `mobile/src/features/capture-selector/capture-selector.test.tsx:3` comment (mobile: 10 passed) | 09:59 | PROVEN LIVE AT A GATE |
| M4-LOCK-1 | suite | `packages/shared/test/sim-capture-config.test.ts:209` title (shared: 36 passed); `core-server/src/modules/capture-config/__tests__/capture-config.db.test.ts:224` title (db: 17 passed) | 09:76, 09b:109 | PROVEN BY SUITE |
| M4-FAKE-1 | suite | `core-server/src/capture/adapters/__tests__/fakes.test.ts:136` title (unit: 8 passed); `core-server/src/capture/adapters/__tests__/real.test.ts:2` comment (unit: 1 passed) | 09:61, 09b:111 | PROVEN BY SUITE |
| M4-PC-1 | suite | `mobile/src/features/capture-selector/selector-lines.test.tsx:224` title (mobile: 32 passed); `core-web/src/features/session-monitor/__tests__/audio-source.test.tsx:4` comment (web: 21 passed) | 09:62, 09b:112 | PROVEN BY SUITE - the "Checking your permissions..." frame was never observed live (09 PARTIAL, 09b:112 unchanged): tests only for that frame |
| M4-MT-9 | suite | `core-server/test/db/set4.db.test.ts:81` title (db: 36 passed) | - | PROVEN BY SUITE |
| M4-MT-10 | suite | `core-server/test/db/set4.db.test.ts:217` title (db: 36 passed) | - | PROVEN BY SUITE |
| M4-MT-11 | suite | `core-server/test/db/set4.db.test.ts:300` title (db: 36 passed); `core-server/test/db/privileges.db.test.ts:125` comment (db: 14 passed) | - | PROVEN BY SUITE |
| M4-MT-12 | suite | `core-server/test/db/set4-rules.test.ts:64` title (unit: 12 passed); `core-server/test/db/device-upsert.db.test.ts:62` title (db: 9 passed) | - | PROVEN BY SUITE |
| M4-MT-14 | suite | `core-server/src/db/reset/__tests__/m4-sec-reset.db.test.ts:330` title (db: 16 passed) | - | PROVEN BY SUITE |
| M4-MT-15 | suite | `core-server/src/capture/__tests__/static.test.ts:905` comment (unit: 49 passed); `core-server/src/db/seed/__tests__/seed.db.test.ts:90` title (db: 33 passed) | - | PROVEN BY SUITE |
| M4-MT-16 | suite | `core-server/test/db/set4.db.test.ts:358` title (db: 36 passed) | - | PROVEN BY SUITE |
| M4-PIN-2 | suite | - | - | PROVEN BY SUITE - no test cites the ID; the pins it names are asserted in apps/core-server/test/db/contract-inventory.test.ts and src/db/schema/meta.ts:38,40 (now 6 / dbc-7), inside the db and unit runs |
| M4-DB-APPLY-1 | gate-driven (db action on the four development databases) | - | - | PROVEN BY HARNESS OR ROW RECORD, not re-run at HEAD (extra state) - implementation/61_r9_lane_migration.md:172 (run 1 applied, run 2 no-op); its part "old code is refused" was not run; later sets by their own notes |
| M4-SEC-RESET-1 | suite | `core-server/src/db/reset/__tests__/m4-sec-reset.db.test.ts:132` title (db: 16 passed); `core-server/test/db/set4-rules.test.ts:150` title (unit: 12 passed) | - | PROVEN BY SUITE |
| M4-DISC-TRIG-1 | suite | `core-server/src/modules/capture-discovery/__tests__/search.test.ts:120` title (unit: 19 passed); `core-server/src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts:219` title (db: 16 passed) | - | PROVEN BY SUITE |
| M4-DISC-STUB-1 | suite | `core-server/src/capture/adapters/camera/__tests__/ws-discovery.test.ts:64` title (unit: 28 passed); `core-server/src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts:480` title (db: 16 passed) | - | PROVEN BY SUITE |
| M4-DISC-LIFE-1 | suite | `packages/shared/test/sim-capture-discovery.test.ts:124` title (shared: 19 passed); `core-server/src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts:257` title (db: 16 passed) | - | PROVEN BY SUITE |
| M4-DISC-NOLAN-1 | suite | `core-server/src/capture/adapters/camera/__tests__/ws-discovery.test.ts:337` title (unit: 28 passed); `core-server/src/capture/adapters/camera/__tests__/loopback-guard.test.ts:2` comment (unit: 6 passed) | - | PROVEN BY SUITE |
| M4-DISC-SOCK-1 | suite | `core-server/src/capture/adapters/camera/__tests__/ws-discovery.test.ts:273` title (unit: 28 passed) | - | PROVEN BY SUITE |
| M4-DISC-LAN-1 | hardware (real LAN) | - | 09:157, 09b:188 | HARDWARE not run - NOT RUN (reason): forbidden by the gate brief; the catalogue accepts this outcome |
| M4-DISC-RBAC-1 | suite | `core-server/src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts:237` title (db: 16 passed) | - | PROVEN BY SUITE |
| M4-DISC-REC-1 | suite | `core-server/src/modules/capture-discovery/__tests__/search.test.ts:168` title (unit: 19 passed); `packages/shared/test/api-capture-discovery.test.ts:357` comment (shared: 18 passed) | 09:93 | PROVEN BY SUITE |
| M4-SEC-NET-1 | suite | `core-server/src/capture/__tests__/static.test.ts:359` comment (unit: 49 passed); `core-server/test/static/network.test.ts:149` comment (unit: 14 passed) | - | PROVEN BY SUITE |
| M4-SEC-DISC-1 | suite | `core-server/src/capture/adapters/camera/__tests__/ws-discovery.test.ts:164` title (unit: 28 passed); `core-server/src/capture/adapters/camera/__tests__/probe-answer.test.ts:96` title (unit: 20 passed) | 09:93 | PROVEN BY SUITE |
| M4-SEC-DISC-2 | suite | `core-server/src/capture/adapters/camera/__tests__/discovery-collector.test.ts:168` title (unit: 19 passed); `core-server/src/modules/capture-discovery/__tests__/search.test.ts:3` comment (unit: 19 passed) | - | PROVEN BY SUITE |
| M4-SEC-DISC-3 | suite | `core-server/src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts:684` title (db: 16 passed); `core-server/src/modules/capture-discovery/__tests__/static.test.ts:13` comment (unit: 8 passed) | - | PROVEN BY SUITE |
| M4-SEC-DISC-4 | suite | `core-server/src/capture/__tests__/static.test.ts:326` title (unit: 49 passed); `core-server/src/capture/adapters/camera/__tests__/ws-discovery.test.ts:382` title (unit: 28 passed) | - | PROVEN BY SUITE |
| M4-SEC-RATE-1 | suite | `core-server/src/modules/capture-discovery/connect/__tests__/service.test.ts:2` comment (unit: 20 passed); `core-server/src/modules/capture-discovery/__tests__/search.test.ts:210` title (unit: 19 passed) | - | PROVEN BY SUITE |
| M4-SEC-TXT-1 | suite | `core-server/src/capture/adapters/camera/__tests__/probe-answer.test.ts:235` title (unit: 20 passed); `core-server/src/capture/adapters/camera/__tests__/discovery-collector.test.ts:2` comment (unit: 19 passed) | - | PROVEN BY SUITE |
| M4-SEC-DEP-1 | suite | `core-server/src/capture/adapters/camera/__tests__/probe-answer.test.ts:41` title (unit: 20 passed) | - | PROVEN BY SUITE |
| M4-SR-1 | suite | `core-server/src/capture/__tests__/static.test.ts:239` comment (unit: 49 passed); `core-server/test/static/guard-family.test.ts:1` comment (unit: 4 passed) | - | PROVEN BY SUITE |
| M4-PIN-1 | suite | `packages/shared/test/api-capture-discovery.test.ts:106` title (shared: 18 passed) | - | PROVEN BY SUITE |
| M4-AUD-1 | suite | `core-server/src/core/__tests__/writers.test.ts:359` title (unit: 94 passed); `core-server/src/capture-notices/__tests__/notices.test.ts:7` comment (unit: 23 passed) | - | PROVEN BY SUITE |
| M4-CONN-NOCRED-1 | suite | `core-server/src/modules/capture-discovery/connect/__tests__/service.test.ts:174` title (unit: 20 passed); `core-web/src/features/devices/__tests__/camera-connect.test.tsx:11` comment (web: 18 passed) | 09:93, 09b:84 | PROVEN BY SUITE |
| M4-CONN-OUT-1 | suite | `core-server/src/capture/adapters/camera/__tests__/onvif-session.test.ts:121` title (unit: 27 passed); `core-server/src/modules/capture-discovery/connect/__tests__/connect.db.test.ts:248` title (db: 16 passed) | - | PROVEN BY SUITE |
| M4-CONN-SSRF-1 | suite | `core-server/src/modules/capture-discovery/connect/__tests__/service.test.ts:239` title (unit: 20 passed) | - | PROVEN BY SUITE |
| M4-CONN-ORDER-1 | suite | `core-server/src/modules/capture-discovery/connect/__tests__/service.test.ts:435` title (unit: 20 passed); `core-server/src/modules/capture-discovery/connect/__tests__/connect.db.test.ts:431` title (db: 16 passed) | - | PROVEN BY SUITE |
| M4-CONN-WEBONLY-1 | suite | `core-server/src/modules/capture-discovery/connect/__tests__/connect.db.test.ts:221` title (db: 16 passed) | - | PROVEN BY SUITE |
| M4-CONN-ATOM-1 | suite | `core-server/src/modules/capture-discovery/connect/__tests__/connect.db.test.ts:346` title (db: 16 passed) | - | PROVEN BY SUITE |
| M4-SEC-CONN-1 | suite | `core-server/src/capture/adapters/camera/__tests__/onvif-session.test.ts:304` title (unit: 27 passed) | - | PROVEN BY SUITE |
| M4-SEC-CONN-2 | suite | `core-server/src/capture/adapters/camera/__tests__/onvif-session.test.ts:217` title (unit: 27 passed) | - | PROVEN BY SUITE |
| M4-SEC-CONN-3 | suite | `core-server/src/capture/adapters/camera/__tests__/onvif-session.test.ts:350` title (unit: 27 passed); `core-server/src/modules/capture-discovery/connect/__tests__/service.test.ts:3` comment (unit: 20 passed) | - | PROVEN BY SUITE |
| M4-SEC-CONN-4 | suite | `core-server/src/modules/capture-discovery/connect/__tests__/limits.test.ts:100` title (unit: 16 passed); `core-server/src/modules/capture-discovery/connect/__tests__/connect.db.test.ts:298` title (db: 16 passed) | - | PROVEN BY SUITE |
| M4-SEC-CRED-1 | suite | `core-server/src/modules/capture-discovery/connect/__tests__/connect.db.test.ts:546` title (db: 16 passed) | - | PROVEN BY SUITE |
| M4-SEC-CRED-2 | suite | `core-server/src/modules/capture-discovery/connect/__tests__/connect.db.test.ts:317` title (db: 16 passed) | - | PROVEN BY SUITE |
| M4-SEC-AUD-1 | suite | `core-server/src/modules/capture-discovery/connect/__tests__/service.test.ts:272` title (unit: 20 passed); `core-server/src/modules/capture-discovery/connect/__tests__/limits.test.ts:2` comment (unit: 16 passed) | - | PROVEN BY SUITE |
| M4-SEC-ADOPT-1 | suite | `core-server/src/modules/capture-discovery/connect/__tests__/connect.db.test.ts:458` title (db: 16 passed) | - | PROVEN BY SUITE |
| M4-NODEV-A-1 | suite | `core-server/src/capture-notices/__tests__/notices.test.ts:149` title (unit: 23 passed); `packages/shared/test/sim-capture-notices.test.ts:64` title (shared: 19 passed) | - | PROVEN BY SUITE |
| M4-NODEV-B-1 | suite | `core-server/src/capture-notices/__tests__/notices.test.ts:276` title (unit: 23 passed); `packages/shared/test/sim-capture-notices.test.ts:120` title (shared: 19 passed) | - | PROVEN BY SUITE |
| M4-PRECHK-RULE-1 | suite | `core-server/src/capture-notices/__tests__/notices.test.ts:276` title (unit: 23 passed); `packages/shared/test/sim-capture-notices.test.ts:225` title (shared: 19 passed) | - | PROVEN BY SUITE |
| M4-MIC-RESCAN-1 | suite | `core-server/src/modules/capture-inputs/__tests__/routes.test.ts:52` title (unit: 11 passed); `core-server/src/modules/capture-inputs/__tests__/no-device.db.test.ts:277` title (db: 4 passed) | - | PROVEN BY SUITE |
| M4-SEC-FENCE-1 | suite | `core-server/src/capture/fence/__tests__/fence.test.ts:110` title (unit: 52 passed); `core-server/src/capture/fence/__tests__/fence.db.test.ts:2` comment (db: 16 passed) | - | PROVEN BY SUITE |
| M4-LOCAL-SEL-1 | suite | `core-server/src/capture/fence/__tests__/fence.test.ts:374` title (unit: 52 passed); `core-server/src/modules/capture-config/__tests__/capture-config.db.test.ts:317` comment (db: 17 passed) | - | PROVEN BY SUITE |
| M4-LOCAL-PLAN-1 | suite | `core-server/src/capture/fence/__tests__/fence.test.ts:482` title (unit: 52 passed); `core-server/src/modules/capture-config/__tests__/plan.test.ts:2` comment (unit: 10 passed) | - | PROVEN BY SUITE |
| M4-LOCAL-WORKER-1 | suite | `core-server/src/capture/adapters/local/__tests__/camera-helper.test.ts:2` comment (unit: 33 passed); `core-server/src/capture/adapters/local/__tests__/mic-helper.generated.test.ts:2` comment (unit: 8 passed) | - | PROVEN BY SUITE |
| M4-LOCAL-ERR-1 | suite | `core-server/src/capture/fence/__tests__/fence.test.ts:471` title (unit: 52 passed) | - | PROVEN BY SUITE |
| M4-SEC-HELPER-1 | suite | `core-server/src/capture/fence/__tests__/fence.test.ts:278` title (unit: 52 passed); `core-server/src/capture/adapters/local/__tests__/mic-helper.test.ts:2` comment (unit: 50 passed) | - | PROVEN BY SUITE |
| M4-SEC-PRIV-1 | suite | `core-server/src/capture/adapters/local/__tests__/mic-static.test.ts:2` comment (unit: 9 passed); `core-server/src/capture/adapters/local/__tests__/mic-helper.generated.test.ts:2` comment (unit: 8 passed) | - | PROVEN BY SUITE |
| M4-LOCAL-AV-1 | suite (worker harness, generated picture) | `core-server/src/capture/adapters/local/__tests__/camera-helper.test.ts:165` comment (unit: 33 passed) | - | PROVEN BY HARNESS OR ROW RECORD, not re-run at HEAD (extra state) - D102, implementation/65_r11_local_camera_helper.md; not part of Part A |
| M4-LOCAL-CAM-1 | user-attended | `core-server/src/capture/adapters/local/__tests__/camera-helper.test.ts:6` comment (unit: 33 passed); `core-server/src/capture/adapters/local/__tests__/camera-run-numbers.test.ts:2` comment (unit: 11 passed) | - | USER-ATTENDED, run by the user (extra state) - D130: the user ran it from Terminal, PASS 10 of 10; no agent run (D163) |
| M4-LOCAL-MIC-1 | user-attended | `core-server/src/capture/adapters/local/__tests__/mic-helper.test.ts:2` comment (unit: 50 passed); `core-server/src/capture/adapters/local/__tests__/mic-helper.generated.test.ts:129` title (unit: 8 passed) | - | NOT PROVEN - the user ran it (D128): FAIL on rate (42,666 against 48,000 samples/s); D136 8 of 9; the product states the limit; no later PASS on record |
| M4-DISC-W | gate-driven | `core-web/src/features/devices/__tests__/camera-search.test.tsx:7` comment (web: 10 passed) | 09:69, 09b:60 | PROVEN LIVE AT A GATE |
| M4-DISC-T | gate-driven | `mobile/src/features/capture-selector/camera-search.test.tsx:3` comment (mobile: 22 passed); `core-server/src/modules/capture-discovery/__tests__/search.test.ts:120` title (unit: 19 passed) | 09b:65 | PROVEN LIVE AT A GATE |
| M4-DISC-P | gate-driven | `mobile/src/features/capture-selector/camera-search.test.tsx:478` title (mobile: 22 passed) | 09b:66, 09c:67 | PROVEN LIVE AT A GATE |
| M4-DISC-EMPTY-W | gate-driven | `core-web/src/features/devices/__tests__/capture-notices.test.tsx:8` comment (web: 11 passed) | 09:70, 09b:96 | PROVEN LIVE AT A GATE |
| M4-DISC-EMPTY-T | gate-driven | `mobile/src/features/capture-selector/camera-search.test.tsx:3` comment (mobile: 22 passed); `mobile/src/features/capture-selector/camera-search-model.test.ts:2` comment (mobile: 15 passed) | 09b:64 | PROVEN LIVE AT A GATE |
| M4-DISC-EMPTY-P | gate-driven | `mobile/src/features/capture-selector/camera-search.test.tsx:494` title (mobile: 22 passed) | 09b:66, 09c:69 | PROVEN LIVE AT A GATE |
| M4-DISC-RBAC-W | gate-driven | `core-web/src/features/devices/__tests__/camera-search.test.tsx:213` title (web: 10 passed) | 09:71, 09b:68 | PROVEN LIVE AT A GATE |
| M4-DISC-RBAC-T | gate-driven | `mobile/src/features/capture-selector/camera-search.test.tsx:4` comment (mobile: 22 passed); `mobile/src/features/capture-selector/camera-search-model.test.ts:2` comment (mobile: 15 passed) | 09:147, 09b:67 | PROVEN LIVE AT A GATE |
| M4-DISC-RBAC-P | gate-driven | - | 09:72 | PROVEN LIVE AT A GATE |
| M4-DISC-OWNER-W | gate-driven | - | 09:74, 09b:62 | PROVEN LIVE AT A GATE |
| M4-CONN-W | gate-driven | `core-web/src/features/devices/__tests__/camera-connect.test.tsx:8` comment (web: 18 passed); `core-server/src/modules/capture-discovery/connect/__tests__/connect.db.test.ts:221` title (db: 16 passed) | 09:75, 09b:75 | PROVEN LIVE AT A GATE |
| M4-CONN-ABANDON-W | gate-driven | `core-web/src/features/devices/__tests__/camera-connect.test.tsx:9` comment (web: 18 passed) | 09b:85 | PROVEN LIVE AT A GATE - PASS for Close (09b:85) |
| M4-CONN-LOCK-W | gate-driven | `core-web/src/features/devices/__tests__/camera-search.test.tsx:229` title (web: 10 passed) | 09:76, 09b:88 | PROVEN LIVE AT A GATE |
| M4-CONN-GUARD-W | gate-driven | `core-web/src/features/devices/__tests__/camera-connect.test.tsx:10` comment (web: 18 passed) | 09b:83 | PROVEN LIVE AT A GATE - one refusal live; the lock-out half by tests (09b:83) |
| M4-CONN-PTR-T | gate-driven | `mobile/src/features/capture-selector/camera-search.test.tsx:4` comment (mobile: 22 passed); `mobile/src/features/capture-selector/no-credential-inputs.static.test.ts:2` comment (mobile: 6 passed) | 09:77, 09b:89 | PROVEN LIVE AT A GATE |
| M4-CONN-PTR-P | gate-driven | `mobile/src/features/capture-selector/camera-search.test.tsx:511` title (mobile: 22 passed) | 09b:90, 09c:68 | PROVEN LIVE AT A GATE |
| M4-NODEV-B-W | gate-driven | `core-web/src/features/devices/__tests__/capture-notices.test.tsx:8` comment (web: 11 passed); `core-web/src/features/session-new/__tests__/precheck-unreachable.test.tsx:7` comment (web: 5 passed) | 09b:97, 09c:112, 09d:115 | PROVEN LIVE AT A GATE - NOT PROVEN at 09d; CONFIRMED in the wave M session (source rig) |
| M4-NODEV-B-T | gate-driven | `mobile/src/features/capture-selector/capture-notices-model.test.ts:3` comment (mobile: 14 passed); `mobile/src/features/capture-selector/precheck-capture-notices.test.tsx:4` comment (mobile: 8 passed) | 09d:89 | PROVEN BY TEST ONLY (was to be live) - the tablet was driven with the microphone case only (wave M); camera case on the tablet: tests |
| M4-NODEV-B-P | gate-driven | - | 09d:90 | PROVEN BY TEST ONLY (was to be live) - phone not re-driven (14 section 3); no test cites the -P id: the phone uses the tablet components |
| M4-NODEV-NOCFG-T | gate-driven | `mobile/src/features/capture-selector/capture-notices.test.tsx:142` title (mobile: 8 passed); `mobile/src/features/capture-selector/precheck-capture-notices.test.tsx:157` title (mobile: 8 passed) | 09b:190, 09c:112, 09d:115 | PROVEN BY TEST ONLY (was to be live) - 09d:115 NOT PROVEN; not in the wave M list |
| M4-MIC-RESCAN-W | gate-driven | `core-web/src/features/devices/__tests__/capture-notices.test.tsx:11` comment (web: 11 passed) | 09:79, 09b:110 | PROVEN LIVE AT A GATE |
| M4-MIC-RESCAN-T | gate-driven | `mobile/src/features/capture-selector/capture-notices.test.tsx:4` comment (mobile: 8 passed) | 09:80 | PROVEN LIVE AT A GATE |
| M4-MIC-RESCAN-P | gate-driven | - | 09:81 | PROVEN LIVE AT A GATE |
| M4-MIC-ACTIVE-W | gate-driven | `core-web/src/features/devices/__tests__/capture-notices.test.tsx:10` comment (web: 11 passed); `core-web/src/features/session-new/__tests__/precheck-unreachable.test.tsx:8` comment (web: 5 passed) | 09b:98, 09c:113, 09d:116 | PROVEN BY TEST ONLY (was to be live) - 09d:116 no means (D227 (3)); wave M drove the tablet only |
| M4-MIC-ACTIVE-T | gate-driven | `mobile/src/features/capture-selector/capture-notices-model.test.ts:3` comment (mobile: 14 passed); `mobile/src/features/capture-selector/precheck-capture-notices.test.tsx:4` comment (mobile: 8 passed) | - | PROVEN LIVE AT A GATE - wave M confirmation, item 3 "notification B, microphone" on the tablet |
| M4-MIC-ACTIVE-P | gate-driven | - | - | PROVEN BY TEST ONLY (was to be live) - phone not driven; no test cites the -P id |
| M4-DEVSRC-LABEL-W | gate-driven | - | 09:82 | PROVEN LIVE AT A GATE |
| M4-DEVSRC-LABEL-T | gate-driven | `mobile/src/features/capture-selector/capture-notices-model.test.ts:3` comment (mobile: 14 passed); `mobile/src/features/capture-selector/development-source.test.tsx:2` comment (mobile: 3 passed) | 09:83 | PROVEN LIVE AT A GATE |
| M4-DEVSRC-LABEL-P | gate-driven | - | 09:84 | PROVEN LIVE AT A GATE |
| M4-SEC-UI-1 | gate-driven | `core-web/src/features/devices/__tests__/camera-connect.test.tsx:7` comment (web: 18 passed) | 09:143, 09b:76 | PROVEN LIVE AT A GATE - PASS for what was driven; two parts NOT RUN (09b:76) |
| M4-DEVSRC-LOCAL | suite | `mobile/src/features/capture-selector/capture-notices-model.test.ts:119` title (mobile: 14 passed); `core-web/src/features/devices/__tests__/capture-notices.test.tsx:102` title (web: 11 passed) | 09:85 | PROVEN BY SUITE |
| M4-UX-UNIT | suite | `mobile/src/features/capture-selector/camera-search.test.tsx:232` title (mobile: 22 passed); `mobile/src/features/capture-selector/camera-search-model.test.ts:1` comment (mobile: 15 passed) | 09:85 | PROVEN BY SUITE |
| M4-UX-VOC-1 | suite | - | 09:85 | PROVEN BY SUITE - no test cites the ID; packages/shared/test/i18n.test.ts and i18n-vocabulary-sync.test.ts (parity), in the shared run |
| M4-UX-A11Y-1 | suite | - | 09:85 | PROVEN BY SUITE - no test cites the ID; the accessibility assertions are in the component tests of the two folders (see finding T100-03) |
| M5-NODEV-C-1 | suite | `core-server/src/capture-notices/__tests__/session-start.test.ts:6` comment (unit: 15 passed); `core-server/src/capture-notices/__tests__/session-start.db.test.ts:179` title (db: 4 passed) | 10:140, 10b:149, 10c:224 | PROVEN BY SUITE |
| M5-NODEV-C-W | gate-driven | `core-web/src/features/session-monitor/__tests__/situation-c.test.tsx:4` comment (web: 12 passed); `core-web/src/features/session-monitor/__tests__/no-live-levels.test.tsx:1` comment (web: 3 passed) | 10:154 | PROVEN LIVE AT A GATE |
| M5-NODEV-C-T | gate-driven | `mobile/src/features/session-live/situation-c.test.tsx:4` comment (mobile: 16 passed) | - | PROVEN LIVE AT A GATE - F1 (connecting) on the tablet only (10:83) |
| M5-NODEV-C-P | gate-driven | - | 10:110 | PROVEN LIVE AT A GATE |
| M5-SRC-REC-1 | suite | `core-server/src/capture-session/__tests__/session-capture.db.test.ts:386` title (db: 54 passed); `core-server/src/capture/fence/__tests__/development-session.db.test.ts:3` comment (db: 5 passed) | 10:141, 10b:149, 10c:224 | PROVEN BY SUITE |
| M5-LOCAL-E2E-1 | user-attended (local half) | `core-server/src/capture/fence/__tests__/development-session.db.test.ts:243` title (db: 5 passed); `core-server/src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts:1` comment (dev: 2 passed, 2 skipped) | 10:143 | USER-ATTENDED not run - FAKE-source half: development-session e2e of this run (2 passed) and the gate sessions; the local-device case is skipped unless DEMS_LOCAL_SESSION_ATTENDED=1, which no agent sets (D163) |
| M5-LOCAL-CLAP-1 | user-attended | - | - | USER-ATTENDED not run - manual with the user; no record of a run in decisions.md |
| M5-SEC-SRC-1 | suite + socket snapshot | - | 10b:150, 10c:225, 10d:326 | NOT PROVEN - no test names the ID; SOURCE_KIND_NOT_RECORDABLE is asserted in session-capture.db.test.ts, the socket snapshot and the push attempt were never done (10:142, 10c:225, 10d section 9) |
| M5-SEC-PRIV-2-W | user-attended | `core-web/src/features/devices/__tests__/registered-devices.test.tsx:11` comment (web: 15 passed); `core-web/src/test/live-local-source-on.test.tsx:10` comment (web: 8 passed) | 10:184, 10b:190, 10c:271 | USER-ATTENDED not run - needs an open local device; component tests only |
| M5-SEC-PRIV-2-T | user-attended | `mobile/src/features/devices/registered-devices-model.test.ts:114` title (mobile: 15 passed); `mobile/src/features/capture-selector/local-source-notice.test.tsx:15` comment (mobile: 10 passed) | - | USER-ATTENDED not run - same |
| M5-SEC-PRIV-2-P | user-attended | - | - | USER-ATTENDED not run - same; no test cites the -P id |
| M7-DEVSRC-SEAL-1 | suite | `core-server/src/evidence-verify/__tests__/dev-source-mark.test.ts:108` title (unit: 22 passed) | 12:209 | PROVEN BY SUITE |
| M7-DEVSRC-TAMPER-1 | suite | `core-server/src/evidence-verify/__tests__/dev-source-mark.test.ts:208` title (unit: 22 passed) | 12:209 | PROVEN BY SUITE |
| M7-DEVSRC-BUILD-1 | suite | `core-server/src/evidence-verify/__tests__/source-class-agreement.test.ts:19` title (unit: 4 passed) | - | PROVEN BY SUITE |
| M7-SEC-SRC-2 | gate-driven (db check over the lanes) | `core-server/src/evidence-verify/__tests__/dev-source-mark.test.ts:361` title (unit: 22 passed); `core-server/src/db/reset/__tests__/m4-sec-reset.db.test.ts:14` comment (db: 16 passed) | 12:314, 12b:279 | PROVEN LIVE AT A GATE - lane 2 through the API (12:210); other lanes by record |
| M7-DEVSRC-EVID-W | gate-driven | `core-web/src/features/evidence/__tests__/verify-v2.test.tsx:144` title (web: 36 passed); `core-web/src/features/evidence/__tests__/media-session-canary.test.tsx:21` comment (web: 18 passed) | 12:144 | PROVEN LIVE AT A GATE |
| M7-DEVSRC-EVID-T | gate-driven | `mobile/src/features/evidence/verify-v2.test.tsx:129` title (mobile: 24 passed); `mobile/src/features/evidence/media-session-canary.test.tsx:4` comment (mobile: 16 passed) | 12:145 | PROVEN LIVE AT A GATE |
| M7-DEVSRC-EVID-P | gate-driven | - | 12:311 | PROVEN LIVE AT A GATE - 12c:87 (was NOT PROVEN at 12 and 12b) |
| M7-CONN-CRED-1 | suite | `core-server/src/modules/capture-discovery/connect/__tests__/connect.db.test.ts:346` title (db: 16 passed); `core-server/src/modules/stt-config/__tests__/credential-store.db.test.ts:110` title (db: 6 passed) | - | PROVEN BY SUITE |
| M7-CONN-W-CRED | gate-driven | - | 12:312, 12b:278 | PROVEN LIVE AT A GATE - driven at 09b (Add as camera) and in the wave M session item 2 (CAM-06, fixture account) |
| M5-RG-* | suite | - | 10:136, 10b:146, 10c:220 | PROVEN BY SUITE - Part A rows 3-9 |
| M5-QA-1 | suite | - | 10:137, 10b:147, 10c:221 | PROVEN BY SUITE - Part A rows 1-2 |
| M5-SW-W | gate-driven | - | 10:144 | PROVEN LIVE AT A GATE - client and record assertions; the file-analyser assertions on a product recording NOT PROVEN (10:144) |
| M5-SW-T | gate-driven | `mobile/src/features/session-live/live-late-stop-handover-mark.test.tsx:1` comment (mobile: 1 passed) | 10:86, 10b:92 | PROVEN LIVE AT A GATE - same limit |
| M5-SW-P | gate-driven | `core-server/src/engine/__tests__/actor-scope.test.ts:113` comment (unit: 9 passed) | 10:152, 10b:111 | PROVEN LIVE AT A GATE - sending device closed at 10b:111; same limit |
| M5-GAP-1 | suite (worker harness) | - | 10:138, 10b:149, 10c:224 | PROVEN BY HARNESS OR ROW RECORD, not re-run at HEAD (extra state) - worker series m5_gap_analyser (10:138); not part of Part A |
| M5-WARN-1 | suite | `core-web/src/features/session-monitor/__tests__/audio-source.test.tsx:328` title (web: 21 passed); `mobile/src/features/session-live/mic-source.test.tsx:189` title (mobile: 19 passed) | 10:139, 10b:149, 10c:224 | PROVEN BY SUITE - unit tests of the clients in Part A; the worker half (micwatch_test.c) in the worker series, not re-run |
| M6-RG-* | suite | - | 11:87, 11b:240 | PROVEN BY SUITE - Part A rows 3-9 |
| M6-QA-1 | suite | - | 11:87, 11b:240 | PROVEN BY SUITE - Part A rows 1-2 |
| M6-TF-1 | suite (fakes) + live | `core-server/src/sealing/__tests__/finalize-transcript.test.ts:143` title (unit: 31 passed); `transcriber/src/__tests__/assembly.test.ts:58` title (trans: 31 passed) | 11:223, 11b:123 | PROVEN BY SUITE - live on cpu-local at 11b:75; omlx-server live: not run (the user's rule, port 8000) |
| M6-DF-1 | suite (integration) + live | `core-server/src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts:284` comment (dev: 2 passed, 2 skipped) | 11:91, 11b:321 | PROVEN LIVE AT A GATE - 11b:78 on the sealed package; in the suite only the generated-source e2e ran (the speech case is env-gated and was not run; row77-df1.real.test.ts is a real-engine test, not run) |
| M6-KR-1 | suite (kill harness) | `transcriber/src/__tests__/checkpoint-runner.test.ts:3` comment (trans: 70 passed); `core-server/src/sealing/__tests__/finalize-transcript.test.ts:326` title (unit: 31 passed) | 11:92, 11b:310 | PROVEN BY SUITE - form (a), a Core kill while the engine decodes, NOT PROVEN live (11b:79 R2) |
| M6-LB-1 | suite | `transcriber/src/__tests__/diarization.test.ts:49` title (trans: 60 passed); `transcriber/src/__tests__/assembly.test.ts:58` title (trans: 31 passed) | 11:93, 11b:80 | PROVEN BY SUITE |
| M6-AD-1 | suite | `transcriber/src/__tests__/adapter-contract.test.ts:56` title (trans: 11 passed) | 11:94, 11b:81 | PROVEN BY SUITE |
| M6-CP-1 | suite | `transcriber/src/__tests__/diarization.test.ts:236` comment (trans: 60 passed); `transcriber/src/__tests__/cpu-priority.test.ts:19` title (trans: 25 passed, 1 skipped) | 11:94, 11b:81 | PROVEN BY SUITE |
| M6-STTCFG-API | suite | `core-server/src/modules/stt-config/__tests__/routes.test.ts:1` comment (unit: 68 passed); `packages/shared/test/api-stt-config.test.ts:2` comment (shared: 44 passed) | 11:95, 11b:82 | PROVEN BY SUITE |
| M6-STTCFG-NEXT | suite | `core-server/test/db/set6.db.test.ts:2` comment (db: 18 passed); `core-server/src/transcription/__tests__/session.test.ts:65` title (unit: 16 passed) | 11:96, 11b:83 | PROVEN BY SUITE |
| M6-STTCFG-OFF | suite | `core-server/src/sealing/__tests__/stt-states-verify.test.ts:2` comment (unit: 57 passed); `core-server/src/sealing/__tests__/stt-states.test.ts:185` title (unit: 20 passed) | 11:97, 11b:84 | PROVEN BY SUITE |
| M6-STTCFG-UNREACH | suite (fakes) | `core-server/src/sealing/__tests__/stt-states-verify.test.ts:2` comment (unit: 57 passed); `core-server/src/sealing/__tests__/stt-states.test.ts:327` title (unit: 20 passed) | 11:98, 11b:85 | PROVEN BY SUITE - live: not run (the user's rule, 11b:85) |
| M6-STTCFG-WEB | gate-driven | - | 11:99, 11b:86 | PROVEN LIVE AT A GATE |
| M6-STTCFG-TAB | gate-driven | `mobile/src/features/transcription/stt-status-section.test.tsx:1` comment (mobile: 11 passed) | 11:100, 11b:87 | PROVEN LIVE AT A GATE |
| M6-STTCFG-PHONE | gate-driven | `mobile/src/features/transcription/stt-status-section.test.tsx:1` comment (mobile: 11 passed) | 11:101, 11b:88 | PROVEN LIVE AT A GATE |
| M7-RG-* | suite | - | 12:207, 12b:235 | PROVEN BY SUITE - Part A rows 3-9 |
| M7-QA-1 | suite | - | 12:208, 12b:235 | PROVEN BY SUITE - Part A rows 1-2 |
| M7-REF-1 | suite (env-gated kill matrix) | kill matrix title ran: "M7-REF-1 [no kill] SEALED, not interrupted; one item, one EVIDENCE_SEA" passed | 12:211 | PROVEN BY SUITE |
| M7-KM-P1-0 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P1-0 [WORKER+CORE (SIGKILL from the harness) before the first du" passed | - | PROVEN BY SUITE |
| M7-KM-P2-0 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P2-0 [WORKER+CORE (SIGKILL from the harness) mid-recording; a to" passed | - | PROVEN BY SUITE |
| M7-KM-P3-0 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P3-0 [WORKER+CORE (SIGKILL from the harness) mid-recording, afte" passed | - | PROVEN BY SUITE |
| M7-KM-P4-0 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P4-0 [CORE@CLOSE_TRACKS:BEFORE (SIGKILL of itself) after the sto" passed | - | PROVEN BY SUITE |
| M7-KM-C-S1 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-C-S1 [CORE@CLOSE_TRACKS:AFTER_WORK (SIGKILL of itself)] SEALED, " passed | - | PROVEN BY SUITE |
| M7-KM-C-S2 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-C-S2 [CORE@FINALIZE_HASHES:AFTER_WORK (SIGKILL of itself)] SEALE" passed | - | PROVEN BY SUITE |
| M7-KM-C-S3 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-C-S3 [CORE@FINALIZE_TRANSCRIPT:AFTER_WORK (SIGKILL of itself)] S" passed | - | PROVEN BY SUITE |
| M7-KM-C-S4 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-C-S4 [CORE@BUILD_MANIFEST:AFTER_WORK (SIGKILL of itself)] SEALED" passed | - | PROVEN BY SUITE |
| M7-KM-C-S5 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-C-S5 [CORE@SIGN_MANIFEST:AFTER_WORK (SIGKILL of itself)] SEALED," passed | - | PROVEN BY SUITE |
| M7-KM-C-S6 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-C-S6 [CORE@STORE_SEALED_PACKAGE:AFTER_WORK (SIGKILL of itself)] " passed | - | PROVEN BY SUITE |
| M7-KM-C-S7 | suite (env-gated), conditional | `core-server/src/sealing/__tests__/kill-matrix/cells.ts` PARKED_CELLS | - | CONDITIONAL, not triggered - parked (extra state) - PARKED cell of run.sh --list (OD-21): the fallback step was not triggered |
| M7-KM-C-S8 | suite (env-gated), conditional | `core-server/src/sealing/__tests__/kill-matrix/cells.ts` PARKED_CELLS | - | CONDITIONAL, not triggered - parked (extra state) - PARKED cell of run.sh --list (OD-21): the fallback step was not triggered |
| M7-KM-P1-S1 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P1-S1 [WORKER+CORE (SIGKILL from the harness) before the first d" passed | - | PROVEN BY SUITE |
| M7-KM-P1-S2 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P1-S2 [WORKER+CORE (SIGKILL from the harness) before the first d" passed | - | PROVEN BY SUITE |
| M7-KM-P1-S3 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P1-S3 [WORKER+CORE (SIGKILL from the harness) before the first d" passed | - | PROVEN BY SUITE |
| M7-KM-P1-S4 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P1-S4 [WORKER+CORE (SIGKILL from the harness) before the first d" passed | - | PROVEN BY SUITE |
| M7-KM-P1-S5 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P1-S5 [WORKER+CORE (SIGKILL from the harness) before the first d" passed | - | PROVEN BY SUITE |
| M7-KM-P1-S6 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P1-S6 [WORKER+CORE (SIGKILL from the harness) before the first d" passed | - | PROVEN BY SUITE |
| M7-KM-P2-S1 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P2-S1 [WORKER+CORE (SIGKILL from the harness) mid-recording; a t" passed | - | PROVEN BY SUITE |
| M7-KM-P2-S2 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P2-S2 [WORKER+CORE (SIGKILL from the harness) mid-recording; a t" passed | - | PROVEN BY SUITE |
| M7-KM-P2-S3 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P2-S3 [WORKER+CORE (SIGKILL from the harness) mid-recording; a t" passed | - | PROVEN BY SUITE |
| M7-KM-P2-S4 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P2-S4 [WORKER+CORE (SIGKILL from the harness) mid-recording; a t" passed | - | PROVEN BY SUITE |
| M7-KM-P2-S5 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P2-S5 [WORKER+CORE (SIGKILL from the harness) mid-recording; a t" passed | - | PROVEN BY SUITE |
| M7-KM-P2-S6 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P2-S6 [WORKER+CORE (SIGKILL from the harness) mid-recording; a t" passed | - | PROVEN BY SUITE |
| M7-KM-P3-S1 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P3-S1 [WORKER+CORE (SIGKILL from the harness) mid-recording, aft" passed | - | PROVEN BY SUITE |
| M7-KM-P3-S2 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P3-S2 [WORKER+CORE (SIGKILL from the harness) mid-recording, aft" passed | - | PROVEN BY SUITE |
| M7-KM-P3-S3 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P3-S3 [WORKER+CORE (SIGKILL from the harness) mid-recording, aft" passed | - | PROVEN BY SUITE |
| M7-KM-P3-S4 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P3-S4 [WORKER+CORE (SIGKILL from the harness) mid-recording, aft" passed | - | PROVEN BY SUITE |
| M7-KM-P3-S5 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P3-S5 [WORKER+CORE (SIGKILL from the harness) mid-recording, aft" passed | - | PROVEN BY SUITE |
| M7-KM-P3-S6 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P3-S6 [WORKER+CORE (SIGKILL from the harness) mid-recording, aft" passed | - | PROVEN BY SUITE |
| M7-KM-P4-S1 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P4-S1 [CORE@CLOSE_TRACKS:BEFORE (SIGKILL of itself) after the st" passed | - | PROVEN BY SUITE |
| M7-KM-P4-S2 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P4-S2 [CORE@CLOSE_TRACKS:BEFORE (SIGKILL of itself) after the st" passed | - | PROVEN BY SUITE |
| M7-KM-P4-S3 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P4-S3 [CORE@CLOSE_TRACKS:BEFORE (SIGKILL of itself) after the st" passed | - | PROVEN BY SUITE |
| M7-KM-P4-S4 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P4-S4 [CORE@CLOSE_TRACKS:BEFORE (SIGKILL of itself) after the st" passed | - | PROVEN BY SUITE |
| M7-KM-P4-S5 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P4-S5 [CORE@CLOSE_TRACKS:BEFORE (SIGKILL of itself) after the st" passed | - | PROVEN BY SUITE |
| M7-KM-P4-S6 | suite (env-gated kill matrix) | kill matrix title ran: "M7-KM-P4-S6 [CORE@CLOSE_TRACKS:BEFORE (SIGKILL of itself) after the st" passed | - | PROVEN BY SUITE |
| M7-KM-P1-S7 | suite (env-gated), conditional | `core-server/src/sealing/__tests__/kill-matrix/cells.ts` PARKED_CELLS | - | CONDITIONAL, not triggered - parked (extra state) - PARKED cell of run.sh --list (OD-21): the fallback step was not triggered |
| M7-KM-P1-S8 | suite (env-gated), conditional | `core-server/src/sealing/__tests__/kill-matrix/cells.ts` PARKED_CELLS | - | CONDITIONAL, not triggered - parked (extra state) - PARKED cell of run.sh --list (OD-21): the fallback step was not triggered |
| M7-KM-P2-S7 | suite (env-gated), conditional | `core-server/src/sealing/__tests__/kill-matrix/cells.ts` PARKED_CELLS | - | CONDITIONAL, not triggered - parked (extra state) - PARKED cell of run.sh --list (OD-21): the fallback step was not triggered |
| M7-KM-P2-S8 | suite (env-gated), conditional | `core-server/src/sealing/__tests__/kill-matrix/cells.ts` PARKED_CELLS | - | CONDITIONAL, not triggered - parked (extra state) - PARKED cell of run.sh --list (OD-21): the fallback step was not triggered |
| M7-KM-P3-S7 | suite (env-gated), conditional | `core-server/src/sealing/__tests__/kill-matrix/cells.ts` PARKED_CELLS | - | CONDITIONAL, not triggered - parked (extra state) - PARKED cell of run.sh --list (OD-21): the fallback step was not triggered |
| M7-KM-P3-S8 | suite (env-gated), conditional | `core-server/src/sealing/__tests__/kill-matrix/cells.ts` PARKED_CELLS | - | CONDITIONAL, not triggered - parked (extra state) - PARKED cell of run.sh --list (OD-21): the fallback step was not triggered |
| M7-KM-P4-S7 | suite (env-gated), conditional | `core-server/src/sealing/__tests__/kill-matrix/cells.ts` PARKED_CELLS | - | CONDITIONAL, not triggered - parked (extra state) - PARKED cell of run.sh --list (OD-21): the fallback step was not triggered |
| M7-KM-P4-S8 | suite (env-gated), conditional | `core-server/src/sealing/__tests__/kill-matrix/cells.ts` PARKED_CELLS | - | CONDITIONAL, not triggered - parked (extra state) - PARKED cell of run.sh --list (OD-21): the fallback step was not triggered |
| M7-VV-SRV | suite | `core-server/src/evidence-verify/__tests__/verify-v2.test.ts:74` title (unit: 61 passed) | 12:209 | PROVEN BY SUITE |
| M7-STTCFG-VERIFY | suite | `core-server/src/sealing/__tests__/stt-states-verify.test.ts:133` title (unit: 57 passed); `core-server/src/sealing/__tests__/stt-states.test.ts:3` comment (unit: 20 passed) | - | PROVEN BY SUITE |
| M7-VV-WEB | gate-driven | `core-web/src/features/evidence/__tests__/verify-v2.test.tsx:372` title (web: 36 passed) | 12:144 | PROVEN LIVE AT A GATE |
| M7-VV-PHONE | gate-driven | `mobile/src/features/evidence/verify-v2.test.tsx:280` title (mobile: 24 passed) | 12:311, 12b:57 | PROVEN LIVE AT A GATE - 12c:87 |
| M7-TP-1 | suite | `core-server/src/evidence-verify/__tests__/verify-v2.test.ts:287` title (unit: 61 passed); `core-web/src/features/evidence/__tests__/verify-v2.test.tsx:278` title (web: 36 passed) | 12:209 | PROVEN BY SUITE |
| M7-FF-UNIT | suite | - | - | PROVEN BY SUITE - no test cites -UNIT; the unit tests are the two files that cite M7-FF-WEB / -TAB: core-web sealing-progress.test.tsx, mobile finalizing-forward-only.test.tsx |
| M7-FF-WEB | gate-driven | `core-web/src/features/session-monitor/__tests__/sealing-progress.test.tsx:32` title (web: 27 passed) | 12:194 | PROVEN LIVE AT A GATE - first half (the percent never falls) (12:194) |
| M7-FF-TAB | gate-driven | `mobile/src/features/session-finalizing/finalizing-forward-only.test.tsx:74` title (mobile: 9 passed) | 12:195 | PROVEN LIVE AT A GATE - first half (12:195) |
| M7-FF-PHONE | gate-driven | `mobile/src/features/session-finalizing/finalizing-forward-only.test.tsx:74` title (mobile: 9 passed) | 12:196 | PROVEN LIVE AT A GATE - first half, on a simulated seal of lane 1 (12:196) |
| M8-RG-* | suite | - | 13:72, 13b:210 | PROVEN BY SUITE - Part A rows 3-9 |
| M8-QA-1 | suite | - | 13:73, 13b:210 | PROVEN BY SUITE - Part A rows 1-2 |
| M8-PB-W | gate-driven | - | 13:74, 13b:66 | PROVEN LIVE AT A GATE - 13b:65-66, 13d, wave M item 1 (tamper stop 3 of 3) |
| M8-PB-T | gate-driven | `mobile/src/features/evidence/media-session-canary.test.tsx:4` comment (mobile: 16 passed) | 13:75, 13b:78 | PROVEN LIVE AT A GATE - 13b:78; seek closed at 13c:54 |
| M8-PB-P | gate-driven | `mobile/src/features/evidence/evidence-detail.test.tsx:987` title (mobile: 74 passed) | 13:130, 13b:246, 13c:60 | PROVEN LIVE AT A GATE - 13c:60 |
| M8-EV-SCOPE-1 | gate-driven | `core-server/src/modules/media-stream/__tests__/routes.test.ts:200` title (unit: 42 passed); `core-server/src/modules/media-stream/__tests__/media-stream.db.test.ts:164` title (db: 5 passed) | 13:78, 13b:145 | PROVEN LIVE AT A GATE - 13b:145 |
| M8-RNG-1 | suite | `core-server/src/modules/media-stream/__tests__/routes.test.ts:121` title (unit: 42 passed); `core-server/src/media-stream/__tests__/ranges.test.ts:10` title (unit: 19 passed) | 13:77, 13b:144 | PROVEN BY SUITE |
| M8-EXP-1 | gate-driven | `core-server/src/evidence-export/__tests__/export.test.ts:49` title (unit: 20 passed) | 13:81, 13b:115 | PROVEN LIVE AT A GATE - 13b:115 (the receiver's command on the download) |
| M8-CMP-1 | gate-driven | `core-server/src/evidence-export/__tests__/export.test.ts:191` title (unit: 20 passed) | 13b:147, 13c:179, 13d:141 | NOT PROVEN - blocked: licence decision of the user (13d C-3); the job answers COMPOSITE_ENCODER_NOT_SELECTED; export.test.ts asserts the refusal, not a composite |
| M8-BLK-1 | suite | `core-server/src/modules/media-stream/__tests__/routes.test.ts:335` title (unit: 42 passed); `core-server/src/media-stream/__tests__/static.test.ts:133` title (unit: 11 passed) | 13:80, 13b:148 | PROVEN BY SUITE |
| M8-XAU-1 | suite | `core-server/src/evidence-export/__tests__/export.test.ts:266` title (unit: 20 passed); `core-server/src/evidence-export/__tests__/jobs.test.ts:153` title (unit: 20 passed) | 13:84, 13b:149 | PROVEN BY SUITE |
| M8-REV-1 | suite | `core-web/src/features/evidence/__tests__/transcript.test.tsx:193` title (web: 20 passed); `mobile/src/features/evidence/media-session-canary.test.tsx:466` title (mobile: 16 passed) | 13:135 | PROVEN BY SUITE |
| M9-RG-* | suite | - | - | PROVEN BY SUITE - Part A rows 3-9 of this report |
| M9-QA-1 | suite | - | - | PROVEN BY SUITE - Part A rows 1-2; release build not asked, not made |
| M9-SIM-1 | suite | - | - | PROVEN BY SUITE - SIM-1: the sim-named files of the shared run and mock-core 4 / 19; SIM-2: the diff list of test/16 section 5 (not re-derived) |
| M9-PIN-1 | suite (grep) | - | - | PROVEN BY SUITE - Part A row 15: the literal grep prints only the exempt lines |
| M9-DOC-1 | document check | - | - | CHAIN REPORT, not a test (extra state) - implementation/47_m9_docs.md; not a test, not re-checked here (the verifier's, chain step 1) |
| M9-HYG-1 | document check | - | - | CHAIN REPORT, not a test (extra state) - implementation/162 and 163: items closed or listed NOT DONE with what each needs; the carried items have no decision number yet |
| M9-CH-1 | chain report | - | - | CHAIN REPORT, not a test (extra state) - verification/01_verification.md on disk (header: PASS WITH CONDITIONS, needs-review); read by its header only |
| M9-CH-2 | chain report | - | - | CHAIN REPORT, not a test (extra state) - verification/02_security.md on disk (header: verdict CAUTION); read by its header only |
| M9-CH-3 | chain report | - | - | CHAIN REPORT, not a test (extra state) - this report |
| M9-CH-4 | chain report | - | - | CHAIN REPORT, not a test (extra state) - gateway_check/22_final_code_review.md on disk (status complete); not read |

Reading aids for the table: `08:56` = `gateway_check/08_m3_gate.md` line 56; `09`, `09b`, `09c`, `09d` = the M4 gate chain; `10`..`10e` = M5; `11`, `11b` = M6; `12`..`12d` = M7; `13`..`13d` = M8; "wave M" = `gateway_check/14_wave_m_confirmation.md` section 1. Paths in the evidence column are under `apps/` unless they begin with `packages/`.

## C. What the suite cannot show

From `test/13` section 6 (23 gate findings of severity MAJOR or above that passed the suite) and the gate history after it (wave M). The defect classes that only a device, a browser or a booted Core caught, and for each the cheapest automated check that would catch it next time. RECOMMENDATIONS for the next task; nothing was built.

| # | Defect class | Caught by (examples) | Why the suite passed | Cheapest automated check | Effort |
|---|--------------|----------------------|----------------------|--------------------------|--------|
| C1 | Order and lifetime on ONE booted Core: a snapshot taken at boot, a state left by an earlier session, reset or adoption | G70b-01 (adopted camera refused until restart), M-S2 (adopted camera `UNREACHABLE` at the next pre-check), G75b-01 (session key left by a reset), G75c-01 (restart fault never cleared), 12d F-1 (sealed session read back after a restart) | every unit / db case composes a fresh world | booted-order db scenarios on one application instance, in the gate's order: adopt -> assign -> pre-check with no restart; seal -> restart -> read; session -> worker kill -> next session; reset -> session. The kind already exists (`capture-discovery.booted.db.test.ts`, `restart.db.test.ts`, `seal-e2e`): add the four orders | M |
| C2 | A producer that does not exist, or a member the Core does not send | G94-01 (op 40 never answered `LIVE_STREAM`), G94-04 (`audioSourceIntervals` not on the Core's item), G94-03 (download without manifest and signature) | client tests script the answer themselves; the export e2e read from where the Core wrote | client fixtures RECORDED from a booted test Core (one db test writes the answers of ops 39 / 40 / 88 and the listing of a downloaded archive to a fixture file; the web and mobile beds load that file, and a drift test fails when the Core's answer changes); for export, verify the DOWNLOADED archive with `evidence:verify-export` inside the e2e | M |
| C3 | The browser's media stack and real DOM events | G94b-02 / G94c-01 (tampered file = black tile, `readyState 0`), G94d-01 (stall watch cancelled when playback ended), GM-01 (sentence cut by `nowrap`), O-2 (a click on the label closed the dialog) | jsdom has no media stack and no layout; the fake element emits what the test wrote | a Playwright run against lane 2 (camera stub + seal rig + source rig already exist as lane tools): sealed player open / play / seek / tamper stop with the sentence visible; seal dialog blocked -> "Retry sealing"; connect dialog; one "no element text is cut" assertion (`scrollWidth <= clientWidth`) on the sentences of the start rule. Cheaper first step: keep the real event sequences that 13c / 13d / wave M recorded as fixtures of the stall-watch state machine | M (S for the fixtures) |
| C4 | Touch, hit boxes and layout on Android | G81b-03 (buttons outside the pane's box take no touch), G89d-03 (tabs under the action bar), G94b-04 (player opens below the visible pane), the whole-duration overlap in the list | the test renderer has no layout and delivers a press to any element | a Maestro (or Detox) flow per screen that taps by coordinate, plus a `uiautomator dump` bounds assertion run after each step: every clickable node lies inside its scroll parent and intersects no pinned bar (the gate did exactly this by hand: `[1318,176][2528,276]` against `[1318,1398][2528,1536]`) | M |
| C5 | The native player | G94b-01 (no seek reached its target on the tablet) | `expo-video` is a mock (`apps/mobile/jest.setup.ts:69`); a seek on a mock moves a number | the same Maestro flow: seek to 25 / 50 / 90 %, read the position text twice, assert it advanced from the target | M (with C4: one harness) |
| C6 | Native mounting and runtime errors | G89-02 (Reanimated "Unable to find SurfaceMountingManager" bursts), the E-level lines of wave M item 8 | Jest runs no native layer | a logcat gate after any scripted flow: 0 `ReactNativeJS` lines at E or W, 0 `FATAL EXCEPTION`, 0 `ANR in`, with an allow-list for the known graphics lines; and the same for the Core log of the lane (0 error lines per healthy session) | S once C4 exists |
| C7 | A true statement in the wrong mode: simulator values or labels on REAL items | G75-01 (generator rows in a REAL audit chain), G89-01 (simulator facts in a signed manifest), G89-03 ("simulated" / "DEMO key" on a real signature), G94-02 (demo picture on a REAL item) | the labels were asserted for simulated items only | a mode-matrix test per evidence surface: render with an item fixture taken from a Core-sealed package (C2's recorded fixture) and assert the ABSENCE of the simulator vocabulary; server side, one db test "a REAL-capture session writes no row whose source is the generator". The rule tests added by wave H are of this kind: extend them to every surface that names a mode | S |
| C8 | A sequence over time | G75-03 (fault for 100 ms, then SEALED, shown as an ordinary seal), G75b-02 (blocked seal not stated), G75e-01 (recording starts while Home is on a hidden tab), G70c-01 (store still holds the last session's selector) | component tests render one state each, on an empty store | scripted sequences through the existing live-source beds: two sessions in ONE store; fault -> sealed; start while the screen is unfocused | S to M |
| C9 | A missing surface or a missing way in | G94-05 (a finished export downloadable only from its dialog), G70-02 (no client could assign a third microphone) | nothing tests what does not exist | a traceability script: every acceptance criterion of `masterplan/01_specs.md` and every check id of the strategy must be cited by at least one test TITLE or be on a named list of gate-only checks; the script prints the ones cited nowhere (today: the five of T100-01) | S |
| C10 | What a sealed file really is | G89b-01 (`tracks[].profile` stated a format the files did not have) | the test doubles feed no real stream | in `seal-e2e` (it already records with the built worker): compare the manifest's profile with the init segment of the file just sealed | S |
| C11 | Counts over a window of the trail | GM-02 (tamper tile counted over the newest 1000 audit rows) | fixtures hold tens of rows | one unit case with more rows than the view holds | S |
| C12 | A real kill of the Core in a product state | 11b R2 (`M6-KR-1` form (a)), 10c section 8 (a Core stop in other states) | the kill matrix kills at sealing steps only | add cells to the existing kill harness: a Core kill while the engine decodes; no lane is needed | M |

Not automatable on this Mac, by nature: real cameras, PoE, the TPM signer, the real Core device (class C), this Mac's camera and microphone (the user's, D163), the server STT backend while port 8000 is the user's service.

## D. Suite health after the consolidation

### D.1 Flake watch: each file 5 times, alone, quiet host (1-minute load 1.2 to 2.9)

| file | command | passes out of 5 | tests per run | wall per run |
|------|---------|-----------------|---------------|--------------|
| `apps/core-server/src/modules/capture-config/__tests__/capture-config.db.test.ts` (holds the old `integration-d1b` race) | `lockf db-migrate npx vitest run --root apps/core-server --project db --maxWorkers=2 <file>` | **5 / 5** | 17 | 4-6 s |
| `apps/mobile/src/features/evidence/live-evidence-export.test.tsx` | `npx -w apps/mobile jest --maxWorkers=2 <file>` | **5 / 5** | 31 | 7-8 s |
| `apps/mobile/src/features/session-live/mic-source.test.tsx` | same form | **5 / 5** | 19 | 3-4 s |
| `apps/core-server/src/capture/__tests__/ipc.test.ts` (load-sensitive by design: real child processes, 600 ms heartbeat) | `npx vitest run --root apps/core-server --project unit <file>` | **5 / 5** | 16 | 10 s |
| `apps/core-server/src/sealing/__tests__/pipeline.test.ts`, the case "every hook point once: stop there, start again, ..." (`:207`) | same form with `-t "every hook point once"` | **5 / 5** | 1 (60 skipped by the filter) | 3 s |

25 of 25. All five also passed inside their whole suites in Part A (unit at load 3.9 rising to 6.0; db at 3.4 to 6.0). This says nothing about a starved host: the two load-sensitive tests are documented as failing at a load near 100 and passing below 8 (`7827313`), and no run here went above 17.2 (the end of core-web). The old d1b race was again not seen; as test/16 says, that is not proof it is gone.

### D.2 Skipped tests, with their stated reasons

No unconditional skip. 10 skipped tests in the whole-suite runs:

| where | tests | reason (in the title) | did a twin or a gated run execute it? |
|-------|-------|-----------------------|----------------------------------------|
| db: `seal-e2e.db.test.ts` | 3 | skipped unless `DEMS_SEAL_E2E=1` | yes, row 11 |
| db: `development-session-e2e.db.test.ts`, generated sources | 2 | skipped unless `DEMS_DEV_SESSION_E2E=1` | yes, row 12 |
| db: same file, speech case | 1 | skipped unless `DEMS_DEV_SPEECH_SESSION_E2E=1` with the speech fixture and the cpu-local engine | NO, not in this row (gap G9) |
| db: same file, attended case | 1 | skipped unless `DEMS_LOCAL_SESSION_ATTENDED=1`, which no agent sets (D163) | NO, the user's (gap G5) |
| db: `kill-matrix.db.test.ts` | 0 (the file registers a test per named cell and counts as a skipped file) | skipped unless `DEMS_KILL_MATRIX` names cells | yes, row 14 |
| transcriber: `kill-resume.test.ts` | 1 | "N-2, host hides the process table (a sandbox): the guard cannot identify a recorded engine and stops NOTHING" | host-conditional; its twin ran (`implementation/162` 3.5) |
| transcriber: `cpu-priority.test.ts`, `capture-priority.test.ts` | 2 | "host forbids it (a sandbox): ..." | host-conditional; twins ran |

### D.3 Tests that wait on the real clock (grep, not a classification)

Pattern: `await new Promise(...setTimeout...)`, `await sleep(`, `await wait(`, `await delay(`, `await pause(`, `await setTimeout(` in test and test-support files (`*.test.*`, `__tests__`, `test/`, `testing/`). A hit is a line that CAN wait on the real clock; a file that installs fake timers turns some of them into virtual waits, and that was not resolved per line (41 mobile test files install fake timers).

| workspace | lines | files | named exceptions inside the count |
|-----------|-------|-------|-----------------------------------|
| shared | 1 | 1 | a 0 ms hand-over |
| capture-protocol | 0 | 0 | - |
| core-server | 107 | 54 | the real-process tests: `capture/adapters/local/__tests__/no-delivery.test.ts` 6, `capture/__tests__/ipc.test.ts` 5, `capture/adapters/camera/__tests__/ws-discovery.test.ts` 5, `sealing/__tests__/kill-matrix/kill-matrix.db.test.ts` 5; also `core/__tests__/pipeline.test.ts` 6 and `core/__tests__/audit-chain.db.test.ts` 5 (not classified) |
| core-web | 61 | 42 | `clearToasts`: 35 of the 61 lines are the toast-queue exit wait (350 ms; `clearToasts(` is called on 109 lines in 63 files); the stall watch is `features/evidence/__tests__/sealed-player.test.tsx`, the slowest web file (38.8 s) |
| mobile | 87 | 47 | 39 lines are one 50 ms form; `features/settings/live-settings-boundary.test.tsx` 17; not classified against fake timers |
| transcriber | 17 | 6 | 5 lines in three `test/real` files (not run); the rest in the process tests `cpu-priority`, `capture-priority`, `kill-resume` |
| mock-core, pg-scripts | 0 | 0 | - |

The standing check X-FC-1 of the strategy asks that every hit in a new or changed test file be classified; the last record is `implementation/163` section 8 (one new hit, a 0 ms hand-over). A whole-repo classification does not exist and was not made here.

### D.4 Per-test time ceilings in the mobile suite

Counted at HEAD (`rg -U '\},\s*(15|30|40)_000,?\s*\);'`): **50** in four files, not the 58 of the brief and of `implementation/163` section 3.8:

| file | ceilings |
|------|----------|
| `apps/mobile/src/features/evidence/evidence-detail.test.tsx` | 43 (note 163: 50) |
| `apps/mobile/src/features/evidence/media-session-canary.test.tsx` | 5 |
| `apps/mobile/src/features/login/login.test.tsx` | 1 |
| `apps/mobile/src/features/devices/devices-states.test.tsx` | 1 |

`evidence-detail.test.tsx` has 45 lines that hold `15_000`, `30_000` or `40_000`; two are data (`toMs: 40_000`, `fromMs: 40_000`, `:961-962`), 43 are ceilings. `jest.setTimeout(` occurs 0 times in `apps/mobile`; the workspace ceiling is `testTimeout: 20000` (`apps/mobile/jest.config.js:10`). Strategy section I says "per-test ceilings stay removed" and names 20 s "the single workspace ceiling" (T100-04). By the same pattern the other workspaces hold per-test ceilings too: core-server 29 in 14 files, transcriber 4 in 2, mock-core 4 in 2 (mostly real-process tests; not classified).

### D.5 Wall time of the full regression, and where it goes

Part A, 20:45:26 to 21:13:36: **28 min 10 s** (1,690 s).

| part | seconds | share |
|------|---------|-------|
| kill matrix (35 cells, 1 worker) | 589 | 35 % |
| core-server db | 207 | 12 % |
| mobile | 182 | 11 % |
| waiting for the 1-minute load to fall below 4 (after shared 80 s, after unit 70 s, after db 40 s, after core-web 111 s, after mobile 40 s, before shared 20 s) | 361 | 21 % |
| typecheck + lint, per workspace and root | 103 | 6 % |
| core-web | 80 | 5 % |
| core-server unit | 62 | 4 % |
| seal e2e + development e2e | 63 | 4 % |
| contract guards, transcriber, mock-core, shared, capture-protocol, pg-scripts | 42 | 2 % |

Test run time alone (rows 3 to 14): about 20 minutes, as in test/16; the eight whole suites sum to 557 s (test/16: 558 s; before the consolidation 620 s). The load at the start of each suite was 2.1 to 3.9; it rose to 17.2 at the end of core-web (test/16: 16.6) and to 7.2 after the root typecheck and shared. A fifth of the wall is the load rule, and most of that wait follows core-web, which runs with the runner's default worker count.

## E. Findings (none is a red)

| id | finding | where | severity |
|----|---------|-------|----------|
| T100-01 | Five suite-class check ids are cited by no test: `M4-PIN-2`, `M4-UX-VOC-1`, `M4-UX-A11Y-1`, `M7-FF-UNIT`, `M5-SEC-SRC-1`. For the two UX ids the owning notes say so themselves: "`M4-UX-VOC-1` / `M4-UX-A11Y-1` were not run as named checks" (`implementation/69_r9_mobile_devices.md:79`) and "no automated vocabulary or axe check was added by this row" (`68_r9_web_devices.md:101`), while `09_m4_gate.md:85` records them PASS by the suites. Part B keeps four of them as PROVEN BY SUITE by content (i18n parity tests; `aria` / role assertions in the component tests of the two folders; the pins in `contract-inventory.test.ts` and `meta.ts`; the two forward-only test files) and says so in each row; I did not read them clause by clause. In general 49 of the 157 cited ids are cited only in comments, and the table proves "a passing file cites the id", not "every clause is asserted" | Part B | low |
| T100-02 | `M5-SEC-SRC-1` has been NOT PROVEN since the first M5 gate (`10_m5_gate.md:142`, `10b:150`, `10c:225`, `10d` section 9) and no ruling or test closed it. It is a security check of the catalogue (no listener for a source kind without an opener) | gap G1 | medium |
| T100-03 | The capture worker's own checks (`check.sh`, `--selftest`, C unit tests, the e2e series) are in no whole-regression list since gate 64 (`f293221`): not in test/12, test/16 or this brief. Eight M3 / M5 checks rest on that one series. The carry is valid under D122 because the sources did not change (`git log -- apps/capture-worker`: only `README.md` in `74fd1f1`; the binary is of 2026-10-10 10:46, older than no source file), but a final regression that never runs the worker's static rules and selftest is thinner than the strategy's `M9-RG-*` reads | gap G7 | medium |
| T100-04 | Strategy section I ("per-test ceilings stay removed", 20 s the single ceiling) against 50 per-test ceilings in four mobile files; and the count on record is 58 where the tree has 50 | D.4 | low |
| T100-05 | Strategy B.4 / X-MAX-1 prescribe `--maxWorkers=2` for every jest / vitest workspace; the regression of record (test/12, test/16, this run) runs unit with 4 and four workspaces with the default. No erratum states the change | A.4 | low |
| T100-06 | Paths: row 100 names `gateway_check/23_test_final.md`, the brief names this file; strategy A.9 names `gateway_check/14_m9_gate.md` as the artifact of record for M9, a number the wave M confirmation holds; the chain reports on disk are `verification/01_verification.md`, `verification/02_security.md`, `gateway_check/22_final_code_review.md` | head | info |
| T100-07 | The two renamed transcriber children were not executed after their rename, and cannot be by an agent run under the present rule; proof is static only (A.2). The speech case of the development e2e was likewise not run after its title changed | A.2 | low |
| T100-08 | `M4-LOCAL-MIC-1`: the only run on record (the user's, D128) FAILED on `rate`; D136 reads 8 of 9. Nothing later records a PASS. The catalogue row is neither closed nor amended | gap G3 | low (a stated product limit) |
| T100-09 | Whole db suite: 2 forced database drops needed a retry (SQLSTATE 42501, a backend the owner role may not end); 0 remained. test/16 had 0. Worth a look only if it grows | A.1 | info |

Carried from test/16 and still true: finding 3 (db 207 s against the audit's 150 to 200 s; `capture-discovery.db.test.ts` 37.6 s against under 20 s) and finding 4 (the d1b race not seen, not shown gone). test/16 finding 1 (34 stale prose lines) and finding 2 (five wave-named support files) are closed by row 97; the six `test/real` files with row / wave names remain.

## F. What row 100 names that I could not do, or did in another form

- "The test-strategy catalogue vs the closed ledger": no file called a ledger of checks exists in the task folder. The reconciliation was made against the gate reports and against this run (Part B).
- "Every check accounted executed / skipped-conditional": done as the states of Part B; 235 of 235 ids carry a state, none is unaccounted. The states are finer than the row's two words.
- The assertion text of the catalogue rows of A.4a and A.5 to A.8 was not read clause by clause (head of this report).
- `npm audit` (X-DEP-1), root `npm test`, a release build: not named for this row, not run.
- The capture worker's checks: not in the brief, not run (T100-03).
- The real-engine transcriber tests, the speech e2e case, anything on port 8000: not run, by rule.
- `masterplan/02_plan.md` tracking and `implementation/99_implementation_report.md`: not written; the brief asks for this one file.

## Status

needs-review. Part A GREEN: typecheck and lint rc 0 in seven workspaces and at the root with 0 warnings; eight whole suites 17,494 passed, 0 failed, 10 skipped by stated condition; pg-scripts 57 of 57; seal e2e 3 of 3; development-session e2e 2 passed, 2 skipped by design; contract guards 66 + 38; kill matrix 35 of 35; 97 operations (36 GET / 61 POST), 67 audit types, schema 6 / dbc-7; pin sweep 0 stale; flake watch 25 of 25. Verdict: YES WITH LISTED GAPS (section 0), nine findings T100-01..09, two of them medium.

---
*Generated: 2026-10-11 21:25 WIB*
