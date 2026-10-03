---
task_id: 2026-09-30_dems_demo_stack_setup
task_slug: dems_demo_stack_setup
date: 2026-10-01
agent: data-analyst
type: packaging-spec
decision: D94
narrative_tier: 1
confidence: MEDIUM-HIGH  # HIGH for every fact in §1 (verified on this Mac, in installed packages or in official docs); MEDIUM for runtime behaviour on Windows, Linux and Intel Macs, which cannot be executed on this arm64 Mac (no Rosetta, no Wine, Docker belongs to other workloads)
source_translated_task: /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/identification/01_translated.md
source_structured_task: /Users/gsp-budi/Documents/DEMS/docs/2026-09-30_dems_demo_stack_setup/identification/02_structured.md  # rev 5, rows 62-66 and 94-96
based_on:
  - decisions/decisions.md (D5, D6, D10, D24, D35, D38, D41, D55, D64, D67, D78, D84, D87, D93, D94; DR-44)
  - masterplan/01_specs.md (§1.8, §2.4, §3, §4.2, §5.1, §5.7, §6)
  - implementation/03_mock_core_service.md, 04_core_web_app.md, 40_mobile_deps_native.md, 45_mobile_brand_media.md
  - apps/mobile/app.json, apps/mobile/android/** (generated), apps/core-web/vite.config.ts, apps/mock-core/src/**, packages/shared/src/api/**
feeds: blueprint steps 94, 95, 96 and proposed step 100; reviews 62-65; final commit 66; README (step 60)
last_updated: 2026-10-01 10:05 WIB
---

# 06 Packaging Specification: Android release APK and portable web launchers (D94)

## 0. Scope, 5W1H and conventions

### 0.1 The request

D94, user, verbatim: *"jika sudah versi mobile di build jadi apk installer, dan versi web juga dibuat packagernya. buat semudah mungkin untuk di jalankan di pc lain"*.

In English: once the mobile version is built, turn it into an APK installer. Give the web version a packager too. Make both as easy as possible to run on another PC.

This file is a **specification only**. It was written without building, installing or editing anything outside `docs/`. Every version and flag claim below carries one of these evidence labels:

| Label | Meaning |
|---|---|
| **[local]** | Verified on this Mac by a command whose output is quoted or summarised. |
| **[pkg]** | Read in an installed package or a generated project file (`file:line`). |
| **[doc]** | Read in official vendor documentation (URL in §10). |
| **[2nd]** | Read in a secondary source (URL in §10). Used only where no official page says it. |
| **[H-PK-n]** | Hypothesis. It is not verified. §8.2 names the test that settles it. |

### 0.2 5W1H

| | |
|---|---|
| **What** | (1) A signed Android release APK. (2) Portable web launchers. Each launcher serves the built Core web app, `GET /api/v1/health` and the `/ws` heartbeat from **one** local origin. (3) A git-ignored `release/` folder with checksums and a bilingual run guide. (4) A verification plan. (5) Blueprint rows. |
| **Who** | **Requester:** the user (D94). **End user:** a non-technical presenter, running the demo on another PC and on an Android tablet or phone. **Executors:** steps 94, 95 and 100 (coder-execution) and step 96 (verifier). **Reviewers:** steps 62–65. **Committer:** step 66 (git-specialist). |
| **When** | **Steps 94 and 95** run after step 61, in parallel. **Step 96** runs after both. **Proposed step 100** (the web same-origin switch) runs **before** the end pass (56/58/61), so the end pass covers it (§7.2). **Demo day:** copy the packages at least **one day** early. Android's advanced install flow has a one-time 24-hour wait (§2.9). |
| **Where** | **Build host:** this Mac (`/Users/gsp-budi/Documents/DEMS`, arm64, macOS 27.0.1). **Outputs:** `release/` (git-ignored). **Download cache:** `.cache/release/` (already git-ignored, `.gitignore:44`). **Targets:** Windows 10 and later (x64), macOS 13.5 and later (Apple Silicon and Intel), Linux x64 with glibc 2.28 or later, Android 7.0 (API 24) and later. |
| **Why** | D94 asks for the easiest possible run on other machines. Standing constraints: **D5/D6:** local builds, no accounts, no cloud build. **I2/A6:** confidentiality, no uploads. **D38 Q-M8:** the mobile Core link defaults to Simulated. The web app is simulated in the browser, except the LIVE health endpoint and the heartbeat (D19, D26). |
| **How** | **Read:** the decision log, the specs, the implementation logs and the source. **Verified:** every version and flag, against the installed toolchain and official docs (§1). **Evaluated:** the options in matrices. **Decided:** one choice per question, with the rejected alternatives (§2–§4). **Defined:** acceptance criteria and the step-96 verification plan (§5), the blueprint rows (§6) and the risks (§8). |

### 0.3 Decision summary

| # | Question | Decision | Section |
|---|---|---|---|
| PK-01 | APK build path | `expo prebuild --platform android --no-install` (no `--clean`), then `./gradlew assembleRelease`, under `.locks/gradle.lock`, with no EAS | §2.1 |
| PK-02 | Signing | A local **DEMO** PKCS12 keystore. Its random password sits in a git-ignored `apps/mobile/signing/release-signing.properties`. A local config plugin wires `signingConfigs` so prebuild cannot wipe it. Release builds fail fast if the properties file is missing | §2.2 |
| PK-03 | ABIs | **One universal APK** with `arm64-v8a`, `armeabi-v7a` and `x86_64` | §2.3 |
| PK-04 | Bundle and assets | The release variant embeds the Hermes bytecode bundle and all assets (no Metro). Verified by Hermes magic bytes and by SHA-256 matching of the 84 media files | §2.4 |
| PK-05 | Versioning | `versionName` 0.1.0. `versionCode` = MAJOR×10000 + MINOR×100 + PATCH = **100**. Bump PATCH for every re-release | §2.5 |
| PK-06 | Cleartext | **Simulated-only** packaged demo. No network security config; release stays cleartext-free | §2.6 |
| PK-07 | Manifest hygiene | `allowBackup: false`. Block `SYSTEM_ALERT_WINDOW` and the two storage permissions in release | §2.6 |
| PK-08 | Output | `release/android/DEMS-Demo-0.1.0.apk`. Size 120–170 MB [H-PK-1] | §2.7 |
| PK-10 | Web packaging | **Node SEA single executables** for macOS arm64, Windows x64 and Linux x64. A **runtime bundle** (the official notarized Node, unmodified) for macOS x64. Two fallbacks: a Windows signed-runtime bundle and an any-OS zip that uses an installed Node | §3.1 |
| PK-11 | Launcher | One dependency-free `dems-web-launcher.cjs` (Node built-ins only): static files, health, RFC 6455 heartbeat. Port 4410, falling back to 4411–4419, then an OS-assigned port. Binds 127.0.0.1 only. Opens the browser and prints a banner. Ctrl+C stops it | §3.3 |
| PK-12 | Core URL in the web build | `VITE_DEMS_CORE_ORIGIN=same-origin` at packaging time only. A new `core-endpoint.ts` resolves `window.location.origin`. Vite `base` stays `/`. Dev mode on 5173 is unchanged | §3.4 |
| PK-13 | No external requests | By construction, enforced by CSP, proven in step 96 | §3.5 |
| PK-20 | Release layout | `release/{RUN-ON-ANOTHER-PC.md, android/, web/}`, a `SHA256SUMS.txt` and `BUILD-INFO.txt` per folder, and `.sha256` per file | §4 |

---

## 1. Verified facts register

These facts drive every decision below.

### 1.1 Host and toolchain

| ID | Fact | Evidence |
|---|---|---|
| F-01 | Node **v26.8.2** at `/usr/local/bin/node`. It is a universal Mach-O (x86_64 + arm64), signed with TeamIdentifier `HX7739G8FX`, hardened runtime. Slices: arm64 145,821,472 B, x86_64 148,367,072 B | [local] `node --version`; `file`; `codesign -dv`; `lipo -detailed_info` |
| F-02 | `node --help` lists `--build-sea=...` ("Build a Node.js single executable application") and `--experimental-sea-config` | [local] |
| F-03 | `node:sea` exports `isSea`, `getAsset`, `getRawAsset`, `getAssetAsBlob` and `getAssetKeys` | [local] `node -p "Object.keys(require('node:sea'))"` |
| F-04 | SEA is **Stability 1.1** (active development). `--build-sea` was added in **v25.5.0**. The v26.8.2 config fields are `main`, `mainFormat`, `executable`, `output`, `disableExperimentalSEAWarning`, `useSnapshot`, `useCodeCache`, `execArgv`, `execArgvExtension` (`none`/`env`/`cli`) and `assets`. `useVfs` is **not** in v26.8.2 | [doc] SEA docs v26.8.2 and latest-v26 |
| F-05 | Cross-platform SEA generation is supported through `executable`. In that case `useCodeCache` and `useSnapshot` **must be false** | [doc] SEA docs v26.8.2 |
| F-06 | SEA CI covers Windows, Linux (not Alpine) and **macOS arm64 only**: "x64 is not currently supported and is skipped in the tests" | [doc] SEA docs v26.8.2 |
| F-07 | macOS SEA signing: `codesign --remove-signature`, then `codesign --sign -`. On Windows, `signtool` is optional; "unsigned binary is still runnable" | [doc] SEA docs |
| F-08 | In the SEA main script, `require`/`import` load **built-in modules only**. `__filename` = `process.execPath` | [doc] SEA docs |
| F-09 | The stock Node binary contains the sentinel `NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2:0`. Injection flips it to `:1`, which gives a static proof of injection | [local] `strings -a /usr/local/bin/node`; [doc] SEA docs (fuse) |
| F-10 | Official v26.8.2 archives. SHA-256 from `https://nodejs.org/dist/v26.8.2/SHASUMS256.txt` (fetched 2026-10-01 10:0x WIB):<br>`974b6d5f…c9e1` darwin-arm64.tar.gz (57,818,610 B)<br>`adb8feb2…629c` darwin-x64.tar.gz (59,215,598 B)<br>`badb3fe6…6f35` linux-x64.tar.gz<br>`cf02f5d0…9085` win-x64.zip (41,379,367 B)<br>`23062343…dbca` win-x64/node.exe (103,761,736 B). Full hashes are in §10.2 | [local] `curl … SHASUMS256.txt`, `curl -I` |
| F-11 | Minimum targets for the v26.8.2 binaries:<br>- Linux x64: kernel 4.18 or later, glibc 2.28 or later;<br>- macOS: 13.5 or later (x64 is Tier 2, "until early 2028");<br>- Windows: 10 / Server 2016 or later | [doc] BUILDING.md v26.8.2 |
| F-12 | Not available on this Mac:<br>- **Rosetta** (`arch -x86_64 /usr/bin/true` → "Bad CPU type");<br>- **gpg**, **wine**, `postject`, `electron`.<br>Present:<br>- `codesign`, `spctl`, `xattr`, `ditto`, `zip`, `unzip`, `shasum`, `openssl`;<br>- `docker` 29.8.0 (backed by a running Lima VM that belongs to other workloads);<br>- `cargo`/`rustc` (Homebrew) | [local] |
| F-13 | JDK `openjdk@17` 17.0.20.1. The default keystore type is **pkcs12** (`conf/security/java.security:283`). `keytool -genkeypair` takes `-storetype`, `-dname` and `-validity`. Password options accept the `:env` and `:file` modifiers. PKCS12 tools expect `keypass` = `storepass` | [local] `keytool -genkeypair -help`; [doc] keytool JDK 17 |
| F-14 | build-tools 36.0.0 contains `apksigner` (`--ks-pass pass:|env:|file:`, `--v1..v4-signing-enabled`, `verify --print-certs`), `zipalign` (`-c -P <pagesize_kb>`) and `aapt2` | [local] |
| F-15 | Installed hermesc 250829098.0.17 emits bytecode starting with `c6 1f bc 03 c1 03 19 1f` (bytecode version 0x62) | [local] one-line probe in the scratchpad |
| F-16 | 675 GiB free on the data volume | [local] `df -h` |

### 1.2 Mobile (as built)

| ID | Fact | Evidence |
|---|---|---|
| F-20 | Expo **57.0.26**, @expo/cli 57.0.27, @expo/config-plugins 57.0.9, @expo/prebuild-config 57.0.16, react-native **0.86.3**. AGP 8.12.0, Kotlin 2.1.20, minSdk 24, targetSdk 36, compileSdk 36, build-tools 36.0.0, NDK 27.1.12297006, Gradle wrapper 9.3.1 | [pkg] package.json files; `node_modules/react-native/gradle/libs.versions.toml:3-9,32`; `android/gradle/wrapper/gradle-wrapper.properties` |
| F-21 | `apps/mobile/android/` is **git-ignored and regenerated by prebuild** (CNG). Hand edits are not durable | [pkg] `.gitignore:25`; `apps/mobile/.gitignore` (`/android`) |
| F-22 | `expo prebuild` always clones the template package `expo-template-bare-minimum@sdk-57` from npm, so it needs registry access | [pkg] `@expo/cli/build/src/prebuild/updateFromTemplate.js:82-122`, `resolveTemplate.js:111-115` |
| F-23 | The generated `app/build.gradle` signs **release with the debug keystore**:<br>- `signingConfig signingConfigs.debug` on line 115;<br>- the debug store is `file('debug.keystore')` with password `android`, lines 101-105;<br>- `versionCode 1` / `versionName "0.1.0"`, lines 95-96;<br>- minify off unless `android.enableMinifyInReleaseBuilds`, line 69;<br>- `projectRoot` (= `apps/mobile`), line 5 | [pkg] |
| F-24 | `gradle.properties` sets:<br>- `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64` (line 31; line 30 documents the `-PreactNativeArchitectures=` override);<br>- `newArchEnabled=true` (38);<br>- `hermesEnabled=true` (42);<br>- `expo.useLegacyPackaging=false` (61): native libraries are stored **uncompressed** | [pkg] |
| F-25 | The RN Gradle plugin applies `ndk.abiFilters` from `reactNativeArchitectures`, so the property also filters prebuilt AAR libraries. Release is **not** in `debuggableVariants` (default `["debug","debugOptimized"]`), so its bundle is created and embedded. Default `hermesFlags` are `-O -output-source-map` | [pkg] `@react-native/gradle-plugin/.../NdkConfiguratorUtils.kt:58-62`, `ReactExtension.kt:105-106,126-128` |
| F-26 | Expo config plugin helpers are exported:<br>- `withAppBuildGradle`, `withGradleProperties`, `withAndroidManifest`, `withDangerousMod`, `createRunOncePlugin`;<br>- `AndroidConfig.Version`: `versionCode` defaults to 1 (`Version.js:75`);<br>- `AndroidConfig.AllowBackup`: defaults to true (`AllowBackup.js:26`);<br>- `blockedPermissions` writes `tools:node="remove"` (`Permissions.js:93-97`).<br>No built-in local signing mod exists; only the EAS `eas-build.gradle` pattern | [pkg] `@expo/config-plugins` |
| F-27 | The debug APK on disk:<br>- `com.dems.demo.tablet`, versionCode 1, versionName 0.1.0, minSdk 24, targetSdk 36;<br>- native code for 4 ABIs; 324,503,614 B;<br>- per-ABI libraries (uncompressed): arm64 80.8 MB, x86_64 81.5 MB, x86 82.6 MB, armeabi-v7a 49.7 MB;<br>- dex 61.6 MB uncompressed / 24.4 MB compressed;<br>- **no JS bundle and no media** (debug loads them from Metro) | [local] `aapt2 dump badging`; `unzip -v` |
| F-28 | Main manifest:<br>- **no** `usesCleartextTraffic`;<br>- `allowBackup="true"`;<br>- `SYSTEM_ALERT_WINDOW`, and `READ/WRITE_EXTERNAL_STORAGE` with maxSdk 32.<br>The `debug` and `debugOptimized` manifests set `usesCleartextTraffic="true"` | [pkg] `android/app/src/main/AndroidManifest.xml:3,4,8,16`; `src/debug/AndroidManifest.xml:4,6` |
| F-29 | Both AVDs are `arm64-v8a`, `google_apis` (not Play Store) images, API 36 | [local] `~/.android/avd/dems_{tablet,phone}.avd/config.ini` |
| F-30 | 84 mobile media files (12,646,268 B) are bundled through a static `require` map | [pkg] `implementation/45_mobile_brand_media.md` §1–§2 |
| F-31 | The Core link defaults to `SIMULATED` (`apps/mobile/src/runtime/core-link.ts:24`). Settings shows the Simulated/Heartbeat selector in **all** builds (`features/settings/preferences-section.tsx:62-68`). `HeartbeatProvider` is always mounted, and its default URL is `ws://127.0.0.1:4400/ws` (`providers/app-providers.tsx:110`; `packages/shared/src/realtime/heartbeat-context.tsx:22`). The developer gallery redirects in release (`app/dev-gallery.tsx:51`, `__DEV__`) | [pkg] |
| F-32 | Demo operators: `budi.santoso` (Investigator), `andi.pratama` (Supervisor), `rina.wijaya` (Technician). Synthetic password `demo-2026` | [pkg] `packages/shared/src/sim/dataset.ts:122,131,140,153` |

### 1.3 Web and mock-core (as built)

| ID | Fact | Evidence |
|---|---|---|
| F-40 | The Core URLs are **hard-coded constants**: `CORE_HTTP_ORIGIN = 'http://127.0.0.1:4400'` and `CORE_WS_URL = 'ws://127.0.0.1:4400/ws'`. `WEB_DEV_ORIGINS` = 127.0.0.1:5173 and localhost:5173 | [pkg] `packages/shared/src/api/constants.ts:10,18,27` |
| F-41 | **Consumers of those constants:**<br>- shared `fetchHealth` (`api/health.ts:46-47`, no origin parameter);<br>- the `HeartbeatProvider` default (has a `url` prop);<br>- `createOpenApiDocument` `servers[0].url` (`api/openapi.ts:348-350`);<br>- core-web `__root.tsx:71` (no `url` prop passed);<br>- `features/home/use-health.ts:11`;<br>- `features/api-reference/{index.tsx:50, sim-fetch.ts:51,88, realtime-panel.tsx:6,36,64,73, server-strip.tsx:36,79, service-banner.tsx:30,44, use-realtime-feed.ts:134,139, api-document.ts:107}`;<br>- `features/login/login-model.ts:61` | [pkg] grep |
| F-42 | **Web Sign In is disabled while the heartbeat is offline:** `isCoreBlocked` (`login-model.ts:56`) feeds `isSubmitDisabled` (`:266-267`). So a static-only build served without the heartbeat **cannot sign in** | [pkg] |
| F-43 | `HealthResponseSchema` requires `service: z.literal('dems-mock-core')`, `apiVersion: 'v1'`, `ws.path: '/ws'` and `ws.heartbeatIntervalMs: 1000` (`api/health.ts:23-35`). `HeartbeatSchema` requires `type:'heartbeat'`, `v:1`, `intervalMs:1000` and `sessionState` nullable (`api/realtime-messages.ts:25-33`) | [pkg] |
| F-44 | mock-core binds 127.0.0.1:4400 (`apps/mock-core/src/index.ts:51`). CORS is limited to `WEB_DEV_ORIGINS` (`app.ts:38-44`). The WS Origin allowlist adds the service's own origins (`heartbeat.ts:20,62-67`). It writes `logs/errors.log` next to its source (`error-log.ts:10-15`). It depends on Fastify 5.12.5, which needs pino. `pino` and `thread-stream` are in `node_modules` | [pkg] |
| F-45 | `vite.config.ts`:<br>- dev server 127.0.0.1:5173 `strictPort`; preview 4173;<br>- no `base` (defaults to `/`);<br>- no `build.sourcemap` (defaults to false).<br>Vite 8.3.1 copies every `VITE_*` **process env** key into `import.meta.env` (`node_modules/vite/dist/node/chunks/node.js`, `loadEnv`: `for (const key in process.env) if (prefixes…) env[key] = process.env[key]`). The CLI has `--outDir`, `--emptyOutDir` and `--base` | [pkg] [local] `vite build --help` |
| F-46 | The web glob imports bring in **33,609,536 B in 186 files**:<br>- `demo-media/live` 2.03 MB (8 files);<br>- `demo-media/evidence` 28.80 MB (104);<br>- `demo-evidence` 2.78 MB (74).<br>The mobile subset is never globbed. The current `apps/core-web/dist` (1.9 MB, 03:21) is stale and has no media | [local] `find … stat`; [pkg] `components/media/demo-media.ts:26-32`, `features/evidence/demo-assets.ts:29-36` |
| F-47 | Scalar privacy flags are already set: `telemetry:false`, `withDefaultFonts:false`, no proxy, `agent`/`mcp` disabled (`features/api-reference/scalar-config.ts:7-31`). Scalar's dist contains blob-URL web-worker code (VueUse `useWebWorkerFn`). No `eval(` or `new Function(` was found in the Scalar, Motion or HeroUI dist files | [pkg] grep |
| F-48 | `crypto.subtle` exists only in secure contexts. `127.0.0.0/8`, `::1` and `localhost` are potentially trustworthy, so `http://127.0.0.1:<port>` qualifies and a LAN IP would not | [doc] MDN Secure Contexts; MDN SubtleCrypto |
| F-49 | Ports 4410–4419 had no listener at 10:0x WIB. Ports already in use include 3000 (`*`), 4400 (mock-core when running), 5173–5178, 5199, 8088 and 8091 | [local] `lsof -nP -iTCP -sTCP:LISTEN` |
| F-50 | `sim/demo-alignment.ts` (step 54, in progress) joins demo packages on the case **sequence** and subject, not on the dated parts. Packages built after step 61 therefore work on any demo date (D84) | [pkg] `packages/shared/src/sim/demo-alignment.ts:20,248` |

### 1.4 Platform distribution rules (external)

| ID | Fact | Evidence |
|---|---|---|
| F-60 | **Android developer verification is live from 30 Sep 2026** for users in Indonesia (also Brazil, Singapore and Thailand) on **certified** devices. "Unregistered apps can be sideloaded with Android Debug Bridge (adb) or advanced flow." ADB "remains the standard method for development work" | [doc] Android Developers Blog (Jun 2026); Android Developer Console Help 16561738 |
| F-61 | **Advanced flow (one-time):**<br>1. Enable developer mode.<br>2. Confirm you are not being coached.<br>3. Restart and re-authenticate.<br>4. Wait **one day**, then confirm with biometric or PIN.<br>5. Choose **7 days or indefinitely**.<br>After that, a warning still shows, with **"Install Anyway"** | [doc] developer.android.com blog (19 Mar 2026). [2nd] AndroidAPS docs: the menu is *Developer options > Apps from unverified developers*, delivered by the "Android Developer Verifier" component |
| F-62 | **Free limited-distribution developer accounts** (up to 20 devices, no fee, no ID) exist. They need an account, which **conflicts with D5/D6** | [doc] Help 16561738 |
| F-63 | On Android 8.0+ users enable the per-source **Install unknown apps** screen. On Android 7.1.1 and older, **Unknown sources** is under Settings > Security | [doc] developer.android.com alternative distribution |
| F-64 | Play Protect "may ask you to send unknown apps to Google". A code-level scan uploads app data. The **Improve harmful app detection** setting (Play Store > profile > Play Protect > Settings) auto-sends unknown apps | [doc] Google Play Help 2812853 |
| F-65 | **macOS:** a blocked app opens via *System Settings > Privacy & Security > Open Anyway*. The app is then saved as an exception | [doc] Apple Support 102445 |
| F-66 | **Windows Smart App Control:** "If the app is unsigned, or the signature is invalid, Smart App Control will … block it." "There is currently no way to bypass Smart App Control protection for individual apps." Signed apps run | [doc] Microsoft Support (What is Smart App Control) |
| F-67 | **Windows SmartScreen** checks executables that carry the Mark of the Web (`Zone.Identifier` ADS, ZoneId=3) and shows "Windows protected your PC". Explorer's built-in zip extraction **propagates** the MOTW to every extracted file | [2nd] textslashplain.com "Downloads and the Mark-of-the-Web"; outflank.nl |
| F-68 | **Tauri:** cross-compiling Windows apps on macOS is "possible with caveats" (NSIS only, `cargo-xwin`, LLVM) and "should only be used as a last resort" | [doc] v2.tauri.app windows-installer |
| F-69 | **Docker Desktop** commercial use at 250 or more employees, or USD 10M or more revenue, needs a paid subscription | [doc] docs.docker.com Docker Desktop licence |
| F-70 | **RFC 6455:**<br>- `Sec-WebSocket-Accept` = base64(SHA-1(key + `258EAFA5-E914-47DA-95CA-C5AB0DC85B11`));<br>- the server MUST close on an unmasked client frame, and must not mask its own frames;<br>- lengths are 7-bit, 126 → 16-bit, 127 → 64-bit;<br>- version 13; otherwise 426 with `Sec-WebSocket-Version`;<br>- Ping → Pong with the same data;<br>- close codes 1000/1001/1002/1003/1008/1009/1011 | [doc] RFC 6455 |

---

## 2. Android release APK (step 94)

### 2.1 PK-01 Build path

**Decision:** two commands, both run from `apps/mobile`.

1. `EXPO_NO_TELEMETRY=1 npx expo prebuild --platform android --no-install`
   - This is the existing `prebuild` script. Do **not** pass `--clean`.
   - Network is limited to the npm registry, for the template (F-22).
2. In `apps/mobile/android`, run `./gradlew --no-daemon assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64`, with:
   - `/usr/bin/lockf -k -t 3600 <root>/.locks/gradle.lock` (P2);
   - `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`;
   - `ANDROID_HOME=$HOME/Library/Android/sdk`;
   - `EXPO_NO_TELEMETRY=1`. The bundle task runs `expo export:embed` (`app/build.gradle:20-21`).

**Output:** `android/app/build/outputs/apk/release/app-release.apk`.

**Network:** this runs outside the sandbox, as steps 67 and 72 did (D14, D24). It needs `registry.npmjs.org`, plus the Maven hosts that the release variant may need for artifacts not yet in `~/.gradle` [H-PK-2].

| Rejected | Why |
|---|---|
| EAS Build (cloud or `eas build --local`) | Needs an Expo account and project ID. Violates D5/D6. `eas.json`/`projectId` must stay absent (01_specs §5.1) |
| `npx expo run:android --variant release` | Builds **and installs** on whatever device is attached, and couples the build to device state. Step 94 needs a pure artifact build under the Gradle lock; device work is separate (§5) |
| `expo prebuild --clean` | Deletes `android/` including `app/build/outputs/apk/debug/app-debug.apk`. D78 recovery relies on that hash-verified APK until the mobile lanes finish. Only needed if plain prebuild reports a conflict; the plugin is idempotent (§2.2) |
| `bundleRelease` (AAB) | An AAB cannot be tap-installed. It needs bundletool or Play. Out of scope |

### 2.2 PK-02 Signing with a DEMO keystore

**Files.** All are git-ignored, created once by `apps/mobile/scripts/create-demo-keystore.sh` (owner: step 94):

| Path | Content | Mode |
|---|---|---|
| `apps/mobile/signing/dems-demo-release.p12` | PKCS12 keystore with alias `dems-demo` | 600 |
| `apps/mobile/signing/release-signing.properties` | `storeFile=signing/dems-demo-release.p12`, `storeType=pkcs12`, `keyAlias=dems-demo`, `storePassword=<32 hex>`, `keyPassword=<same>` | 600 |

**Keystore script rules:**

- Refuse to run if either file already exists. Rotation is a deliberate manual delete.
- Generate the password with `openssl rand -hex 16`. It goes into the properties file only. It is never echoed, logged or written to `docs/`.
- Call keytool with the password through the environment (F-13), so it never appears in `ps`:
  ```
  DEMS_KS_PASS=… keytool -genkeypair -v -storetype PKCS12 \
    -keystore signing/dems-demo-release.p12 -alias dems-demo \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=DEMS Demo Release (DEMO ONLY - NOT FOR PRODUCTION), OU=Demo, O=DEMS Demo, C=ID" \
    -storepass:env DEMS_KS_PASS -keypass:env DEMS_KS_PASS
  ```
  The store and key passwords are the same, because PKCS12 tools expect that (F-13).
- Print only `keytool -list -v … -storepass:env` → the **SHA-256 certificate fingerprint**. It is recorded in `release/android/BUILD-INFO.txt` and in the step-94 log.

**Git ignore.** Append to the root `.gitignore`:

```
release/
apps/mobile/signing/
```

The owner is step 100 if adopted (§6), else step 94. `apps/mobile/.gitignore` already ignores `*.p12`, `*.jks` and `*.key`; the root ignores `*.keystore` and `*.jks` (`.gitignore:31-32`). AC: `git check-ignore -q` exits 0 for both paths.

**Gradle wiring.** A local Expo config plugin, `apps/mobile/plugins/with-dems-release-signing.js` (CommonJS, using `withAppBuildGradle` from `expo/config-plugins`), is listed in `app.json` `plugins`. On every prebuild it appends one marked block at the end of `android/app/build.gradle`, unless the marker is already present (idempotent). Reference behaviour:

```groovy
// @dems-release-signing: generated by apps/mobile/plugins/with-dems-release-signing.js (06_packaging_spec §2.2). DEMO key only.
def demsSigningFile = new File(projectRoot, "signing/release-signing.properties")
if (demsSigningFile.exists()) {
    def demsSigning = new Properties()
    demsSigningFile.withInputStream { demsSigning.load(it) }
    android.signingConfigs.create("demsRelease") {
        storeFile new File(projectRoot, demsSigning.getProperty("storeFile"))
        storeType demsSigning.getProperty("storeType", "pkcs12")
        storePassword demsSigning.getProperty("storePassword")
        keyAlias demsSigning.getProperty("keyAlias")
        keyPassword demsSigning.getProperty("keyPassword")
    }
    android.buildTypes.release.signingConfig android.signingConfigs.demsRelease
} else {
    gradle.taskGraph.whenReady { graph ->
        if (graph.allTasks.any { it.project == project && it.name.toLowerCase().contains("release") }) {
            throw new GradleException("DEMS: apps/mobile/signing/release-signing.properties is missing. Run apps/mobile/scripts/create-demo-keystore.sh (06_packaging_spec §2.2).")
        }
    }
}
```

- `projectRoot` is defined by the template (`app/build.gradle:5`).
- The block never touches the debug build type, so debug builds stay exactly as they are.
- Failing fast guarantees that no "release" APK is ever signed with the public debug key (F-23).
- The `taskGraph.whenReady` check assumes the Gradle configuration cache is off, which it is: the generated `gradle.properties` sets no `org.gradle.configuration-cache` (F-24 listing). If a later template enables it, replace the check with a configuration-cache-safe guard task that `preBuild` of the release variant depends on (step 65 to confirm).

| Rejected | Why |
|---|---|
| Edit `android/app/build.gradle` by hand | Lost on the next regeneration (F-21) |
| `android/gradle.properties` | It lives in the regenerated tree, and it would copy the passwords into it |
| `~/.gradle/gradle.properties` (the React Native docs' suggestion) | Host-level and shared by every Gradle project on the Mac. Outside the workspace and the sandbox; a host footprint the user did not ask for |
| `-P` flags or `ORG_GRADLE_PROJECT_*` only | Still needs the build.gradle wiring. `-P` puts the passwords in process arguments |
| Sign afterwards with `apksigner` | Kept as the **documented fallback** (§2.8 step F) in case the plugin path fails. Not primary: the Gradle output would first exist debug-signed |
| EAS-managed credentials | Account (D5/D6) |
| Keep the template's debug signing | The debug key is public and identical across every Expo project, so provenance would be ambiguous |

### 2.3 PK-03 ABI coverage

**Decision:** one universal APK containing `arm64-v8a`, `armeabi-v7a` and `x86_64`. It is set by the Gradle flag, not by editing `gradle.properties` (F-24, F-25).

| ABI | Who needs it |
|---|---|
| `arm64-v8a` | Almost every physical phone or tablet from recent years. The two AVDs on this Mac (F-29). Emulators on Apple Silicon |
| `armeabi-v7a` | Budget and Android Go tablets that run a **32-bit userland** on a 64-bit CPU [H-PK-3]. Without it the tablet reports *App not installed* (`INSTALL_FAILED_NO_MATCHING_ABIS`). Extra cost: about 60 % of the arm64 library size (49.7 vs 80.8 MB in debug, F-27) |
| `x86_64` | Android Emulator on **Intel and AMD PCs** (x86_64 system images) |
| `x86` (32-bit), dropped | Only legacy emulator images [H-PK-4]. Saves about 80 MB uncompressed in debug terms |

| Rejected | Why |
|---|---|
| All 4 ABIs (template default) | Pays for `x86` that no current target needs |
| `arm64-v8a` + `x86_64` only | Fails on 32-bit-userland tablets. A non-technical presenter cannot recover from that on demo day |
| ABI splits (`splits.abi`) | The presenter would have to pick the right file. Each split needs its own versionCode |

**Pre-demo check:** `adb shell getprop ro.product.cpu.abilist` must list at least one of the three ABIs.

### 2.4 PK-04 Embedded JS bundle and assets (Hermes)

The release variant is not debuggable. The RN plugin creates the bundle with `expo export:embed`, compiles it with hermesc `-O` and packages it as `assets/index.android.bundle`. Metro assets go into `res/` (F-25).

- `enableBundleCompression` stays false (`app/build.gradle:17`). The bundle is stored for mmap.
- The `-output-source-map` output stays in `build/` and is **not** shipped.
- No R8 or minify: `android.enableMinifyInReleaseBuilds` and `shrinkResources` stay off.
  - **Rejected:** turning them on. Reflection-based module breakage at the last step is a bigger risk than the size gain.

**Verification (AC-PK-A3, A4):**

- `unzip -l` lists `assets/index.android.bundle`.
- Its first 8 bytes equal `c61fbc03c103191f` (F-15).
- Each of the 84 files in `apps/mobile/assets/media/` has a byte-identical entry in the APK. Check by SHA-256 set inclusion over all `res/**` and `assets/**` entries. This is name-agnostic, because Metro flattens asset names.

### 2.5 PK-05 Versioning

- `expo.version` stays `"0.1.0"`, which becomes `versionName`.
- Add `expo.android.versionCode: 100`.
- **Scheme:** versionCode = MAJOR×10000 + MINOR×100 + PATCH.
- **Every re-release bumps PATCH.** Examples: a rebuild after the `--as-of` re-dating of demo data (D84), or a fix → 0.1.1 / 101. Same key + higher code means `adb install -r` keeps the app data.
- **Owner:** step 94, through a hand-over of the `app.json` version keys (Parallel Execution Protocol, row "Release packaging").
- **File name:** `DEMS-Demo-<versionName>.apk`, here `DEMS-Demo-0.1.0.apk`.

### 2.6 PK-06 Cleartext policy and PK-07 manifest hygiene

**PK-06 decision: no network security config. The packaged APK is a Simulated-only demo.** Reasons:

1. **Nothing to reach on a real tablet.** Heartbeat mode targets the constant `ws://127.0.0.1:4400/ws` (F-31). On a physical tablet that is the tablet itself, where no mock-core runs. On the dev Mac, mock-core binds 127.0.0.1 only (F-44), so even a LAN URL could not reach it.
2. **A LAN option would add scope.** It would need new UI and code (a configurable Core URL), LAN cleartext exposure and a review, which D94 does not ask for.
3. **Release is already compliant.** The release manifest stays cleartext-free (F-28; AC-26 unchanged).

**Consequences** [H-PK-5]:

- In release, the always-mounted heartbeat client attempts `ws://127.0.0.1:4400/ws` and the health poll attempts `http://127.0.0.1:4400`. Android's cleartext policy is expected to block both (logcat `CLEARTEXT communication … not permitted`). This is **loopback only, not egress**. The client keeps its backoff (500 ms … 8 s).
- Selecting **Heartbeat** in Settings shows the Core OFFLINE, and the session precheck blocks (MA-10).
- **Routed to step 91** (mobile remediation, still pending): in release (`!__DEV__`) builds, render the HEARTBEAT option disabled, with the hint "Developer setup only (adb reverse to mock-core)". This is a one-line change in `features/settings/preferences-section.tsx` through the owner hand-over. If step 91 does not adopt it, the install guide tells the presenter to leave **Simulated** selected.

| Rejected | Why |
|---|---|
| Network security config allowing cleartext to `127.0.0.1`/`localhost` only | Helps only an emulator with `adb reverse` to a running mock-core, which is the developer workflow the debug build already covers. Adds a plugin and a review item for no demo value |
| LAN cleartext with a configurable Core URL | New feature, LAN exposure, and mock-core is loopback-bound anyway |

**PK-07 decision (SHOULD; revert an item if any step-96 smoke flow fails).** Add to `app.json`:

- `android.allowBackup: false`. This blocks `adb backup` and cloud backup of the demo state (prefs, synthetic audit log). Expo default is true (F-26).
- `android.blockedPermissions: ["android.permission.SYSTEM_ALERT_WINDOW", "android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE"]`.
  - The app uses neither (no `expo-file-system` / `expo-sharing` in `apps/mobile/package.json`).
  - The debug source-set manifest declares `SYSTEM_ALERT_WINDOW` itself (F-28) and has higher merge priority, so debug builds are expected to keep it for the RN dev overlay [H-PK-6].

**AC:** `aapt2 dump permissions` on the release APK lists `USE_BIOMETRIC`, `USE_FINGERPRINT`, `VIBRATE` and `INTERNET`, and none of the three blocked ones. `aapt2 dump xmltree --file AndroidManifest.xml` shows `allowBackup=false` and no `usesCleartextTraffic=true`.

### 2.7 PK-08 Output and expected size

- **Release output:** `release/android/DEMS-Demo-0.1.0.apk`, plus `DEMS-Demo-0.1.0.apk.sha256`, `SHA256SUMS.txt`, `BUILD-INFO.txt` and `INSTALL-ANDROID.md` (§4).
- **Size: 120–170 MB [H-PK-1].** The estimate is derived from F-27 and F-30:

| Part | Estimate |
|---|---|
| Native libraries, release, stored uncompressed (debug arm64 is 80.8 MB) | arm64 ≈ 30–40 MB, armeabi-v7a ≈ 20–26 MB, x86_64 ≈ 32–42 MB |
| dex, compressed, no R8 | ≈ 15–24 MB |
| Hermes bundle, stored | ≈ 8–15 MB |
| Media | 12.6 MB |
| Images and fonts | ≈ 3 MB |

Step 94 records the measured size and replaces this estimate.

**Free storage needed on the device:** about 2× the APK during installation [H-PK-7].

### 2.8 Build procedure (step 94; script `apps/mobile/scripts/build-release-apk.sh`)

| Step | Action | Pass condition |
|---|---|---|
| A | Preflight:<br>- the properties file and keystore exist (else run the keystore script once);<br>- `git check-ignore -q` for `release/x` and `apps/mobile/signing/x`;<br>- no mobile lane holds `gradle.lock`;<br>- `app.json` has versionCode 100 and the plugin entry | all true |
| B | `prebuild` (§2.1) | The marker `@dems-release-signing` appears exactly **once** in `android/app/build.gradle`, also after a second prebuild run (idempotence) |
| C | `assembleRelease` under the lock (§2.1) | exit 0; lock released; `./gradlew --stop` or `--no-daemon` leaves no daemon |
| D | Copy to `release/android/DEMS-Demo-0.1.0.apk`. Write the `.sha256`, `SHA256SUMS.txt` and `BUILD-INFO.txt` | `shasum -a 256 -c` OK |
| E | Static checks (AC-PK-A1..A7) | all PASS |
| F | **Fallback only, if B/C cannot sign:**<br>1. build unsigned;<br>2. `zipalign -c -P 16 -v 4`;<br>3. `apksigner sign --v1-signing-enabled false --v2-signing-enabled true --v3-signing-enabled true --v4-signing-enabled false --ks signing/dems-demo-release.p12 --ks-key-alias dems-demo --ks-pass file:<tmp> --key-pass file:<tmp>`. The password file is created with `umask 077` and deleted afterwards.<br>Record a drift entry | same ACs |
| G | Launch smoke on `dems_phone`:<br>- `NO_METRO=1 apps/mobile/scripts/device-session.sh phone '…'` (D55, outside the sandbox, D24);<br>- `adb uninstall com.dems.demo.tablet` (the signatures differ, so the debug app must go);<br>- `adb install`; `adb reverse --remove-all`; launch; screencap of Login | Login visible; no `FATAL EXCEPTION` in logcat |

**BUILD-INFO.txt (android)** records:

- `versionName` and `versionCode`;
- the ABIs (from `aapt2 dump badging` `native-code`);
- the APK SHA-256 and size;
- the signer DN and certificate SHA-256 (from `apksigner verify --print-certs`);
- the signature schemes verified;
- the Expo, RN and Hermes versions;
- `git rev-parse HEAD` plus the dirty-file count;
- the demo-data `--as-of` value in use (D84);
- the build start and end times (WIB);
- the JDK, AGP and Gradle versions.

### 2.9 Install guide content (`release/android/INSTALL-ANDROID.md`, EN with an ID summary; written by step 94)

Required sections and exact content:

1. **What you need.**
   - Android **7.0 or newer**.
   - About **400 MB** free [H-PK-7].
   - An ARM 64/32-bit device or an x86_64 emulator.
   - For Method A: a laptop with Google's *SDK Platform-Tools*. It is a download from developer.android.com. Do **not** redistribute it in `release/`, because the SDK licence restricts redistribution [H-PK-8].
2. **Method A, recommended (works in Indonesia after 30 Sep 2026 with no waiting period; F-60). ADB from a laptop:**
   1. On the tablet: *Settings > About tablet > tap Build number seven times* (Developer options).
   2. *Developer options > USB debugging* on.
   3. Connect USB and accept the **Allow USB debugging?** RSA prompt [doc].
   4. On the laptop: `adb devices` must show `device`.
   5. `adb install -r DEMS-Demo-0.1.0.apk`.
   6. If an older DEMS build signed with another key is present (for example the developer debug build), the install fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`. Run `adb uninstall com.dems.demo.tablet` first. This removes that app's local demo data.
3. **Method B, tap-install (no laptop):**
   1. Copy the APK to the tablet by USB file transfer.
   2. Open it in *Files* and allow **Install unknown apps** for Files when asked (Android 8+; F-63).
   3. **On a Play-certified device in Indonesia, Brazil, Singapore or Thailand after 30 Sep 2026**, a DEMO-signed app counts as from an *unverified developer*. Complete the **advanced flow at least one day before the demo** (F-61): *Developer options > Apps from unverified developers*, confirm, restart, wait 24 h, confirm with PIN or fingerprint, choose **7 days** (recommended: it limits the exposure), then **Install anyway**.
   4. If the menu is missing, the device has not received the verifier component yet. Use Method A.
4. **Play Protect.**
   - If *App scan recommended* or *Send app for scanning?* appears, choose the option that installs **without** sending the app. The exact label varies [H-PK-9].
   - Optionally turn off *Improve harmful app detection* on the demo device. Keep *Scan apps with Play Protect* on.
   - Reason: confidentiality (I2; F-64). The app must not be uploaded anywhere.
5. **First run.**
   - Splash, then Login.
   - Tap a demo operator row, or type `budi.santoso` / `andi.pratama` / `rina.wijaya` with password `demo-2026` (F-32). The list is hidden in presentation mode.
   - **Biometric sign-in is optional.** It needs a fingerprint enrolled on the device plus one password sign-in to bind it (`implementation/47_mobile_login.md` §2.2, DR-S75-7).
   - **Core link = Simulated** (default). Everything works offline and in airplane mode. Leave it on Simulated: Heartbeat mode needs the developer Mac and shows OFFLINE in the packaged app (§2.6).
   - The tablet and the web console run **separate simulators** (Q-M4, D38).
6. **Update or uninstall.**
   - Same key and higher versionCode: `adb install -r` keeps the data.
   - Uninstall: *Settings > Apps > DEMS Tablet Demo > Uninstall*.
7. **Troubleshooting:**

| Symptom | Cause | Fix |
|---|---|---|
| *App not installed* / `INSTALL_FAILED_NO_MATCHING_ABIS` | Device ABI not in the APK | Run `getprop ro.product.cpu.abilist` and report the result |
| *App not installed* / `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Another DEMS build signed with a different key is installed | Uninstall it first |
| *Install blocked: unverified developer* | Developer verification (F-60) | Method A, or the advanced flow |
| Storage error | Not enough free space | Free about 400 MB |
| Video black | [H-PK-10] | Note the screen and report it |

8. **Ringkasan (Bahasa Indonesia).** Eight to ten lines covering Method A, Method B with the 24-hour note, the demo operator password and *Simulated*.

### 2.10 Step 94 acceptance criteria

| AC | Check | Pass condition |
|---|---|---|
| AC-PK-A1 | `apksigner verify --verbose --print-certs` | "Verified" with v2 = true (v3 reported). Exactly one signer. DN contains `DEMO ONLY`. Certificate SHA-256 equals BUILD-INFO. Not the debug key: DN ≠ `CN=Android Debug` |
| AC-PK-A2 | `aapt2 dump badging` | `versionCode='100' versionName='0.1.0'`; `native-code: 'arm64-v8a' 'armeabi-v7a' 'x86_64'` (no `x86`); no `application-debuggable` |
| AC-PK-A3 | `unzip -l` plus the first 8 bytes of the bundle | `assets/index.android.bundle` present; magic `c61fbc03c103191f` |
| AC-PK-A4 | SHA-256 set inclusion | 84/84 mobile media hashes found among the APK entries |
| AC-PK-A5 | Manifest (§2.6) | No cleartext. `allowBackup=false`. The blocked permissions are absent |
| AC-PK-A6 | `zipalign -c -P 16 -v 4` | "Verification successful" (16 KB page alignment for uncompressed `.so` files) |
| AC-PK-A7 | `git check-ignore -q` for `release/x` and `apps/mobile/signing/x`; `git status --porcelain` | Both exit 0. Status lists neither path |
| AC-PK-A8 | No password in the step log, docs or `release/` | The reviewer greps for the properties value: `grep -rF "<pw>" docs release` prints nothing. Run by step 63, never by the logger itself |
| AC-PK-A9 | §2.8 G | Login screencap on `dems_phone`, with no Metro and no reverse rules |

---

## 3. Web packager (steps 95 and 100)

### 3.1 PK-10 Option evaluation and recommendation

**Requirement recap:**

- **Non-technical presenter:** double-click, no install, works offline.
- **One origin:** the app, the health endpoint and `/ws` (Login needs the live heartbeat, F-42).
- **No external requests, no accounts** (D5/D6).
- **Buildable** on this arm64 Mac.

| Criterion (weight) | (a) Node SEA single file | (a′) Runtime bundle (official Node, unmodified, plus script) | (b) Zip + scripts, Node installed | (c) Docker image | (d) Electron / Tauri | (e) Static `dist` only |
|---|---|---|---|---|---|---|
| No install on target (5) | yes | yes | **no** (Node ≥ 22) | **no** (Docker Desktop, admin; F-69) | yes | needs some HTTP server |
| One file, robust to "run from inside the zip" (3) | **yes**: assets embedded | no: a folder | no | n/a | yes, as an installer | no |
| Login works, heartbeat on one origin (5) | yes | yes | yes | yes | yes, with a server inside | **no**: Sign In disabled (F-42) |
| OS coverage from this Mac (4) | Windows x64, Linux x64, macOS arm64. **Not macOS x64** (F-06) | all 4 (no injection) | all | Linux containers only | Tauri: Windows cross-build is "last resort" (F-68). Electron: per-OS packaging | all |
| Signature friction (3) | ad-hoc on macOS, unsigned on Windows: Gatekeeper / SmartScreen once; **blocked by Smart App Control** (F-66) | keeps Node's Developer ID + notarization and Authenticode [H-PK-11]; the start script may still prompt [H-PK-12] | installed Node is signed | n/a | same signing problems as SEA | n/a |
| New dependencies / supply chain (3) | none: official Node and built-ins | none | none | base image | large npm (Electron) or Rust crates (Tauri) tree; P1 npm slot | none |
| Verifiable on this Mac (2) | macOS arm64 runtime; others static only | macOS x64 static; logic runtime-tested through (b) | yes, with local Node 26 | needs the user's Docker VM (other workload) | partial | yes |
| Size per OS (1) | ≈ 85–95 MB zipped [H-PK-13] | ≈ 85–95 MB | ≈ 38 MB | > 100 MB image | ≥ 100 MB | ≈ 38 MB |

**Recommendation (PK-10)**, one primary package per OS, chosen by what each OS supports:

| Target | Primary package | Technology | Why |
|---|---|---|---|
| Windows x64 | `DEMS-Web-Demo-0.1.0-windows-x64.zip` → `DEMS Web Demo.exe` | **SEA** | Single file. Runs even when double-clicked inside Explorer's zip view, because the assets are embedded [H-PK-14] |
| macOS Apple Silicon | `DEMS-Web-Demo-0.1.0-macos-arm64.zip` → `DEMS Web Demo` | **SEA** (ad-hoc signed) | Supported (F-06). Runtime-verifiable here |
| Linux x64 | `DEMS-Web-Demo-0.1.0-linux-x64.tar.gz` → `dems-web-demo` | **SEA** | Supported. tar keeps the exec bit |
| macOS Intel | `DEMS-Web-Demo-0.1.0-macos-x64.zip` → `DEMS Web Demo (Intel).command` + `runtime/node` + `app/` | **Runtime bundle** | SEA is not supported on macOS x64 (F-06). The official binary stays notarized |

**Fallbacks** (named in the guide's troubleshooting section only):

| Fallback | Package | When |
|---|---|---|
| F1 | `DEMS-Web-Demo-0.1.0-windows-x64-signed-runtime.zip` → `Start DEMS Web Demo.cmd` + `runtime\node.exe` (official, Authenticode-signed, byte-identical to SHASUMS `win-x64/node.exe`) + `app\` | Windows PCs with **Smart App Control** on, or allowlisting that blocks the unsigned SEA (F-66) |
| F2 | `DEMS-Web-Demo-0.1.0-any-os-node.zip` → `app/` + `Start (Windows).cmd`, `Start (macOS).command`, `start-linux.sh` | Any PC that already has Node.js 22 or newer. This replaces the "plain static dist zip" of D94 / row 95: a plain static `dist` **cannot sign in** (F-42), and this zip *is* the static dist plus the 1-file server |

**Rejected:**

| Rejected | Why |
|---|---|
| (c) Docker | Needs Docker Desktop on the target (install, admin rights, licence threshold F-69). Not "easy" |
| (d) Electron / Tauri | Adds a large dependency tree and an npm slot (P1), or a Rust/NSIS/LLVM cross toolchain (F-68). Same signing friction. Tauri renders with WebKit on macOS and Linux, which is untested here. The browser already exists on every target |
| (e) static `dist` only | Login is blocked without the heartbeat (F-42). `file://` also breaks module scripts and the router [H-PK-15] |
| Bundle Fastify mock-core into the SEA | Fastify needs pino. pino transports use worker files (`thread-stream`), which a SEA cannot load from disk (F-08, F-44). mock-core also writes log files next to itself |
| "Serve on port 4400 so the hard-coded constants just work" | Zero web changes, but a busy 4400 would silently break Login. It also conflicts with mock-core on the dev Mac |
| Third-party SEA tools (pkg, nexe, postject) | Not installed (F-12). Node 26 has `--build-sea` built in (F-02, F-04) |

### 3.2 SEA build facts, signing and per-OS first-run friction

**Base binaries (PK-15):**

- Download only from `https://nodejs.org/dist/v26.8.2/`, into `.cache/release/node-v26.8.2/`.
- Verify each archive against `SHASUMS256.txt`, **fail closed** (F-10).
- Extract `bin/node` (darwin, linux) or `node.exe`, plus `LICENSE`.
- The builder's Node (F-01) and the embedded Node are the **same version** (26.8.2), so the SEA blob format matches.
- **Residual risk:** the GPG signature on `SHASUMS256.txt` is not checked (gpg is absent, F-12; installing it is a host change nobody asked for). BUILD-INFO records the SHA-256 of `SHASUMS256.txt` itself.

**SEA config per target** (generated by the packager into `.cache/release/sea/<target>/sea-config.json`):

```json
{
  "main": "<root>/apps/mock-core/standalone/dems-web-launcher.cjs",
  "mainFormat": "commonjs",
  "executable": "<root>/.cache/release/sea/<target>/base-node[.exe]",
  "output": "<root>/.cache/release/sea/<target>/<DEMS Web Demo|DEMS Web Demo.exe|dems-web-demo>",
  "disableExperimentalSEAWarning": true,
  "useSnapshot": false,
  "useCodeCache": false,
  "execArgvExtension": "none",
  "assets": { "web-manifest.json": "<abs>", "web/index.html": "<abs>", "web/assets/…": "<abs>" }
}
```

| Setting | Reason |
|---|---|
| `useSnapshot` / `useCodeCache` false | Mandatory for cross-builds (F-05). Kept false on macOS too, for one uniform recipe |
| `execArgvExtension: "none"` | `NODE_OPTIONS` on the presenter's PC cannot inject flags or `--require` code into the launcher |
| CommonJS main | The SEA default. No transform step, so the embedded file is byte-identical to the tested source |

**Build commands per SEA target:**

```
macOS arm64:
  codesign --remove-signature base-node
  node --build-sea sea-config.json
  codesign --sign - --force "DEMS Web Demo"
  codesign --verify --strict --verbose=2 "DEMS Web Demo"

Windows x64 / Linux x64:
  node --build-sea sea-config.json
```

No signing on Windows or Linux: there is no certificate, and buying one would be an account (D5/D6).

**Static proof of injection (all SEA targets):**

- `grep -a -c 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2:1'` ≥ 1 (F-09).
- The launcher's build marker `DEMS_WEB_LAUNCHER_BUILD=0.1.0` is found by `grep -a`. The main script is embedded as source, because code cache is off.

**First-run friction and the exact user workaround:**

| OS | What the user sees | Workaround (in RUN-ON-ANOTHER-PC.md) |
|---|---|---|
| macOS, downloaded (browser, AirDrop, chat) and therefore quarantined | Gatekeeper refuses the ad-hoc-signed binary (expected `spctl` result: *rejected*; step 96 checks it) | **Option 1:** double-click once → *Done* → *System Settings > Privacy & Security* → **Open Anyway** → confirm *Open* (F-65). **Option 2 (Terminal):** `xattr -dr com.apple.quarantine ~/Downloads/DEMS-Web-Demo-0.1.0-macos-arm64` |
| macOS, copied from a USB stick | Usually no quarantine, so no prompt [H-PK-16] | none |
| Windows, downloaded and extracted with Explorer (MOTW propagates, F-67) | SmartScreen: "Windows protected your PC" | **More info → Run anyway.** Or before running: right-click the zip → *Properties* → tick **Unblock** → OK → extract again [H-PK-17] |
| Windows with **Smart App Control** on | The SEA exe is blocked, with no override (F-66) | Use fallback **F1**: the official signed `node.exe` |
| Windows from FAT32/exFAT USB | No `Zone.Identifier` ADS (those file systems cannot store it), so no SmartScreen prompt [H-PK-17] | none |
| Linux | No prompt | `tar xzf …; cd …; ./dems-web-demo` from a terminal. File managers may not run binaries on double-click [H-PK-18] |
| Firewall | A listener bound to 127.0.0.1 only is expected not to trigger the Windows or macOS firewall prompt [H-PK-19] | If one appears, choosing *Cancel* / *Deny* is fine (loopback is unaffected) |

### 3.3 PK-11 Launcher design: `apps/mock-core/standalone/dems-web-launcher.cjs`

**Why this location.** The launcher is the zero-dependency, packaged stand-in for mock-core's contract (health plus heartbeat) plus static serving. mock-core's vitest (node environment, `test/**/*.test.ts`) and its `ws` 8.22.0 devDependency test it against the **shared zod schemas**, with no new install.

**Language.** Plain CommonJS with `// @ts-check` and JSDoc types, checked by a local `apps/mock-core/standalone/tsconfig.json` (`allowJs`, `checkJs`, `noEmit`, `types: ["node"]`). This is a deliberate exception to "TypeScript everywhere": the SEA embeds this exact file with no build step (provenance), and Node built-ins are the only imports (F-08).

**Hard rules:**

- `require` only `node:*` modules.
- **No outbound network** except the loopback self-test and single-instance probe.
- **No files written:** no logs, no temp files. The app may run from Downloads or a read-only USB stick.
- **No environment-variable configuration.**

**Asset source** (one code path, two loaders):

| Mode | Detection | Loading |
|---|---|---|
| SEA | `require('node:sea').isSea()` (guard with try/catch for Node versions without `node:sea`) | `getAssetKeys()`. Keys under `web/` become URL paths. Bodies come from `getRawAsset()`, zero-copy and read-only (F-03) |
| Runtime / any-OS | `path.join(__dirname, 'web')` | At startup, walk the directory once (regular files only, no symlinks), read the files into memory (≈ 38 MB) and build the map |
| Both | — | Load `web-manifest.json`: path → `{ size, sha256, type }`. Requests are **looked up in the map**. A filesystem path is never built from a URL, so path traversal is impossible by construction |

**HTTP contract** (bind `127.0.0.1` only; there is no option to bind another interface):

| Request | Response |
|---|---|
| `GET`/`HEAD /api/v1/health` | 200 `application/json`, `Cache-Control: no-store`, header `X-DEMS-Launcher: 0.1.0`. Body exactly per `HealthResponseSchema` (F-43): `status:'ok'`, `service:'dems-mock-core'`, `version:'0.1.0'`, `apiVersion:'v1'`, `serverTime` (ISO UTC), `uptimeMs`, `ws:{path:'/ws', heartbeatIntervalMs:1000, clients}` |
| `GET /ws` with `Upgrade: websocket` | RFC 6455 handshake (F-70). **Origin allowlist:** `http://127.0.0.1:<port>`, `http://localhost:<port>`, or absent (non-browser self-test); otherwise 403. `Sec-WebSocket-Version` ≠ 13 → 426 plus `Sec-WebSocket-Version: 13`. No extensions or subprotocols are negotiated. An immediate heartbeat on connect, then 1 Hz from a global ticker; `seq` is global; the frame matches `HeartbeatSchema` with `sessionState:null`. At most 32 clients; the 33rd upgrade is refused with HTTP 503 |
| `GET /ws` without upgrade | 426 |
| `GET`/`HEAD /api/*` (other) | 404 `{"error":"not_found"}`. The simulated endpoints are answered in the browser (sim-fetch, F-41) |
| `GET`/`HEAD` asset in the map | 200, 206 (single `Range: bytes=a-b` / `a-` / `-n`) or 304 (`If-None-Match` against the strong ETag = the manifest SHA-256). `Accept-Ranges: bytes`. Unsatisfiable → 416 + `Content-Range: bytes */<size>`. Multi-range → 200 full. **Range support is required:** video seeking and the Evidence sync of VIDEO-01/02 + MIC tracks |
| `GET`/`HEAD` other path whose last segment has no dot | `index.html`, `Cache-Control: no-cache` (SPA fallback for `/dashboard`, `/evidence/…` reloads) |
| Other paths | 404 `text/plain` |
| Other methods | 405, `Allow: GET, HEAD` |
| `Host` not in {`127.0.0.1:<port>`, `localhost:<port>`} | 421. This protects against DNS rebinding |

**Caching:** `/assets/*` (Vite-hashed) gets `Cache-Control: public, max-age=31536000, immutable`.

**MIME map:**

| Extension | Content-Type |
|---|---|
| `html` | `text/html; charset=utf-8` |
| `js` | `text/javascript; charset=utf-8` |
| `css` | `text/css; charset=utf-8` |
| `json`, `sig` | `application/json` |
| `jsonl` | `application/x-ndjson` |
| `svg` | `image/svg+xml` |
| `woff2` / `woff` | `font/woff2` / `font/woff` |
| `png` / `jpg` / `webp` / `ico` | the matching `image/*` type |
| `mp4` | `video/mp4` |
| `m4a` | `audio/mp4` |
| `zip` | `application/zip` |
| `wasm` | `application/wasm` |
| default | `application/octet-stream` |

**Security headers on every response:**

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; worker-src 'self' blob:;
  connect-src 'self' ws://127.0.0.1:<port> ws://localhost:<port>; object-src 'none'; base-uri 'self';
  form-action 'self'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

- `style-src 'unsafe-inline'` is needed for Motion and the inline style attributes.
- `worker-src blob:` covers Scalar's worker code (F-47).
- Step 95 walks all 10 pages and the Start Session flow and collects `securitypolicyviolation` events. A violation may only be fixed by widening **that one directive**, with a recorded reason. `default-src`/`connect-src` are never opened to external hosts.

**WebSocket details:**

- Server frames are unmasked, FIN, text.
- Client frames must be masked; otherwise close 1002.
- Ping → Pong with the same payload. Close → echo close, then end.
- Text or binary data is ignored up to 65,536 B (the mock-core `maxPayload` parity); above that, close 1009.
- Fragmented frames → close 1003.
- Shutdown → close 1001 for every client.

**Ports:**

- Try `4410`. On `EADDRINUSE`, first probe `GET http://127.0.0.1:4410/api/v1/health` (1 s timeout).
  - If the response has `X-DEMS-Launcher`, **another launcher is already running**: print its URL, open the browser to it and exit 0 (single instance).
  - Otherwise try 4411…4419, then port `0` (OS-assigned).
- `--port <n>` is strict: fail with a message if the port is busy.
- localStorage and sessionStorage are per origin, so a different port starts with a fresh demo state. The guide says so.

**Browser opening:**

- After `listening`, spawn detached with stdio ignored and errors swallowed:

| OS | Command |
|---|---|
| macOS | `open <url>` |
| Windows | `cmd.exe /d /s /c start "" "<url>"` (`windowsVerbatimArguments`; the URL holds only `[0-9a-z.:/]`) |
| Linux | `xdg-open <url>` |

- On failure, print "Open this address in Chrome or Edge: <url>".
- `--no-open` skips opening.
- The URL always uses `127.0.0.1`, never `localhost` (D41(f): `localhost` may resolve to `::1`).

**Banner (ASCII only; Windows consoles):**

```
==================================================================
 DEMS Web Demo 0.1.0  -  DEMO, simulated data, works offline
 Open in Chrome or Edge:  http://127.0.0.1:4410/
 Core health:  /api/v1/health (LIVE)   Heartbeat:  /ws (1 per second)
 Listening on 127.0.0.1 only - other computers cannot connect.
 To stop: press Ctrl+C or close this window.
 Untuk berhenti: tekan Ctrl+C atau tutup jendela ini.
==================================================================
```

Request logging is quiet by default: errors only, to stderr.

**Stop:**

- `SIGINT`, `SIGTERM` and `SIGHUP` (Windows console close) → close 1001 to the WS clients → `server.close()` → exit 0.
- A 2-second hard timeout applies. A second Ctrl+C exits immediately.
- On a fatal startup error in an interactive console (`process.stdin.isTTY`), print the error and **"Press Enter to close"**. The Windows window must not vanish before the user can read it.

**CLI flags:**

| Flag | Effect |
|---|---|
| `--version` | Prints `DEMS Web Demo 0.1.0 (node v26.8.2, sea|runtime, <platform>-<arch>)` |
| `--help` | Usage |
| `--no-open` | Do not open the browser |
| `--port <n>` | Strict port |
| `--self-test` | No browser. Bind port 0, recompute every asset SHA-256 against the manifest, `GET /api/v1/health` (schema-shaped), `GET /`, perform a raw WS handshake and parse the first heartbeat. Print a JSON summary and exit 0, or exit 1 on failure. The presenter can run it on the target PC |

**Shared-contract guard** (`apps/mock-core/test/standalone-launcher.test.ts`):

- The launcher's constants (`/api/v1/health`, `/ws`, 1000 ms, `dems-mock-core`, `v1`) equal `@dems/shared/api`.
- Health parses with `HealthResponseSchema` and heartbeats with `HeartbeatSchema`, using a real `ws` client.
- Covered: origin rejection, Host rejection, 405, 206/416/304, SPA fallback, `/../` and `%2e%2e` traversal → 404, port fallback, single-instance exit, SIGTERM → exit 0, close 1001, unmasked frame → 1002, oversize → 1009.

This is the allowed duplication (review 64): the health and heartbeat builders plus WS framing, about 150 lines, guarded by these tests.

### 3.4 PK-12 How the web build gets its Core URL (proposed step 100; fallback: inside step 95)

**Mechanism:**

- The env var **`VITE_DEMS_CORE_ORIGIN`**, with the only meaningful value `same-origin`.
- It is set only by the packager: `VITE_DEMS_CORE_ORIGIN=same-origin vite build …`. Vite copies `VITE_*` process env into `import.meta.env` (F-45).
- No `.env.*` file is used. The root `.gitignore:38` ignores them, and a file would leak into dev mode.

**New module `apps/core-web/src/lib/core-endpoint.ts`** (functions, evaluated at call time):

| Export | Value |
|---|---|
| `isSameOriginCore()` | `import.meta.env.VITE_DEMS_CORE_ORIGIN === 'same-origin'` |
| `coreHttpOrigin()` | same-origin ? `window.location.origin` : `CORE_HTTP_ORIGIN` |
| `coreWsUrl()` | same-origin ? `` `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${WS_PATH}` `` : `CORE_WS_URL` |
| `allowedPageOrigins()` | same-origin ? `[window.location.origin]` : `WEB_DEV_ORIGINS` |

**Typing:** a new `apps/core-web/src/env.d.ts` declares `interface ImportMetaEnv { readonly VITE_DEMS_CORE_ORIGIN?: string }`. `tsconfig.app.json` already has `"types": ["vite/client"]`.

**Call sites switched** (F-41; owner hand-overs from steps 38, 41, 43 and 53):

| File | Change |
|---|---|
| `routes/__root.tsx:71` | `url={coreWsUrl()}` |
| `features/home/use-health.ts` | `fetchHealth(undefined, coreHttpOrigin())` |
| `features/api-reference/service-banner.tsx` | `fetchHealth(undefined, coreHttpOrigin())` |
| `features/api-reference/sim-fetch.ts` | Resolve `coreHttpOrigin()` inside `createSimAwareFetch` (no module-level constant) |
| `features/api-reference/use-realtime-feed.ts` | URL and `originAllowed` from `coreWsUrl()` / `allowedPageOrigins()` |
| `features/api-reference/realtime-panel.tsx` | Shows `coreWsUrl()` and `allowedPageOrigins()[0]` |
| `features/api-reference/server-strip.tsx`, `index.tsx` | Show `coreHttpOrigin()` |
| `features/api-reference/api-document.ts` | `createOpenApiDocument({ includeSimulated, serverUrl: coreHttpOrigin() })` |
| `features/login/login-model.ts` | `coreAddress(origin = coreHttpOrigin())` |

**Backward-compatible shared changes** (mobile and mock-core are unaffected: the defaults are unchanged):

- `packages/shared/src/api/health.ts`: `fetchHealth(fetchImpl = fetch, origin: string = CORE_HTTP_ORIGIN)`.
- `packages/shared/src/api/openapi.ts`: `CreateOpenApiDocumentOptions.serverUrl?: string` (default `CORE_HTTP_ORIGIN`), used for `servers[0].url` and the two description strings (`openapi.ts:150,175`).

**Vite settings:**

- `base` stays **`/`** (the default; F-45). The launcher serves at the root, and deep links need absolute `/assets/…`. `base: './'` breaks nested routes.
- `build.sourcemap` stays false: no `.map` files ship.
- The output goes to `<root>/.cache/release/web-dist` via `--outDir … --emptyOutDir` (F-45).

**Dev mode is unchanged:** `npm run dev` does not set the variable, so the app keeps `127.0.0.1:4400` and the mock-core CORS allowlist (5173). New tests (`core-endpoint.test.ts` with `vi.stubEnv`, plus the shared `fetchHealth` origin and `serverUrl` tests) prove both modes. The existing suites stay green unchanged.

### 3.5 PK-13 No external requests

**By construction:**

1. Fonts are bundled through `@fontsource-variable` (local woff2).
2. Scalar runs with telemetry off, default fonts off, no proxy, and agent/MCP disabled (F-47).
3. The simulated API runs in the browser (sim-fetch blocks any URL outside the Core API, `sim-fetch.ts:93-98`).
4. The launcher has no outbound code (§3.3).
5. The CSP `connect-src` and `default-src` are `'self'` plus the loopback WS (§3.3).

**Proven in step 96 (V-W5..W7):**

- The browser request log shows hosts ⊆ {`127.0.0.1:<port>`}.
- Zero CSP violations.
- `lsof -nP -a -p <pid> -i` shows only `127.0.0.1:<port> (LISTEN)` and loopback ESTABLISHED.

**Static scan (informational):** the packager lists every `https?://` host string in the built JS, CSS and HTML into `BUILD-INFO.txt`. Licence, comment and doc URLs are expected. Runtime evidence is authoritative.

### 3.6 Packager script and procedure (step 95)

**Script.** `scripts/release/build-web-packages.ts` at the repo root.

- Run it with `node --import tsx scripts/release/build-web-packages.ts`, the precedent from steps 92 and 93.
- Node built-ins plus system `tar`, `unzip`, `zip`, `codesign` and `shasum` only.
- **No `package.json` edit, no npm install** (P1).

**Procedure:**

1. **Preflight.**
   - `process.version === 'v26.8.2'`.
   - `git check-ignore -q release/probe`. If it fails, return `needs-review` and do not edit `.gitignore`; that edit belongs to step 100 or 94.
   - At least 3 GB free.
   - Record `git rev-parse HEAD` and the dirty-file count.
2. **Typecheck** `@dems/core-web` and `@dems/mock-core`. Run the launcher tests: `npm test -w @dems/mock-core`.
3. **Build the web app:** in `apps/core-web`, `VITE_DEMS_CORE_ORIGIN=same-origin node ../../node_modules/vite/bin/vite.js build --outDir <root>/.cache/release/web-dist --emptyOutDir`.
   - Assert no `*.map` files.
   - Assert `index.html` references `/assets/` only.
   - Assert the dist size is in the 36–45 MB range [H-PK-13]. Record the actual size.
4. **Manifest.** Walk the dist and write `web-manifest.json` (path, size, SHA-256, type). Record its SHA-256.
5. **Node binaries.** Download the archives and `SHASUMS256.txt` from nodejs.org only. Verify; abort on any mismatch. Extract the binary and `LICENSE`. For Windows, also assert `sha256(node.exe)` equals the SHASUMS line `win-x64/node.exe` (F-10).
6. **SEA targets** (macos-arm64, windows-x64, linux-x64): follow §3.2. Assert the fuse is flipped and the marker is present. For macOS, run `codesign --verify`.
7. **Runtime bundles** (macos-x64, F1 windows-x64-signed-runtime):
   - Copy the official binary **unmodified**; its SHA-256 equals the extracted one.
   - Copy the launcher, `web/` and `web-manifest.json`.
   - Add the start script:
     - `DEMS Web Demo (Intel).command`: LF endings, mode 755, `#!/bin/sh`, `cd "$(dirname "$0")" || exit 1`, `exec env -u NODE_OPTIONS ./runtime/node app/dems-web-launcher.cjs "$@"`.
     - `Start DEMS Web Demo.cmd`: CRLF endings, `@echo off`, `cd /d "%~dp0"`, `set "NODE_OPTIONS="`, `"runtime\node.exe" "app\dems-web-launcher.cjs" %*`, `if errorlevel 1 pause`.
8. **Any-OS zip (F2):** the same `app/` plus three start scripts that call `node` from PATH. Each checks `node --version` ≥ 22 and prints a clear message otherwise.
9. **Package extras.** Every package gets:
   - `README-FIRST.txt` (EN + ID, about 15 lines: which file to double-click, the security prompt, how to stop);
   - `licenses/NODE-LICENSE.txt` (from the archive; omitted only in F2, which ships no Node);
   - `licenses/THIRD_PARTY_NOTICES.md` (the repo root file: fonts, Pexels photo, eSpeak NG voice, MIT copy-ins).
10. **Archive.**
    - Info-ZIP `zip -r -X` for Windows and macOS. It stores Unix modes [H-PK-20].
    - `tar -czf` for Linux.
    - Exclude `.DS_Store`.
    - Set file mtimes to the build start for tidy listings (reproducibility is a nice-to-have, not an AC).
11. **Checksums:** `release/web/SHA256SUMS.txt` plus per-file `.sha256`. Write `release/web/BUILD-INFO.txt` (§4.3).
12. **Smoke** (full verification is step 96):
    - Extract the macOS arm64 zip into `$TMPDIR`.
    - Run `--self-test` → exit 0.
    - Run `--no-open` on the default port. `curl` the health endpoint, then stop with SIGINT → exit 0.
13. **Write** `release/RUN-ON-ANOTHER-PC.md` from the §4.4 outline, filling in the real file sizes.

### 3.7 Package contents

| Package | Top folder inside the archive | Contents |
|---|---|---|
| windows-x64.zip | `DEMS-Web-Demo-0.1.0-windows-x64/` | `DEMS Web Demo.exe`, `README-FIRST.txt`, `licenses/` |
| macos-arm64.zip | `DEMS-Web-Demo-0.1.0-macos-arm64/` | `DEMS Web Demo` (mode 755, ad-hoc signed), `README-FIRST.txt`, `licenses/` |
| linux-x64.tar.gz | `dems-web-demo-0.1.0-linux-x64/` | `dems-web-demo` (755), `README-FIRST.txt`, `licenses/` |
| macos-x64.zip | `DEMS-Web-Demo-0.1.0-macos-x64/` | `DEMS Web Demo (Intel).command`, `runtime/node`, `app/dems-web-launcher.cjs`, `app/web-manifest.json`, `app/web/**`, `README-FIRST.txt`, `licenses/` |
| windows-x64-signed-runtime.zip | `DEMS-Web-Demo-0.1.0-windows-x64-signed-runtime/` | `Start DEMS Web Demo.cmd`, `runtime\node.exe`, `app\…`, `README-FIRST.txt`, `licenses\` |
| any-os-node.zip | `DEMS-Web-Demo-0.1.0-any-os-node/` | `app/…`, `Start (Windows).cmd`, `Start (macOS).command`, `start-linux.sh`, `README-FIRST.txt`, `licenses/` |

**Never inside any package:**

- source maps, `.env*`, `apps/mobile/signing/**`, keystores;
- the design book (`*.docx`), `docs/`, `node_modules/`;
- repo source other than the launcher.

### 3.8 Step 95 and step 100 acceptance criteria

| AC | Check | Pass condition |
|---|---|---|
| AC-PK-W1 (100) | `npm run typecheck`, `lint` and `test` for shared, core-web, mobile and mock-core | exit 0. New tests cover both modes |
| AC-PK-W2 (100) | Dev regression: mock-core plus Vite on 127.0.0.1:5173 (P5, the shared verification port), `/stack-check` | Heartbeat LIVE; health OK; Login enabled |
| AC-PK-W3 (95) | `release/web/` | 6 packages, each with `.sha256`; `shasum -a 256 -c SHA256SUMS.txt` → all OK |
| AC-PK-W4 (95) | Provenance | Each archive hash = the SHASUMS256 line (quoted). F1 `node.exe` = `23062343…dbca`. The macOS x64 `runtime/node` matches the binary from the verified tarball |
| AC-PK-W5 (95) | SEA proof | The fuse `:1` and the marker found in all 3 SEA binaries. `codesign --verify --strict` OK on macOS arm64. `file`: Mach-O arm64 / PE32+ x86-64 / ELF 64-bit x86-64 |
| AC-PK-W6 (95) | Self-test | The macOS arm64 SEA and the any-OS zip (local Node 26) both exit 0 with every asset hash matching |
| AC-PK-W7 (95) | One origin | On `http://127.0.0.1:4410`, `/`, `/api/v1/health` (schema-valid) and `/ws` (heartbeat frames) all answer. `lsof` shows only `127.0.0.1:4410` |
| AC-PK-W8 (95) | `RUN-ON-ANOTHER-PC.md` | Covers Windows, macOS arm64, macOS x64, Linux and Android. Has an ID summary. Every file name in it exists in `release/` |

---

## 4. Release folder, names, checksums and guides

### 4.1 PK-20 Layout (git-ignored `release/`; the download cache lives in `.cache/release/`, outside it)

```
release/
├── RUN-ON-ANOTHER-PC.md                              (step 95; EN + Ringkasan ID; all targets)
├── android/                                          (step 94)
│   ├── DEMS-Demo-0.1.0.apk
│   ├── DEMS-Demo-0.1.0.apk.sha256
│   ├── INSTALL-ANDROID.md                            (EN + ID)
│   ├── BUILD-INFO.txt
│   └── SHA256SUMS.txt
└── web/                                              (step 95)
    ├── DEMS-Web-Demo-0.1.0-windows-x64.zip           (+ .sha256)  primary, SEA
    ├── DEMS-Web-Demo-0.1.0-macos-arm64.zip           (+ .sha256)  primary, SEA
    ├── DEMS-Web-Demo-0.1.0-macos-x64.zip             (+ .sha256)  primary, runtime bundle
    ├── DEMS-Web-Demo-0.1.0-linux-x64.tar.gz          (+ .sha256)  primary, SEA
    ├── DEMS-Web-Demo-0.1.0-windows-x64-signed-runtime.zip (+ .sha256)  fallback F1
    ├── DEMS-Web-Demo-0.1.0-any-os-node.zip           (+ .sha256)  fallback F2
    ├── BUILD-INFO.txt
    └── SHA256SUMS.txt
```

- **No shared files between steps 94 and 95.** Each owns its subfolder and sums file. That is parallel isolation (CLAUDE.md §3.4).
- **Expected total:** about 0.6–0.7 GB [H-PK-13, H-PK-1]. Presenters copy only the file for their OS.

### 4.2 PK-22 Checksums

- **Format:** `<64 hex>  <file name>`, two spaces, the `shasum -a 256` / `sha256sum` format. Paths are relative to the folder.
- **Per-file `.sha256`:** one line, same format. It is written from the **same** computation as `SHA256SUMS.txt`.
- **How users verify:**

| OS | Command |
|---|---|
| macOS | `shasum -a 256 -c SHA256SUMS.txt` |
| Linux | `sha256sum -c SHA256SUMS.txt` |
| Windows | `certutil -hashfile <file> SHA256`, or PowerShell `Get-FileHash <file> -Algorithm SHA256`, compared by eye |

### 4.3 BUILD-INFO.txt (web)

Records:

- the release version and the build times (WIB);
- `git rev-parse HEAD` and the dirty count;
- the Node version; the URL and SHA-256 of `SHASUMS256.txt`; the archive hashes used; the extracted binary hashes;
- the launcher SHA-256 and the `web-manifest.json` SHA-256;
- the dist file count and bytes; the `sea-config` per target, with absolute paths reduced to repo-relative ones;
- the `codesign -dv` summary for macOS;
- the `https?://` host-string list (§3.5);
- the demo-data `--as-of` value (D84).

### 4.4 `release/RUN-ON-ANOTHER-PC.md` outline (step 95; English, then a short Indonesian summary)

1. **What this is.** A DEMO with simulated data. It works offline and sends nothing anywhere. It runs locally in your browser.
2. **Which file do I need?**

| Computer | File | How to tell |
|---|---|---|
| Windows 10/11 | `web/…-windows-x64.zip` | |
| Mac with Apple chip | `web/…-macos-arm64.zip` | Apple menu > About This Mac shows "Chip: Apple M…" |
| Mac with Intel | `web/…-macos-x64.zip` | About This Mac shows "Processor: Intel…" |
| Linux | `web/…-linux-x64.tar.gz` | |
| Android tablet or phone | `android/DEMS-Demo-0.1.0.apk` | → `android/INSTALL-ANDROID.md` |

3. **Before demo day.**
   - Copy by **USB stick or local network share**, not cloud upload (confidentiality, I2). USB also usually avoids the security prompts [H-PK-16, H-PK-17].
   - Test once on the target machine the day before.
   - For Android tap-install in Indonesia, finish the 24-hour advanced flow first (§2.9).
4. **Windows.**
   1. Right-click the zip → *Extract All*.
   2. Open the folder and double-click **DEMS Web Demo.exe**.
   3. If "Windows protected your PC" appears: **More info → Run anyway**.
   4. A black window shows the address, and the browser opens.
   5. To stop: Ctrl+C or close the window.
   6. "This app has been blocked for your protection" (Smart App Control): use `…-windows-x64-signed-runtime.zip` → **Start DEMS Web Demo.cmd**.
5. **macOS (Apple chip).**
   1. Double-click the zip, then double-click **DEMS Web Demo**. Terminal opens [H-PK-21].
   2. If macOS says it cannot verify the app: click *Done*, open *System Settings > Privacy & Security*, click **Open Anyway**, then *Open* (F-65).
   3. Or, once, in Terminal: `xattr -dr com.apple.quarantine <folder>`.
   4. Stop: Ctrl+C, or close the Terminal window.
6. **macOS (Intel).** The same, but double-click **DEMS Web Demo (Intel).command**.
7. **Linux.** `tar xzf …-linux-x64.tar.gz && cd dems-web-demo-0.1.0-linux-x64 && ./dems-web-demo`. Requires glibc 2.28 or later (F-11).
8. **Using the demo.**
   - Use Chrome or Edge. Safari and Firefox are not verified [H-PK-22].
   - Address `http://127.0.0.1:4410/`. The port may be 4411–4419 if 4410 is busy; the window shows the real address.
   - Sign in with a demo operator (password `demo-2026`). Presentation mode hides the list.
   - Each run on a new port starts with fresh demo data.
   - Leave the window open while presenting.
9. **Troubleshooting:**

| Symptom | Fix |
|---|---|
| Browser did not open | Copy the address from the window |
| "Core offline", Sign In disabled | The launcher window was closed; start it again |
| Window closes at once (Windows) | Use `Start DEMS Web Demo.cmd` from F1 to read the error |
| Antivirus quarantine | Use F1 |
| Port in use | Close other copies. A second copy just opens the first one |
| Page blank in Safari | Use Chrome or Edge |
| Diagnose | Run with `--self-test` from a terminal and send the output |

10. **Verify the files (optional).** §4.2.
11. **Ringkasan (Bahasa Indonesia).** Ten to twelve lines: which file, double-click, the Open Anyway / Run anyway step, the address, the password `demo-2026`, how to stop, and the Android note.

---

## 5. Verification plan for step 96

**Preconditions:**

- Steps 94 and 95 are PASS, and no other lane is running.
- Device commands run outside the sandbox (D24) through `NO_METRO=1 apps/mobile/scripts/device-session.sh <avd> '…'` (D55).
- **Emulators:** if down, the helper boots them with the D78 flags. The step stops **only** the emulators it booted (it records their PIDs).

### 5.1 APK on both AVDs (phone first, then tablet; the helper takes the AVD locks)

| V | Action | Pass condition |
|---|---|---|
| V-A1 | `adb uninstall com.dems.demo.tablet` (debug signature differs) | `Success` or "not installed" |
| V-A2 | `adb install release/android/DEMS-Demo-0.1.0.apk` | `Success`. `dumpsys package` shows versionName 0.1.0, versionCode 100, and no `DEBUGGABLE` flag |
| V-A3 | Offline state:<br>- `adb reverse --remove-all`, then `adb reverse --list` → empty;<br>- port 8081 has no listener;<br>- mock-core is not running;<br>- `adb shell cmd connectivity airplane-mode enable` (fallback: `svc wifi disable; svc data disable`) [H-PK-23] | All true. `settings get global airplane_mode_on` → 1 |
| V-A4 | Cold launch (`am start -n com.dems.demo.tablet/.MainActivity`). Screencap | Login is shown with no "Unable to load script" |
| V-A5 | Sign in as `budi.santoso` / `demo-2026` (tap by screenshot coordinates, D72) | Home screencap. The Core chip reads SIMULATED/ONLINE |
| V-A6 | Live feed: `adb shell "am start -a android.intent.action.VIEW -d 'demsdemo://session/live'"` (quoted, D72), or navigate | Two screencaps 2.5 s apart differ inside the video region; the chrome is identical [H-PK-10] |
| V-A7 | Evidence EV-0001 → PASS. EV-0005 → FAIL on AUDIO-02 (D67). Play an evidence item | Screencaps; the audio track plays (D93) |
| V-A8 | `logcat -d` | No `FATAL EXCEPTION`, no `ReactNativeJS: Error`, no Metro or `8081` URL. `CLEARTEXT` lines, if any, target only `127.0.0.1` (record them: H-PK-5) |
| V-A9 | `demsdemo://dev-gallery` | Redirects; no dev UI in release (F-31) |
| V-A10 | Airplane mode off; app force-stopped | State restored |

### 5.2 Web, on this Mac

| V | Action | Pass condition |
|---|---|---|
| V-W1 | `ditto -x -k release/web/…-macos-arm64.zip "$TMPDIR/dems-pkg-verify/"`. `ditto` is the Archive Utility engine. This copy is outside the workspace | Extracted. `test -x "DEMS Web Demo"` |
| V-W2 | Gatekeeper assessment, with no execution: `xattr -w com.apple.quarantine "0081;$(printf %x $(date +%s));Safari;" <copy2>`, then `spctl -a -t exec -vv <copy2>`. Delete copy2 afterwards | Expected *rejected* (documents the user prompt of §3.2). Contrast: macOS x64 `runtime/node` → *accepted, source=Notarized Developer ID* |
| V-W3 | `"./DEMS Web Demo" --version` and `--self-test` | Version line; JSON `ok:true`; exit 0 |
| V-W4 | Run `--no-open`, in the background, from the copy | The banner shows `http://127.0.0.1:4410/` |
| V-W5 | Browser smoke (agent-browser first, Playwright fallback) at 1920×1080. Load `/`: Login shows Core ONLINE. Sign in. Visit all 10 pages. API Reference: health Try-it LIVE, Realtime panel connected (origin allowed). Evidence: EV-0001 verify PASS (WebCrypto on 127.0.0.1, F-48), EV-0005 FAIL. Seek a video. Reload a deep link (`/evidence`) | Every page renders. Request log hosts = {127.0.0.1:4410}. At least one `206` response for media. Zero `securitypolicyviolation` events. Console errors are zero or explained |
| V-W6 | `lsof -nP -a -p <pid> -i` | Only `127.0.0.1:4410 (LISTEN)` and loopback ESTABLISHED |
| V-W7 | `curl` checks:<br>- `Host: evil.example` → 421;<br>- WS with `Origin: http://evil.example` → 403;<br>- `curl --path-as-is /../../etc/passwd` → 404;<br>- `POST /` → 405;<br>- `Range: bytes=0-99` on an mp4 → 206 `Content-Range`;<br>- health JSON → schema-valid (`node --import tsx -e` with `HealthResponseSchema`) | all as stated |
| V-W8 | Port fallback: hold 4410 with a dummy listener and start the launcher. Then single instance: start a second launcher while the first runs | First case: the banner shows 4411. Second case: the second launcher prints "already running" and exits 0 |
| V-W9 | SIGINT | Exit 0 within 2 s. The WS client receives close 1001. No process left |
| V-W10 | The `open` failure path. Inside the sandbox, `open` is blocked (sandbox note), so run once without `--no-open` | The launcher prints the fallback line and keeps serving |
| V-W11 | Any-OS zip with local Node 26 (`Start (macOS).command` run via `sh`; executes the runtime-flavour code path that the macOS x64 and F1 packages share) | Same as V-W3..W6 on its port |

### 5.3 Static checks for binaries that cannot run here (F-12)

| V | Target | Pass condition |
|---|---|---|
| V-S1 | windows-x64 SEA | `file` → `PE32+ executable (console) x86-64, for MS Windows`. Fuse `:1`. Marker present. Size ≈ 103.8 MB + blob |
| V-S2 | linux-x64 SEA | `file` → `ELF 64-bit LSB … x86-64`. Fuse `:1`. Marker. `tar -tvzf` shows `-rwxr-xr-x` |
| V-S3 | macos-x64 runtime bundle | `file runtime/node` → Mach-O 64-bit x86_64. `codesign --verify --strict` OK. Hash matches BUILD-INFO. `.command` has mode 755 and no CR characters |
| V-S4 | F1 signed runtime | `node.exe` SHA-256 = `23062343ad39fc79f12ae39cfb324e93a20ced5f1d342e7b850c148c022ddbca`. The PE certificate table (security directory) is non-empty [H-PK-11]. `.cmd` has CRLF endings |
| V-S5 | All archives | No `.map`, `.DS_Store`, `signing`, `.p12`, `.properties`, `.env` or `.docx` entries (`unzip -l` / `tar -tzf`). `licenses/` present |
| V-S6 | Checksums | `shasum -a 256 -c` OK in `android/` and `web/`. Each `.sha256` matches |
| V-S7 (optional) | Linux runtime in Docker | **Only with the user's explicit OK.** It uses the user's existing Lima/Docker VM and pulls a public image: `docker run --rm --platform linux/amd64 -v <dir>:/x:ro debian:bookworm-slim /x/dems-web-demo --self-test` |

### 5.4 Regression and clean-up

| V | Action | Pass condition |
|---|---|---|
| V-R1 | Root `npm run typecheck && npm run lint && npm test`. Steps 95 and 100 changed core-web, shared and mock-core after step 61's run if step 100 was folded into 95 | exit 0 |
| V-R2 | Clean-up:<br>- kill the launchers;<br>- remove `$TMPDIR/dems-pkg-verify`;<br>- stop only the emulators this step booted;<br>- `pgrep -fl "DEMS Web Demo|dems-web-launcher"` → empty | Nothing left running |

---

## 6. Proposed blueprint rows and review additions

### 6.1 New and changed rows

| Step | Description | Agent | Output (Tier) | Depends on | Acceptance |
|---|---|---|---|---|---|
| **100** *(new; alias 95a)* | Same-origin Core endpoint mode for packaged web builds (§3.4). Append `release/` and `apps/mobile/signing/` to `.gitignore` (§2.2). Hand-overs as listed in §3.4 | coder-execution | `implementation/71_web_same_origin_core.md` (Tier 3) | 53, 54, 91 | AC-PK-W1, W2; `git check-ignore` for both paths |
| **94** | Android release APK per §2. Keystore and properties (§2.2), config plugin, `app.json` keys (versionCode 100, `allowBackup`, `blockedPermissions`, plugin entry; hand-over), build script, `release/android/**` incl. INSTALL-ANDROID.md | coder-execution | `implementation/69_release_apk.md` (Tier 3) | 61 (and 100 if adopted) | AC-PK-A1..A9. **Replaces the row-94 draft AC** "lib/ for arm64-v8a, armeabi-v7a, x86 and x86_64" with the 3-ABI set of §2.3 |
| **95** | Web packages per §3: launcher, its tests and tsconfig, packager script, 6 packages, `release/web/**`, RUN-ON-ANOTHER-PC.md. **Row-text changes:**<br>- macOS x64 is a runtime bundle, not a SEA;<br>- the "static dist zip" is replaced by the any-OS node zip;<br>- adds the F1 Windows signed-runtime fallback | coder-execution | `implementation/70_web_packager.md` (Tier 3) | 61 (and 100 if adopted) | AC-PK-W3..W8 |
| **96** | Package verification per §5 | verifier | `verification/12_package_verification.md` (Tier 2) | 94, 95 | Every V-check PASS/FAIL with quoted output and screencaps. Each FAIL routed to 94, 95 or 100. No emulator or launcher left that this step started |
| 56, 58, 61 | **Add dependency 100** if adopted, so the end pass covers the web change | — | — | +100 | — |
| 91 | **Add** to the mobile remediation list: HEARTBEAT option disabled in release builds with the hint (§2.6) | — | — | — | Unit test with `__DEV__` false |
| 60 | README: a "Release packages" section that points to `release/RUN-ON-ANOTHER-PC.md`, plus the two build commands (`apps/mobile/scripts/build-release-apk.sh`, `node --import tsx scripts/release/build-web-packages.ts`) | — | — | — | — |
| 66 | Before staging, confirm:<br>- `git check-ignore -q release/x apps/mobile/signing/x`;<br>- `git ls-files` lists no `release/`, `signing`, `.p12` or `.properties` path;<br>- **provenance:** `find apps packages scripts -newer release/web/BUILD-INFO.txt -type f -not -path '*/node_modules/*' -not -path 'apps/mobile/android/*'` is empty, so no source changed after the packages were built | — | — | — | Quoted outputs |

**If the controller does not adopt step 100:** fold §3.4 into step 95's write set, assign the `.gitignore` append to step 94 (as the rev-5 row says), and keep V-R1 plus a dev-mode check (AC-PK-W2) in step 96.

**Write sets (collision scan):**

| Step | Writes |
|---|---|
| 94 | `apps/mobile/{app.json (version and android keys, plugin entry), plugins/with-dems-release-signing.js, scripts/create-demo-keystore.sh, scripts/build-release-apk.sh, signing/**}`, `apps/mobile/android/**` (generated), `release/android/**` |
| 95 | `apps/mock-core/standalone/**`, `apps/mock-core/test/standalone-launcher.test.ts`, `scripts/release/**`, `.cache/release/**`, `release/web/**`, `release/RUN-ON-ANOTHER-PC.md` |
| 100 | the §3.4 files plus `.gitignore` |

These sets are disjoint. 94 and 95 can run in parallel: 94 holds `gradle.lock` and the `dems_phone` lock; 95 uses port 4410 and one browser.

### 6.2 What reviews 62–65 must additionally cover (beyond the rev-5 row text)

**62, security, web and stack:**

- The CSP and security headers (§3.3); the Host allowlist (DNS rebinding); the WS Origin allowlist; the 32-client cap.
- No interface override and no env config. `execArgvExtension:"none"`, and the runtime scripts unset `NODE_OPTIONS`.
- The launcher writes no files.
- **Binary provenance:** archive and binary hashes against SHASUMS256; the residual risk of no GPG check; F1 `node.exe` byte-identical to the official one.
- Package contents free of secrets, maps and design-book text (V-S5). Licences included (Node LICENSE, THIRD_PARTY_NOTICES).
- The RUN guide's confidentiality advice (USB, no cloud upload).

**63, security, mobile:**

- **Keystore:** random password, mode 600, double git-ignore, never logged (AC-PK-A8). DN labelled DEMO. Fail-fast when the properties file is missing (no debug-signed release).
- **apksigner output:** schemes, single signer.
- **Release manifest:** no cleartext, `allowBackup=false`, blocked permissions, not debuggable.
- **Heartbeat in release:** loopback-only attempts (V-A8), and the step-91 UI change.
- **Install guide:** the advanced flow advises **7 days**. ADB is preferred. Play Protect upload declined. Protections are never disabled globally.

**64, code review, web:**

- Launcher correctness: RFC 6455 handshake and framing (masking, close codes, ping/pong, limits), Range/ETag handling, the SPA fallback, the shutdown path, the Windows "Press Enter" path.
- Contract tests against the shared schemas; duplication limited to §3.3.
- Packager fails closed on any checksum mismatch.
- `core-endpoint.ts` is minimal; the defaults are unchanged in dev; no `.env` file.

**65, code review, mobile:**

- Plugin idempotence (marker) and Groovy correctness.
- No secret in `app.json` or the plugin.
- The ABI flag lives in the script, not in `gradle.properties`.
- `EXPO_NO_TELEMETRY` and the lock are used.
- The versionCode scheme.
- Release-only behaviour: `__DEV__` gates, no Metro URL.

---

## 7. Assumptions, sequencing rationale and deviations

### 7.1 Assumptions

- A1. Steps 53, 54 and 91 finish before step 100, and steps 56–61 run after it. The tree does not change between steps 94–96 and step 66, except `docs/` (step 66 provenance check).
- A2. The demo-data `--as-of` stays at the step-92/93 default unless the user asks for a demo-date rebuild. Then: re-run step 93 with `--as-of`, rebuild the packages and bump PATCH (§2.5). D84 and F-50 make the default safe on any date.
- A3. Downloading the Node archives (≈ 190 MB) from nodejs.org is within C7, which authorises downloads. It sends no project data.
- A4. Target PCs have a current Chrome or Edge. Edge ships with Windows 10 and 11.

### 7.2 Why step 100 runs before the end pass

- Step 95 needs a web change in core-web and shared. Applied after step 61, it would change code that steps 56, 58 and 61 have already verified.
- Placing the small same-origin change **before** 56/58/61 lets the existing end pass test both modes, at the cost of about one short step on the critical path.
- Packaging itself (94–96) still runs after step 61, as D94 requires.

### 7.3 Deviations from the D94 note and the rev-5 row text (MINOR, for the controller to record)

| # | Rev-5 / D94 text | This spec | Reason |
|---|---|---|---|
| 1 | Row 94 AC: 4 ABIs | 3 ABIs (`x86` dropped) | §2.3 |
| 2 | Row 95: launchers for 4 targets, all on official Node via SEA | macOS x64 = runtime bundle | F-06: SEA unsupported on macOS x64 |
| 3 | Row 95 / D94: "plain static dist zip fallback" | any-OS node zip (static dist plus the 1-file server) | F-42: static-only cannot sign in |
| 4 | — | Adds the F1 Windows signed-runtime fallback | F-66 Smart App Control |
| 5 | Row 94 writes "an install guide" | `release/android/INSTALL-ANDROID.md`; the top-level guide comes from step 95 | Parallel isolation |
| 6 | `.gitignore` append by 94 | By step 100 if adopted | Removes a race with step 95 |
| 7 | — | New step 100; step-91, 60 and 66 additions | §6.1 |

---

## 8. Risks and hypotheses

### 8.1 Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-PK-1 | Windows or Linux SEA crashes at start on the real target. It cannot be executed here (F-12) | Medium | High | Static proofs (V-S1/S2). `--self-test` for the presenter. Fallbacks F1/F2. "Test the day before" in the guide. Optional V-S7 with the user's OK |
| R-PK-2 | Smart App Control blocks the unsigned exe (F-66) | Medium on clean Windows 11 | High | F1 signed-runtime bundle |
| R-PK-3 | Android developer verification blocks tap-install in Indonesia (F-60) | **High** on certified devices | High | Method A (ADB). Advanced flow done a day early. The free limited-distribution account is **not** used (D5/D6); the user can opt in later |
| R-PK-4 | The CSP breaks a page (Scalar workers, inline styles) | Low–Medium | Medium | Step 95 collects violations across all routes and widens one directive at a time, with a reason |
| R-PK-5 | Release-only mobile failure: video assets, fonts or the React Compiler differ from debug | Low–Medium | High | Step 94 G launch smoke. Step 96 V-A4..A9 on both AVDs. A fix goes back to the owning step |
| R-PK-6 | The plugin's Groovy block breaks after a template change | Low | Medium | Marker idempotence AC. The apksigner fallback (§2.8 F) |
| R-PK-7 | Keystore lost: a later APK cannot upgrade in place | Medium | Low (demo) | Uninstall, then install. The user may back up `apps/mobile/signing/` privately |
| R-PK-8 | Safari renders differently (default browser on macOS) | Medium | Medium | The guide says Chrome or Edge. The banner says so too |
| R-PK-9 | Antivirus false positive on the SEA | Low–Medium | Medium | F1 (official signed `node.exe`) |
| R-PK-10 | Release size above the estimate | Medium | Low | Measured. If above 200 MB, consider R8 in a later release (out of scope now) |
| R-PK-11 | macOS x64 support of Node 26 ends "early 2028" (F-11) | — | Low | Outside the demo horizon |

### 8.2 Hypotheses and their tests

| ID | Hypothesis | Test |
|---|---|---|
| H-PK-1 | Release APK 120–170 MB | Step 94 measures |
| H-PK-2 | The release variant may download extra Maven artifacts | Step 94 runs Gradle with network allowed and logs the hosts |
| H-PK-3 | Some budget or Go tablets run a 32-bit userland | Pre-demo `abilist` check |
| H-PK-4 | No current 32-bit `x86` emulator images for recent API levels | Informational; `x86` dropped either way |
| H-PK-5 | In release, Android blocks the heartbeat and health cleartext calls to 127.0.0.1, and the app keeps working | V-A8 logcat; V-A5 UI |
| H-PK-6 | Debug keeps `SYSTEM_ALERT_WINDOW` despite the main-manifest removal | `aapt2 dump permissions` on the next debug build (step 65 notes it) |
| H-PK-7 | About 400 MB free is enough to install | V-A2 records `pm` size, via `dumpsys package` / `du` |
| H-PK-8 | The Platform-Tools licence restricts redistribution | Not redistributed either way; the guide links to the official download |
| H-PK-9 | The Play Protect dialog offers an install-without-scan option | Observed on the first real device; the guide wording stays generic |
| H-PK-10 | expo-video plays `require()`d assets in release | V-A6, V-A7 |
| H-PK-11 | The official `node.exe` and the macOS binaries keep valid vendor signatures (Authenticode, Developer ID, notarized) | V-S4 (PE certificate table); V-W2 (`spctl` on `runtime/node`) |
| H-PK-12 | A quarantined `.command` or `.cmd` may still trigger a prompt | Documented as possible; same workaround |
| H-PK-13 | Web dist 36–45 MB; each zipped package about 85–95 MB | Step 95 measures |
| H-PK-14 | Windows Explorer runs an exe opened from inside the zip view | Untestable here; the guide says *Extract All* first |
| H-PK-15 | `file://` breaks module scripts and the router | Not needed: (e) is rejected on F-42 alone |
| H-PK-16 | Files copied from USB carry no macOS quarantine | Field note; V-W2 covers the quarantined case |
| H-PK-17 | FAT/exFAT USB carries no MOTW. *Unblock* removes it | Field note |
| H-PK-18 | Linux file managers may not run binaries on double-click | The guide uses the terminal |
| H-PK-19 | A loopback-only listener triggers no firewall prompt | Observed on macOS in V-W4; Windows untestable here |
| H-PK-20 | Archive Utility keeps exec bits from Info-ZIP archives | V-W1 (`ditto -x -k`, then `test -x`) |
| H-PK-21 | Finder runs a Unix executable in Terminal on double-click | Optional outside-sandbox check; the guide offers the Terminal alternative |
| H-PK-22 | Safari and Firefox work | Not verified; the guide recommends Chrome or Edge |
| H-PK-23 | `cmd connectivity airplane-mode enable` works on the API 36 AVDs | V-A3 uses the `svc` fallback otherwise |

### 8.3 Gaps

- No runtime execution of the Windows, Linux or macOS x64 artifacts on this Mac (F-12).
- No GPG verification of `SHASUMS256.txt`.
- Safari is not covered.
- The exact Play Protect and advanced-flow UI strings vary by device and OEM.

---

## 9. Traceability: D94 asks → sections

| Ask | Where |
|---|---|
| Release build without EAS; signing (keytool JDK 17, git-ignored test values, durable signingConfig); ABI; Hermes and embedded assets; versioning; file name; size; install guide; first-run notes; cleartext decision | §2.1–§2.10 |
| SEA in Node 26 (`--build-sea` present, no postject); cross-building; assets; Gatekeeper and SmartScreen workarounds; options (a)–(e); easiest path plus fallback | §1.1, §3.1, §3.2 |
| One-origin launcher (built-ins, minimal WS); port fallback; 127.0.0.1; auto-open; banner; clean stop | §3.3 |
| Core URL via env without breaking 5173; Vite `base`; no external requests | §3.4, §3.5 |
| `release/` layout, names, SHA-256 list, RUN-ON-ANOTHER-PC.md (EN + ID) | §4 |
| Step-96 plan | §5 |
| Rows 94/95/96, agents, deps, outputs; review additions | §6 |

---

## 10. Sources

### 10.1 Official and secondary documents (fetched 2026-10-01)

- Node.js SEA, v26.8.2: https://nodejs.org/download/release/v26.8.2/docs/api/single-executable-applications.html
- Node.js SEA, latest v26 (stability index): https://nodejs.org/docs/latest-v26.x/api/single-executable-applications.html
- Node.js BUILDING.md v26.8.2: https://github.com/nodejs/node/blob/v26.8.2/BUILDING.md
- Node.js v26.8.2 checksums: https://nodejs.org/dist/v26.8.2/SHASUMS256.txt
- Expo, local production build: https://docs.expo.dev/guides/local-app-production/
- React Native, signed APK: https://reactnative.dev/docs/signed-apk-android
- keytool (JDK 17): https://docs.oracle.com/en/java/javase/17/docs/specs/man/keytool.html
- adb: https://developer.android.com/tools/adb
- Unknown sources: https://developer.android.com/distribute/marketing-tools/alternative-distribution
- Android developer verification (Jun 2026): https://android-developers.googleblog.com/2026/06/android-developer-verification.html
- Advanced flow (Mar 2026): https://developer.android.com/blog/posts/android-developer-verification-balancing-openness-and-choice-with-safety
- Developer Console Help: https://support.google.com/android-developer-console/answer/16561738?hl=en
- AndroidAPS menu path [2nd]: https://androidaps.readthedocs.io/en/latest/SettingUpAaps/AndroidDeveloperVerification.html
- Play Protect: https://support.google.com/googleplay/answer/2812853?hl=en
- Apple, open blocked apps: https://support.apple.com/en-us/102445
- Smart App Control: https://support.microsoft.com/en-us/topic/what-is-smart-app-control-285ea03d-fa88-4d56-882e-6698afdb7003
- MOTW [2nd]: https://textslashplain.com/2016/04/04/downloads-and-the-mark-of-the-web/ and https://www.outflank.nl/blog/2020/03/30/mark-of-the-web-from-a-red-teams-perspective/
- MDN Secure Contexts: https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts
- MDN SubtleCrypto: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto
- RFC 6455: https://www.rfc-editor.org/rfc/rfc6455
- Tauri Windows installer: https://v2.tauri.app/distribute/windows-installer/
- Docker Desktop licence: https://docs.docker.com/subscription/desktop-license/

### 10.2 Full SHA-256 values from SHASUMS256.txt (v26.8.2)

```
974b6d5fb2fc7c33ff2354db0902b4e91c2de01ec8acc6de48e543c97e18c9e1  node-v26.8.2-darwin-arm64.tar.gz
adb8feb2d4987df3d72d2ec46f4fc4b58039c859b8c3f0e3cc2d3c6cbaf8629c  node-v26.8.2-darwin-x64.tar.gz
badb3fe6a61b85e1352ca6564dc56b8b7bd5ecd5c474c52acc21dd0cdd586f35  node-v26.8.2-linux-x64.tar.gz
cf02f5d0c06c794b84f277177d5cf3743d0924ca49f6641cd435dd7cb6ee9085  node-v26.8.2-win-x64.zip
23062343ad39fc79f12ae39cfb324e93a20ced5f1d342e7b850c148c022ddbca  win-x64/node.exe
```

Step 95 must **re-download and re-verify** these values. The table is a cross-check, not a substitute.

### 10.3 Local commands behind the [local] facts

`node --version`; `node --help`; `node -p "Object.keys(require('node:sea'))"`; `file`, `codesign -dv`, `lipo -detailed_info` and `strings -a` on `/usr/local/bin/node`; `arch -x86_64 /usr/bin/true`; `which docker podman wine gpg cargo rustc electron`; `keytool -genkeypair -help`; `grep keystore.type java.security`; `apksigner sign -h`, `verify -h`; `zipalign`; `aapt2 dump badging` and `unzip -v` on `app-debug.apk`; the hermesc probe; `lsof -nP -iTCP -sTCP:LISTEN`; `curl` against nodejs.org (SHASUMS and HEAD); `find … stat` over the glob sets; `vite build --help`; `df -h`; `sw_vers`.

---
*Generated: 2026-10-01 10:05 WIB*
*Last Updated: 2026-10-01 10:05 WIB*
