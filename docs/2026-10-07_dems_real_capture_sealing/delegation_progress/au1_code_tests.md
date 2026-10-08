# AU-1 progress record (verifier, parallel run)

- Row: AU-1, an independent hands-on audit of rows 16-27 (code and test changes, working tree vs 2a4f4ea)
- Status: **needs-review** (0 Blocker, 3 Major, 1 Minor, 2 Nit; row verdicts 8 CONFIRMED / 4 PARTLY / 0 NOT CONFIRMED)
- Artifact: `verification/20_audit_code_tests.md`
- Started 2026-10-08 05:16 WIB; finished 05:55 WIB

## Files created or updated

- created `verification/20_audit_code_tests.md`
- created `delegation_progress/au1_code_tests.md` (this file)
- No tracked file was modified. `delegation_progress_report.md`, `status_tasks.md` and `masterplan/02_plan.md` were not written (parallel isolation).

## What ran (all `--maxWorkers=2`, peak load 8.55)

- **Suites:** shared 71/1,851; core-web 117/1,495; mobile 193/1,994; core-server unit 160/3,954; core-server db 124/1,751 (outside the sandbox: the sandbox EPERM was confirmed first, PostgreSQL was RUNNING on 127.0.0.1:4432); root typecheck and lint exit 0.
- **Flaky set:** 6 files × 3 isolated runs = 18/18 green, and 2/2 full runs green.
- **RC-1 RED/GREEN** in a scratch worktree (`$TMPDIR/au1`, removed; symlinks unlinked first): pre-fix 5 failed / 5 passed (`Expected: >= 1129, Received: 1122`); post-fix 10/10.
- **Scratch-only probes:** the SEALED hub-row sequence (1129 → 1122), the TextScramble pre-scramble frame (200/200), and one mutation on the `app-tabs.tsx` veil timer (3/4 killed).
- **B2:** one lockfile entry moved (json-magic → undici 7.29.0 → 7.29.1); install scripts 17 → 17; `npm audit` today: high 98 (omit-dev 95), against the claimed 49/53. Same lockfile and same 2 root advisories, so this is registry drift.

## Decisions and blockers for the controller

- AU1-1 (Major): route to row 20; the D256 `:132` mechanism is a real 40 ms TextScramble interval.
- AU1-2 (Major): needs a user ruling on D255 (a: hold into the history row, or b: the sealed duration wins), then a row in M9-W3.
- AU1-3 (Major): an audit-gate metric erratum; re-base the gate on root advisories.
- AU1-4 (Minor): D13(c) erratum ("never overshoots" is inaccurate).
- AU1-5 and AU1-6 (Nit): optional, fold into row 97.
