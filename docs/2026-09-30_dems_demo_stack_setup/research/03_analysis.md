---
task_id: 2026-09-30_dems_demo_stack_setup
task_slug: dems_demo_stack_setup
date: 2026-09-30
agent: data-analyst
blueprint_row: 3
type: mixed
narrative_tier: 1
confidence: HIGH
confidence_note: >
  HIGH for versions, compatibility, toolchain and host impact. These rest on npm registry
  output, files read from official tarballs, official manifests and docs, and local semver
  checks. MEDIUM for aesthetic judgements such as which kit "looks more luxurious". Those rest
  on vendor documentation and component inventories only; nothing was rendered on a device.
source_translated_task: /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/identification/01_translated.md
source_structured_task: /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/identification/02_structured.md
source_original_task: /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/identification/01_original.md
inputs:
  - research/01_explore.md (row 1, design-book digest)
  - research/02_collection.md (row 2, technology evidence)
  - decisions/decisions.md (D1-D9)
status: complete
last_updated: 2026-09-30 23:28 WIB
---

# Analysis Report: DEMS Demo Stack Decision Record (Blueprint Row 3)

## Source Tasks

- Structured: `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/identification/02_structured.md` (row 3; risks R1-R12; hypotheses H1-H8)
- Translated: `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/identification/01_translated.md` (goals G1-G7, constraints C1-C7 and I1-I7, success criteria SC1-SC7)
- Original: `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/identification/01_original.md`
- Decisions: `/Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/decisions/decisions.md` (D1-D9; **D6 is the hard constraint**)

## Exploration & Collection Summary

- Explore: `research/01_explore.md`. A local digest of the design book: 13 tablet modules, a 10-step flow, the 8-item pre-check gate, the session state machine, 9 REST endpoints, 24 entities, and 29 stack capability needs S1-S29 (L689-L723). It was produced without web access.
- Collection: `research/02_collection.md`. 97 Tier-2 findings plus a 115-row npm snapshot covering 8 areas. It makes no decisions, and it records two conflicts for this row (Gaps item 14, L1084-L1086).
- Analyst verification: 21 extra checks (V1-V21 below) close gaps that bear on the decisions. They were limited to package tarballs, registry metadata, official docs and read-only host probes, and every query used generic package names only.

---

## Overview

This is the stack decision record for the DEMS demo: a React web "Core" console, a React Native Android tablet app in landscape, and a local mock Core service.

**The selected pair is HeroUI v3 (web) with HeroUI Native (mobile).** Both are prebuilt, animated, Tailwind-v4 kits from the same vendor:
- 44 of HeroUI Native's 46 theme variables have the same name in the web kit (V6), so one token file in `packages/shared` can theme both apps.
- The HeroUI Native example app already runs on the exact Expo SDK 57 pins (02 §2.2 L309-L312; V9).

**Runtime:** the system Node 26.8.2 is kept, with npm 11.19.1 workspaces. The mobile app uses Expo SDK 57 (the stable release, not the SDK 58 beta).

**React:** React is pinned once, at Expo's 19.2.3, for every app.

**Android toolchain:** uses only non-sudo channels:
- Homebrew formula `openjdk@17`;
- Google's command-line tools zip;
- sdkmanager on the stable channel.

**Host changes:**
- The shell-profile change targets `~/.zprofile`, because `~/.zshrc` does not exist on this host (V17).
- Watchman is dropped, because Expo does not require it on SDK 57 (V16).

All of this is recorded below with evidence, rejected alternatives and a rollback for each host change.

## Chosen Stack at a Glance

| Layer | Choice | Version or pin rule | Evidence |
|---|---|---|---|
| JS runtime | System Node, kept as is | 26.8.2 at `/usr/local/bin/node` | 02 L47-L49; V10 |
| Package manager and monorepo | npm workspaces (`apps/*`, `packages/*`); internal deps declared as `"*"` | npm 11.19.1 | 02 §6 L596-L618; V19 |
| Language | TypeScript, one hoisted copy | `~6.0.3` | 02 §1.8 L234-L238 |
| React (every app) | `react`, `react-dom`, `react-test-renderer` | **19.2.3 exact** (Expo pin) plus root `overrides` | 02 §1.2 L83; §6 L608-L619; V2 |
| Mobile framework | Expo SDK 57, local debug build with `npx expo run:android` (CNG/prebuild), no EAS | expo 57.0.26, RN 0.86.3, template `expo-template-default@57.0.28` | 02 §1.1-§1.2; V2 |
| Mobile router | Expo Router (native stack via react-native-screens) | ~57.0.24; screens ~4.26.0 | 02 L95, L402 |
| Mobile UI kit | **HeroUI Native** | 1.0.10 | 02 §2.2; V5, V9 |
| Mobile styling | Uniwind (free tier) with Tailwind CSS v4 | uniwind 1.12.0; tailwindcss 4.3.3 | 02 L264; V5 |
| Mobile animation | Reanimated, worklets, gesture-handler, plus the kit's built-in animations | 4.5.1 / 0.10.1 / ~2.32.0 (via `npx expo install`) | 02 §1.2 L86-L88; V10 |
| Meters, gauges, charts | React Native Skia; victory-native (Skia-based) | 2.6.2; 42.0.1 | 02 L92, L374; V2 |
| Video | expo-video | ~57.0.5 | 02 L97, L410-L415 |
| Blur, gradient, haptics | expo-blur / expo-linear-gradient / expo-haptics | ~57.0.3 / ~57.0.2 / ~57.0.3 | 02 L96 |
| Bottom sheet | @gorhom/bottom-sheet (HeroUI Native peer) | 5.2.14 exact | 02 L371; V5 |
| Toasts | Built-in Toast in HeroUI Native and HeroUI web | kit | 02 L306; V4 |
| Icons | lucide-react-native / lucide-react (same glyph set) | 1.49.0 / 1.49.0 | V2; 02 L540 |
| Fonts | Geist (UI) and Geist Mono (timer, hashes). Mobile: expo-font with @expo-google-fonts. Web: @fontsource-variable | expo-font ~57.0.4; 0.4.2 / 0.4.3; 5.3.0 | V1, V2 |
| Keep-awake, orientation | expo-keep-awake; app.json `landscape` plus the API-36 large-screen opt-out property | ~57.0.2 | V1, V14 |
| Web build | Vite with @vitejs/plugin-react (create-vite `react-ts`) | 8.3.1 / 6.1.1 (create-vite 9.2.1) | 02 §4.1 L430-L437 |
| Web UI kit | **HeroUI v3** (`@heroui/react`, `@heroui/styles`) with Tailwind v4 | 3.2.6 / 3.2.6; tailwindcss 4.3.3 | 02 §4.4 L499-L506; V4, V8 |
| Web motion | Motion (`motion/react`) | 13.4.6 | 02 §4.5 L517-L522 |
| Web animated accents | Magic UI (free MIT items) and Motion Primitives (MIT), copied in as source, **never via `shadcn init`** | pinned by snapshot date at copy | 02 §4.3 L483, L486; V7 |
| Web router and data | TanStack Router with plugin; TanStack Query (also on mobile) | 1.170.40 (plugin 1.168.41); 5.104.0 | 02 §4.6 L526-L532 |
| Tables and charts (web) | TanStack Table v8 (headless) rendered through HeroUI Table; Recharts | 8.21.3; 3.10.1 | V2, V4; 02 L537 |
| Forms (both apps) | react-hook-form, zod, @hookform/resolvers | 7.89.0 / 4.6.5 / 5.9.1 | V2, V10 |
| Mock-core | Fastify with @fastify/websocket, run by tsx; bound to `127.0.0.1:4400` | 5.12.5 / 11.3.1 / 4.23.15 | 02 §5 L561-L579 |
| Emulator networking | `adb reverse tcp:4400 tcp:4400` (Metro's 8081 is reversed automatically); fallback `10.0.2.2` | platform-tools 37.0.1 | 02 §7.5 L711-L724 |
| JDK | Homebrew **formula** `openjdk@17` (no sudo) | 17.0.20.1 | 02 §7.1 L648; V20 |
| Android SDK | Google cmdline-tools zip into `~/Library/Android/sdk`, stable channel | cmdline-tools 23.0 (build 16111833) | 02 §7.2 L669; V16 |
| sdkmanager IDs | `platform-tools`, `emulator`, `platforms;android-36`, `build-tools;36.0.0`, `ndk;27.1.12297006`, `cmake;3.22.1`, `system-images;android-36;google_apis;arm64-v8a` | 37.0.1 / 37.1.11 / r2 / 36.0.0 / r27b / 3.22.1 / r7 | 02 §7.3; V12, V13 |
| AVD | `dems_tablet_api36`, device `pixel_tablet` (2560x1600), landscape | uses the image above | 02 §7.4 L697-L703 |
| Watchman | **Not installed** | none | 02 L744; V16, V20 |
| Tests | Vitest (web, mock, shared); jest-expo with RNTL (mobile) | vitest 5.0.3; jest-expo ~57.0.5, jest 29.7.0, RNTL 13.3.3 | V2 |

---

## 5W1H

| Dimension | Content |
|---|---|
| **What** | One chosen option per stack decision area, with rationale and at least one rejected alternative each. It also covers the Node verdict, the package-manager verdict, the React-alignment rule, conflict resolutions, and a host impact register with rollbacks. |
| **Who** | Decision owner: the user (demo owner). Consumers: row 4 (`masterplan/01_specs.md`), row 5 (`masterplan/02_plan.md`), row 6 (blueprint refinement), and the executors of rows 8-21 (`coder-execution`), row 13/22 (`verifier`), row 23 (`security-review`) and row 24 (`senior-code-reviewer`). External parties whose artefacts are relied on: Expo, Software Mansion, Shopify, HeroUI, Google (Android SDK), Homebrew, npm registry publishers. |
| **When** | Evidence was captured on 2026-09-30, between 22:34 and 23:19 WIB. The decisions hold for the demo window. Two dates to watch: **Node 26 becomes LTS on 2026-10-28** (02 L138-L144), and **Expo SDK 58 may reach stable in October 2026**, since the beta opened 2026-09-15 and RN 0.88 is scheduled for 2026-10-12 (02 L69, secondary). An SDK upgrade is a separate task, not a drift inside this one. |
| **Where** | Host: macOS 27.0.1 arm64, 725 GiB free (02 L49; V17). Workspace: `/Users/gsp-budi/Documents/DEMS`. Host paths outside the workspace are listed in the Host Impact Register. |
| **Why** | Drivers, in the user's order: (1) **D6**: ready-made frameworks and prebuilt animated components are mandatory, dark-first (S24); (2) the shortest path to a premium, fully animated UI on web and tablet with one design language (S8); (3) stability on the stable SDK 57 with `npx expo install` resolution; (4) local-only operation with telemetry off (I2, I6, NFR1). |
| **How** | (a) Read all identification, research and decision inputs. (b) Map S1-S29 to candidate libraries. (c) Score the kit pairs on weighted criteria derived from the drivers. (d) Close evidence gaps with V1-V21 (tarball reads, registry metadata, official docs, semver evaluation with npm's bundled `semver`, and read-only host probes). (e) Resolve source conflicts. (f) Build the impact register from a read-only host baseline. |

## Method

### Decision drivers and weights (analyst-assigned, derived from the delegation's priority order)

| Criterion | Weight | Derived from |
|---|---|---|
| K1: Ready-made, prebuilt components that ship animated (D6) | 30% | Driver 1; `decisions.md` D6 |
| K2: Built-in animation quality, running off the JS thread on mobile | 20% | Driver 2; C2; I5; NFR3 |
| K3: Alignment with the SDK 57 pins, New Architecture and Reanimated 4, and a matching starter or example | 20% | Driver 3; R12 |
| K4: Shared design language and tokens between web and mobile (S8) | 15% | Driver 2; 01 S8 L702 |
| K5: Coverage of S1-S29 (tables, charts, gauges, steppers, dialogs, toasts, forms, tabs, badges) | 10% | Driver 2; 01 L689-L723 |
| K6: Licence (flag Commons Clause, AGPL, paid tiers) and maturity | 5% | Driver 2; Dim 3 |

Scores run from 1 (poor) to 5 (best). Each score cites evidence. The scores are an analyst judgement, and the sensitivity analysis below shows how robust the ranking is.

### Evidence conventions

- `02 §x L<n>` means `research/02_collection.md` section x at line n.
- `01 S<n> L<n>` means `research/01_explore.md`, capability S<n>.
- `Vn` is an analyst verification listed below.
- `02s` means `identification/02_structured.md`.
- **Hypothesis** marks any claim not backed by one of these sources.

### Analyst verification log (V1-V21)

All commands used `npm_config_cache=<session scratchpad>/npmcache`. Tarballs were unpacked in the session scratchpad and never installed. No host state was changed.

| # | What was checked | Method | Result (quoted or summarised) |
|---|---|---|---|
| V1 | SDK 57 pins not listed in 02 | `npm pack expo@57.0.26`; read `bundledNativeModules.json` | `expo-font ~57.0.4`, `expo-keep-awake ~57.0.2`, `expo-screen-orientation ~57.0.2`, `expo-status-bar ~57.0.1`, `expo-system-ui ~57.0.4`, `expo-splash-screen ~57.0.9`, `@expo/vector-icons ^15.0.2`, `react-dom 19.2.3`, `react-native-web ~0.21.0`, `@shopify/flash-list 2.0.2`, `expo-navigation-bar ~57.0.3`. `@gorhom/bottom-sheet` is **not** in the file. |
| V2 | Versions and peers of candidate add-ons | `npm view <pkg> version license peerDependencies` | `lucide-react-native 1.49.0 ISC`, peer `react-native-svg ^12..^15`. `@expo-google-fonts/geist 0.4.2`, `geist-mono 0.4.3` (MIT AND OFL-1.1). `@fontsource-variable/geist` and `geist-mono` `5.3.0` (OFL-1.1). `@tanstack/react-table` latest `9.2.4`, v8 line `8.21.3`. `react-hook-form 7.89.0`, `zod 4.6.5`, `@hookform/resolvers 5.9.1` (peer `zod ^3.25.0 \|\| ^4.0.0`). `@testing-library/react-native 14.0.1` peers `test-renderer ^1.0.0`; `13.3.3` peers `react-test-renderer >=18.2.0`. `jest 30.5.2` latest, `jest@29` = `29.7.0`. `jest-expo@57.0.5` deps `babel-jest ^29.2.1`, `react-test-renderer 19.2.3`. `expo-template-default` dist-tags `sdk-57: 57.0.28`, `sdk-58: 58.0.8`, `next: 58.0.9`. `victory-native@42.0.1` peers `@shopify/react-native-skia >=2.6.0 <3.0.0`, `react-native-reanimated >=3.19.1`. `vitest@5.0.3` peer `vite ^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0`. `@testing-library/react@16.3.3` peer `@testing-library/dom ^10.0.0` (latest 10.4.2). `recharts@3.10.1` peers include `react-is`. `motion@13.4.6` peers `react ^18 \|\| ^19`. |
| V3 | Default Expo template deps | `npm view expo-template-default@57.0.28 dependencies devDependencies` | `react 19.2.3`, `react-dom 19.2.3`, `expo-router ~57.0.24`, `react-native-reanimated 4.5.1`, `react-native-worklets 0.10.1`, `react-native-gesture-handler ~2.32.0`, `expo-font ~57.0.4`, `react-native-web ~0.21.0`, dev `typescript ~6.0.3`, `@types/react ~19.2.2` |
| V4 | HeroUI v3 web component inventory | `npm pack @heroui/react@3.2.6`; `ls dist/components` (the docs page returned only category headings: V21) | The inventory includes `table`, `toast`, `tabs`, `modal`, `alert-dialog`, `drawer`, `chip`, `badge`, `meter`, `progress-bar`, `progress-circle`, `skeleton`, `pagination`, `form`, `textfield`, `number-field`, `select`, `combo-box`, `date-picker`, `slider`, `switch`, `tooltip`, `toolbar`, `breadcrumbs`, `surface`, `list-box`, `input-otp`, `empty-state`, `kbd`. **There is no chart and no stepper.** Peers: `react >=19.0.0`, `react-dom >=19.0.0`, `tailwindcss >=4.0.0`, `react-aria-components ^1.21.1`, `react-aria ^3.52.1`. |
| V5 | HeroUI Native and Uniwind peers | `npm view heroui-native@1.0.10 peerDependencies`; `npm view uniwind@1.12.0 peerDependencies` | HeroUI Native: `react-native-reanimated ^4.1.1`, `react-native-worklets >=0.5.1`, `react-native-gesture-handler ^2.28.0`, `react-native-screens >=4`, `react-native-svg ^15.12.1`, `react-native-safe-area-context ^5.6.0`, `expo-blur >=14.0.0`, `@gorhom/bottom-sheet ^5.2.9`, `tailwind-variants ^3.2.2`, `tailwind-merge ^3.4.0`, `react >=19.0.0`, `react-native >=0.81.0`. Uniwind: `tailwindcss >=4`, `react >=19.0.0`, `react-native >=0.81.0`, `metro *`, `@expo/metro-config *`. |
| V6 | Whether web and native HeroUI share theme variables | Unpacked `@heroui/styles@3.2.6` and `heroui-native@1.0.10`; `comm -12` of the `--var:` names | **44 names in common** (e.g. `--background`, `--foreground`, `--accent`, `--accent-foreground`, `--surface`, `--surface-secondary`, `--muted`, `--border`, `--danger`, `--success`, `--warning`, `--field-background`, `--radius`, `--overlay`, `--segment`, `--separator`, `--focus`, `--link`). Native-only: `--opacity-disabled`, `--theme`. Both dark themes open with the identical `--background: oklch(12% 0.005 285.823)`. Web dark selector: `.dark, [data-theme="dark"]`. Native: `@layer theme { :root { @variant dark {...} } }`. The web kit also ships easing variables (`--ease-out-expo` and others). |
| V7 | shadcn token names, to test the pairing of shadcn web with HeroUI Native | `curl https://ui.shadcn.com/r/colors/neutral.json` | Dark names: `background foreground card card-foreground popover popover-foreground primary primary-foreground secondary secondary-foreground muted muted-foreground accent accent-foreground destructive border input ring chart-1..5 sidebar-*`. Dark `accent` = `oklch(0.269 0 0)` (a neutral hover background). Only 6 names overlap with HeroUI, and `accent` has a **different meaning** (HeroUI `--accent` is the brand colour). |
| V8 | HeroUI licence | `head LICENSE` in the three tarballs; npm `license` field | All three ship an **Apache License 2.0** LICENSE file. npm metadata says `MIT` for `@heroui/react` and `@heroui/styles`, and `Apache-2.0` for `heroui-native`. The metadata is inconsistent, but both licences are permissive. |
| V9 | Dependencies of the HeroUI Native example app | `curl raw.githubusercontent.com/heroui-inc/heroui-native-example/main/package.json` | `expo ~57.0.18`, `react 19.2.3`, `react-native 0.86.3`, `reanimated 4.5.1`, `worklets 0.10.1`, `gesture-handler ~2.32.0`, `uniwind 1.12.0`, `tailwindcss ^4.3.2`, `heroui-native ^1.0.10`, `@gorhom/bottom-sheet ^5.2.14`, `@expo/vector-icons ^15.1.1`, `@expo-google-fonts/{inter,saira,sn-pro,space-grotesk}`, `@lingui/*`, **`expo-updates ~57.0.19`**, dev `typescript ~6.0.3`, `@types/react ~19.2.10` |
| V10 | Semver fit of every chosen pin | `node` with npm's bundled `semver` | PASS: RN `0.86.3` in Reanimated 4.5.1's `"0.83 - 0.86"`; worklets `0.10.1` in `0.10.x`; HeroUI Native peers (reanimated, worklets, RNGH `2.32.0` in `^2.28.0`, safe-area, svg, screens, expo-blur, react 19.2.3); victory-native peers; lucide peer; TanStack Table v8, RHF and resolvers; Node `26.8.2` in the engines of RN/Metro/expo-doctor, Vite, Vitest, TanStack Router, the shadcn CLI, @hono/node-server, tsx and corepack. FAIL: RNGH `3.3.0` against HeroUI's `^2.28.0`; React `19.2.3` against shadcn-admin's `^19.2.5`; RN `0.87.1` against Reanimated 4.5.1 (not used). |
| V11 | @gorhom/bottom-sheet peer range | `npm view @gorhom/bottom-sheet@5.2.14 peerDependencies`; `semver.validRange` | The range is `">=3.16.0 \|\| >=4.0.0-"`. `validRange` returns `null` (invalid in strict mode). With `loose: true`, `4.5.1` passes. The HeroUI example co-installs `^5.2.14` with Reanimated 4.5.1 (V9). |
| V12 | Android build values in RN 0.86.3 and in native libraries | `npm pack react-native@0.86.3`, reanimated 4.5.1, worklets 0.10.1, skia 2.6.2, expo-modules-core 57.0.20; grep the gradle files | `libs.versions.toml`: `minSdk 24`, `targetSdk 36`, `compileSdk 36`, `buildTools 36.0.0`, `ndkVersion 27.1.12297006`, `agp 8.12.0`, `kotlin 2.1.20`. `ReactAndroid/build.gradle.kts` L52: `cmakeVersion ... ?: "3.30.5"` (used only when building RN from source). All four libraries use `externalNativeBuild { cmake { path ... } }` with **no CMake version**, and take `ndkVersion` from the root project. |
| V13 | Sizes and channels of SDK packages not captured in 02 | `curl https://dl.google.com/android/repository/repository2-3.xml`; parsed macOS archives | `ndk;27.1.12297006` channel-0, 797 MiB (`android-ndk-r27b-darwin.zip`). `cmake;3.22.1` 36 MiB. `cmake;3.30.5` 40 MiB. `emulator` 37.1.11 channel-0 aarch64 376 MiB (37.2.11 is channel-1, 37.3.2 is channel-2). `platform-tools` 37.0.1, 15 MiB. `build-tools;36.0.0` 75 MiB. |
| V14 | Android 16 large-screen orientation behaviour | WebFetch `developer.android.com/about/versions/16/behavior-changes-16` | For apps targeting API 36, `screenOrientation`, `resizableActivity`, `min/maxAspectRatio` and `setRequestedOrientation()` are **ignored on displays of sw600dp or wider**, including the value `landscape`. Temporary opt-out: `<property android:name="android.window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY" android:value="true" />` at application or activity level. It "will not apply when targeting API level 37". |
| V15 | NDK and CMake auto-install | WebFetch `developer.android.com/studio/projects/install-ndk` | "Android Gradle Plugin 4.2.0+ can automatically install the required NDK and CMake the first time you build your project if their licenses have been accepted in advance." The page also says "Projects that don't set a specific CMake version are built with CMake 3.10.2", which conflicts with newer AGP defaults (see Conflict C5). |
| V16 | Expo environment page (local development build) | WebFetch `docs.expo.dev/get-started/set-up-your-environment/?...buildEnv=local` | Export lines: `JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home`, `ANDROID_HOME=$HOME/Library/Android/sdk`, and `PATH` additions for `$ANDROID_HOME/emulator` and `$ANDROID_HOME/platform-tools`. No Expo account is needed for local `npx expo run:android`. "Installing Watchman is only required for projects on SDK 55 and earlier." |
| V17 | Host baseline (read-only) | `test -e`, `find -user root`, `wc`, `df` | **absent**: `~/Library/Android`, `~/.android`, `~/.gradle`, `~/.expo`, **`~/.zshrc`**, `/opt/homebrew/opt/openjdk@17`, `/opt/homebrew/share/android-commandlinetools`. **exists**: `~/.zprofile` (11 lines: a Python 3.14 PATH line, `brew shellenv`, a `~/.npm-global/bin` PATH line), `~/.npm` (no root-owned entries at depth 3 or less), `~/.npm/_npx`. `~/Library/Mobile Documents/com~apple~CloudDocs` is empty. `df`: 725 GiB available. |
| V18 | Which zsh startup file loads when | `man zsh`, section STARTUP/SHUTDOWN FILES | ".zprofile" is read "if the shell is a login shell". ".zshrc" is read only "if the shell is interactive". |
| V19 | npm workspace protocol | Throwaway workspace in `$TMPDIR`: `npm install --offline` | `"workspace:*"` fails with `npm error code EUNSUPPORTEDPROTOCOL`. `"*"` succeeds and prints `@t/a@0.0.0 deduped -> ./packages/a`. |
| V20 | `openjdk@17` footprint | `formulae.brew.sh/api/formula/openjdk@17.json`; `brew list --formula` | 17.0.20.1, keg-only, `arm64_golden_gate` bottle present. Runtime deps: `freetype giflib harfbuzz jpeg-turbo libpng little-cms2`, **all absent on the host** (29 formulae installed now). `watchman`, `python@3.14` (formula), `pnpm` and `fnm` are absent. |
| V21 | HeroUI v3 docs components page | WebFetch `heroui.com/docs/react/components` | The page rendered only 15 category names, so V4 (the tarball) was used for the inventory. |

---

## Requirements

**Functional** (02s FR1-FR4; 01 L689-L723):
- FR1: core-web placeholder route. Uses the chosen kit and tokens, plays one animated enter transition, and shows a heartbeat indicator.
- FR2: mobile placeholder screen. Landscape, one Reanimated enter transition, and a heartbeat indicator.
- FR3: mock-core. A health route returns HTTP 200 JSON, and a WS heartbeat fires at 1 Hz, typed from `packages/shared`.
- FR4: `packages/shared` exports the stubs for the 24 §21.3 entities (01 L370-L385), the Part C enumerations (01 L641-L666), and design tokens.
- Library readiness for the feature phase (SC7): every library needed for S1-S29 is chosen now and installed during scaffold rows, so the feature phase needs no environment work.

**Non-functional**:
- NFR1: local-only, no accounts or cloud, telemetry off where configurable.
- NFR2: reproducible. Lockfile, exact pins and `.node-version`.
- NFR3: animations run off the JS main loop (Reanimated worklets; compositor-friendly transforms on web).
- NFR4: mock-core binds to loopback only.
- NFR5: every host change is logged with a rollback.
- Dark-first theme (01 S24 L718).

## Key Findings

### F1: The HeroUI web and native kits share one design language at the variable level [Confidence: HIGH]
- 44 of HeroUI Native's 46 theme variables have the same name in HeroUI web v3.2.6. The dark background value is identical (V6).
- Implication: one semantic token source in `packages/shared` can drive both apps through identical variable names, which answers S8 (01 L702) directly. Only the selector wrapper differs, and V6 captures it.

### F2: HeroUI Native is the only candidate kit with a first-party starter on the exact SDK 57 pins [Confidence: HIGH]
- Its example app uses `expo ~57.0.18`, `react-native 0.86.3`, `reanimated 4.5.1`, `worklets 0.10.1` and `gesture-handler ~2.32.0` (02 L309-L312; V9). These match `bundledNativeModules.json` (02 L76-L101).
- Every HeroUI Native peer passes against the SDK pins (V10).
- react-native-reusables templates are one SDK behind: `expo ~56.0.13`, RN 0.85.3, Reanimated 4.3.1 (02 L286-L290).

### F3: HeroUI Native's components ship animated; reusables mostly do not [Confidence: MEDIUM, from documentation]
- HeroUI Native: "Every component comes with smooth animations" (02 L297). Its 43 components include toast, dialog, bottom-sheet, tabs, chip, skeleton, slider, select and glass-view (02 L306).
- reusables: 32 components. Animation comes only through a `NativeOnlyAnimatedView` entering/exiting wrapper (02 L279-L281). It has no toast, bottom sheet or slider.

### F4: shadcn web would clash with the HeroUI Native token semantics [Confidence: HIGH]
- Only 6 variable names overlap, and `--accent` means a neutral hover background in shadcn but the brand colour in HeroUI (V7).
- Running `shadcn init` inside a HeroUI app would overwrite `--accent`. Implication: **never run `shadcn init` in core-web**. Copy registry items in as source instead.

### F5: HeroUI web v3 covers the Core console's heavy components except charts and steppers [Confidence: HIGH]
- It has table, toast, tabs, modal, alert-dialog, drawer, chip, badge, meter, progress-circle, skeleton and pagination (V4).
- Charts come from Recharts 3.10.1 (02 L537). Steppers are composed from kit components; no candidate kit ships one (V4; 02 L306).

### F6: Node 26.8.2 satisfies every engines range in the chosen stack [Confidence: HIGH]
- All 8 ranges checked pass (V10; 02 L119-L168).
- Expo CLI has no upper Node bound (02 L127). Node 26 becomes LTS on 2026-10-28 (02 L138). SDK 58 already lists "Node.js 26 and later" (02 L69).

### F7: The React version is fixed by React Native's renderer, not by choice [Confidence: HIGH]
- The RN 0.86.3 Fabric renderer embeds `version: "19.2.3"` (02 L619). jest-expo pins `react-test-renderer 19.2.3` (V2).
- Expo states that "Duplicate React versions in a single app will cause runtime errors" (02 L610).
- All chosen web libraries accept 19.2.3 (V10; 02 L518, L531).

### F8: npm 11.19.1 does not support `workspace:*`, despite the Expo doc wording [Confidence: HIGH]
- 02 L615 quotes Expo saying npm supports it. A local test fails with EUNSUPPORTEDPROTOCOL (V19). Internal dependencies must use `"*"`.

### F9: Android 16 ignores the landscape lock on tablets for apps targeting API 36 [Confidence: HIGH]
- SDK 57 targets API 36 (02 L208-L211; V12).
- `pixel_tablet` is 2560x1600 at xhdpi, a smallest width of about 800dp (02 L698). That is above the sw600dp threshold (V14).
- A manifest opt-out property exists for API 36 only (V14).

### F10: `~/.zshrc` does not exist; `~/.zprofile` does [Confidence: HIGH]
- V17. zsh reads `.zprofile` for login shells and `.zshrc` only for interactive shells (V18).
- The verification commands (`zsh -l -c ...`) are login but non-interactive, so they would never read `~/.zshrc`.

### F11: No install step in the chosen path needs sudo [Confidence: HIGH]
- The `openjdk@17` formula has a macOS 27 bottle and does not use sudo. `.pkg` casks do use sudo (02 L648, L657; V20).
- The Google cmdline-tools zip is unpacked in user space (02 L669).
- This addresses R1 and H8.

### F12: Sandbox write scope will block host installs and native builds unless handled explicitly [Confidence: HIGH]
- The collector's `npm` "root-owned files" error (02 L53) was the sandbox, not a corrupt cache: no root-owned entries exist (V17).
- The sandbox allows writes only inside the workspace, `$TMPDIR` and `~/.npm/_logs` (session configuration).
- Homebrew, `~/Library/Android`, `~/.android` and `~/.gradle` are all outside it. See R13.

---

## UI-Kit Pair Evaluation (drivers 1 and 2)

| Pair | K1 Ready-made and animated (30%) | K2 Animation quality (20%) | K3 SDK 57 fit and starter (20%) | K4 Shared tokens (15%) | K5 Coverage (10%) | K6 Licence and maturity (5%) | **Weighted** |
|---|---|---|---|---|---|---|---|
| **P1 HeroUI v3 (web) + HeroUI Native** | 5: both prebuilt; Native says every component is animated (02 L297) | 4: Native uses Reanimated; web uses CSS data-attribute transitions and Motion is optional (02 L501) | 5: example app on exact pins (02 L309; V9); peers PASS (V10) | 5: 44 shared variable names, identical dark base (V6) | 4: table, toast, tabs, modal, meter (V4); native toast, dialog, bottom-sheet (02 L306); no chart or stepper | 3: Apache-2.0 (V8); Native at 1.0.10 with 3,664 stars (02 L251) | **4.60** |
| P5 Hybrid: shadcn/ui (+ shadcn-admin, Magic UI, Motion Primitives) + HeroUI Native | 5 | 4 | 4: template React range `^19.2.5` fails against 19.2.3 (V10) | 2: 6 overlapping names, conflicting `--accent` (V7) | 5: admin shell with TanStack Table, Recharts and Sonner (02 L546-L553) | 4: MIT and Apache; Clerk "partial" to strip (02 L551) | 4.10 |
| P2 shadcn/ui (+ registries) + react-native-reusables | 4: web 5, mobile 3 (32 components, no toast or sheet) | 3: mobile entering/exiting only (02 L280) | 3: reusables templates on SDK 56 (02 L286-L290) | 5: same shadcn tokens and registry mechanism (02 L272) | 4 | 5: MIT; 8,674 stars (02 L250) | 3.80 |
| P3 Tamagui (web and native) | 3: premium Bento and Takeout are **paid** (02 L326) | 4: CSS, Reanimated and Motion drivers (02 L320) | 3: no SDK 57 starter collected; compiler setup | 5: one library on both | 3: tables and charts not collected | 3: npm `license` field empty on `tamagui` (02 L252) | 3.50 |
| P4 gluestack-ui v5 | 4: copy-paste universal (02 L333-L334) | 2: animation "not stated" (02 L253) | 2: needs NativeWind v5, still **RC** (02 L336) | 5 | 3 | 2: GitHub licence `null`, no LICENSE file (02 L339) | 3.15 |

**Sensitivity check.** If K4 drops to 5% and K5 rises to 20%, P1 scores 4.50 and P5 scores 4.40, so P1 still leads. P5 overtakes P1 only if the shared design language is judged nearly irrelevant, and the delegation's driver 2 asks for the opposite.

**Verdict:** P1 wins. The mobile fallback is react-native-reusables in its Uniwind variant. It uses the same styling engine (02 L271, L281), so switching kits would not change Metro or Tailwind configuration.

---

## Decision Record

Each area has exactly one choice and at least one rejected alternative. `SD-nn` identifiers are local to this file, and do not collide with `D1-D9` in `decisions.md`.

### A. Runtime and workspace

| ID | Area | Choice | Rationale and evidence | Rejected alternatives (reason, evidence) |
|---|---|---|---|---|
| SD-01 | Node runtime | **Keep the system Node v26.8.2** (`/usr/local/bin/node`). The repo gets `.node-version` = `26.8.2` and a root `engines.node` of `">=26.8.2 <27"`. No version manager. | All engines ranges pass (V10): RN 0.86.3, Metro 0.84.5 and expo-doctor (`>= 25.0.0`, 02 L119, L165); Vite 8.3.1; Vitest 5.0.3; TanStack Router; shadcn; tsx; Fastify LTS lists 26 (02 L168). Expo CLI has only a minimum, `NODE_MIN = [20, 19, 4]` (02 L127). Node 26 is LTS from 2026-10-28 (02 L138). SDK 58 minimum includes 26 (02 L69). This keeps the P0 rule "system Node preserved" (02s L325). | (a) **Node 24.21.0 LTS through fnm or nvm**: adds a host tool and profile lines with no incompatibility to justify it. Node 24 enters maintenance on 2026-10-20 (02 L142). Kept only as fallback E4. (b) **Upgrading the system Node to 26.10.0**: modifies the system Node, which the blueprint forbids. (c) **Node 22 (Jod)**: maintenance line and older. |
| SD-02 | Package manager | **npm 11.19.1 workspaces.** Internal dependencies are declared as `"*"`. Root `.npmrc` sets `save-exact=true`. | Already installed, so nothing to add (02 L46). Expo supports npm workspaces first-class and configures Metro for monorepos automatically (SDK 52+) (02 L596-L598). npm resolutions use `overrides` (02 L613). Corepack is absent on Node 26 (02 L172-L181). `"workspace:*"` fails in npm 11.19.1 (V19). | (a) **pnpm 12.8.1**: needs a host install (Homebrew, standalone script or npm) (02 L622-L634). Its default isolated mode "may cause build or resolution errors" with RN libraries, and the fix, `nodeLinker: hoisted` (02 L602-L605), gives up pnpm's main difference. (b) **Yarn 1.22.22**: last published 2024-03-09 (02 L637). (c) **Bun**: not installed and not evaluated. (d) **Turborepo 2.11.5**: not needed for four packages, and its telemetry would need disabling (02 L778). |
| SD-03 | Monorepo layout | Root `package.json` with `"private": true` and `"workspaces": ["apps/*", "packages/*"]`. Packages: `@dems/core-web`, `@dems/mobile`, `@dems/mock-core`, `@dems/shared`. Expo's automatic monorepo Metro config; `metro.config.js` only wraps `getDefaultConfig` with Uniwind. | The blueprint's default layout (02s L89-L106) needs no change. "Expo automatically detects monorepos and configures new app projects added to a monorepo" (02 L597). `autolinkingModuleResolution` is on automatically from SDK 55 (02 L614). | (a) **Separate repositories or installs per app**: prevents sharing types and tokens (S8, FR4). (b) **Hand-written Metro `watchFolders`, `nodeModulesPaths` or `disableHierarchicalLookup`**: Expo configures this since SDK 52 (02 L598), so manual overrides only add drift. |
| SD-04 | **React alignment rule** (H1/R7) | **RA-1:** every workspace that uses React declares `react` and `react-dom` at exactly `19.2.3`. **RA-2:** the value comes from `bundledNativeModules.json` of the pinned `expo`, never from npm `latest` (`19.3.0`, 02 L83). React changes only when the Expo SDK changes. **RA-3:** root `overrides` of `{"react":"19.2.3","react-dom":"19.2.3","react-test-renderer":"19.2.3","react-is":"19.2.3","@types/react":"~19.2.2"}`. **RA-4:** `react-native` exists only in `apps/mobile`, and web never depends on `react-native` or `react-native-web`. **RA-5:** no custom Metro resolver hacks; rely on SDK 52+ auto-config. **RA-6:** proof commands (row 24): `npm ls react react-dom --all` shows one version, all others `deduped`; `test ! -d apps/mobile/node_modules/react && test ! -d apps/core-web/node_modules/react`; `npx expo-doctor` reports no errors. | The RN renderer embeds 19.2.3 (02 L619). "Duplicate React versions in a single app will cause runtime errors" and "Duplicate React Native versions in a single monorepo are not supported" (02 L609-L610). Every web peer accepts 19.2.3: `@heroui/react >=19.0.0`, Motion `^19`, TanStack Table `>=18`, RHF `^19`, Recharts `^19`, @testing-library/react `^19` (V2, V4, V10). jest-expo pins `react-test-renderer 19.2.3` (V2). `@types/react ~19.2.2` comes from the Expo template (V3). | (a) **Web on React 19.3.0 (npm latest)**: two React versions in one hoisted tree. npm has no per-workspace "nohoist", so Metro could resolve the wrong copy (the failure mode is a hypothesis; the error class is documented at 02 L610). (b) **Isolating web with a separate install or pnpm isolated mode**: rejected under SD-02. |
| SD-05 | TypeScript line | **`typescript ~6.0.3`**, one hoisted copy. `@types/node 26.6.3` for mock-core. | The Expo SDK 57 template and shadcn-admin both pin `~6.0.3` (02 L235; V3). The HeroUI Native example pins `~6.0.3` (V9). | **TypeScript 7.0.2** (npm `latest`, Go-native, 02 L234): the templates have not moved to it, and tool compatibility is unverified (hypothesis). An unpinned `npm i typescript` would pull 7.x, so it must be pinned (R19). |

### B. Mobile (apps/mobile)

| ID | Area | Choice | Rationale and evidence | Rejected alternatives |
|---|---|---|---|---|
| SD-06 | Framework and scaffold | **Expo SDK 57** (`expo 57.0.26`, RN `0.86.3`). Scaffold with `create-expo-app` 5.0.0 from `expo-template-default@57.0.28` (dist-tag `sdk-57`, V2) inside `apps/mobile`. Row 5 validates the exact flag syntax with `--help`. | SDK 57 is `latest` and stable (02 L61-L66). The template already carries every SDK 57 animation pin, TS ~6.0.3 and Expo Router (02 L105-L110; V3). The New Architecture is mandatory and in place (02 L220-L230). | (a) **SDK 58**: `next`/beta (02 L61, L69), and the user rules out betas. (b) **Bare RN CLI** (`@react-native-community/cli 20.2.0`, 02 L166): loses Expo Router, config plugins and `npx expo install` resolution, and D6 favours the framework. (c) **Cloning `heroui-native-example` as the app**: a showcase app with `expo-updates` (OTA, EAS-oriented), lingui and many demo screens; its repo licence was not collected (V9). It is used as a **known-good version reference** only. (d) **reusables templates**: on SDK 56 (02 L286-L290). |
| SD-07 | Build mode | **Local debug build with `npx expo run:android`** using Continuous Native Generation: `android/` is produced by prebuild and git-ignored. No `expo-dev-client`, no `expo-updates`, no `eas.json`. `EXPO_NO_TELEMETRY=1` in every Expo script. | A local `run:android` needs no Expo account (V16). Expo CLI reverses the Metro port itself (02 L721). The debug variant already allows cleartext (02 L732). | (a) **EAS Build**: cloud upload of confidential-derived source; violates I2, I6 and A6. (b) **Expo Go**: requires Expo's client app and cannot carry our manifest changes (SD-22) (hypothesis). (c) **Adding `expo-dev-client` (~57.0.19)**: not needed for a single local Metro, and it is one more native module. That `run:android` works without it is a hypothesis; row 18 proves it. |
| SD-08 | Router and screen transitions | **Expo Router ~57.0.24** with typed routes. Native-stack screen transitions come from `react-native-screens ~4.26.0`. In-screen choreography uses Reanimated `entering`/`exiting`. | Template default (02 L105-L108; V3). `expo-router@57.0.24` depends on `react-native-screens`, not `@react-navigation/*` (02 L402-L403). Its file-based routing mirrors TanStack Router on web. | (a) **Standalone React Navigation 7** (`@react-navigation/native 7.5.0`): Expo Router 57 does not use it (02 L402), so there would be two navigation stacks. (b) **`react-native-screen-transitions` 4.0.0**: peers `@react-navigation/native >=7.3.0` and `react-native-teleport` (02 L376), a mismatch with Expo Router 57. (c) **Shared-element transitions**: behind a feature flag and "still experimental" (02 L399). |
| SD-09 | **UI kit** | **HeroUI Native 1.0.10** (Apache-2.0). | See the pair evaluation and F1-F3. It has a first-party example on the SDK 57 pins (V9) and ships animated components (02 L297). Its toast, dialog, bottom-sheet, tabs, chip, skeleton and slider cover S7, S9, S16 and S21 (02 L306). | (a) **react-native-reusables**: an SDK-56 template, minimal animation, and no toast or sheet (F2, F3). Kept as the documented fallback. (b) **Tamagui**: its own style system, so no Tailwind token sharing; premium parts are paid (02 L326). (c) **gluestack v5**: depends on the NativeWind v5 RC (02 L336). (d) **RN Paper**: Material Design 3, and no Reanimated animations documented (02 L346). (e) **Expo UI**: native Material/Compose look, stability not stated, no web sibling (02 L354). (f) **UI Kitten, ui-lib**: no web sibling, animation not collected (02 L255-L256). |
| SD-10 | Styling system | **Uniwind 1.12.0 (free MIT tier)** with `tailwindcss 4.3.3`, `tailwind-variants ^3.2.2`, `tailwind-merge ^3.4.0` (HeroUI peers, V5). `global.css` imports `tailwindcss`, `uniwind`, `heroui-native/styles`, then `@dems/shared/theme/heroui-native.css`. | Required by HeroUI Native (02 L297-L299). It is on Tailwind v4, the same major as web (02 L438), so one token vocabulary serves both. Peers pass (V5). | (a) **NativeWind 4.2.7**: Tailwind 3 (`~3`, 02 L263). Different Tailwind major from web, and HeroUI Native does not support it. (b) **NativeWind 5.0.0-rc.0**: pre-release (02 L263). (c) **Uniwind Pro**: paid, "$99/seat/year" (02 L264), and not needed because the kit's animations are built in. (d) **Unistyles 3.3.0**: not Tailwind (02 L265). |
| SD-11 | Animation stack | **Reanimated 4.5.1 + react-native-worklets 0.10.1**, installed with `npx expo install`, plus the kit's built-in animations. Reanimated layout animations and CSS animations are used for bespoke motion. `babel-preset-expo` adds the worklets plugin automatically. | These are the SDK pins (02 L86-L87). Reanimated 4 is New-Architecture-only and supported on RN 0.86 (02 L382-L385; V10). `babel-preset-expo` `worklets` defaults to `true` (02 L395-L398). Entering/exiting are "fully supported on Android" (02 L390). | (a) **Moti 0.30.0**: depends on `framer-motion ^6.5.1`, last published 2025-01-29, last push 2025-03-11 (02 L366). Reanimated 4 covers the same ground. (b) **Reanimated 4.7.0**: outside the SDK pin and needs worklets 0.13 (02 L363). (c) **react-native-ease 0.8.1**: pre-1.0 (02 L377). |
| SD-12 | Gestures | **react-native-gesture-handler ~2.32.0** (SDK pin). | 02 L88; HeroUI Native peer `^2.28.0` passes (V10). | **RNGH 3.3.0**: not the SDK pin, fails the HeroUI peer (V10), and renames APIs (02 L406). |
| SD-13 | Rich visuals: audio meters, gauges, pulses (S3, S14) | **@shopify/react-native-skia 2.6.2** (SDK pin). Meters are Skia canvases driven by Reanimated shared values on the UI thread. | 02 L92. Skia integrates with Reanimated `>=4.0.0` and worklets `>=0.7.0` (02 L408). It meets S3's "without JS-thread jank" (01 S3 L697). It needs the NDK, handled in SD-49 (02 L408). | (a) **SVG meters with react-native-svg**: heavier per-frame work for 20-30 Hz meters (hypothesis). (b) **Lottie ~7.3.8**: *deferred, not rejected*. It is asset-driven and no assets exist yet; add it when design assets arrive. (c) **Rive**: peers not collected (02 L378). |
| SD-14 | Charts on mobile (S14, Device Health) | **victory-native 42.0.1** (Skia-based). | Peers pass: Skia `>=2.6.0 <3.0.0`, Reanimated `>=3.19.1` (V2, V10). It reuses the Skia chosen in SD-13. | **react-native-gifted-charts 1.4.78**: peers not collected (02 L375), and SVG-based (hypothesis). |
| SD-15 | Video preview (S5) | **expo-video ~57.0.5**, `useVideoPlayer` with `<VideoView>`, looping local MP4. | Android uses Media3/ExoPlayer and progressive MP4 (02 L410-L415). First-party SDK pin (02 L97). | **react-native-video**: not collected, so compatibility on the pins is unproven. |
| SD-16 | Blur, gradient, haptics | **expo-blur ~57.0.3**, **expo-linear-gradient ~57.0.2**, **expo-haptics ~57.0.3**. | SDK pins (02 L96). Android blur is "stable", efficient on API 31+ via `BlurTargetView` (02 L417-L422); the AVD is API 36. HeroUI Native peers `expo-blur >=14` (V5). | (a) **expo-mesh-gradient ~57.0.2**: Android support not evidenced (hypothesis). (b) **expo-glass-effect**: part of the template, but not evidenced on Android (hypothesis). It stays installed and unused. |
| SD-17 | Bottom sheet | **@gorhom/bottom-sheet 5.2.14**, pinned exactly with npm because it is not in `bundledNativeModules.json`. | HeroUI Native's BottomSheet peer is `^5.2.9` (V5), and the example app uses `^5.2.14` (V9). Its peer range is invalid in strict semver but passes in loose mode (V11). | **vaul**: a web drawer, pulled in by expo-router internally (02 L402); not a native sheet. |
| SD-18 | Toasts (S16) | **HeroUI Native Toast** (built into the kit). | 02 L306. One visual language with the web HeroUI Toast (V4). | (a) **sonner-native 0.27.0**: duplicates the kit and adds peers (02 L372). (b) **burnt 0.13.0**: native OS toasts, last published 2025-03-10 (02 L373). |
| SD-19 | Icons | **lucide-react-native 1.49.0** (ISC). | Peer `react-native-svg ^15` matches SDK pin 15.15.4 (V2, V10). It is the same glyph set as lucide-react 1.49.0 on web (02 L540), which gives S8 icon parity. | **@expo/vector-icons ^15.0.2**: SDK-pinned (V1) and used by the HeroUI example (V9), but the web choice does not mirror its glyph set. |
| SD-20 | Fonts | **Geist** for UI and **Geist Mono** for timers, hashes and IDs (S4, S19). Loaded with `expo-font ~57.0.4` from `@expo-google-fonts/geist 0.4.2` and `@expo-google-fonts/geist-mono 0.4.3`. | Same families as web (SD-35), so typography is part of the shared language. Licences are MIT AND OFL-1.1 (V2). expo-font is an SDK pin (V1). | (a) **Inter** (`@expo-google-fonts/inter 0.4.2`, the HeroUI example's font, V9): viable, but judged more generic. This is a design judgement (hypothesis). (b) **System Roboto**: not premium. |
| SD-21 | Keep-awake (S28) | **expo-keep-awake ~57.0.2** (`useKeepAwake` on the Live Session Monitor). | SDK pin (V1); 01 S28 L722. | Native `FLAG_KEEP_SCREEN_ON` through custom native code: hand-built, against D6. |
| SD-22 | Orientation lock (S23, A3) | **`app.json` `"orientation": "landscape"`**, plus an app-level manifest property `android.window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY=true` added by a small local Expo config plugin. The AVD runs in its natural landscape orientation, and layouts must still tolerate portrait. | The template default is `"portrait"` (02 L108). Android 16 ignores `screenOrientation`, including `landscape`, on sw600dp+ screens for targetSdk 36 (V14). SDK 57 targets 36 (02 L211; V12). `pixel_tablet` is about 800dp wide at its smallest (02 L698). The opt-out works for API 36 only (V14), so tolerant layouts are the durable answer. | **expo-screen-orientation ~57.0.2 `lockAsync`**: it sits on `setRequestedOrientation()`, which V14 lists as ignored. That mapping is a hypothesis but a strong one. |
| SD-23 | Data and realtime client (S1, S2) | **TanStack Query 5.104.0** (same as web) plus the platform `WebSocket`, wrapped in a shared reconnect-and-resync helper from `@dems/shared`. | Query "works with ReactDOM and React Native" (02 L531). The WebSocket is built into both runtimes (hypothesis: platform standard). Resync through `GET /api/v1/session/current` (01 L355; S2 L696). | **socket.io-client**: would force the socket.io protocol onto the mock, and it was not collected. |

### C. Web (apps/core-web)

| ID | Area | Choice | Rationale and evidence | Rejected alternatives |
|---|---|---|---|---|
| SD-24 | Build tool | **Vite 8.3.1 + @vitejs/plugin-react 6.1.1**, scaffolded with `create-vite 9.2.1` `react-ts`. | Node range passes (V10). The plugin peers `vite ^8.0.0` (02 L434). No telemetry was found (02 L775). | (a) **Next.js 16.3.7**: SSR is not needed for a local SPA console, and it needs a telemetry opt-out (02 L777). (b) **TanStack Start 1.168.59**: full-stack SSR, not needed. (c) **plugin-react-swc 4.3.3**: brings no feature this task needs. |
| SD-25 | **UI kit** | **HeroUI v3**: `@heroui/react 3.2.6` + `@heroui/styles 3.2.6` on Tailwind 4.3.3. Dark-first through `<html class="dark" data-theme="dark">`. | React 19 and Tailwind v4, React Aria based, animations via data-attribute CSS transitions, respects reduced motion (02 L499-L503). Inventory covers S7, S13, S15, S16 and S21 (V4). Apache-2.0 LICENSE (V8). Shares 44 token names with the mobile kit (V6). | (a) **shadcn/ui 4.21.0 (+ shadcn-admin)**: token clash (V7), React range `^19.2.5` fails the alignment rule (V10), Clerk "partial" (02 L551). Scored 4.10 against 4.60. (b) **Mantine 9.6.3**: "No native Tailwind integration" (02 L508), so no shared tokens. (c) **Tremor**: peer `react ^18`, last published 2025-01 (02 L538). |
| SD-26 | Web motion engine | **Motion 13.4.6** (`motion/react`): route transitions with `AnimatePresence`, layout animations, and the placeholder enter transition, using transform and opacity only (compositor-friendly, NFR3). | MIT; peers `react ^19` (V2; 02 L517-L519). Every chosen animated registry depends on `motion` (02 L483-L487). | (a) **`framer-motion` package name**: same release under the legacy name (02 L519). (b) **CSS-only**: HeroUI's own transitions are good for controls but not for route choreography (design judgement). (c) **Motion+**: paid, "$399" (02 L520). |
| SD-27 | Animated component collections | **Magic UI (free MIT items only)** and **Motion Primitives (MIT)**, copied in as source (copy-in model), recorded in a `THIRD_PARTY_NOTICES.md` with item name and snapshot date. **Do not run `shadcn init` in core-web** (F4). If the shadcn CLI is used for `add`, a hand-written `components.json` must point its CSS to a separate `src/styles/registry.css`. | Magic UI: 250 items, MIT (02 L483). Motion Primitives: 33 items, MIT, pushed 2026-09-28 (02 L486). HeroUI web defines `--color-background`, `--color-foreground`, `--color-border` and `--color-muted` (V6), so most utility classes resolve. Classes that exist only in shadcn (e.g. `text-muted-foreground`) need mapping at copy time (hypothesis: small edits). | (a) **Animate UI, React Bits**: MIT + **Commons Clause** redistribution limits (02 L485, L487), a risk if the demo is ever handed to a client. (b) **Aceternity**: free-component licence not stated (02 L484). (c) **coss ui**: repo reports **AGPL-3.0** (02 L489). (d) **Cult UI**: registry unavailable (02 L490). (e) **Kokonut UI**: licence not checked (02 L488). (f) **Magic UI Pro, Aceternity Pro**: paid, and need an account (02 L483-L484). |
| SD-28 | Ready-made admin template | **None.** The console shell is composed from HeroUI parts (Surface, Card, Tabs, ListBox, Drawer, Breadcrumbs, Toolbar, EmptyState; V4). That is composition of prebuilt components, which complies with D6. | Only one MIT template fits Vite (02 L546-L553), and it is bound to shadcn tokens (F4). HeroUI's templates are Pro-only. | (a) **satnaing/shadcn-admin (MIT)**: token clash, React `^19.2.5` (V10), Clerk partial auth, and many demo pages to prune. (b) **HeroUI Pro templates**: paid perpetual plans with unverified prices (02 L313). (c) **Kiranism/next-shadcn-dashboard-starter**: Next.js (02 L554). |
| SD-29 | Router | **TanStack Router 1.170.40 + @tanstack/router-plugin 1.168.41**, file-based, with the plugin placed before `@vitejs/plugin-react`. | 02 L526-L528. Node range passes (V10). | **React Router**: not collected, so it cannot be pinned from evidence. **TanStack Start**: SSR is not needed. |
| SD-30 | Data | **TanStack Query 5.104.0** (shared across both apps). | 02 L531. | **SWR, or fetch in effects**: not collected, and Query is already chosen for mobile. |
| SD-31 | Tables (S13) | **@tanstack/react-table 8.21.3** for the headless model (sort, filter, pagination), rendered through **HeroUI Table** (V4). | v8 is the line shadcn-admin uses (`^8.21.3`, 02 L548). The React peer passes (V10). | (a) **TanStack Table 9.2.4**: a new major with no template evidence yet (V2). (b) **HeroUI Table alone**: filter and pagination logic would be hand-written. |
| SD-32 | Charts and gauges (S14, S15) | **Recharts 3.10.1**, themed from token CSS variables, with `react-is@19.2.3` for its peer. Gauges use HeroUI `meter` and `progress-circle` (V4). | MIT (02 L537). shadcn's chart component is itself a Recharts v3 wrapper (02 L472). Peers pass (V2). | (a) **@mantine/charts**: tied to Mantine (02 L509). (b) **Tremor**: React 18 only (02 L538). |
| SD-33 | Toasts (S16) | **HeroUI Toast** (V4). | Built into the kit; same language as mobile (SD-18). | **Sonner 2.0.8**: duplicates the kit, and shadcn's sonner item pulls in `next-themes` (02 L472). |
| SD-34 | Icons | **lucide-react 1.49.0** (ISC). | 02 L540; parity with SD-19. | **@tabler/icons-react**: an Aceternity dependency (02 L484), not collected. |
| SD-35 | Fonts | **@fontsource-variable/geist 5.3.0** and **@fontsource-variable/geist-mono 5.3.0**, self-hosted from npm with no CDN. | OFL-1.1 (V2); parity with SD-20; no runtime external request (NFR1). | **Google Fonts CDN `<link>`**: an external request at runtime. |
| SD-36 | Forms (S10, both apps) | **react-hook-form 7.89.0 + zod 4.6.5 + @hookform/resolvers 5.9.1**. The zod schemas live in `@dems/shared` and are reused by mock-core for validation. | Peers pass (V2, V10). One schema serves web, mobile and mock (S1, S10). | **React Aria's built-in validation only**: no schema shared with mobile or the mock (design judgement). **Formik**: not collected. |

### D. Shared package and tokens (packages/shared)

| ID | Area | Choice | Rationale and evidence | Rejected alternatives |
|---|---|---|---|---|
| SD-37 | Contents | Consumed as **TypeScript source** with no build step (`exports` point at `src/*.ts`). **`src/domain/`**: 24 §21.3 entity stubs (01 L370-L385) and the Part C enumerations (01 L641-L666), written as `const` objects plus union types (erasable syntax). **`src/api/`**: `/api/v1` path constants (01 L348-L368), health and heartbeat payload types, and zod schemas. **`src/realtime/`**: the WS reconnect-and-resync helper (S2). **`src/tokens/`**: `tokens.ts` and the status-to-tone map (S8). **`theme/`**: generated CSS (SD-38). Only runtime dependency: `zod`. | FR4 (02s L143). Vite, Metro (through Expo's monorepo auto-config, 02 L598) and tsx all compile TS from workspace packages. That Metro compiles TS outside the project root is a hypothesis; row 15/18 proves it. `const` objects instead of TS `enum` keep the code runnable under any TS stripper (02 L583). | (a) **A built `dist/` package with tsup or tsc**: adds a build step and a watch process for no demo benefit. (b) **TS `enum`**: unsupported by Node type stripping (02 L583), and they limit future runner choice. |
| SD-38 | Token pipeline (S8) | `src/tokens/tokens.ts` is the **single source**. It uses HeroUI's semantic names (`background`, `surface`, `accent`, `danger`, `success`, `warning`, `muted`, `border`, `radius`, `field-*`). It stores OKLCH strings for CSS and sRGB hex for JS consumers, and also motion tokens (durations and cubic-bezier arrays usable by Motion's `ease` and Reanimated's `Easing.bezier`). A script, `scripts/gen-theme.ts` run with tsx, emits **`theme/heroui-web.css`** (`.dark, [data-theme="dark"] { --accent: ...; }`) and **`theme/heroui-native.css`** (`@layer theme { :root { @variant dark { --accent: ...; } } }`). Each app imports its file right after the kit stylesheet. Skia, victory-native, Recharts and Motion import `tokens.ts` directly. | 44 shared variable names (V6) mean one mapping serves both kits. The selector syntax is copied from each kit's own stylesheet (V6). The kits use OKLCH (V6). That RN colour parsing does not accept `oklch()` is a hypothesis, so hex is kept for JS consumers; row 15 verifies it. | (a) **Two hand-maintained CSS files**: will drift. (b) **Style Dictionary or Tokens Studio**: not collected, and heavier. (c) **shadcn token names**: 6 overlaps and a conflicting `accent` (V7). |

### E. Mock-core (apps/mock-core)

| ID | Area | Choice | Rationale and evidence | Rejected alternatives |
|---|---|---|---|---|
| SD-39 | Framework and WS | **Fastify 5.12.5 + @fastify/websocket 11.3.1** (built on `ws ^8.16.0`), with `@types/ws 8.18.2`. | First-party WS plugin with route-level `{ websocket: true }` (02 L563, L570-L573). The Fastify LTS table lists Node 26 (02 L168). | (a) **Hono 4.13.12 + @hono/node-server 2.1.3**: WS needs manual `ws` `noServer` wiring (02 L564), and `@hono/node-ws` is deprecated with a stale peer (02 L565). (b) **Raw `ws` 8.22.0**: no REST routing (02 L566). |
| SD-40 | TS runner | **tsx 4.23.15** (`tsx watch src/index.ts`). | Engines `>=18` (02 L567). Handles tsconfig and workspace TS. | **Node 26 native type stripping**: no enums, namespaces or parameter properties; "`tsconfig.json` files are ignored"; "paths are not supported"; file extensions are mandatory (02 L582-L589). |
| SD-41 | Port and binding | **`127.0.0.1:4400`**, with HTTP and WS on the same port: `fastify.listen({ host: '127.0.0.1', port: 4400 })`. Executors check with `lsof -nP -iTCP:4400 -sTCP:LISTEN` first (E5). The REST health route and WS path names are set in row 4, because the book defines none (01 G6 L677). | Fastify's default listens on "the address(es) resolved by `localhost`" (02 L576), which may be more than one. An explicit IPv4 loopback meets NFR4 and matches `adb reverse`. Port 4400 is not a default of any tool in this stack (hypothesis; Vite's 5173 and Metro's 8081 are known defaults). | (a) **`0.0.0.0` or LAN binding**: exposure, violates NFR4. (b) **Port 3000**: a common default for many Node tools, so a higher chance of collision (hypothesis). |
| SD-42 | Browser access path | A **Vite dev `server.proxy`** for `/api` and the WS path to `127.0.0.1:4400`, so the browser sees one origin and no CORS is needed. Mobile calls `127.0.0.1:4400` directly through `adb reverse`. | Smallest server surface. `server.proxy` is a standard Vite feature, but it was not captured in 02 (hypothesis to confirm in row 17). | **@fastify/cors 11.3.0** (Appendix A): adds a CORS surface to the mock. |

### F. Device networking

| ID | Area | Choice | Rationale and evidence | Rejected alternatives |
|---|---|---|---|---|
| SD-43 | Emulator to host | **`adb reverse tcp:4400 tcp:4400`**. Metro's port is reversed automatically by Expo CLI. It is exposed as a root script (`mobile:reverse`) and must be re-run after every emulator boot. The app reads its base URL from a public Expo env variable (`http://127.0.0.1:4400`; the name is fixed in row 4). Fallback: `10.0.2.2:4400`. | Expo CLI reverses **only** the Metro port (02 L721-L723). `10.0.2.2` "is a special alias to your host loopback interface" (02 L711-L718), which confirms H3. `adb reverse` also works for a physical USB tablet (A4). The `adb reverse` syntax source is secondary, but Expo's own CLI uses it (02 L719-L721). | **`10.0.2.2` as primary**: emulator-only (fails on a physical tablet), and needs a different URL per runtime. |
| SD-44 | Cleartext `ws://` in debug (H4, R8) | **Rely on the template.** The debug and debugOptimized manifests set `usesCleartextTraffic="true"`; release sets `false`. No Network Security Config file. | 02 L725-L736: RN gradle plugin placeholders plus template manifests. | (a) **Cleartext in the main manifest**: would leak into release. (b) **Custom NSC XML**: unnecessary for a debug-only demo. A domain-scoped NSC through a config plugin is a feature-phase item if a release APK for a physical tablet is needed. |

### G. Android toolchain

| ID | Area | Choice | Rationale and evidence | Rejected alternatives |
|---|---|---|---|---|
| SD-45 | JDK | **Homebrew formula `openjdk@17` 17.0.20.1** (keg-only). `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`. The optional `sudo ln -sfn ... /Library/Java/JavaVirtualMachines` caveat is **not** run. | RN and Expo recommend JDK 17 (02 L185-L190). AGP requires JDK 17 (02 L202). Gradle 9.3.1 supports Java 17 (02 L191, L198). There is a macOS 27 bottle and no sudo (02 L648; V20). The keg path follows from the formula caveat's `$HOMEBREW_PREFIX/opt/openjdk@17/libexec/openjdk.jdk` (02 L648). `Contents/Home` is the standard JDK bundle layout (hypothesis; row 8 verifies with `ls`). | (a) **`zulu@17` cask**, the docs' choice: its `.pkg` artifact runs `/usr/sbin/installer` with `sudo: true` (02 L651, L657), which is R1. (b) **`temurin@17`**: also `.pkg` (02 L652). (c) **`openjdk@21`**: docs say "You may encounter problems using higher JDK versions" (02 L185). (d) **`openjdk` 27**: Gradle 9.3.1 is below the 9.8.0 needed for Java 27, so the build would fail (02 L198-L199). |
| SD-46 | Command-line tools | **Google's official zip `commandlinetools-mac_arm64-16111833_latest.zip`** (rev 23.0, 148 MiB, SHA-1 `ad03dc49bfacfd52c110b14104ea548b8a07e830`), unpacked to `~/Library/Android/sdk/cmdline-tools/latest`. | Latest stable, checksum published in the manifest (02 L669). Layout per the sdkmanager docs (02 L673). The SDK path matches Expo's documented `ANDROID_HOME` (V16). | (a) **Homebrew cask `android-commandlinetools`**: build 15859902 is older (02 L666-L670). Its SDK root sits inside `/opt/homebrew/share/android-commandlinetools` (02 L666), which would mix about 3.3 GiB of SDK content into the Homebrew prefix. (b) **Android Studio**: out of scope, and its `zap` removes `~/.android` (02 L751). |
| SD-47 | Channel | **Stable (channel 0)** for every package, which is sdkmanager's default. Do not pass `--channel`. | 02 L673. The emulator stable build is 37.1.11 (V13). | **Beta or dev channels** (emulator 37.2.11 or 37.3.2; V13): not suitable for a demo. |
| SD-48 | sdkmanager package IDs | `platform-tools`, `emulator`, `platforms;android-36`, `build-tools;36.0.0`, `ndk;27.1.12297006`, `cmake;3.22.1`, `system-images;android-36;google_apis;arm64-v8a`. Licences are pre-accepted with `yes \| sdkmanager --licenses`. | compileSdk, targetSdk, buildTools and NDK come from the RN 0.86.3 catalog (V12; 02 L211). NDK: Skia requires it (02 L408), and all four native libraries build C++ with the root `ndkVersion` (V12). Pre-installing it (797 MiB, V13) makes the download deterministic and logged. CMake 3.22.1 is a hedge (36 MiB); AGP auto-installs any other version it needs once licences are accepted (V15). See conflict C5. | (a) **`platforms;android-35`**: see conflict C1. (b) **`cmake;3.30.5`**: used only for RN source builds (V12). (c) **Leaving NDK and CMake to AGP auto-install**: works (V15) but hides an ~0.8 GiB download inside the first Gradle build. |
| SD-49 | System image | **`system-images;android-36;google_apis;arm64-v8a`**, rev 7, 1,786 MiB. | Matches compileSdk and targetSdk 36 and arm64 (I3). Latest revision (02 L685). | (a) **`google_apis_playstore`**: Play Store and account features the demo does not need (+13 MiB, 02 L686). (b) **`default`**: older rev 2 (02 L688). (c) **`android-36.1` or `37.x`**: newer than targetSdk 36 and not needed (02 L687, L690). (d) **`ps16k`**: 16 KB page-size variant, not needed (02 L689). |
| SD-50 | AVD | Name **`dems_tablet_api36`**, device **`pixel_tablet`** (10.95 in, 2560x1600, xhdpi), started with `-no-metrics` and host GPU (the GPU mode is a hypothesis; row 10 records it). Row 4 fixes RAM and core counts. | Device ID confirmed from cmdline-tools 23.0 (02 L697-L703). Its natural orientation is landscape (2560 by 1600). | (a) **`medium_tablet`**: a generic profile at the same resolution (02 L699). An acceptable alternate. (b) **`small_tablet` (7 in)**: less representative of a 10-11 in operator tablet. The tablet model is unknown (01 G12 L683), so this is a hypothesis. |
| SD-51 | Watchman | **Not installed** (proposes dropping row 11). | Expo: "only required for projects on SDK 55 and earlier" (02 L744; V16). The formula would add 8 dependencies, including a Homebrew `python@3.14` and `folly` (02 L740; V20), all absent on the host. | **Installing watchman**: RN calls it "highly recommended ... for better performance" (02 L745). That is a performance nicety, not a requirement. Re-evaluate only if Metro file watching proves slow. |

### H. Tests and telemetry

| ID | Area | Choice | Rationale and evidence | Rejected alternatives |
|---|---|---|---|---|
| SD-52 | Web, mock and shared tests | **Vitest 5.0.3** with `jsdom 30.1.1`, `@testing-library/react 16.3.3` (+ `@testing-library/dom 10.4.2`) and `@testing-library/jest-dom 7.0.1`. Mock-core tests use a `ws` client for the heartbeat, plus Fastify `inject()` for health (hypothesis: a standard Fastify API not captured in 02). | Vitest peer `vite ^8` and Node `>=26` both pass (V2, V10). | **Jest for web**: would be a second config style on the Vite side. |
| SD-53 | Mobile tests | **jest-expo ~57.0.5** with **jest 29.7.0** and **@testing-library/react-native 13.3.3**. | SDK pin (02 L99). jest-expo is built on the Jest 29 line (`babel-jest ^29.2.1`) and ships `react-test-renderer 19.2.3` (V2). RNTL 13.3.3 peers `react-test-renderer >=18.2.0` (V2). | (a) **Jest 30.5.2**: mismatches jest-expo 57's Jest 29 dependencies. (b) **RNTL 14.0.1**: needs the `test-renderer ^1.0.0` peer, which jest-expo 57 does not provide (V2). |
| SD-54 | Telemetry | `EXPO_NO_TELEMETRY=1` in every Expo npm script and in the run guide. A `HOMEBREW_NO_ANALYTICS=1 HOMEBREW_NO_AUTO_UPDATE=1` prefix on each brew command, which leaves no persistent change. Emulator runs with `-no-metrics`. Decline any Android tools metrics prompt. | Expo opt-out variable: 02 L760. Homebrew: 02 L779. Emulator: 02 L780 (secondary). Vite, create-expo-app and the shadcn CLI showed no telemetry (02 L769-L776). | **`brew analytics off`**: a persistent change to the user's Homebrew configuration. Per-command variables are less intrusive. |

---

## Capability Coverage Matrix (S1-S29, 01 L689-L723)

| S | Need | Web | Mobile | Status |
|---|---|---|---|---|
| S1 | Typed REST client | `@dems/shared` types, zod and TanStack Query | same | Covered |
| S2 | WS with reconnect and REST resync | platform WS, shared helper, Query invalidation | same | Covered (helper written in the feature phase) |
| S3 | 20-30 Hz dual meters off the JS thread | Motion values or HeroUI Meter | Skia with Reanimated shared values | Covered |
| S4 | Server-authoritative timer | Geist Mono; Magic UI number-ticker (optional) | Geist Mono and Reanimated | Covered |
| S5 | Two looped preview tiles | HTML5 `<video>` | expo-video | Covered |
| S6 | Shared state machine | `@dems/shared` definitions | same | Library choice (e.g. XState) deferred to the feature phase: not collected (hypothesis) |
| S7 | Gate checklist with badges | HeroUI Chip, ListBox, Card | HeroUI Native Chip, ListGroup, Card | Covered |
| S8 | Status-to-token mapping | `tokens.ts` and generated CSS | same | Covered (V6) |
| S9 | Connection banner and degraded mode | HeroUI Alert and Motion | HeroUI Native Alert and Reanimated | Covered |
| S10 | Validated forms | RHF, zod, HeroUI TextField | RHF, zod, HeroUI Native TextField | Covered |
| S11 | Login, pairing, lockout | HeroUI InputOTP (V4) | HeroUI Native input-otp (02 L306) | Covered |
| S12 | Animated stepper | Composed (no kit stepper, V4) with Motion | Composed with Reanimated | Composition of kit parts (D6-compliant) |
| S13 | Tables | TanStack Table v8 with HeroUI Table | FlashList 2.0.2 (SDK pin, 02 L94) with ListGroup rows | Covered |
| S14 | Charts and gauges | Recharts, HeroUI Meter and ProgressCircle | victory-native and Skia | Covered |
| S15 | Capacity gauge and calculator | HeroUI NumberField, Meter, RHF | n/a | Covered |
| S16 | Severity toasts | HeroUI Toast | HeroUI Native Toast | Covered |
| S17 | 800x480 LCD simulation and LEDs | Fixed-size DOM container with Motion | n/a | Composed |
| S18 | Appliance digital twin | SVG with Motion; Magic UI beam effects (item availability is a hypothesis) | n/a | Composed |
| S19 | Hash display and JSON viewer | Geist Mono, HeroUI Surface; JSON viewer library not collected | same | Gap: choose a JSON viewer in the feature phase |
| S20 | RBAC gating | HeroUI disabled states and Tooltip | same | Covered (logic) |
| S21 | Confirmation with mandatory reason | HeroUI Modal or AlertDialog | HeroUI Native Dialog or BottomSheet | Covered |
| S22 | Time-source widget | Composed Chip and Surface | same | Composed |
| S23 | Landscape multi-pane layout | n/a | SD-22 with flex layout | Covered, with the R14 caveat |
| S24 | Dark theme | HeroUI `.dark` | HeroUI Native `@variant dark` | Covered (V6) |
| S25 | Fault-injection hooks | n/a | n/a | Feature phase (D4) |
| S26 | Idempotent session | mock logic | n/a | Feature phase (D4) |
| S27 | i18n readiness | deferred (A10) | deferred; Lingui is used by the HeroUI example (V9) | Deferred |
| S28 | Keep awake | n/a | expo-keep-awake | Covered |
| S29 | Time-source-aware timestamps | `Intl` | `Intl` on Hermes (hypothesis) | Covered (hypothesis on Hermes) |

---

## Source Conflicts Resolved

| # | Conflict | Evidence for each side | Resolution |
|---|---|---|---|
| C1 | **compileSdk 35 vs 36** (02 Gaps 14, L1085) | **35**: RN environment docs page "Android SDK Platform 35" (02 L216). **36**: the RN 0.86.3 catalog says `compileSdk = "36"`, `targetSdk = "36"`, `buildTools = "36.0.0"` (02 L211; re-read in V12). The Expo SDK table says "Compile SDK 36 / Target SDK 36" (02 L208). The Expo emulator page says "Android SDK Platform 36" (02 L216). The 35 values in `expo-modules-autolinking` are **fallbacks** used only when the catalog value is absent (02 L212). | **36.** Four primary sources, including the build catalog itself, against one generic docs page that is most likely stale. Install `platforms;android-36` and `build-tools;36.0.0`. If a library later requests 35, AGP can auto-install it once licences are accepted (V15); row 18 would record that. |
| C2 | **Reanimated 4.5.x peer range** (02 Gaps 14, L1086) | The docs table says 4.5.x supports RN "0.86-0.87" (02 L384). npm `react-native-reanimated@4.5.1` peer is `"0.83 - 0.86"` (02 L363). | **Moot for this stack.** RN `0.86.3` satisfies both (V10: PASS). They differ only on RN 0.87, which is not used (V10: `0.87.1` FAIL on npm). Rule: never upgrade RN apart from the Expo SDK; `npx expo install` resolves Reanimated 4.5.1. |
| C3 | **`workspace:*` with npm** (new) | Expo docs: "Bun, npm, and pnpm support ... `"workspace:*"`" (02 L615). Local npm 11.19.1: `EUNSUPPORTEDPROTOCOL` (V19). | **Use `"*"`.** Local behaviour beats the doc statement, and `"*"` links correctly (V19). |
| C4 | **HeroUI licence metadata** (new) | npm `license: MIT` for `@heroui/react` and `@heroui/styles` (Appendix A, 02 L861-L862). The shipped `LICENSE` is Apache-2.0 in all three tarballs (V8). HeroUI docs say Apache-2.0 (02 L500). | **Treat as Apache-2.0**, the stricter of the two: keep the LICENSE and NOTICE attribution. Both are permissive, so no action blocks the stack. |
| C5 | **Default CMake version** (new) | Android page: "built with CMake 3.10.2" (V15), probably stale. RN's source-build default is 3.30.5 (V12). No native library pins a version (V12). That 3.22.1 is the AGP 8.x default is a hypothesis. | **Pre-install `cmake;3.22.1` and accept all licences.** AGP 4.2.0+ auto-installs whatever CMake it actually needs (V15). Row 18 records the `cmake;` ID the first build uses. |
| C6 | **JAVA_HOME path** (new) | The Expo docs line points to the Zulu `.pkg` location (V16). | **Use the formula keg path** (SD-45). The docs line assumes the sudo cask channel this record rejects. |

## Hypotheses H1-H8: Status

| H | Statement (02s L39-L46) | Status | Evidence |
|---|---|---|---|
| H1 | Web and mobile can share one React install | **Confirmed, conditional on the SD-04 rule** (web must use 19.2.3) | 02 L608-L619; V2; V10 |
| H2 | A Tailwind-based mobile kit enables shared tokens | **Confirmed, stronger than stated.** HeroUI web and native share 44 variable names | V6; 02 L251, L264 |
| H3 | `10.0.2.2` is an alias for host loopback | **Confirmed** | 02 L711-L718 (official doc) |
| H4 | Debug builds allow cleartext `ws://` | **Confirmed at template level.** Runtime proof in row 19 | 02 L732-L736 |
| H5 | `~/Documents` may be iCloud-synced | **Preliminary: not synced.** The CloudDocs container is empty. Row 13 owns the verdict | V17 |
| H6 | A global git identity exists | **Open** (row 25) | none |
| H7 | macOS 27 bottles exist | **Confirmed** for `openjdk@17`, `watchman` and `pnpm`. The six JDK dependency bottles are not verified (hypothesis); row 8 records them | 02 L648, L740, L631; V20 |
| H8 | Formulae need no sudo; `.pkg` casks do | **Confirmed** from local Homebrew source | 02 L657-L660 |

---

## Host Impact Register

The baseline was taken on 2026-09-30 at about 23:15 WIB (V17). "Absent at baseline" means the rollback may delete the whole path. No step needs sudo.

| # | Host path (outside workspace) | Change | Row | Size (download / disk) | Rollback command | Baseline |
|---|---|---|---|---|---|---|
| HI-1 | `/opt/homebrew/Cellar/openjdk@17/17.0.20.1`, `/opt/homebrew/opt/openjdk@17`, plus 6 dependency formulae (`freetype giflib harfbuzz jpeg-turbo libpng little-cms2`) and their transitive dependencies | `HOMEBREW_NO_ANALYTICS=1 HOMEBREW_NO_AUTO_UPDATE=1 brew install openjdk@17`. Row 8 records `brew list --formula` before and after. | 8 | Not sourced. Hypothesis: 250-350 MB download, 400-500 MB on disk | `brew uninstall openjdk@17`, then `brew uninstall <each formula in row 8's before/after diff>`. **Do not use a bare `brew autoremove`**: it could remove orphans that existed before this task. | Absent (V17, V20) |
| HI-2 | `~/Library/Caches/Homebrew/downloads/*` (bottle cache) | Written by `brew install` | 8 | Same as HI-1 download | `brew cleanup openjdk@17` (targeted) | Pre-existing directory (hypothesis) |
| HI-3 | **`~/.zprofile`** (exists, 11 lines) | Backup: `cp -p ~/.zprofile ~/.zprofile.bak.dems-2026-09-30`. Row 8 appends block A and row 9 appends block B (exact lines below). **`~/.zshrc` is not created.** | 8, 9 | under 1 KB | `cp -p ~/.zprofile.bak.dems-2026-09-30 ~/.zprofile`, or remove by marker: `sed -i '' '/^# >>> dems-demo:/,/^# <<< dems-demo:/d' ~/.zprofile` | Exists (V17) |
| HI-4 | `~/Library/Android/sdk/` (cmdline-tools 23.0, platform-tools, emulator, platforms/android-36, build-tools/36.0.0, ndk/27.1.12297006, cmake/3.22.1, system-images/android-36/google_apis/arm64-v8a, licenses/) | Unzip cmdline-tools, then `sdkmanager --licenses` and `sdkmanager <IDs>` | 9 | **3,296 MiB download (sourced total**: 148 + 15 + 376 + 63 + 75 + 797 + 36 + 1,786). Hypothesis: 7-10 GB on disk once unpacked | `rm -rf ~/Library/Android` | Absent, parent included (V17) |
| HI-5 | `~/.android/` (`avd/dems_tablet_api36.avd` and `.ini`, `adbkey`/`adbkey.pub`, emulator and analytics settings) | `avdmanager create avd`; created on first `adb` or emulator run | 10 | Hypothesis: 6-10 GB (userdata, cache, snapshots) | `avdmanager delete avd -n dems_tablet_api36`, then `adb kill-server`, then `rm -rf ~/.android` | Absent (V17) |
| HI-6 | `~/.gradle/` (wrapper `gradle-9.3.1-bin`, dependency caches, daemon) | First `npx expo run:android` | 18 | Hypothesis: 1.2-2.2 GB download, 2-3 GB on disk | `(cd apps/mobile/android && ./gradlew --stop)`, then `rm -rf ~/.gradle` | Absent (V17) |
| HI-7 | `~/.expo/` | May be created by Expo CLI state (hypothesis) | 18 | KB | `rm -rf ~/.expo` | Absent (V17) |
| HI-8 | npm cache | **Recommended: a workspace-local cache.** Run npm with `npm_config_cache="$PWD/.cache/npm"` from the workspace root, and git-ignore `.cache/`. That avoids `~/.npm` writes and sandbox EPERM (R13). If the default cache is used instead, content is added under `~/.npm/_cacache` and `~/.npm/_npx`. | 14-18 | Hypothesis: 0.4-0.6 GB download; `node_modules` 1-1.5 GB (inside the workspace) | Workspace cache: `rm -rf .cache/npm`. Default cache: leave it (content-addressed and shared with other projects). **Do not run `npm cache clean --force`** on the user's cache. | `~/.npm` exists, with no root-owned files (V17) |
| HI-9 | Global npm (`~/.npm-global`) | **None.** No `npm i -g`; `npx` is used for scaffolds | none | none | n/a | `~/.npm-global/bin` is on PATH (V17); untouched |
| HI-10 | Homebrew analytics setting | **None.** Per-command environment variable only | none | none | n/a | `HOMEBREW_NO_ANALYTICS` unset (V17) |
| HI-11 | Watchman, pnpm, fnm, JDK symlink in `/Library/Java/JavaVirtualMachines` | **None** (SD-51, SD-02, SD-01, SD-45) | none | none | n/a | Absent (V20) |
| HI-12 | `$TMPDIR` (Metro cache, emulator temp) | Written at runtime | 16-22 | Hypothesis: under 1 GB | `rm -rf "$TMPDIR"/metro-* "$TMPDIR"/haste-map-*` (optional; self-managed) | n/a |
| HI-13 | Loopback listeners (processes, not files): mock-core 127.0.0.1:4400, Vite 5173, Metro 8081, adb 5037, emulator console and adb ports | Started by rows 16-19 | 16-19 | none | Kill the recorded PIDs; `adb emu kill`; `adb kill-server` | none |

**Exact profile lines** (to append; `~/.zprofile` is read by login shells, V18):

```sh
# >>> dems-demo: jdk (added 2026-09-30, blueprint row 8) >>>
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
# <<< dems-demo: jdk <<<
```

```sh
# >>> dems-demo: android sdk (added 2026-09-30, blueprint row 9) >>>
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
# <<< dems-demo: android sdk <<<
```

- `JAVA_HOME/bin` is **prepended** so it takes precedence over the macOS `/usr/bin/java` stub. That precedence is a hypothesis; row 8 checks it with `zsh -l -c 'which java; java -version'`.
- The Android entries are **appended**, following Expo's own export style (V16).
- Both blocks go after the existing `brew shellenv` line, so Homebrew paths are already set when they run.

### Disk and download estimate

| Component | Download | On disk | Basis |
|---|---|---|---|
| Android SDK packages (HI-4) | **3,296 MiB** | 7-10 GB | Sourced: 02 L669, L680-L685; V13. The on-disk figure is a hypothesis |
| AVD data (HI-5) | 0 | 6-10 GB | Hypothesis |
| JDK and dependencies (HI-1) | 250-350 MB | 400-500 MB | Hypothesis |
| Gradle distribution and caches (HI-6) | 1.2-2.2 GB | 2-3 GB | Hypothesis |
| npm packages (HI-8 plus `node_modules`) | 0.4-0.6 GB | 1-1.5 GB (plus up to 0.6 GB of cache) | Hypothesis |
| Mobile build outputs (`apps/mobile/android/**/build`) | 0 | 1-2 GB | Hypothesis |
| **Total** | **about 5.2-6.5 GB** (3.2 GiB of it sourced) | **about 18-27 GB** | Under 4% of the 725 GiB free (V17) |

### Confidentiality exposure

| Channel | Exposure | Control |
|---|---|---|
| Install and build network traffic (Homebrew bottles, `dl.google.com`, npm registry, Gradle and Maven repositories) | Package identifiers only; no project content (hypothesis: standard package-manager behaviour) | Generic, pinned package names only |
| Expo CLI | Anonymous telemetry by default (02 L760) | `EXPO_NO_TELEMETRY=1` (SD-54) |
| Homebrew | Aggregate analytics by default (02 L779) | Per-command `HOMEBREW_NO_ANALYTICS=1` |
| Android emulator and SDK tools | Metrics banner; cmdline-tools bundles an analytics library (02 L780) | `-no-metrics`; decline prompts. **Gap**: the opt-in state for sdkmanager and avdmanager was not collected |
| Metro dev server (8081) | **Hypothesis:** may listen on all interfaces, which would expose JS bundles (these will contain book-derived labels in the feature phase) on the LAN | Rows 18 and 23 run `lsof -nP -iTCP:8081 -sTCP:LISTEN`. If it binds to `*`, record CAUTION and use the macOS firewall or `--localhost` |
| Vite dev server (5173) | Defaults to localhost (hypothesis) | Do not pass `--host`; row 17 verifies with `lsof` |
| mock-core (4400) | Loopback only | Explicit `127.0.0.1` (SD-41) |
| Git | Local only; `docs/` contains book extracts (D8) | No remote; decided in row 25 |
| iCloud | Preliminary: not synced (V17) | Row 13 verdict (R6) |
| This analysis | Tarballs, a manifest and a temp npm test in the session scratchpad and `$TMPDIR` only. Queries were generic (Query Log) | none needed |

---

## Risks

Updates to 02s R1-R12, and new risks R13-R21.

| ID | Risk | Likelihood | Impact | Mitigation | Owner row |
|---|---|---|---|---|---|
| R1 | Admin password prompt | **Low** (was Medium) | Blocks row 8 or 9 | No cask or `.pkg` in the chosen path (F11). On any prompt, return `needs-review` | 8, 9 |
| R2 | Node 26 incompatibility | **Low** | Build errors | All ranges pass (V10). Fallback E4: fnm with Node 24.21.0, system Node untouched | 12 |
| R3 | Emulator smoothness is not representative | High | Misleading UX judgement | Record the jank baseline; recommend a physical tablet before the demo | 10, 22 |
| R4 | Download volume | High (time) | Slow first run | Sized above; pre-install the NDK so the first Gradle build is predictable | 9, 18 |
| R5 | Missing bottles | **Low** | Source builds | Bottles verified for the main formulae (V20) | 8 |
| R6 | iCloud sync | **Low** (preliminary) | Sync load, confidentiality | Row 13 confirms | 13 |
| R7 | Duplicate React | **Low** with SD-04 | Metro runtime error | RA-1 to RA-6; row 24 proof commands | 14-18, 24 |
| R8 | Cleartext blocked | **Low** | No heartbeat on the emulator | Template debug manifest (SD-44) | 19 |
| R9 | Confidential leakage | Low | High | Confidentiality register above | 23 |
| R10 | Orphaned processes | Medium | Flaky rows | Record PIDs; add stop scripts | 16-22 |
| R11 | No git identity | Unknown | Row 25 blocked | `needs-review` | 25 |
| R12 | Kit lags Reanimated or the New Architecture | **Low** | Rework | HeroUI Native example on the exact pins (V9), peers pass (V10) | 18 |
| **R13** | **Sandbox write scope.** Homebrew, `~/Library/Android`, `~/.android`, `~/.gradle` and `~/.npm` are outside the sandbox's writable paths, so installs and native builds fail with EPERM. npm misreports it as "root-owned files" (02 L53; V17) | **High** | Blocks rows 8-10 and 18; misleading errors | Use a workspace-local npm cache for npm commands (HI-8). Host installs and Gradle/emulator commands need **per-command sandbox bypass through the permission gate** (user-visible). Row 5 should batch them and mark them. Never "fix" it by chowning `~/.npm` | 5, 8-10, 14-18 |
| **R14** | **Android 16 large-screen override.** The landscape lock is ignored on `pixel_tablet` at targetSdk 36 (V14) | High (certain) | Low-Medium: portrait rotation during the demo | Opt-out property through a config plugin (SD-22). Natural-landscape AVD. Layouts tolerate portrait. The opt-out goes away at API 37 | 18 |
| **R15** | **SDK 58 goes stable during or soon after this task** (02 L69) | Medium | Upgrade pressure; templates drift | Stay on SDK 57 until after the demo. An upgrade is a separate task with `npx expo install --fix` | n/a |
| **R16** | **HeroUI Native maturity** (1.0.10; 3,664 stars, 02 L251) and HeroUI web v3 recency | Medium | Component bugs | Fallback: react-native-reusables in its Uniwind variant, on the same engine (SD-09). Report bugs rather than patching kit internals | 18, feature phase |
| **R17** | Copy-in registry components assume shadcn class names | Medium | Styling fixes | Never run `shadcn init` in core-web (F4). Map classes at copy time. Record each item in `THIRD_PARTY_NOTICES.md` | 17, feature phase |
| **R18** | The invalid `@gorhom/bottom-sheet` peer range (V11) triggers an npm ERESOLVE | Low | Install error | The HeroUI example co-installs it (V9). If npm errors, report it for review; **no `--legacy-peer-deps` without review** | 18 |
| **R19** | An unpinned install pulls TypeScript 7 or Jest 30 | Medium | Tooling breakage | Exact pins (SD-05, SD-53); `save-exact=true` | 14-20 |
| **R20** | Metro listens on the LAN (hypothesis) | Medium | Bundle exposure | `lsof` check; CAUTION path (confidentiality register) | 18, 23 |
| **R21** | Gradle requests an NDK, CMake or platform other than the pre-installed ones | Low-Medium | Unplanned download mid-build | Licences pre-accepted, so AGP auto-installs (V15). Row 18 logs the actual IDs | 9, 18 |

---

## Files and Modules Involved (to be created by rows 14-21; no existing file is modified except the git-ignore rules already agreed in D7)

| Path | Role |
|---|---|
| `package.json` (root) | Private workspace root: `workspaces`, `overrides` (SD-04), `engines`, scripts (`dev:*`, `typecheck`, `lint`, `test`, `mobile:reverse`, `theme:gen`) |
| `package-lock.json` | Lockfile (NFR2) |
| `.npmrc` | `save-exact=true` |
| `.node-version` | `26.8.2` |
| `tsconfig.base.json` | Shared compiler options (TS ~6.0.3) |
| `.gitignore` (append) | `.cache/`, `apps/mobile/android/`, `apps/mobile/ios/`, `.expo/`, `dist/` (row 7 already covers most) |
| `THIRD_PARTY_NOTICES.md` | Copied-in registry items with licence and date (SD-27) |
| `packages/shared/{package.json,src/**,scripts/gen-theme.ts,theme/*.css}` | SD-37, SD-38 |
| `apps/mock-core/{package.json,src/index.ts,test/*}` | SD-39 to SD-41 |
| `apps/core-web/{package.json,vite.config.ts,index.html,src/**}` | SD-24 to SD-36, SD-42 |
| `apps/mobile/{package.json,app.json,metro.config.js,global.css,app/**,plugins/with-large-screen-orientation-optout.js}` | SD-06 to SD-23 |
| `README.md` (root) | Run guide (row 21) |

## Implementation Order (for rows 4-5)

1. **Row 8, JDK** (SD-45). First, because sdkmanager needs Java (02 L666 caveat "requires Java").
2. **Row 9, Android SDK** (SD-46 to SD-49): licences, then the packages.
3. **Row 10, AVD** (SD-50): cold boot with `-no-metrics`.
4. **Row 11**: **drop** (SD-51).
5. **Row 12**: becomes **verification only** (SD-01, SD-02): no install, just record `node -v` and `npm -v`. It can merge into row 13.
6. **Row 13, environment check.** Add the iCloud verdict and a sandbox-scope note (R13).
7. **Rows 14 to 18, in order**:
   - root (workspace, overrides);
   - shared (tokens first, since both apps import the generated theme CSS);
   - mock-core (the heartbeat target for both clients);
   - core-web (fastest feedback loop);
   - mobile (longest build).
8. **Rows 19 to 25** as blueprinted.

## Acceptance Criteria (inputs for row 4 to map to SC1-SC7)

1. `zsh -l -c 'java -version'` prints `17.0.20.1` and `zsh -l -c 'echo $JAVA_HOME'` resolves to an existing directory. (SC1)
2. `zsh -l -c 'sdkmanager --list_installed'` lists all seven IDs from SD-48 and `cmdline-tools;latest` 23.0. (SC1)
3. `avdmanager list avd` shows `dems_tablet_api36` on `pixel_tablet`. `adb shell wm size` prints `2560x1600`. (SC1)
4. `npm ls react react-dom --all` shows exactly one version, `19.2.3`. Neither `apps/mobile/node_modules/react` nor `apps/core-web/node_modules/react` exists. (SC2, R7)
5. `grep -R '"workspace:' package.json apps/*/package.json packages/*/package.json` returns nothing. (SD-02)
6. `npm ls typescript` shows a single `6.0.x`. `npm ls jest` in mobile shows `29.7.0`. (R19)
7. `npx expo-doctor` (with `EXPO_NO_TELEMETRY=1`) reports no errors, and `npx expo install --check` reports nothing to fix. (SC2, SC4)
8. `lsof -nP -iTCP:4400 -sTCP:LISTEN` shows `127.0.0.1:4400` only. (SC5, NFR4)
9. `adb reverse --list` includes `tcp:4400` and `tcp:8081`. (SC5)
10. The mobile screenshot width is greater than its height, and the merged manifest contains `PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY`. (SC4, R14)
11. There is no `eas.json`, no `expo-updates` dependency and no `extra.eas.projectId`. (NFR1)
12. Every Expo script contains `EXPO_NO_TELEMETRY=1`. (NFR1)
13. `packages/shared/theme/heroui-web.css` and `heroui-native.css` are both generated from `tokens.ts`, and both apps import them. (S8)
14. `~/.zprofile` differs from its backup only by the two marked blocks, and `~/.zshrc` still does not exist. (NFR5)

## Blueprint Impact for Row 6 (B.9 classification input)

| Change | Rows | Class | Reason |
|---|---|---|---|
| Shell profile target changes from `~/.zshrc` (absent) to `~/.zprofile` (existing), and verification uses `zsh -l -c` | 8, 9, 12, 13 | MINOR | Execution detail; same authorisation (A9 names "for example `~/.zshrc`") |
| Drop watchman | 11 | MINOR | Not required on SDK 57 (V16); smaller host impact |
| Row 12 becomes verification only (no version manager, no pnpm) | 12 | MINOR | Node verdict SD-01; package manager SD-02 |
| Web kit is HeroUI v3 instead of the candidate shadcn/ui | 17 | MINOR | "library swaps within one decision area" (02s L173) |
| Mobile gains HeroUI Native, Uniwind, the orientation opt-out plugin and fonts | 18 | MINOR | Library choices within scope |
| Add `ndk;27.1.12297006` and `cmake;3.22.1` | 9 | MINOR | Version pins and dependency corrections |
| Sandbox bypass for host and native-build commands (R13) | 8-10, 18 | MINOR | Execution mechanics. Still surfaced to the user through the permission gate |
| MAJOR triggers checked | n/a | **None hit** | A1 and A2 unchanged. Expo retained. No Android Studio. No new app or package. System Node kept. Effort goes down (one row dropped, one reduced) |

## Recommendations

1. **Adopt the stack in "Chosen Stack at a Glance" as the input to row 4.** Pin every version exactly. Use `npx expo install` for every package listed in `bundledNativeModules.json`, and `npm install --save-exact <pkg>@<ver>` for everything else.
2. **Adopt the React alignment rule SD-04 verbatim** as a spec acceptance criterion, and have row 24 quote its proof commands.
3. **Generate both kit themes from `tokens.ts`** (SD-38) before scaffolding either app. The dark-first "luxury" palette is a brand decision for the feature phase (G12). The scaffold may use HeroUI's default dark with a single token-driven accent.
4. **Treat R13 as a planning item in row 5.** Group every command that writes outside the workspace, and mark each one "requires sandbox bypass approval". Use the workspace-local npm cache for all npm commands.
5. **Add the orientation opt-out config plugin** (SD-22) and keep layouts portrait-tolerant.
6. **Never run `shadcn init` in core-web.** Copy registry items in and record them in `THIRD_PARTY_NOTICES.md`.
7. **Test on a physical tablet before the demo** (R3, A4). `adb reverse` already supports that path (SD-43).
8. **Freeze on SDK 57 until after the demo** (R15).

---

## External Research Synthesis

`research/03_external_vocabulary.md` does not exist for this task. The dimensions and scope follow `identification/01_translated.md` "External Research Scope" (L171-L177) and 02's "External Research Findings" (L799-L840).

### Technology Trends (Dim 1)
- The React Native ecosystem has consolidated on the New Architecture (02 L220-L230), and Tailwind v4 is spreading into React Native through Uniwind and NativeWind v5 (02 L805).
- The chosen pair sits on that trend: Uniwind and Tailwind v4 on mobile, Tailwind v4 on web.
- Stack risk: fast release cadence (SDK 58 beta, TypeScript 7, RNGH 3). It is mitigated by exact pins (R15, R19).

### Technology Evaluation (Dim 2)
- Decided above (SD-01 to SD-54) with the pair evaluation matrix.
- The comparative rationale is evidence-backed, with V1-V21 filling the gaps the collection left open.

### Vendor Evaluation (Dim 3, limited to licence, paid tiers and accounts)
- **Build vs buy: build on free OSS cores.** No purchase is needed. Rejected paid options:
  - HeroUI Pro (02 L313);
  - Uniwind Pro (02 L264);
  - Magic UI Pro and Aceternity Pro (02 L483-L484);
  - Motion+ (02 L520);
  - Tamagui Pro (02 L326).
- Licence flags excluded by choice: Commons Clause (Animate UI, React Bits) and AGPL (coss).
- No chosen component needs an account (V16; 02 L758-L785).

### Market Share & Positioning (Dim 4)
No findings. Not in scope (01_translated L176).

### Regulatory & Compliance (Dim 5)
No findings. Not in scope. Evidence rules apply to the real product, not to a synthetic-data demo (01_translated L176).

### Competitive Landscape (Dim 6)
No findings. Not in scope.

### Industry Trends (Dim 7)
No findings. Not in scope.

## Assumptions

- A-1: The demo's visual target is dark-first (01 S24 L718, itself a hypothesis in the source). Both kits ship dark variants (V6).
- A-2: The tablet form factor is about 10-11 inches. The tablet model is unknown (01 G12 L683), so `pixel_tablet` is a proxy.
- A-3: Documentation-level animation claims ("every component comes with smooth animations") hold on device. Rows 17, 18 and 22 produce the first rendering evidence.
- A-4: Package-manager and registry network traffic carries package identifiers only (standard behaviour; not independently verified).
- A-5: The user's install authorisation (C7, A9) covers `~/.zprofile` in the same way as the named example `~/.zshrc`.

## Gaps

| # | Gap | Impact | Owner |
|---|---|---|---|
| G-1 | On-disk sizes and transitive Homebrew dependencies were not sourced | Estimates are labelled hypotheses | Rows 8-10, 18 record actual `du -sh` |
| G-2 | Metro's listen address | Possible LAN exposure (R20) | Rows 18, 23 |
| G-3 | Opt-in state of the Android cmdline-tools analytics | Telemetry uncertainty | Rows 9, 23 |
| G-4 | Whether `run:android` works without `expo-dev-client` (hypothesis) | If not, add `expo-dev-client ~57.0.19` (MINOR) | Row 18 |
| G-5 | Exact API names: Uniwind metro wrapper, HeroUI Native provider and theme setter | Scaffold wiring details | Rows 4, 5 (from the vendor quick starts) |
| G-6 | JSON viewer (S19) and state-machine library (S6) | Feature-phase choices | Feature phase |
| G-7 | Whether RN colour parsing rejects `oklch()` (hypothesis behind hex fallbacks) | Token format | Row 15 |
| G-8 | Licence of `heroui-native-example` repo | Only relevant if code is copied from it; this record uses it as a version reference only | n/a |

## Plan Note

This row does **not** create `masterplan/02_plan.md`. Blueprint rows 4 (`masterplan/01_specs.md`) and 5 (`masterplan/02_plan.md`) own those artifacts, and they take this record as input.

## Query Log (analyst, generic only)

No design-book text, "DEMS" project content or document excerpts were used in any query.

- **npm registry** (`npm view` / `npm pack`, package names only):
  - expo@57.0.26, expo-template-default, jest-expo, react-native@0.86.3;
  - react-native-reanimated@4.5.1, react-native-worklets@0.10.1, @shopify/react-native-skia@2.6.2, expo-modules-core@57;
  - @heroui/react@3.2.6, @heroui/styles@3.2.6, heroui-native@1.0.10, uniwind@1.12.0, shadcn@4.21.0;
  - lucide-react-native, @expo-google-fonts/{geist,geist-mono,inter}, @fontsource-variable/{geist,geist-mono,inter};
  - @tanstack/react-table, react-hook-form, zod, @hookform/resolvers;
  - @testing-library/{react-native,react,jest-dom,dom}, test-renderer, jest, jsdom, @types/react;
  - vitest@5.0.3, motion@13.4.6, recharts@3.10.1, victory-native@42.0.1, @gorhom/bottom-sheet@5.2.14.
- **curl**:
  - `https://dl.google.com/android/repository/repository2-3.xml`
  - `https://formulae.brew.sh/api/formula/openjdk@17.json`
  - `https://raw.githubusercontent.com/heroui-inc/heroui-native-example/main/package.json`
  - `https://ui.shadcn.com/r/colors/neutral.json`
- **WebFetch**:
  - `https://heroui.com/docs/react/components`
  - `https://developer.android.com/about/versions/16/behavior-changes-16`
  - `https://developer.android.com/studio/projects/install-ndk`
  - `https://docs.expo.dev/get-started/set-up-your-environment/?platform=android&device=simulated&mode=development-build&buildEnv=local`
- **Local read-only**:
  - `test -e` on host paths, `find ~/.npm -user root`, `wc -l ~/.zprofile` (values suppressed), `man zsh`;
  - `brew list --formula` with auto-update and analytics disabled, `df -h /`;
  - a throwaway npm workspace in `$TMPDIR` using an offline, private cache.

---
*Generated: 2026-09-30 23:28 WIB*
*Last Updated: 2026-09-30 23:28 WIB*
