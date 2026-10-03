# DEMS Edge Client Demo

## Ringkasan (Bahasa Indonesia)

Repositori ini berisi **demo** DEMS Edge Client: konsol web Core, aplikasi operator Android (ponsel dan tablet), dan mock Core lokal. **Semua data sintetis (DEMO)**: tidak ada data, kunci, atau kredensial asli.

- **Presenter:** pakai paket siap jalan di `release/` (tidak perlu Node atau Android SDK). Ikuti `release/RUN-ON-ANOTHER-PC.md` (web) dan `release/android/INSTALL-ANDROID.md` (APK, pasang lewat ADB).
- **Login demo:** `budi.santoso`, `andi.pratama` atau `rina.wijaya`, kata sandi `demo-2026`. Tombol kunci keamanan masuk sebagai Supervisor. Kode pairing `482913`. PIN emulator `1234`.
- **Developer:** buka web selalu di `http://127.0.0.1:5173` (jangan `localhost`). Nyalakan emulator dari Terminal Anda sendiri dengan jendela terlihat, dan jaga Mac tetap menyala selama build atau agen berjalan.

## What this is

A demo stack for the DEMS Edge Client. Every name, case, recording, hash, key and credential in it is synthetic and labelled DEMO.

| Part | Path | What it does |
|---|---|---|
| Core web console | `apps/core-web` | React + Vite console: Login, Dashboard, Session Monitor, Start Session, Evidence, Devices, Storage, Network & Time, Security & Audit, System & Maintenance, API Reference |
| Android operator app | `apps/mobile` | Expo / React Native app (`com.dems.demo.tablet`) with phone and tablet layouts |
| Mock Core | `apps/mock-core` | Fastify health + WebSocket heartbeat on `127.0.0.1:4400` (loopback only) |
| Shared package | `packages/shared` | Simulator, dataset, i18n, theme tokens, demo media and evidence packages |

The simulator runs in each client. Mock Core only supplies the health check and the heartbeat.

## Quick start for presenters

You do not need this repository's toolchain. Use the packages in `release/` (git-ignored, built on 2026-10-01):

- Web console on Windows, macOS or Linux: `release/RUN-ON-ANOTHER-PC.md`. It serves the console at `http://127.0.0.1:4410/` (fallback 4411-4419). Run `--self-test` the day before the demo.
- Android APK: `release/android/INSTALL-ANDROID.md`. Install with ADB first (`adb install -r DEMS-Demo-0.1.0.apk`). Since 30 Sep 2026, tap-installing an unregistered app in Indonesia needs a one-time 24-hour advanced flow. Leave the Core link on **Simulated**.

**Demo credentials** (synthetic, from `packages/shared/src/sim/dataset.ts`; shown in the Login "Demo operators" disclosure by design):

| Username | Shown as | Role | Password |
|---|---|---|---|
| `budi.santoso` | AKP Budi Santoso | Investigator | `demo-2026` |
| `andi.pratama` | AKP Andi Pratama | Supervisor | `demo-2026` |
| `rina.wijaya` | Rina Wijaya | Technician | `demo-2026` |

| Other demo value | Value |
|---|---|
| "Use security key (simulated)" button | Signs in as the Supervisor (`andi.pratama`) |
| Tablet pairing code | `482913` |
| Emulator screen-lock PIN (fingerprint enrolment) | `1234` |

**Presentation mode** hides the demo disclosures (operator list, pairing code) and, on mobile, the demo controls. Web: System & Maintenance → App Preferences or the Demo Control Panel (stored in `sessionStorage['dems.presentation.v1']`, per tab). Mobile: Settings → App Preferences.

## Prerequisites

Installed on the development Mac (Apple silicon, macOS) on 2026-09-30 / 2026-10-01:

| Tool | Version | Where |
|---|---|---|
| Node | 26.8.2 (pinned in `.node-version`; `engines` `>=26.8.2 <27`) | system `/usr/local/bin/node`, no version manager |
| npm | 11.19.1 (`packageManager`) | system |
| JDK | 17.0.20.1 | Homebrew `openjdk@17` (keg-only) |
| Android SDK | cmdline-tools 23.0, platform-tools (adb 37.0.1), emulator 37.1.11, `platforms/android-36`, `build-tools/36.0.0`, `ndk/27.1.12297006`, `cmake/3.22.1`, system image `android-36/google_apis/arm64-v8a` | `~/Library/Android/sdk` |
| AVDs | `dems_phone` (pixel_10, port 5554), `dems_phone2` (pixel_10, port 5558), `dems_tablet` (pixel_tablet, port 5556) | `~/.android/avd` |
| Maestro (optional) | 2.11.0 | `~/.maestro` (not on PATH) |
| ffmpeg + espeak-ng (only to regenerate demo media) | 9.0.2 + 1.52.0 | Homebrew |

`~/.zprofile` carries two marked blocks (backup of the original: `~/.zprofile.bak.dems-2026-09-30-235451`):

```sh
# >>> dems-demo: jdk (added 2026-09-30, blueprint row 8) >>>
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
# <<< dems-demo: jdk <<<

# >>> dems-demo: android sdk (added 2026-09-30, blueprint row 9) >>>
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
# <<< dems-demo: android sdk <<<
```

How each item was installed (exact commands and checksums) is in `docs/2026-09-30_dems_demo_stack_setup/initialization/03_jdk_install.md`, `04_android_sdk_install.md`, `05_avds.md`, `implementation/72_second_phone_avd.md` and `implementation/62_maestro_install.md`. For SDK changes use `android --no-metrics ...`, and do not run `sdkmanager --update` unattended.

## Install

From the repository root, in a login shell (`zsh -l`):

```sh
npm_config_cache="$PWD/.cache/npm" npm install
```

- `.npmrc` sets `save-exact=true`. The only install script allowed is `@shopify/react-native-skia@2.6.2` (root `allowScripts`).
- Debug APK for the emulators: `npm run build:android` (prebuild + `./gradlew assembleDebug`), output `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`. Run it outside the agent sandbox. Prebuild can wipe `apps/mobile/android/`, so copy `app-debug.apk` somewhere safe first.
- Optional code graph for agents: `graft build .` (never `graft init`; `graft/` is git-ignored).

## Start

Run each in its own terminal from the repository root. Inside an agent sandbox, binding a local port fails with `EPERM` (see Troubleshooting).

```sh
npm run dev:mock     # mock Core: http://127.0.0.1:4400 (health + ws://127.0.0.1:4400/ws)
npm run dev:web      # Core console: http://127.0.0.1:5173/
npm run dev:mobile   # Metro: 127.0.0.1:8081 (expo start --localhost, IPv4 first)
```

- **Always open `http://127.0.0.1:5173/`, never `localhost:5173`.** Another local project (SMART WMS) listens on `[::1]:5173`, and macOS tries `::1` first for `localhost`. Vite binds `127.0.0.1` with `strictPort`.
- Start mock Core before the web Login: Sign In needs the Core heartbeat.
- `dev:mobile` sets `NODE_OPTIONS=--dns-result-order=ipv4first` so the IPv4 `adb reverse` reaches Metro. Do not use `npm run android` (`expo run:android`) for demos: it exposes Metro on all interfaces.

**Mobile on an emulator (manual).** With the emulator booted and Metro running (serials: phone `emulator-5554`, phone2 `emulator-5558`, tablet `emulator-5556`):

```sh
ANDROID_SERIAL=emulator-5554 npm run mobile:reverse          # tcp:4400 and tcp:8081, one call per serial
adb -s emulator-5554 install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk   # if not installed
adb -s emulator-5554 shell am force-stop com.dems.demo.tablet
adb -s emulator-5554 shell 'am start -W -a android.intent.action.VIEW -d "demsdemo:///login?motion=off" com.dems.demo.tablet'
```

- **Quote deep links** for the device shell, as above. An unquoted `&` splits the command on the device and drops the later parameters.
- Force-stop the app before the first launch: a quick-boot snapshot restores an old running instance.
- The mobile Core link defaults to Simulated. The mock-Core heartbeat option (Settings → App Preferences) works in debug builds only and needs the `tcp:4400` reverse rule.

**Scripted device sessions (agents and lanes).** `apps/mobile/scripts/device-session.sh` takes the AVD lock, boots a down AVD the safe way, force-stops the app, starts Metro on the lane port, maps the reverse rules, runs your commands with `SERIAL` / `ANDROID_SERIAL` / `AVD_NAME` / `APP_ID` exported, then cleans up. Run it outside the sandbox:

```sh
METRO_PORT=8082 apps/mobile/scripts/device-session.sh any-phone '<commands>'   # first free of phone, phone2
METRO_PORT=8082 apps/mobile/scripts/device-session.sh tablet '<commands>'
NO_METRO=1      apps/mobile/scripts/device-session.sh any '<commands>'         # first free of all three, no Metro
```

- Targets: `phone`, `phone2`, `tablet`, `any-phone`, `any`, `both`. Use `"$SERIAL"` in commands, never a hard-coded serial. Hard cap: 1800 s (`DEVICE_SESSION_MAX_SECONDS`). Metro lane ports 8081-8089 only.
- **Bundle location.** The helper sets the app's bundler location to `localhost:8081` (`debug_http_host`). Without it, a stock emulator loads from `10.0.2.2:8081`, the host's own port 8081, and lanes on other ports fail. Once set, the setting survives reinstalls, so manual runs then need the `tcp:8081` reverse rule (`npm run mobile:reverse`).
- **Debug-handle sign-in** (debug builds only): `globalThis.__DEMS_DEBUG__` exposes `{ sim, sha256Hex, log, runtime(), setCoreLinkSource() }`. Lanes signed in with `__DEMS_DEBUG__.sim.actions.signInWithBiometric('OPR-001')` instead of typing. Reaching it through Metro's inspector WebSocket needs an `Origin` header and has been unreliable (known issue). Debug builds also accept `&scenario=idle|recording|finalizing|fault-demo` on any deep link.

## Emulator networking

**Boot demo emulators from your own Terminal, with the windows visible.** An emulator inherits the nice level of the shell that starts it (agent background shells run at nice 5). macOS also moves a hidden emulator window into a background band (App Nap), and the guest then runs 3-4 times slower.

```sh
~/Library/Android/sdk/emulator/emulator -avd dems_phone -port 5554 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save &
echo $! > .locks/dems_phone.pid
# phone2: -avd dems_phone2 -port 5558    tablet: -avd dems_tablet -port 5556
ps -o pri,nice -p $(cat .locks/dems_phone.pid)    # nice should be 0
```

- Keep the windows on screen: not minimised, not on another Space, not behind a full-screen app. `taskpolicy -B` does not fix the background band durably.
- `-no-snapshot-load -no-snapshot-save` is required. A snapshot restore once brought back an old APK ("AsyncStorage is null"). After a cold boot, check that the current debug APK is installed. `npm run emulator` and `npm run emulator:phone` still boot from the snapshot, so prefer the command above.
- After a reboot the PIN keyguard shows. Unlock it with `adb -s emulator-5554 shell input keyevent KEYCODE_WAKEUP && adb -s emulator-5554 shell input text 1234 && adb -s emulator-5554 shell input keyevent 66`.
- Measure cold start as 1 warm-up launch plus the median of 5 (START → `ActivityTaskManager: Displayed`).
- With two or more emulators, every adb call needs a serial (`-s <serial>` or `ANDROID_SERIAL=<serial>`).
- All emulator, adb and Metro listeners are loopback only. Run emulator and adb commands outside the agent sandbox: inside it the emulator aborts with "Incompatible processor ... neon".
- **Keep the Mac awake** (lid open, power connected) while agents, builds or device sessions run. Clamshell sleep paused every agent and timer once (07:08-09:12 on 2026-10-01).

**Fingerprint enrolment** (already done on all three AVDs; `S` = the serial):

```sh
adb -s $S shell locksettings set-pin 1234
adb -s $S shell am start -a android.settings.BIOMETRIC_ENROLL
adb -s $S shell input text 1234 && adb -s $S shell input keyevent 66
#   tap MORE until I AGREE, tap I AGREE (phone 911,2266 / tablet 1776,1280); screens are FLAG_SECURE (black screencaps)
adb -s $S emu finger touch 1; adb -s $S emu finger remove 1          # repeat until "Fingerprint added", then DONE
adb -s $S shell locksettings get-disabled                              # false
adb -s $S shell dumpsys fingerprint | grep -o '"count":[0-9]*'         # "count":1
```

In the app, sign in once with a password and choose Enable. At Login, tap the fingerprint button, then run `adb -s $S emu finger touch 1`.

## Stop

- Stop `dev:mock`, `dev:web` and `dev:mobile` with Ctrl-C, or `kill -TERM <pid>`. Mock Core shuts down gracefully on SIGTERM.
- Remove reverse rules per serial: `adb -s emulator-5554 reverse --remove-all`. Stop the adb server with `adb kill-server`.
- Stop an emulator only when no agent lane uses it: `adb -s emulator-5554 emu kill`. Agents never kill or reboot emulators.

## Demo scenarios

**Web (`http://127.0.0.1:5173/`).** Sign in as a demo operator (or use the security-key button for the Supervisor), then:

| What | How |
|---|---|
| Demo Control Panel | System & Maintenance → "Demo controls" switch. Scenario loader (idle / recording / finalizing / fault-demo), Reset, Clear all faults, Recover session. Fault toggles: camera loss, MIC 1 no signal, MIC 2 clip, storage low, storage full, fan stall, tamper, TPM failure, security fault, audit tamper, power fail. Time source GNSS → NTP → RTC. Every action writes an audit row |
| Presentation mode | Switch in the Demo Control Panel or App Preferences. Hides the Login "Demo operators" disclosure |
| `?motion=slow` | Proof mode: every duration and delay ×10 |
| `?motion=off` | Reduced motion: ambient loops paused, opacity-only transitions |
| `?debug=1` | Overlay with fps, long tasks, ambient loops and meter frames per second (lazy chunk) |
| Tampered evidence | Evidence → EV 0005 → Verify: FAIL on `track:AUDIO-02` only. EV 0001 verifies PASS, 8/8 checks recomputed in the browser |
| Export | As Supervisor: Evidence → EV 0004 → Export. Downloads the prebuilt `EXP-000031.zip` (2,276,249 B, SHA-256 `d888f5449d1eb552c9113cb98a144aa7a9d21f14fa393a2de9c52efcea059e97`) |

**Mobile.** Deep links take `?motion=off|slow` and `?debug=1` (sticky per process; `?motion=full` and `?debug=0` reset them). Demo controls are in Settings → System Maintenance and are hidden in presentation mode.

**Presenter note:** the web console, the phone and the tablet each run their own simulator. A session started on one screen does not appear on another, so narrate a two-screen demo as two independent clients.

## Tests

From the repository root:

```sh
npm run typecheck
npm run lint
npm test
```

Last counts (2026-10-01): shared 508 tests, core-web 438, mobile 833 (72 suites), mock-core 19. Per workspace:

```sh
npm test -w @dems/shared -- --maxWorkers=2
cd apps/core-web && npx vitest run --maxWorkers=2
cd apps/mobile && npx jest --maxWorkers=2       # also: npx tsc --noEmit; npx eslint .
```

Mock-core tests bind a local port, so run them outside the agent sandbox.

**Maestro.** Call it by absolute path, with analytics and the update check off, and keep output out of `~/.maestro`:

```sh
MAESTRO_CLI_NO_ANALYTICS=true MAESTRO_DISABLE_UPDATE_CHECK=true ~/.maestro/bin/maestro --version
MAESTRO_CLI_NO_ANALYTICS=true MAESTRO_DISABLE_UPDATE_CHECK=true ~/.maestro/bin/maestro --no-ansi --device emulator-5554 test <flow>.yaml --test-output-dir <dir> --debug-output <dir>
```

- App flows must launch the app with `?motion=off`, because ambient loops keep uiautomator from going idle. The Session Monitor never goes idle, so tap by id there.
- Never use `cloud`, `login`, `mcp` or `--analyze`.
- The app flow suite (`apps/mobile/e2e/maestro`, used by `npm run e2e -w @dems/mobile`) was deferred under the fast-track decision and does not exist yet.

## Release packages

Outputs go to the git-ignored `release/`. Run both builds outside the agent sandbox.

```sh
apps/mobile/scripts/create-demo-keystore.sh      # once; refuses to overwrite
apps/mobile/scripts/build-release-apk.sh         # release/android/DEMS-Demo-0.1.0.apk (+ .sha256, SHA256SUMS.txt, BUILD-INFO.txt)
node --import tsx scripts/release/build-web-packages.ts [--skip-gate] [--skip-web-build] [--skip-smoke]
```

- **Before `build-release-apk.sh`, back up `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.** Its prebuild cleared `android/` once even without `--clean`.
- The APK is signed with a **DEMO keystore** in the git-ignored `apps/mobile/signing/` (random password, never printed). It is Simulated-only: Heartbeat is disabled in release builds.
- The web packager builds the console with `VITE_DEMS_CORE_ORIGIN=same-origin` (it sets this itself) and writes six packages to `release/web/`. Check them with `shasum -a 256 -c SHA256SUMS.txt` in `release/web/`.

## Demo data (media and evidence)

Both generators live in `packages/shared/scripts/` and write to `packages/shared/assets/`:

```sh
# each line starts from the repository root
cd packages/shared && node --import tsx scripts/gen-demo-media.ts [--as-of YYYY-MM-DD[THH:MM]] [--voice auto|espeak|synthetic] [--out <dir>] [--only <session suffixes>]
cd packages/shared && node --import tsx scripts/gen-demo-evidence.ts [--as-of YYYY-MM-DD[THH:MM]] [--out <dir>]
cp packages/shared/assets/demo-media/mobile/* apps/mobile/assets/media/
```

- `--as-of` defaults to `2026-10-01T10:00` WIB. **You do not need it before a demo on another date:** the clients join packages by case sequence + subject + session suffix, not by the dated case number. Use the same `--as-of` for both generators, and run the evidence generator again after any media run.
- The media run takes about 13 minutes and needs ffmpeg and espeak-ng. The evidence run takes under a second.
- After a media run, refresh the mobile copy (the `cp` above; `brand-media.test.ts` fails until it matches) and rebuild the release APK, which embeds the media.
- **DEMO key:** evidence packages are signed with an Ed25519 key derived from a published seed phrase, with a DEMO certificate valid 2026-01-01 to 2030-12-31 (`--as-of` must fall inside it). It is not a secret and proves nothing outside this demo. EV 0005 is tampered on purpose.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `localhost:5173` shows another app | SMART WMS owns `[::1]:5173`. Use `http://127.0.0.1:5173` |
| Extra Vite lane fails on 5174 or 5175 | SMART WMS also holds 5174 and 5175. Use a spare port: `npx vite --port 5176 --strictPort --host 127.0.0.1` in `apps/core-web` |
| `listen EPERM: operation not permitted 127.0.0.1` in an agent | The sandbox blocks local port binding. Run that command outside the sandbox, or set `sandbox.network.allowLocalBinding: true` in the Claude Code settings |
| "more than one device/emulator" | Pass a serial: `ANDROID_SERIAL=<serial> npm run mobile:reverse`, `adb -s <serial> ...` |
| "Unable to load script" / `Failed to connect to /10.0.2.2:8081` | The app is loading from the host's port 8081 and nothing listens there. Start `npm run dev:mobile`, or use `device-session.sh` for other ports. Once `device-session.sh` has set the bundler location to `localhost:8081`, the app also needs the reverse rule (`ANDROID_SERIAL=<serial> npm run mobile:reverse`) |
| Metro inspector WebSocket returns 401 | Send an `Origin: http://127.0.0.1:<port>` header |
| Typed text disappears on the tablet | Gboard's one-time "Try out your stylus" sheet captures input. Dismiss it (Cancel) first. `adb input text` bursts can also drop characters: type slowly |
| App red-screens with "AsyncStorage is null" after a boot | A snapshot restored an old APK. Reinstall the debug APK (`adb -s <serial> install -r ...app-debug.apk`) and boot with `-no-snapshot-load -no-snapshot-save` |
| Emulators slow, cold start 12-15 s | Background band: boot from your own Terminal and keep the windows visible (Emulator networking) |
| `device-session.sh` rejects `METRO_PORT=8090` | Only 8081-8089 are accepted. Use `NO_METRO=1` |
| Web package logs CSP reports for `eval` in `clsx-*.js` | Zod v4's capability probe; caught and harmless |

## Rollback

Run host rollbacks outside the agent sandbox. Do not use `brew autoremove`: it would also remove unrelated orphans.

```sh
# ~/.zprofile: remove the two marked blocks, or restore the original
sed -i '' '/^# >>> dems-demo:/,/^# <<< dems-demo:/d' ~/.zprofile
cp -p ~/.zprofile.bak.dems-2026-09-30-235451 ~/.zprofile

# JDK and the 23 formulae it added (initialization/03_jdk_install.md)
HOMEBREW_NO_AUTO_UPDATE=1 brew uninstall openjdk@17
HOMEBREW_NO_AUTO_UPDATE=1 brew uninstall cairo fontconfig freetype giflib glib graphite2 harfbuzz icu4c@78 jpeg-turbo libpng libtiff libx11 libxau libxcb libxdmcp libxext libxrender little-cms2 lzo pixman webp xorgproto

# ffmpeg, espeak-ng and their 12 added dependencies (implementation/64_demo_media.md)
HOMEBREW_NO_AUTO_UPDATE=1 brew uninstall ffmpeg espeak-ng dav1d lame libvmaf libvpx mpg123 opus pcaudiolib sdl2-compat sdl3 svt-av1 x264 x265

# AVDs (stop them first with adb -s <serial> emu kill)
zsh -l -c 'avdmanager delete avd -n dems_tablet'
zsh -l -c 'avdmanager delete avd -n dems_phone'
zsh -l -c 'avdmanager delete avd -n dems_phone2'

# Android SDK and ~/.android (both absent before this project)
~/Library/Android/sdk/platform-tools/adb kill-server
rm -rf ~/Library/Android ~/.android

# Maestro (host files; on-device driver packages uninstall themselves after each run)
rm -rf ~/.maestro ~/Library/Logs/maestro
```

Per-step rollbacks are at the end of each log in `docs/2026-09-30_dems_demo_stack_setup/initialization/` and `implementation/`.

## Licences and known issues

- Third-party assets and licences: `THIRD_PARTY_NOTICES.md`. The demo videos and stills are derived from the Pexels hero photo listed there. The demo voices are eSpeak NG 1.52.0 (Indonesian formant voice), and no macOS voices were used.
- Known issues and deferred items: `docs/2026-09-30_dems_demo_stack_setup/verification/01_verification.md` (written by the final verification pass) and the decision log `docs/2026-09-30_dems_demo_stack_setup/decisions/decisions.md` (D112 lists what the fast-track deferred).
- Everything here is a DEMO. Do not reuse its keystore, evidence key or credentials for anything real.
