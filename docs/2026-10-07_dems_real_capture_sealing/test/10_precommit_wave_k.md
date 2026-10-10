# Pre-commit whole run, wave K (2026-10-11)

Runner: test-runner agent (decision D122). Tree: commit `57b80a9` plus the uncommitted work of fix wave K (245 entries in `git status --short` at the end). Procedure: `test/09_precommit_wave_i.md`, plus the checks listed under "Checks for the test runner" in notes 139 to 146. Sequential, from the repo root; sandbox off for everything that binds loopback, talks to PostgreSQL or signals a process (typecheck, lint, shared, capture-protocol and mobile ran inside the sandbox). `env | grep ^DEMS_` printed nothing at the start; the only flags set were `DEMS_SEAL_E2E=1` (+ `DEMS_SEAL_E2E_OUT`), `DEMS_KILL_MATRIX` (set by `run.sh`) and `DEMS_DEV_SESSION_E2E=1`, each on its own command. No product file and no test file changed; no git write; no install. No local device selected, no `DEMS_*_ATTENDED`, no `.data/pg*.env` read, no port 5173-5175 / 8000 / 5432, no audio played. Metro and both emulators untouched.

Step 0: lane 1 was already stopped. `scripts/lane/lane.sh stop 2` inside the sandbox answered "still listens on 4422 after 20 s; it was sent TERM only" (the sandbox blocks signalling; `ps` was also refused); the same command outside the sandbox answered "lane 2 stopped (was PID 29919); port 4422 is free". At the end `lane.sh status`: main, 1, 2, 3 all `stopped`; `pgrep -fl 'capture-worker|ffmpeg|whisper'` empty (rc 1). No lane was started. Load average: 1 to 6 at every start; it rose to 17 at the end of the core-web run, so I waited (to 4.5) before the mobile run.

## Result: RED overall, 2 reds in 2 files (core-server unit 1, mobile 1); every other check green

Each check ran once. Only the two red files were run a second time: the same failure each time (the unit file listed the same 92 findings), so neither is a flake.

| # | check | command | result | counts (files / tests) | duration |
|---|-------|---------|--------|------------------------|----------|
| 1a-g | typecheck x 7 | `npm run typecheck -w @dems/<ws>` (shared, core-server, core-web, mobile, capture-protocol, transcriber, mock-core) | GREEN, exit 0 x 7 | 0 `error TS` in each | 3 / 8 / 12 / 5 / 1 / 2 / 1 s |
| 2a-g | lint x 7 | `npm run lint -w @dems/<ws>` | GREEN, exit 0 x 7 | 0 errors; mobile (eslint) 1 warning, the known `src/runtime/log.test.ts:160:19 @typescript-eslint/array-type`; six oxlint workspaces silent | 0 / 0 / 0 / 16 / 0 / 0 / 0 s |
| 3 | shared | `npm run test -w @dems/shared` | GREEN | 119 files; 2587 passed / 0 failed | 5 s |
| 3b | capture-protocol | `npm run test -w @dems/capture-protocol` | GREEN | 1 file; 31 passed | 1 s |
| 4 | core-server unit | `npx vitest run --root apps/core-server --project unit --maxWorkers=4` | RED | 349 files: 348 passed, 1 failed; 6631 tests: 6630 passed, 1 failed, 0 skipped | 68 s |
| 4r | unit re-run of the red file | `npx vitest run --root apps/core-server --project unit src/db/fixtures/__tests__/audit-details.test.ts` | RED again, identical | 1 file failed; 35 tests: 34 passed, 1 failed; the same 92 findings | 1 s |
| 5 | core-server db | `/usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2` | GREEN | 195 files: 192 passed, 3 skipped; 2440 tests: 2433 passed, 7 skipped, 0 failed | 242 s |
| 6 | core-web | `npm run test -w @dems/core-web` | GREEN | 180 files; 2136 passed / 0 failed / 0 skipped | 77 s |
| 7 | mobile | `npx -w apps/mobile jest --maxWorkers=2` | RED | 300 suites: 299 passed, 1 failed; 2809 tests: 2808 passed, 1 failed, 0 skipped | 190 s |
| 7r | mobile re-run of the red suite | `npx -w apps/mobile jest src/navigation/__tests__/navigation-units.test.ts` | RED again, identical | 1 suite failed; 40 tests: 39 passed, 1 failed | not timed |
| 8a | transcriber | `npm run test -w @dems/transcriber` | GREEN | 20 files; 564 passed / 0 failed / 3 skipped (567) | 15 s |
| 8b | mock-core | `npm run test -w @dems/mock-core` | GREEN | 4 files; 19 passed | 5 s |
| 9 | seal e2e (built worker `apps/capture-worker/build/capture-worker`) | `DEMS_SEAL_E2E=1 DEMS_SEAL_E2E_OUT="$PWD/.cache/waveK/seal-e2e" lockf -k -t 3600 .locks/heavy-host.lock lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=1 src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts` | GREEN | 1 file; 3 passed | 46 s |
| 10 | kill matrix, all 35 active cells in one call | `apps/core-server/src/sealing/__tests__/kill-matrix/run.sh` with 35 x `--only <id>` (ids from `run.sh --list`; the 10 PARKED cells excluded by design) | GREEN | 1 file; 35 passed / 0 failed; teardown "0 remain" | 589 s |
| 11 | development-session e2e, generated sources | `DEMS_DEV_SESSION_E2E=1 lockf -k -t 1800 .locks/heavy-host.lock lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=1 src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts` | GREEN | 1 file; 2 passed, 2 skipped (speech case needs `DEMS_DEV_SPEECH_SESSION_E2E`; the attended case is the user's) | 17 s |
| 12a | contract guard, shared | `npx vitest run --root packages/shared test/api-registry.test.ts test/api-openapi-scope.test.ts` | GREEN | 2 files; 66 passed | 1 s |
| 12b | contract guard, db | `lockf db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=1 test/acceptance/contract.test.ts` | GREEN | 1 file; 38 passed | 16 s |
| 12c | totals read directly | `node -e` over `packages/shared/openapi/openapi.json`; `expect(AUDIT_TYPES).toHaveLength(67)` at `packages/shared/test/api-registry.test.ts:492`; `apps/core-server/src/db/schema/meta.ts:38,40` | GREEN | 97 operations: 36 GET / 61 POST / 0 other (also pinned at `test/acceptance/contract.test.ts:448`); 67 audit types (pinned, test 12a green); `DB_SCHEMA_VERSION = 6`, `DB_CONTRACT_REVISION = 'dbc-7'`, `meta.ts` not in `git status`. `openapi.json` itself is modified in the tree (wave K), still 97 operations | - |

Skips: db 7 tests in 3 files (the env-gated runner checks `seal-e2e`, `development-session-e2e`, `kill-matrix`; rows 9, 10 and 11 ran them), the same as 09; transcriber 3 (host-conditional); development-session e2e 2 (above).

Note 144's list of db files that boot a development-capture Core and were not yet run (`session-capture.db.test.ts`, `recover-failed-seal.db.test.ts`, `export-restart.db.test.ts`, `volume-at-boot.db.test.ts`, `lane-camera-stub.db.test.ts`, three `engine/__tests__` restart files) is inside the db run of row 5, which had 0 failures (the reporter prints passing files only as a count; they are not listed one by one). The manifest's `tracks[].profile` now stating `H264_720P30` (139, 144) broke no assertion in rows 9, 10 or 11: all three green with no pin to move. The seal e2e's output JSON files (facts, verify reports) carry no `profile` member, so I did not read the value itself from them. Row 5 closing lines: `forced drops that needed a retry: 0`; `teardown: dropped 8 database(s) in 144 ms; 0 remain`. No "remaining connection slots" error.

## Red list (full)

### RED 1: `apps/core-server/src/db/fixtures/__tests__/audit-details.test.ts` (core-server unit project), one test

Test: `every audit row of the fixture > an engine-written row has a key set, values of a kind, and a severity that the shared simulator writes for that type`. Red in the whole run (row 4) and again, identically, alone (row 4r, 1 s).

```
AssertionError: expected [ …(92) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "row EVIDENCE_VERIFIED (sequence 137): keys {failedTracks, manifestOk, signatureOk}; the simulator writes {failedTracks, manifestOk, operationId, signatureOk}",
+   "row EVIDENCE_VERIFIED (sequence 158): keys {failedTracks, manifestOk, signatureOk}; the simulator writes {failedTracks, manifestOk, operationId, signatureOk}",
+   "row EVIDENCE_VERIFIED (sequence 173): keys {failedTracks, manifestOk, signatureOk}; the simulator writes {failedTracks, manifestOk, operationId, signatureOk}",
+   "row EVIDENCE_VERIFY_FAILED (sequence 181): keys {eventKind, failedTracks, manifestOk, signatureOk}; the simulator writes {eventKind, failedTracks, manifestOk, operationId, signatureOk}",
+   "row EVIDENCE_VERIFIED (sequence 220): keys {failedTracks, manifestOk, signatureOk}; the simulator writes {failedTracks, manifestOk, operationId, signatureOk}",
+   "row EVIDENCE_VERIFIED (sequence 267): keys {failedTracks, manifestOk, signatureOk}; the simulator writes {failedTracks, manifestOk, operationId, signatureOk}",
   ... (92 findings in all; each reads EVIDENCE_VERIFIED or EVIDENCE_VERIFY_FAILED, sequences 137 to 3322 and beyond)
 ❯ src/db/fixtures/__tests__/audit-details.test.ts:237:45
    237|     expect(simulatorFindings(rows, shapes)).toEqual([]);
    238|     expect(simulatorFindings(variant.rows, shapes)).toEqual([]);
```

I checked the whole list: all 92 findings are the single difference "the simulator writes `operationId`, the fixture row lacks it"; no other key or severity differs. The first lines above are the first 6 of the 92 as printed; the remainder are the same shape.

Reading: the test compares the audit rows the fixture builds (`apps/core-server/src/db/fixtures/recordings.ts`, the only file there that names `EVIDENCE_VERIFIED`) with the key sets the shared simulator writes. The simulator now writes `details.operationId: 'verifyEvidence'` on its verify rows (`packages/shared/src/sim/evidence-actions.ts:121`). That is the fix G89b-04 / D216 (2) / D222 (3) of **note 140 (S2)**, which says in section 7 decision 3 "`operationId` is on the simulator's own verify row too: one detail key more on those rows". Neither the fixture builder nor the test is in `git status`; 140's section 5 expected core-server unit "green except S1's two pins" and did not name this file. **Owner: 140 S2 (revisions / audit / export).** My reading: a stale fixture for a ruled change, not a product defect; the expected value is S2's to decide (the fixture rows gain `operationId`, or the comparison learns that key). The db, core-web and mobile suites have no red on a verify row.

### RED 2: `apps/mobile/src/navigation/__tests__/navigation-units.test.ts` (mobile jest), one test

Test: `registries > registers one i18n tree per feature folder with a screen, plus the shell copy`. Red in the whole run (row 7) and again, identically, alone (row 7r: 1 failed, 39 passed).

```
expect(received).toEqual(expected) // deep equality

- Expected  - 0
+ Received  + 1

@@ -2,10 +2,11 @@
    "audit",
    "capture-selector",
    "dashboard",
    "devices",
    "evidence",
+   "evidence-player",
    "login",
    "more",
    "navigation",
    "network-time",
    "pairing",

  197 |   it('registers one i18n tree per feature folder with a screen, plus the shell copy', () => {
  198 |     const folders = [...new Set(ROUTE_SCREENS.map((r) => r.folder).filter((f) => f !== 'home'))].sort();
> 199 |     expect(Object.keys(FEATURE_RESOURCES).sort()).toEqual([...folders, 'capture-selector', 'navigation', 'transcription'].sort());
      |                                                   ^
  200 |   });

  at Object.toEqual (src/navigation/__tests__/navigation-units.test.ts:199:51)
```

Reading: the test pins the keys of `FEATURE_RESOURCES` (`apps/mobile/src/i18n/features.ts`) to the route folders plus three named extras. `git diff` of `features.ts` adds `import { sealedPlayerEn } from '@/features/evidence/sealed-player-i18n'` and the key `'evidence-player': sealedPlayerEn` (+2 lines). **Owner: 142 M1**, whose file table (line 118) lists "NEW `features/evidence/sealed-player-i18n.ts`, `i18n/features.ts` (+1 entry)" for the no-seek sentence (G94b-01). M1's attribution run (note 142 line 268) ran `session-summary`, `layout`, `motion`, `i18n` and the evidence tests but not `src/navigation/__tests__`, so this pin was not reached. The test file is not in `git status`. My reading: a stale allow-list after an intended change (a new i18n tree), not a product defect; the pin must gain `'evidence-player'` among the named extras, which is M1's decision. It is not one of decisions D220..D225 by itself, but it follows from D223/D224 ruling (1) (the tablet player's seek sentence).

## Deltas of the counts against 09 (wave I)

| suite | 09 files / tests | 10 files / tests | delta |
|-------|------------------|------------------|-------|
| shared | 116 / 2570 | 119 / 2587 | +3 files, +17 tests |
| core-server unit | 338 / 6517 | 349 / 6631 (348 files passed, 1 failed; 6630 passed, 1 failed) | +11 files, +114 tests |
| core-server db (files / tests) | 193 (188 passed, 2 failed, 3 skipped) / 2429 (2419 passed, 3 failed, 7 skipped) | 195 (192 passed, 3 skipped) / 2440 (2433 passed, 7 skipped) | +2 files, +11 tests (+14 passed, the 3 reds of 09 are green); skipped unchanged |
| core-web | 176 / 2069 | 180 / 2136 | +4 files, +67 tests |
| mobile | 287 (286 passed, 1 failed) / 2693 (2692 passed, 1 failed) | 300 (299 passed, 1 failed) / 2809 (2808 passed, 1 failed) | +13 suites, +116 tests |
| transcriber | 20 / 564 (561 passed, 3 skipped) | 20 / 567 (564 passed, 3 skipped) | +3 tests |
| mock-core | 4 / 19 | 4 / 19 | none |
| capture-protocol | 1 / 31 | 1 / 31 | none |
| kill matrix | 35 of 35 | 35 of 35 | none |
| seal e2e | 3 | 3 | none |
| development-session e2e (generated) | 2 passed, 2 skipped | 2 passed, 2 skipped | none |
| contract guards | shared 66, db 38 | shared 66, db 38 | none |
| OpenAPI | 97 ops (36 GET / 61 POST), 67 audit types, schema 6 / dbc-7 | the same | none |

The three 09 reds (`test/acceptance/pairing-lifecycle.test.ts` x2, `src/engine/__tests__/commands.db.test.ts`, `apps/mobile/src/runtime/pending-control.test.tsx`) are all green now. The db run here has no red file. I did not map the per-file deltas of the new tests to the notes' claims; the per-suite totals above are the facts.

## Notes

- Raw logs: session scratchpad only (`.../scratchpad/wk/`), not in git. Files left behind by the tests' own design and ignored by git: `.cache/waveK/seal-e2e/` (4 JSON files: 2 verify reports, 2 facts files), `.cache/kill-matrix/*.json` (218 files in total after this run), `.data/test-row61-wavek_s1_restart-*` fixture directories (three were present at the end; I did not look into whether this run or an earlier one made each). Deleted nothing.
- `pgrep` inside the sandbox fails ("Cannot get process list"); the final empty check was made outside the sandbox.
- The kill matrix ids were taken from `run.sh --list` by filtering out the lines whose second column is `PARKED` (35 left); the launch was correct the first time, no check ran twice except the two reds.
## Status

complete; overall RED: 2 failing tests in 2 files (1 core-server unit, 1 mobile), both deterministic on re-run, both stale pins after an intended wave K change (owners: 140 S2 x 1, 142 M1 x 1). 139 S1, 141 W, 143 M2, 144 KR, 145 Z1, 146 Z2: no red attributed. The heavy checks (seal e2e 3, kill matrix 35 of 35, development-session e2e 2) and the contract guards are green.

---
*Generated: 2026-10-11 03:15 WIB*
