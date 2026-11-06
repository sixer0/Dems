---
step: 94
title: Android release APK (DEMO-signed, Simulated-only)
agent: coder-execution
tier: 3
status: complete
date: 2026-10-01
window: 10:25–10:47 WIB
sources: identification/02_structured.md row 94 (rev 6); masterplan/06_packaging_spec.md §2, §4.1–4.2; D110, D112, D115
---

# 69 Release APK (step 94)

Fast-track under D112. All three input logs (59, 61, 74) already existed at 10:33, so the build ran without waiting.

## 1. Result

| Item | Value |
|---|---|
| APK | `release/android/DEMS-Demo-0.1.0.apk` |
| Size | 142,592,154 B (136.0 MiB). The spec estimated 120–170 MB [H-PK-1]: confirmed |
| SHA-256 | `0009f33d60e9038201b7aa54c9ef1af750db9b852401affba56fbb9d3c345ecd` |
| Signer | `CN=DEMS Demo Release (DEMO ONLY - NOT FOR PRODUCTION), OU=Demo, O=DEMS Demo, C=ID`, cert SHA-256 `995c1e389ed7df89f3e79a1690b2c14dc7376d928249bbf01de3c83272fd1647` |
| Build | 10:34:53 → 10:41:28 WIB. `BUILD SUCCESSFUL in 6m 31s`, 739 tasks |
| Release folder | `DEMS-Demo-0.1.0.apk`, `.apk.sha256`, `SHA256SUMS.txt`, `BUILD-INFO.txt`, `INSTALL-ANDROID.md` (EN + Ringkasan ID) |

## 2. Files written (P6)

| File | Change |
|---|---|
| `apps/mobile/scripts/create-demo-keystore.sh` | new. Refuses to overwrite and checks that `signing/` is git-ignored first. Runs `openssl rand -hex 16`, passes the password to keytool through `-storepass:env` / `-keypass:env`, sets mode 600, and prints only the DN and SHA-256 |
| `apps/mobile/signing/dems-demo-release.p12`, `release-signing.properties` | created by the script. Git-ignored, mode 600. The password was never printed |
| `apps/mobile/plugins/with-dems-release-signing.js` | new. `withAppBuildGradle` adds the §2.2 block once (marker `@dems-release-signing`). If the properties file is missing, the block fails any release task. Debug is never touched |
| `apps/mobile/app.json` | `android.versionCode: 100`, `allowBackup: false`, `blockedPermissions` (SYSTEM_ALERT_WINDOW, READ/WRITE_EXTERNAL_STORAGE), plugin entry `./plugins/with-dems-release-signing` |
| `apps/mobile/scripts/build-release-apk.sh` | new. Order: preflight, then `expo prebuild --platform android --no-install` (no `--clean`) and the marker-count check, then `./gradlew --no-daemon assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64`. The prebuild and the Gradle run both happen inside `lockf -k -t 3600 .locks/gradle.lock`. It then copies the APK, writes the SHA-256 files and BUILD-INFO |
| `apps/mobile/src/runtime/core-link.ts`, `src/runtime/index.ts` | Heartbeat gate (D112, the release-critical item of step 91). `isCoreLinkSourceAvailable(source, isDev = __DEV__)` and `effectiveCoreLinkSource()` are added. In release, hydration maps a stored HEARTBEAT to SIMULATED, and `setCoreLinkSource('HEARTBEAT')` is ignored with a warn row in the runtime log |
| `apps/mobile/src/features/settings/preferences-section.tsx`, `i18n.ts` | In release, the Heartbeat option has `isDisabled` set and the hint `coreLinkHintRelease` ("…developer setup only (adb reverse to mock-core)") is shown. Debug builds are unchanged |
| `apps/mobile/src/features/settings/heartbeat-release-gate.test.tsx` | new. 5 tests: the pure gate, a release set that is ignored, release hydration falling back, the release Settings option disabled (pressing it writes nothing), and debug still enabled |
| `apps/mobile/src/components/media/brand-media.test.ts` | one assertion updated. The pinned plugin list now ends with the new plugin, which my app.json change had broken |
| `release/android/*` | the five release files |

`.gitignore` was not touched. Step 100 had already added `/release/` (line 61) and `apps/mobile/signing/` (line 62).

## 3. Quick gate (before the build)

| Check | Result |
|---|---|
| `tsc --noEmit` | exit 0 (run again after the test fix: exit 0) |
| `eslint .` | exit 0 (changed files linted again after the fix: exit 0) |
| New gate test | 5/5 PASS |
| `jest --maxWorkers=2 --ci` (all suites) | 811/833 passed, 7 of 72 suites failed. **No failure comes from step 94 after the one-line fix.** The 22 failures: **18 step-70 navigation stubs** (routes 11, guard 4, chrome/master-detail 2, session deep-link 1); **2 from step 54 (D115)**: keep-awake `SimPermissionError: stopRecording needs a signed-in operator`, and evidence EV-0005 tampered; **1 MA-20 haptics**: `features/storage/storage-screen.test.tsx:105,164,179` call `Haptics.*` directly, which belongs to the storage step; **1 the plugin-list pin**, now fixed (brand-media, runtime and settings suites re-run: only the step-54 keep-awake failure remains) |

## 4. Acceptance criteria (06 §2.10)

| AC | Evidence | Result |
|---|---|---|
| A1 | `apksigner verify --verbose --print-certs`: "Verifies"; v2 true (v1/v3/v4 false, all reported); "Number of signers: 1"; DN contains `DEMO ONLY`; cert SHA-256 = BUILD-INFO `995c1e38…1647`; not `CN=Android Debug` | PASS |
| A2 | `aapt2 dump badging`: `versionCode='100' versionName='0.1.0'`; `native-code: 'arm64-v8a' 'armeabi-v7a' 'x86_64'`; `debuggable` count 0; min 24 / target 36 | PASS |
| A3 | `assets/index.android.bundle` 10,129,100 B; first 8 bytes `c61fbc03c103191f` (Hermes) | PASS |
| A4 | SHA-256 set inclusion over `res/**` and `assets/**`: **84/84** mobile media files found | PASS |
| A5 | xmltree: `allowBackup=false`; no `usesCleartextTraffic` or `networkSecurityConfig` (0 hits). Permissions: INTERNET, USE_BIOMETRIC, USE_FINGERPRINT, VIBRATE, ACCESS_NETWORK_STATE, WAKE_LOCK, plus the app's own DYNAMIC_RECEIVER permission; none of the 3 blocked permissions | PASS |
| A6 | `zipalign -c -P 16 -v 4` → "Verification successful" | PASS |
| A7 | `git check-ignore -q` passes for `release/x` and `apps/mobile/signing/x`; `git status --porcelain` shows 0 lines for either path | PASS |
| A8 | Left to step 63 by design (the logger must not run it). Nothing in this log or in `release/` contains the password | for step 63 |
| A9 | `dems_phone` (emulator-5554, chosen by `device-session.sh any` with `NO_METRO=1`); details in §5 | PASS |

## 5. Device run (A9)

- **Emulator:** `dems_phone` / emulator-5554, abilist `arm64-v8a`. Device lock held through `device-session.sh`. No emulator was booted, killed or rebooted (D78).
- **Clean install:** the debug app was uninstalled first because its signature differs. Then `adb install` → Success. dumpsys shows `versionCode=100`, `versionName=0.1.0` and `pkgFlags=[ HAS_CODE ALLOW_CLEAR_USER_DATA ]`: no DEBUGGABLE flag, no ALLOW_BACKUP flag.
- **No Metro, no reverse rules:** `pgrep` found no Metro or expo process. `adb reverse --remove-all` ran at the start of every session, and the list was empty each time. The helper still maps tcp:4400 even with NO_METRO=1, so it had to be removed each time.
- **Launch and sign-in:** `am start -W` → COLD, 2,624 ms. Login rendered from the embedded bundle. I signed in with the debug-free path: Demo operators → *AKP Budi Santoso* → Sign In. Home loaded with the embedded media thumbnails. Then More → Settings → App Preferences: the Heartbeat option shows disabled with the release hint, and tapping it leaves Simulated selected.
- **Logcat:** 0 `FATAL EXCEPTION`; 0 cleartext lines. H-PK-5 expected cleartext-block lines, but none appeared while Simulated was selected.
- **Screenshots** (`implementation/assets/mobile/`): `94_dems_phone_release_login.png`, `94_dems_phone_release_demo_operators.png`, `94_dems_phone_release_filled.png`, `94_dems_phone_release_home.png`, `94_dems_phone_release_more.png`, `94_dems_phone_release_settings.png`, `94_dems_phone_release_core_link.png`, `94_dems_phone_release_core_link_after_tap.png`.
- **Restored afterwards:** the release app was uninstalled and the debug APK reinstalled on dems_phone (`versionCode=1`, `DEBUGGABLE`), so the dev lanes keep working. The device session ended at 10:45:51.

## 6. Issues and decisions

| ID | Type | Note |
|---|---|---|
| DR-94-1 | incident (mitigated) | Prebuild ran without `--clean`, yet it still printed "Clearing android … Cleared android code". In `@expo/cli` `prebuildAsync.js:124-126`, a non-interactive run clears an existing `android/` that it judges **malformed**, meaning one of app/build.gradle, build.gradle, AndroidManifest.xml or MainApplication is missing (`clearNativeFolder.js:133-140, 194-196`). That deleted `app-debug.apk`. **Mitigation:** I had copied it before the build and restored it to `android/app/build/outputs/apk/debug/app-debug.apk` afterwards with a byte-identical SHA-256 `cb6b1f513d525372b6e6c6ea35c134da29e9e8a0c79f2566a8fa4e7d217b0be5`. Which file was missing before 10:34 cannot be shown now (hypothesis: a partial tree left by an earlier lane). Recommendation for step 96 and later rebuilds: back up the debug APK before any prebuild |
| DR-94-2 | decision | A release build ignores the Heartbeat choice in three places: Settings, the setter and hydration. That way a HEARTBEAT value left by a debug build, or set through any other caller, still cannot switch on the non-functional Heartbeat link in the APK |
| DR-94-3 | decision | v2-only signing comes from AGP's default for minSdk 24. A1 requires v2 = true and only that v3 is reported, so this is accepted |
| DR-94-4 | note | The regenerated `android/` now also has `allowBackup=false` and the blocked permissions for debug builds. Debug's own source-set manifest still declares SYSTEM_ALERT_WINDOW [H-PK-6]; not re-tested here because no debug rebuild was needed |
| DR-94-5 | handover | Out of scope here, routed to the controller: the step-54 test failures (91a), the MA-20 haptics offenders in storage-screen.test.tsx, and the step-70 navigation stubs |

## 7. Install guide summary (`release/android/INSTALL-ANDROID.md`)

The guide covers, in order:

1. **What you need:** Android 7+, about 400 MB free, ARM or an x86_64 emulator, and Platform-Tools. Platform-Tools is not bundled because of its licence.
2. **Method A, recommended:** ADB with USB debugging, then `adb install -r`. If the install fails because of another signature, run `adb uninstall com.dems.demo.tablet` first.
3. **Method B, tap-install:** includes the Indonesian unverified-developer advanced flow. It must be done at least 24 hours before the demo; choose 7 days.
4. **Play Protect:** install without sending the app for scanning.
5. **First run:** demo operators with the password `demo-2026`; biometric is optional; Core link stays on **Simulated**; Heartbeat is disabled in this package.
6. Update or uninstall.
7. Troubleshooting table.
8. Indonesian summary.
