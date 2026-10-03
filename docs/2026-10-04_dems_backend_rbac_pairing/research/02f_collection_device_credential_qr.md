---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: 11
tier: 2
date: 2026-10-04
agent: data-collector
items_collected: 16 (3 credential-storage candidates + 3 reference items, 5 QR-rendering candidates, 4 QR-scanning candidates + 1 excluded item) plus repo facts (section 2) and Android platform sources (sections 3.1, 5.1, 5.3)
last_updated: 2026-10-04 02:40
---

# Collection: mobile device credential storage, QR rendering (web) and QR scanning (mobile)

## 1. Scope, method and conventions

**Task (row 11, identification/02_structured.md line 284, verbatim):** collect evidence on the mobile device credential and QR, with generic queries only: credential storage on Android under Expo SDK 57 (secure-storage module, biometric-protected items, emulator behaviour, behaviour on reinstall); QR rendering in React 19 web; QR scanning in React Native 0.86 on Expo (camera module, emulator support, permission footprint); per candidate: version, licence, native rebuild need.

**This document collects. It does not analyse, rank or recommend.** Comparison and choice belong to row 14.

**Fetch date.** Every external source was fetched on **2026-10-04** (host local date, WIB; the same instant was 2026-10-03 18:44 UTC per `date -u`). It is abbreviated **FD** below.

**Verification methods and their limits.**

| Code | Method | Strength | Limit |
|------|--------|----------|-------|
| NPM | `NPM_CONFIG_CACHE="$TMPDIR/npm-cache" npm view <pkg> ...` against registry.npmjs.org, read-only | Byte-exact registry metadata | Says what is published, not whether it works |
| RAW | `curl` of a raw file (unpkg.com tarball file, raw.githubusercontent.com, docs.expo.dev `.md` endpoint, visioncamera.margelo.com `.md` endpoint) | Byte-exact text of the source; quotes marked RAW are verbatim | The file is a snapshot of the named branch or version |
| GH | `curl` to `api.github.com` (unauthenticated) | Byte-exact repository metadata | Rate limit was exhausted mid-task (see section 9); star and issue counts are point-in-time |
| RND | `curl` to `reactnative.directory/api/libraries?search=<pkg>` | Third-party directory flags | Secondary; flags are directory-maintained |
| WF | `WebFetch` of an official page | Primary source, but the tool passes the page through a small summarising model | Quotes marked WF are as returned by that tool; where it paraphrased, the text says "fetch-tool paraphrase" |
| WS | `WebSearch` summary | Secondary only | Used for discovery and cross-checks, always labelled "secondary" |
| REPO | `Read` or `grep` on the workspace | Exact file:line | Reflects the working tree on 2026-10-04 |

No package was installed. No emulator, `adb` or app process was started; the only non-fetch commands were read-only (section 8). Nothing was executed from any candidate. No candidate was run on the host, an emulator or a device; every compatibility and behaviour statement below is declared metadata, source code, or a documentation statement. Where a fact could not be confirmed from a source the text says "not confirmed" or "not stated".

**npm environment note.** Every `npm view` call printed `ERROR: failed to copy trust settings of system certificate-25291` six times on stderr before the result. The lookups still returned data. The default cache was not used (`NPM_CONFIG_CACHE` pointed at a scratch directory).

## 2. Repo facts (the frame every candidate is measured against)

All paths relative to `/Users/gsp-budi/Documents/DEMS/`. Method: REPO.

### 2.1 Installed Expo modules and libraries relevant to this row (`apps/mobile/package.json`)

| Package | Declared | Line | Relevance to row 11 |
|---|---|---|---|
| expo | `~57.0.26` (installed 57.0.26: `node_modules/expo/package.json` `"version"`) | `apps/mobile/package.json:32` | SDK 57 baseline |
| react-native | `0.86.3` (installed 0.86.3: `node_modules/react-native/package.json:3`) | `:58` | Native layer baseline |
| react / react-dom | `19.2.3` | `:54`, `:55` | React 19 |
| expo-local-authentication | `~57.0.3` | `:43` | Biometric prompt already installed |
| @react-native-async-storage/async-storage | `2.2.0` | `:28` | Only persistent store in the app today |
| expo-device | `~57.0.2` | `:35` | Device information module already installed |
| expo-constants | `~57.0.20` | `:34` | Installed |
| expo-linking | `~57.0.11` | `:42` | Deep-link handling; URL scheme is `demsdemo` at `apps/mobile/app.json:8` |
| react-native-svg | `15.15.4` | `:64` | Installed (react-qr-code can render through it in React Native, per its README, section 5.2) |
| expo-router, expo-splash-screen, expo-video, expo-font, expo-status-bar | `~57.0.x` | `:44`, `:45`, `:49`, `:36`, `:46` | Plugins listed in app.json |

**Not installed** (grep of `apps/mobile/package.json` for `expo-dev-client|expo-crypto|expo-secure-store|expo-camera|expo-barcode`: no match): expo-secure-store, expo-camera, expo-barcode-scanner, expo-crypto, expo-dev-client. No secure-storage module and no camera module is present (matches F-A15 of 02_structured.md).

**Scripts** (`apps/mobile/package.json`): `:9` `build` = `expo prebuild --platform android --no-install && cd android && ./gradlew assembleDebug`; `:14` `android` = `expo run:android`; `:15` `prebuild` = `expo prebuild --platform android --no-install` (no `--clean` flag); `:18` `reverse` = `adb reverse tcp:4400 tcp:4400 && adb reverse tcp:8081 tcp:8081`.

### 2.2 `apps/mobile/app.json`

| Item | Value | Line |
|---|---|---|
| Android package | `com.dems.demo.tablet` | `:21` |
| `android.allowBackup` | `false` | `:23` |
| `android.blockedPermissions` | `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` | `:24-28` |
| `android.permissions` array | none present in `:14-29` | |
| `plugins` | `expo-router`, `expo-splash-screen` (with options), `expo-video`, `expo-font`, `expo-status-bar`, `expo-local-authentication`, `./plugins/with-dems-release-signing` | `:34-49` (`expo-local-authentication` at `:47`, local plugin at `:48`) |
| `experiments` | `typedRoutes: true`, `reactCompiler: true` | `:50-53` |

A test pins the plugin list: `apps/mobile/src/components/media/brand-media.test.ts:118` expects exactly `['expo-router','expo-splash-screen','expo-video','expo-font','expo-status-bar','expo-local-authentication','./plugins/with-dems-release-signing']`.

The local plugin `apps/mobile/plugins/with-dems-release-signing.js:1-5` states that `apps/mobile/android/` is regenerated by `expo prebuild` (F-21) and re-applies a release-signing block on every prebuild. Only its first five lines were read. Nothing under `apps/mobile/signing/` was opened.

### 2.3 Generated Android project (git-ignored by `apps/mobile/.gitignore:43` rule `/android`; present in the working tree)

| Fact | Evidence |
|---|---|
| Permissions in the generated manifest: `INTERNET`, `USE_BIOMETRIC`, `USE_FINGERPRINT`, `VIBRATE`; `READ_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`, `WRITE_EXTERNAL_STORAGE` carry `tools:node="remove"`. No `CAMERA` permission | `apps/mobile/android/app/src/main/AndroidManifest.xml:2-8` |
| `android:allowBackup="false"` on `<application>` | `AndroidManifest.xml:16` (the `<application` element) |
| Custom scheme intent filter `demsdemo` on `MainActivity` | `AndroidManifest.xml:30` |
| `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64`; `newArchEnabled=true`; `hermesEnabled=true` | `apps/mobile/android/gradle.properties:31`, `:38`, `:42` |
| React Native's version catalog: `minSdk = "24"`, `targetSdk = "36"`, `compileSdk = "36"` | `node_modules/react-native/gradle/libs.versions.toml:3-5` |

### 2.4 Existing biometric and credential code

| Fact | Evidence |
|---|---|
| Biometric sign-in uses `expo-local-authentication`; imports at | `apps/mobile/src/auth/biometric.ts:25-26` |
| Prompt options: `disableDeviceFallback: true`, `biometricsSecurityLevel: 'strong'` | `apps/mobile/src/auth/biometric.ts:92-93` (header comment `:9`) |
| The service states "No biometric data ever reaches the app; only the OS verdict does" | `apps/mobile/src/auth/biometric.ts:22-23` |
| Persisted auth preferences hold only `{ lastOperatorId, biometricEnabled }` under key `dems.mobile.auth.v1`, "Never a username, a password, a token or a biometric template" | `apps/mobile/src/auth/auth-prefs.ts:4-6`, `:13`; store is AsyncStorage (`:8`) |
| Predecessor verification: "It uses no CryptoObject or Keystore key, which is accepted for the demo (I-06)" | `docs/2026-09-30_dems_demo_stack_setup/verification/09_mobile_security.md:132`; risk row `:191` |
| Predecessor verification: "AsyncStorage is unencrypted at rest (synthetic data only)" | `docs/2026-09-30_dems_demo_stack_setup/verification/09_mobile_security.md:210` |

### 2.5 Emulator facts (host, read-only)

Method: `grep` of eleven keys in each AVD `config.ini` under `~/.android/avd/` (no emulator started, no adb).

| AVD | `hw.device.name` | `image.sysdir.1` | `tag.id` | `PlayStore.enabled` | `hw.camera.back` | `hw.camera.front` | `abi.type` |
|---|---|---|---|---|---|---|---|
| dems_phone | pixel_10 | `system-images/android-36/google_apis/arm64-v8a/` | google_apis | no | none | none | arm64-v8a |
| dems_phone2 | pixel_10 | same | google_apis | no | none | none | arm64-v8a |
| dems_tablet | pixel_tablet | same | google_apis | no | none | none | arm64-v8a |

The key `hw.fingerprint` does not appear in any of the three `config.ini` files (the grep that included it returned no line for it). Whether a screen lock or a fingerprint is enrolled on any emulator: not confirmed (no emulator was queried).

Predecessor records about emulator biometrics: the blueprint hypothesis "E21: biometric enrolment may fail on `pixel_tablet` (H-MB-04). Hide the button on that AVD." (`docs/2026-09-30_dems_demo_stack_setup/identification/02_structured.md:264`, a hypothesis); the release-APK walk on `dems_tablet` / `emulator-5556` (`docs/2026-09-30_dems_demo_stack_setup/verification/12_package_verification.md:63`) records "Biometric prompt answered 'Not now'" (`:80`; whether that was an OS prompt or an app dialog is not stated there).

### 2.6 Web console frame

| Fact | Evidence |
|---|---|
| React 19.2.3, react-dom 19.2.3, Vite 8.3.1, Vitest 5.0.3, TypeScript 6.0.3 | `apps/core-web/package.json:30-31`, `:55`, `:56`, `:54` |
| Packaged build CSP: `default-src 'self'`; `script-src 'self'`; `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: blob:`; `connect-src 'self' ws://127.0.0.1:<port> ws://localhost:<port>` | `apps/core-web/src/lib/packaged-csp.ts:53-56`, `:60` |
| Rationale comment: `img-src data:` is for SVG data URLs; `style-src 'unsafe-inline'` because React and Motion write inline `style` attributes | `apps/core-web/src/lib/packaged-csp.ts:17-20` |

### 2.7 Expo SDK 57's bundled-module list (`node_modules/expo/bundledNativeModules.json`)

| Module | Bundled version | Line |
|---|---|---|
| expo-camera | `~57.0.6` | `:34` |
| expo-crypto | `~57.0.3` | `:40` |
| expo-local-authentication | `~57.0.3` | `:60` |
| expo-secure-store | `~57.0.4` | `:80` |
| react-native-svg | `15.15.4` | `:114` |
| react-native | `0.86.3` | `:103` |

A grep of the file for `vision-camera|keychain|mmkv|nitro|sensitive-info|camera-kit|barcode` returned 0 matches: none of those third-party libraries is listed as an Expo-bundled version for SDK 57.

## 3. Topic A: device credential storage on Android under Expo SDK 57

**Why it matters (what was found about the need).** The mobile app persists no secret today (section 2.4). Any module that holds a credential is a native addition, which changes the debug binary (section 7). The row asks four things per candidate: biometric-protected items, emulator behaviour, behaviour on reinstall, native rebuild need.

### 3.1 Android platform evidence (applies to all Keystore-based candidates)

| Finding | Source (FD 2026-10-04) | Method |
|---|---|---|
| "Key material never enters the application process." Key material "can be bound to the secure hardware of the Android device, such as the Trusted Execution Environment (TEE) or Secure Element (SE)." StrongBox KeyMint is available on "Android 9 (API level 28) or higher" devices that include it | https://developer.android.com/privacy-and-security/keystore | WF |
| "If a key only supports biometric credentials, the key is invalidated by default whenever new biometric enrollments are added." `setInvalidatedByBiometricEnrollment(false)` keeps it valid. The page does not state key lifetime on uninstall, and does not state anything about emulators (both "not stated") | same | WF |
| Auto Backup: shared preferences are backed up by default; "Data is restored whenever the app is installed, whether from the Play Store, during device setup ..., or by running `adb` install." `android:allowBackup=false` disables backups. For apps targeting Android 12+, on some manufacturers' devices `allowBackup=false` "disables cloud-based backup and restore ... but doesn't disable device-to-device transfers". Whether Keystore keys are in backups: not stated | https://developer.android.com/identity/data/autobackup | WF |
| `adb install -r`: "Reinstall an existing app, keeping its data." `adb install -d`: "Allow version code downgrade." `adb uninstall -k`: "Keep the data and cache directories after package removal." | https://developer.android.com/tools/adb | WF |
| Emulator fingerprint control: "This control can simulate 10 different fingerprint scans. You can use it to test fingerprint integration in your app." Disabled "for Android 5.1 (API level 22) and lower and for Wear OS". Steps: prepare an app to receive a fingerprint, select a Fingerprint value, click Touch Sensor. How to enrol via Settings: not stated on that page | https://developer.android.com/studio/run/emulator-extended-controls | WF |
| Secondary: `adb -e emu finger touch 1` simulates a scan (finger_id 1); enrolment needs API 23+ | WebSearch Q6 (Xamarin docs, DEV Community, Android docs among results) | WS (secondary) |
| AVD system images: "A system image labeled with Google APIs includes access to Google Play services." Images with Play Store include the Play Store app and Play services | https://developer.android.com/studio/run/managing-avds | WF |

### 3.2 Candidate A1: expo-secure-store

| Field | Value | Source |
|---|---|---|
| Version for SDK 57 | **57.0.4** (npm `latest` and `sdk-57` tags both 57.0.4; `next` 58.0.2; `canary` 58.0.0-canary-20260909-ea7a89a) | NPM `npm view expo-secure-store dist-tags` |
| Published / modified | 57.0.4 published 2026-09-11T11:29:40.940Z; `time.modified` 2026-10-01T19:30:01.231Z | NPM `time[57.0.4]`, `time.modified` |
| Licence | **MIT** | NPM; RAW `https://unpkg.com/expo-secure-store@57.0.4/package.json` |
| Dependencies / peers | `dependencies: {}`; `peerDependencies: { expo: '*' }`; unpacked size 220,613 B | RAW package.json; NPM |
| SDK 57 compatibility | Bundled at `~57.0.4` (`node_modules/expo/bundledNativeModules.json:80`); Expo SDK v57.0.0 docs page exists (`modificationDate: July 20, 2026`; `sourceCodeUrl` points at the `sdk-57` branch); platform line "Included in Expo Go"; RND flags `expoGo: true`, `newArchitecture: true`, repo `updatedAt` 2026-10-02T16:58:58Z | RAW https://docs.expo.dev/versions/v57.0.0/sdk/securestore.md; RND |
| Android storage | "On Android, values are stored in `SharedPreferences`, encrypted with Android's Keystore system." Source code: an AES key (GCM, no padding) generated in the Keystore with `KeyGenParameterSpec`; two Keystore entries exist per `keychainService`, one authenticated and one unauthenticated; `HybridAESEncryptor` (RSA wrapping) exists for API 22 and below | RAW securestore.md; RAW `raw.githubusercontent.com/expo/expo/sdk-57/packages/expo-secure-store/android/src/main/java/expo/modules/securestore/encryptors/AESEncryptor.kt` (`setBlockModes(BLOCK_MODE_GCM)`, `setUserAuthenticationRequired(options.requireAuthentication)` at lines 60-63; alias comment at lines 38-41), `HybridAESEncryptor.kt:26-28` |
| Biometric-protected items | Option `requireAuthentication`; "Android: Equivalent to `setUserAuthenticationRequired(true)` (requires API 23)"; "On Android, user authentication is required for all operations." `canUseBiometricAuthentication()` returns true "if the device supports biometric authentication and the enrolled method is sufficiently secure". Native side opens an `androidx.biometric` `BiometricPrompt` with the Keystore cipher (`AuthenticationHelper.authenticateCipher`), checks `canAuthenticate(BIOMETRIC_STRONG)` and throws "No biometrics are currently enrolled" or "No hardware available for biometric authentication" when unsuitable. Prompt title via `authenticationPrompt` | RAW securestore.md; RAW `AuthenticationHelper.kt` (sdk-57 branch); RAW `AuthenticationPrompt.kt` |
| Invalidation | "any data protected with the `requireAuthentication` option set to `true` will become inaccessible if there are changes to the user's biometric settings, such as adding a new fingerprint"; `getItemAsync` resolves `null` "if the key has been invalidated" | RAW securestore.md ("Data persistence", `getItemAsync`) |
| Emulator behaviour | Verbatim: "Note: This library requires a real device for testing since emulators/simulators do not require biometric authentication when retrieving secrets, unlike real iOS devices." Whether a biometric-protected item can be written and read on the three host AVDs: not confirmed (not run) | RAW securestore.md (`requireAuthentication` row of `SecureStoreOptions`) |
| Behaviour on reinstall | "On Android: Data saved using `expo-secure-store` will not be preserved upon app uninstallation." "app's entries are deleted from the Android Key Store when the app is uninstalled." The module "is designed to provide a persistent data storage solution across app restarts and updates." `adb install -r` keeps app data (section 3.1); what it does to a Keystore entry specifically: not confirmed. The plugin option `configureAndroidBackup` (default `true`) excludes the `SecureStore` shared-pref domain from Auto Backup; the app already sets `allowBackup=false` (`apps/mobile/app.json:23`) | RAW securestore.md ("Data persistence", "Android Auto Backup") |
| Synchronous API caveat | `getItem` / `setItem` "block the JavaScript thread" while `requireAuthentication` waits for the user; async variants exist | RAW securestore.md |
| Other API facts | Keys "may contain alphanumeric characters, `.`, `-`, and `_`"; value is a string; "Expo does not enforce a limit" on size | RAW securestore.md |
| Permission footprint | Library `AndroidManifest.xml` is empty (`<manifest></manifest>`). Gradle dependency `androidx.biometric:biometric:1.1.0`. The app's generated manifest already declares `USE_BIOMETRIC` and `USE_FINGERPRINT` (section 2.3). Whether `androidx.biometric` itself adds manifest entries on merge: not confirmed | RAW `unpkg.com/expo-secure-store@57.0.4/android/src/main/AndroidManifest.xml`; RAW `raw.githubusercontent.com/expo/expo/sdk-57/packages/expo-secure-store/android/build.gradle` |
| Native rebuild need | **Yes.** Native Android module `expo.modules.securestore.SecureStoreModule` (`expo-module.config.json`), autolinked; not in the installed app. Config plugin (`app.plugin.js`) is optional and carries two properties, `configureAndroidBackup` and `faceIDPermission` (iOS only); Expo: the plugin "allows you to configure various properties that cannot be set at runtime and require building a new app binary to take effect" | RAW `unpkg.com/expo-secure-store@57.0.4/expo-module.config.json`, `app.plugin.js`; RAW securestore.md |
| Maintenance | Part of the Expo monorepo; docs page last modified July 20, 2026 | RAW securestore.md frontmatter |

### 3.3 Candidate A2: react-native-keychain

| Field | Value | Source |
|---|---|---|
| Version | **10.0.0** (only dist-tag `latest`; no later version on npm) | NPM `dist-tags`, `time` |
| Published / modified | 2025-03-23T19:16:49.565Z / `time.modified` 2025-03-23T19:16:49.760Z | NPM |
| Licence | **MIT** | NPM; GH `license.spdx_id` |
| Dependencies / peers | `peerDependencies`: none declared (null); `engines: { node: '>=16' }`; unpacked size 230,397 B | NPM; RAW `unpkg.com/react-native-keychain@10.0.0/package.json` |
| SDK 57 compatibility | Not in Expo's bundled list (section 2.7). No vendor statement naming Expo SDK 57 or React Native 0.86 was found. RND: `newArchitecture: true`, `expoGo: null`, repo `updatedAt` 2026-04-29T12:37:20Z. Neither README nor `website/docs/index.md` / `usage.md` contains the word "expo" (grep returned no line). No `app.plugin*` file in the master git tree (tree listing filtered with regex `app.plugin`: no result) | RAW README and docs; GH git tree; RND |
| Repository signals | 3,480 stars, 194 open issues, not archived, `pushed_at` 2026-04-29T12:37:22Z. Latest GitHub tag and release `v10.0.0` (2025-03-23). Master has later commits: "feat: turbo module (#761)" (2026-03-23), "chore: add AGENTS.md (#791)" (2026-03-27), "chore: bump node and enable trusted publishing (#794)" (2026-04-29); npm has no version after 10.0.0 | GH `repos`, `releases`, `tags`, `commits` |
| Android storage | "On Android, values are stored in `Jetpack DataStore`, encrypted with Android's Keystore system." Storage types: `AES_GCM` and `RSA` ("with biometric protection"), `AES_GCM_NO_AUTH`, legacy `AES_CBC`. StrongBox used when the device supports it, otherwise the TEE | RAW `website/docs/platform-value-storage.md` (master) |
| Biometric-protected items | FAQ: "What happens if the user disables or drops biometric usage? ... The user will lose the ability to retrieve the secret from storage. If biometric access is re-enabled, access to the secret will be restored." Forcing `RSA` when biometrics are unavailable "will be rejected with an error related to the device's biometric configuration." The library "automatically applies the highest possible encryption" | RAW `website/docs/faq.md` |
| Emulator behaviour | Not stated in `website/docs/*` or README (grep for `emulator|simulator` in `index.md`, `usage.md`: no match) | RAW |
| Behaviour on reinstall | "Data stored using `react-native-keychain` is erased when the app is uninstalled. The exception is iOS, where stored data can persist across app reinstalls" | RAW `website/docs/data-persistence.md` |
| Permission footprint | Published 10.0.0 library manifest declares `android.permission.USE_BIOMETRIC` and `android.permission.USE_FINGERPRINT`. `RNKeychain_minSdkVersion=23`; dependencies `androidx.biometric:biometric:1.1.0@aar`, `androidx.datastore:datastore-preferences:1.1.1` | RAW `unpkg.com/react-native-keychain@10.0.0/android/src/main/AndroidManifest.xml`, `android/gradle.properties`; RAW master `android/build.gradle:77-93` |
| Native rebuild need | **Yes.** Native module with TurboModule codegen (`codegenConfig` name `RNKeychainSpec` in 10.0.0 `package.json`); README step 4: "Re-build your Android and iOS projects." No Expo config plugin | RAW package.json; RAW README line 22 |

### 3.4 Candidate A3: react-native-sensitive-info

| Field | Value | Source |
|---|---|---|
| Version | **6.1.5** (dist-tags: `latest` 6.1.5, `next` 6.0.0-rc.12, `beta` 5.2.5) | NPM |
| Published / modified | 2026-06-30T13:54:37.848Z / `time.modified` 2026-06-30T13:54:37.959Z | NPM |
| Licence | **MIT** | NPM; GH |
| Dependencies / peers | `peerDependencies`: `react`, `react-native`, `react-native-nitro-modules` (all `*`); `react-native-nitro-modules` 0.37.1, MIT, `time.modified` 2026-08-27T09:45:20.834Z; unpacked size 1,064,494 B | NPM |
| SDK 57 compatibility | Not in Expo's bundled list (section 2.7). README: "v6 requires the New Architecture (RN 0.76+) and `react-native-nitro-modules`"; table: React Native minimum 0.76.0, Android API 23. No statement naming Expo SDK 57 or RN 0.86. RND: `newArchitecture: true`, `expoGo: null`, `updatedAt` 2026-06-30T13:54:41Z. Repo: 1,066 stars, 25 open issues, `pushed_at` 2026-10-01T23:17:25Z, not archived (GH) | RAW README lines 11, 30-37; RND; GH |
| Android storage | README: "Hardware-backed secure storage for React Native. Secrets are encrypted with AES-GCM, gated by biometrics or device credentials, and stored in the system Keychain (iOS) or Android Keystore". "StrongBox requires API 28+; falls back to strongest available authenticator." Each entry "carries an HMAC-SHA256 integrity tag recomputed on every read" | RAW README lines 8, 37, 180 |
| Biometric-protected items | Option `accessControl` (default `'secureEnclaveBiometry'`; "native layer picks the strongest supported fallback"); `canUseAccessControl(policy)`; `useBiometryStatusWatcher()` "Subscribe[s] to biometric enrollment-state transitions"; Gradle dependency `androidx.biometric:biometric-ktx:1.4.0-alpha02` | RAW README lines 140, 163, 214; RAW `unpkg.com/react-native-sensitive-info@6.1.5/android/build.gradle:141` |
| Emulator behaviour | Verbatim troubleshooting line: "`authentication failed` on simulator: Secure Enclave and StrongBox are unavailable on simulators. Validate biometric policies on physical hardware." (the README says "simulator"; it does not name Android emulators) | RAW README line 215 |
| Behaviour on reinstall | Not stated in the README or `docs/EXPO.md` (grep for `uninstall|reinstall|backup`: no match) | RAW |
| Permission footprint | The library's own manifest is empty. The Expo plugin "adds the following Android permissions automatically": `USE_BIOMETRIC` (API 28+) and `USE_FINGERPRINT` with `maxSdkVersion="28"`. README manual setup lists both permissions. `SensitiveInfo_minSdkVersion=23` | RAW `docs/EXPO.md` lines 47-50; RAW README lines 58-65; RAW `android/gradle.properties`; RAW `android/src/main/AndroidManifest.xml` |
| Native rebuild need | **Yes.** Nitro native module. README: "Expo Go does not include native Nitro modules. Use a custom dev client or an EAS build."; add `"plugins": ["react-native-sensitive-info"]` to app.json, then `npx expo prebuild --clean`; package's `files` list in `package.json` includes an `app.plugin` entry (jq test on `.files` returned true); README on linking: "No manual linking required — Nitro handles autolinking." | RAW README lines 47, 67-82; RAW package.json |

### 3.5 Reference items (not candidates as a Keystore-backed secret store; collected because they are installed or are the named alternative)

| Item | Version, licence | Facts | Source |
|---|---|---|---|
| expo-local-authentication (installed) | 57.0.3 (`sdk-57` tag), MIT, published 2026-09-11T11:29:45.465Z; bundled `~57.0.3` (`bundledNativeModules.json:60`) | `authenticateAsync` "Attempts to authenticate via Fingerprint/TouchID (or FaceID if available on the device)" and returns `LocalAuthenticationResult`: a prompt and a verdict, no cipher or key. Android permissions added "through this library's AndroidManifest.xml": `USE_BIOMETRIC`, `USE_FINGERPRINT`. Library manifest (RAW) lists both. Gradle: `androidx.biometric:biometric:1.2.0-alpha04` (note: expo-secure-store uses `1.1.0`). Android option `biometricsSecurityLevel` ('strong' = Class 3). Native rebuild: already in the binary (plugin at `apps/mobile/app.json:47`) | RAW `docs.expo.dev/versions/v57.0.0/sdk/local-authentication.md` (modificationDate June 29, 2026); RAW `unpkg.com/expo-local-authentication@57.0.3/android/src/main/AndroidManifest.xml`, `android/build.gradle:18` |
| @react-native-async-storage/async-storage (installed) | 2.2.0 (`apps/mobile/package.json:28`) | Predecessor verification: "AsyncStorage is unencrypted at rest" (`09_mobile_security.md:210`). Already in the binary | REPO |
| react-native-mmkv | 4.3.2, MIT, published 2026-06-22T08:27:45.439Z; peers `react`, `react-native`, `react-native-nitro-modules` | README: "By default, MMKV stores all key-values in plain text on file, relying on iOS's/Android's sandbox ..."; optional `encryptionKey` and `encryptionType` ('AES-128' default, 'AES-256'); the key is supplied by the caller (README example `encryptionKey: 'hunter2'`). Expo: `npx expo install react-native-mmkv react-native-nitro-modules` then `npx expo prebuild`. A storage engine, not a Keystore-backed secret store (no Keystore statement in README). Native rebuild: **yes** (Nitro module). RND: `newArchitecture: true`, `web: true`, `updatedAt` 2026-08-29T09:34:05Z | RAW `raw.githubusercontent.com/mrousavy/react-native-mmkv/main/README.md` lines 72-80, 109-113, 126-127; NPM; RND |

### 3.6 Comparison table, topic A

| Candidate | Version | Licence | SDK 57 compatibility (as sourced) | Biometric-protected items | Emulator note (as sourced) | Reinstall (Android) | Native rebuild |
|---|---|---|---|---|---|---|---|
| expo-secure-store | 57.0.4 | MIT | Bundled `~57.0.4`; v57 docs page; dist-tag `sdk-57` | Yes, `requireAuthentication` (Keystore key + BiometricPrompt, API 23+) | Docs: "emulators/simulators do not require biometric authentication when retrieving secrets" | Not preserved on uninstall; Keystore entries deleted on uninstall | Yes (autolinked native module; plugin optional) |
| react-native-keychain | 10.0.0 | MIT | Not bundled; no SDK 57 / RN 0.86 statement; RND new-arch true | Yes (`AES_GCM` / `RSA` storage types with biometric protection) | Not stated | Erased on uninstall (Android) | Yes (TurboModule; no Expo plugin) |
| react-native-sensitive-info | 6.1.5 | MIT | Not bundled; requires New Architecture, RN >= 0.76, Nitro; no SDK 57 statement | Yes (`accessControl`, AES-GCM, biometric or device credential) | Troubleshooting names "simulators" only | Not stated | Yes (Nitro; plugin + `prebuild --clean`) |
| react-native-mmkv (reference) | 4.3.2 | MIT | Not bundled; Nitro; Expo install doc | No (caller-supplied encryption key) | Not stated | Not stated | Yes (Nitro) |
| expo-local-authentication (installed, reference) | 57.0.3 | MIT | Bundled `~57.0.3` | Prompt only; no key binding | Not stated in the v57 page | n/a | Already built in |

URLs with FD 2026-10-04 for this table: https://docs.expo.dev/versions/v57.0.0/sdk/securestore.md, https://docs.expo.dev/versions/v57.0.0/sdk/local-authentication.md, https://github.com/oblador/react-native-keychain (files via raw.githubusercontent.com), https://github.com/mCodex/react-native-sensitive-info (README, `docs/EXPO.md`), https://github.com/mrousavy/react-native-mmkv (README), https://www.npmjs.com/package/expo-secure-store and the other npm package pages (data read through `npm view`).

## 4. Topic B: QR rendering in React 19 web

**Why it matters.** The web console is Vite + React 19.2.3 (section 2.6) and ships a packaged build whose CSP is `img-src 'self' data: blob:`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'` (`packaged-csp.ts:53-56`). Output type (inline SVG element, canvas, data URL, string) is a property of each library.

### 4.1 Package facts (NPM, FD 2026-10-04)

| Candidate | Version | Licence | Latest published | Peer deps | Runtime deps | Types / module | Unpacked size |
|---|---|---|---|---|---|---|---|
| qrcode.react | **4.2.0** | **ISC** (`LICENSE`: "ISC License, Copyright (c) 2015, Paul O'Shannessy") | 2024-12-11T17:22:40.569Z | `react: ^16.8.0 \|\| ^17.0.0 \|\| ^18.0.0 \|\| ^19.0.0` | none | `types ./lib/index.d.ts`; `main ./lib/index.js`; `module ./lib/esm/index.js` | 114,980 B |
| react-qr-code | **2.2.0** | **MIT** | 2026-06-09T12:09:13.049Z | `react: '*'` | `prop-types ^15.8.1`, `qrcode-generator ^2.0.4` | `types types/index.d.ts`; `main lib/index.js`; `module lib/index.mjs` | 19,921 B |
| qrcode (node-qrcode) | **1.5.4** | **MIT** | 2024-08-05T21:52:58.518Z | none (not a React package) | `pngjs ^5.0.0`, `yargs ^15.3.1`, `dijkstrajs ^1.0.1`; `engines node >=10.13.0` | `main ./lib/index.js`; no `types` field printed | 135,364 B |
| uqr | **0.1.3** | **MIT** | 2026-04-03T01:23:47.609Z (first published 2023-08-04) | none | none ("zero dependency") | `type: module`; `types ./dist/index.d.ts` | 79,278 B |
| react-qrcode-logo | **4.1.0** | **MIT** | 2026-05-02T19:54:56.748Z | `react >=18.0.0`, `react-dom >=18.0.0` | `qrcode-generator ^2.0.4` | `types dist/esm/index.d.ts`; `main dist/cjs/index.js`; `module dist/esm/index.js` | 403,136 B |

Each package's `dist-tags` has only `latest` (qrcode also has `beta` 0.8.2). None is marked deprecated in the registry (`deprecated` printed no value).

### 4.2 Candidate details

| Candidate | Output and API (RAW README) | React 19 and Expo SDK 57 status | Native rebuild need | Source |
|---|---|---|---|---|
| qrcode.react 4.2.0 | "exports two components, supporting rendering as SVG or Canvas. SVG is generally recommended as it is more flexible, but Canvas may be preferable." `QRCodeSVG`, `QRCodeCanvas`; props `value`, `size`, `level` ('L'\|'M'\|'Q'\|'H'), `bgColor`, `fgColor`, `marginSize` (`includeMargin` deprecated), `minVersion`, `boostLevel`, `imageSettings`. Secondary: a search summary says it "supports React 16.8 through 19" (WS, matches the declared peer range) | React 19: declared in the peer range (primary). Expo SDK 57: not applicable to the web console (Vite, not Expo) | **None** (DOM component; no native build step in package metadata read) | RAW https://raw.githubusercontent.com/zpao/qrcode.react/main/README.md lines 15-110; RAW `unpkg.com/qrcode.react@4.2.0/package.json`; NPM |
| react-qr-code 2.2.0 | "A <QRCode /> component for React. This library works with React and React Native (using React Native SVG)." Props `value`, `size` (256), `level` ('L' default), `bgColor`, `fgColor`, `title` (web). "can store up to 2953 characters in `value`". For React Native "you will also need to have `react-native-svg` installed" (installed at `apps/mobile/package.json:64`) | React 19: peer `*`, so declared-compatible with any React; a search summary says it "includes React 19 support with render() return type updates" (WS, secondary; not confirmed from a primary source). Expo SDK 57: not applicable to web | **None** on web. In React Native it relies on `react-native-svg`, already in the binary | RAW https://raw.githubusercontent.com/rosskhanas/react-qr-code/master/README.md lines 5, 26, 69-76; RAW `unpkg.com/react-qr-code@2.2.0/package.json` |
| qrcode 1.5.4 | "Works on server and client (and react native with svg)". Browser use "through module bundlers like Browserify and Webpack or by including the precompiled bundle"; APIs `toCanvas`, `toDataURL`, `toString` (types `png`, `svg`, `utf8`); error level via `options.errorCorrectionLevel`. Not a React component: an imperative function library (wrapper needed) | No React dependency. Last release 2024-08-05 | **None** | RAW https://raw.githubusercontent.com/soldair/node-qrcode/master/README.md lines 23, 79-80, 127-160, 185 |
| uqr 0.1.3 | "Generate QR Code universally, in any runtime, to ANSI, Unicode or SVG. ES module , zero dependency, tree-shakable." `encode` returns a 2D boolean array; `renderSVG(text, options)`; `renderUnicode`, `renderANSI`. Not a React component | No React dependency; ESM only (`type: module`) | **None** | RAW https://raw.githubusercontent.com/unjs/uqr/main/README.md lines 11, 29-37, 52-63, 104 |
| react-qrcode-logo 4.1.0 | Canvas-based `<QRCode />`; props `ecLevel` (default `M`), `logoImage` (url, path or base64), `pixelRatio` (default `window.devicePixelRatio`), `id`, `style` (CSS on the canvas); non-React helpers such as `generateCanvas` returning `Promise<HTMLCanvasElement>` | React: peer `react >=18.0.0`, `react-dom >=18.0.0`. Unpacked size 403,136 B (largest of the five) | **None** | RAW https://raw.githubusercontent.com/gcoro/react-qrcode-logo/master/README.md lines 37-56, 74-82; RAW NPM |

Third-party comparison (secondary): search results state that `react-qr-svg` is deprecated with the author message "qrcode.react has SVG support now, please use it instead" (WS Q9). `react-qr-svg` was not collected as a candidate for that reason.

URLs with FD 2026-10-04: https://www.npmjs.com/package/qrcode.react, https://www.npmjs.com/package/react-qr-code, https://www.npmjs.com/package/qrcode, https://www.npmjs.com/package/uqr, https://www.npmjs.com/package/react-qrcode-logo (data via `npm view`), plus the README URLs in the table.

## 5. Topic C: QR scanning in React Native 0.86 on Expo (Android)

**Why it matters.** The app has no camera module and no `CAMERA` permission today (sections 2.1, 2.3). The three host AVDs have no emulated camera configured (`hw.camera.back=none`, `hw.camera.front=none`, section 2.5) and are Google APIs images without the Play Store (`PlayStore.enabled=no`).

### 5.1 Android emulator camera facts (applies to all in-app scanners)

| Finding | Source (FD 2026-10-04) | Method |
|---|---|---|
| "Select an option for any enabled cameras. The Emulated and VirtualScene settings produce a software-generated image, while the Webcam setting uses your development computer's webcam to take a picture". "Camera options are available only if a camera is supported in the hardware profile." | https://developer.android.com/studio/run/managing-avds | WF |
| "When using the emulator with a camera app, you can import an image in PNG or JPEG format to be used within a virtual scene. To choose an image for use in a virtual scene, open the Extended controls window, select the Camera > Virtual scene images tab, and click Add image. This feature can be used to import custom images such as QR codes for use with any camera-based app." | https://developer.android.com/studio/run/emulator-use-camera | WF |
| "You can load pictures into the scene that is simulated when you open the emulator camera." | https://developer.android.com/studio/run/emulator-extended-controls | WF |
| Secondary: "The emulator's ability to truly emulate the way Android cameras behave is very limited." (a search-result summary; not a statement from the Android pages above) | WebSearch Q3 | WS (secondary) |

### 5.2 Candidate C1: expo-camera (two Android scanning modes)

| Field | Value | Source |
|---|---|---|
| Version for SDK 57 | **57.0.6** (npm `latest` and `sdk-57`; `next` 58.0.8) | NPM `dist-tags` |
| Published / modified | 57.0.6 published 2026-09-29T10:58:08.145Z; `time.modified` 2026-10-03T13:01:55.598Z | NPM |
| Licence | **MIT** | NPM; RAW package.json |
| Dependencies / peers | `dependencies: { barcode-detector: ^3.0.0 }` (web scanning); peers `expo`, `react`, `react-native`, `react-native-web` (all `*`); unpacked size 30,737,914 B | RAW `unpkg.com/expo-camera@57.0.6/package.json`; NPM |
| SDK 57 compatibility | Bundled `~57.0.6` (`bundledNativeModules.json:34`); v57 docs page (`modificationDate: August 13, 2026`); "Included in Expo Go"; RND `expoGo: true`, `web: true`, `newArchitecture: true`, `updatedAt` 2026-10-03T12:44:15Z | RAW https://docs.expo.dev/versions/v57.0.0/sdk/camera.md; RND |
| Mode 1: in-app preview scanning | `CameraView` with `barcodeScannerSettings={{ barcodeTypes: ["qr"] }}` and `onBarcodeScanned` (callback receives `type` and `data`); permission via `useCameraPermissions()`; "Only one Camera preview can be active at any given time." | RAW camera.md ("Usage", `CameraView`, `barcodeScannerSettings`, `onBarcodeScanned`) |
| Mode 2: system scanner UI | `launchScanner(options)`: "On Android, we will use the Google code scanner." Results via `onModernBarcodeScanned(listener)`; also `isModernBarcodeScannerAvailable`, `dismissScanner()` | RAW camera.md (`launchScanner`, `onModernBarcodeScanned`) |
| Android native stack | CameraX `1.6.0`; `androidx.camera:camera-mlkit-vision`; `com.google.android.gms:play-services-code-scanner:16.1.0`; `com.google.mlkit:barcode-scanning:17.3.0`; barcode libraries are `implementation` unless property `expo.camera.barcode-scanner-enabled=false` (then `compileOnly`) | RAW `unpkg.com/expo-camera@57.0.6/android/build.gradle:9-10,28-45` |
| Emulator support | Platform line (RAW): "Android (device only), iOS (device only), Web, Included in Expo Go"; frontmatter `platforms: ['android*', 'ios*', 'web', 'expo-go']`. `isAvailableAsync()`: "This is useful for web and simulators cases." The page has no statement on Android emulators beyond the "device only" label. Whether mode 1 works on the host AVDs (cameras `none`): not confirmed. Whether mode 2's Google code scanner module can load on a Google APIs AVD: not confirmed (see 5.3) | RAW camera.md lines 9, 40, 517 |
| Permission footprint | Library manifest declares `android.permission.CAMERA` and `<meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="barcode_ui"/>`. The config plugin, when listed in `plugins`, adds `CAMERA` and, by default (`recordAudioAndroid = true`), `RECORD_AUDIO`; docs: `recordAudioAndroid` "Only for: Android. A boolean that determines whether to enable the `RECORD_AUDIO` permission". Docs for apps without prebuild: "`expo-camera` automatically adds `android.permission.CAMERA`". Whether `launchScanner` triggers a runtime camera-permission request on the app side: not confirmed | RAW `unpkg.com/expo-camera@57.0.6/android/src/main/AndroidManifest.xml`; RAW `unpkg.com/expo-camera@57.0.6/plugin/build/withCamera.js`; RAW camera.md ("Configurable properties", "Are you using this library in an existing React Native app?") |
| Plugin options | `cameraPermission`, `microphonePermission` (iOS), `recordAudioAndroid` (default true), `barcodeScannerEnabled` (default true): "Disabling this reduces app size when barcode scanning is not needed. On Android, this option only takes effect when `expo-camera` builds from source. Prebuilt modules already include the barcode scanning libraries." | RAW camera.md lines 110-113 |
| Native rebuild need | **Yes.** Native Android module with permission and manifest changes; Expo: regenerate native directories when "Installing or updating a library containing native code" or "Changing your app config (app.json)" with `npx expo prebuild --clean` (the repo's `prebuild` script has no `--clean`, `apps/mobile/package.json:15`) | RAW https://docs.expo.dev/develop/development-builds/introduction.md ("Rebuild when native code changes", modificationDate September 10, 2026) |

### 5.3 Google code scanner (the Android engine behind `launchScanner`, also used by data-scanner)

| Finding | Source (FD 2026-10-04) | Method |
|---|---|---|
| "The Google code scanner API provides a complete solution for scanning code without requiring your app to request camera permission, while preserving user privacy." | https://developers.google.com/ml-kit/vision/barcode-scanning/code-scanner | WF |
| "This API uses an unbundled library that must be downloaded before use." It "delegates the task of scanning the code to Google Play services." Module delivery options: manifest meta-data `com.google.mlkit.vision.DEPENDENCIES` = `barcode_ui` (download at install from the Play Store), the `ModuleInstallClient` API, or download on first use | same | WF |
| "This API requires Android API level 23 or above." (the page's introduction says level 21; the setup section says 23). Dependency shown: `implementation 'com.google.android.gms:play-services-code-scanner:16.1.0'`. Emulator support: not stated on the page | same | WF |
| Secondary: forum search results (Q8) describe `NoClassDefFoundError` and blank-screen problems with `GmsBarcodeScanning` as dependency or configuration issues; no emulator-specific statement was found | WebSearch Q8 | WS (secondary) |

### 5.4 Candidate C2: react-native-vision-camera 5.x with react-native-vision-camera-barcode-scanner

| Field | Value | Source |
|---|---|---|
| Versions | react-native-vision-camera **5.2.3** (published 2026-08-20T18:39:52.761Z; dist-tags `latest` 5.2.3, `beta` 5.0.0-beta.12, `rc` 3.0.0-rc.10, `vc2` 2.16.8, `expo` 2.9.4-expo.11); react-native-vision-camera-barcode-scanner **5.2.3** (published 2026-08-20T18:39:57.990Z); react-native-nitro-modules **0.37.1**; react-native-nitro-image **0.15.2** (published 2026-08-20T17:50:09.416Z) | NPM |
| Licence | **MIT** for all four | NPM |
| Peers | vision-camera: `react`, `react-native`, `react-native-nitro-modules`, `react-native-nitro-image` (all `*`); barcode-scanner: those plus `react-native-vision-camera` | NPM |
| SDK 57 compatibility | Not in Expo's bundled list (section 2.7). Vendor: "VisionCamera is a third-party native package and runs in an Expo Development Build (`expo prebuild`), or in a bare React Native app"; comparison table row "Works in Expo Go": VisionCamera ❌, Expo Camera ✅. RND: `newArchitecture: "new-arch-only"`, `expoGo: null`, `updatedAt` 2026-08-29T09:44:56Z; the app's `newArchEnabled=true` is at `apps/mobile/android/gradle.properties:38`. No vendor statement naming Expo SDK 57 or React Native 0.86 was found in the pages fetched. The npm `expo` dist-tag points at `2.9.4-expo.11` | RAW https://visioncamera.margelo.com/docs/visioncamera-vs-expo-camera.md lines 17, 60-63; RND |
| Install steps | Install `react-native-vision-camera`, `react-native-nitro-modules`, `react-native-nitro-image`; the scanner is a separate package ("so you only pull in MLKit's native dependencies if you actually need them", WF paraphrase of the vendor blog); Expo: add permissions to app config then `npx expo prebuild`, `npx expo run:android` | RAW https://visioncamera.margelo.com/docs.md lines 48-53, 76-95, 143-167; WF https://margelo.com/blog/react-native-qr-barcode-scanner-visioncamera-v5 |
| QR scanning API | "The Barcode Scanner ... detect[s] machine readable codes (like Barcodes or QR codes) using MLKit"; ships a `<CodeScanner />` view (props `isActive`, `barcodeFormats`, `onBarcodeScanned`, `onError`), a `CameraOutput`, and a frame-processor plugin; "The Barcode Scanner requires react-native-vision-camera-barcode-scanner to be installed." Works on iOS and Android | RAW https://visioncamera.margelo.com/docs/barcode-scanner.md |
| Android native stack | Core: CameraX `1.7.0-alpha03` (pre-release version string), `minSdkVersion` 23, `targetSdk` 36. Scanner: `com.google.mlkit:barcode-scanning:17.3.0` (bundled model) | RAW `unpkg.com/react-native-vision-camera@5.2.3/android/build.gradle:146`, `android/gradle.properties`; RAW `unpkg.com/react-native-vision-camera-barcode-scanner@5.2.3/android/build.gradle:145`, `android/gradle.properties` |
| Emulator support | Not stated in the vendor pages fetched (docs.md, barcode-scanner.md, visioncamera-vs-expo-camera.md, visioncamera-vs-data-scanner.md, blog). Not confirmed | RAW; WF |
| Permission footprint | Vendor Expo setup: `android.permissions` = `["android.permission.CAMERA", "android.permission.RECORD_AUDIO"]` in app config (`RECORD_AUDIO` "optionally"). Library manifests declare `uses-feature android.hardware.camera required="false"` (core also microphone `required="false"`); neither library manifest declares `uses-permission`. Vendor blog: add `android.permission.CAMERA` | RAW docs.md lines 82-97, 120-131; RAW `unpkg.com/react-native-vision-camera@5.2.3/android/src/main/AndroidManifest.xml`; RAW barcode-scanner manifest |
| Repository signals | The GitHub API call for `mrousavy/react-native-vision-camera` returned a rate-limit error (null fields); RND lists the repo under `margelo/react-native-vision-camera`. README states "As VisionCamera V5 is released, VisionCamera V4 is no longer actively maintained." Stars and issue counts: not collected | GH (failed); RND; RAW README line 49 |
| Native rebuild need | **Yes.** Four packages with native code (two Nitro hybrid-object libraries, camera, scanner), app-config permission change, `expo prebuild`, new binary | RAW docs.md; Expo dev-build doc (5.2) |

### 5.5 Candidate C3: react-native-camera-kit

| Field | Value | Source |
|---|---|---|
| Version | **18.0.1** (dist-tags `latest` 18.0.1, `beta` 14.0.0-beta15, `alpha` 7.1.0, `torch` 6.6.0, `hotfix` 5.0.0-hotfix.1) | NPM |
| Published / modified | 2026-08-03T22:09:55.190Z / 2026-08-03T22:09:55.357Z | NPM |
| Licence | **MIT** | NPM |
| Peers / engines | `react: '*'`, `react-native: '*'`; `engines node >=18`; unpacked size 293,332 B | NPM |
| SDK 57 compatibility | Not in Expo's bundled list (section 2.7). The README contains no line with "expo" (grep returned none). RND: `newArchitecture: true`, `expoGo: null`, `updatedAt` 2026-08-03T22:09:46Z. No statement naming SDK 57 or RN 0.86 found. Declared peers `*` | RAW README; RND |
| QR scanning API | README: "QR / Barcode scanning support"; props `scanBarcode={true}`, `onReadCode`, `showFrame`, `allowedBarcodeTypes` | RAW https://raw.githubusercontent.com/teslamotors/react-native-camera-kit/master/README.md lines 27, 158-168, 228 |
| Android native stack | CameraX `1.4.2`; `com.google.mlkit:barcode-scanning:17.3.0` (build.gradle:69); also `play-services-mlkit-face-detection:17.1.0` (:70; README: face detection on Android "requires a Google Play Store device"); `minSdkVersion = 24` | RAW `unpkg.com/react-native-camera-kit@18.0.1/android/build.gradle:23,54,69-70`; RAW README line 178 |
| Emulator support | README feature list: "Camera preview support in iOS simulator" (iOS only); nothing about Android emulators. Not confirmed | RAW README line 29 |
| Permission footprint | Library manifest declares `CAMERA`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`. README: "You must use a separate library for prompting the user for permissions before rendering the `<Camera .../>` component." and "If you fail to prompt for permission, the camera will appear blank / black." (the app already lists `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` as blocked: `apps/mobile/app.json:24-28`) | RAW `unpkg.com/react-native-camera-kit@18.0.1/android/src/main/AndroidManifest.xml`; RAW README lines 50-54, 116-120 |
| Native rebuild need | **Yes.** Native module with no Expo config plugin documented | RAW README; NPM |

### 5.6 Candidate C4: react-native-data-scanner (named by the vision-camera vendor as the one-shot alternative)

| Field | Value | Source |
|---|---|---|
| Version | **0.1.2**; `time.modified` 2026-06-08T09:30:46.966Z | NPM |
| Licence | **MIT** | NPM |
| Peers | `react`, `react-native`, `react-native-nitro-modules` (`*`) | NPM |
| SDK 57 compatibility | Not in Expo's bundled list. No SDK 57 / RN 0.86 statement found (its own README was not retrievable: raw URL `.../react-native-data-scanner/main/README.md` returned HTTP 404). Not confirmed | RAW (404); NPM |
| Vendor description (secondary to the package itself) | "On Android, it uses Google's Code Scanner through Google Play Services. That scanner is presented in a separate Activity, so your app does not need `android.permission.CAMERA` permission for this flow." Comparison row "Works without Camera permission (on Android)": data-scanner yes, VisionCamera no | RAW https://visioncamera.margelo.com/docs/visioncamera-vs-data-scanner.md lines 19, 43-44 |
| Package facts | Library manifest has only the meta-data `com.google.mlkit.vision.DEPENDENCIES` = `barcode_ui` (no `uses-permission`); Gradle: `play-services-code-scanner:16.1.0`, depends on `react-native-nitro-modules`; `NitroDataScanner_minSdkVersion=23` | RAW `unpkg.com/react-native-data-scanner@0.1.2/android/src/main/AndroidManifest.xml`, `android/build.gradle:142`, `android/gradle.properties` |
| Native rebuild need | **Yes** (Nitro native module) | RAW build.gradle |

### 5.7 Item C5: expo-barcode-scanner (found, not available for SDK 57)

| Field | Value | Source |
|---|---|---|
| Version | `latest` **13.0.1** = tag `sdk-51`; no `sdk-57` tag (tags: `sdk-50` 12.9.3, `sdk-51` 13.0.1, `latest`, `canary`, `next` 14.0.1). Published 2024-04-23T02:08:12.856Z | NPM |
| Licence | **MIT** | NPM |
| SDK 57 status | Not in `bundledNativeModules.json` (grep count 0 for `barcode`); `https://docs.expo.dev/versions/v57.0.0/sdk/bar-code-scanner.md` returned HTTP 404 ("No markdown exists for this path"). Secondary: "expo-barcode-scanner is now deprecated as of SDK 51, and users should use expo-camera instead" (WS Q5) | NPM; RAW; WS (secondary) |
| Native rebuild need | Not applicable (no SDK 57 version) | |

### 5.8 Comparison table, topic C

| Candidate | Version | Licence | SDK 57 / RN 0.86 compatibility (as sourced) | Emulator note (as sourced) | Android permission footprint | ML engine | Native rebuild |
|---|---|---|---|---|---|---|---|
| expo-camera (CameraView + launchScanner) | 57.0.6 | MIT | Bundled `~57.0.6`; v57 docs | Docs: "Android (device only)"; AVD cameras `none`; QR images can be loaded into the virtual scene (Android docs) | `CAMERA` (manifest); `RECORD_AUDIO` added by plugin by default; Google code scanner path: no app camera permission per Google (app-side behaviour not confirmed) | ML Kit barcode 17.3.0 and Google code scanner 16.1.0 | Yes |
| react-native-vision-camera + barcode-scanner | 5.2.3 + 5.2.3 (nitro-modules 0.37.1, nitro-image 0.15.2) | MIT | Not bundled; dev build required; new-arch-only; no SDK 57 statement | Not stated | `CAMERA` (+ optional `RECORD_AUDIO`) via app config | ML Kit barcode 17.3.0 (bundled) | Yes |
| react-native-camera-kit | 18.0.1 | MIT | Not bundled; no Expo statement; RND new-arch true | Not stated (iOS simulator only mentioned) | `CAMERA`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` in library manifest | ML Kit barcode 17.3.0 | Yes |
| react-native-data-scanner | 0.1.2 | MIT | Not bundled; no statement found | Not stated | No `uses-permission` in manifest | Google code scanner 16.1.0 | Yes |
| expo-barcode-scanner | 13.0.1 (sdk-51) | MIT | No SDK 57 version; v57 docs 404 | n/a | n/a | n/a | n/a |

URLs with FD 2026-10-04: https://docs.expo.dev/versions/v57.0.0/sdk/camera.md, https://visioncamera.margelo.com/docs.md, https://visioncamera.margelo.com/docs/barcode-scanner.md, https://visioncamera.margelo.com/docs/visioncamera-vs-expo-camera.md, https://visioncamera.margelo.com/docs/visioncamera-vs-data-scanner.md, https://margelo.com/blog/react-native-qr-barcode-scanner-visioncamera-v5, https://github.com/teslamotors/react-native-camera-kit, https://developers.google.com/ml-kit/vision/barcode-scanning/code-scanner, https://developer.android.com/studio/run/emulator-use-camera.

## 6. Native rebuild need, per candidate (summary)

How verified: Expo's "Rebuild when native code changes" section (RAW https://docs.expo.dev/develop/development-builds/introduction.md, FD 2026-10-04): "You only need to regenerate the native directories (android and ios) when: Installing or updating a library containing native code; Changing your app config (app.json); Upgrading your Expo SDK version", with `npx expo prebuild --clean`; plus each package's native-module evidence above. Repo side: `apps/mobile/package.json:9` (`build` script: prebuild then `assembleDebug`) and `:15` (`prebuild` without `--clean`); the generated `android/` is git-ignored and regenerated by prebuild (`with-dems-release-signing.js:1-5`, `apps/mobile/.gitignore:43`). This task's blueprint records the uninstall-before-install question as assumption H-B6 and item MJ-7 (`identification/02_structured.md:162`, `:253`); not probed here.

| Topic | Candidate | Native code | New debug binary | App-config change involved | Evidence |
|---|---|---|---|---|---|
| A | expo-secure-store 57.0.4 | Yes (Kotlin module + `androidx.biometric` 1.1.0) | Yes | Optional plugin entry (`configureAndroidBackup`) | 3.2 |
| A | react-native-keychain 10.0.0 | Yes (TurboModule) | Yes | None documented (no plugin) | 3.3 |
| A | react-native-sensitive-info 6.1.5 | Yes (Nitro) | Yes | Plugin entry + `prebuild --clean` (vendor) | 3.4 |
| A (ref) | react-native-mmkv 4.3.2 | Yes (Nitro) | Yes | `expo prebuild` (vendor) | 3.5 |
| A (ref) | expo-local-authentication 57.0.3 | Yes | Already built in | Already at `app.json:47` | 3.5 |
| B | qrcode.react 4.2.0 | No | No (web bundle only) | None | 4.2 |
| B | react-qr-code 2.2.0 | No (uses `react-native-svg` on mobile, already present) | No | None | 4.2 |
| B | qrcode 1.5.4 | No | No | None | 4.2 |
| B | uqr 0.1.3 | No | No | None | 4.2 |
| B | react-qrcode-logo 4.1.0 | No | No | None | 4.2 |
| C | expo-camera 57.0.6 | Yes | Yes | Plugin entry optional; adds `CAMERA` (+ `RECORD_AUDIO` by default) | 5.2 |
| C | react-native-vision-camera 5.2.3 + barcode-scanner 5.2.3 | Yes (+ two Nitro libs) | Yes | Permissions in app config; `expo prebuild` | 5.4 |
| C | react-native-camera-kit 18.0.1 | Yes | Yes | None documented for Expo | 5.5 |
| C | react-native-data-scanner 0.1.2 | Yes (Nitro) | Yes | None documented | 5.6 |

## 7. Query log

**Confidentiality check.** Every web query and fetched URL below is a generic technology query (library names, platform documentation, standards). No project name, product name, personal name, file content or design-document term was used in any query or URL. A scan of this section for the project and product names and for domain terms of the task's design material found none.

### 7.1 WebSearch queries (exact strings)

| # | Query string | Use |
|---|---|---|
| Q1 | `expo-secure-store Android Keystore requireAuthentication biometric emulator` | Discovery of Expo SecureStore docs |
| Q2 | `react-native-keychain Android Expo development build prebuild biometrics emulator uninstall` | Discovery; secondary results only (blogs), not relied upon |
| Q3 | `Android Emulator virtual scene camera webcam AVD camera back front configuration` | Emulator camera options |
| Q4 | `react-native-vision-camera v5 code scanner QR Expo config plugin Android requirements` | Discovery of vendor blog and docs |
| Q5 | `expo-barcode-scanner removed deprecated replaced by expo-camera CameraView SDK 51 SDK 52` | Status of the legacy scanner module |
| Q6 | `Android Emulator extended controls fingerprint touch sensor enroll biometric test` | Emulator fingerprint |
| Q7 | `adb install -r replace existing application keeps app data uninstall -k keep data and cache directories` | Cross-check of adb options (secondary) |
| Q8 | `ML Kit Google code scanner GmsBarcodeScanning Android emulator not working Google Play services module download` | Emulator and Play services (secondary only) |
| Q9 | `React 19 QR code generator component SVG library comparison qrcode.react react-qr-code` | Discovery of QR rendering candidates (secondary) |

### 7.2 WebFetch URLs (tool pass-through summariser; results labelled WF above)

1. https://docs.expo.dev/versions/v57.0.0/sdk/securestore/
2. https://github.com/oblador/react-native-keychain (tool returned no technical content; discarded)
3. https://oblador.github.io/react-native-keychain/ (redirect page only; discarded)
4. https://developers.google.com/ml-kit/vision/barcode-scanning/code-scanner
5. https://developer.android.com/studio/run/managing-avds
6. https://developer.android.com/studio/run/emulator-use-camera
7. https://margelo.com/blog/react-native-qr-barcode-scanner-visioncamera-v5
8. https://developer.android.com/privacy-and-security/keystore
9. https://developer.android.com/studio/run/emulator-extended-controls
10. https://developer.android.com/identity/data/autobackup
11. https://developer.android.com/tools/adb

### 7.3 Direct fetches with `curl` (byte-exact, labelled RAW above), all FD 2026-10-04

- docs.expo.dev: `/versions/v57.0.0/sdk/securestore.md`, `/versions/v57.0.0/sdk/camera.md`, `/versions/v57.0.0/sdk/local-authentication.md`, `/versions/v57.0.0/sdk/bar-code-scanner.md` (HTTP 404), `/develop/development-builds/introduction.md`, `/workflow/continuous-native-generation.md`, `/llms.txt`
- unpkg.com (published tarball files): `expo-secure-store@57.0.4/{package.json, android/src/main/AndroidManifest.xml, app.plugin.js, expo-module.config.json}`; `expo-camera@57.0.6/{package.json, android/src/main/AndroidManifest.xml, android/build.gradle, plugin/build/withCamera.js}`; `expo-local-authentication@57.0.3/{android/src/main/AndroidManifest.xml, android/build.gradle}`; `expo-barcode-scanner@13.0.1/README.md`; `react-native-keychain@10.0.0/{package.json, android/src/main/AndroidManifest.xml, android/gradle.properties}`; `react-native-sensitive-info@6.1.5/{android/gradle.properties, android/src/main/AndroidManifest.xml, android/build.gradle}`; `react-native-vision-camera@5.2.3/{package.json, android/src/main/AndroidManifest.xml, android/build.gradle, android/gradle.properties}`; `react-native-vision-camera-barcode-scanner@5.2.3/{android/src/main/AndroidManifest.xml, android/build.gradle, android/gradle.properties}`; `react-native-camera-kit@18.0.1/android/{src/main/AndroidManifest.xml, build.gradle}`; `react-native-data-scanner@0.1.2/android/{src/main/AndroidManifest.xml, build.gradle, gradle.properties}`; `qrcode.react@4.2.0/{LICENSE, package.json}`; `react-qr-code@2.2.0/package.json`
- raw.githubusercontent.com: `expo/expo/sdk-57/packages/expo-secure-store/android/{build.gradle, src/main/java/expo/modules/securestore/{AuthenticationHelper.kt, AuthenticationPrompt.kt, encryptors/AESEncryptor.kt, encryptors/HybridAESEncryptor.kt, encryptors/KeyBasedEncryptor.kt}}`; `oblador/react-native-keychain/master/{README.md, package.json, android/build.gradle, android/src/main/AndroidManifest.xml, website/docs/{index,usage,data-persistence,platform-value-storage,faq}.md}`; `mCodex/react-native-sensitive-info/master/{README.md, docs/EXPO.md, package.json}`; `mrousavy/react-native-mmkv/main/{README.md, docs/ENCRYPTION.md (404)}`; `mrousavy/react-native-vision-camera/main/README.md`; `teslamotors/react-native-camera-kit/master/README.md`; `mrousavy/react-native-data-scanner/main/README.md` (404); `zpao/qrcode.react/main/README.md`; `rosskhanas/react-qr-code/master/README.md`; `unjs/uqr/main/README.md`; `soldair/node-qrcode/master/README.md`; `gcoro/react-qrcode-logo/master/README.md`
- visioncamera.margelo.com: `/llms.txt`, `/docs.md`, `/docs/visioncamera-vs-expo-camera.md`, `/docs/visioncamera-vs-data-scanner.md`, `/docs/barcode-scanner.md`
- api.github.com (unauthenticated): `repos/expo/expo/git/trees/sdk-57?recursive=1`; `repos/oblador/react-native-keychain` (+ `/releases`, `/commits`, `/tags`, `/git/trees/master?recursive=1`); `repos/mCodex/react-native-sensitive-info`; `repos/mrousavy/react-native-vision-camera` (rate-limit error)
- reactnative.directory: `/api/libraries?search=<pkg>&limit=3` for react-native-keychain, react-native-sensitive-info, react-native-vision-camera, react-native-camera-kit, expo-secure-store, expo-camera, react-native-mmkv

### 7.4 npm registry lookups (read-only, `NPM_CONFIG_CACHE="$TMPDIR/npm-cache" npm view ...`)

Fields `version license time.modified peerDependencies` for: expo-secure-store, react-native-keychain, react-native-mmkv, react-native-sensitive-info, expo-local-authentication, qrcode.react, react-qr-code, qrcode, uqr, react-qrcode-logo, expo-camera, react-native-vision-camera, react-native-camera-kit, expo-barcode-scanner, react-native-vision-camera-barcode-scanner, react-native-nitro-modules, react-native-nitro-image, react-native-data-scanner. Fields `dist-tags deprecated dist.unpackedSize repository.url homepage engines dependencies` for the same sets. `time[<version>]` for the pinned versions. Raw output of the first batch (abridged to the result lines):

```
expo-secure-store      version = '57.0.4'  license = 'MIT'  time.modified = '2026-10-01T19:30:01.231Z'  peerDependencies = { expo: '*' }
react-native-keychain  version = '10.0.0'  license = 'MIT'  time.modified = '2025-03-23T19:16:49.760Z'
react-native-mmkv      version = '4.3.2'   license = 'MIT'  time.modified = '2026-06-22T08:27:45.533Z'  peerDependencies = { react: '*', 'react-native': '*', 'react-native-nitro-modules': '*' }
react-native-sensitive-info version = '6.1.5' license = 'MIT' time.modified = '2026-06-30T13:54:37.959Z' peerDependencies = { react: '*', 'react-native': '*', 'react-native-nitro-modules': '*' }
expo-local-authentication version = '57.0.3' license = 'MIT' time.modified = '2026-10-01T19:28:41.478Z' peerDependencies = { expo: '*' }
qrcode.react           version = '4.2.0'   license = 'ISC'  time.modified = '2024-12-11T17:22:40.710Z'  peerDependencies = { react: '^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0' }
react-qr-code          version = '2.2.0'   license = 'MIT'  time.modified = '2026-06-09T12:09:13.138Z'  peerDependencies = { react: '*' }
qrcode                 version = '1.5.4'   license = 'MIT'  time.modified = '2025-11-13T00:56:56.222Z'
uqr                    version = '0.1.3'   license = 'MIT'  time.modified = '2026-04-03T01:23:47.719Z'
react-qrcode-logo      version = '4.1.0'   license = 'MIT'  time.modified = '2026-05-02T19:54:56.849Z'  peerDependencies = { react: '>=18.0.0', 'react-dom': '>=18.0.0' }
expo-camera            version = '57.0.6'  license = 'MIT'  time.modified = '2026-10-03T13:01:55.598Z'  peerDependencies = { expo: '*', react: '*', 'react-native': '*', 'react-native-web': '*' }
react-native-vision-camera version = '5.2.3' license = 'MIT' time.modified = '2026-08-20T18:39:52.917Z' peerDependencies = { react, react-native, react-native-nitro-modules, react-native-nitro-image: '*' }
react-native-camera-kit version = '18.0.1' license = 'MIT'  time.modified = '2026-08-03T22:09:55.357Z' peerDependencies = { react: '*', 'react-native': '*' }
expo-barcode-scanner   version = '13.0.1'  license = 'MIT'  time.modified = '2026-09-23T11:27:54.135Z' peerDependencies = { expo: '*' }
```

Note: `time.modified` is the registry's last metadata change, not a release date; release dates are the `time[<version>]` values quoted in each candidate table.

## 8. Collection log and deviations

| Step | Action | Details |
|---|---|---|
| 1 | Read | `identification/02_structured.md` (row 11 at line 284), `apps/mobile/package.json`, `apps/mobile/app.json`, sibling `research/02b_collection_data_access.md` (format only) |
| 2 | Read / grep | Generated `apps/mobile/android/app/src/main/AndroidManifest.xml`, `android/gradle.properties`; `node_modules/expo/bundledNativeModules.json`; `node_modules/react-native/gradle/libs.versions.toml`; `apps/mobile/src/auth/{biometric,auth-prefs}.ts`; `apps/core-web/package.json`, `src/lib/packaged-csp.ts`; first five lines of `apps/mobile/plugins/with-dems-release-signing.js`; predecessor docs lines quoted in section 2 |
| 3 | npm view | Section 7.4 |
| 4 | curl, WebFetch, WebSearch | Sections 7.1-7.3 |
| 5 | Read AVD config | `grep` of 11 keys in `~/.android/avd/{dems_phone,dems_phone2,dems_tablet}.avd/config.ini` (read-only) |
| 6 | Wrote | `research/02f_collection_device_credential_qr.md` (this file) and `delegation_progress/data_collector_step_11.md` |

**Deviations from the "read-only, no processes" rule (disclosed).**

1. One command ran `avdmanager list avd | head -2` (a read-only listing that starts a Java tool; no emulator was started and no `adb` was called), followed by `ls ~/.android/avd`. It printed `Name: dems_phone` and the directory names. It was then not repeated; the AVD facts in section 2.5 come from the `config.ini` grep.
2. Fetched documents were saved into the session scratch directory (`$TMPDIR/c11`, outside the workspace) to grep them. Nothing in the workspace was written other than the two files named above.
3. The GitHub unauthenticated API rate limit was exhausted late in the run (`API rate limit exceeded for 157.10.182.237`); later GitHub facts came from `raw.githubusercontent.com` and `unpkg.com` instead.
4. The sandbox needed no bypass; no command used `dangerouslyDisableSandbox`.

## 9. Gaps and items not confirmed

| # | Gap | Where it matters |
|---|---|---|
| 1 | Whether a biometric-protected item can be written and read on the three host AVDs (screen lock and fingerprint enrolment state unknown; `hw.fingerprint` absent from `config.ini`) | Topic A, emulator behaviour for A1-A3 |
| 2 | What `adb install -r` does to a Keystore-backed entry (docs say `-r` keeps app data; Expo says SecureStore is "designed to provide a persistent data storage solution across app restarts and updates"; no source states the Keystore outcome for `-r`) | Topic A, reinstall |
| 3 | Behaviour of A3 (react-native-sensitive-info) on uninstall and reinstall: not stated in its README or `docs/EXPO.md` | Topic A |
| 4 | Any vendor statement that names Expo SDK 57 or React Native 0.86 for react-native-keychain, react-native-sensitive-info, react-native-vision-camera, react-native-camera-kit, react-native-data-scanner: none found (only declared peers, RND flags and Nitro minimums) | Topics A and C, "SDK 57 compatibility" |
| 5 | Whether expo-camera's `CameraView` preview works on an AVD whose cameras are `none`; whether the Google code scanner module is obtainable on a Google APIs AVD without the Play Store (the Google page states nothing on emulators; only forum summaries, secondary) | Topic C, emulator support |
| 6 | Whether expo-camera's `launchScanner` requests the runtime `CAMERA` permission on the app side | Topic C, permission footprint |
| 7 | Whether `androidx.biometric` (a dependency of expo-secure-store 1.1.0, expo-local-authentication 1.2.0-alpha04, react-native-keychain 1.1.0, react-native-sensitive-info biometric-ktx 1.4.0-alpha02) contributes manifest entries on merge; and how Gradle resolves the differing versions in one app | Topics A and 6 |
| 8 | GitHub star and issue counts for react-native-vision-camera (API rate-limited) and expo-camera; maintenance signals for qrcode.react and react-qr-code repositories (not collected) | Topics B and C, maintenance |
| 9 | React 19 compatibility of react-qr-code, qrcode and uqr from a primary source: only peer ranges and a secondary summary | Topic B |
| 10 | Rendered output, bundle-size and CSP behaviour of the QR libraries in the packaged web build: nothing was built or run | Topic B |
| 11 | Whether the existing debug and release-signed builds on each emulator allow `adb install -r` (blueprint H-B6): not probed in this row | Section 6 context |
| 12 | The Expo "prebuilt modules" guide referenced by the expo-camera plugin table (effect on `barcodeScannerEnabled`) was not fetched | Topic C |

---
*Generated: 2026-10-04 02:40*
*Last Updated: 2026-10-04 02:40*
