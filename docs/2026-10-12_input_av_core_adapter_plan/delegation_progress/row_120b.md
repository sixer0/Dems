# Row 120b (agent 120b) - second pass of the code review of phases 8 and 10

Status: needs-review. Lists A, B and C read as the report's section 8 says; four named parts of phases 8 and 10 were read by NO pass (section 9). Report: `verification/120b_m10_review_second_pass.md`.

## Verdict
- This pass: APPROVED WITH COMMENTS, 0 new blocking findings, 11 follow-ups (S2-01 to S2-11: 2 medium, 9 low).
- M10 across both passes: 1 blocking finding, B-1 of row 120 (the helper's suite; row H4, routed, NOT re-checked). CHANGES REQUESTED stands until that re-check is recorded.

## What was read
- Baseline: head 1fbeada7, from `git archive` into the session scratchpad; never the working tree. Nothing was run.
- Product: the network configuration folder (5 files), the destination rule and its binders, the re-address chain (contract, shared transition, engine door, service, route, web model, dialog), the access entries and the guard for operations 100 to 110, the typed-address control, the alias socket client, caller, protocol, store.
- Tests: 9 files in full, 9 in part (long lines cut at about 200 characters).
- Web: 9 files (the seven of the commissioning folder and the two of the re-address dialog).

## Findings that change what the controller may claim
- S2-01 (medium, row 108): the reader of the network facts cannot return to the stored row. Stale after a commit whose answer is lost, on the no-change path (60e E-09), and after a demo reset (`file_requests.md:311`). Operation 101 reads the database, the rule and the alias caller read memory. Fails closed; heals at a restart.
- S2-02 (medium, a ruling, rows 95 / 108): `allowedPorts` has no production source. Only port 80 is ever allowed. The open path of a stored `host:port` address was NOT traced.
- S2-03 (low): point 4 of the rule (`scanSizeRefusal`, `spacingAllowance`) has no product caller; three implementations of the spacing.
- T-1: no test holds "the reader is told after the commit only" (`network/service.ts:221`); both rollback cases fail before that line.

## Answers to open ends of earlier passes
- 60e E-12 (a): the helper call is bounded at 35 s by the transport (`host-alias-socket.ts:71, 150`); not under the job's own bound.
- R119b-03: closed in the committed code (41 codes, compared with the helper's file by `caller.test.ts:174-187`).
- The commissioning group is nine operations (101 to 107, 109, 110). Operations 100 and 108 are `CAPTURE_CONFIG` by contract: a SUPERVISOR reaches them.

## Follow-ups of row 120, state
- Closed: F-9 (ruling C114). None by a committed row.
- With an owner: F-1 (H5), F-2 (H4), F-4 (D4), F-6 (the reset's row, unnamed).
- Without an owner: F-3, F-5, F-7, F-8, F-10 to F-15 (ten).

## Recommendation to row 121
M10 may close on ONE condition (H4's re-check of B-1 recorded as passed), carrying by id: F-1, F-4, F-6, S2-01, S2-02, G-3 / SR-13, the ten follow-ups without an owner, T-1; and stating what no pass read.

## Read by no pass
1. `capture-composition.db.test.ts` and `capture-composition.test.ts` (the only test of operations 104 / 105 on a real lifecycle).
2. 24 of the 28 implementation records.
3. `set10` to `set14.db.test.ts`, `db/schema/*.ts`, the snapshots, the shared contract tests.
4. Most of `commissioning.test.tsx`, parts of `set-ip.tsx`, the re-address dialog's tests, `i18n-web.ts`.

## Files written
- `docs/2026-10-12_input_av_core_adapter_plan/verification/120b_m10_review_second_pass.md`
- `docs/2026-10-12_input_av_core_adapter_plan/delegation_progress/row_120b.md`

No source file, no tracking file, no `decisions.md`. The export of the commit is in the session scratchpad, outside the repository.

## Blockers and decisions asked
- None blocks this row.
- Asked of the controller: an owner for S2-01; a ruling for S2-02; a row for the ten follow-ups without an owner.
