---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: coder-execution (tier R)
blueprint_row: 25 (plan W03, npm slot N1)
date: 2026-10-04
status: needs-review
evidence_tier: 3
---

# coder-execution progress: step 25 (W03, npm slot N1)

Status: **needs-review**, on one verification check only (check 3, the install-script list).
All deliverables exist; the six other checks pass. Nothing blocks W07, W08 or W09 technically.

Output document: `implementation/03_npm_slot_n1_server_shared.md` (evidence for every line below).

## Files created or updated

Workspace (the owned write paths of W03):

- `.gitignore` (append: `/.data/`)
- `package.json` (15 scripts, 2 dev dependencies, 1 `allowScripts` entry)
- `package-lock.json` (102 entries added, 0 removed, 0 existing entries changed)
- `packages/shared/package.json` (4 export subpaths)
- `apps/core-server/package.json`, `tsconfig.json`, `vitest.config.ts`, `src/version.ts`, `src/version.test.ts` (new)
- `packages/shared/src/client/index.ts`, `src/live/index.ts`, `src/live/source/index.ts`, `src/live/testing/index.ts` (new, one line each)

Git-ignored: `.cache/rollback/W03.pre.patch` (P23; empty).

Task folder:

- `implementation/03_npm_slot_n1_server_shared.md`
- `delegation_progress/coder_execution_step_25.md` (this file)

Not written (parallel run): `status_tasks.md`, `delegation_progress_report.md`,
`decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md`.

## Milestones

| Time (WIB) | Milestone |
|---|---|
| 06:33 | `/.data/` in `.gitignore`; `git check-ignore -v` matches `.data/postgres` and the three credential files |
| 06:35:40 to 06:35:56 | **Install window.** `npm install --ignore-scripts` (47 packages, exit 0), then `npm install --save-dev --save-exact --ignore-scripts @types/pg@8 -w @dems/core-server` (1 package, exit 0); both under `.locks/npm.lock` |
| 06:36 | Install script and symlink list read, hashed and checked (17 entries, all inside `native/lib/`); `@embedded-postgres/darwin-arm64@18.4.0-beta.17` approved by exact name |
| 06:36:43 to 06:36:44 | `npm rebuild @embedded-postgres/darwin-arm64`: 0 symlinks before, 17 after; `libicudata.77.dylib` exists (T1) |
| 06:37 | `npm audit signatures`: 1,719 of 1,719 verified, 0 invalid, 0 missing. `npm audit`: 80 entries (4 new moderate, 76 on predecessor packages) |
| 06:39 to 06:40 | Root typecheck exit 0; root lint exit 0; `@dems/core-server` unit: 1 passed in 1 file; `@dems/shared`: 508 passed in 28 files |
| 06:43 | Final check: five hashes unchanged, npm lock free, `git status` holds only the owned paths plus other rows' files |

## Verification summary

| # | Check | Result |
|---|---|---|
| 1 | `npm install` exits 0 | PASS |
| 2 | Lockfile diff holds only slot N1 and its dependencies; no existing package changed | PASS (`@types/pg` 8.23.1, MIT) |
| 3 | `npm install-scripts ls` prints no unreviewed script | **NOT MET as written**: 7 listed, none approved (5 from the baseline, 2 new from `drizzle-kit`). The one approval is in place |
| 4 | One copy of React and React DOM | PASS (19.2.3) |
| 5 | Typecheck, lint, core-server unit, shared 508 | PASS |
| 6 | `git status --porcelain` | PASS |
| 7 | Test ledger | `@dems/core-server` `unit` +1 test in `src/version.test.ts`; `db` 0; `@dems/shared` 508 in 28 files, unchanged |

PostgreSQL was not started, `initdb` was not run, `.data/` does not exist. `postgres --version`,
`initdb --version` and `pg_ctl --version` each print 18.4.

## SU-1 values owed by W03

| File | SHA-256 |
|---|---|
| `scripts/hydrate-symlinks.js` | `3596fdda55321a3672bd77bcaecf00d46462914409346ccfa1932a19c5977e11` |
| `native/pg-symlinks.json` | `badbb4ed4901bcdc87c47e2f0e57778289e1e481bf7baf33e422e240a6e33e67` |

The three binaries' hashes (W07's record) are also in the output document, section 7.2.

## Findings (for F-n)

1. `@types/pg` resolved to 8.23.1 (MIT); closes GP-01.
2. `npm rebuild <package>` runs an approved install script on npm 11.19.1. AS-09 is confirmed for `rebuild` only, because the install ran with `--ignore-scripts`.
3. `embedded-postgres` and its platform package: registry signature verified, no provenance attestation (closes G-05).
4. The registry is unreachable inside the sandbox (E502 through the proxy); lookups, installs and audits need the per-command bypass. No `sudo`, no `chown`.
5. `npm install-scripts ls` listed 5 packages at the baseline already (`esbuild@0.28.2`, `unrs-resolver@1.12.2`, `vue-demi@0.14.10` three times).
6. `drizzle-kit` 0.31.11 brings two nested `esbuild` copies with an install script (0.25.12, 0.18.20), two deprecated packages and one moderate advisory (GHSA-67mh-4wv8-2f99 on esbuild 0.18.20). Both copies work with the script skipped; `drizzle-kit --version` prints 0.31.11.
7. `npm audit` shows 76 entries (50 high) on packages installed by the predecessor task, whose security verification recorded "1 high". Not caused by this row (0 existing lockfile entries changed); not investigated here.
8. One transitive BSD-3-Clause package: `fast-uri` 3.1.8.
9. The default `git diff --stat` overstates the lockfile change; `--minimal` shows 1,729 insertions and 0 deletions.
10. `node --test scripts/pg/` (directory form) works on Node 26.8.2.

## Deviations (for DR-n)

1. `--ignore-scripts` on both install commands, so that nothing could run before the review.
2. Two install commands (the second pins `@types/pg` with `--save-exact`), one 16-second window.
3. The install script is described statement by statement and pinned by SHA-256, not copied verbatim (third-party source); the symlink list is given in full.
4. Check 3 not met as written.
5. `.cache/rollback/W03.pre.patch` written under P23 (not in the row's path list).

## Decisions needed (for D-n)

1. **DN-1.** The 7 unapproved install scripts: (A) deny by name in an npm slot (`npm install-scripts deny esbuild unrs-resolver vue-demi`), or (B) accept the list as reviewed and unapproved. Not approval: the `esbuild` script can start processes and reach the registry.
2. **DN-2.** Accept the moderate advisory on the nested `esbuild` 0.18.20 (development tool only), or record otherwise.
3. **DN-3.** Route the 76 predecessor audit entries to the security row (W99).
4. **DN-4.** Entry paths fixed by this row, to pass on: `src/index.ts` (W08); `src/db/commands/create.ts`, `migrate.ts`, `status.ts` and `drizzle.config.ts` (W17); `src/db/seed/cli.ts` (W20); `src/db/reset/cli.ts` (W29); `test/global-setup.db.ts` (W11).
5. **DN-5.** `fast-uri` (BSD-3-Clause) for the notices row (W85).

## Blockers

None.
