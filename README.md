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

The simulator runs in each client. Mock Core only supplies the health check and the heartbeat.
That describes Simulated mode, the default. In Live mode (section **Live mode** below) the Core server is the Core instead: both clients read and write one PostgreSQL database through it.

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
| Live: "Demo controls are disabled on this Core server." | Restart the server with `DEMS_DEMO_CONTROLS=1 npm run start:server` |
| Live: `db:seed` exits 1, "already seeded" | Use `db:reset` |
| Live: `db:reset` exits 1 because the database is in use | Stop the Core server of that database, then reset |
| `device-session.sh` exits 77 (LOCKED) | The emulator has a screen lock and is locked. The user runs `apps/mobile/scripts/emulator-user-lock.sh unlock` in their own Terminal |
| `device-session.sh` exits 69 | An emulator of the other AVD family (`dems_*` or `dems2_*`) holds the target's port |

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
- Backend task (Live mode, roles, pairing): `docs/2026-10-04_dems_backend_rbac_pairing/`, decisions in its `decisions/decisions.md`. The Live-mode limits are listed under **Live mode → Known limits in Live mode**. The PostgreSQL credential files in `.data/` are generated locally, never printed, and removed with the cluster.
