# coder-execution — step 69 (mobile motion kit, M-02 part b)

| Field | Value |
|---|---|
| Step | 69 (blueprint row 69; 05_mobile_plan M-02 motion part) |
| Agent | coder-execution (mobile lane; Metro 8083, released by step 67 at 02:45, P4) |
| Started | 2026-10-01 ~02:50 WIB |
| Finished | 2026-10-01 03:06 WIB |
| Status | **complete**, with one item for a controller ruling (F-69-1) |
| Output log | implementation/42_mobile_motion_kit.md |

## Owned write paths (P6)

- Code: `apps/mobile/src/motion/**` only. 18 new files: 13 source files and 5 test files.
- Docs:
  - `implementation/42_mobile_motion_kit.md`
  - `implementation/assets/mobile/69_dems_phone_launch_no_regression.png`
  - `implementation/assets/mobile/69_dems_tablet_launch_no_regression.png`
  - this file.
- Not written:
  - `packages/shared/**`
  - any `package.json`
  - `src/app/**`
  - `src/providers/**`
  - `src/i18n/**`
  - `src/components/**`
  - `src/features/**`
  - `jest.config.js`, `jest.setup.ts`
  - `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`, `implementation/99_implementation_report.md` (parallel isolation)

## Log

- **Inputs read:**
  - 02_structured row 69 + P1–P13;
  - 04_mobile_specs §3.2, §3.5, §4.0, §4.15, §5.3, §7.1–§7.8, §10.1, §11;
  - 03_motion_spec §1–§3, §8, §9, App. A;
  - 11_token_pipeline §3/§7;
  - 05 M-02;
  - D41, D43, D47, D49;
  - the step 67/68/71 progress files.
- **Source checks:**
  - Reanimated 4.5.1: `ReducedMotionConfig` and its dev warn; `FadeInDown` `withInitialValues` (H-MB-05 confirmed).
  - HeroUI 1.0.10: `'disable-all'` via `useCombinedAnimationDisabledState`.
  - expo-linking 57.0.11: `useLinkingURL`.
- **Code** (JS only while step 67 was still building):
  - `src/motion/`: tokens, builders, policy (zustand store), use-motion-policy, motion-policy-provider, loops, glow-layer, haptics, debug-overlay, debug-metrics, prefs (mergeItem), log, index.
- **Tests:**
  - T-M12 `policy.test.tsx`: 20/20.
  - T-M14 `haptics.test.ts`: 37/37, including MA-20 as a test.
  - builders: 23/23. glow-layer: 9/9. debug-overlay: 5/5.
  - Motion total: 5 suites / 94 tests.
- **Fixes along the way:**
  - The haptics singleton's clock was captured at import, and its window leaked across tests → added a `now` lookup per call and `reset()`.
  - Frame-callback registry leak under fake timers → the overlay test drives `useFrameCallback` by hand; `afterEach` uses `clearAllTimers`.
  - An act warning from async prefs hydration → awaited inside act.
  - Four lint `array-type` warnings → `eslint --fix src/motion`.
  - My own comment matched the MA-20 grep → reworded.
- **Mutation check:** 6 mutations of `policy.ts` / `haptics.ts`, auto-restored with `shasum` OK. All six were caught (1, 4, 2, 2, 6 and 1 failures).
- **Final gate (03:03:52–03:04:01):**
  - mobile typecheck exit 0;
  - lint exit 0 (0 warnings);
  - jest `--maxWorkers=2 --forceExit`: 18 suites / 209 tests, exit 0.
- **MA-20 grep:** 1 hit, `src/features/home/home-screen.tsx:166` (row-18 proof screen; 01S §5.5; not writable by row 69) → F-69-1.
- **Device smoke** (after step 67's "NATIVE REINSTALL DONE", Metro 8083, `device-session.sh`, P10 bypass):
  - Phone 03:01:54–03:02:16: `Status: ok`, cold 4543 ms, no red box.
  - Tablet 03:02:34–03:02:58: kit bundled as an Android entry (HTTP 200, 1,336 modules), `Status: ok`, cold 3671 ms, no red box.
  - Worklets: 16/16 kit worklets carry a `__workletHash`.
  - hermesc: exit 0; 0 warnings from kit-authored code.
- **Processes (P7):**
  - Metro 89196 and 89628 were stopped by the helper. No 8083 listener remains.
  - My reverse rules were removed.
  - The adb server was left running: another lane holds a tablet session (reverse 8081→8082).
  - Emulators and mock-core were not touched.

## Decisions / drift / blockers (for the controller)

- **F-69-1 (needs ruling):** the MA-20 grep hits the row-18 proof screen's `Haptics.selectionAsync()`.
  - Recommended: the owner swaps it for `triggerHaptic('stackCheckTap')`, which is already in the map, so behaviour is identical. Alternative: amend the MA-20 grep.
  - The T-M14 MA-20 test lists this one file as pending.
- **D-69-2 (for step 70):** mount the provider with a render prop, `<MotionPolicyProvider>{(policy) => <AppProviders reducedMotion={policy === 'reduced'}>…}</MotionPolicyProvider>`.
- **D-69-3 (for steps 70, 73, 88):** `dems.mobile.prefs.v1` is a shared key. The kit writes `reduceMotion` and `haptics` via `mergeItem`; other owners must merge too.
- **D-69-4 / D43:** `?motion=off` (test switch, sticky), `?motion=slow`, `?motion=full`, `?debug=1|0` on any deep link.
- **D-69-9 drift (MINOR):** R1 enter has no scale, following the 04 §7.1 mapping (FadeInDown).
- Full list D-69-1..12: implementation/42 §6.
- Blockers: none.
