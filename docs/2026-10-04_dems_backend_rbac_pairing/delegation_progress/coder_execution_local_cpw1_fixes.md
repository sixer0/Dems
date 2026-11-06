# Progress — CP-W1 fix round (coder-execution-local)

- Started 2026-10-05 ~17:12 WIB (10:12Z). Single writer of `apps/core-web/**`. Backend gate W58 running beside this round: no write to `packages/shared/**`, `apps/core-server/**`, `apps/mobile/**`, `apps/mock-core/**`, `release/**`; **no lane, no Vite dev server, no browser session, no device session** (P9).
- Pre-images: `.cache/rollback/CPW1/apps-core-web.pre.patch` (`git diff acaff20 -- apps/core-web`, saved before the first edit) + file copies of the untracked production files in the same folder. Eight untracked files were edited after that copy pass and have no byte-level pre-image — recorded as DV-a.
- Deleted by ruling: `apps/core-web/src/features/login/use-mode-switch.tsx` → moved out of the tree to `.cache/rollback/CPW1/removed/` (nothing destroyed, M12).
- Baseline 17:16: `@dems/core-web` 55 files / **759** tests exit 0; `@dems/shared` 68 / 1,814 exit 0.
- Out-of-tree mutation rig: `$TMPDIR/kilo/cpw1-mut/` (script copied to `gateway_check/assets/08_fix_mutate_script.txt`). The workspace tree was never mutated.
- Report section: `gateway_check/08_cp_web_runtime.md` sections 22–31; assets `08_fix_*`.

## Items

| # | Finding | Status | Landing gate | Proof |
|--:|---|---|---|---|
| 1 | CPW1-1 (High) + CPW1-8 | done | web 55 / 760 exit 0, typecheck 0 | mutations R1 (+2), R2 (+1), R3 (+12 over baseline 3, spread over all four pinning files); login folder still ≥ 16 files (17) |
| 2 | CPW1-6 (both halves) | done | web 55 / 760 exit 0 | mutation T2 (+1); T1 survived — coverage gap, see DN-2 |
| 3 | CPW1-4 + CPW1-5's first pin | done | web 55 / 760 exit 0 (`08_fix_item3_suite.log`) | mutations P1 (+3), P2 (+1), P3 (+1) |
| 4 | CPW1-3 | done | web 55 / 760 exit 0 (`08_fix_item4_suite.log`) | mutations H1 (+4), H2 (+28) |
| 5 | CPW1-5 (the other two pins) | done | web 55 / 760 exit 0 (`08_fix_item5_suite.log`, `08_fix_final_suite.log`) | mutations C1..C4 (+1 each); the first helper let C1/C2 survive, it was tightened and they were re-run |

## End state (all quoted)

| Command | Result |
|---|---|
| `npm run test -w @dems/core-web -- --maxWorkers=2` | exit 0 — 55 files / **760** tests |
| `npm run typecheck -w @dems/core-web` | exit 0 |
| `npm run lint -w @dems/core-web` | exit 0, no finding |
| `npm run test -w @dems/shared -- --maxWorkers=2` | exit 0 — 68 / 1,814, unchanged (read only) |
| `npm run build -w @dems/core-web` | exit 0 — 0 assets with `unsafe-eval`, `new Function(` or `eval(`; the four Live markers 0 files each; `packaged-csp.ts` blob `78c8898e…` unchanged |
| mutation check | 13 of 15 detected, every verdict a delta on its own baseline |

Closed: CPW1-1, CPW1-3, CPW1-4, CPW1-5, CPW1-6, CPW1-8. Left with owners: CPW1-2 (W54's document),
CPW1-7 (W50), CPW1-9 (W84), CPW1-10 (W54/W88, forbidden path), CPW1-11 (W54, optional by D144(3)),
CPW1-12..15 (Info). Reasons one by one in report §30.

## Decisions the controller owes

- **DN-1** record `test/live-shell-indicator.test.tsx:358` as the by-design test change of D144(1)+CPW1-8 (posted on the board with before/after; P24).
- **DN-2** whether to give the chip colour a pure home beside `modeIndicatorState` so mutation T1 can be caught (touches W54's file beyond the ruled "one expression").
- **DN-3** confirm the ledger moves to 55 / 760 and retire section 8 rule 5's "add the global `fetch` stub until CPW1-3 lands".

## Notes

- No credential, token, cookie value or password in any file this round wrote.
- The production build wrote into the pre-existing git-ignored `apps/core-web/dist` (the same footprint
  the review disclosed as CPW1-15); `git status --porcelain apps/core-web/dist` is empty; nothing deleted.
- No red was seen in `apps/core-server` or `apps/mobile` from here, and none was touched (P11).
