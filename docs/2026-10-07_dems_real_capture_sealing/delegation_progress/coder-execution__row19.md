# coder-execution — row 19 (B10-e / RC-8 sweep, M0, class A, tier 3)

Status: DONE — overrides removed, suite green. Date: 2026-10-07. Session: coder-execution subagent (row 19 delegation).

Deliverable: `docs/2026-10-07_dems_real_capture_sealing/implementation/04_b10e_rc8_redundant_timeouts.md`

Depends on: row 18 (mobile jest chain, single-writer) — followed rows 16-18's run-command form, grep-proof form and attribution table exactly.

## Result summary

- RC-8 scope list: **7 files, size 7** — documented record (`docs/2026-10-04_dems_backend_rbac_pairing/verification/13_post_review_recheck.md:116`: `live-session-new-followups.test.tsx:47` + `more-live.test.tsx:36` named, "Five older files also call `jest.setTimeout(20_000)`") and the live grep agree — the five are `evidence-detail.test.tsx:24`, `evidence-more-menu-title.test.tsx:28`, `play-sheet.test.tsx:19`, `storage-screen.test.tsx:38`, `devices-screen.test.tsx:16`. Union = same 7; no disagreement to report.
- Removals: both `LOAD_TOLERANT_TIMEOUT_MS = 20_000` constants + their single per-test use args, five per-file `jest.setTimeout(20_000)` calls; three files also lost the now-unused `jest` binding from their `@jest/globals` import (the timeout was their only `jest.` reference — lint/tsc hygiene, required for the row 27 "typecheck plus lint exit 0" gate). 7 files, +9/−22, comment-only insertions; no assertion, logic, production or config edit. `tsc -p apps/mobile/tsconfig.json --noEmit` exit 0; `eslint` on all 8 edited files exit 0.
- Per-file verification: 3 runs (2 + 1) per edited file on the final blobs via `npm run test -w @dems/mobile -- <path> --maxWorkers=2` — 24/24 runs exit 0, zero flakes: followups 9/9, more-live 5/5, evidence-detail 7/7, more-menu-title 3/3, play-sheet 5/5, storage-screen 7/7, devices-screen 11/11, boundary 8/8 (all `Test Suites: 1 passed, 1 total`); summary lines quoted in the report §4.
- `40_000` decision (boundary file, deferred by row 17): **removed — option (a)**. Baseline `--verbose` run: max per-test 822 ms, suite 6.581 s at load 7.03 — ~24x margin below the 20000 default; post-removal trio exit 0; the single-line deletion is the ONLY touch of that file (row 17's gated hunks untouched).
- Full suite: one run, `npm run test -w @dems/mobile -- --maxWorkers=2` from the root — **exit 0, `Test Suites: 192 passed, 192 total` / `Tests: 1988 passed, 1988 total`**, `Time: 243.609 s`; 1988 = the ledger floor exactly (`identification/02_structured.md:39`), acceptance ">= 1,988" met; 192 PASS / 0 FAIL in the log; the "worker force exited" notice is the accepted pre-existing residual (N-4/W87-F1/C1-R1, exit 0). No timeout raised anywhere.
- Zero-override proof: `grep -rnE "jest\.setTimeout\(\s*20_?000|,\s*20000\s*\)" apps/mobile/src --include="*.test.ts*"` → no output, exit 1; same with `|LOAD_TOLERANT_TIMEOUT_MS` added → no output; per-file `grep -c` over the scope list → 0 for each of the 7.
- Production diff: `git diff --name-only -- apps/ packages/ scripts/ release/ | grep -v "\.test\."` → nothing printed (exit 1). 10 entries, all test files: my 7 + `live-settings-boundary.test.tsx` (row 17 + my one line) + siblings untouched — `live-session-live-link.test.tsx` (row 18), `live-paired-devices-issue.test.tsx` (row 20, core-web).

## For row 25 / the chain

Report §8 residuals; headline items: (1) 20 other mobile files still carry `jest.setTimeout(30_000)` — increases over the 20000 default, out of RC-8, candidate for a future per-file timing sweep; (2) the boundary diff mixes row 17's conversion (+20/−6 vs HEAD `0505dd9`→`084e87d`) with this row's one-line removal — review against `implementation/02_b10b…`; (3) `waitFor` option objects (`VERIFY_TIMEOUT` 8400 ms in evidence-detail) are polling budgets, not jest ceilings — excluded with reason.

Files written: the deliverable above, this progress note, and 8 test files — `live-session-new-followups.test.tsx`, `more-live.test.tsx`, `evidence-detail.test.tsx`, `evidence-more-menu-title.test.tsx`, `play-sheet.test.tsx`, `storage-screen.test.tsx`, `devices-screen.test.tsx` (RC-8) + `live-settings-boundary.test.tsx` (single `40_000` line only). Blockers: none. Mobile jest chain ready for row 21 (single-writer released after this row's full-suite run).
