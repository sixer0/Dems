# C3 progress (coder-execution), 2026-10-07

- 05:38: `uptime` load 4.27. Read the C2 report §8 (C2-R1), D240 and `scripts/pg/init.mjs` CONF_BLOCK. `.data/postgres/current_logfiles` holds `stderr log/postgresql-05.log`.
- 05:39: Saved the rollback copy to `.cache/rollback/C3/` (`C3.pre.sha256`). The file matched HEAD.
- 05:40: Adapted the file: header, `readFileSync`, collector reader with the hour boundary, `terse` pin, inverted findings, counts-only `console.info`.
- 05:40:58: Single file: 7/7 passed.
- 05:41: Mutants m1, m2 and m3 each failed their own test (3 failed, 18 passed). The mutant copies were deleted.
- 05:41:26: `npm run test:db`: 124 files, 1,751 tests, exit 0.
- Typecheck and lint for core-server: exit 0.
- Wrote the report: `gateway_check/14_c3_pg_behaviours.md`. Assets: `gateway_check/assets/14_c3_{single_file,mutants,test_db,typecheck_lint}.txt`.
- Status: complete.
