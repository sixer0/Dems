# FXR-W (web post-review fix pass): delegation progress

- **Agent:** coder-execution (tier R). **Date:** 2026-10-07, 05:45 to 08:40 WIB. A stream interruption at about 08:05 was resumed on the controller's instruction, after the tree was checked (no stray `.fxrw-bak`, edits intact).
- **Status:** complete
- **Report:** `gateway_check/15b_fxr_web.md`: the per-finding table, the suite ledger, the test changes made by design, decisions DN-W1 to DN-W6, and rollback.

## Milestones
1. Rollback snapshot: 42 pre-images plus sha256 (`.cache/rollback/FXR-W/`).
2. W92-2: start-up chunks under the guard (red, then green; mutant killed).
3. W92-3, 4, 8, 9: `lib/core-queries.ts` (one factory per shared key, gate inside, `useQueryFailure`, `retryCoreQuery`); `lib/health-query.ts` (move).
4. W92-5: `components/shell/root-error.tsx`, the Devices boundary, the Login log (red, then green; 6 of 6 mutants killed).
5. W92-7: `lib/download.ts`, revoke after 30 s.
6. W92-10: the "Last verification" line pinned during a run (red reproduced the lane's line).
7. W92-11, W92-13 (presenter flag plus 2 shared i18n keys), W92-14 (`lib/device-command-gate.ts`), W92-16 (toast-call spies).
8. Nits W92-18 to 26.
9. Gates: typecheck and lint for core-web and shared, and mobile typecheck, all exit 0. `gen-openapi --check` up to date. Shared full suite 71 / 1,851 passed. Core-web full suite 115 / 117 files, 1,493 / 1,495 tests: the 2 failures were static pins changed by design, updated and re-run 31 / 31.

## Blockers
None.

## Decisions (for the controller)
DN-W1 to DN-W6 in the report, §4. Nothing for FXR-S: W92-15 stays deferred, and no constant was exported.

## Files
See the report §1 and `.cache/rollback/FXR-W/{created.txt,head_restorable.txt,post.sha256}`.
