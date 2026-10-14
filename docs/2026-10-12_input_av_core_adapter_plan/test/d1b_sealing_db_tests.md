# Row D1b - the sealing database test files after row D1 (wave 12, 2026-10-14) - Tier 3

Runner only; no source or test file changed. Tree: uncommitted, branch task4/input-av-core-port, on 1fbeada7.
Row D1's change under test: `apps/core-server/src/sealing/pipeline/pipeline.ts` (`durableEndOf`, two call sites).

## Files (every `*.db.test.ts` under `apps/core-server/src/sealing/`)
1. src/sealing/__tests__/production-key-proof.db.test.ts
2. src/sealing/__tests__/stt-states.db.test.ts
3. src/sealing/__tests__/finalize-transcript.db.test.ts
4. src/sealing/__tests__/last-resort.db.test.ts
5. src/sealing/__tests__/kill-matrix/kill-matrix.db.test.ts (a runner check: `describe.skipIf(ASKED.length === 0)`, skipped unless `DEMS_KILL_MATRIX` names cells; it starts Core processes and needs the heavy-host lock - not run by design)

## Command (sandbox off for PostgreSQL on 127.0.0.1:4432; `.locks/db-migrate.lock` only)
`(ulimit -c 0; /usr/bin/lockf -k -t 1800 .locks/db-migrate.lock sh -c 'cd apps/core-server && npx vitest run --project db --maxWorkers=2 <the five files>')`
The heavy-host lock was not taken: none of the four runnable files starts the worker, a relay or a container (production-key-proof uses stand-in programs only); another session held the heavy-host lock at the time.

## Result lines
Run 1 (exit 0): `Test Files  4 passed | 1 skipped (5)`, `Tests  29 passed (29)`; `teardown: dropped 2 database(s) in 47 ms; 0 remain with the run prefix dems_test_local_tmvo6cv8_`.
Run 2 (the same command plus `--reporter=verbose`, only to obtain per-file counts; not a flake check): exit 0, same totals; `0 remain with the run prefix dems_test_local_tmvo6pie_`.

| File | Passed | Failed | Skipped |
|---|---|---|---|
| production-key-proof.db.test.ts | 4 | 0 | 0 |
| stt-states.db.test.ts | 5 | 0 | 0 |
| finalize-transcript.db.test.ts | 17 | 0 | 0 |
| last-resort.db.test.ts | 3 | 0 | 0 |
| kill-matrix/kill-matrix.db.test.ts | 0 | 0 | whole file (no cell named) |
| Total | 29 | 0 | 1 file |

Reds: none. Load errors naming another file: none.

## Notes
- `git diff -- apps/core-server/src/sealing/` also shows three of these db test files edited (schema pin 13/dbc-14 -> 14/dbc-15, not row D1's); they pass against the current schema.
- Not covered: the pipeline change was not exercised by a database file that seals an INTERRUPTED recording (none of the four does); its proof stays the unit test `pipeline.test.ts` (D1 case) and the end-to-end of d1_seal_write_failed_diagnosis.md.
- Nothing left running; no lock held.
