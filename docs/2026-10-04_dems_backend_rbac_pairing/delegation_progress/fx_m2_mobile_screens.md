---
row: FX-M2 (E-fix, mobile session/evidence/screens)
agent: coder-execution
started: 2026-10-06 11:28
status: complete (FX-M2 + FX-M2b, 7 of 7 in code and jest); the device re-test of E2E-P-1 and E2E-T-2 is pending (report §B.5)
---

# FX-M2 progress (parallel row; single writer of this file)

| Time | Milestone |
|---|---|
| 11:14 | Inputs read: D199-D201, 07c E2E-P-1..5, 07d E2E-T-2/-4/-6/O-2, captures 90a, 65, 36b, 12_devices_blank_after_7min |
| 11:28 | Rollback copies of 12 files in `.cache/rollback/FX-M2/` with `SHA256SUMS.txt` |
| 11:31 | E2E-P-2 fixed (`features/home/home-screen.tsx`), test `stack-proof-source.test.tsx` 4/4 |
| 11:37 | R2 (E2E-P-5, O-2) fixed: `features/rbac/use-role-gate.ts` (new), Home quick action, Sessions hub, `/session/new` entry guard, Install update; tests `rbac/role-gate-r2.test.tsx` 14/14, `rbac/live-role-gate-r2.test.tsx` 1/1 |
| 11:40 | E2E-T-6 fixed (`evidence/metadata-tab.tsx`, `evidence-detail.tsx`), test 4/4 |
| 11:44 | E2E-P-4/E2E-T-4 blank frame fixed (`app/(app)/session/live.tsx`, finalizing screen, `session-finalizing/handover.ts`), test 4/4 |
| 11:49 | E2E-T-2 screen states (`devices/panel-boundary.tsx` new, `devices-screen.tsx`), test 4/4; typecheck 0, lint 0/0 |
| 11:50 | BLOCKER for E2E-P-1 and E2E-P-3 (and E2E-T-2's root cause): the files are outside FX-M2's paths (`components/composed/nav/**`, `navigation/app-tabs.tsx`); not edited, reported |
| 12:01 | Mutation run in memory: 21 of 21 detected (control 9 files / 74 tests exit 0); tree files identical before and after |
| 12:05 | Full mobile suite: 158 suites / 1,829 tests passed, exit 0 (152 s); typecheck exit 0; lint exit 0 (0/0) |
| 12:10 | Report `gateway_check/11d_efix_mobile_screens.md` and assets `gateway_check/assets/11d_fxm2_*` written |

## Decisions and blockers for the controller

- BLOCKED (path): E2E-P-1 and E2E-P-3 need `apps/mobile/src/components/composed/nav/**`. E2E-T-2's likely cause needs `apps/mobile/src/navigation/app-tabs.tsx` (TabScreenFade). Analysis and proposed changes: report §4.1, §4.2, §4.4.
- R2 as implemented: Start Session and Continue setup are locked without SESSION_START (Home, Sessions hub). `/session/new` is refused at entry for a known role without it (Home plus a toast). Install update is locked without MAINTENANCE (this includes SUPERVISOR). The ways back to an active session are not gated.
- E2E-P-4: the live route hands over to Finalizing in place. The tablet's seal lag is not caused by a poll on the mobile path (report §4.3) and goes to W98.
- Partition: E2E-P-2 was done by FX-M2, as the brief says (D201 named FX-M1). E2E-T-5 was left to FX-C, as the brief says.

## FX-M2b (path grant: `components/composed/nav/**`, `navigation/**`)

| Time | Milestone |
|---|---|
| 12:11 | Rollback copies of the 8 granted files (and `nav/index.ts` at 12:23) appended to `.cache/rollback/FX-M2/SHA256SUMS.txt`; all matched HEAD |
| 12:13 | Item 4: the OperatorRole ReferenceError is not FX-M2's (`use-role-gate.ts` is type-only, its Babel output has 0 mentions); the current tree has 0 unbound references in 23 files; the check's control catches planted half-edits |
| 12:15 | Item 1 (E2E-P-3): the mini-bar reads `useSim(selectElapsedSeconds)`; test `live-mini-bar-clock.test.tsx` 1/1 |
| 12:22 | Item 2 (E2E-P-1, E2E-T-2): the settled states of `NavItem`, the pill, the rail card and the tab content are drawn by React; the motions are overlays React removes after a budget; test `chrome-lost-updates.test.tsx` 4/4 (worst-case model: every UI-thread update lost) |
| 12:26 | Item 3: `root-navigator.tsx` comments only (code without comments byte-identical to the rollback copy) |
| 12:30 | Mutations in memory: 13 of 13 detected (C1, C2, N1-N11); typecheck 0; lint 0/0 |
| 12:36 | Full mobile suite: 160 suites / 1,834 tests passed, exit 0 (157 s); targeted 24 suites / 235 tests; typecheck 0; lint 0/0 |
| 12:40 | `## FX-M2b` appended to `gateway_check/11d_efix_mobile_screens.md`; assets `gateway_check/assets/11d_fxm2b_*` |

### Decisions for the controller (FX-M2b)

- E2E-P-1 and E2E-T-2: the nav chrome and the tab content draw their settled state with React props. M-MB-01 and M-APP-04 are overlays that a React commit removes after a fixed budget (colour fade 300 ms, indicator trip 600 ms, content veil 240 ms; ×10 in proof mode). Reduced motion draws no overlay except the short content veil.
- E2E-P-3: the Recording bar reads the store clock (`selectElapsedSeconds`), as Home, the monitor and the Sessions hub do.
- OperatorRole ReferenceError: not FX-M2's; the tree is clean; most likely a transient half-edit of `packages/shared/src/sim/session-machine.ts` (FX-C) during Fast Refresh.
- Device-only checks: report §B.5.
