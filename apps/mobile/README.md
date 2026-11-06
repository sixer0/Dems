# DEMS tablet app (`@dems/mobile`)

Back to the [repository README](../../README.md).

## What it is

The tablet app is the operator's Android app, package `com.dems.demo.tablet` (`app.json`, name "DEMS Tablet Demo", version 0.1.0). It is built with Expo (`~57.0.26`), React Native 0.86.3 and Expo Router, styled with Uniwind, with TanStack Query and Zustand for state and i18next for words.

One tablet is paired with one Core server. The app talks to the Core (`apps/core-server`) over its HTTP JSON API under `/api/v1` and the realtime socket `/ws`, plain `http` / `ws` on port 4420. Media playback and live previews use the Core's signed paths. The client, operations, words and the simulator come from the shared contract `packages/shared` (`@dems/shared`).

Data sources:

- **Live**: the Core server at the configured address (below). Release builds carry the Live source only (decision D163).
- **Simulated** and **Heartbeat** (debug builds only): the in-app simulator, and the mock Core of the first demo (`apps/mock-core`, `127.0.0.1:4400`), kept for development links and tests.

## Folder layout of `src/`

| Folder | What it holds |
|---|---|
| `app/` | Expo Router routes: `_layout.tsx`, `index.tsx`, `pair.tsx`, the `(auth)` group (login) and the `(app)` group (tabs and session screens) |
| `features/` | One folder per screen area: `alerts`, `audit`, `capture-selector`, `dashboard`, `devices`, `evidence`, `home`, `login`, `more`, `network-time`, `pairing`, `rbac`, `session-finalizing`, `session-live`, `session-new`, `session-recovery`, `session-summary`, `sessions`, `settings`, `storage`, `transcription` |
| `runtime/` | The data source and its wiring: Live adapters (`sim-adapters.ts`), the Core server address (`core-address.ts`), secure credentials, owed sign-out, link and connection banners, camera stream transport, log |
| `auth/` | Sign-in provider, operator session, biometric sign-in (off in release) |
| `navigation/` | Root navigator, tabs, stacks, route guards |
| `providers/` | App providers, boot gate, toast area |
| `components/` | `kit`, `composed` and `media` components |
| `layout/` | Pane layout, safe screen, layout class for phone and tablet |
| `lib/` | App version, keyboard helpers, small utilities |
| `i18n/` | Word resources of the app |
| `motion/` | Animation builders |

Other folders: `plugins/` (Expo config plugins: `with-dems-core-cleartext.js`, `with-dems-library-patches.js`, `with-dems-release-signing.js`), `patches/` (one library patch, see `patches/README.md`), `scripts/` (build, signing, patch and device helpers), `assets/`.

## Requirements and setup

- Node 26.8.2 and npm 11.19.1.
- JDK 17 and the Android SDK (platform 36, build-tools 36.0.0, NDK 27.1.12297006). The root README, section **Prerequisites**, lists how the development Mac was set up.
- An Android emulator or a USB-connected tablet with `adb`.

```sh
npm install        # the root postinstall also applies the library patch (scripts/apply-patches.sh)
```

## Run, test, typecheck

| What | Command (repository root unless noted) |
|---|---|
| Metro dev server (`expo start --localhost --port 8081`) | `npm run dev:mobile` |
| Build and run on a device or emulator | `npm run android` |
| Forward ports 4400, 8081 and 4420 to the device | `npm run mobile:reverse` |
| Tests | `npm test -w @dems/mobile` (jest) |
| Typecheck | `npm run typecheck -w @dems/mobile` (`tsc --noEmit`) |
| Lint | `npm run lint -w @dems/mobile` (eslint) |
| Patch check | `npm run patches:check -w @dems/mobile` |
| Expo checks | `npm run doctor -w @dems/mobile`, `npm run deps:check -w @dems/mobile` |

## Debug and release APK

| | Debug APK | Release APK |
|---|---|---|
| Build | `npm run build:android` (runs `expo prebuild --platform android --no-install`, then `./gradlew assembleDebug` in `apps/mobile/android`). The audit ran the Gradle step as `./gradlew --no-daemon assembleDebug -PreactNativeArchitectures=arm64-v8a` (row 215) | Once: `apps/mobile/scripts/create-demo-keystore.sh`. Then: `apps/mobile/scripts/build-release-apk.sh` (row 238) |
| Output | `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` | `release/android/DEMS-Demo-0.1.0.apk` with `.sha256`, `SHA256SUMS.txt` and `BUILD-INFO.txt` (git-ignored) |
| Signed with | The Android debug key | The DEMO release keystore in the git-ignored `apps/mobile/signing/` ("DEMO ONLY - NOT FOR PRODUCTION"); no password is ever printed |
| JavaScript | From Metro (`npm run dev:mobile`) | Compiled Hermes bundle inside the APK |
| Sources | Live, plus Simulated and Heartbeat | Live only (D163); biometric sign-in off (residual R174-G5) |

- `build-release-apk.sh` runs `npx expo prebuild --platform android --no-install` and `./gradlew --no-daemon assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64` under `.locks/gradle.lock`, then copies the APK and writes its checksums. It never runs `prebuild --clean` and never installs anything. Run it outside the agent sandbox. It is written for the development Mac: `JAVA_HOME` and `ANDROID_HOME` default to that machine's paths; set both on another machine.
- Back up the debug APK before a release build: prebuild has cleared `android/` once even without `--clean`.
- The two builds have different signatures. Installing one over the other needs an uninstall first, which deletes the tablet's pairing.
- Neither build is a production build (DEMO signing).

## Configuration

The app has no environment configuration for production. What it needs is set on the tablet:

- **Core server address** (decision D263, row 236). The Pair screen has a **Core server address** card with Host and Port fields. Default `127.0.0.1:4420`, which reaches the Core through `adb reverse` (`npm run mobile:reverse`) on an emulator or a USB-connected device. For a real tablet on the interview-room LAN, enter the Core host's LAN address (for example `192.168.x.x`) and port `4420`, tap **Use this address**, then pair. Pair stays disabled while the fields hold an address that is not in force. Settings shows the address read-only; the login screen's offline message names it.
  - Accepted: an IPv4 address in a private, loopback or link-local range, or a host name; port 1 to 65535. Refused: a public IPv4 address, a scheme or path, `host:port` in the Host field, IPv6.
  - Changing the address first deletes the stored device credential, any owed sign-out and the stored Core snapshot. A different Core means a new pairing.
  - Stored in the prefs store (`dems.mobile.prefs.v1`, field `coreAddress`), not in the secure store.
- **Pairing.** A Supervisor issues a one-time code in the web console (Admin > Paired Devices). Enter it on the Pair screen and tap Pair. The device credential is kept in the secure store. No pairing code is written here.

Build-time variables used only in development: `EXPO_PUBLIC_USE_RN_FETCH` (read by the debug probes in `src/runtime/dev-probes.ts`), `METRO_PORT` (the `start:lane` script). `JAVA_HOME` and `ANDROID_HOME` are read by `scripts/build-release-apk.sh`.

## Production notes

- The app is not a server and has no systemd unit. It needs the Core's port 4420 reachable from the tablet's network.
- **Cleartext to the Core** (D263, residual R263-TLS). The app uses plain `http` and `ws`. The config plugin `plugins/with-dems-core-cleartext.js` permits cleartext in the Android network security base configuration, in release builds too. Compensations: public IPv4 addresses are refused, the device credential is bound to the address, and the interview-room LAN is a closed network. TLS to the Core is the proper fix and is open.
- A real-device test of the release APK against a LAN Core has not been run yet (row 238 proves the configuration only).
- Open items affecting tablets (R225-F1 to F3: silent unpairing after a database rollback or a move to another Core) are listed in the root README, section **Known open items**.
