# coder-execution — step 86 (mobile Network & Time, M-14 part b)

| Field | Value |
|---|---|
| Step | 86 (blueprint row 86; 05_mobile_plan M-14 part b) |
| Agent | coder-execution (mobile lane, Metro 8081 per brief) |
| Started | 2026-10-01 WIB |
| Status | complete (device label re-check deferred to step 59) |
| Output log | implementation/58_mobile_network_time.md |
| Verification lane | FAST LANE (D75): mobile typecheck + lint exit 0, own jest suites pass, ONE phone-portrait device check |

## Owned write paths (P6)

- `apps/mobile/src/features/network-time/**` (screen, its `i18n.ts`, its tests; a local `sim-adapter.ts` only for a SIM-GAP)
- `docs/…/implementation/58_mobile_network_time.md`, `docs/…/implementation/assets/mobile/86_dems_phone_*.png`, this file

Never: `packages/shared/**`, `src/app/**`, `src/navigation/**`, `src/runtime/**`, `src/components/**`, any `package.json`, jest config, npm install.

## Log

- Inputs read: 02_structured row 86; 04_mobile_specs §2.3, §2.4, §4.0, §4.14, §7.3 (M-PG-NET); 03_motion_spec M-PG-NET + Appendix A; implementation 29 (web page model), 43, 44, 46, 47 §5, 15 (formatClock/formatUtcOffset/formatDate); decisions D17, D28, D55, D66, D73, D75, D78, D86, D87; MB 9 crop viewed (3x).
- Code (own folder only): `network-time-screen.tsx` (N1–N4, per-class layouts), `network-status-card.tsx`, `time-sync-card.tsx`, `tier-row.tsx` (GNSS → NTP → RTC, `indicator` spring, one pulse with explicit `totalMs`), `gnss-orbit.tsx` (Skia, fixed canvas, loop `network-time-orbit`), `system-time-card.tsx` (C-6 `slide` clock), `bandwidth-bars.tsx`, `lan-sheet.tsx` + `use-sheet-presence.tsx` (copy, D78), `card-boundary.tsx`, `icon-tile.tsx`, `use-network-time.ts` (flat selectors, toasts), `network-time-model.ts`, `i18n.ts`; tests `network-time-model.test.ts` (8), `network-time-screen.test.tsx` (6); test-only `testing/{network-time-test-setup.ts, network-time-harness.tsx}`.
- DR-86-1: victory-native dropped for the 12 bars (plain Views). Its `d3-scale` dependency is ESM-only and outside the jest transform allowlist, so the app-wide suites (T-M02 routes, chrome, guard) failed to parse any route that imports it. After the change `/network-time renders screen-<id>` passes in T-M02. **F86-1 for the controller:** step 84's `features/devices/health-chart.tsx` imports victory-native and currently breaks chrome/guard/routes the same way (d3-scale parse error); fix is a jest.config transform-allowlist entry (`d3-.*|internmap`) by the config owner, or a module mock.
- JS gate (own folder): jest 2 suites / 14 tests pass; eslint `src/features/network-time` exit 0; full mobile `tsc` errors only in other lanes' in-progress files (devices test setup, then settings-prefs; P11), 0 in network-time.
- Device (D100, D103): run 6 on dems_tablet (10:12): the screen renders, then GNSS loss → NTP tier, warning toast, "NTP fallback", then restore. Shots `86_dems_tablet_{network_time,gnss_loss,gnss_restored}.png`. Runs 7–8 on dems_phone2 portrait (10:15, 10:17): MB 9 N1–N4 on one screen, plus the GNSS-loss flow. Shots `86_dems_phone2_*_{fixed,final}.png`. Sign-in each time through `__DEMS_DEBUG__.sim.actions.signInWithBiometric("OPR-001")`; the fault was cleared afterwards.
- DR-86-2/3: tablet 3-pane layout fixes (bars 56–96 dp, label slots, System Time chip moved to the card header). Regression from the first label fix: the slots had zero width on the phone (kit `flex: 1` + Yoga auto basis). Fixed at 10:19 with plain `View` slots. The confirming capture (run 9) did not reach the screen in 420 s on the loaded phone2. **Deferred to step 59: check that the 4 labels are visible** (D103 time-box).
- Environment (P11): run 1 demo-fill miss; run 2 Metro bundle error from another lane's half-written shared sim file; runs 4–5 Gboard stylus sheet plus Metro reloads caused by other lanes' edits. No emulator killed or rebooted.
- SIM-GAP: none open (W50-4 was closed by step 54 mid-run: bandwidth history now seeded; the tests were made robust to both).
- Final gate 10:27: jest network-time 2/2 suites, 14/14; eslint exit 0; mobile `tsc` exit 0; T-M02 `/network-time renders screen-<id>` passes.
- Output: implementation/58_mobile_network_time.md.
