---
task_id: 2026-09-30_dems_demo_stack_setup
step: 69
plan_row: 05_mobile_plan §3 M-02 (motion part, part b)
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete (one item for a controller ruling: F-69-1)
---

# Step 69: mobile motion kit (`apps/mobile/src/motion`)

**Outcome: PASS on every row-69 check, with one controller item.**

- T-M12 passes: 20/20 tests.
- T-M14 passes: 37/37 tests.
- The full mobile suite passes: 18 suites, 209 tests.
- Mobile typecheck and lint exit 0.
- Mutation runs show that T-M12 and T-M14 catch regressions.
- **F-69-1:** the MA-20 grep has exactly one hit. It is outside `src/motion`, in the row-18 proof screen `src/features/home/home-screen.tsx:166`. That screen makes the call because 01_specs §5.5 specifies it. Row 69 may not write that file (P6), so the change needs a controller ruling (§6).
- The device smoke passed on both AVDs:
  - no regression on launch;
  - Metro bundled the kit as an Android entry, and every worklet was transformed;
  - `hermesc` compiled that bundle.

Nothing outside `apps/mobile/src/motion/**` was written in the code. The two screencaps are under `implementation/assets/mobile/`. No package was installed, and no `package.json`, `jest.config.js`, `jest.setup.ts`, `_layout.tsx`, `providers/**` or `packages/shared/**` file was touched.

## 1. Files (all new, `apps/mobile/src/motion/`)

| File | Lines | Content |
|---|---|---|
| `tokens.ts` | 127 | Token → Reanimated mapping (§7.1): `springConfig`, `timingConfig`, `EASING` (4 bézier factories), `durationMs`, `staggerDelay` (R1: 80 + i × 60, cap 8), `ambientPeriodMs`, `slowSpringTiming` (proof ×10), `MotionPolicy` / `MotionSettings`, `SPEC_LITERALS` (non-token spec values, D49 N-1). All helpers are worklets |
| `builders.ts` | 341 | Value animations: `animateSpring`, `animateTiming`, `animateFade`, `animateBreath`, `animateRotation`, `animateRecPulse`, `animatePulseOnce`, `animateShake`, `animateAfter`. Layout builders: `enterRise` (R1), `exitUp` (R2), `layoutTransition` (FLIP), `listInsert` (M-C-07), `rowReveal` (M-C-11), `crossFadeIn` / `crossFadeOut`. `stackAnimation` (M-APP-04). Each builder applies full, proof (×10) or reduced motion itself (03M §8) |
| `policy.ts` | 236 | Module-level zustand store: OS setting, in-app override, Haptics switch, deep-link switches, overlay flag, app state. Pure `resolvePolicy`, `resolveSlow`, `reducedReasons`, `parseMotionLink`, `kitAnimation` (`'disable-all'`) |
| `use-motion-policy.ts` | 89 | `useMotionPolicy`, `useMotionSettings`, `useReducedReasons`, `useMotionState`, `useAmbientLoop`, `useMotionPreferences` |
| `motion-policy-provider.tsx` | 122 | `MotionPolicyProvider` (see §2), `reducedMotionMode` |
| `loops.ts` | 52 | Ambient-loop registry for the overlay, plus the P3 cap warning above 4 |
| `glow-layer.tsx` | 134 | `GlowLayer` (see §2), `glowShadow`, `layerOpacities` |
| `haptics.ts` | 191 | The one expo-haptics caller: `HAPTIC_EVENTS` (the §7.6 map), `createHapticsService`, `haptics`, `triggerHaptic`, `useHaptics`, 400 ms coalescing |
| `debug-overlay.tsx` | 144 | `MotionDebugOverlay` (`?debug=1`): UI fps (`useFrameCallback`), JS fps (rAF), meter frames/s per channel, running loops, policy and reasons |
| `debug-metrics.ts` | 44 | `fpsFromWindow` (worklet), `reportMeterFrame`, `drainMeterFrames`, `setMeterFrameCounting` |
| `prefs.ts` | 48 | `dems.mobile.prefs.v1`: reads the shared object, writes only `reduceMotion` and `haptics` through `AsyncStorage.mergeItem` |
| `log.ts` | 60 | Structured issue records (timestamp, level, source, message, stack, context) and a `setMotionLogSink` hook |
| `index.ts` | 120 | Barrel: `import { … } from '@/motion'` |
| `policy.test.tsx` | 262 | **T-M12** |
| `haptics.test.ts` | 280 | **T-M14**, plus MA-20 as a test |
| `builders.test.ts` | 248 | Mapping and builder numbers against the shared tokens |
| `glow-layer.test.tsx` | 119 | Opacity cross-fade, breathing as a loop, pulse, reduced |
| `debug-overlay.test.tsx` | 128 | Hidden by default, the four readouts, the `?debug=1` / `?debug=0` deep link |

## 2. API for the consumer steps

### Root layout (step 70; `_layout.tsx` is step 68's, then 70's)

```tsx
import { MotionPolicyProvider } from '@/motion';
<MotionPolicyProvider>
  {(policy) => <AppProviders reducedMotion={policy === 'reduced'}>…</AppProviders>}
</MotionPolicyProvider>
```

- A render prop is needed because a component cannot read, through a hook, a provider it renders itself. The step-68 comment in `_layout.tsx` suggests `reducedMotion={useMotionPolicy() === 'reduced'}` in the same component; the render prop replaces that.
- `heroUIConfig(true).animation === kitAnimation('reduced') === 'disable-all'`. T-M12 asserts this.
- The provider does the following:
  - seeds the OS value from Reanimated's start-time `useReducedMotion()`, then follows `AccessibilityInfo.isReduceMotionEnabled()` and `reduceMotionChanged` live;
  - reads the persisted switches;
  - follows every incoming deep link (`expo-linking` `useLinkingURL`) and `AppState`;
  - renders `<ReducedMotionConfig mode={reduced ? ReduceMotion.Always : ReduceMotion.Never}>`;
  - mounts the overlay. `debugOverlay={false}` lets another component mount `MotionDebugOverlay` itself.

### Deep-link switches (D43, §3.5, §7.1)

They are sticky per app process, and a later link changes them only if it carries the parameter.

| Parameter | Effect |
|---|---|
| `?motion=off` (`reduced` and `none` are aliases) | **The D43 test switch.** The policy becomes reduced, so every ambient loop stops, the kit gets `disable-all` and `ReducedMotionConfig` is `Always`. uiautomator and Maestro can then reach idle. Steps 57 and 90 flows use it, for example `demsdemo:///home?motion=off` |
| `?motion=slow` | Proof mode: every duration and stagger ×10, and springs become `withTiming(slower × 10)`. It applies only while the policy is full |
| `?motion=full` (`on`, `normal` and `default` are aliases) | Clears the `?motion=` switch |
| `?debug=1` / `?debug=0` | The performance overlay (MA-17) |

### What the other steps use

| Consumer | Use |
|---|---|
| Compositions (step 71) | The `motion` prop takes `useMotionPolicy()` directly. The types match: `'full' \| 'reduced'` |
| Screens (steps 75–89) | Builders take `useMotionSettings()`: `entering={enterRise(i, m)}`, `exiting={exitUp(m)}`, `layout={layoutTransition(m)}`, `sv.set(animateSpring(1, 'indicator', m))`. Loops: `const running = useAmbientLoop('rec-pulse', { active: recording, paused: !focused })` |
| Haptics | `const haptic = useHaptics(); haptic('tabSelect')`, or `triggerHaptic('micClip')` outside React. Never `Haptics.*` directly (MA-20; a test enforces it) |
| Settings (step 88) | `useMotionPreferences()` exposes `reduceMotionOverride`, `hapticsEnabled`, `debugOverlay` and their setters, plus `error` (`'read' \| 'write'`) for a toast |
| Runtime (step 73) | Call `reportMeterFrame(channelId)` once per 20 Hz frame in `useAudioSharedValues`. It costs one boolean check unless the overlay is on. `setMotionLogSink(fn)` can route motion issue records into the runtime's log |
| `GlowLayer` (03M §9.2) | Use it as the first child of a positioned container: `<GlowLayer level={2} radius={12} />`, plus `breathe` (e2 ↔ e3 over `glowBreath`, a registered loop), `pulseKey` (one escalation pulse, R8) and `tone` (for example `'success'` for Verify PASS; token geometry and alphas, tone colour) |

## 3. Verification (row-69 checks, fresh runs 03:03:52–03:04:01)

| # | Row-69 check | Command | Result |
|---|---|---|---|
| 1 | T-M12 passes (MA-18 unit part) | `npx jest --maxWorkers=2 src/motion/policy.test.tsx` | `Tests: 20 passed, 20 total`. Covers the OS setting at launch; a live OS change and back; the override, persisted by merge with other owners' fields kept; the override read at launch; unreadable prefs; hydration not undoing a user toggle; `?motion=off`, sticky until `?motion=full`; `?motion=slow`; background pause; kit `disable-all` through HeroUI's own `useCombinedAnimationDisabledState` under `heroUIConfig(policy === 'reduced')`; the `ReducedMotionConfig` mode `never` or `always` |
| 2 | T-M14 passes (MA-20) | `npx jest --maxWorkers=2 src/motion/haptics.test.ts` | `Tests: 37 passed, 37 total`. The 24 map events each produce the exact expo-haptics call and argument; the event set equals the §7.6 table plus 2 documented additions; the 400 ms leading and trailing coalescing; at most one haptic per 400 ms under a 20 Hz stream; the switch off and on; not reduced by reduce motion; a rejected haptic is reported and never thrown; `useHaptics` is stable |
| 3 | The MA-20 grep finds no Haptics call outside `src/motion/haptics` | `grep -rn "Haptics\." apps/mobile/src \| grep -v motion/haptics` | **1 hit:** `apps/mobile/src/features/home/home-screen.tsx:166: void Haptics.selectionAsync();`. This is the row-18 proof screen, required there by 01_specs §5.5 and outside row 69's paths (see F-69-1). No hit from any file step 69 wrote. A comment of mine that matched (`policy.ts:55`, "Haptics. Persists") was reworded |
| 4 | Mobile typecheck | `npm run typecheck -w @dems/mobile` | `tsc --noEmit`, exit 0 |
| 5 | Mobile lint | `npm run lint -w @dems/mobile` | `eslint .`, exit 0, 0 warnings (four `array-type` warnings in my tests were fixed with `eslint --fix src/motion`) |
| 6 | Mobile jest | `npm test -w @dems/mobile -- --maxWorkers=2 --forceExit` | `Test Suites: 18 passed, 18 total`, `Tests: 209 passed, 209 total`, exit 0. This includes steps 68 and 71's suites. `--forceExit`: the row-18 test keeps jest alive for about 5 minutes after the run (React Query `gcTime`, step 71's observation) |

**Additional checks:**

| Check | Command | Result |
|---|---|---|
| Motion suites alone | `npx jest --maxWorkers=2 src/motion` | `5 passed`, `94 passed`; no console error or warning (act warnings found on the way were fixed; §6 D-69-11) |
| **Mutation check** (tests are not vacuous) | Six in-place mutations of my own `policy.ts` and `haptics.ts`, each auto-restored by a trap (sources backed up; `shasum -c` afterwards: both `OK`). Window about 3 s each | M1 `kitAnimation` always undefined → T-M12 1 failed. M2 override ignored → 4 failed. M3 `?motion=off` ignored → 2 failed. M4 `micClip` mapped to `error` → T-M14 2 failed. M5 no coalescing → 6 failed. M6 Haptics switch ignored → 1 failed |
| H-MB-05 (`withInitialValues` sets the rise) | Source: Reanimated 4.5.1 `FadeInDown.build()` → `pickTransformValues([{ translateY: 25 }], initialValues)` → `resolveTransformSlot` reads `values.translateY`. Test: `enterRise(2, FULL).build()().initialValues` | `{ opacity: 0, transform: [{ translateY: 12 }] }` → **H-MB-05 confirmed**; the fallback is not needed |
| Hex literals in kit code (MA-22 style; `src/motion` is not in MA-22's scope) | `grep -rnoE "#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?" apps/mobile/src/motion --include='*.ts' --include='*.tsx' \| grep -v '\.test\.'` | No match. Colours come from `palette`, `derived`, `elevation` and `toneHex` |

## 4. Device smoke (P3, after step 67's "NATIVE REINSTALL DONE on both AVDs", 02:38:10)

**Setup:**
- Metro lane **8083**. Step 67 released it at 02:45 ("8081–8086 … free"), so the 8084 fallback was not needed (P4).
- Helper: `LOCK_WAIT=900 SESSION_MAX_SECS=900 METRO_PORT=8083 apps/mobile/scripts/device-session.sh <avd> '. <scratch>/session.sh'`, with a per-command sandbox bypass (P10). The helper force-stopped `com.dems.demo.tablet` before the launch (D43).

**Scope:** the kit is not mounted in the app yet. `_layout.tsx` belongs to steps 68 and 70, so Metro's app bundle does not include `src/motion` today. The smoke therefore proves three things:
- (a) no regression on launch;
- (b) the kit builds for Android under the real Babel and worklets transform;
- (c) Hermes accepts it.

The runtime policy on a device (the MA-18 device part, `?motion=off` idle, `?debug=1` overlay) becomes testable when step 70 mounts `MotionPolicyProvider`; see recommendation R-1.

| AVD | Session | Evidence |
|---|---|---|
| dems_phone (emulator-5554) | 03:01:54–03:02:16, exit 0 | `am start -W … demsdemo:///` → `Status: ok`, `LaunchState: COLD`, `TotalTime: 4543`; app PID 8349. Metro: `Android Bundled 1331ms node_modules/expo-router/entry.js (5135 modules)`. Logcat (`ReactNativeJS`, `AndroidRuntime:E`): 11 lines, only info (the "Running main" line and the HeroUI styling banner), no error. Screencap `assets/mobile/69_dems_phone_launch_no_regression.png` shows the proof card with no red box. "Offline" and "Core unreachable" are expected because mock-core was not started (not needed; P5) |
| dems_tablet (emulator-5556) | 03:02:34–03:02:58, exit 0 | **The kit as an Android entry:** `GET http://127.0.0.1:8083/apps/mobile/src/motion/index.bundle?platform=android&dev=true&minify=false` → HTTP 200, 7,652,052 bytes; Metro `Android Bundled 3621ms apps/mobile/src/motion/index.ts (1336 modules)`. Launch: `Status: ok`, `COLD`, `TotalTime: 3671`, PID 7055, `Android Bundled 715ms … entry.js (5123 modules)`, 11 info-only logcat lines. Screencap `assets/mobile/69_dems_tablet_launch_no_regression.png` shows the two-pane proof layout with no red box |
| Worklet transform | Node scan of the kit bundle | Each of the 16 kit worklets carries a `__workletHash`: `durationMs`, `springConfig`, `timingConfig`, `staggerDelay`, `ambientPeriodMs`, `slowSpringTiming`, the nine `animate*` builders and `fpsFromWindow`. The bundle contains all 13 kit source modules (`src/motion/{index,tokens,builders,policy,log,prefs,use-motion-policy,loops,motion-policy-provider,debug-overlay,debug-metrics,glow-layer,haptics}`) |
| Hermes | `node_modules/hermes-compiler/hermesc/osx-bin/hermesc -emit-binary -out motion.android.hbc motion.android.js` | Exit 0 (no error); 4,474,884-byte `.hbc`. 63 warnings, each attributed to its module by bundle line: **58** in library modules (undeclared-global notices such as `localStorage`, `navigator`, `fetch`, and 4 × `eval` in dev tooling); **3** in Metro's prelude `metroRequire` (`console`, `setTimeout`, `Promise`); **2** are the Fast Refresh globals `$RefreshSig$` / `$RefreshReg$`, which Babel's dev transform injects into `use-motion-policy.ts` and `motion-policy-provider.tsx` and Metro's runtime provides. **None comes from kit-authored code.** The first request (`/src/motion/index.bundle`) returned 404 because Metro's server root is the workspace root; the corrected path is above |

**Processes (P7):**
- The helper started Metro 89196 (phone) and 89628 (tablet) and stopped both ("Metro … stopped"). Afterwards there was no 8083 listener and no `expo start … 8083` process.
- My reverse rules were removed. The rules seen on emulator-5556 afterwards (`tcp:8081 → tcp:8082`, app PID 7170) belong to another lane's session (Metro 8082) and were left alone.
- The adb server is shared with that live session, so it was not stopped.
- Emulators were not touched (P3).
- mock-core was not started.
- Scratch files (bundle, `.hbc`, logcat, session script) are in the session scratchpad, outside the workspace.

## 5. Spec mapping (04_mobile_specs §7 → kit)

| Spec | Kit |
|---|---|
| §7.1 durations and easings | `timingConfig`, `animateTiming`, `EASING` |
| §7.1 springs, including NEW `counter`, `meter`, `indicator` | `springConfig`, `animateSpring` |
| §7.1 R1 enter | `enterRise` |
| §7.1 R2 exit | `exitUp` |
| §7.1 Layout | `layoutTransition` |
| §7.1 Proof mode | `durationMs`, `staggerDelay`, `slowSpringTiming` |
| §7.1 Loops | `animateBreath`, `animateRotation`, `animateRecPulse` + `useAmbientLoop` (AppState pause; focus through `paused`) |
| §7.2 M-APP-04 | `stackAnimation`, `crossFadeIn`, `crossFadeOut` |
| §7.4 M-C-05 | `animateRecPulse` |
| §7.4 M-C-07 | `listInsert` + `SPEC_LITERALS.highlightFadeMs` |
| §7.4 M-C-10 | `GlowLayer pulseKey` |
| §7.4 M-C-11 | `rowReveal` |
| §7.4 M-C-18 | `animatePulseOnce` |
| §7.4 M-C-19 | `holdProgress` / `endSessionHold` haptics |
| §7.4 M-C-22 | `animateShake` |
| §7.6 | `haptics.ts` |
| §7.7 sources and wiring | `MotionPolicyProvider`, `useMotionPolicy`, `kitAnimation` |
| §7.7 test hook | `transition_animation_scale 0` reaches the policy through `AccessibilityInfo` (live) and Reanimated's start value |
| §7.8 overlay | `MotionDebugOverlay`, `reportMeterFrame`, loop registry |

## 6. Decisions, drift and findings (for the controller)

| ID | Item | Resolution |
|---|---|---|
| **F-69-1** | **MA-20 grep: 1 hit outside the service.** `src/features/home/home-screen.tsx:166` (`void Haptics.selectionAsync()` on "Show test toast"). 01_specs §5.5 requires that call on the row-18 proof screen, and the file is kept unchanged for AC-31 and N-1. No P6 row owns `src/features/home/**`, and row 69 may write only `src/motion/**`, so it was **not edited** | **Needs a controller ruling.** Recommended: a one-line change by an assigned owner (step 70, or a controller-approved edit): `import { triggerHaptic } from '@/motion'` and `triggerHaptic('stackCheckTap')`. `stackCheckTap` is already in the map as `selection`, so behaviour stays identical, and the AC-31 greps (`entering=\{FadeIn(Down\|Up)`) are unaffected. Alternative: amend the MA-20 grep with `\| grep -v features/home/home-screen.tsx`. The T-M14 test enforces MA-20 over all of `src/` with this one file listed in `PENDING_OWNER_CHANGE`; delete that entry once the change lands |
| D-69-1 | Policy state lives in a module-level store (zustand 5.0.15, already a dependency), not a React context | `useMotionPolicy()` works without a provider (default full). Composition and screen tests therefore need no wrapper, and non-React code (the haptics service) reads the Haptics switch. The provider feeds the store |
| D-69-2 | Root-layout wiring | A render prop, `{(policy) => <AppProviders reducedMotion={…}>}` (§2). It replaces the step-68 comment's same-component `useMotionPolicy()` suggestion. For step 70 |
| D-69-3 | Shared prefs key `dems.mobile.prefs.v1` (§5.3) | The motion kit owns the fields **`reduceMotion`** and **`haptics`** and writes them only through `AsyncStorage.mergeItem`. T-M12 shows `coreLinkSource` and `railCollapsed` survive. **Other owners of the key (Core link source, presentation mode, rail collapse: steps 70, 73, 88) must also merge, never `setItem` the whole object** |
| D-69-4 | Deep-link switches | Read from `expo-linking` `useLinkingURL()` (every incoming URL, including `am start -d`), parsed by hand because Hermes' `URL` lacks `searchParams`. Sticky per process; `?motion=full` and `?debug=0` reset them. The row-18 proof route keeps reading its own `?motion=slow`, so AC-31 is unchanged |
| D-69-5 | Overlay availability | The overlay shows whenever the flag is on, in any build: `?debug=1` on any URL (§3.5) or `setDebugOverlay(true)`. The Settings switch is session-only, because §5.3's key list has no overlay field. Whether step 88 shows the switch only in debug builds (§4.15) is step 88's call |
| D-69-6 | Reanimated's `ReducedMotionConfig` prints one dev `console.warn` on mount ("Reduced motion setting is overwritten with mode …"). A LogBox banner would cover the bottom bar in screencaps and Maestro taps | `LogBox.ignoreLogs([...])` for that exact message prefix in `motion-policy-provider.tsx`. Metro still prints it. The override is the design (VM-05 explicit modes) |
| D-69-7 | "At most one haptic per 400 ms (coalesced)" (§7.6) needed an exact rule | Leading edge: the first event of a window plays at once. Later events in the window collapse into one pending event (the strongest); it plays when the window ends only if it is stronger than the one that played. Strength: selection < light < medium < heavy < success < warning < error. So a tap burst gives one tick, and an Error right after a tap is still felt (≤ 400 ms later) |
| D-69-8 | Map additions beyond the §7.6 table | `holdProgress: 'light'` (M-C-19 "light at 0% and 50%") and `stackCheckTap: 'selection'` (01S §5.5, for F-69-1). The test lists both with their sources |
| D-69-9 | **Drift (MINOR), R1 enter scale.** 03M R1 lists `scale enterFrom → 1`; the mobile mapping §7.1 specifies `FadeInDown.springify()…`, which animates opacity and translateY only | Followed §7.1, the mobile contract. `motion.scale.enterFrom` stays available for a screen that needs a scale enter, for example dialogs, which the kit animates itself |
| D-69-10 | Error logging (agent STEP 3) | No client log endpoint exists (D41(g)). Every catch path (prefs read and write, OS query, haptic playback, loop cap) writes one structured record (`timestamp`, `level`, `source`, `message`, `stack`, `context`, no user data) to the dev console, as step 68 does. `setMotionLogSink(fn)` lets step 73 persist them, for example into the simulator's log. The user-facing layer: prefs failures set `prefsError` for Settings to show a toast; haptic failures are silent by design (non-essential feedback) |
| D-69-11 | Test mechanics | Reanimated's jest frame-callback registry is global and runs on its own timer queue. A real `useFrameCallback` mounted and unmounted in one test threw `Cannot set properties of undefined (setting 'startTime')` in a later test. The overlay test drives the UI-fps worklet by hand (61 frames 1000/60 ms apart → "UI 60 fps"). `afterEach` uses `cleanup()` + `jest.clearAllTimers()`; `act(runOnlyPendingTimers)` had produced "act(async) without await" warnings. The shared `haptics` singleton gained `reset()`, because Jest's fake clock restarts per test while the service kept its window |
| D-69-12 | `SPEC_LITERALS` | Held beat 120, highlight fade 1,500, row stagger 30, escalation pulse 600, shake 300 ms with `[0, −6, 6, −4, 4, 0]`, haptic gap 400. These are spec values that are not tokens; each cites its source, and none was added to `@dems/shared` (D49, 11_token_pipeline N-1) |
| P11 | Concurrency noise | None hit. Steps 68 and 71's suites passed in every full run |
| Parallel isolation | Shared tracking files | Per the delegation, not written: `masterplan/02_plan.md` (its tables have no per-step status column for rows 25–93), `status_tasks.md`, `delegation_progress_report.md`, `implementation/99_implementation_report.md`. Progress is in `delegation_progress/coder_execution_step_69.md` |

## 7. Recommendations for later steps

- **R-1 (step 70).** After mounting `MotionPolicyProvider`, add three on-device checks:
  - `demsdemo:///?motion=off` → `adb shell uiautomator dump` succeeds (idle reached, D43);
  - `…&debug=1` → a screencap shows the overlay;
  - `adb shell settings put global transition_animation_scale 0` → policy reduced (restore `… 1`).

  The MA-18 ring diff itself belongs to step 77 (Home).
- **R-2 (step 73).** Call `reportMeterFrame(channelId)` in the transient audio path, and consider `setMotionLogSink` to persist motion issues.
- **R-3 (steps 57 and 90, Maestro).** Launch flows with `?motion=off` (D43).
- **R-4 (F-69-1).** Route the proof-screen haptic through `triggerHaptic('stackCheckTap')`, then remove the test's `PENDING_OWNER_CHANGE` entry.
