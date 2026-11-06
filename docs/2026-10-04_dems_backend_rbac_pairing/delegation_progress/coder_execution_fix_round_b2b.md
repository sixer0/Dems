# Progress — CP-B1 fix round B2b (coder-execution)

- Started 2026-10-04 21:02 WIB. Test step label `b2b`. Pre-images: `.cache/rollback/CPB2b/` (whole `src/`, `test/`, `package.json` of 21:02:48; hashes `.cache/rollback/CPB2b.pre.sha256`).
- Baseline 21:02:52 whole `unit`: 148 files / 3,815, exit 0. Baseline 21:03:24 whole `db`: 121 files, 1 failed (`src/modules/demo/__tests__/reset.db.test.ts`, 5 tests, item 0), 1,722 passed.
- Scratch logs: `$TMPDIR/../scratchpad/cpb2b/logs/` (copied to `gateway_check/assets/04c_*` at the end).

## Items (updated after every landing)

| # | Item | Status | Landed | Notes |
|--:|---|---|---|---|
| 0 | Demo reset test: the tablet link (D127, F78) | done | 21:06 | `src/modules/demo/__tests__/reset.db.test.ts`; demo `db` 4 files / 43, exit 0; typecheck 0 |
| 1 | Demo module adopts `runDatabaseBootChecks(app)` | done | 21:07 | `demo/host.ts`; tests `reset.db.test.ts` (one text), `static.test.ts` (import list); demo+core+acceptance `db` 16 files / 219 |
| 2 | Devices module reads `app.engine.meters()` | done | 21:11 | `devices/{status,index}.ts`; by-design: `effects.db.test.ts`, `static.test.ts`; new tests in `status.test.ts`, `routes.test.ts`; devices+acceptance `db` 7 files / 163 |
| 3 | Modules drop their own API-7 header lines | done | 21:16 | 12 module files; 9 static tests by design; new `test/static/api-headers.test.ts`; whole `unit` 149 / 3,821; whole `db` 121 / 1,727 exit 0 (21:21) |
| 4 | `stages.replace` test-only by construction | done | 21:25 | `src/app.ts`, new `src/test-configuration.ts`, `test/support/config.ts` (marks); new tests `src/__tests__/slot-replacement.test.ts` (8), `test/static/slot-replacement.test.ts` (3); whole `unit` 151 / 3,832; whole `db` 121 / 1,727 exit 0 (21:31); planted P4-1..P4-6 detected (scratch copy) |
| 5 | `ApiFailure.code` typed by the contract | done | 21:34 | `plugins/error-envelope/api-failure.ts` (the contract's `ApiErrorCode`, no edit of `packages/shared`); 2 test casts by design; new `api-failure-code.test.ts` (3); core+acceptance `db` 12 files / 176; M-5a, M-5b do not compile (scratch copy) |
| 6 | Imports: the cycle, deep imports, one `operationOf` | done | 21:48 | new `plugins/authenticate/console.ts`, `modules/identity/operations.ts`; `DeviceResolver.deviceState` (seam member); 10 specifiers to the schema index; `test/static/imports{,.test}.ts` (closed units, exposed paths, unit graph); cycle tool: `no cycle between units`; whole `unit` 152 / 3,842 (21:49); whole `db` 121 / 1,727 exit 0 (21:53); planted P6-1..P6-6 detected. NOT moved: `createSweeper` (no cycle edge), `db/commands` (no index, reason in the test header) |
| 7 | Read blocks; `read` takes a context | done | 21:55 (tests 22:01) | `plugins/db/index.ts` (`ReadContext`), admin `listUsers`, evidence `read`, sessions `history.ts` use `app.db.read`; 10 call sites pass `request`; by-design tests in admin, evidence, sessions, security-audit; +3 tests in `plugins/db/__tests__/read.test.ts`; whole `unit` 152 / 3,842 (+3 after); `db` of 10 folders + acceptance 60 files / 901 (2 red by design fixed, evidence 6 / 89) |
| 8 | Structured digest verdict | done | 22:02 | `db/mapping/audit-verify.ts` (`code`, `seq` beside `reason`; a union), `security-audit/stored-chain.ts` reads `seq` (the regular expression is gone); 2 tests by design; unit 27 files / 630; `db` 31 files / 578 with acceptance; mutations M-8a, M-8b detected |
| 9 | Shims and neutral test support | pending | | |
| 10 | CPB1-18 to 26, F-9 | pending | | |
| 11 | Log-call static test sees spreads | pending | | |
| 12 | `ACTIVITY_EXEMPT_OPERATIONS` | pending | | |
| 13 | npm script for `dropDeadRun` | pending | | |
