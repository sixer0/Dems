---
row: CF2-B
agent: coder-execution
date: 2026-10-06
status: complete
report: gateway_check/13b_cf2_mobile_screens.md
---

# CF2-B — mobile screens (RF-T-1, RF-T-2, RF-T-5): progress

## Status

**complete.** All three defects fixed in code, covered by jest (fail before / pass after; 19 of 19 in-memory mutants caught) and proven on the tablet emulator-5556 with 2 runs + 1 verification each. Tablet ends LIVE, signed out, on Login.

## Milestones (device time, 2026-10-06)

| Time | Milestone |
|---|---|
| 20:41 | Rollback copies in `.cache/rollback/CF2-B/` (final `SHA256SUMS`: 9 files) |
| 20:44–20:49 | Before-captures on the tablet: RF-T-1 2/2 (Evidence), 1/1 also in the Sessions hub; RF-T-2 497.5 \| 206.5 dp; RF-T-5 date only / ellipsis; Devices rows fine |
| 20:50–20:57 | Code + tests for the three defects; typecheck, lint, mutants (16/16 at that point) |
| 20:59 | RF-T-1 run 1 (glow change only): **still empty** |
| 21:00 | Second RF-T-1 change: card border constant (`ROW_CARD_BORDER`); tests extended |
| 21:02–21:05 | Run 2 and verification: RF-T-1 PASS (Evidence + Sessions), RF-T-2 PASS (361.5 \| 342.5 dp), RF-T-5 PASS |
| 21:06:48 | Sign-out 204, Login |
| 21:07–21:11 | Full mobile suite once: 1,928 / 1,929 (static folder list); fixed; 3 touched folders 24 suites / 166 tests pass |
| 21:13 | Final mutation run: 19 / 19 detected, tree unchanged |

## Files created

- `apps/mobile/src/features/evidence/selection-glow.tsx`
- `apps/mobile/src/features/evidence/evidence-row-deselect-drawn.test.tsx`
- `apps/mobile/src/features/evidence/testing/row-tree.ts`
- `apps/mobile/src/features/sessions/session-row-deselect-drawn.test.tsx`
- `apps/mobile/src/features/sessions/hub-pane-split.test.tsx`
- `apps/mobile/src/features/network-time/time-sync-fit.test.tsx`
- `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/13b_cf2_mobile_screens.md`
- `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/cf2_b_mobile_screens.md` (this file)
- `docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/assets/13b_*` (29 files):
  - captures: `13b_rft1_before_evidence_0018_row_empty.png`, `13b_rft1_before_evidence_two_rows_empty.png`, `13b_rft1_before_sessions_row_empty.png`, `13b_devices_rows_deselect_ok_untouched.png`, `13b_rft5_before_network_time.png`, `13b_rft5_before_network_time_card.png`, `13b_rft1_run1_glow_only_still_empty.png`, `13b_rft1_run2_evidence_0018_drawn.png`, `13b_rft1_run2_evidence_0017_drawn.png`, `13b_rft1_verification_after_scroll.png`, `13b_rft2_run1_sessions_panes.png`, `13b_rft2_run1_detail_scrolled.png`, `13b_rft2_run2_sessions_panes.png`, `13b_rft5_run1_network_time_card.png`, `13b_rft5_run2_network_time_card.png`, `13b_rft2_rft5_verification.png`, `13b_end_signed_out_login.png`
  - text: `13b_device_id_dumps.txt`, `13b_driver_events.log`, `13b_crash_scan.txt`, `13b_driver.mts.txt`, `13b_qsend.mjs.txt`, `13b_mutate.py.txt`, `13b_mutating_transformer.cjs.txt`, `13b_jest_mut_config.cjs.txt`, `13b_mutant_selection_glow_reanimated.tsx.txt`, `13b_mutations.log`, `13b_typecheck_lint.log`, `13b_full_suite.txt`, `13b_targeted_after_static_fix.txt`

## Files updated

- `apps/mobile/src/features/evidence/evidence-row.tsx`
- `apps/mobile/src/features/sessions/session-row.tsx`
- `apps/mobile/src/features/sessions/sessions-screen.tsx`
- `apps/mobile/src/features/network-time/time-sync-card.tsx`
- `apps/mobile/src/features/sessions/hub-pane-row-fit.test.tsx`
- `apps/mobile/src/features/evidence/live-evidence-static.test.ts`

Working files outside `/docs` (not deliverables): `.cache/rollback/CF2-B/` (rollback copies + `SHA256SUMS`), `.cache/cf2_b/` (driver, queue, raw captures), `.cache/cf2_b_mut/` (mutation tooling).

Not written (parallel run rule): `delegation_progress_report.md`, `status_tasks.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md` — the controller synthesises them from this file and 13b.

## Blockers

None.

## Decisions (details in 13b §7)

- DEC-CF2-B-1 selection glow changes at once (no 240 ms cross-fade).
- DEC-CF2-B-2 Evidence and Sessions row cards keep a 1 dp border in both states (transparent / gold).
- DEC-CF2-B-3 Sessions hub expanded split: start widths 360 | 340 dp, extra split 2 : 3.
- DEC-CF2-B-4 Network & Time values wrap (no line cap).
- DEC-CF2-B-5 the Sessions hub rows received the RF-T-1 fix (same defect seen on the device); Devices rows unchanged.

## Deviations (details in 13b §6)

- D-CF2-B-1 one uiautomator dump on Home (q/004), against the rule; contents: ids, texts, bounds of Home.
- D-CF2-B-2 first capture after the first sign-in 1.8–2.4 s after the password command (rule: 2 s); the driver's `sleep` is in ms. Later sign-ins: 6.6 s and 5.8 s.
- D-CF2-B-3 RF-T-1 needed a second code change between device run 1 (fail) and run 2 (pass); within 2 + 1.

## Observations for the controller

- O-CF2-B-1 Home header clock seconds held at `:00` for a minute (outside CF2-B's paths).
- O-CF2-B-2 Sessions detail hero "Sealed" chip drawn faded (before and after).
- O-CF2-B-3 one ignored rail tap during a 38-frame skip after sign-in.
- O-CF2-B-4 any other kit `Card` whose border width changes with state may show the same empty draw; not searched.
- The re-test's code-only hypothesis for RF-T-1 (glow removal) was disproved on the device by run 1; the trigger is the card's border-width change. The native mechanism (padding-box clip of an `overflow: hidden` Surface with `boxShadow`) remains a hypothesis.

## Secret scan

See the last line of this file.
Secret scan 21:19 (count-only, `.cache/cf2_b/scan.mts`, dataset constant read inside the script, never printed): 15 text files (13b report, this file, 13 text assets 13b_*); password exact 0; password loose 0 files; token shapes (dvc_/ses_/bio_) 0 files. README and sim/dataset.ts were not grepped.
