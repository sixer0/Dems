# FX-M1 — mobile pairing, sign-in routing, Core link, debug warnings (E-fix, D201)

| Field | Value |
|---|---|
| Row | FX-M1 (E2E-S-1, E2E-S-3, E2E-S-4, E2E-T-1 / R5, F80 / R6) |
| Agent | coder-execution |
| Started / finished | 2026-10-06 11:14 / 12:05 WIB |
| Status | **complete** |
| Gate report | `gateway_check/11c_efix_mobile_link.md` |
| Rollback | `.cache/rollback/FX-M1/` + `SHA256SUMS.txt` (14 files, each copied before its first edit) |

## Progress

- 11:14 read D191, D196, D199, D200, D201; `test/07e_e2e_pairing.md`; t_tablet LogBox capture and logcat; `.cache/manual/metro.log` (device console of the whole E2E round).
- 11:28 rollback copies taken; implementation starts.
- 11:30–11:40 runtime modules `ended-link`, `probe-failure`, `pairing-gate-snapshot`, `signed-out-landing`; edits to `sim-adapters`, `sim-runtime-provider`, `log`, `index`; Pair hand-off (`pairing-model`, `use-pairing-flow`, `pairing-code-panel`); `+native-intent`; `_layout`.
- 11:40–11:47 tests: route-level (`pairing-handoff-routes`), `probe-failure`, `ended-link`, `pairing-gate-snapshot`, `log-console`, `signed-out-landing`; existing pairing tests updated to the new hand-off rule; new E2E-S-3 case in `pairing-live`.
- 11:48 targeted run: 51 suites / 659 tests PASS.
- 11:49–11:54 in-memory mutation check: 27 / 28 detected (S1-h, the layout's mount, is read by a static check; negative controls added). The tree was byte-identical before and after.
- 11:56 `npm run typecheck` exit 0; `npm run lint` exit 0.
- 11:56–11:59 whole suite `npm run test -- --maxWorkers=2`: 158 suites / 1829 tests PASS, exit 0.
- 12:05 report written.

## Milestones, blockers, decisions for the controller

- **Milestones.** All 5 defects fixed with tests: E2E-S-1 (redeem hand-off and sign-out landing), E2E-S-3, E2E-S-4, E2E-T-1/R5 (probe re-check, link-judged levels), F80/R6 (the log mirror no longer uses `console.warn`).
- **Blockers.** None.
- **Decisions taken in the row** (to ratify):
  - DX-1: the signed-out hand-off resets the stack to the boot router (pop to the first screen, then replace with `/`). Cancel, and the hand-off when signed in (Settings), still go back.
  - DX-2: `SignedOutLanding` is mounted in `app/_layout.tsx` beside `RootNavigator`, because `navigation/**` is outside this row's paths.
  - DX-3: while the Core has ended the run on purpose (`socketStatus().end`), OFFLINE reads as CONNECTING, in the runtime's Core link and in the Pair screen's link. M0's rule itself is unchanged.
  - DX-4: only the five probe operations are re-checked on a time-out. Commands are never re-sent.
  - DX-5: an unanswered Live action is never logged as `error`. Link `down` → `warn`. Link up or settling → a probe is `info` until the 2nd failure in a row, a command is `warn`.
  - DX-6: runtime `warn` records are mirrored with `console.info`; `error` records still go to `console.error`.
- **Outside this row's paths** (gate report §11): C-1 E2E-P-2 is in `features/home/home-screen.tsx:159` (FX-M2's path); C-2 the stale comments in `navigation/root-navigator.tsx:23-30`; C-3 to C-5 starvation observations (secret-store budgets, STALE in the socket client, the shared client's wall-clock budget); C-6 a transient `OperatorRole` ReferenceError in Metro between 11:26 and 11:34 (not FX-M1's); C-7 the device re-test of these defects is still to run.
