---
task_slug: dems_real_capture_sealing
date: 2026-10-10
agent: test-expert (test runner, decision D122)
status: needs-review
tree: commit abf742f + uncommitted review-fix work (schema 6 / dbc-7, worker capture-worker/0.5.0)
---

# Checkpoint wave F: heavy runs and whole suites

Run once each, in the order below, on project PostgreSQL 127.0.0.1:4432, command sandbox off for everything that binds loopback or talks to PostgreSQL. No product file changed. No git write. Written to disk by this run: this report, the git-ignored `.cache/waveF/seal-e2e/` (two verify reports), and the scripts' own `.cache/kill-matrix/*.json` reports. No local device was selected; neither `DEMS_LOCAL_SESSION_ATTENDED` nor `DEMS_USER_ATTENDED` was set; nothing under `adapters/local/__tests__/e2e/` was run.

## Part A: heavy checks

| # | Check | Result | Attempts | Duration |
|---|-------|--------|----------|----------|
| A1a | `make -C apps/capture-worker` (build; its default target also ran the static rules and unit binaries) | exit 0 | 1 (re-run for the exit code: exit 0, no-op) | 37 s |
| A1b | `make -C apps/capture-worker check selftest unit` | exit 0 | 1 | 68 s |
| A2 | Seal e2e `seal-e2e.db.test.ts` | 3 passed (a, b, c), 1 file | 1 | 46 s |
| A3 | Kill matrix, 35 listed checks | 35 passed of 35, exit 0 | 2 (see note) | 590 s |
| A4 | Development-session e2e (generated sources) | 2 passed, 1 skipped (the attended case), exit 0 | 1 | 17 s |
| A5 | `test/acceptance/demo-seed-v2.test.ts` | 4 passed, exit 0 | 1 | 6 s |

A3 note: attempt 1 was refused by the script before anything started (`unknown argument`, exit 2, 0 s): my own shell passed the 35 `--only` flags as one word. Attempt 2 used an argument array. Nothing else was run twice. The 10 parked ids (all `*-S7` / `*-S8`: M7-KM-C-S7, C-S8, P1-S7, P1-S8, P2-S7, P2-S8, P3-S7, P3-S8, P4-S7, P4-S8; "OD-21 fallback path activated") were not run; the script refuses them.

A1 facts: the worker's own check lines all say "all checks hold" and every negative control says "fails, as required"; `sink_kill_test: 200 kills ... violations 0`.

Worker e2e series, not re-run (quote from `.cache/m3worker/e2e/fixM3_full/summary.txt`, file time Oct 10 11:31): `122 checks (81 expected PASS, 41 negative controls expected FAIL): 122 as expected, 0 unexpected` / `ports still listening after the series: none` / `AGGREGATE EXIT CODE 0`. That series ran before this run; Core-side files changed after it.

### A2 facts (seal e2e)

Source: the two verify reports `.cache/waveF/seal-e2e/verify-SES-20261010-0024-1791608279317.json` (case a) and `...-1791608293288.json` (case b), plus what the test asserts (`apps/core-server/src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts`, line numbers below). The fixtures are removed in `afterAll`, so nothing outside these two reports can be read after the run.

| Fact | Case (a) normal seal | Case (b) worker killed -> RECOVERY |
|------|----------------------|------------------------------------|
| verify verdict | `overall: PASS`, `ok: true`, HTTP 200 | `overall: PASS`, `ok: true`, HTTP 200 |
| check count | 15 (V-01 .. V-15), all `PASS`, no skipped | 15, all `PASS`, no skipped |
| `interrupted` (expected / reported) | false / false | true / true |
| `sources.development` | `true`, code `DEVELOPMENT`, tracks VIDEO-01 (CAM-01 FAKE), VIDEO-02 (CAM-02 FAKE), audio interval seq 1 MIC-01 FAKE | the same |
| `transcriptState` | code `DISABLED_BY_CONFIGURATION`, `sealedState: DISABLED`, `documentSealed: false`, `failedChunks: null`, `backendUnreachable: false` | the same |
| `failedFragmentCount` | 0 | 0 |

Asserted by the test (it passed), not printed in any report:
- Item transcript summary: yes. Line 148: `item.transcript` equals `{ state: 'DISABLED', sha256: null, machineTranscriptHash: null, labelsStatus: null, revision: 0, backendUnreachable: false }`; item also `status SEALED, integritySource REAL, manifestVersion 2, developmentSources true, signature Ed25519 simulated false` (line 146).
- Plaintext recordings left: no. Lines 152 to 154: the package folder holds exactly `AUDIT_EXTRACT, CERTIFICATE, FRAGMENTS_DIR, MANIFEST, SIGNATURE`; the fragments dir holds `VIDEO-01.mp4, VIDEO-02.mp4, fragments.json`; neither `VIDEO-01.mp4` nor `VIDEO-02.mp4` exists in the session folder. Lines 163 to 167: the sealed bytes begin `ftyp` and no `moof` is readable at any fragment offset. Line 171: all six sealing jobs `DONE`.
- `tracks[].codec`: NOT AVAILABLE. Neither report carries it and the test has no assertion on a codec (`grep codec` in the test file: no hit). The sealed manifests were removed with the fixtures.
- Manifest field 40 (clock offset) per track: NOT AVAILABLE, same reason (no assertion on a clock offset in the test; manifest not kept). This is a gap against the brief, not a pass.
- Track source classes in the manifest: `[['VIDEO-01','FAKE'],['VIDEO-02','FAKE']]` (line 158); every audio source interval `FAKE` (line 160).

Case (c), UNSEALABLE in a running Core (new, first execution): PASSED. The test run printed no `console.info` line (the line `[fm7b e2e c] ...` is not in the output) and (c) writes no report file, so its end state is stated from its assertions (lines 283 to 315), not from a printed value:
- Outcome: `lastOutcome` is `{ status: 'FAILED', code: 'NOTHING_SEALABLE' }`; no open session (`session === null`).
- Session end state: `sessionHistory[0]` is `{ outcome: 'INCOMPLETE', evidenceId: null }`; no evidence item for the session; `sealing_jobs` holds a `FAILED` row with `error_code 'UNSEALABLE'`.
- Alert: exactly one with `params.reason 'UNSEALABLE'`: `{ kind: 'SYSTEM', severity: 'CRITICAL', active: true, target: <sessionId>, params: { cause: 'NOTHING_SEALABLE', sessionId } }`. Audit: exactly one `SESSION_INCOMPLETE` row, severity `CRITICAL`, details `{ reason: 'UNSEALABLE', cause: 'NOTHING_SEALABLE' }`.
- Quarantine folder: `<mediaStore>/.quarantine/<sessionId>/` exists; `VIDEO-01.mp4` and `VIDEO-02.mp4` are there, 64 bytes each, `mode & 0o077 === 0` for both files and for the folder (owner-only; the octal value itself is not printed). The session's own folder is gone (`existsSync(folder) === false`).
- After: a new session was created and cancelled (204); a third Core start logged `SEALING_QUARANTINE_HOLDS_SESSIONS` and `lastOutcome()` was `null` (nothing retried).

### A3: kill matrix (35 of 35 green)

`Tests 35 passed (35)`, `Duration 590.11s`, `teardown: dropped 2 database(s); 0 remain`. Checks run (one vitest run, `--only` for each): M7-REF-1; M7-KM-C-S1..S6; M7-KM-P1-0, P1-S1..S6; M7-KM-P2-0, P2-S1..S6; M7-KM-P3-0, P3-S1..S6; M7-KM-P4-0, P4-S1..S6. No red cell.

## Part B: whole suites

| # | Command | Exit | Files / tests | Duration |
|---|---------|------|---------------|----------|
| B1 | `npm run typecheck -w <ws>` x 7 (shared, core-server, core-web, mobile, capture-protocol, transcriber, mock-core) | 0 for all 7 | 0 `error TS` lines in all 7 logs | 3 + 7 + 11 + 5 + 0 + 2 + 1 s |
| B2 | `npm run lint -w <ws>` x 7 (same) | 0 for all 7 | mobile: 0 errors, 1 warning (`apps/mobile/src/runtime/log.test.ts:160:19` `@typescript-eslint/array-type`); the other 6 print nothing | 0 + 0 + 1 + 13 + 0 + 1 + 0 s |
| B3 | `npm run test -w @dems/shared` | 0 | 104 files passed; 2476 tests passed | 4 s |
| B4 | `npm run test -w @dems/capture-protocol` | 0 | 1 file; 31 passed | 1 s |
| B5 | `npx vitest run --root apps/core-server --project unit --maxWorkers=4` | 1 | 309 files: 307 passed, 2 failed; 6247 tests: 6244 passed, 3 failed, 0 skipped | 62.6 s |
| B6 | `lockf db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2` | 1 | 180 files: 175 passed, 2 failed, 3 skipped; 2387 tests: 2379 passed, 2 failed, 6 skipped | 216.4 s |
| B7 | `npm run test -w @dems/core-web -- --maxWorkers=4` | 0 | 154 files passed; 1900 tests passed | 101 s |
| B8 | `npx -w apps/mobile jest --maxWorkers=2` | 1 | 250 suites: 249 passed, 1 failed; 2439 tests: 2438 passed, 1 failed | 154.6 s |
| B9a | `npm run test -w @dems/transcriber` | 0 | 20 files passed; 561 passed, 3 skipped | 16 s |
| B9b | `npm run test -w @dems/mock-core` | 0 | 4 files passed; 19 passed | 4 s |

B9 skipped nothing by choice: the transcriber `vitest.config.ts` includes only `src/**/*.test.ts` (no model, no network); the `test:real:*` scripts (they use real engines) were not run. The mock-core tests listen on port 0 and 4410 on 127.0.0.1 only; none touches port 8000 (the `8000` in that folder is a launcher timeout in ms).

B7 note: my first call, `npx vitest run --root apps/core-web` from the repo root, gave 1 failed file (`src/test/shell-motion.test.tsx`, `ENOENT ... /Users/gsp-budi/Documents/DEMS/src/components/shell/shell.css`) because that test reads `process.cwd()`; that was my invocation, not the tree. Re-run through the npm script (cwd = workspace) as the brief says: exit 0. The row above is the second run.

## Reds (5 distinct tests in 5 files, each re-run once in isolation: all red again)

1. `apps/core-server/src/modules/sessions/__tests__/static.test.ts`, B5. Test: `rule M3: who may call is stage 6, only > the module names no permission and no role, reads no member of the principal, and resolves no session or device itself`. First error: `AssertionError: expected [ …(2) ] to deeply equal []`, received `["src/modules/sessions/routes.ts:305", "src/modules/sessions/routes.ts:305"]` at `static.test.ts:106` (`expect(places(PRINCIPAL_MEMBER)).toEqual([])`). Re-run: red again.
2. Same file. Test: `... the principal is only ever handed on, as it is, to the engine: every use of it is an argument of a hosted command`. First error: `AssertionError: expected [ …(14) ] to deeply equal [ …(16) ]` at `static.test.ts:115` (`expect(handedOn).toEqual(uses)`); the diff shows `src/modules/sessions/routes.ts:305` twice in the expected list and not in the received list. Re-run: red again (same file, both tests red, 18 passed).
3. `apps/core-server/src/modules/transcripts/__tests__/revision-reconcile.test.ts`, B5. Test: `R80-08 at boot: the revision list files of a sealed package are held against the stored revisions > (b) CRASH POINT 2 - the commit succeeded, the rename never happened: the staged list is the stored chain -> it is renamed over the list; V-11 passes with the table count; one warn entry`. First error: `AssertionError: expected [ 'V-11 REVISION_COUNT_MISMATCH' ] to deeply equal [ Array(2) ]`; diff: the expected second entry `"V-14 UNEXPECTED_FILE"` is absent from the received list; at `revision-reconcile.test.ts:134`. Re-run: red again (1 failed, 7 passed).
4. `apps/core-server/src/modules/transcripts/__tests__/transcript-routes.db.test.ts`, B6. Test: `R80-08: the revision list of the package is replaced only AFTER the commit; the staged list is judged by the table > (b) CRASH POINT 2 through a real start: ...`. First error: `AssertionError: expected [ 'V-11 REVISION_COUNT_MISMATCH' ] to deeply equal [ Array(2) ]`, the same diff (`"V-14 UNEXPECTED_FILE"` absent) at `transcript-routes.db.test.ts:722`. Re-run: red again (1 failed, 19 passed).
5. `apps/core-server/src/modules/evidence/__tests__/bulk.db.test.ts`, B6. Test: `the three commands on fixture items > an export continues the stored export counter, an archive of an archived item writes nothing, an export of a RECORDED or an ARCHIVED item is refused; the sealed rows of all 515 items do not move`. First error: `AssertionError: expected { exportId: 'EXP-000091', …(3) } to deeply equal { exportId: 'EXP-000091', …(2) }`; the diff shows an extra received key `"jobId": "EXPJ-000091"`, at `bulk.db.test.ts:313`. Re-run: red again (1 failed, 13 passed).
6. `apps/mobile/src/features/session-summary/summary-live-static.test.ts`, B8. Test: `the three folders take the Core through the light Live API (CLG c, AC-C-53) > reads all three folders: every production file, sub-folders included`. First error: `expect(received).toEqual(expected)`, received has one extra entry `"session-finalizing/unsealable-notice.tsx"` (between `session-finalizing-screen.tsx` and `use-finalizing.ts`), at `summary-live-static.test.ts:60:49`. Re-run: red again (1 failed, 9 passed).

That is 6 failed tests in 5 test files (B5 3 tests / 2 files, B6 2 tests / 2 files, B8 1 test / 1 file). Related reds that share an error text: items 3 and 4 (same `V-11` / `V-14` diff, one in the unit project and one in the db project). Every other command in A and B is green. Reds after the single re-run: 6 of 6 still red, so none is a flake.

## DEBT

Statically declared `it.fails` / `it.todo`: none live. The only hits for `it.fails` are comments (`apps/core-server/src/capture/fence/__tests__/development-session.db.test.ts:342` and `:358` say the cases "was `it.fails`" and are now plain; `apps/core-server/src/modules/devices/__tests__/source-class.db.test.ts:121` "`it.fails` until then"). No `.todo`, `xit`, `describe.skip` or `it.skip` found in `apps/` and `packages/` (grep over `.ts .tsx .js .mjs`, excluding `node_modules`, `build`, `android`, `ios`, `dist`).

Skipped at run time (this tree, this host, this env):

| Where | File | Count | Why it is skipped (marker in the file) |
|-------|------|-------|----------------------------------------|
| B6 db | `apps/core-server/src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts` | 3 | `describe.skipIf(!ASKED)`: needs `DEMS_SEAL_E2E=1` (it ran green in A2) |
| B6 db | `apps/core-server/src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts` | 3 | needs `DEMS_DEV_SESSION_E2E=1` (2 ran green in A4; the attended case stays skipped by design) |
| B6 db | `apps/core-server/src/sealing/__tests__/kill-matrix/kill-matrix.db.test.ts` | 0 tests collected (file counted skipped) | needs `DEMS_KILL_MATRIX` (it ran green in A3) |
| A4 | `development-session-e2e.db.test.ts` ATTENDED case | 1 | the user's own run, at the Mac |
| B9a | `apps/transcriber/src/__tests__/kill-resume.test.ts` | 1 | `N-2, host hides the process table (a sandbox)`: `it.skipIf(HOST_READS_PROCESS_TABLE)` |
| B9a | `apps/transcriber/src/__tests__/cpu-priority.test.ts` | 1 | `host forbids it (a sandbox)`: `it.runIf(!HOST_LOWERS_PRIORITY)` |
| B9a | `apps/transcriber/src/__tests__/capture-priority.test.ts` | 1 | `host forbids it (a sandbox)`: `it.runIf(!HOST_LOWERS_PRIORITY)` |

Skipped count per suite: B3 0, B4 0, B5 0, B6 6 (2 files) + 1 file with no tests collected, B7 0, B8 0, B9a 3, B9b 0. Conditional markers (`runIf` / `skipIf`) in the repo, count per file, all of which evaluated to RUN in B5 except as listed above: `apps/transcriber/src/__tests__/kill-resume.test.ts` 3, `capture-priority.test.ts` 2, `cpu-priority.test.ts` 2, `apps/core-server/src/capture/fence/__tests__/fence.test.ts` 3, `.../e2e/development-session-e2e.db.test.ts` 3, and 1 each in `test/acceptance/demo-seed-v2.test.ts`, `capture/fence/__tests__/fence.db.test.ts`, `sealing-host/__tests__/demo-seed.generated.test.ts`, `capture/adapters/local/__tests__/mic-helper.generated.test.ts`, `.../no-delivery.test.ts`, `transcription/__tests__/probe.test.ts`, `transcription/__tests__/session-run.test.ts`, `sealing-host/__tests__/e2e/seal-e2e.db.test.ts`, `sealing/__tests__/kill-matrix/kill-matrix.db.test.ts`, `modules/devices/__tests__/source-class.db.test.ts` (that one is a comment only).

## End state

- `pgrep -fl 'capture-worker|ffmpeg'` after the last command: no output (exit 1).
- Throw-away databases: each db run printed its teardown line with `0 remain with the run prefix` (A2, A3, A4, A5, B6, and the two re-runs). B6 teardown also printed `forced drops that needed a retry: 2 (... SQLSTATE 42501 ... autovacuum ...; each drop then went through)`.
- Standing databases (`dems_demo`, `dems_lane_*`) were not used. `.data/pg*.env` and pwfiles were not read. No ports 5173-5175, 8000, 5432 touched.
- Limits: tracks[].codec and manifest field 40 per track could not be quoted (see A2). Case (c) is evidenced by the test's assertions only. B5 and B6 were run once each; the two db reds and the unit reds were re-run per file as the brief says.
