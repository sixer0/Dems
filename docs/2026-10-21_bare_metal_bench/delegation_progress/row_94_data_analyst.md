# Row 94 - data-analyst - R-FLEX impact analysis with test plan

Status: complete (2026-10-22). Docs only; repo read-only; no host, no git writes.

## Files
- research/03_analysis_rflex_impact.md (created)
- delegation_progress/file_requests.md (one request line appended: `rflex_only_diff`)
- delegation_progress/row_94_data_analyst.md (this file)

## Key results
- Test files named per workspace with grep line hits (section 4); owner row per file. Only new test files allowed: set17.db.test.ts + contract-v16-delta.ts, and only if row 91 adds a migration set.
- Migration cost: 25 files pin schema version 15 / dbc-16 / 34 migrations; service-only exclusivity (DB-A2) avoids all of them -> recommendation to row 91.
- NW-C1 rename touches 22 test files; recommend keeping the member name (row 95/90).
- Count pins (111 ops, 191 schemas) unchanged unless a named schema/op is added; openapi byte pins pass after row 100 regeneration.
- Rollback trap: untracked.tar.gz holds 36 docs/ members incl. status_tasks.md and decisions.md; plain `tar -x` overwrites current docs. Recommended rollback R-B (reverse R-FLEX-only patch, `patch -R -E -p1`); R-A needs `--exclude 'docs/*'`. 48_rflex_restore_point.md:86 integrity-check form fails from repo root (SHA256SUMS holds bare names).
- DB rollback: no down migrations; B-3 needs exact version equality; test DBs are per-run; bench DB fresh at row 44 (seed builds 0 rows of both tables).
- Mobile: consumer only, no file changes.
- Row 115: 9 suites in order under heavy-host.lock with --maxWorkers=2 (regression.sh hard-codes 4 for core-server unit).

## For the controller / row 96
- I-1 rollback form (R-B recommended), I-2 row-115 scope (R-FLEX set recommended), I-3 to row 95 (keep NW-C1 name).

## Gaps
- Rows 88-93 absent at run time: conditional rows marked C?.
- Audit reader tolerance of RELEASED after rollback not verified (row 108).
