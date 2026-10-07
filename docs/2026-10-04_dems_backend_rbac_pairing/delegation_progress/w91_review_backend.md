# W91 — Code review of `apps/core-server` — progress

| Field | Value |
|---|---|
| Row | W91 (step 113), senior-code-reviewer, tier R, read-only |
| Status | **complete** |
| Started / finished | 2026-10-07 05:20 / 05:40 WIB |
| Report | `verification/10_code_review_backend.md` (Tier 2) |
| Verdict | APPROVED WITH COMMENTS; **0 Blocker, 1 Major, 10 Minor, 6 Nit** (17 findings, W91-1 to W91-17) |
| Open blockers | 0 |

## What was done
1. Read plan row W91, D12, D87, D139, D172, D190 (O-15, O-16), D195, D202, D239, CP-B1 §4.4/§5, B2b §3-§4/§10, W83 ledger rows 11/19/55/59 and §7.2.
2. Reviewed `git diff 057fc17 -- apps/core-server` (19 files, +198/-73) and the 3 untracked test files (FX-C and the W83 rewording).
3. Reviewed the high-risk areas: identity sessions and sign-in, the authenticate stage, the realtime hub and plugin, pairing redeem, the core pipeline, the engine unit and undo, admin changes, the error log, the entry point.
4. Ran read-only checks: typecheck exit 0, lint exit 0, unit `--maxWorkers=1` 155 files / 3,926 tests passed (equals the D239 ledger), and `graft callers` for the FX-C entry points.
5. Built the register of hand-built parts without a recorded decision (14 items, report §3) and the routed-items table (report §4).

## Rule compliance
- No source file changed. Files written: the report and this progress file only (the `verification/` folder already existed).
- No db test run; nothing touched 5432 or 4432 (W90 owns PostgreSQL).
- Load checked before each heavy command: peak 4.22 (limit 14).
- No secret was printed. The run showed the sandbox's certificate warnings only.

## Decisions needed from the controller
- **DN-W91-1 (W91-1, Major):** rule on the 14 hand-built parts of report §3: accept each as an HB number with the quoted reason, or schedule a replacement. The error log (HBX-4) and the static scanners (HBX-13) are the two with a credible ready-made alternative. This must be ruled before W101.
- **DN-W91-2:** schedule the post-review fix pass for W91-2 to W91-16, or record the Minor and Nit items as accepted. W91-9 and W91-10 need the serial slot that D139 DN-2 promised. W91-17 belongs to W90 or the runbook.
- RESIDUAL-W77-1: confirmed still present and accepted (D172, R-C5). Report §4 has an observation that FX-C's debouncer makes a debounced `admin.changed USERS` cheap, if the controller wants to revisit it.

- **DN-W91-3:** W90's C2-R1 change to `apps/core-server/test/db/pg-behaviours.db.test.ts` landed during this review and is not covered by it. It needs a W91 delta re-check before W103 (plan §622).

## Files created or updated
- `docs/2026-10-04_dems_backend_rbac_pairing/verification/10_code_review_backend.md` (created)
- `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/w91_review_backend.md` (created)
