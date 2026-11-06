---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 18
agent: coder-execution
narrative_tier: 3
status: complete
date: 2026-10-01
spec: masterplan/01_specs.md rev 3 §1.4 (@dems/mobile), §1.5, §5.1-§5.7, §6.2-§6.3, §8 (N-1), AC-16, AC-25..AC-34, AC-40, AC-45; controller overrides D17, D23, D24, D30, D31
---

# Row 18: `apps/mobile` (`@dems/mobile`)

## Scaffold

- Template: `expo-template-default@57.0.28` (npm `integrity sha512-cvEi1lKctShWB[...]lZNTFc5DNeNuQ==`, 51 files).
- `npx create-expo-app@5.0.0 apps/mobile --template expo-template-default@57.0.28 --no-install --no-agents-md` failed **inside the sandbox** with `EPERM: operation not permitted, open '…/apps/mobile/.vscode/extensions.json'` (the sandbox refuses writes to `.vscode/`; create-vite hit the same rule). Rather than bypass that protection for editor settings, the same pinned tarball was extracted by hand: `npm pack expo-template-default@57.0.28`, copy everything except `_vscode/`, `LICENSE`, `README.md`, and rename `gitignore` → `.gitignore` (what create-expo-app does). The partial output of the failed command was deleted first.
- Removed per §1.5: `src/app/explore.tsx`, `src/components/*`, `src/hooks/*`, `src/constants/theme.ts`, `scripts/reset-project.js`. Template assets and `tsconfig.json` kept unchanged.

## Installed

- **R-1** (`npx expo install --npm …` from `apps/mobile`, with `EXPO_OFFLINE=1` so versions come from the local `expo/bundledNativeModules.json`, exactly rule R-1's source, and no Expo API call): `react-native-reanimated react-native-worklets react-native-gesture-handler react-native-screens react-native-safe-area-context react-native-svg @shopify/react-native-skia @shopify/flash-list expo-video expo-blur expo-linear-gradient expo-haptics expo-keep-awake expo-font expo-splash-screen expo-status-bar expo-system-ui expo-constants expo-linking expo-local-authentication`, then `--dev jest-expo`. Expo added the config plugins `expo-video`, `expo-font`, `expo-status-bar` to `app.json`.
- **R-2** (`npm install --save-exact -w @dems/mobile`): `heroui-native@1.0.10 uniwind@1.12.0 tailwindcss@4.3.3 tailwind-variants@3.3.1 tailwind-merge@3.7.0 @gorhom/bottom-sheet@5.2.14 victory-native@42.0.1 lucide-react-native@1.49.0 @expo-google-fonts/orbitron@0.4.2 @expo-google-fonts/inter@0.4.2 @expo-google-fonts/jetbrains-mono@0.4.1 @tanstack/react-query@5.104.0 react-hook-form@7.89.0 zod@4.6.5 @hookform/resolvers@5.9.1 zustand@5.0.15 i18next@26.4.2 react-i18next@17.0.15`; dev `typescript@6.0.3 @types/react@19.2.18 jest@29.7.0 @testing-library/react-native@13.3.3 react-test-renderer@19.2.3 eslint@9.39.5 eslint-config-expo@57.0.2 expo-doctor@1.20.4`.
- `@gorhom/bottom-sheet`'s invalid peer range (R18) caused **no** ERESOLVE; no `--legacy-peer-deps` was used.
- **Must be absent** — confirmed: `expo-updates`, `expo-dev-client`, `eas-cli`, `moti`, `nativewind`, `@react-navigation/native` (direct) are not in `package.json`; RNGH is 2.32.0.

### D30: complete mobile dependency set (`npm ls --depth=0 -w apps/mobile`)

```
`-- @dems/mobile@0.1.0 -> ./apps/mobile
  +-- @dems/shared@0.1.0 -> ./packages/shared
  +-- @expo-google-fonts/inter@0.4.2
  +-- @expo-google-fonts/jetbrains-mono@0.4.1
  +-- @expo-google-fonts/orbitron@0.4.2
  +-- @expo/ui@57.0.21
  +-- @gorhom/bottom-sheet@5.2.14
  +-- @hookform/resolvers@5.9.1
  +-- @shopify/flash-list@2.0.2
  +-- @shopify/react-native-skia@2.6.2
  +-- @tanstack/react-query@5.104.0
  +-- @testing-library/react-native@13.3.3
  +-- @types/react@19.2.18 overridden
  +-- eslint-config-expo@57.0.2
  +-- eslint@9.39.5
  +-- expo-blur@57.0.3
  +-- expo-constants@57.0.20
  +-- expo-device@57.0.2
  +-- expo-doctor@1.20.4
  +-- expo-font@57.0.4
  +-- expo-glass-effect@57.0.4
  +-- expo-haptics@57.0.3
  +-- expo-image@57.0.5
  +-- expo-keep-awake@57.0.2
  +-- expo-linear-gradient@57.0.2
  +-- expo-linking@57.0.11
  +-- expo-local-authentication@57.0.3
  +-- expo-router@57.0.24
  +-- expo-splash-screen@57.0.9
  +-- expo-status-bar@57.0.1
  +-- expo-symbols@57.0.3
  +-- expo-system-ui@57.0.4
  +-- expo-video@57.0.5
  +-- expo-web-browser@57.0.3
  +-- expo@57.0.26
  +-- heroui-native@1.0.10
  +-- i18next@26.4.2
  +-- jest-expo@57.0.5
  +-- jest@29.7.0
  +-- lucide-react-native@1.49.0
  +-- react-dom@19.2.3 overridden
  +-- react-hook-form@7.89.0
  +-- react-i18next@17.0.15
  +-- react-native-gesture-handler@2.32.0
  +-- react-native-reanimated@4.5.1
  +-- react-native-safe-area-context@5.7.0
  +-- react-native-screens@4.26.2
  +-- react-native-svg@15.15.4
  +-- react-native-web@0.21.3
  +-- react-native-worklets@0.10.1
  +-- react-native@0.86.3
  +-- react-test-renderer@19.2.3 overridden
  +-- react@19.2.3 overridden
  +-- tailwind-merge@3.7.0
  +-- tailwind-variants@3.3.1
  +-- tailwindcss@4.3.3
  +-- typescript@6.0.3
  +-- uniwind@1.12.0
  +-- victory-native@42.0.1
  +-- zod@4.6.5
  `-- zustand@5.0.15
```

Every entry compared with the spec pin (script over `package.json` + installed `package.json` versions): **60 rows, 0 differ.**

| Package | Kind | Declared | Installed | Spec pin (§1.4 unless noted) | Verdict |
|---|---|---|---|---|---|
| `@dems/shared` | dep | `*` | 0.1.0 | * | match (workspace) |
| `@expo-google-fonts/inter` | dep | `0.4.2` | 0.4.2 | 0.4.2 | match |
| `@expo-google-fonts/jetbrains-mono` | dep | `0.4.1` | 0.4.1 | 0.4.1 | match |
| `@expo-google-fonts/orbitron` | dep | `0.4.2` | 0.4.2 | 0.4.2 | match |
| `@expo/ui` | dep | `~57.0.21` | 57.0.21 | (template) | n/a |
| `@gorhom/bottom-sheet` | dep | `5.2.14` | 5.2.14 | 5.2.14 | match |
| `@hookform/resolvers` | dep | `5.9.1` | 5.9.1 | 5.9.1 | match |
| `@shopify/flash-list` | dep | `2.0.2` | 2.0.2 | 2.0.2 | match |
| `@shopify/react-native-skia` | dep | `2.6.2` | 2.6.2 | 2.6.2 | match |
| `@tanstack/react-query` | dep | `5.104.0` | 5.104.0 | 5.104.0 | match |
| `@testing-library/react-native` | dev | `13.3.3` | 13.3.3 | 13.3.3 | match |
| `@types/react` | dev | `19.2.18` | 19.2.18 | 19.2.18 | match |
| `eslint` | dev | `9.39.5` | 9.39.5 | 9.39.5 | match |
| `eslint-config-expo` | dev | `57.0.2` | 57.0.2 | 57.0.2 | match |
| `expo` | dep | `~57.0.26` | 57.0.26 | ~57.0.26 | match (in ~ range) |
| `expo-blur` | dep | `~57.0.3` | 57.0.3 | ~57.0.3 | match (in ~ range) |
| `expo-constants` | dep | `~57.0.20` | 57.0.20 | ~57.0.20 | match (in ~ range) |
| `expo-device` | dep | `~57.0.2` | 57.0.2 | (template) | n/a |
| `expo-doctor` | dev | `1.20.4` | 1.20.4 | 1.20.4 | match |
| `expo-font` | dep | `~57.0.4` | 57.0.4 | ~57.0.4 | match (in ~ range) |
| `expo-glass-effect` | dep | `~57.0.4` | 57.0.4 | (template) | n/a |
| `expo-haptics` | dep | `~57.0.3` | 57.0.3 | ~57.0.3 | match (in ~ range) |
| `expo-image` | dep | `~57.0.5` | 57.0.5 | (template) | n/a |
| `expo-keep-awake` | dep | `~57.0.2` | 57.0.2 | ~57.0.2 | match (in ~ range) |
| `expo-linear-gradient` | dep | `~57.0.2` | 57.0.2 | ~57.0.2 | match (in ~ range) |
| `expo-linking` | dep | `~57.0.11` | 57.0.11 | ~57.0.11 | match (in ~ range) |
| `expo-local-authentication` | dep | `~57.0.3` | 57.0.3 | (D30, R-1; not in 01_specs) | n/a |
| `expo-router` | dep | `~57.0.24` | 57.0.24 | ~57.0.24 | match (in ~ range) |
| `expo-splash-screen` | dep | `~57.0.9` | 57.0.9 | ~57.0.9 | match (in ~ range) |
| `expo-status-bar` | dep | `~57.0.1` | 57.0.1 | ~57.0.1 | match (in ~ range) |
| `expo-symbols` | dep | `~57.0.3` | 57.0.3 | (template) | n/a |
| `expo-system-ui` | dep | `~57.0.4` | 57.0.4 | ~57.0.4 | match (in ~ range) |
| `expo-video` | dep | `~57.0.5` | 57.0.5 | ~57.0.5 | match (in ~ range) |
| `expo-web-browser` | dep | `~57.0.3` | 57.0.3 | (template) | n/a |
| `heroui-native` | dep | `1.0.10` | 1.0.10 | 1.0.10 | match |
| `i18next` | dep | `26.4.2` | 26.4.2 | 26.4.2 (D30; §14.1 pins it for core-web) | match |
| `jest` | dev | `29.7.0` | 29.7.0 | 29.7.0 | match |
| `jest-expo` | dev | `~57.0.5` | 57.0.5 | ~57.0.5 | match (in ~ range) |
| `lucide-react-native` | dep | `1.49.0` | 1.49.0 | 1.49.0 | match |
| `react` | dep | `19.2.3` | 19.2.3 | 19.2.3 | match |
| `react-dom` | dep | `19.2.3` | 19.2.3 | 19.2.3 | match |
| `react-hook-form` | dep | `7.89.0` | 7.89.0 | 7.89.0 | match |
| `react-i18next` | dep | `17.0.15` | 17.0.15 | 17.0.15 (D30; §14.1 pins it for core-web) | match |
| `react-native` | dep | `0.86.3` | 0.86.3 | 0.86.3 | match |
| `react-native-gesture-handler` | dep | `~2.32.0` | 2.32.0 | ~2.32.0 | match (in ~ range) |
| `react-native-reanimated` | dep | `4.5.1` | 4.5.1 | 4.5.1 | match |
| `react-native-safe-area-context` | dep | `~5.7.0` | 5.7.0 | ~5.7.0 | match (in ~ range) |
| `react-native-screens` | dep | `~4.26.0` | 4.26.2 | ~4.26.0 | match (in ~ range) |
| `react-native-svg` | dep | `15.15.4` | 15.15.4 | 15.15.4 | match |
| `react-native-web` | dep | `~0.21.0` | 0.21.3 | ~0.21.0 | match (in ~ range) |
| `react-native-worklets` | dep | `0.10.1` | 0.10.1 | 0.10.1 | match |
| `react-test-renderer` | dev | `19.2.3` | 19.2.3 | 19.2.3 | match |
| `tailwind-merge` | dep | `3.7.0` | 3.7.0 | 3.7.0 | match |
| `tailwind-variants` | dep | `3.3.1` | 3.3.1 | 3.3.1 | match |
| `tailwindcss` | dep | `4.3.3` | 4.3.3 | 4.3.3 | match |
| `typescript` | dev | `6.0.3` | 6.0.3 | 6.0.3 | match |
| `uniwind` | dep | `1.12.0` | 1.12.0 | 1.12.0 | match |
| `victory-native` | dep | `42.0.1` | 42.0.1 | 42.0.1 | match |
| `zod` | dep | `4.6.5` | 4.6.5 | 4.6.5 | match |
| `zustand` | dep | `5.0.15` | 5.0.15 | 5.0.15 (D30; §14.1 pins it for shared/core-web) | match |

Tree alignment after the mobile install (`npm query`): `react 19.2.3 @ node_modules/react` (single), `react-dom 19.2.3` (single), `react-native 0.86.3` (single), `react-test-renderer 19.2.3` (single), `typescript 6.0.3` (single), `tailwind-merge 3.7.0` (single); `zod` 4.6.5 plus an internal 3.25.76 under `@expo/cli`. `test ! -d apps/mobile/node_modules/react && test ! -d apps/core-web/node_modules/react` → exit 0.

## Files (under `/Users/gsp-budi/Documents/DEMS/apps/mobile/`)

| File | Content |
|---|---|
| `package.json` | `@dems/mobile` 0.1.0, `main: expo-router/entry`; scripts per §1.5 (6× `EXPO_NO_TELEMETRY=1`; `dev` fixed, see M18-4); `jest` block per §8 + one `moduleNameMapper` (M18-6) |
| `app.json` | §5.1 rev 3: name "DEMS Tablet Demo", slug `dems-tablet-demo`, version 0.1.0, scheme `demsdemo`, **`orientation: "default"`** (D17), `userInterfaceStyle: "dark"`, `backgroundColor #0B0D0F`, `android.package com.dems.demo.tablet`, adaptive icon and splash backgrounds `#0B0D0F`, plugins `expo-router`, `expo-splash-screen`, `expo-video`, `expo-font`, `expo-status-bar`; typedRoutes + reactCompiler on. **No** local orientation plugin (D17), no `owner`/`extra.eas`/`updates`/`runtimeVersion` |
| `metro.config.js` | §5.3 vendor pattern (`withUniwindConfig`), nothing else |
| `src/global.css` | `tailwindcss`, `uniwind`, `heroui-native/styles`, `@dems/shared/theme/heroui-native.css`; `@source` for `heroui-native/lib` (root-hoisted) and `packages/shared/src` |
| `src/uniwind-types.d.ts` | Generated by `uniwind generate-artifacts --css ./src/global.css --dts ./src/uniwind-types.d.ts` (commit it) |
| `src/env.d.ts` | `/// <reference types="expo/types" />` (M18-5) |
| `src/app/_layout.tsx` | §5.4: global.css, `SplashScreen.preventAutoHideAsync()`, `Uniwind.setTheme('dark')`, `useFonts` with the 7 families (per-weight subpath imports), providers GestureHandlerRootView > QueryClientProvider > HeartbeatProvider(onResync) > HeroUINativeProvider(textProps.maxFontSizeMultiplier 1.2) > Stack; `StatusBar light`; Expo Router `ErrorBoundary` with shared rate-limited retry |
| `src/app/index.tsx` | Route `/`; `useLocalSearchParams` → `motionMode` |
| `src/features/home/home-screen.tsx` | §5.5 rev 3: responsive (`useWindowDimensions`, two panes ≥ 900 dp, else one column); hero Card (Card.Header/Title/Description/Body/Footer, Secure Chip, Button → Haptics + `toast.show`), Heartbeat Surface (tone Chip, PulseRing, seq), Service Surface (Skeleton → version or "Core unreachable"); Reanimated `entering={FadeInDown…}` / `entering={FadeInUp.delay(…)…}` springs from the gentle token, slow mode 6,400 ms luxe (delay 800 ms); `useKeepAwake()` |
| `src/features/home/pulse-ring.tsx` | Skia `Canvas` 120×120, `Group`, `Circle` with `r = useDerivedValue(() => 14 + pulse.get() * 34)`, `RadialGradient` gold → transparent, `BlurMask blur={6}`, 8-pt core in the tone hex; `pulse.set(withSequence(withTiming(1, 180 ms luxe), withTiming(0, 720 ms standard)))` per `seq` |
| `src/features/home/use-health.ts` | TanStack Query over shared `fetchHealth()` |
| `src/lib/tone-icons.ts` | lucide-react-native map |
| `src/features/home/home-screen.test.tsx`, `jest.setup.ts` | N-1 and Jest setup (M18-7) |
| `eslint.config.js` | ESLint 9 flat config: `eslint-config-expo/flat` + ignores for generated/native folders |
| `.gitignore`, `tsconfig.json`, `assets/**` | From the template, unchanged |

Shared additions during this row: `useRetryCooldown` (moved from core-web), `fetchHealth`/`HEALTH_QUERY_KEY`, `toneTextHex` (listed in `02_shared_package.md`).

## Verification

### Typecheck, lint, test — PASS

```
> @dems/mobile@0.1.0 typecheck
> tsc --noEmit
typecheck exit=0

> @dems/mobile@0.1.0 lint
> eslint .
lint exit=0

PASS src/features/home/home-screen.test.tsx
    ✓ shows the title, then goes from Connecting to Live with the health version (97 ms)
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
```

(AC-32 PASS. N-1 renders the **real** HeroUI Native under jest-expo — H-S8 confirmed, no passthrough mock needed. Jest prints one Uniwind warning, "couldn't find your variable --theme", because Jest does not compile CSS.)

### AC-16 `deps:check` + `doctor` — PASS

```
> EXPO_NO_TELEMETRY=1 expo install --check
Dependencies are up to date
deps:check exit=0

> EXPO_NO_TELEMETRY=1 expo-doctor
Running 21 checks on your project...
21/21 checks passed. No issues detected!
doctor exit=0
```

Both need the network (`exp.host`, React Native Directory) and `expo install --check` writes `~/.expo`; inside the sandbox they failed (`getaddrinfo ENOTFOUND exp.host`; `EPERM mkdir ~/.expo`), so they ran with the sandbox disabled. `~/.expo` was absent before and now holds `native-modules-cache/` and `versions-cache/` (72K; HI-7).

### AC-25 / AC-26 / AC-27 (after `npm run prebuild`) — PASS

```
prebuild: ✔ Created native directory … ✔ Finished prebuild   (exit 0, 1 s)
AC-25: grep -c PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY main manifest → 0
       grep -cE 'android:screenOrientation="(landscape|portrait|sensorLandscape|sensorPortrait)"' → 0
       (attribute present: android:screenOrientation="unspecified")
AC-26: android/app/src/debug/AndroidManifest.xml:1   android/app/src/main/AndroidManifest.xml:0
       debug + debugOptimized: <application android:usesCleartextTraffic="true" …>
AC-27: no eas.json;  "(expo-updates|expo-dev-client|eas-cli)" in package.json → 0;  projectId|"owner"|"updates"|runtimeVersion in app.json → 0
```

Generated project facts: `applicationId`/`namespace` `com.dems.demo.tablet`; `ndkVersion`, `compileSdk`, `min/targetSdk` from `rootProject.ext`; `distributionUrl=…gradle-9.3.1-bin.zip`; `newArchEnabled=true`, `hermesEnabled=true`. `apps/mobile/android` is git-ignored (`apps/mobile/.gitignore:43:/android`, plus the root rule).

### AC-28 Gradle build — PASS (duration recorded)

Command: `npm run build -w @dems/mobile` (prebuild + `./gradlew assembleDebug`) in a login shell (`JAVA_HOME`, `ANDROID_HOME` from `~/.zprofile`), sandbox disabled (writes `~/.gradle`, downloads Gradle and Maven artifacts).

```
BUILD_START=01:17:20
Downloading https://services.gradle.org/distributions/gradle-9.3.1-bin.zip  …100%
Installing Android SDK Build-Tools 35 in /Users/gsp-budi/Library/Android/sdk/build-tools/35.0.0
BUILD SUCCESSFUL in 8m 34s
536 actionable tasks: 536 executed
BUILD_EXIT=0 DURATION=516s BUILD_END=01:25:56
app-debug.apk  318,105,574 bytes  (sha256 845ba943032a95cdea39a1fa4d6fbc85338d6f335862134c0ce944e70468d576)
```

- **Gradle build duration: 8 min 34 s** (first, cold build; whole script 516 s including prebuild). The incremental rebuild inside `expo run:android` took `BUILD SUCCESSFUL in 10s` (368 tasks, 44 executed).
- R21: AGP auto-installed **`build-tools;35.0.0`** (186 MB) on its own; the pre-installed `ndk;27.1.12297006` and `cmake;3.22.1` were used (CMake configure lines for skia/screens reference NDK 27.1.12297006).
- 105 Kotlin `w:` deprecation warnings (library code), 0 errors.
- `~/.gradle` absent before (HI-6) → 4.0 GB after.

### Device runs (emulators outside the sandbox, D24; one AVD at a time)

mock-core was started first (`tsx src/index.ts`, node PID 46025, `127.0.0.1:4400`).

**`dems_phone` (`npm run android` = `expo run:android`, the controller's required path):**

```
emulator -avd dems_phone -no-metrics -gpu host -no-boot-anim   → boot_completed (quick-boot snapshot)
adb devices: emulator-5554 device;  wm size: 1080x2424;  sdk: 36
npm run mobile:reverse → adb reverse --list: host-10 tcp:4400 tcp:4400 / host-10 tcp:8081 tcp:8081   (AC-40)
npm run android:
  BUILD SUCCESSFUL in 10s
  › Installing …/app-debug.apk
  › Opening demsdemo://expo-development-client/?url=http%3A%2F%2F192.168.101.9%3A8081 on dems_phone
  Android Bundled 13458ms node_modules/expo-router/entry.js (5004 modules)
app pid=4141 (first launch), later adb shell pidof com.dems.demo.tablet → 5284          (AC-29)
```

**`dems_tablet` (same debug APK, `adb install`, per the controller):**

```
emulator -avd dems_tablet -no-metrics -gpu host -no-boot-anim  → boot_completed
adb devices: emulator-5554 device;  wm size: 2560x1600;  wm density: 320;  sdk: 36
npm run mobile:reverse → host-15 tcp:4400 tcp:4400 / host-15 tcp:8081 tcp:8081          (AC-40)
adb install -r …/app-debug.apk → Performing Streamed Install / Success (2 s)
adb shell pidof com.dems.demo.tablet → 4647                                            (AC-29)
```

**Heartbeat reaches mock-core (SC5 preview):** the mock-core log recorded six sessions across the two devices, all `origin=http://127.0.0.1:4400`, e.g. `{"clientId":1,"clients":1,"origin":"http://127.0.0.1:4400","msg":"ws client connected"}`, and 4+ `GET /api/v1/health` from `127.0.0.1`. Every screenshot shows the Chip **Live**, a rising `seq` and `mock-core v0.1.0 · api v1`.

### Screenshots (AC-30, AC-31, AC-33)

Method: `adb exec-out screencap -p` in a timed loop right after `am force-stop` + launch (deep link `demsdemo://?motion=slow` for slow mode, `am start -n …/.MainActivity` for normal); each file is named with its offset from the launch command. The content mounts after the splash and the dev-bundle load (phone ≈3.9 s, tablet ≈8.6 s on its first bundle fetch, ≈4.1 s later), so frames were chosen relative to the **mount** (first non-splash frame), using per-frame mean luminance (Pillow) to locate mount and plateau.

| Frame | Device | Offset from launch (≈ from mount) | Size | Evidence |
|---|---|---|---|---|
| [05_phone_A_slow_mid_t04.91s.png](assets/05_phone_A_slow_mid_t04.91s.png) | phone | 4.91 s (≈ +1.0 s) | 1080×2424 | Mid-transition: hero translucent and offset down, right-hand panels dim and offset up (overlapping) |
| [05_phone_B_slow_final_t11.98s.png](assets/05_phone_B_slow_final_t11.98s.png) | phone | 11.98 s (≈ +8.1 s) | 1080×2424 | Final, single column (411 dp < 900) |
| [05_phone_C0_normal_spring_t04.21s.png](assets/05_phone_C0_normal_spring_t04.21s.png) | phone | 4.21 s (≈ +0.2 s) | 1080×2424 | Normal spring in flight |
| [05_phone_C_normal_t06.21s.png](assets/05_phone_C_normal_t06.21s.png) | phone | 6.21 s (≈ +2.1 s) | 1080×2424 | Normal, final |
| [05_phone_D_toast.png](assets/05_phone_D_toast.png) | phone | after `input tap` on the button | 1080×2424 | HeroUI Native toast "Toasts ready / HeroUI Native toast is wired." with the level-3 glow; Skia ring caught mid-pulse |
| [05_tablet_A_slow_mid_t09.51s.png](assets/05_tablet_A_slow_mid_t09.51s.png) | tablet | 9.51 s (≈ +0.9 s) | 2560×1600 | Mid-transition, two panes; delayed right pane barely visible |
| [05_tablet_B_slow_final_t16.58s.png](assets/05_tablet_B_slow_final_t16.58s.png) | tablet | 16.58 s (≈ +8.0 s) | 2560×1600 | Final, two panes (1280 dp ≥ 900) |
| [05_tablet_C_normal_t06.37s.png](assets/05_tablet_C_normal_t06.37s.png) | tablet | 6.37 s (≈ +2.2 s) | 2560×1600 | Normal, final |
| [05_tablet_E_rotated_portrait.png](assets/05_tablet_E_rotated_portrait.png) | tablet | after `adb emu rotate` | **1600×2560** | Re-flowed to one column (800 dp < 900), **same PID 4647** (no restart), heartbeat still Live |

Luminance series (body mean, 0-255): phone slow — splash 14.56 until 3.73 s, then 17.21 → 22.94 (4.91 s) → 27.88 → 29.76 (7.25 s) → plateau 29.8-31.0; phone normal — 18.12 (4.21 s) → 29.99 (4.60 s) → plateau; tablet slow — 16.15 (9.11 s) → 17.98 (9.51 s) → 22.11 (11.18 s) → plateau 23.2-23.7.

Rotation: `accelerometer_rotation` = 1; after `adb emu rotate` `dumpsys window displays` → `cur=1600x2560`; three more rotations restored `cur=2560x1600` before shutdown.

| AC | Result |
|---|---|
| AC-29 | PASS: non-empty PID on both AVDs (phone 4141/5284, tablet 4647) |
| AC-30 | PASS: phone 1080×2424 single column; tablet 2560×1600 two panes; rotated 1600×2560 re-flowed (unlocked, D17) |
| AC-31 | PASS: slow-mode mid and final frames above. `grep -nE 'entering=\{FadeIn(Down\|Up)' home-screen.tsx` → 4 lines (normal + slow builders for each pane); `grep -nE 'useDerivedValue\|withSequence\|<Canvas' pulse-ring.tsx` → present |
| AC-33 | PASS: `_layout.tsx` names `Orbitron_700Bold`, `Inter_600SemiBold`, `JetBrainsMono_400Regular` (+ 4 more); every frame shows Orbitron/Inter/JetBrains Mono text past the splash |
| AC-34 | PASS: `grep -o 'EXPO_NO_TELEMETRY=1' apps/mobile/package.json \| wc -l` → `6` |
| AC-40 | PASS on both AVDs (see above) |

### AC-45 Metro bind address — PASS for `dev:mobile` (after fix M18-4); CAUTION for `npm run android`

```
Metro started by `npm run android` (expo run:android):
node 46167 … IPv6 … TCP *:8081 (LISTEN)                       ← all interfaces: CAUTION → row 23

`npm run dev:mobile` as specified (expo start --localhost --port 8081):
node 47883 … IPv6 … TCP [::1]:8081 (LISTEN)                  ← loopback, but IPv6 only
tablet relaunch → red box "Unable to load script … adb reverse tcp:8081 tcp:8081"   ← adb reverse reaches the host over IPv4

`npm run dev:mobile` after the fix (NODE_OPTIONS=--dns-result-order=ipv4first):
node 48807 … IPv4 … TCP 127.0.0.1:8081 (LISTEN)               ← PASS
tablet relaunch → Android Bundled 937ms node_modules/expo-router/entry.js (5004 modules)
```

`npm run android -- --no-bundler` still started its own Metro on `*:8081` next to the loopback one (both listeners coexisted), so this Expo CLI version offers no loopback-only `run:android`. Safer run-guide sequence (tested): `npm run dev:mobile` (loopback Metro), then `adb install -r …/app-debug.apk` + `adb shell am start -n com.dems.demo.tablet/.MainActivity`.

### Spec hypotheses closed by this row

| # | Result | Evidence |
|---|---|---|
| H-S2 | Confirmed (native): `@import '@dems/shared/theme/heroui-native.css'` resolves through package `exports` | rev-3 warm panels and gold accents render |
| H-S3 | Confirmed: HeroUI Native classes compile via `@source '../../../node_modules/heroui-native/lib'`; no fallback needed | kit components styled in every frame |
| H-S4 | Confirmed: React Native Android WS sends `Origin: http://127.0.0.1:4400`; accepted via `SELF_ORIGINS` | mock-core log, 6 sessions |
| H-S6 | Confirmed: `CircleCheck`, `TriangleAlert`, `ShieldCheck`, `Wifi`, … exist in lucide-react-native 1.49.0 | mobile `tsc --noEmit` exit 0 |
| H-S7 | Confirmed: `demsdemo://?motion=slow` routes to `/` with `motion=slow` | slow-mode frames (6.4 s transition) |
| H-S8 | Confirmed: HeroUI Native renders under jest-expo | N-1 passes without the passthrough mock |
| H-S10 | Confirmed: React Compiler stays on; no Reanimated/HeroUI runtime error | logcat shows no ReactNativeJS errors; screens render |
| H-S12 | Confirmed: `expo run:android` builds, installs and launches without `expo-dev-client`, and `expo start` serves the installed debug APK — **provided Metro listens on IPv4 loopback** (M18-4) | "Android Bundled" lines; frames |
| H-S13 | Confirmed: RN `boxShadow` spread + blur render on Android (panel glow; strong glow on the toast) | 05_phone_D_toast.png |
| H-S14 | Partly confirmed: `text-display`/`text-label` sizes and line heights apply through Uniwind; em letter-spacing not measured | frames |
| H-S15 | Confirmed: our `@theme` `--color-*-soft*` override wins over HeroUI Native's `color-mix` | "Secure" label pixels `#4ADE80` (973 px); chip fill `#1A2B15` = `#22C55E26` over `#191008` (kit default would be ≈ `#62D58D`) |

## Decisions and deviations

| # | Item | Decision | Reason |
|---|---|---|---|
| M18-1 | Scaffold | Pinned template tarball extracted by hand (no `.vscode/`, no template LICENSE/README) instead of `create-expo-app` | The sandbox blocks writes to `.vscode/`; editor settings are not needed, so the protection was not bypassed |
| M18-2 | `EXPO_OFFLINE=1` for `expo install` | Used for the R-1 installs | Resolves versions from the local `bundledNativeModules.json` (R-1's stated source), no Expo API call, no `~/.expo` write inside the sandbox |
| M18-3 | Skia postinstall | `npm install-scripts approve @shopify/react-native-skia` → root `package.json` `"allowScripts": { "@shopify/react-native-skia@2.6.2": true }`, then `npm rebuild @shopify/react-native-skia` | Script read first: copies prebuilt libs from `react-native-skia-android`/`-apple-*` into `libs/` (no network). npm 11.19.1 still ran it without approval (see S15-9), but the approval keeps the Android build working once npm enforces the policy. `libs/android` is byte-identical to `react-native-skia-android/libs` (`diff -rq`) |
| M18-4 | Mobile `dev` script | `EXPO_NO_TELEMETRY=1 NODE_OPTIONS=--dns-result-order=ipv4first expo start --localhost --port 8081` (spec: without `NODE_OPTIONS`) | Spec version binds `[::1]:8081` only on this host, and `adb reverse` connects over IPv4 → "Unable to load script". Fixed version binds `127.0.0.1:8081` (AC-45 PASS) and serves the app |
| M18-5 | `src/env.d.ts` | Committed `/// <reference types="expo/types" />` | TS 6 checks side-effect imports; `import '../global.css'` needs the `*.css` declaration that normally comes from the generated, git-ignored `expo-env.d.ts` (clean-checkout typecheck would fail) |
| M18-6 | Jest `moduleNameMapper` for `lucide-react-native` → its CJS build | Added to the `jest` block | Under the `react-native` export condition Jest picks the untransformed `.mjs` ESM build ("Unexpected token 'export'") |
| M18-7 | `jest.setup.ts` | `jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'))` + Reanimated's own `setUpTests()` (spec: `require('react-native-reanimated').setUpTests()` alone) | Reanimated 4.5 + Worklets 0.10 load the native Worklets module at import ("Cannot read properties of undefined (reading 'loadUnpackers')"); the full Reanimated mock lacks `useReducedMotion`, which HeroUI Native's provider calls |
| M18-8 | HeroUI Native text component | `Typography` (exported name in 1.0.10); plain RN `Text` + Uniwind `className` for the design typography | V29 assumed `Text`. Plain `Text` also avoids the tailwind-merge size drop (S17-1) |
| M18-9 | Font imports | Per-weight subpaths (`@expo-google-fonts/inter/400Regular`, …) | Bundles only the 7 TTFs used instead of every weight |
| M18-10 | Hero title | `Card.Title className="text-accent"` > `Text className="font-display text-display uppercase"` | S17-1 (HeroUI Native uses tailwind-variants too) |
| M18-11 | D30 i18n packages | `i18next` 26.4.2 and `react-i18next` 17.0.15 installed in mobile at the spec's §14.1 pins | §14.1 lists them for core-web (not mobile); installed in mobile per D30 ("install semua stack mobilenya juga"). **Controller to confirm**; removal is `npm uninstall -w @dems/mobile i18next react-i18next` |
| M18-12 | D30 `zustand` 5.0.15 | Installed in mobile; `packages/shared` does not have it yet | The simulator (§14.7) is not part of this delegation; when shared adds the same pin, npm keeps one hoisted copy |
| M18-13 | `expo-local-authentication` | Installed via R-1 (~57.0.3); no config plugin added | Android needs no plugin (the library manifest declares `USE_BIOMETRIC`); an iOS Face ID string is out of scope (Android only) |
| M18-14 | `ErrorBoundary` in `_layout.tsx` | Friendly copy + shared `useRetryCooldown`; errors go to the dev console only | No client-log endpoint in mock-core (D3/D4) |
| M18-15 | Sandbox | Disabled for: `expo install --check`/`expo-doctor` (network + `~/.expo`), Gradle (`~/.gradle`, network), emulators (D24), adb, Metro, mock-core, the capture loops | Sandbox restrictions only |
| M18-16 | Toast tap | `adb shell input tap 539 863` on the proof button | Evidence of HeroUI Native toast + haptics call path |

## Host impact (this row)

| Path | Change | Rollback |
|---|---|---|
| `~/.gradle/` (absent at baseline, HI-6) | Gradle 9.3.1 distribution + caches, 4.0 GB | `rm -rf ~/.gradle` (daemons already stopped) |
| `~/.expo/` (absent at baseline, HI-7) | `native-modules-cache/`, `versions-cache/`, 72 KB | `rm -rf ~/.expo` |
| `~/Library/Android/sdk/build-tools/35.0.0` | Auto-installed by AGP, 186 MB (R21) | `android --no-metrics sdk uninstall build-tools;35.0.0` (or `sdkmanager --uninstall "build-tools;35.0.0"`) |
| `~/.android/avd/dems_phone.avd`, `dems_tablet.avd` | Quick-boot snapshots re-saved on `adb emu kill`; tablet rotation restored to landscape before shutdown | Cold boot with `-no-snapshot-load` if needed |
| AVD user data | App `com.dems.demo.tablet` installed on both AVDs | `adb uninstall com.dems.demo.tablet` |

## Processes started and stopped

| PID | Process | Stopped by | Confirmed |
|---|---|---|---|
| 42754 / 42784 | Gradle daemon / Kotlin compile daemon | `./gradlew --stop` ("1 Daemon stopped") | no daemon in `ps` |
| 46008 / 46025 | mock-core tsx / node (`127.0.0.1:4400`) | `kill -TERM 46008` | log `shutdown requested` → `shutdown complete`; 4400 free |
| 46026 | adb server (`tcp:5037`, started by this row) | `adb kill-server` | 5037 free |
| 46016 | qemu `dems_phone` | `adb -s emulator-5554 emu kill` | exited |
| 47223 | qemu `dems_tablet` | `adb emu kill` (after `adb reverse --remove-all`) | exited; 5554/5555 free |
| 46128 / 46144 / 46167 | `npm run android` chain + Metro `*:8081` | `kill -TERM 46167` | chain exited |
| 47883 | Metro `[::1]:8081` (spec `dev` script) | `kill -TERM` | 8081 free |
| 48223 | Metro `127.0.0.1:8081` (manual IPv4 test) | `kill -TERM` | 8081 free |
| 48377 | `expo run:android --no-bundler` (+ its `*:8081` Metro) | `kill -TERM 48377` | exited |
| 48766 / 48807 | `npm run dev:mobile` (fixed) + Metro `127.0.0.1:8081` | `kill -TERM 48807` | chain exited; 8081 free |

Final port check: 5037, 4400, 8081, 5554, 5555 free. Only the user's own `[::1]:5173` (PID 3489, SMART WMS) remains; untouched.

## Rollback

`rm -rf apps/mobile && npm install` (also remove the root `allowScripts` entry if the mobile app is dropped), plus the host rollbacks above.

---
*Generated: 2026-10-01 01:40 WIB*
