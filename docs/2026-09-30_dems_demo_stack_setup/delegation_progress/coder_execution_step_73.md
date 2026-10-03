# coder-execution — step 73 (mobile runtime and simulator wiring, M-06)

| Field | Value |
|---|---|
| Step | 73 (blueprint row 73; 05_mobile_plan M-06) |
| Agent | coder-execution (mobile lane B, Metro 8082 per P4) |
| Started | 2026-10-01 03:40 WIB |
| Status | complete |
| Output log | implementation/46_mobile_runtime_sim.md |
| Finished | 2026-10-01 04:50 WIB |

## Owned write paths (P6)

- `apps/mobile/src/runtime/**` (`index.ts` taken over from step 68)
- `apps/mobile/src/auth/**` (new)
- `apps/mobile/src/i18n/**` (merge; `index.ts` and `en.mobile.ts` taken over from step 68; `features.ts` stays step 70's)
- `apps/mobile/src/providers/app-providers.tsx` (taken over from step 68)

Never: `packages/shared/**` (SIM-GAP-n instead), `src/app/**` (step 70), npm install.

## Log

- 03:40 Inputs read: 02_structured row 73 + P1–P13; 04_mobile_specs §3.2–§3.8, §5, §6, §9–§11; 05_mobile_plan M-06 + §5–§6; implementation/41, 12, 13, 14, 15, 42; decisions D54–D62.
- 03:42 Concurrent: step 70 is writing `src/navigation/**` and `src/app/**` (mtimes 03:4x). Coordination by exports only.
- 03:45 Baseline before edits: mobile typecheck exit 0.
- 03:45–03:58 JS work: `src/runtime/{contract,sim-adapters,sim-runtime-provider,core-link,connection-banner,resync-bus,route-sync,session-route-sync,keep-awake,use-audio-shared-values,debug,log,internals,index}.ts(x)`; `src/auth/{auth-provider,auth-dialogs,auth-prefs,biometric,operators,index}.ts(x)`; `src/providers/app-providers.tsx` (slots 9 and 10, resync bus, log sinks); `src/i18n/index.ts` (shared `en` first layer), `en.mobile.ts` (+`mobile.idleLock.*`).
- ~03:59 Found: importing the `expo-router` entry from the runtime pulls ESM-only `standard-navigation` into every suite that renders AppProviders (only step 70's harness mocks it) → the runtime imports `expo-router/build/hooks` instead (same module instance).
- ~04:01 `act()` noise: hydration restructured so a mount costs ≤ 1 React update (combined sim + prefs gate; prefs stores re-render only on value change; biometric query lazy; dialogs mounted only when open).
- 04:02–04:10 Tests: T-M05 `src/auth/biometric.test.ts`, T-M06 `src/runtime/route-sync.test.ts`, T-M07 `src/runtime/sim-adapters.test.ts`, plus runtime, session-route-sync, audio, log and auth-provider suites; step-68 `providers/runtime-contract.test.tsx` rewritten for the simulator runtime; `i18n.test.ts` updated (shared layer). JS gate: typecheck 0, lint 0, jest 31 suites / 420 tests.
- 04:10 Step 70 had already switched its dev-only Login placeholder (`StubSignIn`) to sign in the first demo operator via `useAuth().signIn` — works with the simulator auth; used for the device sign-in.
- 04:15:41 Phone session run 1 (Metro 8082): **Render Error in AuthProvider on device** ("Cannot read property 'length' of undefined", React "change in the order of Hooks"). Cause: the Metro build runs the React Compiler (`app.json` experiments.reactCompiler, `transform.reactCompiler=true`), jest does not; the compiler memoized calls to the zustand bound hooks `authPrefsStore(...)` / `coreLinkPrefsStore(...)` (not named `use*`) and skipped them on re-render. logcat also shows the same error at 04:13:17 in another lane's session (PID 11412) — **any device session between ≈03:50 and 04:18 rendered this error**; affected lanes should re-run their device checks.
- 04:17 Session stopped; my reverse rules removed and the app force-stopped under the phone lock (lock was free). Fix: stores renamed `useAuthPrefsStore` / `useCoreLinkPrefsStore` (04:18); jest runtime/auth/providers 120/120 pass.
- 04:19 Phone session run 2 queued behind step 70's phone session (lock held since 04:18:29).
- 04:22–04:24 Phone session run 2: D54 (d) proven (`@noble/hashes/sha2.js` + `_md`, `_u64`, `utils` in the Hermes bundle; SHA-256("abc") = FIPS vector; audit chain ok 219); **MA-08 PASS** (sign-in → `/session/live`; timer grew 41,206 ms vs 41,206 ms wall; same session; history 13 → 13); route sync on device (STOPPING → finalizing → sealed summary); **MA-10 runtime part** (mock-core sole user: LIVE → kill → OFFLINE banner + tablet OFFLINE in 167 ms → precheck CORE BLOCK → restart → LIVE + "Resynced" in 489 ms → back to SIMULATED); mock-core released (last user).
- 04:25–04:27 Keep-awake diagnostic: `KEEP_SCREEN_ON` on the app window even idle/signed out → Expo `withDevTools` dev keep-awake (debug builds only; `node_modules/expo/src/launch/withDevTools.tsx:13-20`) (F-73-2).
- 04:30–04:31 Phone MA-19 with the Expo dev tag released through the inspector: idle 0 → RECORDING 1 → STOPPING 1 → SEALED 0 → **PASS**.
- 04:36–04:37 Tablet: D54 (d) again; **MA-08 PASS** (44,639 ms vs 44,634 ms wall; no second session); route sync to the summary. 04:37–04:41 tablet MA-19 attempt invalid (my cleanup had stopped the engine in the reused process); 04:42–04:45 rerun in a fresh session: idle 0 → RECORDING 1 → SEALED 0 → **PASS**.
- 04:45 Clean: 8082 and 4400 free; mock-core users empty, pid removed; tablet reverse empty; the phone's current 8081 rules belong to another lane's live session (untouched).
- 04:4x Mutation checks (mutants via jest moduleNameMapper, no live source touched): T-M06 3 failed, T-M07 4 failed, T-M05 2 failed; originals 60/60.
- 04:46 Final gate: typecheck 0, lint 0, jest 33 suites / 437 tests pass; MA-28 21 importers; MA-16/MA-22/MA-25 greps clean.
- 04:50 `implementation/46_mobile_runtime_sim.md` written. Status: complete.

## Proposed for decisions.md / Drift Log (controller)

- **F-73-1 (relay now):** the Metro build runs the React Compiler, jest does not; zustand store hooks must be named `use…` or the compiler skips them (hook-order Render Error). Any lane's device session between ≈03:50 and 04:18 WIB showed a Render Error in AuthProvider (logcat 04:13:17 PID 11412) → re-run those device checks.
- **F-73-2:** debug builds always keep the screen on (Expo `withDevTools`); MA-19 must isolate the dev tag (procedure in 46 §5.3) or use a release build — relay to steps 59, 61, 60.
- S73-9 drift (additive): new AsyncStorage key `dems.mobile.log.v1` (persistent runtime log, privacy-filtered) — for step 63.
- S73-10: `__DEV__`-only `&scenario=` deep links and `__DEMS_DEBUG__` handle — for step 63.
- S73-11: runtime imports `expo-router/build/hooks` (jest cannot load the entry's ESM `standard-navigation`); F-73-3 suggests the jest allowlist fix (jest.config.js owner).
- S73-17 drift: step-68 `src/providers/runtime-contract.test.tsx` rewritten in place (it pinned the stub step 73 replaces).
- SIM-GAP: none. P12: none.
