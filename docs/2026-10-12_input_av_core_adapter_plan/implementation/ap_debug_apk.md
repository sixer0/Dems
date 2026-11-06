# AP - debug APK of apps/mobile (UNVERIFIED)

Tier 3 record. Row AP, task 4, 2026-10-14. Tree: branch task4/input-av-core-port, HEAD 6d6553e3 plus the Core typecheck fix of C156 (uncommitted). Evidence basis: mobile `tsc` 0 only; mobile tests NOT run. The APK is labelled UNVERIFIED.

## Result
| Item | Value |
|---|---|
| File | release/mobile/dems-mobile-task4-6d6553e3-unverified-debug.apk (git-ignored by `/release/`) |
| Size | 267,760,250 bytes |
| SHA-256 | f968b1dd1e36c47c87d1194c98fd112ce1b84946ea136c77fa6d2d622e3f019e |
| applicationId | com.dems.demo.tablet |
| versionName / versionCode | 0.1.0 / 100 |
| minSdk / targetSdk / compileSdk | 24 / 36 / 36 |
| ABIs (native-code) | arm64-v8a, armeabi-v7a, x86_64 |
| Debuggable | yes (application-debuggable) |
| Signer | CN=Android Debug (default debug keystore apps/mobile/android/app/debug.keystore); SHA-256 fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c; no key created |
| JS bundle | embedded: `unzip -l` shows assets/index.android.bundle (11,812,556 bytes), Hermes bytecode (magic c61fbc03); the build log shows `createBundleDebugJsAndAssets`, "Android Bundled ... expo-router/entry.js (6055 modules)". No Metro needed. |

## Method
The debug variant skips bundling by default (`debuggableVariants`). The generated `apps/mobile/android/` folder is git-ignored (`apps/mobile/.gitignore:43`, root .gitignore), so the one-line change was made THERE and restored after the build:
`apps/mobile/android/app/build.gradle` line 35: `// debuggableVariants = [...]` -> `debuggableVariants = []`. Restored byte for byte (SHA-256 of the file 1f8d378a... before and after). No tracked build file changed. The android folder was not regenerated (`expo prebuild` not run): it dates from 2026-10-12 16:30, after the last change of package.json/app.json/plugins (16:01), so it matches the current native configuration.

Bundle and assets are written by the gradle plugin to `apps/mobile/android/app/build/generated/...` (ignored), not into src/; nothing generated was added to the source tree.

## Commands
```
cp apps/mobile/android/app/build.gradle $TMPDIR/build.gradle.orig ; edit line 35 (above)
export ANDROID_HOME=$HOME/Library/Android/sdk ANDROID_SDK_ROOT=$ANDROID_HOME EXPO_NO_TELEMETRY=1
/usr/bin/lockf -k -t 1800 .locks/heavy-host.lock /usr/bin/lockf -k -t 1800 .locks/gradle.lock \
  bash -c 'cd apps/mobile/android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64 --console=plain'
-> BUILD SUCCESSFUL in 46s (588 tasks, 103 executed; native libs came from the cache of earlier builds)
cp build.gradle.orig back ; cp app-debug.apk release/mobile/dems-mobile-task4-6d6553e3-unverified-debug.apk
```
`-PreactNativeArchitectures` drops x86 (the default list has 4 ABIs) to match the earlier demo release (release/android/BUILD-INFO.txt: arm64-v8a armeabi-v7a x86_64).

## Versions
Expo 57.0.26, react-native 0.86.3, Hermes bundled, AGP 8.12.0, Gradle 9.3.1, JDK openjdk 17.0.20.1, node v26.8.2, build-tools 36.0.0 (aapt2, apksigner for the checks).

## Checks
- `aapt2 dump badging`: package/versionName/versionCode/sdk/native-code as in the table.
- `apksigner verify --print-certs`: verified, debug certificate.
- `git status --porcelain` after: only the pre-existing changes (capture-composition.ts, decisions.md, ffprobe-export.txt) plus this row's own docs (file_claims.md line, ap_debug_apk.md, row_ap.md). No other tracked path touched.

## What did not work first time
The first gradle run inside the command sandbox failed (`gradle-9.3.1-bin.zip.lck: Operation not permitted`, ~/.gradle is not writable there); re-run with the sandbox off for that single command. Hosts needed: none were fetched anew (all caches warm); allowlist declared for services.gradle.org, repo.maven.apache.org, dl.google.com.

## Not done (by the order)
No install on a device or emulator, no tests, no commit, no signing key, no release build.
