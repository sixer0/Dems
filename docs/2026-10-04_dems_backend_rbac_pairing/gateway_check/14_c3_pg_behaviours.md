---
row: C3 (C2-R1)
agent: coder-execution
date: 2026-10-07
status: complete
narrative_tier: 3
---

# C3: pg-behaviours.db.test.ts on the terse cluster (C2-R1)

status: complete. The adapted file is green on the W90 cluster (7/7). The full `npm run test:db` is green (124 files, 1,751 tests, exit 0). core-server typecheck and lint exit 0. Three mutants each fail their own test only.

## 1. What changed

One file: `apps/core-server/test/db/pg-behaviours.db.test.ts` (278 to 310 lines; `git diff --stat`: 108 insertions, 76 deletions). No helper was needed. Lines 1-107 are unchanged apart from the header and one import.

| Where | Before | After |
|---|---|---|
| Header `:1-12` | Said the log check reads `.data/postgres.log` | Names the collector file `.data/postgres/log/postgresql-HH.log` (0600), `current_logfiles`, the hour boundary, and that only counts are printed |
| Import `:14` | `closeSync, openSync, readSync, statSync` | adds `readFileSync` (for `current_logfiles`) |
| `describe` `:118` | `logFile()` = `join(dataDir, 'postgres.log')` | `currentLogFile()` (`:124-131`) reads the `stderr ` line of `.data/postgres/current_logfiles` and resolves it against `.data/postgres`. `mark()` stores file and offset (`:138-141`). `readFrom(start)` (`:157-160`) reads the rest of the first file and, if the hour turned, the new file from 0. `appended()` now takes a predicate |
| Settings pin `:172-189` (was `:138-156`) | `log_error_verbosity` `'default'`; refused `SET log_error_verbosity = terse` | `'terse'`; the refused SETs are `verbose` and `default` (no project role can bring DETAIL back) |
| Log check `:192-309` (was `:158-277`) | Findings: DETAIL lines carry the key value (`:242-260`), `Failing row contains` (`:247-254`), FK DETAIL (`:262`) | Inverted. Over the window: 0 `DETAIL:` lines, 0 `Failing row contains`, 0 `Key (` lines, 0 lines with this test's hash markers, `OPR-777` absent. Each of the 7 tagged STATEMENT lines comes right after its own ERROR line (same `[pid]`), and the 7 ERROR messages are exactly the 7 expected constraint/table texts. The FK ERROR names `auth_sessions_operator_id_fkey`. The `pg_ctl -l` file gets 0 tagged lines. Kept: secret absent, 7 STATEMENT lines with placeholders only (W90 F-4), bind marker absent, file mode 0600 (plus `current_logfiles` 0600, file name `log/postgresql-NN.log`), credential row unchanged |
| `console.info` | Printed up to 170 characters of each DETAIL line | Prints counts and the relative file name only |

The DETAIL counts cover the whole window, not only this test's lines. That is valid because no role on this cluster can raise the verbosity (the settings test proves `SET log_error_verbosity` is refused for both roles).

## 2. Evidence

| Check | Command (sandbox off, local TCP) | Result | Asset |
|---|---|---|---|
| Load | `uptime` | 4.27 at the start, 5.96 before the suite. Below the pause threshold of 14 | — |
| Single file | `npx vitest run --project db test/db/pg-behaviours.db.test.ts` | 1 file, 7 passed, exit 0 (ran twice: once at 05:40:58, once to save the asset) | `assets/14_c3_single_file.txt` |
| Mutants | 3 copies `test/db/zz_c3_mutant_m{1,2,3}.db.test.ts`, run together, then deleted (0 left) | 3 failed, 18 passed, exit 1 | `assets/14_c3_mutants.txt` |
| Full db suite | `npm run test:db` (once) | 124 files, 1,751 tests passed, exit 0, 137 s; teardown 0 databases left with the run prefix | `assets/14_c3_test_db.txt` |
| Typecheck, lint | `npm run typecheck`, `npm run lint` (core-server) | exit 0, exit 0 | `assets/14_c3_typecheck_lint.txt` |
| Leak scan | `grep -c "ses_w17\|DETAIL:  Key\|pg.pwfile\|PGPASSWORD"` over the suite output | 0 | — |

What the mutants changed, and how each one failed:

| Mutant | Change | Failure |
|---|---|---|
| m1 | Settings pin expects `'default'` again | Settings test: `expected [...] to deeply equal [...]` |
| m2 | `currentLogFile()` returns `.data/postgres.log` (the old file) | Log test: the file name `log` does not match `/^log\/postgresql-\d{2}\.log$/` |
| m3 | Expects 1 DETAIL line (the old finding) | Log test: `expected [] to have a length of 1 but got +0`, so the window really has 0 DETAIL lines |

## 3. Rollback

- Before-image: `.cache/rollback/C3/apps/core-server/test/db/pg-behaviours.db.test.ts.pre`. Its SHA-256 is `978a4438...44495f6` (`C3.pre.sha256`) and it matched HEAD (no diff before the change).
- After the change: `783013da820ef17105877b41761c3fff4f3504115283911b06ce928c218c1f3b` (`C3.post.sha256`).
- To roll back: `cp .cache/rollback/C3/apps/core-server/test/db/pg-behaviours.db.test.ts.pre apps/core-server/test/db/pg-behaviours.db.test.ts`.

## 4. Boundaries, notes

- Only the repo's test helper was used, against 127.0.0.1:4432 with `dems_test_*` clones. Host *:5432 was not touched. The credential files were not printed, staged or passed as arguments. Log contents were not printed. The only file read outside the existing log was `current_logfiles`, which holds one path line.
- No Core server, Vite, Metro or emulator was started. No commit was made. The only files deleted were the three mutant copies this row created. The untracked `apps/core-server/test/acceptance/devices-live.test.ts` was there before this row and was not touched.
- Note (Info): vitest does not show the `[w17]` `console.info` line for a passing test in these runs. The old version behaved the same way. The assertions are the evidence, not the line.
- An hour boundary was not exercised: every run fell inside hour 05. The two-segment read is a straight concatenation. With `log_truncate_on_rotation = on`, the new hour file starts empty.
- Residuals: none for this row. W90 F-4 (one `STATEMENT:` line per error) is pinned here as 7 placeholder-only lines and stays with W100/W102.
