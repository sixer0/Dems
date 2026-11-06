# coder-execution — step 70 (mobile navigation shell, M-03)

| Field | Value |
|---|---|
| Step | 70 (blueprint row 70; 05_mobile_plan M-03) |
| Agent | coder-execution (mobile lane; Metro 8081, P4) |
| Started | 2026-10-01 ~03:10 WIB |
| Finished | 2026-10-01 05:03 WIB |
| Status | **complete** (PASS on every row-70 check; controller items: DR-S70-3, F-70-3) |
| Output log | implementation/43_mobile_navigation_shell.md |

## Log

- 03:10 Inputs read: 02_structured row 70 + P1–P13; 04_mobile_specs §2, §3, §4.0, §4.15, §4.17–§4.19, §5.3, §7.5–§7.8, §9, §10.1, §11; 05 M-03; 41_mobile_foundation, 42_mobile_motion_kit; D17, D38, D43, D55, D56, D57.
- 03:20 Jest experiment (own file, deleted after 2 min): `Stack.Protected` sends a guarded launch URL to the anchor `/` without its query; `+native-intent` receives the launch URL. Found: test files inside `src/app` would be bundled as routes by Metro (`_ctx.android.js` regex), so T-M02/T-M03 live in `src/navigation/__tests__/` (drift, recorded).
- 03:30 Code written: `src/navigation/**`, `src/components/composed/nav/**`, `src/app/**` (route tree), 20 feature stubs + 16 empty `i18n.ts`, `src/i18n/features.ts`; `_layout.tsx` with the D57 render prop; F-69-1 line; D56 jest.setup line.
- 03:45 `npm run typecheck|lint -w @dems/mobile` exit 0; jest 23 suites / 317 tests pass (`--maxWorkers=2`).
- 03:52 Phone session 1 found two React Compiler issues in step-70 code and fixed them: (1) a zustand bound store called without a `use` name (`railPrefsStore(...)`) is memoised by the compiler → hook order changes → crash; renamed `useRailPrefsStore`. (2) React Navigation's `NavigationContent` (headless tabs) must re-render with its hook; compiler memoisation froze the tab content on the first tab → `'use no memo'` in `AppTabs` (and in the boot router, which reads the pending href during render). Root `ErrorBoundary` now mounts its own GestureHandlerRootView + SafeAreaProvider + HeroUINativeProvider (it crashed without a provider).
- 03:58 **Heads-up for step 73 (running concurrently, P11):** the same compiler bug is in `src/runtime/core-link.ts:125-127` (`coreLinkPrefsStore((s) => …)` in `RuntimeBridge`): on device the app shows "Render Error: Cannot read property 'length' of undefined" at every cold start. Fix: name the bound store `useCoreLinkPrefsStore` (every zustand `create()` result must start with `use`). Step 70 did not edit `src/runtime/**` (P6). Device checks wait for it.
- 04:02 **Heads-up 2 for step 73 / controller (P11):** `src/runtime/session-route-sync.tsx` now imports `expo-router`, so every jest suite that imports `@/runtime` (policy, app-providers, runtime-contract) fails to parse: expo-router 57 requires `standard-navigation` (an 8-line ESM-only package) that the step-67 `jest.config.js` does not transform. Step 70's tests avoid it with `src/navigation/testing/router-testing-setup.ts` (import it first: it maps `standard-navigation` to a CommonJS stub, mocks Skia, stubs expo-linking). Durable fix (one token, `jest.config.js` is not step 70's): add `standard-navigation` to the `transformIgnorePatterns` allowlist. Step 70 re-runs jest after this settles.
- 04:02 StubSignIn now signs in `OPERATORS[0]` with `DEMO_OPERATOR_PASSWORD` from `@dems/shared/sim` (dev builds only), so device checks work with the step-73 simulator auth before the Login screen (step 75).
- 04:11 P11 second run after step 73 moved its runtime to `expo-router/build/hooks`: typecheck 0, lint 0, jest **31 suites / 420 tests** pass, exit 0 (includes step 73's suites).
- 04:12 Waiting for step 73 to rename `coreLinkPrefsStore` (`src/runtime/core-link.ts:132-139`, still unrenamed at 04:11): every cold start renders "Render Error … 'length' of undefined" in `RuntimeBridge` under the React Compiler, which blocks all device checks (P11: cause is a concurrently running step's file).
- 04:13 Device probe (phone, cold start `demsdemo:///`): same React Compiler crash, now in `src/auth/auth-provider.tsx:102-103` (`authPrefsStore((s) => …)` in `AuthProvider`), besides `src/runtime/core-link.ts:132-139`. **Step 73: every zustand bound store called as a hook must be named `use…`** (`useAuthPrefsStore`, `useCoreLinkPrefsStore`); jest does not run the compiler, only the device bundle does (`transform.reactCompiler=true`). Check: `grep -rnE "[a-z][A-Za-z]*Store\(\(" apps/mobile/src` should list only `use…` names.
- 04:18 Step 73 renamed its stores (D66 relay received). All device evidence in the output log comes from runs after 04:18 (P11: earlier runs recorded in §4.5 of the log).
- 04:26–04:49 Device, current tree. Phone runs 4 and 6; tablet sessions 1–3. Results:
  - MA-12 chrome: 232 dp rail, 8 items, 2560×1600.
  - MA-13 chrome: tablet portrait 88 dp rail with labels; phone landscape 72 dp icon rail; same PID; selection kept; recording timer running.
  - MA-14: no cutout reported by the AVD (DisplayCutout insets 0); bar items above the 24 dp bottom inset.
  - MA-15 proof: warm and cold, mid ≠ final on both AVDs.
  - D57: `?motion=off` idle dumps, `?debug=1` overlay, `transition_animation_scale 0` → "motion reduced (os)", restored to 1.0.
  - Recording scenario (debug) restored to idle; rail collapse restored.
- 04:55–04:59 Found on device (run 7), fixed and re-verified (run 8): a guarded link arriving while signed out on a public screen was dropped. `+native-intent` now opens `/login` and keeps the pending href; after the sign-in, a public screen left on top goes to the boot router. Jest mutation-checked.
- 04:59 Final JS gate: typecheck 0, lint 0 (0 warnings), jest 33 suites / 439 tests, exit 0. MA-20 and MA-25 greps clean over `apps/mobile/src`.
- 05:03 Output log `implementation/43_mobile_navigation_shell.md` written. All Metro instances and reverse rules were stopped by the helper; the 3 background wait loops were stopped; the emulators were not touched.
