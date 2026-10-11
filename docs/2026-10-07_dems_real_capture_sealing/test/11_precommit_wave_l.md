# Pre-commit whole run, wave L (2026-10-11)

Runner: test-runner agent (decision D122). Tree: commit `b05106b` plus the uncommitted work of fix 151 and fix wave L (209 entries in `git status --short` at the start and at the end: nothing changed under me). Procedure: `test/10_precommit_wave_k.md`, plus the checks listed under "Checks for the test runner" in notes 151 (section 8), 153 (section 5), 154 (section 7), 155 (section 3), 156 (section 9) and 157 (its closing line: whole shared, core-web and mobile suites). Sequential, from the repo root; sandbox off for everything that binds loopback, talks to PostgreSQL or signals a process (unit, db, web, transcriber, mock-core, seal e2e, kill matrix, development e2e, guard 12b, lane stop); typecheck, lint, shared, capture-protocol, mobile and guard 12a ran inside the sandbox. `env | grep ^DEMS_` printed nothing at the start; the only flags set were `DEMS_SEAL_E2E=1` (+ `DEMS_SEAL_E2E_OUT`), `DEMS_KILL_MATRIX` (set by `run.sh`) and `DEMS_DEV_SESSION_E2E=1`, each on its own command. No product file and no test file changed; no git write; no install. No local device selected, no `DEMS_*_ATTENDED`, no `.data/pg*.env` read, no port 5173-5175 / 8000 / 5432, no audio played. Metro and both emulators untouched.

Step 0: `scripts/lane/lane.sh stop 1` answered "lane 1 stopped (was PID 85523); port 4421 is free"; `scripts/lane/lane.sh stop 2` answered "lane 2 stopped (was PID 86337); port 4422 is free" (both outside the sandbox, not piped). Nothing was reset; lane 2's database and data are as they were. At the end `lane.sh status`: main, 1, 2, 3 all `stopped`; `pgrep -fl 'capture-worker|ffmpeg|whisper'` empty (rc 1). No lane was started.

Load (1-minute): 2 to 6 at every start. It rose to 24 at the end of the core-web run (row 6); I waited (to 4.9, about 2.5 minutes) before the mobile run, which then ran alone at load 4 to 6 and did not time out.

## Result: GREEN overall, 0 reds; every check ran once, so nothing needed a second run

| # | check | command | result | counts (files / tests) | duration |
|---|-------|---------|--------|------------------------|----------|
| 1a-g | typecheck x 7 | `npm run typecheck -w @dems/<ws>` (shared, core-server, core-web, mobile, capture-protocol, transcriber, mock-core) | GREEN, exit 0 x 7 | 0 `error TS` in each | 3 / 8 / 12 / 5 / 1 / 1 / 2 s |
| 2a-g | lint x 7 | `npm run lint -w @dems/<ws>` | GREEN, exit 0 x 7 | 0 errors; mobile (eslint) 1 warning, the known `src/runtime/log.test.ts:160:19 @typescript-eslint/array-type`; six oxlint workspaces silent | 0 / 0 / 0 / 15 / 0 / 0 / 0 s |
| 3 | shared | `npm run test -w @dems/shared` | GREEN | 121 files; 2612 passed / 0 failed | 5 s |
| 3b | capture-protocol | `npm run test -w @dems/capture-protocol` | GREEN | 1 file; 31 passed | 1 s |
| 4 | core-server unit | `npx vitest run --root apps/core-server --project unit --maxWorkers=4` | GREEN | 355 files; 6666 passed / 0 failed / 0 skipped | 68 s |
| 5 | core-server db | `/usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2` | GREEN | 196 files: 193 passed, 3 skipped; 2442 tests: 2435 passed, 7 skipped, 0 failed | 247 s |
| 6 | core-web | `npm run test -w @dems/core-web` | GREEN | 182 files; 2205 passed / 0 failed / 0 skipped | 123 s |
| 7 | mobile | `npx -w apps/mobile jest --maxWorkers=2` | GREEN | 311 suites passed; 2900 tests passed / 0 failed / 0 skipped | 223 s |
| 8a | transcriber | `npm run test -w @dems/transcriber` | GREEN | 20 files; 564 passed / 0 failed / 3 skipped (567) | 17 s |
| 8b | mock-core | `npm run test -w @dems/mock-core` | GREEN | 4 files; 19 passed | 4 s |
| 9 | seal e2e (built worker `apps/capture-worker/build/capture-worker`) | `DEMS_SEAL_E2E=1 DEMS_SEAL_E2E_OUT="$PWD/.cache/waveL/seal-e2e" lockf -k -t 3600 .locks/heavy-host.lock lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=1 src/sealing-host/__tests__/e2e/seal-e2e.db.test.ts` | GREEN | 1 file; 3 passed | 47 s |
| 10 | kill matrix, all 35 active cells in one call | `apps/core-server/src/sealing/__tests__/kill-matrix/run.sh` with 35 x `--only <id>` (ids from `run.sh --list`; the 10 PARKED cells excluded by design) | GREEN | 1 file; 35 passed / 0 failed; teardown "0 remain" | 590 s |
| 11 | development-session e2e, generated sources | `DEMS_DEV_SESSION_E2E=1 lockf -k -t 1800 .locks/heavy-host.lock lockf -k .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=1 src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts` | GREEN | 1 file; 2 passed, 2 skipped (speech case needs `DEMS_DEV_SPEECH_SESSION_E2E`; the attended case is the user's) | 17 s |
| 12a | contract guard, shared | `npx vitest run --root packages/shared test/api-registry.test.ts test/api-openapi-scope.test.ts` | GREEN | 2 files; 66 passed | 1 s |
| 12b | contract guard, db | `lockf db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=1 test/acceptance/contract.test.ts` | GREEN | 1 file; 38 passed | 16 s |
| 12c | totals read directly | `node -e` over `packages/shared/openapi/openapi.json`; `expect(AUDIT_TYPES).toHaveLength(67)` at `packages/shared/test/api-registry.test.ts:492`; `apps/core-server/src/db/schema/meta.ts:38,40` | GREEN | 97 operations: 36 GET / 61 POST / 0 other; 67 audit types (pinned, test 12a green); `DB_SCHEMA_VERSION = 6`, `DB_CONTRACT_REVISION = 'dbc-7'`, `meta.ts` not in `git status`. `openapi.json` itself is modified in the tree (still 97 operations) | - |

Skips: db 7 tests in 3 files (the env-gated runner checks `seal-e2e`, `development-session-e2e`, `kill-matrix`; rows 9, 10 and 11 ran them), the same as 10; transcriber 3 (host-conditional); development-session e2e 2 (above).

## Red list

None. No check failed, so no second run was made and there is nothing to attribute to 151, 153, 154, 155, 156 or 157, and no stale pin to report.

## Checks of the notes, read against this run

- Note 151 (manifest profile): seal e2e 3 of 3 and kill matrix 35 of 35 green, and `wave-k-s1-stream-profile.test.ts` (core-server unit, includes the `H264_720P30` cases at lines 95, 98, 166) is in the green unit run. No pin expecting a notice or a fraction under a `H264_720P30` selector failed. The seal e2e's output JSON files (`.cache/waveL/seal-e2e/`: 2 facts, 2 verify reports) carry no `profile` member and no `STREAM_PROFILE_DIFFERS` (grep count 0), so I did not read the manifest value itself from them; it is proven by the tests, not by me reading a manifest.
- Note 153 (L-S): shared, core-server unit and db green; core-web and mobile have no stale pin on `unsealableNoticeOf(...)`, the retry sentence or `files[]` without `profile`; seal e2e and kill matrix green after the `way-out.ts` change.
- Note 154 (L-W): core-web whole 182 files green, typecheck and lint clean, shared green.
- Note 155 (L-M): mobile whole green; typecheck clean; lint shows only the one known warning.
- Note 156 (L-Z): its expectations "mobile 310 suites green" and "core-web 182 files green" hold (mobile ran 311 suites, one more than the note's figure; all pass); unit, db, transcriber, mock-core, capture-protocol, kill matrix, seal e2e and development e2e all green.
- Note 157 (audio pair): shared, core-web and mobile whole suites green.
- The two reds of 10 (`src/db/fixtures/__tests__/audit-details.test.ts`, `apps/mobile/src/navigation/__tests__/navigation-units.test.ts`) are green now; both files are inside the unit and mobile runs above (this run's unit has 0 failed, mobile 0 failed). I did not look at how the fixture or the pin was changed.

## Deltas of the counts against 10 (wave K)

| suite | 10 files / tests | 11 files / tests | delta |
|-------|------------------|------------------|-------|
| shared | 119 / 2587 | 121 / 2612 | +2 files, +25 tests |
| core-server unit | 349 / 6631 (6630 passed, 1 failed) | 355 / 6666 (all passed) | +6 files, +35 tests (+36 passed; the 1 red of 10 is green) |
| core-server db (files / tests) | 195 (192 passed, 3 skipped) / 2440 (2433 passed, 7 skipped) | 196 (193 passed, 3 skipped) / 2442 (2435 passed, 7 skipped) | +1 file, +2 tests; skipped unchanged |
| core-web | 180 / 2136 | 182 / 2205 | +2 files, +69 tests |
| mobile | 300 (299 passed, 1 failed) / 2809 (2808 passed, 1 failed) | 311 (all passed) / 2900 (all passed) | +11 suites, +91 tests (+92 passed; the 1 red of 10 is green) |
| transcriber | 20 / 567 (564 passed, 3 skipped) | 20 / 567 (564 passed, 3 skipped) | none |
| mock-core | 4 / 19 | 4 / 19 | none |
| capture-protocol | 1 / 31 | 1 / 31 | none |
| kill matrix | 35 of 35 | 35 of 35 | none |
| seal e2e | 3 | 3 | none |
| development-session e2e (generated) | 2 passed, 2 skipped | 2 passed, 2 skipped | none |
| contract guards | shared 66, db 38 | shared 66, db 38 | none |
| OpenAPI | 97 ops (36 GET / 61 POST), 67 audit types, schema 6 / dbc-7 | the same | none |

I did not map the per-file deltas of the new tests to the notes' claims; the per-suite totals above are the facts.

## Notes

- Db run, closing lines: `forced drops that needed a retry: 2 (2 refusal(s) with SQLSTATE 42501 while a backend that the owner role may not end, such as an autovacuum worker, was on the database; each drop then went through)` (in 10 this was 0); `teardown: dropped 8 database(s) in 148 ms; 0 remain with the run prefix`. No "remaining connection slots" error. The kill matrix teardown: `dropped 2 database(s) in 44 ms; 0 remain`. The 2 retried drops are not a failure of any test.
- Mobile run ended with Jest's "A worker process has failed to exit gracefully and has been force exited" line (test-leak hint, not a failure); exit code 0, 311 of 311 suites passed. I did not check whether 10 printed the same line.
- Launch slip, no effect on any result: the first call of the kill matrix built its `--only` list as one string, which zsh does not split; `run.sh` answered "unknown argument" with exit 2 in 0 s and started nothing (no database, no worker). The second call, with an array of 70 words (35 x `--only <id>`), ran once and is the result in row 10.
- Raw logs: session scratchpad only (`.../scratchpad/wl/`), not in git. Files left behind by the tests' own design and ignored by git: `.cache/waveL/seal-e2e/` (4 JSON files: 2 verify reports, 2 facts files, session SES-20261011-0024), `.cache/kill-matrix/*.json`. Deleted nothing.
- `pgrep` inside the sandbox fails ("Cannot get process list"); the final empty check was made outside the sandbox.

## Status

complete; overall GREEN: 0 failing tests in any suite; the heavy checks (seal e2e 3, kill matrix 35 of 35, development-session e2e 2) and the contract guards are green. No owner note attributed (151, 153, 154, 155, 156, 157: no red).

---
*Generated: 2026-10-11 12:45 WIB*
