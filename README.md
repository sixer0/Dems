# DEMS Edge Client Demo

## Ringkasan (Bahasa Indonesia)

Repositori ini berisi **demo** DEMS Edge Client: konsol web Core, aplikasi operator Android (ponsel dan tablet), dan mock Core lokal. **Semua data sintetis (DEMO)**: tidak ada data, kunci, atau kredensial asli.

- **Presenter:** pakai paket siap jalan di `release/` (tidak perlu Node atau Android SDK). Ikuti `release/RUN-ON-ANOTHER-PC.md` (web) dan `release/android/INSTALL-ANDROID.md` (APK, pasang lewat ADB).
- **Login demo:** `budi.santoso`, `andi.pratama` atau `rina.wijaya`, kata sandi `demo-2026`. Tombol kunci keamanan masuk sebagai Supervisor. Kode pairing `482913`. PIN emulator `1234`.
- **Developer:** buka web selalu di `http://127.0.0.1:5173` (jangan `localhost`). Nyalakan emulator dari Terminal Anda sendiri dengan jendela terlihat, dan jaga Mac tetap menyala selama build atau agen berjalan.
- **Mode Live (sejak 2026-10-06):** konsol web dan aplikasi memakai satu Core server (`127.0.0.1:4420`) dengan PostgreSQL lokal (`127.0.0.1:4432`). Urutannya: `npm run pg:init` (sekali), `npm run pg:start`, buat/migrasi/seed database `dems_demo`, `npm run start:server`, lalu konsol dengan `DEMS_CORE_PROXY_PORT=4420 VITE_DEMS_CORE_MODE=live npm run dev:web` dan buka `http://127.0.0.1:5173` (jangan `localhost`). Perintah lengkap ada di bagian **Live mode**. Akun yang di-seed memakai kredensial demo yang dipublikasikan untuk akun sintetis pada demo lokal; mode Live hanya untuk loopback (`127.0.0.1`).
- **Koreksi emulator (sejak 2026-10-04):** emulator yang dipakai sekarang `dems2_phone`, `dems2_tablet` dan `dems2_phone2`. PIN emulator di atas hanya berlaku untuk AVD lama `dems_*` (tidak dinyalakan lagi). Kunci layar `dems2_phone` dan `dems2_tablet` dipasang sendiri oleh pengguna dengan `apps/mobile/scripts/emulator-user-lock.sh`; nilainya tidak ditulis di sini, dan agen tidak pernah mengetik PIN.

## What this is

A demo stack for the DEMS Edge Client. Every name, case, recording, hash, key and credential in it is synthetic and labelled DEMO.

| Part | Path | What it does |
|---|---|---|
| Core web console | `apps/core-web` | React + Vite console: Login, Dashboard, Session Monitor, Start Session, Evidence, Devices, Storage, Network & Time, Security & Audit, System & Maintenance, API Reference |
| Android operator app | `apps/mobile` | Expo / React Native app (`com.dems.demo.tablet`) with phone and tablet layouts |
| Mock Core | `apps/mock-core` | Fastify health + WebSocket heartbeat on `127.0.0.1:4400` (loopback only) |
| Shared package | `packages/shared` | Simulator, dataset, i18n, theme tokens, demo media and evidence packages |
| Core server (Live mode, added 2026-10-06) | `apps/core-server` | Fastify backend on `127.0.0.1:4420` (lanes 4421-4423): roles and permissions enforced on the server, device pairing, PostgreSQL storage, WebSocket `/ws` (loopback only) |
| PostgreSQL scripts (Live mode) | `scripts/pg` | Project-local PostgreSQL 18.4 on `127.0.0.1:4432`, data in the git-ignored `.data/`: `npm run pg:*` |
| Capture worker (real capture, added 2026-10-09) | `apps/capture-worker` | A small C program against the installed FFmpeg libraries, started and supervised by the Core server: it records the camera files and the session audio. Built with `make -C apps/capture-worker`; never started in Simulated capture |
| Capture protocol (real capture) | `packages/capture-protocol` | The message contract between the Core server and the capture worker |
| Transcriber (real capture) | `apps/transcriber` | Speech-to-text pipeline called by the Core server: backends `cpu-local` and `omlx-server`, voice-activity detection, transcript assembly |
| Lane script (Live mode, added 2026-10-10) | `scripts/lane/lane.sh` | Start, stop, status and reset of the four Core instances, each with its own media store root |

The simulator runs in each client. Mock Core only supplies the health check and the heartbeat.
That describes Simulated mode, the default. In Live mode (section **Live mode** below) the Core server is the Core instead: both clients read and write one PostgreSQL database through it.
Since the third task a Core server can also record, seal and transcribe for real: section **Real capture, sealing and transcript**. That section holds what an operator and an installer must know, and the list of known limits.

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
| Correction (2026-10-04): emulators in use, `dems2_*` | The PIN above belongs to the old `dems_*` AVDs only. The user set the lock of `dems2_phone` and `dems2_tablet` with `apps/mobile/scripts/emulator-user-lock.sh`; the value is not printed here. `dems2_phone2` has no lock |
| Live mode pairing code | None fixed: in Live mode a Supervisor issues a one-time 6-digit code in the web console (Paired Devices). `482913` is the Simulated code |

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
| AVDs in use since 2026-10-04 | `dems2_phone` (pixel_10, port 5554), `dems2_phone2` (pixel_10, port 5558), `dems2_tablet` (pixel_tablet, port 5556). The `dems_*` AVDs of the row above are kept on disk and not booted; both families use the same ports, so only one runs at a time | `~/.android/avd` |
| PostgreSQL (Live mode, since 2026-10-04) | 18.4, from the npm package `embedded-postgres` 18.4.0-beta.17 (binaries of `@embedded-postgres/darwin-arm64` in `node_modules`, its install script allowed by exact name in `allowScripts`). No Homebrew, no Docker, no launchd job | `node_modules/@embedded-postgres/darwin-arm64/native/bin` |
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

The backend task records PostgreSQL provisioning in `docs/2026-10-04_dems_backend_rbac_pairing/initialization/04_postgres_provisioning.md` and the `dems2_*` emulators in `initialization/06_lock_free_emulators.md` of the same folder.

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
- These three commands run Simulated mode. Live mode (Core server and PostgreSQL) has its own order: see **Live mode** below.

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
- Since the backend task, `npm run mobile:reverse` maps `tcp:4420` (the Core server of Live mode) as well as the two ports named in its comment above. The Core link source has a third choice, Live (debug builds): see **Live mode** below.

**Scripted device sessions (agents and lanes).** `apps/mobile/scripts/device-session.sh` takes the AVD lock, boots a down AVD the safe way, force-stops the app, starts Metro on the lane port, maps the reverse rules, runs your commands with `SERIAL` / `ANDROID_SERIAL` / `AVD_NAME` / `APP_ID` exported, then cleans up. Run it outside the sandbox:

```sh
METRO_PORT=8082 apps/mobile/scripts/device-session.sh any-phone '<commands>'   # first free of phone, phone2
METRO_PORT=8082 apps/mobile/scripts/device-session.sh tablet '<commands>'
NO_METRO=1      apps/mobile/scripts/device-session.sh any '<commands>'         # first free of all three, no Metro
```

- Targets: `phone`, `phone2`, `tablet`, `any-phone`, `any`, `both`. Use `"$SERIAL"` in commands, never a hard-coded serial. Hard cap: 1800 s (`DEVICE_SESSION_MAX_SECONDS`). Metro lane ports 8081-8089 only.
- **Bundle location.** The helper sets the app's bundler location to `localhost:8081` (`debug_http_host`). Without it, a stock emulator loads from `10.0.2.2:8081`, the host's own port 8081, and lanes on other ports fail. Once set, the setting survives reinstalls, so manual runs then need the `tcp:8081` reverse rule (`npm run mobile:reverse`).
- **Debug-handle sign-in** (debug builds only): `globalThis.__DEMS_DEBUG__` exposes `{ sim, sha256Hex, log, runtime(), setCoreLinkSource() }`. Lanes signed in with `__DEMS_DEBUG__.sim.actions.signInWithBiometric('OPR-001')` instead of typing. Reaching it through Metro's inspector WebSocket needs an `Origin` header and has been unreliable (known issue). Debug builds also accept `&scenario=idle|recording|finalizing|fault-demo` on any deep link.
- **Since 2026-10-04 (backend task):** the AVD of a target is `$DEMS_AVD_PREFIX<target>`, default prefix `dems2_` (`dems2_phone`, `dems2_phone2`, `dems2_tablet`; `DEMS_AVD_PREFIX=dems_` addresses the old AVDs). `AVD_NAME` carries that name and the PID files are `.locks/dems2_<target>.pid`. The helper wakes the screen and dismisses a keyguard that has no credential. If the device has a screen lock and is locked, it stops with **exit 77** and runs nothing: the user opens it with `apps/mobile/scripts/emulator-user-lock.sh unlock` (section Emulator networking). If an emulator of the other AVD family holds the target's port, it stops with exit 69.
- **Live mode lanes:** `DEMS_CORE_HOST_PORT` (4420 to 4423) also maps the device's `tcp:4420` to that host port for the session and removes the rule at the end, for example `METRO_PORT=8083 DEMS_CORE_HOST_PORT=4421 apps/mobile/scripts/device-session.sh phone '<commands>'` for the lane-1 backend. Debug builds also accept `core=LIVE` and `core=SIMULATED` on a deep link (quoted, as above).

## Emulator networking

**Boot demo emulators from your own Terminal, with the windows visible.** An emulator inherits the nice level of the shell that starts it (agent background shells run at nice 5). macOS also moves a hidden emulator window into a background band (App Nap), and the guest then runs 3-4 times slower.

```sh
~/Library/Android/sdk/emulator/emulator -avd dems_phone -port 5554 -no-metrics -gpu host -no-boot-anim -no-snapshot-load -no-snapshot-save &
echo $! > .locks/dems_phone.pid
# phone2: -avd dems_phone2 -port 5558    tablet: -avd dems_tablet -port 5556
ps -o pri,nice -p $(cat .locks/dems_phone.pid)    # nice should be 0
```

Since 2026-10-04 the AVDs to boot are `dems2_phone` (port 5554), `dems2_phone2` (5558) and `dems2_tablet` (5556): in the commands above write `-avd dems2_phone` and `.locks/dems2_phone.pid` (likewise for the other two). The `dems_*` names above boot the old AVDs, which carry a screen lock. List the AVDs with `~/Library/Android/sdk/emulator/emulator -list-avds`.

- Keep the windows on screen: not minimised, not on another Space, not behind a full-screen app. `taskpolicy -B` does not fix the background band durably.
- `-no-snapshot-load -no-snapshot-save` is required. A snapshot restore once brought back an old APK ("AsyncStorage is null"). After a cold boot, check that the current debug APK is installed. `npm run emulator` and `npm run emulator:phone` still boot from the snapshot, so prefer the command above.
- `npm run emulator` and `npm run emulator:phone` also name the old `dems_tablet` and `dems_phone` AVDs: do not use them for the `dems2_*` emulators.
- Correction (2026-10-06): the line above no longer holds. `npm run emulator` now boots `dems2_tablet` and `npm run emulator:phone` boots `dems2_phone`. They still boot from the snapshot and pass no `-port`, so the command above remains the one to use.
- After a reboot the PIN keyguard shows. Unlock it with `adb -s emulator-5554 shell input keyevent KEYCODE_WAKEUP && adb -s emulator-5554 shell input text 1234 && adb -s emulator-5554 shell input keyevent 66`.
- Correction (2026-10-04): that PIN and that unlock command belong to the old `dems_*` AVDs only. On `dems2_phone` and `dems2_tablet` the user has set a screen lock and one fingerprint of their own; after a cold boot **the user** opens them with `apps/mobile/scripts/emulator-user-lock.sh unlock`. `dems2_phone2` has no lock. No agent types a PIN, touches the fingerprint sensor or changes a lock.
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

**Screen lock and fingerprint on the `dems2_*` emulators** (since 2026-10-04). The enrolment block above was done on the old `dems_*` AVDs only; the `dems2_*` AVDs were created without a lock. The user-run helper replaces it. Run it yourself, in your own Terminal, from the repository root:

```sh
apps/mobile/scripts/emulator-user-lock.sh status     # read-only: AVD, keyguard, credential type, fingerprint count (anyone may run it)
apps/mobile/scripts/emulator-user-lock.sh setup      # PIN + one fingerprint (your Terminal only)
apps/mobile/scripts/emulator-user-lock.sh unlock     # after a cold boot: open the keyguard (your Terminal only)
apps/mobile/scripts/emulator-user-lock.sh remove     # back to lock-free; the fingerprint goes with the lock (your Terminal only)
```

- Add `phone`, `phone2` or `tablet` for one device; no target means all three. The state since 2026-10-04: `phone` and `tablet` have a PIN and one fingerprint (`setup phone`, `setup tablet`), `phone2` is left lock-free so that one emulator stays usable after a cold boot.
- `setup`, `unlock` and `remove` stop with exit 77 unless they run in a real terminal; agents never run them. Each waits for a running device session on that emulator (it holds the same device lock). The script never prints the PIN.
- With a lock, every cold boot leaves the emulator at the keyguard, and `device-session.sh` stops with 77 until `unlock` has run. The fingerprint touch for the app's biometric prompt (`adb -s <serial> emu finger touch 1`) is also yours.

## Stop

- Stop `dev:mock`, `dev:web` and `dev:mobile` with Ctrl-C, or `kill -TERM <pid>`. Mock Core shuts down gracefully on SIGTERM.
- Remove reverse rules per serial: `adb -s emulator-5554 reverse --remove-all`. Stop the adb server with `adb kill-server`.
- Stop an emulator only when no agent lane uses it: `adb -s emulator-5554 emu kill`. Agents never kill or reboot emulators.
- Live mode: stop the Core server with Ctrl-C (or `kill -TERM <pid>`) and PostgreSQL with `npm run pg:stop`. See **Live mode**.

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
That holds for Simulated mode. In Live mode the web console and the paired app share one Core server and one database, so both screens show the same sessions and evidence (section **Live mode**).

## Live mode

Added by the backend task (`docs/2026-10-04_dems_backend_rbac_pairing/`). In **Simulated** mode, the default and everything above, each client runs its own simulator. In **Live** mode both clients use one **Core server** (`apps/core-server`, `http://127.0.0.1:4420`), which keeps its data in a project-local **PostgreSQL 18.4** (`127.0.0.1:4432`, data in the git-ignored `.data/`). The server checks every action against the operator's role (Investigator, Supervisor, Technician) and pairs mobile devices with a one-time code issued in the web console.

Live mode is a development-host mode: it runs on this Mac, from the repository. The 0.1.0 packages in `release/` (web launchers and APK) stay Simulated-only.

**Read this first.**

- **The seeded accounts use published demo credentials for synthetic accounts on a local demo.** Live mode seeds the same three operators with the same password as the demo credentials table in Quick start, and both Login screens say so. They are not a secret: the Live sign-in demonstrates the mechanism, it does not protect the data.
- **Live mode is for loopback only.** Every listener binds `127.0.0.1`: PostgreSQL (4432), the Core server (4420, lanes 4421-4423), Vite (5173, lanes 5176-5178) and Metro. Do not expose any of them on another interface, through a port forward or through a tunnel. Before anything leaves loopback, the seeded password must be replaced and the demo disclosure removed.
- **In Live mode the console is opened at `http://127.0.0.1:5173`, never at `localhost`.** The Core server accepts the web console only from `http://127.0.0.1:5173` (and the lane ports 5176-5178). At a `localhost` address the console shows "Live mode needs another address" and a sign-in would be refused.
- `pg:init` generates three PostgreSQL passwords locally, one file each, mode 0600: `.data/pg.pwfile` (superuser `dems_admin`, provisioning only), `.data/pg.owner.env` (`dems_owner`: create, migrate, seed, reset, tests) and `.data/pg.env` (`dems_app`: the running server). Nothing asks you to open them. Never print, copy, commit or pass them as a command argument.
- Run every command below from the repository root. Inside an agent sandbox, PostgreSQL connections, port binding and `adb` need the per-command bypass (Troubleshooting).

**Ports** (all `127.0.0.1`)

| Port | What |
|---|---|
| 4432 | PostgreSQL 18.4, TCP only, no Unix socket. Never 5432: another PostgreSQL server on this Mac owns it |
| 4420 | Core server, main instance, database `dems_demo`: HTTP under `/api/v1`, WebSocket `/ws` |
| 4421, 4422, 4423 | Lane instances for parallel agent checks, databases `dems_lane_1`, `dems_lane_2`, `dems_lane_3` |
| 5173 | Web console (Vite). With `DEMS_CORE_PROXY_PORT` set it forwards `/api/v1` and `/ws` to the Core server |
| 5176, 5177, 5178 | Vite lanes 1 to 3, forwarding to 4421 to 4423 |
| 8081 | Metro. The app reaches the Core server through `adb reverse tcp:4420` |

**1. PostgreSQL: initialise once, then start and stop.**

```sh
npm run pg:init      # once: cluster in .data/postgres, roles dems_admin, dems_owner, dems_app, three credential files; leaves the server running
npm run pg:status    # exit 0: running and every check passed (3: stopped, 4: no cluster)
npm run pg:start     # after a reboot; does nothing when it already runs (PID in .locks/postgres.pid)
npm run pg:stop
```

- `pg:init` refuses (exit 1) when a cluster or any credential file already exists ("refused: already provisioned, or partly provisioned ... Nothing was changed."). That is its normal answer on a Mac that is already set up: it never overwrites anything.
- Nothing starts PostgreSQL at login. After a reboot run `npm run pg:start`.

**PostgreSQL server runbook (`scripts/pg/server.mjs`).** `pg:start` and `pg:stop` are thin commands over this one file; `pg:init`, `pg:status` and `pg:remove-data` use it too.

| Situation | What the script does | What you do |
|---|---|---|
| `npm run pg:start`, server already running | Checks that the running server is the project's (127.0.0.1, port 4432, no Unix socket), rewrites `.locks/postgres.pid`, prints "already running … nothing done" | Nothing |
| `npm run pg:start`, no cluster | Exit 4, "no cluster at .data/postgres: run \"npm run pg:init\" first." | `npm run pg:init` |
| `npm run pg:start`, port 4432 held by another process | Refuses: "127.0.0.1:4432 is already in use by a process that is not this cluster. Not started." It never stops a foreign process | Find the holder with `lsof -nP -iTCP:4432 -sTCP:LISTEN` and decide yourself |
| `npm run pg:start`, the start fails | Prints `pg_ctl start failed (exit n)` and the last 15 lines of `.data/postgres.log` | **Read both logs.** `.data/postgres.log` holds only what the server wrote before its log collector started. Everything after that is in `.data/postgres/log/postgresql-<hour>.log` (one file per hour of the day, overwritten the next day). The scripts' own log is `.data/pg-scripts.log` |
| `npm run pg:stop` | `pg_ctl -m fast -w stop` on `.data/postgres` only, waits up to 60 s, removes the PID file; "nothing done" when no server runs | Stop the Core servers of its databases first (section Stop) |
| After a reboot or a crash of the Mac | Nothing runs: no login item, no service | `npm run pg:status` (exit 3: stopped), then `npm run pg:start`. A PID file whose process is gone counts as stopped |

- The server is started by `pg_ctl` with the listen address, the port and an empty Unix-socket directory given on its command line as well as in `postgresql.conf`, so that neither a later edit of that file nor an `ALTER SYSTEM` can open another interface, another port or a socket.
- `pg:init`, `pg:start`, `pg:stop`, `pg:remove-data` and `pg:remove` take `.locks/postgres.lock` first (they wait for it: 120 s by default, `pg:init` 300 s), so two of them never run at the same time. `pg:status` only reads and takes no lock.
- Commands verified by reading, not run for this text: the `pg:*` scripts of the root `package.json` (`pg:init` → `scripts/pg/init.mjs`, `pg:start` → `start.mjs`, `pg:stop` → `stop.mjs`, `pg:status` → `status.mjs`, `pg:remove-data` → `remove-data.mjs`, `pg:remove` → `remove.mjs`).

**2. Database: create, migrate, seed, reset.** The main instance uses `dems_demo`.

```sh
npm run db:create -- --database dems_demo
/usr/bin/lockf -k .locks/db-migrate.lock npm run db:migrate -- --database dems_demo
/usr/bin/lockf -k .locks/db-migrate.lock npm run db:seed -- --database dems_demo
npm run db:status -- --database dems_demo
```

- Each command takes exactly one of `dems_demo`, `dems_lane_1`, `dems_lane_2`, `dems_lane_3`. On `dems_demo`, migrate, seed and reset run under the migrate lock, as shown.
- `db:create` leaves an existing database as it is. `db:migrate` applies nothing the second time. `db:seed` refuses a database that is already seeded (exit 1, "Seeding again is a reset").
- The seed builds the demo data as of the current clock, so case and session numbers carry today's date.

Back to the seed state (stop the Core server of that database first: the command refuses while the database is in use):

```sh
/usr/bin/lockf -k .locks/db-migrate.lock npm run db:reset -- --database dems_demo
```

- A reset keeps the paired devices, device credentials, sessions, settings, pairing codes and the lineage of the discarded audit chain. Everything else returns to the seed. A lane database that does not exist yet is created by its first reset.

**3. Core server.** Start PostgreSQL first.

```sh
scripts/lane/lane.sh start main              # http://127.0.0.1:4420, database dems_demo, demo controls on; waits until ready
scripts/lane/lane.sh status                  # the four instances: port, database, capture operation, media store root, running or stopped
scripts/lane/lane.sh stop main
curl -s http://127.0.0.1:4420/api/v1/health  # "status":"ok" ... "ready":{"database":true,"engine":true}
```

**Use `scripts/lane/lane.sh`, not a bare `npm run start:server` (since 2026-10-10).** Every database has its own media store root, and the Core records the root it was started with. The script (`start`, `stop`, `reset` with `main`, `1`, `2` or `3`; `status`) always passes the same environment; run it outside the sandbox:

| Instance | Port, database | Capture operation | Demo controls | Media store root (`DEMS_MEDIA_DIR`) |
|---|---|---|---|---|
| `main` | 4420, `dems_demo` | Simulated | on | `.data/media/dems_demo/sessions` |
| `1` | 4421, `dems_lane_1` | Simulated | on | `.data/media/dems_lane_1/sessions` |
| `2` | 4422, `dems_lane_2` | Development capture (`DEMS_CAPTURE_MODE=real`, `DEMS_CAPTURE_DEV_SOURCES=1`, generated test sources) | off | `.data/media/dems_lane_2/sessions` |
| `3` | 4423, `dems_lane_3` | Simulated | off | `.data/media/dems_lane_3/sessions` |

- A start or a reset with another `DEMS_MEDIA_DIR` makes the next reset stop with `RESET_STORE_ROOT_CONFLICT`; a bare `npm run start:server` records the old shared root `.data/media/sessions` again. `scripts/lane/lane.sh reset <instance>` runs `db:reset` under the migrate lock with the right root and refuses while that Core runs.
- Instance `2` needs, once per machine: `npm run capture:dev-setup`, `make -C apps/capture-worker`, `npm run evidence:dev-key -w @dems/core-server`, and `.data/transcriber/host.json` (the paths of the speech engine and its models). Its reset seals two demo packages with the development key. Its selector is the generated sources `CAM-01`, `CAM-02`, `MIC-01`, `MIC-02`; this Mac's own camera and microphone are never used by a script.
- The bare forms below still work for a one-off Core, with the limits above.

```sh
npm run start:server                         # 4420, dems_demo, demo controls off, media store root .data/media/sessions
DEMS_DEMO_CONTROLS=1 npm run start:server    # the same with demo controls on (scenarios, faults, reset from the console)
```

- At start the server checks the database (boot checks B-1 to B-9: the database answers, version, schema version, runtime role, audit protection, seed, chain head, owner role). A failed check stops it with one log line `"the server stopped: boot"` and a `"check"` that names the step; nothing listens then.
- The demo flag is read once, at start. Without it the console's demo controls answer "Demo controls are disabled on this Core server."
- Stop it with Ctrl-C, or `kill -TERM <pid>`; it refuses new requests (503) while it closes. Find the PID with `lsof -nP -iTCP:4420 -sTCP:LISTEN`. Errors are also written to `apps/core-server/logs/errors.log`.
- `DEMS_CORE_PORT=4421 npm run start:server` starts lane 1 on `dems_lane_1` (likewise 4422, 4423). Any other port stops the start.

**4. Web console in Live mode.**

```sh
DEMS_CORE_PROXY_PORT=4420 VITE_DEMS_CORE_MODE=live npm run dev:web
```

Open **`http://127.0.0.1:5173/`** (never `localhost`). The Login page shows the **Data mode** selector (Simulated, Live) with Live selected. Sign in with a demo operator from the Quick start table, for example `andi.pratama` (Supervisor).

- `DEMS_CORE_PROXY_PORT=4420` makes Vite forward `/api/v1` and `/ws` to the Core server, so the browser talks to one origin and the session cookie stays same-origin. Without it the Live console cannot reach the server.
- `VITE_DEMS_CORE_MODE=live` only preselects Live. A choice made with the Data mode selector (or the shell's mode indicator) is stored per origin in `localStorage['dems.core.mode.v1']` and wins over it.
- A web sign-in expires after 15 minutes without activity and after 8 hours at most.
- Simulated mode on the same page still needs mock-core for Sign In (`npm run dev:mock`, section Start).

**5. Pair the app and use it in Live mode.** This needs the debug APK (`npm run build:android`; the release APK is Simulated-only) on a booted emulator, and the Core server running.

```sh
npm run dev:mobile                                      # Metro on 127.0.0.1:8081, as in Start
ANDROID_SERIAL=emulator-5554 npm run mobile:reverse     # tcp:4400, tcp:8081 and tcp:4420 (the Core server)
adb -s emulator-5554 shell am force-stop com.dems.demo.tablet
adb -s emulator-5554 shell 'am start -W -a android.intent.action.VIEW -d "demsdemo:///login?core=LIVE&motion=off" com.dems.demo.tablet'
```

- The `core=LIVE` deep link works in debug builds. In the app the same switch is Settings → App Preferences → **Core link source** → Live.
- On the first launch against a cold Metro, `am start -W` may print `Status: timeout` while the app still opens: check the screen, not that line. A paired app on the Live Login shows "Core online" and "paired as DEV-…".
- **Pairing, once per database.** An unpaired app opens the Pair screen. In the web console, signed in as the Supervisor, open **Paired Devices** (`/admin/devices`) → **Pair a device** and issue a code. Type the 6-digit code into the app within 5 minutes; it is shown once and works once. Then sign in on the app with a demo operator.
- A pairing belongs to one database: a phone paired with `dems_demo` (port 4420) is not paired with a lane database, and `pg:remove-data` ends every pairing. Revoke a device on the Paired Devices page; unpair it in the app under Settings → Pairing.
- Back to Simulated: `adb -s emulator-5554 shell 'am start -W -a android.intent.action.VIEW -d "demsdemo:///login?core=SIMULATED&motion=off" com.dems.demo.tablet'`, or the Core link source switch.
- Agents and lanes use `device-session.sh` with `DEMS_CORE_HOST_PORT` instead (section Start, scripted device sessions).

**6. Switching modes.**

| Client | To Live | Back to Simulated |
|---|---|---|
| Web console | Login page: Data mode → Live (or the shell's mode indicator), then confirm | The same, Simulated |
| App (debug build) | Settings → App Preferences → Core link source → Live, then confirm; or the `core=LIVE` deep link | Core link source → Simulated; or `core=SIMULATED` |

A switch asks first ("Switch to Live mode?"), signs you out of the current mode and opens the Login screen. Simulated data and Live data are separate: nothing is copied between them.

**Known limits in Live mode**

- **A Live recording needs a paired tablet connected.** After a Core server start the Core's tablet link is offline until the app on a paired device connects. Until then every pre-check is blocked on the Core link, also when the recording is started from the web console, which says: "No paired tablet is connected to the Core server. Open the DEMS app on the paired tablet so that it connects, then re-run the checks." In Simulated mode the web console alone can record.
- After a revoke, a recording can be started again only when a paired device is connected. A recording that runs when its device is revoked goes on and can be stopped and sealed.
- At most four tabs per sign-in. A fifth console tab of the same sign-in displaces the oldest, which reconnects and displaces the next, so the tabs keep taking turns.
- In Live mode the session list and the evidence list show the bundled poster by evidence number, or the brand still; an item's own picture opens in its detail.
- With two paired devices, one leaving while the other stays shows as offline only at the next refresh of the Devices drawer or the Paired Devices page.
- On Users & Roles, active sessions and the last sign-in are as fresh as the page's last read; it reads again when the window regains focus.
- In Live mode an export from the web console is recorded with the Core's default destination label, "Audit archive (simulated)".
- In Live mode the SMART counters, the recovery check details and the device health lines are derived on the client from the Core's data, and the camera picture is the bundled demo loop.
- The Demo Control Panel works only when the server was started with `DEMS_DEMO_CONTROLS=1`.

**Remove**

```sh
npm run pg:remove-data   # stops PostgreSQL and deletes .data/: the cluster with every database, the three credential files, the logs
npm run pg:remove        # pg:remove-data, then npm uninstall embedded-postgres pg and npm install-scripts prune
```

- Neither can be undone. After `pg:remove-data` the PostgreSQL binaries stay; `npm run pg:init` then makes a new, empty cluster (create, migrate and seed again, and pair the devices again).
- `pg:remove` also edits `package.json` and `package-lock.json`. Its uninstall step is written but has not been run on this Mac. To use Live mode again afterwards, restore the two files, run the Install command and start again at `pg:init`.
- Other Live-mode leftovers: the reverse rules (`adb -s emulator-5554 reverse --remove-all`, section Stop); in the browser, sign out, run `localStorage.removeItem('dems.core.mode.v1')` in the developer console of `http://127.0.0.1:5173` and clear the cookies of `127.0.0.1`; in the app, unpair (Settings → Pairing). Every host change of the backend task and the command that undoes it: `docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md` section 14.

## Real capture, sealing and transcript

Added by the third task (`docs/2026-10-07_dems_real_capture_sealing/`); this section describes the tree at commit `f293221` (2026-10-10). A Core server can now record: a capture worker (`apps/capture-worker`) writes one file per camera with the session audio in it, the Core seals the recording into an encrypted, signed evidence package, and a transcriber (`apps/transcriber`) can add a transcript. Decision numbers (`D…`) refer to `docs/2026-10-07_dems_real_capture_sealing/decisions/decisions.md`.

**Read this first.** What has been proven so far was proven on generated test sources and test doubles on this Mac. No real camera, no real microphone and no real speech engine has been through a recorded, sealed session. Everything that is not proven, and every limit an operator or an installer has to know, is listed once under **Known limits** at the end of this section.

Correction (2026-10-10, fix waves H and I): what was added or changed after commit `f293221` is in **Fix waves H and I: additions and corrections** below, before the Known limits. Each sentence there that no gate has verified yet says so.

### Capture operation: what a Core records

The Core reads three environment variables once, at start, and decides its capture operation from them (`apps/core-server/src/capture/fence/operation.ts`). The operation is printed in the boot log line `capture fence passed`.

| Capture operation | Set by | What it does | Demo controls |
|---|---|---|---|
| `SIMULATED` (the default) | `DEMS_CAPTURE_MODE` unset or `simulated` | Records nothing. No capture worker is started. Sessions and evidence come from the simulator, as in Live mode before this task | Available with `DEMS_DEMO_CONTROLS=1`. Without it the Core starts and labels itself `SIMULATED_WITHOUT_DEMO_CONTROLS` |
| `REAL_DEVELOPMENT` | `DEMS_CAPTURE_MODE=real` and `DEMS_CAPTURE_DEV_SOURCES=1` | Records and seals from development sources only: the generated test camera and microphone sources, and this Mac's own camera and microphone | Never |
| `REAL_PRODUCTION` | `DEMS_CAPTURE_MODE=real`, `DEMS_CAPTURE_DEV_SOURCES` unset | Records and seals from production sources only (cameras added through the camera search and connect flow) | Never |

Demo controls (scenarios, fault injection, reset from the console) exist only in `SIMULATED`. One session is never a mix of development and production sources.

**What refuses to start.** A refused start opens no listener. The log ends with `"the server stopped: boot"`, and the line names the check and a code; `scripts/lane/lane.sh start` prints both (`check <step>, code <code>`).

| Code | Refused when | Applies to |
|---|---|---|
| `REAL_CAPTURE_WITH_DEMO_CONTROLS` | `DEMS_CAPTURE_MODE=real` together with `DEMS_DEMO_CONTROLS=1` | every real start |
| `DEV_SOURCES_NEED_REAL_CAPTURE` | `DEMS_CAPTURE_DEV_SOURCES=1` with capture mode `simulated` | `SIMULATED` |
| `DEV_FLAG_WITH_LAN_LISTENER` | `DEMS_CAPTURE_DEV_SOURCES=1` while a listener outside loopback is configured | development |
| `DEV_SOURCE_WITHOUT_FLAG` | The selector assigns a development source and the development flag is not set | `REAL_PRODUCTION` |
| `CAPTURE_DEVELOPMENT_SIGNING_KEY_IN_PRODUCTION` | The signing key in `<data directory>/signer` is a development key | `REAL_PRODUCTION` |
| `DEV_FLAG_WITH_PRODUCTION_SOURCE` | The selector assigns a production source and the development flag is set | `REAL_DEVELOPMENT` |
| `DEV_HELPER_PROGRAM_UNUSABLE` | `DEMS_CAPTURE_HELPER_FFMPEG` is unset, or the program fails the path rule (see set-up below) | `REAL_DEVELOPMENT` |
| `CAPTURE_WORKER_NOT_CONFIGURED`, `CAPTURE_WORKER_PROGRAM_UNUSABLE` | `DEMS_CAPTURE_WORKER` is unset, or the worker program is not a private executable (owned by root or the server's user, not writable by group or others, no directory on the way writable by them) | both real operations |
| `CAPTURE_EVIDENCE_STORE_UNUSABLE` | The media store fails a rule of **Evidence at rest** or **Evidence volume** below. The reason is named: `READABLE_BY_OTHERS`, `QUARANTINE_READABLE_BY_OTHERS`, `TRANSCRIBER_SCRATCH_READABLE_BY_OTHERS`, `OWNER`, `NO_SYNC`, `NO_HARD_LINKS` and others | both real operations |
| `CAPTURE_SIGNING_KEY_UNUSABLE` | No evidence signing key can be loaded from `<data directory>/signer` | both real operations |
| `CAPTURE_WORKER_NO_HANDSHAKE`, `CAPTURE_WORKER_PROTOCOL_MISMATCH`, `CAPTURE_WORKER_PROOF_BUILD`, `CAPTURE_WORKER_VERSION_UNKNOWN`, `CAPTURE_WORKER_MEDIA_LIBRARY_MISMATCH` | The worker does not answer, speaks another protocol version, is a proof build (a negative control of the tests), names an unknown version, or runs with another libavformat than the one it was built and checked against | both real operations |
| `TRANSCRIBER_CONFIG_UNRESOLVABLE` | The stored STT configuration cannot be resolved on this host (for example backend `cpu-local` with no transcriber host file; see **Transcription (STT)**) | both real operations |

In `SIMULATED` none of the real checks run: a database that holds real or development device rows keeps starting.

**Set-up of a development-capture Core, once per machine.** Each command is defined where the last column says.

| Step | Command | Defined in |
|---|---|---|
| A private copy of FFmpeg as the helper program of the development sources (`.data/helpers/ffmpeg`). A package manager's FFmpeg does not pass the path rule. Run it again after an FFmpeg upgrade | `npm run capture:dev-setup` | root `package.json` script `capture:dev-setup` → `scripts/capture/dev-setup.mjs` |
| Build the capture worker (static rules, their self-test, unit checks, `build/capture-worker`) | `make -C apps/capture-worker` | `apps/capture-worker/Makefile`, target `all` |
| A DEVELOPMENT evidence signing key in `.data/signer`. It refuses when a key is already there and prints no key material | `npm run evidence:dev-key -w @dems/core-server` | `apps/core-server/package.json` script `evidence:dev-key` → `src/sealing/dev-key-cli.ts` |
| The transcriber host file, written by hand (see **Transcription (STT)**) | none | `apps/core-server/src/transcription/host.ts` |
| Start, stop, reset the development-capture instance (lane `2`) | `scripts/lane/lane.sh start 2`, `stop 2`, `reset 2`, `status` | `scripts/lane/lane.sh` |

**The signing key.** The one command above provisions a development key: its certificate says `DEVELOPMENT KEY - NOT FOR PRODUCTION`. **No command of this repository provisions a production signing key.** A `REAL_PRODUCTION` Core refuses to start with a development key, and the seal refuses to sign a package of production sources with one (D138, D183).

**Devices.** In the web console, the Devices page has **Search for cameras**. Searching connects to nothing; make, model and name in the result are what each device announced and are not checked. Connecting a camera asks for the user name and password set on that camera; they are typed in the web console only, are write-only and are never shown again. On the tablet and the phone the search exists and a camera is connected from the web console. In `REAL_PRODUCTION` the development sources are not listed. Agents never type, store or receive a real camera credential (D76).

**Recording.** A session start shows "Connecting cameras…" and is shown as recording only after the first durable piece of video is on disk. A start with one of two cameras missing records with one camera and raises a warning that names the missing one; a start with no camera ends as a failed start with no evidence item. The session has one audio track, `AUDIO-01`. Two microphone inputs are assigned (primary and standby); the operator who started the session, or a Supervisor, can switch the audio source during the recording, and each switch is recorded as an interval and an audit row. The Core never switches by itself: a silent or disconnected microphone raises a warning only.

### Evidence at rest: recordings are plaintext until the seal completes

- **A recording lies in PLAINTEXT on the Core's media store from the start of the session until its seal completes.** The capture worker writes the camera files unencrypted; the Core encrypts them at seal time, one AES-256-GCM message per fragment. If the Core or the machine stops in between, the recording stays plaintext until the Core starts again and recovery seals it (D147).
- **The raw audio tap of the transcriber is plaintext in the same way.** It lies under `<media store>/.transcriber/sessions/<sessionId>/` while a session with transcription runs (D180, D189).
- **After a completed seal both are removed, and only by proof.** A plaintext recording is deleted only when the manifest names it, the sealed counterpart exists and the file's bytes hash to the manifest's plaintext hash; when the removal runs in a later attempt than the seal, the sealed file is decrypted and compared again first. A file that cannot be proven is not deleted: it is moved to the quarantine with one CRITICAL alert and one audit row (D167, D189).
- **Only file permissions protect the plaintext.** The media store root must belong to the user the Core runs as and must be owner-only (`chmod 700`: no permission bit for group or others). The same holds for its hidden folders `.quarantine` and `.transcriber` (with `.transcriber/sessions`): each must be a real directory of that user, not a link, with no bit for group or others. A Core in real capture refuses to start otherwise (`CAPTURE_EVIDENCE_STORE_UNUSABLE`, D183, D189). The hidden folders `.sealing` (the staging of a seal) and `.capture-session` (the capture facts of a session) lie inside that owner-only root; the Core creates `.sealing` with mode 0700.
- `scripts/lane/lane.sh start` creates the instance's media store root with mode 0700. A media store you create yourself must be given that mode by you.
- A stolen or imaged disk exposes every recording that is not sealed yet, and everything in the quarantine.

### Quarantine: a recording that cannot be sealed

- A seal that fails for a cause that may clear is retried three times in the running Core (after 5 s, 30 s and 120 s), again at every start of the Core, and on demand. While the cause stays, the session stays in `FINALIZING`, the Core accepts no new session, and one CRITICAL alert (`SEAL_BLOCKED`) names the cause and what restores it (D186, D189).
- A camera file that is damaged part-way has the fragments before the first bad one sealed, marked as interrupted; the whole original file goes to the quarantine (D183, D186).
- When nothing can be sealed, or a cause that cannot clear remains after the third attempt, the session ends as **INCOMPLETE** with no evidence item, one CRITICAL alert and one audit row. **Its files are kept**: they are moved, never deleted, to `<media store>/.quarantine/<sessionId>/` (folders 0700, files 0600), in plaintext (D178, D186).
- **The product has no way back into a seal for quarantined files.** There is no command and no screen that re-queues them; this is a known limit. Keeping, releasing or destroying a quarantine folder is an operator procedure outside the product (D186).
- **A quarantine folder blocks a database reset** (see **Reset rules**).

### One media store per database

- **Every database has its own media store root.** A shared root makes one database's packages block every other database's reset, and before the fix two databases with equal session numbers shared scratch files and one encryption key (D171, D180, D189).
- **Start and reset a Core with the SAME media root.** The Core records the root it was started with in its database. `scripts/lane/lane.sh` passes the same `DEMS_MEDIA_DIR` to `start` and `reset` of an instance; use it instead of the bare commands (Live mode, step 3).
- **Moving a media store to another path means renaming its session-key folder.** The session keys are kept in `<data directory>/credential-store/session-keys-<scope>/`, where `<scope>` is the first 32 hexadecimal characters of the SHA-256 of the text `dems.session-keys/1`, a line feed, and the resolved absolute path of the media store root (`apps/core-server/src/credential-store/index.ts`, `sessionKeyScopeOf`). A Core started on the moved store looks for its keys under the new scope, so the folder must be renamed to it or the sealed packages cannot be decrypted. No command does this rename (D189).
- Session keys written by the earlier build lie in `<data directory>/credential-store/keys/`. They stay readable, are never reused and are never destroyed by a Core.
- **Old transcriber scratch.** Before the fix the transcriber kept its per-session work under `<data directory>/transcriber/sessions/`. That folder belongs to no Core now. What is left in it is raw session audio and is deleted by hand. Delete only the `sessions` folder: `<data directory>/transcriber/host.json` beside it is the transcriber host file and is still used (D189).

### Cameras and time

- **Set every camera to the same time as the Core.** The product does not set or correct a camera's clock.
- A camera clock up to 2 s off is **accepted and recorded, not corrected**: the recording keeps the camera's own timeline, and the measured offset (camera minus Core, including the delivery delay) is written into the sealed manifest per track (`tracks[].clockOffsetMs`) (D179, D190).
- Above 500 ms the operator sees an advisory: "Camera clock differs from the Core by … ms; the recording keeps the camera's own timeline and records the offset." Below 500 ms nothing is shown (D188, D190).
- A camera whose clock is more than 2 s behind is given up and named in a CRITICAL fault ("The clock of … differs from the clock of the Core by more than the allowed bound."). When such a camera connected early, **up to 1 s of wrongly timed video may already be in its file** before it is given up (D188, gate 64 condition C1).

### Evidence volume

- The volume that holds the media store must support **hard links** (the worker gives a camera file its final name with a link) and exclusive file creation, and must confirm the **full durability sync** (`F_FULLFSYNC` on macOS). A real-capture Core probes exclusive create, sync and hard link at start and refuses a volume that fails (D127, D138).
- The level of sync a volume really gives is known only when the worker writes: it is stated with the first durable fragment of each camera file. A volume that does not confirm the full sync raises **one alert per session, CRITICAL in production capture** (INFO in development capture): "The evidence volume does not confirm full durability; recordings may not survive a power loss." **Recording continues** (D189, D190).
- **Behaviour at a power loss is not proven by any test**, and neither is a volume that really runs out of space or really has no hard links (D127, D194).

### Sealed package facts for a verifier

A sealed package of schema version 2 is the folder `SESSION-<sessionId>/` below the media store root: `session-manifest.json`, `signature.sig`, `device-certificate.pem`, `fragments/VIDEO-01.mp4` and / or `fragments/VIDEO-02.mp4` (encrypted), `fragments/fragments.json`, `audit-session-extract.jsonl`, the `transcript/` files when a transcript was sealed, and `export/` once it was exported.

- **One or two camera files.** A session that recorded with one camera is sealed with that one file; the absent camera is the track the manifest does not list (D178, D183).
- **The audit extract is NOT covered by the package signature.** `audit-session-extract.jsonl` must be present, but no manifest field holds its hash. Verify says so on every package of version 2 (notice `AUDIT_EXTRACT_NOT_SIGNED`: "Audit extract: present, NOT covered by the package signature."). The notice fails nothing. This also means that the record of lost audio, which is kept as microphone fault rows in that extract, is not signed (D182, D183).
- **Development marks.** A package signed with a development key and a package recorded from development sources are shown as such by verify and by both clients ("DEVELOPMENT SOURCES — this package was not recorded from production devices."). The development-key mark is read from the certificate that verified the signature and is "not established" when the signature checks did not pass. Both are refused in production capture: a production Core does not start with a development key, does not list development sources, and never records one (D178, D181, D183).
- **Transcript model provenance.** For the `cpu-local` backend the manifest holds the model's name, version, quantisation and file hash; the version is the one DECLARED in the transcriber host file, the other values are read from the model file by the Core. **For a server backend only the model NAME exists, as the STT server reported it**: version, quantisation and file hash are not available to the Core and were not verified. Verify prints exactly that (D160).
- **A transcript revision never changes the sealed transcript.** A revision is a signed record appended to `transcript/transcript-revisions.json`; manifest, signature and the sealed transcript files stay byte-identical (D154, D162).
- **A revision that cannot be healed (known limit).** A revision is committed to the database and staged in `transcript/transcript-revisions.json.next` before it joins the list; verify reports a pending staged file as the notice `REVISION_APPEND_PENDING` and does not fail on it. If the staged file is lost or damaged after the commit and before the next start of the Core, the revision cannot be rebuilt: the revisions of that item then cannot be read (D187).
- A stray file in a package's `export/` folder is reported as the notice `EXPORT_FOLDER_UNEXPECTED_FILE`.

**The tamper demonstration on version-2 packages.** A development-capture Core seals two demo packages at seed time (`db:seed`, `db:reset`; for example `scripts/lane/lane.sh reset 2`) from generated sources with the development key, under its own media store; nothing of them is in git. One verifies with all 15 checks passing; the other has one fragment altered after the seal, and verify names exactly that fragment (`VIDEO-02`, fragment 3) as TAMPERED. Without the helper program the seed says `NOT generated (HELPER_ABSENT)` and writes the dataset without them. The EV 0005 row of the Demo scenarios table above describes the version-1 demo packages of Simulated mode, which are unchanged.

### Privacy, personal data and custody

- **Real evidence can hold personal data**: a voice, a face, a name. The statement of the first demo, that everything is synthetic, does not hold for a recording made in real capture. The security design review recorded this as finding SEC35-26: no consent or legal-basis statement, no retention or erasure rule, no data protection impact assessment and no breach-notification statement exist for this product. This is carried as an **accepted risk of this phase**, not as a solved item. The review's own recommendation is the position this README can state: processing is under the operator's legal mandate; sealed evidence is under legal hold (the product has no erasure of a sealed package, and a reset is refused while real evidence exists); operation stays on loopback and on development sources until the hardware phase. The data protection impact assessment is still to be written by the owner of the deployment.
- **Custody of what is not sealed.** Unsealed recordings, the transcriber's audio tap and the quarantine are plaintext personal data protected by file permissions only (see **Evidence at rest**). Who may read the Core's disk, how long a quarantine folder is kept and who may release it are operator procedures that this repository does not define.
- **The Core Mac's own camera and microphone are a development feature.** They can be selected only in development capture; they do not exist in production capture.
- **Every client shows a notice before they are turned on.** A pre-check and Start Recording on a selection that names this Mac's camera or microphone first ask for confirmation ("This will turn on this Mac's camera (…)."; at Start Recording the sentence adds "and keep it on until the recording ends"). The confirmation is asked again at every press and is never remembered; a reload sends nothing by itself. While a device is on, every client shows a line that says so ("This Mac's camera is on"; on the tablet and the phone "Core Mac's camera is on") (D163, D178, D181, D184).
- **The local microphone is NOT fit for recording yet.** In measured runs it delivered about 8/9 of the sample rate it declares; the cause is not established. Use it for development checks only (D128).
- No automated run and no agent selects, pre-checks or starts this Mac's camera or microphone; such runs are the user's own (D163).

### Export

- An export writes a **decrypted** archive on the Core, under the package's own folder: `SESSION-<sessionId>/export/EXP-<id>.zip`, with its own export manifest and signature. The archive holds the camera files in plaintext. It stays on the Core's disk after the download (D139).
- The item is marked EXPORTED and the custody entry is written only when the export job completes. An export interrupted by a stop of the Core is not resumed: ask again. Unfinished `.partial` files in an `export/` folder are removed at the next start (D185).
- **Download.** In the web console a finished export offers **Download export**. The link is signed, is bound to the operator's sign-in, and **lives 60 seconds**; every download is audited. The tablet and the phone show "Download from the web console." (D185).
- **Composite video export is NOT available in this build**, pending a licence decision on the FFmpeg build. A composite export ends as a failed job with the code `COMPOSITE_ENCODER_NOT_SELECTED`, audited; the clients say "Composite video is not available in this build." The facts, exactly as the licence record states them (`THIRD_PARTY_NOTICES.md`, "FFmpeg for the on-demand composite: M8 licence check"):
  - The helper binary is `.data/helpers/ffmpeg`, a private copy that is byte-identical to the Homebrew program `/opt/homebrew/Cellar/ffmpeg/9.0.2/bin/ffmpeg`; it is a launcher that loads the Homebrew FFmpeg libraries, so "the build" is that Homebrew installation.
  - Its configure flags: `--enable-shared --enable-pthreads --enable-version3 --enable-ffplay --enable-gpl --enable-libsvtav1 --enable-libopus --enable-libx264 --enable-libmp3lame --enable-libdav1d --enable-libvmaf --enable-libvpx --enable-libx265 --enable-openssl --enable-videotoolbox --enable-audiotoolbox --enable-neon`.
  - With `--enable-gpl` and `--enable-version3` the build is GPL-3.0-or-later as a whole. That is a property of the build, not of the encoder a command line names.
  - For a distributed build the record states: distributing this GPL build with a DEMS Core puts the distributed FFmpeg under GPL-3.0-or-later, and whoever distributes owes the licence texts, the complete corresponding source of FFmpeg and of the GPL libraries linked into it (or a written offer), no further restrictions, and, for a device sold as a product, the installation information of GPLv3 section 6 for that program. Running it on this Mac creates no such obligation. Which FFmpeg build a distributed Core carries (none, this GPL build, or an LGPL-only build) is a decision of the product owner that has not been taken; until then no encoder is selected (D139, D141).

### Transcription (STT)

- **Two backends.** `cpu-local` runs the speech engine on the Core itself, on the CPU. The server backend (`omlx-server`) calls a speech-to-text server on a loopback address; on this Mac it is a development aid and is not part of a shipped Core.
- **Settings.** Web console → System & Maintenance → Settings → **Transcription (STT)**: transcription on or off, backend, server address (a loopback address only), model, speaker labelling, the server credential, and **Test connection** (it tests the saved configuration). Supervisor and Technician may change it; a change applies to the next session. The tablet and the phone show the status read-only.
- **The server's key is never typed into DEMS and never printed.** The settings hold a **credential reference**: a pointer to where the key is kept, never the key itself. The field is write-only: it opens empty and is not shown again after saving. Answers of the Core say only whether a credential is set and how it is held.
- **The transcriber host file** tells the Core where the engine and the models are on this host. It is one file, written by hand, `<data directory>/transcriber/host.json` (here `.data/transcriber/host.json`), and it holds paths and statements only, no credential:

  ```json
  { "version": 1,
    "cpuLocal": { "binaryPath": "/abs/path/whisper-cli", "modelDir": "/abs/path/models",
                  "modelVersions": { "<model identifier>": "<version you declare>" } },
    "vad":      { "binaryPath": "/abs/path/whisper-vad-speech-segments", "modelDir": "/abs/path/models", "model": "<vad model>" } }
  ```

  Every member is optional (`threads`, `processors` and `omlxServer.settingsPath` also exist). Paths are absolute. **`modelVersions` is a DECLARED value**: nothing in a model file states its version, so whoever installs the model states it here, and the sealed manifest carries it as declared. A model without an entry has no version, and its sessions are sealed without a transcript document. With no host file the server backend still works and `cpu-local` is refused. A host file that cannot be read in this form stops the start of a real-capture Core.
- **CPU engine: build.** The engine of `cpu-local` is whisper.cpp 1.9.5 with its bundled ggml, built from the release source with every GPU backend off, under the git-ignored `.cache/stt/`; nothing of Homebrew is changed and nothing is installed system-wide. The exact commands (source fetch with its SHA-256, an isolated Python environment holding only `cmake`, the configure flags, the build) are in `docs/2026-10-07_dems_real_capture_sealing/initialization/04_whisper_cpp_cpu_build.md`, sections 4 to 6. The model file `ggml-large-v3-turbo.bin` is the pre-converted file published with whisper.cpp, checked against its published SHA-256 (`delegation_progress/coder-execution-local__row108.md` of the same folder). The voice-activity model and the speaker-labelling engine are recorded in `THIRD_PARTY_NOTICES.md`.
- **CPU engine: uninstall.** Everything of the engine, the models and the build tools lies under `.cache/stt/`; the recorded uninstall is to delete that folder (section 9 of the build note; the notices file gives the narrower commands per component). Afterwards the host file points at nothing: switch the backend or switch transcription off in the settings first, or a real-capture Core that still selects `cpu-local` stops at start with `TRANSCRIBER_CONFIG_UNRESOLVABLE`.
- **No speed figures.** This repository states no transcription speed or throughput figure anywhere (D230 of the predecessor task).
- **Speaker labels.** The running Core composes no speaker-labelling engine in this build, so the speaker labels of a sealed transcript are "unavailable", with the reason, whatever the speaker-labelling switch says. The engine exists in `apps/transcriber` and is exercised by its own tests only (D90, D157).

### Reset rules

`db:reset` and the console's reset return a database to the seed. Since this task a reset is refused, with nothing changed, in these cases (`apps/core-server/src/db/reset/`):

| Refusal | When |
|---|---|
| `RESET_BLOCKED_REAL_EVIDENCE` | Real sealed evidence exists in the database, on disk, or in only one of the two. Also: an unsealed recording of production sources, **any quarantine folder**, a package whose manifest cannot be read, and a media store root that cannot be listed (not mounted, no permission). Demo packages and proven development-source packages do not block; the reset says how many development packages it erases |
| `RESET_STORE_ROOT_CONFLICT` | `DEMS_MEDIA_DIR` in the caller's environment names one media root and the database stores another (the root the Core recorded at its last start). The guard refuses to choose |
| `RESET_STORE_ROOT_UNKNOWN` | The command line has no `DEMS_MEDIA_DIR` and the database stores no root |
| `RESET_TARGET_IN_USE` | A Core of that database is running |

- The command line prints the media store root it is about to judge before it reads it. It takes the root from `DEMS_MEDIA_DIR`, else from the root stored in the database; it never falls back to a default folder (D166, D169).
- A permitted reset removes the folders of the development and demo packages it cleared and, on a development-capture Core, seals the two demo packages again.
- `scripts/lane/lane.sh reset <instance>` runs the reset under the migrate lock with that instance's media root and refuses while its Core runs.

### Fix waves H and I: additions and corrections

Added 2026-10-10 by the documentation errata pass (`docs/2026-10-07_dems_real_capture_sealing/implementation/136_docs_errata_wave_h_i.md`). Fix wave H is in the tree at commit `74fd1f1`; fix wave I is in the working tree and was not committed when this was written (D213, D217). The numbered specification errata are `PE-WH-…` and `PE-WI-…` in `docs/2026-10-07_dems_real_capture_sealing/masterplan/`.

**Gate state, said once.** Re-gates 70 (discovery, connect, selector) and 75 (recording, interrupted naming, blocked seal) have NOT passed; re-gates 81, 89 and 94 have not been run on this tree (D215, D216, D217). Every item below was proven in automated tests only, unless it says otherwise: **not yet gate-verified**.

**Two environment keys of the Core: the installation identity.** Read once at start (`apps/core-server/src/config.ts:60-61`; `apps/core-server/src/sealing-host/installation-identity.ts`). Not yet gate-verified.

| Key | Value | Used for |
|---|---|---|
| `DEMS_INSTALLATION_DEVICE_ID` | A device id: a capital letter, then capitals, digits or hyphens, at most 32 characters (for example `DEMS-JKT-07`) | Manifest field `device.deviceId` of every recording sealed on this Core |
| `DEMS_INSTALLATION_NAME` | 1 to 120 printable characters, no leading or trailing space | Manifest field `device.name` |

- Unset: the manifest says `NOT_CONFIGURED` for the missing one. A `REAL_PRODUCTION` Core REFUSES to start (`INSTALLATION_IDENTITY_NOT_CONFIGURED`, check `sealing.installation-identity`; the line names the missing keys). A `REAL_DEVELOPMENT` Core starts with one warning of the same code. `SIMULATED` never asks (D209).
- A malformed value stops the start: `INSTALLATION_DEVICE_ID_INVALID`, `INSTALLATION_NAME_INVALID` (`config.ts:294`, `:301`).
- `scripts/lane/lane.sh` sets neither key, so a recording sealed on a lane says `NOT_CONFIGURED` for both (D214). A whole Core refusing a `REAL_PRODUCTION` start for this reason was not shown by a test: only the boot function and its wiring line are tested (D209).
- The manifest also states, since wave H: time source `RTC` / `HOST_SYSTEM_CLOCK` (a Core in its own capture has no time service and never says GNSS), the Core's own software version, and `NOT_CONFIGURED` for serial number and hardware UUID (D203, D211).

**Three more refusals of a start** (they extend the table under "What refuses to start"; `apps/core-server/src/capture/fence/fake-mic.ts:50-73`, `apps/core-server/src/config.ts:287`, `apps/core-server/src/capture/fence/development-discovery.ts:39`).

| Code | Refused when | Applies to |
|---|---|---|
| `CAPTURE_DEV_FAKE_MIC_INVALID` | `DEMS_CAPTURE_DEV_FAKE_MIC` is neither `tone` nor `speech` | every start |
| `DEV_FAKE_MIC_NEEDS_DEV_SOURCES` | `DEMS_CAPTURE_DEV_FAKE_MIC=speech` outside development capture | `SIMULATED`, `REAL_PRODUCTION` |
| `DEV_SPEECH_FIXTURE_UNUSABLE` | `speech` is set and the speech fixture is absent, fails the owner and write-bit rule of the helper program, or is not a 16-bit mono 48 kHz PCM WAVE file. The reason is named: `NOT_WAV`, `WAV_NOT_PCM`, `WAV_NOT_MONO`, `WAV_NOT_48KHZ`, `WAV_NOT_16BIT`, `WAV_NO_AUDIO`, `UNREADABLE`, or a reason of the path rule | `REAL_DEVELOPMENT` |
| `DEV_CAMERA_STUB_IN_PRODUCTION` | The lane launcher of the camera stub is asked to start a production configuration (see below). The product's own entry point cannot load the stub | `REAL_PRODUCTION` |

Also since wave H: the worker's version must EQUAL the version this Core drives (`CAPTURE_WORKER_VERSION_MISMATCH`), checked at start and at every session start (D202). This corrects Known limit 21.

**The speech microphone of development capture.** `DEMS_CAPTURE_DEV_FAKE_MIC` = `tone` (the default) or `speech`; development capture only. With `speech` the first test microphone (`MIC-01` of the seed) plays `.data/dev-fixtures/speech-mic/dialogue.wav` in the place of its tone, in real time and looped; the second test microphone keeps its 880 Hz tone. The fixture is SYNTHETIC Indonesian speech made on this machine by `npm run capture:dev-setup` with the macOS speech synthesiser: no network, no recording of a person, git-ignored, its known text beside it in `dialogue.reference.json` (`scripts/capture/speech-fixture.mjs:9-19`). Set-up options, after `--`: `--no-speech-fixture` (skip the step) and `--renew-speech-fixture` (make it again), for example `npm run capture:dev-setup -- --renew-speech-fixture` (`scripts/capture/dev-setup.mjs:6-7`, `:85`). The local speech engine has transcribed a development session on this microphone and the session was sealed with an assembled transcript, in an automated test (D211); this corrects the sentence "no real speech engine has been through a recorded, sealed session" above and Known limit 15 for the `cpu-local` engine on SYNTHETIC speech only. No real microphone and no real voice has been through it, and re-gate 81 has not run: not yet gate-verified. No speed figure is stated (D230 of the predecessor task).

**Limits of the transcript step of the seal** (named settings, set in code, no environment key; `apps/core-server/src/sealing/finalize-transcript/bounds.ts:58`, `:64-68`; D201 ruling 3). They are bounds chosen by the implementation, not measurements of an engine.

| Setting | Default | Meaning |
|---|---|---|
| `stepLimitMs` | 1,800,000 ms (30 min) | The upper bound of the whole step, waiting plus closing out |
| `callLimitMs` | 30,000 ms (30 s) | The upper bound of one question to the transcriber |
| `closeOutLimitMs` | 120,000 ms (2 min) | The part of the step kept for closing the transcript out |
| `closeOutAttempts` | 3 | Failures at the bound before the seal goes on without a transcript |

**`scripts/lane/lane.sh`: three options** (`scripts/lane/lane.sh:6-21`, `:88`, `:255-263`). Not yet gate-verified.

| Command | What it does |
|---|---|
| `scripts/lane/lane.sh start <lane> --with-camera-stub` | Starts the lane's Core through `npm run start:camera-stub -w @dems/core-server` (`apps/core-server/package.json:9`) with ONE fake ONVIF camera on 127.0.0.1 as its ONLY camera search: no multicast and no datagram to the real network. A development-capture lane gets the stub; a `SIMULATED` lane starts without it and says so; a production configuration is not started (`DEV_CAMERA_STUB_IN_PRODUCTION`). The stub's fixture account is made at each start and printed by the script; it is a fixture of the fake device, not a secret. One word in the stub's mode file switches what it answers: `NORMAL`, `AUTH_SCHEME`, `UNREACHABLE`, `NO_PROFILE`, `NOT_H264`, `EMPTY` (`lane.sh:49-60`; D196, D206) |
| `scripts/lane/lane.sh start 2 --speech-mic` | Lane 2 only (development capture): sets `DEMS_CAPTURE_DEV_FAKE_MIC=speech`. On another lane the script stops with exit status 64. The two start options may be given together (`lane.sh:11-13`, `:128`, `:166-167`) |
| `scripts/lane/lane.sh reset 2 --discard-unsealed-fake-recordings` | The reset of the development-capture lane, and it may ERASE unsealed recording folders. See the rule below. On a lane that is not development capture the script stops with exit status 64 and resets nothing (`lane.sh:17-21`, `:232-234`) |

**The FAKE-only rule of `--discard-unsealed-fake-recordings`** (`apps/core-server/src/db/reset/real-evidence.ts:120-121`, `:384`; `lane.sh:62-76`; D216 ruling 4, D217). A reset is still refused (`RESET_BLOCKED_REAL_EVIDENCE`) while the media store holds the folder of a session whose seal did not complete (`SESSION-<id>` without a manifest) or a folder under `.quarantine/`. With the option - and only with it - the reset erases such a folder when the database being reset says its session recorded from EXACTLY FOUR generated (`FAKE`) sources and has no sealed item. A recording from this computer's camera or microphone (`LOCAL_DEVICE`) or from a production device is NEVER erased this way: it still blocks, and a person decides about it; there is no tool for it (D217 ruling 8). The refusal of a reset without the option says how many folders the option would clear. The console's reset never passes the option. Stop the lane first: `scripts/lane/lane.sh stop 2`. This corrects the row `RESET_BLOCKED_REAL_EVIDENCE` of **Reset rules** ("any quarantine folder") and Known limit 29 for FAKE-only sessions.

**Session keys and a reset.** A reset destroys EVERY session key of the key folder of the store it resets; the demo packages it seals anew keep theirs. Session numbers are given out again after a reset; no key of an earlier session survives one (D217 ruling 1). A session whose number meets a key of an earlier session is refused at START, before anything is recorded: `503 NOT_READY`, reason `SESSION_KEY_NOT_OF_SESSION` (or `SESSION_KEY_STORE_UNAVAILABLE` when the key store cannot be used); cancel it and create a new one. This corrects Known limits 23 and 29 ("destroying a session key is not built", "session keys … are not destroyed"). Not yet gate-verified.

**A seal that is retried or blocked.** The Core runs a failed seal again by itself (three retries, after 5 s, 30 s and 120 s). When they are used up the session stays in FINALIZING, a CRITICAL notice names the cause and what restores it, and the clients say "Sealing is blocked" and "The recording is kept on the Core." on a screen that can be left. The Core records no new session until that one is sealed. Known limit 2 stands: there is still no operator action to give up such a seal. Not yet gate-verified (re-gate 75 found this defect; the fix has not been through a gate).

**Export: one self-contained archive, and the receiver's check** (this corrects the first bullet of **Export**: the export manifest and signature are INSIDE the archive, as its last two entries `export/EXP-<id>.manifest.json` and `.sig`). The receiver of a downloaded archive checks it with:

```sh
npm run evidence:verify-export -- <archive.zip> [--sha256 <hex>] [--trust <certificate sha256>]
```

- Defined in the root `package.json:54` -> `apps/core-server/package.json:23` -> `apps/core-server/cli/verify-export.ts`. It needs no Core, no database and no key. It needs the system's `unzip`. A relative path is relative to the folder the command is typed in.
- It prints one line per check, X-01 to X-07. Exit status: 0 every check passed, 1 a check failed, 2 the command could not run (`apps/core-server/src/evidence-export/receiver-cli.ts:1-28`).
- Two limits it prints itself. Without `--trust` the signatures are checked against the certificate inside the archive: the result then says only that the export is consistent with itself. Without `--sha256` the archive's hash is printed, not compared: the hash is stated outside the archive, by the export job in the web console and by the audit row of the download, never inside it.
- Finished archives are DECRYPTED copies and are KEPT in the package's `export/` folder until the package is removed by a reset; the product deletes none and lists them on the item page with **Download export** (D205). One archive per export, each the size of the recording.
- Not yet gate-verified: re-gate 94 has not run on this tree.

**What the clients show in real capture.** No stock picture stands as a camera preview: tiles and session rows say "No preview". Time chips say "Host system clock". A source line says "Reachable" or "Not reachable", and "Stream live" only while a session is recording (D196, D210, D217). Not yet gate-verified.

### Known limits

One list. Each item names the decision that recorded it.

| # | Limit | Decision |
|---|---|---|
| 1 | Recorded media and the transcriber's raw audio tap are plaintext on the media store until the seal completes, and through a crash until recovery seals them. Protection is the owner-only media store. Encrypting while recording is not built | D147, D167, D183, D189 |
| 2 | A recording that cannot be sealed ends its session INCOMPLETE; its files stay in `.quarantine/<sessionId>/` in plaintext. The product cannot bring them back into a seal, and there is no operator action to give up a seal that keeps failing for a cause that may clear: that session stays in FINALIZING and blocks new sessions until the cause is removed | D178, D186 |
| 3 | Moving a media store needs a manual rename of its session-key folder; no command does it. Old scratch under `<data directory>/transcriber/sessions/` is deleted by hand | D180, D189 |
| 4 | A camera clock up to 2 s off is recorded, not corrected; below 500 ms nothing is shown. A camera more than 2 s behind may leave up to 1 s of wrongly timed video before it is given up. Whether the sealed package marks such a track beyond the fault row in the audit extract is not established | D188, D190, D194 (C1, C3) |
| 5 | Power loss, a volume that really runs out of space, and a volume without hard links are not proven by any test; the write-failure path was proven with an injected fault only | D127, D194 |
| 6 | The fragment size bound was proven at a small bound (2 MiB), not at the product's 64 MiB | D188, D194 |
| 7 | The audit extract inside a package is not covered by the package signature; a hash field for it is proposed for the next manifest revision. The record of lost audio lives in that extract and is therefore not signed | D182, D183 |
| 8 | Transcript model provenance of a server backend is the server's reported name only; nothing of it is verified by the Core | D160 |
| 9 | A committed transcript revision whose staged file is lost before the next start cannot be healed | D187 |
| 10 | A sealed-package item shows its development-key mark only after a verification, not on the item detail before one | D183 |
| 11 | The manifest states the session record as it was when the manifest was first built; a seal resumed after an upgrade keeps the earlier software version and names | D178 |
| 12 | The local microphone delivers about 8/9 of its declared rate (cause not established) and is not fit for recording. The local camera is a variable-rate source: the fixed-grid playback check does not apply to it | D128, D136 |
| 13 | Composite video export is not available: no encoder is selected until the licence decision on the FFmpeg build is taken. The generated test camera and the demo seed name `libx264` and therefore need a GPL build of the helper | D139, D141, D185 |
| 14 | An export leaves a decrypted archive on the Core's disk. The download link lives 60 s; a download already running is not cut when it expires, it is cut when the sign-in ends. Playback uses a 60 s media session that the player renews on demand; whether a real player on a device fails during plain playback past 60 s has not been judged | D139, D140, D149, D185 |
| 15 | Real cameras, real microphones and real speech engines are proven on doubles and generated sources only. No run exists in which a real session is transcribed by a real engine and sealed with an assembled transcript | D176, D194 |
| 16 | Biometric sign-in is not gate-tested in this task: the biometric steps were skipped on the user's instruction | D151 |
| 17 | The S7 and S8 cells of the kill matrix (10 cells) are parked on open decision OD-21 and were not run | D155, D172 |
| 18 | In Simulated mode the list of audio-source intervals falls back to one boundary per switch pair once the session's timeline holds more than 200 items | D182 |
| 19 | A Core that dies before the first telemetry of a restarted worker reopens the audio tap as "never lost" | D180 |
| 20 | Two capture faults with different reasons and no device are one alert entry; a system notice raised by a Core that then dies stays active after the restart; some refusals of the capture supervisor raise a fault without a reason | D169, D190, D194 (C4) |
| 21 | A worker binary of the previous version passes the boot checks and fails only at the first session start (it fails closed: nothing is recorded) | D194 (C7) |
| 22 | A replaced camera-credential envelope is not cleaned up by the running Core | D181 |
| 23 | The GCM nonce of a fragment is random: uniqueness under one session key is probabilistic, not proven. Destroying a session key is not built | D147, D189 |
| 24 | Speaker labels are "unavailable" in every sealed transcript of this build: the running Core composes no speaker-labelling engine. The two segmentation models that were downloaded are not cleared for use (see `THIRD_PARTY_NOTICES.md`) | D90, D157 |
| 25 | No production signing key can be provisioned by a command of this repository | D138 |
| 26 | Personal data in real evidence: no consent, retention, erasure or impact-assessment statement exists (SEC35-26, accepted risk) | security review row 35 |
| 27 | A Core that dies in the first moments of a recording, between the worker's first durable fragment and its database row, restarts showing "nothing was recorded" for that session until the start-up seal turns it into an interrupted recording. Nothing is lost; the sentence is wrong for that time | D187 (R74-14) |
| 28 | On the server backend a transcript that is partial because the server had not finished its backlog when the seal stopped waiting is signed with the cause "backend could not be reached". The lost text is reported correctly; the stated cause can be wrong, permanently | D187 (R80-05) |
| 29 | The folder of an unsealed development-source session blocks every reset of its database until it is sealed or removed by hand. Session keys of development packages that a reset removes are not destroyed (those of the reseeded demo packages are) | D189 (R88-10, R88-12) |
| 30 | Verify trusts the Core's current signing certificate only; a retained set of earlier certificates is not built | D189 (R88-14) |
| 31 | The manifest's clock-offset field cannot say "not measured": when the worker measured no offset the field holds a fallback value | D189 (R88-16), D190 |
| 32 | The first group of pictures of a camera is not written at every start (specified behaviour; about one second on the test cameras, up to the camera's keyframe interval). The skipped span is reported by the worker and has no field in the sealed manifest | D142, D157 |
| 33 | A recording whose two microphones both fail is not ended: video may be durable, and named warnings are raised. The switch boundary of the audio source lies a few tens of milliseconds before the instant of the command; the interval record states the exact boundary | D142, D163 |

### Read-only areas

`apps/mock-core` and the packages under `release/` are the 0.1.0 offline edition of the first demo. This task did not change them and they must stay as they are: they are Simulated-only and know nothing of real capture, of version-2 packages or of the transcript. The demo evidence under `packages/shared/assets/demo-evidence/` is still the 14 version-1 packages; the version-2 demo packages are never written there or into `release/`, they are sealed at seed time into the media store of a development-capture Core. Regenerating the version-1 demo data is described under **Demo data** below and does not touch `release/`; a release rebuild is a separate, explicit step (**Release packages**).

## Tests

From the repository root:

```sh
npm run typecheck
npm run lint
npm test
```

Last counts (2026-10-01): shared 508 tests, core-web 438, mobile 833 (72 suites), mock-core 19. Per workspace:

Correction (2026-10-10): the line above is the first demo's state. At commit `f293221` the recorded counts are: shared 2476, capture-protocol 31, core-web 1900, transcriber 561, mock-core 19 (`docs/2026-10-07_dems_real_capture_sealing/test/06_checkpoint_wave_f.md`); core-server unit 6247 and database project 2381 (`gateway_check/08_m3_gate.md` of the same folder); mobile 2438 passed with one failing pin that was corrected afterwards and re-run by file. The Core server has two test projects: `npm test -w @dems/core-server` (unit) and `npm run test:db` (needs PostgreSQL running; throw-away databases; outside the sandbox). The capture worker's checks are `make -C apps/capture-worker` (static rules, self-test, unit checks) and `make -C apps/capture-worker e2e` (the end-to-end series on generated fixtures: about 35 minutes, loopback ports, not part of `npm test`; see `apps/capture-worker/README.md`).

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
| First cold boot of a new `dems2_*` AVD takes 36-71 s | Measured on 2026-10-04 for the first boot of each fresh AVD; the cold start of 12-15 s above is the app's, on a booted emulator |
| Live: `pg:status` exits 2 ("HA-4 NOT RUN", may not connect) | The agent sandbox blocks the connection to 127.0.0.1:4432. Run it outside the sandbox |
| Live: `pg:status` exits 3 (`server NOT RUNNING`) | `npm run pg:start` |
| Live: `pg:status` exits 4 (no cluster) | `npm run pg:init`, then create, migrate and seed (Live mode, steps 1 and 2) |
| Live: `pg:init` says "refused: already provisioned" | Normal on a Mac that is set up; nothing was changed. Use `npm run pg:status` and `npm run pg:start` |
| Live: the Core server exits at start with `"the server stopped: boot"` | The `"check"` names the step: `B-1` the database does not answer (`npm run pg:start`); `B-3` schema version (`db:migrate`); `B-6` not seeded (`db:seed`) |
| Live: `DEMS_CORE_PORT must be one of 4420, 4421, 4422, 4423` | Unset `DEMS_CORE_PORT` (4420) or use a lane port |
| Live console: "Live mode needs another address" | The page was opened at `localhost` (or another port). Open `http://127.0.0.1:5173` |
| Live console: "Core server unreachable" | The Core server is not running, or Vite was started without `DEMS_CORE_PROXY_PORT=4420` |
| Vite stops with `DEMS_CORE_PROXY_PORT must be one of 4420, 4421, 4422, 4423` | Fix the value, or unset it for Simulated mode |
| Live app: "Core server unreachable" | The emulator has no `tcp:4420` reverse rule: `ANDROID_SERIAL=<serial> npm run mobile:reverse` |
| Live: the pre-check is blocked on the Core link | No paired device is connected: open the app on a paired device in Live mode (Live mode, known limits) |
| Live: "Demo controls are disabled on this Core server." | Restart the server with `DEMS_DEMO_CONTROLS=1 npm run start:server`, or use `scripts/lane/lane.sh start main` (demo controls on, own media root). Demo controls do not exist on a Core in real capture |
| Live: `db:seed` exits 1, "already seeded" | Use `db:reset` |
| Live: `db:reset` exits 1 because the database is in use | Stop the Core server of that database, then reset |
| `device-session.sh` exits 77 (LOCKED) | The emulator has a screen lock and is locked. The user runs `apps/mobile/scripts/emulator-user-lock.sh unlock` in their own Terminal |
| `device-session.sh` exits 69 | An emulator of the other AVD family (`dems_*` or `dems2_*`) holds the target's port |
| Real capture: the Core stops at start, check `capture.fence` or `capture.boot` | The code names the cause: see the refusal table in **Real capture, sealing and transcript**. `CAPTURE_EVIDENCE_STORE_UNUSABLE` with reason `READABLE_BY_OTHERS`: the media store root is not owner-only (`chmod 700` it) |
| Real capture: the Core stops at start, check `transcriber.config` | The stored STT configuration cannot be resolved on this host: the transcriber host file is missing or wrong, or the engine or model it names is not there (**Transcription (STT)**) |
| `lane.sh start 2`: "the helper program is missing" / "the capture worker is missing" | `npm run capture:dev-setup` / `make -C apps/capture-worker` |
| `db:reset` refuses with `RESET_STORE_ROOT_CONFLICT` | The Core of that database was started with another media root than this reset names. Use `scripts/lane/lane.sh reset <instance>`, or the same `DEMS_MEDIA_DIR` as the start |
| `db:reset` refuses with `RESET_STORE_ROOT_UNKNOWN` | Set `DEMS_MEDIA_DIR` to the media root of that Core, or start the Core once so that it records its root |
| `db:reset` refuses with `RESET_BLOCKED_REAL_EVIDENCE` | Real evidence, an unsealed recording or a quarantine folder exists below the media root. This is the guard working: nothing was changed (**Reset rules**) |
| A session stays in FINALIZING and no new session can start; alert `SEAL_BLOCKED` | The seal keeps failing for the cause the alert names. Remove the cause; the seal is retried at the next start of the Core and on demand (**Quarantine**) |
| Export: "Composite video is not available in this build." | By design until the licence decision on the FFmpeg build (**Export**) |

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
# the AVDs in use since 2026-10-04 (stop them first, as above)
zsh -l -c 'avdmanager delete avd -n dems2_tablet'
zsh -l -c 'avdmanager delete avd -n dems2_phone'
zsh -l -c 'avdmanager delete avd -n dems2_phone2'

# Android SDK and ~/.android (both absent before this project)
~/Library/Android/sdk/platform-tools/adb kill-server
rm -rf ~/Library/Android ~/.android

# Maestro (host files; on-device driver packages uninstall themselves after each run)
rm -rf ~/.maestro ~/Library/Logs/maestro
```

Per-step rollbacks are at the end of each log in `docs/2026-09-30_dems_demo_stack_setup/initialization/` and `implementation/`.

PostgreSQL and the other Live-mode changes are removed with the commands of **Live mode → Remove**.

## Licences and known issues

- Third-party assets and licences: `THIRD_PARTY_NOTICES.md`. The demo videos and stills are derived from the Pexels hero photo listed there. The demo voices are eSpeak NG 1.52.0 (Indonesian formant voice), and no macOS voices were used.
- Known issues and deferred items: `docs/2026-09-30_dems_demo_stack_setup/verification/01_verification.md` (written by the final verification pass) and the decision log `docs/2026-09-30_dems_demo_stack_setup/decisions/decisions.md` (D112 lists what the fast-track deferred).
- Everything here is a DEMO. Do not reuse its keystore, evidence key or credentials for anything real.
- Real capture task (capture worker, sealing, transcript, export): `docs/2026-10-07_dems_real_capture_sealing/`, decisions in its `decisions/decisions.md`. Its limits are the list **Real capture, sealing and transcript → Known limits**. The licence record of everything that task added, including the FFmpeg build the capture worker links and the speech engine and models, is in `THIRD_PARTY_NOTICES.md`. Media, models, keys and recordings of that task live in the git-ignored `.data/` and `.cache/` and are never committed.
- Backend task (Live mode, roles, pairing): `docs/2026-10-04_dems_backend_rbac_pairing/`, decisions in its `decisions/decisions.md`. The Live-mode limits are listed under **Live mode → Known limits in Live mode**. The PostgreSQL credential files in `.data/` are generated locally, never printed, and removed with the cluster.
