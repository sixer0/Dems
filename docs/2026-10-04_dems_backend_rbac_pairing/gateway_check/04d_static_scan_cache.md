# 04d - The static scan skips `.cache/` (finding F W3-3, decision D142)

- **Task:** DEMS Backend (Postgres), Integrated RBAC and Portal-Mobile Pairing
- **Date:** 2026-10-06, 00:05 to 00:09 WIB
- **Agent:** coder-execution
- **Status:** complete
- **Evidence tier:** 3 (the change, the test, the command outputs)
- **Files written:** `apps/core-server/test/static/scan.ts` (edited), `apps/core-server/test/static/scan-skips.test.ts` (new), this file, `delegation_progress/coder_execution_static_scan_cache.md`

## 1. Why

`implementation/11b_db_helper_forced_drop_retry.md` section 15.8 ("The stray artifact"): a test-runner JSON report written to `apps/core-server/.cache/` was read by the scanner of the static guards. `.cache/` is git-ignored (`.gitignore:47`), but `SKIPPED_DIRECTORIES` (`apps/core-server/test/static/scan.ts:19`) did not list it, so the report's one minified line (it carried the words of other rows' test names) turned two guards of `audit-protection.test.ts` red. W3-3 handed the durable fix to the controller; D142 chose the first option, adding `.cache` to the skipped set.

## 2. The change

Pre-image: `.cache/rollback/scan_cache/scan.ts.pre` (repository root, git-ignored), sha256 `89bef96d28a37509dc2cdf4106b2e873864dd1071d4697d1b72588fd5fa9c9db` (identical to the file before the edit; checked with `shasum -a 256`).

Post-image sha256 `6d53c8c8b2820924042e8f0f1779a4f65be95231c4e8e750b18a4ad217f779e6`.

`diff -u .cache/rollback/scan_cache/scan.ts.pre apps/core-server/test/static/scan.ts`:

```diff
@@ -15,7 +15,7 @@
 /** The workspace root of the repository. */
 export const REPOSITORY = resolve(WORKSPACE, '..', '..');
 
-/** Never read: dependencies, build output, generated native projects, caches, logs, media. */
+/** Never read: dependencies, build output, generated native projects, caches (also `.cache/`, git-ignored scratch), logs, media. */
 const SKIPPED_DIRECTORIES = new Set([
   'node_modules',
   'coverage',
@@ -29,6 +29,7 @@
   '.turbo',
   '.expo',
   '.gradle',
+  '.cache',
   '.git',
 ]);
```

One entry added, one comment line reworded; nothing else in the file changed (`git status` shows `M apps/core-server/test/static/scan.ts`, `?? apps/core-server/test/static/scan-skips.test.ts` under `apps/core-server`, no other path).

### 2.1 `.locks` and `.data`: left out, on evidence

`.locks/` and `.data/` live at the repository root only (`.gitignore:59` `.locks/`, `.gitignore:70` `/.data/`, anchored; both exist at `/Users/gsp-budi/Documents/DEMS/.locks` and `.../.data`). The scanner can reach the repository root only if some caller reads it. Every call of `readTree` under `apps/core-server` (`grep -rhn "readTree(" apps/core-server --include='*.ts'`, 30 call lines in 29 files, the definition and the new test excluded) passes one of three roots:

| Root | Callers | Contains `.locks` / `.data`? |
|------|---------|------------------------------|
| `readTree(WORKSPACE)` = `apps/core-server` | every guard and every folder static test (29 lines) | No: `ls -a apps/core-server` shows `.cache drizzle.config.ts node_modules package.json src test tsconfig.json vitest.config.ts` |
| `readTree(join(REPOSITORY, 'apps'))` | `test/static/credentials.test.ts:41` | No: `find apps packages -maxdepth 3 \( -name .cache -o -name .locks -o -name .data \) -not -path '*/node_modules/*'` printed only `apps/core-server/.cache` |
| `readTree(join(REPOSITORY, 'packages'))` | same line | No (same `find`) |

No call reads `REPOSITORY` itself, so the scan cannot reach the root and neither folder is added. If a later guard reads the repository root, `.locks` and `.data` (which holds the database cluster and the credential files) must be added in that change.

The `find` result also shows that `.cache` occurs once below a scanned root today (`apps/core-server/.cache`, the W3-3 location); the repository-root `.cache/` (checkpoint rounds) is outside every scanned root and was never read.

## 3. The test

New file `apps/core-server/test/static/scan-skips.test.ts` (66 lines, sha256 `df6562fae48272794bd6251dc64578ab06a72df064dcba6395c9ec62015d9840`). No existing static test file tests `scan.ts` itself, hence a new file. `readTree(root)` takes a root argument, so the real scanner is run over a real tree (the exported set is not needed; `SKIPPED_DIRECTORIES` is not exported and was not made so).

- The tree is built with `mkdtempSync(join(tmpdir(), 'dems-scan-skips-'))` (under `$TMPDIR`, never in the repository) and removed in `afterAll`; `ls $TMPDIR | grep -c dems-scan-skips` printed `0` after the runs.
- The forbidden fragment is built from pieces (`['DROP', 'DATABASE'].join(' ')`), so the file does not contain it.
- Files planted: `src/normal.ts` (clean), `src/planted.ts` (fragment: positive control, in a folder that is read), `.cache/x.ts`, `.cache/report.json`, `.cache/deep/z.sql`, `src/nested/.cache/y.ts` (all with the fragment).

| Test | Proves |
|------|--------|
| builds its tree outside the repository | the root starts with `tmpdir()` and does not contain `apps/core-server` |
| lists the files of the folders it reads (positive control) | `src/normal.ts` and `src/planted.ts` are read |
| reads no file inside a .cache folder, at the top or nested | no returned path has a `.cache` segment |
| reports the planted text in the folder that is read, and not in .cache | `occurrences(readTree(root), literal(FORBIDDEN))` equals `['src/planted.ts:1']` |

### 3.1 Red before the edit

Run before `scan.ts` was touched (`npm run test -w @dems/core-server -- --maxWorkers=2 test/static/scan-skips.test.ts`):

```
 FAIL  |unit| test/static/scan-skips.test.ts > the scanner does not read a .cache folder (W3-3) > reports the planted text in the folder that is read, and not in .cache
- Expected
+ Received
  [
+   ".cache/deep/z.sql:1",
+   ".cache/report.json:1",
+   ".cache/x.ts:1",
+   "src/nested/.cache/y.ts:1",
    "src/planted.ts:1",
  ]
 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)
```

The same two tests (the path list and the occurrences) fail without the entry; the two controls pass. So the test is not vacuous and it detects removal of the entry.

## 4. Verification (green after the edit)

Load before the unit run: `uptime` printed `0:07  2 users, load averages: 5.28 5.58 5.86` (under 10). Each command was run with its output in a file and `echo "EXIT $?"` directly after it. The lines `ERROR: failed to copy trust settings of system certificate-NNNN` that the sandbox prints on every command were filtered out of the quotes below; they are noise of the environment and do not change an exit code.

| # | Command (from the repository root, no `cd`) | Exit | Last lines |
|---|---------------------------------------------|------|------------|
| 1 | `npm run test -w @dems/core-server -- --maxWorkers=2 test/static` | 0 | `Test Files  12 passed (12)` / `Tests  129 passed (129)` / `Duration  762ms` |
| 2 | `npm run test -w @dems/core-server -- --maxWorkers=2` (whole `unit` project) | 0 | `Test Files  154 passed (154)` / `Tests  3916 passed (3916)` / `Duration  27.46s` |
| 3 | `npm run typecheck -w @dems/core-server` | 0 | `> tsc --noEmit` (no output after it) |
| 4 | `npm run lint -w @dems/core-server` | 0 | `> oxlint` (no output after it; oxlint prints nothing when it finds nothing) |

Ledger against the baseline (11b section 15.9: unit 153 files / 3,912 tests): 154 / 3,916 = +1 file, +4 tests, exactly the new file. At or above the required floor.

## 5. Not done, on purpose

- No database command, no git write, no `cd`, no `timeout`.
- The W3-3 scenario itself (a real stray file in `apps/core-server/.cache/`) was not recreated: that folder is outside the rows this change may write, and the temporary-directory test exercises the same code path (`walk`'s directory check) with the same folder name.
- D30's alternative (a json report's `--outputFile` must point at the repository-root `.cache/`) is a convention for the test runners, not a scanner change; it is not made here.

*Generated: 2026-10-06 00:09*
