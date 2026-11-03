# R-FLEX code wave rules (W-g onward), 2026-10-22 — every code brief points here

Repo /Users/gsp-budi/Documents/DEMS, branch task4/input-av-core-port, HEAD e05a1567 with 22 uncommitted task-4 changes + untracked files (restore point: .data/rflex-restore-20261022, row 80). R-FLEX edits land ON TOP of that working tree.

## Ownership and the shared tree
1. FIRST ACT: append the exact paths you will write to delegation_progress/file_claims.md as `row N | path | new|edit`. Then re-read the file: if another row of this wave claims the same path, STOP that path and write a line to delegation_progress/file_requests.md; continue with the rest.
2. Write ONLY inside your row's Ownership Area (blueprint Execution Profile). Everything else is read-only. A change you need elsewhere: one line in file_requests.md (`row N | path | exact change | blocking yes/no`) and continue behind a seam.
3. Shared files (packages/shared/src/api/index.ts, i18n catalogues, audit word lists, openapi.json, static pin tests): Edit tool only, one small additive edit after re-reading; count pins move by delta; never a whole-file rewrite or a scripted replace (no sed -i, no codegen over the file unless your row IS the generator row).
4. Uncommitted task-4 changes in files you own are NOT yours to revert or "clean up". Edit around them.
5. No git writes at all (no add/commit/stash/checkout/reset/restore). No package installs (npm i, brew). No lockfile change.

## Tests and load
6. Run only your row's targeted tests + your workspace's typecheck: `npx vitest run <files> --maxWorkers=2` inside the workspace (core-server unit: `npm test -w @dems/core-server -- <files> --maxWorkers=2`; db tests: `npm run test:db -w @dems/core-server -- <files> --maxWorkers=2`), `npm run typecheck -w <workspace>`. Never the full suites, never test:regression (row 115 does that).
7. DB tests hold the db-runner lock: prefix with `/usr/bin/lockf -k /Users/gsp-budi/Documents/DEMS/.data/locks/db-runner.lock`. Typecheck of core-server holds `/Users/gsp-budi/Documents/DEMS/.data/locks/heavy-host.lock` the same way.
8. A red test or typecheck in a file you do not own, caused by another row landing in parallel: do not fix it; report the file and the error line. Your own red: fix it.
9. Test depth: one run if it passes; a second run only after a fix (feedback 2+1). Extend existing test files; a new test file only where the row text allows it.
10. Bash: stay at the repo root with absolute paths; commands that bind ports or start PostgreSQL may need dangerouslyDisableSandbox (the db global setup starts the project PostgreSQL on 127.0.0.1:4432).

## Report (short)
11. Write implementation/<your expected file> (what changed, file:line, test commands + their pass/fail counts verbatim) and delegation_progress/row_<N>_<agent>.md. Final reply: status, files touched (full list), test numbers, anything outside your area you touched or requested, deviations from the spec.
12. Names ONLY from masterplan/01_specs_rflex_register.md (incl. §11). Spec: masterplan/01_specs_rflex.md + the delta your row cites. User answers: decisions.md D16.
- (2026-10-22, after D22) Rule 3 reminder: a scripted replace on a shared file is a breach even if it touches the right lines; use the Edit tool.
