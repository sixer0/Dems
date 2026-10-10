# coder-execution - fix wave I, driver A1 (2026-10-10)

Status: **complete** (needs-review for the decisions of `implementation/131_fix_wave_i_a1.md` section 7).

| Item | Where |
|---|---|
| Note (root cause, changes, tests, lane 2, runner checks, re-drive list) | `implementation/131_fix_wave_i_a1.md` |
| Contract note for drivers B and C | `delegation_progress/contract_wave_i.md` (final) |
| Claims | `delegation_progress/file_claims.md`, two lines `wave I A1` |
| Lanes | 1 and 2 STOPPED by this driver (step 0), not started again. Lane 2 data reset with the fixed tool; copy of the unsealed generated recording in `.data/gate-75b-set-aside/` |
| Commit / migration / lockfile / OpenAPI run | none |

New files: `packages/shared/src/sim/seal-blocked.ts`, `packages/shared/test/sim-wave-i-a1-seal-blocked.test.ts`,
`apps/core-server/src/sealing-host/__tests__/wave-i-a1-{session-key,progress}.test.ts`,
`apps/core-server/src/sealing/__tests__/wave-i-a1-way-out.test.ts`,
`apps/core-server/src/db/reset/__tests__/wave-i-a1-{unsealed-fake.test,unsealed-fake.db.test,reset-lane.db.test}.ts`.
Edited files: the table of section 3.2 of the note.
