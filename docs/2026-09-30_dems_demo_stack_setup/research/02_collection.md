---
task_id: 2026-09-30_dems_demo_stack_setup
date: 2026-09-30
agent: data-collector
blueprint_row: 2
narrative_tier: 2
items_collected: 212  # 97 Tier-2 finding items + 115 npm registry snapshot rows (Appendix A)
retrieval_date_all_sources: 2026-09-30
last_updated: 2026-09-30 23:05 WIB
status: complete
---

# Data Collection Report: Stack Evidence (Blueprint Row 2)

## Task Overview

This file collects current technology evidence (as of 2026-09-30) for every area in the "Stack decision areas" table in `identification/01_translated.md` and the eight collection areas in the row-2 delegation. It is **collection only**. It contains no choices, rankings or recommendations. `data-analyst` (row 3) makes the decisions.

Hard user constraint D6 (`decisions/decisions.md`) says the stack must use ready-made frameworks and prebuilt component libraries. Because of that, Areas 2 and 4 weight ready-made kits, animated component registries and starter templates most heavily.

### Evidence conventions (Tier 2)

Each item gives four things:
- **Finding**: what was found.
- **Significance**: why it matters to a decision area. This is not a recommendation.
- **Method**: how it was collected.
- **Source**: a URL, or a local command and its output.

The retrieval date for every item is **2026-09-30**. Where a finding comes from a WebFetch summary rather than a raw document, it is labelled "(WebFetch summary)". Where the only source is secondary (blog, forum, search snippet), it is labelled "(secondary)".

Version numbers come from one of three places:
- (a) quoted `npm view` output, run locally against `https://registry.npmjs.org/` with a scratchpad cache;
- (b) files inside the official npm tarball, fetched with `npm pack` into the scratchpad and never installed;
- (c) official docs or release notes.

### Confidentiality statement

Every web query, fetched URL and registry call was a generic technology query. None contained design-book content, "DEMS", "evidence", "Polri" or any project detail. The full query log is in the "Query Log" section. The design book and `research/01_explore.md` were **not** opened by this agent.

---

## Local Environment Evidence

| # | Command | Output (quoted) | Significance |
|---|---|---|---|
| L1 | `node -v; npm -v; npm config get registry` | `v26.8.2` / `11.19.1` / `https://registry.npmjs.org/` | Baseline runtime that every engines range below is checked against |
| L2 | `which corepack; corepack --version` | `corepack not found` / `command not found: corepack` | Confirms locally that no corepack binary ships with the installed Node 26.8.2 (see 1.4) |
| L3 | `which -a node` | `/usr/local/bin/node` (single entry) | System Node location (nodejs.org installer layout, not a Homebrew keg). "System Node preserved" constraints refer to this path |
| L4 | `sw_vers` | `ProductVersion: 27.0.1`, `BuildVersion: 26A434` | Host OS |
| L5 | `grep golden_gate /opt/homebrew/Library/Homebrew/macos_version.rb` | `24:    golden_gate: "27",` | Homebrew's bottle tag for macOS 27 is `arm64_golden_gate`. Needed to read bottle availability in Area 7 |
| L6 | `brew --version; brew --prefix` | `Homebrew 6.0.22` / `/opt/homebrew` | Homebrew prefix for formula/cask paths |
| L7 | `node ts_strip_test.ts` (scratchpad file with an `interface` and type annotations) | `type-strip ok 42 true v26.8.2` | Node 26 runs `.ts` files directly (type stripping). This is an option next to `tsx` in Area 5 |
| L8 | `npm view expo ...` with the default cache | `npm error Your cache folder contains root-owned files ...` | The sandbox blocks writes to `~/.npm`. All registry queries used `npm_config_cache=<scratchpad>/npmcache`. No change was made to `~/.npm` |

---

## Area 1: Runtime Compatibility

### 1.1 Current Expo SDK and the next one

- **Finding:** The npm `expo` dist-tags are `"latest": "57.0.26"`, `"sdk-57": "57.0.26"`, `"sdk-56": "56.0.23"`, `"next": "58.0.0"` and `"canary": "58.0.0-canary-20260909-ea7a89a"`. `expo@57.0.26` was published `2026-09-29T10:57:08.644Z`.
  **Significance:** SDK 57 is the current stable SDK. SDK 58 exists only on the `next` tag.
  **Method:** `npm view expo version dist-tags --json`; `npm view expo "time[57.0.26]"`.
  **Source:** registry.npmjs.org (local command).
- **Finding:** "Expo SDK 57 was released on June 30, 2026". It moves React Native from 0.85 to 0.86, and React stays at 19.2 (WebFetch summary). It bundles "react-native-reanimated (4.3 to 4.5), react-native-worklets (0.8 to 0.10), react-native-gesture-handler (2.31 to 2.32)".
  **Significance:** Confirms the SDK-to-RN mapping and the animation-library jump inside SDK 57.
  **Method:** WebFetch.
  **Source:** https://expo.dev/changelog/sdk-57
- **Finding:** SDK 58 beta was published September 15, 2026 with React Native 0.88 (release candidate). The beta lasts "three to four weeks", and stable ships "shortly after" RN 0.88. Minimum Node for SDK 58: "Node.js 22.13 or newer on the 22 line, 24.3 or newer on the 24 line, or Node.js 26 and later". It adds AGP 9 compatibility (WebFetch summary). A secondary report says RN 0.88 stable is scheduled for October 12, 2026 (secondary).
  **Significance:** A newer SDK may reach stable during or soon after this task's window.
  **Method:** WebFetch, WebSearch.
  **Source:** https://expo.dev/changelog/sdk-58-beta ; https://dev.to/expo/expo-sdk-58-beta-opens-with-ios-27-support-and-a-faster-build-pipeline-5bb3 (secondary)

### 1.2 Versions pinned by Expo SDK 57 (what `npx expo install` resolves to)

- **Finding:** `bundledNativeModules.json` inside the `expo@57.0.26` tarball pins the versions below.
  **Significance:** This file is the source Expo uses to resolve compatible native-module versions. It is the authoritative SDK-57 pin set.
  **Method:** `npm pack expo@57.0.26` to the scratchpad, then `cat package/bundledNativeModules.json`.
  **Source:** local tarball of registry package `expo@57.0.26`.

| Package | SDK 57 pin (quoted) | npm `latest` on 2026-09-30 |
|---|---|---|
| react / react-dom | `19.2.3` / `19.2.3` | `19.3.0` / `19.3.0` |
| react-native | `0.86.3` | `0.87.1` |
| react-native-web | `~0.21.0` | n/q |
| react-native-reanimated | `4.5.1` | `4.7.0` |
| react-native-worklets | `0.10.1` | `0.13.0` |
| react-native-gesture-handler | `~2.32.0` | `3.3.0` (`legacy` tag `2.33.0`) |
| react-native-screens | `~4.26.0` | `4.28.0` |
| react-native-safe-area-context | `~5.7.0` | `5.10.1` |
| react-native-svg | `15.15.4` | `15.15.5` |
| @shopify/react-native-skia | `2.6.2` | `2.13.1` |
| lottie-react-native | `~7.3.8` | `7.5.0` |
| @shopify/flash-list | `2.0.2` | `2.3.2` |
| expo-router | `~57.0.24` | `57.0.24` |
| expo-blur / expo-linear-gradient / expo-haptics | `~57.0.3` / `~57.0.2` / `~57.0.3` | same |
| expo-video / expo-image | `~57.0.5` / `~57.0.5` | same |
| expo-mesh-gradient / expo-glass-effect | `~57.0.2` / `~57.0.4` | same |
| expo-dev-client / jest-expo | `~57.0.19` / `~57.0.5` | same |
| @expo/ui | `~57.0.21` | same |
| react-native-keyboard-controller | `1.21.9` | n/q |

n/q = not queried.

- **Finding:** The `expo-template-default@57.0.28` package.json (what `create-expo-app` uses by default) contains:
  - `"react": "19.2.3"`, `"react-native": "0.86.3"`, `"react-native-reanimated": "4.5.1"`, `"react-native-worklets": "0.10.1"`, `"expo-router": "~57.0.24"`, `"@expo/ui": "~57.0.21"`, `"expo-glass-effect": "~57.0.4"`;
  - dev dependency `"typescript": "~6.0.3"`;
  - in `app.json`: `"orientation": "portrait"` and `"experiments": { "typedRoutes": true, "reactCompiler": true }`.
  **Significance:** Shows the default scaffold's TypeScript line (6.0, not 7.0), its orientation default and React Compiler status.
  **Method:** `npm pack expo-template-default@57.0.28`, then read the files.
  **Source:** local tarball.

### 1.3 Node.js support (is Node 26.x supported? which LTS is current?)

- **Finding:** The Expo SDK version table lists `57.0.0 | 0.86 | 19.2.3 | 0.21.0 | 0.86-stable | 22.13.x` for SDK / React Native / React / React Native Web / RN TV / **Node.js** (WebFetch summary).
  **Significance:** Minimum Node for SDK 57 is 22.13.x. The table gives no upper bound.
  **Method:** WebFetch.
  **Source:** https://docs.expo.dev/versions/latest/
- **Finding:** `react-native@0.86.3` engines: `"node": "^20.19.4 || ^22.13.0 || ^24.3.0 || >= 25.0.0"`. `@react-native/metro-config@0.86.3` has the same range. `@expo/metro@56.0.2` (the metro Expo 57 depends on) pins `"metro": "0.84.5"`, and `metro@0.84.5` engines are `"node": "^20.19.4 || ^22.13.0 || ^24.3.0 || >= 25.0.0"`.
  **Significance:** The installed Node v26.8.2 satisfies `>= 25.0.0` in every one of these ranges.
  **Method:** `npm view react-native@0.86.3 engines`; `npm view @expo/metro@56.0.2 dependencies`; `npm view metro@0.84.5 engines`.
  **Source:** registry.npmjs.org.
- **Finding:** `react-native@0.87.1` and `metro@0.87.1` engines: `"^22.13.0 || ^24.3.0 || >= 26.0.0"`.
  **Significance:** The next RN line drops Node 20 and Node 25 and still includes 26.
  **Method:** `npm view`.
  **Source:** registry.npmjs.org.
- **Finding:** The Expo CLI entry point (`@expo/cli@57.0.27`, `build/bin/cli`, lines 87–95) defines `const NODE_MIN = [20, 19, 4]`. It prints "Node.js (...) is outdated and unsupported" only when the version is **below** this. There is no upper-bound check.
  **Significance:** Expo CLI 57 does not warn on Node 26.
  **Method:** `npm pack @expo/cli@57.0.27`, then grep for `NODE_MIN`.
  **Source:** local tarball.
- **Finding:** The React Native environment docs state "Node 22.11.0 or newer" (WebFetch summary).
  **Method:** WebFetch.
  **Source:** https://reactnative.dev/docs/set-up-your-environment?os=macos&platform=android
- **Finding:** The Node.js release schedule (`schedule.json`), quoted:
  - `v22 {"lts":"2024-10-29","maintenance":"2025-10-21","end":"2027-04-30","codename":"Jod"}`
  - `v24 {"start":"2025-05-06","lts":"2025-10-28","maintenance":"2026-10-20","end":"2028-04-30","codename":"Krypton"}`
  - `v25 {"start":"2025-10-15","maintenance":"2026-04-01","end":"2026-06-01"}`
  - `v26 {"start":"2026-05-05","lts":"2026-10-28","maintenance":"2027-10-20","end":"2029-04-30"}`
  - `v20 ... "end":"2026-04-30"`

  **Significance:**
  - On 2026-09-30 Node 24 (Krypton) is Active LTS until 2026-10-20.
  - Node 22 (Jod) is Maintenance LTS.
  - Node 26 is "Current" and becomes LTS on 2026-10-28, 28 days after today.
  - Node 25 reached end of life on 2026-06-01.
  - Node 20 reached end of life on 2026-04-30.

  **Method:** `curl https://raw.githubusercontent.com/nodejs/Release/main/schedule.json`.
  **Source:** https://github.com/nodejs/Release (schedule.json)
- **Finding:** From `https://nodejs.org/dist/index.json`, the latest release per line is:
  - `v26.10.0 2026-09-21` (not LTS);
  - `v24.21.0 2026-09-07 lts=Krypton npm=11.19.0`;
  - `v22.23.3 2026-09-23 lts=Jod`.

  The installed `v26.8.2` was released `2026-09-09` with npm `11.19.1`. Two newer 26.x releases exist: 26.9.0 (2026-09-16) and 26.10.0 (2026-09-21).
  **Method:** curl + node parse.
  **Source:** https://nodejs.org/dist/index.json
- **Finding:** Other engines ranges that bear on Node 26:
  - `vite@8.3.1`: `^20.19.0 || >=22.12.0`
  - `vitest@5.0.3`: `^22.12.0 || ^24.0.0 || >=26.0.0`
  - `shadcn@4.21.0`: `>=20.18.1`
  - `@tanstack/react-router@1.170.40`: `>=20.19`
  - `@hono/node-server@2.1.3`: `>=20`
  - `tsx@4.23.15`: `>=18.0.0`
  - `expo-doctor@1.20.4`: `^20.19.4 || ^22.13.0 || ^24.3.0 || >= 25.0.0`
  - `@react-native-community/cli@20.2.0`: `>=20.19.4`

  The Fastify LTS table lists `5.0.0 | 2024-09-17 | TBD | 20, 22, 24, 26`.
  **Method:** `npm view <pkg> engines`; curl of the Fastify LTS doc.
  **Source:** registry.npmjs.org; https://raw.githubusercontent.com/fastify/fastify/main/docs/Reference/LTS.md

### 1.4 Corepack status in Node 25+/26

- **Finding:** The Node.js TSC voted (March 19, 2025) to stop distributing Corepack on release lines 25 and later. Node 24 and earlier keep it as experimental. The userland package can be installed with `npm install -g corepack` (search summary citing the nodejs/node PRs).
  **Significance:** Corepack cannot be assumed on Node 26.
  **Method:** WebSearch.
  **Source:** https://github.com/nodejs/node/pull/61207 ; https://github.com/nodejs/corepack/issues/722 (secondary summaries)
- **Finding:** Local evidence L2: no `corepack` on PATH with Node v26.8.2. The npm package `corepack@0.36.0` exists with engines `^22.22.2 || ^24.15.0 || >=26.0.0`.
  **Method:** Local shell; `npm view corepack`.
  **Source:** local; registry.npmjs.org.
- **Gap:** A fetch of `https://nodejs.org/docs/latest-v26.x/api/corepack.html` returned HTTP 404, so no official Node-26 doc page on Corepack was captured.

### 1.5 JDK, Gradle, AGP and Kotlin for current React Native / Expo

- **Finding:** The React Native environment docs say "JDK 17 is recommended". They quote: "If you have already installed JDK on your system, we recommend JDK 17. You may encounter problems using higher JDK versions." The install command given is `brew install --cask zulu@17` (WebFetch summary).
  **Method:** WebFetch.
  **Source:** https://reactnative.dev/docs/set-up-your-environment?os=macos&platform=android
- **Finding:** The Expo docs (local development build, Android) say to "Install OpenJDK distribution called Azul Zulu using Homebrew" with `brew install --cask zulu@17` (WebFetch summary).
  **Method:** WebFetch.
  **Source:** https://docs.expo.dev/get-started/set-up-your-environment/?platform=android&device=simulated&mode=development-build&buildEnv=local ; https://docs.expo.dev/workflow/android-studio-emulator/
- **Finding:** The Expo SDK 57 bare template (`expo-template-bare-minimum@57.0.28`, used by `expo prebuild`) has `android/gradle/wrapper/gradle-wrapper.properties` set to `distributionUrl=https\://services.gradle.org/distributions/gradle-9.3.1-bin.zip`.
  **Significance:** Gradle 9.3.1 is the build tool that local `expo run:android` will use.
  **Method:** `npm pack expo-template-bare-minimum@57.0.28`, then read the files.
  **Source:** local tarball.
- **Finding:** The `react-native@0.86.3` catalog `gradle/libs.versions.toml` and the `@react-native/gradle-plugin@0.86.3` catalog both declare `agp = "8.12.0"` and `kotlin = "2.1.20"`.
  **Method:** `npm pack`, then read the toml files.
  **Source:** local tarballs.
- **Finding:** The Gradle compatibility matrix (page for Gradle 9.8.0) says a JVM between 17 and 27 is needed to run Gradle 9.x. Java 17 is supported from 7.3, Java 21 from 8.5, Java 25 from 9.1.0, Java 26 from 9.4.0 and Java 27 from 9.8.0 (WebFetch summary).
  **Significance:** Gradle 9.3.1 (the SDK 57 wrapper) is below the 9.4.0 threshold for Java 26 and the 9.8.0 threshold for Java 27. Homebrew's unversioned `openjdk` formula is `27` (Area 7).
  **Method:** WebFetch.
  **Source:** https://docs.gradle.org/current/userguide/compatibility.html
- **Finding:** The Android Gradle Plugin release page (AGP 9.4.0, September 2026) shows a "JDK | 17 | 17" row with "AGP 9.x requires JDK 17", minimum Gradle 9.6.0, and maximum API level 37 (WebFetch summary).
  **Method:** WebFetch.
  **Source:** https://developer.android.com/build/releases/gradle-plugin

### 1.6 Android compileSdk / targetSdk / minSdk for Expo SDK 57

- **Finding:** The Expo platform table lists `57.0.0 | Android 7+ | Compile SDK 36 | Target SDK 36` (WebFetch summary).
  **Method:** WebFetch.
  **Source:** https://docs.expo.dev/versions/latest/
- **Finding:** The `react-native@0.86.3` `gradle/libs.versions.toml` contains `minSdk = "24"`, `targetSdk = "36"`, `compileSdk = "36"`, `buildTools = "36.0.0"` and `ndkVersion = "27.1.12297006"`.
  `expo-modules-autolinking@57.0.13`, file `ExpoRootProjectPlugin.kt` lines 52–59, reads these catalog values. Its fallbacks are `"buildTools", "35.0.0"`, `"minSdk", "24"`, `"compileSdk", "35"`, `"targetSdk", "35"`, `"ndkVersion", "27.1.12297006"` and `"kotlin", "2.0.21"`.
  **Significance:** Gives the exact SDK platform, build-tools and NDK IDs a local build will request.
  **Method:** `npm pack`, then read the files.
  **Source:** local tarballs.
- **Finding:** The React Native environment docs still say to install "Android SDK Platform 35" plus "Android SDK Build-Tools 36.0.0" (WebFetch summary). The Expo docs say "Android SDK Platform 36" (WebFetch summary).
  **Significance:** The RN docs page (35) and the RN 0.86.3 catalog (36) disagree. Recorded as found.
  **Source:** https://reactnative.dev/docs/set-up-your-environment?os=macos&platform=android ; https://docs.expo.dev/workflow/android-studio-emulator/

### 1.7 New Architecture status

- **Finding:** The RN 0.82 blog (October 8, 2025) says: "we're confident in making it the **only** architecture for this and future versions of React Native ... if you try to set `newArchEnabled=false` on Android ... these will be ignored".
  **Method:** WebFetch.
  **Source:** https://reactnative.dev/blog/2025/10/08/react-native-0.82
- **Finding:** The Expo docs say: "SDK 55 and later run entirely on the New Architecture. The New Architecture is always enabled and cannot be disabled." The SDK 57 bare template `gradle.properties` contains `newArchEnabled=true`, `hermesEnabled=true` and `edgeToEdgeEnabled=true`.
  **Significance:** Every mobile library candidate must support the New Architecture.
  **Method:** WebFetch; tarball read.
  **Source:** https://docs.expo.dev/guides/new-architecture/ ; local tarball.
- **Finding:** The RN 0.86 blog (June 11, 2026) describes it as the "second React Native release with no user-facing breaking changes", with edge-to-edge fixes for Android 15+ (search summary).
  **Source:** https://reactnative.dev/blog/2026/06/11/react-native-0.86

### 1.8 TypeScript release line

- **Finding:** npm `typescript` `latest` is `7.0.2` (published 2026-07-08); the `6.x` line ends at `6.0.3`. TypeScript 7.0 is the Go-native compiler. A compatibility package `@typescript/typescript6` provides `tsc6` side by side (search summary).
  The Expo SDK 57 default template pins `"typescript": "~6.0.3"`, and the `satnaing/shadcn-admin` template pins `"typescript": "~6.0.3"`.
  **Significance:** The templates are on TS 6 while the registry `latest` is TS 7.
  **Method:** `npm view typescript`; `npm view typescript@6 version`; WebSearch.
  **Source:** registry.npmjs.org; https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ (search summary)

---

## Area 2: Mobile Ready-Made UI Kits

### 2.0 Comparison snapshot (facts only)

GitHub stars and last push date come from the GitHub REST API, fetched 2026-09-30 before the unauthenticated rate limit was reached.

| Kit | npm version (publish date) | Licence | Styling engine | Animation built in | New Arch / Reanimated 4 evidence | Web sibling sharing design language | GitHub (stars; last push) |
|---|---|---|---|---|---|---|---|
| **react-native-reusables** (shadcn/ui for RN) | CLI `@react-native-reusables/cli@0.7.1` (2026-03-14); primitives `@rn-primitives/*@1.5.x` | MIT | NativeWind v4 (Tailwind 3) **or** Uniwind (Tailwind 4) | Reanimated `entering`/`exiting` via `NativeOnlyAnimatedView` | Official templates pin RN 0.85.3 + Reanimated 4.3.1 + worklets 0.8.3 (SDK 56) | shadcn/ui ("follows the shadcn/ui new-york style") | 8,674; 2026-09-27 |
| **HeroUI Native** | `heroui-native@1.0.10` (2026-09-21) | Apache-2.0 | Uniwind (Tailwind v4) | "Every component comes with smooth animations" | peer `react-native-reanimated ^4.1.1`, `react-native-worklets >=0.5.1`; example app on SDK 57 / RN 0.86.3 / Reanimated 4.5.1 | HeroUI v3 (web), React 19 + Tailwind v4 | 3,664; 2026-09-25 |
| **Tamagui** | `tamagui@2.7.7` (2026-08-15); beta `3.0.0-beta.1479.1` | MIT on `@tamagui/core`; no licence field on `tamagui` in npm metadata; repo MIT | Own style system + optimising compiler | Pluggable drivers: CSS, Reanimated, Motion, React Native | `@tamagui/animations-reanimated@2.7.7` peer `react-native-reanimated >=3.0.0` | Same library renders on web and native | 14,208; 2026-09-30 |
| **gluestack-ui v5** | `@gluestack-ui/core@5.0.15` (2026-06-25); CLI `gluestack-ui@5.0.3` | MIT (README) | NativeWind v5 (Tailwind v4) per README | not stated in fetched docs | peer ranges broad (`react-native >=0.64.0`) | Universal: React, Next.js, React Native | 5,317; 2026-09-02 |
| **React Native Paper** | `react-native-paper@5.15.3` (2026-05-26); `6.0.0-alpha.0` on `alpha` tag | MIT | Own theme (Material Design 3) | not documented on the getting-started page | peers `react`, `react-native`, `react-native-safe-area-context` (`*`) | Web via react-native-web ("Using on the Web" guide) | 14,466; 2026-09-29 |
| **UI Kitten** | `@ui-kitten/components@6.1.3` (2026-09-27) | MIT | Eva Design System (`@eva-design/eva@2.2.0`) | not collected | peer `react-native >=0.72.0` | not collected | 10,664; 2026-09-30 |
| **react-native-ui-lib** (Wix) | `9.1.3` (2026-09-06) | MIT | Own | depends on Reanimated / gesture-handler | peer `react-native-reanimated >=3.19.4`, `react-native >=0.77.3` | none found | 7,157; 2026-09-06 |
| **Expo UI** (`@expo/ui`) | `57.0.21` (in the SDK 57 default template) | MIT | Native Jetpack Compose (Android) / SwiftUI | Native platform components | SDK 57 first-party | none | (expo/expo monorepo) |

Styling engines behind the Tailwind-based kits:

| Engine | Version | Tailwind | Licence / paid tier |
|---|---|---|---|
| NativeWind | `4.2.7` latest; `5.0.0-rc.0` on `rc`/`preview` tags (published 2026-09-13) | v4.2.7 uses `react-native-css-interop@0.2.7` with peer `tailwindcss: "~3"`. v5 RC has peer `tailwindcss: ">4.1.11"` and `react-native-css: "3.1.0-rc.0"` | MIT |
| Uniwind | `1.12.0` (2026-09-04) | peer `tailwindcss >=4`, `react-native >=0.81.0` | MIT free tier. Pro is **paid**: "$99/seat/year" for seats 1–3. Pro adds a "C++ engine with ShadowTree updates", "Native theme transitions" and "Reanimated 4 animations" via className |
| Unistyles | `react-native-unistyles@3.3.0` | not Tailwind; peer `react-native-nitro-modules` | MIT (npm) |

### 2.1 react-native-reusables

- **Finding:**
  - README: "Bringing shadcn/ui to React Native. Beautifully crafted components with Nativewind ... open source". Licensed "under the MIT license". Part of the Vercel OSS Program.
  - Changelog, December 2025: "React Native Reusables now has full support for Uniwind", with a new template via `init -t minimal-uniwind`.
  - Changelog, August 2025: "You can now use `npx shadcn@latest` with our registries" and "follows the shadcn/ui new-york style".
  - Changelog, September 2026: components also listed on catalogs.dev. "The CLI works as it always has."

  **Significance:** It is a shadcn-style copy-in kit for RN that uses the same registry mechanism as the web shadcn CLI.
  **Method:** curl of the raw README and docs MDX from GitHub.
  **Source:** https://github.com/founded-labs/react-native-reusables (README.md; apps/docs/content/docs/changelog.mdx; cli.mdx)
- **Finding:**
  - The Uniwind registry holds 32 UI components: accordion, alert-dialog, alert, aspect-ratio, avatar, badge, button, card, checkbox, collapsible, context-menu, dialog, dropdown-menu, hover-card, icon, input, label, menubar, native-only-animated-view, popover, progress, radio-group, select, separator, skeleton, switch, tabs, text, textarea, toggle-group, toggle, tooltip.
  - `native-only-animated-view.tsx` wraps `Animated.View` from `react-native-reanimated` with `entering`/`exiting` props on native.
  - Templates: `minimal`, `minimal-uniwind`, `clerk-auth`.
  - The CLI runs as `npx @react-native-reusables/cli@latest` with `init`, `add`, `--styling-library nativewind|uniwind`.

  **Method:** GitHub tree API; raw file read.
  **Source:** https://github.com/founded-labs/react-native-reusables/tree/main/packages/registry/src/uniwind/components/ui
- **Finding:** The template package.json files (`react-native-reusables-templates`):
  - `minimal`: `"expo":"~56.0.13"`, `"react-native":"0.85.3"`, `"react-native-reanimated":"4.3.1"`, `"react-native-worklets":"0.8.3"`, `"nativewind":"^4.2.6"`, `"tailwindcss":"^3.4.14"`.
  - `minimal-uniwind`: the same Expo/RN/Reanimated pins plus `"uniwind":"^1.9.0"`, `"tailwindcss":"^4.2.1"`, `"tw-animate-css":"^1.4.0"`.

  **Significance:** The official templates are on SDK 56, one SDK behind current.
  **Method:** curl of raw package.json files.
  **Source:** https://github.com/founded-labs/react-native-reusables-templates

### 2.2 HeroUI Native

- **Finding:**
  - Docs: built "on Tailwind v4 via Uniwind". "Every component comes with smooth animations, polished details, and built-in accessibility". "completely free and open source under the Apache License 2.0".
  - Quick start peers: `react-native-reanimated ^4.1.1`, `react-native-gesture-handler ^2.28.0`, `react-native-worklets ^0.5.1`, `react-native-safe-area-context ^5.6.0`, `react-native-svg ^15.12.1`, `tailwind-variants ^3.2.2`, `tailwind-merge ^3.4.0`. Optional: `react-native-screens ^4.16.0` and `@gorhom/bottom-sheet ^5.2.9`.
  - `global.css` needs `@import 'tailwindcss'; @import 'uniwind'; @import 'heroui-native/styles';`.
  - "HeroUI Native is currently not recommended for web use".

  (WebFetch summaries.)
  **Method:** WebFetch.
  **Source:** https://heroui.com/docs/native/getting-started ; https://heroui.com/docs/native/getting-started/quick-start
- **Finding:** The npm `heroui-native@1.0.10` peers also list `expo-blur >=14.0.0` and `@gorhom/bottom-sheet ^5.2.9`.
  The repo `src/components` holds 43 entries: accordion, alert, avatar, bottom-sheet, button, card, checkbox, chip, close-button, control-field, description, dialog, field-error, glass-view, input-group, input-otp, input, label, link-button, list-group, menu, popover, pressable-feedback, radio-group, radio, scroll-shadow, search-field, select, separator, skeleton-group, skeleton, slider, spinner, sub-menu, surface, switch, tabs, tag-group, text-area, text-field, text, theme-background, toast.
  **Method:** `npm view heroui-native peerDependencies`; GitHub contents API.
  **Source:** registry.npmjs.org; https://github.com/heroui-inc/heroui-native
- **Finding:** The official example app `heroui-inc/heroui-native-example` package.json has `"expo":"~57.0.18"`, `"react-native":"0.86.3"`, `"react-native-reanimated":"4.5.1"`, `"react-native-worklets":"0.10.1"`, `"react-native-gesture-handler":"~2.32.0"`, `"heroui-native":"^1.0.10"`, `"uniwind":"1.12.0"`, `"tailwindcss":"^4.3.2"` and `"@gorhom/bottom-sheet":"^5.2.14"`.
  **Significance:** A first-party starter already aligned with the SDK 57 pins (1.2).
  **Method:** curl of the raw package.json.
  **Source:** https://github.com/heroui-inc/heroui-native-example
- **Finding:** HeroUI Pro (paid) has perpetual-licence plans: "Web Hero" (Pro React components), "Mobile Hero" (Pro React Native components) and "Super Hero" (React and React Native). All include premium templates and AI credits. The pricing page as fetched showed **no price amounts**. A search snippet quoted "Solo $249 / Startup $399 / Organization $799", which is **unverified** on the official page (secondary).
  **Method:** WebFetch; WebSearch.
  **Source:** https://heroui.pro/pricing ; https://heroui.pro/

### 2.3 Tamagui

- **Finding:**
  - Tamagui 2 was announced December 29, 2025. It has "Four options—CSS, Reanimated, Motion, and React Native—selectable per platform" for animation drivers (WebFetch summary).
  - Intro page: "All of its features work the same on both React Native and React web". It consists of `@tamagui/core`, the `@tamagui/static` compiler and a UI kit.
  - npm: `tamagui@2.7.7`; `@tamagui/animations-reanimated@2.7.7` (peer `react-native-reanimated >=3.0.0`), `@tamagui/animations-motion@2.7.7`, `@tamagui/animations-css@2.7.7`; beta tag `3.0.0-beta.1479.1`.

  **Method:** WebFetch; `npm view`.
  **Source:** https://tamagui.dev/blog/version-two ; https://tamagui.dev/docs/intro/introduction ; registry.npmjs.org
- **Finding:** Paid products: "Bento" (copy-paste UI) and "Takeout" (starter kit). Tamagui Pro includes "two starter kits", "50+ UI primitives", Supabase auth, Zero sync, OTA updates and "Private GitHub" access. The fetched page showed no price amount.
  **Method:** WebFetch.
  **Source:** https://tamagui.dev/takeout

### 2.4 gluestack-ui

- **Finding:**
  - README: "gluestack v5 is here! ... with support for NativeWind v5 (Tailwind v4)". It is "a library of copy-pasteable components & patterns crafted with Tailwind CSS (NativeWind)". Install with `npx gluestack-ui init`. "Licensed under the MIT License, Copyright © 2026 GeekyAnts."
  - Docs: "Copy-paste components rather than package dependency"; "One codebase, same behavior across React, Next.js, and React Native" (WebFetch summary).

  **Significance:** v5 depends on NativeWind v5, which npm still tags as `rc` (`5.0.0-rc.0`), not `latest`.
  **Method:** curl README; WebFetch.
  **Source:** https://github.com/gluestack/gluestack-ui ; https://gluestack.io/ui/docs/home/overview/introduction
- **Finding:** The GitHub API returned `license: null` for `gluestack/gluestack-ui`, and a root listing showed no LICENSE file (only README.md), although the README links to one. `@gluestack-ui/themed@1.1.73` (legacy v1) is marked ISC and was last published 2025-04-08.
  **Method:** GitHub API; `npm view`.
  **Source:** https://api.github.com/repos/gluestack/gluestack-ui

### 2.5 React Native Paper, UI Kitten and others

- **Finding:**
  - React Native Paper follows "Material Design 3". Required: `react-native-safe-area-context`. Expo projects do not need to install vector icons separately. There is a "Using on the Web" guide. The getting-started page makes "no mention of Reanimated or React Native's Animated API" (WebFetch summary).
  - npm dependencies: `color`, `use-latest-callback`, `@callstack/react-theme-provider` (no Reanimated).

  **Method:** WebFetch; `npm view react-native-paper dependencies`.
  **Source:** https://oss.callstack.com/react-native-paper/docs/guides/getting-started
- **Finding:** UI Kitten is described as "React Native UI components based on Eva Design System". Dependencies: `fecha`, `@ui-kitten/processor`, `@ui-kitten/mapping-base`, `hoist-non-react-statics`. Peer `react-native-svg >=13.0.0`.
  **Method:** `npm view`.
  **Source:** registry.npmjs.org
- **Finding:** Expo UI "allows you to build fully native interfaces with Jetpack Compose and SwiftUI". It has 60+ Jetpack Compose components (for example ModalBottomSheet, NavigationBar, Carousel, SegmentedButton, Snackbar, LoadingIndicator). The fetched page did not state a stability level (WebFetch summary).
  **Source:** https://docs.expo.dev/versions/latest/sdk/ui/

---

## Area 3: Mobile Animation and Visual Libraries

| Library | SDK 57 pin | npm latest (date) | Licence | Key peer ranges (quoted) |
|---|---|---|---|---|
| react-native-reanimated | `4.5.1` | `4.7.0` (2026-09-18) | MIT | 4.5.1: `react-native: "0.83 - 0.86"`, `react-native-worklets: "0.10.x"`. 4.7.0: `react-native: "0.86 - 0.88"`, `react-native-worklets: "0.13.x"` |
| react-native-worklets | `0.10.1` | `0.13.0` (2026-09-18) | MIT | 0.10.1: `react-native: "0.83 - 0.86"` |
| react-native-gesture-handler | `~2.32.0` | `3.3.0` (2026-09-11); `legacy` tag `2.33.0` | MIT | `react`, `react-native` `*` |
| moti | not pinned | `0.30.0` (2025-01-29) | MIT | peer `react-native-reanimated: "*"`; dependency `framer-motion: "^6.5.1"`. GitHub last push 2025-03-11 |
| @shopify/react-native-skia | `2.6.2` | `2.13.1` (2026-09-29) | MIT | 2.13.1: `react-native >=0.78`, `react-native-reanimated >=4.0.0`, `react-native-worklets >=0.7.0` |
| lottie-react-native | `~7.3.8` | `7.5.0` (2026-08-22) | Apache-2.0 | 7.5.0: `react >=19.2`, `react-native >=0.84` |
| expo-blur / expo-linear-gradient / expo-haptics / expo-mesh-gradient / expo-glass-effect / expo-image / expo-video | `~57.0.x` | same as pin | MIT | first-party SDK 57 |
| react-native-svg | `15.15.4` | `15.15.5` | MIT | `*` |
| @gorhom/bottom-sheet | not pinned | `5.2.14` (2026-05-09) | MIT | `react-native-reanimated: ">=3.16.0 \|\| >=4.0.0-"`, `react-native-gesture-handler: ">=2.16.1"` |
| sonner-native | not pinned | `0.27.0` (2026-08-15) | MIT | `react-native-reanimated: "^4.1.1"`, `react-native-worklets: ">=0.6.1"`, `react-native-gesture-handler: ">=2.28.0"`, `react-native-screens: "^4.16.0"`, `react-native-svg: "^15.12.1"` |
| burnt (native toasts) | not pinned | `0.13.0` (2025-03-10) | MIT | peer `expo: "*"` |
| victory-native (Skia charts) | not pinned | `42.0.1` (2026-08-31) | MIT | `@shopify/react-native-skia: ">=2.6.0 <3.0.0"`, `react-native-reanimated: ">=3.19.1"` |
| react-native-gifted-charts | not pinned | `1.4.78` (2026-08-10) | MIT | not collected |
| react-native-screen-transitions | not pinned | `4.0.0` (2026-08-27) | MIT | `react-native-reanimated >=4.0.0`, `react-native-worklets >=0.8.0`, `@react-navigation/native >=7.3.0`, `react-native-teleport >=1.2.0` |
| react-native-ease | not pinned | `0.8.1` (2026-09-28) | MIT | peer `uniwind >=1`, `nativewind >=4`. Description: "Lightweight declarative animations powered by platform APIs" |
| rive-react-native | not pinned | `9.8.5` | MIT | not collected |

Method for the table: `npm view <pkg> name version license engines peerDependencies dist-tags` and `npm view <pkg>@<ver> peerDependencies`. Source: registry.npmjs.org.

- **Finding:**
  - Reanimated compatibility table: "Reanimated 4 works only with the React Native New Architecture".
  - Rows: 4.4.x–4.5.x support RN 0.83–0.85 and 0.86–0.87; 4.6.x supports 0.83–0.87; 4.7.x–4.8.x support 0.86–0.88.
  - Worklets pairing: 4.5.x → 0.10–0.11.x; 4.7.x → 0.13.x (WebFetch summary).

  **Significance:** The docs table (4.5.x on RN 0.86–0.87) and the npm peer range of 4.5.1 (`"0.83 - 0.86"`) differ in their upper bound. Both are recorded as found.
  **Source:** https://docs.swmansion.com/react-native-reanimated/docs/guides/compatibility/
- **Finding:**
  - Reanimated layout animations: predefined families Fade, Bounce, Flip, LightSpeed, Pinwheel, Roll, Rotate, Slide, Stretch, Zoom. Example `<Animated.View entering={FadeIn} exiting={FadeOut} />`. "Entering/exiting animations are fully supported on Android."
  - Reanimated 4 CSS animations: `animationName` keyframes plus `animationDuration` on `Animated.View` style.

  (WebFetch summaries.)
  **Source:** https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/entering-exiting-animations/ ; https://docs.swmansion.com/react-native-reanimated/docs/css-animations/animation-name/
- **Finding:** The `babel-preset-expo@57.0.13` README has a `worklets` option that "defaults to `true`". Setting `worklets: false` disables "adding the `react-native-worklets/plugin` when `react-native-worklets` is installed".
  **Significance:** No manual Babel plugin setup is needed for Reanimated 4 in an Expo 57 project.
  **Method:** `npm pack babel-preset-expo@57.0.13`, then grep the README.
  **Source:** local tarball.
- **Finding:** Shared element transitions came back in Reanimated 4.2.0 (December 5, 2025) **behind a feature flag** (`ENABLE_SHARED_ELEMENT_TRANSITIONS`) and are "still experimental" (search summary).
  **Source:** https://blog.swmansion.com/introducing-reanimated-4-2-0-71eea21ca861 ; https://github.com/software-mansion/react-native-reanimated/pull/7466 (secondary summaries)
- **Finding:** The Expo Router zoom transition "is an alpha API available on iOS only in Expo SDK 55 and later" (search summary of the Expo docs page).
  `expo-router@57.0.24` dependencies include `react-native-screens ^4.26.0`, `vaul`, `@radix-ui/react-tabs`, `expo-glass-effect` and `standard-navigation ^0.0.5`. The dependency list contains no `@react-navigation/*` package.
  **Significance:** Native Android screen transitions come through `react-native-screens`. There is no ready-made shared-element or zoom transition on Android in Expo Router 57.
  **Method:** WebSearch; `npm view expo-router@57.0.24 dependencies`.
  **Source:** https://docs.expo.dev/router/advanced/zoom-transition/ ; registry.npmjs.org
- **Finding:** Gesture Handler 3.0.0 is "rebuilt for the New Architecture". It has a hook-based API, a new `Touchable` component, "drops support for the legacy architecture", and renamed callbacks (`onStart` → `onActivate`, `onEnd` → `onDeactivate`) (search summary). Expo SDK 57 still pins the 2.32 line.
  **Source:** https://github.com/software-mansion/react-native-gesture-handler/releases/tag/v3.0.0 ; https://swmansion.com/blog/introducing-gesture-handler-3-0-hook-based-api-deeper-reanimated-integration-more-9185b0c8e305/
- **Finding:** Skia docs: "react-native@>=0.79 and react@>=19 are required". Reanimated integration needs "react-native-reanimated@>=4.0.0 (with react-native-worklets@>=0.7.0)". Size increase: Android 4 MB. Android NDK is required. There is an Expo template `-e with-skia` (WebFetch summary).
  **Source:** https://shopify.github.io/react-native-skia/docs/getting-started/installation/
- **Finding:**
  - expo-video supports "Android, iOS, tvOS, Web, Included in Expo Go".
  - Android player: Media3/ExoPlayer, supporting HLS, DASH, SmoothStreaming and progressive MP4.
  - API: `useVideoPlayer` plus `<VideoView player={player} />` (WebFetch summary).

  **Significance:** Relevant to the "video preview" stack decision area.
  **Source:** https://docs.expo.dev/versions/latest/sdk/video/
- **Finding:**
  - expo-blur on Android: "The blurring feature is stable on Android". It requires wrapping content in `BlurTargetView` and passing it through `blurTarget`.
  - `blurMethod` options: `'none'`, `'dimezisBlurView'`, `'dimezisBlurViewSdk31Plus'`.
  - "The blur can be achieved efficiently only by using the RenderNode Android API, which was introduced in Android SDK 31" (WebFetch summary).

  **Source:** https://docs.expo.dev/versions/latest/sdk/blur-view/

---

## Area 4: Web Ready-Made Kits and Animation

### 4.1 Build tooling and core

- **Finding:**
  - Vite docs: "Vite requires Node.js version 20.19+, 22.12+".
  - Templates include `react-ts` and `react-compiler-ts`. Scaffold with `npm create vite@latest <name> -- --template react-ts`.
  - The build "bundles your code with Rolldown". The fetched page makes no mention of telemetry.
  - npm: `vite@8.3.1` (2026-09-24), `create-vite@9.2.1`, `@vitejs/plugin-react@6.1.1` (peer `vite: "^8.0.0"`), `@vitejs/plugin-react-swc@4.3.3`.

  **Method:** WebFetch; `npm view`.
  **Source:** https://vite.dev/guide/ ; registry.npmjs.org
- **Finding:** Tailwind with Vite: `npm install tailwindcss @tailwindcss/vite`, the `tailwindcss()` plugin in `vite.config`, and `@import "tailwindcss";`. npm: `tailwindcss@4.3.3` (2026-07-16), `@tailwindcss/vite@4.3.3`, `v3-lts` tag `3.4.19`.
  **Source:** https://tailwindcss.com/docs/installation/using-vite ; registry.npmjs.org
- **Finding:** React for web: npm `react@19.3.0` / `react-dom@19.3.0` (published 2026-09-09). Expo SDK 57 pins `19.2.3` (1.2).
  **Significance:** Relevant to the React-alignment rule row 3 must set.
  **Source:** registry.npmjs.org

### 4.2 shadcn/ui (current CLI, Tailwind v4)

- **Finding:**
  - `shadcn@4.21.0` (2026-09-04), engines `>=20.18.1`, MIT.
  - `init` options in the CLI source (`dist/index.js`): `-t, --template <template>` "(next, start, vite, react-router, laravel, astro)"; `-b, --base <base>` "the component library to use. (base, radix, aria)"; `--monorepo` "scaffold a monorepo project."; `-p, --preset [name]`.

  **Significance:** The CLI can scaffold a Vite project and choose the primitive layer (Radix UI, Base UI or React Aria).
  **Method:** `npm pack shadcn@4.21.0`, then grep the dist.
  **Source:** local tarball.
- **Finding:** A grep of `shadcn@4.21.0/dist` for "telemetry" matched only `GH_TELEMETRY`. That match is inside a function that **deletes** GitHub-CLI environment variables before it runs `gh`. No shadcn telemetry endpoint or opt-out variable was found.
  **Method:** grep of the tarball.
  **Source:** local tarball (`dist/chunk-B2MD6U5O.js`).
- **Finding:**
  - shadcn Tailwind v4 page: "Tailwind v4 and React 19. Ready for you to try out."
  - "We've deprecated `tailwindcss-animate` in favor of `tw-animate-css`."
  - "New projects will use `new-york`."
  - "HSL colors are now converted to OKLCH."
  - Vite install: `pnpm create vite@latest`; `pnpm add tailwindcss @tailwindcss/vite`; `pnpm add -D @types/node`; `pnpm dlx shadcn@latest init`; `pnpm dlx shadcn@latest add button`.

  (WebFetch summaries.)
  **Source:** https://ui.shadcn.com/docs/tailwind-v4 ; https://ui.shadcn.com/docs/installation/vite
- **Finding:** Recent shadcn changelog entries:
  - September 2026: "Every shadcn component now imports `cn` from the `cn` package".
  - August 2026: Private GitHub Registries.
  - July 2026: Toast; React Aria support.

  (WebFetch summary.)
  **Source:** https://ui.shadcn.com/docs/changelog
- **Finding:** Chart: "We use Recharts under the hood" and "The `chart` component now uses Recharts v3". The registry item `new-york-v4/chart.json` has deps `["cn","recharts@3.8.0","lucide-react"]`. The registry item `new-york-v4/sonner.json` has deps `["sonner","next-themes"]`. The docs URL `/docs/components/sonner` served Toast documentation (`pnpm dlx shadcn@latest add toast`) with no Sonner mention.
  **Method:** WebFetch; curl of the registry JSON.
  **Source:** https://ui.shadcn.com/docs/components/chart ; https://ui.shadcn.com/r/styles/new-york-v4/chart.json ; https://ui.shadcn.com/r/styles/new-york-v4/sonner.json

### 4.3 Animated component registries compatible with shadcn

The official shadcn registry index (`https://ui.shadcn.com/r/registries.json`) has **408 registered namespaces**, including `@aceternity`, `@animate-ui`, `@magicui`, `@motion-primitives`, `@react-bits`, `@coss`, `@cult-ui`, `@kokonutui`, `@smoothui`, `@skiper-ui`, `@eldoraui`, `@lucide-animated`, `@kibo-ui`, `@reui` and `@tailwind-admin`. These namespaces can be installed with `npx shadcn@latest add @<namespace>/<item>`.
Method: curl plus JSON parse. Source: https://ui.shadcn.com/r/registries.json

| Registry | Registry index health (shadcn index) | Items in its `registry.json` (by type) | Top npm dependencies across items | Licence (evidence) | Paid tier | GitHub |
|---|---|---|---|---|---|---|
| **Magic UI** (`@magicui`) | healthy | 250 items; 78 `registry:ui` | e.g. `blur-fade` and `number-ticker` depend on `motion` | MIT (GitHub API `magicuidesign/magicui`) | **Magic UI Pro**: "$199" "one-time payment", "50+ sections", "9+ templates", "Re-selling of code is NOT allowed", account required | 22,432 stars; push 2026-09-20 |
| **Aceternity UI** (`@aceternity`) | **degraded** | 293 items: 112 `registry:ui`, 181 `registry:block` | `motion` (178), `@tabler/icons-react` (70) | Licence page covers purchased items: "create unlimited end products for yourself or your clients"; "cannot ... distribute the Item ... on any marketplace". The free-component licence is **not stated** on that page | **Pro**: Annual $169, Lifetime $199, Team $1,590 (as shown on the pricing page) | no public repo checked |
| **Animate UI** (`@animate-ui`) | healthy | 580 items: 573 `registry:ui` | `motion` (366), `radix-ui` (18), `@base-ui-components/react` (17), `@headlessui/react` (6) | **MIT + Commons Clause**: "so long as you do not sell or redistribute the components themselves in their original form" | none found | 4,345 stars; push 2025-12-31 |
| **Motion Primitives** (`@motion-primitives`) | healthy | 33 `registry:ui` | `motion` (33) | MIT (GitHub API) | none checked | 6,428 stars; push 2026-09-28 |
| **React Bits** (`@react-bits`) | healthy | 852 `registry:component` (variants) | `ogl` (208), `motion` (160), `gsap` (142), `three` (96) | **MIT + Commons Clause**: "so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version" | none found | 48,327 stars; push 2026-09-30 |
| **Kokonut UI** (`@kokonutui`) | healthy | 51 items | `motion` (36), `lucide-react` (22) | not checked | not checked | not checked |
| **coss ui** (formerly Origin UI) (`@coss`) | healthy | 579 items: 56 `registry:ui`, 510 `registry:block` | `lucide-react` (112), `@base-ui/react` (49) | Repo `cosscom/coss` reports AGPL-3.0 (GitHub API). A search summary says "apps/origin/ and apps/ui/ directories are licensed under MIT" (secondary, not verified at file level: GitHub rate limit) | none found | 10,635 stars; push 2026-09-30 |
| **Cult UI** (`@cult-ui`) | **unavailable** | not fetched | "tastefully animated with Framer Motion" (index description) | MIT (GitHub API) | not checked | 6,225 stars |

- **Finding:** Magic UI installs with the shadcn CLI, for example `pnpm dlx shadcn@latest add @magicui/globe` (WebFetch summary). The shadcn index describes it as "150+ free and open-source animated components and effects built with React, Typescript, Tailwind CSS, and M[otion]".
  **Source:** https://magicui.design/docs/installation ; https://pro.magicui.design/
- **Finding:** The Aceternity UI registry index description: "built with Tailwind CSS and Motion for React". The docs cover Tailwind v4 CSS-first setup (`@import "tailwindcss"`, `@theme inline`) (WebFetch summary).
  **Source:** https://ui.aceternity.com/pricing ; https://ui.aceternity.com/licence ; https://ui.aceternity.com/docs/install-tailwindcss

### 4.4 Other web UI kits

- **Finding:**
  - HeroUI v3 (web): "Built for React 19 and Tailwind v4" on "React Aria Components". "Completely free and open source under the Apache License 2.0".
  - Animations use CSS transitions driven by data attributes (`[data-entering]`, `[data-exiting]`). Motion is "optional, not required". It respects `prefers-reduced-motion`.
  - v3 removed the Framer Motion dependency (search summary).
  - npm `@heroui/react@3.2.6` peers: `react >=19.0.0`, `tailwindcss >=4.0.0`, `react-aria-components ^1.21.1`.

  **Significance:** HeroUI web and HeroUI Native share one vendor design system (2.2).
  **Source:** https://heroui.com/docs/react/getting-started ; https://heroui.com/docs/react/getting-started/animation ; registry.npmjs.org
- **Finding:**
  - Mantine is at v9.6.3. It offers `vite-template` and `vite-min-template`. Styling uses `postcss-preset-mantine` and CSS modules, with "No native Tailwind integration". It has a Transition component.
  - "@mantine/charts: Recharts based charts library".
  - "All `@mantine/*` packages are distributed under MIT license."
  - npm `@mantine/core@9.6.3` peer `react ^19.2.0`.

  **Source:** https://mantine.dev/getting-started/ ; registry.npmjs.org

### 4.5 Motion (formerly framer-motion)

- **Finding:**
  - Motion install: `npm install motion`, import from `"motion/react"`. "Motion is only compatible with React versions 18.2 and higher."
  - npm `motion@13.4.6` and `framer-motion@13.4.6` were published within one minute of each other on 2026-09-29. Both are MIT.
  - Motion+ (paid): "$399" one-time for the Personal licence; the Business plan is an annual per-seat subscription. The core library "is free and open source".

  **Source:** https://motion.dev/docs/react-installation ; https://motion.dev/plus ; registry.npmjs.org

### 4.6 TanStack Router and Query

- **Finding:**
  - TanStack Router with Vite: install `@tanstack/router-plugin`. Configure `tanstackRouter({ target: 'react', autoCodeSplitting: true })` in `vite.config`. "Please make sure that '@tanstack/router-plugin' is passed before '@vitejs/plugin-react'". Defaults: `./src/routes` → `./src/routeTree.gen.ts`.
  - npm `@tanstack/react-router@1.170.40`, `@tanstack/router-plugin@1.168.41`.

  **Source:** https://tanstack.com/router/latest/docs/framework/react/installation/with-vite
- **Finding:** TanStack Query: `npm i @tanstack/react-query`. "React Query is compatible with React v18+ and works with ReactDOM and React Native." npm `5.104.0`.
  **Source:** https://tanstack.com/query/latest/docs/framework/react/installation

### 4.7 Charts, toasts, icons

- **Finding:**
  - Recharts `3.10.1`, MIT.
  - Tremor: Vercel acquired it (announced January 22, 2025). "all Tremor products—including Tremor Blocks—are now free and open source". A co-founder said "net-new development will be happening in shadcn/ui" (search summary). npm `@tremor/react@3.18.7` was last published 2025-01-13 with peer `react: "^18.0.0"`. GitHub `tremorlabs/tremor`: Apache-2.0, last push 2025-10-10.
  - Sonner `2.0.8`, MIT.
  - lucide-react `1.49.0`, ISC licence (LICENSE file text begins "ISC License"; GitHub API reports NOASSERTION).

  **Source:** https://vercel.com/blog/vercel-acquires-tremor ; registry.npmjs.org ; https://github.com/lucide-icons/lucide

### 4.8 Ready-made admin/dashboard templates on shadcn

- **Finding:** `satnaing/shadcn-admin`:
  - "Admin Dashboard UI crafted with Shadcn and Vite". Tech stack: "ShadcnUI (TailwindCSS + RadixUI)", "Vite", "TanStack Router", TypeScript, ESLint and Prettier, "Auth (partial): Clerk". "Licensed under the MIT License".
  - package.json: `vite ^8.0.8`, `tailwindcss ^4.2.2`, `@tanstack/react-router ^1.168.22`, `@tanstack/react-query ^5.99.0`, `@tanstack/react-table ^8.21.3`, `recharts ^3.8.1`, `sonner ^2.0.7`, `react ^19.2.5`, `typescript ~6.0.3`, `zustand ^5.0.12`.
  - GitHub: 15,388 stars, push 2026-09-10, MIT.

  **Significance:** A ready-made template that already uses the candidate web stack (Vite + Tailwind 4 + shadcn + TanStack). Clerk is labelled "partial"; the README does not say whether it can run without a Clerk account.
  **Method:** curl of the raw README and package.json; GitHub API.
  **Source:** https://github.com/satnaing/shadcn-admin
- **Finding:** `Kiranism/next-shadcn-dashboard-starter` (MIT, 7,082 stars, push 2026-09-11) is built on Next.js. The `@tailwind-admin` registry ("free tailwind admin dashboard templates ... built with React, Next.js, Tailwind CSS, and sha[dcn]") is also in the shadcn index.
  **Source:** GitHub API; https://ui.shadcn.com/r/registries.json

---

## Area 5: Mock Server (REST + WebSocket)

| Option | npm version | Licence | WebSocket path | Node support evidence |
|---|---|---|---|---|
| Fastify + @fastify/websocket | `fastify@5.12.5`; `@fastify/websocket@11.3.1` | MIT | Plugin "Built upon ws@8". Deps `ws ^8.16.0`, `fastify-plugin ^6.0.0`, `duplexify`. Declares `fastify: '5.x'` (index.js line 248) | Fastify LTS: `5.0.0 ... Node.js 20, 22, 24, 26` |
| Hono + @hono/node-server | `hono@4.13.12`; `@hono/node-server@2.1.3` | MIT | `upgradeWebSocket` exported from `@hono/node-server`; needs `ws` plus `new WebSocketServer({ noServer: true })` passed as `serve({ fetch, websocket: { server: wss } })` | README: "It works on Node.js versions greater than 20.x"; engines `>=20` |
| Hono + @hono/node-ws (older adapter) | `@hono/node-ws@1.3.1` (2026-05-01) | MIT | Hono docs: "@hono/node-ws is deprecated" | peer `@hono/node-server: "^1.19.11"`, while node-server latest is `2.1.3` |
| Raw `ws` | `ws@8.22.0` | MIT | Library itself | engines `>=10.0.0` |
| TS runner: tsx | `tsx@4.23.15` | MIT | n/a | engines `>=18.0.0` |
| TS runner: Node native type stripping | Node 26 built-in | n/a | n/a | "Stability: 2 - Stable"; "enabled by default since v23.6.0 (and v22.18.0)"; limits listed below |

- **Finding:**
  - @fastify/websocket usage: `fastify.register(require('@fastify/websocket'))`, then a route `fastify.get('/', { websocket: true }, (socket, req) => {...})`.
  - TypeScript users need `@types/ws`.

  **Method:** `npm pack @fastify/websocket@11.3.1`, then read README.md and package.json.
  **Source:** local tarball; https://github.com/fastify/fastify-websocket
- **Finding:** Fastify listen defaults: "By default, the server will listen on the address(es) resolved by `localhost` when no specific host is provided". The documented example is `fastify.listen({ port: 3000, host: '127.0.0.1' }, ...)`.
  **Significance:** Relevant to the loopback-only binding requirement NFR4.
  **Method:** curl of the raw doc.
  **Source:** https://raw.githubusercontent.com/fastify/fastify/main/docs/Reference/Server.md (lines 1278–1320)
- **Finding:** The `@hono/node-server@2.1.3` type definitions (`dist/index.d.mts`) include a `hostname?: string` option. The README WebSocket example is as quoted in the table. Hono docs: "Currently Cloudflare Workers / Pages, Deno, Bun, and Node.js adapters are available" for WebSocket (WebFetch summary).
  **Source:** local tarball; https://github.com/honojs/node-server (README.md); https://hono.dev/docs/helpers/websocket
- **Finding:** Node native TypeScript limitations:
  - These features are unsupported: "Enum declarations", "Namespaces with runtime code", "Parameter properties", "Import aliases", "Decorators".
  - "`tsconfig.json` files are ignored" and "paths are not supported".
  - The `type` keyword is mandatory for type-only imports.
  - "File extensions are mandatory in all import statements".
  - "the `--experimental-transform-types` flag was removed in v26.0.0".

  Local test L7 passed.
  **Source:** https://nodejs.org/api/typescript.html (page for v26.10.0); local command L7.

---

## Area 6: Monorepo and Package Manager

- **Finding:** Expo monorepo guide (docs source `docs/pages/guides/monorepos.mdx`):
  - "Expo has first-class support for monorepos managed with package managers supporting workspaces: Bun, npm, pnpm, and Yarn (v1 Classic and Berry). Expo automatically detects monorepos and configures new app projects added to a monorepo."
  - "Expo configures Metro automatically for monorepos" (SDK 52+).

  **Method:** curl of raw MDX from expo/expo main.
  **Source:** https://docs.expo.dev/guides/monorepos/ (raw: https://raw.githubusercontent.com/expo/expo/main/docs/pages/guides/monorepos.mdx)
- **Finding:** On isolated installs:
  - "From **SDK 54**, Expo supports isolated dependencies and isolated installations."
  - For pnpm, isolated is "the default installation strategy unless it's disabled".
  - "not all packages you install will work and some React Native libraries may cause build or resolution errors when used with isolated dependencies ... switch to the **hoisted** installation strategy by changing the `nodeLinker` setting in a **pnpm-workspace.yaml** ... `nodeLinker: hoisted`".

  **Source:** same file, lines 184–199.
- **Finding:** On duplicates:
  - "Duplicate React Native versions in a single monorepo are not supported."
  - "Duplicate React versions in a single app will cause runtime errors."
  - "Duplicate versions of Turbo and Expo modules may cause runtime or build errors."
  - To diagnose, use `npm why react-native` or `pnpm why --depth=10 react-native`.
  - Resolutions: "For npm, you have to use a property named `overrides` rather than `resolutions`."
  - "From **SDK 55**, [autolinkingModuleResolution] is enabled automatically for apps in monorepos."
  - Workspace protocol: "Bun, npm, and pnpm support specifying workspace dependencies using `"workspace:*"`".

  **Significance:** Direct input for the React-alignment rule (web on React 19.3.0 latest vs SDK 57 pin 19.2.3, section 1.2).
  **Source:** same file, lines 158, 201–249.
- **Finding:** The RN 0.86.3 bundled Fabric renderer (`Libraries/Renderer/implementations/ReactFabric-dev.js`) embeds `version: "19.2.3"`.
  **Method:** tarball read.
  **Source:** local tarball `react-native@0.86.3`.
- **Finding:** pnpm installation doc (raw source):
  - "pnpm 12 is a native executable and does not require Node.js after it is installed. Installing it through npm requires Node.js 22.13 or newer."
  - Standalone script: `curl -fsSL https://get.pnpm.io/install.sh | sh -`, optionally with `env PNPM_VERSION=<version>`.
  - Through npm: `npx get-pnpm`.
  - The compatibility table shows pnpm 12 supports Node 18, 20, 22, 24 and 26.
  - "pnpm 12 only needs Node.js when it is installed from npm; the version installed by the standalone script runs without Node.js."

  **Method:** curl of the raw doc.
  **Source:** https://pnpm.io/installation (raw: https://raw.githubusercontent.com/pnpm/pnpm.io/main/docs/installation.md)
- **Finding:** The Homebrew formula `pnpm` is stable `12.8.1`, MIT, with bottles for `arm64_golden_gate` and no dependencies. The npm `pnpm@12.8.1` has `latest-10` → `10.34.6` and `latest-11` → `11.28.2`.
  **Significance:** pnpm can be installed without corepack in three ways: Homebrew, the standalone script, or npm.
  **Method:** formulae.brew.sh JSON API; `npm view`.
  **Source:** https://formulae.brew.sh/api/formula/pnpm.json ; registry.npmjs.org
- **Finding:** Evidence that the tools themselves use pnpm workspaces: `react-native-reusables` repo root contains `pnpm-workspace.yaml`, `pnpm-lock.yaml` and `turbo.json`. The shadcn CLI 4.21.0 has a `--monorepo` init option (4.2).
  **Source:** GitHub contents API for founded-labs/react-native-reusables.
- **Finding:** Other package managers: `yarn@1.22.22` (last published 2024-03-09); `@yarnpkg/cli-dist@4.18.1`; `turbo@2.11.5`. None of pnpm, yarn or bun is installed on the host (controller pre-screen, `status_tasks.md`).
  **Source:** registry.npmjs.org; status_tasks.md.

---

## Area 7: Android Toolchain on macOS arm64 Without Admin Prompts

### 7.1 JDK options

| Option | Channel type | Version | arm64 macOS 27 artefact | Admin (sudo) evidence |
|---|---|---|---|---|
| `openjdk@17` | Homebrew **formula** (keg-only, `:versioned_formula`) | `17.0.20.1` | bottle `arm64_golden_gate` present | Install needs no sudo. The caveat is optional, for system Java wrappers only: "For the system Java wrappers to find this JDK, symlink it with `sudo ln -sfn $HOMEBREW_PREFIX/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk`" |
| `openjdk@21` | formula (keg-only) | `21.0.12.1` | bottle `arm64_golden_gate` present | same caveat pattern |
| `openjdk` (unversioned) | formula (keg-only, `:shadowed_by_macos`) | `27` | bottle `arm64_golden_gate` present | same caveat pattern |
| `zulu@17` | Homebrew **cask** | `17.0.20.1,17.68.203`; URL `...zulu17.68.203-ca-jdk17.0.20.1-macosx_aarch64.dmg` | dmg | Artifact `{"pkg":["Double-Click to Install Azul Zulu JDK 17.pkg"]}` |
| `temurin@17` | Homebrew **cask** | `17.0.20.1,1`; URL `...OpenJDK17U-jdk_aarch64_mac_hotspot_17.0.20.1_1.pkg` | pkg | Artifact `{"pkg":[...]}` |

Formula licence (openjdk): `GPL-2.0-only WITH Classpath-exception-2.0`.
Method: curl of `https://formulae.brew.sh/api/formula/<name>.json` and `.../api/cask/<name>.json`. Source: formulae.brew.sh.

- **Finding:** In local Homebrew 6.0.22, `/opt/homebrew/Library/Homebrew/cask/artifact/pkg.rb` lines 63–87 install every `pkg` artifact with `command.run!("/usr/sbin/installer", sudo: true, sudo_as_root: true, args:, ...)` and `"-target", "/"`. The Cask Cookbook also says: "`pkg` artifacts ... are installed by macOS `/usr/sbin/installer`".
  **Significance:** Evidence for hypothesis H8: `.pkg` casks (`zulu@17`, `temurin@17`) invoke sudo. Formulae do not.
  **Method:** Local file read; curl of the raw Cask Cookbook.
  **Source:** local `/opt/homebrew/Library/Homebrew/cask/artifact/pkg.rb`; https://raw.githubusercontent.com/Homebrew/brew/main/docs/Cask-Cookbook.md (line 203)
- **Finding:** Both official docs (RN and Expo) name `brew install --cask zulu@17` (1.5). Neither page mentions the formula route.
  **Source:** as in 1.5.

### 7.2 Android command-line tools

- **Finding:** The Homebrew cask `android-commandlinetools` is at version `15859902`. URL `https://dl.google.com/android/repository/commandlinetools-mac_arm64-15859902_latest.zip`. Artifact target `$HOMEBREW_PREFIX/share/android-commandlinetools/cmdline-tools/latest`, with binaries (`avdmanager`, `sdkmanager`, ...) linked into `$HOMEBREW_PREFIX/bin`. Caveat: "Default Android SDK root is $HOMEBREW_PREFIX/share/android-commandlinetools" and "android-commandlinetools requires Java". The artifact type is `artifact`/`binary` (no `pkg`).
  **Method:** formulae.brew.sh cask JSON.
  **Source:** https://formulae.brew.sh/api/cask/android-commandlinetools.json
- **Finding:** Google's SDK repository manifest (`repository2-3.xml`) lists `cmdline-tools;latest` at revision `23.0` (channel-0 stable), with archive `commandlinetools-mac_arm64-16111833_latest.zip` (148 MiB). Its SHA-1 `ad03dc49bfacfd52c110b14104ea548b8a07e830` matched the downloaded file (scratchpad only, not installed). `source.properties` in the zip: `Pkg.Revision=23.0`.
  **Significance:** The Homebrew cask build (15859902) is older than Google's current latest (16111833).
  **Method:** curl manifest; curl zip into the scratchpad; `shasum -a 1`.
  **Source:** https://dl.google.com/android/repository/repository2-3.xml
- **Finding:** sdkmanager docs, manual layout: `android_sdk/cmdline-tools/latest/{bin,lib,NOTICE.txt,source.properties}`. Commands: `sdkmanager "platform-tools" "platforms;android-36"`, `sdkmanager --licenses`, `--list`, `--sdk_root=path`, `--channel=channel_id` (0 stable, 1 beta, 2 dev, 3 canary) (WebFetch summary).
  **Source:** https://developer.android.com/tools/sdkmanager

### 7.3 sdkmanager package IDs (from Google's manifests, 2026-09-30)

| Package ID (quoted) | Revision / channel | macOS archive and size |
|---|---|---|
| `platform-tools` | 37.0.1, stable | `platform-tools_r37.0.1-darwin.zip` = 15 MiB |
| `build-tools;36.0.0` | 36.0.0, stable (also `36.1.0`, `37.0.0` listed) | `build-tools_r36_macosx.zip` = 75 MiB |
| `platforms;android-36` | rev 2, stable (also `android-36.1`, `android-37.0`, `android-37.1`, `android-37.2`) | `platform-36_r02.zip` = 63 MiB |
| `emulator` | **37.1.11 stable (channel-0)**; 37.2.11 beta; 37.3.2 dev | `emulator-darwin_aarch64-15917651.zip` = 376 MiB (stable) |
| `ndk;27.1.12297006` | listed | (matches RN 0.86.3 `ndkVersion`) |
| `system-images;android-36;google_apis;arm64-v8a` | rev 7 | `arm64-v8a-36_r07.zip` = 1,786 MiB |
| `system-images;android-36;google_apis_playstore;arm64-v8a` | rev 7 | `arm64-v8a-36_r07.zip` = 1,799 MiB |
| `system-images;android-36.1;google_apis;arm64-v8a` | rev 4 | `arm64-v8a-36.1_r04.zip` = 1,844 MiB |
| `system-images;android-36;default;arm64-v8a` | rev 2 | (size not extracted) |
| `system-images;android-36;google_apis_ps16k;arm64-v8a` | rev 7 | 16 KB page-size variant |
| `system-images;android-37.0;google_apis;arm64-v8a` | rev 6 | (size not extracted) |

Method: curl of `repository2-3.xml` and `sys-img/{google_apis,google_apis_playstore,android}/sys-img2-3.xml`, parsed with node. No manifest listed a tablet-specific system image (grep "tablet" = 0 matches). Tablets use a device profile on a normal image.
Source: https://dl.google.com/android/repository/repository2-3.xml ; https://dl.google.com/android/repository/sys-img/google_apis/sys-img2-3.xml ; https://dl.google.com/android/repository/sys-img/google_apis_playstore/sys-img2-3.xml ; https://dl.google.com/android/repository/sys-img/android/sys-img2-3.xml

### 7.4 Tablet AVD device profiles

- **Finding:** The device definitions inside cmdline-tools 23.0 (`lib/sdklib/sdklib.core.jar`, `com/android/sdklib/devices/nexus.xml` and `devices.xml`) contain these device IDs:
  - `pixel_tablet`: "Pixel Tablet", 10.95 in, 2560x1600, xhdpi.
  - `medium_tablet`: "Medium Tablet", 10.055 in, 2560x1600, xhdpi.
  - `small_tablet`: "Small Tablet", 7.0 in, 1920x1200, xhdpi.
  - Also `pixel_c`, `Nexus 9`, `10.1in WXGA (Tablet)`, `7in WSVGA (Tablet)`, `pixel_fold`, `resizable` and `13.5in Freeform`.

  **Significance:** These are the exact `avdmanager create avd --device <id>` values available in the current cmdline-tools.
  **Method:** Downloaded the official zip to the scratchpad (checksum verified), unzipped the jar resources and parsed the XML. No Java was needed; nothing was installed.
  **Source:** https://dl.google.com/android/repository/commandlinetools-mac_arm64-16111833_latest.zip
- **Finding (secondary):** A search result says the Pixel Tablet hardware "was discontinued on September 10, 2026". This does not affect the AVD profile, which is still present in cmdline-tools 23.0.
  **Source:** https://en.wikipedia.org/wiki/Pixel_Tablet (search snippet)

### 7.5 Emulator networking, adb reverse, cleartext ws://

- **Finding:** Android emulator network addresses:
  - `10.0.2.2 | Special alias to your host loopback interface (127.0.0.1 on your development machine)`
  - `127.0.0.1 | The emulated device loopback interface`
  - "To access services running on your development machine loopback interface, use the special address `10.0.2.2` instead."

  (WebFetch summary, quoted rows.)
  **Significance:** Confirms hypothesis H3.
  **Source:** https://developer.android.com/studio/run/emulator-networking-address
- **Finding:** `adb reverse` syntax: `adb reverse tcp:<remote_port> tcp:<local_port>`, `adb reverse --list`, `adb reverse --remove tcp:<port>`, `adb reverse --remove-all`, `-s <serial>`. "Reverse forwarding is available on Android 5.0+ only" (secondary: tldr and man-page aggregators). The official `developer.android.com/tools/adb` page as fetched documented `adb forward` only.
  **Source:** https://linuxcommandlibrary.com/man/adb-reverse (secondary); https://developer.android.com/tools/adb
- **Finding:** Expo CLI 57 runs `adb reverse` for the Metro port by itself. In `@expo/cli@57.0.27` `build/src/start/platforms/android/AndroidPlatformManager.js`, line 30 calls `startAdbReverseAsync([this.port])`, and `adbReverse.js` runs `adbArgs(device.pid, 'reverse', 'tcp:${port}', 'tcp:${port}')`.
  **Significance:** Only the Metro port is reversed automatically. Any other port, such as a mock service, is not.
  **Method:** tarball grep.
  **Source:** local tarball.
- **Finding:** Cleartext traffic:
  - Android Network Security Config: for apps targeting API 28+, the default is `<base-config cleartextTrafficPermitted="false">`.
  - Opt-in is per domain through `domain-config cleartextTrafficPermitted="true"`.
  - `<debug-overrides>` applies "only when `android:debuggable` is `"true"`".

  (WebFetch summary.)
  **Source:** https://developer.android.com/privacy-and-security/security-config
- **Finding:** The Expo SDK 57 bare template ships `app/src/debug/AndroidManifest.xml` and `app/src/debugOptimized/AndroidManifest.xml`. Both contain `<application android:usesCleartextTraffic="true" tools:targetApi="28" ... tools:replace="android:usesCleartextTraffic" />`. `app/src/main/AndroidManifest.xml` has no cleartext attribute.
  The RN gradle plugin `AgpConfiguratorUtils.kt` (lines 36–47) sets `manifestPlaceholders["usesCleartextTraffic"] = "true"` for `debug` and `debugOptimized`, and `"false"` for `release`.
  **Significance:** Evidence for hypothesis H4 at the template level: debug variants already allow cleartext (`ws://`, `http://`), and release does not.
  **Method:** tarball read.
  **Source:** local tarballs `expo-template-bare-minimum@57.0.28` and `@react-native/gradle-plugin@0.86.3`.

### 7.6 Watchman

- **Finding:** The Homebrew formula `watchman` is stable `2026.09.21.00`, MIT, with bottle `arm64_golden_gate` present (sha256 `7936525d...`). Dependencies: `edencommon, fb303, fbthrift, fmt, folly, glog, pcre2, python@3.14`.
  **Significance:** Evidence against hypothesis H7 for watchman: a macOS 27 bottle exists.
  **Source:** https://formulae.brew.sh/api/formula/watchman.json
- **Finding:**
  - Expo docs: "Installing Watchman is only required for projects on SDK 55 and earlier."
  - RN docs: Watchman is "highly recommended ... for better performance."

  **Source:** https://docs.expo.dev/workflow/android-studio-emulator/ ; https://reactnative.dev/docs/set-up-your-environment?os=macos&platform=android

### 7.7 Android Studio (for reference only; out of scope per blueprint)

- **Finding:** The Homebrew cask `android-studio` is at `2026.1.4.8,quail4-patch1`. Its `zap` list includes `~/.android` and `~/Library/Android/sdk`.
  **Source:** https://formulae.brew.sh/api/cask/android-studio.json

---

## Area 8: Licences, Paid Tiers, Required Accounts, Cloud and Telemetry

| Candidate | Licence (evidence) | Paid tier (evidence) | Account / cloud needed for local use | Telemetry and opt-out (evidence) |
|---|---|---|---|---|
| Expo CLI / SDK | MIT (npm) | EAS is a cloud service (not collected) | Local `npx expo run:android` compiles and installs on the emulator. The Expo local-development page "does not explicitly state" whether an account is needed (WebFetch summary). No login check was found in this collection | "Expo dev tools collect anonymous data ... opt out by using the `EXPO_NO_TELEMETRY=1` environment variable" (expo-cli.mdx line 660). CLI source `env.js` line 73: `boolish('EXPO_NO_TELEMETRY', false)`. Related: `EXPO_OFFLINE` ("Skip all network requests when applicable") |
| React Native / Metro | MIT | none | none | none found |
| react-native-reusables | MIT | none found | CLI `@react-native-reusables/cli@0.7.1`: 0 files matching telemetry, posthog, segment, amplitude or mixpanel (tarball grep) | none found |
| HeroUI Native / HeroUI web | Apache-2.0 | HeroUI Pro: perpetual plans (Web Hero / Mobile Hero / Super Hero); amounts not shown on the fetched page | none for OSS | not collected |
| Tamagui | MIT (core, repo) | Bento, Takeout, Pro (prices not shown) | Pro includes "Private GitHub" access | not collected |
| gluestack-ui | MIT (README) | none found | none | not collected |
| Uniwind | MIT | Pro: $99 / $49 / $29 / $1 per seat per year by seat band | install requirements for Pro not stated | not collected |
| NativeWind | MIT | none found | none | not collected |
| React Native Paper / UI Kitten / ui-lib | MIT | none | none | not collected |
| shadcn CLI | MIT | none | Private GitHub registries are optional (changelog August 2026) | tarball grep: only `GH_TELEMETRY` deletion for `gh` subprocesses; no own telemetry found |
| Magic UI | MIT (free) | Pro $199 one-time; "Re-selling of code is NOT allowed" | account for Pro only | not collected |
| Aceternity UI | purchased-item licence (above); free-component licence not stated | Annual $169 / Lifetime $199 / Team $1,590 | account for Pro | not collected |
| Animate UI / React Bits | MIT + Commons Clause | none found | none | not collected |
| Motion Primitives | MIT | not checked | none | not collected |
| Motion (motion.dev) | MIT | Motion+ $399 one-time (Personal) | none for core | not collected |
| Vite / create-vite | MIT | none | none | Vite guide makes no mention of telemetry. `create-vite@9.2.1` tarball grep: 0 files |
| create-expo-app | MIT | n/a | none | `create-expo-app@5.0.0` tarball grep: 0 files |
| Next.js (not a candidate; listed for completeness) | MIT | n/a | n/a | `NEXT_TELEMETRY_DISABLED=1` or `npx next telemetry disable` |
| Turborepo | MIT | n/a | n/a | `turbo telemetry disable`, `TURBO_TELEMETRY_DISABLED=1` or `DO_NOT_TRACK=1` |
| Homebrew | BSD-2 (not collected) | n/a | none | "Homebrew collects aggregate, anonymous usage analytics in InfluxDB". Opt out with `brew analytics off` or `export HOMEBREW_NO_ANALYTICS=1` |
| Android Emulator | Android SDK licence (acceptance via `sdkmanager --licenses`) | n/a | none | Emulator warning text: "Or use the '-no-metrics' flag to bypass this warning and turn off the metrics collection. In a future release this warning will turn into a one-time blocking prompt to ask for explicit user input regarding metrics collection" (quoted in a third-party issue; secondary). cmdline-tools 23.0 bundles `lib/analytics-library` (contains `com/android/tools/analytics/AnalyticsSettings.class`, `OptInToMetrics`) |
| Fastify / Hono / ws / tsx | MIT | none | none | none found |
| pnpm | MIT | none | none | not collected |
| openjdk (Homebrew) | GPL-2.0 with Classpath exception | none | none | n/a |
| Azul Zulu (cask) | Azul licence (not collected) | n/a | none | n/a |
| fnm (version manager) | GPL-3.0-only (Homebrew metadata) | none | none | not collected |

Sources for this table:
- https://raw.githubusercontent.com/expo/expo/main/docs/pages/more/expo-cli.mdx (lines 617, 624, 644, 660)
- local `@expo/cli@57.0.27` tarball
- https://nextjs.org/telemetry
- https://turborepo.dev/docs/telemetry
- https://raw.githubusercontent.com/Homebrew/brew/main/docs/Analytics.md (lines 7, 67, 73)
- https://github.com/com-lihaoyi/mill/issues/6120 (secondary, emulator banner text)
- the cmdline-tools zip listing
- vendor pages cited in Areas 2 and 4

---

## External Research Findings

### Technology Trends (Dim 1)

- **React Native release cadence.** RN 0.86 (June 2026) is the second release with "no user-facing breaking changes". RN 0.87 is "a large cleanup release that removes many deprecated APIs". RN 0.88 is scheduled for October 12, 2026 (secondary). Sources: https://reactnative.dev/blog/2026/06/11/react-native-0.86 ; https://expo.dev/changelog/sdk-58-beta
- **Expo upgrade model.** SDK 57 is "the first step toward a new release cadence ... optional, non-breaking upgrades between the big SDKs" (Expo on X, secondary). Source: https://x.com/expo/status/2072074190686208502
- **Tailwind v4 in React Native.** Uniwind (Tailwind 4) and NativeWind v5 RC (Tailwind 4) are displacing NativeWind v4 (Tailwind 3) in new kits: HeroUI Native, the reusables Uniwind template, and gluestack v5. Sources: Area 2.
- **Registry distribution.** shadcn's registry index lists 408 namespaces, and multiple animated collections install through one CLI. Source: https://ui.shadcn.com/r/registries.json
- **TypeScript 7 (Go-native).** It became npm `latest` in July 2026. Templates remain on TS 6. Source: Area 1.8.
- **Node release status.** 26 becomes LTS on 2026-10-28. Corepack is removed from 25+. Sources: Area 1.3 and 1.4.

### Technology Evaluation (Dim 2)

The comparison data is in Areas 1–7:
- 2.0 mobile kits table;
- Area 3 animation table;
- 4.3 animated registries table;
- Area 5 mock-server table;
- Area 6 package-manager items;
- Area 7 toolchain tables.

No scores or verdicts are assigned here; that is for row 3.

### Vendor Evaluation (Dim 3)

Limited scope (licence, paid tiers, accounts, cloud) as requested. See the Area 8 table.

### Market Share & Positioning (Dim 4)

No findings. This dimension is not in scope for this task.

### Regulatory & Compliance (Dim 5)

No findings. This dimension is not in scope for this task.

### Competitive Landscape (Dim 6)

No findings. This dimension is not in scope for this task.

### Industry Trends (Dim 7)

No findings. This dimension is not in scope for this task.

---

## Appendix A: npm Registry Snapshot (quoted output)

Command pattern: `npm view <pkg> name version license engines peerDependencies dist-tags time.modified --json` with `npm_config_cache=<scratchpad>/npmcache`, run 2026-09-30 between 22:35 and 22:56 WIB. The table below is generated from the saved JSON output (licence field and `engines.node` as returned).

| Package | Latest version | Licence (npm metadata) | engines.node |
|---|---|---|---|
| `@base-ui-components/react` | 1.0.0-rc.0 | MIT | >=14.0.0 |
| `@base-ui/react` | 1.8.0 | MIT | >=14.0.0 |
| `@expo/cli` | 57.0.27 | MIT | - |
| `@expo/ui` | 57.0.21 | MIT | - |
| `@fastify/cors` | 11.3.0 | MIT | - |
| `@fastify/websocket` | 11.3.1 | MIT | - |
| `@gluestack-ui/core` | 5.0.15 | MIT | >=18 |
| `@gluestack-ui/nativewind-utils` | 1.0.28 | (none in npm metadata) | - |
| `@gluestack-ui/themed` | 1.1.73 | ISC | - |
| `@gluestack-ui/utils` | 5.0.6 | MIT | >=18 |
| `@gorhom/bottom-sheet` | 5.2.14 | MIT | - |
| `@heroui/react` | 3.2.6 | MIT | - |
| `@heroui/styles` | 3.2.6 | MIT | - |
| `@heroui/theme` | 2.4.26 | MIT | - |
| `@hono/node-server` | 2.1.3 | MIT | >=20 |
| `@hono/node-ws` | 1.3.1 | MIT | >=18.14.1 |
| `@legendapp/list` | 3.6.0 | MIT | - |
| `@mantine/charts` | 9.6.3 | MIT | - |
| `@mantine/core` | 9.6.3 | MIT | - |
| `@react-native-community/cli` | 20.2.0 | MIT | >=20.19.4 |
| `@react-native-reusables/cli` | 0.7.1 | MIT | - |
| `@react-navigation/native` | 7.5.0 | MIT | - |
| `@react-navigation/native-stack` | 7.20.0 | MIT | - |
| `@react-navigation/stack` | 7.12.0 | MIT | - |
| `@rn-primitives/dialog` | 1.5.2 | MIT | - |
| `@rn-primitives/portal` | 1.5.3 | MIT | - |
| `@rn-primitives/slot` | 1.5.2 | MIT | - |
| `@shopify/flash-list` | 2.3.2 | MIT | - |
| `@shopify/react-native-skia` | 2.13.1 | MIT | - |
| `@shopify/restyle` | 2.4.5 | MIT | - |
| `@tailwindcss/vite` | 4.3.3 | MIT | - |
| `@tamagui/config` | 2.7.7 | (none in npm metadata) | - |
| `@tamagui/core` | 2.7.7 | MIT | - |
| `@tanstack/react-query` | 5.104.0 | MIT | - |
| `@tanstack/react-router` | 1.170.40 | MIT | >=20.19 |
| `@tanstack/react-start` | 1.168.59 | MIT | >=22.12.0 |
| `@tanstack/router-plugin` | 1.168.41 | MIT | >=20.19 |
| `@testing-library/react` | 16.3.3 | MIT | >=18 |
| `@tremor/react` | 3.18.7 | Apache 2.0 | - |
| `@types/node` | 26.6.3 | MIT | - |
| `@types/ws` | 8.18.2 | MIT | - |
| `@ui-kitten/components` | 6.1.3 | MIT | - |
| `@vitejs/plugin-react` | 6.1.1 | MIT | ^20.19.0 or >=22.12.0 |
| `@vitejs/plugin-react-swc` | 4.3.3 | MIT | ^20.19.0 or >=22.12.0 |
| `@yarnpkg/cli-dist` | 4.18.1 | BSD-2-Clause | >=18.12.0 |
| `burnt` | 0.13.0 | MIT | - |
| `class-variance-authority` | 0.7.1 | Apache-2.0 | - |
| `clsx` | 2.1.1 | MIT | >=6 |
| `cmdk` | 1.1.1 | MIT | - |
| `corepack` | 0.36.0 | MIT | ^22.22.2 or ^24.15.0 or >=26.0.0 |
| `create-vite` | 9.2.1 | MIT | ^20.19.0 or >=22.12.0 |
| `dripsy` | 4.3.8 | MIT | - |
| `expo` | 57.0.26 | MIT | - |
| `expo-blur` | 57.0.3 | MIT | - |
| `expo-dev-client` | 57.0.19 | MIT | - |
| `expo-doctor` | 1.20.4 | MIT | ^20.19.4 or ^22.13.0 or ^24.3.0 or >= 25.0.0 |
| `expo-glass-effect` | 57.0.4 | MIT | - |
| `expo-haptics` | 57.0.3 | MIT | - |
| `expo-image` | 57.0.5 | MIT | - |
| `expo-linear-gradient` | 57.0.2 | MIT | - |
| `expo-mesh-gradient` | 57.0.2 | MIT | - |
| `expo-router` | 57.0.24 | MIT | - |
| `expo-screen-orientation` | 57.0.2 | MIT | - |
| `expo-video` | 57.0.5 | MIT | - |
| `fastify` | 5.12.5 | MIT | - |
| `framer-motion` | 13.4.6 | MIT | - |
| `heroui-native` | 1.0.10 | Apache-2.0 | - |
| `hono` | 4.13.12 | MIT | >=16.9.0 |
| `jest-expo` | 57.0.5 | MIT | - |
| `lottie-react-native` | 7.5.0 | Apache-2.0 | - |
| `lucide-react` | 1.49.0 | ISC | - |
| `metro` | 0.87.1 | MIT | ^22.13.0 or ^24.3.0 or >= 26.0.0 |
| `moti` | 0.30.0 | MIT | - |
| `motion` | 13.4.6 | MIT | - |
| `nativewind` | 4.2.7 | MIT | >=16 |
| `next` | 16.3.7 | MIT | >=20.9.0 |
| `pnpm` | 12.8.1 | MIT | >=18.* |
| `radix-ui` | 1.6.7 | MIT | - |
| `react` | 19.3.0 | MIT | >=0.10.0 |
| `react-dom` | 19.3.0 | MIT | - |
| `react-native` | 0.87.1 | MIT | ^22.13.0 or ^24.3.0 or >= 26.0.0 |
| `react-native-css` | 3.0.7 | MIT | - |
| `react-native-css-interop` | 0.2.7 | MIT | >=18 |
| `react-native-ease` | 0.8.1 | MIT | - |
| `react-native-gesture-handler` | 3.3.0 | MIT | - |
| `react-native-gifted-charts` | 1.4.78 | MIT | - |
| `react-native-paper` | 5.15.3 | MIT | - |
| `react-native-reanimated` | 4.7.0 | MIT | - |
| `react-native-safe-area-context` | 5.10.1 | MIT | - |
| `react-native-screen-transitions` | 4.0.0 | MIT | - |
| `react-native-screens` | 4.28.0 | MIT | - |
| `react-native-svg` | 15.15.5 | MIT | - |
| `react-native-teleport` | 1.2.2 | MIT | - |
| `react-native-ui-lib` | 9.1.3 | MIT | >=18 |
| `react-native-unistyles` | 3.3.0 | MIT | >= 20.18.0 |
| `react-native-worklets` | 0.13.0 | MIT | - |
| `recharts` | 3.10.1 | MIT | >=18 |
| `rive-react-native` | 9.8.5 | MIT | >=16 |
| `shadcn` | 4.21.0 | MIT | >=20.18.1 |
| `sonner` | 2.0.8 | MIT | - |
| `sonner-native` | 0.27.0 | MIT | - |
| `tailwind-merge` | 3.7.0 | MIT | - |
| `tailwindcss` | 4.3.3 | MIT | - |
| `tamagui` | 2.7.7 | (none in npm metadata) | - |
| `tsx` | 4.23.15 | MIT | >=18.0.0 |
| `turbo` | 2.11.5 | MIT | - |
| `tw-animate-css` | 1.4.0 | MIT | - |
| `typescript` | 7.0.2 | Apache-2.0 | >=16.20.0 |
| `uniwind` | 1.12.0 | MIT | - |
| `vaul` | 1.1.2 | MIT | - |
| `victory-native` | 42.0.1 | MIT | - |
| `vite` | 8.3.1 | MIT | ^20.19.0 or >=22.12.0 |
| `vitest` | 5.0.3 | MIT | ^22.12.0 or ^24.0.0 or >=26.0.0 |
| `ws` | 8.22.0 | MIT | >=10.0.0 |
| `yarn` | 1.22.22 | BSD-2-Clause | >=4.0.0 |

Other `npm view` outputs quoted in the body: `expo` dist-tags (1.1); `react-native@0.86.3`, `metro@0.84.5`, `@expo/metro@56.0.2`, `@react-native/metro-config@0.86.3` (1.3); `react-native-reanimated@4.5.1`, `react-native-worklets@0.10.1`, `react-native-gesture-handler@2.32.0`, `@shopify/react-native-skia@2.6.2`, `lottie-react-native@7.3.8`, `moti@0.30.0` peers (Area 3); `nativewind@5.0.0-rc.0` peers (2.0); `@hono/node-server@2.1.3` peers (Area 5); `pnpm@12.8.1` / `@pnpm/exe@12.8.1` engines (Area 6); `typescript@6` versions (1.8); `expo-router@57.0.24` dependencies (Area 3).

Tarballs fetched with `npm pack` into the scratchpad (read only, never installed): `expo@57.0.26`, `expo-template-default@57.0.28`, `expo-template-bare-minimum@57.0.28`, `react-native@0.86.3`, `@react-native/gradle-plugin@0.86.3`, `expo-modules-autolinking@57.0.13`, `@expo/cli@57.0.27`, `babel-preset-expo@57.0.13`, `shadcn@4.21.0`, `@hono/node-server@2.1.3`, `@fastify/websocket@11.3.1`, `create-vite@9.2.1`, `@react-native-reusables/cli@0.7.1`, `create-expo-app@5.0.0`.

---

## Query Log

Confidentiality check: none of the entries below contains design-book text, "DEMS", "evidence", "Polri" or any project detail. Calls were not individually timestamped; entries are in approximately chronological order within the session window 2026-09-30 22:34–23:05 WIB.

### WebSearch queries (verbatim)

| # | Query |
|---|---|
| Q1 | `Expo SDK 57 release notes React Native 0.86` |
| Q2 | `Expo SDK 58 beta release React Native 0.87` |
| Q3 | `Node.js 25 corepack removed from distribution` |
| Q4 | `React Native 0.82 New Architecture only legacy architecture removed blog` |
| Q5 | `reactnative.dev blog React Native 0.86 release` |
| Q6 | `HeroUI Pro pricing components templates` |
| Q7 | `HeroUI v3 animations CSS motion dependency removed framer-motion` |
| Q8 | `Tamagui v2 release animation driver reanimated motion Bento Takeout pricing` |
| Q9 | `react-native-gesture-handler 3.0 release new API hooks breaking changes` |
| Q10 | `Reanimated 4 shared element transitions status Android New Architecture 2026` |
| Q11 | `Expo Router zoom transition link preview Android support SDK 57` |
| Q12 | `coss ui Origin UI license MIT Base UI components` |
| Q13 | `Tremor joins Vercel tremor.so copy paste components status` |
| Q14 | `adb reverse tcp port command syntax documentation` |
| Q15 | `avdmanager list device "pixel_tablet" id tablet profile create avd command line` |
| Q16 | `"avdmanager list device" output "pixel_tablet" "Pixel Tablet" Google` |
| Q17 | `android emulator "-no-metrics" flag usage statistics command line` |
| Q18 | `moti Reanimated 4 compatibility issue worklets` |
| Q19 | `React Native animated component collection copy paste Reanimated Skia library 2026` |
| Q20 | `TypeScript 7.0 released native Go compiler compatibility typescript 6.0` |

### WebFetch URLs (verbatim)

https://docs.expo.dev/versions/latest/ · https://expo.dev/changelog/sdk-57 · https://expo.dev/changelog/sdk-58-beta · https://docs.expo.dev/get-started/set-up-your-environment/?platform=android&device=simulated&mode=development-build&buildEnv=local · https://reactnative.dev/docs/set-up-your-environment?os=macos&platform=android · https://nodejs.org/docs/latest-v26.x/api/corepack.html (404) · https://pnpm.io/installation · https://docs.swmansion.com/react-native-reanimated/docs/guides/compatibility/ · https://reactnative.dev/blog/2025/10/08/react-native-0.82 · https://docs.gradle.org/current/userguide/compatibility.html · https://developer.android.com/build/releases/gradle-plugin · https://heroui.com/docs/native/getting-started · https://heroui.com/docs/native/getting-started/quick-start · https://heroui.com/docs/react/getting-started · https://heroui.pro/ · https://heroui.com/docs/react/getting-started/animation · https://docs.heroui.pro/ (redirect) · https://heroui.pro/docs/react/getting-started · https://heroui.pro/pricing · https://tamagui.dev/docs/intro/introduction · https://tamagui.dev/blog/version-two · https://tamagui.dev/takeout · https://gluestack.io/ui/docs/home/overview/introduction · https://reactnativereusables.com/docs/installation · https://uniwind.dev · https://www.nativewind.dev/ · https://uniwind.dev/pricing · https://www.nativewind.dev/v5 · https://callstack.github.io/react-native-paper/docs/guides/getting-started (redirect) · https://oss.callstack.com/react-native-paper/docs/guides/getting-started · https://ui.shadcn.com/docs/installation/vite · https://ui.shadcn.com/docs/changelog · https://magicui.design/docs/installation · https://pro.magicui.design/ · https://ui.aceternity.com/pricing · https://ui.aceternity.com/docs/install-tailwindcss · https://ui.aceternity.com/licence · https://animate-ui.com/docs/installation · https://reactbits.dev/get-started/installation · https://motion.dev/docs/react-installation · https://motion.dev/plus · https://tanstack.com/router/latest/docs/framework/react/installation/with-vite · https://tanstack.com/query/latest/docs/framework/react/installation · https://vite.dev/guide/ · https://tailwindcss.com/docs/installation/using-vite · https://ui.shadcn.com/docs/components/chart · https://mantine.dev/getting-started/ · https://hono.dev/docs/helpers/websocket · https://nodejs.org/api/typescript.html · https://developer.android.com/studio/run/emulator-networking · https://developer.android.com/tools/adb · https://developer.android.com/studio/run/emulator-networking-address · https://developer.android.com/privacy-and-security/security-config · https://developer.android.com/studio/run/emulator-commandline · https://nextjs.org/telemetry · https://turborepo.com/docs/telemetry (redirect) · https://turborepo.dev/docs/telemetry · https://docs.expo.dev/guides/local-app-development/ · https://docs.expo.dev/workflow/android-studio-emulator/ · https://developer.android.com/tools/sdkmanager · https://docs.expo.dev/guides/new-architecture/ · https://shopify.github.io/react-native-skia/docs/getting-started/installation/ · https://docs.swmansion.com/react-native-reanimated/docs/css-animations/animation-name/ · https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/entering-exiting-animations/ · https://docs.expo.dev/versions/latest/sdk/video/ · https://docs.expo.dev/versions/latest/sdk/blur-view/ · https://docs.expo.dev/versions/latest/sdk/ui/ · https://ui.shadcn.com/docs/tailwind-v4 · https://ui.shadcn.com/docs/components/sonner

### curl / Bash network fetches (verbatim hosts and paths)

- `raw.githubusercontent.com`:
  - nodejs/Release schedule.json
  - pnpm/pnpm.io docs/installation.md
  - expo/expo docs/pages/guides/monorepos.mdx and more/expo-cli.mdx
  - founded-labs/react-native-reusables README, docs MDX and registry file
  - founded-labs/react-native-reusables-templates minimal and minimal-uniwind package.json
  - heroui-inc/heroui-native README
  - heroui-inc/heroui-native-example package.json
  - gluestack/gluestack-ui README
  - satnaing/shadcn-admin README and package.json
  - honojs/node-server README
  - fastify/fastify docs/Reference/Server.md and LTS.md
  - privatenumber/tsx README
  - Homebrew/brew docs/Cask-Cookbook.md and Analytics.md
- `api.github.com/repos/<owner>/<repo>`: metadata for 40 repos listed in Areas 2–5, plus `/license` and `/contents` for a few. The rate limit was reached during the session, before 22:51 WIB (reset 16:42 UTC).
- `nodejs.org/dist/index.json`
- `dl.google.com/android/repository/repository2-3.xml` and `sys-img/{google_apis,google_apis_playstore,android}/sys-img2-3.xml`
- `dl.google.com/android/repository/commandlinetools-mac_arm64-16111833_latest.zip` (scratchpad only)
- `formulae.brew.sh/api/formula/{openjdk@17,openjdk@21,openjdk,watchman,node@24,node@22,pnpm,fnm,nvm}.json`
- `formulae.brew.sh/api/cask/{zulu@17,temurin@17,android-commandlinetools,android-platform-tools,android-studio}.json`
- `android.googlesource.com/platform/tools/base/+/refs/heads/{main,mirror-goog-studio-main}/sdklib/.../devices/*.xml?format=TEXT`
- `ui.shadcn.com/r/registries.json` and `ui.shadcn.com/r/styles/new-york-v4/{toast,sonner,chart}.json`
- `magicui.design/r/{shimmer-button,blur-fade,number-ticker}.json` and `magicui.design/registry.json`
- `animate-ui.com/r/registry.json`, `motion-primitives.com/c/registry.json`, `reactbits.dev/r/registry.json`, `ui.aceternity.com/registry/registry.json`, `kokonutui.com/r/registry.json`, `coss.com/ui/r/registry.json`
- `github.com/com-lihaoyi/mill/issues/6120` (HTML, for the emulator banner text)

### npm registry commands

About 150 `npm view` / `npm pack` invocations against `https://registry.npmjs.org/`, using package names only. The full list of names is in Appendix A and the body.

---

## Collection Log

Only the anchored times are exact (from `date` output or file modification times). Every other row is a step in sequence.

| Time (WIB) | Action | Details |
|---|---|---|
| 22:34 (anchored: `date`) | Read | identification/01_translated.md, 01_original.md, 02_structured.md (rows 1–25), decisions/decisions.md, README.md, status_tasks.md |
| next | Env | node/npm/registry probe; `~/.npm` write blocked by sandbox, so switched to a scratchpad npm cache |
| next | npm | Runtime, mobile-kit, animation, web and server package snapshots; `npm pack` of expo, templates, react-native, gradle-plugin, autolinking |
| next | curl | Node schedule.json and dist index |
| 22:39 (anchored: file mtime) | curl | Android repository2-3.xml and three sys-img manifests |
| next | curl | formulae.brew.sh formula and cask JSON |
| next | Web | Expo, RN, Node, pnpm, Gradle, AGP docs |
| next | Web + GitHub | GitHub metadata batch; UI kits (reusables, HeroUI, Tamagui, gluestack, Paper, Uniwind, NativeWind); RNGH 3, shared-element, Expo Router transitions |
| next | Web + registries | shadcn CLI, registries index, Magic UI, Aceternity, Animate UI, registry probes |
| next | Limit | GitHub API unauthenticated rate limit exhausted (reset 16:42 UTC); switched to raw.githubusercontent.com and WebFetch |
| next | Web + tarballs | coss, React Bits, Motion, TanStack, Vite, Tailwind, shadcn-admin, chart, Tremor, Mantine, Hono, Fastify, tsx, Node type stripping (local test L7), emulator networking, adb reverse, cleartext |
| 22:51 (anchored: file mtime) | Download | cmdline-tools arm64 zip to scratchpad; SHA-1 verified against manifest; device XML parsed |
| next | Web | Emulator metrics, telemetry (Next, Turbo, Expo), Expo local builds, sdkmanager, New Architecture, Skia, Reanimated, expo-video, expo-blur, Expo UI, shadcn Tailwind v4 / sonner, TypeScript 7 |
| next | Note | `brew analytics state` was run once, read-only in intent. It tried to refresh Homebrew API data and failed with `curl: (56) Failure writing output to destination` because the sandbox blocks cache writes. No analytics state was changed, and the command output did not report the state |
| next | Tarballs | babel-preset-expo worklets option; Expo CLI `EXPO_NO_TELEMETRY` and `adb reverse` source |
| 22:56 (anchored: `date`) | Write | Started writing this file |
| 23:02 (anchored: file mtime) | Write | This file written; then delegation_progress/data_collector.md |
| 23:03–23:05 | Fix | Corrected item count, removed unrecorded per-query times, repaired three table separators |

---

## Gaps / Needs More Data

1. **Official Node 26 Corepack doc:** the page returned 404. Removal evidence rests on Node PRs, issue summaries and local L2.
2. **Official `adb reverse` reference:** the developer.android.com adb page as fetched documented only `adb forward`. The syntax evidence is secondary plus the Expo CLI source.
3. **Emulator `-no-metrics`:** the flag text comes from a third-party issue quoting the emulator banner. The official emulator command-line page as fetched did not list it.
4. **Paid-tier prices:**
   - HeroUI Pro amounts are not shown on the fetched official page. The $249/$399/$799 figures are search-snippet only and unverified.
   - Tamagui Pro/Takeout/Bento prices were not captured.
   - The Uniwind Pro installation mechanism (licence key or private registry) is not stated.
5. **Aceternity UI free-component licence:** the licence page covers purchased items only.
6. **coss ui / Origin UI licence at file level:** the GitHub API rate limit blocked the LICENSE file check. The MIT claim for `apps/ui` is secondary.
7. **gluestack-ui licence file:** the GitHub API reports no licence and no root LICENSE file was listed, although the README states MIT.
8. **UI Kitten:** animation approach and web support were not collected.
9. **Expo account requirement for local builds:** no explicit statement was captured either way. The Expo CLI source was checked only for telemetry and adb reverse, not for login gating.
10. **Motion Primitives Pro, Kokonut UI and Cult UI licences and paid tiers:** not checked.
11. **Rate-limited GitHub metadata:** `honojs/node-ws` returned Not Found; the repo may have moved into a monorepo.
12. **rn-animated-components** (github.com/ogulcanbagatir/rn-animated-components) appeared in search. Its licence and maintenance were not collected (rate limit).
13. **Physical device performance data:** none. All animation evidence is documentation-level.
14. **Discrepancies recorded, not resolved:**
    - RN docs (Platform 35) vs RN 0.86.3 catalog (compileSdk 36).
    - Reanimated docs table (4.5.x on RN 0.86–0.87) vs npm peer range of 4.5.1 (`0.83 - 0.86`).

---
*Generated: 2026-09-30 23:05 WIB*
*Last Updated: 2026-09-30 23:05 WIB*
