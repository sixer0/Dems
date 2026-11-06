---
task_id: 2026-09-30_dems_demo_stack_setup
step: 68
plan_row: 05_mobile_plan §3 M-02 (part a); §6
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete
---

# Step 68: Mobile foundation without the simulator (M-02, part a)

**Outcome: PASS.** Every row-68 acceptance check passes, including the final P11 re-run of the mobile typecheck (exit 0 at 02:50:58, §4.1).

Delivered, per 04_mobile_specs §2.2 and §3.2:
- **Layout:** layout classes with `SafeScreen` and `PaneLayout`.
- **Providers:** `AppProviders` without simulator, auth or motion, wired into the existing `src/app/_layout.tsx`. The file was edited, not renamed.
- **Runtime stub:** the typed runtime contract stub `src/runtime/index.ts`.
- **Kit recipes:** `StatusChip`, `SubjectTypeChip`, `SectionCard` and `KeyValueList`.
- **i18n:** `src/i18n/index.ts`, `en.mobile.ts` and an empty `features.ts` registry.
- **CSS:** `src/global.css` needed no change.

The device smoke ran after step 67 reported its reinstall (02:38:10). It shows no regression on either AVD.

## 1. Files

| File | Change | Next owner (P6) |
|---|---|---|
| `apps/mobile/src/layout/use-layout-class.ts` | new: `layoutClassFor`, `navChromeFor`, `useLayoutClass`, `BREAKPOINTS` (600 / 840 / H 480 / extended rail 1200), `NAV_DIMENSIONS` (60 bar, 72 / 88 / 232 rails, 48 / 64 headers) | 68 |
| `apps/mobile/src/layout/use-layout-class.test.ts` | new: **T-M01** | 68 |
| `apps/mobile/src/layout/safe-screen.tsx` | new: `SafeScreen` (`testID="screen-<id>"`, design-black canvas, safe-area padding; optional scroll with an additive bottom-inset spacer), `ChromeInsetsProvider`, `useScreenEdges`, `ALL_EDGES` | 68 |
| `apps/mobile/src/layout/pane-layout.tsx` | new: `PaneLayout` (stacks on `compact` by default, `stackOn` override), `Pane` (`testID="pane-<name>"`, `width` / `flex` / `minWidth` / `hideWhenStacked`), `PANE_REFLOW` (M-MB-03 `LinearTransition` on the `gentle` spring, `ReduceMotion.System`), `PANE_GAP` 16 / 24 | 68 |
| `apps/mobile/src/layout/index.ts`, `layout.test.tsx` | new: barrel and tests | 68 |
| `apps/mobile/src/providers/app-providers.tsx` | new: `AppProviders` (§3.2 order), `heroUIConfig`, `createAppQueryClient`, `MAX_FONT_SIZE_MULTIPLIER` | **73** |
| `apps/mobile/src/providers/boot-gate.tsx` | new: `BootGate`. It holds the splash until `useRuntimeStatus().ready`, at most `SPLASH_MAX_HOLD_MS` = 2,000 ms, then shows the Skeleton boot screen `screen-boot` (§3.2, M-MB-05) | 68 |
| `apps/mobile/src/providers/index.ts`, `app-providers.test.tsx`, `runtime-contract.test.tsx` | new: barrel and tests | 68 |
| `apps/mobile/src/runtime/index.ts` | new: typed runtime contract **stub** (§3 below) | **73** |
| `apps/mobile/src/components/kit/{cn,status-chip,subject-type-chip,section-card,key-value-list,index}.ts(x)`, `kit.test.tsx` | new: the four recipes plus `cn` (D41(d)) | 68, then screen steps as consumers only |
| `apps/mobile/src/i18n/index.ts` | new: app i18next instance, synchronous init, `buildEnResources`, `getMissingKeys` / `resetMissingKeys` (MA-21 recorder) | **73** |
| `apps/mobile/src/i18n/en.mobile.ts` | new: the `mobile.*` namespace. It holds nav, mini-bar, back guard, biometric, pairing, Core link, haptics, subject types, boot and error-boundary copy, each quoted from the 04 section named in the file | 68, then 73 (i18n) |
| `apps/mobile/src/i18n/features.ts` | new: empty `FEATURE_RESOURCES` registry | **70** |
| `apps/mobile/src/i18n/resources.ts`, `i18n.test.ts` | new: `ResourceTree`, `mergeResources` (deep, non-mutating, override report), tests | 68 |
| `apps/mobile/src/app/_layout.tsx` | **edited** (36+ / 37−; `git diff --stat 33e4c95`). It keeps the row-18 fonts, splash hold, `Uniwind.setTheme('dark')`, root `Stack`, `StatusBar` and `ErrorBoundary`. The inline provider tree is replaced by `<AppProviders><BootGate><Stack/></BootGate></AppProviders>`, and the error-boundary copy now comes from i18n keys | **70** |
| `apps/mobile/src/global.css` | unchanged: every class used resolves from existing sources | — |

**Not written:** `packages/shared/**`, `apps/core-web/**`, `apps/mock-core/**`, `package.json` (root and mobile), `package-lock.json`, `app.json`, `jest.config.js`, `jest.setup.ts`, `README.md` and `THIRD_PARTY_NOTICES.md`. No `npm install` ran. `git status --short apps/mobile` shows the other entries (`app.json`, `jest.*`, `package.json`, `scripts/`, `components/composed`, `components/media`), which belong to steps 67 and 71.

## 2. Hand-over contract for later steps

- **Step 70 (navigation shell; next owner of `_layout.tsx` and `features.ts`)**
  - **Guard:** bind `Stack.Protected` to `useAuth().isAuthenticated`.
  - **Mini-bar:** `LiveMiniBar` reads `useActiveSession()`, a `state`, `sessionId` and `startedAtMs` snapshot.
  - **Chrome insets:** wrap `TabSlot` in `<ChromeInsetsProvider consumed={['bottom']}>` for the bottom bar and `['left']` for a rail. Screens then never pad an inset twice.
  - **Chrome choice:** use `useLayoutClass().nav` (`kind`, `railWidth`, `labels`, `destinations`, `extended`; option `railCollapsed`).
  - **Motion policy:** wrap `AppProviders` with the step-69 `MotionPolicyProvider` and pass `reducedMotion={useMotionPolicy() === 'reduced'}`.
  - **Guard tests:** T-M03 can inject fakes with `<RuntimeContractProvider value={createRuntimeContract({...})}>`. It can also use the stateful stub, where `signIn` accepts any non-empty pair.
  - **Feature i18n:** register each feature `i18n.ts` in `FEATURE_RESOURCES` under its folder name. Its keys resolve as `features.<folder>.*`.
- **Step 73 (runtime; next owner of `runtime/index.ts`, `app-providers.tsx` and `i18n/index.ts`)**
  - **Runtime:** replace the stub bodies and keep the exported names and types (members may be added).
  - **Flag:** set `RUNTIME_IMPLEMENTATION = 'simulator'`.
  - **Hydration:** drive `status.ready` from hydration. `BootGate` then holds the splash with no `_layout.tsx` edit.
  - **Providers:** add `AuthProvider` at §3.2 slot 10.
  - **i18n:** add the shared `@dems/shared/i18n` `en` as the first layer in `buildEnResources`.
  - **Keep:** `RuntimeContractProvider` must keep working.
- **Screen steps 75–89**
  - **Screen root:** `SafeScreen id="<screen-id>"`.
  - **Panes:** `PaneLayout` plus `Pane` per the 04 §2.4 row.
  - **Recipes:** `StatusChip` (`badge="SEALED"`, or `tone` plus `label`), `SubjectTypeChip`, `SectionCard` and `KeyValueList` from `@/components/kit`.
  - **Classes:** merge with `cn`. Typography tokens go on an inner plain `Text`, never beside a colour on a kit part (D41(d)).

## 3. Runtime contract stub (`src/runtime/index.ts`)

| Export | Stub behaviour | Real behaviour (step 73) |
|---|---|---|
| `SimRuntimeProvider` | In-memory auth toggle; everything else inert | `createSim` + AsyncStorage + AppState + hydration gate (§5.2) |
| `useAuth()` → `AuthContract` (`isAuthenticated`, `operator`, `signIn`, `signOut`) | `signIn` accepts any non-empty username and password (role INVESTIGATOR, initials from the id). The pair lives in memory for the call only and is never stored or logged. Outside a provider it resolves `UNAVAILABLE` | Simulator `auth.ts` (§6): lockout, audit rows |
| `useCoreLink()` → `{ source: 'SIMULATED' \| 'HEARTBEAT', state: CoreLinkState }` | SIMULATED / ONLINE | Settings source, heartbeat mapping (§4.4, §5.5) |
| `SessionRouteSync`, `KeepAwakeController` | render `null` | §3.7 resync table; §6.6 keep-awake tag |
| `useActiveSession()`, `useRuntimeStatus()`, `useRuntime()` | no session; `{ ready: true, implementation: 'stub' }` | simulator state; hydration |
| `RuntimeContractProvider`, `createRuntimeContract`, `initialsFor`, `RUNTIME_IMPLEMENTATION` | fake injection and helpers | kept |

## 4. Verification (Tier 3 evidence)

### 4.1 JS checks

`--maxWorkers=2` throughout (P9). Commands run from the workspace root: `npm run typecheck|lint -w @dems/mobile` and `npm test -w @dems/mobile -- --maxWorkers=2`.

| Check | Run | Result |
|---|---|---|
| Baseline before edits | 02:18 | typecheck exit 0; lint exit 0; jest 1 suite / 1 test pass |
| After step 68 (includes `KeyboardProvider`) | 02:40 | typecheck **exit 0**; lint **exit 0, 0 warnings**; jest **9 suites / 80 tests pass**, exit 0 |
| Final run | 02:49 | lint **exit 0**; jest **13 suites / 113 tests pass**, exit 0 (includes step 71's new suites); typecheck **exit 2, only in step 71's `rolling-number.tsx`** (§5.2, P11) |
| T-M01 `src/layout/use-layout-class.test.ts` | 02:49 | **14 / 14 pass**: 411×923 compact; 923×411 compact-landscape; 800×1280 medium; 1280×800 expanded + extended rail (232 dp, collapsible to 88); 640×800 medium; 500×800 compact; exact boundaries at 600, 840 and 480; live re-classification on rotation |
| Own suites | 02:49 | `layout.test.tsx`, `i18n.test.ts`, `kit.test.tsx`, `runtime-contract.test.tsx` and `app-providers.test.tsx` all pass |
| **Final re-run (P11, second run)**, after step 71 fixed its file (02:49:25) | 02:50:58–02:51:07 | typecheck **exit 0**; lint **exit 0**; jest **13 suites / 113 tests pass**, exit 0 |

Final-run typecheck output (02:49), verbatim:

```
src/components/composed/rolling-number.tsx(163,36): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'number'.
src/components/composed/rolling-number.tsx(183,13): error TS2322: Type 'SharedValue<number> | (number & SharedValue<unknown>)' is not assignable to type 'SharedValue<number>'.
src/components/composed/rolling-number.tsx(279,64): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'number'.
```

### 4.2 Static greps

| Check | Command | Result |
|---|---|---|
| **MA-22** on the new files | `/usr/bin/grep -rnoE "#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?" apps/mobile/src/{layout,providers,components/kit,i18n,runtime}` | no match (exit 1). Colours come from `@dems/shared/tokens` (`palette.black`, `toneTextHex`) or kit classes |
| MA-22, spec scope (`src/features`, `src/components`) | same pattern | 3 hits, all in step 71's `components/media/media.test.tsx:39`; none in step-68 files |
| MA-23 | `grep -rnE "export (default )?(function\|const) (Button\|Card\|Chip\|Tabs\|Switch\|Dialog\|Toast\|Select\|TextField)\b" apps/mobile/src` | no match |
| MA-25 on the new files | `grep -rnE "https?://" … \| grep -vE "127\.0\.0\.1\|localhost\|CORE_(HTTP_ORIGIN\|WS_URL)"` | no match |

### 4.3 Device smoke

Run after step 67's "NATIVE REINSTALL DONE (02:38:10 WIB)". Setup:
- **Helper:** `METRO_PORT=8081 apps/mobile/scripts/device-session.sh <avd> 'sh smoke68.sh dems_<avd>'`, run outside the sandbox (D24, P10).
- **Order:** phone session, then tablet session, one lock each.
- **What the helper did:** it force-stopped the app first (D43) and set the bundler location for H-MB-09 (step 67 F-1).
- **mock-core:** started under P5 for a like-for-like comparison with the step-19 frames.

| | dems_phone (emulator-5554) | dems_tablet (emulator-5556) |
|---|---|---|
| Bundle from lane Metro 8081 | `Android Bundled 907ms node_modules/expo-router/entry.js (5102 modules)` | `Android Bundled 783ms … (5102 modules)` |
| `demsdemo:///` (proof screen; `/stack-check` is created by step 70 and renders the same component, 04 §4.18) | `Status: ok`, `TotalTime: 3517`; frame 1080×2424; [68_dems_phone_stack_check.png](assets/mobile/68_dems_phone_stack_check.png) | `Status: ok`, `TotalTime: 3223`; frame 2560×1600; [68_dems_tablet_stack_check.png](assets/mobile/68_dems_tablet_stack_check.png) |
| What the frame shows | One column: Orbitron title, Secure chip, gold CTA, heartbeat **Live** (seq 39), `mock-core v0.1.0 · api v1` | Two panes (row-18 900 dp rule): same content, heartbeat **Live** (seq 78), service reachable |
| `demsdemo://?motion=slow` (AC-31 path through `BootGate`) | `Status: ok`; mid and final frames differ on 9.8% of pixels, bbox (46,109)–(1034,1889) = all three cards | `Status: ok`; 5.9%, bbox (35,70)–(2525,765) = both panes |
| Crash buffer / ReactNativeJS E-level lines | 0 / 0 | 0 / 0 |
| mock-core log | 4 `ws client connected` (clientId 1–4, origin `http://127.0.0.1:4400`), 7 `/api/v1/health` requests | (same log) |

**Verdict: no regression.** The row-18 proof screen renders identically in structure through the new provider tree on both AVDs. The heartbeat is still Live through the moved `HeartbeatProvider`, the health query still works through the `AppProviders` Query client, and the motion proof mode still animates.

## 5. Decisions, drift and notes

### 5.1 Decisions made in this step

| # | Type | Decision | Why |
|---|---|---|---|
| S68-1 | interpretation | The stub `signIn` is an **in-memory toggle** (any non-empty pair), not a pure no-op | Steps 70 (guard, T-M03, chrome screencaps) and 73 run in parallel. A no-op stub could never reach the `(app)` routes. No credential is stored, logged or forwarded. `RUNTIME_IMPLEMENTATION = 'stub'` marks it for review |
| S68-2 | interpretation | The stub `SimRuntimeProvider` is mounted in `AppProviders` at §3.2 slot 9 | It is the contract stub, not the simulator ("without simulator" holds). Without it `useAuth()` has no state for step 70. Step 73 swaps the implementation under the same name |
| S68-3 | addition | The contract exports more than the five named items: `useActiveSession`, `useRuntimeStatus`, `useRuntime`, `RuntimeContractProvider`, `createRuntimeContract`, `initialsFor`, `RUNTIME_IMPLEMENTATION` | Needed by the §3.8 mini-bar, the §3.2 boot gate and T-M03 fakes, so that neither step 70 nor step 73 edits a file it does not own |
| S68-4 | interpretation | `MotionPolicyProvider` (§3.2 slot 6) is not inside `AppProviders`. `AppProviders` takes `reducedMotion` and sets the kit `animation: 'disable-all'` (VM-04) | Row 68 excludes motion. Row 70 puts the step-69 provider in `_layout.tsx`. Reanimated's `ReducedMotionConfig` is global, so its position in the tree does not matter |
| S68-5 | addition | `KeyboardProvider` added at slot 2 | Step 67 installed `react-native-keyboard-controller` 1.21.9 and its jest mock during this step (02:26). The new APK contains it, and the device smoke shows no native-module error |
| S68-6 | addition | `BootGate` (`src/providers/boot-gate.tsx`) implements the §3.2 "hold splash until hydration, ≤ 2 s, then Skeleton" against `useRuntimeStatus().ready` | Step 73's hydration gate then needs no edit to `_layout.tsx`, which step 70 owns next. With the stub, ready is always true, the same behaviour as row 18 |
| S68-7 | addition | `cn()` in `src/components/kit/cn.ts`: tailwind-merge with `TYPOGRAPHY_FONT_SIZE_CLASSES` registered | D41(d), mirroring core-web `src/lib/utils.ts`. No `clsx`: tailwind-merge joins falsy values itself, so no new package (P12) |
| S68-8 | convention | `FEATURE_RESOURCES` is keyed by feature folder and mounted under `features.<folder>`. The deep-merge lives in `src/i18n/resources.ts` | Key collisions between features become impossible. Screen steps edit only their own `i18n.ts` |
| S68-9 | interim | `SubjectType` is a local union `'Tersangka' \| 'Saksi' \| 'Lainnya'` | The step-31 simulator contract does not export one yet. Align in step 73 or 74 |
| S68-10 | process | The smoke used `/` (and `?motion=slow`) instead of `/stack-check` | `/stack-check` is created by step 70. It is the same component (04 §4.18) |
| S68-11 | process | mock-core was started for the smoke under P5 (PID 80722, user entry `step-68`) and released as last user | Like-for-like "no regression" against the step-19 frames (Live heartbeat, health version) |

### 5.2 Drift, P11 noise and hand-over requests

| # | Item | Status |
|---|---|---|
| N-1 (P11) | The 02:49 typecheck failed only in `src/components/composed/rolling-number.tsx`: step 71, running at the same time | **Resolved:** step 71 edited the file at 02:49:25; the second run at 02:50:58 exits 0 (§4.1) |
| N-2 | MA-22 hits in `src/components/media/media.test.tsx:39` (`#000000`, `#ffffff`, `#808080`) | Step 71's file; reported for step 71 and step 74 |
| H-1 (step 67 owns `jest.setup.ts`) | `app-providers.test.tsx` imports `react-native-gesture-handler/jestSetup` itself. `GestureHandlerRootView` otherwise fails in jest (`RNGestureHandlerModule.default.install is not a function`). **Request:** add that import to `jest.setup.ts` so later suites that render `AppProviders` or RNGH get it | open; not blocking |
| H-2 | `expo-splash-screen` exports cannot be spied on in jest ("Cannot redefine property"). Tests must `jest.mock('expo-splash-screen', …)` | informational |
| SIM-GAP | none: step 68 does not touch the simulator | — |
| Native or package needs (P12) | none open: the keyboard controller came from step 67 | — |
| For security steps 62, 63 and 74 | The stub auth accepts any non-empty pair until step 73. Check `RUNTIME_IMPLEMENTATION` is `'simulator'` after step 73. No credential is logged or persisted (`src/runtime/index.ts`) | informational |

## 6. Processes (P7)

| PID | Process | Started by | Stopped | Confirmed |
|---|---|---|---|---|
| 80722 / 80741 | mock-core npm leader / node on `127.0.0.1:4400` | step 68 under `.locks/mock-core.lock` (P5) | `kill -TERM 80722` under the lock as the last user | log `shutdown requested` → `shutdown complete`; 4400 free; `.locks/mock-core.pid` removed; `mock-core.users/` empty |
| 80906 | Metro `127.0.0.1:8081` (phone session) | device-session helper | helper cleanup | "Metro 80906 stopped"; 8081 free |
| 81302 | Metro `127.0.0.1:8081` (tablet session) | device-session helper | helper cleanup | "Metro 81302 stopped"; 8081 free |
| — | `adb reverse` tcp:8081 / tcp:4400 on both serials | helper | helper cleanup | `adb reverse --list` empty on emulator-5554 and emulator-5556 |
| — | app `com.dems.demo.tablet` | smoke | helper force-stop | `pidof` empty on both |

Not touched:
- the session emulators (qemu 51262 and 51273, P3);
- the shared adb server;
- `.locks/*.pid` of the emulators.

## 7. Rollback

- Delete the new folders: `src/layout`, `src/providers`, `src/components/kit`, `src/i18n` and `src/runtime`.
- Restore the row-18 root layout: `git checkout 33e4c95 -- apps/mobile/src/app/_layout.tsx`.
- Delete the `68_*` screencaps from `implementation/assets/mobile/`.
- No native, package or host change was made.

---
*Generated: 2026-10-01 02:52 WIB by coder-execution (step 68)*
