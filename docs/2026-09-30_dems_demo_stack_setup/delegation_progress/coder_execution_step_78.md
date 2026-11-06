# coder-execution — step 78 (mobile Start New Session, M-09)

| Field | Value |
|---|---|
| Step | 78 (blueprint row 78; 05_mobile_plan M-09) |
| Agent | coder-execution (mobile lane, Metro 8085 per D72) |
| Started | 2026-10-01 05:30 WIB |
| Status | complete (fast lane D75; tablet device check → end pass) |
| Output log | implementation/50_mobile_start_session.md (Tier 3) |

## Owned write paths (P6)

- `apps/mobile/src/features/session-new/**` (screen, its `i18n.ts`, its tests, a local `sim-adapter.ts` for SIM-GAPs)
- `docs/…/implementation/50_mobile_start_session.md`, `docs/…/implementation/assets/mobile/78_<avd>_*.png`, this file

Never: `packages/shared/**`, `src/app/**`, `src/navigation/**`, `src/runtime/**`, `src/motion/**`, any `package.json`, jest config, npm install. Not written in this parallel run: `delegation_progress_report.md`, `status_tasks.md`, `masterplan/02_plan.md`.

## Log

- 05:30–05:45 Inputs read: 02_structured row 78 + P1–P13; D17, D28, D38, D43, D55, D58, D61, D62, D66, D68, D71, D72; 04_mobile_specs §1–§3, §4.0, §4.4, §5, §7, §9–§11; 05 M-09; research 01 §5.3; 03M M-PG-NEW; implementation 43, 44, 46 (runtime hand-over); step-79 progress (portal and gorhom findings); shared `sessionCreateSchema`, `sessionNew.*` i18n, sim session machine (precheck 300–700 ms, auto-ARM on PASS, WARN acknowledgement, cancel); MB 3 crop viewed.
- 05:50 Controller relay D73 (review 74) received: (1) F74-03 hand-over — step 78 now also owns `apps/mobile/src/components/kit/subject-type-chip.tsx` for one change (accept sim codes TERSANGKA/SAKSI/LAINNYA, labels from shared `common.subjectType`, backwards compatible; kit test may be updated accordingly); (2) F74-13 — `useSim` selectors return flat values only; (3) F74-02 — pass `totalMs` explicitly to `animatePulseOnce`.
- 05:55 F74-03 done: `components/kit/subject-type-chip.tsx` accepts sim codes and display terms (labels/glosses from shared `common.subjectType*`; type-only sim import); `kit.test.tsx` gained 4 sim-code cases (16/16 pass).
- 06:00–06:40 Code: `src/features/session-new/{i18n.ts, sim-adapter.ts (SIM-GAP-1 next case number), session-new-model.ts, use-session-new.ts, step-boundary.tsx, check-icon.tsx, device-previews.tsx, session-info-step.tsx, devices-check-step.tsx, ready-step.tsx, session-new-header.tsx, flow-guard.tsx, session-new-screen.tsx}`; tests `precheck.test.tsx` (T-M10), `session-new-screen.test.tsx`, `session-new-model.test.ts`; test-only `testing/{session-new-harness.tsx, session-new-test-setup.ts}`.
- Found in jest: expo-router `router.replace` only ENQUEUES (routingQueue drained in an effect one commit later), so `startRecording()` + `router.replace` let the wizard route render RECORDING first → the shell's "A session is already active" toast. Fixed: synchronous `navigation.dispatch(StackActions.replace('live'))` after the guard-off commit. Mutation check: the queued variant fails both hand-off tests; gate-policy mutant fails 3/4 T-M10 cases.
- 06:45 Own gate: 4 suites / 57 tests pass (session-new + kit); eslint clean; typecheck errors only in step 83's concurrently edited `evidence-detail.test.tsx` (P11).
- 06:55 Full jest (--maxWorkers=2): 50 suites / 647 tests, 3 suites fail: login.test (step 75, timeout under load, P11), routes.test + 1 guard case (`stub-param-selectedId`, step 83's evidence screen replacing its stub), and 4 guard.test cases asserting step 70's session-new STUB testID `stub-param-step` (guard.test.tsx:77, :172). Those 4 are the inherent consequence of replacing the stub; guard.test is step 70's file (P6). Wizard now routes by the runtime contract state (`useActiveSession`, same source as the shell), and a temporary copy of guard.test with the 2 assertions pointed at `session-new-step-<n>` passes all session-new cases (proposal for step 57 / controller).
- 06:27–06:34 Phone run 1 (Metro 8085, `?motion=off`): step 1 MB 3 match; scan → LP/2026/1001-0008; step 2 PASS; BLOCK (Storage FULL, reason shown), cancel dialog → SESSION cancelled, WARN (MIC 2 clip) + acknowledge → ARMED "Ready, 1 warning acknowledged". Found: (S78-6) two concurrent live video decodes on the phone stalled the UI thread 13 s (HWUI "Davey! duration=13290ms", C2BqBuffer dequeue failures) → phones now play ONE camera live, the other a poster (tap to swap), §7.8 compact budget; (S78-7) reduced-motion Stepper badges lost glyphs (Reanimated "synchronouslyUpdateUIProps failed … Unable to find SurfaceMountingManager") → Stepper keyed by statuses under reduced motion; reported to step 71. Device state reset to `idle` after the run.
- 06:35 Tablet run 1: script sent BACK to hide an IME that the hardware-keyboard tablet never shows → the Discard dialog opened (kept as evidence: `78_dems_tablet_landscape_discard_dialog.png`); run 2 fixes the script. State reset to `idle`.
- 06:39 Run 2 queued (phone full motion + reduced pass, then tablet).
- 06:50–07:00 D78 relay applied: copied step 79's `use-sheet-presence` into the folder; the investigator Select (bottom sheet on phones) and the Room/Profile popovers mount on demand; jest case for the investigator sheet added. Tablet runs 2–3 blocked by AVD environment (BACK sent for a non-existent IME; Gboard "Try out your stylus" onboarding captured the typed name). Phone run 2 (09:09) invalid: 16-min bundle under host load, sign-in expired.
- 09:16 Resumed under fast lane D75 (controller interruption): queued tablet run cancelled (my own process); invalid run-2 screencaps removed.
- 09:17–09:18 ONE phone-portrait check (full motion): investigator sheet opens; step 1 → Next → 8 checks PASS in 3,900 ms (301–669 ms each) → ARMED → Ready → Start (3-2-1) → RECORDING on step 79's monitor, no busy toast; 0 JS errors; device reset to idle.
- 09:19–09:23 Post-check fixes (jest-verified, device in the end pass): Stepper remount on status change in both motion modes (S78-7); `?step=` via the screen's `navigation.setParams` (S78-9, `router.setParams` threw before root mount in step 70's routes.test). Final gates: typecheck exit 0, lint exit 0, step-78 suites 59/59; full jest 671/681 (10 = step-70 stub-param assertions: 6 session-new, 4 steps 80/83; H-78-1).
- Output: implementation/50_mobile_start_session.md; screencaps implementation/assets/mobile/78_*.png (20 files).
