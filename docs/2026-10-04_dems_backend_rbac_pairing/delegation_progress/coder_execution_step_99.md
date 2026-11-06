# Progress: plan row W77 (step 99) — Web Users & Roles

Agent: coder-execution. Started 2026-10-06 00:58 WIB.

| Time (WIB) | Milestone | State |
|---|---|---|
| 00:58 | Inputs read: plan row W77, [CS] §10.1, §10.2, §6.3-6.5, §13.9; 08 §8 + §30; 08a §15; 54 §6-§9, §21; 50 query bridge; 33 §5, §6, §9; 63 F63-2/F63-3; decisions D91, DR-12, F59 | done |
| 01:04 | Pre-images saved under `.cache/rollback/W77/` (2 files, SHA-256 in `SHA256SUMS`) | done |
| 01:12 | Production files written: `features/users-roles/{index.tsx, model.ts, queries.ts, commands.ts, report.ts, panel.tsx, choreography.ts, users-panel.tsx, matrix-panel.tsx, role-dialog.tsx, status-dialogs.tsx, users-roles.css}`; words `packages/shared/src/i18n/en/users-roles.ts` (additive) | done |
| 01:16 | FINDING F77-1: W54's `live-shell-admin.test.tsx` goes red (11 tests) because W50's harness does not answer `getRoleMatrix` (`FakeTransportUnscriptedError`); the same error already reds its `/security-audit` case through W75's parallel work. Needs one line in `runtime/testing/live-harness.ts` (closed to this row) | needs-review |
| 01:23 | Row tests: `live-users-roles-{page,commands,model}.test.tsx` + bed `features/users-roles/__tests__/users-roles-bed.tsx` — 3 files / 50 tests green | done |
| 01:32 | Mutation check (M15, in memory, W0's transform-plugin pattern): 25 mutants, 25 detected after one test was added for C07 (first survivor); tree SHA-256 identical per batch | done |
| 01:35 | Lane 3 live check (lockf exit 0, 37 s): seeded SUPERVISOR via the form, OPR-003 TECHNICIAN -> INVESTIGATOR -> TECHNICIAN through the UI, both 200, Core list shows TECHNICIAN again; last-admin hint shown; Simulated "Live mode only" centred, 0 API requests; 4423/5178/9398 free after; no error lines in the backend log | done |
| 01:37 | PROBE2 (in memory): W54's `live-shell-admin.test.tsx` 40/40 green when the harness answers getRoleMatrix + W81's two reads | done |
| 01:37-01:48 | Gates: web suite run 1 (01:37) 89 files / 1,177 tests, run 2 (01:43) 91 / 1,203 — both exit 1 with the same 3 red files (live-shell-admin 17: 9 W77 + 8 W75/W81, harness gap F77-1; live-pending-control 1: exact caller pin F77-2, shared with W75/W76/W81; live-devices-drawer 1: W81). Row tests green; web typecheck/lint exit 0 (oxlint 0/0); shared 68 / 1,814 exit 0, typecheck/lint exit 0. FINDING F77-2 added | needs-review |
| 01:50 | Document `implementation/77_web_users_roles.md` written (status needs-review); 19 assets `implementation/assets/77_*` | done |

**Status: needs-review** — CLG (a) is red only through F77-1 (W50's harness answers no `getRoleMatrix`) and F77-2 (W0's exact `usePendingControl()` caller pin); both outside this row's write paths, both measured fixable in memory (PROBE2 40/40, PROBE3 20/20). Lane 3 left with the seeded roles; ports 4423/5178/9398 free.
