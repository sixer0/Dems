---
step: 36
agent: coder-execution
plan_row: 02_plan §4 W-07, part a
status: complete
started: 2026-10-01 02:45 WIB
finished: 2026-10-01 03:14 WIB
log: implementation/17_motion_library.md
---

# Step 36: Web motion library (progress)

| Time (WIB) | Event |
|---|---|
| 02:45 | Inputs read: 02_structured row 36 and P1–P13; 03_motion_spec (whole); 11_token_pipeline §3; 01_specs §4.5, §14.13, §14.14; 02_plan §4 W-07 and §10; D6, D41(d), D43, D49, D52 |
| 02:45 | Baseline: core-web typecheck exit 0, lint exit 0, test 1/1. No concurrent step writes apps/core-web (31, 67, 68, 69, 71 are shared/mobile) |
| 02:48 | Wrote `src/motion/{policy,transitions,variants,glow,ambient-registry,debug-metrics,use-motion-policy,use-ambient-loop,use-media-query}.ts`, `{motion-policy-provider,glow-layer,debug-overlay,debug-overlay-gate}.tsx`, `motion.css`, `index.ts` |
| 02:56 | Tests `src/motion/__tests__/*` (4 files, 30 tests) pass first run |
| 02:57 | Mutation check (3 deliberate breakages: reduced rise, time scale ignored, OS setting ignored) → 1, 1 and 6 failures; files restored byte-identical |
| 02:58 | MS-01 and MS-02 greps: no matches (zsh needed quoted `--include` globs; bash form also exit 1). MS-03: no `will-change` in src/motion |
| 03:00 | First full gate: typecheck failed on 2 test-typing errors in my own test files; lint 3 warnings in my tests. Fixed; typecheck exit 0, oxlint 0 diagnostics / 33 files, test 5 files / 31 tests exit 0 |
| 02:58 | Browser pane hidden (`visibilityState: hidden`): overlay loaded, loops held at 0/4 (R10 confirmed); fps not measurable there |
| 02:59 | Port 5174 held by SMART WMS axiom-web (PID 3550), 5175 by SMART WMS pwms (PID 3521, [::1]); not touched. Harness on spare 5177 (P4) |
| 03:00 | Scratch harness (Vite PID 87287) + Playwright-cached chrome-headless-shell over CDP (PID 88113). Found bug D-1: live switch to reduced made settled panels jump `translateY(12px) scale(0.98)` |
| 03:01 | Regression test written first (red: `translateY(12px) scale(0.98)`); fix: reduced `visible` pins resting transform/filter keys; green |
| 03:02 | Harness artefact D-4 (Chrome profile inside Vite root triggered reloads); Chrome relaunched outside root (PID 89575) |
| 03:03 | Overlay breach flag refined (D-7: red only when a page loop is suppressed; shell yield shown as "shell paused"); +1 test |
| 03:03 | Final browser pass: 60–61 fps, 0 long tasks, meters 20/s per channel, 4/4 (shell paused), OS-live and in-app switches keep panels at rest, `?motion=off` reduced, one bloom pulse, proof mode mid-transition at 1.0 s. Screenshots `implementation/assets/17_motion_{debug_overlay,slow_1000ms,slow_8000ms}.png` |
| 03:04 | Stopped my PIDs 89575 (Chrome) and 87287 (Vite); ports 5177 and 9337 free; Browser-pane tab-3 closed; scratch Chrome profile deleted |
| 03:04 | Full gate: lint exit 0 (0 diagnostics / 40 files), test 5 files / 33 tests exit 0, MS-01/MS-02/MS-03 no matches. `tsc -b` exit 2: 3 errors, all in step 38's new files (sidebar.tsx, main.tsx, __root.tsx), 0 in src/motion (P11). Scoped tsc over my 20 files: exit 0 |
| 03:06 | Re-run: `tsc -b` exit 2, 6 errors, all in step 38 shell files, 0 in src/motion; lint 0; test 33/33. Background poll started (60 s × 12) for a clean `tsc -b` after step 38 |
| 03:06 | Log `implementation/17_motion_library.md` written |
| 03:07–03:12 | Poll: `tsc -b` exit 2 with 7, 9, 9, 9, 35 errors, all in step 38's in-progress files, 0 in src/motion; 03:12:58 exit 0 |
| 03:13 | Final gate with step 38's files present: typecheck exit 0 (0 errors); lint exit 0 (0 diagnostics / 77 files); test 5 files / 33 tests exit 0; MS-01 and MS-02 no matches |
| 03:14 | Log updated. Status **complete** |

## Files written (row 36 paths only)

- `apps/core-web/src/motion/` (new): `policy.ts`, `transitions.ts`, `variants.ts`, `glow.ts`, `glow-layer.tsx`, `ambient-registry.ts`, `use-ambient-loop.ts`, `use-motion-policy.ts`, `use-media-query.ts`, `motion-policy-provider.tsx`, `debug-overlay-gate.tsx`, `debug-overlay.tsx`, `debug-metrics.ts`, `motion.css`, `index.ts`
- `apps/core-web/src/motion/__tests__/` (new): `helpers.ts`, `motion-policy.test.tsx`, `ambient.test.tsx`, `glow-layer.test.tsx`, `debug-overlay.test.tsx`
- `docs/…/implementation/17_motion_library.md` (new)
- `docs/…/implementation/assets/17_motion_debug_overlay.png`, `17_motion_slow_1000ms.png`, `17_motion_slow_8000ms.png` (new)
- `docs/…/delegation_progress/coder_execution_step_36.md` (this file)

Not written (shared files under parallel isolation): `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`, `implementation/99_implementation_report.md`. The controller synthesises them.

## For the controller

- Integration owner: step 41 swaps step 38's bare `<MotionConfig reducedMotion="user">` in `src/routes/__root.tsx` for `<MotionPolicyProvider>`. Step 39's DbfsMeter calls `reportMeterFrame(channel)` (AC-61). Step 52 binds `setReducedOverride` to the Settings Switch. Step 56 can reuse `src/motion/__tests__/helpers.ts`.
- Bug D-1 was found in the browser and fixed test-first: a live switch to reduced motion made settled panels jump 12 px.
- Port note N-1: 5174 (IPv4) and 5175 (IPv6) are held by SMART WMS dev servers (PIDs 3550, 3521). Web lanes B and C may need the spares 5177 and 5178.
- Decisions D-2 to D-9 and note N-3 are in log §6. No blockers.
