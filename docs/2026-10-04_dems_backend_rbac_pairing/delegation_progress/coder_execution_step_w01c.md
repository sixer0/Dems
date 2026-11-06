---
agent: coder-execution
row: W01c (decision D41)
date: 2026-10-04
status: complete
---

# coder-execution - row W01c progress

Written to this per-agent file because the run is parallel (no writes to delegation_progress_report.md, status_tasks.md or decisions/decisions.md).

## Status: complete

## Milestones
1. Read `security-audit.test.tsx` lines 60-99 (`mountPage`) and 266-410; confirmed `mountPage()` waits only for `page-security-audit` and `panel-rbac`.
2. Saved pre-image `.cache/rollback/W01c.pre.patch` (0 bytes: file identical to `acaff20`). `acaff20` blob = `f15d955d898d877098e9eccd417daf5dc5f7d03b`.
3. Edited line 409 only: `getAllByRole('row')` became `await ... findAllByRole('row')`; same `within` scope, same `toHaveLength(10)`.
4. File alone x10: 10 of 10 passed (18 of 18 tests each).
5. Full web suite x1: exit 0, `Test Files 39 passed (39)`, `Tests 438 passed (438)`.
6. `npm run typecheck -w @dems/core-web` exit 0; `npm run lint -w @dems/core-web` exit 0.
7. Hashes recorded; reference-hash files unchanged; porcelain checked.

## Result hashes
- Test file after edit: `5470ce3fdcd98fd8c0926cd6afe03a1a1c1af58f`
- sim-fetch.test.ts `9e8b97c80da596e0ae6e9b37aa69b64e99e3bbdd` (match)
- storage-page.test.tsx `71f6f0337f2339d8e8d66ef232d7334dc0b67d1d` (match)
- dashboard.test.tsx `1ab07579e928b9b545003899ec3265d4b8b6c762` (match)

## Blockers
None.

## Findings / decisions for the controller
- Only one occurrence of the pattern on `rbac-matrix` (line 409). Line 285 (`getByTestId('rbac-matrix')`, element existence) and line 342 (`audit-table`, a different table) deliberately left unchanged.
- Residual risk: `findAllByRole` resolves at the first row, so a partial-rows state (1 to 9 rows) could still trip `toHaveLength(10)`. The recorded failure was zero rows, which the fix covers. Not hidden with timeouts or retries, per the brief. Detail in `implementation/01c_flaky_test_fix.md` section 7.
- F-49-3 / D77 (1 s waits in shell and route tests flaking under load) is the same race class but out of scope; not touched.
- Two files under `apps/core-server/test/helpers/db/` were modified on disk by another agent during my window; not mine, no effect on the web suite result (438 of 438).
- Hand-off: the Security & Audit page row must keep line 409 as the awaiting form (reference hash above).
- Rollback: `git checkout acaff20 -- apps/core-web/src/features/security-audit/__tests__/security-audit.test.tsx`

## Files created or updated
- Updated: `apps/core-web/src/features/security-audit/__tests__/security-audit.test.tsx` (hash `5470ce3fdcd98fd8c0926cd6afe03a1a1c1af58f`)
- Created: `docs/2026-10-04_dems_backend_rbac_pairing/implementation/01c_flaky_test_fix.md`
- Created: `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_w01c.md`
- Created (git-ignored): `.cache/rollback/W01c.pre.patch`, `.cache/rollback/W01c.post.patch`
