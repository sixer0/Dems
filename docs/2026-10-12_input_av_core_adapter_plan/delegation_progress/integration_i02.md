# Integration pass I-2 (track D) - short record

Status: needs-review (every check green; five driver decisions to confirm, DD-1 first). Full record: `implementation/i02_integration_pass.md`. Nothing committed, nothing staged.

## Done (items of the fixed list)
1. Acceptance pins 97 -> 99: `apps/core-server/test/acceptance/contract.test.ts` (counts, POST 61 -> 63, guarded 93 -> 95, `LANDED_UNROUTED` names the two routes, calling walks on the routed set) and `rbac-matrix.test.ts` (99, one-permission rules 57 -> 59, delta rows 22 -> 24, web-console-only list + 98, 99, `DEFERRED_ROUTE` names both with row 70). Identity rows of 98-99: two rows in the table of operations 93-97, `docs/2026-10-07_dems_real_capture_sealing/masterplan/03_api_contract.md:597-598`; reader row count 5 -> 7 in `rbac-matrix.support.ts:296`.
2. `ALL_TABLES` (`src/db/store/store.ts:461-462`) and `BULK_MINIMUMS` (`src/db/fixtures/minimums.ts:104-105`) 43 -> 45; the pins they move in seed, fixtures, engine and reset tests, plus `test/support/seed.ts` and `src/db/fixtures/__tests__/support.ts`.
3. Comment `src/core/audit-details.ts:185-189`.
4. Export line `src/capture/adapters/local/index.ts:28`.
5. Root script `test:host-helper` (`package.json:54`); it is not part of `npm test`.
6. Stub option `profileSet: 'TWO_SOURCES'` in `test/support/fake-onvif-stub.ts`, one test in its test file, one complementing case in `onvif-session.test.ts`. A stub built without the option is unchanged.

## Checks
- Typecheck in the five workspaces: exit 0 each.
- Acceptance (database project, two files): 2 files, 77 tests passed.
- Database tests that read the two lists: 14 files; run 1 had 7 failures in 2 reset files (pin "rebuilt 24"); after the move those 2 files: 13 of 13 passed; the other 12 files passed in run 1.
- Core server unit: 17 files, 601 passed (first run); 76 files, 1457 passed (final state).
- Shared pin tests: 13 files, 314 passed. Helper script: 58 tests OK. `scripts/pg/static.test.mjs`: 6 of 6. oxlint: exit 0.
- Not run: `npm test`, `npm run test:db`.

## Remaining reds
None in these runs.

## Requests closed in `file_requests.md` (file not edited)
Lines 24, 28, 30, 33, 34, 35 (comment half), 42.

## Driver decisions
DD-1 the two identity rows live in task 3's C3 document section 2.6, and `rbac-matrix.support.ts` was edited (5 -> 7). DD-2 `contract.test.ts` uses the named deferral with a routed set, not count moves alone. DD-3 pins beyond row 17's list moved (reset "rebuilt" 24 -> 26 among them). DD-4 the stub mode is a construction option; row 26's local fixture stays. DD-5 script name as row 104 proposed.

## Open, for other rows
- Row 70: empties `LANDED_UNROUTED` and `DEFERRED_ROUTE` when it routes 98-99.
- The reset row for T-44 / T-45: returns "rebuilt" to 24 with its kept entries.
- `README.md:827` names six root test scripts at `package.json:53-58`; there are seven now. Comments saying "43 tables" in `src/db/fixtures/` and line 36 of `file_requests.md` are untouched.
